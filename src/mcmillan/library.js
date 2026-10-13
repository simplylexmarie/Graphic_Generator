// ---------- McMillan image library (their own photos; no stock search) ----------
// mcmillan/library/manifest.json lists every image: { "images": [ { "file": "shop-01.jpg", "kind": "shop", "tags": ["winding"] } ] }
// kinds: product (cutout on white/transparent), shop, team, event, application, other
const KINDS = { all:'All', product:'Products', shop:'Shop', team:'Team', event:'Events', application:'Applications', other:'Other' };
let LIB = [];            // [{file, kind, tags, url, id}]
let libKind = 'all';
IMG.lib = {};            // url -> Image (loaded on demand)
function loadPhotoMem(){ try { const o = JSON.parse(localStorage.getItem(LS.photos)||'null'); if (o && o.used) photoMem = o; } catch {} }
function savePhotoMem(){ try { localStorage.setItem(LS.photos, JSON.stringify(photoMem)); } catch {} }
async function loadLibrary(){
  try {
    const r = await fetch('library/manifest.json', { cache:'no-store' });
    if (!r.ok) throw new Error('no manifest');
    const j = await r.json();
    LIB = (j.images || []).map(x => ({ id:x.file, file:x.file, kind:x.kind || 'other', tags:x.tags || [], group:x.group || x.file, url:'library/' + x.file, tiny:'library/' + (x.thumb || x.file), photographer:'McMillan' }));
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
  const rec = IMG.src && IMG.src.kind === 'lib' ? IMG.src : null;
  if (!rec) return;
  const r = photoMem.used[rec.id] || Object.assign({}, rec, { count:0 });
  r.count = (r.count||0) + 1; r.lastUsed = Date.now();
  photoMem.used[rec.id] = r;
  const ids = Object.keys(photoMem.used).sort((a,b) => photoMem.used[b].lastUsed - photoMem.used[a].lastUsed);
  ids.slice(80).forEach(id => delete photoMem.used[id]);
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
    $('#rstatus').textContent = LIB.length ? `${list.length} image${list.length===1?'':'s'} in the McMillan library` : 'The image library is empty. Ask Alexia to add McMillan’s photos. You can still upload one below.';
  }
  $('#kindChips').hidden = tab !== 'lib';
  for (const p of list) {
    const d = h('div',{class:'res',title:(p.tags||[]).join(', ') || p.file,'aria-pressed':String(IMG.src?.id===p.id || byId('product')?.src === p.url),role:'button',tabindex:'0',onclick:()=>usePhoto(p),onkeydown:e=>{ if (e.key==='Enter') usePhoto(p); }},
      h('img',{src:p.tiny,alt:'',loading:'lazy'}),
      h('button',{class:'star',title:photoMem.favs[p.id]?'Remove from favorites':'Add to favorites','aria-pressed':String(!!photoMem.favs[p.id]),onclick:e=>{ e.stopPropagation(); toggleFav(p); }}, photoMem.favs[p.id] ? '★' : '☆'));
    if (p.kind === 'product') d.append(h('span',{class:'used'}, 'Product'));
    else { const u = usedLabel(p.id); if (u) d.append(h('span',{class:'used'}, u)); }
    box.append(d);
  }
}
// Clicking a library image: products become a cutout on top of the art; everything else becomes the background.
async function usePhoto(p){
  $('#loading').classList.add('show');
  try {
    const im = await libImage(p.url);
    pushUndo();
    if (p.kind === 'product') {
      addProduct(p, im);
    } else {
      IMG.bg = im; IMG.src = Object.assign({ kind:'lib' }, p);
      S.bg.kind = 'photo'; S.bg.cells = null; S.bg.ox = S.bg.oy = 0; S.bg.zoom = 1; $('#zoom').value = 100;
      if (S.template === 'collage') S.template = 'logo';
      templateDefaults(); layout(); autoContrast(false);
    }
    syncControls(); renderInspector(); renderResults(); fitCanvas();
  } catch { toast('Couldn’t load that image'); }
  finally { $('#loading').classList.remove('show'); }
}
function addProduct(p, im){
  const w = W(), h = H(); const aspect = im.naturalHeight / im.naturalWidth;
  let el = byId('product');
  if (!el) { el = { id:'product', type:'image', src:p.url, x:0, y:0, w:0, shadow:true }; S.els.unshift(el); }
  el.src = p.url;
  // sit between the text block and the logo: as large as that gap allows
  const texts = S.els.filter(e => e.type === 'text'); const logo = byId('logo');
  const textBottom = texts.length ? Math.max(...texts.map(t => bbox(ctx, t).y + bbox(ctx, t).h)) : 0.12*h;
  const logoTop = logo ? logo.y : h - 0.14*h;
  const top = textBottom + 0.03*h, bottom = logoTop - 0.02*h, avail = Math.max(0.2*h, bottom - top);
  el.w = Math.min(0.66*w, avail/aspect); el.x = (w - el.w)/2; el.y = bottom - el.w*aspect;
  if (S.bg.kind === 'photo') S.bg.kind = 'art';
}
function setArt(style, newSeed){
  pushUndo();
  S.bg.kind = 'art'; S.bg.cells = null; S.bg.art = style || S.bg.art || 'gradient';
  if (S.template === 'logo' || S.template === 'collage') {
    const sgg = suggestText('quality');
    S.template = 'headline'; S.els = [text('headline', sgg.headline)]; if (sgg.sub) S.els.push(text('sub', sgg.sub));
    toast('Green art always carries a message, so a headline was added for you to edit');
  }
  if (newSeed || !S.bg.seed) S.bg.seed = Math.floor(Math.random()*100000) + 1;
  IMG.src = { kind:'art', art:S.bg.art, seed:S.bg.seed };
  templateDefaults(); layout(); syncControls(); renderInspector(); renderResults(); render(); persist();
}
function renderArtChips(){
  const box = $('#artChips'); box.innerHTML = '';
  for (const [k,l] of Object.entries(ART)) box.append(h('button',{class:'chip','aria-pressed':String(S.bg.kind !== 'photo' && S.bg.art === k),onclick:()=>setArt(k, true)}, l));
  box.append(h('button',{class:'btn sm',title:'Same style, different variation',onclick:()=>setArt(S.bg.art, true)}, '↻ Variation'));
}

