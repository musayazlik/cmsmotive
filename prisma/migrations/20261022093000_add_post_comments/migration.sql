-- CreateTable
CREATE TABLE "PostComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "parentId" TEXT,
    "authorName" TEXT NOT NULL,
    "authorEmail" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "requestKey" TEXT NOT NULL,
    "moderatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PostComment_requestKey_key" ON "PostComment"("requestKey");

-- CreateIndex
CREATE INDEX "PostComment_postId_status_createdAt_idx" ON "PostComment"("postId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PostComment_parentId_status_createdAt_idx" ON "PostComment"("parentId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PostComment_status_createdAt_idx" ON "PostComment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PostComment_authorEmail_createdAt_idx" ON "PostComment"("authorEmail", "createdAt");

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PostComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
