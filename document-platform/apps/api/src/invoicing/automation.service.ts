import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { TransactionalEmailService } from '../auth/transactional-email.service';
import { InventoryService } from '../inventory/inventory.service';
import { SaasEntitlementsService } from '../saas-plans/saas-entitlements.service';
import { DocumentsService } from './documents.service';
import { RecurringProfileDto } from './invoicing.dto';
import { INVOICE_STUDIO_SLUG, InvoicingAccessService, dateOnly, isoDate } from './invoicing.common';
import type { PartySnapshot } from './document-render.service';

const RECURRING_TYPES = new Set(['TAX_INVOICE', 'BILL_OF_SUPPLY', 'EXPORT_INVOICE']);

/** Date of run `index` (0-based) of a schedule anchored at `start`. */
export function scheduledRun(start: Date, frequency: string, index: number) {
  const date = new Date(start);
  if (frequency === 'WEEKLY') return new Date(start.getTime() + index * 7 * 86_400_000);
  const months = frequency === 'MONTHLY' ? index : frequency === 'QUARTERLY' ? index * 3 : index * 12;
  const day = start.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  // Clamp to the month's last day (31 Jan → 28 Feb → 31 Mar).
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date;
}

@Injectable()
export class RecurringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: InvoicingAccessService,
    private readonly entitlements: SaasEntitlementsService,
  ) {}

  list(organizationId: string) {
    return this.prisma.invRecurringProfile.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } });
  }

  async create(userId: string, organizationId: string, dto: RecurringProfileDto) {
    await this.access.assertCanWrite(userId, organizationId);
    await this.entitlements.assertFeature(organizationId, INVOICE_STUDIO_SLUG, 'recurring', 'Recurring invoices');
    if (!dto.sourceDocumentId || !dto.frequency || !dto.startOn) {
      throw new BadRequestException('Choose the invoice to repeat, how often, and the first date.');
    }
    const source = await this.prisma.invDocument.findFirst({ where: { id: dto.sourceDocumentId, organizationId } });
    if (!source) throw new NotFoundException('Invoice not found.');
    if (!RECURRING_TYPES.has(source.documentType)) throw new BadRequestException('Only invoices can repeat.');
    if (source.status === 'VOID') throw new ConflictException('A void invoice cannot repeat.');
    const startOn = dateOnly(dto.startOn);
    if (startOn < dateOnly(new Date().toISOString())) throw new BadRequestException('The first date cannot be in the past.');
    const endOn = dto.endOn ? dateOnly(dto.endOn) : null;
    if (endOn && endOn < startOn) throw new BadRequestException('The end date is before the first date.');
    return this.prisma.invRecurringProfile.create({
      data: {
        organizationId,
        businessId: source.businessId,
        sourceDocumentId: source.id,
        frequency: dto.frequency,
        startOn,
        nextRunOn: startOn,
        endOn,
        autoIssue: Boolean(dto.autoIssue),
        emailTo: dto.emailTo ?? null,
        createdByUserId: userId,
      },
    });
  }

  async update(userId: string, organizationId: string, id: string, dto: RecurringProfileDto) {
    await this.access.assertCanWrite(userId, organizationId);
    const profile = await this.prisma.invRecurringProfile.findFirst({ where: { id, organizationId } });
    if (!profile) throw new NotFoundException('Recurring invoice not found.');
    return this.prisma.invRecurringProfile.update({
      where: { id },
      data: {
        active: dto.active ?? profile.active,
        autoIssue: dto.autoIssue ?? profile.autoIssue,
        emailTo: dto.emailTo === undefined ? profile.emailTo : dto.emailTo,
        endOn: dto.endOn === undefined ? profile.endOn : dto.endOn ? dateOnly(dto.endOn) : null,
        lastError: dto.active ? null : profile.lastError,
      },
    });
  }

  async assertOwned(userId: string, organizationId: string, id: string) {
    await this.access.assertCanWrite(userId, organizationId);
    const found = await this.prisma.invRecurringProfile.count({ where: { id, organizationId } });
    if (!found) throw new NotFoundException('Recurring invoice not found.');
  }

  async remove(userId: string, organizationId: string, id: string) {
    await this.access.assertCanWrite(userId, organizationId);
    const deleted = await this.prisma.invRecurringProfile.deleteMany({ where: { id, organizationId } });
    if (!deleted.count) throw new NotFoundException('Recurring invoice not found.');
    return { deleted: true };
  }
}

