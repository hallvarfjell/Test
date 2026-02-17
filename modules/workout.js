// WorkoutEngine: bevarer tilstand på tvers av navigasjon
const WorkoutEngine = (function(){
  const engine = { running:false, paused:false, timer:null, plan:null, seq:[], idx:0, left:0, tTot:0, tDrag:0, dist:0, speedUnit:'kmh', hrBuf:[], hrSamples:[], spdSamples:[], seriesHr:[], seriesSpd:[], water:0, carbs:0 };
  const listeners = {}; // UI bindings
  function expand(blocks){ const out=[]; blocks.forEach(b=>{ if(b.kind==='Oppvarming'||b.kind==='Nedjogg'||b.kind==='Pause') out.push({kind:b.kind, dur:b.dur}); else if(b.kind==='Intervall'){ for(let i=1;i<=b.reps;i++){ out.push({kind:'Arbeid', dur:b.work, rep:i, reps:b.reps}); if(b.rest>0) out.push({kind:'Pause', dur:b.rest}); } } else if(b.kind==='Serie'){ for(let s=1;s<=b.series;s++){ for(let i=1;i<=b.reps;i++){ out.push({kind:'Arbeid', dur:b.work, rep:i, reps:b.reps, set:s, sets:b.series}); if(b.rest>0) out.push({kind:'Pause', dur:b.rest}); } if(s<b.series && b.seriesRest) out.push({kind:'Pause', dur:b.seriesRest}); } } }); return out; }
  function fmtSpd(kmh){ if(engine.speedUnit==='kmh') return `${kmh.toFixed(1)} km/t`; if(kmh<=0) return '–'; const pace = 60/(kmh); const m=Math.floor(pace), s=Math.round((pace-m)*60); return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} min/km`; }
  function label(x){ let base=x.kind; if(x.kind==='Arbeid' && x.rep) base+=` drag ${x.rep}/${x.reps}${x.set?`, serie ${x.set}/${x.sets||1}`:''}`; return base; }
  function totalRemaining(){ return engine.seq.slice(engine.idx).reduce((a,b)=>a+b.dur,0); }
  function calcAvg(windowSec){ const t=Date.now()/1000; const pts=engine.hrBuf.filter(x=>t-x.t<=windowSec); if(!pts.length) return 0; return pts.reduce((a,b)=>a+b.bpm,0)/pts.length; }
  function calcSlope(){ const a10=calcAvg(10); const a60=calcAvg(60); if(a60<=0) return 0; return (a10-a60)/a60; }
  function estWatt(speedKmh, inclinePct){ const v = (speedKmh||0)/3.6; const i = (inclinePct||0)/100; const met_eff=0.25; const mass = (AppState.settings?.mass)||75; const Pflat_Wkg = 4.185 * v; const Pclimb_Wkg = (9.81*v*i)/met_eff; const Wkg = Pflat_Wkg + Pclimb_Wkg; return { W: Wkg*mass, Wkg } }
  function updateUI(){ const cur = engine.seq[engine.idx]||{}; const spdNow = (cur.kind==='Pause')? 0 : (AppState.tm.speed||0); const elSpd=document.getElementById('spd'); if(elSpd) elSpd.textContent = fmtSpd(spdNow);
    const elInc=document.getElementById('inc'); if(elInc) elInc.textContent = `${Math.round(AppState.tm.incline||0)}%`;
    const eTimer=document.getElementById('timer'); if(eTimer) eTimer.textContent=UI.fmtTime(engine.left);
    const eTot=document.getElementById('tTot'); if(eTot) eTot.textContent=UI.fmtTime(engine.tTot);
    const eDrag=document.getElementById('tDrag'); if(eDrag) eDrag.textContent=UI.fmtTime(engine.tDrag);
    const eDist=document.getElementById('dist'); if(eDist) eDist.textContent=engine.dist.toFixed(2);
    const pNow=document.getElementById('phaseNow'); if(pNow) pNow.textContent=label(cur||{kind:'–'});
    const pN=document.getElementById('phaseNext'); if(pN) pN.textContent = engine.seq[engine.idx+1]? ('Neste: '+label(engine.seq[engine.idx+1])):'';
    const pN2=document.getElementById('phaseNext2'); if(pN2) pN2.textContent = engine.seq[engine.idx+2]? ('Deretter: '+label(engine.seq[engine.idx+2])):'';
    const eLeft=document.getElementById('tLeft'); if(eLeft) eLeft.textContent=UI.fmtTime(totalRemaining());
    // PI + Slope + Watt
    const slope=calcSlope(); const eSlope=document.getElementById('slope'); if(eSlope) eSlope.textContent=(slope*100).toFixed(2)+'%';
    const resPI = (typeof PI!=='undefined')? PI.computeTot({ hr:(engine.hrBuf.length?engine.hrBuf[engine.hrBuf.length-1].bpm:0), speedKmh: AppState.tm.speed||0, inclinePct: AppState.tm.incline||0, tempC:20, elapsedSec:engine.tTot, settings: AppState.settings, cumSweatL:0 }): {PI_tot:0}; const ePI=document.getElementById('pi'); if(ePI) ePI.textContent=String((resPI.PI_tot||0).toFixed(2));
    const pw = estWatt(AppState.tm.speed||0, AppState.tm.incline||0); const eW=document.getElementById('watt'); if(eW) eW.textContent = `${Math.round(pw.W)} W (${pw.Wkg.toFixed(2)} W/kg)`;
  }
  function tick(){ if(engine.paused||!engine.running) return; engine.tTot++; engine.tDrag++; const cur=engine.seq[engine.idx]; const spdNow = (cur.kind==='Pause')? 0 : (AppState.tm.speed||0); engine.seriesSpd.push({t:Date.now()/1000, kmh:spdNow}); engine.dist += spdNow/3600; if(cur.kind==='Arbeid'){ if(AppState.hr.bpm) engine.hrSamples.push(AppState.hr.bpm); engine.spdSamples.push(spdNow); }
    updateUI(); engine.left--; if(engine.left<=0){ if(cur.kind==='Arbeid'){ const aHR = Math.round(engine.hrSamples.reduce((a,b)=>a+b,0)/(engine.hrSamples.length||1)); const aSpd = (engine.spdSamples.reduce((a,b)=>a+b,0)/(engine.spdSamples.length||1)).toFixed(1); const eAHR=document.getElementById('avgHR'); if(eAHR) eAHR.textContent=String(aHR); const eAS=document.getElementById('avgSpd'); if(eAS) eAS.textContent=String(aSpd); engine.hrSamples.length=0; engine.spdSamples.length=0; } engine.idx++; setPhase(); }
  }
  function setPhase(){ const cur = engine.seq[engine.idx]; if(!cur){ finish(true); return; } engine.left=cur.dur; updateUI(); }
  function start(){ if(engine.running) return; engine.running=true; engine.paused=false; if(!engine.timer) engine.timer=setInterval(tick,1000); AppState.session.running=true; AppState.session.paused=false; enableButtons(); updateUI(); }
  function pause(){ engine.paused=!engine.paused; AppState.session.paused=engine.paused; const b=document.getElementById('pause'); if(b) b.textContent = engine.paused? 'Gjenoppta':'Pause'; }
  function next(){ engine.idx=Math.min(engine.seq.length, engine.idx+1); setPhase(); }
  function prev(){ engine.idx=Math.max(0, engine.idx-1); setPhase(); }
  function finish(saved){ clearInterval(engine.timer); engine.timer=null; engine.running=false; engine.paused=false; AppState.session.running=false; AppState.session.paused=false; let sid=null; if(saved){ const session={id:'s_'+Date.now(), name:engine.plan.name, endedAt:Date.now(), dist:engine.dist, total:engine.tTot, seq:engine.seq, water:engine.water, carbs:engine.carbs, hrSeries:engine.seriesHr, spdSeries:engine.seriesSpd }; const st=AppState; st.logg.push(session); Storage.saveP(AppState.currentProfile,'logg', st.logg); sid=session.id; } location.hash = saved? ('#/result?id='+sid) : '#/dashboard'; }
  function enableButtons(){ const ids=['pause','prev','next','save','discard']; ids.forEach(id=>{ const b=document.getElementById(id); if(b) b.disabled=false; }); const s=document.getElementById('start'); if(s) s.disabled=true; const p=document.getElementById('pause'); if(p) p.textContent = engine.paused? 'Gjenoppta':'Pause'; }
  function attach(){ // rebind buttons every render
    const s=document.getElementById('start'); if(s) s.onclick = start;
    const p=document.getElementById('pause'); if(p) p.onclick = pause;
    const n=document.getElementById('next'); if(n) n.onclick = next;
    const pr=document.getElementById('prev'); if(pr) pr.onclick = prev;
    const sv=document.getElementById('save'); if(sv) sv.onclick = ()=>finish(true);
    const d=document.getElementById('discard'); if(d) d.onclick = ()=>{ if(confirm('Forkaste uten å lagre?')) finish(false); };
    const spd=document.getElementById('spd'); if(spd) spd.onclick = ()=>{ engine.speedUnit = (engine.speedUnit==='kmh'?'pace':'kmh'); updateUI(); };
    const w=document.getElementById('btnWater'); if(w) w.onclick = ()=>{ engine.water++; };
    const c=document.getElementById('btnCarb'); if(c) c.onclick = ()=>{ engine.carbs++; };
    const pi=document.getElementById('pi'); if(pi) pi.onclick = ()=>{ location.hash='#/pi?from=workout'; };
    const spdDec=document.getElementById('spdDec'); if(spdDec) spdDec.onclick = ()=>{ AppState.tm.speed=Math.max(0,(AppState.tm.speed||0)-0.1); AppState.tm.manualUntil=Date.now()+4000; updateUI(); };
    const spdInc=document.getElementById('spdInc'); if(spdInc) spdInc.onclick = ()=>{ AppState.tm.speed=(AppState.tm.speed||0)+0.1; AppState.tm.manualUntil=Date.now()+4000; updateUI(); };
    const incDec=document.getElementById('incDec'); if(incDec) incDec.onclick = ()=>{ AppState.tm.incline=Math.max(0,(AppState.tm.incline||0)-1); AppState.tm.manualUntil=Date.now()+4000; updateUI(); };
    const incInc=document.getElementById('incInc'); if(incInc) incInc.onclick = ()=>{ AppState.tm.incline=(AppState.tm.incline||0)+1; AppState.tm.manualUntil=Date.now()+4000; updateUI(); };
    const q10=document.getElementById('q10'); if(q10) q10.onclick = ()=>{ AppState.tm.speed=10; AppState.tm.manualUntil=Date.now()+4000; updateUI(); };
    const q15=document.getElementById('q15'); if(q15) q15.onclick = ()=>{ AppState.tm.speed=15; AppState.tm.manualUntil=Date.now()+4000; updateUI(); };
    if(engine.running) enableButtons(); updateUI();
  }
  function onHR(bpm){ const eHR=document.getElementById('hr'); if(eHR) eHR.textContent=String(bpm); const p=Math.round((bpm/(AppState.settings.hrmax||190))*100); const eHRp=document.getElementById('hrp'); if(eHRp) eHRp.textContent=`~${p}% av maks`; const t=Date.now()/1000; engine.hrBuf.push({t,bpm}); while(engine.hrBuf.length && (t-engine.hrBuf[0].t)>70) engine.hrBuf.shift(); engine.seriesHr.push({t,bpm}); }
  function onTM(sp,inc){ const now=Date.now(); if(sp!==null && ( !AppState.tm.manualUntil || now>AppState.tm.manualUntil )) AppState.tm.speed=sp; if(inc!==null) AppState.tm.incline=inc; updateUI(); }
  function initIfNeeded(plan){ if(engine.plan) return; engine.plan = plan; engine.seq = expand(plan.blocks); engine.idx=0; engine.left=engine.seq[0]?engine.seq[0].dur:0; engine.tTot=0; engine.tDrag=0; engine.dist=0; updateUI(); }
  return { engine, attach, onHR, onTM, initIfNeeded, start };
})();

const Workout = {
  onHR:null, onTM:null,
  render(el, st){
    el.innerHTML=''; const plan = st.plan || (st.workouts&&st.workouts[0]); if(!plan){ el.textContent='Ingen økt valgt.'; return; }
    // GRID
    const grid = UI.h('div',{class:'grid-okt'});
    // YTELSE
    const yt = UI.h('section',{class:'ytelse'});
    const hrCol = UI.h('div',{class:'kpi-col hr-span2'},
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
        UI.h('button',{class:'btn big',id:'spdDec'},'−'),
        UI.h('button',{class:'btn big',id:'spdInc'},'+')
      ),
      UI.h('div',{class:'controls'},
        UI.h('button',{class:'btn big',id:'incDec'},'−'),
        UI.h('button',{class:'btn big',id:'incInc'},'+')
      )
    );
    const piCol = UI.h('div',{class:'kpi-col'},
      UI.h('div',{class:'kpi-label'},'PI (trykk for detalj)'),
      UI.h('div',{class:'kpi-val', id:'pi', style:'cursor:pointer'}, '0.00'),
      UI.h('div',{class:'kpi-label'},'Watt (est.)'),
      UI.h('div',{class:'kpi-val', id:'watt'}, '0 W (0.00 W/kg)'),
      UI.h('div',{class:'controls'},
        UI.h('button',{class:'btn',id:'btnWater',title:'Vann'},'🥛'),
        UI.h('button',{class:'btn',id:'btnCarb',title:'Karbo'},'🍌')
      )
    );
    yt.append(hrCol, spdCol, piCol);
    const quick = UI.h('div',{class:'controls'}, UI.h('button',{class:'btn',id:'q10'},'10 km/t'), UI.h('button',{class:'btn',id:'q15'},'15 km/t')); yt.append(quick);

    // GRAF
    const graf = UI.h('section',{class:'graf'}); Graph.init(graf, {lt1:st.settings.lt1, lt2:st.settings.lt2, soner: st.settings.soner});

    // ØKTPANEL
    const op = UI.h('section',{class:'oktpanel'});
    const title = UI.h('h2',{},plan.name);
    const phaseNow = UI.h('div',{class:'list-item', id:'phaseNow'}, '–');
    const phaseNext = UI.h('div',{class:'small', id:'phaseNext'}, '');
    const phaseNext2 = UI.h('div',{class:'small', id:'phaseNext2'}, '');
    const timer = UI.h('div',{class:'big', id:'timer'}, '00:00');
    const ctrl = UI.h('div',{class:'controls'}, UI.h('button',{class:'btn primary', id:'start'},'Start'), UI.h('button',{class:'btn', id:'pause', disabled:false},'Pause'), UI.h('button',{class:'btn', id:'prev', disabled:false},'⟵'), UI.h('button',{class:'btn', id:'next', disabled:false},'⟶'), UI.h('button',{class:'btn', id:'save', disabled:false},'Lagre'), UI.h('button',{class:'btn danger', id:'discard', disabled:false},'Forkast'));
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

    // init engine/state and attach UI
    WorkoutEngine.initIfNeeded(plan);
    WorkoutEngine.attach();

    // set callbacks used by Bluetooth
    Workout.onHR = WorkoutEngine.onHR;
    Workout.onTM = WorkoutEngine.onTM;
  }
};
