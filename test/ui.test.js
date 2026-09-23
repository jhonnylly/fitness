/* Pruebas de INTERFAZ, con un navegador de verdad.
   test/storage.test.js cubre los datos —almacenamiento, semana en curso,
   progresión de cargas— pero nada de lo que se ve. Todo lo que se montó el
   fin de semana del 05/09/2026 (asistente de rutinas, mosaicos, arrastre,
   fotos de músculo, funcionar sin red) se verificó con guiones de usar y
   tirar. Esto los convierte en permanentes.

   Necesita Chrome y puppeteer-core. Si no están, NO falla: avisa y sale, para
   que quien solo quiera correr las pruebas de datos no se encuentre un muro.
       npm install --no-save puppeteer-core

   Levanta su propio servidor: el navegador exige un origen seguro para el
   Service Worker, y localhost cuenta como tal (file:// no).                */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const PUERTO = 8791;

const TIPOS = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.webp':'image/webp', '.svg':'image/svg+xml',
  '.png':'image/png', '.jpeg':'image/jpeg', '.jpg':'image/jpeg', '.woff2':'font/woff2' };

function servidor(){
  return http.createServer((req,res)=>{
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if(rel === '/') rel = '/index.html';
    const f = path.join(RAIZ, rel);
    // Nada fuera del repo, aunque esto solo escuche en localhost.
    if(!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){
      res.writeHead(404); res.end('no'); return;
    }
    res.writeHead(200, {'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream'});
    fs.createReadStream(f).pipe(res);
  });
}

const CHROMES = ['/usr/bin/google-chrome','/usr/bin/google-chrome-stable',
                 '/usr/bin/chromium','/usr/bin/chromium-browser','/snap/bin/chromium'];

let fallos = 0;
const ok = (cond, msg) => { console.log((cond?'  ✅ ':'  ❌ ')+msg); if(!cond) fallos++; };
const esperar = ms => new Promise(r=>setTimeout(r,ms));

/* Deja la app recién estrenada: onboarding hecho y una rutina activa. */
async function appLista(page, url){
  await page.goto(url, {waitUntil:'networkidle2'});
  await esperar(1200);
  await page.type('#ob-name','Prueba');
  await page.evaluate(()=>{ obNext(1); obSelectRoutine(PRESET_ROUTINES[0].id); obNext(2); obFinish(); });
  await esperar(700);
}

