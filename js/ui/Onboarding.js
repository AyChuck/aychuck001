// Bienvenida: 6 pantallas cortas, una decisión por pantalla.

import { html, useState, useEffect, useRef } from '../lib.js';
import { Icon, Choice, Canvas } from './common.js';
import { drawPitch } from './rolls.js';
import { startMic, onFrame, calibrate, audioCtx, unlockAudio } from '../audio/engine.js';
import { midiName, voiceType, rangeLabel } from '../music/notes.js';
import { toDb } from '../audio/features.js';
import { getState, setState, patchProfile, patchSettings } from '../store.js';

const PRESETS = {
  grave: { low: 41, high: 62 },
  media: { low: 45, high: 66 },
  aguda: { low: 53, high: 74 },
};

/** Prueba de rango: desliza la voz de lo más grave a lo más agudo. */
export function RangeTest({ onDone, onSkip }) {
  const [phase, setPhase] = useState('idle'); // idle | run | done
  const [err, setErr] = useState(null);
  const [left, setLeft] = useState(14);
  const [found, setFound] = useState(null);
  const frames = useRef([]);
  const t0 = useRef(0);
  const view = useRef({ lo: 40, hi: 72 });

  useEffect(() => {
    if (phase !== 'run') return undefined;
    frames.current = [];
    t0.current = audioCtx().currentTime;
    const off = onFrame((f) => frames.current.push({ ...f, t: f.t - t0.current }));
    const id = setInterval(() => {
      const el = audioCtx().currentTime - t0.current;
      setLeft(Math.max(0, Math.ceil(14 - el)));
      if (el >= 14) {
        clearInterval(id);
        off();
        // Semitonos sostenidos al menos ~0.1 s con tono claro (por tiempo, no por cuadros:
        // cada dispositivo analiza a distinta velocidad)
        const hist = new Map();
        const dbs = [];
        let prevT = null;
        for (const f of frames.current) {
          const dt = prevT == null ? 0.016 : Math.min(0.1, f.t - prevT);
          prevT = f.t;
          if (!f.voiced || f.clarity < 0.8) continue;
          const m = Math.round(f.midi);
          hist.set(m, (hist.get(m) ?? 0) + dt);
          dbs.push(f.db);
        }
        const ok = [...hist.entries()].filter(([, secs]) => secs >= 0.1).map(([m]) => m).sort((a, b) => a - b);
        if (ok.length < 5 || ok[ok.length - 1] - ok[0] < 7) {
          setFound(null);
          setErr('No alcancé a escuchar suficiente. Acércate al micrófono y desliza la voz despacio, como sirena.');
          setPhase('idle');
          return;
        }
        const refDb = dbs.reduce((a, b) => a + b, 0) / dbs.length;
        setFound({ lowest: ok[0], highest: ok[ok.length - 1], refDb });
        setPhase('done');
      }
    }, 120);
    return () => {
      clearInterval(id);
      off();
    };
  }, [phase]);

  const start = async () => {
    setErr(null);
    try {
      await startMic();
      setPhase('run');
    } catch (e) {
      setErr(e.message);
    }
  };

  const draw = (g, w, h) => {
    const fs = frames.current;
    const now = audioCtx().currentTime - t0.current;
    const voiced = fs.filter((f) => f.voiced);
    if (voiced.length) {
      const lo = Math.min(...voiced.map((f) => f.midi)) - 3;
      const hi = Math.max(...voiced.map((f) => f.midi)) + 3;
      view.current = { lo: Math.min(view.current.lo, lo), hi: Math.max(view.current.hi, hi) };
    }
    drawPitch(g, w, h, { plan: null, frames: fs, now, ...view.current });
  };

  if (phase === 'done' && found) {
    // Rango de trabajo: un poco adentro de los extremos, para que nada cueste de entrada
    const low = found.lowest + 1;
    const high = Math.max(low + 12, found.highest - 2);
    return html`<div class="ob-body">
      <div class="eyebrow">Tu voz hoy</div>
      <h1>${midiName(found.lowest)} a ${midiName(found.highest)}</h1>
      <p class="lead">${rangeLabel(found.lowest, found.highest)}. Se parece a un registro de <b>${voiceType(low, high).toLowerCase()}</b>.</p>
      <p class="muted">Los ejercicios se van a mover dentro de ${midiName(low)} y ${midiName(high)}, donde no tienes que forzar. El rango crece con la práctica y lo voy a ir ampliando.</p>
      <div class="row">
        <button class="btn ghost" onClick=${() => setPhase('idle')}>Repetir</button>
        <button class="btn primary" onClick=${() => onDone({ low, high, refDb: found.refDb, lowest: found.lowest, highest: found.highest })}>Usar este rango</button>
      </div>
    </div>`;
  }

  return html`<div class="ob-body">
    <div class="eyebrow">Prueba de rango · 14 segundos</div>
    <h1>Desliza tu voz</h1>
    <p class="lead">Con un "aaa" relajado, baja hasta tu nota más grave y sube como sirena hasta la más aguda que salga <b>sin forzar</b>. Repite si te sobra tiempo.</p>
    ${phase === 'run' &&
    html`<div class="range-run">
      <${Canvas} draw=${draw} class="pitch" />
      <div class="countdown num">${left}</div>
    </div>`}
    ${err && html`<p class="note warn">${err}</p>`}
    ${phase === 'idle' &&
    html`<button class="btn primary big" onClick=${start}><${Icon} name="mic" /> Empezar prueba</button>
      ${onSkip && html`<button class="btn ghost small" onClick=${onSkip}>Saltar por ahora</button>`}`}
  </div>`;
}

