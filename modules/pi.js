
// PI module v1.3.3 (patch for v1.3.2)
// - External demand (speed, grade, carbon-shoe gain, treadmill calibration)
// - Internal response (HR_net vs expected, RPE vs expected) with weights
// - HR drift decomposition: heat, dehydration, fatigue, glycogen
// - Live graph: PI(t) + ΔHR(t)

const PI = (function(){
  let cfg=null; let waterL=0; // simple accumulator used for dehydration model

  function load(){
    cfg = Storage.loadP(AppState.currentProfile, 'settings', {});
    // sensible defaults (merge)
    cfg = Object.assign({
      // physiology
      HRmax:190, HRrest:50, LT1:135, LT2:160,
      RPE_LT1:4, RPE_LT2:7,
      P_L1:null, P_L2:null, // optional W/kg calibration
      mass:75,
      // external demand params
      met_eff:0.25, // mechanical efficiency for potential energy
      shoe_gain_pct:4, // carbon shoes economy gain (% reduction in demand)
      tm_cal:1.00, // treadmill calibration scalar (snill/gjerrig)
      heat_beta:0.012, // multiplicative increase in W/kg per °C above T0
      T0:12,
      // sweat & dehydration
      sweat_r1:0.8, sweat_r2:1.2, sweat_k:1.5, sweat_base:20, sweat_temp_slope:0.03,
      dehyd_thresh:0.5, // % body mass
      // HR drift model (weights)
      drift_heat_perC_perMin:0.0005,
      drift_dehyd_perPct:0.02,
      drift_fatigue_perUnit:0.001,
      drift_glyc_perMin:0.0008, glyc_onset_min:45, glyc_tau_min:30,
      // internal weights
      wHR:2, wRPE:1
    }, cfg||{});
    return cfg;
  }
  function save(nc){ cfg = Object.assign(load(), nc||{}); Storage.saveP(AppState.currentProfile, 'settings', cfg); return cfg; }

  // utils
  const clamp01 = x=> Math.max(0, Math.min(1,x));
  const percentHRR = (hr, r, m) => (hr - r)/(m - r);

  // external demand (W/kg)
  function demand_Wkg(speedKmh, gradePct, tempC){
    const c = load();
    const v = (speedKmh||0)/3.6; // m/s
    const i = (gradePct||0)/100; // slope
    // baseline cost for running on flat ground (J/kg/s ≈ 4.185*v)
    const P_flat = 4.185 * v;
    // climbing power as mechanical power divided by metabolic efficiency
    const P_climb = (9.81 * v * i) / (c.met_eff||0.25);
    // heat multiplier on demand (above T0)
    const heatMul = 1 + (c.heat_beta||0.012) * Math.max(0, (tempC||20) - (c.T0||12));
    // carbon shoes: reduce demand by shoe_gain_pct
    const shoeMul = 1 - Math.max(0, (c.shoe_gain_pct||0)/100);
    // treadmill calibration (snill/gjerrig)
    const tmMul = (c.tm_cal||1.0);
    return (P_flat + P_climb) * heatMul * shoeMul * tmMul; // W/kg
  }

  // expected scalars based on P_L1/P_L2 mapping to x (0..1)
  function expectedFromPower(Pd){
    const c = load();
    if(c.P_L1 && c.P_L2 && c.P_L2>0){
      const IF = Pd / c.P_L2; // external intensity vs LT2
      const IF1 = c.P_L1 / c.P_L2;
      const x = clamp01( (IF - IF1) / Math.max(1e-6, (1 - IF1)) );
      // expected HRR and RPE interpolate between LT1 and LT2 anchors
      const p1 = percentHRR(c.LT1, c.HRrest, c.HRmax);
      const p2 = percentHRR(c.LT2, c.HRrest, c.HRmax);
      const pHRR_exp = p1 + x*(p2 - p1);
      const RPE_exp = (c.RPE_LT1||4) + x * ((c.RPE_LT2||7) - (c.RPE_LT1||4));
      return { IF, x, pHRR_exp, RPE_exp };
    } else {
      // fall back to HR anchors only
      const p1 = percentHRR(c.LT1, c.HRrest, c.HRmax);
      const p2 = percentHRR(c.LT2, c.HRrest, c.HRmax);
      const pHRR_exp = (p1+p2)/2;
      const RPE_exp = (c.RPE_LT1 + c.RPE_LT2)/2;
      return { IF:1.0, x:null, pHRR_exp, RPE_exp };
    }
  }

  // sweat model → L/h, then cum sweat
  function sweatRateLph(tempC, x){
    const c = load();
    const base = (c.sweat_r1||0.8)*Math.pow((c.sweat_r2||1.2)/(c.sweat_r1||0.8), Math.pow(clamp01(x||0), (c.sweat_k||1.5)));
    const add = (tempC>(c.sweat_base||20))? (c.sweat_temp_slope||0.03) * (tempC - (c.sweat_base||20)) : 0;
    return base + add;
  }

  // HR drift components → total multiplicative drift
  function hrDrift(totalMin, tempC, dehydPct, fatigueUnit, glycMin){
    const c = load();
    const dhHeat = Math.max(0, (tempC-20)) * (c.drift_heat_perC_perMin||0.0005) * totalMin; // heat grows with time & ∆T
    const dhDehyd = Math.max(0, (dehydPct - (c.dehyd_thresh||0.5))) * (c.drift_dehyd_perPct||0.02); // per %-point
    const dhFat = Math.max(0, fatigueUnit) * (c.drift_fatigue_perUnit||0.001); // accumulative
    // glycogen drift kicks in after onset, rises with time constant
    const tOver = Math.max(0, glycMin - (c.glyc_onset_min||45));
    const dhGlyc = (tOver>0)? (c.drift_glyc_perMin||0.0008) * (1 - Math.exp(-tOver/Math.max(1,(c.glyc_tau_min||30)))) * glycMin : 0;
    const total = dhHeat + dhDehyd + dhFat + dhGlyc;
    return { total, parts:{ heat:dhHeat, dehyd:dhDehyd, fatigue:dhFat, glyc:dhGlyc } };
  }

  // single compute step
  function compute(now, state){
    const c = load();
    const speedKmh = state.speedKmh, gradePct = state.inclinePct, tempC = state.tempC;
    const Pd = demand_Wkg(speedKmh, gradePct, tempC);
    const exp = expectedFromPower(Pd);

    // advance time & hydration
    const nowMs = now || performance.now();
    if(state.prevTime==null) state.prevTime=nowMs;
    let dt = Math.max(0, (nowMs - state.prevTime)/1000); state.prevTime = nowMs;
    if(dt>2) dt=1; // clamp to avoid spikes when tab was asleep
    state.tSec += dt;

    // accumulate sweat
    const Lph = sweatRateLph(tempC, exp.x);
    state.cumSweatL += Lph * (dt/3600);
    const dehydPct = (state.cumSweatL - waterL) / (c.mass||75) * 100; // % body mass

    // fatigue proxy: cumulative intensity units
    const fatigueUnit = (exp.x==null? 0.5 : exp.x) * (state.tSec/60);

    // glyc minutes
    const glycMin = state.tSec/60;

    // HR net (remove drift):
    const drift = hrDrift(state.tSec/60, tempC, dehydPct, fatigueUnit, glycMin);
    const HRobs = state.hr || 0;
    const HRnet = HRobs / (1 + Math.max(0, drift.total));

    const pAct = percentHRR(HRnet, c.HRrest, c.HRmax);
    const pHRR_exp = exp.pHRR_exp || 0.6;
    const RPEv = state.rpe || 6;
    const RPE_exp = exp.RPE_exp || 6;

    // internal response scalar (normalized around 1)
    const ratioHR  = (pAct>0 && pHRR_exp>0)? (pAct/pHRR_exp) : 1;
    const ratioRPE = (RPE_exp>0)? (RPEv/RPE_exp) : 1;
    const a=(c.wHR||2), b=(c.wRPE||1); const wSum=a+b;
    const IR = Math.pow(Math.pow(ratioHR,a) * Math.pow(ratioRPE,b), 1/Math.max(1,wSum));

    const IF = exp.IF || 1;
    const PI_tot = IF / Math.max(1e-6, IR);

    return {
      Pd_Wkg: Pd,
      IF, x: exp.x,
      pHRR_exp, RPE_exp,
      HRobs, HRnet, dHR: Math.max(0, HRobs - HRnet),
      Lph, dehydPct, drift, IR, PI: PI_tot
    };
  }

  function addWater(dl){ waterL += (dl||0)/10; }

  return { load, save, compute, addWater };
})();

