// cloud-sync.js – Leveranse 1: pull ved start + manuell sync via ui-status; optional auto-push via setItem hook
import { supabase } from './supabase-init.js';
const KEY = 'custom_workouts_v2';
const GH_REDIRECT = 'https://hallvarfjell.github.io/Test/';

function busy(){ window.dispatchEvent(new CustomEvent('sync:busy', {detail:{source:'templates'}})); }
function idle(){ window.dispatchEvent(new CustomEvent('sync:idle', {detail:{source:'templates'}})); }
function oops(e){ console.warn(e); window.dispatchEvent(new CustomEvent('sync:error', {detail:{source:'templates', error:e}})); }

async function getSession(){ const { data:{ session } } = await supabase.auth.getSession(); return session; }

async function pullTemplates(){
  const sess = await getSession(); if(!sess) return; busy();
  const { data, error } = await supabase
    .from('workout_templates')
    .select('*')
    .order('sort_index',{ascending:true})
    .order('created_at',{ascending:true});
  if(error) { oops(error); return; }
  const arr = (data??[]).map(row=>({
    name: row.name??'Økt',
    desc: row.description??row.desc??'',
    warmupSec: row.warmup_sec??0,
    cooldownSec: row.cooldown_sec??0,
    series: row.series??[]
  }));
  localStorage.setItem(KEY, JSON.stringify(arr));
  idle();
}

async function pushTemplates(){
  const sess = await getSession(); if(!sess) return; busy();
  const user_id = sess.user.id;
  const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
  // enkel strategi v1: tøm og legg inn i sortert rekkefølge
  await supabase.from('workout_templates').delete().neq('id','00000000-0000-0000-000000000000');
  const payload = arr.map((w,i)=>({ user_id, name:w.name??'Økt', description:w.desc??w.description??'', warmup_sec:w.warmupSec??0, cooldown_sec:w.cooldownSec??0, series:w.series??[], sort_index:i }));
  const { error } = await supabase.from('workout_templates').insert(payload);
  if(error){ oops(error); return; }
  idle();
}

async function signIn(){
  const email = prompt('E-post (magic link):'); if(!email) return;
  const { error } = await supabase.auth.signInWithOtp({ email, options:{ emailRedirectTo: GH_REDIRECT }});
  if(error) alert(error.message); else alert('Sjekk e-posten og følg lenken.');
}

async function bootstrap(){
  const { data:{ session } } = await supabase.auth.getSession();
  // ui-status lytter til auth og kaller pull, så vi trenger ikke gjøre mer her i L1
  return !!session;
}

// Optional: auto-push når nøkkelen endres i samme fane (debounce)
(function(){
  const _setItem = localStorage.setItem.bind(localStorage);
  let timer = null;
  localStorage.setItem = function(k, v){
    _setItem(k, v);
    if(k===KEY){
      if(timer) clearTimeout(timer);
      timer = setTimeout(()=>{ pushTemplates().catch(oops); }, 1200);
    }
  };
})();

window.cloudSync = { bootstrap, pullTemplates, pushTemplates, signIn };
