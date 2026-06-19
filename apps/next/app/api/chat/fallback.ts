// app/api/chat/fallback.ts
import type { GeminiStructuredResponse, RagChunk } from './types';

export function buildRagOnlyResponse(
  chunks: RagChunk[]
): GeminiStructuredResponse {
  if (chunks.length === 0) {
    return {
      thinking_summary: {
        chunks_analyzed: 0,
        chunks_retained: 0,
        documents_consulted: [],
        documents_retained: [],
        steps: ['Aucun document trouvé', 'Service LLM indisponible'],
      },
      answer: "⚠️ Le service de génération est temporairement indisponible et aucun document pertinent n'a été trouvé.",
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

export function generateFallbackAnswer(
  question: string,
  chunks: RagChunk[],
  draft: string
): GeminiStructuredResponse {
  if (chunks.length > 0) {
    const topChunks = chunks.slice(0, 3);
    return {
      thinking_summary: {
        chunks_analyzed: chunks.length,
        chunks_retained: topChunks.length,
        documents_consulted: [...new Set(chunks.map(c => c.filename))],
        documents_retained: [...new Set(topChunks.map(c => c.filename))],
        steps: [
          `${chunks.length} passages analysés`,
          `${topChunks.length} passages sélectionnés`,
          '⚠️ Service LLM indisponible - réponse basée sur les extraits',
        ],
      },
      answer: [
        `📋 **Réponse basée sur les documents disponibles** (service LLM temporairement indisponible)\n\n`,
        ...topChunks.map((chunk, i) => 
          `**Extrait ${i + 1}** - ${chunk.filename}${chunk.page ? ` (p.${chunk.page})` : ''}\n\n${chunk.content}`
        ),
        `\n\n> ⚠️ *Cette réponse est basée sur les extraits de documents disponibles. Le service de synthèse est temporairement indisponible.*`
      ].join('\n\n---\n\n'),
      used_sources: topChunks.map(c => ({
        chunk_id: c.chunk_id,
        filename: c.filename,
        page: c.page,
        excerpt: c.content.slice(0, 200) + '...',
      })),
      fallback: true,
      model_used: 'fallback',
    };
  }
  
  if (draft) {
    return {
      thinking_summary: {
        chunks_analyzed: 0,
        chunks_retained: 0,
        documents_consulted: [],
        documents_retained: [],
        steps: [
          'Aucun document trouvé',
          'Service LLM indisponible',
          'Réponse basée sur les connaissances générales',
        ],
      },
      answer: `${draft}\n\n> ⚠️ *Cette réponse est basée sur les connaissances générales du modèle car le service LLM est temporairement indisponible et aucun document n'a été trouvé.*`,
      used_sources: [],
      fallback: true,
      model_used: 'fallback',
    };
  }
  
  return {
    thinking_summary: {
      chunks_analyzed: 0,
      chunks_retained: 0,
      documents_consulted: [],
      documents_retained: [],
      steps: [
        'Service LLM indisponible',
        'Aucun document trouvé',
        'Impossible de générer une réponse',
      ],
    },
    answer: `⚠️ *Le service est temporairement indisponible. Veuillez réessayer dans quelques instants.*\n\nSi le problème persiste, contactez l'administrateur.`,
    used_sources: [],
    fallback: true,
    model_used: 'fallback',
  };
}