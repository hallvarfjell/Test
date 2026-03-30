// ============================================================================
// INTZ v11 – views/help.js
//
// Enkel modul som viser hjelpeteksten fra tidligere help.html.
// Ingen interaktiv logikk – kun statisk informasjon.
// ============================================================================

export function onShow() {
  const root = document.getElementById("view-help");
  if (!root._intzInit) {
    buildDOM(root);
    root._intzInit = true;
  }
}

// ============================================================================
// BUILD DOM
// ============================================================================

function buildDOM(root) {
  root.innerHTML = `
    <section class="leftcol">

      <div class="card">
        <details>
          <summary style="cursor:pointer"><strong>Om TSS i INTZ</strong> (trykk for å utvide)</summary>
          <div class="small" style="white-space:pre-wrap;margin-top:8px">
I denne versjonen beregnes TSS direkte fra puls, slik at du kan få en robust belastningsmåling uten å sette FTP.

Formel:
TSS = 100 · ∫ (HR / LTHR)² · dt / 3600

→ Én time på LTHR ≈ 100 TSS.
→ Over LTHR øker belastningen kvadratisk, under synker den.

For å få korrekte TSS‑tall må du sette:
• LT2 (LTHR): Innstillinger → LT2 (bpm)

Powermodell (K og C_run) påvirker ikke TSS,
men brukes til watt‑estimatene i økta.

Fremtidige muligheter:
• rTSS (tempo‑basert)
• Power‑TSS dersom mølle/footpod gir pålitelig watt
• Bannister TRIMP som alternativ
          </div>
        </details>
      </div>

      <div class="card">
        <details>
          <summary style="cursor:pointer"><strong>RPE 1–10 forklart</strong> (trykk for å utvide)</summary>
          <div class="small" style="white-space:pre-wrap;margin-top:8px">
RPE 1 – Ingen anstrengelse
Full hvile. Puls omtrent som i hvile.

RPE 2 – Svært lett
Rolig bevegelse. Kan prate i hele setninger.

RPE 3 – Lett
Behagelig. Lett jogg / restitusjon.

RPE 4 – Moderat
Du merker at du jobber. Samtale i korte setninger.

RPE 5 – Middels / kontrollert hard
Krevende men stabilt. Noe over komfort.

RPE 6 – Moderat hard
Langkjøring rundt aerob terskel. Bare korte ord.

RPE 7 – Hard
Krevende intervaller (3–8 min drag).

RPE 8 – Svært hard
Nær maks for korte drag (1–3 min).

RPE 9 – Nesten maksimal
Svært ubehagelig. Korte sprinter (20–60 s).

RPE 10 – Maksimal innsats
Full sprint. Varer kun noen sekunder.
          </div>
        </details>
      </div>

    </section>
  `;
}
