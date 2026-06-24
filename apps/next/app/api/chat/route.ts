// app/api/chat/route.ts
import { readChat, saveChat, getUserConversations } from '@/util/chat-store';
import { generateId, type UIMessage } from 'ai';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { runAgent, runAgentGemini } from "./agent";
import { checkApiConnection } from "./tools";
import type { GeminiStructuredResponse } from "./types";

// ✅ Augmenté de 60s à 120s : avec MAX_ITERATIONS=3 dans agent.ts, le
// pipeline ReAct peut enchaîner jusqu'à ~8 appels LLM (draft, planner ×3,
// décision ×3, réponse finale) sur des modèles de raisonnement comme
// gemini-3.5-flash, qui sont plus lents par appel que les anciens flash.
// 60s était trop juste même sans aucun gaspillage de retry.
const REQUEST_TIMEOUT = 120000;

function getMessageText(message: UIMessage): string {
  const textPart = message.parts?.find(
    (part): part is { type: 'text'; text: string } =>
      part.type === 'text' && !part.text?.startsWith('<!--RAG:')
  );
  return textPart?.text || '';
}

function validateMessage(message: any): { valid: boolean; error?: string } {
  if (!message) return { valid: false, error: 'Message is required' };
  if (typeof message !== 'object') return { valid: false, error: 'Message must be an object' };
  if (!message.text && !message.parts) return { valid: false, error: 'Message must have text or parts' };
  
  const text = message.text || getMessageText(message);
  if (text && text.length > 10000) {
    return { valid: false, error: 'Message too long (max 10000 characters)' };
  }
  
  return { valid: true };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs}ms`)), timeoutMs);
    promise.then(
      (result) => { clearTimeout(timeout); resolve(result); },
      (error) => { clearTimeout(timeout); reject(error); }
    );
  });
}

function createStreamResponse(agentPromise: Promise<GeminiStructuredResponse>) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'start', message: 'Début de l\'analyse...' })}\n\n`)
          );
          const result = await agentPromise;
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'complete', result })}\n\n`)
          );
          controller.close();
        } catch (error) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', error: String(error) })}\n\n`)
          );
          controller.close();
        }
      },
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    }
  );
}

// ✅ AJOUT : Fonction pour créer un nouveau chat
async function createNewChat(userId?: string) {
  const chatId = generateId();
  await saveChat({
    chatId,
    userId,
    title: 'Nouvelle conversation',
  });
  return chatId;
}

export async function POST(req: NextRequest) {
  try {
    const { message, id, stream = false, agent = 'react' } = await req.json();
    
    // ✅ Gestion de la création d'un nouveau chat
    if (!id && !message) {
      // Créer un nouveau chat vide
      const session = await auth.api.getSession({ headers: req.headers });
      const userId = session?.user?.id;
      const chatId = await createNewChat(userId);
      return NextResponse.json({ id: chatId });
    }
    
    if (!id || !message) {
      return NextResponse.json({ error: 'Chat ID and message required' }, { status: 400 });
    }

    const validation = validateMessage(message);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
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

    const history = messages.slice(0, -1).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: getMessageText(msg) }],
    }));

    let agentPromise: Promise<GeminiStructuredResponse>;
    if (agent === 'gemini') {
      console.log('[Route] Utilisation de runAgentGemini');
      agentPromise = runAgentGemini(messageText, history);
    } else {
      console.log('[Route] Utilisation de runAgent (ReAct)');
      agentPromise = runAgent(messageText, history);
    }

    if (stream) {
      return createStreamResponse(agentPromise);
    }

    const parsed = await withTimeout(agentPromise, REQUEST_TIMEOUT);

    const assistantMessage: UIMessage = {
      id: generateId(),
      role: 'assistant',
      parts: [
        { type: 'text', text: parsed.answer },
        { type: 'text', text: `<!--RAG:${JSON.stringify(parsed)}-->` },
      ],
    };
    await saveChat({
      chatId: id,
      messages: [...messages, assistantMessage],
      activeStreamId: null,
      userId,
    });
    console.log("[Route] Parsed response =", JSON.stringify(parsed, null, 2));
    return NextResponse.json(parsed);

  } catch (error) {
    console.error('Chat API error:', error);
    
    let status = 500;
    let message = 'Internal server error';
    
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        status = 504;
        message = 'La requête a pris trop de temps. Veuillez réessayer.';
      } else if (error.message.includes('validation')) {
        status = 400;
        message = error.message;
      } else if (error.message.includes('not found')) {
        status = 404;
        message = 'Conversation non trouvée';
      } else if (error.message.includes('unauthorized') || error.message.includes('authentication')) {
        status = 401;
        message = 'Authentification requise';
      }
    }
    
    return NextResponse.json(
      { 
        error: message,
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status }
    );
  }
}

// ✅ CORRECTION : GET avec meilleur formatage des données
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const q = req.nextUrl.searchParams.get('q') || '';

    let conversations;
    
    if (!q) {
      // Récupérer toutes les conversations
      conversations = await getUserConversations(userId);
    } else {
      // Rechercher avec filtre
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
          messages: { 
            orderBy: { createdAt: 'desc' }, 
            take: 1 
          },
          _count: { 
            select: { messages: true } 
          },
        },
      });

      conversations = results.map(conv => ({
        id: conv.id,
        title: conv.title || 'Nouvelle conversation',
        updatedAt: conv.updatedAt,
        createdAt: conv.createdAt,
        lastMessage: conv.messages[0]?.content || '',
        messageCount: conv._count.messages,
      }));
    }

    return NextResponse.json(conversations);
    
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json([], { status: 500 });
  }
}

export async function OPTIONS(req: NextRequest) {
  const status = await checkApiConnection();
  return NextResponse.json({
    status: status.connected ? 'healthy' : 'unhealthy',
    api: status,
    timestamp: new Date().toISOString(),
  });
}