// Plan de estudios. Todo el contenido (melodías, letras, textos) es original.
// Las notas van como [semitonos desde la raíz, pulsos, sílaba]: la app las
// transporta al rango de cada persona.

import { riffOfDay, RIFF_ID } from '../coach/riffs.js';

const FIVE_MAJOR = [[0, 1], [2, 1], [4, 1], [5, 1], [7, 1], [5, 1], [4, 1], [2, 1], [0, 2]];
const FIVE_MINOR = [[0, 1], [2, 1], [3, 1], [5, 1], [7, 1], [5, 1], [3, 1], [2, 1], [0, 2]];

const card = (title, body, art) => ({ kind: 'card', title, body, art });

export const STAGES = [
  { id: 's1', name: 'Cuarto de ensayo', blurb: 'Aire, afinación y tu primera distorsión' },
  { id: 's2', name: 'Garage', blurb: 'Soporte, registros y el suspiro pesado' },
  { id: 's3', name: 'Primer show', blurb: 'Voz mixta, potencia y tu primer scream' },
  { id: 's4', name: 'De gira', blurb: 'Agudos libres, colores del scream y transiciones' },
  { id: 's5', name: 'Headliner', blurb: 'Grit, resistencia y una canción completa' },
];

export const TRACKS = {
  breath: { name: 'Aire', art: 'lungs' },
  pitch: { name: 'Afinación', art: 'wave' },
  range: { name: 'Registros', art: 'ladder' },
  power: { name: 'Potencia', art: 'bolt' },
  harsh: { name: 'Guturales', art: 'flame' },
  rhythm: { name: 'Ritmo', art: 'pulse' },
  style: { name: 'Estilo', art: 'star' },
};

