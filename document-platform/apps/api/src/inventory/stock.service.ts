import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Dec } from '@docconv/invoice-engine';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma.service';

export type NegativeStockPolicy = 'BLOCK' | 'WARN' | 'ALLOW';
type Tx = Prisma.TransactionClient;

export interface StockMove {
  organizationId: string;
  itemId: string;
  warehouseId: string;
  /** Signed quantity: positive adds stock. */
  quantity: Dec;
  type:
    | 'OPENING'
    | 'SALE'
    | 'SALE_RETURN'
    | 'PURCHASE'
    | 'PURCHASE_RETURN'
    | 'ADJUSTMENT'
    | 'TRANSFER_IN'
    | 'TRANSFER_OUT'
    | 'REVERSAL';
  /** Cost per unit; on incoming stock it updates the weighted-average cost. */
  unitCost?: Dec;
  documentId?: string;
  receiptId?: string;
  transferGroup?: string;
  reason?: string;
  userId: string;
}

/** Sales documents remove stock; purchase bills and returns add it. */
const OUTGOING_TYPES = new Set(['TAX_INVOICE', 'BILL_OF_SUPPLY', 'EXPORT_INVOICE', 'DELIVERY_CHALLAN']);

/**
 * Inventory ledger. Every change is an append-only movement plus an update
 * of the per-warehouse level, in the caller's transaction. Item and level
 * rows are locked in a fixed order (item id, then warehouse id), so two
 * concurrent sales of the last unit are serialised and cannot deadlock.
 */
