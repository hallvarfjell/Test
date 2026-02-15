const Storage = {
  load(key, def){ try{ const v=localStorage.getItem('INTZ_'+key); return v? JSON.parse(v): def; }catch(e){ return def; } },
  save(key, val){ try{ localStorage.setItem('INTZ_'+key, JSON.stringify(val)); }catch(e){} },
  push(key, item){ const arr=this.load(key, []); arr.push(item); this.save(key, arr); return arr; }
};
