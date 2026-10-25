-- Every row that existed before stores were introduced belongs to the default
-- store. A database that has no store yet (deployed before the store seed ran)
-- gets a neutral placeholder, which prisma/seeds adopts as its default store.
INSERT INTO "Store" ("id", "key", "name", "defaultLocale", "locales", "isDefault", "updatedAt")
SELECT 'default-store', 'default', 'Default store', 'de', ARRAY['de', 'en', 'tr'], true, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Store");

-- DropIndex
DROP INDEX "BillingPlan_kind_productSlug_idx";

-- DropIndex
DROP INDEX "Category_slug_key";

-- DropIndex
DROP INDEX "ContactInquiry_createdAt_idx";

-- DropIndex
DROP INDEX "Extension_slug_key";

-- DropIndex
DROP INDEX "Extension_status_idx";

-- DropIndex
DROP INDEX "MediaAsset_createdAt_idx";

-- DropIndex
DROP INDEX "NewsletterSubscriber_email_source_key";

-- DropIndex
DROP INDEX "PageViewDaily_date_slug_key";

-- DropIndex
DROP INDEX "Post_slug_key";

-- DropIndex
DROP INDEX "Post_status_idx";

-- DropIndex
DROP INDEX "ProductRelease_kind_productSlug_version_key";

-- DropIndex
DROP INDEX "ProductReview_status_createdAt_idx";

-- DropIndex
DROP INDEX "Tag_slug_key";

-- DropIndex
DROP INDEX "Theme_slug_key";

-- DropIndex
DROP INDEX "Theme_status_idx";

-- Scope content to a store: add, backfill, then require the column.
ALTER TABLE "BillingPlan" ADD COLUMN "storeId" TEXT;
UPDATE "BillingPlan" SET "storeId" = (SELECT "id" FROM "Store" ORDER BY "isDefault" DESC, "createdAt" ASC LIMIT 1);
ALTER TABLE "BillingPlan" ALTER COLUMN "storeId" SET NOT NULL;

ALTER TABLE "Category" ADD COLUMN "storeId" TEXT;
UPDATE "Category" SET "storeId" = (SELECT "id" FROM "Store" ORDER BY "isDefault" DESC, "createdAt" ASC LIMIT 1);
ALTER TABLE "Category" ALTER COLUMN "storeId" SET NOT NULL;

ALTER TABLE "ContactInquiry" ADD COLUMN "storeId" TEXT;
UPDATE "ContactInquiry" SET "storeId" = (SELECT "id" FROM "Store" ORDER BY "isDefault" DESC, "createdAt" ASC LIMIT 1);
ALTER TABLE "ContactInquiry" ALTER COLUMN "storeId" SET NOT NULL;

ALTER TABLE "Extension" ADD COLUMN "storeId" TEXT;
UPDATE "Extension" SET "storeId" = (SELECT "id" FROM "Store" ORDER BY "isDefault" DESC, "createdAt" ASC LIMIT 1);
ALTER TABLE "Extension" ALTER COLUMN "storeId" SET NOT NULL;

ALTER TABLE "MediaAsset" ADD COLUMN "storeId" TEXT;
UPDATE "MediaAsset" SET "storeId" = (SELECT "id" FROM "Store" ORDER BY "isDefault" DESC, "createdAt" ASC LIMIT 1);
ALTER TABLE "MediaAsset" ALTER COLUMN "storeId" SET NOT NULL;

ALTER TABLE "NewsletterSubscriber" ADD COLUMN "storeId" TEXT;
UPDATE "NewsletterSubscriber" SET "storeId" = (SELECT "id" FROM "Store" ORDER BY "isDefault" DESC, "createdAt" ASC LIMIT 1);
ALTER TABLE "NewsletterSubscriber" ALTER COLUMN "storeId" SET NOT NULL;

ALTER TABLE "PageViewDaily" ADD COLUMN "storeId" TEXT;
UPDATE "PageViewDaily" SET "storeId" = (SELECT "id" FROM "Store" ORDER BY "isDefault" DESC, "createdAt" ASC LIMIT 1);
ALTER TABLE "PageViewDaily" ALTER COLUMN "storeId" SET NOT NULL;

ALTER TABLE "Post" ADD COLUMN "storeId" TEXT;
UPDATE "Post" SET "storeId" = (SELECT "id" FROM "Store" ORDER BY "isDefault" DESC, "createdAt" ASC LIMIT 1);
ALTER TABLE "Post" ALTER COLUMN "storeId" SET NOT NULL;

