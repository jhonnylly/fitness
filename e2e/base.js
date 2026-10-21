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

module.exports = { test, expect, appLista, comprobarLocal };
