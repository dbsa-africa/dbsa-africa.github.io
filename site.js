/* DBSA site shared script
   - catalog modal + search (bookcorner)
   - scroll reveal
   - i18n scaffold: all UI strings live in I18N.en; adding a "zh" dict
     and setting <html data-lang="zh"> is all a future bilingual toggle needs. */

const I18N = {
  en: {
    searchPlaceholder: "Search this school's book list…",
    booksDonated: "books donated",
    books: "books",
    joined: "Joined",
    copies: "Copies",
    title: "Title",
    level: "Level",
    noResults: "No matching titles.",
  },
  // zh: {…}  ← future one-click Chinese UI goes here
};
const LANG = document.documentElement.dataset.lang || "en";
const t = (k) => (I18N[LANG] && I18N[LANG][k]) || I18N.en[k] || k;

/* ---------- scroll reveal ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("in")),
    { threshold: 0.08 }
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
});

/* ---------- catalog (bookcorner page) ---------- */
function initCatalog() {
  if (typeof CATALOG === "undefined") return;
  const grids = { 2025: document.getElementById("schools-2025"), 2026: document.getElementById("schools-2026") };
  CATALOG.schools.forEach((s) => {
    const btn = document.createElement("button");
    btn.className = "school";
    btn.setAttribute("aria-haspopup", "dialog");
    btn.innerHTML =
      `<span class="n">${s.books.toLocaleString()}<em>${t("books")}</em></span>` +
      `<b>${s.name}</b>` +
      `<span>${t("joined")} ${s.cohort}</span>`;
    btn.addEventListener("click", () => openCatalog(s));
    (grids[s.cohort] || grids[2026]).appendChild(btn);
  });

  const modal = document.getElementById("catalog-modal");
  modal.querySelector(".veil").addEventListener("click", closeCatalog);
  modal.querySelector(".close").addEventListener("click", closeCatalog);
  document.addEventListener("keydown", (e) => e.key === "Escape" && closeCatalog());
  modal.querySelector(".search input").addEventListener("input", (e) => renderRows(e.target.value));
}

