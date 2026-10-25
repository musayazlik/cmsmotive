-- Theme/Extension and yearly BillingPlan become Product, ProductType and Price;
-- orders, subscriptions, entitlements, customers, licence keys and transactions
-- record everything Creem sells, one-time and recurring.

-- CreateTable
CREATE TABLE "ProductType" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pluralName" TEXT NOT NULL,
    "description" TEXT,
    "listPath" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'concept',
    "category" TEXT,
    "technologies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "listPrice" INTEGER,
    "compliance" JSONB NOT NULL DEFAULT '{}',
    "tagline" TEXT,
    "intro" TEXT,
    "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "compatibility" JSONB NOT NULL DEFAULT '[]',
    "ctaLabel" TEXT,
    "ctaUrl" TEXT,
    "demoUrl" TEXT,
    "coverId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductStore" (
    "productId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductStore_pkey" PRIMARY KEY ("productId","storeId")
);

-- CreateTable
CREATE TABLE "ProductGallery" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductGallery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Price" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "billingType" TEXT NOT NULL,
    "interval" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "taxMode" TEXT NOT NULL DEFAULT 'inclusive',
    "updatesMonths" INTEGER,
    "seats" INTEGER NOT NULL DEFAULT 1,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "creemTestProductId" TEXT,
    "creemLiveProductId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Price_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT,
    "mode" TEXT NOT NULL,
    "creemCustomerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "priceId" TEXT NOT NULL,
    "checkoutAttemptId" TEXT,
    "creemOrderId" TEXT NOT NULL,
    "creemCheckoutId" TEXT,
    "mode" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "placedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "priceId" TEXT NOT NULL,
    "creemSubscriptionId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "canceledAt" TIMESTAMP(3),
    "providerUpdatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entitlement" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "orderId" TEXT,
    "subscriptionId" TEXT,
    "updatesUntil" TIMESTAMP(3),
    "seats" INTEGER NOT NULL DEFAULT 1,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenseKey" (
    "id" TEXT NOT NULL,
    "entitlementId" TEXT NOT NULL,
    "creemLicenseId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "activations" INTEGER NOT NULL DEFAULT 0,
    "activationLimit" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "mode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LicenseKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderId" TEXT,
    "subscriptionId" TEXT,
    "creemTransactionId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "amountPaidCents" INTEGER,
    "taxCents" INTEGER,
    "discountCents" INTEGER,
    "refundedCents" INTEGER,
    "currency" TEXT NOT NULL,
    "taxCountry" TEXT,
    "description" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);
-- ---------------------------------------------------------------- catalogue
-- Themes and extensions become products of two types. Their ids are kept, so
-- galleries, reviews and changelog entries keep pointing at the same rows.
INSERT INTO "ProductType" ("id", "key", "name", "pluralName", "listPath", "position", "updatedAt") VALUES
  ('type-theme', 'theme', 'Theme', 'Themes', '/themes', 0, CURRENT_TIMESTAMP),
  ('type-extension', 'extension', 'Extension', 'Extensions', '/extensions', 1, CURRENT_TIMESTAMP);

INSERT INTO "Product" ("id", "storeId", "typeId", "slug", "name", "summary", "description", "status", "category",
  "technologies", "listPrice", "compliance", "tagline", "intro", "highlights", "compatibility",
  "ctaLabel", "ctaUrl", "demoUrl", "coverId", "createdAt", "updatedAt")
SELECT "id", "storeId", 'type-theme', "slug", "name", "summary", "description", "status", NULLIF("industry", ''),
  CASE "versionTarget"
    WHEN 'TYPO3 13 / 14' THEN ARRAY['TYPO3 13', 'TYPO3 14']
    WHEN 'Not decided' THEN ARRAY[]::TEXT[]
    WHEN '' THEN ARRAY[]::TEXT[]
    ELSE ARRAY["versionTarget"]
  END,
  "price", "compliance", "tagline", "intro", "highlights", "compatibility",
  "ctaLabel", "ctaUrl", "demoUrl", "coverId", "createdAt", "updatedAt"
FROM "Theme";

-- Extension slugs that collide with a theme slug get a suffix: product slugs are unique across stores.
INSERT INTO "Product" ("id", "storeId", "typeId", "slug", "name", "summary", "description", "status",
  "compliance", "tagline", "intro", "highlights", "compatibility",
  "ctaLabel", "ctaUrl", "demoUrl", "coverId", "createdAt", "updatedAt")
