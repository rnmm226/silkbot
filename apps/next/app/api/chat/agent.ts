// app/api/chat/agent.ts
import { callWithFallback } from "./llm";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import { parseStructured } from "./parser";
import { buildRagOnlyResponse, generateFallbackAnswer } from "./fallback";
import { planQuestion } from "./planner";
import { executePlan } from "./executor";
import { executeGeminiDecisions, decideToolsWithGemini } from "./gemini-tools";
import { AgentError, LLMError, handleAgentError } from "./errors";
import type { RagChunk, GeminiStructuredResponse } from "./types";

// ✅ Réduit de 3 à 2 : chaque itération coûte un appel planner + un appel
// de décision (potentiellement sur gemini-3.5-flash, plus lent). Avec le
// bug de parsing semantic_search corrigé (data.chunks au lieu de
// data.results), de vrais chunks remontent dès la 1ère itération dans la
// plupart des cas, rendant une 3e itération rarement nécessaire.
const MAX_ITERATIONS = 2;
const MIN_CHUNKS_THRESHOLD = 5;
const FINAL_CHUNKS_LIMIT = 8;

function mergeAndDedupeChunks(allChunks: RagChunk[]): RagChunk[] {
    const unique = allChunks.filter(
        (chunk, index, self) =>
            index === self.findIndex(c => c.chunk_id === chunk.chunk_id)
    );
    unique.sort((a, b) => b.similarity - a.similarity);
    return unique.slice(0, 20);
}

function isSpecificQuestion(question: string): boolean {
    return question.length > 50 ||
        question.includes('article') ||
        question.includes('loi') ||
        question.includes('décret') ||
        question.includes('code') ||
        question.includes('TVA') ||
        question.includes('exonération');
}

function hasEnoughInformation(chunks: RagChunk[], question: string): boolean {
    if (chunks.length >= MIN_CHUNKS_THRESHOLD) return true;
    if (isSpecificQuestion(question)) return false;
    return chunks.length >= 3;
}

async function shouldContinueSearch(
    question: string,
    chunks: RagChunk[],
    iteration: number
): Promise<{ continue: boolean; reason: string; newQuery?: string }> {
    if (iteration >= MAX_ITERATIONS) {
        return { continue: false, reason: 'Max iterations reached' };
    }

    if (hasEnoughInformation(chunks, question)) {
        return { continue: false, reason: 'Enough information gathered' };
    }

    try {
        const prompt = `
Tu es un agent de recherche juridique. Question: "${question}"
Tu as trouvé ${chunks.length} passages pertinents.
${chunks.length === 0 ? "Aucun passage trouvé." : `Sources: ${[...new Set(chunks.map(c => c.filename))].join(', ')}`}

Dois-tu continuer ? Réponds UNIQUEMENT en JSON:
{
  "continue": true/false,
  "reason": "explication",
  "new_query": "nouvelle requête ou null"
}`;

        const result = await callWithFallback(prompt, "Expert en recherche juridique tunisien.");
        if (!result) return { continue: false, reason: 'LLM unavailable' };

        const cleanText = result.text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        const match = cleanText.match(/\{[\s\S]*\}/);
        if (!match) return { continue: false, reason: 'No JSON found' };

        const json = JSON.parse(match[0]);
        return {
            continue: json.continue ?? false,
            reason: json.reason || 'Decision made',
            newQuery: json.new_query || undefined,
        };
    } catch (error) {
        console.error('[shouldContinueSearch] Error:', error);
        return { continue: false, reason: 'Error in decision process' };
    }
}

async function reformulateQuery(
    question: string,
    currentQuery: string,
    chunksCount: number
): Promise<string> {
    try {
        const result = await callWithFallback(
            `Question: "${question}"\nRecherche: "${currentQuery}"\n${chunksCount} passages trouvés.\nPropose une nouvelle requête plus ciblée (max 10 mots).`,
            "Expert en reformulation de requêtes juridiques."
        );
        if (result) return result.text.trim();
    } catch (error) {
        console.error('[reformulateQuery] Error:', error);
    }
    return question;
}

// ── AGENT 1: ReAct ──────────────────────────────────────────────

