import { BadRequestException, ConflictException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Prisma } from '@prisma/client';
import {
  Dec,
  INDIA_STATES,
  isCurrencyCode,
  isEuCountry,
  validateEuVatId,
  validateGstin,
} from '@docconv/invoice-engine';
import { canonicalLanguage } from '@docconv/invoice-templates';
import { PrismaService } from '../common/prisma.service';
import { SaasEntitlementsService } from '../saas-plans/saas-entitlements.service';
import { ContactDto, ItemDto } from './invoicing.dto';
import { INVOICE_STUDIO_SLUG, InvoicingAccessService } from './invoicing.common';
import { MAX_IMPORT_ROWS, csvRecords, toCsv } from './csv';

type ImportResult = { created: number; updated: number; errors: Array<{ row: number; message: string }> };

/** Validates a CSV row with the same DTO rules as the API forms. */
async function validRow<T extends object>(type: new () => T, value: Record<string, unknown>): Promise<T> {
  const dto = plainToInstance(type, value);
  const problems = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  if (problems.length) {
    throw new BadRequestException(problems.flatMap((problem) => Object.values(problem.constraints ?? {})).join('; '));
  }
  return dto;
}

function yes(value: string | undefined) {
  return /^(y|yes|true|1)$/i.test(value ?? '');
}

function importText(buffer: Buffer) {
  if (buffer.length > 2 * 1024 * 1024) throw new BadRequestException('CSV files must be smaller than 2 MB.');
  const records = csvRecords(buffer.toString('utf8'));
  if (!records.length) throw new BadRequestException('The CSV file has no rows.');
  if (records.length > MAX_IMPORT_ROWS) throw new BadRequestException(`Import at most ${MAX_IMPORT_ROWS} rows at a time.`);
  return records;
}

const rowError = (error: unknown) =>
  error instanceof HttpException ? String((error.getResponse() as { message?: string })?.message ?? error.message) : (error as Error).message;

const PAGE_SIZE = 50;

