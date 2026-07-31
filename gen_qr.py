#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate report QR cards for both programmes.

Book Corner  -> qr/books/<id>.png      (report.html?school=<id>&k=<code>)
Furniture    -> qr/furniture/<id>.png  (furniture-report.html?school=<id>&k=<code>)

Usage:
    python3 gen_qr.py "<REPORT_KEY>"

<REPORT_KEY> must be EXACTLY the passphrase stored as the REPORT_KEY secret
on the Cloudflare Worker (DEPLOY.md). Do NOT commit the passphrase or the
generated PNGs (qr/ is gitignored - the codes inside are the keys).
A school that is in both programmes shares one code, so its two QR cards
both work - but only for that school.
Requires:  pip3 install qrcode pillow
Print each card at 6x7 cm or larger, laminate.
"""
import hashlib, os, sys

SITE = "https://dbsa-africa.github.io"

BOOK_SCHOOLS = {
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

FURNITURE_SCHOOLS = {
    "recada":          "Recada Education Center",
    "hanka":           "Hanka DBSA School",
    "shiners-faith":   "Shiners Faith Development Centre",
    "joy-day":         "Joy Day Care",
    "excellent-care":  "Excellent Care Centre",
    "kingsway":        "Kingsway Educational Center",
    "ben-jos":         "Ben-Jos Day Care School",
    "changqin":        "Changqin DBSA School",
    "myto":            "Myto Junior Academy",
    "page-vision":     "Page Vision Care Center",
    "caso":            "Caso Upendo Academy",
    "ack-st-agustine": "ACK St. Agustine",
    "changrong":       "Changrong Light Center",
    "baraka":          "Baraka Day and Educational Center",
    "valley-view":     "Valley View Academy",
    "hope-baptist":    "Hope Baptist Children Center",
    "happy-star":      "Happystar Academy",
    "pilot":           "Pilot Educational Day Care Center",
    "breclares":       "Breclares Academy",
    "genesis-joy":     "Genesis Joy School",
    "center-of-hope":  "Center of Hope and Transformation School",
    "destiny":         "Destiny Community School",
    "bilgates":        "Bilgates Education Center",
}

PROGRAMMES = [
    ("books",     "report.html",           BOOK_SCHOOLS,      "DBSA Book Corner - scan to report a book"),
    ("furniture", "furniture-report.html", FURNITURE_SCHOOLS, "DBSA Desks & Chairs - scan to report an item"),
]

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

def make_card(qr_img, name, caption):
    """QR on top, school name + caption underneath - print-ready."""
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
    band = size + 15 + 34
    card = Image.new("RGB", (W, qr.height + band), "white")
    card.paste(qr, (0, 0))
    d = ImageDraw.Draw(card)
    y = qr.height - 8
    d.text(((W - d.textlength(name, font=font)) / 2, y), name, font=font, fill=(20, 22, 26))
    d.text(((W - d.textlength(caption, font=sub_font)) / 2, y + size + 10), caption, font=sub_font, fill=(120, 126, 133))
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

    total = 0
    for prog, page, schools, caption in PROGRAMMES:
        outdir = f"qr/{prog}"
        os.makedirs(outdir, exist_ok=True)
        for sid, name in schools.items():
            url = f"{SITE}/{page}?school={sid}&k={code(key, sid)}"
            img = qrcode.make(url, box_size=10, border=3)
            make_card(img, name, caption).save(f"{outdir}/{sid}.png")
            print(f"OK  {outdir}/{sid}.png  ->  {name}")
            total += 1
    print(f"\n{total} QR cards written to qr/books/ and qr/furniture/ - "
          "print >=6x7 cm, laminate.")

if __name__ == "__main__":
    main()
