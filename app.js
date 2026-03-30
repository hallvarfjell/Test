// app.js
import * as Dashboard from "./views/dashboard.js";
import * as Builder from "./views/builder.js";
import * as Results from "./views/results.js";
import * as Log from "./views/log.js";
import * as Settings from "./views/settings.js";
import * as Help from "./views/help.js";

const views = {
  dashboard: Dashboard,
  builder: Builder,
  results: Results,
  log: Log,
  settings: Settings,
  help: Help,
};

export function showView(name) {
  document.querySelectorAll(".view").forEach(v => v.hidden = true);
  const el = document.getElementById(`view-${name}`);
  el.hidden = false;

  if (views[name]?.onShow) views[name].onShow();
}

document.querySelectorAll("[data-view]").forEach(btn => {
  btn.addEventListener("click", () => showView(btn.dataset.view));
});

// Start i dashboard
showView("dashboard");
