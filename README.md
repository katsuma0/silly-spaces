# Silly Spaces

Static site for sillyspaces.com. Plain HTML, one stylesheet, one script, no build step.

## Pages

- `index.html`, everything on one page: upcoming events, members, join form, past events gallery, about teaser, FAQ, socials.
- `about.html`, the full description.
- `thanks.html`, where the join form lands after a submit.
- `404.html`, custom not-found page. GitHub Pages and Netlify pick it up by name.

## Run it locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000. Links use root-relative paths, so it needs a server, opening the file directly won't work.

## Before it goes live

1. Make the join form actually send somewhere. Create a free form at formspree.io, then replace `YOUR_FORM_ID` in `index.html`. The `_next` field already points at the thank you page. Netlify Forms works too, add `data-netlify="true"` to the form and drop the action.
2. Add real past events, see below. The three folders in `assets/photos/` hold gradient placeholders right now.
3. Update the social handles in the footer of `index.html` and `about.html`. They point at `@sillyspaces` on each network right now.
4. Set `hello@sillyspaces.com` up as a real inbox, it appears on every page.

## Adding past event photos

One folder per event under `assets/photos/`. Start the folder name with the date so the newest shows first, for example `2026-06-14-soccer`. Paste the photos in, then add a file called `event.txt` beside them:

```
Soccer
June 14, 2026
Pickup at Milliken Park. Teams picked on the spot, score forgotten by the end.
```

Line one is the title, line two is the date in any wording, everything after that is the description. Then from the repo root:

```
python3 build.py
```

It rewrites the gallery in `index.html`, writes one page per event into `events/` (title, date, the text from `event.txt` as paragraphs, and a photo grid), refreshes `sitemap.xml`, and prints what it found. The event pages take their nav and footer from `index.html`, so edit those there. Run it after any change to `style.css` or `main.js` too, so the version stamp on their links updates. Commit and open a PR. Photos show in filename order and the first one is the cover, so rename to `01.jpg`, `02.jpg` if the order matters. iPhone HEIC files won't show in a browser, export them as JPG first. Keep each under about 500 KB, the page loads them all.

## Adding an upcoming event

Copy one of the `article.card` blocks in the upcoming section of `index.html`. Set `data-date` to the event date as `YYYY-MM-DD`. The script hides cards whose date has passed, so nothing needs deleting the next day. When an event is done, move it into the past events gallery with a short description and photos.

## Hosting

`CNAME` is set to `sillyspaces.com` for GitHub Pages. Point the domain's A records at GitHub's IPs, or a CNAME at `katsuma0.github.io`, and turn on HTTPS in the repo settings.
