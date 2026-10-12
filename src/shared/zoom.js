// ---------- zooming photos (shared) ----------
// Scroll (or trackpad-pinch) over a framed or collage photo to zoom it inside its frame, or
// over a full-page photo to zoom the background. One undo step per gesture.
// a full-page photo: Bakken-Young's background is always one, the others say so in S.bg.kind
function bgIsPhoto(){ return !!IMG.bg && (!S.bg.kind || S.bg.kind === 'photo'); }
var cropMode = null;                 // id of the framed photo whose drag pans inside its frame
let wheelUndoAt = 0;
cv.addEventListener('wheel', e => {
  const [x, y] = toDesign(e);
  const el = hitEl(x, y);
  const photo = el && el.type === 'image' && typeof cropRoom === 'function' ? el : null;
  // over text or the logo, the background photo is what zooms
  if (!photo && !bgIsPhoto()) return;
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
  if (!el || el.type !== 'image' || typeof cropRoom !== 'function') return;
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
  const target = el && el.type === 'image' && typeof cropRoom === 'function' ? el : (bgIsPhoto() ? 'bg' : null);
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
