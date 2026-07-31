# dbsa-africa.github.io

Official website of **DBSA — Dream Building Service Association** (造梦公益).
Live at **https://dbsa-africa.github.io**

- `index.html` — organisation home
- `bookcorner.html` / `furniture.html` — programme pages (Africa Dream Campus Project)
- `report.html` / `furniture-report.html` — bilingual QR-locked report forms for partner schools
- `status.html` / `furniture-status.html` — management boards with restock / repair lists (unlisted)
- `worker.js` — one Cloudflare Worker stores both report streams into `data/*.json` (see DEPLOY.md)
- `assets/catalog.js` / `assets/furniture.js` — per-school donation records, generated from procurement documents
- `gen_qr.py` — generates both sets of per-school report QR cards
- **`DEPLOY.md` — how to update, deploy, and hand over. Start there.**

Static site, no build step: edit → commit → push, GitHub Pages does the rest.
