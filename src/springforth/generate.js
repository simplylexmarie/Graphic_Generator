// ---------- Generate (randomizer) — Spring Forth ----------
const _m = new Date().getMonth();
const LEARN_KEY = 'sfa-learn-v1';
let learn = { look:{}, textPos:{}, ground:{}, bgKind:{}, note:{}, sub:{}, subTopic:{} };
try { const o = JSON.parse(localStorage.getItem(LEARN_KEY)||'null'); if (o && o.look) learn = o; } catch {}
function bump(kind, key){ if (!key) return; if (!learn[kind]) learn[kind] = {}; learn[kind][key] = (learn[kind][key]||0) + 1; try { localStorage.setItem(LEARN_KEY, JSON.stringify(learn)); } catch {} }
function learnFromCurrent(){
  bump('look', S.look); bump('bgKind', S.bg.kind || 'paper'); bump('ground', S.bg.ground || 'paper');
  if (S.template === 'headline') bump('textPos', S.textPos);
  if (S.template === 'note') bump('note', S.noteFill || '#dff1ee');
  const hl0 = byId('headline'), sb0 = byId('sub');
  if (sb0 && sb0.text) { bump('sub', sb0.text.trim()); learn.subTopic = learn.subTopic || {}; learn.subTopic[sb0.text.trim()] = detectTopic((hl0?.text || '') + ' ' + sb0.text) || 'philosophy'; }
}
function pick(options, kind){
  const weights = options.map(([v,w]) => w * (1 + (learn[kind]?.[v]||0)));
  let r = Math.random() * weights.reduce((a,b)=>a+b, 0);
  for (let i=0;i<options.length;i++) { r -= weights[i]; if (r <= 0) return options[i][0]; }
  return options[options.length-1][0];
}

