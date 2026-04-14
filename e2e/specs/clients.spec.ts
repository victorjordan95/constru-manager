import { test, expect } from '../fixtures/index';

test.describe('Clientes', () => {
  test('cria, edita e exclui um cliente', async ({ adminPage: page }) => {
    // ── CREATE ──────────────────────────────────────────────────────────────
    await page.goto('/clients');
    await page.getByRole('button', { name: '+ Novo Cliente' }).click();
    await expect(page).toHaveURL('/clients/new');

    await page.getByLabel('Nome *').fill('E2E Cliente Teste');
    // Label text is dynamic: "CPF/CNPJ *" before typing, regex handles all states
    await page.getByLabel(/CPF|CNPJ/).fill('12345678909');
    await page.getByRole('button', { name: 'Criar' }).click();

    await expect(page).toHaveURL('/clients');
    await expect(page.getByText('E2E Cliente Teste')).toBeVisible();

    // ── EDIT ─────────────────────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Editar' }).first().click();
    await expect(page.getByLabel('Nome *')).toHaveValue('E2E Cliente Teste');

    await page.getByLabel('Nome *').clear();
    await page.getByLabel('Nome *').fill('E2E Cliente Editado');
    await page.getByRole('button', { name: 'Salvar' }).click();

    await expect(page).toHaveURL('/clients');
    await expect(page.getByText('E2E Cliente Editado')).toBeVisible();

    // ── DELETE ───────────────────────────────────────────────────────────────
    page.on('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Excluir' }).first().click();
    // After deletion + query invalidation the row disappears
    await expect(page.getByText('E2E Cliente Editado')).not.toBeVisible();
  });
});
