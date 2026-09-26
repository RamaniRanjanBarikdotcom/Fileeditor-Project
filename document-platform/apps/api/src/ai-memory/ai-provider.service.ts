import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AiPromptMessage {
  role: 'system' | 'developer' | 'user' | 'assistant';
  content: string;
}

export interface StructuredGenerationOptions {
  schemaName: string;
  schema: Record<string, unknown>;
}

export abstract class AiProvider {
  abstract readonly providerName: string;
  abstract readonly chatModel: string;
  abstract readonly embeddingModel: string;
  abstract isConfigured(): boolean;
  abstract generate(messages: AiPromptMessage[]): Promise<string>;
  abstract generateStructured<T>(
    messages: AiPromptMessage[],
    options: StructuredGenerationOptions,
  ): Promise<T>;
  abstract embedText(text: string): Promise<number[] | null>;
  abstract embedBatch(texts: string[]): Promise<Array<number[] | null>>;

  async generateStructuredMeasured<T>(
    messages: AiPromptMessage[],
    options: StructuredGenerationOptions,
    _signal?: AbortSignal,
  ): Promise<{ value: T; inputTokens: number; outputTokens: number; model: string }> {
    const value = await this.generateStructured<T>(messages, options);
    return {
      value,
      inputTokens: estimateTokens(JSON.stringify(messages)),
      outputTokens: estimateTokens(JSON.stringify(value)),
      model: this.chatModel,
    };
  }
}

@Injectable()
export class OpenAiCompatibleProvider extends AiProvider {
  readonly providerName: string;
  readonly chatModel: string;
  readonly embeddingModel: string;
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    super();
    this.providerName = config.get<string>('AI_PROVIDER', 'openai-compatible');
    this.baseUrl = config
      .get<string>('AI_BASE_URL', 'https://api.openai.com/v1')
      .replace(/\/$/, '');
    this.apiKey = config.get<string>('AI_API_KEY') || undefined;
    this.chatModel = config.get<string>('AI_CHAT_MODEL', 'gpt-5-mini');
    this.embeddingModel = config.get<string>('AI_EMBEDDING_MODEL', 'text-embedding-3-small');
    this.timeoutMs = Number(config.get<string>('AI_REQUEST_TIMEOUT_MS', '60000'));
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.chatModel);
  }

  async generate(messages: AiPromptMessage[]): Promise<string> {
    const payload = await this.request<{ choices?: Array<{ message?: { content?: string } }> }>(
      '/chat/completions',
      { model: this.chatModel, messages },
    );
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content)
      throw new ServiceUnavailableException('The AI provider returned an empty response.');
    return content;
  }

  async generateStructured<T>(
    messages: AiPromptMessage[],
    options: StructuredGenerationOptions,
  ): Promise<T> {
    const payload = await this.request<{ choices?: Array<{ message?: { content?: string } }> }>(
      '/chat/completions',
      {
        model: this.chatModel,
        messages,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: options.schemaName,
            strict: true,
            schema: options.schema,
          },
        },
      },
    );
    const content = payload.choices?.[0]?.message?.content;
    if (!content)
      throw new ServiceUnavailableException('The AI provider returned no structured output.');
    try {
      return JSON.parse(content) as T;
    } catch {
      throw new ServiceUnavailableException('The AI provider returned invalid structured output.');
    }
  }

  override async generateStructuredMeasured<T>(
    messages: AiPromptMessage[],
    options: StructuredGenerationOptions,
    signal?: AbortSignal,
  ): Promise<{ value: T; inputTokens: number; outputTokens: number; model: string }> {
    const payload = await this.request<{
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      model?: string;
    }>(
      '/chat/completions',
      {
        model: this.chatModel,
        messages,
        response_format: {
          type: 'json_schema',
          json_schema: { name: options.schemaName, strict: true, schema: options.schema },
        },
      },
      signal,
    );
    const content = payload.choices?.[0]?.message?.content;
    if (!content)
      throw new ServiceUnavailableException('The AI provider returned no structured output.');
    try {
      return {
        value: JSON.parse(content) as T,
        inputTokens: payload.usage?.prompt_tokens || estimateTokens(JSON.stringify(messages)),
        outputTokens: payload.usage?.completion_tokens || estimateTokens(content),
        model: payload.model || this.chatModel,
      };
    } catch {
      throw new ServiceUnavailableException('The AI provider returned invalid structured output.');
    }
  }

  async embedText(text: string): Promise<number[] | null> {
    const [result] = await this.embedBatch([text]);
    return result || null;
  }

  async embedBatch(texts: string[]): Promise<Array<number[] | null>> {
    if (!texts.length) return [];
    if (!this.apiKey || !this.embeddingModel) return texts.map(() => null);
    try {
      const payload = await this.request<{ data?: Array<{ index: number; embedding: number[] }> }>(
        '/embeddings',
        { model: this.embeddingModel, input: texts },
      );
      const ordered: Array<number[] | null> = texts.map(() => null);
      for (const item of payload.data || []) {
        if (item.index >= 0 && item.index < ordered.length && Array.isArray(item.embedding)) {
          ordered[item.index] = item.embedding;
        }
      }
      return ordered;
    } catch {
      return texts.map(() => null);
    }
  }

  private async request<T>(
    path: string,
    body: Record<string, unknown>,
    externalSignal?: AbortSignal,
  ): Promise<T> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        'AI assistance is not configured. Set server-side AI_API_KEY and model settings.',
      );
    }
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(new Error('AI provider request timed out.')),
      this.timeoutMs,
    );
    const signal = externalSignal
      ? AbortSignal.any([externalSignal, controller.signal])
      : controller.signal;
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal,
      });
      if (!response.ok) {
        throw new ServiceUnavailableException(
          `AI provider request failed with status ${response.status}.`,
        );
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException('The AI provider is temporarily unavailable.');
    } finally {
      clearTimeout(timeout);
    }
  }
}

function estimateTokens(value: string): number {
  return Math.max(1, Math.ceil(value.length / 4));
}
