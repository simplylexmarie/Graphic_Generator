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

`src/template-bakken-young.html` is the shared editor the other studios are derived from;
`src/springforth/*.js` and `src/mcmillan/*.js` hold each client's own pieces.

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
