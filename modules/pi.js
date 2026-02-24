
// PI module v1.3.9
// - Removes big 'PI' heading
// - Adds HR zones under Fysiologi (defaults as requested)
// - Save button at top
// - Restores rich help popovers
// - Live graph uses the SAME runtime state as Workout (PI.computeLive), so no mismatch/flicker

const PI = (function(){
  let cfg=null; let waterL=0; // L consumed (0.1 L per addWater(1))
  // shared runtime state kept across modules
  const runtime = { prevTime:null, tSec:0, cumSweatL:0 };

  function load(){
    cfg = Storage.loadP(AppState.currentProfile,'settings',{}) || {};
    cfg = Object.assign({
      // physiology
      HRmax:190, HRrest:50, LT1:135, LT2:160,
      RPE_LT1:4, RPE_LT2:7,
      P_L1:null, P_L2:null,
      mass:75,
      // zones (fra/til som fraksjon av HRmax)
      zones:[
        {name:'S0', from:0.50, to:0.60, color:'#e9ecef'},
        {name:'S1', from:0.60, to:0.725, color:'#d6ecff'},
        {name:'S2', from:0.725,to:0.825, color:'#d9f5d6'},
        {name:'S3', from:0.825,to:0.875, color:'#fff2b3'},
        {name:'S4', from:0.875,to:0.925, color:'#ffe0b8'},
        {name:'S5', from:0.925,to:1.000, color:'#ffd1d1'}
      ],
      // external (no heat multiplier)
      met_eff:0.25, shoe_gain_pct:4, tm_cal:1.00,
      // sweating & dehyd
      sweat_r1:0.8, sweat_r2:1.6, sweat_k:1.5, sweat_base:20, sweat_temp_slope:0.03, dehyd_thresh:1.0,
      // HR drift parts
      drift_heat_perC_perMin:0.0005, drift_dehyd_perPct:0.02, drift_fatigue_perUnit:0.001,
      drift_glyc_perMin:0.0008, glyc_onset_min:45, glyc_tau_min:30,
      // IR weights
      wHR:2, wRPE:1
    }, cfg);
    return cfg;
  }
  function save(nc){ cfg = Object.assign(load(), nc||{}); Storage.saveP(AppState.currentProfile,'settings', cfg); return cfg; }

  const clamp01 = x=> Math.max(0, Math.min(1,x));
  const pctHRR = (hr, r, m)=> (hr - r)/Math.max(1, (m - r));

  // demand (W/kg) from speed/stigning using same model as Workout
  function demand_Wkg(speedKmh, gradePct){
    const c = load();
    const v=(speedKmh||0)/3.6, i=(gradePct||0)/100;
    const P_flat  = 4.185 * v;
    const P_climb = (9.81 * v * i) / (c.met_eff||0.25);
    const shoeMul = 1 - Math.max(0, (c.shoe_gain_pct||0)/100);
    const tmMul   = (c.tm_cal||1.0);
    return (P_flat + P_climb) * shoeMul * tmMul;
  }

  function expectedFromPower(Pd){
    const c=load();
    if(c.P_L1 && c.P_L2 && c.P_L2>0){
      const IF=Pd/c.P_L2, IF1=c.P_L1/c.P_L2; const x = clamp01((IF-IF1)/Math.max(1e-6,(1-IF1)));
      const p1=pctHRR(c.LT1,c.HRrest,c.HRmax), p2=pctHRR(c.LT2,c.HRrest,c.HRmax);
      return {IF,x,pHRR_exp:p1 + x*(p2-p1), RPE_exp:(c.RPE_LT1||4)+x*((c.RPE_LT2||7)-(c.RPE_LT1||4))};
    } else {
      const p1=pctHRR(c.LT1,c.HRrest,c.HRmax), p2=pctHRR(c.LT2,c.HRrest,c.HRmax);
      return {IF:1,x:null,pHRR_exp:(p1+p2)/2, RPE_exp:(c.RPE_LT1+c.RPE_LT2)/2};
    }
  }

  function sweatRateLph(tempC,x){
    const c=load();
    const base=(c.sweat_r1||0.8)*Math.pow((c.sweat_r2||1.6)/(c.sweat_r1||0.8), Math.pow(clamp01(x||0),(c.sweat_k||1.5)));
    const add =(tempC>(c.sweat_base||20))? (c.sweat_temp_slope||0.03)*(tempC-(c.sweat_base||20)) : 0;
    return base+add; // L/h
  }

  function hrDrift(totalMin,tempC,dehydPct,fatigueUnit,glycMin){
    const c=load();
    const dHeat = Math.max(0,(tempC-20)) * (c.drift_heat_perC_perMin||0.0005) * totalMin;
    const dDehy = Math.max(0,(dehydPct-(c.dehyd_thresh||1.0))) * (c.drift_dehyd_perPct||0.02);
    const dFat  = Math.max(0,fatigueUnit) * (c.drift_fatigue_perUnit||0.001);
    const over  = Math.max(0, glycMin-(c.glyc_onset_min||45));
    const dGlyc = (over>0)? (c.drift_glyc_perMin||0.0008) * (1-Math.exp(-over/Math.max(1,(c.glyc_tau_min||30)))) * glycMin : 0;
    const total = dHeat + dDehy + dFat + dGlyc;
    return {total, parts:{heat:dHeat,dehyd:dDehy,fatigue:dFat,glyc:dGlyc}};
  }

  // --- LIVE compute using shared runtime state and current AppState/Workout ---
  function computeLive(){
    const hr=AppState?.hr?.bpm||0;
    const spd=AppState?.tm?.speed||0;
    const inc=AppState?.tm?.incline||0;
    const rpe=(window.WorkoutEngine?.S?.rpeCur ?? 6);
    const tempC=20; // can make configurable later

    // power → expectation
    const Pd=demand_Wkg(spd,inc);
    const exp=expectedFromPower(Pd);

    // time base – SINGLE runtime clock
    const nowMs=performance.now(); if(runtime.prevTime==null) runtime.prevTime=nowMs;
    let dt=Math.max(0,(nowMs-runtime.prevTime)/1000); runtime.prevTime=nowMs; if(dt>2) dt=1; runtime.tSec+=dt;

    const Lph=sweatRateLph(tempC, exp.x); runtime.cumSweatL += Lph*(dt/3600);
    const dehydPct = (runtime.cumSweatL - waterL)/(load().mass||75)*100;

    const fatigueUnit = (exp.x==null?0.5:exp.x)*(runtime.tSec/60);
    const drift = hrDrift(runtime.tSec/60,tempC,dehydPct,fatigueUnit,runtime.tSec/60);

    const HRobs=hr; const HRnet = HRobs/(1+Math.max(0,drift.total));
    const pAct = pctHRR(HRnet, load().HRrest, load().HRmax);
    const ratioHR  = (exp.pHRR_exp>0)? (pAct/exp.pHRR_exp) : 1;
    const ratioRPE = (exp.RPE_exp>0)? ((rpe||6)/exp.RPE_exp) : 1;
    const a=(load().wHR||2), b=(load().wRPE||1); const IR = Math.pow(Math.pow(ratioHR,a)*Math.pow(ratioRPE,b),1/Math.max(1,(a+b)));
    const IF=exp.IF||1; const PIv = IF/Math.max(1e-6,IR);
    return {PI:PIv, dHR:Math.max(0,HRobs-HRnet), Pd_Wkg:Pd, IF, drift};
  }

  function addWater(dl){ waterL += (dl||0)/10; }

  return { load, save, demand_Wkg, computeLive, addWater, runtime };
})();

