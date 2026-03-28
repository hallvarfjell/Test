/* ============================================================
   INTZ v11 — sync.js
   STRICT + FLAT ARCHITECTURE
   Felles synkronisering for maler + økter
   ============================================================ */

import { supabase } from "./supabase-init.js";
import { pullTemplates, pushTemplates } from "./templates.js";
import { pullSessionsFromCloud, uploadSessionToCloud } from "./sessions.js";

/* ------------------------------------------------------------
   UI-INTEGRASJON (status events)
------------------------------------------------------------ */
function setBusy(source) {
  window.dispatchEvent(new CustomEvent("sync:busy", { detail: { source } }));
}

function setIdle(source) {
  window.dispatchEvent(new CustomEvent("sync:idle", { detail: { source } }));
}

function setError(source, error) {
  window.dispatchEvent(
    new CustomEvent("sync:error", { detail: { source, error } })
  );
}

/* ------------------------------------------------------------
   SESSION-HÅNDTERING
------------------------------------------------------------ */
export async function pullAllSessions() {
  try {
    setBusy("sessions");
    const arr = await pullSessionsFromCloud();
    setIdle("sessions");
    return arr;
  } catch (e) {
    setError("sessions", e);
    throw e;
  }
}

export async function pushOneSession(session) {
  try {
    setBusy("sessions");
    await uploadSessionToCloud(session);
    setIdle("sessions");
  } catch (e) {
    setError("sessions", e);
    throw e;
  }
}

/* ------------------------------------------------------------
   TEMPLATE-HÅNDTERING
------------------------------------------------------------ */
export async function pullAllTemplates() {
  try {
    setBusy("templates");
    const arr = await pullTemplates();
    setIdle("templates");
    return arr;
  } catch (e) {
    setError("templates", e);
    throw e;
  }
}

export async function pushAllTemplates() {
  try {
    setBusy("templates");
    await pushTemplates();
    setIdle("templates");
  } catch (e) {
    setError("templates", e);
    throw e;
  }
}

/* ------------------------------------------------------------
   FULL PULL (maler + økter)
------------------------------------------------------------ */
export async function pullAll() {
  try {
    setBusy("sync");
    const tpl = await pullAllTemplates();
    const ses = await pullAllSessions();
    setIdle("sync");
    return { templates: tpl, sessions: ses };
  } catch (e) {
    setError("sync", e);
    throw e;
  }
}

/* ------------------------------------------------------------
   FULL PUSH (kun maler + eventuelle sessions du sender inn)
------------------------------------------------------------ */
export async function pushAll(sessions = []) {
  try {
    setBusy("sync");
    await pushAllTemplates();
    for (const s of sessions) {
      await pushOneSession(s);
    }
    setIdle("sync");
  } catch (e) {
    setError("sync", e);
    throw e;
  }
}

/* ------------------------------------------------------------
   EXPLICIT SYNC (for UI-knapp eller automatiske kall)
------------------------------------------------------------ */
export async function explicitSync() {
  try {
    setBusy("sync");
    await pullAllTemplates();
    await pullAllSessions();
    setIdle("sync");
  } catch (e) {
    setError("sync", e);
  }
}

/* ------------------------------------------------------------
   BOOTSTRAP — kjøres fra ui-status.js og index.html
------------------------------------------------------------ */
export async function bootstrapSync() {
  // Leser session og henter kun hvis innlogget
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  try {
    setBusy("sync");
    await pullAllTemplates();
    await pullAllSessions();
    setIdle("sync");
  } catch (e) {
    setError("sync", e);
  }
}
