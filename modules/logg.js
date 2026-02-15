const Logg = {
  render(el, state){
    el.innerHTML='';
    const list = UI.h('div',{class:'list'});
    state.logg.slice().reverse().forEach(s=>{
      const row = UI.h('div',{class:'list-item'});
      row.append(`${new Date(s.endedAt).toLocaleString()} – ${s.name} – PI: ${s.pi??'-'}`);
      row.appendChild(UI.h('div',{class:'controls'},
        UI.h('button',{class:'btn', onclick:()=>{ Storage.save('last_view', s.id); location.hash='#/resultat'; }},'Vis'),
        UI.h('button',{class:'btn danger', onclick:()=>{ if(confirm('Slette økt?')){ state.logg = state.logg.filter(x=>x.id!==s.id); Storage.save('logg', state.logg); Logg.render(el, state); } }},'Slett')
      ));
      list.appendChild(row);
    });
    el.append(UI.h('h1',{class:'h1'},'Logg'), list);
  }
};
