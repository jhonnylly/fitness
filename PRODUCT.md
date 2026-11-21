# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Dos públicos con el mismo peso (confirmado por Jhon, 29/10/2026):

- **Quien entrena**, sola o con entrenador: sigue una rutina por semanas, apunta kilos y repeticiones y mira su progreso.
- **El entrenador**: prepara y asigna rutinas a sus clientes, les deja notas y ve lo que registran.

Se usa en dos situaciones, por igual:

- **En el gimnasio, entre series**: con una mano, con prisa, a veces sudando; apuntar y seguir.
- **Fuera, con calma**: planificar, revisar el progreso, preparar o cambiar rutinas.

## Product Purpose

Que cada persona sepa qué le toca hoy, lo haga y lo registre sin fricción, y que su entrenador (si lo tiene) pueda guiarla a distancia. El éxito es que se siga entrenando semana tras semana con el plan delante.

## Positioning

Lo que la separa de Strong, Hevy o la app de un gimnasio:

1. **Rutinas guiadas por niveles y semanas** (Primer Mes, Exprés, Casa, 2-5 días, Salud…), que dicen qué sesión toca hoy y proponen la siguiente rutina al terminar.
2. **La relación con el entrenador**: asignar la rutina, invitar con una rutina ya preparada, notas por ejercicio, cambiar el día que toca, ver el progreso del cliente.
3. **Navegación propia con el aro**: un dial giratorio en 3D (inclinado, por tramos y con relieve) con la esfera en el centro, como puerta a las cinco secciones; dentro de las secciones, una tira con los mismos cinco tramos.

## Operating Context

- App web instalable (PWA) en jhonnylly.github.io/fitness; se usa sobre todo en el iPhone y en Android, en vertical.
- Cinco secciones: Inicio, Entrenar, Resumen, Medidas y Ajustes.
- Funciona sin cuenta (datos en el dispositivo) o con cuenta (Firebase). El alta está cerrada: las cuentas se crean por invitación.
- Todo en español.

## Capabilities and Constraints

- Plan por semanas → sesiones («Sesión 1 · Torso») → ejercicios → series (kg y reps; RIR opcional). Descanso con contador y pitido. Cardio y notas por sesión. Medidas y peso. Copia de seguridad en JSON.
- Modo entrenador: clientes, rutinas asignadas, notas, pausa por impago (en la interfaz; bloquearla por reglas destruiría los datos del cliente).
- **Sin chat** (decidido) y **sin notificaciones push**: no llegan al iPhone si la app no está instalada.
- **No hay datos de duración de sesión ni de calorías**, salvo las kcal que se apuntan a mano en el cardio. No se muestran cifras que la app no mide.
- No existe nutrición.
- Dos pérdidas de datos reales en el pasado: nada puede sobrescribir datos de la nube sin copia previa.
- Pagos (Stripe): en pausa, sin decidir.

## Brand Commitments

- Paleta «Señal»: marino + amarillo, con cian como «estás aquí». **No naranja**: se parecía a Basic-Fit.
- El aro va EN 3D, inclinado, con la esfera dentro como centro y botón «▶ Empezar» (publicado el 18/11/2026; del 01/11 al 18/11 fue de frente). Por tramos y con relieve.
- Las ilustraciones de músculos aún están en naranja: encargado rehacerlas en amarillo Señal (21/11/2026).
- Titulares con serifa (decidido el 29/10/2026 para el rediseño).
- Sin nombre de marca decidido: no inventar uno.

## Evidence on Hand

- 16 rutinas reales en el código; catálogo de ejercicios con ilustraciones de músculos (`img/ejercicios/`).
- 2 vídeos de ejercicios grabados por ellos (curl de bíceps y peso muerto rumano).
- Sin testimonios, clientes reales que citar ni cifras de uso: no inventarlos.

## Product Principles

1. **Lo de hoy, primero**: abrir la app y empezar la sesión que toca debe ser un toque.
2. **Entre series, nada estorba**: objetivos grandes, una mano, sin ventanas que corten el ritmo.
3. **Solo datos reales**: si la app no lo mide, no se enseña.
4. **Los datos son sagrados**: nada se borra sin aviso ni deshacer; nada se sobrescribe sin copia.
5. **El entrenador está presente sin invadir**: sus notas y cambios se ven donde se entrena.

## Accessibility & Inclusion

- Zonas táctiles de 44 px como mínimo y texto de 11 px como mínimo (auditoría del 21/10/2026).
- Contraste comprobado con los tokens `accent-fill`, `accent-ink` y `danger-ink`.
- Respeta «reducir movimiento».
