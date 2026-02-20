
// PI module v1.3.5 (patch for v1.3.2)
// UI/UX: compact tiles, rich help popovers (with defaults + calibration), presets, fix dehyd drift input id
// Model: same as v1.3.4 (heat as physiological HR-drift only)

const PI = (function(){
  let cfg=null; let waterL=0; // L
  function load(){
    cfg = Storage.loadP(AppState.currentProfile, 'settings', {}) || {};
    cfg = Object.assign({
      // physiology
      HRmax:190, HRrest:50, LT1:135, LT2:160,
      RPE_LT1:4, RPE_LT2:7,
      P_L1:null, P_L2:null,
      mass:75,
      // external (no heat multiplier)
      met_eff:0.25, shoe_gain_pct:4, tm_cal:1.00,
      // sweating/dehyd
      sweat_r1:0.8, sweat_r2:1.2, sweat_k:1.5, sweat_base:20, sweat_temp_slope:0.03,
      dehyd_thresh:0.5,
      // HR drift (physiology)
      drift_heat_perC_perMin:0.0005,
      drift_dehyd_perPct:0.02,
      drift_fatigue_perUnit:0.001,
      drift_glyc_perMin:0.0008, glyc_onset_min:45, glyc_tau_min:30,
      // internal weights
      wHR:2, wRPE:1
    }, cfg);
    return cfg;
  }
  function save(nc){ cfg = Object.assign(load(), nc||{}); Storage.saveP(AppState.currentProfile, 'settings', cfg); return cfg; }
  const clamp01 = x=> Math.max(0, Math.min(1,x));
  const pctHRR = (hr, r, m)=> (hr - r)/Math.max(1, (m - r));

  // External demand (W/kg) – no heat multiplier
  function demand_Wkg(speedKmh, gradePct){
    const c = load();
    const v=(speedKmh||0)/3.6, i=(gradePct||0)/100;
    const P_flat  = 4.185*v;
    const P_climb = (9.81*v*i)/(c.met_eff||0.25);
    return (P_flat + P_climb) * (1 - Math.max(0,(c.shoe_gain_pct||0)/100)) * (c.tm_cal||1);
  }
  function expectedFromPower(Pd){
    const c=load();
    if(c.P_L1 && c.P_L2 && c.P_L2>0){
      const IF=Pd/c.P_L2, IF1=c.P_L1/c.P_L2;
      const x = clamp01((IF-IF1)/Math.max(1e-6,(1-IF1)));
      const p1 = pctHRR(c.LT1,c.HRrest,c.HRmax), p2=pctHRR(c.LT2,c.HRrest,c.HRmax);
      return {IF,x,pHRR_exp:p1 + x*(p2-p1), RPE_exp:(c.RPE_LT1||4)+x*((c.RPE_LT2||7)-(c.RPE_LT1||4))};
    } else {
      const p1=pctHRR(c.LT1,c.HRrest,c.HRmax), p2=pctHRR(c.LT2,c.HRrest,c.HRmax);
      return {IF:1,x:null,pHRR_exp:(p1+p2)/2,RPE_exp:(c.RPE_LT1+c.RPE_LT2)/2};
    }
  }
  function sweatRateLph(tempC,x){
    const c=load();
    const base=(c.sweat_r1||0.8)*Math.pow((c.sweat_r2||1.2)/(c.sweat_r1||0.8), Math.pow(clamp01(x||0),(c.sweat_k||1.5)));
    const add =(tempC>(c.sweat_base||20))? (c.sweat_temp_slope||0.03)*(tempC-(c.sweat_base||20)) : 0;
    return base+add;
  }
  function hrDrift(totalMin,tempC,dehydPct,fatigueUnit,glycMin){
    const c=load();
    const dHeat = Math.max(0,(tempC-20)) * (c.drift_heat_perC_perMin||0.0005) * totalMin;
    const dDehy = Math.max(0,(dehydPct-(c.dehyd_thresh||0.5))) * (c.drift_dehyd_perPct||0.02);
    const dFat  = Math.max(0,fatigueUnit) * (c.drift_fatigue_perUnit||0.001);
    const over  = Math.max(0, glycMin-(c.glyc_onset_min||45));
    const dGlyc = (over>0)? (c.drift_glyc_perMin||0.0008) * (1-Math.exp(-over/Math.max(1,(c.glyc_tau_min||30)))) * glycMin : 0;
    const total = dHeat + dDehy + dFat + dGlyc;
    return {total, parts:{heat:dHeat,dehyd:dDehy,fatigue:dFat,glyc:dGlyc}};
  }
  function compute(now, state){
    const speedKmh=state.speedKmh||0, gradePct=state.inclinePct||0, tempC=state.tempC||20;
    const Pd  = demand_Wkg(speedKmh, gradePct);
    const exp = expectedFromPower(Pd);
    const nowMs=now||performance.now(); if(state.prevTime==null) state.prevTime=nowMs; let dt=Math.max(0,(nowMs-state.prevTime)/1000); state.prevTime=nowMs; if(dt>2) dt=1; state.tSec+=dt;
    const Lph=sweatRateLph(tempC, exp.x); state.cumSweatL += Lph*(dt/3600);
    const dehydPct = (state.cumSweatL - waterL)/(load().mass||75)*100;
    const fatigueUnit = (exp.x==null?0.5:exp.x)*(state.tSec/60);
    const drift = hrDrift(state.tSec/60,tempC,dehydPct,fatigueUnit,state.tSec/60);
    const HRobs=state.hr||0, HRnet=HRobs/(1+Math.max(0,drift.total));
    const pAct=pctHRR(HRnet, load().HRrest, load().HRmax);
    const ratioHR  = (exp.pHRR_exp>0)? (pAct/exp.pHRR_exp) : 1;
    const ratioRPE = (exp.RPE_exp>0)? ((state.rpe||6)/exp.RPE_exp) : 1;
    const a=(load().wHR||2), b=(load().wRPE||1); const IR=Math.pow(Math.pow(ratioHR,a)*Math.pow(ratioRPE,b),1/Math.max(1,(a+b)));
    const IF=exp.IF||1; const PI = IF/Math.max(1e-6,IR);
    return {Pd_Wkg:Pd, IF, x:exp.x, pHRR_exp:exp.pHRR_exp, RPE_exp:exp.RPE_exp, HRobs, HRnet, dHR:Math.max(0,HRobs-HRnet), Lph, dehydPct, drift, IR, PI};
  }
  function addWater(dl){ waterL += (dl||0)/10; }
  return { load, save, compute, addWater };
})();

