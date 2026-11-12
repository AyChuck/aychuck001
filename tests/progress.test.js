import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultState, record, streak, level, nextLesson, lessonStatus, stageStatus, harshBlocked, dayKey, PASS,
  gradeOf, isDue, dueSteps, canStart, gymAvailable, stageGrade, REVIEW_DAYS,
} from '../js/coach/progress.js';
import { buildSession, lessonSession, reviewSession, estimateMinutes } from '../js/coach/planner.js';
import { LESSONS, GYM, isScored, isHarsh, stepById } from '../js/content/curriculum.js';
import { riffOfDay, RIFF_ID } from '../js/coach/riffs.js';

const DAY = 86400000;
const T0 = new Date(2026, 10, 12, 18, 0).getTime();

function playLesson(state, lesson, score = 80, now = T0) {
  let s = state;
  for (const step of lesson.steps) s = record(s, step.id, { score, stars: 2 }, now).state;
  return s;
}

/** Simula a alguien que hace la sesión diaria completa durante n días, siempre con el mismo puntaje. */
function simulate(days, score = 90, state = defaultState()) {
  let s = state;
  const log = [];
  for (let d = 0; d < days; d++) {
    const now = T0 + d * DAY;
    const ses = buildSession(s, 'daily', now);
    for (const step of ses.steps) s = record(s, step.id, { score, stars: 3 }, now).state;
    s.sessions++;
    log.push(ses);
  }
  return { state: s, log };
}

test('registrar un resultado da XP, marca el día y actualiza el dominio', () => {
  const { state, gained, events } = record(defaultState(), 'tono-1:copia-la-nota', { score: 82, stars: 2, stats: { db: -22 } }, T0);
  assert.ok(gained > 0);
  assert.equal(state.xp, gained);
  assert.ok(state.days[dayKey(T0)]);
  assert.equal(Math.round(state.mastery.pitch), 82);
  assert.equal(state.profile.refDb, -22);
  assert.equal(state.started['tono-1'], dayKey(T0));
  assert.ok(events.some((e) => e.type === 'ach' && e.ach.id === 'first'));
});

test('dos fallos seguidos activan el modo fácil del ejercicio', () => {
  let s = defaultState();
  s = record(s, 'tono-1:copia-la-nota', { score: 30, stars: 0 }, T0).state;
  const r = record(s, 'tono-1:copia-la-nota', { score: 35, stars: 0 }, T0);
  assert.ok(r.events.some((e) => e.type === 'easier'));
  assert.equal(r.state.ex['tono-1:copia-la-nota'].ease, 1);
});

test('los grados solo suben en días distintos y piden cada vez más puntaje', () => {
  let s = defaultState();
  let r = record(s, 'tono-1:copia-la-nota', { score: 95, stars: 3 }, T0);
  assert.equal(gradeOf(r.state.ex['tono-1:copia-la-nota']), 1);
  assert.ok(r.events.some((e) => e.type === 'grade' && e.grade === 1));
  // El mismo día, por bien que salga, no sube otra vez
  r = record(r.state, 'tono-1:copia-la-nota', { score: 100, stars: 3 }, T0 + 3600e3);
  assert.equal(gradeOf(r.state.ex['tono-1:copia-la-nota']), 1);
  assert.ok(r.events.some((e) => e.type === 'gradeWait'));
  // Al día siguiente con 65 no alcanza para el grado 2 (pide 68)…
  r = record(r.state, 'tono-1:copia-la-nota', { score: 65, stars: 1 }, T0 + DAY);
  assert.equal(gradeOf(r.state.ex['tono-1:copia-la-nota']), 1);
  assert.ok(r.events.some((e) => e.type === 'gradeShort'));
  // …pero con 70 al otro día sí
  r = record(r.state, 'tono-1:copia-la-nota', { score: 70, stars: 1 }, T0 + 2 * DAY);
  assert.equal(gradeOf(r.state.ex['tono-1:copia-la-nota']), 2);
  s = r.state;
  for (let d = 3; d < 12; d++) s = record(s, 'tono-1:copia-la-nota', { score: 99, stars: 3 }, T0 + d * DAY).state;
  assert.equal(gradeOf(s.ex['tono-1:copia-la-nota']), 5);
});

