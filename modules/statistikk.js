const Statistikk = {
  render(el, state){
    el.innerHTML='';
    const wrap = UI.h('div',{class:'card'});
    wrap.append(UI.h('h2',{},'Sammenlign økter'), UI.h('p',{class:'small'},'Velg flere økter av samme type for å vurdere fremgang. (Forenklet visning)'));
    const list = UI.h('div',{class:'list'});
    state.logg.slice().reverse().forEach(s=>{
      list.appendChild(UI.h('label',{class:'list-item'},
        UI.h('input',{type:'checkbox', value:s.id, onchange:()=>update()}),
        ` ${new Date(s.endedAt).toLocaleString()} – ${s.name} – PI ${s.pi??'-'}`
      ));
    });
    const out = UI.h('div',{class:'list'});

    function update(){
      out.innerHTML='';
      const ids=[...list.querySelectorAll('input:checked')].map(i=>i.value);
      const sel = state.logg.filter(s=>ids.includes(s.id));
      if(sel.length){
        const avgPI = Math.round(sel.reduce((a,b)=>a+(b.pi||0),0)/sel.length);
        out.appendChild(UI.h('div',{class:'list-item'},`Gjennomsnittlig PI: ${avgPI}`));
      }
    }

    wrap.append(list, UI.h('h3',{},'Oppsummert'), out);
    el.append(UI.h('h1',{class:'h1'},'Statistikk'), wrap);
  }
};