export function Onboarding() {
  const [i, setI] = useState(0);
  const [goal, setGoal] = useState('both');
  const [exp, setExp] = useState('new');
  const [hp, setHp] = useState(null);
  const [mic, setMic] = useState('idle'); // idle | calibrating | ok
  const [micErr, setMicErr] = useState(null);
  const [level, setLevel] = useState(0);
  const [skipRange, setSkipRange] = useState(false);

  const next = () => setI((x) => x + 1);

  useEffect(() => {
    if (mic !== 'ok') return undefined;
    // Nivel relativo al ruido de fondo: así la barra se mueve aunque el micrófono entregue poco
    return onFrame((f) => setLevel((l) => l * 0.8 + Math.min(1, Math.max(0, (f.db - toDb(f.gate)) / 30)) * 0.2));
  }, [mic]);

  const enableMic = async () => {
    setMicErr(null);
    try {
      await unlockAudio();
      await startMic();
      setMic('calibrating');
      const gate = await calibrate(1500);
      patchProfile({ gate });
      setMic('ok');
    } catch (e) {
      setMicErr(e.message);
      setMic('idle');
    }
  };

  const finish = () => {
    patchSettings({ headphones: !!hp, strict: exp === 'adv' ? 1 : 0 });
    patchProfile({ goal, exp });
    setState((s) => ({ ...s, onboarded: true }));
  };

  const screens = [
    // 0. Bienvenida
    html`<div class="ob-body hero">
      <div class="wordmark">CATARSIS</div>
      <h1>Aprende a cantar metalcore.</h1>
      <p class="lead">Limpios que llegan arriba y screams que no lastiman. Unos minutos al día, una cosa a la vez, con corrección en vivo de lo que haces con tu voz.</p>
      <ul class="ticks">
        <li><${Icon} name="check" size=${18} /> Tú solo aprietas "Empezar". La app decide qué toca.</li>
        <li><${Icon} name="check" size=${18} /> Escucha tu voz y te dice qué corregir.</li>
        <li><${Icon} name="check" size=${18} /> Lo aplicas en canciones de tus bandas, con YouTube Music.</li>
        <li><${Icon} name="check" size=${18} /> Avanzas por semanas: lo aprendido vuelve como repaso hasta que se queda.</li>
      </ul>
      <button class="btn primary big" onClick=${next}>Empezar</button>
    </div>`,
    // 1. Objetivo
    html`<div class="ob-body">
      <div class="eyebrow">1 de 5</div>
      <h1>¿Qué quieres dominar?</h1>
      <${Choice} value=${goal} onPick=${setGoal} options=${[
        { id: 'both', title: 'Las dos voces', sub: 'Coros limpios y guturales, como en tus bandas' },
        { id: 'clean', title: 'Solo voz limpia', sub: 'Afinación, rango, potencia y estilo' },
        { id: 'harsh', title: 'Sobre todo guturales', sub: 'Igual verás lo básico de aire y afinación: lo necesitas' },
      ]} />
      <button class="btn primary big" onClick=${next}>Seguir</button>
    </div>`,
    // 2. Experiencia
    html`<div class="ob-body">
      <div class="eyebrow">2 de 5</div>
      <h1>¿Dónde estás hoy?</h1>
      <${Choice} value=${exp} onPick=${setExp} options=${[
        { id: 'new', title: 'Nunca he cantado en serio', sub: 'Empezamos suave, con margen amplio' },
        { id: 'some', title: 'Canto por mi cuenta', sub: 'En el carro, en la regadera, con mis discos' },
        { id: 'adv', title: 'Ya tengo algo de técnica', sub: 'Afinación más exigente desde el inicio' },
      ]} />
      <button class="btn primary big" onClick=${next}>Seguir</button>
    </div>`,
    // 3. Audífonos
    html`<div class="ob-body">
      <div class="eyebrow">3 de 5</div>
      <h1>¿Tienes audífonos puestos?</h1>
      <p class="lead">Con audífonos, la guía y la base suenan mientras cantas. Sin ellos funciona igual: escuchas primero y cantas después.</p>
      <${Choice} value=${hp === null ? '' : hp ? 'y' : 'n'} onPick=${(v) => setHp(v === 'y')} options=${[
        { id: 'y', title: 'Sí, con audífonos', sub: 'De cable es lo mejor. Los bluetooth meten retraso' },
        { id: 'n', title: 'No, con la bocina', sub: 'Se puede cambiar después en Ajustes' },
      ]} />
      <button class="btn primary big" disabled=${hp === null} onClick=${next}>Seguir</button>
    </div>`,
    // 4. Micrófono
    html`<div class="ob-body">
      <div class="eyebrow">4 de 5</div>
      <h1>Activa el micrófono</h1>
      <p class="lead">Tu voz se analiza aquí mismo, en tu dispositivo. No se graba ni se envía a ningún lado.</p>
      ${mic === 'idle' && html`<button class="btn primary big" onClick=${enableMic}><${Icon} name="mic" /> Activar micrófono</button>`}
      ${mic === 'calibrating' && html`<div class="note">Guarda silencio un segundo: estoy midiendo el ruido de tu cuarto.</div>`}
      ${mic === 'ok' &&
      html`<div class="mic-test">
          <div class="bar tall"><i class="ice" style=${`width:${Math.round(level * 100)}%`}></i></div>
          <p class="muted">Di algo. Si la barra se mueve, estamos listos.</p>
        </div>
        <button class="btn primary big" onClick=${next}>Se mueve, seguir</button>`}
      ${micErr && html`<p class="note warn">${micErr}</p>`}
    </div>`,
    // 5. Rango
    skipRange
      ? html`<div class="ob-body">
          <div class="eyebrow">5 de 5</div>
          <h1>¿Cómo es tu voz al hablar?</h1>
          <p class="lead">Con esto elijo un rango de inicio. Puedes hacer la prueba después en Ajustes.</p>
          <${Choice} value="" onPick=${(v) => {
            patchProfile({ ...PRESETS[v], tested: false });
            next();
          }} options=${[
            { id: 'grave', title: 'Grave', sub: 'Voz profunda' },
            { id: 'media', title: 'Media', sub: 'Ni grave ni aguda' },
            { id: 'aguda', title: 'Aguda', sub: 'Voz ligera o alta' },
          ]} />
        </div>`
      : html`<${RangeTest}
          onSkip=${() => setSkipRange(true)}
          onDone=${(r) => {
            patchProfile({ low: r.low, high: r.high, firstLow: r.low, firstHigh: r.high, refDb: r.refDb, tested: true });
            next();
          }} />`,
    // 6. Reglas
    html`<div class="ob-body">
      <div class="eyebrow">Antes de gritar</div>
      <h1>Tres reglas de la casa</h1>
      <ol class="rules">
        <li><b>Si duele, paras.</b> Cosquilleo arriba está bien. Ardor, picor o tos, no.</li>
        <li><b>Calienta siempre.</b> Cada sesión empieza con dos minutos suaves. No se saltan.</li>
        <li><b>Poco y diario.</b> Siete minutos al día le ganan a una hora el domingo. Y agua, mucha.</li>
      </ol>
      <p class="muted small">Esta app te guía y te corrige con lo que oye el micrófono, pero no ve tu garganta. Si tienes dolor o ronquera que no se quita, consulta a un médico o a un maestro de canto.</p>
      <button class="btn primary big" onClick=${finish}>Entendido, vamos</button>
    </div>`,
  ];

  return html`<div class="onboarding">
    ${i > 0 && html`<button class="icon-btn ob-back" aria-label="Atrás" onClick=${() => setI(i - 1)}><${Icon} name="back" /></button>`}
    ${screens[i]}
  </div>`;
}
