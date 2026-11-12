# Catarsis

Entrenador vocal de metalcore que corre en el navegador. Enseña voz limpia y guturales, escucha tu voz por el micrófono y te corrige en vivo. Pensado para sesiones cortas (unos 8 minutos) en las que solo aprietas **Empezar**: la app decide qué toca, y el avance se mide en semanas, no en una tarde.

Todo el análisis ocurre en tu dispositivo. No hay servidor, cuentas ni grabaciones que salgan de tu teléfono.

## Cómo usarla

### En el teléfono (recomendado)

El micrófono solo funciona en páginas `https`, así que hay que publicarla una vez con GitHub Pages:

1. En GitHub abre **Settings → Pages** de este repositorio.
2. En **Source** elige **Deploy from a branch**.
3. Elige la rama donde está la app y la carpeta **/ (root)**, y guarda.
4. Espera un minuto y abre `https://<tu-usuario>.github.io/<repositorio>/`.
5. En el menú del navegador elige **Agregar a pantalla de inicio**: queda como una app, a pantalla completa.

### En la computadora

```bash
npm start        # abre http://localhost:5173
```

No hay nada que instalar ni compilar: es HTML, CSS y JavaScript sin dependencias.

### Para que te escuche bien

- **Audífonos de cable** si puedes. Con ellos la guía y la base suenan mientras cantas. Los bluetooth meten retraso.
- Sin audífonos funciona igual: primero escuchas y luego cantas en silencio.
- Micrófono a un palmo de la boca, cuarto sin mucho ruido.

## Cómo se aprende aquí

La voz es coordinación muscular: se asienta con repetición espaciada y sueño, no en una tarde. Por eso el avance tiene reglas:

- **Grados.** Cada ejercicio tiene 5 grados (Aprobado, Firme, Sólido, Fino, Dominado). Solo se sube uno por día, cada grado pide más puntaje (60, 68, 75, 82, 88) y vuelve el ejercicio más difícil: más rápido, más agudo, notas y screams más largos, menos margen de afinación.
- **Repasos espaciados.** Lo aprobado regresa a los 1, 2, 4, 8 y 21 días. Lo fallado, al día siguiente.
- **Tope de material nuevo.** Dos lecciones nuevas al día en la primera etapa y una después. Lo demás (repasos, gimnasio, canciones, práctica libre) no tiene límite.
- **Etapas que se ganan.** Una etapa se abre cuando la anterior tiene sus lecciones aprobadas y un grado promedio de 2, es decir, repasadas en días distintos.
- **Después de las lecciones:** un gimnasio de ejercicios que se abre por etapa, un "riff del día" generado (distinto cada día) y tu repertorio de canciones.

En simulación, alguien que practica todos los días con puntajes perfectos termina las 25 lecciones en unas 5 semanas; con puntajes normales, en unas 7. Llevar todo a grado 5 toma varios meses.

## Canciones reales (YouTube Music)

YouTube Music no ofrece una forma de conectar una cuenta a otra app, pero su catálogo es el de YouTube, así que la app usa el reproductor oficial de YouTube:

- **Pega un enlace** de una canción (YouTube o YouTube Music) y queda en tu repertorio.
- **Pega el enlace de una playlist tuya** (pública o "no listada") y se importan todas sus canciones.
- **Catálogo sugerido** de más de 300 canciones por escena (post-hardcore y emo, punk melódico, metal y hard rock, metalcore moderno, en español), dificultad y técnica que entrena cada una. Las sugerencias cambian cada día y suben de nivel conforme apruebas lecciones.

Con la canción puedes repetir un tramo (verso, coro, puente), bajar la velocidad a 0.75x y grabar tomas. Una canción queda "dominada" con tomas de 80+ en tres días distintos.

**Qué mide en una canción.** La app no puede oír el audio de YouTube ni tiene la partitura, así que no sabe qué nota "debería" sonar. Mide lo que sí se puede sin referencia: qué tan centradas están tus notas sostenidas (¿caen en una nota o entre dos?), si tiemblan, si se caen al final, tu rango usado, cuánto pasas por encima de tu rango cómodo y cuánta distorsión usas. La afinación nota por nota se entrena en los ejercicios de la Ruta.

Notas prácticas: necesitas audífonos (si la canción suena por la bocina, el micrófono la oye). Algunos videos no permiten reproducirse fuera de YouTube: prueba otra versión de la misma canción. En teléfonos, el primer play hay que darlo tocando dentro del video. Si tienes YouTube Premium y sesión iniciada en ese navegador, normalmente no salen anuncios.

