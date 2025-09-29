(function () {
  function onClick(e) {
    var t = e.target;
    var link = t.closest && t.closest('[data-analytics="outbound_click"]');
    if (!link) return;
    var props = {};
    try {
      var raw = link.getAttribute('data-props');
      if (raw) props = JSON.parse(raw);
    } catch (_) {}
    if (window.plausible) {
      window.plausible('outbound_click', { props: props });
    }
  }
  document.addEventListener('click', onClick, true);
})();
