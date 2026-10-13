# Generator backend — one-time setup

The studios talk to one small Google Apps Script. It:

- **Saves graphics to Drive** and shows each one in the calendar sheet's IMAGE column
- **Keeps the calendar shared** — months drafted in the generator are files in Drive, so everyone
  who opens the generator sees and edits the same posts
- **Drafts posts with Claude** in the client's voice, from their messaging guide and past posts

Do this once, signed in to the Google account that should own the files (it needs **edit**
access to the client's calendar sheet if you use Save to Drive with the sheet).

1. **Make the Drive folder.** In Google Drive, create a folder such as `Social Graphics` and
   share it with the team. Open it and copy the ID from the address bar — the part after
   `/folders/`.
2. **Add the messaging guide.** Inside that folder, make a folder named exactly after the client
   as the studio shows it — `Spring Forth` — and put the messaging guide in it. Any file whose
   name contains **messaging guide** works: a Google Doc, a PDF or a .txt
   (e.g. `Spring Forth messaging guide`). Without one, drafts go by recent posts alone.
3. **Get a Claude API key.** At https://console.anthropic.com (on the Brilliant Impact account),
   create an API key. Billing goes to that account; drafting a month costs well under a dollar.
4. **Create the script.** Go to https://script.google.com → **New project**. Name it
   `Graphic Generator backend`. Replace everything in `Code.gs` with the contents of
   `SaveToDrive.gs` from this folder. Save.
5. **Add the settings.** Click the gear (**Project Settings**) → **Script Properties** → add:
   - `PASSCODE` — a team passcode (anything; the studio asks for it once per browser)
   - `ROOT_FOLDER_ID` — the folder ID from step 1
   - `ANTHROPIC_API_KEY` — the key from step 3 (it stays in the script; the website never sees it)
6. **Deploy.** **Deploy → New deployment** → type **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**

   Click **Deploy**, approve the permissions Google asks for (Drive, Sheets, Docs, external
   requests), and copy the **Web app URL** (ends in `/exec`).
7. **Connect the studio.** The URL goes in `clients.js` as the client's
   `calendar.driveEndpoint`. In the studio, click **Connect to the shared calendar** and enter
   the passcode.

"Who has access: Anyone" lets the studio reach the script from the browser; the passcode is
what keeps strangers out (including from spending on the API key). To change the passcode, edit
the script property. When the script code changes, use **Deploy → Manage deployments → Edit →
New version** so the URL stays the same.

## What it stores

- `<folder>/<Client>/<Month Year>/` — the finished graphics (`SpringForth_2026-11-02_Mon.png`…)
- `<folder>/<Client>/_calendar/2026-11.json` — that month's posts. Two people editing at once is
  caught: the second save is refused and the studio shows the newer version.

## The client report

**Client report (Sheet)** in the calendar panel builds a Google Sheet in the month's folder —
`Spring Forth — November 2026 social calendar` — with one row per post: date, day, bucket,
headline, post text, the graphic, and a Client notes column. Anyone with the link can view and
comment; the link is copied for you. Building it again updates the same sheet, so a link already
sent keeps working. **Printable report** opens the same layout as a page to save as PDF.

## What it does in the sheet

Save to Drive sets the post's IMAGE cell to `=IMAGE(...)` showing the graphic, with a note
linking to the file. Saving again replaces the file (the old one goes to Drive's trash).

## Drafting

Drafts use `claude-opus-5-5`, a week of posts per request, with the guide and recent posts
cached across the month's requests. If a safety classifier declines a request, the API retries
on Anthropic's recommended fallback model automatically.
