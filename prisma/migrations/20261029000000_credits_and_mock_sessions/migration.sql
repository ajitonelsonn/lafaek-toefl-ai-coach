-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mock_credits" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "plan_credits" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "mock_test_results" ADD COLUMN     "form_json" JSONB,
ADD COLUMN     "started_at" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'completed';

-- CreateTable
CREATE TABLE "credit_grants" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "packs" INTEGER NOT NULL,
    "plan_credits" INTEGER NOT NULL,
    "mock_credits" INTEGER NOT NULL,
    "note" TEXT,
    "granted_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credit_grants_user_id_created_at_idx" ON "credit_grants"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "mock_test_results_user_id_status_idx" ON "mock_test_results"("user_id", "status");

-- AddForeignKey
ALTER TABLE "credit_grants" ADD CONSTRAINT "credit_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Back-fill (lifetime allowances): accounts that already made a study plan or took a mock test
-- have used their free Starter credit.
UPDATE "users" u SET "plan_credits" = 0 WHERE EXISTS (SELECT 1 FROM "study_plans" p WHERE p."user_id" = u."id");
UPDATE "users" u SET "mock_credits" = 0 WHERE EXISTS (SELECT 1 FROM "mock_test_results" m WHERE m."user_id" = u."id");
