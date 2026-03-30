// ============================================================================
// INTZ v11 – views/settings.js
//
// Port av settings.html + script fra INTZ v10 → SPA-modul.
//
// Funksjonalitet:
//   • Brukerprofiler (list, add, rename, delete, switch)
//   • LT1, LT2, kroppsvekt
//   • Powermodell K og C_run
//   • Default graf-valg (HR/Watt/Speed/RPE)
//   • Axis-locks for HR/Watt/Speed/RPE
//   • Full backup/export/import av localStorage
//
// Avhengigheter:
//   core/storage.js, core/ui.js
// ============================================================================

import * as UI from "../core/ui.js";
import {
  getNS,
  setNS,
  listUsers,
  saveUsers,
  setActiveUser,
  activeUser,
  dumpAll,
  loadAll
} from "../core/storage.js";

export function onShow() {
  const root = document.getElementById("view-settings");
  if (!root._intzInit) {
    buildDOM(root);
    bindEvents();
    loadValues();
    root._intzInit = true;
  }
}

// ============================================================================
// BUILD DOM
// ============================================================================
function buildDOM(root) {
  root.innerHTML = `
    <section class="leftcol">

      <!-- USER PROFILES -->
      <div class="card">
        <h3>Brukerprofiler</h3>
        <div id="s-users"></div>
      </div>

      <!-- USER SETTINGS -->
      <div class="card">
        <h3>Brukerinnstillinger</h3>
        <div class="row" style="display:flex;gap:8px;flex-wrap:wrap">
          <label>Kroppsvekt (kg)
            <input id="s-mass" type="number" min="30" max="200" step="0.5">
          </label>

          <label>LT1 (bpm)
            <input id="s-lt1" type="number" min="80" max="220">
          </label>

          <label>LT2 (bpm)
            <input id="s-lt2" type="number" min="80" max="220">
          </label>
        </div>
      </div>

      <!-- POWER MODEL -->
      <div class="card">
        <h3>Powermodell</h3>
        <div class="row" style="display:flex;gap:8px;flex-wrap:wrap">
          <label>Kalibrering K
            <input id="s-cal-k" type="number" step="0.01">
          </label>

          <label>C_run (J/kg/m)
            <input id="s-c-run" type="number" step="0.05">
          </label>
        </div>
        <p class="small">Ytre arbeid: P = m·g·v·grade + C<sub>run</sub>·m·v → deretter ×K.</p>
      </div>

      <!-- GRAPH DEFAULTS -->
      <div class="card">
        <h3>Graf</h3>
        <div class="row" style="display:flex;gap:8px;flex-wrap:wrap">
          <label><input id="s-def-hr" type="checkbox"> Vis HR som standard</label>
          <label><input id="s-def-watt" type="checkbox"> Vis Watt som standard</label>
          <label><input id="s-def-speed" type="checkbox"> Vis Fart som standard</label>
          <label><input id="s-def-rpe" type="checkbox"> Vis RPE som standard</label>
        </div>
      </div>

      <!-- AXIS LOCKS -->
      <div class="card">
        <h3>Skala (Y-akse)</h3>
        <div class="row" style="display:grid;grid-template-columns:repeat(2,minmax(240px,1fr));gap:8px">

          <!-- HR -->
          <label><input id="s-hr-lock" type="checkbox"> Lås HR-skala</label>
          <div style="display:flex;gap:6px;align-items:center">
            <span class="small">HR min/max</span>
            <input id="s-hr-min" type="number" step="1" style="width:90px">
            <input id="s-hr-max" type="number" step="1" style="width:90px">
          </div>

          <!-- Watt -->
          <label><input id="s-w-lock" type="checkbox"> Lås Watt-skala</label>
          <div style="display:flex;gap:6px;align-items:center">
            <span class="small">W min/max</span>
            <input id="s-w-min" type="number" step="1" style="width:90px">
            <input id="s-w-max" type="number" step="1" style="width:90px">
          </div>

          <!-- Speed -->
          <label><input id="s-s-lock" type="checkbox"> Lås Fart-skala</label>
          <div style="display:flex;gap:6px;align-items:center">
            <span class="small">Fart min/max</span>
            <input id="s-s-min" type="number" step="0.1" style="width:90px">
            <input id="s-s-max" type="number" step="0.1" style="width:90px">
          </div>

          <!-- RPE -->
          <label><input id="s-r-lock" type="checkbox"> Lås RPE-skala</label>
          <div style="display:flex;gap:6px;align-items:center">
            <span class="small">RPE min/max</span>
            <input id="s-r-min" type="number" step="0.5" style="width:90px">
            <input id="s-r-max" type="number" step="0.5" style="width:90px">
          </div>

        </div>
      </div>

      <div class="card">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="primary" id="s-save">Lagre innstillinger</button>
        </div>
      </div>

      <!-- BACKUP -->
      <div class="card">
        <h3>Sikkerhetskopi & flytting</h3>
        <p class="small">
          Eksporter <em>alt</em> (brukere, maler, økter, innstillinger) til én JSON-fil,
          eller importer en tidligere sikkerhetskopi. Import <strong>erstatter hele</strong> lokallagringen.
        </p>

        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="secondary" id="bk-export">Eksporter alt</button>
          <button class="secondary" id="bk-import">Importer alt</button>
          <input id="bk-file" type="file" accept="application/json" style="display:none">
        </div>
      </div>

    </section>
  `;
}

