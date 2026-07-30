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
/* Replay the report log over the donation catalogue to derive the current
   state of every copy. Each report moves one copy:
     lost / damaged : good → lost / damaged
     restored       : lost (else damaged) → good
   Titles that can't be matched to the school's list are tracked separately. */
function deriveStates(rows) {
  const states = new Map(); // school name → state
  CATALOG.schools.forEach((s) => {
    states.set(s.name, {
      school: s,
      perTitle: new Map(s.items.map((it) =>
        [normTxt(it[0]), { title: it[0], level: it[1], copies: it[2], lost: 0, damaged: 0, unmatched: false }])),
      extra: new Map(), // reported titles not in the catalogue
    });
  });
  rows.forEach((r) => {
    const st = states.get((r.school || "").trim());
    if (!st) return;
    let entry = null;
    const hit = (r.matched && st.school.items.find((it) => it[0] === r.title)) ||
                fuzzyBest(st.school.items, r.title || "");
    if (hit) entry = st.perTitle.get(normTxt(hit[0]));
    if (!entry) {
      const k = normTxt(r.title || "");
      if (!st.extra.has(k))
        st.extra.set(k, { title: (r.title || "").trim(), level: "", copies: 0, lost: 0, damaged: 0, unmatched: true });
      entry = st.extra.get(k);
    }
    if (r.kind === "restored") {
      if (entry.lost > 0) entry.lost--;
      else if (entry.damaged > 0) entry.damaged--;
    } else if (r.kind === "lost" || r.kind === "damaged") {
      const room = entry.unmatched || entry.lost + entry.damaged < entry.copies;
      if (room) entry[r.kind]++;
    }
  });
  return states;
}
function schoolTotals(st) {
  let lost = 0, damaged = 0;
  st.perTitle.forEach((e) => { lost += e.lost; damaged += e.damaged; });
  st.extra.forEach((e) => { lost += e.lost; damaged += e.damaged; });
  const good = Math.max(0, st.school.books -
    [...st.perTitle.values()].reduce((n, e) => n + e.lost + e.damaged, 0));
  return { good, lost, damaged };
}

function renderStatus(rows) {
  const counts = { lost: 0, damaged: 0, restored: 0 };
  rows.forEach((r) => { if (counts[r.kind] !== undefined) counts[r.kind]++; });
  const states = deriveStates(rows);

  let curLost = 0, curDamaged = 0;
  const reporting = new Set(rows.map((r) => (r.school || "").trim()));
  states.forEach((st) => { const t = schoolTotals(st); curLost += t.lost; curDamaged += t.damaged; });
  document.getElementById("sum-total").textContent = rows.length;
  document.getElementById("sum-lost").textContent = curLost;
  document.getElementById("sum-damaged").textContent = curDamaged;
  document.getElementById("sum-schools").textContent = reporting.size;

  renderSchoolBoard(states);
  renderRestock(states);

  const KIND_PILL = { lost: ["lost", "Lost"], damaged: ["damaged", "Damaged"], restored: ["restored", "Found"] };
  const tbody = document.querySelector("table.reports:not(.restock) tbody");
  tbody.innerHTML = rows.slice(-30).reverse().map((r) => {
    const [cls, label] = KIND_PILL[r.kind] || ["damaged", r.kind];
    return `<tr><td>${escapeHtml(r.t || "")}</td><td>${escapeHtml(r.school || "")}</td><td>${escapeHtml(r.title || "")}</td>` +
      `<td><span class="pill ${cls}">${label}</span></td>` +
      `<td>${escapeHtml(r.note || "")}</td></tr>`;
  }).join("") || `<tr><td colspan="5" style="color:var(--muted)">No reports yet.</td></tr>`;
}

