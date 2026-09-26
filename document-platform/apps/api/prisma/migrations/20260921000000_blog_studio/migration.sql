CREATE TYPE "BillingType" AS ENUM ('ONE_TIME', 'RECURRING');
CREATE TYPE "BillingInterval" AS ENUM ('MONTH', 'YEAR');
CREATE TYPE "BlogDocumentStatus" AS ENUM ('DRAFT', 'READY', 'ARCHIVED', 'DELETED');
CREATE TYPE "BlogGenerationStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "BlogExportStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

ALTER TABLE "prices"
  ADD COLUMN "billing_type" "BillingType" NOT NULL DEFAULT 'ONE_TIME',
  ADD COLUMN "billing_interval" "BillingInterval";

CREATE TABLE "blog_documents" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "created_by_user_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "html" TEXT NOT NULL,
  "editor_json" JSONB NOT NULL,
  "metadata_json" JSONB NOT NULL,
  "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "seo_score" INTEGER NOT NULL DEFAULT 0,
  "language" TEXT NOT NULL,
  "word_count" INTEGER NOT NULL DEFAULT 0,
  "status" "BlogDocumentStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "blog_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "blog_generation_jobs" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "blog_id" TEXT,
  "input_json" JSONB NOT NULL,
  "checkpoint_json" JSONB,
  "progress" INTEGER NOT NULL DEFAULT 0,
  "current_stage" TEXT,
  "model" TEXT,
  "status" "BlogGenerationStatus" NOT NULL DEFAULT 'QUEUED',
  "error_code" TEXT,
  "error_message" TEXT,
  "cancel_requested_at" TIMESTAMP(3),
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "blog_generation_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "blog_sources" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "blog_id" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "citation_json" JSONB,
  "retrieved_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "blog_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "blog_images" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "blog_id" TEXT NOT NULL,
  "created_by_user_id" TEXT NOT NULL,
  "storage_key" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "prompt" TEXT NOT NULL,
  "credits" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "blog_images_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "blog_exports" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "blog_id" TEXT NOT NULL,
  "created_by_user_id" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "storage_key" TEXT,
  "mime_type" TEXT,
  "status" "BlogExportStatus" NOT NULL DEFAULT 'QUEUED',
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "blog_exports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "saas_subscriptions" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "provider_sub_id" TEXT NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'INCOMPLETE',
  "currency" "CurrencyCode" NOT NULL,
  "current_period_start" TIMESTAMP(3) NOT NULL,
  "current_period_end" TIMESTAMP(3) NOT NULL,
  "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "saas_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "saas_usage_windows" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "window_start" TIMESTAMP(3) NOT NULL,
  "window_end" TIMESTAMP(3) NOT NULL,
  "blog_limit" INTEGER NOT NULL,
  "credit_limit" INTEGER NOT NULL,
  "blogs_consumed" INTEGER NOT NULL DEFAULT 0,
  "credits_consumed" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "saas_usage_windows_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "saas_usage_reservations" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "usage_window_id" TEXT NOT NULL,
  "generation_job_id" TEXT NOT NULL,
  "estimated_credits" INTEGER NOT NULL,
  "reserves_blog" BOOLEAN NOT NULL DEFAULT true,
  "status" "ReservationStatus" NOT NULL DEFAULT 'RESERVED',
  "expires_at" TIMESTAMP(3) NOT NULL,
  "settled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saas_usage_reservations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "saas_usage_records" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "usage_window_id" TEXT NOT NULL,
  "generation_job_id" TEXT,
  "usage_type" TEXT NOT NULL,
  "input_tokens" INTEGER NOT NULL DEFAULT 0,
  "output_tokens" INTEGER NOT NULL DEFAULT 0,
  "image_count" INTEGER NOT NULL DEFAULT 0,
  "credits" INTEGER NOT NULL DEFAULT 0,
  "completed_blogs" INTEGER NOT NULL DEFAULT 0,
  "model" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saas_usage_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_model_prices" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "input_per_million_usd" DECIMAL(12,6) NOT NULL,
  "output_per_million_usd" DECIMAL(12,6) NOT NULL,
  "image_usd" DECIMAL(12,6) NOT NULL,
  "effective_from" TIMESTAMP(3) NOT NULL,
  "effective_to" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_model_prices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "blog_documents_organization_id_slug_key" ON "blog_documents"("organization_id", "slug");
