// app/api/chat/llm.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(
  process.env.GOOGLE_GENERATIVE_AI_API_KEY!
);


// Ajoutez ceci au niveau supérieur du fichier, après genAI
async function listAvailableModels() {
  try {
    const result = await genAI.listModels();
    console.log('[LLM] 📋 Modèles disponibles:');
    result.models.forEach(model => {
      console.log(`  - ${model.name} (${model.supportedGenerationMethods?.join(', ')})`);
    });
  } catch (err) {
    console.error('[LLM] ❌ Impossible de lister les modèles:', err);
  }
}

// Appelez-la une fois au démarrage
listAvailableModels();
// Ajoutez ce log temporairement
console.log('[LLM] Clé API présente ?', !!process.env.GOOGLE_GENERATIVE_AI_API_KEY);
console.log('[LLM] Clé API début:', process.env.GOOGLE_GENERATIVE_AI_API_KEY?.substring(0, 10));

const MODELS = [
  'gemini-2.0-flash-exp',        // Modèle expérimental
  'gemini-1.5-flash-001',        // Nom exact
  'gemini-1.5-pro-001',          // Nom exact
  'gemini-2.5-flash-preview-04-2025', // Preview
];
function isRetryableError(err: any): boolean {
  const msg = String(err?.message || err || '');
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

async function callModel(
  modelName: string,
  prompt: string,
  systemInstruction: string,
  history: { role: string; parts: { text: string }[] }[] = []
): Promise<string | null> {
  try {
    console.log(`[LLM] Tentative avec ${modelName}`);
    const model = genAI.getGenerativeModel({ model: modelName, systemInstruction });
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(prompt);
    const text = result.response.text();
    console.log(`[LLM] ✅ Succès avec ${modelName}`);
    return text;
  } catch (err) {
    if (isRetryableError(err)) {
      console.warn(`[LLM] ⚠️ ${modelName} indisponible:`, err.message);
      return null;
    }
    console.error(`[LLM] ❌ Erreur avec ${modelName}:`, err);
    throw err;
  }
}

async function callModelWithRetry(
  modelName: string,
  prompt: string,
  systemInstruction: string,
  history: { role: string; parts: { text: string }[] }[] = [],
  retries: number = 3
): Promise<string | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await callModel(modelName, prompt, systemInstruction, history);
      if (result !== null) return result;
    } catch (err) {
      console.warn(`[LLM] ${modelName} tentative ${i + 1}/${retries} échouée`);
      if (i < retries - 1) {
        const delay = 1000 * Math.pow(2, i);
        console.log(`[LLM] Attente de ${delay}ms avant réessai...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  return null;
}

export async function callWithFallback(
  prompt: string,
  systemInstruction: string,
  history: { role: string; parts: { text: string }[] }[] = []
): Promise<{ text: string; model: string } | null> {
  for (const modelName of MODELS) {
    const text = await callModelWithRetry(modelName, prompt, systemInstruction, history);
    if (text !== null) {
      return { text, model: modelName };
    }
  }
  console.warn('[LLM] ❌ Tous les modèles ont échoué');
  return null;
}