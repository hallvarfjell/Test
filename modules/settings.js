const Settings = {
  render(el, st){
    el.innerHTML='';
    const card = UI.h('div',{class:'card'});
    const vekt = UI.h('input',{class:'input', type:'number', value: st.settings.vekt||''});
    const hrmax = UI.h('input',{class:'input', type:'number', value: st.settings.hrmax||190});
    const lt1 = UI.h('input',{class:'input', type:'number', value: st.settings.lt1||135});
    const lt2 = UI.h('input',{class:'input', type:'number', value: st.settings.lt2||160});
    const soner = UI.h('input',{class:'input', value: (st.settings.soner||[115,134,145,164,174]).join(',')});

    function row(lbl, inp){ const r=UI.h('div',{class:'controls'}); r.append(UI.h('label',{style:'min-width:160px'},lbl), inp); return r; }

    card.append(UI.h('h2',{},'Innstillinger'),
      row('Vekt (kg)', vekt), row('Makspuls', hrmax), row('LT1', lt1), row('LT2', lt2), row('Pulssoner (grenser)', soner),
      UI.h('div',{class:'small'},'Sone 0: <115 (grå), 1: 115–134 (grønn), 2: 135–145 (blå), 3: 146–164 (gul), 4: 165–174 (oransje), 5: ≥175 (rød).')
    );

    const save = UI.h('button',{class:'btn primary', onclick:()=>{
      st.settings = { vekt:parseFloat(vekt.value)||null, hrmax:parseInt(hrmax.value)||190, lt1:parseInt(lt1.value)||135, lt2:parseInt(lt2.value)||160, soner:soner.value.split(',').map(x=>parseInt(x.trim())).filter(x=>!isNaN(x)), tema:'light' };
      Storage.save('settings', st.settings); alert('Lagret.');
    }}, 'Lagre');

    el.append(UI.h('h1',{class:'h1'},'Innstillinger'), card, save);
  }
};
