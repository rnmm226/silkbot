import { google } from '@ai-sdk/google';
import { readChat, saveChat } from '@/util/chat-store';
import {
  convertToModelMessages,
  generateId,
  streamText,
  type UIMessage,
} from 'ai';
import { after } from 'next/server';
import { createResumableStreamContext } from 'resumable-stream';

export async function POST(req: Request) {
  try {
    const {
      message,
      id,
    }: {
      message: UIMessage | undefined;
      id: string;
    } = await req.json();

    if (!id) {
      return new Response(JSON.stringify({ error: 'Chat ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Lire le chat existant
    const chat = await readChat(id);
    let messages = chat?.messages || [];

    // Ajouter le nouveau message
    const newMessage: UIMessage = {
      id: message.id || generateId(),
      role: 'user',
      content: message.content || '',
      parts: message.parts || [{ type: 'text', text: message.content || '' }],
      createdAt: new Date(),
    };

    messages = [...messages, newMessage];

    // Sauvegarder le message utilisateur et clear l'ancien stream
    await saveChat({ id, messages, activeStreamId: null });

    // Convertir les messages pour le modèle
    const modelMessages = await convertToModelMessages(messages);

    // Streamer la réponse avec Google Gemini
    const result = streamText({
      model: google('gemini-1.5-flash'),
      messages: modelMessages,
    });

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      generateMessageId: generateId,
      onFinish: async ({ messages: finishedMessages }) => {
        // Clear the active stream when finished
        await saveChat({ id, messages: finishedMessages, activeStreamId: null });
      },
      async consumeSseStream({ stream }) {
        const streamId = generateId();

        // Create a resumable stream from the SSE stream
        const streamContext = createResumableStreamContext({ waitUntil: after });
        await streamContext.createNewResumableStream(streamId, () => stream);

        // Update the chat with the active stream ID
        await saveChat({ id, activeStreamId: streamId });
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Erreur lors du traitement',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}