/* DBSA report Worker — Book Corner + School Furniture
 *
 * Receives POSTs from report.html (books) and furniture-report.html
 * (programme:"furniture") and appends each report to the matching JSON file
 * in the dbsa-africa/dbsa-africa.github.io repository, where the status
 * boards read it. No database, nothing to maintain.
 *
 * Deploy (full steps in DEPLOY.md):
 *   1. dash.cloudflare.com → Workers & Pages → the `dbsa-report` Worker
 *   2. Edit code → paste this file over the old code → Deploy
 *   3. Secrets (Settings → Variables and Secrets):
 *        GITHUB_TOKEN — GitHub classic PAT, `repo` scope, no expiration
 *        REPORT_KEY   — QR signing passphrase (same one gen_qr.py uses)
 */

const REPO = "dbsa-africa/dbsa-africa.github.io";
const ORIGIN = "https://dbsa-africa.github.io";

const PROGRAMMES = {
  books: {
    file: "data/reports.json",
    schools: {
      "bilgates": "Bilgates School", "hope-baptist": "Hope Baptist School",
      "recada": "Recada Academy", "jasil": "Jasil School",
      "changrong": "Changrong School", "hanka": "Hanka School",
      "happy-star": "Happy Star School", "pilot": "Pilot School",
      "changqin": "Changqin DBSA School", "myto": "Myto Junior Academy",
      "joy-day": "Joy Day Care", "caso": "Caso Upendo Academy",
      "genesis-joy": "Genesis Joy School",
    },
  },
  furniture: {
    file: "data/furniture-reports.json",
    schools: {
      "recada": "Recada Education Center", "hanka": "Hanka DBSA School",
      "shiners-faith": "Shiners Faith Development Centre", "joy-day": "Joy Day Care",
      "excellent-care": "Excellent Care Centre", "kingsway": "Kingsway Educational Center",
      "ben-jos": "Ben-Jos Day Care School", "changqin": "Changqin DBSA School",
      "myto": "Myto Junior Academy", "page-vision": "Page Vision Care Center",
      "caso": "Caso Upendo Academy", "ack-st-agustine": "ACK St. Agustine",
      "changrong": "Changrong Light Center", "baraka": "Baraka Day and Educational Center",
      "valley-view": "Valley View Academy", "hope-baptist": "Hope Baptist Children Center",
      "happy-star": "Happystar Academy", "pilot": "Pilot Educational Day Care Center",
      "breclares": "Breclares Academy", "genesis-joy": "Genesis Joy School",
      "center-of-hope": "Center of Hope and Transformation School",
      "destiny": "Destiny Community School", "bilgates": "Bilgates Education Center",
    },
  },
};
const FURNITURE_ITEMS = ["desk", "board", "chair_s", "chair_m", "chair_b"];

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

/* Per-school QR code: first 10 hex chars of sha256("<REPORT_KEY>:<school id>").
   Shared ids (a school in both programmes) share one code, so one school QR
   family works for both forms — but never for another school. */
async function schoolCode(env, id) {
  const data = new TextEncoder().encode(`${env.REPORT_KEY}:${id}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 10);
}

/* UTF-8-safe base64 */
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

    const prog = b.programme === "furniture" ? "furniture" : "books";
    const P = PROGRAMMES[prog];
    const school = String(b.school || "").trim();
    const kind = ["lost", "damaged", "restored"].includes(b.kind) ? b.kind : null;
    const note = String(b.note || "").trim().slice(0, 500);
    const schoolId = Object.keys(P.schools).find((id) => P.schools[id] === school);
    if (!schoolId || !kind) return reply({ error: "missing or invalid fields" }, 400);

    // Each school may only report through its own QR code.
    if (env.REPORT_KEY) {
      const expected = await schoolCode(env, schoolId);
      if (String(b.k || "") !== expected)
        return reply({ error: "invalid QR code for this school" }, 403);
    }

    const t = new Date().toISOString().slice(0, 16).replace("T", " ");
    let rec, msg;
    if (prog === "furniture") {
      const item = FURNITURE_ITEMS.includes(b.item) ? b.item : null;
      const qty = Math.min(500, Math.max(1, Math.floor(+b.qty || 0)));
      if (!item || !Number.isFinite(qty)) return reply({ error: "missing or invalid fields" }, 400);
      rec = { t, school, item, kind, qty, note };
      msg = `furniture: ${school} — ${qty}× ${item} (${kind})`;
    } else {
      const title = String(b.title || "").trim().slice(0, 200);
      if (title.length < 2) return reply({ error: "missing or invalid fields" }, 400);
      rec = { t, school, title, kind, note, matched: !!b.matched };
      msg = `report: ${school} — ${title} (${kind})`;
    }

    const api = `https://api.github.com/repos/${REPO}/contents/${P.file}`;
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
          message: msg,
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
