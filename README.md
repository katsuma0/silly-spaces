# Silly Spaces

Static site for sillyspaces.ca. Plain HTML, one stylesheet, one script, no build step.

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
2. Swap the placeholder photos in `assets/photos/` for real ones. Each gallery card lists its photos in `data-photos`, comma separated. Keep them under about 300 KB each.
3. Update the social handles in the footer of `index.html` and `about.html`. They point at `@sillyspaces` on each network right now.
4. Set `hello@sillyspaces.ca` up as a real inbox, it appears on every page.

## Adding an event

Copy one of the `article.card` blocks in the upcoming section of `index.html`. Set `data-date` to the event date as `YYYY-MM-DD`. The script hides cards whose date has passed, so nothing needs deleting the next day. When an event is done, move it into the past events gallery with a short description and photos.

## Hosting

`CNAME` is set to `sillyspaces.ca` for GitHub Pages. Point the domain's A records at GitHub's IPs, or a CNAME at `katsuma0.github.io`, and turn on HTTPS in the repo settings.
