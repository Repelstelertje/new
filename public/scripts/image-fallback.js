document.addEventListener(
  "error",
  (e) => {
    const el = e.target;
    if (!(el instanceof HTMLImageElement)) return;
    const fallback = el.getAttribute("data-fallback-src");
    if (!fallback) return;
    // prevent loop
    el.removeAttribute("data-fallback-src");
    el.srcset = "";
    el.src = fallback;
  },
  true,
);
