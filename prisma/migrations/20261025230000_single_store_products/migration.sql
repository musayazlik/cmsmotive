-- A product belongs to exactly one store: ProductStore and Price.storeId go,
-- the sort order moves onto the product. Three statuses replace four (the old
-- stage survives as a badge) and the indicative list price becomes a draft price.

-- Refuse to drop data the old multi-store shape still carries.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ProductStore" ps JOIN "Product" p ON p."id" = ps."productId" WHERE ps."storeId" <> p."storeId") THEN
    RAISE EXCEPTION 'Some products are listed in a store that does not own them. Copy them to that store before migrating.';
  END IF;
  IF EXISTS (SELECT 1 FROM "Price" pr JOIN "Product" p ON p."id" = pr."productId" WHERE pr."storeId" <> p."storeId") THEN
    RAISE EXCEPTION 'Some prices belong to another store than their product. Move them before migrating.';
  END IF;
END $$;

ALTER TABLE "Product" ADD COLUMN "badge" TEXT, ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
UPDATE "Product" p SET "position" = ps."position" FROM "ProductStore" ps WHERE ps."productId" = p."id" AND ps."storeId" = p."storeId";

UPDATE "Product" SET "badge" = CASE "status" WHEN 'planning' THEN 'Planning' WHEN 'in-development' THEN 'In development' END;
UPDATE "Product" SET "status" = CASE WHEN "status" = 'published' THEN 'published' ELSE 'preview' END;
ALTER TABLE "Product" ALTER COLUMN "status" SET DEFAULT 'draft';

-- Products that only had an indicative price keep it as a draft (not buyable) yearly price.
INSERT INTO "Price" ("id", "productId", "storeId", "name", "billingType", "interval", "amountCents", "currency", "taxMode", "enabled", "position", "updatedAt")
SELECT 'list-' || p."id", p."id", p."storeId", CASE WHEN p."listPrice" = 0 THEN 'Free' ELSE 'Indicative price' END, 'recurring', 'year',
  p."listPrice" * 100, 'EUR', 'inclusive', false, 0, CURRENT_TIMESTAMP
FROM "Product" p
WHERE p."listPrice" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Price" pr WHERE pr."productId" = p."id");
ALTER TABLE "Product" DROP COLUMN "listPrice";

ALTER TABLE "Price" DROP CONSTRAINT "Price_storeId_fkey";
DROP INDEX "Price_productId_storeId_position_idx";
DROP INDEX "Price_storeId_idx";
ALTER TABLE "Price" DROP COLUMN "storeId";

ALTER TABLE "ProductStore" DROP CONSTRAINT "ProductStore_productId_fkey";
ALTER TABLE "ProductStore" DROP CONSTRAINT "ProductStore_storeId_fkey";
DROP TABLE "ProductStore";

DROP INDEX "Product_slug_key";
DROP INDEX "Product_storeId_status_idx";
CREATE INDEX "Price_productId_position_idx" ON "Price"("productId", "position");
CREATE INDEX "Product_storeId_status_position_idx" ON "Product"("storeId", "status", "position");
CREATE UNIQUE INDEX "Product_storeId_slug_key" ON "Product"("storeId", "slug");
