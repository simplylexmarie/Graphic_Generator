// ---------- Clear (shared) ----------
// Everything off the page, back to the studio's blank starting point (STUDIO.blank). The
// calendar selection stays, so the next "Generate from calendar" picks up where you were.
$('#clearBtn').addEventListener('click', () => {
  pushUndo();
  S.sel = null;
  STUDIO.blank();
  if (typeof CTX !== 'undefined') { CTX.options = []; CTX.on = -1; renderOptions(); }
  currentDraftId = null;
  hideWelcome();
  templateDefaults(); layout(); syncControls(); renderInspector(); renderResults(); renderQuickFields(); fitCanvas(); persist();
  toast('Cleared \u2014 Undo brings it back');
});
