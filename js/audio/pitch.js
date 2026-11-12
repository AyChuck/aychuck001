// Detector de tono YIN (de Cheveigné & Kawahara, 2002).
// Función pura: recibe un buffer de audio y devuelve frecuencia + claridad.
// "Claridad" = qué tan periódica es la señal (1 = tono limpio, ~0 = ruido).
// Esa misma medida es la base del medidor de distorsión para los guturales.

export function createYin(sampleRate, size, opts = {}) {
  const minF = opts.minF ?? 62;
  const maxF = opts.maxF ?? 1200;
  const threshold = opts.threshold ?? 0.15;

  // Diezmamos x2 a tasas altas: 4 veces menos cómputo y precisión de sobra para voz.
  const dec = sampleRate >= 32000 ? 2 : 1;
  const sr = sampleRate / dec;
  const n = Math.floor(size / dec);
  const tauMin = Math.max(2, Math.floor(sr / maxF));
  const tauMax = Math.min(Math.floor(sr / minF), Math.floor(n / 2));
  const win = n - tauMax;
  const x = new Float32Array(n);
  const d = new Float32Array(tauMax + 1);

  return function detect(buf) {
    if (dec === 2) {
      for (let i = 0; i < n; i++) x[i] = 0.5 * (buf[2 * i] + buf[2 * i + 1]);
    } else {
      x.set(buf.subarray(0, n));
    }

    // Función de diferencia
    for (let tau = 1; tau <= tauMax; tau++) {
      let sum = 0;
      for (let j = 0; j < win; j++) {
        const diff = x[j] - x[j + tau];
        sum += diff * diff;
      }
      d[tau] = sum;
    }

    // Normalización por media acumulada
    d[0] = 1;
    let running = 0;
    for (let tau = 1; tau <= tauMax; tau++) {
      running += d[tau];
      d[tau] = running > 0 ? (d[tau] * tau) / running : 1;
    }

    // Primer valle bajo el umbral (evita errores de octava)
    let tau = -1;
    for (let t = tauMin; t <= tauMax; t++) {
      if (d[t] < threshold) {
        while (t + 1 <= tauMax && d[t + 1] < d[t]) t++;
        tau = t;
        break;
      }
    }
    if (tau === -1) {
      let best = Infinity;
      for (let t = tauMin; t <= tauMax; t++) {
        if (d[t] < best) {
          best = d[t];
          tau = t;
        }
      }
    }

    const clarity = Math.max(0, Math.min(1, 1 - d[tau]));

    // Interpolación parabólica para precisión sub-muestra
    let refined = tau;
    if (tau > 1 && tau < tauMax) {
      const a = d[tau - 1];
      const b = d[tau];
      const c = d[tau + 1];
      const denom = a + c - 2 * b;
      if (denom !== 0) refined = tau + (a - c) / (2 * denom);
    }

    return { freq: sr / refined, clarity };
  };
}