// ============================================================================
// BIND EVENTS
// ============================================================================
function bindEvents() {
  // User management
  UI.bindDelegated("#s-users", ".s-user-btn-use", (_, btn) => switchUser(btn.dataset.user));
  UI.bindDelegated("#s-users", ".s-user-btn-rename", (_, btn) => renameUser(btn.dataset.user));
  UI.bindDelegated("#s-users", ".s-user-btn-del", (_, btn) => deleteUser(btn.dataset.user));
  UI.onClick("s-users-add", addUser);

  // Save settings
  UI.onClick("s-save", saveAll);

  // Export / import
  UI.onClick("bk-export", doExport);
  UI.onClick("bk-import", () => document.getElementById("bk-file").click());
  document.getElementById("bk-file").addEventListener("change", doImport);
}

// ============================================================================
// LOAD VALUES INTO UI
// ============================================================================
function loadValues() {
  renderUserList();

  UI.setValue("s-mass", getNS("massKg", 75));
  UI.setValue("s-lt1", getNS("LT1", 135));
  UI.setValue("s-lt2", getNS("LT2", 160));

  UI.setValue("s-cal-k", getNS("calK", 1.0));
  UI.setValue("s-c-run", getNS("cRun", 1.0));

  UI.qs("#s-def-hr").checked    = getNS("defHR", true);
  UI.qs("#s-def-watt").checked  = getNS("defWatt", true);
  UI.qs("#s-def-speed").checked = getNS("defSpeed", false);
  UI.qs("#s-def-rpe").checked   = getNS("defRPE", true);

  UI.qs("#s-hr-lock").checked   = getNS("hrLock", false);
  UI.setValue("s-hr-min", getNS("hrMin", 80));
  UI.setValue("s-hr-max", getNS("hrMax", 200));

  UI.qs("#s-w-lock").checked    = getNS("wLock", false);
  UI.setValue("s-w-min", getNS("wMin", 0));
  UI.setValue("s-w-max", getNS("wMax", 400));

  UI.qs("#s-s-lock").checked    = getNS("sLock", false));
  UI.setValue("s-s-min", getNS("sMin", 0));
  UI.setValue("s-s-max", getNS("sMax", 20));

  UI.qs("#s-r-lock").checked    = getNS("rpeLock", false));
  UI.setValue("s-r-min", getNS("rpeMin", 0));
  UI.setValue("s-r-max", getNS("rpeMax", 10));
}

// ============================================================================
// USER LIST
// ============================================================================

function renderUserList() {
  const wrap = document.getElementById("s-users");
  const users = listUsers();
  const active = activeUser();

  wrap.innerHTML = "";

  const header = document.createElement("div");
  header.className = "small";
  header.innerHTML = `Aktiv bruker: <strong>${active}</strong>`;
  wrap.appendChild(header);

  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gap = "6px";

  users.forEach(u => {
    const row = document.createElement("div");
    row.className = "menu-item";
    row.style.display = "flex";
    row.style.justifyContent = "space-between";

    const left = document.createElement("span");
    left.textContent = u + (u === active ? " (aktiv)" : "");

    const btns = document.createElement("div");
    btns.style.display = "flex";
    btns.style.gap = "6px";

    const use = document.createElement("button");
    use.className = "secondary s-user-btn-use";
    use.dataset.user = u;
    use.textContent = "Bruk";

    const ren = document.createElement("button");
    ren.className = "ghost s-user-btn-rename";
    ren.dataset.user = u;
    ren.textContent = "Gi nytt navn";

    const del = document.createElement("button");
    del.className = "ghost s-user-btn-del";
    del.dataset.user = u;
    del.textContent = "Slett";

    btns.appendChild(use);
    btns.appendChild(ren);
    btns.appendChild(del);

    row.appendChild(left);
    row.appendChild(btns);

    grid.appendChild(row);
  });

  // Add new
  const addBtn = document.createElement("button");
  addBtn.className = "secondary";
  addBtn.id = "s-users-add";
  addBtn.innerHTML = `<i class="ph-user-plus"></i> Legg til bruker`;

  wrap.appendChild(grid);
  wrap.appendChild(addBtn);
}

