// results.js – integrates cloud parse on-demand without local writes
(function(){
  const $ = (id)=> document.getElementById(id);
  function showErr(e){ try{ $('err-card')?.classList.remove('hidden'); const s=(e&&e.stack)? e.stack : (e?.message||String(e)); $('err-log').textContent += s+'\n'; }catch(_){} }
  window.addEventListener('error', e=> showErr(e.error||e.message));
  window.addEventListener('unhandledrejection', e=> showErr(e.reason||e));

  function activeUser(){ return localStorage.getItem('active_user') || 'default'; }
  function nsKey(k){ return 'u:'+activeUser()+':'+k; }
  function getNS(k, d){ try{ const v=localStorage.getItem(nsKey(k)); if(v!=null) return JSON.parse(v); const g=localStorage.getItem(k); return g!=null? JSON.parse(g): d; }catch(_){ return d; } }

  let SESSION=null; let CAN,CTX;

  function pickSession(){ const id=location.hash? location.hash.substring(1):''; const arr=getNS('sessions',[]); if(!arr||!arr.length) return null; if(id){ return arr.find(s=>s.id===id)||null; } return arr[arr.length-1]; }

  function mmss(sec){ sec=Math.max(0,Math.round(sec)); const m=Math.floor(sec/60), s=String(sec%60).padStart(2,'0'); return `${m}:${s}`; }
  function avg(a){ return a.length? a.reduce((x,y)=>x+y,0)/a.length:0; }

  function computeSummary(s){ const pts=Array.isArray(s.points)? s.points:[]; const dur=Math.max(0,(new Date(s.endedAt||s.startedAt)-new Date(s.startedAt))/1000); const dist=pts.length? (pts[pts.length-1].dist_m||0)/1000:0; let sumHR=0,cntHR=0,maxHR=0,sumW=0,cntW=0,elev=0; let last=null; const LTHR=s.lt2||160; let tss=0; for(const p of pts){ if(p.hr){ sumHR+=p.hr; cntHR++; if(p.hr>maxHR) maxHR=p.hr; } if(p.watt!=null){ sumW+=p.watt; cntW++; } if(last){ const dt=(p.ts-last.ts)/1000; const gradeFrac=(p.grade||0)/100; const dh=(p.speed_ms||0)*gradeFrac*dt; if(dh>0) elev+=dh; const hr=p.hr||0; const ifHr=LTHR>0? (hr/LTHR):0; tss+=(dt/3600)*(ifHr*ifHr)*100; } last=p; } return { dur, dist, elev:Math.round(elev), avgHR:cntHR?Math.round(sumHR/cntHR):0, maxHR:Math.round(maxHR), avgW:cntW?Math.round(sumW/cntW):0, tss:Math.round(tss) } }

  function renderSummary(){ const s=SESSION; const sum=computeSummary(s); const when=new Date(s.startedAt||Date.now()); const name=s.name||'Økt'; const reps=s.reps||0; $('summary').innerHTML=`<div><strong>${name}</strong></div><div class="small">${when.toLocaleString()}</div><ul class="small" style="margin:8px 0 0 16px;line-height:1.6"><li>Varighet: ${mmss(sum.dur)}</li><li>Distanse: ${(isFinite(sum.dist)? sum.dist.toFixed(2):'0.00')} km</li><li>Høydemeter: ${sum.elev} m</li><li>Snitt HR: ${sum.avgHR||'–'} bpm · Maks HR: ${sum.maxHR||'–'} bpm</li><li>Snitt Watt: ${sum.avgW||'–'} W</li><li>Antall drag: ${reps}</li><li>TSS: ${sum.tss}</li></ul>`; $('notes').value=s.notes||''; }

  function resizeCanvas(){ if(!CAN) return; const rect=CAN.getBoundingClientRect(); CAN.width=Math.floor(rect.width*(window.devicePixelRatio||1)); CAN.height=Math.floor((rect.height||260)*(window.devicePixelRatio||1)); }
  function draw(){ if(!CTX||!CAN||!SESSION) return; const pts=Array.isArray(SESSION.points)? SESSION.points:[]; const W=CAN.width,H=CAN.height; CTX.clearRect(0,0,W,H); if(!pts.length) return; const pad=40, plotW=W-2*pad, plotH=H-2*pad; const t0=pts[0].ts, tN=pts[pts.length-1].ts; const x=t=> pad + (t-t0)/Math.max(1,(tN-t0))*plotW; const y=(v,min,max)=> pad + (1- (v-min)/Math.max(1,(max-min)) )*plotH; const hrVals=pts.map(p=>p.hr||0); const hrMin=80, hrMax=Math.max(120,Math.max(...hrVals)); CTX.strokeStyle='#ef4444'; CTX.beginPath(); let moved=false; for(const p of pts){ const xv=x(p.ts), yv=y(p.hr||0, hrMin, hrMax); if(!moved){ CTX.moveTo(xv,yv); moved=true; } else { CTX.lineTo(xv,yv);} } CTX.stroke(); }

  async function fetchPointsFromCloud(){ try{ const cid=SESSION?.id || location.hash.slice(1)||''; if(!cid) { alert('Mangler økt-ID'); return; } if(typeof window.parseTCXInView!=='function'){ alert('Parser ikke lastet'); return; } const pts = await window.parseTCXInView(cid); if(!Array.isArray(pts) || !pts.length){ alert('Fant ingen punkter i TCX'); return; } SESSION.points = pts; renderSummary(); resizeCanvas(); draw(); document.getElementById('no-points-hint').style.display='none'; document.getElementById('btn-fetch-from-cloud').style.display='none'; } catch(e){ showErr(e); alert('Klarte ikke hente punkter fra skyen.'); } }

  function setupButtons(){ const hasPoints = Array.isArray(SESSION.points) && SESSION.points.length>0; const hint=$('no-points-hint'); const fetchBtn=$('btn-fetch-from-cloud'); if(hint) hint.style.display = hasPoints? 'none':'inline'; if(fetchBtn) fetchBtn.style.display = hasPoints? 'none':'inline';
    $('btn-download-tcx')?.addEventListener('click', async ()=>{ try{ const has = Array.isArray(SESSION.points)&&SESSION.points.length>0; if(!has){ const cid=SESSION?.id||location.hash.slice(1)||''; if(!cid){ alert('Ingen data i økta, og fant ikke økt-ID.'); return;} if(typeof window.downloadTCXFromCloud==='function'){ await window.downloadTCXFromCloud(cid);} else { alert('TCX‑fallback ikke tilgjengelig.'); } return; } const name=(SESSION.name||'okt')+'.tcx'; const xml=`<?xml version="1.0"?><TrainingCenterDatabase></TrainingCenterDatabase>`; const blob=new Blob([xml],{type:'application/vnd.garmin.tcx+xml'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }catch(e){ showErr(e); alert('TCX-eksport feilet.'); } });
    $('btn-dump-json')?.addEventListener('click', ()=>{ try{ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(SESSION,null,2)],{type:'application/json'})); a.download=(SESSION.name||'okt')+'.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);}catch(e){ showErr(e); } });
    $('btn-fetch-from-cloud')?.addEventListener('click', fetchPointsFromCloud);
  }

  function init(){ try{ SESSION = pickSession(); if(!SESSION){ $('no-session').classList.remove('hidden'); return; } $('result-summary-card').classList.remove('hidden'); CAN=$('r-chart'); CTX=CAN.getContext('2d'); resizeCanvas(); renderSummary(); setupButtons(); draw(); window.addEventListener('resize', ()=>{ resizeCanvas(); draw(); }); }catch(e){ showErr(e); } }
  document.addEventListener('DOMContentLoaded', init);
})();
