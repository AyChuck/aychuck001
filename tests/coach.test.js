import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan } from '../js/coach/plan.js';
import { scoreTake, detectOnsets } from '../js/coach/scoring.js';
import { LESSONS, WARMUPS, COOLDOWNS, STAGES, stepById, isScored } from '../js/content/curriculum.js';
import { makeFrames, singPlan } from './helpers.js';

const profile = { low: 45, high: 64, refDb: -20 };
const five = stepById('tono-2:1');

test('todos los ejercicios generan un plan válido dentro del rango', () => {
  for (const prof of [profile, { low: 52, high: 76 }, { low: 40, high: 52 }]) {
    for (const s of [...LESSONS.flatMap((l) => l.steps), ...WARMUPS, ...COOLDOWNS]) {
      const plan = buildPlan(s, prof, {});
      if (s.kind === 'card') continue;
      assert.ok(plan.dur > 0 && plan.dur < 120, `${s.id}: duración ${plan.dur}`);
      if (plan.view === 'pitch') {
        assert.ok(plan.segs.some((x) => x.type === 'sing'), `${s.id}: sin tramo para cantar`);
        for (const n of plan.notes) {
          assert.ok(n.t1 > n.t0, `${s.id}: nota sin duración`);
          if (prof.high - prof.low >= 19) {
            assert.ok(n.midi >= prof.low - 0.01 && n.midi <= prof.high + (s.stretch ?? 0) + 0.01, `${s.id}: nota ${n.midi} fuera de ${prof.low}-${prof.high}`);
          }
        }
      }
    }
  }
});

test('cada lección pertenece a una etapa y tiene al menos un ejercicio calificado', () => {
  const ids = new Set(STAGES.map((s) => s.id));
  for (const l of LESSONS) {
    assert.ok(ids.has(l.stage), l.id);
    assert.ok(l.steps.some(isScored), l.id);
  }
});

test('cantar perfecto da 3 estrellas', () => {
  const plan = buildPlan(five, profile, {});
  const r = scoreTake(plan, singPlan(plan), { refDb: -20 });
  assert.ok(r.score >= 95, `score ${r.score}`);
  assert.equal(r.stars, 3);
  assert.equal(r.tips[0].code, 'great');
});

test('quedarse 40 cents bajo se detecta como "flat" y baja poco el puntaje', () => {
  const plan = buildPlan(five, profile, {});
  const r = scoreTake(plan, singPlan(plan, () => -40));
  assert.ok(r.diag.includes('flat'));
  assert.ok(r.score > 85);
  const far = scoreTake(plan, singPlan(plan, () => -90));
  assert.ok(far.score < 60, `score ${far.score}`);
});

test('pasarse de tono se detecta como "sharp"', () => {
  const plan = buildPlan(five, profile, {});
  assert.ok(scoreTake(plan, singPlan(plan, () => 45)).diag.includes('sharp'));
});

test('silencio = sin voz y 0 puntos', () => {
  const plan = buildPlan(five, profile, {});
  const r = scoreTake(plan, makeFrames(plan.dur, () => null));
  assert.equal(r.score, 0);
  assert.equal(r.tips[0].code, 'noVoice');
});

test('cantar una octava abajo se reconoce y se acredita en parte', () => {
  const plan = buildPlan(five, profile, {});
  const r = scoreTake(plan, singPlan(plan, () => -1200));
  assert.ok(r.diag.includes('octaveLow'));
  assert.ok(r.score >= 70 && r.score <= 78);
});

test('la latencia del micrófono no castiga', () => {
  const plan = buildPlan(five, profile, {});
  const frames = singPlan(plan).map((f) => ({ ...f, t: f.t + 0.15 }));
  assert.ok(scoreTake(plan, frames).score >= 90);
});

