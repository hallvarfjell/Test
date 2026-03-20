// cloud-sessions.js – Leveranse 2: auto-push økter + kø + retry
import { supabase } from './supabase-init.js';
import { sessionToTCX } from './tcx.js';

// ---- status events ----
function busy(){
  window.dispatchEvent(new CustomEvent('sync:busy', {
    detail:{source:'sessions'}
  }));
}
function idle(){
  window.dispatchEvent(new CustomEvent('sync:idle', {
    detail:{source:'sessions'}
  }));
}
function oops(e){
  console.warn(e);
  window.dispatchEvent(new CustomEvent('sync:error', {
    detail:{source:'sessions', error:e}
  }));
}

// ---- helpers ----
async function getSession(){
  const { data:{ session } } = await supabase.auth.getSession();
  return session;
}

// ==== PULL fra sky (samme som før) ==========================
export async function pullSessions(){
  const sess = await getSession();
  if(!sess) return;
  busy();

  const { data, error } = await supabase
    .from('workouts')
    .select('client_id, name, started_at, reps, lt1, lt2, mass_kg')
    .order('started_at',{ascending:false});

  if(error){
    oops(error);
    return;
  }

  const local = JSON.parse(localStorage.getItem('sessions') || '[]');
  const byId = new Map(local.map(x => [x.id, x]));

  (data || []).forEach(row => {
    if(!byId.has(row.client_id)){
      byId.set(row.client_id, {
        id: row.client_id,
        name: row.name || 'Økt',
        startedAt: row.started_at,
        endedAt: row.started_at,
        reps: row.reps || 0,
        lt1: row.lt1 ?? null,
        lt2: row.lt2 ?? null,
        massKg: row.mass_kg ?? null,
        points: []
      });
    }
  });

  localStorage.setItem('sessions', JSON.stringify([...byId.values()]));
  idle();
}

// ==== Køsystem =============================================
const QUE_KEY(QUE_KEY) || '[]'); }const QUE_KEY = 'sync_queue_sessions';
  catch { return []; }
}
function saveQ(q){
  localStorage.setItem(QUE_KEY, JSON.stringify(q));
}

// ---- push én økt til sky ----
async function pushOne(session){
  const sess = await getSession();
  if(!sess) throw new Error("Offline – ingen session");

  const user_id = sess.user.id;
  busy();

  // ---- TCX-upload ----
  const tcx = sessionToTCX(session);
  const blob = new Blob([tcx], { type:'application/vnd.garmin.tcx+xml' });
  const tcxPath = `${user_id}/${session.id}.tcx`;

  const up = await supabase
    .storage
    .from('sessions')
    .upload(tcxPath, blob, { upsert:true });

  if(up.error) throw up.error;

  // ---- metadata-upsert ----
  const pts = Array.isArray(session.points) ? session.points : [];

  const payload = {
    user_id,
    client_id: session.id,
    name: session.name || 'Økt',
    started_at: session.startedAt,
    ended_at: session.endedAt,
    duration_sec: Math.max(1, Math.round(
      (new Date(session.endedAt) - new Date(session.startedAt)) / 1000
    )),
    reps: Number(session.reps || 0),
    lt1: Number(session.lt1 ?? null),
    lt2: Number(session.lt2 ?? null),
    mass_kg: Number(session.massKg ?? null),
    distance_m: Number(pts.at(-1)?.dist_m ?? 0),
    elev_gain_m: Number(session.metrics?.elevGainM ?? 0),
    tss: Number(session.metrics?.tss ?? 0),
    tcx_path: `sessions/${tcxPath}`
  };

  const upsert = await supabase
    .from('workouts')
    .upsert(payload, { onConflict:'user_id,client_id' });

  if(upsert.error) throw upsert.error;

  idle();
}

// ---- prosesser køen ----
async function processQueue(){
  let q = loadQ();
  if(!q.length) return;

  for(const entry of q){
    try{
      await pushOne(entry);
      q = q.filter(x => x.id !== entry.id);
      saveQ(q);
    } catch(e){
      oops(e);
      return;   // stopp; prøv igjen senere
    }
  }
}

// ==== AUTO-HOOK: fanger når sessions lagres lokalt = ny økt ====
(function(){
  const _setItem = localStorage.setItem.bind(localStorage);

  localStorage.setItem = function(k, v){
    _setItem(k, v);

    if(k === 'sessions'){
      const arr = JSON.parse(v || '[]');
      const q = loadQ();
      const known = new Set(q.map(x => x.id));

      // legg til økter som ikke er i køen fra før
      arr.forEach(s => {
        if(!known.has(s.id)) q.push(s);
      });

      saveQ(q);
      processQueue();
    }
  };
})();

// ==== BOOTSTRAP =====
export async function bootstrap(){
  processQueue();
  return true;
}

window.cloudSessions = {
  pullSessions,
  bootstrap
};
``

function loadQ(){
