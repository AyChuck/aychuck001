// Reproductor de sesión: lleva a la persona paso a paso, sin decisiones.
// tarjeta → ejercicio (intro → toma en vivo → resultado con corrección) → siguiente.

import { html, useState, useEffect, useRef, useMemo } from '../lib.js';
import { Icon, Stars, Canvas, Bar } from './common.js';
import { drawPitch, drawEnergy } from './rolls.js';
import { buildPlan } from '../coach/plan.js';
import { scoreTake } from '../coach/scoring.js';
import { PASS, harshBlocked, level, streak, gradeOf, isDue, GRADE_NAMES, GRADE_NEED, MAX_GRADE } from '../coach/progress.js';
import { isScored, isHarsh, TRACKS, lessonById } from '../content/curriculum.js';
import { startMic, onFrame, audioCtx, setGate, setGritSensitivity, unlockAudio, getStream } from '../audio/engine.js';
import { createBus, sfx } from '../audio/synth.js';
import { toDb } from '../audio/features.js';
import { midiName } from '../music/notes.js';
import { useStore, getState, recordStep, setThroat } from '../store.js';

const LAT = 0.05; // retraso típico entre que suenas y que se analiza

function scheduleAudio(bus, plan, t0, settings) {
  const hp = settings.headphones;
  if (plan.view === 'pitch') {
    for (const n of plan.notes) {
      if (n.seg === 'listen') bus.tone(n.midi, t0 + n.t0, n.t1 - n.t0);
      else if (hp && settings.guide) bus.tone(n.midi, t0 + n.t0, n.t1 - n.t0, 0.06);
    }
    for (const p of plan.paths) {
      bus.tone(p.pts[0][1], t0 + p.t0 - 0.9, 0.5, 0.16);
      if (hp && settings.guide) bus.glide(p.pts.map(([t, m]) => [t0 + t, m]), 0.05);
    }
    if (plan.backing) {
      for (const s of plan.segs) {
        if (s.type === 'sing' && !hp) continue; // sin audífonos, la base se colaría al micrófono
        if (s.t1 - s.t0 < 1.5) continue;
        if (plan.backing === 'chug') bus.groove(plan.root, t0 + s.t0, t0 + s.t1, plan.bpm);
        else bus.pad(plan.root, t0 + s.t0 - 0.1, t0 + s.t1 + 0.2, plan.backing);
      }
    }
  } else if (plan.view === 'energy') {
    if (plan.rhythm) {
      for (const b of plan.beats) if (b.seg === 'listen' || hp) bus.click(t0 + b.t, b.accent);
      for (const h of plan.hits) if (h.seg === 'listen') bus.blip(t0 + h.t);
    } else {
      for (const w of plan.windows) if (w.expect !== 'rest') bus.click(t0 + w.t0, true);
    }
  }
}

function useWakeLock() {
  useEffect(() => {
    let lock = null;
    navigator.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {});
    return () => lock?.release().catch(() => {});
  }, []);
}

// ───────────────────────── Toma en vivo ─────────────────────────

