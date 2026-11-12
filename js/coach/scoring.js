// Calificación de una toma + diagnóstico (qué salió mal y cómo arreglarlo).
// Funciones puras sobre "cuadros" de análisis:
//   { t, midi, voiced, clarity, rms, db, centroid, kind }

import { midiName } from '../music/notes.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const std = (a) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(mean(a.map((v) => (v - m) ** 2)));
};
const median = (a) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};
const pct = (a, p) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[clamp(Math.round((s.length - 1) * p), 0, s.length - 1)];
};

export const starsFor = (score) => (score >= 90 ? 3 : score >= 75 ? 2 : score >= 60 ? 1 : 0);

/**
 * Puntaje suave por cuadro: 1 en la mitad central de la tolerancia, baja hasta 0.85
 * en el borde (para que afinar mejor sí se note) y cae a 0 a 2.5x la tolerancia.
 */
const soft = (errCents, tol) => {
  const e = Math.abs(errCents);
  const half = tol / 2;
  if (e <= half) return 1;
  if (e <= tol) return 1 - 0.15 * ((e - half) / half);
  return 0.85 * Math.max(0, 1 - (e - tol) / (1.5 * tol));
};

export function scoreTake(plan, frames, ctx = {}) {
  let res;
  if (plan.view === 'pitch') res = plan.slide ? scoreSlide(plan, frames) : scorePitch(plan, frames, ctx);
  else if (plan.rhythm) res = scoreRhythm(plan, frames, ctx);
  else if (plan.endOnSilence) res = scoreBreath(plan, frames);
  else res = scoreWindows(plan, frames, ctx);
  res.score = Math.round(clamp(res.score, 0, 100));
  res.stars = starsFor(res.score);
  res.tips = pickTips(res.diag, res.stats);
  return res;
}

// ───────────────────────── Tono ─────────────────────────

function noteScores(notes, frames, tol, shift, fold) {
  const out = [];
  for (const n of notes) {
    const dur = n.t1 - n.t0;
    const grace = Math.min(0.12, dur * 0.3);
    const errs = [];
    const times = [];
    let total = 0;
    let sum = 0;
    let firstVoiced = null;
    for (const f of frames) {
      const t = f.t - shift;
      if (t < n.t0 || t >= n.t1) continue;
      if (f.voiced && firstVoiced === null) firstVoiced = t - n.t0;
      if (t < n.t0 + grace) continue;
      total++;
      if (!f.voiced) continue;
      const err = (f.midi + fold - n.midi) * 100;
      errs.push(err);
      times.push((t - n.t0) / dur);
      sum += soft(err, tol);
    }
    out.push({ note: n, score: total ? sum / total : 0, errs, times, total, firstVoiced, dur });
  }
  return out;
}

