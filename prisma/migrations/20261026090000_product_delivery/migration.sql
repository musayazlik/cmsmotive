-- Delivery handled by the store itself: our own licence keys and a note for buyers.

-- AlterTable
ALTER TABLE "LicenseKey" ALTER COLUMN "creemLicenseId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "deliveryNote" TEXT,
ADD COLUMN     "issueLicenseKeys" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "LicenseKey_key_key" ON "LicenseKey"("key");
