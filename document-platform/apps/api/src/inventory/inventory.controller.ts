import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequireFeatures } from '../feature-flags/require-features.decorator';
import { InvoicingAccessService } from '../invoicing/invoicing.common';
import { GoodsReceiptDto, StockAdjustmentDto, StockTransferDto, WarehouseDto } from '../invoicing/invoicing.dto';
import { InventoryService } from './inventory.service';

const ok = <T>(data: T) => ({ success: true, data });

@Controller('inventory')
@UseGuards(JwtAuthGuard)
@RequireFeatures('invoicing', 'inventory')
export class InventoryController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly access: InvoicingAccessService,
  ) {}

  @Get('warehouses')
  async warehouses(@Request() req: any) {
    return ok(await this.inventory.listWarehouses(req.user.orgId));
  }

  @Post('warehouses')
  async createWarehouse(@Request() req: any, @Body() dto: WarehouseDto) {
    return ok(await this.inventory.createWarehouse(req.user.userId, req.user.orgId, dto));
  }

  @Patch('warehouses/:id')
  async updateWarehouse(@Request() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: WarehouseDto) {
    return ok(await this.inventory.updateWarehouse(req.user.userId, req.user.orgId, id, dto));
  }

  @Delete('warehouses/:id')
  async archiveWarehouse(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return ok(await this.inventory.archiveWarehouse(req.user.userId, req.user.orgId, id));
  }

  @Post('adjustments')
  async adjust(@Request() req: any, @Body() dto: StockAdjustmentDto) {
    return ok(await this.inventory.adjust(req.user.userId, req.user.orgId, dto));
  }

  @Post('transfers')
  async transfer(@Request() req: any, @Body() dto: StockTransferDto) {
    return ok(await this.inventory.transfer(req.user.userId, req.user.orgId, dto));
  }

  @Get('receipts')
  async receipts(@Request() req: any, @Query('purchaseOrderId') purchaseOrderId?: string) {
    return ok(await this.inventory.listReceipts(req.user.orgId, purchaseOrderId));
  }

  @Post('receipts')
  async receive(@Request() req: any, @Body() dto: GoodsReceiptDto) {
    return ok(await this.inventory.receive(req.user.userId, req.user.orgId, dto));
  }

  @Post('receipts/:id/cancel')
  async cancelReceipt(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return ok(await this.inventory.cancelReceipt(req.user.userId, req.user.orgId, id));
  }

  @Get('levels')
  async levels(@Request() req: any, @Query('warehouseId') warehouseId?: string, @Query('q') q?: string, @Query('low') low?: string) {
    return ok(await this.inventory.levels(req.user.orgId, { warehouseId, q, low }));
  }

  @Get('movements')
  async movements(@Request() req: any, @Query('itemId') itemId?: string, @Query('warehouseId') warehouseId?: string, @Query('page') page?: string) {
    return ok(await this.inventory.movements(req.user.orgId, { itemId, warehouseId, page }));
  }

  /** Ledger vs level check (must be empty). */
  @Get('reconcile')
  async reconcile(@Request() req: any) {
    await this.access.assertCanManage(req.user.userId, req.user.orgId);
    return ok(await this.inventory.reconcile(req.user.orgId));
  }
}
