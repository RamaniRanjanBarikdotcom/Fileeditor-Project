-- Add a stable token-family identifier without rewriting prior migrations.
-- Existing sessions each begin in their own family; subsequently rotated
-- sessions preserve that family in application code.
ALTER TABLE "refresh_sessions" ADD COLUMN "family_id" TEXT;

UPDATE "refresh_sessions"
SET "family_id" = "id"
WHERE "family_id" IS NULL;

ALTER TABLE "refresh_sessions" ALTER COLUMN "family_id" SET NOT NULL;

CREATE INDEX "refresh_sessions_family_id_idx" ON "refresh_sessions"("family_id");