SELECT e."id", e."storeId", 'type-extension',
  CASE WHEN EXISTS (SELECT 1 FROM "Theme" t WHERE t."slug" = e."slug") THEN e."slug" || '-extension' ELSE e."slug" END,
  e."name", e."summary", e."description", e."status",
  e."compliance", e."tagline", e."intro", e."highlights", e."compatibility",
  e."ctaLabel", e."ctaUrl", e."demoUrl", e."coverId", e."createdAt", e."updatedAt"
FROM "Extension" e;

INSERT INTO "ProductStore" ("productId", "storeId", "position")
SELECT "id", "storeId", "position" FROM "Theme"
UNION ALL
SELECT "id", "storeId", "position" FROM "Extension";

INSERT INTO "ProductGallery" ("id", "productId", "assetId", "position")
SELECT "id", "themeId", "assetId", "position" FROM "ThemeGallery"
UNION ALL
SELECT "id", "extensionId", "assetId", "position" FROM "ExtensionGallery";

-- ------------------------------------------------------------------- prices
-- Yearly service plans keep their ids (checkout attempts and subscriptions refer to them).
INSERT INTO "Price" ("id", "productId", "storeId", "name", "billingType", "interval", "amountCents", "currency",
  "taxMode", "seats", "creemTestProductId", "creemLiveProductId", "enabled", "position", "createdAt", "updatedAt")
SELECT b."id", COALESCE(t."id", e."id"), b."storeId", b."name", 'recurring', 'year', b."priceCents", b."currency",
  'inclusive', b."installations", b."creemTestProductId", b."creemLiveProductId", b."enabled", 0, b."createdAt", b."updatedAt"
FROM "BillingPlan" b
LEFT JOIN "Theme" t ON b."kind" = 'theme' AND t."storeId" = b."storeId" AND t."slug" = b."productSlug"
LEFT JOIN "Extension" e ON b."kind" = 'extension' AND e."storeId" = b."storeId" AND e."slug" = b."productSlug"
WHERE COALESCE(t."id", e."id") IS NOT NULL;

-- The themes' indicative licence list becomes disabled yearly prices (shown, not buyable).
INSERT INTO "Price" ("id", "productId", "storeId", "name", "billingType", "interval", "amountCents", "currency",
  "taxMode", "enabled", "position", "updatedAt")
SELECT 'licence-' || t."id" || '-' || l.ordinality, t."id", t."storeId", l.value->>'name', 'recurring', 'year',
  ROUND((l.value->>'price')::NUMERIC * 100)::INTEGER, 'EUR', 'inclusive', false, 10 + l.ordinality::INTEGER, CURRENT_TIMESTAMP
FROM "Theme" t, jsonb_array_elements(t."licences") WITH ORDINALITY AS l(value, ordinality)
WHERE jsonb_typeof(t."licences") = 'array'
  AND l.value ? 'name' AND l.value ? 'price';

-- ------------------------------------------------- product references by id
ALTER TABLE "ChangelogEntry" ADD COLUMN "productId" TEXT;
UPDATE "ChangelogEntry" SET "productId" = COALESCE("themeId", "extensionId");
DELETE FROM "ChangelogEntry" WHERE "productId" IS NULL;
ALTER TABLE "ChangelogEntry" ALTER COLUMN "productId" SET NOT NULL;

ALTER TABLE "ProductReview" ADD COLUMN "productId" TEXT;
UPDATE "ProductReview" SET "productId" = COALESCE("themeId", "extensionId");
DELETE FROM "ProductReview" WHERE "productId" IS NULL;
ALTER TABLE "ProductReview" ALTER COLUMN "productId" SET NOT NULL;

ALTER TABLE "ProductRelease" ADD COLUMN "productId" TEXT;
UPDATE "ProductRelease" r SET "productId" = COALESCE(
  (SELECT t."id" FROM "Theme" t WHERE r."kind" = 'theme' AND t."storeId" = r."storeId" AND t."slug" = r."productSlug"),
  (SELECT e."id" FROM "Extension" e WHERE r."kind" = 'extension' AND e."storeId" = r."storeId" AND e."slug" = r."productSlug"));
DELETE FROM "ProductRelease" WHERE "productId" IS NULL;
ALTER TABLE "ProductRelease" ALTER COLUMN "productId" SET NOT NULL;

