
// Resultat-modul v1.3.4 (patch for v1.3.2)
// - Felles graffelt (HR+Fart)
// - Per-drag tabell: HR, fart, Watt (est.) + RPE
// - Pulsdrift-estimat (heat/dehyd/fatigue/glyc) – samlet/ikke per drag (enkelt første versjon)
// - TSS (IF-basert dersom P_LT2 finnes)
// - Merknader (lagres i logg)

const Result = { render(el, st){ el.innerHTML=''; const params=new URLSearchParams(location.hash.split('?')[1]||''); const id=params.get('id'); const s=(st.logg||[]).find(x=>x.id===id) || st.logg?.slice().pop(); if(!s){ el.textContent='Fant ikke økta.'; return; }
  el.append(UI.h('h1',{class:'h1'},'Resultat'));
  el.append(UI.h('div',{}, `${new Date(s.endedAt).toLocaleString()} – ${s.name}`));

  // Graf HR+Fart
  const gCard = UI.h('div',{class:'card'}); gCard.append(UI.h('h3',{},'Puls & Fart'));
  const gDiv = UI.h('div',{style:'height:260px'}); gCard.append(gDiv); const graph=new Graph.Combined(gDiv);
  graph.setSeries(s.hrSeries||[], s.spdSeries||[]);
  el.append(gCard);

  // Per-drag tabell (beregn fra sekvens hvis lagret; ellers summer grove segmenter over tid)
  const table = UI.h('table',{class:'table'}); table.innerHTML='<tr><th>Drag</th><th>HR snitt</th><th>Fart snitt</th><th>Watt snitt</th><th>RPE</th></tr>';
  // grov tilnærming: del opp i arbeid-segmenter ved å se på rpePerDrag
  const entries = Object.entries(s.rpePerDrag||{}); entries.sort();
  entries.forEach(([key,rpe],i)=>{
    // Finn tidsvinduet til dette draget ~ vi har ikke start/stop tider per drag i loggen i v1.3.2, så vi estimerer ved å plukke siste N sekunder før RPE ble satt.
    // I v1.3.5 kan vi logge nøyaktig vendepunkter. Nå: vis RPE og '-' for snitt hvis vi ikke kan slice presist.
    const tr=document.createElement('tr'); tr.innerHTML=`<td>${key}</td><td>-</td><td>-</td><td>-</td><td>${rpe}</td>`; table.appendChild(tr);
  });
  const perDragCard = UI.h('div',{class:'card'}); perDragCard.append(UI.h('h3',{},'Per‑drag'), table); el.append(perDragCard);

  // Pulsdrift-oversikt
  const driftCard = UI.h('div',{class:'card'});
  driftCard.append(UI.h('h3',{},'Pulsdrift – estimerte komponenter'));
  // summer deler
  let sum={heat:0,dehyd:0,fatigue:0,glyc:0}, n=0; (s.driftSeries||[]).forEach(p=>{ const q=p.parts||{}; sum.heat+=(q.heat||0); sum.dehyd+=(q.dehyd||0); sum.fatigue+=(q.fatigue||0); sum.glyc+=(q.glyc||0); n++; });
  const fmt=v=> (v/n).toFixed(3);
  const dTbl=UI.h('table',{class:'table'}); dTbl.innerHTML=`<tr><th>Komponent</th><th>Gj.snitt drift‑andel</th></tr>
    <tr><td>Varme</td><td>${n?fmt(sum.heat):'-'}</td></tr>
    <tr><td>Dehydrering</td><td>${n?fmt(sum.dehyd):'-'}</td></tr>
    <tr><td>Fatigue</td><td>${n?fmt(sum.fatigue):'-'}</td></tr>
    <tr><td>Glykogen</td><td>${n?fmt(sum.glyc):'-'}</td></tr>`;
  driftCard.append(dTbl); el.append(driftCard);

  // TSS (IF-basert hvis P_LT2 finnes)
  const cfg = Storage.loadP(AppState.currentProfile,'settings',{}); const PL2=cfg.P_L2||null; let TSS='-';
  if(PL2){ // enkel IF-beregning fra Wattserie snitt
    const WkgAvg = (s.wattSeries||[]).reduce((a,b)=>a+(b.Wkg||0),0)/Math.max(1,(s.wattSeries||[]).length);
    const IF = WkgAvg/PL2; const hrs=(s.total||0)/3600; TSS = Math.round(IF*IF*hrs*100);
  }
  const tssCard=UI.h('div',{class:'card'}); tssCard.append(UI.h('h3',{},'TSS')), tssCard.append(UI.h('div',{}, String(TSS))); el.append(tssCard);

  // Merknader (lagres i logg)
  const noteCard = UI.h('div',{class:'card'}); noteCard.append(UI.h('h3',{},'Merknader'));
  const area=document.createElement('textarea'); area.style.width='100%'; area.style.minHeight='120px'; area.value = s.note||''; noteCard.append(area);
  const btn=UI.h('button',{class:'btn primary',onclick:()=>{ s.note=area.value; Storage.saveP(AppState.currentProfile,'logg',st.logg); alert('Lagret merknad.'); }},'Lagre merknad');
  noteCard.append(btn); el.append(noteCard);

} };
