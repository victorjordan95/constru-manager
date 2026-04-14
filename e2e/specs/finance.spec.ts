import { test, expect } from '../fixtures/index';

test.describe('Financeiro', () => {
  test('define saldo inicial', async ({ financePage: page }) => {
    await page.goto('/finance');
    await expect(page.getByText('Saldo em Caixa')).toBeVisible();

    await page.getByRole('button', { name: 'Editar saldo inicial' }).click();
    await page.getByPlaceholder('Ex: 5000.00').fill('1000');
    await page.getByRole('button', { name: 'Salvar' }).click();

    // After save, the balance card reflects the new opening balance
    // openingBalance = 100000 cents → "Saldo inicial: R$ 1.000,00"
    // Note: Intl.NumberFormat uses non-breaking space between R$ and number
    await expect(page.getByText(/Saldo inicial:\s*R\$\s*1\.000,00/)).toBeVisible();
  });

  test('exibe parcela do mês e marca como paga', async ({
    financePage: page,
    acceptedQuote,
  }) => {
    await page.goto('/finance');

    // The installment from acceptedQuote (dueDate = today) should appear in table
    // "E2E Quote Client" is the clientName set in the fixture
    await expect(page.getByText('E2E Quote Client')).toBeVisible();

    // Mark the installment as paid
    const row = page.getByText('E2E Quote Client').locator('../..');
    await row.getByRole('button', { name: 'Marcar como pago' }).click();

    // After invalidation + refetch, status changes to "Pago"
    await expect(row.getByText('Pago')).toBeVisible({ timeout: 8000 });
  });

  test('exibe despesa fixa do mês e marca como paga', async ({
    financePage: page,
    createdExpense,
  }) => {
    await page.goto('/finance');

    // Fetching /finance/summary auto-creates FixedExpenseLog for createdExpense
    // in the current month — so it appears in the expenseLogs table
    await expect(page.getByText(createdExpense.name)).toBeVisible();

    const row = page.getByText(createdExpense.name).locator('../..');
    await row.getByRole('button', { name: 'Marcar como pago' }).click();

    await expect(row.getByText('Pago')).toBeVisible({ timeout: 8000 });
  });
});
