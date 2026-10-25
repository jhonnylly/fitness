/* El dial de Inicio (21/10/2026): girarlo con el dedo (al soltarlo entra,
   desde el 22/10), tocar una etiqueta y tocar el centro. Es la puerta de
   entrada a todo, así que va con el dedo de verdad: arrastres y toques, no
   llamadas a funciones. */

const { test, expect, appLista, irA } = require('./base');

const etiqueta = (page, nombre) => page.locator(`#dial-etiquetas g[aria-label="${nombre}"]`);
const seleccionada = page => page.locator('#dial-aro').getAttribute('aria-valuetext');
// Los del aro de dentro no reciben el dedo (lo coge el de fuera y decide por la
// distancia al centro), así que se tocan en su sitio, como un dedo.
async function tocarSub(page, nombre){
  // En el icono: con dos opciones cada una es medio aro y el centro de su caja cae en el hueco.
  const c = await page.locator(`#dial-sub g[aria-label="${nombre}"] .dial-ico`).boundingBox();
  await page.mouse.click(c.x + c.width / 2, c.y + c.height / 2);
}
const abierto = page => page.locator('#dial').evaluate(d => d.classList.contains('sub'));

test('arranca en Inicio, con la fecha y lo que toca hoy', async ({ page }) => {
  await appLista(page);
  await expect(page.locator('#dial')).toBeVisible();
  expect(await seleccionada(page)).toBe('Inicio');
  await expect(page.locator('#dial-num')).toHaveText(String(new Date().getDate()));
  // En Inicio el centro es el botón de empezar, con la sesión que toca (25/10/2026).
  await expect(page.locator('#dial')).toHaveClass(/empezar/);
  await expect(page.locator('#dial-empezar')).toHaveText(/Empezar/);
  await expect(page.locator('#dial-destino')).toContainText(/S1/);
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

test('girar hasta una sección muestra lo que hay en ella', async ({ page }) => {
  await appLista(page);
  await page.locator('#dial-aro').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => seleccionada(page)).toBe('Resumen');
  await expect(page.locator('#dial-destino')).toContainText(/0 de 12 sesiones/);
  await expect(page.locator('#pane-inicio')).toHaveClass(/active/);   // con el teclado no entra solo
});

test('tocar una sección gira hasta ella y, al segundo, abre sus opciones', async ({ page }) => {
  await appLista(page);
  await etiqueta(page, 'Resumen').click();
  await expect.poll(() => abierto(page)).toBe(true);
  await expect(page.locator('#dial-nombre')).toHaveText('Racha y progreso');
  // Sin fotos no se ofrece comparar.
  await expect(page.locator('#dial-sub .dial-seg')).toHaveCount(2);
  await expect(page.locator('#pane-inicio')).toHaveClass(/active/);

  // Tocar otra opción gira hasta ella y, al segundo, entra.
  await tocarSub(page, 'Tus fotos');
  await expect(page.locator('#pane-resumen')).toHaveClass(/active/);

  // Al volver a Inicio el dial vuelve a apuntar a Inicio.
  await irA(page, 'Inicio');
  expect(await seleccionada(page)).toBe('Inicio');
});

test('arrastrar el aro y soltarlo en una sección abre sus opciones', async ({ page }) => {
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
  await expect.poll(() => abierto(page)).toBe(true);
  await expect(page.locator('#dial-nombre')).toHaveText('Semana en curso');
  // Tocar la opción cian entra ya: la semana en la que vas.
  await tocarSub(page, 'Semana en curso');
  await expect(page.locator('#pane-log')).toHaveClass(/active/);
  await expect(page.locator('#week-detail-title')).toHaveText(/Semana 1/);
});

test('con las opciones abiertas, el centro vuelve y el aro de fuera cambia de sección', async ({ page }) => {
  await appLista(page);
  await etiqueta(page, 'Ajustes').click();
  await expect.poll(() => abierto(page)).toBe(true);
  await expect(page.locator('#dial-sub .dial-seg')).toHaveCount(5);
  await expect(page.locator('#dial-centro')).toHaveText(/Volver/);
  await page.locator('#dial-centro').click();
  expect(await abierto(page)).toBe(false);
  await expect(page.locator('#dial-num')).toBeVisible();

  // Abiertas las de Ajustes, tocar Medidas por fuera abre las de Medidas.
  await etiqueta(page, 'Ajustes').click();
  await expect.poll(() => abierto(page)).toBe(true);
  await etiqueta(page, 'Medidas').click({ force: true });
  await expect(page.locator('#dial-nombre')).toHaveText('Añadir medición');
  await expect.poll(() => seleccionada(page)).toBe('Añadir medición');
});

test('una opción de Ajustes abre Ajustes en ese apartado', async ({ page }) => {
  await appLista(page);
  await page.locator('#dial-aro').focus();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => seleccionada(page)).toBe('Ajustes');
  await page.keyboard.press('Enter');
  await expect.poll(() => seleccionada(page)).toBe('Tus datos');
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => seleccionada(page)).toBe('Días de entrenamiento');
  await page.keyboard.press('Enter');
  await expect(page.locator('#config-panel')).not.toHaveClass(/hidden/);
  await expect(page.locator('#cfg-dias')).toBeInViewport();
});

