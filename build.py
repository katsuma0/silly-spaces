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

Nothing outside the gallery markers in index.html is touched.
"""
from html import escape
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
PHOTOS = ROOT / "assets" / "photos"
INDEX = ROOT / "index.html"
START = "        <!-- gallery:start -->"
END = "        <!-- gallery:end -->"
# Browsers can show these. HEIC from an iPhone is not on the list on purpose.
IMAGE_TYPES = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif"}


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
    skipped = [p.name for p in folder.iterdir() if p.is_file() and p.suffix.lower() == ".heic"]
    if skipped:
        print(f"note  {folder.name}: {len(skipped)} HEIC file(s) ignored, convert them to JPG")
    if not photos:
        print(f"skip  {folder.name}: no photos")
        return None
    return {"title": title, "when": when, "desc": desc,
            "photos": [f"/assets/photos/{folder.name}/{p.name}" for p in photos]}


def render(ev, i):
    delay = f' data-delay="{min(i, 5)}"' if i else ""
    n = len(ev["photos"])
    count = "1 photo" if n == 1 else f"{n} photos"
    return f"""        <button class="gallery-item reveal" type="button"{delay} data-photos="{escape(','.join(ev['photos']))}" data-desc="{escape(ev['desc'])}">
          <div class="ph"><img src="{escape(ev['photos'][0])}" alt="" loading="lazy"></div>
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
