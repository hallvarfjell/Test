const LogMod={ render(el,st){ el.innerHTML=''; const c=UI.h('div',{class:'card'}); c.append(UI.h('h2',{},'Logg'), UI.h('pre',{}, JSON.stringify(st.logg||[],null,2))); el.append(c); } };
