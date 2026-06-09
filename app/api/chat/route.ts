// app/api/chat/route.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import { readChat, saveChat, getUserConversations } from '@/util/chat-store';
import { generateId, type UIMessage, createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);

function getMessageText(message: UIMessage): string {
  const textPart = message.parts?.find(
    (part): part is { type: 'text'; text: string } => part.type === 'text'
  );
  return textPart?.text || '';
}

export async function POST(req: NextRequest) {
  try {
    const { message, id } = await req.json();

    if (!id || !message) {
      return new Response(
        JSON.stringify({ error: 'Chat ID and message required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const session = await auth.api.getSession({
      headers: req.headers,
    });
    const userId = session?.user?.id;

    const chat = await readChat(id);
    let messages = chat?.messages || [];

    const messageText = getMessageText(message);
    const newMessage: UIMessage = {
      id: message.id || generateId(),
      role: 'user',
      parts: [{ type: 'text', text: messageText }],
    };

    messages = [...messages, newMessage];
    await saveChat({ chatId: id, messages, activeStreamId: null, userId });

    const history = messages.slice(0, -1).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: getMessageText(msg) }],
    }));

    const model = genAI.getGenerativeModel({ model: 'gemma-4-31b-it' });
    const chatSession = model.startChat({ history });
    const geminiStream = await chatSession.sendMessageStream(messageText);

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        let fullText = '';
        const messageId = generateId();

        writer.write({
          type: 'text-start',
          id: messageId,
        });

        for await (const chunk of geminiStream.stream) {
          const text = chunk.text();
          console.log(text)
          fullText += text;

          writer.write({
            type: 'text-delta',
            id: messageId,
            delta: text,
          });
        }

        writer.write({
          type: 'text-end',
          id: messageId,
        });

        const assistantMessage: UIMessage = {
          id: messageId,
          role: 'assistant',
          parts: [{ type: 'text', text: fullText }],
        };

        await saveChat({ chatId: id, messages: [...messages, assistantMessage], activeStreamId: null, userId });
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

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });
  console.log('session userId:', session?.user?.id); // ✅ ajoute ça
   // après getUserConversations

  const userId = session?.user?.id;
  const q = req.nextUrl.searchParams.get('q') || '';

  if (!userId) return NextResponse.json([]);

  if (!q) {
    const conversations = await getUserConversations(userId);
    console.log('conversations count:', conversations?.length);
    return NextResponse.json(conversations);
  }

  const results = await prisma.chat.findMany({
    where: {
      userId,
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        {
          messages: {
            some: {
              content: { contains: q, mode: 'insensitive' },
            },
          },
        },
      ],
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json(
    results.map(conv => ({
      id: conv.id,
      title: conv.title || 'Nouvelle conversation',
      updatedAt: conv.updatedAt,
      lastMessage: conv.messages[0]?.content || '',
      messageCount: conv._count.messages,
    }))
  );
}