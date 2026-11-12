// Práctica libre: afinador en vivo, medidor de distorsión y grabadora.

import { html, useState, useEffect, useRef } from '../lib.js';
import { Icon, Canvas, Bar } from './common.js';
import { drawPitch } from './rolls.js';
import { startMic, onFrame, audioCtx, unlockAudio, getStream, setGate, getGate, micInfo, setGritSensitivity } from '../audio/engine.js';
import { createBus } from '../audio/synth.js';
import { midiName } from '../music/notes.js';
import { toDb } from '../audio/features.js';
import { useStore } from '../store.js';
import { WeightMeter } from './Player.js';

export function Studio() {
  const s = useStore();
  const [on, setOn] = useState(false);
  const [err, setErr] = useState(null);
  const [live, setLive] = useState({ note: '—', cents: 0, voiced: false, grit: 0, db: -60, kind: 'silence', weight: null });
  const [span, setSpan] = useState(null);
  const [drone, setDrone] = useState(false);
  const [rec, setRec] = useState('idle'); // idle | rec | done
  const [url, setUrl] = useState(null);
  const frames = useRef([]);
  const view = useRef({ lo: s.profile.low - 4, hi: s.profile.high + 4 });
  const t0 = useRef(0);
  const bus = useRef(null);
  const recorder = useRef(null);

  useEffect(() => {
    if (!on) return undefined;
    t0.current = audioCtx().currentTime;
    let lo = Infinity;
    let hi = -Infinity;
    let n = 0;
    const off = onFrame((f) => {
      const fr = { ...f, t: f.t - t0.current };
      frames.current.push(fr);
      if (frames.current.length > 900) frames.current.splice(0, 300);
      if (f.voiced && f.clarity > 0.85) {
        lo = Math.min(lo, f.midi);
        hi = Math.max(hi, f.midi);
      }
      if (n++ % 6 === 0) {
        const near = Math.round(f.midi);
        setLive({ note: f.voiced ? midiName(near) : '—', cents: f.voiced ? Math.round((f.midi - near) * 100) : 0, voiced: f.voiced, grit: f.grit, db: f.db, kind: f.kind, weight: f.weight });
        if (hi > lo) setSpan([Math.round(lo), Math.round(hi)]);
      }
    });
    return off;
  }, [on]);

  useEffect(
    () => () => {
      bus.current?.stop();
      if (recorder.current?.state === 'recording') recorder.current.stop();
    },
    []
  );

  const start = async () => {
    setErr(null);
    try {
      await unlockAudio();
      await startMic();
      setGate(s.profile.gate);
      setGritSensitivity(s.settings.grit ?? 1);
      setOn(true);
    } catch (e) {
      setErr(e.message);
    }
  };

  const toggleDrone = () => {
    if (drone) {
      bus.current?.stop();
      bus.current = null;
      setDrone(false);
    } else {
      const c = audioCtx();
      bus.current = createBus();
      const root = Math.round(s.profile.low + (s.profile.high - s.profile.low) * 0.35);
      bus.current.pad(root, c.currentTime + 0.05, c.currentTime + 600, 'drone');
      setDrone(root);
    }
  };

  const toggleRec = () => {
    if (rec === 'rec') {
      recorder.current?.stop();
      return;
    }
    if (!window.MediaRecorder) {
      setErr('Este navegador no permite grabar aquí.');
      return;
    }
    const chunks = [];
    const r = new MediaRecorder(getStream());
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    r.onstop = () => {
      if (url) URL.revokeObjectURL(url);
      setUrl(URL.createObjectURL(new Blob(chunks, { type: r.mimeType })));
      setRec('done');
    };
    recorder.current = r;
    r.start();
    setRec('rec');
  };

  const draw = (g, w, h) => {
    const fs = frames.current;
    const now = audioCtx().currentTime - t0.current;
    // La vista sigue a tu voz con suavidad
    const last = [...fs].reverse().find((f) => f.voiced && now - f.t < 1.5);
    if (last) {
      const v = view.current;
      const mid = (v.lo + v.hi) / 2;
      if (last.midi > v.hi - 3 || last.midi < v.lo + 3) {
        const d = (last.midi - mid) * 0.04;
        v.lo += d;
        v.hi += d;
      }
    }
    drawPitch(g, w, h, { plan: null, frames: fs, now, byWeight: true, ...view.current });
  };

  if (!on) {
    return html`<div class="screen">
      <header class="top"><h1 class="title">Práctica libre</h1></header>
      <section class="hero-card">
        <div class="eyebrow">Sin calificación</div>
        <h1>Canta lo que quieras</h1>
        <p class="lead">Aquí ves tu nota en vivo, si estás en voz llena o ligera (la línea cambia de naranja a azul), cuánta distorsión llevas, y puedes grabarte para escucharte.</p>
        <button class="btn primary big" onClick=${start}><${Icon} name="mic" /> Abrir micrófono</button>
        ${err && html`<p class="note warn">${err}</p>`}
      </section>
    </div>`;
  }

  const gateDb = toDb(getGate());
  const ceilDb = Math.min(-3, Math.max(gateDb + 24, toDb(micInfo().peak) + 4));
  const kindName = { clean: 'Voz limpia', harsh: 'Distorsión', hiss: 'Aire', silence: 'Silencio' }[live.kind];
  return html`<div class="screen">
    <header class="top"><h1 class="title">Práctica libre</h1></header>
    <section class="tuner">
      <div class="tuner-note num">${live.note}</div>
      <div class="needle" aria-label=${`${live.cents} cents`}>
        <i style=${`left:${50 + Math.max(-50, Math.min(50, live.cents))}%`} class=${live.voiced ? (Math.abs(live.cents) <= 15 ? 'ok' : 'warn') : 'off'}></i>
      </div>
      <div class="needle-labels"><span>bajo</span><span>${live.voiced ? `${live.cents > 0 ? '+' : ''}${live.cents} cents` : kindName}</span><span>alto</span></div>
    </section>
    <${Canvas} draw=${draw} class="pitch" />
    <${WeightMeter} db=${live.weight} />
    <div class="meters">
      <${Bar} label="Distorsión" value=${live.grit * 100} tone="ember" right=${`${Math.round(live.grit * 100)} %`} />
      <${Bar} label="Volumen" value=${((live.db - gateDb) / (ceilDb - gateDb)) * 100} tone="ice" right=${kindName} />
    </div>
    ${span && html`<p class="muted small">En esta sesión: de ${midiName(span[0])} a ${midiName(span[1])}.</p>`}
    <div class="row">
      <button class=${`btn ${drone ? 'primary' : 'ghost'}`} onClick=${toggleDrone}>${drone ? `Nota base: ${midiName(drone)} (parar)` : 'Nota base'}</button>
      <button class=${`btn ${rec === 'rec' ? 'danger' : 'ghost'}`} onClick=${toggleRec}><${Icon} name=${rec === 'rec' ? 'stop' : 'rec'} fill=${true} size=${16} /> ${rec === 'rec' ? 'Parar' : 'Grabar'}</button>
    </div>
    ${rec === 'done' && url && html`<audio class="playback" controls src=${url}></audio>`}
    ${err && html`<p class="note warn">${err}</p>`}
  </div>`;
}
