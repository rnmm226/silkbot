// app/api/chat/types.ts

export interface RagChunk {
  chunk_id: string;
  filename: string;
  page?: number | null;
  similarity: number;
  content: string;
  source_url?: string | null; // NOUVEAU — lien direct vers l'article (ex: Luca Pacioli)
  source_type?: 'jort' | 'jibaya' | 'luca_pacioli'; // NOUVEAU — utile pour différencier le formatage des sources
}

export interface UsedSource {
  chunk_id: string;
  filename: string;
  page: number | null;
  url?: string | null; // NOUVEAU — lien vers l'article si disponible (ex: Luca Pacioli)
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

export interface Plan {
  reasoning: string;
  tools: string[];
  search_query: string;
}

export interface ToolResult {
  tool: string;
  result: any;
  error?: string;
}

export interface SearchResponse {
  chunks: RagChunk[];
}

export interface DocumentResponse {
  content: string;
  filename: string;
  page: number | null;
}