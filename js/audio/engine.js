// Micrófono + bucle de análisis en tiempo real (solo navegador).
// Emite un cuadro por cada refresco de pantalla (30 a 120 por segundo, según el dispositivo)
// con tono, claridad, volumen, peso de la voz y tipo de sonido.

import { createYin } from './pitch.js';
import { createAnalyzer, createWeightMeter, createNoiseGate, classify, gritFrom } from './features.js';
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
let noise = createNoiseGate(0.004);
let roomGate = 0; // puerta fija para cantar con música en el cuarto (0 = sin usar)
let micMode = 'raw'; // 'raw' = sin filtros; 'voice' = procesamiento de voz del sistema
let frameMs = 16.7;
let lastTick = 0;
let lastResume = 0;
let peak = 0;
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

/** ¿El micrófono sigue vivo? En iPad/iPhone se corta al cambiar de app o recibir una llamada. */
function trackAlive() {
  const t = stream?.getAudioTracks?.()[0];
  return !!t && t.readyState === 'live';
}

export const micActive = () => trackAlive();
export const getStream = () => stream;

/** Punto de partida de la puerta de ruido (la guardada en el perfil). Después se adapta sola. */
export const setGate = (g) => {
  noise = createNoiseGate(Math.max(0.0008, g));
  roomGate = 0;
};
export const getGate = () => Math.max(noise.gate(), roomGate);

/** Puerta fija mínima: para cantar con la canción sonando en una bocina o TV. */
export const setRoomGate = (g) => {
  roomGate = g || 0;
};

/** 'raw' (recomendado) o 'voice' (procesamiento de voz del sistema: sube el volumen, pero recorta notas largas y screams). */
export function setMicMode(mode) {
  const next = mode === 'voice' ? 'voice' : 'raw';
  if (next !== micMode) {
    micMode = next;
    if (stream) stopMic();
  }
}

// Claridad mínima para considerar "limpio" un sonido. Más alto = el detector de distorsión es más sensible.
let cleanMin = 0.8;
export const setGritSensitivity = (level) => {
  cleanMin = [0.7, 0.8, 0.88][level] ?? 0.8;
};

export async function startMic() {
  if (stream && trackAlive()) {
    await unlockAudio();
    if (!raf) loop();
    return;
  }
  if (stream) stopMic(); // el micrófono se había cortado: se vuelve a pedir
  if (!navigator.mediaDevices?.getUserMedia) {
    const e = new Error('Este navegador no permite usar el micrófono aquí. Abre la app en https o en localhost.');
    e.code = 'unsupported';
    throw e;
  }
  const c = await unlockAudio();
  const voice = micMode === 'voice';
  try {
    // Sin filtros de llamada por defecto: destruyen las notas largas y "se comen" los screams.
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: voice, noiseSuppression: voice, autoGainControl: voice, channelCount: 1 },
    });
  } catch (err) {
    const e = new Error(
      err?.name === 'NotAllowedError'
        ? 'El micrófono está bloqueado. Actívalo en el candado de la barra de direcciones (o en Ajustes del navegador) y vuelve a intentar.'
        : 'No encontré un micrófono disponible. Si otra app lo está usando, ciérrala y vuelve a intentar.'
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
  peak = 0;
  if (!raf) loop();
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
  const nowMs = performance.now();
  if (lastTick) frameMs = frameMs * 0.95 + Math.min(200, nowMs - lastTick) * 0.05;
  lastTick = nowMs;
  if (!analyser) return;
  if (ctx.state !== 'running') {
    // Tras una interrupción (cambio de app, llamada) el audio queda pausado: se reintenta solo
    if (nowMs - lastResume > 1000) {
      lastResume = nowMs;
      ctx.resume().catch(() => {});
    }
    return;
  }
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

  // Puerta de ruido: se adapta al lugar. Un tono claro puede contar aunque llegue bajito,
  // porque el ruido de fondo no es periódico (salvo que haya música: ahí manda la puerta fija).
  const adaptive = noise.update(f.rms);
  const gate = Math.max(adaptive, roomGate);
  const tonalGate = roomGate ? gate : p.clarity >= 0.75 ? gate * 0.5 : gate;
  f.gate = gate;
  f.voiced = f.rms >= tonalGate && p.clarity >= 0.62 && p.freq > 60 && p.freq < 1250;
  if (f.rms > peak) peak = f.rms;

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
  f.kind = classify(f, tonalGate, cleanMin);
  f.grit = f.kind === 'silence' || f.kind === 'hiss' ? 0 : gritFrom(p.clarity);
  for (const fn of listeners) fn(f);
}

/**
 * Mide el ruido ambiente con el micrófono en silencio y fija el piso de ruido.
 * Devuelve la puerta resultante (para guardarla en el perfil).
 */
export function calibrate(ms = 1200) {
  return new Promise((resolve) => {
    const vals = [];
    const off = onFrame((f) => vals.push(f.rms));
    setTimeout(() => {
      off();
      vals.sort((a, b) => a - b);
      if (vals.length) noise.setFloor(vals[Math.floor(vals.length * 0.7)]);
      resolve(noise.gate());
    }, ms);
  });
}

/** Fija el piso de ruido con una medición hecha por quien llama (por ejemplo, el arranque de una toma). */
export const setNoiseFloor = (rms) => noise.setFloor(rms);

/** Datos técnicos del micrófono para el diagnóstico. */
export function micInfo() {
  const track = stream?.getAudioTracks?.()[0];
  let settings = {};
  try {
    settings = track?.getSettings?.() ?? {};
  } catch {
    /* no disponible */
  }
  return {
    alive: trackAlive(),
    muted: !!track?.muted,
    label: track?.label ?? '',
    mode: micMode,
    contextState: ctx?.state ?? 'sin iniciar',
    sampleRate: ctx?.sampleRate ?? 0,
    trackSampleRate: settings.sampleRate ?? null,
    echoCancellation: settings.echoCancellation ?? null,
    noiseSuppression: settings.noiseSuppression ?? null,
    autoGainControl: settings.autoGainControl ?? null,
    fps: Math.round(1000 / frameMs),
    floor: noise.floor(),
    gate: getGate(),
    peak,
  };
}
