// supabase-client.js
// INTZ v10.1 – Supabase client (classic script)
// Exposes: window.INTZSupabase

(function(){
  const SUPABASE_URL = 'https://mmlxbgdzbuijnlfedyqu.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tbHhiZ2R6YnVpam5sZmVkeXF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMTY4MzAsImV4cCI6MjA4ODc5MjgzMH0.zZDw-rWrA49U-4HFGEhjjzLJXb-z1X56wzv90ds9-Kg';

  function requireSupabase(){
    const sb = (window.supabase && window.supabase.createClient) ? window.supabase : null;
    if(!sb) throw new Error('Supabase JS ikke lastet (window.supabase mangler).');
    return sb;
  }

  const supabase = requireSupabase().createClient(SUPABASE_URL, SUPABASE_ANON);

  async function ensureUser(userKey){
    const { data, error } = await supabase
      .from('intz_users')
      .select('*')
      .eq('user_key', userKey)
      .maybeSingle();
    if(error) throw error;
    if(data) return data;

    const ins = await supabase
      .from('intz_users')
      .insert({ user_key: userKey })
      .select('*')
      .single();
    if(ins.error) throw ins.error;
    return ins.data;
  }

  async function insertWorkout(userId, workout){
    return supabase.from('intz_workouts').insert({
      user_id: userId,
      name: workout.name || 'Økt',
      description: workout.desc || '',
      structure: workout
    }).select('id').single();
  }

  async function listWorkouts(userId){
    return supabase.from('intz_workouts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
  }

  async function insertSession(userId, session){
    return supabase.from('intz_sessions').insert({
      user_id: userId,
      name: session.name || 'Økt',
      started_at: session.startedAt || null,
      ended_at: session.endedAt || null,
      metrics: { lt1: session.lt1, lt2: session.lt2, reps: session.reps, massKg: session.massKg },
      points: session.points || []
    }).select('id').single();
  }

  async function listSessions(userId){
    return supabase.from('intz_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false });
  }

  window.INTZSupabase = { supabase, ensureUser, insertWorkout, listWorkouts, insertSession, listSessions, SUPABASE_URL };
})();
