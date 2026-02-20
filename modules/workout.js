
// Workout module v1.3.6 – new layout, PI & ΔHR, power toggle W/Wkg, pace toggle, fixed graph scales, RPE per drag

const WorkoutEngine = (function(){
  const S = { running:false, paused:false, timer:null, plan:null, seq:[], idx:0, left:0, tTot:0, tDrag:0,
              dist:0, hrBuf:[], speedUnit:'kmh', powerUnit:'W',
              hrSamples:[], spdSamples:[], powSamples:[],
              seriesHr:[], seriesSpd:[], seriesInc:[],
              perDrag:[], rpeCur:6 };

  function expand(blocks){
    const out=[]; (blocks||[]).forEach(b=>{
      if(['Oppvarming','Nedjogg','Pause'].includes(b.kind)) out.push({kind:b.kind, dur:b.dur});
      else if(b.kind==='Intervall'){
        for(let i=1;i<=b.reps;i++){ out.push({kind:'Arbeid', dur:b.work, rep:i, reps:b.reps}); if(b.rest>0) out.push({kind:'Pause', dur:b.rest}); }
      } else if(b.kind==='Serie'){
        for(let s=1;s<=b.series;s++){
          for(let i=1;i<=b.reps;i++){ out.push({kind:'Arbeid', dur:b.work, rep:i, reps:b.reps, set:s, sets:b.series}); if(b.rest>0) out.push({kind:'Pause', dur:b.rest}); }
          if(s<b.series && b.seriesRest) out.push({kind:'Pause', dur:b.seriesRest});
        }
      }
    }); return out;
  }
  function fmtSpd(kmh){ if(S.speedUnit==='kmh') return `${kmh.toFixed(1)} km/t`; if(kmh<=0) return '–'; const pace=60/(kmh); const m=Math.floor(pace), s=Math.round((pace-m)*60); return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} min/km`; }
  function estWatt(speedKmh, inclinePct){ const v=(speedKmh||0)/3.6; const i=(inclinePct||0)/100; const met=(AppState.settings?.met_eff)||0.25; const mass=(AppState.settings?.mass)||75; const Wkg=4.185*v + (9.81*v*i)/met; const shoe=1-((AppState.settings?.shoe_gain_pct||0)/100); const tm=(AppState.settings?.tm_cal||1); const WkgAdj = Wkg*shoe*tm; return { Wkg:WkgAdj, W: WkgAdj*mass } }

  function updateUI(){
    const cur=S.seq[S.idx]||{}; const spdNow = cur.kind==='Pause'? 0 : (AppState.tm?.speed||0); const incNow = AppState.tm?.incline||0; const hrNow = AppState.hr?.bpm||0;
    // big tiles
    const hrEl = document.getElementById('wk_hr'); if(hrEl) hrEl.textContent = String(hrNow||0);
    const hrp = document.getElementById('wk_hrp'); if(hrp){ const r=AppState.settings?.hrrest||50, m=AppState.settings?.hrmax||190; const p=(hrNow-r)/Math.max(1,(m-r)); hrp.textContent = isFinite(p)? `${Math.round(p*100)}%` : '–'; }
    const spd = document.getElementById('wk_spd'); if(spd) spd.textContent = fmtSpd(spdNow);
    const inc = document.getElementById('wk_inc'); if(inc) inc.textContent = `${Math.round(incNow)}%`;

    // PI & dHR
    try{
      const res = (typeof PI!=='undefined')? PI.compute(performance.now(), { prevTime:null,tSec:0, hr:hrNow, speedKmh:spdNow, inclinePct:incNow, tempC:20, rpe:S.rpeCur, cumSweatL:0 }) : null;
      const piEl=document.getElementById('wk_pi'); if(piEl) piEl.textContent = res&&res.PI? res.PI.toFixed(2) : '–';
      const dEl=document.getElementById('wk_dhr'); if(dEl) dEl.textContent = res? String(Math.round(res.dHR||0)) : '0';
    }catch(e){}

    // power
    const p = estWatt(spdNow, incNow); const wEl=document.getElementById('wk_pow'); if(wEl){ wEl.textContent = (S.powerUnit==='W')? `${Math.round(p.W)} W` : `${p.Wkg.toFixed(2)} W/kg`; }

    // timers
    const eTimer=document.getElementById('wk_timer'); if(eTimer) eTimer.textContent = UI.fmtTime(S.left);
    const eTot=document.getElementById('wk_tTot'); if(eTot) eTot.textContent = UI.fmtTime(S.tTot);
    const eDrag=document.getElementById('wk_tDrag'); if(eDrag) eDrag.textContent = UI.fmtTime(S.tDrag);
    const eDist=document.getElementById('wk_dist'); if(eDist) eDist.textContent = S.dist.toFixed(2);

    // phase labels
    const curLbl = document.getElementById('wk_phase'); if(curLbl){ let base=cur.kind||'–'; if(cur.kind==='Arbeid'&&cur.rep){ base+=` ${cur.rep}/${cur.reps}${cur.set?`, serie ${cur.set}/${cur.sets||1}`:''}`; } curLbl.textContent=base; }
    const nextLbl=document.getElementById('wk_next'); if(nextLbl){ const n=S.seq[S.idx+1]; nextLbl.textContent = n? `Neste: ${n.kind}${n.rep?` ${n.rep}/${n.reps}`:''}` : ''; }
  }

  function tick(){ if(S.paused||!S.running) return; S.tTot++; const cur=S.seq[S.idx]; const spdNow = cur.kind==='Pause'?0:(AppState.tm?.speed||0); const incNow=AppState.tm?.incline||0; const hrNow=AppState.hr?.bpm||0;
    // accumulate
    S.dist += spdNow/3600; S.seriesSpd.push({t:Date.now()/1000, kmh:spdNow}); S.seriesInc.push({t:Date.now()/1000, pct:incNow}); if(hrNow) S.seriesHr.push({t:Date.now()/1000, bpm:hrNow});
    if(cur.kind==='Arbeid'){ if(hrNow) S.hrSamples.push(hrNow); S.spdSamples.push(spdNow); const p=estWatt(spdNow,incNow); S.powSamples.push(p.W); S.tDrag++; }
    drawGraph(); updateUI(); S.left--; if(S.left<=0){ if(cur.kind==='Arbeid'){ const aHR=Math.round(S.hrSamples.reduce((a,b)=>a+b,0)/(S.hrSamples.length||1)); const aSpd=(S.spdSamples.reduce((a,b)=>a+b,0)/(S.spdSamples.length||1)); const aW=(S.powSamples.reduce((a,b)=>a+b,0)/(S.powSamples.length||1)); S.perDrag.push({hr:aHR, spd:+aSpd.toFixed(1), watt:+(aW||0).toFixed(0), rpe:S.rpeCur}); S.hrSamples.length=0; S.spdSamples.length=0; S.powSamples.length=0; }
      S.idx++; setPhase(); }
  }

  function setPhase(){ const cur=S.seq[S.idx]; if(!cur){ finish(true); return; } S.left=cur.dur; updateUI(); }
  function start(){ if(S.running) return; S.running=true; S.paused=false; if(!S.timer) S.timer=setInterval(tick,1000); AppState.session.running=true; AppState.session.paused=false; enableButtons(); updateUI(); }
  function pause(){ S.paused=!S.paused; AppState.session.paused=S.paused; const b=document.getElementById('wk_pause'); if(b) b.textContent = S.paused?'Gjenoppta':'Pause'; }
  function next(){ S.idx=Math.min(S.seq.length, S.idx+1); setPhase(); }
  function prev(){ S.idx=Math.max(0, S.idx-1); setPhase(); }
  function finish(saved){ clearInterval(S.timer); S.timer=null; S.running=false; S.paused=false; AppState.session.running=false; AppState.session.paused=false; let sid=null; if(saved){ const session={id:'s_'+Date.now(), name:S.plan.name, endedAt:Date.now(), dist:S.dist, total:S.tTot, seq:S.seq, perDrag:S.perDrag, hrSeries:S.seriesHr, spdSeries:S.seriesSpd, incSeries:S.seriesInc, notes:''}; const st=AppState; st.logg=st.logg||[]; st.logg.push(session); Storage.saveP(AppState.currentProfile,'logg',st.logg); sid=session.id; } location.hash = saved? ('#/result?id='+sid) : '#/dashboard'; }

  function attachHandlers(){
    const e=document; const q=id=>e.getElementById(id);
    q('wk_start')?.addEventListener('click', start);
    q('wk_pause')?.addEventListener('click', pause);
    q('wk_prev')?.addEventListener('click', prev);
    q('wk_next')?.addEventListener('click', next);
    q('wk_save')?.addEventListener('click', ()=>finish(true));
    q('wk_discard')?.addEventListener('click', ()=>{ if(confirm('Forkaste uten å lagre?')) finish(false); });
    q('wk_spd_toggle')?.addEventListener('click', ()=>{ S.speedUnit = (S.speedUnit==='kmh'?'pace':'kmh'); updateUI(); });
    q('wk_pow')?.addEventListener('click', ()=>{ S.powerUnit = (S.powerUnit==='W'?'Wkg':'W'); updateUI(); });
    q('wk_spdDec')?.addEventListener('click', ()=>{ AppState.tm.speed=Math.max(0,(AppState.tm.speed||0)-0.1); AppState.tm.manualUntil=Date.now()+4000; updateUI(); });
    q('wk_spdInc')?.addEventListener('click', ()=>{ AppState.tm.speed=(AppState.tm.speed||0)+0.1; AppState.tm.manualUntil=Date.now()+4000; updateUI(); });
    q('wk_incDec')?.addEventListener('click', ()=>{ AppState.tm.incline=Math.max(0,(AppState.tm.incline||0)-1); AppState.tm.manualUntil=Date.now()+4000; updateUI(); });
    q('wk_incInc')?.addEventListener('click', ()=>{ AppState.tm.incline=(AppState.tm.incline||0)+1; AppState.tm.manualUntil=Date.now()+4000; updateUI(); });
    q('wk_q10')?.addEventListener('click', ()=>{ AppState.tm.speed=10; AppState.tm.manualUntil=Date.now()+4000; updateUI(); });
    q('wk_q15')?.addEventListener('click', ()=>{ AppState.tm.speed=15; AppState.tm.manualUntil=Date.now()+4000; updateUI(); });
    q('wk_rpeDec')?.addEventListener('click', ()=>{ S.rpeCur=Math.max(1,(S.rpeCur||6)-0.5); document.getElementById('wk_rpe').textContent=S.rpeCur.toFixed(1); });
    q('wk_rpeInc')?.addEventListener('click', ()=>{ S.rpeCur=Math.min(10,(S.rpeCur||6)+0.5); document.getElementById('wk_rpe').textContent=S.rpeCur.toFixed(1); });
  }

  function init(plan){ if(S.plan) return; S.plan=plan; S.seq=expand(plan.blocks); S.idx=0; S.left=S.seq[0]?S.seq[0].dur:0; S.tTot=0; S.tDrag=0; S.dist=0; updateUI(); }

  // Graph – fixed scales: HR 90–190 (left), speed 0–20 (right)
  let c,ctx; function initGraph(host){ c=document.createElement('canvas'); c.width=900; c.height=260; c.style.width='100%'; ctx=c.getContext('2d'); host.appendChild(c); const ro=new ResizeObserver(()=>{ const r=host.getBoundingClientRect(); c.width=Math.max(600,Math.floor(r.width)); c.height=260; drawGraph(); }); ro.observe(host); }
  function drawGraph(){ if(!ctx) return; const W=c.width,H=c.height; ctx.clearRect(0,0,W,H);
    // axes box
    ctx.strokeStyle='#b4c4e8'; ctx.strokeRect(40,10,W-60,H-30);
    const t1=Date.now()/1000, t0=t1-15*60; // 15 min window
    // HR line
    ctx.strokeStyle='#d93c3c'; ctx.lineWidth=2; ctx.beginPath(); let first=true; const hrS=S.seriesHr; for(const p of hrS){ if(p.t<t0) continue; const x=40+((p.t-t0)/(15*60))*(W-60); const y=10+(1-((p.bpm-90)/(190-90)))*(H-30); if(first){ ctx.moveTo(x,y); first=false;} else ctx.lineTo(x,y); } ctx.stroke();
    // Speed line (right axis 0..20)
    ctx.strokeStyle='#d6a600'; ctx.lineWidth=2; ctx.beginPath(); first=true; const spS=S.seriesSpd; for(const p of spS){ if(p.t<t0) continue; const x=40+((p.t-t0)/(15*60))*(W-60); const y=10+(1-((p.kmh-0)/(20-0)))*(H-30); if(first){ ctx.moveTo(x,y); first=false;} else ctx.lineTo(x,y); } ctx.stroke();
    // Axis labels
    ctx.fillStyle='#0b1220'; ctx.font='12px system-ui'; [90,110,130,150,170,190].forEach(v=>{ const y=10+(1-((v-90)/(100)))*(H-30); ctx.fillText(v.toString(), 8, y+4); });
    [0,5,10,15,20].forEach(v=>{ const y=10+(1-((v-0)/20))*(H-30); ctx.fillText(v.toString(), W-28, y+4); });
  }

  function attach(){ attachHandlers(); updateUI(); }

  return { S, init, attach, initGraph };
})();

const Workout = {
  onHR:null, onTM:null,
  render(el, st){
    el.innerHTML=''; const plan = st.plan || (st.workouts&&st.workouts[0]); if(!plan){ el.textContent='Ingen økt valgt.'; return; }
    // Layout – three tiles row + quick
    const top = UI.h('div',{class:'card'}); top.style.display='grid'; top.style.gridTemplateColumns='2fr 1.4fr 1fr'; top.style.gap='.5rem';

    const colHR = UI.h('div',{});
    colHR.append(UI.h('div',{class:'small'},'Puls')); colHR.append(UI.h('div',{id:'wk_hr',style:'font-size:3.2rem;font-weight:700'}, String(st.hr.bpm||0)));
    const sub=UI.h('div',{style:'color:#4c5672'}, 'HR%: '); const hrp=UI.h('span',{id:'wk_hrp'},''); sub.appendChild(document.createTextNode(' ')); colHR.append(sub); colHR.append(UI.h('div',{class:'small'},'ΔHR drift')); colHR.append(UI.h('div',{id:'wk_dhr',style:'font-size:1.4rem'},'0'));

    const colSpd = UI.h('div',{});
    colSpd.append(UI.h('div',{class:'small'},'Fart / Stigning'));
    const spdRow=UI.h('div',{}); const spd=UI.h('div',{id:'wk_spd',style:'font-size:1.6rem;cursor:pointer'},'0.0 km/t'); spd.addEventListener('click',()=>{ WorkoutEngine.S.speedUnit=(WorkoutEngine.S.speedUnit==='kmh'?'pace':'kmh'); }); spdRow.append(spd); colSpd.append(spdRow);
    const inc=UI.h('div',{id:'wk_inc',style:'font-size:1.4rem'},'0%'); colSpd.append(inc);
    const ctrl=UI.h('div',{class:'controls'});
    ctrl.append(UI.h('button',{class:'btn',id:'wk_spdDec'},'−'), UI.h('button',{class:'btn',id:'wk_spdInc'},'+'));
    const ctrl2=UI.h('div',{class:'controls'});
    ctrl2.append(UI.h('button',{class:'btn',id:'wk_incDec'},'−'), UI.h('button',{class:'btn',id:'wk_incInc'},'+'));
    colSpd.append(ctrl, ctrl2);

    const colPI = UI.h('div',{});
    colPI.append(UI.h('div',{class:'small'},'PI (trykk for detalj i PI-modul)'));
    colPI.append(UI.h('div',{id:'wk_pi',style:'font-size:1.6rem;cursor:default'},'0.00'));
    colPI.append(UI.h('div',{class:'small'},'Effekt'));
    const pow=UI.h('div',{id:'wk_pow',style:'font-size:1.6rem;cursor:pointer'},'0 W'); colPI.append(pow);
    const quick=UI.h('div',{class:'controls'}); quick.append(UI.h('button',{class:'btn',id:'wk_q10'},'10 km/t'), UI.h('button',{class:'btn',id:'wk_q15'},'15 km/t'));
    colPI.append(quick);

    top.append(colHR, colSpd, colPI);

    // Graph
    const graf = UI.h('div',{class:'card'}); WorkoutEngine.initGraph(graf);

    // Right column – session controls + stats + RPE
    const right = UI.h('div',{}); const box = UI.h('div',{class:'card'});
    box.append(UI.h('h3',{}, plan.name));
    box.append(UI.h('div',{id:'wk_phase',class:'list-item'},'–'));
    box.append(UI.h('div',{id:'wk_next',class:'small'},''));
    const timer = UI.h('div',{id:'wk_timer',style:'font-size:2rem'}, '00:00'); box.append(timer);
    const controls = UI.h('div',{class:'controls'});
    controls.append(UI.h('button',{class:'btn primary',id:'wk_start'},'Start'), UI.h('button',{class:'btn',id:'wk_pause'},'Pause'), UI.h('button',{class:'btn',id:'wk_prev'},'⟵'), UI.h('button',{class:'btn',id:'wk_next'},'⟶'), UI.h('button',{class:'btn',id:'wk_save'},'Lagre'), UI.h('button',{class:'btn danger',id:'wk_discard'},'Forkast'));
    box.append(controls);

    const stats = UI.h('div',{class:'card'});
    const tbl = document.createElement('table'); tbl.className='table'; tbl.innerHTML='<tr><th>Param.</th><th>Verdi</th></tr>'+
      '<tr><td>Totaltid</td><td id="wk_tTot">00:00</td></tr>'+
      '<tr><td>Dragtid</td><td id="wk_tDrag">00:00</td></tr>'+
      '<tr><td>Distanse (km)</td><td id="wk_dist">0.00</td></tr>'+
      '<tr><td>Snittpuls (drag)</td><td id="wk_avgHR">-</td></tr>'+
      '<tr><td>Snittfart (drag)</td><td id="wk_avgSpd">-</td></tr>'+
      '<tr><td>SnittWatt (drag)</td><td id="wk_avgPow">-</td></tr>'+
      '<tr><td>RPE nå</td><td><div id="wk_rpe">6.0</div><div class="controls"><button class="btn" id="wk_rpeDec">−</button><button class="btn" id="wk_rpeInc">+</button></div></td></tr>';
    stats.append(tbl);

    // Layout assemble
    const grid = document.createElement('div'); grid.style.display='grid'; grid.style.gridTemplateColumns='1.6fr 1fr'; grid.style.gap='.5rem';
    const leftCol = document.createElement('div'); leftCol.append(top, graf);
    const rightCol = document.createElement('div'); rightCol.append(box, stats);
    grid.append(leftCol, rightCol); el.append(grid);

    // init engine and handlers
    WorkoutEngine.init(plan); WorkoutEngine.attach();

    // wiring for HR/TM callbacks
    Workout.onHR = bpm=>{ const t=Date.now()/1000; WorkoutEngine.S.hrBuf.push({t,bpm}); while(WorkoutEngine.S.hrBuf.length && (t-WorkoutEngine.S.hrBuf[0].t)>70) WorkoutEngine.S.hrBuf.shift(); WorkoutEngine.S.seriesHr.push({t,bpm}); updateUI(); };
    Workout.onTM = (spd,inc)=>{ const now=Date.now(); if(spd!==null && (!AppState.tm.manualUntil || now>AppState.tm.manualUntil)) AppState.tm.speed=spd; if(inc!==null) AppState.tm.incline=inc; };
  }
};
