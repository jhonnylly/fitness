/* Cada pestaña se abre, cabe en el móvil y Ajustes enseña la versión. */

const { test, expect, appLista } = require('./base');

const PESTANAS = [
  ['ENTRENAR', '#tab-log'],
  ['RESUMEN',  '#tab-resumen'],
  ['INICIO',   '#tab-inicio'],
  ['MEDIDAS',  '#tab-medidas'],
];

for(const [nombre, id] of PESTANAS){
  test(`la pestaña ${nombre} se abre y no se sale de la pantalla`, async ({ page }) => {
    await appLista(page);
    await page.locator(id).click();

    await expect(page.locator(id)).toHaveClass(/active/);
    const desborde = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(desborde, 'scroll horizontal en px').toBeLessThanOrEqual(0);
  });
}

test('Ajustes enseña la versión que lleva el código', async ({ page }) => {
  await appLista(page);
  await page.locator('#config-btn').click();

  const version = await page.evaluate(() => APP_VERSION);
  await expect(page.locator('#version-txt')).toHaveText(version);
});
