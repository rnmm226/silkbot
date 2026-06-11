import { GoogleGenerativeAI } from '@google/generative-ai';
import { readChat, saveChat, getUserConversations } from '@/util/chat-store';
import { generateId, type UIMessage } from 'ai';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);

// ─────────────────────────────────────────────
// CACHE + MODE FAILSAFE
// ─────────────────────────────────────────────

const cache = new Map<string, any>();
let fallbackUntil = 0;

// ─────────────────────────────────────────────
// TYPES
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
// HELPERS
// ─────────────────────────────────────────────

function getMessageText(message: UIMessage): string {
  const textPart = message.parts?.find(
    (p): p is { type: 'text'; text: string } => p.type === 'text'
  );
  return textPart?.text || '';
}

// ─────────────────────────────────────────────
// RAG
// ─────────────────────────────────────────────

async function getRagChunks(question: string): Promise<RagChunk[]> {
  try {
    const res = await fetch('http://localhost:8000/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });

    if (!res.ok) return [];
    const data = await res.json();

    return (data.chunks || []).slice(0, 5);
  } catch (e) {
    console.error('RAG error:', e);
    return [];
  }
}

// ─────────────────────────────────────────────
// FORMAT FALLBACK (STRUCTURE IDENTIQUE LLM)
// ─────────────────────────────────────────────

function formatFallbackAnswer(chunks: RagChunk[]) {
  const grouped = new Map<string, RagChunk[]>();

  for (const c of chunks) {
    if (!grouped.has(c.filename)) grouped.set(c.filename, []);
    grouped.get(c.filename)!.push(c);
  }

  let result = "";

  for (const [file, items] of grouped.entries()) {
    result += `## 📄 ${file}\n\n`;

    for (const item of items) {
      result += `- ${item.content.slice(0, 300)}...\n\n`;
    }
  }

  return result.trim() || "Aucune information exploitable trouvée.";
}

// ─────────────────────────────────────────────
// PROMPT LLM
// ─────────────────────────────────────────────

function buildPrompt(question: string, chunks: RagChunk[]) {
  const context = chunks
    .map(
      (c) => `
[${c.filename} | page ${c.page}]
${c.content}
`
    )
    .join('\n');

  return `
QUESTION:
${question}

CONTEXTE:
${context}

Réponds en JSON strict avec :
- thinking_summary
- answer
- used_sources
`;
}

// ─────────────────────────────────────────────
// SAFE JSON PARSER
// ─────────────────────────────────────────────

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    return JSON.parse(text.slice(start, end + 1));
  }
}

// ─────────────────────────────────────────────
// POST
// ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { message, id } = await req.json();

    const session = await auth.api.getSession({ headers: req.headers });
    const userId = session?.user?.id;

    const question = getMessageText(message);

    // ── CACHE ──
    const cacheKey = question.toLowerCase().trim();
    if (cache.has(cacheKey)) {
      return NextResponse.json(cache.get(cacheKey));
    }

    // ── SAVE USER MSG ──
    const chat = await readChat(id);
    const messages = chat?.messages || [];

    const newMessage: UIMessage = {
      id: message.id || generateId(),
      role: 'user',
      parts: [{ type: 'text', text: question }],
    };

    await saveChat({
      chatId: id,
      messages: [...messages, newMessage],
      activeStreamId: null,
      userId,
    });

    // ── RAG ──
    const chunks = await getRagChunks(question);

    const now = Date.now();
    const mode = now < fallbackUntil ? 'FALLBACK' : 'NORMAL';

    let response: GeminiStructuredResponse;

    // ─────────────────────────────
    // 🔴 FALLBACK MODE (NO LLM)
    // ─────────────────────────────
    if (mode === 'FALLBACK') {
      console.log('🔴 FALLBACK MODE');

      response = {
        thinking_summary: {
          chunks_analyzed: chunks.length,
          chunks_retained: chunks.length,
          documents_consulted: [...new Set(chunks.map(c => c.filename))],
          documents_retained: [...new Set(chunks.map(c => c.filename))],
          steps: [
            "Mode fallback activé",
            "Analyse directe des documents",
            "Aucun LLM utilisé"
          ],
        },

        answer: formatFallbackAnswer(chunks),

        used_sources: chunks.map(c => ({
          chunk_id: c.chunk_id,
          filename: c.filename,
          page: c.page,
          excerpt: c.content.slice(0, 200),
        })),
      };
    }

    // ─────────────────────────────
    // 🟢 NORMAL MODE (LLM)
    // ─────────────────────────────
    else {
      console.log('🟢 NORMAL MODE');

      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
      });

      try {
        const result = await model.generateContent(
          buildPrompt(question, chunks)
        );

        const raw = result.response.text();
        const parsed = safeJson(raw);

        response = parsed || {
          thinking_summary: {
            chunks_analyzed: chunks.length,
            chunks_retained: 0,
            documents_consulted: [],
            documents_retained: [],
            steps: [],
          },
          answer: raw,
          used_sources: [],
        };
      } catch (e) {
        console.error('LLM failed → fallback ON');

        // active fallback 60s
        fallbackUntil = Date.now() + 60_000;

        response = {
          thinking_summary: {
            chunks_analyzed: chunks.length,
            chunks_retained: chunks.length,
            documents_consulted: [],
            documents_retained: [],
            steps: ["LLM failure → fallback auto"],
          },

          answer: formatFallbackAnswer(chunks),

          used_sources: chunks.map(c => ({
            chunk_id: c.chunk_id,
            filename: c.filename,
            page: c.page,
            excerpt: c.content.slice(0, 200),
          })),
        };
      }
    }

    // ── SAVE ASSISTANT ──
    const assistantMessage: UIMessage = {
      id: generateId(),
      role: 'assistant',
      parts: [{ type: 'text', text: response.answer }],
    };

    await saveChat({
      chatId: id,
      messages: [...messages, assistantMessage],
      activeStreamId: null,
      userId,
    });

    // ── CACHE ──
    cache.set(cacheKey, response);

    return NextResponse.json(response);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}