/**
 * Graphic Generator — Save to Drive
 *
 * A small web app the studios post finished graphics to. It files each PNG in a shared Drive
 * folder (<root>/<Client>/<Month Year>/), shows it in the matching row of the client's
 * calendar sheet, and reports which posts already have a graphic so every browser sees the
 * same checkmarks.
 *
 * Setup (once): see apps-script/README.md. Script properties:
 *   PASSCODE        the team passcode the studio asks for
 *   ROOT_FOLDER_ID  the Drive folder the client folders live in
 */
const PROPS = PropertiesService.getScriptProperties();

function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    if (!b.passcode || b.passcode !== PROPS.getProperty('PASSCODE')) return out({ ok: false, error: 'passcode' });
    if (b.action === 'ping') return out({ ok: true });
    if (b.action === 'save') return out(save(b));
    if (b.action === 'status') return out(status(b));
    return out({ ok: false, error: 'unknown action' });
  } catch (err) {
    return out({ ok: false, error: String(err && err.message || err) });
  }
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function child(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function monthFolder(b) {
  const root = DriveApp.getFolderById(PROPS.getProperty('ROOT_FOLDER_ID'));
  return child(child(root, b.client), b.month);
}

/**
 * b: { client, month, filename, png (base64, no data: prefix), sheetId, tab, iso, dateCol, imageCol }
 * A file with the same name is replaced (the old one goes to Drive's trash, so it can be recovered).
 */
function save(b) {
  const folder = monthFolder(b);
  const old = folder.getFilesByName(b.filename);
  while (old.hasNext()) old.next().setTrashed(true);
  const file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(b.png), 'image/png', b.filename));
  // the sheet shows the image through a thumbnail link, which needs the file viewable by link
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (err) {}
  let row = null;
  if (b.sheetId && b.tab && b.iso && b.imageCol && b.dateCol) row = putInSheet(b, file.getId(), file.getUrl());
  return { ok: true, id: file.getId(), url: file.getUrl(), row: row };
}

function putInSheet(b, id, url) {
  const sh = SpreadsheetApp.openById(b.sheetId).getSheetByName(b.tab);
  if (!sh) return null;
  const tz = Session.getScriptTimeZone();
  const dates = sh.getRange(b.dateCol + '1:' + b.dateCol + sh.getLastRow()).getValues();
  for (let i = 0; i < dates.length; i++) {
    const v = dates[i][0];
    if (!(v instanceof Date)) continue;
    if (Utilities.formatDate(v, tz, 'yyyy-MM-dd') !== b.iso) continue;
    const cell = sh.getRange(b.imageCol + (i + 1));
    cell.setFormula('=IMAGE("https://drive.google.com/thumbnail?id=' + id + '&sz=w1000")');
    cell.setNote('Graphic: ' + url);
    return i + 1;
  }
  return null;
}

/** b: { client, month } → the PNG names already in that month's folder */
function status(b) {
  const root = DriveApp.getFolderById(PROPS.getProperty('ROOT_FOLDER_ID'));
  const c = root.getFoldersByName(b.client);
  if (!c.hasNext()) return { ok: true, files: [] };
  const m = c.next().getFoldersByName(b.month);
  if (!m.hasNext()) return { ok: true, files: [] };
  const files = [], it = m.next().getFiles();
  while (it.hasNext()) { const f = it.next(); if (!f.isTrashed()) files.push(f.getName()); }
  return { ok: true, files: files };
}