function scorePitch(plan, frames, ctx) {
  const notes = plan.notes.filter((n) => n.seg === 'sing');
  const tol = plan.tol;
  const diag = [];

  // ¿Canta una octava arriba/abajo de forma consistente?
  const rawErr = [];
  for (const n of notes) {
    for (const f of frames) if (f.voiced && f.t >= n.t0 && f.t < n.t1) rawErr.push(f.midi - n.midi);
  }
  const med = median(rawErr);
  let fold = 0;
  if (rawErr.length > 8 && med < -9.5 && med > -14.5) fold = 12;
  if (rawErr.length > 8 && med > 9.5 && med < 14.5) fold = -12;

  // Compensación de latencia: probamos pequeños desfases y nos quedamos con el mejor.
  let best = null;
  for (const shift of [0, 0.08, 0.16, 0.24]) {
    const ns = noteScores(notes, frames, tol, shift, fold);
    const w = ns.reduce((s, x) => s + x.dur, 0) || 1;
    const sc = ns.reduce((s, x) => s + x.score * x.dur, 0) / w;
    if (!best || sc > best.sc + 0.01) best = { sc, ns, shift };
  }
  const ns = best.ns;
  let score = best.sc * 100;

  const allErr = ns.flatMap((x) => x.errs);
  const near = allErr.filter((e) => Math.abs(e) < 300);
  const total = ns.reduce((s, x) => s + x.total, 0) || 1;
  const voicedFrac = allErr.length / total;
  const bias = mean(near);
  const longNotes = ns.filter((x) => x.dur >= 0.5 && x.errs.length >= 6);
  const wobble = mean(longNotes.map((x) => std(x.errs.filter((e) => Math.abs(e) < 300))));

  if (voicedFrac < 0.25) diag.push('noVoice');
  else {
    if (fold === 12) diag.push('octaveLow');
    if (fold === -12) diag.push('octaveHigh');
    if (bias < -18) diag.push('flat');
    if (bias > 18) diag.push('sharp');
    if (!plan.vibrato && wobble > 27) diag.push('unstable');

    // Entradas arrastradas desde abajo (scoop)
    const sc = longNotes.filter((x) => {
      const head = x.errs.filter((_, i) => x.times[i] < 0.25);
      const tail = x.errs.filter((_, i) => x.times[i] > 0.4);
      return head.length > 1 && tail.length > 2 && mean(head) < -45 && Math.abs(mean(tail)) < 35;
    });
    if (longNotes.length && sc.length / longNotes.length >= 0.4) diag.push('scoop');

    // Nota que se cae al final (falta de aire)
    const dr = ns.filter((x) => {
      if (x.dur < 1.5) return false;
      const mid = x.errs.filter((_, i) => x.times[i] > 0.3 && x.times[i] < 0.7);
      const end = x.errs.filter((_, i) => x.times[i] > 0.8);
      return mid.length > 2 && end.length > 2 && Math.abs(mean(mid)) < 35 && mean(end) < -35;
    });
    if (dr.length) diag.push('dropEnd');

    // ¿Falla solo arriba o solo abajo?
    if (ns.length >= 4) {
      const sorted = [...ns].sort((a, b) => a.note.midi - b.note.midi);
      const third = Math.max(1, Math.floor(sorted.length / 3));
      const lowS = mean(sorted.slice(0, third).map((x) => x.score));
      const highS = mean(sorted.slice(-third).map((x) => x.score));
      if (sorted[sorted.length - 1].note.midi - sorted[0].note.midi >= 3) {
        if (highS < 0.5 && lowS > 0.7) diag.push('highMiss');
        if (lowS < 0.5 && highS > 0.7) diag.push('lowMiss');
      }
    }

    const lates = ns.filter((x) => x.dur >= 0.6 && x.firstVoiced !== null).map((x) => x.firstVoiced - best.shift);
    if (lates.length >= 2 && mean(lates) > 0.35) diag.push('late');
  }

  if (fold !== 0) score = Math.min(score, 78);

  const stats = { bias: Math.round(bias), wobble: Math.round(wobble), voicedFrac, tol };
  const parts = [{ label: 'Afinación', value: Math.round(score) }];

  // Dinámica (suave / fuerte) respecto al volumen normal de la persona
  const sung = [];
  for (const n of notes) for (const f of frames) if (f.voiced && f.t >= n.t0 && f.t < n.t1) sung.push(f.db);
  stats.db = sung.length ? mean(sung) : null;
  if (plan.dyn && ctx.refDb != null && sung.length > 5) {
    const ok = sung.filter((d) => (plan.dyn === 'soft' ? d <= ctx.refDb - 3 : d >= ctx.refDb + 1.5)).length / sung.length;
    parts.push({ label: plan.dyn === 'soft' ? 'Suavidad' : 'Potencia', value: Math.round(ok * 100) });
    score = score * 0.75 + ok * 25;
    if (ok < 0.5) diag.push(plan.dyn === 'soft' ? 'notSoft' : 'notLoud');
  }

  // Vibrato
  if (plan.vibrato && longNotes.length) {
    const v = longNotes.map((x) => vibrato(x)).filter(Boolean);
    const good = v.filter((r) => r.rate >= 4 && r.rate <= 7.8 && r.extent >= 25 && r.extent <= 240);
    const frac = v.length ? good.length / v.length : 0;
    stats.vibRate = v.length ? +mean(v.map((r) => r.rate)).toFixed(1) : 0;
    stats.vibExtent = v.length ? Math.round(mean(v.map((r) => r.extent))) : 0;
    parts.push({ label: 'Vibrato', value: Math.round(frac * 100) });
    score = score * 0.6 + frac * 40;
    if (frac < 0.5) {
      if (stats.vibExtent < 25) diag.push('noVibrato');
      else if (stats.vibRate > 7.8) diag.push('vibFast');
      else if (stats.vibRate < 4) diag.push('vibSlow');
      else diag.push('vibWide');
    }
  }

  if (score >= 90 && !diag.length) diag.push('great');
  return { score, diag, stats, parts, notes: ns.map((x) => ({ score: x.score, t0: x.note.t0, t1: x.note.t1, midi: x.note.midi })) };
}

