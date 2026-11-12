// Convierte la definición de un ejercicio (relativa) en una línea de tiempo
// concreta, adaptada al rango vocal de la persona y a su nivel de dificultad.
// Función pura: sin audio ni DOM.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const STRICT_MUL = [1.4, 1, 0.75]; // suave, normal, estricto

export function tolerance(def, opts = {}) {
  const base = def.tol ?? 50;
  return Math.round(base * STRICT_MUL[opts.strict ?? 1] + (opts.ease ?? 0) * 15);
}

export function buildPlan(def, profile, opts = {}) {
  switch (def.kind) {
    case 'pattern':
    case 'sustain':
      return pitchPlan(def, profile, opts);
    case 'slide':
      return slidePlan(def, profile, opts);
    case 'breath':
      return breathPlan(def);
    case 'harsh':
    case 'trans':
      return windowsPlan(def);
    case 'rhythm':
      return rhythmPlan(def, opts);
    case 'pacer':
      return pacerPlan(def);
    default:
      return { view: 'card', dur: 0 };
  }
}

function pitchPlan(def, profile, opts) {
  const ease = opts.ease ?? 0;
  const tempoMul = 1 - 0.1 * ease;
  const bpm = (def.bpm ?? 60) * tempoMul;
  const beat = 60 / bpm;
  const src = def.kind === 'sustain' ? [[0, (def.secs ?? 4) / (60 / (def.bpm ?? 60))]] : def.notes;
  const offs = src.map((n) => n[0]);
  const pmin = Math.min(...offs);
  const pmax = Math.max(...offs);

  const low = profile.low;
  const high = profile.high + (def.stretch ?? 0);
  const room = Math.max(0, high - low - (pmax - pmin));
  const step = def.step ?? 1;
  const reps = def.reps ?? 3;
  // Si las repeticiones no caben subiendo desde "start", arrancamos más abajo.
  let startRoom = clamp(def.start ?? 0.2, 0, 1) * room;
  if (step > 0) startRoom = Math.min(startRoom, Math.max(0, room - step * (reps - 1)));
  if (step < 0) startRoom = Math.max(startRoom, Math.min(room, -step * (reps - 1)));
  const root = Math.round(low - pmin + startRoom);

  const notes = [];
  const segs = [];
  let t = 0.8;
  let rep = 0;
  for (let r = 0; r < reps; r++) {
    const rr = root + r * step;
    if (r > 0 && (rr + pmax > high + 0.01 || rr + pmin < low - 0.01)) break;
    const listen = def.listen ?? true;
    if (listen) {
      const t0 = t;
      if (listen === 'cue') {
        notes.push({ midi: rr + src[0][0], t0: t, t1: t + 0.7, seg: 'listen', rep });
        t += 0.7;
      } else {
        for (const [semi, beats, text] of src) {
          notes.push({ midi: rr + semi, t0: t, t1: t + beats * beat, text, seg: 'listen', rep });
          t += beats * beat;
        }
      }
      segs.push({ type: 'listen', t0, t1: t, rep });
      t += 0.5;
    }
    const s0 = t;
    for (const [semi, beats, text] of src) {
      notes.push({ midi: rr + semi, t0: t, t1: t + beats * beat, text, seg: 'sing', rep });
      t += beats * beat;
    }
    segs.push({ type: 'sing', t0: s0, t1: t, rep, root: rr });
    t += 0.8;
    rep++;
  }

  const all = notes.map((n) => n.midi);
  const shortest = Math.min(...notes.filter((n) => n.seg === 'sing').map((n) => n.t1 - n.t0));
  return {
    view: 'pitch',
    windowSecs: Math.max(4, Math.min(7, shortest * 12)),
    dur: t + 0.2,
    notes,
    segs,
    paths: [],
    lo: Math.min(...all) - 4,
    hi: Math.max(...all) + 4,
    tol: tolerance(def, opts),
    dyn: def.dyn ?? null,
    vibrato: !!def.vibrato,
    bpm,
    root,
    backing: def.backing ?? null,
  };
}

