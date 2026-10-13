// ---------- Generate (randomizer) — McMillan ----------
const _m = new Date().getMonth();
const LEARN_KEY = 'mcm-learn-v1';
let learn = { look:{}, textPos:{}, frame:{}, art:{}, bgKind:{}, sub:{}, subTopic:{} };
try { const o = JSON.parse(localStorage.getItem(LEARN_KEY)||'null'); if (o && o.look) learn = o; } catch {}
function bump(kind, key){ if (!key) return; if (!learn[kind]) learn[kind] = {}; learn[kind][key] = (learn[kind][key]||0) + 1; try { localStorage.setItem(LEARN_KEY, JSON.stringify(learn)); } catch {} }
function learnFromCurrent(){
  bump('look', S.look); bump('frame', S.frame || 'none'); bump('bgKind', S.bg.kind || 'art');
  if (S.bg.kind !== 'photo') bump('art', S.bg.art);
  if (S.template === 'headline' || S.template === 'event') bump('textPos', S.textPos);
  const hl0 = byId('headline'), sb0 = byId('sub');
  if (sb0 && sb0.text && S.template === 'headline') { bump('sub', sb0.text.trim()); learn.subTopic = learn.subTopic || {}; learn.subTopic[sb0.text.trim()] = detectTopic((hl0?.text || '') + ' ' + sb0.text) || 'quality'; }
}
// Weighted random: base weight × (1 + times chosen before), so what gets downloaded drifts upward.
function pick(options, kind){
  const weights = options.map(([v,w]) => w * (1 + (learn[kind]?.[v]||0)));
  let r = Math.random() * weights.reduce((a,b)=>a+b, 0);
  for (let i=0;i<options.length;i++) { r -= weights[i]; if (r <= 0) return options[i][0]; }
  return options[options.length-1][0];
}

