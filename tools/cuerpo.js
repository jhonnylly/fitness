/* Silueta del cuerpo (frontal + dorsal) con los grupos musculares como formas
   independientes, para resaltar los que trabaja cada ejercicio.

   Dos decisiones que sostienen todo el dibujo:

   1. Los músculos se RECORTAN contra la silueta (<clipPath>). Sin eso las
      formas se salen del cuerpo y el resultado parece manchas flotando: los
      deltoides quedaban en el aire y el dorsal era una caja sobresaliendo del
      torso. Con el recorte se puede dibujar cada músculo generoso y dejar que
      el contorno le dé la forma buena.
   2. Formas simples y simétricas, no paths anatómicos a mano alzada: esto se
      ve como miniatura junto al nombre del ejercicio, y a ese tamaño lo que
      importa es DÓNDE está el músculo. Un relieve detallado se convierte en
      una mancha. */

const W = 200, H = 300;
const OFF_D = 100;                     // desplazamiento del cuerpo dorsal

/* Silueta de un cuerpo centrado en cx. Se usa dos veces: como relleno gris y
   como máscara de recorte de los músculos. */
function silueta(cx) {
  return `
    <circle cx="${cx}" cy="25" r="14"/>
    <path d="M ${cx - 6} 36 h 12 v 12 h -12 Z"/>
    <path d="M ${cx - 29} 57
             C ${cx - 29} 48, ${cx - 22} 45, ${cx - 12} 44
             L ${cx + 12} 44 C ${cx + 22} 45, ${cx + 29} 48, ${cx + 29} 57
             L ${cx + 25} 92 C ${cx + 23} 104, ${cx + 21} 112, ${cx + 21} 122
             L ${cx + 23} 148 L ${cx - 23} 148 L ${cx - 21} 122
             C ${cx - 21} 112, ${cx - 23} 104, ${cx - 25} 92 Z"/>
    <path d="M ${cx - 29} 55 C ${cx - 37} 60, ${cx - 38} 70, ${cx - 37} 82
             L ${cx - 38} 108 C ${cx - 38} 118, ${cx - 36} 126, ${cx - 34} 132
             L ${cx - 27} 132 C ${cx - 28} 124, ${cx - 29} 116, ${cx - 29} 106
             L ${cx - 28} 82 C ${cx - 28} 72, ${cx - 26} 63, ${cx - 22} 58 Z"/>
    <path d="M ${cx + 29} 55 C ${cx + 37} 60, ${cx + 38} 70, ${cx + 37} 82
             L ${cx + 38} 108 C ${cx + 38} 118, ${cx + 36} 126, ${cx + 34} 132
             L ${cx + 27} 132 C ${cx + 28} 124, ${cx + 29} 116, ${cx + 29} 106
             L ${cx + 28} 82 C ${cx + 28} 72, ${cx + 26} 63, ${cx + 22} 58 Z"/>
    <path d="M ${cx - 23} 148 C ${cx - 24} 176, ${cx - 22} 196, ${cx - 20} 212
             C ${cx - 19} 232, ${cx - 18} 252, ${cx - 17} 286
             L ${cx - 5} 286 C ${cx - 5} 252, ${cx - 4} 232, ${cx - 3} 212
             C ${cx - 2} 196, ${cx - 2} 176, ${cx - 2} 148 Z"/>
    <path d="M ${cx + 23} 148 C ${cx + 24} 176, ${cx + 22} 196, ${cx + 20} 212
             C ${cx + 19} 232, ${cx + 18} 252, ${cx + 17} 286
             L ${cx + 5} 286 C ${cx + 5} 252, ${cx + 4} 232, ${cx + 3} 212
             C ${cx + 2} 196, ${cx + 2} 176, ${cx + 2} 148 Z"/>`;
}

/* Frente y espalda eran EXACTAMENTE la misma silueta: lo único que las
   distinguía era una etiqueta de 9 px, ilegible en la miniatura de la app. Dos
   señas mínimas lo arreglan sin ensuciar el dibujo: la cara mira al frente, la
   columna se ve por detrás. Van fuera de silueta() porque esa función también
   hace de clipPath y estos trazos no deben recortar nada. */
