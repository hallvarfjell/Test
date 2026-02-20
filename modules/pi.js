
// PI module v1.3.4 (patch for v1.3.2)
// Changes vs v1.3.3:
//  • UI tiles grouped in columns (less scrolling): Fysiologi, Eksternt arbeidskrav, HRdrift_(varme/dehydrering/fatigue/glykogen)
//  • Click a label to show a help popover with explanation text
//  • 'Tilbake til økt' button moved to the top
//  • Heat is treated as PHYSIOLOGICAL (HR drift), not a penalty on external demand
//  • Live graph full width at bottom (PI and ΔHR)

const PI = (function(){
  let cfg=null; let waterL=0; // L

  function load(){
    cfg = Storage.loadP(AppState.currentProfile, 'settings', {}) || {};
    // Defaults
    cfg = Object.assign({
      // physiology
      HRmax:190, HRrest:50, LT1:135, LT2:160,
      RPE_LT1:4, RPE_LT2:7,
      P_L1:null, P_L2:null,
      mass:75,
      // external demand (NO heat multiplier here)
      met_eff:0.25, // efficiency for climb term
      shoe_gain_pct:4, // % decrease of cost
      tm_cal:1.00,    // treadmill calibration
      // sweat / dehydration
      sweat_r1:0.8, sweat_r2:1.2, sweat_k:1.5, sweat_base:20, sweat_temp_slope:0.03,
      dehyd_thresh:0.5, // % body mass
      // HR-drift components (physiological)
      drift_heat_perC_perMin:0.0005,
      drift_dehyd_perPct:0.02,
      drift_fatigue_perUnit:0.001,
      drift_glyc_perMin:0.0008, glyc_onset_min:45, glyc_tau_min:30,
      // internal weights
      wHR:2, wRPE:1
    }, cfg);
    // Backward-compat: if older keys exist (heat_beta/T0) we ignore them here.
    return cfg;
  }
  function save(nc){ cfg = Object.assign(load(), nc||{}); Storage.saveP(AppState.currentProfile, 'settings', cfg); return cfg; }

  const clamp01 = x=> Math.max(0, Math.min(1,x));
  const pctHRR = (hr, r, m)=> (hr - r)/Math.max(1, (m - r));

  // EXTERNAL demand (W/kg) WITHOUT heat multiplier
  function demand_Wkg(speedKmh, gradePct){
    const c = load();
    const v = (speedKmh||0)/3.6; // m/s
    const i = (gradePct||0)/100; // fraction
    const P_flat  = 4.185 * v;
    const P_climb = (9.81 * v * i) / (c.met_eff||0.25);
    const shoeMul = 1 - Math.max(0, (c.shoe_gain_pct||0)/100);
    const tmMul   = (c.tm_cal||1.0);
    return (P_flat + P_climb) * shoeMul * tmMul;
  }

  function expectedFromPower(Pd){
    const c = load();
    if(c.P_L1 && c.P_L2 && c.P_L2>0){
      const IF  = Pd / c.P_L2;
      const IF1 = c.P_L1 / c.P_L2;
      const x   = clamp01((IF-IF1)/Math.max(1e-6,(1-IF1)));
      const p1  = pctHRR(c.LT1, c.HRrest, c.HRmax);
      const p2  = pctHRR(c.LT2, c.HRrest, c.HRmax);
      const pHRR_exp = p1 + x*(p2-p1);
      const RPE_exp  = (c.RPE_LT1||4) + x*((c.RPE_LT2||7)-(c.RPE_LT1||4));
      return {IF,x,pHRR_exp,RPE_exp};
    } else {
      const p1=pctHRR(c.LT1,c.HRrest,c.HRmax), p2=pctHRR(c.LT2,c.HRrest,c.HRmax);
      return {IF:1,x:null,pHRR_exp:(p1+p2)/2, RPE_exp:(c.RPE_LT1+c.RPE_LT2)/2};
    }
  }

  function sweatRateLph(tempC,x){
    const c = load();
    const base=(c.sweat_r1||0.8)*Math.pow((c.sweat_r2||1.2)/(c.sweat_r1||0.8), Math.pow(clamp01(x||0),(c.sweat_k||1.5)));
    const add =(tempC>(c.sweat_base||20))? (c.sweat_temp_slope||0.03)*(tempC-(c.sweat_base||20)) : 0;
    return base+add; // L/h
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

    const HRobs = state.hr||0; const HRnet = HRobs/(1+Math.max(0,drift.total));
    const pAct = pctHRR(HRnet, load().HRrest, load().HRmax);
    const ratioHR  = (exp.pHRR_exp>0)? (pAct/exp.pHRR_exp) : 1;
    const ratioRPE = (exp.RPE_exp>0)? ((state.rpe||6)/exp.RPE_exp) : 1;
    const a=(load().wHR||2), b=(load().wRPE||1); const IR = Math.pow(Math.pow(ratioHR,a)*Math.pow(ratioRPE,b),1/Math.max(1,(a+b)));
    const IF=exp.IF||1; const PI = IF/Math.max(1e-6,IR);

    return {Pd_Wkg:Pd, IF, x:exp.x, pHRR_exp:exp.pHRR_exp, RPE_exp:exp.RPE_exp, HRobs, HRnet, dHR:Math.max(0,HRobs-HRnet), Lph, dehydPct, drift, IR, PI};
  }

  function addWater(dl){ waterL += (dl||0)/10; }

  return { load, save, compute, addWater };
})();

