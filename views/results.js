// ============================================================================
// INTZ v11 – views/results.js
//
// Dette er full port av INTZ v10 results.js, omskrevet til modul-basert SPA.
//
// Inneholder:
//   • Henting av session (basert på hash eller siste lagret)
//   • Oppsummeringskort
//   • Snitt-metrikker (laps / drag)
//   • Full økt-graf (bruker core/graph.js)
//   • Zones (LT-basert tid i soner)
//   • TCX-eksport
//   • JSON-eksport
//   • Notater lagring
//
// Avhengigheter:
//   storage.js
//   graph.js
//   logger.js (for ghost helpers)
//   ui.js
// ============================================================================

import { getNS, setNS } from "../core/storage.js";
import * as UI from "../core/ui.js";
import * as Graph from "../core/graph.js";
import { fmtMMSS, avg } from "../core/time.js";
import { makeGhostData } from "../core/logger.js";

let SESSION = null;
let ctx = null;
let canvas = null;

// ============================================================================
// onShow – brukes av app.js router
// ============================================================================
export function onShow() {
  const root = document.getElementById("view-results");
  if (!root._intzInit) {
    buildDOM(root);
    root._intzInit = true;
  }

  loadSession();
  if (SESSION) {
    renderSummary();
    renderLaps();
    renderZones();
    initGraph();
    renderGraph();
  }
}

// ============================================================================
// Build DOM (full HTML‑struktur for results)
// ============================================================================

function buildDOM(root) {
  root.innerHTML = `
    <section class="leftcol">

      <div class="card">
        <h3>Oppsummering</h3>
        <div id="r-summary"></div>

        <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
          <button class="primary" id="r-download-tcx"><i class="ph-download-simple"></i> Last ned TCX</button>
          <button class="secondary" id="r-dump-json"><i class="ph-code"></i> Eksporter JSON</button>
        </div>
      </div>

      <div class="card">
        <h3>Vis metrikker</h3>
        <label><input id="r-show-hr" type="checkbox" checked> Puls (rød)</label>
        <label><input id="r-show-watt" type="checkbox" checked> Watt (grønn)</label>
        <label><input id="r-show-speed" type="checkbox"> Fart (blå)</label>
        <label><input id="r-show-rpe" type="checkbox" checked> RPE (gul)</label>
      </div>

      <div class="card">
        <h3>Merknader</h3>
        <textarea id="r-notes" rows="6" style="width:100%;"></textarea>
        <div style="margin-top:8px">
          <button class="secondary" id="r-notes-save"><i class="ph-floppy-disk"></i> Lagre</button>
        </div>
      </div>

      <div class="card" id="r-zones-card">
        <h3>Tid i pulssoner (LT-basert)</h3>
        <canvas id="r-zones" width="420" height="220"></canvas>
        <small class="muted">Under LT1, mellom LT1–LT2, over LT2</small>
      </div>

    </section>

    <section class="rightcol">

      <div class="card">
        <div class="graphhdr"><strong>Hele økta</strong> <span class="small">(HR=rød, Watt=grønn, Fart=blå, RPE=gul)</span></div>
        <div class="graphwrap">
          <canvas id="r-chart"></canvas>
        </div>
      </div>

      <div class="card">
        <h3>Drag (snittverdier)</h3>
        <div style="overflow:auto;">
          <table class="table" id="r-laps"></table>
        </div>
      </div>

    </section>
  `;

  // Bind knapper
  UI.onClick("r-download-tcx", downloadTCX);
  UI.onClick("r-dump-json", downloadJSONdump);
  UI.onClick("r-notes-save", saveNotes);

  // Graf visningsvalg
  document.getElementById("r-show-hr").addEventListener("change", renderGraph);
  document.getElementById("r-show-watt").addEventListener("change", renderGraph);
  document.getElementById("r-show-speed").addEventListener("change", renderGraph);
  document.getElementById("r-show-rpe").addEventListener("change", renderGraph);
}

