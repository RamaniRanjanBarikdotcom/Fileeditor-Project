-- Per-user Blog Studio colour theme. NULL means the user has not chosen one
-- yet, which shows the one-time theme picker.
ALTER TABLE "users"
  ADD COLUMN "blog_studio_theme" VARCHAR(32);
