
export const $=(s,c=document)=>c.querySelector(s); export const $$=(s,c=document)=>Array.from(c.querySelectorAll(s));
export function fmtTime(sec){ sec=Math.max(0,Math.floor(sec||0)); const h=Math.floor(sec/3600), m=Math.floor((sec%3600)/60), s=sec%60; return (h>0? h+':':'')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'); }
export function clamp(v,min,max){ return Math.max(min, Math.min(max,v)); }
export function avg(a){ return a.length? a.reduce((x,y)=>x+y,0)/a.length:0; }
export function toast(msg){ let el=$('#toast'); if(!el){ el=document.createElement('div'); el.id='toast'; Object.assign(el.style,{position:'fixed',bottom:'1rem',right:'1rem',background:'#172d63',border:'1px solid #2a4ea2',padding:'.6rem .8rem',borderRadius:'.5rem',color:'#cfe1ff',zIndex:99}); document.body.appendChild(el);} el.textContent=msg; el.style.opacity='1'; clearTimeout(window.__t); window.__t=setTimeout(()=> el.style.opacity='0', 2500);} 
export let wakeLock=null; export async function requestWakeLock(){ try{ if('wakeLock' in navigator){ wakeLock=await navigator.wakeLock.request('screen'); } }catch(e){} } export function releaseWakeLock(){ try{ if(wakeLock){ wakeLock.release(); wakeLock=null; } }catch(e){} }
