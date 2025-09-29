/** Eenvoudige dropdown-controller: 1 tegelijk open, sluit bij klik buiten/ESC. */
(() => {
  const doc = document;
  const toggles = Array.from(doc.querySelectorAll<HTMLButtonElement>("[data-menu-toggle]"));
  let openId: string | null = null;

  function closeAll() {
    for (const btn of toggles) {
      const id = btn.getAttribute("data-menu-toggle");
      const panel = id ? doc.getElementById(id) : null;
      btn.setAttribute("aria-expanded", "false");
      panel?.classList.add("hidden");
    }
    openId = null;
  }
  function open(id: string) {
    closeAll();
    const btn = doc.querySelector<HTMLButtonElement>(`[data-menu-toggle="${id}"]`);
    const panel = doc.getElementById(id);
    if (!btn || !panel) return;
    btn.setAttribute("aria-expanded", "true");
    panel.classList.remove("hidden");
    openId = id;
  }
  toggles.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const id = btn.getAttribute("data-menu-toggle");
      if (!id) return;
      if (openId === id) closeAll();
      else open(id);
    });
  });
  doc.addEventListener("click", (e) => {
    const t = e.target as Element | null;
    if (!t) return;
    if (t.closest("[data-menu]") || t.closest("[data-menu-toggle]")) return;
    closeAll();
  });
  doc.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAll();
  });
})();
