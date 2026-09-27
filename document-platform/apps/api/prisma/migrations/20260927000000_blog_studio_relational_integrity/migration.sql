-- Complete the PostgreSQL ownership graph for Blog Studio records that were
-- introduced in the full-suite migration. These constraints make tenant and
-- lifecycle isolation enforceable by PostgreSQL in addition to application code.

ALTER TABLE "blog_publications"
  ADD CONSTRAINT "blog_publications_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "blog_publications_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "blog_remote_posts"
  ADD CONSTRAINT "blog_remote_posts_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "blog_remote_posts_destination_id_fkey"
  FOREIGN KEY ("destination_id") REFERENCES "blog_destinations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "blog_csv_imports"
  ADD CONSTRAINT "blog_csv_imports_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "blog_csv_imports_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "blog_schedules"
  ADD CONSTRAINT "blog_schedules_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "blog_schedules_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "blog_notifications"
  ADD CONSTRAINT "blog_notifications_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "blog_notifications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "blog_studio_permissions"
  ADD CONSTRAINT "blog_studio_permissions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
