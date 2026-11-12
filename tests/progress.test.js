import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, record, streak, level, nextLesson, lessonStatus, stageStatus, harshBlocked, dayKey, PASS } from '../js/coach/progress.js';
import { buildSession, lessonSession, estimateMinutes } from '../js/coach/planner.js';
import { LESSONS, isScored, isHarsh } from '../js/content/curriculum.js';

const DAY = 86400000;
const T0 = new Date(2026, 10, 12, 18, 0).getTime();

function playLesson(state, lesson, score = 80, now = T0) {
  let s = state;
  for (const step of lesson.steps) s = record(s, step.id, { score, stars: 2 }, now).state;
  return s;
}

test('registrar un resultado da XP, marca el día y actualiza el dominio', () => {
  const { state, gained, events } = record(defaultState(), 'tono-1:1', { score: 82, stars: 2, stats: { db: -22 } }, T0);
  assert.ok(gained > 0);
  assert.equal(state.xp, gained);
  assert.ok(state.days[dayKey(T0)]);
  assert.equal(Math.round(state.mastery.pitch), 82);
  assert.equal(state.profile.refDb, -22);
  assert.ok(events.some((e) => e.type === 'ach' && e.ach.id === 'first'));
});

test('dos fallos seguidos activan el modo fácil del ejercicio', () => {
  let s = defaultState();
  s = record(s, 'tono-1:1', { score: 30, stars: 0 }, T0).state;
  const r = record(s, 'tono-1:1', { score: 35, stars: 0 }, T0);
  assert.ok(r.events.some((e) => e.type === 'easier'));
  assert.equal(r.state.ex['tono-1:1'].ease, 1);
});

test('la racha perdona un día de descanso pero no dos', () => {
  let s = defaultState();
  for (const d of [0, 1, 3, 4]) s = record(s, 'tono-1:1', { score: 80, stars: 2 }, T0 + d * DAY).state;
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

test('la ruta avanza: completar lecciones desbloquea la siguiente etapa', () => {
  let s = defaultState();
  assert.equal(nextLesson(s).id, 'aire-1');
  assert.equal(stageStatus(s, 's2').unlocked, false);
  for (const l of LESSONS.filter((x) => x.stage === 's1').slice(0, 3)) s = playLesson(s, l);
  assert.equal(stageStatus(s, 's2').unlocked, true);
  assert.equal(nextLesson(s).id, 'fry-1');
  assert.ok(lessonStatus(s, LESSONS[0]).done);
});

test('un puntaje bajo no completa la lección', () => {
  const s = playLesson(defaultState(), LESSONS[1], PASS - 10);
  assert.equal(lessonStatus(s, LESSONS[1]).done, false);
  assert.equal(nextLesson(playLesson(defaultState(), LESSONS[0])).id, 'tono-1');
});

test('objetivo "solo limpio" omite las lecciones de guturales', () => {
  let s = defaultState();
  s.profile.goal = 'clean';
  for (const l of LESSONS) if (l.track !== 'harsh') s = playLesson(s, l);
  assert.equal(nextLesson(s), null);
});

test('sesión diaria: calienta primero, incluye la lección nueva y enfría al final', () => {
  const ses = buildSession(defaultState(), 'daily', T0);
  assert.equal(ses.steps[0].kind, 'slide');
  assert.ok(ses.steps.some((x) => x.lesson === 'aire-1'));
  assert.ok(ses.steps[ses.steps.length - 1].id.startsWith('c-'));
  const mins = estimateMinutes(ses.steps);
  assert.ok(mins >= 3 && mins <= 10, `minutos ${mins}`);
  assert.equal(new Set(ses.steps.map((x) => x.id)).size, ses.steps.length);
});

test('sesión rápida: máximo un calentamiento y un ejercicio de la lección', () => {
  const ses = buildSession(defaultState(), 'quick', T0);
  assert.ok(ses.steps.filter(isScored).length <= 2);
  assert.ok(estimateMinutes(ses.steps) <= 3);
});

test('si la garganta duele, 24 h sin guturales', () => {
  let s = defaultState();
  for (const l of LESSONS.filter((x) => x.stage === 's1').slice(0, 3)) s = playLesson(s, l);
  assert.equal(nextLesson(s).id, 'fry-1');
  s.throat = { status: 'hurt', ts: T0 };
  assert.equal(harshBlocked(s, T0 + 3600e3), 'hurt');
  const ses = buildSession(s, 'daily', T0 + 3600e3);
  assert.ok(!ses.steps.some(isHarsh));
  assert.notEqual(ses.lesson?.track, 'harsh');
  assert.ok(!lessonSession(s, LESSONS.find((l) => l.id === 'fry-1'), T0 + 3600e3).steps.some(isHarsh));
  assert.equal(harshBlocked(s, T0 + 25 * 3600e3), null);
});

test('presupuesto diario de guturales', () => {
  let s = defaultState();
  for (let i = 0; i < 30; i++) s = record(s, 'fry-1:2', { score: 80, stars: 2, harshSecs: 10 }, T0).state;
  assert.equal(harshBlocked(s, T0), 'budget');
  assert.equal(harshBlocked(s, T0 + DAY), null);
});

test('las sesiones repasan lo más débil cuando hay historial', () => {
  let s = defaultState();
  for (const l of LESSONS.filter((x) => x.stage === 's1')) s = playLesson(s, l, 90);
  s = record(s, 'tono-2:2', { score: 58, stars: 1 }, T0).state;
  s.ex['tono-2:2'].best = 58;
  const ses = buildSession(s, 'daily', T0 + DAY);
  assert.ok(ses.steps.some((x) => x.id === 'tono-2:2'));
});
