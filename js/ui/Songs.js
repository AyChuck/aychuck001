// Canciones: tu repertorio, sugerencias según tus gustos y práctica sobre la canción real.

import { html, useState, useEffect, useRef, useMemo } from '../lib.js';
import { Icon, Canvas, Bar, Choice } from './common.js';
import { drawPitch } from './rolls.js';
import { CATALOG, SCENES, TAGS, LEVELS } from '../content/songs.js';
import { lessonById } from '../content/curriculum.js';
import { analyzeTake, songStatus, songMeta, songReady, recommend, heroPicks, isHero, goodDays, MASTER_DAYS, MASTER_SCORE } from '../coach/songs.js';
import { harshBlocked } from '../coach/progress.js';
import { parseLink, createPlayer, readPlaylist, fetchTitle, musicSearchUrl } from '../audio/youtube.js';
import { startMic, stopMic, onFrame, audioCtx, unlockAudio, getStream, setGate, setGritSensitivity } from '../audio/engine.js';
import { sfx } from '../audio/synth.js';
import { midiName } from '../music/notes.js';
import { useStore, getState, addSongToRepertoire, updateSong, deleteSong, saveSongTake, setFocusSong, setTaste, patchSettings } from '../store.js';

const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const STATUS = { nueva: 'Nueva', trabajo: 'En trabajo', dominada: 'Dominada' };

function Level({ n }) {
  return html`<span class="lvl" title=${LEVELS[n]} aria-label=${`Dificultad: ${LEVELS[n]}`}>${[1, 2, 3, 4, 5].map((i) => html`<i class=${i <= n ? 'on' : ''}></i>`)}</span>`;
}

function Tags({ tags }) {
  return html`<span class="tags">${tags.slice(0, 4).map((t) => html`<span class="tag">${TAGS[t].name}</span>`)}</span>`;
}

// ───────────────────────── Biblioteca ─────────────────────────

