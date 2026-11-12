// Estado del progreso y reglas del sistema de aprendizaje.
// Reductores puros: reciben estado y devuelven estado nuevo.
//
// La idea central: la voz se aprende con repetición espaciada, no de un jalón.
//  - Cada ejercicio tiene GRADOS (0 a 5). Subir de grado exige aprobarlo en un día
//    distinto, y cada grado lo vuelve más difícil (más rápido, más alto, más fino).
//  - Lo aprobado vuelve como REPASO a intervalos crecientes (1, 2, 4, 8, 21 días).
//  - Hay un tope de lecciones NUEVAS por día, y cada etapa pide consolidar la anterior.

import { LESSONS, STAGES, GYM, stepById, isScored, isHarsh } from '../content/curriculum.js';
import { starsFor } from './scoring.js';

export const SKILLS = {
  breath: 'Aire',
  pitch: 'Afinación',
  range: 'Registros y rango',
  power: 'Potencia',
  harsh: 'Guturales',
  rhythm: 'Ritmo',
  style: 'Estilo',
};

export const RANKS = [
  'Público', 'Roadie', 'Corista de garage', 'Vocalista local', 'Telonero', 'Voz de la escena',
  'De gira', 'Cabeza de cartel', 'Leyenda del pit', 'Headliner',
];

export const PASS = 60;
export const MAX_GRADE = 5;
export const GRADE_NEED = [60, 68, 75, 82, 88]; // puntaje para ganar el grado 1..5
export const GRADE_NAMES = ['Nuevo', 'Aprobado', 'Firme', 'Sólido', 'Fino', 'Dominado'];
export const REVIEW_DAYS = [1, 1, 2, 4, 8, 21]; // días hasta el siguiente repaso, según el grado
export const STAGE_GRADE = 2; // grado promedio que pide una etapa para abrir la siguiente
export const HARSH_BUDGET = 240; // segundos de guturales por día

export function defaultState() {
  return {
    v: 2,
    onboarded: false,
    profile: { goal: 'both', exp: 'new', low: 45, high: 64, firstLow: null, firstHigh: null, refDb: null, gate: 0.012, tested: false },
    settings: { headphones: false, guide: true, strict: 1, sfx: true, grit: 1, room: false, roomGate: null },
    xp: 0,
    days: {},
    ex: {},
    started: {}, // lección → día en que se empezó
    mastery: {},
    ach: {},
    records: { air: 0 },
    throat: { status: 'ok', ts: 0 },
    harsh: { day: '', secs: 0 },
    history: [],
    sessions: 0,
    songs: {},
    focusSong: null,
    taste: ['posthc', 'punk', 'metal', 'core', 'es'],
    heroes: ['Sleep Token', 'Falling in Reverse', 'Bad Omens'], // referentes de técnica
  };
}

