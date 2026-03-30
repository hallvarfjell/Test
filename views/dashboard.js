// ============================================================================
// INTZ v11 – views/dashboard.js
//
// Dette er hovedskjermen (tidligere index.html + main.js UI-delen).
// Dashboard håndterer:
//   • Live-metrikkvisning (HR, watt, slope)
//   • Fart/stigning justering
//   • RPE
//   • Øktkontroller (start/pause/stop/skip)
//   • Ghost-velger
//   • Live-graf (graph.js)
//   • Statuskort (elapsed, remaining, dist, elev, TSS)
//
// Core-moduler som brukes:
//   ble.js (via app.js for INTZ_HR, INTZ_SPEED, INTZ_GRADE)
//   session.js
//   logger.js
//   graph.js
//   storage.js
//   ui.js
// ============================================================================

import * as UI from "../core/ui.js";
import * as G from "../core/graph.js";
import * as Session from "../core/session.js";
import * as Logger from "../core/logger.js";
import { getNS, setNS } from "../core/storage.js";

// ============================================================================
// DOM-CONTAINER OPPBYGGING
// (Du kan style dette videre i style.css)
// ============================================================================

export function onShow() {
  const root = document.getElementById("view-dashboard");
  if (!root._intzInit) {
    buildDOM(root);
    bindEvents();
    initGraph();
    root._intzInit = true;
  }
}

// ============================================================================
// BYGG DASHBOARD-DOM
// ============================================================================

