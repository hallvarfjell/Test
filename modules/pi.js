const PI = (function(){
  // konfig lagres per profil i 'settings'
  let cfg = null;
  function load(){ cfg = Storage.loadP(AppState.currentProfile,'settings', { hrmax:190, lt1:135, lt2:160, drift:0.003, heatSlope:0.03, mass:75 }); return cfg; }
  function save(nc){ cfg = {...load(), ...nc}; Storage.saveP(AppState.currentProfile,'settings', cfg); return cfg; }
  function percentHRR(hr){ return (hr - 50)/((cfg?.hrmax||190) - 50); } // HRrest enkel antagelse inntil vi legger til felt
  function hrCorrected(hr, tMin){ const d=cfg?.drift||0.003; return hr/(1+d*tMin); }
  function sweatLph(tempC){ const slope = cfg?.heatSlope||0.03; const base = 0.9; return base + Math.max(0, (tempC-20))*slope; }
  function PI_FB(dehydPct){ const gamma=0.15, thresh=0.5; const excess=Math.max(0,dehydPct - thresh); return 1 + gamma*excess*excess; }
  function computeTot(inputs){ load(); const tMin=(inputs.elapsedSec||0)/60; const HRc = hrCorrected(inputs.hr||0, tMin); const pAct = percentHRR(HRc); const p1=(cfg.lt1-50)/((cfg.hrmax||190)-50), p2=(cfg.lt2-50)/((cfg.hrmax||190)-50); const pHRR_exp=(p1+p2)/2; const RPE_exp=5.5; const PI_HR = pAct && pHRR_exp? (pAct/pHRR_exp): null; const PI_RPE = (inputs.rpe? (inputs.rpe/RPE_exp): 1); const Lph=sweatLph(inputs.tempC||20); const dehydPct = 0; const pFB=PI_FB(dehydPct); const wHR=2, wRPE=1, wFB=1; const wSum=wHR+wRPE+wFB; const tot = (PI_HR&&PI_RPE&&pFB) ? Math.pow(Math.pow(PI_HR,wHR)*Math.pow(PI_RPE,wRPE)*Math.pow(pFB,wFB), 1/wSum) : null; return {PI_HR, PI_RPE, pFB, PI_tot:tot, Lph}; }
  function addWater(dl){} // not persisted her
  return { load, save, computeTot, addWater };
})();

const PIMod = { render(el, st){ el.innerHTML=''; const s=PI.load(); const card = UI.h('div',{class:'card'}); card.append(UI.h('h2',{},'PI – Performance Index (innstillinger)'));
  const hrmax = UI.h('input',{class:'input',type:'number',value:String(s.hrmax||190)});
  const lt1 = UI.h('input',{class:'input',type:'number',value:String(s.lt1||135)});
  const lt2 = UI.h('input',{class:'input',type:'number',value:String(s.lt2||160)});
  const drift = UI.h('input',{class:'input',type:'number',step:'0.0001',value:String(s.drift||0.003)});
  const heats = UI.h('input',{class:'input',type:'number',step:'0.01',value:String(s.heatSlope||0.03)});
  const mass = UI.h('input',{class:'input',type:'number',value:String(s.mass||75)});
  function row(lbl, inp){ const r=UI.h('div',{class:'controls'}); r.append(UI.h('label',{style:'min-width:180px'},lbl), inp); return r; }
  const save = UI.h('button',{class:'btn primary',onclick:()=>{ PI.save({ hrmax:parseInt(hrmax.value)||190, lt1:parseInt(lt1.value)||135, lt2:parseInt(lt2.value)||160, drift:parseFloat(drift.value)||0.003, heatSlope:parseFloat(heats.value)||0.03, mass:parseFloat(mass.value)||75 }); alert('Lagret.'); if((location.hash||'').includes('from=workout')) location.hash='#/workout'; }},'Lagre');
  const close = UI.h('button',{class:'btn',onclick:()=>{ if((location.hash||'').includes('from=workout')) location.hash='#/workout'; else location.hash='#/dashboard'; }},'Lukk');
  card.append(row('HRmax', hrmax), row('LT1 (bpm)', lt1), row('LT2 (bpm)', lt2), row('HR-drift /min', drift), row('Svetteslope L/t/°C over 20 °C', heats), row('Vekt (kg)', mass));
  el.append(UI.h('h1',{class:'h1'},'PI'), card, UI.h('div',{class:'controls'}, save, close)); } };
