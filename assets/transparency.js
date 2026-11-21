(() => {
  'use strict';
  const no = document.getElementById('reqNo'), b = document.getElementById('reqAccess'), out = document.getElementById('reqLol');
  if (no) no.textContent = String(Math.floor(Math.random() * 90000) + 10000);
  if (b) b.addEventListener('click', () => { out.textContent = 'Request denied. Reason: lol. Your request has been forwarded to Stormwind.'; });
})();
