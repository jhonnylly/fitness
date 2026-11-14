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

/* Ir a una sección como lo haría una persona: tocando su pestaña en la barra
   de abajo (14/11/2026; del 21/10 al 14/11 se navegaba con el dial). Ajustes
   abre su panel encima, sin cambiar de pestaña. */
const SECCIONES = ['Inicio', 'Entrenar', 'Resumen', 'Medidas', 'Ajustes'];
const PESTANA = { Inicio:'#tab-inicio', Entrenar:'#tab-log', Resumen:'#tab-resumen', Medidas:'#tab-medidas', Ajustes:'#config-btn' };
async function irA(page, nombre){
  if(!SECCIONES.includes(nombre)) throw new Error('Sección desconocida: '+nombre);
  await page.locator(PESTANA[nombre]).click();
  if(nombre === 'Ajustes') await expect(page.locator('#config-panel')).not.toHaveClass(/hidden/);
  else await expect(page.locator(PESTANA[nombre])).toHaveClass(/active/);
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
