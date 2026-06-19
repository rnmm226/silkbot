// app/api/chat/errors.ts
import type { GeminiStructuredResponse } from './types';

export class AgentError extends Error {
  constructor(
    message: string,
    public readonly step: string,
    public readonly recoverable: boolean = false
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

export class SearchError extends AgentError {
  constructor(message: string, public readonly tool: string) {
    super(message, 'search', true);
    this.name = 'SearchError';
  }
}

export class LLMError extends AgentError {
  constructor(message: string) {
    super(message, 'llm', true);
    this.name = 'LLMError';
  }
}

export function isRecoverable(error: unknown): boolean {
  if (error instanceof AgentError) {
    return error.recoverable;
  }
  return false;
}

export function handleAgentError(error: unknown): GeminiStructuredResponse {
  console.error('[Agent] Error:', error);
  
  if (error instanceof SearchError) {
    return {
      thinking_summary: {
        chunks_analyzed: 0,
        chunks_retained: 0,
        documents_consulted: [],
        documents_retained: [],
        steps: [
          `Erreur de recherche avec l'outil "${error.tool}"`,
          'Vérification des autres sources...',
          'Réponse partielle uniquement',
        ],
      },
      answer: `⚠️ *Erreur lors de la recherche documentaire :* ${error.message}\n\nJe vais essayer de répondre avec mes connaissances générales, mais la réponse n'est pas vérifiée par les documents officiels.`,
      used_sources: [],
      fallback: true,
    };
  }

  if (error instanceof LLMError) {
    return {
      thinking_summary: {
        chunks_analyzed: 0,
        chunks_retained: 0,
        documents_consulted: [],
        documents_retained: [],
        steps: [
          'Erreur de communication avec le service LLM',
          'Utilisation du mode dégradé',
        ],
      },
      answer: `⚠️ *Le service de génération est temporairement indisponible.*\n\nVeuillez réessayer dans quelques instants. Si le problème persiste, contactez l'administrateur.`,
      used_sources: [],
      fallback: true,
    };
  }

  return {
    thinking_summary: {
      chunks_analyzed: 0,
      chunks_retained: 0,
      documents_consulted: [],
      documents_retained: [],
      steps: [
        'Erreur inattendue',
        'Le système a rencontré un problème',
      ],
    },
    answer: `⚠️ *Une erreur inattendue s'est produite.*\n\n${error instanceof Error ? error.message : 'Erreur inconnue'}\n\nVeuillez réessayer.`,
    used_sources: [],
    fallback: true,
  };
}