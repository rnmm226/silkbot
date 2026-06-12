
// app/api/chat/[id]/stop/route.ts
import { readChat, saveChat } from '@/apps/next/util/chat-store';
import { type UIMessage } from 'ai';
import { prisma } from '@/lib/prisma';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';

type StopRequest = {
  activeStreamId?: string | null;
  assistantMessage?: UIMessage;
};

// Helper pour extraire le texte d'un message
function getMessageText(message: UIMessage): string {
  const textPart = message.parts?.find(
    (part): part is { type: 'text'; text: string } => part.type === 'text'
  );
  return textPart?.text || '';
}

// Type pour les parts d'un message
type MessagePart = 
  | { type: 'text'; text: string }
  | { type: 'file'; url: string; filename?: string; mediaType?: string };

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Vérifier l'authentification
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const chat = await readChat(id);

    if (!chat) {
      return Response.json({ error: "Chat not found" }, { status: 404 });
    }

    // Vérifier si le stream est actif
    if (chat.activeStreamId == null) {
      return Response.json({ success: true, message: "No active stream" });
    }

    const activeStreamId = chat.activeStreamId;
    const body = (await req.json().catch(() => ({}))) as StopRequest;

    // Vérifier si l'ID du stream correspond
    if (body.activeStreamId != null && body.activeStreamId !== activeStreamId) {
      return Response.json({ success: true, message: "Stream ID mismatch" });
    }

    // Sauvegarder le message assistant partiel s'il a été fourni
    if (body.assistantMessage) {
      try {
        // Vérifier si le message existe déjà
        const existingMessage = await prisma.message.findUnique({
          where: { id: body.assistantMessage.id },
        });

        if (!existingMessage) {
          // Sauvegarder le message assistant partiel
          await prisma.message.create({
            data: {
              id: body.assistantMessage.id,
              chatId: id,
              role: body.assistantMessage.role,
              content: getMessageText(body.assistantMessage),
              parts: JSON.parse(JSON.stringify(body.assistantMessage.parts)),
              createdAt: new Date(),
            },
          });
        }
      } catch (error) {
        console.error("Error saving assistant snapshot:", error);
      }
    }

    // Marquer le stream comme arrêté dans la base de données
    try {
      await prisma.chat.update({
        where: { id },
        data: { activeStreamId: null },
      });
    } catch (error) {
      console.error("Error marking stream as stopped:", error);
    }

    // Mettre à jour le chat dans chat-store
    await saveChat({
      chatId: id,
      activeStreamId: null,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error in stop endpoint:", error);
    return Response.json(
      { error: "Failed to stop stream", success: false },
      { status: 500 }
    );
  }
}
