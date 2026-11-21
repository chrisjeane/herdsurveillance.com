// Directory: in-memory search/filter over /files.json. State lives in the URL query.
// Searchable: plate, class, behavior, activity, hotlist, notes. NOT searchable (by design):
// the HIDE-ENTITY (palette, build, dwell, companions) and armor. See ux-spec §5A/§6.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const PAGE = 24, DAY = 864e5;
  const HS = window.HS;
  const form = $('filters'), grid = $('dirGrid'), count = $('count'), chipsEl = $('chips'), more = $('more');
  let DB = null, L = null, PAL = null, list = [], shown = 0;

  // ---------- shared card markup: must stay identical to card() in site/build.py
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' }[c]));
  const fmt = n => new Intl.NumberFormat('en-US').format(n);
  const pad = n => String(n).padStart(2, '0');
  const absdt = iso => { const d = new Date(iso); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`; };
  const dwellTxt = s => s < 60 ? s + 's' : Math.round(s / 60) + 'm';
  const compTxt = p => [p.creatures ? `+${p.creatures} PET` : '', p.nearby ? `${p.nearby >= 5 ? '5+' : p.nearby} NEARBY` : 'ALONE'].filter(Boolean).join(' · ');
  const headTxt = p => p.variant === 'companion' ? ['COMPANION FILE', 'PET'] : ['PERSON OF INTEREST', 'POI'];
  const ownerLine = p => p.variant !== 'companion' ? '' : p.nearby ? 'OWNER: IN FRAME · FAMILY PLAN APPLIED' : 'OWNER: UNKNOWN · BILLED TO NEAREST TAUREN';
  const accent = p => p.palette.length ? PAL[p.palette[0]] : '#3a4a47';
  const poiClass = p => `poi v-${p.variant}` + (p.flagged ? ' flagged' : '');
  const meterCls = p => ({ severe: 'hi', low: 'lo' }[p.band] || '');
  const cardName = p => `File ${p.id}, plate ${p.plate}, ${L.behavior[p.behavior].toLowerCase()}, risk ${p.risk.toLowerCase()} ${p.risk_pct} percent` +
    (p.flagged ? ', hotlisted' : '') + (p.activity ? ', activity ' + L.activity[p.activity].toLowerCase() : '') + ', image redacted';
  function hfp(p) {
    if (!p.palette.length) return '';
    const gait = L.behavior[p.behavior].toUpperCase();
    const armor = p.armor ? `${L.armor[p.armor].toUpperCase()} ARMOR` : '';
    const sr = `HIDE-ENTITY: colors ${p.palette.join(', ').toLowerCase()}; build ${p.build.toLowerCase()}; ` +
      `${L.behavior[p.behavior].toLowerCase()}; ${armor ? armor.toLowerCase() + '; ' : ''}on camera ${dwellTxt(p.dwell_s)}; ${compTxt(p).toLowerCase()}.`;
    const sws = p.palette.map(n => `<span class="sw"><i style="background:${PAL[n]}"></i><em>${n}</em></span>`).join('');
    const chips = `<span>${p.build}</span><span>${esc(gait)}</span>` + (armor ? `<span>${armor}</span>` : '') +
      `<span>DWELL ${dwellTxt(p.dwell_s)}</span><span>${compTxt(p)}</span>`;
    return `<div class="hfp"><span class="sr">${esc(sr)}</span><div aria-hidden="true">` +
      `<div class="hfp-h">HIDE-ENTITY™ <span>· who needs a plate?</span></div>` +
      `<div class="sws">${sws}</div><div class="hfp-k">${chips}</div></div></div>`;
  }
  function tags(p) {
    const t = (p.activity ? [`<span class="tg tg-a">${esc(L.activity[p.activity].toUpperCase())}</span>`] : [])
      .concat(p.surroundings.slice(0, 2).map(s => `<span class="tg">${esc(L.surroundings[s].toUpperCase())}</span>`));
    return t.length ? `<div class="tags">${t.join('')}</div>` : '';
  }
  const imageHTML = p => p.img
    ? `<div class="img"><img src="${esc(p.img)}" alt="" width="400" height="500" loading="lazy" decoding="async"></div>`
    : '<div class="img noimg"><span class="stamp" aria-hidden="true">IMAGE<br>PENDING</span></div>';
  function cardHTML(p) {
    const [hl, hs] = headTxt(p), d = HS.daysLeft(p.expires_at);
    const own = ownerLine(p) ? `<div class="own">${ownerLine(p)}</div>` : '';
    const hot = p.flagged && p.hotlist ? `<div class="hot">HOTLIST: ${esc(p.hotlist)}</div>` : '';
    return `<a class="card ${poiClass(p)}" href="/files/${p.id}/" style="--acc:${accent(p)}" ` +
      `aria-label="${esc(cardName(p))}" data-expires="${p.expires_at}"><article>` +
      `<div class="ch"><span><span class="lg">${hl}</span><span class="sm" aria-hidden="true">${hs}</span></span>` +
      `<span class="cid">#${esc(p.id)}</span></div>` +
      `<div class="cb">${imageHTML(p)}` +
      `<div class="pl">${esc(p.plate)}</div><div class="cl">${esc(p.class)}</div>${own}${hot}` +
      `${hfp(p)}${tags(p)}` +
      `<div class="meter" aria-hidden="true"><span class="t"><i class="${meterCls(p)}" style="width:${p.risk_pct}%"></i></span>` +
      `<b>${p.risk_pct}%</b> ${esc(p.risk)}</div>` +
      `<div class="mt"><time datetime="${p.captured_at}" data-rel>${absdt(p.captured_at)}</time></div>` +
      `<div class="mt">` +
      `<span class="ret${d <= 3 ? ' exp' : ''}" data-ret>RET ${d}d</span></div>` +
      `</div></article></a>`;
  }

  // ---------- state <-> URL
  const DEF = { q: '', behavior: '', activity: '', risk: '', seen: '30', ag: '0', sort: 'new' };
  const radio = name => form.querySelector(`[name=${name}]:checked`);
  const setRadio = (name, v) => { const r = form.querySelector(`[name=${name}][value="${CSS.escape(v)}"]`) || form.querySelector(`[name=${name}][value="${DEF[name]}"]`); r.checked = true; };
  const read = () => ({ q: $('q').value.trim(), behavior: $('fb').value, activity: $('fc').value, risk: radio('risk').value,
    seen: radio('seen').value, ag: String(Math.max(0, parseInt(($('fa') || {}).value, 10) || 0)), sort: $('fo').value });
  function write(st) {
    $('q').value = st.q; $('fb').value = st.behavior; $('fc').value = st.activity; setRadio('risk', st.risk); setRadio('seen', st.seen);
    if ($('fa')) $('fa').value = st.ag;
    $('fo').value = st.sort;
  }
  function fromURL() {
    const u = new URLSearchParams(location.search), st = {};
    for (const k in DEF) st[k] = (u.get(k) || DEF[k]).slice(0, 80);
    return st;
  }
  function toURL(st) {
    const u = new URLSearchParams();
    for (const k in DEF) if (st[k] && st[k] !== DEF[k]) u.set(k, st[k]);
    const s = u.toString();
    history.replaceState(null, '', location.pathname + (s ? '?' + s : ''));
  }

  // ---------- filter + render
  const norm = s => String(s).toUpperCase().replace(/[\s_\-·"']+/g, '');
  function apply(st) {
    const now = Date.now(), q = norm(st.q), ag = +st.ag;
    const out = DB.filter(p => {
      if (HS.expired(p.expires_at)) return false;
      if (now - Date.parse(p.captured_at) > (+st.seen) * DAY) return false;
      if (st.behavior && p.behavior !== st.behavior) return false;
      if (st.activity && p.activity !== st.activity) return false;
      if (st.risk && p.band !== st.risk) return false;
      if (p.agencies < ag) return false;
      if (q) {
        const hay = norm([p.plate, p.class, L.behavior[p.behavior], p.activity ? L.activity[p.activity] : '', p.hotlist, ...p.notes].join('|'));
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const by = { new: (a, b) => b.captured_at.localeCompare(a.captured_at), risk: (a, b) => b.risk_pct - a.risk_pct,
      ag: (a, b) => b.agencies - a.agencies, exp: (a, b) => a.expires_at.localeCompare(b.expires_at) }[st.sort] || (() => 0);
    return out.sort(by);
  }
  function chips(st) {
    const c = [];
    if (st.q) c.push(['q', `"${st.q}"`]);
    if (st.behavior) c.push(['behavior', L.behavior[st.behavior] || st.behavior]);
    if (st.activity) c.push(['activity', 'Activity: ' + (L.activity[st.activity] || st.activity)]);
    if (st.risk) c.push(['risk', 'Risk: ' + st.risk]);
    if (st.seen !== DEF.seen) c.push(['seen', 'Seen: ' + (st.seen === '1' ? '24h' : st.seen + 'd')]);
    if (+st.ag) c.push(['ag', '≥ ' + fmt(+st.ag) + ' SI:7 agents']);
    chipsEl.innerHTML = c.map(([k, t]) => `<button class="chip" type="button" data-k="${k}" aria-label="Remove filter ${esc(t)}">${esc(t)} ✕</button>`).join('');
    const n = c.filter(([k]) => k !== 'q').length;
    $('fT').textContent = n ? `Filters (${n})` : 'Filters';
  }
  function page(focusFirst) {
    const start = shown;
    shown = Math.min(list.length, shown + PAGE);
    grid.insertAdjacentHTML('beforeend', list.slice(start, shown).map(cardHTML).join(''));
    HS.refresh(grid);
    more.hidden = shown >= list.length;
    $('moreBtn').textContent = `Load more (${Math.min(PAGE, list.length - shown)})`;
    if (focusFirst) { const c = grid.querySelectorAll('a.card')[start]; if (c) c.focus(); }
  }
  function render() {
    const st = read();
    toURL(st); chips(st);
    list = apply(st); shown = 0; grid.innerHTML = '';
    grid.removeAttribute('aria-busy');
    const n = list.length;
    count.textContent = `${n} subject${n === 1 ? '' : 's'} found · 0 elder writs used · search logged`;
    $('fApply').textContent = `Show ${n} result${n === 1 ? '' : 's'}`;
    if (!DB.length) {
      grid.innerHTML = '<div class="empty"><h3>THE HERD IS QUIET.</h3><p>Cameras are warming up.</p><p><a class="btn" href="/#cam">Watch live</a></p></div>';
      more.hidden = true; return;
    }
    if (!n) {
      const plateish = /\d{3,4}/.test(st.q);
      grid.innerHTML = `<div class="empty"><h3>NO SUBJECTS MATCH.</h3><p>This has never happened to Herd before. An analyst has been notified (to invent one).</p>` +
        (plateish ? `<div class="plain"><span class="lbl">PLAIN LANGUAGE · NOT A BIT</span><p>No file for "${esc(st.q)}". It may have expired after 30 days or been removed at the subject's request.</p></div>` : '') +
        `<button class="btn" type="button" data-reset>Reset filters</button></div>`;
      more.hidden = true; return;
    }
    page(false);
  }

  // ---------- events
  let deb;
  form.addEventListener('input', e => { if (e.target.id === 'q' || e.target.id === 'fa') { clearTimeout(deb); deb = setTimeout(render, 150); } });
  form.addEventListener('change', e => { if (e.target.id !== 'q') render(); });
  form.addEventListener('submit', e => { e.preventDefault(); clearTimeout(deb); render(); });
  const reset = () => { write(DEF); render(); };
  $('fReset').addEventListener('click', reset);
  grid.addEventListener('click', e => { if (e.target.closest('[data-reset]')) { reset(); $('q').focus(); } });
  chipsEl.addEventListener('click', e => {
    const b = e.target.closest('[data-k]'); if (!b) return;
    const st = read(); st[b.dataset.k] = DEF[b.dataset.k]; write(st); render();
    const next = chipsEl.querySelector('.chip'); (next || $('q')).focus();
  });
  $('moreBtn').addEventListener('click', () => page(true));
  // mobile drawer
  const drawer = open => { form.classList.toggle('open', open); $('fT').setAttribute('aria-expanded', String(open)); };
  $('fT').addEventListener('click', () => { const o = !form.classList.contains('open'); drawer(o); if (o) $('fb').focus(); });
  $('fApply').addEventListener('click', () => { drawer(false); $('fT').focus(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && form.classList.contains('open')) { drawer(false); $('fT').focus(); } });

  // ---------- load
  function options(sel, labels, present, current) {
    for (const [k, v] of Object.entries(labels)) if (present.has(k) || k === current) sel.insertAdjacentHTML('beforeend', `<option value="${esc(k)}">${esc(v)}</option>`);
  }
  function fail(offline) {
    grid.removeAttribute('aria-busy');
    count.textContent = 'DATABASE UNAVAILABLE.';
    grid.innerHTML = `<div class="empty"><h3>DATABASE UNAVAILABLE.</h3><p>Your data is safe (with SI:7).</p>` +
      `<div class="plain"><span class="lbl">PLAIN LANGUAGE · NOT A BIT</span><p>${offline ? "You're offline. " : ''}Couldn't load the directory. Check your connection and retry.</p></div>` +
      `<button class="btn" type="button" id="retry">Retry</button></div>`;
    $('retry').addEventListener('click', load);
  }
  async function load() {
    grid.setAttribute('aria-busy', 'true');
    count.textContent = 'Checking with SI:7…';
    try {
      const r = await fetch('/files.json', { cache: 'no-cache' });
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      L = j.labels; PAL = j.palette; DB = j.files;
      const st = fromURL();
      if (!$('fb').options.length || $('fb').options.length === 1) {
        options($('fb'), L.behavior, new Set(DB.map(p => p.behavior)), st.behavior);
        options($('fc'), L.activity, new Set(DB.map(p => p.activity).filter(Boolean)), st.activity);
      }
      $('dTotal').textContent = fmt(DB.filter(p => !HS.expired(p.expires_at)).length);
      write(st); render();
    } catch (_) { fail(!navigator.onLine); }
  }
  load();
})();
