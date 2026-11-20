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
   barra de pestañas): en Inicio, con el dial grande; en las demás, con la tira
   de la cabecera (20/11/2026: el botón amarillo ya no sale dentro de las
   secciones, y la tira lleva el nombre en sus cinco botones).
   En el dial, tocar un tramo gira hasta él y abre sus opciones (sin espera,
   20/11/2026); el centro es entonces «Volver», que las cierra dejando la
   sección elegida, y otro toque en el centro entra directo. */
async function irA(page, nombre){
  if(await page.locator('#pane-inicio').evaluate(e => e.classList.contains('active'))
     && await page.locator('#config-panel').evaluate(e => e.classList.contains('hidden'))){
    await page.evaluate(() => scrollTo(0, 0));
    if(nombre === 'Inicio'){ await page.locator('#dial-centro').click(); return; }
    await page.locator(`#dial-etiquetas g[aria-label="${nombre}"]`).click();
    await expect(page.locator('#dial')).toHaveClass(/\bsub\b/);
    await page.locator('#dial-centro').click();                       // «Volver»
    await expect(page.locator('#dial')).not.toHaveClass(/\bsub\b/);
    await expect.poll(() => page.locator('#dial-aro').getAttribute('aria-valuetext')).toBe(nombre);
    await page.locator('#dial-centro').click();                       // entra
    if(nombre === 'Ajustes') await expect(page.locator('#config-panel')).not.toHaveClass(/hidden/);
    else await expect(page.locator('#pane-inicio')).not.toHaveClass(/active/);
    return;
  }
  // Fuera de Inicio: la tira visible (la de la sección, la de Ajustes o la de Mis rutinas).
  await page.evaluate(() => scrollTo(0, 0));
  const tira = page.locator('nav.cab-tira:visible').first();
  await tira.getByRole('button', { name: nombre, exact: true }).click();
  if(nombre === 'Ajustes') await expect(page.locator('#config-panel')).not.toHaveClass(/hidden/);
  else{
    await expect(page.locator('#config-panel')).toHaveClass(/hidden/);
    const pane = { Inicio:'#pane-inicio', Entrenar:'#pane-log', Resumen:'#pane-resumen', Medidas:'#pane-medidas' }[nombre];
    await expect(page.locator(pane)).toHaveClass(/active/);
  }
}

/* La caja de algo del aro cuando ya ha dejado de girar (29/10/2026): medirla
   a mitad del giro hacía que el toque cayera fuera, y la prueba fallaba a
   ratos (~1 de cada 4). Espera a dos medidas seguidas iguales. */
async function cajaQuieta(locator){
  let antes = null;
  for(let i = 0; i < 40; i++){
    const c = await locator.boundingBox();
    if(c && antes && Math.abs(c.x - antes.x) < 0.5 && Math.abs(c.y - antes.y) < 0.5) return c;
    antes = c;
    await locator.page().waitForTimeout(60);
  }
  return antes;
}

module.exports = { test, expect, appLista, comprobarLocal, irA, cajaQuieta };
