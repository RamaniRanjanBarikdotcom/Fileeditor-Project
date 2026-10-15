-- Invoice Studio automation: recurring invoices, payment reminders and
-- daily low-stock alerts.

-- AlterTable
ALTER TABLE "inv_businesses" ADD COLUMN     "low_stock_alerted_on" DATE,
ADD COLUMN     "low_stock_alerts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "reminder_days_json" JSONB NOT NULL DEFAULT '[3, 10]';

-- AlterTable
ALTER TABLE "inv_documents" ADD COLUMN     "last_reminder_at" TIMESTAMP(3),
ADD COLUMN     "reminder_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "inv_recurring_profiles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "source_document_id" TEXT NOT NULL,
    "frequency" VARCHAR(10) NOT NULL,
    "start_on" DATE NOT NULL,
    "next_run_on" DATE NOT NULL,
    "end_on" DATE,
    "auto_issue" BOOLEAN NOT NULL DEFAULT false,
    "email_to" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "run_count" INTEGER NOT NULL DEFAULT 0,
    "last_run_at" TIMESTAMP(3),
    "last_document_id" TEXT,
    "last_error" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inv_recurring_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inv_recurring_profiles_active_next_run_on_idx" ON "inv_recurring_profiles"("active", "next_run_on");

-- CreateIndex
CREATE INDEX "inv_recurring_profiles_organization_id_idx" ON "inv_recurring_profiles"("organization_id");

-- AddForeignKey
ALTER TABLE "inv_recurring_profiles" ADD CONSTRAINT "inv_recurring_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

