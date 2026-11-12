// Práctica con canciones reales.
//
// La app no tiene la partitura de la canción (ni puede oír el audio de YouTube),
// así que aquí la corrección es "sin referencia": mide qué tan centradas y estables
// son las notas que sostienes, tu rango, tus notas largas y cuánta distorsión usas.
// La afinación exacta nota por nota se entrena en los ejercicios de la Ruta.

import { CATALOG, TAGS, catalogSong } from '../content/songs.js';
import { LESSONS, STAGES } from '../content/curriculum.js';
import { lessonStatus, stageStatus, dayKey, level, checkAchievements } from './progress.js';
import { midiName } from '../music/notes.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const std = (a) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(mean(a.map((v) => (v - m) ** 2)));
};
const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)] ?? 0;
};

/** Parte la toma en notas sostenidas (tramos con tono estable de al menos 0.25 s). */
export function segmentNotes(frames) {
  const notes = [];
  let cur = null;
  const close = () => {
    if (cur && cur.t1 - cur.t0 >= 0.25 && cur.m.length >= 6) {
      const center = median(cur.m);
      const cents = cur.m.map((m) => (m - center) * 100);
      const n = cents.length;
      const mid = cents.slice(Math.floor(n * 0.3), Math.floor(n * 0.7));
      const end = cents.slice(Math.floor(n * 0.82));
      // ¿Vibrato? Ondulación regular de 4 a 8 veces por segundo
      let crossings = 0;
      let sign = 0;
      for (const c of cents) {
        const s = c > 8 ? 1 : c < -8 ? -1 : 0;
        if (s && s !== sign) {
          if (sign) crossings++;
          sign = s;
        }
      }
      const dur = cur.t1 - cur.t0;
      const rate = crossings / 2 / dur;
      notes.push({
        t0: cur.t0,
        t1: cur.t1,
        dur,
        midi: center,
        dev: (center - Math.round(center)) * 100,
        wobble: std(cents),
        vibrato: dur >= 0.7 && rate >= 4 && rate <= 8,
        drop: dur >= 1.2 && mean(end) - mean(mid) < -30,
      });
    }
    cur = null;
  };
  for (const f of frames) {
    if (!f.voiced) {
      close();
      continue;
    }
    if (cur) {
      const ref = mean(cur.m.slice(-8));
      if (f.t - cur.t1 > 0.12 || Math.abs(f.midi - ref) > 0.75) close();
    }
    if (!cur) cur = { t0: f.t, t1: f.t, m: [] };
    cur.m.push(f.midi);
    cur.t1 = f.t;
  }
  close();
  return notes;
}

