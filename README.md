# INTZ

En webapp for planlegging, gjennomføring og evaluering av innendørs intervalltrening på mølle.

## Funksjoner (MVP)
- **Dashboard** med hurtigstart av økter og tilgang til økteditor.
- **Økteditor** for å bygge økter med oppvarming, intervaller, seriepauser, kontinuerlige segmenter og nedjogg.
- **Øktskjerm** med fire paneler: sensordata (puls, fart, stigning, PI), sanntidsgraf (puls + fart 15 min), status/RPE/merknader, og styringsknapper/tidsstatistikk.
- **Responssimulator** (placeholder) – åpnes i egen side, med knapp for å gå tilbake til pågående økt.
- **Resultater** med grafer, tid i pulssoner og redigerbare verdier i etterkant.
- **Innstillinger** for pulssoner, alder, vekt, VO₂max, LT1/LT2 og maxpuls.
- **Logg** over økter med filtrering, visning og eksport (TCX).
- **PWA**: offline-støtte (Service Worker) og installasjon via manifest.
- **Web Bluetooth**: tilkobling mot Heart Rate Service (0x180D) og (best-effort) Fitness Machine Service (0x1826) for tredemølledata. Fallback til manuelle +/−-kontroller.

> ⚠️ **Ansvarsfraskrivelse**: Bruk på eget ansvar. Ikke forsøk å styre tredemølle automatisk. Appen er laget for *lesing av data* og manuell kontroll av fart/stigning. Verifiser alltid at Web Bluetooth er støttet i din nettleser/enhet.

## Kom i gang (GitHub Pages)
1. Opprett et nytt repo på GitHub, f.eks. `hallvar/INTZ`.
2. Last opp filene i denne mappen til repoet (drag & drop i GitHub UI går fint).
3. Aktiver **Settings → Pages → Deploy from branch** (branch: `main`, folder: `/root`).
4. Åpne URLen som GitHub Pages viser (typisk `https://brukernavn.github.io/INTZ/`).

## Lokal kjøring
Du kan også åpne `index.html` direkte i en nettleser. For PWA/offline og Web Bluetooth er det anbefalt å kjøre via HTTPS (GitHub Pages løser dette).

## Tastatursnarveier
- **Space**: Start/Pause økt
- **S**: Stopp og lagre økt
- **Pil opp/ned**: Øk/reduser fart
- **Pil høyre/venstre**: Øk/reduser stigning

## Lisens
MIT
