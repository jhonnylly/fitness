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
const el = () => ({ style: {}, textContent: '', innerHTML: '', classList: { add(){}, remove(){} }, value: '' });
const document = {
  getElementById: () => el(),
  createElement: () => el(),
  addEventListener: () => {},
  body: { insertBefore(){}, firstChild: null },
};

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
  STORAGE, StorageLocal, save, load, storageAvailable,
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
  app.DB = { routines: [{ id: 'y' }], activeRoutine: 'y' };
  try { await app.load(); } catch (e) { reventó = true; }
  ok(!reventó, 'load() captura el error de lectura');
  ok(app.DB.routines.length === 0, 'tras fallo de lectura deja DB vacía en vez de datos a medias');
  ok(app.storageAvailable() === false, 'storageAvailable() refleja el backend roto (dispara el banner)');

  console.log('\n7. Se puede volver al backend local');
  app.STORAGE.use(app.StorageLocal);
  ok(app.STORAGE.backend.name === 'local', 'STORAGE.use() vuelve a local');

  console.log(fallos === 0 ? '\n✅ TODO OK\n' : `\n❌ ${fallos} fallo(s)\n`);
  process.exit(fallos === 0 ? 0 : 1);
})();
