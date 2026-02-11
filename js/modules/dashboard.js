
import { Store } from '../store.js';
export function renderDashboard(){ const host=document.getElementById('app'); host.innerHTML=`<section class='panel'><h3>Hurtigstart</h3><div class='flex'><select id='selWorkout' class='input'>${Store.data.workouts.map(w=>`<option value='${w.id}'>${w.name}</option>`).join('')}</select><a class='btn primary' href='#/workout'>Start økt</a><a class='btn' href='#/editor'>Rediger økter</a></div></section>`; }
