import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InvBusiness, InvDocument, InvDocumentLine, Prisma } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'crypto';
import {
  DOCUMENT_TYPES,
  Dec,
  documentType,
  formatDocumentNumber,
  isCurrencyCode,
  isGstCompliantNumber,
  periodKey,
  type CalculationResult,
} from '@docconv/invoice-engine';
import { TEMPLATES, canonicalLanguage } from '@docconv/invoice-templates';
import { PrismaService } from '../common/prisma.service';
import { TransactionalEmailService } from '../auth/transactional-email.service';
import { SaasEntitlementsService } from '../saas-plans/saas-entitlements.service';
import { StockService, type NegativeStockPolicy } from '../inventory/stock.service';
import {
  ConvertDocumentDto,
  DocumentLineDto,
  EmailDocumentDto,
  PaymentDto,
  SaveDocumentDto,
  ShareLinkDto,
} from './invoicing.dto';
import {
  INVOICE_STUDIO_SLUG,
  InvoicingAccessService,
  addDays,
  dateOnly,
} from './invoicing.common';
import {
  DocumentRenderService,
  businessSnapshot,
  calculationFor,
  pdfFilename,
  type PartySnapshot,
} from './document-render.service';

type DocumentWithLines = InvDocument & { lines: InvDocumentLine[] };
type Tx = Prisma.TransactionClient;

