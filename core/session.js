// ============================================================================
// INTZ v11 – session.js
// Full state-machine for treningsøkter.
// Komplett portering fra INTZ v10 main.js, men helt modulær og UI-uavhengig.
//
// Eksporterer:
//   Session.state           → gjeldende økt + dynamikk
//   loadWorkout(cfg)        → initerer økt fra mal (v2-format)
//   start(), pause(), stop()
//   tick()                  → kalles hvert sekund
//   nextPhase(), prevPhase()
//
// Avhengigheter: logger.js (writeSample), time.js (fmtMMSS), storage.js (getNS)
//
// ============================================================================

import { getNS, setNS, delNS } from "./storage.js";
import { fmtMMSS, clamp } from "./time.js";
import { Logger, startLogger, stopLogger, writeSample } from "./logger.js";

// ============================================================================
// Internal helpers
// ============================================================================

function safe(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

// ============================================================================
// Session state
// ============================================================================
export const Session = {
  workout: null,      // aktiv økt (objekt)
  totalSec: 0,        // total varighet
  ticker: null,       // setInterval id
};

// ============================================================================
// Konverterer øktmal (v2) til intern state-machine obj.
// ============================================================================
export function loadWorkout(cfg) {
  Session.workout = {
    name: cfg.name ?? "Økt",
    phase: "warmup",
    startedAt: null,
    endedAt: null,

    warmupSec: safe(cfg.warmupSec),
    cooldownSec: safe(cfg.cooldownSec),

    series: (cfg.series ?? []).map(s => ({
      reps: safe(s.reps),
      workSec: safe(s.workSec),
      restSec: safe(s.restSec),
      seriesRestSec: safe(s.seriesRestSec),
      note: s.note ?? "",
    })),

    sIdx: -1,
    rep: 0,

    tLeft: safe(cfg.warmupSec),
  };

  Session.totalSec = computeTotalDuration(cfg);
  return Session.workout;
}

// ============================================================================
// Beregn total varighet
// ============================================================================
export function computeTotalDuration(cfg) {
  const s = cfg.series ?? [];
  let total = safe(cfg.warmupSec) + safe(cfg.cooldownSec);
  for (const x of s) {
    total += safe(x.reps) * (safe(x.workSec) + safe(x.restSec));
    total += safe(x.seriesRestSec);
  }
  return total;
}

// ============================================================================
// TICK – kalles hvert sekund mens økt kjører
// ============================================================================
export function tick() {
  const w = Session.workout;
  if (!w) return;

  if (w.phase === "done") {
    stop();
    return;
  }

  w.tLeft = Math.max(0, safe(w.tLeft) - 1);

  if (w.tLeft <= 0) {
    nextPhase();
  }
}

// ============================================================================
// Start økt
// ============================================================================
export function start() {
  const w = Session.workout;
  if (!w) return;

  if (!w.startedAt) {
    w.startedAt = new Date().toISOString();
    startLogger();
  }

  if (!Session.ticker) {
    Session.ticker = setInterval(() => {
      const t = Date.now();
      tick();
      if (Logger.active) writeSample(t);
    }, 1000);
  }
}

// ============================================================================
// Pause økt
// ============================================================================
export function pause() {
  if (Session.ticker) {
    clearInterval(Session.ticker);
    Session.ticker = null;
  }
}

// ============================================================================
// Stopper økt, lagrer, avslutter
// ============================================================================
export function stop() {
  pause();

  const w = Session.workout;
  if (!w) return;

  w.phase = "done";
  w.tLeft = 0;
  w.endedAt = new Date().toISOString();

  const t = Date.now();
  if (Logger.active) writeSample(t);
  stopLogger();

  // Lagring av økt
  saveSession();

  // Hvis du ønsker: Session.workout = null;
}

// ============================================================================
// Lagrer økta til localStorage
// ============================================================================
function saveSession() {
  const w = Session.workout;
  if (!w) return;

  if (!w.startedAt) w.startedAt = new Date().toISOString();
  if (!w.endedAt) w.endedAt = new Date().toISOString();

  const session = {
    id: "s" + Date.now(),
    name: w.name,
    reps: (w.series ?? []).reduce((a, b) => a + safe(b.reps), 0),
    startedAt: w.startedAt,
    endedAt: w.endedAt,
    lt1: getNS("LT1", 135),
    lt2: getNS("LT2", 160),
    massKg: getNS("massKg", 75),
    rpeByRep: getNS("rpeByRep", {}),

    points: Logger.points.slice(),
  };

  const arr = getNS("sessions", []);
  arr.push(session);
  setNS("sessions", arr);
}

// ============================================================================
// NEXT PHASE (INTZ v10 komplett implementasjon)
// ============================================================================
export function nextPhase() {
  const w = Session.workout;
  if (!w) return;

  const S = w.series;

  // Oppvarming → serie eller cooldown
  if (w.phase === "warmup") {
    if (S.length) {
      w.phase = "work";
      w.sIdx = 0;
      w.rep = 1;
      w.tLeft = S[0].workSec;
      if (w.tLeft === 0) {
        w.phase = "rest";
        w.tLeft = S[0].restSec;
      }
    } else {
      w.phase = "cooldown";
      w.tLeft = w.cooldownSec;
    }
    return;
  }

  // Work
  if (w.phase === "work") {
    const s = S[w.sIdx];
    if (w.rep < s.reps) {
      w.phase = "rest";
      w.tLeft = s.restSec;
      return;
    }
    // siste rep av serie
    if (w.sIdx < S.length - 1) {
      const sr = s.seriesRestSec;
      if (sr > 0) {
        w.phase = "seriesrest";
        w.tLeft = sr;
        return;
      }
      w.sIdx++;
      w.phase = "work";
      w.rep = 1;
      w.tLeft = S[w.sIdx].workSec;
      if (w.tLeft === 0) {
        w.phase = "rest";
        w.tLeft = S[w.sIdx].restSec;
      }
      return;
    }

    // Siste serie → cooldown
    w.phase = "cooldown";
    w.tLeft = w.cooldownSec;
    return;
  }

  // Rest
  if (w.phase === "rest") {
    const s = S[w.sIdx];
    if (w.rep < s.reps) {
      w.rep++;
      w.phase = "work";
      w.tLeft = s.workSec;
      if (w.tLeft === 0) {
        w.phase = "rest";
        w.tLeft = s.restSec;
      }
      return;
    }

    // Siste rep
    if (w.sIdx < S.length - 1) {
      const sr = s.seriesRestSec;
      if (sr > 0) {
        w.phase = "seriesrest";
        w.tLeft = sr;
        return;
      }
      w.sIdx++;
      w.phase = "work";
      w.rep = 1;
      w.tLeft = S[w.sIdx].workSec;
      if (w.tLeft === 0) {
        w.phase = "rest";
        w.tLeft = S[w.sIdx].restSec;
      }
      return;
    }

    // Siste serie
    w.phase = "cooldown";
    w.tLeft = w.cooldownSec;
    return;
  }

  // Series rest
  if (w.phase === "seriesrest") {
    w.sIdx++;
    w.phase = "work";
    w.rep = 1;
    w.tLeft = S[w.sIdx].workSec;
    if (w.tLeft === 0) {
      w.phase = "rest";
      w.tLeft = S[w.sIdx].restSec;
    }
    return;
  }

  // Cooldown → done
  if (w.phase === "cooldown") {
    w.phase = "done";
    w.tLeft = 0;
    w.endedAt = new Date().toISOString();

    const t = Date.now();
    if (Logger.active) writeSample(t);
    stopLogger();
    saveSession();
    return;
  }
}

// ============================================================================
// PREVIOUS PHASE (som i INTZ v10)
// ============================================================================
export function prevPhase() {
  const w = Session.workout;
  if (!w) return;

  const S = w.series;

  if (w.phase === "work") {
    const s = S[w.sIdx];
    if (w.rep > 1) {
      w.rep--;
      w.phase = "rest";
      w.tLeft = s.restSec;
      return;
    }
    // rep = 1 → hopp bakover i serie
    if (w.sIdx > 0) {
      w.sIdx--;
      const prev = S[w.sIdx];
      w.phase = "work";
      w.rep = prev.reps;
      w.tLeft = prev.workSec;
      if (w.tLeft === 0) {
        w.phase = "rest";
        w.tLeft = prev.restSec;
      }
      return;
    }
    // tilbake til warmup
    w.phase = "warmup";
    w.tLeft = w.warmupSec;
    return;
  }

  if (w.phase === "rest") {
    const s = S[w.sIdx];
    w.phase = "work";
    w.tLeft = s.workSec;
    if (w.tLeft === 0) {
      w.phase = "rest";
      w.tLeft = s.restSec;
    }
    return;
  }

  if (w.phase === "seriesrest") {
    const prev = S[w.sIdx - 1];
    if (prev) {
      w.sIdx--;
      w.phase = "work";
      w.rep = prev.reps;
      w.tLeft = prev.workSec;
      if (w.tLeft === 0) {
        w.phase = "rest";
        w.tLeft = prev.restSec;
      }
    } else {
      w.phase = "warmup";
      w.tLeft = w.warmupSec;
    }
    return;
  }

  if (w.phase === "cooldown") {
    const last = S[S.length - 1];
    if (last) {
      w.phase = "work";
      w.sIdx = S.length - 1;
      w.rep = last.reps;
      w.tLeft = last.workSec;
      if (w.tLeft === 0) {
        w.phase = "rest";
        w.tLeft = last.restSec;
      }
    } else {
      w.phase = "warmup";
      w.tLeft = w.warmupSec;
    }
  }
}
