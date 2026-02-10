# INTZ

Denne versjonen bruker **ES‑moduler** og må åpnes over **HTTP/HTTPS** (ikke `file://`).

## Kjør lokalt
- Python: `python -m http.server 8000` (åpne `http://localhost:8000`)
- Node: `npx serve .` eller `npx http-server .`
- VS Code: «Live Server»‑utvidelse

## GitHub Pages
Last opp alle filer i repoets rot. I Settings → Pages: Deploy from branch → `main` /root.

## Viktig
- `sw.js` bruker **relative** stier og funker under `/<bruker>.github.io/<repo>/`.
- `manifest.webmanifest` har `start_url: "./"`.
