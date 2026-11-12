import test from 'node:test';
import assert from 'node:assert/strict';
import { createYin } from '../js/audio/pitch.js';
import { gritFrom } from '../js/audio/features.js';
import { midiToFreq, freqToMidi, midiName, voiceType } from '../js/music/notes.js';
import { SR, N, voice, hiss, scream, analyzeBuf, rng } from './helpers.js';

test('YIN detecta el tono dentro de ±5 cents en todo el rango vocal', () => {
  const yin = createYin(SR, N);
  for (let midi = 36; midi <= 84; midi += 1) {
    const f = midiToFreq(midi + 0.23);
    const { freq, clarity } = yin(voice(f));
    const cents = (freqToMidi(freq) - (midi + 0.23)) * 100;
    assert.ok(Math.abs(cents) < 5, `${midiName(midi)}: error ${cents.toFixed(1)} cents`);
    assert.ok(clarity > 0.9, `${midiName(midi)}: claridad ${clarity}`);
  }
});

test('YIN funciona también a 44.1 kHz y 16 kHz', () => {
  for (const sr of [44100, 16000]) {
    const yin = createYin(sr, N);
    const b = new Float32Array(N);
    for (let i = 0; i < N; i++) b[i] = 0.3 * Math.sin((2 * Math.PI * 220 * i) / sr);
    const cents = (freqToMidi(yin(b).freq) - 57) * 100;
    assert.ok(Math.abs(cents) < 5, `sr ${sr}: ${cents}`);
  }
});

test('YIN aguanta ruido de fondo moderado', () => {
  const yin = createYin(SR, N);
  const r = rng(11);
  const b = voice(196);
  for (let i = 0; i < N; i++) b[i] += (r() * 2 - 1) * 0.03;
  const { freq, clarity } = yin(b);
  assert.ok(Math.abs((freqToMidi(freq) - freqToMidi(196)) * 100) < 10);
  assert.ok(clarity > 0.8);
});

test('clasifica voz limpia, aire, scream y silencio', () => {
  assert.equal(analyzeBuf(voice(220)).kind, 'clean');
  assert.equal(analyzeBuf(hiss()).kind, 'hiss');
  assert.equal(analyzeBuf(new Float32Array(N)).kind, 'silence');
  for (let seed = 1; seed <= 8; seed++) {
    const f = analyzeBuf(scream(N, 0.3, seed));
    assert.equal(f.kind, 'harsh', `seed ${seed}: claridad ${f.clarity.toFixed(2)} hf ${f.hfRatio.toFixed(2)}`);
    assert.ok(gritFrom(f.clarity) > 0.3);
  }
});

test('el centroide distingue sonidos oscuros de brillantes', () => {
  const dark = analyzeBuf(voice(110));
  const bright = analyzeBuf(hiss());
  assert.ok(bright.centroid > dark.centroid * 3);
});

test('nombres de nota y tipo de voz', () => {
  assert.equal(midiName(69), 'A4');
  assert.equal(midiName(40), 'E2');
  assert.equal(voiceType(40, 64), 'Barítono');
  assert.equal(voiceType(48, 72), 'Contralto');
});

test('peso de la voz: distingue voz llena de voz ligera en la misma nota', async () => {
  const { createWeightMeter, weightIndex } = await import('../js/audio/features.js');
  const meter = createWeightMeter(SR, N);
  // Fuente glotal sintética: armónicos que decaen despacio (llena) o rápido (ligera)
  const tone = (f0, tilt) => {
    const b = new Float32Array(N);
    for (let i = 0; i < N; i++) for (let k = 1; k <= 10; k++) b[i] += (0.2 / Math.pow(k, tilt)) * Math.sin((2 * Math.PI * k * f0 * i) / SR + k);
    return b;
  };
  for (const f0 of [131, 196, 262, 330, 440]) {
    const full = meter(tone(f0, 0.8), f0);
    const light = meter(tone(f0, 3), f0);
    assert.ok(full - light > 12, `${f0} Hz: llena ${full.toFixed(1)} dB, ligera ${light.toFixed(1)} dB`);
    assert.ok(weightIndex(full) > weightIndex(light) + 0.4);
  }
  // Un tono puro no tiene armónicos: peso mínimo
  const pure = new Float32Array(N);
  for (let i = 0; i < N; i++) pure[i] = 0.3 * Math.sin((2 * Math.PI * 220 * i) / SR);
  assert.ok(meter(pure, 220) < -25);
  // Aguanta un error pequeño en la frecuencia detectada
  assert.ok(Math.abs(meter(tone(220, 1.2), 220.6) - meter(tone(220, 1.2), 220)) < 1.5);
  assert.equal(meter(pure, 0), null);
  assert.equal(weightIndex(null), null);
});

