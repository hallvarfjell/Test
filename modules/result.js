
// Result module v1.3.6 – combined HR/speed graph, per-drag table (HR, speed, watt, RPE), TSS, notes

function drawComboGraph(canvas, hrSeries, spdSeries){
  const ctx=canvas.getContext('2d'); const W=canvas.width=900, H=canvas.height=260; ctx.clearRect(0,0,W,H); ctx.strokeStyle='#b4c4e8'; ctx.strokeRect(40,10,W-60,H-30);
  if(!(hrSeries&&hrSeries.length) && !(spdSeries&&spdSeries.length)) return;
  const t0 = Math.min(hrSeries?.[0]?.t||Infinity, spdSeries?.[0]?.t||Infinity);
  const t1 = Math.max(hrSeries?.[hrSeries.length-1]?.t||0, spdSeries?.[spdSeries.length-1]?.t||0);
  // HR
  if(hrSeries&&hrSeries.length){ ctx.strokeStyle='#d93c3c'; ctx.lineWidth=2; ctx.beginPath(); hrSeries.forEach((p,i)=>{ const x=40+((p.t-t0)/(t1-t0))*(W-60); const y=10+(1-((p.bpm-90)/100))*(H-30); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);}); ctx.stroke(); }
  // Speed
  if(spdSeries&&spdSeries.length){ ctx.strokeStyle='#d6a600'; ctx.lineWidth=2; ctx.beginPath(); spdSeries.forEach((p,i)=>{ const x=40+((p.t-t0)/(t1-t0))*(W-60); const y=10+(1-(p.kmh/20))*(H-30); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);}); ctx.stroke(); }
  // labels
  ctx.fillStyle='#0b1220'; ctx.font='12px system-ui'; [90,110,130,150,170,190].forEach(v=>{ const y=10+(1-((v-90)/100))*(H-30); ctx.fillText(v.toString(), 8, y+4); }); [0,5,10,15,20].forEach(v=>{ const y=10+(1-(v/20))*(H-30); ctx.fillText(v.toString(), W-28, y+4); });
}

function computeTSS(session){
  const settings = Storage.loadP(AppState.currentProfile,'settings',{}); const P2 = settings.P_L2||null; if(!P2) return null; // need LT2 W/kg
  // Time-weighted IF^2 over session using speed series
  const mass=settings.mass||75, met=settings.met_eff||0.25; const shoe=(1-(settings.shoe_gain_pct||0)/100), tm=settings.tm_cal||1;
  function Wkg(spd,inc){ const v=spd/3.6, i=(inc||0)/100; return (4.185*v + (9.81*v*i)/met)*shoe*tm; }
  const sp=session.spdSeries||[]; const inc=Object.fromEntries((session.incSeries||[]).map(p=>[Math.round(p.t),p.pct])); if(!sp.length) return null;
  let load=0; for(let i=1;i<sp.length;i++){ const dt=Math.max(0, sp[i].t - sp[i-1].t); const incPct = inc[Math.round(sp[i].t)]||0; const IF = Wkg(sp[i].kmh, incPct)/P2; load += dt * (IF*IF); }
  const hours = (session.total||0)/3600; const tss = (load/ (session.total||1)) * (session.total) / 3600 * 100; // ≈ IF^2 * h * 100
  return Math.round(tss);
}

const Result = { render(el, st){
  el.innerHTML=''; const params = new URLSearchParams(location.hash.split('?')[1]||''); const id = params.get('id'); const s = (st.logg||[]).find(x=>x.id===id) || st.logg?.slice().pop(); if(!s){ el.textContent='Fant ikke økta.'; return; }
  const head = UI.h('div',{class:'card'}); head.append(UI.h('h2',{}, `Resultat – ${s.name}`), UI.h('div',{}, `Slutt: ${new Date(s.endedAt).toLocaleString()}`)); el.append(head);

  // Graph
  const gwrap = UI.h('div',{class:'card'}); const c=document.createElement('canvas'); c.style.width='100%'; c.width=900; c.height=260; drawComboGraph(c, s.hrSeries||[], s.spdSeries||[]); gwrap.append(UI.h('h3',{},'Puls (90–190) & Fart (0–20)'), c); el.append(gwrap);

  // Per-drag tabell
  const tCard = UI.h('div',{class:'card'}); tCard.append(UI.h('h3',{},'Per drag'));
  const tbl=document.createElement('table'); tbl.className='table'; tbl.innerHTML='<tr><th>#</th><th>HR</th><th>Fart (km/t)</th><th>Watt</th><th>RPE</th></tr>';
  (s.perDrag||[]).forEach((d,i)=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${i+1}</td><td>${d.hr??'-'}</td><td>${d.spd??'-'}</td><td>${d.watt??'-'}</td><td>${(d.rpe??'-')}</td>`; tbl.appendChild(tr); }); tCard.append(tbl); el.append(tCard);

  // TSS + Notater
  const extras = UI.h('div',{class:'card'}); const tss=computeTSS(s); extras.append(UI.h('h3',{},'Oppsummering'));
  const ul=document.createElement('ul'); ul.style.margin='0'; ul.style.paddingLeft='1.1rem'; ul.appendChild(UI.h('li',{},`Totaltid: ${UI.fmtTime(s.total||0)}`)); ul.appendChild(UI.h('li',{},`Distanse: ${(s.dist||0).toFixed(2)} km`)); if(tss!=null) ul.appendChild(UI.h('li',{},`TSS: ${tss}`)); extras.append(ul);
  extras.append(UI.h('h3',{},'Merknader')); const notes = UI.h('textarea',{style:'width:100%;min-height:80px;border:1px solid #c9d6f0;border-radius:8px;padding:.5rem;'}); notes.value=s.notes||''; const saveN=UI.h('button',{class:'btn primary',onclick:()=>{ s.notes=notes.value; Storage.saveP(AppState.currentProfile,'logg', st.logg); alert('Merknader lagret.'); }},'Lagre merknader'); extras.append(notes, UI.h('div',{class:'controls'}, saveN)); el.append(extras);
}};
