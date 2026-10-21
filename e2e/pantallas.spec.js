/* Cada sección se abre (con el dial), cabe en el móvil y Ajustes enseña la versión. */

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

/* El mini-dial de abajo: escondido mientras el dial grande está a la vista,
   y dentro de una sección lleva a cualquier otra, también a las lejanas. */
test('el mini-dial de abajo lleva de una sección a otra', async ({ page }) => {
  await appLista(page);
  const mini = page.locator('#mini-dial');
  await expect(mini).toHaveClass(/oculto/);

  await irA(page, 'Entrenar');
  await expect(mini).not.toHaveClass(/oculto/);
  await expect(page.locator('#tab-log')).toHaveClass(/active/);

  await irA(page, 'Medidas');                       // dos pasos: se toca
  await expect(page.locator('#pane-medidas')).toHaveClass(/active/);
  await irA(page, 'Inicio');                        // tres pasos: se arrastra
  await expect(page.locator('#pane-inicio')).toHaveClass(/active/);
  await expect(mini).toHaveClass(/oculto/);

  // En Inicio, al bajar, asoma para no quedarse sin navegación. En un móvil
  // bajo, que en uno alto Inicio casi cabe entero y el dial no llega a irse.
  await page.setViewportSize({ width: 390, height: 600 });
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await expect(mini).not.toHaveClass(/oculto/);
});

test('arrastrar el mini-dial hasta Ajustes abre Ajustes y no cambia de sección', async ({ page }) => {
  await appLista(page);
  await irA(page, 'Resumen');
  await irA(page, 'Ajustes');
  await expect(page.locator('#config-panel')).not.toHaveClass(/hidden/);
  await expect(page.locator('#pane-resumen')).toHaveClass(/active/);
});
