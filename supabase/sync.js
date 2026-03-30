// ============================================================================
// INTZ v11 – supabase/sync.js
//
// Cloud sync for INTZ sessions, workouts and settings.
// - NO automatic sync; manual operations only
// - Safe offline behaviour
// - Uses per-user namespace based on activeUser()
//
// Requires:
//   supabase/client.js   (must export 'supa' and ensureSupabase())
//   core/storage.js      (getNS, setNS, activeUser)
//
// ============================================================================

import { supa, ensureSupabase } from "./client.js";
import { getNS, setNS, activeUser } from "../core/storage.js";

// ============================================================================
// TABLE NAMES (you may rename these to your liking)
// ============================================================================
//
// Suggested Supabase schema:
//
//   TABLE intz_sessions
//     id            text primary key
//     user_id       text  (your username/active_user)
//     payload       jsonb
//     updated_at    timestamptz default now()
//
//   TABLE intz_workouts
//     id            uuid primary key default gen_random_uuid()
//     user_id       text
//     name          text
//     payload       jsonb
//     updated_at    timestamptz
//
//   TABLE intz_settings
//     user_id       text primary key
//     payload       jsonb
//     updated_at    timestamptz
//
// ---------------------------------------------------------------------------

const TABLE_SESSIONS = "intz_sessions";
const TABLE_WORKOUTS = "intz_workouts";
const TABLE_SETTINGS = "intz_settings";

// ============================================================================
// HELPERS
// ============================================================================

function check() {
  if (!supa) {
    console.warn("Supabase not configured. Fill in URL and anon key in supabase/client.js.");
    return false;
  }
  return true;
}

function uid() {
  return "s" + Math.random().toString(36).slice(2);
}

// ============================================================================
// SESSIONS
// ============================================================================

// Upload all sessions from localStorage to cloud
export async function uploadSessions() {
  if (!check()) return;

  const user = activeUser();
  const sessions = getNS("sessions", []);

  const rows = sessions.map(s => ({
    id: s.id || uid(),
    user_id: user,
    payload: s,
  }));

  const { error } = await supa
    .from(TABLE_SESSIONS)
    .upsert(rows, { onConflict: "id" });

  if (error) console.error("uploadSessions error:", error);
  else console.log("uploadSessions OK");
}

// Download all cloud sessions to localStorage (overwrite local)
export async function downloadSessions() {
  if (!check()) return;

  const user = activeUser();

  const { data, error } = await supa
    .from(TABLE_SESSIONS)
    .select("payload")
    .eq("user_id", user);

  if (error) {
    console.error("downloadSessions error:", error);
    return;
  }

  const arr = data.map(r => r.payload);
  setNS("sessions", arr);
  console.log("downloadSessions OK");
}

// ============================================================================
// WORKOUTS (Øktmaler)
// ============================================================================

export async function uploadWorkouts() {
  if (!check()) return;

  const user = activeUser();
  const workouts = getNS("custom_workouts_v2", []);

  const rows = workouts.map(w => ({
    user_id: user,
    name: w.name || "Økt",
    payload: w,
  }));

  const { error } = await supa
    .from(TABLE_WORKOUTS)
    .upsert(rows, { onConflict: "name,user_id" });

  if (error) console.error("uploadWorkouts error:", error);
  else console.log("uploadWorkouts OK");
}

export async function downloadWorkouts() {
  if (!check()) return;

  const user = activeUser();

  const { data, error } = await supa
    .from(TABLE_WORKOUTS)
    .select("payload")
    .eq("user_id", user);

  if (error) {
    console.error("downloadWorkouts error:", error);
    return;
  }

  const arr = data.map(r => r.payload);
  setNS("custom_workouts_v2", arr);
  console.log("downloadWorkouts OK");
}

// ============================================================================
// SETTINGS
// ============================================================================
//
// Cloud version stores *all* user settings in one payload.
// Local settings stored in localStorage (namespaced).
//
// ============================================================================

export async function uploadSettings() {
  if (!check()) return;

  const user = activeUser();

  // Extract user-specific keys from localStorage
  const prefix = `u:${user}:`;
  const all = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith(prefix)) {
      all[k] = localStorage.getItem(k);
    }
  }

  const { error } = await supa
    .from(TABLE_SETTINGS)
    .upsert(
      [{ user_id: user, payload: all }],
      { onConflict: "user_id" }
    );

  if (error) console.error("uploadSettings error:", error);
  else console.log("uploadSettings OK");
}

export async function downloadSettings() {
  if (!check()) return;

  const user = activeUser();

  const { data, error } = await supa
    .from(TABLE_SETTINGS)
    .select("payload")
    .eq("user_id", user)
    .single();

  if (error) {
    console.error("downloadSettings error:", error);
    return;
  }

  // Overwrite local settings
  const payload = data?.payload || {};
  for (const k of Object.keys(payload)) {
    localStorage.setItem(k, payload[k]);
  }

  console.log("downloadSettings OK");
}

// ============================================================================
// BUNDLE: FULL CLOUD SYNC
// ============================================================================

export async function syncAllToCloud() {
  if (!check()) return;

  console.log("INTZ v11: Sync → Cloud");

  await uploadSessions();
  await uploadWorkouts();
  await uploadSettings();

  console.log("INTZ v11: Sync → Cloud complete");
}

export async function syncAllFromCloud() {
  if (!check()) return;

  console.log("INTZ v11: Sync ← Cloud");

  await downloadSessions();
  await downloadWorkouts();
  await downloadSettings();

  console.log("INTZ v11: Sync ← Cloud complete");
}

// ============================================================================
// OPTIONAL: REALTIME CHANNELS (ghosting i sanntid, UI triggers osv.)
// Bare skjelett — du kan aktivere når ønskelig
// ============================================================================

export function enableRealtime() {
  if (!check()) return;

  // Example channel (you can customize)
  const channel = supa.channel(`intz-${activeUser()}`);

  channel.on(
    "postgres_changes",
    { event: "*", schema: "public", table: TABLE_SESSIONS },
    payload => {
      console.log("Realtime session change:", payload);
    }
  );

  channel.subscribe(status => {
    console.log("Realtime status:", status);
  });
}
