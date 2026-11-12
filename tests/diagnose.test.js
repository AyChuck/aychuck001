import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnose, reportText } from '../js/coach/diagnose.js';

const GOOD = { alive: true, contextState: 'running', sampleRate: 48000, fps: 60, mode: 'raw', echoCancellation: false, noiseSuppression: false, autoGainControl: false, noiseRms: 0.0006, voiceRms: 0.03, peak: 0.2, clarity: 0.96, voicedFrac: 0.95, pitchStd: 14, octaveJumps: 0, note: 'A3' };

test('micrófono sano: sin problemas', () => {
  const d = diagnose(GOOD);
  assert.equal(d.level, 'ok');
  assert.deepEqual(d.causes, []);
  assert.ok(d.snr > 30);
});

test('iPad con señal baja pero limpia: se informa, no es un error', () => {
  const d = diagnose({ ...GOOD, noiseRms: 0.00025, voiceRms: 0.002, peak: 0.01 });
  assert.equal(d.level, 'ok');
  assert.ok(d.findings.some((f) => /señal baja/.test(f.title)));
});

test('separa las causas: dispositivo, lugar o algoritmo', () => {
  assert.deepEqual(diagnose({ ...GOOD, alive: false }).causes, ['device']);
  assert.deepEqual(diagnose({ ...GOOD, voiceRms: 0.00001 }).causes, ['device']);
  const noisy = diagnose({ ...GOOD, noiseRms: 0.015 });
  assert.equal(noisy.level, 'bad');
  assert.deepEqual(noisy.causes, ['room']);
  const mid = diagnose({ ...GOOD, noiseRms: 0.007 });
  assert.equal(mid.level, 'warn');
  const algo = diagnose({ ...GOOD, octaveJumps: 6, pitchStd: 300 });
  assert.equal(algo.level, 'bad');
  assert.ok(algo.causes.includes('app'));
  assert.ok(/algoritmo/.test(algo.summary));
  // Con mucho ruido, los saltos de tono no se le achacan al algoritmo
  assert.deepEqual(diagnose({ ...GOOD, noiseRms: 0.015, octaveJumps: 6 }).causes, ['room']);
  // Tono sucio con ruido no se le achaca al algoritmo
  assert.ok(!diagnose({ ...GOOD, clarity: 0.5, pitchStd: 300 }).causes.includes('app'));
  assert.ok(diagnose({ ...GOOD, clarity: 0.5, noiseSuppression: true }).findings.some((f) => /procesamiento de voz/.test(f.body)));
  assert.ok(diagnose({ ...GOOD, sampleRate: 16000 }).findings.some((f) => /baja calidad/.test(f.title)));
  assert.ok(diagnose({ ...GOOD, fps: 15 }).findings.some((f) => /lento/.test(f.title)));
  assert.ok(diagnose({ ...GOOD, peak: 0.99 }).findings.some((f) => /satura/.test(f.title)));
  assert.ok(diagnose({ ...GOOD, echoCancellation: true }).findings.some((f) => /filtros de llamada/.test(f.title)));
});

test('reporte copiable con los datos clave', () => {
  const t = reportText({ ...GOOD, weight: 3.2, gate: 0.002, label: 'iPad Micrófono' }, diagnose(GOOD), { userAgent: 'UA', screen: '820x1180', standalone: true, persisted: true });
  for (const s of ['SNR', '48000 Hz', 'iPad Micrófono', 'UA', 'cuadros/s', 'A3']) assert.ok(t.includes(s), s);
});
