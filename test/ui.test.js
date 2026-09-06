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
    ok(arranque.pestanas === 4, 'la barra tiene 4 pestañas');

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

    console.log('\n6. Una protagonista por pantalla');
    /* Registrar: la semana en curso, fuera del mosaico y con el trato de
       "Entrenamiento de hoy". Se vuelve a la lista de semanas primero: la
       sección anterior deja abierta una sesión. */
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
    ok(!prota.mosaico.includes('Semana '+prota.curso),
       'que ya no se repite dentro del mosaico: '+prota.mosaico.join(', '));
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

    console.log('\n11. Sin cobertura: la app sigue abriendo');
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
    ok(offline.pestanas === 4, 'la interfaz está entera');
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

    console.log('\n12. Nada ha reventado por el camino');
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