// ============================================================================
// Load session (basert på location.hash eller siste økt)
// ============================================================================
function loadSession() {
  const sessions = getNS("sessions", []);
  if (!sessions.length) {
    SESSION = null;
    document.getElementById("r-summary").innerHTML = "<p>Ingen lagret økt.</p>";
    return;
  }

  const id = location.hash ? location.hash.substring(1) : "";
  if (id) SESSION = sessions.find(s => s.id === id) || null;
  else SESSION = sessions[sessions.length - 1];

  if (!SESSION) {
    document.getElementById("r-summary").innerHTML = "<p>Fant ikke økta.</p>";
  }
}

// ============================================================================
// Render summary (navn, varighet, distanse …)
// ============================================================================
function renderSummary() {
  if (!SESSION) return;

  const sum = computeSummary(SESSION);
  const when = new Date(SESSION.startedAt);

  const html = `
    <div><strong>${SESSION.name}</strong></div>
    <div class="small">${when.toLocaleString()}</div>

    <ul class="small" style="margin-top:6px; line-height:1.5;">
      <li>Varighet: ${fmtMMSS(sum.dur)}</li>
      <li>Distanse: ${sum.dist.toFixed(2)} km</li>
      <li>Høydemeter: ${sum.elev} m</li>
      <li>Snitt HR: ${sum.avgHR} bpm · Maks: ${sum.maxHR} bpm</li>
      <li>Snitt watt: ${sum.avgW} W</li>
      <li>Drag: ${SESSION.reps}</li>
      <li>TSS: ${sum.tss}</li>
    </ul>
  `;

  UI.setHTML("r-summary", html);
  UI.setValue("r-notes", SESSION.notes ?? "");
}

