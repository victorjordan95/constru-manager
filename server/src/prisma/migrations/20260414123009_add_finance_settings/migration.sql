-- CreateTable
CREATE TABLE "FinanceSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "openingBalance" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FinanceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FixedExpenseLog_fixedExpenseId_month_year_key" ON "FixedExpenseLog"("fixedExpenseId", "month", "year");