export async function runAgent(
    question: string,
    history: { role: string; parts: { text: string }[] }[]
): Promise<GeminiStructuredResponse> {

    console.log('[Agent] Étape 1 — Draft');
    const draftResult = await callWithFallback(
        question,
        `Tu es un assistant juridique tunisien expert. Réponds de façon concise et précise.`,
        history
    );

    const draft = draftResult?.text || '';
    const modelUsed = draftResult?.model || 'unknown';
    console.log(`[Agent] Draft: ${modelUsed}`);

    let allChunks: RagChunk[] = [];
    let iteration = 0;
    let iterationsRun = 0;
    let currentQuery = question;
    const steps: string[] = [];
    const toolErrors: string[] = [];

    console.log('[Agent] Boucle ReAct');

    while (iteration < MAX_ITERATIONS) {
        iterationsRun++;
        console.log(`[Agent] Itération ${iterationsRun}/${MAX_ITERATIONS}`);
        steps.push(`Itération ${iterationsRun}: recherche...`);

        try {
            const plan = await planQuestion(currentQuery);
            console.log('[Planner]', plan);
            steps.push(`Plan: ${plan.reasoning}`);

            const toolResults = await executePlan(plan);
            steps.push(`Outils: ${plan.tools.join(', ')}`);

            const newChunks: RagChunk[] = [];
            for (const result of toolResults) {
                if (result.result?.chunks) {
                    newChunks.push(...result.result.chunks);
                    steps.push(`${result.tool}: ${result.result.chunks.length} passages`);
                } else if (result.error) {
                    steps.push(`${result.tool}: Erreur — ${result.error}`);
                    toolErrors.push(`${result.tool}: ${result.error}`);
                }
            }

            allChunks = [...allChunks, ...newChunks];
            const mergedChunks = mergeAndDedupeChunks(allChunks);

            console.log(`[Agent] ${mergedChunks.length} chunks uniques`);
            steps.push(`${mergedChunks.length} passages uniques`);

            const decision = await shouldContinueSearch(question, mergedChunks, iteration + 1);
            console.log(`[Agent] Décision: ${decision.continue ? 'Continuer' : 'Arrêter'} - ${decision.reason}`);
            steps.push(`Décision: ${decision.reason}`);

            if (!decision.continue) {
                allChunks = mergedChunks;
                break;
            }

            if (decision.newQuery) {
                currentQuery = decision.newQuery;
                steps.push(`Nouvelle requête: "${currentQuery}"`);
            } else {
                const newQuery = await reformulateQuery(question, currentQuery, mergedChunks.length);
                if (newQuery && newQuery !== currentQuery) {
                    currentQuery = newQuery;
                    steps.push(`Requête reformulée: "${currentQuery}"`);
                } else {
                    currentQuery = `${question} ${mergedChunks.slice(0, 3).map(c => c.filename).join(' ')}`;
                    steps.push(`Requête enrichie avec noms de documents`);
                }
            }

        } catch (error) {
            console.error(`[Agent] Erreur itération ${iterationsRun}:`, error);
            steps.push(`⚠️ Erreur: ${error instanceof Error ? error.message : 'Inconnue'}`);
            allChunks = mergeAndDedupeChunks(allChunks);

            // ✅ Erreur structurelle (planQuestion/executePlan ont throw,
            // pas juste un outil individuel qui échoue — voir executor.ts
            // où chaque outil est déjà catché en SearchError et renvoyé
            // comme ToolResult.error, sans jamais propager jusqu'ici).
            // Si on n'a *aucun* chunk de secours d'une itération précédente,
            // il n'y a rien à présenter à l'étape finale : on retourne tout
            // de suite une réponse d'erreur structurée plutôt que de
            // continuer vers un refinePrompt vide. S'il reste des chunks
            // d'une itération antérieure, on garde le comportement actuel
            // (on continue vers l'étape finale avec ce qu'on a).
            if (allChunks.length === 0) {
                return handleAgentError(
                    new AgentError(
                        error instanceof Error ? error.message : String(error),
                        'search',
                        true
                    )
                );
            }
            break;
        }

        iteration++;
    }

    console.log(`[Agent] Fin. ${allChunks.length} chunks après ${iterationsRun} itération(s)`);

    console.log('[Agent] Étape finale');
    const refinePrompt = buildUserPrompt(
        question,
        draft,
        allChunks.slice(0, FINAL_CHUNKS_LIMIT)
    );

    let finalResult;
    try {
        finalResult = await callWithFallback(refinePrompt, SYSTEM_PROMPT);
    } catch (error) {
        return handleAgentError(new LLMError(error instanceof Error ? error.message : String(error)));
    }

    if (!finalResult) {
        // ✅ Double échec LLM (draft à l'étape 1 ET réponse finale) : à ce
        // stade, retenter generateFallbackAnswer ne ferait qu'utiliser un
        // `draft` vide de toute façon (cf. son fallback "Aucun document
        // trouvé... Impossible de générer une réponse"). Si on a des
        // chunks, buildRagOnlyResponse donne une réponse plus utile et
        // mieux formatée (extraits avec liens/pertinence) que de repasser
        // par generateFallbackAnswer avec un draft vide.
        if (!draft && allChunks.length > 0) {
            console.warn('[Agent] Draft ET réponse finale indisponibles, réponse RAG seule');
            const ragOnly = buildRagOnlyResponse(allChunks);
            if (toolErrors.length > 0) {
                ragOnly.thinking_summary.steps.push(...toolErrors);
            }
            return ragOnly;
        }

        console.warn('[Agent] LLM indisponible, fallback');
        const fallback = generateFallbackAnswer(question, allChunks, draft);
        if (toolErrors.length > 0) {
            fallback.thinking_summary.steps.push(...toolErrors);
        }
        return fallback;
    }

    const parsed = parseStructured(finalResult.text, allChunks);
    parsed.model_used = finalResult.model;
    parsed.thinking_summary.steps = [
        ...steps,
        `${iterationsRun} itération(s)`,
        ...parsed.thinking_summary.steps,
    ];

    return parsed;
}

