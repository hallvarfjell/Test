const Sim = {
  render(el, state){
    el.innerHTML='';
    const back = UI.h('button',{class:'btn',onclick:()=>{ history.back(); }},'Tilbake til økt');
    const card = UI.h('div',{class:'card'});
    card.append(UI.h('h2',{},'Responssimulator (plassholder)'), UI.h('p',{},'Denne modulen kommer senere. Foreløpig vises en enkel PI basert på historikk.'), back);
    el.append(UI.h('h1',{class:'h1'},'Responssimulator'), card);
  }
};