(async () => {
  let puppeteer;
  try{
    puppeteer = (await import('puppeteer-core')).default;
  }catch(e){
    console.log('\n⏭  SALTADO: falta puppeteer-core.');
    console.log('   npm install --no-save puppeteer-core\n');
    process.exit(0);
  }
  const chrome = CHROMES.find(p => fs.existsSync(p));
  if(!chrome){
    console.log('\n⏭  SALTADO: no se encontró Chrome ni Chromium.\n');
    process.exit(0);
  }

  const srv = servidor();
  await new Promise(r => srv.listen(PUERTO, '127.0.0.1', r));
  const url = `http://127.0.0.1:${PUERTO}/index.html`;

  const navegador = await puppeteer.launch({
    executablePath: chrome, headless: 'new',
    args: ['--no-sandbox','--disable-dev-shm-usage']
  });

  try{
    const page = await navegador.newPage();
    const errores = [];
    page.on('pageerror', e => errores.push(String(e.message)));
    page.on('console', m => { if(m.type()==='error' && !m.text().includes('404')) errores.push(m.text()); });
    await page.setViewport({width:390, height:840, deviceScaleFactor:2, isMobile:true, hasTouch:true});
    await page.emulateMediaFeatures([{name:'prefers-color-scheme', value:'dark'}]);

    console.log('\n1. Arranque: onboarding y rutina activa');
    await appLista(page, url);
    const arranque = await page.evaluate(()=>({
      backend: STORAGE.backend.name,
      rutina: getActive() && getActive().name,
      pestanas: document.querySelectorAll('.tab').length,
    }));
    ok(arranque.backend === 'local', 'sin sesión iniciada, se guarda en el dispositivo');
    ok(!!arranque.rutina, 'el onboarding deja una rutina activa: '+arranque.rutina);
    ok(arranque.pestanas === 5, 'la barra tiene 5 huecos: 4 pestañas y Ajustes');

    console.log('\n2. El asistente crea la rutina que se le pide');
    const creada = await page.evaluate(()=>{
      openNewRoutinePanel();
      nrSemanas = 4;
      nrCambiarDias(2);
      nrDias[0] = {nombre:'Torso', ex:[{nombre:'Press banca', esquema:'4×10'},
                                       {nombre:'Remo mancuerna', esquema:'4×12'}]};
      nrDias[1] = {nombre:'Pierna', ex:[{nombre:'Sentadilla', esquema:'5×5'}]};
      nrNombre = 'Rutina de prueba';
      nrPaso = 4; nrPintarPaso();
      document.getElementById('nr-name').value = 'Rutina de prueba';
      createNewRoutine();
      const r = DB.routines[DB.routines.length-1];
      return {
        nombre: r.name,
        semanas: r.plan.length,
        diasPorSemana: r.plan[0].days.length,
        total: r.plan.reduce((a,w)=>a+w.days.length,0),
        sUnicos: new Set(r.plan.flatMap(w=>w.days.map(d=>d.s))).size,
        primerDia: r.plan[0].days[0].name,
        segundaSemana: r.plan[1].days[0].name,
        ejercicios: r.plan[0].days[0].ex,
      };
    });
    ok(creada.nombre === 'Rutina de prueba', 'se llama como se pidió');
    ok(creada.semanas === 4 && creada.diasPorSemana === 2, '4 semanas × 2 días');
    ok(creada.total === 8, 'son 8 sesiones en total');
    ok(creada.sUnicos === 8, 'y ninguna comparte identificador con otra');
    ok(creada.primerDia === 'S1 · Torso', 'el nombre del día lleva su número: '+creada.primerDia);
    ok(creada.segundaSemana === 'S3 · Torso', 'la numeración es global, no por semana: '+creada.segundaSemana);
    ok(creada.ejercicios.length === 2 && creada.ejercicios[0][1] === '4×10',
       'los ejercicios van con su esquema de series');

    console.log('\n3. El detalle del ejercicio enseña la foto de su músculo');
    await page.evaluate(()=>{
      const r = getActive();
      showTab('log', document.getElementById('tab-log'));
      openWeekDetail(1); openSession(r.plan[0].days[0].s); openExDetail(0);
    });
    await esperar(900);
    const foto = await page.evaluate(()=>{
      const img = document.querySelector('#ex-musculos img');
      return img ? {src: img.getAttribute('src'), cargada: img.complete && img.naturalWidth>0,
                    pie: document.querySelector('#ex-musculos figcaption').innerText} : null;
    });
    ok(!!foto, 'hay imagen en el detalle del ejercicio');
    ok(foto && foto.src.includes('img/musculos/'), 'es una foto de músculo, no la silueta de reserva');
    ok(foto && foto.cargada, 'y carga de verdad (no es un enlace roto)');
    ok(foto && /Principal:/.test(foto.pie), 'con el texto de qué músculo trabaja');

    console.log('\n4. Reordenar los ejercicios arrastrando');
    await page.evaluate(()=>closeExDetail());
    await esperar(400);
    const arrastre = await page.evaluate(async ()=>{
      const g = document.getElementById('ex-mosaico');
      const antes = curEx.map(e=>e.name);
      const origen = g.children[3], destino = g.children[0];
      const c1 = origen.getBoundingClientRect(), c2 = destino.getBoundingClientRect();
      origen.setPointerCapture = ()=>{};
      const ev = (el,t,x,y)=>el.dispatchEvent(new PointerEvent(t,{bubbles:true,clientX:x,clientY:y,pointerId:1}));
      ev(origen,'pointerdown', c1.x+30, c1.y+30);
      await new Promise(r=>setTimeout(r,420));          // la pulsación larga
      const enganchada = origen.classList.contains('arrastrando');
      ev(g,'pointermove', c2.x+30, c2.y+8);
      ev(g,'pointerup',   c2.x+30, c2.y+8);
      await new Promise(r=>setTimeout(r,120));
      return {enganchada, antes, despues: curEx.map(e=>e.name)};
    });
    ok(arrastre.enganchada, 'la pulsación larga engancha la tarjeta');
    ok(arrastre.despues.length === arrastre.antes.length,
       'no se duplica ni se pierde ningún ejercicio al soltar');
    ok(arrastre.despues[0] === arrastre.antes[3],
       'el que se arrastró queda el primero: '+arrastre.despues[0]);
    ok(new Set(arrastre.despues).size === arrastre.despues.length, 'y no hay repetidos');

    console.log('\n5. Registrar una sesión se celebra; corregirla, no');
    const guardado = await page.evaluate(async ()=>{
      curEx[0].sets[0].kg = '60'; curEx[0].sets[0].reps = '10';
      const n = curSession;
      saveSession();
      await new Promise(r=>setTimeout(r,350));
      const capa = document.getElementById('celebracion');
      const ses = getActive().sessions[n];
      return {registrada: !!ses, kg: ses && ses.exercises[0].sets[0].kg,
              celebra: !capa.classList.contains('hidden'),
              titulo: document.getElementById('cel-tit').textContent,
              sub: document.getElementById('cel-sub').textContent,
              fondoQuieto: document.body.classList.contains('capa-abierta')};
    });
    ok(guardado.registrada, 'la sesión queda registrada');
    ok(guardado.kg === '60', 'con los kilos que se apuntaron');
    ok(guardado.celebra, 'y se celebra al terminarla');
    ok(/completada|terminado/i.test(guardado.titulo), 'con su titular: '+guardado.titulo);
    ok(/\d+ de \d+ sesiones/.test(guardado.sub), 'y por dónde vas: '+guardado.sub);
    ok(guardado.fondoQuieto, 'el fondo no hace scroll mientras está abierta');

    /* Reabrir una sesión ya registrada para corregir un peso NO vuelve a
       celebrarla: ahí lo que hace falta es el aviso de siempre. */
    const corregida = await page.evaluate(async ()=>{
      cerrarCelebracion();
      const r = getActive();
      openSession(r.plan[0].days[0].s);
      saveSession();
      await new Promise(r=>setTimeout(r,250));
      const a = document.getElementById('aviso-flotante');
      return {celebra: !document.getElementById('celebracion').classList.contains('hidden'),
              texto: a.textContent, visible: a.className.includes('visible')};
    });
    ok(!corregida.celebra, 'corregirla no la vuelve a celebrar');
    ok(corregida.visible && /guardada/i.test(corregida.texto),
       'y avisa con el mensaje propio de la app');

    /* Completar un reto usa la MISMA capa que la sesión. Se llama a mano porque
       el disparo real vive en el módulo y necesita sesión de Firebase. */
    const celReto = await page.evaluate(async ()=>{
      celebrarReto({titulo:'Sube un 15% en cada ejercicio', porcentaje:15, total:5, pctAntes:60});
      await new Promise(r=>setTimeout(r,300));
      const capa = document.getElementById('celebracion');
      const r = {abierta: !capa.classList.contains('hidden'),
                 titulo: document.getElementById('cel-tit').textContent,
                 sub: document.getElementById('cel-sub').textContent,
                 lineas: document.getElementById('cel-lineas').innerText.replace(/\s+/g,' ').trim(),
                 fondoQuieto: document.body.classList.contains('capa-abierta'),
                 aro: document.getElementById('cel-aro').getAttribute('stroke-dashoffset')};
      cerrarCelebracion();
      return r;
    });
    ok(celReto.abierta && /Reto completado/.test(celReto.titulo),
       'completar un reto se celebra: '+celReto.titulo);
    ok(/15%/.test(celReto.sub), 'con el reto que era: '+celReto.sub);
    ok(/5 ejercicios/.test(celReto.lineas) && /5\/5/.test(celReto.lineas),
       'y lo que se ha conseguido: '+celReto.lineas);
    ok(celReto.aro === '0', 'el aro se cierra entero (el reto está al 100%)');
    ok(celReto.fondoQuieto, 'el fondo no hace scroll mientras está abierta');

    console.log('\n6. Una protagonista por pantalla');
    /* Registrar: la semana en curso, con el trato de "Entrenamiento de hoy" pero
       EN SU SITIO dentro de la lista (23/09/2026). Se vuelve a la lista de
       semanas primero: la sección anterior deja abierta una sesión. */
    const prota = await page.evaluate(()=>{
      closeForm(); closeWeekDetail();
      showTab('log', document.getElementById('tab-log'));
      const hero = document.querySelector('#week-buttons-container .hoy');
      return {
        hay: !!hero,
        titulo: hero ? hero.querySelector('.hoy-tit').textContent : '',
        cta: hero ? hero.querySelector('.hoy-cta').textContent.trim() : '',
        curso: getCurrentWeekNum(),
        mosaico: [...document.querySelectorAll('#week-buttons-container .mos-num')]
                   .map(e=>e.textContent.trim()),
        /* La lista entera, en orden y sin huecos: la semana destacada es una
           celda más. Varias personas se saltaban la de arriba y contaban una
           semana menos de las que tienen. */
        lista: [...document.querySelector('#week-buttons-container .mos-grid').children]
                 .map(h=>parseInt((h.querySelector('.mos-num')||h.querySelector('.hoy-tit'))
                       .textContent.replace(/\D+/,''), 10)),
        semanas: getActivePlan().map(w=>w.num),
        filaEntera: hero ? getComputedStyle(hero).gridColumn : '',
        dentroDeLaLista: !!(hero && hero.parentElement.classList.contains('mos-grid')),
        puntos: hero ? hero.querySelectorAll('.sem-punto').length : 0,
        hechos: hero ? hero.querySelectorAll('.sem-punto.hecha').length : 0,
        // Lo que dice el plan, para comparar con lo que se ve.
        dias: (getActivePlan().find(w=>w.num===getCurrentWeekNum()).days||[]).length,
        registradas: (getActivePlan().find(w=>w.num===getCurrentWeekNum()).days||[])
                       .filter(d=>getActiveSessions()[d.s]).length,
      };
    });
    ok(prota.hay, 'Registrar abre con la semana en curso en grande');
    ok(prota.titulo.includes('Semana '+prota.curso), 'y es la semana en curso: '+prota.titulo);
    ok(prota.dentroDeLaLista && prota.filaEntera === '1 / -1',
       '🔴 y va DENTRO de la lista, ocupando la fila entera');
    ok(prota.lista.join(',') === prota.semanas.join(','),
       '🔴 la lista las tiene todas y en orden, sin saltarse la destacada: '+prota.lista.join(', '));
    ok(prota.lista.indexOf(prota.curso) === prota.semanas.indexOf(prota.curso),
       'la semana en curso está en su sitio, no arriba del todo');
    ok(prota.puntos === prota.dias && prota.hechos === prota.registradas && prota.hechos > 0,
       'una marca por sesión, encendidas las hechas ('+prota.hechos+'/'+prota.puntos+')');
    ok(/Continuar/.test(prota.cta), 'y el botón nombra la sesión que toca: '+prota.cta);

    /* Lleva a la sesión pendiente, pero PASANDO por su semana: si no fijara
       curWeekNum, el "← Sesiones" de dentro volvería a otra. */
    const salto = await page.evaluate(()=>{
      document.querySelector('#week-buttons-container .hoy').click();
      return {form: document.getElementById('session-form').style.display,
              titulo: document.getElementById('form-title').textContent,
              semana: curWeekNum};
    });
    ok(salto.form === 'block', 'al tocarla se abre la sesión pendiente: '+salto.titulo);
    ok(salto.semana === prota.curso, 'y entra por su semana, no por la que se mirase antes');

    // Resumen: la racha, que era una de seis cifras iguales de 24 px.
    const resumen = await page.evaluate(()=>{
      closeForm(); closeWeekDetail();
      showTab('resumen', document.getElementById('tab-resumen'));
      const r = document.querySelector('#resumen-content .hoy-racha');
      return {hay: !!r,
              num: r ? r.querySelector('.racha-num').textContent : '',
              apagada: r ? r.classList.contains('vacio') : null,
              celdas: r ? r.querySelectorAll('.racha-dia').length : 0,
              hoy: r ? r.querySelectorAll('.racha-dia.es-hoy').length : 0,
              hechos: r ? r.querySelectorAll('.racha-dia.hecho').length : 0,
              cifras: [...document.querySelectorAll('#resumen-content .stat-lbl')]
                        .map(e=>e.textContent)};
    });
    ok(resumen.hay, 'Resumen abre con la racha en grande');
    ok(resumen.num === '1' && !resumen.apagada,
       'encendida y contando el día de hoy, que es cuando se registró: '+resumen.num);
    ok(resumen.celdas === 14 && resumen.hoy === 1,
       'con los últimos 14 días y hoy marcado');
    ok(resumen.hechos === 1, 'y solo el día entrenado encendido');
    ok(!resumen.cifras.some(t=>/racha/i.test(t)),
       'la racha ya no es una cifra más de la rejilla: '+resumen.cifras.join(', '));
    ok(resumen.cifras.length === 4, 'que se queda en cuatro');

    console.log('\n7. Solo se etiqueta lo que ha pasado, y el avatar es tuyo');
    const etiquetas = await page.evaluate(()=>{
      showTab('log', document.getElementById('tab-log'));
      const semanas = [...document.querySelectorAll('#week-buttons-container .mos-badge')]
                        .map(e=>e.textContent.trim());
      openWeekDetail(getCurrentWeekNum());
      const sesiones = [...document.querySelectorAll('#session-list .mos-badge')]
                         .map(e=>e.textContent.trim());
      const av = document.getElementById('profile-pic');
      return {semanas, sesiones,
              hechas: document.querySelectorAll('#session-list .mos-card.lista').length,
              avatar: av.textContent.trim(), sinFoto: av.classList.contains('sin-foto'),
              nombre: DB.profileName,
              /* El otro sitio donde vivía la silueta: el avatar del onboarding,
                 donde todavía no hay nombre que inicialar. Ahora es un icono de
                 trazo. Se mira el elemento y no el código fuente: en el fuente
                 el emoji sigue estando, en los comentarios que explican esto. */
              obIcono: !!document.querySelector('#ob-avatar svg'),
              obTexto: document.getElementById('ob-avatar').textContent.trim()};
    });
    ok(!etiquetas.semanas.some(t=>/Pendiente/.test(t)),
       'el mosaico de semanas ya no repite "Pendiente": '+(etiquetas.semanas.join(', ')||'(sin etiquetas)'));
    ok(!etiquetas.sesiones.some(t=>/Pendiente/.test(t)),
       'ni el de sesiones: '+(etiquetas.sesiones.join(', ')||'(sin etiquetas)'));
    ok(etiquetas.sesiones.length === etiquetas.hechas && etiquetas.hechas > 0,
       'una etiqueta por sesión hecha y ninguna más ('+etiquetas.hechas+')');
    ok(etiquetas.sinFoto && etiquetas.avatar === etiquetas.nombre[0],
       'sin foto, el avatar son las iniciales del nombre: '+etiquetas.avatar);
    ok(etiquetas.obIcono && etiquetas.obTexto === '',
       'y el avatar del onboarding es un icono de trazo, no la silueta 👤');

    /* Ningún botón de la interfaz lleva ya un emoji de color: los pinta cada
       sistema a su manera y en Android rompen la paleta. La escala de sensación
       (😴 😐 💪 🔥) se queda a propósito —es contenido, no un control— y por eso
       no está en la lista. */
    const conEmoji = await page.evaluate(()=>{
      const prohibidos = /[\u{1F4BE}\u{1F4C2}\u{1F4CB}\u{1F9F9}\u{1F5D1}\u{23F1}\u{1F3C3}\u{1F4DD}\u{1F50D}\u{1F4F7}\u{1F4DA}\u{2601}\u{2699}\u{270E}\u{29C9}\u{1F464}]/u;
      return [...document.querySelectorAll('button, label.btn-sm')]
        .map(b=>b.textContent.replace(/\s+/g,' ').trim())
        .filter(t=>prohibidos.test(t));
    });
    ok(conEmoji.length === 0, conEmoji.length
        ? 'quedan botones con emoji: '+conEmoji.join(' | ')
        : 'ningún botón de la interfaz lleva ya un emoji de color');


    console.log('\n8. El RIR: casilla en la serie y segunda línea en la gráfica');
    const rir = await page.evaluate(()=>{
      alternarRIR(true);
      const r = getActive();
      showTab('log', document.getElementById('tab-log'));
      openWeekDetail(1); openSession(r.plan[0].days[0].s); openExDetail(0);
      const casilla = document.querySelector('#sets-container input[placeholder="RIR"]');
      // La gráfica se arma aparte: hacen falta dos sesiones y aquí solo hay una.
      const puntos = [{s:1,kg:60,rir:2,fecha:'1/9/2026'},
                      {s:2,kg:60,rir:null,fecha:'3/9/2026'},
                      {s:3,kg:60,rir:4,fecha:'5/9/2026'}];
      const con = graficaCargas(puntos, 'kg máx. por sesión');
      const sin = graficaCargas(puntos.map(p=>({...p, rir:null})), 'kg máx. por sesión');
      return {casilla: !!casilla,
              hayRir: con.hayRir, series: con.data.datasets.length,
              ejeDerecho: !!con.options.scales.y2,
              leyenda: con.options.plugins.legend.display,
              huecos: con.data.datasets[1].spanGaps,
              sinRir: sin.hayRir, seriesSinRir: sin.data.datasets.length,
              ejeSinRir: !!sin.options.scales.y2};
    });
    ok(rir.casilla, 'con la casilla activada, cada serie pide su RIR');
    ok(rir.hayRir && rir.series === 2 && rir.ejeDerecho,
       'la gráfica añade la línea de RIR con su eje a la derecha');
    ok(rir.leyenda === true, 'y enciende la leyenda, que con dos líneas hace falta');
    ok(rir.huecos === true, 'una sesión sin RIR no parte la línea');
    ok(!rir.sinRir && rir.seriesSinRir === 1 && !rir.ejeSinRir,
       'quien no apunta RIR ve la gráfica de siempre, sin segundo eje');
    await page.evaluate(()=>{ alternarRIR(false); closeExDetail(); closeForm(); closeWeekDetail(); });

    console.log('\n9. Al abrir una sesión se precargan los kilos de la última vez');
    const precarga = await page.evaluate(async ()=>{
      const r = getActive();
      /* La sesión de la sección 5 quedó registrada con 60 kg. Le cambiamos el
         nombre al ejercicio, que es lo que pasa de verdad: se escribe a mano
         cada vez y sale "con mancuernas" donde antes ponía "mancuernas". */
      const ses = r.sessions[r.plan[0].days[0].s];
      const original = ses.exercises[0].name;
      ses.exercises[0].name = 'Press banca con mancuernas';
      await save();
      const dia = r.plan[1].days[0];               // la siguiente del mismo tipo
      openWeekDetail(2); openSession(dia.s);
      return {original, plan: dia.ex[0][0], tipo: dia.type,
              kg: curEx[0].sets[0].kg, reps: curEx[0].sets[0].reps};
    });
    ok(precarga.tipo === 'Upper', 'la siguiente sesión del mismo tipo es una Upper');
    ok(precarga.kg === '60',
       `precarga los 60 kg pese a llamarse "${precarga.plan}" en el plan y `+
       `"Press banca con mancuernas" en lo registrado`);
    ok(precarga.reps === '', 'las repeticiones NO se precargan: eso es lo que vas a hacer hoy');
    await page.evaluate(()=>{ closeForm(); closeWeekDetail(); });

    console.log('\n10. La foto de un cliente se abre en grande');
    /* La lista de clientes la pinta el módulo de Firebase y necesita sesión de
       entrenador, así que aquí se prueba la pieza que usa: avatarPersona() y el
       visor compartido. */
    const visor = await page.evaluate(()=>{
      const px='data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
      const host=document.createElement('div');
      host.innerHTML = avatarPersona(px,'Ana Pérez') + avatarPersona(null,'Luis Gómez');
      document.body.appendChild(host);
      const boton = host.querySelector('.cliente-avatar-btn');
      const iniciales = host.querySelector('.cliente-avatar.sin-foto');
      boton.click();
      const capa = document.getElementById('visor-foto');
      const img  = document.querySelector('#visor-foto-cuerpo img');
      const pie  = document.querySelector('#visor-foto .visor-pie');
      const r = {
        abre: !capa.classList.contains('hidden'),
        misma: !!img && img.getAttribute('src') === px,
        alt: img ? img.alt : '',
        pieOculto: pie.style.display === 'none',
        inicialesNoPulsables: !!iniciales && iniciales.tagName !== 'BUTTON'
                              && !iniciales.closest('.cliente-avatar-btn'),
      };
      cerrarVisorFoto();
      // La tuya sí lleva "Cambiar foto": el pie tiene que volver.
      const antes = DB.profilePic;
      DB.profilePic = px;
      abrirVisorFoto();
      r.pieVuelve = pie.style.display !== 'none';
      cerrarVisorFoto();
      DB.profilePic = antes;
      host.remove();
      return r;
    });
    ok(visor.abre, 'tocar la miniatura de un cliente abre el visor');
    ok(visor.misma, 'con esa misma foto, no con otra');
    ok(/Ana Pérez/.test(visor.alt), 'y el alt dice de quién es: '+visor.alt);
    ok(visor.pieOculto, 'sin "Cambiar foto": la foto de un cliente no es tuya');
    ok(visor.pieVuelve, 'pero al abrir la tuya el botón de cambiarla vuelve');
    ok(visor.inicialesNoPulsables, 'quien no tiene foto no tiene nada que ampliar');

    /* En el MOSAICO la foto no se amplía: ahí la celda entera abre la ficha, y
       dos destinos en el mismo sitio se pelean. La celda es un <button> sin
       botones dentro, así que un toque en cualquier parte vale. */
    const tarjeta = await page.evaluate(()=>{
      const px='data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
      const enLista = avatarPersona(px,'Ana Pérez',{ampliable:false});
      const host=document.createElement('div');
      host.innerHTML=`<div class="mos-grid clientes"><button type="button" class="mos-card cliente-card"
          data-uid="u1" data-nombre="Ana Pérez" data-activa="r1"
          onclick="verDetalleCliente(this.dataset.uid,this.dataset.nombre,this.dataset.activa)">
          ${enLista}
          <div class="cliente-card-nombre">Ana Pérez</div>
          <div class="cliente-card-meta" id="cliente-prog-u1">Definición</div>
        </button></div>`;
      document.body.appendChild(host);
      const llamadas=[];
      const original=window.verDetalleCliente;
      window.verDetalleCliente=(...a)=>llamadas.push(a);
      host.querySelector('.cliente-card-nombre').click();   // tocar donde sea: abre
      const trasNombre=llamadas.length;
      window.verDetalleCliente=original;
      const celda=host.querySelector('.cliente-card');
      const r={sinBoton: !/<button/.test(enLista), trasNombre, args: llamadas[0]||[],
               sinBotonesDentro: celda.querySelectorAll('button').length === 0,
               columnas: getComputedStyle(host.querySelector('.mos-grid'))
                           .gridTemplateColumns.split(' ').length};
      host.remove();
      return r;
    });
    ok(tarjeta.sinBoton, 'en el mosaico la miniatura ya no es un botón que amplía');
    ok(tarjeta.trasNombre === 1, 'tocar la celda abre la ficha del cliente');
    ok(tarjeta.args[0] === 'u1' && tarjeta.args[1] === 'Ana Pérez' && tarjeta.args[2] === 'r1',
       'con su uid, su nombre y su rutina activa');
    ok(tarjeta.sinBotonesDentro,
       'y no lleva botones dentro: asignar y desvincular se fueron a la ficha');
    ok(tarjeta.columnas >= 2, 'el mosaico entra a dos por fila en 390 px: '+tarjeta.columnas);

    /* Asignar rutina se abre COMO CAPA por encima de la ficha, no como una
       tarjeta al final de la pantalla de clientes: si no, abrirlo desde la
       ficha obliga a cerrarla y lo primero que ves es el mosaico entero. */
    const capa = await page.evaluate(async ()=>{
      abrirAsignar('u1','Ana Pérez');
      await new Promise(r=>setTimeout(r,60));      // el MutationObserver del fondo
      const p = document.getElementById('asignar-panel');
      const est = getComputedStyle(p);
      const r = {pos: est.position, z: +est.zIndex,
                 zFicha: +getComputedStyle(document.getElementById('cliente-detalle')).zIndex,
                 abierta: !p.classList.contains('hidden'),
                 fondoQuieto: document.body.classList.contains('capa-abierta'),
                 presets: document.querySelectorAll('#asignar-presets .preset-op').length};
      cerrarAsignar();
      await new Promise(r=>setTimeout(r,60));
      r.cerrada = p.classList.contains('hidden');
      r.fondoSuelto = !document.body.classList.contains('capa-abierta');
      return r;
    });
    ok(capa.abierta && capa.pos === 'fixed', 'asignar rutina se abre a pantalla completa');
    ok(capa.z > capa.zFicha, `por encima de la ficha del cliente (${capa.z} > ${capa.zFicha})`);
    ok(capa.presets > 0, 'con las rutinas para elegir: '+capa.presets);
    ok(capa.fondoQuieto, 'y el fondo no hace scroll mientras está abierta');
    ok(capa.cerrada && capa.fondoSuelto, 'al cerrarla, el fondo vuelve a moverse');

    /* Crear la rutina del cliente desde "Asignar" (13/09/2026): el mismo
       asistente que "Mis rutinas", pero lo creado va al cliente y NO a las
       rutinas del entrenador. La escritura final en Firestore no se prueba aquí
       (sin sesión): es la misma que con una prehecha. */
    const crear = await page.evaluate(async ()=>{
      const visible = id => !document.getElementById(id).classList.contains('hidden');
      const elegida = () => (document.querySelector('#asignar-presets .preset-op.elegida .preset-op-name')||{}).textContent;
      const misRutinas = DB.routines.length;
      const r = {};
      abrirAsignar('u1','Ana Pérez');
      const boton = document.querySelector('#asignar-presets .preset-crear');
      r.hayBoton = !!boton;
      if(!boton) return r;
      boton.click();
      r.asignarApartado = !visible('asignar-panel');
      r.asistenteAbierto = visible('new-routine-panel');
      nrCambiarDias(1);
      nrDias[0] = {nombre:'Torso', ex:[{nombre:'Press banca', esquema:'4×10'}]};
      nrSemanas = 2;
      nrPaso = 4; nrPintarPaso();
      r.botonFinal = document.getElementById('nr-siguiente').textContent;
      document.getElementById('nr-name').value = 'Plan de Ana';
      nrSiguiente();
      r.asistenteCerrado = !visible('new-routine-panel');
      r.asignarVuelve = visible('asignar-panel');
      r.nombre = document.getElementById('asignar-nombre-rutina').value;
      r.elegida = elegida();
      r.meta = (document.querySelector('#asignar-presets .preset-creada .preset-op-meta')||{}).textContent;
      r.misRutinasIntactas = DB.routines.length === misRutinas;
      // Abrir el asistente otra vez y cerrarlo sin terminar: vuelve a Asignar y no pierde la creada.
      document.querySelector('#asignar-presets .preset-crear').click();
      closeNewRoutinePanel();
      r.cerrarDevuelve = visible('asignar-panel');
      r.sigueElegida = elegida();
      cerrarAsignar();
      // Y "Mis rutinas" sigue siendo lo de siempre.
      openNewRoutinePanel();
      nrPaso = 4; nrPintarPaso();
      r.botonNormal = document.getElementById('nr-siguiente').textContent;
      closeNewRoutinePanel();
      r.asignarSigueCerrado = !visible('asignar-panel');
      // Otro cliente no hereda la rutina creada para Ana.
      abrirAsignar('u2','Luis');
      r.otroSinCreada = !document.querySelector('#asignar-presets .preset-creada');
      cerrarAsignar();
      return r;
    });
    ok(crear.hayBoton, 'asignar ofrece «+ Crear una rutina nueva»');
    ok(crear.asignarApartado && crear.asistenteAbierto, 'que abre el mismo asistente de «Mis rutinas»');
    ok(crear.botonFinal === '✓ Usar esta rutina', 'y al final dice «Usar esta rutina»: '+crear.botonFinal);
    ok(crear.asistenteCerrado && crear.asignarVuelve, 'al terminar se vuelve a Asignar');
    ok(crear.elegida === 'Plan de Ana' && crear.nombre === 'Plan de Ana',
       'con la rutina creada ya elegida y su nombre puesto');
    ok(/2 sesiones · 2 semanas · 1 días\/semana/.test(crear.meta||''), 'y su resumen: '+crear.meta);
    ok(crear.misRutinasIntactas, '🔴 la rutina del cliente NO se mete en las rutinas del entrenador');
    ok(crear.cerrarDevuelve && crear.sigueElegida === 'Plan de Ana',
       'cerrar el asistente sin terminar devuelve a Asignar sin perder lo creado');
    ok(crear.botonNormal === '✓ Crear rutina' && crear.asignarSigueCerrado,
       '«Mis rutinas» sigue creando para uno mismo, sin abrir Asignar');
    ok(crear.otroSinCreada, 'otro cliente no hereda la rutina creada para el anterior');

    console.log('\n11. El botón de instalar la app');
    /* Un cliente abrió el enlace desde el navegador de WhatsApp y no encontró
       cómo instalarla. Chrome avisa con `beforeinstallprompt` cuando se puede;
       aquí se falsifica ese aviso para comprobar la cadena entera. */
    const instalar = await page.evaluate(async ()=>{
      const aviso = document.getElementById('instalar-aviso');
      let lanzado = false;
      const ev = new Event('beforeinstallprompt');
      ev.prompt = () => { lanzado = true; return Promise.resolve(); };
      ev.userChoice = Promise.resolve({outcome:'accepted'});
      window.dispatchEvent(ev);
      const visible = !aviso.classList.contains('hidden');
      const texto = aviso.innerText.replace(/\s+/g,' ').trim();
      aviso.querySelector('button').click();          // "Instalar la app"
      await new Promise(r=>setTimeout(r,60));
      const trasInstalar = !aviso.classList.contains('hidden');
      // Y "ahora no" lo calla en Inicio, pero en Ajustes sigue disponible.
      window.dispatchEvent(Object.assign(new Event('beforeinstallprompt'),
        {prompt(){}, userChoice: Promise.resolve({})}));
      ocultarInstalar();
      const r = {visible, texto, lanzado, trasInstalar,
                 descartadoEnInicio: aviso.classList.contains('hidden'),
                 sigueEnAjustes: !document.getElementById('instalar-ajustes').classList.contains('hidden'),
                 guardado: localStorage.getItem('jhon_instalar_v1')};
      /* Una vez instalada no hay nada que ofrecer: el aviso desaparece de los
         dos sitios y se olvida el "ahora no", que ya no significa nada. */
      window.dispatchEvent(new Event('appinstalled'));
      r.trasInstalada = aviso.classList.contains('hidden')
        && document.getElementById('instalar-ajustes').classList.contains('hidden');
      r.olvidado = localStorage.getItem('jhon_instalar_v1') === null;
      return r;
    });
    ok(instalar.visible, 'cuando el navegador dice que se puede, sale el aviso');
    ok(/Instalar la app/.test(instalar.texto), 'con su botón: '+instalar.texto.slice(0,60)+'...');
    ok(instalar.lanzado, 'y pulsarlo abre el diálogo del sistema');
    ok(!instalar.trasInstalar, 'el aviso se retira: el evento solo vale una vez');
    ok(instalar.descartadoEnInicio && instalar.guardado === 'no',
       '"Ahora no" lo calla en Inicio y se recuerda en el dispositivo');
    ok(instalar.sigueEnAjustes, 'pero en Ajustes sigue estando, que es donde se busca luego');
    ok(instalar.trasInstalada, 'y una vez instalada no se ofrece en ningún sitio');
    ok(instalar.olvidado, 'olvidando el "ahora no", que ya no significa nada');

    console.log('\n12. Sin cobertura: la app sigue abriendo');
    await page.evaluate(async ()=>{ await navigator.serviceWorker.ready; });
    await esperar(2500);                                  // que termine de precargar
    await page.setOfflineMode(true);
    await page.reload({waitUntil:'domcontentloaded'});
    await esperar(2000);
    const offline = await page.evaluate(()=>{
      const r = getActive();
      return {rutina: r && r.name, semanas: r && r.plan.length,
              pestanas: document.querySelectorAll('.tab').length};
    });
    ok(!!offline.rutina, 'abre y encuentra la rutina: '+offline.rutina);
    ok(offline.pestanas === 5, 'la interfaz está entera');
    await page.evaluate(()=>{
      const r = getActive();
      showTab('log', document.getElementById('tab-log'));
      openWeekDetail(1); openSession(r.plan[0].days[0].s); openExDetail(0);
    });
    await esperar(1000);
    const fotoOffline = await page.evaluate(()=>{
      const i = document.querySelector('#ex-musculos img');
      return i ? i.complete && i.naturalWidth>0 : false;
    });
    ok(fotoOffline, 'y las fotos de músculo se ven sin red');
    /* La fuente de las cifras está alojada en el repo justamente para esto: sin
       red tiene que salir del caché del Service Worker. Si un día se enlaza a
       Google Fonts en vez de servirla, esta comprobación se cae. */
    const fuenteOffline = await page.evaluate(async ()=>{
      await document.fonts.ready;
      return document.fonts.check('600 24px Cifras');
    });
    ok(fuenteOffline, 'y las cifras siguen en su fuente, no en la del sistema');
    await page.setOfflineMode(false);

    console.log('\n13. "Ya tengo cuenta" desde el onboarding');
    /* Va al final a propósito: vacía el almacenamiento para simular un móvil
       recién estrenado, que es donde aparece el problema. */
    await page.evaluate(()=>localStorage.clear());
    await page.reload({waitUntil:'networkidle2'});
    await esperar(1600);
    const entrar = await page.evaluate(()=>{
      const ob = document.getElementById('onboarding');
      const panel = document.getElementById('auth-panel');
      const r = {onboardingAlArrancar: !ob.classList.contains('hidden'),
                 hayEnlace: !!document.querySelector('.ob-enlace')};
      if(!r.hayEnlace) return r;
      document.querySelector('.ob-enlace').click();
      r.onboardingApartado = ob.classList.contains('hidden');
      r.panelAbierto = !panel.classList.contains('hidden');
      r.pestanaLogin = document.getElementById('tab-login').classList.contains('active');
      toggleAuthPanel();                    // cerrar sin haber iniciado sesión
      r.onboardingVuelve = !ob.classList.contains('hidden');
      return r;
    });
    ok(entrar.onboardingAlArrancar, 'un dispositivo sin datos arranca en el onboarding');
    ok(entrar.hayEnlace, 'que ofrece entrar con una cuenta ya existente');
    ok(entrar.onboardingApartado && entrar.panelAbierto,
       'al pulsarlo se aparta y se abre el panel de cuenta');
    ok(entrar.pestanaLogin, 'en la pestaña de iniciar sesión, no en la de registro');
    ok(entrar.onboardingVuelve,
       'y si se cierra sin entrar, vuelve el onboarding: si no, la app quedaría vacía y sin salida');

    console.log('\n13b. La indicación del entrenador llega hasta el ejercicio');
    /* Lo que se comprueba es el CAMINO entero: una nota puesta en el plan
       (que es lo que escribe el entrenador en la ficha de su cliente) tiene
       que salir en la pantalla donde el cliente está a punto de levantar el
       peso. Es el sitio donde se rompería sin avisar: openSession construye
       curEx desde cero y la nota no viaja dentro. */
    await page.evaluate(()=>localStorage.clear());
    await page.reload({waitUntil:'networkidle2'});
    await esperar(1600);
    await page.type('#ob-name','Prueba');
    await page.evaluate(()=>{ obNext(1); obSelectRoutine(PRESET_ROUTINES[0].id); obNext(2); obFinish(); });
    await esperar(700);

    const ind = await page.evaluate(()=>{
      const r = getActive();
      const dia = r.plan[0].days[0];
      const nombre = Array.isArray(dia.ex[0]) ? dia.ex[0][0] : dia.ex[0].name;
      const segundo = Array.isArray(dia.ex[1]) ? dia.ex[1][0] : dia.ex[1].name;
      dia.ex[0] = [nombre, '4×15', 'Multiserie: 10 con 40, 6 con 32, 4 con 25'];
      save();
      openSession(dia.s);
      const res = { nombre, segundo };
      // En el mosaico: un punto SOLO en el que lleva indicación.
      const tarjetas = [...document.querySelectorAll('#ex-mosaico .mos-card')];
      res.puntos = tarjetas.filter(t => t.querySelector('.mos-nota-punto')).length;
      res.tarjetas = tarjetas.length;
      // Al abrir el ejercicio, la indicación se lee entera.
      exToque(0);
      const el = document.querySelector('.ex-nota-coach');
      res.visible = !!el;
      res.texto = el ? el.textContent : '';
      // Y el ejercicio de al lado, que no tiene nota, no la hereda.
      exToque(1);
      res.sinNota = !document.querySelector('.ex-nota-coach');
      return res;
    });
    ok(ind.visible, 'la indicación aparece al abrir el ejercicio');
    ok(/10 con 40, 6 con 32, 4 con 25/.test(ind.texto),
       'y se lee entera, con los kilos de cada serie');
    ok(/Tu entrenador/i.test(ind.texto), 'dice de quién viene');
    ok(ind.puntos === 1 && ind.tarjetas > 1,
       `en el mosaico se marca solo el ejercicio que la tiene (${ind.puntos} de ${ind.tarjetas})`);
    ok(ind.sinNota, 'el ejercicio de al lado NO hereda la indicación del anterior');

    console.log('\n13c. Llegar con un código de alta de entrenador');
    /* El alta de entrenadores es la puerta para vender la app a otros coaches:
       si el enlace no abre el formulario correcto, no hay negocio. Esto no
       necesita Firebase, solo que la página reaccione al ?alta= de la URL. */
    await page.evaluate(()=>localStorage.clear());
    await page.goto(url + '?alta=codigodeprueba', {waitUntil:'networkidle2'});
    await esperar(1800);
    const alta = await page.evaluate(()=>({
      panelAbierto: !document.getElementById('auth-panel').classList.contains('hidden'),
      pestanaRegistro: document.getElementById('tab-register').classList.contains('active'),
      rol: document.getElementById('auth-role').value,
      rolOculto: document.getElementById('fila-rol').classList.contains('hidden'),
      extraVisible: !document.getElementById('alta-extra').classList.contains('hidden'),
      hayGimnasio: !!document.getElementById('alta-gimnasio'),
      hayTelefono: !!document.getElementById('alta-telefono'),
      hayFoto: !!document.getElementById('alta-photo-input'),
      aviso: (document.getElementById('aviso-invitacion').textContent||'').trim(),
      onboardingOculto: document.getElementById('onboarding').classList.contains('hidden'),
    }));
    ok(alta.panelAbierto, 'el enlace abre solo el panel de cuenta');
    /* El onboarding tiene z-index 500 y el panel 300: si se pinta, tapa el
       formulario y el entrenador ve "Bienvenido a My Fitness Tracker" en vez
       de su alta. Pasó de verdad, y las clases no lo delataban: hizo falta una
       captura para verlo. */
    ok(alta.onboardingOculto, '🔴 y el onboarding NO lo tapa (z-index 500 contra 300)');
    ok(alta.pestanaRegistro, 'en la pestaña de registro, no en la de iniciar sesión');
    ok(alta.rol === 'trainer' && alta.rolOculto,
       'el rol queda fijado a entrenador y no se puede cambiar');
    ok(alta.extraVisible && alta.hayGimnasio && alta.hayTelefono && alta.hayFoto,
       'pide gimnasio, teléfono y foto');
    ok(/entrenador/i.test(alta.aviso), 'y explica a qué ha llegado: '+JSON.stringify(alta.aviso));

    // Sin código, el alta de entrenador no se ofrece por ningún lado.
    await page.goto(url, {waitUntil:'networkidle2'});
    await esperar(1600);
    /* Visibilidad REAL (offsetParent), no clases: el fallo del onboarding tapando
       el formulario pasó porque las clases estaban bien y aun así no se veía. */
    const visible = el => !!(el && el.offsetParent !== null);
    const sinCodigo = await page.evaluate(()=>{
      const v = el => !!(el && el.offsetParent !== null);
      return {
        extraVisible: v(document.getElementById('alta-extra')),
        panelCoaches: v(document.getElementById('pane-coaches')),
        botonCoaches: v(document.getElementById('modo-btn-coaches')),
      };
    });
    ok(!sinCodigo.extraVisible, 'sin código no aparecen los campos de entrenador');
    ok(!sinCodigo.panelCoaches, 'y sin ser admin no se ve el panel de entrenadores');
    ok(!sinCodigo.botonCoaches, 'ni el botón que lleva a él');

    console.log('\n13d. Los tres paneles del entrenador');
    /* Jhon (09/09): "quizás sea un poco amontonado, pudiéramos poner las altas
       de entrenadores en otro panel". Llevar a tus clientes y dar de alta a
       otros entrenadores son dos trabajos distintos. */
    const modos = await page.evaluate(()=>{
      const v = el => !!(el && el.offsetParent !== null);
      document.body.classList.add('es-entrenador','es-admin');
      const r = { botones: v(document.getElementById('modo-btn-coaches')) };
      setModo('clientes');
      r.clientes = { clientes: v(document.getElementById('pane-clientes')),
                     coaches: v(document.getElementById('pane-coaches')) };
      setModo('coaches');
      r.coaches = { clientes: v(document.getElementById('pane-clientes')),
                    coaches: v(document.getElementById('pane-coaches')),
                    hayLista: !!document.getElementById('coaches-lista'),
                    hayAltas: v(document.getElementById('pane-altas')) };
      setModo('entreno');
      r.entreno = { clientes: v(document.getElementById('pane-clientes')),
                    coaches: v(document.getElementById('pane-coaches')),
                    inicio: v(document.getElementById('pane-inicio')) };
      return r;
    });
    ok(modos.botones, 'siendo admin aparece el tercer botón');
    ok(modos.clientes.clientes && !modos.clientes.coaches,
       '"Mis clientes" enseña solo el panel de clientes');
    ok(modos.coaches.coaches && !modos.coaches.clientes,
       '"Entrenadores" enseña solo el suyo, y ya no van amontonados');
    ok(modos.coaches.hayLista && modos.coaches.hayAltas,
       'con la lista de entrenadores y el generador de códigos dentro');
    ok(modos.entreno.inicio && !modos.entreno.clientes && !modos.entreno.coaches,
       'y "Mi entrenamiento" vuelve a la app de siempre');

    console.log('\n13e. Suspensión de un entrenador por impago');
    /* La suspensión de verdad la hacen las reglas de Firestore (aquí no se
       pueden probar). Lo que sí se comprueba es que la PANTALLA no deje
       botones que van a fallar, y que explique qué pasa en vez de soltar
       errores de permisos. */
    const susp = await page.evaluate(()=>{
      const v = el => !!(el && el.offsetParent !== null);
      document.body.classList.add('es-entrenador');
      setModo('clientes');
      const antes = { invitar: v(document.getElementById('invitar-btn')),
                      aviso: v(document.getElementById('aviso-suspendido')) };
      // Lo que hace pintarModoEntrenador() cuando el perfil llega suspendido.
      document.body.classList.add('suspendido');
      document.getElementById('aviso-suspendido').classList.remove('hidden');
      const dsp = { invitar: v(document.getElementById('invitar-btn')),
                    retos: v(document.getElementById('reto-crear')),
                    clientes: v(document.getElementById('clientes-lista')),
                    aviso: v(document.getElementById('aviso-suspendido')),
                    texto: document.getElementById('aviso-suspendido').textContent };
      document.body.classList.remove('suspendido','es-entrenador');
      document.getElementById('aviso-suspendido').classList.add('hidden');
      setModo('entreno');
      return { antes, dsp };
    });
    ok(susp.antes.invitar && !susp.antes.aviso, 'sin suspender se trabaja con normalidad');
    ok(susp.dsp.aviso, 'suspendido aparece la explicación');
    ok(!susp.dsp.invitar && !susp.dsp.retos && !susp.dsp.clientes,
       'y desaparecen invitar, retos y la lista de clientes: nada que pulsar para llevarse un error');
    ok(/clientes no se han visto afectados/i.test(susp.dsp.texto),
       'el texto deja claro que sus clientes no pierden nada');

    console.log('\n13f. Pausar a un cliente NO le borra nada');
    /* 🔴 La prueba que de verdad importa de esta función. El backend de
       Firestore borra en remoto las rutinas que no ve en local, así que
       esconder el plan quitándolo de DB no lo escondería: lo destruiría. Ya se
       perdieron datos reales dos veces (04/08 y 04/09/2026). El filtrado tiene
       que ocurrir al LEER y jamás sobre los datos. */
    await page.evaluate(()=>localStorage.clear());
    await page.reload({waitUntil:'networkidle2'});
    await esperar(1600);
    await page.type('#ob-name','Cliente');
    await page.evaluate(()=>{ obNext(1); obSelectRoutine(PRESET_ROUTINES[0].id); obNext(2); obFinish(); });
    await esperar(800);

    const pausa = await page.evaluate(()=>{
      // La rutina activa pasa a ser "asignada por el entrenador".
      const r = DB.routines.find(x=>x.id===DB.activeRoutine);
      r.assignedBy = 'uid-del-entrenador';
      r.sessions['1'] = { date:'9/9/2026', exercises:[{name:'Press banca',sets:[{kg:'40',reps:'10'}]}] };
      // Y otra que se hizo el cliente por su cuenta.
      DB.routines.push({ id:'mia', name:'La mía', plan:[{num:1,title:'S1',days:[{s:1,name:'D1',type:'Full',ex:[]}]}], sessions:{}, medidas:[] });
      save();
      const antes = { activa: !!getActive(), rutinas: DB.routines.length,
                      sesiones: Object.keys(r.sessions).length };

      seguimientoPausado = true;
      renderRoutineList(); updateHome();
      const durante = {
        activa: !!getActive(),
        rutinasEnDB: DB.routines.length,
        sesionesEnDB: Object.keys(DB.routines.find(x=>x.id===r.id).sessions).length,
        asignadaEnDB: !!DB.routines.find(x=>x.id===r.id),
        enLaLista: document.getElementById('routine-list').textContent,
      };

      seguimientoPausado = false;
      renderRoutineList(); updateHome();
      const despues = { activa: !!getActive(),
                        sesiones: Object.keys(DB.routines.find(x=>x.id===r.id).sessions).length };
      return { antes, durante, despues, nombre: r.name };
    });

    ok(pausa.antes.activa, 'antes de pausar, el plan asignado está activo');
    ok(!pausa.durante.activa, 'en pausa, el plan asignado deja de verse');
    ok(pausa.durante.asignadaEnDB && pausa.durante.rutinasEnDB === pausa.antes.rutinas,
       '🔴 pero SIGUE en los datos: no se ha borrado nada');
    ok(pausa.durante.sesionesEnDB === pausa.antes.sesiones,
       '🔴 y sus sesiones registradas siguen enteras');
    ok(!pausa.durante.enLaLista.includes(pausa.nombre),
       'no se le ofrece en la lista de rutinas');
    ok(pausa.durante.enLaLista.includes('La mía'),
       'pero SÍ sigue viendo las rutinas que se hizo él: son suyas');
    ok(pausa.despues.activa && pausa.despues.sesiones === pausa.antes.sesiones,
       'y al reanudar lo recupera todo, tal y como estaba');

    /* Sin esto la pausa no aprieta: el cliente elegía una rutina prehecha y
       seguía entrenando gratis. Se comprueba en las FUNCIONES y no solo en los
       botones, que es donde tiene que estar el cierre. */
    const anadir = await page.evaluate(()=>{
      seguimientoPausado = true;
      renderRoutineList();
      const lista = document.getElementById('routine-list').textContent;
      const abiertos = { preset:false, nueva:false };
      openPresetPanel();
      abiertos.preset = !document.getElementById('preset-panel').classList.contains('hidden');
      openNewRoutinePanel();
      abiertos.nueva = !document.getElementById('routine-panel').classList.contains('hidden');
      seguimientoPausado = false;
      renderRoutineList();
      const listaOk = document.getElementById('routine-list').textContent;
      return { lista, abiertos, listaOk };
    });
    ok(!/Explorar rutinas/.test(anadir.lista) && !/Crear la mía/.test(anadir.lista),
       'en pausa no se ofrece explorar ni crear rutinas');
    ok(/No puedes añadir rutinas/.test(anadir.lista), 'y se explica por qué');
    ok(!anadir.abiertos.preset && !anadir.abiertos.nueva,
       '🔴 y las pantallas no se abren ni llamándolas directamente');
    ok(/Explorar rutinas/.test(anadir.listaOk),
       'al reanudar vuelven a estar disponibles');

    /* Solo lectura de verdad: las CUATRO puertas por las que entran datos.
       Taparlas a medias sería peor que no taparlas — el cliente descubriría
       por ensayo y error qué le dejan hacer. */
    const soloLectura = await page.evaluate(()=>{
      const r = DB.routines.find(x=>x.id===DB.activeRoutine);
      const antes = { semanas:(r.plan||[]).length, medidas:(r.medidas||[]).length,
                      sesiones:Object.keys(r.sessions||{}).length,
                      fotos:(DB.fotos||[]).length };
      seguimientoPausado = true;
      addWeek();
      const medEl = document.getElementById('med-peso');
      if(medEl) medEl.value = '80';
      saveMedida();
      curSession = 1; saveSession();
      const durante = { semanas:(r.plan||[]).length, medidas:(r.medidas||[]).length,
                        sesiones:Object.keys(r.sessions||{}).length };
      seguimientoPausado = false;
      // El export es el que NUNCA se cierra: sus datos son suyos.
      let exportaOk = true;
      try{ JSON.stringify(DB); }catch(e){ exportaOk = false; }
      return { antes, durante, exportaOk, hayExport: typeof exportJSON === 'function' };
    });
    ok(soloLectura.durante.semanas === soloLectura.antes.semanas,
       'en pausa no puede añadir semanas');
    ok(soloLectura.durante.medidas === soloLectura.antes.medidas,
       'ni apuntar medidas');
    ok(soloLectura.durante.sesiones === soloLectura.antes.sesiones,
       'ni registrar entrenamientos');
    ok(soloLectura.hayExport && soloLectura.exportaOk,
       '🔴 pero SÍ puede exportar sus datos: son suyos aunque deba dinero');

    /* Las otras tres puertas que se colaron en la primera pasada: dentro de
       una sesión abierta se podían seguir añadiendo sesiones, ejercicios y
       series. Lo encontró Jhon. */
    const dentro = await page.evaluate(()=>{
      const r = DB.routines.find(x=>x.id===DB.activeRoutine);
      goTo('log'); openSession(r.plan[0].days[0].s);
      const exAntes = curEx.length, setsAntes = curEx[0].sets.length;
      const semAntes = (r.plan[0].days||[]).length;
      seguimientoPausado = true;
      addExercise(); addSet(0); addSessionToWeek(r.plan[0].num);
      const res = { ejercicios: curEx.length === exAntes,
                    series: curEx[0].sets.length === setsAntes,
                    sesiones: (r.plan[0].days||[]).length === semAntes };
      seguimientoPausado = false;
      return res;
    });
    ok(dentro.ejercicios, 'en pausa no puede añadir ejercicios');
    ok(dentro.series, 'ni series');
    ok(dentro.sesiones, 'ni sesiones al plan');

    /* Y la pausa tiene que aplicarse SIN recargar: si se queda dentro de la
       sesión abierta, sigue rellenando algo que ya no podrá guardar. */
    const enVivo = await page.evaluate(()=>{
      const r = DB.routines.find(x=>x.id===DB.activeRoutine);
      goTo('log'); openSession(r.plan[0].days[0].s);
      const abiertoAntes = document.getElementById('session-form').style.display !== 'none';
      salirDeLoAbierto();
      return { abiertoAntes,
               abiertoDespues: document.getElementById('session-form').style.display !== 'none',
               enInicio: document.getElementById('pane-inicio').classList.contains('active') };
    });
    ok(enVivo.abiertoAntes, 'estando dentro de una sesión...');
    ok(!enVivo.abiertoDespues && enVivo.enInicio,
       '🔴 al pausarse se le saca de ella y se le lleva a Inicio, sin recargar');

    console.log('\n13g. Recargar con sesión y el dispositivo vacío');
    /* Lo encontró un entrenador probando con datos móviles (13/09/2026): se
       registró en la nube, recargó y le salió el onboarding, porque la primera
       carga es la de este dispositivo y aquí no había nada. Y terminarlo en ese
       estado guarda en la nube una rutina nueva y BORRA lo demás.
       Aquí no hay Firebase, así que la nube es un backend falso con su nombre. */
    await page.evaluate(()=>localStorage.clear());
    await page.reload({waitUntil:'networkidle2'});
    await esperar(1600);
    const recarga = await page.evaluate(async ()=>{
      const ob = document.getElementById('onboarding');
      const visible = () => !ob.classList.contains('hidden');
      const r = {};
      // 1) Había sesión y el dispositivo está vacío: el onboarding espera.
      ob.classList.add('hidden');
      localStorage.setItem('jhon_hay_sesion_v1','1');
      await load();
      r.espera = !visible();
      // 2) Firebase contesta sin datos (o sin sesión): entonces sí sale.
      soltarOnboardingAplazado();
      r.saleDespues = visible();
      // 3) Llegan los datos de la nube con el onboarding ya puesto: se quita.
      STORAGE.use({ name:'firestore', write: async ()=>{},
        read: async ()=>({ fotos:[], activeRoutine:'r1',
          routines:[{ id:'r1', name:'Nube', sessions:{}, medidas:[],
                      plan:JSON.parse(JSON.stringify(PRESET_ROUTINES[0].plan)) }] }) });
      await load();
      r.seQuita = !visible();
      r.rutina = DB.activeRoutine;
      STORAGE.use(StorageLocal);
      localStorage.removeItem('jhon_hay_sesion_v1');
      return r;
    });
    ok(recarga.espera, '🔴 con sesión y el dispositivo vacío, el onboarding NO sale antes de que conteste Firebase');
    ok(recarga.saleDespues, 'si al final no hay datos, sale como siempre');
    ok(recarga.seQuita && recarga.rutina === 'r1',
       '🔴 cuando llegan los datos de la nube, el onboarding se quita y se ve la app');

    // De verdad, recargando: una marca vieja no puede dejar la app vacía y sin salida.
    await page.evaluate(()=>{ localStorage.clear(); localStorage.setItem('jhon_hay_sesion_v1','1'); });
    await page.reload({waitUntil:'networkidle2'});
    await esperar(2500);
    const marcaVieja = await page.evaluate(()=>({
      ob: !document.getElementById('onboarding').classList.contains('hidden'),
      marca: localStorage.getItem('jhon_hay_sesion_v1')
    }));
    ok(marcaVieja.ob && marcaVieja.marca === null,
       'con una marca vieja y sin sesión real, Firebase la borra y sale el onboarding');

    console.log('\n13h. Tipos de código de alta y fin del acceso gratuito');
    /* Quien corta el acceso de verdad son las reglas (test/rules.test.js §9).
       Aquí: que el formulario pida lo que toca, que la fecha con la que nace
       el perfil sea la que las reglas van a aceptar, y que al entrenador
       vencido se le explique qué pasa en vez de dejarle botones que fallan. */
    const tipos = await page.evaluate(()=>{
      const v = el => !!(el && el.offsetParent !== null);
      const DIA = 86400000, ahora = Date.now();
      document.body.classList.add('es-entrenador','es-admin');
      setModo('coaches');
      const sel = document.getElementById('alta-tipo');
      const mira = t => { sel.value = t; pintarTipoAlta();
        return { hasta: v(document.getElementById('alta-fila-hasta')),
                 dias: v(document.getElementById('alta-fila-dias')) }; };
      const r = { cortesia: mira('cortesia'), hasta: mira('hasta'), prueba: mira('prueba') };
      mira('cortesia');
      setModo('entreno');
      document.body.classList.remove('es-entrenador','es-admin');

      r.alEntrar = {
        cortesia: accesoAlEntrar({ tipo:'cortesia' }),
        antiguo: accesoAlEntrar({}),
        prueba: accesoAlEntrar({ tipo:'prueba', dias:30 }).getTime() - ahora,
        hasta: accesoAlEntrar({ tipo:'hasta', hasta:'mismo-objeto' })
      };
      r.etiquetas = {
        sinFecha: etiquetaAcceso(undefined, null),
        futura: etiquetaAcceso('prueba', ahora + 10 * DIA),
        pasada: etiquetaAcceso('hasta', ahora - DIA)
      };

      const pantalla = () => ({
        aviso: v(document.getElementById('aviso-suspendido')),
        titulo: document.getElementById('aviso-suspendido-titulo').textContent,
        invitar: v(document.getElementById('invitar-btn')),
        plan: !document.getElementById('home-plan').classList.contains('hidden'),
        textoPlan: document.getElementById('home-plan').textContent
      });
      pintarModoEntrenador({ role:'trainer', accesoHasta: ahora - DIA });
      setModo('clientes');
      r.vencido = pantalla();
      pintarModoEntrenador({ role:'trainer', accesoHasta: ahora + 10 * DIA });
      r.enPlazo = pantalla();
      pintarModoEntrenador({ role:'trainer', suspendido:true, accesoHasta: ahora - DIA });
      r.impago = pantalla();
      pintarModoEntrenador({ role:'trainer' });
      r.cortesia2 = pantalla();
      pintarModoEntrenador(null);
      setModo('entreno');
      return r;
    });
    ok(!tipos.cortesia.hasta && !tipos.cortesia.dias, 'cortesía no pide fecha ni días');
    ok(tipos.hasta.hasta && !tipos.hasta.dias, '"gratis hasta una fecha" pide la fecha');
    ok(tipos.prueba.dias && !tipos.prueba.hasta, 'la prueba pide los días');
    ok(tipos.alEntrar.cortesia === null && tipos.alEntrar.antiguo === null,
       'cortesía y los códigos de antes entran sin fecha de fin');
    ok(Math.abs(tipos.alEntrar.prueba - 30 * 86400000) < 60000,
       'la prueba cuenta los días desde que se registra');
    ok(tipos.alEntrar.hasta === 'mismo-objeto',
       '🔴 "hasta" copia la fecha del código tal cual: las reglas la exigen idéntica');
    ok(/cortesía/i.test(tipos.etiquetas.sinFecha.texto) && !tipos.etiquetas.sinFecha.vencido,
       'en la lista, sin fecha se lee como cortesía');
    ok(/en prueba hasta/i.test(tipos.etiquetas.futura.texto) && !tipos.etiquetas.futura.vencido,
       'con fecha futura, hasta cuándo');
    ok(/terminó/i.test(tipos.etiquetas.pasada.texto) && tipos.etiquetas.pasada.vencido,
       'y con la fecha pasada, que se terminó');
    ok(tipos.vencido.aviso && /acceso gratuito ha terminado/i.test(tipos.vencido.titulo),
       'al entrenador vencido se le explica que se acabó su acceso gratuito');
    ok(!tipos.vencido.invitar, 'y no le quedan botones que van a fallar');
    ok(tipos.vencido.plan && /ha terminado/i.test(tipos.vencido.textoPlan)
       && /quiero pagar/i.test(tipos.vencido.textoPlan),
       'en Inicio le sale en grande que se acabó, con el botón de pagar');
    ok(!tipos.enPlazo.aviso && tipos.enPlazo.invitar && tipos.enPlazo.plan
       && /días gratis/i.test(tipos.enPlazo.textoPlan) && /hasta el/i.test(tipos.enPlazo.textoPlan)
       && /quiero pagar/i.test(tipos.enPlazo.textoPlan),
       'dentro del plazo trabaja normal y en Inicio ve cuánto le queda, con el botón de pagar');
    ok(tipos.impago.aviso && /suspendida/i.test(tipos.impago.titulo),
       'suspendido por impago sigue diciendo "suspendida", aunque también haya vencido');
    ok(!tipos.impago.plan, 'y a un suspendido por impago no se le enseña la prueba');
    ok(!tipos.cortesia2.aviso && !tipos.cortesia2.plan,
       'y sin fecha no se le enseña ningún plazo');

    console.log('\n13i. El onboarding de una cuenta que ya existe trae su nombre y su foto');
    /* Jhon (15/09): tras darse de alta un entrenador, al cargar le salía el
       onboarding pidiendo otra vez nombre y foto. Y terminarlo sin volver a
       elegir la foto borraba la del alta, que es la que ven sus clientes. */
    const obCuenta = await page.evaluate(()=>{
      const FOTO = 'data:image/png;base64,iVBORw0KGgo=';
      const campo = document.getElementById('ob-name');
      campo.value = ''; obPhotoData = null;
      showOnboarding();
      rellenarOnboardingDesdeCuenta({ name:'Laura Coach', foto:FOTO });
      const r = { nombre: campo.value, foto: obPhotoData === FOTO,
                  img: (document.querySelector('#ob-avatar img') || {}).src || '' };
      // La cuenta llega tarde y la persona ya había escrito algo.
      campo.value = 'Lau';
      rellenarOnboardingDesdeCuenta({ name:'Laura Coach', foto:FOTO });
      r.respeta = campo.value === 'Lau';
      campo.value = 'Laura Coach';
      // Cierra sesión: no puede quedarse el nombre de otra cuenta.
      rellenarOnboardingDesdeCuenta(null);
      r.trasSalir = { nombre: campo.value, foto: obPhotoData,
                      img: !!document.querySelector('#ob-avatar img') };
      // Terminarlo con la foto de la cuenta: se guarda esa, no un vacío.
      rellenarOnboardingDesdeCuenta({ name:'Laura Coach', foto:FOTO });
      obSelectRoutine(PRESET_ROUTINES[0].id);
      r.backend = STORAGE.backend.name;
      if(r.backend === 'local') obFinish();   // nunca contra la nube
      r.guardada = !!(DB && DB.profilePic === FOTO);
      r.oculto = document.getElementById('onboarding').classList.contains('hidden');
      return r;
    });
    ok(obCuenta.nombre === 'Laura Coach' && obCuenta.foto && obCuenta.img.startsWith('data:image/png'),
       'con cuenta, el onboarding trae ya el nombre y la foto');
    ok(obCuenta.respeta, 'pero no pisa lo que la persona haya escrito');
    ok(obCuenta.trasSalir.nombre === '' && obCuenta.trasSalir.foto === null && !obCuenta.trasSalir.img,
       'al cerrar sesión se retiran: no se queda lo de otra cuenta');
    ok(obCuenta.backend === 'local' && obCuenta.guardada,
       '🔴 al terminarlo se guarda la foto de la cuenta, no se borra');
    ok(obCuenta.oculto, 'y el onboarding se cierra');
    await page.evaluate(()=>localStorage.clear());

    console.log('\n13j. Alta abierta, consentimiento y datos de la app');
    /* Las reglas deciden quién entra (rules §10). Aquí: que el formulario
       cambie con el interruptor, que no se cree ninguna cuenta sin aceptar la
       privacidad, y que no se pueda abrir el alta sin responsable ni correo. */
    const abierta = await page.evaluate(async ()=>{
      const v = el => !!(el && el.offsetParent !== null);
      const $ = id => document.getElementById(id);
      const tabs = () => v(document.querySelector('#auth-panel .auth-tabs'));
      const r = {};
      if($('auth-panel').classList.contains('hidden')) toggleAuthPanel();
      /* Abrir el panel lanza la lectura real de /config/app. Se espera a que
         acabe: si llegara a mitad de la prueba, repintaría el formulario con
         lo que haya en producción y pisaría el estado que se está probando. */
      await window.cargarConfigAppSiHaceFalta();
      pintarRegistroAbierto({});
      r.cerrada = { tabs: tabs(), cerrado: v($('registro-cerrado-aviso')) };
      pintarRegistroAbierto({ altaAbierta:true, diasPrueba:21 });
      setAuthTab('register');
      r.abierta = { tabs: tabs(), cerrado: v($('registro-cerrado-aviso')), extra: v($('alta-extra')),
                    rol: $('auth-role').value, filaRol: v($('fila-rol')),
                    aviso: $('aviso-invitacion').textContent, consiente: v($('auth-consiente')) };
      $('auth-email').value = 'prueba@ejemplo.es'; $('auth-password').value = 'secreta123';
      $('auth-name').value = 'Coach'; $('alta-gimnasio').value = 'Gym'; $('alta-telefono').value = '600';
      $('auth-consiente').checked = false;
      await submitAuth();
      r.sinConsentir = $('auth-msg').textContent;
      pintarRegistroAbierto({});
      r.vuelveACerrar = { tabs: tabs(), boton: $('auth-submit').textContent };
      toggleAuthPanel();
      $('cfg-alta-abierta').checked = true;
      $('cfg-dias-prueba').value = '30'; $('cfg-responsable').value = ''; $('cfg-correo').value = '';
      await guardarConfigApp();
      r.cfgSinDatos = $('cfg-app-msg').textContent;
      $('cfg-alta-abierta').checked = false;
      return r;
    });
    ok(!abierta.cerrada.tabs && abierta.cerrada.cerrado, 'con el alta cerrada, solo se puede iniciar sesión');
    ok(abierta.abierta.tabs && !abierta.abierta.cerrado && abierta.abierta.extra
       && abierta.abierta.rol === 'trainer' && !abierta.abierta.filaRol,
       'abierta: se puede registrar, siempre como entrenador y con sus datos');
    ok(/21 días/.test(abierta.abierta.aviso), 'y dice cuántos días de prueba tiene: '+JSON.stringify(abierta.abierta.aviso));
    ok(abierta.abierta.consiente, 'con la casilla de privacidad a la vista');
    ok(/privacidad/i.test(abierta.sinConsentir),
       '🔴 sin aceptar la privacidad no se crea la cuenta: '+JSON.stringify(abierta.sinConsentir));
    ok(!abierta.vuelveACerrar.tabs && abierta.vuelveACerrar.boton === 'Iniciar sesión',
       'al cerrar el alta vuelve a quedar solo iniciar sesión');
    ok(/responsable/i.test(abierta.cfgSinDatos),
       '🔴 no se abre el alta sin responsable ni correo para la privacidad');
    const legal = fs.readFileSync(path.join(__dirname, '..', 'legal.html'), 'utf8');
    ok(/id="privacidad"/.test(legal) && /id="terminos"/.test(legal)
       && /datos de salud/i.test(legal) && /AEPD/.test(legal),
       'la página legal existe, con privacidad y términos');

    console.log('\n13k. Elegir varias rutinas (onboarding y Explorar rutinas)');
    /* Pedido por amigos de Jhon (15/09): marcar varias, cargarlas de una vez y
       decir luego cuál activar. */
    const varias = await page.evaluate(()=>{
      if(STORAGE.backend.name !== 'local') return { saltado:true };   // nunca contra la nube
      const P = PRESET_ROUTINES.map(r => r.id);
      const r = {};
      showOnboarding();
      document.getElementById('ob-name').value = 'Ana';
      obNext(1);
      obSelectRoutine(P[0]); obSelectRoutine(P[1]); obSelectRoutine(P[2]);
      obSelectRoutine(P[2]);                                  // desmarcar también vale
      r.marcadas = document.querySelectorAll('#ob-routine-list .ob-routine-btn.selected').length;
      obNext(2);
      r.opcionesActiva = document.querySelectorAll('#ob-activa .ob-routine-btn').length;
      r.resumen = document.getElementById('ob-summary').textContent;
      obElegirActiva(P[1]);
      obFinish();
      r.tras = { rutinas: DB.routines.map(x => x.id), activa: DB.activeRoutine };

      openPresetPanel();
      presetToggle(P[0]);                                     // ya la tiene: no se marca
      presetToggle(P[3]); presetToggle(P[4]);
      r.boton = document.getElementById('preset-cargar').textContent.trim();
      r.yaEstaDeshabilitada = document.querySelectorAll('#preset-list .preset-opcion[disabled]').length;
      cargarPresetsElegidos();
      r.cargadas = DB.routines.map(x => x.id);
      r.activaSinConfirmar = DB.activeRoutine;
      r.eleccion = document.getElementById('preset-list').textContent.replace(/\s+/g,' ');
      r.opcionesEleccion = document.querySelectorAll('#preset-list .preset-opcion').length;
      presetElegirActiva(P[4]);
      confirmarActivaPreset();
      r.final = { activa: DB.activeRoutine,
                  panelCerrado: document.getElementById('preset-panel').classList.contains('hidden') };
      return r;
    });
    const P = await page.evaluate(()=>PRESET_ROUTINES.map(r => r.id));
    ok(!varias.saltado, 'la prueba corre en local, nunca contra la nube');
    ok(varias.marcadas === 2, 'en el onboarding se marcan varias (y se desmarcan)');
    ok(varias.opcionesActiva === 2 && /con cuál empiezas/i.test(varias.resumen),
       'con más de una, al final pregunta con cuál empieza');
    ok(varias.tras.rutinas.length === 2 && varias.tras.activa === P[1],
       'y entran las dos, activa la que eligió');
    ok(/Cargar 2 rutinas/.test(varias.boton) && varias.yaEstaDeshabilitada >= 2,
       'en Explorar rutinas se marcan varias, sin poder repetir las que ya tiene: '+varias.boton);
    ok(varias.cargadas.length === 4 && varias.cargadas.includes(P[3]) && varias.cargadas.includes(P[4]),
       'se cargan todas de una vez');
    ok(varias.activaSinConfirmar === P[1],
       '🔴 cargar no cambia la rutina en curso hasta que lo digas');
    ok(varias.opcionesEleccion === 3 && /Seguir con/.test(varias.eleccion),
       'pregunta cuál activar: las nuevas o seguir con la de ahora');
    ok(varias.final.activa === P[4] && varias.final.panelCerrado,
       'y activa la elegida y se cierra');

    console.log('\n13l. Botones de volver y cómo instalar en iPhone');
    /* Una entrenadora (15/09) no veía que "← Semanas" era volver, y no entendía
       las instrucciones de instalar en su iPhone. */
    const volver = await page.evaluate(async ()=>{
      const v = el => !!(el && el.offsetParent !== null);
      // openSession/openExDetail ponen el texto con setTimeout(…, 0): hay que dejarles el tic.
      const tic = () => new Promise(res => setTimeout(res, 20));
      const r = {};
      const act = getActive();
      showTab('log', document.getElementById('tab-log'));
      openWeekDetail(1);
      const bs = document.querySelector('#session-list-view .btn-volver');
      const tit = document.getElementById('week-detail-title');
      r.semana = { visible: v(bs), texto: bs && bs.textContent.trim(),
                   arribaIzq: !!(bs && bs.getBoundingClientRect().bottom <= tit.getBoundingClientRect().top + 2
                     && bs.getBoundingClientRect().left <= tit.getBoundingClientRect().left + 2),
                   flecha: !!(bs && bs.querySelector('svg')) };
      openSession(act.plan[0].days[0].s);
      await tic();
      r.sesion = document.getElementById('btn-volver').textContent.trim();
      openExDetail(0);
      await tic();
      r.ejercicio = document.getElementById('btn-volver').textContent.trim();
      r.flechaSigue = !!document.querySelector('#btn-volver svg');
      volverAtras(); volverAtras(); closeWeekDetail();
      const safari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
      const chrome = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0 Mobile/15E148 Safari/604.1';
      const d = document.createElement('div');
      d.innerHTML = cuerpoInstalarIOS(safari);
      r.safari = { pasos: d.querySelectorAll('.pasos-instalar li').length, texto: d.textContent.replace(/\s+/g,' ') };
      d.innerHTML = cuerpoInstalarIOS(chrome);
      r.chrome = { pasos: d.querySelectorAll('.pasos-instalar li').length, texto: d.textContent.replace(/\s+/g,' ') };
      return r;
    });
    ok(volver.semana.visible && volver.semana.texto === 'Volver a semanas' && volver.semana.flecha,
       'dentro de una semana, el botón dice "Volver a semanas" y lleva flecha');
    ok(volver.semana.arribaIzq, 'y está arriba a la izquierda, antes del título (donde el iPhone pone "atrás")');
    ok(volver.sesion === 'Volver a sesiones' && volver.ejercicio === 'Volver a ejercicios' && volver.flechaSigue,
       'en la sesión y en el ejercicio dice a dónde vuelve, sin perder la flecha');
    ok(volver.safari.pasos === 4 && /•••/.test(volver.safari.texto) && /Compartir/.test(volver.safari.texto)
       && /Añadir a pantalla de inicio/.test(volver.safari.texto) && /Ya la tengo/.test(volver.safari.texto),
       'en Safari de iPhone: 4 pasos, empezando por el botón •••');
    ok(volver.chrome.pasos === 3 && /arriba a la derecha/.test(volver.chrome.texto),
       'y en Chrome de iPhone, los suyos: Compartir está arriba');
    await page.evaluate(()=>localStorage.clear());

    console.log('\n13m. Ficha del cliente: cada rutina en su ventana, y cambiarle los días');
    /* Jhon (15/09): tocar una rutina tiene que abrir OTRA VENTANA con sus datos
       (primero se deslizaba dentro de la ficha y la hacía larguísima); y un
       entrenador necesita pasar a un cliente de 5 días a 3. Guardar necesita
       Firebase: aquí se prueba todo hasta la propuesta, y aplicar en
       storage.test.js §17c. */
    const ficha = await page.evaluate(async ()=>{
      const r = {};
      const esperar = ms => new Promise(res => setTimeout(res, ms));
      const dia = (s, nombre, tipo, ex) => ({ s, name:'S'+s+' · '+nombre, type:tipo, ex });
      const semana = (num, b) => ({ num, title:'Semana '+num, days:[
        dia(b+1,'Pecho','Torso',[['Press banca','4×8'],['Aperturas','3×12']]),
        dia(b+2,'Pierna','Pierna',[['Sentadilla','4×8'],['Zancadas','3×10']]),
        dia(b+3,'Espalda','Torso',[['Remo','4×8'],['Jalón','3×12']]),
        dia(b+4,'Glúteo','Pierna',[['Hip thrust','4×10'],['Peso muerto rumano','3×10']]),
        dia(b+5,'Hombro','Torso',[['Press militar','4×8'],['Elevaciones','3×15']]) ]});
      const plan = [semana(1,0), semana(2,5), semana(3,10)];
      __pintarDetallePrueba({ nombre:'Laura', activa:'r2', rutinas:[
        { id:'r1', name:'Fuerza', plan, sessions:{ 1:{ date:'01/09', exercises:[] } } },
        { id:'r2', name:'Definición', plan: JSON.parse(JSON.stringify(plan)), sessions:{} } ] });
      const v = el => !!(el && el.offsetParent !== null);
      const ventana = document.getElementById('rutina-cliente');
      const cuerpoFicha = document.getElementById('detalle-cuerpo');
      r.ficha = { sinPlan: !cuerpoFicha.querySelector('#detalle-plan'),
                  texto: cuerpoFicha.textContent.replace(/\s+/g,' '),
                  ventanaCerrada: ventana.classList.contains('hidden') };

      verRutinaDetalle('r1');
      await esperar(450);                                     // la transición de la capa
      const vr = document.getElementById('rutina-cliente-cuerpo');
      r.ventana = { abierta: !ventana.classList.contains('hidden'),
                    encima: parseInt(getComputedStyle(ventana).zIndex, 10) >
                            parseInt(getComputedStyle(document.getElementById('cliente-detalle')).zIndex, 10),
                    volver: document.getElementById('rutina-cliente-volver').textContent,
                    texto: vr.textContent.replace(/\s+/g,' '),
                    plan: !!vr.querySelector('#detalle-plan'),
                    activar: /Activar esta rutina para Laura/.test(vr.textContent),
                    fichaSinMover: cuerpoFicha.scrollTop === 0 };

      abrirDiasCliente();
      const bloque = () => vr.querySelector('.dias-cliente');
      r.editor = { select: !!bloque().querySelector('select'), texto: bloque().textContent.replace(/\s+/g,' ') };
      elegirDiasCliente('5');
      proponerDiasCliente();
      r.mismosDias = bloque().textContent.replace(/\s+/g,' ');
      elegirDiasCliente('3');
      proponerDiasCliente();
      r.propuesta = { sesiones: bloque().querySelectorAll('input[type="text"]').length,
                      texto: bloque().textContent.replace(/\s+/g,' '),
                      aplicar: !!document.getElementById('dias-cliente-aplicar') };
      cerrarDiasCliente();
      r.cancelado = !bloque().querySelector('select') && /Cambiar días/.test(bloque().textContent);

      cerrarRutinaCliente();
      await esperar(450);
      r.alVolver = { ventanaCerrada: ventana.classList.contains('hidden'),
                     fichaSigue: v(cuerpoFicha) };

      // Una semana con 9 sesiones: antes decía "Entrena 9 días por semana".
      __pintarDetallePrueba({ nombre:'Pablo', rutinas:[{ id:'r9', name:'Doble', sessions:{},
        plan:[{ num:1, title:'Semana 1', days: Array.from({length:9}, (_,i) => dia(100+i,'D'+i,'Full',[['Burpees','3×10']])) }] }] });
      verRutinaDetalle('r9');
      r.nueve = document.querySelector('#rutina-cliente .dias-cliente').textContent.replace(/\s+/g,' ');
      abrirDiasCliente();
      r.nueveSelect = document.querySelector('#rutina-cliente .dias-cliente select').value;
      cerrarDetalleCliente();
      r.todoCerrado = ventana.classList.contains('hidden')
        && document.getElementById('cliente-detalle').classList.contains('hidden');
      return r;
    });
    ok(ficha.ficha.sinPlan && ficha.ficha.ventanaCerrada && /Sus rutinas/.test(ficha.ficha.texto),
       'la ficha es de la persona: lista sus rutinas y ya no lleva el plan dentro');
    ok(ficha.ventana.abierta && ficha.ventana.encima,
       'tocar una rutina abre su propia ventana, por encima de la ficha');
    ok(ficha.ventana.volver === 'Volver a Laura', 'con "Volver a Laura" arriba a la izquierda');
    ok(ficha.ventana.plan && /Sentadilla/.test(ficha.ventana.texto) && /Remo/.test(ficha.ventana.texto),
       'dentro, su plan desplegado con los ejercicios de los días pendientes');
    ok(ficha.ventana.activar, 'y el botón de activarla, que es de la rutina');
    ok(ficha.ventana.fichaSinMover, 'la ficha no se ha desplazado por debajo');
    ok(/Entrena 5 días por semana/.test(ficha.editor.texto) && ficha.editor.select,
       'dice cuántos días entrena y deja elegir otros');
    ok(/Ya entrena 5 días/.test(ficha.mismosDias), 'elegir los mismos días lo dice en vez de proponer nada');
    ok(ficha.propuesta.sesiones === 3 && /la 2, la 3/.test(ficha.propuesta.texto) && ficha.propuesta.aplicar,
       'a 3 días: propuesta editable de 3 sesiones, solo para las semanas sin empezar');
    ok(ficha.cancelado, 'cancelar lo deja como estaba');
    ok(ficha.alVolver.ventanaCerrada && ficha.alVolver.fichaSigue,
       'y "Volver" cierra la ventana y deja la ficha donde estaba');
    ok(/9 sesiones/.test(ficha.nueve) && !/9 días/.test(ficha.nueve),
       '🔴 una semana de 9 sesiones ya no dice "9 días por semana": '+JSON.stringify(ficha.nueve));
    ok(ficha.nueveSelect === '7', 'y al cambiar días parte de 7, el máximo posible');
    ok(ficha.todoCerrado, 'cerrar la ficha cierra también la ventana de la rutina');

    console.log('\n13n. El entrenador puede borrar días pendientes del plan');
    /* Jhon (15/09): borrar sesiones como entrenador, solo las que el cliente aún
       no ha hecho. Aquí se mira que el botón esté solo donde toca; quitar de
       verdad escribe en Firestore y la lógica se prueba en storage.test.js §17d.
       No se pulsa: abriría un confirm(), que en la prueba bloquea la página. */
    const borrar = await page.evaluate(()=>{
      const dia = (s, nombre) => ({ s, name:'S'+s+' · '+nombre, type:'Full', ex:[['Burpees','3×10']] });
      __pintarDetallePrueba({ nombre:'Laura', rutinas:[{ id:'rb', name:'Con hechas',
        plan:[{ num:1, title:'Semana 1', days:[dia(1,'Upper'), dia(2,'Lower'), dia(3,'Push')] }],
        sessions:{ 1:{ date:'01/09', exercises:[] } } }] });
      verRutinaDetalle('rb');
      const filas = [...document.querySelectorAll('#rutina-cliente .week-row')].map(f => ({
        nombre: f.querySelector('span').textContent.trim(),
        borrar: !!f.querySelector('button[onclick^="quitarDiaCliente"]'),
        editar: !!f.querySelector('button[onclick^="editarSesionCliente"]') }));
      cerrarDetalleCliente();
      return { filas, funcion: typeof quitarDiaCliente === 'function' };
    });
    const fila = n => borrar.filas.find(f => f.nombre.startsWith(n)) || {};
    ok(borrar.funcion, 'existe la acción de quitar un día del plan del cliente');
    ok(fila('S2').borrar && fila('S3').borrar, 'los días pendientes llevan "Borrar"');
    ok(!fila('S1').borrar && fila('S1').editar, '🔴 el día ya entrenado NO lleva "Borrar" (su historial no se toca)');

    console.log('\n13o. Todas las ventanas se cierran con "Volver", arriba a la izquierda');
    /* Jhon (15/09): le gustó el "Volver" de Registrar y lo quiso en todos los
       sitios donde había un "✕ Cerrar" gris. Se recorren TODAS las cabeceras
       y barras: si mañana se añade una ventana con el botón viejo, esto cae. */
    const volverTodo = await page.evaluate(()=>{
      const cabeceras = [...document.querySelectorAll('.routine-panel-header, .comp-barra')];
      const malas = cabeceras.filter(c => {
        const primero = c.firstElementChild;
        const botonViejo = [...c.children].some(b => b.tagName === 'BUTTON' && /✕|Cerrar/.test(b.textContent));
        return !(primero && primero.classList.contains('btn-volver') && primero.querySelector('svg')) || botonViejo;
      }).map(c => (c.closest('[id]') || {}).id || c.className);

      // El selector de ejercicios: un solo botón que da un paso atrás cada vez.
      const r = { total: cabeceras.length, malas };
      openNewRoutinePanel();
      nrDias = [{ nombre:'Día 1', ex:[] }];
      nrAbrirSelector(0);
      const etiqueta = () => document.querySelector('#sel-volver span').textContent;
      const abierto = () => !document.getElementById('selector-ejercicio').classList.contains('hidden');
      r.enMusculos = etiqueta();
      nrAbrirMusculo(nrMusculosConEjercicios()[0].clave);
      r.dentroDeUno = etiqueta();
      nrSelVolver();
      r.trasVolver = { etiqueta: etiqueta(), abierto: abierto() };
      nrSelVolver();
      r.cerrado = !abierto();
      closeNewRoutinePanel();
      return r;
    });
    ok(volverTodo.total >= 12, 'se revisan todas las cabeceras y barras ('+volverTodo.total+')');
    ok(volverTodo.malas.length === 0,
       volverTodo.malas.length ? 'estas aún tienen el botón viejo: '+volverTodo.malas.join(', ')
                               : 'en todas, el primer botón es "Volver" con su flecha y ya no queda ningún "✕ Cerrar"');
    ok(volverTodo.enMusculos === 'Volver a la rutina' && volverTodo.dentroDeUno === 'Músculos',
       'en el selector de ejercicios el botón dice a dónde lleva: la rutina o los músculos');
    ok(volverTodo.trasVolver.etiqueta === 'Volver a la rutina' && volverTodo.trasVolver.abierto && volverTodo.cerrado,
       'y da un paso atrás cada vez: de un músculo a los músculos, y de ahí fuera');

    console.log('\n13p. Tocar tu foto abre tu cuenta: perfil y sesión juntos');
    /* Jhon (15/09): quitar el botón de la nube y que la foto de la cabecera
       abra todo lo de la cuenta: iniciar o cerrar sesión, cambiar la foto,
       verla en grande y el nombre. */
    const cuenta = await page.evaluate(()=>{
      const r = {};
      const panel = document.getElementById('auth-panel');
      if(!panel.classList.contains('hidden')) toggleAuthPanel();
      r.sinNube = !document.getElementById('account-btn');
      document.getElementById('profile-pic').click();
      r.abre = !panel.classList.contains('hidden');
      r.titulo = panel.querySelector('.routine-panel-header h2').textContent.trim();
      const av = document.getElementById('cuenta-avatar');
      r.perfil = { avatar: !!av && panel.contains(av),
                   nombre: panel.contains(document.getElementById('profile-name')),
                   unSoloNombre: document.querySelectorAll('#profile-name').length === 1,
                   cambiarFoto: /Cambiar foto/.test(panel.textContent),
                   cambiarNombre: /Cambiar nombre/.test(panel.textContent),
                   sesion: panel.contains(document.getElementById('auth-logged-out'))
                           && panel.contains(document.getElementById('auth-logged-in')) };
      const antes = DB.profilePic;
      DB.profilePic = null; renderProfilePic();
      r.sinFoto = { iniciales: av.classList.contains('sin-foto') && !av.querySelector('img'),
                    pista: document.getElementById('cuenta-avatar-pista').textContent };
      const px = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
      DB.profilePic = px; renderProfilePic();
      r.conFoto = { dosSitios: !!av.querySelector('img') && !!document.querySelector('#profile-pic img'),
                    pista: document.getElementById('cuenta-avatar-pista').textContent };
      av.click();
      const visor = document.getElementById('visor-foto');
      r.visorEncima = !visor.classList.contains('hidden')
        && parseInt(getComputedStyle(visor).zIndex, 10) > parseInt(getComputedStyle(panel).zIndex, 10);
      cerrarVisorFoto();
      DB.profilePic = antes; renderProfilePic();
      toggleAuthPanel();
      return r;
    });
    ok(cuenta.sinNube, 'ya no está el botón de la nube en la cabecera');
    ok(cuenta.abre && cuenta.titulo === 'TU CUENTA', 'tocar tu foto abre "Tu cuenta"');
    ok(cuenta.perfil.avatar && cuenta.perfil.cambiarFoto && cuenta.perfil.cambiarNombre,
       'arriba, tu perfil: la foto, cambiarla y cambiar el nombre');
    ok(cuenta.perfil.nombre && cuenta.perfil.unSoloNombre,
       'el nombre está aquí y solo aquí (ya no repetido en Ajustes)');
    ok(cuenta.perfil.sesion, 'y debajo, iniciar o cerrar sesión, como siempre');
    ok(cuenta.sinFoto.iniciales && /ponerla/.test(cuenta.sinFoto.pista),
       'sin foto salen tus iniciales y explica cómo ponerla');
    ok(cuenta.conFoto.dosSitios && /grande/.test(cuenta.conFoto.pista),
       'con foto, la misma en la cabecera y en tu perfil');
    ok(cuenta.visorEncima, 'y tocarla la abre en grande, por encima de la cuenta');

    console.log('\n13q. Ver la contraseña (el ojo)');
    /* Pedido por quienes la probaron (15/09): no había forma de comprobar si la
       contraseña estaba bien escrita. */
    const ojo = await page.evaluate(()=>{
      const panel = document.getElementById('auth-panel');
      if(panel.classList.contains('hidden')) toggleAuthPanel();
      setAuthTab('login');
      const campo = document.getElementById('auth-password');
      const btn = document.getElementById('ver-clave');
      const v = el => !!(el && el.offsetParent !== null);
      campo.value = 'secreta123';
      const r = { hay: v(btn), inicial: campo.type, etiqueta: btn.getAttribute('aria-label') };
      const rc = campo.getBoundingClientRect(), rb = btn.getBoundingClientRect();
      r.dentro = rb.left >= rc.left && rb.right <= rc.right + 1 && rb.top >= rc.top - 1 && rb.bottom <= rc.bottom + 1;
      btn.click();
      r.visto = { tipo: campo.type, etiqueta: btn.getAttribute('aria-label'),
                  pulsado: btn.getAttribute('aria-pressed'), valor: campo.value };
      btn.click();
      r.otraVez = campo.type;
      btn.click();                                   // se deja a la vista…
      toggleAuthPanel();                             // …y se cierra la cuenta
      r.alCerrar = campo.type;
      campo.value = '';
      return r;
    });
    ok(ojo.hay && ojo.dentro, 'el campo de contraseña lleva el ojo, dentro del propio campo');
    ok(ojo.inicial === 'password' && ojo.etiqueta === 'Mostrar contraseña', 'empieza oculta');
    ok(ojo.visto.tipo === 'text' && ojo.visto.pulsado === 'true' && ojo.visto.etiqueta === 'Ocultar contraseña'
       && ojo.visto.valor === 'secreta123',
       'al tocarlo se ve lo escrito, sin perder nada');
    ok(ojo.otraVez === 'password', 'y al tocarlo otra vez se vuelve a ocultar');
    ok(ojo.alCerrar === 'password', 'si se cierra la cuenta con ella a la vista, se oculta sola');

    console.log('\n13r. Cambiar el rol de una cuenta (panel del admin)');
    /* Jhon (15/09): pasar un cliente a entrenador y al revés, solo él. Quien
       manda son las reglas (rules §11); aquí, el cálculo del acceso y lo que
       enseña la tarjeta en cada caso. Cambiar de verdad escribe en Firestore y
       pide confirm(): no se pulsa. */
    const rol = await page.evaluate(()=>{
      const r = {};
      const DIA = 86400000, ahora = Date.now();
      const manana = new Date(ahora + 2 * DIA).toISOString().slice(0,10);
      const ayer = new Date(ahora - 2 * DIA).toISOString().slice(0,10);
      r.acceso = {
        cortesia: accesoParaCambioRol('cortesia', '', '', ahora),
        hastaPasada: accesoParaCambioRol('hasta', ayer, '', ahora),
        hastaBien: accesoParaCambioRol('hasta', manana, '', ahora),
        pruebaMal: accesoParaCambioRol('prueba', '', '0', ahora),
        pruebaBien: accesoParaCambioRol('prueba', '', '30', ahora),
      };
      r.acceso.pruebaBien.dias = Math.round((r.acceso.pruebaBien.accesoHasta - ahora) / DIA);
      r.acceso.hastaBien.futura = r.acceso.hastaBien.accesoHasta > ahora;

      // Vive en Ajustes → Cuentas desde el 15/09 (antes, en Entrenadores).
      document.body.classList.add('es-entrenador','es-admin');
      if(document.getElementById('config-panel').classList.contains('hidden')) toggleConfigPanel();
      const v = el => !!(el && el.offsetParent !== null);
      r.tarjeta = v(document.getElementById('pane-rol'));
      const res = () => document.getElementById('rol-resultado');

      __pintarCuentaRolPrueba('u-laura', { name:'Laura', email:'laura@ejemplo.es', role:'client', trainerId:'u-coach' });
      r.cliente = { texto: res().textContent.replace(/\s+/g,' '), selector: !!document.getElementById('rol-tipo') };
      const sel = document.getElementById('rol-tipo');
      sel.value = 'prueba'; pintarTipoRol();
      r.cliente.dias = v(document.getElementById('rol-fila-dias')) && !v(document.getElementById('rol-fila-hasta'));

      __pintarCuentaRolPrueba('u-pablo', { name:'Pablo', email:'pablo@ejemplo.es', role:'trainer', trainerId:null });
      r.entrenador = { texto: res().textContent.replace(/\s+/g,' '), selector: !!document.getElementById('rol-tipo') };

      __pintarCuentaRolPrueba(null, { name:'Yo', email:'yo@ejemplo.es', role:'trainer' });   // meUid es null en la prueba
      r.propia = res().textContent.replace(/\s+/g,' ');

      __pintarCuentaRolPrueba(null, null);
      document.body.classList.remove('es-entrenador','es-admin');
      r.sinAdmin = !v(document.getElementById('pane-rol'));
      toggleConfigPanel();
      return r;
    });
    ok(rol.acceso.cortesia.ok && rol.acceso.cortesia.accesoHasta === null, 'cortesía: entra sin fecha de fin');
    ok(!rol.acceso.hastaPasada.ok && /ha pasado/.test(rol.acceso.hastaPasada.error), 'una fecha que ya pasó no se acepta');
    ok(rol.acceso.hastaBien.ok && rol.acceso.hastaBien.futura, 'una futura sí');
    ok(!rol.acceso.pruebaMal.ok && rol.acceso.pruebaBien.ok && rol.acceso.pruebaBien.dias === 30,
       'la prueba pide entre 1 y 365 días y los cuenta desde hoy');
    ok(rol.tarjeta, 'en Ajustes → Cuentas está "Cambiar el rol o el entrenador de una cuenta"');
    ok(/Pasar a entrenador/.test(rol.cliente.texto) && rol.cliente.selector && /dejará de tener entrenador/.test(rol.cliente.texto),
       'con un cliente: ofrece pasarlo a entrenador, eligiendo el acceso, y avisa de que deja a su entrenador');
    ok(rol.cliente.dias, 'y al elegir prueba pide los días');
    ok(/Pasar a cliente/.test(rol.entrenador.texto) && /sus clientes se quedarán sin entrenador/.test(rol.entrenador.texto)
       && !rol.entrenador.selector,
       'con un entrenador: ofrece pasarlo a cliente y avisa de lo que pasa con sus clientes');
    ok(/tu propia cuenta/.test(rol.propia) && !/Pasar a/.test(rol.propia),
       '🔴 la cuenta propia no se puede cambiar (perdería el panel)');
    ok(rol.sinAdmin, 'y sin ser admin la tarjeta no se ve');

    console.log('\n13s. Volver a vincular a quien ya tiene cuenta');
    /* Jhon (15/09): tras pasar un entrenador a cliente, él y sus clientes
       quedaban sin entrenador y no había forma de volver a vincularlos. Dos
       vías: el cliente acepta una invitación, o el admin lo asigna. Guardar
       necesita Firebase (reglas §12); aquí, qué se ofrece en cada caso. */
    const vinculo = await page.evaluate(()=>{
      const r = {};
      const inv = { trainerId:'c1', usado:false, usadoPor:null };
      const e = (perfil, i) => estadoInvitacionConSesion(perfil, i, 'u1');
      r.estados = {
        aceptar: e({ role:'client', trainerId:null }, inv),
        yaTiene: e({ role:'client', trainerId:'c2' }, inv),
        yaEsTuyo: e({ role:'client', trainerId:'c1' }, inv),
        entrenador: e({ role:'trainer', trainerId:null }, inv),
        usada: e({ role:'client', trainerId:null }, { ...inv, usado:true, usadoPor:'otro' }),
        aceptada: e({ role:'client', trainerId:'c1' }, { ...inv, usado:true, usadoPor:'u1' }),
        noValida: e({ role:'client', trainerId:null }, null),
        sinPerfil: e(null, inv),
      };
      const d = document.createElement('div');
      d.innerHTML = htmlInvitacionConSesion('aceptar', { nombre:'Carlos Pérez', foto:null });
      r.aceptarHtml = { texto: d.textContent.replace(/\s+/g,' '), boton: !!d.querySelector('button[onclick^="aceptarInvitacionConSesion"]') };
      r.yaTieneTexto = htmlInvitacionConSesion('ya-tiene', { nombre:'Carlos Pérez' });

      const lista = [{ uid:'c1', nombre:'Carlos Pérez' }, { uid:'c2', nombre:'Marta Gil' }];
      __pintarCuentaRolPrueba('u-laura', { name:'Laura', email:'laura@ejemplo.es', role:'client', trainerId:null }, lista);
      const sel = () => document.getElementById('rol-entrenador');
      const res = () => document.getElementById('rol-resultado').textContent.replace(/\s+/g,' ');
      r.sinCoach = { opciones: sel() ? sel().options.length : 0, valor: sel() && sel().value, texto: res() };
      __pintarCuentaRolPrueba('u-laura', { name:'Laura', email:'laura@ejemplo.es', role:'client', trainerId:'c2' }, lista);
      r.conCoach = { valor: sel() && sel().value, texto: res() };
      __pintarCuentaRolPrueba('u-pablo', { name:'Pablo', email:'pablo@ejemplo.es', role:'trainer', trainerId:null }, lista);
      r.entrenadorSinAsignar = !sel();
      __pintarCuentaRolPrueba(null, null);
      return r;
    });
    ok(vinculo.estados.aceptar === 'aceptar', 'un cliente sin entrenador puede aceptar la invitación');
    ok(vinculo.estados.yaTiene === 'ya-tiene' && vinculo.estados.yaEsTuyo === 'ya-es-tuyo',
       'si ya tiene entrenador no se le ofrece (y si es el mismo, se le dice)');
    ok(vinculo.estados.entrenador === 'es-entrenador', 'una cuenta de entrenador tampoco');
    ok(vinculo.estados.usada === 'usada' && vinculo.estados.aceptada === 'ya-aceptada'
       && vinculo.estados.noValida === 'no-valida' && vinculo.estados.sinPerfil === 'sin-perfil',
       'y una invitación usada, aceptada, inexistente o sin perfil tiene su explicación');
    ok(vinculo.aceptarHtml.boton && /Carlos Pérez/.test(vinculo.aceptarHtml.texto)
       && /Te propone ser tu entrenador/i.test(vinculo.aceptarHtml.texto)
       && /historial se queda/.test(vinculo.aceptarHtml.texto),
       'al aceptar ve quién le invita, qué verá y que su historial se queda');
    ok(/desvincule/.test(vinculo.yaTieneTexto), 'a quien ya tiene entrenador se le dice qué hacer');
    ok(vinculo.sinCoach.opciones === 3 && vinculo.sinCoach.valor === '' && /no tiene entrenador/.test(vinculo.sinCoach.texto)
       && /Asignar entrenador/.test(vinculo.sinCoach.texto) && /sin que el cliente lo acepte/.test(vinculo.sinCoach.texto),
       'en tu panel, un cliente sin entrenador se puede asignar a uno, avisando de que no lo acepta él');
    ok(vinculo.conCoach.valor === 'c2' && /Ahora le entrena Marta Gil/.test(vinculo.conCoach.texto),
       'si ya tiene, sale marcado quién le entrena');
    ok(vinculo.entrenadorSinAsignar, 'a una cuenta de entrenador no se le asigna entrenador');

    console.log('\n13t. Invitación destacada, pedir otro entrenador y Cuentas en Ajustes');
    /* Jhon (15/09): la invitación "costaba verla, salía muy random"; tiene que
       decir que ahora no tiene entrenador y dejar aceptar o pedir otro, que
       avisa al admin. Y "Cambiar el rol" no pinta en Entrenadores: a Ajustes. */
    const pedir = await page.evaluate(()=>{
      const r = {};
      r.estadoPedido = estadoInvitacionConSesion(
        { role:'client', trainerId:null, pideEntrenador:{ pendiente:true } }, { trainerId:'c1', usado:false }, 'u1');
      const d = document.createElement('div');
      d.innerHTML = htmlInvitacionConSesion('aceptar', { nombre:'Carlos Pérez' });
      r.aceptar = { violeta: !!d.querySelector('.aviso-coach'), texto: d.textContent.replace(/\s+/g,' '),
                    otro: !!d.querySelector('button[onclick^="pedirOtroEntrenador"]') };
      d.innerHTML = htmlInvitacionConSesion('pedido', { nombre:'Carlos Pérez' });
      r.pedido = { texto: d.textContent.replace(/\s+/g,' '), otro: !!d.querySelector('button[onclick^="pedirOtroEntrenador"]'),
                   aceptar: !!d.querySelector('#inv-aceptar') };

      const aviso = document.getElementById('aviso-invitacion-sesion');
      const perfil = document.getElementById('cuenta-avatar');
      r.arriba = !!(aviso && perfil && (aviso.compareDocumentPosition(perfil) & Node.DOCUMENT_POSITION_FOLLOWING));
      r.fueraDeSesion = !document.getElementById('auth-logged-in').contains(aviso);

      document.body.classList.add('es-entrenador','es-admin');
      __pintarPeticionesPrueba([{ name:'Laura', email:'laura@ejemplo.es', pideEntrenador:{ pendiente:true, ts: Date.now() } }]);
      r.peticion = { texto: document.getElementById('rol-peticiones').textContent.replace(/\s+/g,' '),
                     violeta: !!document.querySelector('#rol-peticiones .aviso-coach'),
                     fueraDeLaTarjeta: !document.getElementById('pane-cuentas').contains(document.getElementById('rol-peticiones')),
                     asignar: !!document.querySelector('#rol-peticiones button[onclick^="atenderPeticion"]'),
                     punto: document.getElementById('config-btn').classList.contains('con-punto') };
      __pintarPeticionesPrueba([]);
      r.sinPeticiones = !document.getElementById('config-btn').classList.contains('con-punto')
        && !document.getElementById('rol-peticiones').textContent.trim();
      r.enAjustes = !!document.querySelector('#config-panel #pane-cuentas #pane-rol')
        && !document.querySelector('#pane-coaches #pane-rol');
      document.body.classList.remove('es-entrenador','es-admin');
      return r;
    });
    ok(pedir.aceptar.violeta && /Ahora mismo no tienes entrenador/.test(pedir.aceptar.texto),
       'la invitación sale destacada en violeta y dice que ahora no tiene entrenador');
    ok(/Aceptar a Carlos/.test(pedir.aceptar.texto) && pedir.aceptar.otro && /Prefiero otro entrenador/.test(pedir.aceptar.texto),
       'con dos salidas: aceptar a ese entrenador o pedir otro');
    ok(pedir.arriba && pedir.fueraDeSesion, 'y va arriba del todo de "Tu cuenta", antes de tu perfil');
    ok(pedir.estadoPedido === 'pedido' && /te escribiremos pronto/.test(pedir.pedido.texto)
       && pedir.pedido.aceptar && !pedir.pedido.otro,
       'si ya pidió otro, se le recuerda y aún puede aceptar');
    ok(/1 persona pide entrenador/.test(pedir.peticion.texto) && /laura@ejemplo.es/.test(pedir.peticion.texto)
       && pedir.peticion.asignar && pedir.peticion.punto,
       'al admin le sale en Ajustes quién pide entrenador, con "Asignar" y un punto en el botón de Ajustes');
    ok(pedir.peticion.violeta && pedir.peticion.fueraDeLaTarjeta,
       '🔴 y destacada en violeta, fuera de la tarjeta gris: en gris se pasaba por alto');
    ok(pedir.sinPeticiones, 'sin peticiones, ni lista ni punto');
    ok(pedir.enAjustes, '"Cambiar el rol" está en Ajustes → Cuentas y ya no en Entrenadores');

    console.log('\n13u. La versión, arriba de Ajustes y con aviso cuando hay una nueva');
    /* Jhon (15/09): la versión se quedaba muy abajo para actualizar. La quiso
       como un botón en Ajustes y con un identificador cuando hay una nueva. */
    const version = await page.evaluate(async ()=>{
      const r = {};
      r.pura = { igual: versionEsNueva(APP_VERSION, APP_VERSION), nada: versionEsNueva(null, APP_VERSION),
                 otra: versionEsNueva('2099-01-01 00:00', APP_VERSION) };
      const panel = document.getElementById('config-panel');
      if(panel.classList.contains('hidden')) toggleConfigPanel();
      await comprobarVersionNueva(true);            // contra el propio servidor de la prueba: es la misma
      const cuerpo = panel.querySelector('.routine-panel-header').nextElementSibling;
      const c = document.getElementById('cfg-version');
      const punto = () => document.getElementById('config-btn').classList.contains('con-punto');
      r.arriba = cuerpo.firstElementChild === c;
      r.alDia = { texto: c.textContent.replace(/\s+/g,' '), boton: !!document.getElementById('version-btn'), punto: punto() };
      r.sinTarjetaVieja = ![...panel.querySelectorAll('.section-title')].some(t => t.textContent.trim() === 'Versión');
      r.vaciar = !!panel.querySelector('a[onclick^="limpiarCache"]');
      versionPublicada = '2099-01-01 00:00'; pintarVersion();
      r.nueva = { violeta: !!c.querySelector('.aviso-coach'), texto: c.textContent.replace(/\s+/g,' '),
                  boton: !!c.querySelector('button[onclick^="recargarUltimaVersion"]'), punto: punto(),
                  titulo: document.getElementById('config-btn').title };
      versionPublicada = null; pintarVersion();
      r.trasActualizar = !punto();
      fijarPeticionesAjustes(1); r.puntoPeticiones = punto();
      versionPublicada = '2099-01-01 00:00'; pintarVersion(); fijarPeticionesAjustes(0);
      r.peticionesNoApaganVersion = punto();
      versionPublicada = null; pintarVersion();
      toggleConfigPanel();
      return r;
    });
    ok(!version.pura.igual && !version.pura.nada && version.pura.otra, 'solo hay versión nueva si la publicada es distinta');
    ok(version.arriba, 'la versión va arriba del todo de Ajustes');
    ok(version.alDia.boton && /Buscar actualización/.test(version.alDia.texto) && /última versión/.test(version.alDia.texto)
       && !version.alDia.punto,
       'como un botón "Buscar actualización", que dice que estás al día');
    ok(version.sinTarjetaVieja && version.vaciar, 'la tarjeta de abajo se fue, y "vaciar caché" sigue a mano');
    ok(version.nueva.violeta && /Hay una versión nueva/.test(version.nueva.texto) && version.nueva.boton,
       'con una nueva publicada sale en violeta, con "Actualizar ahora"');
    ok(version.nueva.punto && /versión nueva/.test(version.nueva.titulo),
       'y un punto en el botón de Ajustes para enterarse sin ir a buscarla');
    ok(version.trasActualizar, 'sin versión nueva, el punto se va');
    ok(version.puntoPeticiones && version.peticionesNoApaganVersion,
       'el punto lo comparten la versión y las peticiones de entrenador, sin apagarse la una a la otra');

    console.log('\n13v. Kilos y libras por ejercicio');
    /* Idea de Jhon del 09/09, hecha el 16/09. Lo que se comprueba aquí es que
       cambiar de unidad NO toca lo guardado: en los datos siempre hay kilos. */
    const unidades = await page.evaluate(async ()=>{
      if(STORAGE.backend.name !== 'local') return { saltado:true };   // nunca contra la nube
      const tic = () => new Promise(res => setTimeout(res, 20));
      const r = {};
      const act = getActive();
      showTab('log', document.getElementById('tab-log'));
      openWeekDetail(1);
      openSession(act.plan[0].days[0].s);
      await tic();
      openExDetail(0);
      await tic();
      /* Se escribe en el campo y se dispara el change, que es lo que hace el
         dedo: llamar a anotarPeso() a pelo dejaría el cuadro con lo de antes. */
      const escribir = v => {
        const inp = document.querySelector('#sets-container .set-inp');
        inp.value = v;
        inp.dispatchEvent(new Event('change'));
      };
      const campo = () => document.querySelector('#sets-container .set-inp').value;
      const etiqueta = () => document.querySelector('#sets-container .set-unit').textContent;
      const selector = () => document.getElementById('ex-unidad');
      // Como se hace con el dedo: elegir en el desplegable y que dispare su change.
      const elegirUnidad = u => { selector().value = u; selector().dispatchEvent(new Event('change')); };
      const guardado = () => curEx[curExIndex].sets[0].kg;

      escribir('100');
      r.enKg = { guardado: guardado(), campo: campo(), etiqueta: etiqueta(), boton: selector().value,
                 esDesplegable: selector().tagName === 'SELECT',
                 opciones: [...selector().options].map(o => o.value).join(','),
                 etiquetaVisible: !!document.querySelector('label[for="ex-unidad"]') };
      elegirUnidad('lb');
      r.enLb = { guardado: guardado(), campo: campo(), etiqueta: etiqueta(), boton: selector().value,
                 marcadas: Object.keys(DB.unidades || {}).length };
      escribir('225');
      r.tecleadoEnLb = { guardado: guardado(), campo: campo() };
      elegirUnidad('kg');
      r.vuelta = { etiqueta: etiqueta(), marcadas: Object.keys(DB.unidades || {}).length };
      const kgGuardados = guardado();
      volverAtras(); volverAtras(); closeWeekDetail();

      // El entrenador ve los pesos de su cliente en la unidad del cliente.
      __pintarDetallePrueba({ nombre:'Laura', unidades:{ [claveEjercicioLaxa('Press banca')]:'lb' },
        rutinas:[{ id:'r1', name:'Plan', sessions:{ 1:{ date:'01/09',
            exercises:[{ name:'Press banca', sets:[{ kg:100, reps:'8' }] }] } },
          plan:[{ num:1, title:'Semana 1', days:[{ s:1, name:'S1 · Push', type:'Push', ex:[['Press banca','4×8']] }] }] }] });
      verRutinaDetalle('r1');
      r.cliente = document.getElementById('rutina-cliente-cuerpo').textContent.replace(/\s+/g,' ');
      cerrarDetalleCliente();
      r.kgGuardados = kgGuardados;
      return r;
    });
    ok(!unidades.saltado, 'la prueba corre en local, nunca contra la nube');
    ok(unidades.enKg.guardado === 100 && unidades.enKg.campo === '100' && unidades.enKg.etiqueta === 'kg'
       && unidades.enKg.boton === 'kg',
       'por defecto, kilos: lo tecleado se guarda tal cual');
    ok(unidades.enKg.esDesplegable && unidades.enKg.opciones === 'kg,lb' && unidades.enKg.etiquetaVisible,
       'la unidad se elige en un desplegable kg/lb con su etiqueta: un botón gris no se entendía');
    ok(unidades.enLb.guardado === 100 && unidades.enLb.campo === '220.5' && unidades.enLb.etiqueta === 'lb'
       && unidades.enLb.marcadas === 1,
       '🔴 al pasar a libras se ven 220,5 lb pero lo GUARDADO siguen siendo 100 kg');
    ok(Math.abs(unidades.tecleadoEnLb.guardado - 102.06) < 0.05 && unidades.tecleadoEnLb.campo === '225',
       'y al teclear 225 lb se guardan 102,06 kg');
    ok(unidades.vuelta.etiqueta === 'kg' && unidades.vuelta.marcadas === 0,
       'volver a kilos deja el ejercicio como estaba, sin marca');
    ok(Math.abs(unidades.kgGuardados - 102.06) < 0.05, 'y el peso guardado no cambia al cambiar de unidad');
    ok(/220,5 lb/.test(unidades.cliente),
       'el entrenador ve ese ejercicio en libras, como su cliente: '+(unidades.cliente.match(/[\d,]+ lb/)||[''])[0]);

    console.log('\n13w. Renombrar un ejercicio: sugerencias, aviso sin foto y "toda la rutina"');
    /* Jhon entrenando (17/09): renombró un ejercicio y se quedó sin imagen, y
       pidió poder llevar el cambio a toda la rutina. */
    const renom = await page.evaluate(async ()=>{
      if(STORAGE.backend.name !== 'local') return { saltado:true };   // nunca contra la nube
      const tic = () => new Promise(res => setTimeout(res, 20));
      const r = {};
      const act = getActive();
      showTab('log', document.getElementById('tab-log'));
      openWeekDetail(1);
      openSession(act.plan[0].days[0].s);
      await tic();
      openExDetail(0);
      await tic();
      const campo = document.getElementById('ex-detail-title');
      const original = curEx[curExIndex].name;
      const diasAntes = diasConEjercicio(getActive(), original);

      // Mientras escribe: nombres del catálogo parecidos.
      campo.value = 'remo en maq';
      campo.dispatchEvent(new Event('input'));
      r.sugerencias = { texto: document.getElementById('ex-sugerencias').textContent.replace(/\s+/g,' '),
                        botones: document.querySelectorAll('#ex-sugerencias .ex-sug-btn').length };

      // Confirma un nombre que NO está en el catálogo.
      campo.value = 'Remo en máquina';
      campo.dispatchEvent(new Event('change'));
      await tic();
      r.sinFoto = document.getElementById('ex-sugerencias').textContent.replace(/\s+/g,' ');
      r.enSesion = curEx[curExIndex].name;
      const aviso = () => document.getElementById('ex-renombrar').textContent.replace(/\s+/g,' ');
      r.pregunta = { texto: aviso(),
                     botones: document.querySelectorAll('#ex-renombrar button').length,
                     diasAntes };
      r.planAntes = diasConEjercicio(getActive(), 'Remo en máquina');

      aplicarRenombrado('rutina');
      r.tras = { enPlan: diasConEjercicio(getActive(), 'Remo en máquina'),
                 viejoEnPlan: diasConEjercicio(getActive(), original),
                 avisoCerrado: aviso() === '' };

      // Y una sugerencia devuelve un nombre con foto.
      const conFoto = sugerenciasEjercicio('remo', 6)[0];
      usarNombreSugerido(conFoto);
      await tic();
      r.recuperaFoto = { nombre: curEx[curExIndex].name,
                         hayFigura: !!document.querySelector('#ex-musculos figure'),
                         sinSugerencias: document.getElementById('ex-sugerencias').textContent.trim() === '' };
      aplicarRenombrado('sesion');
      volverAtras(); volverAtras(); closeWeekDetail();
      return r;
    });
    ok(!renom.saltado, 'la prueba corre en local, nunca contra la nube');
    ok(renom.sugerencias.botones > 0 && /Remo/.test(renom.sugerencias.texto),
       'al escribir salen nombres del catálogo parecidos: '+renom.sugerencias.texto.slice(0, 70));
    ok(/No tenemos foto/.test(renom.sinFoto) && renom.enSesion === 'Remo en máquina',
       '🔴 con un nombre sin foto se avisa en vez de dejar el hueco vacío, y el nombre se respeta');
    ok(renom.pregunta.botones === 2 && /toda la rutina/i.test(renom.pregunta.texto)
       && /Solo en esta sesión/i.test(renom.pregunta.texto) && renom.pregunta.diasAntes > 0,
       'y pregunta si cambiarlo solo en la sesión o en toda la rutina');
    ok(renom.planAntes === 0 && renom.tras.enPlan === renom.pregunta.diasAntes && renom.tras.viejoEnPlan === 0,
       'al elegir "toda la rutina", el plan pasa a llamarlo como el nuevo en todos sus días');
    ok(renom.tras.avisoCerrado, 'y el aviso desaparece al decidir');
    ok(renom.recuperaFoto.hayFigura && renom.recuperaFoto.sinSugerencias,
       'eligiendo una sugerencia del catálogo, vuelve la foto: '+renom.recuperaFoto.nombre);

    console.log('\n13x. La espera mientras bajan los datos de la cuenta');
    /* Jhon (17/09): al abrir se veían los datos de este dispositivo —o una foto
       vacía— mientras Firebase contestaba, y el cliente los tomaba por suyos. */
    const espera = await page.evaluate(async ()=>{
      const tic = () => new Promise(res => setTimeout(res, 30));
      const capa = document.getElementById('esperando-nube');
      const r = { sinSesion: { visible: !capa.classList.contains('hidden'),
                               debe: debeEsperarNube() } };
      // Este dispositivo recuerda una sesión: al abrir habría que tapar.
      recordarSesion(true);
      r.conSesion = { debe: debeEsperarNube() };
      mostrarEsperaNube();
      await tic();
      r.tapando = { visible: !capa.classList.contains('hidden'),
                    opaca: getComputedStyle(capa).backgroundColor,
                    porEncima: +getComputedStyle(capa).zIndex,
                    fondoQuieto: document.body.classList.contains('capa-abierta'),
                    figuras: capa.querySelectorAll('.esp-figura').length,
                    frase: document.getElementById('esp-frase').textContent,
                    puntos: capa.querySelectorAll('.esp-punto').length };
      quitarEsperaNube();
      await tic();
      r.tras = { visible: !capa.classList.contains('hidden'),
                 fondoQuieto: document.body.classList.contains('capa-abierta') };
      recordarSesion(false);
      return r;
    });
    ok(!espera.sinSesion.visible && !espera.sinSesion.debe,
       'sin sesión en este dispositivo no se tapa nada: se entra directo');
    ok(espera.conSesion.debe, 'con sesión recordada sí, y se sabe ANTES de que Firebase conteste');
    ok(espera.tapando.visible && espera.tapando.figuras === 1 && espera.tapando.puntos > 1,
       'se ve la silueta entrenando mientras se espera');
    ok(!/rgba\(.*, 0\)/.test(espera.tapando.opaca) && espera.tapando.porEncima > 500,
       '🔴 tapa la app ENTERA (fondo opaco y por encima de todo): ver los datos de detrás era el problema');
    ok(/cuenta|rutinas|sesiones|marcas/i.test(espera.tapando.frase),
       'y dice qué está pasando: '+espera.tapando.frase);
    ok(espera.tapando.fondoQuieto, 'el fondo no hace scroll por debajo');
    ok(!espera.tras.visible && !espera.tras.fondoQuieto,
       'cuando la nube contesta, el velo se va y la app queda usable');

    console.log('\n13y. El entrenador reordena los ejercicios de una sesión del cliente');
    /* Pedido por un entrenador (23/09/2026) montando la rutina de un cliente:
       se podía añadir y quitar, pero no mover, así que para colar un ejercicio
       en medio había que reescribir la lista entera. */
    const ordenCliente = await page.evaluate(async ()=>{
      const r = {};
      const nombres = () => [...document.querySelectorAll('#editor-ejercicios .fila-ej')]
        .map(f => f.querySelector('.ej-in-nombre').value);
      /* Lo mismo que lee guardarEjerciciosCliente() al guardar: si esto sale en
         el orden nuevo, se guarda en el orden nuevo. */
      const filas = () => [...document.querySelectorAll('#editor-ejercicios .fila-ej')]
        .map(f => [f.querySelector('.ej-in-nombre').value,
                   f.querySelector('.ej-in-esquema').value,
                   f.querySelector('.ej-in-nota').value]);
      __pintarDetallePrueba({ nombre:'Laura', rutinas:[{ id:'ro', name:'Orden', sessions:{},
        plan:[{ num:1, title:'Semana 1', days:[{ s:1, name:'S1 · Torso', type:'Torso',
          ex:[['Press banca','4×8'], ['Remo','4×10','agarre cerrado'], ['Curl','3×12']] }] }] }] });
      verRutinaDetalle('ro');
      editarSesionCliente(1);
      r.antes = nombres();
      const fila = i => document.querySelectorAll('#editor-ejercicios .fila-ej')[i];
      const flecha = (i, d) => fila(i).querySelector('.ej-flecha[data-d="'+d+'"]');
      r.hayFlechas = !!flecha(0, 1) && !!flecha(0, -1);
      r.primeraNoSube = getComputedStyle(flecha(0, -1)).pointerEvents === 'none';
      r.ultimaNoBaja  = getComputedStyle(flecha(2, 1)).pointerEvents === 'none';
      r.primeraSiBaja = getComputedStyle(flecha(0, 1)).pointerEvents !== 'none';

      flecha(2, -1).click();                       // el Curl sube un puesto
      r.trasSubir = nombres();
      flecha(0, 1).click();                        // el press banca baja
      r.trasBajar = nombres();
      r.conNota = filas();
      /* Los extremos se apagan solos tras moverse: el Curl, ahora el primero,
         ya no puede subir. */
      r.nuevaPrimeraNoSube = getComputedStyle(flecha(0, -1)).pointerEvents === 'none';

      cancelarEdicionCliente();
      // Lo que se ve del plan del día: el orden de verdad, sin el editor abierto.
      const plan = [...document.querySelectorAll('#rutina-cliente .plan-linea span:first-child')]
        .map(e => e.textContent.trim());
      cerrarDetalleCliente();
      r.planTrasCancelar = plan;
      return r;
    });
    ok(ordenCliente.hayFlechas, 'cada ejercicio del editor lleva sus flechas de subir y bajar');
    ok(ordenCliente.primeraNoSube && ordenCliente.ultimaNoBaja && ordenCliente.primeraSiBaja,
       'el primero no sube y el último no baja: las flechas que no llevan a ningún sitio se apagan');
    ok(ordenCliente.trasSubir.join(',') === 'Press banca,Curl,Remo',
       '🔴 subir mueve el ejercicio un puesto: '+ordenCliente.trasSubir.join(', '));
    ok(ordenCliente.trasBajar.join(',') === 'Curl,Press banca,Remo',
       'y bajar, al revés: '+ordenCliente.trasBajar.join(', '));
    ok(ordenCliente.conNota[2][1] === '4×10' && ordenCliente.conNota[2][2] === 'agarre cerrado',
       'el esquema y la indicación viajan con su ejercicio, no se quedan en la fila');
    ok(ordenCliente.nuevaPrimeraNoSube, 'y el que pasa a ser primero ya no puede subir');
    ok(ordenCliente.planTrasCancelar.join(',') === 'Press banca,Remo,Curl',
       'cancelar deja el plan del cliente como estaba: solo se guarda al Guardar');

    console.log('\n13z. Arrastrar para reordenar, más fino');
    /* Jhon (23/09): "es muy inexacto y muy difícil, empieza a hacer cosas raras
       y no van donde quiero colocarlos". Tres causas, tres pruebas. */
    const finura = await page.evaluate(async ()=>{
      if(STORAGE.backend.name !== 'local') return { saltado:true };
      const tic = (ms=30) => new Promise(res => setTimeout(res, ms));
      const r = {};
      const act = getActive();
      showTab('log', document.getElementById('tab-log'));
      openWeekDetail(1);
      openSession(act.plan[0].days[0].s);
      await tic();
      // Cuatro ejercicios: dos filas de dos, que es donde se lía.
      curEx = ['Uno','Dos','Tres','Cuatro'].map(n => ({ name:n, sets:[{kg:'',reps:''}] }));
      renderExButtons();
      await tic(60);
      const ev = (el,t,x,y) => el.dispatchEvent(
        new PointerEvent(t,{bubbles:true, clientX:x, clientY:y, pointerId:1}));

      /* 1) La tarjeta cae DONDE SE VE, no donde está el dedo. Se coge por el
            borde derecho (el dedo queda media tarjeta a la derecha del centro)
            y se lleva hasta que la tarjeta tapa la primera casilla. Antes, el
            dedo caía a la derecha del centro de esa casilla y el ejercicio se
            colaba DETRÁS: una posición más allá de donde se veía. */
      let g = document.getElementById('ex-mosaico');
      let origen = g.children[3];
      origen.setPointerCapture = () => {};
      const c3 = origen.getBoundingClientRect(), c0 = g.children[0].getBoundingClientRect();
      ev(origen, 'pointerdown', c3.left + c3.width - 8, c3.top + c3.height/2);
      await tic(420);   // la pulsación larga, con margen de sobra
      const dedo = { x: c0.left + c0.width/2 + 10, y: c0.top + c0.height/2 };
      ev(g, 'pointermove', dedo.x, dedo.y);
      await tic();
      ev(g, 'pointerup', dedo.x, dedo.y);
      await tic(120);
      r.dondeSeVe = curEx.map(e => e.name);

      /* 2) Un temblor del dedo no mueve nada. Antes, el hueco saltaba a la
            casilla de al lado con el primer píxel: se recolocaba la rejilla, y
            con la rejilla nueva volvía a saltar. Eso era lo de "hacer cosas
            raras". */
      curEx = ['Uno','Dos','Tres','Cuatro'].map(n => ({ name:n, sets:[{kg:'',reps:''}] }));
      renderExButtons();
      await tic(60);
      g = document.getElementById('ex-mosaico');
      origen = g.children[0];
      origen.setPointerCapture = () => {};
      const c = origen.getBoundingClientRect();
      ev(origen, 'pointerdown', c.left + c.width/2, c.top + c.height/2);
      await tic(420);   // la pulsación larga, con margen de sobra
      for(const d of [3, -2, 5, 1, -4]) ev(g, 'pointermove', c.left + c.width/2 + d, c.top + c.height/2 + d);
      await tic();
      r.huecoQuieto = [...g.children].findIndex(el => el.classList.contains('mos-hueco'));
      ev(g, 'pointerup', c.left + c.width/2, c.top + c.height/2);
      await tic(120);
      r.temblor = curEx.map(e => e.name);

      /* 3) Llevar la tarjeta al borde desplaza la pantalla. Mientras se arrastra
            el scroll está bloqueado, así que sin esto no había forma de llevar
            un ejercicio a una fila que no estuviera ya a la vista. */
      document.body.style.minHeight = '3000px';
      window.scrollTo(0, 900);
      await tic();
      g = document.getElementById('ex-mosaico');
      origen = g.children[0];
      origen.setPointerCapture = () => {};
      const c4 = origen.getBoundingClientRect();
      ev(origen, 'pointerdown', c4.left + c4.width/2, c4.top + c4.height/2);
      await tic(420);   // la pulsación larga, con margen de sobra
      r.scrollAntes = window.scrollY;
      ev(g, 'pointermove', c4.left + c4.width/2, 20);     // dedo pegado al borde de arriba
      /* Dos tramos con el dedo QUIETO en el borde: al quitar la tarjeta de la
         rejilla el navegador ya recoloca el scroll un poco él solo, y con una
         sola medición eso se confundiría con el desplazamiento automático. Lo
         que solo puede hacer el nuestro es SEGUIR subiendo sin que el dedo se
         mueva. */
      await tic(200);
      r.scrollMedio = window.scrollY;
      await tic(200);
      r.scrollDespues = window.scrollY;
      ev(g, 'pointerup', c4.left + c4.width/2, 20);
      await tic(120);
      document.body.style.minHeight = '';
      window.scrollTo(0, 0);
      r.sinTarjetaSuelta = !document.querySelector('.mos-card.arrastrando')
                        && !document.querySelector('.mos-hueco');
      r.completos = curEx.length === 4 && new Set(curEx.map(e => e.name)).size === 4;
      return r;
    });
    ok(finura.saltado || finura.dondeSeVe.join(',') === 'Cuatro,Uno,Dos,Tres',
       '🔴 la tarjeta cae donde SE VE, no donde está el dedo: '+(finura.dondeSeVe||[]).join(', '));
    ok(finura.saltado || finura.huecoQuieto === 0,
       '🔴 un temblor de unos píxeles no mueve el hueco de sitio');
    ok(finura.saltado || finura.temblor.join(',') === 'Uno,Dos,Tres,Cuatro',
       'y al soltar sin querer, el orden se queda como estaba');
    ok(finura.saltado || finura.scrollAntes > 880,
       'coger una tarjeta pegada al borde no mueve la pantalla hasta que mueves el dedo');
    ok(finura.saltado || (finura.scrollMedio < finura.scrollAntes - 80
                          && finura.scrollDespues < finura.scrollMedio - 80),
       '🔴 con la tarjeta en el borde de arriba, la pantalla sigue subiendo sola: '
       +finura.scrollAntes+' → '+finura.scrollMedio+' → '+finura.scrollDespues);
    ok(finura.saltado || (finura.sinTarjetaSuelta && finura.completos),
       'al soltar no queda ninguna tarjeta levantada ni se pierde ningún ejercicio');

    console.log('\n13aa. La barra de pestañas, abajo');
    /* Rediseño del 23/09 (propuesta de v0 que eligió Jhon): con el móvil en una
       mano, arriba no llega el pulgar. */
    const barra = await page.evaluate(async ()=>{
      const tic = (ms=60) => new Promise(res => setTimeout(res, ms));
      const r = {};
      showTab('inicio', document.getElementById('tab-inicio'));
      await tic();
      const tabs = document.querySelector('.tabs');
      const cs = getComputedStyle(tabs);
      const caja = tabs.getBoundingClientRect();
      r.fija = cs.position === 'fixed';
      r.pegadaAbajo = Math.abs(caja.bottom - window.innerHeight) < 2;
      r.orden = [...tabs.children].map(b => b.querySelector('span').textContent);
      const circulo = tabs.querySelector('.tab-centro svg').getBoundingClientRect();
      r.centrado = Math.abs((circulo.left + circulo.width/2) - window.innerWidth/2) < 6;
      r.sobresale = circulo.top < caja.top - 8;

      // Lo último de la pantalla no puede quedar debajo de la barra.
      window.scrollTo(0, document.documentElement.scrollHeight);
      await tic();
      const ultimo = [...document.querySelectorAll('#pane-inicio > *')]
        .filter(e => e.getBoundingClientRect().height > 0).pop();
      r.contenidoLibre = ultimo.getBoundingClientRect().bottom <= caja.top + 1;

      // Ajustes: abre su panel y NO cambia de pestaña.
      r.engranajeFueraDeLaCabecera = !document.querySelector('header #config-btn');
      const ajustes = document.getElementById('config-btn');
      r.ajustesEnLaBarra = ajustes.classList.contains('tab');
      ajustes.click();
      await tic(400);
      const panel = document.getElementById('config-panel');
      r.abreAjustes = !panel.classList.contains('hidden');
      r.inicioSigueActivo = document.getElementById('tab-inicio').classList.contains('active')
                         && !ajustes.classList.contains('active');
      toggleConfigPanel();
      await tic(400);

      /* El cronómetro de descanso también vive abajo: tiene que quedar ENCIMA de
         la barra, y el contenido tiene que ganar hueco mientras corre. */
      const act = getActive();
      showTab('log', document.getElementById('tab-log'));
      openWeekDetail(1); openSession(act.plan[0].days[0].s);
      await tic();
      const huecoAntes = parseFloat(getComputedStyle(document.body).paddingBottom);
      startTimer(90);
      await tic(400);                    // sube deslizándose: hay que dejarle llegar
      const crono = document.getElementById('rest-timer').getBoundingClientRect();
      r.cronoEncima = crono.bottom <= caja.top + 1;
      r.huecoCrece = parseFloat(getComputedStyle(document.body).paddingBottom) > huecoAntes;
      skipTimer();
      await tic();
      r.huecoVuelve = parseFloat(getComputedStyle(document.body).paddingBottom) === huecoAntes;
      showTab('inicio', document.getElementById('tab-inicio'));
      return r;
    });
    ok(barra.fija && barra.pegadaAbajo, 'la barra va fija al borde de abajo');
    ok(barra.orden.join(',') === 'Entrenar,Resumen,Inicio,Medidas,Ajustes',
       'en el orden de la propuesta: '+barra.orden.join(' · '));
    /* 23/09/2026: se llamaba "Registrar" y varias personas no daban con ella
       para empezar la sesión. Nadie piensa "voy a registrar". */
    ok(barra.orden[0] === 'Entrenar', '🔴 la pestaña dice lo que vas a hacer, no lo que hace la app');
    ok(barra.centrado && barra.sobresale,
       'Inicio es el círculo del centro y sobresale por encima de la barra');
    ok(barra.contenidoLibre, '🔴 la barra no tapa lo último de la pantalla');
    ok(barra.engranajeFueraDeLaCabecera && barra.ajustesEnLaBarra,
       'el engranaje ya no está en la cabecera: bajó a la barra');
    ok(barra.abreAjustes && barra.inicioSigueActivo,
       'Ajustes abre su panel sin cambiar de pestaña: no es una pestaña');
    ok(barra.cronoEncima, '🔴 el cronómetro de descanso queda encima de la barra, no sobre ella');
    ok(barra.huecoCrece && barra.huecoVuelve,
       'y mientras descansas el contenido gana hueco, para que el botón de guardar no se esconda');

    console.log('\n13ab. El anillo de progreso vuelve a Inicio');
    const anillo = await page.evaluate(async ()=>{
      const tic = (ms=80) => new Promise(res => setTimeout(res, ms));
      const act = getActive();
      const ses = getActiveSessions();
      // Tres sesiones dadas por hechas, para que el anillo tenga algo que pintar.
      act.plan.flatMap(w => w.days.map(d => d.s)).slice(0, 3)
        .forEach(id => { if(!ses[id]) ses[id] = { date:'01/09', exercises:[] }; });
      showTab('inicio', document.getElementById('tab-inicio'));
      updateHome();
      await tic(160);                                  // los dos fotogramas de la animación
      const c = document.getElementById('home-anillo');
      const C = 2 * Math.PI * 37;
      const pct = parseInt(document.getElementById('home-prog-pct').textContent, 10);
      return { hay: !!c,
               pct,
               offset: parseFloat(c.getAttribute('stroke-dashoffset')),
               esperado: C * (1 - pct/100),
               vacio: C,
               nombre: document.getElementById('home-prog-name').textContent,
               meta: document.getElementById('home-prog-meta').textContent,
               abreRutinas: !!document.querySelector('.hp-rutina[onclick^="toggleRoutinePanel"]'),
               pastillas: document.querySelectorAll('.hp-acciones .hp-accion').length };
    });
    ok(anillo.hay, 'la tarjeta del programa vuelve a tener su anillo');
    ok(anillo.pct > 0 && Math.abs(anillo.offset - anillo.esperado) < 1,
       'y se rellena con el porcentaje de verdad ('+anillo.pct+'%)');
    ok(anillo.offset < anillo.vacio - 1, 'no se queda vacío: se ve el avance');
    ok(/sesiones/.test(anillo.meta) && /Semana/.test(anillo.meta),
       'debajo del nombre, las semanas y las sesiones: '+anillo.meta);
    ok(anillo.abreRutinas, 'tocar el nombre de la rutina sigue abriendo "Mis rutinas"');
    ok(anillo.pastillas === 3, 'y las tres pastillas de cambiar, añadir y borrar siguen ahí');

    console.log('\n14. Nada ha reventado por el camino');
    ok(errores.length === 0, errores.length ? 'errores en consola: '+errores.join(' | ')
                                            : 'ni un error de JavaScript');

  }catch(e){
    console.log('  ❌ la prueba se rompió: '+(e && e.message));
    fallos++;
  }finally{
    await navegador.close();
    srv.close();
  }

  console.log(fallos ? `\n❌ ${fallos} fallo(s)\n` : '\n✅ TODO OK\n');
  process.exit(fallos ? 1 : 0);
})();
