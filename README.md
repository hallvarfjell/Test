# INTZ (forsøk 2)

En PWA (Progressive Web App) for planlegging, gjennomføring og evaluering av innendørs treningsøkter (tredemølle). Denne versjonen følger spesifikasjonen i `Master prompt.docx` og er laget for å kunne kjøres direkte fra **GitHub Pages**.

## Hovedfunksjoner
- **Dashboard** med snarveier og enkel økteditor (blokker: oppvarming, intervall med drag+pause, kontinuerlig, nedjogg).
- **Økt-skjerm** (landskap, delt i to kolonner):
  - *YTELSESPANEL* (pulsstortall + fart/stigning + PI)
  - *GRAFPANEL* (15 min puls i rødt, fart i gult, soner som bakgrunn, hvite LT1/LT2-linjer, 30s-slope)
  - *ØKTPANEL* (fase/drag/sett, nedtelling, RPE og merknader for forrige drag, kontrollknapper)
  - *STATISTIKKPANEL* (tid brukt, snittpuls for drag, gjenstående total)
- **Responssimulator**: foreløpig plassholder, åpnes ved trykk på PI.
- **Resultat**: oppsummering av siste økt, liste over drag med RPE/merknader.
- **Statistikk**: enkel sammenligning av flere økter (PI-gjennomsnitt).
- **Logg**: lagring lokalt i nettleser (LocalStorage), vis/slett økter.
- **Innstillinger**: persondata (alder, vekt, HRmax, LT1/LT2, pulssoner) + tema.
- **Bluetooth**: 
  - HR (Heart Rate Service) – fungerer i Chromium-baserte nettlesere over HTTPS.
  - FTMS (tredemølle) **eksperimentelt**: forsøker å lese *Treadmill Data* for fart/stigning. Alltid mulig å justere manuelt.

## Viktige merknader
- Web Bluetooth krever **HTTPS** og brukergest (klikk) for å koble til. GitHub Pages løser HTTPS.
- Støtte er best i **Chrome/Edge (Android/desktop)**. **iOS/Safari** har begrensninger.
- Dersom FTMS-tolkning ikke passer din mølle, bruker du manuelle +/- knapper for fart og stigning.
- Appen er en **SPA** (single-file entry) med ruter via hash (#/...).

## Mappestruktur
```
intz_v2/
  index.html
  app.css
  app.js
  components/
    ui.js, storage.js, graph.js, bt.js, pi.js
  modules/
    dashboard.js, okt.js, sim.js, resultat.js, statistikk.js, innstillinger.js, logg.js
  assets/
    logo.svg
    icons/icon-192.png, icon-512.png
  manifest.webmanifest
  service-worker.js
  README.md
```

## Slik publiserer du på GitHub Pages
1. Opprett et nytt repo (f.eks. `intz`).
2. Last opp alle filene i `intz_v2/` til rot av repoet.
3. Gå til **Settings → Pages** og velg *Deploy from branch*, branch `main`, folder `/root`.
4. Vent til Pages bygg er ferdig. Åpne URL-en (https://brukernavn.github.io/intz/).
5. Første gang: trykk på ❤ for å koble HR, 🏃‍♂️ for tredemølle (valgfritt).

## Videre arbeid (klar for iterasjon)
- Økteditor: seriepauser automatisk mellom sett; flere sett; presis tidslinje og "legg til/kopier serie".
- Responssimulator: avansert PI i tråd med dine kalibreringskrav (LT1/LT2, eksponentiell intensitet, straffefunksjon, osv.).
- Resultat: fulle grafer for hele økt, eksport (TCX/CSV/JSON), redigerbar fart/stigning i etterkant.
- Statistikk: filtring på økttype (f.eks. 6x6) og visualisering per drag.

## Personvern
- Data lagres kun lokalt i nettleseren. Bluetooth-tilkobling og sensordata deles ikke ut.

---
Lykke til!
