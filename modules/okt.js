const Okt = {
  hookOnHR:null, hookOnFTMS:null,
  render(el, state){
    el.innerHTML='';
    const grid = UI.h('div',{class:'grid-okt'});

    // YTELSESPANEL
    const yt = UI.h('section',{class:'ytelse'});
    const kpiHR = UI.h('div',{class:'kpi-col'},
      UI.h('div',{class:'kpi-label'},'Puls'),
      UI.h('div',{class:'big', id:'kpi-hr'}, String(state.hr.bpm||0)),
      UI.h('div',{class:'sub', id:'kpi-hr-sub'}, `~${Math.round((state.hr.bpm||0)/state.hr.max*100)||0}% av maks`)
    );

    function spd(val){ return UI.h('div',{class:'kpi-val', id:'kpi-spd'}, `${val.toFixed(1)} km/t`); }
    function inc(val){ return UI.h('div',{class:'kpi-val', id:'kpi-inc'}, `${Math.round(val)}%`); }

    const spdBox = UI.h('div',{class:'kpi-col'},
      UI.h('div',{class:'kpi-label'},'Fart / Stigning'),
      spd(state.ftms.speed||0), inc(state.ftms.incline||0)
    );
    const spdCtrls = UI.h('div',{class:'kpi-col'},
      UI.h('div',{class:'kpi-label'},'Juster (manuell)'),
      UI.h('div',{class:'controls'},
        UI.h('button',{class:'btn',onclick:()=>{ state.ftms.speed=Math.max(0,(state.ftms.speed||0)-0.1); updateSPD(); }},'-'),
        UI.h('button',{class:'btn',onclick:()=>{ state.ftms.speed=(state.ftms.speed||0)+0.1; updateSPD(); }},'+')
      ),
      UI.h('div',{class:'controls'},
        UI.h('button',{class:'btn',onclick:()=>{ state.ftms.incline=Math.max(0,(state.ftms.incline||0)-1); updateINC(); }},'-'),
        UI.h('button',{class:'btn',onclick:()=>{ state.ftms.incline=(state.ftms.incline||0)+1; updateINC(); }},'+')
      )
    );

    const piBtn = UI.h('div',{class:'kpi-col', style:'align-items:flex-end;'},
      UI.h('div',{class:'kpi-label'},'PI (trykk for simulator)'),
      UI.h('div',{class:'kpi-pi', id:'kpi-pi', onclick:()=>{ location.hash='#/sim'; }}, String(state.pi.current??'-'))
    );

    yt.append(kpiHR, spdBox, spdCtrls, piBtn);

    // GRAFPANEL
    const graf = UI.h('section',{class:'graf'});
    const grafTitle = UI.h('div',{class:'small'},'Puls (15 min) og fart (høyre akse). Slope (30s): ', UI.h('span',{id:'slope'},'0.00'));
    graf.appendChild(grafTitle);
    Graph.init(graf, {lt1:state.hr.lt1, lt2:state.hr.lt2, soner: state.settings.soner || [90,110,130,150,170]});

    // ØKTPANEL
    const op = UI.h('section',{class:'oktpanel'});
    const title = UI.h('h2',{},'Aktuell økt');
    const phase = UI.h('div',{id:'phase', class:'list-item'},'–');
    const timeLeft = UI.h('div',{id:'timeleft', class:'big'},'00:00');
    const rn = UI.h('div',{id:'repinfo', class:'small'},'');
    const rpeField = UI.h('input',{id:'rpe', class:'input', placeholder:'RPE (1–10) for forrige drag'});
    const noteField = UI.h('textarea',{id:'note', rows:2, placeholder:'Merknader for forrige drag'});

    const ctrl = UI.h('div',{class:'controls'},
      UI.h('button',{class:'btn primary', id:'btn-start'},'Start'),
      UI.h('button',{class:'btn warn', id:'btn-pause', disabled:true},'Pause'),
      UI.h('button',{class:'btn', id:'btn-skip', disabled:true},'Skip drag'),
      UI.h('button',{class:'btn', id:'btn-add', disabled:true},'+ drag'),
      UI.h('button',{class:'btn', id:'btn-sub', disabled:true},'- drag'),
      UI.h('button',{class:'btn danger', id:'btn-stop', disabled:true},'Stopp & lagre')
    );
    op.append(title, phase, rn, timeLeft, UI.h('h3',{},'Registrering (for forrige drag)'), rpeField, noteField, ctrl);

    // STATISTIKKPANEL
    const st = UI.h('section',{class:'stat'});
    const tbl = UI.h('table',{class:'table'});
    tbl.innerHTML = `<tr><th>Parameter</th><th>Verdi</th></tr>
      <tr><td>Tid brukt</td><td id="t-elapsed">00:00</td></tr>
      <tr><td>Snittpuls (drag)</td><td id="avg-hr">-</td></tr>
      <tr><td>Gjenstående total</td><td id="t-remaining">-</td></tr>`;
    st.append(UI.h('h2',{},'Statistikk'), tbl);

    grid.append(yt, graf, op, st);
    el.append(grid);

    // Plan
    const plan = state.okt.plan || Storage.load('plan', {
      name:'6x6 @85% HRmax',
      blocks:[{type:'Oppvarming', dur:600, int:'Lett'}, {type:'Intervall', dur:360, reps:6, pause:120, int:'Hardt 85% HRmax'}, {type:'Nedjogg', dur:300, int:'Rolig'}]
    });
    state.okt.plan = plan;

    // Avspillingstilstand
    const prog = { seq: expandPlan(plan), idx:0, remaining:0, dragStats:[], startT:null };
    state.okt.progress = prog;

    function expandPlan(plan){
      const out=[]; let set=1, total=0; // total tid for remaining
      plan.blocks.forEach(b=>{
        if(b.type==='Intervall'){
          for(let i=1;i<=b.reps;i++){
            out.push({kind:'Arbeid', dur:b.dur, int:b.int, rep:i, reps:b.reps, set:1});
            if(b.pause>0) out.push({kind:'Pause', dur:b.pause});
          }
        }else{
          const kind = b.type==='Oppvarming'?'Oppvarming':(b.type==='Nedjogg'?'Nedjogg':'Kontinuerlig');
          out.push({kind, dur:b.dur, int:b.int});
        }
      });
      return out;
    }

    function updateSPD(){ document.getElementById('kpi-spd').textContent = `${(state.ftms.speed||0).toFixed(1)} km/t`; Graph.addSPD(state.ftms.speed||0); }
    function updateINC(){ document.getElementById('kpi-inc').textContent = `${Math.round(state.ftms.incline||0)}%`; }

    Okt.hookOnHR = (bpm)=>{
      document.getElementById('kpi-hr').textContent = String(bpm);
      document.getElementById('kpi-hr-sub').textContent = `~${Math.round((bpm/(state.hr.max||190))*100)}% av maks`;
      Graph.addHR(bpm);
      document.getElementById('slope').textContent = Graph.slope30().toFixed(2);
    };
    Okt.hookOnFTMS = (spd,inc)=>{ state.ftms.speed=spd; state.ftms.incline=inc; updateSPD(); updateINC(); };

    // Kontrollknapper
    const bStart = document.getElementById('btn-start');
    const bPause = document.getElementById('btn-pause');
    const bSkip = document.getElementById('btn-skip');
    const bAdd = document.getElementById('btn-add');
    const bSub = document.getElementById('btn-sub');
    const bStop = document.getElementById('btn-stop');

    let tHandle=null, started=false, paused=false, cur=null, curLeft=0, tElapsed=0;

    function setPhase(){
      cur = prog.seq[prog.idx];
      if(!cur){ finish(); return; }
      curLeft = cur.dur;
      document.getElementById('phase').textContent = cur.kind + (cur.rep?` – Drag ${cur.rep}/${cur.reps}`:'') + (cur.int?` – ${cur.int}`:'');
      document.getElementById('repinfo').textContent = cur.rep?`Sett 1/1`:''; // senere støtte for flere sett
      document.getElementById('timeleft').textContent = UI.fmtTime(curLeft);
      document.getElementById('t-remaining').textContent = UI.fmtTime(prog.seq.slice(prog.idx).reduce((a,b)=>a+b.dur,0));
    }

    function tick(){
      if(paused) return;
      tElapsed++; document.getElementById('t-elapsed').textContent = UI.fmtTime(tElapsed);
      curLeft--; document.getElementById('timeleft').textContent = UI.fmtTime(curLeft);
      if(curLeft<=0){
        // registrer RPE/merknader
        const rpe = parseFloat(document.getElementById('rpe').value||'');
        const note = document.getElementById('note').value||'';
        prog.dragStats.push({when:Date.now(), phase:cur.kind, rep:cur.rep||null, dur:cur.dur, avgHR: state.hr.bpm||null, rpe, note});
        document.getElementById('rpe').value=''; document.getElementById('note').value='';
        prog.idx++; setPhase();
      }
    }

    function start(){ if(started) return; started=true; paused=false; bStart.disabled=true; bPause.disabled=false; bSkip.disabled=false; bAdd.disabled=false; bSub.disabled=false; bStop.disabled=false; setPhase(); tHandle=setInterval(tick,1000); }
    function pause(){ paused=!paused; bPause.textContent = paused? 'Gjenoppta':'Pause'; }
    function skip(){ prog.idx++; setPhase(); }
    function add(){ if(cur && cur.kind==='Arbeid'){ curLeft += 5; document.getElementById('timeleft').textContent = UI.fmtTime(curLeft); } }
    function sub(){ if(cur && cur.kind==='Arbeid'){ curLeft = Math.max(0, curLeft-5); document.getElementById('timeleft').textContent = UI.fmtTime(curLeft); } }

    function finish(){
      clearInterval(tHandle); bPause.disabled=true; bSkip.disabled=true; bAdd.disabled=true; bSub.disabled=true; bStop.disabled=true; bStart.disabled=true;
      // auto-lagre og gå til resultat
      const session = { id: 's_'+Date.now(), name: state.okt.plan?.name || 'Økt', endedAt: Date.now(), stats: prog.dragStats };
      // enkel PI plassholder: bruk snitt HR (arbeidsdrag) som baseline
      const work = prog.dragStats.filter(d=>d.phase==='Arbeid');
      const avg = work.reduce((a,b)=>a+(b.avgHR||0),0)/(work.length||1);
      session.pi = Math.round(avg||0);
      state.logg.push(session); Storage.save('logg', state.logg);
      state.pi.current = session.pi;
      location.hash = '#/resultat';
    }

    function stop(){ if(confirm('Økt kjører. Avslutte og lagre økta?')) finish(); }

    bStart.addEventListener('click', start);
    bPause.addEventListener('click', pause);
    bSkip.addEventListener('click', skip);
    bAdd.addEventListener('click', add);
    bSub.addEventListener('click', sub);
    bStop.addEventListener('click', stop);

    // Init verdier
    updateSPD(); updateINC();
  }
};
