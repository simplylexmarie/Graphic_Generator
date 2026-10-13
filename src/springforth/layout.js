// The frame pieces S.wave asks for. Deleting one on the page clears it from S.wave, so it
// does not come straight back on the next layout.
function wantsWave(part){
  const w = S.wave || 'bottom';
  return w === 'both' || w === part;
}
function newWaveEl(part){
  const st = S.waveStyle || 'a';
  const m = (WAVE && WAVE.styles && WAVE.styles[st] && WAVE.styles[st].parts[part]) || { y: part === 'top' ? 0 : 0.8 };
  return { id:'wave-' + part, type:'wave', part, style:st, x:0, y:m.y*H(), w:W(), flip:false };
}

// The wave frame carries the site lockup itself — it is part of the exported artwork, so
// nothing here draws it. Every layout just has to keep its content clear of the frame:
// `waveCeiling` is how far the top wave hangs, `waveFloor` how high the bottom wave rises.

function layout(){
  const w = W(), h = H(), u = U();
  const els = [];
  const m = 0.075*w;
  const pos = S.textPos || 'tc';
  const onPhoto = S.bg.kind === 'photo';
  const handSize = 78*u;
  const stickers = (S.els || []).filter(e => e.type === 'sticker');
  // The frame pieces are elements, so a moved or resized one stays where it was put; only
  // the ones S.wave asks for and that aren't on the page yet get made.
  const frame = [];
  for (const part of ['top','bottom']) {
    if (!wantsWave(part)) continue;
    const had = (S.els || []).find(e => e.type === 'wave' && e.part === part);
    frame.push(had || newWaveEl(part));
  }
  FRAME = frame;                    // what waveCeiling/waveFloor measure against this pass
  const head = (waveCeiling(0.05, 0.95) + 0.045)*h;       // first line of type clears the top wave

  if (S.template === 'note') {
    // One card, sized to its words and optically centred in the space the frame leaves — the
    // master never leaves a paper page with a line of type and a hollow middle.
    const hl = byId('headline')?.text ?? 'Ownership';
    const hLines = hl.split('\n').reduce((n,l) => n + Math.max(1, Math.ceil(l.length/13)), 0);
    const textH = hLines * handSize * 1.22;
    const top = head, floor = (waveFloor(0.1, 0.9) - 0.028)*h;
    const nw = w*0.72;
    const tape = tapeDepth(S.noteFill, nw), pad = nw*0.055;   // writing starts clear of the tape
    const nh = Math.min(floor - top, Math.max(h*0.40, textH + tape + pad*2));
    const nx = (w - nw)/2, ny = top + (floor - top - nh)*0.5;
    els.push({ id:'note', type:'note', x:nx, y:ny, w:nw, h:nh, fill:S.noteFill || '#e5f4ee',
               tapeFill:S.tapeFill || TAPE_FILLS[0], rot:S.noteRot ?? -0.015, tape:true, kids:['headline'] });
    const ty = ny + tape + pad + Math.max(0, (nh - tape - pad*2 - textH)/2);
    els.push(text('headline', hl, { x:nx + nw*0.08, y:ty, w:nw*0.84, size:handSize,
      align:'center', lh:1.22, color:DARK_CARDS.includes(S.noteFill) ? '#ffffff' : DEEP, shadow:false }));
  }
  else if (S.template === 'list') {
    // their "Three questions …" / "Instead of … try:" format: a blue headline, then three
    // cards carrying a gold numeral, filling the page down to the wave.
    const hl = byId('headline')?.text ?? 'Three questions we encourage parents to ask';
    const hs = 66*u;
    const hLines = Math.max(1, Math.ceil(hl.length/24));
    els.push(text('headline', hl, { x:m, y:head, w:w-m*2, size:hs, align:'center', lh:1.18, color:DEEP, shadow:false }));
    const top = head + hLines*hs*1.18 + h*0.055;
    const floor = (waveFloor(0.06, 0.94) - 0.028)*h;
    const gap = w*0.032, nw = (w - m*2 - gap*2)/3;
    const nh = Math.max(h*0.19, Math.min(h*0.33, floor - top - h*0.02));
    const y0 = top + (floor - top - nh)*0.52;
    const defaults = ['“You worked hard on that.”','“You stuck with it, even when it was hard.”','“You tried a new strategy. That took courage.”'];
    for (let i=0;i<3;i++){
      const id = 'item-'+(i+1), nx = m + i*(nw+gap);
      const ny = y0 + (i===1 ? -h*0.020 : h*0.012);          // the middle card sits slightly proud
      els.push(text('num-'+(i+1), String(i+1), { x:nx, y:ny - 62*u, w:nw, size:58*u, align:'center', lh:1,
        color:GOLD, shadow:false }));
      els.push({ id:'note-'+(i+1), type:'note', x:nx, y:ny, w:nw, h:nh, fill:NOTE_FILLS[i%NOTE_FILLS.length][0],
                 rot:(i-1)*0.016, tape:false, kids:[id] });
      els.push(text(id, byId(id)?.text ?? defaults[i], { x:nx+nw*0.09, y:ny+nh*0.20, w:nw*0.82, size:29*u,
        align:'center', lh:1.30, font:'sans', color:DARK_CARDS.includes(NOTE_FILLS[i%NOTE_FILLS.length][0]) ? '#ffffff' : '#2f3a40', shadow:false }));
    }
  }
  else if (S.template === 'quote') {
    const q = byId('quote')?.text ?? '“It’s very hands on, student driven… I love that we allow them to fail early and cheaply.”';
    const a = byId('attr')?.text ?? 'A Spring Forth parent';
    // the card is cut to the length of the quote, with a couple of spare rules under it —
    // the master never pins up a notepad that trails off empty
    const floor = (waveFloor(0.06, 0.94) - 0.030)*h;
    const top = Math.max(h*0.105, head), nw = w*0.74, nx = (w - nw)/2, qs = 46*u;
    const probe = text('quote', q, { x:nx+nw*0.10, y:0, w:nw*0.80, size:qs, align:'left', lh:1.30, font:'sans', color:DEEP, shadow:false });
    const qh = bbox(ctx, probe).h;
    const nh = Math.max(h*0.34, Math.min(floor - top, qh + qs*2.9));
    const ny = top + (floor - top - nh)*0.46;          // pinned in the middle of the board
    els.push({ id:'note', type:'note', x:nx, y:ny, w:nw, h:nh, fill:'#fffdf6', rot:S.noteRot ?? 0.02,
               tape:false, lines:true, pin:'#02d594', kids:['quote','attr'] });
    probe.y = ny + nh*0.17;
    els.push(probe);
    els.push(text('attr', a, { x:nx+nw*0.10, y:ny + nh*0.17 + qh + qs*0.75, w:nw*0.80, size:26*u, align:'right', lh:1.2,
      font:'sans', color:'#6d7f88', shadow:false }));
  }
  else if (S.template === 'collage') {
    const hl = byId('headline')?.text ?? '';
    if (hl) els.push(text('headline', hl, { x:m, y:head, w:w-m*2, size:60*u, align:'center', lh:1.2, color:DEEP, shadow:false }));
  }
  // Collage photos are framed-photo elements, one per cell, so each can be dragged, resized,
  // zoomed and moved inside its frame. One already on the page keeps where it was put.
  const cellEls = [];
  if (S.template === 'collage' && S.bg.kind === 'collage' && S.bg.cells) {
    const boxes = collageCells(S.bg.grid || '2x2', w, h);
    S.bg.cells.forEach((c, i) => {
      const r = boxes[i]; if (!r || c.off) return;
      const had = (S.els || []).find(e => e.cell === i);
      if (had) { had.src = c.url; had.libId = c.id; cellEls.push(had); return; }
      cellEls.push({ id:'cell-' + i, type:'image', cell:i, src:c.url, libId:c.id, x:r[0], y:r[1], w:r[2], h:r[3],
                     style:c.style || 'tape', rot:c.rot || 0, seed:c.seed, zoom:1, px:0, py:0 });
    });
  }
  else if (S.template === 'logo') {
    // the frame's own lockup is the whole point of this one — nothing else goes on the page
  }
  else { // 'headline' and 'photo' — a headline always sits with a photo
    const hl = byId('headline')?.text ?? 'Learning By Doing';
    const sb = byId('sub')?.text ?? '';
    const tw = pos === 'tl' ? w*0.76 : w - m*2;
    const align = pos === 'tl' ? 'left' : 'center';
    const hLines = Math.max(1, Math.ceil(hl.length/18));
    const y0 = head;
    const col = onPhoto ? '#ffffff' : DEEP;
    els.push(text('headline', hl, { x:m, y:y0, w:tw, size:handSize, align, lh:1.22, color:col, shadow:onPhoto }));
    if (sb) els.push(text('sub', sb, { x:m, y:y0 + handSize*1.26*hLines, w:tw, size:34*u, align, lh:1.32,
      font:'sans', color:onPhoto ? '#ffffff' : '#6d7f88', shadow:onPhoto }));
  }

  // a framed photo belongs to the headline layout only — it never rides along under a card
  const ph = S.template === 'headline' ? byId('photo') : null; if (ph) els.unshift(ph);
  const notes = els.filter(e => e.type === 'note');           // notes render behind their own text
  for (const n of notes) { const i = els.indexOf(n); els.splice(i,1); els.unshift(n); }
  const p = els.findIndex(e => e.id === 'photo'); if (p > 0) els.unshift(els.splice(p,1)[0]);
  els.unshift(...cellEls);                                    // collage photos sit under the writing
  els.unshift(...frame);                                      // the frame sits under the content
  els.push(...stickers);                                      // stickers are placed by hand, and stay put
  S.els = els;
  S.sel = null;
  applyLook(false);
}

function templateDefaults(){
  S.bg.dim = S.bg.kind === 'photo' ? 0.18 : 0;
  if (S.template === 'quote') {
    S.bg.ground = 'cork';
  } else {
    if (S.bg.ground === 'cork') S.bg.ground = 'paper';
    if (S.waveWas != null) { S.wave = S.waveWas; S.waveWas = null; }
  }
}
