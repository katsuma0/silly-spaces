#!/usr/bin/env python3
"""Rebuild the past events gallery in index.html from assets/photos/.

Each past event is one folder under assets/photos/. Paste photos into it and
add an event.txt beside them:

    line 1   title
    line 2   date, any wording you like
    rest     description, as many lines as you want

Folders are listed newest first, so start the folder name with the date,
for example 2026-06-14-soccer. Photos inside a folder show in filename order
and the first one is the cover. Then run:

    python3 build.py

An event with no photos yet still shows, with a blank cover, so the
description and the join form dropdown pick it up right away.

Photos are also normalised in place: the phone's rotation tag is baked
in, anything over 1600 px on the long edge is shrunk, metadata is
dropped. Needs Pillow (pip install pillow); without it photos are left
as they are.

Nothing outside the gallery markers in index.html is touched.
"""
from html import escape
from pathlib import Path
import sys

try:
    from PIL import Image, ImageOps
except ImportError:  # photos still work, they just stay at whatever size they came in
    Image = None

ROOT = Path(__file__).resolve().parent
PHOTOS = ROOT / "assets" / "photos"
INDEX = ROOT / "index.html"
START = "        <!-- gallery:start -->"
END = "        <!-- gallery:end -->"
# Browsers can show these. HEIC from an iPhone is not on the list on purpose.
IMAGE_TYPES = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif"}
# Every photo is brought to this long edge so they all load and display at
# one scale. Phone photos come in at 4000 px and 4 MB, which is too much.
LONG_EDGE = 1600


def prepare_photo(p):
    """Bake in the phone's rotation tag, shrink to LONG_EDGE, drop metadata.
    Only rewrites the file when something actually needs changing."""
    if Image is None or p.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
        return
    im = Image.open(p)
    rotated = im.getexif().get(274, 1) != 1
    big = max(im.size) > LONG_EDGE
    if not (rotated or big):
        return
    im = ImageOps.exif_transpose(im)
    if big:
        im.thumbnail((LONG_EDGE, LONG_EDGE), Image.LANCZOS)
    if p.suffix.lower() in {".jpg", ".jpeg"}:
        im.convert("RGB").save(p, "JPEG", quality=82, optimize=True)
    else:
        im.save(p, optimize=True)
    print(f"photo {p.parent.name}/{p.name}: {'rotated, ' if rotated else ''}{im.size[0]}x{im.size[1]}, {p.stat().st_size // 1024} KB")


def read_event(folder):
    info = folder / "event.txt"
    if not info.exists():
        print(f"skip  {folder.name}: no event.txt")
        return None
    lines = info.read_text(encoding="utf-8").splitlines()
    title = lines[0].strip() if lines else folder.name
    when = lines[1].strip() if len(lines) > 1 else ""
    desc = " ".join(l.strip() for l in lines[2:] if l.strip())
    photos = sorted(
        p for p in folder.iterdir()
        if p.is_file() and p.suffix.lower() in IMAGE_TYPES
    )
    for p in photos:
        prepare_photo(p)
    skipped = [p.name for p in folder.iterdir() if p.is_file() and p.suffix.lower() == ".heic"]
    if skipped:
        print(f"note  {folder.name}: {len(skipped)} HEIC file(s) ignored, convert them to JPG")
    if not photos:
        print(f"note  {folder.name}: no photos yet, showing a blank cover")
    return {"title": title, "when": when, "desc": desc,
            "photos": [f"/assets/photos/{folder.name}/{p.name}" for p in photos]}


def render(ev, i):
    delay = f' data-delay="{min(i, 5)}"' if i else ""
    n = len(ev["photos"])
    count = "No photos yet" if n == 0 else "1 photo" if n == 1 else f"{n} photos"
    cover = ev["photos"][0] if ev["photos"] else "/assets/photos/blank.svg"
    return f"""        <button class="gallery-item reveal" type="button"{delay} data-photos="{escape(','.join(ev['photos']))}" data-desc="{escape(ev['desc'])}">
          <div class="ph"><img src="{escape(cover)}" alt="" loading="lazy"></div>
          <div class="body">
            <h3>{escape(ev['title'])}</h3>
            <span class="when">{escape(ev['when'])}</span>
            <p>{escape(ev['desc'])}</p>
            <span class="count">{count}</span>
          </div>
        </button>"""


def main():
    folders = sorted((d for d in PHOTOS.iterdir() if d.is_dir()), reverse=True)
    events = [e for e in (read_event(d) for d in folders) if e]
    html = INDEX.read_text(encoding="utf-8")
    a, b = html.find(START), html.find(END)
    if a < 0 or b < 0:
        sys.exit("gallery markers not found in index.html")
    block = START + "\n" + "\n".join(render(e, i) for i, e in enumerate(events)) + ("\n" if events else "")
    INDEX.write_text(html[:a] + block + html[b:], encoding="utf-8")
    for e in events:
        print(f"ok    {e['title']}: {len(e['photos'])} photo(s)")
    print(f"wrote {len(events)} event(s) into index.html")


if __name__ == "__main__":
    main()
