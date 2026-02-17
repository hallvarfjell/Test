const Workout = {
  onHR:null, onTM:null,
  render(el, st){
    el.innerHTML=''; const plan = st.plan || (st.workouts&&st.workouts[0]); if(!plan){ el.textContent='Ingen økt valgt.'; return; }
    const grid = UI.h('div',{class:'grid-okt'});

    // YTELSE
    const yt = UI.h('section',{class:'ytelse'});
    const hrCol = UI.h('div',{class:'kpi-col'},
      UI.h('div',{class:'kpi-label'},'Puls'),
      UI.h('div',{class:'big', id:'hr'}, String(st.hr.bpm||0)),
      UI.h('div',{class:'sub', id:'hrp'}, ''),
      UI.h('div',{class:'kpi-label'},'Slope'),
      UI.h('div',{class:'kpi-val', id:'slope'}, '0.00%')
    );

    const spdCol = UI.h('div',{class:'kpi-col'},
      UI.h('div',{class:'kpi-label'},'Fart / Stigning'),
      UI.h('div',{class:'kpi-val', id:'spd', style:'cursor:pointer'}, '0.0 km/t'),
      UI.h('div',{class:'kpi-val', id:'inc'}, '0%'),
      UI.h('div',{class:'controls'},
        UI.h('button',{class:'btn big',onclick:()=>{ st.tm.speed=Math.max(0,(st.tm.speed||0)-0.1); st.tm.manualUntil=Date.now()+4000; updSPD(); }},'−'),
        UI.h('button',{class:'btn big',onclick:()=>{ st.tm.speed=(st.tm.speed||0)+0.1; st.tm.manualUntil=Date.now()+4000; updSPD(); }},'+')
      ),
      UI.h('div',{class:'controls'},
        UI.h('button',{class:'btn big',onclick:()=>{ st.tm.incline=Math.max(0,(st.tm.incline||0)-1); st.tm.manualUntil=Date.now()+4000; updINC(); }},'−'),
        UI.h('button',{class:'btn big',onclick:()=>{ st.tm.incline=(st.tm.incline||0)+1; st.tm.manualUntil=Date.now()+4000; updINC(); }},'+')
      )
    );

    const piCol = UI.h('div',{class:'kpi-col'},
      UI.h('div',{class:'kpi-label'},'PI (trykk for detalj)'),
      UI.h('div',{class:'kpi-val', id:'pi', style:'cursor:pointer'}, '0.00'),
      UI.h('div',{class:'controls'},
        UI.h('button',{class:'btn',id:'btnWater',title:'Vann'},'🥛'),
        UI.h('button',{class:'btn',id:'btnCarb',title:'Karbo'},'🍌')
      )
    );

    yt.append(hrCol, spdCol, piCol);

    const quick = UI.h('div',{class:'controls'},
      UI.h('button',{class:'btn',onclick:()=>{ st.tm.speed=10; st.tm.manualUntil=Date.now()+4000; updSPD(); }},'10 km/t'),
      UI.h('button',{class:'btn',onclick:()=>{ st.tm.speed=15; st.tm.manualUntil=Date.now()+4000; updSPD(); }},'15 km/t')
    );
    yt.append(quick);

    // GRAF
    const graf = UI.h('section',{class:'graf'}); Graph.init(graf, {lt1:st.settings.lt1, lt2:st.settings.lt2, soner: st.settings.soner});

    // ØKTPANEL
    const op = UI.h('section',{class:'oktpanel'});
    const title = UI.h('h2',{},plan.name);
    const phaseNow = UI.h('div',{class:'list-item', id:'phaseNow'}, '–');
    const phaseNext = UI.h('div',{class:'small', id:'phaseNext'}, '');
    const phaseNext2 = UI.h('div',{class:'small', id:'phaseNext2'}, '');
    const timer = UI.h('div',{class:'big', id:'timer'}, '00:00');
    const ctrl = UI.h('div',{class:'controls'},
      UI.h('button',{class:'btn primary', id:'start'},'Start'),
      UI.h('button',{class:'btn', id:'pause', disabled:true},'Pause'),
      UI.h('button',{class:'btn', id:'prev', disabled:true},'⟵'),
      UI.h('button',{class:'btn', id:'next', disabled:true},'⟶'),
      UI.h('button',{class:'btn', id:'save', disabled:true},'Lagre'),
      UI.h('button',{class:'btn danger', id:'discard', disabled:true},'Forkast')
    );
    op.append(title, phaseNow, phaseNext, phaseNext2, timer, ctrl);

    // STAT
    const stat = UI.h('section',{class:'stat'});
    const tbl = UI.h('table',{class:'table'}); tbl.innerHTML = '<tr><th>Parameter</th><th>Verdi</th></tr>'+
      '<tr><td>Snittpuls (drag)</td><td id="avgHR">-</td></tr>'+
      '<tr><td>Snittfart (drag)</td><td id="avgSpd">-</td></tr>'+
      '<tr><td>Distanse (km)</td><td id="dist">0.00</td></tr>'+
      '<tr><td>Totaltid</td><td id="tTot">00:00</td></tr>'+
      '<tr><td>Dragtid</td><td id="tDrag">00:00</td></tr>'+
      '<tr><td>Gjenstående</td><td id="tLeft">-</td></tr>'+
      '<tr><td>Klokkeslett</td><td id="clock2">--:--:--</td></tr>';
    const tiz = UI.h('div',{class:'tiz'}); Graph.initTIZ(tiz);
    stat.append(tbl, UI.h('div',{class:'card'}, UI.h('h3',{},'Tid i pulssoner'), tiz));

    const right = UI.h('div',{class:'rightcol'}); right.append(op, stat); grid.append(yt, graf, right); el.append(grid);

    // --- STATE ---
    const seq = expand(plan.blocks);
    let idx=0, left=0, started=false, paused=false, timerHandle=null; let tTot=0, tDrag=0, dist=0; const hrSamples=[], spdSamples=[]; const hrBuf=[]; let speedUnit='kmh'; let waterCount=0, carbCount=0;
    const seriesHr=[]; const seriesSpd=[]; // for resultatside

    function expand(blocks){ const out=[]; blocks.forEach(b=>{ if(b.kind==='Oppvarming'||b.kind==='Nedjogg'||b.kind==='Pause') out.push({kind:b.kind, dur:b.dur}); else if(b.kind==='Intervall'){ for(let i=1;i<=b.reps;i++){ out.push({kind:'Arbeid', dur:b.work, rep:i, reps:b.reps}); if(b.rest>0) out.push({kind:'Pause', dur:b.rest}); } } else if(b.kind==='Serie'){ for(let s=1;s<=b.series;s++){ for(let i=1;i<=b.reps;i++){ out.push({kind:'Arbeid', dur:b.work, rep:i, reps:b.reps, set:s, sets:b.series}); if(b.rest>0) out.push({kind:'Pause', dur:b.rest}); } if(s<b.series && b.seriesRest) out.push({kind:'Pause', dur:b.seriesRest}); } } }); return out; }

    function fmtSpd(kmh){ if(speedUnit==='kmh') return `${kmh.toFixed(1)} km/t`; if(kmh<=0) return '–'; const pace = 60/(kmh); const m=Math.floor(pace), s=Math.round((pace-m)*60); return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} min/km`; }
    function updSPD(){ const elSpd=document.getElementById('spd'); if(elSpd) elSpd.textContent = fmtSpd(st.tm.speed||0); Graph.addSPD(st.tm.speed||0); }
    function updINC(){ const elInc=document.getElementById('inc'); if(elInc) elInc.textContent = `${Math.round(st.tm.incline||0)}%`; }

    Workout.onHR = bpm=>{ const eHR=document.getElementById('hr'); if(eHR) eHR.textContent=String(bpm); const p=Math.round((bpm/(st.settings.hrmax||190))*100); const eHRp=document.getElementById('hrp'); if(eHRp) eHRp.textContent=`~${p}% av maks`; Graph.addHR(bpm); const t=Date.now()/1000; hrBuf.push({t,bpm}); while(hrBuf.length && (t-hrBuf[0].t)>70) hrBuf.shift(); seriesHr.push({t,bpm}); };
    Workout.onTM = (sp,inc)=>{ const now=Date.now(); if(sp!==null && ( !st.tm.manualUntil || now>st.tm.manualUntil )) st.tm.speed=sp; if(inc!==null) st.tm.incline=inc; updSPD(); updINC(); };

    function label(x){ let base=x.kind; if(x.kind==='Arbeid' && x.rep) base+=` drag ${x.rep}/${x.reps}${x.set?`, serie ${x.set}/${x.sets||1}`:''}`; return base; }
    function totalRemaining(){ return seq.slice(idx).reduce((a,b)=>a+b.dur,0); }

    function setPhase(){ const cur = seq[idx]; if(!cur){ finish(true); return; } left=cur.dur; const pNow=document.getElementById('phaseNow'); if(pNow) pNow.textContent = label(cur); const pN=document.getElementById('phaseNext'); if(pN) pN.textContent = seq[idx+1]? ('Neste: '+label(seq[idx+1])):''; const pN2=document.getElementById('phaseNext2'); if(pN2) pN2.textContent = seq[idx+2]? ('Deretter: '+label(seq[idx+2])):''; const eLeft=document.getElementById('tLeft'); if(eLeft) eLeft.textContent = UI.fmtTime(totalRemaining()); tDrag=0; }

    function calcAvg(windowSec){ const t=Date.now()/1000; const pts=hrBuf.filter(x=>t-x.t<=windowSec); if(!pts.length) return 0; return pts.reduce((a,b)=>a+b.bpm,0)/pts.length; }
    function calcSlope(){ const a10=calcAvg(10); const a60=calcAvg(60); if(a60<=0) return 0; return (a10-a60)/a60; }
    function updatePI(){ const slope=calcSlope(); const res = (typeof PI!=='undefined')? PI.computeTot({ hr:(hrBuf.length?hrBuf[hrBuf.length-1].bpm:0), speedKmh: st.tm.speed||0, inclinePct: st.tm.incline||0, tempC:20, elapsedSec:tTot, settings: st.settings, cumSweatL:0 }): {PI_tot:0}; const ePI=document.getElementById('pi'); if(ePI) ePI.textContent = String((res.PI_tot||0).toFixed(2)); const eSlope=document.getElementById('slope'); if(eSlope) eSlope.textContent = (slope*100).toFixed(2)+'%'; }

    function tick(){ if(paused) return; tTot++; tDrag++; const eTot=document.getElementById('tTot'); if(eTot) eTot.textContent=UI.fmtTime(tTot); const eDrag=document.getElementById('tDrag'); if(eDrag) eDrag.textContent=UI.fmtTime(tDrag); const eTimer=document.getElementById('timer'); if(eTimer) eTimer.textContent=UI.fmtTime(left); const eClock=document.getElementById('clock2'); if(eClock) eClock.textContent=new Date().toLocaleTimeString(); const cur = seq[idx]; const spdNow = (cur.kind==='Pause')? 0 : (st.tm.speed||0); const eSpd=document.getElementById('spd'); if(eSpd) eSpd.textContent = fmtSpd(spdNow); Graph.addSPD(spdNow); const t=Date.now()/1000; seriesSpd.push({t,kmh:spdNow}); dist += spdNow/3600; const eDist=document.getElementById('dist'); if(eDist) eDist.textContent = dist.toFixed(2); if(cur.kind==='Arbeid'){ if(st.hr.bpm) hrSamples.push(st.hr.bpm); spdSamples.push(spdNow); } updatePI(); left--; if(left<=0){ if(cur.kind==='Arbeid'){ const aHR = Math.round(hrSamples.reduce((a,b)=>a+b,0)/(hrSamples.length||1)); const aSpd = (spdSamples.reduce((a,b)=>a+b,0)/(spdSamples.length||1)).toFixed(1); const eAHR=document.getElementById('avgHR'); if(eAHR) eAHR.textContent = String(aHR); const eAS=document.getElementById('avgSpd'); if(eAS) eAS.textContent = String(aSpd); hrSamples.length=0; spdSamples.length=0; } idx++; setPhase(); } }

    function start(){ if(started) return; started=true; paused=false; AppState.session.running=true; AppState.session.paused=false; setPhase(); timerHandle=setInterval(tick,1000); document.getElementById('start').disabled=true; ['pause','prev','next','save','discard'].forEach(id=>{ const b=document.getElementById(id); if(b) b.disabled=false; }); }
    function togglePause(){ paused=!paused; AppState.session.paused=paused; const b=document.getElementById('pause'); if(b) b.textContent = paused? 'Gjenoppta':'Pause'; }
    function next(){ idx=Math.min(seq.length, idx+1); setPhase(); }
    function prev(){ idx=Math.max(0, idx-1); setPhase(); }
    function finish(saved){ clearInterval(timerHandle); AppState.session.running=false; AppState.session.paused=false; let sid=null; if(saved){ const session={id:'s_'+Date.now(), name:plan.name, endedAt:Date.now(), dist:dist, total:tTot, seq:seq, water:waterCount, carbs:carbCount, hrSeries:seriesHr, spdSeries:seriesSpd }; st.logg.push(session); Storage.saveP(AppState.currentProfile, 'logg', st.logg); sid=session.id; } location.hash = saved? ('#/result?id='+sid) : '#/dashboard'; }

    document.getElementById('start').addEventListener('click', start);
    document.getElementById('pause').addEventListener('click', togglePause);
    document.getElementById('next').addEventListener('click', next);
    document.getElementById('prev').addEventListener('click', prev);
    document.getElementById('save').addEventListener('click', ()=>finish(true));
    document.getElementById('discard').addEventListener('click', ()=>{ if(confirm('Forkaste uten å lagre?')) finish(false); });

    document.getElementById('spd').addEventListener('click', ()=>{ speedUnit = (speedUnit==='kmh'?'pace':'kmh'); updSPD(); });
    document.getElementById('btnWater').addEventListener('click', ()=>{ waterCount++; if(typeof PI!=='undefined') PI.addWater(1); });
    document.getElementById('btnCarb').addEventListener('click', ()=>{ carbCount++; });
    document.getElementById('pi').addEventListener('click', ()=>{ location.hash='#/pi?from=workout'; });

    // preview før start
    (function preview(){ idx=0; const cur=seq[idx]; left = cur?cur.dur:0; const pNow=document.getElementById('phaseNow'); if(cur && pNow){ pNow.textContent = label(cur); const pN=document.getElementById('phaseNext'); if(pN) pN.textContent = seq[idx+1]? ('Neste: '+label(seq[idx+1])):''; const pN2=document.getElementById('phaseNext2'); if(pN2) pN2.textContent = seq[idx+2]? ('Deretter: '+label(seq[idx+2])):''; const eTimer=document.getElementById('timer'); if(eTimer) eTimer.textContent = UI.fmtTime(left); const eLeft=document.getElementById('tLeft'); if(eLeft) eLeft.textContent = UI.fmtTime(totalRemaining()); } })();
    updSPD(); updINC(); updatePI();
  }
};
