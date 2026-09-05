# Fuentes

## `oswald-cifras.woff2` — 2,1 KB

Oswald 600, **recortada a las cifras y sus signos**: solo `0-9 , - . / : %`.
De ahí que pese 2 KB y no 40: la fuente entera trae todo el alfabeto latino,
cirílico y vietnamita, y aquí no se escribe ni una letra con ella.

Va **alojada en el repo, no enlazada a Google Fonts**, porque la app es una
PWA que tiene que verse igual en el gimnasio sin cobertura. Un `<link>` a
fonts.googleapis.com se cae sin red y las cifras saltarían a la del sistema
justo cuando estás mirando el cronómetro. Por eso también entra en
`ESENCIALES` del Service Worker.

Se aplica **solo a los números**, sin tocar el texto: el `unicode-range` del
`@font-face` acota la fuente a esos caracteres, así que en "78,4 kg" el
`78,4` sale en Oswald y el `kg` en la del sistema, sin marcar nada a mano.
El espacio queda fuera del rango a propósito, para que el ancho de los
espacios lo siga poniendo la fuente del texto.

Cómo se generó (la API de Google recorta con `text=`):

    curl -A '<user-agent de un Chrome moderno>' \
      'https://fonts.googleapis.com/css2?family=Oswald:wght@600&text=0123456789.,/%:-'

y descargar el `.woff2` que sale en la regla `src:`.

## `OFL.txt`

Oswald es SIL Open Font License 1.1. La licencia **obliga a acompañar el
fichero de fuente con su copia**, también cuando va recortada. No borrar.
