// results_tcx_fallback.js – L4: hvis en økt mangler points, last ned TCX fra sky
import { supabase } from './supabase-init.js';
export async function downloadTCXFromCloud(client_id){
  const { data:{ session } } = await supabase.auth.getSession(); if(!session) { alert('Ikke innlogget'); return; }
  const user_id = session.user.id;
  // Anta standard sti
  const path = `${user_id}/${client_id}.tcx`;
  try{
    const { data, error } = await supabase.storage.from('sessions').createSignedUrl(path, 60);
    if(error) throw error; const a=document.createElement('a'); a.href=data.signedUrl; a.download=`${client_id}.tcx`; a.click();
  }catch(e){ alert('Kunne ikke hente TCX fra sky: '+(e.message||e)); }
}
