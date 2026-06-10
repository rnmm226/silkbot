// app/api/chat/route.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import { readChat, saveChat, getUserConversations } from '@/util/chat-store';
import { generateId, type UIMessage, createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);

// 🔥 AJOUT : Définition des types (manquants)
interface SourceDetail {
  filename: string;
  page: number | null;
  chunk_index: number;
}

interface RagResponse {
  context: string;
  sources: string[];
  source_details: SourceDetail[];
}

function getMessageText(message: UIMessage): string {
  const textPart = message.parts?.find(
    (part): part is { type: 'text'; text: string } => part.type === 'text'
  );
  return textPart?.text || '';
}

// ✅ Recherche RAG avec typage correct
async function getRagContext(question: string): Promise<RagResponse> {
  try {
    const res = await fetch('http://localhost:8000/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    if (!res.ok) return { context: '', sources: [], source_details: [] };
    const data = await res.json();
    return {
      context: data.context || '',
      sources: data.sources || [],
      source_details: data.source_details || []
    };
  } catch {
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

    // ✅ Récupérer le contexte RAG (avec source_details)
    const { context, sources, source_details } = await getRagContext(messageText);

    // 🔥 Construire les liens markdown AVANT de les utiliser
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    
    const sourcesLinks = source_details.map((detail: SourceDetail) => {
      const pageParam = detail.page ? `?page=${detail.page}` : '';
      const encodedFilename = encodeURIComponent(detail.filename);
      return `[${detail.filename}](${apiUrl}/document/${encodedFilename}${pageParam})`;
    }).join(' · ');

    // Fallback si pas de source_details (utilise sources simple)
    const fallbackLinks = sources.map((filename: string) => {
      const encodedFilename = encodeURIComponent(filename);
      return `[${filename}](${apiUrl}/document/${encodedFilename})`;
    }).join(' · ');

    const finalSourcesLinks = sourcesLinks || fallbackLinks;

    // ✅ Construire le system prompt
    const systemPrompt = context
      ? `Tu es un assistant juridique tunisien expert en droit tunisien.

RÈGLES IMPORTANTES :
1. Reformule ta réponse avec tes mots. Ne cite JAMAIS les noms de fichiers entre crochets dans ta réponse.
2. Structure ta réponse clairement avec des titres courts (##).
3. Sois concis et va droit au but.

Voici les informations juridiques :
${context}`
      : `Tu es un assistant juridique tunisien. Réponds de manière claire et utile.`;

    // 🔥 CORRECTION : history et model étaient manquants
    const history = messages.slice(0, -1).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: getMessageText(msg) }],
    }));

    const model = genAI.getGenerativeModel({
      model: 'gemma-4-31b-it',
      systemInstruction: systemPrompt,
    });

    const chatSession = model.startChat({ history });
    const geminiStream = await chatSession.sendMessageStream(messageText);

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

        writer.write({ type: 'text-end', id: messageId });

        // ✅ Ajouter les sources à la fin avec LIENS (pas juste les noms bruts)
        if (finalSourcesLinks) {
          const sourcesText = `\n\n---\n📄 **Sources:** ${finalSourcesLinks}`;
          fullText += sourcesText;
        } else if (sources.length > 0) {
          // Fallback si pas de liens
          const sourcesText = `\n\n---\n📄 **Sources:** ${sources.join(' · ')}`;
          fullText += sourcesText;
        }

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