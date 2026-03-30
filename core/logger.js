// ============================================================================
// INTZ v11 – logger.js
// Full prøvetakingsmotor for INTZ-økter. Portert fra INTZ v10 main.js.
//
// Funksjoner:
//   startLogger()
//   stopLogger()
//   writeSample(ts)
//   computeLastWorkMetrics()
//   makeGhostData(points)     → brukt i results/ghost
//
// Avhengigheter:
//   storage.js  → getNS()
//   time.js     → avg()
// ============================================================================

import { getNS } from "./storage.js";
import { avg, msToKmh } from "./time.js";

// ============================================================================
// Logger state
// ============================================================================
export const Logger = {
  active: false,
  points: [],
  startTs: null,
  dist: 0,
  elev: 0,
  tss: 0,
};

// ============================================================================
// Start logging
// ============================================================================
export function startLogger() {
  Logger.active = true;
  Logger.startTs = Date.now();
  Logger.points = [];
  Logger.dist = 0;
  Logger.elev = 0;
  Logger.tss = 0;
}

// ============================================================================
// Stop logging (ikke nullstill – det gjør session.js på lagring)
// ============================================================================
export function stopLogger() {
  Logger.active = false;
}

// ============================================================================
// writeSample(ts)
// Skriver inn et punkt i loggen. Kalles hvert sekund fra session.js tick.
// Struktur på punkt:
// {
//   ts, iso, hr, speed_ms, grade, dist_m, rpe, phase, rep, watt
// }
//
// distance beregnes relativt til forrige punkt
// elev: speed_ms * grade_fraction * dt
// TSS (HR-basert): dt/3600 * (HR/LTHR)^2 * 100
// ============================================================================
export function writeSample(ts) {
  const last = Logger.points.length
    ? Logger.points[Logger.points.length - 1]
    : null;

  // Disse verdiene leveres fra dashboard.js (som nå leser BLE + session state)
  const hr = window.INTZ_HR ?? 0;
  const speedKmh = window.INTZ_SPEED ?? 0;
  const speed_ms = speedKmh / 3.6;

  const gradePct = window.INTZ_GRADE ?? 0;
  const gradeFrac = (gradePct || 0) / 100;

  const phase = window.INTZ_PHASE ?? "";      // settes av dashboard -> session
  const rep = window.INTZ_REP ?? 0;
  const rpe = window.INTZ_RPE ?? 0;
  const watt = window.INTZ_WATT ?? 0;

  // distance
  let dt = 0;
  if (last) dt = (ts - last.ts) / 1000;

  if (last && dt > 0) {
    Logger.dist += speed_ms * dt;
  }

  // elevasjon
  if (last && dt > 0) {
    const dh = speed_ms * gradeFrac * dt;
    if (dh > 0) Logger.elev += dh;
  }

  // TSS – HR-basert (samme modell som INTZ v10)
  const LT2 = getNS("LT2", 160);
  if (LT2 > 0 && hr > 0 && dt > 0) {
    const ifHr = hr / LT2; // intensity factor
    Logger.tss += (dt / 3600) * (ifHr * ifHr) * 100;
  }

  const p = {
    ts,
    iso: new Date(ts).toISOString(),
    hr,
    speed_ms,
    grade: gradePct,
    dist_m: Logger.dist,
    rpe,
    phase,
    rep,
    watt,
  };

  Logger.points.push(p);
  return p;
}

// ============================================================================
// computeLastWorkMetrics()
// Finner snittfart og snitt-HR over siste "work"-segment (20s HR).
// Brukt av statuskort i dashboard.
// ============================================================================
export function computeLastWorkMetrics() {
  const pts = Logger.points;
  if (!pts.length) return { speed: null, hr20: null };

  // finn siste punkt i work-phase
  let j = pts.length - 1;
  while (j >= 0 && pts[j].phase !== "work") j--;
  if (j < 0) return { speed: null, hr20: null };

  const rep = pts[j].rep ?? 0;

  // gå bakover i samme drag
  let i = j;
  while (i >= 0 && pts[i].phase === "work" && pts[i].rep === rep) i--;
  i++;

  const seg = pts.slice(i, j + 1);

  const speeds = seg.map(p => msToKmh(p.speed_ms)).filter(v => v > 0);
  const speed = speeds.length ? avg(speeds) : null;

  // HR over siste 20 sek
  const endTs = pts[j].ts;
  const tMin = endTs - 20000;
  const hr20arr = seg.filter(p => p.ts >= tMin).map(p => p.hr).filter(v => v > 0);
  const hr20 = hr20arr.length ? Math.round(avg(hr20arr)) : null;

  return { speed, hr20 };
}

// ============================================================================
// makeGhostData(points)
// Lager ghost-data fra en økt: arrays : hr[], w[]
// Samme logikk som results.js i INTZ v10
// ============================================================================
export function makeGhostData(points) {
  if (!points.length) return { dur: 0, hr: [], w: [] };

  const t0 = points[0].ts;
  const tN = points[points.length - 1].ts;
  const dur = Math.max(0, Math.round((tN - t0) / 1000));

  const hr = new Array(dur + 1).fill(null);
  const w = new Array(dur + 1).fill(null);

  let idx = 0;

  for (let sec = 0; sec <= dur; sec++) {
    const target = t0 + sec * 1000;

    // finn nærmeste sample
    while (idx + 1 < points.length && points[idx + 1].ts <= target) {
      idx++;
    }

    const p = points[idx];
    hr[sec] = p.hr ?? 0;
    w[sec] = Math.round(p.watt ?? 0);
  }

  return { dur, hr, w };
}
