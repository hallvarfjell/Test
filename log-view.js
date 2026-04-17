// log-view.js
// INTZ v10.1 – Log view rendering for SPA

function activeUser(){ return localStorage.getItem('active_user') || 'default'; }
function nsKey(k){ return 'u:'+activeUser()+':'+k; }
function getNS(k, d){ try{ const v=localStorage.getItem(nsKey(k)); if(v!=null) return JSON.parse(v); const ov=localStorage.getItem(k); return ov!=null? JSON.parse(ov): d; }catch(e){ return d; } }
function setNS(k, v){ localStorage.setItem(nsKey(k), JSON.stringify(v)); }

function renderLog(){
  const list=document.getElementById('log-list');
  if(!list) return;
  list.innerHTML='';
  const sessions=getNS('sessions',[]);
  if(!sessions.length){ list.innerHTML='<p class="small">Ingen økter enda.</p>'; return; }

  const ul=document.createElement('div');
  ul.style.display='grid';
  ul.style.gap='8px';

  sessions.slice().reverse().forEach(s=>{
    const row=document.createElement('div');
    row.className='menu-item';
    row.style.justifyContent='space-between';
    row.style.alignItems='center';
    row.style.display='flex';

    const when=new Date(s.startedAt||Date.now()).toLocaleString();
    const dist=s.points&&s.points.length? (s.points[s.points.length-1].dist_m/1000).toFixed(2)+' km' : '';

    const left=document.createElement('a');
    left.href='#results:'+s.id;
    left.textContent=`${(s.name||'Økt')} — ${when}`;
    left.style.flex='1';
    left.style.textDecoration='none';

    const right=document.createElement('div');
    right.style.display='flex';
    right.style.gap='8px';
    right.style.alignItems='center';

    const distSpan=document.createElement('span');
    distSpan.textContent=dist;
    right.appendChild(distSpan);

    const del=document.createElement('button');
    del.className='ghost';
    del.title='Slett';
    del.innerHTML='<i class="ph-trash"></i>';
    del.onclick=()=>{
      if(confirm('Slette denne økta?')){
        const arr=getNS('sessions',[]);
        const idx=arr.findIndex(x=>x.id===s.id);
        if(idx>=0){ arr.splice(idx,1); setNS('sessions',arr); renderLog(); }
      }
    };
    right.appendChild(del);

    row.appendChild(left);
    row.appendChild(right);
    ul.appendChild(row);
  });

  list.appendChild(ul);
}

window.addEventListener('intz:viewchange', (e)=>{
  if(e.detail && e.detail.view==='log') renderLog();
});

document.addEventListener('DOMContentLoaded', renderLog);
