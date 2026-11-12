// Sonidos de la app, todos sintetizados con Web Audio (sin archivos):
// notas guía, metrónomo, bases de acompañamiento y efectos.

import { audioCtx } from './engine.js';
import { midiToFreq } from '../music/notes.js';

let noiseBuf = null;
function noise(c) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

let curve = null;
function distCurve() {
  if (!curve) {
    curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 511.5 - 1) * 6;
      curve[i] = Math.tanh(x);
    }
  }
  return curve;
}

/** Un "bus" agrupa todo lo que suena en una toma para poder cortarlo de golpe. */
export function createBus(volume = 1) {
  const c = audioCtx();
  const out = c.createGain();
  out.gain.value = volume;
  out.connect(c.destination);
  let guitar = null;

  const env = (node, t0, dur, peak, attack = 0.015, release = 0.08) => {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.setValueAtTime(peak, Math.max(t0 + attack, t0 + dur - release));
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    node.connect(g);
    return g;
  };

  const osc = (type, freq, t0, dur) => {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
    return o;
  };

  const bus = {
    out,
    /** Nota guía: timbre suave tipo piano eléctrico. */
    tone(midi, t0, dur, gain = 0.22) {
      const f = midiToFreq(midi);
      const mix = c.createGain();
      const a = osc('triangle', f, t0, dur);
      const b = osc('sine', f * 2, t0, dur);
      const bg = c.createGain();
      bg.gain.value = 0.25;
      a.connect(mix);
      b.connect(bg).connect(mix);
      env(mix, t0, dur, gain, 0.02, Math.min(0.12, dur * 0.4)).connect(out);
    },
    /** Deslizamiento guía para sirenas. pts: [[t, midi], ...] */
    glide(pts, gain = 0.12) {
      const [t0] = pts[0];
      const t1 = pts[pts.length - 1][0];
      const o = osc('triangle', midiToFreq(pts[0][1]), t0, t1 - t0);
      for (const [t, m] of pts.slice(1)) o.frequency.exponentialRampToValueAtTime(midiToFreq(m), t);
      env(o, t0, t1 - t0, gain, 0.05, 0.15).connect(out);
    },
    click(t0, accent = false) {
      const o = osc('square', accent ? 1760 : 1175, t0, 0.04);
      env(o, t0, 0.04, accent ? 0.16 : 0.1, 0.002, 0.03).connect(out);
    },
    /** Golpe corto para demostrar ritmos. */
    blip(t0, gain = 0.25) {
      const s = c.createBufferSource();
      s.buffer = noise(c);
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1100;
      bp.Q.value = 1.2;
      s.connect(bp);
      env(bp, t0, 0.11, gain, 0.004, 0.08).connect(out);
      s.start(t0, Math.random() * 0.5, 0.15);
    },
    kick(t0, gain = 0.5) {
      const o = c.createOscillator();
      o.frequency.setValueAtTime(150, t0);
      o.frequency.exponentialRampToValueAtTime(42, t0 + 0.12);
      o.start(t0);
      o.stop(t0 + 0.25);
      env(o, t0, 0.22, gain, 0.003, 0.15).connect(out);
    },
    snare(t0, gain = 0.3) {
      const s = c.createBufferSource();
      s.buffer = noise(c);
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1900;
      bp.Q.value = 0.7;
      s.connect(bp);
      env(bp, t0, 0.2, gain, 0.002, 0.16).connect(out);
      s.start(t0, Math.random() * 0.5, 0.25);
      const o = osc('triangle', 190, t0, 0.1);
      env(o, t0, 0.1, gain * 0.5, 0.002, 0.08).connect(out);
    },
    hat(t0, gain = 0.06) {
      const s = c.createBufferSource();
      s.buffer = noise(c);
      const hp = c.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 7500;
      s.connect(hp);
      env(hp, t0, 0.05, gain, 0.002, 0.04).connect(out);
      s.start(t0, Math.random() * 0.5, 0.08);
    },
    /** Guitarra rítmica con distorsión (power chord en palm mute). */
    chug(midi, t0, dur = 0.16, gain = 0.5) {
      if (!guitar) {
        const pre = c.createGain();
        pre.gain.value = 0.9;
        const ws = c.createWaveShaper();
        ws.curve = distCurve();
        ws.oversample = '2x';
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 2400;
        const post = c.createGain();
        post.gain.value = 0.11;
        pre.connect(ws).connect(lp).connect(post).connect(out);
        guitar = pre;
      }
      for (const [semi, det] of [[0, -4], [7, 3], [12, 0]]) {
        const o = osc('sawtooth', midiToFreq(midi + semi), t0, dur);
        o.detune.value = det;
        env(o, t0, dur, gain / 3, 0.004, dur * 0.7).connect(guitar);
      }
    },
    /** Colchón sostenido: raíz + quinta (drone) o acorde menor aéreo (ambient). */
    pad(root, t0, t1, kind = 'drone') {
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = kind === 'ambient' ? 900 : 1400;
      const notes = kind === 'ambient' ? [root - 12, root - 5, root + 3, root + 7] : [root - 12, root - 5];
      for (const m of notes) {
        const o = osc(kind === 'ambient' ? 'sawtooth' : 'triangle', midiToFreq(m), t0, t1 - t0);
        o.detune.value = (Math.random() - 0.5) * 10;
        const g = c.createGain();
        g.gain.value = kind === 'ambient' ? 0.3 : 0.6;
        o.connect(g).connect(lp);
      }
      env(lp, t0, t1 - t0, kind === 'ambient' ? 0.07 : 0.06, 0.6, 0.6).connect(out);
    },
    /** Base de metalcore a medio tiempo: bombo + guitarra en corcheas, caja en el 3. */
    groove(root, t0, t1, bpm) {
      const beat = 60 / bpm;
      const low = 28 + ((((Math.round(root) - 28) % 12) + 12) % 12); // raíz en la octava grave de la guitarra
      const pattern = 'x.xx.x.x';
      let i = 0;
      for (let t = t0; t < t1 - 0.05; t += beat / 2, i++) {
        const pos = i % 8;
        if (pattern[pos] === 'x') {
          bus.chug(low, t, beat * 0.42);
          if (pos !== 4) bus.kick(t, 0.4);
        }
        if (pos === 4) bus.snare(t);
        if (pos % 2 === 0) bus.hat(t);
      }
    },
    stop() {
      const now = c.currentTime;
      out.gain.cancelScheduledValues(now);
      out.gain.setValueAtTime(out.gain.value, now);
      out.gain.linearRampToValueAtTime(0, now + 0.04);
      setTimeout(() => out.disconnect(), 120);
    },
  };
  return bus;
}

/** Efectos cortos de interfaz. */
export function sfx(name) {
  let c;
  try {
    c = audioCtx();
  } catch {
    return;
  }
  if (c.state !== 'running') return;
  const bus = createBus(0.5);
  const t = c.currentTime + 0.02;
  const seq = {
    pass: [[64, 0], [71, 0.09]],
    star: [[76, 0], [79, 0.07], [83, 0.14]],
    fail: [[52, 0], [50, 0.12]],
    level: [[57, 0], [64, 0.1], [69, 0.2], [76, 0.3]],
    tick: [[88, 0]],
  }[name] ?? [];
  for (const [m, dt] of seq) bus.tone(m, t + dt, 0.16, 0.14);
  setTimeout(() => bus.stop(), 900);
}
