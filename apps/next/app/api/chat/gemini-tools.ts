// app/api/chat/gemini-tools.ts
import { GoogleGenAI, Type, type FunctionDeclaration } from '@google/genai';
import type { RagChunk, SearchResponse } from './types';
import {
  semantic_search,
  article_search,
  tag_search,
  document_search,
  get_document,
  get_page,
  hybrid_search,
  smart_search
} from './tools';

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
});

// ✅ Cascade alignée avec celle de llm.ts (à maintenir synchronisée
// manuellement entre les deux fichiers).
// gemini-2.0-flash a été coupé le 1er juin 2026 et gemini-1.5-flash
// renvoie systématiquement 404 : retirés pour éviter des tentatives
// inutiles qui ajoutent de la latence avant de tomber sur le fallback.
// gemini-2.5-pro retiré : limit=0 confirmé sur ce compte free tier.
//
// ✅ gemma-4-26b-a4b-it ajouté en dernier filet : contrairement à ce
// qu'on pensait initialement, Gemma 4 supporte le function calling
// NATIF via l'API Gemini — même structure d'appel exacte que les
// modèles Gemini (config.tools[0].functionDeclarations, lecture via
// response.functionCalls). Quota séparé des modèles Gemini, donc utile
// en cas de panne générale Gemini (503 simultané) ou quota épuisé.
// Référence : https://ai.google.dev/gemma/docs/capabilities/text/function-calling-gemma4
const TOOL_DECISION_MODELS = [
  'gemini-2.5-flash',
  'gemini-3.5-flash',
  'gemini-2.5-flash-lite',
  'gemma-4-26b-a4b-it',
];

// ✅ Migration @google/generative-ai → @google/genai : le type littéral
// "object"/"string" est remplacé par l'enum Type du SDK (Type.OBJECT,
// Type.STRING), seul format accepté par functionDeclarations ici.
export const GEMINI_TOOLS: FunctionDeclaration[] = [
  {
    name: "semantic_search",
    description: "Effectue une recherche sémantique dans tous les documents juridiques tunisiens.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: "La question ou la requête de recherche"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "smart_search",
    description: "Recherche intelligente qui s'adapte aux endpoints disponibles.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: "La question ou la requête de recherche"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "hybrid_search",
    description: "Recherche combinée pour les questions complexes.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: "La question complexe"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "article_search",
    description: "Recherche spécifique dans les articles de loi tunisiens.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: "L'article ou le sujet recherché"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "tag_search",
    description: "Recherche par mots-clés ou tags.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        tags: {
          type: Type.STRING,
          description: "Liste de tags séparés par des virgules"
        }
      },
      required: ["tags"]
    }
  },
  // ✅ Ajouté — importé depuis ./tools mais jamais exposé à Gemini auparavant.
  // Recherche par requête texte libre (nom de document), donc fait bien
  // partie des QUERY_TOOLS de tools.ts, contrairement à get_document/get_page.
  {
    name: "document_search",
    description: "Recherche par nom ou type de document juridique.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: "Le nom ou type de document recherché"
        }
      },
      required: ["query"]
    }
  },
  // ✅ Ajouté — récupération directe par ID. Contrairement aux outils
  // ci-dessus, prend un identifiant précis, pas une requête en langage
  // naturel. Utile quand Gemini a déjà identifié un document_id ou
  // chunk_id pertinent dans un tour précédent ou dans le contexte fourni.
  {
    name: "get_document",
    description: "Récupère un document complet à partir de son identifiant exact (document_id).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        docId: {
          type: Type.STRING,
          description: "L'identifiant exact du document"
        }
      },
      required: ["docId"]
    }
  },
  {
    name: "get_page",
    description: "Récupère une page spécifique à partir de son identifiant exact (page_id).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        pageId: {
          type: Type.STRING,
          description: "L'identifiant exact de la page"
        }
      },
      required: ["pageId"]
    }
  }
];

const TOOL_EXECUTORS: Record<string, (args: any) => Promise<SearchResponse>> = {
  semantic_search: (args) => semantic_search(args.query),
  smart_search: (args) => smart_search(args.query),
  hybrid_search: (args) => hybrid_search(args.query),
  article_search: (args) => article_search(args.query),
  tag_search: (args) => tag_search(args.tags),
  // ✅ Ajoutés en miroir des déclarations ci-dessus.
  document_search: (args) => document_search(args.query),
  get_document: (args) => get_document(args.docId),
  get_page: (args) => get_page(args.pageId),
};

export async function executeGeminiTool(
  toolName: string,
  args: any
): Promise<SearchResponse> {
  const executor = TOOL_EXECUTORS[toolName];
  if (!executor) {
    throw new Error(`Outil "${toolName}" non trouvé`);
  }
  return executor(args);
}

function isQuotaExhausted(err: any): boolean {
  const msg = String(err?.message || err || '');
  return msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota');
}

