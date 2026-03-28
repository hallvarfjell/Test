/* ============================================================
   INTZ v11 — ui-status.js
   STRICT + FLAT ARCHITECTURE
   Viser sky-status, login, logout, eksplisitt synk.
   ============================================================ */

import { supabase } from "./supabase-init.js";
import { pullAll, explicitSync } from "./sync.js";

/* ------------------------------------------------------------
   UI Elements (nav-pill + profil-meny)
------------------------------------------------------------ */
function ensureUI() {
  const nav = document.querySelector(".topbar .nav");
  if (!nav) return {};

  // Sky-status-pill
  let pill = document.getElementById("sky-pill");
  if (!pill) {
    pill = document.createElement("span");
    pill.id = "sky-pill";
    pill.className = "badge";
    pill.textContent = "Sky: frakoblet";
    pill.style.border = "1px solid #dc2626";
    pill.style.marginLeft = "8px";
    pill.style.cursor = "help";
    nav.appendChild(pill);
  }

  // Profil-knapp
  let btn = document.getElementById("profile-btn");
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "profile-btn";
    btn.className = "secondary";
    btn.textContent = "Profil";
    btn.style.marginLeft = "8px";
    nav.appendChild(btn);
  }

  // Profilmeny
  let menu = document.getElementById("profile-menu");
  if (!menu) {
    menu = document.createElement("div");
    menu.id = "profile-menu";
    menu.className = "menu hidden";
    menu.style.position = "fixed";
    menu.style.top = "72px";
    menu.style.right = "16px";
    menu.style.minWidth = "260px";
    menu.style.zIndex = "60";

    menu.innerHTML = `
      <div style="border-bottom:1px solid #eee;padding:8px;font-weight:600">
        Sky
      </div>

      <div style="padding:8px" id="pm-user">Ikke innlogget</div>

      <button class="secondary" id="pm-login" style="width:100%;margin:4px 0">
        Logg inn
      </button>

      <button class="secondary hidden" id="pm-sync" style="width:100%;margin:4px 0">
        Synk nå
      </button>

      <button class="secondary hidden" id="pm-logout" style="width:100%;margin:4px 0">
        Logg ut
      </button>
    `;

    document.body.appendChild(menu);

    // Klikk utenfor → lukk meny
    document.addEventListener("click", e => {
      if (e.target === btn || btn.contains(e.target)) return;
      if (!menu.contains(e.target)) menu.classList.add("hidden");
    });
  }

  btn.onclick = () => menu.classList.toggle("hidden");

  return {
    pill,
    menu,
    btn,
    pmUser: document.getElementById("pm-user"),
    pmLogin: document.getElementById("pm-login"),
    pmLogout: document.getElementById("pm-logout"),
    pmSync: document.getElementById("pm-sync")
  };
}

const UI = ensureUI();

/* ------------------------------------------------------------
   STATUS & ERROR HANDLING
------------------------------------------------------------ */
function setPill(state, hint) {
  if (!UI.pill) return;

  const map = {
    offline: { text: "Sky: frakoblet", color: "#dc2626" },
    online: { text: "Sky: online", color: "#16a34a" },
    syncing: { text: "Sky: synker…", color: "#2563eb" },
    error: { text: "Sky: feil", color: "#dc2626" }
  };

  const m = map[state] || map.offline;
  UI.pill.textContent = m.text;
  UI.pill.style.border = `1px solid ${m.color}`;

  if (hint) UI.pill.title = hint;
}

function showError(e) {
  console.error("[sync error]", e);
  const msg = (e?.message || JSON.stringify(e)).slice(0, 180);
  setPill("error", msg);
}

/* ------------------------------------------------------------
   LOGIN / LOGOUT / SYNC HANDLERS
------------------------------------------------------------ */
function wireMenu() {
  if (!UI.pmLogin) return;

  UI.pmLogin.onclick = async () => {
    const email = prompt("E‑post (magic link):");
    if (!email) return;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.href
      }
    });
    if (error) alert(error.message);
    else alert("Sjekk e‑post. Logg inn via lenken.");
  };

  UI.pmLogout.onclick = async () => {
    await supabase.auth.signOut();
    reflectAuth(null);
  };

  UI.pmSync.onclick = () => {
    setPill("syncing");
    explicitSync().then(() => setPill("online")).catch(showError);
  };
}

/* ------------------------------------------------------------
   REFLECT AUTH STATE
------------------------------------------------------------ */
function reflectAuth(session) {
  const email = session?.user?.email ?? null;

  UI.pmUser.textContent = email
    ? `Innlogget: ${email}`
    : "Ikke innlogget";

  UI.pmLogin.classList.toggle("hidden", !!email);
  UI.pmLogout.classList.toggle("hidden", !email);
  UI.pmSync.classList.toggle("hidden", !email);

  setPill(email ? "online" : "offline");
}

/* ------------------------------------------------------------
   INITIAL BOOTSTRAP
------------------------------------------------------------ */
async function bootstrapStatus() {
  const { data: { session } } = await supabase.auth.getSession();
  reflectAuth(session);

  if (session) {
    try {
      setPill("syncing");
      await pullAll();
      setPill("online");
    } catch (e) {
      showError(e);
    }
  }

  supabase.auth.onAuthStateChange((_evt, session) => {
    reflectAuth(session);
    if (session) {
      setPill("syncing");
      explicitSync().then(() => setPill("online")).catch(showError);
    }
  });
}

/* ------------------------------------------------------------
   SYNC EVENTS FROM OTHER MODULES
------------------------------------------------------------ */
window.addEventListener("sync:busy", () => setPill("syncing"));
window.addEventListener("sync:idle", () => setPill("online"));
window.addEventListener("sync:error", e => {
  const d = e.detail;
  showError(d?.error ?? d);
});

/* ------------------------------------------------------------
   STARTUP
------------------------------------------------------------ */
wireMenu();
bootstrapStatus();
