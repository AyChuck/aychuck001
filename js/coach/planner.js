// Arma la sesión del día sin que tengas que decidir nada:
// calentar → repasar lo más débil → lección nueva → algo divertido → enfriar.

import { LESSONS, WARMUPS, COOLDOWNS, isScored, isHarsh } from '../content/curriculum.js';
import { nextLesson, lessonStatus, stepStatus, harshBlocked, lessonAllowed, dayKey } from './progress.js';

const rotate = (list, n) => list[((n % list.length) + list.length) % list.length];

function daySeed(now) {
  return Math.floor(new Date(dayKey(now)).getTime() / 86400000);
}

/**
 * mode: 'daily' (≈7 min) | 'quick' (≈2 min)
 * Devuelve { steps, lesson, note }.
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

  // 1. Calentamiento (siempre). Los que no usan el oído fino van primero.
  add(rotate(WARMUPS.filter((w) => w.kind === 'slide'), seed));
  if (mode === 'daily') add(rotate(WARMUPS.filter((w) => w.kind !== 'slide'), seed));

  // 2. Lección nueva (o en curso)
  let lesson = nextLesson(state);
  if (lesson && blocked && lesson.track === 'harsh') {
    // La garganta descansa: salta a la siguiente lección que no sea de guturales.
    lesson = LESSONS.find((l) => l.track !== 'harsh' && lessonAllowed(state, l) && !lessonStatus(state, l).done && l.stage === lesson.stage) ?? null;
  }
  const lessonSteps = [];
  if (lesson) {
    const fresh = !lessonStatus(state, lesson).started;
    for (const s of lesson.steps) {
      const st = stepStatus(state, s);
      if (s.kind === 'card' && !fresh && st.plays > 0) continue; // las tarjetas se leen una vez
      if (st.done && s.kind !== 'card') continue; // lo ya aprobado no se repite aquí
      lessonSteps.push(s);
    }
  }

  // 3. Repaso: el ejercicio aprobado con peor puntaje o más olvidado
  const done = LESSONS.filter((l) => lessonAllowed(state, l)).flatMap((l) => l.steps).filter((s) => isScored(s) && stepStatus(state, s).plays > 0 && s.lesson !== lesson?.id && ok(s));
  const scoreOf = (s) => {
    const r = state.ex[s.id];
    const days = (now - r.ts) / 86400000;
    return r.best - Math.min(30, days * 4); // menor = más urgente
  };
  const review = [...done].sort((a, b) => scoreOf(a) - scoreOf(b));

  if (mode === 'quick') {
    // Solo hasta el primer ejercicio de la lección (con sus tarjetas previas)
    const cut = lessonSteps.findIndex((s) => s.kind !== 'card');
    const before = steps.length;
    lessonSteps.slice(0, cut + 1).forEach(add);
    if (steps.length === before) add(review[0]);
    return { steps, lesson, mode, blocked };
  }

  add(review[0]);
  lessonSteps.forEach(add);

  // 4. Algo divertido que ya dominas (estilo o guturales)
  const fun = done.filter((s) => ['style', 'harsh', 'rhythm'].includes(s.skill) && stepStatus(state, s).done);
  if (fun.length) add(rotate(fun, seed));
  else if (!lesson) add(review[1]);

  // 5. Enfriamiento
  add(rotate(COOLDOWNS, seed));

  return { steps, lesson, mode, blocked };
}

/** Sesión para practicar una lección concreta desde la Ruta. */
export function lessonSession(state, lesson, now = Date.now()) {
  const blocked = harshBlocked(state, now);
  const steps = [];
  const needsWarm = lesson.steps.some((s) => isHarsh(s) || s.dyn === 'loud');
  if (needsWarm) steps.push(rotate(WARMUPS.filter((w) => w.kind === 'slide'), daySeed(now)));
  for (const s of lesson.steps) if (!(blocked && isHarsh(s))) steps.push(s);
  return { steps, lesson, mode: 'lesson', blocked };
}

/** Duración estimada en minutos (para mostrar en el botón). */
export function estimateMinutes(steps) {
  const secs = steps.reduce((t, s) => {
    if (s.kind === 'card') return t + 12;
    if (s.kind === 'pacer') return t + 40;
    if (s.kind === 'breath') return t + 30;
    if (s.kind === 'slide') return t + (s.reps ?? 3) * ((s.secs ?? 6) + 2) + 12;
    if (s.kind === 'harsh' || s.kind === 'trans') return t + s.windows.reduce((a, w) => a + w[1], 0) + 14;
    if (s.kind === 'rhythm') return t + 35;
    return t + 55;
  }, 0);
  return Math.max(1, Math.round(secs / 60));
}