test('repaso espaciado: lo aprobado vuelve según su grado; lo fallado, mañana', () => {
  const step = stepById('tono-1:copia-la-nota');
  let s = record(defaultState(), step.id, { score: 90, stars: 3 }, T0).state;
  assert.equal(isDue(s, step, T0 + 3600e3), false);
  assert.equal(isDue(s, step, T0 + DAY), true);
  s = record(s, step.id, { score: 90, stars: 3 }, T0 + DAY).state; // grado 2
  assert.equal(isDue(s, step, T0 + DAY + (REVIEW_DAYS[2] - 1) * DAY), false);
  assert.equal(isDue(s, step, T0 + DAY + REVIEW_DAYS[2] * DAY), true);
  s = record(s, step.id, { score: 20, stars: 0 }, T0 + 3 * DAY).state; // falló el repaso
  assert.equal(gradeOf(s.ex[step.id]), 2);
  assert.equal(isDue(s, step, T0 + 4 * DAY), true);
  assert.deepEqual(dueSteps(s, T0 + 4 * DAY).map((x) => x.id), [step.id]);
});

test('la racha perdona un día de descanso pero no dos', () => {
  let s = defaultState();
  for (const d of [0, 1, 3, 4]) s = record(s, 'tono-1:copia-la-nota', { score: 80, stars: 2 }, T0 + d * DAY).state;
  assert.equal(streak(s, T0 + 4 * DAY), 4);
  assert.equal(streak(s, T0 + 5 * DAY), 4); // hoy aún no practica: sigue viva
  assert.equal(streak(s, T0 + 6 * DAY), 4);
  assert.equal(streak(s, T0 + 7 * DAY), 0);
});

test('niveles crecientes', () => {
  assert.equal(level(0).lvl, 1);
  assert.equal(level(120).lvl, 2);
  assert.ok(level(5000).lvl > 10);
});

test('tope de material nuevo: 2 lecciones al día en la etapa 1', () => {
  let s = defaultState();
  assert.equal(nextLesson(s).id, 'aire-1');
  s = playLesson(s, LESSONS[0]);
  assert.equal(canStart(s, LESSONS[1], T0), true);
  s = playLesson(s, LESSONS[1]);
  assert.equal(canStart(s, LESSONS[2], T0), false);
  assert.equal(canStart(s, LESSONS[2], T0 + DAY), true);
  assert.equal(canStart(s, LESSONS[1], T0), true); // lo ya empezado siempre se puede seguir
  const ses = buildSession(s, 'daily', T0);
  assert.equal(ses.lessons.length, 0);
  assert.equal(ses.waiting.id, LESSONS[2].id);
  assert.ok(!ses.steps.some((x) => x.lesson === LESSONS[2].id));
});

test('aprobar todo en un día NO abre la siguiente etapa: hay que consolidar', () => {
  let s = defaultState();
  for (const l of LESSONS.filter((x) => x.stage === 's1')) s = playLesson(s, l, 100);
  const st = stageStatus(s, 's2');
  assert.equal(st.unlocked, false);
  assert.equal(Math.round(st.gate.grade), 1);
  assert.equal(st.gate.lessons, 5);
  // Repasando en días distintos, sí
  for (const l of LESSONS.filter((x) => x.stage === 's1')) s = playLesson(s, l, 100, T0 + DAY);
  assert.equal(stageStatus(s, 's2').unlocked, true);
  assert.ok(stageGrade(s, 's1') >= 2);
});

test('un puntaje bajo no completa la lección', () => {
  const s = playLesson(defaultState(), LESSONS[1], PASS - 10);
  assert.equal(lessonStatus(s, LESSONS[1]).done, false);
  assert.equal(nextLesson(playLesson(defaultState(), LESSONS[0])).id, 'tono-1');
});