/** Vibrato sobre la segunda mitad de una nota larga: frecuencia (Hz) y amplitud pico a pico (cents). */
function vibrato(x) {
  const idx = x.times.map((t, i) => (t > 0.45 ? i : -1)).filter((i) => i >= 0);
  if (idx.length < 12) return null;
  const c = idx.map((i) => x.errs[i]);
  const secs = (x.times[idx[idx.length - 1]] - x.times[idx[0]]) * x.dur;
  if (secs < 0.6) return null;
  const m = mean(c);
  const d = c.map((v) => v - m);
  let crossings = 0;
  let sign = 0;
  for (const v of d) {
    const s = v > 6 ? 1 : v < -6 ? -1 : 0;
    if (s !== 0 && s !== sign) {
      if (sign !== 0) crossings++;
      sign = s;
    }
  }
  return { rate: crossings / 2 / secs, extent: 2 * Math.SQRT2 * std(d) };
}

function scoreSlide(plan, frames) {
  const diag = [];
  let total = 0;
  let voiced = 0;
  let breaks = 0;
  const breakAt = [];
  const mids = [];
  for (const s of plan.segs) {
    let prev = null;
    for (const f of frames) {
      if (f.t < s.t0 || f.t >= s.t1) continue;
      total++;
      if (!f.voiced) continue;
      voiced++;
      mids.push(f.midi);
      if (prev && f.t - prev.t < 0.12 && Math.abs(f.midi - prev.midi) > 2.5) {
        breaks++;
        breakAt.push((f.midi + prev.midi) / 2);
      }
      prev = f;
    }
  }
  const cont = total ? voiced / total : 0;
  const top = pct(mids, 0.97);
  const bottom = pct(mids, 0.03);
  const { lo, hi } = plan.slide;
  const reachHi = mids.length ? clamp(1 - Math.max(0, hi - top - 0.7) / 4, 0, 1) : 0;
  const reachLo = mids.length ? clamp(1 - Math.max(0, bottom - lo - 0.7) / 4, 0, 1) : 0;
  const reach = (reachHi + reachLo) / 2;
  const smooth = clamp(1 - breaks / (2 * plan.segs.length + 1), 0, 1);
  const score = 100 * (0.45 * reach + 0.4 * Math.min(1, cont / 0.8) + 0.15 * smooth);

  if (cont < 0.25) diag.push('noVoice');
  else {
    if (breaks >= plan.segs.length) diag.push('breaks');
    if (reachHi < 0.6) diag.push('shortHigh');
    if (reachLo < 0.6) diag.push('shortLow');
    if (cont < 0.6) diag.push('gaps');
    if (score >= 90 && !diag.length) diag.push('great');
  }
  return {
    score,
    diag,
    stats: { top, bottom, breaks, breakNote: breakAt.length ? midiName(median(breakAt)) : null },
    parts: [
      { label: 'Recorrido', value: Math.round(reach * 100) },
      { label: 'Continuidad', value: Math.round(Math.min(1, cont / 0.8) * 100) },
      { label: 'Sin quiebres', value: Math.round(smooth * 100) },
    ],
  };
}

