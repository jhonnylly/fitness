/* Cada sección se abre (con el dial), cabe en el móvil y Ajustes enseña la versión. */

const { test, expect, appLista, irA, cajaQuieta } = require('./base');

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

/* Navegación dentro de las secciones (20/11/2026, crítica Impeccable,
   aprobado por Jhon): solo la tira de la cabecera, con el nombre en sus cinco
   botones. El botón amarillo ya no sale dentro de las secciones (era la
   tercera forma de navegar y tapaba contenido); solo asoma en Inicio al bajar,
   cuando el dial grande se ha ido de la pantalla. */
test('la tira lleva de una sección a otra y el botón amarillo no sale dentro', async ({ page }) => {
  await appLista(page);
  const fab = page.locator('#dial-fab');
  await expect(fab).toHaveClass(/oculto/);

  await irA(page, 'Entrenar');
  await expect(fab).toHaveClass(/oculto/);
  const botones = page.locator('#cab-tira button');
  await expect(botones).toHaveCount(5);
  for(const n of ['Inicio', 'Entrenar', 'Resumen', 'Medidas', 'Ajustes'])
    await expect(page.locator('#cab-tira').getByText(n, { exact: true })).toBeVisible();

  await irA(page, 'Medidas');
  await expect(fab).toHaveClass(/oculto/);
  await irA(page, 'Inicio');
  await expect(fab).toHaveClass(/oculto/);

  // En Inicio, al bajar, asoma para no quedarse sin navegación.
  await page.setViewportSize({ width: 390, height: 600 });
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await expect(fab).not.toHaveClass(/oculto/);
});

async function abrirDesdeInicioAbajo(page){
  await page.setViewportSize({ width: 390, height: 600 });
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(400);
  /* Al bajar se aparta; como una persona, se sube un poco y vuelve (el dial
     sigue fuera). Con la máquina cargada el navegador puede juntar los dos
     desplazamientos en un fotograma: se reintenta, como haría el dedo. */
  const fab = page.locator('#dial-fab');
  for(let i = 0; i < 5; i++){
    await page.evaluate(() => scrollBy(0, -50));
    await page.waitForTimeout(250);
    if(!/oculto|apartado/.test(await fab.getAttribute('class'))) break;
  }
  await expect(fab).not.toHaveClass(/oculto|apartado/);
  await page.waitForTimeout(400);                    // que acabe de asomar
  await tocar(page, fab);
  await expect(page.locator('#dial-velo')).toHaveClass(/ver/);
}

/* Con TOQUES de verdad (touchscreen.tap), no clics de ratón: en el iPhone, tras
   un toque Safari dispara un click en el mismo punto, y si el aro ya se había
   cerrado caía en lo de debajo y llevaba a la sesión (Jhon, 25/10/2026). Con
   clics de ratón esta prueba pasaba con el fallo dentro. */
async function tocar(page, locator){
  const c = await cajaQuieta(locator);
  await page.touchscreen.tap(c.x + c.width / 2, c.y + c.height / 2);
}
test('en Inicio, abajo, el botón abre el aro con Inicio marcado y «Cerrar» lo devuelve', async ({ page }) => {
  await appLista(page);
  await abrirDesdeInicioAbajo(page);
  await expect(page.locator('#dial')).toHaveClass(/flotante/);
  await expect(page.locator('#dial-etiquetas g[aria-label="Inicio"]')).toHaveClass(/aqui/);
  await expect(page.locator('#dial-centro')).toHaveText(/Cerrar/);
  await page.locator('#dial-centro').click();
  await expect(page.locator('#dial-velo')).not.toHaveClass(/ver/);
  await expect(page.locator('#pane-inicio')).toHaveClass(/active/);
  expect(await page.evaluate(() => document.getElementById('dial-zona').contains(document.getElementById('dial')))).toBe(true);
});

test('desde el botón, una opción del aro lleva a su apartado', async ({ page }) => {
  await appLista(page);
  await abrirDesdeInicioAbajo(page);
  await page.locator('#dial-etiquetas g[aria-label="Medidas"]').click();
  await expect(page.locator('#dial')).toHaveClass(/sub/);
  const c = await cajaQuieta(page.locator('#dial-sub g[aria-label="Historial"] .dial-ico'));
  await page.mouse.click(c.x + c.width / 2, c.y + c.height / 2);
  await expect(page.locator('#pane-medidas')).toHaveClass(/active/);
  await expect(page.locator('#dial-velo')).not.toHaveClass(/ver/);
});

test('tocar fuera del aro lo cierra sin pulsar lo que hay debajo', async ({ page }) => {
  await appLista(page);
  await abrirDesdeInicioAbajo(page);
  await page.touchscreen.tap(20, 20);
  await page.waitForTimeout(800);                    // y el click fantasma, si lo hubiera
  await expect(page.locator('#dial-velo')).not.toHaveClass(/ver/);
  await expect(page.locator('#pane-inicio')).toHaveClass(/active/);
  await expect(page.locator('#auth-panel')).toHaveClass(/hidden/);
  await expect(page.locator('#session-form')).toBeHidden();
});

test('deslizar el botón hasta Ajustes abre Ajustes y no cambia de sección', async ({ page }) => {
  await appLista(page);
  await irA(page, 'Resumen');
  await irA(page, 'Ajustes');
  await expect(page.locator('#config-panel')).not.toHaveClass(/hidden/);
  await expect(page.locator('#pane-resumen')).toHaveClass(/active/);
});