/**
 * Background automation. Every unit of work is claimed atomically in the
 * database first, so several API instances never create the same invoice or
 * send the same reminder twice.
 */
@Injectable()
export class InvoicingAutomationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InvoicingAutomationService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
    private readonly inventory: InventoryService,
    private readonly email: TransactionalEmailService,
  ) {}

  onModuleInit() {
    if (process.env.INVOICING_AUTOMATION === 'false') return;
    const interval = Math.max(60_000, Number(process.env.INVOICING_AUTOMATION_INTERVAL_MS) || 15 * 60_000);
    this.timer = setInterval(() => void this.tick(), interval);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** One pass of every job (also callable from tests and admin tooling). */
  async tick(now = new Date()) {
    if (this.running) return { recurring: 0, reminders: 0, lowStock: 0 };
    this.running = true;
    try {
      const recurring = await this.runRecurring(now).catch((error) => this.failed('recurring', error));
      const reminders = this.email.isConfigured() ? await this.runReminders(now).catch((error) => this.failed('reminders', error)) : 0;
      const lowStock = this.email.isConfigured() ? await this.runLowStock(now).catch((error) => this.failed('low stock', error)) : 0;
      return { recurring, reminders, lowStock };
    } finally {
      this.running = false;
    }
  }

  private failed(job: string, error: unknown) {
    this.logger.error(`Invoicing ${job} job failed: ${(error as Error).message}`);
    return 0;
  }

  /**
   * Claims due profiles (SKIP LOCKED), advances their schedule, then creates
   * the invoices. With `only`, runs that one profile now ("Create now").
   */
  async runRecurring(now = new Date(), only?: { organizationId: string; profileId: string }) {
    const today = dateOnly(now.toISOString());
    const claimed = await this.prisma.$transaction(async (tx) => {
      const due = only
        ? await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM inv_recurring_profiles
            WHERE id = ${only.profileId} AND organization_id = ${only.organizationId} AND active
            FOR UPDATE SKIP LOCKED`
        : await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM inv_recurring_profiles
            WHERE active AND next_run_on <= ${today} AND (end_on IS NULL OR next_run_on <= end_on)
            ORDER BY next_run_on LIMIT 25 FOR UPDATE SKIP LOCKED`;
      const profiles = [];
      for (const { id } of due) {
        const profile = await tx.invRecurringProfile.findUniqueOrThrow({ where: { id } });
        const next = scheduledRun(profile.startOn, profile.frequency, profile.runCount + 1);
        profiles.push(
          await tx.invRecurringProfile.update({
            where: { id },
            data: {
              runCount: { increment: 1 },
              lastRunAt: now,
              nextRunOn: next,
              active: profile.endOn ? next <= profile.endOn : true,
            },
          }),
        );
      }
      return profiles;
    });

    for (const profile of claimed) {
      try {
        const draft = await this.documents.duplicate(profile.createdByUserId, profile.organizationId, profile.sourceDocumentId);
        let documentId = draft.id;
        if (profile.autoIssue) {
          const issued = await this.documents.issue(profile.createdByUserId, profile.organizationId, draft.id, `recurring-${profile.id}-${profile.runCount}`);
          documentId = issued.document.id;
          if (profile.emailTo && this.email.isConfigured()) {
            await this.documents.emailDocument(profile.createdByUserId, profile.organizationId, documentId, { to: profile.emailTo }, this.email.webUrl());
          }
        }
        await this.prisma.invRecurringProfile.update({ where: { id: profile.id }, data: { lastDocumentId: documentId, lastError: null } });
      } catch (error) {
        const message = (error as Error).message.slice(0, 500);
        this.logger.warn(`Recurring invoice ${profile.id} failed: ${message}`);
        // Pause on failure so a broken profile is noticed rather than retried forever.
        await this.prisma.invRecurringProfile.update({ where: { id: profile.id }, data: { lastError: message, active: false } });
      }
    }
    return claimed.length;
  }

  /** Emails overdue customers on the business's reminder days (e.g. 3 and 10 days overdue). */
  async runReminders(now = new Date()) {
    const today = dateOnly(now.toISOString());
    const overdue = await this.prisma.invDocument.findMany({
      where: { status: { in: ['ISSUED', 'PARTIALLY_PAID'] }, dueDate: { lt: today }, documentType: { in: [...RECURRING_TYPES, 'DEBIT_NOTE'] } },
      include: { business: { select: { reminderDaysJson: true, organization: { select: { ownerUserId: true } } } } },
      orderBy: { dueDate: 'asc' },
      take: 200,
    });
    let sent = 0;
    for (const document of overdue) {
      const days = Math.floor((today.getTime() - document.dueDate!.getTime()) / 86_400_000);
      const schedule = (document.business.reminderDaysJson as number[]) ?? [];
      const nextDay = schedule[document.reminderCount];
      const recipient = (document.buyerJson as unknown as PartySnapshot).email;
      if (nextDay === undefined || days < nextDay || !recipient) continue;
      // Claim: only one instance moves the counter, and only it sends.
      const claim = await this.prisma.invDocument.updateMany({
        where: { id: document.id, reminderCount: document.reminderCount },
        data: { reminderCount: { increment: 1 }, lastReminderAt: now },
      });
      if (claim.count !== 1) continue;
      try {
        await this.documents.emailDocument(
          document.business.organization.ownerUserId,
          document.organizationId,
          document.id,
          {
            to: recipient,
            message: `Friendly reminder: ${document.number} was due on ${isoDate(document.dueDate)} and is now ${days} days overdue.`,
          },
          this.email.webUrl(),
        );
        sent += 1;
      } catch (error) {
        this.logger.warn(`Reminder for ${document.id} failed: ${(error as Error).message}`);
      }
    }
    return sent;
  }

  /** Once a day per business: email the owner a list of items at or below their alert level. */
  async runLowStock(now = new Date()) {
    const today = dateOnly(now.toISOString());
    const businesses = await this.prisma.invBusiness.findMany({
      where: { archivedAt: null, lowStockAlerts: true, OR: [{ lowStockAlertedOn: null }, { lowStockAlertedOn: { lt: today } }] },
      include: { organization: { select: { owner: { select: { email: true } } } } },
      take: 100,
    });
    let sent = 0;
    const handled = new Set<string>();
    for (const business of businesses) {
      if (handled.has(business.organizationId)) continue; // stock is workspace-wide: one email per workspace
      handled.add(business.organizationId);
      const claim = await this.prisma.invBusiness.updateMany({
        where: { id: business.id, OR: [{ lowStockAlertedOn: null }, { lowStockAlertedOn: { lt: today } }] },
        data: { lowStockAlertedOn: today },
      });
      if (claim.count !== 1) continue;
      const low = await this.inventory.levels(business.organizationId, { low: 'true' });
      if (!low.items.length) continue;
      const lines = low.items.slice(0, 50).map((item) => `• ${item.name}${item.sku ? ` (${item.sku})` : ''}: ${item.onHand} ${item.unit} left, alert at ${item.reorderLevel}`);
      await this.email.sendText(
        business.organization.owner.email,
        `${business.name}: ${low.items.length} item${low.items.length === 1 ? '' : 's'} running low`,
        `These items are at or below their low-stock level:\n\n${lines.join('\n')}\n\nReorder from ${this.email.webUrl()}/app/invoices/stock`,
      );
      sent += 1;
    }
    return sent;
  }
}
