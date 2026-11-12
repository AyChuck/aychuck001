// Señales y cuadros sintéticos para las pruebas.
import { createYin } from '../js/audio/pitch.js';
import { createAnalyzer, classify } from '../js/audio/features.js';
import { freqToMidi } from '../js/music/notes.js';

export const SR = 48000;
export const N = 2048;

// Generador pseudoaleatorio determinista
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Voz limpia: fundamental + armónicos. */
export function voice(freq, n = N, amp = 0.3, phase = 0) {
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = (i + phase) / SR;
    b[i] = amp * (Math.sin(2 * Math.PI * freq * t) + 0.5 * Math.sin(4 * Math.PI * freq * t) + 0.25 * Math.sin(6 * Math.PI * freq * t));
  }
  return b;
}

/** "sss": ruido blanco pasado por un pasa-altos sencillo. */
export function hiss(n = N, amp = 0.2, seed = 3) {
  const r = rng(seed);
  const b = new Float32Array(n);
  let prev = 0;
  let prevOut = 0;
  for (let i = 0; i < n; i++) {
    const x = (r() * 2 - 1) * amp;
    // pasa-altos de primer orden (~5 kHz) aplicado dos veces
    const y = 0.55 * (prevOut + x - prev);
    prev = x;
    prevOut = y;
    b[i] = y;
  }
  for (let i = n - 1; i > 0; i--) b[i] = b[i] - b[i - 1];
  return b;
}

/** Scream sintético: pulsos glotales irregulares + ruido en la banda media. */
export function scream(n = N, amp = 0.3, seed = 7) {
  const r = rng(seed);
  const b = new Float32Array(n);
  let next = 0;
  let lp = 0;
  let lp2 = 0;
  for (let i = 0; i < n; i++) {
    let x = (r() * 2 - 1) * 0.6;
    if (i >= next) {
      x += (0.6 + r() * 0.8) * 3;
      next = i + Math.round((SR / 140) * (0.55 + r() * 0.9)); // periodo muy irregular
    }
    lp += 0.25 * (x - lp); // pasa-bajos ~2 kHz
    lp2 += 0.25 * (lp - lp2);
    b[i] = lp2 * amp;
  }
  return b;
}

export function analyzeBuf(buf, gate = 0.01) {
  const yin = createYin(SR, N);
  const an = createAnalyzer(SR, N);
  const p = yin(buf);
  const a = an(buf);
  const f = { ...p, ...a };
  f.kind = classify(f, gate);
  f.midi = freqToMidi(f.freq);
  return f;
}

/** Cuadros sintéticos a 50 fps para probar la calificación. fn(t) -> parcial del cuadro. */
export function makeFrames(dur, fn, fps = 50) {
  const out = [];
  for (let i = 0; i < dur * fps; i++) {
    const t = i / fps;
    const p = fn(t) ?? {};
    const voiced = p.midi != null;
    out.push({
      t,
      midi: p.midi ?? 0,
      voiced,
      clarity: voiced ? 0.95 : 0.3,
      rms: p.rms ?? (voiced || p.kind ? 0.1 : 0.001),
      db: p.db ?? (voiced || p.kind ? -20 : -60),
      centroid: p.centroid ?? 1200,
      kind: p.kind ?? (voiced ? 'clean' : 'silence'),
    });
  }
  return out;
}

/** Canta el plan a la perfección, con un error opcional en cents. */
export function singPlan(plan, errFn = () => 0) {
  return makeFrames(plan.dur, (t) => {
    const n = plan.notes.find((x) => x.seg === 'sing' && t >= x.t0 && t < x.t1);
    if (!n) return null;
    return { midi: n.midi + errFn(t, n) / 100 };
  });
}
