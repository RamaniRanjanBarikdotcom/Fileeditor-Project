-- Persist optional CSS mappings for custom-coded and uncommon storefronts.
-- Existing collections continue to use automatic/platform detection.
ALTER TABLE "blog_product_collections"
  ADD COLUMN "scrape_config_json" JSONB;
