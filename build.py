#!/usr/bin/env python3
"""Rebuild index.html, the event pages and events.json from the files under assets/.

Past events are one folder each under assets/photos/. Paste photos into it and
add an event.txt beside them:

    line 1   title
    line 2   date, any wording you like
    rest     description, as many lines as you want

Folders are listed newest first, so start the folder name with the date,
for example 2026-06-14-soccer. Photos inside a folder show in filename order
and the first one is the cover.

Upcoming events are one folder each under assets/upcoming/, with an event.txt
and, if there is one, a poster image (poster.jpg, or the first image in the
folder):

    line 1   title
    then     key: value lines, any of date, time, where, tags
    blank line
    rest     description, one paragraph per line

A date written as YYYY-MM-DD shows as "November 8, 2026" and the card hides
itself once the day has passed. Anything else, like ??/??/??, shows as written.

Questions are one file each under assets/questions/, named YYYY-MM-DD.txt with
the question on the first line. The newest shows on the site, all of them go
into the feed. Then run:

    python3 build.py

An event with no photos yet still shows, with a blank cover, so the
description is up right away.

Photos are also normalised in place: the phone's rotation tag is baked
in, anything over 1600 px on the long edge is shrunk, metadata is
dropped. Needs Pillow (pip install pillow); without it photos are left
as they are.

events.json at the repo root is the same data for the app, written fresh
each run. Nothing outside the markers in index.html is touched.
"""
from html import escape
from pathlib import Path
import json
import re
import sys

try:
    from PIL import Image, ImageOps
except ImportError:  # photos still work, they just stay at whatever size they came in
    Image = None

ROOT = Path(__file__).resolve().parent
PHOTOS = ROOT / "assets" / "photos"
UPCOMING = ROOT / "assets" / "upcoming"
QUESTIONS = ROOT / "assets" / "questions"
INDEX = ROOT / "index.html"
FEED = ROOT / "events.json"
SITE = "https://sillyspaces.com"
START = "        <!-- gallery:start -->"
END = "        <!-- gallery:end -->"
UP_START = "        <!-- upcoming:start -->"
UP_END = "        <!-- upcoming:end -->"
Q_START = "          <!-- question:start -->"
Q_END = "          <!-- question:end -->"
# Browsers can show these. HEIC from an iPhone is not on the list on purpose.
IMAGE_TYPES = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif"}
# Every photo is brought to this long edge so they all load and display at
# one scale. Phone photos come in at 4000 px and 4 MB, which is too much.
LONG_EDGE = 1600
# Card covers and grid tiles use a small copy in a thumbs/ folder beside the
# photos, so the homepage and event pages stay light. The viewer uses the full file.
THUMB_EDGE = 800
# Spelled out here rather than taken from strftime, so a build on a machine
# set to another language still writes English dates.
MONTHS = ("January", "February", "March", "April", "May", "June", "July",
          "August", "September", "October", "November", "December")
# The three icons on an upcoming card, the same ones the hand-written card used.
CAL_ICON = '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>'
CLOCK_ICON = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'
PIN_ICON = '<svg viewBox="0 0 24 24"><path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>'


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


def make_thumb(p):
    """Write thumbs/<name>.jpg for a photo when it is missing or older than the photo."""
    if Image is None or p.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
        return None
    t = p.parent / "thumbs" / (p.stem + ".jpg")
    if not t.exists() or t.stat().st_mtime < p.stat().st_mtime:
        t.parent.mkdir(exist_ok=True)
        im = ImageOps.exif_transpose(Image.open(p))
        im.thumbnail((THUMB_EDGE, THUMB_EDGE), Image.LANCZOS)
        im.convert("RGB").save(t, "JPEG", quality=78, optimize=True, progressive=True)
        print(f"thumb {p.parent.name}/thumbs/{t.name}: {t.stat().st_size // 1024} KB")
    return t


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
    def small(p):
        t = make_thumb(p)
        return f"/assets/photos/{folder.name}/thumbs/{t.name}" if t else f"/assets/photos/{folder.name}/{p.name}"
    return {"title": title, "when": when, "desc": desc, "paras": paras, "slug": folder.name,
            "date": m.group(1) if m else "",
            "photos": [f"/assets/photos/{folder.name}/{p.name}" for p in photos],
            "thumbs": [small(p) for p in photos]}


