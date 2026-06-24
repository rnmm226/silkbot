// app/api/chat/prompt.ts
import type { RagChunk } from './types';
import { QUERY_TOOL_DESCRIPTIONS } from './tools';

export const SYSTEM_PROMPT = `Tu es Counsel, un assistant juridique tunisien expert.

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
Pour le champ "page" : reprends EXACTEMENT le numéro affiché dans le passage source (ligne "page: ..." ci-dessous). Ne mets "null" que si le passage n'a aucun numéro de page (cas d'un passage avec un champ "url").
Si le passage source possède un champ url, inclure ce lien dans used_sources (champ "url"). Sinon, laisser "url": null.

RÈGLES ABSOLUES :
- Ne jamais inventer un article, un numéro de loi ou une référence précise absente des documents.
- Ne jamais inclure un chunk non pertinent dans used_sources.
- Ne jamais mettre "page": null par défaut si un numéro de page réel est disponible dans le passage source.
- Pour une question générale sans document pertinent, tu PEUX répondre avec tes connaissances générales, mais signale-le dans thinking_summary (ex: "Réponse basée sur connaissances générales, non vérifiée par la base documentaire").
- Répondre en français juridique professionnel.
- Structurer avec des titres markdown (##) si la réponse dépasse 3 points.

FORMAT DE RÉPONSE : JSON strict uniquement — aucun texte avant ou après les accolades.`;

export function buildUserPrompt(
  question: string,
  draft: string,
  chunks: RagChunk[]
): string {
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
${chunk.source_url ? `url: ${chunk.source_url}` : `page: ${chunk.page ?? 'N/A'}`}
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

Réponds UNIQUEMENT en JSON valide contenant exactement cette structure (les valeurs entre <> sont des exemples de format, PAS des valeurs à copier littéralement — remplace-les par les vraies données) :

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
      "page": <numéro de page repris du passage source, ou null UNIQUEMENT si absent>,
      "url": <lien repris du passage source, ou null si absent>,
      "excerpt": "..."
    }
  ]
}`;
}

export function buildPlannerPrompt(question: string, previousResults?: string): string {
  return `Tu es un planificateur d'un Agent RAG spécialisé en droit tunisien.

OUTILS DISPONIBLES :
${QUERY_TOOL_DESCRIPTIONS}

QUESTION : "${question}"

${previousResults ? `RÉSULTATS PRÉCÉDENTS : ${previousResults}` : ''}

Décide quels outils utiliser pour trouver les informations les plus pertinentes.
Considère :
- La nature de la question (générale ou spécifique)
- Les résultats précédents si disponibles
- La complémentarité des outils

Réponds UNIQUEMENT en JSON :
{
  "reasoning": "ton raisonnement",
  "tools": ["semantic_search", "article_search"],
  "search_query": "requête optimisée"
}`;
}