// app/api/chat/route.ts - Version corrigée sans erreurs
import { GoogleGenerativeAI } from '@google/generative-ai';
import { readChat, saveChat } from '@/util/chat-store';
import { generateId, type UIMessage, createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { NextResponse } from 'next/dist/server/web/spec-extension/response';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);

function getMessageText(message: UIMessage): string {
  const textPart = message.parts?.find(
    (part): part is { type: 'text'; text: string } => part.type === 'text'
  );
  return textPart?.text || '';
}

export async function POST(req: Request) {
  try {
    const { message, id } = await req.json();

    if (!id || !message) {
      return new Response(
        JSON.stringify({ error: 'Chat ID and message required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const chat = await readChat(id);
    let messages = chat?.messages || [];

    const messageText = getMessageText(message);
    const newMessage: UIMessage = {
      id: message.id || generateId(),
      role: 'user',
      parts: [{ type: 'text', text: messageText }],
    };

    messages = [...messages, newMessage];
    await saveChat({ chatId: id, messages, activeStreamId: null });

    // Préparer l'historique
    const history = messages.slice(0, -1).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: getMessageText(msg) }],
    }));

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const chatSession = model.startChat({ history });
    const geminiStream = await chatSession.sendMessageStream(messageText);

    // Créer un stream au format UI Message - Version corrigée
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        let fullText = '';
        const messageId = generateId();
        
        // Écrire le début du message
        writer.write({
          type: 'text-start',
          id: messageId,
        });
        
        // Écrire chaque chunk
        for await (const chunk of geminiStream.stream) {
          const text = chunk.text();
          fullText += text;
          
          writer.write({
            type: 'text-delta',
            id: messageId,
            delta: text,
          });
        }
        
        // Écrire la fin du message
        writer.write({
          type: 'text-end',
          id: messageId,
        });
        
        // Sauvegarder le message complet
        const assistantMessage: UIMessage = {
          id: messageId,
          role: 'assistant',
          parts: [{ type: 'text', text: fullText }],
        };
        
        await saveChat({ chatId: id, messages: [...messages, assistantMessage], activeStreamId: null });
      },
    });

    return createUIMessageStreamResponse({ stream });
    
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ error: 'Error processing request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
export async function GET() {
  try {
    const conversations = await prisma?.chat.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(conversations);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}