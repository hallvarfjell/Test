// Enkel router og app-tilstand
const state = {
  hr: {connected:false, bpm: 0, max: 190, zones: [90,110,130,150,170,999], lt1: 135, lt2: 160},
  ftms: {connected:false, speed: 0, incline: 0},
  okt: { plan: null, progress:null, running:false, startedAt:null, timer:null },
  settings: Storage.load('settings', { alder:40, vekt:75, vo2max:null, hrmax:190, lt1:135, lt2:160, tema:'dark', soner:[90,110,130,150,170]}),
  logg: Storage.load('logg', []),
  pi: { current: null }
};

// Synkroniser HR-zoner fra innstillinger
state.hr.max = state.settings.hrmax || 190;
state.hr.lt1 = state.settings.lt1 || 135;
state.hr.lt2 = state.settings.lt2 || 160;
state.hr.zones = [0].concat(state.settings.soner || [90,110,130,150,170]).concat([999]);

const routes = {
  '#/dashboard': Dashboard.render,
  '#/okt': Okt.render,
  '#/sim': Sim.render,
  '#/resultat': Resultat.render,
  '#/statistikk': Statistikk.render,
  '#/innstillinger': Innstillinger.render,
  '#/logg': Logg.render,
};

function router(){
  const r = location.hash || '#/dashboard';
  const fn = routes[r] || Dashboard.render;
  fn(document.getElementById('app'), state);
}

window.addEventListener('hashchange', router);
window.addEventListener('load', ()=>{
  router();
  // klokke
  const clock = document.getElementById('clock');
  setInterval(()=>{ const d=new Date(); clock.textContent=d.toLocaleTimeString(); },1000);
  // PWA SW
  if('serviceWorker' in navigator){ navigator.serviceWorker.register('./service-worker.js'); }
  // BT-knapper
  document.getElementById('btn-hr').addEventListener('click', async ()=>{
    try{
      await BT.connectHR(bpm=>{
        state.hr.bpm = bpm; state.hr.connected = true; UI.toggleConnected('btn-hr', true);
        // Oppdater graf i øktvisning hvis aktiv
        if(Okt.hookOnHR) Okt.hookOnHR(bpm);
      });
    }catch(err){ alert('Klarte ikke koble til pulssensor: '+err.message); }
  });
  document.getElementById('btn-ftms').addEventListener('click', async ()=>{
    try{
      await BT.connectFTMS((spd,inc)=>{
        state.ftms.speed = spd; state.ftms.incline = inc; state.ftms.connected = true; UI.toggleConnected('btn-ftms', true);
        if(Okt.hookOnFTMS) Okt.hookOnFTMS(spd,inc);
      });
    }catch(err){ alert('FTMS er eksperimentelt. Manuell fart/stigning er alltid tilgjengelig. '+err.message); }
  });
});

// Enkel meny for mobil
const hamb=document.getElementById('hamburger');
hamb && hamb.addEventListener('click', ()=>{
  const nav=document.querySelector('.nav');
  const show = nav.style.display!=='flex';
  nav.style.display= show ? 'flex' : 'none';
  hamb.setAttribute('aria-expanded', String(show));
});
