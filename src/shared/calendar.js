// ---------- the social calendar ----------
// Karissa's posting schedule lives in a Google Sheet, one tab per month, shared as
// "anyone with the link can view". The studio reads it straight from the browser through
// the gviz CSV endpoint, which needs no key and answers with CORS headers.
//
// Three things about that endpoint shape this code:
//   * when the named tab does not exist it silently returns the FIRST sheet rather than an
//     error, so every month is verified against the dates that come back before it is used;
//   * it drops fully empty leading rows, so the header row is not where the sheet's own row
//     numbers say it is. The header row is found by its contents, and the configured column
//     letters are only a fallback for headers that never made it into the sheet (DATE has no
//     header text of its own);
//   * tab names are inconsistent ("September 2026" but "Oct 2026"), so both spellings are
//     tried and whichever one validates wins.
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_ABBR = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
// Each studio names its own buckets and their dot colours in STUDIO.buckets:
// [[prefix, label, colour], …] — a bucket matches when its name starts with the prefix.
const BUCKETS = (typeof STUDIO !== 'undefined' && STUDIO.buckets) || [];
const CAL = { months:[], cur:null, view:null, state:'idle', note:'', probing:false };

// clients.js is loaded at the end of the body, so this resolves lazily rather than at parse
// time. A client with no calendar block simply doesn't get the panel.
function calCfg(){
  if (typeof CLIENT_EDIT !== 'undefined' && CLIENT_EDIT) return null;     // a client editing one graphic gets no calendar
  const c = (window.BI_CLIENTS || []).find(x => x.slug === STUDIO.slug);
  return (c && c.calendar) || null;
}
function bucketOf(name){
  const s = (name || '').toLowerCase();
  if (!s) return null;
  return BUCKETS.find(b => s.startsWith(b[0])) || null;
}

