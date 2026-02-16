const UI = {
  h(tag, props={}, ...children){
    const el=document.createElement(tag);
    for(const [k,v] of Object.entries(props||{})){
      if(k.startsWith('on') && typeof v==='function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if(k==='html') el.innerHTML=v; else if(k==='class') el.className=v; else el.setAttribute(k, v);
    }
    for(const c of children){ if(c==null) continue; if(typeof c==='string') el.appendChild(document.createTextNode(c)); else el.appendChild(c); }
    return el;
  },
  setConnected(id, on){ const b=document.getElementById(id); if(!b) return; b.classList.toggle('connected', !!on); b.setAttribute('aria-pressed', !!on); },
  fmtTime(sec){ sec=Math.max(0,Math.floor(sec)); const m=String(Math.floor(sec/60)).padStart(2,'0'); const s=String(sec%60).padStart(2,'0'); return `${m}:${s}`; }
};
