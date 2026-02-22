
// PI hotfix v1.3.7a
// Provides PI compute engine + compact UI so that app.js (Routes -> PIMod) resolves and Workout can call PI.compute.

const PI = (function(){
  let cfg=null; let waterL=0; // L accumulated
  function load(){
    cfg = Storage.loadP(AppState.currentProfile,'settings',{})||{};
    cfg = Object.assign({ HRmax:190, HRrest:50, LT1:135, LT2:160, RPE_LT1:4, RPE_LT2:7, P_L1:null, P_L2:null, mass:75,
      met_eff:0.25, shoe_gain_pct:4, tm_cal:1.0,
      sweat_r1:0.8, sweat_r2:1.6, sweat_k:1.5, sweat_base:20, sweat_temp_slope:0.03, dehyd_thresh:1.0,
      drift_heat_perC_perMin:0.0005, drift_dehyd_perPct:0.02, drift_fatigue_perUnit:0.001,
      drift_glyc_perMin:0.0008, glyc_onset_min:45, glyc_tau_min:30,
      wHR:2, wRPE:1 }, cfg);
    return cfg;
  }
  function save(nc){ cfg=Object.assign(load(), nc||{}); Storage.saveP(AppState.currentProfile,'settings',cfg); return cfg; }
  const clamp01=x=>Math.max(0,Math.min(1,x));
  const pctHRR=(hr,r,m)=>(hr-r)/Math.max(1,(m-r));
  function demand_Wkg(speedKmh, gradePct){ const c=load(); const v=(speedKmh||0)/3.6, i=(gradePct||0)/100; const P_flat=4.185*v; const P_climb=(9.81*v*i)/(c.met_eff||0.25); const shoe=1-Math.max(0,(c.shoe_gain_pct||0)/100); const tm=(c.tm_cal||1); return (P_flat+P_climb)*shoe*tm; }
  function expectedFromPower(Pd){ const c=load(); if(c.P_L1&&c.P_L2&&c.P_L2>0){ const IF=Pd/c.P_L2, IF1=c.P_L1/c.P_L2; const x=clamp01((IF-IF1)/Math.max(1e-6,(1-IF1))); const p1=pctHRR(c.LT1,c.HRrest,c.HRmax), p2=pctHRR(c.LT2,c.HRrest,c.HRmax); return {IF,x,pHRR_exp:p1+x*(p2-p1), RPE_exp:(c.RPE_LT1||4)+x*((c.RPE_LT2||7)-(c.RPE_LT1||4))}; } else { const p1=pctHRR(c.LT1,c.HRrest,c.HRmax), p2=pctHRR(c.LT2,c.HRrest,c.HRmax); return {IF:1,x:null,pHRR_exp:(p1+p2)/2, RPE_exp:(c.RPE_LT1+c.RPE_LT2)/2}; } }
  function sweatRateLph(tempC,x){ const c=load(); const base=(c.sweat_r1||0.8)*Math.pow((c.sweat_r2||1.6)/(c.sweat_r1||0.8), Math.pow(clamp01(x||0),(c.sweat_k||1.5))); const add=(tempC>(c.sweat_base||20))? (c.sweat_temp_slope||0.03)*(tempC-(c.sweat_base||20)):0; return base+add; }
  function hrDrift(totalMin,tempC,dehydPct,fatigueUnit,glycMin){ const c=load(); const dHeat=Math.max(0,(tempC-20))*(c.drift_heat_perC_perMin||0.0005)*totalMin; const dDehy=Math.max(0,(dehydPct-(c.dehyd_thresh||1)))*(c.drift_dehyd_perPct||0.02); const dFat=Math.max(0,fatigueUnit)*(c.drift_fatigue_perUnit||0.001); const over=Math.max(0,glycMin-(c.glyc_onset_min||45)); const dGlyc=(over>0)? (c.drift_glyc_perMin||0.0008)*(1-Math.exp(-over/Math.max(1,(c.glyc_tau_min||30))))*glycMin:0; return { total:(dHeat+dDehy+dFat+dGlyc), parts:{heat:dHeat,dehyd:dDehy,fatigue:dFat,glyc:dGlyc} } }
  function compute(now,state){ const Pd=demand_Wkg(state.speedKmh||0,state.inclinePct||0); const exp=expectedFromPower(Pd); const nowMs=now||performance.now(); if(state.prevTime==null) state.prevTime=nowMs; let dt=Math.max(0,(nowMs-state.prevTime)/1000); state.prevTime=nowMs; if(dt>2) dt=1; state.tSec=(state.tSec||0)+dt; const Lph=sweatRateLph(state.tempC||20,exp.x); state.cumSweatL=(state.cumSweatL||0)+Lph*(dt/3600); const dehydPct=(state.cumSweatL - waterL)/(load().mass||75)*100; const fatigue=(exp.x==null?0.5:exp.x)*(state.tSec/60); const drift=hrDrift(state.tSec/60,state.tempC||20,dehydPct,fatigue,state.tSec/60); const HRobs=state.hr||0; const HRnet=HRobs/(1+Math.max(0,drift.total)); const pAct=pctHRR(HRnet,load().HRrest,load().HRmax); const ratioHR=(exp.pHRR_exp>0)?(pAct/exp.pHRR_exp):1; const ratioRPE=(exp.RPE_exp>0)?((state.rpe||6)/exp.RPE_exp):1; const a=(load().wHR||2), b=(load().wRPE||1); const IR=Math.pow(Math.pow(ratioHR,a)*Math.pow(ratioRPE,b),1/Math.max(1,(a+b))); const IF=exp.IF||1; const PI_tot=IF/Math.max(1e-6,IR); return {Pd_Wkg:Pd, IF, HRobs, HRnet, dHR:Math.max(0,HRobs-HRnet), IR, PI:PI_tot, drift}; }
  function addWater(dl){ waterL += (dl||0)/10; }
  return { load, save, compute, addWater };
})();

