import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UpdateBlogStudioSettingsDto, CreatePromptTemplateDto } from './blog-studio.dto';

@Injectable()
export class BlogSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Settings ───────────────────────────────────────────────

  async getSettings(organizationId: string) {
    let settings = await this.prisma.blogStudioSetting.findUnique({
      where: { organizationId },
    });

    if (!settings) {
      // Create default settings if they don't exist
      settings = await this.prisma.blogStudioSetting.create({
        data: {
          organizationId,
          defaultTextModel: 'gpt-5-mini',
          defaultImageModel: 'gpt-image-1',
          enableModelDiscovery: true,
          settingsJson: { aiProvider: 'openai', imageProvider: 'openai' },
        },
      });
    }

    return settings;
  }

  async updateSettings(organizationId: string, dto: UpdateBlogStudioSettingsDto) {
    // Ensure settings exist first
    await this.getSettings(organizationId);

    const updateData: any = {};
    if (dto.defaultTextModel !== undefined) updateData.defaultTextModel = dto.defaultTextModel;
    if (dto.defaultImageModel !== undefined) updateData.defaultImageModel = dto.defaultImageModel;
    if (dto.defaultSearchProvider !== undefined) updateData.defaultSearchProvider = dto.defaultSearchProvider;
    if (dto.deepResearchProvider !== undefined) updateData.deepResearchProvider = dto.deepResearchProvider;
    if (dto.enableModelDiscovery !== undefined) updateData.enableModelDiscovery = dto.enableModelDiscovery;
    
    if (dto.settingsJson !== undefined) {
      const current = (await this.getSettings(organizationId)).settingsJson as Record<string, unknown> || {};
      updateData.settingsJson = { ...current, ...dto.settingsJson };
    }

    return this.prisma.blogStudioSetting.update({
      where: { organizationId },
      data: updateData,
    });
  }

  // ─── Prompt Templates ───────────────────────────────────────

  async listPromptTemplates(organizationId: string, stage?: string) {
    const where: any = { organizationId };
    if (stage) {
      where.stage = stage;
    }

    return this.prisma.blogPromptTemplate.findMany({
      where,
      orderBy: [
        { isDefault: 'desc' },
        { version: 'desc' }
      ],
    });
  }

  async getPromptTemplate(organizationId: string, templateId: string) {
    const template = await this.prisma.blogPromptTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template || template.organizationId !== organizationId) {
      throw new NotFoundException('Prompt template not found');
    }

    return template;
  }

  async createPromptTemplate(organizationId: string, userId: string, dto: CreatePromptTemplateDto) {
    // Find the current max version for this stage
    const latest = await this.prisma.blogPromptTemplate.findFirst({
      where: { organizationId, stage: dto.stage },
      orderBy: { version: 'desc' },
    });

    const newVersion = latest ? latest.version + 1 : 1;

    // If this is set as default, unset previous defaults for this stage
    if (dto.isDefault) {
      await this.prisma.blogPromptTemplate.updateMany({
        where: { organizationId, stage: dto.stage, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.blogPromptTemplate.create({
      data: {
        organizationId,
        
        stage: dto.stage,
        name: dto.name,
        version: newVersion,
        systemPrompt: dto.systemPrompt,
        userPrompt: dto.userPrompt,
        isDefault: dto.isDefault ?? false,
      }
    });
  }
}
