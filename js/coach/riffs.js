// "Riff del día": una frase nueva cada día, generada con las escalas del género.
// Da variedad infinita sin repetir lo mismo, y siempre dentro de tu rango.

export const RIFF_ID = 'riff-dia';

const SCALES = [
  { name: 'menor natural', semis: [0, 2, 3, 5, 7, 8, 10, 12], backing: 'chug' },
  { name: 'menor armónica', semis: [0, 2, 3, 5, 7, 8, 11, 12], backing: 'chug' },
  { name: 'pentatónica menor', semis: [0, 3, 5, 7, 10, 12], backing: 'drone' },
  { name: 'frigia', semis: [0, 1, 3, 5, 7, 8, 10, 12], backing: 'chug' },
  { name: 'dórica', semis: [0, 2, 3, 5, 7, 9, 10, 12], backing: 'ambient' },
];
const SYLS = ['na', 'ya', 'no', 'da', 'oh', 'ne'];

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** day: número de día (entero). El mismo día siempre da el mismo riff. */
export function riffOfDay(day = Math.floor(Date.now() / 86400000)) {
  const r = rng(day * 2654435761);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const scale = pick(SCALES);
  const n = 6 + Math.floor(r() * 3);
  let i = r() < 0.5 ? 0 : Math.min(scale.semis.length - 1, 4);
  const notes = [];
  for (let k = 0; k < n; k++) {
    notes.push([scale.semis[i], r() < 0.6 ? 0.5 : 1]);
    const move = pick([-2, -1, -1, 1, 1, 1, 2]);
    i = Math.max(0, Math.min(scale.semis.length - 1, i + move));
  }
  // Remata en la raíz o en la quinta, nota larga
  notes.push([r() < 0.7 ? 0 : 7, 2]);
  return {
    id: RIFF_ID,
    kind: 'pattern',
    skill: 'pitch',
    nograde: true,
    title: 'Riff del día',
    cue: `Frase nueva de hoy en escala ${scale.name}. Escucha y repite.`,
    syl: pick(SYLS),
    notes,
    bpm: 84 + Math.floor(r() * 5) * 6,
    reps: 3,
    step: 1,
    start: 0.25,
    backing: scale.backing,
  };
}
