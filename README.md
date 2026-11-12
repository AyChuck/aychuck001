# Catarsis

Entrenador vocal de metalcore que corre en el navegador. Enseña voz limpia y guturales, escucha tu voz por el micrófono y te corrige en vivo. Pensado para sesiones cortas (unos 7 minutos) en las que solo aprietas **Empezar**: la app decide qué toca.

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

## Qué hace

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
- **Sesión del día** automática: calentar, repasar lo más débil, lección nueva, algo divertido, enfriar.
- **Modo 2 minutos** para los días sin ganas.
- **Racha con perdón**: puedes faltar un día sin perderla.
- **Modo fácil automático**: si fallas dos veces un ejercicio, se abre el margen y baja el tempo.
- **Escúchate**: cada toma se puede reproducir al terminar (no se guarda).
- **Cuidado de la voz**: calentamiento obligatorio, máximo 4 minutos de guturales al día, y revisión de garganta después de cada bloque. Si reportas dolor, los guturales se bloquean 24 horas.

La ruta tiene 25 lecciones en 5 etapas, de "Cuarto de ensayo" a "Headliner".

## Lo que la app no puede hacer

- **No ve tu garganta.** El detector de distorsión mide qué tan "sucio" suena el audio, no si lo estás produciendo de forma sana. Por eso la app insiste en volumen bajo y te pregunta cómo te sientes. Si algo duele, para.
- El detector de guturales es una estimación acústica. Si marca tus screams como limpios (o tu voz aireada como distorsión), ajusta la sensibilidad en **Ajustes → Tu voz**.
- No sustituye a un maestro para pulir timbre, dicción o interpretación. Sí te da la base técnica y el hábito diario.

## Estructura

```
index.html, css/, assets/      Página, estilos e iconos
js/audio/                      Micrófono, detector de tono (YIN), rasgos espectrales, sintetizador
js/coach/                      Planes de ejercicio, calificación y consejos, progreso, sesión diaria
js/content/curriculum.js       Lecciones y ejercicios (melodías y letras originales)
js/ui/                         Pantallas (Preact + htm, incluido en vendor/)
tests/                         Pruebas unitarias (node --test)
tools/serve.js                 Servidor local
tools/e2e.mjs                  Prueba de punta a punta con un "cantante virtual"
```

## Pruebas

```bash
npm test             # motor de audio, calificación, progreso y planificador
node tools/e2e.mjs   # recorre la app completa en Chromium (requiere Playwright y `npm start` corriendo)
```

La prueba de punta a punta reemplaza el micrófono por un sintetizador que canta lo que pide cada ejercicio. Con `DETUNE=-45` canta bajo a propósito para comprobar las correcciones.

## Agregar ejercicios

Los ejercicios son datos en `js/content/curriculum.js`. Las notas se escriben como `[semitonos desde la raíz, pulsos, sílaba]` y la app las transporta al rango de cada persona:

```js
{ kind: 'pattern', skill: 'pitch', title: 'Arpegio menor', cue: 'Con "ma".',
  notes: [[0, 1], [3, 1], [7, 1], [3, 1], [0, 2]], bpm: 90, reps: 4, step: 1, start: 0.2 }
```

Tipos disponibles: `pattern`, `sustain`, `slide`, `breath`, `harsh`, `trans`, `rhythm`, `pacer` y `card`.
