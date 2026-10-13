/**
 * Graphic Generator — backend (Apps Script web app)
 *
 * One small web app behind every studio. It:
 *   • files finished graphics in a shared Drive folder and shows them in the calendar sheet
 *     (Save to Drive), and reports which posts already have one;
 *   • keeps each client's monthly calendar as a file in Drive, so everyone who opens the
 *     generator sees and edits the same posts;
 *   • drafts posts with Claude, in the client's voice, from their messaging guide and past posts.
 *
 * Setup (once): see apps-script/README.md. Script properties:
 *   PASSCODE           the team passcode the studio asks for
 *   ROOT_FOLDER_ID     the Drive folder the client folders live in
 *   ANTHROPIC_API_KEY  the Claude API key used for drafting (never sent to the browser)
 *
 * Drive layout:  <root>/<Client>/<Month Year>/*.png        finished graphics
 *                <root>/<Client>/_calendar/<YYYY-MM>.json  the month's posts
 *                <root>/<Client>/ a file whose name contains "messaging guide"
 *                                 (Google Doc, PDF or .txt) — the voice the drafts follow
 */
const PROPS = PropertiesService.getScriptProperties();
const MODEL = 'claude-opus-5-5';

function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    if (!b.passcode || b.passcode !== PROPS.getProperty('PASSCODE')) return out({ ok: false, error: 'passcode' });
    switch (b.action) {
      case 'ping': return out({ ok: true, ai: !!PROPS.getProperty('ANTHROPIC_API_KEY'), guide: !!findGuide(b.client) });
      case 'save': return out(save(b));
      case 'status': return out(status(b));
      case 'cal.list': return out(calList(b));
      case 'cal.get': return out(calGet(b));
      case 'cal.save': return out(calSave(b));
      case 'ai.draft': return out(aiDraft(b));
      case 'ai.rewrite': return out(aiRewrite(b));
      case 'report.sheet': return out(reportSheet(b));
      default: return out({ ok: false, error: 'unknown action' });
    }
  } catch (err) {
    return out({ ok: false, error: String(err && err.message || err) });
  }
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function root() { return DriveApp.getFolderById(PROPS.getProperty('ROOT_FOLDER_ID')); }
function child(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function clientFolder(client) { return child(root(), client); }

// ---------- graphics ----------

/** b: { client, month, filename, png (base64), sheetId, tab, iso, dateCol, imageCol } */
function save(b) {
  const folder = child(clientFolder(b.client), b.month);
  const old = folder.getFilesByName(b.filename);
  while (old.hasNext()) old.next().setTrashed(true);     // replaced; recoverable from Drive's trash
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
    if (!(v instanceof Date) || Utilities.formatDate(v, tz, 'yyyy-MM-dd') !== b.iso) continue;
    const cell = sh.getRange(b.imageCol + (i + 1));
    cell.setFormula('=IMAGE("https://drive.google.com/thumbnail?id=' + id + '&sz=w1000")');
    cell.setNote('Graphic: ' + url);
    return i + 1;
  }
  return null;
}

/** b: { client, month } → the PNG names already in that month's folder */
function status(b) {
  const c = root().getFoldersByName(b.client);
  if (!c.hasNext()) return { ok: true, files: [] };
  const m = c.next().getFoldersByName(b.month);
  if (!m.hasNext()) return { ok: true, files: [] };
  const files = [], it = m.next().getFiles();
  while (it.hasNext()) { const f = it.next(); if (!f.isTrashed()) files.push(f.getName()); }
  return { ok: true, files: files };
}

// ---------- the shared calendar ----------
// Each month is one JSON file. Every save carries the revision it was based on; if someone
// else saved in between, the save is refused and the newer copy is sent back instead, so two
// people editing at once never silently overwrite each other.

function calFolder(client) { return child(clientFolder(client), '_calendar'); }
function calFile(client, month) {
  const it = calFolder(client).getFilesByName(month + '.json');
  return it.hasNext() ? it.next() : null;
}

/** b: { client } → [{ month:'YYYY-MM', rev, updatedAt }] */
function calList(b) {
  const months = [], it = calFolder(b.client).getFiles();
  while (it.hasNext()) {
    const f = it.next();
    if (f.isTrashed() || !/^\d{4}-\d{2}\.json$/.test(f.getName())) continue;
    try { const d = JSON.parse(f.getBlob().getDataAsString()); months.push({ month: d.month, rev: d.rev, updatedAt: d.updatedAt }); } catch (err) {}
  }
  return { ok: true, months: months };
}

/** b: { client, month } → { data } (null when the month has no calendar yet) */
function calGet(b) {
  const f = calFile(b.client, b.month);
  return { ok: true, data: f ? JSON.parse(f.getBlob().getDataAsString()) : null };
}

