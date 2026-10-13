// ---------- the generator's own calendar (shared) ----------
// Months can live in the generator instead of the Google Sheet. Each one is a file in the
// Drive folder, read and written through the backend (apps-script/), so everyone who opens the
// studio sees the same posts. Claude drafts a month on request; every post stays editable
// here. A month in the generator takes the place of the sheet's tab for that month.

const STORE = { ready:false, ai:false, guide:false, status:'' };
const DAY_FULL = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
const storeKey = (y, m) => y + '-' + String(m+1).padStart(2, '0');

async function storeInit(){
  STORE.ready = false;
  if (!driveCfg() || !drivePass(false)) return false;
  try {
    const j = await drivePost({ action:'ping', client:STUDIO.name }, false);
    STORE.ready = true; STORE.ai = !!j.ai; STORE.guide = !!j.guide; STORE.app = !!j.app;
  } catch { STORE.ready = false; }
  return STORE.ready;
}

function postFromStore(x){
  const [y, mo, d] = x.iso.split('-').map(Number);
  const date = new Date(y, mo-1, d);
  return { id: x.id || ('p' + Math.random().toString(36).slice(2, 9)), date, iso: x.iso, week: null, day: DAY_FULL[date.getDay()],
           bucket: x.bucket || '', hook: x.noHead ? '' : (x.hook || ''), noHead: !!x.noHead, post: x.post || '',
           photoIdea: x.photoIdea || '', approved: !!x.approved, graphic: x.graphic || null, design: x.design || null,
           client: x.client || null };
}
function monthFromStore(data){
  const [y, mo] = data.month.split('-').map(Number), m = mo - 1;
  return { y, m, key: monthKey(y, m), label: MONTHS[m] + ' ' + y, tab: 'generator calendar', source:'app',
           rev: data.rev || 0, approved: !!data.approved, posts: (data.posts || []).map(postFromStore).sort((a,b) => a.date - b.date) };
}
function storeFromMonth(month){
  return { approved: !!month.approved, posts: month.posts.map(p => ({ id:p.id, iso:p.iso, bucket:p.bucket, hook:p.hook, noHead:!!p.noHead,
           post:p.post, photoIdea:p.photoIdea || '', approved:!!p.approved, graphic:p.graphic || null, design:p.design || null,
           client:p.client || null })) };
}

// The generator's months from this one on.
async function storeMonths(){
  if (!STORE.ready) return [];
  const now = new Date(), from = storeKey(now.getFullYear(), now.getMonth());
  const j = await drivePost({ action:'cal.list', client:STUDIO.name }, false);
  const keys = (j.months || []).map(x => x.month).filter(k => k >= from).sort();
  const got = await Promise.all(keys.map(k => drivePost({ action:'cal.get', client:STUDIO.name, month:k }, false).catch(() => null)));
  return got.filter(g => g && g.data).map(g => monthFromStore(g.data));
}

// ---------- saving ----------
let storeTimer = null;
function touchMonth(month){
  month._grid = null;
  month.posts.sort((a,b) => a.date - b.date);
  STORE.status = 'Saving…'; renderCalendarStatusOnly();
  clearTimeout(storeTimer);
  storeTimer = setTimeout(() => saveMonth(month), 1200);
}
async function saveMonth(month){
  storeTimer = null;
  // one save at a time: a change made while one is in flight goes out right after it
  if (STORE.saving) { STORE.pending = month; return; }
  STORE.saving = true;
  try {
    const j = await drivePost({ action:'cal.save', client:STUDIO.name, month: storeKey(month.y, month.m), data: storeFromMonth(month), rev: month.rev }, false);
    month.rev = j.rev; STORE.status = 'Saved ✓';
  } catch (err) {
    if (/conflict/i.test(err.message) && err.data) {
      Object.assign(month, monthFromStore(err.data));
      STORE.status = 'Someone else changed this month — showing their version';
      toast('Someone else just edited ' + month.label + ' — reloaded their version. Make your change again.');
      renderCalendar(); return;
    }
    STORE.status = 'Not saved — ' + err.message;
  } finally {
    STORE.saving = false;
    if (STORE.pending) { const m = STORE.pending; STORE.pending = null; saveMonth(m); }
  }
  renderCalendarStatusOnly();
}

