/* ============================================================
   INTZ v11 — templates.js
   STRICT + FLAT ARCHITECTURE
   Håndterer: malregister, lokal lagring, sky-sync (pull/push)
   ============================================================ */

import { supabase } from "./supabase-init.js";

/* ------------------------------------------------------------
   STORAGE
------------------------------------------------------------ */
const KEY = "custom_workouts_v11";

export function loadTemplates() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveTemplates(arr) {
  localStorage.setItem(KEY, JSON.stringify(arr));
}

/* ------------------------------------------------------------
   CREATE / UPDATE / DELETE LOCAL
------------------------------------------------------------ */
export function createTemplate(name = "Ny økt") {
  const tpl = {
    name,
    desc: "",
    warmupSec: 0,
    cooldownSec: 0,
    series: []
  };

  const arr = loadTemplates();
  arr.push(tpl);
  saveTemplates(arr);
  return tpl;
}

export function updateTemplate(index, tpl) {
  const arr = loadTemplates();
  if (arr[index]) {
    arr[index] = tpl;
    saveTemplates(arr);
  }
}

export function deleteTemplate(index) {
  const arr = loadTemplates();
  arr.splice(index, 1);
  saveTemplates(arr);
}

/* ------------------------------------------------------------
   SKY-SYNC (UPLIFTED FROM cloud-sync, but simplified)
------------------------------------------------------------ */
async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/* ------------------------------------------------------------
   PULL — sky → lokal
------------------------------------------------------------ */
export async function pullTemplates() {
  const session = await getSession();
  if (!session) return loadTemplates();

  const { data, error } = await supabase
    .from("workout_templates")
    .select("*")
    .order("sort_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("[templates] pull error", error);
    return loadTemplates();
  }

  const arr = (data || []).map(r => ({
    name: r.name ?? "Økt",
    desc: r.description ?? "",
    warmupSec: r.warmup_sec ?? 0,
    cooldownSec: r.cooldown_sec ?? 0,
    series: r.series ?? []
  }));

  saveTemplates(arr);
  return arr;
}

/* ------------------------------------------------------------
   PUSH — lokal → sky (ren UPSERT)
------------------------------------------------------------ */
export async function pushTemplates() {
  const session = await getSession();
  if (!session) return false;

  const user_id = session.user.id;
  const arr = loadTemplates();

  const payload = arr.map((w, i) => ({
    user_id,
    sort_index: i,
    name: w.name ?? "Økt",
    description: w.desc ?? "",
    warmup_sec: w.warmupSec ?? 0,
    cooldown_sec: w.cooldownSec ?? 0,
    series: w.series ?? []
  }));

  const { error } = await supabase
    .from("workout_templates")
    .upsert(payload, { onConflict: "user_id,sort_index" });

  if (error) {
    console.warn("[templates] push error", error);
    return false;
  }

  return true;
}

/* ------------------------------------------------------------
   UTILITY HELPERS FOR THE UI (MODAL BUILDER)
------------------------------------------------------------ */
export function getTemplate(index) {
  const arr = loadTemplates();
  return arr[index] ?? null;
}

export function listTemplateNames() {
  return loadTemplates().map((w, i) => ({
    index: i,
    name: w.name
  }));
}