const RAW = [
  // ───────────── Etapa 1 ─────────────
  {
    id: 'aire-1', stage: 's1', track: 'breath', title: 'Respira como cantante',
    blurb: 'El motor de todo: aire bajo y parejo',
    steps: [
      card('El motor es el aire', 'Tu voz es un instrumento de viento. Sin aire estable no salen ni las notas ni los screams. Se entrena primero porque arregla la mitad de los problemas.', 'lungs'),
      card('Respira hacia abajo', 'Mano en la panza. Al inhalar se abren la panza y las costillas; los hombros no suben. Al soltar, el abdomen empuja lento.', 'lungs'),
      { kind: 'pacer', skill: 'breath', title: 'Respiración baja', cue: 'Sigue el círculo. Mano en la panza.', pattern: [4, 2, 8], cycles: 3 },
      { kind: 'breath', skill: 'breath', title: 'Hilo de aire', cue: 'Inhala bajo y suelta un "sss" fino y parejo, lo más largo que puedas.', target: 12,
        how: ['El "sss" suena igual de principio a fin, como una llanta ponchada.', 'No vacíes todo al inicio: es un hilo, no un chorro.'] },
    ],
  },
  {
    id: 'tono-1', stage: 's1', track: 'pitch', title: 'Atina la nota',
    blurb: 'Escucha, copia y sostén',
    steps: [
      card('Tu línea contra la barra', 'Vas a oír una nota y luego la cantas. La línea azul es tu voz: métela dentro de la barra. Canta "aaa" a volumen de plática animada.', 'wave'),
      { kind: 'pattern', skill: 'pitch', title: 'Copia la nota', cue: 'Escucha y repite con "aaa".', syl: 'aaa', notes: [[0, 2]], bpm: 60, reps: 4, step: 2, start: 0.25,
        how: ['Si tu línea queda abajo de la barra, sube un poco la voz; si queda arriba, bájala.', 'Tararea la nota en tu cabeza mientras suena la guía.'] },
      { kind: 'sustain', skill: 'pitch', title: 'Sostén 4 segundos', cue: 'Misma idea, pero aguanta la nota quieta.', syl: 'aaa', secs: 4, reps: 3, step: 2, start: 0.25,
        how: ['Aire constante desde el abdomen.', 'La línea plana es la meta. Si tiembla, baja el volumen.'] },
    ],
  },
  {
    id: 'calor-1', stage: 's1', track: 'range', title: 'Calentamiento exprés',
    blurb: 'Dos minutos que protegen tu voz',
    steps: [
      card('Nunca en frío', 'Cantar o gritar sin calentar es como cargar pesado recién levantado. Con dos minutos basta: trino de labios y sirenas suaves.', 'ladder'),
      { kind: 'slide', skill: 'range', title: 'Trino de labios', cue: 'Haz "brrr" con los labios sueltos y sube y baja como sirena.', syl: 'brrr', from: 0.1, to: 0.7, secs: 5, reps: 3,
        how: ['Labios flojos, como imitar un motor. Si no vibran, empuja las mejillas con los dedos.', 'Volumen bajo. Es un masaje, no un ejercicio de fuerza.'] },
      { kind: 'pattern', skill: 'pitch', title: 'Zumbido de 5 notas', cue: 'Con la boca cerrada: "mmm". Siente el zumbido en labios y nariz.', syl: 'mmm', notes: FIVE_MAJOR, bpm: 120, reps: 3, step: 1, start: 0.15,
        how: ['Si sientes vibración en la cara, vas bien: eso es resonancia.'] },
    ],
  },
  {
    id: 'fry-1', stage: 's1', track: 'harsh', title: 'Vocal fry: la semilla del scream',
    blurb: 'Distorsión mínima, cero fuerza',
    steps: [
      card('Así empieza un scream', 'El fry scream nace del vocal fry: ese "aaa" rasposo y bajito de recién despertado. Sale casi sin aire y sin fuerza. Nada de gritar todavía.', 'flame'),
      card('Regla de oro', 'Si pica, arde o duele, paras. La distorsión bien hecha se siente como vibración arriba, en el paladar. Nunca como raspón en la garganta.', 'drop'),
      { kind: 'harsh', skill: 'harsh', title: 'Fry bajito', cue: 'Haz el "aaa" rasposo de recién despertado, lo más suave que puedas.', quiet: true,
        windows: [['harsh', 2, 'Fry suave'], ['rest', 2], ['harsh', 2, 'Fry suave'], ['rest', 2], ['harsh', 3, 'Un poco más largo']],
        how: ['Baja la voz hasta que empiece a "tronar" como puerta vieja.', 'Es el sonido más bajito que puedes hacer. Si suena fuerte, estás apretando.'] },
    ],
  },
  {
    id: 'tono-2', stage: 's1', track: 'pitch', title: 'La escala del metalcore',
    blurb: 'Menor natural: oscura y épica',
    steps: [
      card('Menor natural', 'Casi todo el metalcore vive en escala menor: suena oscura y épica. Estas cinco notas son la base de la mayoría de los coros que te gustan.', 'wave'),
      { kind: 'pattern', skill: 'pitch', title: 'Cinco notas menores', cue: 'Sube y baja con "no".', syl: 'no', notes: FIVE_MINOR, bpm: 96, reps: 4, step: 1, start: 0.2, backing: 'drone',
        how: ['La tercera nota es la que suena "triste": apunta con cuidado.'] },
      { kind: 'pattern', skill: 'pitch', title: 'Arpegio menor', cue: 'Saltos más grandes. Con "ma".', syl: 'ma', notes: [[0, 1], [3, 1], [7, 1], [3, 1], [0, 2]], bpm: 90, reps: 4, step: 1, start: 0.2, backing: 'drone' },
    ],
  },

  // ───────────── Etapa 2 ─────────────
  {
    id: 'aire-2', stage: 's2', track: 'breath', title: 'Soporte: el secreto del volumen',
    blurb: 'Costillas abiertas, garganta libre',
    steps: [
      card('Apoyo', 'Soporte es mantener las costillas abiertas mientras sale el aire. El abdomen regula y la garganta no aprieta. Con esto sostienes coros y screams largos.', 'lungs'),
      { kind: 'breath', skill: 'breath', title: 'Hilo de 20 segundos', cue: 'Mismo "sss", ahora más largo. Costillas abiertas.', target: 20 },
      { kind: 'rhythm', skill: 'breath', title: 'Pulsos de aire', cue: 'Golpes cortos de "ts" desde el abdomen, al ritmo.', grid: 'x.x.x.x.', bpm: 80, reps: 2, texts: ['ts'],
        how: ['Cada "ts" es un rebote del abdomen, como reír en silencio.'] },
    ],
  },
  {
    id: 'registro-1', stage: 's2', track: 'range', title: 'Tus dos voces: llena y ligera',
    blurb: 'Qué pasa en tu garganta al cambiar de registro',
    listen: 'Sleep Token, "The Summoning": en el coro la voz salta a ligera (falsete) y regresa a llena dentro de la misma frase.',
    steps: [
      card('Dos formas de vibrar', 'Tus cuerdas vocales son dos pliegues. Pueden vibrar gruesas y completas, o estiradas y solo en el borde. No son dos gargantas ni dos lugares: es el mismo instrumento en dos modos.', 'folds'),
      card('Voz llena (pecho)', 'Pliegues cortos y gruesos que chocan con todo su cuerpo. Suena con peso: es tu voz de hablar. Vibra en el pecho. Te sirve desde tus graves hasta la parte media-alta.', 'folds'),
      card('Voz ligera (cabeza)', 'Pliegues estirados y delgados; solo vibra el borde. Suena ligera y aguda, como imitar a un búho. El falsete es este mismo modo, dejando escapar aire.', 'folds'),
      card('Por qué cuesta cambiar', 'Dos músculos jalan en sentidos opuestos: uno engruesa (llena), el otro estira (ligera). El "gallo" es cuando uno suelta de golpe. Cambiar bien no es fuerza: es soltar uno mientras entra el otro.', 'folds'),
      card('Cómo lo ve la app', 'La voz llena tiene muchos armónicos fuertes; la ligera, casi solo la nota base. Eso sí lo oye el micrófono. Tu línea se pinta naranja cuando suena llena y azul cuando suena ligera.', 'wave'),
      { kind: 'pattern', skill: 'range', title: 'Llena abajo, ligera arriba', cue: 'Nota grave con tu voz de hablar ("ah"). Luego la aguda, suave, como búho ("uu").', syl: 'ah → uu', bpm: 60, reps: 2, step: 2, start: 0.2, tol: 80,
        notes: [[0, 2.5, 'llena', 'chest'], [12, 2.5, 'ligera', 'head']],
        how: ['Abajo: como decir "aaah" en el doctor, con cuerpo.', 'Arriba: la mitad de volumen, bostezo por dentro. Mira cómo cambia el color de tu línea.'] },
      { kind: 'slide', skill: 'range', title: 'Sirena de búho', cue: 'Con "uuu", sube hasta tu voz más ligera y baja.', syl: 'uuu', from: 0.3, to: 1.0, secs: 6, reps: 3,
        how: ['Arriba la voz se adelgaza: déjala. No empujes para que suene fuerte.'] },
      { kind: 'pattern', skill: 'range', title: 'Baja desde la ligera', cue: 'Empieza arriba, ligero, y baja con "uu".', syl: 'uu', notes: [[7, 1], [5, 1], [4, 1], [2, 1], [0, 2]], bpm: 90, reps: 3, step: 1, start: 0.7 },
    ],
  },
  {
    id: 'registro-cambio', stage: 's2', track: 'range', title: 'El interruptor',
    blurb: 'La misma nota con tus dos voces',
    listen: 'Falling in Reverse, "Popular Monster": pasa de voz llena a ligera y a grito en segundos. Elige un tramo y fíjate solo en los cambios.',
    steps: [
      card('La misma nota, dos voces', 'Hay una zona media donde puedes cantar la misma nota de las dos formas. Ahí se entrena el cambio: primero la nota llena, luego la misma nota ligera.', 'folds'),
      card('Para pasar a la ligera', 'Baja el volumen a la mitad, bosteza por dentro y piensa en el "uu" de búho. Deja salir un poco de aire. Si tu línea no cambia de color, exagera: más suave y más aire.', 'folds'),
      card('Para volver a la llena', 'Di la nota como si hablaras: "¡ey!", corto y firme, sin aire. No subas el volumen para lograrlo. Es más cierre, no más fuerza.', 'folds'),
      { kind: 'pattern', skill: 'range', title: 'Interruptor', cue: 'Misma nota: llena, ligera, llena, ligera.', syl: 'ah', bpm: 60, reps: 2, step: 1, start: 0.62, tol: 80, listen: 'cue',
        notes: [[0, 2, 'llena', 'chest'], [0, 2, 'ligera', 'head'], [0, 2, 'llena', 'chest'], [0, 2, 'ligera', 'head']],
        how: ['No hace falta cortar el sonido: puedes respirar entre una y otra.', 'El puntaje compara tus dos voces entre sí. Mientras más distintas, mejor.'] },
      { kind: 'pattern', skill: 'range', title: 'Salto con cambio', cue: 'Abajo llena, una octava arriba ligera. Deja que la voz "voltee" a propósito.', syl: 'yo → u', bpm: 60, reps: 2, step: 1, start: 0.45, tol: 80,
        notes: [[0, 1.5, 'llena', 'chest'], [12, 1.5, 'ligera', 'head'], [0, 1.5, 'llena', 'chest'], [12, 2, 'ligera', 'head']],
        how: ['Es un yodel: aquí el quiebre es el ejercicio. Sentir dónde voltea es el primer paso para controlarlo.'] },
    ],
  },
  {
    id: 'tono-3', stage: 's2', track: 'pitch', title: 'Quintas y octavas',
    blurb: 'Power chords con la voz',
    steps: [
      card('Power chords con la voz', 'Un power chord es raíz, quinta y octava. Si tu voz salta limpio entre esas tres notas, puedes armonizar encima de cualquier riff.', 'wave'),
      { kind: 'pattern', skill: 'pitch', title: 'Raíz, quinta, octava', cue: 'Saltos grandes con "ya".', syl: 'ya', notes: [[0, 1], [7, 1], [0, 1], [7, 1], [12, 2], [7, 1], [0, 2]], bpm: 90, reps: 3, step: 1, start: 0.1, backing: 'chug' },
      { kind: 'pattern', skill: 'range', title: 'Salto de octava', cue: 'De abajo a arriba sin resbalar.', syl: 'ya', notes: [[0, 1.5], [12, 1.5], [0, 2]], bpm: 80, reps: 3, step: 1, start: 0.1,
        how: ['Piensa la nota de arriba antes de saltar. No la busques deslizándote.'] },
    ],
  },
  {
    id: 'fc-1', stage: 's2', track: 'harsh', title: 'False cord: el suspiro pesado',
    blurb: 'El scream grave de los breakdowns',
    steps: [
      card('El otro scream', 'El false cord es más grave y gordo: el sonido de los breakdowns. Nace de un suspiro pesado, "hhhoh", como empañar un vidrio con voz de monstruo cansado.', 'flame'),
      card('Mucho aire, cero apretón', 'Aquí pasa bastante aire, pero con la garganta abierta como en un bostezo. Si te da tos, estás empujando de más: baja la intensidad.', 'drop'),
      { kind: 'harsh', skill: 'harsh', title: 'Suspiro con distorsión', cue: 'Bostezo abierto y un "hhhoh" pesado, sin apretar.',
        windows: [['harsh', 2, 'Suspiro "hoh"'], ['rest', 2.5], ['harsh', 2, 'Suspiro "hoh"'], ['rest', 2.5], ['harsh', 3, 'Más largo']],
        how: ['Empieza como un suspiro de cansancio y hazlo cada vez más "sucio".', 'El ruido se forma arriba de las cuerdas vocales; ellas casi no trabajan.'] },
    ],
  },
  {
    id: 'estilo-1', stage: 's2', track: 'style', title: 'Verso susurrado',
    blurb: 'Voz con aire, pegado al micro',
    listen: 'Bad Omens, "Just Pretend": los versos van casi hablados, pegados al micrófono.',
    steps: [
      card('Menos es más', 'Los versos de Sleep Token o Bad Omens casi se susurran: voz con aire, cerca del micrófono. Ese contraste hace que el coro explote después.', 'star'),
      { kind: 'pattern', skill: 'style', title: 'Verso: la marea', cue: 'Suave, con aire en la voz.', dyn: 'soft', backing: 'ambient', bpm: 84, reps: 2, step: 0, start: 0.2, tol: 60,
        notes: [[0, 1, 'Hold'], [0, 0.5, 'your'], [3, 1.5, 'breath'], [2, 0.5, 'the'], [0, 1, 'tide'], [-2, 0.5, 'is'], [0, 1, 'ris'], [0, 2, 'ing']],
        how: ['Mezcla aire con la voz, como contar un secreto.', 'Suave no es desafinado: la nota sigue en la barra.'] },
      { kind: 'pattern', skill: 'style', title: 'Verso: el silencio', cue: 'Segunda línea, mismo color.', dyn: 'soft', backing: 'ambient', bpm: 84, reps: 2, step: 0, start: 0.2, tol: 60,
        notes: [[3, 0.5, 'I'], [3, 0.5, 'can'], [5, 1, 'feel'], [3, 0.5, 'the'], [2, 1, 'si'], [0, 0.5, 'lence'], [2, 0.5, 'clo'], [3, 0.5, 'sing'], [0, 2, 'in']] },
    ],
  },

  // ───────────── Etapa 3 ─────────────
  {
    id: 'registro-2', stage: 's3', track: 'range', title: 'Voz mixta',
    blurb: 'El truco de los coros altos',
    listen: 'Bad Omens, "Just Pretend": el coro va en mezcla. Suena lleno, pero es más ligero de lo que parece.',
    steps: [
      card('Mix', 'La voz mixta suena potente sin gritar. El truco: sonido de niño burlón, "nei nei nei", nasal y brillante. Feo aquí, enorme en el coro.', 'ladder'),
      card('Qué es, físicamente', 'La mezcla es voz llena adelgazada: los pliegues siguen cerrando firme, pero más estirados y con menos masa. El brillo nasal ayuda a mantener el cierre sin empujar aire.', 'folds'),
      { kind: 'pattern', skill: 'range', title: 'Nei nei burlón', cue: 'Nasal y chillón, sin pena.', syl: 'nei', notes: [[0, 0.5], [4, 0.5], [7, 0.5], [12, 1.5], [7, 0.5], [4, 0.5], [0, 1.5]], bpm: 96, reps: 4, step: 1, start: 0.25,
        how: ['Exagera lo nasal: ese brillo es lo que conecta pecho y cabeza.', 'Mismo volumen arriba que abajo. No empujes la nota alta.'] },
      { kind: 'pattern', skill: 'range', title: 'Rebotes arriba', cue: 'Con "gui", rebota en la nota alta.', syl: 'gui', notes: [[0, 0.5], [4, 0.5], [7, 0.5], [12, 0.5], [12, 0.5], [12, 0.5], [12, 0.5], [7, 0.5], [4, 0.5], [0, 1.5]], bpm: 96, reps: 3, step: 1, start: 0.3 },
      card('Las tres en una nota', 'Ahora compara: la misma nota llena, ligera y en mezcla. La mezcla debe quedar entre las dos: con más cuerpo que la ligera, pero más delgada que la llena.', 'folds'),
      { kind: 'pattern', skill: 'range', title: 'Tres voces, una nota', cue: 'Llena, ligera, y luego mezcla con "nei".', syl: 'ah, uu, nei', bpm: 60, reps: 2, step: 1, start: 0.68, tol: 80, listen: 'cue',
        notes: [[0, 2, 'llena', 'chest'], [0, 2, 'ligera', 'head'], [0, 2.5, 'mezcla', 'mix']],
        how: ['Mezcla: volumen medio, sonido nasal y burlón, sin aire.', 'Si tu línea sale igual de naranja que la llena, estás empujando. Si sale azul, falta cierre.'] },
    ],
  },
  {
    id: 'potencia-1', stage: 's3', track: 'power', title: 'Belting sin romperte',
    blurb: 'Llamar, no gritar',
    listen: 'Architects, "Doomsday": un coro limpio, alto y sostenido.',
    steps: [
      card('Llamar, no gritar', 'Belting es como llamar a alguien que está lejos: "¡HEY!". La fuerza sale del abdomen y el sonido es brillante, no ancho ni gritado.', 'bolt'),
      card('Belt, físicamente', 'Es voz llena llevada arriba con la vocal abierta ("eh", "ah") y mucho apoyo. Tiene techo: más arriba hay que pasar a mezcla. Empujar el belt por encima de ese techo es lo que lastima.', 'folds'),
      { kind: 'pattern', skill: 'power', title: 'Llamadas', cue: 'Un "¡hey!" con energía en cada barra.', dyn: 'loud', notes: [[0, 1.5, 'Hey!']], bpm: 60, reps: 4, step: 1, start: 0.55,
        how: ['El abdomen da un empujón corto; el cuello se queda suelto.', 'Si raspa, bájale: potencia no es volumen máximo.'] },
      { kind: 'sustain', skill: 'power', title: 'Sostén con potencia', cue: 'Nota larga, fuerte y quieta. Con "eh".', syl: 'eh', dyn: 'loud', secs: 4, reps: 3, step: 1, start: 0.55 },
    ],
  },
  {
    id: 'scream-1', stage: 's3', track: 'harsh', title: 'Tu primer fry scream',
    blurb: 'Fry más aire, sin volumen',
    steps: [
      card('Fry más aire', 'Haz tu fry bajito y súmale aire desde el abdomen, poco a poco, con la boca en "eh". El volumen lo pone el micrófono, no tú.', 'flame'),
      { kind: 'harsh', skill: 'harsh', title: 'Del fry al scream', cue: 'Tres pasos: fry suave, fry con aire, scream en "eh".',
        windows: [['harsh', 2, 'Fry bajito'], ['rest', 1.5], ['harsh', 3, 'Fry + aire'], ['rest', 2], ['harsh', 4, 'Scream "eh"']],
        how: ['El sonido se siente detrás de la nariz y en el paladar, no en la garganta.', 'Volumen de voz hablada. Si necesitas más fuerza para que salga, descansa.'] },
      { kind: 'harsh', skill: 'harsh', title: 'Sostén el scream', cue: 'Cinco segundos parejos. Dos veces.',
        windows: [['harsh', 5, 'Sostén'], ['rest', 3], ['harsh', 5, 'Otra vez']] },
    ],
  },
  {
    id: 'ritmo-1', stage: 's3', track: 'rhythm', title: 'Ritmo de breakdown',
    blurb: 'La voz también es percusión',
    listen: 'Falling in Reverse, "Popular Monster": en el breakdown, cada sílaba cae con la batería.',
    steps: [
      card('El scream es percusión', 'En un breakdown la voz golpea junto con la batería. Cada sílaba es corta y seca. Primero con "¡ha!" limpio; la distorsión viene después.', 'pulse'),
      { kind: 'rhythm', skill: 'rhythm', title: 'Golpes a tiempo', cue: 'Un "¡ha!" seco en cada marca.', grid: 'x.x.x.x.', bpm: 90, reps: 2, texts: ['ha'] },
      { kind: 'rhythm', skill: 'rhythm', title: 'Patrón sincopado', cue: 'Ahora con huecos. Respira en los silencios.', grid: 'x.xxx.x.', bpm: 96, reps: 3, texts: ['ha'],
        how: ['Mueve la cabeza con el pulso: el cuerpo lleva el tiempo, no la cabeza pensando.'] },
    ],
  },
  {
    id: 'estilo-2', stage: 's3', track: 'style', title: 'Coro que levanta',
    blurb: 'Arriba, abierto y con todo',
    listen: 'Bad Omens, "Just Pretend": compara el volumen del verso con el del coro.',
    steps: [
      card('El coro va arriba', 'Los coros de metalcore viven en la parte alta de tu voz, con mix y vocales abiertas. Canta esta frase como si cerraras un festival.', 'star'),
      { kind: 'pattern', skill: 'style', title: 'Coro: brasas', cue: 'Con potencia y vocales abiertas.', dyn: 'loud', backing: 'chug', bpm: 92, reps: 2, step: 0, start: 0.7, tol: 60,
        notes: [[7, 0.5, 'We'], [7, 0.5, 'are'], [8, 0.5, 'the'], [10, 1.5, 'em'], [7, 2, 'bers'], [5, 0.5, 'burn'], [7, 0.5, 'ing'], [8, 1, 'through'], [7, 0.5, 'the'], [3, 2.5, 'night']],
        how: ['"Em-bers" es la nota alta: abre la boca hacia "ehm", no la cierres.', 'Respira después de "embers".'] },
    ],
  },

  // ───────────── Etapa 4 ─────────────
  {
    id: 'registro-3', stage: 's4', track: 'range', title: 'Agudos sin tensión',
    blurb: 'Modifica la vocal y la nota sale',
    steps: [
      card('Modifica la vocal', 'Arriba, las vocales cerradas ("i", "u") aprietan. Ábrelas: "i" se vuelve "eh" y "u" se vuelve "oh". Nadie nota el cambio y la nota sale libre.', 'ladder'),
      { kind: 'pattern', skill: 'range', title: 'Sube y abre', cue: 'Con "ne". La nota larga de arriba, bien abierta.', syl: 'ne', notes: [[0, 0.5], [2, 0.5], [4, 0.5], [5, 0.5], [7, 2], [5, 0.5], [4, 0.5], [2, 0.5], [0, 1.5]], bpm: 96, reps: 5, step: 1, start: 0.45, stretch: 1 },
      card('Cruzar el puente', 'Entre la voz llena y la ligera hay una zona de paso. El objetivo final no es saltarla, sino cruzarla sin que se note: el peso baja poco a poco mientras subes.', 'folds'),
      { kind: 'slide', skill: 'range', title: 'Sirena sin escalón', cue: 'Con "ng" (como en "song"), de llena a ligera sin que se note el cambio. Volumen bajo.', syl: 'ng', connect: true, from: 0, to: 1.05, secs: 8, reps: 2,
        how: ['La "ng" no deja que empujes: por eso suaviza el paso entre registros.', 'Tu línea debe pasar de naranja a azul de forma gradual, no de golpe.'] },
    ],
  },
  {
    id: 'scream-2', stage: 's4', track: 'harsh', title: 'Graves, medios y agudos',
    blurb: 'El color lo da la boca',
    steps: [
      card('Tres colores', 'El tono de un scream no lo dan las cuerdas: lo da la forma de la boca. "OH" con la boca alargada suena grave. "AH" es medio. "EE" con sonrisa es agudo.', 'flame'),
      { kind: 'harsh', skill: 'harsh', title: 'Tres colores', cue: 'Mismo scream, cambia solo la boca.', place: ['low', 'mid', 'high'],
        windows: [['harsh', 2.5, 'Grave: "OH"'], ['rest', 2], ['harsh', 2.5, 'Medio: "AH"'], ['rest', 2], ['harsh', 2.5, 'Agudo: "EE"']],
        how: ['Para el grave, baja la mandíbula y redondea los labios.', 'Para el agudo, sonríe y sube la lengua. El aire no cambia.'] },
    ],
  },
  {
    id: 'trans-1', stage: 's4', track: 'harsh', title: 'Limpio, scream, limpio',
    blurb: 'Cambiar de voz sin tropezar',
    listen: 'Sleep Token, "The Summoning": pasa de voz limpia a gutural y regresa en segundos.',
    steps: [
      card('El cambio', 'Lo difícil no es gritar: es volver a cantar limpio justo después. Entre uno y otro, suelta la garganta con una micro-respiración.', 'flame'),
      { kind: 'trans', skill: 'harsh', title: 'Ida y vuelta', cue: 'Alterna voz limpia y scream siguiendo la pantalla.',
        windows: [['clean', 2.5, 'Canta "aaa"'], ['harsh', 2.5, 'Scream'], ['clean', 2.5, 'Limpio'], ['harsh', 2.5, 'Scream'], ['clean', 2.5, 'Limpio']] },
    ],
  },
  {
    id: 'vibrato-1', stage: 's4', track: 'style', title: 'Vibrato a voluntad',
    blurb: 'Recto primero, vibra al final',
    steps: [
      card('Recto y luego vibra', 'En metalcore la nota entra recta y el vibrato aparece al final. Es una ondulación suave del tono, 5 o 6 veces por segundo, que nace de soltar, no de apretar.', 'star'),
      { kind: 'sustain', skill: 'style', title: 'Nota con vibrato', cue: 'Entra recto y deja que la nota ondule al final.', syl: 'aaa', vibrato: true, secs: 5, reps: 3, step: 2, start: 0.35, tol: 80,
        how: ['Empieza moviendo la nota lento a propósito, como sirena mini, y ve acelerando.', 'Mandíbula y lengua quietas: el movimiento es interno.'] },
    ],
  },
  {
    id: 'estilo-3', stage: 's4', track: 'style', title: 'Falsete y adornos',
    blurb: 'Ligero, flotando, con runs',
    listen: 'Sleep Token, "The Summoning": falsete y adornos rápidos en la misma canción.',
    steps: [
      card('Falsete etéreo', 'El falsete es voz de cabeza con aire: ligero, casi flotando. Sleep Token lo usa con adornos rápidos (runs) sacados del R&B.', 'star'),
      { kind: 'pattern', skill: 'style', title: 'Cascada en falsete', cue: 'Baja ligero con "uu", sin peso.', syl: 'uu', dyn: 'soft', backing: 'ambient', notes: [[12, 0.5], [10, 0.5], [7, 0.5], [5, 0.5], [3, 0.5], [0, 1.5]], bpm: 80, reps: 3, step: -1, start: 0.9, tol: 60 },
      { kind: 'pattern', skill: 'style', title: 'Run pentatónico', cue: 'Sube y baja rápido con "oh".', syl: 'oh', notes: [[0, 0.5], [3, 0.5], [5, 0.5], [7, 0.5], [10, 0.5], [7, 0.5], [5, 0.5], [3, 0.5], [0, 2]], bpm: 96, reps: 3, step: 1, start: 0.5, tol: 60,
        how: ['Primero lento y exacto. La velocidad llega sola.'] },
    ],
  },

  // ───────────── Etapa 5 ─────────────
  {
    id: 'potencia-2', stage: 's5', track: 'power', title: 'Limpios con grit',
    blurb: 'Rasgar sin romper',
    listen: 'Architects, "Animals": el coro es cantado, pero con rasguño encima.',
    steps: [
      card('Rasgar sin romper', 'El grit es un poco de fry encima de una nota cantada, como los coros rasposos de Architects. Primero la nota limpia; luego le sumas rasguño al 20 %.', 'bolt'),
      { kind: 'trans', skill: 'power', title: 'Limpia y con grit', cue: 'Misma nota: primero limpia, luego con rasguño.',
        windows: [['clean', 2, 'Nota limpia'], ['harsh', 2, 'Súmale grit'], ['clean', 2, 'Limpia'], ['harsh', 3, 'Con grit']],
        how: ['La nota sigue ahí debajo. El grit es un adorno, no un grito.'] },
      { kind: 'pattern', skill: 'power', title: 'Frase con fuerza', cue: 'Fuerte y abierta.', dyn: 'loud', backing: 'chug', bpm: 90, reps: 3, step: 1, start: 0.6, tol: 60,
        notes: [[7, 1, 'Tear'], [5, 0.5, 'it'], [7, 0.5, 'all'], [3, 2, 'down']] },
    ],
  },
  {
    id: 'scream-3', stage: 's5', track: 'harsh', title: 'Resistencia',
    blurb: 'Frases gritadas completas',
    steps: [
      card('Frases completas', 'Un verso gritado dura varios compases. La clave es respirar rápido por la boca en los huecos y no vaciarte en la primera sílaba.', 'flame'),
      { kind: 'rhythm', skill: 'harsh', title: 'Verso gritado', cue: 'Scream corto en cada marca.', harsh: true, grid: 'x.x.xx.x|x.xx..x.', bpm: 104, reps: 2,
        texts: ['BREAK', 'THE', 'SI', 'LENCE', 'NOW', 'TEAR', 'IT', 'A', 'PART'] },
      { kind: 'harsh', skill: 'harsh', title: 'Scream largo', cue: 'Seis segundos parejos, tres veces.',
        windows: [['harsh', 6, 'Sostén'], ['rest', 3], ['harsh', 6, 'Sostén'], ['rest', 3], ['harsh', 6, 'Última']] },
    ],
  },
  {
    id: 'ritmo-2', stage: 's5', track: 'rhythm', title: 'Flow rápido',
    blurb: 'Sílabas como metralleta',
    listen: 'Falling in Reverse, "Watch the World Burn": versos rapeados a toda velocidad.',
    steps: [
      card('Sílabas como metralleta', 'Falling in Reverse mete versos casi rapeados. Aquí no importa la nota: importa que cada sílaba caiga exacta. Usa "ta-ka" con la lengua suelta.', 'pulse'),
      { kind: 'rhythm', skill: 'rhythm', title: 'Ta-ka', cue: 'Semicorcheas con "ta-ka".', div: 4, grid: 'xxxx..x.xxxx..x.', bpm: 76, reps: 2, texts: ['ta', 'ka'] },
      { kind: 'rhythm', skill: 'rhythm', title: 'Flow sincopado', cue: 'Más rápido y con huecos.', div: 4, grid: 'xx.xx.x.xx.xx.x.', bpm: 84, reps: 3, texts: ['ta', 'ka'] },
    ],
  },
  {
    id: 'final-1', stage: 's5', track: 'style', title: 'Canción completa: Ceniza',
    blurb: 'Verso, coro y breakdown',
    steps: [
      card('Todo junto', 'Verso susurrado, coro arriba, breakdown gritado. Es una canción original corta para juntar todo lo que ya sabes hacer. Calienta antes.', 'star'),
      { kind: 'pattern', skill: 'style', title: 'Ceniza: verso', cue: 'Suave y con aire.', dyn: 'soft', backing: 'ambient', bpm: 84, reps: 1, start: 0.2, tol: 60,
        notes: [[0, 1, 'Ash'], [0, 0.5, 'on'], [3, 1, 'my'], [2, 1.5, 'tongue'], [0, 0.5, 'and'], [-2, 0.5, 'no'], [0, 1, 'thing'], [3, 0.5, 'left'], [2, 0.5, 'to'], [0, 2, 'say']] },
      { kind: 'pattern', skill: 'style', title: 'Ceniza: coro', cue: 'Arriba y con todo.', dyn: 'loud', backing: 'chug', bpm: 92, reps: 2, step: 0, start: 0.7, tol: 60,
        notes: [[7, 1, 'Let'], [10, 1, 'it'], [12, 2, 'burn'], [10, 0.5, 'let'], [8, 0.5, 'it'], [7, 2, 'fall'], [5, 0.5, 'I'], [7, 0.5, 'will'], [8, 1, 'rise'], [7, 0.5, 'a'], [3, 2.5, 'gain']] },
      { kind: 'rhythm', skill: 'harsh', title: 'Ceniza: breakdown', cue: 'Scream en cada marca.', harsh: true, grid: 'x...x...|x.x.x.xx', bpm: 96, reps: 2,
        texts: ['RISE', 'UP', 'FROM', 'THE', 'ASH', 'ES', 'NOW'] },
    ],
  },
  {
    id: 'blegh', stage: 's5', track: 'harsh', title: 'El BLEGH',
    blurb: 'El remate de todo breakdown',
    listen: 'Architects en vivo: Sam Carter volvió famoso este remate.',
    steps: [
      card('La firma', 'El "BLEGH" es el remate de un breakdown: un golpe corto, seco y con todo el aire. Se usa con moderación. Hoy sí toca.', 'flame'),
      { kind: 'harsh', skill: 'harsh', title: '¡BLEGH!', cue: 'Un golpe seco cada vez que aparezca.',
        windows: [['rest', 1.5, 'Toma aire'], ['harsh', 0.9, '¡BLEGH!'], ['rest', 2, 'Respira'], ['harsh', 0.9, '¡BLEGH!'], ['rest', 2, 'Respira'], ['harsh', 0.9, '¡BLEGH!']] },
    ],
  },
];

