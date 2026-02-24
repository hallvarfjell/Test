const Storage={
  load(key,def){ try{ const v=localStorage.getItem('INTZ_'+key); return v? JSON.parse(v): def; }catch(e){ return def; } },
  save(key,val){ try{ localStorage.setItem('INTZ_'+key, JSON.stringify(val)); }catch(e){} },
  loadP(profile,key,def){ return Storage.load(profile+'_'+key, def); },
  saveP(profile,key,val){ Storage.save(profile+'_'+key, val); }
};