// ---- Help texts ----
const PI_HELP = {
  HRmax:`Maksimal hjertefrekvens (bpm).\nKalibrering: bruk høyeste verifiserte HR i konkurranse/hard økt.`,
  HRrest:`Hvilepuls (bpm).\nKalibrering: laveste morgenverdi over 3–5 dager.`,
  LT1:`Aerob terskel (bpm).\nEstimér fra 30–40 min rolig/terskel nær RPE≈4.`,
  LT2:`Anaerob terskel (bpm).\nEstimér fra 30–40 min TT (RPE≈7), snitt siste 20–30 min.`,
  RPE_LT1:`Opplevd intensitet (1–10) ved LT1.`,
  RPE_LT2:`Opplevd intensitet (1–10) ved LT2.`,
  PL1:`W/kg ved LT1 (valgfritt).`,
  PL2:`W/kg ved LT2 (anbefalt for bedre IF/PI).`,
  mass:`Kroppsmasse (kg).` ,
  zones:`Pulssoner i % av HRmax. Brukes i grafer og analyser.`,
  met_eff:`Mekanisk effektivitet for klatreleddet (≈0,25).`,
  shoe_gain_pct:`Prosent lavere kost pga sko/økonomi.`,
  tm_cal:`Møllekalibrering (×).`,
  drift_heat:`HR-drift pr °C over ~20 × tid.`,
  d_r1:`Svetterate ved lav intensitet (L/t).`,
  d_r2:`Svetterate ved høy intensitet (L/t).`,
  d_k:`Formparameter for intensitetsavh. svette.`,
  d_base:`Temperatur der ekstra svette starter.`,
  d_slope:`Tillegg L/t/°C over baseline.`,
  d_thresh:`Dehydrerings-terskel (% kroppsmasse).`,
  drift_dehyd:`HR-drift pr %-poeng dehydrering over terskel.`,
  drift_fatigue:`Akkumulert tretthet (proxy) → ΔHR.`,
  drift_glyc:`Glykogeneffekt pr min etter onset.`,
  glyc_onset:`Minutter før glyc.-effekt starter.`,
  glyc_tau:`Tidskonstant for oppbygging.`
};

