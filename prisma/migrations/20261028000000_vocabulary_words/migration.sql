-- AlterEnum
ALTER TYPE "JobType" ADD VALUE 'vocabulary_pack';

-- CreateTable
CREATE TABLE "vocabulary_words" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "study_plan_id" UUID,
    "generation_job_id" UUID,
    "task_slug" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "word_normalized" TEXT NOT NULL,
    "part_of_speech" TEXT NOT NULL,
    "pronunciation" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "example" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "related_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vocabulary_words_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vocabulary_words_user_id_created_at_idx" ON "vocabulary_words"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "vocabulary_words_user_id_word_normalized_key" ON "vocabulary_words"("user_id", "word_normalized");

-- AddForeignKey
ALTER TABLE "vocabulary_words" ADD CONSTRAINT "vocabulary_words_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabulary_words" ADD CONSTRAINT "vocabulary_words_study_plan_id_fkey" FOREIGN KEY ("study_plan_id") REFERENCES "study_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

