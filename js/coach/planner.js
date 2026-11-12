// Arma la sesión del día sin que tengas que decidir nada:
// calentar → repasos que tocan hoy → lección en curso o nueva → gimnasio / riff → enfriar.

import { LESSONS, WARMUPS, COOLDOWNS, isScored, isHarsh, stepById } from '../content/curriculum.js';
import { RIFF_ID } from './riffs.js';
import {
  pendingLessons, lessonStatus, stepStatus, harshBlocked, lessonAllowed, dayKey, canStart, dueSteps, gymAvailable,
} from './progress.js';

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
 * mode: 'daily' (≈8 min) | 'quick' (≈2 min)
 * Devuelve { steps, lesson, lessons, mode, blocked, reviews, waiting }.
 *  - reviews: cuántos repasos entraron
 *  - waiting: lección que ya está desbloqueada pero se abre mañana (tope diario)
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
  const quick = mode === 'quick';

  // 1. Calentamiento (siempre): primero una sirena, que no exige oído fino.
  add(rotate(WARMUPS.filter((w) => w.kind === 'slide'), seed));
  if (!quick) add(rotate(WARMUPS.filter((w) => w.kind !== 'slide'), seed));

  // 2. Repasos que tocan hoy, lo más atrasado primero.
  const due = dueSteps(state, now).filter(ok);
  let reviews = 0;
  for (const s of due.slice(0, quick ? 1 : 3)) if (add(s)) reviews++;

  // 3. Lecciones: primero lo que ya está en curso; lo nuevo, solo si hoy todavía cabe.
  const pending = pendingLessons(state).filter((l) => !(blocked && l.track === 'harsh'));
  const lessons = [];
  let waiting = null;
  for (const l of pending) {
    if (!canStart(state, l, now)) {
      waiting ??= l;
      continue;
    }
    const isNew = !lessonStatus(state, l).started;
    const rest = remaining(state, l);
    if (quick) {
      if (reviews) break; // en 2 minutos: un repaso, o un ejercicio de la lección
      const cut = rest.findIndex((s) => s.kind !== 'card');
      rest.slice(0, cut + 1).forEach(add);
      lessons.push(l);
      break;
    }
    if (lessons.length && estimateMinutes(steps) >= (isNew ? 5 : 8)) break;
    rest.forEach(add);
    lessons.push(l);
    // Cuenta lo que esta sesión empezaría hoy, para no pasarse del tope
    if (isNew) state = { ...state, started: { ...state.started, [l.id]: dayKey(now) } };
    if (lessons.length >= 2) break;
  }
  if (quick) {
    if (steps.length < 2) add(rotate(gymAvailable(state), seed));
    return { steps, lesson: lessons[0] ?? null, lessons, mode, blocked, reviews, waiting };
  }

  // 4. Gimnasio: si hoy no hubo material nuevo suficiente, entra un ejercicio que no conoces.
  if (estimateMinutes(steps) < 7) {
    const gym = gymAvailable(state).filter(ok);
    add(gym.find((g) => !state.ex[g.id]) ?? rotate(gym, seed));
  }

  // 5. Riff del día: una frase nueva cada día, cuando ya conoces la mecánica.
  if (estimateMinutes(steps) < 8 && (state.ex['tono-2:1']?.plays ?? 0) > 0) add(stepById(RIFF_ID));

  // 6. Algo divertido que ya dominas (estilo, guturales o ritmo)
  if (estimateMinutes(steps) < 8) {
    const fun = LESSONS.filter((l) => lessonAllowed(state, l))
      .flatMap((l) => l.steps)
      .filter((s) => isScored(s) && ['style', 'harsh', 'rhythm'].includes(s.skill) && stepStatus(state, s).done);
    if (fun.length) add(rotate(fun, seed));
  }

  // 7. Enfriamiento
  add(rotate(COOLDOWNS, seed));

  return { steps, lesson: lessons[0] ?? null, lessons, mode, blocked, reviews, waiting };
}

/** Solo repasos: para cuando quieres más sin adelantar material nuevo. */
export function reviewSession(state, now = Date.now()) {
  const blocked = harshBlocked(state, now);
  const seed = daySeed(now) + state.sessions;
  const due = dueSteps(state, now).filter((s) => !(blocked && isHarsh(s)));
  let pool = due.slice(0, 6);
  if (!pool.length) {
    // Nada pendiente: práctica extra de lo menos asentado
    pool = [...LESSONS.filter((l) => lessonAllowed(state, l)).flatMap((l) => l.steps), ...gymAvailable(state)]
      .filter((s) => isScored(s) && stepStatus(state, s).plays > 0 && !(blocked && isHarsh(s)))
      .sort((a, b) => stepStatus(state, a).grade - stepStatus(state, b).grade || state.ex[a.id].ts - state.ex[b.id].ts)
      .slice(0, 4);
  }
  const steps = [rotate(WARMUPS.filter((w) => w.kind === 'slide'), seed), ...pool, rotate(COOLDOWNS, seed)];
  return { steps, lesson: null, lessons: [], mode: 'review', blocked, reviews: due.length ? pool.length : 0, waiting: null };
}

/** Sesión para practicar una lección concreta desde la Ruta. */
export function lessonSession(state, lesson, now = Date.now()) {
  const blocked = harshBlocked(state, now);
  const steps = [];
  const needsWarm = lesson.steps.some((s) => isHarsh(s) || s.dyn === 'loud');
  if (needsWarm) steps.push(rotate(WARMUPS.filter((w) => w.kind === 'slide'), daySeed(now)));
  for (const s of lesson.steps) if (!(blocked && isHarsh(s))) steps.push(s);
  return { steps, lesson, lessons: [lesson], mode: 'lesson', blocked, reviews: 0, waiting: null };
}

/** Un solo ejercicio (desde el gimnasio o la lista de repasos). */
export function singleSession(step) {
  return { steps: [step], lesson: null, lessons: [], mode: 'single', blocked: null, reviews: 0, waiting: null };
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
