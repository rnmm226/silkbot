// app/api/chat/agent.ts
import { callWithFallback } from "./llm";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import { parseStructured } from "./parser";
import { buildRagOnlyResponse, generateFallbackAnswer } from "./fallback";
import { planQuestion } from "./planner";
import { executePlan } from "./executor";
import { executeGeminiDecisions, decideToolsWithGemini } from "./gemini-tools";
import type { RagChunk, GeminiStructuredResponse } from "./types";

const MAX_ITERATIONS = 3;
const MIN_CHUNKS_THRESHOLD = 5;

function mergeAndDedupeChunks(allChunks: RagChunk[]): RagChunk[] {
    const unique = allChunks.filter(
        (chunk, index, self) =>
            index === self.findIndex(c => c.chunk_id === chunk.chunk_id)
    );
    unique.sort((a, b) => b.similarity - a.similarity);
    return unique.slice(0, 20);
}

function hasEnoughInformation(chunks: RagChunk[], question: string): boolean {
    if (chunks.length >= MIN_CHUNKS_THRESHOLD) return true;
    
    const isSpecific = question.length > 50 || 
                       question.includes('article') || 
                       question.includes('loi') ||
                       question.includes('décret') ||
                       question.includes('code') ||
                       question.includes('TVA') ||
                       question.includes('exonération');
    
    if (isSpecific && chunks.length < 3) return false;
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
    let currentQuery = question;
    const steps: string[] = [];

    console.log('[Agent] Boucle ReAct');

    while (iteration < MAX_ITERATIONS) {
        console.log(`[Agent] Itération ${iteration + 1}/${MAX_ITERATIONS}`);
        steps.push(`Itération ${iteration + 1}: recherche...`);

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
                    steps.push(`${result.tool}: Erreur`);
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
            console.error(`[Agent] Erreur itération ${iteration + 1}:`, error);
            steps.push(`⚠️ Erreur: ${error instanceof Error ? error.message : 'Inconnue'}`);
            break;
        }

        iteration++;
    }

    console.log(`[Agent] Fin. ${allChunks.length} chunks`);

    console.log('[Agent] Étape finale');
    const refinePrompt = buildUserPrompt(
    question,
    draft,
    allChunks.slice(0, 3)
);
    const finalResult = await callWithFallback(refinePrompt, SYSTEM_PROMPT);

    if (!finalResult) {
        console.warn('[Agent] LLM indisponible, fallback');
        return generateFallbackAnswer(question, allChunks, draft);
    }

    const parsed = parseStructured(finalResult.text, allChunks);
    parsed.model_used = finalResult.model;
    parsed.thinking_summary.steps = [
        ...steps,
        `${iteration} itérations`,
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
    const chunks = searchResult.chunks;
    console.log(`[AgentGemini] ${chunks.length} chunks`);

    console.log('[AgentGemini] Réponse finale');
    const refinePrompt = buildUserPrompt(question, draft, chunks);
    const finalResult = await callWithFallback(refinePrompt, SYSTEM_PROMPT);

    if (!finalResult) {
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
    console.log("[Agent] Parsed =", JSON.stringify(parsed, null, 2));
    return parsed;
}