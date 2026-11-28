// Home: click-to-load YouTube (nocookie; nothing from Google loads before the click),
// ticker pause (WCAG 2.2.2), and the "agencies with access" creep (the joke).
(() => {
  'use strict';
  const reduce = window.HS ? window.HS.reduce : false;
  const play = document.querySelector('.cam .play');
  if (play) play.addEventListener('click', () => {
    const f = document.createElement('iframe');
    f.src = play.dataset.embed;
    f.title = 'Herd Surveillance live stream (YouTube)';
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    f.referrerPolicy = 'strict-origin-when-cross-origin';
    const cam = play.closest('.cam');
    cam.appendChild(f);
    play.parentElement.remove();
    f.focus();
  });
  const t = document.getElementById('ticker');
  if (t) {
    // constant reading speed (~60 px/s) whatever the number of headlines; track holds 2 copies
    const tr = t.querySelector('.track');
    const setSpeed = () => { if (tr) tr.style.animationDuration = Math.max(40, (tr.scrollWidth / 2) / 60) + 's'; };
    setSpeed(); addEventListener('resize', setSpeed);
    const b = t.querySelector('.tick-btn');
    b.addEventListener('click', () => {
      const p = t.classList.toggle('paused');
      b.setAttribute('aria-pressed', String(p));
      b.textContent = p ? '▶ Play' : '❚❚ Pause';
    });
  }
  const c = document.querySelector('[data-creep]');
  if (c && !reduce) {
    let n = +c.dataset.creep; const f = new Intl.NumberFormat('en-US');
    setInterval(() => { if (Math.random() < 0.5) { n += 1; c.textContent = f.format(n); } }, 7000);
  }
})();