// Google's CSV: quoted fields, doubled quotes inside them, and real newlines inside a field.
function parseCsv(text){
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i+1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const colLetter = (s) => { let n = 0; for (const ch of String(s).toUpperCase()) n = n*26 + (ch.charCodeAt(0)-64); return n-1; };
const monthKey = (y, m) => y + '-' + m;
function isoDate(d){
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function tabNames(y, m){ return [MONTHS[m] + ' ' + y, MONTHS[m].slice(0,3) + ' ' + y]; }
function tabUrl(sheetId, tab){
  return 'https://docs.google.com/spreadsheets/d/' + sheetId +
         '/gviz/tq?tqx=out:csv&headers=0&sheet=' + encodeURIComponent(tab);
}
// M/D/YY or M/D/YYYY, which is what gviz gives for these cells whether they were typed or
// came out of a formula.
function parseDate(s){
  const m = String(s).trim().match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (!m) return null;
  let y = +m[3]; if (y < 100) y += 2000;
  const d = new Date(y, +m[1]-1, +m[2]);
  return isNaN(d) ? null : d;
}
function readTab(text, cfg, y, m, info){
  const rows = parseCsv(text);
  const hdr = rows.findIndex(r => r.some(c => /HOOK\s*TEXT/i.test(c)) && r.some(c => /^\s*POST\s*$/i.test(c)));
  if (hdr < 0) return null;
  const head = rows[hdr].map(c => c.trim().toUpperCase());
  const at = (name, letter) => { const i = head.indexOf(name); return i >= 0 ? i : colLetter(cfg.cols[letter]); };
  const ci = { week:at('WEEK','week'), day:at('DAY','day'), date:at('DATE','date'),
               bucket:at('BUCKET','bucket'), hook:at('HOOK TEXT','hook'), post:at('POST','post') };
  const cell = (r, i) => (i >= 0 && i < r.length ? r[i].trim() : '');
  // An "x" in HOOK TEXT means this post's graphic carries no headline at all — photo only.
  // An empty cell just means nobody has written one yet, so the phrase bank suggests one.
  const markOf = r => /^[x\u2713\u2714]$/i.test(cell(r, ci.hook));
  const hookOf = r => { const t = cell(r, ci.hook); return markOf(r) || /^[-\u2013\u2014.]$/.test(t) ? '' : t; };
  const posts = [];
  for (const r of rows.slice(hdr+1)) {
    const d = parseDate(cell(r, ci.date));
    if (!d) continue;
    posts.push({ date:d, iso:isoDate(d), week:parseInt(cell(r, ci.week), 10) || null, day:cell(r, ci.day),
                 bucket:cell(r, ci.bucket), hook:hookOf(r), noHead:markOf(r), post:cell(r, ci.post) });
  }
  if (!posts.length) return null;
  // gviz answers a missing tab with the first sheet, so the dates decide whether this really
  // is the month that was asked for
  const mine = posts.filter(p => p.date.getFullYear() === y && p.date.getMonth() === m);
  if (info) info.posts = posts;
  return mine.length >= posts.length/2 ? mine : null;
}

// ---------- discovery ----------
// Every month tab from two back to three ahead is probed at once, both spellings, and the
// posts are kept. A tab added to the sheet later shows up on the next reload with nothing
// to change here.
async function tryMonth(cfg, y, m){
  const got = await Promise.all(tabNames(y, m).map(async tab => {
    try {
      const r = await fetch(tabUrl(cfg.sheetId, tab), { cache:'no-store' });
      if (!r.ok) return null;
      const info = {};
      const posts = readTab(await r.text(), cfg, y, m, info);
      if (posts) return { tab, posts };
      // A tab duplicated from last month and not yet re-dated: its dates are all the month
      // before. (A missing tab comes back as the sheet's first tab, which isn't that.)
      const prev = new Date(y, m-1, 1), all = info.posts || [];
      const stale = all.length && all.filter(p => p.date.getFullYear() === prev.getFullYear() && p.date.getMonth() === prev.getMonth()).length >= all.length/2;
      return stale ? { tab, stale:true } : null;
    } catch { return null; }
  }));
  const hit = got.find(g => g && !g.stale);
  if (!hit) { const st = got.find(g => g && g.stale); return st ? { y, m, label:MONTHS[m] + ' ' + y, tab:st.tab, stale:true } : null; }
  hit.posts.sort((a,b) => a.date - b.date);
  return { y, m, key:monthKey(y,m), label:MONTHS[m] + ' ' + y, tab:hit.tab, posts:hit.posts };
}
async function discoverMonths(){
  const cfg = calCfg(); if (!cfg) return [];
  const now = new Date();
  // this month and what's ahead of it; once a month has gone by its tab is done with
  const want = [];
  for (let i = 0; i <= 5; i++) { const d = new Date(now.getFullYear(), now.getMonth()+i, 1); want.push([d.getFullYear(), d.getMonth()]); }
  const found = cfg.sheetId ? await Promise.all(want.map(([y,m]) => tryMonth(cfg, y, m))) : [];
  CAL.stale = found.filter(f => f && f.stale);
  // a month kept in the generator takes the place of the sheet's tab for that month
  const app = await storeMonths().catch(() => []);
  const keys = new Set(app.map(m => m.key));
  CAL.stale = CAL.stale.filter(s => !keys.has(monthKey(s.y, s.m)));
  return found.filter(f => f && !f.stale && !keys.has(f.key)).concat(app).sort((a,b) => (a.y - b.y) || (a.m - b.m));
}

// ---------- the month grid ----------
// Monday-start weeks. The row labels come from the sheet's own WEEK column rather than being
// counted here: on a month that opens on a Sunday the sheet skips the stub week, so counting
// would be one out. Rows without a post take their number from the offset to a row that has one.
function buildGrid(month){
  const first = new Date(month.y, month.m, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay()+6) % 7));
  const rows = [];
  for (let r = 0; r < 6; r++) {
    const days = [];
    for (let c = 0; c < 7; c++) { const d = new Date(start); d.setDate(start.getDate() + r*7 + c); days.push(d); }
    if (!days.some(d => d.getMonth() === month.m && d.getFullYear() === month.y)) { if (rows.length) break; else continue; }
    const iso = days.map(isoDate);
    rows.push({ days, iso, posts: month.posts.filter(p => iso.includes(p.iso)), label:null });
  }
  const anchor = rows.findIndex(r => r.posts.some(p => p.week));
  if (anchor >= 0) {
    const base = rows[anchor].posts.find(p => p.week).week;
    rows.forEach((r, i) => { const n = base + (i - anchor); r.label = n > 0 ? n : null; });
  } else rows.forEach((r, i) => { r.label = i + 1; });
  return rows;
}
function curMonth(){ return CAL.months.find(x => x.key === CAL.cur) || null; }
function curGrid(){ const m = curMonth(); return m ? (m._grid || (m._grid = buildGrid(m))) : []; }
function viewPosts(){
  const m = curMonth(); if (!m || !CAL.view) return [];
  if (CAL.view.kind === 'day') { const p = m.posts.find(x => x.iso === CAL.view.iso); return p ? [p] : []; }
  const row = curGrid()[CAL.view.row];
  return row ? row.posts : [];
}
function selectedPost(){
  const v = viewPosts();
  if (!v.length) return null;
  if (CAL.view && CAL.view.kind === 'day') return v[0];
  return v.find(p => p.iso === CAL.view.used) || null;
}

