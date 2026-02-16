# INTZ Basic v1.0.2

Kvalitetssikret Øktmodul: faste akseverdier (venstre HR, høyre fart), LT1/LT2 med tekst, større Øktpanel (60% av høyre), stabil TIZ-høyde, og sikrere håndtering av tredemølle (FTMS) vs. manuell fart.

## Viktig
- FTMS: vi oppdaterer fart/stigning **bare hvis verdier faktisk rapporteres**. Manglende felter rapporteres som `null` (overstyrer **ikke** manuell). Manuell justering gir **4 sekunder** midlertidig prioritet over FTMS.
- Pauser: distanseberegning setter fart=0 i pauser, men visningen av fart følger sist gyldige verdi fra manuell/FTMS.

## Publisering
Som tidligere: last opp innholdet i `intz_basic_v102/` til repoet og kjør via GitHub Pages.
