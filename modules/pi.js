// Full PI modul med demo-parametre + PI-graf
const PI = (function(){
  let cfg = null; let waterL=0; // enkel akkumulator
  function load(){ cfg = Storage.loadP(AppState.currentProfile,'settings', {
    HRmax:190, HRrest:50, LT1:135, LT2:160, RPE_LT1:4, RPE_LT2:7,
    P_L1:null, P_L2:null, drift:0.003, beta:0.012, T0:12, met_eff:0.25,
    sweat_r1:0.8, sweat_r2:1.2, sweat_k:1.5, sweat_temp_slope:0.03, sweat_base:20,
    dehyd_thresh:0.5, dehyd_gamma:0.15, wHR:2, wRPE:1, wFB:1, mass:75
  }); return cfg; }
  function save(nc){ cfg = {...load(), ...nc}; Storage.saveP(AppState.currentProfile,'settings', cfg); return cfg; }
  function clamp01(x){ return Math.max(0, Math.min(1,x)); }
  function percentHRR(hr){ return (hr - (cfg.HRrest||50))/((cfg.HRmax||190) - (cfg.HRrest||50)); }
  function demand(speedKmh, gradePct, tempC){ const v=speedKmh/3.6; const i=gradePct/100; const P_flat=4.185*v; const P_climb=(9.81*v*i)/(cfg.met_eff||0.25); const dT=Math.max(0,(tempC||20)-(cfg.T0||12)); return (P_flat+P_climb)*(1+(cfg.beta||0.012)*dT); } // W/kg
  function hrCorrected(hr, tMin){ return hr/(1+(cfg.drift||0.003)*tMin); }
  function expectedScalars(Pd){ const P1 = cfg.P_L1, P2=cfg.P_L2; if(!P1||!P2){ const p1=percentHRR(cfg.LT1), p2=percentHRR(cfg.LT2); return { x:null, IF:null, pHRR_exp:(p1+p2)/2, RPE_exp:(cfg.RPE_LT1+cfg.RPE_LT2)/2 }; } const IF = Pd/P2; const IF1=P1/P2; const x = clamp01((IF-IF1)/(1-IF1)); const p1=percentHRR(cfg.LT1), p2=percentHRR(cfg.LT2); const pHRR_exp=p1 + x*(p2-p1); const RPE_exp = cfg.RPE_LT1 + x*(cfg.RPE_LT2 - cfg.RPE_LT1); return { x, IF, pHRR_exp, RPE_exp } }
  function sweatLph(tempC, x){ const r1=cfg.sweat_r1, r2=cfg.sweat_r2, k=cfg.sweat_k; const base = r1*Math.pow(r2/r1, Math.pow(clamp01(x||0), k)); const add = (tempC>(cfg.sweat_base||20))? (cfg.sweat_temp_slope||0.03)*(tempC-(cfg.sweat_base||20)) : 0; return base+add; }
  function dehydrationPct(cumSweatL){ return 100*((cumSweatL - waterL)/(cfg.mass||75)); }
  function PI_FB(dehydPct){ const excess=Math.max(0, dehydPct-(cfg.dehyd_thresh||0.5)); return 1 + (cfg.dehyd_gamma||0.15)*Math.pow(excess,2); }
  function computeTot(inputs){ load(); const tMin=(inputs.elapsedSec||0)/60; const Pd = demand(inputs.speedKmh||0, inputs.inclinePct||0, inputs.tempC||20); const HRc=hrCorrected(inputs.hr||0, tMin); const pAct=percentHRR(HRc); const exp=expectedScalars(Pd); const PI_HR = exp.pHRR_exp? (pAct/exp.pHRR_exp):null; const PI_RPE = exp.RPE_exp? ((inputs.rpe||6)/exp.RPE_exp):null; const Lph = sweatLph(inputs.tempC||20, exp.x); const dehyd=dehydrationPct(inputs.cumSweatL||0); const pFB=PI_FB(dehyd); const wSum=(cfg.wHR||2)+(cfg.wRPE||1)+(cfg.wFB||1); const tot = (PI_HR&&PI_RPE&&pFB)? Math.pow(Math.pow(PI_HR,(cfg.wHR||2))*Math.pow(PI_RPE,(cfg.wRPE||1))*Math.pow(pFB,(cfg.wFB||1)),1/wSum):null; return { Pd_Wkg:Pd, PI_HR, PI_RPE, pFB, PI_tot:tot, Lph, x:exp.x, pHRR_exp:exp.pHRR_exp, RPE_exp:exp.RPE_exp }; }
  function addWater(dl){ waterL += (dl||0)/10; }
  return { load, save, computeTot, addWater };
})();

