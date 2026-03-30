// ============================================================================
// INTZ v11 – views/log.js
//
// Port av tidligere log.html + script, men modulær og SPA-basert.
//
// Funksjonalitet:
//   • Viser liste over alle lagrede sessions
//   • Slett-knapp per økt
//   • Klikk → viser resultater (SPA-navigasjon via hash + results view)
// ============================================================================

import { getNS, setNS } from "../core/storage.js";
import * as UI from "../core/ui.js";
import { showView } from "../app.js";

export function onShow() {
  const root = document.getElementById("view-log");
  if (!root._intzInit) {
    buildDOM(root);
    root._intzInit = true;
  }
  renderList();
}

// ============================================================================
// Build DOM
// ============================================================================
function buildDOM(root) {
  root.innerHTML = `
    <section class="leftcol">
      <div class="card">
        <h3>Økter</h3>
        <div id="log-list"></div>
      </div>
    </section>
  `;
}

// ============================================================================
// Render session list
// ============================================================================
function renderList() {
  const wrap = document.getElementById("log-list");
  wrap.innerHTML = "";

  const sessions = getNS("sessions", []);
  if (!sessions.length) {
    wrap.innerHTML = `<p class="small">Ingen økter enda.</p>`;
    return;
  }

  const list = document.createElement("div");
  list.style.display = "grid";
  list.style.gap = "8px";

  // Reverse order (nyeste først)
  sessions
    .slice()
    .reverse()
    .forEach(s => {
      const row = document.createElement("div");
      row.className = "menu-item";
      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.alignItems = "center";

      const started = new Date(s.startedAt || Date.now()).toLocaleString();
      const dist =
        s.points && s.points.length
          ? (s.points[s.points.length - 1].dist_m / 1000).toFixed(2) + " km"
          : "";

      // CLICK → Results
      const left = document.createElement("button");
      left.className = "ghost";
      left.style.flex = "1";
      left.style.textAlign = "left";
      left.style.fontSize = "14px";
      left.innerHTML = `${s.name || "Økt"} — ${started}`;

      left.onclick = () => {
        // SPA: Sett hash → bytt view
        location.hash = s.id;
        showView("results");
      };

      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.alignItems = "center";
      right.style.gap = "8px";

      const distSpan = document.createElement("span");
      distSpan.textContent = dist;
      right.appendChild(distSpan);

      const del = document.createElement("button");
      del.className = "ghost";
      del.title = "Slett";
      del.innerHTML = `<i class="ph-trash"></i>`;

      del.onclick = () => {
        if (confirm("Slette denne økta?")) {
          const arr = getNS("sessions", []);
          const idx = arr.findIndex(x => x.id === s.id);
          if (idx >= 0) {
            arr.splice(idx, 1);
            setNS("sessions", arr);
            renderList();
          }
        }
      };

      right.appendChild(del);

      row.appendChild(left);
      row.appendChild(right);
      list.appendChild(row);
    });

  wrap.appendChild(list);
}
