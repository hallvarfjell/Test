
import { router, setRouteTitle } from './js/router.js';
import { connectHR, connectFTMS, hrState, ftmsState } from './js/ble.js';
import { Store } from './js/store.js';

document.documentElement.setAttribute('data-theme', Store.data.ui.theme || 'dark');

const dropdown = document.getElementById('dropdown');
const hamburger = document.getElementById('hamburger');
const brand = document.getElementById('brand');
hamburger.addEventListener('click', ()=> dropdown.classList.toggle('hidden'));
document.addEventListener('click', (e)=>{ if(!dropdown.classList.contains('hidden') && !hamburger.contains(e.target) && !dropdown.contains(e.target)) dropdown.classList.add('hidden'); });
[...dropdown.querySelectorAll('a')].forEach(a=> a.addEventListener('click', ()=> dropdown.classList.add('hidden')));
brand.addEventListener('click', ()=> { location.hash = '#/'; dropdown.classList.add('hidden'); });

function tickClock(){ const now=new Date(); const clock=document.getElementById('clock'); const date=document.getElementById('date'); if(clock) clock.textContent=now.toLocaleTimeString(); if(date) date.textContent=now.toLocaleDateString(); }
setInterval(tickClock, 500); tickClock();
router.onRouteChange = (name)=> setRouteTitle(name);

document.getElementById('btnConnectHR').onclick = ()=> connectHR();
document.getElementById('btnConnectFTMS').onclick = ()=> connectFTMS();
function refreshIcons(){ document.getElementById('hrDot').classList.toggle('ok', !!hrState.connected); document.getElementById('tmDot').classList.toggle('ok', !!ftmsState.connected); }
setInterval(refreshIcons, 500);

if('serviceWorker' in navigator){ window.addEventListener('load', ()=> navigator.serviceWorker.register('sw.js')); }