const PIMod = { render(el, st){ el.innerHTML=''; const s=PI.load(); const wrap = UI.h('div',{class:'card'}); wrap.append(UI.h('h2',{},'PI – Performance Index (innstillinger + graf)'));
  function row(lbl, inp){ const r=UI.h('div',{class:'controls'}); r.append(UI.h('label',{style:'min-width:220px'},lbl), inp); return r; }
  const i = (id,val,attrs={})=>{ const o=Object.assign({class:'input',type:'number',value:String(val??'')},attrs); return UI.h('input',o); };
  const HRmax=i('HRmax',s.HRmax); const HRrest=i('HRrest',s.HRrest); const LT1=i('LT1',s.LT1); const LT2=i('LT2',s.LT2);
  const RPE1=i('RPE_LT1',s.RPE_LT1); const RPE2=i('RPE_LT2',s.RPE_LT2);
  const PL1=i('P_L1',s.P_L1,{step:'0.01',placeholder:'W/kg'}); const PL2=i('P_L2',s.P_L2,{step:'0.01',placeholder:'W/kg'});
  const drift=i('drift',s.drift,{step:'0.0001'}); const beta=i('beta',s.beta,{step:'0.001'}); const T0=i('T0',s.T0,{step:'0.5'}); const met=i('met_eff',s.met_eff,{step:'0.01'});
  const r1=i('sweat_r1',s.sweat_r1,{step:'0.1'}); const r2=i('sweat_r2',s.sweat_r2,{step:'0.1'}); const sk=i('sweat_k',s.sweat_k,{step:'0.1'});
  const slope=i('sweat_temp_slope',s.sweat_temp_slope,{step:'0.01'}); const base=i('sweat_base',s.sweat_base,{step:'0.5'});
  const dth=i('dehyd_thresh',s.dehyd_thresh,{step:'0.1'}); const dga=i('dehyd_gamma',s.dehyd_gamma,{step:'0.01'});
  const wHR=i('wHR',s.wHR); const wRPE=i('wRPE',s.wRPE); const wFB=i('wFB',s.wFB);
  const mass=i('mass',s.mass);
  const saveBtn = UI.h('button',{class:'btn primary',onclick:()=>{ PI.save({ HRmax:+HRmax.value, HRrest:+HRrest.value, LT1:+LT1.value, LT2:+LT2.value, RPE_LT1:+RPE1.value, RPE_LT2:+RPE2.value, P_L1:parseFloat(PL1.value)||null, P_L2:parseFloat(PL2.value)||null, drift:parseFloat(drift.value)||0.003, beta:parseFloat(beta.value)||0.012, T0:parseFloat(T0.value)||12, met_eff:parseFloat(met.value)||0.25, sweat_r1:parseFloat(r1.value)||0.8, sweat_r2:parseFloat(r2.value)||1.2, sweat_k:parseFloat(sk.value)||1.5, sweat_temp_slope:parseFloat(slope.value)||0.03, sweat_base:parseFloat(base.value)||20, dehyd_thresh:parseFloat(dth.value)||0.5, dehyd_gamma:parseFloat(dga.value)||0.15, wHR:+wHR.value||2, wRPE:+wRPE.value||1, wFB:+wFB.value||1, mass:+mass.value||75 }); alert('Lagret.'); if((location.hash||'').includes('from=workout')) location.hash='#/workout'; }},'Lagre');
  const closeBtn = UI.h('button',{class:'btn',onclick:()=>{ if((location.hash||'').includes('from=workout')) location.hash='#/workout'; else location.hash='#/dashboard'; }},'Lukk');
  wrap.append(
    row('HRmax',HRmax), row('HRrest',HRrest), row('LT1 (bpm)',LT1), row('LT2 (bpm)',LT2), row('RPE@LT1',RPE1), row('RPE@LT2',RPE2),
    row('P_LT1 (W/kg)',PL1), row('P_LT2 (W/kg)',PL2), row('HR-drift δ (/min)',drift), row('Heat β (/°C)',beta), row('T0 demand (°C)',T0), row('Met-effektivitet',met),
    row('Svetterate r1 (20°C)',r1), row('Svetterate r2 (20°C)',r2), row('Svetterate form k',sk), row('Temp‑slope L/t/°C',slope), row('Svetting baseline (°C)',base),
    row('Dehyd‑terskel (%)',dth), row('Dehyd‑gamma',dga), row('Vekter wHR/wRPE/wFB',UI.h('span',{},'')), row('wHR',wHR), row('wRPE',wRPE), row('wFB',wFB), row('Masse (kg)',mass)
  );

  // PI‑graf nederst til høyre
  const gCard = UI.h('div',{class:'card'}); gCard.append(UI.h('h3',{},'PI over tid (nøytral = 1)'));
  const c=document.createElement('canvas'); c.width=900; c.height=220; const ctx=c.getContext('2d'); gCard.append(c);
  let points=[]; const MAX_SEC=600; function draw(){ const W=c.width,H=c.height; ctx.clearRect(0,0,W,H); const yMid=H/2; // baseline 1.0
    ctx.strokeStyle='#b4c4e8'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(40,yMid); ctx.lineTo(W-10,yMid); ctx.stroke();
    if(points.length<2){ ctx.strokeStyle='#999'; ctx.strokeRect(40,10,W-50,H-30); return; }
    const t0=points[0].t, t1=points[points.length-1].t||t0+1; const ymin=0.85, ymax=1.15; ctx.strokeStyle='#0d6efd'; ctx.lineWidth=2; ctx.beginPath(); points.forEach((p,i)=>{ const x=40 + ( (p.t-t0)/(t1-t0) )*(W-60); const y=10 + (1-( (p.v - ymin)/(ymax - ymin) ))*(H-30); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }); ctx.stroke(); ctx.strokeStyle='#b4c4e8'; ctx.strokeRect(40,10,W-50,H-30); }
  let timer = setInterval(()=>{ const res = PI.computeTot({ hr:AppState.hr.bpm||0, speedKmh:AppState.tm.speed||0, inclinePct:AppState.tm.incline||0, tempC:20, elapsedSec:points.length? (points[points.length-1].t - points[0].t):0, settings:AppState.settings, cumSweatL:0 }); const t=Date.now()/1000; const v=(res.PI_tot||1); points.push({t,v}); while(points.length>MAX_SEC) points.shift(); draw(); }, 1000);
  el.addEventListener('DOMNodeRemoved', ()=>{ try{ clearInterval(timer); }catch(e){} }, {once:true});

  el.append(UI.h('h1',{class:'h1'},'PI'), wrap, gCard, UI.h('div',{class:'controls'}, saveBtn, closeBtn)); } };