const LIST_PAGE_SIZE = 50;
const EDITABLE = new Set(['DRAFT']);
const PAYABLE_STATUSES = new Set(['ISSUED', 'PARTIALLY_PAID']);

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: InvoicingAccessService,
    private readonly entitlements: SaasEntitlementsService,
    private readonly stock: StockService,
    private readonly render: DocumentRenderService,
    private readonly email: TransactionalEmailService,
  ) {}

  // ── Reading ─────────────────────────────────────────────────

  async list(
    organizationId: string,
    query: { type?: string; side?: string; status?: string; contactId?: string; q?: string; from?: string; to?: string; page?: string },
  ) {
    const pageNumber = Math.max(1, Number(query.page) || 1);
    const types = query.type
      ? query.type.split(',').filter((type) => DOCUMENT_TYPES[type])
      : query.side === 'purchase' || query.side === 'sales'
        ? Object.values(DOCUMENT_TYPES).filter((type) => type.side === query.side).map((type) => type.id)
        : undefined;
    const where: Prisma.InvDocumentWhereInput = {
      organizationId,
      ...(types ? { documentType: { in: types } } : {}),
      ...(query.status ? { status: { in: query.status.split(',').slice(0, 6) } } : {}),
      ...(query.contactId ? { contactId: query.contactId } : {}),
      ...(query.from || query.to
        ? { issueDate: { ...(query.from ? { gte: dateOnly(query.from) } : {}), ...(query.to ? { lte: dateOnly(query.to) } : {}) } }
        : {}),
      ...(query.q?.trim()
        ? {
            OR: [
              { number: { contains: query.q.trim().slice(0, 60), mode: 'insensitive' } },
              { reference: { contains: query.q.trim().slice(0, 60), mode: 'insensitive' } },
              { contact: { name: { contains: query.q.trim().slice(0, 60), mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.invDocument.findMany({
        where,
        orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
        skip: (pageNumber - 1) * LIST_PAGE_SIZE,
        take: LIST_PAGE_SIZE,
        select: {
          id: true, documentType: true, status: true, number: true, issueDate: true, dueDate: true,
          currency: true, grandTotal: true, amountPaid: true, businessId: true, contactId: true,
          buyerJson: true, createdAt: true,
        },
      }),
      this.prisma.invDocument.count({ where }),
    ]);
    const today = dateOnly(new Date().toISOString());
    return {
      items: items.map((document) => ({
        ...document,
        counterpartyName: (document.buyerJson as unknown as PartySnapshot)?.name ?? null,
        buyerJson: undefined,
        overdue:
          PAYABLE_STATUSES.has(document.status) && Boolean(document.dueDate) && document.dueDate! < today,
      })),
      total,
      page: pageNumber,
      pageSize: LIST_PAGE_SIZE,
    };
  }

  /** Dashboard figures, aggregated in the database (per currency). */
  async summary(organizationId: string) {
    const salesInvoiceTypes = Object.values(DOCUMENT_TYPES).filter((type) => type.meteredAsInvoice).map((type) => type.id);
    const payableSales = Object.values(DOCUMENT_TYPES).filter((type) => type.side === 'sales' && type.payable).map((type) => type.id);
    const today = dateOnly(new Date().toISOString());
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const openWhere = { organizationId, documentType: { in: payableSales }, status: { in: [...PAYABLE_STATUSES] } };
    const [open, overdue, month, drafts] = await Promise.all([
      this.prisma.invDocument.groupBy({
        by: ['currency'],
        where: openWhere,
        _sum: { grandTotal: true, amountPaid: true },
        _count: { _all: true },
      }),
      this.prisma.invDocument.count({ where: { ...openWhere, dueDate: { lt: today } } }),
      this.prisma.invDocument.groupBy({
        by: ['currency'],
        where: { organizationId, documentType: { in: salesInvoiceTypes }, status: { notIn: ['DRAFT', 'VOID'] }, issueDate: { gte: monthStart } },
        _sum: { grandTotal: true },
        _count: { _all: true },
      }),
      this.prisma.invDocument.count({ where: { organizationId, status: 'DRAFT' } }),
    ]);
    return {
      outstanding: open.map((row) => ({
        currency: row.currency,
        amount: Dec.of(row._sum.grandTotal?.toString() ?? '0').sub(row._sum.amountPaid?.toString() ?? '0').toFixed(2),
        documents: row._count._all,
      })),
      overdueCount: overdue,
      salesThisMonth: month.map((row) => ({ currency: row.currency, amount: Dec.of(row._sum.grandTotal?.toString() ?? '0').toFixed(2), documents: row._count._all })),
      draftCount: drafts,
    };
  }

  async get(organizationId: string, id: string) {
    const document = await this.prisma.invDocument.findFirst({
      where: { id, organizationId },
      include: {
        lines: { orderBy: { position: 'asc' } },
        payments: { orderBy: { paidOn: 'asc' } },
        referenceDocument: { select: { id: true, number: true, documentType: true } },
        referencedBy: { select: { id: true, number: true, documentType: true, status: true } },
      },
    });
    if (!document) throw new NotFoundException('Document not found.');
    return document;
  }

  // ── Drafts ──────────────────────────────────────────────────

  async createDraft(userId: string, organizationId: string, dto: SaveDocumentDto) {
    await this.access.assertCanWrite(userId, organizationId);
    const prepared = await this.prepare(organizationId, dto);
    return this.prisma.invDocument.create({
      data: {
        organizationId,
        createdByUserId: userId,
        ...prepared.fields,
        lines: { create: prepared.lines },
      },
      include: { lines: { orderBy: { position: 'asc' } } },
    });
  }

  async updateDraft(userId: string, organizationId: string, id: string, dto: SaveDocumentDto) {
    await this.access.assertCanWrite(userId, organizationId);
    const prepared = await this.prepare(organizationId, dto);
    return this.prisma.$transaction(async (tx) => {
      const current = await this.lockDocument(tx, organizationId, id);
      if (!EDITABLE.has(current.status)) throw new ConflictException('Issued documents cannot be edited. Use a credit or debit note.');
      if (dto.version && dto.version !== current.version) {
        throw new ConflictException('This document was changed elsewhere. Reload it before saving.');
      }
      if (current.documentType !== prepared.fields.documentType) throw new BadRequestException('The document type cannot be changed.');
      await tx.invDocumentLine.deleteMany({ where: { documentId: id } });
      return tx.invDocument.update({
        where: { id },
        data: { ...prepared.fields, version: { increment: 1 }, lines: { create: prepared.lines } },
        include: { lines: { orderBy: { position: 'asc' } } },
      });
    });
  }

  async deleteDraft(userId: string, organizationId: string, id: string) {
    await this.access.assertCanWrite(userId, organizationId);
    const document = await this.get(organizationId, id);
    if (document.status !== 'DRAFT') throw new ConflictException('Only drafts can be deleted. Void issued documents instead.');
    if (document.referencedBy.length) throw new ConflictException('Other documents refer to this draft.');
    await this.prisma.invDocument.delete({ where: { id } });
    return { deleted: true };
  }

  /** Calculation and HTML for unsaved editor contents (live preview). */
  async preview(organizationId: string, dto: SaveDocumentDto) {
    const prepared = await this.prepare(organizationId, dto);
    const document = {
      id: 'preview',
      organizationId,
      status: 'DRAFT',
      number: null,
      amountPaid: new Prisma.Decimal(0),
      ...prepared.fields,
      lines: prepared.lines.map((line, index) => ({ id: `line-${index}`, documentId: 'preview', receivedQuantity: new Prisma.Decimal(0), ...line })),
    } as unknown as DocumentWithLines;
    const html = await this.htmlFor(organizationId, prepared.business, document);
    return { calculation: prepared.calculation, html };
  }

  /**
   * Validates editor input against the workspace (business, contact, items,
   * warehouses, referenced document), snapshots the parties and calculates.
   */
  private async prepare(organizationId: string, dto: SaveDocumentDto) {
    const type = DOCUMENT_TYPES[dto.documentType];
    if (!type) throw new BadRequestException('Unknown document type.');
    const business = await this.prisma.invBusiness.findFirst({ where: { id: dto.businessId, organizationId, archivedAt: null } });
    if (!business) throw new NotFoundException('Business not found.');

    const contact = dto.contactId
      ? await this.prisma.invContact.findFirst({ where: { id: dto.contactId, organizationId } })
      : null;
    if (dto.contactId && !contact) throw new NotFoundException('Contact not found.');
    if (contact && type.side === 'purchase' && !contact.isSupplier) throw new BadRequestException('Choose a supplier for purchase documents.');
    if (!contact && !dto.buyer?.name) throw new BadRequestException(type.side === 'purchase' ? 'Choose a supplier.' : 'Choose a customer or enter their details.');

    const counterparty: PartySnapshot = {
      name: dto.buyer?.name ?? contact!.legalName ?? contact!.name,
      address: (dto.buyer?.address ?? contact?.billingAddressJson ?? {}) as Record<string, string>,
      country: dto.buyer?.country ?? contact?.country ?? business.country,
      stateCode: dto.buyer?.stateCode ?? contact?.stateCode ?? null,
      taxId: dto.buyer?.taxId ?? contact?.taxId ?? null,
      email: dto.buyer?.email ?? contact?.email ?? null,
      phone: dto.buyer?.phone ?? contact?.phone ?? null,
      isBusiness: dto.buyer?.isBusiness ?? contact?.isBusiness ?? Boolean(dto.buyer?.taxId),
      isSez: dto.buyer?.isSez ?? contact?.isSez ?? false,
    };

    let referenceNumber: string | undefined;
    if (dto.referenceDocumentId) {
      const reference = await this.prisma.invDocument.findFirst({
        where: { id: dto.referenceDocumentId, organizationId },
        select: { id: true, documentType: true, status: true, number: true, businessId: true },
      });
      if (!reference) throw new NotFoundException('Referenced document not found.');
      const allowed =
        type.referenceTypes?.includes(reference.documentType) ||
        documentType(reference.documentType).convertsTo.includes(type.id);
      if (!allowed) throw new BadRequestException(`A ${type.id} cannot refer to a ${reference.documentType}.`);
      if (type.referenceTypes && reference.status === 'DRAFT') throw new BadRequestException('Credit and debit notes need an issued document.');
      if (reference.businessId !== business.id) throw new BadRequestException('The referenced document belongs to another business.');
      referenceNumber = reference.number ?? undefined;
    } else if (type.referenceTypes) {
      throw new BadRequestException('Choose the invoice this note corrects.');
    }

    const itemIds = dto.lines.map((line) => line.itemId).filter((id): id is string => Boolean(id));
    if (itemIds.length) {
      const found = await this.prisma.invItem.count({ where: { organizationId, id: { in: [...new Set(itemIds)] } } });
      if (found !== new Set(itemIds).size) throw new NotFoundException('An item on this document was not found.');
    }
    const warehouseIds = [dto.warehouseId, ...dto.lines.map((line) => line.warehouseId)].filter((id): id is string => Boolean(id));
    if (warehouseIds.length) {
      const found = await this.prisma.invWarehouse.count({ where: { organizationId, id: { in: [...new Set(warehouseIds)] } } });
      if (found !== new Set(warehouseIds).size) throw new NotFoundException('A warehouse on this document was not found.');
    }

    const currency = dto.currency ?? contact?.currency ?? business.currency;
    if (!isCurrencyCode(currency)) throw new BadRequestException('Choose a valid currency.');
    const language = languageOrThrow(dto.language ?? contact?.language ?? business.language) ?? 'en';
    const secondaryLanguage = dto.secondaryLanguage === null ? null : languageOrThrow(dto.secondaryLanguage ?? business.secondaryLanguage);
    const template = dto.template ?? (business.template || type.defaultTemplate);
    if (!TEMPLATES[template]) throw new BadRequestException('Unknown template.');
    const issueDate = dateOnly(dto.issueDate);
    const dueDays = contact?.paymentTermsDays ?? business.defaultDueDays;

    const lineRows = dto.lines.map((line: DocumentLineDto, index) => ({
      position: index,
      itemId: line.itemId ?? null,
      description: line.description.trim(),
      details: line.details?.trim() || null,
      hsnSac: line.hsnSac ?? null,
      quantity: new Prisma.Decimal(line.quantity),
      unit: line.unit ?? null,
      unitPrice: new Prisma.Decimal(line.unitPrice),
      discountType: line.discountValue ? (line.discountType ?? 'PERCENT') : null,
      discountValue: line.discountValue ? new Prisma.Decimal(line.discountValue) : null,
      taxRate: new Prisma.Decimal(line.taxRate ?? '0'),
      cessRate: new Prisma.Decimal(line.cessRate ?? '0'),
      taxCategory: line.taxCategory ?? 'STANDARD',
      supplyKind: line.supplyKind ?? 'GOODS',
      warehouseId: line.warehouseId ?? null,
    }));
    const fields = {
      businessId: business.id,
      documentType: type.id,
      issueDate,
      dueDate: dto.dueDate === null ? null : dto.dueDate ? dateOnly(dto.dueDate) : type.payable ? addDays(issueDate, dueDays) : null,
      supplyDate: dto.supplyDate ? dateOnly(dto.supplyDate) : null,
      contactId: contact?.id ?? null,
      sellerJson: businessSnapshot(business) as unknown as Prisma.InputJsonValue,
      buyerJson: counterparty as unknown as Prisma.InputJsonValue,
      shipToJson: dto.shipTo ? (dto.shipTo as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      placeOfSupplyCountry: dto.placeOfSupplyCountry ?? null,
      placeOfSupplyState: dto.placeOfSupplyState ?? null,
      currency,
      language,
      secondaryLanguage,
      template,
      pricesIncludeTax: dto.pricesIncludeTax ?? business.pricesIncludeTax,
      reverseCharge: Boolean(dto.reverseCharge),
      exportWithPayment: Boolean(dto.exportWithPayment),
      euOss: Boolean(dto.euOss),
      roundOffTotal: dto.roundOffTotal ?? business.roundOffTotal,
      reference: dto.reference?.trim() || null,
      notes: dto.notes === undefined ? business.defaultNotes : dto.notes,
      terms: dto.terms === undefined ? business.defaultTerms : dto.terms,
      referenceDocumentId: dto.referenceDocumentId ?? null,
      returnToStock: type.id === 'CREDIT_NOTE' ? Boolean(dto.returnToStock) : false,
      warehouseId: dto.warehouseId ?? null,
    };
    const calculation = calculationFor(business, fields as unknown as InvDocument, counterparty, lineRows as unknown as InvDocumentLine[]);
    const lines = lineRows.map((line, index) => ({
      ...line,
      taxable: new Prisma.Decimal(calculation.lines[index]!.taxable),
      taxesJson: calculation.lines[index]!.taxes as unknown as Prisma.InputJsonValue,
      total: new Prisma.Decimal(calculation.lines[index]!.total),
    }));
    return {
      business,
      referenceNumber,
      calculation,
      lines,
      fields: {
        ...fields,
        calculationJson: calculation as unknown as Prisma.InputJsonValue,
        taxableTotal: new Prisma.Decimal(calculation.taxableTotal),
        taxTotal: new Prisma.Decimal(calculation.taxTotal),
        grandTotal: new Prisma.Decimal(calculation.grandTotal),
      },
    };
  }

  // ── Issue / void / convert ─────────────────────────────────

  /**
   * Issues a draft in one transaction: plan quota, gapless number, frozen
   * party details, recalculation and stock. The legal PDF is archived after
   * commit (a rendering hiccup never loses an issued invoice; it is
   * re-rendered on the first download).
   */
  async issue(userId: string, organizationId: string, id: string, idempotencyKey?: string) {
    await this.access.assertCanWrite(userId, organizationId);
    if (idempotencyKey) {
      const already = await this.prisma.invDocument.findFirst({ where: { organizationId, issueIdempotencyKey: idempotencyKey } });
      if (already) return { document: already, warnings: [] as string[] };
    }
    const result = await this.withSerializableRetry(() =>
      this.prisma.$transaction(async (tx) => {
        const document = await this.lockDocument(tx, organizationId, id);
        if (document.status !== 'DRAFT') throw new ConflictException('This document has already been issued.');
        const type = documentType(document.documentType);
        const business = await tx.invBusiness.findUniqueOrThrow({ where: { id: document.businessId } });
        if (type.side === 'purchase') {
          await this.entitlements.assertFeature(organizationId, INVOICE_STUDIO_SLUG, 'purchasing', 'Purchasing', tx);
        }
        if (type.meteredAsInvoice) {
          await this.entitlements.consume(tx, organizationId, INVOICE_STUDIO_SLUG, 'invoicesPerMonth', 'Invoices');
        }

        const lines = await tx.invDocumentLine.findMany({ where: { documentId: id }, orderBy: { position: 'asc' } });
        const seller = businessSnapshot(business);
        const calculation = calculationFor(business, document, document.buyerJson as unknown as PartySnapshot, lines);
        const number = await this.nextNumber(tx, business, document.documentType, document.issueDate);

        let stockPosted = false;
        let warnings: string[] = [];
        const skipStock = await this.stockAlreadyMoved(tx, document);
        if (!skipStock && type.stockEffect !== 'none') {
          const posted = await this.stock.postDocument(
            tx,
            { ...document, lines: lines.map((line, index) => ({ ...line, taxable: new Prisma.Decimal(calculation.lines[index]!.taxable) })) },
            userId,
            business.negativeStockPolicy as NegativeStockPolicy,
          );
          stockPosted = posted.posted;
          warnings = posted.warnings;
        }

        for (const [index, line] of lines.entries()) {
          await tx.invDocumentLine.update({
            where: { id: line.id },
            data: {
              taxable: calculation.lines[index]!.taxable,
              taxesJson: calculation.lines[index]!.taxes as unknown as Prisma.InputJsonValue,
              total: calculation.lines[index]!.total,
            },
          });
        }
        const issued = await tx.invDocument.update({
          where: { id },
          data: {
            status: 'ISSUED',
            number,
            sellerJson: seller as unknown as Prisma.InputJsonValue,
            calculationJson: calculation as unknown as Prisma.InputJsonValue,
            taxableTotal: calculation.taxableTotal,
            taxTotal: calculation.taxTotal,
            grandTotal: calculation.grandTotal,
            issuedAt: new Date(),
            issuedByUserId: userId,
            issueIdempotencyKey: idempotencyKey ?? null,
            stockPosted,
            version: { increment: 1 },
          },
          include: { lines: true },
        });
        if (document.referenceDocumentId && type.id === 'PURCHASE_BILL') {
          await tx.invDocument.updateMany({
            where: { id: document.referenceDocumentId, documentType: 'PURCHASE_ORDER', status: { in: ['ISSUED', 'PARTIALLY_RECEIVED', 'RECEIVED'] } },
            data: { status: 'CLOSED' },
          });
        }
        await tx.auditLog.create({
          data: {
            organizationId,
            userId,
            action: 'INV_DOCUMENT_ISSUED',
            resourceType: 'InvDocument',
            resourceId: id,
            metadataJson: { number, documentType: document.documentType, grandTotal: calculation.grandTotal, stockPosted },
          },
        });
        return { document: issued, business, warnings };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 20_000 }),
    );

    await this.archivePdf(organizationId, userId, result.business, result.document).catch((error) =>
      this.logger.warn(`PDF archive for ${id} failed; it will be rendered on demand: ${(error as Error).message}`),
    );
    return { document: await this.get(organizationId, id), warnings: result.warnings };
  }

  /**
   * Gapless numbering: the series row is updated (and so locked) inside the
   * issue transaction; a rollback releases the number again.
   */
  private async nextNumber(tx: Tx, business: InvBusiness, type: string, issueDate: Date) {
    const definition = documentType(type);
    const patterns = business.numberingJson as Record<string, string>;
    const pattern =
      patterns[type] ?? (business.taxRegime === 'IN_GST' ? `${definition.defaultPrefix}/{FY_SHORT}/{SEQ:4}` : `${definition.defaultPrefix}-{YYYY}-{SEQ:4}`);
    const options = { fyStartMonth: business.fyStartMonth };
    const key = periodKey(pattern, issueDate, options) || 'ALL';
    // Atomic "create if missing": concurrent first issues of a period must not
    // race (a check-then-insert upsert fails with a unique violation).
    await tx.$executeRaw`
      INSERT INTO inv_series (id, organization_id, business_id, document_type, period_key, next_number)
      VALUES (${randomUUID()}, ${business.organizationId}, ${business.id}, ${type}, ${key}, 1)
      ON CONFLICT (business_id, document_type, period_key) DO NOTHING`;
    const series = await tx.invSeries.update({
      where: { businessId_documentType_periodKey: { businessId: business.id, documentType: type, periodKey: key } },
      data: { nextNumber: { increment: 1 } },
    });
    const number = formatDocumentNumber(pattern, series.nextNumber - 1, issueDate, options);
    if (business.taxRegime === 'IN_GST' && definition.legal && !isGstCompliantNumber(number)) {
      throw new BadRequestException(
        `GST invoice numbers must be at most 16 characters (letters, digits, "-" and "/"). "${number}" is too long; shorten the numbering pattern.`,
      );
    }
    return number;
  }

  /** An invoice made from a delivery challan does not move the goods twice. */
  private async stockAlreadyMoved(tx: Tx, document: InvDocument) {
    if (!document.referenceDocumentId) return false;
    const reference = await tx.invDocument.findUnique({
      where: { id: document.referenceDocumentId },
      select: { documentType: true, stockPosted: true },
    });
    if (!reference) return false;
    if (reference.documentType === 'DELIVERY_CHALLAN' && reference.stockPosted) return true;
    // Bills for a purchase order: stock arrives through goods receipts.
    return document.documentType === 'PURCHASE_BILL' && reference.documentType === 'PURCHASE_ORDER';
  }

  async void(userId: string, organizationId: string, id: string, reason: string) {
    await this.access.assertCanManage(userId, organizationId);
    return this.prisma.$transaction(async (tx) => {
      const document = await this.lockDocument(tx, organizationId, id);
      if (document.status === 'DRAFT') throw new ConflictException('Delete drafts instead of voiding them.');
      if (document.status === 'VOID') throw new ConflictException('This document is already void.');
      if (!Dec.of(document.amountPaid.toString()).isZero()) {
        throw new ConflictException('Remove its payments first, or issue a credit note instead.');
      }
      const dependants = await tx.invDocument.count({
        where: { referenceDocumentId: id, status: { not: 'VOID' }, documentType: { in: ['CREDIT_NOTE', 'DEBIT_NOTE'] } },
      });
      if (dependants) throw new ConflictException('Void the credit and debit notes for this document first.');
      const receipts = await tx.invGoodsReceipt.count({ where: { purchaseOrderId: id, status: 'POSTED' } });
      if (receipts) throw new ConflictException('Cancel the goods receipts for this purchase order first.');
      if (document.stockPosted) {
        const business = await tx.invBusiness.findUniqueOrThrow({ where: { id: document.businessId } });
        await this.stock.reverse(tx, organizationId, { documentId: id }, userId, `Void: ${reason}`, business.negativeStockPolicy as NegativeStockPolicy);
      }
      const voided = await tx.invDocument.update({
        where: { id },
        data: { status: 'VOID', voidedAt: new Date(), voidReason: reason.trim(), version: { increment: 1 } },
      });
      await tx.auditLog.create({
        data: { organizationId, userId, action: 'INV_DOCUMENT_VOIDED', resourceType: 'InvDocument', resourceId: id, metadataJson: { reason } },
      });
      return voided;
    });
  }

  /** Same-type copy dated today (used by recurring invoices). */
  async duplicate(userId: string, organizationId: string, id: string) {
    const source = await this.get(organizationId, id);
    if (source.status === 'VOID') throw new ConflictException('The source document is void.');
    return this.copyAsDraft(userId, organizationId, source, source.documentType, false);
  }

  /** New draft from an existing document (quote → invoice, invoice → credit note, PO → bill…). */
  async convert(userId: string, organizationId: string, id: string, dto: ConvertDocumentDto) {
    const source = await this.get(organizationId, id);
    const sourceType = documentType(source.documentType);
    if (!sourceType.convertsTo.includes(dto.targetType)) {
      throw new BadRequestException(`A ${source.documentType} cannot be converted to ${dto.targetType}.`);
    }
    const target = documentType(dto.targetType);
    if (target.referenceTypes && source.status === 'DRAFT') throw new BadRequestException('Issue the document before creating a note for it.');
    return this.copyAsDraft(userId, organizationId, source, target.id, true);
  }

  private copyAsDraft(
    userId: string,
    organizationId: string,
    source: Awaited<ReturnType<DocumentsService['get']>>,
    targetType: string,
    linkToSource: boolean,
  ) {
    const buyer = source.buyerJson as unknown as PartySnapshot;
    return this.createDraft(userId, organizationId, {
      businessId: source.businessId,
      documentType: targetType,
      issueDate: new Date().toISOString().slice(0, 10),
      contactId: source.contactId,
      buyer: {
        name: buyer.name,
        address: buyer.address,
        country: buyer.country,
        stateCode: buyer.stateCode ?? undefined,
        taxId: buyer.taxId ?? undefined,
        email: buyer.email ?? undefined,
        phone: buyer.phone ?? undefined,
        isBusiness: buyer.isBusiness,
        isSez: buyer.isSez,
      },
      shipTo: (source.shipToJson as never) ?? undefined,
      placeOfSupplyCountry: source.placeOfSupplyCountry ?? undefined,
      placeOfSupplyState: source.placeOfSupplyState ?? undefined,
      currency: source.currency,
      language: source.language,
      secondaryLanguage: source.secondaryLanguage,
      pricesIncludeTax: source.pricesIncludeTax,
      reverseCharge: source.reverseCharge,
      exportWithPayment: source.exportWithPayment,
      euOss: source.euOss,
      roundOffTotal: source.roundOffTotal,
      reference: linkToSource ? (source.number ?? source.reference ?? undefined) : (source.reference ?? undefined),
      notes: source.notes,
      terms: source.terms,
      referenceDocumentId: linkToSource ? source.id : undefined,
      warehouseId: source.warehouseId,
      // Purchase bills from a PO bill what was ordered; other conversions copy lines as they are.
      lines: source.lines.map((line) => ({
        itemId: line.itemId ?? undefined,
        description: line.description,
        details: line.details ?? undefined,
        hsnSac: line.hsnSac ?? undefined,
        quantity: line.quantity.toString(),
        unit: line.unit ?? undefined,
        unitPrice: line.unitPrice.toString(),
        discountType: (line.discountType as 'PERCENT' | 'AMOUNT' | null) ?? undefined,
        discountValue: line.discountValue?.toString(),
        taxRate: line.taxRate.toString(),
        cessRate: line.cessRate.toString(),
        taxCategory: line.taxCategory as DocumentLineDto['taxCategory'],
        supplyKind: line.supplyKind as DocumentLineDto['supplyKind'],
        warehouseId: line.warehouseId ?? undefined,
      })),
    });
  }

  // ── Payments ────────────────────────────────────────────────

  async addPayment(userId: string, organizationId: string, id: string, dto: PaymentDto) {
    await this.access.assertCanWrite(userId, organizationId);
    return this.prisma.$transaction(async (tx) => {
      const document = await this.lockDocument(tx, organizationId, id);
      if (!documentType(document.documentType).payable) throw new BadRequestException('Payments cannot be recorded on this document.');
      if (!PAYABLE_STATUSES.has(document.status)) throw new ConflictException('Payments can be recorded only on issued, unpaid documents.');
      const amount = Dec.of(dto.amount);
      if (amount.isZero()) throw new BadRequestException('Enter an amount.');
      const paid = Dec.of(document.amountPaid.toString()).add(amount);
      const total = Dec.of(document.grandTotal.toString());
      if (paid.cmp(total) > 0) throw new BadRequestException(`The balance due is ${total.sub(document.amountPaid.toString()).toString()} ${document.currency}.`);
      await tx.invPayment.create({
        data: {
          organizationId,
          documentId: id,
          paidOn: dateOnly(dto.paidOn),
          amount: dto.amount,
          method: dto.method,
          reference: dto.reference ?? null,
          notes: dto.notes ?? null,
          createdByUserId: userId,
        },
      });
      return tx.invDocument.update({
        where: { id },
        data: { amountPaid: paid.toFixed(4), status: paid.eq(total) ? 'PAID' : 'PARTIALLY_PAID', version: { increment: 1 } },
        include: { payments: true },
      });
    });
  }

  async deletePayment(userId: string, organizationId: string, id: string, paymentId: string) {
    await this.access.assertCanManage(userId, organizationId);
    return this.prisma.$transaction(async (tx) => {
      const document = await this.lockDocument(tx, organizationId, id);
      const payment = await tx.invPayment.findFirst({ where: { id: paymentId, documentId: id } });
      if (!payment) throw new NotFoundException('Payment not found.');
      if (document.status === 'VOID') throw new ConflictException('This document is void.');
      await tx.invPayment.delete({ where: { id: paymentId } });
      const paid = Dec.of(document.amountPaid.toString()).sub(payment.amount.toString());
      return tx.invDocument.update({
        where: { id },
        data: { amountPaid: paid.toFixed(4), status: paid.isZero() ? 'ISSUED' : 'PARTIALLY_PAID', version: { increment: 1 } },
      });
    });
  }

  // ── Output: HTML, PDF, share links, email ──────────────────

  private async showPoweredBy(organizationId: string) {
    return !(await this.entitlements.hasFeature(organizationId, INVOICE_STUDIO_SLUG, 'remove_branding'));
  }

  private async htmlFor(organizationId: string, business: InvBusiness, document: DocumentWithLines) {
    let originalDocumentNumber: string | undefined;
    if (document.referenceDocumentId) {
      const reference = await this.prisma.invDocument.findUnique({ where: { id: document.referenceDocumentId }, select: { number: true } });
      originalDocumentNumber = reference?.number ?? undefined;
    }
    const model = await this.render.renderModel(business, document, {
      showPoweredBy: await this.showPoweredBy(organizationId),
      originalDocumentNumber: documentType(document.documentType).referenceTypes ? originalDocumentNumber : undefined,
    });
    return this.render.html(business, document, model);
  }

  async html(organizationId: string, id: string) {
    const document = await this.get(organizationId, id);
    const business = await this.prisma.invBusiness.findUniqueOrThrow({ where: { id: document.businessId } });
    return this.htmlFor(organizationId, business, document);
  }

  /** PDF of the document as it is now (with draft / paid / void stamp). */
  async pdf(organizationId: string, id: string) {
    const document = await this.get(organizationId, id);
    const business = await this.prisma.invBusiness.findUniqueOrThrow({ where: { id: document.businessId } });
    const html = await this.htmlFor(organizationId, business, document);
    return { pdf: await this.render.pdf(document, html), filename: pdfFilename(document) };
  }

  /** Signed link to the archived legal copy made when the document was issued. */
  async originalPdfUrl(userId: string, organizationId: string, id: string) {
    let document = await this.get(organizationId, id);
    if (document.status === 'DRAFT') throw new ConflictException('Drafts have no issued copy.');
    if (!document.pdfStorageKey) {
      const business = await this.prisma.invBusiness.findUniqueOrThrow({ where: { id: document.businessId } });
      await this.archivePdf(organizationId, userId, business, document);
      document = await this.get(organizationId, id);
    }
    return {
      url: await this.render.signedPdfUrl(document.pdfStorageKey!, pdfFilename(document)),
      sha256: document.pdfSha256,
    };
  }

  private async archivePdf(organizationId: string, userId: string, business: InvBusiness, document: DocumentWithLines) {
    if (document.pdfStorageKey) return;
    // The archived copy shows the document as issued (no paid/void stamp).
    const html = await this.htmlFor(organizationId, business, { ...document, status: 'ISSUED', amountPaid: new Prisma.Decimal(0) });
    const pdf = await this.render.pdf(document, html);
    const archived = await this.render.archive(organizationId, userId, pdf);
    const updated = await this.prisma.invDocument.updateMany({
      where: { id: document.id, pdfStorageKey: null },
      data: { pdfStorageKey: archived.storageKey, pdfSha256: archived.sha256 },
    });
    // Another request archived it first: drop this duplicate copy.
    if (updated.count === 0) await this.render.discard(archived.storageKey);
  }

  async createShareLink(userId: string, organizationId: string, id: string, dto: ShareLinkDto) {
    await this.access.assertCanWrite(userId, organizationId);
    const document = await this.get(organizationId, id);
    if (document.status === 'DRAFT') throw new ConflictException('Issue the document before sharing it.');
    const token = randomBytes(24).toString('base64url');
    const link = await this.prisma.invShareLink.create({
      data: {
        organizationId,
        documentId: id,
        tokenHash: hashToken(token),
        expiresAt: addDays(new Date(), dto.expiresInDays ?? 30),
      },
    });
    // The token is returned once; only its hash is stored.
    return { id: link.id, token, expiresAt: link.expiresAt };
  }

  listShareLinks(organizationId: string, id: string) {
    return this.prisma.invShareLink.findMany({
      where: { organizationId, documentId: id },
      select: { id: true, expiresAt: true, revokedAt: true, viewCount: true, lastViewedAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeShareLink(userId: string, organizationId: string, id: string, linkId: string) {
    await this.access.assertCanWrite(userId, organizationId);
    const updated = await this.prisma.invShareLink.updateMany({
      where: { id: linkId, documentId: id, organizationId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!updated.count) throw new NotFoundException('Share link not found.');
    return { revoked: true };
  }

  /** Public access through a share link (no account). */
  async byShareToken(token: string) {
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw new NotFoundException('This link is not valid.');
    const link = await this.prisma.invShareLink.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!link || link.revokedAt || link.expiresAt < new Date()) throw new NotFoundException('This link has expired or was revoked.');
    await this.prisma.invShareLink.update({
      where: { id: link.id },
      data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
    });
    return { organizationId: link.organizationId, documentId: link.documentId };
  }

  async emailDocument(userId: string, organizationId: string, id: string, dto: EmailDocumentDto, publicWebUrl: string) {
    await this.access.assertCanWrite(userId, organizationId);
    const document = await this.get(organizationId, id);
    if (document.status === 'DRAFT') throw new ConflictException('Issue the document before emailing it.');
    const business = await this.prisma.invBusiness.findUniqueOrThrow({ where: { id: document.businessId } });
    const link = await this.createShareLink(userId, organizationId, id, { expiresInDays: 60 });
    const { pdf, filename } = await this.pdf(organizationId, id);
    const calculation = document.calculationJson as unknown as CalculationResult;
    const label = documentType(document.documentType).labelKey.replace('doc.', '');
    const lines = [
      dto.message?.trim(),
      `${business.name} sent you ${label} ${document.number}: ${calculation.grandTotal} ${document.currency}.`,
      `View or download: ${publicWebUrl.replace(/\/$/, '')}/i/${link.token}`,
    ].filter(Boolean);
    await this.email.sendWithAttachment(dto.to, `${business.name}: ${document.number}`, lines.join('\n\n'), {
      filename,
      content: pdf,
    });
    await this.prisma.auditLog.create({
      data: { organizationId, userId, action: 'INV_DOCUMENT_EMAILED', resourceType: 'InvDocument', resourceId: id, metadataJson: { to: dto.to } },
    });
    return { sent: true };
  }

  // ── Helpers ─────────────────────────────────────────────────

  /** Row lock on the document (serialises issue / pay / void of one document). */
  private async lockDocument(tx: Tx, organizationId: string, id: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM inv_documents WHERE id = ${id} AND organization_id = ${organizationId} FOR UPDATE`;
    if (!rows.length) throw new NotFoundException('Document not found.');
    return tx.invDocument.findUniqueOrThrow({ where: { id } });
  }

  private async withSerializableRetry<T>(work: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await work();
      } catch (error: any) {
        // Deadlock / serialization failure: retry a few times.
        if ((error?.code === 'P2034' || error?.code === '40P01') && attempt < 2) continue;
        if (error?.code === 'P2002' && String(error?.meta?.target ?? '').includes('number')) {
          throw new ConflictException('That document number is already used. Check the numbering settings.');
        }
        throw error;
      }
    }
  }
}

function languageOrThrow(tag: string | null | undefined): string | null {
  if (!tag) return null;
  try {
    return canonicalLanguage(tag);
  } catch {
    throw new BadRequestException(`"${tag}" is not a language code.`);
  }
}

export function assertPublicWebUrl(value: string | undefined) {
  if (!value) throw new ForbiddenException('PUBLIC_WEB_URL is not configured.');
  return value;
}
