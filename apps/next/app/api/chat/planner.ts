// app/api/chat/planner.ts
import { GoogleGenAI } from "@google/genai";
import type { Plan } from "./types";
import { buildPlannerPrompt } from "./prompt";
import { decideToolsWithGemini } from "./gemini-tools";
import { QUERY_TOOLS } from "./tools"; // ✅ remplace la liste hardcodée

// ✅ Migration @google/generative-ai → @google/genai (voir llm.ts/gemini-tools.ts
// pour le contexte complet : ancien SDK déprécié/archivé par Google).
const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
});

// ✅ Remplacé le modèle unique fixe par une vraie cascade, alignée sur
// llm.ts/gemini-tools.ts. Avant : un seul appel à gemini-2.5-flash, donc
// chaque 429/503 sur ce modèle tombait directement sur le fallback
// générique (semantic_search) sans essayer d'autre modèle — observé en
// pratique dans les logs ("[Planner] ❌ Erreur" répété à chaque itération
// alors que gemini-3.5-flash ou gemma-4-26b-a4b-it auraient pu réussir).
const PLANNER_MODELS = [
    'gemini-2.5-flash',
    'gemini-3.5-flash',
    'gemini-2.5-flash-lite',
    'gemma-4-26b-a4b-it',
];

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

function isOverloadedError(err: unknown): boolean {
    const msg = String(err instanceof Error ? err.message : err ?? '');
    return msg.includes('503') || msg.includes('overloaded') || msg.includes('high demand') || msg.includes('UNAVAILABLE');
}

// ✅ Un retry (2 tentatives) par modèle avant de passer au suivant, sauf
// si le quota journalier est épuisé (abandon immédiat, voir llm.ts pour
// le raisonnement complet : le retryDelay annoncé est de l'ordre de
// 50-60s, donc un backoff de 1s ne peut jamais réussir).
async function planOnceWithRetry(
    modelName: string,
    prompt: string,
    retries: number = 1
): Promise<{ text: string | null; overloaded: boolean }> {
    let lastOverloaded = false;
    for (let i = 0; i <= retries; i++) {
        try {
            const result = await ai.models.generateContent({
                model: modelName,
                contents: prompt,
            });
            return { text: result.text ?? '', overloaded: false };
        } catch (error) {
            lastOverloaded = isOverloadedError(error);

            if (isQuotaExhausted(error)) {
                console.warn(`[Planner] 🚫 ${modelName} quota épuisé, abandon immédiat`);
                return { text: null, overloaded: false };
            }
            if (!isRetryableError(error)) {
                console.error(`[Planner] ❌ Erreur non récupérable avec ${modelName}:`, error);
                return { text: null, overloaded: false };
            }
            console.warn(`[Planner] ⚠️ ${modelName} tentative ${i + 1}/${retries + 1} échouée (retryable)`);
            if (i < retries) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
    return { text: null, overloaded: lastOverloaded };
}

// ✅ Détection de panne générale : voir llm.ts pour le raisonnement
// complet. Si 2 modèles Gemini consécutifs échouent en 503/overloaded,
// on saute les autres modèles Gemini restants et passe directement à
// Gemma (infrastructure/quota séparés de Gemini).
const OVERLOAD_SKIP_THRESHOLD = 2;

const AVAILABLE_TOOLS: readonly string[] = QUERY_TOOLS;
export async function planQuestion(
    question: string,
    previousResults?: string
): Promise<Plan> {
    const prompt = buildPlannerPrompt(question, previousResults);
    let consecutiveOverloads = 0;

    for (const modelName of PLANNER_MODELS) {
        const isGeminiModel = modelName.startsWith('gemini-');

        if (isGeminiModel && consecutiveOverloads >= OVERLOAD_SKIP_THRESHOLD) {
            console.warn(`[Planner] ⏭️ ${modelName} ignoré (panne générale Gemini détectée)`);
            continue;
        }

        const { text, overloaded } = await planOnceWithRetry(modelName, prompt);
        consecutiveOverloads = overloaded ? consecutiveOverloads + 1 : 0;

        if (text === null) continue;

        try {
            const json = text
                .replace(/```json/g, "")
                .replace(/```/g, "")
                .trim();

            const plan = JSON.parse(json);

            // ✅ Garde-fous : un JSON valide mais incomplet (tools/search_query
            // manquants) ne doit pas propager des valeurs undefined jusqu'à
            // executePlan / toolFn(plan.search_query).
            plan.tools = Array.isArray(plan.tools)
                ? plan.tools.filter((tool: string) => AVAILABLE_TOOLS.includes(tool))
                : [];

            if (plan.tools.length === 0) {
                plan.tools = ['semantic_search'];
            }

            if (!plan.search_query || typeof plan.search_query !== 'string') {
                plan.search_query = question;
            }

            if (!plan.reasoning || typeof plan.reasoning !== 'string') {
                plan.reasoning = 'Plan généré sans justification explicite';
            }

            return plan;
        } catch (error) {
            // JSON malformé renvoyé par ce modèle précis : on essaie le
            // modèle suivant plutôt que d'abandonner tout de suite.
            console.warn(`[Planner] ⚠️ JSON invalide depuis ${modelName}, modèle suivant:`, error);
            continue;
        }
    }

    console.error('[Planner] ❌ Tous les modèles ont échoué');
    return {
        reasoning: 'Fallback: utilisation de la recherche sémantique par défaut',
        tools: ['semantic_search'],
        search_query: question,
    };
}

export async function planQuestionHybrid(
    question: string,
    useGemini: boolean = false,
    previousResults?: string
) {
    if (useGemini) {
        const { toolCalls, reasoning } = await decideToolsWithGemini(question, previousResults);
        return {
            reasoning,
            tools: toolCalls.map(t => t.name).filter(t => AVAILABLE_TOOLS.includes(t)),
            search_query: question,
            toolCalls,
        };
    }

    return planQuestion(question, previousResults);
}