function Take({ step, plan, onDone, onAbort, onAudio }) {
  const st = getState();
  const frames = useRef([]);
  const t0 = useRef(null);
  const [err, setErr] = useState(null);
  const [hud, setHud] = useState({ label: 'Preparando micrófono', sub: '' });

  useEffect(() => {
    let bus = null;
    let off = null;
    let timer = 0;
    let dead = false;
    let finished = false;
    let rec = null;

    const finish = () => {
      if (finished || dead) return;
      finished = true;
      clearInterval(timer);
      off?.();
      bus?.stop();
      if (rec?.state === 'recording') rec.stop();
      const res = scoreTake(plan, frames.current, { refDb: st.profile.refDb });
      res.harshSecs = plan.view === 'energy' ? frames.current.filter((f) => f.kind === 'harsh').length / 60 : 0;
      onDone(res);
    };

    (async () => {
      try {
        await startMic();
      } catch (e) {
        if (!dead) setErr(e.message);
        return;
      }
      if (dead) return;
      setGate(st.profile.gate);
      setGritSensitivity(st.settings.grit ?? 1);
      const c = audioCtx();
      // Graba la toma (solo en memoria) para que puedas escucharte después.
      if (window.MediaRecorder) {
        try {
          const chunks = [];
          rec = new MediaRecorder(getStream());
          rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
          rec.onstop = () => finished && chunks.length && onAudio(URL.createObjectURL(new Blob(chunks, { type: rec.mimeType })));
          rec.start();
        } catch {
          rec = null;
        }
      }
      t0.current = c.currentTime + 0.3;
      bus = createBus();
      scheduleAudio(bus, plan, t0.current, st.settings);
      window.__take = { plan, t0: t0.current }; // gancho para las pruebas automáticas (tools/e2e.mjs)
      off = onFrame((f) => {
        const t = f.t - t0.current - LAT;
        if (t < -0.2 || t > plan.dur + 0.3) return;
        frames.current.push({ t, midi: f.midi, voiced: f.voiced, clarity: f.clarity, rms: f.rms, db: f.db, centroid: f.centroid, kind: f.kind, grit: f.grit });
      });

      timer = setInterval(() => {
        const now = c.currentTime - t0.current;
        if (now >= plan.dur) return finish();
        const fs = frames.current;
        const last = fs[fs.length - 1];

        if (plan.view === 'pitch') {
          const seg = plan.segs.find((s) => now >= s.t0 - 0.1 && now < s.t1);
          const next = plan.segs.find((s) => s.t0 > now);
          const note = plan.notes.find((n) => n.seg === 'sing' && now >= n.t0 && now < n.t1);
          let sub = '';
          let tone = '';
          if (seg?.type === 'sing' && last?.voiced && now - last.t < 0.2) {
            if (note) {
              const e = (last.midi - note.midi) * 100;
              if (Math.abs(e) <= plan.tol) [sub, tone] = ['Ahí', 'ok'];
              else if (e < 0) [sub, tone] = ['Sube', 'warn'];
              else [sub, tone] = ['Baja', 'warn'];
            } else sub = midiName(last.midi);
          }
          setHud({
            label: seg ? (seg.type === 'listen' ? 'Escucha' : 'Tu turno') : next ? (next.type === 'listen' ? 'Escucha' : 'Respira') : 'Listo',
            kind: seg?.type ?? 'gap',
            sub,
            tone,
            syl: step.syl,
          });
        } else {
          const win = plan.windows.find((x) => now >= x.t0 && now < x.t1);
          const left = win ? Math.ceil(win.t1 - now) : 0;
          const recent = fs.slice(-12);
          const grit = recent.length ? recent.reduce((a, f) => a + (f.kind === 'harsh' ? f.grit : 0), 0) / recent.length : 0;
          const db = recent.length ? recent.reduce((a, f) => a + f.db, 0) / recent.length : -60;
          let sub = win && !plan.endOnSilence && !plan.rhythm ? `${left} s` : '';
          if (plan.endOnSilence && win?.expect === 'hiss') {
            // El ejercicio de aire termina cuando te quedas sin aire
            let run = 0;
            let lastSound = null;
            let start = null;
            for (const f of fs) {
              if (f.t < win.t0) continue;
              if (f.kind !== 'silence') {
                if (lastSound === null || f.t - lastSound > 0.3) start = f.t;
                lastSound = f.t;
                run = Math.max(run, f.t - start);
              }
            }
            sub = `${run.toFixed(1)} s`;
            if (lastSound !== null && run >= 1 && now - lastSound > 1.2) return finish();
            if (lastSound === null && now - win.t0 > 6) return finish();
          }
          setHud({ label: win?.label ?? '', kind: win?.expect ?? 'rest', sub, grit, db });
        }
      }, 90);
    })();

    return () => {
      dead = true;
      clearInterval(timer);
      off?.();
      bus?.stop();
      if (rec?.state === 'recording') rec.stop();
    };
  }, []);

  if (err) {
    return html`<div class="take-error">
      <${Icon} name="mic" size=${40} />
      <h2>Necesito el micrófono</h2>
      <p>${err}</p>
      <button class="btn primary" onClick=${onAbort}>Volver</button>
    </div>`;
  }

  const gateDb = toDb(st.profile.gate);
  const draw = (g, w, h) => {
    const now = t0.current == null ? -1 : audioCtx().currentTime - t0.current;
    if (plan.view === 'pitch') drawPitch(g, w, h, { plan, frames: frames.current, now });
    else drawEnergy(g, w, h, { plan, frames: frames.current, now, refDb: st.profile.refDb, gateDb });
  };

  return html`<div class="take">
    <div class=${`hud ${hud.kind ?? ''}`}>
      <div class="hud-label">${hud.label}</div>
      <div class=${`hud-sub ${hud.tone ?? ''}`}>${hud.sub || (hud.kind === 'sing' && hud.syl ? `"${hud.syl}"` : '')}</div>
    </div>
    <${Canvas} draw=${draw} class=${plan.view} />
    ${plan.view === 'energy' &&
    !plan.rhythm &&
    !plan.endOnSilence &&
    html`<div class="meters">
      <${Bar} label="Distorsión" value=${(hud.grit ?? 0) * 100} tone="ember" right=${`${Math.round((hud.grit ?? 0) * 100)} %`} />
      <${Bar} label="Volumen" value=${(((hud.db ?? -60) - gateDb) / (-3 - gateDb)) * 100} tone="ice" right=" " />
    </div>`}
    <button class="btn ghost small" onClick=${onAbort}>Cancelar toma</button>
  </div>`;
}

