// Prueba de punta a punta con un "cantante virtual".
// Sustituye el micrófono por un sintetizador que canta lo que pide cada ejercicio
// (voz limpia, aire o distorsión) y recorre la bienvenida y una sesión completa.
//
//   npm start            (en otra terminal)
//   node tools/e2e.mjs   (requiere Playwright instalado)
//
// Variables: URL (por defecto http://localhost:5173), SHOTS (carpeta para capturas),
//            SKILL (0..1, qué tan bien canta; por defecto 1)

import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const { chromium } = createRequire(import.meta.url)('playwright');

const URL = process.env.URL ?? 'http://localhost:5173/';
const SHOTS = process.env.SHOTS;
const DETUNE = Number(process.env.DETUNE ?? 0); // cents de desafinación deliberada
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'] });
const ctx = await browser.newContext({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.addInitScript((detune) => {
  const midiToFreq = (m) => 440 * Math.pow(2, (m - 69 + detune / 100) / 12);
  let S = null;
  navigator.mediaDevices.getUserMedia = async () => {
    const { audioCtx } = await import('/js/audio/engine.js');
    const c = audioCtx();
    const dest = c.createMediaStreamDestination();
    const mk = () => {
      const g = c.createGain();
      g.gain.value = 0;
      g.connect(dest);
      return g;
    };
    // Voz limpia
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2200;
    const gv = mk();
    osc.connect(lp).connect(gv);
    osc.start();
    // Voz ligera (cabeza/falsete): casi solo la fundamental
    const osc2 = c.createOscillator();
    osc2.type = 'sine';
    const gl = mk();
    osc2.connect(gl);
    osc2.start();
    // Aire ("sss")
    const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const hiss = c.createBufferSource();
    hiss.buffer = nb;
    hiss.loop = true;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 5000;
    const gh = mk();
    hiss.connect(hp).connect(gh);
    hiss.start();
    // Distorsión: pulsos irregulares + ruido en banda media
    const sb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const sd = sb.getChannelData(0);
    let next = 0;
    let a = 0;
    let b = 0;
    for (let i = 0; i < sd.length; i++) {
      let x = (Math.random() * 2 - 1) * 0.6;
      if (i >= next) {
        x += (0.6 + Math.random() * 0.8) * 3;
        next = i + Math.round((c.sampleRate / 140) * (0.55 + Math.random() * 0.9));
      }
      a += 0.25 * (x - a);
      b += 0.25 * (a - b);
      sd[i] = b;
    }
    const scr = c.createBufferSource();
    scr.buffer = sb;
    scr.loop = true;
    const gs = mk();
    scr.connect(gs);
    scr.start();
    S = { c, osc, osc2, gv, gl, gh, gs };
    return dest.stream;
  };

  const F = {
    set(f, t) {
      S.osc.frequency.setValueAtTime(f, t);
      S.osc2.frequency.setValueAtTime(f, t);
    },
    ramp(f, t) {
      S.osc.frequency.exponentialRampToValueAtTime(f, t);
      S.osc2.frequency.exponentialRampToValueAtTime(f, t);
    },
  };
  const on = (g, t0, t1, v) => {
    g.gain.setValueAtTime(v, t0);
    g.gain.setValueAtTime(0, t1);
  };

  window.__singSiren = (lo, hi, secs) => {
    const t = S.c.currentTime + 0.3;
    F.set(midiToFreq(lo), t);
    F.ramp(midiToFreq(hi), t + secs / 2);
    F.ramp(midiToFreq(lo), t + secs);
    on(S.gv, t, t + secs, 0.3);
  };

  window.__singMelody = (midis, secs) => {
    let t = S.c.currentTime + 0.2;
    for (const m of midis) {
      F.set(midiToFreq(m), t);
      on(S.gv, t, t + secs - 0.12, 0.3);
      t += secs;
    }
  };

  const realFetch = window.fetch.bind(window);
  window.fetch = (url, ...rest) =>
    String(url).includes('youtube.com/oembed')
      ? Promise.resolve(new Response(JSON.stringify({ title: 'Canción de prueba', author_name: 'Banda - Topic' }), { headers: { 'Content-Type': 'application/json' } }))
      : realFetch(url, ...rest);

  // YouTube simulado: desde el entorno de pruebas no hay acceso a youtube.com
  window.YT = {
    Player: class {
      constructor(el, opts) {
        this.opts = opts;
        this.state = -1;
        this.t = 0;
        this.rate = 1;
        const f = document.createElement('iframe');
        f.srcdoc = '<body style="margin:0;background:#111;color:#888;font:14px sans-serif;display:grid;place-items:center;height:100vh">YouTube (simulado)</body>';
        el.replaceWith(f);
        this.f = f;
        window.__ytLast = this;
        setInterval(() => this.state === 1 && (this.t += 0.1 * this.rate), 100);
        setTimeout(() => opts.events.onReady({ target: this }), 50);
      }
      playVideo() { this.state = 1; }
      pauseVideo() { this.state = 2; }
      seekTo(t) { this.t = t; }
      getCurrentTime() { return this.t; }
      getDuration() { return 215; }
      getPlayerState() { return this.state; }
      setPlaybackRate(r) { this.rate = r; }
      getAvailablePlaybackRates() { return [0.25, 0.5, 0.75, 1, 1.25]; }
      getVideoData() { return { title: 'Video de prueba', author: 'Canal - Topic', video_id: this.opts.videoId }; }
      getPlaylist() { return ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc']; }
      destroy() { this.f.remove(); }
    },
  };

  window.__perform = () => {
    const { plan, t0 } = window.__take;
    const lag = 0.03;
    if (plan.view === 'pitch') {
      for (const n of plan.notes) {
        if (n.seg !== 'sing') continue;
        F.set(midiToFreq(n.midi), t0 + n.t0 + lag);
        // Registro pedido: llena = timbre rico, ligera = casi senoidal, mezcla = entre las dos
        if (n.reg === 'head') on(S.gl, t0 + n.t0 + lag, t0 + n.t1, 0.3);
        else if (n.reg === 'mix') {
          on(S.gl, t0 + n.t0 + lag, t0 + n.t1, 0.3);
          on(S.gv, t0 + n.t0 + lag, t0 + n.t1, 0.1);
        } else on(S.gv, t0 + n.t0 + lag, t0 + n.t1, 0.3);
      }
      for (const p of plan.paths) {
        F.set(midiToFreq(p.pts[0][1]), t0 + p.t0 + lag);
        for (const [t, m] of p.pts.slice(1)) F.ramp(midiToFreq(m), t0 + t);
        on(S.gv, t0 + p.t0 + lag, t0 + p.t1, 0.3);
      }
    } else if (plan.rhythm) {
      for (const h of plan.hits) if (h.seg === 'sing') on(S.gs, t0 + h.t + lag, t0 + h.t + 0.13, 0.5);
    } else {
      for (const w of plan.windows) {
        if (w.expect === 'harsh') on(S.gs, t0 + w.t0 + lag, t0 + w.t1, 0.5);
        if (w.expect === 'clean') {
          F.set(150, t0 + w.t0);
          on(S.gv, t0 + w.t0 + lag, t0 + w.t1 - 0.05, 0.3);
        }
        if (w.expect === 'hiss') on(S.gh, t0 + w.t0 + 0.2, t0 + w.t0 + 0.2 + plan.target + 1, 0.5);
      }
    }
    return plan.dur;
  };
}, DETUNE);

const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png` });
const click = (text) => page.getByRole('button', { name: text }).first().click();
const results = [];

await page.goto(URL);
await shot('01-bienvenida');
await click('Empezar');
await click('Seguir'); // objetivo
await click('Seguir'); // experiencia
await click('Sí, con audífonos');
await click('Seguir');
await click('Activar micrófono');
await page.getByText('Se mueve, seguir').waitFor({ timeout: 8000 });
await shot('02-microfono');
await click('Se mueve, seguir');
await shot('03-rango-intro');
await click('Empezar prueba');
await page.evaluate(() => window.__singSiren(43, 67, 6.5));
await page.waitForTimeout(7000);
await page.evaluate(() => window.__singSiren(43, 67, 6));
await shot('04-rango-en-curso');
await page.getByText('Usar este rango').waitFor({ timeout: 12000 });
const rangeText = await page.locator('.ob-body h1').innerText();
await shot('05-rango-resultado');
await click('Usar este rango');
await shot('06-reglas');
await click('Entendido, vamos');
await shot('07-hoy');

// Recorre los pasos del reproductor hasta el resumen, cantando lo que pida cada toma.
const shots = {};
async function drive() {
  for (let guard = 0; guard < 80; guard++) {
    const state = await page.evaluate(() => {
      const q = (s) => !!document.querySelector(s);
      if (q('.summary')) return 'summary';
      if (q('.result')) return 'result';
      if (q('.take')) return 'take';
      if (q('.pacer')) return 'pacer';
      if (q('.cardstep')) return 'card';
      if (q('.throat')) return 'throat';
      if (q('.intro')) return 'intro';
      return 'unknown';
    });
    if (state === 'summary') return;
    if (state === 'card') {
      if (!shots.card) { await shot('08-tarjeta'); shots.card = true; }
      await page.locator('.cardstep .btn.primary').click();
    } else if (state === 'throat') {
      if (!shots.throat) { await shot('20-garganta'); shots.throat = true; }
      await click('Bien');
    } else if (state === 'pacer') {
      await page.waitForTimeout(1500);
    } else if (state === 'intro') {
      const title = await page.locator('.intro h2').innerText();
      if (!shots.intro) { await shot('09-intro'); shots.intro = true; }
      await page.locator('.intro .btn.primary').click();
      if (!(await page.locator('.take').count())) continue;
      await page.waitForFunction(() => window.__take && document.querySelector('.hud-label')?.textContent !== 'Preparando micrófono', null, { timeout: 8000 });
      const info = await page.evaluate(() => {
        const p = window.__take.plan;
        return { dur: window.__perform(), kind: p.view === 'pitch' ? (p.paths.length ? 'slide' : p.reg ? 'registro' : p.notes.some((n) => n.text) ? 'lyrics' : 'pitch') : p.rhythm ? 'rhythm' : p.endOnSilence ? 'breath' : 'windows' };
      });
      await page.waitForTimeout(Math.min(info.dur * 0.6, 7) * 1000);
      if (!shots[info.kind]) { await shot(`10-toma-${info.kind}`); shots[info.kind] = true; }
      await page.locator('.result').waitFor({ timeout: (info.dur + 6) * 1000 });
      const score = Number(await page.locator('.score-ring .num').innerText());
      const tips = await page.locator('.tip b').allInnerTexts();
      const replay = await page.locator('.replay audio').count();
      results.push({ title, kind: info.kind, score, tips, replay });
      if (!shots['r-' + info.kind]) { await shot(`12-resultado-${info.kind}`); shots['r-' + info.kind] = true; }
      await page.evaluate(() => (window.__take = null));
      await page.locator('.result .row .btn').last().click();
    } else if (state === 'result') {
      await page.locator('.result .row .btn').last().click();
    } else {
      await page.waitForTimeout(300);
    }
  }
  throw new Error('La sesión no terminó');
}

// Sesión del día
await page.locator('.hero-card .btn.primary').click();
await drive();
await shot('13-resumen');
const summary = await page.locator('.summary').innerText();
await page.getByRole('button', { name: 'Listo por hoy' }).click();
await shot('14-hoy-despues');

// Lecciones sueltas desde la Ruta (se marcan todas como aprobadas para abrir las etapas)
await page.evaluate(async () => {
  const { LESSONS } = await import('/js/content/curriculum.js');
  const st = JSON.parse(localStorage.getItem('catarsis.v1'));
  for (const l of LESSONS) for (const x of l.steps) st.ex[x.id] = { plays: 2, best: 85, last: 85, ts: Date.now() - 3 * 86400000, ease: 0, fails: 0, ...st.ex[x.id], grade: 2, due: Date.now() + 5 * 86400000 };
  for (const l of LESSONS) st.started[l.id] ??= '2026-01-01';
  localStorage.setItem('catarsis.v1', JSON.stringify(st));
});
await page.reload();
const TOUR = (process.env.TOUR ?? 'Vocal fry: la semilla del scream|El interruptor|Voz mixta|Ritmo de breakdown|Coro que levanta|Limpio, scream, limpio|Graves, medios y agudos').split('|');
for (const name of TOUR) {
  await page.getByRole('button', { name: 'Ruta' }).first().click();
  await page.locator('.lesson-row', { hasText: name }).click();
  if (!shots.ruta) { await shot('15-ruta'); shots.ruta = true; }
  await page.locator('.lesson-detail .btn.primary').click();
  await drive();
  await page.getByRole('button', { name: 'Listo por hoy' }).click();
}

// Canciones: del catálogo al repertorio, enlace, toma y reporte
await page.getByRole('button', { name: 'Canciones' }).first().click();
await shot('21-canciones');
await page.locator('.song-row .song-main').first().click();
await page.locator('.song-detail .btn.primary').first().click();
await page.locator('#song-attach').fill('https://music.youtube.com/watch?v=abcdefghijk&si=x');
await click('Guardar');
await page.locator('.transport').waitFor({ timeout: 8000 });
await shot('22-cancion');
await click('Grabar toma');
await page.locator('canvas.roll').waitFor();
await page.waitForTimeout(400);
const ytPlaying = await page.evaluate(() => window.__ytLast?.state === 1);
await page.evaluate(() => window.__singMelody([57, 60, 62, 64, 62, 60, 57, 55, 57], 0.9));
await page.waitForTimeout(4500);
await shot('23-cancion-toma');
await page.waitForTimeout(4500);
await click('Terminar toma');
await page.locator('.report').waitFor();
const songScore = Number(await page.locator('.report .score-ring .num').innerText());
await shot('24-cancion-reporte');
const songSaved = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('catarsis.v1')).songs)[0]);
await page.locator('.song-view .icon-btn').first().click();

await page.getByRole('button', { name: 'Progreso' }).last().click();
await shot('16-progreso');
await page.getByRole('button', { name: 'Hoy' }).first().click();
await shot('25-hoy-con-cancion');
await page.getByRole('button', { name: 'Ajustes' }).click();
await shot('17-ajustes');
await page.evaluate(() => (location.hash = 'libre'));
await click('Abrir micrófono');
await page.locator('.tuner').waitFor();
await page.waitForTimeout(300);
await page.evaluate(() => window.__singSiren(50, 57, 3));
await page.waitForTimeout(1600);
await shot('18-libre');

const song = { ytPlaying, songScore, takes: songSaved?.takes?.length, video: songSaved?.video };
console.log(JSON.stringify({ rangeText, results, song, summary: summary.split('\n').slice(0, 8), errors }, null, 2));
await browser.close();
// El cantante virtual no cambia el color del scream ni el volumen, así que esas tomas no se exigen.
const bad = results.filter((r) => r.score < 80 && !['GRAVES, MEDIOS Y AGUDOS', 'TRES COLORES', 'CORO: BRASAS'].includes(r.title.toUpperCase()));
if (DETUNE === 0 && (errors.length || bad.length || !results.length || !(song.songScore >= 80) || song.takes !== 1 || !song.ytPlaying)) {
  console.error('FALLÓ', { errors, bad });
  process.exit(1);
}