function buildDOM(root) {
  root.innerHTML = `
    <section class="leftcol">

      <!-- METRICS -->
      <div class="card metrics" id="dash-metrics">
        <div class="metric metric-big" style="display:flex;align-items:baseline;gap:8px">
          <label style="width:170px;color:#5f6b7a">Puls</label>
          <span id="d-pulse" class="big-num" style="font-size:56px;line-height:1;color:#ef4444">--</span>
          <small>bpm</small>
        </div>

        <div class="metric" style="display:flex;align-items:baseline;gap:8px">
          <label style="width:170px;color:#5f6b7a">Estimert watt</label>
          <span id="d-watt">--</span><small>W</small>
        </div>

        <div class="metric" style="display:flex;align-items:baseline;gap:8px">
          <label style="width:170px;color:#5f6b7a">Slope (20s–120s)</label>
          <span id="d-slope">--</span><small>bpm</small>
        </div>

        <!-- RPE -->
        <div class="rpe-compact" style="display:flex;align-items:center;gap:8px;margin-top:6px">
          <label style="width:170px;color:#5f6b7a">RPE nå:</label>
          <button id="d-rpe-dec" class="iconbtn"><i class="ph-minus"></i></button>
          <input id="d-rpe" type="number" step="0.5" min="0" max="10" value="0" class="bigvalue" style="width:120px;text-align:center">
          <button id="d-rpe-inc" class="iconbtn"><i class="ph-plus"></i></button>
        </div>
      </div>

      <!-- WORKOUT PANEL -->
      <div class="card workout workout-panel">
        <div class="workout-header" style="display:flex;gap:8px;align-items:center">
          <i class="ph-notepad"></i>
          <select id="d-workout-select" style="flex:1"></select>
          <span id="d-sel-dur" class="badge">--:--</span>
        </div>

        <div class="nowplaying" style="display:grid;gap:8px">
          <div id="d-step-name" class="step-label" style="font-weight:600">Ingen økt valgt</div>
          <div id="d-timer" class="big-timer">00:00</div>

          <div style="display:grid;gap:2px;color:#475569;font-size:13px">
            <div id="d-next1">Neste: –</div>
            <div id="d-next2">Deretter: –</div>
          </div>

          <div id="d-progressbar" style="height:8px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:999px;overflow:hidden">
            <div id="d-progress" style="height:100%;width:0;background:#16a34a"></div>
          </div>
        </div>

        <div class="workout-controls" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:8px">
          <button id="d-start-pause" class="primary btn-hero"><i id="d-sp-icon" class="ph-play"></i><span id="d-sp-label">Start</span></button>
          <button id="d-skip-back" class="secondary"><i class="ph-skip-back"></i></button>
          <button id="d-skip-fwd" class="secondary"><i class="ph-skip-forward"></i></button>
          <button id="d-stop-save" class="secondary"><i class="ph-check-circle"></i></button>
          <button id="d-discard" class="ghost"><i class="ph-x-circle"></i></button>
        </div>
      </div>

      <!-- SPEED & GRADE -->
      <div class="card">
        <div class="sg-grid">

          <!-- SPEED -->
          <div class="sg-row">
            <button id="d-speed-dec" class="giantbtn">−</button>
            <div class="sg-center">
              <div class="small">Fart (km/t)</div>
              <input id="d-speed" type="number" step="0.1" min="0" value="0" class="bigvalue">
            </div>
            <button id="d-speed-inc" class="giantbtn">+</button>
          </div>

          <!-- GRADE -->
          <div class="sg-row">
            <button id="d-grade-dec" class="giantbtn">−</button>
            <div class="sg-center">
              <div class="small">Stigning (%)</div>
              <input id="d-grade" type="number" step="0.5" value="0" class="bigvalue">
            </div>
            <button id="d-grade-inc" class="giantbtn">+</button>
          </div>

          <!-- QUICK -->
          <div class="quickrow">
            <button class="speed-btn" data-speed="10">10 km/t</button>
            <button class="speed-btn" data-speed="15">15 km/t</button>
            <button class="grade-btn" data-grade="5">5%</button>
            <button class="grade-btn" data-grade="10">10%</button>
          </div>
        </div>
      </div>

    </section>

    <!-- RIGHT COLUMN -->
    <section class="rightcol">

      <!-- LIVE GRAPH -->
      <div class="card">
        <div style="display:flex;align-items:center;gap:8px;justify-content:space-between;margin-bottom:4px">
          <div class="small" style="display:flex;align-items:center;gap:8px">
            <label><input type="checkbox" id="d-show-hr" checked> HR</label>
            <label><input type="checkbox" id="d-show-watt" checked> Watt</label>
            <label><input type="checkbox" id="d-show-speed"> Fart</label>
            <label><input type="checkbox" id="d-show-rpe" checked> RPE</label>
          </div>

          <div class="small" style="display:flex;align-items:center;gap:8px">
            <label><input type="checkbox" id="d-ghost-enable"> Ghost</label>
            <button id="d-ghost-picker" class="secondary">Velg ghost</button>
          </div>
        </div>

        <div class="graphwrap">
          <canvas id="d-chart"></canvas>
        </div>
      </div>

      <!-- STATUS CARD -->
      <div class="card" id="d-status-card">
        <h3>Øktstatus</h3>
        <div style="display:grid;grid-template-columns:repeat(3,minmax(160px,1fr));gap:8px">
          <div><div class="small">Påløpt tid</div><div id="d-st-elapsed" class="bigstat">--:--</div></div>
          <div><div class="small">Gjenstående</div><div id="d-st-remaining" class="bigstat">--:--</div></div>
          <div><div class="small">Distanse</div><div id="d-st-dist" class="bigstat">0.00 km</div></div>
          <div><div class="small">Høydemeter</div><div id="d-st-elev" class="bigstat">0 m</div></div>
          <div><div class="small">TSS</div><div id="d-st-tss" class="bigstat">0</div></div>
          <div><div class="small">Siste drag</div><div id="d-st-last" class="bigstat">-- km/t · -- bpm</div></div>
        </div>
      </div>

    </section>
  `;
}

// ============================================================================
// GRAPH SETUP
// ============================================================================
let ctx = null;
let canvas = null;

function initGraph() {
  canvas = document.getElementById("d-chart");
  ctx = G.initCanvas(canvas);
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
}

