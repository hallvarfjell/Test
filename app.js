/* ============================================================
   INTZ v11 — app.js
   STRIPPED + STRICT + FLAT ARCHITECTURE
   Live øktmotor + grafmotor + UI‑kontroll + ghosts
   ============================================================ */

import { supabase } from "./supabase-init.js";
import { saveSession, createNewSession, updateSessionMetrics, finalizeSession } from "./sessions.js";
import { getGhost } from "./ghosts.js";
import { sessionToTCX } from "./tcx.js";

/* ------------------------------------------------------------
   GLOBAL STATE
------------------------------------------------------------ */
let activeWorkout = null;
let activeSession = null;
let workoutSteps = [];
let stepIndex = 0;
let stepElapsed = 0;
let stepTimer = null;

let livePoints = [];
let lastTS = null;

let ghostEnabled = false;
let ghostData = null;

let chart = null;
let chartCtx = null;

/* ------------------------------------------------------------
   UI HELPERS
------------------------------------------------------------ */
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

function showError(e) {
  console.error("[ERR]", e);
  const card = $("#err-card");
  $("#err-log").textContent = e?.stack ?? e;
  card.classList.remove("hidden");
}

/* ------------------------------------------------------------
   WORKOUT LOADING
------------------------------------------------------------ */
function loadWorkoutFromLocalStorage() {
  const arr = JSON.parse(localStorage.getItem("custom_workouts_v2") || "[]");
  const s = $("#workout-select");
  s.innerHTML = "";
  arr.forEach((w, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = w.name || "Økt";
    s.appendChild(opt);
  });
  return arr;
}

/* ------------------------------------------------------------
   INIT RUNTIME FOR SELECTED WORKOUT
------------------------------------------------------------ */
function prepareWorkout() {
  const workouts = loadWorkoutFromLocalStorage();
  const idx = Number($("#workout-select").value || 0);
  activeWorkout = workouts[idx] || null;

  if (!activeWorkout) {
    $("#current-step-name").textContent = "Ingen økt valgt";
    return;
  }

  workoutSteps = [];
  activeWorkout.series.forEach(series => {
    for (let r = 0; r < (series.reps || 1); r++) {
      workoutSteps.push({
        name: series.name || "Drag",
        duration: Number(series.durationSec || 0),
        speed: series.speed ?? null,
        grade: series.grade ?? null,
        rpe: series.rpe ?? null
      });
    }
  });

  stepIndex = 0;
  stepElapsed = 0;

  $("#current-step-name").textContent = workoutSteps[0]?.name ?? "–";
  $("#next1").textContent = "Neste: " + (workoutSteps[1]?.name ?? "–");
  $("#next2").textContent = "Deretter: " + (workoutSteps[2]?.name ?? "–");
}

/* ------------------------------------------------------------
   TIMER ENGINE
------------------------------------------------------------ */
function tick() {
  if (!activeSession) return;

  stepElapsed += 1;
  const step = workoutSteps[stepIndex];

  if (step) {
    $("#timer").textContent = fmt(stepElapsed);
    $("#current-step-name").textContent = step.name;

    // progress bar
    const pct = (stepElapsed / (step.duration || 1)) * 100;
    $("#progress").style.width = Math.min(100, pct) + "%";

    // advance?
    if (stepElapsed >= step.duration) {
      advanceStep();
    }
  }

  // session metrics
  updateSessionStats();
}

/* ------------------------------------------------------------
   ADVANCE STEP
------------------------------------------------------------ */
function advanceStep() {
  stepIndex++;
  stepElapsed = 0;
  if (stepIndex >= workoutSteps.length) {
    completeWorkout();
    return;
  }

  const s1 = workoutSteps[stepIndex];
  const s2 = workoutSteps[stepIndex + 1];
  const s3 = workoutSteps[stepIndex + 2];
  $("#current-step-name").textContent = s1.name;
  $("#next1").textContent = "Neste: " + (s2?.name ?? "–");
  $("#next2").textContent = "Deretter: " + (s3?.name ?? "–");
}

/* ------------------------------------------------------------
   FINISH WORKOUT
------------------------------------------------------------ */
async function completeWorkout() {
  stopTimer();
  try {
    await finalizeSession(activeSession);
    alert("Økt lagret i skyen (og lokalt).");
  } catch (e) {
    showError(e);
  }
}

/* ------------------------------------------------------------
   START / PAUSE / STOP
------------------------------------------------------------ */
function startTimer() {
  if (stepTimer) return;
  stepTimer = setInterval(tick, 1000);
}

