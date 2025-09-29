(function () {
  try {
    if (localStorage.getItem('age_ok') === '1') return;
    var el = document.getElementById('age-interstitial');
    if (!el) return;
    el.removeAttribute('hidden');
    var main = document.getElementById('main-content');
    if (main) main.setAttribute('aria-hidden', 'true');

    var ok = document.getElementById('age-ok');
    var exit = document.getElementById('age-exit');

    if (ok) {
      ok.addEventListener('click', function (e) {
        e.preventDefault();
        localStorage.setItem('age_ok', '1');
        el.setAttribute('hidden', '');
        if (main) main.removeAttribute('aria-hidden');
      });
    }
    if (exit) {
      exit.addEventListener('click', function () {
        location.href = '/';
      });
    }
  } catch (_) {}
})();
