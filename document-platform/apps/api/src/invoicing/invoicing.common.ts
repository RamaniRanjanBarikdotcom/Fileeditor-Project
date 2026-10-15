import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { isEuCountry } from '@docconv/invoice-engine';
import { PrismaService } from '../common/prisma.service';

export { INVOICE_STUDIO_SLUG } from '../saas-plans/saas-products';

export type Address = { line1?: string; line2?: string; city?: string; postalCode?: string; region?: string };

/** EU members whose currency is not the euro (Bulgaria adopted the euro in 2026). */
const EU_NON_EURO: Record<string, string> = { CZ: 'CZK', DK: 'DKK', HU: 'HUF', PL: 'PLN', RO: 'RON', SE: 'SEK' };

/** Sensible starting settings for a new business in a country. */
export function defaultsForCountry(country: string) {
  if (country === 'IN') {
    return {
      taxRegime: 'IN_GST',
      currency: 'INR',
      fyStartMonth: 4,
      roundOffTotal: true,
      template: 'gst-detailed',
      paymentQr: 'upi',
      language: 'en',
    };
  }
  if (isEuCountry(country)) {
    return {
      taxRegime: 'EU_VAT',
      currency: EU_NON_EURO[country] ?? 'EUR',
      fyStartMonth: 1,
      roundOffTotal: false,
      template: 'eu-vat',
      paymentQr: EU_NON_EURO[country] ? 'none' : 'sepa',
      language: 'en',
    };
  }
  return {
    taxRegime: 'GENERIC',
    currency: 'USD',
    fyStartMonth: 1,
    roundOffTotal: false,
    template: 'classic',
    paymentQr: 'none',
    language: 'en',
  };
}

export function addressLines(value: unknown): string[] {
  const address = (value && typeof value === 'object' ? value : {}) as Address;
  const cityLine = [address.city, address.postalCode].filter(Boolean).join(' ');
  return [address.line1, address.line2, cityLine, address.region].filter((line): line is string => Boolean(line));
}

/** "2026-10-15" → Date at UTC midnight (for @db.Date columns). */
export function dateOnly(value: string): Date {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new BadRequestException(`Invalid date: ${value}`);
  return date;
}

export function isoDate(value: Date | null | undefined): string | undefined {
  return value ? value.toISOString().slice(0, 10) : undefined;
}

export function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 86_400_000);
}

/**
 * Release-1 roles from organization membership:
 * OWNER / ADMIN manage settings and void documents; MEMBER creates, issues
 * and manages stock; VIEWER reads only.
 */
@Injectable()
export class InvoicingAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async role(userId: string, organizationId: string): Promise<OrgRole> {
    const membership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { role: true },
    });
    if (!membership) throw new NotFoundException('The requested workspace was not found.');
    return membership.role;
  }

  async assertCanWrite(userId: string, organizationId: string) {
    const role = await this.role(userId, organizationId);
    if (role === OrgRole.VIEWER) throw new ForbiddenException('Viewers cannot change documents or stock.');
    return role;
  }

  async assertCanManage(userId: string, organizationId: string) {
    const role = await this.role(userId, organizationId);
    if (role !== OrgRole.OWNER && role !== OrgRole.ADMIN) {
      throw new ForbiddenException('Only workspace owners and admins can do this.');
    }
    return role;
  }
}