const PIMod = {
  render(el, st){
    el.innerHTML='';
    const s = PI.load();
    // ---- UI left: inputs/params ----
    const wrap = UI.h('div',{class:'card'});
    wrap.append(UI.h('h2',{},'PI – Performance Index (ekstern/indres respons)'));

    function row(lbl, inp){ const r=UI.h('div',{class:'controls'}); r.append(UI.h('label',{style:'min-width:240px'},lbl), inp); return r; }
    const inp = (val,step='any')=> UI.h('input',{class:'input',type:'number',value:String(val??''),step:String(step)});

    // physiology
    const HRmax=inp(s.HRmax); const HRrest=inp(s.HRrest); const LT1=inp(s.LT1); const LT2=inp(s.LT2);
    const RPE1=inp(s.RPE_LT1); const RPE2=inp(s.RPE_LT2);
    const PL1=inp(s.P_L1,0.01); const PL2=inp(s.P_L2,0.01);
    const mass=inp(s.mass);

    // external demand
    const met=inp(s.met_eff,0.01); const shoe=inp(s.shoe_gain_pct,0.1); const tmcal=inp(s.tm_cal,0.001);
    const beta=inp(s.heat_beta,0.001); const T0=inp(s.T0,0.5);

    // sweat/dehydration
    const sr1=inp(s.sweat_r1,0.1), sr2=inp(s.sweat_r2,0.1), sk=inp(s.sweat_k,0.1), sbase=inp(s.sweat_base,0.5), sslope=inp(s.sweat_temp_slope,0.01);
    const dth=inp(s.dehyd_thresh,0.1);

    // drift parts
    const dHeat=inp(s.drift_heat_perC_perMin,0.0001), dDehyd=inp(s.drift_dehyd_perPct,0.001), dFat=inp(s.drift_fatigue_perUnit,0.0001), dGlyc=inp(s.drift_glyc_perMin,0.0001), dOn=inp(s.glyc_onset_min,1), dTau=inp(s.glyc_tau_min,1);

    // weights
    const wHR=inp(s.wHR,0.1), wRPE=inp(s.wRPE,0.1);

    // Save/close
    const saveBtn = UI.h('button',{class:'btn primary',onclick:()=>{
      PI.save({ HRmax:+HRmax.value, HRrest:+HRrest.value, LT1:+LT1.value, LT2:+LT2.value,
        RPE_LT1:+RPE1.value, RPE_LT2:+RPE2.value, P_L1:parseFloat(PL1.value)||null, P_L2:parseFloat(PL2.value)||null,
        mass:+mass.value||75, met_eff:parseFloat(met.value)||0.25, shoe_gain_pct:parseFloat(shoe.value)||0,
        tm_cal:parseFloat(tmcal.value)||1, heat_beta:parseFloat(beta.value)||0.012, T0:parseFloat(T0.value)||12,
        sweat_r1:parseFloat(sr1.value)||0.8, sweat_r2:parseFloat(sr2.value)||1.2, sweat_k:parseFloat(sk.value)||1.5,
        sweat_base:parseFloat(sbase.value)||20, sweat_temp_slope:parseFloat(sslope.value)||0.03,
        dehyd_thresh:parseFloat(dth.value)||0.5,
        drift_heat_perC_perMin:parseFloat(dHeat.value)||0.0005, drift_dehyd_perPct:parseFloat(dDehyd.value)||0.02,
        drift_fatigue_perUnit:parseFloat(dFat.value)||0.001, drift_glyc_perMin:parseFloat(dGlyc.value)||0.0008,
        glyc_onset_min:parseFloat(dOn.value)||45, glyc_tau_min:parseFloat(dTau.value)||30,
        wHR:parseFloat(wHR.value)||2, wRPE:parseFloat(wRPE.value)||1
      });
      alert('Lagret');
    }},'Lagre');
    const backBtn = UI.h('button',{class:'btn',onclick:()=>{ location.hash = '#/workout'; }},'Tilbake til Økt');

    // assemble left
    wrap.append(
      UI.h('h3',{},'Fysiologi'), row('HRmax',HRmax), row('HRrest',HRrest), row('LT1 (bpm)',LT1), row('LT2 (bpm)',LT2), row('RPE@LT1',RPE1), row('RPE@LT2',RPE2), row('P_LT1 (W/kg)',PL1), row('P_LT2 (W/kg)',PL2), row('Masse (kg)',mass),
      UI.h('h3',{},'Eksternt arbeidskrav (modell)'), row('Met-effektivitet',met), row('Karbonsko gevinst (%)',shoe), row('Tredemølle kalibrering (×)',tmcal), row('Varme β (/°C)',beta), row('T0 demand (°C)',T0),
      UI.h('h3',{},'Svetting/dehydrering'), row('r1 (20°C)',sr1), row('r2 (20°C)',sr2), row('form k',sk), row('baseline (°C)',sbase), row('temp-slope (L/t/°C)',sslope), row('Dehyd-terskel (%)',dth),
      UI.h('h3',{},'HR-drift (komponentvekter)'), row('Heat drift (/°C/min)',dHeat), row('Dehyd drift (/%)',dDehyd), row('Fatigue drift (/unit)',dFat), row('Glyc drift (/min)',dGlyc), row('Glyc onset (min)',dOn), row('Glyc tau (min)',dTau),
      UI.h('h3',{},'Vekter (indre respons)'), row('wHR',wHR), row('wRPE',wRPE),
      UI.h('div',{class:'controls'}, saveBtn, backBtn)
    );

    // ---- UI right: live inputs + results + graph ----
    const live = UI.h('div',{class:'card'});
    live.append(UI.h('h3',{},'Live beregning'));
    const inTemp = UI.h('input',{type:'number',class:'input',value:'20',step:'0.5'});
    const inRPE  = UI.h('input',{type:'number',class:'input',value:'6',step:'0.1'});
    function r(l,el){ const rr=UI.h('div',{class:'controls'}); rr.append(UI.h('label',{style:'min-width:160px'},l), el); return rr; }
    live.append(r('Temperatur (°C)', inTemp), r('RPE (1–10)', inRPE));
    const btnWater = UI.h('button',{class:'btn',onclick:()=>{ PI.addWater(1); }},'+0,1 L vann');
    live.append(UI.h('div',{class:'controls'}, btnWater));

    const outPI = UI.h('div',{}, UI.h('div',{class:'small'},'PI (ekstern/indre)'), UI.h('div',{class:'h1',id:'piVal'},'–'));
    const outdHR = UI.h('div',{}, UI.h('div',{class:'small'},'ΔHR drift (bpm)'), UI.h('div',{class:'h1',id:'dHRVal'},'0'));
    live.append(UI.h('div',{class:'controls'}, outPI, outdHR));

    // graph canvas
    const gCard = UI.h('div',{class:'card'}); gCard.append(UI.h('h3',{},'PI og ΔHR over tid (baseline PI=1)'));
    const c=document.createElement('canvas'); c.width=920; c.height=260; const ctx=c.getContext('2d'); gCard.append(c);

    // time series
    const series=[]; const MAX=1200; // 20 min @1 Hz
    const state={ prevTime:null, tSec:0, hr:0, speedKmh:0, inclinePct:0, tempC:20, rpe:6, cumSweatL:0 };

    function draw(){
      const W=c.width, H=c.height; ctx.clearRect(0,0,W,H);
      // axes box
      ctx.strokeStyle='#b4c4e8'; ctx.strokeRect(40,10,W-60,H-30);
      // baseline PI=1 line
      const yPI = v=> 10 + (1 - ( (v-0.85)/(1.15-0.85) ))*(H-30);
      ctx.strokeStyle='#999'; ctx.beginPath(); ctx.moveTo(40, yPI(1.0)); ctx.lineTo(W-20, yPI(1.0)); ctx.stroke();
      if(series.length<2) return;
      const t0=series[0].t, t1=series[series.length-1].t||t0+1;
      // PI line
      ctx.strokeStyle='#0d6efd'; ctx.lineWidth=2; ctx.beginPath();
      series.forEach((p,i)=>{ const x=40 + ((p.t-t0)/(t1-t0))*(W-60); const y=yPI(Math.max(0.85, Math.min(1.15, p.PI||1))); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); });
      ctx.stroke();
      // dHR bars (map 0..20 bpm to area)
      const yd = v=> 10 + (1 - Math.min(1, v/20))*(H-30);
      ctx.strokeStyle='#d93c3c'; ctx.fillStyle='rgba(217,60,60,0.25)';
      series.forEach(p=>{ const x=40 + ((p.t-t0)/(t1-t0))*(W-60); const y=yd(p.dHR||0); ctx.fillRect(x-1, y, 2, (H-20)-y); });
    }

    function tick(){
      // pull live values from AppState (if available)
      state.hr = AppState?.hr?.bpm || 0;
      state.speedKmh = AppState?.tm?.speed || 0;
      state.inclinePct = AppState?.tm?.incline || 0;
      state.tempC = parseFloat(inTemp.value)||20;
      state.rpe = parseFloat(inRPE.value)||6;

      const res = PI.compute(performance.now(), state);
      const piEl=document.getElementById('piVal'); if(piEl) piEl.textContent = (res.PI? res.PI.toFixed(3):'–');
      const dEl = document.getElementById('dHRVal'); if(dEl) dEl.textContent = String(Math.round(res.dHR||0));

      series.push({ t: Date.now()/1000, PI: res.PI, dHR: res.dHR }); while(series.length>MAX) series.shift();
      draw();
    }

    const timer = setInterval(tick, 1000);
    el.addEventListener('DOMNodeRemoved', ()=>{ try{ clearInterval(timer);}catch(e){} }, {once:true});

    // mount
    const grid = UI.h('div',{});
    el.append(UI.h('h1',{class:'h1'},'PI'), wrap, live, gCard);
  }
};
