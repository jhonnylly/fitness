/* El uso de cada día: abrir la sesión que toca, apuntar las series y
   guardarla. Si esto se rompe, la app no sirve para nada más. */

const { test, expect, appLista, irA } = require('./base');

async function apuntarPrimeraSerie(page, kg, reps){
  await irA(page, 'Entrenar');
  await page.getByRole('button', { name: /Ver las sesiones de la semana/ }).click();
  await page.getByRole('button', { name: /S1 · Full Body A/ }).click();
  await page.locator('#ex-mosaico').getByRole('button', { name: /Prensa 45°/ }).click();

  await page.getByLabel('Peso de la serie 1 en kg').fill(kg);
  await page.getByLabel('Repeticiones de la serie 1').fill(reps);
  await page.getByLabel('Repeticiones de la serie 1').blur();   // el valor se anota en onchange

  await page.getByRole('button', { name: 'Volver a ejercicios' }).click();
  await page.locator('#session-form').getByRole('button', { name: 'Guardar sesión' }).click();
}

test('guardar una sesión la celebra y la cuenta en el plan', async ({ page }) => {
  await appLista(page);
  await apuntarPrimeraSerie(page, '60', '10');

  const celebracion = page.locator('#celebracion');
  await expect(celebracion).toBeVisible();
  // La celebración cuenta sobre todo el plan: Primer Mes son 4 semanas × 3.
  await expect(page.locator('#cel-sub')).toContainText(/1 de 12 sesiones/);

  await celebracion.getByRole('button', { name: 'Seguir' }).click();
  await expect(celebracion).toBeHidden();
});

test('la sesión guardada sigue ahí al recargar, con sus kilos', async ({ page }) => {
  await appLista(page);
  await apuntarPrimeraSerie(page, '62,5', '8');
  await page.locator('#cel-seguir').click();

  await page.reload();

  const serie = await page.evaluate(() => {
    const r = getActive();
    const s1 = r.plan[0].days[0].s;
    return r.sessions[s1] && r.sessions[s1].exercises[0].sets[0];
  });
  expect(serie, 'la sesión S1 está registrada').toBeTruthy();
  expect(String(serie.kg).replace(',', '.')).toBe('62.5');
  expect(String(serie.reps)).toBe('8');
  await irA(page, 'Entrenar');
  await expect(page.getByText(/1 de 3 sesiones/)).toBeVisible();
});