const PIMod = {
  render(el){ el.innerHTML=''; const s=PI.load();
    const top=UI.h('div',{class:'controls'}); top.append(UI.h('button',{class:'btn',onclick:()=>{ location.hash='#/workout'; }},'← Tilbake til Økt'));
    // Very compact UI: only essentials
    const grid=document.createElement('div'); grid.style.cssText='display:grid; grid-template-columns:repeat(3,minmax(240px,1fr)); gap:.5rem;';
    function tile(title){ const c=UI.h('div',{class:'card'}); c.style.padding='.55rem'; c.append(UI.h('h3',{},title)); return c; }

    // Physiology
    const t1=tile('Fysiologi');
    const HRmax=UI.h('input',{class:'input',type:'number',value:String(s.HRmax)});
    const HRrest=UI.h('input',{class:'input',type:'number',value:String(s.HRrest)});
    const LT1=UI.h('input',{class:'input',type:'number',value:String(s.LT1)});
    const LT2=UI.h('input',{class:'input',type:'number',value:String(s.LT2)});
    const P1=UI.h('input',{class:'input',type:'number',step:'0.01',value:String(s.P_L1??'')});
    const P2=UI.h('input',{class:'input',type:'number',step:'0.01',value:String(s.P_L2??'')});
    const m =UI.h('input',{class:'input',type:'number',value:String(s.mass)});
    function R(lbl,inp){ const r=UI.h('div',{class:'controls'}); r.append(UI.h('label',{class:'small',style:'min-width:120px'},lbl), inp); return r; }
    t1.append(R('HRmax',HRmax),R('HRrest',HRrest),R('LT1',LT1),R('LT2',LT2),R('P_LT1 (W/kg)',P1),R('P_LT2 (W/kg)',P2),R('Masse (kg)',m));

    // External
    const t2=tile('Eksternt');
    const met=UI.h('input',{class:'input',type:'number',step:'0.01',value:String(s.met_eff)});
    const shoe=UI.h('input',{class:'input',type:'number',step:'0.1',value:String(s.shoe_gain_pct)});
    const tm =UI.h('input',{class:'input',type:'number',step:'0.001',value:String(s.tm_cal)});
    t2.append(R('Met-eff',met),R('Sko-gevin (%)',shoe),R('Mølle kal (×)',tm));

    // Drift
    const t3=tile('HR-drift');
    const dHeat=UI.h('input',{class:'input',type:'number',step:'0.0001',value:String(s.drift_heat_perC_perMin)});
    const r1=UI.h('input',{class:'input',type:'number',step:'0.1',value:String(s.sweat_r1)});
    const r2=UI.h('input',{class:'input',type:'number',step:'0.1',value:String(s.sweat_r2)});
    const k =UI.h('input',{class:'input',type:'number',step:'0.1',value:String(s.sweat_k)});
    const base=UI.h('input',{class:'input',type:'number',step:'0.5',value:String(s.sweat_base)});
    const slope=UI.h('input',{class:'input',type:'number',step:'0.01',value:String(s.sweat_temp_slope)});
    const dth=UI.h('input',{class:'input',type:'number',step:'0.1',value:String(s.dehyd_thresh)});
    const dDeh=UI.h('input',{class:'input',type:'number',step:'0.001',value:String(s.drift_dehyd_perPct)});
    const dFat=UI.h('input',{class:'input',type:'number',step:'0.0001',value:String(s.drift_fatigue_perUnit)});
    const dGly=UI.h('input',{class:'input',type:'number',step:'0.0001',value:String(s.drift_glyc_perMin)});
    const on =UI.h('input',{class:'input',type:'number',step:'1',value:String(s.glyc_onset_min)});
    const tau=UI.h('input',{class:'input',type:'number',step:'1',value:String(s.glyc_tau_min)});
    t3.append(R('drift_heat (/°C/min)',dHeat),R('r1 (L/t)',r1),R('r2 (L/t)',r2),R('k',k),R('base (°C)',base),R('temp-slope',slope),R('dehyd-terskel (%)',dth),R('drift_dehyd',dDeh),R('drift_fatigue',dFat),R('drift_glyc',dGly),R('glyc_onset',on),R('glyc_tau',tau));

    // Weights
    const t4=tile('Vekter');
    const wHR=UI.h('input',{class:'input',type:'number',step:'0.1',value:String(s.wHR)});
    const wRPE=UI.h('input',{class:'input',type:'number',step:'0.1',value:String(s.wRPE)});
    t4.append(R('wHR',wHR),R('wRPE',wRPE));

    const tSave=tile('Lagre'); const save=UI.h('button',{class:'btn primary',onclick:()=>{ PI.save({ HRmax:+HRmax.value, HRrest:+HRrest.value, LT1:+LT1.value, LT2:+LT2.value, P_L1:parseFloat(P1.value)||null, P_L2:parseFloat(P2.value)||null, mass:+m.value||75, met_eff:parseFloat(met.value)||0.25, shoe_gain_pct:parseFloat(shoe.value)||0, tm_cal:parseFloat(tm.value)||1, sweat_r1:parseFloat(r1.value)||0.8, sweat_r2:parseFloat(r2.value)||1.6, sweat_k:parseFloat(k.value)||1.5, sweat_base:parseFloat(base.value)||20, sweat_temp_slope:parseFloat(slope.value)||0.03, dehyd_thresh:parseFloat(dth.value)||1.0, drift_heat_perC_perMin:parseFloat(dHeat.value)||0.0005, drift_dehyd_perPct:parseFloat(dDeh.value)||0.02, drift_fatigue_perUnit:parseFloat(dFat.value)||0.001, drift_glyc_perMin:parseFloat(dGly.value)||0.0008, glyc_onset_min:parseFloat(on.value)||45, glyc_tau_min:parseFloat(tau.value)||30, wHR:parseFloat(wHR.value)||2, wRPE:parseFloat(wRPE.value)||1 }); alert('Lagret'); }},'Lagre'); tSave.append(save);

    grid.append(t1,t2,t4,t3,tSave);

    // Live mini
    const live=UI.h('div',{class:'card'}); live.style.gridColumn='1 / -1'; live.append(UI.h('h3',{},'Live & graf')); const inT=UI.h('input',{class:'input',type:'number',value:'20',step:'0.5'}); const inR=UI.h('input',{class:'input',type:'number',value:'6',step:'0.1'}); live.append(UI.h('div',{class:'controls'}, UI.h('label',{},'Temperatur (°C)'), inT, UI.h('label',{style:'margin-left:.5rem'},'RPE'), inR)); const piOut=UI.h('div',{}, UI.h('div',{class:'small'},'PI'), UI.h('div',{class:'h1',id:'piVal'},'–')); const dOut=UI.h('div',{}, UI.h('div',{class:'small'},'ΔHR'), UI.h('div',{class:'h1',id:'dHRVal'},'0')); live.append(UI.h('div',{class:'controls'},piOut,dOut)); const c=document.createElement('canvas'); c.width=1200; c.height=220; c.style.width='100%'; const ctx=c.getContext('2d'); live.append(c);

    const series=[]; const MAX=900; const state={ prevTime:null,tSec:0,hr:0,speedKmh:0,inclinePct:0,tempC:20,rpe:6,cumSweatL:0 };
    function draw(){ const W=c.width,H=c.height; ctx.clearRect(0,0,W,H); ctx.strokeStyle='#b4c4e8'; ctx.strokeRect(40,10,W-60,H-30); const yPI=v=>10+(1-((v-0.85)/(1.15-0.85)))*(H-30); ctx.strokeStyle='#999'; ctx.beginPath(); ctx.moveTo(40,yPI(1)); ctx.lineTo(W-20,yPI(1)); ctx.stroke(); if(series.length<2) return; const t0=series[0].t, t1=series[series.length-1].t||t0+1; ctx.strokeStyle='#0d6efd'; ctx.beginPath(); series.forEach((p,i)=>{ const x=40+((p.t-t0)/(t1-t0))*(W-60); const y=yPI(Math.max(0.85,Math.min(1.15,p.PI||1))); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }); ctx.stroke(); ctx.fillStyle='rgba(217,60,60,.25)'; const yd=v=>10+(1-Math.min(1,v/20))*(H-30); series.forEach(p=>{ const x=40+((p.t-t0)/(t1-t0))*(W-60); const y=yd(p.dHR||0); ctx.fillRect(x-1,y,2,(H-20)-y); }); }
    function tick(){ state.hr=AppState?.hr?.bpm||0; state.speedKmh=AppState?.tm?.speed||0; state.inclinePct=AppState?.tm?.incline||0; state.tempC=parseFloat(inT.value)||20; state.rpe=parseFloat(inR.value)||6; const res=PI.compute(performance.now(),state); const e1=document.getElementById('piVal'); if(e1) e1.textContent=res&&res.PI? res.PI.toFixed(3):'–'; const e2=document.getElementById('dHRVal'); if(e2) e2.textContent=String(Math.round(res.dHR||0)); series.push({ t:Date.now()/1000, PI:res.PI, dHR:res.dHR }); while(series.length>MAX) series.shift(); draw(); }
    const timer=setInterval(tick,1000); el.addEventListener('DOMNodeRemoved',()=>{ try{ clearInterval(timer);}catch(_){} },{once:true});

    el.append(UI.h('h1',{class:'h1'},'PI'), top, grid, live);
  }
};
