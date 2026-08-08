// Arnés mínimo: carga el JS de index.html en Node con localStorage y DOM falsos
// y ejercita la capa STORAGE / save() / load().
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync('/home/jhon/fitness/index.html', 'utf8');
const js = src.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/)[1];

// --- stubs ---
const store = new Map();
const localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};
const el = () => ({
  style: {}, textContent: '', innerHTML: '', value: '',
  classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
  // Los elementos reales lo tienen; sin esto, cualquier código que enganche un
  // listener revienta el arnés en vez de fallar donde debe.
  addEventListener(){}, removeEventListener(){},
});
// Se guardan los listeners para poder disparar DOMContentLoaded a mano y
// comprobar el arranque real de la app.
const listeners = {};
const document = {
  getElementById: () => el(),
  createElement: () => el(),
  addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
  body: { insertBefore(){}, firstChild: null },
};
const disparar = ev => (listeners[ev] || []).forEach(fn => fn());

const ctx = {
  localStorage, document, console,
  window: { scrollTo(){} },
  setTimeout, clearTimeout, setInterval, clearInterval,
  navigator: { vibrate(){} },
  fetch: () => Promise.reject(new Error('sin red')),
};
ctx.globalThis = ctx;
vm.createContext(ctx);
// const/let de nivel superior viven en el ámbito léxico del script, no en el
// objeto global: hay que exponerlos explícitamente para poder testearlos.
const puente = `
;globalThis.__app = {
  STORAGE, StorageLocal, save, saveEstricto, load, storageAvailable,
  planParaFirestore, planDesdeFirestore, buscarArraysAnidados,
  resumenDB, textoResumen, firmaDB, mismosDatos, diagnosticarSubida,
  fotosARecomprimir, LIMITE_FOTO,
  leerDecisionSync, guardarDecisionSync,
  PRESET_ROUTINES, PLAN,
  get DB(){ return DB }, set DB(v){ DB = v }
};`;
vm.runInContext(js + puente, ctx, { filename: 'index-inline.js' });
const app = ctx.__app;

// --- utilidades ---
let fallos = 0;
const ok = (cond, msg) => {
  console.log((cond ? '  ✅ ' : '  ❌ ') + msg);
  if (!cond) fallos++;
};

