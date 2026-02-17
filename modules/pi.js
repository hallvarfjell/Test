// PI-modul – iterasjon v0.2
const PI = (function(){
  const cfg = { HRmax:190, HRrest:50, LT1:135, LT2:160, RPE_LT1:4, RPE_LT2:7, drift:0.003, beta:0.012, T0:12, met_eff:0.25, sweat_temp_slope:0.03, sweat_baseC:20, dehyd_thresh:0.5, dehyd_gamma:0.15, wHR:2, wRPE:1, wFB:1, mass:75 };
  let cumWaterL=0;
  function setFromSettings(s){ if(!s) return; cfg.HRmax=s.hrmax||cfg.HRmax; cfg.LT1=s.lt1||cfg.LT1; cfg.LT2=s.lt2||cfg.LT2; }
  function percentHRR(hr){ return (hr - cfg.HRrest)/(cfg.HRmax - cfg.HRrest); }
  function hrCorrected(hr, tMin){ return hr/(1+cfg.drift*tMin); }
  function expectedScalars(){ const p1=percentHRR(cfg.LT1), p2=percentHRR(cfg.LT2); return { pHRR_exp:(p1+p2)/2, RPE_exp:(cfg.RPE_LT1+cfg.RPE_LT2)/2 } }
  function sweatLph(tempC){ const add = tempC>cfg.sweat_baseC ? cfg.sweat_temp_slope*(tempC-cfg.sweat_baseC) : 0; return 0.9 + add; }
  function dehydPct(cSweat){ return 100*((cSweat - cumWaterL)/cfg.mass); }
  function PI_FB(dPct){ const excess=Math.max(0, dPct-cfg.dehyd_thresh); return 1 + cfg.dehyd_gamma*Math.pow(excess,2); }
  function computeTot(inputs){ setFromSettings(inputs.settings); const tMin=(inputs.elapsedSec||0)/60; const HRc = hrCorrected(inputs.hr||0, tMin); const pAct = percentHRR(HRc); const {pHRR_exp, RPE_exp} = expectedScalars(); const PI_HR = pHRR_exp? (pAct/pHRR_exp): null; const PI_RPE = RPE_exp? ((inputs.rpe||6)/RPE_exp): null; const Lph=sweatLph(inputs.tempC||20); const dPct=dehydPct(inputs.cumSweatL||0); const pFB=PI_FB(dPct); const wSum=cfg.wHR+cfg.wRPE+cfg.wFB; const tot = (PI_HR&&PI_RPE&&pFB) ? Math.pow(Math.pow(PI_HR,cfg.wHR)*Math.pow(PI_RPE,cfg.wRPE)*Math.pow(pFB,cfg.wFB), 1/wSum) : null; return {PI_HR, PI_RPE, pFB, PI_tot:tot, Lph}; }
  function addWater(dl){ cumWaterL += (dl||0)/10; return cumWaterL; }
  return { computeTot, addWater };
})();

const PIMod = { render(el, st){ el.innerHTML=''; const card = UI.h('div',{class:'card'}); card.append(UI.h('h2',{},'PI – Performance Index'));
 card.append(UI.h('p',{}, 'PI-total beregnes her og brukes i Økt. Vi kan flytte alle parametre hit og fjerne Innstillinger senere.'));
 el.append(UI.h('h1',{class:'h1'},'PI'), card); } };