// ───────────────────────── Pasos sin micrófono ─────────────────────────

function CardStep({ step, onNext, listen }) {
  return html`<div class="cardstep">
    <div class="card-art"><${Icon} name=${step.art ?? 'star'} size=${56} /></div>
    <h2>${step.title}</h2>
    <p>${step.body}</p>
    ${listen && html`<p class="listen-hint"><b>Para el oído.</b> ${listen}</p>`}
    <button class="btn primary big" onClick=${onNext}>Entendido</button>
  </div>`;
}

function PacerStep({ step, plan, onNext }) {
  const [i, setI] = useState(-1);
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (i < 0) return undefined;
    if (i >= plan.phases.length) {
      onNext();
      return undefined;
    }
    const ph = plan.phases[i];
    setLeft(ph.secs);
    const started = performance.now();
    const id = setInterval(() => {
      const rest = ph.secs - (performance.now() - started) / 1000;
      if (rest <= 0) {
        clearInterval(id);
        setI((x) => x + 1);
      } else setLeft(Math.ceil(rest));
    }, 100);
    return () => clearInterval(id);
  }, [i]);

  const ph = plan.phases[i];
  if (i < 0) {
    return html`<div class="intro">
      <h2>${step.title}</h2>
      <p class="cue">${step.cue}</p>
      <p class="muted">Sin micrófono. Solo sigue el círculo.</p>
      <button class="btn primary big" onClick=${() => setI(0)}>Empezar</button>
    </div>`;
  }
  return html`<div class="pacer">
    <div class=${`pacer-ring ${ph?.kind ?? ''}`} style=${`--secs:${ph?.secs ?? 1}s`} key=${i}>
      <span class="num">${left}</span>
    </div>
    <div class="pacer-label">${ph?.label ?? ''}</div>
    <div class="muted">${Math.min(plan.phases.length, i + 1)} de ${plan.phases.length}</div>
  </div>`;
}

// ───────────────────────── Intro y resultado ─────────────────────────

function Intro({ step, ease, grade, review, onStart, settings }) {
  const track = TRACKS[step.skill];
  const kindNote =
    step.kind === 'rhythm' && !settings.headphones
      ? 'Sin audífonos, en tu turno el pulso es solo visual.'
      : step.backing && !settings.headphones
        ? 'Con audífonos, la base suena también mientras cantas.'
        : null;
  return html`<div class="intro">
    ${track && html`<div class="eyebrow"><${Icon} name=${track.art} size=${16} /> ${track.name}</div>`}
    <h2>${step.title}</h2>
    <p class="cue">${step.cue}</p>
    ${step.how && html`<ul class="how">${step.how.map((x) => html`<li>${x}</li>`)}</ul>`}
    ${!step.nograde &&
    grade > 0 &&
    html`<div class="grade-line">
      <${GradePips} grade=${grade} />
      <span>${review ? 'Repaso. ' : ''}${grade >= MAX_GRADE ? 'Dominado: hoy solo lo mantienes.' : `Grado ${grade}, ${GRADE_NAMES[grade]}. Hoy es más exigente; con ${GRADE_NEED[grade]}+ subes a ${GRADE_NAMES[grade + 1]}.`}</span>
    </div>`}
    ${ease > 0 && html`<p class="note">Modo fácil activo: más margen y un poco más lento.</p>`}
    ${kindNote && html`<p class="muted small">${kindNote}</p>`}
    <button class="btn primary big" onClick=${onStart}><${Icon} name="mic" /> Empezar</button>
  </div>`;
}