ALTER TABLE "CheckoutAttempt" ADD COLUMN "priceId" TEXT, ADD COLUMN "storeId" TEXT;
UPDATE "CheckoutAttempt" a SET "priceId" = p."id", "storeId" = p."storeId" FROM "Price" p WHERE p."id" = a."planId";
DELETE FROM "CheckoutAttempt" WHERE "priceId" IS NULL;
ALTER TABLE "CheckoutAttempt" ALTER COLUMN "priceId" SET NOT NULL, ALTER COLUMN "storeId" SET NOT NULL;

-- ------------------------------------------------------------ subscriptions
-- Existing yearly subscriptions: one customer per store and Creem customer, the
-- subscription itself and the entitlement its paid periods grant.
INSERT INTO "Customer" ("id", "storeId", "userId", "mode", "creemCustomerId", "email", "name", "updatedAt")
SELECT DISTINCT ON (p."storeId", s."creemCustomerId")
  'cus-' || md5(p."storeId" || s."creemCustomerId"), p."storeId", u."id", s."mode", s."creemCustomerId",
  COALESCE(u."email", ''), u."name", CURRENT_TIMESTAMP
FROM "ProductSubscription" s
JOIN "Price" p ON p."id" = s."planId"
LEFT JOIN "user" u ON u."id" = s."userId"
ORDER BY p."storeId", s."creemCustomerId", s."createdAt";

INSERT INTO "Subscription" ("id", "storeId", "customerId", "productId", "priceId", "creemSubscriptionId", "mode", "status",
  "currentPeriodStart", "currentPeriodEnd", "providerUpdatedAt", "createdAt", "updatedAt")
SELECT s."id", p."storeId", 'cus-' || md5(p."storeId" || s."creemCustomerId"), p."productId", p."id", s."creemSubscriptionId",
  s."mode", s."status", s."currentPeriodStart", s."currentPeriodEnd", s."providerUpdatedAt", s."createdAt", s."updatedAt"
FROM "ProductSubscription" s
JOIN "Price" p ON p."id" = s."planId";

INSERT INTO "Entitlement" ("id", "storeId", "customerId", "productId", "subscriptionId", "updatesUntil", "seats",
  "revokedAt", "revokeReason", "createdAt", "updatedAt")
SELECT 'ent-' || s."id", s."storeId", s."customerId", s."productId", s."id", s."currentPeriodEnd", p."seats",
  CASE WHEN s."status" IN ('refunded', 'disputed') THEN s."updatedAt" END,
  CASE s."status" WHEN 'refunded' THEN 'refund' WHEN 'disputed' THEN 'dispute' END,
  s."createdAt", s."updatedAt"
