/* ============================================================
   INTZ v11 — sessions.js
   STRICT + FLAT ARCHITECTURE
   Lokal lagring + sky-sync + TCX-opplasting
   ============================================================ */

import { supabase } from "./supabase-init.js";
import { sessionToTCX } from "./tcx.js";

/* ============================================================
   LOCAL STORAGE HELPERS
============================================================ */
const KEY = "sessions_v11";

function loadSessions() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function saveSessions(arr) {
  localStorage.setItem(KEY, JSON.stringify(arr));
}

/* ============================================================
   SESSION MODEL
============================================================ */
export function createNewSession(name) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const session = {
    id,
    name: name || "Økt",
    startedAt: now,
    endedAt: now,
    points: [],
    metrics: {
      dist: 0,
      elev: 0,
      tss: 0
    }
  };

  const arr = loadSessions();
  arr.push(session);
  saveSessions(arr);
  return session;
}

/* ------------------------------------------------------------
   UPDATE SESSION LOCALLY
------------------------------------------------------------ */
export function updateSessionMetrics(session, point) {
  if (!session) return;

  session.points.push(point);
  session.endedAt = new Date().toISOString();

  // simple dist/tss (live)
  session.metrics.dist = (session.metrics.dist || 0) + (point.speed_ms || 0) * (point.dt || 1);

  const arr = loadSessions();
  const idx = arr.findIndex(s => s.id === session.id);
  if (idx >= 0) {
    arr[idx] = session;
    saveSessions(arr);
  }
}

/* ============================================================
   SKY-SYNC (ENKEL OG ROBUST)
============================================================ */

/* ------------------------------------------------------------
   UPLOAD ONE SESSION (WORKOUT + TCX)
------------------------------------------------------------ */
export async function uploadSessionToCloud(session) {
  const { data: { session: auth } } = await supabase.auth.getSession();
  if (!auth) throw new Error("Ikke innlogget.");

  const user_id = auth.user.id;
  const tcx = sessionToTCX(session);
  const tcxBlob = new Blob([tcx], { type: "application/vnd.garmin.tcx+xml" });
  const path = `${user_id}/${session.id}.tcx`;

  // 1. Upload TCX
  const up = await supabase.storage.from("sessions").upload(path, tcxBlob, {
    upsert: true
  });
  if (up.error) throw up.error;

  // 2. Insert/update workout row
  const payload = {
    user_id,
    client_id: session.id,
    name: session.name,
    started_at: session.startedAt,
    ended_at: session.endedAt,
    duration_sec: Math.max(1, Math.round(
      (new Date(session.endedAt) - new Date(session.startedAt)) / 1000
    )),
    distance_m: Number(session.points.at(-1)?.dist_m || 0),
    tss: Math.round(session.metrics.tss || 0),
    tcx_path: `sessions/${path}`
  };

  const up2 = await supabase.from("workouts").upsert(payload, {
    onConflict: "user_id,client_id"
  });
  if (up2.error) throw up2.error;

  return true;
}

/* ------------------------------------------------------------
   FINALIZE SESSION (local + cloud)
------------------------------------------------------------ */
export async function finalizeSession(session) {
  if (!session) return;

  try {
    await uploadSessionToCloud(session);
  } catch (e) {
    console.warn("[sessions] sky-lagring feilet:", e);
  }

  // local already updated
  return true;
}

/* ============================================================
   CLOUD → LOCAL (PULL)
============================================================ */
export async function pullSessionsFromCloud() {
  const { data: { session: auth } } = await supabase.auth.getSession();
  if (!auth) return;

  const user_id = auth.user.id;

  const { data, error } = await supabase
    .from("workouts")
    .select("client_id,name,started_at,ended_at,distance_m,tss,tcx_path")
    .eq("user_id", user_id)
    .order("started_at", { ascending: false });

  if (error) throw error;

  const local = loadSessions();
  const byId = new Map(local.map(s => [s.id, s]));

  (data || []).forEach(r => {
    if (!byId.has(r.client_id)) {
      byId.set(r.client_id, {
        id: r.client_id,
        name: r.name || "Økt",
        startedAt: r.started_at,
        endedAt: r.ended_at,
        points: [],
        metrics: {
          dist: r.distance_m ?? 0,
          tss: r.tss ?? 0
        },
        tcx_path: r.tcx_path
      });
    }
  });

  const merged = [...byId.values()];
  saveSessions(merged);

  return merged;
}

/* ============================================================
   DELETE SESSION (LOCAL + CLOUD)
============================================================ */
export async function deleteSession(id) {
  // local
  const arr = loadSessions().filter(s => s.id !== id);
  saveSessions(arr);

  // cloud
  const { data: { session: auth } } = await supabase.auth.getSession();
  if (!auth) return;

  const user_id = auth.user.id;

  try {
    // delete DB row
    await supabase.from("workouts")
      .delete()
      .match({ user_id, client_id: id });

    // delete TCX file
    await supabase.storage.from("sessions")
      .remove([`${user_id}/${id}.tcx`]);
  } catch (e) {
    console.warn("[sessions] sky-slett feilet:", e);
  }

  return true;
}
