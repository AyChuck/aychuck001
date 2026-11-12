// Prueba de micrófono: 2 s de silencio + 4 s cantando "aaa".
// Dice si el problema es del dispositivo, del lugar o del algoritmo, y da un reporte copiable.

import { html, useState, useEffect, useRef } from '../lib.js';
import { Icon, Bar } from './common.js';
import { diagnose, reportText } from '../coach/diagnose.js';
import { startMic, stopMic, onFrame, unlockAudio, micInfo, setNoiseFloor, getGate } from '../audio/engine.js';
import { toDb } from '../audio/features.js';
import { midiName } from '../music/notes.js';
import { patchProfile } from '../store.js';

const QUIET = 2.2;
const SING = 4.5;
const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

export function MicTest({ onBack }) {
  const [phase, setPhase] = useState('idle'); // idle | quiet | sing | done
  const [err, setErr] = useState(null);
  const [level, setLevel] = useState(0);
  const [left, setLeft] = useState(0);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const data = useRef({ quiet: [], sing: [] });

  useEffect(() => () => stopMic(), []);

  useEffect(() => {
    if (phase !== 'quiet' && phase !== 'sing') return undefined;
    const secs = phase === 'quiet' ? QUIET : SING;
    const started = performance.now();
    const off = onFrame((f) => {
      data.current[phase].push({ rms: f.rms, clarity: f.clarity, voiced: f.voiced, midi: f.midi, weight: f.weight, t: f.t });
      setLevel((l) => l * 0.7 + Math.min(1, Math.max(0, (f.db - toDb(f.gate)) / 30)) * 0.3);
    });
    const id = setInterval(async () => {
      const el = (performance.now() - started) / 1000;
      setLeft(Math.max(0, Math.ceil(secs - el)));
      if (el < secs) return;
      clearInterval(id);
      off();
      if (phase === 'quiet') {
        const noise = median(data.current.quiet.map((x) => x.rms));
        if (noise > 0) setNoiseFloor(noise);
        setPhase('sing');
      } else {
        finish();
      }
    }, 100);
    return () => {
      clearInterval(id);
      off();
    };
  }, [phase]);

  const finish = async () => {
    const q = data.current.quiet;
    const s = data.current.sing;
    const noiseRms = median(q.map((x) => x.rms));
    // La voz: la mitad más fuerte de lo que sonó mientras cantabas
    const loud = [...s].sort((a, b) => b.rms - a.rms).slice(0, Math.max(1, Math.floor(s.length / 2)));
    const voiceRms = median(loud.map((x) => x.rms));
    const voiced = s.filter((x) => x.voiced);
    const mids = voiced.map((x) => x.midi);
    const med = median(mids);
    // Desviación robusta del tono (ignora el arranque) y saltos de octava entre cuadros
    const tail = mids.slice(Math.floor(mids.length * 0.2));
    const dev = tail.map((m) => Math.abs(m - med) * 100).sort((a, b) => a - b);
    const pitchStd = dev.length ? dev[Math.floor(dev.length * 0.8)] : 0;
    let octaveJumps = 0;
    for (let i = 1; i < voiced.length; i++) {
      const d = Math.abs(voiced[i].midi - voiced[i - 1].midi);
      if (voiced[i].t - voiced[i - 1].t < 0.1 && d > 9 && d < 15) octaveJumps++;
    }
    const ws = voiced.map((x) => x.weight).filter((w) => w != null);
    const info = micInfo();
    const m = {
      ...info,
      noiseRms,
      voiceRms,
      peak: Math.max(0, ...s.map((x) => x.rms)) * Math.SQRT2,
      clarity: loud.length ? loud.reduce((a, x) => a + x.clarity, 0) / loud.length : 0,
      voicedFrac: loud.length ? loud.filter((x) => x.voiced).length / loud.length : 0,
      pitchStd,
      octaveJumps,
      note: voiced.length ? midiName(med) : null,
      weight: ws.length ? ws.reduce((a, b) => a + b, 0) / ws.length : null,
    };
    const d = diagnose(m);
    let persisted = null;
    try {
      persisted = await navigator.storage?.persisted?.();
    } catch {
      /* no disponible */
    }
    const text = reportText(m, d, {
      userAgent: navigator.userAgent,
      screen: `${window.innerWidth}x${window.innerHeight}`,
      standalone: window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true,
      persisted,
    });
    if (noiseRms > 0 && d.level !== 'bad') patchProfile({ gate: getGate() });
    stopMic();
    setResult({ d, text });
    setPhase('done');
  };

  const start = async () => {
    setErr(null);
    setResult(null);
    setCopied(false);
    data.current = { quiet: [], sing: [] };
    try {
      await unlockAudio();
      await startMic();
      setPhase('quiet');
    } catch (e) {
      setErr(e.message);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
    } catch {
      document.getElementById('mic-report')?.select();
    }
  };

  return html`<div class="screen">
    <header class="top">
      <button class="icon-btn" aria-label="Volver" onClick=${onBack}><${Icon} name="back" /></button>
    </header>
    <div class="eyebrow">Diagnóstico · 7 segundos</div>
    <h1 class="title">Probar micrófono</h1>

    ${phase === 'idle' &&
    html`<p class="lead">Primero guardas silencio 2 segundos. Luego cantas un "aaa" en una nota cómoda, a volumen normal, a un palmo del micrófono. Al final te digo si algo falla y de quién es la culpa: del dispositivo, del lugar o de la app.</p>
      <button class="btn primary big" onClick=${start}><${Icon} name="mic" /> Empezar prueba</button>`}
    ${err && html`<p class="note warn">${err}</p>`}

    ${(phase === 'quiet' || phase === 'sing') &&
    html`<section class="hero-card">
      <div class="eyebrow">${phase === 'quiet' ? 'Paso 1 de 2' : 'Paso 2 de 2'}</div>
      <h1>${phase === 'quiet' ? 'Silencio' : 'Canta "aaa"'}</h1>
      <p class="lead">${phase === 'quiet' ? 'No hagas ruido. Estoy midiendo el fondo.' : 'Una sola nota, sostenida, a volumen normal.'}</p>
      <${Bar} label="Lo que oye el micrófono" value=${level * 100} tone=${phase === 'quiet' ? 'ice' : 'ember'} right=${`${left} s`} />
    </section>`}

    ${phase === 'done' &&
    result &&
    html`<section class="panel">
        <div class="panel-head"><h2>${{ ok: 'Todo bien', warn: 'Funciona, con detalles', bad: 'Hay un problema' }[result.d.level]}</h2></div>
        <p>${result.d.summary}</p>
        ${result.d.findings.map((x) => html`<div class=${`tip ${x.level === 'ok' ? 'good' : ''}`}><b>${x.title}</b><p>${x.body}</p></div>`)}
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Reporte</h2></div>
        <p class="muted small">Si algo sigue fallando, copia esto y pégalo en el chat. Solo trae números técnicos, nada de tu voz.</p>
        <label class="sr" for="mic-report">Reporte del micrófono</label>
        <textarea id="mic-report" readonly rows="9" onFocus=${(e) => e.target.select()}>${result.text}</textarea>
        <div class="row">
          <button class="btn primary" onClick=${copy}>${copied ? 'Copiado' : 'Copiar reporte'}</button>
          <button class="btn ghost" onClick=${start}>Repetir prueba</button>
        </div>
      </section>`}
  </div>`;
}
