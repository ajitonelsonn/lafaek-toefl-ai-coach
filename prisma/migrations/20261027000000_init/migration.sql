-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('pending', 'active', 'disabled', 'deleted');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('signup', 'login', 'password_reset');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('active', 'superseded');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('queued', 'running', 'completed', 'partial', 'failed');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('queued', 'running', 'validating', 'storing', 'completed', 'retry_wait', 'failed', 'cancelled', 'blocked_configuration');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('task_pack', 'asset_image', 'asset_audio', 'reconcile_media', 'delete_user_assets');

-- CreateEnum
CREATE TYPE "ItemSource" AS ENUM ('starter', 'generated');

-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('pending', 'valid', 'invalid', 'needs_review');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('audio', 'image', 'recording', 'other');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('pending', 'ready', 'failed', 'deleted');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email_normalized" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "password_hash" TEXT,
    "email_verified_at" TIMESTAMP(3),
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "status" "UserStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_otps" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "email_normalized" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "otp_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_agent" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_plans" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'active',
    "current_level" TEXT NOT NULL,
    "target_level" TEXT,
    "target_score_band" TEXT NOT NULL,
    "test_date" DATE,
    "study_days" JSONB NOT NULL,
    "daily_minutes" INTEGER NOT NULL,
    "focus_areas" JSONB NOT NULL,
    "accent_preferences" JSONB NOT NULL,
    "answers_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "study_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_batches" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "study_plan_id" UUID NOT NULL,
    "plan_version" INTEGER NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'queued',
    "total_tasks" INTEGER NOT NULL,
    "completed_tasks" INTEGER NOT NULL DEFAULT 0,
    "failed_tasks" INTEGER NOT NULL DEFAULT 0,
    "estimated_cost" DECIMAL(12,4),
    "actual_cost" DECIMAL(12,4),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generation_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_jobs" (
    "id" UUID NOT NULL,
    "batch_id" UUID,
    "user_id" UUID,
    "task_slug" TEXT,
    "job_type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'queued',
    "idempotency_key" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL DEFAULT '{}',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "progress_total" INTEGER NOT NULL DEFAULT 0,
    "progress_done" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lease_expires_at" TIMESTAMP(3),
    "lease_owner" TEXT,
    "provider" TEXT,
    "model_id" TEXT,
    "prompt_version" TEXT,
    "provider_request_id" TEXT,
    "usage_json" JSONB,
    "error_code" TEXT,
    "error_summary" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_items" (
    "id" UUID NOT NULL,
    "content_key" TEXT NOT NULL,
    "user_id" UUID,
    "study_plan_id" UUID,
    "generation_job_id" UUID,
    "source" "ItemSource" NOT NULL,
    "task_slug" TEXT NOT NULL,
    "item_index" INTEGER NOT NULL,
    "difficulty" TEXT NOT NULL,
    "cefr_level" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "content_json" JSONB NOT NULL,
    "answer_key_json" JSONB NOT NULL,
    "explanation_json" JSONB NOT NULL,
    "rubric_json" JSONB,
    "provenance_json" JSONB NOT NULL,
    "validation_status" "ValidationStatus" NOT NULL DEFAULT 'pending',
    "validation_errors" JSONB,
    "content_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "practice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "practice_item_id" UUID,
    "generation_job_id" UUID,
    "attempt_id" UUID,
    "kind" "MediaKind" NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'main',
    "bucket" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "byte_size" INTEGER,
    "checksum" TEXT,
    "duration_ms" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "voice_profile_json" JSONB,
    "provider" TEXT,
    "model_id" TEXT,
    "status" "MediaStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_attempts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "practice_item_id" UUID NOT NULL,
    "task_slug" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "response_json" JSONB NOT NULL,
    "score_json" JSONB NOT NULL,
    "feedback_json" JSONB,
    "started_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration_ms" INTEGER,
    "scoring_version" TEXT NOT NULL,

    CONSTRAINT "practice_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_events" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "event_type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model_id" TEXT,
    "input_units" INTEGER,
    "output_units" INTEGER,
    "audio_seconds" DOUBLE PRECISION,
    "image_count" INTEGER,
    "character_count" INTEGER,
    "is_estimate" BOOLEAN NOT NULL DEFAULT false,
    "estimated_cost" DECIMAL(12,6),
    "actual_cost" DECIMAL(12,6),
    "currency" TEXT,
    "generation_job_id" UUID,
    "idempotency_key" TEXT NOT NULL,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "user_id" UUID NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'light',
    "sound_enabled" BOOLEAN NOT NULL DEFAULT true,
    "reminders_enabled" BOOLEAN NOT NULL DEFAULT false,
    "preferred_accent" TEXT,
    "audio_speed" DOUBLE PRECISION,
    "recording_consent" BOOLEAN NOT NULL DEFAULT false,
    "settings_json" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "vocabulary_progress" (
    "user_id" UUID NOT NULL,
    "word_id" TEXT NOT NULL,
    "status" TEXT,
    "bookmarked" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vocabulary_progress_pkey" PRIMARY KEY ("user_id","word_id")
);