function computeSummary(s) {
  const pts = s.points ?? [];
  if (!pts.length)
    return { dur: 0, dist: 0, avgHR: 0, avgW: 0, maxHR: 0, elev: 0, tss: 0 };

  const dur = Math.max(
    0,
    (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 1000
  );

  const dist = pts[pts.length - 1].dist_m / 1000;

  let sumHR = 0,
    cntHR = 0,
    sumW = 0,
    cntW = 0,
    maxHR = 0,
    elev = 0,
    tss = 0;

  const LT2 = s.lt2 ?? 160;

  let last = null;
  for (const p of pts) {
    if (p.hr) {
      sumHR += p.hr;
      cntHR++;
      if (p.hr > maxHR) maxHR = p.hr;
    }

    if (p.watt != null) {
      sumW += p.watt;
      cntW++;
    }

    if (last) {
      const dt = (p.ts - last.ts) / 1000;
      const dh = p.speed_ms * (p.grade / 100) * dt;
      if (dh > 0) elev += dh;

      const ifHr = p.hr && LT2 ? p.hr / LT2 : 0;
      tss += (dt / 3600) * ifHr * ifHr * 100;
    }
    last = p;
  }

  return {
    dur,
    dist,
    avgHR: cntHR ? Math.round(sumHR / cntHR) : 0,
    avgW: cntW ? Math.round(sumW / cntW) : 0,
    maxHR,
    elev: Math.round(elev),
    tss: Math.round(tss),
  };
}

// ============================================================================
// LAPS (drag-snitt)
// ============================================================================
function renderLaps() {
  if (!SESSION) return;

  const tb = document.getElementById("r-laps");
  tb.innerHTML = "";

  const laps = splitLaps(SESSION);
  if (!laps.length) {
    tb.innerHTML = "<tr><td>Ingen drag</td></tr>";
    return;
  }

  // header
  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>#</th>
      <th>Varighet</th>
      <th>Distanse (km)</th>
      <th>Snitt HR</th>
      <th>Snitt W</th>
      <th>Snitt fart</th>
      <th>Snitt RPE</th>
    </tr>
  `;
  tb.appendChild(thead);

  const tbody = document.createElement("tbody");
  laps.forEach((l, idx) => {
    const tr = document.createElement("tr");

    const dur = (l.endTs - l.startTs) / 1000;
    const dist = Math.max(0, (l.distEnd - l.distStart) / 1000);

    const cells = [
      idx + 1,
      fmtMMSS(dur),
      dist.toFixed(2),
      l.hrCnt ? Math.round(l.hrSum / l.hrCnt) : "–",
      Math.round(avg(l.pts.map(p => p.watt ?? 0))) || "–",
      avg(l.pts.map(p => p.speed_ms * 3.6)).toFixed(1),
      l.rpeCnt ? (l.rpeSum / l.rpeCnt).toFixed(1) : "–",
    ];

    cells.forEach(c => {
      const td = document.createElement("td");
      td.style.padding = "4px 6px";
      td.textContent = c;
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  tb.appendChild(tbody);
}

function splitLaps(s) {
  const pts = s.points ?? [];
  if (!pts.length) return [];

  const laps = [];
  let cur = {
    pts: [],
    startTs: pts[0].ts,
    distStart: pts[0].dist_m,
    hrSum: 0,
    hrCnt: 0,
    rpeSum: 0,
    rpeCnt: 0,
  };

  let lastPhase = pts[0].phase;
  let lastRep = pts[0].rep ?? 0;

  for (const p of pts) {
    const phase = p.phase;
    const rep = p.rep ?? 0;

    const boundary =
      (phase === "work" && rep !== lastRep) ||
      (phase !== "work" && lastPhase === "work");

    if (boundary && cur.pts.length) {
      const last = cur.pts[cur.pts.length - 1];
      cur.endTs = last.ts;
      cur.distEnd = last.dist_m;
      laps.push(cur);

      cur = {
        pts: [],
        startTs: p.ts,
        distStart: p.dist_m,
        hrSum: 0,
        hrCnt: 0,
        rpeSum: 0,
        rpeCnt: 0,
      };
    }

    cur.pts.push(p);

    if (p.hr) {
      cur.hrSum += p.hr;
      cur.hrCnt++;
    }

    if (typeof p.rpe === "number") {
      cur.rpeSum += p.rpe;
      cur.rpeCnt++;
    }

    lastPhase = phase;
    lastRep = rep;
  }

  if (cur.pts.length) {
    const last = cur.pts[cur.pts.length - 1];
    cur.endTs = last.ts;
    cur.distEnd = last.dist_m;
    laps.push(cur);
  }

  // return only laps containing work
  const work = laps.filter(l => l.pts.some(p => p.phase === "work"));
  return work.length ? work : ["No work laps"];
}

// ============================================================================
// ZONES (LT1/LT2)
// ============================================================================
function renderZones() {
  const canvas = document.getElementById("r-zones");
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const pts = SESSION?.points ?? [];
  if (!pts.length) return;

  const LT1 = SESSION.lt1 ?? 135;
  const LT2 = SESSION.lt2 ?? 160;

  let t1 = 0,
    t2 = 0,
    t3 = 0;

  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const dt = (b.ts - a.ts) / 1000;

    if (a.hr < LT1) t1 += dt;
    else if (a.hr < LT2) t2 += dt;
    else t3 += dt;
  }

  const total = t1 + t2 + t3;
  if (total <= 0) return;

  // draw bars
  const w = canvas.width;
  const h = canvas.height;
  const pad = 20;
  const bw = (w - pad * 4) / 3;

  const bars = [
    { label: "Under LT1", v: t1, c: "rgba(22,163,74,0.65)" },
    { label: "LT1–LT2", v: t2, c: "rgba(217,119,6,0.65)" },
    { label: "Over LT2", v: t3, c: "rgba(220,38,38,0.65)" },
  ];

  ctx.font = "12px system-ui";

  bars.forEach((b, i) => {
    const x = pad + i * (bw + pad);
    const ratio = b.v / total;
    const bh = Math.round((h - 2 * pad) * ratio);
    const y = h - pad - bh;

    ctx.fillStyle = b.c;
    ctx.fillRect(x, y, bw, bh);

    ctx.fillStyle = "black";
    ctx.fillText(`${Math.round(b.v / 60)} min`, x + 4, y - 6);
    ctx.fillText(b.label, x + 4, h - 6);
  });
}

// ============================================================================
// GRAPH (full)
// ============================================================================
function initGraph() {
  canvas = document.getElementById("r-chart");
  ctx = Graph.initCanvas(canvas);

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
}

function resizeCanvas() {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * window.devicePixelRatio);
  canvas.height = Math.floor(rect.height * window.devicePixelRatio);
}

function renderGraph() {
  if (!SESSION || !ctx || !canvas) return;

  const pts = SESSION.points ?? [];

  Graph.drawResult(ctx, pts, {
    width: canvas.width,
    height: canvas.height,
    showHR: document.getElementById("r-show-hr").checked,
    showWatt: document.getElementById("r-show-watt").checked,
    showSpeed: document.getElementById("r-show-speed").checked,
    showRPE: document.getElementById("r-show-rpe").checked,
    LT1: SESSION.lt1 ?? 135,
    LT2: SESSION.lt2 ?? 160,
  });
}

// ============================================================================
// TCX EXPORT
// ============================================================================
function downloadTCX() {
  if (!SESSION) return alert("Ingen økt.");

  const xml = toTCX(SESSION);
  const blob = new Blob([xml], {
    type: "application/vnd.garmin.tcx+xml",
  });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = (SESSION.name || "okt") + ".tcx";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function toTCX(s) {
  const pts = s.points ?? [];
  if (!pts.length) return "";

  const t0 = new Date(pts[0].ts).toISOString();

  function trackpoint(p) {
    return `
      <Trackpoint>
        <Time>${new Date(p.ts).toISOString()}</Time>
        <DistanceMeters>${p.dist_m.toFixed(2)}</DistanceMeters>
        <HeartRateBpm><Value>${p.hr}</Value></HeartRateBpm>
        <Extensions>
          <TPX>
            <Speed>${p.speed_ms.toFixed(3)}</Speed>
            <Watts>${Math.round(p.watt ?? 0)}</Watts>
          </TPX>
        </Extensions>
      </Trackpoint>
    `;
  }

  const chunks = [];
  let lapStart = pts[0];

  for (let i = 1; i < pts.length; i++) {
    if (pts[i].phase !== pts[i - 1].phase || pts[i].rep !== pts[i - 1].rep) {
      chunks.push({ start: lapStart, end: pts[i - 1] });
      lapStart = pts[i];
    }
  }
  chunks.push({ start: lapStart, end: pts[pts.length - 1] });

  const lapsXml = chunks
    .map(ch => {
      const lapPts = pts.filter(p => p.ts >= ch.start.ts && p.ts <= ch.end.ts);
      const dist = lapPts[lapPts.length - 1].dist_m;
      const durSec = (ch.end.ts - ch.start.ts) / 1000;

      return `
        <Lap StartTime="${new Date(ch.start.ts).toISOString()}">
          <TotalTimeSeconds>${durSec}</TotalTimeSeconds>
          <DistanceMeters>${dist.toFixed(2)}</DistanceMeters>
          <Intensity>Active</Intensity>
          <TriggerMethod>Manual</TriggerMethod>
          <Track>
            ${lapPts.map(trackpoint).join("")}
          </Track>
        </Lap>`;
    })
    .join("");

  return `
  <TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
    <Activities>
      <Activity Sport="Running">
        <Id>${t0}</Id>
        ${lapsXml}
        <Notes>${SESSION.notes ?? ""}</Notes>
      </Activity>
    </Activities>
  </TrainingCenterDatabase>`;
}

// ============================================================================
// JSON EXPORT
// ============================================================================
function downloadJSONdump() {
  if (!SESSION) return alert("Ingen økt.");

  const blob = new Blob([JSON.stringify(SESSION, null, 2)], {
    type: "application/json",
  });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = (SESSION.name || "okt") + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ============================================================================
// NOTES SAVE
// ============================================================================
function saveNotes() {
  if (!SESSION) return;

  const sessions = getNS("sessions", []);
  const idx = sessions.findIndex(s => s.id === SESSION.id);
  if (idx >= 0) {
    sessions[idx] = { ...sessions[idx], notes: UI.getValue("r-notes") };
    setNS("sessions", sessions);
    alert("Notater lagret.");
  }
}