// ───────────────────────── Energía ─────────────────────────

function scoreBreath(plan, frames) {
  const w = plan.windows.find((x) => x.expect === 'hiss');
  const fs = frames.filter((f) => f.t >= w.t0 && f.t < w.t1);
  // Tramo sonoro continuo más largo (se toleran huecos de 0.3 s)
  let best = { len: 0, dbs: [] };
  let cur = null;
  let lastSound = -1;
  for (const f of fs) {
    if (f.kind !== 'silence') {
      if (!cur || f.t - lastSound > 0.3) cur = { start: f.t, dbs: [] };
      cur.dbs.push(f.db);
      lastSound = f.t;
      const len = f.t - cur.start;
      if (len > best.len) best = { len, dbs: cur.dbs };
    }
  }
  const steady = best.dbs.length > 5 ? clamp(1 - (std(best.dbs) - 2) / 6, 0, 1) : 0;
  const ratio = Math.min(1, best.len / plan.target);
  const score = 100 * (0.75 * ratio + 0.25 * steady * Math.min(1, ratio * 1.5));
  const diag = [];
  if (best.len < 1) diag.push('noSound');
  else {
    if (ratio < 0.7) diag.push('breathShort');
    if (steady < 0.5) diag.push('breathUnsteady');
    if (score >= 90 && !diag.length) diag.push('great');
  }
  return {
    score,
    diag,
    stats: { longest: +best.len.toFixed(1), target: plan.target },
    parts: [
      { label: `Duración (${best.len.toFixed(1)} s)`, value: Math.round(ratio * 100) },
      { label: 'Aire parejo', value: Math.round(steady * 100) },
    ],
  };
}

