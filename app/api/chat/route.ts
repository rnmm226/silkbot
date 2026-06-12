// app/api/chat/route.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import { readChat, saveChat, getUserConversations } from '@/util/chat-store';
import { generateId, type UIMessage } from 'ai';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface RagChunk {
  chunk_id: string;
  filename: string;
  page: number | null;
  content: string;
  similarity: number;
}

interface UsedSource {
  chunk_id: string;
  filename: string;
  page: number | null;
  excerpt: string;
}

interface ThinkingSummary {
  chunks_analyzed: number;
  chunks_retained: number;
  documents_consulted: string[];
  documents_retained: string[];
  steps: string[];
}

interface GeminiStructuredResponse {
  thinking_summary: ThinkingSummary;
  answer: string;
  used_sources: UsedSource[];
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getMessageText(message: UIMessage): string {
  const textPart = message.parts?.find(
    (part): part is { type: 'text'; text: string } =>
      part.type === 'text' && !part.text?.startsWith('<!--RAG:')
  );
  return textPart?.text || '';
}

// ─────────────────────────────────────────────
// RAG Search
// ─────────────────────────────────────────────

async function getRagChunks(question: string): Promise<RagChunk[]> {
  try {
    const response = await fetch('http://localhost:8000/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.chunks || [];
  } catch (error) {
    console.error('RAG search error:', error);
    return [];
  }
}

// ─────────────────────────────────────────────
// Prompt builder
// ─────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es Counsel, un assistant juridique tunisien expert.

PROCESSUS EN 3 ÉTAPES OBLIGATOIRES :

ÉTAPE 1 — ANALYSE
Pour chaque passage, décide s'il est pertinent.
Un passage est pertinent s'il contient une règle, un article, une définition ou un fait directement lié à la question.

ÉTAPE 2 — RÉDACTION
Rédige une réponse claire, structurée et professionnelle UNIQUEMENT à partir des passages retenus.
Si aucun passage n'est pertinent, indique-le explicitement.

ÉTAPE 3 — TRAÇABILITÉ
Pour chaque information utilisée, identifie le chunk_id source exact.
N'inclus dans used_sources QUE les chunks réellement cités dans ta réponse.

RÈGLES ABSOLUES :
- Ne jamais inventer d'information absente des documents.
- Ne jamais inclure un chunk non pertinent dans used_sources.
- Répondre en français juridique professionnel.
- Structurer avec des titres markdown (##) si la réponse dépasse 3 points.

FORMAT DE RÉPONSE : JSON strict uniquement — aucun texte avant ou après les accolades.`;

function buildUserPrompt(question: string, chunks: RagChunk[]): string {
  if (chunks.length === 0) {
    return `QUESTION: ${question}

PASSAGES DISPONIBLES: Aucun passage trouvé dans la base documentaire.

Réponds UNIQUEMENT en JSON valide:
{
  "thinking_summary": {
    "chunks_analyzed": 0,
    "chunks_retained": 0,
    "documents_consulted": [],
    "documents_retained": [],
    "steps": ["Aucun document pertinent trouvé"]
  },
  "answer": "Je n'ai pas trouvé de documents pertinents dans la base juridique pour répondre à cette question.",
  "used_sources": []
}`;
  }

  const chunksText = chunks
    .map(
      (c, i) => `[PASSAGE ${i + 1}]
chunk_id: ${c.chunk_id}
fichier: ${c.filename}
page: ${c.page ?? 'N/A'}
similarité: ${c.similarity.toFixed(2)}
---
${c.content}
---`
    )
    .join('\n\n');

  return `QUESTION: ${question}

PASSAGES DISPONIBLES (${chunks.length} passages, triés par pertinence):

${chunksText}

Réponds UNIQUEMENT en JSON valide selon ce schéma exact (aucun texte avant ou après):
{
  "thinking_summary": {
    "chunks_analyzed": ${chunks.length},
    "chunks_retained": <nombre de passages retenus>,
    "documents_consulted": [<liste des fichiers présents dans les passages>],
    "documents_retained": [<liste des fichiers réellement utilisés>],
    "steps": [<liste de 3-5 étapes courtes décrivant le raisonnement>]
  },
  "answer": "<réponse markdown complète>",
  "used_sources": [
    {
      "chunk_id": "<chunk_id exact>",
      "filename": "<nom du fichier>",
      "page": <numéro de page ou null>,
      "excerpt": "<extrait de 15-30 mots du passage utilisé>"
    }
  ]
}`;
}

// ─────────────────────────────────────────────
// JSON parser avec fallback
// ─────────────────────────────────────────────

function parseGeminiResponse(rawText: string, chunks: RagChunk[]): GeminiStructuredResponse {
  try {
    const clean = rawText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');

    const parsed = JSON.parse(jsonMatch[0]) as GeminiStructuredResponse;
    if (!parsed.answer || !parsed.thinking_summary) throw new Error('Invalid structure');

    return parsed;
  } catch (e) {
    console.warn('JSON parse failed, using fallback:', e);
    return {
      thinking_summary: {
        chunks_analyzed: chunks.length,
        chunks_retained: 0,
        documents_consulted: [...new Set(chunks.map(c => c.filename))],
        documents_retained: [],
        steps: ['Analyse effectuée', 'Format de réponse inattendu'],
      },
      answer: rawText,
      used_sources: [],
    };
  }
}

// ─────────────────────────────────────────────
// POST
// ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { message, id } = await req.json();

    if (!id || !message) {
      return NextResponse.json({ error: 'Chat ID and message required' }, { status: 400 });
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

    // ── 1. RAG ──
    const chunks = await getRagChunks(messageText);

    // ── 2. Prompt ──
    const userPrompt = buildUserPrompt(messageText, chunks);

    // ── 3. Gemini ──
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: SYSTEM_PROMPT,
    });

    const history = messages.slice(0, -1).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: getMessageText(msg) }],
    }));

    const chatSession = model.startChat({ history });
    const result = await chatSession.sendMessage(userPrompt);
    const rawText = result.response.text();

    // ── 4. Parse ──
    const parsed = parseGeminiResponse(rawText, chunks);

    // ── 5. Sauvegarder avec le JSON structuré caché dans les parts ──
    // Le part <!--RAG:...--> permet de recharger la réponse structurée
    // depuis l'historique sans appel API supplémentaire.
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

    // ── 6. Retourner ──
    return NextResponse.json(parsed);

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// GET — Conversations
// ─────────────────────────────────────────────

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