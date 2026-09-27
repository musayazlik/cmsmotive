-- CreateTable
CREATE TABLE "PageViewDaily" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "slug" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageViewDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PageViewDaily_date_slug_key" ON "PageViewDaily"("date", "slug");

