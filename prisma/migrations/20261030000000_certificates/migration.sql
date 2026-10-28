-- CreateTable
CREATE TABLE "certificates" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "mock_result_id" UUID NOT NULL,
    "holder_name" TEXT NOT NULL,
    "overall_band" DOUBLE PRECISION NOT NULL,
    "sections_json" JSONB NOT NULL,
    "test_completed_at" TIMESTAMP(3) NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "certificates_code_key" ON "certificates"("code");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_mock_result_id_key" ON "certificates"("mock_result_id");

-- CreateIndex
CREATE INDEX "certificates_user_id_issued_at_idx" ON "certificates"("user_id", "issued_at");

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_mock_result_id_fkey" FOREIGN KEY ("mock_result_id") REFERENCES "mock_test_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

