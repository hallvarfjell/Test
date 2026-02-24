
// Result module v1.3.9 – adds Incline per drag, horizontal bar chart of time-in-zones, fixes name persistence

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

function timeInZones(hrSeries){
  const s = Storage.loadP(AppState.currentProfile,'settings',{}); const max=s.HRmax||s.hrmax||190; const zones=s.zones||[
    {name:'S0', from:0.50, to:0.60, color:'#e9ecef'},
    {name:'S1', from:0.60, to:0.725, color:'#d6ecff'},
    {name:'S2', from:0.725,to:0.825, color:'#d9f5d6'},
    {name:'S3', from:0.825,to:0.875, color:'#fff2b3'},
    {name:'S4', from:0.875,to:0.925, color:'#ffe0b8'},
    {name:'S5', from:0.925,to:1.000, color:'#ffd1d1'}
  ];
  const acc = zones.map(z=>({name:z.name,color:z.color,sec:0}));
  for(let i=1;i<(hrSeries||[]).length;i++){
    const dt = Math.max(0, hrSeries[i].t - hrSeries[i-1].t);
    const hr = hrSeries[i].bpm||0; const frac = (hr)/(max||190);
    const idx = zones.findIndex(z=> frac>=z.from && frac<=(z.to+1e-6));
    if(idx>=0) acc[idx].sec += dt;
  }
  return acc; // array with sec per zone
}

function drawZoneBars(canvas, data){
  const ctx=canvas.getContext('2d'); const W=canvas.width=600, H=canvas.height=180; ctx.clearRect(0,0,W,H);
  const total = data.reduce((a,b)=>a+b.sec,0)||1; const rowH = 24, left=120, right=W-20, top=10;
  ctx.font='12px system-ui'; ctx.fillStyle='#0b1220';
  data.forEach((z,i)=>{ const y=top + i*rowH; ctx.fillStyle='#0b1220'; ctx.fillText(`${z.name}`, 20, y+14);
    const w = Math.max(1, Math.round((z.sec/total)*(right-left)));
    ctx.fillStyle = z.color; ctx.fillRect(left, y, w, 16);
    ctx.fillStyle='#0b1220'; ctx.fillText(`${Math.round(z.sec/60)} min`, left+w+6, y+14);
  });
}

const Result = { render(el, st){
  el.innerHTML=''; const params = new URLSearchParams(location.hash.split('?')[1]||''); const id = params.get('id'); const s = (st.logg||[]).find(x=>x.id===id) || st.logg?.slice().pop(); if(!s){ el.textContent='Fant ikke økta.'; return; }
  const head = UI.h('div',{class:'card'}); head.append(UI.h('h2',{}, `Resultat – ${s.name}`), UI.h('div',{}, `Slutt: ${new Date(s.endedAt).toLocaleString()}`)); el.append(head);

  // Graph
  const gwrap = UI.h('div',{class:'card'}); const c=document.createElement('canvas'); c.style.width='100%'; c.width=900; c.height=260; drawComboGraph(c, s.hrSeries||[], s.spdSeries||[]); gwrap.append(UI.h('h3',{},'Puls (90–190) & Fart (0–20)'), c); el.append(gwrap);

  // Per-drag tabell (legg inn stigning etter fart)
  const tCard = UI.h('div',{class:'card'}); tCard.append(UI.h('h3',{},'Per drag'));
  const tbl=document.createElement('table'); tbl.className='table'; tbl.innerHTML='<tr><th>#</th><th>HR</th><th>Fart (km/t)</th><th>Stigning (%)</th><th>Watt</th><th>RPE</th></tr>';
  (s.perDrag||[]).forEach((d,i)=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${i+1}</td><td>${d.hr??'-'}</td><td>${d.spd??'-'}</td><td>${d.inc??'-'}</td><td>${d.watt??'-'}</td><td>${(d.rpe??'-')}</td>`; tbl.appendChild(tr); }); tCard.append(tbl); el.append(tCard);

  // Tid i soner (liggende stolper)
  const zCard = UI.h('div',{class:'card'}); zCard.append(UI.h('h3',{},'Tid i pulssoner'));
  const cz=document.createElement('canvas'); cz.width=600; cz.height=180; cz.style.width='100%'; const data=timeInZones(s.hrSeries||[]); drawZoneBars(cz, data); zCard.append(cz); el.append(zCard);
}};
