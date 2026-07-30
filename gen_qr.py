#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate one report QR code per partner school.

Each QR opens the site's report page with the school locked in AND a
per-school code the Worker verifies, so a school can only report its own
books:
    https://dbsa-africa.github.io/report.html?school=<id>&k=<code>

Usage:
    python3 gen_qr.py "<REPORT_KEY>"

<REPORT_KEY> must be EXACTLY the same passphrase stored as the REPORT_KEY
secret on the Cloudflare Worker (DEPLOY.md). Do NOT commit the passphrase.
Requires:  pip3 install qrcode pillow
Print each PNG at 5x5 cm or larger, laminate, stick inside the bookcase door.
"""
import hashlib, os, sys

BASE = "https://dbsa-africa.github.io/report.html?school="

# ids must match assets/catalog.js and worker.js
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

def code(key, sid):
    return hashlib.sha256(f"{key}:{sid}".encode()).hexdigest()[:10]

def load_font(size, bold=True):
    from PIL import ImageFont
    names = ["Arial Bold.ttf", "Helvetica.ttc"] if bold else ["Arial.ttf", "Helvetica.ttc"]
    for base in ("/System/Library/Fonts/Supplemental/", "/System/Library/Fonts/", "/Library/Fonts/"):
        for n in names:
            try:
                return ImageFont.truetype(base + n, size)
            except OSError:
                continue
    return ImageFont.load_default()

def make_card(qr_img, name):
    """QR on top, school name + small caption underneath - print-ready."""
    from PIL import Image, ImageDraw
    qr = qr_img.convert("RGB")
    W = qr.width
    size = 34
    font = load_font(size)
    d = ImageDraw.Draw(qr)
    while size > 18 and d.textlength(name, font=font) > W - 36:
        size -= 2
        font = load_font(size)
    sub_font = load_font(15, bold=False)
    sub = "DBSA Book Corner - scan to report a book"
    band = size + 15 + 34
    card = Image.new("RGB", (W, qr.height + band), "white")
    card.paste(qr, (0, 0))
    d = ImageDraw.Draw(card)
    y = qr.height - 8
    d.text(((W - d.textlength(name, font=font)) / 2, y), name, font=font, fill=(20, 22, 26))
    d.text(((W - d.textlength(sub, font=sub_font)) / 2, y + size + 10), sub, font=sub_font, fill=(120, 126, 133))
    return card

def main():
    if len(sys.argv) < 2 or not sys.argv[1].strip():
        sys.exit("Usage: python3 gen_qr.py \"<REPORT_KEY>\"  "
                 "(the same passphrase as the Worker secret - see DEPLOY.md)")
    key = sys.argv[1].strip()
    try:
        import qrcode
    except ImportError:
        sys.exit("Missing dependency - run:  pip3 install qrcode pillow")

    os.makedirs("qr", exist_ok=True)
    for sid, name in SCHOOLS.items():
        url = f"{BASE}{sid}&k={code(key, sid)}"
        img = qrcode.make(url, box_size=10, border=3)
        make_card(img, name).save(f"qr/{sid}.png")
        print(f"OK  qr/{sid}.png  ->  {name}")
    print(f"\n{len(SCHOOLS)} QR codes written to ./qr/ - print >=5x5 cm, laminate, "
          "stick inside each bookcase door.")

if __name__ == "__main__":
    main()