ALTER TABLE "ProductRelease" ADD COLUMN "storeId" TEXT;
UPDATE "ProductRelease" SET "storeId" = (SELECT "id" FROM "Store" ORDER BY "isDefault" DESC, "createdAt" ASC LIMIT 1);
ALTER TABLE "ProductRelease" ALTER COLUMN "storeId" SET NOT NULL;

ALTER TABLE "ProductReview" ADD COLUMN "storeId" TEXT;
UPDATE "ProductReview" SET "storeId" = (SELECT "id" FROM "Store" ORDER BY "isDefault" DESC, "createdAt" ASC LIMIT 1);
ALTER TABLE "ProductReview" ALTER COLUMN "storeId" SET NOT NULL;

ALTER TABLE "Tag" ADD COLUMN "storeId" TEXT;
UPDATE "Tag" SET "storeId" = (SELECT "id" FROM "Store" ORDER BY "isDefault" DESC, "createdAt" ASC LIMIT 1);
ALTER TABLE "Tag" ALTER COLUMN "storeId" SET NOT NULL;

ALTER TABLE "Theme" ADD COLUMN "storeId" TEXT;
UPDATE "Theme" SET "storeId" = (SELECT "id" FROM "Store" ORDER BY "isDefault" DESC, "createdAt" ASC LIMIT 1);
ALTER TABLE "Theme" ALTER COLUMN "storeId" SET NOT NULL;

-- CreateTable
CREATE TABLE "StoreSetting" (
    "storeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSetting_pkey" PRIMARY KEY ("storeId","key")
);

-- Settings become per store; only the panel's security settings stay install-wide.
INSERT INTO "StoreSetting" ("storeId", "key", "value", "updatedAt")
SELECT (SELECT "id" FROM "Store" ORDER BY "isDefault" DESC, "createdAt" ASC LIMIT 1), "key", "value", "updatedAt" FROM "Setting" WHERE "key" NOT LIKE 'security.%';
DELETE FROM "Setting" WHERE "key" NOT LIKE 'security.%';

-- CreateIndex
CREATE INDEX "BillingPlan_storeId_kind_productSlug_idx" ON "BillingPlan"("storeId", "kind", "productSlug");

-- CreateIndex
CREATE UNIQUE INDEX "Category_storeId_slug_key" ON "Category"("storeId", "slug");

-- CreateIndex
CREATE INDEX "ContactInquiry_storeId_createdAt_idx" ON "ContactInquiry"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "Extension_storeId_status_idx" ON "Extension"("storeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Extension_storeId_slug_key" ON "Extension"("storeId", "slug");

-- CreateIndex
CREATE INDEX "MediaAsset_storeId_createdAt_idx" ON "MediaAsset"("storeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_storeId_email_source_key" ON "NewsletterSubscriber"("storeId", "email", "source");

-- CreateIndex
CREATE UNIQUE INDEX "PageViewDaily_storeId_date_slug_key" ON "PageViewDaily"("storeId", "date", "slug");

-- CreateIndex
CREATE INDEX "Post_storeId_status_idx" ON "Post"("storeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Post_storeId_slug_key" ON "Post"("storeId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProductRelease_storeId_kind_productSlug_version_key" ON "ProductRelease"("storeId", "kind", "productSlug", "version");

-- CreateIndex
CREATE INDEX "ProductReview_storeId_status_createdAt_idx" ON "ProductReview"("storeId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_storeId_slug_key" ON "Tag"("storeId", "slug");

-- CreateIndex
CREATE INDEX "Theme_storeId_status_idx" ON "Theme"("storeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Theme_storeId_slug_key" ON "Theme"("storeId", "slug");

-- AddForeignKey
ALTER TABLE "ContactInquiry" ADD CONSTRAINT "ContactInquiry_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Theme" ADD CONSTRAINT "Theme_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Extension" ADD CONSTRAINT "Extension_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreSetting" ADD CONSTRAINT "StoreSetting_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterSubscriber" ADD CONSTRAINT "NewsletterSubscriber_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPlan" ADD CONSTRAINT "BillingPlan_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRelease" ADD CONSTRAINT "ProductRelease_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageViewDaily" ADD CONSTRAINT "PageViewDaily_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

