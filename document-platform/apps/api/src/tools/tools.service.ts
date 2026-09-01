import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { SubscriptionPlanTier } from '@prisma/client';

const PLAN_HIERARCHY: Record<SubscriptionPlanTier, number> = {
  [SubscriptionPlanTier.FREE]: 0,
  [SubscriptionPlanTier.PRO]: 1,
  [SubscriptionPlanTier.BUSINESS]: 2,
};

@Injectable()
export class ToolsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all published tools for directory and navigation.
   */
  async getPublishedTools(category?: string, featuredOnly?: boolean) {
    const where: any = { isPublished: true };
    if (category && category !== 'all') {
      where.category = { equals: category, mode: 'insensitive' };
    }
    if (featuredOnly) {
      where.isFeatured = true;
    }

    const tools = await this.prisma.tool.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return tools.map((tool) => ({
      ...tool,
      maxFileSizeBytes: Number(tool.maxFileSizeBytes),
    }));
  }

  /**
   * Get tool details by unique slug.
   */
  async getToolBySlug(slug: string) {
    const tool = await this.prisma.tool.findUnique({
      where: { slug: slug.toLowerCase() },
    });

    if (!tool || !tool.isPublished) {
      throw new NotFoundException(`Tool '${slug}' not found or unavailable.`);
    }

    return {
      ...tool,
      maxFileSizeBytes: Number(tool.maxFileSizeBytes),
    };
  }

  /**
   * Get distinct categories with tool counts.
   */
  async getCategories() {
    const tools = await this.prisma.tool.findMany({
      where: { isPublished: true },
      select: { category: true },
    });

    const categoryMap: Record<string, number> = {};
    for (const t of tools) {
      categoryMap[t.category] = (categoryMap[t.category] || 0) + 1;
    }

    return Object.entries(categoryMap).map(([category, count]) => ({
      category,
      count,
    }));
  }

  /**
   * Server-authoritative validation before job execution.
   */
  async validateToolExecution(
    toolSlug: string,
    userTier: SubscriptionPlanTier | null,
    fileSizeBytes: number,
    inputFormat: string,
  ) {
    const tool = await this.getToolBySlug(toolSlug);

    // 1. Check anonymous support if not logged in
    if (!userTier && !tool.anonymousEnabled) {
      throw new ForbiddenException(
        `Tool '${tool.name}' requires at least a Free registered account.`,
      );
    }

    // 2. Check minimum subscription tier
    // Anonymous visitors receive FREE-tier tool access only when the tool
    // explicitly opts in via anonymousEnabled.
    const userRank = userTier ? PLAN_HIERARCHY[userTier] : PLAN_HIERARCHY.FREE;
    const requiredRank = PLAN_HIERARCHY[tool.minimumPlan];
    if (userRank < requiredRank) {
      throw new ForbiddenException(
        `Tool '${tool.name}' requires the ${tool.minimumPlan} plan or higher. Please upgrade to access.`,
      );
    }

    // 3. Validate accepted input format
    const normalizedFormat = inputFormat.toLowerCase().trim();
    if (
      tool.acceptedFormats.length > 0 &&
      !tool.acceptedFormats.includes(normalizedFormat) &&
      !tool.acceptedFormats.includes('*')
    ) {
      throw new BadRequestException(
        `Unsupported input format '${inputFormat}' for ${tool.name}. Allowed: [${tool.acceptedFormats.join(', ')}]`,
      );
    }

    // 4. Validate file size against tool limit
    if (fileSizeBytes > tool.maxFileSizeBytes) {
      const maxMb = Math.round(tool.maxFileSizeBytes / (1024 * 1024));
      throw new BadRequestException(
        `File exceeds the maximum allowed size of ${maxMb}MB for this tool.`,
      );
    }

    return tool;
  }
}
