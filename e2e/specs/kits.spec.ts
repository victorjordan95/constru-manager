import { test, expect } from '../fixtures/index';

test.describe('Kits', () => {
  test('cria e edita um kit', async ({ adminPage: page, createdProduct }) => {
    // ── CREATE ──────────────────────────────────────────────────────────────
    await page.goto('/kits');
    await page.getByRole('button', { name: '+ Novo Kit' }).click();
    await expect(page).toHaveURL('/kits/new');

    await page.getByLabel('Nome do Kit *').fill('E2E Kit Teste');

    // The first <select> on the form is the product selector for the first item row
    // (it has a default "Selecione um produto" option)
    await page.getByRole('combobox').first().selectOption({ label: createdProduct.name });

    // Quantity input — default is 1, change to 2
    await page.getByRole('spinbutton').first().fill('2');

    // Preview total should be visible (createdProduct.finalPrice * 2 = 24000 → R$ 240,00)
    await expect(page.getByText(/Total estimado/)).toBeVisible();

    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(page).toHaveURL('/kits');
    await expect(page.getByText('E2E Kit Teste')).toBeVisible();

    // ── EDIT ─────────────────────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Editar' }).first().click();
    await expect(page.getByLabel('Nome do Kit *')).toHaveValue('E2E Kit Teste');

    await page.getByLabel('Nome do Kit *').clear();
    await page.getByLabel('Nome do Kit *').fill('E2E Kit Editado');
    await page.getByRole('button', { name: 'Salvar' }).click();

    await expect(page).toHaveURL('/kits');
    await expect(page.getByText('E2E Kit Editado')).toBeVisible();
  });
});
