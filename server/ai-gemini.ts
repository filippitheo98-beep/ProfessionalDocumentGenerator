/**
 * Module centralisé pour les appels à l'API Google Gemini.
 * Remplace OpenAI pour la génération IA (risques, regroupement, suggestions).
 */

import { GoogleGenAI } from '@google/genai';

const API_KEY_ENV = 'GOOGLE_GEMINI_API_KEY';
const DEFAULT_MODEL = 'gemini-2.5-flash';

function getApiKey(): string {
  const apiKey = process.env[API_KEY_ENV]?.trim();
  if (!apiKey) {
    throw new Error(
      `${API_KEY_ENV} non configurée. Ajoutez-la dans .env ou dans les variables d'environnement (ex. Railway) pour activer la génération par IA.`
    );
  }
  return apiKey;
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env[API_KEY_ENV]?.trim());
}

/**
 * Extrait le JSON brut d'une réponse pouvant contenir des blocs markdown ou du texte parasite.
 * Gemini peut renvoyer ```json\n{...}\n``` ou du texte avant/après le JSON.
 */
function extractJson(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  // Bloc ```json ... ```
  const jsonBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    return jsonBlockMatch[1].trim();
  }

  // Objet JSON : premier { jusqu'au dernier }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

export interface GenerateJsonOptions {
  systemPrompt?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

/**
 * Génère une réponse JSON à partir d'un prompt.
 * Utilise responseMimeType pour forcer une sortie JSON valide.
 */
export async function generateJson(
  prompt: string,
  options: GenerateJsonOptions = {}
): Promise<string> {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI({ apiKey });

  const config: Record<string, unknown> = {
    temperature: options.temperature ?? 0.7,
    maxOutputTokens: options.maxOutputTokens ?? 2000,
  };

  if (options.systemPrompt) {
    config.systemInstruction = options.systemPrompt;
  }

  // Forcer la sortie JSON (supporté par Gemini 1.5+)
  config.responseMimeType = 'application/json';

  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: prompt,
    config: config as any,
  });

  const text = (response as { text?: string }).text;
  if (!text || typeof text !== 'string') {
    throw new Error('Réponse IA vide ou invalide.');
  }
  return extractJson(text);
}
