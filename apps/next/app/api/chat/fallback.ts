// app/api/chat/fallback.ts
import type { GeminiStructuredResponse, RagChunk } from './types';

// ⚙️ Configuration
const MIN_SIMILARITY = 0.25;
const MAX_CHUNKS = 3;
const MAX_EXCERPT_LENGTH = 500;

function cleanExcerpt(content: string, maxLength: number = MAX_EXCERPT_LENGTH): string {
  let cleaned = content
    .replace(/Page \d+/gi, '')
    .replace(/N° \d+/gi, '')
    .replace(/Journal Officiel.*?—.*?\d+ \w+ \d+ N° \d+ Page \d+/gi, '')
    .replace(/^\d+\s*$/gm, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (cleaned.length > maxLength) {
    const cutPoint = cleaned.lastIndexOf(' ', maxLength);
    cleaned = cleaned.substring(0, cutPoint > 0 ? cutPoint : maxLength) + '…';
  }

  return cleaned;
}

function extractKeyInfo(chunk: RagChunk): {
  ministry?: string;
  actionType?: string;
  date?: string;
  sourceType?: string;
} {
  const content = chunk.content;
  const info: { ministry?: string; actionType?: string; date?: string; sourceType?: string } = {};

  const ministryPatterns = [
    /Ministère\s+(?:du|de\s+l'|de\s+la)\s+([A-Z][a-zÀ-ÿ]+(?:[\s-][A-Z][a-zÀ-ÿ]+)?)/i,
    /Ministère\s+de\s+l'([A-Z][a-zÀ-ÿ]+(?:[\s-][A-Z][a-zÀ-ÿ]+)?)/i,
    /Ministère\s+des?\s+([A-Z][a-zÀ-ÿ]+(?:[\s-][A-Z][a-zÀ-ÿ]+)?)/i,
  ];
  
  for (const pattern of ministryPatterns) {
    const match = content.match(pattern);
    if (match) {
      info.ministry = match[1].trim();
      break;
    }
  }

  if (content.includes('Nomination')) {
    info.actionType = 'Nomination';
  } else if (content.includes('Arrêté')) {
    info.actionType = 'Arrêté';
  } else if (content.includes('Décret')) {
    info.actionType = 'Décret';
  } else if (content.includes('concours')) {
    info.actionType = 'Concours';
  } else if (content.includes('Cessation')) {
    info.actionType = 'Cessation de fonctions';
  }

  const datePatterns = [
    /(\d{1,2}\s+\w+\s+\d{4})/,
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
    /(\d{4}-\d{2}-\d{2})/,
  ];
  
  for (const pattern of datePatterns) {
    const match = content.match(pattern);
    if (match) {
      info.date = match[1];
      break;
    }
  }

  if (chunk.source_type) {
    const sourceLabels: Record<string, string> = {
      'jort': '📰 JORT',
      'jibaya': '🏛️ Jibaya',
      'luca_pacioli': '📚 Luca Pacioli',
    };
    info.sourceType = sourceLabels[chunk.source_type] || chunk.source_type;
  }

  return info;
}

function formatChunk(chunk: RagChunk, index: number): string {
  const info = extractKeyInfo(chunk);
  const cleanedContent = cleanExcerpt(chunk.content);
  
  const parts: string[] = [];
  
  let header = `**Extrait ${index + 1}**`;
  
  if (chunk.filename) {
    let linkUrl = '';
    let target = '';
    
    // ✅ Priorité : document_id (lien vers notre API)
    if (chunk.document_id) {
      linkUrl = `/api/pdfs/${chunk.document_id}`;
      target = ' target="_blank" rel="noopener noreferrer"';
    } 
    // ✅ Sinon : source_url (pour Luca Pacioli)
    else if (chunk.source_url) {
      linkUrl = chunk.source_url;
      target = ' target="_blank" rel="noopener noreferrer"';
    } 
    // ✅ Fallback : chemin local
    else {
      linkUrl = `/pdfs/${encodeURIComponent(chunk.filename)}`;
    }
    
    // Ajouter la page en paramètre
    if (chunk.page && !chunk.source_url) {
      const separator = linkUrl.includes('?') ? '&' : '?';
      linkUrl += `${separator}page=${chunk.page}`;
    }
    
    header += ` — <a href="${linkUrl}"${target}>📄 ${chunk.filename}</a>`;
  }
  
  if (chunk.page) {
    header += ` (p.${chunk.page})`;
  }
  
  if (chunk.similarity !== undefined && chunk.similarity !== null && chunk.similarity > 0) {
    const percent = Math.round(chunk.similarity * 100);
    header += ` — Pertinence: ${percent}%`;
  }
  
  parts.push(header);
  
  const tags: string[] = [];
  if (info.ministry) tags.push(`🏛️ ${info.ministry}`);
  if (info.actionType) tags.push(`📌 ${info.actionType}`);
  if (info.date) tags.push(`📅 ${info.date}`);
  if (info.sourceType) tags.push(info.sourceType);
  if (tags.length > 0) {
    parts.push(`> ${tags.join(' · ')}`);
  }
  
  parts.push('');
  parts.push(cleanedContent);
  
  return parts.join('\n');
}

function hasValidSimilarity(chunk: RagChunk): boolean {
  if (chunk.similarity === undefined || chunk.similarity === null) {
    return true;
  }
  return chunk.similarity >= MIN_SIMILARITY;
}

function getSimilarity(chunk: RagChunk): number {
  return chunk.similarity ?? 0;
}

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

  const filteredChunks = chunks.filter(chunk => hasValidSimilarity(chunk));
  
  if (filteredChunks.length === 0) {
    const allDocs = [...new Set(chunks.map(c => c.filename))];
    return {
      thinking_summary: {
        chunks_analyzed: chunks.length,
        chunks_retained: 0,
        documents_consulted: allDocs,
        documents_retained: [],
        steps: [
          `${chunks.length} passages analysés`,
          `Aucun passage avec une similarité ≥ ${Math.round(MIN_SIMILARITY * 100)}%`,
          'Service LLM indisponible',
        ],
      },
      answer: `⚠️ **Aucun document suffisamment pertinent n'a été trouvé** (seuil: ${Math.round(MIN_SIMILARITY * 100)}%).\n\n${allDocs.length > 0 ? `📚 Documents consultés: ${allDocs.join(', ')}` : ''}\n\nVeuillez reformuler votre question ou réessayer lorsque le service LLM sera disponible.`,
      used_sources: [],
      fallback: true,
    };
  }

  const sorted = [...filteredChunks].sort((a, b) => getSimilarity(b) - getSimilarity(a));
  const top = sorted.slice(0, MAX_CHUNKS);
  const allDocs = [...new Set(chunks.map(c => c.filename))];
  const retainedDocs = [...new Set(top.map(c => c.filename))];

  return {
    thinking_summary: {
      chunks_analyzed: chunks.length,
      chunks_retained: top.length,
      documents_consulted: allDocs,
      documents_retained: retainedDocs,
      steps: [
        `${chunks.length} passages analysés par similarité`,
        `${top.length} passages les plus pertinents sélectionnés (seuil: ${Math.round(MIN_SIMILARITY * 100)}%)`,
        'Service LLM indisponible — extraits affichés directement',
      ],
    },
    answer: [
      '> ⚠️ *Service LLM temporairement indisponible. Voici les passages les plus pertinents des documents officiels.*\n',
      `> 📚 ${allDocs.length} document(s) consulté(s)`,
      '',
      ...top.map((chunk, i) => formatChunk(chunk, i)),
      '',
      '---',
      '',
      '📌 *Ces extraits sont classés par pertinence. Pour une synthèse complète, veuillez réessayer lorsque le service LLM sera disponible.*'
    ].join('\n\n'),
    used_sources: top.map(c => ({
      chunk_id: c.chunk_id,
      filename: c.filename,
      page: c.page || 1,
      excerpt: cleanExcerpt(c.content, 150),
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
    const filteredChunks = chunks.filter(chunk => hasValidSimilarity(chunk));
    
    if (filteredChunks.length === 0) {
      const allDocs = [...new Set(chunks.map(c => c.filename))];
      return {
        thinking_summary: {
          chunks_analyzed: chunks.length,
          chunks_retained: 0,
          documents_consulted: allDocs,
          documents_retained: [],
          steps: [
            `${chunks.length} passages analysés`,
            `Aucun passage ≥ ${Math.round(MIN_SIMILARITY * 100)}%`,
            'Service LLM indisponible',
          ],
        },
        answer: `⚠️ **Aucun document suffisamment pertinent** pour la question : *"${question}"*\n\n${allDocs.length > 0 ? `📚 Documents consultés: ${allDocs.join(', ')}` : ''}\n\nVeuillez reformuler votre question ou réessayer lorsque le service LLM sera disponible.`,
        used_sources: [],
        fallback: true,
        model_used: 'fallback',
      };
    }
    
    const sorted = [...filteredChunks].sort((a, b) => getSimilarity(b) - getSimilarity(a));
    const topChunks = sorted.slice(0, MAX_CHUNKS);
    const allDocs = [...new Set(chunks.map(c => c.filename))];
    const retainedDocs = [...new Set(topChunks.map(c => c.filename))];
    
    const intro = [
      '📋 **Réponse basée sur les documents disponibles** (service LLM temporairement indisponible)',
      '',
      `> Question posée : *"${question}"*`,
      '',
      `> 📚 ${allDocs.length} document(s) consulté(s)`,
      '',
      'Voici les extraits les plus pertinents trouvés :',
    ].join('\n');

    return {
      thinking_summary: {
        chunks_analyzed: chunks.length,
        chunks_retained: topChunks.length,
        documents_consulted: allDocs,
        documents_retained: retainedDocs,
        steps: [
          `${chunks.length} passages analysés`,
          `${topChunks.length} passages sélectionnés (seuil: ${Math.round(MIN_SIMILARITY * 100)}%)`,
          '⚠️ Service LLM indisponible - réponse basée sur les extraits',
        ],
      },
      answer: [
        intro,
        '',
        ...topChunks.map((chunk, i) => formatChunk(chunk, i)),
        '',
        '---',
        '',
        '> ⚠️ *Cette réponse est basée sur les extraits de documents disponibles. Le service de synthèse est temporairement indisponible.*'
      ].join('\n\n'),
      used_sources: topChunks.map(c => ({
        chunk_id: c.chunk_id,
        filename: c.filename,
        page: c.page || 1,
        excerpt: cleanExcerpt(c.content, 200),
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

export function isFallbackResponse(response: GeminiStructuredResponse): boolean {
  return response.fallback === true;
}

export function formatFallbackResponse(response: GeminiStructuredResponse): string {
  if (!response.fallback) {
    return response.answer;
  }
  
  let formatted = response.answer;
  if (!formatted.includes('⚠️') && !formatted.includes('indisponible')) {
    formatted = `⚠️ **Service LLM indisponible**\n\n${formatted}`;
  }
  
  return formatted;
}