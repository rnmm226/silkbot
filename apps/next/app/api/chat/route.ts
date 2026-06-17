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

export interface GeminiStructuredResponse {
  thinking_summary: ThinkingSummary;
  answer: string;
  used_sources: UsedSource[];
  fallback?: boolean;
  model_used?: string;
}

// ─────────────────────────────────────────────
// Models — tried in order
// ─────────────────────────────────────────────

const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  
];

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

function isRetryableError(err: any): boolean {
  const msg = String(err?.message || err || '');
  return (
    msg.includes('503') ||
    msg.includes('overloaded') ||
    msg.includes('high demand') ||
    msg.includes('quota') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('Service Unavailable')
  );
}

async function callModel(
  modelName: string,
  prompt: string,
  systemInstruction: string,
  history: { role: string; parts: { text: string }[] }[] = []
): Promise<string | null> {
  try {
    const model = genAI.getGenerativeModel({ model: modelName, systemInstruction });
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(prompt);
    return result.response.text();
  } catch (err) {
    if (isRetryableError(err)) {
      console.warn(`[${modelName}] unavailable, trying next...`);
      return null;
    }
    throw err;
  }
}

async function callWithFallback(
  prompt: string,
  systemInstruction: string,
  history: { role: string; parts: { text: string }[] }[] = []
): Promise<{ text: string; model: string } | null> {
  for (const modelName of MODELS) {
    const text = await callModel(modelName, prompt, systemInstruction, history);
    if (text !== null) return { text, model: modelName };
  }
  return null;
}

// ─────────────────────────────────────────────
// RAG search
// ─────────────────────────────────────────────

