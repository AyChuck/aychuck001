// Dibujo en canvas de las dos vistas en vivo:
//  - drawPitch:  tu voz como línea contra las barras objetivo (afinación)
//  - drawEnergy: volumen y tipo de sonido contra ventanas de tiempo (aire, guturales, ritmo)

import { midiName } from '../music/notes.js';
import { detectOnsets } from '../coach/scoring.js';

export const C = {
  bg: '#0f0d15',
  grid: 'rgba(236,232,223,0.05)',
  gridC: 'rgba(236,232,223,0.13)',
  fg: '#ece8df',
  muted: '#8f899e',
  ice: '#5fe3ff',
  ember: '#ff5b2e',
  ok: '#6ef0a0',
  warn: '#ffc24b',
  bad: '#ff5470',
  listen: '#9d8cff',
};

const FONT = '600 11px ui-sans-serif, system-ui, sans-serif';
const GUTTER = 34;

function rr(g, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rad, y);
  g.arcTo(x + w, y, x + w, y + h, rad);
  g.arcTo(x + w, y + h, x, y + h, rad);
  g.arcTo(x, y + h, x, y, rad);
  g.arcTo(x, y, x + w, y, rad);
  g.closePath();
}

/**
 * o: { plan?, frames, now, lo, hi, tol }
 * Sin plan dibuja solo la voz (modo libre).
 */