/* Per-school overview cards — tap one to open the full status catalogue. */
function renderSchoolBoard(states) {
  const grid = document.getElementById("school-status");
  if (!grid) return;
  grid.innerHTML = "";
  CATALOG.schools.forEach((s) => {
    const st = states.get(s.name);
    const t = schoolTotals(st);
    const btn = document.createElement("button");
    btn.className = "school";
    btn.setAttribute("aria-haspopup", "dialog");
    btn.innerHTML =
      `<span class="n">${s.books.toLocaleString()}<em>books</em></span>` +
      `<b>${escapeHtml(s.name)}</b>` +
      `<span class="st-line">` +
      `<i class="ok-txt">${t.good} good</i>` +
      (t.lost ? ` · <i class="lost-txt">${t.lost} lost</i>` : "") +
      (t.damaged ? ` · <i class="dmg-txt">${t.damaged} damaged</i>` : "") +
      `</span>`;
    btn.addEventListener("click", () => openStatusModal(st, t));
    grid.appendChild(btn);
  });
}
function openStatusModal(st, tot) {
  const m = document.getElementById("status-modal");
  m.querySelector("h3").textContent = st.school.name;
  m.querySelector(".meta").textContent =
    `${st.school.books.toLocaleString()} books — ${tot.good} good · ${tot.lost} lost · ${tot.damaged} damaged`;
  const input = m.querySelector(".search input");
  input.value = "";
  const rowsAll = [...st.perTitle.values(), ...st.extra.values()];
  const render = (q) => {
    const needle = (q || "").trim().toLowerCase();
    const rows = rowsAll.filter((e) => !needle || e.title.toLowerCase().includes(needle));
    m.querySelector("tbody").innerHTML = rows.map((e) => {
      const good = e.unmatched ? 0 : Math.max(0, e.copies - e.lost - e.damaged);
      const chips = e.unmatched
        ? `${statusChips(e)} <span class="badge">not in catalogue</span>`
        : (e.lost || e.damaged)
          ? `<span class="chip-st good">${good} good</span>${statusChips(e)}`
          : `<span class="chip-st allgood">all good</span>`;
      return `<tr><td>${escapeHtml(e.title)}</td><td>${escapeHtml(e.level || "—")}</td>` +
        `<td class="num">${e.unmatched ? "—" : e.copies}</td><td>${chips}</td></tr>`;
    }).join("") || `<tr><td colspan="4" style="color:var(--muted)">${t("noResults")}</td></tr>`;
  };
  input.oninput = (e) => render(e.target.value);
  render("");
  m.classList.add("open");
  document.body.style.overflow = "hidden";
  m.querySelector(".close").focus();
}
function statusChips(e) {
  return (e.lost ? ` <span class="chip-st lost">${e.lost} lost</span>` : "") +
         (e.damaged ? ` <span class="chip-st damaged">${e.damaged} damaged</span>` : "");
}
function initStatusModal() {
  const m = document.getElementById("status-modal");
  if (!m) return;
  const close = () => { m.classList.remove("open"); document.body.style.overflow = ""; };
  m.querySelector(".veil").addEventListener("click", close);
  m.querySelector(".close").addEventListener("click", close);
  document.addEventListener("keydown", (e) => e.key === "Escape" && close());
}

/* Outstanding (still lost/damaged) copies, aggregated as a shopping list. */
function renderRestock(states) {
  const tbody = document.querySelector("table.restock tbody");
  if (!tbody) return;
  const list = [];
  states.forEach((st) => {
    [...st.perTitle.values(), ...st.extra.values()].forEach((e) => {
      if (e.lost + e.damaged > 0)
        list.push({ school: st.school.name, ...e });
    });
  });
  list.sort((a, b) => a.school.localeCompare(b.school) || (b.lost + b.damaged) - (a.lost + a.damaged));
  tbody.innerHTML = list.map((e) =>
    `<tr><td>${escapeHtml(e.school)}</td>` +
    `<td>${escapeHtml(e.title)}${e.unmatched ? ' <span class="badge">not in catalogue</span>' : ""}</td>` +
    `<td>${escapeHtml(e.level || "—")}</td>` +
    `<td class="num">${e.lost} lost · ${e.damaged} damaged</td>` +
    `<td class="num"><b>${e.lost + e.damaged}</b></td></tr>`
  ).join("") || `<tr><td colspan="5" style="color:var(--muted)">Nothing to restock — every book is on the shelf. 🎉</td></tr>`;
}
