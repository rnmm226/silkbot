// util/chat-store.ts
import { Prisma } from '@/lib/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { type UIMessage } from 'ai';

export type ChatWithMessages = {
  id: string;
  title?: string | null;
  messages: UIMessage[];
  activeStreamId: string | null;
  userId?: string | null;
};

type StoredMessage = {
  id: string;
  role: string;
  parts: Prisma.JsonValue | null;
};

const DEFAULT_CHAT_TITLE = "Nouvelle conversation";
const MAX_GENERATED_TITLE_LENGTH = 60;

// ✅ CORRIGÉ : on exclut désormais explicitement les parts qui contiennent
// les métadonnées RAG (<!--RAG:...-->), exactement comme le fait déjà
// getMessageText() dans route.ts. Avant, cette fonction prenait juste le
// PREMIER part de type 'text', ce qui ne fonctionnait que par chance
// (parsed.answer est en position [0] dans route.ts). Si l'ordre des parts
// changeait un jour, "content" en base et "lastMessage" dans la liste des
// conversations afficheraient le JSON brut <!--RAG:{...}--> à l'utilisateur.
function getMessageText(message: UIMessage): string {
  const textPart = message.parts?.find(
    (part): part is { type: 'text'; text: string } =>
      part.type === 'text' && !part.text?.startsWith('<!--RAG:')
  );
  return textPart?.text || '';
}

function getTitleFromFirstMessage(messages?: UIMessage[]): string | undefined {
  const firstUserMessage = messages?.find((message) => message.role === 'user');
  if (!firstUserMessage) return undefined;

  const text = getMessageText(firstUserMessage).replace(/\s+/g, ' ').trim();
  if (!text) return undefined;

  if (text.length <= MAX_GENERATED_TITLE_LENGTH) return text;

  return `${text.slice(0, MAX_GENERATED_TITLE_LENGTH - 3).trimEnd()}...`;
}

// ✅ CORRIGÉ : validation du rôle au lieu d'un cast silencieux.
// Avant : `msg.role as 'user' | 'assistant'` — si une valeur inattendue
// était stockée en base (ex: 'system', ou une corruption de données),
// le cast passait sans erreur et le bug se manifestait plus tard,
// loin de sa cause réelle (ex: dans l'UI qui ne sait pas afficher un
// rôle inconnu). Ici on log un avertissement et on retombe sur 'assistant'
// par défaut plutôt que de propager silencieusement une valeur invalide.
function normalizeRole(role: string): 'user' | 'assistant' {
  if (role === 'user' || role === 'assistant') return role;
  console.warn(`[chat-store] Rôle inattendu en base: "${role}" — traité comme "assistant"`);
  return 'assistant';
}

function dbMessageToUIMessage(msg: StoredMessage): UIMessage {
  const parts = msg.parts ? JSON.parse(JSON.stringify(msg.parts)) as UIMessage['parts'] : [];
  return {
    id: msg.id,
    role: normalizeRole(msg.role),
    parts: parts,
  };
}

function uiMessageToDbData(msg: UIMessage, chatId: string) {
  return {
    id: msg.id,
    chatId: chatId,
    role: msg.role,
    content: getMessageText(msg),
    parts: msg.parts as Prisma.InputJsonValue,
    createdAt: new Date(),
  };
}

export async function createChat(userId?: string): Promise<string> {
  const chat = await prisma.chat.create({
    data: {
      activeStreamId: null,
      userId: userId || null,
      title: DEFAULT_CHAT_TITLE,
    },
  });
  return chat.id;
}

export async function readChat(id: string): Promise<ChatWithMessages | null> {
  try {
    const chat = await prisma.chat.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!chat) return null;

    const uiMessages: UIMessage[] = chat.messages.map(dbMessageToUIMessage);

    return {
      id: chat.id,
      title: chat.title,
      messages: uiMessages,
      activeStreamId: chat.activeStreamId || null,
      userId: chat.userId,
    };
  } catch (error) {
    console.error('Error reading chat:', error);
    return null;
  }
}

export async function saveChat({
  chatId,
  messages,
  activeStreamId,
  title,
  userId,
}: {
  chatId: string;
  messages?: UIMessage[];
  activeStreamId?: string | null;
  title?: string;
  userId?: string;
}): Promise<void> {
  try {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
    });

    const generatedTitle = title ?? getTitleFromFirstMessage(messages);

    if (!chat) {
      await prisma.chat.create({
        data: {
          id: chatId,
          title: generatedTitle || DEFAULT_CHAT_TITLE,
          activeStreamId: activeStreamId || null,
          userId: userId || null,
        },
      });
    } else {
      const updateData: Prisma.ChatUpdateInput = {};
      if (activeStreamId !== undefined) updateData.activeStreamId = activeStreamId;
      if (title !== undefined) updateData.title = title;
      if (
        title === undefined &&
        generatedTitle &&
        (!chat.title || chat.title === DEFAULT_CHAT_TITLE)
      ) {
        updateData.title = generatedTitle;
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.chat.update({
          where: { id: chatId },
          data: updateData,
        });
      }
    }

    if (messages !== undefined) {
      await prisma.message.deleteMany({ where: { chatId } });

      if (messages.length > 0) {
        const messagesData = messages.map(msg => uiMessageToDbData(msg, chatId));
        await prisma.message.createMany({ data: messagesData });
      }
    }
  } catch (error) {
    console.error('Error saving chat:', error);
    throw error;
  }
}

export async function getUserConversations(userId: string) {
  try {
    const conversations = await prisma.chat.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    return conversations.map(conv => ({
      id: conv.id,
      title: conv.title || DEFAULT_CHAT_TITLE,
      updatedAt: conv.updatedAt,
      createdAt: conv.createdAt,
      lastMessage: conv.messages[0]?.content || "",
      messageCount: conv._count.messages,
    }));
  } catch (error) {
    console.error('Error getting user conversations:', error);
    return [];
  }
}

export async function getConversationMessages(chatId: string): Promise<UIMessage[]> {
  try {
    const messages = await prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
    });
    return messages.map(dbMessageToUIMessage);
  } catch (error) {
    console.error('Error getting conversation messages:', error);
    return [];
  }
}

export async function updateConversationTitle(chatId: string, title: string) {
  try {
    await prisma.chat.update({
      where: { id: chatId },
      data: { title },
    });
  } catch (error) {
    console.error('Error updating conversation title:', error);
  }
}

export async function deleteChat(id: string): Promise<void> {
  await prisma.chat.update({
    where: { id },
    data: { userId: null },
  });
}

export async function deleteChatPermanently(id: string): Promise<void> {
  await prisma.chat.delete({
    where: { id },
  });
}