-- CreateTable
CREATE TABLE "practice_drafts" (
    "user_id" UUID NOT NULL,
    "practice_item_id" UUID NOT NULL,
    "body_json" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practice_drafts_pkey" PRIMARY KEY ("user_id","practice_item_id")
);

-- CreateTable
CREATE TABLE "mock_test_results" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "sections_json" JSONB NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "scoring_version" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mock_test_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_events" (
    "id" UUID NOT NULL,
    "admin_user_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "safe_metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "key" TEXT NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key","window_start")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_normalized_key" ON "users"("email_normalized");

-- CreateIndex
CREATE INDEX "auth_otps_email_normalized_purpose_consumed_at_idx" ON "auth_otps"("email_normalized", "purpose", "consumed_at");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_hash_key" ON "sessions"("session_token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "study_plans_user_id_version_key" ON "study_plans"("user_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "generation_batches_user_id_plan_version_key" ON "generation_batches"("user_id", "plan_version");

-- CreateIndex
CREATE UNIQUE INDEX "generation_batches_user_id_idempotency_key_key" ON "generation_batches"("user_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "generation_jobs_idempotency_key_key" ON "generation_jobs"("idempotency_key");

-- CreateIndex
CREATE INDEX "generation_jobs_status_next_attempt_at_idx" ON "generation_jobs"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "generation_jobs_batch_id_idx" ON "generation_jobs"("batch_id");

-- CreateIndex
CREATE INDEX "generation_jobs_user_id_idx" ON "generation_jobs"("user_id");

-- CreateIndex
CREATE INDEX "generation_jobs_task_slug_idx" ON "generation_jobs"("task_slug");

-- CreateIndex
CREATE UNIQUE INDEX "practice_items_content_key_key" ON "practice_items"("content_key");

-- CreateIndex
CREATE INDEX "practice_items_user_id_task_slug_validation_status_idx" ON "practice_items"("user_id", "task_slug", "validation_status");

-- CreateIndex
CREATE INDEX "practice_items_source_task_slug_idx" ON "practice_items"("source", "task_slug");

-- CreateIndex
CREATE UNIQUE INDEX "practice_items_study_plan_id_task_slug_item_index_content_v_key" ON "practice_items"("study_plan_id", "task_slug", "item_index", "content_version");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_object_key_key" ON "media_assets"("object_key");

-- CreateIndex
CREATE INDEX "media_assets_user_id_kind_idx" ON "media_assets"("user_id", "kind");

-- CreateIndex
CREATE INDEX "media_assets_practice_item_id_idx" ON "media_assets"("practice_item_id");

-- CreateIndex
CREATE INDEX "practice_attempts_user_id_submitted_at_idx" ON "practice_attempts"("user_id", "submitted_at");

-- CreateIndex
CREATE INDEX "practice_attempts_user_id_task_slug_idx" ON "practice_attempts"("user_id", "task_slug");

-- CreateIndex
CREATE UNIQUE INDEX "usage_events_idempotency_key_key" ON "usage_events"("idempotency_key");

-- CreateIndex
CREATE INDEX "usage_events_user_id_created_at_idx" ON "usage_events"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "mock_test_results_user_id_completed_at_idx" ON "mock_test_results"("user_id", "completed_at");

-- AddForeignKey
ALTER TABLE "auth_otps" ADD CONSTRAINT "auth_otps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_plans" ADD CONSTRAINT "study_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_batches" ADD CONSTRAINT "generation_batches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_batches" ADD CONSTRAINT "generation_batches_study_plan_id_fkey" FOREIGN KEY ("study_plan_id") REFERENCES "study_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "generation_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_items" ADD CONSTRAINT "practice_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_items" ADD CONSTRAINT "practice_items_study_plan_id_fkey" FOREIGN KEY ("study_plan_id") REFERENCES "study_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_items" ADD CONSTRAINT "practice_items_generation_job_id_fkey" FOREIGN KEY ("generation_job_id") REFERENCES "generation_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_practice_item_id_fkey" FOREIGN KEY ("practice_item_id") REFERENCES "practice_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_generation_job_id_fkey" FOREIGN KEY ("generation_job_id") REFERENCES "generation_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_attempts" ADD CONSTRAINT "practice_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_attempts" ADD CONSTRAINT "practice_attempts_practice_item_id_fkey" FOREIGN KEY ("practice_item_id") REFERENCES "practice_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabulary_progress" ADD CONSTRAINT "vocabulary_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_drafts" ADD CONSTRAINT "practice_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_drafts" ADD CONSTRAINT "practice_drafts_practice_item_id_fkey" FOREIGN KEY ("practice_item_id") REFERENCES "practice_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mock_test_results" ADD CONSTRAINT "mock_test_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_events" ADD CONSTRAINT "admin_audit_events_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- One active study plan per user (partial unique index; not expressible in Prisma schema).
CREATE UNIQUE INDEX "study_plans_one_active_per_user" ON "study_plans"("user_id") WHERE "status" = 'active';

-- Speeds up worker claims of due jobs.
CREATE INDEX "generation_jobs_due_idx" ON "generation_jobs"("next_attempt_at") WHERE "status" IN ('queued', 'retry_wait');
