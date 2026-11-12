// Arranque: bienvenida la primera vez; después, cuatro pestañas y el reproductor.

import { html, render, useState, useEffect } from './lib.js';
import { Icon } from './ui/common.js';
import { Onboarding } from './ui/Onboarding.js';
import { Home, Path, Progress, Settings } from './ui/screens.js';
import { Studio } from './ui/Studio.js';
import { Songs } from './ui/Songs.js';
import { Player } from './ui/Player.js';
import { reviewSession } from './coach/planner.js';
import { stopMic } from './audio/engine.js';
import { useStore, getState, setState } from './store.js';

const TABS = [
  { id: 'hoy', label: 'Hoy', icon: 'flame' },
  { id: 'ruta', label: 'Ruta', icon: 'route' },
  { id: 'canciones', label: 'Canciones', icon: 'play' },
  { id: 'progreso', label: 'Progreso', icon: 'chart' },
];
const ROUTES = ['hoy', 'ruta', 'canciones', 'progreso', 'libre', 'ajustes'];

const tabFromHash = () => {
  const h = location.hash.replace('#', '');
  return ROUTES.includes(h) ? h : 'hoy';
};

function App() {
  const s = useStore();
  const [tab, setTab] = useState(tabFromHash());
  const [session, setSession] = useState(null);
  const [run, setRun] = useState(0);
  const [songId, setSongId] = useState(null);

  useEffect(() => {
    const on = () => setTab(tabFromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const go = (id, song) => {
    stopMic();
    if (id === 'canciones') setSongId(song ?? null);
    location.hash = id;
    setTab(id);
    window.scrollTo(0, 0);
  };

  const start = (ses) => {
    if (!ses.steps.length) return;
    setState((st) => ({ ...st, sessions: st.sessions + 1 }));
    setSession(ses);
    setRun((r) => r + 1);
    window.scrollTo(0, 0);
  };

  const exit = () => {
    setSession(null);
    stopMic();
  };

  if (!s.onboarded) return html`<${Onboarding} />`;
  if (session) {
    return html`<${Player} key=${run} session=${session} onExit=${exit} onMore=${() => start(reviewSession(getState()))}
      onSong=${() => {
        exit();
        go('canciones', getState().focusSong);
      }} />`;
  }

  const screen = {
    hoy: html`<${Home} onStart=${start} go=${go} />`,
    ruta: html`<${Path} onStart=${start} />`,
    canciones: html`<${Songs} openId=${songId} setOpenId=${(id) => { setSongId(id); window.scrollTo(0, 0); }} go=${go} />`,
    libre: html`<${Studio} />`,
    progreso: html`<${Progress} />`,
    ajustes: html`<${Settings} />`,
  }[tab];

  return html`<div class="app">
    ${screen}
    <nav class="tabs" aria-label="Secciones">
      ${TABS.map((t) => html`<button class=${tab === t.id ? 'on' : ''} aria-current=${tab === t.id ? 'page' : null} onClick=${() => go(t.id)}><${Icon} name=${t.icon} /><span>${t.label}</span></button>`)}
    </nav>
  </div>`;
}

render(html`<${App} />`, document.getElementById('app'));

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
