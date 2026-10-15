import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  DOCUMENT_TYPES,
  INDIA_STATES,
  isCurrencyCode,
  isEuCountry,
  validateEuVatId,
  validateGstin,
  validatePattern,
} from '@docconv/invoice-engine';
import { LABEL_KEYS, TEMPLATES, canonicalLanguage } from '@docconv/invoice-templates';
import { PrismaService } from '../common/prisma.service';
import { FilesService } from '../files/files.service';
import { SaasEntitlementsService } from '../saas-plans/saas-entitlements.service';
import { BusinessDto } from './invoicing.dto';
import { INVOICE_STUDIO_SLUG, InvoicingAccessService, defaultsForCountry } from './invoicing.common';

@Injectable()
export class BusinessesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: InvoicingAccessService,
    private readonly entitlements: SaasEntitlementsService,
    private readonly files: FilesService,
  ) {}

  list(organizationId: string) {
    return this.prisma.invBusiness.findMany({
      where: { organizationId, archivedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  async get(organizationId: string, id: string) {
    const business = await this.prisma.invBusiness.findFirst({ where: { id, organizationId, archivedAt: null } });
    if (!business) throw new NotFoundException('Business not found.');
    return business;
  }

  async create(userId: string, organizationId: string, dto: BusinessDto) {
    await this.access.assertCanManage(userId, organizationId);
    if (!dto.name?.trim() || !dto.country) throw new BadRequestException('Business name and country are required.');
    const count = await this.prisma.invBusiness.count({ where: { organizationId, archivedAt: null } });
    await this.entitlements.assertCountBelowLimit(organizationId, INVOICE_STUDIO_SLUG, 'businesses', count, 'Businesses');

    const defaults = defaultsForCountry(dto.country);
    const data = this.normalize({ ...defaults, ...stripUndefined(dto) } as BusinessDto);
    return this.prisma.$transaction(async (tx) => {
      const business = await tx.invBusiness.create({ data: { ...data, organizationId } as Prisma.InvBusinessUncheckedCreateInput });
      // Every workspace starts with one stock location.
      const warehouses = await tx.invWarehouse.count({ where: { organizationId, archivedAt: null } });
      if (warehouses === 0) {
        await tx.invWarehouse.create({
          data: { organizationId, businessId: business.id, name: 'Main warehouse', isDefault: true },
        });
      }
      await tx.auditLog.create({
        data: { organizationId, userId, action: 'INV_BUSINESS_CREATED', resourceType: 'InvBusiness', resourceId: business.id },
      });
      return business;
    });
  }

  async update(userId: string, organizationId: string, id: string, dto: BusinessDto) {
    await this.access.assertCanManage(userId, organizationId);
    const current = await this.get(organizationId, id);
    const merged = {
      ...current,
      address: current.addressJson,
      bank: current.bankJson,
      numbering: current.numberingJson,
      labelOverrides: current.labelOverridesJson,
      reminderDays: current.reminderDaysJson,
      ...stripUndefined(dto),
    } as unknown as BusinessDto;
    const data = this.normalize(merged);
    return this.prisma.invBusiness.update({ where: { id }, data });
  }

  async archive(userId: string, organizationId: string, id: string) {
    await this.access.assertCanManage(userId, organizationId);
    await this.get(organizationId, id);
    return this.prisma.invBusiness.update({ where: { id }, data: { archivedAt: new Date() } });
  }

  async setImage(userId: string, organizationId: string, id: string, kind: 'logo' | 'signature', buffer: Buffer) {
    await this.access.assertCanManage(userId, organizationId);
    const business = await this.get(organizationId, id);
    const stored = await this.files.storeBrandingImage(organizationId, userId, buffer);
    const field = kind === 'logo' ? 'logoStorageKey' : 'signatureStorageKey';
    const previous = business[field];
    const updated = await this.prisma.invBusiness.update({ where: { id }, data: { [field]: stored.storageKey } });
    if (previous) await this.files.deleteGeneratedAsset(previous).catch(() => undefined);
    return updated;
  }

  /** Validates and converts a business DTO into columns. */
  private normalize(dto: BusinessDto) {
    const country = dto.country!.toUpperCase();
    const regime = dto.taxRegime ?? 'GENERIC';
    if (regime === 'IN_GST') {
      if (country !== 'IN') throw new BadRequestException('GST applies to businesses in India.');
      if (!dto.stateCode || !INDIA_STATES[dto.stateCode]) throw new BadRequestException('Choose the GST state of the business.');
      if (dto.taxId) {
        const check = validateGstin(dto.taxId, dto.stateCode);
        if (!check.valid) throw new BadRequestException(check.reason);
        dto.taxId = check.normalized;
      }
    } else if (regime === 'EU_VAT') {
      if (!isEuCountry(country)) throw new BadRequestException('EU VAT applies to businesses in an EU country.');
      if (dto.taxId) {
        const check = validateEuVatId(dto.taxId, country);
        if (!check.valid) throw new BadRequestException(check.reason);
        dto.taxId = check.normalized;
      }
    }
    if (!dto.currency || !isCurrencyCode(dto.currency)) throw new BadRequestException('Choose a valid currency.');
    const language = safeLanguage(dto.language ?? 'en');
    const secondaryLanguage = dto.secondaryLanguage ? safeLanguage(dto.secondaryLanguage) : null;
    if (dto.template && !TEMPLATES[dto.template]) throw new BadRequestException('Unknown template.');

    const numbering: Record<string, string> = {};
    for (const [type, pattern] of Object.entries(dto.numbering ?? {})) {
      if (!DOCUMENT_TYPES[type]) throw new BadRequestException(`Unknown document type ${type}.`);
      if (typeof pattern !== 'string' || pattern.length > 40) throw new BadRequestException(`Invalid pattern for ${type}.`);
      const problem = validatePattern(pattern);
      if (problem) throw new BadRequestException(`${type}: ${problem}`);
      numbering[type] = pattern;
    }
    const labelOverrides: Record<string, string> = {};
    for (const [key, value] of Object.entries(dto.labelOverrides ?? {})) {
      if (key.includes(':')) {
        // Per-language overrides: "hi:doc.taxInvoice".
        const [lang, label] = key.split(':');
        if (!lang || !label || !LABEL_KEYS.includes(label as never)) continue;
        safeLanguage(lang);
      } else if (!LABEL_KEYS.includes(key as never)) {
        continue;
      }
      if (typeof value === 'string' && value.trim()) labelOverrides[key] = value.trim().slice(0, 300);
    }

    const data = {
      name: dto.name!.trim(),
      legalName: dto.legalName?.trim() || null,
      country,
      stateCode: regime === 'IN_GST' ? dto.stateCode! : (dto.stateCode ?? null),
      addressJson: (dto.address ?? {}) as Prisma.InputJsonValue,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      website: dto.website ?? null,
      taxRegime: regime,
      taxId: dto.taxId?.trim() || null,
      gstComposition: regime === 'IN_GST' ? Boolean(dto.gstComposition) : false,
      currency: dto.currency,
      language,
      secondaryLanguage,
      template: dto.template ?? 'classic',
      accentColor: dto.accentColor ?? null,
      bankJson: (dto.bank ?? {}) as Prisma.InputJsonValue,
      paymentQr: dto.paymentQr ?? 'none',
      pricesIncludeTax: Boolean(dto.pricesIncludeTax),
      roundOffTotal: Boolean(dto.roundOffTotal),
      negativeStockPolicy: dto.negativeStockPolicy ?? 'BLOCK',
      fyStartMonth: dto.fyStartMonth ?? 1,
      numberingJson: numbering as Prisma.InputJsonValue,
      labelOverridesJson: labelOverrides as Prisma.InputJsonValue,
      defaultNotes: dto.defaultNotes ?? null,
      defaultTerms: dto.defaultTerms ?? null,
      defaultDueDays: dto.defaultDueDays ?? 15,
      reminderDaysJson: [...new Set(dto.reminderDays ?? [3, 10])].sort((a, b) => a - b) as Prisma.InputJsonValue,
      lowStockAlerts: dto.lowStockAlerts ?? true,
    };
    return data;
  }
}

function safeLanguage(tag: string) {
  try {
    return canonicalLanguage(tag);
  } catch {
    throw new BadRequestException(`"${tag}" is not a language code (e.g. en, hi, de, pt-BR).`);
  }
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}
