const Workout = {
  onHR:null, onTM:null,
  render(el, st){
    el.innerHTML=''; const plan = st.plan || st.workouts[0]; if(!plan){ el.textContent='Ingen økt valgt.'; return; }

    const grid = UI.h('div',{class:'grid-okt'});

    // YTELSE
    const yt = UI.h('section',{class:'ytelse'});
    const hrBig = UI.h('div',{class:'kpi-col'}, UI.h('div',{class:'kpi-label'},'Puls'), UI.h('div',{class:'big', id:'hr'}, String(st.hr.bpm||0)), UI.h('div',{class:'sub', id:'hrp'}, ''));
    const spdCol = UI.h('div',{class:'kpi-col'}, UI.h('div',{class:'kpi-label'},'Fart / Stigning'), UI.h('div',{class:'kpi-val', id:'spd'}, '0.0 km/t'), UI.h('div',{class:'kpi-val', id:'inc'}, '0%'));
    const spdCtrls = UI.h('div',{class:'kpi-col'}, UI.h('div',{class:'kpi-label'},'Juster (manuell)'),
      UI.h('div',{class:'controls'}, UI.h('button',{class:'btn',onclick:()=>{ st.tm.speed=Math.max(0,(st.tm.speed||0)-0.1); updSPD(); }},'-'), UI.h('button',{class:'btn',onclick:()=>{ st.tm.speed=(st.tm.speed||0)+0.1; updSPD(); }},'+')),
      UI.h('div',{class:'controls'}, UI.h('button',{class:'btn',onclick:()=>{ st.tm.incline=Math.max(0,(st.tm.incline||0)-1); updINC(); }},'-'), UI.h('button',{class:'btn',onclick:()=>{ st.tm.incline=(st.tm.incline||0)+1; updINC(); }},'+'))
    );
    yt.append(hrBig, spdCol, spdCtrls);

    // GRAF
    const graf = UI.h('section',{class:'graf'}); Graph.init(graf, {lt1:st.settings.lt1, lt2:st.settings.lt2, soner: st.settings.soner});

    // ØKTPANEL
    const op = UI.h('section',{class:'oktpanel'});
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
    op.append(UI.h('h2',{},plan.name), phaseNow, phaseNext, phaseNext2, timer, ctrl);

    // STAT PANEL
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

    grid.append(yt, graf, op, stat); el.append(grid);

    // --- STATE ---
    const seq = expand(plan.blocks);
    let idx=0, left=0, started=false, paused=false, timerHandle=null; let tTot=0, tDrag=0, dist=0; const hrSamples=[]; const spdSamples=[];

    function expand(blocks){
      const out=[]; blocks.forEach(b=>{
        if(b.kind==='Oppvarming'||b.kind==='Nedjogg'||b.kind==='Pause') out.push({kind:b.kind, dur:b.dur});
        else if(b.kind==='Intervall'){ for(let i=1;i<=b.reps;i++){ out.push({kind:'Arbeid', dur:b.work, rep:i, reps:b.reps}); if(b.rest>0) out.push({kind:'Pause', dur:b.rest}); } }
        else if(b.kind==='Serie'){ for(let s=1;s<=b.series;s++){ for(let i=1;i<=b.reps;i++){ out.push({kind:'Arbeid', dur:b.work, rep:i, reps:b.reps, set:s, sets:b.series}); if(b.rest>0) out.push({kind:'Pause', dur:b.rest}); } if(s<b.series && b.seriesRest) out.push({kind:'Pause', dur:b.seriesRest}); } }
      }); return out;
    }

    function updSPD(){ document.getElementById('spd').textContent = `${(st.tm.speed||0).toFixed(1)} km/t`; Graph.addSPD(st.tm.speed||0); }
    function updINC(){ document.getElementById('inc').textContent = `${Math.round(st.tm.incline||0)}%`; }

    Workout.onHR = bpm=>{ document.getElementById('hr').textContent=String(bpm); const p=Math.round((bpm/(st.settings.hrmax||190))*100); document.getElementById('hrp').textContent=`~${p}% av maks`; Graph.addHR(bpm); };
    Workout.onTM = (s,i)=>{ st.tm.speed=s; st.tm.incline=i; updSPD(); updINC(); };

    function setPhase(){ const cur = seq[idx]; if(!cur){ finish(true); return; } left=cur.dur; phaseNow.textContent = label(cur); phaseNext.textContent = seq[idx+1]? ('Neste: '+label(seq[idx+1])):''; phaseNext2.textContent = seq[idx+2]? ('Deretter: '+label(seq[idx+2])):''; document.getElementById('tLeft').textContent = UI.fmtTime(totalRemaining()); tDrag=0;}
    function label(x){ let base=x.kind; if(x.kind==='Arbeid' && x.rep) base+=` drag ${x.rep}/${x.reps}${x.set?`, serie ${x.set}/${x.sets||1}`:''}`; return base; }
    function totalRemaining(){ return seq.slice(idx).reduce((a,b)=>a+b.dur,0); }

    function tick(){ if(paused) return; tTot++; tDrag++; document.getElementById('tTot').textContent=UI.fmtTime(tTot); document.getElementById('tDrag').textContent=UI.fmtTime(tDrag); document.getElementById('timer').textContent=UI.fmtTime(left); document.getElementById('clock2').textContent=new Date().toLocaleTimeString();
      // Distanseintegrasjon (km/h * s / 3600)
      const cur = seq[idx]; const spdNow = (cur.kind==='Pause')? 0 : (st.tm.speed||0); dist += spdNow/3600; document.getElementById('dist').textContent = dist.toFixed(2);
      // samples for drag avg
      if(cur.kind==='Arbeid'){ if(st.hr.bpm) hrSamples.push(st.hr.bpm); spdSamples.push(spdNow); }
      left--; if(left<=0){
        // write stats for drag
        if(cur.kind==='Arbeid'){
          const aHR = Math.round(hrSamples.reduce((a,b)=>a+b,0)/(hrSamples.length||1));
          const aSpd = (spdSamples.reduce((a,b)=>a+b,0)/(spdSamples.length||1)).toFixed(1);
          document.getElementById('avgHR').textContent = String(aHR);
          document.getElementById('avgSpd').textContent = String(aSpd);
          hrSamples.length=0; spdSamples.length=0;
        }
        idx++; setPhase();
      }
    }

    function start(){ if(started) return; started=true; paused=false; setPhase(); timerHandle=setInterval(tick,1000); document.getElementById('start').disabled=true; ['pause','prev','next','save','discard'].forEach(id=>document.getElementById(id).disabled=false); }
    function togglePause(){ paused=!paused; document.getElementById('pause').textContent = paused? 'Gjenoppta':'Pause'; }
    function next(){ idx=Math.min(seq.length, idx+1); setPhase(); }
    function prev(){ idx=Math.max(0, idx-1); setPhase(); }
    function finish(saved){ clearInterval(timerHandle); if(saved){ const session={id:'s_'+Date.now(), name:plan.name, endedAt:Date.now(), dist:dist, total:tTot, seq:seq}; st.logg.push(session); Storage.save('logg', st.logg); } location.hash='#/dashboard'; }

    document.getElementById('start').addEventListener('click', start);
    document.getElementById('pause').addEventListener('click', togglePause);
    document.getElementById('next').addEventListener('click', next);
    document.getElementById('prev').addEventListener('click', prev);
    document.getElementById('save').addEventListener('click', ()=>finish(true));
    document.getElementById('discard').addEventListener('click', ()=>{ if(confirm('Forkaste uten å lagre?')) finish(false); });

    // init
    updSPD(); updINC();
  }
};