function page(value?: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

/** Case-insensitive "contains" search on a few text columns. */
function search(term: string | undefined, fields: string[]) {
  const text = term?.trim().slice(0, 100);
  return text ? { OR: fields.map((field) => ({ [field]: { contains: text, mode: 'insensitive' as const } })) } : {};
}

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: InvoicingAccessService,
  ) {}

  async list(organizationId: string, query: { q?: string; type?: string; page?: string }) {
    const where: Prisma.InvContactWhereInput = {
      organizationId,
      archivedAt: null,
      ...(query.type === 'customer' ? { isCustomer: true } : query.type === 'supplier' ? { isSupplier: true } : {}),
      ...search(query.q, ['name', 'legalName', 'email', 'taxId', 'phone']),
    };
    const current = page(query.page);
    const [items, total] = await Promise.all([
      this.prisma.invContact.findMany({ where, orderBy: { name: 'asc' }, skip: (current - 1) * PAGE_SIZE, take: PAGE_SIZE }),
      this.prisma.invContact.count({ where }),
    ]);
    return { items, total, page: current, pageSize: PAGE_SIZE };
  }

  async get(organizationId: string, id: string) {
    const contact = await this.prisma.invContact.findFirst({ where: { id, organizationId } });
    if (!contact) throw new NotFoundException('Contact not found.');
    return contact;
  }

  async create(userId: string, organizationId: string, dto: ContactDto) {
    await this.access.assertCanWrite(userId, organizationId);
    if (!dto.name?.trim() || !dto.country) throw new BadRequestException('Name and country are required.');
    return this.prisma.invContact.create({ data: { organizationId, ...this.normalize(dto) } });
  }

  async update(userId: string, organizationId: string, id: string, dto: ContactDto) {
    await this.access.assertCanWrite(userId, organizationId);
    const current = await this.get(organizationId, id);
    const merged: ContactDto = {
      isCustomer: current.isCustomer,
      isSupplier: current.isSupplier,
      name: current.name,
      legalName: current.legalName ?? undefined,
      email: current.email ?? undefined,
      phone: current.phone ?? undefined,
      country: current.country,
      stateCode: current.stateCode,
      billingAddress: current.billingAddressJson as ContactDto['billingAddress'],
      shippingAddress: current.shippingAddressJson as ContactDto['shippingAddress'],
      taxId: current.taxId,
      isBusiness: current.isBusiness,
      isSez: current.isSez,
      currency: current.currency,
      language: current.language,
      paymentTermsDays: current.paymentTermsDays,
      notes: current.notes,
      ...Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined)),
    };
    return this.prisma.invContact.update({ where: { id }, data: this.normalize(merged) });
  }

  async archive(userId: string, organizationId: string, id: string) {
    await this.access.assertCanWrite(userId, organizationId);
    await this.get(organizationId, id);
    return this.prisma.invContact.update({ where: { id }, data: { archivedAt: new Date() } });
  }

  static readonly CSV_HEADER = ['name', 'type', 'country', 'state_code', 'tax_id', 'email', 'phone', 'address', 'city', 'postal_code', 'payment_terms_days'];

  async exportCsv(organizationId: string) {
    const contacts = await this.prisma.invContact.findMany({ where: { organizationId, archivedAt: null }, orderBy: { name: 'asc' } });
    return toCsv(
      ContactsService.CSV_HEADER,
      contacts.map((contact) => {
        const address = contact.billingAddressJson as Record<string, string>;
        return [
          contact.name, contact.isCustomer && contact.isSupplier ? 'both' : contact.isSupplier ? 'supplier' : 'customer',
          contact.country, contact.stateCode, contact.taxId, contact.email, contact.phone, address.line1, address.city, address.postalCode, contact.paymentTermsDays,
        ];
      }),
    );
  }

  /** Adds contacts from CSV; existing contacts with the same tax ID are updated. */
  async importCsv(userId: string, organizationId: string, buffer: Buffer): Promise<ImportResult> {
    await this.access.assertCanWrite(userId, organizationId);
    const result: ImportResult = { created: 0, updated: 0, errors: [] };
    for (const [index, row] of importText(buffer).entries()) {
      try {
        const type = (row.type || 'customer').toLowerCase();
        const dto = await validRow(ContactDto, {
          name: row.name || undefined,
          isCustomer: type !== 'supplier',
          isSupplier: type === 'supplier' || type === 'both',
          country: (row.country || '').toUpperCase() || undefined,
          stateCode: row.state_code ? row.state_code.padStart(2, '0') : undefined,
          taxId: row.tax_id || undefined,
          email: row.email || undefined,
          phone: row.phone || undefined,
          billingAddress: { line1: row.address || undefined, city: row.city || undefined, postalCode: row.postal_code || undefined },
          paymentTermsDays: row.payment_terms_days ? Number(row.payment_terms_days) : undefined,
        });
        const existing = dto.taxId
          ? await this.prisma.invContact.findFirst({ where: { organizationId, archivedAt: null, taxId: dto.taxId.toUpperCase().replace(/\s+/g, '') } })
          : null;
        if (existing) {
          await this.update(userId, organizationId, existing.id, dto);
          result.updated += 1;
        } else {
          await this.create(userId, organizationId, dto);
          result.created += 1;
        }
      } catch (error) {
        result.errors.push({ row: index + 2, message: rowError(error) });
      }
    }
    return result;
  }

  private normalize(dto: ContactDto) {
    const country = dto.country!.toUpperCase();
    let taxId = dto.taxId?.trim() || null;
    if (country === 'IN') {
      if (dto.stateCode && !INDIA_STATES[dto.stateCode]) throw new BadRequestException('Unknown GST state code.');
      if (taxId) {
        const check = validateGstin(taxId, dto.stateCode ?? undefined);
        if (!check.valid) throw new BadRequestException(check.reason);
        taxId = check.normalized;
      }
    } else if (isEuCountry(country) && taxId) {
      const check = validateEuVatId(taxId, country);
      if (!check.valid) throw new BadRequestException(check.reason);
      taxId = check.normalized;
    }
    if (dto.currency && !isCurrencyCode(dto.currency)) throw new BadRequestException('Choose a valid currency.');
    let language: string | null = null;
    if (dto.language) {
      try {
        language = canonicalLanguage(dto.language);
      } catch {
        throw new BadRequestException('Invalid language code.');
      }
    }
    if (dto.isCustomer === false && !dto.isSupplier) throw new BadRequestException('A contact must be a customer, a supplier or both.');
    return {
      isCustomer: dto.isCustomer ?? true,
      isSupplier: dto.isSupplier ?? false,
      name: dto.name!.trim(),
      legalName: dto.legalName?.trim() || null,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      country,
      stateCode: country === 'IN' ? (dto.stateCode ?? null) : null,
      billingAddressJson: (dto.billingAddress ?? {}) as Prisma.InputJsonValue,
      shippingAddressJson: dto.shippingAddress ? (dto.shippingAddress as Prisma.InputJsonValue) : Prisma.JsonNull,
      taxId,
      isBusiness: dto.isBusiness ?? Boolean(taxId),
      isSez: country === 'IN' ? Boolean(dto.isSez) : false,
      currency: dto.currency ?? null,
      language,
      paymentTermsDays: dto.paymentTermsDays ?? null,
      notes: dto.notes ?? null,
    };
  }
}

