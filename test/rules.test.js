/* Pruebas de las REGLAS de Firestore, contra el emulador de verdad.

   Por qué existen: `firestore.rules` era la única parte del proyecto sin
   ninguna red debajo. Todo lo que se escribía ahí iba a ciegas hasta que Jhon
   lo publicaba en la consola y lo probaba a mano — y el 09/09/2026 una
   publicación le dejó sin poder leer a sus propios clientes ("Missing or
   insufficient permissions"). Ahora que el cobro depende de que la suspensión
   funcione, ir a ciegas dejó de ser aceptable.

   Necesita Java 11+ y firebase-tools. Si no están, NO falla: avisa y sale, la
   misma cortesía que test/ui.test.js con puppeteer.
       npm install --no-save firebase-tools@13 @firebase/rules-unit-testing

   ⚠️ Estas pruebas NO tocan el proyecto real. Corren contra un emulador local
   con el id "demo-fitness", que Firebase reserva para pruebas y nunca conecta
   con la nube.                                                              */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const PROYECTO = 'demo-fitness';

let fallos = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✅ ' : '  ❌ ') + msg); if (!cond) fallos++; };

/* Envuelve una operación y dice si las reglas la dejaron pasar. Se usa en vez
   de assertFails/assertSucceeds para poder dar el mensaje en castellano y
   seguir con el resto en vez de abortar en el primer fallo. */
async function permitido(promesa) {
  try { await promesa; return true; }
  catch (e) { return false; }
}

