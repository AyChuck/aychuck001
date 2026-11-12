import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan } from '../js/coach/plan.js';
import { scoreTake, detectOnsets } from '../js/coach/scoring.js';
import { LESSONS, WARMUPS, COOLDOWNS, GYM, STAGES, stepById, isScored } from '../js/content/curriculum.js';
import { riffOfDay } from '../js/coach/riffs.js';
import { makeFrames, singPlan } from './helpers.js';

const profile = { low: 45, high: 64, refDb: -20 };
const five = stepById('tono-2:cinco-notas-menores');

test('todos los ejercicios generan un plan válido dentro del rango', () => {
  for (const prof of [profile, { low: 52, high: 76 }, { low: 40, high: 52 }]) {
    for (const s of [...LESSONS.flatMap((l) => l.steps), ...WARMUPS, ...COOLDOWNS, ...GYM, riffOfDay(20511)]) for (const grade of [0, 2, 5]) {
      const plan = buildPlan(s, prof, { grade });
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

test('cada grado exige más: margen más fino, más rápido, más largo', () => {
  const g0 = buildPlan(five, profile, { grade: 0 });
  const g4 = buildPlan(five, profile, { grade: 4 });
  assert.ok(g4.tol < g0.tol);
  assert.ok(g4.bpm > g0.bpm);
  assert.ok(g4.segs.length >= g0.segs.length);
  assert.ok(buildPlan(stepById('aire-1:hilo-de-aire'), profile, { grade: 5 }).target >= 24);
  const h0 = buildPlan(stepById('scream-1:sosten-el-scream'), profile, { grade: 0 });
  const h5 = buildPlan(stepById('scream-1:sosten-el-scream'), profile, { grade: 5 });
  assert.ok(h5.dur > h0.dur);
  // Lo que canta bien en grado 0 con 45 cents de error ya no alcanza en grado 5
  const e0 = scoreTake(g0, singPlan(g0, () => -45)).score;
  const g5 = buildPlan(five, profile, { grade: 5 });
  const e5 = scoreTake(g5, singPlan(g5, () => -45)).score;
  assert.ok(e5 < e0 - 15, `${e0} vs ${e5}`);
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
  const sustain = stepById('tono-1:sosten-4-segundos');
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
  const plan = buildPlan(stepById('vibrato-1:nota-con-vibrato'), profile, {});
  const vib = scoreTake(plan, singPlan(plan, (t) => 45 * Math.sin(2 * Math.PI * 5.5 * t)));
  assert.ok(Math.abs(vib.stats.vibRate - 5.5) < 0.8, `rate ${vib.stats.vibRate}`);
  assert.ok(vib.score >= 85, `score ${vib.score}`);
  const flat = scoreTake(plan, singPlan(plan));
  assert.ok(flat.diag.includes('noVibrato'));
  assert.ok(flat.score < 70);
});

test('dinámica: suave pedido y cantado fuerte → "notSoft"', () => {
  const plan = buildPlan(stepById('estilo-1:verso-la-marea'), profile, {});
  const loud = singPlan(plan).map((f) => ({ ...f, db: -15 }));
  const soft = singPlan(plan).map((f) => ({ ...f, db: -28 }));
  assert.ok(scoreTake(plan, loud, { refDb: -20 }).diag.includes('notSoft'));
  assert.ok(scoreTake(plan, soft, { refDb: -20 }).score >= 95);
});

test('sirena: recorrido completo y continuo puntúa alto; quiebres se detectan', () => {
  const plan = buildPlan(stepById('calor-1:trino-de-labios'), profile, {});
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
  const plan = buildPlan(stepById('aire-1:hilo-de-aire'), profile, {});
  const full = scoreTake(plan, makeFrames(plan.dur, (t) => (t > 3.2 && t < 3.2 + 13 ? { kind: 'hiss', db: -30 } : null)));
  assert.ok(full.score >= 95, `score ${full.score}`);
  assert.ok(full.stats.longest >= 12.5);
  const short = scoreTake(plan, makeFrames(plan.dur, (t) => (t > 3.2 && t < 3.2 + 5 ? { kind: 'hiss', db: -30 } : null)));
  assert.ok(short.diag.includes('breathShort'));
  assert.ok(short.score < 55);
});

test('guturales: distorsión en las ventanas, limpio se marca, volumen excesivo se marca', () => {
  const plan = buildPlan(stepById('scream-1:sosten-el-scream'), profile, {});
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
  const plan = buildPlan(stepById('scream-2:tres-colores'), profile, {});
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
  const plan = buildPlan(stepById('trans-1:ida-y-vuelta'), profile, {});
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
  const plan = buildPlan(stepById('ritmo-1:golpes-a-tiempo'), profile, {});
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

test('registros: misma nota con voz llena y ligera; si suenan igual, lo detecta', () => {
  const step = stepById('registro-cambio:interruptor');
  const plan = buildPlan(step, profile, {});
  assert.equal(plan.reg, true);
  const sing = plan.notes.filter((n) => n.seg === 'sing');
  assert.ok(sing.every((n) => n.reg && n.midi === sing.find((x) => x.rep === n.rep).midi), 'en cada repetición, todas las notas a la misma altura');
  assert.ok(sing[0].midi >= profile.low + 9 && sing[0].midi <= profile.high - 3, 'en la zona media, donde caben las dos voces');
  const take = (wOf) => singPlan(plan).map((f) => {
    const n = sing.find((x) => f.t >= x.t0 && f.t < x.t1);
    return { ...f, weight: n ? wOf(n.reg) : null };
  });
  const good = scoreTake(plan, take((r) => (r === 'chest' ? 6 : -8)));
  assert.ok(good.score >= 95, `score ${good.score}`);
  assert.ok(good.stats.regDiff > 10);
  const same = scoreTake(plan, take(() => 5));
  assert.ok(same.diag.includes('regSame'));
  assert.ok(same.score < 55, `score ${same.score}`);
  assert.equal(same.tips[0].code, 'regSame');
  const flipped = scoreTake(plan, take((r) => (r === 'chest' ? -8 : 6)));
  assert.ok(flipped.diag.includes('regFlip'));
  const noData = scoreTake(plan, singPlan(plan));
  assert.ok(noData.diag.includes('regUnknown'));
});

test('mezcla: debe quedar entre tu voz llena y tu voz ligera', () => {
  const plan = buildPlan(stepById('registro-2:tres-voces-una-nota'), profile, {});
  const sing = plan.notes.filter((n) => n.seg === 'sing');
  assert.ok(sing.some((n) => n.reg === 'mix'));
  const take = (mix) => singPlan(plan).map((f) => {
    const n = sing.find((x) => f.t >= x.t0 && f.t < x.t1);
    return { ...f, weight: n ? { chest: 7, head: -7, mix }[n.reg] : null };
  });
  assert.ok(scoreTake(plan, take(2)).score >= 95);
  const light = scoreTake(plan, take(-6.5));
  assert.ok(light.diag.includes('mixLight'));
  const heavy = scoreTake(plan, take(8));
  assert.ok(heavy.diag.includes('mixHeavy'));
  assert.ok(heavy.score < 90 && light.score < 90);
});

test('cruce sin escalón: un cambio brusco de peso se marca', () => {
  const plan = buildPlan(stepById('registro-3:sirena-sin-escalon'), profile, {});
  assert.equal(plan.connect, true);
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
  const mid = (plan.slide.lo + plan.slide.hi) / 2;
  const frames = (wOf) => makeFrames(plan.dur, (t) => (path(t) == null ? null : { midi: path(t) })).map((f) => ({ ...f, weight: f.voiced ? wOf(f.midi) : null }));
  // Peso que baja poco a poco al subir: bien
  const smooth = scoreTake(plan, frames((m) => 8 - ((m - plan.slide.lo) / (plan.slide.hi - plan.slide.lo)) * 16));
  assert.ok(smooth.score >= 92, `score ${smooth.score}`);
  assert.ok(!smooth.diag.includes('regStep'));
  // Peso que cae de golpe a media sirena: escalón
  const step = scoreTake(plan, frames((m) => (m < mid ? 8 : -8)));
  assert.ok(step.diag.includes('regStep'), step.diag.join());
  assert.ok(step.stats.stepNote);
  assert.ok(step.score < smooth.score - 10);
});
