// Arma la sesión del día sin que tengas que decidir nada:
// calentar → repasar lo más débil → lección nueva → algo divertido → enfriar.

import { LESSONS, WARMUPS, COOLDOWNS, isScored, isHarsh } from '../content/curriculum.js';
import { pendingLessons, lessonStatus, stepStatus, harshBlocked, lessonAllowed, dayKey } from './progress.js';

const rotate = (list, n) => list[((n % list.length) + list.length) % list.length];

function daySeed(now) {
  return Math.floor(new Date(dayKey(now)).getTime() / 86400000);
}

/** Pasos de una lección que aún faltan (las tarjetas se leen una sola vez). */
function remaining(state, lesson) {
  const fresh = !lessonStatus(state, lesson).started;
  return lesson.steps.filter((s) => {
    const st = stepStatus(state, s);
    if (s.kind === 'card') return fresh || st.plays === 0;
    return !st.done;
  });
}

/**
 * mode: 'daily' (≈7 min) | 'quick' (≈2 min)
 * Devuelve { steps, lesson, lessons, mode, blocked }.
 */
export function buildSession(state, mode = 'daily', now = Date.now()) {
  const seed = daySeed(now) + state.sessions;
  const blocked = harshBlocked(state, now);
  const ok = (s) => !(blocked && isHarsh(s));
  const steps = [];
  const used = new Set();
  const add = (s) => {
    if (s && !used.has(s.id) && ok(s)) {
      used.add(s.id);
      steps.push(s);
      return true;
    }
    return false;
  };

  // 1. Calentamiento (siempre): primero una sirena, que no exige oído fino.
  add(rotate(WARMUPS.filter((w) => w.kind === 'slide'), seed));
  if (mode === 'daily') add(rotate(WARMUPS.filter((w) => w.kind !== 'slide'), seed));

  // 2. Lecciones pendientes. Si la garganta descansa, las de guturales esperan.
  const pending = pendingLessons(state).filter((l) => !(blocked && l.track === 'harsh'));
  const lesson = pending[0] ?? null;

  // 3. Repaso: el ejercicio ya practicado con peor puntaje o más olvidado
  const inSession = new Set(pending.slice(0, 2).map((l) => l.id));
  const practiced = LESSONS.filter((l) => lessonAllowed(state, l))
    .flatMap((l) => l.steps)
    .filter((s) => isScored(s) && stepStatus(state, s).plays > 0 && !inSession.has(s.lesson) && ok(s));
  const urgency = (s) => {
    const r = state.ex[s.id];
    return r.best - Math.min(30, ((now - r.ts) / 86400000) * 4); // menor = más urgente
  };
  const review = [...practiced].sort((a, b) => urgency(a) - urgency(b));

  if (mode === 'quick') {
    // Solo hasta el primer ejercicio pendiente de la lección (con sus tarjetas previas)
    const rest = lesson ? remaining(state, lesson) : [];
    const cut = rest.findIndex((s) => s.kind !== 'card');
    const before = steps.length;
    rest.slice(0, cut + 1).forEach(add);
    if (steps.length === before) add(review[0]);
    return { steps, lesson, lessons: lesson ? [lesson] : [], mode, blocked };
  }

  add(review[0]);
  const lessons = [];
  if (lesson) {
    remaining(state, lesson).forEach(add);
    lessons.push(lesson);
    // Si la lección de hoy es corta, entra también la siguiente.
    if (pending[1] && estimateMinutes(steps) < 5) {
      remaining(state, pending[1]).forEach(add);
      lessons.push(pending[1]);
    }
  }

  // 4. Algo divertido que ya dominas (estilo, guturales o ritmo)
  const fun = practiced.filter((s) => ['style', 'harsh', 'rhythm'].includes(s.skill) && stepStatus(state, s).done);
  if (fun.length) add(rotate(fun, seed));
  else if (!lesson) add(review[1]);

  // 5. Enfriamiento
  add(rotate(COOLDOWNS, seed));

  return { steps, lesson, lessons, mode, blocked };
}

/** Sesión para practicar una lección concreta desde la Ruta. */
export function lessonSession(state, lesson, now = Date.now()) {
  const blocked = harshBlocked(state, now);
  const steps = [];
  const needsWarm = lesson.steps.some((s) => isHarsh(s) || s.dyn === 'loud');
  if (needsWarm) steps.push(rotate(WARMUPS.filter((w) => w.kind === 'slide'), daySeed(now)));
  for (const s of lesson.steps) if (!(blocked && isHarsh(s))) steps.push(s);
  return { steps, lesson, lessons: [lesson], mode: 'lesson', blocked };
}

/** Duración estimada en minutos (para mostrar en el botón). */
export function estimateMinutes(steps) {
  const secs = steps.reduce((t, s) => {
    if (s.kind === 'card') return t + 12;
    if (s.kind === 'pacer') return t + (s.pattern ?? [4, 4, 8]).reduce((a, b) => a + b, 0) * (s.cycles ?? 3) + 6;
    if (s.kind === 'breath') return t + (s.target ?? 15) + 18;
    if (s.kind === 'slide') return t + (s.reps ?? 3) * ((s.secs ?? 6) + 2) + 14;
    if (s.kind === 'harsh' || s.kind === 'trans') return t + s.windows.reduce((a, w) => a + w[1], 0) + 16;
    if (s.kind === 'rhythm') return t + 38;
    return t + 55;
  }, 0);
  return Math.max(1, Math.round(secs / 60));
}
