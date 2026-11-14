/* Cada sección se abre (con la barra de abajo), cabe en el móvil y Ajustes enseña la versión. */

const { test, expect, appLista, irA } = require('./base');

const PESTANAS = [
  ['Entrenar', '#tab-log'],
  ['Resumen',  '#tab-resumen'],
  ['Medidas',  '#tab-medidas'],
];

for(const [nombre, id] of PESTANAS){
  test(`la pestaña ${nombre} se abre y no se sale de la pantalla`, async ({ page }) => {
    await appLista(page);
    await irA(page, nombre);

    await expect(page.locator(id)).toHaveClass(/active/);
    const desborde = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(desborde, 'scroll horizontal en px').toBeLessThanOrEqual(0);
  });
}

test('Ajustes enseña la versión que lleva el código', async ({ page }) => {
  await appLista(page);
  await irA(page, 'Ajustes');

  const version = await page.evaluate(() => APP_VERSION);
  await expect(page.locator('#version-txt')).toHaveText(version);
});

/* La barra de abajo (14/11/2026): siempre a la vista, también al bajar y en
   un móvil bajo, y desde dentro de un ejercicio lleva de vuelta a Inicio. */
test('la barra de abajo lleva de una sección a otra y no se esconde', async ({ page }) => {
  await appLista(page);
  for(const nombre of ['Entrenar', 'Medidas', 'Resumen', 'Inicio']) await irA(page, nombre);
  await expect(page.locator('#pane-inicio')).toHaveClass(/active/);
  await page.setViewportSize({ width: 375, height: 600 });
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await expect(page.locator('#mini-dial')).toBeInViewport();
});

test('desde un ejercicio, la pestaña Inicio lleva a la pantalla de Inicio', async ({ page }) => {
  await appLista(page);
  await page.evaluate(() => { goTo('log'); openWeekDetail(1); });
  await page.evaluate(() => { const b = document.querySelector('#session-list [onclick]'); b && b.click(); });
  await page.evaluate(() => { const b = document.querySelector('#ex-buttons-container [onclick]'); b && b.click(); });
  const c = await page.locator('#tab-inicio').boundingBox();
  await page.touchscreen.tap(c.x + c.width / 2, c.y + c.height / 2);
  await page.waitForTimeout(800);                              // y el click fantasma, si lo hubiera
  await expect(page.locator('#pane-inicio')).toHaveClass(/active/);
});

test('en Inicio, EMPEZAR abre la sesión que toca', async ({ page }) => {
  await appLista(page);
  await expect(page.locator('#esf-dia')).not.toBeEmpty();
  await expect(page.locator('#esf-empezar')).toHaveText(/Empezar/);
  await expect(page.locator('#esf-hoy')).toContainText(/Sesión 1/);
  await expect(page.locator('#esf-dias li')).toHaveCount(7);
  await page.locator('#esf-empezar').click();
  await expect(page.locator('#pane-log')).toHaveClass(/active/);
});

test('tocar Ajustes en la barra abre Ajustes y no cambia de sección', async ({ page }) => {
  await appLista(page);
  await irA(page, 'Resumen');
  await irA(page, 'Ajustes');
  await expect(page.locator('#config-panel')).not.toHaveClass(/hidden/);
  await expect(page.locator('#pane-resumen')).toHaveClass(/active/);
});
