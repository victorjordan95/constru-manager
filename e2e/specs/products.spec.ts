import { test, expect } from '../fixtures/index';

test.describe('Produtos', () => {
  test('cria, edita e exclui um produto', async ({ adminPage: page }) => {
    // ── CREATE ──────────────────────────────────────────────────────────────
    await page.goto('/products');
    await page.getByRole('button', { name: '+ Novo Produto' }).click();
    await expect(page).toHaveURL('/products/new');

    await page.getByLabel('Nome *').fill('E2E Produto Teste');
    await page.getByLabel('Custo (R$) *').fill('100');
    await page.getByLabel('Markup (%) *').clear();
    await page.getByLabel('Markup (%) *').fill('20');

    // Preview final price should show (100 * 1.20 = 120.00)
    await expect(page.getByText(/Preço final estimado/)).toBeVisible();

    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(page).toHaveURL('/products');
    await expect(page.getByText('E2E Produto Teste')).toBeVisible();

    // ── EDIT ─────────────────────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Editar' }).first().click();
    await expect(page.getByLabel('Nome *')).toHaveValue('E2E Produto Teste');

    await page.getByLabel('Custo (R$) *').clear();
    await page.getByLabel('Custo (R$) *').fill('200');
    await page.getByRole('button', { name: 'Salvar' }).click();

    await expect(page).toHaveURL('/products');
    await expect(page.getByText('E2E Produto Teste')).toBeVisible();

    // ── DELETE ───────────────────────────────────────────────────────────────
    page.on('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Excluir' }).first().click();
    await expect(page.getByText('E2E Produto Teste')).not.toBeVisible();
  });
});