// ---------- graphics attached to posts ----------
// Saving a graphic for a generator month's post files the PNG in Drive and keeps it, with its
// editable design, on the post, so anyone can see it on that day and reopen it later.
function storableSrc(src){
  if (!src) return null;
  if (src.kind === 'own') return null;                // an uploaded photo is too big to keep here
  return clone(src);
}
function currentDesign(){ return { state: JSON.parse(snapshot()), src: storableSrc(IMG.src) }; }
function attachGraphic(p, saved, design){
  const month = CAL.months.find(m => m.source === 'app' && m.y === p.date.getFullYear() && m.m === p.date.getMonth());
  if (!month || !saved || !saved.id) return;
  const post = month.posts.find(x => x.id === p.id) || month.posts.find(x => x.iso === p.iso);
  if (!post) return;
  post.graphic = { id: saved.id, url: saved.url, savedAt: new Date().toISOString() };
  post.design = design;
  touchMonth(month);
}
const driveThumb = (id, w) => 'https://drive.google.com/thumbnail?id=' + id + '&sz=w' + (w || 400);
// the app keeps graphics itself (/api/file/…); the Apps Script version keeps them in Drive
const graphicSrc = (g, w) => g && g.url && /^\//.test(g.url) ? g.url : driveThumb(g.id, w);

async function openDesign(p){
  const d = p.design; if (!d || !d.state) return;
  pushUndo();
  Object.assign(S, clone(d.state)); S.sel = null;
  IMG.bg = null; IMG.src = d.src ? clone(d.src) : null;
  $('#loading').classList.add('show');
  try {
    if (d.src && d.src.kind === 'lib') IMG.bg = await libImage(d.src.url);
    await Promise.all(S.els.filter(e => e.type === 'image').map(e => libImage(e.src).catch(() => null)));
    if (S.bg.cells) await Promise.all(S.bg.cells.map(c => libImage(c.url).catch(() => null)));
  } catch { toast('A photo in this design couldn\u2019t be loaded'); }
  finally { $('#loading').classList.remove('show'); }
  hideWelcome(); currentDraftId = null;
  syncControls(); renderInspector(); renderResults(); renderQuickFields(); fitCanvas();
  toast('Opened the saved design for ' + postLabel(p) + ' \u2014 Save to ' + postLabel(p) + ' again when you\u2019re done');
}
function renderCalendarStatusOnly(){ const m = curMonth(); if (m && m.source === 'app') $('#calStatus').textContent = calStatusText(m); }

// ---------- the panel's status line for a generator month ----------
function calStatusText(month){
  const ok = month.posts.filter(p => p.approved).length;
  const cOk = month.posts.filter(p => p.client && p.client.decision === 'approved').length;
  const cCh = month.posts.filter(p => p.client && p.client.decision === 'changes').length;
  return month.posts.length + ' post' + (month.posts.length === 1 ? '' : 's') + ' · in the generator'
    + ' · ' + (month.approved ? 'month approved ✓' : ok + ' of ' + month.posts.length + ' approved')
    + (cOk || cCh ? ' · client: ' + cOk + ' approved' + (cCh ? ', ' + cCh + ' with changes' : '') : '')
    + (STORE.status ? ' · ' + STORE.status : '');
}

