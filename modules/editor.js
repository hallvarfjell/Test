const Editor={ render(el,st){ el.innerHTML='';
  const c=UI.h('div',{class:'card'});
  c.append(UI.h('h2',{},'Editor'));
  c.append(UI.h('p',{},'Her kan vi etter hvert lage/redigere øktplaner. Inntil videre brukes en enkel standardplan i Økt.'));
  el.append(c);
}};