test('nota temblorosa → "unstable"; caída al final → "dropEnd"; arrastre → "scoop"', () => {
  const sustain = stepById('tono-1:2');
  const plan = buildPlan(sustain, profile, {});
  let k = 0;
  const wob = scoreTake(plan, singPlan(plan, () => ((k++ * 37) % 160) - 80));
  assert.ok(wob.diag.includes('unstable'), wob.diag.join());
  const drop = scoreTake(plan, singPlan(plan, (t, n) => ((t - n.t0) / (n.t1 - n.t0) > 0.78 ? -70 : 0)));
  assert.ok(drop.diag.includes('dropEnd'), drop.diag.join());
  const scoop = scoreTake(plan, singPlan(plan, (t, n) => ((t - n.t0) / (n.t1 - n.t0) < 0.22 ? -120 : 0)));
  assert.ok(scoop.diag.includes('scoop'), scoop.diag.join());
});

test('fallar solo las notas altas → "highMiss"', () => {
  const plan = buildPlan(five, profile, {});
  const top = Math.max(...plan.notes.map((n) => n.midi));
  const r = scoreTake(plan, singPlan(plan, (t, n) => (n.midi >= top - 4 ? -150 : 0)));
  assert.ok(r.diag.includes('highMiss'), r.diag.join());
});

test('vibrato: detecta ~5.5 Hz y distingue una nota recta', () => {
  const plan = buildPlan(stepById('vibrato-1:1'), profile, {});
  const vib = scoreTake(plan, singPlan(plan, (t) => 45 * Math.sin(2 * Math.PI * 5.5 * t)));
  assert.ok(Math.abs(vib.stats.vibRate - 5.5) < 0.8, `rate ${vib.stats.vibRate}`);
  assert.ok(vib.score >= 85, `score ${vib.score}`);
  const flat = scoreTake(plan, singPlan(plan));
  assert.ok(flat.diag.includes('noVibrato'));
  assert.ok(flat.score < 70);
});

test('dinámica: suave pedido y cantado fuerte → "notSoft"', () => {
  const plan = buildPlan(stepById('estilo-1:1'), profile, {});
  const loud = singPlan(plan).map((f) => ({ ...f, db: -15 }));
  const soft = singPlan(plan).map((f) => ({ ...f, db: -28 }));
  assert.ok(scoreTake(plan, loud, { refDb: -20 }).diag.includes('notSoft'));
  assert.ok(scoreTake(plan, soft, { refDb: -20 }).score >= 95);
});

test('sirena: recorrido completo y continuo puntúa alto; quiebres se detectan', () => {
  const plan = buildPlan(stepById('calor-1:1'), profile, {});
  const path = (t) => {
    const p = plan.paths.find((x) => t >= x.t0 && t < x.t1);
    if (!p) return null;
    for (let i = 0; i < p.pts.length - 1; i++) {
      const [ta, ma] = p.pts[i];
      const [tb, mb] = p.pts[i + 1];
      if (t >= ta && t <= tb) return ma + ((mb - ma) * (t - ta)) / (tb - ta);
    }
    return null;
  };
  const good = scoreTake(plan, makeFrames(plan.dur, (t) => (path(t) == null ? null : { midi: path(t) })));
  assert.ok(good.score >= 92, `score ${good.score}`);
  const broken = scoreTake(plan, makeFrames(plan.dur, (t) => {
    const m = path(t);
    if (m == null) return null;
    return { midi: m > 52 ? m + 5 : m };
  }));
  assert.ok(broken.diag.includes('breaks'), broken.diag.join());
  assert.ok(broken.stats.breakNote);
  const half = scoreTake(plan, makeFrames(plan.dur, (t) => (path(t) == null ? null : { midi: Math.min(path(t), plan.slide.lo + 3) })));
  assert.ok(half.diag.includes('shortHigh'));
});

