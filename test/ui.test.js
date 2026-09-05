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

    console.log('\n5. Guardar una sesión avisa sin cuadros del navegador');
    const guardado = await page.evaluate(async ()=>{
      curEx[0].sets[0].kg = '60'; curEx[0].sets[0].reps = '10';
      saveSession();
      await new Promise(r=>setTimeout(r,200));
      const a = document.getElementById('aviso-flotante');
      const ses = getActive().sessions[curSession];
      return {texto: a.textContent, visible: a.className.includes('visible'),
              registrada: !!ses, kg: ses && ses.exercises[0].sets[0].kg};
    });
    ok(guardado.registrada, 'la sesión queda registrada');
    ok(guardado.kg === '60', 'con los kilos que se apuntaron');
    ok(guardado.visible && /guardada/i.test(guardado.texto), 'y avisa con el mensaje propio de la app');

    console.log('\n6. Sin cobertura: la app sigue abriendo');
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

    console.log('\n7. Nada ha reventado por el camino');
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
