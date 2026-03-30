// ============================================================================
// INTZ v11 – graph.js
// Felles grafmotor for LIVE-graf (dashboard) og RESULTAT-graf (results).
//
// Tegner: HR (rød), Watt (grønn), Speed (blå), RPE (gul)
// Funksjoner:
//   initCanvas(canvas)      → returnerer ctx
//   drawLive(ctx, series, opts)
//   drawResult(ctx, pts, opts)
//   computeScale(values, locked, minLock, maxLock)
//
// Avhengigheter:
//   storage.js  → getNS()
//   time.js     → avg()
// ============================================================================

import { getNS } from "./storage.js";
import { avg } from "./time.js";

// ============================================================================
// Utilities
// ============================================================================

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function computeScale(values, locked, minLock, maxLock, padFrac = 0.05) {
  if (locked) return { min: minLock, max: maxLock };

  if (!values.length) return { min: 0, max: 1 };

  let min = Math.min(...values);
  let max = Math.max(...values);

  // apply padding
  const pad = Math.max((max - min) * padFrac, 0.0001);
  min -= pad;
  max += pad;

  if (max <= min) max = min + 1;

  return { min, max };
}

// ============================================================================
// initCanvas
// ============================================================================
export function initCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  return ctx;
}

// ============================================================================
// LIVE GRAPH (dashboard)
// series = { hr:[], speed:[], watt:[], rpe:[] }
// opts = {
//   showHR, showWatt, showSpeed, showRPE,
//   LT1, LT2,
//   width, height
// }
// ============================================================================
export function drawLive(ctx, series, opts) {
  const W = opts.width;
  const H = opts.height;

  ctx.canvas.width = W;
  ctx.canvas.height = H;

  ctx.clearRect(0, 0, W, H);

  const padL = 60;
  const padR = 60;
  const padT = 30;
  const padB = 24;

  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  if (plotW <= 0 || plotH <= 0) return;

  const now = Date.now();
  const xmin = now - opts.windowSec * 1000;
  const xmax = now;

  const HR = series.hr.filter(p => p.t >= xmin);
  const SP = series.speed.filter(p => p.t >= xmin);
  const WT = series.watt.filter(p => p.t >= xmin);
  const RP = series.rpe.filter(p => p.t >= xmin);

  // Extract values
  const hrVals = HR.map(p => p.y).filter(v => v != null);
  const spVals = SP.map(p => p.y).filter(v => v != null);
  const wtVals = WT.map(p => p.y).filter(v => v != null);

  // Scales with locks
  const lockHR = getNS("hrLock", false);
  const hrSc = computeScale(
    hrVals,
    lockHR,
    getNS("hrMin", 80),
    getNS("hrMax", 200)
  );

  const lockW = getNS("wLock", false);
  const wSc = computeScale(
    wtVals,
    lockW,
    getNS("wMin", 0),
    getNS("wMax", 400)
  );

  const lockS = getNS("sLock", false);
  const sSc = computeScale(
    spVals,
    lockS,
    getNS("sMin", 0),
    getNS("sMax", 20)
  );

  const lockR = getNS("rpeLock", false);
  const rSc = {
    min: lockR ? getNS("rpeMin", 0) : 0,
    max: lockR ? getNS("rpeMax", 10) : 10,
  };

  // Mapping
  const xTime = t =>
    padL + ((t - xmin) / Math.max(1, xmax - xmin)) * plotW;

  const yHR = v =>
    padT + (1 - (v - hrSc.min) / (hrSc.max - hrSc.min)) * plotH;

  const yW = v =>
    padT + (1 - (v - wSc.min) / (wSc.max - wSc.min)) * plotH;

  const yS = v =>
    padT + (1 - (v - sSc.min) / (sSc.max - sSc.min)) * plotH;

  const yR = v =>
    padT + (1 - (v - rSc.min) / (rSc.max - rSc.min)) * plotH;

  // LT shading
  ctx.save();
  if (opts.LT1 && opts.LT2) {
    const yLT1 = yHR(opts.LT1);
    const yLT2 = yHR(opts.LT2);

    // over LT2
    ctx.fillStyle = "rgba(220, 38, 38, 0.10)";
    ctx.fillRect(padL, padT, plotW, Math.max(0, yLT2 - padT));

    // LT1–LT2
    ctx.fillStyle = "rgba(217, 119, 6, 0.08)";
    ctx.fillRect(
      padL,
      Math.max(padT, yLT2),
      plotW,
      Math.max(0, Math.min(H - padB, yLT1) - Math.max(padT, yLT2))
    );

    // under LT1
    ctx.fillStyle = "rgba(22, 163, 74, 0.08)";
    ctx.fillRect(
      padL,
      Math.max(padT, yLT1),
      plotW,
      Math.max(0, (H - padB) - Math.max(padT, yLT1))
    );
  }
  ctx.restore();

  // Minute grid
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let sec = 0; sec <= opts.windowSec; sec += 60) {
    const t = xmin + sec * 1000;
    const x = xTime(t);
    ctx.moveTo(x, padT);
    ctx.lineTo(x, padT + plotH);
  }
  ctx.stroke();

  // Draw lines
  function drawLine(arr, color, ymap, alpha = 1) {
    if (!arr || arr.length < 2) return;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    let moved = false;
    for (const p of arr) {
      if (p.t < xmin) continue;
      const x = xTime(p.t);
      const y = ymap(p.y);
      if (!moved) {
        ctx.moveTo(x, y);
        moved = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (opts.showHR) drawLine(HR, "#ef4444", yHR, 1);
  if (opts.showWatt) drawLine(WT, "#16a34a", yW, 1);
  if (opts.showSpeed) drawLine(SP, "#2563eb", yS, 1);
  if (opts.showRPE) drawLine(RP, "#d97706", yR, 1);

  // Ghost overlay (only HR + watt)
  if (opts.ghost && opts.ghost.avg && opts.workoutStart) {
    const g = opts.ghost.avg;
    const startTs = new Date(opts.workoutStart).getTime();

    const gHR = [];
    const gW = [];

    for (let t = xmin; t <= xmax; t += 1000) {
      const sec = Math.floor((t - startTs) / 1000);
      if (sec >= 0 && sec <= g.dur) {
        if (g.hr[sec] != null) gHR.push({ t, y: g.hr[sec] });
        if (g.w[sec] != null) gW.push({ t, y: g.w[sec] });
      }
    }

    if (opts.showHR) drawLine(gHR, "#ef4444", yHR, 0.35);
    if (opts.showWatt) drawLine(gW, "#16a34a", yW, 0.35);
  }

  ctx.globalAlpha = 1;
}

// ============================================================================
// drawResult – full øktgraf
// pts = array med { ts, hr, speed_ms, watt, rpe }
// opts = { showHR, showWatt, showSpeed, showRPE, LT1, LT2 }
// ============================================================================
export function drawResult(ctx, pts, opts) {
  const W = opts.width;
  const H = opts.height;

  ctx.canvas.width = W;
  ctx.canvas.height = H;

  ctx.clearRect(0, 0, W, H);

  if (!pts.length) return;

  const padL = 60;
  const padR = 60;
  const padT = 30;
  const padB = 24;

  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  if (plotW <= 0 || plotH <= 0) return;

  const xmin = pts[0].ts;
  const xmax = pts[pts.length - 1].ts;

  const hrVals = pts.map(p => p.hr).filter(v => v != null);
  const spVals = pts.map(p => p.speed_ms * 3.6).filter(v => v != null);
  const wtVals = pts.map(p => p.watt).filter(v => v != null);

  const lockHR = getNS("hrLock", false);
  const hrSc = computeScale(
    hrVals,
    lockHR,
    getNS("hrMin", 80),
    getNS("hrMax", 200)
  );

  const lockW = getNS("wLock", false);
  const wSc = computeScale(
    wtVals,
    lockW,
    getNS("wMin", 0),
    getNS("wMax", 400)
  );

  const lockS = getNS("sLock", false);
  const sSc = computeScale(
    spVals,
    lockS,
    getNS("sMin", 0),
    getNS("sMax", 20)
  );

  const rSc = {
    min: 0,
    max: 10,
  };

  const xTime = t =>
    padL + ((t - xmin) / Math.max(1, xmax - xmin)) * plotW;

  const yHR = v =>
    padT + (1 - (v - hrSc.min) / (hrSc.max - hrSc.min)) * plotH;

  const yW = v =>
    padT + (1 - (v - wSc.min) / (wSc.max - wSc.min)) * plotH;

  const yS = v =>
    padT + (1 - (v - sSc.min) / (sSc.max - sSc.min)) * plotH;

  const yR = v =>
    padT + (1 - (v - rSc.min) / (rSc.max - rSc.min)) * plotH;

  function drawLinePts(getVal, color, ymap, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    let moved = false;
    for (const p of pts) {
      const v = getVal(p);
      if (v == null) continue;
      const x = xTime(p.ts);
      const y = ymap(v);
      if (!moved) {
        ctx.moveTo(x, y);
        moved = true;
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // HR/watt/speed/RPE
  if (opts.showHR) drawLinePts(p => p.hr, "#ef4444", yHR, 1);
  if (opts.showWatt) drawLinePts(p => p.watt, "#16a34a", yW, 1);
  if (opts.showSpeed) drawLinePts(p => p.speed_ms * 3.6, "#2563eb", yS, 1);
  if (opts.showRPE) drawLinePts(p => p.rpe, "#d97706", yR, 1);

  ctx.globalAlpha = 1;
}
