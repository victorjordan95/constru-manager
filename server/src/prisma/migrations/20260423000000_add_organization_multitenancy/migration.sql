-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';

-- DropIndex
DROP INDEX "Client_taxId_key";

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- AlterTable (add nullable columns first)
ALTER TABLE "User" ADD COLUMN "organizationId" TEXT;

ALTER TABLE "Client" ADD COLUMN "organizationId" TEXT;

ALTER TABLE "Product" ADD COLUMN "organizationId" TEXT;

ALTER TABLE "Kit" ADD COLUMN "organizationId" TEXT;

ALTER TABLE "Quote" ADD COLUMN "organizationId" TEXT;

ALTER TABLE "FixedExpense" ADD COLUMN "organizationId" TEXT;

ALTER TABLE "FinanceSettings" ADD COLUMN "organizationId" TEXT,
ALTER COLUMN "id" DROP DEFAULT;

-- Seed default organization for existing data
INSERT INTO "Organization" (id, name, "isActive", "createdAt")
VALUES ('cldefaultorg0000000000000', 'Organização Demo', true, NOW());

-- Backfill all existing rows with the default org
UPDATE "User"            SET "organizationId" = 'cldefaultorg0000000000000' WHERE "organizationId" IS NULL;
UPDATE "Client"          SET "organizationId" = 'cldefaultorg0000000000000' WHERE "organizationId" IS NULL;
UPDATE "Product"         SET "organizationId" = 'cldefaultorg0000000000000' WHERE "organizationId" IS NULL;
UPDATE "Kit"             SET "organizationId" = 'cldefaultorg0000000000000' WHERE "organizationId" IS NULL;
UPDATE "Quote"           SET "organizationId" = 'cldefaultorg0000000000000' WHERE "organizationId" IS NULL;
UPDATE "FixedExpense"    SET "organizationId" = 'cldefaultorg0000000000000' WHERE "organizationId" IS NULL;
UPDATE "FinanceSettings" SET "organizationId" = 'cldefaultorg0000000000000' WHERE "organizationId" IS NULL;

-- Enforce NOT NULL on business tables (User stays nullable for SUPER_ADMIN)
ALTER TABLE "Client"          ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Product"         ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Kit"             ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Quote"           ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "FixedExpense"    ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "FinanceSettings" ALTER COLUMN "organizationId" SET NOT NULL;

-- Composite unique on Client (after backfill, so no NULLs remain)
CREATE UNIQUE INDEX "Client_taxId_organizationId_key" ON "Client"("taxId", "organizationId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kit" ADD CONSTRAINT "Kit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedExpense" ADD CONSTRAINT "FixedExpense_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSettings" ADD CONSTRAINT "FinanceSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "FinanceSettings_organizationId_key" ON "FinanceSettings"("organizationId");
