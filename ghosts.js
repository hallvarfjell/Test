// ghosts.js – in-memory LRU cache (typed arrays), no localStorage writes
import { supabase } from './supabase-init.js';

const store = { max: 3, map: new Map() }; // clientId -> { ts, arrays, meta }
export function configure(opts={}){ if(Number.isFinite(opts.max)) store.max=Math.max(1,Math.min(8,opts.max)); }
function touch(id){ const v=store.map.get(id); if(!v) return; v.ts=Date.now(); store.map.delete(id); store.map.set(id,v); }
function evict(){ while(store.map.size>store.max){ let oldestId=null, oldestTs=Infinity; for(const [id,v] of store.map){ if(v.ts<oldestTs){ oldestTs=v.ts; oldestId=id; } } if(oldestId) store.map.delete(oldestId); } }

function parseTCX(xmlText){
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  const nodes = doc.getElementsByTagName('Trackpoint');
  const n = nodes.length;
  const ts = new Float64Array(n); const dist = new Float32Array(n); const hr = new Uint16Array(n); const watt = new Uint16Array(n);
  let i=0; for(const tp of nodes){
    const tStr = tp.getElementsByTagName('Time')[0]?.textContent||'';
    const dStr = tp.getElementsByTagName('DistanceMeters')[0]?.textContent||'0';
    const hrNode = tp.getElementsByTagName('HeartRateBpm')[0]?.getElementsByTagName('Value')[0];
    const wNode = tp.getElementsByTagName('Watts')[0] || tp.getElementsByTagName('ns3:Watts')[0];
    ts[i]=(new Date(tStr)).getTime(); dist[i]=parseFloat(dStr)||0; hr[i]=Math.max(0,Math.round(parseFloat(hrNode?.textContent||'0'))); watt[i]=Math.max(0,Math.round(parseFloat(wNode?.textContent||'0'))); i++; }
  const points = Array.from({length:n},(_,j)=>({ ts:ts[j], dist_m:dist[j], hr:hr[j]||0, watt:watt[j]||0 }));
  const startedAt = n? new Date(ts[0]).toISOString(): new Date().toISOString(); const endedAt = n? new Date(ts[n-1]).toISOString(): startedAt;
  return { points, startedAt, endedAt };
}

async function fetchSignedTCX(clientId){
  const { data:{ session } } = await supabase.auth.getSession(); if(!session) throw new Error('Ingen session');
  const user_id=session.user.id; const path=`${user_id}/${clientId}.tcx`;
  const { data, error } = await supabase.storage.from('sessions').createSignedUrl(path, 60);
  if(error) throw error; const res=await fetch(data.signedUrl); if(!res.ok) throw new Error('Hentet ikke TCX'); return await res.text();
}

export async function getGhost(clientId){
  if(store.map.has(clientId)){ touch(clientId); return store.map.get(clientId).arrays; }
  const xml = await fetchSignedTCX(clientId); const parsed = parseTCX(xml); const arrays = parsed.points;
  store.map.set(clientId, { ts:Date.now(), arrays, meta:{ startedAt:parsed.startedAt, endedAt:parsed.endedAt } }); evict(); return arrays;
}

window.ghosts = { configure, getGhost };
