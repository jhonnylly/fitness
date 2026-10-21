/* El dial de Inicio (21/10/2026): girarlo con el dedo, tocar una etiqueta y
   tocar el centro. Es la puerta de entrada a todo, así que va con el dedo de
   verdad: arrastres y toques, no llamadas a funciones. */

const { test, expect, appLista, irA } = require('./base');

const etiqueta = (page, nombre) => page.locator('#dial-etiquetas g').filter({ hasText: nombre });
const seleccionada = page => page.locator('#dial-aro').getAttribute('aria-valuetext');

test('arranca en Inicio, con la fecha y lo que toca hoy', async ({ page }) => {
  await appLista(page);
  await expect(page.locator('#dial')).toBeVisible();
  expect(await seleccionada(page)).toBe('Inicio');
  await expect(page.locator('#dial-num')).toHaveText(String(new Date().getDate()));
  await expect(page.locator('#dial-destino')).toContainText(/Hoy: S1/);
  // Primer Mes son 4 semanas; la primera es la de ahora.
  await expect(page.locator('#dial-tira .dial-sem')).toHaveCount(4);
  await expect(page.locator('#dial-tira .dial-sem.actual')).toHaveText(/S1/);
});

test('el centro, en Inicio, abre el entrenamiento de hoy', async ({ page }) => {
  await appLista(page);
  await page.locator('#dial-centro').click();
  await expect(page.locator('#pane-log')).toHaveClass(/active/);
  await expect(page.locator('#session-form')).toBeVisible();
});

test('tocar una etiqueta gira hasta ella; tocarla otra vez entra', async ({ page }) => {
  await appLista(page);
  await etiqueta(page, 'Resumen').click();
  await expect.poll(() => seleccionada(page)).toBe('Resumen');
  await expect(page.locator('#dial-destino')).toContainText(/0 de 12 sesiones/);
  await expect(page.locator('#pane-inicio')).toHaveClass(/active/);   // aún no ha entrado
  await etiqueta(page, 'Resumen').click();
  await expect(page.locator('#pane-resumen')).toHaveClass(/active/);

  // Al volver a Inicio el dial vuelve a apuntar a Inicio.
  await irA(page, 'Inicio');
  expect(await seleccionada(page)).toBe('Inicio');
});

test('arrastrar el bisel lo gira y se queda en una sección', async ({ page }) => {
  await appLista(page);
  const caja = await page.locator('#dial').boundingBox();
  const cx = caja.x + caja.width / 2, cy = caja.y + caja.height / 2, r = caja.width * 0.44;
  // Un cuarto de vuelta en sentido contrario a las agujas, por el anillo:
  // las etiquetas suben por la izquierda y la de la derecha (Entrenar) llega arriba.
  await page.mouse.move(cx + r, cy);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    const a = -i / 12 * Math.PI / 2 * 0.8;       // 72°, un paso del dial
    await page.mouse.move(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  await page.mouse.up();
  await expect.poll(() => seleccionada(page)).toBe('Entrenar');
  await page.locator('#dial-centro').click();
  await expect(page.locator('#pane-log')).toHaveClass(/active/);
});

test('el teclado también lo mueve', async ({ page }) => {
  await appLista(page);
  await page.locator('#dial-aro').focus();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => seleccionada(page)).toBe('Ajustes');
  await page.keyboard.press('Enter');
  await expect(page.locator('#config-panel')).not.toHaveClass(/hidden/);
});

test('tocar una semana abre sus sesiones', async ({ page }) => {
  await appLista(page);
  await page.locator('#dial-tira .dial-sem').nth(1).click();
  await expect(page.locator('#pane-log')).toHaveClass(/active/);
  await expect(page.locator('#week-detail-title')).toHaveText(/Semana 2/);
});

test('capturas para mirarlo', async ({ page }, info) => {
  test.skip(!process.env.CAPTURAS, 'solo con CAPTURAS=carpeta');
  await appLista(page);
  for (const tema of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: tema });
    await page.screenshot({ path: `${process.env.CAPTURAS}/${info.project.name}_${tema}.png`, fullPage: false });
    await page.screenshot({ path: `${process.env.CAPTURAS}/${info.project.name}_${tema}_todo.png`, fullPage: true });
  }
});
