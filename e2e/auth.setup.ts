import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authDir = path.join(__dirname, '.auth');

const USERS = [
  {
    email: 'admin@constru.dev',
    password: 'admin123',
    file: path.join(authDir, 'admin.json'),
  },
  {
    email: 'vendas@constru.dev',
    password: 'sales123',
    file: path.join(authDir, 'sales.json'),
  },
  {
    email: 'financeiro@constru.dev',
    password: 'finance123',
    file: path.join(authDir, 'finance.json'),
  },
];

for (const user of USERS) {
  setup(`authenticate as ${user.email}`, async ({ page }) => {
    await page.goto('/login');

    // LoginPage uses <label><span>Email</span><input /></label>
    // getByLabel matches the label's text content (including nested spans)
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Senha').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();

    // After login, router redirects to '/'
    await expect(page).toHaveURL('/');

    await page.context().storageState({ path: user.file });
  });
}
