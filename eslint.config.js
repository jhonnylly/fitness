/* ESLint: solo para cazar ERRORES REALES (variables sin declarar, claves
   duplicadas, código inalcanzable, asignar a una const...). Lo de estilo va
   apagado a propósito: con 8.000 líneas de JS dentro del index.html, avisos
   como "variable sin usar" taparían lo que de verdad rompe la app.

   Se instala suelto, igual que el resto de herramientas de prueba:
       npm install --no-save eslint@9 @eslint/js@9 eslint-plugin-html globals
   y se lanza con `npm run lint`. */

const fs = require('fs');
const espree = require('espree');
const js = require('@eslint/js');
const html = require('eslint-plugin-html');
const globals = require('globals');

/* Los dos <script> del index.html se hablan por el ámbito global: el clásico
   declara funciones de primer nivel y el module cuelga las suyas de window.X.
   ESLint mira cada bloque por separado y daría cientos de "no definido" falsos.
   Se sacan del propio HTML en cada pasada; una lista a mano se quedaría vieja
   con el primer cambio y escondería los errores de verdad. */
function globalesCompartidos() {
  const htmlTxt = fs.readFileSync(__dirname + '/index.html', 'utf8');
  const nombres = {};
  const re = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(htmlTxt))) {
    const esModule = /type=["']module["']/.test(m[1]);
    const ast = espree.parse(m[2], { ecmaVersion: 'latest', sourceType: esModule ? 'module' : 'script' });
    const añadir = p => {
      if (!p) return;
      if (p.type === 'Identifier') nombres[p.name] = 'writable';
      else if (p.type === 'ObjectPattern') p.properties.forEach(q => añadir(q.value || q.argument));
      else if (p.type === 'ArrayPattern') p.elements.forEach(añadir);
      else if (p.type === 'AssignmentPattern') añadir(p.left);
      else if (p.type === 'RestElement') añadir(p.argument);
    };
    // En el module lo de primer nivel es privado: solo cuenta lo que va a window.
    if (!esModule) for (const s of ast.body) {
      if ((s.type === 'FunctionDeclaration' || s.type === 'ClassDeclaration') && s.id) añadir(s.id);
      if (s.type === 'VariableDeclaration') s.declarations.forEach(d => añadir(d.id));
    }
    for (const [, nombre] of m[2].matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)) nombres[nombre] = 'writable';
  }
  return nombres;
}

const deLaApp = {
  ...globals.browser,
  Chart: 'readonly',                  // Chart.js desde el CDN
  IMAGENES_EJERCICIOS: 'readonly',    // img/ejercicios/lista.js
  MUSCULOS_EJERCICIOS: 'readonly',    // img/ejercicios/musculos.js
  ...globalesCompartidos(),
};

module.exports = [
  { ignores: ['node_modules/**', 'img/**', 'fuentes/**', 'icons/**'] },
  js.configs.recommended,
  {
    rules: {
      // Estilo o ruido, no fallos:
      'no-unused-vars': 'off',
      'no-empty': 'off',            // los catch vacíos son "fallar sin ruido", a propósito
      'no-useless-escape': 'off',
      'no-prototype-builtins': 'off',
      'no-sparse-arrays': 'off',    // `|| [, '']` para quedarse con el grupo 1 de un match
    },
  },
  {
    files: ['index.html'],
    plugins: { html },
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: deLaApp },
  },
  {
    files: ['sw.js'],
    languageOptions: { sourceType: 'script', globals: globals.serviceworker },
  },
  {
    files: ['test/**/*.js', 'tools/**/*.js', 'eslint.config.js'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
  },
  {
    // Lo de dentro de page.evaluate() corre en el navegador, dentro de la app.
    files: ['test/ui.test.js'],
    languageOptions: { globals: { ...globals.node, ...deLaApp } },
  },
];