def render(ev, i):
    delay = f' data-delay="{min(i, 5)}"' if i else ""
    n = len(ev["photos"])
    count = "No photos yet" if n == 0 else "1 photo" if n == 1 else f"{n} photos"
    cover = ev["thumbs"][0] if ev["photos"] else "/assets/photos/blank.svg"
    # every line of event.txt is its own line on the card, nothing is cut off
    lines = "\n".join(f"            <p>{escape(t)}</p>" for t in ev["paras"]) or "            <p></p>"
    date = f' data-date="{ev["date"]}"' if ev["date"] else ""
    nophoto = "" if ev["photos"] else " no-photos"
    return f"""        <a class="gallery-item reveal{nophoto}" href="/events/{ev['slug']}.html"{delay}{date}>
          <div class="ph"><img src="{escape(cover)}" alt="" loading="lazy" decoding="async"></div>
          <div class="body">
            <h3>{escape(ev['title'])}</h3>
            <span class="when">{escape(ev['when'])}</span>
{lines}
            <span class="count">{count}</span>
          </div>
        </a>"""


def long_date(text):
    """A YYYY-MM-DD date as "November 8, 2026", or None when the text is anything
    else, so ??/??/?? and the like can show as written."""
    m = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", text)
    if not m:
        return None
    y, mo, d = (int(x) for x in m.groups())
    if not 1 <= mo <= 12 or not 1 <= d <= 31:
        return None
    return f"{MONTHS[mo - 1]} {d}, {y}"


def find_poster(folder):
    """poster.jpg when there is one, otherwise the first image in the folder.
    Shrunk in place the same way photos are, but no thumb: the card shows it whole."""
    images = sorted(p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_TYPES)
    named = folder / "poster.jpg"
    p = named if named.exists() else images[0] if images else None
    if p:
        prepare_photo(p)
    return p


def read_upcoming(folder):
    """One upcoming event from assets/upcoming/<slug>/event.txt. The title is line
    one, key: value lines run until the first blank line, the description is the rest."""
    info = folder / "event.txt"
    if not info.exists():
        print(f"skip  upcoming/{folder.name}: no event.txt")
        return None
    lines = info.read_text(encoding="utf-8").splitlines()
    title = lines[0].strip() if lines else folder.name
    fields, rest = {}, []
    for n, line in enumerate(lines[1:], 1):
        if not line.strip():
            rest = lines[n + 1:]
            break
        m = re.match(r"\s*([A-Za-z]+)\s*:\s*(.*)$", line)
        if m:
            fields[m.group(1).lower()] = m.group(2).strip()
    date = fields.get("date", "")
    poster = find_poster(folder)
    return {"slug": folder.name, "title": title, "date": date,
            "iso": date if long_date(date) else "",
            "when": long_date(date) or date,
            "time": fields.get("time", ""), "where": fields.get("where", ""),
            "tags": [t.strip() for t in fields.get("tags", "").split(",") if t.strip()],
            "paras": [l.strip() for l in rest if l.strip()],
            "poster": f"/assets/upcoming/{folder.name}/{poster.name}" if poster else None}


def sort_upcoming(events):
    """Real dates first and soonest first, then the ones still at ??/??/??, then by name."""
    return sorted(events, key=lambda e: (0, e["iso"], e["slug"]) if e["iso"] else (1, "", e["slug"]))


def render_upcoming(ev, i):
    """One card in the upcoming grid, shaped like the hand-written one it replaces
    so main.js and the calendar keep finding what they look for."""
    # the first card already carried data-delay="1" by hand, so keep the stagger it had
    delay = f' data-delay="{min(i + 1, 3)}"'
    # only a real date gets data-date, which is what hides the card once the day is over
    date = f' data-date="{ev["iso"]}"' if ev["iso"] else ""
    cls = "card wide reveal" if ev["poster"] else "card reveal"
    out = [f'        <article class="{cls}"{delay}{date}>']
    if ev["poster"]:
        out.append(f'          <div class="poster"><img src="{escape(ev["poster"])}" alt="Poster for {escape(ev["title"])}" loading="lazy" decoding="async"></div>')
    out.append('          <div class="body">')
    out.append(f'            <h3>{escape(ev["title"])}</h3>')
    meta = [(icon, text) for icon, text in ((CAL_ICON, ev["when"]), (CLOCK_ICON, ev["time"]), (PIN_ICON, ev["where"])) if text]
    if meta:
        out.append('            <div class="meta">')
        out += [f'              <span>{icon}{escape(text)}</span>' for icon, text in meta]
        out.append('            </div>')
    out += [f'            <p>{escape(t)}</p>' for t in ev["paras"]]
    if ev["tags"]:
        tags = "".join(f'<span class="tag{" free" if t.lower() == "free" else ""}">{escape(t)}</span>' for t in ev["tags"])
        out.append(f'            <div class="actions">{tags}</div>')
    out.append('          </div>')
    out.append('        </article>')
    return "\n".join(out)