export const dayKey = (ts = Date.now()) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const DAY = 86400000;
const startOfDay = (ts) => {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

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

/** Semana actual, de lunes a domingo. */
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

// ───────────────────────── Grados y repasos ─────────────────────────

export const gradeOf = (rec) => (rec ? (rec.grade ?? (rec.best >= PASS ? 1 : 0)) : 0);

export function stepStatus(state, step) {
  const r = state.ex[step.id];
  if (!r) return { plays: 0, best: 0, done: false, stars: 0, grade: 0 };
  const grade = isScored(step) ? gradeOf(r) : 0;
  const done = isScored(step) ? grade >= 1 : r.plays > 0;
  return { ...r, done, grade, stars: isScored(step) ? starsFor(r.best) : 0 };
}

/** ¿Toca repasar este ejercicio hoy? */
export function isDue(state, step, now = Date.now()) {
  const r = state.ex[step.id];
  if (!r || !isScored(step) || step.nograde || gradeOf(r) < 1) return false;
  return now >= (r.due ?? 0);
}

/** Días que faltan para el siguiente repaso (0 = hoy). */
export function dueIn(state, step, now = Date.now()) {
  const r = state.ex[step.id];
  if (!r?.due) return 0;
  return Math.max(0, Math.ceil((r.due - now) / DAY));
}

export function lessonStatus(state, lesson) {
  const st = lesson.steps.map((s) => stepStatus(state, s));
  const scored = lesson.steps.map((s, i) => [s, st[i]]).filter(([s]) => isScored(s));
  const done = st.every((x) => x.done);
  const started = st.some((x) => x.plays > 0);
  const avg = scored.length ? scored.reduce((a, [, x]) => a + x.best, 0) / scored.length : 100;
  const grade = scored.length ? scored.reduce((a, [, x]) => a + x.grade, 0) / scored.length : 0;
  return { done, started, grade, stars: done ? Math.max(1, starsFor(avg)) : 0, progress: st.filter((x) => x.done).length / st.length };
}

export function lessonAllowed(state, lesson) {
  if (state.profile.goal === 'clean' && lesson.track === 'harsh') return false;
  return true;
}

/** Grado promedio de los ejercicios de una etapa: qué tan asentada está. */
export function stageGrade(state, stageId) {
  const steps = LESSONS.filter((l) => l.stage === stageId && lessonAllowed(state, l)).flatMap((l) => l.steps).filter(isScored);
  if (!steps.length) return MAX_GRADE;
  return steps.reduce((a, s) => a + gradeOf(state.ex[s.id]), 0) / steps.length;
}

/**
 * Una etapa se abre cuando la anterior tiene casi todas sus lecciones aprobadas
 * Y sus ejercicios están consolidados (grado promedio 2: aprobados en días distintos).
 */
export function stageStatus(state, stageId) {
  const idx = STAGES.findIndex((s) => s.id === stageId);
  const lessons = LESSONS.filter((l) => l.stage === stageId && lessonAllowed(state, l));
  const done = lessons.filter((l) => lessonStatus(state, l).done).length;
  const out = { unlocked: idx === 0, done, total: lessons.length, grade: stageGrade(state, stageId), gate: null };
  if (idx > 0) {
    const prevId = STAGES[idx - 1].id;
    const prev = LESSONS.filter((l) => l.stage === prevId && lessonAllowed(state, l));
    const prevDone = prev.filter((l) => lessonStatus(state, l).done).length;
    const needLessons = Math.ceil(prev.length * 0.8);
    const grade = stageGrade(state, prevId);
    out.gate = { lessons: prevDone, needLessons, grade, needGrade: STAGE_GRADE };
    out.unlocked = stageStatus(state, prevId).unlocked && prevDone >= needLessons && grade >= STAGE_GRADE - 1e-9;
  }
  return out;
}

/** Lecciones sin terminar dentro de las etapas desbloqueadas, en orden. */
export function pendingLessons(state) {
  const out = [];
  for (const st of STAGES) {
    if (!stageStatus(state, st.id).unlocked) break;
    const stage = LESSONS.filter((l) => l.stage === st.id && lessonAllowed(state, l));
    // Con objetivo "guturales", dentro de cada etapa van primero aire, guturales y ritmo.
    if (state.profile.goal === 'harsh') {
      const first = (l) => (['breath', 'harsh', 'rhythm'].includes(l.track) ? 0 : 1);
      stage.sort((a, b) => first(a) - first(b));
    }
    for (const l of stage) if (!lessonStatus(state, l).done) out.push(l);
  }
  return out;
}

export const nextLesson = (state) => pendingLessons(state)[0] ?? null;

/** Lecciones nuevas permitidas por día: 2 en la etapa de fundamentos, 1 después. */
export const newPerDay = (lesson) => (lesson.stage === 's1' ? 2 : 1);

export function startedToday(state, now = Date.now()) {
  const key = dayKey(now);
  return Object.values(state.started ?? {}).filter((d) => d === key).length;
}

/** ¿Se puede empezar esta lección hoy? Lo ya empezado siempre se puede continuar. */
export function canStart(state, lesson, now = Date.now()) {
  if (state.started?.[lesson.id] || lessonStatus(state, lesson).started) return true;
  return startedToday(state, now) < newPerDay(lesson);
}

/** Ejercicios del gimnasio disponibles según la etapa alcanzada y el objetivo. */
export function gymAvailable(state) {
  // El gimnasio empieza cuando ya conoces las escalas (lección "La escala del metalcore")
  if (gradeOf(state.ex['tono-2:1']) < 1) return [];
  return GYM.filter((g) => stageStatus(state, g.needs).unlocked && !(state.profile.goal === 'clean' && isHarsh(g)));
}

/** Todo lo que toca repasar hoy, lo más atrasado primero. */
export function dueSteps(state, now = Date.now()) {
  const pool = [...LESSONS.filter((l) => lessonAllowed(state, l)).flatMap((l) => l.steps), ...gymAvailable(state)];
  return pool
    .filter((s) => isDue(state, s, now))
    .sort((a, b) => (state.ex[a.id].due ?? 0) - (state.ex[b.id].due ?? 0));
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

// ───────────────────────── Registro de resultados ─────────────────────────

/** Registra el resultado de un paso. Devuelve { state, gained, events }. */
export function record(state, stepId, result, now = Date.now()) {
  const step = stepById(stepId);
  const s = structuredClone(state);
  const prev = s.ex[stepId] ?? { plays: 0, best: 0, last: 0, ts: 0, ease: 0, fails: 0 };
  const scored = !!step && isScored(step);
  const score = scored ? result.score : 100;
  const key = dayKey(now);
  const grade = scored ? gradeOf(s.ex[stepId]) : 0;
  const wasDone = scored ? grade >= 1 : prev.plays > 0;
  const events = [];

  const rec = { ...prev, plays: prev.plays + 1, last: score, best: Math.max(prev.best, score), ts: now };
  let newGrade = grade;
  if (scored) {
    if (score < PASS) {
      rec.fails = (prev.fails ?? 0) + 1;
      if (rec.fails >= 2 && rec.ease < 2 && grade === 0) {
        rec.ease++;
        rec.fails = 0;
        events.push({ type: 'easier' });
      }
    } else rec.fails = 0;

    if (!step.nograde) {
      if (grade < MAX_GRADE && score >= GRADE_NEED[grade]) {
        if (prev.gradeDay !== key) {
          newGrade = grade + 1;
          rec.gradeDay = key;
          events.push({ type: 'grade', grade: newGrade, name: GRADE_NAMES[newGrade], days: REVIEW_DAYS[newGrade] });
        } else events.push({ type: 'gradeWait', need: GRADE_NEED[grade], next: GRADE_NAMES[grade + 1] });
      } else if (grade >= 1 && grade < MAX_GRADE && score >= PASS) {
        events.push({ type: 'gradeShort', need: GRADE_NEED[grade], next: GRADE_NAMES[grade + 1] });
      }
      rec.grade = newGrade;
      // Aprobado: vuelve según el grado. Fallado: vuelve mañana.
      rec.due = startOfDay(now) + DAY * (score >= PASS ? REVIEW_DAYS[newGrade] : 1);
    }
  }
  s.ex[stepId] = rec;

  if (step?.lesson && !s.started[step.lesson]) s.started[step.lesson] = key;

  // XP: practicar siempre cuenta; mejorar y subir de grado dan más.
  let gained = scored ? 6 + (result.stars ?? 0) * 4 : 3;
  if (scored && score > prev.best && prev.plays > 0) gained += 4;
  if (!wasDone && (scored ? newGrade >= 1 : true)) gained += scored ? 8 : 2;
  if (newGrade > grade && grade >= 1) gained += 10;
  const before = level(s.xp).lvl;
  s.xp += gained;
  const after = level(s.xp);
  if (after.lvl > before) events.push({ type: 'level', lvl: after.lvl, rank: after.rank });

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

  if (step?.kind === 'breath' && (result.stats?.longest ?? 0) > (s.records.air ?? 0)) s.records.air = result.stats.longest;

  // Volumen de referencia de la voz limpia (para medir "suave" y "fuerte")
  if (step && ['pattern', 'sustain'].includes(step.kind) && !step.dyn && result.stats?.db != null && score >= PASS) {
    s.profile.refDb = s.profile.refDb == null ? result.stats.db : s.profile.refDb * 0.8 + result.stats.db * 0.2;
  }

  if (scored) {
    s.history.push({ ts: now, id: stepId, score });
    if (s.history.length > 600) s.history = s.history.slice(-600);
  }

  if (step?.lesson) {
    const lesson = LESSONS.find((l) => l.id === step.lesson);
    if (lessonStatus(s, lesson).done && !lessonStatus(state, lesson).done) events.push({ type: 'lesson', lesson });
    const stIdx = STAGES.findIndex((x) => x.id === lesson.stage);
    const nxt = STAGES[stIdx + 1];
    if (nxt && stageStatus(s, nxt.id).unlocked && !stageStatus(state, nxt.id).unlocked) events.push({ type: 'stage', stage: nxt });
  }

  checkAchievements(s, { step, result, now }, events);
  return { state: s, gained, events };
}

export function checkAchievements(s, ctx, events = []) {
  for (const a of ACHIEVEMENTS) {
    if (!s.ach[a.id] && a.test(s, ctx)) {
      s.ach[a.id] = ctx.now ?? Date.now();
      events.push({ type: 'ach', ach: a });
    }
  }
  return events;
}

const maxGrade = (s) => Math.max(0, ...Object.values(s.ex).map((r) => r.grade ?? 0));

export const ACHIEVEMENTS = [
  { id: 'first', name: 'Primera toma', desc: 'Completa tu primer ejercicio', test: (s) => Object.keys(s.ex).length >= 1 },
  { id: 'tri', name: 'Clavado', desc: 'Saca 3 estrellas en un ejercicio', test: (s, c) => c.result?.stars === 3 },
  { id: 'fry', name: 'Puerta vieja', desc: 'Logra tu primer vocal fry', test: (s) => gradeOf(s.ex['fry-1:2']) >= 1 },
  { id: 'scream', name: 'Primer scream', desc: 'Sostén un fry scream', test: (s) => gradeOf(s.ex['scream-1:1']) >= 1 },
  { id: 'air20', name: 'Pulmones de acero', desc: 'Aguanta 20 s de aire parejo', test: (s) => (s.records?.air ?? 0) >= 20 },
  { id: 'g3', name: 'Sólido', desc: 'Lleva un ejercicio a grado 3', test: (s) => maxGrade(s) >= 3 },
  { id: 'g5', name: 'Dominado', desc: 'Lleva un ejercicio a grado 5', test: (s) => maxGrade(s) >= 5 },
  { id: 'streak3', name: 'Tres al hilo', desc: 'Racha de 3 días', test: (s, c) => streak(s, c.now) >= 3 },
  { id: 'streak7', name: 'Semana de gira', desc: 'Racha de 7 días', test: (s, c) => streak(s, c.now) >= 7 },
  { id: 'days30', name: 'Un mes de voz', desc: 'Canta 30 días distintos', test: (s) => Object.keys(s.days).length >= 30 },
  { id: 'stage1', name: 'Fuera del cuarto', desc: 'Abre la etapa 2', test: (s) => stageStatus(s, 's2').unlocked },
  { id: 'mix', name: 'Coro arriba', desc: 'Termina "Coro que levanta"', test: (s) => lessonStatus(s, LESSONS.find((l) => l.id === 'estilo-2')).done },
  { id: 'blegh', name: 'BLEGH', desc: 'Remata un breakdown', test: (s) => gradeOf(s.ex['blegh:1']) >= 1 },
  { id: 'range2', name: 'Más techo', desc: 'Amplía tu rango 2 semitonos', test: (s) => s.profile.firstHigh != null && s.profile.high - s.profile.low - (s.profile.firstHigh - s.profile.firstLow) >= 2 },
  { id: 'song1', name: 'Con la banda', desc: 'Graba una toma sobre una canción', test: (s) => Object.values(s.songs ?? {}).some((x) => x.takes?.length) },
  { id: 'songM', name: 'Repertorio', desc: 'Domina una canción', test: (s) => Object.values(s.songs ?? {}).some((x) => x.mastered) },
  { id: 'song', name: 'Ceniza', desc: 'Canta la canción original completa', test: (s) => lessonStatus(s, LESSONS.find((l) => l.id === 'final-1')).done },
];
