// modules/workout.js
// Workout v1.3.8 – phosphor icons, +/- ved verdier, W fra PI-kalibrering (pause=>0),
// vann/karbo, live TSS, sonebakgrunn + LT1/LT2-linjer, bedre øktpanel, Start/Pause-toggle.

const WorkoutEngine = (function () {
  const S = {
    running: false, paused: false, timer: null,
    plan: null, seq: [], idx: 0, left: 0,
    tTot: 0, dist: 0,
    speedUnit: 'kmh', powerUnit: 'W',
    rpeCur: 6,

    // serier (for graf)
    hrSeries: [], spdSeries: [], incSeries: [],

    // per-drag
    _perDrag: [],
    lastDrag: { hr: '-', spd: '-', watt: '-', rpe: '-' },
    _buf: { hr: [], spd: [], w: [] },

    // TSS (IF^2·h·100)
    tssLoad: 0,             // sum(dt * IF^2), dt=1s
    P2: null,               // P_LT2 (W/kg) fra PI-settings

    // enkel karbo-tracker (kobles til PI i neste PI-bolk)
    carbs_g: 0
  };

  function resetCore() {
    S.running = false; S.paused = false;
    if (S.timer) { clearInterval(S.timer); S.timer = null; }
    S.seq = []; S.idx = 0; S.left = 0;
    S.tTot = 0; S.dist = 0;
    S.hrSeries.length = S.spdSeries.length = S.incSeries.length = 0;
    S._perDrag.length = 0;
    S._buf.hr.length = S._buf.spd.length = S._buf.w.length = 0;
    S.lastDrag = { hr: '-', spd: '-', watt: '-', rpe: '-' };
    S.tssLoad = 0;
    S.P2 = (AppState.settings?.P_L2) || null; // LT2 W/kg hvis satt
    S.carbs_g = 0;
  }

  function expand(blocks) {
    const out = [];
    (blocks || []).forEach(b => {
      if (['Oppvarming', 'Pause', 'Nedjogg'].includes(b.kind)) {
        out.push({ kind: b.kind, dur: b.dur });
      } else if (b.kind === 'Intervall') {
        for (let i = 1; i <= b.reps; i++) {
          out.push({ kind: 'Arbeid', dur: b.work, rep: i, reps: b.reps });
          if (b.rest > 0) out.push({ kind: 'Pause', dur: b.rest });
        }
      } else if (b.kind === 'Serie') {
        for (let s = 1; s <= b.series; s++) {
          for (let i = 1; i <= b.reps; i++) {
            out.push({ kind: 'Arbeid', dur: b.work, rep: i, reps: b.reps, set: s, sets: b.series });
            if (b.rest > 0) out.push({ kind: 'Pause', dur: b.rest });
          }
          if (s < b.series && b.seriesRest) out.push({ kind: 'Pause', dur: b.seriesRest });
        }
      } else if (b.kind === 'Fartlek') {
        for (let i = 1; i <= (b.reps || 1); i++) {
          out.push({ kind: 'Arbeid', dur: b.on, rep: i, reps: b.reps });
          out.push({ kind: 'Arbeid', dur: b.off, rep: i, reps: b.reps });
        }
      }
    });
    return out;
  }

  function currentPhase() { return S.seq[S.idx]; }

  function fmtSpd(kmh) {
    if (S.speedUnit === 'kmh') return `${kmh.toFixed(1)} km/t`;
    if (kmh <= 0) return '–';
    const pace = 60 / kmh, m = Math.floor(pace), s = Math.round((pace - m) * 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} min/km`;
  }

  // Effekt fra PI-kalibrering (samme modell/parametre som PI-modulen). 0 W i Pause.
  function powerFromPI(speedKmh, inclinePct) {
    const v = (speedKmh || 0) / 3.6;
    const i = (inclinePct || 0) / 100;
    const met = (AppState.settings?.met_eff) || 0.25;
    const mass = (AppState.settings?.mass) || 75;
    const shoe = 1 - ((AppState.settings?.shoe_gain_pct || 0) / 100);
    const tm = (AppState.settings?.tm_cal || 1);
    let Wkg = (4.185 * v + (9.81 * v * i) / met) * shoe * tm;
    if (currentPhase()?.kind !== 'Arbeid') Wkg = 0;
    return { Wkg, W: Wkg * mass };
  }

  function setPhase() {
    const cur = currentPhase();
    if (!cur) { finish(true); return; }
    S.left = cur.dur;
    updateUI(true);
  }

  function startToggle() {
    // Én knapp for start/pause
    if (S.running) {
      S.paused = !S.paused;
      const b = document.getElementById('wk_toggle');
      if (b) {
        b.innerHTML = S.paused ? '<i class="ph ph-play"></i>' : '<i class="ph ph-pause"></i>';
        b.classList.toggle('pause', !S.paused);
      }
      AppState.session.paused = S.paused;
      return;
    }
    S.running = true; S.paused = false;
    AppState.session.running = true; AppState.session.paused = false;
    if (!S.timer) S.timer = setInterval(tick, 1000);
    const b = document.getElementById('wk_toggle');
    if (b) b.innerHTML = '<i class="ph ph-pause"></i>';
    updateUI(true);
  }

  function prev() { if (S.idx > 0) { S.idx--; setPhase(); } }
  function next() { if (S.idx < S.seq.length - 1) { S.idx++; setPhase(); } }

  function finish(saved) {
    if (S.timer) { clearInterval(S.timer); S.timer = null; }
    const plan = S.plan;
    const session = saved ? {
      id: 's_' + Date.now(), name: String(plan.name),
      endedAt: Date.now(), dist: S.dist, total: S.tTot,
      seq: S.seq, perDrag: (S._perDrag || []),
      hrSeries: S.hrSeries, spdSeries: S.spdSeries, incSeries: S.incSeries, notes: ''
    } : null;

    // Nullstill alltid etter avslutning (kravet ditt)
    resetCore();

    if (saved && session) {
      const st = AppState; st.logg = st.logg || [];
      st.logg.push(session); Storage.saveP(AppState.currentProfile, 'logg', st.logg);
      location.hash = '#/result?id=' + session.id;
    } else {
      // Forkast: last samme plan i startposisjon
      S.plan = plan; S.seq = expand(plan.blocks); S.idx = 0;
      S.left = S.seq[0] ? S.seq[0].dur : 0; updateUI(true);
    }
  }

  function pushDragSummary() {
    const aHR = Math.round(S._buf.hr.reduce((a, b) => a + b, 0) / (S._buf.hr.length || 1));
    const aSpd = (S._buf.spd.reduce((a, b) => a + b, 0) / (S._buf.spd.length || 1)) || 0;
    const aW = (S._buf.w.reduce((a, b) => a + b, 0) / (S._buf.w.length || 1)) || 0;
    S.lastDrag = { hr: aHR, spd: +aSpd.toFixed(1), watt: +aW.toFixed(0), rpe: S.rpeCur };
    S._perDrag.push(S.lastDrag);
    S._buf.hr.length = S._buf.spd.length = S._buf.w.length = 0;
  }

  function tick() {
    if (S.paused || !S.running) return;
    S.tTot++;

    const cur = currentPhase();
    const spdNow = cur?.kind === 'Pause' ? 0 : (AppState.tm?.speed || 0);
    const incNow = AppState.tm?.incline || 0;
    const hrNow = AppState.hr?.bpm || 0;

    S.dist += spdNow / 3600;

    // serier for graf
    const t = Date.now() / 1000;
    if (hrNow) S.hrSeries.push({ t, bpm: hrNow });
    S.spdSeries.push({ t, kmh: spdNow });
    S.incSeries.push({ t, pct: incNow });

    // per-drag + TSS
    if (cur?.kind === 'Arbeid') {
      if (hrNow) S._buf.hr.push(hrNow);
      S._buf.spd.push(spdNow);
      const p = powerFromPI(spdNow, incNow);
      S._buf.w.push(p.W);

      if (S.P2) {
        const IF = p.Wkg / S.P2;
        S.tssLoad += (1 * (IF * IF)); // dt=1s
      }
    }

    drawGraph();
    updateUI(false);

    // fase-slutt
    S.left--;
    if (S.left <= 0) {
      if (cur?.kind === 'Arbeid') pushDragSummary();
      S.idx++; setPhase();
    }
  }

  function init(plan) {
    resetCore();
    S.plan = plan;
    S.seq = expand(plan.blocks);
    S.idx = 0; S.left = S.seq[0] ? S.seq[0].dur : 0;
    updateUI(true);
  }

  // ----- graf med sonebakgrunn + LT1/LT2 -----
  let c, ctx;
  function initGraph(host) {
    c = document.createElement('canvas');
    c.width = 900; c.height = 260; c.style.width = '100%';
    ctx = c.getContext('2d'); host.appendChild(c);
    const ro = new ResizeObserver(() => {
      const r = host.getBoundingClientRect();
      c.width = Math.max(600, Math.floor(r.width)); c.height = 260;
      drawGraph();
    }); ro.observe(host);
  }

  function zones() {
    const s = AppState.settings || {};
    const max = s.hrmax || 190;
    const LT1 = s.lt1 || 135, LT2 = s.lt2 || 160;

    // Default-sonegrenser i %HRmax iht. spesifikasjonen din:
    // S0 50–60 (grå), S1 60–72.5 (blå), S2 72.5–82.5 (grønn), S3 82.5–87.5 (gul),
    // S4 87.5–92.5 (oransje), S5 92.5–100 (rød).
    const bands = [
      { from: 0.50, to: 0.60, color: '#e9ecef' }, // grå
      { from: 0.60, to: 0.725, color: '#d6ecff' }, // blå
      { from: 0.725, to: 0.825, color: '#d9f5d6' }, // grønn
      { from: 0.825, to: 0.875, color: '#fff2b3' }, // gul
      { from: 0.875, to: 0.925, color: '#ffe0b8' }, // oransje
      { from: 0.925, to: 1.00, color: '#ffd1d1' }  // rød
    ];
    return { max, LT1, LT2, bands };
  }

  function drawGraph() {
    if (!ctx) return;
    const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = '#b4c4e8'; ctx.strokeRect(40, 10, W - 60, H - 30);

    const z = zones();

    // sonebakgrunn
    z.bands.forEach(b => {
      const y1 = 10 + (1 - ((b.to * z.max - 90) / 100)) * (H - 30);
      const y2 = 10 + (1 - ((b.from * z.max - 90) / 100)) * (H - 30);
      ctx.fillStyle = b.color;
      ctx.fillRect(40, Math.min(y1, y2), (W - 60), Math.abs(y2 - y1));
    });

    const span = 15 * 60, t1 = Date.now() / 1000, t0 = t1 - span;

    // LT1/LT2
    const yLT1 = 10 + (1 - ((z.LT1 - 90) / 100)) * (H - 30);
    const yLT2 = 10 + (1 - ((z.LT2 - 90) / 100)) * (H - 30);
    ctx.strokeStyle = '#888'; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(40, yLT1); ctx.lineTo(W - 20, yLT1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(40, yLT2); ctx.lineTo(W - 20, yLT2); ctx.stroke();
    ctx.setLineDash([]);

    // HR
    ctx.strokeStyle = '#d93c3c'; ctx.lineWidth = 2;
    ctx.beginPath(); let first = true;
    for (const p of S.hrSeries) {
      if (p.t < t0) continue;
      const x = 40 + ((p.t - t0) / span) * (W - 60);
      const y = 10 + (1 - ((p.bpm - 90) / 100)) * (H - 30);
      if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
    } ctx.stroke();

    // Speed (0–20 km/t)
    ctx.strokeStyle = '#d6a600'; ctx.lineWidth = 2;
    ctx.beginPath(); first = true;
    for (const p of S.spdSeries) {
      if (p.t < t0) continue;
      const x = 40 + ((p.t - t0) / span) * (W - 60);
      const y = 10 + (1 - (p.kmh / 20)) * (H - 30);
      if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
    } ctx.stroke();

    // akse‑etiketter
    ctx.fillStyle = '#0b1220'; ctx.font = '12px system-ui';
    [90, 110, 130, 150, 170, 190].forEach(v => {
      const y = 10 + (1 - ((v - 90) / 100)) * (H - 30);
      ctx.fillText(String(v), 8, y + 4);
    });
    [0, 5, 10, 15, 20].forEach(v => {
      const y = 10 + (1 - (v / 20)) * (H - 30);
      ctx.fillText(String(v), W - 28, y + 4);
    });
  }

  function updateUI(forcePhase) {
    const spdNow = AppState.tm?.speed || 0;
    const incNow = AppState.tm?.incline || 0;
    const hrNow = AppState.hr?.bpm || 0;

    // venstre: puls + %HRmax + slope
    setText('wk_hr', String(hrNow || 0));
    const r = AppState.settings?.hrrest || 50, m = AppState.settings?.hrmax || 190;
    const p = (hrNow - r) / Math.max(1, (m - r));
    setText('wk_hrp', isFinite(p) ? `${Math.round(p * 100)}% av HRmax` : '–');
    setText('wk_slope', `${(incNow || 0).toFixed(2)}%`);

    // midten: fart/stigning
    setText('wk_spd', fmtSpd(spdNow));
    setText('wk_inc', `${Math.round(incNow)}%`);

    // høyre: effekt, PI, dHR, TSS
    const pow = powerFromPI(spdNow, incNow);
    setText('wk_pow', (WorkoutEngine.S.powerUnit === 'W')
      ? `${Math.round(pow.W)} W` : `${pow.Wkg.toFixed(2)} W/kg`);

    try {
      const res = (typeof PI !== 'undefined')
        ? PI.compute(performance.now(), {
            prevTime: null, tSec: 0, hr: hrNow, speedKmh: spdNow,
            inclinePct: incNow, tempC: 20, rpe: S.rpeCur, cumSweatL: 0
          })
        : null;
      setText('wk_pi', res && res.PI ? res.PI.toFixed(2) : '–');
      setText('wk_dhr', res ? String(Math.round(res.dHR || 0)) : '0');
    } catch (_) {}

    // TSS: IF^2 * (t i timer) * 100
    const hours = (S.tTot || 0) / 3600;
    const tss = (S.P2 ? (S.tssLoad / 3600 * 100) : null);
    setText('wk_tss', (tss != null) ? `${Math.round(tss)}` : '–');

    // øktpanel-tekst (fase + neste + deretter)
    if (forcePhase) {
      const ph = currentPhase();
      const nowLbl = ph ? phaseLabel(ph) : '–';
      const next = S.seq[S.idx + 1], then = S.seq[S.idx + 2];
      setText('wk_phase_now', nowLbl);
      setText('wk_phase_next', next ? 'Neste: ' + phaseLabel(next) : '');
      setText('wk_phase_then', then ? 'Deretter: ' + phaseLabel(then) : '');
    }

    // store tall: tid & dist
    setText('wk_tot', UI.fmtTime(S.tTot));
    setText('wk_dist', S.dist.toFixed(2));

    // siste drag snitt
    setText('wk_avgHR', String(S.lastDrag.hr ?? '-'));
    setText('wk_avgSpd', String(S.lastDrag.spd ?? '-'));
    setText('wk_avgPow', String(S.lastDrag.watt ?? '-'));
    setText('wk_rpe', S.rpeCur.toFixed(1));
  }

  function phaseLabel(b) {
    if (!b) return '–';
    if (b.kind === 'Arbeid') {
      const rep = b.rep ? ` ${b.rep}/${b.reps || ''}` : '';
      const set = b.set ? `, serie ${b.set}/${b.sets || ''}` : '';
      const mm = Math.floor((b.dur || 0) / 60), ss = (b.dur || 0) % 60;
      const ts = mm > 0 ? `${mm}m${ss ? ' ' + ss + 's' : ''}` : `${ss}s`;
      return `Drag${rep}${set} (${ts})`;
    }
    if (b.kind === 'Pause') return `Pause (${b.dur}s)`;
    return b.kind;
  }

  function setText(id, txt) {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  }

  return { init, attach, initGraph, S };

})();

const Workout = {
  onHR: null, onTM: null,
  render(el, st) {
    el.innerHTML = '';
    const plan = st.plan || (st.workouts && st.workouts[0]);
    if (!plan) { el.textContent = 'Ingen økt valgt.'; return; }

    // ------- Topp-panel (som i skissen) -------
    const panel = UI.h('div', { class: 'card' });
    panel.style.display = 'grid';
    panel.style.gridTemplateColumns = '1.1fr 1.3fr 1fr';
    panel.style.gap = '.5rem';

    // Venstre – Puls / Slope
    const left = UI.h('div', {});
    left.append(
      UI.h('div', { class: 'small' }, 'Puls'),
      UI.h('div', { id: 'wk_hr', style: 'font-size:3.2rem;font-weight:700' }, '0'),
      UI.h('div', { id: 'wk_hrp', class: 'small' }, '0% av HRmax'),
      UI.h('div', { class: 'small', style: 'margin-top:.4rem' }, 'Slope'),
      UI.h('div', { id: 'wk_slope', style: 'font-size:1.6rem' }, '0.00%')
    );

    // Midten – Fart / Stigning med ± ved verdier + hurtigknapper
    const mid = UI.h('div', {});
    // Fart-linje
    const spdRow = UI.h('div', { class: 'controls', style: 'align-items:center; gap:.4rem;' });
    spdRow.append(
      UI.h('div', { class: 'small' }, 'Fart'),
      UI.h('div', { id: 'wk_spd', style: 'font-size:1.8rem;cursor:pointer' }, '0.0 km/t'),
      UI.h('button', { class: 'btn', id: 'wk_spdDec', title: '–0,1 km/t' }, UI.icon('ph-minus')),
      UI.h('button', { class: 'btn', id: 'wk_spdInc', title: '+0,1 km/t' }, UI.icon('ph-plus'))
    );
    const quickRow = UI.h('div', { class: 'controls' });
    quickRow.append(
      UI.h('button', { class: 'btn', id: 'wk_q10' }, '10 km/t'),
      UI.h('button', { class: 'btn', id: 'wk_q15' }, '15 km/t')
    );
    // Stigning-linje
    const incRow = UI.h('div', { class: 'controls', style: 'align-items:center; gap:.4rem; margin-top:.25rem' });
    incRow.append(
      UI.h('div', { class: 'small' }, 'Stigning'),
      UI.h('div', { id: 'wk_inc', style: 'font-size:1.6rem' }, '0%'),
      UI.h('button', { class: 'btn', id: 'wk_incDec', title: '–1%' }, UI.icon('ph-minus')),
      UI.h('button', { class: 'btn', id: 'wk_incInc', title: '+1%' }, UI.icon('ph-plus'))
    );

    // vann/karbo
    const fluids = UI.h('div', { class: 'controls' });
    const waterBtn = UI.h('button', { class: 'btn', id: 'wk_water', title: '+0,1 L vann' }, UI.icon('ph-drop'));
    const carbBtn = UI.h('button', { class: 'btn', id: 'wk_carb', title: '+20 g karbo' }, UI.icon('ph-lightning'));
    fluids.append(waterBtn, carbBtn);

    mid.append(spdRow, quickRow, incRow, fluids);

    // Høyre – Effekt/PI/dHR/TSS
    const right = UI.h('div', {});
    right.append(
      UI.h('div', { class: 'small' }, 'Watt (est.)'),
      UI.h('div', { id: 'wk_pow', style: 'font-size:1.6rem;cursor:pointer' }, '0 W'),
      UI.h('div', { class: 'small' }, 'PI (trykk for detalj)'),
      UI.h('div', { id: 'wk_pi', style: 'font-size:1.6rem;cursor:pointer' }, '–'),
      UI.h('div', { class: 'small' }, 'HR-drift (bpm)'),
      UI.h('div', { id: 'wk_dhr', style: 'font-size:1.6rem' }, '0'),
      UI.h('div', { class: 'small' }, 'TSS (akkum.)'),
      UI.h('div', { id: 'wk_tss', style: 'font-size:1.2rem' }, '–')
    );

    panel.append(left, mid, right);

    // ------- Øktpanel til høyre + graf til venstre -------
    const graf = UI.h('div', { class: 'card' });

    const side = UI.h('div', {});
    const box = UI.h('div', { class: 'card' });

    // Tittel + plan
    box.append(
      UI.h('div', { style: 'font-weight:600;font-size:1.2rem' }, `Økt: ${plan.name}`),
      UI.h('div', { id: 'wk_phase_now', class: 'list-item' }, '–'),
      UI.h('div', { id: 'wk_phase_next', class: 'small' }, ''),
      UI.h('div', { id: 'wk_phase_then', class: 'small' }, '')
    );

    // Totaltid og distanse
    const totRow = UI.h('div', { class: 'controls' });
    totRow.append(
      UI.h('div', {}, UI.h('div', { class: 'small' }, 'Totaltid'), UI.h('div', { id: 'wk_tot', style: 'font-size:1.2rem' }, '00:00')),
      UI.h('div', {}, UI.h('div', { class: 'small' }, 'Distanse (km)'), UI.h('div', { id: 'wk_dist', style: 'font-size:1.2rem' }, '0.00'))
    );
    box.append(totRow);

    // knapper: start/pause (én), forrige/neste, lagre/forkast
    const controls = UI.h('div', { class: 'controls' });
    const toggle = UI.h('button', { class: 'btn', id: 'wk_toggle', title: 'Start/Pause' }, UI.icon('ph-play'));
    toggle.style.background = '#20c997'; toggle.style.color = '#fff';
    const prev = UI.h('button', { class: 'btn', id: 'wk_prev', title: 'Forrige' }, UI.icon('ph-caret-left'));
    const next = UI.h('button', { class: 'btn', id: 'wk_next', title: 'Neste' }, UI.icon('ph-caret-right'));
    const save = UI.h('button', { class: 'btn', id: 'wk_save', title: 'Lagre' }, UI.icon('ph-floppy-disk'));
    const disc = UI.h('button', { class: 'btn danger', id: 'wk_discard', title: 'Forkast' }, UI.icon('ph-trash'));

    controls.append(toggle, prev, next, save, disc);
    box.append(controls);

    // Statistikk – siste drag
    const stats = UI.h('div', { class: 'card' });
    const tbl = document.createElement('table'); tbl.className = 'table';
    tbl.innerHTML =
      '<tr><th>For siste drag</th><th>Verdi</th></tr>' +
      '<tr><td>Snittpuls</td><td id="wk_avgHR">-</td></tr>' +
      '<tr><td>Snittfart (km/t)</td><td id="wk_avgSpd">-</td></tr>' +
      '<tr><td>SnittWatt</td><td id="wk_avgPow">-</td></tr>' +
      '<tr><td>RPE nå</td><td><div id="wk_rpe">6.0</div>' +
      '<div class="controls"><button class="btn" id="wk_rpeDec">−</button>' +
      '<button class="btn" id="wk_rpeInc">+</button></div></td></tr>';
    stats.append(tbl);

    // layout: venstre (panel + graf), høyre (box + stats)
    const grid = document.createElement('div');
    grid.style.display = 'grid'; grid.style.gridTemplateColumns = '1.6fr 1fr'; grid.style.gap = '.5rem';
    const leftCol = document.createElement('div'); leftCol.append(panel, graf);
    const rightCol = document.createElement('div'); rightCol.append(box, stats);
    grid.append(leftCol, rightCol); el.append(grid);

    // init
    WorkoutEngine.init(plan);
    WorkoutEngine.initGraph(graf);
    attachButtons();

    // HR/TM wiring
    Workout.onHR = bpm => {
      const t = Date.now() / 1000;
      WorkoutEngine.S.hrSeries.push({ t, bpm });
    };
    Workout.onTM = (spd, inc) => {
      const now = Date.now();
      if (spd !== null && (!AppState.tm.manualUntil || now > AppState.tm.manualUntil)) AppState.tm.speed = spd;
      if (inc !== null) AppState.tm.incline = inc;
    };

    function attachButtons() {
      const q = id => document.getElementById(id);
      q('wk_toggle')?.addEventListener('click', startToggle);
      q('wk_prev')?.addEventListener('click', () => { prev(); });
      q('wk_next')?.addEventListener('click', () => { next(); });
      q('wk_save')?.addEventListener('click', () => { finish(true); });
      q('wk_discard')?.addEventListener('click', () => { if (confirm('Forkaste? Økta nullstilles.')) finish(false); });

      // fart/stigning ±
      q('wk_spd')?.addEventListener('click', () => { WorkoutEngine.S.speedUnit = (WorkoutEngine.S.speedUnit === 'kmh' ? 'pace' : 'kmh'); });
      q('wk_spdDec')?.addEventListener('click', () => { AppState.tm.speed = Math.max(0, (AppState.tm.speed || 0) - 0.1); AppState.tm.manualUntil = Date.now() + 4000; });
      q('wk_spdInc')?.addEventListener('click', () => { AppState.tm.speed = (AppState.tm.speed || 0) + 0.1; AppState.tm.manualUntil = Date.now() + 4000; });
      q('wk_incDec')?.addEventListener('click', () => { AppState.tm.incline = Math.max(0, (AppState.tm.incline || 0) - 1); AppState.tm.manualUntil = Date.now() + 4000; });
      q('wk_incInc')?.addEventListener('click', () => { AppState.tm.incline = (AppState.tm.incline || 0) + 1; AppState.tm.manualUntil = Date.now() + 4000; });
      q('wk_q10')?.addEventListener('click', () => { AppState.tm.speed = 10; AppState.tm.manualUntil = Date.now() + 4000; });
      q('wk_q15')?.addEventListener('click', () => { AppState.tm.speed = 15; AppState.tm.manualUntil = Date.now() + 4000; });
      q('wk_pow')?.addEventListener('click', () => { WorkoutEngine.S.powerUnit = (WorkoutEngine.S.powerUnit === 'W' ? 'Wkg' : 'W'); });

      // PI link
      q('wk_pi')?.addEventListener('click', () => { location.hash = '#/pi?from=workout'; });

      // vann/karbo
      q('wk_water')?.addEventListener('click', () => { try { if (typeof PI !== 'undefined' && PI.addWater) PI.addWater(1); } catch (_) {} });
      q('wk_carb')?.addEventListener('click', () => { WorkoutEngine.S.carbs_g += 20; /* kobles til PI i neste PI-bolk */ });

      // RPE ±
      q('wk_rpeDec')?.addEventListener('click', () => { WorkoutEngine.S.rpeCur = Math.max(1, (WorkoutEngine.S.rpeCur || 6) - 0.5); setText('wk_rpe', WorkoutEngine.S.rpeCur.toFixed(1)); });
      q('wk_rpeInc')?.addEventListener('click', () => { WorkoutEngine.S.rpeCur = Math.min(10, (WorkoutEngine.S.rpeCur || 6) + 0.5); setText('wk_rpe', WorkoutEngine.S.rpeCur.toFixed(1)); });
    }

    function setText(id, txt) { const el = document.getElementById(id); if (el) el.textContent = txt; }
  }
};
