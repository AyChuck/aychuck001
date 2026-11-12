// Rasgos espectrales por cuadro + clasificación del tipo de sonido.
// Todo es puro (sin Web Audio) para poder probarlo con señales sintéticas.

const FFT_SIZE = 1024;

function makeFft(n) {
  const cos = new Float32Array(n / 2);
  const sin = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / n);
    sin[i] = Math.sin((2 * Math.PI * i) / n);
  }
  const rev = new Uint32Array(n);
  const bits = Math.log2(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
    rev[i] = r;
  }
  return function fft(re, im) {
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        const tr = re[i];
        re[i] = re[j];
        re[j] = tr;
        const ti = im[i];
        im[i] = im[j];
        im[j] = ti;
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1;
      const step = n / len;
      for (let i = 0; i < n; i += len) {
        for (let k = 0; k < half; k++) {
          const c = cos[k * step];
          const s = sin[k * step];
          const a = i + k;
          const b = a + half;
          const xr = re[b] * c + im[b] * s;
          const xi = im[b] * c - re[b] * s;
          re[b] = re[a] - xr;
          im[b] = im[a] - xi;
          re[a] += xr;
          im[a] += xi;
        }
      }
    }
  };
}

export function createAnalyzer(sampleRate, size) {
  const n = Math.min(FFT_SIZE, size);
  const fft = makeFft(n);
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  const hann = new Float32Array(n);
  for (let i = 0; i < n; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  const binHz = sampleRate / n;
  const lo = Math.max(1, Math.round(80 / binHz));
  const hi = Math.min(n / 2 - 1, Math.round(9000 / binHz));
  const split = Math.round(3500 / binHz);

  return function analyze(buf) {
    let sq = 0;
    for (let i = 0; i < buf.length; i++) sq += buf[i] * buf[i];
    const rms = Math.sqrt(sq / buf.length);

    const off = buf.length - n;
    for (let i = 0; i < n; i++) {
      re[i] = buf[off + i] * hann[i];
      im[i] = 0;
    }
    fft(re, im);

    let total = 0;
    let weighted = 0;
    let high = 0;
    for (let k = lo; k <= hi; k++) {
      const p = re[k] * re[k] + im[k] * im[k];
      total += p;
      weighted += p * k * binHz;
      if (k >= split) high += p;
    }
    const centroid = total > 0 ? weighted / total : 0;
    const hfRatio = total > 0 ? high / total : 0;
    return { rms, db: toDb(rms), centroid, hfRatio };
  };
}

export const toDb = (rms) => 20 * Math.log10(Math.max(rms, 1e-7));

/**
 * "Peso" de la voz: cuánta energía tienen los armónicos superiores frente a la nota base.
 * Es la huella acústica del registro:
 *  - voz llena (pecho, belt): las cuerdas chocan con todo su cuerpo → muchos armónicos fuertes → peso alto
 *  - voz ligera (cabeza, falsete): solo vibra el borde → casi solo la fundamental → peso bajo
 * Devuelve dB (aprox. de -30 a +15). El valor absoluto depende mucho de la vocal y de la
 * nota (con "i" y "u" casi todo es fundamental), así que NO sirve para etiquetar un sonido
 * suelto. Sí sirve comparando la misma nota con la misma vocal abierta ("ah", "eh"):
 * ahí la voz llena queda 10 dB o más por encima de la ligera. Por eso los ejercicios
 * comparan tus dos voces entre sí.
 */
export function createWeightMeter(sampleRate, size) {
  const hann = new Float32Array(size);
  for (let i = 0; i < size; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
  return function weight(buf, f0) {
    if (!(f0 > 50)) return null;
    const K = Math.max(3, Math.min(8, Math.floor(4000 / f0))); // armónicos por debajo de 4 kHz
    let h1 = 0;
    let rest = 0;
    for (let k = 1; k <= K; k++) {
      const w = (2 * Math.PI * k * f0) / sampleRate;
      const cw = Math.cos(w);
      const sw = Math.sin(w);
      let c = 1;
      let s = 0;
      let re = 0;
      let im = 0;
      for (let n = 0; n < size; n++) {
        const x = buf[n] * hann[n];
        re += x * c;
        im -= x * s;
        const c2 = c * cw - s * sw;
        s = s * cw + c * sw;
        c = c2;
      }
      const p = re * re + im * im;
      if (k === 1) h1 = p;
      else rest += p;
    }
    return Math.max(-60, Math.min(30, 10 * Math.log10((rest + 1e-12) / (h1 + 1e-12))));
  };
}

/** Peso en dB → índice 0 (muy ligera) a 1 (muy llena), para medidores y colores. */
export const weightIndex = (db) => (db == null ? null : Math.max(0, Math.min(1, (db + 12) / 22)));

/**
 * Puerta de ruido adaptativa. Sigue el ruido de fondo del lugar y del micrófono:
 * baja rápido cuando hay silencio y sube despacio, solo con sonidos cercanos al piso
 * (así tu voz, que es mucho más fuerte, nunca la mueve). Hace que la app funcione
 * igual con un micrófono que entrega la señal muy baja (iPad sin ganancia automática)
 * que con uno fuerte.
 */
export function createNoiseGate(initialGate = 0.004) {
  const MIN_FLOOR = 0.0002;
  let floor = Math.max(MIN_FLOOR, initialGate / 3.2);
  const gate = () => Math.min(0.08, Math.max(0.001, floor * 3.2));
  return {
    update(rms) {
      if (rms < floor) floor += (rms - floor) * 0.2;
      else if (rms < floor * 4) floor += (rms - floor) * 0.01;
      if (floor < MIN_FLOOR) floor = MIN_FLOOR;
      return gate();
    },
    gate,
    floor: () => floor,
    /** Fija el piso a partir de una medición de silencio (calibración). */
    setFloor(rms) {
      floor = Math.max(MIN_FLOOR, rms);
    },
  };
}

/** Índice de distorsión 0..1 a partir de la claridad del tono. */
export const gritFrom = (clarity) => Math.max(0, Math.min(1, (0.9 - clarity) / 0.45));

/**
 * Tipo de sonido de un cuadro:
 *  - silence: por debajo de la puerta de ruido
 *  - clean:   tono periódico (voz cantada limpia)
 *  - hiss:    ruido agudo sin tono ("sss", aire)
 *  - harsh:   sonido con energía pero aperiódico (fry, false cord, scream)
 */
export function classify(f, gate, cleanMin = 0.8) {
  if (f.rms < gate) return 'silence';
  if (f.clarity >= cleanMin && f.freq > 0) return 'clean';
  if (f.hfRatio > 0.45 && f.clarity < 0.6) return 'hiss';
  return 'harsh';
}
