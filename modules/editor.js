const Editor = { render(el, st){
  el.innerHTML='';
  const plan = st.plan || {id:'w_new', name:'Ny økt', blocks:[]};
  const wrap = UI.h('div',{class:'card editor-grid'});
  // Left side
  const left = UI.h('div',{});
  const name = UI.h('input',{class:'input', value: plan.name, placeholder:'Navn på økt'});
  const list = UI.h('div',{class:'list'});

  function blockRow(b,i){
    const it = UI.h('div',{class:'block', draggable:'true'});
    it.addEventListener('dragstart', ev=>{ ev.dataTransfer.setData('text/plain', i.toString()); });
    it.addEventListener('dragover', ev=>{ ev.preventDefault(); it.style.outline='2px dashed #c9d6f0'; });
    it.addEventListener('dragleave', ()=>{ it.style.outline=''; });
    it.addEventListener('drop', ev=>{ ev.preventDefault(); it.style.outline=''; const from = parseInt(ev.dataTransfer.getData('text/plain')); const to = i; if(!isNaN(from)&&from!==to){ const [blk]=plan.blocks.splice(from,1); plan.blocks.splice(to,0,blk); redraw(); } });

    const kindSel = UI.h('select',{}, ...['Oppvarming','Intervall','Serie','Pause','Nedjogg'].map(k=>{ const o=document.createElement('option'); o.value=k; o.textContent=k; if(b.kind===k) o.selected=true; return o; }));
    kindSel.addEventListener('change',()=>{ b.kind=kindSel.value; if(['Oppvarming','Pause','Nedjogg'].includes(b.kind)){ b.dur=b.dur||300; delete b.reps; delete b.work; delete b.rest; delete b.series; delete b.seriesRest; } else if(b.kind==='Intervall'){ b.reps=b.reps||6; b.work=b.work||60; b.rest=b.rest||60; } else if(b.kind==='Serie'){ b.series=b.series||3; b.reps=b.reps||10; b.work=b.work||45; b.rest=b.rest||15; b.seriesRest=b.seriesRest||60; } redraw(); });

    const cfg = UI.h('div',{class:'controls'});
    function num(lbl,prop){ const inp=UI.h('input',{type:'number', value:String(b[prop]||0), style:'width:90px'}); inp.addEventListener('input',()=>{ b[prop]=parseInt(inp.value)||0; }); return UI.h('div',{class:'controls'}, UI.h('label',{style:'min-width:110px'},lbl), inp); }
    cfg.append(kindSel);
    if(['Oppvarming','Pause','Nedjogg'].includes(b.kind)) cfg.append(num('Varighet (s)','dur'));
    if(b.kind==='Intervall'){ cfg.append(num('Drag','reps')); cfg.append(num('Arbeid (s)','work')); cfg.append(num('Pause (s)','rest')); }
    if(b.kind==='Serie'){ cfg.append(num('Serier','series')); cfg.append(num('Drag/serie','reps')); cfg.append(num('Arbeid (s)','work')); cfg.append(num('Pause (s)','rest')); cfg.append(num('Seriepause (s)','seriesRest')); }

    const actions = UI.h('div',{class:'controls'},
      UI.h('button',{class:'btn',onclick:()=>{ if(i>0){ [plan.blocks[i-1],plan.blocks[i]]=[plan.blocks[i],plan.blocks[i-1]]; redraw(); } }},'↑'),
      UI.h('button',{class:'btn',onclick:()=>{ if(i<plan.blocks.length-1){ [plan.blocks[i+1],plan.blocks[i]]=[plan.blocks[i],plan.blocks[i+1]]; redraw(); } }},'↓'),
      UI.h('button',{class:'btn danger',onclick:()=>{ plan.blocks.splice(i,1); redraw(); }},'Slett')
    );
    it.append(cfg, actions); return it;
  }

  function redraw(){ list.innerHTML=''; plan.blocks.forEach((b,i)=> list.appendChild(blockRow(b,i)) ); }
  function addBlock(kind){ const b={kind}; if(['Oppvarming','Pause','Nedjogg'].includes(kind)){ b.dur=300; } else if(kind==='Intervall'){ b.reps=6; b.work=60; b.rest=60; } else if(kind==='Serie'){ b.series=3; b.reps=10; b.work=45; b.rest=15; b.seriesRest=60; } plan.blocks.push(b); redraw(); }

  const controls = UI.h('div',{class:'controls'},
    UI.h('button',{class:'btn',onclick:()=>addBlock('Oppvarming')},'Oppvarming'),
    UI.h('button',{class:'btn',onclick:()=>addBlock('Intervall')},'Intervall'),
    UI.h('button',{class:'btn',onclick:()=>addBlock('Serie')},'Serie'),
    UI.h('button',{class:'btn',onclick:()=>addBlock('Pause')},'Pause'),
    UI.h('button',{class:'btn',onclick:()=>addBlock('Nedjogg')},'Nedjogg')
  );

  const save = UI.h('button',{class:'btn primary', onclick:()=>{ plan.name=name.value||plan.name; if(!st.workouts) st.workouts=[]; const idx = st.workouts.findIndex(w=>w.id===plan.id); if(idx>=0) st.workouts[idx]=plan; else { if(!plan.id) plan.id='w_'+Date.now(); st.workouts.push(plan);} Storage.saveP(AppState.currentProfile, 'workouts', st.workouts); alert('Lagret.'); location.hash='#/dashboard'; }}, 'Lagre');

  left.append(UI.h('h2',{},'Økteditor'), name, controls, UI.h('h3',{},'Blokker'), list, save);

  const right = UI.h('div',{class:'card'});
  const tbl = UI.h('table',{class:'table'}); tbl.innerHTML='<tr><th>#</th><th>Type</th><th>Lengde</th></tr>';
  (plan.blocks||[]).forEach((b,i)=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${i+1}</td><td>${b.kind}</td><td>${b.dur? (b.dur+'s') : (b.reps? (b.reps+'×'+b.work+'/'+(b.rest||0)+'s'):'')}</td>`; tbl.appendChild(tr); });
  right.append(UI.h('h3',{},'Forhåndsvisning'), tbl);

  wrap.append(left,right); el.append(UI.h('h1',{class:'h1'},'Editor'), wrap);
}};
