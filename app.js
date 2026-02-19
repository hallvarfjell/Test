// INTZ Basic v1.3.2 app
const AppState = {
  currentProfile: Storage.load('profile','Hallvar'),
  settings: null, hr: {connected:false, bpm:0}, tm: {connected:false, speed:0, incline:0, manualUntil:0},
  wakeLock: null, workouts: null, logg: null, plan: null, session:{running:false, paused:false}
};
function reloadStateForProfile(){
  AppState.settings = Storage.loadP(AppState.currentProfile,'settings',{ hrmax:190, hrrest:50, lt1:135, lt2:160, soner:[115,134,145,164,174], mass:75 });
  AppState.workouts = Storage.loadP(AppState.currentProfile,'workouts', (typeof Workouts!=='undefined'?Workouts.defaults():[]));
  AppState.logg = Storage.loadP(AppState.currentProfile,'logg', []);
}
function setProfile(name){ AppState.currentProfile=name; Storage.save('profile',name); reloadStateForProfile(); router(); }
reloadStateForProfile();
const Routes={ '#/dashboard':Dashboard.render,'#/editor':Editor.render,'#/workout':Workout.render,'#/result':Result.render,'#/pi':PIMod.render,'#/log':LogMod.render };
function setModuleName(name){ const e=document.getElementById('modulnavn'); if(e) e.textContent=name; }
function router(){ const r=location.hash.split('?')[0]||'#/dashboard'; (Routes[r]||Dashboard.render)(document.getElementById('app'), AppState); const name=(r==='#/dashboard'?'Dashboard':r==='#/editor'?'Editor':r==='#/workout'?'Økt':r==='#/pi'?'PI':'Logg'); setModuleName(name);} 
const AppUI={ setSessionIcon(){ const b=document.getElementById('btn-session'); if(!b) return; b.classList.toggle('connected', AppState.session.running && !AppState.session.paused); b.textContent = AppState.session.running ? (AppState.session.paused?'⏸':'▶') : '■'; } };
window.addEventListener('hashchange',router);
window.addEventListener('load',()=>{ router(); const clock=document.getElementById('clock'); setInterval(()=>{ if(clock) clock.textContent=new Date().toLocaleTimeString(); AppUI.setSessionIcon(); },1000); document.getElementById('btn-session').addEventListener('click',()=>{ location.hash='#/workout'; }); });
