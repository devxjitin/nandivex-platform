-- CreateEnum
CREATE TYPE "CareerKind" AS ENUM ('CAREER', 'INTERNSHIP');

-- CreateEnum
CREATE TYPE "CareerStatus" AS ENUM ('OPEN', 'UPCOMING', 'HIDDEN');

-- CreateTable
CREATE TABLE "CareerSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "statusTitle" TEXT NOT NULL,
    "statusText" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerRole" (
    "id" TEXT NOT NULL,
    "kind" "CareerKind" NOT NULL,
    "status" "CareerStatus" NOT NULL DEFAULT 'UPCOMING',
    "title" TEXT NOT NULL,
    "blurb" TEXT NOT NULL,
    "skills" TEXT[],
    "department" TEXT,
    "location" TEXT,
    "type" TEXT,
    "experience" TEXT,
    "overview" TEXT,
    "responsibilities" TEXT[],
    "requirements" TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CareerRole_status_sortOrder_idx" ON "CareerRole"("status", "sortOrder");

-- Seed: what the Careers page showed before it became editable, so nothing is lost.
INSERT INTO "CareerSettings" ("id", "statusTitle", "statusText", "updatedAt") VALUES (1, 'No openings right now. Hiring opens soon.', 'We are not hiring today, but we will open careers and internships soon. Join the list and we will email you the moment a role goes live.', CURRENT_TIMESTAMP);
INSERT INTO "CareerRole" ("id", "kind", "status", "title", "blurb", "skills", "responsibilities", "requirements", "sortOrder", "updatedAt") VALUES (gen_random_uuid()::text, 'CAREER', 'UPCOMING', 'AI / LLM Engineer', 'Build voice and chat agents with Gemini, RAG and MCP, from idea to production.', ARRAY['Python', 'LLMs', 'RAG', 'FastAPI']::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 0, CURRENT_TIMESTAMP);
INSERT INTO "CareerRole" ("id", "kind", "status", "title", "blurb", "skills", "responsibilities", "requirements", "sortOrder", "updatedAt") VALUES (gen_random_uuid()::text, 'CAREER', 'UPCOMING', 'Android Developer', 'Ship native Kotlin apps and voice assistants with Jetpack Compose.', ARRAY['Kotlin', 'Jetpack Compose', 'Gemini Live']::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 1, CURRENT_TIMESTAMP);
INSERT INTO "CareerRole" ("id", "kind", "status", "title", "blurb", "skills", "responsibilities", "requirements", "sortOrder", "updatedAt") VALUES (gen_random_uuid()::text, 'CAREER', 'UPCOMING', 'Full Stack Developer', 'Build the websites, dashboards and backends behind our products and client projects.', ARRAY['React', 'Next.js', 'Node.js', 'PostgreSQL']::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 2, CURRENT_TIMESTAMP);
INSERT INTO "CareerRole" ("id", "kind", "status", "title", "blurb", "skills", "responsibilities", "requirements", "sortOrder", "updatedAt") VALUES (gen_random_uuid()::text, 'CAREER', 'UPCOMING', 'UI/UX & Product Designer', 'Design the look and feel of assistants, apps and websites, from logo to screens.', ARRAY['UI design', 'Brand identity', 'Figma']::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 3, CURRENT_TIMESTAMP);
INSERT INTO "CareerRole" ("id", "kind", "status", "title", "blurb", "skills", "responsibilities", "requirements", "sortOrder", "updatedAt") VALUES (gen_random_uuid()::text, 'CAREER', 'UPCOMING', 'Penetration Tester', 'Find and report real weaknesses in web apps, APIs and networks for client projects and our own products.', ARRAY['OWASP Top 10', 'Burp Suite', 'Networking', 'Linux']::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 4, CURRENT_TIMESTAMP);
INSERT INTO "CareerRole" ("id", "kind", "status", "title", "blurb", "skills", "responsibilities", "requirements", "sortOrder", "updatedAt") VALUES (gen_random_uuid()::text, 'CAREER', 'UPCOMING', 'SOC Analyst', 'Monitor logs and alerts, triage incidents and write up what happened, so threats are caught early.', ARRAY['SIEM', 'Log analysis', 'Incident response', 'Networking']::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 5, CURRENT_TIMESTAMP);
INSERT INTO "CareerRole" ("id", "kind", "status", "title", "blurb", "skills", "responsibilities", "requirements", "sortOrder", "updatedAt") VALUES (gen_random_uuid()::text, 'INTERNSHIP', 'UPCOMING', 'AI Agents Intern', 'Work with our engineers on real agent projects and learn how they are tested and shipped.', ARRAY['Python', 'Basics of LLMs']::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 6, CURRENT_TIMESTAMP);
INSERT INTO "CareerRole" ("id", "kind", "status", "title", "blurb", "skills", "responsibilities", "requirements", "sortOrder", "updatedAt") VALUES (gen_random_uuid()::text, 'INTERNSHIP', 'UPCOMING', 'Android Intern', 'Build and test features in a native Android app under an engineer''s guidance.', ARRAY['Kotlin', 'Android basics']::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 7, CURRENT_TIMESTAMP);
INSERT INTO "CareerRole" ("id", "kind", "status", "title", "blurb", "skills", "responsibilities", "requirements", "sortOrder", "updatedAt") VALUES (gen_random_uuid()::text, 'INTERNSHIP', 'UPCOMING', 'Web Development Intern', 'Help build websites and dashboards with a real code review on every change.', ARRAY['HTML/CSS', 'JavaScript', 'React']::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 8, CURRENT_TIMESTAMP);
INSERT INTO "CareerRole" ("id", "kind", "status", "title", "blurb", "skills", "responsibilities", "requirements", "sortOrder", "updatedAt") VALUES (gen_random_uuid()::text, 'INTERNSHIP', 'UPCOMING', 'UI/UX Design Intern', 'Support product and brand design for live projects.', ARRAY['Figma', 'Visual design']::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 9, CURRENT_TIMESTAMP);
