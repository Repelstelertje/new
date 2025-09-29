(() => {
  const d = document;
  const toggles = Array.from(d.querySelectorAll("[data-menu-toggle]"));
  let openId = null;

  const closeAll = () => {
    for (const btn of toggles) {
      const id = btn.getAttribute("data-menu-toggle");
      const panel = id ? d.getElementById(id) : null;
      btn.setAttribute("aria-expanded", "false");
      panel?.classList.add("hidden");
    }
    openId = null;
  };

  const open = (id) => {
    closeAll();
    const btn = d.querySelector(`[data-menu-toggle="${id}"]`);
    const panel = d.getElementById(id);
    if (!btn || !panel) return;
    btn.setAttribute("aria-expanded", "true");
    panel.classList.remove("hidden");
    openId = id;
  };

  toggles.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const id = btn.getAttribute("data-menu-toggle");
      if (!id) return;
      if (openId === id) closeAll();
      else open(id);
    });
  });

  d.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest("[data-menu]") || t.closest("[data-menu-toggle]")) return;
    closeAll();
  });

  d.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAll();
  });
})();
