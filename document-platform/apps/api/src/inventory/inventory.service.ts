import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InvDocument, InvDocumentLine, Prisma } from '@prisma/client';
import { Dec } from '@docconv/invoice-engine';
import { PrismaService } from '../common/prisma.service';
import { SaasEntitlementsService } from '../saas-plans/saas-entitlements.service';
import { INVOICE_STUDIO_SLUG, InvoicingAccessService, dateOnly } from '../invoicing/invoicing.common';
import { GoodsReceiptDto, StockAdjustmentDto, StockTransferDto, WarehouseDto } from '../invoicing/invoicing.dto';
import { StockService, type NegativeStockPolicy } from './stock.service';

const PAGE_SIZE = 50;

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: InvoicingAccessService,
    private readonly entitlements: SaasEntitlementsService,
    private readonly stock: StockService,
  ) {}

  // ── Warehouses ──────────────────────────────────────────────

  listWarehouses(organizationId: string) {
    return this.prisma.invWarehouse.findMany({
      where: { organizationId, archivedAt: null },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async createWarehouse(userId: string, organizationId: string, dto: WarehouseDto) {
    await this.access.assertCanManage(userId, organizationId);
    if (!dto.name?.trim()) throw new BadRequestException('Warehouse name is required.');
    const count = await this.prisma.invWarehouse.count({ where: { organizationId, archivedAt: null } });
    await this.entitlements.assertCountBelowLimit(organizationId, INVOICE_STUDIO_SLUG, 'warehouses', count, 'Warehouses');
    await this.assertBusiness(organizationId, dto.businessId);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) await tx.invWarehouse.updateMany({ where: { organizationId }, data: { isDefault: false } });
      return tx.invWarehouse.create({
        data: {
          organizationId,
          name: dto.name!.trim(),
          code: dto.code?.trim() || null,
          businessId: dto.businessId ?? null,
          addressJson: (dto.address ?? {}) as Prisma.InputJsonValue,
          isDefault: Boolean(dto.isDefault) || count === 0,
        },
      });
    });
  }

  async updateWarehouse(userId: string, organizationId: string, id: string, dto: WarehouseDto) {
    await this.access.assertCanManage(userId, organizationId);
    const current = await this.warehouse(organizationId, id);
    await this.assertBusiness(organizationId, dto.businessId);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) await tx.invWarehouse.updateMany({ where: { organizationId }, data: { isDefault: false } });
      return tx.invWarehouse.update({
        where: { id },
        data: {
          name: dto.name?.trim() || current.name,
          code: dto.code === undefined ? current.code : dto.code?.trim() || null,
          businessId: dto.businessId === undefined ? current.businessId : dto.businessId,
          addressJson: (dto.address ?? current.addressJson) as Prisma.InputJsonValue,
          isDefault: dto.isDefault ?? current.isDefault,
        },
      });
    });
  }

  async archiveWarehouse(userId: string, organizationId: string, id: string) {
    await this.access.assertCanManage(userId, organizationId);
    await this.warehouse(organizationId, id);
    const stocked = await this.prisma.invStockLevel.count({ where: { warehouseId: id, onHand: { not: 0 } } });
    if (stocked) throw new ConflictException('Move or adjust the stock in this warehouse to zero first.');
    return this.prisma.invWarehouse.update({ where: { id }, data: { archivedAt: new Date(), isDefault: false } });
  }

  private async warehouse(organizationId: string, id: string) {
    const warehouse = await this.prisma.invWarehouse.findFirst({ where: { id, organizationId, archivedAt: null } });
    if (!warehouse) throw new NotFoundException('Warehouse not found.');
    return warehouse;
  }

  private async assertBusiness(organizationId: string, businessId?: string | null) {
    if (!businessId) return;
    const found = await this.prisma.invBusiness.count({ where: { id: businessId, organizationId } });
    if (!found) throw new NotFoundException('Business not found.');
  }

  /** Workspace-wide policy: the strictest policy of its businesses. */
  private async policy(organizationId: string): Promise<NegativeStockPolicy> {
    const businesses = await this.prisma.invBusiness.findMany({
      where: { organizationId, archivedAt: null },
      select: { negativeStockPolicy: true },
    });
    const policies = businesses.map((business) => business.negativeStockPolicy);
    return policies.includes('BLOCK') || !policies.length ? 'BLOCK' : policies.includes('WARN') ? 'WARN' : 'ALLOW';
  }

  // ── Stock changes ──────────────────────────────────────────

  async adjust(userId: string, organizationId: string, dto: StockAdjustmentDto) {
    await this.access.assertCanWrite(userId, organizationId);
    const quantity = Dec.of(dto.quantity);
    if (quantity.isZero()) throw new BadRequestException('Enter a quantity other than zero.');
    const policy = await this.policy(organizationId);
    return this.prisma.$transaction((tx) =>
      this.stock.apply(
        tx,
        [{
          organizationId,
          itemId: dto.itemId,
          warehouseId: dto.warehouseId,
          quantity,
          type: dto.type,
          unitCost: dto.unitCost ? Dec.of(dto.unitCost) : undefined,
          reason: dto.reason,
          userId,
        }],
        policy,
      ),
    );
  }

  async transfer(userId: string, organizationId: string, dto: StockTransferDto) {
    await this.access.assertCanWrite(userId, organizationId);
    if (dto.fromWarehouseId === dto.toWarehouseId) throw new BadRequestException('Choose two different warehouses.');
    const quantity = Dec.of(dto.quantity);
    if (quantity.isZero()) throw new BadRequestException('Enter a quantity.');
    const group = this.stock.newTransferGroup();
    const reason = dto.reason ?? 'Transfer';
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.invItem.findFirst({ where: { id: dto.itemId, organizationId }, select: { averageCost: true } });
      if (!item) throw new NotFoundException('Item not found.');
      // Transfers never go negative, whatever the policy.
      return this.stock.apply(
        tx,
        [
          { organizationId, itemId: dto.itemId, warehouseId: dto.fromWarehouseId, quantity: quantity.neg(), type: 'TRANSFER_OUT', transferGroup: group, reason, userId },
          { organizationId, itemId: dto.itemId, warehouseId: dto.toWarehouseId, quantity, type: 'TRANSFER_IN', unitCost: Dec.of(item.averageCost.toString()), transferGroup: group, reason, userId },
        ],
        'BLOCK',
      );
    });
  }

  // ── Goods receipts (purchasing) ────────────────────────────

  async receive(userId: string, organizationId: string, dto: GoodsReceiptDto) {
    await this.access.assertCanWrite(userId, organizationId);
    await this.entitlements.assertFeature(organizationId, INVOICE_STUDIO_SLUG, 'purchasing', 'Purchasing');
    return this.prisma.$transaction(async (tx) => {
      let order: (InvDocument & { lines: InvDocumentLine[] }) | null = null;
      if (dto.purchaseOrderId) {
        await tx.$queryRaw`SELECT id FROM inv_documents WHERE id = ${dto.purchaseOrderId} AND organization_id = ${organizationId} FOR UPDATE`;
        order = await tx.invDocument.findFirst({
          where: { id: dto.purchaseOrderId, organizationId, documentType: 'PURCHASE_ORDER' },
          include: { lines: true },
        });
        if (!order) throw new NotFoundException('Purchase order not found.');
        if (!['ISSUED', 'PARTIALLY_RECEIVED'].includes(order.status)) {
          throw new ConflictException('Goods can be received only against an issued, open purchase order.');
        }
      }
      for (const line of dto.lines) {
        if (Dec.of(line.quantity).isZero()) throw new BadRequestException('Received quantities must be above zero.');
        if (!order) continue;
        const orderLine = order.lines.find((candidate) => candidate.id === line.purchaseOrderLineId);
        if (!orderLine || orderLine.itemId !== line.itemId) throw new BadRequestException('Each received line must match a purchase-order line.');
        const remaining = Dec.of(orderLine.quantity.toString()).sub(orderLine.receivedQuantity.toString());
        if (Dec.of(line.quantity).cmp(remaining) > 0) {
          throw new BadRequestException(`Only ${remaining.toString()} remain to be received on this order line.`);
        }
      }
      const receipt = await tx.invGoodsReceipt.create({
        data: {
          organizationId,
          purchaseOrderId: order?.id ?? null,
          warehouseId: dto.warehouseId,
          receivedOn: dateOnly(dto.receivedOn),
          supplierRef: dto.supplierRef ?? null,
          notes: dto.notes ?? null,
          linesJson: dto.lines as unknown as Prisma.InputJsonValue,
          createdByUserId: userId,
        },
      });
      await this.stock.apply(
        tx,
        dto.lines.map((line) => ({
          organizationId,
          itemId: line.itemId,
          warehouseId: dto.warehouseId,
          quantity: Dec.of(line.quantity),
          type: 'PURCHASE' as const,
          unitCost: Dec.of(line.unitCost),
          receiptId: receipt.id,
          reason: order?.number ? `Received on ${order.number}` : 'Goods received',
          userId,
        })),
        'ALLOW',
      );
      if (order) {
        for (const line of dto.lines) {
          await tx.invDocumentLine.update({
            where: { id: line.purchaseOrderLineId! },
            data: { receivedQuantity: { increment: line.quantity } },
          });
        }
        await this.refreshOrderStatus(tx, order.id);
      }
      return receipt;
    });
  }

  async cancelReceipt(userId: string, organizationId: string, id: string) {
    await this.access.assertCanManage(userId, organizationId);
    const policy = await this.policy(organizationId);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM inv_goods_receipts WHERE id = ${id} AND organization_id = ${organizationId} FOR UPDATE`;
      const receipt = await tx.invGoodsReceipt.findFirst({ where: { id, organizationId } });
      if (!receipt) throw new NotFoundException('Goods receipt not found.');
      if (receipt.status !== 'POSTED') throw new ConflictException('This receipt is already cancelled.');
      if (receipt.purchaseOrderId) {
        const order = await tx.invDocument.findUniqueOrThrow({ where: { id: receipt.purchaseOrderId }, select: { status: true } });
        if (order.status === 'CLOSED') throw new ConflictException('The purchase order has been billed; issue a purchase return instead.');
      }
      await this.stock.reverse(tx, organizationId, { receiptId: id }, userId, 'Goods receipt cancelled', policy);
      if (receipt.purchaseOrderId) {
        for (const line of receipt.linesJson as Array<{ purchaseOrderLineId?: string; quantity: string }>) {
          if (line.purchaseOrderLineId) {
            await tx.invDocumentLine.update({
              where: { id: line.purchaseOrderLineId },
              data: { receivedQuantity: { decrement: line.quantity } },
            });
          }
        }
        await this.refreshOrderStatus(tx, receipt.purchaseOrderId);
      }
      return tx.invGoodsReceipt.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
    });
  }

  private async refreshOrderStatus(tx: Prisma.TransactionClient, orderId: string) {
    const lines = await tx.invDocumentLine.findMany({ where: { documentId: orderId }, select: { quantity: true, receivedQuantity: true } });
    const received = lines.filter((line) => Dec.of(line.receivedQuantity.toString()).cmp(line.quantity.toString()) >= 0).length;
    const any = lines.some((line) => !Dec.of(line.receivedQuantity.toString()).isZero());
    const status = received === lines.length ? 'RECEIVED' : any ? 'PARTIALLY_RECEIVED' : 'ISSUED';
    await tx.invDocument.update({ where: { id: orderId }, data: { status } });
  }

  listReceipts(organizationId: string, purchaseOrderId?: string) {
    return this.prisma.invGoodsReceipt.findMany({
      where: { organizationId, ...(purchaseOrderId ? { purchaseOrderId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { warehouse: { select: { name: true } }, purchaseOrder: { select: { number: true } } },
    });
  }

  // ── Reports ─────────────────────────────────────────────────

  /** Stock on hand per item and warehouse, with value and low-stock flags. */
  async levels(organizationId: string, query: { warehouseId?: string; q?: string; low?: string }) {
    const items = await this.prisma.invItem.findMany({
      where: {
        organizationId,
        trackInventory: true,
        archivedAt: null,
        ...(query.q?.trim()
          ? { OR: [{ name: { contains: query.q.trim(), mode: 'insensitive' } }, { sku: { contains: query.q.trim(), mode: 'insensitive' } }] }
          : {}),
      },
      include: { stockLevels: { where: query.warehouseId ? { warehouseId: query.warehouseId } : {} } },
      orderBy: { name: 'asc' },
      take: 2000,
    });
    const rows = items.map((item) => {
      const onHand = item.stockLevels.reduce((total, level) => total.add(level.onHand.toString()), Dec.ZERO);
      const reorder = item.reorderLevel ? Dec.of(item.reorderLevel.toString()) : null;
      return {
        itemId: item.id,
        name: item.name,
        sku: item.sku,
        unit: item.unit,
        onHand: onHand.toString(),
        averageCost: item.averageCost.toString(),
        value: onHand.isNegative() ? '0' : onHand.mul(item.averageCost.toString()).round(2).toFixed(2),
        reorderLevel: reorder?.toString() ?? null,
        low: reorder ? onHand.cmp(reorder) <= 0 : false,
        byWarehouse: item.stockLevels.map((level) => ({ warehouseId: level.warehouseId, onHand: level.onHand.toString() })),
      };
    });
    const filtered = query.low === 'true' ? rows.filter((row) => row.low) : rows;
    return {
      items: filtered,
      totalValue: filtered.reduce((total, row) => total.add(row.value), Dec.ZERO).toFixed(2),
      lowCount: rows.filter((row) => row.low).length,
    };
  }

  async movements(organizationId: string, query: { itemId?: string; warehouseId?: string; page?: string }) {
    const page = Math.max(1, Number(query.page) || 1);
    const where: Prisma.InvStockMovementWhereInput = {
      organizationId,
      ...(query.itemId ? { itemId: query.itemId } : {}),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.invStockMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          item: { select: { name: true, unit: true } },
          warehouse: { select: { name: true } },
          document: { select: { number: true, documentType: true } },
        },
      }),
      this.prisma.invStockMovement.count({ where }),
    ]);
    return { items, total, page, pageSize: PAGE_SIZE };
  }

  reconcile(organizationId: string) {
    return this.stock.reconcile(organizationId);
  }
}
