const Result = { render(el, st){ el.innerHTML=''; const params = new URLSearchParams(location.hash.split('?')[1]||''); const id = params.get('id'); const s = (st.logg||[]).find(x=>x.id===id) || st.logg?.slice().pop(); if(!s){ el.textContent='Fant ikke økta.'; return; } const card = UI.h('div',{class:'card'}); const h = UI.h('h2',{}, `Resultat – ${s.name}`); const t = UI.h('div',{}, `Slutt: ${new Date(s.endedAt).toLocaleString()}`);
 const grid = UI.h('div',{class:'list'});
 grid.appendChild(UI.h('div',{class:'list-item'}, `Totaltid: ${UI.fmtTime(s.total||0)}`));
 grid.appendChild(UI.h('div',{class:'list-item'}, `Distanse: ${(s.dist||0).toFixed(2)} km`));
 if(s.water!=null) grid.appendChild(UI.h('div',{class:'list-item'}, `Vann: ${s.water} × 0,1 L`));
 if(s.carbs!=null) grid.appendChild(UI.h('div',{class:'list-item'}, `Karbo: ${s.carbs} porsjoner`));
 card.append(h,t, UI.h('h3',{},'Oppsummering'), grid); el.append(UI.h('h1',{class:'h1'},'Resultat'), card); } };
