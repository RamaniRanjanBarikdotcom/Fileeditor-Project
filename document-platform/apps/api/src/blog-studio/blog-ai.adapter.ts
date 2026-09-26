import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';
import {
  defaultProviderEndpoint,
  type BlogAiResult,
  type BlogPipelineStage,
  type BlogProviderTypeName,
} from '@docconv/blog-engine';
import {
  UrlSecurityService,
  createSafeHttpAgent,
  createSafeHttpsAgent,
} from '@docconv/url-security';
import { AiProvider } from '../ai-memory/ai-provider.service';
import { PrismaService } from '../common/prisma.service';
import { EncryptionService } from './encryption.service';

type StructuredInput = {
  stage: BlogPipelineStage;
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  signal?: AbortSignal;
};

@Injectable()
export class BlogAiAdapter {
  constructor(
    private readonly provider: AiProvider,
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly urlSecurity: UrlSecurityService,
  ) {}

  isConfigured() {
    return this.provider.isConfigured();
  }

  async forGeneration(
    organizationId: string,
    credentialId?: string,
    promptTemplateVersion?: number,
  ) {
    if (!credentialId) {
      return this.withPromptTemplates(this, organizationId, promptTemplateVersion);
    }
    const credential = await this.prisma.blogProviderCredential.findFirst({
      where: { id: credentialId, organizationId, isActive: true },
    });
    if (!credential) throw new BadRequestException('The selected AI provider is unavailable.');
    const endpoint =
      credential.customEndpoint ||
      defaultProviderEndpoint(credential.providerType as BlogProviderTypeName);
    if (!endpoint) throw new BadRequestException('The selected provider requires an endpoint.');
    await this.urlSecurity.validateUrl(endpoint);
    const settings = await this.prisma.blogStudioSetting.findUnique({ where: { organizationId } });
    const adapter = new CredentialBlogAiAdapter(
      credential.providerType as BlogProviderTypeName,
      endpoint,
      this.encryption.decrypt(credential.encryptedCredential),
      settings?.defaultTextModel || defaultModel(credential.providerType as BlogProviderTypeName),
      this.urlSecurity,
    );
    return this.withPromptTemplates(adapter, organizationId, promptTemplateVersion);
  }

  async generateStructured<T>(input: StructuredInput) {
    return this.provider.generateStructuredMeasured<T>(
      [
        { role: 'system', content: input.system },
        { role: 'user', content: input.prompt },
      ],
      { schemaName: `blog_${input.stage}`, schema: input.schema },
      input.signal,
    );
  }

  private async withPromptTemplates(
    adapter: { generateStructured<T>(input: StructuredInput): Promise<BlogAiResult<T>> },
    organizationId: string,
    version?: number,
  ) {
    if (!version) return adapter;
    const templates = await this.prisma.blogPromptTemplate.findMany({
      where: { organizationId, version },
    });
    if (!templates.length) throw new BadRequestException('The selected prompt template version no longer exists.');
    const byStage = new Map(templates.map((template) => [template.stage, template]));
    return {
      generateStructured: async <T>(input: StructuredInput) => {
        const template = byStage.get(input.stage);
        if (!template) return adapter.generateStructured<T>(input);
        return adapter.generateStructured<T>({
          ...input,
          system: applyTemplate(template.systemPrompt, 'system', input.system),
          prompt: applyTemplate(template.userPrompt, 'prompt', input.prompt),
        });
      },
    };
  }
}

class CredentialBlogAiAdapter {
  constructor(
    private readonly type: BlogProviderTypeName,
    private readonly endpoint: string,
    private readonly apiKey: string,
    private readonly model: string,
    private readonly urlSecurity: UrlSecurityService,
  ) {}

  async generateStructured<T>(input: StructuredInput): Promise<BlogAiResult<T>> {
    if (this.type === 'TAVILY') {
      throw new BadRequestException('Tavily is a research provider and cannot generate article text.');
    }
    if (this.type === 'GOOGLE') return this.google<T>(input);
    if (this.type === 'ANTHROPIC') return this.anthropic<T>(input);
    return this.openAiCompatible<T>(input);
  }

