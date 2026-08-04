#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Regenerate the 2026 school entries in assets/catalog.js from the
actual-allocation workbook (source of truth for what reached each school).

Usage:
    python3 tools/gen_catalog.py "<path to Book Allocation 2026.xlsx>"

- 2025 school entries in assets/catalog.js are left untouched.
- 2026 items become [title, level, copies, from, to] with the school's
  numbering prefix stored on the school ("prefix": "PIL" etc.), so the
  report form can match books by code (e.g. PIL-023) as well as by title.
- Re-run after every new batch (Batch 2 numbering continues: PIL-182, ...).
Requires: pip3 install openpyxl
"""
import json, re, sys

SHEETS = {  # sheet name -> (site school id, numbering prefix)
    "PIL_Pilot":      ("pilot",       "PIL"),
    "CQ_Changqin":    ("changqin",    "CQ"),
    "MT_MYTO":        ("myto",        "MT"),
    "JD_JoyDay":      ("joy-day",     "JD"),
    "CAS_CASO":       ("caso",        "CAS"),
    "GEN_GenesisJoy": ("genesis-joy", "GEN"),
}
CATALOG_JS = "assets/catalog.js"
RANGE = re.compile(r"([A-Z]+)-(\d+)")

def parse_sheet(ws, pfx):
    items = []
    for row in ws.iter_rows(min_row=4, values_only=True):
        num, title, level, copies, numbering = row[0], row[1], row[2], row[3], row[4]
        if title is None or copies is None or not str(num).strip().isdigit():
            continue
        title = str(title).replace("\U0001F4DA", "").strip()
        copies = int(copies)
        codes = RANGE.findall(str(numbering or ""))
        assert codes, f"{pfx}: no numbering for {title!r}"
        assert all(p == pfx for p, _ in codes), f"{pfx}: wrong prefix in {numbering!r}"
        nums = [int(n) for _, n in codes]
        frm, to = min(nums), max(nums)
        assert to - frm + 1 == copies, f"{pfx} {title!r}: copies={copies} != range {frm}-{to}"
        items.append([title, str(level or "").strip(), copies, frm, to])
    return items

def main():
    if len(sys.argv) < 2:
        sys.exit("Usage: python3 tools/gen_catalog.py \"<Book Allocation xlsx>\"")
    import openpyxl
    wb = openpyxl.load_workbook(sys.argv[1], data_only=True)

    src = open(CATALOG_JS, encoding="utf-8").read()
    catalog = json.loads(src[src.index("{"): src.rindex("}") + 1])
    by_id = {s["id"]: s for s in catalog["schools"]}

    for sheet, (sid, pfx) in SHEETS.items():
        items = parse_sheet(wb[sheet], pfx)
        s = by_id[sid]
        s["prefix"] = pfx
        s["items"] = items
        s["books"] = sum(i[2] for i in items)
        s["titles"] = len(items)
        # ranges must not overlap
        spans = sorted((i[3], i[4]) for i in items)
        for (a, b), (c, d) in zip(spans, spans[1:]):
            assert c > b, f"{pfx}: overlapping ranges {a}-{b} / {c}-{d}"
        print(f"{sid:12s} {pfx:4s} {s['books']:4d} books, {s['titles']} titles")

    total = sum(s["books"] for s in catalog["schools"])
    out = ("// Auto-generated from procurement & donation records - do not edit by hand\n"
           "// 2026 entries: Book Allocation 2026.xlsx (actual delivered stock, numbered)\n"
           f"// Total books across all schools: {total}\n"
           "const CATALOG = " + json.dumps(catalog, ensure_ascii=False) + ";\n")
    open(CATALOG_JS, "w", encoding="utf-8").write(out)
    print(f"\nTOTAL {total} books -> {CATALOG_JS}")

if __name__ == "__main__":
    main()
