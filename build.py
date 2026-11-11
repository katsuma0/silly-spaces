#!/usr/bin/env python3
"""Rebuild index.html and the event pages from the files under assets/.

Upcoming and past events are written as slides between the events markers
in index.html. The homepage carousel is oldest to newest, undated upcoming
last, and the loop still opens on the current event.

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

Then run:

    python3 build.py

An event with no photos yet still shows, with a blank cover, so the
description is up right away.

Photos are also normalised in place: the phone's rotation tag is baked
in, anything over 1600 px on the long edge is shrunk, metadata is
dropped. Needs Pillow (pip install pillow); without it photos are left
as they are.

Partners are listed in assets/partners.txt, one company per block:

    line 1   company name
    then     score: 4.9
             event: title or folder slug of the event you did together
             why: why they have that face

The homepage ranks them by score. Tap a name for the event and the why.

Bounties are one folder each under assets/bounties/, with a bounty.txt
and a poster image (poster.jpg, or the first image in the folder):

    line 1   title
    rest     what we need, as many lines as you want

The poster is a flier pinned to the board. Clicking it zooms in;
"I can help" on the open flier mails us with that title.

Nothing outside the markers in index.html is touched.
"""
from html import escape
from pathlib import Path
from urllib.parse import quote
import datetime
import hashlib
import re
import sys

try:
    from PIL import Image, ImageOps
except ImportError:  # photos still work, they just stay at whatever size they came in
    Image = None

ROOT = Path(__file__).resolve().parent
PHOTOS = ROOT / "assets" / "photos"
UPCOMING = ROOT / "assets" / "upcoming"
INDEX = ROOT / "index.html"
PARTNERS = ROOT / "assets" / "partners.txt"
BOUNTY = ROOT / "assets" / "bounties"
EV_START = "        <!-- events:start -->"
EV_END = "        <!-- events:end -->"
PT_START = "        <!-- partners:start -->"
PT_END = "        <!-- partners:end -->"
BN_START = "        <!-- bounties:start -->"
BN_END = "        <!-- bounties:end -->"
MAIL = "sillyspacesww@gmail.com"
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
    lines = info.read_text(encoding="utf-8-sig").splitlines()
    title = lines[0].strip() if lines else folder.name
    when = lines[1].strip() if len(lines) > 1 else ""
    tags, paras = [], []
    for line in lines[2:]:
        s = line.strip()
        if not s:
            continue
        m = re.match(r"tags:\s*(.*)$", s, re.I)
        if m:
            tags = [t.strip() for t in m.group(1).split(",") if t.strip()]
            continue
        paras.append(s)
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
    return {"title": title, "when": when, "desc": desc, "paras": paras, "tags": tags, "slug": folder.name,
            "date": m.group(1) if m else "",
            "photos": [f"/assets/photos/{folder.name}/{p.name}" for p in photos],
            "thumbs": [small(p) for p in photos]}


def title_tag(t):
    return " ".join((w[:1].upper() + w[1:]) if w else "" for w in t.split())


def tag_pills(tags, past=False):
    if not tags:
        return ""
    bits = []
    for t in tags:
        label = title_tag(t)
        cls = " pink" if past else (" free" if t.lower() == "free" else "")
        bits.append(f'<span class="tag{cls}">{escape(label)}</span>')
    return "\n            <div class=\"actions\">" + "".join(bits) + "</div>"


def render(ev, i):
    cover = ev["thumbs"][0] if ev["photos"] else "/assets/photos/blank.svg"
    date = f' data-date="{ev["date"]}"' if ev["date"] else ""
    nophoto = "" if ev["photos"] else " no-photos"
    desc = "&#10;".join(escape(t) for t in ev["paras"])
    tags = ",".join(ev.get("tags") or [])
    attr = f' data-tags="{escape(tags)}"' if tags else ""
    return f"""        <a class="slide{nophoto}" href="/events/{ev['slug']}.html" data-kind="past"{date}{attr} data-desc="{desc}">
          <div class="ph"><img src="{escape(cover)}" alt="" loading="lazy" decoding="async"></div>
          <div class="cap">
            <span class="kicker">Past</span>
            <h3>{escape(ev['title'])}</h3>{tag_pills(ev.get("tags") or [], past=True)}
          </div>
        </a>"""


def long_date(text):
    """A YYYY-MM-DD date as "November 8, 2026", or None when the text is anything
    else, so ??/??/?? and the like can show as written."""
    m = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", text)
    if not m:
        return None
    y, mo, d = (int(x) for x in m.groups())
    try:
        datetime.date(y, mo, d)
    except ValueError:
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
    lines = info.read_text(encoding="utf-8-sig").splitlines()
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
    size = Image.open(poster).size if poster and Image is not None else (0, 0)
    return {"slug": folder.name, "title": title, "date": date, "poster_size": size,
            "iso": date if long_date(date) else "",
            "when": long_date(date) or date,
            "time": fields.get("time", ""), "where": fields.get("where", ""),
            "tags": [t.strip() for t in fields.get("tags", "").split(",") if t.strip()],
            "paras": [l.strip() for l in rest if l.strip()],
            "poster": f"/assets/upcoming/{folder.name}/{poster.name}" if poster else None}


