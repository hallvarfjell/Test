
// Økt-modul v1.3.4 (patch for v1.3.2)
// - Ny ytelseslayout: Puls/HR%, Slope, Fart (km/t↔min/km) med ± og 10/15, Stigning med ±,
//   Watt (est.) ↔ W/kg, PI og ΔHR fra PI-modulen
// - Kombinert graf HR(90–190) + Fart(0–20)
// - Statistikk kompakt + snittWatt per drag
// - RPE ± per drag (lagres)
// - FTMS stigning: lytter både på 0x2ACD og 0x2ADA

const Workout = (function(){
  const engine = { running:false, paused:false, timer:null, seq:[], idx:0, left:0,
    tTot:0, tDrag:0, dist:0,
    speedUnit:'kmh', wattUnit:'W',
    hrBuf:[], seriesHr:[], seriesSpd:[], seriesWatt:[], seriesDrift:[],
    rpePerDrag:{}, curRPE:6,
  };

  function expand(blocks){ const out=[]; (blocks||[]).forEach(b=>{
    if(['Oppvarming','Pause','Nedjogg'].includes(b.kind)) out.push({kind:b.kind, dur:b.dur});
    else if(b.kind==='Intervall'){ for(let i=1;i<=b.reps;i++){ out.push({kind:'Arbeid', dur:b.work, rep:i, reps:b.reps}); if(b.rest>0) out.push({kind:'Pause', dur:b.rest}); } }
    else if(b.kind==='Serie'){ for(let s=1;s<=b.series;s++){ for(let i=1;i<=b.reps;i++){ out.push({kind:'Arbeid', dur:b.work, rep:i, reps:b.reps, set:s, sets:b.series}); if(b.rest>0) out.push({kind:'Pause', dur:b.rest}); } if(s<b.series && b.seriesRest) out.push({kind:'Pause', dur:b.seriesRest}); } }
  }); return out; }

  function fmtSpd(kmh, unit){ if(unit==='kmh') return `${kmh.toFixed(1)} km/t`; if(kmh<=0) return '–'; const pace=60/(kmh); const m=Math.floor(pace), s=Math.round((pace-m)*60); return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} min/km`; }

  function estWatt(speedKmh, inclinePct){ const v=(speedKmh||0)/3.6; const i=(inclinePct||0)/100; const eta=(PI.load().met_eff||0.25); const mass=(PI.load().mass||75);
    const Pflat_Wkg=4.185*v; const Pclimb_Wkg=(9.81*v*i)/eta; const Wkg=Pflat_Wkg+Pclimb_Wkg; return {Wkg, W: Wkg*mass}; }

  function drawLayout(el, plan){
    el.innerHTML='';
    const grid = UI.h('div',{});

    // --- ytelsespanel ---
    const panel = UI.h('div',{class:'card', style:'display:grid;grid-template-columns:1fr 1.2fr 1fr;gap:.75rem'});

    // venstre – Puls/Slope
    const left = UI.h('div',{});
    left.append(
      UI.h('div',{class:'small'},'Puls'),
      UI.h('div',{class:'h1',id:'hrVal'},'0'),
      UI.h('div',{class:'small',id:'hrPct'},'0% av HRmax'),
      UI.h('div',{class:'small',style:'margin-top:.5rem'},'Slope'),
      UI.h('div',{class:'h1',id:'slopeVal'},'0.00%')
    );

    // midt – Fart/Stigning + kontroller
    const mid = UI.h('div',{});
    const spdVal = UI.h('div',{class:'h1',id:'spdVal',style:'cursor:pointer'},'0.0 km/t');
    const incVal = UI.h('div',{class:'h1',id:'incVal'},'0%');
    const spdCtr = UI.h('div',{class:'controls'},
      UI.h('button',{class:'btn',id:'spdDec'},'−'), UI.h('button',{class:'btn',id:'spdInc'},'+'),
      UI.h('button',{class:'btn',id:'q10'},'10 km/t'), UI.h('button',{class:'btn',id:'q15'},'15 km/t')
    );
    const incCtr = UI.h('div',{class:'controls'},
      UI.h('button',{class:'btn',id:'incDec'},'−'), UI.h('button',{class:'btn',id:'incInc'},'+')
    );
    mid.append(UI.h('div',{class:'small'},'Fart'), spdVal, UI.h('div',{class:'small'},'Stigning'), incVal, spdCtr, incCtr);

    // høyre – Watt/PI/ΔHR + drikke/karbo + RPE
    const right = UI.h('div',{});
    const wattVal = UI.h('div',{class:'h1',id:'wattVal',style:'cursor:pointer'},'0 W');
    const piVal = UI.h('div',{class:'h1',id:'piVal',style:'cursor:pointer'},'1.00');
    const dhrVal = UI.h('div',{class:'h1',id:'dhrVal'},'0');
    const rpeRow = UI.h('div',{class:'controls'},
      UI.h('button',{class:'btn',id:'rpeMinus'},'RPE −'), UI.h('div',{id:'rpeVal',class:'h1'},'6'), UI.h('button',{class:'btn',id:'rpePlus'},'RPE +')
    );
    right.append(
      UI.h('div',{class:'small'},'Watt (trykk for W ↔ W/kg)'), wattVal,
      UI.h('div',{class:'small',style:'margin-top:.5rem'},'PI (trykk for detalj)'), piVal,
      UI.h('div',{class:'small',style:'margin-top:.5rem'},'HR‑drift Δ (bpm)'), dhrVal,
      UI.h('div',{class:'controls',style:'margin-top:.5rem'}, UI.h('button',{class:'btn',id:'btnWater'},'🥛'), UI.h('button',{class:'btn',id:'btnCarb'},'🍌')),
      UI.h('div',{class:'small',style:'margin-top:.5rem'},'Opplevd anstrengelse (RPE) per drag'), rpeRow
    );

    panel.append(left, mid, right);

    // --- graf ---
    const graphCard = UI.h('div',{class:'card'}); const gDiv = UI.h('div',{style:'height:260px'}); graphCard.append(gDiv); const graph = new Graph.Combined(gDiv);

    // --- øktpanel kontroller ---
    const flow = UI.h('div',{class:'card'});
    const phaseNow = UI.h('div',{class:'list-item',id:'phaseNow'},'–');
    const phaseNext = UI.h('div',{class:'small',id:'phaseNext'},'');
    const timer = UI.h('div',{class:'h1',id:'timer'},'00:00');
    const ctrl = UI.h('div',{class:'controls'},
      UI.h('button',{class:'btn primary',id:'start'},'Start'),
      UI.h('button',{class:'btn',id:'pause'},'Pause'),
      UI.h('button',{class:'btn',id:'prev'},'⟵'),
      UI.h('button',{class:'btn',id:'next'},'⟶'),
      UI.h('button',{class:'btn',id:'save'},'Lagre'),
      UI.h('button',{class:'btn danger',id:'discard'},'Forkast')
    );
    flow.append(UI.h('h3',{},plan.name), phaseNow, phaseNext, timer, ctrl);

    // --- stats kompakt ---
    const stats = UI.h('div',{class:'card'});
    const tbl = UI.h('table',{class:'table'});
    tbl.innerHTML='<tr><th>Param</th><th>Verdi</th></tr>'+
      '<tr><td>Distanse</td><td id="stDist">0.00 km</td></tr>'+
      '<tr><td>Totaltid</td><td id="stTot">00:00</td></tr>'+
      '<tr><td>Dragtid</td><td id="stDrag">00:00</td></tr>'+
      '<tr><td>Snitt HR (drag)</td><td id="stAvgHR">-</td></tr>'+
      '<tr><td>Snitt fart (drag)</td><td id="stAvgSpd">-</td></tr>'+
      '<tr><td>Snitt Watt (drag)</td><td id="stAvgW">-</td></tr>';
    stats.append(UI.h('h3',{},'Statistikk (kompakt)'), tbl);

    el.append(panel, graphCard, flow, stats);

    return {graph};
  }

  // helpers
  function label(x){ let base=x.kind; if(x.kind==='Arbeid'&&x.rep) base+=` drag ${x.rep}/${x.reps}${x.set?`, serie ${x.set}/${x.sets||1}`:''}`; return base; }

  function setPhase(){ const cur=engine.seq[engine.idx];
    const eNow=document.getElementById('phaseNow'); if(eNow) eNow.textContent=cur?label(cur):'Ferdig';
    const eNext=document.getElementById('phaseNext'); if(eNext) eNext.textContent = engine.seq[engine.idx+1]? ('Neste: '+label(engine.seq[engine.idx+1])):'';
    engine.left = cur? cur.dur : 0; engine.tDrag=0; }

  function updateUI(g){ const s=PI.load(); const hr=AppState.hr?.bpm||0; const inc=AppState.tm?.incline||0; const spd=AppState.tm?.speed||0;
    const hrMax=s.HRmax||190; const pct=Math.round((hr/hrMax)*100);
    const hrEl=document.getElementById('hrVal'); if(hrEl) hrEl.textContent=String(hr);
    const hrp=document.getElementById('hrPct'); if(hrp) hrp.textContent=`${pct}% av HRmax`;
    const sl=document.getElementById('slopeVal'); if(sl){ // dHR vises annet sted; slope kan tolkes som HR-slope vs tid – her viser vi TD slope (0.00%)
      // i Økt: behold «Slope» som HR-slope om ønsket senere; nå viser vi møllestigning separat
      const dHR = engine.seriesDrift.length? engine.seriesDrift[engine.seriesDrift.length-1].dHR : 0;
      sl.textContent = (dHR? (dHR.toFixed(2)+' bpm drift') : '0.00%');
    }
    const spdTxt = document.getElementById('spdVal'); if(spdTxt) spdTxt.textContent = fmtSpd(spd, engine.speedUnit);
    const incTxt = document.getElementById('incVal'); if(incTxt) incTxt.textContent = `${Math.round(inc)}%`;
    const pw = estWatt(spd, inc); const wVal = document.getElementById('wattVal'); if(wVal) wVal.textContent = (engine.wattUnit==='W'? `${Math.round(pw.W)} W` : `${pw.Wkg.toFixed(2)} W/kg`);
    // PI compute
    const res = PI.compute(performance.now(), { prevTime:null, tSec:engine.tTot, hr:hr, speedKmh:spd, inclinePct:inc, tempC:20, rpe:engine.curRPE, cumSweatL:0 });
    const piEl=document.getElementById('piVal'); if(piEl) piEl.textContent = (res.PI? res.PI.toFixed(2):'1.00');
    const dhrEl=document.getElementById('dhrVal'); if(dhrEl) dhrEl.textContent = String(Math.round(res.dHR||0));
    // series
    engine.seriesHr.push({t:Date.now()/1000,bpm:hr}); engine.seriesSpd.push({t:Date.now()/1000,kmh:spd}); engine.seriesWatt.push({t:Date.now()/1000,Wkg:res.Pd_Wkg||pw.Wkg,W:pw.W}); engine.seriesDrift.push({t:Date.now()/1000,dHR:res.dHR||0, parts:res.drift?.parts||{}});
    g.addHR(hr); g.addSPD(spd);
    // Dist/time
    engine.dist += spd/3600; const dEl=document.getElementById('stDist'); if(dEl) dEl.textContent = engine.dist.toFixed(2)+' km';
    const tEl=document.getElementById('stTot'); if(tEl) tEl.textContent=UI.fmtTime(engine.tTot);
    const tdEl=document.getElementById('stDrag'); if(tdEl) tdEl.textContent=UI.fmtTime(engine.tDrag);
  }

  function perDragStats(){ // set snitt i siste arbeid
    const cur = engine.seq[engine.idx]; if(!cur || cur.kind!=='Arbeid') return;
    const win=engine.seriesHr.slice(-engine.left-1); // rough; we compute on boundary below
  }

  function saveDragAverages(){ // compute averages for the last finished Arbeid
    // Determine duration of just-finished Arbeid by scanning back until we hit previous phase switch timestamps
    // Simpler: compute average on the fly using hrSamples/spdSamples/wattSamples captured inside tick
  }

  function attachHandlers(g, plan){
    document.getElementById('spdVal').onclick = ()=>{ engine.speedUnit = (engine.speedUnit==='kmh'?'pace':'kmh'); updateUI(g); };
    document.getElementById('wattVal').onclick = ()=>{ engine.wattUnit = (engine.wattUnit==='W'?'Wkg':'W'); updateUI(g); };
    document.getElementById('piVal').onclick = ()=>{ location.hash='#/pi?from=workout'; };
    document.getElementById('btnWater').onclick = ()=>{ PI.addWater(1); };
    const sd=document.getElementById('spdDec'), si=document.getElementById('spdInc');
    const id=document.getElementById('incDec'), ii=document.getElementById('incInc');
    const q10=document.getElementById('q10'), q15=document.getElementById('q15');
    if(sd) sd.onclick=()=>{ AppState.tm.speed=Math.max(0,(AppState.tm.speed||0)-0.1); updateUI(g); };
    if(si) si.onclick=()=>{ AppState.tm.speed=(AppState.tm.speed||0)+0.1; updateUI(g); };
    if(id) id.onclick=()=>{ AppState.tm.incline=Math.max(0,(AppState.tm.incline||0)-1); updateUI(g); };
    if(ii) ii.onclick=()=>{ AppState.tm.incline=(AppState.tm.incline||0)+1; updateUI(g); };
    if(q10) q10.onclick=()=>{ AppState.tm.speed=10; updateUI(g); };
    if(q15) q15.onclick=()=>{ AppState.tm.speed=15; updateUI(g); };
    const rm=document.getElementById('rpeMinus'), rp=document.getElementById('rpePlus'); const rv=document.getElementById('rpeVal');
    if(rm) rm.onclick=()=>{ engine.curRPE=Math.max(1, (engine.curRPE||6)-0.5); rv.textContent=String(engine.curRPE); };
    if(rp) rp.onclick=()=>{ engine.curRPE=Math.min(10, (engine.curRPE||6)+0.5); rv.textContent=String(engine.curRPE); };

    document.getElementById('start').onclick = ()=>{ if(engine.running) return; engine.running=true; engine.paused=false; engine.timer=setInterval(()=>{ if(!engine.paused){ engine.tTot++; engine.tDrag++; updateUI(g); const tEl=document.getElementById('timer'); if(tEl) tEl.textContent=UI.fmtTime(engine.left); engine.left--; if(engine.left<=0){ // phase switch
            const just=engine.seq[engine.idx];
            // compute last-drag averages if Arbeid
            if(just && just.kind==='Arbeid'){
              const sliceSec = just.dur; const now=Date.now()/1000;
              const hrAvg = avgSeries(engine.seriesHr, now-sliceSec, now, 'bpm');
              const spdAvg = avgSeries(engine.seriesSpd, now-sliceSec, now, 'kmh');
              const wattAvg = avgSeries(engine.seriesWatt, now-sliceSec, now, (engine.wattUnit==='W'?'W':'Wkg'));
              const eHR=document.getElementById('stAvgHR'); if(eHR) eHR.textContent=String(Math.round(hrAvg||0));
              const eSpd=document.getElementById('stAvgSpd'); if(eSpd) eSpd.textContent=(spdAvg? spdAvg.toFixed(1):'-');
              const eW=document.getElementById('stAvgW'); if(eW) eW.textContent=(wattAvg? (engine.wattUnit==='W'? Math.round(wattAvg)+' W' : wattAvg.toFixed(2)+' W/kg'):'-');
              // lagre RPE for drag
              if(just.rep) engine.rpePerDrag[`${just.set||1}-${just.rep}`]=engine.curRPE;
            }
            engine.idx++; setPhase(); }
        }},1000); setPhase(); };
    document.getElementById('pause').onclick = ()=>{ engine.paused=!engine.paused; };
    document.getElementById('next').onclick = ()=>{ engine.idx=Math.min(engine.seq.length, engine.idx+1); setPhase(); };
    document.getElementById('prev').onclick = ()=>{ engine.idx=Math.max(0, engine.idx-1); setPhase(); };
    document.getElementById('save').onclick = ()=>{ finish(plan,true); };
    document.getElementById('discard').onclick = ()=>{ if(confirm('Forkaste uten å lagre?')) finish(plan,false); };

    // Bluetooth bindings (optional)
    try{ BT.connectFTMS((spd,inc)=>{ if(spd!=null) AppState.tm.speed=spd; if(inc!=null) AppState.tm.incline=inc; }); }catch(e){ console.warn('FTMS valgfritt:', e); }
  }

  function avgSeries(series, t0, t1, key){ const pts=series.filter(p=>p.t>=t0 && p.t<=t1); if(!pts.length) return 0; return pts.reduce((a,b)=>a+(key?b[key]:b),0)/pts.length; }

  function finish(plan, saved){ clearInterval(engine.timer); engine.timer=null; engine.running=false; engine.paused=false; if(saved){ const id='s_'+Date.now(); const s={ id, name:plan.name, endedAt:Date.now(), dist:engine.dist, total:engine.tTot,
      hrSeries:engine.seriesHr, spdSeries:engine.seriesSpd, wattSeries:engine.seriesWatt, driftSeries:engine.seriesDrift, rpePerDrag:engine.rpePerDrag };
      const st=AppState; st.logg=st.logg||[]; st.logg.push(s); Storage.saveP(AppState.currentProfile,'logg',st.logg); location.hash='#/result?id='+id; }
    else{ location.hash='#/dashboard'; }
  }

  function render(el, st){ const plan = st.plan || (st.workouts&&st.workouts[0]) || {name:'Økt'}; engine.seq = expand(plan.blocks); engine.idx=0; engine.left=engine.seq[0]?engine.seq[0].dur:0; engine.tTot=0; engine.tDrag=0; engine.dist=0; engine.seriesHr=[]; engine.seriesSpd=[]; engine.seriesWatt=[]; engine.seriesDrift=[]; engine.rpePerDrag={}; engine.curRPE=6; const {graph} = drawLayout(el, plan); attachHandlers(graph, plan); setPhase(); }

  return { render };
})();