  private async openAiCompatible<T>(input: StructuredInput): Promise<BlogAiResult<T>> {
    const url = `${this.endpoint.replace(/\/$/, '')}/chat/completions`;
    const data = await this.post(url, {
      model: this.model,
      messages: [
        { role: 'system', content: input.system },
        { role: 'user', content: input.prompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: `blog_${input.stage}`, strict: true, schema: input.schema },
      },
    }, input.signal, { Authorization: `Bearer ${this.apiKey}` });
    const content = data.choices?.[0]?.message?.content;
    return {
      value: parseStructured<T>(content),
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
      model: data.model || this.model,
    };
  }

  private async google<T>(input: StructuredInput): Promise<BlogAiResult<T>> {
    const url = `${this.endpoint.replace(/\/$/, '')}/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    const data = await this.post(url, {
      systemInstruction: { parts: [{ text: input.system }] },
      contents: [{ role: 'user', parts: [{ text: input.prompt }] }],
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: input.schema },
    }, input.signal);
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return {
      value: parseStructured<T>(content),
      inputTokens: data.usageMetadata?.promptTokenCount,
      outputTokens: data.usageMetadata?.candidatesTokenCount,
      model: this.model,
    };
  }

  private async anthropic<T>(input: StructuredInput): Promise<BlogAiResult<T>> {
    const url = `${this.endpoint.replace(/\/$/, '')}/messages`;
    const data = await this.post(url, {
      model: this.model,
      max_tokens: 8192,
      system: `${input.system}\nReturn only JSON matching this JSON Schema: ${JSON.stringify(input.schema)}`,
      messages: [{ role: 'user', content: input.prompt }],
    }, input.signal, { 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' });
    const content = data.content?.find((item: any) => item.type === 'text')?.text;
    return {
      value: parseStructured<T>(content),
      inputTokens: data.usage?.input_tokens,
      outputTokens: data.usage?.output_tokens,
      model: data.model || this.model,
    };
  }

  private async post(
    url: string,
    body: Record<string, unknown>,
    signal?: AbortSignal,
    headers: Record<string, string> = {},
  ) {
    await this.urlSecurity.validateUrl(url);
    try {
      const response = await axios.post(url, body, {
        signal,
        timeout: 90_000,
        maxRedirects: 0,
        maxContentLength: 5 * 1024 * 1024,
        httpAgent: createSafeHttpAgent(),
        httpsAgent: createSafeHttpsAgent(),
        headers: { 'Content-Type': 'application/json', ...headers },
      });
      return response.data;
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.error?.message || error.message
        : error instanceof Error
          ? error.message
          : 'Provider request failed.';
      throw new ServiceUnavailableException(`Selected AI provider failed: ${String(message).slice(0, 500)}`);
    }
  }
}

function parseStructured<T>(value: unknown): T {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ServiceUnavailableException('The AI provider returned no structured output.');
  }
  const normalized = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(normalized) as T;
  } catch {
    throw new ServiceUnavailableException('The AI provider returned invalid structured output.');
  }
}

function defaultModel(type: BlogProviderTypeName) {
  const models: Partial<Record<BlogProviderTypeName, string>> = {
    OPENAI: 'gpt-5-mini',
    GOOGLE: 'gemini-2.5-flash',
    ANTHROPIC: 'claude-sonnet-4-5',
    OPENROUTER: 'openai/gpt-5-mini',
    GROQ: 'openai/gpt-oss-120b',
    XAI: 'grok-4-fast',
    MISTRAL: 'mistral-medium-latest',
    TOGETHER: 'openai/gpt-oss-120b',
    FIREWORKS: 'accounts/fireworks/models/gpt-oss-120b',
    PERPLEXITY: 'sonar-pro',
  };
  return models[type] || 'gpt-5-mini';
}

function applyTemplate(template: string, placeholder: string, original: string) {
  const marker = `{{${placeholder}}}`;
  return template.includes(marker)
    ? template.replaceAll(marker, original)
    : `${template.trim()}\n\n${original}`;
}
