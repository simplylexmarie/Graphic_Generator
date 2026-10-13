#!/usr/bin/env python3
"""Derive McMillan's studio template from the shared engine (src/template-bakken-young.html).

McMillan differs from Bakken-Young in kind, not just colors: generated green-art backgrounds and an
image library replace stock-photo search; bands and a statement format replace the photo-tint look.
Those parts live in src/mcmillan/*.js and are spliced in here. The engine (canvas editor, drafts,
undo, export, inspector) is shared and untouched.

Run:  python3 src/make-mcmillan.py   → writes src/template-mcmillan.html   (then python3 src/build.py)
"""
import pathlib, re
ROOT = pathlib.Path(__file__).resolve().parent.parent
s = (ROOT / 'src/template-bakken-young.html').read_text()
blk = lambda name: (ROOT / 'src/mcmillan' / name).read_text()

def rep(a, b, n=1):
    global s
    assert s.count(a) == n, ('anchor', s.count(a), a[:90])
    s = s.replace(a, b)

def rep_between(start, end, new):
    global s
    i = s.index(start); j = s.index(end, i); s = s[:i] + new + s[j:]

# ================= identity / fonts / theme =================
rep("<title>Bakken-Young Graphics</title>", "<title>McMillan Graphics</title>")
rep('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&family=Nunito+Sans:wght@400;600;700&display=swap">',
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800;900&family=Open+Sans:wght@400;500;600;700&family=Nunito+Sans:wght@400;600;700&display=swap">')
s = s.replace('font:600 20px/1 "Cormorant Garamond",Georgia,serif;letter-spacing:.01em', 'font:800 17px/1 "Montserrat",sans-serif;letter-spacing:.02em;text-transform:uppercase')
s = s.replace('font:italic 700 15px "Cormorant Garamond",serif', 'font:800 12px "Montserrat",sans-serif')
s = s.replace('font:600 24px/1.1 "Cormorant Garamond",serif', 'font:800 20px/1.1 "Montserrat",sans-serif')
rep("const SERIF = '\"Cormorant Garamond\", Georgia, \"Times New Roman\", serif';",
    "const SERIF = '\"Montserrat\", \"Open Sans\", Arial, sans-serif';\nconst SANS = '\"Open Sans\", \"Montserrat\", Arial, sans-serif';")
rep('<select id="profileSel" class="profile" aria-label="Client"><option value="bakken-young">Bakken-Young</option></select>\n    <span>Social graphics</span>',
    '<select id="profileSel" class="profile" aria-label="Client"><option value="mcmillan">McMillan</option></select>\n    <span>Precision Electric Motors</span>')
s = s.replace("--accent:#19441f; --accent-ink:#ffffff; --accent-soft:#e3ece3;", "--accent:#006c40; --accent-ink:#ffffff; --accent-soft:#e1f1e8;")
s = s.replace("--focus:#19441f;", "--focus:#006c40;")
s = s.replace("--accent:#7fb58d; --accent-ink:#0f1a13; --accent-soft:#25352a;", "--accent:#00d66b; --accent-ink:#04261a; --accent-soft:#123d2b;")
s = s.replace("--focus:#7fb58d;", "--focus:#00d66b;")
s = s.replace("background:rgba(25,68,31,.75)", "background:rgba(0,108,64,.8)")
s = s.replace("background:linear-gradient(135deg,#19441f,#2f6b3a);color:#fff;border-color:#19441f", "background:linear-gradient(135deg,#006c40,#00a85a);color:#fff;border-color:#006c40")
s = s.replace("ctx.strokeStyle = '#19441f'; ctx.lineWidth = 1.5*k;", "ctx.strokeStyle = '#006c40'; ctx.lineWidth = 1.5*k;")
s = s.replace('fill="#592231" opacity=".85"/><rect x="14" y="4" width="16" height="4" rx="1" fill="#f0ad54"/>', 'fill="#034226" opacity=".9"/><rect x="14" y="4" width="16" height="4" rx="1" fill="#00d66b"/>')
s = s.replace('fill="#6b8f78"', 'fill="#046b3f"')

# ================= text: per-element font + tracking =================
rep("function fontStr(el, size){ return `${el.italic?'italic ':''}${el.weight} ${size||el.size}px ${SERIF}`; }",
    "function fontStr(el, size){ return `${el.italic?'italic ':''}${el.weight} ${size||el.size}px ${el.font === 'sans' ? SANS : SERIF}`; }")
rep("  return Object.assign({ id, type:'text', text:str, x:0, y:0, w:800, size:60, italic:false, weight:600, color:'#ffffff', align:'center', lh:1.12, shadow:true, upper:false, ls:0, shade:NO_SHADE() }, o);",
    "  return Object.assign({ id, type:'text', text:str, x:0, y:0, w:800, size:60, italic:false, weight:800, color:'#ffffff', align:'center', lh:1.12, shadow:true, upper:false, ls:0, font:'serif', shade:NO_SHADE() }, o);")
rep("function wrapLines(ctx, el){\n  ctx.font = fontStr(el);\n  if ('letterSpacing' in ctx) ctx.letterSpacing = (el.ls||0)+'px';",
    "function wrapLines(ctx, el){\n  ctx.font = fontStr(el);\n  if ('letterSpacing' in ctx) ctx.letterSpacing = ((el.ls||0)*el.size)+'px';")
rep("  ctx.font = fontStr(el);\n  if ('letterSpacing' in ctx) ctx.letterSpacing = (el.ls||0)+'px';\n  ctx.fillStyle = el.color; ctx.textBaseline = 'alphabetic'; ctx.textAlign = el.align;",
    "  ctx.font = fontStr(el);\n  if ('letterSpacing' in ctx) ctx.letterSpacing = ((el.ls||0)*el.size)+'px';\n  ctx.fillStyle = el.color; ctx.textBaseline = 'alphabetic'; ctx.textAlign = el.align;")

# ================= constants / state =================
rep("""const COLORS = [
  ['#ffffff','White'],['#19441f','Bakken green'],['#719587','Sage'],['#f0ad54','Gold'],['#592231','Plum'],['#1f1f1f','Charcoal'],['#f3e9d2','Cream']
];
const SHADE_COLORS = [['#000000','Black'],['#19441f','Bakken green'],['#592231','Plum'],['#719587','Sage'],['#f0ad54','Gold'],['#ffffff','White']];
const LS = { prefs:'by-prefs-v4', drafts:'by-drafts-v1', photos:'by-photos-v1' };""",
"""const COLORS = [
  ['#ffffff','White'],['#00d66b','Bright green'],['#006c40','McMillan green'],['#034226','Deep green'],['#586e63','Slate'],['#1f1f1f','Charcoal'],['#e9eeeb','Light gray']
];
const SHADE_COLORS = [['#000000','Black'],['#034226','Deep green'],['#006c40','McMillan green'],['#586e63','Slate'],['#ffffff','White']];
const LS = { prefs:'mcm-prefs-v2', drafts:'mcm-drafts-v1', photos:'mcm-photos-v1' };""")
rep("const LOGO_SRC = 'data:image/png;base64,__LOGO_B64__';", "const LOGO_SRC = 'data:image/png;base64,__LOGO_B64__';\nconst MARK_SRC = 'data:image/png;base64,__MARK_B64__';\nconst LOGOC_SRC = 'data:image/png;base64,__LOGOC_B64__';")
rep("const DEFAULT_QUERY = { logo:'sunlight through leaves', headline:'hands holding comfort', event:'person writing notebook', review:'forest canopy looking up' };\n", "")
rep("""const LOOKS = {
  classic: { label:'White on photo', accent:'#ffffff', text:'#ffffff', shadow:true,  dim:null, fade:null,   shade:{style:'none',color:'#000000',alpha:0.35}, swatch:['#3b4a3e','#fff'] },
  green:   { label:'Green on light', accent:'#19441f', text:'#19441f', shadow:false, dim:0,    fade:'none', shade:{style:'none',color:'#000000',alpha:0.3}, dark:true, swatch:['#e8e4d6','#19441f'] },
  gold:    { label:'Gold accent',    accent:'#f0ad54', text:'#ffffff', shadow:true,  dim:null, fade:null,   shade:{style:'none',color:'#000000',alpha:0.35}, swatch:['#3b4a3e','#f0ad54'] },
};""",
"""const LOOKS = {
  white:  { label:'White text',          accent:'#ffffff', text:'#ffffff', shadow:true,  dim:null, fade:null, swatch:['#046b3f','#fff'] },
  bright: { label:'Bright green title',  accent:'#00d66b', text:'#ffffff', shadow:true,  dim:null, fade:null, swatch:['#06301c','#00d66b'] },
};""")
rep("let S = { template:'headline', size:'square', textPos:'tc', look:'classic',\n          bg:{zoom:1, ox:0, oy:0, dim:0.35, fadePos:'none', fade:0.45, fadeSize:0.55, fadeColor:'#000000'}, els:[], sel:null };",
    "let S = { template:'headline', size:'square', textPos:'tc', look:'white', frame:'none', bandColor:'#034226',\n          bg:{kind:'art', art:'gradient', seed:7, zoom:1, ox:0, oy:0, dim:0, fadePos:'none', fade:0.45, fadeSize:0.5, fadeColor:'#000000'}, els:[], sel:null };")
rep("const BUILT_IN_KEY = 'dMBOWE33ohoJ8Weu0lSEIQhWNDpSnHnC3n9Vkhs3l7I4cfYOKDJgZ7Tf';\nlet page = 1, lastQuery = '', results = [], apiKey = BUILT_IN_KEY, tab = 'search';",
    "let page = 1, lastQuery = '', results = [];")
rep("const IMG = { bg:null, logo:null, src:null }; // src: {kind:'pexels',id,url,tiny,photographer,alt} | {kind:'own',data}",
    "const IMG = { bg:null, logo:null, mark:null, logoColor:null, src:null, lib:{} }; // src: {kind:'lib',id,url,...} | {kind:'own',data} | {kind:'art',art,seed}")
rep("function logoAspect(){ return IMG.logo ? IMG.logo.naturalHeight / IMG.logo.naturalWidth : 0.286; }",
    "function logoImg(el){ const v = (el && el.variant) || 'full'; return v === 'mark' ? IMG.mark : v === 'color' ? IMG.logoColor : IMG.logo; }\nfunction logoAspect(el){ const im = logoImg(el); return im ? im.naturalHeight / im.naturalWidth : ((el && el.variant) === 'mark' ? 0.58 : 0.21); }")
rep("if (el.type === 'logo') return { x:el.x, y:el.y, w:el.w, h:el.w*logoAspect() };", "if (el.type === 'logo') return { x:el.x, y:el.y, w:el.w, h:el.w*logoAspect(el) };\n  if (el.type === 'image') return { x:el.x, y:el.y, w:el.w, h:el.w*imageAspect(el) };")
rep("function drawLogo(ctx, el){\n  const h = el.w * logoAspect();", "function drawLogo(ctx, el){\n  const h = el.w * logoAspect(el);")
rep("  if (IMG.logo) ctx.drawImage(IMG.logo, el.x, el.y, el.w, h);", "  const im = logoImg(el);\n  if (im) ctx.drawImage(im, el.x, el.y, el.w, h);")
rep("function logoEl(o){ const L = LOOKS[S.look]; return Object.assign({ id:'logo', type:'logo', shadow:true, shade:{style:L.shade.style, color:L.shade.color, alpha:L.shade.alpha, size:0.5} }, o); }",
    "function logoEl(o){ return Object.assign({ id:'logo', type:'logo', variant:'full', shadow:false, shade:NO_SHADE() }, o); }")

# ================= backgrounds, frames, image elements =================
rep_between("function drawBokeh(w, h){", "// Soft feathered rectangle", blk('backgrounds.js'))
rep("    else if (el.type === 'logo') drawLogo(ctx, el);\n  }\n  if (!forExport && S.sel) {",
    "    else if (el.type === 'logo') drawLogo(ctx, el);\n    else if (el.type === 'image') drawImageEl(ctx, el);\n  }\n  if (!forExport && S.sel) {")
rep("    else if (el.type === 'logo') el.w = drag.w0*f;\n    else { el.w = drag.w0*f; el.h = drag.h0*f; }",
    "    else if (el.type === 'logo' || el.type === 'image') el.w = drag.w0*f;\n    else { el.w = drag.w0*f; el.h = drag.h0*f; }")

# ================= layout + look =================
rep_between("function layout(){", "// Apply the current look's colors", blk('layout.js'))
rep_between("// Apply the current look's colors", "// ---------- text measuring ----------",
"""// Apply the look: white or bright-green title. Text inside a white band or the quote box is left alone.
function applyLook(withPhoto){
  const L = LOOKS[S.look];
  const fr = frameRect(W(), H());
  for (const el of S.els) {
    if (el.type !== 'text') continue;
    if (el.id === 'quote' || el.id === 'attr') continue;
    if (fr && fr.white) continue;
    el.color = el.id === 'headline' ? L.accent : L.text;
    if (S.bg.kind === 'photo' && !fr) el.shadow = L.shadow;
  }
  if (withPhoto) { templateDefaults(); if (IMG.bg && S.bg.kind === 'photo') autoContrast(false); }
}

""")
rep("function autoContrast(announce){\n  if (!IMG.bg) return;", "function autoContrast(announce){\n  if (S.bg.kind !== 'photo' || !IMG.bg) { S.bg.dim = 0; syncControls(); render(); return; }")
rep("    S.bg.dim = Math.round(Math.min(0.5, Math.max(0.2, 0.15 + lum * 0.5)) * 100) / 100;", "    S.bg.dim = Math.round(Math.min(0.45, Math.max(0.1, 0.05 + lum * 0.5)) * 100) / 100;")

# ================= HTML: template controls, background section, toolbar =================
rep("""          <button data-v="tc" aria-pressed="true">Top</button>
          <button data-v="tl" aria-pressed="false">Top left</button>
          <button data-v="tr" aria-pressed="false">Top right</button>
          <button data-v="mid" aria-pressed="false">Middle</button>
        </div></div>""",
"""          <button data-v="tc" aria-pressed="true">Top</button>
          <button data-v="mid" aria-pressed="false">Middle</button>
          <button data-v="bc" aria-pressed="false">Bottom</button>
          <button data-v="tl" aria-pressed="false">Top left</button>
        </div></div>
      <div class="row" id="frameRow"><label>Band</label>
        <div class="seg" id="frameSeg">
          <button data-v="none" aria-pressed="true">None</button>
          <button data-v="top" aria-pressed="false">Green top</button>
          <button data-v="bottom" aria-pressed="false">Green btm</button>
          <button data-v="wtop" aria-pressed="false">White top</button>
          <button data-v="wbottom" aria-pressed="false">White btm</button>
        </div></div>""")
i = s.index('    <div class="sec">\n      <h2>Background photo'); j = s.index('    <div class="sec">\n      <h2>Photo adjustments')
s = s[:i] + """    <div class="sec">
      <h2>Background</h2>
      <div class="subh" style="margin-top:0">Green art</div>
      <div class="chips" id="artChips"></div>
      <div class="subh">McMillan images</div>
      <div class="tabs" id="tabs" style="margin-top:0">
        <button data-tab="lib" aria-selected="true">Library</button>
        <button data-tab="favs" aria-selected="false">Favorites</button>
        <button data-tab="recent" aria-selected="false">Recently used</button>
      </div>
      <div class="chips" id="kindChips" style="margin-top:8px"></div>
      <div class="results" id="results"></div>
      <div class="results-status" id="rstatus"></div>
      <div class="row" style="margin-top:10px">
        <input type="file" id="bgFile" accept="image/*" hidden>
        <button class="btn sm" id="bgBtn">Upload a photo…</button>
        <button class="btn sm" id="collageBtn" title="3–4 library photos in a grid with the logo on a white plate">⊞ Collage</button>
      </div>
      <p class="hint" style="margin-top:6px">Click a library image to use it as the background; product shots are placed on top of the green art. You can also drag a photo onto the canvas or paste one (⌘V).</p>
    </div>

""" + s[j:]
rep('<button class="btn sm" id="shufPhoto" title="Keep the layout, try a different photo">Shuffle photo</button>', '<button class="btn sm" id="shufPhoto" title="Keep the text, try a different background">Shuffle background</button>')
rep('<button class="btn sm" id="addText">+ Add text</button>', '<button class="btn sm" id="collageQuick" title="Generate a photo collage with the logo plate">\u229e Collage</button>\n      <button class="btn sm" id="addProduct" title="Place a product shot from the library on the graphic">+ Product</button>\n      <button class="btn sm" id="addText">+ Add text</button>')
rep('<h2>Photo adjustments <button class="btn link" id="autoBtn" title="Set Darken and Fade based on how bright the photo is behind the logo and text">Auto-adjust</button></h2>',
    '<h2>Photo adjustments <button class="btn link" id="autoBtn" title="Set Darken based on how bright the photo is behind the logo and text">Auto-adjust</button></h2>\n      <p class="hint" id="adjHint" hidden>These apply when a photo is the background.</p>')
rep("""        <button data-v="headline" aria-pressed="false">Headline</button>
        <button data-v="event" aria-pressed="false">Event</button>
        <button data-v="review" aria-pressed="false">Review</button>""",
"""        <button data-v="headline" aria-pressed="false">Headline</button>
        <button data-v="event" aria-pressed="false">Event</button>
        <button data-v="collage" aria-pressed="false">Collage</button>
        <button data-v="review" aria-pressed="false">Quote</button>""")
# template tiles: add Collage
rep("""        <button class="tile" data-t="review" aria-pressed="false">""",
"""        <button class="tile" data-t="collage" aria-pressed="false">
          <svg viewBox="0 0 44 44"><rect x="2" y="2" width="40" height="40" rx="4" fill="#046b3f"/><rect x="5" y="5" width="16" height="16" fill="#8fb3a0"/><rect x="23" y="5" width="16" height="16" fill="#6f9a86"/><rect x="5" y="23" width="16" height="16" fill="#6f9a86"/><rect x="23" y="23" width="16" height="16" fill="#8fb3a0"/><rect x="13" y="18" width="18" height="8" rx="1" fill="#fff"/></svg>Collage</button>
        <button class="tile" data-t="review" aria-pressed="false">""")
rep(".tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}", ".tiles{display:grid;grid-template-columns:repeat(5,1fr);gap:5px}")
rep(".tile svg{width:38px;height:38px;display:block}", ".tile svg{width:34px;height:34px;display:block}")
rep(".tile{border:1px solid var(--line-strong);border-radius:8px;background:var(--panel-2);padding:8px 6px;", ".tile{border:1px solid var(--line-strong);border-radius:8px;background:var(--panel-2);padding:7px 3px;")
rep('<p>Type what it should say. The first line is the headline, the next line the subline. Add a date or time and it becomes an event. Paste a client\'s quote for a review. Leave it blank for logo only. Keep pressing Generate until you like one, then tweak.</p>',
    '<p>Type the headline (first line) and an optional subline. A value like <b>INTEGRITY:</b> plus its explanation becomes a statement card. Add a date or time for an event. Leave it blank for logo only. Keep pressing Generate until you like one, then tweak.</p>')
rep('placeholder="Pre-Planning&#10;a simple process&#10;&#10;…or paste the whole caption here"', 'placeholder="QUALITY:&#10;Investing in people, systems, and testing so motors do their job quietly for years.&#10;&#10;…or paste the whole caption here"')

rep('<div class="kicker">Bakken-Young studio</div>', '<div class="kicker">McMillan studio</div>')
rep('.welcome-card h2{margin:0 0 10px;font:600 40px/1.05 "Cormorant Garamond",Georgia,serif;color:var(--ink)}', '.welcome-card h2{margin:0 0 10px;font:800 34px/1.05 "Montserrat",sans-serif;color:var(--ink)}')
s = s.replace("rgba(25,68,31,.55)", "rgba(0,214,107,.55)").replace("rgba(25,68,31,0)", "rgba(0,214,107,0)")
rep("['#tiles','#results','#drafts','#genBtn','#shufPhoto','#shufLook','#addText','#bgBtn','#importBtn','#looks']", "['#tiles','#results','#drafts','#genBtn','#shufPhoto','#shufLook','#addText','#bgBtn','#importBtn','#looks','#artChips','#collageBtn','#collageQuick','#addProduct']")

# ================= controls / sync =================
rep("$('#textPos').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; pushUndo(); S.textPos = b.dataset.v; templateDefaults(); layout(); syncControls(); renderInspector(); render(); persist(); });",
    "$('#textPos').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; pushUndo(); S.textPos = b.dataset.v; templateDefaults(); layout(); syncControls(); renderInspector(); render(); persist(); });\n$('#frameSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; pushUndo(); S.frame = b.dataset.v; templateDefaults(); layout(); syncControls(); renderInspector(); render(); persist(); });")
rep("  $('#textPosRow').style.display = (S.template === 'headline' || S.template === 'event') ? '' : 'none';",
    "  $('#textPosRow').style.display = (S.template === 'headline' || S.template === 'event') && (S.frame||'none') === 'none' ? '' : 'none';\n  document.querySelectorAll('#frameSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === (S.frame||'none'))));\n  renderArtChips();\n  const isPhoto = S.bg.kind === 'photo';\n  ['dim','zoom','fade','fadeSize'].forEach(id => { const n = document.getElementById(id); if (n) n.closest('.row').style.opacity = isPhoto ? '' : '.4'; });\n  $('#adjHint').hidden = isPhoto;")
rep("function setTemplate(t){\n  pushUndo(); S.template = t; templateDefaults(); layout(); if (IMG.bg && !LOOKS[S.look].dark) autoContrast(false);\n  syncControls(); renderInspector(); render();\n  if (apiKey) { $('#q').value = DEFAULT_QUERY[t]; search(true); }\n}",
    """async function setTemplate(t){
  pushUndo(); S.template = t;
  // house rule: logo-only lives on photos, never on plain green art
  if (t === 'collage') { if (await randomBackground('collage', {}) === 'none') { toast('A collage needs at least 3 library photos'); S.template = 'logo'; } }
  else if (S.bg.kind === 'collage') { S.bg.kind = 'art'; S.bg.cells = null; }
  if (t === 'logo' && S.bg.kind === 'art') {
    const r = await randomBackground('logo', {});
    if (r === 'none') toast('Logo-only graphics use a photo. The library is empty, so upload one below.');
  }
  templateDefaults(); layout(); if (IMG.bg && S.bg.kind === 'photo') autoContrast(false);
  syncControls(); renderInspector(); renderResults(); render();
}""")
rep("function snapshot(){ return JSON.stringify({ template:S.template, size:S.size, textPos:S.textPos, look:S.look, bg:S.bg, els:S.els }); }",
    "function snapshot(){ return JSON.stringify({ template:S.template, size:S.size, textPos:S.textPos, look:S.look, frame:S.frame, bandColor:S.bandColor, bg:S.bg, els:S.els }); }")
rep("state: { template:S.template, size:S.size, textPos:S.textPos, look:S.look, bg:clone(S.bg), els:clone(S.els) }",
    "state: { template:S.template, size:S.size, textPos:S.textPos, look:S.look, frame:S.frame, bandColor:S.bandColor, bg:clone(S.bg), els:clone(S.els) }")
rep("  if (['tc','tl','tr','mid'].includes(o.textPos)) S.textPos = o.textPos;", "  if (['tc','tl','bc','mid'].includes(o.textPos)) S.textPos = o.textPos;")
rep("  if (typeof o.apiKey === 'string' && o.apiKey) apiKey = o.apiKey;\n", "")
rep("JSON.stringify({ template:S.template, size:S.size, textPos:S.textPos, look:S.look, apiKey })", "JSON.stringify({ template:S.template, size:S.size, textPos:S.textPos, look:S.look })")
rep_between("// A setup link (", "// ---------- export ----------", "")

# ================= inspector: logo variants, image element =================
rep("    box.append(h('p',{class:'hint',style:'margin-bottom:8px'}, 'Bakken-Young logo'));",
    "    box.append(row('Logo', seg([['full','White'],['color','Color'],['mark','M mark']], ()=>el.variant||'full', v=>el.variant=v)));")
rep("  else if (el.type === 'box') {\n    box.append(h('div',{class:'field'}, h('label',{},'Label'),",
    "  else if (el.type === 'image') {\n    box.append(h('p',{class:'hint',style:'margin-bottom:8px'}, 'Product image from the McMillan library. Drag to move, corners to resize.'));\n    box.append(row('Width', h('input',{type:'range',id:'insp-width',min:Math.round(W()*0.1),max:W(),value:Math.round(el.w),oninput:change(e=>{guard();el.w=+e.target.value;})})));\n    box.append(chk('Drop shadow', ()=>el.shadow!==false, v=>el.shadow=v));\n  }\n  else if (el.type === 'box') {\n    box.append(h('div',{class:'field'}, h('label',{},'Label'),")
rep("    box.append(chk('ALL CAPS', ()=>el.upper, v=>el.upper=v));\n    if (el.align === 'center')",
    "    box.append(chk('ALL CAPS', ()=>el.upper, v=>el.upper=v));\n    box.append(row('Font', seg([['serif','Bold (Montserrat)'],['sans','Regular (Open Sans)']], ()=>el.font||'serif', v=>el.font=v)));\n    box.append(row('Tracking', h('input',{type:'range',min:0,max:30,value:Math.round((el.ls||0)*100),oninput:change(e=>{guard();el.ls=e.target.value/100;})})));\n    if (el.align === 'center')")
rep("rules:!!src.rules, shade:clone(src.shade || NO_SHADE()) });", "rules:!!src.rules, font:src.font, ls:src.ls, shade:clone(src.shade || NO_SHADE()) });")
rep("    else if (el.type === 'logo') Object.assign(el, { shadow:src.shadow, shade:clone(src.shade) });", "    else if (el.type === 'logo') Object.assign(el, { shadow:src.shadow, variant:src.variant, shade:clone(src.shade) });")
rep("      for (const ex of extras) S.els.push(Object.assign(clone(ex), { x: ex.x/w0*w, y: ex.y/h0*hh, w: ex.w/w0*w, size: ex.size*Math.min(w/w0, hh/h0) }));",
    "      for (const ex of extras) S.els.push(Object.assign(clone(ex), { x: ex.x/w0*w, y: ex.y/h0*hh, w: ex.w/w0*w, size: ex.size*Math.min(w/w0, hh/h0) }));\n      const pr = byId('product'), pr0 = fromEls.find(e => e.id === 'product'); if (pr && pr0) { pr.w = pr0.w/w0*w; pr.x = pr0.x/w0*w; pr.y = pr0.y/h0*hh; }")
rep("      if (IMG.bg && !LOOKS[S.look].dark) autoContrast(false);\n      const blob = await renderBlob();", "      if (IMG.bg && S.bg.kind === 'photo') autoContrast(false);\n      const blob = await renderBlob();")

# ================= photo memory + screening + search → library =================
rep_between("// ---------- photo memory (favorites + recently used) ----------", "// ---------- own photo ----------", blk('library.js') + "\n")
rep("    IMG.bg = img; IMG.src = { kind:'own', data: shrinkForStorage(img) };\n    S.bg.ox = S.bg.oy = 0; S.bg.zoom = 1; $('#zoom').value = 100;\n    autoContrast(false); fitCanvas(); toast('Photo added');",
    "    IMG.bg = img; IMG.src = { kind:'own', data: shrinkForStorage(img) };\n    S.bg.kind = 'photo'; S.bg.ox = S.bg.oy = 0; S.bg.zoom = 1; $('#zoom').value = 100;\n    templateDefaults(); layout(); autoContrast(false); syncControls(); renderInspector(); fitCanvas(); toast('Photo added');")
rep("""  IMG.bg = null; IMG.src = null;
  if (d.photo) {
    $('#loading').classList.add('show');
    try {
      const img = new Image();
      if (d.photo.kind === 'pexels') img.crossOrigin = 'anonymous';
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = d.photo.kind === 'pexels' ? d.photo.url : d.photo.data; });
      IMG.bg = img; IMG.src = clone(d.photo);
    } catch { toast('The photo for this draft couldn’t be loaded'); }
    finally { $('#loading').classList.remove('show'); }
  }""",
"""  IMG.bg = null; IMG.src = null;
  $('#loading').classList.add('show');
  try {
    if (d.photo && d.photo.kind === 'lib') { IMG.bg = await libImage(d.photo.url); IMG.src = clone(d.photo); }
    else if (d.photo && d.photo.kind === 'own') { const img = new Image(); await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = d.photo.data; }); IMG.bg = img; IMG.src = clone(d.photo); }
    else if (d.photo) IMG.src = clone(d.photo);
    const pr = byId('product'); if (pr) await libImage(pr.src);
    if (S.bg.kind === 'collage' && S.bg.cells) await Promise.all(S.bg.cells.map(c => libImage(c.url).catch(() => null)));
  } catch { toast('An image for this draft couldn’t be loaded'); }
  finally { $('#loading').classList.remove('show'); }""")
rep("  return `bakken-young-${slug}-${w}x${hh}.png`;", "  return `mcmillan-${slug}-${w}x${hh}.png`;")
rep("  if (['logo','headline','event','review'].includes(o.template)) S.template = o.template;", "  if (['logo','headline','event','review','collage'].includes(o.template)) S.template = o.template;")
rep("  return 'Logo only';\n}", "  return S.template === 'collage' ? 'Collage' : 'Logo only';\n}")
rep(": S.template === 'review' ? 'featured-review' : 'logo';", ": S.template === 'review' ? 'quote' : S.template === 'collage' ? 'collage' : 'logo';")

# ================= generator =================
rep_between("// ---------- Generate (randomizer) ----------", "// ---------- misc ----------", blk('generate.js'))

# ================= fonts / boot =================
rep("  try { await Promise.all(['italic 600 40px','600 40px','700 40px','500 40px','400 40px','italic 500 40px','italic 700 40px'].map(f => document.fonts.load(`${f} \"Cormorant Garamond\"`))); } catch {}",
    "  try { await Promise.all([...['600 40px','700 40px','800 40px','900 40px'].map(f => document.fonts.load(`${f} \"Montserrat\"`)), ...['400 40px','500 40px','600 40px','700 40px'].map(f => document.fonts.load(`${f} \"Open Sans\"`))]); } catch {}")
rep("""  restore(); loadPhotoMem();
  const fromLink = keyFromLink();
  await new Promise(res => { const im = new Image(); im.onload = () => { IMG.logo = im; res(); }; im.onerror = res; im.src = LOGO_SRC; });
  renderLooks(); templateDefaults(); layout(); syncControls(); fitCanvas(); renderDrafts();
  $('#apiKey').value = apiKey; $('#q').value = DEFAULT_QUERY[S.template]; search(true);""",
"""  restore(); loadPhotoMem();
  await Promise.all([[LOGO_SRC,'logo'],[MARK_SRC,'mark'],[LOGOC_SRC,'logoColor']].map(([srcUrl, key]) => new Promise(res => { const im = new Image(); im.onload = () => { IMG[key] = im; res(); }; im.onerror = res; im.src = srcUrl; })));
  IMG.src = { kind:'art', art:S.bg.art, seed:S.bg.seed };
  renderLooks(); templateDefaults(); layout(); syncControls(); fitCanvas(); renderDrafts();
  loadLibrary();""")

rep("(IMG.src?.kind === 'pexels' ? ` · Photo: ${IMG.src.photographer} / Pexels` : '')", "(S.bg.kind === 'collage' ? ' · Collage' : S.bg.kind === 'photo' && IMG.src?.kind === 'lib' ? ` · ${IMG.src.file}` : S.bg.kind === 'art' ? ` · ${ART[S.bg.art] || 'Green art'}` : '')")
for bad in ['Bakken', 'funeral', 'Funeral', 'cremat', 'by-prefs', 'by-drafts', 'by-photos', 'by-learn', 'Cormorant', 'Pre-Planning', 'apiKey', 'fetchPhotos', 'BLOCK_WORDS', 'keyFromLink', 'DEFAULT_QUERY', 'Cinzel', 'pexels']:
    assert bad not in s, ('leftover', bad, [s[max(0,m.start()-60):m.start()+40] for m in re.finditer(re.escape(bad), s)][:2])
(ROOT / 'src/template-mcmillan.html').write_text(s)
print('template-mcmillan.html written')
