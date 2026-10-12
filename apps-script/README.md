# Save to Drive — one-time setup

The studio's **Save to Drive** button posts each finished graphic to this Apps Script. It files
the PNG in a shared Drive folder, shows it in the calendar sheet's IMAGE column, and tells every
browser which posts already have a graphic.

Do this once, signed in to the Google account that should own the files (it needs **edit**
access to the client's calendar sheet).

1. **Make the Drive folder.** In Google Drive, create a folder such as `Social Graphics` and
   share it with the team. Open it and copy the ID from the address bar — the part after
   `/folders/`.
2. **Create the script.** Go to https://script.google.com → **New project**. Name it
   `Graphic Generator – Save to Drive`. Replace everything in `Code.gs` with the contents of
   `SaveToDrive.gs` from this folder. Save.
3. **Add the settings.** Click the gear (**Project Settings**) → **Script Properties** → add:
   - `PASSCODE` — a team passcode (anything; the studio asks for it once per browser)
   - `ROOT_FOLDER_ID` — the folder ID from step 1
4. **Deploy.** **Deploy → New deployment** → type **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**

   Click **Deploy**, approve the permissions Google asks for (Drive and Sheets), and copy the
   **Web app URL** (ends in `/exec`).
5. **Connect the studio.** Send the Web app URL to whoever maintains the site; it goes in
   `clients.js` as the client's `calendar.driveEndpoint`.

"Who has access: Anyone" lets the studio reach the script from the browser; the passcode is
what keeps strangers from saving files. To change the passcode later, edit the script property.
If the script code changes, use **Deploy → Manage deployments → Edit → New version** so the
URL stays the same.

## What it does in the sheet

For the post's date it sets the IMAGE cell to `=IMAGE(...)` showing the graphic, and adds a
note with the Drive link. Saving again replaces the file (the old one goes to Drive's trash).
The image is sized to the cell, so taller rows show it larger.
