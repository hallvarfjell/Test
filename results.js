// results.js – TCX-fallback-integrert versjon
(function(){
  const $ = (id)=> document.getElementById(id);

  function activeUser(){ return localStorage.getItem('active_user') || 'default'; }
  function nsKey(k){ return 'u:'+activeUser()+':'+k; }
  function getNS(k, d){ try{ const v=localStorage.getItem(nsKey(k)); if(v!=null) return JSON.parse(v); const g=localStorage.getItem(k); return g!=null? JSON.parse(g): d; }catch(e){ return d; } }
  function setNS(k, v){ localStorage.setItem(nsKey(k), JSON.stringify(v)); }

  function showErr(e){ try{ $('err-card')?.classList.remove('hidden'); const s = (e && e.stack) ? e.stack : (e?.message || String(e)); $('err-log').textContent += s+'\n'; }catch(_){} }
  window.addEventListener('error', e=> showErr(e.error || e.message));
  window.addEventListener('unhandledrejection', e=> showErr(e.reason || e));

  let SESSION = null; window.currentSession = null;

  function pickSession(){
    const id = location.hash? location.hash.substring(1): '';
    const arr = getNS('sessions', []);
    if(!arr || !arr.length) return null;
    if(id){ return arr.find(s=>s.id===id) || null; }
    return arr[arr.length-1];
  }

  function mmss(sec){ sec=Math.max(0,Math.round(sec)); const m=Math.floor(sec/60), s=String(sec%60).padStart(2,'0'); return `${m}:${s}`; }

  function computeSummary(s){
    const pts = Array.isArray(s.points)? s.points: [];
    const dur = Math.max(0, (new Date(s.endedAt||s.startedAt).getTime() - new Date(s.startedAt).getTime())/1000);
    const dist = pts.length? (pts[pts.length-1].dist_m||0)/1000 : 0;
    let sumHR=0,cntHR=0,maxHR=0,sumW=0,cntW=0,elev=0; let last=null; const LTHR = s.lt2||160; let tss=0;
    for(const p of pts){ if(p.hr){ sumHR+=p.hr; cntHR++; if(p.hr>maxHR) maxHR=p.hr; }
      if(p.watt!=null){ sumW+=p.watt; cntW++; }
      if(last){ const dt=(p.ts-last.ts)/1000; const gradeFrac=(p.grade||0)/100; const dh=(p.speed_ms||0)*gradeFrac*dt; if(dh>0) elev+=dh; const hr=p.hr||0; const ifHr=LTHR>0? (hr/LTHR):0; tss += (dt/3600)*(ifHr*ifHr)*100; }
      last=p; }
    return { dur, dist, elev:Math.round(elev), avgHR: cntHR? Math.round(sumHR/cntHR):0, maxHR: Math.round(maxHR), avgW: cntW? Math.round(sumW/cntW):0, tss: Math.round(tss) };
  }

  function renderSummary(){
    const s = SESSION; const sum = computeSummary(s); const when = new Date(s.startedAt||Date.now());
    const name = s.name || 'Økt'; const reps = s.reps||0;
    $('summary').innerHTML = `\n      <div><strong>${name}</strong></div>\n      <div class="small">${when.toLocaleString()}</div>\n      <ul class="small" style="margin:8px 0 0 16px;line-height:1.6">\n        <li>Varighet: ${mmss(sum.dur)}</li>\n        <li>Distanse: ${(isFinite(sum.dist)? sum.dist.toFixed(2):'0.00')} km</li>\n        <li>Høydemeter: ${sum.elev} m</li>\n        <li>Snitt HR: ${sum.avgHR||'–'} bpm · Maks HR: ${sum.maxHR||'–'} bpm</li>\n        <li>Snitt Watt: ${sum.avgW||'–'} W</li>\n        <li>Antall drag: ${reps}</li>\n        <li>TSS: ${sum.tss}</li>\n      </ul>`;
    $('notes').value = s.notes || '';
  }

  function toTCX(s){
    const pts = Array.isArray(s.points)? s.points: [];
    if(!pts.length) return '';
    const esc = (x)=> String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;');
    const t0 = new Date(s.startedAt||Date.now()).toISOString();
    const totalSec = Math.max(1, Math.round((new Date(s.endedAt||s.startedAt)-new Date(s.startedAt))/1000));
    const distM = (pts[pts.length-1]?.dist_m||0).toFixed(1);
    const hdr = `<?xml version="1.0" encoding="UTF-8"?>\n<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">\n  <Activities><Activity Sport="Running">\n    <Id>${esc(t0)}</Id>\n    <Lap StartTime="${esc(t0)}">\n      <TotalTimeSeconds>${totalSec}</TotalTimeSeconds>\n      <DistanceMeters>${distM}</DistanceMeters>\n      <Intensity>Active</Intensity>\n      <Track>`;
    const trk = pts.map(p=>`\n        <Trackpoint>\n          <Time>${esc(new Date(p.ts).toISOString())}</Time>\n          <DistanceMeters>${Number(p.dist_m||0).toFixed(1)}</DistanceMeters>\n          <HeartRateBpm><Value>${Math.max(0,Math.round(p.hr||0))}</Value></HeartRateBpm>\n        </Trackpoint>`).join('');
    const ftr = `\n      </Track>\n    </Lap>\n  </Activity></Activities>\n</TrainingCenterDatabase>`;
    return hdr+trk+ftr;
  }

  function setupButtons(){
    const hint = $('no-points-hint');
    const hasPoints = Array.isArray(SESSION.points) && SESSION.points.length>0;
    if(hint) hint.style.display = hasPoints? 'none':'inline';

    $('btn-download-tcx')?.addEventListener('click', async ()=>{
      try{
        const has = Array.isArray(SESSION.points) && SESSION.points.length>0;
        if(!has){
          const cid = SESSION?.id || location.hash.slice(1) || '';
          if(!cid){ alert('Ingen data i økta, og fant ikke økt-ID.'); return; }
          if(typeof window.downloadTCXFromCloud === 'function'){
            await window.downloadTCXFromCloud(cid);
          } else {
            alert('TCX‑fallback ikke tilgjengelig.');
          }
          return;
        }
        const xml = toTCX(SESSION);
        if(!xml){ alert('Ingen data i økta.'); return; }
        const name = (SESSION.name||'okt')+'.tcx';
        const blob=new Blob([xml],{type:'application/vnd.garmin.tcx+xml'});
        const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
      }catch(e){ showErr(e); alert('TCX-eksport feilet. Se feilpanel.'); }
    });

    $('btn-dump-json')?.addEventListener('click', ()=>{
      try{
        const a=document.createElement('a');
        a.href=URL.createObjectURL(new Blob([JSON.stringify(SESSION,null,2)],{type:'application/json'}));
        a.download=(SESSION.name||'okt')+'.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
      }catch(e){ showErr(e); }
    });

    $('save-notes')?.addEventListener('click', ()=>{
      try{ const arr=getNS('sessions',[]); const idx=arr.findIndex(x=>x.id===SESSION.id); if(idx>=0){ arr[idx] = { ...arr[idx], notes:$('notes').value||'' }; setNS('sessions', arr); alert('Lagret merknader.'); } }
      catch(e){ showErr(e); }
    });
  }

  function init(){
    try{
      SESSION = pickSession(); window.currentSession = SESSION;
      if(!SESSION){ $('no-session').classList.remove('hidden'); return; }
      $('result-summary-card').classList.remove('hidden');
      renderSummary();
      setupButtons();
      // Graf/laps rendering kan legges til her senere; nå fokuserer vi på fallback og metadata.
    }catch(e){ showErr(e); }
  }
  document.addEventListener('DOMContentLoaded', init);
})();
