// Økt v1.4.4 – med hurtigvalg fart + grafpanel + snarveier
const WorkoutEngine=(function(){ const S={ running:false, paused:false, timer:null, plan:null, seq:[], idx:0, left:0, tTot:0, dist:0, rpeCur:6,
  hrSeries:[], spdSeries:[], incSeries:[], _perDrag:[], lastDrag:{hr:'-',spd:'-',watt:'-',rpe:'-'}, P2:null, tssLoad:0 };
  function reset(){ S.running=false; S.paused=false; if(S.timer){clearInterval(S.timer);S.timer=null;} S.seq=[];S.idx=0;S.left=0;S.tTot=0;S.dist=0;S.hrSeries=[];S.spdSeries=[];S.incSeries=[];S._perDrag=[];S.lastDrag={hr:'-',spd:'-',watt:'-',rpe:'-'}; S.tssLoad=0; S.P2=(AppState.settings?.P_L2)||null; }
  function current(){ return S.seq[S.idx]; }
  function expand(plan){ const out=[]; (plan.blocks||[]).forEach(b=>{ if(['Oppvarming','Pause','Nedjogg'].includes(b.kind)) out.push({kind:b.kind,dur:b.dur}); else if(b.kind==='Intervall'){ for(let i=1;i<=b.reps;i++){ out.push({kind:'Arbeid',dur:b.work,rep:i,reps:b.reps}); if(b.rest>0) out.push({kind:'Pause',dur:b.rest}); }}}); return out; }
  function setPhase(){ const c=current(); if(!c){ finish(true); return; } S.left=c.dur; }
  function startToggle(){ if(S.running){ S.paused=!S.paused; const b=document.getElementById('wk_toggle'); if(b) b.innerHTML=S.paused?'<i class="ph ph-play"></i>':'<i class="ph ph-pause"></i>'; return; }
    S.running=true; S.paused=false; if(!S.timer) S.timer=setInterval(tick,1000); const b=document.getElementById('wk_toggle'); if(b) b.innerHTML='<i class="ph ph-pause"></i>'; }
  function prev(){ if(S.idx>0){ S.idx--; setPhase(); }}
  function next(){ if(S.idx<S.seq.length-1){ S.idx++; setPhase(); }}
  function pushDrag(per){ const aHR=Math.round(per.hr.reduce((a,b)=>a+b,0)/(per.hr.length||1)); const aSpd=(per.spd.reduce((a,b)=>a+b,0)/(per.spd.length||1)); const aW=(per.w.reduce((a,b)=>a+b,0)/(per.w.length||1)); const aInc=(per.inc.reduce((a,b)=>a+b,0)/(per.inc.length||1)); S.lastDrag={hr:aHR, spd:+(aSpd||0).toFixed(1), watt:+(aW||0).toFixed(0), rpe:S.rpeCur, inc:+(aInc||0).toFixed(1)}; S._perDrag.push(S.lastDrag); }
  const per={hr:[],spd:[],w:[],inc:[]};
  function tick(){ if(S.paused||!S.running) return; S.tTot++; const c=current(); const spdNow=c?.kind==='Pause'?0:(AppState.tm?.speed||0); const incNow=AppState.tm?.incline||0; const hrNow=AppState.hr?.bpm||0; S.dist+=spdNow/3600; const t=Date.now()/1000; if(hrNow) S.hrSeries.push({t,bpm:hrNow}); S.spdSeries.push({t,kmh:spdNow}); S.incSeries.push({t,pct:incNow}); if(c?.kind==='Arbeid'){ if(hrNow) per.hr.push(hrNow); per.spd.push(spdNow); const mass=(AppState.settings?.mass)||75; const v=spdNow/3.6, i=(incNow||0)/100; const Wkg=(4.185*v+(9.81*v*i)/((AppState.settings?.met_eff)||0.25))*(1-((AppState.settings?.shoe_gain_pct||0)/100))*((AppState.settings?.tm_cal)||1); const W=Wkg*mass; per.w.push(W); per.inc.push(incNow); if(S.P2){ const IF=Wkg/ S.P2; S.tssLoad += (1*(IF*IF)); } }
    drawGraph(); updateUI(); S.left--; if(S.left<=0){ if(c?.kind==='Arbeid') pushDrag(per); per.hr.length=per.spd.length=per.w.length=per.inc.length=0; S.idx++; setPhase(); } }
  function finish(saved){ if(S.timer){clearInterval(S.timer);S.timer=null;} const plan=S.plan; const session=saved?{id:'s_'+Date.now(), name:String(plan.name), endedAt:Date.now(), dist:S.dist, total:S.tTot, seq:S.seq, perDrag:S._perDrag, hrSeries:S.hrSeries, spdSeries:S.spdSeries, incSeries:S.incSeries}:null; reset(); if(saved&&session){ const st=AppState; st.logg=st.logg||[]; st.logg.push(session); Storage.saveP(AppState.currentProfile,'logg',st.logg); location.hash='#/result?id='+session.id; } else { S.plan=plan; S.seq=expand(plan); S.idx=0; S.left=S.seq[0]?S.seq[0].dur:0; updateUI(true); } }
  function updateUI(){ const spd=AppState.tm?.speed||0, inc=AppState.tm?.incline||0, hr=AppState.hr?.bpm||0; const pow=(function(){ const mass=(AppState.settings?.mass)||75; const v=spd/3.6, i=(inc||0)/100; const Wkg=(4.185*v+(9.81*v*i)/((AppState.settings?.met_eff)||0.25))*(1-((AppState.settings?.shoe_gain_pct||0)/100))*((AppState.settings?.tm_cal)||1); return {Wkg, W:Wkg*mass}; })();
    const res=(typeof PI!=='undefined'&&PI.computeLive)? PI.computeLive(): null; const piEl=document.getElementById('wk_pi'); if(piEl) piEl.textContent=res&&res.PI?res.PI.toFixed(2):'–'; const dEl=document.getElementById('wk_dhr'); if(dEl) dEl.textContent= res? String(Math.round(res.dHR||0)):'0';
    const h=document.getElementById('wk_hr'); if(h) h.textContent=String(hr||0); const s=document.getElementById('wk_spd'); if(s) s.textContent=`${spd.toFixed(1)} km/t`; const i=document.getElementById('wk_inc'); if(i) i.textContent=`${Math.round(inc)}%`; const w=document.getElementById('wk_pow'); if(w) w.textContent=`${Math.round(pow.W)} W`; const tss=document.getElementById('wk_tss'); if(tss){ const v=(S.tssLoad/3600)*100; tss.textContent=String(Math.round(v)); }
    const tot=document.getElementById('wk_tot'); if(tot) tot.textContent=UI.fmtTime(S.tTot); const dist=document.getElementById('wk_dist'); if(dist) dist.textContent=S.dist.toFixed(2);
    const aHR=document.getElementById('wk_avgHR'); if(aHR) aHR.textContent=String(S.lastDrag.hr); const aS=document.getElementById('wk_avgSpd'); if(aS) aS.textContent=String(S.lastDrag.spd); const aW=document.getElementById('wk_avgPow'); if(aW) aW.textContent=String(S.lastDrag.watt);
    const rpe=document.getElementById('wk_rpe'); if(rpe) rpe.textContent=(S.rpeCur||6).toFixed(1);
  }
  function drawGraph(){ const canvas=document.getElementById('wk_canvas'); if(!canvas) return; const ctx=canvas.getContext('2d'); const W=canvas.width, H=canvas.height; ctx.clearRect(0,0,W,H);
    // hent siste 180 punkter (~3 min ved 1Hz)
    const hr=S.hrSeries.slice(-180), spd=S.spdSeries.slice(-180), inc=S.incSeries.slice(-180);
    if(!hr.length && !spd.length && !inc.length){ ctx.fillStyle='#999'; ctx.fillText('Ingen data ennå…', 10, 16); return; }
    // skaler
    const t0=Math.min(...[hr[0]?.t||Infinity, spd[0]?.t||Infinity, inc[0]?.t||Infinity]);
    const tN=Math.max(...[hr.at(-1)?.t||0, spd.at(-1)?.t||0, inc.at(-1)?.t||0]);
    const span=Math.max(1, tN-t0);
    const mapX=t=> Math.round((t-t0)/span*(W-10))+5;
    function plot(series,color,accessor,yMin,yMax){ if(!series.length) return; ctx.strokeStyle=color; ctx.lineWidth=1.5; ctx.beginPath(); series.forEach((p,idx)=>{ const x=mapX(p.t); const v=accessor(p); const y=H-5- ( (v-yMin)/Math.max(1,(yMax-yMin)) * (H-10) ); if(idx===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }); ctx.stroke(); }
    // HR 60..200, Fart 0..20, Stigning 0..15
    plot(hr,'#e74c3c',p=>p.bpm||0,60,200);
    plot(spd,'#0d6efd',p=>p.kmh||0,0,20);
    plot(inc,'#f59e0b',p=>p.pct||0,0,15);
  }
  function init(plan){ reset(); S.plan=plan; S.seq=expand(plan); S.idx=0; S.left=S.seq[0]?S.seq[0].dur:0; }
  return { S, init, startToggle, prev, next, finish };
})();

const Workout={ onHR:null, onTM:null, render(el,st){ el.innerHTML='';
  const plan=st.plan || (st.workouts&&st.workouts[0]) || { name:'6x6', blocks:[{kind:'Oppvarming',dur:300},{kind:'Intervall',reps:6,work:360,rest:120},{kind:'Nedjogg',dur:300}] };
  const grid=UI.h('div',{class:'grid grid-2'});

  // Venstre panel – live
  const panel=UI.h('div',{class:'card'});
  const left=UI.h('div',{}); left.append(UI.h('div',{class:'small'},'Puls'), UI.h('div',{id:'wk_hr',style:'font-size:3rem;font-weight:700'},'0'));
  const mid=UI.h('div',{});
  mid.append(UI.h('div',{class:'small'},'Fart'));
  mid.append(UI.h('div',{id:'wk_spd',style:'font-size:1.6rem'},'0.0 km/t'));
  const spdCtl=UI.h('div',{class:'controls'});
  spdCtl.append(UI.h('button',{class:'btn',id:'wk_spdDec'},UI.icon('ph-minus')),
                UI.h('button',{class:'btn',id:'wk_spdInc'},UI.icon('ph-plus')));
  const spdQuick=UI.h('div',{class:'controls'});
  ;[6,8,10,12,14,16].forEach(v=>{ spdQuick.append(UI.h('button',{class:'btn',onclick:()=>{AppState.tm.speed=v; AppState.tm.manualUntil=Date.now()+4000;}}, `${v} km/t`)); });
  mid.append(spdCtl, UI.h('div',{class:'small'},'Hurtigvalg'), spdQuick);
  mid.append(UI.h('div',{class:'small',style:'margin-top:.4rem'},'Stigning'));
  mid.append(UI.h('div',{id:'wk_inc',style:'font-size:1.6rem'},'0%'));
  const incCtl=UI.h('div',{class:'controls'});
  incCtl.append(UI.h('button',{class:'btn',id:'wk_incDec'},UI.icon('ph-minus')),
                UI.h('button',{class:'btn',id:'wk_incInc'},UI.icon('ph-plus')));
  mid.append(incCtl);

  const right=UI.h('div',{});
  right.append(UI.h('div',{class:'small'},'Watt (est.)'), UI.h('div',{id:'wk_pow',style:'font-size:1.6rem'},'0 W'));
  right.append(UI.h('div',{class:'small'},'PI'), UI.h('div',{id:'wk_pi',style:'font-size:1.6rem'},'–'));
  right.append(UI.h('div',{class:'small'},'HR-drift'), UI.h('div',{id:'wk_dhr',style:'font-size:1.6rem'},'0'));
  right.append(UI.h('div',{class:'small'},'TSS (akk.)'), UI.h('div',{id:'wk_tss',style:'font-size:1.2rem'},'–'));

  panel.style.display='grid'; panel.style.gridTemplateColumns='1.1fr 1.3fr 1fr'; panel.style.gap='.5rem'; panel.append(left,mid,right);

  // Høyre – kontroll + graf + stats
  const box=UI.h('div',{class:'card'});
  const toggle=UI.h('button',{class:'btn',id:'wk_toggle'},UI.icon('ph-play')); const prev=UI.h('button',{class:'btn',id:'wk_prev'},UI.icon('ph-caret-left')); const next=UI.h('button',{class:'btn',id:'wk_next'},UI.icon('ph-caret-right')); const save=UI.h('button',{class:'btn',id:'wk_save'},UI.icon('ph-floppy-disk')); const disc=UI.h('button',{class:'btn danger',id:'wk_discard'},UI.icon('ph-trash'));
  box.append(UI.h('div',{},UI.h('div',{class:'small'},`Økt: ${plan.name}`)), UI.h('div',{class:'controls'},toggle,prev,next,save,disc), UI.h('div',{class:'controls'}, UI.h('div',{},UI.h('div',{class:'small'},'Totaltid'), UI.h('div',{id:'wk_tot'},'00:00')), UI.h('div',{},UI.h('div',{class:'small'},'Distanse (km)'), UI.h('div',{id:'wk_dist'},'0.00'))));

  const graph=UI.h('div',{class:'card'});
  graph.append(UI.h('div',{class:'legend'},
    UI.h('div',{class:'item'}, UI.h('span',{class:'dot',style:'background:#e74c3c'}), 'HR'),
    UI.h('div',{class:'item'}, UI.h('span',{class:'dot',style:'background:#0d6efd'}), 'Fart'),
    UI.h('div',{class:'item'}, UI.h('span',{class:'dot',style:'background:#f59e0b'}), 'Stigning')
  ));
  const canvas=UI.h('canvas',{id:'wk_canvas',width:640,height:140,class:'canvas-wrap'});
  graph.append(canvas);

  const stats=UI.h('div',{class:'card'}); const t=document.createElement('table'); t.className='table'; t.innerHTML='<tr><th>For siste drag</th><th>Verdi</th></tr><tr><td>Snittpuls</td><td id="wk_avgHR">-</td></tr><tr><td>Snittfart (km/t)</td><td id="wk_avgSpd">-</td></tr><tr><td>SnittWatt</td><td id="wk_avgPow">-</td></tr><tr><td>RPE nå</td><td><div id="wk_rpe">6.0</div><div class="controls"><button class="btn" id="wk_rpeDec">−</button><button class="btn" id="wk_rpeInc">+</button></div></td></tr>';
  stats.append(t);

  const leftCol=document.createElement('div'); leftCol.append(panel);
  const rightCol=document.createElement('div'); rightCol.append(box,graph,stats);
  grid.append(leftCol,rightCol);
  el.append(grid);

  // init engine
  WorkoutEngine.init(plan);

  // bindings
  const q=id=>document.getElementById(id);
  q('wk_toggle').addEventListener('click', ()=>WorkoutEngine.startToggle());
  q('wk_prev').addEventListener('click', ()=>WorkoutEngine.prev());
  q('wk_next').addEventListener('click', ()=>WorkoutEngine.next());
  q('wk_save').addEventListener('click', ()=>WorkoutEngine.finish(true));
  q('wk_discard').addEventListener('click', ()=>{ if(confirm('Forkaste økt?')) WorkoutEngine.finish(false); });
  q('wk_spdDec').addEventListener('click', ()=>{ AppState.tm.speed=Math.max(0,(AppState.tm.speed||0)-0.1); AppState.tm.manualUntil=Date.now()+4000; });
  q('wk_spdInc').addEventListener('click', ()=>{ AppState.tm.speed=(AppState.tm.speed||0)+0.1; AppState.tm.manualUntil=Date.now()+4000; });
  q('wk_incDec').addEventListener('click', ()=>{ AppState.tm.incline=Math.max(0,(AppState.tm.incline||0)-1); AppState.tm.manualUntil=Date.now()+4000; });
  q('wk_incInc').addEventListener('click', ()=>{ AppState.tm.incline=(AppState.tm.incline||0)+1; AppState.tm.manualUntil=Date.now()+4000; });
  q('wk_rpeDec').addEventListener('click', ()=>{ WorkoutEngine.S.rpeCur=Math.max(1,(WorkoutEngine.S.rpeCur||6)-0.5); document.getElementById('wk_rpe').textContent=WorkoutEngine.S.rpeCur.toFixed(1); });
  q('wk_rpeInc').addEventListener('click', ()=>{ WorkoutEngine.S.rpeCur=Math.min(10,(WorkoutEngine.S.rpeCur||6)+0.5); document.getElementById('wk_rpe').textContent=WorkoutEngine.S.rpeCur.toFixed(1); });

  // keyboard shortcuts
  window.onkeydown=(ev)=>{
    if(ev.target && ['INPUT','TEXTAREA','SELECT'].includes(ev.target.tagName)) return;
    if(ev.code==='Space'){ ev.preventDefault(); WorkoutEngine.startToggle(); }
    if(ev.key==='ArrowUp'){ AppState.tm.speed=(AppState.tm.speed||0)+0.1; AppState.tm.manualUntil=Date.now()+4000; }
    if(ev.key==='ArrowDown'){ AppState.tm.speed=Math.max(0,(AppState.tm.speed||0)-0.1); AppState.tm.manualUntil=Date.now()+4000; }
    if(ev.key==='ArrowRight'){ AppState.tm.incline=(AppState.tm.incline||0)+1; AppState.tm.manualUntil=Date.now()+4000; }
    if(ev.key==='ArrowLeft'){ AppState.tm.incline=Math.max(0,(AppState.tm.incline||0)-1); AppState.tm.manualUntil=Date.now()+4000; }
  };

  // hooks for BT
  Workout.onHR=(bpm)=>{ const t=Date.now()/1000; WorkoutEngine.S.hrSeries.push({t,bpm}); };
  Workout.onTM=(spd,inc)=>{ const now=Date.now(); if(spd!==null && (!AppState.tm.manualUntil || now>AppState.tm.manualUntil)) AppState.tm.speed=spd; if(inc!==null) AppState.tm.incline=inc; };
}};