// ---- Rich help texts (defaults + calibration hints) ----
const PI_HELP = {
  HRmax:`Maksimal hjertefrekvens (bpm).\nAnbefalt: bruk høyeste verifiserte HR fra hard økt/konkurranse.\nKalibrering: øk med 1–2 bpm hvis du ofte treffer «100%» uten å være helt på maks.`,
  HRrest:`Hvilepuls (bpm).\nAnbefalt: laveste morgenverdi (7-dagers minimum).\nKalibrering: mål 3–5 morgener, bruk laveste stabile verdi.`,
  LT1:`Aerob terskel (bpm).\nAnbefalt: «snakketempo».\nKalibrering: 30–40 min jevn løp der RPE≈4 og HR stabiliserer seg; bruk gjennomsnitt.`,
  LT2:`Anaerob terskel (bpm).\nKalibrering: 30–40 min hard økt (TT) der RPE≈7, bruk snittpuls siste 20–30 min.`,
  RPE_LT1:`Opplevd intensitet 1–10 ved LT1.\nAnbefalt: 4.\nKalibrering: bruk Borg CR10 ≈ 4 for komfortabelt hardt.`,
  RPE_LT2:`Opplevd intensitet 1–10 ved LT2.\nAnbefalt: 7.\nKalibrering: «kan ikke snakke i hele setninger».`,
  PL1:`W/kg ved LT1 (valgfritt).\nKalibrering: kjør terskeltest på mølle/bane, konverter fart/stigning til W/kg.`,
  PL2:`W/kg ved LT2 (valgfritt).\nAnbefalt: sett dette hvis mulig – PI blir mer presis.`,
  mass:`Kroppsmasse i kg. Bruk konkurransevekt om hensikten er løpsspesifikk PI.`,

  met_eff:`Mekanisk effektivitet for klatring (del av metabolsk energi som blir løftearbeid).\nAnbefalt: 0,25.`,
  shoe_gain_pct:`Prosent lavere energikrav pga karbonsko/økonomi.\nAnbefalt: 0–4%.\nKalibrering: sammenlign snittpuls for samme fart/stigning med/uten sko.`,
  tm_cal:`Kalibrering av tredemølle (×).\nAnbefalt: 1,00.\nKalibrering: måle faktisk hastighet (GPS/optisk sensor) vs mølledisplay.`,

  drift_heat:`HR-drift fra varme. Øker ca lineært med (T−20°C) og tid.\nAnbefalt: 0,0005 /°C/min.\nKalibrering: sammenlign identiske økter 10–12°C vs 22–24°C og estimer ekstra HR.`,
  d_r1:`Svetterate r1 ved x≈0 (L/t). Anbefalt: 0,8.`,
  d_r2:`Svetterate r2 ved x≈1 (L/t). Anbefalt: 1,2–1,8 (individuelt).`,
  d_k:`Form k for intensitetsavhengighet. Anbefalt: 1,5.`,
  d_base:`Temperatur der ekstra svette starter. Anbefalt: 20°C.`,
  d_slope:`Tillegg L/t/°C over baseline. Anbefalt: 0,03.`,
  d_thresh:`Dehydrerings‑terskel (% av kroppsmasse). Anbefalt: 0,5–1,5%.`,
  drift_dehyd:`HR-drift per %-poeng dehydrering over terskel. Anbefalt: 0,02.\nKalibrering: vei før/etter langøkt uten vesentlig væskeinntak og estimer ΔHR.`,
  drift_fatigue:`Drift pr «fatigue‑enhet» (akkum. intensitet). Anbefalt: 0,001.`,
  drift_glyc:`Drift pr minutt etter «glyc onset». Anbefalt: 0,0008.`,
  glyc_onset:`Minutter før glykogeneffekt starter. Anbefalt: 45.`,
  glyc_tau:`Tidskonstant for hvor raskt effekten bygger seg opp. Anbefalt: 30.`,

  wHR:`Vekt på HR forhold (netto HR vs forventet). Anbefalt: 2.`,
  wRPE:`Vekt på RPE forhold. Anbefalt: 1.`
};