test('objetivo "solo limpio" omite guturales en lecciones y gimnasio', () => {
  let s = defaultState();
  s.profile.goal = 'clean';
  for (let d = 0; d < 3; d++) for (const l of LESSONS) if (l.track !== 'harsh') s = playLesson(s, l, 95, T0 + d * DAY);
  assert.equal(nextLesson(s), null);
  assert.ok(gymAvailable(s).length > 5);
  assert.ok(!gymAvailable(s).some(isHarsh));
});

test('sesión diaria del primer día: calienta, enseña, enfría, y dura unos minutos', () => {
  const ses = buildSession(defaultState(), 'daily', T0);
  assert.equal(ses.steps[0].kind, 'slide');
  assert.ok(ses.steps.some((x) => x.lesson === 'aire-1'));
  assert.ok(ses.steps.some((x) => x.lesson === 'tono-1'), 'el primer día ya se canta, no solo se respira');
  assert.ok(ses.steps[ses.steps.length - 1].id.startsWith('c-'));
  const mins = estimateMinutes(ses.steps);
  assert.ok(mins >= 4 && mins <= 10, `minutos ${mins}`);
  assert.equal(new Set(ses.steps.map((x) => x.id)).size, ses.steps.length);
});

test('sesión rápida: corta', () => {
  const ses = buildSession(defaultState(), 'quick', T0);
  assert.ok(ses.steps.filter(isScored).length <= 2);
  assert.ok(estimateMinutes(ses.steps) <= 3);
});

test('el curso no se acaba en un día: simulación de un alumno perfecto', () => {
  const day1 = simulate(1, 100);
  assert.ok(LESSONS.filter((l) => lessonStatus(day1.state, l).done).length <= 2);
  // Aunque repita la sesión diez veces el mismo día, no avanza más lecciones
  let s = day1.state;
  for (let i = 0; i < 10; i++) {
    const ses = buildSession(s, 'daily', T0 + 3600e3);
    for (const step of ses.steps) s = record(s, step.id, { score: 100, stars: 3 }, T0 + 3600e3).state;
    s.sessions++;
  }
  assert.ok(LESSONS.filter((l) => lessonStatus(s, l).done).length <= 2);
  assert.equal(stageStatus(s, 's2').unlocked, false);

  const week = simulate(7, 100);
  assert.equal(stageStatus(week.state, 's2').unlocked, true);
  assert.equal(stageStatus(week.state, 's3').unlocked, false);

  const two = simulate(14, 100);
  const done14 = LESSONS.filter((l) => lessonStatus(two.state, l).done).length;
  assert.ok(done14 < LESSONS.length, `a los 14 días lleva ${done14} lecciones`);

  // Con constancia sí se termina, y las sesiones nunca se quedan vacías ni se alargan de más
  const long = simulate(75, 100);
  assert.equal(LESSONS.filter((l) => lessonStatus(long.state, l).done).length, LESSONS.length);
  for (const ses of long.log) {
    const m = estimateMinutes(ses.steps);
    assert.ok(ses.steps.filter(isScored).length >= 3, 'sesión con poco contenido');
    assert.ok(m >= 3 && m <= 13, `sesión de ${m} min`);
  }
  // Después de las lecciones sigue habiendo trabajo: gimnasio y repasos
  const last = long.log[long.log.length - 1];
  assert.ok(last.steps.some((x) => x.gym || x.id === RIFF_ID || x.lesson));
  assert.ok(Object.values(long.state.ex).some((r) => r.grade === 5));
});

test('un alumno promedio (70 puntos) avanza, pero más despacio', () => {
  const fast = simulate(30, 100).state;
  const avg = simulate(30, 70).state;
  const count = (s) => LESSONS.filter((l) => lessonStatus(s, l).done).length;
  assert.ok(count(avg) > 5, `promedio: ${count(avg)}`);
  assert.ok(count(avg) <= count(fast));
  assert.ok(Math.max(...Object.values(avg.ex).map((r) => r.grade ?? 0)) <= 2); // 70 no alcanza para grado 3
});