function helpLabel(key, short){
  const text = PI_HELP[key]||short;
  const lbl = UI.h('span',{class:'lbl-help',style:'text-decoration:underline dotted; cursor:pointer; white-space:nowrap;'}, short);
  function show(ev){ const old=document.getElementById('pi-help-pop'); if(old) old.remove(); const box=document.createElement('div'); box.id='pi-help-pop'; box.style.cssText='position:fixed; max-width:420px; padding:10px; border:1px solid #c9d6f0; background:#fff; color:#0b1220; border-radius:8px; box-shadow:0 6px 24px rgba(0,0,0,.12); z-index:1000; font-size:12px; line-height:1.35; white-space:pre-wrap;'; box.textContent=text; document.body.appendChild(box); const r=ev.target.getBoundingClientRect(); box.style.left=Math.min(window.innerWidth-440, Math.max(8, r.left+8))+'px'; box.style.top=(r.bottom+6)+'px'; function hide(){ box.remove(); document.removeEventListener('click', hide);} setTimeout(()=>document.addEventListener('click', hide),0);} lbl.addEventListener('click', show); return lbl; }
function R(labelKey, input){ const r=UI.h('div',{class:'controls'}); r.style.margin='.25rem 0'; r.append(helpLabel(labelKey,labelKey), input); return r; }

