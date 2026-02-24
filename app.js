// INTZ v1.4.0 – unified app.js (profiler m/ "+ Legg til", robust router, wake lock, BT, eksport/import)

const AppState = {
  currentProfile: Storage.load('profile', null),
  profiles: Storage.load('profiles', ['Hallvar','Monika']),
  settings: null,
  hr: { connected:false, bpm:0 },
  tm: { connected:false, speed:0, incline:0, manualUntil:0 },
  wakeLock: null,
  workouts: null,
  logg: null,
  plan: null,
  session: { running:false, paused:false }
};

function reloadStateForProfile(){
  if(!AppState.currentProfile){
    AppState.settings=null; AppState.workouts=[]; AppState.logg=[]; return;
  }
  // defaults som tidligere
  AppState.settings = Storage.loadP(AppState.currentProfile, 'settings', {
    hrmax:190, hrrest:50, lt1:135, lt2:160, mass:75
  });
  AppState.workouts = Storage.loadP(AppState.currentProfile, 'workouts', []);
  AppState.logg     = Storage.loadP(AppState.currentProfile, 'logg', []);
}

function setProfile(name){
  AppState.currentProfile = name;
  Storage.save('profile', name);
  reloadStateForProfile();
  router();
  populateProfileSel();
}

function populateProfileSel(){
  const sel = document.getElementById('profileSel');
  if(!sel) return;
  sel.innerHTML = '';

  // placeholder – viser valgt profil eller «Velg profil»; disabled
  const ph = document.createElement('option');
  ph.value = '';
  ph.textContent = AppState.currentProfile ? AppState.currentProfile : 'Velg profil';
  ph.disabled = true; ph.selected = true; sel.appendChild(ph);

  // eksisterende profiler
  (AppState.profiles||[]).forEach(p=>{ const o=document.createElement('option'); o.value=p; o.textContent=p; sel.appendChild(o); });

  // + Legg til
  const add = document.createElement('option'); add.value='__add__'; add.textContent='+ Legg til'; sel.appendChild(add);

  sel.onchange = ()=>{
    if(sel.value==='__add__'){
      const n = prompt('Nytt profilnavn:');
      if(n && n.trim()){
        const name = n.trim();
        if(!(AppState.profiles||[]).includes(name)){
          AppState.profiles = (AppState.profiles||[]).concat([name]);
          Storage.save('profiles', AppState.profiles);
        }
        setProfile(name);
      } else {
        populateProfileSel(); // reset
      }
    } else if(sel.value){
      setProfile(sel.value);
    }
  };
}

// Ruter – gjør #/pi robust dersom PIMod ikke er lastet
const Routes = {
  '#/dashboard': (el,st)=> Dashboard && Dashboard.render ? Dashboard.render(el,st) : (el.textContent='Dashboard mangler.'),
  '#/editor'   : (el,st)=> Editor && Editor.render ? Editor.render(el,st) : (el.textContent='Editor mangler.'),
  '#/workout'  : (el,st)=> Workout && Workout.render ? Workout.render(el,st) : (el.textContent='Økt mangler.'),
  '#/result'   : (el,st)=> Result && Result.render ? Result.render(el,st) : (el.textContent='Resultat mangler.'),
  '#/pi'       : (el,st)=> (typeof PIMod!=='undefined' && PIMod.render) ? PIMod.render(el,st) : (el.textContent='PI-modul mangler.'),
  '#/log'      : (el,st)=> LogMod && LogMod.render ? LogMod.render(el,st) : (el.textContent='Logg mangler.')
};

function router(){
  const hash = location.hash || '#/dashboard';
  const r = hash.split('?')[0] || '#/dashboard';
  const view = Routes[r] || Routes['#/dashboard'];
  view(document.getElementById('app'), AppState);
}

async function ensureWakeLock(){
  try{
    if('wakeLock' in navigator){
      AppState.wakeLock = await navigator.wakeLock.request('screen');
      AppState.wakeLock.addEventListener('release', ()=>ensureWakeLock());
    }
  }catch(e){ /* ignorér manglende støtte */ }
}

window.addEventListener('hashchange', router);
window.addEventListener('load', ()=>{
  populateProfileSel();
  reloadStateForProfile();
  router();
  ensureWakeLock();

  // klokke
  const clock=document.getElementById('clock');
  if(clock) setInterval(()=>{ clock.textContent = new Date().toLocaleTimeString(); }, 1000);

  // HR
  const btnHR = document.getElementById('btn-hr');
  if(btnHR) btnHR.addEventListener('click', async ()=>{
    try{
      await BT.connectHR(bpm=>{ AppState.hr.bpm=bpm; AppState.hr.connected=true; UI.setConnected('btn-hr', true); if(Workout.onHR) Workout.onHR(bpm); });
    }catch(e){ alert('HR tilkobling feilet: '+e.message); }
  });

  // FTMS (tredemølle)
  const btnTM = document.getElementById('btn-ftms');
  if(btnTM) btnTM.addEventListener('click', async ()=>{
    try{
      await BT.connectFTMS((spd,inc)=>{ if(Workout.onTM) Workout.onTM(spd,inc); AppState.tm.connected=true; UI.setConnected('btn-ftms', true); });
    }catch(e){ alert('FTMS tilkobling feilet: '+e.message); }
  });

  // Eksport
  const btnEx = document.getElementById('btn-export');
  if(btnEx) btnEx.addEventListener('click', ()=>{
    const data={ ver:'1.4.0', exportedAt:new Date().toISOString(), items:{} };
    for(let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      if(k && k.startsWith('INTZ_')){
        try{ data.items[k] = JSON.parse(localStorage.getItem(k)); }
        catch(_){ data.items[k] = localStorage.getItem(k); }
      }
    }
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='intz_backup_'+Date.now()+'.json'; a.click(); URL.revokeObjectURL(a.href);
  });

  // Import
  const btnIm = document.getElementById('btn-import');
  if(btnIm) btnIm.addEventListener('click', ()=>{
    const inp=document.createElement('input'); inp.type='file'; inp.accept='.json,application/json';
    inp.onchange=async ()=>{ const f=inp.files[0]; if(!f) return; try{ const data=JSON.parse(await f.text()); if(data&&data.items){ Object.entries(data.items).forEach(([k,v])=> localStorage.setItem(k, JSON.stringify(v))); location.reload(); } else alert('Ugyldig backup.'); } catch(e){ alert('Import feilet: '+e.message); } };
    inp.click();
  });
});
