// cloud-sessions.js – L3 FIX: eksporter deleteSession + (u:<bruker>:sessions) støtte
import { supabase } from './supabase-init.js';
import { sessionToTCX } from './tcx.js';

function busy(){ window.dispatchEvent(new CustomEvent('sync:busy',{detail:{source:'sessions'}})); }
function idle(){ window.dispatchEvent(new CustomEvent('sync:idle',{detail:{source:'sessions'}})); }
function oops(e){ console.warn('[sessions][error]', e); window.dispatchEvent(new CustomEvent('sync:error',{detail:{source:'sessions',error:e}})); }

function activeUser(){ return localStorage.getItem('active_user') || 'default'; }
function nsKey(k){ return 'u:'+activeUser()+':'+k; }

async function getSession(){ const { data:{ session } } = await supabase.auth.getSession(); return session; }

export async function pullSessions(){
  const sess=await getSession(); if(!sess) return; busy();
  const { data, error } = await supabase
    .from('workouts')
    .select('client_id,name,started_at,reps,lt1,lt2,mass_kg,tcx_path')
    .order('started_at',{ascending:false});
  if(error){ oops(error); return; }
  const local = JSON.parse(localStorage.getItem(nsKey('sessions'))||localStorage.getItem('sessions')||'[]');
  const byId = new Map(local.map(x=>[x.id,x]));
  (data||[]).forEach(r=>{ if(!byId.has(r.client_id)){ byId.set(r.client_id,{ id:r.client_id, name:r.name||'Økt', startedAt:r.started_at, endedAt:r.started_at, reps:r.reps||0, lt1:r.lt1??null, lt2:r.lt2??null, massKg:r.mass_kg??null, points:[] }); } });
  const arr=[...byId.values()];
  const v=JSON.stringify(arr);
  localStorage.setItem('sessions', v);
  localStorage.setItem(nsKey('sessions'), v);
  idle();
}

const QUE_KEY='sync_queue_sessions';
function loadQ(){ try{return JSON.parse(localStorage.getItem(QUE_KEY)||'[]')}catch(_){return []} }
function saveQ(q){ localStorage.setItem(QUE_KEY, JSON.stringify(q)); }

async function pushOne(entry){
  const sess=await getSession(); if(!sess) throw new Error('Offline – ingen session');
  const user_id=sess.user.id; const session=entry; busy();
  const tcx=sessionToTCX(session);
  const blob=new Blob([tcx],{type:'application/vnd.garmin.tcx+xml'});
  const path=`${user_id}/${session.id}.tcx`;
  const up=await supabase.storage.from('sessions').upload(path, blob, { upsert:true });
  if(up.error) throw up.error;
  const pts=Array.isArray(session.points)?session.points:[];
  const payload={ user_id, client_id:session.id, name:session.name||'Økt', started_at:session.startedAt, ended_at:session.endedAt, duration_sec:Math.max(1,Math.round((new Date(session.endedAt)-new Date(session.startedAt))/1000)), reps:Number(session.reps||0), lt1:Number(session.lt1??null), lt2:Number(session.lt2??null), mass_kg:Number(session.massKg??null), distance_m:Number(pts.at(-1)?.dist_m??0), elev_gain_m:Number(session.metrics?.elevGainM??0), tss:Number(session.metrics?.tss??0), tcx_path:`sessions/${path}` };
  const upsert=await supabase.from('workouts').upsert(payload, { onConflict:'user_id,client_id' });
  if(upsert.error) throw upsert.error;
  idle();
}

function isSessionsKey(k){ return k==='sessions' || k.endsWith(':sessions'); }

(function(){
  const _setItem=localStorage.setItem.bind(localStorage);
  localStorage.setItem=function(k,v){ _setItem(k,v); if(isSessionsKey(k)){ enqueueFromValue(v); processQueue(); } };
})();

function enqueueFromValue(v){ let arr=[]; try{ arr=JSON.parse(v||'[]'); }catch(_){ arr=[]; } const q=loadQ(); const known=new Set(q.map(x=>x.id)); arr.forEach(s=>{ if(!s||!s.id||!s.startedAt) return; if(!known.has(s.id)) q.push(s); }); saveQ(q); }
function scanAllKeys(){ const q0=loadQ(); let qset=new Set(q0.map(x=>x.id)); for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(isSessionsKey(k)){ try{ const arr=JSON.parse(localStorage.getItem(k)||'[]'); (arr||[]).forEach(s=>{ if(s&&s.id&&!qset.has(s.id)){ q0.push(s); qset.add(s.id); } }); }catch(_){} } } saveQ(q0); }

async function processQueue(){ let q=loadQ(); if(!q.length) return; for(const entry of q){ try{ await pushOne(entry); q=q.filter(x=>x.id!==entry.id); saveQ(q);}catch(e){ oops(e); return; } } }

export async function deleteSession(client_id){
  const sess=await getSession(); if(!sess) return; const user_id=sess.user.id;
  // Finn ev. lagret sti i DB
  const { data } = await supabase.from('workouts').select('tcx_path').eq('user_id', user_id).eq('client_id', client_id).maybeSingle();
  // Slett DB-rad
  await supabase.from('workouts').delete().match({ user_id, client_id });
  // Slett TCX i storage (best effort)
  const rel = (data?.tcx_path||'').replace(/^sessions\//,'');
  const path = rel || `${user_id}/${client_id}.tcx`;
  try{ await supabase.storage.from('sessions').remove([path]); }catch(_){}
}

export async function bootstrap(){ scanAllKeys(); processQueue(); return true; }
export function scanNow(){ scanAllKeys(); processQueue(); }

window.cloudSessions = { pullSessions, bootstrap, scanNow, deleteSession };
