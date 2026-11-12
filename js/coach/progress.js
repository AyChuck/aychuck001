// Estado del progreso y reglas del juego (XP, rachas, desbloqueos, logros).
// Reductores puros: reciben estado y devuelven estado nuevo.

import { LESSONS, STAGES, stepById, isScored, isHarsh } from '../content/curriculum.js';
import { starsFor } from './scoring.js';

export const SKILLS = {
  breath: 'Aire',
  pitch: 'Afinación',
  range: 'Rango',
  power: 'Potencia',
  harsh: 'Guturales',
  rhythm: 'Ritmo',
  style: 'Estilo',
};

export const RANKS = [
  'Público', 'Roadie', 'Corista de garage', 'Vocalista local', 'Telonero', 'Voz de la escena',
  'De gira', 'Cabeza de cartel', 'Leyenda del pit', 'Headliner',
];

export const PASS = 55;
export const HARSH_BUDGET = 240; // segundos de guturales por día

export function defaultState() {
  return {
    v: 1,
    onboarded: false,
    profile: { goal: 'both', exp: 'new', low: 45, high: 64, firstLow: null, firstHigh: null, refDb: null, gate: 0.012, tested: false },
    settings: { headphones: false, guide: true, strict: 1, sfx: true },
    xp: 0,
    days: {},
    ex: {},
    mastery: {},
    ach: {},
    throat: { status: 'ok', ts: 0 },
    harsh: { day: '', secs: 0 },
    history: [],
    sessions: 0,
  };
}

export const dayKey = (ts = Date.now()) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const DAY = 86400000;

/** Racha con perdón: puedes faltar un día sin perderla. */
export function streak(state, now = Date.now()) {
  const has = (ts) => !!state.days[dayKey(ts)];
  let t = now;
  if (!has(t)) {
    t -= DAY;
    if (!has(t)) {
      t -= DAY;
      if (!has(t)) return 0;
    }
  }
  let n = 0;
  let misses = 0;
  while (misses < 2) {
    if (has(t)) {
      n++;
      misses = 0;
    } else misses++;
    t -= DAY;
  }
  return n;
}

/** Últimos 7 días (lunes a domingo de la semana actual). */
export function week(state, now = Date.now()) {
  const d = new Date(now);
  const dow = (d.getDay() + 6) % 7; // lunes = 0
  const out = [];
  for (let i = 0; i < 7; i++) {
    const ts = now + (i - dow) * DAY;
    out.push({ label: 'LMXJVSD'[i], done: !!state.days[dayKey(ts)], today: i === dow, future: i > dow });
  }
  return out;
}

export function level(xp) {
  let lvl = 1;
  let need = 120;
  let rest = xp;
  while (rest >= need) {
    rest -= need;
    lvl++;
    need = Math.round(need * 1.25);
  }
  return { lvl, into: rest, need, rank: RANKS[Math.min(RANKS.length - 1, Math.floor((lvl - 1) / 2))] };
}

export function stepStatus(state, step) {
  const r = state.ex[step.id];
  if (!r) return { plays: 0, best: 0, done: false, stars: 0 };
  const done = isScored(step) ? r.best >= PASS : r.plays > 0;
  return { ...r, done, stars: isScored(step) ? starsFor(r.best) : 0 };
}

export function lessonStatus(state, lesson) {
  const st = lesson.steps.map((s) => stepStatus(state, s));
  const scored = lesson.steps.map((s, i) => [s, st[i]]).filter(([s]) => isScored(s));
  const done = st.every((x) => x.done);
  const started = st.some((x) => x.plays > 0);
  const avg = scored.length ? scored.reduce((a, [, x]) => a + x.best, 0) / scored.length : 100;
  return { done, started, stars: done ? Math.max(1, starsFor(avg)) : 0, progress: st.filter((x) => x.done).length / st.length };
}

export function stageStatus(state, stageId) {
  const idx = STAGES.findIndex((s) => s.id === stageId);
  const lessons = LESSONS.filter((l) => l.stage === stageId);
  const done = lessons.filter((l) => lessonStatus(state, l).done).length;
  let unlocked = idx === 0;
  if (idx > 0) {
    const prev = LESSONS.filter((l) => l.stage === STAGES[idx - 1].id);
    const prevDone = prev.filter((l) => lessonStatus(state, l).done).length;
    unlocked = prevDone >= Math.ceil(prev.length * 0.6);
  }
  return { unlocked, done, total: lessons.length };
}

export function lessonAllowed(state, lesson) {
  if (state.profile.goal === 'clean' && lesson.track === 'harsh') return false;
  return true;
}

/** Siguiente lección sin terminar dentro de las etapas desbloqueadas. */
export function nextLesson(state) {
  for (const st of STAGES) {
    if (!stageStatus(state, st.id).unlocked) break;
    for (const l of LESSONS) {
      if (l.stage !== st.id || !lessonAllowed(state, l)) continue;
      if (!lessonStatus(state, l).done) return l;
    }
  }
  return null;
}

export function harshLeft(state, now = Date.now()) {
  const used = state.harsh.day === dayKey(now) ? state.harsh.secs : 0;
  return Math.max(0, HARSH_BUDGET - used);
}

/** ¿Se permiten guturales ahora? Si dolió, 24 h de descanso; si está cansada, 4 h. */
export function harshBlocked(state, now = Date.now()) {
  const { status, ts } = state.throat;
  if (status === 'hurt' && now - ts < 24 * 3600e3) return 'hurt';
  if (status === 'tired' && now - ts < 4 * 3600e3) return 'tired';
  if (harshLeft(state, now) <= 0) return 'budget';
  return null;
}

