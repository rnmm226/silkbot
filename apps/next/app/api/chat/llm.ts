// app/api/chat/llm.ts
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
});

// ⚠️ Important (juin 2026) : Gemini 1.5 est totalement arrêté (404 systématique)
// et Gemini 2.0 Flash/Flash-Lite a été coupé le 1er juin 2026.
// Liste à vérifier/adapter selon tes quotas : https://ai.google.dev/gemini-api/docs/models
//
// ✅ Migration @google/generative-ai → @google/genai (juin 2026) :
// l'ancien SDK est déprécié/archivé par Google (dépôt "deprecated-generative-ai-js")
// et ne gère pas nativement les "thought signatures" requises par gemini-3.5-flash
// pour le function calling multi-tours (risque de 400 sinon). @google/genai est le
// seul SDK officiellement supporté pour les modèles Gemini 3.x.
// ✅ gemini-2.5-pro retiré : confirmé en pratique avec "limit: 0" sur ce
// compte free tier (pas un quota épuisé qui se régénère — un accès qui
// n'existe simplement pas). Le garder ne faisait que perdre du temps à
// chaque échec en cascade des modèles précédents.
//
// ✅ gemma-4-26b-a4b-it ajouté en dernier filet de secours : c'est un
// modèle ouvert (Gemma 4, sorti avril 2026) servi via la même API
// generateContent et le même SDK @google/genai, mais avec un QUOTA
// SÉPARÉ de celui des modèles Gemini. Utile en cas de panne générale
// Gemini (503 "high demand" sur toute la cascade, comme observé en
// pratique) ou de quota Gemini épuisé pour la journée.
// Note : Gemma 4 supporte aussi le function calling natif (vérifié),
// donc il est également utilisable dans planner.ts/gemini-tools.ts —
// voir ces fichiers pour son intégration côté décision d'outils.
const MODELS = [
  'gemini-2.5-flash',
  'gemini-3.5-flash',
  'gemini-2.5-flash-lite',
  'gemma-4-26b-a4b-it',
];

// 🔧 Utilitaire de debug — à appeler MANUELLEMENT (script ponctuel, route admin
// protégée), jamais au chargement du module. Un appel réseau à chaque cold
// start ralentit toutes les requêtes pour rien.
export async function listAvailableModels() {
  try {
    const pager = await ai.models.list();
    const models: { name: string; methods: string[] }[] = [];
    for await (const m of pager) {
      models.push({
        name: m.name ?? 'unknown',
        methods: (m as any).supportedActions ?? [],
      });
    }
    return models;
  } catch (err) {
    console.error('[LLM] ❌ Impossible de lister les modèles:', err);
    return [];
  }
}

// ✅ Distinction importante : un 429/RESOURCE_EXHAUSTED sur le quota
// *journalier* (free tier) ne se résout jamais en retentant quelques
// secondes plus tard — le retryDelay annoncé par l'API est de l'ordre de
// 50-60s, pas de quelques secondes. Retenter avec un backoff de 1s/2s/4s
// dans ce cas ne fait que perdre ~7s par modèle pour rien, et cumulé sur
// les multiples appels LLM d'une seule requête (draft, planner, décision,
// reformulation, réponse finale), ça suffit à dépasser le timeout de 60s
// de route.ts. On distingue donc "quota épuisé" (passer au modèle suivant
// immédiatement, sans retry) de "surcharge temporaire" (503/overloaded,
// où un retry a une vraie chance de réussir).
function isQuotaExhausted(err: unknown): boolean {
  const msg = String(err instanceof Error ? err.message : err ?? '');
  return msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota');
}

