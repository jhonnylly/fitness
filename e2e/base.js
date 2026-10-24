/* Lo común a todas las pruebas de Playwright:

   - Corta la red: solo deja pasar 127.0.0.1 (la app) y cdnjs (Chart.js, solo
     lectura). Firebase, en gstatic, no carga: la app se queda en modo local y
     ninguna prueba puede tocar datos reales.
   - Recoge los errores de JavaScript de la página y hace fallar la prueba si
     hay alguno, aunque lo que se comprobaba haya salido bien.
   - `appLista`: hace el onboarding tocando los botones, como una persona, y
     comprueba que se guarda en el dispositivo antes de seguir. */

const base = require('@playwright/test');
const { expect } = base;

const PERMITIDOS = new Set(['127.0.0.1', 'cdnjs.cloudflare.com']);

const test = base.test.extend({
  page: async ({ page }, use) => {
    await page.route('**/*', ruta => {
      const host = new URL(ruta.request().url()).hostname;
      return PERMITIDOS.has(host) ? ruta.continue() : ruta.abort();
    });
    const errores = [];
    page.on('pageerror', e => errores.push(e.message));
    await use(page);
    expect(errores, 'errores de JavaScript en la página').toEqual([]);
  },
});

/* Si esto fallara, la prueba se para antes de tocar nada. */
async function comprobarLocal(page){
  expect(await page.evaluate(() => STORAGE.backend.name)).toBe('local');
}

async function appLista(page, { nombre = 'Prueba', rutina = /Primer Mes/ } = {}){
  await page.goto('/');
  await comprobarLocal(page);

  await page.locator('#ob-name').fill(nombre);
  await page.locator('#ob-step-0').getByRole('button', { name: 'Continuar →' }).click();

  const perfil = page.locator('#ob-step-perfil');
  for(const op of ['Hombre', 'Empiezo', '3'])
    await perfil.getByRole('radio', { name: op, exact: true }).click();
  await perfil.getByRole('button', { name: 'Continuar →' }).click();

  const rutinas = page.locator('#ob-step-1');
  await rutinas.getByRole('button', { name: rutina }).click();
  await rutinas.getByRole('button', { name: 'Continuar →' }).click();
  await page.locator('#ob-step-2').getByRole('button', { name: /Empezar ahora/ }).click();

  await expect(page.locator('#onboarding')).toBeHidden();
  await comprobarLocal(page);
}

/* Ir a una sección como lo haría una persona (desde el 21/10/2026 no hay
   barra de pestañas): en Inicio, con el dial grande —tocar el segmento, que
   gira hasta él, y el centro, que entra directo (aro 3D desde el 24/10)—; en las demás, con el botón
   amarillo de abajo: mantenerlo y deslizar de lado hasta la sección. */
const SECCIONES = ['Inicio', 'Entrenar', 'Resumen', 'Medidas', 'Ajustes'];
async function irA(page, nombre){
  if(await page.locator('#pane-inicio').evaluate(e => e.classList.contains('active'))){
    await page.evaluate(() => scrollTo(0, 0));
    if(nombre === 'Inicio'){ await page.locator('#dial-centro').click(); return; }
    // Girar hasta la sección tocándola y entrar directo con el centro (el
    // atajo: sin pasar por sus opciones).
    await page.locator(`#dial-etiquetas g[aria-label="${nombre}"]`).click();
    await expect.poll(() => page.locator('#dial-aro').getAttribute('aria-valuetext')).toBe(nombre);
    await page.locator('#dial-centro').click();
    if(nombre === 'Ajustes') await expect(page.locator('#config-panel')).not.toHaveClass(/hidden/);
    else await expect(page.locator('#pane-inicio')).not.toHaveClass(/active/);
    return;
  }
  /* Fuera de Inicio, el botón amarillo de abajo (25/10/2026): mantenerlo y
     deslizar de lado gira el aro (MINI_GANANCIA grados por px) y al soltar
     entra en la sección cian. Por el camino corto, como lo haría una persona. */
  const fab = page.locator('#dial-fab');
  await expect(fab).not.toHaveClass(/oculto/);
  await page.waitForTimeout(400);                    // que acabe de asomar
  const [desde, pxPorPaso] = await page.evaluate(() => [seccionActual(), DIAL_PASO / MINI_GANANCIA]);
  let pasos = SECCIONES.indexOf(nombre) - desde;
  if(pasos > 2) pasos -= 5;
  if(pasos < -2) pasos += 5;
  const caja = await fab.boundingBox();
  const x = caja.x + caja.width / 2, y = caja.y + caja.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for(let i = 1; i <= 20; i++) await page.mouse.move(x + pasos * pxPorPaso * i / 20, y);
  await page.waitForTimeout(150);
  await page.mouse.up();
  await expect(page.locator('#dial-velo')).not.toHaveClass(/ver/);
}

module.exports = { test, expect, appLista, comprobarLocal, irA };
