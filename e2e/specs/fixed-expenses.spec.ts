import { test, expect } from '../fixtures/index';

test.describe('Despesas Fixas', () => {
  test('cria, edita e desativa uma despesa fixa', async ({ financePage: page }) => {
    // ── CREATE ──────────────────────────────────────────────────────────────
    await page.goto('/fixed-expenses');
    await page.getByRole('button', { name: '+ Nova Despesa' }).click();
    await expect(page).toHaveURL('/fixed-expenses/new');

    await page.getByLabel('Nome *').fill('E2E Conta Luz Teste');
    await page.getByLabel('Valor (R$) *').fill('150');
    await page.getByLabel('Dia de Vencimento (1–28) *').fill('10');
    await page.getByLabel('Categoria').fill('Energia');

    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(page).toHaveURL('/fixed-expenses');
    await expect(page.getByText('E2E Conta Luz Teste')).toBeVisible();

    // ── EDIT ─────────────────────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Editar' }).first().click();
    await expect(page.getByLabel('Nome *')).toHaveValue('E2E Conta Luz Teste');

    await page.getByLabel('Valor (R$) *').clear();
    await page.getByLabel('Valor (R$) *').fill('200');
    await page.getByRole('button', { name: 'Salvar' }).click();

    await expect(page).toHaveURL('/fixed-expenses');
    // R$ 200.00 = 20000 cents; formatCurrency(20000) → "R$ 200,00"
    await expect(page.getByText('R$ 200,00')).toBeVisible();

    // ── DEACTIVATE ───────────────────────────────────────────────────────────
    page.on('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Desativar' }).first().click();
    await expect(page.getByText('E2E Conta Luz Teste')).not.toBeVisible();
  });
});
