-- Blog Studio Full-Suite Expansion Migration
-- Forward-only, additive. No existing tables are dropped or columns removed.
-- All new tables use the same naming and convention patterns as blog_documents et al.

-- ═══════════════════════════════════════════════════════════════
-- New enum types
-- ═══════════════════════════════════════════════════════════════

CREATE TYPE "BlogDestinationType" AS ENUM ('WORDPRESS', 'SHOPIFY', 'CUSTOM', 'JTL');
CREATE TYPE "BlogPublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'FAILED', 'RETRYING');
CREATE TYPE "BlogScheduleStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'PAUSED', 'CANCELLED');
CREATE TYPE "BlogNotificationType" AS ENUM ('GENERATION_COMPLETE', 'GENERATION_FAILED', 'PUBLISH_SUCCESS', 'PUBLISH_FAILED', 'SCHEDULE_FAILED', 'PROVIDER_FAILURE', 'SUBSCRIPTION_LIMIT', 'UPSTREAM_RELEASE');
CREATE TYPE "BlogProviderType" AS ENUM ('OPENAI', 'GOOGLE', 'ANTHROPIC', 'OPENROUTER', 'GROQ', 'XAI', 'HUGGINGFACE', 'MISTRAL', 'TOGETHER', 'FIREWORKS', 'PERPLEXITY', 'SARVAM', 'TAVILY', 'CUSTOM');

-- ═══════════════════════════════════════════════════════════════
-- Extend existing tables (additive columns only)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE "blog_generation_jobs"
  ADD COLUMN IF NOT EXISTS "parameters_snapshot_json" JSONB,
  ADD COLUMN IF NOT EXISTS "prompt_template_version" INTEGER;

ALTER TABLE "blog_images"
  ADD COLUMN IF NOT EXISTS "alt_text" TEXT,
  ADD COLUMN IF NOT EXISTS "is_featured" BOOLEAN NOT NULL DEFAULT false;

-- ═══════════════════════════════════════════════════════════════
-- Revisions
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE "blog_revisions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "blog_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "editor_json" JSONB NOT NULL,
    "metadata_json" JSONB,
    "source" TEXT NOT NULL DEFAULT 'edit',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_revisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "blog_revisions_blog_id_version_idx" ON "blog_revisions"("blog_id", "version");
ALTER TABLE "blog_revisions" ADD CONSTRAINT "blog_revisions_blog_id_fkey" FOREIGN KEY ("blog_id") REFERENCES "blog_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════
-- Provider Credentials
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE "blog_provider_credentials" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "provider_type" "BlogProviderType" NOT NULL,
    "label" TEXT NOT NULL,
    "masked_identifier" TEXT NOT NULL,
    "encrypted_credential" TEXT NOT NULL,
    "encryption_key_version" INTEGER NOT NULL DEFAULT 1,
    "custom_endpoint" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_tested_at" TIMESTAMP(3),
    "last_test_success" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_provider_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "blog_provider_credentials_organization_id_provider_type_labe_key" ON "blog_provider_credentials"("organization_id", "provider_type", "label");
CREATE INDEX "blog_provider_credentials_organization_id_is_active_idx" ON "blog_provider_credentials"("organization_id", "is_active");
ALTER TABLE "blog_provider_credentials" ADD CONSTRAINT "blog_provider_credentials_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════
-- Prompt Templates
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE "blog_prompt_templates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "system_prompt" TEXT NOT NULL,
    "user_prompt" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_prompt_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "blog_prompt_templates_organization_id_stage_version_key" ON "blog_prompt_templates"("organization_id", "stage", "version");
CREATE INDEX "blog_prompt_templates_organization_id_stage_is_default_idx" ON "blog_prompt_templates"("organization_id", "stage", "is_default");
ALTER TABLE "blog_prompt_templates" ADD CONSTRAINT "blog_prompt_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════
-- Organization Settings
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE "blog_studio_settings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "default_text_model" TEXT,
    "default_image_model" TEXT,
    "default_search_provider" TEXT,
    "deep_research_provider" TEXT,
    "enable_model_discovery" BOOLEAN NOT NULL DEFAULT false,
    "settings_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_studio_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "blog_studio_settings_organization_id_key" ON "blog_studio_settings"("organization_id");
ALTER TABLE "blog_studio_settings" ADD CONSTRAINT "blog_studio_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════
-- Publishing Destinations
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE "blog_destinations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" "BlogDestinationType" NOT NULL,
    "label" TEXT NOT NULL,
    "endpoint_url" TEXT NOT NULL,
    "encrypted_credential" TEXT,
    "encryption_key_version" INTEGER NOT NULL DEFAULT 1,
    "config_json" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_tested_at" TIMESTAMP(3),
    "last_test_success" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_destinations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "blog_destinations_organization_id_type_label_key" ON "blog_destinations"("organization_id", "type", "label");