const PIMod = {
  render(el){ el.innerHTML=''; const s=PI.load();
    // Top bar: Tilbake + Lagre (øverst)
    const top=UI.h('div',{class:'controls'});
    const back=UI.h('button',{class:'btn',onclick:()=>{ location.hash='#/workout'; }},'<i class="ph ph-caret-left"></i> Tilbake til økt');
    const saveBtn=UI.h('button',{class:'btn primary',onclick:()=>{ const zones=[]; for(let i=0;i<6;i++){ const f=parseFloat(document.getElementById('z_from_'+i).value)/100; const t=parseFloat(document.getElementById('z_to_'+i).value)/100; zones.push({name:'S'+i, from:Math.min(f,t), to:Math.max(f,t), color:document.getElementById('z_color_'+i).value}); } PI.save({ HRmax:+HRmax.value, HRrest:+HRrest.value, LT1:+LT1.value, LT2:+LT2.value, RPE_LT1:+RPE1.value, RPE_LT2:+RPE2.value, P_L1:parseFloat(PL1.value)||null, P_L2:parseFloat(PL2.value)||null, mass:+mass.value||75, zones, met_eff:parseFloat(met.value)||0.25, shoe_gain_pct:parseFloat(shoe.value)||0, tm_cal:parseFloat(tmcal.value)||1, sweat_r1:parseFloat(sr1.value)||0.8, sweat_r2:parseFloat(sr2.value)||1.6, sweat_k:parseFloat(sk.value)||1.5, sweat_base:parseFloat(sbase.value)||20, sweat_temp_slope:parseFloat(sslope.value)||0.03, dehyd_thresh:parseFloat(dth.value)||1.0, drift_heat_perC_perMin:parseFloat(drift_heat.value)||0.0005, drift_dehyd_perPct:parseFloat(dDehyd.value)||0.02, drift_fatigue_perUnit:parseFloat(dFatK.value)||0.001, drift_glyc_perMin:parseFloat(dGlycK.value)||0.0008, glyc_onset_min:parseFloat(dOn.value)||45, glyc_tau_min:parseFloat(dTau.value)||30, wHR:parseFloat(wHR.value)||2, wRPE:parseFloat(wRPE.value)||1 }); alert('Lagret'); }},'<i class="ph ph-floppy-disk"></i> Lagre');
    top.append(back, saveBtn);

    // Compact grid
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
    tPhys.append(
      R('HRmax',HRmax), R('HRrest',HRrest), R('LT1',LT1), R('LT2',LT2),
      R('RPE_LT1',RPE1), R('RPE_LT2',RPE2), R('PL1',PL1), R('PL2',PL2), R('mass',mass)
    );

    // --- PULSSONER ---
    const tZones=tile('Pulssoner (% av HRmax)');
    tZones.append(UI.h('div',{class:'small'},'Standard: S0 50–60 (grå), S1 60–72,5 (blå), S2 72,5–82,5 (grønn), S3 82,5–87,5 (gul), S4 87,5–92,5 (oransje), S5 92,5–100 (rød).'));
    (s.zones||[]).forEach((z,i)=>{
      const row=UI.h('div',{class:'controls'});
      const from=UI.h('input',{id:'z_from_'+i,class:'input',type:'number',step:'0.1',value:String((z.from*100).toFixed(1))});
      const to  =UI.h('input',{id:'z_to_'+i,  class:'input',type:'number',step:'0.1',value:String((z.to*100).toFixed(1))});
      const col =UI.h('input',{id:'z_color_'+i,class:'input',type:'color',value: z.color});
      row.append(UI.h('label',{class:'small',style:'min-width:42px'}, z.name), from, UI.h('span',{},'–'), to, col);
      tZones.append(row);
    });

    // --- EKSTERNT ---
    const tExt=tile('Eksternt arbeidskrav');
    const met   = UI.h('input',{class:'input',type:'number',step:'0.01',value:String(s.met_eff)});
    const shoe  = UI.h('input',{class:'input',type:'number',step:'0.1',value:String(s.shoe_gain_pct)});
    const tmcal = UI.h('input',{class:'input',type:'number',step:'0.001',value:String(s.tm_cal)});
    tExt.append(R('met_eff',met),R('shoe_gain_pct',shoe),R('tm_cal',tmcal));

    // --- HRDRIFT: Varme/Dehyd/Fatigue/Glykogen ---
    const tDrift=tile('HR-drift');
    const drift_heat=UI.h('input',{class:'input',type:'number',step:'0.0001',value:String(s.drift_heat_perC_perMin)});
    const sr1 = UI.h('input',{class:'input',type:'number',step:'0.1',value:String(s.sweat_r1)});
    const sr2 = UI.h('input',{class:'input',type:'number',step:'0.1',value:String(s.sweat_r2)});
    const sk  = UI.h('input',{class:'input',type:'number',step:'0.1',value:String(s.sweat_k)});
    const sbase=UI.h('input',{class:'input',type:'number',step:'0.5',value:String(s.sweat_base)});
    const sslope=UI.h('input',{class:'input',type:'number',step:'0.01',value:String(s.sweat_temp_slope)});
    const dth = UI.h('input',{class:'input',type:'number',step:'0.1',value:String(s.dehyd_thresh)});
    const dDehyd = UI.h('input',{class:'input',type:'number',step:'0.001',value:String(s.drift_dehyd_perPct)});
    const dFatK = UI.h('input',{class:'input',type:'number',step:'0.0001',value:String(s.drift_fatigue_perUnit)});
    const dGlycK= UI.h('input',{class:'input',type:'number',step:'0.0001',value:String(s.drift_glyc_perMin)});
    const dOn   = UI.h('input',{class:'input',type:'number',step:'1',value:String(s.glyc_onset_min)});
    const dTau  = UI.h('input',{class:'input',type:'number',step:'1',value:String(s.glyc_tau_min)});
    tDrift.append(
      R('drift_heat',drift_heat), R('d_r1',sr1), R('d_r2',sr2), R('d_k',sk), R('d_base',sbase), R('d_slope',sslope), R('d_thresh',dth),
      R('drift_dehyd',dDehyd), R('drift_fatigue',dFatK), R('drift_glyc',dGlycK), R('glyc_onset',dOn), R('glyc_tau',dTau)
    );

    // --- Vekter ---
    const tW=tile('Vekter – indre respons');
    const wHR=UI.h('input',{class:'input',type:'number',step:'0.1',value:String(s.wHR)});
    const wRPE=UI.h('input',{class:'input',type:'number',step:'0.1',value:String(s.wRPE)});
    tW.append(R('wHR',wHR),R('wRPE',wRPE));

    grid.append(tPhys, tZones, tExt, tDrift, tW);

    // --- LIVE & GRAF ---
    const live=UI.h('div',{class:'card'}); live.style.gridColumn='1 / -1';
    live.append(UI.h('h3',{},'Live & graf'));
    // mini visning knyttet til samme computeLive som Workout bruker
    const piOut=UI.h('div',{}, UI.h('div',{class:'small'},'PI'), UI.h('div',{class:'h1',id:'piVal'},'–'));
    const dOut =UI.h('div',{}, UI.h('div',{class:'small'},'ΔHR (bpm)'), UI.h('div',{class:'h1',id:'dHRVal'},'0'));
    live.append(UI.h('div',{class:'controls'}, piOut, dOut));
    const g=document.createElement('canvas'); g.width=1200; g.height=260; g.style.width='100%'; const ctx=g.getContext('2d'); live.append(g);

    const series=[]; const MAX=1200;
    function draw(){ const W=g.width,H=g.height; ctx.clearRect(0,0,W,H); ctx.strokeStyle='#b4c4e8'; ctx.strokeRect(40,10,W-60,H-30);
      // baseline PI=1
      const yPI=v=>10+(1-((v-0.85)/(1.15-0.85)))*(H-30); ctx.strokeStyle='#999'; ctx.beginPath(); ctx.moveTo(40,yPI(1)); ctx.lineTo(W-20,yPI(1)); ctx.stroke();
      if(series.length<2) return; const t0=series[0].t, t1=series[series.length-1].t||t0+1;
      // PI
      ctx.strokeStyle='#0d6efd'; ctx.lineWidth=2; ctx.beginPath(); series.forEach((p,i)=>{ const x=40+((p.t-t0)/(t1-t0))*(W-60); const y=yPI(Math.max(0.85,Math.min(1.15,p.PI||1))); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }); ctx.stroke();
      // dHR bars
      const yd=v=>10+(1-Math.min(1,v/20))*(H-30); ctx.fillStyle='rgba(217,60,60,.25)'; series.forEach(p=>{ const x=40+((p.t-t0)/(t1-t0))*(W-60); const y=yd(p.dHR||0); ctx.fillRect(x-1,y,2,(H-20)-y); });
    }
    function tick(){ const res=PI.computeLive(); const p=document.getElementById('piVal'); if(p) p.textContent=(res.PI?res.PI.toFixed(3):'–'); const d=document.getElementById('dHRVal'); if(d) d.textContent=String(Math.round(res.dHR||0)); series.push({t:Date.now()/1000, PI:res.PI, dHR:res.dHR}); while(series.length>MAX) series.shift(); draw(); }
    const timer=setInterval(tick,1000); el.addEventListener('DOMNodeRemoved',()=>{ try{ clearInterval(timer);}catch(_e){} },{once:true});

    el.append(top, grid, live);
  }
};
