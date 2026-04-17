// settings-view.js
// INTZ v10.1 – Settings extras (Cloud sync UI)

function activeUser(){ return localStorage.getItem('active_user') || 'default'; }
function nsKey(k){ return 'u:'+activeUser()+':'+k; }
function getNS(k, d){ try{ const v=localStorage.getItem(nsKey(k)); if(v!=null) return JSON.parse(v); const ov=localStorage.getItem(k); return ov!=null? JSON.parse(ov): d; }catch(e){ return d; } }
function setNS(k, v){ localStorage.setItem(nsKey(k), JSON.stringify(v)); }

function wireCloud(){
  const chk = document.getElementById('cloud-enabled');
  const up = document.getElementById('cloud-sync-up');
  const down = document.getElementById('cloud-sync-down');
  const status = document.getElementById('cloud-status');
  if(!chk || !up || !down || !status) return;

  chk.checked = !!getNS('cloudEnabled', false);
  function setStatus(msg){ status.textContent = msg; }

  chk.addEventListener('change', ()=>{
    setNS('cloudEnabled', !!chk.checked);
    setStatus(chk.checked ? 'Sky-synk er aktivert.' : 'Sky-synk er deaktivert.');
  });

  up.addEventListener('click', async ()=>{
    try{
      if(!chk.checked){ alert('Aktiver sky-synk først.'); return; }
      setStatus('Synker opp...');
      const res = await window.INTZCloud.syncUp();
      setStatus(`Synk opp OK. Workouts i sky: ${res.workouts_uploaded}, Økter i sky: ${res.sessions_uploaded}`);
    }catch(e){
      console.error(e);
      setStatus('Synk opp feilet: ' + (e?.message || String(e)));
      alert('Synk opp feilet. Se konsoll/feilpanel.');
    }
  });

  down.addEventListener('click', async ()=>{
    try{
      if(!chk.checked){ alert('Aktiver sky-synk først.'); return; }
      setStatus('Henter fra sky...');
      const res = await window.INTZCloud.syncDown();
      setStatus(`Synk ned OK. Nye maler: ${res.workouts_downloaded}, nye økter: ${res.sessions_downloaded}`);
    }catch(e){
      console.error(e);
      setStatus('Synk ned feilet: ' + (e?.message || String(e)));
      alert('Synk ned feilet. Se konsoll/feilpanel.');
    }
  });

  setStatus(chk.checked ? 'Sky-synk er aktivert.' : 'Sky-synk er deaktivert.');
}

window.addEventListener('intz:viewchange', (e)=>{
  if(e.detail && e.detail.view==='settings') wireCloud();
});

document.addEventListener('DOMContentLoaded', wireCloud);