function stopTimer() {
  clearInterval(stepTimer);
  stepTimer = null;
}

/* ------------------------------------------------------------
   START WORKOUT
------------------------------------------------------------ */
function startWorkout() {
  if (!activeWorkout) prepareWorkout();

  activeSession = createNewSession(activeWorkout.name);

  stepIndex = 0;
  stepElapsed = 0;
  livePoints = [];

  $("#sp-label").textContent = "Pause";
  $("#sp-icon").className = "ph-pause";

  startTimer();
}

/* ------------------------------------------------------------
   PAUSE / RESUME
------------------------------------------------------------ */
function toggleStartPause() {
  if (!stepTimer) {
    startTimer();
    $("#sp-label").textContent = "Pause";
    $("#sp-icon").className = "ph-pause";
  } else {
    stopTimer();
    $("#sp-label").textContent = "Fortsett";
    $("#sp-icon").className = "ph-play";
  }
}

/* ------------------------------------------------------------
   DISCARD
------------------------------------------------------------ */
function discardWorkout() {
  if (!activeSession) return;
  if (confirm("Forkaste økten?")) {
    stopTimer();
    activeSession = null;
    stepIndex = 0;
    stepElapsed = 0;
    livePoints = [];
    $("#timer").textContent = "00:00";
  }
}

/* ------------------------------------------------------------
   DRAW GRAPH (LIVE)
------------------------------------------------------------ */
function initChart() {
  const c = $("#chart");
  chartCtx = c.getContext("2d");
}

function redrawGraph() {
  const c = $("#chart");
  const ctx = chartCtx;
  ctx.clearRect(0, 0, c.width, c.height);

  if (livePoints.length < 2) return;

  // draw HR
  if ($("#show-hr").checked) {
    ctx.strokeStyle = "#ef4444";
    ctx.beginPath();
    livePoints.forEach((p, i) => {
      const x = i * 3;
      const y = 200 - (p.hr || 0);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  // ghost
  if (ghostEnabled && ghostData) {
    ctx.strokeStyle = "#10b981";
    ctx.beginPath();
    ghostData.forEach((p, i) => {
      const x = i * 3;
      const y = 200 - (p.hr || 0);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
}

/* ------------------------------------------------------------
   SESSION METRICS
------------------------------------------------------------ */
function updateSessionStats() {
  const now = Date.now();
  if (lastTS) {
    const dt = (now - lastTS) / 1000;
    const last = livePoints[livePoints.length - 1];
    if (last) {
      activeSession.metrics.dist += (last.speed_ms || 0) * dt;
    }
  }
  lastTS = now;

  $("#st-elapsed").textContent = fmt(totalTime());
  $("#st-dist").textContent = (activeSession.metrics.dist / 1000).toFixed(2) + " km";

  redrawGraph();
}

function totalTime() {
  let s = 0;
  workoutSteps.forEach((st, i) => {
    if (i < stepIndex) s += st.duration;
  });
  s += stepElapsed;
  return s;
}

/* ------------------------------------------------------------
   UTILS
------------------------------------------------------------ */
function fmt(sec) {
  sec = Math.max(0, Math.floor(sec));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

/* ------------------------------------------------------------
   GHOST HANDLING
------------------------------------------------------------ */
async function pickGhost() {
  const id = prompt("Client ID fra logg?");
  if (!id) return;
  ghostData = await getGhost(id);
  ghostEnabled = true;
  $("#ghost-enable").checked = true;
  redrawGraph();
}

/* ------------------------------------------------------------
   UI WIRING
------------------------------------------------------------ */
function wireUI() {
  $("#workout-select").onchange = prepareWorkout;

  $("#btn-start-pause").onclick = toggleStartPause;
  $("#btn-stop-save").onclick = () => completeWorkout();
  $("#btn-discard").onclick = discardWorkout;

  $("#ghost-picker").onclick = pickGhost;
  $("#ghost-enable").onchange = e => {
    ghostEnabled = e.target.checked;
    redrawGraph();
  };

  $(".speed-btn").forEach(btn => {
    btn.onclick = () => {
      $("#manual-speed").value = btn.dataset.speed;
    };
  });

  $(".grade-btn").forEach(btn => {
    btn.onclick = () => {
      $("#manual-grade").value = btn.dataset.grade;
    };
  });
}

/* ------------------------------------------------------------
   BOOTSTRAP
------------------------------------------------------------ */
function bootstrap() {
  wireUI();
  initChart();
  prepareWorkout();
}

document.addEventListener("DOMContentLoaded", bootstrap);
