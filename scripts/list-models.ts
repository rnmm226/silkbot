// scripts/list-models.ts
import 'dotenv/config';

type ModelInfo = {
  name: string;
  displayName?: string;
  supportedGenerationMethods?: string[];
};

type ApiResponse = {
  models: ModelInfo[];
};

async function listAvailableModels() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ GOOGLE_GENERATIVE_AI_API_KEY not found in .env');
    return;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    
    const data = await response.json() as ApiResponse;
    
    console.log('\n📋 Modèles disponibles pour generateContent:\n');
    
    data.models?.forEach((model: ModelInfo) => {
      if (model.supportedGenerationMethods?.includes('generateContent')) {
        console.log(`✅ ${model.name} - ${model.displayName || ''}`);
      }
    });
  } catch (error) {
    console.error('Erreur:', error);
  }
}

listAvailableModels();