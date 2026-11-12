// Reproductor de YouTube dentro de la app (API oficial de IFrame).
// YouTube Music no tiene una API propia, pero su catálogo es el de YouTube:
// cualquier enlace de music.youtube.com funciona aquí.

/** Extrae el id de video y/o de playlist de un enlace (o de un id suelto). Función pura. */
export function parseLink(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return null;
  if (/^[\w-]{11}$/.test(raw)) return { video: raw, list: null };
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, '');
  if (!['youtube.com', 'youtu.be', 'youtube-nocookie.com'].includes(host)) return null;
  let video = null;
  if (host === 'youtu.be') video = url.pathname.slice(1).split('/')[0];
  else if (url.pathname === '/watch') video = url.searchParams.get('v');
  else {
    const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/);
    if (m) video = m[1];
  }
  if (video && !/^[\w-]{11}$/.test(video)) video = null;
  let list = url.searchParams.get('list');
  // Las mezclas automáticas (RD…) y "me gusta" (LM/LL) son privadas o infinitas: no se importan
  if (list && (!/^[\w-]{10,}$/.test(list) || /^(RD|LM|LL|WL)/.test(list))) list = null;
  if (!video && !list) return null;
  return { video, list };
}

export const musicSearchUrl = (query) => `https://music.youtube.com/search?q=${encodeURIComponent(query)}`;
export const musicWatchUrl = (video) => `https://music.youtube.com/watch?v=${video}`;

let apiPromise = null;

/** Carga la API una sola vez. Rechaza si no hay conexión con YouTube. */
export function loadYouTube() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise((resolve, reject) => {
    const fail = () => {
      apiPromise = null;
      reject(new Error('No pude conectar con YouTube. Revisa tu internet o si un bloqueador lo está impidiendo.'));
    };
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = fail;
    document.head.appendChild(s);
    setTimeout(() => !window.YT?.Player && fail(), 12000);
  });
  return apiPromise;
}

const ERRORS = {
  2: 'Ese enlace no parece un video válido.',
  5: 'YouTube no pudo reproducir este video aquí.',
  100: 'El video no existe o es privado.',
  101: 'El dueño del video no permite reproducirlo fuera de YouTube. Prueba con otra versión de la canción (por ejemplo la de solo audio).',
  150: 'El dueño del video no permite reproducirlo fuera de YouTube. Prueba con otra versión de la canción (por ejemplo la de solo audio).',
  153: 'YouTube rechazó el reproductor. La app tiene que estar abierta desde su dirección https, no como archivo.',
};
export const youtubeError = (code) => ERRORS[code] ?? 'YouTube no pudo reproducir este video.';

/**
 * Crea un reproductor dentro de `mount` (un elemento vacío).
 * Devuelve una promesa con controles simples; rechaza con un mensaje en español.
 */
export async function createPlayer(mount, { video, list, onState, onError } = {}) {
  const YT = await loadYouTube();
  const el = document.createElement('div');
  mount.replaceChildren(el);
  return new Promise((resolve, reject) => {
    let ready = false;
    const playerVars = { playsinline: 1, rel: 0, modestbranding: 1, origin: location.origin };
    if (list && !video) Object.assign(playerVars, { listType: 'playlist', list });
    const p = new YT.Player(el, {
      width: '100%',
      height: '100%',
      videoId: video ?? undefined,
      playerVars,
      events: {
        onReady: () => {
          ready = true;
          resolve(api);
        },
        onStateChange: (e) => onState?.(e.data),
        onError: (e) => {
          const msg = youtubeError(e.data);
          if (!ready) reject(new Error(msg));
          onError?.(msg, e.data);
        },
      },
    });
    const safe = (fn, fallback) => {
      try {
        return fn() ?? fallback;
      } catch {
        return fallback;
      }
    };
    const api = {
      play: () => safe(() => p.playVideo()),
      pause: () => safe(() => p.pauseVideo()),
      seek: (t) => safe(() => p.seekTo(Math.max(0, t), true)),
      time: () => safe(() => p.getCurrentTime(), 0),
      duration: () => safe(() => p.getDuration(), 0),
      playing: () => safe(() => p.getPlayerState(), -1) === 1,
      setRate: (r) => safe(() => p.setPlaybackRate(r)),
      rates: () => safe(() => p.getAvailablePlaybackRates(), [1]),
      /** { title, author } del video cargado (cuando YouTube lo entrega). */
      info: () => {
        const d = safe(() => p.getVideoData(), null);
        return d?.title ? { title: d.title, author: (d.author ?? '').replace(/ - Topic$/, ''), video: d.video_id } : null;
      },
      playlist: () => safe(() => p.getPlaylist(), null),
      destroy: () => safe(() => p.destroy()),
    };
    setTimeout(() => !ready && reject(new Error('YouTube tardó demasiado en responder.')), 15000);
  });
}

/** Lee los videos de una playlist pública o no listada. Devuelve sus ids. */
export async function readPlaylist(list) {
  const mount = document.createElement('div');
  mount.style.cssText = 'position:fixed;width:200px;height:120px;left:-9999px;top:0;opacity:0;pointer-events:none';
  document.body.appendChild(mount);
  try {
    const p = await createPlayer(mount, { list });
    for (let i = 0; i < 25; i++) {
      const ids = p.playlist();
      if (ids?.length) {
        p.destroy();
        return ids;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    p.destroy();
    throw new Error('No pude leer esa playlist. Tiene que ser pública o "no listada" (las privadas no se pueden abrir desde fuera).');
  } finally {
    mount.remove();
  }
}

/** Título y autor de un video sin reproducirlo (si YouTube lo permite desde el navegador). */
export async function fetchTitle(video) {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${video}`)}`);
    if (!res.ok) return null;
    const d = await res.json();
    return d?.title ? { title: d.title, author: (d.author_name ?? '').replace(/ - Topic$/, '') } : null;
  } catch {
    return null;
  }
}
