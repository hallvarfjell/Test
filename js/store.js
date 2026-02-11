
export const Store = {
  key:'intz-store-v2',
  data: { ui:{ theme:'dark', sounds:false }, settings:{ age:35, weight:75, vo2max:50, hrMax:190, lt1:135, lt2:160, zones:[0.5,0.6,0.7,0.8,0.9], treadmill:{ supportsFTMS:false, forceManualIncline:false, translator:false}, transitionPauseSec:10 }, workouts:[], sessions:[] },
  load(){ try{ const j=localStorage.getItem(this.key); if(j) this.data=JSON.parse(j);}catch(e){} },
  save(){ try{ localStorage.setItem(this.key, JSON.stringify(this.data)); }catch(e){} }
};
Store.load();
if(!Store.data.workouts.length){ Store.data.workouts=[{ id:crypto.randomUUID(), name:'4x4 klassiker', type:'intervaller', blocks:[ {kind:'warmup', durationSec:600, intensity:'Lett', target:{speed:9, incline:1}}, {kind:'set', reps:4, workSec:240, restSec:180, intensity:'Hardt (85% HRmax)', target:{speed:14, incline:1}}, {kind:'cooldown', durationSec:600, intensity:'Lett', target:{speed:8.5, incline:1}} ] }]; Store.save(); }
