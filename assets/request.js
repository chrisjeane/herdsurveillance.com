// Removal request: builds a prefilled mailto (no server, no storage).
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const form = $('rmForm'); if (!form) return;
  const email = $('copyBtn').dataset.copy;
  const qs = new URLSearchParams(location.search);
  const clean = s => String(s || '').replace(/[^\w\- ]/g, '').slice(0, 64);
  const file = clean(qs.get('file')), plate = clean(qs.get('plate')).toUpperCase();
  if (file || plate) $('rmId').value = plate && file ? plate + ' (file ' + file + ')' : file || plate;

  // tabs: Remove (default) | Show it unblurred (coming soon)
  const tabs = [$('tRm'), $('tCl')], panels = [$('pRm'), $('pCl')];
  const select = (i, focus) => {
    tabs.forEach((t, k) => { t.setAttribute('aria-selected', String(k === i)); t.tabIndex = k === i ? 0 : -1; panels[k].hidden = k !== i; });
    if (focus) tabs[i].focus();
  };
  tabs.forEach((t, i) => t.addEventListener('click', () => select(i)));
  tabs[0].parentElement.addEventListener('keydown', e => {
    const i = tabs.indexOf(document.activeElement); if (i < 0) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); select(1 - i, true); }
    if (e.key === 'Home') { e.preventDefault(); select(0, true); }
    if (e.key === 'End') { e.preventDefault(); select(1, true); }
  });
  if (qs.get('tab') === 'claim') select(1);
  const toRm = $('toRm'); if (toRm) toRm.addEventListener('click', e => { e.preventDefault(); select(0, true); });

  const when = document.querySelector('.when');
  $('rmDk').addEventListener('change', e => when.classList.toggle('on', e.target.checked));

  form.addEventListener('submit', e => {
    e.preventDefault();
    const id = $('rmId').value.trim(), dk = $('rmDk').checked, err = $('rmErr');
    if (!id && !dk) {
      err.textContent = "Enter a file number or plate, or choose \"I don't know my plate\".";
      err.hidden = false; $('rmId').setAttribute('aria-invalid', 'true'); err.focus();
      return;
    }
    err.hidden = true; $('rmId').removeAttribute('aria-invalid');
    const ref = id || 'unknown plate';
    const lines = ['Please remove this file: ' + ref, ''];
    if (dk) {
      lines.push("I don't know my plate.");
      if ($('rmW').value.trim()) lines.push('When I was on the cam: ' + $('rmW').value.trim());
      if ($('rmD').value.trim()) lines.push('Details: ' + $('rmD').value.trim());
      lines.push('');
    }
    const href = 'mailto:' + email + '?subject=' + encodeURIComponent('Remove file ' + ref) + '&body=' + encodeURIComponent(lines.join('\n'));
    $('sentRef').textContent = '"Remove file ' + ref + '"';
    $('rmSent').hidden = false;
    $('rmSent').focus();
    location.href = href;
  });

  $('copyBtn').addEventListener('click', async () => {
    const ok = $('copyOk');
    try { await navigator.clipboard.writeText(email); ok.textContent = 'Copied.'; }
    catch (_) {
      const r = document.createRange(); r.selectNodeContents($('addr'));
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      ok.textContent = 'Selected. Press Ctrl+C or Cmd+C to copy.';
    }
  });
})();
