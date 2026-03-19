// cloud-sessions.js – Leveranse 1: pull ved start; (auto push av nye økter kommer i Leveranse 2)
import { supabase } from './supabase-init.js';
import { sessionToTCX } from './tcx.js';

function busy(){ window.dispatchEvent(new CustomEvent('sync:busy', {detail:{source:'sessions'}})); }
function idle(){ window.dispatchEvent(new CustomEvent('sync:idle', {detail:{source:'sessions'}})); }
function oops(e){ console.warn(e); window.dispatchEvent(new CustomEvent('sync:error', {detail:{source:'sessions', error:e}})); }

async function getSession(){ const { data:{ session } } = await supabase.auth.getSession(); return session; }

async function pullSessions(){
  const sess = await getSession(); if(!sess) return; busy();
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
  localStorage.setItem('sessions', JSON.stringify(Array.from(byId.values())));
  idle();
}

async function bootstrap(){
  const { data:{ session } } = await supabase.auth.getSession();
  // ui-status tar seg av første pull når session finnes
  return !!session;
}

window.cloudSessions = { bootstrap, pullSessions };
