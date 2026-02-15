const Dashboard = {
  render(el, state){
    el.innerHTML='';
    const header = UI.h('h1',{class:'h1'},'Dashboard');
    const descr = UI.h('p',{class:'small'},'Hurtigvalg av økt, editor og nylige økter.');

    const btnNew = UI.h('button',{class:'btn primary', onclick:()=>{ location.hash='#/okt'; }}, 'Start økt');
    const btnEditor = UI.h('button',{class:'btn', onclick:()=>{ Editor.open(el, state); }}, 'Økteditor');

    const recentList = UI.h('div',{class:'list'});
    (state.logg.slice(-5).reverse()).forEach(s=>{
      recentList.appendChild(UI.h('div',{class:'list-item'}, `${new Date(s.endedAt).toLocaleString()} – ${s.name||'Økt'} – PI: ${s.pi??'-'}`));
    });

    el.append(header, descr, UI.h('div',{class:'controls'}, btnNew, btnEditor), UI.h('h3',{},'Nylige økter'), recentList);
  }
};

// Minimal økteditor med blokker
const Editor = {
  open(el, state){
    const plan = state.okt.plan || { name:'Ny intervalløkt', blocks:[] };
    const c = UI.h('div', {class:'card'});
    const nameInp = UI.h('input',{class:'input', value:plan.name||'', placeholder:'Navn på økt'});

    const list = UI.h('div',{class:'list'});
    function redraw(){
      list.innerHTML='';
      plan.blocks.forEach((b,i)=>{
        const row = UI.h('div',{class:'list-item'});
        row.appendChild(UI.h('div',{}, `${b.type} – varighet ${b.dur||0}s ${b.reps? '×'+b.reps: ''} intensitet: ${b.int||'-'}`));
        row.appendChild(UI.h('div',{class:'small'}, b.note||''));
        row.appendChild(UI.h('div',{class:'controls'},
          UI.h('button',{class:'btn',onclick:()=>{ plan.blocks.splice(i,1); redraw(); }},'Slett')
        ));
        list.appendChild(row);
      });
    }

    function addBlock(type){
      const dur = parseInt(prompt('Varighet (sekunder):','60'))||60;
      let reps = null, pause=null;
      if(type==='Serie' || type==='Intervall'){ reps = parseInt(prompt('Antall repetisjoner:','6'))||1; }
      if(type==='Intervall') pause = parseInt(prompt('Pause (sekunder):','60'))||0;
      const intens = prompt('Intensitet (tekst, f.eks. "Hardt 85% av HRmax")','');
      plan.blocks.push({type, dur, reps, pause, int:intens});
      if(type==='Serie'){
        // legg til automatiske seriepauser mellom serier ved kopiering senere
      }
      redraw();
    }

    const controls = UI.h('div',{class:'controls'},
      UI.h('button',{class:'btn',onclick:()=>addBlock('Oppvarming')},'Oppvarming'),
      UI.h('button',{class:'btn',onclick:()=>addBlock('Intervall')},'Intervall (drag+pause)'),
      UI.h('button',{class:'btn',onclick:()=>addBlock('Kontinuerlig')},'Kontinuerlig'),
      UI.h('button',{class:'btn',onclick:()=>addBlock('Nedjogg')},'Nedjogg')
    );

    const save = UI.h('button',{class:'btn primary',onclick:()=>{ plan.name=nameInp.value; state.okt.plan=plan; Storage.save('plan', plan); alert('Økt lagret til enhet.'); }},'Lagre økt');

    redraw();
    c.append(UI.h('h2',{},'Økteditor'), nameInp, controls, UI.h('h3',{},'Blokker'), list, save, UI.h('div',{class:'small'},'Seriepauser legges inn manuelt inntil videre.'));
    el.innerHTML=''; el.append(UI.h('h1',{class:'h1'},'Editor'), c);
  }
};
