const Dashboard={ render(el,st){ el.innerHTML='';
  const c=UI.h('div',{class:'card'});
  c.append(UI.h('h2',{},'Dashboard'));
  c.append(UI.h('div',{class:'controls'},
    UI.h('button',{class:'btn',onclick:()=>location.hash='#/workout'},UI.icon('ph-timer'),' Økt'),
    UI.h('button',{class:'btn',onclick:()=>location.hash='#/pi'},UI.icon('ph-gauge'),' PI'),
    UI.h('button',{class:'btn',onclick:()=>location.hash='#/log'},UI.icon('ph-clipboard-text'),' Logg')
  ));
  el.append(c);
}};