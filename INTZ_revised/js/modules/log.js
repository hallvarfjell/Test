
import { Store } from '../store.js';
import { fmtTime } from '../helpers.js';
export function renderLog(){ const host=document.getElementById('app'); host.innerHTML=`<section class='panel'><h3>Logg</h3><table class='table'><thead><tr><th>Dato</th><th>Økt</th><th>Varighet</th><th>Snitt HR</th><th></th></tr></thead><tbody>${Store.data.sessions.map((s,i)=>`<tr><td>${new Date(s.startedAt).toLocaleString()}</td><td>${s.workoutName}</td><td>${fmtTime(s.summary?.durationSec||0)}</td><td>${s.summary?.avgHr||'—'}</td><td><a class='btn' href='#/results'>Vis</a></td></tr>`).join('')}</tbody></table></section>`; }
