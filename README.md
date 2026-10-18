# Silly Spaces

Static site for sillyspaces.com. Plain HTML, one stylesheet, one script, and a small Python build that turns the files under `assets/` into the homepage, the event pages and a JSON feed for the app.

The site is the front door: what is coming up, what happened, an email box to join the list. The app is where members live. Both read the same files in this repo, so one edit here updates both.

## Pages

- `index.html`, everything on one page: upcoming events, the join box, past events gallery, FAQ, socials.
- `about.html`, the full description.
- `thanks.html`, where the join box lands after a submit.
- `404.html`, custom not-found page. GitHub Pages picks it up by name.
- `upload.html`, editing from a phone. Not linked from the site, has `noindex`, and does nothing without a GitHub token.

## Run it locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000. Links use root-relative paths, so it needs a server, opening the file directly won't work.

## Before it goes live

1. Connect the join box to a Google Sheet. The steps are at the top of `sheet/Code.gs`. Do them signed in as sillyspacesww@gmail.com, because the emails come from whichever account runs the script: make a sheet, paste that file into its Apps Script, deploy it as a web app, and put the web app URL into the form's `action` in `index.html` in place of `PASTE_YOUR_ID`. Every submit then adds a row with the time, name, email, status and source, and sends the welcome email. Until that is done the form shows a note pointing people at Instagram.
2. When the app is out, put the download link in the `APP_LINK` constant at the top of `Code.gs`. The welcome email switches from "we're building an app" to the link on its own.
3. After any edit to `Code.gs`: Deploy, Manage deployments, Edit, Version: New version, Deploy. Without a new version the old code keeps running.
4. Add past events as they happen, see below. The folders in `assets/photos/` are the real ones.
5. The social handles in the footer of `index.html` and `about.html` point at `@silly.spaces` on Instagram and `@sillyspaces` on TikTok and YouTube. Change them there if they move.
6. The email on every page is `sillyspacesww@gmail.com`, change it in `index.html`, `about.html`, `404.html`, `thanks.html` and `sheet/Code.gs` if it ever moves.

## Adding past event photos

One folder per event under `assets/photos/`. Start the folder name with the date so the newest shows first, for example `2026-06-14-soccer`. Paste the photos in, then add a file called `event.txt` beside them:

```
Soccer
June 14, 2026
Pickup at Milliken Park. Teams picked on the spot, score forgotten by the end.
```

Line one is the title, line two is the date in any wording, everything after that is the description. Then from the repo root (or skip this and let the Action do it, see below):

```
python3 build.py
```

It rewrites the gallery in `index.html`, writes one page per event into `events/` (title, date, the text from `event.txt` as paragraphs, and a photo grid), refreshes `sitemap.xml` and `events.json`, and prints what it found. The event pages take their nav and footer from `index.html`, so edit those there. Run it after any change to `style.css` or `main.js` too, so the version stamp on their links updates. Commit and open a PR. Photos show in filename order and the first one is the cover, so rename to `01.jpg`, `02.jpg` if the order matters. iPhone HEIC files won't show in a browser, export them as JPG first. Keep each under about 500 KB, the page loads them all.

## Adding photos from a phone

Open sillyspaces.com/upload.html on the phone. The first time it asks for a GitHub token, the steps are on the page, it takes two minutes and the token stays in that phone's browser. After that: pick an event or start a new one, fill in the title and the What and Why lines, tap Add photos and pick as many as you like, use the arrows to set the order, tap Send. The page shrinks each photo to 1600 px on the phone, pushes them to a `photos/...` branch, and opens a pull request. A GitHub Action on that branch runs `build.py`, so the thumbnails, gallery card and event page come with it. When the check is green, merge from the GitHub app. The site updates a couple of minutes later.

The Action also runs when anything under `assets/photos/`, `assets/upcoming/` or `assets/questions/` changes on any branch, so a folder uploaded through github.com gets built too.

## Adding an upcoming event