@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async apply(tx: Tx, moves: StockMove[], policy: NegativeStockPolicy): Promise<{ warnings: string[] }> {
    const warnings: string[] = [];
    if (!moves.length) return { warnings };
    const organizationId = moves[0]!.organizationId;
    if (moves.some((move) => move.organizationId !== organizationId)) throw new Error('Moves span organizations.');

    const itemIds = [...new Set(moves.map((move) => move.itemId))].sort();
    const warehouseIds = [...new Set(moves.map((move) => move.warehouseId))];
    const [items, warehouses] = await Promise.all([
      tx.invItem.findMany({ where: { id: { in: itemIds }, organizationId } }),
      tx.invWarehouse.findMany({ where: { id: { in: warehouseIds }, organizationId } }),
    ]);
    if (items.length !== itemIds.length) throw new NotFoundException('An item in this stock change was not found.');
    if (warehouses.length !== warehouseIds.length) throw new NotFoundException('A warehouse in this stock change was not found.');
    const itemById = new Map(items.map((item) => [item.id, item]));
    const warehouseById = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));
    for (const item of items) {
      if (!item.trackInventory) throw new BadRequestException(`${item.name} does not track stock.`);
    }

    // Lock items first (average cost), then levels, always in sorted order.
    await tx.$queryRaw`SELECT id FROM inv_items WHERE id IN (${Prisma.join(itemIds)}) ORDER BY id FOR UPDATE`;
    const ordered = [...moves].sort((a, b) =>
      a.itemId === b.itemId ? a.warehouseId.localeCompare(b.warehouseId) : a.itemId.localeCompare(b.itemId),
    );
    for (const move of ordered) {
      // Atomic "create if missing" so concurrent first movements do not race.
      await tx.$executeRaw`
        INSERT INTO inv_stock_levels (id, organization_id, item_id, warehouse_id, on_hand, updated_at)
        VALUES (${randomUUID()}, ${organizationId}, ${move.itemId}, ${move.warehouseId}, 0, NOW())
        ON CONFLICT (item_id, warehouse_id) DO NOTHING`;
    }
    const pairs = [...new Set(ordered.map((move) => `${move.itemId}|${move.warehouseId}`))];
    for (const pair of pairs) {
      const [itemId, warehouseId] = pair.split('|');
      await tx.$queryRaw`SELECT id FROM inv_stock_levels WHERE item_id = ${itemId} AND warehouse_id = ${warehouseId} FOR UPDATE`;
    }

    for (const move of ordered) {
      const item = itemById.get(move.itemId)!;
      const level = await tx.invStockLevel.findUniqueOrThrow({
        where: { itemId_warehouseId: { itemId: move.itemId, warehouseId: move.warehouseId } },
      });
      const before = Dec.of(level.onHand.toString());
      const after = before.add(move.quantity);
      if (move.quantity.isNegative() && after.isNegative()) {
        const message = `Not enough stock of ${item.name} in ${warehouseById.get(move.warehouseId)!.name}: ${before.toString()} available, ${move.quantity.neg().toString()} needed.`;
        if (policy === 'BLOCK') throw new ConflictException(message);
        if (policy === 'WARN') warnings.push(message);
      }

      if (!move.quantity.isNegative() && move.unitCost && move.type !== 'TRANSFER_IN') {
        // Weighted average across all warehouses: (Q·A + q·c) / (Q + q).
        const totals = await tx.invStockLevel.aggregate({ where: { itemId: move.itemId }, _sum: { onHand: true } });
        const onHand = Dec.of(totals._sum.onHand?.toString() ?? '0');
        const existingQty = onHand.isNegative() ? Dec.ZERO : onHand;
        const current = await tx.invItem.findUniqueOrThrow({ where: { id: move.itemId }, select: { averageCost: true } });
        const newQty = existingQty.add(move.quantity);
        const average = newQty.cmp(0) > 0
          ? existingQty.mul(current.averageCost.toString()).add(move.quantity.mul(move.unitCost)).div(newQty, 4)
          : move.unitCost.round(4);
        await tx.invItem.update({ where: { id: move.itemId }, data: { averageCost: average.toFixed(4) } });
      }

      await tx.invStockLevel.update({ where: { id: level.id }, data: { onHand: after.toFixed(4) } });
      await tx.invStockMovement.create({
        data: {
          organizationId,
          itemId: move.itemId,
          warehouseId: move.warehouseId,
          type: move.type,
          quantity: move.quantity.toFixed(4),
          unitCost: move.unitCost?.toFixed(4) ?? null,
          balanceAfter: after.toFixed(4),
          documentId: move.documentId ?? null,
          receiptId: move.receiptId ?? null,
          transferGroup: move.transferGroup ?? null,
          reason: move.reason?.slice(0, 300) ?? null,
          userId: move.userId,
        },
      });
    }
    return { warnings };
  }

  /** Default stock location: the business's default, else the workspace's. */
  async defaultWarehouseId(tx: Tx, organizationId: string, businessId?: string) {
    const warehouse =
      (businessId
        ? await tx.invWarehouse.findFirst({ where: { organizationId, businessId, archivedAt: null }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] })
        : null) ??
      (await tx.invWarehouse.findFirst({ where: { organizationId, archivedAt: null }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }));
    if (!warehouse) throw new ConflictException('Create a warehouse before moving stock.');
    return warehouse.id;
  }

  /**
   * Stock effect of issuing a document. Returns whether any stock moved (so
   * voiding knows to reverse it).
   */
  async postDocument(
    tx: Tx,
    document: {
      id: string;
      organizationId: string;
      businessId: string;
      documentType: string;
      returnToStock: boolean;
      warehouseId: string | null;
      lines: Array<{ itemId: string | null; quantity: Prisma.Decimal; taxable: Prisma.Decimal; warehouseId: string | null }>;
    },
    userId: string,
    policy: NegativeStockPolicy,
  ) {
    const outgoing = OUTGOING_TYPES.has(document.documentType);
    const incoming = document.documentType === 'PURCHASE_BILL' || (document.documentType === 'CREDIT_NOTE' && document.returnToStock);
    if (!outgoing && !incoming) return { posted: false, warnings: [] as string[] };

    const itemIds = [...new Set(document.lines.map((line) => line.itemId).filter((id): id is string => Boolean(id)))];
    if (!itemIds.length) return { posted: false, warnings: [] as string[] };
    const tracked = await tx.invItem.findMany({
      where: { id: { in: itemIds }, organizationId: document.organizationId, trackInventory: true },
      select: { id: true, averageCost: true },
    });
    const trackedById = new Map(tracked.map((item) => [item.id, item]));
    let fallbackWarehouse: string | null = null;
    const moves: StockMove[] = [];
    for (const line of document.lines) {
      const item = line.itemId ? trackedById.get(line.itemId) : undefined;
      if (!item) continue;
      const quantity = Dec.of(line.quantity.toString());
      if (quantity.isZero()) continue;
      fallbackWarehouse ??= document.warehouseId ?? (await this.defaultWarehouseId(tx, document.organizationId, document.businessId));
      const warehouseId = line.warehouseId ?? fallbackWarehouse;
      const purchase = document.documentType === 'PURCHASE_BILL';
      moves.push({
        organizationId: document.organizationId,
        itemId: item.id,
        warehouseId,
        quantity: outgoing ? quantity.neg() : quantity,
        type: outgoing ? 'SALE' : purchase ? 'PURCHASE' : 'SALE_RETURN',
        // Purchases enter at their net cost; returns at the current average.
        unitCost: purchase ? Dec.of(line.taxable.toString()).div(quantity, 4) : Dec.of(item.averageCost.toString()),
        documentId: document.id,
        userId,
      });
    }
    const result = await this.apply(tx, moves, policy);
    return { posted: moves.length > 0, warnings: result.warnings };
  }

  /** Reverses every movement a document (or receipt) made. */
  async reverse(
    tx: Tx,
    organizationId: string,
    source: { documentId?: string; receiptId?: string },
    userId: string,
    reason: string,
    policy: NegativeStockPolicy,
  ) {
    const original = await tx.invStockMovement.findMany({
      where: { organizationId, ...source, type: { not: 'REVERSAL' } },
      orderBy: { createdAt: 'asc' },
    });
    return this.apply(
      tx,
      original.map((movement) => ({
        organizationId,
        itemId: movement.itemId,
        warehouseId: movement.warehouseId,
        quantity: Dec.of(movement.quantity.toString()).neg(),
        type: 'REVERSAL' as const,
        unitCost: movement.unitCost ? Dec.of(movement.unitCost.toString()) : undefined,
        ...source,
        reason,
        userId,
      })),
      policy,
    );
  }

  newTransferGroup() {
    return randomUUID();
  }

  /**
   * Levels that disagree with the ledger. Must always be empty; exposed for
   * monitoring and tests.
   */
  async reconcile(organizationId: string) {
    return this.prisma.$queryRaw<Array<{ item_id: string; warehouse_id: string; on_hand: string; ledger: string }>>`
      SELECT l.item_id, l.warehouse_id, l.on_hand::text, COALESCE(SUM(m.quantity), 0)::text AS ledger
      FROM inv_stock_levels l
      LEFT JOIN inv_stock_movements m ON m.item_id = l.item_id AND m.warehouse_id = l.warehouse_id
      WHERE l.organization_id = ${organizationId}
      GROUP BY l.id, l.item_id, l.warehouse_id, l.on_hand
      HAVING l.on_hand <> COALESCE(SUM(m.quantity), 0)`;
  }
}