@Injectable()
export class ItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: InvoicingAccessService,
    private readonly entitlements: SaasEntitlementsService,
  ) {}

  async list(organizationId: string, query: { q?: string; kind?: string; page?: string; lowStock?: string }) {
    const where: Prisma.InvItemWhereInput = {
      organizationId,
      archivedAt: null,
      ...(query.kind === 'GOODS' || query.kind === 'SERVICES' ? { kind: query.kind } : {}),
      ...search(query.q, ['name', 'sku', 'barcode', 'hsnSac']),
    };
    const current = page(query.page);
    const [items, total] = await Promise.all([
      this.prisma.invItem.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (current - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { stockLevels: { select: { warehouseId: true, onHand: true } } },
      }),
      this.prisma.invItem.count({ where }),
    ]);
    return {
      items: items.map(({ stockLevels, ...item }) => ({
        ...item,
        onHand: stockLevels.reduce((total, level) => total.add(level.onHand.toString()), Dec.ZERO).toString(),
        stock: stockLevels.map((level) => ({ warehouseId: level.warehouseId, onHand: level.onHand.toString() })),
      })),
      total,
      page: current,
      pageSize: PAGE_SIZE,
    };
  }

  async get(organizationId: string, id: string) {
    const item = await this.prisma.invItem.findFirst({ where: { id, organizationId } });
    if (!item) throw new NotFoundException('Item not found.');
    return item;
  }

  /** Exact SKU or barcode match (barcode scanners in the invoice editor). */
  async lookup(organizationId: string, code: string) {
    const value = code.trim().slice(0, 64);
    const item = await this.prisma.invItem.findFirst({
      where: { organizationId, archivedAt: null, OR: [{ sku: value }, { barcode: value }] },
    });
    if (!item) throw new NotFoundException('No item has this SKU or barcode.');
    return item;
  }

  async create(userId: string, organizationId: string, dto: ItemDto) {
    await this.access.assertCanWrite(userId, organizationId);
    if (!dto.name?.trim()) throw new BadRequestException('Item name is required.');
    const count = await this.prisma.invItem.count({ where: { organizationId, archivedAt: null } });
    await this.entitlements.assertCountBelowLimit(organizationId, INVOICE_STUDIO_SLUG, 'items', count, 'Items');
    return this.uniqueSku(() =>
      this.prisma.invItem.create({ data: { organizationId, ...this.normalize(dto) } }),
    );
  }

  async update(userId: string, organizationId: string, id: string, dto: ItemDto) {
    await this.access.assertCanWrite(userId, organizationId);
    const current = await this.get(organizationId, id);
    const merged: ItemDto = {
      kind: current.kind as ItemDto['kind'],
      name: current.name,
      description: current.description,
      sku: current.sku,
      barcode: current.barcode,
      unit: current.unit,
      hsnSac: current.hsnSac,
      taxRate: current.taxRate.toString(),
      cessRate: current.cessRate.toString(),
      taxCategory: current.taxCategory as ItemDto['taxCategory'],
      salePrice: current.salePrice.toString(),
      purchasePrice: current.purchasePrice.toString(),
      trackInventory: current.trackInventory,
      reorderLevel: current.reorderLevel?.toString() ?? null,
      ...Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined)),
    };
    if (current.trackInventory && merged.trackInventory === false) {
      const stocked = await this.prisma.invStockLevel.count({ where: { itemId: id, onHand: { not: 0 } } });
      if (stocked) throw new ConflictException('This item still has stock. Adjust it to zero before turning off stock tracking.');
    }
    return this.uniqueSku(() => this.prisma.invItem.update({ where: { id }, data: this.normalize(merged) }));
  }

  async archive(userId: string, organizationId: string, id: string) {
    await this.access.assertCanWrite(userId, organizationId);
    await this.get(organizationId, id);
    return this.prisma.invItem.update({ where: { id }, data: { archivedAt: new Date() } });
  }

  static readonly CSV_HEADER = ['name', 'kind', 'sku', 'barcode', 'unit', 'hsn_sac', 'tax_rate', 'sale_price', 'purchase_price', 'track_stock', 'reorder_level'];

  async exportCsv(organizationId: string) {
    const items = await this.prisma.invItem.findMany({ where: { organizationId, archivedAt: null }, orderBy: { name: 'asc' } });
    return toCsv(
      ItemsService.CSV_HEADER,
      items.map((item) => [
        item.name, item.kind === 'SERVICES' ? 'service' : 'goods', item.sku, item.barcode, item.unit, item.hsnSac,
        item.taxRate.toString(), item.salePrice.toString(), item.purchasePrice.toString(), item.trackInventory ? 'yes' : 'no', item.reorderLevel?.toString(),
      ]),
    );
  }

  /** Adds items from CSV; rows whose SKU already exists update that item. */
  async importCsv(userId: string, organizationId: string, buffer: Buffer): Promise<ImportResult> {
    await this.access.assertCanWrite(userId, organizationId);
    const result: ImportResult = { created: 0, updated: 0, errors: [] };
    const decimal = (value: string | undefined) => (value ? value.replace(',', '.') : undefined);
    for (const [index, row] of importText(buffer).entries()) {
      try {
        const dto = await validRow(ItemDto, {
          kind: /^serv/i.test(row.kind ?? '') ? 'SERVICES' : 'GOODS',
          name: row.name || undefined,
          sku: row.sku || undefined,
          barcode: row.barcode || undefined,
          unit: row.unit || undefined,
          hsnSac: row.hsn_sac || undefined,
          taxRate: decimal(row.tax_rate),
          salePrice: decimal(row.sale_price),
          purchasePrice: decimal(row.purchase_price),
          trackInventory: yes(row.track_stock),
          reorderLevel: decimal(row.reorder_level),
        });
        const existing = dto.sku ? await this.prisma.invItem.findFirst({ where: { organizationId, sku: dto.sku.trim() } }) : null;
        if (existing) {
          await this.update(userId, organizationId, existing.id, dto);
          result.updated += 1;
        } else {
          await this.create(userId, organizationId, dto);
          result.created += 1;
        }
      } catch (error) {
        result.errors.push({ row: index + 2, message: rowError(error) });
      }
    }
    return result;
  }

  private async uniqueSku<T>(write: () => Promise<T>) {
    try {
      return await write();
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException('Another item already uses this SKU.');
      throw error;
    }
  }

  private normalize(dto: ItemDto) {
    const kind = dto.kind ?? 'GOODS';
    return {
      kind,
      name: dto.name!.trim(),
      description: dto.description?.trim() || null,
      sku: dto.sku?.trim() || null,
      barcode: dto.barcode?.trim() || null,
      unit: dto.unit?.trim() || (kind === 'SERVICES' ? 'hrs' : 'pcs'),
      hsnSac: dto.hsnSac ?? null,
      taxRate: dto.taxRate ?? '0',
      cessRate: dto.cessRate ?? '0',
      taxCategory: dto.taxCategory ?? 'STANDARD',
      salePrice: dto.salePrice ?? '0',
      purchasePrice: dto.purchasePrice ?? '0',
      // Services never carry stock.
      trackInventory: kind === 'GOODS' ? Boolean(dto.trackInventory) : false,
      reorderLevel: dto.reorderLevel ?? null,
    };
  }
}