let currentSchool = null;
function openCatalog(s) {
  currentSchool = s;
  const m = document.getElementById("catalog-modal");
  m.querySelector("h3").textContent = s.name;
  m.querySelector(".meta").textContent =
    `${t("joined")} ${s.cohort} · ${s.books.toLocaleString()} ${t("booksDonated")}`;
  const input = m.querySelector(".search input");
  input.value = "";
  input.placeholder = t("searchPlaceholder");
  renderRows("");
  m.classList.add("open");
  document.body.style.overflow = "hidden";
  m.querySelector(".close").focus();
}
function closeCatalog() {
  document.getElementById("catalog-modal").classList.remove("open");
  document.body.style.overflow = "";
}
function renderRows(q) {
  if (!currentSchool) return;
  const tbody = document.querySelector("#catalog-modal tbody");
  const needle = q.trim().toLowerCase();
  const rows = currentSchool.items.filter((it) => !needle || it[0].toLowerCase().includes(needle));
  tbody.innerHTML =
    rows.map((it) =>
      `<tr><td>${escapeHtml(it[0])}</td><td>${escapeHtml(it[1] || "—")}</td><td class="num">${it[2]}</td></tr>`
    ).join("") ||
    `<tr><td colspan="3" style="color:var(--muted)">${t("noResults")}</td></tr>`;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- fuzzy title matching (report autocomplete + restock board) ---------- */
function normTxt(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function fuzzyScore(q, title) {
  q = normTxt(q); const t = normTxt(title);
  if (!q || !t) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 90;
  if (t.includes(q)) return 70;
  const qw = q.split(" "), tw = t.split(" ");
  let hit = 0;
  for (const w of qw) if (tw.some((x) => x.startsWith(w))) hit++;
  if (hit === qw.length) return 60 + Math.min(9, qw.length * 2);
  return hit ? Math.round((30 * hit) / qw.length) : 0;
}
/* items: [[title, level, copies], …] → top matches [[title, level, copies], …] */
function fuzzySuggest(items, q, limit) {
  return items
    .map((it) => [fuzzyScore(q, it[0]), it])
    .filter(([s]) => s >= 30)
    .sort((a, b) => b[0] - a[0] || a[1][0].localeCompare(b[1][0]))
    .slice(0, limit || 8)
    .map(([, it]) => it);
}
function fuzzyBest(items, q) {
  let best = null, bs = 0;
  for (const it of items) {
    const s = fuzzyScore(q, it[0]);
    if (s > bs) { bs = s; best = it; }
  }
  return bs >= 60 ? best : null;
}

/* ---------- status dashboard (status page) ---------- */
/* Reads data/reports.json written by the report Worker. Each record:
   { t: "2026-08-12 10:14", school, title, kind: "lost"|"damaged", note, matched } */
async function initStatus(dataUrl, sampleRows) {
  let rows = null, live = false;
  if (dataUrl) {
    try {
      const res = await fetch(dataUrl, { cache: "no-store" });
      if (res.ok) {
        const j = await res.json();
        if (Array.isArray(j)) { rows = j; live = true; }
      }
    } catch (_) { /* fall through to sample */ }
  }
  if (!rows) rows = sampleRows;
  document.getElementById("live-note").hidden = live;
  const empty = document.getElementById("empty-note");
  if (empty) empty.hidden = !(live && rows.length === 0);
  renderStatus(rows);
}
function renderStatus(rows) {
  const bySchool = {};
  let lost = 0, damaged = 0;
  rows.forEach((r) => {
    const school = (r.school || "Unknown").trim();
    r.kind === "lost" ? lost++ : damaged++;
    (bySchool[school] = bySchool[school] || { lost: 0, damaged: 0 })[r.kind === "lost" ? "lost" : "damaged"]++;
  });
  document.getElementById("sum-total").textContent = rows.length;
  document.getElementById("sum-lost").textContent = lost;
  document.getElementById("sum-damaged").textContent = damaged;
  document.getElementById("sum-schools").textContent = Object.keys(bySchool).length;

  const board = document.getElementById("by-school");
  board.innerHTML = Object.entries(bySchool)
    .sort((a, b) => (b[1].lost + b[1].damaged) - (a[1].lost + a[1].damaged))
    .map(([name, v]) =>
      `<div class="cell"><b>${v.lost + v.damaged}</b><span>${escapeHtml(name)} — ${v.lost} lost · ${v.damaged} damaged</span></div>`
    ).join("") || `<div class="cell"><b>0</b><span>No reports yet</span></div>`;

  renderRestock(rows);

  const tbody = document.querySelector("table.reports:not(.restock) tbody");
  tbody.innerHTML = rows.slice(-30).reverse().map((r) =>
    `<tr><td>${escapeHtml(r.t || "")}</td><td>${escapeHtml(r.school || "")}</td><td>${escapeHtml(r.title || "")}</td>` +
    `<td><span class="pill ${r.kind === "lost" ? "lost" : "damaged"}">${r.kind === "lost" ? "Lost" : "Damaged"}</span></td>` +
    `<td>${escapeHtml(r.note || "")}</td></tr>`
  ).join("") || `<tr><td colspan="5" style="color:var(--muted)">No reports yet.</td></tr>`;
}
/* Match every reported title against that school's donation list and
   aggregate into a restock shopping list. */
function renderRestock(rows) {
  const tbody = document.querySelector("table.restock tbody");
  if (!tbody || typeof CATALOG === "undefined") return;
  const agg = new Map(); // school ¦ title → entry
  rows.forEach((r) => {
    const school = CATALOG.schools.find((s) => s.name === (r.school || "").trim());
    const hit = school ? (r.matched
      ? school.items.find((it) => it[0] === r.title) || fuzzyBest(school.items, r.title || "")
      : fuzzyBest(school.items, r.title || "")) : null;
    const title = hit ? hit[0] : (r.title || "").trim();
    const key = (r.school || "?") + "¦" + normTxt(title);
    const e = agg.get(key) || { school: r.school || "?", title, level: hit ? hit[1] : "", matched: !!hit, lost: 0, damaged: 0 };
    r.kind === "lost" ? e.lost++ : e.damaged++;
    agg.set(key, e);
  });
  const list = [...agg.values()].sort((a, b) =>
    a.school.localeCompare(b.school) || (b.lost + b.damaged) - (a.lost + a.damaged));
  tbody.innerHTML = list.map((e) =>
    `<tr><td>${escapeHtml(e.school)}</td>` +
    `<td>${escapeHtml(e.title)}${e.matched ? "" : ' <span class="badge">not in catalogue</span>'}</td>` +
    `<td>${escapeHtml(e.level || "—")}</td>` +
    `<td class="num">${e.lost} lost · ${e.damaged} damaged</td>` +
    `<td class="num"><b>${e.lost + e.damaged}</b></td></tr>`
  ).join("") || `<tr><td colspan="5" style="color:var(--muted)">Nothing to restock yet.</td></tr>`;
}
