CREATE TABLE "StoreMember" (
  "storeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'user',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoreMember_pkey" PRIMARY KEY ("storeId", "userId"),
  CONSTRAINT "StoreMember_role_check" CHECK ("role" IN ('admin', 'user')),
  CONSTRAINT "StoreMember_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StoreMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "StoreMember_userId_idx" ON "StoreMember"("userId");

-- Existing admins previously administered every store. Preserve that access explicitly.
INSERT INTO "StoreMember" ("storeId", "userId", "role", "updatedAt")
SELECT s."id", u."id", 'admin', CURRENT_TIMESTAMP FROM "Store" s CROSS JOIN "user" u WHERE u."role" = 'admin';
-- Earlier registrations did not record a store. Keep them on the default store.
INSERT INTO "StoreMember" ("storeId", "userId", "role", "updatedAt")
SELECT s."id", u."id", 'user', CURRENT_TIMESTAMP FROM "Store" s CROSS JOIN "user" u WHERE s."isDefault" = true AND u."role" = 'user';
-- Purchase records provide an additional, reliable association with a store.
INSERT INTO "StoreMember" ("storeId", "userId", "role", "updatedAt")
SELECT DISTINCT c."storeId", c."userId", 'user', CURRENT_TIMESTAMP FROM "Customer" c WHERE c."userId" IS NOT NULL
ON CONFLICT ("storeId", "userId") DO NOTHING;
