import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLink } from '../js/audio/youtube.js';
import { CATALOG, SCENES, TAGS, LEVELS } from '../js/content/songs.js';
import { LESSONS } from '../js/content/curriculum.js';
import { analyzeTake, segmentNotes, addSong, removeSong, recordSongTake, songStatus, recommend, songReady, tier, heroPicks } from '../js/coach/songs.js';
import { defaultState, record } from '../js/coach/progress.js';

const DAY = 86400000;
const T0 = new Date(2026, 10, 12, 18, 0).getTime();

test('reconoce enlaces de YouTube y YouTube Music', () => {
  const id = 'dQw4w9WgXcQ';
  for (const link of [
    `https://www.youtube.com/watch?v=${id}`,
    `https://music.youtube.com/watch?v=${id}&si=abc123`,
    `https://youtu.be/${id}?t=42`,
    `https://m.youtube.com/watch?v=${id}&feature=share`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube.com/shorts/${id}`,
    `music.youtube.com/watch?v=${id}`,
    `  ${id}  `,
  ]) assert.equal(parseLink(link)?.video, id, link);
  const pl = parseLink('https://music.youtube.com/playlist?list=PLabcdefghijklmnop1234');
  assert.deepEqual(pl, { video: null, list: 'PLabcdefghijklmnop1234' });
  const both = parseLink(`https://www.youtube.com/watch?v=${id}&list=OLAK5uy_abcdefghijklmnop`);
  assert.equal(both.video, id);
  assert.equal(both.list, 'OLAK5uy_abcdefghijklmnop');
});

test('rechaza lo que no es YouTube y las listas privadas o automáticas', () => {
  for (const bad of ['', 'hola', 'https://open.spotify.com/track/abc', 'https://evil.com/watch?v=dQw4w9WgXcQ', 'https://youtube.com/watch?v=corto']) {
    assert.equal(parseLink(bad), null, bad);
  }
  assert.equal(parseLink('https://music.youtube.com/playlist?list=LM'), null);
  assert.equal(parseLink('https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RDAMVMdQw4w9WgXcQ').list, null);
});

test('catálogo: sin duplicados, todo etiquetado y con las bandas pedidas', () => {
  assert.ok(CATALOG.length >= 250, `solo ${CATALOG.length}`);
  assert.equal(new Set(CATALOG.map((s) => s.id)).size, CATALOG.length);
  for (const s of CATALOG) {
    assert.ok(SCENES[s.scene], s.id);
    assert.ok(s.level >= 1 && s.level <= 5 && LEVELS[s.level], s.id);
    assert.ok(s.tags.length, s.id);
    for (const t of s.tags) {
      assert.ok(TAGS[t], `${s.id}: etiqueta ${t}`);
      assert.ok(LESSONS.some((l) => l.id === TAGS[t].lesson), `etiqueta ${t} sin lección`);
    }
  }
  const artists = new Set(CATALOG.map((s) => s.artist));
  for (const a of ['The Used', 'AFI', 'Circa Survive', 'Saosin', 'Avenged Sevenfold', 'Rise Against', 'Bad Omens', 'Sleep Token', 'Falling in Reverse', 'Architects']) {
    assert.ok(artists.has(a), a);
  }
  assert.ok(artists.size >= 90);
  for (const scene of Object.keys(SCENES)) assert.ok(CATALOG.some((s) => s.scene === scene && s.level <= 2), `nada fácil en ${scene}`);
});

/** Canta una lista de notas [midi, segundos] con error en cents y temblor opcionales. */
function sing(notes, { err = 0, wobble = 0, gap = 0.2 } = {}) {
  const frames = [];
  let t = 0;
  let k = 0;
  for (const [midi, secs] of notes) {
    for (let i = 0; i < secs * 50; i++, t += 0.02) {
      const w = wobble ? wobble * Math.sin(k++ * 1.9) : 0;
      frames.push({ t, midi: midi + (err + w) / 100, voiced: true, kind: 'clean', db: -20 });
    }
    for (let i = 0; i < gap * 50; i++, t += 0.02) frames.push({ t, midi: 0, voiced: false, kind: 'silence', db: -60 });
  }
  return frames;
}
const MELODY = [[57, 1], [60, 0.6], [62, 0.6], [64, 2], [62, 0.5], [60, 0.5], [57, 2.5], [55, 1], [57, 3]];

test('separa la toma en notas sostenidas', () => {
  const notes = segmentNotes(sing(MELODY));
  assert.equal(notes.length, MELODY.length);
  assert.ok(Math.abs(notes[3].midi - 64) < 0.01);
  assert.ok(Math.abs(notes[3].dur - 2) < 0.1);
});

test('toma centrada y estable puntúa alto; desafinada y temblorosa, bajo', () => {
  const good = analyzeTake(sing(MELODY), { high: 64 });
  assert.equal(good.ok, true);
  assert.ok(good.score >= 95, `score ${good.score}`);
  assert.equal(good.tips[0].good, true);

  const flat = analyzeTake(sing(MELODY, { err: -32 }), { high: 64 });
  assert.ok(flat.centerScore < 30, `centrado ${flat.centerScore}`);
  assert.ok(flat.bias < -25);
  assert.ok(/bajas/.test(flat.tips[0].title));

  const sharp = analyzeTake(sing(MELODY, { err: 30 }), { high: 64 });
  assert.ok(/altas/.test(sharp.tips[0].title));

  const shaky = analyzeTake(sing(MELODY, { wobble: 45 }), { high: 64 });
  assert.ok(shaky.stableScore < 50, `estabilidad ${shaky.stableScore}`);
  assert.ok(shaky.tips.some((t) => /tiemblan/.test(t.title)));
  assert.ok(shaky.score < good.score - 20);
});

test('avisa si cantas por encima de tu rango y si casi no cantaste', () => {
  const high = analyzeTake(sing(MELODY.map(([m, s]) => [m + 9, s])), { high: 64 });
  assert.ok(high.above > 5);
  assert.ok(/arriba de tu rango/.test(high.tips[0].title));
  assert.ok(Math.round(high.hi) >= 72);
  const none = analyzeTake(sing([[57, 0.5]]), { high: 64 });
  assert.equal(none.ok, false);
  assert.equal(none.score, 0);
});

test('cuenta la distorsión de la toma', () => {
  const frames = sing(MELODY);
  let t = frames[frames.length - 1].t;
  for (let i = 0; i < 150; i++) frames.push({ t: (t += 0.02), midi: 0, voiced: false, kind: 'harsh', db: -18 });
  assert.ok(Math.abs(analyzeTake(frames, { high: 64 }).harshSecs - 3) < 0.3);
});

test('repertorio: agregar, grabar tomas y dominar una canción en 3 días distintos', () => {
  let s = addSong(defaultState(), { cat: 'the-used--the-taste-of-ink', title: 'The Taste of Ink', artist: 'The Used' }, T0);
  const id = 'the-used--the-taste-of-ink';
  assert.equal(s.focusSong, id);
  assert.equal(songStatus(s.songs[id]), 'nueva');
  s = addSong(s, { cat: id, video: 'abcdefghijk' }); // luego se le pega el enlace
  assert.equal(s.songs[id].video, 'abcdefghijk');
  assert.equal(s.songs[id].title, 'The Taste of Ink');

  const report = { ok: true, score: 88, centerScore: 90, stableScore: 85, voicedSecs: 45, harshSecs: 0, hi: 64 };
  // Tres tomas buenas el mismo día no bastan
  for (let i = 0; i < 3; i++) s = recordSongTake(s, id, report, T0 + i * 60000).state;
  assert.equal(songStatus(s.songs[id]), 'trabajo');
  s = recordSongTake(s, id, report, T0 + DAY).state;
  const r = recordSongTake(s, id, report, T0 + 2 * DAY);
  assert.equal(songStatus(r.state.songs[id]), 'dominada');
  assert.ok(r.events.some((e) => e.type === 'songMastered'));
  assert.ok(r.events.some((e) => e.type === 'ach' && e.ach.id === 'songM'));
  assert.ok(r.state.xp > 0);
  assert.ok(r.state.days['2026-11-14']);
  // Una toma sin canto no cuenta
  assert.equal(recordSongTake(r.state, id, { ok: false }, T0 + 3 * DAY).gained, 0);
  assert.equal(removeSong(r.state, id).focusSong, null);
});

test('canción pegada por enlace (fuera del catálogo)', () => {
  const s = addSong(defaultState(), { video: 'abcdefghijk', title: 'Mi canción', artist: 'Alguien' });
  assert.ok(s.songs['yt-abcdefghijk']);
  assert.equal(s.songs['yt-abcdefghijk'].cat, null);
});

test('recomendaciones: al inicio, canciones accesibles y variadas; crecen con tu técnica', () => {
  const s0 = defaultState();
  assert.equal(tier(s0), 1);
  const first = recommend(s0, 6, 20500);
  assert.equal(first.length, 6);
  assert.ok(first.every((x) => x.level <= 2), first.map((x) => `${x.title}:${x.level}`).join());
  assert.equal(new Set(first.map((x) => x.artist)).size, 6);
  assert.ok(new Set(first.map((x) => x.scene)).size >= 3);
  assert.deepEqual(recommend(s0, 6, 20500), first);
  assert.notDeepEqual(recommend(s0, 6, 20501).map((x) => x.id), first.map((x) => x.id));

  // Solo las escenas elegidas
  assert.ok(recommend({ ...s0, taste: ['punk'] }, 5, 20500).every((x) => x.scene === 'punk'));
  // Lo que ya está en el repertorio no se vuelve a sugerir
  const withSong = addSong(s0, { cat: first[0].id, title: first[0].title });
  assert.ok(!recommend(withSong, 6, 20500).some((x) => x.id === first[0].id));

  // Con todo el curso consolidado aparecen canciones más difíciles
  let s = defaultState();
  for (let d = 0; d < 3; d++) for (const l of LESSONS) for (const st of l.steps) s = record(s, st.id, { score: 95, stars: 3 }, T0 + d * DAY).state;
  assert.equal(tier(s), 5);
  assert.ok(recommend(s, 8, 20500).some((x) => x.level >= 4));
  assert.equal(songReady(s, CATALOG.find((x) => x.title === 'The Summoning')).ready, true);
  assert.equal(songReady(s0, CATALOG.find((x) => x.title === 'The Summoning')).ready, false);
});

test('tus referentes: siempre a la vista, y suben en las sugerencias cuando ya tienes la técnica', () => {
  const s0 = defaultState();
  assert.deepEqual(s0.heroes, ['Sleep Token', 'Falling in Reverse', 'Bad Omens']);
  const picks = heroPicks(s0, 6);
  assert.equal(picks.length, 6);
  assert.deepEqual(new Set(picks.slice(0, 3).map((x) => x.artist)), new Set(s0.heroes));
  assert.ok(picks[0].level <= 3);
  assert.ok(CATALOG.find((x) => x.title === 'The Summoning').tags.includes('registros'));
  assert.ok(CATALOG.filter((x) => x.tags.includes('registros')).length >= 15);
  // Con el curso avanzado, los referentes dominan las sugerencias
  let s = defaultState();
  for (let d = 0; d < 3; d++) for (const l of LESSONS) for (const st of l.steps) s = record(s, st.id, { score: 95, stars: 3 }, T0 + d * DAY).state;
  let hits = 0;
  for (let d = 20500; d < 20520; d++) if (recommend(s, 6, d).some((x) => s.heroes.includes(x.artist))) hits++;
  assert.ok(hits >= 18, `solo ${hits} de 20 días`);
});
