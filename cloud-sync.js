// cloud-sync.js – L3 FIX: stopp duplisering (guard ved pull) + trygg delete eq(user_id)
import { supabase } from './supabase-init.js';
const KEY = 'custom_workouts_v2';
const GH_REDIRECT = 'https://hallvarfjell.github.io/Test/';

function activeUser(){ return localStorage.getItem('active_user') || 'default'; }
function nsKey(k){ return 'u:'+activeUser()+':'+k; }
function parse(json, d){ try{ return JSON.parse(json); }catch(_){ return d; } }

let __INTZ_APPLYING_REMOTE__ = false; // guard for setItem-hook under pull

function getLocalTemplates(){
  const ns = localStorage.getItem(nsKey(KEY));
  if(ns!=null) return parse(ns, []);
  const g = localStorage.getItem(KEY);
  return parse(g, []);
}

function setLocalTemplates(arr){
  const v = JSON.stringify(arr);
  __INTZ_APPLYING_REMOTE__ = true;
  try{
    localStorage.setItem(KEY, v);           // global (bakoverkomp)
    localStorage.setItem(nsKey(KEY), v);    // namespaced (INTZ)
  } finally { __INTZ_APPLYING_REMOTE__ = false; }
}

function busy(){ window.dispatchEvent(new CustomEvent('sync:busy', {detail:{source:'templates'}})); }
function idle(){ window.dispatchEvent(new CustomEvent('sync:idle', {detail:{source:'templates'}})); }
function oops(e){ console.warn('[templates][error]', e); window.dispatchEvent(new CustomEvent('sync:error', {detail:{source:'templates', error:e}})); }

async function getSession(){ const { data:{ session } } = await supabase.auth.getSession(); return session; }

export async function pullTemplates(){
  const sess = await getSession(); if(!sess) return; busy();
  const { data, error } = await supabase
    .from('workout_templates')
    .select('*')
    .order('sort_index',{ascending:true})
    .order('created_at',{ascending:true});
  if(error){ oops(error); return; }
  const arr = (data??[]).map(row=>({
    name: row.name ?? 'Økt',
    desc: row.description ?? row.desc ?? '',
    warmupSec: row.warmup_sec ?? 0,
    cooldownSec: row.cooldown_sec ?? 0,
    series: row.series ?? []
  }));
  setLocalTemplates(arr);
  idle();
}

export async function pushTemplates(){
  const sess = await getSession(); if(!sess) return; busy();
  const user_id = sess.user.id;
  const arr = getLocalTemplates();
  // Slett KUN mine rader; avbryt ved feil
  const del = await supabase.from('workout_templates').delete().eq('user_id', user_id);
  if(del.error){ oops(del.error); idle(); return; }
  // Sett inn nåværende liste
  const payload = arr.map((w,i)=>({
    user_id,
    name: w.name ?? 'Økt',
    description: w.desc ?? w.description ?? '',
    warmup_sec: w.warmupSec ?? 0,
    cooldown_sec: w.cooldownSec ?? 0,
    series: w.series ?? [],
    sort_index: i
  }));
  const ins = await supabase.from('workout_templates').insert(payload);
  if(ins.error){ oops(ins.error); idle(); return; }
  idle();
}

export async function signIn(){
  const email = prompt('E-post (magic link):'); if(!email) return;
  const { error } = await supabase.auth.signInWithOtp({ email, options:{ emailRedirectTo: GH_REDIRECT }});
  if(error) alert(error.message); else alert('Sjekk e-posten og følg lenken.');
}

export async function bootstrap(){
  const { data:{ session } } = await supabase.auth.getSession();
  return !!session;
}

// --- hooks: fang både global KEY og nsKey(KEY); ignorer mens pull pågår ---
(function(){
  const _setItem = localStorage.setItem.bind(localStorage);
  let timer=null;
  function maybePush(k){
    if(__INTZ_APPLYING_REMOTE__) return; // <- viktig guard mot ping-pong
    if(k===KEY || k.endsWith(':'+KEY)){
      if(timer) clearTimeout(timer);
      timer = setTimeout(()=>{ pushTemplates().catch(oops); }, 800);
    }
  }
  localStorage.setItem = function(k, v){ _setItem(k, v); maybePush(k); };
})();

window.cloudSync = { bootstrap, pullTemplates, pushTemplates, signIn };
