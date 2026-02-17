const Result = { render(el, st){ el.innerHTML=''; const params = new URLSearchParams(location.hash.split('?')[1]||''); const id = params.get('id'); const s = (st.logg||[]).find(x=>x.id===id) || st.logg?.slice().pop(); if(!s){ el.textContent='Fant ikke økta.'; return; } const card = UI.h('div',{class:'card'}); const h = UI.h('h2',{}, `Resultat – ${s.name}`); const t = UI.h('div',{}, `Slutt: ${new Date(s.endedAt).toLocaleString()}`);
 // KPI
 const kpi = UI.h('div',{class:'list'});
 kpi.appendChild(UI.h('div',{class:'list-item'}, `Totaltid: ${UI.fmtTime(s.total||0)}`));
 kpi.appendChild(UI.h('div',{class:'list-item'}, `Distanse: ${(s.dist||0).toFixed(2)} km`));
 if(s.water!=null) kpi.appendChild(UI.h('div',{class:'list-item'}, `Vann: ${s.water} × 0,1 L`));
 if(s.carbs!=null) kpi.appendChild(UI.h('div',{class:'list-item'}, `Karbo: ${s.carbs} porsjoner`));
 // Grafer (HR/SPD)
 const gwrap = UI.h('div',{class:'card'});
 const c1=document.createElement('canvas'); c1.width=900; c1.height=220; const g1=c1.getContext('2d');
 const c2=document.createElement('canvas'); c2.width=900; c2.height=220; const g2=c2.getContext('2d');
 function drawLine(ctx, series, xKey, yKey, color, xMax){ ctx.clearRect(0,0,ctx.canvas.width, ctx.canvas.height); const W=ctx.canvas.width, H=ctx.canvas.height; if(!series||!series.length) return; const t0=series[0][xKey]; const t1=xMax || series[series.length-1][xKey]; ctx.strokeStyle=color; ctx.lineWidth=2; ctx.beginPath(); series.forEach((p,i)=>{ const x=( (p[xKey]-t0)/(t1-t0) )* (W-40) + 20; const y=H-20 - (p[yKey])*(H-40)/ ( (yKey==='bpm')? (Math.max(170, ...series.map(s=>s[yKey])) - 60): (Math.max(25, ...series.map(s=>s[yKey])) ) ); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }); ctx.stroke(); ctx.strokeStyle='#b4c4e8'; ctx.strokeRect(20,10,W-40,H-30); }
 if(s.hrSeries && s.hrSeries.length){ drawLine(g1, s.hrSeries, 't','bpm','#d93c3c'); }
 if(s.spdSeries && s.spdSeries.length){ drawLine(g2, s.spdSeries, 't','kmh','#d6a600'); }
 gwrap.append(UI.h('h3',{},'Puls (bpm)'), c1, UI.h('h3',{},'Fart (km/t)'), c2);
 card.append(h,t, UI.h('h3',{},'Oppsummering'), kpi, UI.h('h3',{},'Grafer'), gwrap);
 el.append(UI.h('h1',{class:'h1'},'Resultat'), card); } };
