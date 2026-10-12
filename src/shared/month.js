// ---------- the whole month at once (shared) ----------
// One graphic per post in the month on view, built the way "Generate from calendar" builds
// them, with the layouts and borders mixed across the month and no photo used twice. The set
// sits in the right rail: click a post to open it on the canvas and tweak it (the change is
// kept), then download everything as one zip with the captions, or save it all to Drive.

const MONTH = { key:null, label:'', items:[], on:-1 };

function postLabel(p){ return DAY_ABBR[p.date.getDay()] + ' ' + (p.date.getMonth()+1) + '/' + p.date.getDate(); }

async function generateMonth(){
  if (genBusy) return;
  const m = curMonth();
  if (!m || !m.posts.length) { toast('No posts in this month yet'); return; }
  genBusy = true; hideWelcome();
  const btn = $('#calMonthGen'); btn.disabled = true;
  $('#loading').classList.add('show');
  try {
    pushUndo();
    const offered = new Set(), items = [];
    // borders go round in a shuffled order so neighbouring posts don't match
    const order = frameOrder();
    let fi = 0;
    for (let i = 0; i < m.posts.length; i++) {
      const p = m.posts[i];
      $('#loading').textContent = 'Building ' + postLabel(p) + ' (' + (i+1) + ' of ' + m.posts.length + ')…';
      const specs = STUDIO.specsFor(p, offered);
      if (!specs.length) continue;
      // mix the layouts across the month: each post takes the next of its own top options
      const s = Object.assign({}, specs[i % Math.min(3, specs.length)]);
      if (!s.frame && order.length) s.frame = order[fi++ % order.length];
      const built = await STUDIO.buildOption(s);
      built.photos.forEach(id => offered.add(id));
      items.push({ p, built });
    }
    MONTH.key = m.key; MONTH.label = m.label; MONTH.items = items; MONTH.on = -1;
    CTX.options = []; CTX.on = -1; renderOptions();
    openMonthItem(0, false);
    toast(items.length + ' graphics for ' + m.label + ' — click any of them on the right to adjust it');
  } catch (err) { console.error(err); toast('Couldn’t build the month: ' + (err.message || err)); }
  finally { $('#loading').classList.remove('show'); $('#loading').textContent = 'Loading photo…'; btn.disabled = false; genBusy = false; updateCalGen(); }
}

// Whatever is on the canvas belongs to the open post, if it is still that post.
function keepCurrentInMonth(){
  const it = MONTH.items[MONTH.on]; if (!it) return;
  const sel = selectedPost(); if (sel && sel.iso !== it.p.iso) return;
  it.built = { label: it.built.label, state: JSON.parse(snapshot()), bg: IMG.bg, src: IMG.src ? clone(IMG.src) : null, thumb: thumb(), photos: it.built.photos };
}

function openMonthItem(i, keep = true){
  const it = MONTH.items[i]; if (!it) return;
  if (keep) keepCurrentInMonth();
  const m = CAL.months.find(x => x.key === MONTH.key);
  if (m) { CAL.cur = m.key; CAL.view = { kind:'day', iso:it.p.iso }; }
  Object.assign(S, clone(it.built.state)); S.sel = null;
  IMG.bg = it.built.bg; IMG.src = it.built.src ? clone(it.built.src) : null;
  MONTH.on = i; currentDraftId = null;
  syncControls(); renderInspector(); renderResults(); renderQuickFields(); fitCanvas();
  renderCalendar(); renderMonth();
}

function renderMonth(){
  const sec = $('#monthSec'); if (!sec) return;
  sec.hidden = !MONTH.items.length;
  if (!MONTH.items.length) return;
  $('#monthTitle').textContent = MONTH.label;
  const grid = $('#monthGrid'); grid.innerHTML = '';
  MONTH.items.forEach((it, i) => grid.append(h('button',{class:'opt','aria-pressed':String(i === MONTH.on),
    title:(it.p.bucket || 'Post') + ' — ' + (it.p.noHead ? 'photo only' : it.p.hook || 'no hook text'), onclick:()=>openMonthItem(i)},
    h('img',{src:it.built.thumb, alt:''}), h('span',{}, (isDone(it.p) ? '✓ ' : '') + postLabel(it.p)))));
  $('#monthDrive').hidden = !driveCfg();
}

// Paint one item onto an off-screen canvas at full size, then put the canvas back as it was.
async function renderItem(it){
  const keepS = JSON.parse(snapshot()), keepBg = IMG.bg, keepSrc = IMG.src;
  try {
    Object.assign(S, clone(it.built.state)); S.sel = null;
    IMG.bg = it.built.bg; IMG.src = it.built.src;
    return await renderBlob();
  } finally { Object.assign(S, keepS); IMG.bg = keepBg; IMG.src = keepSrc; }
}

function captionsText(){
  return MONTH.items.map(({ p }) => [
    postLabel(p) + ' · ' + (p.bucket || ''),
    'Graphic: ' + postFilename(p),
    p.noHead ? 'Headline: (none — photo only)' : 'Headline: ' + (p.hook || '(from the phrase bank)'),
    '', p.post || '', '', '----------', ''].join('\n')).join('\n');
}