function helpLabel(key, short){
  const text = PI_HELP[key]||short; const lbl = UI.h('span',{class:'lbl-help',style:'text-decoration:underline dotted; cursor:pointer; white-space:nowrap;'}, short);
  function show(ev){ const old=document.getElementById('pi-help-pop'); if(old) old.remove(); const box=document.createElement('div'); box.id='pi-help-pop'; box.style.cssText='position:fixed; max-width:420px; padding:10px; border:1px solid #c9d6f0; background:#fff; color:#0b1220; border-radius:8px; box-shadow:0 6px 24px rgba(0,0,0,.12); z-index:1000; font-size:12px; line-height:1.35; white-space:pre-wrap;'; box.textContent=text; document.body.appendChild(box); const r=ev.target.getBoundingClientRect(); box.style.left=Math.min(window.innerWidth-440, Math.max(8, r.left+8))+'px'; box.style.top=(r.bottom+6)+'px'; function hide(){ box.remove(); document.removeEventListener('click', hide);} setTimeout(()=>document.addEventListener('click', hide),0);} lbl.addEventListener('click', show); return lbl; }
function R(labelKey, input){ const r=UI.h('div',{class:'controls'}); r.style.margin='.25rem 0'; r.append(helpLabel(labelKey,labelKey), input); return r; }

