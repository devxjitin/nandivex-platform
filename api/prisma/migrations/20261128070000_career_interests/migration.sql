-- CreateTable
CREATE TABLE "CareerInterest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "kind" "CareerKind" NOT NULL,
    "area" TEXT NOT NULL,
    "links" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareerInterest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CareerInterest_createdAt_idx" ON "CareerInterest"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CareerInterest_email_kind_area_key" ON "CareerInterest"("email", "kind", "area");
