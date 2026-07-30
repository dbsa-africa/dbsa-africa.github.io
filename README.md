# dbsa-africa.github.io

Official website of **DBSA — Dream Building Service Association** (造梦公益).
Live at **https://dbsa-africa.github.io**

- `index.html` — organisation home
- `bookcorner.html` — Book Corner Programme (Africa Dream Campus Project)
- `report.html` — bilingual loss/damage report form for partner schools (book-title autocomplete per school)
- `status.html` — loss & damage board with restock suggestions (unlisted; shared with the team and partners)
- `worker.js` — Cloudflare Worker that stores reports into `data/reports.json` (deploy once, see DEPLOY.md)
- `assets/catalog.js` — per-school donation catalogue, generated from procurement records
- `gen_qr.py` — generates per-school report QR codes
- **`DEPLOY.md` — how to update, deploy, and hand over. Start there.**

Static site, no build step: edit → commit → push, GitHub Pages does the rest.