function caraFrontal(cx) {
  return `<circle cx="${cx - 5}" cy="23" r="2.2"/><circle cx="${cx + 5}" cy="23" r="2.2"/>`;
}
function columnaDorsal(cx) {
  return `<rect x="${cx - 1.2}" y="46" width="2.4" height="88" rx="1.2"/>`;
}

/* Coordenadas pensadas para el cuerpo frontal (cx=50). El dorsal se desplaza.
   Se dibujan a lo grande a propósito: el recorte contra la silueta les da el
   borde correcto. */
const MUSCULOS = {
  // ── Vista frontal ──
  pectoral:      { vista: 'f', s: `<ellipse cx="39" cy="66" rx="12" ry="10"/><ellipse cx="61" cy="66" rx="12" ry="10"/>` },
  deltoides:     { vista: 'f', s: `<circle cx="29" cy="57" r="12"/><circle cx="71" cy="57" r="12"/>` },
  biceps:        { vista: 'f', s: `<ellipse cx="27" cy="82" rx="8" ry="16"/><ellipse cx="73" cy="82" rx="8" ry="16"/>` },
  antebrazo:     { vista: 'f', s: `<ellipse cx="31" cy="115" rx="8" ry="17"/><ellipse cx="69" cy="115" rx="8" ry="17"/>` },
  abdominal:     { vista: 'f', s: `<rect x="41" y="88" width="18" height="48" rx="6"/>` },
  oblicuo:       { vista: 'f', s: `<ellipse cx="32" cy="112" rx="7" ry="20"/><ellipse cx="68" cy="112" rx="7" ry="20"/>` },
  cuadriceps:    { vista: 'f', s: `<ellipse cx="37" cy="180" rx="13" ry="30"/><ellipse cx="63" cy="180" rx="13" ry="30"/>` },
  aductor:       { vista: 'f', s: `<ellipse cx="45" cy="175" rx="6" ry="24"/><ellipse cx="55" cy="175" rx="6" ry="24"/>` },
  abductor:      { vista: 'f', s: `<ellipse cx="29" cy="168" rx="7" ry="20"/><ellipse cx="71" cy="168" rx="7" ry="20"/>` },
  tibial:        { vista: 'f', s: `<ellipse cx="38" cy="250" rx="8" ry="24"/><ellipse cx="62" cy="250" rx="8" ry="24"/>` },

  // ── Vista dorsal ──
  trapecio:      { vista: 'd', s: `<path d="M 34 44 L 66 44 L 58 82 L 42 82 Z"/>` },
  romboides:     { vista: 'd', s: `<rect x="40" y="64" width="20" height="20" rx="4"/>` },
  /* Dos alas inclinadas, no un trapecio: el trapecio se leía como una caja
     pegada a la espalda en vez de como un músculo. */
  dorsal:        { vista: 'd', s: `<ellipse cx="37" cy="96" rx="12" ry="24" transform="rotate(-14 37 96)"/><ellipse cx="63" cy="96" rx="12" ry="24" transform="rotate(14 63 96)"/>` },
  deltoides_post:{ vista: 'd', s: `<circle cx="29" cy="57" r="12"/><circle cx="71" cy="57" r="12"/>` },
  triceps:       { vista: 'd', s: `<ellipse cx="27" cy="84" rx="8" ry="17"/><ellipse cx="73" cy="84" rx="8" ry="17"/>` },
  lumbar:        { vista: 'd', s: `<rect x="41" y="114" width="18" height="22" rx="5"/>` },
  gluteo:        { vista: 'd', s: `<ellipse cx="40" cy="152" rx="12" ry="13"/><ellipse cx="60" cy="152" rx="12" ry="13"/>` },
  /* Separados del glúteo a propósito: pegados se fundían en un único bloque
     naranja del lumbar a la rodilla y no se distinguía nada (peso muerto). */
  isquios:       { vista: 'd', s: `<ellipse cx="37" cy="192" rx="12" ry="26"/><ellipse cx="63" cy="192" rx="12" ry="26"/>` },
  gemelo:        { vista: 'd', s: `<ellipse cx="38" cy="245" rx="10" ry="26"/><ellipse cx="62" cy="245" rx="10" ry="26"/>` },
};