/** Informe de una toma libre. frames: { t, midi, voiced, kind, db } */
export function analyzeTake(frames, profile = {}) {
  const dt = frames.length > 1 ? (frames[frames.length - 1].t - frames[0].t) / (frames.length - 1) : 1 / 60;
  const secs = frames.length ? frames[frames.length - 1].t - frames[0].t : 0;
  const voicedSecs = frames.filter((f) => f.voiced).length * dt;
  const harshSecs = frames.filter((f) => f.kind === 'harsh').length * dt;
  const notes = segmentNotes(frames);
  const total = notes.reduce((s, n) => s + n.dur, 0);
  const ok = voicedSecs >= 4 && notes.length >= 4;
  const w = (fn) => (total ? notes.reduce((s, n) => s + fn(n) * n.dur, 0) / total : 0);

  const center = w((n) => Math.abs(n.dev)); // cents promedio hasta la nota más cercana
  const bias = w((n) => n.dev);
  const straight = notes.filter((n) => n.dur >= 0.4 && !n.vibrato);
  const wobble = straight.length ? mean(straight.map((n) => n.wobble)) : 0;
  const centerScore = Math.round(100 * (1 - clamp((center - 7) / 28, 0, 1)));
  const stableScore = Math.round(100 * (1 - clamp((wobble - 9) / 28, 0, 1)));
  const score = ok ? Math.round(centerScore * 0.6 + stableScore * 0.4) : 0;

  const mids = notes.map((n) => n.midi).sort((a, b) => a - b);
  // Cada nota ya es un tramo sostenido, así que los extremos son confiables
  const lo = mids.length ? mids[0] : null;
  const hi = mids.length ? mids[mids.length - 1] : null;
  const above = profile.high != null ? notes.filter((n) => n.midi > profile.high + 1.5).reduce((s, n) => s + n.dur, 0) : 0;
  const longest = notes.reduce((m, n) => Math.max(m, n.dur), 0);
  const drops = notes.filter((n) => n.drop).length;
  const vibratos = notes.filter((n) => n.vibrato).length;

  const tips = [];
  if (!ok) {
    tips.push({
      title: 'Casi no te escuché cantar',
      body: 'Canta con ganas y cerca del micrófono. La canción debe sonar en audífonos: si suena por la bocina, el micrófono la confunde con tu voz.',
    });
  } else {
    if (above > 1.5) {
      tips.push({
        title: `Pasaste ${above.toFixed(0)} s arriba de tu rango cómodo`,
        body: `Esta parte sube más allá de ${midiName(profile.high)}. Si sentiste que apretabas, cántala una octava abajo o en voz de cabeza suave. El rango se gana en la Ruta, no forzando aquí.`,
      });
    }
    if (centerScore < 65) {
      tips.push(
        bias < -9
          ? { title: 'Tus notas largas quedan bajas', body: 'Falta aire en movimiento. Inhala bajo antes de la frase y piensa que caes sobre la nota desde arriba.' }
          : bias > 9
            ? { title: 'Tus notas largas quedan altas', body: 'Estás empujando de más. Baja el volumen un 30 % y suelta el cuello.' }
            : { title: 'Tus notas caen entre dos teclas', body: 'Baja la velocidad a 0.75x, repite solo el coro y escucha la nota un instante antes de cantarla.' }
      );
    }
    if (stableScore < 65) tips.push({ title: 'Las notas largas tiemblan', body: 'El aire sale a empujones. Presión constante del abdomen, como en el ejercicio del "sss".' });
    if (drops >= 2) tips.push({ title: 'Varias notas se caen al final', body: 'Te quedas sin aire. Marca dónde respirar: siempre antes de la frase larga, nunca a la mitad.' });
    if (score >= 85 && !tips.length) tips.push({ title: 'Toma sólida', body: 'Notas centradas y estables. Súbele la velocidad a 1x o pasa al siguiente tramo.', good: true });
  }

  return {
    ok,
    score,
    secs,
    voicedSecs,
    harshSecs,
    notes: notes.length,
    center: Math.round(center),
    bias: Math.round(bias),
    centerScore,
    stableScore,
    wobble: Math.round(wobble),
    longest: +longest.toFixed(1),
    drops,
    vibratos,
    lo,
    hi,
    above,
    tips: tips.slice(0, 3),
  };
}

// ───────────────────────── Repertorio ─────────────────────────

export const MASTER_DAYS = 3;
export const MASTER_SCORE = 80;

export function addSong(state, { video = null, title, artist = '', cat = null }, now = Date.now()) {
  const id = cat ?? `yt-${video}`;
  if (state.songs[id]) {
    // Ya estaba: solo completa lo que faltaba (por ejemplo, el enlace)
    const cur = state.songs[id];
    return { ...state, songs: { ...state.songs, [id]: { ...cur, video: video ?? cur.video, title: cur.cat ? cur.title : title || cur.title, artist: cur.cat ? cur.artist : artist || cur.artist } } };
  }
  const song = { id, video, title: title || 'Canción sin título', artist, cat, added: now, loops: [], takes: [], mastered: false };
  return { ...state, songs: { ...state.songs, [id]: song }, focusSong: state.focusSong ?? id };
}

export function patchSong(state, id, patch) {
  if (!state.songs[id]) return state;
  return { ...state, songs: { ...state.songs, [id]: { ...state.songs[id], ...patch } } };
}

export function removeSong(state, id) {
  const songs = { ...state.songs };
  delete songs[id];
  return { ...state, songs, focusSong: state.focusSong === id ? (Object.keys(songs)[0] ?? null) : state.focusSong };
}

/** Días distintos con una toma buena (para "dominada"). */
export function goodDays(song) {
  return new Set(song.takes.filter((t) => t.score >= MASTER_SCORE && t.voiced >= 30).map((t) => t.day)).size;
}

