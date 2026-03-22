// results_tcx_fallback.js – signert URL nedlasting fra Supabase Storage
import { supabase } from './supabase-init.js';

async function downloadTCXFromCloud(client_id){
  try{
    const { data:{ session } } = await supabase.auth.getSession();
    if(!session){ alert('Ikke innlogget'); return; }
    const user_id = session.user.id;
    const path = `${user_id}/${client_id}.tcx`;
    const { data, error } = await supabase.storage.from('sessions').createSignedUrl(path, 60);
    if(error) throw error;
    const a=document.createElement('a'); a.href=data.signedUrl; a.download=`${client_id}.tcx`; a.click();
  }catch(e){ console.warn(e); alert('Kunne ikke hente TCX fra sky: '+(e.message||e)); }
}

window.downloadTCXFromCloud = downloadTCXFromCloud;
