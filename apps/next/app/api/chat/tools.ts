// app/api/chat/tools.ts
import type { SearchResponse, RagChunk } from './types';

const API_URL =
  process.env.PYTHON_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5001";

const DEFAULT_TIMEOUT = 10000;
const MAX_RETRIES = 2;
const ENDPOINT_CACHE_TTL_MS = 60_000;

export const QUERY_TOOLS = [
  'semantic_search',
  'article_search',
  'tag_search',
  'document_search',
  'hybrid_search',
  'smart_search',
] as const;

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

interface EndpointCacheEntry {
  available: boolean;
  checkedAt: number;
}

let endpointCache: Record<string, EndpointCacheEntry> = {};

async function checkEndpoint(endpoint: string): Promise<boolean> {
  const cached = endpointCache[endpoint];
  const now = Date.now();

  if (cached && now - cached.checkedAt < ENDPOINT_CACHE_TTL_MS) {
    return cached.available;
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(2000),
    });
    const available = response.ok || response.status === 405;
    endpointCache[endpoint] = { available, checkedAt: now };
    console.log(`[checkEndpoint] ${endpoint}: ${available ? '✅' : '❌'}`);
    return available;
  } catch {
    endpointCache[endpoint] = { available: false, checkedAt: now };
    return false;
  }
}

export async function semantic_search(query: string, topK: number = 5): Promise<SearchResponse> {
  try {
    console.log(`[semantic_search] 🔍 Recherche: "${query}"`);
    console.log(`[semantic_search] 📡 URL: ${API_URL}/search`);

    const response = await fetchWithTimeout(`${API_URL}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // ✅ Corrigé : l'API Python attend "question", pas "query" — l'ancien
      // body provoquait un 422 systématique ("Field required": question),
      // donc semantic_search renvoyait toujours 0 chunks, peu importe le LLM.
      body: JSON.stringify({
        question: query,
        top_k: topK
      }),
      cache: 'no-store',
    });

    console.log(`[semantic_search] 📡 Status: ${response.status}`);

    if (!response.ok) {
      const text = await response.text();
      console.error(`[semantic_search] ❌ Erreur ${response.status}: ${text}`);
      return { chunks: [] };
    }

    const data = await response.json();

    // ✅ Corrigé : l'API Python renvoie les résultats sous la clé "chunks",
    // pas "results" — data.results était toujours undefined, donc cette
    // fonction retournait systématiquement { chunks: [] } même quand l'API
    // trouvait de vrais résultats (confirmé via test direct de l'API :
    // réponse { chunks: [...], context: "..." }).
    console.log(`[semantic_search] ✅ ${data.chunks?.length || 0} résultats`);

    if (!data.chunks || data.chunks.length === 0) {
      console.warn('[semantic_search] ⚠️ Aucun résultat');
      return { chunks: [] };
    }

    // ✅ Corrigé : r.page_number → r.page (le champ réel renvoyé par l'API).
    // Les autres noms de champs (chunk_id, content, similarity, filename,
    // document_id) étaient déjà corrects.
    const chunks: RagChunk[] = data.chunks.map((r: any) => ({
      chunk_id: r.chunk_id || `chunk-${Math.random()}`,
      content: r.content || '',
      page: r.page ?? 1,
      similarity: r.similarity || 0,
      filename: r.filename || 'unknown.pdf',
      source_type: r.source || 'jort',
      source_url: r.source_url || null,
      document_id: r.document_id || null,
    }));

    return { chunks };

  } catch (error) {
    console.error('[semantic_search] ❌ Erreur:', error);
    return { chunks: [] };
  }
}

export async function smart_search(query: string): Promise<SearchResponse> {
  console.log(`[smart_search] 🔍 Recherche intelligente: "${query}"`);

  try {
    const result = await semantic_search(query, 20);
    if (result.chunks && result.chunks.length > 0) {
      console.log(`[smart_search] ✅ ${result.chunks.length} résultats via semantic_search`);
      return result;
    }
  } catch (error) {
    console.warn('[smart_search] ⚠️ semantic_search a échoué:', error);
  }

  const endpoints = ['/search/articles', '/search/tags'];
  const results: RagChunk[] = [];

  for (const endpoint of endpoints) {
    const isAvailable = await checkEndpoint(endpoint);
    if (!isAvailable) {
      console.log(`[smart_search] ⏭️ ${endpoint} ignoré (indisponible récemment)`);
      continue;
    }

    try {
      const response = await fetchWithTimeout(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query }),
        cache: 'no-store',
      });

      if (response.ok) {
        const data = await response.json();
        const chunks = data.chunks || [];
        results.push(...chunks);
        console.log(`[smart_search] ✅ ${endpoint}: ${chunks.length} chunks`);
      }
    } catch (error) {
      console.warn(`[smart_search] ⚠️ ${endpoint} a échoué`);
    }
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
  console.log(`[article_search] 🔍 Recherche article: "${query}"`);
  return smart_search(`article loi ${query}`);
}

export async function tag_search(query: string): Promise<SearchResponse> {
  console.log(`[tag_search] 🔍 Recherche tags: "${query}"`);
  const tags = query.split(',').map(t => t.trim()).join(' ');
  return smart_search(tags);
}

export async function document_search(query: string): Promise<SearchResponse> {
  console.log(`[document_search] 🔍 Recherche document: "${query}"`);
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
  console.log(`[hybrid_search] 🔍 Recherche hybride: "${query}"`);
  return smart_search(query);
}

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
const PLANNER_EXCLUDED_TOOLS = ['get_document', 'get_page'];

export const QUERY_TOOL_DESCRIPTIONS = TOOL_DESCRIPTIONS
  .split('\n')
  .filter(line => !PLANNER_EXCLUDED_TOOLS.some(tool => line.includes(`- ${tool}:`)))
  .join('\n');
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