def read_questions():
    """Every question under assets/questions/, newest first by the date in its name."""
    out = []
    for p in sorted(QUESTIONS.glob("*.txt"), reverse=True) if QUESTIONS.is_dir() else []:
        lines = p.read_text(encoding="utf-8").splitlines()
        text = lines[0].strip() if lines else ""
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", p.stem) or not text:
            print(f"skip  questions/{p.name}: name it YYYY-MM-DD.txt with the question on line 1")
            continue
        out.append({"date": p.stem, "text": text})
    return out


def render_question(q):
    """The one line in the app section that names the current question, if there is one."""
    base = "A new one every two weeks, answered in the app."
    if not q:
        return f"          <p>{base}</p>"
    return f"          <p>{base} This time: <q>{escape(q['text'])}</q></p>"


def fill(html, start, end, lines, what):
    """Put lines between a pair of marker comments and leave the rest of the page alone."""
    a, b = html.find(start), html.find(end)
    if a < 0 or b < 0:
        sys.exit(f"{what} markers not found in index.html")
    return html[:a] + start + "\n" + "".join(l + "\n" for l in lines) + html[b:]


def folders_in(path):
    """Sub folders of a folder that may not exist yet, so an empty section builds fine."""
    return sorted(d for d in path.iterdir() if d.is_dir()) if path.is_dir() else []


def write_feed(past, upcoming, questions):
    """events.json: the same events and questions as the site, in one file for the
    app. Paths are root-relative so the app puts the site in front of them. No
    timestamp, so a build with nothing new changes nothing."""
    feed = {
        "site": SITE,
        "past": [{
            "slug": e["slug"], "title": e["title"], "when": e["when"], "date": e["date"] or None,
            "url": f"/events/{e['slug']}.html", "description": e["paras"],
            "cover": e["thumbs"][0] if e["photos"] else None,
            "images": e["photos"], "thumbs": e["thumbs"],
        } for e in past],
        "upcoming": [{
            "slug": u["slug"], "title": u["title"], "date": u["date"] or None, "time": u["time"] or None,
            "where": u["where"] or None, "tags": u["tags"], "poster": u["poster"], "description": u["paras"],
        } for u in upcoming],
        "questions": questions,
    }
    FEED.write_text(json.dumps(feed, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


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
            f'        <button class="photo" type="button" data-index="{i}" data-src="{escape(p)}"><img src="{escape(t)}" alt="" loading="lazy" decoding="async"></button>'
            for i, (p, t) in enumerate(zip(ev["photos"], ev["thumbs"])))
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
        <button class="share-btn reveal" type="button" data-delay="1" data-share-title="{escape(ev['title'])} · Silly Spaces" data-share-url="https://sillyspaces.com/events/{ev['slug']}.html"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/></svg><span>Share this event</span></button>
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
            # also swallows the stray backslash an earlier version of this wrote
            pat = re.compile(r'(/%s)(\?v=[0-9a-f]+\\?)?"' % re.escape(f))
            t2 = pat.sub(lambda m: '%s?v=%s"' % (m.group(1), h), t)
            if t2 != t:
                page.write_text(t2, encoding="utf-8")
    print("stamped css/js versions into the pages")


def main():
    stamp_assets()
    folders = sorted((d for d in PHOTOS.iterdir() if d.is_dir()), reverse=True)
    events = [e for e in (read_event(d) for d in folders) if e]
    upcoming = sort_upcoming([u for u in (read_upcoming(d) for d in folders_in(UPCOMING)) if u])
    questions = read_questions()
    html = INDEX.read_text(encoding="utf-8")
    html = fill(html, START, END, [render(e, i) for i, e in enumerate(events)], "gallery")
    html = fill(html, UP_START, UP_END, [render_upcoming(u, i) for i, u in enumerate(upcoming)], "upcoming")
    html = fill(html, Q_START, Q_END, [render_question(questions[0] if questions else None)], "question")
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
    write_feed(events, upcoming, questions)
    print(f"wrote {len(events)} event page(s) into events/")
    for e in events:
        print(f"ok    {e['title']}: {len(e['photos'])} photo(s)")
    print(f"wrote {len(events)} event(s) into index.html")
    for u in upcoming:
        print(f"ok    {u['title']}: {u['when'] or 'no date'}, {'poster' if u['poster'] else 'no poster'}")
    print(f"wrote {len(upcoming)} upcoming card(s) into index.html")
    print(f"wrote {len(questions)} question(s), {'showing ' + questions[0]['date'] if questions else 'none showing'}")
    print("wrote events.json")


if __name__ == "__main__":
    main()