// --- UI helpers (tiles, popovers) ---
function helpLabel(text, short){
  const lbl = UI.h('span',{class:'lbl-help',style:'text-decoration:underline dotted; cursor:pointer;'}, short);
  function show(ev){
    const old=document.getElementById('pi-help-pop'); if(old) old.remove();
    const box=document.createElement('div'); box.id='pi-help-pop'; box.style.cssText='position:fixed; max-width:360px; padding:10px; border:1px solid #c9d6f0; background:#fff; color:#0b1220; border-radius:8px; box-shadow:0 6px 24px rgba(0,0,0,.12); z-index:1000; font-size:12px;'; box.textContent=text;
    document.body.appendChild(box);
    const r=ev.target.getBoundingClientRect(); box.style.left=(r.left+8)+'px'; box.style.top=(r.bottom+6)+'px';
    function hide(){ box.remove(); document.removeEventListener('click', hide); }
    setTimeout(()=>document.addEventListener('click', hide),0);
  }
  lbl.addEventListener('click', show);
  return lbl;
}
function rowWithHelp(title, helpText, input){
  const r=UI.h('div',{class:'controls'});
  r.append(helpLabel(helpText,title), input); return r;
}

const PIMod = {
  render(el, st){
    el.innerHTML=''; const s=PI.load();

    // TOP BAR
    const topBar = UI.h('div',{class:'controls'});
    topBar.append(UI.h('button',{class:'btn',onclick:()=>{ location.hash='#/workout'; }},'← Tilbake til økt'));

    // GRID of tiles (3 columns on wide screens)
    const grid = document.createElement('div');
    grid.style.cssText='display:grid; grid-template-columns:repeat(3,minmax(280px,1fr)); gap:.75rem; align-items:start;';

    // --- Tiles ---
    // 1) Fysiologi
    const phys = UI.h('div',{class:'card'});
    phys.append(UI.h('h3',{},'Fysiologi'));
    const HRmax = UI.h('input',{class:'input',type:'number',value:String(s.HRmax)});
    const HRrest= UI.h('input',{class:'input',type:'number',value:String(s.HRrest)});
    const LT1   = UI.h('input',{class:'input',type:'number',value:String(s.LT1)});
    const LT2   = UI.h('input',{class:'input',type:'number',value:String(s.LT2)});
    const RPE1  = UI.h('input',{class:'input',type:'number',step:'0.1',value:String(s.RPE_LT1)});
    const RPE2  = UI.h('input',{class:'input',type:'number',step:'0.1',value:String(s.RPE_LT2)});
    const PL1   = UI.h('input',{class:'input',type:'number',step:'0.01',value:String(s.P_L1??'')});
    const PL2   = UI.h('input',{class:'input',type:'number',step:'0.01',value:String(s.P_L2??'')});
    const mass  = UI.h('input',{class:'input',type:'number',value:String(s.mass)});
    phys.append(
      rowWithHelp('HRmax','Maksimal hjertefrekvens (bpm).',HRmax),
      rowWithHelp('HRrest','Hvilepuls (bpm). Bruk målt morgentidlig om mulig.',HRrest),
      rowWithHelp('LT1','Aerob terskel (bpm) – typisk «snakkegrense».',LT1),
      rowWithHelp('LT2','Anaerob terskel (bpm).',LT2),
      rowWithHelp('RPE@LT1','Opplevd intensitet (1–10) ved LT1.',RPE1),
      rowWithHelp('RPE@LT2','Opplevd intensitet (1–10) ved LT2.',RPE2),
      rowWithHelp('P_LT1 (W/kg)','Om du har kalibrert W/kg ved LT1.',PL1),
      rowWithHelp('P_LT2 (W/kg)','Om du har kalibrert W/kg ved LT2. Gir bedre PI.',PL2),
      rowWithHelp('Masse (kg)','Kroppsmasse brukt for å regne om W/kg til W.',mass)
    );

    // 2) Eksternt arbeidskrav (uten varme)
    const ext = UI.h('div',{class:'card'});
    ext.append(UI.h('h3',{},'Eksternt arbeidskrav'));
    const met   = UI.h('input',{class:'input',type:'number',step:'0.01',value:String(s.met_eff)});
    const shoe  = UI.h('input',{class:'input',type:'number',step:'0.1',value:String(s.shoe_gain_pct)});
    const tmcal = UI.h('input',{class:'input',type:'number',step:'0.001',value:String(s.tm_cal)});
    ext.append(
      rowWithHelp('Met‑effektivitet','Mekanisk effektivitet i klatreleddet. Standard ≈0,25.',met),
      rowWithHelp('Karbonsko gevinst (%)','Prosent lavere energikrav pga sko (økonomigevinst).',shoe),
      rowWithHelp('Møllekalibrering (×)','Kalibreringsfaktor for «snille/gjerrige» møller.',tmcal)
    );

    // 3) HR‑drift: Varme (ΔHR)
    const dHeat = UI.h('div',{class:'card'});
    dHeat.append(UI.h('h3',{},'HRdrift – Varme (ΔHR)'));
    const drift_heat = UI.h('input',{class:'input',type:'number',step:'0.0001',value:String(s.drift_heat_perC_perMin)});
    dHeat.append(
      UI.h('div',{class:'small'},'Drift fra varme modelleres som økning per °C over ~20°C, proporsjonal med tid.'),
      rowWithHelp('drift_heat (/°C/min)','Økning i HR per grad og per minutt (multiplikativ).',drift_heat)
    );

    // 4) HR‑drift: Dehydrering (ΔHR)
    const dDehyd = UI.h('div',{class:'card'});
    dDehyd.append(UI.h('h3',{},'HRdrift – Dehydrering (ΔHR)'));
    const sr1 = UI.h('input',{class:'input',type:'number',step:'0.1',value:String(s.sweat_r1)});
    const sr2 = UI.h('input',{class:'input',type:'number',step:'0.1',value:String(s.sweat_r2)});
    const sk  = UI.h('input',{class:'input',type:'number',step:'0.1',value:String(s.sweat_k)});
    const sbase=UI.h('input',{class:'input',type:'number',step:'0.5',value:String(s.sweat_base)});
    const sslope=UI.h('input',{class:'input',type:'number',step:'0.01',value:String(s.sweat_temp_slope)});
    const dth = UI.h('input',{class:'input',type:'number',step:'0.1',value:String(s.dehyd_thresh)});
    dDehyd.append(
      UI.h('div',{class:'small'},'Svetterate L/t avhenger av intensitet (x) og temperatur. Dehydrering over terskel gir ΔHR.'),
      rowWithHelp('r1 (20°C)','Basal svetterate ved x≈0.',sr1),
      rowWithHelp('r2 (20°C)','Svetterate ved x≈1 (formet av k).',sr2),
      rowWithHelp('form k','Formparameter for intensitetsavhengighet.',sk),
      rowWithHelp('baseline (°C)','Temperatur der tilleggs‑svette starter.',sbase),
      rowWithHelp('temp‑slope (L/t/°C)','Tillegg pr °C over baseline.',sslope),
      rowWithHelp('Dehyd‑terskel (%)','% kroppsmasse væsketap før HR øker tydelig.',dth)
    );

    // 5) HR‑drift: Fatigue (ΔHR)
    const dFat = UI.h('div',{class:'card'});
    dFat.append(UI.h('h3',{},'HRdrift – Fatigue (ΔHR)'));
    const dFatK = UI.h('input',{class:'input',type:'number',step:'0.0001',value:String(s.drift_fatigue_perUnit)});
    dFat.append(
      UI.h('div',{class:'small'},'Øker med akkumulert intensitet over tid (enkelt proxy).'),
      rowWithHelp('drift_fatigue','Faktor pr «fatigue‑enhet».',dFatK)
    );

    // 6) HR‑drift: Glykogen (ΔHR)
    const dGlyc = UI.h('div',{class:'card'});
    dGlyc.append(UI.h('h3',{},'HRdrift – Glykogen (ΔHR)'));
    const dGlycK = UI.h('input',{class:'input',type:'number',step:'0.0001',value:String(s.drift_glyc_perMin)});
    const dOn    = UI.h('input',{class:'input',type:'number',step:'1',value:String(s.glyc_onset_min)});
    const dTau   = UI.h('input',{class:'input',type:'number',step:'1',value:String(s.glyc_tau_min)});
    dGlyc.append(
      UI.h('div',{class:'small'},'Starter etter «onset» og vokser med tidskonstant (tau).'),
      rowWithHelp('drift_glyc (/min)','Driftstyrke per minutt etter onset.',dGlycK),
      rowWithHelp('onset (min)','Minutter før glykogeneffekt starter.',dOn),
      rowWithHelp('tau (min)','Hvor raskt effekten «slår inn».',dTau)
    );

    // 7) Vekter (indre respons)
    const weights = UI.h('div',{class:'card'});
    weights.append(UI.h('h3',{},'Vekter – indre respons'));
    const wHR = UI.h('input',{class:'input',type:'number',step:'0.1',value:String(s.wHR)});
    const wRPE= UI.h('input',{class:'input',type:'number',step:'0.1',value:String(s.wRPE)});
    weights.append(
      rowWithHelp('wHR','Vekt på HR‑avvik (netto HR / forventet).',wHR),
      rowWithHelp('wRPE','Vekt på RPE‑avvik.',wRPE)
    );

    // SAVE tile
    const actions = UI.h('div',{class:'card'});
    const saveBtn = UI.h('button',{class:'btn primary',onclick:()=>{
      PI.save({ HRmax:+HRmax.value, HRrest:+HRrest.value, LT1:+LT1.value, LT2:+LT2.value,
        RPE_LT1:+RPE1.value, RPE_LT2:+RPE2.value, P_L1:parseFloat(PL1.value)||null, P_L2:parseFloat(PL2.value)||null, mass:+mass.value||75,
        met_eff:parseFloat(met.value)||0.25, shoe_gain_pct:parseFloat(shoe.value)||0, tm_cal:parseFloat(tmcal.value)||1,
        sweat_r1:parseFloat(sr1.value)||0.8, sweat_r2:parseFloat(sr2.value)||1.2, sweat_k:parseFloat(sk.value)||1.5,
        sweat_base:parseFloat(sbase.value)||20, sweat_temp_slope:parseFloat(sslope.value)||0.03, dehyd_thresh:parseFloat(dth.value)||0.5,
        drift_heat_perC_perMin:parseFloat(drift_heat.value)||0.0005, drift_dehyd_perPct:parseFloat((document.querySelector('#_dDehyd')?.value)||s.drift_dehyd_perPct)||0.02,
        drift_fatigue_perUnit:parseFloat(dFatK.value)||0.001, drift_glyc_perMin:parseFloat(dGlycK.value)||0.0008, glyc_onset_min:parseFloat(dOn.value)||45, glyc_tau_min:parseFloat(dTau.value)||30,
        wHR:parseFloat(wHR.value)||2, wRPE:parseFloat(wRPE.value)||1
      });
      alert('Lagret');
    }},'Lagre');
    actions.append(UI.h('div',{class:'small'},'Lagrer per profil (Hallvar/Monika).'), saveBtn);

    // Append tiles to grid
    grid.append(phys, ext, weights, dHeat, dDehyd, dFat, dGlyc, actions);

    // LIVE + GRAPH (full width)
    const live = UI.h('div',{class:'card'});
    live.style.gridColumn='1 / -1';
    live.append(UI.h('h3',{},'Live & graf'));
    const inTemp = UI.h('input',{type:'number',class:'input',value:'20',step:'0.5'});
    const inRPE  = UI.h('input',{type:'number',class:'input',value:'6',step:'0.1'});
    const btnWater = UI.h('button',{class:'btn',onclick:()=>PI.addWater(1)},'+0,1 L vann');
    const line1=UI.h('div',{class:'controls'}, helpLabel('Omgivelsestemperatur. Påvirker svette og varme‑drift.','Temperatur (°C)'), inTemp, helpLabel('Opplevd intensitet 1–10. Inngår i indre respons.','RPE'), inRPE, btnWater);
    const piOut = UI.h('div',{}, UI.h('div',{class:'small'},'PI (ekstern/indre)'), UI.h('div',{class:'h1',id:'piVal'},'–'));
    const dOut  = UI.h('div',{}, UI.h('div',{class:'small'},'ΔHR (bpm)'), UI.h('div',{class:'h1',id:'dHRVal'},'0'));
    live.append(line1, UI.h('div',{class:'controls'}, piOut, dOut));

    const g = document.createElement('canvas'); g.width=1200; g.height=280; g.style.width='100%'; const ctx=g.getContext('2d');
    live.append(g);

    // Graph data & compute loop
    const series=[]; const MAX=1200; const state={ prevTime:null,tSec:0,hr:0,speedKmh:0,inclinePct:0,tempC:20,rpe:6,cumSweatL:0 };
    function draw(){ const W=g.width,H=g.height; ctx.clearRect(0,0,W,H); ctx.strokeStyle='#b4c4e8'; ctx.strokeRect(40,10,W-60,H-30); const yPI=v=>10+(1-((v-0.85)/(1.15-0.85)))*(H-30);
      ctx.strokeStyle='#999'; ctx.beginPath(); ctx.moveTo(40,yPI(1)); ctx.lineTo(W-20,yPI(1)); ctx.stroke(); if(series.length<2) return; const t0=series[0].t, t1=series[series.length-1].t||t0+1;
      ctx.strokeStyle='#0d6efd'; ctx.lineWidth=2; ctx.beginPath(); series.forEach((p,i)=>{ const x=40+((p.t-t0)/(t1-t0))*(W-60); const y=yPI(Math.max(0.85,Math.min(1.15,p.PI||1))); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }); ctx.stroke();
      const yd=v=>10+(1-Math.min(1,v/20))*(H-30); ctx.fillStyle='rgba(217,60,60,.25)'; series.forEach(p=>{ const x=40+((p.t-t0)/(t1-t0))*(W-60); const y=yd(p.dHR||0); ctx.fillRect(x-1,y,2,(H-20)-y); }); }
    function tick(){ state.hr=AppState?.hr?.bpm||0; state.speedKmh=AppState?.tm?.speed||0; state.inclinePct=AppState?.tm?.incline||0; state.tempC=parseFloat(inTemp.value)||20; state.rpe=parseFloat(inRPE.value)||6; const res=PI.compute(performance.now(),state); const p=document.getElementById('piVal'); if(p) p.textContent=(res.PI?res.PI.toFixed(3):'–'); const d=document.getElementById('dHRVal'); if(d) d.textContent=String(Math.round(res.dHR||0)); series.push({t:Date.now()/1000, PI:res.PI, dHR:res.dHR}); while(series.length>MAX) series.shift(); draw(); }
    const timer=setInterval(tick,1000); el.addEventListener('DOMNodeRemoved',()=>{ try{ clearInterval(timer);}catch(_e){} },{once:true});

    // mount
    el.append(UI.h('h1',{class:'h1'},'PI'), topBar, grid, live);
  }
};
