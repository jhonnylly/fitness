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

/* El botón amarillo de abajo (25/10/2026, sustituye al mini-dial): escondido
   mientras el dial grande está a la vista, y dentro de una sección lleva a
   cualquier otra deslizándolo, también a las lejanas. */
test('el botón de abajo lleva de una sección a otra', async ({ page }) => {
  await appLista(page);
  const fab = page.locator('#dial-fab');
  await expect(fab).toHaveClass(/oculto/);

  await irA(page, 'Entrenar');
  await expect(fab).not.toHaveClass(/oculto/);
  await expect(page.locator('#tab-log')).toHaveClass(/active/);

  await irA(page, 'Medidas');                       // dos pasos
  await expect(page.locator('#pane-medidas')).toHaveClass(/active/);
  await irA(page, 'Inicio');                        // por el camino corto, dando la vuelta
  await expect(page.locator('#pane-inicio')).toHaveClass(/active/);
  await expect(fab).toHaveClass(/oculto/);

  // En Inicio, al bajar, asoma para no quedarse sin navegación. En un móvil
  // bajo, que en uno alto Inicio casi cabe entero y el dial no llega a irse.
  await page.setViewportSize({ width: 390, height: 600 });
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await expect(fab).not.toHaveClass(/oculto/);
});

test('un toque en el botón abre el aro con tu sección marcada, y «Cerrar» lo devuelve a Inicio', async ({ page }) => {
  await appLista(page);
  await irA(page, 'Resumen');
  await page.locator('#dial-fab').click();
  await expect(page.locator('#dial-velo')).toHaveClass(/ver/);
  await expect(page.locator('#dial')).toHaveClass(/flotante/);
  await expect.poll(() => page.locator('#dial-aro').getAttribute('aria-valuetext')).toBe('Resumen');
  await expect(page.locator('#dial-etiquetas g[aria-label="Resumen"]')).toHaveClass(/aqui/);
  await expect(page.locator('#dial-ayuda')).toHaveText(/Ya estás aquí/);
  await expect(page.locator('#dial-centro')).toHaveText(/Cerrar/);
  await page.locator('#dial-centro').click();
  await expect(page.locator('#dial-velo')).not.toHaveClass(/ver/);
  await expect(page.locator('#pane-resumen')).toHaveClass(/active/);
  // El aro vuelve a su sitio en Inicio.
  expect(await page.evaluate(() => document.getElementById('dial-zona').contains(document.getElementById('dial')))).toBe(true);
});

test('desde el botón, una opción del aro lleva a su apartado', async ({ page }) => {
  await appLista(page);
  await irA(page, 'Entrenar');
  await page.locator('#dial-fab').click();
  await expect(page.locator('#dial-velo')).toHaveClass(/ver/);
  await page.locator('#dial-etiquetas g[aria-label="Medidas"]').click();
  await expect(page.locator('#dial')).toHaveClass(/sub/);
  const c = await page.locator('#dial-sub g[aria-label="Historial"] .dial-ico').boundingBox();
  await page.mouse.click(c.x + c.width / 2, c.y + c.height / 2);
  await expect(page.locator('#pane-medidas')).toHaveClass(/active/);
  await expect(page.locator('#dial-velo')).not.toHaveClass(/ver/);
});

test('desde el botón, Inicio ofrece volver a su pantalla', async ({ page }) => {
  await appLista(page);
  await irA(page, 'Resumen');
  await page.locator('#dial-fab').click();
  await expect(page.locator('#dial-velo')).toHaveClass(/ver/);
  await page.locator('#dial-etiquetas g[aria-label="Inicio"]').click();
  await expect(page.locator('#dial')).toHaveClass(/sub/);
  await expect(page.locator('#dial-sub .dial-seg')).toHaveCount(4);
  // La primera, ya en cian: un toque y estás en Inicio.
  await expect(page.locator('#dial-nombre')).toHaveText('Pantalla de Inicio');
  const c = await page.locator('#dial-sub g[aria-label="Pantalla de Inicio"] .dial-ico').boundingBox();
  await page.mouse.click(c.x + c.width / 2, c.y + c.height / 2);
  await expect(page.locator('#pane-inicio')).toHaveClass(/active/);
  await expect(page.locator('#dial-velo')).not.toHaveClass(/ver/);
});

test('el botón se aparta al bajar y al escribir, y vuelve al subir', async ({ page }) => {
  await appLista(page);
  await page.setViewportSize({ width: 390, height: 600 });
  await irA(page, 'Medidas');
  const fab = page.locator('#dial-fab');
  await expect(fab).not.toHaveClass(/apartado/);
  await page.evaluate(() => scrollBy(0, 400));
  await expect(fab).toHaveClass(/apartado/);
  await page.evaluate(() => scrollBy(0, -120));
  await expect(fab).not.toHaveClass(/apartado/);
  // Mientras escribes el peso, también se aparta; al salir del campo, vuelve.
  await page.evaluate(() => scrollTo(0, 0));
  await page.locator('#med-peso').focus();
  await expect(fab).toHaveClass(/apartado/);
  await page.locator('#med-peso').blur();
  await expect(fab).not.toHaveClass(/apartado/);
});

test('desde un ejercicio, Inicio dos veces en el aro lleva a la pantalla de Inicio', async ({ page }) => {
  await appLista(page);
  await page.evaluate(() => { goTo('log'); openWeekDetail(1); });
  await page.evaluate(() => { const b = document.querySelector('#session-list [onclick]'); b && b.click(); });
  await page.evaluate(() => { const b = document.querySelector('#ex-buttons-container [onclick]'); b && b.click(); });
  await page.evaluate(() => scrollTo(0, 0));
  await page.locator('#dial-fab').click();
  await page.locator('#dial-etiquetas g[aria-label="Inicio"]').click();
  await expect(page.locator('#dial')).toHaveClass(/sub/);      // primer toque: sus opciones
  const c = await page.locator('#dial-etiquetas g[aria-label="Inicio"] .dial-ico').boundingBox();
  await page.mouse.click(c.x + c.width / 2, c.y + c.height / 2);   // segundo toque: a Inicio
  await expect(page.locator('#pane-inicio')).toHaveClass(/active/);
  await expect(page.locator('#dial-velo')).not.toHaveClass(/ver/);
});

test('tocar fuera del aro lo cierra sin cambiar de sección', async ({ page }) => {
  await appLista(page);
  await irA(page, 'Medidas');
  await page.locator('#dial-fab').click();
  await expect(page.locator('#dial-velo')).toHaveClass(/ver/);
  await page.mouse.click(20, 20);
  await expect(page.locator('#dial-velo')).not.toHaveClass(/ver/);
  await expect(page.locator('#pane-medidas')).toHaveClass(/active/);
});

test('deslizar el botón hasta Ajustes abre Ajustes y no cambia de sección', async ({ page }) => {
  await appLista(page);
  await irA(page, 'Resumen');
  await irA(page, 'Ajustes');
  await expect(page.locator('#config-panel')).not.toHaveClass(/hidden/);
  await expect(page.locator('#pane-resumen')).toHaveClass(/active/);
});
