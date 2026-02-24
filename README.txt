
INTZ full delta v1.4.0 (combined changes for your last two requests)

Included in this zip:
- app.js  (fully working profile dropdown with "+ Legg til", robust router, wake lock, HR/FTMS, eksport/import)

Not included here (already delivered previously):
- modules/pi.js (v1.3.9)
- modules/result.js (v1.3.9)
- modules/workout.js (v1.3.8) og/eller patch til denne
- components/*.js, index.html, app.css, m.m.

Bruk sammen med forrige pakker:
- intz_pi_result_patch_v139.zip  (PI + Resultat + workout patch note)
- intz_patch_v137.zip            (meny, stil og tidligere moduler)

Steg:
1) Kopier app.js fra denne zip til rot.
2) Dersom du ikke allerede gjorde det: oppdater modules/pi.js og modules/result.js fra v1.3.9.
3) I modules/workout.js, bytt til PI.computeLive() og legg til snitt-stigning per drag (se workout_PATCH_NOTE.txt i v1.3.9-pakken).
4) Hard-reload i nettleseren.