CREATE INDEX "blog_destinations_organization_id_is_active_idx" ON "blog_destinations"("organization_id", "is_active");
ALTER TABLE "blog_destinations" ADD CONSTRAINT "blog_destinations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════
-- Category Mappings
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE "blog_category_mappings" (
    "id" TEXT NOT NULL,
    "destination_id" TEXT NOT NULL,
    "local_category" TEXT NOT NULL,
    "remote_id" TEXT NOT NULL,
    "remote_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_category_mappings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "blog_category_mappings_destination_id_local_category_key" ON "blog_category_mappings"("destination_id", "local_category");
ALTER TABLE "blog_category_mappings" ADD CONSTRAINT "blog_category_mappings_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "blog_destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════
-- Publications
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE "blog_publications" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "blog_id" TEXT NOT NULL,
    "destination_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "status" "BlogPublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "remote_post_id" TEXT,
    "remote_url" TEXT,
    "published_as" TEXT NOT NULL DEFAULT 'draft',
    "idempotency_key" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "error_message" TEXT,
    "metadata_json" JSONB,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_publications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "blog_publications_idempotency_key_key" ON "blog_publications"("idempotency_key");
CREATE INDEX "blog_publications_organization_id_blog_id_status_idx" ON "blog_publications"("organization_id", "blog_id", "status");
CREATE INDEX "blog_publications_destination_id_status_idx" ON "blog_publications"("destination_id", "status");
ALTER TABLE "blog_publications" ADD CONSTRAINT "blog_publications_blog_id_fkey" FOREIGN KEY ("blog_id") REFERENCES "blog_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blog_publications" ADD CONSTRAINT "blog_publications_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "blog_destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════
-- Remote Posts
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE "blog_remote_posts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "destination_id" TEXT NOT NULL,
    "blog_id" TEXT,
    "remote_id" TEXT NOT NULL,
    "remote_title" TEXT NOT NULL,
    "remote_url" TEXT,
    "remote_status" TEXT NOT NULL,
    "last_synced_at" TIMESTAMP(3) NOT NULL,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_remote_posts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "blog_remote_posts_destination_id_remote_id_key" ON "blog_remote_posts"("destination_id", "remote_id");
CREATE INDEX "blog_remote_posts_organization_id_destination_id_idx" ON "blog_remote_posts"("organization_id", "destination_id");
ALTER TABLE "blog_remote_posts" ADD CONSTRAINT "blog_remote_posts_blog_id_fkey" FOREIGN KEY ("blog_id") REFERENCES "blog_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════
-- Scheduler
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE "blog_csv_imports" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "valid_count" INTEGER NOT NULL DEFAULT 0,
    "duplicate_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "preview_json" JSONB,
    "validation_json" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_csv_imports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "blog_csv_imports_organization_id_created_at_idx" ON "blog_csv_imports"("organization_id", "created_at");

CREATE TABLE "blog_schedules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "blog_id" TEXT,
    "destination_id" TEXT,
    "job_type" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "input_json" JSONB,
    "category_id" TEXT,
    "generate_images" BOOLEAN NOT NULL DEFAULT false,
    "auto_publish" BOOLEAN NOT NULL DEFAULT false,
    "status" "BlogScheduleStatus" NOT NULL DEFAULT 'PENDING',
    "queue_job_id" TEXT,
    "csv_import_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_schedules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "blog_schedules_organization_id_status_scheduled_at_idx" ON "blog_schedules"("organization_id", "status", "scheduled_at");
CREATE INDEX "blog_schedules_queue_job_id_idx" ON "blog_schedules"("queue_job_id");
ALTER TABLE "blog_schedules" ADD CONSTRAINT "blog_schedules_blog_id_fkey" FOREIGN KEY ("blog_id") REFERENCES "blog_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "blog_schedules" ADD CONSTRAINT "blog_schedules_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "blog_destinations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "blog_schedules" ADD CONSTRAINT "blog_schedules_csv_import_id_fkey" FOREIGN KEY ("csv_import_id") REFERENCES "blog_csv_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "blog_schedule_runs" (
    "id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "succeeded" BOOLEAN,
    "result_json" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_schedule_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "blog_schedule_runs_schedule_id_created_at_idx" ON "blog_schedule_runs"("schedule_id", "created_at");
ALTER TABLE "blog_schedule_runs" ADD CONSTRAINT "blog_schedule_runs_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "blog_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════
-- Product Context
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE "blog_product_collections" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source_url" TEXT,
    "source_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_product_collections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "blog_product_collections_organization_id_idx" ON "blog_product_collections"("organization_id");
ALTER TABLE "blog_product_collections" ADD CONSTRAINT "blog_product_collections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "blog_products" (
    "id" TEXT NOT NULL,
    "collection_id" TEXT NOT NULL,
    "external_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price" TEXT,
    "currency" TEXT,
    "image_url" TEXT,
    "product_url" TEXT,
    "category" TEXT,
    "brand" TEXT,
    "fields_json" JSONB,
    "last_scraped_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "blog_products_collection_id_external_id_key" ON "blog_products"("collection_id", "external_id");
CREATE INDEX "blog_products_collection_id_idx" ON "blog_products"("collection_id");
ALTER TABLE "blog_products" ADD CONSTRAINT "blog_products_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "blog_product_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════
-- Notifications
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE "blog_notifications" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT,
    "type" "BlogNotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "blog_notifications_organization_id_user_id_read_at_idx" ON "blog_notifications"("organization_id", "user_id", "read_at");
CREATE INDEX "blog_notifications_organization_id_created_at_idx" ON "blog_notifications"("organization_id", "created_at");

-- ═══════════════════════════════════════════════════════════════
-- Permissions
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE "blog_studio_permissions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "role_or_user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_studio_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "blog_studio_permissions_organization_id_role_or_user_id_acti_key" ON "blog_studio_permissions"("organization_id", "role_or_user_id", "action");
CREATE INDEX "blog_studio_permissions_organization_id_idx" ON "blog_studio_permissions"("organization_id");
