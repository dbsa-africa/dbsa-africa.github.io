#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate one report QR code per partner school.

Each QR opens the site's own report page with the school pre-selected:
    https://dbsa-africa.github.io/report.html?school=<id>

No form links needed — just run:
    python3 gen_qr.py
Requires:  pip3 install qrcode pillow
Print each PNG at 5x5 cm or larger, laminate, stick inside the bookcase door.
"""
import os, sys

BASE = "https://dbsa-africa.github.io/report.html?school="

# ids must match assets/catalog.js
SCHOOLS = {
    "bilgates":     "Bilgates School",
    "hope-baptist": "Hope Baptist School",
    "recada":       "Recada Academy",
    "jasil":        "Jasil School",
    "changrong":    "Changrong School",
    "hanka":        "Hanka School",
    "happy-star":   "Happy Star School",
    "pilot":        "Pilot School",
    "changqin":     "Changqin DBSA School",
    "myto":         "Myto Junior Academy",
    "joy-day":      "Joy Day Care",
    "caso":         "Caso Upendo Academy",
    "genesis-joy":  "Genesis Joy School",
}

def main():
    try:
        import qrcode
    except ImportError:
        sys.exit("Missing dependency - run:  pip3 install qrcode pillow")

    os.makedirs("qr", exist_ok=True)
    for sid, name in SCHOOLS.items():
        img = qrcode.make(BASE + sid, box_size=10, border=3)
        path = f"qr/{sid}.png"
        img.save(path)
        print(f"OK  {path}  ->  {name}")
    print(f"\n{len(SCHOOLS)} QR codes written to ./qr/ - print >=5x5 cm, laminate, "
          "stick inside each bookcase door.")

if __name__ == "__main__":
    main()
