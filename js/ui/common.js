// Piezas de interfaz compartidas: iconos, lienzo animado y componentes chicos.

import { html, useRef, useEffect } from '../lib.js';

const P = {
  flame: 'M12 3c1 3.2 4.5 5 4.5 9.2A4.5 4.5 0 0 1 12 17a4.5 4.5 0 0 1-4.5-4.8c0-1.6.8-2.8 1.7-3.8.3 1.4 1 2.2 1.8 2.6C10.6 8.300 10.800 5.500 12 3zM8 21h8',
  route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 17h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4M9 21h6',
  chart: 'M4 20V10M10 20V4M16 20v-7M21 20H3',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1.200-1.500-3.300-2.300.500-1.700-1.400L15 4h-6l-.5 2.600-1.700 1.400-2.300-.500L3 10.800 5 12l-2 1.200 1.500 3.300 2.300-.500 1.700 1.400L9 20h6l.5-2.600 1.700-1.400 2.300.500 1.500-3.300z',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z',
  check: 'M5 12.500l4.500 4.500L19 7.500',
  x: 'M6 6l12 12M18 6L6 18',
  play: 'M8 5l11 7-11 7z',
  chev: 'M9 6l6 6-6 6',
  back: 'M15 6l-6 6 6 6',
  head: 'M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v6H5a1 1 0 0 1-1-1zM20 14h-3v6h2a1 1 0 0 0 1-1z',
  lungs: 'M12 4v8M12 12c-1.500 0-2.500 1-3 2M12 12c1.500 0 2.500 1 3 2M9 8c-3 1-5 5-5 9 0 2 1 3 2.500 3S9 18.500 9 16zM15 8c3 1 5 5 5 9 0 2-1 3-2.500 3S15 18.500 15 16z',
  wave: 'M3 12c2-6 4-6 6 0s4 6 6 0 4-6 6 0',
  ladder: 'M8 3v18M16 3v18M8 7h8M8 12h8M8 17h8',
  bolt: 'M13 3L5 13.500h6L10 21l8-10.500h-6z',
  pulse: 'M3 12h4l2-6 4 12 2-6h6',
  star: 'M12 4l2.400 5 5.400.700-4 3.800 1 5.400L12 16.300 7.200 18.900l1-5.400-4-3.800 5.400-.700z',
  drop: 'M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z',
  bolt2: 'M5 12h14',
  rec: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
  stop: 'M7 7h10v10H7z',
  redo: 'M4 12a8 8 0 1 1 2.500 5.800M4 18v-5h5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
};

export function Icon({ name, size = 22, fill = false }) {
  return html`<svg class="icon" width=${size} height=${size} viewBox="0 0 24 24" fill=${fill ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="1.800" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${P[name] ?? ''} /></svg>`;
}

export function Stars({ n, size = 16 }) {
  return html`<span class="stars" aria-label=${`${n} de 3 estrellas`}>
    ${[0, 1, 2].map((i) => html`<span class=${i < n ? 'on' : ''}><${Icon} name="star" size=${size} fill=${i < n} /></span>`)}
  </span>`;
}

/** Lienzo con bucle de dibujo. draw(g, ancho, alto) se llama en cada cuadro. */
export function Canvas({ draw, class: cls = '', label }) {
  const ref = useRef(null);
  const fn = useRef(draw);
  fn.current = draw;
  useEffect(() => {
    const cv = ref.current;
    const g = cv.getContext('2d');
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = cv.clientWidth;
      const h = cv.clientHeight;
      if (!w || !h) return;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      fn.current(g, w, h);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);
  return html`<canvas ref=${ref} class=${`roll ${cls}`} role="img" aria-label=${label ?? 'Visualización de tu voz'}></canvas>`;
}

export function Bar({ value, tone = 'ice', label, right }) {
  return html`<div class="bar-row">
    ${label && html`<div class="bar-head"><span>${label}</span><span class="num">${right ?? `${Math.round(value)}`}</span></div>`}
    <div class="bar"><i class=${tone} style=${`width:${Math.max(0, Math.min(100, value))}%`}></i></div>
  </div>`;
}

export function Toggle({ id, checked, onChange, label, hint }) {
  return html`<label class="toggle" for=${id}>
    <span class="toggle-text"><b>${label}</b>${hint && html`<small>${hint}</small>`}</span>
    <input id=${id} type="checkbox" checked=${checked} onChange=${(e) => onChange(e.target.checked)} />
    <span class="switch" aria-hidden="true"></span>
  </label>`;
}

export function Choice({ options, value, onPick }) {
  return html`<div class="choices">
    ${options.map(
      (o) => html`<button type="button" class=${`choice ${value === o.id ? 'sel' : ''}`} onClick=${() => onPick(o.id)}>
        <b>${o.title}</b>${o.sub && html`<small>${o.sub}</small>`}
      </button>`
    )}
  </div>`;
}