test('si la garganta duele, 24 h sin guturales', () => {
  let s = defaultState();
  for (const l of LESSONS.filter((x) => x.stage === 's1').slice(0, 3)) s = playLesson(s, l);
  s.started = {};
  assert.equal(nextLesson(s).id, 'fry-1');
  s.throat = { status: 'hurt', ts: T0 };
  assert.equal(harshBlocked(s, T0 + 3600e3), 'hurt');
  const ses = buildSession(s, 'daily', T0 + 3600e3);
  assert.ok(!ses.steps.some(isHarsh));
  assert.ok(!ses.lessons.some((l) => l.track === 'harsh'));
  assert.ok(!lessonSession(s, LESSONS.find((l) => l.id === 'fry-1'), T0 + 3600e3).steps.some(isHarsh));
  assert.equal(harshBlocked(s, T0 + 25 * 3600e3), null);
});

test('presupuesto diario de guturales', () => {
  let s = defaultState();
  for (let i = 0; i < 30; i++) s = record(s, 'fry-1:fry-bajito', { score: 80, stars: 2, harshSecs: 10 }, T0).state;
  assert.equal(harshBlocked(s, T0), 'budget');
  assert.equal(harshBlocked(s, T0 + DAY), null);
});

test('la sesión diaria incluye los repasos que tocan, y hay sesión de solo repasos', () => {
  let s = defaultState();
  s = playLesson(s, LESSONS[0], 90);
  s = playLesson(s, LESSONS[1], 90);
  const ses = buildSession(s, 'daily', T0 + DAY);
  assert.ok(ses.reviews >= 2);
  assert.ok(ses.steps.some((x) => x.id === 'tono-1:copia-la-nota'));
  const rev = reviewSession(s, T0 + DAY);
  assert.ok(rev.steps.filter(isScored).length >= 3);
  assert.ok(!rev.steps.some((x) => x.kind === 'card'));
  // Sin nada pendiente, igual ofrece práctica extra
  assert.ok(reviewSession(s, T0).steps.filter(isScored).length >= 2);
});

test('riff del día: estable dentro del día, distinto entre días, y sin grado', () => {
  assert.deepEqual(riffOfDay(20500), riffOfDay(20500));
  const seen = new Set();
  for (let d = 20500; d < 20530; d++) seen.add(JSON.stringify(riffOfDay(d).notes));
  assert.ok(seen.size > 25);
  const r = record(defaultState(), RIFF_ID, { score: 95, stars: 3 }, T0);
  assert.equal(r.state.ex[RIFF_ID].grade, undefined);
  assert.equal(isDue(r.state, stepById(RIFF_ID), T0 + 5 * DAY), false);
});

test('el gimnasio empieza al conocer las escalas y se abre por etapas', () => {
  assert.equal(gymAvailable(defaultState()).length, 0);
  assert.ok(!buildSession(defaultState(), 'daily', T0).steps.some((x) => x.gym));
  const s1 = record(defaultState(), 'tono-2:cinco-notas-menores', { score: 90, stars: 3 }, T0).state;
  assert.ok(gymAvailable(s1).length >= 4);
  assert.ok(gymAvailable(s1).every((g) => g.needs === 's1'));
  assert.ok(GYM.some((g) => g.needs === 's4'));
});

// ───── El progreso guardado sobrevive a las actualizaciones ─────

test('los ids de los ejercicios no dependen del orden dentro de la lección', async () => {
  const { LEGACY_IDS } = await import('../js/content/legacy-ids.js');
  for (const l of LESSONS) {
    assert.equal(new Set(l.steps.map((s) => s.id)).size, l.steps.length, l.id);
    for (const s of l.steps) assert.ok(!/:\d+$/.test(s.id), `${s.id} parece un id por posición`);
  }
  // Toda la tabla de conversión apunta a ejercicios que existen
  for (const [old, now] of Object.entries(LEGACY_IDS)) assert.ok(stepById(now), `${old} → ${now} no existe`);
});

