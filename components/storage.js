const Storage = {
  load(k, def){ try{ const v=localStorage.getItem('INTZ_'+k); return v? JSON.parse(v): def; }catch(e){ return def; } },
  save(k, v){ try{ localStorage.setItem('INTZ_'+k, JSON.stringify(v)); }catch(e){} },
  push(k, item){ const arr=this.load(k, []); arr.push(item); this.save(k, arr); return arr; }
};