/** Registra el resultado de un paso. Devuelve { state, gained, events }. */
export function record(state, stepId, result, now = Date.now()) {
  const step = stepById(stepId);
  const s = structuredClone(state);
  const prev = s.ex[stepId] ?? { plays: 0, best: 0, last: 0, ts: 0, ease: 0, fails: 0 };
  const scored = !!step && isScored(step);
  const score = scored ? result.score : 100;
  const wasDone = scored ? prev.best >= PASS : prev.plays > 0;
  const events = [];

  const rec = { ...prev, plays: prev.plays + 1, last: score, best: Math.max(prev.best, score), ts: now };
  if (scored) {
    if (score < PASS) {
      rec.fails = (prev.fails ?? 0) + 1;
      if (rec.fails >= 2 && rec.ease < 2) {
        rec.ease++;
        rec.fails = 0;
        events.push({ type: 'easier' });
      }
    } else rec.fails = 0;
  }
  s.ex[stepId] = rec;

  // XP: práctica siempre cuenta; mejorar da más.
  let gained = scored ? 6 + (result.stars ?? 0) * 4 : 3;
  if (scored && score > prev.best && prev.plays > 0) gained += 4;
  if (!wasDone && (scored ? score >= PASS : true)) gained += scored ? 8 : 2;
  const before = level(s.xp).lvl;
  s.xp += gained;
  const after = level(s.xp);
  if (after.lvl > before) events.push({ type: 'level', lvl: after.lvl, rank: after.rank });

  const key = dayKey(now);
  const d = s.days[key] ?? { xp: 0, n: 0 };
  s.days[key] = { xp: d.xp + gained, n: d.n + 1 };

  if (scored && step.skill) {
    const m = s.mastery[step.skill];
    s.mastery[step.skill] = m == null ? score : m * 0.7 + score * 0.3;
  }

  if (step && isHarsh(step)) {
    const secs = result.harshSecs ?? 10;
    s.harsh = { day: key, secs: (s.harsh.day === key ? s.harsh.secs : 0) + secs };
  }

  // Volumen de referencia de la voz limpia (para medir "suave" y "fuerte")
  if (step && ['pattern', 'sustain'].includes(step.kind) && !step.dyn && result.stats?.db != null && score >= PASS) {
    s.profile.refDb = s.profile.refDb == null ? result.stats.db : s.profile.refDb * 0.8 + result.stats.db * 0.2;
  }

  if (scored) {
    s.history.push({ ts: now, id: stepId, score });
    if (s.history.length > 400) s.history = s.history.slice(-400);
  }

  // Lección terminada
  if (step?.lesson) {
    const lesson = LESSONS.find((l) => l.id === step.lesson);
    if (lessonStatus(s, lesson).done && !lessonStatus(state, lesson).done) events.push({ type: 'lesson', lesson });
  }

  for (const a of ACHIEVEMENTS) {
    if (!s.ach[a.id] && a.test(s, { step, result, now })) {
      s.ach[a.id] = now;
      events.push({ type: 'ach', ach: a });
    }
  }
  return { state: s, gained, events };
}

export const ACHIEVEMENTS = [
  { id: 'first', name: 'Primera toma', desc: 'Completa tu primer ejercicio', test: (s) => Object.keys(s.ex).length >= 1 },
  { id: 'tri', name: 'Clavado', desc: 'Saca 3 estrellas en un ejercicio', test: (s, c) => c.result?.stars === 3 },
  { id: 'fry', name: 'Puerta vieja', desc: 'Logra tu primer vocal fry', test: (s) => (s.ex['fry-1:2']?.best ?? 0) >= PASS },
  { id: 'scream', name: 'Primer scream', desc: 'Sostén un fry scream', test: (s) => (s.ex['scream-1:1']?.best ?? 0) >= PASS },
  { id: 'air20', name: 'Pulmones de acero', desc: 'Aguanta 20 s de aire parejo', test: (s, c) => c.step?.kind === 'breath' && (c.result?.stats?.longest ?? 0) >= 20 },
  { id: 'streak3', name: 'Tres al hilo', desc: 'Racha de 3 días', test: (s, c) => streak(s, c.now) >= 3 },
  { id: 'streak7', name: 'Semana de gira', desc: 'Racha de 7 días', test: (s, c) => streak(s, c.now) >= 7 },
  { id: 'stage1', name: 'Fuera del cuarto', desc: 'Termina la etapa 1', test: (s) => stageStatus(s, 's1').done >= LESSONS.filter((l) => l.stage === 's1' && lessonAllowed(s, l)).length },
  { id: 'mix', name: 'Coro arriba', desc: 'Termina "Coro que levanta"', test: (s) => lessonStatus(s, LESSONS.find((l) => l.id === 'estilo-2')).done },
  { id: 'blegh', name: 'BLEGH', desc: 'Remata un breakdown', test: (s) => (s.ex['blegh:1']?.best ?? 0) >= PASS },
  { id: 'range2', name: 'Más techo', desc: 'Amplía tu rango 2 semitonos', test: (s) => s.profile.firstHigh != null && s.profile.high - s.profile.low - (s.profile.firstHigh - s.profile.firstLow) >= 2 },
  { id: 'song', name: 'Ceniza', desc: 'Canta la canción completa', test: (s) => lessonStatus(s, LESSONS.find((l) => l.id === 'final-1')).done },
];