// Which posts already have a graphic. Local to this browser for now; phase 2 replaces this
// with what is actually sitting in the Drive folder.
let calDone = {};
function loadCalDone(){ try { calDone = JSON.parse(localStorage.getItem(LS.calendar || STUDIO.slug + '-calendar-v1') || '{}') || {}; } catch { calDone = {}; } }
function saveCalDone(){ try { localStorage.setItem(LS.calendar || STUDIO.slug + '-calendar-v1', JSON.stringify(calDone)); } catch {} }
function doneKey(p){ return ((calCfg() || {}).sheetId || STUDIO.slug) + '|' + p.iso; }
function isDone(p){ return !!calDone[doneKey(p)] || !!p.graphic; }
function markPostDone(p){ if (!p) return; calDone[doneKey(p)] = Date.now(); saveCalDone(); renderCalendar(); }

// ---------- the headline for a post with no hook text ----------
// Three things the plain phrase-bank fallback got wrong, all measured against the live sheet:
//
//   * the BUCKET column is an explicit label and was being ignored. Guessing the topic from
//     the caption instead disagreed with it on 37 of 57 posts;
//   * every caption ends with a call to action ("Message us for tour details", "ask",
//     "comment"), and the caption matcher is first-rule-wins, so it fired on the CTA rather
//     than the body — an Inspiring Growth post about growth mindset came out "Now Enrolling!";
//   * the pick was random, so the same post gave a different headline on every click and a
//     graphic could not be made again.
//
// So: the bucket decides the topic, the caption is only consulted when the bucket is blank
// and then only its body, and the choice is seeded from the date so a post always suggests
// the same thing.
// STUDIO.bucketTopics maps a bucket name to one of the studio's phrase-bank topics.
function topicForBucket(bucket){
  const map = STUDIO.bucketTopics || {};
  for (const part of String(bucket || '').split(/[\/,&]+/)) {
    const t = map[part.trim().toLowerCase()];
    if (t) return t;
  }
  return null;
}
// Cut the caption at its call to action or hashtags, so the topic comes from what the post
// is about rather than how it signs off.
function captionBody(txt){
  const t = String(txt || '');
  const cut = t.search(/\n\s*(?:\u{1F449}|#)|(?:wondering|curious|want to|ready to|interested|message us|send us|dm us|book a|schedule a|learn more|tour details)/iu);
  return (cut > 40 ? t.slice(0, cut) : t).trim();
}
// A stable pick: same post, same suggestion, every time.
function seededPick(list, seed){
  let x = 0;
  for (const ch of String(seed)) x = (x*31 + ch.charCodeAt(0)) % 2147483647;
  return list[x % list.length];
}
function headlineFor(p){
  if (p.noHead) return '';
  if (p.hook) return p.hook;
  const first = Object.keys(BANK)[0];
  const topic = topicForBucket(p.bucket) || detectTopic(captionBody(p.post)) || first;
  const heads = (BANK[topic] && BANK[topic].heads) || BANK[first].heads;
  return seededPick(heads, p.iso + '|' + topic);
}

// Choosing a post fills the headline box from its hook text, and falls back to the phrase
// bank when the sheet has none yet. The box stays editable either way.
function usePost(iso){
  const m = curMonth(); if (!m) return;
  const p = m.posts.find(x => x.iso === iso); if (!p) return;
  if (p.noHead) {
    // nothing to write on the page: leave the canvas alone and point at the photo-only options
    if (CAL.view && CAL.view.kind === 'week' && curGrid()[CAL.view.row]?.iso.includes(iso)) CAL.view.used = iso;
    else CAL.view = { kind:'day', iso };
    renderCalendar();
    toast('No headline for this post (x in the sheet)' + (STUDIO.specsFor ? '. Press Generate from calendar for photo-only options.' : ''));
    return;
  }
  // staying inside the open week just moves the choice along it; anything else is a day view
  const row = CAL.view && CAL.view.kind === 'week' ? curGrid()[CAL.view.row] : null;
  if (row && row.iso.includes(iso)) CAL.view.used = iso;
  else CAL.view = { kind:'day', iso };
  pushUndo();
  const head = headlineFor(p);
  // the studio decides which of its layouts carries a headline; this is the fallback
  if (STUDIO.applyHeadline) STUDIO.applyHeadline(head);
  else {
    if (!byId('headline')) { S.template = STUDIO.headlineTemplate || 'headline'; templateDefaults(); }
    layout();
    const el = byId('headline'); if (el) el.text = head;
  }
  renderQuickFields(); syncControls(); renderInspector(); render(); persist();
  renderCalendar();
}

// e.g. SpringForth_2026-10-05_Mon.png, so a month's graphics sort by date in the Drive folder.
function postFilename(p){ return STUDIO.filePrefix + '_' + p.iso + '_' + DAY_ABBR[p.date.getDay()] + '.png'; }
function calFilename(){ const p = selectedPost(); return p ? postFilename(p) : null; }

// ---------- where to open ----------
// The current week's post, or — once the month is winding down and next month's tab is
// there — next month's first week, which is what Karissa is actually working on by then.
function openDefault(){
  const now = new Date(); now.setHours(0,0,0,0);
  const here = CAL.months.find(x => x.y === now.getFullYear() && x.m === now.getMonth());
  if (now.getDate() >= 15) {
    const nx = new Date(now.getFullYear(), now.getMonth()+1, 1);
    const next = CAL.months.find(x => x.y === nx.getFullYear() && x.m === nx.getMonth());
    if (next) { CAL.cur = next.key; const g = curGrid(); const row = g.findIndex(r => r.posts.length); CAL.view = { kind:'week', row: row < 0 ? 0 : row }; return; }
  }
  const month = here || CAL.months[0];          // if this month has no tab, start at the next one that does
  if (!month) return;
  CAL.cur = month.key;
  const g = curGrid();
  const row = g.findIndex(r => r.iso.includes(isoDate(now)));
  if (row >= 0 && g[row].posts.length) {
    const p = g[row].posts.find(x => x.date >= now) || g[row].posts[0];
    CAL.view = { kind:'day', iso:p.iso };
  } else {
    const nextP = month.posts.find(p => p.date >= now) || month.posts[0];
    CAL.view = nextP ? { kind:'day', iso:nextP.iso } : { kind:'week', row:0 };
  }
}

// ---------- panel ----------
// "November 2026 is still a copy of October": said in the panel instead of quietly skipping it.
function staleNote(){
  return (CAL.stale || []).map(s => ' \u00b7 \u26a0 \u201c' + s.tab + '\u201d still has ' + MONTHS[(s.m + 11) % 12]
    + '\u2019s dates. Change its first DATE to ' + MONTHS[s.m] + ' and it will appear').join('');
}
function renderCalendar(){
  updateCalGen();
  const sec = $('#calSec'); if (!sec) return;
  if (!calCfg()) { sec.hidden = true; return; }
  sec.hidden = false;
  renderStoreButtons(); updateDriveLabel();
  const status = $('#calStatus'), grid = $('#calGrid'), detail = $('#calDetail'), sel = $('#calMonth');
  if (CAL.state === 'loading') { status.textContent = 'Reading the calendar…'; grid.innerHTML = ''; detail.innerHTML = ''; return; }
  if (CAL.state === 'offline') { status.textContent = 'Couldn’t reach the calendar. You can still type a headline yourself.'; grid.innerHTML = ''; detail.innerHTML = ''; return; }
  if (!CAL.months.length) { status.textContent = (STORE.ready && STORE.ai ? 'No calendar for this month yet. Draft one with AI, or ' : 'No month tabs found in the sheet. ') + 'type a headline yourself.' + staleNote(); grid.innerHTML = ''; detail.innerHTML = ''; return; }

  sel.innerHTML = '';
  for (const m of CAL.months) sel.append(h('option',{value:m.key}, m.label));
  sel.value = CAL.cur;
  const i = CAL.months.findIndex(x => x.key === CAL.cur);
  $('#calPrev').disabled = i <= 0;
  $('#calNext').disabled = i < 0 || i >= CAL.months.length-1;

  const month = curMonth();
  const photoOnly = month.posts.filter(p => p.noHead).length;
  const blank = month.posts.filter(p => !p.hook && !p.noHead).length;
  status.textContent = month.source === 'app' ? calStatusText(month) + staleNote()
    : month.posts.length + ' post' + (month.posts.length === 1 ? '' : 's') + ' · tab “' + month.tab + '”'
    + (photoOnly ? ' · ' + photoOnly + ' photo only (x)' : '')
    + (blank ? ' · ' + blank + ' with no hook text yet' : '') + staleNote();

  grid.innerHTML = '';
  grid.append(h('div',{class:'cg-corner'}, ''));
  for (const d of DOW) grid.append(h('div',{class:'cg-dow'}, d));
  const today = isoDate(new Date());
  curGrid().forEach((row, r) => {
    const on = CAL.view && CAL.view.kind === 'week' && CAL.view.row === r;
    grid.append(h('button',{class:'cg-wk','aria-pressed':String(!!on),disabled:!row.posts.length,
      title:row.posts.length ? 'Show this week’s posts' : 'No posts this week',
      onclick:()=>{ CAL.view = { kind:'week', row:r }; renderCalendar(); }},
      row.label ? 'Wk' + row.label : ''));
    row.days.forEach((d, c) => {
      const iso = isoDate(d);
      const p = row.posts.find(x => x.iso === iso);
      const out = d.getMonth() !== month.m || d.getFullYear() !== month.y;
      const b = p ? bucketOf(p.bucket) : null;
      const cls = ['cg-day']; if (out) cls.push('out'); if (p) cls.push('has');
      if (iso === today) cls.push('today');
      const on = CAL.view && ((CAL.view.kind === 'day' && CAL.view.iso === iso) ||
                              (CAL.view.kind === 'week' && CAL.view.row === r && p));
      const cell = h('button',{class:cls.join(' '),'aria-pressed':String(!!on),disabled:!p,
        title:p ? (p.bucket || 'Post') + ': ' + (p.noHead ? 'photo only, no headline' : p.hook || 'no hook text yet') : '',
        onclick:()=>{ if (p) usePost(iso); }},
        h('span',{class:'cg-num'}, String(d.getDate())));
      if (p) cell.append(isDone(p)
        ? h('span',{class:'cg-tick',title:'Graphic downloaded'}, '✓')
        : h('span',{class:'cg-dot',style:'background:' + (b ? b[2] : '#8fa3ad')}));
      grid.append(cell);
    });
  });

  const legend = $('#calLegend'); legend.innerHTML = '';
  for (const [,label,color] of BUCKETS)
    legend.append(h('span',{class:'cg-key'}, h('i',{style:'background:'+color}), label));

  detail.innerHTML = '';
  const posts = viewPosts();
  if (!posts.length) { detail.append(h('p',{class:'hint'}, 'Pick a day with a dot to load that post.')); if (month.source === 'app') monthTools(detail, month); return; }
  // In a week view the posts sit side by side as compact cards — the rail is too narrow to
  // carry two captions at once, so the caption below follows whichever one is chosen.
  const shown = posts.find(p => p.iso === CAL.view.used) || posts[0];
  const wrap = h('div',{class:'cd-wrap' + (posts.length > 1 ? ' cd-side' : '')});
  for (const p of posts) {
    const b = bucketOf(p.bucket);
    const loaded = CAL.view.kind === 'day' || CAL.view.used === p.iso;
    wrap.append(h('button',{class:'cd-card' + (p === shown ? ' on' : ''),onclick:()=>usePost(p.iso),
      title: loaded ? 'Reload this headline' : 'Load this post'},
      h('span',{class:'cd-head'},
        h('b',{}, DAY_ABBR[p.date.getDay()] + ' ' + (p.date.getMonth()+1) + '/' + p.date.getDate()),
        h('span',{class:'cd-bucket',style:b ? 'color:'+b[2] : ''}, p.bucket || '')),
      h('span',{class:'cd-hook'}, p.noHead ? 'Photo only, no headline' : p.hook || 'No hook text yet'),
      h('span',{class:'cd-use'}, p.noHead ? 'Photo only' : loaded ? '\u2713 headline loaded' : 'Use this post')));
  }
  detail.append(wrap);
  if (STUDIO.specsFor) detail.append(h('button',{class:'btn gen sm cd-gen',onclick:generateFromPost,
    title:'Three graphics matched to this post\u2019s caption and bucket'}, 'Generate options for this post'));
  // a month kept in the generator is edited right here; a sheet month is read-only
  if (month.source === 'app') { if (shown) calEditor(detail, shown, month); monthTools(detail, month); return; }
  if (shown && shown.post) {
    detail.append(h('div',{class:'subh'}, 'Post text \u00b7 ' + DAY_ABBR[shown.date.getDay()] + ' ' + (shown.date.getMonth()+1) + '/' + shown.date.getDate(),
      h('button',{class:'btn link',onclick:async()=>{
        try { await navigator.clipboard.writeText(shown.post); toast('Post text copied'); }
        catch { toast('Couldn\u2019t copy. Select the text and copy it by hand.'); }
      }}, 'Copy')));
    detail.append(h('p',{class:'cal-post'}, shown.post));
  }
}

// ---------- staying in step with the sheet ----------
// The sheet is edited while the studio is open, so it is re-read on a timer and whenever the
// tab comes back to the front. Whatever Karissa is looking at is kept: same month, same day
// or week, and the headline on the canvas is left alone unless that post's hook text has
// actually changed in the sheet.
let calBusy = false, calLastSync = 0;
function postSig(list){ return list.map(p => p.iso + '\u0001' + p.bucket + '\u0001' + p.hook).join('\u0002'); }
async function refreshCalendar(reason){
  if (calBusy || !calCfg()) return;
  // don't pull the rug out from under someone typing in the post editor, or a pending save
  if (reason !== 'manual' && (storeTimer || document.activeElement?.closest?.('#calDetail, #calDraft'))) return;
  calBusy = true;
  const btn = $('#calSync'); if (btn) btn.disabled = true;
  const wasCur = CAL.cur, wasView = CAL.view && Object.assign({}, CAL.view);
  const before = new Map(CAL.months.map(m => [m.key, postSig(m.posts)]));
  try {
    const fresh = await discoverMonths();
    // keep the open copy of a generator month unless the shared copy is newer
    const months = fresh.map(m => { const was = CAL.months.find(x => x.key === m.key && x.source === 'app');
      return was && m.source === 'app' && was.rev >= m.rev ? was : m; });
    if (months.length) {
      const added = months.filter(m => !before.has(m.key)).map(m => m.label);
      const changed = months.filter(m => before.has(m.key) && before.get(m.key) !== postSig(m.posts)).map(m => m.label);
      CAL.months = months; CAL.state = 'ready';
      if (months.some(m => m.key === wasCur)) { CAL.cur = wasCur; CAL.view = wasView; }
      else openDefault();
      // if the post on screen now has hook text in the sheet, take it
      const p = selectedPost();
      if (p && p.hook && byId('headline') && byId('headline').text !== p.hook) {
        byId('headline').text = p.hook; renderQuickFields(); render();
      }
      renderCalendar();
      if (reason === 'manual') toast(added.length || changed.length ? 'Calendar updated' : 'Calendar is up to date');
      else if (added.length) toast('Calendar: ' + added.join(', ') + ' added');
      else if (changed.length) toast('Calendar: ' + changed.join(', ') + ' updated');
    } else if (reason === 'manual') toast('Couldn\u2019t read the calendar just now');
    calLastSync = Date.now();
  } catch { if (reason === 'manual') toast('Couldn\u2019t reach the calendar'); }
  finally { calBusy = false; if (btn) btn.disabled = false; }
}
function watchCalendar(){
  setInterval(() => { if (!document.hidden) refreshCalendar('timer'); }, 5*60*1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - calLastSync > 60*1000) refreshCalendar('focus');
  });
}

