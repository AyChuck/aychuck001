// Micrófono + bucle de análisis en tiempo real (solo navegador).
// Emite ~60 cuadros por segundo con tono, claridad, volumen y tipo de sonido.

import { createYin } from './pitch.js';
import { createAnalyzer, createWeightMeter, classify, gritFrom } from './features.js';
import { freqToMidi } from '../music/notes.js';

const SIZE = 2048;

let ctx = null;
let stream = null;
let source = null;
let analyser = null;
let buf = null;
let bytes = null;
let yin = null;
let analyze = null;
let weigh = null;
let weightEma = null;
let raf = 0;
let gate = 0.012;
const listeners = new Set();
const recent = [];

export function audioCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC({ latencyHint: 'interactive' });
  }
  return ctx;
}

/** Debe llamarse desde un toque/clic: los navegadores bloquean el audio sin gesto. */
export async function unlockAudio() {
  const c = audioCtx();
  if (c.state !== 'running') {
    try {
      await c.resume();
    } catch {
      /* se reintenta en el siguiente gesto */
    }
  }
  return c;
}

export const micActive = () => !!stream;
export const getStream = () => stream;
export const setGate = (g) => {
  gate = Math.max(0.004, g);
};
export const getGate = () => gate;

// Claridad mínima para considerar "limpio" un sonido. Más alto = el detector de distorsión es más sensible.
let cleanMin = 0.8;
export const setGritSensitivity = (level) => {
  cleanMin = [0.7, 0.8, 0.88][level] ?? 0.8;
};

export async function startMic() {
  if (stream) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    const e = new Error('Este navegador no permite usar el micrófono aquí. Abre la app en https o en localhost.');
    e.code = 'unsupported';
    throw e;
  }
  const c = await unlockAudio();
  try {
    // Sin filtros de llamada: destruyen el tono y "se comen" los screams.
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    });
  } catch (err) {
    const e = new Error(
      err?.name === 'NotAllowedError'
        ? 'El micrófono está bloqueado. Actívalo en el candado de la barra de direcciones y vuelve a intentar.'
        : 'No encontré un micrófono. Conecta uno y vuelve a intentar.'
    );
    e.code = err?.name === 'NotAllowedError' ? 'denied' : 'nomic';
    throw e;
  }
  source = c.createMediaStreamSource(stream);
  analyser = c.createAnalyser();
  analyser.fftSize = SIZE;
  analyser.smoothingTimeConstant = 0;
  source.connect(analyser);
  buf = new Float32Array(SIZE);
  yin = createYin(c.sampleRate, SIZE);
  analyze = createAnalyzer(c.sampleRate, SIZE);
  weigh = createWeightMeter(c.sampleRate, SIZE);
  recent.length = 0;
  loop();
}

export function stopMic() {
  cancelAnimationFrame(raf);
  raf = 0;
  try {
    source?.disconnect();
  } catch {
    /* ya desconectado */
  }
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  source = null;
  analyser = null;
}

export function onFrame(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function loop() {
  raf = requestAnimationFrame(loop);
  if (!analyser || ctx.state !== 'running') return;
  if (analyser.getFloatTimeDomainData) analyser.getFloatTimeDomainData(buf);
  else {
    // Navegadores viejos solo entregan la onda en bytes
    bytes ??= new Uint8Array(SIZE);
    analyser.getByteTimeDomainData(bytes);
    for (let i = 0; i < SIZE; i++) buf[i] = (bytes[i] - 128) / 128;
  }
  const f = analyze(buf);
  const p = yin(buf);
  f.t = ctx.currentTime;
  f.clarity = p.clarity;
  f.freq = p.freq;
  f.voiced = f.rms >= gate && p.clarity >= 0.62 && p.freq > 60 && p.freq < 1250;
  let midi = f.voiced ? freqToMidi(p.freq) : 0;
  // Mediana de 3 para quitar picos sueltos (errores de octava de un cuadro)
  if (f.voiced) {
    recent.push(midi);
    if (recent.length > 3) recent.shift();
    if (recent.length === 3) midi = [...recent].sort((a, b) => a - b)[1];
  } else recent.length = 0;
  f.midi = midi;
  // Peso de la voz (registro), suavizado para que no brinque
  if (f.voiced && p.clarity >= 0.75) {
    const w = weigh(buf, p.freq);
    weightEma = weightEma == null ? w : weightEma * 0.65 + w * 0.35;
    f.weight = weightEma;
  } else {
    weightEma = null;
    f.weight = null;
  }
  f.kind = classify(f, gate, cleanMin);
  f.grit = f.kind === 'silence' || f.kind === 'hiss' ? 0 : gritFrom(p.clarity);
  for (const fn of listeners) fn(f);
}

/** Mide el ruido ambiente y fija la puerta de ruido. Pide silencio ~1.2 s. */
export function calibrate(ms = 1200) {
  return new Promise((resolve) => {
    const vals = [];
    const off = onFrame((f) => vals.push(f.rms));
    setTimeout(() => {
      off();
      vals.sort((a, b) => a - b);
      const p90 = vals.length ? vals[Math.floor(vals.length * 0.9)] : 0.004;
      const g = Math.min(0.05, Math.max(0.006, p90 * 3));
      setGate(g);
      resolve(g);
    }, ms);
  });
}
