// app/api/chat/gemini-tools.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
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

const genAI = new GoogleGenerativeAI(
  process.env.GOOGLE_GENERATIVE_AI_API_KEY!
);

// ✅ Modèle aligné avec le premier modèle de la cascade de llm.ts
// (gemini-2.5-flash). Avant : "gemini-2.0-flash" en dur, sans fallback —
// donc si ce modèle précis était en quota dépassé, decideToolsWithGemini
// utilisait son fallback interne (smart_search) à chaque fois, même si
// gemini-2.5-flash ou un autre modèle de la cascade était disponible.
const TOOL_DECISION_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

export const GEMINI_TOOLS = [
  {
    name: "semantic_search",
    description: "Effectue une recherche sémantique dans tous les documents juridiques tunisiens.",
    parameters: {
      type: "object" as const,
      properties: {
        query: {
          type: "string" as const,
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
      type: "object" as const,
      properties: {
        query: {
          type: "string" as const,
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
      type: "object" as const,
      properties: {
        query: {
          type: "string" as const,
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
      type: "object" as const,
      properties: {
        query: {
          type: "string" as const,
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
      type: "object" as const,
      properties: {
        tags: {
          type: "string" as const,
          description: "Liste de tags séparés par des virgules"
        }
      },
      required: ["tags"]
    }
  }
];

const TOOL_EXECUTORS: Record<string, (args: any) => Promise<SearchResponse>> = {
  semantic_search: (args) => semantic_search(args.query),
  smart_search: (args) => smart_search(args.query),
  hybrid_search: (args) => hybrid_search(args.query),
  article_search: (args) => article_search(args.query),
  tag_search: (args) => tag_search(args.tags),
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

// ✅ Accepte maintenant un nom de modèle, pour pouvoir essayer
// la cascade complète dans decideToolsWithGemini.
function getGeminiModelWithTools(modelName: string) {
  return genAI.getGenerativeModel({
    model: modelName,
    tools: [
      {
        functionDeclarations: GEMINI_TOOLS,
      },
    ],
  });
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

export async function decideToolsWithGemini(
  question: string,
  context?: string
): Promise<{ toolCalls: Array<{ name: string; args: any }>; reasoning: string }> {

  const prompt = `
Tu es un agent juridique tunisien expert. Analyse la question et décide quels outils utiliser.

QUESTION: "${question}"
${context ? `CONTEXTE: ${context}` : ''}

Utilise UNIQUEMENT les outils disponibles.`;

  // ✅ On essaie chaque modèle de la cascade avant de tomber sur le
  // fallback générique (smart_search). Avant : un seul modèle fixe,
  // aucun essai d'un modèle de remplacement en cas de 429/503.
  for (const modelName of TOOL_DECISION_MODELS) {
    try {
      console.log(`[Gemini] Tentative de décision d'outils avec ${modelName}`);
      const model = getGeminiModelWithTools(modelName);
      const result = await model.generateContent(prompt);
      const response = result.response;
      const functionCalls = response.functionCalls();

      if (functionCalls && functionCalls.length > 0) {
        console.log(`[Gemini] ✅ Décision obtenue avec ${modelName}`);
        return {
          toolCalls: functionCalls.map(call => ({
            name: call.name,
            args: call.args,
          })),
          reasoning: `Gemini (${modelName}) a décidé d'utiliser les outils suivants`,
        };
      }

      // Le modèle a répondu mais sans appel d'outil : pas la peine
      // d'essayer un autre modèle, on passe directement au fallback.
      console.warn(`[Gemini] ${modelName} n'a renvoyé aucun appel d'outil`);
      break;
    } catch (error) {
      if (isRetryableError(error)) {
        console.warn(`[Gemini] ⚠️ ${modelName} indisponible, tentative suivante:`, (error as Error).message);
        continue;
      }
      console.error(`[Gemini] ❌ Erreur non récupérable avec ${modelName}:`, error);
      break;
    }
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