test('ningún ejercicio con progreso guardado desaparece al actualizar la app', async () => {
  const { readFileSync } = await import('node:fs');
  const { WARMUPS, COOLDOWNS } = await import('../js/content/curriculum.js');
  const snapshot = JSON.parse(readFileSync(new URL('./ids.snapshot.json', import.meta.url)));
  const current = new Set([...LESSONS.flatMap((l) => l.steps), ...GYM, ...WARMUPS, ...COOLDOWNS].map((s) => s.id));
  const lost = snapshot.filter((id) => !current.has(id));
  assert.deepEqual(lost, [], 'Estos ids ya no existen: quien tenga progreso en ellos lo perdería. Si renombraste un paso, ponle key con su nombre anterior; si agregaste pasos, añádelos al snapshot.');
});

test('progreso guardado con una versión anterior se convierte sin perder nada', async () => {
  const { migrate } = await import('../js/coach/progress.js');
  // Así se guardaba antes: ejercicios identificados por posición, sin los campos nuevos
  const old = {
    v: 1,
    onboarded: true,
    profile: { goal: 'both', low: 43, high: 66, gate: 0.01 },
    settings: { headphones: true, strict: 0 },
    xp: 240,
    days: { '2026-11-12': { xp: 240, n: 9 } },
    ex: {
      'aire-1:0': { plays: 1, best: 100, last: 100, ts: T0 },
      'aire-1:1': { plays: 1, best: 100, last: 100, ts: T0 },
      'aire-1:2': { plays: 1, best: 100, last: 100, ts: T0 },
      'aire-1:3': { plays: 2, best: 88, last: 88, ts: T0, grade: 1, gradeDay: '2026-11-12', due: T0 + DAY },
      'tono-1:1': { plays: 3, best: 74, last: 60, ts: T0, grade: 1, due: T0 + DAY },
      'w-trino': { plays: 2, best: 95, last: 95, ts: T0 },
    },
    history: [{ ts: T0, id: 'tono-1:1', score: 74 }],
    sessions: 2,
  };
  const s = migrate(old);
  assert.equal(s.v, defaultState().v);
  assert.equal(s.xp, 240);
  assert.equal(s.profile.low, 43);
  assert.equal(s.settings.headphones, true);
  assert.equal(s.ex['aire-1:hilo-de-aire'].best, 88);
  assert.equal(s.ex['tono-1:copia-la-nota'].plays, 3);
  assert.equal(s.ex['w-trino'].best, 95);
  assert.equal(s.ex['aire-1:3'], undefined);
  assert.equal(s.history[0].id, 'tono-1:copia-la-nota');
  // Campos que no existían antes aparecen con su valor inicial
  assert.deepEqual(s.heroes, defaultState().heroes);
  assert.deepEqual(s.songs, {});
  // El curso continúa donde iba: la lección de aire está hecha y la de afinación en curso
  assert.equal(lessonStatus(s, LESSONS[0]).done, true);
  assert.equal(lessonStatus(s, LESSONS[1]).started, true);
  assert.equal(gradeOf(s.ex['tono-1:copia-la-nota']), 1);
  assert.equal(nextLesson(s).id, 'tono-1');
  // Repetir la conversión no cambia nada
  assert.deepEqual(migrate(s), s);
  assert.deepEqual(migrate(JSON.parse(JSON.stringify(s))), s);
});

test('agregar pasos nuevos a una lección no mueve el progreso de los que ya estaban', () => {
  // Simula progreso real y verifica que cada registro siga apuntando al mismo ejercicio por nombre
  let s = defaultState();
  for (const l of LESSONS.slice(0, 3)) for (const st of l.steps) s = record(s, st.id, { score: 90, stars: 3 }, T0).state;
  for (const [id, rec] of Object.entries(s.ex)) {
    const step = stepById(id);
    assert.ok(step, id);
    assert.ok(id.endsWith(`:${step.kind === 'card' ? 'c-' : ''}${step.title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`), id);
    assert.ok(rec.plays >= 1);
  }
});
