import { test as base, expect, type Page } from '@playwright/test';
import path from 'path';

const SERVER_URL = 'http://localhost:3001';
const authDir = path.join(__dirname, '..', '.auth');

// ─── API helper ──────────────────────────────────────────────────────────────

let _adminToken: string | null = null;

async function getAdminToken(): Promise<string> {
  if (_adminToken) return _adminToken;
  const res = await fetch(`${SERVER_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@constru.dev', password: 'admin123' }),
  });
  const data = (await res.json()) as { accessToken: string };
  _adminToken = data.accessToken;
  return _adminToken;
}

async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAdminToken();
  return fetch(`${SERVER_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
}

// ─── Fixture types ───────────────────────────────────────────────────────────

type Fixtures = {
  adminPage: Page;
  salesPage: Page;
  financePage: Page;
  createdClient: { id: string; name: string };
  createdProduct: { id: string; name: string; finalPrice: number };
  createdKit: { id: string; name: string };
  acceptedQuote: { quoteId: string; installmentId: string; clientName: string };
  createdExpense: { id: string; name: string };
};

// ─── Fixtures ────────────────────────────────────────────────────────────────

export const test = base.extend<Fixtures>({
  adminPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: path.join(authDir, 'admin.json'),
    });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  salesPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: path.join(authDir, 'sales.json'),
    });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  financePage: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: path.join(authDir, 'finance.json'),
    });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  createdClient: async ({}, use) => {
    const res = await apiFetch('/clients', {
      method: 'POST',
      body: JSON.stringify({ name: 'E2E Cliente Fixture', taxId: `E2E${Date.now()}` }),
    });
    const data = (await res.json()) as { id: string; name: string };
    await use({ id: data.id, name: data.name });
  },

  createdProduct: async ({}, use) => {
    const res = await apiFetch('/products', {
      method: 'POST',
      body: JSON.stringify({
        name: 'E2E Produto Fixture',
        basePrice: 10000,
        markupPercent: 20,
      }),
    });
    const data = (await res.json()) as { id: string; name: string; finalPrice: number };
    await use({ id: data.id, name: data.name, finalPrice: data.finalPrice });
  },

  createdKit: async ({}, use) => {
    // Creates its own product internally so it doesn't depend on createdProduct
    const prodRes = await apiFetch('/products', {
      method: 'POST',
      body: JSON.stringify({ name: 'E2E KitProd Fixture', basePrice: 5000, markupPercent: 10 }),
    });
    const prod = (await prodRes.json()) as { id: string };

    const kitRes = await apiFetch('/kits', {
      method: 'POST',
      body: JSON.stringify({
        name: 'E2E Kit Fixture',
        items: [{ productId: prod.id, quantity: 2 }],
      }),
    });
    const data = (await kitRes.json()) as { id: string; name: string };
    await use({ id: data.id, name: data.name });
  },

  acceptedQuote: async ({}, use) => {
    // Create client
    const suffix = Date.now();
    const clientRes = await apiFetch('/clients', {
      method: 'POST',
      body: JSON.stringify({ name: `E2E Quote Client ${suffix}`, taxId: `QC${suffix}` }),
    });
    const client = (await clientRes.json()) as { id: string };

    // Create product
    const prodRes = await apiFetch('/products', {
      method: 'POST',
      body: JSON.stringify({ name: 'E2E Quote Prod', basePrice: 10000, markupPercent: 20 }),
    });
    const product = (await prodRes.json()) as { id: string; finalPrice: number };

    // Create quote (creates quote + first version)
    const quoteRes = await apiFetch('/quotes', {
      method: 'POST',
      body: JSON.stringify({
        clientId: client.id,
        items: [{ productId: product.id, quantity: 1 }],
        laborCost: 0,
        discount: 0,
      }),
    });
    const quote = (await quoteRes.json()) as { id: string };

    // Accept quote with 1 installment due today
    const today = new Date().toISOString().split('T')[0];
    await apiFetch(`/quotes/${quote.id}/accept`, {
      method: 'POST',
      body: JSON.stringify({
        paymentType: 'INSTALLMENTS',
        downPayment: 0,
        installments: [
          { dueDate: `${today}T00:00:00.000Z`, amount: product.finalPrice },
        ],
      }),
    });

    // Fetch accepted quote to get installmentId
    const detailRes = await apiFetch(`/quotes/${quote.id}`);
    const detail = (await detailRes.json()) as {
      sale: { installments: Array<{ id: string }> };
    };
    const installmentId = detail.sale.installments[0].id;

    await use({ quoteId: quote.id, installmentId, clientName: `E2E Quote Client ${suffix}` });
  },

  createdExpense: async ({}, use) => {
    const res = await apiFetch('/fixed-expenses', {
      method: 'POST',
      body: JSON.stringify({ name: `E2E Conta Luz ${Date.now()}`, amount: 15000, dueDay: 10 }),
    });
    const data = (await res.json()) as { id: string; name: string };
    await use({ id: data.id, name: data.name });
  },
});

export { expect };