function isRetryableError(err: unknown): boolean {
  const msg = String(err instanceof Error ? err.message : err ?? '');
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

type CallResult =
  | { ok: true; text: string }
  | { ok: false; retryable: boolean; quotaExhausted: boolean; message: string };

// ✅ Le nouveau SDK gère l'historique via ai.chats.create({history}) au lieu
// de model.startChat({history}) — l'historique attend le même format
// { role, parts: [{text}] }, donc aucun changement côté agent.ts/types.ts.
async function callModel(
  modelName: string,
  prompt: string,
  systemInstruction: string,
  history: { role: string; parts: { text: string }[] }[] = []
): Promise<CallResult> {
  try {
    console.log(`[LLM] Tentative avec ${modelName}`);
    const chat = ai.chats.create({
      model: modelName,
      config: { systemInstruction },
      history,
    });
    const result = await chat.sendMessage({ message: prompt });
    const text = result.text ?? '';
    console.log(`[LLM] ✅ Succès avec ${modelName}`);
    return { ok: true, text };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const retryable = isRetryableError(err);
    const quotaExhausted = isQuotaExhausted(err);
    if (quotaExhausted) {
      console.warn(`[LLM] 🚫 ${modelName} quota journalier épuisé, passage au modèle suivant: ${message}`);
    } else if (retryable) {
      console.warn(`[LLM] ⚠️ ${modelName} indisponible (retryable): ${message}`);
    } else {
      console.error(`[LLM] ❌ Erreur non-retryable avec ${modelName}: ${message}`);
    }
    return { ok: false, retryable, quotaExhausted, message };
  }
}

function isOverloadedError(err: unknown): boolean {
  const msg = String(err instanceof Error ? err.message : err ?? '');
  return msg.includes('503') || msg.includes('overloaded') || msg.includes('high demand') || msg.includes('UNAVAILABLE');
}

async function callModelWithRetry(
  modelName: string,
  prompt: string,
  systemInstruction: string,
  history: { role: string; parts: { text: string }[] }[] = [],
  // ✅ Réduit de 3 à 2 : observé en pratique que lors d'une panne générale
  // Google (503 "high demand" simultané sur plusieurs modèles), 3 retries
  // par modèle × 4 modèles peut cumuler plus d'une minute perdue avant
  // d'atteindre le fallback. 2 tentatives (1 retry avec 1s de backoff)
  // laisse une vraie chance à un 503 transitoire tout en échouant plus
  // vite vers le modèle suivant en cas de panne plus large.
  retries: number = 2
): Promise<{ text: string | null; overloaded: boolean }> {
  let lastOverloaded = false;
  for (let i = 0; i < retries; i++) {
    const result = await callModel(modelName, prompt, systemInstruction, history);
    if (result.ok) return { text: result.text, overloaded: false };

    lastOverloaded = isOverloadedError(result.message);

    // ✅ Erreur non-retryable (clé invalide, modèle inconnu, prompt rejeté...) :
    // inutile de réessayer 3 fois sur le MÊME modèle avec backoff, ça ne
    // changera rien. On passe directement au modèle suivant.
    if (!result.retryable) return { text: null, overloaded: lastOverloaded };

    // ✅ Quota journalier épuisé : le retryDelay annoncé par l'API est de
    // l'ordre de 50-60s, donc un backoff de quelques secondes ne sert à
    // rien. On passe directement au modèle suivant de la cascade.
    if (result.quotaExhausted) {
      console.warn(`[LLM] ${modelName} quota épuisé, abandon immédiat (pas de retry)`);
      return { text: null, overloaded: false };
    }

    console.warn(`[LLM] ${modelName} tentative ${i + 1}/${retries} échouée (retryable)`);
    if (i < retries - 1) {
      const delay = 1000 * Math.pow(2, i);
      console.log(`[LLM] Attente de ${delay}ms avant réessai...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return { text: null, overloaded: lastOverloaded };
}

// ✅ Détection de panne générale : si 2 modèles Gemini consécutifs
// échouent tous les deux en 503/overloaded ("high demand"), il est très
// peu probable qu'un 3e modèle Gemini réussisse au même moment — c'est
// une panne d'infrastructure côté Google, pas un pic isolé sur un seul
// modèle. On saute directement au premier modèle non-Gemini de la
// cascade (Gemma, infrastructure/quota séparés) plutôt que de perdre du
// temps à tester chaque modèle Gemini restant un par un.
const OVERLOAD_SKIP_THRESHOLD = 2;

export async function callWithFallback(
  prompt: string,
  systemInstruction: string,
  history: { role: string; parts: { text: string }[] }[] = []
): Promise<{ text: string; model: string } | null> {
  let consecutiveOverloads = 0;

  for (const modelName of MODELS) {
    const isGeminiModel = modelName.startsWith('gemini-');

    // Panne générale détectée sur les modèles Gemini précédents : on
    // saute ce modèle Gemini et on passe directement au suivant non-Gemini.
    if (isGeminiModel && consecutiveOverloads >= OVERLOAD_SKIP_THRESHOLD) {
      console.warn(`[LLM] ⏭️ ${modelName} ignoré (panne générale Gemini détectée)`);
      continue;
    }

    const { text, overloaded } = await callModelWithRetry(modelName, prompt, systemInstruction, history);
    if (text !== null) {
      return { text, model: modelName };
    }

    consecutiveOverloads = overloaded ? consecutiveOverloads + 1 : 0;
  }
  console.warn('[LLM] ❌ Tous les modèles ont échoué');
  return null;
}