function slidePlan(def, profile) {
  const span = profile.high - profile.low;
  const a = profile.low + clamp(def.from ?? 0.1, 0, 1) * span;
  const b = profile.low + clamp(def.to ?? 0.85, 0, 1.2) * span;
  const secs = def.secs ?? 6;
  const reps = def.reps ?? 3;
  const shape = def.shape ?? 'updown';
  const paths = [];
  const segs = [];
  let t = 1.2;
  for (let r = 0; r < reps; r++) {
    const pts =
      shape === 'updown'
        ? [[t, a], [t + secs / 2, b], [t + secs, a]]
        : shape === 'down'
          ? [[t, b], [t + secs, a]]
          : [[t, a], [t + secs, b]];
    paths.push({ t0: t, t1: t + secs, pts, rep: r });
    segs.push({ type: 'sing', t0: t, t1: t + secs, rep: r });
    t += secs + 1.6;
  }
  return {
    view: 'pitch',
    dur: t,
    notes: [],
    segs,
    paths,
    lo: Math.min(a, b) - 4,
    hi: Math.max(a, b) + 4,
    slide: { lo: Math.min(a, b), hi: Math.max(a, b) },
    tol: 100,
    dyn: null,
    bpm: 60,
    root: Math.round(a),
    backing: null,
  };
}

function breathPlan(def) {
  const target = def.target ?? 15;
  const max = Math.min(60, target * 1.6 + 2);
  return {
    view: 'energy',
    dur: 3 + max + 0.5,
    windows: [
      { t0: 0, t1: 3, expect: 'rest', label: 'Inhala por la nariz' },
      { t0: 3, t1: 3 + max, expect: 'hiss', label: def.label ?? 'Suelta "sss" parejo' },
    ],
    hits: [],
    beats: [],
    target,
    endOnSilence: true,
  };
}

function windowsPlan(def) {
  const windows = [];
  let t = 1.5;
  windows.push({ t0: 0, t1: t, expect: 'rest', label: 'Prepárate' });
  let i = 0;
  for (const [expect, secs, label] of def.windows) {
    windows.push({ t0: t, t1: t + secs, expect, label: label ?? defaultLabel(expect), idx: i++ });
    t += secs;
  }
  return {
    view: 'energy',
    dur: t + 0.4,
    windows,
    hits: [],
    beats: [],
    place: def.place ?? null,
    quiet: !!def.quiet,
  };
}

function defaultLabel(expect) {
  return { harsh: 'Distorsión', clean: 'Limpio', rest: 'Descansa', hiss: 'Aire' }[expect] ?? '';
}

function rhythmPlan(def, opts) {
  const bpm = (def.bpm ?? 100) * (1 - 0.1 * (opts.ease ?? 0));
  const beat = 60 / bpm;
  const div = def.div ?? 2; // subdivisiones por pulso
  const cell = beat / div;
  const grid = def.grid.replace(/\|/g, '');
  const barLen = grid.length * cell;
  const reps = def.reps ?? 2;
  const texts = def.texts ?? [];
  const hits = [];
  const beats = [];
  const windows = [];
  let t = 0.6;

  const addBar = (seg) => {
    let k = 0;
    for (let i = 0; i < grid.length; i++) {
      if (i % div === 0) beats.push({ t: t + i * cell, accent: i === 0, seg });
      if (grid[i] === 'x') hits.push({ t: t + i * cell, text: texts[k++ % Math.max(1, texts.length)], seg });
    }
    windows.push({ t0: t, t1: t + barLen, expect: seg === 'listen' ? 'rest' : 'onsets', label: seg === 'listen' ? 'Escucha el ritmo' : def.label ?? 'Tu turno' });
    t += barLen;
  };

  for (let r = 0; r < reps; r++) {
    addBar('listen');
    addBar('sing');
  }
  // Zoom según lo apretado del ritmo, para que los golpes no se encimen en pantalla
  const gaps = hits.slice(1).map((h, i) => h.t - hits[i].t).filter((g) => g > 0.01);
  const windowSecs = Math.max(3.5, Math.min(8, Math.min(...gaps) * 16));
  return { view: 'energy', dur: t + 0.5, windows, hits, beats, bpm, rhythm: true, windowSecs };
}

function pacerPlan(def) {
  const [i, h, o] = def.pattern ?? [4, 4, 8];
  const phases = [];
  for (let c = 0; c < (def.cycles ?? 3); c++) {
    phases.push({ label: 'Inhala', secs: i, kind: 'in' });
    if (h) phases.push({ label: 'Sostén', secs: h, kind: 'hold' });
    phases.push({ label: def.outLabel ?? 'Exhala lento', secs: o, kind: 'out' });
  }
  return { view: 'pacer', phases, dur: phases.reduce((s, p) => s + p.secs, 0) };
}