function isRetryableError(err: any): boolean {
  const msg = String(err?.message || err || '');
  return (
    msg.includes('503') ||
    msg.includes('overloaded') ||
    msg.includes('high demand') ||
    msg.includes('quota') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('Service Unavailable') ||
    msg.includes('429') ||
    msg.includes('Too Many Requests')
  );
}

// ✅ Ajouté : retry avec backoff sur un même modèle avant de passer au
// suivant, en miroir de callModelWithRetry dans llm.ts. Avant : une seule
// tentative par modèle, puis passage immédiat au modèle suivant — un 429
// transitoire de quelques centaines de ms suffisait à sauter tout un modèle
// de la cascade.
// ✅ Quota épuisé (RESOURCE_EXHAUSTED, limite journalière) : sortie immédiate
// sans consommer les `retries` — le retryDelay annoncé est de l'ordre de
// 50-60s, donc un backoff de 1-2s ne peut jamais réussir. Voir llm.ts pour
// le contexte complet (c'est ce gaspillage cumulé sur plusieurs appels qui
// provoquait le timeout de 60s observé en pratique).
async function decideOnceWithRetry(
  modelName: string,
  prompt: string,
  retries: number = 2
): Promise<{ ok: true; functionCalls: { name: string; args: any }[] | undefined } | { ok: false; retryable: boolean }> {
  for (let i = 0; i <= retries; i++) {
    try {
      const result = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          tools: [{ functionDeclarations: GEMINI_TOOLS }],
        },
      });

      const functionCalls = result.functionCalls?.map(call => ({
        name: call.name ?? '',
        args: call.args ?? {},
      }));

      return { ok: true, functionCalls };
    } catch (error) {
      const retryable = isRetryableError(error);
      if (!retryable) {
        console.error(`[Gemini] ❌ Erreur non récupérable avec ${modelName}:`, error);
        return { ok: false, retryable: false };
      }
      if (isQuotaExhausted(error)) {
        console.warn(`[Gemini] 🚫 ${modelName} quota journalier épuisé, abandon immédiat:`, (error as Error).message);
        return { ok: false, retryable: true };
      }
      console.warn(`[Gemini] ⚠️ ${modelName} tentative ${i + 1}/${retries + 1} échouée (retryable):`, (error as Error).message);
      if (i < retries) {
        const delay = 1000 * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  return { ok: false, retryable: true };
}

export async function decideToolsWithGemini(
  question: string,
  context?: string
): Promise<{ toolCalls: Array<{ name: string; args: any }>; reasoning: string }> {

  const prompt = `
Tu es un agent juridique tunisien expert. Analyse la question et décide quels outils utiliser.

QUESTION: "${question}"
${context ? `CONTEXTE: ${context}` : ''}

Utilise UNIQUEMENT les outils disponibles.`;

  // ✅ On essaie chaque modèle de la cascade (avec retry/backoff sur chacun)
  // avant de tomber sur le fallback générique (smart_search).
  for (const modelName of TOOL_DECISION_MODELS) {
    console.log(`[Gemini] Tentative de décision d'outils avec ${modelName}`);
    const result = await decideOnceWithRetry(modelName, prompt);

    if (!result.ok) {
      if (result.retryable) {
        console.warn(`[Gemini] ${modelName} indisponible après retries, modèle suivant`);
        continue;
      }
      break;
    }

    if (result.functionCalls && result.functionCalls.length > 0) {
      console.log(`[Gemini] ✅ Décision obtenue avec ${modelName}`);
      return {
        toolCalls: result.functionCalls,
        reasoning: `Gemini (${modelName}) a décidé d'utiliser les outils suivants`,
      };
    }

    // Le modèle a répondu mais sans appel d'outil : pas la peine
    // d'essayer un autre modèle, on passe directement au fallback.
    console.warn(`[Gemini] ${modelName} n'a renvoyé aucun appel d'outil`);
    break;
  }

  return {
    toolCalls: [{ name: 'smart_search', args: { query: question } }],
    reasoning: 'Fallback: utilisation de smart_search',
  };
}

export async function executeGeminiDecisions(
  toolCalls: Array<{ name: string; args: any }>
): Promise<SearchResponse> {
  const allResults: RagChunk[] = [];

  for (const call of toolCalls) {
    try {
      console.log(`[Gemini] Exécution de ${call.name}`);
      const result = await executeGeminiTool(call.name, call.args);
      allResults.push(...result.chunks);
    } catch (error) {
      console.error(`[Gemini] Erreur pour ${call.name}:`, error);
    }
  }

  const uniqueChunks = allResults.filter(
    (chunk, index, self) =>
      index === self.findIndex(c => c.chunk_id === chunk.chunk_id)
  );

  uniqueChunks.sort((a, b) => b.similarity - a.similarity);

  return { chunks: uniqueChunks.slice(0, 20) };
}