function AddLink({ onOpen }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const add = async (value) => {
    const link = parseLink(value);
    if (!link) {
      setMsg({ warn: true, text: 'Eso no parece un enlace de YouTube o YouTube Music. Copia el enlace con "Compartir" y pégalo aquí.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      if (link.video) {
        const info = await fetchTitle(link.video);
        const id = addSongToRepertoire({ video: link.video, title: info?.title ?? 'Canción nueva', artist: info?.author ?? '' });
        setText('');
        onOpen(id);
      } else {
        const ids = await readPlaylist(link.list);
        ids.slice(0, 100).forEach((video, i) => addSongToRepertoire({ video, title: `Pista ${i + 1}`, artist: 'De tu playlist' }));
        setText('');
        setMsg({ text: `Listo: ${Math.min(ids.length, 100)} canciones agregadas. El nombre de cada una aparece al abrirla.` });
        // Los títulos se completan en segundo plano cuando YouTube lo permite
        for (const video of ids.slice(0, 100)) {
          const info = await fetchTitle(video);
          if (info) updateSong(`yt-${video}`, { title: info.title, artist: info.author });
        }
      }
    } catch (e) {
      setMsg({ warn: true, text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      setText(t);
      add(t);
    } catch {
      setMsg({ text: 'Tu navegador no deja leer el portapapeles. Mantén presionado el campo y elige "Pegar".' });
    }
  };

  return html`<section class="panel">
    <div class="panel-head"><h2>Agregar con enlace</h2></div>
    <p class="muted small">Pega el enlace de una canción o de <b>una playlist tuya</b> de YouTube Music o YouTube. La playlist debe ser pública o "no listada".</p>
    <form class="link-form" onSubmit=${(e) => { e.preventDefault(); add(text); }}>
      <label class="sr" for="song-link">Enlace de YouTube</label>
      <input id="song-link" type="url" inputmode="url" placeholder="https://music.youtube.com/…" value=${text} onInput=${(e) => setText(e.target.value)} />
      <button type="submit" class="btn primary" disabled=${busy || !text.trim()}>${busy ? 'Leyendo…' : 'Agregar'}</button>
    </form>
    <button type="button" class="btn ghost small" onClick=${paste} disabled=${busy}>Pegar lo que copié</button>
    ${msg && html`<p class=${`note ${msg.warn ? 'warn' : ''}`} role="status">${msg.text}</p>`}
  </section>`;
}

function CatalogRow({ song, state, onAdd }) {
  const [open, setOpen] = useState(false);
  const { ready, missing } = songReady(state, song);
  return html`<li class="song-row">
    <button class="song-main" aria-expanded=${open} onClick=${() => setOpen(!open)}>
      <span class="song-text"><b>${song.title}</b><small>${song.artist}${isHero(state, song.artist) ? ' · tu referente' : ''}</small></span>
      <${Level} n=${song.level} />
    </button>
    ${open &&
    html`<div class="song-detail">
      <${Tags} tags=${song.tags} />
      <p class="muted small">
        ${LEVELS[song.level]}. ${ready
          ? 'Ya tienes la técnica que pide.'
          : `Todavía no ves: ${missing.map((t) => `${TAGS[t].name} (${lessonById(TAGS[t].lesson)?.title})`).join(', ')}. Puedes cantarla igual; saldrá mejor después de esas lecciones.`}
      </p>
      <button class="btn primary" onClick=${() => onAdd(song)}>Agregar a mi repertorio</button>
    </div>`}
  </li>`;
}

function Library({ onOpen, go }) {
  const s = useStore();
  const [showAll, setShowAll] = useState(false);
  const [scene, setScene] = useState('all');
  const [q, setQ] = useState('');
  const mine = Object.values(s.songs).sort((a, b) => (b.takes.at(-1)?.ts ?? b.added) - (a.takes.at(-1)?.ts ?? a.added));
  const recs = useMemo(() => recommend(s, 6), [s.songs, s.taste, s.ex, s.profile.goal]);
  const heroes = useMemo(() => heroPicks(s, 4), [s.songs, s.ex, s.heroes]);
  const addCat = (song) => onOpen(addSongToRepertoire({ cat: song.id, title: song.title, artist: song.artist }));

  const needle = q.trim().toLowerCase();
  const all = CATALOG.filter((x) => (scene === 'all' || x.scene === scene) && !s.songs[x.id] && (!needle || `${x.title} ${x.artist}`.toLowerCase().includes(needle)));

  return html`<div class="screen">
    <header class="top"><h1 class="title">Canciones</h1></header>

    ${mine.length > 0 &&
    html`<section class="panel">
      <div class="panel-head"><h2>Mi repertorio</h2><span class="num">${mine.filter((x) => x.mastered).length}/${mine.length}</span></div>
      <ul class="songs">
        ${mine.map((x) => {
          const st = songStatus(x);
          const last = x.takes.at(-1);
          return html`<li class="song-row">
            <button class="song-main" onClick=${() => onOpen(x.id)}>
              <span class="song-text"><b>${x.title}</b><small>${x.artist || 'Sin artista'}${x.video ? '' : ' · falta el enlace'}</small></span>
              ${last && html`<span class="num small">${last.score}</span>`}
              <span class=${`pill ${st === 'dominada' ? 'ok' : st === 'nueva' ? 'dim' : ''}`}>${s.focusSong === x.id && st !== 'dominada' ? 'En foco' : STATUS[st]}</span>
            </button>
          </li>`;
        })}
      </ul>
    </section>`}

    <section class="panel">
      <div class="panel-head"><h2>Para ti ahora</h2></div>
      <p class="muted small">Según tus escenas, tu etapa y la técnica que ya viste. Cambian cada día.</p>
      <ul class="songs">${recs.map((x) => html`<${CatalogRow} key=${x.id} song=${x} state=${s} onAdd=${addCat} />`)}</ul>
    </section>

    ${heroes.length > 0 &&
    html`<section class="panel">
      <div class="panel-head"><h2>De tus referentes</h2></div>
      <p class="muted small">${s.heroes.join(', ')}: los que usas como modelo de técnica. Primero escúchalas fijándote en qué voz usan en cada frase; cántalas cuando la app diga que ya tienes la técnica.</p>
      <ul class="songs">${heroes.map((x) => html`<${CatalogRow} key=${x.id} song=${x} state=${s} onAdd=${addCat} />`)}</ul>
    </section>`}

    <${AddLink} onOpen=${onOpen} />

    <section class="panel">
      <div class="panel-head"><h2>Tus escenas</h2></div>
      <div class="chips">
        ${Object.entries(SCENES).map(([id, sc]) => {
          const on = s.taste.includes(id);
          return html`<button class=${`chip ${on ? 'on' : ''}`} aria-pressed=${on} title=${sc.blurb} onClick=${() => setTaste(on ? s.taste.filter((t) => t !== id) : [...s.taste, id])}>${sc.name}</button>`;
        })}
      </div>
      <p class="muted small">Cualquier canción que no esté aquí la agregas con su enlace.</p>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Catálogo</h2><span class="num">${CATALOG.length}</span></div>
      ${showAll
        ? html`<div class="chips">
              <button class=${`chip ${scene === 'all' ? 'on' : ''}`} onClick=${() => setScene('all')}>Todo</button>
              ${Object.entries(SCENES).map(([id, sc]) => html`<button class=${`chip ${scene === id ? 'on' : ''}`} onClick=${() => setScene(id)}>${sc.name}</button>`)}
            </div>
            <label class="sr" for="song-search">Buscar en el catálogo</label>
            <input id="song-search" type="search" placeholder="Buscar banda o canción" value=${q} onInput=${(e) => setQ(e.target.value)} />
            <ul class="songs">${all.slice(0, 60).map((x) => html`<${CatalogRow} key=${x.id} song=${x} state=${s} onAdd=${addCat} />`)}</ul>
            ${all.length > 60 && html`<p class="muted small">Mostrando 60 de ${all.length}. Escribe para filtrar.</p>`}
            ${!all.length && html`<p class="muted small">Nada con ese nombre. Agrégala con su enlace.</p>`}`
        : html`<button class="btn ghost" onClick=${() => setShowAll(true)}>Ver todas por escena y dificultad</button>`}
    </section>

    <button class="tile" onClick=${() => go('libre')}><${Icon} name="mic" /><b>Afinador libre</b><small>Canta sin canción: nota en vivo y grabadora</small></button>
  </div>`;
}

// ───────────────────────── Práctica de una canción ─────────────────────────

function Report({ r, audio, events }) {
  return html`<section class="panel report">
    <div class="report-head">
      <div class=${`score-ring sm ${r.score >= MASTER_SCORE ? 'pass' : 'fail'}`} style=${`--p:${r.score}`}><span class="num">${r.ok ? r.score : '–'}</span></div>
      <div class="report-stats">
        <span><b class="num">${fmt(r.voicedSecs)}</b> cantando</span>
        ${r.hi != null && html`<span><b class="num">${midiName(r.lo)}–${midiName(r.hi)}</b> rango usado</span>`}
        ${r.longest > 0 && html`<span><b class="num">${r.longest} s</b> nota más larga</span>`}
        ${r.harshSecs > 1 && html`<span><b class="num">${Math.round(r.harshSecs)} s</b> de distorsión</span>`}
      </div>
    </div>
    ${r.ok &&
    html`<${Bar} label="Notas centradas" value=${r.centerScore} tone=${r.centerScore >= 75 ? 'ok' : r.centerScore >= 50 ? 'warn' : 'bad'} right=${`±${r.center} cents`} />
      <${Bar} label="Notas estables" value=${r.stableScore} tone=${r.stableScore >= 75 ? 'ok' : r.stableScore >= 50 ? 'warn' : 'bad'} />`}
    ${r.tips.map((t) => html`<div class=${`tip ${t.good ? 'good' : ''}`}><b>${t.title}</b><p>${t.body}</p></div>`)}
    ${audio && html`<div class="replay"><span>Escucha tu toma (solo tu voz).</span><audio controls src=${audio}></audio></div>`}
    ${events.map((e) => {
      if (e.type === 'songMastered') return html`<div class="event hot">Canción dominada: ${e.song.title}</div>`;
      if (e.type === 'ach') return html`<div class="event hot">Logro: ${e.ach.name}</div>`;
      if (e.type === 'level') return html`<div class="event hot">Nivel ${e.lvl}: ${e.rank}</div>`;
      return null;
    })}
    <p class="muted small">Aquí no hay partitura: mido qué tan centradas y estables son tus notas, no si son las de la canción. La afinación nota por nota se entrena en la Ruta.</p>
  </section>`;
}

function SongView({ id, onBack }) {
  const s = useStore();
  const song = s.songs[id];
  const meta = song ? songMeta(song) : null;
  const mount = useRef(null);
  const player = useRef(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState(null);
  const [now, setNow] = useState(0);
  const [dur, setDur] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [rates, setRates] = useState([1]);
  const [loop, setLoop] = useState(null);
  const [markA, setMarkA] = useState(null);
  const [link, setLink] = useState('');
  const [linkErr, setLinkErr] = useState(null);
  const [taking, setTaking] = useState(false);
  const [report, setReport] = useState(null);
  const [events, setEvents] = useState([]);
  const [audio, setAudio] = useState(null);
  const [micErr, setMicErr] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [needTap, setNeedTap] = useState(false);
  const [cal, setCal] = useState(null); // null | 'run' | 'ok' | 'loud'
  const room = !!s.settings.room;
  const frames = useRef([]);
  const t0 = useRef(0);
  const view = useRef({ lo: s.profile.low - 4, hi: s.profile.high + 6 });
  const rec = useRef(null);
  const offFrame = useRef(null);
  const loopRef = useRef(null);
  loopRef.current = loop;

  // Reproductor
  useEffect(() => {
    if (!song?.video || !mount.current) return undefined;
    let dead = false;
    setReady(false);
    setErr(null);
    createPlayer(mount.current, { video: song.video, onError: (m) => !dead && setErr(m) })
      .then((p) => {
        if (dead) return p.destroy();
        player.current = p;
        setReady(true);
        setRates(p.rates().filter((r) => r >= 0.5 && r <= 1));
        return undefined;
      })
      .catch((e) => !dead && setErr(e.message));
    const timer = setInterval(() => {
      const p = player.current;
      if (!p) return;
      const t = p.time();
      setNow(t);
      setDur(p.duration());
      setPlaying(p.playing());
      if (p.playing()) setNeedTap(false);
      const lp = loopRef.current;
      if (lp && p.playing() && (t >= lp.b || t < lp.a - 1)) p.seek(lp.a);
      // Completa el nombre de las canciones pegadas por enlace
      const cur = getState().songs[id];
      if (cur && !cur.cat && /^(Pista \d+|Canción nueva)$/.test(cur.title)) {
        const info = p.info();
        if (info) updateSong(id, { title: info.title, artist: info.author });
      }
    }, 250);
    return () => {
      dead = true;
      clearInterval(timer);
      player.current?.destroy();
      player.current = null;
    };
  }, [song?.video]);

  // Al salir: suelta micrófono y grabación
  useEffect(
    () => () => {
      offFrame.current?.();
      if (rec.current?.state === 'recording') rec.current.stop();
      stopMic();
    },
    []
  );

  if (!song) return null;

  const attach = (e) => {
    e.preventDefault();
    const l = parseLink(link);
    if (!l?.video) {
      setLinkErr('Pega el enlace de la canción (el que sale en "Compartir").');
      return;
    }
    setLinkErr(null);
    updateSong(id, { video: l.video });
    setLink('');
  };

  // En teléfonos, YouTube exige que el primer play sea un toque dentro del video.
  const tryPlay = () => {
    const p = player.current;
    if (!p) return;
    p.play();
    setTimeout(() => player.current && !player.current.playing() && setNeedTap(true), 1600);
  };

  // Con la canción sonando por bocina o TV: mide cuánto de la música llega al micrófono
  // y sube la puerta de ruido para que solo cuente tu voz (que está más cerca).
  const calibrateRoom = async () => {
    setMicErr(null);
    try {
      await unlockAudio();
      await startMic();
    } catch (e) {
      setMicErr(e.message);
      return;
    }
    setCal('run');
    const vals = [];
    const off = onFrame((f) => vals.push(f.rms));
    await new Promise((r) => setTimeout(r, 3000));
    off();
    stopMic();
    vals.sort((a, b) => a - b);
    const p95 = vals.length ? vals[Math.floor(vals.length * 0.95)] : 0.01;
    patchSettings({ roomGate: Math.min(0.3, Math.max(getState().profile.gate, p95 * 2.2)) });
    setCal(p95 > 0.11 ? 'loud' : 'ok');
  };

  const startTake = async () => {
    setMicErr(null);
    if (getState().settings.room && !getState().settings.roomGate) {
      setMicErr('Primero calibra con la canción sonando (botón de arriba).');
      return;
    }
    try {
      await unlockAudio();
      await startMic();
    } catch (e) {
      setMicErr(e.message);
      return;
    }
    const st = getState();
    const inRoom = !!st.settings.room;
    setGate(inRoom ? Math.max(st.profile.gate, st.settings.roomGate) : st.profile.gate);
    setGritSensitivity(st.settings.grit ?? 1);
    frames.current = [];
    t0.current = audioCtx().currentTime;
    // Con música en el cuarto solo cuentan los cuadros con tono muy claro
    offFrame.current = onFrame((f) => frames.current.push({ t: f.t - t0.current, midi: f.midi, voiced: f.voiced && (!inRoom || f.clarity >= 0.8), kind: f.kind, db: f.db, grit: f.grit, clarity: f.clarity, weight: f.weight }));
    if (audio) URL.revokeObjectURL(audio);
    setAudio(null);
    if (window.MediaRecorder) {
      try {
        const chunks = [];
        const r = new MediaRecorder(getStream());
        r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        r.onstop = () => chunks.length && setAudio(URL.createObjectURL(new Blob(chunks, { type: r.mimeType })));
        r.start();
        rec.current = r;
      } catch {
        rec.current = null;
      }
    }
    setReport(null);
    setEvents([]);
    setTaking(true);
    const p = player.current;
    if (p) {
      if (loop) p.seek(loop.a);
      tryPlay();
    }
  };

  const stopTake = () => {
    offFrame.current?.();
    offFrame.current = null;
    if (rec.current?.state === 'recording') rec.current.stop();
    player.current?.pause();
    stopMic();
    setTaking(false);
    const r = analyzeTake(frames.current, getState().profile);
    setReport(r);
    const out = saveSongTake(id, r);
    setEvents(out.events);
    if (getState().settings.sfx) sfx(r.ok && r.score >= MASTER_SCORE ? 'star' : 'pass');
  };

  const draw = (g, w, h) => {
    const fs = frames.current;
    const t = audioCtx().currentTime - t0.current;
    const last = fs.length ? fs[fs.length - 1] : null;
    if (last?.voiced) {
      const v = view.current;
      if (last.midi > v.hi - 3 || last.midi < v.lo + 3) {
        const d = (last.midi - (v.lo + v.hi) / 2) * 0.05;
        v.lo += d;
        v.hi += d;
      }
    }
    drawPitch(g, w, h, { plan: null, frames: fs.slice(-600), now: t, byWeight: true, ...view.current });
  };

  const p = player.current;
  const st = songStatus(song);
  const days = goodDays(song);
  const blocked = harshBlocked(s);
  const hasScream = meta?.tags.includes('scream');

  return html`<div class="screen song-view">
    <header class="top">
      <button class="icon-btn" aria-label="Volver a Canciones" onClick=${onBack}><${Icon} name="back" /></button>
      <span class=${`pill ${st === 'dominada' ? 'ok' : st === 'nueva' ? 'dim' : ''}`}>${STATUS[st]}</span>
    </header>
    <div>
      <h1 class="song-title">${song.title}</h1>
      <p class="muted">${song.artist}${meta ? html` · <${Level} n=${meta.level} /> ${LEVELS[meta.level]}` : ''}</p>
    </div>

    ${song.video
      ? html`<div class="yt" ref=${mount}></div>
          ${err && html`<p class="note warn">${err} <a href=${musicSearchUrl(`${song.artist} ${song.title}`)} target="_blank" rel="noopener">Buscar otra versión</a></p>`}
          ${err && html`<button class="btn ghost small" onClick=${() => updateSong(id, { video: null })}>Cambiar el enlace</button>`}
          ${ready &&
          !err &&
          html`<div class="transport">
              <button class="btn ghost" aria-label="Retroceder 5 segundos" onClick=${() => p.seek(p.time() - 5)}>−5 s</button>
              <button class="btn primary" onClick=${() => (playing ? p.pause() : tryPlay())}><${Icon} name=${playing ? 'stop' : 'play'} fill=${true} size=${18} /> ${playing ? 'Pausa' : 'Reproducir'}</button>
              <button class="btn ghost" aria-label="Adelantar 5 segundos" onClick=${() => p.seek(p.time() + 5)}>+5 s</button>
            </div>
            ${needTap && html`<p class="note">Toca el botón de play <b>dentro del video</b> una vez. Después, los controles de aquí ya responden.</p>`}
            <div class="row-line">
              <span class="num small">${fmt(now)} / ${fmt(dur)}</span>
              <div class="chips">
                ${[0.75, 0.85, 1].filter((r) => rates.includes(r) || r === 1 || rates.length <= 1).map((r) => html`<button class=${`chip ${rate === r ? 'on' : ''}`} onClick=${() => { p.setRate(r); setRate(r); }}>${r === 1 ? 'Normal' : `${r}x`}</button>`)}
              </div>
            </div>
            <div class="loop">
              ${loop
                ? html`<span class="loop-on">Repitiendo ${fmt(loop.a)} → ${fmt(loop.b)}</span>
                    <button class="btn ghost small" onClick=${() => setLoop(null)}>Quitar</button>
                    ${!song.loops.some((l) => l.a === loop.a && l.b === loop.b) &&
                    ['Verso', 'Coro', 'Puente'].map((name) => html`<button class="btn ghost small" onClick=${() => updateSong(id, { loops: [...song.loops.filter((l) => l.name !== name), { name, ...loop }] })}>Guardar como ${name}</button>`)}`
                : markA == null
                  ? html`<button class="btn ghost small" onClick=${() => setMarkA(p.time())}>Repetir un tramo: marcar inicio</button>`
                  : html`<span class="muted small">Inicio en ${fmt(markA)}. Deja correr la canción y…</span>
                      <button class="btn primary small" onClick=${() => { const b = p.time(); if (b - markA > 2) setLoop({ a: markA, b }); setMarkA(null); }}>Marcar fin</button>
                      <button class="btn ghost small" onClick=${() => setMarkA(null)}>Cancelar</button>`}
              ${!loop && song.loops.map((l) => html`<button class="chip" onClick=${() => { setLoop({ a: l.a, b: l.b }); p.seek(l.a); }}>${l.name} ${fmt(l.a)}</button>`)}
            </div>`}`
      : html`<section class="panel">
          <div class="panel-head"><h2>Conecta el audio</h2></div>
          <p class="muted small">Búscala en YouTube Music, toca "Compartir", copia el enlace y pégalo aquí. Se guarda para siempre.</p>
          <a class="btn ghost" href=${musicSearchUrl(`${song.artist} ${song.title}`)} target="_blank" rel="noopener">Buscar en YouTube Music</a>
          <form class="link-form" onSubmit=${attach}>
            <label class="sr" for="song-attach">Enlace de la canción</label>
            <input id="song-attach" type="url" inputmode="url" placeholder="Pega el enlace aquí" value=${link} onInput=${(e) => setLink(e.target.value)} />
            <button class="btn primary" type="submit" disabled=${!link.trim()}>Guardar</button>
          </form>
          ${linkErr && html`<p class="note warn">${linkErr}</p>`}
          <p class="muted small"><b>¿En la TV?</b> Ábrela en la app de YouTube del iPad o del teléfono, toca el ícono de transmitir y elige tu TV. No hace falta pegar enlace: graba la toma aquí abajo mientras suena.</p>
        </section>`}

    <section class="panel">
      <div class="panel-head"><h2>¿Dónde suena la canción?</h2></div>
      <${Choice} value=${room ? 'room' : 'phones'} onPick=${(v) => patchSettings({ room: v === 'room' })} options=${[
        { id: 'phones', title: 'En audífonos', sub: 'Lo más preciso: el micrófono solo te oye a ti' },
        { id: 'room', title: 'En la TV o una bocina', sub: 'Funciona, con menos precisión. Hay que calibrar' },
      ]} />
      ${room &&
      html`<p class="muted small">Pon la canción en su parte más fuerte, <b>sin cantar</b>, y calibra. Luego canta con el micrófono a un palmo de tu boca y la TV a volumen medio, de preferencia a tu espalda.</p>
        <button class="btn ghost" disabled=${cal === 'run' || taking} onClick=${calibrateRoom}>${cal === 'run' ? 'Midiendo… no cantes' : s.settings.roomGate ? 'Volver a calibrar (3 s)' : 'Calibrar con la canción sonando (3 s)'}</button>
        ${cal === 'ok' && html`<p class="note" role="status">Listo. Ahora solo cuenta lo que suene más fuerte que la música en tu micrófono: tu voz de cerca.</p>`}
        ${cal === 'loud' && html`<p class="note warn" role="status">La música llega muy fuerte al micrófono. Baja el volumen de la TV o aléjate de la bocina y vuelve a calibrar.</p>`}`}
    </section>
    ${hasScream && blocked && html`<p class="note warn">Hoy tus guturales están en pausa. Canta solo las partes limpias.</p>`}

    ${taking
      ? html`<${Canvas} draw=${draw} class="pitch short" label="Tu voz en vivo" />
          <button class="btn danger big" onClick=${stopTake}><${Icon} name="stop" fill=${true} size=${20} /> Terminar toma</button>`
      : html`<button class="btn primary big" onClick=${startTake}><${Icon} name="mic" /> ${report ? 'Otra toma' : 'Grabar toma'}</button>`}
    ${micErr && html`<p class="note warn">${micErr}</p>`}

    ${report && !taking && html`<${Report} r=${report} audio=${audio} events=${events} />`}

    ${meta &&
    html`<section class="panel">
      <div class="panel-head"><h2>Qué practicar aquí</h2></div>
      <ul class="focus">
        ${meta.tags.map((t) => html`<li><b>${TAGS[t].name}.</b> ${TAGS[t].tip}</li>`)}
      </ul>
      ${isHero(s, meta.artist) && html`<p class="listen-hint"><b>Es de tus referentes.</b> Antes de cantarla, escucha un tramo completo sin cantar y anota mentalmente en qué voz va cada frase: ligera, llena, mezcla o grito.</p>`}
      <p class="muted small">Trabaja por tramos: primero el coro a 0.75x, luego a velocidad normal, y al final la canción completa.</p>
    </section>`}

    <section class="panel">
      <div class="panel-head"><h2>Tus tomas</h2><span class="num">${song.takes.length}</span></div>
      ${song.takes.length
        ? html`<div class="spark" role="img" aria-label="Puntajes de tus tomas">
            ${song.takes.slice(-24).map((t) => html`<i class=${t.score >= MASTER_SCORE ? 'ok' : t.score >= 60 ? 'warn' : 'bad'} style=${`height:${Math.max(6, t.score)}%`} title=${`${t.day}: ${t.score}`}></i>`)}
          </div>`
        : html`<p class="muted small">Graba tu primera toma para empezar a medir.</p>`}
      <p class="muted small">${song.mastered ? 'Dominada. Sigue en tu repertorio para mantenerla.' : `Para dominarla: ${MASTER_DAYS} días distintos con una toma de ${MASTER_SCORE}+ y al menos 30 s cantando. Llevas ${days}.`}</p>
    </section>

    <div class="row">
      <button class=${`btn ${s.focusSong === id ? 'primary' : 'ghost'}`} aria-pressed=${s.focusSong === id} onClick=${() => setFocusSong(s.focusSong === id ? null : id)}>${s.focusSong === id ? 'Es mi canción en foco' : 'Poner en foco'}</button>
      ${confirmDel
        ? html`<button class="btn danger" onClick=${() => { deleteSong(id); onBack(); }}>Sí, quitarla</button>`
        : html`<button class="btn ghost danger-text" onClick=${() => setConfirmDel(true)}>Quitar del repertorio</button>`}
    </div>
  </div>`;
}

export function Songs({ openId, setOpenId, go }) {
  const s = useStore();
  if (openId && s.songs[openId]) return html`<${SongView} key=${openId} id=${openId} onBack=${() => setOpenId(null)} />`;
  return html`<${Library} onOpen=${setOpenId} go=${go} />`;
}
