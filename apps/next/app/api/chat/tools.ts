// app/api/chat/tools.ts
import type { SearchResponse, RagChunk } from './types';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

const DEFAULT_TIMEOUT = 10000;
const MAX_RETRIES = 2;

// ── Helpers ──────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = DEFAULT_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries: number = MAX_RETRIES
): Promise<any> {
  let lastError: Error | null = null;
  
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetchWithTimeout(url, options);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[fetchWithRetry] Tentative ${i + 1}/${retries + 1} échouée:`, lastError.message);
      
      if (i < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
      }
    }
  }
  
  throw lastError || new Error('Toutes les tentatives ont échoué');
}

// ── Cache des endpoints ─────────────────────────────────────────

let endpointCache: Record<string, boolean> = {};

async function checkEndpoint(endpoint: string): Promise<boolean> {
  if (endpointCache[endpoint] !== undefined) {
    return endpointCache[endpoint];
  }
  
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(2000),
    });
    const available = response.ok || response.status === 405;
    endpointCache[endpoint] = available;
    console.log(`[checkEndpoint] ${endpoint}: ${available ? '✅' : '❌'}`);
    return available;
  } catch {
    endpointCache[endpoint] = false;
    return false;
  }
}

// ── Outils de recherche ─────────────────────────────────────────

export async function semantic_search(query: string): Promise<SearchResponse> {
  try {
    console.log(`[semantic_search] 🔍 Recherche: "${query}"`);
    const data = await fetchWithRetry(`${API_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: query }),
    });
    
    const chunks = data.chunks || [];
    console.log(`[semantic_search] ✅ ${chunks.length} chunks trouvés`);
    return { chunks };
  } catch (error) {
    console.error('[semantic_search] ❌ Erreur:', error);
    return { chunks: [] };
  }
}

export async function smart_search(query: string): Promise<SearchResponse> {
  console.log(`[smart_search] 🔍 Recherche intelligente: "${query}"`);
  
  const endpoints = ['/search', '/search/articles', '/search/tags'];
  const available = await Promise.all(endpoints.map(e => checkEndpoint(e)));
  
  const results: RagChunk[] = [];
  
  for (let i = 0; i < endpoints.length; i++) {
    if (available[i]) {
      try {
        const res = await fetch(`${API_URL}${endpoints[i]}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: query }),
        });
        if (res.ok) {
          const data = await res.json();
          const chunks = data.chunks || [];
          results.push(...chunks);
          console.log(`[smart_search] ✅ ${endpoints[i]}: ${chunks.length} chunks`);
        }
      } catch (error) {
        console.warn(`[smart_search] ⚠️ ${endpoints[i]} a échoué`);
      }
    }
  }
  
  if (results.length === 0) {
    console.log('[smart_search] ⚠️ Aucun résultat, fallback vers semantic_search');
    return semantic_search(query);
  }
  
  const unique = results.filter(
    (chunk, index, self) =>
      index === self.findIndex(c => c.chunk_id === chunk.chunk_id)
  );
  unique.sort((a, b) => b.similarity - a.similarity);
  
  console.log(`[smart_search] ✅ ${unique.length} chunks uniques`);
  return { chunks: unique.slice(0, 20) };
}

export async function article_search(query: string): Promise<SearchResponse> {
  console.log(`[article_search] 🔍 Fallback vers smart_search pour: "${query}"`);
  return smart_search(`article loi ${query}`);
}

export async function tag_search(query: string): Promise<SearchResponse> {
  console.log(`[tag_search] 🔍 Fallback vers smart_search pour: "${query}"`);
  const tags = query.split(',').map(t => t.trim()).join(' ');
  return smart_search(tags);
}

export async function document_search(query: string): Promise<SearchResponse> {
  console.log(`[document_search] 🔍 Fallback vers smart_search pour: "${query}"`);
  return smart_search(`document ${query}`);
}

export async function get_document(docId: string): Promise<SearchResponse> {
  try {
    console.log(`[get_document] 🔍 ID: ${docId}`);
    const data = await fetchWithRetry(`${API_URL}/documents/${docId}`);
    const chunks = data.chunks || [];
    console.log(`[get_document] ✅ ${chunks.length} chunks`);
    return { chunks };
  } catch (error) {
    console.error('[get_document] ❌ Erreur:', error);
    return { chunks: [] };
  }
}

export async function get_page(pageId: string): Promise<SearchResponse> {
  try {
    console.log(`[get_page] 🔍 ID: ${pageId}`);
    const data = await fetchWithRetry(`${API_URL}/pages/${pageId}`);
    const chunks = data.chunks || [];
    console.log(`[get_page] ✅ ${chunks.length} chunks`);
    return { chunks };
  } catch (error) {
    console.error('[get_page] ❌ Erreur:', error);
    return { chunks: [] };
  }
}

export async function hybrid_search(query: string): Promise<SearchResponse> {
  console.log(`[hybrid_search] 🔍 Recherche hybride pour: "${query}"`);
  return smart_search(query);
}

// ── Map des outils ──────────────────────────────────────────────

export const toolMap: Record<string, (query: string) => Promise<SearchResponse>> = {
  semantic_search,
  article_search,
  tag_search,
  document_search,
  get_document,
  get_page,
  hybrid_search,
  smart_search,
};

export const TOOL_DESCRIPTIONS = `
- semantic_search: Recherche sémantique dans tous les documents. Utile pour les questions générales.
- article_search: Recherche spécifique dans les articles de loi tunisiens.
- tag_search: Recherche par tags/mots-clés.
- document_search: Recherche par nom de document.
- get_document: Récupère un document complet par son ID.
- get_page: Récupère une page spécifique par son ID.
- hybrid_search: Recherche combinée (sémantique + articles + tags).
- smart_search: Recherche intelligente qui s'adapte aux endpoints disponibles.
`;

export function getToolNames(): string[] {
  return Object.keys(toolMap);
}

export function getToolDescription(toolName: string): string | undefined {
  const descriptions: Record<string, string> = {
    semantic_search: 'Recherche sémantique générale',
    article_search: 'Recherche dans les articles de loi',
    tag_search: 'Recherche par tags',
    document_search: 'Recherche par nom de document',
    get_document: 'Récupération de document complet',
    get_page: 'Récupération de page spécifique',
    hybrid_search: 'Recherche combinée multi-approches',
    smart_search: 'Recherche intelligente adaptative',
  };
  return descriptions[toolName];
}

export async function checkApiConnection(): Promise<{ connected: boolean; message: string }> {
  try {
    const response = await fetch(`${API_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      return { connected: true, message: '✅ API connectée' };
    } else {
      return { connected: false, message: `⚠️ API répond avec status ${response.status}` };
    }
  } catch (error) {
    return { 
      connected: false, 
      message: `❌ API inaccessible: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
    };
  }
}