// cloud-sync.js – L4: dedupe via UPSERT on (user_id, sort_index) + strong guards
import { supabase } from './supabase-init.js';
const KEY = 'custom_workouts_v2';
const GH_REDIRECT = 'https://hallvarfjell.github.io/Test/';

function activeUser(){ return localStorage.getItem('active_user') || 'default'; }
function nsKey(k){ return 'u:'+activeUser()+':'+k; }
function parse(json, d){ try{ return JSON.parse(json); }catch(_){ return d; } }

let __INTZ_APPLYING_REMOTE__ = false; // don't echo pull->push
let __INTZ_PUSH_INFLIGHT__ = false;    // prevent concurrent pushes
let __INTZ_LAST_HASH__ = null;         // avoid pushing identical content

function stableHash(str){
  let h=0, i=0, len=str.length; if(len===0) return '0';
  for(i=0;i<len;i++){ h = ((h<<5)-h) + str.charCodeAt(i); h |= 0; }
  return String(h);
}

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
    localStorage.setItem(KEY, v);
    localStorage.setItem(nsKey(KEY), v);
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
  if(__INTZ_APPLYING_REMOTE__) return;        // don't push during pull
  if(__INTZ_PUSH_INFLIGHT__) return;          // drop concurrent pushes

  const sess = await getSession(); if(!sess) return;
  const user_id = sess.user.id;
  const arr = getLocalTemplates();
  const payload = arr.map((w,i)=>({
    user_id,
    sort_index: i,
    name: w.name ?? 'Økt',
    description: w.desc ?? w.description ?? '',
    warmup_sec: w.warmupSec ?? 0,
    cooldown_sec: w.cooldownSec ?? 0,
    series: w.series ?? []
  }));

  const json = JSON.stringify(payload);
  const h = stableHash(json);
  if(h === __INTZ_LAST_HASH__) return; // identical content

  __INTZ_PUSH_INFLIGHT__ = true; busy();
  try{
    // Upsert per rad med konflikt på (user_id, sort_index)
    // Forutsetter unik indeks i DB (se PATCH_NOTES_L4.sql)
    const { error } = await supabase
      .from('workout_templates')
      .upsert(payload, { onConflict: 'user_id,sort_index' });
    if(error){ oops(error); return; }
    __INTZ_LAST_HASH__ = h;
  } finally {
    __INTZ_PUSH_INFLIGHT__ = false; idle();
  }
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

// --- single setItem watcher registry to avoid wrappers clobbering each other ---
(function(){
  if(!window.__INTZ_setItemWatchers){
    const watchers = [];
    const orig = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(k, v){ orig(k,v); watchers.forEach(fn=>{ try{ fn(k,v); }catch(_){}}); };
    window.__INTZ_setItemWatchers = watchers;
  }
  const watchers = window.__INTZ_setItemWatchers;
  const watcher = (k)=>{
    if(__INTZ_APPLYING_REMOTE__) return;
    if(k===KEY || k.endsWith(':'+KEY)){
      // small debounce via microtask
      Promise.resolve().then(()=> pushTemplates().catch(oops));
    }
  };
  // avoid duplicate registration
  if(!watchers.includes(watcher)) watchers.push(watcher);
})();

window.cloudSync = { bootstrap, pullTemplates, pushTemplates, signIn };
