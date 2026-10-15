-- Invoice Studio + Inventory: businesses, numbering series, contacts, items,
-- sales/purchase documents with lines and payments, share links, warehouses,
-- stock levels, the append-only stock ledger and goods receipts.

-- CreateTable
CREATE TABLE "inv_businesses" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legal_name" TEXT,
    "country" VARCHAR(2) NOT NULL,
    "state_code" VARCHAR(2),
    "address_json" JSONB NOT NULL DEFAULT '{}',
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "tax_regime" VARCHAR(16) NOT NULL,
    "tax_id" TEXT,
    "gst_composition" BOOLEAN NOT NULL DEFAULT false,
    "currency" VARCHAR(3) NOT NULL,
    "language" VARCHAR(35) NOT NULL DEFAULT 'en',
    "secondary_language" VARCHAR(35),
    "template" VARCHAR(40) NOT NULL DEFAULT 'classic',
    "accent_color" VARCHAR(7),
    "logo_storage_key" TEXT,
    "signature_storage_key" TEXT,
    "bank_json" JSONB NOT NULL DEFAULT '{}',
    "payment_qr" VARCHAR(8) NOT NULL DEFAULT 'none',
    "prices_include_tax" BOOLEAN NOT NULL DEFAULT false,
    "round_off_total" BOOLEAN NOT NULL DEFAULT false,
    "negative_stock_policy" VARCHAR(8) NOT NULL DEFAULT 'BLOCK',
    "fy_start_month" INTEGER NOT NULL DEFAULT 1,
    "numbering_json" JSONB NOT NULL DEFAULT '{}',
    "label_overrides_json" JSONB NOT NULL DEFAULT '{}',
    "default_notes" TEXT,
    "default_terms" TEXT,
    "default_due_days" INTEGER NOT NULL DEFAULT 15,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inv_businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inv_series" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "document_type" VARCHAR(40) NOT NULL,
    "period_key" VARCHAR(20) NOT NULL,
    "next_number" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "inv_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inv_contacts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "is_customer" BOOLEAN NOT NULL DEFAULT true,
    "is_supplier" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "legal_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "country" VARCHAR(2) NOT NULL,
    "state_code" VARCHAR(2),
    "billing_address_json" JSONB NOT NULL DEFAULT '{}',
    "shipping_address_json" JSONB,
    "tax_id" TEXT,
    "is_business" BOOLEAN NOT NULL DEFAULT true,
    "is_sez" BOOLEAN NOT NULL DEFAULT false,
    "currency" VARCHAR(3),
    "language" VARCHAR(35),
    "payment_terms_days" INTEGER,
    "notes" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inv_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inv_items" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kind" VARCHAR(10) NOT NULL DEFAULT 'GOODS',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sku" VARCHAR(64),
    "barcode" VARCHAR(64),
    "unit" VARCHAR(16) NOT NULL DEFAULT 'pcs',
    "hsn_sac" VARCHAR(12),
    "tax_rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "cess_rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "tax_category" VARCHAR(16) NOT NULL DEFAULT 'STANDARD',
    "sale_price" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "purchase_price" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "track_inventory" BOOLEAN NOT NULL DEFAULT false,
    "reorder_level" DECIMAL(18,4),
    "average_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inv_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inv_documents" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "document_type" VARCHAR(40) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "number" VARCHAR(40),
    "issue_date" DATE NOT NULL,
    "due_date" DATE,
    "supply_date" DATE,
    "contact_id" TEXT,
    "seller_json" JSONB NOT NULL DEFAULT '{}',
    "buyer_json" JSONB NOT NULL DEFAULT '{}',
    "ship_to_json" JSONB,
    "place_of_supply_country" VARCHAR(2),
    "place_of_supply_state" VARCHAR(2),
    "currency" VARCHAR(3) NOT NULL,
    "language" VARCHAR(35) NOT NULL,
    "secondary_language" VARCHAR(35),
    "template" VARCHAR(40) NOT NULL,
    "prices_include_tax" BOOLEAN NOT NULL DEFAULT false,
    "reverse_charge" BOOLEAN NOT NULL DEFAULT false,
    "export_with_payment" BOOLEAN NOT NULL DEFAULT false,
    "eu_oss" BOOLEAN NOT NULL DEFAULT false,
    "round_off_total" BOOLEAN NOT NULL DEFAULT false,
    "reference" VARCHAR(80),
    "notes" TEXT,
    "terms" TEXT,
    "reference_document_id" TEXT,
    "return_to_stock" BOOLEAN NOT NULL DEFAULT false,
    "warehouse_id" TEXT,
    "stock_posted" BOOLEAN NOT NULL DEFAULT false,
    "calculation_json" JSONB NOT NULL DEFAULT '{}',
    "taxable_total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "amount_paid" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "pdf_storage_key" TEXT,
    "pdf_sha256" VARCHAR(64),
    "issued_at" TIMESTAMP(3),
    "issued_by_user_id" TEXT,
    "issue_idempotency_key" VARCHAR(80),
    "voided_at" TIMESTAMP(3),
    "void_reason" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inv_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inv_document_lines" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "item_id" TEXT,
    "description" TEXT NOT NULL,
    "details" TEXT,
    "hsn_sac" VARCHAR(12),
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit" VARCHAR(16),
    "unit_price" DECIMAL(18,4) NOT NULL,
    "discount_type" VARCHAR(8),
    "discount_value" DECIMAL(18,4),
    "tax_rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "cess_rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "tax_category" VARCHAR(16) NOT NULL DEFAULT 'STANDARD',
    "supply_kind" VARCHAR(10) NOT NULL DEFAULT 'GOODS',
    "warehouse_id" TEXT,
    "received_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "taxable" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "taxes_json" JSONB NOT NULL DEFAULT '[]',
    "total" DECIMAL(18,4) NOT NULL DEFAULT 0,

    CONSTRAINT "inv_document_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inv_payments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "paid_on" DATE NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "reference" VARCHAR(80),
    "notes" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inv_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inv_share_links" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "last_viewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inv_share_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inv_warehouses" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "business_id" TEXT,
    "name" TEXT NOT NULL,
    "code" VARCHAR(20),
    "address_json" JSONB NOT NULL DEFAULT '{}',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inv_warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inv_stock_levels" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "on_hand" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inv_stock_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inv_stock_movements" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit_cost" DECIMAL(18,4),
    "balance_after" DECIMAL(18,4) NOT NULL,
    "document_id" TEXT,
    "receipt_id" TEXT,
    "transfer_group" TEXT,
    "reason" TEXT,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inv_stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inv_goods_receipts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "purchase_order_id" TEXT,
    "warehouse_id" TEXT NOT NULL,
    "received_on" DATE NOT NULL,
    "supplier_ref" VARCHAR(80),
    "notes" TEXT,
    "status" VARCHAR(10) NOT NULL DEFAULT 'POSTED',
    "lines_json" JSONB NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inv_goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inv_businesses_organization_id_idx" ON "inv_businesses"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "inv_series_business_id_document_type_period_key_key" ON "inv_series"("business_id", "document_type", "period_key");