CREATE INDEX "blog_documents_organization_id_status_updated_at_idx" ON "blog_documents"("organization_id", "status", "updated_at");
CREATE INDEX "blog_generation_jobs_organization_id_status_created_at_idx" ON "blog_generation_jobs"("organization_id", "status", "created_at");
CREATE INDEX "blog_generation_jobs_user_id_created_at_idx" ON "blog_generation_jobs"("user_id", "created_at");
CREATE INDEX "blog_sources_organization_id_blog_id_idx" ON "blog_sources"("organization_id", "blog_id");
CREATE INDEX "blog_images_organization_id_blog_id_idx" ON "blog_images"("organization_id", "blog_id");
CREATE INDEX "blog_exports_organization_id_blog_id_created_at_idx" ON "blog_exports"("organization_id", "blog_id", "created_at");
CREATE UNIQUE INDEX "saas_subscriptions_provider_sub_id_key" ON "saas_subscriptions"("provider_sub_id");
CREATE UNIQUE INDEX "saas_subscriptions_organization_id_product_id_key" ON "saas_subscriptions"("organization_id", "product_id");
CREATE INDEX "saas_subscriptions_organization_id_status_idx" ON "saas_subscriptions"("organization_id", "status");
CREATE UNIQUE INDEX "saas_usage_windows_organization_id_product_id_window_start_key" ON "saas_usage_windows"("organization_id", "product_id", "window_start");
CREATE INDEX "saas_usage_windows_organization_id_window_end_idx" ON "saas_usage_windows"("organization_id", "window_end");
CREATE UNIQUE INDEX "saas_usage_reservations_generation_job_id_key" ON "saas_usage_reservations"("generation_job_id");
CREATE INDEX "saas_usage_reservations_organization_id_status_expires_at_idx" ON "saas_usage_reservations"("organization_id", "status", "expires_at");
CREATE UNIQUE INDEX "saas_usage_records_generation_job_id_usage_type_key" ON "saas_usage_records"("generation_job_id", "usage_type");
CREATE INDEX "saas_usage_records_organization_id_created_at_idx" ON "saas_usage_records"("organization_id", "created_at");
CREATE UNIQUE INDEX "ai_model_prices_provider_model_version_key" ON "ai_model_prices"("provider", "model", "version");
CREATE INDEX "ai_model_prices_provider_model_effective_from_idx" ON "ai_model_prices"("provider", "model", "effective_from");

ALTER TABLE "blog_documents" ADD CONSTRAINT "blog_documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blog_documents" ADD CONSTRAINT "blog_documents_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "blog_generation_jobs" ADD CONSTRAINT "blog_generation_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blog_generation_jobs" ADD CONSTRAINT "blog_generation_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "blog_generation_jobs" ADD CONSTRAINT "blog_generation_jobs_blog_id_fkey" FOREIGN KEY ("blog_id") REFERENCES "blog_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "blog_sources" ADD CONSTRAINT "blog_sources_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blog_sources" ADD CONSTRAINT "blog_sources_blog_id_fkey" FOREIGN KEY ("blog_id") REFERENCES "blog_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blog_images" ADD CONSTRAINT "blog_images_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blog_images" ADD CONSTRAINT "blog_images_blog_id_fkey" FOREIGN KEY ("blog_id") REFERENCES "blog_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blog_images" ADD CONSTRAINT "blog_images_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "blog_exports" ADD CONSTRAINT "blog_exports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blog_exports" ADD CONSTRAINT "blog_exports_blog_id_fkey" FOREIGN KEY ("blog_id") REFERENCES "blog_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blog_exports" ADD CONSTRAINT "blog_exports_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "saas_subscriptions" ADD CONSTRAINT "saas_subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saas_subscriptions" ADD CONSTRAINT "saas_subscriptions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "saas_usage_windows" ADD CONSTRAINT "saas_usage_windows_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saas_usage_windows" ADD CONSTRAINT "saas_usage_windows_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "saas_usage_reservations" ADD CONSTRAINT "saas_usage_reservations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saas_usage_reservations" ADD CONSTRAINT "saas_usage_reservations_usage_window_id_fkey" FOREIGN KEY ("usage_window_id") REFERENCES "saas_usage_windows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saas_usage_reservations" ADD CONSTRAINT "saas_usage_reservations_generation_job_id_fkey" FOREIGN KEY ("generation_job_id") REFERENCES "blog_generation_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saas_usage_records" ADD CONSTRAINT "saas_usage_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saas_usage_records" ADD CONSTRAINT "saas_usage_records_usage_window_id_fkey" FOREIGN KEY ("usage_window_id") REFERENCES "saas_usage_windows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saas_usage_records" ADD CONSTRAINT "saas_usage_records_generation_job_id_fkey" FOREIGN KEY ("generation_job_id") REFERENCES "blog_generation_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
