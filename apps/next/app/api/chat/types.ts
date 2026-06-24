// app/api/chat/types.ts

export interface RagChunk {
  chunk_id: string;
  filename: string;
  page?: number | null;
  similarity: number;
  content: string;
  source_url?: string | null;
  source_type?: 'jort' | 'jibaya' | 'luca_pacioli';
  document_id?: string;
}

// ⚠️ Ajouté : utilisé partout dans tools.ts et gemini-tools.ts
// (`Promise<SearchResponse>`, `result.chunks`) mais absent du fichier
// fourni. Forme déduite de son usage réel (ex: `return { chunks }`).
export interface SearchResponse {
  chunks: RagChunk[];
}

export interface UsedSource {
  chunk_id: string;
  filename: string;
  page: number | null;   // ✅ nullable — cohérent avec ce que le prompt demande réellement
  url?: string | null;   // ✅ ajouté — sinon le lien renvoyé par Gemini est illisible en TS
  excerpt: string;
}

export interface ThinkingSummary {
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

export interface ChatRequest {
  question: string;
  history?: { role: string; parts: { text: string }[] }[];
}

export interface ChatResponse {
  response: GeminiStructuredResponse;
  status: 'success' | 'fallback' | 'error';
}

export interface Plan {
  reasoning: string;
  tools: string[];
  search_query: string;
  toolCalls?: { name: string; [key: string]: unknown }[];
}

export interface ToolResult {
  tool: string;
  // ✅ Élargi pour accepter SearchResponse directement ({ chunks: RagChunk[] }) —
  // l'ancienne forme ({ chunks?: RagChunk[]; [key: string]: unknown }) exigeait
  // une signature d'index que SearchResponse n'a pas, ce qui faisait échouer
  // le type-check dans executor.ts (results.push({ tool, result })).
  result: SearchResponse | null;
  error?: string;
}