(async () => {
  let rut;
  try {
    rut = require('@firebase/rules-unit-testing');
  } catch (e) {
    console.log('\n⏭  SALTADO: falta @firebase/rules-unit-testing.');
    console.log('   npm install --no-save firebase-tools@13 @firebase/rules-unit-testing\n');
    process.exit(0);
  }
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.log('\n⏭  SALTADO: no hay emulador escuchando.');
    console.log('   npm run test:rules\n');
    process.exit(0);
  }

  const { initializeTestEnvironment } = rut;
  const env = await initializeTestEnvironment({
    projectId: PROYECTO,
    firestore: {
      rules: fs.readFileSync(path.join(RAIZ, 'firestore.rules'), 'utf8'),
      host: process.env.FIRESTORE_EMULATOR_HOST.split(':')[0],
      port: +process.env.FIRESTORE_EMULATOR_HOST.split(':')[1],
    },
  });

  const { doc, getDoc, setDoc, updateDoc, deleteDoc, Timestamp,
          collection, getDocs, query, where, setLogLevel } = require('firebase/firestore');
  /* Cada denegación es un PERMISSION_DENIED que el SDK escupe por consola, y
     aquí se deniegan cosas a propósito todo el rato: con el log en silencio se
     lee la lista de ✅/❌ y no un muro de errores esperados. */
  setLogLevel('silent');

  // Los actores de todas las pruebas.
  const admin    = env.authenticatedContext('u-admin').firestore();
  const coach    = env.authenticatedContext('u-coach').firestore();
  const coach2   = env.authenticatedContext('u-coach2').firestore();
  const suspendi = env.authenticatedContext('u-suspendido').firestore();
  const cliente  = env.authenticatedContext('u-cliente').firestore();
  const ajeno    = env.authenticatedContext('u-ajeno').firestore();
  const anonimo  = env.unauthenticatedContext().firestore();

  /* Estado de partida, escrito SALTÁNDOSE las reglas: montar el escenario no
     es lo que se está probando. */
  async function sembrar() {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async ctx => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users/u-admin'),   { name:'Jhon', role:'trainer', trainerId:null, admin:true });
      // OJO: sin campo `admin` ni `suspendido`. Es el caso que rompió la app.
      await setDoc(doc(db, 'users/u-coach'),   { name:'Coach', role:'trainer', trainerId:null });
      await setDoc(doc(db, 'users/u-coach2'),  { name:'Otro',  role:'trainer', trainerId:null });
      await setDoc(doc(db, 'users/u-suspendido'), { name:'Moroso', role:'trainer', trainerId:null, suspendido:true });
      await setDoc(doc(db, 'users/u-cliente'), { name:'Laura', role:'client', trainerId:'u-coach' });
      await setDoc(doc(db, 'users/u-ajeno'),   { name:'Nadie', role:'client', trainerId:'u-coach2' });
      await setDoc(doc(db, 'users/u-cliente/routines/r1'), { name:'Plan', assignedBy:'u-coach' });
      await setDoc(doc(db, 'altas/codigo-libre'),  { creadoPor:'u-admin', usado:false, usadoPor:null });
      await setDoc(doc(db, 'altas/codigo-gastado'), { creadoPor:'u-admin', usado:true,  usadoPor:'u-coach' });
      await setDoc(doc(db, 'invites/inv-libre'), { trainerId:'u-coach', usado:false, usadoPor:null });
    });
  }

  try {
    await sembrar();

    /* ─────────────────────────────────────────────────────────────────
       1. EL FALLO DEL 09/09: un campo que no existe no puede denegar
       ───────────────────────────────────────────────────────────────── */
    console.log('\n1. Campos ausentes (el fallo que tumbó la app el 09/09)');
    /* u-coach NO tiene ni `admin` ni `suspendido` en su documento. Con
       `.data.suspendido != true` en vez de `.data.get('suspendido', false)`,
       la lectura reventaba y Jhon dejó de ver a sus clientes. */
    ok(await permitido(getDoc(doc(coach, 'users/u-cliente'))),
       '🔴 un entrenador SIN campo `suspendido` puede leer a su cliente');
    ok(await permitido(getDocs(query(collection(coach, 'users'), where('trainerId','==','u-coach')))),
       '🔴 y puede LISTAR sus clientes (la consulta que se rompió)');
    ok(await permitido(getDoc(doc(coach, 'users/u-cliente/routines/r1'))),
       'y leer sus rutinas');

    /* ─────────────────────────────────────────────────────────────────
       2. Aislamiento entre entrenadores: es lo que se vende
       ───────────────────────────────────────────────────────────────── */
    console.log('\n2. Cada entrenador solo ve a los suyos');
    ok(!await permitido(getDoc(doc(coach2, 'users/u-cliente/routines/r1'))),
       'otro entrenador NO puede leer la rutina de un cliente ajeno');
    ok(!await permitido(setDoc(doc(coach2, 'users/u-cliente/routines/r1'), { name:'Colado' })),
       'ni escribirla');
    ok(!await permitido(getDoc(doc(cliente, 'users/u-ajeno/routines/r1'))),
       'un cliente no puede leer las rutinas de otro cliente');
    ok(!await permitido(getDoc(doc(anonimo, 'users/u-cliente'))),
       'sin sesión no se lee nada');

    /* ─────────────────────────────────────────────────────────────────
       3. Suspensión por impago: lo que sostiene el cobro
       ───────────────────────────────────────────────────────────────── */
    console.log('\n3. Un entrenador suspendido no puede trabajar');
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'users/u-cliente2'),
                   { name:'Cliente del moroso', role:'client', trainerId:'u-suspendido' });
      await setDoc(doc(ctx.firestore(), 'users/u-cliente2/routines/r1'), { name:'Plan' });
    });
    ok(!await permitido(getDoc(doc(suspendi, 'users/u-cliente2'))),
       '🔴 suspendido NO puede leer a su cliente');
    ok(!await permitido(getDoc(doc(suspendi, 'users/u-cliente2/routines/r1'))),
       '🔴 ni sus rutinas');
    ok(!await permitido(setDoc(doc(suspendi, 'users/u-cliente2/routines/r1'), { name:'Nuevo' })),
       '🔴 ni tocarle el plan');
    ok(!await permitido(setDoc(doc(suspendi, 'invites/inv-nueva'),
        { trainerId:'u-suspendido', usado:false })),
       'ni repartir invitaciones');
    ok(!await permitido(setDoc(doc(suspendi, 'retos/reto-nuevo'), { trainerId:'u-suspendido' })),
       'ni proponer retos');
    ok(await permitido(getDoc(doc(suspendi, 'users/u-suspendido'))),
       'pero SÍ conserva su propia cuenta: se suspende el servicio, no la persona');

    /* ─────────────────────────────────────────────────────────────────
       4. Escalada de privilegios: lo más grave que se cerró hoy
       ───────────────────────────────────────────────────────────────── */
    console.log('\n4. Nadie se da privilegios a sí mismo');
    ok(!await permitido(updateDoc(doc(suspendi, 'users/u-suspendido'), { suspendido:false })),
       '🔴 un suspendido NO puede levantarse la suspensión');
    ok(!await permitido(updateDoc(doc(coach, 'users/u-coach'), { admin:true })),
       '🔴 nadie puede hacerse admin a sí mismo');
    ok(!await permitido(updateDoc(doc(cliente, 'users/u-cliente'), { suspendidoPorCoach:false })),
       '🔴 un cliente en pausa no puede despausarse');
    ok(await permitido(updateDoc(doc(cliente, 'users/u-cliente'), { name:'Laura M.' })),
       'pero sí puede cambiar lo suyo de siempre');
    ok(!await permitido(setDoc(doc(coach, 'users/u-coach'), { admin:true }, { merge:true })),
       'y tampoco colándolo por un setDoc con merge');

    /* ─────────────────────────────────────────────────────────────────
       5. Lo que el entrenador SÍ puede tocar de su cliente, y nada más
       ───────────────────────────────────────────────────────────────── */
    console.log('\n5. El entrenador toca campos contados de su cliente');
    ok(await permitido(updateDoc(doc(coach, 'users/u-cliente'), { activeRoutine:'r1' })),
       'puede cambiarle la rutina activa');
    ok(await permitido(updateDoc(doc(coach, 'users/u-cliente'),
        { avisoCoach:{ texto:'hola', ts:1, de:'u-coach' } })),
       'y mandarle un aviso firmado con su uid');
    ok(!await permitido(updateDoc(doc(coach, 'users/u-cliente'),
        { avisoCoach:{ texto:'hola', ts:1, de:'u-coach2' } })),
       '🔴 pero NO uno que parezca de otro entrenador');
    ok(await permitido(updateDoc(doc(coach, 'users/u-cliente'), { suspendidoPorCoach:true })),
       'puede pausarle el seguimiento');
    ok(!await permitido(updateDoc(doc(coach, 'users/u-cliente'), { name:'Le cambio el nombre' })),
       '🔴 pero NO puede cambiarle el nombre');
    ok(!await permitido(updateDoc(doc(coach, 'users/u-cliente'), { admin:true })),
       'ni hacerle admin');
    ok(!await permitido(updateDoc(doc(coach, 'users/u-cliente'), { trainerId:'u-coach2' })),
       '🔴 ni endosárselo a otro entrenador');
    ok(await permitido(updateDoc(doc(coach, 'users/u-cliente'), { trainerId:null })),
       'pero sí desvincularlo');

    /* ─────────────────────────────────────────────────────────────────
       6. Códigos de alta: la puerta del negocio
       ───────────────────────────────────────────────────────────────── */
    console.log('\n6. Alta de entrenadores solo con código');
    await sembrar();
    ok(await permitido(setDoc(doc(admin, 'altas/nuevo'), { creadoPor:'u-admin', usado:false })),
       'el admin genera códigos');
    ok(!await permitido(setDoc(doc(coach, 'altas/pirata'), { creadoPor:'u-coach', usado:false })),
       '🔴 un entrenador normal NO puede generarse códigos');
    ok(!await permitido(getDocs(collection(coach, 'altas'))),
       'ni enumerar los que hay');
    ok(await permitido(getDoc(doc(coach, 'altas/codigo-libre'))),
       'pero sí leer uno concreto, que hace falta para el alta');

    const nuevo = env.authenticatedContext('u-nuevo').firestore();
    ok(!await permitido(setDoc(doc(nuevo, 'users/u-nuevo'),
        { name:'Colado', role:'trainer', trainerId:null })),
       '🔴 NO se puede crear un perfil de entrenador SIN código');
    ok(!await permitido(setDoc(doc(nuevo, 'users/u-nuevo'),
        { name:'Colado', role:'trainer', trainerId:null, altaId:'codigo-gastado' })),
       '🔴 ni con un código ya gastado');
    ok(await permitido(setDoc(doc(nuevo, 'users/u-nuevo'),
        { name:'Legítimo', role:'trainer', trainerId:null, altaId:'codigo-libre' })),
       'y sí con uno válido');

    const nuevo2 = env.authenticatedContext('u-nuevo2').firestore();
    ok(!await permitido(setDoc(doc(nuevo2, 'users/u-nuevo2'),
        { name:'Listillo', role:'trainer', trainerId:null, altaId:'codigo-libre', admin:true })),
       '🔴 y no se puede nacer admin, ni trayendo código bueno');

    /* ─────────────────────────────────────────────────────────────────
       7. Invitaciones de cliente
       ───────────────────────────────────────────────────────────────── */
    console.log('\n7. Los clientes entran solo por invitación');
    await sembrar();
    const invitado = env.authenticatedContext('u-invitado').firestore();
    ok(!await permitido(setDoc(doc(invitado, 'users/u-invitado'),
        { name:'Sin invitación', role:'client', trainerId:'u-coach' })),
       '🔴 no se puede colgar de un entrenador sin invitación');
    ok(await permitido(setDoc(doc(invitado, 'users/u-invitado'),
        { name:'Invitado', role:'client', trainerId:'u-coach', inviteId:'inv-libre' })),
       'con una invitación válida, sí');

    /* ─────────────────────────────────────────────────────────────────
       8. Datos que no se tocan nunca
       ───────────────────────────────────────────────────────────────── */
    console.log('\n8. Las fotos son de la persona');
    await sembrar();
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'users/u-cliente/fotos/f1'), { url:'x', ts:1 });
    });
    ok(await permitido(getDoc(doc(coach, 'users/u-cliente/fotos/f1'))),
       'el entrenador puede VER las fotos de su cliente');
    ok(!await permitido(setDoc(doc(coach, 'users/u-cliente/fotos/f2'), { url:'y' })),
       '🔴 pero NO puede poner ni quitar ninguna: las pone quien es su cuerpo');
    ok(!await permitido(deleteDoc(doc(cliente, 'users/u-cliente'))),
       'y ningún perfil se borra, ni el propio');

    /* ─────────────────────────────────────────────────────────────────
       9. Tipos de código: cortesía, gratis hasta una fecha y prueba
       ───────────────────────────────────────────────────────────────── */
    console.log('\n9. Acceso gratuito con fecha de fin');
    await sembrar();
    const DIA = 86400000;
    const fin = Timestamp.fromMillis(Date.now() + 60 * DIA);
    await env.withSecurityRulesDisabled(async ctx => {
      const db = ctx.firestore();
      const base = { creadoPor:'u-admin', usado:false, usadoPor:null };
      await setDoc(doc(db, 'altas/cod-cortesia'), { ...base, tipo:'cortesia' });
      await setDoc(doc(db, 'altas/cod-hasta'),    { ...base, tipo:'hasta', hasta:fin });
      await setDoc(doc(db, 'altas/cod-prueba'),   { ...base, tipo:'prueba', dias:30 });
      await setDoc(doc(db, 'users/u-vencido'), { name:'Fin de prueba', role:'trainer', trainerId:null,
                                                 accesoHasta: Timestamp.fromMillis(Date.now() - DIA) });
      await setDoc(doc(db, 'users/u-enplazo'), { name:'En prueba', role:'trainer', trainerId:null,
                                                 accesoHasta: Timestamp.fromMillis(Date.now() + 10 * DIA) });
      await setDoc(doc(db, 'users/u-cli-vencido'), { name:'Cliente', role:'client', trainerId:'u-vencido' });
      await setDoc(doc(db, 'users/u-cli-enplazo'), { name:'Cliente', role:'client', trainerId:'u-enplazo' });
    });
    const como = uid => env.authenticatedContext(uid).firestore();
    const perfilCoach = extra => ({ name:'Nuevo', role:'trainer', trainerId:null, ...extra });

    ok(await permitido(setDoc(doc(como('n1'), 'users/n1'),
        perfilCoach({ altaId:'cod-cortesia', accesoHasta:null }))),
       'cortesía: entra sin fecha de fin');
    ok(await permitido(setDoc(doc(como('n0'), 'users/n0'), perfilCoach({ altaId:'codigo-libre' }))),
       'los códigos de antes, sin tipo, siguen valiendo como cortesía');
    ok(!await permitido(setDoc(doc(como('n1b'), 'users/n1b'),
        perfilCoach({ altaId:'cod-hasta' }))),
       '🔴 código "hasta una fecha": NO se entra sin la fecha (sería acceso para siempre)');
    ok(!await permitido(setDoc(doc(como('n2'), 'users/n2'),
        perfilCoach({ altaId:'cod-hasta', accesoHasta: Timestamp.fromMillis(fin.toMillis() + 365 * DIA) }))),
       '🔴 ni alargándose la fecha');
    ok(await permitido(setDoc(doc(como('n2'), 'users/n2'),
        perfilCoach({ altaId:'cod-hasta', accesoHasta: fin }))),
       'con la fecha exacta del código, sí');
    ok(!await permitido(setDoc(doc(como('n3'), 'users/n3'),
        perfilCoach({ altaId:'cod-prueba' }))),
       '🔴 código de prueba: NO se entra sin fecha de fin');
    ok(!await permitido(setDoc(doc(como('n3'), 'users/n3'),
        perfilCoach({ altaId:'cod-prueba', accesoHasta: Timestamp.fromMillis(Date.now() + 365 * DIA) }))),
       '🔴 ni con una prueba más larga de la del código');
    ok(await permitido(setDoc(doc(como('n3'), 'users/n3'),
        perfilCoach({ altaId:'cod-prueba', accesoHasta: Timestamp.fromMillis(Date.now() + 30 * DIA) }))),
       'con los días del código, sí');

    const vencido = como('u-vencido'), enplazo = como('u-enplazo');
    ok(await permitido(getDoc(doc(enplazo, 'users/u-cli-enplazo'))),
       'dentro del plazo trabaja con normalidad');
    ok(!await permitido(getDoc(doc(vencido, 'users/u-cli-vencido'))),
       '🔴 con el plazo vencido NO ve a su cliente, sin que nadie le suspenda');
    ok(!await permitido(setDoc(doc(vencido, 'invites/inv-vencido'), { trainerId:'u-vencido', usado:false })),
       '🔴 ni reparte invitaciones');
    ok(await permitido(getDoc(doc(vencido, 'users/u-vencido'))),
       'pero conserva su propia cuenta');
    ok(!await permitido(updateDoc(doc(vencido, 'users/u-vencido'), { accesoHasta:null })),
       '🔴 y NO puede quitarse la fecha él mismo');
    ok(!await permitido(updateDoc(doc(enplazo, 'users/u-enplazo'),
        { accesoHasta: Timestamp.fromMillis(Date.now() + 999 * DIA) })),
       '🔴 ni alargarse la prueba');
    ok(!await permitido(updateDoc(doc(admin, 'users/u-vencido'), { name:'Cambiado', accesoHasta:null })),
       'el admin no puede colar otros campos junto a la fecha');
    ok(await permitido(updateDoc(doc(admin, 'users/u-vencido'), { accesoHasta:null })),
       'el admin sí le quita la fecha cuando pasa a pagar');
    ok(await permitido(getDoc(doc(vencido, 'users/u-cli-vencido'))),
       'y en ese momento vuelve a ver a su cliente');

  } catch (e) {
    console.log('  ❌ las pruebas se rompieron: ' + (e && e.message));
    fallos++;
  } finally {
    await env.cleanup();
  }

  console.log(fallos ? `\n❌ ${fallos} fallo(s)\n` : '\n✅ TODO OK\n');
  process.exit(fallos ? 1 : 0);
})();
