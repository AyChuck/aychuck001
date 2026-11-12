// Diagnóstico del micrófono: convierte mediciones crudas en un veredicto entendible
// y separa las tres causas posibles: el dispositivo, el lugar, o el algoritmo de la app.

const db = (x) => 20 * Math.log10(Math.max(x, 1e-7));

/**
 * m: {
 *   alive, contextState, sampleRate, fps, mode, echoCancellation, noiseSuppression, autoGainControl,
 *   noiseRms, voiceRms, peak, clarity, voicedFrac, pitchStd (cents), octaveJumps, note
 * }
 */
export function diagnose(m) {
  const f = [];
  const add = (level, cause, title, body) => f.push({ level, cause, title, body });
  const snr = db(m.voiceRms) - db(m.noiseRms);

  if (!m.alive || m.contextState !== 'running') {
    add('bad', 'device', 'El micrófono no está entregando audio', 'El navegador cortó el micrófono o el audio quedó en pausa. Cierra otras apps que lo usen (llamadas, grabadora, dictado), recarga la página y vuelve a dar permiso.');
  } else if (m.voiceRms < 0.00015) {
    add('bad', 'device', 'Llega silencio total', 'El permiso está dado pero no entra sonido. Revisa que ninguna otra app tenga el micrófono, que no haya audífonos con micrófono conectados que estén lejos, y recarga la página.');
  } else {
    if (snr < 8) {
      add('bad', 'room', 'Tu voz casi no sobresale del ruido', `Solo ${snr.toFixed(0)} dB por encima del fondo. Acerca el iPad a un palmo de tu boca, apaga la TV o el ventilador, o usa audífonos para la música.`);
    } else if (snr < 15) {
      add('warn', 'room', 'Hay bastante ruido de fondo', `Tu voz queda ${snr.toFixed(0)} dB por encima del ruido; lo ideal son 20 o más. Funciona, pero acércate un poco al micrófono.`);
    }
    if (m.peak >= 0.97) add('warn', 'device', 'El micrófono se satura', 'Tu voz llega tan fuerte que se recorta. Aléjate un poco o canta de lado al micrófono.');
    else if (m.voiceRms < 0.003 && snr >= 8) {
      add('ok', 'device', 'Tu micrófono entrega la señal baja', 'Es normal en iPad y iPhone cuando se apagan los filtros de llamada. La app ya se adapta a ese nivel; no hace falta que cantes más fuerte.');
    }
    if (m.clarity < 0.7) {
      add(
        'bad',
        m.noiseSuppression || m.echoCancellation ? 'device' : 'room',
        'El tono llega sucio al micrófono',
        m.noiseSuppression || m.echoCancellation
          ? 'El procesamiento de voz del sistema está activo y deforma las notas sostenidas. Apágalo en Ajustes → Micrófono.'
          : 'Hay eco, ruido o música mezclándose con tu voz. Prueba en un cuarto más callado y más cerca del micrófono.'
      );
    } else if (m.voicedFrac < 0.6) {
      add('warn', 'room', 'Detecté tono solo a ratos', `Mientras cantabas hubo tono claro el ${Math.round(m.voicedFrac * 100)} % del tiempo. Sostén un "aaa" firme, sin aire, a un palmo del micrófono.`);
    }
    // Solo se le achaca a la app si el sonido llegó limpio y fuerte; con ruido, los saltos son esperables
    if (m.clarity >= 0.7 && snr >= 15 && (m.octaveJumps >= 3 || m.pitchStd > 80)) {
      add('bad', 'app', 'La detección de tono está saltando', 'El sonido llega bien, pero la app lee tu nota de forma inestable. Eso es un fallo del algoritmo con tu voz, no tuyo ni del iPad. Copia este reporte y mándalo.');
    }
    if (m.mode === 'raw' && (m.echoCancellation === true || m.noiseSuppression === true)) {
      add('warn', 'device', 'El sistema aplica filtros de llamada', 'La app pidió el micrófono sin filtros, pero el dispositivo los dejó activos. Pueden recortar notas largas y screams. Suele pasar con audífonos bluetooth con micrófono: usa el micrófono del iPad.');
    }
  }
  if (m.sampleRate && m.sampleRate < 32000) {
    add('warn', 'device', 'El audio está en baja calidad', `El sistema entrega ${Math.round(m.sampleRate / 1000)} kHz, típico de audífonos bluetooth usados como micrófono. Usa el micrófono del iPad (los audífonos pueden seguir para escuchar si son de cable).`);
  }
  if (m.fps && m.fps < 24) {
    add('warn', 'device', 'El análisis va lento', `Corre a ${m.fps} cuadros por segundo. Quita el modo de ahorro de batería y cierra otras pestañas pesadas.`);
  }

  const worst = f.some((x) => x.level === 'bad') ? 'bad' : f.some((x) => x.level === 'warn') ? 'warn' : 'ok';
  const causes = [...new Set(f.filter((x) => x.level !== 'ok').map((x) => x.cause))];
  const summary =
    worst === 'ok'
      ? 'El micrófono y la detección funcionan bien aquí. Si un ejercicio falla de todos modos, el problema está en ese ejercicio: dime cuál y qué ves.'
      : causes.includes('app')
        ? 'Hay un problema del algoritmo de la app con tu voz. Manda el reporte para corregirlo.'
        : causes.includes('device') && causes.includes('room')
          ? 'Hay algo del dispositivo y algo del lugar. Sigue las indicaciones de abajo y repite la prueba.'
          : causes.includes('device')
            ? 'El problema viene del dispositivo o de su configuración, no de tu voz.'
            : 'El problema viene del lugar: ruido, distancia al micrófono o música sonando.';
  return { level: worst, causes, summary, findings: f, snr: Math.round(snr) };
}

/** Texto plano para copiar y mandar. */
export function reportText(m, d, extra = {}) {
  const n = (x, digits = 4) => (x == null ? '—' : typeof x === 'number' ? +x.toFixed(digits) : String(x));
  return [
    'CATARSIS · diagnóstico de micrófono',
    `resultado: ${d.level} (${d.causes.join(', ') || 'sin problemas'})`,
    `voz ${n(m.voiceRms)} | ruido ${n(m.noiseRms)} | pico ${n(m.peak, 3)} | SNR ${d.snr} dB`,
    `claridad ${n(m.clarity, 2)} | con tono ${Math.round((m.voicedFrac ?? 0) * 100)} % | nota ${m.note ?? '—'} | desviación ${n(m.pitchStd, 0)} cents | saltos de octava ${m.octaveJumps ?? 0}`,
    `peso ${n(m.weight, 1)} dB | audio ${m.sampleRate} Hz (pista ${m.trackSampleRate ?? '—'}) | ${m.fps} cuadros/s | estado ${m.contextState}`,
    `modo ${m.mode} | eco ${n(m.echoCancellation)} | ruido ${n(m.noiseSuppression)} | ganancia ${n(m.autoGainControl)} | puerta ${n(m.gate)}`,
    `micrófono: ${m.label || '—'}`,
    `navegador: ${extra.userAgent ?? '—'}`,
    `pantalla: ${extra.screen ?? '—'} | app instalada: ${extra.standalone ? 'sí' : 'no'} | guardado persistente: ${extra.persisted ?? '—'}`,
    ...d.findings.map((x) => `- [${x.level}] ${x.title}`),
  ].join('\n');
}
