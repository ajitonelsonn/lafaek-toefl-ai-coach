-- CreateTable
CREATE TABLE "practice_resets" (
    "user_id" UUID NOT NULL,
    "task_slug" TEXT NOT NULL,
    "reset_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practice_resets_pkey" PRIMARY KEY ("user_id","task_slug")
);

-- AddForeignKey
ALTER TABLE "practice_resets" ADD CONSTRAINT "practice_resets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

