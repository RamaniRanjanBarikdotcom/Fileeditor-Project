-- Generic SaaS plans shared by every SaaS app (Invoice Studio first; Blog Studio
-- can move onto it). Prices are per plan, currency and interval, which the
-- legacy prices(product_id, currency) uniqueness could not express.

-- AlterTable
ALTER TABLE "saas_subscriptions" ADD COLUMN     "plan_id" TEXT;

-- CreateTable
CREATE TABLE "saas_plans" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "key" VARCHAR(40) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "is_free" BOOLEAN NOT NULL DEFAULT false,
    "limits_json" JSONB NOT NULL,
    "features_json" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saas_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_plan_prices" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "currency" "CurrencyCode" NOT NULL,
    "interval" "BillingInterval" NOT NULL,
    "amount_minor_units" INTEGER NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "provider_price_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saas_plan_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_usage_counters" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "metric" VARCHAR(60) NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saas_usage_counters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "saas_plans_product_id_key_key" ON "saas_plans"("product_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "saas_plan_prices_plan_id_currency_interval_key" ON "saas_plan_prices"("plan_id", "currency", "interval");

-- CreateIndex
CREATE UNIQUE INDEX "saas_usage_counters_organization_id_product_id_metric_windo_key" ON "saas_usage_counters"("organization_id", "product_id", "metric", "window_start");

-- AddForeignKey
ALTER TABLE "saas_subscriptions" ADD CONSTRAINT "saas_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "saas_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_plans" ADD CONSTRAINT "saas_plans_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_plan_prices" ADD CONSTRAINT "saas_plan_prices_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "saas_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_usage_counters" ADD CONSTRAINT "saas_usage_counters_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_usage_counters" ADD CONSTRAINT "saas_usage_counters_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