// ---------- phrase bank: McMillan's voice, seeded from the July–September 2026 posts ----------
const BANK = {
  values:  { label:'Values',        heads:['INTEGRITY:','QUALITY:','EXCELLENCE:','POSITIVE ATTITUDE & DOER:','RELIABILITY:','PARTNERSHIP:'],
             subs:{ 'INTEGRITY:':['Telling the truth about what we can do and when we can deliver it.','Saying what we’ll do, then doing it.'],
                    'QUALITY:':['Investing in people, systems, and testing so motors do their job quietly for years.','Built to run, not to be replaced.'],
                    'EXCELLENCE:':['Asking “What will this have to survive in the field?” and designing accordingly.','Good enough isn’t.'],
                    'POSITIVE ATTITUDE & DOER:':['Showing up as partners who help when things get hard, not just when they go to plan.'],
                    'RELIABILITY:':['Motors that start every time, for years, without a phone call.','Tested here before it ships anywhere.'],
                    'PARTNERSHIP:':['Being the supplier you can call when something changes.','Locked lead times, stocking agreements, real people.'] } },
  quality: { label:'Quality & trust', heads:['Proven before it ships.','Quality you can trust','Built. Tested. Trusted.','Built Here. Tested Here. Trusted Everywhere.','Reliability pays for itself','Dependability goes beyond delivery.'],
             subs:['Every motor tested before it leaves the plant.','Precision electric motors since 1976.','Made in the USA, tested in-house.','Consistency you can plan production around.'] },
  partner: { label:'Partnership',    heads:['More than a motor vendor','Partnership is part of the performance.','Realistic lead times matter.','Start the conversation.','Frustrated with your motor supplier?','What do you value most in your motor supplier?'],
             subs:['Locked lead times. Stocking agreements. Someone to call.','A partner in uptime, not just a line item.','Let’s talk about your program.','Real people who understand your application.'] },
  design:  { label:'Engineering',    heads:['Application drives the design','Great motor programs start before production','The problem isn’t always the motor.','One speed is rarely enough','Variable-speed EC motors give designers more room to work'],
             subs:['Custom-engineered for your application.','Design support from prototype to production.','Right motor, right spec, first time.','We engineer around what the motor has to survive.'] },
  cost:    { label:'Cost & supply',  heads:['The cheapest motor isn’t always the most cost efficient choice.','The real cost of a foreign motor','Supply chain integrity','Protect margins while expectations rise'],
             subs:['Freight, tariffs, buffer inventory, downtime. Add it up.','Total cost of ownership, not unit price.','American-made components you can trace.','Fewer surprises between order and delivery.'] },
  comply:  { label:'Compliance',     heads:['UFLPA and Section 307 of the Tariff Act Compliant','UL 5VA Testing Compliant','Made in the USA','Set your products apart with American-made components'],
             subs:['Documentation ready when your customers ask.','Compliance built into the process, not bolted on.','Traceable, tested, certified.'] },
  heritage:{ label:'Heritage & team', heads:['Over 150 million motors sold since 1976','Powering people’s lives.','50 years of precision','Meet the people behind the motors'],
             subs:['Family-owned. Precision-built. Since 1976.','Fifty years of motors that just work.','The team that builds, tests, and ships every motor.'] },
};
const SEASONAL_LINES = {
  spring:['Spring build season is here. Lock in lead times now.','Plan the second half now, while capacity is open.'],
  summer:['Heat is hard on motors. Spec for the conditions.','Mid-year is the time to firm up Q4 programs.'],
  autumn:['Year-end programs start with locked lead times.','Plan next year’s motor program before the rush.'],
  winter:['Cold starts and tight schedules: reliability matters most now.','New year, new programs: let’s talk lead times.'],
};
const SEASON_NAME = _m >= 8 && _m <= 10 ? 'autumn' : _m >= 11 || _m <= 1 ? 'winter' : _m <= 4 ? 'spring' : 'summer';
let topic = 'any';
function renderTopics(){
  const box = $('#topicChips'); box.innerHTML = '';
  for (const [k,l] of [['any','Any'],...Object.entries(BANK).map(([k,v]) => [k,v.label]),['seasonal','Seasonal']])
    box.append(h('button',{class:'chip','aria-pressed':String(k===topic),onclick:()=>{ topic = k; renderTopics(); }}, l));
}
function subsFor(key, head){
  const b = BANK[key];
  const base = Array.isArray(b.subs) ? b.subs : (b.subs[head] || []);
  const learned = Object.keys(learn.sub || {}).filter(t => (learn.subTopic||{})[t] === key && !base.includes(t));
  return base.concat(learned).map(t => [t, 1]);
}
function suggestText(key){
  const k = key === 'any' ? pick(Object.keys(BANK).map(x => [x, x === 'values' ? 4 : x === 'heritage' ? 1 : 3]), 'topic') : key;
  if (k === 'seasonal') {
    const line = pick(SEASONAL_LINES[SEASON_NAME].map(t => [t,1]), 'seasonal');
    const t2 = pick([['partner',3],['quality',2]], 'topic');
    return { headline: pick(BANK[t2].heads.map(x => [x,1]), 'head'), sub: line, topic: t2 };
  }
  const head = pick(BANK[k].heads.map(x => [x,1]), 'head');
  const subs = subsFor(k, head);
  // statements always carry their explanation; other topics get a subline about half the time
  const sub = (k === 'values' || Math.random() < 0.5) && subs.length ? pick(subs, 'sub') : '';
  return { headline: head, sub, topic: k };
}
function detectTopic(t){
  const x = t.toLowerCase();
  if (/uflpa|section 307|tariff act|ul 5va|ul-5va|compliant|compliance|certif|made in the usa|american-made/.test(x)) return 'comply';
  if (/cheapest|cost of ownership|foreign motor|tariff|freight|supply chain|margin|price/.test(x)) return 'cost';
  if (/integrity|excellence|positive attitude|doer|our values|core value/.test(x)) return 'values';
  if (/lead ?time|supplier|vendor|partner|stocking|conversation|call us|let’s connect|let's connect|frustrated/.test(x)) return 'partner';
  if (/application|design|engineer|ec motor|variable-speed|one speed|program|spec|prototype/.test(x)) return 'design';
  if (/anniversary|since 1976|150 million|history|team|picnic|employee|people behind/.test(x)) return 'heritage';
  if (/quality|tested|proven|reliab|trust|built here|dependab/.test(x)) return 'quality';
  return null;
}
function analyzeCaption(txt){
  const quoted = ((txt.match(/[“"]([^”"]{6,90})[”"]/) || [])[1] || '').replace(/[\s,.;:!]+$/, '');
  const tp = detectTopic(txt);
  const time = (txt.match(/\b\d{1,2}(:\d{2})?\s*(?:[–-]\s*\d{1,2}(:\d{2})?\s*)?(am|pm|a\.m\.|p\.m\.)\b/i) || [])[0] || '';
  const date = (txt.match(/\b(?:(?:mon|tues|wednes|thurs|fri|satur|sun)day,?\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b/i) || [])[0] || '';
  const eventish = /open house|trade show|expo|booth|webinar|join us|rsvp|visit us|tour|training|seminar|picnic/i.test(txt) && (time || date || /open house|trade show|expo|booth|rsvp/i.test(txt));
  if (eventish) {
    const title = quoted || (/open house/i.test(txt) ? 'Open House' : /trade show|expo|booth/i.test(txt) ? 'See us at the show' : /picnic/i.test(txt) ? 'Company Picnic' : 'Join us');
    const boothM = txt.match(/booth\s*#?\s*([A-Za-z0-9-]+)/i);
    const details = [date, time, boothM ? 'Booth ' + boothM[1] : ''].filter(Boolean).join('\n');
    return { template:'event', headline:title, sub: details || 'Details in the caption', quote:'', attr:'' };
  }
  const isQuote = /customer (said|wrote)|testimonial|review|feedback from/i.test(txt) && quoted;
  if (isQuote) return { template:'review', headline:'', sub:'', quote:'“' + quoted + '”', attr:'A McMillan customer' };
  if (quoted && quoted.length < 60) { const sgg = tp ? suggestText(tp) : { sub:'' }; return { template:'headline', headline:quoted, sub:sgg.sub || '', quote:'', attr:'' }; }
  if (tp) { const sgg = suggestText(tp); return { template:'headline', headline:sgg.headline, sub:sgg.sub, quote:'', attr:'' }; }
  return { template:'logo', headline:'', sub:'', quote:'', attr:'' };
}
function parseBrief(txt){
  const wordsAll = txt.split(/\s+/).filter(Boolean).length;
  const captionSignals = /https?:\/\/|read more|learn more|\bblog\b|join us|our team|link in bio|#\w+/i.test(txt);
  const firstPerson = /\b(they (fixed|rebuilt|repaired|delivered)|our (plant|line|program)|saved us|great to work with|recommend)\b/i.test(txt);
  if ((wordsAll > 28 && !firstPerson) || captionSignals) return analyzeCaption(txt);
  return parseLines(txt);
}
function parseLines(txt){
  const lines = txt.split('\n').map(l => l.trim()).filter(Boolean);
  const attr = lines.find(l => /^[—–-]\s*/.test(l));
  const body = lines.filter(l => l !== attr);
  const joined = body.join(' ');
  const words = joined.split(/\s+/).filter(Boolean).length;
  const quoted = /^[“"']/.test(joined) || /[”"']$/.test(joined);
  const eventish = /(\d{1,2}:\d{2}|\b\d{1,2}\s*(am|pm)\b|\b(mon|tues|wednes|thurs|fri|satur|sun)day\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}|\b\d{1,2}(st|nd|rd|th)\b|\brsvp\b|\bbooth\b)/i.test(body.slice(1).join(' '));
  const template = !lines.length ? 'logo' : (quoted || (words > 20 && !eventish)) ? 'review' : eventish ? 'event' : 'headline';
  return { template, headline: body[0] || '', sub: template === 'event' ? body.slice(1).join('\n') : body.slice(1).join(' '), quote: joined, attr: (attr || 'A McMillan customer').replace(/^[\u2014\u2013-]\s*/, '') };
}

// Background choice: generated art (always available) or a photo from the library when there is one.
// House rules from the Jul–Sep posts:
//  • green art ALWAYS carries a message (statement or headline) — never logo-only
//  • logo-only graphics are photos: usually a collage of event / application / team shots, sometimes one strong photo
//  • product cutouts sit on art with a headline above them
async function randomBackground(template, brief){
  const statement = brief && /^[A-Z][A-Z &]+:$/.test((brief.headline||'').trim());
  const photos = LIB.filter(p => p.kind !== 'product' && !photoMem.used[p.id] && p.id !== IMG.src?.id);
  const anyPhotos = LIB.filter(p => p.kind !== 'product');
  const pool = photos.length ? photos : anyPhotos;
  if (template === 'collage') {
    if (anyPhotos.length < 3) return 'none';
    const groups = ['event','application','team','shop'].filter(k => anyPhotos.filter(p => p.kind === k).length >= 3);
    await makeCollage(groups.length ? groups[Math.floor(Math.random()*groups.length)] : 'all');
    return 'collage';
  }
  if (template === 'logo') {
    if (!anyPhotos.length) return 'none';               // caller converts to a headline on art
    const prefer = pool.filter(p => ['event','application','team'].includes(p.kind));
    const from = prefer.length ? prefer : pool;
    const p = from[Math.floor(Math.random()*from.length)];
    IMG.bg = await libImage(p.url); IMG.src = Object.assign({ kind:'lib' }, p);
    S.bg.kind = 'photo'; S.bg.ox = S.bg.oy = 0; S.bg.zoom = 1; S.bg.cells = null;
    return 'photo';
  }
  const wantPhoto = pool.length && !statement && pick([['photo', 5], ['art', 4]], 'bgKind') === 'photo';
  if (wantPhoto) {
    const favs = pool.filter(p => photoMem.favs[p.id]);
    const from = favs.length >= 3 && Math.random() < 0.35 ? favs : pool;
    const p = from[Math.floor(Math.random()*from.length)];
    const im = await libImage(p.url);
    IMG.bg = im; IMG.src = Object.assign({ kind:'lib' }, p);
    S.bg.kind = 'photo'; S.bg.ox = S.bg.oy = 0; S.bg.zoom = 1; S.bg.cells = null;
    return 'photo';
  }
  S.bg.kind = 'art'; S.bg.cells = null;
  S.bg.art = pick([['texture', 3], ['gradient', 3], ['circuit', template === 'headline' ? 4 : 2], ['dark', 1]], 'art');
  S.bg.seed = Math.floor(Math.random()*100000) + 1;
  IMG.src = { kind:'art', art:S.bg.art, seed:S.bg.seed };
  return 'art';
}
async function maybeAddProduct(){
  const prods = LIB.filter(p => p.kind === 'product');
  const el = byId('product');
  const hl = byId('headline'); const statement = hl && /^[A-Z][A-Z &]+:$/.test(hl.text.trim());
  const roomBelow = (S.template === 'headline' || S.template === 'event') && (S.textPos === 'tc' || S.textPos === 'tl') && !statement;
  if (!prods.length || !roomBelow || S.bg.kind !== 'art' || S.frame !== 'none') { if (el) S.els = S.els.filter(e => e.id !== 'product'); return; }
  if (Math.random() < (S.bg.art === 'circuit' ? 0.7 : 0.35)) {
    const p = prods[Math.floor(Math.random()*prods.length)];
    const im = await libImage(p.url); addProduct(p, im);
  } else if (el) S.els = S.els.filter(e => e.id !== 'product');
}
function randomStyle(lum){
  const had = new Set(S.els.map(e => e.id));
  const onPhoto = S.bg.kind === 'photo';
  S.look = pick([['white', 7], ['bright', 2]], 'look');
  if (S.bg.kind === 'collage') { S.frame = 'none'; templateDefaults(); layout(); autoContrast(false); return; }
  // bands only make sense over a photo
  S.frame = onPhoto ? pick([['none', 5], ['top', 2], ['bottom', 1.5], ['wtop', 1.5], ['wbottom', 1.5]], 'frame') : 'none';
  if (S.template === 'headline') {
    const hl = byId('headline'); const statement = hl && /^[A-Z][A-Z &]+:$/.test(hl.text.trim());
    S.textPos = statement ? 'mid' : pick([['tc', 5], ['mid', 2], ['bc', 2], ['tl', 1]], 'textPos');
  }
  if (S.template === 'event') S.textPos = pick([['tc', 5], ['mid', 2]], 'textPos');
  templateDefaults(); layout();
  S.els = S.els.filter(e => had.has(e.id) || !['headline','sub','quote','attr','logo','box'].includes(e.id));
  const logo = byId('logo');
  if (logo && !S.frame.startsWith('w')) logo.shade = { style: onPhoto && Math.random() < 0.3 ? 'glow' : 'none', color:'#000000', alpha:0.35, size:0.4 };
  autoContrast(false);
}
async function loadPhotoRec(){ /* backgrounds are chosen in randomBackground */ }
let genBusy = false;
async function generate(){
  if (genBusy) return; genBusy = true;
  const btn = $('#genGo'); btn.disabled = true; $('#genStatus').textContent = 'Building…';
  try {
    let brief = parseBrief($('#genText').value);
    if (brief.template === 'logo' && !$('#genText').value.trim() && topic !== 'any') { const sgg = suggestText(topic); brief = { template:'headline', headline:sgg.headline, sub:sgg.sub, quote:'', attr:'' }; }
    const forced = document.querySelector('#genTpl button[aria-pressed="true"]').dataset.v;
    pushUndo();
    S.template = forced === 'auto' ? brief.template : forced;
    // seed the text elements first so layout() builds around the real words (a subline only exists if there is one)
    S.els = [];
    if (S.template === 'headline' || S.template === 'event') { S.els.push(text('headline', brief.headline || 'Proven before it ships.')); if (brief.sub) S.els.push(text('sub', brief.sub)); }
    if (S.template === 'review') { S.els.push(text('quote', brief.quote)); S.els.push(text('attr', brief.attr)); }
    layout();
    const bgKind = await randomBackground(S.template, brief);
    if ((S.template === 'logo' || S.template === 'collage') && bgKind === 'none') {
      // no photos to lean on: art needs words, so turn it into a headline card
      const sgg = suggestText(topic === 'any' ? 'quality' : topic);
      S.template = 'headline'; S.els = [text('headline', sgg.headline)]; if (sgg.sub) S.els.push(text('sub', sgg.sub));
      layout(); await randomBackground('headline', { headline: sgg.headline });
      toast('Green art always carries a message, so a headline was added');
    }
    randomStyle(measureLum());
    await maybeAddProduct();
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
  try { pushUndo(); if (S.bg.kind === 'collage') await makeCollage(S.bg.cells?.[0]?.kind || 'all'); else await randomBackground(S.template, { headline: byId('headline')?.text || '' }); templateDefaults(); layout(); autoContrast(false); await maybeAddProduct(); syncControls(); renderInspector(); renderResults(); fitCanvas(); }
  catch (err) { toast(err.message || String(err)); }
  finally { $('#loading').classList.remove('show'); genBusy = false; }
}
function shuffleLook(){
  pushUndo(); randomStyle(measureLum()); syncControls(); renderInspector(); render(); persist();
}
$('#genBtn').addEventListener('click', () => { $('#genStatus').textContent = ''; renderTopics(); $('#gen').hidden = false; setTimeout(() => $('#genText').focus(), 0); });
$('#suggestBtn').addEventListener('click', () => { const sgg = suggestText(topic); $('#genText').value = sgg.headline + (sgg.sub ? '\n' + sgg.sub : ''); $('#genStatus').textContent = 'Press Suggest again for another, or edit it, then Generate.'; });
$('#genCancel').addEventListener('click', () => { $('#gen').hidden = true; });
$('#genGo').addEventListener('click', generate);
$('#genText').addEventListener('keydown', e => { if ((e.metaKey||e.ctrlKey) && e.key === 'Enter') generate(); });
$('#genTpl').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; document.querySelectorAll('#genTpl button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
$('#shufPhoto').addEventListener('click', shufflePhoto);
$('#shufLook').addEventListener('click', shuffleLook);
$('#addProduct').addEventListener('click', async () => {
  const prods = LIB.filter(p => p.kind === 'product');
  if (!prods.length) { toast('No product images in the library yet'); return; }
  const cur = byId('product'); let next = prods[Math.floor(Math.random()*prods.length)];
  if (cur && prods.length > 1) { const i = prods.findIndex(p => p.url === cur.src); next = prods[(i + 1) % prods.length]; }
  pushUndo(); const im = await libImage(next.url); addProduct(next, im); S.sel = 'product'; renderInspector(); render();
});

