// results.js
// INTZ v10.1 – Results view

let SESSION = null;

// ---------- helpers ----------
function activeUser(){ return localStorage.getItem('active_user') || 'default'; }
function nsKey(k){ return 'u:'+activeUser()+':'+k; }
function getNS(k, d){
  try{
    const v = localStorage.getItem(nsKey(k));
    return v!=null ? JSON.parse(v) : d;
  }catch(e){
    return d;
  }
}

function currentRoute(){
  return (window.INTZRoute ||
    (window.INTZRouter && window.INTZRouter.parseHash && window.INTZRouter.parseHash()) ||
    { view:'dashboard', arg:null }
  );
}

// ---------- session selection ----------
function pickSession(){
  const r = currentRoute();
  const id =
    (r.view === 'results' && r.arg)
      ? r.arg
      : (location.hash && location.hash.startsWith('#results:') ? location.hash.slice(9) : null);

  const arr = getNS('sessions', []);
  if(!arr || !arr.length) return null;

  if(id){
    return arr.find(s => s.id === id) || null;
  }
  return arr[arr.length - 1];
}

// ---------- formatting ----------
function formatMMSS(sec){
  const m = Math.floor(sec/60);
  const s = Math.floor(sec%60);
  return `${m}:${String(s).padStart(2,'0')}`;
}

// ---------- rendering ----------
function renderAll(session){
  if(!session || !session.points || !session.points.length){
    console.warn('[INTZ][results] Ingen datapunkter');
    return;
  }

  renderSummary(session);
  renderChart(session);
}

function renderSummary(session){
  const el = document.getElementById('results-summary');
  if(!el) return;

  const dur =
    session.startedAt && session.endedAt
      ? Math.max(0, (new Date(session.endedAt) - new Date(session.startedAt)) / 1000)
      : 0;

  el.innerHTML = `
    <div><strong>${session.name || 'Økt'}</strong></div>
    <div>Varighet: ${formatMMSS(dur)}</div>
    <div>Punkter: ${session.points.length}</div>
  `;
}

function renderChart(session){
  const canvas = document.getElementById('results-chart');
  if(!canvas) return;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);

  const pts = session.points;
  if(!pts.length) return;

  // enkel autoskala (HR)
  const vals = pts.map(p => p.hr).filter(v => typeof v === 'number');
  if(!vals.length) return;

  const min = Math.min(...vals);
  const max = Math.max(...vals);

  const w = canvas.width;
  const h = canvas.height;

  ctx.beginPath();
  pts.forEach((p,i)=>{
    if(typeof p.hr !== 'number') return;
    const x = (i/(pts.length-1)) * w;
    const y = h - ((p.hr - min)/(max-min || 1)) * h;
    if(i===0) ctx.moveTo(x,y);
    else ctx.lineTo(x,y);
  });
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 2;
  ctx.stroke();
}

// ---------- init ----------
function init(){
  SESSION = pickSession();
  if(!SESSION) return;
  renderAll(SESSION);
}

// KUN kjørt ved første load
document.addEventListener('DOMContentLoaded', init);

// ---------- SPA FIX (DETTE ER POENGET) ----------
function initResultsFromRoute(){
  const s = pickSession();
  if(!s || !s.points || !s.points.length){
    console.warn('[INTZ][results] Ingen øktdata ved view-change');
    return;
  }
  SESSION = s;
  renderAll(SESSION);
}

window.addEventListener('intz:viewchange', (e)=>{
  if(e.detail && e.detail.view === 'results'){
    initResultsFromRoute();
  }
});
``
