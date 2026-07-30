#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate one pre-filled report QR code per partner school.

Usage:
    python3 gen_qr.py "<prefilled form link for the FIRST school>"

Take the link from Google Forms:  ⋮  → "Get pre-filled link" → pick any school
→ generate → copy. The script swaps the school name to produce all 13 QR PNGs
in ./qr/ .  Requires:  pip3 install qrcode pillow
"""
import sys, os, re, urllib.parse

SCHOOLS = [
    "Pilot School", "Changqin DBSA School", "Myto Junior Academy", "Joy Day Care",
    "Caso Upendo Academy", "Genesis Joy School", "Bilgates School", "Hope Baptist School",
    "Recada Academy", "Jasil School", "Changrong School", "Hanka School", "Happy Star School",
]

def main():
    if len(sys.argv) < 2:
        sys.exit("Usage: python3 gen_qr.py \"<prefilled form link>\"  (see DEPLOY.md step 5)")
    template = sys.argv[1]

    # find which school name the template carries, and its entry parameter
    parsed = urllib.parse.urlparse(template)
    qs = urllib.parse.parse_qs(parsed.query)
    entry_key = next((k for k, v in qs.items() if k.startswith("entry.") and v and v[0] in SCHOOLS), None)
    if not entry_key:
        sys.exit("Could not find a school name in the link — make sure you picked a School "
                 "when creating the pre-filled link, and quote the URL.")

    try:
        import qrcode
    except ImportError:
        sys.exit("Missing dependency — run:  pip3 install qrcode pillow")

    os.makedirs("qr", exist_ok=True)
    for name in SCHOOLS:
        qs2 = {k: (v[:] if k != entry_key else [name]) for k, v in qs.items()}
        url = urllib.parse.urlunparse(parsed._replace(query=urllib.parse.urlencode(qs2, doseq=True)))
        img = qrcode.make(url, box_size=10, border=3)
        slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        path = f"qr/{slug}.png"
        img.save(path)
        print(f"OK  {path}")
    print(f"\n{len(SCHOOLS)} QR codes written to ./qr/ — print ≥5×5 cm, laminate, "
          "stick inside each bookcase door.")

if __name__ == "__main__":
    main()