const POOL = {
  warmups: [
    { id: 'w-trino', kind: 'slide', skill: 'range', title: 'Trino de labios', cue: '"Brrr" con labios sueltos, sube y baja.', syl: 'brrr', from: 0.1, to: 0.75, secs: 5, reps: 2 },
    { id: 'w-mmm', kind: 'pattern', skill: 'pitch', title: 'Zumbido de 5 notas', cue: 'Boca cerrada, "mmm".', syl: 'mmm', notes: FIVE_MAJOR, bpm: 126, reps: 3, step: 1, start: 0.15, listen: 'cue' },
    { id: 'w-ng', kind: 'slide', skill: 'range', title: 'Sirena con "ng"', cue: 'Como el final de "song". Sube y baja suave.', syl: 'ng', from: 0.05, to: 0.9, secs: 6, reps: 2 },
    { id: 'w-ma', kind: 'pattern', skill: 'pitch', title: 'Arpegio menor', cue: 'Con "ma", relajado.', syl: 'ma', notes: [[0, 1], [3, 1], [7, 1], [3, 1], [0, 2]], bpm: 100, reps: 3, step: 1, start: 0.2, listen: 'cue' },
    { id: 'w-sss', kind: 'breath', skill: 'breath', title: 'Hilo de aire', cue: 'Un "sss" largo y parejo para despertar el soporte.', target: 15 },
  ],
  cooldowns: [
    { id: 'c-suspiro', kind: 'slide', skill: 'range', title: 'Suspiros hacia abajo', cue: 'Deja caer la voz con un "aaah" relajado.', syl: 'aaah', shape: 'down', from: 0.05, to: 0.6, secs: 4, reps: 3 },
    { id: 'c-aire', kind: 'pacer', skill: 'breath', title: 'Respira y suelta', cue: 'Tres respiraciones lentas. Ya terminaste.', pattern: [4, 0, 8], cycles: 3 },
    { id: 'c-mmm', kind: 'sustain', skill: 'pitch', title: 'Zumbido grave', cue: 'Un "mmm" suave en una nota cómoda.', syl: 'mmm', dyn: 'soft', secs: 5, reps: 2, step: 0, start: 0.15, tol: 70 },
  ],
};