const PIMod = { render(el){ el.innerHTML=''; const s=PI.load();
  // Top bar
  const top=UI.h('div',{class:'controls'}); top.style.marginBottom='.5rem'; top.append(UI.h('button',{class:'btn',onclick:()=>{location.hash='#/workout';}},'← Tilbake til økt'));

  // Grid (compact)
  const grid=document.createElement('div'); grid.style.cssText='display:grid; grid-template-columns:repeat(4,minmax(240px,1fr)); gap:.5rem; align-items:start;';
  function tile(title){ const c=UI.h('div',{class:'card'}); c.style.padding='.55rem'; c.append(UI.h('h3',{},title)); return c; }

  // --- FYSIOLOGI ---
  const tPhys=tile('Fysiologi');
  const HRmax=UI.h('input',{class:'input',type:'number',value:String(s.HRmax)});
  const HRrest=UI.h('input',{class:'input',type:'number',value:String(s.HRrest)});
  const LT1=UI.h('input',{class:'input',type:'number',value:String(s.LT1)});
  const LT2=UI.h('input',{class:'input',type:'number',value:String(s.LT2)});
  const RPE1=UI.h('input',{class:'input',type:'number',step:'0.1',value:String(s.RPE_LT1)});
  const RPE2=UI.h('input',{class:'input',type:'number',step:'0.1',value:String(s.RPE_LT2)});
  const PL1=UI.h('input',{class:'input',type:'number',step:'0.01',value:String(s.P_L1??'')});
  const PL2=UI.h('input',{class:'input',type:'number',step:'0.01',value:String(s.P_L2??'')});
  const mass=UI.h('input',{class:'input',type:'number',value:String(s.mass)});
  tPhys.append(R('HRmax',HRmax),R('HRrest',HRrest),R('LT1',LT1),R('LT2',LT2),R('RPE_LT1',RPE1),R('RPE_LT2',RPE2),R('PL1',PL1),R('PL2',PL2),R('mass',mass));

  // --- EKSTERNT ARBEIDSKRAV ---
  const tExt=tile('Eksternt arbeidskrav');
  const met=UI.h('input',{class:'input',type:'number',step:'0.01',value:String(s.met_eff)});
  const shoe=UI.h('input',{class:'input',type:'number',step:'0.1',value:String(s.shoe_gain_pct)});
  const tmcal=UI.h('input',{class:'input',type:'number',step:'0.001',value:String(s.tm_cal)});
  tExt.append(R('met_eff',met),R('shoe_gain_pct',shoe),R('tm_cal',tmcal));

  // --- HRDRIFT: VARME ---
  const tHeat=tile('HRdrift – Varme (ΔHR)');
  const drift_heat=UI.h('input',{class:'input',type:'number',step:'0.0001',value:String(s.drift_heat_perC_perMin)});
  const pHeat=UI.h('div',{class:'small'},'Øker med (T−20°C) og tid.'); pHeat.style.margin='.25rem 0';
  tHeat.append(pHeat,R('drift_heat',drift_heat));

  // --- HRDRIFT: DEHYDRERING ---
  const tDehyd=tile('HRdrift – Dehydrering (ΔHR)');
  const sr1=UI.h('input',{class:'input',type:'number',step:'0.1',value:String(s.sweat_r1)});
  const sr2=UI.h('input',{class:'input',type:'number',step:'0.1',value:String(s.sweat_r2)});
  const sk =UI.h('input',{class:'input',type:'number',step:'0.1',value:String(s.sweat_k)});
  const sbase=UI.h('input',{class:'input',type:'number',step:'0.5',value:String(s.sweat_base)});
  const sslope=UI.h('input',{class:'input',type:'number',step:'0.01',value:String(s.sweat_temp_slope)});
  const dth=UI.h('input',{class:'input',type:'number',step:'0.1',value:String(s.dehyd_thresh)});
  const dDehyd=UI.h('input',{id:'_dDehyd',class:'input',type:'number',step:'0.001',value:String(s.drift_dehyd_perPct)});
  const pDehyd=UI.h('div',{class:'small'},'Svetterate → %dehyd; over terskel gir ΔHR pr %-poeng.'); pDehyd.style.margin='.25rem 0';
  tDehyd.append(pDehyd,R('d_r1',sr1),R('d_r2',sr2),R('d_k',sk),R('d_base',sbase),R('d_slope',sslope),R('d_thresh',dth),R('drift_dehyd',dDehyd));

  // --- HRDRIFT: FATIGUE ---
  const tFat=tile('HRdrift – Fatigue (ΔHR)');
  const dFatK=UI.h('input',{class:'input',type:'number',step:'0.0001',value:String(s.drift_fatigue_perUnit)});
  const pFat=UI.h('div',{class:'small'},'Akkumulert intensitet over tid.'); pFat.style.margin='.25rem 0';
  tFat.append(pFat,R('drift_fatigue',dFatK));

  // --- HRDRIFT: GLYKOGEN ---
  const tGlyc=tile('HRdrift – Glykogen (ΔHR)');
  const dGlycK=UI.h('input',{class:'input',type:'number',step:'0.0001',value:String(s.drift_glyc_perMin)});
  const dOn=UI.h('input',{class:'input',type:'number',step:'1',value:String(s.glyc_onset_min)});
  const dTau=UI.h('input',{class:'input',type:'number',step:'1',value:String(s.glyc_tau_min)});
  const pGlyc=UI.h('div',{class:'small'},'Starter etter «onset» og bygges med tidskonstant.'); pGlyc.style.margin='.25rem 0';
  tGlyc.append(pGlyc,R('drift_glyc',dGlycK),R('glyc_onset',dOn),R('glyc_tau',dTau));

  // --- VEKTER ---
  const tW=tile('Vekter – indre respons');
  const wHR=UI.h('input',{class:'input',type:'number',step:'0.1',value:String(s.wHR)});
  const wRPE=UI.h('input',{class:'input',type:'number',step:'0.1',value:String(s.wRPE)});
  tW.append(R('wHR',wHR),R('wRPE',wRPE));

  // --- PRESETS ---
  const tPresets=tile('Forhåndsinnstillinger');
  function applyPreset(p){
    met.value = p.met; shoe.value=p.shoe; tmcal.value=p.tm; drift_heat.value=p.dHeat;
    sr1.value=p.sr1; sr2.value=p.sr2; sk.value=p.sk; sbase.value=p.sbase; sslope.value=p.sslope; dth.value=p.dth; document.getElementById('_dDehyd').value=p.dDehyd;
    wHR.value=p.wHR; wRPE.value=p.wRPE;
  }
  const presets=[
    {name:'Standard inne',  met:0.25, shoe:2, tm:1.00, dHeat:0.0003, sr1:0.7, sr2:1.2, sk:1.5, sbase:20, sslope:0.02, dth:1.0, dDehyd:0.02, wHR:2, wRPE:1},
    {name:'Varm dag 25°C',  met:0.25, shoe:2, tm:1.00, dHeat:0.0006, sr1:0.8, sr2:1.6, sk:1.5, sbase:20, sslope:0.03, dth:1.0, dDehyd:0.025, wHR:2, wRPE:1},
    {name:'Maraton (sko)', met:0.25, shoe:4, tm:1.00, dHeat:0.0005, sr1:0.8, sr2:1.6, sk:1.5, sbase:20, sslope:0.03, dth:1.0, dDehyd:0.02, wHR:2, wRPE:1}
  ];
  presets.forEach(p=> tPresets.append(UI.h('button',{class:'btn',onclick:()=>applyPreset(p)},p.name)) );

  // --- LAGRE ---
  const tSave=tile('Lagre');
  const saveBtn=UI.h('button',{class:'btn primary',onclick:()=>{
    PI.save({ HRmax:+HRmax.value, HRrest:+HRrest.value, LT1:+LT1.value, LT2:+LT2.value,
      RPE_LT1:+RPE1.value, RPE_LT2:+RPE2.value, P_L1:parseFloat(PL1.value)||null, P_L2:parseFloat(PL2.value)||null, mass:+mass.value||75,
      met_eff:parseFloat(met.value)||0.25, shoe_gain_pct:parseFloat(shoe.value)||0, tm_cal:parseFloat(tmcal.value)||1,
      sweat_r1:parseFloat(sr1.value)||0.8, sweat_r2:parseFloat(sr2.value)||1.2, sweat_k:parseFloat(sk.value)||1.5,
      sweat_base:parseFloat(sbase.value)||20, sweat_temp_slope:parseFloat(sslope.value)||0.03, dehyd_thresh:parseFloat(dth.value)||0.5,
      drift_heat_perC_perMin:parseFloat(drift_heat.value)||0.0005, drift_dehyd_perPct:parseFloat(document.getElementById('_dDehyd').value)||0.02,
      drift_fatigue_perUnit:parseFloat(dFatK.value)||0.001, drift_glyc_perMin:parseFloat(dGlycK.value)||0.0008, glyc_onset_min:parseFloat(dOn.value)||45, glyc_tau_min:parseFloat(dTau.value)||30,
      wHR:parseFloat(wHR.value)||2, wRPE:parseFloat(wRPE.value)||1
    }); alert('Lagret');
  }},'Lagre');
  tSave.append(UI.h('div',{class:'small'},'Lagrer per profil (Hallvar/Monika).'), saveBtn);

  // Compose grid (order reduces «luft»; korte fliser først)
  grid.append(tPhys, tExt, tW, tPresets, tHeat, tDehyd, tFat, tGlyc, tSave);

  // --- LIVE & GRAF (full width) ---
  const live=UI.h('div',{class:'card'}); live.style.gridColumn='1 / -1'; live.style.padding='.55rem';
  live.append(UI.h('h3',{},'Live & graf'));
  const inTemp=UI.h('input',{type:'number',class:'input',value:'20',step:'0.5'});
  const inRPE=UI.h('input',{type:'number',class:'input',value:'6',step:'0.1'});
  const btnWater=UI.h('button',{class:'btn',onclick:()=>PI.addWater(1)},'+0,1 L vann');
  const line=UI.h('div',{class:'controls'}); line.style.margin='.25rem 0';
  line.append(helpLabel('Temperatur (°C)','Temperatur (°C)'), inTemp, helpLabel('RPE','RPE'), inRPE, btnWater);
  const piOut=UI.h('div',{}, UI.h('div',{class:'small'},'PI (ekstern/indre)'), UI.h('div',{class:'h1',id:'piVal'},'–'));
  const dOut=UI.h('div',{}, UI.h('div',{class:'small'},'ΔHR (bpm)'), UI.h('div',{class:'h1',id:'dHRVal'},'0'));
  live.append(line, UI.h('div',{class:'controls'}, piOut, dOut));
  const g=document.createElement('canvas'); g.width=1200; g.height=260; g.style.width='100%'; const ctx=g.getContext('2d'); live.append(g);

  // Graph data & loop
  const series=[]; const MAX=1200; const state={ prevTime:null,tSec:0,hr:0,speedKmh:0,inclinePct:0,tempC:20,rpe:6,cumSweatL:0 };
  function draw(){ const W=g.width,H=g.height; ctx.clearRect(0,0,W,H); ctx.strokeStyle='#b4c4e8'; ctx.strokeRect(40,10,W-60,H-30); const yPI=v=>10+(1-((v-0.85)/(1.15-0.85)))*(H-30);
    ctx.strokeStyle='#999'; ctx.beginPath(); ctx.moveTo(40,yPI(1)); ctx.lineTo(W-20,yPI(1)); ctx.stroke(); if(series.length<2) return; const t0=series[0].t,t1=series[series.length-1].t||t0+1;
    ctx.strokeStyle='#0d6efd'; ctx.lineWidth=2; ctx.beginPath(); series.forEach((p,i)=>{ const x=40+((p.t-t0)/(t1-t0))*(W-60); const y=yPI(Math.max(0.85,Math.min(1.15,p.PI||1))); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }); ctx.stroke();
    const yd=v=>10+(1-Math.min(1,v/20))*(H-30); ctx.fillStyle='rgba(217,60,60,.25)'; series.forEach(p=>{ const x=40+((p.t-t0)/(t1-t0))*(W-60); const y=yd(p.dHR||0); ctx.fillRect(x-1,y,2,(H-20)-y); }); }
  function tick(){ state.hr=AppState?.hr?.bpm||0; state.speedKmh=AppState?.tm?.speed||0; state.inclinePct=AppState?.tm?.incline||0; state.tempC=parseFloat(inTemp.value)||20; state.rpe=parseFloat(inRPE.value)||6; const res=PI.compute(performance.now(),state); const p=document.getElementById('piVal'); if(p) p.textContent=(res.PI?res.PI.toFixed(3):'–'); const d=document.getElementById('dHRVal'); if(d) d.textContent=String(Math.round(res.dHR||0)); series.push({t:Date.now()/1000, PI:res.PI, dHR:res.dHR}); while(series.length>MAX) series.shift(); draw(); }
  const timer=setInterval(tick,1000); el.addEventListener('DOMNodeRemoved',()=>{ try{ clearInterval(timer);}catch(_e){} },{once:true});

  // Mount
  el.append(UI.h('h1',{class:'h1'},'PI'), top, grid, live);
}};
