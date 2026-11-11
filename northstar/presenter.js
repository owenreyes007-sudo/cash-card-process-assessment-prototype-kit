/* Hidden presenter controls. Opens with Alt+Shift+S or Ctrl+Shift+D, or via the keyboard-only "Presenter options" control
   (first Tab stop, invisible until focused), or by opening index.html#presenter. Not part of the advocate journey. */
(() => {
  /* Edit the shortcuts here: code is the physical key (e.g. 'KeyS'). */
  const SHORTCUTS = [{ code: 'KeyS', alt: true, shift: true, ctrl: false }, { code: 'KeyD', alt: false, shift: true, ctrl: true }];
  const NC = window.NorthstarConditions;
  let draft = null, draftIssue = null, lastFocus = null;
  const root = () => document.querySelector('#presenter-root');
  const clone = c => JSON.parse(JSON.stringify(c));
  const e = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function render() {
    const sel = draft[draftIssue] || [];
    const total = Object.values(draft).reduce((n, a) => n + a.length, 0);
    root().innerHTML = `<div class="context-modal-backdrop presenter-backdrop"><section class="context-modal presenter-panel" role="dialog" aria-modal="true" aria-labelledby="pp-title">
      <header class="context-modal-header"><div><span class="section-kicker">SIMULATION CONTROLS</span><h2 id="pp-title">Modify scenario</h2><p>Choose the account conditions and recorded event history used by the next diagnostic.</p></div><button type="button" class="dialog-close" data-pp="cancel" aria-label="Cancel">×</button></header>
      <div class="context-modal-body">
        <label class="pp-label" for="pp-issue">Concern</label>
        <select id="pp-issue" class="pp-select">${issues.map(i => `<option value="${i.id}" ${i.id === draftIssue ? 'selected' : ''}>${e(i.name)}${(draft[i.id] || []).length ? ` (${draft[i.id].length})` : ''}</option>`).join('')}</select>
        <p class="pp-help">Select one or more conditions. With none selected, the diagnostic reports no blocker. Card status, risk, hold and delivery conditions apply to every concern, so the account stays consistent; conflicting conditions are disabled.</p>
        <div class="pp-list" role="group" aria-label="Conditions">${NC.visible(draftIssue).map(c => {
          const checked = sel.includes(c.id), why = checked ? null : NC.conflictDraft(draft, draftIssue, c.id);
          return `<label class="pp-option ${why ? 'disabled' : ''}"><input type="checkbox" data-cond="${c.id}" ${checked ? 'checked' : ''} ${why ? 'disabled' : ''}><span><b>${e(c.label)}</b>${why ? `<small>${why.needs ? `Select ${e(why.needs)} first` : `Conflicts with “${e(why.cond.label)}”${why.issue !== draftIssue ? ` (${e(issues.find(i => i.id === why.issue).name)})` : ''}`}</small>` : ''}</span></label>`;
        }).join('')}</div>
      </div>
      <footer class="context-modal-footer"><button type="button" class="button outline" data-pp="reset">Reset</button><span class="dialog-footer-spacer"></span><small class="pp-count" aria-live="polite">${total} condition${total === 1 ? '' : 's'} selected</small><button type="button" class="button outline" data-pp="cancel">Cancel</button><button type="button" class="button primary" data-pp="apply">Apply</button></footer>
    </section></div>`;
  }

  function open() {
    if (root().children.length) return;
    lastFocus = document.activeElement;
    draft = clone(state.config);
    for (const i of issues) draft[i.id] = (draft[i.id] || []);
    draftIssue = state.issue || issues[0].id;
    render();
    root().querySelector('#pp-issue').focus();
  }
  function close() {
    root().replaceChildren();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  /* Applying replaces the in-memory configuration, clears any stale result/scan and refreshes account context. It never runs a diagnostic. */
  function commit(cfg) {
    const clean = {};
    for (const i of issues) if (cfg[i.id]?.length) clean[i.id] = [...cfg[i.id]];
    state.config = NC.isValid(clean) ? clean : {};
    const wasScanning = state.scanning;
    clearResult();
    if (wasScanning) renderTroubleshoot();
    syncAccountContext();
  }

  document.addEventListener('keydown', ev => {
    if (!ev.metaKey && SHORTCUTS.some(k => ev.code === k.code && ev.altKey === k.alt && ev.shiftKey === k.shift && ev.ctrlKey === k.ctrl)) {
      ev.preventDefault();
      root().children.length ? close() : open();
    } else if (ev.key === 'Escape' && root().children.length) { ev.preventDefault(); close(); }
  });

  document.addEventListener('click', ev => {
    if (ev.target.closest('#presenter-open')) { open(); return; }
    const btn = ev.target.closest('[data-pp]');
    if (!btn || !root().contains(btn)) return;
    const a = btn.dataset.pp;
    if (a === 'cancel') close();
    else if (a === 'apply') { commit(draft); close(); }
    else if (a === 'reset') { commit({}); draft = {}; for (const i of issues) draft[i.id] = []; render(); root().querySelector('.pp-count').textContent = 'Defaults restored'; }
  });
  document.addEventListener('change', ev => {
    if (!root().contains(ev.target)) return;
    if (ev.target.id === 'pp-issue') { draftIssue = ev.target.value; render(); root().querySelector('#pp-issue').focus(); return; }
    const id = ev.target.dataset.cond; if (!id) return;
    const list = draft[draftIssue] || (draft[draftIssue] = []);
    if (ev.target.checked) { if (!NC.conflictDraft(draft, draftIssue, id)) list.push(id); }
    else draft[draftIssue] = list.filter(x => x !== id);
    NC.prune(draft);
    render(); root().querySelector(`[data-cond="${id}"]`)?.focus();
  });
  window.addEventListener('DOMContentLoaded', () => { if (location.hash === '#presenter') open(); });
})();