FROM "Subscription" s
JOIN "Price" p ON p."id" = s."priceId";
-- ---------------------------------------------------------- retire the old shape
ALTER TABLE "BillingPlan" DROP CONSTRAINT "BillingPlan_storeId_fkey";
ALTER TABLE "ChangelogEntry" DROP CONSTRAINT "ChangelogEntry_extensionId_fkey";
ALTER TABLE "ChangelogEntry" DROP CONSTRAINT "ChangelogEntry_themeId_fkey";
ALTER TABLE "ProductRelease" DROP CONSTRAINT "ProductRelease_storeId_fkey";
ALTER TABLE "ProductReview" DROP CONSTRAINT "ProductReview_extensionId_fkey";
ALTER TABLE "ProductReview" DROP CONSTRAINT "ProductReview_themeId_fkey";
DROP INDEX "ChangelogEntry_extensionId_releasedAt_idx";
DROP INDEX "ChangelogEntry_themeId_releasedAt_idx";
DROP INDEX "ProductRelease_storeId_kind_productSlug_version_key";
DROP INDEX "ProductReview_extensionId_status_createdAt_idx";
DROP INDEX "ProductReview_themeId_status_createdAt_idx";
ALTER TABLE "ChangelogEntry" DROP COLUMN "extensionId", DROP COLUMN "themeId";
ALTER TABLE "CheckoutAttempt" DROP COLUMN "planId";
ALTER TABLE "ProductRelease" DROP COLUMN "kind", DROP COLUMN "productSlug", DROP COLUMN "storeId";
ALTER TABLE "ProductReview" DROP COLUMN "extensionId", DROP COLUMN "themeId";
DROP TABLE "ThemeGallery";
DROP TABLE "ExtensionGallery";
DROP TABLE "Theme";
DROP TABLE "Extension";
DROP TABLE "ProductSubscription";
DROP TABLE "BillingPlan";
-- ---------------------------------------------------------- indexes and keys
CREATE UNIQUE INDEX "ProductType_key_key" ON "ProductType"("key");
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE INDEX "Product_storeId_status_idx" ON "Product"("storeId", "status");
CREATE INDEX "Product_typeId_idx" ON "Product"("typeId");
CREATE INDEX "ProductStore_storeId_position_idx" ON "ProductStore"("storeId", "position");
CREATE INDEX "ProductGallery_productId_position_idx" ON "ProductGallery"("productId", "position");
CREATE UNIQUE INDEX "ProductGallery_productId_assetId_key" ON "ProductGallery"("productId", "assetId");
CREATE UNIQUE INDEX "Price_creemTestProductId_key" ON "Price"("creemTestProductId");
CREATE UNIQUE INDEX "Price_creemLiveProductId_key" ON "Price"("creemLiveProductId");
CREATE INDEX "Price_productId_storeId_position_idx" ON "Price"("productId", "storeId", "position");
CREATE INDEX "Price_storeId_idx" ON "Price"("storeId");
CREATE INDEX "Customer_storeId_userId_mode_idx" ON "Customer"("storeId", "userId", "mode");
CREATE INDEX "Customer_storeId_email_idx" ON "Customer"("storeId", "email");
CREATE UNIQUE INDEX "Customer_storeId_creemCustomerId_key" ON "Customer"("storeId", "creemCustomerId");
CREATE UNIQUE INDEX "Order_checkoutAttemptId_key" ON "Order"("checkoutAttemptId");
CREATE UNIQUE INDEX "Order_creemOrderId_key" ON "Order"("creemOrderId");
CREATE INDEX "Order_storeId_placedAt_idx" ON "Order"("storeId", "placedAt");
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");
CREATE UNIQUE INDEX "Subscription_creemSubscriptionId_key" ON "Subscription"("creemSubscriptionId");
CREATE INDEX "Subscription_storeId_status_idx" ON "Subscription"("storeId", "status");
CREATE INDEX "Subscription_customerId_idx" ON "Subscription"("customerId");
CREATE UNIQUE INDEX "Entitlement_orderId_key" ON "Entitlement"("orderId");
CREATE UNIQUE INDEX "Entitlement_subscriptionId_key" ON "Entitlement"("subscriptionId");
CREATE INDEX "Entitlement_storeId_createdAt_idx" ON "Entitlement"("storeId", "createdAt");
CREATE INDEX "Entitlement_customerId_idx" ON "Entitlement"("customerId");
CREATE INDEX "Entitlement_productId_idx" ON "Entitlement"("productId");
CREATE UNIQUE INDEX "LicenseKey_creemLicenseId_key" ON "LicenseKey"("creemLicenseId");
CREATE INDEX "LicenseKey_entitlementId_idx" ON "LicenseKey"("entitlementId");
CREATE UNIQUE INDEX "Transaction_creemTransactionId_key" ON "Transaction"("creemTransactionId");
CREATE INDEX "Transaction_storeId_occurredAt_idx" ON "Transaction"("storeId", "occurredAt");
CREATE INDEX "Transaction_customerId_idx" ON "Transaction"("customerId");
CREATE INDEX "ChangelogEntry_productId_releasedAt_idx" ON "ChangelogEntry"("productId", "releasedAt");
CREATE UNIQUE INDEX "ProductRelease_productId_version_key" ON "ProductRelease"("productId", "version");
CREATE INDEX "ProductReview_productId_status_createdAt_idx" ON "ProductReview"("productId", "status", "createdAt");
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChangelogEntry" ADD CONSTRAINT "ChangelogEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "ProductType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_coverId_fkey" FOREIGN KEY ("coverId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductStore" ADD CONSTRAINT "ProductStore_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductStore" ADD CONSTRAINT "ProductStore_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductGallery" ADD CONSTRAINT "ProductGallery_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductGallery" ADD CONSTRAINT "ProductGallery_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductRelease" ADD CONSTRAINT "ProductRelease_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Price" ADD CONSTRAINT "Price_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Price" ADD CONSTRAINT "Price_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CheckoutAttempt" ADD CONSTRAINT "CheckoutAttempt_priceId_fkey" FOREIGN KEY ("priceId") REFERENCES "Price"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_priceId_fkey" FOREIGN KEY ("priceId") REFERENCES "Price"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_priceId_fkey" FOREIGN KEY ("priceId") REFERENCES "Price"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LicenseKey" ADD CONSTRAINT "LicenseKey_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "Entitlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
