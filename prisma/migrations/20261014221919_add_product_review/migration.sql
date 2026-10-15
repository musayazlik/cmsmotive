-- CreateTable
CREATE TABLE "ProductReview" (
    "id" TEXT NOT NULL,
    "productSlug" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorEmail" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "locale" TEXT NOT NULL DEFAULT 'de',
    "requestKey" TEXT NOT NULL,
    "moderatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductReview_requestKey_key" ON "ProductReview"("requestKey");

-- CreateIndex
CREATE INDEX "ProductReview_productSlug_status_createdAt_idx" ON "ProductReview"("productSlug", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ProductReview_status_createdAt_idx" ON "ProductReview"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ProductReview_authorEmail_createdAt_idx" ON "ProductReview"("authorEmail", "createdAt");
