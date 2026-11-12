// Pantallas principales: Hoy, Ruta, Progreso y Ajustes.

import { html, useState, useMemo, useRef } from '../lib.js';
import { Icon, Stars, Bar, Toggle, Choice } from './common.js';
import { RangeTest } from './Onboarding.js';
import { buildSession, lessonSession, estimateMinutes } from '../coach/planner.js';
import {
  streak, week, level, lessonStatus, stageStatus, stepStatus, nextLesson, harshBlocked, harshLeft, lessonAllowed,
  dayKey, SKILLS, ACHIEVEMENTS, HARSH_BUDGET,
} from '../coach/progress.js';
import { LESSONS, STAGES, TRACKS, isScored, isHarsh, stepById } from '../content/curriculum.js';
import { midiName, voiceType, rangeLabel } from '../music/notes.js';
import { startMic, calibrate, unlockAudio } from '../audio/engine.js';
import { useStore, patchSettings, patchProfile, exportData, importData, resetAll } from '../store.js';

// ───────────────────────── Hoy ─────────────────────────

function sessionOutline(ses) {
  const out = [];
  const push = (x) => out[out.length - 1] !== x && out.push(x);
  for (const s of ses.steps) {
    if (s.id.startsWith('w-')) push('Calentar');
    else if (s.id.startsWith('c-')) push('Enfriar');
    else if (ses.lessons?.some((l) => l.id === s.lesson)) push(ses.lessons.find((l) => l.id === s.lesson).title);
    else if (s.kind !== 'card') push(`Repaso: ${s.title}`);
  }
  return out;
}

export function Home({ onStart, go }) {
  const s = useStore();
  const daily = useMemo(() => buildSession(s, 'daily'), [s]);
  const quick = useMemo(() => buildSession(s, 'quick'), [s]);
  const lv = level(s.xp);
  const days = week(s);
  const st = streak(s);
  const today = s.days[dayKey()];
  const blocked = harshBlocked(s);
  const upcoming = nextLesson(s);
  const mins = estimateMinutes(daily.steps);

  return html`<div class="screen">
    <header class="top">
      <div class="wordmark sm">CATARSIS</div>
      <button class="level-chip" onClick=${() => go('progreso')} aria-label="Ver progreso">
        <span class="num">Nv ${lv.lvl}</span> ${lv.rank}
      </button>
    </header>

    <section class="hero-card">
      <div class="eyebrow">${today ? 'Hoy ya cantaste' : 'Sesión de hoy'} · ${mins} min</div>
      <h1>${upcoming ? upcoming.title : 'Repaso libre'}</h1>
      <ol class="outline">
        ${sessionOutline(daily).map((x) => html`<li>${x}</li>`)}
      </ol>
      <button class="btn primary big" onClick=${() => onStart(daily)}><${Icon} name="play" fill=${true} size=${20} /> ${today ? 'Otra ronda' : 'Empezar'}</button>
      <button class="btn ghost" onClick=${() => onStart(quick)}><${Icon} name="clock" size=${18} /> Solo tengo 2 minutos</button>
    </section>

    ${blocked &&
    html`<div class="note ${blocked === 'hurt' ? 'warn' : ''}">
      <b>Guturales en pausa.</b> ${blocked === 'budget' ? 'Ya usaste tus 4 minutos de hoy.' : blocked === 'hurt' ? 'Tu garganta descansa 24 horas. Agua y nada de susurrar.' : 'Tu garganta descansa unas horas.'} Lo demás sigue abierto.
    </div>`}

    <section class="panel">
      <div class="panel-head">
        <h2>Racha</h2>
        <span class="num big">${st} <small>${st === 1 ? 'día' : 'días'}</small></span>
      </div>
      <div class="week">
        ${days.map((d) => html`<div class=${`day ${d.done ? 'done' : ''} ${d.today ? 'today' : ''} ${d.future ? 'future' : ''}`}><i>${d.done ? html`<${Icon} name="check" size=${14} />` : ''}</i><span>${d.label}</span></div>`)}
      </div>
      <p class="muted small">Puedes faltar un día sin perderla. Dos seguidos, sí.</p>
    </section>

    <div class="row">
      <button class="tile" onClick=${() => go('ruta')}><${Icon} name="route" /><b>Ruta</b><small>${LESSONS.filter((l) => lessonStatus(s, l).done).length} de ${LESSONS.filter((l) => lessonAllowed(s, l)).length} lecciones</small></button>
      <button class="tile" onClick=${() => go('libre')}><${Icon} name="mic" /><b>Práctica libre</b><small>Afinador y grabadora</small></button>
    </div>
  </div>`;
}

