import { Module } from '@nestjs/common';
import { TransactionalEmailService } from '../auth/transactional-email.service';
import { FilesModule } from '../files/files.module';
import { InventoryController } from '../inventory/inventory.controller';
import { InventoryService } from '../inventory/inventory.service';
import { StockService } from '../inventory/stock.service';
import { SaasPlansModule } from '../saas-plans/saas-plans.module';
import { BusinessesService } from './businesses.service';
import { ContactsService, ItemsService } from './contacts-items.service';
import { DocumentRenderService } from './document-render.service';
import { DocumentsService } from './documents.service';
import { ReportsService } from './reports.service';
import { InvoicingAutomationService, RecurringService } from './automation.service';
import { InvoicingAccessService } from './invoicing.common';
import { DocumentsController, InvoicingController, PublicInvoicesController } from './invoicing.controller';

/** Invoice Studio (sales and purchase documents) and Inventory (stock, warehouses, receipts). */
@Module({
  imports: [FilesModule, SaasPlansModule],
  controllers: [InvoicingController, DocumentsController, PublicInvoicesController, InventoryController],
  providers: [
    InvoicingAccessService,
    BusinessesService,
    ContactsService,
    ItemsService,
    DocumentRenderService,
    DocumentsService,
    ReportsService,
    RecurringService,
    InvoicingAutomationService,
    StockService,
    InventoryService,
    TransactionalEmailService,
  ],
})
export class InvoicingModule {}
