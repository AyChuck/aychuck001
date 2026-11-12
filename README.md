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

En simulación, alguien que practica todos los días con puntajes perfectos termina las 26 lecciones en unas 5 o 6 semanas; con puntajes normales, en unas 8. Llevar todo a grado 5 toma varios meses.

## Canciones reales (YouTube Music)

YouTube Music no ofrece una forma de conectar una cuenta a otra app, pero su catálogo es el de YouTube, así que la app usa el reproductor oficial de YouTube:

- **Pega un enlace** de una canción (YouTube o YouTube Music) y queda en tu repertorio.
- **Pega el enlace de una playlist tuya** (pública o "no listada") y se importan todas sus canciones.
- **Catálogo sugerido** de más de 300 canciones por escena (post-hardcore y emo, punk melódico, metal y hard rock, metalcore moderno, en español), dificultad y técnica que entrena cada una. Las sugerencias cambian cada día y suben de nivel conforme apruebas lecciones.

Con la canción puedes repetir un tramo (verso, coro, puente), bajar la velocidad a 0.75x y grabar tomas. Una canción queda "dominada" con tomas de 80+ en tres días distintos.

**Qué mide en una canción.** La app no puede oír el audio de YouTube ni tiene la partitura, así que no sabe qué nota "debería" sonar. Mide lo que sí se puede sin referencia: qué tan centradas están tus notas sostenidas (¿caen en una nota o entre dos?), si tiemblan, si se caen al final, tu rango usado, cuánto pasas por encima de tu rango cómodo y cuánta distorsión usas. La afinación nota por nota se entrena en los ejercicios de la Ruta.

Notas prácticas: necesitas audífonos (si la canción suena por la bocina, el micrófono la oye). Algunos videos no permiten reproducirse fuera de YouTube: prueba otra versión de la misma canción. En teléfonos, el primer play hay que darlo tocando dentro del video. Si tienes YouTube Premium y sesión iniciada en ese navegador, normalmente no salen anuncios.

## Registros: voz llena, ligera, mezcla y belt

Cambiar entre voz de pecho, cabeza, mezcla y belt es lo que más cuesta, así que tiene su propia línea de lecciones con la explicación física (qué hacen las cuerdas vocales en cada modo y por qué se "quiebra" la voz) y ejercicios específicos:

- **Llena abajo, ligera arriba** y **El interruptor**: la misma nota cantada con tus dos voces.
- **Salto con cambio** (yodel): voltear la voz a propósito para sentir dónde ocurre.
- **Tres voces, una nota**: llena, ligera y mezcla en la misma altura.
- **Sirena sin escalón**: cruzar de un registro al otro sin que se note.

**Cómo sabe la app en qué registro estás.** Mide el "peso" de tu voz: cuánta energía tienen los armónicos superiores frente a la nota base. En voz llena las cuerdas chocan con todo su cuerpo y producen muchos armónicos fuertes; en voz ligera solo vibra el borde y queda casi solo la fundamental. Tu línea se pinta naranja cuando suena llena y azul cuando suena ligera, y hay un medidor en vivo.

Los ejercicios no usan un número fijo: comparan **tus dos voces entre sí** en la misma nota (la mezcla debe quedar entre ambas, y en la sirena el peso debe cambiar poco a poco). Es una estimación acústica que depende de la vocal y del micrófono; no ve tu laringe.

## Canciones con la TV o una bocina

Lo más preciso es que la canción suene en audífonos. Si prefieres que suene en la TV:

1. En el iPad o el teléfono abre la app de YouTube, toca el ícono de transmitir y elige tu TV (misma red wifi). Si no aparece, en la TV abre YouTube → Configuración → "Vincular con código de TV" y escribe ese código en el iPad.
2. En Catarsis, abre la canción, elige **"En la TV o una bocina"** y calibra 3 segundos con la canción sonando y sin cantar.
3. Canta con el iPad a un palmo de tu boca y la TV a volumen medio.

La app sube su umbral para contar solo lo que suena más fuerte que la música en el micrófono (tu voz de cerca). Los ejercicios de la Ruta conviene hacerlos con el audio del propio iPad: mandar ese audio a la TV mete retraso y desincroniza la guía.

## Qué corrige

| Área | Cómo te corrige |
| --- | --- |
| **Afinación** | Tu voz es una línea que tiene que entrar en las barras. Al terminar te dice si quedaste bajo o alto, si la nota tiembla, si entras arrastrándote desde abajo, si se cae al final por falta de aire, o si fallas solo en las notas altas. |
| **Rango y registros** | Sirenas y trinos adaptados a tu rango. Detecta quiebres de voz y te dice en qué nota está tu zona de paso. Mide si de verdad cambiaste de voz llena a ligera y si tu mezcla queda entre las dos. El rango de trabajo crece solo cuando demuestras que llegas más arriba. |
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

## Si la app no te oye bien

En **Ajustes → Probar micrófono** hay una prueba de 7 segundos (2 de silencio, 4 cantando "aaa"). Dice si el problema viene del dispositivo, del lugar o del algoritmo de la app, y genera un reporte de texto con números técnicos (nivel, ruido, claridad, nota detectada, frecuencia de muestreo) para copiar y mandar.

La app se adapta sola al nivel de cada micrófono: sigue el ruido de fondo del lugar y lo mide otra vez al arrancar cada toma. Los iPad y iPhone entregan la señal muy baja cuando se apagan los filtros de llamada; eso es normal y ya está contemplado. Si cambias de app a media sesión y el sistema corta el micrófono, la app lo vuelve a pedir en la siguiente toma.

## Dónde se guarda tu progreso

En el almacenamiento del navegador de ese dispositivo. Sobrevive a apagar y reiniciar. No se sube a ningún servidor, así que nadie más puede verlo. Se pierde si borras los datos del navegador, y cada navegador (y la app instalada en la pantalla de inicio) tiene su propia copia. En **Ajustes → Tus datos** puedes crear un respaldo y restaurarlo en otro dispositivo.

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
