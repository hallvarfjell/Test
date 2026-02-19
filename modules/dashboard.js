const Dashboard={ render(el,st){ el.innerHTML='';
  const header = UI.h('div',{}, UI.h('h1',{class:'h1'},'Dashboard'));
  const profiles = UI.h('div',{class:'profiles'});
  function prof(name){ const b=UI.h('button',{class:'profile-btn'+(AppState.currentProfile===name?' selected':''), onclick:()=>setProfile(name)}, 'Profil: '+name); return b; }
  profiles.append(prof('Hallvar'), prof('Monika'));

  const actions = UI.h('div',{class:'controls'},
    UI.h('button',{class:'btn',onclick:exportBackup},'Eksporter backup'),
    UI.h('button',{class:'btn',onclick:importBackup},'Importer backup'),
    UI.h('button',{class:'btn primary',onclick:()=>{ st.plan={id:'w_new_'+Date.now(), name:'Ny økt', blocks:[]}; location.hash='#/editor'; }},'Ny økt')
  );

  const list = UI.h('div',{class:'list'});
  function describe(w){ for(const b of (w.blocks||[])){ if(b.kind==='Intervall') return `– ${b.reps}×${(b.work/60).toFixed(0)} min / ${b.rest}s`; if(b.kind==='Serie') return `– ${b.series}× (${b.reps}×${b.work}s/${b.rest}s) med ${b.seriesRest||0}s`; } return ''; }
  (st.workouts||Workouts.defaults()).forEach((w,idx)=>{
    const left = UI.h('div',{class:'grow'}, `${w.name} `);
    left.appendChild(UI.h('span',{class:'small'}, describe(w)));
    const btns = UI.h('div',{class:'controls'},
      UI.h('button',{class:'btn',title:'Spill av',onclick:()=>{ st.plan=w; location.hash='#/workout'; }},'▶'),
      UI.h('button',{class:'btn',title:'Rediger',onclick:()=>{ st.plan=JSON.parse(JSON.stringify(w)); location.hash='#/editor'; }},'✎'),
      UI.h('button',{class:'btn danger',title:'Slett',onclick:()=>{ if(confirm('Slette økta?')){ const arr=(st.workouts||[]); arr.splice(idx,1); st.workouts=arr; Storage.saveP(AppState.currentProfile,'workouts',arr); Dashboard.render(el,st); } }},'🗑')
    );
    const row = UI.h('div',{class:'list-item'}); row.append(left, btns); list.appendChild(row);
  });

  el.append(header, profiles, actions, list);

  function exportBackup(){
    const dump={ meta:{app:'INTZ Basic', ver:'1.3.2', ts:new Date().toISOString()}, items:{} };
    for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(!k||!k.startsWith('INTZ_')) continue; dump.items[k]=JSON.parse(localStorage.getItem(k)); }
    const blob=new Blob([JSON.stringify(dump,null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='intz_backup_'+Date.now()+'.json'; a.click(); URL.revokeObjectURL(a.href);
  }
  function importBackup(){
    const inp=document.createElement('input'); inp.type='file'; inp.accept='.json,application/json'; inp.onchange=async ()=>{
      const f=inp.files[0]; if(!f) return; const txt=await f.text(); let data; try{ data=JSON.parse(txt);}catch(e){ alert('Ugyldig JSON.'); return; }
      if(data && data.items){ Object.entries(data.items).forEach(([k,v])=>{ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }); }
      alert('Backup importert. Appen lastes på nytt.'); location.reload();
    }; inp.click();
  }
}};