export function GradePips({ grade }) {
  return html`<span class="pips" aria-label=${`Grado ${grade} de ${MAX_GRADE}`}>${[1, 2, 3, 4, 5].map((i) => html`<i class=${i <= grade ? 'on' : ''}></i>`)}</span>`;
}

function Result({ step, result, outcome, onRetry, onNext, last, audio }) {
  const passed = result.score >= PASS;
  useEffect(() => {
    if (getState().settings.sfx) sfx(result.stars === 3 ? 'star' : passed ? 'pass' : 'fail');
  }, []);
  const ev = outcome.events;
  return html`<div class="result">
    <div class=${`score-ring ${passed ? 'pass' : 'fail'}`} style=${`--p:${result.score}`}>
      <span class="num">${result.score}</span>
    </div>
    <${Stars} n=${result.stars} size=${26} />
    <div class="xp-chip">+${outcome.gained} XP</div>

    <div class="parts">
      ${result.parts.map((p) => html`<${Bar} label=${p.label} value=${p.value} tone=${p.value >= 75 ? 'ok' : p.value >= 50 ? 'warn' : 'bad'} />`)}
    </div>

    ${result.tips.map(
      (t) => html`<div class=${`tip ${t.code === 'great' ? 'good' : ''}`}>
        <b>${t.title}</b>
        <p>${t.body}</p>
      </div>`
    )}

    ${audio && html`<div class="replay"><span>Escúchate. Es la corrección más honesta que hay.</span><audio controls src=${audio}></audio></div>`}

    ${ev.map((e) => {
      if (e.type === 'easier') return html`<div class="event">Activé el modo fácil para este ejercicio. Sin presión.</div>`;
      if (e.type === 'grade') return html`<div class="event hot"><${GradePips} grade=${e.grade} /> Grado ${e.grade}: ${e.name}. Vuelve en ${e.days} ${e.days === 1 ? 'día' : 'días'}, un poco más difícil.</div>`;
      if (e.type === 'gradeWait') return html`<div class="event">Ya subiste de grado hoy en este ejercicio. El siguiente (${e.next}) se gana otro día: así se queda grabado.</div>`;
      if (e.type === 'gradeShort') return html`<div class="event">Aprobado. Para subir a ${e.next} necesitas ${e.need}+. Vuelve mañana.</div>`;
      if (e.type === 'stage') return html`<div class="event hot">Etapa nueva abierta: ${e.stage.name}</div>`;
      if (e.type === 'level') return html`<div class="event hot">Nivel ${e.lvl}: ${e.rank}</div>`;
      if (e.type === 'ach') return html`<div class="event hot">Logro: ${e.ach.name}</div>`;
      if (e.type === 'lesson') return html`<div class="event hot">Lección completa: ${e.lesson.title}</div>`;
      if (e.type === 'range') return html`<div class="event hot">Tu rango creció: ahora llegas a ${midiName(e.high)}</div>`;
      return null;
    })}

    <div class="row">
      <button class=${`btn ${passed ? 'ghost' : 'primary'}`} onClick=${onRetry}><${Icon} name="redo" size=${18} /> Otra vez</button>
      <button class=${`btn ${passed ? 'primary' : 'ghost'}`} onClick=${onNext}>${last ? 'Terminar' : passed ? 'Siguiente' : 'Seguir'} <${Icon} name="chev" size=${18} /></button>
    </div>
  </div>`;
}

function ThroatCheck({ onPick }) {
  return html`<div class="intro throat">
    <div class="eyebrow"><${Icon} name="drop" size=${16} /> Revisión rápida</div>
    <h2>¿Cómo sientes la garganta?</h2>
    <p class="muted">Sé honesto: esto decide si seguimos con guturales hoy.</p>
    <div class="choices">
      <button class="choice" onClick=${() => onPick('ok')}><b>Bien</b><small>Normal, o un cosquilleo arriba en el paladar</small></button>
      <button class="choice" onClick=${() => onPick('tired')}><b>Cansada</b><small>Algo ronca o seca</small></button>
      <button class="choice" onClick=${() => onPick('hurt')}><b>Me duele o me arde</b><small>Raspa, pica o tosí</small></button>
    </div>
  </div>`;
}