def sort_upcoming(events):
    """Real dates first and soonest first, then the ones still at ??/??/??, then by name."""
    return sorted(events, key=lambda e: (0, e["iso"], e["slug"]) if e["iso"] else (1, "", e["slug"]))


def carousel_items(events, upcoming):
    """Past and upcoming in one timeline: dated events oldest first, then
    anything still at ??/??/??. The loop script centers the first upcoming."""
    items = [("up", u) for u in upcoming] + [("past", e) for e in events]
    def key(item):
        kind, ev = item
        if kind == "up":
            return (ev["iso"] or "9999-12-31", ev["slug"])
        return (ev.get("date") or "0000-01-01", ev["slug"])
    items.sort(key=key)
    slides = []
    for i, (kind, ev) in enumerate(items):
        slides.append(render_upcoming(ev, i) if kind == "up" else render(ev, i))
    return slides


def render_upcoming(ev, i):
    """One slide in the events carousel. A real date gets data-date, which is
    what hides the slide once the day is over."""
    date = f' data-date="{ev["iso"]}"' if ev["iso"] else ""
    cover = ev["poster"] or "/assets/photos/blank.svg"
    nophoto = "" if ev["poster"] else " no-photos"
    desc = "&#10;".join(escape(t) for t in ev["paras"])
    tags = ",".join(ev["tags"])
    lede = f"\n            <p>{escape(' '.join(ev['paras']))}</p>" if ev["paras"] else ""
    return f"""        <article class="slide{nophoto}" data-kind="up"{date} data-desc="{desc}" data-tags="{escape(tags)}">
          <div class="ph"><img src="{escape(cover)}" alt="" loading="lazy" decoding="async"></div>
          <div class="cap">
            <span class="kicker">Upcoming</span>
            <h3>{escape(ev["title"])}</h3>{lede}{tag_pills(ev["tags"])}
          </div>
        </article>"""




def read_partners():
    """Companies in assets/partners.txt. Each block is a name, then score, event, why.
    The homepage list is ranked highest score first."""
    if not PARTNERS.exists():
        return []
    blocks, cur = [], []
    for line in PARTNERS.read_text(encoding="utf-8-sig").splitlines():
        if line.startswith("#"):
            continue
        if not line.strip():
            if cur:
                blocks.append(cur)
                cur = []
            continue
        cur.append(line)
    if cur:
        blocks.append(cur)
    out = []
    for block in blocks:
        name = block[0].strip()
        if not name:
            continue
        fields = {}
        for line in block[1:]:
            m = re.match(r"\s*([A-Za-z]+)\s*:\s*(.*)$", line)
            if m:
                fields[m.group(1).lower()] = m.group(2).strip()
        out.append({
            "name": name,
            "score": fields.get("score", ""),
            "event": fields.get("event", ""),
            "why": fields.get("why", ""),
        })
    def rank(p):
        try:
            return float(p["score"])
        except (TypeError, ValueError):
            return float("-inf")
    out.sort(key=rank, reverse=True)
    return out


def _fold(s):
    return re.sub(r"['’`]", "'", (s or "")).strip().lower()


def find_collab(ref, events, upcoming):
    """Match an event: line to a past or upcoming event by slug or title."""
    if not ref:
        return None
    key = _fold(ref)
    for e in events:
        if e["slug"].lower() == key or _fold(e["title"]) == key:
            return e["title"], f"/events/{e['slug']}.html"
    for u in upcoming:
        if u["slug"].lower() == key or _fold(u["title"]) == key:
            return u["title"], "/#events"
    return ref, "/#events"


def trust_face(raw):
    """Green over 4, red under 2, yellow in between."""
    try:
        n = float(raw)
    except (TypeError, ValueError):
        n = 3
    if n > 4:
        return "good", "good"
    if n < 2:
        return "bad", "poor"
    return "mid", "okay"


def render_partner(p, events, upcoming):
    face, rating = trust_face(p["score"])
    label = f"{p['name']}, {rating}"
    rows = []
    found = find_collab(p["event"], events, upcoming) if p["event"] else None
    if found:
        title, href = found
        rows.append(f'<p><span class="partner-label">Event</span> <a href="{escape(href)}">{escape(title)}</a></p>')
    if p["why"]:
        rows.append(f'<p><span class="partner-label">Why</span> {escape(p["why"])}</p>')
    panel = "".join(rows)
    return (
        f'        <li>\n'
        f'          <details class="partner">\n'
        f'            <summary aria-label="{escape(label)}">\n'
        f'              <span class="partner-copy"><h3>{escape(p["name"])}</h3><span class="plus"></span></span>\n'
        f'              <span class="trust"><img src="/assets/trust-{face}.png" alt="" width="64" height="64"></span>\n'
        f'            </summary>\n'
            f'            <div class="answer partner-panel">{panel}</div>\n'
        f'          </details>\n'
        f'        </li>'
    )


