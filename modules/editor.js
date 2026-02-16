const Editor = {
  render(el, st){
    el.innerHTML='';
    const plan = st.plan || {id:'w_new', name:'Ny økt', blocks:[]};
    const wrap = UI.h('div',{class:'card'});
    const name = UI.h('input',{class:'input', value: plan.name});

    const list = UI.h('div',{class:'list'});
    function redraw(){
      list.innerHTML=''; plan.blocks.forEach((b,i)=>{
        const it = UI.h('div',{class:'list-item'});
        it.append(textBlock(b));
        it.append(UI.h('div',{class:'controls'},
          UI.h('button',{class:'btn',onclick:()=>{ plan.blocks.splice(i,1); redraw(); }},'Slett')
        ));
        list.appendChild(it);
      });
    }
    function textBlock(b){
      if(b.kind==='Oppvarming'||b.kind==='Nedjogg'||b.kind==='Pause') return `${b.kind} ${b.dur}s`;
      if(b.kind==='Intervall') return `Intervall ${b.reps}× arbeid ${b.work}s / pause ${b.rest}s`;
      if(b.kind==='Serie') return `Serie ${b.series}× {${b.reps}×${b.work}/${b.rest}} seriepause ${b.seriesRest}s`;
      return JSON.stringify(b);
    }

    function addBlock(kind){
      if(kind==='Oppvarming'||kind==='Nedjogg'||kind==='Pause'){
        const dur = parseInt(prompt('Varighet (sekunder):','300'))||300; plan.blocks.push({kind, dur});
      }else if(kind==='Intervall'){
        const reps = parseInt(prompt('Antall drag:','6'))||1; const work=parseInt(prompt('Arbeid (sek):','60'))||60; const rest=parseInt(prompt('Pause (sek):','60'))||60; plan.blocks.push({kind, reps, work, rest});
      }else if(kind==='Serie'){
        const series = parseInt(prompt('Antall serier:','3'))||1; const reps=parseInt(prompt('Drag pr serie:','10'))||1; const work=parseInt(prompt('Arbeid (sek):','45'))||45; const rest=parseInt(prompt('Pause (sek):','15'))||15; const seriesRest=parseInt(prompt('Seriepause (sek):','60'))||60; plan.blocks.push({kind, series, reps, work, rest, seriesRest});
      }
      redraw();
    }

    const controls = UI.h('div',{class:'controls'},
      UI.h('button',{class:'btn',onclick:()=>addBlock('Oppvarming')},'Oppvarming'),
      UI.h('button',{class:'btn',onclick:()=>addBlock('Intervall')},'Intervall'),
      UI.h('button',{class:'btn',onclick:()=>addBlock('Serie')},'Serie (45/15, osv)'),
      UI.h('button',{class:'btn',onclick:()=>addBlock('Pause')},'Seriepause/Annet'),
      UI.h('button',{class:'btn',onclick:()=>addBlock('Nedjogg')},'Nedjogg')
    );

    const save = UI.h('button',{class:'btn primary', onclick:()=>{
      plan.name = name.value||plan.name; const idx = st.workouts.findIndex(w=>w.id===plan.id);
      if(idx>=0) st.workouts[idx]=plan; else st.workouts.push(plan);
      Storage.save('workouts', st.workouts); alert('Lagret.'); location.hash='#/dashboard';
    }}, 'Lagre');

    redraw();
    wrap.append(UI.h('h2',{},'Økteditor'), name, controls, UI.h('h3',{},'Blokker'), list, save);
    el.append(UI.h('h1',{class:'h1'},'Editor'), wrap);
  }
};
