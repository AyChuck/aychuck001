// Estado global con guardado automático en este dispositivo (localStorage).

import { useState, useEffect } from './lib.js';
import { defaultState, record } from './coach/progress.js';
import { addSong, patchSong, removeSong, recordSongTake } from './coach/songs.js';
import { stepById } from './content/curriculum.js';

const KEY = 'catarsis.v1';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const saved = JSON.parse(raw);
    const base = defaultState();
    return {
      ...base,
      ...saved,
      profile: { ...base.profile, ...saved.profile },
      settings: { ...base.settings, ...saved.settings },
      records: { ...base.records, ...saved.records },
    };
  } catch {
    return defaultState();
  }
}

let state = load();
const subs = new Set();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* sin almacenamiento: la sesión sigue en memoria */
  }
}

export const getState = () => state;

export function setState(fn) {
  state = typeof fn === 'function' ? fn(state) : { ...state, ...fn };
  save();
  subs.forEach((s) => s(state));
}

export function useStore() {
  const [s, set] = useState(state);
  useEffect(() => {
    subs.add(set);
    set(state);
    return () => subs.delete(set);
  }, []);
  return s;
}

export const patchProfile = (p) => setState((s) => ({ ...s, profile: { ...s.profile, ...p } }));
export const patchSettings = (p) => setState((s) => ({ ...s, settings: { ...s.settings, ...p } }));

/** Guarda el resultado de un paso y devuelve { gained, events }. */
export function recordStep(stepId, result) {
  const out = record(state, stepId, result);
  let next = out.state;
  // El rango crece solo cuando demuestras que llegas más arriba.
  const step = stepById(stepId);
  const p = next.profile;
  const cap = (p.firstHigh ?? p.high) + 8;
  if (step && result.score >= 80 && p.high < cap) {
    const reached = step.kind === 'slide' ? (result.stats?.top ?? 0) > p.high + 1 : !!step.stretch;
    if (reached) {
      next = { ...next, profile: { ...p, high: p.high + 1 } };
      out.events.push({ type: 'range', high: p.high + 1 });
    }
  }
  setState(next);
  return out;
}

export function setThroat(status) {
  setState((s) => ({ ...s, throat: { status, ts: Date.now() } }));
}

// ───── Canciones ─────

/** Agrega una canción al repertorio y devuelve su id. */
export function addSongToRepertoire(song) {
  setState((s) => addSong(s, song));
  return song.cat ?? `yt-${song.video}`;
}
export const updateSong = (id, patch) => setState((s) => patchSong(s, id, patch));
export const deleteSong = (id) => setState((s) => removeSong(s, id));
export const setFocusSong = (id) => setState((s) => ({ ...s, focusSong: id }));
export const setTaste = (taste) => setState((s) => ({ ...s, taste }));

export function saveSongTake(id, report) {
  const out = recordSongTake(state, id, report);
  setState(out.state);
  return out;
}

export function exportData() {
  return JSON.stringify(state, null, 2);
}

export function importData(text) {
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object' || !data.profile) throw new Error('Archivo no válido');
  const base = defaultState();
  setState({ ...base, ...data, profile: { ...base.profile, ...data.profile }, settings: { ...base.settings, ...data.settings }, records: { ...base.records, ...data.records } });
}

export function resetAll() {
  setState(defaultState());
}
