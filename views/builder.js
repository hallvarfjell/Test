// ============================================================================
// INTZ v11 – views/builder.js
// Port av INTZ v10 builder.js, tilpasset SPA og core/storage.js
// ============================================================================

import * as UI from "../core/ui.js";
import { getNS, setNS } from "../core/storage.js";

export function onShow() {
  const root = document.getElementById("view-builder");
  if (!root._intzInit) {
    buildDOM(root);
    initLogic();
    root._intzInit = true;
  }
}

// ============================================================================
// UI (samme oppsett som original builder.html, men inline generert)
// ============================================================================

function buildDOM(root) {
  root.innerHTML = `
    <section class="leftcol">

      <div class="card">
        <h3>Øktinformasjon</h3>
        <div class="row" style="display:grid;gap:8px">
          <label>Øktnavn
            <input id="b-name" placeholder="f.eks. Terskel – 4×10 min" type="text">
          </label>

          <label>Beskrivelse (fritekst)
            <textarea id="b-desc" placeholder="Hva er hensikten med økta?" rows="3"></textarea>
          </label>

          <div class="small">Total varighet: <strong id="b-total">0:00</strong></div>
        </div>
      </div>

      <div class="card">
        <h3>Øktinnhold</h3>

        <div class="toolbar" style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="secondary" id="add-warmup"><i class="ph-thermometer-simple"></i> Oppvarming</button>
          <button class="secondary" id="add-series"><i class="ph-rows"></i> Serie</button>
          <button class="secondary" id="add-single"><i class="ph-timer"></i> Enkelt‑drag</button>
          <button class="secondary" id="add-pause"><i class="ph-coffee"></i> Pause</button>
          <button class="secondary" id="add-seriepause"><i class="ph-arrows-in-line-horizontal"></i> Seriepause</button>
          <button class="secondary" id="add-cooldown"><i class="ph-thermometer-cold"></i> Nedjogg</button>

          <button class="secondary" id="gen-fartlek"><i class="ph-wave-sine"></i> Fartlek</button>
          <button class="secondary" id="gen-pyramid"><i class="ph-triangle"></i> Pyramide</button>

          <button class="ghost" id="undo"><i class="ph-arrow-arc-left"></i> Angre</button>
          <button class="ghost" id="redo"><i class="ph-arrow-arc-right"></i> Gjør om</button>
        </div>

        <div id="steps" style="display:grid;gap:8px"></div>

        <p class="small">Fartlek/pyramide genereres som en <em>sammendragsrad</em> med segmenter under. Sammendragsraden har <strong>Vis/Skjul</strong> og <strong>Dupliser</strong>.</p>
      </div>

      <div class="card">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="primary" id="b-save"><i class="ph-floppy-disk"></i> Lagre som ny</button>
          <button class="secondary hidden" id="b-update"><i class="ph-floppy-disk"></i> Oppdater mal</button>
          <button class="ghost" id="b-clear"><i class="ph-trash"></i> Nullstill</button>
        </div>
      </div>

    </section>

    <section class="rightcol">
      <div class="card">
        <h3>Lagrede maler</h3>
        <div id="b-list"></div>
      </div>
    </section>

    <!-- Generator Modal -->
    <div class="modal" id="gen-modal">
      <div class="modalpanel">
        <h3 id="gen-title">Generator</h3>

        <div class="modalgrid">
          <label>Segmenter (sek, kommadelt)
            <textarea id="gen-segments" placeholder="f.eks. 60,90,60,120" rows="5"></textarea>
          </label>

          <div>
            <label>Hurtig: bygg stigende sekvenser
              <input id="gen-asc" placeholder="f.eks. 60,120,180" type="text">
            </label>

            <label><input id="gen-mirror" type="checkbox" checked> Speil stigende side (pyramide)</label>

            <label>Pause mellom segmenter (s)
              <input id="gen-pause" type="number" step="5" min="0" value="0">
            </label>

            <label><input id="gen-group" type="checkbox" checked> Start som sammendragsgruppe</label>
            <label><input id="gen-absorb" type="checkbox"> Slå sammen til Serie (hvis mulig)</label>
          </div>
        </div>

        <div class="small" id="gen-preview">Forhåndsvisning: 0 segmenter, 0:00</div>

        <div class="modalactions">
          <button class="ghost" id="gen-cancel">Avbryt</button>
          <button class="primary" id="gen-apply">Bruk</button>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// LOGIC – hele INTZ v10 builder.js portert
// ============================================================================

let STEPS = [];
let editingIndex = null;

const KEY = "custom_workouts_v2";

// undo/redo
const UNDO = [];
const REDO = [];
const UNDO_LIMIT = 20;

function pushState() {
  UNDO.push(JSON.stringify({
    STEPS,
    editingIndex,
    name: UI.getValue("b-name") ?? "",
    desc: UI.getValue("b-desc") ?? "",
  }));

  if (UNDO.length > UNDO_LIMIT) UNDO.shift();
  REDO.length = 0;
}

function restoreState(str) {
  const s = JSON.parse(str);
  STEPS = s.STEPS;
  editingIndex = s.editingIndex;
  UI.setValue("b-name", s.name);
  UI.setValue("b-desc", s.desc);
  render();
}

function undo() {
  if (!UNDO.length) return;
  const cur = JSON.stringify({
    STEPS,
    editingIndex,
    name: UI.getValue("b-name") ?? "",
    desc: UI.getValue("b-desc") ?? "",
  });
  REDO.push(cur);
  const prev = UNDO.pop();
  restoreState(prev);
}

function redo() {
  if (!REDO.length) return;
  const cur = JSON.stringify({
    STEPS,
    editingIndex,
    name: UI.getValue("b-name") ?? "",
    desc: UI.getValue("b-desc") ?? "",
  });
  UNDO.push(cur);
  const next = REDO.pop();
  restoreState(next);
}

// uuid
const uid = () => "s" + Math.random().toString(36).slice(2, 9);

// duration
const fmt = s => {
  s = Math.max(0, Math.round(s));
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, "0");
  return `${m}:${ss}`;
};

// ============================================================================
// RENDER
// ============================================================================

function render() {
  const wrap = document.getElementById("steps");
  wrap.innerHTML = "";
  STEPS.forEach(step => wrap.appendChild(stepCard(step)));
  refreshTotal();
}

// ============================================================================
// STEP CARD
// ============================================================================

function labelFor(step) {
  return {
    warmup: "Oppvarming",
    cooldown: "Nedjogg",
    single: "Enkelt‑drag",
    series: "Serie",
    pause: "Pause",
    seriespause: "Seriepause",
    group: "Sammendrag",
  }[step.type] ?? step.type;
}

function stepInner(step) {
  const t = step.type;

  if (t === "group") {
    const arr = step.data.secs || [];
    const c = !!step.data.collapsed;
    const label = step.data.title ?? "Gruppe";
    return `
      ${label} – ${arr.length} segmenter
      <button class="act-del">Slett</button>
      <button class="act-dupgrp">Dupliser</button>
      <button class="act-tgl">${c ? "Vis" : "Skjul"}</button>
    `;
  }

  if (t === "warmup" || t === "cooldown") {
    return `
      ${labelFor(step)}
      <input class="f-min" type="number" min="0" step="1" value="${(step.data.sec/60)||0}">
      min
      <button class="act-del">Slett</button>
      <button class="act-dup">Dupliser</button>
    `;
  }

  if (t === "single") {
    return `
      ${labelFor(step)}
      <input class="f-work" type="number" min="0" value="${step.data.workSec}">
      s arbeid
      <input class="f-note" placeholder="(merknad)" value="${step.data.note}">
      <button class="act-del">Slett</button>
      <button class="act-dup">Dupliser</button>
    `;
  }

  if (t === "series") {
    return `
      ${labelFor(step)}
      Reps <input class="f-reps" type="number" min="1" value="${step.data.reps}">
      Work <input class="f-work" type="number" min="0" value="${step.data.workSec}">
      Rest <input class="f-rest" type="number" min="0" value="${step.data.restSec}">
      S.Pause <input class="f-srest" type="number" min="0" value="${step.data.seriesRestSec}">
      <input class="f-note" placeholder="(merknad)" value="${step.data.note}">
      <button class="act-del">Slett</button>
      <button class="act-dup">Dupliser</button>
    `;
  }

  if (t === "pause" || t === "seriespause") {
    return `
      ${labelFor(step)}
      <input class="f-sec" type="number" min="0" value="${step.data.sec}">
      s
      <button class="act-del">Slett</button>
      <button class="act-dup">Dupliser</button>
    `;
  }

  return labelFor(step);
}

function stepCard(step) {
  const card = document.createElement("div");
  card.className = "step";
  card.dataset.id = step.id;
  card.draggable = step.type !== "group";

  card.innerHTML = stepInner(step);
  wireCard(card, step);
  return card;
}

// ============================================================================
// WIRE CARD EVENTS
// ============================================================================

function wireCard(card, step) {
  if (step.type === "group") {
    const tgl = card.querySelector(".act-tgl");
    if (tgl)
      tgl.onclick = () => {
        pushState();
        step.data.collapsed = !step.data.collapsed;
        render();
      };

    const dup = card.querySelector(".act-dupgrp");
    if (dup)
      dup.onclick = () => {
        pushState();
        duplicateGroup(step.id);
      };

    const del = card.querySelector(".act-del");
    if (del)
      del.onclick = () => {
        pushState();
        deleteGroup(step.id);
      };

    return;
  }

  // INPUTS
  card.querySelectorAll("input").forEach(inp => {
    inp.addEventListener("input", () => {
      pushState();

      if (step.type === "warmup" || step.type === "cooldown") {
        step.data.sec = Number(card.querySelector(".f-min").value || 0) * 60;
      }

      if (step.type === "single") {
        step.data.workSec = Number(card.querySelector(".f-work").value || 0);
        step.data.note = card.querySelector(".f-note").value || "";
      }

      if (step.type === "series") {
        step.data.reps = Number(card.querySelector(".f-reps").value || 0);
        step.data.workSec = Number(card.querySelector(".f-work").value || 0);
        step.data.restSec = Number(card.querySelector(".f-rest").value || 0);
        step.data.seriesRestSec = Number(card.querySelector(".f-srest").value || 0);
        step.data.note = card.querySelector(".f-note").value || "";
      }

      if (step.type === "pause" || step.type === "seriespause") {
        step.data.sec = Number(card.querySelector(".f-sec").value || 0);
      }

      refreshTotal();
    });
  });

  // DUP
  const dup = card.querySelector(".act-dup");
  if (dup) dup.onclick = () => {
    pushState();
    const clone = JSON.parse(JSON.stringify(step));
    clone.id = uid();
    insertAfter(step.id, clone);
    refreshTotal();
  };

  // DEL
  const del = card.querySelector(".act-del");
  if (del) del.onclick = () => {
    pushState();
    removeStep(step.id);
    refreshTotal();
  };

  // DRAG
  card.addEventListener("dragstart", ev => {
    ev.dataTransfer.setData("text/plain", step.id);
    card.classList.add("dragging");
  });
  card.addEventListener("dragend", () => card.classList.remove("dragging"));
  card.addEventListener("dragover", ev => ev.preventDefault());

  card.addEventListener("drop", ev => {
    ev.preventDefault();
    const srcId = ev.dataTransfer.getData("text/plain");
    if (!srcId || srcId === step.id) return;
    pushState();
    reorder(srcId, step.id);
    refreshTotal();
  });
}

// ============================================================================
// STEP MANIPULATION
// ============================================================================

function indexOf(id) {
  return STEPS.findIndex(x => x.id === id);
}

function insertAfter(targetId, newStep) {
  const i = indexOf(targetId);
  if (i >= 0) {
    STEPS.splice(i + 1, 0, newStep);
    render();
  }
}

function removeStep(id) {
  const i = indexOf(id);
  if (i >= 0) {
    const st = STEPS[i];
    if (st.type === "group") {
      deleteGroup(id);
      return;
    }
    STEPS.splice(i, 1);
    render();
  }
}

// group delete
function deleteGroup(groupId) {
  const i = indexOf(groupId);
  if (i < 0) return;

  STEPS.splice(i, 1);

  // remove children
  let j = i;
  while (j < STEPS.length && STEPS[j].data?._groupId === groupId) {
    STEPS.splice(j, 1);
  }

  render();
}

// duplicate group
function duplicateGroup(groupId) {
  const i = indexOf(groupId);
  if (i < 0) return;

  const g = STEPS[i];
  const newId = uid();

  // group itself
  const clone = JSON.parse(JSON.stringify(g));
  clone.id = newId;
  STEPS.splice(i + 1, 0, clone);

  // children
  let j = i + 1;
  while (j < STEPS.length && STEPS[j].data?._groupId === groupId) {
    const k = STEPS[j];
    const nk = JSON.parse(JSON.stringify(k));
    nk.id = uid();
    nk.data._groupId = newId;
    STEPS.splice(j + 1, 0, nk);
    j++;
  }

  render();
}

// reorder via drag+drop
function reorder(srcId, dstId) {
  const si = indexOf(srcId);
  const di = indexOf(dstId);
  if (si < 0 || di < 0 || si === di) return;

  const src = STEPS[si];
  // disallow group dragging as chunk – keep original behavior
  if (src.type === "group") return;

  STEPS.splice(si, 1);
  const di2 = indexOf(dstId);
  STEPS.splice(di2, 0, src);

  render();
}

// ============================================================================
// ADD STEPS
// ============================================================================

function addWarmup() {
  pushState();
  STEPS.push({
    id: uid(),
    type: "warmup",
    data: { sec: 300 },
  });
  render();
}

function addCooldown() {
  pushState();
  STEPS.push({
    id: uid(),
    type: "cooldown",
    data: { sec: 300 },
  });
  render();
}

function addSingle() {
  pushState();
  STEPS.push({
    id: uid(),
    type: "single",
    data: { workSec: 60, note: "" },
  });
  render();
}

function addSeries() {
  pushState();
  STEPS.push({
    id: uid(),
    type: "series",
    data: { reps: 4, workSec: 60, restSec: 30, seriesRestSec: 0, note: "" },
  });
  render();
}

function addPause() {
  pushState();
  STEPS.push({
    id: uid(),
    type: "pause",
    data: { sec: 60 },
  });
  render();
}

function addSeriesPause() {
  pushState();
  STEPS.push({
    id: uid(),
    type: "seriespause",
    data: { sec: 120 },
  });
  render();
}

// ============================================================================
// GENERATOR (fartlek/pyramide)
// ============================================================================

let GEN_MODE = "fartlek";

function openGen(mode) {
  GEN_MODE = mode;
  document.getElementById("gen-title").textContent =
    mode === "pyramid" ? "Pyramide" : "Fartlek";

  document.getElementById("gen-segments").value = "";
  document.getElementById("gen-asc").value = "";

  updatePreview();
  document.getElementById("gen-modal").classList.add("open");
}

function closeGen() {
  document.getElementById("gen-modal").classList.remove("open");
}

function parseCSV(str) {
  return (str || "")
    .split(",")
    .map(x => Number(x.trim()))
    .filter(x => x > 0);
}

function buildSegments() {
  const segStr = document.getElementById("gen-segments").value;
  const ascStr = document.getElementById("gen-asc").value;
  const mirror = document.getElementById("gen-mirror").checked;

  const seg = parseCSV(segStr);
  const asc = parseCSV(ascStr);

  let base = [];

  if (asc.length) {
    base = asc.slice();
    if (mirror) base = base.concat(asc.slice(0, -1).reverse());
  }

  if (seg.length) {
    base = base.concat(seg);
  }

  return base;
}

function updatePreview() {
  const arr = buildSegments();
  const pause = Number(document.getElementById("gen-pause").value || 0);
  let total = 0;

  if (arr.length) {
    total += arr.reduce((a, b) => a + b, 0);
    if (pause > 0) total += pause * (arr.length - 1);
  }

  document.getElementById("gen-preview").textContent =
    `Forhåndsvisning: ${arr.length} segmenter, ${fmt(total)}`;
}

function applyGenerator() {
  const arr = buildSegments();
  const pause = Number(document.getElementById("gen-pause").value || 0);
  const makeGroup = document.getElementById("gen-group").checked;
  const absorb = document.getElementById("gen-absorb").checked;

  if (!arr.length) {
    alert("Ingen segmenter.");
    return;
  }

  pushState();

  const allEq = arr.every(x => x === arr[0]);

  if (absorb && allEq) {
    // Lag til Serie
    STEPS.push({
      id: uid(),
      type: "series",
      data: {
        reps: arr.length,
        workSec: arr[0],
        restSec: pause > 0 ? pause : 0,
        seriesRestSec: 0,
        note: "",
      },
    });
    render();
    return;
  }

  let gid = null;

  if (makeGroup) {
    gid = uid();
    const title = GEN_MODE === "pyramid" ? "Pyramide" : "Fartlek";

    STEPS.push({
      id: gid,
      type: "group",
      data: { title, secs: [...arr], collapsed: true },
    });
  }

  arr.forEach((s, i) => {
    STEPS.push({
      id: uid(),
      type: "single",
      data: { workSec: s, note: "", _groupId: gid || undefined },
    });

    if (pause > 0 && i < arr.length - 1) {
      STEPS.push({
        id: uid(),
        type: "pause",
        data: { sec: pause, _groupId: gid || undefined },
      });
    }
  });

  render();
}

// ============================================================================
// SAVE / LOAD
// ============================================================================

function compileToV2() {
  let warm = 0;
  let cool = 0;
  const series = [];

  for (const s of STEPS) {
    if (s.type === "warmup") warm += s.data.sec;
    else if (s.type === "cooldown") cool += s.data.sec;

    else if (s.type === "single") {
      series.push({
        reps: 1,
        workSec: s.data.workSec,
        restSec: 0,
        seriesRestSec: 0,
        note: s.data.note,
      });
    }

    else if (s.type === "series") {
      series.push({
        reps: s.data.reps,
        workSec: s.data.workSec,
        restSec: s.data.restSec,
        seriesRestSec: s.data.seriesRestSec,
        note: s.data.note,
      });
    }

    else if (s.type === "pause" || s.type === "seriespause") {
      const sec = s.data.sec;
      series.push({
        reps: 1,
        workSec: 0,
        restSec: sec,
        seriesRestSec: 0,
        note: "",
      });
    }
  }

  return {
    warmupSec: warm,
    cooldownSec: cool,
    series,
  };
}

function totalDurationSec() {
  const cfg = compileToV2();
  const s = cfg.series ?? [];

  let total = cfg.warmupSec + cfg.cooldownSec;
  for (const x of s) {
    total += x.reps * (x.workSec + x.restSec);
    total += x.seriesRestSec;
  }
  return total;
}

function refreshTotal() {
  UI.setText("b-total", fmt(totalDurationSec()));
}

function getAll() {
  return getNS(KEY, []);
}

function setAll(arr) {
  setNS(KEY, arr);
}

function renderList() {
  const listEl = document.getElementById("b-list");
  const arr = getAll();

  if (!arr.length) {
    listEl.innerHTML = `<div class="small">Ingen lagrede maler ennå.</div>`;
    return;
  }

  listEl.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.style.display = "grid";
  wrap.style.gap = "8px";

  arr.forEach((w, i) => {
    const row = document.createElement("div");
    row.className = "rowline";
    row.dataset.index = i;
    row.draggable = true;

    const left = document.createElement("div");
    left.className = "row-left";

    const handle = document.createElement("span");
    handle.className = "row-handle";
    handle.textContent = "⋮⋮";

    const nameBtn = document.createElement("button");
    nameBtn.className = "row-name";
    nameBtn.textContent = w.name || "Uten navn";
    nameBtn.title = w.name;
    nameBtn.onclick = () => loadExisting(i);

    const desc = document.createElement("div");
    desc.className = "row-desc";
    desc.textContent = w.desc || "";

    const dur = document.createElement("span");
    dur.className = "row-dur";
    dur.textContent = fmt(duration(w));

    left.appendChild(handle);
    left.appendChild(nameBtn);
    left.appendChild(desc);
    left.appendChild(dur);

    const btns = document.createElement("div");
    btns.className = "row-btns";

    const play = document.createElement("button");
    play.className = "secondary";
    play.innerHTML = `<i class="ph-play"></i>`;
    play.title = "Bruk økt (forvalg)";
    play.onclick = () => autorun(i);

    const del = document.createElement("button");
    del.className = "ghost";
    del.innerHTML = `<i class="ph-trash"></i>`;
    del.onclick = () => {
      if (confirm("Slette denne malen?")) {
        const a = getAll();
        a.splice(i, 1);
        setAll(a);
        renderList();
      }
    };

    btns.appendChild(play);
    btns.appendChild(del);

    row.appendChild(left);
    row.appendChild(btns);

    // Drag reorder
    row.addEventListener("dragstart", ev => {
      ev.dataTransfer.setData("text/plain", i.toString());
      row.classList.add("dragging");
    });
    row.addEventListener("dragend", () => row.classList.remove("dragging"));
    row.addEventListener("dragover", ev => ev.preventDefault());
    row.addEventListener("drop", ev => {
      ev.preventDefault();
      const si = Number(ev.dataTransfer.getData("text/plain"));
      const di = i;

      if (isNaN(si) || isNaN(di) || si === di) return;

      const a = getAll();
      const [it] = a.splice(si, 1);
      a.splice(di, 0, it);
      setAll(a);
      renderList();
    });

    wrap.appendChild(row);
  });

  listEl.appendChild(wrap);
}

function duration(w) {
  const s = w.series ?? [];
  let total = safe(w.warmupSec) + safe(w.cooldownSec);
  for (const x of s) {
    total += safe(x.reps) * (safe(x.workSec) + safe(x.restSec));
    total += safe(x.seriesRestSec);
  }
  return total;
}

function safe(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// load existing
function loadExisting(i) {
  pushState();

  editingIndex = i;

  const arr = getAll();
  const w = arr[i];

  UI.setValue("b-name", w.name || "");
  UI.setValue("b-desc", w.desc || "");

  STEPS = [];

  const cfg = w;
  if (cfg.warmupSec > 0) {
    STEPS.push({
      id: uid(),
      type: "warmup",
      data: { sec: cfg.warmupSec },
    });
  }

  (cfg.series || []).forEach(s => {
    if (s.reps === 1 && s.workSec > 0 && s.restSec === 0 && s.seriesRestSec === 0) {
      STEPS.push({
        id: uid(),
        type: "single",
        data: { workSec: s.workSec, note: s.note || "" },
      });
    } else if (s.reps === 1 && s.workSec === 0 && s.restSec > 0) {
      STEPS.push({
        id: uid(),
        type: "pause",
        data: { sec: s.restSec },
      });
    } else {
      STEPS.push({
        id: uid(),
        type: "series",
        data: {
          reps: s.reps,
          workSec: s.workSec,
          restSec: s.restSec,
          seriesRestSec: s.seriesRestSec,
          note: s.note || "",
        },
      });
    }
  });

  if (cfg.cooldownSec > 0) {
    STEPS.push({
      id: uid(),
      type: "cooldown",
      data: { sec: cfg.cooldownSec },
    });
  }

  document.getElementById("b-update").classList.remove("hidden");
  document.getElementById("b-save").classList.add("hidden");

  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function autorun(i) {
  // preselect → dashboard
  setNS("preselect", { type: "custom", index: i });
  alert("Økta er forvalgt. Gå til Hovedside for å starte.");
}

// ============================================================================
// INIT LOGIC & EVENT BINDING
// ============================================================================

function initLogic() {
  UI.onClick("add-warmup", addWarmup);
  UI.onClick("add-series", addSeries);
  UI.onClick("add-single", addSingle);
  UI.onClick("add-pause", addPause);
  UI.onClick("add-seriepause", addSeriesPause);
  UI.onClick("add-cooldown", addCooldown);

  UI.onClick("gen-fartlek", () => openGen("fartlek"));
  UI.onClick("gen-pyramid", () => openGen("pyramid"));

  document.getElementById("gen-segments").addEventListener("input", updatePreview);
  document.getElementById("gen-asc").addEventListener("input", updatePreview);
  document.getElementById("gen-mirror").addEventListener("change", updatePreview);
  document.getElementById("gen-pause").addEventListener("change", updatePreview);

  UI.onClick("gen-cancel", closeGen);
  UI.onClick("gen-apply", applyGenerator);

  // save new
  UI.onClick("b-save", () => {
    const arr = getAll();
    const compiled = compileToV2();
    const obj = {
      name: UI.getValue("b-name") || "Økt",
      desc: UI.getValue("b-desc") || "",
      warmupSec: compiled.warmupSec,
      cooldownSec: compiled.cooldownSec,
      series: compiled.series,
    };
    arr.push(obj);
    setAll(arr);
    alert("Lagret ny mal.");
    renderList();
  });

  // update existing
  UI.onClick("b-update", () => {
    if (editingIndex == null) {
      alert("Ingen mal valgt for oppdatering.");
      return;
    }
    const arr = getAll();
    const compiled = compileToV2();
    arr[editingIndex] = {
      ...arr[editingIndex],
      name: UI.getValue("b-name") || arr[editingIndex].name,
      desc: UI.getValue("b-desc") || arr[editingIndex].desc,
      warmupSec: compiled.warmupSec,
      cooldownSec: compiled.cooldownSec,
      series: compiled.series,
    };
    setAll(arr);
    alert("Oppdatert.");
    renderList();
  });

  // clear
  UI.onClick("b-clear", () => {
    pushState();
    editingIndex = null;
    document.getElementById("b-update").classList.add("hidden");
    document.getElementById("b-save").classList.remove("hidden");
    UI.setValue("b-name", "");
    UI.setValue("b-desc", "");
    STEPS = [];
    render();
  });

  // undo/redo
  UI.onClick("undo", undo);
  UI.onClick("redo", redo);

  render();
  renderList();
}
