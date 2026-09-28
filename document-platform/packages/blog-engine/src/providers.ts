/**
 * Provider catalog for Blog Studio.
 * Defines connection test, model discovery, and credential validation
 * interfaces for all 14 supported AI providers.
 */

export const BLOG_PROVIDER_TYPES = [
  'OPENAI',
  'GOOGLE',
  'ANTHROPIC',
  'OPENROUTER',
  'GROQ',
  'XAI',
  'HUGGINGFACE',
  'MISTRAL',
  'TOGETHER',
  'FIREWORKS',
  'PERPLEXITY',
  'SARVAM',
  'TAVILY',
  'CUSTOM',
] as const;

export type BlogProviderTypeName = (typeof BLOG_PROVIDER_TYPES)[number];

export interface ProviderModel {
  id: string;
  name: string;
  contextWindow?: number;
  supportsStructuredOutput: boolean;
  supportsImages: boolean;
}

export interface ProviderConnectionTestResult {
  success: boolean;
  latencyMs: number;
  errorMessage?: string;
  models?: ProviderModel[];
}

export interface ProviderConfig {
  type: BlogProviderTypeName;
  label: string;
  apiKey: string;
  endpoint?: string;
}

/**
 * Validates that a provider type name is recognized.
 */
export function isValidProviderType(value: string): value is BlogProviderTypeName {
  return BLOG_PROVIDER_TYPES.includes(value as BlogProviderTypeName);
}

/**
 * Returns the default base URL for a given provider type.
 * Custom providers must supply their own endpoint.
 */
export function defaultProviderEndpoint(type: BlogProviderTypeName): string | null {
  const endpoints: Record<string, string> = {
    OPENAI: 'https://api.openai.com/v1',
    GOOGLE: 'https://generativelanguage.googleapis.com/v1beta',
    ANTHROPIC: 'https://api.anthropic.com/v1',
    OPENROUTER: 'https://openrouter.ai/api/v1',
    GROQ: 'https://api.groq.com/openai/v1',
    XAI: 'https://api.x.ai/v1',
    HUGGINGFACE: 'https://router.huggingface.co/v1',
    MISTRAL: 'https://api.mistral.ai/v1',
    TOGETHER: 'https://api.together.xyz/v1',
    FIREWORKS: 'https://api.fireworks.ai/inference/v1',
    PERPLEXITY: 'https://api.perplexity.ai',
    SARVAM: 'https://api.sarvam.ai/v1',
    TAVILY: 'https://api.tavily.com',
  };
  return endpoints[type] ?? null;
}

export function normalizeProviderModelId(type: BlogProviderTypeName, value: string): string {
  const normalized = value.trim();
  if (type === 'GOOGLE') return normalized.replace(/^models\//, '');
  return normalized;
}

export function isBlogGenerationModel(modelId: string): boolean {
  const id = modelId.toLowerCase();
  return ![
    'embedding',
    'embed-',
    'moderation',
    'whisper',
    'transcri',
    'speech',
    'tts',
    'realtime',
    'live-',
    '-live',
    'audio',
    'image',
    'imagen',
    'veo-',
    'sora-',
    'lyria',
    'rerank',
  ].some((marker) => id.includes(marker));
}

/**
 * Masks an API key for safe display (e.g., "sk-****7x4Z").
 */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) return '****';
  const prefix = apiKey.slice(0, 3);
  const suffix = apiKey.slice(-4);
  return `${prefix}****${suffix}`;
}

/**
 * Tests connectivity to a provider by making a lightweight API call.
 * Returns connection status and optionally the list of available models.
 *
 * @param config - Provider configuration with decrypted API key
 * @param timeoutMs - Connection test timeout (default: 10000ms)
 */
export async function testProviderConnection(
  config: ProviderConfig,
  timeoutMs = 10_000,
): Promise<ProviderConnectionTestResult> {
  const endpoint = config.endpoint || defaultProviderEndpoint(config.type);
  if (!endpoint) {
    return {
      success: false,
      latencyMs: 0,
      errorMessage: 'No endpoint configured for this provider type.',
    };
  }

  const start = performance.now();
  try {
    // Most OpenAI-compatible providers support GET /models
    const modelsUrl =
      config.type === 'TAVILY'
        ? `${endpoint}/search`
        : `${endpoint.replace(/\/+$/, '')}/models`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${config.apiKey}`,
    };

    // Anthropic uses a different header
    if (config.type === 'ANTHROPIC') {
      headers['x-api-key'] = config.apiKey;
      headers['anthropic-version'] = '2023-06-01';
      delete headers.Authorization;
    }

    // Google uses API key as query parameter
    const url =
      config.type === 'GOOGLE'
        ? `${modelsUrl}?key=${config.apiKey}`
        : modelsUrl;
    if (config.type === 'GOOGLE') {
      delete headers.Authorization;
    }

    // For Tavily, we can't list models — just verify the key works
    if (config.type === 'TAVILY') {
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: config.apiKey, query: 'test', max_results: 1 }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const latencyMs = Math.round(performance.now() - start);
      if (response.ok) {
        return { success: true, latencyMs, models: [] };
      }
      return {
        success: false,
        latencyMs,
        errorMessage: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const latencyMs = Math.round(performance.now() - start);

    if (!response.ok) {
      return {
        success: false,
        latencyMs,
        errorMessage: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const body = (await response.json()) as {
      data?: Array<Record<string, unknown>>;
      models?: Array<Record<string, unknown>>;
    };
    const entries = Array.isArray(body.data) ? body.data : Array.isArray(body.models) ? body.models : [];
    const models: ProviderModel[] = entries
      .map((model) => {
        const id = normalizeProviderModelId(
          config.type,
          String(model.id || model.name || ''),
        );
        return { model, id };
      })
      .filter(({ model, id }) => {
        const methods = model.supportedGenerationMethods;
        return Boolean(id) &&
          isBlogGenerationModel(id) &&
          !(
            config.type === 'GOOGLE' &&
            Array.isArray(methods) &&
            !methods.includes('generateContent')
          );
      })
      .slice(0, 250)
      .map(({ model, id }) => ({
        id,
        name: String(model.displayName || id),
        supportsStructuredOutput: Boolean(model.supportsStructuredOutput),
        supportsImages: Boolean(model.supportsImages),
      }));

    return { success: true, latencyMs, models };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      success: false,
      latencyMs,
      errorMessage: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}