// ───────────────────────── Ruta ─────────────────────────

export function Path({ onStart }) {
  const s = useStore();
  const [open, setOpen] = useState(null);
  const next = nextLesson(s);

  return html`<div class="screen">
    <header class="top"><h1 class="title">Ruta</h1></header>
    ${STAGES.map((stage, si) => {
      const ss = stageStatus(s, stage.id);
      const lessons = LESSONS.filter((l) => l.stage === stage.id && lessonAllowed(s, l));
      return html`<section class=${`stage ${ss.unlocked ? '' : 'locked'}`}>
        <div class="stage-head">
          <div>
            <div class="eyebrow">Etapa ${si + 1}</div>
            <h2>${stage.name}</h2>
            <p class="muted small">${ss.unlocked ? stage.blurb : `Se abre al terminar la mayoría de "${STAGES[si - 1].name}"`}</p>
          </div>
          ${ss.unlocked ? html`<span class="num">${lessons.filter((l) => lessonStatus(s, l).done).length}/${lessons.length}</span>` : html`<${Icon} name="lock" />`}
        </div>
        ${ss.unlocked &&
        html`<ul class="lessons">
          ${lessons.map((l) => {
            const ls = lessonStatus(s, l);
            const isOpen = open === l.id;
            return html`<li class=${`lesson ${ls.done ? 'done' : ''} ${next?.id === l.id ? 'next' : ''}`}>
              <button class="lesson-row" aria-expanded=${isOpen} onClick=${() => setOpen(isOpen ? null : l.id)}>
                <span class=${`track t-${l.track}`}><${Icon} name=${TRACKS[l.track].art} size=${20} /></span>
                <span class="lesson-text"><b>${l.title}</b><small>${TRACKS[l.track].name} · ${l.blurb}</small></span>
                ${ls.done ? html`<${Stars} n=${ls.stars} />` : next?.id === l.id ? html`<span class="pill">Sigue</span>` : ls.started ? html`<span class="pill dim">En curso</span>` : ''}
              </button>
              ${isOpen &&
              html`<div class="lesson-detail">
                ${l.listen && html`<p class="listen-hint"><b>Para el oído.</b> ${l.listen}</p>`}
                <ul class="steps">
                  ${l.steps.filter((x) => x.kind !== 'card').map((x) => {
                    const xs = stepStatus(s, x);
                    return html`<li><span>${x.title}</span>${isScored(x) ? (xs.plays ? html`<span class="num small">${Math.round(xs.best)}</span>` : html`<span class="muted small">nuevo</span>`) : xs.done ? html`<${Icon} name="check" size=${16} />` : ''}</li>`;
                  })}
                </ul>
                <button class="btn primary" onClick=${() => onStart(lessonSession(s, l))}><${Icon} name="play" fill=${true} size=${18} /> ${ls.done ? 'Practicar otra vez' : 'Empezar lección'} · ${estimateMinutes(lessonSession(s, l).steps)} min</button>
              </div>`}
            </li>`;
          })}
        </ul>`}
      </section>`;
    })}
  </div>`;
}

// ───────────────────────── Progreso ─────────────────────────

function Keyboard({ low, high, firstLow, firstHigh }) {
  const from = 36;
  const to = 84;
  const keys = [];
  for (let m = from; m <= to; m++) {
    const pc = m % 12;
    const black = [1, 3, 6, 8, 10].includes(pc);
    const inRange = m >= low && m <= high;
    const grown = inRange && firstLow != null && (m < firstLow || m > firstHigh);
    keys.push(html`<i class=${`${black ? 'b' : 'w'} ${inRange ? 'in' : ''} ${grown ? 'grown' : ''}`} title=${midiName(m)}></i>`);
  }
  return html`<div class="kb-wrap">
    <div class="kb">${keys}</div>
    <div class="kb-labels">${[36, 48, 60, 72, 84].map((m) => html`<span>${midiName(m)}</span>`)}</div>
  </div>`;
}

