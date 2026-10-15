import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Request,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  DOCUMENT_TYPES,
  EU_COUNTRIES,
  INDIA_GST_RATES,
  INDIA_STATES,
} from '@docconv/invoice-engine';
import { LANGUAGES, TEMPLATES } from '@docconv/invoice-templates';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TransactionalEmailService } from '../auth/transactional-email.service';
import { RequireFeatures } from '../feature-flags/require-features.decorator';
import { SaasEntitlementsService } from '../saas-plans/saas-entitlements.service';
import { BusinessesService } from './businesses.service';
import { ContactsService, ItemsService } from './contacts-items.service';
import { DocumentsService } from './documents.service';
import { ReportsService } from './reports.service';
import { InvoicingAutomationService, RecurringService } from './automation.service';
import {
  BusinessDto,
  ContactDto,
  ConvertDocumentDto,
  RecurringProfileDto,
  EmailDocumentDto,
  IssueDocumentDto,
  ItemDto,
  PaymentDto,
  SaveDocumentDto,
  ShareLinkDto,
  VoidDocumentDto,
} from './invoicing.dto';
import { INVOICE_STUDIO_SLUG } from './invoicing.common';

const ok = <T>(data: T) => ({ success: true, data });

function spreadsheet(res: Response, file: Buffer, filename: string) {
  res.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
  });
  return new StreamableFile(file);
}
const IMAGE_LIMIT = { limits: { fileSize: 1024 * 1024, files: 1 } };
const CSV_LIMIT = { limits: { fileSize: 2 * 1024 * 1024, files: 1 } };

function csvFile(res: Response, content: string, filename: string) {
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store' });
  return new StreamableFile(Buffer.from(content, 'utf8'));
}

@Controller('invoicing')
@UseGuards(JwtAuthGuard)
@RequireFeatures('invoicing')
export class InvoicingController {
  constructor(
    private readonly businesses: BusinessesService,
    private readonly contacts: ContactsService,
    private readonly items: ItemsService,
    private readonly entitlements: SaasEntitlementsService,
    private readonly reports: ReportsService,
    private readonly recurring: RecurringService,
    private readonly automation: InvoicingAutomationService,
  ) {}

  // Recurring invoices
  @Get('recurring')
  async listRecurring(@Request() req: any) {
    return ok(await this.recurring.list(req.user.orgId));
  }

  @Post('recurring')
  async createRecurring(@Request() req: any, @Body() dto: RecurringProfileDto) {
    return ok(await this.recurring.create(req.user.userId, req.user.orgId, dto));
  }

  @Patch('recurring/:id')
  async updateRecurring(@Request() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RecurringProfileDto) {
    return ok(await this.recurring.update(req.user.userId, req.user.orgId, id, dto));
  }

  /** Creates the next invoice of a recurring profile immediately. */
  @Post('recurring/:id/run')
  async runRecurring(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    await this.recurring.assertOwned(req.user.userId, req.user.orgId, id);
    const created = await this.automation.runRecurring(new Date(), { organizationId: req.user.orgId, profileId: id });
    return ok({ created, profile: (await this.recurring.list(req.user.orgId)).find((profile) => profile.id === id) });
  }

  @Delete('recurring/:id')
  async deleteRecurring(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return ok(await this.recurring.remove(req.user.userId, req.user.orgId, id));
  }

  // Reports
  @Get('reports/gstr1')
  async gstr1(
    @Request() req: any,
    @Query('businessId', ParseUUIDPipe) businessId: string,
    @Res({ passthrough: true }) res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const period = from && to ? { from, to } : ReportsService.monthRange();
    const file = await this.reports.gstr1(req.user.orgId, businessId, period.from, period.to);
    return spreadsheet(res, file, `GSTR-1-${period.from}-to-${period.to}.xlsx`);
  }

  @Get('reports/vat')
  async vatReport(
    @Request() req: any,
    @Query('businessId', ParseUUIDPipe) businessId: string,
    @Res({ passthrough: true }) res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const period = from && to ? { from, to } : ReportsService.monthRange();
    const file = await this.reports.vat(req.user.orgId, businessId, period.from, period.to);
    return spreadsheet(res, file, `VAT-${period.from}-to-${period.to}.xlsx`);
  }

  @Get('reports/receivables')
  async receivables(@Request() req: any) {
    return ok(await this.reports.receivables(req.user.orgId));
  }

