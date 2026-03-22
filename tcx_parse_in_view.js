// tcx_parse_in_view.js – parse TCX from cloud into memory for results page
import { supabase } from './supabase-init.js';

async function parseTCXInView(clientId){
  const { data:{ session } } = await supabase.auth.getSession(); if(!session) throw new Error('Ikke innlogget');
  const user_id=session.user.id; const path=`${user_id}/${clientId}.tcx`;
  const { data, error } = await supabase.storage.from('sessions').createSignedUrl(path, 60);
  if(error) throw error; const res = await fetch(data.signedUrl); if(!res.ok) throw new Error('TCX ikke tilgjengelig');
  const text = await res.text();
  const doc = new DOMParser().parseFromString(text,'application/xml');
  const tps = doc.getElementsByTagName('Trackpoint'); const pts=[];
  for(const tp of tps){
    const tStr = tp.getElementsByTagName('Time')[0]?.textContent||'';
    const dStr = tp.getElementsByTagName('DistanceMeters')[0]?.textContent||'0';
    const hrNode = tp.getElementsByTagName('HeartRateBpm')[0]?.getElementsByTagName('Value')[0];
    const wNode = tp.getElementsByTagName('Watts')[0] || tp.getElementsByTagName('ns3:Watts')[0];
    pts.push({ ts:(new Date(tStr)).getTime(), dist_m:parseFloat(dStr)||0, hr:Math.round(parseFloat(hrNode?.textContent||'0'))||0, watt:Math.round(parseFloat(wNode?.textContent||'0'))||0 });
  }
  return pts;
}

window.parseTCXInView = parseTCXInView;
