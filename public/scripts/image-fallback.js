// Vervangt <img data-fallback-src> bij laadfout, zonder inline onerror (CSP-vriendelijk)
document.addEventListener(
  "error",
  (e) => {
    const el = e.target as HTMLElement;
    if (!(el instanceof HTMLImageElement)) return;
    const fb = el.getAttribute("data-fallback-src");
    if (!fb) return;
    el.removeAttribute("data-fallback-src");
    el.srcset = "";
    el.src = fb;
  },
  true
);