def read_bounty(folder):
    """One help-wanted poster from assets/bounties/<slug>/bounty.txt."""
    info = folder / "bounty.txt"
    if not info.exists():
        print(f"skip  bounties/{folder.name}: no bounty.txt")
        return None
    lines = info.read_text(encoding="utf-8-sig").splitlines()
    title = lines[0].strip() if lines else folder.name
    paras = [l.strip() for l in lines[1:] if l.strip()]
    poster = find_poster(folder)
    return {
        "slug": folder.name,
        "title": title,
        "paras": paras,
        "poster": f"/assets/bounties/{folder.name}/{poster.name}" if poster else None,
    }


def bounty_spot(slug, i):
    """A stable off-centre pin so each flier looks dropped on, not lined up."""
    h = int(hashlib.md5(f"{slug}:{i}".encode()).hexdigest(), 16)
    slots = (
        (16, 12, -3.2),
        (54, 18, 2.4),
        (8, 46, -1.6),
        (48, 50, 3.1),
        (28, 28, -2.8),
        (62, 40, 1.4),
    )
    x, y, tilt = slots[i % len(slots)]
    x = max(6, min(68, x + (h % 9) - 4))
    y = max(8, min(56, y + ((h >> 4) % 9) - 4))
    tilt = round(tilt + ((h >> 8) % 17) / 10 - 0.8, 1)
    return x, y, tilt


def render_bounty(b, i):
    """A flier pinned to the board. Clicking it zooms in; the mail is on the open flier."""
    subject = quote(f"Bounty: {b['title']}")
    body = quote(f"I can help with: {b['title']}")
    href = f"mailto:{MAIL}?subject={subject}&body={body}"
    alt = b["title"]
    if b["paras"]:
        alt = f"{b['title']} — {b['paras'][0]}"
    src = b["poster"] or ""
    x, y, tilt = bounty_spot(b["slug"], i)
    return (
        f'        <article class="bounty" style="--x:{x}%;--y:{y}%;--tilt:{tilt}deg">\n'
        f'          <button type="button" class="bounty-flier" data-src="{escape(src)}" data-mail="{href}" aria-label="Open bounty: {escape(b["title"])}">\n'
        f'            <span class="pin" aria-hidden="true"></span>\n'
        f'            <img src="{escape(src)}" alt="{escape(alt)}">\n'
        f'          </button>\n'
        f'        </article>'
    )


def fill(html, start, end, lines, what):
    """Put lines between a pair of marker comments and leave the rest of the page alone."""
    a, b = html.find(start), html.find(end)
    if a < 0 or b < 0:
        sys.exit(f"{what} markers not found in index.html")
    return html[:a] + start + "\n" + "".join(l + "\n" for l in lines) + html[b:]


def folders_in(path):
    """Sub folders of a folder that may not exist yet, so an empty section builds fine."""
    return sorted(d for d in path.iterdir() if d.is_dir()) if path.is_dir() else []




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
        <a class="back-link reveal" href="/#events">Back to events</a>
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

  <dialog class="lightbox" id="lightbox" aria-label="{escape(ev['title'])} photos">
    <div class="lb-inner">
      <div class="lb-photos">
        <button class="lb-arrow prev" type="button" aria-label="Previous photo">&#8249;</button>
        <button class="lb-arrow next" type="button" aria-label="Next photo">&#8250;</button>
      </div>
      <div class="lb-dots"></div>
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
    folders = sorted((d for d in PHOTOS.iterdir() if d.is_dir()), reverse=True)
    events = [e for e in (read_event(d) for d in folders) if e]
    upcoming = sort_upcoming([u for u in (read_upcoming(d) for d in folders_in(UPCOMING)) if u])
    html = INDEX.read_text(encoding="utf-8")
    slides = carousel_items(events, upcoming)
    html = fill(html, EV_START, EV_END, slides, "events")
    partners = read_partners()
    partner_lines = [render_partner(p, events, upcoming) for p in partners]
    html = fill(html, PT_START, PT_END, partner_lines, "partners")
    bounties = [b for b in (read_bounty(d) for d in folders_in(BOUNTY)) if b]
    bounty_lines = [render_bounty(b, i) for i, b in enumerate(bounties)]
    html = fill(html, BN_START, BN_END, bounty_lines, "bounties")
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
    # last, so the freshly written event pages get the stamp too
    stamp_assets()
    print(f"wrote {len(events)} event page(s) into events/")
    for e in events:
        print(f"ok    {e['title']}: {len(e['photos'])} photo(s)")
    print(f"wrote {len(events)} event(s) into index.html")
    for u in upcoming:
        print(f"ok    {u['title']}: {u['when'] or 'no date'}, {'poster' if u['poster'] else 'no poster'}")
    print(f"wrote {len(upcoming)} upcoming card(s) into index.html")
    print(f"wrote {len(partners)} partner(s) into index.html")
    print(f"wrote {len(bounties)} bounty(s) into index.html")
    for b in bounties:
        print(f"ok    {b['title']}: {'poster' if b['poster'] else 'no poster'}")


if __name__ == "__main__":
    main()
