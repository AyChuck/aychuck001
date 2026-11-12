// Estado global con guardado automático en este dispositivo (localStorage).

import { useState, useEffect } from './lib.js';
import { defaultState, record } from './coach/progress.js';
import { stepById } from './content/curriculum.js';

const KEY = 'catarsis.v1';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const saved = JSON.parse(raw);
    const base = defaultState();
    return { ...base, ...saved, profile: { ...base.profile, ...saved.profile }, settings: { ...base.settings, ...saved.settings } };
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

export function exportData() {
  return JSON.stringify(state, null, 2);
}

export function importData(text) {
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object' || !data.profile) throw new Error('Archivo no válido');
  setState({ ...defaultState(), ...data });
}

export function resetAll() {
  setState(defaultState());
}