/* primarios a plena opacidad, secundarios apagados: el ojo distingue
   "sobre todo esto" de "también esto" sin necesitar leyenda. */
function svgEjercicio({ nombre, primarios = [], secundarios = [] }) {
  /* El clip va en un <g> SIN transform y el desplazamiento en otro <g> dentro.
     Poner ambos en el mismo elemento deja en el aire si el recorte se evalúa
     antes o después de la transformación, y el resultado cambia de navegador
     a navegador. Así el clipPath está definido ya en su sitio y no hay duda. */
  const pinta = (lista, clase) => lista.map(m => {
    const def = MUSCULOS[m];
    if (!def) return '';
    const dorsal = def.vista === 'd';
    const clip = dorsal ? 'cuerpoD' : 'cuerpoF';
    const dentro = dorsal ? `<g transform="translate(${OFF_D},0)">${def.s}</g>` : def.s;
    return `<g class="${clase}" clip-path="url(#${clip})">${dentro}</g>`;
  }).join('');

  /* Si un ejercicio no toca nada por detrás, esa silueta salía idéntica al
     cuerpo base y no se sabía si es que no trabaja nada o si al dibujo le
     faltaba algo. Apagada, se lee de un vistazo: "aquí no hay nada". */
  const vistas = [...primarios, ...secundarios].map(m => MUSCULOS[m]).filter(Boolean);
  const hayFrente  = vistas.some(d => d.vista === 'f');
  const hayEspalda = vistas.some(d => d.vista === 'd');
  const claseF = hayFrente  ? '' : ' apagado';
  const claseD = hayEspalda ? '' : ' apagado';

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H + 22}" width="${W}" height="${H + 22}" role="img" aria-label="Músculos que trabaja: ${esc(nombre)}">
  <title>${esc(nombre)}</title>
  <defs>
    <clipPath id="cuerpoF">${silueta(50)}</clipPath>
    <clipPath id="cuerpoD">${silueta(50 + OFF_D)}</clipPath>
  </defs>
  <style>
    .base { fill: #3f3f3f; }
    /* El borde del color del fondo separa grupos contiguos. Sin él, lumbar +
       glúteo + isquios se fundían en un único bloque naranja de la cintura a
       la rodilla y no se distinguía qué trabajaba qué. */
    /* La cara y la columna: lo justo para saber de qué lado se mira. Tienen
       que verse a tamaño miniatura, así que no pueden ser un matiz del gris. */
    .detalle { fill: #1e1e1e; }
    .prim, .sec { stroke: #111; stroke-width: 1.5; paint-order: stroke; }
    .prim { fill: #ff6b00; }
    /* .38 quedaba marrón apagado sobre el gris del cuerpo y se confundía con
       él: a este tamaño "también trabaja esto" tiene que verse. */
    .sec  { fill: #ff6b00; opacity: .55; }
    .et   { fill: #8a8a8a; font: 700 12px system-ui, sans-serif; text-anchor: middle; letter-spacing: 1px; }
    /* El lado que no trabaja nada, y su etiqueta, en segundo plano. */
    .apagado { opacity: .28; }
    @media (prefers-color-scheme: light) {
      .base { fill: #d6d1c6; }
      .detalle { fill: #a49d8e; }
      .et   { fill: #7a7060; }
      .prim, .sec { stroke: #f7f5f0; }
    }
  </style>
  <g class="base${claseF}">${silueta(50)}</g>
  <g class="detalle${claseF}">${caraFrontal(50)}</g>
  <g class="base${claseD}">${silueta(50 + OFF_D)}</g>
  <g class="detalle${claseD}">${columnaDorsal(50 + OFF_D)}</g>
  ${pinta(secundarios, 'sec')}
  ${pinta(primarios, 'prim')}
  <text class="et${claseF}" x="50" y="${H + 15}">FRENTE</text>
  <text class="et${claseD}" x="${50 + OFF_D}" y="${H + 15}">ESPALDA</text>
</svg>
`;
}

module.exports = { svgEjercicio, MUSCULOS };
