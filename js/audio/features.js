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
