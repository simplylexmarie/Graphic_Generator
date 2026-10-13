# Graphic Generator — the app

The studios plus everything around them, on Cloudflare:

- **Team login** — Cloudflare Access (an emailed code or Google sign-in). No passwords to manage.
- **Shared calendar** — each client's months in a database (D1); everyone sees the same posts.
- **AI drafting** — Claude writes a month in the client's voice from their messaging guide and
  recent posts; every post stays editable. The API key lives only on the server.
- **Graphics saved to their days** — PNGs in file storage (R2), with each graphic's editable design.
- **Client review** — one private link per month. The client sees each post with its graphic and
  approves it or asks for changes; their answers show on each post in the calendar.

Everything is private: the site, photos and graphics are behind the team login. Only the review
pages are open, and only to someone with that month's link.

## Run it on this computer

```
cd app
npm install
cp .dev.vars.example .dev.vars        # AUTH_MODE=off; add AI_FAKE=1 to test without an API key
npm run db:init                        # creates the local database
npm run dev                            # http://localhost:8788
```

`npm run build` assembles `public/` from the studios (it runs the studio build in `../src`).

## Put it online (once)

You need a Cloudflare account (free) and, for AI drafting, an Anthropic API key.

1. **Log in:** `npx wrangler login`
2. **Create the database:** `npx wrangler d1 create graphic-generator` — copy the `database_id` it
   prints into `wrangler.toml` (replacing `local-dev`), then
   `npx wrangler d1 execute graphic-generator --remote --file schema.sql`
3. **Create the file storage:** `npx wrangler r2 bucket create graphic-generator-files`
4. **Deploy:** `npm run deploy` (the first time it asks to create the `graphic-generator` project).
   The site appears at `https://graphic-generator.pages.dev`.
5. **Add the API key:** `npx wrangler pages secret put ANTHROPIC_API_KEY` and paste it.
6. **Turn on the team login** — Cloudflare dashboard → Zero Trust → Access → Applications → Add an
   application → Self-hosted:
   - Domain: `graphic-generator.pages.dev` (and the custom domain, if any)
   - Policy: **Allow**, Include → Emails → your team's addresses (or an email domain)
   - Login methods: One-time PIN, and/or Google
   - Add a second application for the **review pages**, paths `review` and `api/review`, with a
     **Bypass** policy (Include → Everyone), so clients can open their links without logging in.

   The API refuses anything that didn't come through Access, so a missed step fails closed.

Later deploys are just `npm run deploy`. Connecting the GitHub repo in the Pages dashboard makes
every push deploy by itself.