  /** Reference data for the editor: document types, templates, languages, regions. */
  @Get('meta')
  meta() {
    return ok({
      documentTypes: Object.values(DOCUMENT_TYPES),
      templates: Object.values(TEMPLATES).map(({ css: _css, ...template }) => template),
      languages: Object.values(LANGUAGES).map(({ pack: _pack, ...language }) => language),
      indiaStates: Object.entries(INDIA_STATES).map(([code, state]) => ({ code, ...state })),
      euCountries: Object.entries(EU_COUNTRIES).map(([code, country]) => ({
        code,
        name: country.name,
        standardRate: country.standardRate,
      })),
      gstRates: INDIA_GST_RATES,
    });
  }

  @Get('usage')
  async usage(@Request() req: any) {
    return ok(await this.entitlements.summary(req.user.orgId, INVOICE_STUDIO_SLUG));
  }

  // Businesses
  @Get('businesses')
  async listBusinesses(@Request() req: any) {
    return ok(await this.businesses.list(req.user.orgId));
  }

  @Post('businesses')
  async createBusiness(@Request() req: any, @Body() dto: BusinessDto) {
    return ok(await this.businesses.create(req.user.userId, req.user.orgId, dto));
  }

  @Get('businesses/:id')
  async getBusiness(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return ok(await this.businesses.get(req.user.orgId, id));
  }

  @Patch('businesses/:id')
  async updateBusiness(@Request() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: BusinessDto) {
    return ok(await this.businesses.update(req.user.userId, req.user.orgId, id, dto));
  }

  @Delete('businesses/:id')
  async archiveBusiness(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return ok(await this.businesses.archive(req.user.userId, req.user.orgId, id));
  }

  @Post('businesses/:id/logo')
  @UseInterceptors(FileInterceptor('file', IMAGE_LIMIT))
  async logo(@Request() req: any, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Choose an image.');
    return ok(await this.businesses.setImage(req.user.userId, req.user.orgId, id, 'logo', file.buffer));
  }

  @Post('businesses/:id/signature')
  @UseInterceptors(FileInterceptor('file', IMAGE_LIMIT))
  async signature(@Request() req: any, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Choose an image.');
    return ok(await this.businesses.setImage(req.user.userId, req.user.orgId, id, 'signature', file.buffer));
  }

  // Contacts
  @Get('contacts')
  async listContacts(@Request() req: any, @Query('q') q?: string, @Query('type') type?: string, @Query('page') page?: string) {
    return ok(await this.contacts.list(req.user.orgId, { q, type, page }));
  }

  @Get('contacts/export')
  async exportContacts(@Request() req: any, @Res({ passthrough: true }) res: Response) {
    return csvFile(res, await this.contacts.exportCsv(req.user.orgId), 'contacts.csv');
  }

  @Post('contacts/import')
  @UseInterceptors(FileInterceptor('file', CSV_LIMIT))
  async importContacts(@Request() req: any, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Choose a CSV file.');
    return ok(await this.contacts.importCsv(req.user.userId, req.user.orgId, file.buffer));
  }

  @Get('contacts/:id')
  async getContact(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return ok(await this.contacts.get(req.user.orgId, id));
  }

  @Post('contacts')
  async createContact(@Request() req: any, @Body() dto: ContactDto) {
    return ok(await this.contacts.create(req.user.userId, req.user.orgId, dto));
  }

  @Patch('contacts/:id')
  async updateContact(@Request() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ContactDto) {
    return ok(await this.contacts.update(req.user.userId, req.user.orgId, id, dto));
  }

  @Delete('contacts/:id')
  async archiveContact(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return ok(await this.contacts.archive(req.user.userId, req.user.orgId, id));
  }

  // Items
  @Get('items')
  async listItems(@Request() req: any, @Query('q') q?: string, @Query('kind') kind?: string, @Query('page') page?: string) {
    return ok(await this.items.list(req.user.orgId, { q, kind, page }));
  }

  @Get('items/lookup')
  async lookupItem(@Request() req: any, @Query('code') code = '') {
    return ok(await this.items.lookup(req.user.orgId, code));
  }

  @Get('items/export')
  async exportItems(@Request() req: any, @Res({ passthrough: true }) res: Response) {
    return csvFile(res, await this.items.exportCsv(req.user.orgId), 'products.csv');
  }

  @Post('items/import')
  @UseInterceptors(FileInterceptor('file', CSV_LIMIT))
  async importItems(@Request() req: any, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Choose a CSV file.');
    return ok(await this.items.importCsv(req.user.userId, req.user.orgId, file.buffer));
  }

  @Get('items/:id')
  async getItem(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return ok(await this.items.get(req.user.orgId, id));
  }

  @Post('items')
  async createItem(@Request() req: any, @Body() dto: ItemDto) {
    return ok(await this.items.create(req.user.userId, req.user.orgId, dto));
  }

  @Patch('items/:id')
  async updateItem(@Request() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ItemDto) {
    return ok(await this.items.update(req.user.userId, req.user.orgId, id, dto));
  }