function resizeCanvas() {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * window.devicePixelRatio);
  canvas.height = Math.floor(rect.height * window.devicePixelRatio);
}

// ============================================================================
// EVENT-BINDING
// ============================================================================

function bindEvents() {
  // RPE
  UI.onClick("d-rpe-dec", () => adjustRPE(-0.5));
  UI.onClick("d-rpe-inc", () => adjustRPE(+0.5));
  UI.onInput("d-rpe", () => {
    const v = Number(UI.getValue("d-rpe")) || 0;
    window.INTZ_RPE = v;
    setNS("lastRPE", v);
  });

  // speed / grade sikrer INTZ_SPEED/INTZ_GRADE
  UI.onInput("d-speed", () => {
    window.INTZ_SPEED = Number(UI.getValue("d-speed")) || 0;
  });
  UI.onInput("d-grade", () => {
    window.INTZ_GRADE = Number(UI.getValue("d-grade")) || 0;
  });

  UI.onClick("d-speed-dec", () => changeSpeed(-0.1));
  UI.onClick("d-speed-inc", () => changeSpeed(+0.1));
  UI.onClick("d-grade-dec", () => changeGrade(-0.5));
  UI.onClick("d-grade-inc", () => changeGrade(+0.5));

  document.querySelectorAll(".speed-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const v = Number(btn.dataset.speed);
      window.INTZ_SPEED = v;
      UI.setValue("d-speed", v);
    });
  });

  document.querySelectorAll(".grade-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const v = Number(btn.dataset.grade);
      window.INTZ_GRADE = v;
      UI.setValue("d-grade", v);
    });
  });

  // ØKT-KNAPPER
  UI.onClick("d-start-pause", () => {
    const running = !!Session.Session.ticker;
    if (!running) {
      window.INTZ_startSession();
      UI.setText("d-sp-label", "Pause");
      document.getElementById("d-sp-icon").className = "ph-pause";
    } else {
      window.INTZ_pauseSession();
      UI.setText("d-sp-label", "Start");
      document.getElementById("d-sp-icon").className = "ph-play";
    }
  });

  UI.onClick("d-skip-fwd", () => window.INTZ_nextPhase());
  UI.onClick("d-skip-back", () => window.INTZ_prevPhase());

  UI.onClick("d-stop-save", () => {
    if (confirm("Stopp og lagre økta?")) {
      window.INTZ_stopSession();
    }
  });

  UI.onClick("d-discard", () => {
    if (confirm("Forkast økta?")) {
      window.INTZ_pauseSession();
      Session.Session.workout = null;
      Logger.Logger.active = false;
      Logger.Logger.points = [];
    }
  });

  // ghost toggle
  UI.onClick("d-ghost-picker", () => openGhostPicker());
}

// ============================================================================
// SPEED / GRADE ADJUST
// ============================================================================
function changeSpeed(delta) {
  const v = (Number(window.INTZ_SPEED) || 0) + delta;
  window.INTZ_SPEED = Math.max(0, Math.round(v * 10) / 10);
  UI.setValue("d-speed", window.INTZ_SPEED);
}

function changeGrade(delta) {
  const v = (Number(window.INTZ_GRADE) || 0) + delta;
  window.INTZ_GRADE = Math.round(v * 10) / 10;
  UI.setValue("d-grade", window.INTZ_GRADE);
}

// ============================================================================
// RPE
// ============================================================================
function adjustRPE(delta) {
  let v = (Number(window.INTZ_RPE) || 0) + delta;
  v = Math.min(10, Math.max(0, v));
  window.INTZ_RPE = v;
  UI.setValue("d-rpe", v);
  setNS("lastRPE", v);
}

// ============================================================================
// GHOST PICKER
// (Enkel v11 variant – full liste ligger i log view)
// ============================================================================
function openGhostPicker() {
  alert("Ghost-velger kommer i views/results.js – v11 håndterer ghost via results.");
}