/** b: { client, month, data, rev } — rev is the revision the edit started from (0 for new) */
function calSave(b) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const f = calFile(b.client, b.month);
    const cur = f ? JSON.parse(f.getBlob().getDataAsString()) : null;
    if ((cur ? cur.rev : 0) !== (b.rev || 0)) return { ok: false, error: 'conflict', data: cur };
    const data = b.data;
    data.month = b.month;
    data.rev = (cur ? cur.rev : 0) + 1;
    data.updatedAt = new Date().toISOString();
    const text = JSON.stringify(data);
    if (f) f.setContent(text);
    else calFolder(b.client).createFile(b.month + '.json', text, 'application/json');
    return { ok: true, rev: data.rev, updatedAt: data.updatedAt };
  } finally { lock.releaseLock(); }
}

// ---------- drafting with Claude ----------

function findGuide(client) {
  if (!client) return null;
  const c = root().getFoldersByName(client);
  if (!c.hasNext()) return null;
  const it = c.next().getFiles();
  while (it.hasNext()) { const f = it.next(); if (!f.isTrashed() && /messaging guide/i.test(f.getName())) return f; }
  return null;
}

/** The guide as Claude content blocks: a PDF goes in as a document, anything else as text. */
function guideBlocks(client) {
  const f = findGuide(client);
  if (!f) return [];
  const mime = f.getMimeType();
  if (mime === MimeType.GOOGLE_DOCS) {
    return [{ type: 'text', text: 'MESSAGING GUIDE:\n' + DocumentApp.openById(f.getId()).getBody().getText() }];
  }
  if (mime === MimeType.PDF) {
    return [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: Utilities.base64Encode(f.getBlob().getBytes()) }, title: 'Messaging guide' }];
  }
  return [{ type: 'text', text: 'MESSAGING GUIDE:\n' + f.getBlob().getDataAsString() }];
}

const POST_SCHEMA = {
  type: 'object',
  properties: {
    posts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          iso: { type: 'string', description: 'The post date, YYYY-MM-DD, exactly as given' },
          bucket: { type: 'string' },
          hook: { type: 'string', description: 'The headline printed on the graphic, 3 to 10 words' },
          post: { type: 'string', description: 'The caption' },
          photoIdea: { type: 'string', description: 'One short line describing the photo to pair with it' },
        },
        required: ['iso', 'bucket', 'hook', 'post', 'photoIdea'],
        additionalProperties: false,
      },
    },
  },
  required: ['posts'],
  additionalProperties: false,
};

function systemBlocks(b) {
  const examples = (b.examples || []).map(p => '[' + p.bucket + '] ' + (p.hook ? 'Hook: ' + p.hook + '\n' : '') + p.post).join('\n\n---\n\n');
  const blocks = [{ type: 'text', text:
    'You write social media posts for ' + b.clientFull + '. A person on the agency team reviews every draft before it is posted, ' +
    'so write strong first drafts they only need to tweak.\n\n' +
    'Voice: follow the messaging guide when there is one; it is authoritative. The past posts show the voice, rhythm, length, ' +
    'audience and recurring programs in practice. Match how they sound.\n\n' +
    'Facts: never invent events, dates, names, statistics, prices or quotes. You may mention programs and traditions that ' +
    'appear in the guide or the past posts. When a post needs a detail you do not have, write [CONFIRM: what is needed] in its place.\n\n' +
    'Each post has: a bucket (one of: ' + b.buckets.join(', ') + '); a hook, the headline printed on the graphic, 3 to 10 words, ' +
    'no hashtags or emojis; the caption, written like the past posts, usually 60 to 150 words, short paragraphs, ending with a clear ' +
    'call to action, hashtags only if the past posts use them; and a photo idea, one short line describing an ordinary photo from ' +
    'their own library that would suit it (for example: a child working on math at a desk; families at a project table).' }];
  if (examples) blocks.push({ type: 'text', text: 'PAST POSTS:\n\n' + examples });
  return blocks;
}

/**
 * The request's system prompt and first user content. A text guide joins the system prompt;
 * a PDF guide (a document block, which the system prompt can't hold) leads the user message.
 * Everything up to the varying request text is the same for a whole month's drafting, so it
 * is marked for caching.
 */
function promptParts(b, userText) {
  const system = systemBlocks(b), docs = [];
  guideBlocks(b.client).forEach(x => (x.type === 'text' ? system : docs).push(x));
  (docs.length ? docs : system)[(docs.length ? docs : system).length - 1].cache_control = { type: 'ephemeral' };
  return { system: system, content: docs.concat([{ type: 'text', text: userText }]) };
}

