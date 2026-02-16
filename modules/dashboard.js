const Dashboard = {
  render(el, st){
    el.innerHTML='';
    const header = UI.h('h1',{class:'h1'},'Dashboard');
    const list = UI.h('div',{class:'list'});

    function row(w){
      const r = UI.h('div',{class:'list-item'});
      r.append(`${w.name} `);
      r.append(UI.h('span',{class:'small'}, describe(w)));
      r.append(UI.h('div',{class:'controls'},
        UI.h('button',{class:'btn', title:'Spill av', onclick:()=>{ st.plan=w; location.hash='#/workout'; }},'▶'),
        UI.h('button',{class:'btn', title:'Rediger', onclick:()=>{ st.plan=JSON.parse(JSON.stringify(w)); location.hash='#/editor'; }},'✎')
      ));
      return r;
    }

    function describe(w){
      for(const b of w.blocks){ if(b.kind==='Intervall') return `– ${b.reps}×${b.work/60} min arbeid / ${b.rest}s pause`; if(b.kind==='Serie') return `– ${b.series}× (${b.reps}×${b.work}s/${b.rest}s) med ${b.seriesRest}s seriepause`; }
      return '';
    }

    st.workouts.forEach(w=> list.appendChild(row(w)));
    const add = UI.h('button',{class:'btn primary', onclick:()=>{ st.plan={id:'w_new', name:'Ny økt', blocks:[]}; location.hash='#/editor'; }}, 'Ny økt');

    el.append(header, list, add);
  }
};
