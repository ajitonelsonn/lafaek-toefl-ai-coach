-- CreateEnum
CREATE TYPE "DeviceLinkKind" AS ENUM ('share', 'request');

-- CreateTable
CREATE TABLE "device_links" (
    "id" UUID NOT NULL,
    "kind" "DeviceLinkKind" NOT NULL,
    "code_hash" TEXT NOT NULL,
    "poll_secret_hash" TEXT,
    "user_id" UUID,
    "user_agent" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "approved_at" TIMESTAMP(3),
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_links_code_hash_key" ON "device_links"("code_hash");

-- CreateIndex
CREATE UNIQUE INDEX "device_links_poll_secret_hash_key" ON "device_links"("poll_secret_hash");

-- CreateIndex
CREATE INDEX "device_links_user_id_idx" ON "device_links"("user_id");

-- CreateIndex
CREATE INDEX "device_links_expires_at_idx" ON "device_links"("expires_at");

-- AddForeignKey
ALTER TABLE "device_links" ADD CONSTRAINT "device_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

