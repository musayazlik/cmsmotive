-- AI review is advisory and never changes the administrator's publication status.
ALTER TABLE "PostComment"
ADD COLUMN "aiCheckedAt" TIMESTAMP(3),
ADD COLUMN "aiModel" TEXT,
ADD COLUMN "aiNote" TEXT,
ADD COLUMN "aiReviewToken" TEXT,
ADD COLUMN "aiStatus" TEXT NOT NULL DEFAULT 'pending';

-- Historical comments were not queued by a submission request.
UPDATE "PostComment" SET "aiStatus" = 'not_checked', "aiNote" = 'This comment predates AI review. Run a check from the actions menu.';
