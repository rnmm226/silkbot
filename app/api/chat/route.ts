// app/api/chat/route.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import { readChat, saveChat, getUserConversations } from '@/util/chat-store';
import { generateId, type UIMessage, createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);

interface SourceDetail {
  filename: string;
  page: number | null;
  chunk_index: number;
}

function getMessageText(message: UIMessage): string {
  const textPart = message.parts?.find(
    (part): part is { type: 'text'; text: string } => part.type === 'text'
  );
  return textPart?.text || '';
}

// Recherche RAG directe (sans function calling)
async function getRagContext(question: string): Promise<{
  context: string;
  sources: string[];
  source_details: SourceDetail[];
}> {
  try {
    const response = await fetch('http://localhost:8000/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });

    if (!response.ok) {
      return { context: '', sources: [], source_details: [] };
    }

    return await response.json();
  } catch (error) {
    console.error('RAG search error:', error);
    return { context: '', sources: [], source_details: [] };
  }
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

    const session = await auth.api.getSession({ headers: req.headers });
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

    // 🔥 ÉTAPE 1 : Recherche RAG directe (1 appel)
    const { context, sources, source_details } = await getRagContext(messageText);

    // 🔥 ÉTAPE 2 : Construction du prompt système avec le format de réponse Ordalie
    const systemPrompt =`Tu es Counsel, un assistant juridique tunisien expert.

PROCESSUS EN 3 ÉTAPES :

ÉTAPE 1 — ANALYSE
Analyse chaque passage fourni et décide s'il est pertinent pour la question.
Un passage est pertinent s'il contient une règle, un article, une définition ou un fait directement lié à la question.

ÉTAPE 2 — RÉDACTION
Rédige une réponse claire, structurée et professionnelle basée UNIQUEMENT sur les passages retenus.
Si aucun passage n'est pertinent, dis-le explicitement.

ÉTAPE 3 — TRAÇABILITÉ
Pour chaque affirmation dans ta réponse, identifie le chunk_id source.

RÈGLES ABSOLUES :
- Ne jamais inventer d'information absente des documents.
- Ne jamais citer un chunk non pertinent.
- Répondre en français juridique professionnel.
- Structurer avec des titres markdown si la réponse dépasse 3 points.

FORMAT DE RÉPONSE : JSON strict (aucun texte avant ou après).`;

    const model = genAI.getGenerativeModel({
      model: 'gemma-4-26b-a4b-it',
      systemInstruction: systemPrompt,
    });

    const history = messages.slice(0, -1).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: getMessageText(msg) }],
    }));

    const chatSession = model.startChat({ history });
    const geminiStream = await chatSession.sendMessageStream(messageText);

    // 🔥 ÉTAPE 4 : Construction des liens markdown pour les sources
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    let sourcesText = '';
    if (source_details && source_details.length) {
      const sourcesLinks = source_details.map((detail: SourceDetail) => {
          const pageParam = detail.page ? `?page=${detail.page}` : '';
          return `[${detail.filename}](${apiUrl}/document/${encodeURIComponent(detail.filename)}${pageParam})`;
      }).join(' · ');
      sourcesText = sourcesLinks
        ? `\n\n---\n📄 **Sources:** ${sourcesLinks}`
        : '';
    }

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        let fullText = '';
        const messageId = generateId();

        writer.write({ type: 'text-start', id: messageId });

        for await (const chunk of geminiStream.stream) {
          const text = chunk.text();
          fullText += text;
          writer.write({ type: 'text-delta', id: messageId, delta: text });
        }

        // Ajouter les sources à la fin (avant de clore le flux)
        if (sourcesText) {
          writer.write({ type: 'text-delta', id: messageId, delta: sourcesText });
          fullText += sourcesText;
        }

        writer.write({ type: 'text-end', id: messageId });

        const assistantMessage: UIMessage = {
          id: messageId,
          role: 'assistant',
          parts: [{ type: 'text', text: fullText }],
        };

        await saveChat({
          chatId: id,
          messages: [...messages, assistantMessage],
          activeStreamId: null,
          userId,
        });
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
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id;
  const q = req.nextUrl.searchParams.get('q') || '';

  if (!userId) return NextResponse.json([]);

  if (!q) {
    const conversations = await getUserConversations(userId);
    return NextResponse.json(conversations);
  }

  const results = await prisma.chat.findMany({
    where: {
      userId,
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { messages: { some: { content: { contains: q, mode: 'insensitive' } } } },
      ],
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
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