// ============================================================================
// USER MANAGEMENT
// ============================================================================
function switchUser(u) {
  setActiveUser(u);
  alert(`Aktiv bruker: ${u}\nSiden lastes på nytt.`);
  location.reload();
}

function renameUser(u) {
  const nu = prompt("Nytt navn for bruker", u);
  if (!nu || nu === u) return;

  const arr = listUsers();
  const i = arr.indexOf(u);
  if (i < 0) return;

  if (arr.includes(nu)) {
    alert("Brukernavn finnes allerede.");
    return;
  }

  arr[i] = nu;
  saveUsers(arr);

  // migrate keys
  const oldPrefix = `u:${u}:`;
  const newPrefix = `u:${nu}:`;

  const toMove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith(oldPrefix)) toMove.push(k);
  }

  toMove.forEach(k => {
    const v = localStorage.getItem(k);
    const nk = newPrefix + k.substring(oldPrefix.length);
    localStorage.setItem(nk, v);
    localStorage.removeItem(k);
  });

  if (activeUser() === u) switchUser(nu);
  else renderUserList();
}

function deleteUser(u) {
  if (!confirm(`Slette bruker "${u}"?`)) return;

  const arr = listUsers().filter(x => x !== u);
  saveUsers(arr);

  const prefix = `u:${u}:`;
  const delKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith(prefix)) delKeys.push(k);
  }
  delKeys.forEach(k => localStorage.removeItem(k));

  if (activeUser() === u) switchUser("default");
  else renderUserList();
}

function addUser() {
  const u = prompt("Navn på ny bruker:");
  if (!u) return;

  const arr = listUsers();
  if (arr.includes(u)) {
    alert("Brukeren finnes allerede.");
    return;
  }

  arr.push(u);
  saveUsers(arr);
  switchUser(u);
}

// ============================================================================
// SAVE SETTINGS
// ============================================================================
function saveAll() {
  setNS("massKg", Number(UI.getValue("s-mass")) || 75);
  setNS("LT1", Number(UI.getValue("s-lt1")) || 135);
  setNS("LT2", Number(UI.getValue("s-lt2")) || 160);

  setNS("calK", Number(UI.getValue("s-cal-k")) || 1.0);
  setNS("cRun", Number(UI.getValue("s-c-run")) || 1.0);

  setNS("defHR", UI.qs("#s-def-hr").checked);
  setNS("defWatt", UI.qs("#s-def-watt").checked);
  setNS("defSpeed", UI.qs("#s-def-speed").checked);
  setNS("defRPE", UI.qs("#s-def-rpe").checked);

  setNS("hrLock", UI.qs("#s-hr-lock").checked);
  setNS("hrMin", Number(UI.getValue("s-hr-min")));
  setNS("hrMax", Number(UI.getValue("s-hr-max")));

  setNS("wLock", UI.qs("#s-w-lock").checked);
  setNS("wMin", Number(UI.getValue("s-w-min")));
  setNS("wMax", Number(UI.getValue("s-w-max")));

  setNS("sLock", UI.qs("#s-s-lock").checked);
  setNS("sMin", Number(UI.getValue("s-s-min")));
  setNS("sMax", Number(UI.getValue("s-s-max")));

  setNS("rpeLock", UI.qs("#s-r-lock").checked);
  setNS("rpeMin", Number(UI.getValue("s-r-min")));
  setNS("rpeMax", Number(UI.getValue("s-r-max")));

  alert("Lagret.");
}

// ============================================================================
// EXPORT / IMPORT (backup)
// ============================================================================
function doExport() {
  const dump = dumpAll();

  const ts = new Date();
  const name = `INTZ_backup_${ts.getFullYear()}-${String(
    ts.getMonth() + 1
  ).padStart(2, "0")}-${String(ts.getDate()).padStart(2, "0")}_${
    ts.getHours()
  }${String(ts.getMinutes()).padStart(2, "0")}.json`;

  const blob = new Blob([JSON.stringify(dump, null, 2)], {
    type: "application/json",
  });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function doImport(ev) {
  const f = ev.target.files && ev.target.files[0];
  if (!f) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const obj = JSON.parse(reader.result);
      if (!obj || !obj.localStorage) {
        alert("Ugyldig backupfil.");
        return;
      }

      if (!confirm("Import erstatter hele INTZ-lagringen. Fortsette?"))
        return;

      loadAll(obj.localStorage);
      alert("Import fullført. Siden lastes på nytt.");
      location.reload();
    } catch (e) {
      alert("Import feilet: " + e.message);
    }
  };

  reader.readAsText(f);
}
