
import { renderDashboard } from './modules/dashboard.js';
import { renderEditor } from './modules/editor.js';
import { renderWorkout } from './modules/workout.js';
import { renderSimulator } from './modules/simulator.js';
import { renderResults } from './modules/results.js';
import { renderStats } from './modules/stats.js';
import { renderSettings } from './modules/settings.js';
import { renderLog } from './modules/log.js';

export const routes = {
  '/': {fn: renderDashboard, title:'Dashboard'},
  '/editor': {fn: renderEditor, title:'Økteditor'},
  '/workout': {fn: renderWorkout, title:'Økt'},
  '/simulator': {fn: renderSimulator, title:'Responssimulator'},
  '/results': {fn: renderResults, title:'Resultater'},
  '/stats': {fn: renderStats, title:'Statistikk'},
  '/settings': {fn: renderSettings, title:'Innstillinger'},
  '/log': {fn: renderLog, title:'Logg'}
};

export const router = { onRouteChange:null };
export function setRouteTitle(t){ const el=document.getElementById('routeTitle'); if(el) el.textContent = t; }

function navigate(){ const hash=location.hash.replace('#','')||'/'; const r=routes[hash]||routes['/']; const app=document.getElementById('app'); if(app) app.innerHTML=''; r.fn(); setRouteTitle(r.title); router.onRouteChange && router.onRouteChange(r.title); }
window.addEventListener('hashchange', navigate); navigate();
