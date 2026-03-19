// ui-status.js – Leveranse 1: statuspill + profilmeny + auto-bootstrap (pull)
// Forutsetter at supabase-init.js er lastet før denne fila, samt cloud-*.js

(function(){
  const GH_REDIRECT = 'https://hallvarfjell.github.io/Test/';
  const $ = (sel, ctx=document)=>ctx.querySelector(sel);

  function ensureUI(){
    const nav = document.querySelector('.topbar .nav');
    if(!nav) return {};
    // Status pill
    let pill = $('#sky-pill', nav);
    if(!pill){
      pill = document.createElement('span');
      pill.id='sky-pill';
      pill.className='badge';
      pill.textContent='Sky: frakoblet';
      pill.style.border='1px solid #dc2626';
      pill.style.marginLeft='8px';
      nav.appendChild(pill);
    }
    // Profile button
    let btn = $('#profile-btn', nav);
    if(!btn){
      btn = document.createElement('button');
      btn.id='profile-btn';
      btn.className='secondary';
      btn.textContent='Profil';
      btn.style.marginLeft='8px';
      nav.appendChild(btn);
    }
    // Menu
    let menu = $('#profile-menu');
    if(!menu){
      menu = document.createElement('div');
      menu.id='profile-menu';
      menu.className='menu hidden';
      menu.style.position='fixed';
      menu.style.top='72px';
      menu.style.right='16px';
      menu.style.minWidth='240px';
      menu.style.zIndex='60';
      menu.innerHTML = `
        <div style="padding:8px;border-bottom:1px solid #f1f5f9"><strong>Sky</strong></div>
        <div id="pm-user" class="menu-item small" style="opacity:.8;padding:8px 12px">Ikke innlogget</div>
        <div class="menu-item" id="pm-login">Logg inn</div>
        <div class="menu-item hidden" id="pm-sync">Synk nå</div>
        <div class="menu-item hidden" id="pm-logout">Logg ut</div>
      `;
      document.body.appendChild(menu);
      // close on outside click
      document.addEventListener('click', (e)=>{
        if(e.target===btn || btn.contains(e.target)) return;
        if(!menu.contains(e.target)) menu.classList.add('hidden');
      });
    }
    // Toggle menu
    btn.onclick = ()=> menu.classList.toggle('hidden');
    return { pill, btn, menu, pmUser: $('#pm-user', menu), pmLogin: $('#pm-login', menu), pmSync: $('#pm-sync', menu), pmLogout: $('#pm-logout', menu) };
  }

  const ui = ensureUI();
  function setPill(state){
    if(!ui.pill) return;
    const m = {
      offline: { text:'Sky: frakoblet', color:'#dc2626' },
      online:  { text:'Sky: online',    color:'#16a34a' },
      syncing: { text:'Sky: synker…',   color:'#2563eb' },
      error:   { text:'Sky: feil',      color:'#dc2626' },
    }[state] || { text:'Sky', color:'#94a3b8' };
    ui.pill.textContent = m.text;
    ui.pill.style.border = '1px solid '+m.color;
  }

  async function explicitSync(){
    try{
      setPill('syncing');
      await window.cloudSync?.pullTemplates?.();
      await window.cloudSessions?.pullSessions?.();
      setPill('online');
    }catch(e){ console.warn(e); setPill('error'); }
  }

  function wireMenu(){
    if(!ui.menu) return;
    const supabase = window.supabase;
    // Login
    if(ui.pmLogin){ ui.pmLogin.onclick = async ()=>{
      const email = prompt('E-post (magic link):');
      if(!email) return;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options:{ emailRedirectTo: GH_REDIRECT }
      });
      if(error) alert(error.message); else alert('Sjekk e-posten og følg lenken.');
    };}
    // Sync now
    if(ui.pmSync){ ui.pmSync.onclick = explicitSync; }
    // Logout
    if(ui.pmLogout){ ui.pmLogout.onclick = async ()=>{ await supabase.auth.signOut(); } }
  }

  function reflectAuth(session){
    const email = session?.user?.email || null;
    if(ui.pmUser){ ui.pmUser.textContent = email? ('Innlogget: '+email) : 'Ikke innlogget'; }
    if(ui.pmLogin){ ui.pmLogin.classList.toggle('hidden', !!email); }
    if(ui.pmLogout){ ui.pmLogout.classList.toggle('hidden', !email); }
    if(ui.pmSync){ ui.pmSync.classList.toggle('hidden', !email); }
    setPill(email? 'online':'offline');
  }

  async function heartbeat(){
    try{
      const supabase = window.supabase; if(!supabase) return;
      const { data, error } = await supabase.from('workout_templates').select('id', { count:'exact', head:true });
      if(error) throw error; setPill('online');
    }catch(e){ setPill('offline'); }
  }

  async function bootstrap(){
    const supabase = window.supabase; if(!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    reflectAuth(session);
    if(session){
      // auto-pull at start
      try{ setPill('syncing'); await window.cloudSync?.pullTemplates?.(); await window.cloudSessions?.pullSessions?.(); setPill('online'); }
      catch(e){ console.warn(e); setPill('error'); }
    }
    // auth change
    supabase.auth.onAuthStateChange((_e, s)=>{ reflectAuth(s); if(s){ explicitSync(); } });
    // periodic heartbeat
    setInterval(heartbeat, 60000);
  }

  // react to sync events (busy/idle)
  window.addEventListener('sync:busy', ()=> setPill('syncing'));
  window.addEventListener('sync:idle', ()=> setPill('online'));
  window.addEventListener('sync:error', ()=> setPill('error'));

  wireMenu();
  bootstrap();
})();