// Gimnasio: ejercicios que siguen cuando ya no hay lección nueva ese día.
// Se abren por etapa ("needs") y tienen grados como todo lo demás.
const GYM_RAW = [
  { id: 'g-octava', needs: 's1', kind: 'pattern', skill: 'pitch', title: 'Escala menor completa', cue: 'Una octava entera, sube y baja con "na".', syl: 'na', notes: [[0, 0.5], [2, 0.5], [3, 0.5], [5, 0.5], [7, 0.5], [8, 0.5], [10, 0.5], [12, 1], [10, 0.5], [8, 0.5], [7, 0.5], [5, 0.5], [3, 0.5], [2, 0.5], [0, 2]], bpm: 88, reps: 3, step: 1, start: 0.1, backing: 'drone' },
  { id: 'g-terceras', needs: 's1', kind: 'pattern', skill: 'pitch', title: 'Terceras menores', cue: 'Saltos de tercera encadenados, con "no".', syl: 'no', notes: [[0, 0.5], [3, 0.5], [2, 0.5], [5, 0.5], [3, 0.5], [7, 0.5], [5, 0.5], [8, 0.5], [7, 2]], bpm: 88, reps: 3, step: 1, start: 0.2, backing: 'drone' },
  { id: 'g-penta', needs: 's1', kind: 'pattern', skill: 'pitch', title: 'Pentatónica menor', cue: 'La escala de los riffs. Con "ya".', syl: 'ya', notes: [[0, 0.5], [3, 0.5], [5, 0.5], [7, 0.5], [10, 0.5], [12, 1], [10, 0.5], [7, 0.5], [5, 0.5], [3, 0.5], [0, 2]], bpm: 92, reps: 3, step: 1, start: 0.1, backing: 'chug' },
  { id: 'g-sosten', needs: 's1', kind: 'sustain', skill: 'breath', title: 'Nota de 8 segundos', cue: 'Una sola nota, quieta, hasta el final. Con "oh".', syl: 'oh', secs: 8, reps: 2, step: 2, start: 0.3,
    how: ['Gasta el aire parejo. Si la línea baja al final, tomaste aire alto.'] },
  { id: 'g-aire', needs: 's1', kind: 'breath', skill: 'breath', title: 'Hilo de 25 segundos', cue: 'Tu "sss" más largo y parejo.', target: 25 },
  { id: 'g-armonica', needs: 's2', kind: 'pattern', skill: 'pitch', title: 'Menor armónica', cue: 'El sabor de los solos de metal. Con "na".', syl: 'na', notes: [[7, 0.5], [8, 0.5], [11, 0.5], [12, 1], [11, 0.5], [8, 0.5], [7, 1], [3, 0.5], [2, 0.5], [0, 2]], bpm: 88, reps: 3, step: 1, start: 0.2, backing: 'chug',
    how: ['El salto raro entre la 2.ª y 3.ª nota es lo que la hace sonar "egipcia". Apunta despacio.'] },
  { id: 'g-frigia', needs: 's2', kind: 'pattern', skill: 'pitch', title: 'Frigia de breakdown', cue: 'Medio tono arriba de la raíz: el sonido más oscuro.', syl: 'no', notes: [[0, 1], [1, 1], [0, 1], [-2, 1], [0, 1], [1, 0.5], [3, 0.5], [1, 1], [0, 2]], bpm: 84, reps: 3, step: 1, start: 0.25, backing: 'chug' },
  { id: 'g-sextas', needs: 's2', kind: 'pattern', skill: 'range', title: 'Saltos de sexta', cue: 'Salto grande y aterriza limpio. Con "ya".', syl: 'ya', notes: [[0, 1], [8, 1.5], [7, 0.5], [0, 1], [9, 1.5], [7, 0.5], [0, 2]], bpm: 84, reps: 3, step: 1, start: 0.15 },
  { id: 'g-suave-fuerte', needs: 's2', kind: 'pattern', skill: 'style', title: 'Frase susurrada', cue: 'Toda la frase con aire, sin que se caiga la nota.', syl: 'uh', dyn: 'soft', notes: [[0, 1], [3, 1], [5, 1.5], [3, 0.5], [2, 1], [0, 2]], bpm: 80, reps: 3, step: 1, start: 0.2, backing: 'ambient' },
  { id: 'g-pulsos', needs: 's3', kind: 'harsh', skill: 'harsh', title: 'Pulsos de scream', cue: 'Un segundo sí, un segundo no. Seis veces.',
    windows: [['harsh', 1, 'Scream'], ['rest', 1], ['harsh', 1, 'Scream'], ['rest', 1], ['harsh', 1, 'Scream'], ['rest', 1], ['harsh', 1, 'Scream'], ['rest', 1], ['harsh', 1, 'Scream'], ['rest', 1], ['harsh', 1, 'Scream']] },
  { id: 'g-mix-alto', needs: 's3', kind: 'pattern', skill: 'range', title: 'Mix un paso más arriba', cue: '"Nei" burlón, hasta el borde de tu rango.', syl: 'nei', notes: [[0, 0.5], [4, 0.5], [7, 0.5], [12, 1.5], [7, 0.5], [4, 0.5], [0, 1.5]], bpm: 96, reps: 4, step: 1, start: 0.4, stretch: 1 },
  { id: 'g-belt-largo', needs: 's3', kind: 'sustain', skill: 'power', title: 'Belt sostenido', cue: 'Fuerte, brillante y quieto. Con "eh".', syl: 'eh', dyn: 'loud', secs: 5, reps: 3, step: 1, start: 0.6 },
  { id: 'g-ritmo-doble', needs: 's3', kind: 'rhythm', skill: 'rhythm', title: 'Breakdown con síncopa', cue: 'Golpes secos, respeta los silencios.', grid: 'x..x..x.|x.xx..x.', bpm: 100, reps: 2, texts: ['ha'] },
  { id: 'g-interruptor', needs: 's3', kind: 'pattern', skill: 'range', title: 'Interruptor rápido', cue: 'Llena y ligera, un segundo cada una.', syl: 'ah', bpm: 60, reps: 2, step: 1, start: 0.62, tol: 80, listen: 'cue',
    notes: [[0, 1, 'llena', 'chest'], [0, 1, 'ligera', 'head'], [0, 1, 'llena', 'chest'], [0, 1, 'ligera', 'head'], [0, 1, 'llena', 'chest'], [0, 1, 'ligera', 'head']] },
  { id: 'g-run', needs: 's4', kind: 'pattern', skill: 'style', title: 'Run veloz', cue: 'Adorno rápido con "oh", limpio antes que rápido.', syl: 'oh', notes: [[12, 0.25], [10, 0.25], [7, 0.25], [5, 0.25], [3, 0.25], [5, 0.25], [7, 0.5], [3, 0.25], [2, 0.25], [0, 2]], bpm: 80, reps: 3, step: 1, start: 0.4, tol: 65 },
  { id: 'g-trans-rapida', needs: 's4', kind: 'trans', skill: 'harsh', title: 'Cambios rápidos', cue: 'Limpio y scream, segundo y medio cada uno.',
    windows: [['clean', 1.5, 'Limpio'], ['harsh', 1.5, 'Scream'], ['clean', 1.5, 'Limpio'], ['harsh', 1.5, 'Scream'], ['clean', 1.5, 'Limpio'], ['harsh', 1.5, 'Scream'], ['clean', 1.5, 'Limpio']] },
  { id: 'g-vibrato', needs: 's4', kind: 'sustain', skill: 'style', title: 'Vibrato largo', cue: 'Siete segundos: recto al entrar, ondula al final.', syl: 'aaa', vibrato: true, secs: 7, reps: 2, step: 2, start: 0.35, tol: 80 },
  { id: 'g-scream-largo', needs: 's4', kind: 'harsh', skill: 'harsh', title: 'Scream de 8 segundos', cue: 'Parejo, sin subir el volumen al final.', windows: [['harsh', 8, 'Sostén'], ['rest', 4], ['harsh', 8, 'Otra vez']] },
];

// Asigna ids estables a cada paso: "leccion:indice"
export const LESSONS = RAW.map((l) => ({
  ...l,
  steps: l.steps.map((s, i) => ({ ...s, id: `${l.id}:${i}`, lesson: l.id })),
}));

export const WARMUPS = POOL.warmups.map((s) => ({ ...s, nograde: true }));
export const COOLDOWNS = POOL.cooldowns.map((s) => ({ ...s, nograde: true }));
export const GYM = GYM_RAW.map((s) => ({ ...s, gym: true }));

const INDEX = new Map();
for (const l of LESSONS) for (const s of l.steps) INDEX.set(s.id, s);
for (const s of [...WARMUPS, ...COOLDOWNS, ...GYM]) INDEX.set(s.id, s);

export const stepById = (id) => INDEX.get(id) ?? (id === RIFF_ID ? riffOfDay() : undefined);
export const lessonById = (id) => LESSONS.find((l) => l.id === id);
export const isScored = (step) => !['card', 'pacer'].includes(step.kind);
export const isHarsh = (step) => step.kind === 'harsh' || step.kind === 'trans' || (step.kind === 'rhythm' && step.harsh);