function claude(parts, maxTokens) {
  const key = PROPS.getProperty('ANTHROPIC_API_KEY');
  if (!key) throw new Error('No ANTHROPIC_API_KEY set in the script properties');
  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      // if a safety classifier declines, the API retries on its recommended fallback model
      'anthropic-beta': 'server-side-fallback-2026-07-01',
    },
    payload: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens || 16000,
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: POST_SCHEMA } },
      system: parts.system,
      messages: [{ role: 'user', content: parts.content }],
    }),
  });
  const j = JSON.parse(res.getContentText());
  if (res.getResponseCode() !== 200) throw new Error((j.error && j.error.message) || ('Claude API ' + res.getResponseCode()));
  if (j.stop_reason === 'refusal') throw new Error('Claude declined to write this one');
  if (j.stop_reason === 'max_tokens') throw new Error('The draft ran too long; try fewer posts at a time');
  const text = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
  return JSON.parse(text).posts;
}

/**
 * b: { client, clientFull, month (label), dates:[{iso, day}], buckets:[…], examples:[{bucket,hook,post}],
 *      already:[{iso,bucket,hook,post}] (posts drafted so far this month), notes }
 */
function aiDraft(b) {
  const already = (b.already || []).map(p => '- ' + p.iso + ' [' + p.bucket + '] ' + p.hook + ': ' + String(p.post).slice(0, 140)).join('\n');
  const user =
    'Draft posts for ' + b.month + ', one for each of these dates:\n' +
    b.dates.map(d => '- ' + d.iso + ' (' + d.day + ')').join('\n') + '\n\n' +
    (b.notes ? 'What is happening this month (use these; do not add others): ' + b.notes + '\n\n' : '') +
    (already ? 'Already written for this month (do not repeat these topics, hooks or openings):\n' + already + '\n\n' : '') +
    'Across the month, balance the buckets, include enrollment and practical parent help, and fit the season ' +
    '(holidays and school-year moments in ' + b.month + '). Use each date exactly as given.';
  return { ok: true, posts: claude(promptParts(b, user)) };
}

/** b: { client, clientFull, buckets, examples, post:{iso,bucket,hook,post,photoIdea}, instruction } */
function aiRewrite(b) {
  const p = b.post;
  const user =
    'Rewrite this post. Instruction: ' + (b.instruction || 'make it better') + '\n\n' +
    'Date: ' + p.iso + '\nBucket: ' + p.bucket + '\nHook: ' + p.hook + '\nPhoto idea: ' + (p.photoIdea || '') + '\nCaption:\n' + p.post +
    '\n\nReturn exactly one post with the same date.';
  return { ok: true, posts: claude(promptParts(b, user), 8000) };
}

// ---------- the client report ----------
// A Google Sheet in the month's folder: one row per post with the date, bucket, headline,
// post text and the graphic side by side, plus a column for the client's notes. Anyone with
// the link can view and comment. Building it again updates the same sheet, so a link already
// sent to the client keeps working.

/** b: { client, clientFull, month (label), rows:[{ date, day, bucket, hook, post, fileId }] } */
function reportSheet(b) {
  const folder = child(clientFolder(b.client), b.month);
  const name = b.client + ' \u2014 ' + b.month + ' social calendar';
  const found = folder.getFilesByName(name);
  let ss;
  if (found.hasNext()) ss = SpreadsheetApp.openById(found.next().getId());
  else {
    ss = SpreadsheetApp.create(name);
    DriveApp.getFileById(ss.getId()).moveTo(folder);
  }
  const sh = ss.getSheets()[0];
  sh.clear();
  sh.setName(b.month);
  sh.getRange(1, 1).setValue((b.clientFull || b.client) + ' \u2014 ' + b.month + ' social calendar').setFontSize(16).setFontWeight('bold');
  sh.getRange(2, 1).setValue('Please add any changes or approvals in the Client notes column, or as comments.').setFontColor('#666666');
  const head = ['Date', 'Day', 'Bucket', 'Headline on the graphic', 'Post text', 'Graphic', 'Client notes'];
  sh.getRange(4, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#eef5f8');
  const rows = b.rows.map(r => [r.date, r.day, r.bucket, r.hook || '(photo only)', r.post,
    r.fileId ? '=IMAGE("https://drive.google.com/thumbnail?id=' + r.fileId + '&sz=w1000")' : 'Graphic coming', '']);
  if (rows.length) {
    sh.getRange(5, 1, rows.length, head.length).setValues(rows).setVerticalAlignment('top').setWrap(true);
    sh.setRowHeights(5, rows.length, 300);
  }
  [95, 90, 120, 190, 420, 300, 220].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.setFrozenRows(4);
  try { DriveApp.getFileById(ss.getId()).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.COMMENT); } catch (err) {}
  return { ok: true, url: ss.getUrl() };
}
