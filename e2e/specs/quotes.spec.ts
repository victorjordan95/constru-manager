import { test, expect } from '../fixtures/index';

// Today's date in YYYY-MM-DD for the installment date input
function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

test.describe('Orçamentos', () => {
  test('cria orçamento, adiciona revisão e aceita com parcelas', async ({
    adminPage: page,
    createdClient,
    createdProduct,
  }) => {
    // ── CREATE QUOTE ─────────────────────────────────────────────────────────
    await page.goto('/quotes/new');

    // Select client — the <select> is inside <label><span>Cliente *</span><select /></label>
    // Wait for clients to load first
    await expect(
      page.getByLabel('Cliente *').locator(`option[value="${createdClient.id}"]`),
    ).toHaveCount(1);
    await page.getByLabel('Cliente *').selectOption(createdClient.id);

    // First item row has: [type select][product select][quantity input]
    // page.locator('select') at indices: 0=Cliente, 1=type (Produto/Kit), 2=product
    const itemTypeSelect = page.locator('select').nth(1);
    await itemTypeSelect.selectOption('product');

    const itemProductSelect = page.locator('select').nth(2);
    // Wait for products to load
    await expect(
      itemProductSelect.locator(`option[value="${createdProduct.id}"]`),
    ).toHaveCount(1);
    await itemProductSelect.selectOption(createdProduct.id);

    // Verify total preview updates
    await expect(page.getByText(/Total:/)).toBeVisible();

    await page.getByRole('button', { name: 'Criar Orçamento' }).click();

    // Should redirect to quote detail page /quotes/<id>
    await expect(page).toHaveURL(/\/quotes\/[^/]+$/);
    // Verify client name appears in page heading
    await expect(page.getByRole('heading', { level: 1 })).toContainText(createdClient.name);

    // ── ADD VERSION ──────────────────────────────────────────────────────────
    await page.getByRole('link', { name: '+ Nova Versão' }).click();
    await expect(page).toHaveURL(/\/quotes\/.+\/versions\/new/);

    // Version form is prefilled with active version items
    // Add a labor cost to differentiate this version
    await page.getByLabel('Mão de obra (R$)').clear();
    await page.getByLabel('Mão de obra (R$)').fill('50');

    await page.getByRole('button', { name: 'Salvar Versão' }).click();

    // Back on detail page — "Versão 2" should be visible
    await expect(page).toHaveURL(/\/quotes\/[^/]+$/);
    await expect(page.getByText('Versão 2')).toBeVisible();

    // ── ACCEPT QUOTE ─────────────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Aceitar' }).click();

    // AcceptQuoteModal appears
    await expect(page.getByRole('heading', { name: 'Aceitar Orçamento' })).toBeVisible();

    // Choose INSTALLMENTS
    await page.getByLabel('Forma de pagamento').selectOption('INSTALLMENTS');

    // Set 1 installment, date = today
    await page.getByLabel('Nº de parcelas').selectOption('1');
    await page.getByLabel('Data da 1ª parcela').fill(todayISO());

    // Preview table should appear
    await expect(page.getByText('Previsão de parcelas')).toBeVisible();

    await page.getByRole('button', { name: 'Confirmar Aceitação' }).click();

    // Modal closes, detail page shows sale info
    await expect(page.getByText('Venda Registrada')).toBeVisible();
    await expect(page.getByText('Parcelado')).toBeVisible();
  });
});
