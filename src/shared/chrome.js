// ---------- studio chrome (shared) ----------
// Arranges the editor's existing controls into a calmer layout, without changing what any of
// them do: the client's mark in the top bar, the less-used actions in a "More" menu, the left
// rail split into Calendar / Design / Media tabs, toolbar icons, and the toolbar's instructions
// behind a help button.
(() => {
  const RAIL_KEY = STUDIO.slug + '-rail-tab';
  const EMOJI = /^[\u{1F300}-\u{1FAFF}☀-➿⭐️]+\s*/u;

  function topBar(){
    const brand = document.querySelector('.top .brand');
    if (brand && !brand.querySelector('.mark')) {
      const c = (window.BI_CLIENTS || []).find(x => x.slug === STUDIO.slug);
      const img = h('img', { class:'mark', src:'logo.png', alt:'' });
      img.onerror = () => img.remove();
      const sel = brand.querySelector('#profileSel');
      if (sel) sel.before(img); else brand.append(img);
      if (c && c.accent) document.documentElement.style.setProperty('--client', c.accent);
    }
    const acts = document.querySelector('.top-actions'); if (!acts) return;
    // the less-used actions go into a menu; the buttons themselves move, so their handlers stay
    const inMenu = ['resetBtn', 'saveBtn', 'dlAllBtn', 'clearBtn'].map(id => document.getElementById(id)).filter(Boolean);
    if (inMenu.length && !document.getElementById('moreBtn')) {
      const menu = h('div', { class:'menu', hidden:true, role:'menu' });
      const labels = { resetBtn:'Reset layout', saveBtn:'Save draft', dlAllBtn:'Download all sizes', clearBtn:'Clear the page' };
      inMenu.forEach(b => {
        if (b.id === 'clearBtn') { menu.append(h('hr')); b.classList.add('danger'); }
        b.classList.remove('sm'); b.textContent = labels[b.id] || b.textContent; b.setAttribute('role', 'menuitem');
        b.addEventListener('click', () => { menu.hidden = true; });
        menu.append(b);
      });
      const more = h('button', { class:'btn has-i', id:'moreBtn', 'aria-haspopup':'menu', 'aria-expanded':'false', title:'More actions' }, 'More');
      more.onclick = e => { e.stopPropagation(); menu.hidden = !menu.hidden; more.setAttribute('aria-expanded', String(!menu.hidden)); };
      document.addEventListener('click', e => { if (!menu.hidden && !menu.contains(e.target)) { menu.hidden = true; more.setAttribute('aria-expanded', 'false'); } });
      document.addEventListener('keydown', e => { if (e.key === 'Escape') menu.hidden = true; });
      const wrap = h('div', { class:'menu-wrap' }, more, menu);
      const undo = document.getElementById('undoBtn');
      if (undo) { undo.classList.add('icon'); undo.title = 'Undo (⌘Z)'; undo.setAttribute('aria-label', 'Undo'); undo.textContent = ''; undo.after(h('span', { class:'sep' }), wrap); }
      else acts.prepend(wrap);
    }
  }

  function railTabs(){
    const left = document.getElementById('left'); if (!left || left.querySelector('.rail-tabs')) return;
    const secs = [...left.children].filter(n => n.classList.contains('sec'));
    const tabOf = s => s.id === 'calSec' ? 'calendar'
      : s.querySelector('#results, #artChips, #stickerRow, #bgBtn, #zoom, #dim, #q') ? 'media' : 'design';
    secs.forEach(s => { s.dataset.tab = tabOf(s); });
    const names = { calendar:'Calendar', design:'Design', media:'Media' };
    const hasCal = () => !!(typeof calCfg === 'function' && calCfg());
    const bar = h('div', { class:'rail-tabs', role:'tablist', 'aria-label':'Panels' });
    const pick = tab => {
      if (tab === 'calendar' && !hasCal()) tab = 'design';
      try { localStorage.setItem(RAIL_KEY, tab); } catch {}
      bar.querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
      secs.forEach(s => s.classList.toggle('rail-off', s.dataset.tab !== tab));
      left.scrollTop = 0;
    };
    ['calendar', 'design', 'media'].forEach(t => bar.append(h('button', { role:'tab', 'data-tab':t, onclick:() => pick(t) }, names[t])));
    left.prepend(bar);
    let saved = ''; try { saved = localStorage.getItem(RAIL_KEY) || ''; } catch {}
    const refresh = () => { bar.querySelector('[data-tab="calendar"]').hidden = !hasCal(); pick(saved || (hasCal() ? 'calendar' : 'design')); };
    refresh();
    // the calendar block arrives a moment later (clients.js loads last), so look again then
    window.addEventListener('studio-ready', () => { saved = (() => { try { return localStorage.getItem(RAIL_KEY) || ''; } catch { return ''; } })(); refresh(); }, { once:true });
  }

  function toolbar(){
    const tb = document.querySelector('.toolbar'); if (!tb || tb.querySelector('#helpBtn')) return;
    const hint = tb.querySelector('.hint');
    const help = h('div', { class:'help-pop', hidden:true },
      h('b', {}, 'Working on the graphic'),
      h('ul', {}, h('li', {}, 'Click any piece to select it'), h('li', {}, 'Drag to move, corners to resize'),
        h('li', {}, 'Arrow keys nudge, Delete removes'), h('li', {}, 'Scroll or pinch over a photo to zoom'),
        h('li', {}, 'Double-click a framed photo to move it inside its frame')));
    const btn = h('button', { class:'btn sm has-i icon', id:'helpBtn', title:'How to edit', 'aria-label':'How to edit' });
    btn.onclick = e => { e.stopPropagation(); help.hidden = !help.hidden; };
    document.addEventListener('click', e => { if (!help.hidden && !help.contains(e.target) && e.target !== btn) help.hidden = true; });
    const gap = h('span', { class:'tb-gap' });
    const first = tb.querySelector('#shufPhoto');
    if (first) first.before(gap);
    tb.append(h('div', { class:'menu-wrap' }, btn, help));
    if (hint) hint.remove();
  }

  function icons(){
    ['undoBtn','dlBtn','driveBtn','calGen','calMonthGen','calDraftBtn','genBtn','welcomeGen','shufPhoto','shufLook','collageQuick','collageBtn','addText']
      .forEach(id => { const b = document.getElementById(id); if (b) { b.classList.add('has-i'); b.textContent = b.textContent.replace(EMOJI, ''); } });
    const dl = document.getElementById('dlBtn'); if (dl && /PNG/.test(dl.textContent)) dl.textContent = 'Download';
    const shP = document.getElementById('shufPhoto'); if (shP) shP.textContent = 'New background';
    const shL = document.getElementById('shufLook'); if (shL) shL.textContent = 'New look';
    const add = document.getElementById('addText'); if (add) add.textContent = 'Text';
    const col = document.getElementById('collageQuick'); if (col) col.textContent = 'Collage';
    // these four can shrink to icons on a narrow screen, so each keeps its name for screen readers and tooltips
    [['shufPhoto','New background'],['shufLook','New look'],['collageQuick','Collage'],['addText','Add text']].forEach(([id, name]) => {
      const b = document.getElementById(id); if (!b) return;
      b.setAttribute('aria-label', name); if (!b.title) b.title = name;
    });
  }

  function start(){ if (typeof CLIENT_EDIT !== 'undefined' && CLIENT_EDIT) { icons(); return; } topBar(); railTabs(); toolbar(); icons(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
