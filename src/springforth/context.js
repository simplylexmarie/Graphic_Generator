// ---------- Generate from the calendar ----------
// The calendar post decides the graphic: its hook text is the headline, and its caption and
// bucket decide which photos fit and which layout suits it. Three options come back side by
// side; "More options" swaps in the next-best photos. Random generation is untouched.

// Words in a post → photo tags (from springforth/library/manifest.json). Earlier tags in each
// row weigh a little more than later ones.
const CONTEXT_TAGS = [
  [/\bmath|number|fraction|multiplic|bad at|mess (?:this |it )?up|mistake|homework|worksheet|study|practice|do it later|procrastinat|struggl|work through|focus|concentrat/, ['schoolwork','focus','math','writing']],
  [/\bread|\bbooks?\b|stor(?:y|ies)|librar|\bdear\b|drop everything/, ['reading','focus']],
  [/\bwrit|journal|essay|spelling/, ['writing','schoolwork']],
  [/monster|hero|courage|brave|grit|growth|mindset|i can\b|persever|resilien|challeng/, ['hero','schoolwork','focus','challenge','growth']],
  [/\bbuil|creat|project|design|cardboard|engineer|invent/, ['building','project','hands-on']],
  [/scien|experiment|discover/, ['science','experiment','hands-on']],
  [/\bart\b|paint|draw|creativ/, ['art','creative']],
  [/chess|strateg|\bgames?\b/, ['chess','games','thinking']],
  [/exhibit|present|showcase|carnival|booth|entrepreneur|business|market/, ['exhibition','presenting','project']],
  [/parent|famil|\bmom|\bdad|at home|grandparent/, ['parents','family']],
  [/communit|together|friend|\bkind(?!\s+of)|help|belong|tribe|village/, ['community','friends','kindness','together']],
  [/outside|outdoor|nature|recess|\bfield\b|\bplay|fresh air|explor/, ['outdoor','play','nature']],
  [/field trip|\btrip\b|adventure|outing/, ['field-trip','fun']],
  [/enroll|\btours?\b|visit|open house|join us|apply|spots|new families/, ['whole-school','welcome','community']],
  [/leader|\blead\b|discussion|socratic|question|circle|debate|voice/, ['discussion','leadership','presenting']],
  [/feedback|encourag|praise/, ['feedback','discussion']],
  [/back to school|new year|welcome|first day|another year|celebrat|wraps? up/, ['celebration','whole-school','smiling']],
  [/sparks|youngest|little ones|kinder/, ['younger']],
  [/\bteens?\b|middle school|older learners/, ['older']],
  [/real.?world|real life|life skill|first aid|cook/, ['real-world','hands-on']],
];
const BUCKET_TAGS = {
  'inspiring growth':['schoolwork','focus','growth','hero'],
  'equipping':['parents','schoolwork','discussion'],
  'community':['community','parents','group','friends'],
  'enrollment':['whole-school','welcome','community','exhibition'],
  'enrollement':['whole-school','welcome','community','exhibition'],
};

function contextWants(p){
  const want = {};
  const add = (tags, w) => tags.forEach((t, i) => { want[t] = (want[t] || 0) + w - i*0.25; });
  const txt = ((p.hook || '') + ' ' + captionBody(p.post)).toLowerCase();
  for (const [re, tags] of CONTEXT_TAGS) if (re.test(txt)) add(tags, 3);
  for (const part of String(p.bucket || '').split(/[\/,&]+/)) {
    // an enrollment post is about the school as a whole, whatever its caption mentions
    const key = part.trim().toLowerCase(), tags = BUCKET_TAGS[key];
    if (tags) add(tags, /^enroll/.test(key) ? 4 : 1.5);
  }
  return want;
}
// Best match first, one photo per shoot (no two crops of the same moment). Photos already
// offered for this post sink to the bottom rather than vanish, so a small library never runs dry.
function rankPhotos(p, offered){
  const want = contextWants(p);
  const scored = LIB.map(ph => {
    let s = 0;
    for (const t of ph.tags) s += want[t] || 0;
    if (ph.tags.includes('weak')) s -= 4;
    if (photoMem.used[ph.id]) s -= 0.6;
    if (offered.has(ph.id)) s -= 100;
    return { ph, s: s + Math.random()*0.9 };
  }).sort((a, b) => b.s - a.s);
  const seen = new Set(), out = [];
  for (const { ph } of scored) { if (seen.has(ph.group)) continue; seen.add(ph.group); out.push(ph); }
  return out;
}

