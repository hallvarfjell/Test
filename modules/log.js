const LogMod={ render(el,st){ el.innerHTML='';
  const c=UI.h('div',{class:'card'});
  c.append(UI.h('h2',{},'Logg'));
  const list=UI.h('div',{});
  const L=(st.logg||[]).slice().reverse();
  if(!L.length) list.append(UI.h('p',{},'Ingen økter ennå.'));
  L.forEach(s=>{
    const a=UI.h('a',{href:'#/result?id='+s.id}, new Date(s.endedAt).toLocaleString());
    list.append(UI.h('div',{}, a, ' – ', s.name||'Økt'));
  });
  c.append(list);
  el.append(c);
}};