function ThroatAdvice({ status, onNext }) {
  const hurt = status === 'hurt';
  return html`<div class="cardstep">
    <div class="card-art"><${Icon} name="drop" size=${56} /></div>
    <h2>${hurt ? 'Paramos los guturales por hoy' : 'Pausa de guturales'}</h2>
    <p>
      ${hurt
        ? 'El dolor es la señal de que algo se hizo con fuerza y no con técnica. Bloqueé los guturales 24 horas. Toma agua, no susurres ni carraspees, y mañana volvemos al fry suave con menos aire. Si el dolor o la ronquera duran más de unos días, consulta a un médico.'
        : 'Voz cansada es voz que necesita agua y descanso. Pausé los guturales unas horas; lo demás sigue normal.'}
    </p>
    <button class="btn primary big" onClick=${onNext}>Entendido</button>
  </div>`;
}

function Summary({ log, startXp, onExit, onMore, onSong }) {
  const s = useStore();
  const song = s.focusSong ? s.songs[s.focusSong] : null;
  const gained = s.xp - startXp;
  const lv = level(s.xp);
  const scored = log.filter((x) => x.result);
  const avg = scored.length ? Math.round(scored.reduce((a, x) => a + x.result.score, 0) / scored.length) : null;
  useEffect(() => {
    if (s.settings.sfx && log.length) sfx('level');
  }, []);
  return html`<div class="summary">
    <div class="eyebrow">Sesión terminada</div>
    <h1>${log.length ? 'Hecho.' : 'Nos vemos pronto'}</h1>
    <div class="stat-row">
      <div class="stat"><span class="num">+${gained}</span><small>XP</small></div>
      <div class="stat"><span class="num">${streak(s)}</span><small>días de racha</small></div>
      ${avg != null && html`<div class="stat"><span class="num">${avg}</span><small>promedio</small></div>`}
    </div>
    <${Bar} label=${`Nivel ${lv.lvl} · ${lv.rank}`} value=${(lv.into / lv.need) * 100} tone="ember" right=${`${lv.into}/${lv.need}`} />
    <ul class="log">
      ${scored.map((x) => html`<li><span>${x.step.title}</span><${Stars} n=${x.result.stars} /></li>`)}
    </ul>
    ${log.length > 0 &&
    html`<button class="tile wide" onClick=${onSong}>
      <${Icon} name="play" />
      <b>${song ? `Ahora aplícalo: ${song.title}` : 'Ahora aplícalo en una canción'}</b>
      <small>${song ? `${song.artist} · una toma de tu canción en foco` : 'Elige una de tus bandas y canta encima'}</small>
    </button>`}
    <div class="row">
      <button class="btn ghost" onClick=${onMore}>Repasar más</button>
      <button class="btn primary" onClick=${onExit}>Listo por hoy</button>
    </div>
  </div>`;
}

// ───────────────────────── Orquestador ─────────────────────────

