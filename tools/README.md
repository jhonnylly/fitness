# Mapas musculares de los ejercicios

Silueta de frente y espalda con el músculo trabajado resaltado (naranja fuerte
el principal, apagado el secundario). **No** son ilustraciones del movimiento.

## Regenerar las imágenes

```bash
node tools/generar-imagenes.js
```

Lee `~/fitness-ejercicios.txt` + `tools/musculos.js` y escribe
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

## Regenerar la LISTA de ejercicios

La lista sale de dos sitios y por eso no se genera aquí sin más:

1. las rutinas del código (`PLAN` y `PRESET_ROUTINES` de `index.html`), y
2. **los ejercicios que solo existen dentro de sesiones ya registradas**
   (`sessions[n].exercises`), que se añadieron entrenando y no están en ningún
   plan. Esos hay que leerlos de la cuenta real.

Los nombres de fichero los genera `claveEjercicio()` **de `index.html`**, la
misma función con la que la app busca la imagen: no se pueden desincronizar.

## Publicar

Son ficheros estáticos: van en el repo y los sirve GitHub Pages. No ocupan
nada en Firestore y se cachean. 102 SVG ≈ 850 KB, unos 8 KB cada uno.
