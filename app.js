// INTZ v1.3.7 app
const AppState = {
  currentProfile: Storage.load('profile', null),
  settings: null,
  hr: {connected:false, bpm:0},
  tm: {connected:false, speed:0, incline:0, manualUntil:0},
  wakeLock: null,
  workouts: null,
  logg: null,
  plan: null,
  session: { running:false, paused:false }
};

function reloadStateForProfile(){
  if(!AppState.currentProfile){ AppState.settings=null; AppState.workouts=[]; AppState.logg=[]; return; }
  AppState.settings = Storage.loadP(AppState.currentProfile, 'settings', { hrmax:190, hrrest:50, lt1:135, lt2:160, soner:[115,134,145,164,174], mass:75 });
  AppState.workouts = Storage.loadP(AppState.currentProfile, 'workouts', []);
  AppState.logg = Storage.loadP(AppState.currentProfile, 'logg', []);
}
function setProfile(name){ AppState.currentProfile = name; Storage.save('profile', name); reloadStateForProfile(); router(); populateProfileSel(); }

function populateProfileSel(){ const sel=document.getElementById('profileSel'); if(!sel) return; sel.innerHTML=''; const opt0=document.createElement('option'); opt0.value=''; opt0.textContent= AppState.currentProfile? `Profil: ${AppState.currentProfile}`: 'Velg profil'; sel.appendChild(opt0); ['Hallvar','Monika'].forEach(p=>{ const o=document.createElement('option'); o.value=p; o.textContent=p; sel.appendChild(o); }); sel.onchange=()=>{ if(sel.value) setProfile(sel.value); } }

const Routes = { '#/dashboard': Dashboard.render, '#/editor': Editor.render, '#/workout': Workout.render, '#/result': Result.render, '#/pi': PIMod.render, '#/log': LogMod.render };
function router(){ const r = location.hash.split('?')[0] || '#/dashboard'; (Routes[r]||Dashboard.render)(document.getElementById('app'), AppState); }

async function ensureWakeLock(){ try{ if('wakeLock' in navigator){ AppState.wakeLock = await navigator.wakeLock.request('screen'); AppState.wakeLock.addEventListener('release', ()=>ensureWakeLock()); } }catch(e){} }

window.addEventListener('hashchange', router);
window.addEventListener('load', ()=>{
  populateProfileSel(); reloadStateForProfile(); router(); ensureWakeLock();
  const clock=document.getElementById('clock'); setInterval(()=>{ clock.textContent = new Date().toLocaleTimeString(); }, 1000);
  document.getElementById('btn-hr').addEventListener('click', async ()=>{ try{ await BT.connectHR(bpm=>{ AppState.hr.bpm=bpm; AppState.hr.connected=true; UI.setConnected('btn-hr', true); if(Workout.onHR) Workout.onHR(bpm); }); }catch(e){ alert('HR tilkobling feilet: '+e.message); } });
  document.getElementById('btn-ftms').addEventListener('click', async ()=>{ try{ await BT.connectFTMS((spd,inc)=>{ if(Workout.onTM) Workout.onTM(spd,inc); AppState.tm.connected=true; UI.setConnected('btn-ftms', true); }); }catch(e){ alert('FTMS tilkobling feilet: '+e.message); } });
  document.getElementById('btn-export').addEventListener('click', ()=>{ const data={ ver:'1.3.7', exportedAt:new Date().toISOString(), items:{} }; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.startsWith('INTZ_')){ try{ data.items[k]=JSON.parse(localStorage.getItem(k)); }catch(_){ data.items[k]=localStorage.getItem(k); } } } const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='intz_backup_'+Date.now()+'.json'; a.click(); URL.revokeObjectURL(a.href); });
  document.getElementById('btn-import').addEventListener('click', ()=>{ const inp=document.createElement('input'); inp.type='file'; inp.accept='.json,application/json'; inp.onchange=async ()=>{ const f=inp.files[0]; if(!f) return; try{ const data=JSON.parse(await f.text()); if(data&&data.items){ Object.entries(data.items).forEach(([k,v])=> localStorage.setItem(k, JSON.stringify(v))); location.reload(); } else alert('Ugyldig backup.'); }catch(e){ alert('Import feilet: '+e.message);} }; inp.click(); });
});