export function Progress() {
  const s = useStore();
  const lv = level(s.xp);
  const p = s.profile;
  const recent = s.history.slice(-24);
  const grown = p.firstHigh != null ? p.high - p.low - (p.firstHigh - p.firstLow) : 0;

  return html`<div class="screen">
    <header class="top"><h1 class="title">Progreso</h1></header>

    <section class="panel">
      <div class="panel-head"><h2>Nivel ${lv.lvl}</h2><span class="rank">${lv.rank}</span></div>
      <${Bar} value=${(lv.into / lv.need) * 100} tone="ember" label="Para el siguiente nivel" right=${`${lv.into} / ${lv.need} XP`} />
      <div class="stat-row">
        <div class="stat"><span class="num">${streak(s)}</span><small>racha</small></div>
        <div class="stat"><span class="num">${Object.keys(s.days).length}</span><small>días cantados</small></div>
        <div class="stat"><span class="num">${s.xp}</span><small>XP total</small></div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Tu rango</h2><span class="num">${midiName(p.low)}–${midiName(p.high)}</span></div>
      <${Keyboard} low=${p.low} high=${p.high} firstLow=${p.firstLow} firstHigh=${p.firstHigh} />
      <p class="muted small">
        ${rangeLabel(p.low, p.high)} de rango de trabajo, cercano a ${voiceType(p.low, p.high).toLowerCase()}.
        ${grown > 0 ? ` Creció ${grown} semitono${grown > 1 ? 's' : ''} desde que empezaste.` : p.tested ? '' : ' Haz la prueba de rango en Ajustes para afinarlo.'}
      </p>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Dominio por área</h2></div>
      ${Object.entries(SKILLS)
        .filter(([k]) => !(p.goal === 'clean' && k === 'harsh'))
        .map(([k, name]) => html`<${Bar} label=${name} value=${s.mastery[k] ?? 0} tone=${k === 'harsh' ? 'ember' : 'ice'} right=${s.mastery[k] != null ? Math.round(s.mastery[k]) : 'sin datos'} />`)}
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Últimas tomas</h2></div>
      ${recent.length
        ? html`<div class="spark" role="img" aria-label="Puntajes de tus últimas tomas">
            ${recent.map((h) => html`<i class=${h.score >= 75 ? 'ok' : h.score >= 55 ? 'warn' : 'bad'} style=${`height:${Math.max(6, h.score)}%`} title=${`${stepById(h.id)?.title ?? ''}: ${h.score}`}></i>`)}
          </div>`
        : html`<p class="muted">Aquí van a aparecer tus puntajes después de la primera sesión.</p>`}
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Logros</h2><span class="num">${Object.keys(s.ach).length}/${ACHIEVEMENTS.length}</span></div>
      <ul class="achs">
        ${ACHIEVEMENTS.map((a) => html`<li class=${s.ach[a.id] ? 'on' : ''}><${Icon} name=${s.ach[a.id] ? 'star' : 'lock'} size=${18} fill=${!!s.ach[a.id]} /><span><b>${a.name}</b><small>${a.desc}</small></span></li>`)}
      </ul>
    </section>
  </div>`;
}

// ───────────────────────── Ajustes ─────────────────────────