function scoreWindows(plan, frames, ctx) {
  const diag = [];
  const wins = plan.windows.filter((w) => w.expect === 'harsh' || w.expect === 'clean');
  const scores = [];
  const cents = [];
  const harshDb = [];
  let harshN = 0;
  let cleanInHarsh = 0;
  let silentInHarsh = 0;
  let harshInClean = 0;
  let nHarshFrames = 0;
  let nCleanFrames = 0;
  for (const w of wins) {
    const fs = frames.filter((f) => f.t >= w.t0 + Math.min(0.25, (w.t1 - w.t0) * 0.2) && f.t < w.t1);
    if (!fs.length) {
      scores.push(0);
      continue;
    }
    const frac = (k) => fs.filter((f) => f.kind === k).length / fs.length;
    if (w.expect === 'harsh') {
      const h = frac('harsh');
      scores.push(Math.min(1, h / 0.75));
      nHarshFrames += fs.length;
      cleanInHarsh += frac('clean') * fs.length;
      silentInHarsh += frac('silence') * fs.length;
      const hs = fs.filter((f) => f.kind === 'harsh');
      harshN += hs.length;
      for (const f of hs) harshDb.push(f.db);
      cents.push(hs.length > 3 ? mean(hs.map((f) => f.centroid)) : null);
    } else {
      scores.push(Math.min(1, frac('clean') / 0.7));
      nCleanFrames += fs.length;
      harshInClean += frac('harsh') * fs.length;
    }
  }
  let score = mean(scores) * 100;
  const parts = [{ label: wins.some((w) => w.expect === 'clean') ? 'Cambios de voz' : 'Distorsión sostenida', value: Math.round(score) }];
  const stats = { db: harshDb.length ? mean(harshDb) : null, harshSecs: 0 };

  if (nHarshFrames && silentInHarsh / nHarshFrames > 0.6) diag.push('noSound');
  else if (nHarshFrames && cleanInHarsh / nHarshFrames > 0.45) diag.push('tooClean');
  else if (nHarshFrames && harshN / nHarshFrames < 0.6) diag.push('harshShort');
  if (nCleanFrames && harshInClean / nCleanFrames > 0.45) diag.push('cleanDirty');

  // Control de volumen: un scream eficiente no necesita más volumen que tu voz cantada.
  if (ctx.refDb != null && stats.db != null) {
    const over = stats.db - ctx.refDb;
    const limit = plan.quiet ? 1 : 9;
    const vol = clamp(1 - (over - limit) / 8, 0, 1);
    parts.push({ label: 'Control de volumen', value: Math.round(vol * 100) });
    score = score * (0.8 + 0.2 * vol);
    if (vol < 0.6) diag.push(plan.quiet ? 'fryLoud' : 'tooLoud');
  }

  // Colocación: los centroides deben ir en el orden pedido (grave < medio < agudo)
  if (plan.place) {
    const order = { low: 0, mid: 1, high: 2 };
    const pairs = plan.place.map((p, i) => [order[p], cents[i]]).filter((p) => p[1] != null);
    let ok = 0;
    let n = 0;
    for (let i = 0; i < pairs.length; i++) {
      for (let j = i + 1; j < pairs.length; j++) {
        if (pairs[i][0] === pairs[j][0]) continue;
        n++;
        const up = pairs[j][0] > pairs[i][0];
        if (up === pairs[j][1] > pairs[i][1] * 1.04) ok++;
      }
    }
    const pl = n ? ok / n : 0;
    parts.push({ label: 'Colocación', value: Math.round(pl * 100) });
    score = score * 0.6 + pl * 40;
    if (pl < 0.6) diag.push('placeSame');
    stats.centroids = cents.map((c) => (c ? Math.round(c) : null));
  }

  if (score >= 90 && !diag.length) diag.push('great');
  return { score, diag, stats, parts };
}

/** Ataques (inicios de sílaba) a partir de la envolvente de volumen. */
export function detectOnsets(frames) {
  if (!frames.length) return [];
  const peak = pct(frames.map((f) => f.rms), 0.95);
  const thr = Math.max(peak * 0.3, 1e-4);
  const onsets = [];
  let quietSince = frames[0].t - 1;
  let loud = false;
  for (const f of frames) {
    if (f.kind === 'silence' || f.rms < thr * 0.55) {
      if (loud) quietSince = f.t;
      loud = false;
    } else if (f.rms >= thr && !loud) {
      if (f.t - quietSince >= 0.04 || onsets.length === 0) onsets.push(f.t);
      loud = true;
    }
  }
  return onsets;
}

function scoreRhythm(plan, frames) {
  const hits = plan.hits.filter((h) => h.seg === 'sing');
  const wins = plan.windows.filter((w) => w.expect === 'onsets');
  const fs = frames.filter((f) => wins.some((w) => f.t >= w.t0 - 0.15 && f.t < w.t1 + 0.3));
  const onsets = detectOnsets(fs);
  const diag = [];
  // Empareja cada golpe esperado con el ataque más cercano
  const used = new Set();
  const offs = [];
  let matched = 0;
  for (const h of hits) {
    let bi = -1;
    let bd = 0.22;
    onsets.forEach((o, i) => {
      const d = Math.abs(o - h.t - 0.05);
      if (!used.has(i) && d < bd) {
        bd = d;
        bi = i;
      }
    });
    if (bi >= 0) {
      used.add(bi);
      offs.push(onsets[bi] - h.t);
      matched++;
    }
  }
  const medOff = median(offs);
  const resid = offs.map((o) => Math.abs(o - medOff));
  const timing = resid.length ? mean(resid.map((r) => clamp(1 - (r - 0.045) / 0.11, 0, 1))) : 0;
  const hitFrac = hits.length ? matched / hits.length : 0;
  const extra = Math.max(0, onsets.length - matched);
  const clean = clamp(1 - extra / Math.max(2, hits.length), 0, 1);
  const score = 100 * hitFrac * (0.65 * timing + 0.35) * (0.8 + 0.2 * clean);

  if (onsets.length === 0) diag.push('noSound');
  else {
    if (hitFrac < 0.7) diag.push('missedHits');
    if (timing < 0.6 && hitFrac >= 0.5) diag.push('timingLoose');
    if (extra > hits.length * 0.4) diag.push('extraHits');
    if (score >= 90 && !diag.length) diag.push('great');
  }
  return {
    score,
    diag,
    stats: { matched, expected: hits.length, spread: Math.round(mean(resid) * 1000) },
    parts: [
      { label: `Golpes (${matched}/${hits.length})`, value: Math.round(hitFrac * 100) },
      { label: 'Precisión', value: Math.round(timing * 100) },
    ],
  };
}

