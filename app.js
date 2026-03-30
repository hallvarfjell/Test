// ============================================================================
// INTZ v11 – app.js
// SPA-router + global init + BLE + Session bridge
//
// Denne filen:
//   • Bytter views ved klikk i topbaren (uten side-reload)
//   • Initialiserer BLE, Session, Logger og Live-loop
//   • Exposer INTZ_* variabler som brukes av logger.js/session.js
//   • Laster views dynamisk (views/*.js)
// ============================================================================

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import * as UI from "./core/ui.js";
import * as BLE from "./core/ble.js";
import * as Session from "./core/session.js";
import * as Logger from "./core/logger.js";

// Views
import * as Dashboard from "./views/dashboard.js";
import * as Builder from "./views/builder.js";
import * as Results from "./views/results.js";
import * as LogView from "./views/log.js";
import * as Settings from "./views/settings.js";
import * as Help from "./views/help.js";

// ---------------------------------------------------------------------------
// SPA ROUTER
// ---------------------------------------------------------------------------

const views = {
  dashboard: Dashboard,
  builder: Builder,
  results: Results,
  log: LogView,
  settings: Settings,
  help: Help,
};

export function showView(name) {
  document.querySelectorAll(".view").forEach(v => (v.hidden = true));
  const el = document.getElementById("view-" + name);
  if (el) el.hidden = false;

  // trigger event
  if (views[name]?.onShow) views[name].onShow();
}

// bind topbar buttons
document.querySelectorAll("[data-view]").forEach(btn => {
  btn.addEventListener("click", () => showView(btn.dataset.view));
});

// initial screen
showView("dashboard");

// ---------------------------------------------------------------------------
// GLOBAL INTZ_* VARIABLER  (brukes av logger + session)
// dashboard.js oppdaterer disse verdiene hvert sekund.
// ---------------------------------------------------------------------------
window.INTZ_HR = 0;
window.INTZ_SPEED = 0;
window.INTZ_GRADE = 0;
window.INTZ_PHASE = "";
window.INTZ_REP = 0;
window.INTZ_RPE = 0;
window.INTZ_WATT = 0;

// ---------------------------------------------------------------------------
// BLE INITIALISERING
// ---------------------------------------------------------------------------

UI.onClick("btn-connect-hr", async () => {
  const ok = await BLE.connectHeartRate();
  if (ok) updateBLEStatus();
});

UI.onClick("btn-connect-tm", async () => {
  const ok = await BLE.connectTreadmill();
  if (ok) updateBLEStatus();
});

// Oppdater toppknappenes farger
function updateBLEStatus() {
  const hrBtn = document.getElementById("btn-connect-hr");
  const tmBtn = document.getElementById("btn-connect-tm");

  if (BLE.BLE.hrDevice && BLE.BLE.hrDevice.gatt.connected) {
    hrBtn.classList.remove("disconnected");
    hrBtn.classList.add("connected");
  } else {
    hrBtn.classList.remove("connected");
    hrBtn.classList.add("disconnected");
  }

  if (BLE.BLE.tmDevice && BLE.BLE.tmDevice.gatt.connected) {
    tmBtn.classList.remove("disconnected");
    tmBtn.classList.add("connected");
  } else {
    tmBtn.classList.remove("connected");
    tmBtn.classList.add("disconnected");
  }
}

// Lytt etter disconnect-events
BLE.on("disconnect", () => updateBLEStatus());

// ---------------------------------------------------------------------------
// LIVE LOOP – oppdaterer INTZ_* varsler og gir data til logger/graph
// Dashboard.js tegner grafen, app.js mater data.
// ---------------------------------------------------------------------------

setInterval(() => {
  // Hent HR
  if (BLE.BLE.hr != null) window.INTZ_HR = BLE.BLE.hr;

  // Speed/grade fra tredemølle
  window.INTZ_SPEED = BLE.BLE.speedKmh;
  window.INTZ_GRADE = BLE.BLE.gradePct;

  // Session-state
  const w = Session.Session.workout;
  if (w) {
    window.INTZ_PHASE = w.phase;
    window.INTZ_REP = w.rep ?? 0;
  } else {
    window.INTZ_PHASE = "";
    window.INTZ_REP = 0;
  }

  // RPE (oppdateres av dashboard.js via UI)
  // window.INTZ_RPE holdes uendret her

  // Watt → beregnes i dashboard.js og settes som INTZ_WATT

  // Dashboard live-update
  Dashboard.onLiveTick?.();

}, 500); // halvt sekund → smooth oppdatering

// ---------------------------------------------------------------------------
// SESSION CONTROL BRIDGE
// (dashboard.js kaller disse via globale exports)
// ---------------------------------------------------------------------------

window.INTZ_startSession = () => Session.start();
window.INTZ_pauseSession = () => Session.pause();
window.INTZ_stopSession = () => Session.stop();
window.INTZ_prevPhase = () => Session.prevPhase();
window.INTZ_nextPhase = () => Session.nextPhase();

// ---------------------------------------------------------------------------
// END OF FILE
// ============================================================================
