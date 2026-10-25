-- DropIndex
DROP INDEX "MediaAsset_key_key";

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_storeId_key_key" ON "MediaAsset"("storeId", "key");