// ---------- the editor (a generator month's post, in the panel) ----------
function bucketLabels(){ return (STUDIO.buckets || []).map(b => b[1]); }
function calEditor(detail, p, month){
  const edit = (fn) => { fn(); touchMonth(month); };
  const field = (label, node) => h('div',{class:'field ce-field'}, h('label',{}, label), node);
  const sel = h('select',{onchange:e=>edit(()=>{ p.bucket = e.target.value; })},
    ...bucketLabels().map(b => h('option',{value:b, selected: b.toLowerCase() === String(p.bucket).toLowerCase()}, b)));
  if (p.bucket && !bucketLabels().some(b => b.toLowerCase() === p.bucket.toLowerCase())) sel.prepend(h('option',{value:p.bucket, selected:true}, p.bucket));
  const hook = h('input',{type:'text', value:p.hook, disabled:p.noHead, placeholder:'Headline on the graphic',
    oninput:e=>edit(()=>{ p.hook = e.target.value; if (selectedPost() === p && byId('headline')) { byId('headline').text = p.hook; renderQuickFields(); render(); } })});
  const noHead = h('label',{class:'ce-check'}, h('input',{type:'checkbox', checked:p.noHead,
    onchange:e=>edit(()=>{ p.noHead = e.target.checked; if (p.noHead) p.hook = ''; renderCalendar(); })}), ' No headline (photo only)');
  const caption = h('textarea',{rows:7, oninput:e=>edit(()=>{ p.post = e.target.value; })}); caption.value = p.post;
  const photo = h('input',{type:'text', value:p.photoIdea, placeholder:'e.g. a child working on math at a desk',
    oninput:e=>edit(()=>{ p.photoIdea = e.target.value; })});
  const date = h('input',{type:'date', value:p.iso, onchange:e=>{ const v = e.target.value; if (!v) return;
    const [y, mo] = v.split('-').map(Number); if (y !== month.y || mo-1 !== month.m) { toast('Keep the date inside ' + month.label); e.target.value = p.iso; return; }
    edit(()=>{ Object.assign(p, postFromStore(Object.assign({}, p, { iso:v }))); CAL.view = { kind:'day', iso:v }; }); renderCalendar(); }});
  const approved = h('label',{class:'ce-check'}, h('input',{type:'checkbox', checked:p.approved,
    onchange:e=>edit(()=>{ p.approved = e.target.checked; renderCalendar(); })}), ' Approved');
  const graphic = p.graphic
    ? h('div',{class:'ce-graphic'},
        h('img',{src:graphicSrc(p.graphic, 400), alt:'Saved graphic', loading:'lazy'}),
        h('div',{class:'ce-gbtns'},
          p.design ? h('button',{class:'btn sm',title:'Put this graphic back on the canvas to change it',onclick:()=>openDesign(p)}, 'Open design') : null,
          h('a',{class:'btn link',href:p.graphic.url,target:'_blank',rel:'noopener'}, STORE.app ? 'Full size' : 'View in Drive')))
    : h('p',{class:'hint',style:'margin:0'}, 'No graphic saved for this day yet \u2014 make one, then \u201cSave to ' + postLabel(p) + '\u201d.');
  const said = p.client
    ? h('div',{class:'ce-client ' + p.client.decision},
        (p.client.decision === 'approved' ? '\u2713 Client approved' : '\u270e Client asked for changes') + (p.client.name ? ' \u2014 ' + p.client.name : ''),
        p.client.note ? h('div',{class:'ce-note'}, '\u201c' + p.client.note + '\u201d') : null)
    : null;
  detail.append(h('div',{class:'ce'},
    said, graphic,
    h('div',{class:'ce-row'}, field('Date', date), field('Bucket', sel)),
    field('Hook text', hook), noHead,
    field('Post text', caption),
    field('Photo idea', photo),
    h('div',{class:'ce-row ce-actions'}, approved,
      STORE.ai ? h('button',{class:'btn sm',title:'Ask Claude to rewrite this post',onclick:()=>rewritePost(p, month)}, '↻ Rewrite with AI…') : null,
      h('button',{class:'btn sm',title:'Copy the post text',onclick:async()=>{ try { await navigator.clipboard.writeText(p.post); toast('Post text copied'); } catch { toast('Couldn’t copy'); } }}, 'Copy'),
      h('button',{class:'btn sm danger',title:'Remove this post from the month',onclick:()=>{ if (!confirm('Delete the ' + postLabel(p) + ' post?')) return;
        month.posts = month.posts.filter(x => x !== p); CAL.view = { kind:'week', row:0 }; touchMonth(month); renderCalendar(); }}, 'Delete'))));
}