async function wireCalendar(){
  if (!window.BI_CLIENTS) await new Promise(r => window.addEventListener('load', r, { once:true }));
  const cfg = calCfg();
  if (!cfg) { const sec = $('#calSec'); if (sec) sec.hidden = true; return; }
  loadCalDone();
  $('#calOpen').hidden = !cfg.url;
  $('#calOpen').addEventListener('click', () => window.open(cfg.url, '_blank', 'noopener'));
  $('#calSync').addEventListener('click', () => refreshCalendar('manual'));
  $('#calMonth').addEventListener('change', e => { CAL.cur = e.target.value; CAL.view = { kind:'week', row:0 }; const g = curGrid(); const r = g.findIndex(x => x.posts.length); CAL.view.row = r < 0 ? 0 : r; renderCalendar(); });
  const step = (d) => { const i = CAL.months.findIndex(x => x.key === CAL.cur) + d;
    if (i < 0 || i >= CAL.months.length) return;
    CAL.cur = CAL.months[i].key; const g = curGrid(); const r = g.findIndex(x => x.posts.length);
    CAL.view = { kind:'week', row: r < 0 ? 0 : r }; renderCalendar(); };
  $('#calPrev').addEventListener('click', () => step(-1));
  $('#calNext').addEventListener('click', () => step(1));
  CAL.state = 'loading'; renderCalendar();
  await storeInit();
  try {
    CAL.months = await discoverMonths();
    CAL.state = CAL.months.length ? 'ready' : 'empty';
  } catch { CAL.state = 'offline'; }
  if (CAL.state === 'ready') openDefault();
  calLastSync = Date.now();
  renderCalendar();
  watchCalendar();
}

// Every studio carries this module; it only does anything for a client whose clients.js
// entry has a calendar block.
window.addEventListener('load', () => { wireCalendar(); });
