// ui-status.js – HOTFIX-2 (diagnose): bedre status + non-intrusive tooltip ved feil
(function(){
  const GH_REDIRECT = 'https://hallvarfjell.github.io/Test/';
  const $ = (sel, ctx=document)=>ctx.querySelector(sel);
  let lastErr = null; // lagres for enkel visning

  function ensureUI(){
    const nav = document.querySelector('.topbar .nav');
    if(!nav) return {};
    let pill = $('#sky-pill', nav);
    if(!pill){
      pill = document.createElement('span');
      pill.id='sky-pill'; pill.className='badge';
      pill.textContent='Sky: frakoblet'; pill.style.border='1px solid #dc2626'; pill.style.marginLeft='8px';
      pill.style.cursor='help'; pill.title='Ingen feil.';
      nav.appendChild(pill);
    }
    let btn = $('#profile-btn', nav);
    if(!btn){ btn=document.createElement('button'); btn.id='profile-btn'; btn.className='secondary'; btn.textContent='Profil'; btn.style.marginLeft='8px'; nav.appendChild(btn); }
    let menu = $('#profile-menu');
    if(!menu){
      menu=document.createElement('div'); menu.id='profile-menu'; menu.className='menu hidden'; menu.style.position='fixed'; menu.style.top='72px'; menu.style.right='16px'; menu.style.minWidth='260px'; menu.style.zIndex='60';
      menu.innerHTML=`<div style="padding:8px;border-bottom:1px solid #f1f5f9"><strong>Sky</strong></div>
        <div id="pm-user" class="menu-item small" style="opacity:.8;padding:8px 12px">Ikke innlogget</div>
        <div class="menu-item" id="pm-login">Logg inn</div>
        <div class="menu-item hidden" id="pm-sync">Synk nå</div>
        <div class="menu-item hidden" id="pm-logout">Logg ut</div>`;
      document.body.appendChild(menu);
      document.addEventListener('click', (e)=>{ if(e.target===btn || btn.contains(e.target)) return; if(!menu.contains(e.target)) menu.classList.add('hidden'); });
    }
    btn.onclick=()=> menu.classList.toggle('hidden');
    return { pill, btn, menu, pmUser: $('#pm-user', menu), pmLogin: $('#pm-login', menu), pmSync: $('#pm-sync', menu), pmLogout: $('#pm-logout', menu) };
  }
  const ui = ensureUI();

  function setPill(state, hint){
    if(!ui.pill) return;
    const m={
      offline:{text:'Sky: frakoblet',color:'#dc2626'},
      online:{text:'Sky: online',color:'#16a34a'},
      syncing:{text:'Sky: synker…',color:'#2563eb'},
      queued:{text:'Sky: kø',color:'#d97706'},
      error:{text:'Sky: feil',color:'#dc2626'},
    }[state]||{text:'Sky',color:'#94a3b8'};
    ui.pill.textContent=m.text; ui.pill.style.border='1px solid '+m.color; if(hint){ ui.pill.title=hint; }
  }
  function showError(e){
    lastErr = e; const msg=(e?.message||e?.error?.message||JSON.stringify(e)||'Ukjent feil').slice(0,280);
    console.error('[SYNC][ERR]', e);
    setPill('error', msg);
  }

  async function explicitSync(){
    try{ setPill('syncing'); await window.cloudSync?.pullTemplates?.(); await window.cloudSessions?.pullSessions?.(); setPill('online'); }
    catch(e){ showError(e); }
  }
  function wireMenu(){
    const supabase = window.supabase; if(!supabase || !ui.menu) return;
    ui.pmLogin && (ui.pmLogin.onclick = async ()=>{
      const email=prompt('E-post (magic link):'); if(!email) return;
      const { error } = await supabase.auth.signInWithOtp({ email, options:{ emailRedirectTo: GH_REDIRECT } });
      if(error) alert(error.message); else alert('Sjekk e-posten og følg lenken.');
    });
    ui.pmSync && (ui.pmSync.onclick = ()=>{ window.cloudSessions?.scanNow?.(); explicitSync(); });
    ui.pmLogout && (ui.pmLogout.onclick = async ()=>{ await supabase.auth.signOut(); setPill('offline'); });
  }
  function reflectAuth(session){
    const email=session?.user?.email||null;
    ui.pmUser&&(ui.pmUser.textContent=email?('Innlogget: '+email):'Ikke innlogget');
    ui.pmLogin&&ui.pmLogin.classList.toggle('hidden', !!email);
    ui.pmLogout&&ui.pmLogout.classList.toggle('hidden', !email);
    ui.pmSync&&ui.pmSync.classList.toggle('hidden', !email);
    setPill(email?'online':'offline');
  }
  async function heartbeat(){
    try{ const { error } = await window.supabase.from('workout_templates').select('id',{count:'exact',head:true}); if(error) throw error; setPill('online'); }
    catch(e){ setPill('offline'); }
  }
  async function bootstrap(){
    const { data:{ session } } = await window.supabase.auth.getSession();
    reflectAuth(session);
    if(session){ try{ setPill('syncing'); await window.cloudSync?.pullTemplates?.(); await window.cloudSessions?.pullSessions?.(); setPill('online'); }catch(e){ showError(e); } }
    window.supabase.auth.onAuthStateChange((_e,s)=>{ reflectAuth(s); if(s){ explicitSync(); } });
    setInterval(heartbeat, 60000);
  }

  window.addEventListener('sync:busy', ()=> setPill('syncing'));
  window.addEventListener('sync:idle', ()=> setPill('online'));
  window.addEventListener('sync:error', (ev)=> showError(ev.detail||ev));

  wireMenu(); bootstrap();
})();
