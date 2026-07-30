/* DBSA Book Corner — report Worker
 *
 * Receives POSTs from report.html and appends each report to
 * data/reports.json in the dbsa-africa/dbsa-africa.github.io repository,
 * where status.html reads it. No database, nothing to maintain.
 *
 * Deploy (once, ~10 min — full steps in DEPLOY.md):
 *   1. dash.cloudflare.com → Workers & Pages → Create Worker
 *   2. Paste this file over the sample code → Deploy
 *   3. Settings → Variables → Add secret  GITHUB_TOKEN
 *      (GitHub classic PAT with `repo` scope, no expiration, from the
 *       dbsa-africa org owner account)
 *   4. Copy the worker URL into ENDPOINT in report.html, push.
 */

const REPO = "dbsa-africa/dbsa-africa.github.io";
const FILE = "data/reports.json";
const ORIGIN = "https://dbsa-africa.github.io";

const SCHOOLS = [
  "Bilgates School", "Hope Baptist School", "Recada Academy", "Jasil School",
  "Changrong School", "Hanka School", "Happy Star School",
  "Pilot School", "Changqin DBSA School", "Myto Junior Academy",
  "Joy Day Care", "Caso Upendo Academy", "Genesis Joy School",
];

const CORS = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const reply = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });

/* UTF-8-safe base64 (btoa/atob alone mangle non-ASCII notes) */
const b64encode = (str) => {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};
const b64decode = (b64) => {
  const bin = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (req.method !== "POST") return reply({ error: "POST only" }, 405);

    let b;
    try { b = await req.json(); } catch { return reply({ error: "invalid JSON" }, 400); }

    // Honeypot filled → a bot. Pretend success, store nothing.
    if (b.website) return reply({ ok: true });

    const school = String(b.school || "").trim();
    const title = String(b.title || "").trim().slice(0, 200);
    const kind = b.kind === "lost" ? "lost" : b.kind === "damaged" ? "damaged" : null;
    const note = String(b.note || "").trim().slice(0, 500);
    if (!SCHOOLS.includes(school) || title.length < 2 || !kind)
      return reply({ error: "missing or invalid fields" }, 400);

    const rec = {
      t: new Date().toISOString().slice(0, 16).replace("T", " "),
      school, title, kind, note, matched: !!b.matched,
    };

    const api = `https://api.github.com/repos/${REPO}/contents/${FILE}`;
    const ghHeaders = {
      "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "User-Agent": "dbsa-report-worker",
    };

    // Read-append-write with retry, in case two reports land at once.
    for (let attempt = 0; attempt < 4; attempt++) {
      const cur = await fetch(api, { headers: ghHeaders });
      if (!cur.ok) return reply({ error: "storage read failed" }, 502);
      const file = await cur.json();

      let list;
      try { list = JSON.parse(b64decode(file.content)); } catch { list = []; }
      if (!Array.isArray(list)) list = [];
      list.push(rec);

      const put = await fetch(api, {
        method: "PUT",
        headers: ghHeaders,
        body: JSON.stringify({
          message: `report: ${school} — ${title} (${kind})`,
          content: b64encode(JSON.stringify(list, null, 1)),
          sha: file.sha,
        }),
      });
      if (put.ok) return reply({ ok: true });
      if (put.status !== 409) return reply({ error: "storage write failed" }, 502);
      // 409 = the file moved under us; loop re-reads and retries.
    }
    return reply({ error: "busy — please try again" }, 503);
  },
};