  @Delete('items/:id')
  async archiveItem(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return ok(await this.items.archive(req.user.userId, req.user.orgId, id));
  }
}

@Controller('invoicing/documents')
@UseGuards(JwtAuthGuard)
@RequireFeatures('invoicing')
export class DocumentsController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly email: TransactionalEmailService,
  ) {}

  @Get('summary')
  async summary(@Request() req: any) {
    return ok(await this.documents.summary(req.user.orgId));
  }

  @Get()
  async list(@Request() req: any, @Query() query: Record<string, string>) {
    return ok(await this.documents.list(req.user.orgId, query));
  }

  @Post()
  async create(@Request() req: any, @Body() dto: SaveDocumentDto) {
    return ok(await this.documents.createDraft(req.user.userId, req.user.orgId, dto));
  }

  /** Live preview of unsaved editor contents. */
  @Post('preview')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async preview(@Request() req: any, @Body() dto: SaveDocumentDto) {
    return ok(await this.documents.preview(req.user.orgId, dto));
  }

  @Get(':id')
  async get(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return ok(await this.documents.get(req.user.orgId, id));
  }

  @Put(':id')
  async update(@Request() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveDocumentDto) {
    return ok(await this.documents.updateDraft(req.user.userId, req.user.orgId, id, dto));
  }

  @Delete(':id')
  async remove(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return ok(await this.documents.deleteDraft(req.user.userId, req.user.orgId, id));
  }

  @Post(':id/issue')
  async issue(@Request() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: IssueDocumentDto) {
    return ok(await this.documents.issue(req.user.userId, req.user.orgId, id, dto.idempotencyKey));
  }

  @Post(':id/void')
  async void(@Request() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: VoidDocumentDto) {
    return ok(await this.documents.void(req.user.userId, req.user.orgId, id, dto.reason));
  }

  @Post(':id/convert')
  async convert(@Request() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ConvertDocumentDto) {
    return ok(await this.documents.convert(req.user.userId, req.user.orgId, id, dto));
  }

  @Post(':id/payments')
  async addPayment(@Request() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PaymentDto) {
    return ok(await this.documents.addPayment(req.user.userId, req.user.orgId, id, dto));
  }

  @Delete(':id/payments/:paymentId')
  async deletePayment(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    return ok(await this.documents.deletePayment(req.user.userId, req.user.orgId, id, paymentId));
  }

  @Get(':id/html')
  async html(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return ok({ html: await this.documents.html(req.user.orgId, id) });
  }

  @Get(':id/pdf')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async pdf(@Request() req: any, @Param('id', ParseUUIDPipe) id: string, @Res({ passthrough: true }) res: Response) {
    const { pdf, filename } = await this.documents.pdf(req.user.orgId, id);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store' });
    return new StreamableFile(pdf);
  }

  /** Signed link to the archived legal copy (with its SHA-256). */
  @Get(':id/original')
  async original(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return ok(await this.documents.originalPdfUrl(req.user.userId, req.user.orgId, id));
  }

  @Get(':id/share-links')
  async shareLinks(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return ok(await this.documents.listShareLinks(req.user.orgId, id));
  }

  @Post(':id/share-links')
  async share(@Request() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ShareLinkDto) {
    return ok(await this.documents.createShareLink(req.user.userId, req.user.orgId, id, dto));
  }

  @Delete(':id/share-links/:linkId')
  async revoke(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
  ) {
    return ok(await this.documents.revokeShareLink(req.user.userId, req.user.orgId, id, linkId));
  }

  @Post(':id/email')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async emailDocument(@Request() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: EmailDocumentDto) {
    this.email.assertConfigured();
    return ok(await this.documents.emailDocument(req.user.userId, req.user.orgId, id, dto, this.email.webUrl()));
  }
}

/** Customers open shared documents without an account. */
@Controller('public/invoices')
@RequireFeatures('invoicing')
export class PublicInvoicesController {
  constructor(private readonly documents: DocumentsService) {}

  @Get(':token')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async view(@Param('token') token: string) {
    const { organizationId, documentId } = await this.documents.byShareToken(token);
    const document = await this.documents.get(organizationId, documentId);
    return ok({
      html: await this.documents.html(organizationId, documentId),
      number: document.number,
      documentType: document.documentType,
      status: document.status,
    });
  }

  @Get(':token/pdf')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async pdf(@Param('token') token: string, @Res({ passthrough: true }) res: Response) {
    const { organizationId, documentId } = await this.documents.byShareToken(token);
    const { pdf, filename } = await this.documents.pdf(organizationId, documentId);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store' });
    return new StreamableFile(pdf);
  }
}
