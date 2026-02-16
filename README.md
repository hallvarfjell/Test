# INTZ Basic

En nedstrippet, robust PWA for intervalltrening med fokus på kjernefunksjoner og stabilitet. Laget for Samsung Galaxy Tab S9 i liggende format, lyst tema og med Web Bluetooth for puls (HR) og valgfritt FTMS (tredemølle). Ingen service worker for å unngå cache-problemer – kjør direkte fra GitHub Pages.

## Moduler
- **Dashboard**: forhåndsdefinerte økter (6x6, 8x6, 6x5, 3x10x45/15, Egendefinert). Play (▶) starter økta, ✎ åpner editor. 
- **Editor**: bygg økter (Oppvarming, Intervall (reps, arbeid, pause), Serie (serier, reps, 45/15 osv med serierest), Pause, Nedjogg).
- **Økt**: stor visning for puls/fart/stigning, HR+Speed graf (15 min), LT1/LT2, nåværende + neste 2 faser, stor nedtelling, statistikk (snitt HR/fart for drag, distanse, totaltid, dragtid, gjenstående, klokkeslett) og tid-i-sone stolpediagram.
- **Innstillinger**: vekt, HRmax, LT1/LT2, pulssoner (redigerbare grenser).
- **Logg**: enkel oversikt over lagrede økter.

## Viktig
- Web Bluetooth (HR/FTMS) krever **HTTPS** og fungerer best i Chrome/Edge på Android/desktop.
- FTMS er **valgfritt**. Manuell ± for fart og stigning er alltid tilgjengelig. Under pauser settes beregnet fart til 0 (selv om mølla går).
- **Skjermlås**: bruk ☀️ for å aktivere Wake Lock (der støttet) slik at skjermen holder seg på.

## Publisering
1. Opprett et tomt GitHub-repo (f.eks. `intz-basic`).
2. Last opp filene fra `intz_basic/` til rot av repoet.
3. I **Settings → Pages**: *Deploy from branch*, branch `main`, folder `/root`.
4. Åpne `https://<bruker>.github.io/intz-basic/`.

Lykke til!
