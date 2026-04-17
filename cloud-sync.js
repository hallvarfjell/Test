// cloud-sync.js
// INTZ v10.1 – Offline-first sync (localStorage <-> Supabase)

function activeUser(){ return localStorage.getItem('active_user') || 'default'; }
function nsKey(k){ return 'u:'+activeUser()+':'+k; }
function getNS(k, d){ try{ const v=localStorage.getItem(nsKey(k)); if(v!=null) return JSON.parse(v); const ov=localStorage.getItem(k); return ov!=null? JSON.parse(ov): d; }catch(e){ return d; } }
function setNS(k, v){ localStorage.setItem(nsKey(k), JSON.stringify(v)); }

async function ensureCloud(){
  if(!window.INTZSupabase) throw new Error('Supabase-klient ikke lastet');
  const userKey = activeUser();
  const u = await window.INTZSupabase.ensureUser(userKey);
  return u;
}

function cloudEnabled(){ return !!getNS('cloudEnabled', false); }
function setCloudEnabled(v){ setNS('cloudEnabled', !!v); }

async function syncUp(){
  const u = await ensureCloud();

  // Workouts (custom_workouts_v2)
  const workouts = getNS('custom_workouts_v2', []);
  let changedW = false;
  for(const w of workouts){
    if(!w) continue;
    if(!w._cloud_id){
      const res = await window.INTZSupabase.insertWorkout(u.id, w);
      if(res.error) throw res.error;
      w._cloud_id = res.data.id;
      w._cloud_synced_at = new Date().toISOString();
      changedW = true;
    }
  }
  if(changedW) setNS('custom_workouts_v2', workouts);

  // Sessions
  const sessions = getNS('sessions', []);
  let changedS = false;
  for(const s of sessions){
    if(!s) continue;
    if(!s._cloud_id){
      const res = await window.INTZSupabase.insertSession(u.id, s);
      if(res.error) throw res.error;
      s._cloud_id = res.data.id;
      s._cloud_synced_at = new Date().toISOString();
      changedS = true;
    }
  }
  if(changedS) setNS('sessions', sessions);

  return { workouts_uploaded: workouts.filter(x=>x && x._cloud_id).length, sessions_uploaded: sessions.filter(x=>x && x._cloud_id).length };
}

async function syncDown(){
  const u = await ensureCloud();

  const localWorkouts = getNS('custom_workouts_v2', []);
  const localWorkoutIds = new Set(localWorkouts.map(w=>w && w._cloud_id).filter(Boolean));

  const wRes = await window.INTZSupabase.listWorkouts(u.id);
  if(wRes.error) throw wRes.error;
  let addedW = 0;
  for(const row of (wRes.data||[])){
    if(localWorkoutIds.has(row.id)) continue;
    const struct = row.structure || {};
    struct.name = row.name || struct.name || 'Økt';
    struct.desc = row.description || struct.desc || '';
    struct._cloud_id = row.id;
    struct._cloud_synced_at = new Date().toISOString();
    localWorkouts.push(struct);
    addedW++;
  }
  if(addedW) setNS('custom_workouts_v2', localWorkouts);

  const localSessions = getNS('sessions', []);
  const localSessionIds = new Set(localSessions.map(s=>s && s._cloud_id).filter(Boolean));

  const sRes = await window.INTZSupabase.listSessions(u.id);
  if(sRes.error) throw sRes.error;
  let addedS = 0;
  for(const row of (sRes.data||[])){
    if(localSessionIds.has(row.id)) continue;
    const pts = row.points || [];
    const m = row.metrics || {};
    const sess = {
      id: 's'+Date.now()+Math.random().toString(16).slice(2),
      name: row.name || 'Økt',
      reps: m.reps || 0,
      startedAt: row.started_at || null,
      endedAt: row.ended_at || null,
      lt1: m.lt1,
      lt2: m.lt2,
      massKg: m.massKg,
      points: pts,
      _cloud_id: row.id,
      _cloud_synced_at: new Date().toISOString()
    };
    localSessions.push(sess);
    addedS++;
  }
  if(addedS) setNS('sessions', localSessions);

  return { workouts_downloaded: addedW, sessions_downloaded: addedS };
}

window.INTZCloud = { cloudEnabled, setCloudEnabled, syncUp, syncDown, ensureCloud };
