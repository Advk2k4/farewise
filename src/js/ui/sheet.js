/* Farewise: bottom sheet for adding an expense by hand. */
'use strict';
function renderSheet(){
  const el = $('#sheet'); const sh = S.sheet;
  if (!sh){ el.innerHTML = ''; return; }
  el.innerHTML = `<div class="sheet-bg" data-act="sheet-bg"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-h">
    <h3 id="sheet-h">Add an expense</h3><form class="formgrid" id="exp-form" style="margin-top:12px">
      <div class="two"><label class="f" for="exp-date">Date<input class="in" type="date" id="exp-date" value="${todayISO()}" required></label>
      <label class="f" for="exp-amt">Amount (${esc(S.prefs.rates.cur)})<input class="in" type="number" min="0.01" step="any" inputmode="decimal" id="exp-amt" required></label></div>
      <label class="f" for="exp-mode">Type<select class="in" id="exp-mode">${SPEND_MODES.filter(m => m !== 'walk').map(m => `<option value="${m}">${SPEND_NAME[m]}</option>`).join('')}</select></label>
      <label class="f" for="exp-note">Note<input class="in" id="exp-note" placeholder="e.g. Airport train" autocomplete="off"></label>
      <div class="row" style="justify-content:flex-end"><button type="button" class="btn" data-act="sheet-close">Cancel</button><button class="btn primary" type="submit">Add</button></div></form>
  </div></div>`;
  const f = $('#exp-amt'); if (f) f.focus({preventScroll:true});
}