-- CreateIndex
CREATE INDEX "inv_contacts_organization_id_name_idx" ON "inv_contacts"("organization_id", "name");

-- CreateIndex
CREATE INDEX "inv_items_organization_id_name_idx" ON "inv_items"("organization_id", "name");

-- CreateIndex
CREATE INDEX "inv_items_organization_id_barcode_idx" ON "inv_items"("organization_id", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "inv_items_organization_id_sku_key" ON "inv_items"("organization_id", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "inv_documents_issue_idempotency_key_key" ON "inv_documents"("issue_idempotency_key");

-- CreateIndex
CREATE INDEX "inv_documents_organization_id_document_type_status_idx" ON "inv_documents"("organization_id", "document_type", "status");

-- CreateIndex
CREATE INDEX "inv_documents_organization_id_contact_id_idx" ON "inv_documents"("organization_id", "contact_id");

-- CreateIndex
CREATE INDEX "inv_documents_organization_id_issue_date_idx" ON "inv_documents"("organization_id", "issue_date");

-- CreateIndex
CREATE UNIQUE INDEX "inv_documents_business_id_document_type_number_key" ON "inv_documents"("business_id", "document_type", "number");

-- CreateIndex
CREATE INDEX "inv_document_lines_document_id_position_idx" ON "inv_document_lines"("document_id", "position");

-- CreateIndex
CREATE INDEX "inv_document_lines_item_id_idx" ON "inv_document_lines"("item_id");

-- CreateIndex
CREATE INDEX "inv_payments_organization_id_paid_on_idx" ON "inv_payments"("organization_id", "paid_on");

-- CreateIndex
CREATE INDEX "inv_payments_document_id_idx" ON "inv_payments"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "inv_share_links_token_hash_key" ON "inv_share_links"("token_hash");

-- CreateIndex
CREATE INDEX "inv_share_links_document_id_idx" ON "inv_share_links"("document_id");

-- CreateIndex
CREATE INDEX "inv_warehouses_organization_id_idx" ON "inv_warehouses"("organization_id");

-- CreateIndex
CREATE INDEX "inv_stock_levels_organization_id_idx" ON "inv_stock_levels"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "inv_stock_levels_item_id_warehouse_id_key" ON "inv_stock_levels"("item_id", "warehouse_id");

-- CreateIndex
CREATE INDEX "inv_stock_movements_organization_id_created_at_idx" ON "inv_stock_movements"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "inv_stock_movements_item_id_warehouse_id_created_at_idx" ON "inv_stock_movements"("item_id", "warehouse_id", "created_at");

-- CreateIndex
CREATE INDEX "inv_stock_movements_document_id_idx" ON "inv_stock_movements"("document_id");

-- CreateIndex
CREATE INDEX "inv_goods_receipts_organization_id_received_on_idx" ON "inv_goods_receipts"("organization_id", "received_on");

-- CreateIndex
CREATE INDEX "inv_goods_receipts_purchase_order_id_idx" ON "inv_goods_receipts"("purchase_order_id");

-- AddForeignKey
ALTER TABLE "inv_businesses" ADD CONSTRAINT "inv_businesses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inv_series" ADD CONSTRAINT "inv_series_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "inv_businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inv_contacts" ADD CONSTRAINT "inv_contacts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inv_items" ADD CONSTRAINT "inv_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inv_documents" ADD CONSTRAINT "inv_documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inv_documents" ADD CONSTRAINT "inv_documents_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "inv_businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inv_documents" ADD CONSTRAINT "inv_documents_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "inv_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inv_documents" ADD CONSTRAINT "inv_documents_reference_document_id_fkey" FOREIGN KEY ("reference_document_id") REFERENCES "inv_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inv_document_lines" ADD CONSTRAINT "inv_document_lines_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "inv_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inv_payments" ADD CONSTRAINT "inv_payments_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "inv_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inv_share_links" ADD CONSTRAINT "inv_share_links_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "inv_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inv_warehouses" ADD CONSTRAINT "inv_warehouses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inv_warehouses" ADD CONSTRAINT "inv_warehouses_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "inv_businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inv_stock_levels" ADD CONSTRAINT "inv_stock_levels_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inv_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inv_stock_levels" ADD CONSTRAINT "inv_stock_levels_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inv_warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inv_stock_movements" ADD CONSTRAINT "inv_stock_movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inv_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inv_stock_movements" ADD CONSTRAINT "inv_stock_movements_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inv_warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inv_stock_movements" ADD CONSTRAINT "inv_stock_movements_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "inv_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inv_stock_movements" ADD CONSTRAINT "inv_stock_movements_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "inv_goods_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inv_goods_receipts" ADD CONSTRAINT "inv_goods_receipts_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "inv_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inv_goods_receipts" ADD CONSTRAINT "inv_goods_receipts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inv_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