test('tocar fuera del dial cierra las opciones', async ({ page }) => {
  await appLista(page);
  await etiqueta(page, 'Medidas').click();
  await expect.poll(() => abierto(page)).toBe(true);
  await page.locator('#dial-nombre').click();
  expect(await abierto(page)).toBe(false);
});

test('soltarlo de vuelta en Inicio no hace nada', async ({ page }) => {
  await appLista(page);
  const caja = await page.locator('#dial').boundingBox();
  const cx = caja.x + caja.width / 2, cy = caja.y + caja.height / 2, r = caja.width * 0.44;
  // Un poco de giro (17°, menos de medio paso) y despacio, sin impulso:
  // vuelve a Inicio y se queda ahí.
  await page.mouse.move(cx + r, cy);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(cx + r * Math.cos(-i / 6 * 0.3), cy + r * Math.sin(-i / 6 * 0.3));
    await page.waitForTimeout(80);
  }
  await page.mouse.up();
  await page.waitForFunction(() => dialEstado.v === 0 && dialEstado.x === 0);
  await expect(page.locator('#pane-inicio')).toHaveClass(/active/);
  await expect(page.locator('#config-panel')).toHaveClass(/hidden/);
});

test('el teclado también lo mueve', async ({ page }) => {
  await appLista(page);
  await page.locator('#dial-aro').focus();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => seleccionada(page)).toBe('Ajustes');
  await page.keyboard.press('Enter');
  await expect.poll(() => seleccionada(page)).toBe('Tus datos');
  await page.keyboard.press('Escape');
  await expect.poll(() => seleccionada(page)).toBe('Ajustes');
});

test('en Inicio, tocar Inicio no abre opciones: dice que ya estás aquí', async ({ page }) => {
  await appLista(page);
  await etiqueta(page, 'Inicio').click();
  await expect(page.locator('#dial-ayuda')).toHaveText('Ya estás en Inicio');
  await page.waitForTimeout(1300);                 // ni barra ni opciones
  expect(await abierto(page)).toBe(false);
  await expect(page.locator('#pane-inicio')).toHaveClass(/active/);
});

test('girado y con las opciones abiertas, la página no se mueve de lado', async ({ page }) => {
  await appLista(page);
  // Los <svg> del aro son cuadrados: girados, sus esquinas sobresalían (24/10/2026).
  await etiqueta(page, 'Ajustes').click();
  await expect.poll(() => abierto(page)).toBe(true);
  const ancho = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  expect(ancho[0]).toBeLessThanOrEqual(ancho[1]);
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