// ── AGENT 2: Gemini ──────────────────────────────────────────────

export async function runAgentGemini(
    question: string,
    history: { role: string; parts: { text: string }[] }[]
): Promise<GeminiStructuredResponse> {

    console.log('[AgentGemini] Étape 1 — Draft');
    const draftResult = await callWithFallback(
        question,
        `Tu es un assistant juridique tunisien expert. Réponds de façon concise et précise.`,
        history
    );

    const draft = draftResult?.text || '';
    const modelUsed = draftResult?.model || 'unknown';
    console.log(`[AgentGemini] Draft: ${modelUsed}`);

    console.log('[AgentGemini] Décision Gemini');
    const { toolCalls, reasoning } = await decideToolsWithGemini(question);
    console.log('[AgentGemini] Outils:', toolCalls.map(t => t.name).join(', '));

    console.log('[AgentGemini] Exécution');
    const searchResult = await executeGeminiDecisions(toolCalls);
    const chunks = mergeAndDedupeChunks(searchResult.chunks);
    console.log(`[AgentGemini] ${chunks.length} chunks`);

    console.log('[AgentGemini] Réponse finale');
    const refinePrompt = buildUserPrompt(question, draft, chunks.slice(0, FINAL_CHUNKS_LIMIT));

    let finalResult;
    try {
        finalResult = await callWithFallback(refinePrompt, SYSTEM_PROMPT);
    } catch (error) {
        return handleAgentError(new LLMError(error instanceof Error ? error.message : String(error)));
    }

    if (!finalResult) {
        // ✅ Voir runAgent pour le raisonnement complet : double échec LLM
        // (draft + réponse finale) avec des chunks disponibles → réponse
        // RAG seule, mieux formatée qu'un fallback avec draft vide.
        if (!draft && chunks.length > 0) {
            console.warn('[AgentGemini] Draft ET réponse finale indisponibles, réponse RAG seule');
            return buildRagOnlyResponse(chunks);
        }

        console.warn('[AgentGemini] LLM indisponible, fallback');
        return generateFallbackAnswer(question, chunks, draft);
    }

    const parsed = parseStructured(finalResult.text, chunks);
    parsed.model_used = finalResult.model;
    parsed.thinking_summary.steps = [
        `Gemini: ${toolCalls.map(t => t.name).join(', ')}`,
        `Raisonnement: ${reasoning}`,
        ...parsed.thinking_summary.steps,
    ];
    return parsed;
}