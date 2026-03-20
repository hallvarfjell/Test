// cloud-sessions.js – Leveranse 2 HOTFIX-1: auto-push økter + kø + retry + nsKey('sessions')-støtte
import { supabase } from './supabase-init.js';
import { sessionToTCX } from './tcx.js';

// ---- status events ----
function busy(){ window.dispatchEvent(new CustomEvent('sync:busy',{detail:{source:'sessions'}})); }
function idle(){ window.dispatchEvent(new CustomEvent('sync:idle',{detail:{source:'sessions'}})); }
function oops(e){ console.warn(e); window.dispatchEvent(new CustomEvent('sync:error',{detail:{source:'sessions',error:e}})); }

async function getSession(){ const { data:{ session } } = await supabase.auth.getSession(); return session; }

// ==== PULL fra sky (uendret fra L1) ======================================
export async function pullSessions(){
  const sess=await getSession(); if(!sess) return; busy();
  const { data, error } = await supabase
    .from('workouts')
    .select('client_id, name, started_at, reps, lt1, lt2, mass_kg')
    .order('started_at',{ascending:false});
  if(error){ oops(error); return; }
  const local = JSON.parse(localStorage.getItem('sessions') || '[]');
  const byId = new Map(local.map(x=>[x.id, x]));
  (data||[]).forEach(row=>{
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

// ==== Køsystem ============================================================
const QUE_KEY='sync_queue_sessions';
function loadQ(){ try{return JSON.parse(localStorage.getItem(QUE_KEY)||'[]')}catch(_){return []} }
function saveQ(q){ localStorage.setItem(QUE_KEY, JSON.stringify(q)); }

async function pushOne(entry){
  const sess=await getSession(); if(!sess) throw new Error('Offline – ingen session');
  const user_id=sess.user.id;
  const session=entry; busy();

  // TCX
  const tcx = sessionToTCX(session);
  const blob=new Blob([tcx],{type:'application/vnd.garmin.tcx+xml'});
  const tcxPath=`${user_id}/${session.id}.tcx`;
  const up = await supabase.storage.from('sessions').upload(tcxPath, blob, { upsert:true });
  if(up.error) throw up.error;

  // Metadata
  const pts = Array.isArray(session.points)? session.points: [];
  const payload = {
    user_id,
    client_id: session.id,
    name: session.name || 'Økt',
    started_at: session.startedAt,
    ended_at: session.endedAt,
    duration_sec: Math.max(1, Math.round((new Date(session.endedAt) - new Date(session.startedAt))/1000)),
    reps: Number(session.reps || 0),
    lt1: Number(session.lt1 ?? null),
    lt2: Number(session.lt2 ?? null),
    mass_kg: Number(session.massKg ?? null),
    distance_m: Number(pts.at(-1)?.dist_m ?? 0),
    elev_gain_m: Number(session.metrics?.elevGainM ?? 0),
    tss: Number(session.metrics?.tss ?? 0),
    tcx_path: `sessions/${tcxPath}`
  };
  const upsert = await supabase.from('workouts').upsert(payload, { onConflict:'user_id,client_id' });
  if(upsert.error) throw upsert.error;
  idle();
}

async function processQueue(){
  let q=loadQ(); if(!q.length) return;
  for(const entry of q){
    try{ await pushOne(entry); q=q.filter(x=>x.id!==entry.id); saveQ(q); }
    catch(e){ oops(e); return; }
  }
}

// ==== AUTO-HOOK: fanger både 'sessions' og nsKey('sessions') = 'u:<user>:sessions' ====
function isSessionsKey(k){ return k==='sessions' || k.endsWith(':sessions'); }

(function(){
  const _setItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(k, v){
    _setItem(k, v);
    if(isSessionsKey(k)){
      let arr=[]; try{ arr = JSON.parse(v||'[]'); }catch(_){ arr=[]; }
      const q = loadQ();
      const known = new Set(q.map(x=>x.id));
      arr.forEach(s=>{
        if(!s || !s.id || !s.startedAt) return; // må være gyldig økt
        if(!known.has(s.id)) q.push(s);
      });
      saveQ(q);
      processQueue();
    }
  };
})();

// ==== BOOTSTRAP ===========================================================
export async function bootstrap(){ processQueue(); return true; }

window.cloudSessions = { pullSessions, bootstrap };
