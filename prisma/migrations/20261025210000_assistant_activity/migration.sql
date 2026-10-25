CREATE TABLE "AssistantActivity" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "detail" TEXT NOT NULL,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "AssistantActivity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AssistantActivity_storeId_status_expiresAt_idx" ON "AssistantActivity"("storeId", "status", "expiresAt");
CREATE INDEX "AssistantActivity_storeId_createdAt_idx" ON "AssistantActivity"("storeId", "createdAt");
ALTER TABLE "AssistantActivity" ADD CONSTRAINT "AssistantActivity_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
