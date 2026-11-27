-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_nameKey_key" ON "Role"("nameKey");

-- Existing people keep their role: save each role already in use (one row per name, any capitalisation).
INSERT INTO "Role" ("id", "name", "nameKey")
SELECT gen_random_uuid()::text, MIN("role"), lower("role") FROM "User" GROUP BY lower("role");