// ============================================================================
// PERF-LOOP (kalt fra app.js)
// ============================================================================

export function onLiveTick() {
  renderMetrics();
  renderStatusCard();
  renderWorkoutUI();
  renderGraph();
}

// ============================================================================
// METRICS
// ============================================================================

function renderMetrics() {
  const hr = window.INTZ_HR ?? "--";
  UI.setText("d-pulse", hr);

  const w = window.INTZ_WATT ?? "--";
  UI.setText("d-watt", w);

  // slope = HR(20s) - HR(120s)
  const pts = Logger.Logger.points;
  const now = Date.now();

  const hr20 = pts.filter(p => p.ts >= now - 20000).map(p => p.hr).filter(v => v > 0);
  const hr120 = pts.filter(p => p.ts >= now - 120000).map(p => p.hr).filter(v => v > 0);

  const a20 = hr20.length ? Math.round(avg(hr20)) : null;
  const a120 = hr120.length ? Math.round(avg(hr120)) : null;

  const slope = (a20 != null && a120 != null) ? (a20 - a120) : "--";
  UI.setText("d-slope", slope);
}

// ============================================================================
// STATUS CARD
// ============================================================================

function renderStatusCard() {
  const w = Session.Session.workout;
  if (!w) return;

  // elapsed
  let elapsed = 0;
  if (w.startedAt && Session.Session.ticker) {
    const now = Date.now();
    const start = new Date(w.startedAt).getTime();
    elapsed = Math.max(0, Math.round((now - start) / 1000));
  }

  UI.setText("d-st-elapsed", fmt(elapsed));

  // remaining
  const remaining = computeRemaining(w);
  UI.setText("d-st-remaining", remaining > 0 ? fmt(remaining) : "00:00");

  // dist
  UI.setText("d-st-dist", (Logger.Logger.dist / 1000).toFixed(2) + " km");

  // elev
  UI.setText("d-st-elev", Math.round(Logger.Logger.elev) + " m");

  // TSS
  UI.setText("d-st-tss", Math.round(Logger.Logger.tss));

  // last work metrics
  const m = Logger.computeLastWorkMetrics();
  const spTxt = (m.speed != null ? m.speed.toFixed(1) : "--") + " km/t";
  const hrTxt = (m.hr20 != null ? m.hr20 : "--") + " bpm";
  UI.setText("d-st-last", spTxt + " · " + hrTxt);
}

function fmt(s) {
  const m = Math.floor(s / 60);
  const sec = String(s % 60).padStart(2, "0");
  return `${m}:${sec}`;
}

function computeRemaining(w) {
  // enkel v11-port – full logikk ligger i session.js
  const obj = JSON.parse(JSON.stringify(w));

  function phaseDur(o) {
    if (o.phase === "warmup") return o.warmupSec;
    if (o.phase === "cooldown") return o.cooldownSec;
    if (o.phase === "seriesrest") return o.series[o.sIdx].seriesRestSec;
    if (o.phase === "rest") return o.series[o.sIdx].restSec;
    if (o.phase === "work") return o.series[o.sIdx].workSec;
    return 0;
  }

  function adv(o) {
    Session.nextPhase.call({ Session: { workout: o } });
  }

  let remaining = Number(obj.tLeft || 0);
  let guard = 0;

  while (obj.phase !== "done" && guard++ < 10000) {
    const d = phaseDur(obj);
    adv(obj);
    if (obj.phase !== "done") remaining += d;
  }
  return Math.max(0, Math.round(remaining));
}

// ============================================================================
// WORKOUT UI
// ============================================================================