test('YIN no se va una octava arriba cuando el segundo armónico domina (vocales abiertas, belt)', () => {
  const yin = createYin(SR, N);
  for (const f0 of [110, 147, 196, 262, 330]) {
    for (const [h1, h2, h3, h4] of [[0.12, 1, 0.15, 0.5], [0.2, 1, 0.1, 0.3], [0.08, 1, 0.3, 0.6]]) {
      const b = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const t = i / SR;
        b[i] = 0.25 * (h1 * Math.sin(2 * Math.PI * f0 * t) + h2 * Math.sin(4 * Math.PI * f0 * t + 1) + h3 * Math.sin(6 * Math.PI * f0 * t + 2) + h4 * Math.sin(8 * Math.PI * f0 * t + 0.5));
      }
      const got = yin(b).freq;
      assert.ok(Math.abs(freqToMidi(got) - freqToMidi(f0)) < 0.3, `${f0} Hz con armónicos ${[h1, h2, h3, h4]}: detectó ${got.toFixed(1)}`);
    }
  }
});

test('voz realista (vocales con formantes, temblor y ruido): tono correcto en todo el rango', async () => {
  const { vowelVoice, VOWELS } = await import('./helpers.js');
  const yin = createYin(SR, N);
  let bad = 0;
  let total = 0;
  for (const v of Object.keys(VOWELS)) {
    for (let m = 38; m <= 79; m += 2) {
      for (const tilt of [-9, -14, -22]) {
        const f0 = midiToFreq(m + 0.3);
        const p = yin(vowelVoice(f0, v, { tilt, noise: 0.05, seed: m }));
        total++;
        if (Math.abs(freqToMidi(p.freq) - (m + 0.3)) > 0.4 || p.clarity < 0.8) bad++;
      }
    }
  }
  assert.equal(bad, 0, `${bad} de ${total} mal detectadas`);
});

test('peso de la voz con vocales realistas: confiable en la misma nota y vocal abierta', async () => {
  const { vowelVoice } = await import('./helpers.js');
  const { createWeightMeter } = await import('../js/audio/features.js');
  const meter = createWeightMeter(SR, N);
  for (const v of ['a', 'e', 'o']) {
    // Hasta A4: más arriba la nota se acerca al primer formante y la medida se satura
    for (let m = 45; m <= 69; m++) {
      const f0 = midiToFreq(m);
      const full = meter(vowelVoice(f0, v, { tilt: -10 }), f0);
      const light = meter(vowelVoice(f0, v, { tilt: -20 }), f0);
      assert.ok(full - light >= 6, `${v} ${midiName(m)}: llena ${full.toFixed(1)}, ligera ${light.toFixed(1)}`);
    }
  }
});

test('puerta de ruido adaptativa: sigue el ruido del lugar sin que la voz la mueva', async () => {
  const { createNoiseGate } = await import('../js/audio/features.js');
  // Micrófono muy bajo (iPad sin ganancia): ruido 0.0004, voz 0.006
  const g = createNoiseGate(0.012);
  for (let i = 0; i < 120; i++) g.update(0.0004);
  assert.ok(g.gate() < 0.002, `puerta ${g.gate()}`);
  assert.ok(0.006 > g.gate() * 3, 'la voz baja queda bien por encima de la puerta');
  // 30 segundos cantando o soplando no la suben
  for (let i = 0; i < 1800; i++) g.update(0.006);
  assert.ok(g.gate() < 0.002, `tras cantar: ${g.gate()}`);
  // Si el ruido del cuarto sube un poco (ventilador), la sigue despacio
  for (let i = 0; i < 1200; i++) g.update(0.001);
  assert.ok(g.gate() > 0.0025 && g.gate() < 0.004, `con ventilador: ${g.gate()}`);
  // Calibración explícita
  g.setFloor(0.01);
  assert.ok(Math.abs(g.gate() - 0.032) < 1e-6);
});
