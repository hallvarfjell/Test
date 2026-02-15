const Innstillinger = {
  render(el, state){
    el.innerHTML='';
    const form = UI.h('div',{class:'card'});
    form.append(UI.h('h2',{},'Personlige innstillinger'));

    function row(label, input){
      const r = UI.h('div',{class:'row'}); r.append(UI.h('label',{style:'min-width:180px'},label), input); return r;
    }

    const alder = UI.h('input',{class:'input', type:'number', value: state.settings.alder||''});
    const vekt = UI.h('input',{class:'input', type:'number', value: state.settings.vekt||''});
    const hrmax = UI.h('input',{class:'input', type:'number', value: state.settings.hrmax||''});
    const lt1 = UI.h('input',{class:'input', type:'number', value: state.settings.lt1||''});
    const lt2 = UI.h('input',{class:'input', type:'number', value: state.settings.lt2||''});
    const soner = UI.h('input',{class:'input', value: (state.settings.soner||[90,110,130,150,170]).join(',')});

    form.append(
      row('Alder', alder),
      row('Vekt', vekt),
      row('Maks puls', hrmax),
      row('LT1 (puls)', lt1),
      row('LT2 (puls)', lt2),
      row('Pulssoner (komma-separert)', soner),
      UI.h('div',{class:'small'},'Veiledning for LT1/LT2 og maks puls kommer.'),
    );

    const theme = UI.h('select',{},
      UI.h('option',{value:'dark', selected: (state.settings.tema||'dark')==='dark'},'Mørkt'),
      UI.h('option',{value:'light', selected: (state.settings.tema||'dark')==='light'},'Lyst')
    );

    form.append(UI.h('h3',{},'Skjerm- og lydinnstillinger'), row('Tema', theme));

    const save = UI.h('button',{class:'btn primary', onclick:()=>{
      state.settings = { alder:parseInt(alder.value)||null, vekt:parseFloat(vekt.value)||null, hrmax:parseInt(hrmax.value)||190, lt1:parseInt(lt1.value)||135, lt2:parseInt(lt2.value)||160, tema:theme.value, soner:soner.value.split(',').map(x=>parseInt(x.trim())).filter(x=>!isNaN(x)) };
      Storage.save('settings', state.settings);
      alert('Lagret');
    }},'Lagre');

    el.append(UI.h('h1',{class:'h1'},'Innstillinger'), form, save);
  }
};
