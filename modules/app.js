// INTZ Basic v1.2.0 app
const AppState = {
  currentProfile: Storage.load('profile','Hallvar'),
  settings: null,
  hr: {connected:false, bpm:0},
  tm: {connected:false, speed:0, incline:0, manualUntil:0},
  wakeLock: null,
  workouts: null,
  logg: null,
  plan: null
};

function reloadStateForProfile(){
  AppState.settings = Storage.loadP(AppState.currentProfile, 'settings', { vekt:null, hrmax:190, lt1:135, lt2:160, soner:[115,134,145,164,174], tema:'light' });
  AppState.workouts = Storage.loadP(AppState.currentProfile, 'workouts', (typeof Workouts!=='undefined'?Workouts.defaults():[]));
  AppState.logg = Storage.loadP(AppState.currentProfile, 'logg', []);
}
function setProfile(name){ AppState.currentProfile = name; Storage.save('profile', name); reloadStateForProfile(); router(); }
reloadStateForProfile();

const Routes = {
  '#/dashboard': Dashboard.render,
  '#/editor': Editor.render,
  '#/workout': Workout.render,
  '#/result': Result.render,
  '#/pi': PIMod.render,
  '#/settings': Settings.render,
  '#/log': LogMod.render,
};

function setModuleName(name){ document.getElementById('modulnavn').textContent = name; }

function router(){
  const r = location.hash.split('?')[0] || '#/dashboard';
  (Routes[r]||Dashboard.render)(document.getElementById('app'), AppState);
  const name = (r==='#/dashboard'?'Dashboard':r==='#/editor'?'Editor':r==='#/workout'?'Økt':r==='#/pi'?'PI':r==='#/settings'?'Innstillinger':'Logg');
  setModuleName(name);
}

window.addEventListener('hashchange', router);
window.addEventListener('load', ()=>{
  router();
  const clock=document.getElementById('clock');
  setInterval(()=>{ clock.textContent = new Date().toLocaleTimeString(); }, 1000);
  document.getElementById('btn-hr').addEventListener('click', async ()=>{
    try{ await BT.connectHR(bpm=>{ AppState.hr.bpm=bpm; AppState.hr.connected=true; UI.setConnected('btn-hr', true); if(Workout.onHR) Workout.onHR(bpm); }); }
    catch(e){ alert('HR tilkobling feilet: '+e.message); }
  });
  document.getElementById('btn-ftms').addEventListener('click', async ()=>{
    try{ await BT.connectFTMS((spd,inc)=>{ if(Workout.onTM) Workout.onTM(spd,inc); AppState.tm.connected=true; UI.setConnected('btn-ftms', true); }); }
    catch(e){ alert('FTMS (tredemølle) er valgfritt. Manuell justering er alltid tilgjengelig. '+e.message); }
  });
  document.getElementById('btn-wake').addEventListener('click', async ()=>{
    try{
      if(AppState.wakeLock){ await AppState.wakeLock.release(); AppState.wakeLock=null; UI.setConnected('btn-wake', false); }
      else if('wakeLock' in navigator){ AppState.wakeLock = await navigator.wakeLock.request('screen'); UI.setConnected('btn-wake', true); AppState.wakeLock.addEventListener('release', ()=>UI.setConnected('btn-wake', false)); }
      else{ alert('Wake Lock støttes ikke i denne nettleseren.'); }
    }catch(e){ alert('Kunne ikke sette skjermlås: '+e.message); }
  });
  const hamb = document.getElementById('hamburger');
  hamb.addEventListener('click', ()=>{ const nav=document.getElementById('nav'); const show = nav.style.display!=='flex'; nav.style.display = show? 'flex':'none'; hamb.setAttribute('aria-expanded', String(show)); });
});
