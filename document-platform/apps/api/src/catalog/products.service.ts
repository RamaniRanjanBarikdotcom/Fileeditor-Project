import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ProductType, CurrencyCode, PaymentProvider } from '@prisma/client';

export interface CreateProductDto {
  slug: string;
  name: string;
  tagline?: string;
  description: string;
  type: ProductType;
  isPublished?: boolean;
  isFeatured?: boolean;
  sortOrder?: number;
  metadataJson?: Record<string, unknown>;
  prices: {
    currency: CurrencyCode;
    amountMinorUnits: number;
    provider: PaymentProvider;
    providerPriceId?: string;
  }[];
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all published products with active prices and current releases.
   */
  async getPublishedProducts(type?: ProductType) {
    const where: any = { isPublished: true };
    if (type) {
      where.type = type;
    }

    const products = await this.prisma.product.findMany({
      where,
      include: {
        prices: {
          where: { isActive: true },
        },
        releases: {
          where: { isCurrent: true },
          take: 1,
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    return products.map((p) => ({
      ...p,
      currentRelease: p.releases[0]
        ? {
            ...p.releases[0],
            fileSizeBytes: Number(p.releases[0].fileSizeBytes),
          }
        : null,
      releases: undefined,
    }));
  }

  /**
   * Get product by unique slug.
   */
  async getProductBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug: slug.toLowerCase() },
      include: {
        prices: {
          where: { isActive: true },
        },
        releases: {
          where: { isCurrent: true },
          take: 1,
        },
      },
    });

    if (!product || !product.isPublished) {
      throw new NotFoundException(`Product '${slug}' not found.`);
    }

    return {
      ...product,
      currentRelease: product.releases[0]
        ? {
            ...product.releases[0],
            fileSizeBytes: Number(product.releases[0].fileSizeBytes),
          }
        : null,
      releases: undefined,
    };
  }

  /**
   * Admin: Create a new product with prices.
   */
  async createProduct(dto: CreateProductDto) {
    const existing = await this.prisma.product.findUnique({
      where: { slug: dto.slug.toLowerCase() },
    });
    if (existing) {
      throw new BadRequestException(`Product with slug '${dto.slug}' already exists.`);
    }

    return this.prisma.product.create({
      data: {
        slug: dto.slug.toLowerCase().trim(),
        name: dto.name.trim(),
        tagline: dto.tagline?.trim(),
        description: dto.description,
        type: dto.type,
        isPublished: dto.isPublished ?? true,
        isFeatured: dto.isFeatured ?? false,
        sortOrder: dto.sortOrder ?? 0,
        metadataJson: (dto.metadataJson as any) || undefined,
        prices: {
          create: dto.prices.map((pr) => ({
            currency: pr.currency,
            amountMinorUnits: pr.amountMinorUnits,
            provider: pr.provider,
            providerPriceId: pr.providerPriceId,
          })),
        },
      },
      include: { prices: true },
    });
  }
}