function monthTools(detail, month){
  detail.append(h('div',{class:'ce-row ce-month'},
    h('button',{class:'btn sm',title:'Add a post on another date',onclick:()=>addPost(month)}, '+ Add a post'),
    h('button',{class:'btn sm',title:'Copy the month as rows to paste into the Google Sheet (at the DATE column)',onclick:()=>copyForSheet(month)}, 'Copy for Google Sheet'),
    STORE.app
      ? h('button',{class:'btn sm primary',title:'A private link where the client sees each post with its graphic and approves it or asks for changes',onclick:()=>reviewLink(month)}, '\u{1F517} Send for client review')
      : h('button',{class:'btn sm primary',title:'A Google Sheet for the client: date, headline, post text and graphic side by side, open for comments',onclick:()=>reportSheet(month)}, '\u{1F4C4} Client report (Sheet)'),
    h('button',{class:'btn sm',title:'The same report as a page to save as PDF and email',onclick:()=>printReport(month)}, '\u{1F5A8} Printable report'),
    h('label',{class:'ce-check'}, h('input',{type:'checkbox', checked:month.approved, onchange:e=>{ month.approved = e.target.checked; touchMonth(month); renderCalendar(); }}), ' Month approved')));
}

function addPost(month){
  const d = prompt('Date for the new post (day of ' + month.label + ', e.g. 12):');
  const n = parseInt(d, 10); if (!n) return;
  const date = new Date(month.y, month.m, n); if (date.getMonth() !== month.m) { toast('That day isn’t in ' + month.label); return; }
  const p = postFromStore({ iso: isoDate(date), bucket: bucketLabels()[0] || '', hook:'', post:'' });
  month.posts.push(p); CAL.view = { kind:'day', iso:p.iso }; touchMonth(month); renderCalendar();
}

