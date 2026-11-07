// Shared behavior for every page. No trackers, no cookies, no storage.
(() => {
  'use strict';
  const DAY = 864e5;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rel = t => {
    const hrs = (Date.now() - t) / 36e5;
    return hrs < 1 ? Math.max(1, Math.round(hrs * 60)) + ' min ago' : hrs < 48 ? Math.round(hrs) + 'h ago' : Math.round(hrs / 24) + 'd ago';
  };
  const daysLeft = iso => Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / DAY));
  const expired = iso => Date.parse(iso) <= Date.now();
  window.HS = { rel, daysLeft, expired, reduce };

  // header menu (mobile)
  const menu = document.getElementById('menuT'), nav = document.getElementById('nav');
  const closeMenu = focus => { nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); if (focus) menu.focus(); };
  if (menu && nav) {
    menu.addEventListener('click', () => { const o = nav.classList.toggle('open'); menu.setAttribute('aria-expanded', String(o)); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('open')) closeMenu(true); });
  }

  // relative times, retention chips, and the client-side expiry guard (build may be stale)
  window.HS.refresh = (root = document) => {
    root.querySelectorAll('time[data-rel]').forEach(el => { el.textContent = rel(Date.parse(el.dateTime)); });
    root.querySelectorAll('a.card[data-expires]').forEach(el => {
      const iso = el.dataset.expires;
      if (expired(iso)) { el.remove(); return; }
      const r = el.querySelector('[data-ret]'), d = daysLeft(iso);
      if (r) { r.textContent = 'RET ' + d + 'd'; r.classList.toggle('exp', d <= 3); }
    });
  };
  window.HS.refresh();

  // file detail: expiry guard + days-left + agencies count-up + sticky remove bar
  const body = document.body;
  if (body.dataset.expires) {
    if (expired(body.dataset.expires)) {
      const live = document.getElementById('fileLive');
      if (live) {
        live.innerHTML = '<section class="plain expired-note" aria-labelledby="h-exp"><span class="lbl">PLAIN LANGUAGE · NOT A BIT</span>' +
          '<h1 id="h-exp">This file has expired</h1><p>Files are deleted 30 days after capture. This one is past that date, so its picture and details are gone.</p>' +
          '<p><a href="/directory/">Browse the directory</a></p></section>';
      }
      body.classList.remove('on-file');
      const s = document.getElementById('stickyRm'); if (s) s.remove();
    } else {
      const box = document.querySelector('.ret-box[data-expires]');
      if (box) {
        const d = daysLeft(box.dataset.expires), exp = d <= 3;
        box.classList.toggle('exp', exp);
        const l = box.querySelector('[data-left]'); if (l) l.textContent = (exp ? 'Expiring · ' : '') + d + (d === 1 ? ' day' : ' days') + ' left';
        const bar = box.querySelector('.bar i'); if (bar) bar.style.width = Math.min(100, d / 30 * 100) + '%';
      }
      const c = document.querySelector('[data-count]');
      if (c && !reduce) {
        const n = +c.dataset.count, t0 = performance.now(), f = new Intl.NumberFormat('en-US');
        const step = t => { const u = Math.min(1, (t - t0) / 1400); c.textContent = f.format(Math.round(n * (1 - Math.pow(1 - u, 3)))); if (u < 1) requestAnimationFrame(step); };
        c.setAttribute('aria-hidden', 'true');
        const sr = document.createElement('span'); sr.className = 'sr'; sr.textContent = f.format(n); c.after(sr);
        requestAnimationFrame(step);
      }
      const panel = document.getElementById('plainAct'), sticky = document.getElementById('stickyRm');
      if (panel && sticky && 'IntersectionObserver' in window) {
        new IntersectionObserver(([e]) => {
          sticky.classList.toggle('show', !e.isIntersecting);
        }).observe(panel);
      }
    }
  }
})();
