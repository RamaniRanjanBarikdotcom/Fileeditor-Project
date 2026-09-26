CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED');

ALTER TABLE "quota_reservations" ADD COLUMN "organization_id" TEXT;

UPDATE "quota_reservations" AS reservation
SET "organization_id" = job."organization_id"
FROM "conversion_jobs" AS job
WHERE reservation."conversion_job_id" = job."id"
  AND reservation."organization_id" IS NULL;

ALTER TABLE "quota_reservations"
ADD CONSTRAINT "quota_reservations_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "quota_reservations_organization_id_status_idx"
ON "quota_reservations"("organization_id", "status");

ALTER TABLE "usage_records" ADD COLUMN "units" INTEGER NOT NULL DEFAULT 1;
DELETE FROM "usage_records" AS duplicate
USING "usage_records" AS canonical
WHERE duplicate."conversion_job_id" = canonical."conversion_job_id"
  AND duplicate."id" > canonical."id";
CREATE UNIQUE INDEX "usage_records_conversion_job_id_key"
ON "usage_records"("conversion_job_id");

CREATE TABLE "outbox_events" (
  "id" TEXT NOT NULL,
  "aggregate_type" TEXT NOT NULL,
  "aggregate_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "payload_json" JSONB NOT NULL,
  "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "published_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "outbox_events_aggregate_type_aggregate_id_event_type_key"
ON "outbox_events"("aggregate_type", "aggregate_id", "event_type");

CREATE INDEX "outbox_events_status_next_attempt_at_idx"
ON "outbox_events"("status", "next_attempt_at");
