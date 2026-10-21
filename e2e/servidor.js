/* Servidor estático para las pruebas de Playwright. Solo escucha en
   127.0.0.1 y no sirve nada fuera del repo. Es el mismo criterio que el
   servidor de test/ui.test.js, en un archivo aparte porque Playwright lo
   arranca como un proceso (webServer en playwright.config.js). */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const PUERTO = Number(process.env.PUERTO_E2E) || 8792;

const TIPOS = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.webp':'image/webp', '.svg':'image/svg+xml',
  '.png':'image/png', '.jpeg':'image/jpeg', '.jpg':'image/jpeg', '.woff2':'font/woff2', '.mp4':'video/mp4' };

http.createServer((req,res)=>{
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if(rel === '/') rel = '/index.html';
  const f = path.join(RAIZ, rel);
  if(!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){
    res.writeHead(404); res.end('no'); return;
  }
  res.writeHead(200, {'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream'});
  fs.createReadStream(f).pipe(res);
}).listen(PUERTO, '127.0.0.1', ()=> console.log(`e2e: sirviendo ${RAIZ} en http://127.0.0.1:${PUERTO}`));
