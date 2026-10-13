// ---------- Generate from the calendar (shared) ----------
// The calendar post decides the graphic. The studio's adapter supplies the ideas
// (STUDIO.specsFor) and builds each one on the canvas (STUDIO.buildOption); this module runs
// the three-option view and the button. A studio without an adapter gets the calendar but
// not the generate buttons.

// Spread the studio's frames (borders) across a set so no two options share one.
function frameOrder(){
  return (STUDIO.frames || []).map(f => ({ f, k: Math.pow(Math.random(), 1/(f.weight || 1)) })).sort((a,b) => b.k - a.k).map(x => x.f);
}
function assignFrames(specs){
  // weighted shuffle, then hand them out in order to the options that don't have one yet
  const order = frameOrder(); if (!order.length) return;
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
    const specs = STUDIO.specsFor(p, CTX.offered);
    assignFrames(specs.slice(0, 3));
    CTX.options = [];
    for (const o of specs.slice(0, 3)) {
      const built = await STUDIO.buildOption(o);
      built.photos.forEach(id => CTX.offered.add(id));
      CTX.options.push(built);
    }
    currentDraftId = null;
    applyOption(0, false);
    renderOptions();
    renderCalendar();
    toast('Three options for ' + DAY_ABBR[p.date.getDay()] + ' ' + (p.date.getMonth()+1) + '/' + p.date.getDate() + '. Pick one under Options for this post.');
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
  if (!calCfg() || !STUDIO.specsFor) { b.hidden = true; return; }
  b.hidden = false;
  const p = calTarget();
  // options made for one post shouldn't linger once another post is picked
  if (CTX.options.length && (!p || p.iso !== CTX.iso)) { CTX.options = []; CTX.on = -1; renderOptions(); }
  b.disabled = !p || genBusy;
  b.textContent = 'Generate from calendar' + (p ? ' \u00b7 ' + DAY_ABBR[p.date.getDay()] + ' ' + (p.date.getMonth()+1) + '/' + p.date.getDate() : '');
  b.title = p ? 'Build three graphics matched to this post: ' + (p.bucket || 'post') + ': ' + (p.noHead ? 'photo only' : p.hook || 'no hook text yet') : 'Pick a post in the calendar first';
}

$('#calGen').addEventListener('click', generateFromPost);
$('#optsMore').addEventListener('click', generateFromPost);
$('#optsClose').addEventListener('click', () => { CTX.options = []; CTX.on = -1; renderOptions(); });


// With a calendar, the plain generator becomes the "Random" one beside it.
window.addEventListener('load', () => {
  if (!calCfg()) return;
  const g = $('#genBtn'); if (!g || !STUDIO.specsFor) return;
  g.classList.remove('gen'); g.textContent = 'Random';
  g.title = 'Build a graphic from your own text with a random photo, look and layout, not tied to the calendar';
});