// ---------- phrase bank: Spring Forth's voice, seeded from the 2026 Instagram set ----------
const BANK = {
  values:     { label:'Values',      heads:['Ownership','Honest Mastery','Challenge\nwith Support','Whole-Child\nFocus','Learner Driven','Student Led','Real-World Learning','Teamwork','Persistence','Learning By Doing','Intentionality','Building Community'],
                subs:['What it looks like at Spring Forth.','One of the habits we build every day.','A piece of how our learners grow.'] },
  philosophy: { label:'Our approach', heads:['What Makes\nSpring Forth\nDifferent?','Mastery, not just completion','There has to be more\nthan grades and test prep.','From “I can’t”\nto “I did!”','Building inner strength\nfor their future','Equipping Youth','Inspiring growth with\nthe Hero’s Journey','I can grow'],
                subs:['Learner-driven, hands-on, and real.','Where children own their learning.','Guides, not lecturers.','Learning that sticks because it mattered.'] },
  day:        { label:'A day here',  heads:['What a learner-driven day\nreally looks like','Leadership in\neveryday moments','A day at Spring Forth','That new school year feeling!','Real life learning'],
                subs:['Goals set, choices made, work owned.','Small moments, big growth.','Hands on, student driven.'] },
  parents:    { label:'For parents', heads:['Parenting is a wild ride,\nand you are not alone','Your encouraging words','Instead of “You’re so smart,” try:','Three questions we encourage\nparents to ask anywhere they visit:','What’s one sign of growth\nyou’ve noticed in your child\nthis month?'],
                subs:['A small shift with a big effect.','We’re in this together.','Tell us in the comments.'] },
  enroll:     { label:'Enrollment',  heads:['We Are\nNow Enrolling!','Enrollment Open!','Enrollment is Starting!','Now Enrolling!','Discover\nSpring Forth Academy'],
                subs:['Contact us for a tour today!','Visit springforthsv.org to learn more.','Limited spots for the coming year.','Come see a learner-driven day for yourself.'] },
  community:  { label:'Community',   heads:['Building Community','Our tribe in action','Better together','Out in the world'],
                subs:['Learning doesn’t stop at the door.','An extension of the village.','Field trips, projects, and real work.'] },
};
const SEASONAL_LINES = {
  spring:['Enrollment is open for the coming year.','Spring projects are in full swing.'],
  summer:['Summer is a great time to tour.','Planning for the new school year already.'],
  autumn:['That new school year feeling!','New year, new goals, new tribe.'],
  winter:['Mid-year growth is the best kind to watch.','Now is a good time to visit a session.'],
};
const SEASON_NAME = _m >= 8 && _m <= 10 ? 'autumn' : _m >= 11 || _m <= 1 ? 'winter' : _m <= 4 ? 'spring' : 'summer';
let topic = 'any';
function renderTopics(){
  const box = $('#topicChips'); box.innerHTML = '';
  for (const [k,l] of [['any','Any'],...Object.entries(BANK).map(([k,v]) => [k,v.label]),['seasonal','Seasonal']])
    box.append(h('button',{class:'chip','aria-pressed':String(k===topic),onclick:()=>{ topic = k; renderTopics(); }}, l));
}
function subsFor(key){
  const base = BANK[key].subs;
  const learned = Object.keys(learn.sub || {}).filter(t => (learn.subTopic||{})[t] === key && !base.includes(t));
  return base.concat(learned).map(t => [t, 1]);
}
function suggestText(key){
  const k = key === 'any' ? pick(Object.keys(BANK).map(x => [x, x === 'values' ? 4 : 3]), 'topic') : key;
  if (k === 'seasonal') {
    const line = pick(SEASONAL_LINES[SEASON_NAME].map(t => [t,1]), 'seasonal');
    const t2 = pick([['enroll',3],['day',2]], 'topic');
    return { headline: pick(BANK[t2].heads.map(x => [x,1]), 'head'), sub: line, topic: t2 };
  }
  const head = pick(BANK[k].heads.map(x => [x,1]), 'head');
  const subs = subsFor(k);
  const sub = (k === 'enroll' || Math.random() < 0.45) && subs.length ? pick(subs, 'sub') : '';
  return { headline: head, sub, topic: k };
}
function detectTopic(t){
  const x = t.toLowerCase();
  if (/enroll|tour|open house|spots|apply|register|discover spring forth/.test(x)) return 'enroll';
  if (/parent|mom|dad|family|at home|encourag|ask|comment/.test(x)) return 'parents';
  if (/ownership|mastery|challenge|whole-child|learner driven|student led|teamwork|persistence|learning by doing|intentionality|civility|excellence/.test(x)) return 'values';
  if (/community|tribe|field trip|together|village|event|picnic/.test(x)) return 'community';
  if (/day|schedule|morning|session|studio|everyday|routine/.test(x)) return 'day';
  if (/different|grades|test prep|hero’s journey|hero's journey|growth mindset|equipping|inner strength|approach/.test(x)) return 'philosophy';
  return null;
}
function analyzeCaption(txt){
  const quoted = ((txt.match(/[“"]([^”"]{12,240})[”"]/) || [])[1] || '').trim();
  const tp = detectTopic(txt);
  const parentQuote = quoted && /parent|mom|dad|family|we see|our kids|my child|tell us/i.test(txt);
  if (parentQuote) return { template:'quote', headline:'', sub:'', quote:'“' + quoted + '”', attr:'A Spring Forth parent' };
  if (LIST_RE.test(txt)) { const q = (txt.match(/[^.!?\n]*(?:instead of|three questions|questions we)[^.!?\n]*/i)||[])[0];
    return { template:'list', headline:((q||'A few things to try').trim().replace(/[.:]?$/, ':')), items:[], sub:'', quote:'', attr:'' }; }
  if (quoted && quoted.length < 70) { const sgg = tp ? suggestText(tp) : { sub:'' }; return { template:'headline', headline:quoted, sub:sgg.sub || '', quote:'', attr:'' }; }
  if (tp) { const sgg = suggestText(tp); return { template: tp === 'values' ? 'note' : 'headline', headline:sgg.headline, sub:sgg.sub, quote:'', attr:'' }; }
  return { template:'logo', headline:'', sub:'', quote:'', attr:'' };
}
function parseBrief(txt){
  const wordsAll = txt.split(/\s+/).filter(Boolean).length;
  const captionSignals = /https?:\/\/|link in bio|#\w+|read more|learn more|swipe/i.test(txt);
  if (wordsAll > 26 || captionSignals) return analyzeCaption(txt);
  return parseLines(txt);
}
const LIST_RE = /\b(instead of|three questions|questions we|try:|ask:|ways to|signs of)\b/i;
function parseLines(txt){
  const lines = txt.split('\n').map(l => l.trim()).filter(Boolean);
  const attr = lines.find(l => /^[—–-]\s*/.test(l));
  const body = lines.filter(l => l !== attr);
  const joined = body.join(' ');
  const words = joined.split(/\s+/).filter(Boolean).length;
  const quoted = /^[“"']/.test(joined) || /[”"']$/.test(joined);
  if (!lines.length) return { template:'logo', headline:'', sub:'', quote:'', attr:'' };
  if (quoted || words > 18) return { template:'quote', headline:'', sub:'', quote:joined, attr: (attr || 'A Spring Forth parent').replace(/^[\u2014\u2013-]\s*/, '') };
  // a short phrase — on one line or broken over two or three — is a sticky-note card,
  // and the line breaks she typed are kept as written
  // an intro ending in a colon is a three-note list; lines after it become the notes
  if (/:\s*$/.test(body[0] || '') || LIST_RE.test(body[0] || '')) {
    return { template:'list', headline: body[0], items: body.slice(1).filter(Boolean).slice(0,3), sub:'', quote:'', attr:'' };
  }
  if (body.length <= 3 && words <= 8) return { template:'note', headline: body.join('\n'), sub:'', quote:'', attr:'' };
  return { template:'headline', headline: body[0] || '', sub: body.slice(1).join(' '), quote:'', attr:'' };
}

// House rules: paper is the default ground; a photo either fills the page or sits framed on the paper.
async function randomBackground(template){
  const photos = LIB.slice();
  const fresh = photos.filter(p => !photoMem.used[p.id]);
  const pool = fresh.length >= 3 ? fresh : photos;
  S.bg.seed = Math.floor(Math.random()*100000) + 1;
  S.bg.cells = null; S.bg.zoom = 1; S.bg.ox = S.bg.oy = 0;
  if (template === 'note' || template === 'list') {
    S.bg.kind = 'paper'; S.bg.ground = 'paper'; IMG.bg = null; IMG.src = { kind:'ground', ground:'paper' };
    return 'paper';
  }
  if (template === 'quote') {
    S.bg.kind = 'paper'; S.bg.ground = 'cork'; IMG.bg = null; IMG.src = { kind:'ground', ground:'cork' };
    return 'cork';
  }
  if (template === 'collage') {
    if (pool.length < 3) return 'none';
    await makeCollage('all'); return 'collage';
  }
  if (template === 'logo' || template === 'photo') {
    if (!pool.length) return 'none';
    const favs = pool.filter(p => photoMem.favs[p.id]);
    const from = favs.length >= 3 && Math.random() < 0.35 ? favs : pool;
    const p = from[Math.floor(Math.random()*from.length)];
    IMG.bg = await libImage(p.url); IMG.src = Object.assign({ kind:'lib' }, p);
    S.bg.kind = 'photo'; return 'photo';
  }
  // note / headline: crumpled paper
  S.bg.kind = 'paper'; S.bg.ground = 'paper'; IMG.bg = null; IMG.src = { kind:'ground', ground:'paper' };
  return 'paper';
}
// House rule: paper never carries a headline on its own. A headline layout always gets a
// photo; if the library is empty the headline is demoted to a sticky-note card instead.
async function maybeAddPhoto(){
  const el = byId('photo');
  if (S.template !== 'headline' || S.bg.kind !== 'paper') { if (el) S.els = S.els.filter(e => e.id !== 'photo'); return true; }
  if (!LIB.length) { if (el) S.els = S.els.filter(e => e.id !== 'photo'); return false; }
  const fresh = LIB.filter(p => !photoMem.used[p.id]); const from = fresh.length ? fresh : LIB;
  const p = from[Math.floor(Math.random()*from.length)];
  const im = await libImage(p.url); addPhoto(p, im);
  return true;
}
function randomStyle(){
  const had = new Set(S.els.map(e => e.id));
  S.look = pick([['blue', 12], ['gold', 1]], 'look');
  S.noteFill = pick(NOTE_FILLS.map(([hex]) => [hex, 1]), 'note');
  S.tapeFill = TAPE_FILLS[Math.floor(Math.random()*TAPE_FILLS.length)];
  S.noteRot = (Math.random() - 0.5) * 0.06;
  if (S.template === 'headline') S.textPos = pick([['tc', 6], ['tl', 2], ['mid', 1]], 'textPos');
  templateDefaults(); layout();
  S.els = S.els.filter(e => had.has(e.id) || !['headline','sub','quote','attr'].includes(e.id));
  autoContrast(false);
}
let genBusy = false;
async function generate(){
  if (genBusy) return; genBusy = true;
  const btn = $('#genGo'); btn.disabled = true; $('#genStatus').textContent = 'Building…';
  try {
    let brief = parseBrief($('#genText').value);
    if (brief.template === 'logo' && !$('#genText').value.trim() && topic !== 'any') { const sgg = suggestText(topic); brief = { template: topic === 'values' ? 'note' : 'headline', headline:sgg.headline, sub:sgg.sub, quote:'', attr:'' }; }
    const forced = document.querySelector('#genTpl button[aria-pressed="true"]').dataset.v;
    pushUndo();
    S.template = forced === 'auto' ? brief.template : forced;
    S.els = [];
    if (S.template === 'note') S.els.push(text('headline', brief.headline || 'Ownership'));
    if (S.template === 'headline' || S.template === 'photo' || S.template === 'collage') {
      S.els.push(text('headline', brief.headline || 'Learning By Doing'));
      if (brief.sub) S.els.push(text('sub', brief.sub));
    }
    if (S.template === 'quote') { S.els.push(text('quote', brief.quote)); S.els.push(text('attr', brief.attr)); }
    if (S.template === 'list') {
      S.els.push(text('headline', brief.headline || 'A few things to try:'));
      (brief.items || []).forEach((t,i) => { if (i < 3) S.els.push(text('item-'+(i+1), t)); });
    }
    const bgKind = await randomBackground(S.template);
    if (bgKind === 'none') {
      // no photos yet: fall back to a paper card so we never hand back an empty frame
      S.template = S.template === 'collage' ? 'headline' : 'note';
      if (!byId('headline')) { const sgg = suggestText(topic === 'any' ? 'values' : topic); S.els = [text('headline', sgg.headline)]; }
      await randomBackground(S.template);
      toast('No photos in the library yet, so this is a paper card');
    }
    randomStyle();
    if (!(await maybeAddPhoto())) {
      const hl = byId('headline')?.text || 'Learning By Doing';
      S.template = 'note'; S.els = [text('headline', hl)];
      templateDefaults(); layout();
      toast('No photo to pair with that headline, so this is a note card');
    }
    currentDraftId = null;
    $('#gen').hidden = true;
    syncControls(); renderInspector(); renderResults(); fitCanvas(); persist();
    toast('Generated. Press Generate again for another, or adjust this one.');
  } catch (err) {
    console.error(err); $('#genStatus').textContent = 'Couldn’t generate: ' + (err.message || err);
  } finally { btn.disabled = false; genBusy = false; }
}
async function shufflePhoto(){
  if (genBusy) return; genBusy = true;
  $('#loading').classList.add('show');
  try {
    pushUndo();
    if (S.bg.kind === 'collage') await makeCollage('all');
    else { await randomBackground(S.template); }
    templateDefaults(); layout(); autoContrast(false); await maybeAddPhoto();
    syncControls(); renderInspector(); renderResults(); fitCanvas();
  } catch (err) { toast(err.message || String(err)); }
  finally { $('#loading').classList.remove('show'); genBusy = false; }
}
function shuffleLook(){
  pushUndo();
  S.bg.seed = Math.floor(Math.random()*100000) + 1;
  S.bg.seed = Math.floor(Math.random()*100000) + 1;
  randomStyle(); syncControls(); renderInspector(); render(); persist();
}
$('#genBtn').addEventListener('click', () => { $('#genStatus').textContent = ''; renderTopics(); $('#gen').hidden = false; setTimeout(() => $('#genText').focus(), 0); });
$('#suggestBtn').addEventListener('click', () => { const sgg = suggestText(topic); $('#genText').value = sgg.headline + (sgg.sub ? '\n' + sgg.sub : ''); $('#genStatus').textContent = 'Press Suggest again for another, or edit it, then Generate.'; });
$('#genCancel').addEventListener('click', () => { $('#gen').hidden = true; });
$('#genGo').addEventListener('click', generate);
$('#genText').addEventListener('keydown', e => { if ((e.metaKey||e.ctrlKey) && e.key === 'Enter') generate(); });
$('#genTpl').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; document.querySelectorAll('#genTpl button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
$('#shufPhoto').addEventListener('click', shufflePhoto);
$('#shufLook').addEventListener('click', shuffleLook);