One folder per event under `assets/upcoming/`, named with a short slug like `battle-of-borders`. Inside it, an `event.txt` and, if there is one, a poster image called `poster.jpg` (any image file works, the first one in the folder is used). `event.txt` looks like this:

```
The Battle Of Borders (B.O.B)
date: ??/??/??
time: ?:?? pm
where: The border marker
tags: Free, Outdoors

Cross border volleyball to settle the debate for the greatest Canadian province.
Date and time go out to the list first.
```

Line one is the title. Then `key: value` lines, any of `date`, `time`, `where` and `tags`, all optional, in any order. A blank line, then the description, one paragraph per line. Write the date as `YYYY-MM-DD` once it is known: the card shows it as "November 8, 2026", the calendar picks it up, and the card hides itself the day after, so nothing needs deleting. Anything else, like `??/??/??`, shows as written. A tag called `Free` gets the blue pill.

Run `python3 build.py` or let the Action do it. Either way `index.html` and `events.json` are regenerated, and a poster over 1600 px on the long edge is shrunk in place. When the event has happened, move it to the past events gallery with a short description and photos, and delete the upcoming folder.

The upload page does all of this from a phone. Switch it to Upcoming, pick the event or start a new one, fill in the title, date, time, where, tags and description, add one poster, tap Send. Tick the Done box instead to take the event off the site; the folder is removed and the past-event flow is how it comes back as an archive item.

## The question

The app asks members a question every two weeks. The questions live in `assets/questions/`, one file per question, named by the date it goes live, for example `2026-10-18.txt`, with the question on the first line. Nothing shows on the site; every file goes into `events.json` for the app. Nothing checks the date against today: the file is added when the question should go live, and every two weeks is the plan, not a rule the build enforces.

The upload page's Question mode writes the file. Switch to Question, type it, keep or change the date, tap Send.

## Letting a second person edit

On github.com, open the repo, Settings, Collaborators, Add people, and give them the Write role. They open sillyspaces.com/upload.html on their phone and make their own fine-grained token following the steps on the page: Only select repositories, `silly-spaces`; Contents, Read and write; Pull requests, Read and write. From then on every change either of you makes is a pull request that either of you can merge from the GitHub app. Nobody else can change anything.

## Emails

Every sign-up gets one welcome email from sillyspacesww@gmail.com. It says they are on the list and what to expect (one email when the next event has a date), that the member part lives in the app, where to find upcoming events and photos until then, and how to get off the list. Once `APP_LINK` is set the same email carries the download link instead.

To email everyone on the list: write the email as a draft in Gmail, with a subject that starts with `[list] `. Then open the sheet, Extensions, Apps Script, pick `sendLatestDraftToList` in the function dropdown and press Run. It finds that draft, strips the prefix, and sends the plain text to every address whose Status is `active`, in batches of 50, with "Reply stop and we take you off the list." at the bottom. Apps Script on a consumer Gmail account sends to about 100 recipients a day. Past that, select column C in the sheet, copy it, and BCC from Gmail directly, which allows about 500 a day.

When someone replies stop, open the sheet and change their Status cell to `stopped`. They are skipped from then on. Canada's anti-spam law wants consent, a sender name and address, and a way out in every message, which is why the sign-off and the stop line are in every email.

## The feed for the app

`build.py` writes `events.json` at the repo root, so it is served at `https://sillyspaces.com/events.json`. It has three lists: `past` (the gallery, newest first, with the event page URL, the description lines, the cover, the full images and the thumbs), `upcoming` (title, date, time, where, tags, poster and description for every folder under `assets/upcoming/`) and `questions` (every question, newest first). Paths are root-relative, so the app puts `site` in front of them. It is regenerated on every change, by `build.py` locally or by the Action, so the app never needs its own copy of the data. The plan for the app itself is in `docs/app-plan.md`.

## Hosting

`CNAME` is set to `sillyspaces.com` for GitHub Pages. Point the domain's A records at GitHub's IPs, or a CNAME at `katsuma0.github.io`, and turn on HTTPS in the repo settings.
