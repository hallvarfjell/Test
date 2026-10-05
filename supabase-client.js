// supabase-client.js
// INTZ v10.1 – Supabase Auth og synkroniserings-API

import {
  createClient
} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// Behold prosjektverdiene for ditt Supabase-prosjekt.
const SUPABASE_URL =
  "https://mmlxbgdzbuijnlfedyqu.supabase.co";

const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tbHhiZ2R6YnVpam5sZmVkeXF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMTY4MzAsImV4cCI6MjA4ODc5MjgzMH0.zZDw-rWrA49U-4HFGEhjjzLJXb-z1X56wzv90ds9-Kg";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

async function getAuthUser() {
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return user || null;
}

async function requireAuthUser() {
  const user = await getAuthUser();

  if (!user) {
    throw new Error(
      "Du må logge inn med e-post under Innstillinger før synkronisering."
    );
  }

  return user;
}

async function sendMagicLink(email) {
  const cleanEmail = String(email || "").trim();

  if (!cleanEmail) {
    throw new Error(
      "Skriv inn en gyldig e-postadresse."
    );
  }

  const redirectTo =
    location.origin +
    location.pathname +
    "#settings";

  const { error } =
    await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        emailRedirectTo: redirectTo
      }
    });

  if (error) {
    throw error;
  }

  return true;
}

async function signOut() {
  const { error } =
    await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

function createWorkoutRow(userId, workout) {
  return {
    user_id: userId,
    local_id: workout._local_id,
    name: workout.name || "Økt",
    description: workout.desc || "",
    payload: workout,
    schema_version:
      Number(workout._schema_version || 1),
    client_updated_at:
      workout._updated_at,
    deleted_at:
      workout._deleted_at || null
  };
}

function createSessionRow(userId, session) {
  return {
    user_id: userId,
    local_id: session._local_id,
    name: session.name || "Økt",
    started_at:
      session.startedAt || null,
    ended_at:
      session.endedAt || null,
    payload: session,
    schema_version:
      Number(session._schema_version || 1),
    client_updated_at:
      session._updated_at,
    deleted_at:
      session._deleted_at || null
  };
}

async function upsertWorkouts(workouts) {
  if (!Array.isArray(workouts)) {
    throw new Error(
      "Maler må sendes som en liste."
    );
  }

  if (workouts.length === 0) {
    return [];
  }

  const user = await requireAuthUser();

  const rows = workouts.map(workout =>
    createWorkoutRow(user.id, workout)
  );

  const { data, error } = await supabase
    .from("intz_workouts")
    .upsert(rows, {
      onConflict: "user_id,local_id"
    })
    .select(
      "id, local_id, client_updated_at, deleted_at"
    );

  if (error) {
    throw error;
  }

  return data || [];
}

async function upsertSessions(sessions) {
  if (!Array.isArray(sessions)) {
    throw new Error(
      "Økter må sendes som en liste."
    );
  }

  if (sessions.length === 0) {
    return [];
  }

  const user = await requireAuthUser();

  const rows = sessions.map(session =>
    createSessionRow(user.id, session)
  );

  const { data, error } = await supabase
    .from("intz_sessions")
    .upsert(rows, {
      onConflict: "user_id,local_id"
    })
    .select(
      "id, local_id, client_updated_at, deleted_at"
    );

  if (error) {
    throw error;
  }

  return data || [];
}

async function listWorkouts() {
  const user = await requireAuthUser();

  const { data, error } = await supabase
    .from("intz_workouts")
    .select(
      [
        "id",
        "local_id",
        "name",
        "description",
        "payload",
        "schema_version",
        "client_updated_at",
        "deleted_at",
        "server_updated_at"
      ].join(",")
    )
    .eq("user_id", user.id)
    .order("client_updated_at", {
      ascending: true
    });

  if (error) {
    throw error;
  }

  return data || [];
}

async function listSessions() {
  const user = await requireAuthUser();

  const { data, error } = await supabase
    .from("intz_sessions")
    .select(
      [
        "id",
        "local_id",
        "name",
        "started_at",
        "ended_at",
        "payload",
        "schema_version",
        "client_updated_at",
        "deleted_at",
        "server_updated_at"
      ].join(",")
    )
    .eq("user_id", user.id)
    .order("client_updated_at", {
      ascending: true
    });

  if (error) {
    throw error;
  }

  return data || [];
}

supabase.auth.onAuthStateChange(
  (event, session) => {
    window.dispatchEvent(
      new CustomEvent("intz:authchange", {
        detail: {
          event,
          user: session?.user || null
        }
      })
    );
  }
);

window.INTZSupabase = {
  supabase,
  getAuthUser,
  requireAuthUser,
  sendMagicLink,
  signOut,
  upsertWorkouts,
  upsertSessions,
  listWorkouts,
  listSessions,
  SUPABASE_URL
};