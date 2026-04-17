// supabase-client.js
// INTZ v10.1 – Supabase baseline client

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

export const SUPABASE_URL = "https://mmlxbgdzbuijnlfedyqu.supabase.co";
export const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tbHhiZ2R6YnVpam5sZmVkeXF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMTY4MzAsImV4cCI6MjA4ODc5MjgzMH0.zZDw-rWrA49U-4HFGEhjjzLJXb-z1X56wzv90ds9-Kg";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// --------------------------------------------------
// Bruker (kobles mot localStorage active_user)
// --------------------------------------------------
export async function ensureUser(userKey) {
  let { data } = await supabase
    .from("intz_users")
    .select("*")
    .eq("user_key", userKey)
    .single();

  if (!data) {
    const res = await supabase
      .from("intz_users")
      .insert({ user_key: userKey })
      .select()
      .single();
    return res.data;
  }
  return data;
}

// --------------------------------------------------
// Workouts
// --------------------------------------------------
export async function saveWorkout(userId, workout) {
  return supabase.from("intz_workouts").insert({
    user_id: userId,
    name: workout.name,
    description: workout.desc || "",
    structure: workout,
  });
}

export async function loadWorkouts(userId) {
  return supabase
    .from("intz_workouts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
}

// --------------------------------------------------
// Sessions
// --------------------------------------------------
export async function saveSession(userId, session) {
  return supabase.from("intz_sessions").insert({
    user_id: userId,
    name: session.name,
    started_at: session.startedAt,
    ended_at: session.endedAt,
    metrics: {
      lt1: session.lt1,
      lt2: session.lt2,
      reps: session.reps,
    },
    points: session.points,
  });
}

export async function loadSessions(userId) {
  return supabase
    .from("intz_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("started_at", { ascending: false });
}
``
