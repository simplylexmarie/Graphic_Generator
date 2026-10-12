// ---------- Spring Forth: the studio adapter ----------
// What the shared calendar, options, month and Clear modules need to know about this studio.
const STUDIO = {
  slug: 'springforth', name: 'Spring Forth', filePrefix: 'SpringForth',
  // All four come off their own pages. Sky and deep blue were the obvious pair for the first
  // two buckets, but at dot size they are the same colour, so Equipping takes the green from
  // the pushpin on their cork-board quotes instead. ("enroll" also catches "Enrollement".)
  buckets: [
    ['inspir', 'Inspiring Growth', '#1cc1e0'],
    ['equip',  'Equipping',        '#02d594'],
    ['commun', 'Community',        '#ffc000'],
    ['enroll', 'Enrollment',       '#bb8a2d'],
  ],
  bucketTopics: { 'inspiring growth':'values', 'equipping':'philosophy', 'community':'community', 'enrollment':'enroll', 'enrollement':'enroll' },
  // a headline lands on a note card when the page is a bare photo
  applyHeadline(head){
    if (S.template === 'logo' || S.template === 'photo') { S.template = 'note'; templateDefaults(); }
    layout();
    const el = byId('headline');
    if (el) el.text = head;
    else { S.template = 'note'; templateDefaults(); layout(); const e2 = byId('headline'); if (e2) e2.text = head; }
  },
  // blank page: the paper and the wave frame. The photo stays loaded (just not shown on paper)
  // so Undo brings the graphic back whole.
  blank(){
    S.template = 'logo'; S.els = [];
    S.bg.kind = 'paper'; S.bg.ground = 'paper'; S.bg.cells = null; S.bg.dim = 0;
    IMG.src = { kind:'ground', ground:'paper' };
  },
  get frames(){ return FRAMES; },
  specsFor: (p, offered) => specsFor(p, offered),
  buildOption: o => buildOption(o),
};

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
// The options a post gets, best first: what the month batch and the three-option view share.
function specsFor(p, offered){
  const head = headlineFor(p);
  const ranked = rankPhotos(p, offered);
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
  return specs;
}