export function drawPitch(g, w, h, o) {
  const { plan, frames, now } = o;
  const lo = o.lo ?? plan.lo;
  const hi = o.hi ?? plan.hi;
  const tol = (o.tol ?? plan?.tol ?? 50) / 100;
  const pad = 14;
  const pps = (w - GUTTER) / (plan?.windowSecs ?? 7); // las frases rápidas se ven con más zoom
  const nowX = GUTTER + (w - GUTTER) * 0.3;
  const X = (t) => nowX + (t - now) * pps;
  const semi = (h - 2 * pad) / (hi - lo);
  const Y = (m) => h - pad - (m - lo) * semi;

  g.fillStyle = C.bg;
  g.fillRect(0, 0, w, h);

  // Tramos de "escucha"
  if (plan) {
    for (const s of plan.segs) {
      if (s.type !== 'listen') continue;
      const x0 = Math.max(GUTTER, X(s.t0 - 0.15));
      const x1 = Math.min(w, X(s.t1 + 0.15));
      if (x1 > GUTTER && x0 < w) {
        g.fillStyle = 'rgba(157,140,255,0.07)';
        g.fillRect(x0, 0, x1 - x0, h);
      }
    }
  }

  // Rejilla de semitonos
  const targets = new Set(plan ? plan.notes.map((n) => Math.round(n.midi)) : []);
  const dense = hi - lo > 22;
  g.font = FONT;
  g.textBaseline = 'middle';
  g.textAlign = 'right';
  for (let m = Math.ceil(lo); m <= Math.floor(hi); m++) {
    const y = Math.round(Y(m)) + 0.5;
    const isC = ((m % 12) + 12) % 12 === 0;
    g.strokeStyle = isC ? C.gridC : C.grid;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(GUTTER, y);
    g.lineTo(w, y);
    g.stroke();
    if (isC || (targets.has(m) && !dense) || (!plan && !dense && m % 2 === 0)) {
      g.fillStyle = targets.has(m) ? C.fg : C.muted;
      g.fillText(midiName(m), GUTTER - 6, y);
    }
  }

  // Todo lo que se desplaza se recorta para no invadir el margen de las notas
  g.save();
  g.beginPath();
  g.rect(GUTTER, 0, w - GUTTER, h);
  g.clip();

  if (plan) {
    // Guía de sirenas: banda ancha
    for (const p of plan.paths) {
      if (X(p.t1) < GUTTER || X(p.t0) > w) continue;
      g.lineJoin = 'round';
      g.lineCap = 'round';
      g.beginPath();
      p.pts.forEach(([t, m], i) => (i ? g.lineTo(X(t), Y(m)) : g.moveTo(X(t), Y(m))));
      g.strokeStyle = now >= p.t0 && now < p.t1 ? 'rgba(255,91,46,0.26)' : 'rgba(236,232,223,0.10)';
      g.lineWidth = Math.max(18, semi * 3);
      g.stroke();
      g.strokeStyle = 'rgba(236,232,223,0.35)';
      g.lineWidth = 1.5;
      g.setLineDash([4, 6]);
      g.stroke();
      g.setLineDash([]);
    }

    // Barras objetivo
    plan._live ??= new Map();
    const hh = Math.max(5, Math.min(tol, 0.6) * semi);
    let labelEnd = -Infinity;
    let labelRow = 0;
    plan.notes.forEach((n, i) => {
      const x0 = X(n.t0);
      const x1 = X(n.t1);
      if (x1 < GUTTER - 40 || x0 > w) return;
      const y = Y(n.midi);
      const active = now >= n.t0 && now < n.t1;
      rr(g, x0 + 1, y - hh, Math.max(3, x1 - x0 - 2), hh * 2, 6);
      if (n.seg === 'listen') {
        g.fillStyle = active ? 'rgba(157,140,255,0.75)' : 'rgba(157,140,255,0.3)';
        g.fill();
      } else if (now >= n.t1) {
        let sc = plan._live.get(i);
        if (sc === undefined) {
          let tot = 0;
          let hit = 0;
          for (const f of frames) {
            if (f.t < n.t0 + 0.08 || f.t >= n.t1 + 0.08) continue;
            tot++;
            if (f.voiced && Math.abs(f.midi - n.midi) <= tol * 1.15) hit++;
          }
          sc = tot ? hit / tot : 0;
          plan._live.set(i, sc);
        }
        g.fillStyle = sc >= 0.6 ? 'rgba(110,240,160,0.45)' : sc >= 0.3 ? 'rgba(255,194,75,0.4)' : 'rgba(255,84,112,0.32)';
        g.fill();
      } else {
        g.fillStyle = active ? 'rgba(255,91,46,0.28)' : 'rgba(236,232,223,0.09)';
        g.fill();
        g.strokeStyle = active ? C.ember : 'rgba(236,232,223,0.4)';
        g.lineWidth = active ? 2 : 1;
        g.stroke();
      }
      if (n.text) {
        g.fillStyle = n.seg === 'listen' ? C.listen : active ? C.fg : 'rgba(236,232,223,0.75)';
        g.font = '700 13px ui-sans-serif, system-ui, sans-serif';
        g.textAlign = 'left';
        g.textBaseline = 'alphabetic';
        // Si la sílaba choca con la anterior, sube un renglón
        labelRow = x0 + 2 < labelEnd + 5 ? (labelRow + 1) % 2 : 0;
        labelEnd = x0 + 2 + g.measureText(n.text).width;
        g.fillText(n.text, x0 + 2, y - hh - 5 - labelRow * 15);
        g.font = FONT;
      }
    });
  }

  // Tu voz
  g.lineWidth = 3;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  let prev = null;
  let ni = 0;
  const sing = plan ? plan.notes.filter((n) => n.seg === 'sing') : [];
  for (const f of frames) {
    const x = X(f.t);
    if (x < GUTTER - 10) {
      prev = null;
      continue;
    }
    if (!f.voiced) {
      prev = null;
      continue;
    }
    while (ni < sing.length && sing[ni].t1 + 0.08 <= f.t) ni++;
    const tg = sing[ni] && f.t >= sing[ni].t0 ? sing[ni] : null;
    const good = tg ? Math.abs(f.midi - tg.midi) <= tol * 1.15 : true;
    const y = Math.max(4, Math.min(h - 4, Y(f.midi)));
    if (prev && f.t - prev.t < 0.12 && Math.abs(f.midi - prev.midi) < 3) {
      g.strokeStyle = !tg ? C.ice : good ? C.ok : C.warn;
      g.beginPath();
      g.moveTo(prev.x, prev.y);
      g.lineTo(x, y);
      g.stroke();
    }
    prev = { x, y, t: f.t, midi: f.midi };
  }

  g.restore();

  // Línea del "ahora" y punto de la voz
  g.strokeStyle = 'rgba(236,232,223,0.5)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(nowX + 0.5, 0);
  g.lineTo(nowX + 0.5, h);
  g.stroke();
  const last = frames[frames.length - 1];
  if (last && last.voiced && now - last.t < 0.15) {
    const y = Y(last.midi);
    const out = y < 4 || y > h - 4;
    const cy = Math.max(8, Math.min(h - 8, y));
    g.shadowColor = C.ice;
    g.shadowBlur = 14;
    g.fillStyle = C.ice;
    g.beginPath();
    if (out) {
      const up = y < 4;
      g.moveTo(nowX, up ? 3 : h - 3);
      g.lineTo(nowX - 7, up ? 14 : h - 14);
      g.lineTo(nowX + 7, up ? 14 : h - 14);
    } else g.arc(nowX, cy, 6, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;
  }

}

const KIND_COLOR = { clean: C.ice, harsh: C.ember, hiss: '#cfc9bd' };
const WIN_COLOR = { harsh: C.ember, clean: C.ice, hiss: '#cfc9bd', onsets: C.ember, rest: 'rgba(236,232,223,0.16)' };

/** o: { plan, frames, now, refDb, gateDb } */
export function drawEnergy(g, w, h, o) {
  const { plan, frames, now } = o;
  // El ejercicio de aire se ve completo (sin desplazarse) para tener la meta a la vista.
  const fixed = !!plan.endOnSilence;
  const pps = fixed ? (w - 16) / plan.dur : w / (plan.windowSecs ?? 8);
  const nowX = fixed ? 8 + Math.max(0, now) * pps : w * 0.3;
  const X = (t) => (fixed ? 8 + t * pps : nowX + (t - now) * pps);
  const laneH = 26;
  const top = plan.rhythm ? 78 : 42;
  const floor = o.gateDb ?? -48;
  const ceil = -3;
  const H = h - top - 8;
  const Yd = (db) => h - 8 - Math.max(0, Math.min(1, (db - floor) / (ceil - floor))) * H;

  g.fillStyle = C.bg;
  g.fillRect(0, 0, w, h);

  // Ventanas
  g.font = '700 11px ui-sans-serif, system-ui, sans-serif';
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  for (const win of plan.windows) {
    const x0 = X(win.t0);
    const x1 = X(win.t1);
    if (x1 < 0 || x0 > w) continue;
    const active = now >= win.t0 && now < win.t1;
    const col = WIN_COLOR[win.expect] ?? WIN_COLOR.rest;
    if (win.expect !== 'rest') {
      g.fillStyle = col;
      g.globalAlpha = active ? 0.13 : 0.05;
      g.fillRect(x0, 8 + laneH, x1 - x0, h);
      g.globalAlpha = 1;
    }
    rr(g, x0 + 1, 8, Math.max(2, x1 - x0 - 2), laneH, 6);
    g.fillStyle = col;
    g.globalAlpha = win.expect === 'rest' ? 1 : active ? 1 : 0.5;
    g.fill();
    g.globalAlpha = 1;
    if (win.label && x1 - x0 > 46) {
      g.save();
      g.beginPath();
      g.rect(x0, 8, x1 - x0 - 4, laneH);
      g.clip();
      g.fillStyle = win.expect === 'rest' ? C.muted : '#14110d';
      g.fillText(win.label.toUpperCase(), Math.max(x0 + 8, 6), 8 + laneH / 2 + 0.5);
      g.restore();
    }
    // Meta de duración del aire
    if (plan.target && win.expect === 'hiss') {
      const xt = X(win.t0 + plan.target);
      g.strokeStyle = C.ok;
      g.setLineDash([3, 4]);
      g.beginPath();
      g.moveTo(xt, 8 + laneH);
      g.lineTo(xt, h);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = C.ok;
      g.textAlign = xt > w - 90 ? 'right' : 'left';
      g.fillText(`META ${plan.target} s`, xt + (xt > w - 90 ? -6 : 6), top + 4);
      g.textAlign = 'left';
    }
  }

  // Pulsos y golpes (ritmo)
  if (plan.rhythm) {
    for (const b of plan.beats) {
      const x = X(b.t);
      if (x < 0 || x > w) continue;
      g.strokeStyle = b.accent ? C.gridC : C.grid;
      g.beginPath();
      g.moveTo(x + 0.5, 8 + laneH);
      g.lineTo(x + 0.5, h);
      g.stroke();
    }
    const onsets = detectOnsets(frames);
    g.textAlign = 'center';
    for (const hit of plan.hits) {
      const x = X(hit.t);
      if (x < -20 || x > w + 20) continue;
      const y = 8 + laneH + 20;
      const listen = hit.seg === 'listen';
      const got = !listen && onsets.some((t) => Math.abs(t - hit.t - 0.06) < 0.16);
      g.beginPath();
      g.arc(x, y, 8, 0, Math.PI * 2);
      if (listen) {
        g.fillStyle = now >= hit.t ? C.listen : 'rgba(157,140,255,0.35)';
        g.fill();
      } else if (got) {
        g.fillStyle = C.ok;
        g.fill();
      } else {
        g.strokeStyle = now > hit.t + 0.25 ? C.bad : C.ember;
        g.lineWidth = 2;
        g.stroke();
      }
      if (hit.text) {
        g.fillStyle = listen ? C.listen : C.fg;
        g.fillText(hit.text, x, y + 21);
      }
    }
    g.textAlign = 'left';
    g.fillStyle = C.ok;
    for (const t of onsets) {
      const x = X(t);
      if (x > 0 && x < w) g.fillRect(x - 1, top + 6, 2, 8);
    }
  }

  // Límite de volumen para guturales
  if (o.refDb != null && plan.windows.some((x) => x.expect === 'harsh')) {
    const y = Yd(o.refDb + (plan.quiet ? 1 : 9));
    g.strokeStyle = 'rgba(255,84,112,0.6)';
    g.setLineDash([5, 5]);
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = C.bad;
    g.fillText('MÁS FUERTE NO HACE FALTA', 8, y - 8);
  }

  // Columnas de volumen coloreadas por tipo de sonido
  for (const f of frames) {
    const x = X(f.t);
    if (x < -4 || f.kind === 'silence') continue;
    const y = Yd(f.db);
    g.fillStyle = KIND_COLOR[f.kind] ?? C.muted;
    g.globalAlpha = f.kind === 'harsh' ? 0.55 + 0.45 * (f.grit ?? 1) : 0.85;
    g.fillRect(x - 1.5, y, 3, h - 8 - y);
  }
  g.globalAlpha = 1;

  g.strokeStyle = 'rgba(236,232,223,0.5)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(nowX + 0.5, 0);
  g.lineTo(nowX + 0.5, h);
  g.stroke();
}
