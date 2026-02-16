// HR (rød) + speed (gul) + LT1/LT2 + pulssoner + TIZ
const Graph = (function(){
  const WINDOW = 15*60; // 15 min
  const hr=[]; const spd=[]; // {t,bpm} / {t,kmh}
  let lt1=135, lt2=160, zones=[115,134,145,164,174,999];
  let cHR, cSPD, ctxHR, ctxSPD, axes, zHost, cTIZ, ctxTIZ;
  const tiz=[0,0,0,0,0,0];

  function init(grafEl, settings){
    grafEl.innerHTML='';
    lt1 = settings.lt1; lt2 = settings.lt2; zones = (settings.soner||[115,134,145,164,174]).concat([999]);
    const zonesEl = document.createElement('div'); zonesEl.className='zones'; zHost=zonesEl;
    cHR = document.createElement('canvas'); cHR.className='hr'; ctxHR = cHR.getContext('2d');
    cSPD = document.createElement('canvas'); cSPD.className='spd'; ctxSPD = cSPD.getContext('2d');
    axes = document.createElement('div'); axes.className='axes';
    grafEl.append(zonesEl, cHR, cSPD, axes);
    const ro = new ResizeObserver(()=>{ const r=axes.getBoundingClientRect(); cHR.width=r.width; cHR.height=r.height; cSPD.width=r.width; cSPD.height=r.height; draw(); drawZones(); });
    ro.observe(grafEl);
  }

  function initTIZ(container){
    container.innerHTML=''; cTIZ = document.createElement('canvas'); cTIZ.id='tiz'; ctxTIZ=cTIZ.getContext('2d'); container.appendChild(cTIZ);
    const ro = new ResizeObserver(()=>{ const r=container.getBoundingClientRect(); cTIZ.width=r.width; cTIZ.height=r.height; drawTIZ(); }); ro.observe(container);
  }

  function addHR(bpm){
    const t=Date.now()/1000; hr.push({t,bpm});
    const i = zoneIndex(bpm); if(i>=0) tiz[i]+=1; cleanup(); draw(); drawTIZ();
  }
  function addSPD(kmh){ spd.push({t:Date.now()/1000, kmh}); cleanup(); draw(); }

  function zoneIndex(b){
    if(b<zones[0]) return 0; if(b<zones[1]) return 1; if(b<zones[2]) return 2; if(b<zones[3]) return 3; if(b<zones[4]) return 4; return 5;
  }

  function cleanup(){ const t0=Date.now()/1000 - WINDOW; while(hr.length && hr[0].t<t0) hr.shift(); while(spd.length && spd[0].t<t0) spd.shift(); }

  function draw(){ if(!ctxHR||!ctxSPD) return; const r=cHR.getBoundingClientRect(); const W=r.width, H=r.height; ctxHR.clearRect(0,0,W,H); ctxSPD.clearRect(0,0,W,H);
    const t1=Date.now()/1000, t0=t1-WINDOW; const ys = hr.map(p=>p.bpm); const miny=Math.min(60, ...ys); const maxy=Math.max(170, ...ys, lt2+10); const span=Math.max(10, maxy-miny);
    // HR line
    ctxHR.strokeStyle='#d93c3c'; ctxHR.lineWidth=2; ctxHR.beginPath(); hr.forEach((p,i)=>{ const x=(p.t-t0)/WINDOW*W; const y=(1-(p.bpm-miny)/span)*H; if(i===0) ctxHR.moveTo(x,y); else ctxHR.lineTo(x,y); }); ctxHR.stroke();
    // LT lines
    ctxHR.strokeStyle='#000'; ctxHR.setLineDash([4,4]); [lt1,lt2].forEach(v=>{ const y=(1-(v-miny)/span)*H; ctxHR.beginPath(); ctxHR.moveTo(0,y); ctxHR.lineTo(W,y); ctxHR.stroke(); }); ctxHR.setLineDash([]);
    // SPD line (right axis 0-25)
    const Smax=25; ctxSPD.strokeStyle='#d6a600'; ctxSPD.lineWidth=2; ctxSPD.beginPath(); spd.forEach((p,i)=>{ const x=(p.t-t0)/WINDOW*W; const y=(1-(p.kmh/Smax))*H; if(i===0) ctxSPD.moveTo(x,y); else ctxSPD.lineTo(x,y); }); ctxSPD.stroke();
  }

  function drawZones(){ if(!zHost) return; zHost.innerHTML=''; const r=cHR.getBoundingClientRect(); const H=r.height; const ys = hr.map(p=>p.bpm); const miny=Math.min(60,...ys); const maxy=Math.max(170,...ys, lt2+10); const span=Math.max(10,maxy-miny);
    const colors=['var(--zone0)','var(--zone1)','var(--zone2)','var(--zone3)','var(--zone4)','var(--zone5)'];
    for(let i=0;i<zones.length;i++){
      const z = Math.min(zones[i], maxy); const prev = Math.max(miny, i?zones[i-1]:miny);
      const yTop = (1-(z-miny)/span)*H; const yBottom=(1-(prev-miny)/span)*H;
      const div=document.createElement('div'); div.style=`position:absolute;left:0;right:0;top:${yTop}px;height:${Math.max(0,yBottom-yTop)}px;background:${colors[i]};opacity:.12`; zHost.appendChild(div);
    }
  }

  function slope30(){ const t1=Date.now()/1000, t0=t1-30; const pts=hr.filter(p=>p.t>=t0); if(pts.length<2) return 0; return (pts[pts.length-1].bpm-pts[0].bpm)/30; }

  function drawTIZ(){ if(!ctxTIZ) return; const W=cTIZ.width, H=cTIZ.height; ctxTIZ.clearRect(0,0,W,H); const total = tiz.reduce((a,b)=>a+b,0)||1; const labels=['S0','S1','S2','S3','S4','S5']; const colors=['#c7c9d3','#79d49a','#a0b7d8','#f2e56b','#ffb56b','#ff6b6b'];
    const barH=H/6*0.8; const gap=H/6*0.2; for(let i=0;i<6;i++){ const y=i*(barH+gap)+gap/2; const frac=tiz[i]/total; const w=Math.round(frac*W); ctxTIZ.fillStyle=colors[i]; ctxTIZ.fillRect(0,y,w,barH); ctxTIZ.fillStyle='#0b1220'; ctxTIZ.fillText(`${labels[i]} ${(tiz[i]||0)}s (${Math.round(frac*100)}%)`, 8, y+barH/2+4); }
  }

  return { init, addHR, addSPD, initTIZ };
})();