(async () => {
  console.log('\n1. Backend por defecto');
  ok(app.STORAGE.backend.name === 'local', 'STORAGE arranca con el backend "local"');
  ok(app.storageAvailable() === true, 'storageAvailable() delega y devuelve true');

  console.log('\n2. Ida y vuelta save() -> load()');
  app.DB = { routines: [{ id: 'r1', name: 'Rutina test', plan: [], sessions: { 3: { date: '01/08/2026' } }, medidas: [] }], activeRoutine: 'r1', profileName: 'JHON' };
  await app.save();
  ok(store.has('jhon_db_v2'), 'save() escribió en la clave jhon_db_v2');
  const crudo = JSON.parse(store.get('jhon_db_v2'));
  ok(crudo.activeRoutine === 'r1', 'el JSON guardado conserva activeRoutine');
  ok(crudo.routines[0].sessions['3'].date === '01/08/2026', 'conserva las sesiones anidadas');

  app.DB = { routines: [], activeRoutine: null };   // simula recarga
  await app.load();
  ok(app.DB.activeRoutine === 'r1', 'load() restauró activeRoutine');
  ok(app.DB.routines[0].name === 'Rutina test', 'load() restauró la rutina');
  ok(app.DB.profileName === 'JHON', 'load() restauró el perfil');

  console.log('\n3. Arranque sin datos previos');
  store.clear();
  app.DB = { routines: [{ id: 'x' }], activeRoutine: 'x' };
  await app.load();
  ok(app.DB.routines.length === 0 && app.DB.activeRoutine === null, 'sin datos -> DB vacía (dispara onboarding)');

  console.log('\n4. Migración del formato legacy (sin .routines)');
  store.set('jhon_db_v2', JSON.stringify({ sessions: { 1: { date: '05/07/2026' } }, medidas: [{ peso: 80 }] }));
  await app.load();
  ok(app.DB.activeRoutine === 'def_jhon', 'legacy -> crea rutina def_jhon');
  ok(app.DB.routines[0].sessions['1'].date === '05/07/2026', 'legacy -> conserva las sesiones antiguas');
  ok(app.DB.routines[0].medidas[0].peso === 80, 'legacy -> conserva las medidas antiguas');
  ok(app.DB.routines[0].plan.length > 0, 'legacy -> rellena el plan por defecto');

  console.log('\n5. Orden de escrituras con backend asíncrono lento');
  const orden = [];
  app.STORAGE.use({
    name: 'lento',
    available: () => true,
    async read() { return null; },
    async write(db) {
      const n = db.marca;
      await new Promise(r => setTimeout(r, n === 1 ? 60 : 5));  // la 1ª tarda más
      orden.push(n);
    },
  });
  app.DB = { marca: 1 }; const p1 = app.save();
  app.DB = { marca: 2 }; const p2 = app.save();
  await Promise.all([p1, p2]);
  ok(JSON.stringify(orden) === '[1,2]', 'las escrituras se aplican en orden pese a que la 1ª es más lenta (' + orden.join(',') + ')');

  console.log('\n6. Un backend que falla no rompe la app');
  app.STORAGE.use({ name: 'roto', available: () => false, async read() { throw new Error('sin conexión'); }, async write() { throw new Error('sin conexión'); } });
  let reventó = false;
  try { await app.save(); } catch (e) { reventó = true; }
  ok(!reventó, 'save() captura el error en vez de propagarlo');

  // Las subidas verifican lo escrito, así que necesitan el motivo real del
  // fallo. Con save() se perdía en la consola y el usuario solo veía
  // "la subida no se pudo confirmar", que no dice nada.
  let motivo = null;
  try { await app.saveEstricto(); } catch (e) { motivo = e.message; }
  ok(motivo === 'sin conexión', 'saveEstricto() sí propaga el motivo real (' + motivo + ')');
  // Y pese al fallo la cola queda utilizable: el siguiente guardado corre.
  app.STORAGE.use(app.StorageLocal);
  app.DB = { routines: [], activeRoutine: null, traslFallo: true };
  let siguienteOk = true;
  try { await app.save(); } catch (e) { siguienteOk = false; }
  ok(siguienteOk && JSON.parse(store.get('jhon_db_v2')).traslFallo === true,
     'la cola de escritura sigue viva después de un fallo propagado');
  app.STORAGE.use({ name: 'roto', available: () => false, async read() { throw new Error('sin conexión'); }, async write() { throw new Error('sin conexión'); } });
  app.DB = { routines: [{ id: 'y' }], activeRoutine: 'y' };
  try { await app.load(); } catch (e) { reventó = true; }
  ok(!reventó, 'load() captura el error de lectura');
  ok(app.DB.routines.length === 0, 'tras fallo de lectura deja DB vacía en vez de datos a medias');
  ok(app.storageAvailable() === false, 'storageAvailable() refleja el backend roto (dispara el banner)');

  console.log('\n7. Se puede volver al backend local');
  app.STORAGE.use(app.StorageLocal);
  ok(app.STORAGE.backend.name === 'local', 'STORAGE.use() vuelve a local');

  console.log('\n8. Conversión de formato para Firestore');
  const plan = [{
    num: 1, title: 'Semana 1', days: [
      { s: 1, name: 'S1 · Upper', type: 'Upper', ex: [['Press banca', '4×10'], ['Remo barra', '4×10']] },
      { s: 2, name: 'S2 · Lower', type: 'Lower', ex: [] },
    ],
  }];
  const enviado = app.planParaFirestore(plan);
  ok(enviado[0].days[0].ex[0].name === 'Press banca', 'ex[0] pasa a {name}');
  ok(enviado[0].days[0].ex[0].scheme === '4×10', 'ex[0] pasa a {scheme}');
  ok(app.buscarArraysAnidados(enviado) === null, 'lo convertido NO tiene arrays anidados');
  ok(app.buscarArraysAnidados(plan) !== null, 'el original SÍ los tiene (el detector funciona)');
  ok(enviado[0].title === 'Semana 1' && enviado[0].days[0].type === 'Upper', 'conserva el resto de campos');
  ok(enviado[0].days[1].ex.length === 0, 'una sesión sin ejercicios no se rompe');

  const vuelta = app.planDesdeFirestore(enviado);
  ok(JSON.stringify(vuelta) === JSON.stringify(plan), 'ida y vuelta devuelve el plan original exacto');
  ok(JSON.stringify(app.planParaFirestore(enviado)) === JSON.stringify(enviado), 'convertir dos veces no rompe nada (idempotente)');

  console.log('\n9. Conversión sobre los datos reales de la app');
  for (const preset of app.PRESET_ROUTINES) {
    const ida = app.planParaFirestore(preset.plan);
    const ruta = app.buscarArraysAnidados(ida);
    ok(ruta === null, `"${preset.name}" queda apto para Firestore${ruta ? ' (falla en ' + ruta + ')' : ''}`);
    ok(JSON.stringify(app.planDesdeFirestore(ida)) === JSON.stringify(preset.plan), `"${preset.name}" sobrevive a la ida y vuelta`);
  }
  const idaPLAN = app.planParaFirestore(app.PLAN);
  ok(app.buscarArraysAnidados(idaPLAN) === null, 'PLAN (rutina por defecto) queda apto');
  ok(JSON.stringify(app.planDesdeFirestore(idaPLAN)) === JSON.stringify(app.PLAN), 'PLAN sobrevive a la ida y vuelta');

  console.log('\n10. El detector señala la ruta exacta del array anidado');
  ok(app.buscarArraysAnidados({ a: 1, b: 'x' }) === null, 'objeto plano: sin hallazgos');
  ok(app.buscarArraysAnidados({ sets: [{ kg: '20', reps: '10' }] }) === null, 'array de mapas es válido en Firestore');
  ok(app.buscarArraysAnidados({ plan: [{ days: [{ ex: [['a', 'b']] }] }] }) === 'plan[0].days[0].ex[0]',
     'devuelve la ruta exacta: plan[0].days[0].ex[0]');

  console.log('\n11. Comparar dispositivo y nube');
  const conHistorial = { routines: [
    { id:'a', name:'Volumen', plan:[], sessions:{1:{},2:{},3:{}}, medidas:[{peso:80}] },
    { id:'b', name:'Fuerza',  plan:[], sessions:{4:{}},           medidas:[] },
  ]};
  const soloPruebas = { routines: [
    { id:'a', name:'Volumen', plan:[], sessions:{}, medidas:[] },
    { id:'c', name:'test',    plan:[], sessions:{}, medidas:[] },
  ]};

  const rh = app.resumenDB(conHistorial);
  ok(rh.rutinas === 2 && rh.sesiones === 4 && rh.medidas === 1, 'cuenta rutinas, sesiones y medidas');
  ok(app.resumenDB({ routines: [] }).rutinas === 0, 'una DB vacía resume a cero');
  ok(app.resumenDB(null).rutinas === 0, 'resumenDB(null) no revienta');

  ok(app.textoResumen(rh).includes('2 rutinas'), 'el texto menciona las rutinas');
  ok(app.textoResumen(rh).includes('4 sesiones registradas'), 'y las sesiones registradas');
  ok(app.textoResumen({rutinas:1,sesiones:1,medidas:0,fotos:0}) === '1 rutina · 1 sesión registrada', 'singulares correctos');
  ok(app.textoResumen({rutinas:0,sesiones:0,medidas:0,fotos:0}) === 'nada guardado', 'sin datos lo dice claro');

  // Lo importante: NO confundir "2 rutinas aquí" con "2 rutinas allí".
  ok(!app.mismosDatos(conHistorial, soloPruebas), 'dos DBs con el mismo nº de rutinas pero distinto historial NO son iguales');
  ok(app.mismosDatos(conHistorial, JSON.parse(JSON.stringify(conHistorial))), 'una copia idéntica sí lo es');
  ok(app.mismosDatos({routines:[]}, {routines:[]}), 'dos vacías son iguales');
  const alReves = { routines: [conHistorial.routines[1], conHistorial.routines[0]] };
  ok(app.mismosDatos(conHistorial, alReves), 'el orden de las rutinas no cambia la firma');
  const otraSesion = JSON.parse(JSON.stringify(conHistorial));
  otraSesion.routines[0].sessions[9] = {};
  ok(!app.mismosDatos(conHistorial, otraSesion), 'una sesión registrada de más sí cambia la firma');

  console.log('\n12. Recuerdo de la decisión de sincronización');
  store.delete('jhon_sync_v1');
  ok(app.leerDecisionSync() === null, 'sin decisión previa devuelve null');
  app.guardarDecisionSync('uid-123', 'nube');
  const dec = app.leerDecisionSync();
  ok(dec.uid === 'uid-123' && dec.modo === 'nube', 'guarda y recupera uid y modo');
  ok(typeof dec.ts === 'number', 'y deja marca de tiempo');
  store.set('jhon_sync_v1', '{roto');
  ok(app.leerDecisionSync() === null, 'una decisión corrupta no rompe el arranque');
  store.delete('jhon_sync_v1');

  console.log('\n12b. Diagnóstico de una subida que no cuadra');
  const dg = app.diagnosticarSubida;
  const rut = (id, name) => ({ id, name, sessions: {}, medidas: [] });
  ok(dg({ routines: [rut('a'), rut('b')] }, { routines: [rut('a'), rut('b')] }) === null,
     'si el recuento cuadra no hay problema que reportar');
  ok(/sigue vacía/.test(dg({ routines: [rut('a')] }, null)),
     'nube vacía tras subir se reporta como tal');
  // El caso real: dos rutinas creadas en el mismo milisegundo comparten
  // 'r_'+Date.now() y colapsan en un único documento de Firestore.
  const dup = dg({ routines: [rut('r_1', 'Fuerza'), rut('r_1', 'Volumen')] }, { routines: [rut('r_1')] });
  ok(/id de rutina repetido/.test(dup) && /r_1/.test(dup),
     'ids repetidos en el dispositivo se nombran explícitamente (' + dup + ')');
  const falta = dg({ routines: [rut('a', 'Fuerza'), rut('b', 'Glúteo')] }, { routines: [rut('a')] });
  ok(/no llegaron 1/.test(falta) && /Glúteo/.test(falta),
     'una rutina que no llegó se nombra por su nombre (' + falta + ')');

  console.log('\n12c. Qué fotos hay que recomprimir');
  const grande = 'd'.repeat(600 * 1024);   // ~600 KB de base64
  const chica  = 'd'.repeat(50 * 1024);
  const conFotos = {
    routines: [
      { id: 'r1', photos: { before: { url: grande }, after: { url: chica } } },
      { id: 'r2', photos: {} },
      { id: 'r3' },
    ],
    profilePic: grande,
  };
  const aRec = app.fotosARecomprimir(conFotos, app.LIMITE_FOTO);
  ok(aRec.length === 2, 'detecta solo las que superan el límite (' + aRec.length + ')');
  ok(aRec.some(f => f.rutina === 'r1' && f.tipo === 'before'), 'señala la foto de progreso grande');
  ok(aRec.some(f => f.tipo === 'profilePic'), 'la foto de perfil también cuenta (va en la cabecera del doc)');
  ok(!aRec.some(f => f.tipo === 'after'), 'una foto pequeña no se toca');
  ok(app.fotosARecomprimir({ routines: [] }, app.LIMITE_FOTO).length === 0, 'sin fotos no hay nada que hacer');
  ok(app.fotosARecomprimir(null, app.LIMITE_FOTO).length === 0, 'una DB nula no revienta');
  // El caso real de Jhon: rutina de 1,33 MB por las fotos.
  const real = { routines: [{ id: 'r_x', name: 'Definición Jhon', photos: { before: { url: 'd'.repeat(700*1024) }, after: { url: 'd'.repeat(630*1024) } }, sessions: {}, medidas: [] }] };
  ok(app.fotosARecomprimir(real, app.LIMITE_FOTO).length === 2,
     'el caso que bloqueaba la subida se detecta entero');

  console.log('\n13. window.cargaInicial gatea el arranque');
  // El módulo de Firebase espera esta promesa antes de preguntar "¿hay datos
  // locales que subir?". Si resolviera antes de que load() termine, la
  // respuesta sería un falso negativo y se perderían los datos del dispositivo.
  // instanceof Promise falla aquí aunque sea correcto: la promesa nace dentro
  // del contexto vm, que es otro realm. Lo que importa es que sea "thenable".
  ok(typeof (ctx.window.cargaInicial || {}).then === 'function',
     'existe y es esperable desde el arranque, no desde el listener');

  store.clear();
  store.set('jhon_db_v2', JSON.stringify({
    routines: [{ id: 'r9', name: 'Rutina del arranque', plan: [], sessions: {}, medidas: [] }],
    activeRoutine: 'r9',
  }));
  // Backend lento para que el orden sea observable, no una coincidencia.
  app.STORAGE.use({
    name: 'lento-arranque',
    available: () => true,
    async read() { await new Promise(r => setTimeout(r, 60)); return JSON.parse(store.get('jhon_db_v2')); },
    async write() {},
  });

  app.DB = { routines: [], activeRoutine: null };
  let resuelta = false;
  ctx.window.cargaInicial.then(() => { resuelta = true; });

  disparar('DOMContentLoaded');
  ok(resuelta === false, 'no está resuelta nada más arrancar la carga');
  ok(app.DB.routines.length === 0, 'y en ese instante DB aún está vacía');

  await ctx.window.cargaInicial;
  ok(app.DB.routines.length === 1, 'al resolverse, DB ya está cargada');
  ok(app.DB.routines[0].name === 'Rutina del arranque', 'quien la espera ve los datos reales, no una DB vacía');
  ok(app.DB.activeRoutine === 'r9', 'y también la rutina activa');

  app.STORAGE.use(app.StorageLocal);

  console.log('\n14. todo class="hidden" tiene quien lo oculte');
  // No hay una .hidden genérica (rompería las transiciones por transform), así
  // que cada elemento que la use necesita su propia regla. Olvidarla NO da
  // error: deja el elemento visible para siempre. Ha pasado dos veces
  // (#asignar-panel y #cfg-propuesta), las dos descubiertas de casualidad en
  // producción. Esto es estático, no toca el DOM falso: mira el fichero.
  const sinComentarios = src.replace(/<!--[\s\S]*?-->/g, '');
  const css = (sinComentarios.match(/<style[^>]*>([\s\S]*?)<\/style>/) || [, ''])[1]
    .replace(/\/\*[\s\S]*?\*\//g, '');

  // Selectores declarados que ocultan de verdad, partidos por la coma.
  const reglas = [];
  css.replace(/([^{}]+)\{[^{}]*\}/g, (_, sel) => {
    sel.split(',').forEach(s => { if (/\.hidden\b/.test(s)) reglas.push(s.trim()); });
    return '';
  });

  // Rango [inicio,fin) de un elemento por id, contando anidamiento de su tag.
  const rangoDe = id => {
    const abre = new RegExp(`<(\\w+)[^>]*\\bid="${id}"`);
    const m = abre.exec(sinComentarios);
    if (!m) return null;
    const tag = m[1];
    const trozos = new RegExp(`<${tag}\\b|</${tag}>`, 'g');
    trozos.lastIndex = m.index;
    let nivel = 0, t;
    while ((t = trozos.exec(sinComentarios))) {
      nivel += t[0][1] === '/' ? -1 : 1;
      if (nivel === 0) return [m.index, t.index];
    }
    return null;
  };

  const cubre = (sel, id, clases, pos) => {
    if (sel === '.hidden') return true;                       // genérica: no existe hoy
    if (/^#([\w-]+)\s+\.hidden$/.test(sel)) {                 // #padre .hidden
      const r = rangoDe(sel.match(/^#([\w-]+)/)[1]);
      return !!r && pos > r[0] && pos < r[1];
    }
    const propio = sel.match(/^(?:#([\w-]+))?((?:\.[\w-]+)*)\.hidden$/); // #id.hidden / .cls.hidden
    if (!propio) return false;
    if (propio[1] && propio[1] !== id) return false;
    return (propio[2].match(/\.[\w-]+/g) || []).every(c => clases.includes(c.slice(1)));
  };

  const huerfanos = [];
  const conHidden = /<(\w+)([^>]*\bclass="([^"]*\bhidden\b[^"]*)"[^>]*)>/g;
  let e;
  while ((e = conHidden.exec(sinComentarios))) {
    const id = (e[2].match(/\bid="([\w-]+)"/) || [, ''])[1];
    const clases = e[3].split(/\s+/);
    if (!reglas.some(sel => cubre(sel, id, clases, e.index))) {
      huerfanos.push(id ? '#' + id : '<' + e[1] + ' class="' + e[3] + '">');
    }
  }

  ok(reglas.length > 0, 'se encontraron reglas .hidden en el <style> (el arnés lee el CSS)');
  ok(rangoDe('auth-panel') !== null, 'el emparejador de tags localiza #auth-panel (el arnés sabe mirar dentro)');
  ok(huerfanos.length === 0,
     huerfanos.length ? 'estos usan class="hidden" pero NADA los oculta: ' + huerfanos.join(', ')
                      : 'ningún elemento se queda visible por una regla que falta');

  console.log(fallos === 0 ? '\n✅ TODO OK\n' : `\n❌ ${fallos} fallo(s)\n`);
  process.exit(fallos === 0 ? 0 : 1);
})();