async function downloadMonth(){
  if (!window.JSZip) { toast('The zip helper didn’t load — check the connection and reload.'); return; }
  keepCurrentInMonth();
  const btn = $('#monthZip'); btn.disabled = true; btn.textContent = 'Preparing…';
  try {
    await fontsReady();
    const zip = new JSZip();
    for (const it of MONTH.items) zip.file(postFilename(it.p), await renderItem(it));
    zip.file('captions.txt', captionsText());
    saveBlob(await zip.generateAsync({ type:'blob' }), STUDIO.filePrefix + '_' + MONTH.label.replace(/\s+/g, '-') + '.zip');
    MONTH.items.forEach(it => { calDone[doneKey(it.p)] = Date.now(); }); saveCalDone();
    renderCalendar(); renderMonth();
  } catch (err) { console.error(err); toast('Couldn’t make the zip: ' + (err.message || err)); }
  finally { btn.disabled = false; btn.textContent = 'Download all (zip)'; render(); }
}

// ---------- Save to Drive ----------
// Talks to the Apps Script web app in apps-script/ (set up once; its URL goes in clients.js as
// calendar.driveEndpoint). The team passcode is asked for once and remembered in this browser.
const DRIVE_PASS_KEY = STUDIO.slug + '-drive-pass';
function driveCfg(){ const c = calCfg(); return c && c.driveEndpoint ? c : null; }
function drivePass(ask){
  let v = ''; try { v = localStorage.getItem(DRIVE_PASS_KEY) || ''; } catch {}
  if (!v && ask) { v = (prompt('Team passcode for Save to Drive:') || '').trim(); if (v) try { localStorage.setItem(DRIVE_PASS_KEY, v); } catch {} }
  return v;
}
async function drivePost(body, ask = true){
  const cfg = driveCfg(); if (!cfg) throw new Error('Save to Drive isn’t set up yet');
  const passcode = drivePass(ask); if (!passcode) throw new Error('No passcode');
  // text/plain keeps the browser from sending a preflight, which Apps Script can't answer
  const r = await fetch(cfg.driveEndpoint, { method:'POST', headers:{ 'Content-Type':'text/plain;charset=utf-8' },
    body: JSON.stringify(Object.assign({ passcode }, body)) });
  const j = await r.json();
  if (!j.ok && j.error === 'passcode') { try { localStorage.removeItem(DRIVE_PASS_KEY); } catch {} throw new Error('That passcode didn’t work — try again'); }
  if (!j.ok) throw new Error(j.error || 'Drive said no');
  return j;
}
function blobToBase64(blob){
  return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(blob); });
}
function monthOf(p){ return CAL.months.find(m => m.y === p.date.getFullYear() && m.m === p.date.getMonth()); }
async function savePostToDrive(p, blob){
  const cfg = driveCfg(), m = monthOf(p);
  return drivePost({ action:'save', client:STUDIO.name, month: MONTHS[p.date.getMonth()] + ' ' + p.date.getFullYear(),
    filename: postFilename(p), png: await blobToBase64(blob),
    sheetId: cfg.sheetId, tab: m ? m.tab : '', iso: p.iso, dateCol: cfg.cols.date, imageCol: cfg.cols.image });
}

async function saveCurrentToDrive(){
  const p = selectedPost();
  if (!p) { toast('Pick the post this graphic is for in the calendar first'); return; }
  const btn = $('#driveBtn'); btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await fontsReady();
    await savePostToDrive(p, await renderBlob());
    markPostDone(p); keepCurrentInMonth(); renderMonth();
    toast('Saved to Drive and added to the calendar for ' + postLabel(p));
  } catch (err) { toast('Couldn’t save: ' + (err.message || err)); }
  finally { btn.disabled = false; btn.textContent = '☁ Save to Drive'; }
}

async function saveMonthToDrive(){
  keepCurrentInMonth();
  const btn = $('#monthDrive'); btn.disabled = true;
  let done = 0;
  try {
    await fontsReady();
    for (const it of MONTH.items) {
      btn.textContent = 'Saving ' + (done+1) + ' of ' + MONTH.items.length + '…';
      await savePostToDrive(it.p, await renderItem(it));
      calDone[doneKey(it.p)] = Date.now(); done++;
    }
    saveCalDone();
    toast('All ' + done + ' graphics are in Drive and on the calendar');
  } catch (err) { saveCalDone(); toast('Saved ' + done + ', then stopped: ' + (err.message || err)); }
  finally { btn.disabled = false; btn.textContent = '☁ Save all to Drive'; renderCalendar(); renderMonth(); render(); }
}

// Checkmarks come from what is actually in the Drive folder, so every browser agrees.
async function syncDoneFromDrive(){
  if (!driveCfg() || !drivePass(false)) return;
  for (const m of CAL.months) {
    try {
      const j = await drivePost({ action:'status', client:STUDIO.name, month:m.label }, false);
      const names = new Set(j.files || []);
      for (const p of m.posts) if (names.has(postFilename(p))) calDone[doneKey(p)] = calDone[doneKey(p)] || Date.now();
    } catch { return; }
  }
  saveCalDone(); renderCalendar(); renderMonth();
}

$('#calMonthGen').addEventListener('click', generateMonth);
$('#monthZip').addEventListener('click', downloadMonth);
$('#monthDrive').addEventListener('click', saveMonthToDrive);
$('#monthClose').addEventListener('click', () => { keepCurrentInMonth(); MONTH.items = []; MONTH.on = -1; renderMonth(); });
$('#driveBtn').addEventListener('click', saveCurrentToDrive);
(async () => {
  if (!window.BI_CLIENTS) await new Promise(r => window.addEventListener('load', r, { once:true }));
  $('#driveBtn').hidden = !driveCfg();
  $('#calMonthGen').hidden = !STUDIO.specsFor;
  // wait for the calendar's first read before asking Drive what's already filed
  for (let i = 0; i < 60 && !['ready','empty','offline'].includes(CAL.state); i++) await new Promise(r => setTimeout(r, 250));
  syncDoneFromDrive();
})();