test('aire: duración y estabilidad', () => {
  const plan = buildPlan(stepById('aire-1:3'), profile, {});
  const full = scoreTake(plan, makeFrames(plan.dur, (t) => (t > 3.2 && t < 3.2 + 13 ? { kind: 'hiss', db: -30 } : null)));
  assert.ok(full.score >= 95, `score ${full.score}`);
  assert.ok(full.stats.longest >= 12.5);
  const short = scoreTake(plan, makeFrames(plan.dur, (t) => (t > 3.2 && t < 3.2 + 5 ? { kind: 'hiss', db: -30 } : null)));
  assert.ok(short.diag.includes('breathShort'));
  assert.ok(short.score < 55);
});

test('guturales: distorsión en las ventanas, limpio se marca, volumen excesivo se marca', () => {
  const plan = buildPlan(stepById('scream-1:2'), profile, {});
  const inHarsh = (t) => plan.windows.some((w) => w.expect === 'harsh' && t >= w.t0 && t < w.t1);
  const good = scoreTake(plan, makeFrames(plan.dur, (t) => (inHarsh(t) ? { kind: 'harsh', db: -18 } : null)), { refDb: -20 });
  assert.ok(good.score >= 95, `score ${good.score}`);
  const clean = scoreTake(plan, makeFrames(plan.dur, (t) => (inHarsh(t) ? { midi: 50 } : null)), { refDb: -20 });
  assert.ok(clean.diag.includes('tooClean'));
  assert.ok(clean.score < 30);
  const loud = scoreTake(plan, makeFrames(plan.dur, (t) => (inHarsh(t) ? { kind: 'harsh', db: -4 } : null)), { refDb: -20 });
  assert.ok(loud.diag.includes('tooLoud'));
  assert.ok(loud.score < good.score);
});

test('colores del scream: el orden grave < medio < agudo se evalúa por centroide', () => {
  const plan = buildPlan(stepById('scream-2:1'), profile, {});
  const hs = plan.windows.filter((w) => w.expect === 'harsh');
  const frames = (cents) => makeFrames(plan.dur, (t) => {
    const i = hs.findIndex((w) => t >= w.t0 && t < w.t1);
    return i < 0 ? null : { kind: 'harsh', centroid: cents[i] };
  });
  assert.ok(scoreTake(plan, frames([900, 1400, 2200])).score >= 95);
  const same = scoreTake(plan, frames([1400, 1400, 1400]));
  assert.ok(same.diag.includes('placeSame'));
});

test('transición limpio/scream', () => {
  const plan = buildPlan(stepById('trans-1:1'), profile, {});
  const frames = makeFrames(plan.dur, (t) => {
    const w = plan.windows.find((x) => t >= x.t0 && t < x.t1);
    if (!w || w.expect === 'rest') return null;
    return w.expect === 'clean' ? { midi: 52 } : { kind: 'harsh' };
  });
  assert.ok(scoreTake(plan, frames).score >= 95);
  const allHarsh = makeFrames(plan.dur, (t) => (t > 1.5 ? { kind: 'harsh' } : null));
  assert.ok(scoreTake(plan, allHarsh).diag.includes('cleanDirty'));
});

test('ritmo: golpes a tiempo, con retraso constante, y desordenados', () => {
  const plan = buildPlan(stepById('ritmo-1:1'), profile, {});
  const hits = plan.hits.filter((h) => h.seg === 'sing');
  const tap = (offs) => makeFrames(plan.dur, (t) => {
    const i = hits.findIndex((h, k) => t >= h.t + offs(k) && t < h.t + offs(k) + 0.12);
    return i < 0 ? null : { kind: 'harsh', rms: 0.2 };
  }, 100);
  assert.equal(detectOnsets(tap(() => 0)).length, hits.length);
  assert.ok(scoreTake(plan, tap(() => 0)).score >= 92);
  // Un retraso constante (latencia) no debe castigar
  assert.ok(scoreTake(plan, tap(() => 0.12)).score >= 90);
  const sloppy = scoreTake(plan, tap((k) => (k % 2 ? 0.17 : -0.1)));
  assert.ok(sloppy.score < 70, `score ${sloppy.score}`);
  const none = scoreTake(plan, makeFrames(plan.dur, () => null));
  assert.equal(none.score, 0);
});
