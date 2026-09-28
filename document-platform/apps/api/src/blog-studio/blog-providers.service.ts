import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { EncryptionService } from './encryption.service';
import { CreateBlogProviderDto, UpdateBlogProviderDto } from './blog-studio.dto';
import { 
  defaultProviderEndpoint,
  isBlogGenerationModel,
  maskApiKey, 
  normalizeProviderModelId,
  isValidProviderType 
} from '@docconv/blog-engine';
import type { BlogProviderType } from '@prisma/client';
import type { BlogProviderTypeName, ProviderConnectionTestResult } from '@docconv/blog-engine';
import {
  UrlSecurityService,
  createSafeHttpAgent,
  createSafeHttpsAgent,
} from '@docconv/url-security';
import axios from 'axios';

@Injectable()
export class BlogProvidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly urlSecurity: UrlSecurityService,
  ) {}

  async listProviders(organizationId: string) {
    const providers = await this.prisma.blogProviderCredential.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });

    return providers.map((p: any) => ({
      id: p.id,
      providerType: p.providerType,
      label: p.label,
      maskedIdentifier: p.maskedIdentifier,
      customEndpoint: p.customEndpoint,
      isActive: p.isActive,
      lastTestedAt: p.lastTestedAt,
      lastTestSuccess: p.lastTestSuccess,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }

  async createProvider(organizationId: string, dto: CreateBlogProviderDto) {
    if (!isValidProviderType(dto.providerType)) {
      throw new BadRequestException(`Invalid provider type: ${dto.providerType}`);
    }
    if (dto.customEndpoint) await this.urlSecurity.validateUrl(dto.customEndpoint);

    const existing = await this.prisma.blogProviderCredential.findUnique({
      where: {
        organizationId_providerType_label: {
          organizationId,
          providerType: dto.providerType as BlogProviderType,
          label: dto.label,
        }
      }
    });

    if (existing) {
      throw new BadRequestException('A provider with this type and label already exists.');
    }

    // Encrypt the API key
    const encryptedCredential = this.encryption.encrypt(dto.apiKey);
    const maskedIdentifier = maskApiKey(dto.apiKey);

    // Initial connection test
    const testResult = await this.testConnection({
      type: dto.providerType,
      label: dto.label,
      apiKey: dto.apiKey,
      endpoint: dto.customEndpoint,
    });

    const provider = await this.prisma.blogProviderCredential.create({
      data: {
        organizationId,
        providerType: dto.providerType as BlogProviderType,
        label: dto.label,
        maskedIdentifier,
        encryptedCredential,
        customEndpoint: dto.customEndpoint,
        isActive: true,
        lastTestedAt: new Date(),
        lastTestSuccess: testResult.success,
      },
    });

    return {
      provider: {
        id: provider.id,
        providerType: provider.providerType,
        label: provider.label,
        maskedIdentifier: provider.maskedIdentifier,
        customEndpoint: provider.customEndpoint,
        isActive: provider.isActive,
        lastTestedAt: provider.lastTestedAt,
        lastTestSuccess: provider.lastTestSuccess,
      },
      testResult,
    };
  }

  async getProvider(organizationId: string, providerId: string) {
    const provider = await this.prisma.blogProviderCredential.findUnique({
      where: { id: providerId },
    });

    if (!provider || provider.organizationId !== organizationId) {
      throw new NotFoundException('Provider not found');
    }

    return provider;
  }

  async updateProvider(organizationId: string, providerId: string, dto: UpdateBlogProviderDto) {
    const provider = await this.getProvider(organizationId, providerId);
    if (dto.customEndpoint) await this.urlSecurity.validateUrl(dto.customEndpoint);

    const updateData: any = {};
    let apiKeyToTest = this.encryption.decrypt(provider.encryptedCredential);

    if (dto.label && dto.label !== provider.label) {
      updateData.label = dto.label;
    }

    if (dto.apiKey) {
      updateData.encryptedCredential = this.encryption.encrypt(dto.apiKey);
      updateData.maskedIdentifier = maskApiKey(dto.apiKey);
      apiKeyToTest = dto.apiKey;
    }

    if (dto.customEndpoint !== undefined) {
      updateData.customEndpoint = dto.customEndpoint;
    }

    if (dto.isActive !== undefined) {
      updateData.isActive = dto.isActive;
    }

    // Retest if credentials or endpoint changed
    let testResult;
    if (dto.apiKey || dto.customEndpoint !== undefined) {
      testResult = await this.testConnection({
        type: provider.providerType as any,
        label: updateData.label || provider.label,
        apiKey: apiKeyToTest,
        endpoint: updateData.customEndpoint !== undefined ? updateData.customEndpoint : provider.customEndpoint,
      });
      updateData.lastTestedAt = new Date();
      updateData.lastTestSuccess = testResult.success;
    }

    const updated = await this.prisma.blogProviderCredential.update({
      where: { id: providerId },
      data: updateData,
    });

    return {
      provider: {
        id: updated.id,
        providerType: updated.providerType,
        label: updated.label,
        maskedIdentifier: updated.maskedIdentifier,
        customEndpoint: updated.customEndpoint,
        isActive: updated.isActive,
        lastTestedAt: updated.lastTestedAt,
        lastTestSuccess: updated.lastTestSuccess,
      },
      testResult,
    };
  }

  async deleteProvider(organizationId: string, providerId: string) {
    await this.getProvider(organizationId, providerId); // Ensure it exists and belongs to org
    
    await this.prisma.blogProviderCredential.delete({
      where: { id: providerId },
    });
    
    return { success: true };
  }

  async testProvider(organizationId: string, providerId: string) {
    const provider = await this.getProvider(organizationId, providerId);
    if (provider.customEndpoint) await this.urlSecurity.validateUrl(provider.customEndpoint);
    const testResult = await this.testConnection({
      type: provider.providerType as any,
      label: provider.label,
      apiKey: this.encryption.decrypt(provider.encryptedCredential),
      endpoint: provider.customEndpoint || undefined,
    });
    await this.prisma.blogProviderCredential.update({
      where: { id: provider.id },
      data: { lastTestedAt: new Date(), lastTestSuccess: testResult.success },
    });
    return testResult;
  }

  private async testConnection(config: {
    type: BlogProviderTypeName;
    label: string;
    apiKey: string;
    endpoint?: string;
  }): Promise<ProviderConnectionTestResult> {
    const endpoint = config.endpoint || defaultProviderEndpoint(config.type);
    if (!endpoint) return { success: false, latencyMs: 0, errorMessage: 'No endpoint configured.' };
    const modelsUrl = config.type === 'TAVILY'
      ? `${endpoint.replace(/\/+$/, '')}/search`
      : `${endpoint.replace(/\/+$/, '')}/models`;
    await this.urlSecurity.validateUrl(modelsUrl);
    const startedAt = performance.now();
    const headers: Record<string, string> = { Authorization: `Bearer ${config.apiKey}` };
    if (config.type === 'ANTHROPIC') {
      delete headers.Authorization;
      headers['x-api-key'] = config.apiKey;
      headers['anthropic-version'] = '2023-06-01';
    }
    try {
      const common = {
        timeout: 10_000,
        maxRedirects: 0,
        maxContentLength: 2 * 1024 * 1024,
        httpAgent: createSafeHttpAgent(),
        httpsAgent: createSafeHttpsAgent(),
        validateStatus: () => true,
      };
      const response = config.type === 'TAVILY'
        ? await axios.post(modelsUrl, { api_key: config.apiKey, query: 'connection test', max_results: 1 }, { ...common, headers: { 'Content-Type': 'application/json' } })
        : await axios.get(config.type === 'GOOGLE' ? `${modelsUrl}?key=${encodeURIComponent(config.apiKey)}` : modelsUrl, {
            ...common,
            headers: config.type === 'GOOGLE' ? {} : headers,
          });
      const latencyMs = Math.round(performance.now() - startedAt);
      if (response.status < 200 || response.status >= 300) {
        return { success: false, latencyMs, errorMessage: `HTTP ${response.status}: provider rejected the connection test` };
      }
      const entries = Array.isArray(response.data?.data)
        ? response.data.data
        : Array.isArray(response.data?.models)
          ? response.data.models
          : [];
      const models = entries
        .map((model: any) => ({
          ...model,
          normalizedId: normalizeProviderModelId(
            config.type,
            String(model.id || model.name || ''),
          ),
        }))
        .filter((model: any) => {
          if (!model.normalizedId) return false;
          if (
            config.type === 'GOOGLE' &&
            Array.isArray(model.supportedGenerationMethods) &&
            !model.supportedGenerationMethods.includes('generateContent')
          ) {
            return false;
          }
          return isBlogGenerationModel(model.normalizedId);
        });
      return {
        success: true,
        latencyMs,
        models: models.slice(0, 250).map((model: any) => ({
          id: model.normalizedId,
          name: String(model.displayName || model.normalizedId),
          supportsStructuredOutput: Boolean(
            model.supportsStructuredOutput || model.capabilities?.structured_outputs,
          ),
          supportsImages: Boolean(
            model.supportsImages || model.capabilities?.vision || model.input_modalities?.includes?.('image'),
          ),
        })),
      };
    } catch (error) {
      return {
        success: false,
        latencyMs: Math.round(performance.now() - startedAt),
        errorMessage: axios.isAxiosError(error) ? error.message : 'Connection failed',
      };
    }
  }
}
