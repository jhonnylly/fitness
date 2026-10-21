/* Pruebas de extremo a extremo con Playwright (21/10/2026).

   test/ui.test.js ya prueba la interfaz en Chrome, pero llamando a las
   funciones de la app por dentro. Estas pruebas la usan como una persona:
   tocan botones, escriben en los campos y miran lo que sale en pantalla. Y lo
   hacen en dos móviles: un iPhone (WebKit, el motor de Safari, que es donde
   han salido los fallos que Chrome no enseña) y un Android (Chrome).

   Seguridad, por las dos pérdidas de datos (04/08 y 04/09/2026): cada prueba
   abre un navegador limpio, sin la sesión de nadie, y e2e/base.js corta toda
   conexión que no sea 127.0.0.1. Firebase no llega ni a cargarse, así que es
   imposible escribir en la nube.

   Instalar (no van en el repo, como el resto de herramientas):
       npm install --no-save @playwright/test
       npx playwright install webkit
   WebKit en Ubuntu necesita además (una vez, con sudo):
       sudo apt-get install -y libevent-2.1-7t64 libavif16 libmanette-0.2-0
   Android usa el Chrome del sistema, no hace falta descargarlo.

   Correr:  npm run test:e2e          (los dos móviles)
            npm run test:e2e -- --project=android
            npx playwright show-report  (informe con capturas de lo que falle) */

const { defineConfig, devices } = require('@playwright/test');

const PUERTO = 8792;

module.exports = defineConfig({
  testDir: './e2e',
  testMatch: '*.spec.js',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e/informe' }]],
  outputDir: 'e2e/resultados',
  use: {
    baseURL: `http://127.0.0.1:${PUERTO}`,
    // El Service Worker pediría cosas por su cuenta y se saltaría el corte de
    // red de e2e/base.js. Lo de funcionar sin red ya lo prueba ui.test.js.
    serviceWorkers: 'block',
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'iphone',  use: { ...devices['iPhone 13'] } },
    { name: 'android', use: { ...devices['Pixel 7'], channel: 'chrome' } },
  ],
  webServer: {
    command: 'node e2e/servidor.js',
    url: `http://127.0.0.1:${PUERTO}/index.html`,
    reuseExistingServer: !process.env.CI,
    env: { PUERTO_E2E: String(PUERTO) },
  },
});
