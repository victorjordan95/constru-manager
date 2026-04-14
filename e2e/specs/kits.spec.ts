import { test, expect } from '../fixtures/index';

test.describe('Kits', () => {
  test('cria e edita um kit', async ({ adminPage: page, createdProduct }) => {
    // ── CREATE ──────────────────────────────────────────────────────────────
    await page.goto('/kits');
    await page.getByRole('button', { name: '+ Novo Kit' }).click();
    await expect(page).toHaveURL('/kits/new');

    await page.getByLabel('Nome do Kit *').fill('E2E Kit Teste');

    // Wait for products to load into the select
    await expect(
      page.getByRole('combobox').first().locator(`option[value="${createdProduct.id}"]`),
    ).toHaveCount(1);

    // The first <select> on the form is the product selector for the first item row
    await page.getByRole('combobox').first().selectOption(createdProduct.id);

    // Quantity input — default is 1, change to 2
    await page.getByRole('spinbutton').first().fill('2');

    // Preview total should be visible (createdProduct.finalPrice * 2 = 24000 → R$ 240,00)
    await expect(page.getByText(/Total estimado/)).toBeVisible();

    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(page).toHaveURL('/kits');
    await expect(page.getByText('E2E Kit Teste')).toBeVisible();

    // ── EDIT ─────────────────────────────────────────────────────────────────
    // The kit card is the closest ancestor div containing the heading and the Editar link
    const kitCard = page
      .getByRole('heading', { name: 'E2E Kit Teste', exact: true })
      .locator('xpath=ancestor::div[.//a[.//button[normalize-space()="Editar"]]][1]');
    await kitCard.getByRole('button', { name: 'Editar' }).click();
    await page.waitForURL(/\/kits\/[^/]+\/edit/);
    await expect(page.getByLabel('Nome do Kit *')).toHaveValue('E2E Kit Teste');

    await page.getByLabel('Nome do Kit *').clear();
    await page.getByLabel('Nome do Kit *').fill('E2E Kit Editado');
    await page.getByRole('button', { name: 'Salvar' }).click();

    await expect(page).toHaveURL('/kits');
    await expect(page.getByText('E2E Kit Editado')).toBeVisible();
  });
});
