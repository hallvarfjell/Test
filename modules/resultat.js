const Resultat = {
  render(el, state){
    el.innerHTML='';
    const last = state.logg[state.logg.length-1];
    const wrap = UI.h('div',{class:'card'});
    wrap.append(UI.h('h2',{}, last? (last.name+' – '+ new Date(last.endedAt).toLocaleString()):'Ingen økter enda'));
    if(last){
      const tbl = UI.h('table',{class:'table'});
      tbl.innerHTML = `<tr><th>Felt</th><th>Verdi</th></tr>
        <tr><td>PI</td><td>${last.pi??'-'}</td></tr>
        <tr><td>Antall drag (registrert)</td><td>${last.stats.length}</td></tr>`;
      const notes = UI.h('div',{class:'list'});
      last.stats.forEach(s=>{
        notes.appendChild(UI.h('div',{class:'list-item'}, `${new Date(s.when).toLocaleTimeString()} – ${s.phase}${s.rep?(' drag '+s.rep):''} – HR:${s.avgHR??'-'} RPE:${s.rpe??'-'} ${s.note||''}`));
      });
      wrap.append(tbl, UI.h('h3',{},'Detaljer'), notes);
    }
    el.append(UI.h('h1',{class:'h1'},'Resultat'), wrap);
  }
};