function copyForSheet(month){
  const q = s => '"' + String(s || '').replace(/"/g, '""') + '"';
  const rows = month.posts.map(p => [(p.date.getMonth()+1) + '/' + p.date.getDate() + '/' + p.date.getFullYear(), p.bucket, p.noHead ? 'x' : p.hook, '', q(p.post)].join('\t'));
  navigator.clipboard.writeText(rows.join('\n')).then(() => toast('Copied ' + rows.length + ' rows — click the first DATE cell in the sheet and paste'),
    () => toast('Couldn’t copy'));
}

// ---------- drafting with Claude ----------
async function pastExamples(beforeY, beforeM){
  // the sheet's last few months show the voice and flow; approved generator months too
  const cfg = calCfg(), out = [];
  if (cfg && cfg.sheetId) {
    const want = [];
    for (let i = 1; i <= 4; i++) { const d = new Date(beforeY, beforeM - i, 1); want.push([d.getFullYear(), d.getMonth()]); }
    const got = await Promise.all(want.map(([y, m]) => tryMonth(cfg, y, m).catch(() => null)));
    got.forEach(m => { if (m && !m.stale) m.posts.forEach(p => { if (p.post) out.push({ bucket:p.bucket, hook:p.hook, post:p.post }); }); });
  }
  CAL.months.filter(m => m.source === 'app' && (m.y < beforeY || (m.y === beforeY && m.m < beforeM)))
    .forEach(m => m.posts.forEach(p => { if (p.approved && p.post) out.push({ bucket:p.bucket, hook:p.hook, post:p.post }); }));
  return out.slice(-36);
}

function openDraftForm(){
  const box = $('#calDraft'); box.innerHTML = ''; box.hidden = false;
  const now = new Date(), choices = [];
  for (let i = 0; i <= 4; i++) { const d = new Date(now.getFullYear(), now.getMonth()+i, 1);
    if (!CAL.months.some(m => m.source === 'app' && m.y === d.getFullYear() && m.m === d.getMonth())) choices.push(d); }
  if (!choices.length) { box.append(h('p',{class:'hint'}, 'The next few months already have calendars in the generator.')); return; }
  const def = choices.find(d => d > now) || choices[0];
  const month = h('select',{}, ...choices.map(d => h('option',{value:d.getFullYear() + '-' + d.getMonth(), selected:d === def}, MONTHS[d.getMonth()] + ' ' + d.getFullYear())));
  const cfgDays = (calCfg() && calCfg().postDays) || ['Mon','Wed'];
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(dn => h('label',{class:'ce-check'}, h('input',{type:'checkbox', value:dn, checked:cfgDays.includes(dn)}), ' ' + dn));
  const notes = h('textarea',{rows:3, placeholder:'Events, deadlines, holidays, things to emphasise or avoid… (optional)'});
  const go = h('button',{class:'btn gen sm'}, '✨ Draft it');
  const st = h('p',{class:'hint'}, STORE.guide ? 'Uses the messaging guide in the Drive folder and recent posts for the voice.' : 'No messaging guide in the Drive folder yet — it will go by recent posts for the voice.');
  go.onclick = async () => {
    const [y, m] = month.value.split('-').map(Number);
    const pick = days.map(l => l.querySelector('input')).filter(i => i.checked).map(i => i.value);
    if (!pick.length) { toast('Pick at least one posting day'); return; }
    go.disabled = true;
    try { await draftMonth(y, m, pick, notes.value.trim(), msg => { st.textContent = msg; }); box.hidden = true; }
    catch (err) { st.textContent = 'Couldn’t draft: ' + err.message; }
    finally { go.disabled = false; }
  };
  const formBox = h('div',{class:'ce'},
    h('div',{class:'ce-row'}, h('div',{class:'field ce-field'}, h('label',{}, 'Month'), month)),
    h('div',{class:'field ce-field'}, h('label',{}, 'Post on'), h('div',{class:'ce-days'}, ...days)),
    h('div',{class:'field ce-field'}, h('label',{}, 'This month'), notes),
    h('div',{class:'ce-row ce-actions'}, go, h('button',{class:'btn link',onclick:()=>{ box.hidden = true; }}, 'Cancel')), st);
  box.append(formBox);
  guideControls(formBox);
}

async function draftMonth(y, m, pickDays, notes, progress){
  const dates = [];
  for (let d = new Date(y, m, 1); d.getMonth() === m; d.setDate(d.getDate()+1)) {
    if (pickDays.includes(DAY_ABBR[d.getDay()])) dates.push(new Date(d));
  }
  progress('Gathering recent posts for the voice…');
  const examples = await pastExamples(y, m);
  const base = { action:'ai.draft', client:STUDIO.name, clientFull:(window.BI_CLIENTS.find(c => c.slug === STUDIO.slug) || {}).full || STUDIO.name,
                 month: MONTHS[m] + ' ' + y, buckets: bucketLabels(), examples, notes };
  // a week at a time keeps each request short, and lets later weeks see what's already written
  const weeks = [];
  dates.forEach(d => { const k = Math.floor((d.getDate() + ((new Date(y, m, 1).getDay()+6) % 7) - 1) / 7); (weeks[k] = weeks[k] || []).push(d); });
  const posts = [];
  const live = weeks.filter(Boolean);
  for (let i = 0; i < live.length; i++) {
    progress('Writing week ' + (i+1) + ' of ' + live.length + '…');
    const j = await drivePost(Object.assign({}, base, {
      dates: live[i].map(d => ({ iso: isoDate(d), day: DAY_FULL[d.getDay()] })),
      already: posts.map(p => ({ iso:p.iso, bucket:p.bucket, hook:p.hook, post:p.post })) }), false);
    (j.posts || []).forEach(x => posts.push(x));
  }
  const month = monthFromStore({ month: storeKey(y, m), rev: 0, posts });
  CAL.months = CAL.months.filter(x => x.key !== month.key).concat([month]).sort((a,b) => (a.y - b.y) || (a.m - b.m));
  CAL.cur = month.key; CAL.view = { kind:'week', row:0 };
  progress('Saving…');
  await saveMonth(month);
  renderCalendar();
  toast(month.label + ' drafted — ' + month.posts.length + ' posts. Review and edit them in the calendar.');
}

async function rewritePost(p, month){
  const how = prompt('How should Claude rewrite it? (e.g. shorter, warmer, mention the open house on the 14th)', 'Make it tighter and more specific');
  if (how == null) return;
  toast('Rewriting…');
  try {
    const examples = await pastExamples(month.y, month.m);
    const j = await drivePost({ action:'ai.rewrite', client:STUDIO.name, clientFull:(window.BI_CLIENTS.find(c => c.slug === STUDIO.slug) || {}).full || STUDIO.name,
      buckets: bucketLabels(), examples, instruction: how,
      post: { iso:p.iso, bucket:p.bucket, hook:p.hook, post:p.post, photoIdea:p.photoIdea } }, false);
    const x = (j.posts || [])[0]; if (!x) throw new Error('nothing came back');
    Object.assign(p, { bucket:x.bucket, hook: p.noHead ? '' : x.hook, post:x.post, photoIdea:x.photoIdea, approved:false });
    touchMonth(month); renderCalendar(); toast('Rewritten — have a look');
  } catch (err) { toast('Couldn’t rewrite: ' + err.message); }
}

// ---------- buttons in the calendar panel ----------
function renderStoreButtons(){
  const cfg = calCfg();
  const draft = $('#calDraftBtn'), connect = $('#calConnect');
  if (!draft || !connect) return;
  connect.hidden = !(cfg && cfg.driveEndpoint && !STORE.ready);
  draft.hidden = !(STORE.ready && STORE.ai);
}
window.addEventListener('load', () => {
  $('#calDraftBtn').addEventListener('click', openDraftForm);
  $('#calConnect').addEventListener('click', async () => {
    if (!drivePass(true)) return;
    if (await storeInit()) { toast('Connected'); refreshCalendar('manual'); syncDoneFromDrive(); }
    else toast('That passcode didn’t work');
    renderStoreButtons();
  });
});

// ---------- the client report ----------
function reportRows(month){
  return month.posts.map(p => ({ date: (p.date.getMonth()+1) + '/' + p.date.getDate() + '/' + p.date.getFullYear(),
    day: DAY_FULL[p.date.getDay()].charAt(0) + DAY_FULL[p.date.getDay()].slice(1).toLowerCase(),
    bucket: p.bucket, hook: p.noHead ? '' : p.hook, post: p.post, fileId: p.graphic ? p.graphic.id : null, src: p.graphic ? graphicSrc(p.graphic, 800) : null }));
}
function clientFull(){ return (window.BI_CLIENTS.find(c => c.slug === STUDIO.slug) || {}).full || STUDIO.name; }
function missingGraphics(month){ return month.posts.filter(p => !p.graphic).length; }

async function reportSheet(month){
  const missing = missingGraphics(month);
  if (missing && !confirm(missing + ' post' + (missing === 1 ? ' has' : 's have') + ' no graphic saved yet; the report will say \u201cGraphic coming\u201d for ' + (missing === 1 ? 'it' : 'them') + '. Make the report anyway?')) return;
  toast('Building the client report\u2026');
  try {
    const j = await drivePost({ action:'report.sheet', client:STUDIO.name, clientFull:clientFull(), month:month.label, rows:reportRows(month) }, false);
    month.reportUrl = j.url; touchMonth(month);
    try { await navigator.clipboard.writeText(j.url); } catch {}
    window.open(j.url, '_blank', 'noopener');
    toast('Report ready \u2014 the link is copied. Anyone with it can view and comment.');
  } catch (err) { toast('Couldn\u2019t build the report: ' + err.message); }
}

function printReport(month){
  const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]);
  const rows = reportRows(month).map(r => `<tr>
    <td class="d"><b>${esc(r.day)}</b><br>${esc(r.date)}<div class="b">${esc(r.bucket)}</div></td>
    <td class="g">${r.src ? `<img src="${/^\//.test(r.src) ? location.origin + r.src : r.src}" alt="">` : '<div class="none">Graphic coming</div>'}</td>
    <td class="t">${r.hook ? `<div class="h">${esc(r.hook)}</div>` : '<div class="h muted">Photo only</div>'}<div class="p">${esc(r.post).replace(/\n/g, '<br>')}</div></td></tr>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(clientFull())} \u2014 ${esc(month.label)} social calendar</title>
<meta name="robots" content="noindex">
<style>
  body{font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#1d2a30;margin:32px;background:#fff}
  h1{font-size:22px;margin:0 0 4px} .sub{color:#667;margin:0 0 20px}
  .bar{margin:0 0 20px} .bar button{font:inherit;padding:8px 14px;border-radius:8px;border:1px solid #03a2c6;background:#03a2c6;color:#fff;cursor:pointer}
  table{width:100%;border-collapse:collapse} tr{page-break-inside:avoid;break-inside:avoid}
  td{vertical-align:top;padding:14px 12px;border-top:1px solid #e3e8ea}
  td.d{width:110px} .b{margin-top:6px;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#03a2c6}
  td.g{width:260px} td.g img{width:240px;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,.15)}
  .none{width:240px;height:300px;border:2px dashed #cfd8dc;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#90a4ae}
  .h{font-weight:700;font-size:15px;margin-bottom:6px} .muted{color:#90a4ae;font-weight:400} .p{white-space:normal}
  @media print{ .bar{display:none} body{margin:12mm} }
</style></head><body>
<h1>${esc(clientFull())} \u2014 ${esc(month.label)} social calendar</h1>
<p class="sub">${month.posts.length} posts \u00b7 prepared ${new Date().toLocaleDateString(undefined, { month:'long', day:'numeric', year:'numeric' })}</p>
<div class="bar"><button onclick="print()">Save as PDF / Print</button></div>
<table>${rows}</table></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type:'text/html' }));
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ---------- the app: client review link, messaging guide ----------
async function reviewLink(month){
  const missing = missingGraphics(month);
  if (missing && !confirm(missing + ' post' + (missing === 1 ? ' has' : 's have') + ' no graphic saved yet; the client will see \u201cGraphic coming soon\u201d. Send the link anyway?')) return;
  try {
    const j = await drivePost({ action:'review.create', client:STUDIO.name, month: storeKey(month.y, month.m) }, false);
    try { await navigator.clipboard.writeText(j.url); } catch {}
    window.open(j.url, '_blank', 'noopener');
    toast('Review link copied \u2014 send it to the client. Their answers appear on each post here.');
  } catch (err) { toast('Couldn\u2019t make the link: ' + err.message); }
}

async function guideControls(box){
  if (!STORE.app) return;
  const row = h('div',{class:'field ce-field'}, h('label',{}, 'Messaging guide'), h('span',{class:'hint'}, 'Checking\u2026'));
  box.prepend(row);
  const show = async () => {
    let g = null; try { g = (await drivePost({ action:'guide.get', client:STUDIO.name }, false)).guide; } catch {}
    const input = h('input',{type:'file', accept:'.pdf,.txt,.md,application/pdf,text/plain', hidden:true, onchange: async e => {
      const f = e.target.files[0]; if (!f) return;
      if (f.size > 20*1024*1024) { toast('That file is too big (20 MB max)'); return; }
      const mime = /pdf$/i.test(f.name) || f.type === 'application/pdf' ? 'application/pdf' : 'text/plain';
      try { await drivePost({ action:'guide.save', client:STUDIO.name, name:f.name, mime, data: await blobToBase64(f) }, false);
        STORE.guide = true; toast('Messaging guide saved'); show(); }
      catch (err) { toast('Couldn\u2019t save the guide: ' + err.message); }
    }});
    row.replaceChildren(h('label',{}, 'Messaging guide'),
      h('div',{class:'ce-row ce-actions'},
        g ? h('a',{href:g.url, target:'_blank', rel:'noopener', class:'btn link'}, g.name) : h('span',{class:'hint'}, 'None yet \u2014 drafts will go by recent posts.'),
        h('button',{class:'btn sm', onclick:()=>input.click()}, g ? 'Replace' : 'Upload (PDF or text)'), input));
  };
  show();
}