function renderWorkoutUI() {
  const w = Session.Session.workout;

  if (!w) {
    UI.setText("d-step-name", "Ingen økt valgt");
    UI.setText("d-timer", "00:00");
    UI.setHTML("d-next1", "Neste: –");
    UI.setHTML("d-next2", "Deretter: –");
    UI.setValue("d-sel-dur", "--:--");
    UI.setValue("d-speed", window.INTZ_SPEED || 0);
    UI.setValue("d-grade", window.INTZ_GRADE || 0);
    return;
  }

  // current step
  const name = makeStepName(w);
  UI.setText("d-step-name", name);

  UI.setText("d-timer", fmt(w.tLeft));

  const [n1, n2] = computeNextSteps(w);
  UI.setText("d-next1", "Neste: " + n1);
  UI.setText("d-next2", "Deretter: " + n2);

  // progressbar
  const total = getPhaseTotal(w);
  const pct = Math.min(100, Math.max(0, 100 * (1 - w.tLeft / Math.max(1, total))));
  document.getElementById("d-progress").style.width = `${pct}%`;
}

function makeStepName(w) {
  const t = getPhaseTotal(w);
  const note = (w.phase === "work" && w.series?.[w.sIdx]?.note) ? ` – ${w.series[w.sIdx].note}` : "";
  if (w.phase === "warmup") return `Oppvarming – ${fmt(w.warmupSec)}`;
  if (w.phase === "cooldown") return `Nedjogg – ${fmt(w.cooldownSec)}`;
  if (w.phase === "seriesrest") return `Serie–pause – ${fmt(w.series[w.sIdx].seriesRestSec)}`;
  if (w.phase === "rest") return `Pause – serie ${w.sIdx+1}/${w.series.length} – rep ${w.rep}/${w.series[w.sIdx].reps} – ${fmt(w.series[w.sIdx].restSec)}`;
  if (w.phase === "work") return `Drag – serie ${w.sIdx+1}/${w.series.length} – rep ${w.rep}/${w.series[w.sIdx].reps} – ${fmt(w.series[w.sIdx].workSec)}${note}`;
  return "–";
}

function getPhaseTotal(w) {
  if (w.phase === "warmup") return w.warmupSec;
  if (w.phase === "cooldown") return w.cooldownSec;
  if (w.phase === "seriesrest") return w.series[w.sIdx].seriesRestSec;
  if (w.phase === "rest") return w.series[w.sIdx].restSec;
  if (w.phase === "work") return w.series[w.sIdx].workSec;
  return 1;
}

function computeNextSteps(w) {
  const clone = JSON.parse(JSON.stringify(w));

  function next(obj) {
    Session.nextPhase.call({ Session: { workout: obj } });
  }

  next(clone);
  const n1 = makeStepName(clone);
  next(clone);
  const n2 = makeStepName(clone);

  return [n1, n2];
}

// ============================================================================
// GRAPH
// ============================================================================

function renderGraph() {
  if (!ctx || !canvas) return;

  const series = {
    hr: [],
    speed: [],
    watt: [],
    rpe: [],
  };

  // build from Logger.points but only last windowSec sec
  const windowSec = 900;
  const now = Date.now();
  const pts = Logger.Logger.points;

  for (const p of pts) {
    if (p.ts < now - windowSec * 1000) continue;

    series.hr.push({ t: p.ts, y: p.hr });
    series.speed.push({ t: p.ts, y: p.speed_ms * 3.6 });
    series.watt.push({ t: p.ts, y: p.watt });
    series.rpe.push({ t: p.ts, y: p.rpe });
  }

  G.drawLive(ctx, series, {
    width: canvas.width,
    height: canvas.height,

    showHR: document.getElementById("d-show-hr").checked,
    showWatt: document.getElementById("d-show-watt").checked,
    showSpeed: document.getElementById("d-show-speed").checked,
    showRPE: document.getElementById("d-show-rpe").checked,

    LT1: getNS("LT1", 135),
    LT2: getNS("LT2", 160),

    windowSec,

    ghost: null,        // ghost håndteres i results
    workoutStart: Session.Session.workout?.startedAt ?? null
  });
}