// A bulleted run in the caption ("- “I’m just bad at math,”") becomes the three-card list,
// headed by the line that introduces it.
function captionList(post){
  const lines = String(post || '').split('\n');
  const first = lines.findIndex(l => /^\s*(?:[-•–*]|\d+[.)])\s+\S/.test(l));
  if (first < 0) return null;
  const items = [];
  for (const l of lines.slice(first)) {
    const m = l.match(/^\s*(?:[-•–*]|\d+[.)])\s+(.+)/);
    if (!m) { if (items.length && l.trim()) break; continue; }
    // drop the sentence glue the caption hangs between bullets: a trailing ", or" / "and" / comma
    const t = m[1].trim().replace(/[,;]?\s+(?:or|and)\s*$/i, '').replace(/[,;]+$/, '').replace(/[,;](”|")$/, '$1');
    if (t.length <= 70) items.push(t);
  }
  if (items.length < 2) return null;
  let head = '';
  for (let i = first - 1; i >= 0 && !head; i--) head = lines[i].trim();
  head = head.length && head.length <= 70 ? head.replace(/[,.:;]?$/, ':') : 'Sound familiar?';
  return { headline: head, items: items.slice(0, 3) };
}
// A parent's words in quotation marks become the cork-board quote.
function captionQuote(post){
  const t = String(post || '');
  const q = (t.match(/[“"]([^”"]{30,260})[”"]/) || [])[1];
  if (!q) return null;
  const leads = /^\s*[“"]/.test(t);
  if (!leads && !/parent|mom|dad|family|our (?:kids|children)|my (?:child|son|daughter)/i.test(t)) return null;
  return { quote: '“' + q.trim() + '”', attr: '— a Spring Forth parent' };
}

// Build one complete graphic into S/IMG and hand back what's needed to put it back later.
async function buildOption(o){
  S.template = o.template; S.els = []; S.bg.cells = null;
  // frame: one of FRAMES below, or 'none' for a bare photo (the badge layout)
  const fr = o.frame && o.frame !== 'none' ? o.frame : null;
  S.waveStyle = fr ? fr.style : 'a';
  S.wave = o.frame === 'none' ? 'none' : fr ? fr.wave : 'both';
  if (o.headline != null && o.template !== 'quote') S.els.push(text('headline', o.headline));
  if (o.template === 'quote') { S.els.push(text('quote', o.quote)); S.els.push(text('attr', o.attr)); }
  if (o.template === 'list') (o.items || []).forEach((t, i) => S.els.push(text('item-' + (i+1), t)));
  if (o.template === 'photo' || o.template === 'logo') {
    S.bg.seed = Math.floor(Math.random()*100000) + 1; S.bg.zoom = 1; S.bg.ox = S.bg.oy = 0;
    IMG.bg = await libImage(o.photo.url); IMG.src = Object.assign({ kind:'lib' }, o.photo); S.bg.kind = 'photo';
  } else if (o.template === 'collage') {
    await makeCollage('all', o.photos);
  } else {
    await randomBackground(o.template);
  }
  randomStyle();
  if (o.template === 'headline') { addPhoto(o.photo, await libImage(o.photo.url)); }
  if (o.badge) placeBadge('badge-now-enrolling');
  return { label: o.label, state: JSON.parse(snapshot()), bg: IMG.bg, src: IMG.src ? clone(IMG.src) : null, thumb: thumb(),
           photos: o.photo ? [o.photo.id] : (o.photos || []).map(x => x.id) };
}

// Their posts use several borders, not just the blue wave, so the three options each get a
// different one: never the same twice in a set, and the full blue wave at most once.
const FRAMES = [
  { name:'blue wave',        style:'a', wave:'both',   weight:3 },
  { name:'bottom wave',      style:'a', wave:'bottom', weight:3 },
  { name:'white footer',     style:'c', wave:'bottom', weight:3 },
  { name:'plain wave',       style:'b', wave:'both',   weight:1 },
];
function assignFrames(specs){
  // weighted shuffle, then hand them out in order to the options that don't have one yet
  const order = FRAMES.map(f => ({ f, k: Math.pow(Math.random(), 1/f.weight) })).sort((a,b) => b.k - a.k).map(x => x.f);
  let i = 0;
  for (const s of specs) {
    if (s.frame) continue;
    s.frame = order[i++ % order.length];
    s.label += ' \u00b7 ' + s.frame.name;
  }
}

const CTX = { iso:null, offered:new Set(), options:[], on:-1 };
function calTarget(){ return selectedPost() || viewPosts()[0] || null; }

async function generateFromPost(){
  if (genBusy) return;
  const p = calTarget();
  if (!p) { toast('Pick a post in the calendar first'); return; }
  genBusy = true;
  hideWelcome();
  const btn = $('#calGen'); if (btn) btn.disabled = true;
  $('#loading').classList.add('show');
  try {
    // the post becomes the selected one, so the download is named after it
    if (CAL.view && CAL.view.kind === 'week') CAL.view.used = p.iso; else CAL.view = { kind:'day', iso:p.iso };
    if (CTX.iso !== p.iso) { CTX.iso = p.iso; CTX.offered = new Set(); }
    pushUndo();
    const head = headlineFor(p);
    const ranked = rankPhotos(p, CTX.offered);
    const list = captionList(p.post), quote = captionQuote(p.post);
    const bucket = String(p.bucket || '').toLowerCase();
    const specs = [];
    if (p.noHead && ranked.length) {
      // x in HOOK TEXT: the picture is the post — full photos in the frame, and a collage
      specs.push({ label:'Photo only', template:'logo', photo:ranked[0] });
      if (ranked[1]) specs.push(/enroll/.test(bucket)
        ? { label:'Enrolling badge', template:'logo', photo:ranked[1], frame:'none', badge:true }
        : { label:'Photo only', template:'logo', photo:ranked[1] });
      if (ranked.length >= 5) specs.push({ label:'Collage', template:'collage', photos:ranked.slice(2, 6) });
      else if (ranked[2]) specs.push({ label:'Photo only', template:'logo', photo:ranked[2] });
    } else if (ranked.length) {
      specs.push({ label:'Photo + headline', template:'headline', headline:head, photo:ranked[0] });
      // enrollment posts get the full photo with their Now Enrolling badge
      if (ranked[1]) specs.push(/enroll/.test(bucket)
        ? { label:'Enrolling badge', template:'photo', headline:head, photo:ranked[1], frame:'none', badge:true }
        : { label:'Full photo', template:'photo', headline:head, photo:ranked[1] });
    }
    if (p.noHead) { /* no writing on the page, so no list, quote or note card */ }
    else if (list) specs.push({ label:'List card', template:'list', headline:list.headline, items:list.items });
    else if (quote) specs.push({ label:'Parent quote', template:'quote', quote:quote.quote, attr:quote.attr });
    else if (/community|enroll/.test(bucket) && ranked.length >= 5) specs.push({ label:'Collage', template:'collage', headline:head, photos:ranked.slice(2, 6) });
    else specs.push({ label:'Note card', template:'note', headline:head });
    if (!p.noHead && specs.length < 3 && ranked[2]) specs.splice(1, 0, { label:'Photo + headline', template:'headline', headline:head, photo:ranked[2] });
    assignFrames(specs.slice(0, 3));
    CTX.options = [];
    for (const o of specs.slice(0, 3)) {
      const built = await buildOption(o);
      built.photos.forEach(id => CTX.offered.add(id));
      CTX.options.push(built);
    }
    currentDraftId = null;
    applyOption(0, false);
    renderOptions();
    renderCalendar();
    toast('Three options for ' + DAY_ABBR[p.date.getDay()] + ' ' + (p.date.getMonth()+1) + '/' + p.date.getDate() + ' — pick one under Options for this post');
  } catch (err) { console.error(err); toast('Couldn’t generate: ' + (err.message || err)); }
  finally { $('#loading').classList.remove('show'); genBusy = false; updateCalGen(); }
}

function applyOption(i, undoable = true){
  const o = CTX.options[i]; if (!o) return;
  if (undoable) pushUndo();
  Object.assign(S, clone(o.state)); S.sel = null;
  IMG.bg = o.bg; IMG.src = o.src ? clone(o.src) : null;
  CTX.on = i;
  syncControls(); renderInspector(); renderResults(); renderQuickFields(); fitCanvas(); persist();
  renderOptions();
}

function renderOptions(){
  const box = $('#opts'); if (!box) return;
  box.hidden = !CTX.options.length;
  const row = $('#optsRow'); row.innerHTML = '';
  CTX.options.forEach((o, i) => row.append(h('button',{class:'opt','aria-pressed':String(i === CTX.on),
    title:'Use this one', onclick:()=>applyOption(i)},
    h('img',{src:o.thumb, alt:''}), h('span',{}, o.label))));
}

// The calendar button always says which post it will use, so there's no guessing.
function updateCalGen(){
  const b = $('#calGen'); if (!b) return;
  if (!calCfg()) { b.hidden = true; return; }
  const p = calTarget();
  // options made for one post shouldn't linger once another post is picked
  if (CTX.options.length && (!p || p.iso !== CTX.iso)) { CTX.options = []; CTX.on = -1; renderOptions(); }
  b.disabled = !p || genBusy;
  b.textContent = '\u{1F4C5} Generate from calendar' + (p ? ' \u00b7 ' + DAY_ABBR[p.date.getDay()] + ' ' + (p.date.getMonth()+1) + '/' + p.date.getDate() : '');
  b.title = p ? 'Build three graphics matched to this post: ' + (p.bucket || 'post') + ' — ' + (p.noHead ? 'photo only' : p.hook || 'no hook text yet') : 'Pick a post in the calendar first';
}

$('#calGen').addEventListener('click', generateFromPost);
$('#optsMore').addEventListener('click', generateFromPost);
$('#optsClose').addEventListener('click', () => { CTX.options = []; CTX.on = -1; renderOptions(); });

// Clear: everything off the page but the paper and the wave frame. The calendar selection
// stays, so the next "Generate from calendar" picks up where Karissa was.
$('#clearBtn').addEventListener('click', () => {
  pushUndo();
  S.template = 'logo'; S.els = []; S.sel = null;
  S.bg.kind = 'paper'; S.bg.ground = 'paper'; S.bg.cells = null; S.bg.dim = 0;
  // the photo stays loaded (just not shown on paper) so Undo brings the graphic back whole
  IMG.src = { kind:'ground', ground:'paper' };
  CTX.options = []; CTX.on = -1; renderOptions();
  currentDraftId = null;
  hideWelcome();
  templateDefaults(); layout(); syncControls(); renderInspector(); renderResults(); renderQuickFields(); fitCanvas(); persist();
  toast('Cleared \u2014 Undo brings it back');
});

// ---------- zooming photos ----------
// Scroll (or trackpad-pinch) over a framed or collage photo to zoom it inside its frame, or
// over a full-page photo to zoom the background. One undo step per gesture.
var cropMode = null;                 // id of the framed photo whose drag pans inside its frame
let wheelUndoAt = 0;
cv.addEventListener('wheel', e => {
  const [x, y] = toDesign(e);
  const el = hitEl(x, y);
  const photo = el && el.type === 'image' ? el : null;
  if (!photo && !(S.bg.kind === 'photo' && IMG.bg && !el)) return;
  e.preventDefault();
  if (Date.now() - wheelUndoAt > 600) pushUndo();
  wheelUndoAt = Date.now();
  const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
  if (photo) {
    photo.zoom = Math.max(1, Math.min(4, (photo.zoom || 1) * f));
    if (S.sel !== photo.id) { S.sel = photo.id; renderInspector(); }
    const z = $('#insp-zoom'); if (z) z.value = Math.round(photo.zoom*100);
  } else {
    S.bg.zoom = Math.max(1, Math.min(3, (S.bg.zoom || 1) * f));
    $('#zoom').value = Math.round(S.bg.zoom*100);
  }
  render();
}, { passive:false });
// Double-click a framed photo to switch dragging between moving the frame and moving the
// photo inside it.
cv.addEventListener('dblclick', e => {
  const [x, y] = toDesign(e);
  const el = hitEl(x, y);
  if (!el || el.type !== 'image') return;
  cropMode = cropMode === el.id ? null : el.id;
  S.sel = el.id; renderInspector(); render();
  toast(cropMode ? 'Drag to move the photo inside its frame — double-click again when done' : 'Dragging moves the whole photo again');
});

// Two-finger pinch on a phone or tablet: zooms the photo the pinch started on (inside its
// frame), or the full-page photo. While two fingers are down the ordinary drag stands aside.
const touches = new Map();
let pinch = null;
cv.style.touchAction = 'none';
cv.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch') return;
  touches.set(e.pointerId, [e.clientX, e.clientY]);
  if (touches.size !== 2) return;
  const [[x1, y1], [x2, y2]] = [...touches.values()];
  const [mx, my] = toDesign({ clientX:(x1+x2)/2, clientY:(y1+y2)/2 });
  const el = hitEl(mx, my);
  const target = el && el.type === 'image' ? el : (S.bg.kind === 'photo' && IMG.bg ? 'bg' : null);
  if (!target) return;
  drag = null;                                   // the first finger's drag doesn't get to move things
  pinch = { target, d0: Math.hypot(x2-x1, y2-y1), z0: target === 'bg' ? (S.bg.zoom || 1) : (target.zoom || 1) };
  e.stopImmediatePropagation();
}, true);
cv.addEventListener('pointermove', e => {
  if (e.pointerType !== 'touch' || !touches.has(e.pointerId)) return;
  touches.set(e.pointerId, [e.clientX, e.clientY]);
  if (!pinch || touches.size < 2) return;
  e.stopImmediatePropagation();
  const [[x1, y1], [x2, y2]] = [...touches.values()];
  const z = pinch.z0 * Math.hypot(x2-x1, y2-y1) / pinch.d0;
  if (pinch.target === 'bg') { S.bg.zoom = Math.max(1, Math.min(3, z)); $('#zoom').value = Math.round(S.bg.zoom*100); }
  else { pinch.target.zoom = Math.max(1, Math.min(4, z)); const s = $('#insp-zoom'); if (s) s.value = Math.round(pinch.target.zoom*100); }
  render();
}, true);
const endTouch = e => { touches.delete(e.pointerId); if (touches.size < 2) pinch = null; };
cv.addEventListener('pointerup', endTouch, true);
cv.addEventListener('pointercancel', endTouch, true);