export function Settings() {
  const s = useStore();
  const [range, setRange] = useState(false);
  const [msg, setMsg] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [backup, setBackup] = useState(null);
  const file = useRef(null);

  if (range) {
    return html`<div class="screen">
      <button class="icon-btn" aria-label="Volver" onClick=${() => setRange(false)}><${Icon} name="back" /></button>
      <${RangeTest}
        onDone=${(r) => {
          patchProfile({ low: r.low, high: r.high, refDb: r.refDb, tested: true, firstLow: s.profile.firstLow ?? r.low, firstHigh: s.profile.firstHigh ?? r.high });
          setRange(false);
          setMsg('Rango actualizado.');
        }} />
    </div>`;
  }

  const recalibrate = async () => {
    try {
      await unlockAudio();
      await startMic();
      setMsg('Guarda silencio un segundo…');
      const gate = await calibrate(1500);
      patchProfile({ gate });
      setMsg('Micrófono calibrado.');
    } catch (e) {
      setMsg(e.message);
    }
  };

  const onImport = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      importData(await f.text());
      setMsg('Progreso restaurado.');
    } catch {
      setMsg('Ese archivo no es un respaldo válido.');
    }
    e.target.value = '';
  };

  return html`<div class="screen">
    <header class="top"><h1 class="title">Ajustes</h1></header>
    ${msg && html`<div class="note" role="status">${msg}</div>`}

    <section class="panel">
      <div class="panel-head"><h2>Sonido</h2></div>
      <${Toggle} id="set-hp" label="Uso audífonos" hint="La guía y la base suenan también mientras cantas" checked=${s.settings.headphones} onChange=${(v) => patchSettings({ headphones: v })} />
      <${Toggle} id="set-guide" label="Nota guía mientras canto" hint="Solo con audífonos" checked=${s.settings.guide} onChange=${(v) => patchSettings({ guide: v })} />
      <${Toggle} id="set-sfx" label="Sonidos de resultado" checked=${s.settings.sfx} onChange=${(v) => patchSettings({ sfx: v })} />
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Exigencia de afinación</h2></div>
      <${Choice} value=${s.settings.strict} onPick=${(v) => patchSettings({ strict: v })} options=${[
        { id: 0, title: 'Suave', sub: 'Margen amplio, para empezar' },
        { id: 1, title: 'Normal', sub: 'Medio semitono de margen' },
        { id: 2, title: 'Estricta', sub: 'Para pulir' },
      ]} />
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Tu voz</h2></div>
      <${Choice} value=${s.profile.goal} onPick=${(v) => patchProfile({ goal: v })} options=${[
        { id: 'both', title: 'Limpios y guturales' },
        { id: 'clean', title: 'Solo voz limpia' },
        { id: 'harsh', title: 'Sobre todo guturales' },
      ]} />
      ${s.profile.goal !== 'clean' &&
      html`<div class="bar-head"><span>Detector de distorsión</span></div>
        <${Choice} value=${s.settings.grit ?? 1} onPick=${(v) => patchSettings({ grit: v })} options=${[
          { id: 0, title: 'Menos sensible', sub: 'Si tu voz limpia aireada cuenta como distorsión' },
          { id: 1, title: 'Normal' },
          { id: 2, title: 'Más sensible', sub: 'Si tus screams salen marcados como limpios' },
        ]} />`}
      <div class="row">
        <button class="btn ghost" onClick=${() => setRange(true)}>Repetir prueba de rango</button>
        <button class="btn ghost" onClick=${recalibrate}>Calibrar micrófono</button>
      </div>
      <p class="muted small">Rango de trabajo: ${midiName(s.profile.low)} a ${midiName(s.profile.high)}. Guturales usados hoy: ${Math.round((HARSH_BUDGET - harshLeft(s)) / 6) / 10} de ${HARSH_BUDGET / 60} min.</p>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Reglas de la casa</h2></div>
      <ol class="rules">
        <li><b>Si duele, paras.</b> Ardor, picor o tos significan fuerza en vez de técnica.</li>
        <li><b>Calienta siempre</b> y enfría al terminar.</li>
        <li><b>Agua todo el día.</b> La garganta se hidrata desde adentro, con horas de anticipación.</li>
        <li><b>Ronco no se grita ni se susurra.</b> Descansa la voz.</li>
        <li><b>El volumen lo pone el micrófono.</b> Un scream eficiente suena al nivel de tu voz hablada.</li>
      </ol>
      <p class="muted small">La app corrige con lo que oye, pero no ve tu garganta. Dolor o ronquera que duran varios días son motivo para ver a un médico.</p>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Tus datos</h2></div>
      <p class="muted small">El progreso vive solo en este dispositivo y navegador. Guarda un respaldo si vas a cambiar de teléfono.</p>
      <div class="row">
        <button class="btn ghost" onClick=${() => setBackup(exportData())}>Crear respaldo</button>
        <button class="btn ghost" onClick=${() => file.current.click()}>Restaurar respaldo</button>
        <input ref=${file} id="set-import" type="file" accept="application/json,.json" hidden onChange=${onImport} />
      </div>
      ${backup &&
      html`<div class="backup">
        <a class="btn primary" download=${`catarsis-${dayKey()}.json`} href=${`data:application/json;charset=utf-8,${encodeURIComponent(backup)}`}>Descargar archivo</a>
        <label for="set-backup" class="muted small">O copia este texto y guárdalo donde quieras:</label>
        <textarea id="set-backup" readonly rows="4" onFocus=${(e) => e.target.select()}>${backup}</textarea>
      </div>`}
      ${confirmReset
        ? html`<div class="note warn">
            Se borra todo tu progreso. No se puede deshacer.
            <div class="row">
              <button class="btn ghost" onClick=${() => setConfirmReset(false)}>Cancelar</button>
              <button class="btn danger" onClick=${() => { resetAll(); setConfirmReset(false); }}>Sí, borrar todo</button>
            </div>
          </div>`
        : html`<button class="btn ghost danger-text" onClick=${() => setConfirmReset(true)}>Borrar mi progreso</button>`}
    </section>
  </div>`;
}
