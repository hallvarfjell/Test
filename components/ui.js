const UI = {
  h(tag, props={}, ...children){
    const el = document.createElement(tag);
    for(const [k,v] of Object.entries(props||{})){
      if(k.startsWith('on') && typeof v==='function') el.addEventListener(k.substring(2).toLowerCase(), v);
      else if(k==='html') el.innerHTML=v;
      else if(k==='class') el.className=v;
      else if(v!==undefined) el.setAttribute(k, v);
    }
    for(const ch of children){ if(ch==null) continue; if(typeof ch==='string') el.appendChild(document.createTextNode(ch)); else el.appendChild(ch); }
    return el;
  },
  toggleConnected(id, on){ const b=document.getElementById(id); if(!b) return; b.classList.toggle('connected', !!on); b.setAttribute('aria-pressed', !!on); },
  fmtTime(sec){ sec=Math.max(0, Math.floor(sec)); const m=String(Math.floor(sec/60)).padStart(2,'0'); const s=String(sec%60).padStart(2,'0'); return `${m}:${s}`; },
  chip(txt){ const s=UI.h('span',{class:'list-item small'},txt); return s; },
};
