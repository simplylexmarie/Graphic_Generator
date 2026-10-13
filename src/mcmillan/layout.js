function layout(){
  const w = W(), h = H(), u = U();
  const wide = w > h;
  const els = [];
  const fr = frameRect(w, h);
  const onArt = S.bg.kind !== 'photo';
  // House rules (July–Sept 2026 posts): bold sans headline, sentence case; logo wordmark bottom-center;
  // text either top-center, dead-center (statements), or bottom-center with the logo up top.
  const logoW = wide ? 0.28*w : 0.36*w;
  const logoH = logoW * 0.21;
  const m = 0.07*w;
  const pos = S.textPos || 'tc';
  const whiteBand = fr && fr.white;
  const textColor = whiteBand ? '#034226' : '#ffffff';
  const logoVariant = whiteBand ? 'color' : 'full';
  const logoAt = (cx, y, v) => logoEl({ x: cx - logoW/2, y, w: logoW, variant: v || 'full' });

  if (S.template === 'collage') {
    // colour logo on a small white plate over the gutters, like their collage posts
    const lw = logoW*0.78, lh = lw*0.21;
    const cy = (S.bg.grid || '2x2') === '2x2' ? h/2 : h*0.55;
    els.push(logoEl({ x:(w-lw)/2, y:cy - lh/2, w:lw, variant:'color', shade:{ style:'box', color:'#ffffff', alpha:1, size:0.28 } }));
  }
  else if (S.template === 'logo') {
    if (fr) els.push(logoAt(w/2, fr.y + fr.h/2 - logoH/2, logoVariant));
    else els.push(logoAt(w/2, h - logoH - 0.07*h));
  }
  else if (S.template === 'headline' || S.template === 'event') {
    const isEvent = S.template === 'event';
    const hl = byId('headline')?.text ?? (isEvent ? 'Open House' : 'Proven before it ships.');
    const sb = byId('sub')?.text ?? (isEvent ? 'Thursday, May 14\n10 AM – 2 PM' : '');
    const statement = /^[A-Z][A-Z &]+:$/.test(hl.trim());
    const hsize = (statement ? 82 : isEvent ? 68 : 64)*u*(wide? .9:1), ssize = (statement ? 36 : isEvent ? 40 : 34)*u*(wide? .9:1);
    const tw = 0.86*w, tx = (w - tw)/2;
    const sLines = sb ? Math.max(1, sb.split('\n').length) : 0;
    const hLines = Math.ceil(hl.length / 22);
    const block = hsize*1.12*hLines + (sLines ? 0.02*h + ssize*1.35*sLines : 0);
    if (fr && whiteBand) {
      // white band: green headline with the color logo beneath it, both inside the band (photo fills the rest)
      const hs = Math.min(hsize, fr.h*0.3), lw = logoW*0.85, lh = lw*0.21;
      const inner = hs*1.15 + (sb ? ssize*0.9*1.3*sLines + 0.01*h : 0) + 0.02*h + lh;
      let y = fr.y + (fr.h - inner)/2;
      els.push(text('headline', hl, { x:tx, y, w:tw, size:hs, weight:800, align:'center', lh:1.1, color:textColor, shadow:false }));
      y += hs*1.15;
      if (sb) { els.push(text('sub', sb, { x:tx, y, w:tw, size:ssize*0.9, weight:500, align:'center', lh:1.3, font:'sans', color:'#006c40', shadow:false })); y += ssize*0.9*1.3*sLines + 0.01*h; }
      els.push(logoEl({ x:(w-lw)/2, y:y + 0.02*h, w:lw, variant:'color' }));
    } else if (fr) {
      // green band: headline inside the band, white logo on the photo half
      const hs = Math.min(hsize, fr.h*0.42);
      const inner = hs*1.15 + (sb ? ssize*0.9*1.3*sLines : 0);
      const bandTextY = fr.y + (fr.h - inner)/2;
      els.push(text('headline', hl, { x:tx, y:bandTextY, w:tw, size:hs, weight:800, align:'center', lh:1.1, color:textColor, shadow:false }));
      if (sb) els.push(text('sub', sb, { x:tx, y:bandTextY + hs*1.15, w:tw, size:ssize*0.9, weight:500, align:'center', lh:1.3, font:'sans', color:textColor, shadow:false }));
      if (fr.top) els.push(logoAt(w/2, h - logoH - 0.06*h, 'full'));
      else els.push(logoAt(w/2, 0.06*h, 'full'));
    } else if (pos === 'mid') {
      let y = (h - block)/2 - 0.03*h;
      els.push(text('headline', hl, { x:tx, y, w:tw, size:hsize, weight:800, align:'center', lh:1.1, upper:statement, shadow:!onArt }));
      if (sb) els.push(text('sub', sb, { x:tx, y:y + hsize*1.12*hLines + 0.02*h, w:tw, size:ssize, weight:600, align:'center', lh:1.35, font:'sans', shadow:!onArt }));
      els.push(logoAt(w/2, h - logoH - 0.07*h));
    } else if (pos === 'bc') {
      els.push(logoAt(w/2, 0.07*h));
      let y = h - 0.09*h - block;
      els.push(text('headline', hl, { x:tx, y, w:tw, size:hsize, weight:800, align:'center', lh:1.1, upper:statement, shadow:!onArt }));
      if (sb) els.push(text('sub', sb, { x:tx, y:y + hsize*1.12*hLines + 0.02*h, w:tw, size:ssize, weight:600, align:'center', lh:1.35, font:'sans', shadow:!onArt }));
    } else if (pos === 'tl') {
      const tw2 = 0.7*w;
      els.push(text('headline', hl, { x:m, y:0.08*h, w:tw2, size:hsize, weight:800, align:'left', lh:1.08, upper:statement, shadow:!onArt }));
      if (sb) els.push(text('sub', sb, { x:m, y:0.08*h + hsize*1.12*hLines + 0.02*h, w:tw2, size:ssize, weight:600, align:'left', lh:1.35, font:'sans', shadow:!onArt }));
      els.push(logoAt(w/2, h - logoH - 0.07*h));
    } else {
      els.push(text('headline', hl, { x:tx, y:0.08*h, w:tw, size:hsize, weight:800, align:'center', lh:1.1, upper:statement, shadow:!onArt }));
      if (sb) els.push(text('sub', sb, { x:tx, y:0.08*h + hsize*1.12*hLines + 0.02*h, w:tw, size:ssize, weight:600, align:'center', lh:1.35, font:'sans', shadow:!onArt }));
      els.push(logoAt(w/2, h - logoH - 0.07*h));
    }
  }
  else if (S.template === 'review') {
    const q = byId('quote')?.text ?? '“McMillan has been a dependable partner for our motor programs: realistic lead times, consistent quality, and people who pick up the phone.”';
    const a = byId('attr')?.text ?? 'OEM engineering manager';
    const bx = 0.07*w, bw = 0.86*w, by = wide ? 0.10*h : 0.09*h, bh = wide ? 0.66*h : 0.58*h;
    els.push({ id:'box', type:'box', x:bx, y:by, w:bw, h:bh, fill:'#034226', alpha:0.9, label:'CUSTOMER FEEDBACK', labelFill:'#00d66b', labelColor:'#034226', kids:['quote','attr'] });
    const pad = 0.05*w;
    els.push(text('quote', q, { x:bx+pad, y:by + (wide? 0.13*h : 0.09*h), w:bw-pad*2, size:40*u*(wide? .8:1), weight:600, align:'left', italic:false, shadow:false, lh:1.3, font:'sans' }));
    els.push(text('attr', a, { x:bx+pad, y:by+bh - (wide? 0.14*h : 0.09*h), w:bw-pad*2, size:26*u*(wide? .8:1), weight:600, align:'right', italic:false, shadow:false, font:'sans', color:'#00d66b' }));
    els.push(logoAt(w/2, h - logoH - 0.06*h));
  }
  // keep a product cutout the user placed (or the generator added) — drawn beneath the text, above the background
  const prod = byId('product'); if (prod) els.unshift(prod);
  S.els = els;
  S.sel = null;
  applyLook(false);
}
function templateDefaults(){
  // Art backgrounds need no darkening; photos get a light tint. Bands are chosen by the user or the generator.
  S.bg.fadePos = 'none'; S.bg.fade = 0.45; S.bg.fadeSize = 0.5;
  S.bg.dim = S.bg.kind === 'photo' ? (S.template === 'review' ? 0.35 : 0.22) : 0;
  if (S.bg.kind === 'collage' || S.template === 'collage') S.frame = 'none';
  const L = LOOKS[S.look];
  if (L.dim !== null && S.bg.kind === 'photo') S.bg.dim = L.dim;
}
