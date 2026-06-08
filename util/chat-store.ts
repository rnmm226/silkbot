// util/chat-store.ts
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { type UIMessage } from 'ai';

export type ChatWithMessages = {
  id: string;
  title?: string | null;
  messages: UIMessage[];
  activeStreamId: string | null;
  userId?: string | null;
};

// Helper pour extraire le texte d'un message
function getMessageText(message: UIMessage): string {
  const textPart = message.parts?.find(
    (part): part is { type: 'text'; text: string } => part.type === 'text'
  );
  return textPart?.text || '';
}

// Helper pour convertir un message DB en UIMessage
function dbMessageToUIMessage(msg: any): UIMessage {
  // Convertir via JSON pour éviter les problèmes de types
  const parts = msg.parts ? JSON.parse(JSON.stringify(msg.parts)) as UIMessage['parts'] : [];
  
  return {
    id: msg.id,
    role: msg.role as 'user' | 'assistant',
    parts: parts,
  };
}

// Helper pour convertir UIMessage en format DB (sans createdAt)
function uiMessageToDbData(msg: UIMessage, chatId: string) {
  return {
    id: msg.id,
    chatId: chatId,
    role: msg.role,
    content: getMessageText(msg),
    parts: msg.parts as Prisma.JsonValue,
    createdAt: new Date(),
  };
}

// ✅ Créer un nouveau chat
export async function createChat(userId?: string): Promise<string> {
  const chat = await prisma.chat.create({
    data: {
      activeStreamId: null,
      userId: userId || null,
      title: "Nouvelle conversation",
    },
  });
  return chat.id;
}

// ✅ Lire un chat avec ses messages
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
    
    if (!chat) {
      return null;
    }
    
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

// ✅ Sauvegarder un chat (messages et stream)
export async function saveChat({
  chatId,
  messages,
  activeStreamId,
  title,
}: {
  chatId: string;
  messages?: UIMessage[];
  activeStreamId?: string | null;
  title?: string;
}): Promise<void> {
  try {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
    });
    
    if (!chat) {
      await prisma.chat.create({
        data: {
          id: chatId,
          title: title || "Nouvelle conversation",
          activeStreamId: activeStreamId || null,
        },
      });
    } else {
      // Mettre à jour les champs du chat
      const updateData: any = {};
      if (activeStreamId !== undefined) updateData.activeStreamId = activeStreamId;
      if (title !== undefined) updateData.title = title;
      
      if (Object.keys(updateData).length > 0) {
        await prisma.chat.update({
          where: { id: chatId },
          data: updateData,
        });
      }
    }
    
    // Mettre à jour les messages si fournis
    if (messages !== undefined) {
      // Supprimer les anciens messages
      await prisma.message.deleteMany({
        where: { chatId },
      });
      
      // Créer les nouveaux messages
      if (messages.length > 0) {
        const messagesData = messages.map(msg => uiMessageToDbData(msg, chatId));
        await prisma.message.createMany({
          data: messagesData,
        });
      }
    }
  } catch (error) {
    console.error('Error saving chat:', error);
    throw error;
  }
}

// ✅ Récupérer toutes les conversations d'un utilisateur
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
      title: conv.title || "Nouvelle conversation",
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

// ✅ Récupérer les messages d'une conversation
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

// ✅ Mettre à jour le titre d'une conversation
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

// ✅ Supprimer un chat (soft delete)
export async function deleteChat(id: string): Promise<void> {
  await prisma.chat.update({
    where: { id },
    data: { userId: null },
  });
}

// ✅ Supprimer définitivement un chat
export async function deleteChatPermanently(id: string): Promise<void> {
  await prisma.chat.delete({
    where: { id },
  });
}