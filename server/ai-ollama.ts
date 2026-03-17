/**
 * Module centralisé pour les appels à Ollama (serveur self-hosted).
 * Utilise l'API native /api/chat (pas de clé API).
 */

const OLLAMA_BASE_URL_ENV = 'OLLAMA_BASE_URL';
const OLLAMA_MODEL_ENV = 'OLLAMA_MODEL';

const DEFAULT_BASE_URL = 'http://54.38.26.215:11434';
const DEFAULT_MODEL = 'llama3.2';

function getBaseUrl(): string {
  return (process.env[OLLAMA_BASE_URL_ENV]?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function getModel(): string {
  return process.env[OLLAMA_MODEL_ENV]?.trim() || DEFAULT_MODEL;
}

/**
 * Extrait le JSON brut d'une réponse pouvant contenir des blocs markdown ou du texte parasite.
 */
function extractJson(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  // Bloc ```json ... ``` ou ``` ... ```
  const jsonBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) return jsonBlockMatch[1].trim();

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
  responseJsonSchema?: unknown;
}

/**
 * Génère une réponse (attendue JSON) depuis Ollama.
 */
export async function generateJson(
  prompt: string,
  options: GenerateJsonOptions = {}
): Promise<string> {
  const baseUrl = getBaseUrl();
  const model = getModel();

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  if (options.systemPrompt) messages.push({ role: 'system', content: options.systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180_000); // 3 min (Ollama sur CPU peut être lent)

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        // `format` peut être "json" ou un JSON Schema (plus robuste)
        format: options.responseJsonSchema ?? 'json',
        messages,
        options: {
          temperature: options.temperature ?? 0.7,
          // Ollama utilise num_predict pour limiter la taille de sortie
          num_predict: options.maxOutputTokens ?? 2000,
        },
      }),
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError') {
      throw new Error('Service Ollama indisponible : délai dépassé (vérifiez le pare-feu et que Ollama écoute sur 0.0.0.0).');
    }
    throw new Error(`Service Ollama indisponible : ${err?.message || err}. Vérifiez OLLAMA_BASE_URL et le pare-feu (port 11434).`);
  }
  clearTimeout(timeoutId);

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Service Ollama indisponible (${res.status}). ${errText}`.trim());
  }

  const data = (await res.json()) as any;
  const text = data?.message?.content;
  if (!text || typeof text !== 'string') {
    throw new Error('Réponse IA vide ou invalide.');
  }
  return extractJson(text);
}

