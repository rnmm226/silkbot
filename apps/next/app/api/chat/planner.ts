// app/api/chat/planner.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Plan } from "./types";
import { buildPlannerPrompt } from "./prompt";
import { decideToolsWithGemini } from "./gemini-tools";

const genAI = new GoogleGenerativeAI(
    process.env.GOOGLE_GENERATIVE_AI_API_KEY!
);

const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash"
});

const AVAILABLE_TOOLS = ['semantic_search', 'smart_search', 'hybrid_search'];

export async function planQuestion(
    question: string,
    previousResults?: string
): Promise<Plan> {
    const prompt = buildPlannerPrompt(question, previousResults);

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const json = text
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();

        const plan = JSON.parse(json);
        
        // Filtrer pour n'utiliser que les outils disponibles
        plan.tools = plan.tools.filter((tool: string) => 
            AVAILABLE_TOOLS.includes(tool)
        );
        
        if (plan.tools.length === 0) {
            plan.tools = ['semantic_search'];
        }
        
        return plan;
    } catch (error) {
        console.error('[Planner] ❌ Erreur:', error);
        return {
            reasoning: 'Fallback: utilisation de la recherche sémantique par défaut',
            tools: ['semantic_search'],
            search_query: question,
        };
    }
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