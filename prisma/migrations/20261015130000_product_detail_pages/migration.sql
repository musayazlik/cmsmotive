-- DropIndex
DROP INDEX "ProductReview_productSlug_status_createdAt_idx";

-- AlterTable
ALTER TABLE "Extension" ADD COLUMN     "compatibility" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "ctaLabel" TEXT,
ADD COLUMN     "ctaUrl" TEXT,
ADD COLUMN     "demoUrl" TEXT,
ADD COLUMN     "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "intro" TEXT,
ADD COLUMN     "tagline" TEXT;

-- AlterTable
ALTER TABLE "ProductReview" ADD COLUMN     "extensionId" TEXT,
ADD COLUMN     "themeId" TEXT;

-- AlterTable
ALTER TABLE "Theme" ADD COLUMN     "compatibility" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "ctaLabel" TEXT,
ADD COLUMN     "ctaUrl" TEXT,
ADD COLUMN     "demoUrl" TEXT,
ADD COLUMN     "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "intro" TEXT,
ADD COLUMN     "licences" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "tagline" TEXT;

-- CreateTable
CREATE TABLE "ChangelogEntry" (
    "id" TEXT NOT NULL,
    "themeId" TEXT,
    "extensionId" TEXT,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "releasedAt" TIMESTAMP(3) NOT NULL,
    "changes" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChangelogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChangelogEntry_themeId_releasedAt_idx" ON "ChangelogEntry"("themeId", "releasedAt");

-- CreateIndex
CREATE INDEX "ChangelogEntry_extensionId_releasedAt_idx" ON "ChangelogEntry"("extensionId", "releasedAt");

-- CreateIndex
CREATE INDEX "ChangelogEntry_createdAt_idx" ON "ChangelogEntry"("createdAt");

-- CreateIndex
CREATE INDEX "ProductReview_themeId_status_createdAt_idx" ON "ProductReview"("themeId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ProductReview_extensionId_status_createdAt_idx" ON "ProductReview"("extensionId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "Extension"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangelogEntry" ADD CONSTRAINT "ChangelogEntry_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangelogEntry" ADD CONSTRAINT "ChangelogEntry_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "Extension"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Link existing reviews (keyed by slug until now) to their theme or extension.
UPDATE "ProductReview" AS r SET "themeId" = t."id" FROM "Theme" AS t WHERE r."themeId" IS NULL AND t."slug" = r."productSlug";
UPDATE "ProductReview" AS r SET "extensionId" = e."id" FROM "Extension" AS e WHERE r."themeId" IS NULL AND r."extensionId" IS NULL AND e."slug" = r."productSlug";