async function getRagChunks(query: string): Promise<RagChunk[]> {
  try {
    const res = await fetch(process.env.NEXT_PUBLIC_API_URL+'/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: query }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.chunks || [];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────
// JSON parser
// ─────────────────────────────────────────────

function parseStructured(rawText: string, chunks: RagChunk[]): GeminiStructuredResponse {
  try {
    const clean = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON');
    const parsed = JSON.parse(match[0]) as GeminiStructuredResponse;
    if (!parsed.answer || !parsed.thinking_summary) throw new Error('Invalid');
    return parsed;
  } catch {
    return {
      thinking_summary: {
        chunks_analyzed: chunks.length,
        chunks_retained: 0,
        documents_consulted: [...new Set(chunks.map(c => c.filename))],
        documents_retained: [],
        steps: ['Analyse effectuée', 'Format inattendu — réponse brute'],
      },
      answer: rawText,
      used_sources: [],
    };
  }
}

// ─────────────────────────────────────────────
// RAG-only fallback (LLM completely down)
// ─────────────────────────────────────────────

function buildRagOnlyResponse(chunks: RagChunk[]): GeminiStructuredResponse {
  if (chunks.length === 0) {
    return {
      thinking_summary: {
        chunks_analyzed: 0,
        chunks_retained: 0,
        documents_consulted: [],
        documents_retained: [],
        steps: ['Aucun document trouvé', 'Service LLM indisponible'],
      },
      answer: '⚠️ Le service de génération est temporairement indisponible et aucun document pertinent n\'a été trouvé.',
      used_sources: [],
      fallback: true,
    };
  }

  const top = chunks.slice(0, 3);
  const docs = [...new Set(top.map(c => c.filename))];

  return {
    thinking_summary: {
      chunks_analyzed: chunks.length,
      chunks_retained: top.length,
      documents_consulted: [...new Set(chunks.map(c => c.filename))],
      documents_retained: docs,
      steps: [
        `${chunks.length} passages analysés par similarité`,
        `${top.length} passages les plus pertinents sélectionnés`,
        'Service LLM indisponible — extraits affichés directement',
      ],
    },
    answer: [
      '> ⚠️ *Service LLM temporairement indisponible. Voici les passages les plus pertinents des documents officiels.*\n',
      ...top.map((c, i) =>
        `**Extrait ${i + 1}** — ${c.filename}${c.page ? ` (p.${c.page})` : ''}\n\n${c.content}`
      ),
    ].join('\n\n---\n\n'),
    used_sources: top.map(c => ({
      chunk_id: c.chunk_id,
      filename: c.filename,
      page: c.page,
      excerpt: c.content.split(' ').slice(0, 20).join(' ') + '…',
    })),
    fallback: true,
  };
}

// ─────────────────────────────────────────────
// PIPELINE : Verify-then-Answer
//
// Étape 1 — Draft : LLM répond librement à la question
// Étape 2 — Extract : LLM extrait les termes clés pour la recherche RAG
// Étape 3 — Search : recherche vectorielle dans les documents
// Étape 4 — Refine : LLM reformule avec les documents comme référence
//           (questions générales sans document pertinent => réponse libre
//            assumée et signalée comme non vérifiée ; questions spécifiques
//            sans document pertinent => le modèle l'indique explicitement)
// ─────────────────────────────────────────────
const SYSTEM_PROMPT = `Tu es Counsel, un assistant juridique tunisien expert.

PROCESSUS EN 3 ÉTAPES OBLIGATOIRES :

ÉTAPE 1 — ANALYSE
Détermine d'abord la nature de la question :
- Question GÉNÉRALE : définition, notion juridique courante, question de culture juridique générale, ne nécessitant pas la citation précise d'un article ou d'un texte tunisien.
- Question SPÉCIFIQUE : nécessite une référence précise (article, loi, décret, chiffre exact, procédure tunisienne précise).

Pour chaque passage fourni, décide ensuite s'il est pertinent. Un passage est pertinent s'il contient une règle, un article, une définition ou un fait directement lié à la question.

ÉTAPE 2 — RÉDACTION
- Si des passages pertinents existent, rédige ta réponse EN PRIORITÉ à partir de ces passages : les documents fournis prévalent toujours sur tes connaissances générales en cas de conflit.
- Si aucun passage n'est pertinent ET que la question est GÉNÉRALE, réponds normalement à partir de tes connaissances juridiques générales du droit tunisien (tu peux conserver et enrichir la réponse provisoire si elle est correcte). Précise simplement que cette réponse n'a pas été vérifiée par la base documentaire.
- Si aucun passage n'est pertinent ET que la question est SPÉCIFIQUE (nécessite une référence précise que tu ne peux pas garantir), indique-le explicitement plutôt que d'inventer une référence.

ÉTAPE 3 — TRAÇABILITÉ
Pour chaque information utilisée provenant d'un document, identifie le chunk_id source exact.
N'inclus dans used_sources QUE les chunks réellement pertinents et réellement cités dans ta réponse.

RÈGLES ABSOLUES :
- Ne jamais inventer un article, un numéro de loi ou une référence précise absente des documents.
- Ne jamais inclure un chunk non pertinent dans used_sources.
- Pour une question générale sans document pertinent, tu PEUX répondre avec tes connaissances générales, mais signale-le dans thinking_summary (ex: "Réponse basée sur connaissances générales, non vérifiée par la base documentaire").
- Répondre en français juridique professionnel.
- Structurer avec des titres markdown (##) si la réponse dépasse 3 points.

FORMAT DE RÉPONSE : JSON strict uniquement — aucun texte avant ou après les accolades.`;



function buildUserPrompt(
  question: string,
  draft: string,
  chunks: RagChunk[]
): string{
  if (chunks.length === 0) {
    return `QUESTION: ${question}

PASSAGES DISPONIBLES: Aucun passage trouvé dans la base documentaire.

RÉPONSE PROVISOIRE À VÉRIFIER :
${draft}

Aucun document pertinent n'a été trouvé pour cette question. Applique la règle de l'ÉTAPE 2 du système :
- Si la question est générale, réponds normalement avec tes connaissances juridiques (tu peux conserver et enrichir la réponse provisoire ci-dessus si elle est correcte), en précisant que cette réponse n'a pas été vérifiée par la base documentaire.
- Si la question est spécifique et nécessite une référence précise non vérifiable, indique-le clairement au lieu d'inventer une référence.

Réponds UNIQUEMENT en JSON valide:
{
  "thinking_summary": {
    "chunks_analyzed": 0,
    "chunks_retained": 0,
    "documents_consulted": [],
    "documents_retained": [],
    "steps": ["Aucun document pertinent trouvé", "Réponse basée sur les connaissances générales du modèle, non vérifiée par la base documentaire"]
  },
  "answer": "...",
  "used_sources": []
}`;
  }

  const documentsConsulted = [...new Set(chunks.map(c => c.filename))];

  const passages = chunks
    .map((chunk, index) => {
      return `[PASSAGE ${index + 1}]
chunk_id: ${chunk.chunk_id}
document: ${chunk.filename}
page: ${chunk.page ?? 'N/A'}
similarité: ${chunk.similarity.toFixed(3)}

${chunk.content}`;
    })
    .join('\n\n-------------------\n\n');

 return `QUESTION:
${question}

RÉPONSE PROVISOIRE À VÉRIFIER :
${draft}

Si cette réponse est cohérente avec les documents, tu peux la conserver et l'enrichir.
Si elle est incorrecte ou incomplète, corrige-la.
Les documents juridiques ont toujours priorité.

PASSAGES DISPONIBLES (${chunks.length}):
${passages}

DOCUMENTS CONSULTÉS:
${documentsConsulted.join(', ')}

Applique rigoureusement le processus en 3 étapes défini dans les instructions système.

Réponds UNIQUEMENT en JSON valide contenant exactement cette structure :

{
  "thinking_summary": {
    "chunks_analyzed": ${chunks.length},
    "chunks_retained": <nombre>,
    "documents_consulted": ${JSON.stringify(documentsConsulted)},
    "documents_retained": ["..."],
    "steps": [
      "...",
      "...",
      "..."
    ]
  },
  "answer": "...",
  "used_sources": [
    {
      "chunk_id": "...",
      "filename": "...",
      "page": null,
      "excerpt": "..."
    }
  ]
}`;
}




async function verifyThenAnswer(
  question: string,
  history: { role: string; parts: { text: string }[] }[]
): Promise<GeminiStructuredResponse> {

  // ── ÉTAPE 1 : Draft libre du LLM ──────────────────────────────
  console.log('[Pipeline] Étape 1 — Draft libre');
  const draftResult = await callWithFallback(
    question,
    `Tu es un assistant juridique tunisien expert. Réponds à la question de façon concise et précise en français juridique. Si tu ne connais pas la réponse exacte, explique ce que tu sais et indique qu'une vérification documentaire est nécessaire.`,
    history
  );

  const draft = draftResult?.text || '';
  const modelUsed = draftResult?.model || 'unknown';
  console.log(`[Pipeline] Draft obtenu depuis ${modelUsed}`);

  // ── ÉTAPE 2 : Extraction des termes de recherche ───────────────
  console.log('[Pipeline] Étape 2 — Extraction termes de recherche');
  const extractResult = await callWithFallback(
    `Question: "${question}"
Réponse provisoire: "${draft.slice(0, 300)}"

Extrais 2-4 termes juridiques clés à rechercher dans une base documentaire tunisienne.
Réponds UNIQUEMENT avec les termes séparés par des virgules, rien d'autre.
Exemple: TVA agricole, exonération fiscale, code des impôts`,
    'Tu es un expert en recherche documentaire juridique tunisienne. Extrais uniquement les termes clés pertinents.'
  );

  const searchTerms = extractResult?.text?.trim() || question;
  const searchQuery = `${question} ${searchTerms}`;
  console.log(`[Pipeline] Termes de recherche: ${searchTerms}`);

  // ── ÉTAPE 3 : Recherche RAG ────────────────────────────────────
  console.log('[Pipeline] Étape 3 — Recherche RAG');
  const chunks = await getRagChunks(searchQuery);
  console.log(`[Pipeline] ${chunks.length} chunks trouvés`);

// ── ÉTAPE 4 : Réponse finale avec vérification documentaire ───
console.log('[Pipeline] Étape 4 — Réponse finale vérifiée');

const refinePrompt = buildUserPrompt(
  question,
  draft,
  chunks
);

const finalResult = await callWithFallback(
  refinePrompt,
  SYSTEM_PROMPT
);



  if (!finalResult) {
    // LLM down pour l'étape finale — utilise le draft + RAG
    console.warn('[Pipeline] LLM indisponible pour étape finale, fallback');

    if (draft) {
      // On a au moins le draft
      return {
        thinking_summary: {
          chunks_analyzed: chunks.length,
          chunks_retained: 0,
          documents_consulted: [...new Set(chunks.map(c => c.filename))],
          documents_retained: [],
          steps: [
            'Réponse initiale générée',
            'Vérification documentaire effectuée',
            'Service LLM indisponible pour la synthèse finale',
          ],
        },
        answer: `${draft}\n\n> ⚠️ *La vérification documentaire n'a pas pu être complétée (service temporairement indisponible).*`,
        used_sources: [],
        fallback: true,
        model_used: modelUsed,
      };
    }

    return buildRagOnlyResponse(chunks);
  }

  const parsed = parseStructured(finalResult.text, chunks);
  parsed.model_used = finalResult.model;
  return parsed;
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

    const history = messages.slice(0, -1).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: getMessageText(msg) }],
    }));

    // ── Pipeline principal ──
    const parsed = await verifyThenAnswer(messageText, history);

    // ── Sauvegarder avec JSON structuré caché ──
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