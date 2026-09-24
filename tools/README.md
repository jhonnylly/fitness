# Mapas musculares de los ejercicios

Silueta de frente y espalda con el músculo trabajado resaltado (naranja fuerte
el principal, apagado el secundario). **No** son ilustraciones del movimiento.

## Regenerar las imágenes

```bash
node tools/generar-imagenes.js
```

Lee `tools/ejercicios.txt` + `tools/musculos.js` y escribe
`img/ejercicios/*.svg` y una hoja de contacto en `img/ejercicios/index.html`.
Aborta si algún ejercicio se quedó sin músculos asignados, para que no aparezca
una silueta en gris sin avisar.

## Revisarlas

Abre `img/ejercicios/index.html` en el navegador. Las que dependen de cómo esté
montada la máquina del gimnasio salen marcadas **REVISAR**.

## Cambiar qué músculos trabaja un ejercicio

Edita `tools/musculos.js` (`clave: [[primarios], [secundarios]]`) y vuelve a
lanzar el generador. Los nombres válidos de músculo son las claves de
`MUSCULOS` en `tools/cuerpo.js`.

## La LISTA de ejercicios

Es `tools/ejercicios.txt`: `clave <TAB> nombre <TAB> alias`, una línea por
ejercicio. Se edita a mano —añadir un ejercicio es una línea aquí y otra en
`musculos.js`— y luego `npm run imagenes`.

Hasta el 24/09/2026 vivía en `~/fitness-ejercicios.txt`, fuera del repo y sin
copia de seguridad ninguna.

De dónde salió, que no se genera sola:

1. las rutinas del código (`PLAN` y `PRESET_ROUTINES` de `index.html`), y
2. **los ejercicios que solo existen dentro de sesiones ya registradas**
   (`sessions[n].exercises`), que se añadieron entrenando y no están en ningún
   plan. Esos hay que leerlos de la cuenta real.

Los nombres de fichero los genera `claveEjercicio()` **de `index.html`**, la
misma función con la que la app busca la imagen: no se pueden desincronizar.

## Publicar

Son ficheros estáticos: van en el repo y los sirve GitHub Pages. No ocupan
nada en Firestore y se cachean. 106 SVG ≈ 880 KB, unos 8 KB cada uno.
