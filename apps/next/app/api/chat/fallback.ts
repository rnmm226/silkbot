// app/api/chat/fallback.ts
import type { GeminiStructuredResponse, RagChunk } from './types';

// ⚙️ Configuration
const MIN_SIMILARITY = 0.25; // Seuil minimum de similarité (0-1)
const MAX_CHUNKS = 3;
const MAX_EXCERPT_LENGTH = 500;

/**
 * Nettoie un extrait pour ne garder que le contenu pertinent
 */
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

/**
 * Extrait les informations clés d'un chunk
 */
function extractKeyInfo(chunk: RagChunk): {
  ministry?: string;
  actionType?: string;
  date?: string;
  sourceType?: string;
} {
  const content = chunk.content;
  const info: { ministry?: string; actionType?: string; date?: string; sourceType?: string } = {};

  // Détecter le ministère
  const ministryPatterns = [
    /Ministère\s+(?:du|de\s+l'|de\s+la)\s+([A-Z][a-zÀ-ÿ]+)/i,
    /Ministère\s+de\s+l'([A-Z][a-zÀ-ÿ]+)/i,
  ];
  
  for (const pattern of ministryPatterns) {
    const match = content.match(pattern);
    if (match) {
      info.ministry = match[1];
      break;
    }
  }

  // Détecter le type d'action
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

  // Détecter la date
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

  // Source type
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

/**
 * Formate un chunk pour l'affichage
 */
function formatChunk(chunk: RagChunk, index: number): string {
  const info = extractKeyInfo(chunk);
  const cleanedContent = cleanExcerpt(chunk.content);
  
  const parts: string[] = [];
  
  // 1. En-tête avec métadonnées
  let header = `**Extrait ${index + 1}**`;
  if (chunk.filename) {
    header += ` — ${chunk.filename}`;
  }
  if (chunk.page) {
    header += ` (p.${chunk.page})`;
  }
  // ✅ Utiliser similarity au lieu de score
  if (chunk.similarity !== undefined && chunk.similarity !== null && chunk.similarity > 0) {
    const percent = Math.round(chunk.similarity * 100);
    header += ` — Pertinence: ${percent}%`;
  }
  parts.push(header);
  
  // 2. Tags d'information
  const tags: string[] = [];
  if (info.ministry) tags.push(`🏛️ ${info.ministry}`);
  if (info.actionType) tags.push(`📌 ${info.actionType}`);
  if (info.date) tags.push(`📅 ${info.date}`);
  if (info.sourceType) tags.push(info.sourceType);
  if (chunk.source_url) tags.push(`🔗 [Lien](${chunk.source_url})`);
  if (tags.length > 0) {
    parts.push(`> ${tags.join(' · ')}`);
  }
  
  // 3. Contenu nettoyé
  parts.push('');
  parts.push(cleanedContent);
  
  return parts.join('\n');
}

/**
 * Vérifie si un chunk a une similarité suffisante
 */
function hasValidSimilarity(chunk: RagChunk): boolean {
  // Si la similarité n'est pas définie, on considère comme valide
  if (chunk.similarity === undefined || chunk.similarity === null) {
    return true;
  }
  return chunk.similarity >= MIN_SIMILARITY;
}

/**
 * Récupère la similarité d'un chunk, ou 0 si non définie
 */
function getSimilarity(chunk: RagChunk): number {
  return chunk.similarity ?? 0;
}

/**
 * Construit une réponse à partir des chunks (mode fallback)
 */
export function buildRagOnlyResponse(
  chunks: RagChunk[]
): GeminiStructuredResponse {
  // Cas 1: Aucun chunk trouvé
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

  // ✅ Filtrer par similarité minimum
  const filteredChunks = chunks.filter(chunk => hasValidSimilarity(chunk));
  
  // Cas 2: Aucun chunk avec une similarité suffisante
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

  // ✅ Trier par similarité (du plus élevé au plus bas)
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

/**
 * Génère une réponse de fallback avec la question posée
 */
export function generateFallbackAnswer(
  question: string,
  chunks: RagChunk[],
  draft: string
): GeminiStructuredResponse {
  // Cas 1: Des chunks sont disponibles
  if (chunks.length > 0) {
    // ✅ Filtrer par similarité minimum
    const filteredChunks = chunks.filter(chunk => hasValidSimilarity(chunk));
    
    // Cas 1a: Aucun chunk avec une similarité suffisante
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
    
    // ✅ Trier par similarité
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
  
  // Cas 2: Pas de chunks mais un draft existe
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
  
  // Cas 3: Ni chunks ni draft
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

/**
 * Vérifie si la réponse est en mode fallback
 */
export function isFallbackResponse(response: GeminiStructuredResponse): boolean {
  return response.fallback === true;
}

/**
 * Formate une réponse de fallback pour l'affichage
 */
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