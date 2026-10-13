// ---------- Spring Forth image library (their own photos; no stock search) ----------
// springforth/library/manifest.json: { "images": [ { "file": "x.jpg", "kind": "classroom", "tags": [...] } ] }
const KINDS = { all:'All', classroom:'Classroom', students:'Students', outdoor:'Outdoor', event:'Events', team:'Guides', other:'Other' };
let LIB = [];
let libKind = 'all';
IMG.lib = {};
function loadPhotoMem(){ try { const o = JSON.parse(localStorage.getItem(LS.photos)||'null'); if (o && o.used) photoMem = o; } catch {} }
function savePhotoMem(){ try { localStorage.setItem(LS.photos, JSON.stringify(photoMem)); } catch {} }
async function loadLibrary(){
  try {
    const r = await fetch('library/manifest.json', { cache:'no-store' });
    if (!r.ok) throw new Error('no manifest');
    const j = await r.json();
    LIB = (j.images || []).map(x => ({ id:x.file, file:x.file, kind:x.kind || 'other', tags:x.tags || [], group:x.group || x.file,
      url:'library/' + x.file, tiny:'library/' + (x.thumb || x.file) }));
  } catch { LIB = []; }
  renderResults();
}
function libImage(url){
  return new Promise((res, rej) => {
    if (IMG.lib[url]) return res(IMG.lib[url]);
    const im = new Image(); im.onload = () => { IMG.lib[url] = im; res(im); }; im.onerror = rej; im.src = url;
  });
}
function markUsed(){
  learnFromCurrent();
  const ids = new Set();
  if (IMG.src && IMG.src.kind === 'lib') ids.add(IMG.src.id);
  if (S.bg.kind === 'collage' && S.bg.cells) S.bg.cells.forEach(c => ids.add(c.id));
  const ph = byId('photo'); if (ph && ph.libId) ids.add(ph.libId);
  for (const id of ids) {
    const src = LIB.find(p => p.id === id) || photoMem.used[id]; if (!src) continue;
    const r = photoMem.used[id] || Object.assign({}, src, { count:0 });
    r.count = (r.count||0) + 1; r.lastUsed = Date.now(); photoMem.used[id] = r;
  }
  const keep = Object.keys(photoMem.used).sort((a,b) => photoMem.used[b].lastUsed - photoMem.used[a].lastUsed);
  keep.slice(90).forEach(id => delete photoMem.used[id]);
  savePhotoMem();
}
function toggleFav(rec){
  if (photoMem.favs[rec.id]) delete photoMem.favs[rec.id]; else photoMem.favs[rec.id] = Object.assign({}, rec, { addedAt:Date.now() });
  savePhotoMem(); renderResults();
}
function usedLabel(id){ const r = photoMem.used[id]; return r ? 'Used ' + new Date(r.lastUsed).toLocaleDateString(undefined, { month:'short', year:'2-digit' }) : ''; }
let tab = 'lib';
function setTab(t){ tab = t; document.querySelectorAll('#tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t))); }
$('#tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; setTab(b.dataset.tab); renderResults(); });
function renderKindChips(){
  const box = $('#kindChips'); box.innerHTML = '';
  const present = new Set(LIB.map(p => p.kind));
  for (const [k,l] of Object.entries(KINDS)) { if (k !== 'all' && !present.has(k)) continue; box.append(h('button',{class:'chip','aria-pressed':String(k===libKind),onclick:()=>{ libKind = k; renderResults(); }}, l)); }
}
function renderResults(){
  const box = $('#results'); box.innerHTML = '';
  let list;
  if (tab === 'favs') { list = Object.values(photoMem.favs).sort((a,b) => b.addedAt - a.addedAt); $('#rstatus').textContent = list.length ? `${list.length} favorite${list.length===1?'':'s'}` : 'No favorites yet. Hover an image and click ☆.'; }
  else if (tab === 'recent') { list = Object.values(photoMem.used).sort((a,b) => b.lastUsed - a.lastUsed); $('#rstatus').textContent = list.length ? 'Images you’ve downloaded graphics with, newest first' : 'Nothing yet. Images show up here after you download a graphic using them.'; }
  else {
    renderKindChips();
    list = LIB.filter(p => libKind === 'all' || p.kind === libKind);
    $('#rstatus').textContent = LIB.length ? `${list.length} photo${list.length===1?'':'s'} in the Spring Forth library` : 'The photo library is empty. Add Spring Forth’s photos to get started. You can still upload one below.';
  }
  $('#kindChips').hidden = tab !== 'lib';
  const usedNow = new Set((S.bg.cells||[]).map(c => c.id).concat([IMG.src?.id, byId('photo')?.libId].filter(Boolean)));
  for (const p of list) {
    const d = h('div',{class:'res',title:(p.tags||[]).join(', ') || p.file,'aria-pressed':String(usedNow.has(p.id)),role:'button',tabindex:'0',onclick:()=>usePhoto(p),onkeydown:e=>{ if (e.key==='Enter') usePhoto(p); }},
      h('img',{src:p.tiny,alt:'',loading:'lazy'}),
      h('button',{class:'star',title:photoMem.favs[p.id]?'Remove from favorites':'Add to favorites','aria-pressed':String(!!photoMem.favs[p.id]),onclick:e=>{ e.stopPropagation(); toggleFav(p); }}, photoMem.favs[p.id] ? '★' : '☆'));
    const u = usedLabel(p.id); if (u) d.append(h('span',{class:'used'}, u));
    box.append(d);
  }
}
// Clicking a library photo: on a paper layout it becomes a framed photo on the page;
// on the photo template it becomes the full-bleed background.
async function usePhoto(p){
  $('#loading').classList.add('show');
  try {
    const im = await libImage(p.url);
    pushUndo();
    if (S.template === 'photo' || S.template === 'logo') {
      IMG.bg = im; IMG.src = Object.assign({ kind:'lib' }, p);
      S.bg.kind = 'photo'; S.bg.cells = null; S.bg.ox = S.bg.oy = 0; S.bg.zoom = 1; $('#zoom').value = 100;
      templateDefaults(); layout(); autoContrast(false);
    } else if (S.template === 'collage') {
      // a selected collage photo is swapped in place; otherwise the least-recently-set one
      const sel = byId(S.sel);
      if (!S.bg.cells || !S.bg.cells.length) await makeCollage(p.kind);
      else if (sel && sel.cell != null) { const c = S.bg.cells[sel.cell]; Object.assign(c, { url:p.url, id:p.id, kind:p.kind }); sel.zoom = 1; sel.px = sel.py = 0; }
      else {
        const i = S.bg.cells.findIndex(c => !c.off); const at = i < 0 ? 0 : i;
        Object.assign(S.bg.cells[at], { url:p.url, id:p.id, kind:p.kind });
        const el = S.els.find(e => e.cell === at); if (el) { el.zoom = 1; el.px = el.py = 0; }
      }
      layout();
    } else {
      addPhoto(p, im);
    }
    syncControls(); renderInspector(); renderResults(); fitCanvas();
  } catch { toast('Couldn’t load that image'); }
  finally { $('#loading').classList.remove('show'); }
}
// A framed photo on the paper — taped, polaroid or plain, slightly rotated.
function addPhoto(p, im){
  const w = W(), h = H(), aspect = im.naturalHeight / im.naturalWidth;
  let el = byId('photo');
  const style = ['tape','polaroid','plain'][Math.floor(Math.random()*3)];
  if (!el) { el = { id:'photo', type:'image', src:p.url, libId:p.id, x:0, y:0, w:0, style, rot:(Math.random()-0.5)*0.09, seed:Math.floor(Math.random()*9999) }; S.els.unshift(el); }
  el.src = p.url; el.libId = p.id;
  const texts = S.els.filter(e => e.type === 'text');
  const textBottom = texts.length ? Math.max(...texts.map(t => { const b = bbox(ctx, t); return b.y + b.h; })) : h*0.14;
  const top = textBottom + h*0.035, bottom = h*(S.wave === 'none' ? 0.92 : 0.80);
  const avail = Math.max(h*0.22, bottom - top);
  el.w = Math.min(w*0.74, avail/aspect); el.x = (w - el.w)/2; el.y = top + (avail - el.w*aspect)/2;
}
function setGround(style, newSeed){
  pushUndo();
  if (S.bg.kind === 'photo') { S.bg.kind = 'paper'; IMG.bg = null; IMG.src = null; }
  S.bg.ground = style || S.bg.ground || 'paper';
  if (newSeed || !S.bg.seed) S.bg.seed = Math.floor(Math.random()*100000) + 1;
  templateDefaults(); layout(); syncControls(); renderInspector(); renderResults(); render(); persist();
}
// Stickers: the hand-drawn marks off Spring Forth's own sheet. One click drops one in the
// middle of the page; from there it is an ordinary element you can drag, resize and tilt.
function renderStickerRow(){
  const box = $('#stickerRow'); if (!box) return;
  box.innerHTML = '';
  for (const s of STICKERS) {
    const name = s.file.replace('.png','');
    box.append(h('button',{title:name.replace(/-/g,' '),onclick:()=>addSticker(name)},
      h('img',{src:'art/stickers/' + s.file,alt:name})));
  }
}
// The "Now Enrolling" badge isn't a doodle: it sits where their October posts put it,
// lapping off the right edge in the lower half of the page, at its full size.
function placeBadge(name){
  const w = W(), hh = H(), sw = w*0.588;
  S.els.push({ id:'sticker-' + Date.now(), type:'sticker', name, x:w - sw, y:hh*0.61, w:sw, rot:0 });
  return S.els[S.els.length-1];
}
function addSticker(name){
  pushUndo();
  if (/^badge-/.test(name)) { S.sel = placeBadge(name).id; renderInspector(); render(); persist(); return; }
  const w = W(), hh = H(), sw = w*0.14;
  const im = IMG.stickers[name];
  const sh = sw * (im ? im.naturalHeight/im.naturalWidth : 1);
  // the master tucks these into the corners of the page, often lapping over a card edge.
  // Drop each new one in the next free corner; from there it is yours to drag anywhere.
  const top = (waveCeiling(0, 1) + 0.02)*hh, floor = (waveFloor(0, 1) - 0.02)*hh;
  const spots = [[w*0.055, floor - sh], [w*0.945 - sw, floor - sh],
                 [w*0.055, top], [w*0.945 - sw, top],
                 [w*0.055, (top + floor - sh)/2], [w*0.945 - sw, (top + floor - sh)/2]];
  const taken = S.els.filter(e => e.type === 'sticker').length;
  const at = spots[taken % spots.length];
  S.els.push({ id:'sticker-' + Date.now(), type:'sticker', name, x:at[0], y:at[1], w:sw,
    rot:(Math.random()-0.5)*0.22 });
  S.sel = S.els[S.els.length-1].id;
  renderInspector(); render(); persist();
}

function renderGroundChips(){
  const box = $('#artChips'); box.innerHTML = '';
  for (const [k,l] of Object.entries(GROUNDS)) box.append(h('button',{class:'chip','aria-pressed':String(S.bg.kind !== 'photo' && S.bg.ground === k),onclick:()=>setGround(k, true)}, l));
  box.append(h('button',{class:'btn sm',title:'Same paper, a fresh crumple',onclick:()=>setGround(S.bg.ground, true)}, '↻ Variation'));
}
// Collage: 3–4 library photos, framed and tilted, never two crops of the same shot.
// `chosen` (already ranked for a calendar post) is used in order instead of a random draw.
async function makeCollage(kind, chosen){
  const pool0 = LIB.filter(p => !kind || kind === 'all' || p.kind === kind);
  const pool = chosen || (pool0.length >= 3 ? pool0 : LIB);
  if (pool.length < 3) { toast('Need at least 3 library photos for a collage'); return false; }
  const shuffled = chosen ? chosen.slice() : pool.slice().sort(() => Math.random() - 0.5);
  const seen = new Set(), picked = [];
  for (const p of shuffled) { if (seen.has(p.group)) continue; seen.add(p.group); picked.push(p); if (picked.length === 4) break; }
  if (picked.length < 3) { toast('Need at least 3 different library photos for a collage'); return false; }
  const grid = picked.length >= 4 && Math.random() < 0.5 ? '2x2' : (Math.random() < 0.5 ? '2+1' : '1+2');
  const n = grid === '2x2' ? 4 : 3;
  const styles = ['tape','polaroid','plain'];
  const cells = picked.slice(0, n).map(p => ({ url:p.url, id:p.id, kind:p.kind, style:styles[Math.floor(Math.random()*styles.length)],
    rot:(Math.random()-0.5)*0.10, seed:Math.floor(Math.random()*9999) }));
  await Promise.all(cells.map(c => libImage(c.url)));
  S.bg.kind = 'collage'; S.bg.cells = cells; S.bg.grid = grid; S.bg.dim = 0;
  S.els = (S.els || []).filter(e => e.cell == null);          // a fresh collage lays out fresh frames
  if (S.bg.ground === 'cork') S.bg.ground = 'paper';
  if (!S.bg.seed) S.bg.seed = Math.floor(Math.random()*100000) + 1;
  S.bg.seed = S.bg.seed || Math.floor(Math.random()*100000) + 1;
  IMG.bg = null; IMG.src = { kind:'collage', id:'collage:' + cells.map(c => c.id).join('+'), cells };
  return true;
}
$('#collageBtn').addEventListener('click', async () => {
  pushUndo();
  if (await makeCollage(libKind)) { S.template = 'collage'; templateDefaults(); layout(); syncControls(); renderInspector(); renderResults(); fitCanvas(); persist(); }
});
$('#collageQuick').addEventListener('click', async () => {
  if (genBusy) return;
  pushUndo();
  if (!(await makeCollage('all'))) return;
  S.template = 'collage'; currentDraftId = null;
  templateDefaults(); layout(); syncControls(); renderInspector(); renderResults(); fitCanvas(); persist();
  toast('Collage. Press again for another mix.');
});