## Qué corrige

| Área | Cómo te corrige |
| --- | --- |
| **Afinación** | Tu voz es una línea que tiene que entrar en las barras. Al terminar te dice si quedaste bajo o alto, si la nota tiembla, si entras arrastrándote desde abajo, si se cae al final por falta de aire, o si fallas solo en las notas altas. |
| **Rango y registros** | Sirenas y trinos adaptados a tu rango. Detecta quiebres de voz y te dice en qué nota está tu zona de paso. El rango de trabajo crece solo cuando demuestras que llegas más arriba. |
| **Aire** | Mide cuántos segundos sostienes un "sss" parejo y qué tan estable sale. |
| **Guturales** | Detecta distorsión (fry, false cord, scream), cuánto la sostienes y si estás empujando volumen de más. Distingue colores graves, medios y agudos por el brillo del sonido. |
| **Ritmo** | Compara tus ataques con el patrón del breakdown y descuenta el retraso constante del micrófono. |
| **Dinámica y estilo** | Verso susurrado, coro con potencia, vibrato, falsete y runs, con frases y letras originales. |

Además:

- **Prueba de rango** al inicio: todo se transporta a tu voz.
- **Sesión del día** automática: calentar, repasos que tocan, lección en curso o nueva, gimnasio o riff del día, enfriar.
- **Modo 2 minutos** para los días sin ganas.
- **Racha con perdón**: puedes faltar un día sin perderla.
- **Modo fácil automático**: si fallas dos veces un ejercicio nuevo, se abre el margen y baja el tempo.
- **Escúchate**: cada toma se puede reproducir al terminar (no se guarda).
- **Cuidado de la voz**: calentamiento obligatorio, máximo 4 minutos de guturales al día, y revisión de garganta después de cada bloque. Si reportas dolor, los guturales se bloquean 24 horas.

## Lo que la app no puede hacer

- **No ve tu garganta.** El detector de distorsión mide qué tan "sucio" suena el audio, no si lo estás produciendo de forma sana. Por eso la app insiste en volumen bajo y te pregunta cómo te sientes. Si algo duele, para.
- El detector de guturales es una estimación acústica. Si marca tus screams como limpios (o tu voz aireada como distorsión), ajusta la sensibilidad en **Ajustes → Tu voz**.
- En canciones reales no compara contra la melodía original (ver arriba).
- No sustituye a un maestro para pulir timbre, dicción o interpretación. Sí te da la base técnica y el hábito diario.

## Estructura

```
index.html, css/, assets/      Página, estilos e iconos
js/audio/                      Micrófono, detector de tono (YIN), rasgos espectrales, sintetizador
js/audio/youtube.js            Enlaces y reproductor de YouTube
js/coach/                      Planes de ejercicio, calificación, grados y repasos, sesión diaria, análisis de canciones
js/content/curriculum.js       Lecciones, gimnasio y ejercicios (melodías y letras originales)
js/content/songs.js            Catálogo de canciones sugeridas (solo títulos, artistas y técnica)
js/ui/                         Pantallas (Preact + htm, incluido en vendor/)
tests/                         Pruebas unitarias (node --test)
tools/serve.js                 Servidor local
tools/e2e.mjs                  Prueba de punta a punta con un "cantante virtual"
```

## Pruebas

```bash
npm test             # motor de audio, calificación, grados y repasos, planificador, canciones
node tools/e2e.mjs   # recorre la app completa en Chromium (requiere Playwright y `npm start` corriendo)
```

La prueba de punta a punta reemplaza el micrófono por un sintetizador que canta lo que pide cada ejercicio, y YouTube por un reproductor simulado. Con `DETUNE=-45` canta bajo a propósito para comprobar las correcciones.

## Agregar ejercicios

Los ejercicios son datos en `js/content/curriculum.js`. Las notas se escriben como `[semitonos desde la raíz, pulsos, sílaba]` y la app las transporta al rango de cada persona:

```js
{ kind: 'pattern', skill: 'pitch', title: 'Arpegio menor', cue: 'Con "ma".',
  notes: [[0, 1], [3, 1], [7, 1], [3, 1], [0, 2]], bpm: 90, reps: 4, step: 1, start: 0.2 }
```

Tipos disponibles: `pattern`, `sustain`, `slide`, `breath`, `harsh`, `trans`, `rhythm`, `pacer` y `card`.
