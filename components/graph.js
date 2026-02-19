
// Combined HR (left axis) and Speed (right axis) graph for Økt and Resultat
// HR axis: 90..190 bpm, Speed axis: 0..20 km/t

const Graph = (function(){
  const HR_MIN=90, HR_MAX=190; const SPD_MIN=0, SPD_MAX=20;
  function Combined(container){
    this.W=container.clientWidth||900; this.H=container.clientHeight||260;
    this.canvas=document.createElement('canvas'); this.canvas.width=this.W; this.canvas.height=this.H;
    container.innerHTML=''; container.appendChild(this.canvas);
    this.ctx=this.canvas.getContext('2d');
    this.t0=null; this.hr=[], this.spd=[]; // {t,bpm}, {t,kmh}
    const ro=new ResizeObserver(()=>{ const r=container.getBoundingClientRect(); this.canvas.width=r.width; this.canvas.height=r.height; this.W=r.width; this.H=r.height; this.draw(); });
    ro.observe(container);
  }
  Combined.prototype.addHR=function(bpm){ const t=Date.now()/1000; this.hr.push({t,bpm}); this.trim(); this.draw(); }
  Combined.prototype.addSPD=function(kmh){ const t=Date.now()/1000; this.spd.push({t,kmh}); this.trim(); this.draw(); }
  Combined.prototype.setSeries=function(hrSeries, spdSeries){ this.hr=hrSeries||[]; this.spd=spdSeries||[]; this.draw(); }
  Combined.prototype.trim=function(){ const t1=Date.now()/1000, WINDOW=15*60; const t0=t1-WINDOW; while(this.hr.length&&this.hr[0].t<t0) this.hr.shift(); while(this.spd.length&&this.spd[0].t<t0) this.spd.shift(); }
  Combined.prototype.draw=function(){ const ctx=this.ctx, W=this.canvas.width, H=this.canvas.height; ctx.clearRect(0,0,W,H); if(!W||!H) return; const left=40,right=40,top=10,bottom=24; ctx.strokeStyle='#b4c4e8'; ctx.strokeRect(left,top,W-left-right,H-top-bottom);
    // grid
    ctx.strokeStyle='#e5ecfb'; ctx.lineWidth=1; for(let hr=100; hr<=180; hr+=20){ const y=top+(1-(hr-HR_MIN)/(HR_MAX-HR_MIN))*(H-top-bottom); ctx.beginPath(); ctx.moveTo(left,y); ctx.lineTo(W-right,y); ctx.stroke(); }
    // axes labels
    ctx.fillStyle='#0b1220'; ctx.font='12px system-ui'; ctx.fillText('HR (bpm)',4,14); ctx.fillText('Fart (km/t)', W-90,14);
    [90,110,130,150,170,190].forEach(v=>{ const y=top+(1-(v-HR_MIN)/(HR_MAX-HR_MIN))*(H-top-bottom); ctx.fillText(String(v), 4, Math.max(12, Math.min(H-2,y))); });
    [0,5,10,15,20].forEach(v=>{ const y=top+(1-(v-SPD_MIN)/(SPD_MAX-SPD_MIN))*(H-top-bottom); ctx.fillText(String(v), W-34, Math.max(12, Math.min(H-2,y))); });
    // time range
    const all = (this.hr[0]||this.spd[0])? (this.hr.length?this.hr:this.spd) : []; if(all.length<2){ return; }
    const tt0 = Math.min(this.hr.length?this.hr[0].t:Infinity, this.spd.length?this.spd[0].t:Infinity);
    const tt1 = Math.max(this.hr.length?this.hr[this.hr.length-1].t:-Infinity, this.spd.length?this.spd[this.spd.length-1].t:-Infinity);
    const Wplot=W-left-right;
    // HR line
    ctx.strokeStyle='#d93c3c'; ctx.lineWidth=2; ctx.beginPath(); this.hr.forEach((p,i)=>{ const x=left + ( (p.t-tt0)/(tt1-tt0) )*Wplot; const y=top+(1-(p.bpm-HR_MIN)/(HR_MAX-HR_MIN))*(H-top-bottom); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }); ctx.stroke();
    // SPD line
    ctx.strokeStyle='#d6a600'; ctx.lineWidth=2; ctx.beginPath(); this.spd.forEach((p,i)=>{ const x=left + ( (p.t-tt0)/(tt1-tt0) )*Wplot; const y=top+(1-(p.kmh-SPD_MIN)/(SPD_MAX-SPD_MIN))*(H-top-bottom); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }); ctx.stroke();
  }
  return { Combined };
})();