// Build a collage from the library: same category when possible, 3 or 4 photos, random grid.
async function makeCollage(kind){
  const pool0 = LIB.filter(p => p.kind !== 'product' && (!kind || kind === 'all' || p.kind === kind));
  const pool = pool0.length >= 3 ? pool0 : LIB.filter(p => p.kind !== 'product');
  if (pool.length < 3) { toast('Need at least 3 library photos for a collage'); return false; }
  const shuffled = pool.slice().sort(() => Math.random() - 0.5);
  // never two crops of the same shot in one collage
  const seen = new Set(), picked = [];
  for (const p of shuffled) { if (seen.has(p.group)) continue; seen.add(p.group); picked.push(p); if (picked.length === 4) break; }
  const grid = picked.length >= 4 && Math.random() < 0.5 ? '2x2' : (Math.random() < 0.5 ? '2+1' : '1+2');
  const n = grid === '2x2' ? 4 : 3;
  if (picked.length < n) { if (picked.length < 3) { toast('Need at least 3 different library photos for a collage'); return false; } }
  const cells = picked.slice(0, n).map(p => ({ url:p.url, id:p.id, kind:p.kind }));
  await Promise.all(cells.map(c => libImage(c.url)));
  S.bg.kind = 'collage'; S.bg.cells = cells; S.bg.grid = grid; S.bg.dim = 0; S.bg.fadePos = 'none';
  IMG.bg = null; IMG.src = { kind:'collage', id:'collage:' + cells.map(c => c.id).join('+'), cells };
  return true;
}
$('#collageBtn').addEventListener('click', async () => {
  pushUndo();
  if (await makeCollage(libKind)) { S.template = 'collage'; S.frame = 'none'; templateDefaults(); layout(); syncControls(); renderInspector(); renderResults(); fitCanvas(); persist(); }
});

// Toolbar shortcut: same as Generate → Collage, one click.
$('#collageQuick').addEventListener('click', async () => {
  if (genBusy) return;
  pushUndo();
  const r = await randomBackground('collage', {});
  if (r === 'none') { toast('A collage needs at least 3 library photos'); return; }
  S.template = 'collage'; S.frame = 'none'; currentDraftId = null;
  templateDefaults(); layout(); syncControls(); renderInspector(); renderResults(); fitCanvas(); persist();
  toast('Collage. Press again for another mix.');
});
