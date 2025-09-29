(function () {
  function applyFallback(event) {
    const img = event.target;
    if (!(img instanceof HTMLImageElement)) return;
    if (img.dataset.fallbackApplied === "true") return;

    const fallback = img.getAttribute("data-fallback-src");
    if (!fallback) return;

    img.dataset.fallbackApplied = "true";
    img.removeAttribute("srcset");
    img.src = fallback;
  }

  document.addEventListener("error", applyFallback, true);
})();
