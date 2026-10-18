# The Silly Spaces app

The website is the front door. It has the upcoming events, the photos from past ones, and a box where you leave an email. The app is where the membership lives: an account, your own record of the events you came to, the photos you took, the question we ask every two weeks, and a notification when a date lands. This file is the plan for building it, written so either of us can pick it up later without re-deciding everything.

## What it does

Sign in with Google, Apple or an email link. Apple's guideline 4.8 says an app with Google sign-in must also offer a login that collects only a name and an email and lets people hide the email, and Sign in with Apple is the easy way to meet it, so that is three buttons, not one. Write a name, add an Instagram or TikTok handle if you want, tick the events you came to. Your page shows the count and the list, and the People screen shows everyone who chose to be listed. Each past event has a photo screen with our photos from the site and the ones members shared from the day; shared photos wait for one of us to approve them before anyone else sees them. The question screen shows the current question with everyone's answers underneath, one answer per person, editable. A notification goes out when an upcoming event gets a date. An admin screen, visible only to the two of us, lists every account with its email and whether it wants event emails, and has a Copy emails button.

## How it is built

Expo (React Native) with EAS Build, one codebase for iOS and Android, in React which we already know. Expo handles the push notification plumbing and the Google and Apple sign-in modules without touching Xcode or Android Studio. The runner-up was an installable web app from sillyspaces.com, which costs nothing and needs no store, but iOS push support is weak and "download the app" would not mean anything. If the list stays small, that is still the cheaper fallback.

The backend is Firebase. Authentication and Firestore run on the free Spark plan. Cloud Storage for Firebase needs the Blaze plan on new projects, pay as you go with a card on file, so member photos are the step that turns billing on; a budget alert at $5 keeps a surprise from getting past that. Authentication for the sign-in methods. Firestore for the small documents: `profiles/{uid}` (name, handles, bio, attended slugs, listed flag), `private/{uid}` (email, wants emails; readable only by the owner and admins), `answers/{questionDate}_{uid}`, `photos/{id}` (who, which event, storage path, approved flag), `devices/{uid}` (push tokens), and `admins/{email}` which is how one of us makes the other an admin from the console. Storage holds member photos, resized on the phone to 1600 px before upload like the website does. Security rules do the protecting, not secrecy: the web config is public by design, profiles are readable only when `listed` is true, private documents only by their owner or an admin, photos only when approved or yours, and every write checks the field list and the string lengths.

Events are not in Firestore. The repo stays the source of truth and `build.py` publishes `https://sillyspaces.com/events.json` with three lists: `past` (title, date, description, cover, every image and thumbnail path), `upcoming` (title, date, time, where, tags, poster, description) and `questions` (date and text). The app fetches that file on open and caches it. One edit from the upload page updates the site and the app at the same time, and nobody has to type an event twice. Image paths are root-relative; the app prefixes the `site` field.

Push notifications need something to send them. The simplest version has no server at all: the admin screen has a "Send a heads up" button that posts to Expo's push API with the tokens from `devices`. The automatic version is a step in the existing GitHub Action: when `events.json` changes, a script compares the upcoming list to the last build and calls the same API. That needs a Firebase service account stored as a repo secret, so it comes after the manual button works.

## What it costs

Apple Developer Program, US$99 a year, about CAD 135. Google Play, US$25 once, about CAD 34. Firebase costs nothing at this size: 50,000 Firestore reads a day on Spark, and 5 GB of Storage inside the Blaze plan's no-cost allowance, about 15,000 photos at 1600 px, with the card on file never charged below that. Expo's free tier covers a handful of builds a month, which is enough for releases. Time is the real cost: a first version with sign-in, profile, record, people and the question is roughly 40 to 60 hours, photos and notifications another 20 to 30, and the store review round trips another evening or two. Those are hours that are not stitching and not NFC cards, so the gate before starting is the email list: when it passes 50 addresses and we have had three events with people coming back, the app is worth the year of Apple fees. Until then the welcome email says it is in the works, which is true.

## Order of work

1. New repo `silly-spaces-app`, `npx create-expo-app`, Firebase project `silly-spaces` in the Toronto region, Google sign-in on, rules pasted from the file in that repo.
2. Sign in, profile form, the record screen built from `events.json`. This is the version that goes to five friends through Expo Go, no store yet.
3. People list and person pages, listed flag respected.
4. The question with answers, one per person.
5. Manual push from the admin screen, then the Action step.
6. Member photos with approval.
7. Store listings, screenshots, privacy policy page on sillyspaces.com (both stores ask for a URL), and the `APP_LINK` constant in `sheet/Code.gs` filled in so the welcome email starts carrying the link.

`events.json` is already live after the next merge; the app plan above assumes nothing on the site changes shape.