export function Player({ session, onExit, onMore, onSong }) {
  useWakeLock();
  const s = useStore();
  const [steps, setSteps] = useState(session.steps);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState('intro'); // intro | take | result | throat | advice | done
  const [result, setResult] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const [advice, setAdvice] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [audio, setAudio] = useState(null);
  const log = useRef([]);

  const dropAudio = () => {
    setAudio((u) => {
      if (u) URL.revokeObjectURL(u);
      return null;
    });
  };
  useEffect(() => dropAudio, []);
  const startXp = useRef(s.xp);
  const didHarsh = useRef(false);

  const step = steps[idx];
  const ease = step ? (s.ex[step.id]?.ease ?? 0) : 0;
  // El grado (dificultad) queda fijo mientras estás en el paso, aunque subas de grado al aprobar.
  const entry = useRef({});
  if (step && !entry.current[step.id]) {
    entry.current[step.id] = { grade: step.nograde ? 0 : gradeOf(s.ex[step.id]), review: isScored(step) && isDue(s, step) };
  }
  const { grade, review } = step ? entry.current[step.id] : { grade: 0, review: false };
  const plan = useMemo(
    () => (step ? buildPlan(step, s.profile, { ease, grade, strict: s.settings.strict }) : null),
    [step?.id, attempt, ease, grade, s.profile.low, s.profile.high, s.settings.strict]
  );

  const goNext = (from = idx, list = steps) => {
    const cur = list[from];
    const nxt = list[from + 1];
    // Al salir de un bloque de guturales que sí hiciste, revisa la garganta
    if (cur && isHarsh(cur) && (!nxt || !isHarsh(nxt)) && didHarsh.current) {
      didHarsh.current = false;
      setPhase('throat');
      return;
    }
    if (from + 1 >= list.length) setPhase('done');
    else {
      setIdx(from + 1);
      setPhase('intro');
      setResult(null);
    }
  };

  const finishSimple = () => {
    recordStep(step.id, { score: 100, stars: 0 });
    log.current.push({ step });
    goNext();
  };

  const onTakeDone = (res) => {
    const out = recordStep(step.id, res);
    if (isHarsh(step)) didHarsh.current = true;
    log.current.push({ step, result: res });
    setResult(res);
    setOutcome(out);
    setPhase('result');
  };

  const onThroat = (status) => {
    setThroat(status);
    if (status === 'ok') return goNext();
    // Quita los guturales que quedaban en la sesión
    const rest = steps.filter((x, i) => i <= idx || !isHarsh(x));
    setSteps(rest);
    setAdvice(status);
    setPhase('advice');
  };

  if (phase === 'done' || !step) {
    return html`<div class="player"><${Summary} log=${log.current} startXp=${startXp.current} onExit=${onExit} onMore=${onMore} onSong=${onSong} /></div>`;
  }

  const blocked = isHarsh(step) && harshBlocked(s) && phase === 'intro';
  const lesson = step.lesson ? lessonById(step.lesson) : null;

  let body;
  if (phase === 'throat') body = html`<${ThroatCheck} onPick=${onThroat} />`;
  else if (phase === 'advice') body = html`<${ThroatAdvice} status=${advice} onNext=${() => goNext(idx, steps)} />`;
  else if (blocked) {
    body = html`<div class="cardstep">
      <div class="card-art"><${Icon} name="drop" size=${56} /></div>
      <h2>Guturales en pausa</h2>
      <p>${harshBlocked(s) === 'budget' ? 'Ya hiciste tus 4 minutos de guturales de hoy. Más que eso no te hace mejorar más rápido: te lastima.' : 'Tu garganta está descansando. Este ejercicio vuelve cuando pase la pausa.'}</p>
      <button class="btn primary big" onClick=${() => goNext()}>Saltar</button>
    </div>`;
  } else if (step.kind === 'card') body = html`<${CardStep} key=${step.id} step=${step} onNext=${finishSimple} listen=${lesson && lesson.steps[0].id === step.id ? lesson.listen : null} />`;
  else if (step.kind === 'pacer') body = html`<${PacerStep} key=${step.id} step=${step} plan=${plan} onNext=${finishSimple} />`;
  else if (phase === 'intro') {
    body = html`<${Intro} step=${step} ease=${ease} grade=${grade} review=${review} settings=${s.settings} onStart=${async () => {
      await unlockAudio();
      dropAudio();
      setPhase('take');
    }} />`;
  } else if (phase === 'take') {
    body = html`<${Take} key=${`${step.id}-${attempt}`} step=${step} plan=${plan} onDone=${onTakeDone} onAudio=${setAudio} onAbort=${() => setPhase('intro')} />`;
  } else {
    body = html`<${Result} key=${`${step.id}-${attempt}`} step=${step} result=${result} outcome=${outcome} audio=${audio} last=${idx + 1 >= steps.length}
      onRetry=${() => {
        dropAudio();
        setAttempt((a) => a + 1);
        setPhase('take');
      }}
      onNext=${() => goNext()} />`;
  }

  return html`<div class="player">
    <header class="player-top">
      <button class="icon-btn" aria-label="Salir de la sesión" onClick=${() => (log.current.length ? setPhase('done') : onExit())}><${Icon} name="x" /></button>
      <div class="segs" aria-label=${`Paso ${idx + 1} de ${steps.length}`}>
        ${steps.map((x, i) => html`<i class=${i < idx ? 'done' : i === idx ? 'cur' : ''}></i>`)}
      </div>
      <span class="num small">${idx + 1}/${steps.length}</span>
    </header>
    ${phase === 'intro' && (lesson || step.gym || review) && html`<div class="lesson-tag">${review ? 'Repaso' : step.gym ? 'Gimnasio' : lesson.title}</div>`}
    <main class="player-body">${body}</main>
    ${isScored(step) && phase === 'intro' && !blocked && html`<button class="btn ghost small skip" onClick=${() => goNext()}>Saltar este</button>`}
  </div>`;
}
