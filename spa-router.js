// spa-router.js
// INTZ v10.1 – SPA router (hash-based)
// Routes:
//   #dashboard
//   #builder
//   #log
//   #settings
//   #help
//   #results:<sessionId>

(function(){
  const VIEWS = ['dashboard','builder','log','results','settings','help'];

  function parseHash(){
    const raw = (location.hash || '#dashboard').slice(1);
    if(!raw) return {view:'dashboard', arg:null};
    const parts = raw.split(':');
    const view = parts[0] || 'dashboard';
    const arg = parts.length>1 ? parts.slice(1).join(':') : null;
    return {view: VIEWS.includes(view)? view : 'dashboard', arg};
  }

  function show(view){
    document.querySelectorAll('section[data-view]').forEach(sec=>{
      sec.classList.toggle('hidden', sec.dataset.view !== view);
    });
  }

  function apply(){
    const r = parseHash();
    window.INTZRoute = r;
    show(r.view);
    window.dispatchEvent(new CustomEvent('intz:viewchange', { detail: r }));
  }

  function go(view, arg=null){
    if(arg!=null) location.hash = view + ':' + arg;
    else location.hash = view;
  }

  function wireNav(){
    document.querySelectorAll('[data-nav]').forEach(a=>{
      a.addEventListener('click', (e)=>{
        e.preventDefault();
        const v = a.dataset.nav;
        if(v) go(v);
      });
    });
  }

  window.INTZRouter = { go, parseHash };

  window.addEventListener('hashchange', apply);
  document.addEventListener('DOMContentLoaded', ()=>{ wireNav(); apply(); });
})();
