// Utilidades de notas: frecuencia <-> MIDI <-> nombre.

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SOLFA = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];

export const freqToMidi = (f) => 69 + 12 * Math.log2(f / 440);
export const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function midiName(m) {
  const r = Math.round(m);
  return NAMES[((r % 12) + 12) % 12] + (Math.floor(r / 12) - 1);
}

export function midiSolfa(m) {
  const r = Math.round(m);
  return SOLFA[((r % 12) + 12) % 12] + (Math.floor(r / 12) - 1);
}

/** Desviación en cents de una nota MIDI fraccionaria respecto a un objetivo. */
export const centsFrom = (midi, target) => (midi - target) * 100;

/** Tipo de voz aproximado según el rango cómodo (solo orientativo). */
export function voiceType(low, high) {
  const center = (low + high) / 2;
  if (center < 51) return 'Bajo';
  if (center < 55) return 'Barítono';
  if (center < 59.5) return 'Tenor';
  if (center < 63) return 'Contralto';
  if (center < 66.5) return 'Mezzosoprano';
  return 'Soprano';
}

export function rangeLabel(low, high) {
  const st = Math.round(high - low);
  const oct = Math.floor(st / 12);
  const rest = st % 12;
  const parts = [];
  if (oct) parts.push(`${oct} octava${oct > 1 ? 's' : ''}`);
  if (rest) parts.push(`${rest} semitono${rest > 1 ? 's' : ''}`);
  return parts.join(' y ') || '0 semitonos';
}