export function songStatus(song) {
  if (song.mastered) return 'dominada';
  return song.takes.length ? 'trabajo' : 'nueva';
}

/** Guarda una toma. Devuelve { state, gained, events }. */
export function recordSongTake(state, id, report, now = Date.now()) {
  const s = structuredClone(state);
  const song = s.songs[id];
  const events = [];
  if (!song || !report.ok) return { state, gained: 0, events };
  const key = dayKey(now);
  song.takes.push({ ts: now, day: key, score: report.score, center: report.centerScore, stable: report.stableScore, voiced: Math.round(report.voicedSecs), hi: report.hi, harsh: Math.round(report.harshSecs) });
  if (song.takes.length > 60) song.takes = song.takes.slice(-60);
  if (!song.mastered && goodDays(song) >= MASTER_DAYS) {
    song.mastered = true;
    events.push({ type: 'songMastered', song });
  }
  let gained = 8 + (report.score >= MASTER_SCORE ? 8 : 0) + (events.length ? 30 : 0);
  // Tope: 4 tomas por día dan XP; el resto es práctica pura
  if (song.takes.filter((t) => t.day === key).length > 4) gained = 2;
  const before = level(s.xp).lvl;
  s.xp += gained;
  const after = level(s.xp);
  if (after.lvl > before) events.push({ type: 'level', lvl: after.lvl, rank: after.rank });
  const d = s.days[key] ?? { xp: 0, n: 0 };
  s.days[key] = { xp: d.xp + gained, n: d.n + 1 };
  if (report.harshSecs > 1) s.harsh = { day: key, secs: (s.harsh.day === key ? s.harsh.secs : 0) + report.harshSecs };
  checkAchievements(s, { now }, events);
  return { state: s, gained, events };
}

// ───────────────────────── Recomendaciones ─────────────────────────

/** ¿Ya tienes la técnica que pide esta canción? */
export function songReady(state, song) {
  const missing = song.tags.filter((t) => {
    const lesson = LESSONS.find((l) => l.id === TAGS[t].lesson);
    return lesson && !lessonStatus(state, lesson).done;
  });
  return { ready: song.level === 1 || missing.length === 0, missing };
}

export const tier = (state) => STAGES.filter((st) => stageStatus(state, st.id).unlocked).length;

/** Canciones sugeridas para hoy: de tus escenas, a tu nivel, con técnica que ya tienes. */
export function recommend(state, n = 6, day = Math.floor(Date.now() / 86400000)) {
  const t = tier(state);
  const scenes = new Set(state.taste?.length ? state.taste : ['posthc', 'punk', 'metal', 'core', 'es']);
  const clean = state.profile.goal === 'clean';
  const pool = CATALOG.filter((s) => scenes.has(s.scene) && !state.songs[s.id] && !(clean && s.tags.includes('scream') && s.tags.length <= 2));
  const rank = (s) => {
    const { ready, missing } = songReady(state, s);
    const reach = s.level - t; // qué tan por encima de tu etapa está
    // Estable dentro del día, distinto cada día
    let h = day;
    for (const c of s.id) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0;
    return (ready ? 0 : 20 + missing.length * 6) + (reach > 0 ? reach * 14 : -reach * 3) + (h % 1000) / 100;
  };
  const sorted = [...pool].sort((a, b) => rank(a) - rank(b));
  // Variedad: máximo 2 por artista y que aparezcan varias escenas
  const out = [];
  const perArtist = {};
  const perScene = {};
  const cap = Math.max(2, Math.ceil(n / Math.min(scenes.size, 3)));
  for (const s of sorted) {
    if ((perArtist[s.artist] ?? 0) >= 1 || (perScene[s.scene] ?? 0) >= cap) continue;
    out.push(s);
    perArtist[s.artist] = (perArtist[s.artist] ?? 0) + 1;
    perScene[s.scene] = (perScene[s.scene] ?? 0) + 1;
    if (out.length >= n) break;
  }
  return out;
}

/** Datos de catálogo de una canción del repertorio (si viene del catálogo). */
export const songMeta = (song) => (song.cat ? catalogSong(song.cat) : null);
