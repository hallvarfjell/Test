const Editor={ render(el,st){ el.innerHTML=''; const plan=st.plan||{id:'w_'+Date.now(),name:'Ny økt',blocks:[]}; const wrap=UI.h('div',{class:'card'});
  const name=UI.h('input',{class:'input',value:plan.name,style:'margin-bottom:.5rem'}); wrap.append(name);
  function row(b,i){ const r=UI.h('div',{class:'list-item'}); const kindSel=UI.h('select',{}, ...['Oppvarming','Intervall','Serie','Fartlek','Pause','Nedjogg'].map(k=>{ const o=document.createElement('option'); o.value=k; o.textContent=k; if(b.kind===k) o.selected=true; return o; })); kindSel.onchange=()=>{ b.kind=kindSel.value; if(['Oppvarming','Pause','Nedjogg'].includes(b.kind)) b.dur=b.dur||300; if(b.kind==='Intervall'){ b.reps=b.reps||6; b.work=b.work||60; b.rest=b.rest||60; } if(b.kind==='Serie'){ b.series=b.series||3; b.reps=b.reps||10; b.work=b.work||45; b.rest=b.rest||15; b.seriesRest=b.seriesRest||60; } if(b.kind==='Fartlek'){ b.reps=b.reps||10; b.on=b.on||60; b.off=b.off||60; } redraw(); };
    const cfg=UI.h('div',{class:'controls'});
    function num(lbl,prop,step=1){ const inp=UI.h('input',{type:'number',value:String(b[prop]||0),step:String(step),style:'width:90px'}); inp.oninput=()=>{ b[prop]=parseInt(inp.value)||0; }; return UI.h('div',{class:'controls'}, UI.h('label',{class:'small',style:'min-width:110px'},lbl), inp); }
    cfg.append(kindSel);
    if(['Oppvarming','Pause','Nedjogg'].includes(b.kind)) cfg.append(num('Varighet (s)','dur'));
    if(b.kind==='Intervall'){ cfg.append(num('Drag','reps')); cfg.append(num('Arbeid (s)','work')); cfg.append(num('Pause (s)','rest')); }
    if(b.kind==='Serie'){ cfg.append(num('Serier','series')); cfg.append(num('Drag/serie','reps')); cfg.append(num('Arbeid (s)','work')); cfg.append(num('Pause (s)','rest')); cfg.append(num('Seriepause (s)','seriesRest')); }
    if(b.kind==='Fartlek'){ cfg.append(num('Reps','reps')); cfg.append(num('På (s)','on')); cfg.append(num('Av (s)','off')); }
    const act=UI.h('div',{class:'controls'});
    act.append(UI.h('button',{class:'btn',onclick:()=>{ if(i>0){ [plan.blocks[i-1],plan.blocks[i]]=[plan.blocks[i],plan.blocks[i-1]]; redraw(); } }},'↑'));
    act.append(UI.h('button',{class:'btn',onclick:()=>{ if(i<plan.blocks.length-1){ [plan.blocks[i+1],plan.blocks[i]]=[plan.blocks[i],plan.blocks[i+1]]; redraw(); } }},'↓'));
    act.append(UI.h('button',{class:'btn',onclick:()=>{ plan.blocks.splice(i+1,0,JSON.parse(JSON.stringify(b))); redraw(); }},'⎘'));
    act.append(UI.h('button',{class:'btn danger',onclick:()=>{ plan.blocks.splice(i,1); redraw(); }},'Slett'));
    r.append(cfg, act); return r; }
  const list=UI.h('div',{class:'list'});
  function redraw(){ list.innerHTML=''; (plan.blocks||[]).forEach((b,i)=> list.appendChild(row(b,i))); }
  function add(kind){ const b={kind}; if(['Oppvarming','Pause','Nedjogg'].includes(kind)) b.dur=300; if(kind==='Intervall'){ b.reps=6;b.work=60;b.rest=60;} if(kind==='Serie'){ b.series=3;b.reps=10;b.work=45;b.rest=15;b.seriesRest=60;} if(kind==='Fartlek'){ b.reps=10;b.on=60;b.off=60;} plan.blocks.push(b); redraw(); }
  const addBar=UI.h('div',{class:'controls'}); ['Oppvarming','Intervall','Serie','Fartlek','Pause','Nedjogg'].forEach(k=> addBar.append(UI.h('button',{class:'btn',onclick:()=>add(k)},k)) );
  const save=UI.h('button',{class:'btn primary',onclick:()=>{ plan.name=name.value||plan.name; const arr=st.workouts||[]; const idx=arr.findIndex(w=>w.id===plan.id); if(idx>=0) arr[idx]=plan; else arr.push(plan); st.workouts=arr; Storage.saveP(AppState.currentProfile,'workouts',arr); alert('Lagret.'); location.hash='#/dashboard'; }},'Lagre');
  redraw(); wrap.append(addBar, list, UI.h('div',{class:'controls'}, save)); el.append(wrap); }};
