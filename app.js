/* INTZ – enkel SPA med PWA + Web Bluetooth */
(function(){
  const $ = (sel, ctx=document) => ctx.querySelector(sel);
  let wakeLock = null;
  async function requestWakeLock(){
    try{ if('wakeLock' in navigator){ wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release',()=>console.log('WakeLock released')); } }catch(e){ console.warn('WakeLock', e); }
  }
  function releaseWakeLock(){ try{ if(wakeLock){ wakeLock.release(); wakeLock=null; } }catch(e){} }

  const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

  // --- Simple store with localStorage ---
  const Store = {
    key: 'intz-store-v1',
    data: {
      settings: {
        age: 35, weight: 75, vo2max: 50,
        hrMax: 190, lt1: 135, lt2: 160,
        zones: [0.5, 0.6, 0.7, 0.8, 0.9], // 0-1 fraksjon av maks
        treadmill: { supportsFTMS: false },
        transitionPauseSec: 10 // skjult mellom øvelser
      },
      workouts: [],
      sessions: [] // historikk
    },
    load(){ try{ const j=localStorage.getItem(this.key); if(j){ this.data = JSON.parse(j); } }catch(e){ console.warn('Store load',e);} },
    save(){ try{ localStorage.setItem(this.key, JSON.stringify(this.data)); }catch(e){ console.warn('Store save',e);} }
  }
  Store.load();

  // Demo workout if none exists
  if(!Store.data.workouts || Store.data.workouts.length===0){
    Store.data.workouts = [
      {
        id: crypto.randomUUID(), name: '4x4 klassiker', type: 'intervaller',
        blocks: [
          { kind:'warmup', durationSec: 600, intensity:'Lett', target:{ speed: 9.0, incline: 1 } },
          { kind:'set', name:'Hoveddel', reps:4, workSec:240, restSec:180, intensity:'Hardt (85% HRmax)', target:{ speed: 14.0, incline: 1 } },
          { kind:'cooldown', durationSec: 600, intensity:'Lett', target:{ speed: 8.5, incline: 1 } }
        ]
      }
    ];
    Store.save();
  }

  // --- Router ---
  const routes = {
    '/': renderDashboard,
    '/editor': renderEditor,
    '/workout': renderWorkout,
    '/simulator': renderSimulator,
    '/results': renderResults,
    '/settings': renderSettings,
    '/log': renderLog
  };

  function navigate(){
    const hash = location.hash.replace('#','') || '/';
    const view = routes[hash] || renderDashboard;
    view();
  }

  // --- UI helpers ---
  function fmtTime(sec){
    sec = Math.max(0, Math.floor(sec||0));
    const h = Math.floor(sec/3600); const m = Math.floor((sec%3600)/60); const s = sec%60;
    return (h>0? h+':' : '') + String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  }
  function clamp(v,min,max){return Math.max(min, Math.min(max, v));}
  function avg(arr){ return arr.length? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }

  // --- BLE (HR + FTMS best-effort read-only) ---
  const BLE = {
    deviceHR: null, serverHR: null, charHR: null,
    deviceFTMS: null, serverFTMS: null, treadmill: { speedKmh:null, inclinePct:null },
    async connectHR(){
      try{
        const device = await navigator.bluetooth.requestDevice({ filters:[{ services:['heart_rate'] }] });
        const server = await device.gatt.connect();
        const service = await server.getPrimaryService('heart_rate');
        const char = await service.getCharacteristic('heart_rate_measurement');
        await char.startNotifications();
        char.addEventListener('characteristicvaluechanged', ev => {
          const dv = ev.target.value; // parse HR
          let flags = dv.getUint8(0);
          let hr16 = flags & 0x1;
          let idx = 1; let hr = hr16? dv.getUint16(idx, true) : dv.getUint8(idx); if(hr16) idx+=2; else idx+=1;
          State.hr = hr; State.hrSamples.push({t:performance.now(), v:hr});
        });
        this.deviceHR = device; this.serverHR = server; this.charHR = char;
        toast('Pulsbelte tilkoblet');
      }catch(e){ alert('Klarte ikke å koble pulsbelte: '+e); }
    },
    async connectFTMS(){
      try{
        const device = await navigator.bluetooth.requestDevice({
          filters:[{ services: [0x1826] }], optionalServices:[0x1826]
        });
        const server = await device.gatt.connect();
        const service = await server.getPrimaryService(0x1826);
        // Treadmill Data characteristic (UUID 0x2ACD) leveres ofte i FTMS
        const dataChar = await service.getCharacteristic(0x2ACD).catch(()=>null);
        if(dataChar){
          await dataChar.startNotifications();
          dataChar.addEventListener('characteristicvaluechanged', ev => {
            const dv = ev.target.value; // parsing etter spec (best-effort)
            // FTMS Treadmill Data flags: speed in m/s * 100, incline in % * 100 (kan variere)
            // Vi prøver konservativt: byte0-1: flags; byte2-3: speed (1/100 m/s); byte4-5: incline (1/100 %)
            const flags = dv.getUint16(0, true);
            const speed_raw = dv.getUint16(2, true); // 1/100 m/s
            const incline_raw = dv.getInt16(4, true); // 1/100 %
            const speed_ms = speed_raw/100; const speed_kmh = speed_ms*3.6;
            const incline_pct = incline_raw/100;
            this.treadmill.speedKmh = speed_kmh; this.treadmill.inclinePct = incline_pct;
            State.speed = speed_kmh; State.incline = incline_pct; State.speedSamples.push({t:performance.now(), v:speed_kmh});
          });
          toast('Mølle tilkoblet (FTMS)');
          Store.data.settings.treadmill.supportsFTMS = true; Store.save();
        } else {
          toast('Fant ikke FTMS-data på enheten – fallback til manuell kontroll');
        }
        this.deviceFTMS = device; this.serverFTMS = server;
      }catch(e){ alert('Klarte ikke å koble mølle: '+e); }
    }
  }

  // --- Global runtime State ---
  const State = {
    currentView: '/',
    selectedWorkoutId: (Store.data.workouts[0]||{}).id,
    workoutRuntime: null, // set ved start
    hr: null, speed: 0, incline: 0,
    hrSamples: [], speedSamples: [], // for grafer
    chart: null,
  };

  // --- Toast helper ---
  let toastTimer = null;
  function toast(msg){
    let el = $('#toast');
    if(!el){ el = document.createElement('div'); el.id = 'toast'; el.style.position='fixed'; el.style.bottom='1rem'; el.style.right='1rem'; el.style.background='#172d63'; el.style.border='1px solid #2a4ea2'; el.style.padding='.6rem .8rem'; el.style.borderRadius='.5rem'; el.style.color='#cfe1ff'; el.style.zIndex=99; document.body.appendChild(el); }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>{ el.style.opacity='0'; }, 3000);
  }

  // --- Simple chart (Canvas 2D) ---
  function drawChart(canvas, samplesA, samplesB, opts={}){
    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.clientWidth; const H = canvas.height = canvas.clientHeight;
    ctx.clearRect(0,0,W,H);
    const now = performance.now();
    const windowMs = (opts.windowSec||900)*1000; // 15 min
    const minT = now - windowMs;
    const A = samplesA.filter(p=>p.t>=minT); const B = samplesB.filter(p=>p.t>=minT);
    // Y ranges
    const minA = Math.min(...A.map(p=>p.v).concat([60]));
    const maxA = Math.max(...A.map(p=>p.v).concat([180]));
    const minB = Math.min(...B.map(p=>p.v).concat([0]));
    const maxB = Math.max(...B.map(p=>p.v).concat([20]));
    // axes
    ctx.strokeStyle = '#325'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(40,10); ctx.lineTo(40,H-20); ctx.lineTo(W-10,H-20); ctx.stroke();
    ctx.fillStyle = '#9fb3c8'; ctx.font = '12px system-ui';
    ctx.fillText('Puls', 5, 20); ctx.fillText('Fart', W-46, 20);

    function xScale(t){ return 40 + ( (t-minT)/windowMs ) * (W-50); }
    function yScaleA(v){ return (H-20) - ((v-minA)/(maxA-minA))*(H-30); }
    function yScaleB(v){ return (H-20) - ((v-minB)/(maxB-minB))*(H-30); }

    // grid
    ctx.strokeStyle = '#203154'; ctx.lineWidth = 1; ctx.setLineDash([4,4]);
    for(let i=0;i<=5;i++){
      const y = 10 + i*(H-30)/5; ctx.beginPath(); ctx.moveTo(40,y); ctx.lineTo(W-10,y); ctx.stroke();
    }
    ctx.setLineDash([]);

    // HR (red)
    ctx.strokeStyle = '#ff5a5f'; ctx.lineWidth = 2; ctx.beginPath();
    A.forEach((p,i)=>{ const x=xScale(p.t), y=yScaleA(p.v); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); });
    ctx.stroke();
    // Speed (yellow)
    ctx.strokeStyle = '#ffd400'; ctx.lineWidth = 2; ctx.beginPath();
    B.forEach((p,i)=>{ const x=xScale(p.t), y=yScaleB(p.v); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); });
    ctx.stroke();
  }

  // --- Workout engine ---
  function expandBlocks(blocks){
    // Flater ut blokker til en sekvens av drag, med skjult overgangspause
    const out = [];
    const tPause = (Store.data.settings.transitionPauseSec|0) || 0;
    for(const b of blocks){
      if(b.kind==='warmup' || b.kind==='cooldown'){
        out.push({ phase: b.kind, durationSec:b.durationSec|0, target:b.target||{}, intensity:b.intensity||'' });
      } else if(b.kind==='set'){
        for(let r=1;r<=b.reps;r++){
          out.push({ phase:'arbeid', durationSec:b.workSec|0, target:b.target||{}, intensity:b.intensity||'', rep:r, reps:b.reps });
          out.push({ phase:'pause', durationSec:b.restSec|0, target:{speed:(b.target?.speed||0)*0.4, incline: b.target?.incline||0}, intensity:'Rolig', rep:r, reps:b.reps });
          if(r<b.reps && tPause>0){ out.push({ phase:'seriepause', durationSec:tPause, hidden:true }); }
        }
      } else if(b.kind==='continuous'){
        for(const seg of (b.segments||[])){
          out.push({ phase:'kontinuerlig', durationSec: seg.durationSec|0, target: seg.target||{}, intensity: seg.intensity||'' });
          if(tPause>0){ out.push({ phase:'overgang', durationSec:tPause, hidden:true }); }
        }
      }
    }
    return out;
  }

  function computePIPlaceholder(session){
    // Enkel PI: sammenlign gj.snitt puls på arbeid med gj.snitt fra siste 3 like økter
    const like = Store.data.sessions.filter(s => s.workoutId===session.workoutId).slice(-3);
    const cur = avg(session.drags.filter(d=>d.phase==='arbeid').map(d=>d.avgHr||0));
    const prev = avg(like.map(s=> avg(s.drags.filter(d=>d.phase==='arbeid').map(d=>d.avgHr||0)) ));
    if(!isFinite(cur) || !isFinite(prev) || prev===0) return null;
    return (prev - cur); // lavere puls ved lik belastning -> bedre
  }

  // --- Views ---
  function renderDashboard(){
    State.currentView='/';
    $('#app').innerHTML = `
      <section class="panel">
        <h3>Hurtigstart</h3>
        <div class="flex">
          <select id="selWorkout" class="input">
            ${Store.data.workouts.map(w=>`<option value="${w.id}" ${w.id===State.selectedWorkoutId?'selected':''}>${w.name}</option>`).join('')}
          </select>
          <button class="btn primary" id="btnStart">Start økt</button>
          <a class="btn" href="#/editor">Rediger økter</a>
        </div>
      </section>
      <section class="kpi" style="margin-top:1rem">
        <div class="card"><div class="label">Siste økter</div><div>${Store.data.sessions.length}</div></div>
        <div class="card"><div class="label">FTMS-støtte</div><div>${Store.data.settings.treadmill.supportsFTMS? 'Ja':'Nei'}</div></div>
      </section>
    `;
    $('#btnStart').onclick = ()=>{ State.selectedWorkoutId = $('#selWorkout').value; location.hash = '#/workout'; };
  }

  function renderEditor(){
    State.currentView='/editor';
    const w = Store.data.workouts.find(w=>w.id===State.selectedWorkoutId) || Store.data.workouts[0];
    if(w) State.selectedWorkoutId = w.id;
    $('#app').innerHTML = `
      <section class="panel">
        <h3>Økteditor</h3>
        <div class="flex" style="gap:.75rem; flex-wrap:wrap">
          <label>Velg økt: <select id="selW" class="input">${Store.data.workouts.map(x=>`<option value="${x.id}" ${x.id===State.selectedWorkoutId?'selected':''}>${x.name}</option>`).join('')}</select></label>
          <button class="btn" id="btnNew">Ny økt</button>
          <button class="btn danger" id="btnDel">Slett</button>
          <input id="wName" class="input" placeholder="Navn" value="${w? w.name:''}" />
          <button class="btn" id="btnSave">Lagre</button>
        </div>
        <div id="blocks" style="margin-top:1rem"></div>
        <div class="footer-actions">
          <button class="btn" id="btnAddWarmup">+ Oppvarming</button>
          <button class="btn" id="btnAddSet">+ Sett (intervaller)</button>
          <button class="btn" id="btnAddCont">+ Kontinuerlig</button>
          <button class="btn" id="btnAddCooldown">+ Nedjogg</button>
        </div>
      </section>
    `;
    const selW = $('#selW');
    selW.onchange = ()=>{ State.selectedWorkoutId = selW.value; renderEditor(); }

    $('#btnNew').onclick = ()=>{
      const nw = { id: crypto.randomUUID(), name: 'Ny økt', type:'custom', blocks:[] };
      Store.data.workouts.push(nw); Store.save(); State.selectedWorkoutId = nw.id; renderEditor();
    };
    $('#btnDel').onclick = ()=>{
      if(confirm('Slette valgt økt?')){ Store.data.workouts = Store.data.workouts.filter(x=>x.id!==State.selectedWorkoutId); Store.save(); renderEditor(); }
    };
    $('#btnSave').onclick = ()=>{ const cur = Store.data.workouts.find(x=>x.id===State.selectedWorkoutId); if(cur){ cur.name = $('#wName').value||cur.name; Store.save(); toast('Lagret'); } };

    function blockEditor(b, idx){
      const el = document.createElement('div'); el.className='panel';
      const rm = ()=>{ const w = Store.data.workouts.find(x=>x.id===State.selectedWorkoutId); w.blocks.splice(idx,1); Store.save(); renderEditor(); };
      if(b.kind==='warmup' || b.kind==='cooldown'){
        el.innerHTML = `
          <div class="flex"><strong>${b.kind==='warmup'?'Oppvarming':'Nedjogg'}</strong> <button class="btn danger" data-act="rm">Fjern</button></div>
          <div class="flex">
            <label>Varighet (s) <input type="number" value="${b.durationSec|0}" data-f="durationSec" class="input"></label>
            <label>Fart (km/t) <input type="number" step="0.1" value="${b.target?.speed||0}" data-f="speed" class="input"></label>
            <label>Stigning (%) <input type="number" step="0.5" value="${b.target?.incline||0}" data-f="incline" class="input"></label>
            <label>Intensitet <input value="${b.intensity||''}" data-f="intensity" class="input"></label>
          </div>`;
      } else if(b.kind==='set'){
        el.innerHTML = `
          <div class="flex"><strong>Sett</strong> <button class="btn danger" data-act="rm">Fjern</button></div>
          <div class="flex">
            <label>Reps <input type="number" value="${b.reps|0}" data-f="reps" class="input"></label>
            <label>Arbeid (s) <input type="number" value="${b.workSec|0}" data-f="workSec" class="input"></label>
            <label>Pause (s) <input type="number" value="${b.restSec|0}" data-f="restSec" class="input"></label>
            <label>Fart (km/t) <input type="number" step="0.1" value="${b.target?.speed||0}" data-f="speed" class="input"></label>
            <label>Stigning (%) <input type="number" step="0.5" value="${b.target?.incline||0}" data-f="incline" class="input"></label>
            <label>Intensitet <input value="${b.intensity||''}" data-f="intensity" class="input"></label>
          </div>`;
      } else if(b.kind==='continuous'){
        el.innerHTML = `<div class="flex"><strong>Kontinuerlig</strong> <button class="btn danger" data-act="rm">Fjern</button></div>
          <div>
            ${(b.segments||[]).map((s,i)=>`<div class="flex" style="margin:.3rem 0">
              <span class="badge">Segment ${i+1}</span>
              <label>Varighet (s) <input type="number" value="${s.durationSec|0}" data-f="durationSec" data-i="${i}" class="input seg"></label>
              <label>Fart (km/t) <input type="number" step="0.1" value="${s.target?.speed||0}" data-f="speed" data-i="${i}" class="input seg"></label>
              <label>Stigning (%) <input type="number" step="0.5" value="${s.target?.incline||0}" data-f="incline" data-i="${i}" class="input seg"></label>
              <button class="btn danger" data-act="delseg" data-i="${i}">Slett segment</button>
            </div>`).join('')}
            <div class="footer-actions"><button class="btn" data-act="addseg">+ Legg til segment</button></div>
          </div>`;
      }
      el.querySelector('[data-act="rm"]').onclick = rm;
      el.addEventListener('input', ev=>{
        const t = ev.target; const f = t.getAttribute('data-f'); if(!f) return;
        const w = Store.data.workouts.find(x=>x.id===State.selectedWorkoutId);
        const B = w.blocks[idx];
        if(t.classList.contains('seg')){
          const i = +t.getAttribute('data-i'); B.segments = B.segments||[]; const S = B.segments[i] || (B.segments[i]={ target:{} });
          if(f==='durationSec') S.durationSec = +t.value; else if(f==='speed') (S.target||(S.target={})).speed=+t.value; else if(f==='incline') (S.target||(S.target={})).incline=+t.value;
        } else {
          if(f==='durationSec') B.durationSec = +t.value; else if(f==='reps') B.reps=+t.value; else if(f==='workSec') B.workSec=+t.value; else if(f==='restSec') B.restSec=+t.value; else if(f==='speed') (B.target||(B.target={})).speed=+t.value; else if(f==='incline') (B.target||(B.target={})).incline=+t.value; else if(f==='intensity') B.intensity=t.value;
        }
        Store.save();
      });
      if(b.kind==='continuous'){
        el.querySelector('[data-act="addseg"]').onclick = ()=>{ const w = Store.data.workouts.find(x=>x.id===State.selectedWorkoutId); w.blocks[idx].segments = w.blocks[idx].segments||[]; w.blocks[idx].segments.push({durationSec:60, target:{speed:10, incline:1}}); Store.save(); renderEditor(); };
        el.querySelectorAll('[data-act="delseg"]').forEach(btn=> btn.onclick = ()=>{ const i=+btn.getAttribute('data-i'); const w = Store.data.workouts.find(x=>x.id===State.selectedWorkoutId); w.blocks[idx].segments.splice(i,1); Store.save(); renderEditor(); });
      }
      return el;
    }

    function refreshBlocks(){
      const w = Store.data.workouts.find(x=>x.id===State.selectedWorkoutId); const host = $('#blocks'); host.innerHTML='';
      (w.blocks||[]).forEach((b,idx)=> host.appendChild(blockEditor(b, idx)) );
    }
    refreshBlocks();

    $('#btnAddWarmup').onclick = ()=>{ const w = Store.data.workouts.find(x=>x.id===State.selectedWorkoutId); w.blocks.push({kind:'warmup', durationSec:600, target:{speed:9, incline:1}, intensity:'Lett'}); Store.save(); renderEditor(); };
    $('#btnAddSet').onclick = ()=>{ const w = Store.data.workouts.find(x=>x.id===State.selectedWorkoutId); w.blocks.push({kind:'set', reps:4, workSec:240, restSec:180, target:{speed:14, incline:1}, intensity:'Hardt'}); Store.save(); renderEditor(); };
    $('#btnAddCont').onclick = ()=>{ const w = Store.data.workouts.find(x=>x.id===State.selectedWorkoutId); w.blocks.push({kind:'continuous', segments:[{durationSec:300, target:{speed:12, incline:1}}]}); Store.save(); renderEditor(); };
    $('#btnAddCooldown').onclick = ()=>{ const w = Store.data.workouts.find(x=>x.id===State.selectedWorkoutId); w.blocks.push({kind:'cooldown', durationSec:600, target:{speed:8.5, incline:1}, intensity:'Lett'}); Store.save(); renderEditor(); };
  }

  function renderWorkout(){
    State.currentView='/workout';
    const w = Store.data.workouts.find(x=>x.id===State.selectedWorkoutId);
    const seq = expandBlocks(w.blocks||[]);
    const session = { id: crypto.randomUUID(), startedAt: new Date().toISOString(), workoutId:w.id, workoutName:w.name, drags:[], notes:'', settings: JSON.parse(JSON.stringify(Store.data.settings)) };
    let idx=0; let remaining = seq[0]? seq[0].durationSec:0; let running=false; let timer=null; let totalElapsed=0; let curDragStartHR=[]; let curDragHrSamples=[]; let curDragSpeedSamples=[];

    $('#app').innerHTML = `
      <section class="grid-2x2">
        <div class="panel" id="p1">
          <h3>Sensorer</h3>
          <div class="stack">
            <div class="value" id="valHR">--</div>
            <div class="sub">% av max: <span id="pctHR">–</span></div>
          </div>
          <div class="stack" style="margin-top:.5rem">
            <div>
              <div class="label">Fart (km/t)</div>
              <div class="flex"><button class="btn" id="spdDown">−</button><div class="value" id="valSpeed">0.0</div><button class="btn" id="spdUp">+</button></div>
            </div>
            <div>
              <div class="label">Stigning (%)</div>
              <div class="flex"><button class="btn" id="incDown">−</button><div class="value" id="valIncline">0.0</div><button class="btn" id="incUp">+</button></div>
            </div>
            <div>
              <div class="label">PI</div>
              <div class="flex"><a class="value" href="#/simulator" id="valPI">—</a></div>
            </div>
          </div>
        </div>
        <div class="panel zone-bg" id="p2">
          <h3>Sanntidsgraf (15 min)</h3>
          <canvas id="chart" class="chart"></canvas>
          <div class="flex" style="margin-top:.25rem; gap:1rem">
            <span class="badge">LT1: <span id="lt1">${Store.data.settings.lt1}</span> bpm</span>
            <span class="badge">LT2: <span id="lt2">${Store.data.settings.lt2}</span> bpm</span>
          </div>
        </div>
        <div class="panel" id="p3">
          <h3>Status</h3>
          <div class="label">Fase</div><div id="fase">—</div>
          <div class="label" style="margin-top:.5rem">Intensitet</div><div id="intensitet">—</div>
          <div class="label" style="margin-top:.5rem">Gjenstående tid</div><div class="value" id="rem">00:00</div>
          <div class="label" style="margin-top:.5rem">RPE (1–10) og merknader (lagres ved avsluttet drag)</div>
          <div class="flex"><input id="rpe" type="number" min="1" max="10" class="input" style="width:6ch"/><input id="note" class="input" placeholder="Merknad for siste drag" style="flex:1"/></div>
          <div class="label" style="margin-top:.5rem">Drag/sett</div><div id="dragInfo">—</div>
          <div class="controls" style="margin-top:.5rem">
            <button class="btn" id="btnSkip">Skip drag</button>
          </div>
        </div>
        <div class="panel" id="p4">
          <h3>Kontroll</h3>
          <div class="flex" style="gap:1rem">
            <div>
              <div class="label">Tid totalt</div><div id="tot">00:00</div>
            </div>
            <div>
              <div class="label">Snittpuls (drag)</div><div id="avgDrag">—</div>
            </div>
            <div>
              <div class="label">Gjenstående økt</div><div id="leftTot">—</div>
            </div>
          </div>
          <div class="footer-actions" style="margin-top:1rem">
            <button class="btn primary" id="btnStartPause">Start</button>
            <button class="btn danger" id="btnStop">Stopp & lagre</button>
          </div>
          <div id="iosWarn" class="alert" style="display:none; margin-top:1rem">Web Bluetooth er ikke støttet på denne enheten/nettleseren. Manuell kontroll vil fungere.</div>
        </div>
      </section>
    `;

    // iOS/Safari warning
    const ua = navigator.userAgent; const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
    if(isIOS || !('bluetooth' in navigator)) $('#iosWarn').style.display = 'block';

    // chart
    State.chart = $('#chart');

    function updateUI(){
      $('#valHR').textContent = State.hr? String(State.hr):'--';
      const pct = State.hr && Store.data.settings.hrMax? Math.round((State.hr/Store.data.settings.hrMax)*100) : null;
      $('#pctHR').textContent = pct? pct+'%':'–';
      $('#valSpeed').textContent = State.speed.toFixed(1);
      $('#valIncline').textContent = State.incline.toFixed(1);
      const cur = seq[idx];
      $('#fase').textContent = cur? (cur.hidden? '(overgang)': cur.phase) : '—';
      $('#intensitet').textContent = cur? (cur.intensity||'') : '—';
      $('#rem').textContent = fmtTime(remaining);
      $('#dragInfo').textContent = cur && cur.reps? `Drag ${cur.rep||'?'} / ${cur.reps}` : '—';
      $('#avgDrag').textContent = curDragStartHR.length? Math.round(avg(curDragStartHR))+' bpm':'—';
      const leftTot = seq.slice(idx).reduce((a,b)=>a + (b.durationSec||0),0) + remaining - (seq[idx]?.durationSec||0);
      $('#leftTot').textContent = fmtTime(leftTot);
      drawChart(State.chart, State.hrSamples, State.speedSamples, {windowSec:900});
      const pi = computePIPlaceholder(session); $('#valPI').textContent = (pi==null? '—' : (pi>0? '+' : '') + pi.toFixed(1));
      $('#tot').textContent = fmtTime(totalElapsed);
    }

    function finishDrag(){
      const cur = seq[idx]; if(!cur) return;
      const rec = {
        phase: cur.phase, durationSec: cur.durationSec, intensity:cur.intensity||'',
        target: cur.target||{}, avgHr: Math.round(avg(curDragStartHR))||null,
        avgSpeed: avg(curDragSpeedSamples)||null, rpe: +$('#rpe').value||null, note: $('#note').value||''
      };
      session.drags.push(rec);
      // reset fields for next drag input
      $('#rpe').value = ''; $('#note').value='';
      curDragStartHR.length=0; curDragHrSamples.length=0; curDragSpeedSamples.length=0;
    }

    function tick(){
      if(!running) return;
      remaining -= 1; totalElapsed += 1;
      const cur = seq[idx];
      // sample per second for export/avg
      if(State.hr!=null) curDragStartHR.push(State.hr);
      curDragSpeedSamples.push(State.speed);
      if(remaining<=0){
        finishDrag();
        idx++;
        if(idx >= seq.length){
          stopAndSave(); return;
        }
        remaining = seq[idx].durationSec|0;
      }
      updateUI();
    }

    function start(){ if(running) return; running=true; $('#btnStartPause').textContent='Pause'; requestWakeLock(); timer = setInterval(tick, 1000); }
    function pause(){ if(!running) return; running=false; $('#btnStartPause').textContent='Start'; clearInterval(timer); releaseWakeLock(); }
    function stopAndSave(){
      pause(); releaseWakeLock(); session.endedAt = new Date().toISOString(); session.summary = {
        avgHr: Math.round(avg(session.drags.map(d=>d.avgHr||0))||0), durationSec: totalElapsed
      };
      Store.data.sessions.push(session); Store.save();
      location.hash = '#/results';
    }

    // Events
    $('#btnStartPause').onclick = ()=> running? pause(): start();
    $('#btnStop').onclick = ()=>{ if(running && !confirm('Økt kjører. Avslutte og lagre?')) return; stopAndSave(); };
    $('#btnSkip').onclick = ()=>{ finishDrag(); idx++; remaining = seq[idx]? seq[idx].durationSec:0; updateUI(); };

    $('#spdUp').onclick = ()=>{ State.speed = clamp(State.speed + 0.1, 0, 25); };
    $('#spdDown').onclick = ()=>{ State.speed = clamp(State.speed - 0.1, 0, 25); };
    $('#incUp').onclick = ()=>{ State.incline = clamp(State.incline + 0.5, 0, 15); };
    $('#incDown').onclick = ()=>{ State.incline = clamp(State.incline - 0.5, 0, 15); };

    // Keyboard shortcuts
    window.onkeydown = (e)=>{
      if(e.code==='Space'){ e.preventDefault(); running? pause(): start(); }
      else if(e.key==='s' || e.key==='S'){ stopAndSave(); }
      else if(e.key==='ArrowUp'){ State.speed = clamp(State.speed + 0.1,0,25);} 
      else if(e.key==='ArrowDown'){ State.speed = clamp(State.speed - 0.1,0,25);} 
      else if(e.key==='ArrowRight'){ State.incline = clamp(State.incline + 0.5,0,15);} 
      else if(e.key==='ArrowLeft'){ State.incline = clamp(State.incline - 0.5,0,15);} 
    };

    // fake initial targets
    if(seq[0]?.target){ State.speed = seq[0].target.speed||0; State.incline = seq[0].target.incline||0; }

    // UI refresh loop
    updateUI();
    const rafLoop = ()=>{ updateUI(); requestAnimationFrame(rafLoop); };
    requestAnimationFrame(rafLoop);
  }

  function renderSimulator(){
    State.currentView='/simulator';
    $('#app').innerHTML = `
      <section class="panel">
        <h3>Responssimulator</h3>
        <p>— (kommer senere). Her vil PI beregnes mer avansert og kunne kalibreres.</p>
        <div class="footer-actions"><a class="btn" href="#/workout">Tilbake til økta</a></div>
      </section>
    `;
  }

  function renderResults(){
    State.currentView='/results';
    const last = Store.data.sessions[Store.data.sessions.length-1];
    if(!last){ $('#app').innerHTML = '<section class="panel"><h3>Resultater</h3><p>Ingen økter enda.</p></section>'; return; }
    $('#app').innerHTML = `
      <section class="panel">
        <h3>Resultat: ${last.workoutName}</h3>
        <div class="flex" style="gap:1rem; flex-wrap:wrap">
          <div class="badge">Varighet: ${fmtTime(last.summary?.durationSec||0)}</div>
          <div class="badge">Snittpuls: ${last.summary?.avgHr||'—'} bpm</div>
        </div>
        <div style="margin-top:1rem">
          <table class="table"><thead><tr><th>#</th><th>Fase</th><th>Varighet</th><th>Intensitet</th><th>Mål</th><th>Avg HR</th><th>Avg fart</th><th>RPE</th><th>Merknad</th></tr></thead>
          <tbody>
          ${(last.drags||[]).map((d,i)=>`<tr>
            <td>${i+1}</td><td>${d.phase}</td><td>${fmtTime(d.durationSec||0)}</td><td>${d.intensity||''}</td>
            <td>${d.target? (d.target.speed||'-')+' km/t, '+(d.target.incline||'-')+'%' : ''}</td>
            <td>${d.avgHr||'—'}</td><td>${d.avgSpeed? d.avgSpeed.toFixed(1):'—'}</td><td>${d.rpe||''}</td><td>${(d.note||'')}</td>
          </tr>`).join('')}
          </tbody></table>
        </div>
        <div class="footer-actions">
          <button class="btn" id="btnExportTCX">Eksporter TCX</button>
        </div>
      </section>
    `;

    $('#btnExportTCX').onclick = ()=>{
      const tcx = buildTCX(last);
      const blob = new Blob([tcx], {type:'application/vnd.garmin.tcx+xml'});
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `INTZ_${(new Date(last.startedAt)).toISOString().replace(/[:.]/g,'-')}.tcx`; a.click();
    }
  }

  function buildTCX(session){
    // Enkel TCX uten per-sekund trackpoints (vi lager per-drag start/stop). Kan utvides senere.
    const start = new Date(session.startedAt).toISOString();
    const total = session.summary?.durationSec || 0;
    return `<?xml version="1.0" encoding="UTF-8"?>\n`+
`<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"\n  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2\n  http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">\n`+
`  <Activities>\n    <Activity Sport="Running">\n      <Id>${start}</Id>\n      <Lap StartTime="${start}">\n        <TotalTimeSeconds>${total}</TotalTimeSeconds>\n        <TriggerMethod>Manual</TriggerMethod>\n        <Track>\n          ${session.drags.map((d,i)=>`<Trackpoint><Time>${new Date(new Date(session.startedAt).getTime() + 1000*session.drags.slice(0,i).reduce((a,b)=>a+(b.durationSec||0),0)).toISOString()}</Time>
            ${d.avgHr? `<HeartRateBpm><Value>${d.avgHr}</Value></HeartRateBpm>`:''}
            <Extensions><LX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2"><AvgSpeed>${(d.avgSpeed||0)/3.6}</AvgSpeed></LX></Extensions>
          </Trackpoint>`).join('')}\n        </Track>\n      </Lap>\n      <Notes>${session.notes||''}</Notes>\n    </Activity>\n  </Activities>\n</TrainingCenterDatabase>`;
  }

  function renderSettings(){
    State.currentView='/settings';
    const s = Store.data.settings;
    $('#app').innerHTML = `
      <section class="panel">
        <h3>Innstillinger</h3>
        <div class="flex" style="flex-wrap:wrap; gap:1rem">
          <label>Alder <input id="age" type="number" class="input" value="${s.age}"></label>
          <label>Vekt (kg) <input id="weight" type="number" class="input" value="${s.weight}"></label>
          <label>VO₂max <input id="vo2" type="number" class="input" value="${s.vo2max}"></label>
          <label>Maks puls <input id="hrMax" type="number" class="input" value="${s.hrMax}"></label>
          <label>LT1 (puls) <input id="lt1i" type="number" class="input" value="${s.lt1}"></label>
          <label>LT2 (puls) <input id="lt2i" type="number" class="input" value="${s.lt2}"></label>
          <label>Overgangspause (s) <input id="tpause" type="number" class="input" value="${s.transitionPauseSec|0}"></label>
        </div>
        <details style="margin-top:1rem"><summary>Veiledning: LT1/LT2 og Maxpuls</summary>
          <p>Se brukerveiledning/protokoll. Kalibrer på forhånd for best mulig PI.</p>
        </details>
        <div class="footer-actions"><button class="btn" id="save">Lagre</button></div>
      </section>
    `;
    $('#save').onclick = ()=>{
      s.age=+$('#age').value; s.weight=+$('#weight').value; s.vo2max=+$('#vo2').value; s.hrMax=+$('#hrMax').value; s.lt1=+$('#lt1i').value; s.lt2=+$('#lt2i').value; s.transitionPauseSec=+$('#tpause').value;
      Store.save(); toast('Lagret');
    };
  }

  function renderLog(){
    State.currentView='/log';
    $('#app').innerHTML = `
      <section class="panel">
        <h3>Logg</h3>
        <table class="table"><thead><tr><th>Dato</th><th>Økt</th><th>Varighet</th><th>Snitt HR</th><th></th></tr></thead>
        <tbody>
          ${Store.data.sessions.map((s,i)=>`<tr>
            <td>${new Date(s.startedAt).toLocaleString()}</td>
            <td>${s.workoutName}</td>
            <td>${fmtTime(s.summary?.durationSec||0)}</td>
            <td>${s.summary?.avgHr||'—'}</td>
            <td><button class="btn" data-i="${i}" data-act="view">Vis</button></td>
          </tr>`).join('')}
        </tbody></table>
      </section>
    `;
    $$('#app [data-act="view"]').forEach(btn=> btn.onclick = ()=>{ location.hash = '#/results'; });
  }

  // --- Top bar actions ---
  $('#hamburger').onclick = ()=> $('#dropdown').classList.toggle('hidden');
  $('#btnConnectHR').onclick = ()=> BLE.connectHR();
  $('#btnConnectFTMS').onclick = ()=> BLE.connectFTMS();
  setInterval(()=>{ $('#clock').textContent = new Date().toLocaleTimeString(); }, 500);

  // --- Initial Nav ---
  window.addEventListener('hashchange', navigate);
  navigate();
})();
