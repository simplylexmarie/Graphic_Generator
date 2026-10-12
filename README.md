# Graphic Generator

Brilliant Impact's client graphics studio. The welcome page lists clients; each client has its
own studio with its own logo, colors, photo library, templates and rules.

Live: https://simplylexmarie.com/Graphic_Generator/ (served by GitHub Pages from
`simplylexmarie/Graphic_Generator`; a plain `git push` deploys it).

## Layout

- `index.html` — welcome page / client picker (reads `clients.js`)
- `clients.js` — one entry per client: name, colors, logo, folder, and optional `calendar`
  settings (Google Sheet ID, column letters, Save-to-Drive endpoint)
- `bakken-young/`, `mcmillan/`, `springforth/` — the built studios. Each has `index.html`,
  `brand/` (logos), `library/` (photos + `manifest.json`) and, for Spring Forth, `art/`
  (paper, cork, wave frames, stickers)
- `assets/` — source brand files the build copies from
- `src/` — templates and build scripts (edit these, not the built `index.html` files)
- `apps-script/` — the Google Apps Script behind "Save to Drive"

## Building

```
python3 src/make-mcmillan.py      # regenerates src/template-mcmillan.html
python3 src/make-springforth.py   # regenerates src/template-springforth.html
python3 src/build.py              # writes every studio's index.html
```

`src/template-bakken-young.html` is the editor core every studio is built from;
`src/springforth/*.js` and `src/mcmillan/*.js` hold each client's own looks and layouts.

### Shared features (`src/shared/`)

`build.py` adds these to every studio, so a feature built once reaches every client:

- `calendar.js` — reads the client's Google Sheet calendar (one tab per month)
- `options.js` — "Generate from calendar": three matched options per post
- `month.js` — the whole-month batch, the zip with captions, and Save to Drive
- `clear.js`, `zoom.js` — Clear, and scroll/pinch zoom for photos
- `calendar.css`, `inject.py` — the panels' styles, and the step that adds it all

Each studio has a small adapter, `src/<client>/studio.js`, defining a `STUDIO` object: its
name, file prefix, calendar buckets and colours, and how to blank its page. The calendar
switches on for a client as soon as its `clients.js` entry gets a `calendar` block. The
generate buttons appear when the adapter also provides `specsFor` (which layouts and photos
suit a post) and `buildOption` (put one on the canvas) — Spring Forth's adapter is the model.
Bakken-Young and McMillan don't have those yet; they'll need them when their calendars arrive.

## Photo library

Each studio's `library/manifest.json` lists its photos with a `kind`, content `tags` (what's in
the photo: reading, math, outdoor, parents…) and a `group` (crops of the same shot share one,
so a collage never repeats a moment). Spring Forth's calendar matches posts to photos by
these tags, so new photos need tagging when they're added. Tag `weak` sinks a photo to the
bottom of the matches without removing it.

## Social calendar (Spring Forth)

The studio reads the client's Google Sheet calendar (one tab per month, link-viewable) and
offers "Generate from calendar" for each post, a whole-month batch, and Save to Drive.
An `x` in HOOK TEXT means the graphic carries no headline.
