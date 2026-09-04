#!/usr/bin/env node
/* Genera los mapas musculares de todos los ejercicios.

     node tools/generar-imagenes.js

   Lee:
     ~/fitness-ejercicios.txt   la lista (clave <TAB> nombre <TAB> alias)
     tools/musculos.js          qué músculos trabaja cada ejercicio
     tools/cuerpo.js            la silueta y el dibujo
   Escribe:
     img/ejercicios/<clave>.svg
     img/ejercicios/index.html  hoja de contacto para revisarlas de un vistazo

   Si cambias un músculo en musculos.js, vuelve a lanzarlo y ya está. La lista
   se regenera aparte (ver el README de esta carpeta). */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { svgEjercicio } = require('./cuerpo.js');
const MUSCULOS_POR_EJERCICIO = require('./musculos.js');

const LISTA = path.join(os.homedir(), 'fitness-ejercicios.txt');
const SALIDA = path.join(__dirname, '..', 'img', 'ejercicios');

/* Ejercicios cuyo mapa está a la espera de que Jhon lo confirme: salen
   marcados en la hoja de contacto para poder repasarlos de un vistazo.
   Los siete que había (las máquinas con nombre comercial y los fondos de
   capitán) los confirmó el 02/09/2026, así que la lista está vacía. Añadir
   aquí cualquier ejercicio nuevo del que se dude. */
const REVISAR = [];

const filas = fs.readFileSync(LISTA, 'utf8')
  .split('\n')
  .filter(l => l && !l.startsWith('#'))
  .map(l => { const p = l.split('\t'); return { clave: p[0], nombre: p[1], alias: p[2] || '' }; });

const sinMapear = filas.filter(f => !MUSCULOS_POR_EJERCICIO[f.clave]).map(f => f.clave);
if (sinMapear.length) {
  console.error('✗ Sin músculos asignados en tools/musculos.js:\n   ' + sinMapear.join('\n   '));
  process.exit(1);
}
const sobran = Object.keys(MUSCULOS_POR_EJERCICIO).filter(k => !filas.some(f => f.clave === k));
if (sobran.length) {
  console.error('✗ En musculos.js pero ya no en la lista (¿ejercicio renombrado?):\n   ' + sobran.join('\n   '));
  process.exit(1);
}

fs.mkdirSync(SALIDA, { recursive: true });
for (const f of filas) {
  const [primarios, secundarios] = MUSCULOS_POR_EJERCICIO[f.clave];
  fs.writeFileSync(path.join(SALIDA, f.clave + '.svg'),
    svgEjercicio({ nombre: f.nombre, primarios, secundarios }));
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
fs.writeFileSync(path.join(SALIDA, 'index.html'),
`<!doctype html><meta charset="utf-8"><title>Mapas musculares</title>
<body style="background:#111;color:#eee;font:14px system-ui;margin:0;padding:16px">
<h1 style="font-size:18px">${filas.length} mapas musculares</h1>
<p style="color:#999;font-size:13px;max-width:70ch">Naranja fuerte = músculo principal ·
naranja apagado = secundario.${REVISAR.length ? ` Los marcados <b style="color:#ff6b00">REVISAR</b>
dependen de cómo esté montada esa máquina en tu gimnasio.` : ''}</p>
<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px">
${filas.map(f => `<figure style="margin:0;text-align:center;background:#1a1a1a;border-radius:10px;padding:8px">
  <img src="${f.clave}.svg" style="width:100%" loading="lazy">
  <figcaption style="font-size:11px;margin-top:4px;line-height:1.35">${esc(f.nombre)}${
    REVISAR.includes(f.clave) ? '<br><b style="color:#ff6b00">REVISAR</b>' : ''}${
    f.alias ? `<br><span style="color:#777;font-size:10px">${esc(f.alias)}</span>` : ''}
  </figcaption></figure>`).join('\n')}
</div></body>`);

/* Los músculos de cada ejercicio, para la app. Hasta ahora esta información
   solo vivía aquí, en Node, y el navegador no la veía: le bastaba con la
   silueta ya dibujada. Con las fotos por músculo sí hace falta, porque la app
   tiene que elegir QUÉ foto enseña y escribir los nombres debajo. */
fs.writeFileSync(path.join(SALIDA, 'musculos.js'),
  '/* Generado por tools/generar-imagenes.js — no editar a mano. */\n' +
  'window.MUSCULOS_EJERCICIOS=' + JSON.stringify(
    Object.fromEntries(filas.map(f => [f.clave, MUSCULOS_POR_EJERCICIO[f.clave]]))) + ';\n');

/* La app necesita saber QUÉ imágenes existen: buscarImagenEjercicio() casa el
   nombre del ejercicio contra la lista de claves disponibles (con su búsqueda
   laxa para plurales y conectores), y eso no se puede adivinar probando URLs.
   Se escribe aquí en vez de a mano en index.html para que no se desincronice:
   quien regenere las imágenes regenera la lista. */
fs.writeFileSync(path.join(SALIDA, 'lista.js'),
  '/* Generado por tools/generar-imagenes.js — no editar a mano. */\n' +
  'window.IMAGENES_EJERCICIOS=' + JSON.stringify(filas.map(f => f.clave)) + ';\n');

console.log(`✓ ${filas.length} SVG en img/ejercicios/ (+ lista.js y musculos.js)`);
console.log(REVISAR.length
  ? `  revisar a mano: ${REVISAR.length} (${REVISAR.join(', ')})`
  : '  ninguno pendiente de revisar');
