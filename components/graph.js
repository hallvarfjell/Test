// Enkel graf: HR (rød) og fart (gul) siste 15 min
const Graph = (function(){
  const WINDOW_SEC = 15*60;
  const hrData = []; // {t,bpm}
  const spdData = []; // {t,spd}
  let ctxHR, ctxSPD, elZones, axes, lt1=135, lt2=160, zones=[90,110,130,150,170,999];

  function init(container, settings){
    container.innerHTML='';
    elZones = UI.h('div',{class:'zones'});
    const c1 = UI.h('canvas',{id:'hrcanvas'});
    const c2 = UI.h('canvas',{id:'spdcanvas'});
    axes = UI.h('div',{class:'graf-axes'});
    container.append(elZones,c1,c2,axes);
    ctxHR = c1.getContext('2d');
    ctxSPD = c2.getContext('2d');
    function resize(){
      const r = axes.getBoundingClientRect();
      c1.width = r.width; c1.height = r.height;
      c2.width = r.width; c2.height = r.height;
      draw();
    }
    new ResizeObserver(resize).observe(container);
    lt1 = settings.lt1; lt2 = settings.lt2; zones = settings.soner.concat([999]);
    drawZones();
  }

  function addHR(bpm){ hrData.push({t:Date.now()/1000, bpm}); cleanup(); draw(); }
  function addSPD(spd){ spdData.push({t:Date.now()/1000, spd}); cleanup(); draw(); }

  function cleanup(){
    const t0 = Date.now()/1000 - WINDOW_SEC;
    while(hrData.length && hrData[0].t < t0) hrData.shift();
    while(spdData.length && spdData[0].t < t0) spdData.shift();
  }

  function slope30(){
    const t1 = Date.now()/1000; const t0 = t1-30; const pts = hrData.filter(p=>p.t>=t0);
    if(pts.length<2) return 0; const dy = pts[pts.length-1].bpm - pts[0].bpm; return dy/30;
  }

  function drawZones(){
    elZones.innerHTML='';
    const r = axes.getBoundingClientRect(); const H = r.height;
    // soner er grenser: [z0,z1,z2,z3,z4] + 999
    const maxy = Math.max(...hrData.map(p=>p.bpm).concat([lt2+10,160]));
    const miny = Math.min(...hrData.map(p=>p.bpm).concat([60]));
    const span = Math.max(10, maxy-miny);
    const colors = ['var(--zone0)','var(--zone1)','var(--zone2)','var(--zone3)','var(--zone4)','var(--zone5)'];
    let yPrev = 0;
    for(let i=0;i<zones.length;i++){
      const z = Math.min(zones[i], maxy); const prev = Math.max(miny, i?zones[i-1]:miny);
      const yTop = (1-(z-miny)/span)*H; const yBottom = (1-(prev-miny)/span)*H;
      const div = UI.h('div',{style:`position:absolute;left:0;right:0;top:${yTop}px;height:${Math.max(0,yBottom-yTop)}px;background:${colors[i]};opacity:.10`});
      elZones.appendChild(div);
    }
  }

  function draw(){
    if(!ctxHR||!ctxSPD) return;
    const r = axes.getBoundingClientRect(); const W = r.width, H=r.height;
    ctxHR.clearRect(0,0,W,H); ctxSPD.clearRect(0,0,W,H);
    const t1 = Date.now()/1000; const t0 = t1 - WINDOW_SEC;
    const maxy = Math.max(...hrData.map(p=>p.bpm).concat([lt2+10,160]));
    const miny = Math.min(...hrData.map(p=>p.bpm).concat([60]));
    const span = Math.max(10, maxy-miny);

    // HR curve
    ctxHR.strokeStyle = '#ff4d4d'; ctxHR.lineWidth=2; ctxHR.beginPath();
    hrData.forEach((p,i)=>{
      const x = (p.t - t0)/WINDOW_SEC * W;
      const y = (1-(p.bpm-miny)/span)*H;
      if(i===0) ctxHR.moveTo(x,y); else ctxHR.lineTo(x,y);
    });
    ctxHR.stroke();

    // LT1/LT2 lines
    ctxHR.strokeStyle = 'white'; ctxHR.setLineDash([4,4]);
    [lt1, lt2].forEach(val=>{ const y=(1-(val-miny)/span)*H; ctxHR.beginPath(); ctxHR.moveTo(0,y); ctxHR.lineTo(W,y); ctxHR.stroke(); });
    ctxHR.setLineDash([]);

    // Speed curve
    // Scale speed 0-25 km/t on right axis
    const Smax = 25; ctxSPD.strokeStyle='#ffd84d'; ctxSPD.lineWidth=2; ctxSPD.beginPath();
    spdData.forEach((p,i)=>{
      const x = (p.t - t0)/WINDOW_SEC * W;
      const y = (1-(p.spd/Smax))*H;
      if(i===0) ctxSPD.moveTo(x,y); else ctxSPD.lineTo(x,y);
    });
    ctxSPD.stroke();
  }

  return { init, addHR, addSPD, slope30, drawZones };
})();
