// ---------- client editing (opened from a review link) ----------
// The review page can open a post's graphic here for the client to adjust: edit the headline,
// drag and resize things, zoom or reposition the photo. Everything else in the studio is hidden.
// The page is served through /review/studio/… (see app/functions/review/studio), which only works
// with that month's review link, and "Save my changes" goes back through the review API.
const CLIENT_EDIT = (() => {
  if (!/^\/review\/studio\//.test(location.pathname)) return null;
  const q = new URLSearchParams(location.search);
  return { t: q.get('t'), post: q.get('post') };
})();
if (CLIENT_EDIT) document.documentElement.classList.add('client-edit');

async function clientEditStart(){
  const bar = h('div',{class:'client-bar'},
    h('div',{class:'client-bar-text'}, h('b',{}, 'Edit this graphic'),
      h('span',{}, 'Click the headline or any piece to change it. Drag to move, use the corners to resize, scroll or pinch to zoom the photo.')),
    h('button',{class:'btn sm', onclick: () => clientBack()}, 'Cancel'),
    h('button',{class:'btn primary', id:'clientSave', onclick: clientSaveEdit}, 'Save my changes'));
  document.body.prepend(bar);
  hideWelcome();
  $('#loading').classList.add('show');
  try {
    const j = await (await fetch('/api/review/design?t=' + encodeURIComponent(CLIENT_EDIT.t) + '&post=' + encodeURIComponent(CLIENT_EDIT.post))).json();
    if (!j.ok) throw new Error(j.error || 'This graphic can’t be edited');
    const d = j.design;
    Object.assign(S, clone(d.state)); S.sel = null;
    IMG.bg = null; IMG.src = d.src ? clone(d.src) : null;
    const load = url => (typeof libImage === 'function' ? libImage(url) : new Promise((res, rej) => {
      const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = rej; im.src = url; }));
    if (d.src && d.src.url) IMG.bg = await load(d.src.url);
    await Promise.all(S.els.filter(e => e.type === 'image').map(e => load(e.src).catch(() => null)));
    if (S.bg.cells) await Promise.all(S.bg.cells.map(c => load(c.url).catch(() => null)));
    document.title = 'Edit graphic: ' + j.label;
  } catch (err) {
    bar.querySelector('.client-bar-text span').textContent = err.message;
    $('#clientSave').disabled = true;
  } finally { $('#loading').classList.remove('show'); }
  // the first headline is selected so its text box is right there in the panel
  S.sel = (byId('headline') || {}).id || null;
  syncControls(); renderInspector(); renderQuickFields(); fitCanvas();
}

function clientBack(opened){
  location.href = '/review/?t=' + encodeURIComponent(CLIENT_EDIT.t) + (opened ? '&open=' + encodeURIComponent(CLIENT_EDIT.post) : '');
}

async function clientSaveEdit(){
  const btn = $('#clientSave'); btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await fontsReady();
    S.sel = null;
    const png = await blobToBase64(await renderBlob());
    const src = IMG.src && IMG.src.kind !== 'own' ? clone(IMG.src) : null;
    let name = ''; try { name = localStorage.getItem('review-name') || ''; } catch {}
    const r = await fetch('/api/review/graphic', { method:'POST', headers:{ 'content-type':'application/json' },
      body: JSON.stringify({ t: CLIENT_EDIT.t, postId: CLIENT_EDIT.post, png, name, design: { state: JSON.parse(snapshot()), src } }) });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'Couldn’t save');
    clientBack(true);
  } catch (err) { toast('Couldn’t save: ' + err.message); btn.disabled = false; btn.textContent = 'Save my changes'; }
}

// wait for the studio's own start-up to finish, so it can't paint over the client's graphic
if (CLIENT_EDIT) { if (window.__studioReady) clientEditStart(); else window.addEventListener('studio-ready', clientEditStart, { once:true }); }
