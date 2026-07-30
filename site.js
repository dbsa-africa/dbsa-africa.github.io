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

/* ---------- status dashboard (status page) ---------- */
/* Reads a published-to-web Google Sheet CSV. Columns expected:
   Timestamp, School, Book title or number, Lost or Damaged, Notes, [Photo] */
async function initStatus(csvUrl, sampleRows) {
  let rows = null, live = false;
  if (csvUrl) {
    try {
      const res = await fetch(csvUrl, { cache: "no-store" });
      if (res.ok) { rows = parseCsv(await res.text()); live = true; }
    } catch (_) { /* fall through to sample */ }
  }
  if (!rows) rows = sampleRows;
  document.getElementById("live-note").hidden = live;
  renderStatus(rows);
}
function parseCsv(text) {
  const out = []; let row = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQ = false;
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (cell !== "" || row.length) { row.push(cell); out.push(row); row = []; cell = ""; }
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); out.push(row); }
  return out.slice(1); // drop header
}
function renderStatus(rows) {
  const bySchool = {};
  let lost = 0, damaged = 0;
  rows.forEach((r) => {
    const school = (r[1] || "Unknown").trim();
    const kind = /lost/i.test(r[3] || "") ? "lost" : "damaged";
    kind === "lost" ? lost++ : damaged++;
    (bySchool[school] = bySchool[school] || { lost: 0, damaged: 0 })[kind]++;
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
    ).join("");

  const tbody = document.querySelector("table.reports tbody");
  tbody.innerHTML = rows.slice(-30).reverse().map((r) =>
    `<tr><td>${escapeHtml(r[0] || "")}</td><td>${escapeHtml(r[1] || "")}</td><td>${escapeHtml(r[2] || "")}</td>` +
    `<td><span class="pill ${/lost/i.test(r[3] || "") ? "lost" : "damaged"}">${escapeHtml(r[3] || "")}</span></td>` +
    `<td>${escapeHtml(r[4] || "")}</td></tr>`
  ).join("");
}
