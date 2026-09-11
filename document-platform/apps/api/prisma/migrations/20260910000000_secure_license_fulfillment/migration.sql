-- Preserve hashes for verification while retaining an encrypted copy that can
-- be delivered to the authenticated purchaser. Existing masked-only licenses
-- remain valid for activation but cannot be revealed retroactively.
-- This migration is also executed as a compatibility pre-step for databases
-- originally created with `prisma db push`. It is therefore safe on a fresh
-- database and safe to repeat.
DO $$
BEGIN
  IF to_regclass('public.license_keys') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "license_keys" ADD COLUMN IF NOT EXISTS "key_ciphertext" TEXT';
    EXECUTE 'ALTER TABLE "license_keys" ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMP(3)';
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS "license_keys_order_id_product_id_key" ON "license_keys"("order_id", "product_id")';
  END IF;
END
$$;
