-- Persistent project-aware AI memory. This migration is additive and
-- idempotent because some existing installations were initialized with
-- `prisma db push` before migration history was introduced.

DO $$ BEGIN
  CREATE TYPE "AiProjectStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "AiConversationStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "AiMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM', 'TOOL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "MemoryType" AS ENUM ('FACT', 'ARCHITECTURE', 'DECISION', 'REQUIREMENT', 'PREFERENCE', 'CONSTRAINT', 'TASK', 'BUG', 'STATUS', 'INTEGRATION', 'CODE_KNOWLEDGE', 'SESSION_SUMMARY', 'PROJECT_SUMMARY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "MemoryStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'ARCHIVED', 'DELETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "MemorySourceType" AS ENUM ('AUTO_EXTRACTED', 'USER_CREATED', 'IMPORTED', 'SYSTEM_GENERATED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "MemoryDomain" AS ENUM ('PROJECT_MEMORY', 'CODE_KNOWLEDGE', 'DOCUMENT_KNOWLEDGE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "MemoryVisibility" AS ENUM ('PROJECT', 'USER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "MemoryTrustLevel" AS ENUM ('EXPLICIT', 'INTERNAL', 'ASSISTANT', 'IMPORTED', 'EXTERNAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ai_projects" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "created_by_user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "AiProjectStatus" NOT NULL DEFAULT 'ACTIVE',
  "memory_enabled" BOOLEAN NOT NULL DEFAULT true,
  "auto_extraction_enabled" BOOLEAN NOT NULL DEFAULT true,
  "summary" TEXT,
  "summary_version" INTEGER NOT NULL DEFAULT 0,
  "summary_updated_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_projects_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_projects_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ai_conversations" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" "AiConversationStatus" NOT NULL DEFAULT 'ACTIVE',
  "auto_memory_enabled" BOOLEAN NOT NULL DEFAULT true,
  "last_summarized_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_conversations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_conversations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "ai_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ai_messages" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "user_id" TEXT,
  "role" "AiMessageRole" NOT NULL,
  "content" TEXT NOT NULL,
  "token_estimate" INTEGER NOT NULL DEFAULT 0,
  "metadata_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_messages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ai_memories" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "created_by_user_id" TEXT NOT NULL,
  "visibility" "MemoryVisibility" NOT NULL DEFAULT 'PROJECT',
  "domain" "MemoryDomain" NOT NULL DEFAULT 'PROJECT_MEMORY',
  "type" "MemoryType" NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "concept_key" TEXT,
  "importance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "status" "MemoryStatus" NOT NULL DEFAULT 'ACTIVE',
  "source_type" "MemorySourceType" NOT NULL,
  "source_trust" "MemoryTrustLevel" NOT NULL DEFAULT 'INTERNAL',
  "source_conversation_id" TEXT,
  "source_message_id" TEXT,
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "embedding" DOUBLE PRECISION[] NOT NULL DEFAULT ARRAY[]::DOUBLE PRECISION[],
  "embedding_provider" TEXT,
  "embedding_model" TEXT,
  "embedding_version" TEXT,
  "metadata_json" JSONB,
  "last_accessed_at" TIMESTAMP(3),
  "access_count" INTEGER NOT NULL DEFAULT 0,
  "superseded_by_memory_id" TEXT,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_memories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_memories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_memories_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "ai_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_memories_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ai_memories_source_conversation_id_fkey" FOREIGN KEY ("source_conversation_id") REFERENCES "ai_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ai_memories_source_message_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "ai_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ai_memories_superseded_by_memory_id_fkey" FOREIGN KEY ("superseded_by_memory_id") REFERENCES "ai_memories"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ai_session_summaries" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "through_message_id" TEXT,
  "message_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_session_summaries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_session_summaries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_session_summaries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "ai_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_session_summaries_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_session_summaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ai_projects_organization_id_status_idx" ON "ai_projects"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "ai_projects_organization_id_updated_at_idx" ON "ai_projects"("organization_id", "updated_at");
CREATE INDEX IF NOT EXISTS "ai_conversations_organization_id_project_id_status_idx" ON "ai_conversations"("organization_id", "project_id", "status");
CREATE INDEX IF NOT EXISTS "ai_conversations_user_id_updated_at_idx" ON "ai_conversations"("user_id", "updated_at");
CREATE INDEX IF NOT EXISTS "ai_messages_organization_id_conversation_id_created_at_idx" ON "ai_messages"("organization_id", "conversation_id", "created_at");
CREATE INDEX IF NOT EXISTS "ai_messages_conversation_id_created_at_idx" ON "ai_messages"("conversation_id", "created_at");
CREATE INDEX IF NOT EXISTS "ai_memories_organization_id_project_id_status_idx" ON "ai_memories"("organization_id", "project_id", "status");
CREATE INDEX IF NOT EXISTS "ai_memories_organization_id_project_id_type_status_idx" ON "ai_memories"("organization_id", "project_id", "type", "status");
CREATE INDEX IF NOT EXISTS "ai_memories_organization_id_project_id_concept_key_status_idx" ON "ai_memories"("organization_id", "project_id", "concept_key", "status");
CREATE INDEX IF NOT EXISTS "ai_memories_created_by_user_id_visibility_status_idx" ON "ai_memories"("created_by_user_id", "visibility", "status");
CREATE INDEX IF NOT EXISTS "ai_memories_updated_at_idx" ON "ai_memories"("updated_at");
CREATE INDEX IF NOT EXISTS "ai_session_summaries_organization_id_project_id_created_at_idx" ON "ai_session_summaries"("organization_id", "project_id", "created_at");
CREATE INDEX IF NOT EXISTS "ai_session_summaries_conversation_id_updated_at_idx" ON "ai_session_summaries"("conversation_id", "updated_at");
