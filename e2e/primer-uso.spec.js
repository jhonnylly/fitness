/* Lo primero que ve alguien que abre la app por primera vez. */

const { test, expect, appLista } = require('./base');

test('el onboarding deja la rutina elegida lista para entrenar', async ({ page }) => {
  await appLista(page);
  await page.locator('#tab-log').click();

  await expect(page.getByText('Semana 1 — Adaptación')).toBeVisible();
  await expect(page.getByText(/0 de 3 sesiones/)).toBeVisible();
  expect(await page.evaluate(() => getActive().name)).toBe('Primer Mes');
});

test('sin nombre no deja pasar del primer paso', async ({ page }) => {
  await page.goto('/');
  await page.locator('#ob-step-0').getByRole('button', { name: 'Continuar →' }).click();

  await expect(page.locator('#ob-step-0')).toBeVisible();
  await expect(page.locator('#ob-step-perfil')).toBeHidden();
});

test('lo hecho en el onboarding sigue ahí al recargar', async ({ page }) => {
  await appLista(page, { nombre: 'Lucía' });
  await page.reload();

  await expect(page.locator('#onboarding')).toBeHidden();
  expect(await page.evaluate(() => getActive().name)).toBe('Primer Mes');
});
