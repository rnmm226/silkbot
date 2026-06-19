// app/api/chat/parser.ts
import type { GeminiStructuredResponse, RagChunk } from './types';

export function parseStructured(
  rawText: string,
  chunks: RagChunk[]
): GeminiStructuredResponse {
  try {
    const clean = rawText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON');
    const parsed = JSON.parse(match[0]) as GeminiStructuredResponse;
    if (!parsed.answer || !parsed.thinking_summary) throw new Error('Invalid');
    return parsed;
  } catch (error) {
    console.warn('[Parser] ⚠️ Erreur de parsing, fallback à la réponse brute');
    return {
      thinking_summary: {
        chunks_analyzed: chunks.length,
        chunks_retained: 0,
        documents_consulted: [...new Set(chunks.map(c => c.filename))],
        documents_retained: [],
        steps: ['Analyse effectuée', 'Format inattendu — réponse brute'],
      },
      answer: rawText,
      used_sources: [],
      fallback: true,
    };
  }
}