// ───────────────────────── Consejos ─────────────────────────

const TIPS = {
  noVoice: ['No te escuché', 'Acércate al micrófono (un palmo) y canta con volumen de conversación animada. Si sigue igual, recalibra el micro en Ajustes.'],
  noSound: ['No detecté sonido', 'Acércate al micrófono y empieza en cuanto veas la señal.'],
  octaveLow: ['Vas una octava abajo', 'La melodía es la correcta, pero más grave. Escucha la guía y busca la versión "de arriba" de la misma nota.'],
  octaveHigh: ['Vas una octava arriba', 'Estás cantando la versión aguda. Prueba la misma nota más abajo, relajada.'],
  flat: ['Te quedas bajo de tono', 'Falta aire en movimiento. Antes de cada nota inhala bajo (panza) y piensa que caes sobre la nota desde arriba. Levanta las cejas y el paladar como al bostezar.'],
  sharp: ['Te pasas de tono', 'Estás empujando de más. Baja el volumen un 30 % y deja que la nota suene sin apretar el cuello.'],
  unstable: ['La nota tiembla', 'El aire sale a empujones. Aprieta suave el abdomen como si dijeras "sss" y mantén esa presión constante toda la nota.'],
  scoop: ['Entras a la nota arrastrándote desde abajo', 'Escucha la nota en tu cabeza un segundo antes de cantarla y atácala directo, con una "m" o "n" al inicio.'],
  dropEnd: ['La nota se cae al final', 'Te quedas sin aire. Toma menos aire pero más bajo, y gasta parejo: no sueltes todo al principio.'],
  highMiss: ['Fallas en las notas altas', 'No empujes volumen para subir. Abre la vocal hacia "eh/ah", piensa la nota hacia atrás y arriba, y deja que suene más ligera.'],
  lowMiss: ['Fallas en las notas graves', 'Relaja la mandíbula y no aprietes hacia abajo. Las graves salen con poco aire y pecho abierto.'],
  late: ['Entras tarde', 'Respira durante la guía, no después. La inhalación va justo antes de tu turno.'],
  notSoft: ['Sonó más fuerte de lo pedido', 'Esta parte es casi susurrada: mezcla aire con la voz y canta como si alguien durmiera al lado.'],
  notLoud: ['Le faltó potencia', 'Más energía desde el abdomen, no desde la garganta. Piensa en llamar a alguien al otro lado de la calle: "¡hey!".'],
  noVibrato: ['La nota salió recta', 'Para soltar el vibrato, relaja la laringe y deja que el tono suba y baje un poco, como una sirena chiquita, 5 veces por segundo.'],
  vibFast: ['Vibrato muy rápido', 'Eso suele ser tensión. Relaja mandíbula y lengua, y hazlo más lento y ancho.'],
  vibSlow: ['Vibrato muy lento', 'Acelera un poco la ondulación; apunta a unas 5 o 6 por segundo.'],
  vibWide: ['Vibrato muy ancho', 'Reduce el recorrido: la nota apenas debe moverse alrededor del centro.'],
  breaks: ['Hay quiebres en la voz', (s) => `Tu voz salta${s.breakNote ? ` cerca de ${s.breakNote}` : ''}: es tu zona de paso (passaggio). Es normal. Baja el volumen al cruzarla y usa "ng" o trino de labios para suavizarla.`],
  shortHigh: ['No llegaste hasta arriba', 'Sube sin fuerza, con voz ligera de cabeza. El objetivo es llegar, no sonar potente.'],
  shortLow: ['No bajaste hasta el fondo', 'Deja caer la voz relajada hasta tu nota más grave cómoda.'],
  gaps: ['El sonido se corta', 'Mantén el aire fluyendo todo el recorrido. Si es trino de labios, sostén las mejillas con los dedos.'],
  breathShort: ['Se acabó el aire pronto', 'Inhala bajo: la panza y las costillas se abren, los hombros no suben. Luego suelta un hilo fino de aire, no un chorro.'],
  breathUnsteady: ['El aire salió disparejo', 'Imagina que empañas un vidrio a velocidad constante. El abdomen empuja lento y parejo.'],
  tooClean: ['Sonó limpio, sin distorsión', 'No subas volumen. Vuelve al vocal fry (el "aaa" rasposo de recién despertado) y agrégale aire poco a poco. Si de verdad ibas con distorsión, sube la sensibilidad del detector en Ajustes.'],
  harshShort: ['La distorsión se corta', 'Mantén el aire constante desde el abdomen. Si la garganta aprieta para sostenerlo, para y vuelve al fry suave.'],
  tooLoud: ['Demasiado volumen', 'Un buen scream suena fuerte por el micrófono, no por empujar. Hazlo al volumen de tu voz hablada.'],
  fryLoud: ['El fry va más suave', 'El vocal fry es el sonido más bajito que puedes hacer. Si suena fuerte, estás apretando.'],
  cleanDirty: ['La parte limpia salió sucia', 'Después del scream, suelta la garganta con un mini suspiro antes de cantar limpio. Si tu voz limpia es muy aireada, baja la sensibilidad del detector en Ajustes.'],
  placeSame: ['Los tres colores sonaron parecido', 'Cambia la forma de la boca: "oh" con la boca alargada para graves, "ah" para medios, "ee" con sonrisa para agudos.'],
  missedHits: ['Faltaron golpes', 'Sigue el pulso con el cuerpo (cabeza o pie) y marca cada sílaba corta y seca: "¡ha!".'],
  timingLoose: ['El ritmo quedó suelto', 'Cuenta en voz baja "1 y 2 y" durante la guía. Los golpes cortos son más fáciles de clavar.'],
  extraHits: ['Hubo golpes de más', 'Solo en las marcas. Respira por la boca en los silencios.'],
  great: ['Clavado', 'Así suena cuando todo se alinea. Recuerda la sensación en el cuerpo.'],
};

const PRIORITY = [
  'noVoice', 'noSound', 'octaveLow', 'octaveHigh', 'tooLoud', 'fryLoud', 'tooClean', 'harshShort', 'cleanDirty', 'placeSame',
  'breaks', 'highMiss', 'lowMiss', 'flat', 'sharp', 'dropEnd', 'scoop', 'unstable', 'late', 'notSoft', 'notLoud',
  'noVibrato', 'vibFast', 'vibSlow', 'vibWide', 'shortHigh', 'shortLow', 'gaps', 'breathShort', 'breathUnsteady',
  'missedHits', 'timingLoose', 'extraHits', 'great',
];

export function pickTips(diag, stats = {}) {
  return PRIORITY.filter((k) => diag.includes(k))
    .slice(0, 2)
    .map((k) => {
      const [title, body] = TIPS[k];
      return { code: k, title, body: typeof body === 'function' ? body(stats) : body };
    });
}
