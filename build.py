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
import re
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
    paras = [l.strip() for l in lines[2:] if l.strip()]
    desc = " ".join(paras)
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
    # a folder named 2026-07-09-something gives the calendar its date
    m = re.match(r"(\d{4}-\d{2}-\d{2})", folder.name)
    return {"title": title, "when": when, "desc": desc, "paras": paras, "slug": folder.name,
            "date": m.group(1) if m else "",
            "photos": [f"/assets/photos/{folder.name}/{p.name}" for p in photos]}


def render(ev, i):
    delay = f' data-delay="{min(i, 5)}"' if i else ""
    n = len(ev["photos"])
    count = "No photos yet" if n == 0 else "1 photo" if n == 1 else f"{n} photos"
    cover = ev["photos"][0] if ev["photos"] else "/assets/photos/blank.svg"
    # every line of event.txt is its own line on the card, nothing is cut off
    lines = "\n".join(f"            <p>{escape(t)}</p>" for t in ev["paras"]) or "            <p></p>"
    date = f' data-date="{ev["date"]}"' if ev["date"] else ""
    return f"""        <a class="gallery-item reveal" href="/events/{ev['slug']}.html"{delay}{date}>
          <div class="ph"><img src="{escape(cover)}" alt="" loading="lazy"></div>
          <div class="body">
            <h3>{escape(ev['title'])}</h3>
            <span class="when">{escape(ev['when'])}</span>
{lines}
            <span class="count">{count}</span>
          </div>
        </a>"""


def page_shell(html):
    """Nav and footer lifted from index.html so event pages always match."""
    nav = html[html.index('<header class="nav">'):html.index("</header>") + len("</header>")]
    foot = html[html.index('<footer class="socials"'):html.index("</footer>") + len("</footer>")]
    head = html[html.index("<head>"):html.index("</head>")]
    # the stylesheet, fonts, icons, and share tags, minus page-specific title, description, canonical
    head_lines = [l for l in head.splitlines()[1:]
                  if not any(k in l for k in ("<title>", 'name="description"', 'rel="canonical"', "og:title", "og:url", "twitter:title"))]
    return nav, foot, "\n".join(head_lines)


def render_event_page(ev, nav, foot, head):
    n = len(ev["photos"])
    if n:
        tiles = "\n".join(
            f'        <button class="photo" type="button" data-index="{i}" data-src="{escape(p)}"><img src="{escape(p)}" alt="" loading="lazy"></button>'
            for i, p in enumerate(ev["photos"]))
        grid = f'      <div class="photo-grid reveal" data-delay="2">\n{tiles}\n      </div>'
    else:
        grid = '      <p class="empty reveal" data-delay="2">No photos yet.</p>'
    paras = "\n".join('        <p%s>%s</p>' % (' class="lede"' if i == 0 else "", escape(t)) for i, t in enumerate(ev["paras"])) \
        or "        <!-- Description goes in event.txt, from line 3 down. -->"
    return f"""<!DOCTYPE html>
<html lang="en-CA">
<head>
  <title>{escape(ev['title'])} · Silly Spaces</title>
  <meta name="description" content="{escape(ev['title'])}, {escape(ev['when'])}. A Silly Spaces event.">
  <link rel="canonical" href="https://sillyspaces.com/events/{ev['slug']}.html">
  <meta property="og:title" content="{escape(ev['title'])} · Silly Spaces">
  <meta property="og:url" content="https://sillyspaces.com/events/{ev['slug']}.html">
  <meta name="twitter:title" content="{escape(ev['title'])} · Silly Spaces">
{head}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>

{nav}

<main id="main">
  <section class="section event-page">
    <div class="wrap">
      <div class="prose">
        <a class="back-link reveal" href="/#past">Back to past events</a>
        <p class="eyebrow reveal">{escape(ev['when'])}</p>
        <h1 class="reveal">{escape(ev['title'])}</h1>
        <div class="reveal" data-delay="1">
{paras}
        </div>
      </div>
{grid}
    </div>
  </section>

  <dialog class="lightbox" id="lightbox" aria-label="Event photos" data-title="{escape(ev['title'])}" data-when="{escape(ev['when'])}" data-desc="{escape(chr(10).join(ev['paras']))}">
    <div class="lb-inner">
      <div class="lb-photos">
        <button class="lb-arrow prev" type="button" aria-label="Previous photo">&#8249;</button>
        <button class="lb-arrow next" type="button" aria-label="Next photo">&#8250;</button>
        <div class="lb-dots"></div>
      </div>
      <div class="lb-text">
        <h3></h3>
        <span class="when"></span>
        <p></p>
      </div>
      <button class="lb-close" type="button" aria-label="Close">&times;</button>
    </div>
  </dialog>
</main>

{foot}

<script src="/js/main.js"></script>
</body>
</html>
"""


def stamp_assets():
    """Put a short hash of style.css and main.js on their URLs in every page,
    so a browser that cached the old file fetches the new one after a deploy."""
    import hashlib
    for f in ["css/style.css", "js/main.js"]:
        h = hashlib.md5((ROOT / f).read_bytes()).hexdigest()[:8]
        for page in list(ROOT.glob("*.html")) + list((ROOT / "events").glob("*.html")):
            t = page.read_text(encoding="utf-8")
            t2 = re.sub(r"(/%s)(\?v=[0-9a-f]+)?\"" % re.escape(f), r"\1?v=%s\"" % h, t)
            if t2 != t:
                page.write_text(t2, encoding="utf-8")
    print("stamped css/js versions into the pages")


def main():
    stamp_assets()
    folders = sorted((d for d in PHOTOS.iterdir() if d.is_dir()), reverse=True)
    events = [e for e in (read_event(d) for d in folders) if e]
    html = INDEX.read_text(encoding="utf-8")
    a, b = html.find(START), html.find(END)
    if a < 0 or b < 0:
        sys.exit("gallery markers not found in index.html")
    block = START + "\n" + "\n".join(render(e, i) for i, e in enumerate(events)) + ("\n" if events else "")
    html = html[:a] + block + html[b:]
    INDEX.write_text(html, encoding="utf-8")
    # one page per event, written fresh each run so removed events disappear
    events_dir = ROOT / "events"
    events_dir.mkdir(exist_ok=True)
    for old in events_dir.glob("*.html"):
        old.unlink()
    nav, foot, head = page_shell(html)
    for e in events:
        (events_dir / f"{e['slug']}.html").write_text(render_event_page(e, nav, foot, head), encoding="utf-8")
    # sitemap lists the pages that exist
    urls = ["https://sillyspaces.com/", "https://sillyspaces.com/about.html"] + [f"https://sillyspaces.com/events/{e['slug']}.html" for e in events]
    (ROOT / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(f"  <url><loc>{u}</loc></url>\n" for u in urls) + "</urlset>\n", encoding="utf-8")
    print(f"wrote {len(events)} event page(s) into events/")
    for e in events:
        print(f"ok    {e['title']}: {len(e['photos'])} photo(s)")
    print(f"wrote {len(events)} event(s) into index.html")


if __name__ == "__main__":
    main()
