(function () {
  const openAttr = "data-open";
  const toggleSelector = "[data-dropdown-toggle]";

  function setExpanded(toggle, expanded) {
    if (toggle) {
      toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    }
  }

  function closeAll(except) {
    document.querySelectorAll(`[data-dropdown][${openAttr}="true"]`).forEach((el) => {
      if (!except || el !== except) {
        el.setAttribute(openAttr, "false");
        const toggle = el.querySelector(toggleSelector);
        setExpanded(toggle, false);
      }
    });
  }

  document.addEventListener("click", (event) => {
    const toggle = event.target.closest?.(toggleSelector);
    if (toggle) {
      const dropdown = toggle.closest?.("[data-dropdown]");
      if (!dropdown) return;
      const isOpen = dropdown.getAttribute(openAttr) === "true";
      closeAll(dropdown);
      dropdown.setAttribute(openAttr, isOpen ? "false" : "true");
      setExpanded(toggle, !isOpen);
      return;
    }

    if (!event.target.closest?.("[data-dropdown]")) {
      closeAll();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAll();
    }
  });

  document.addEventListener("click", (event) => {
    const link = event.target.closest?.("[data-dropdown] a");
    if (link) {
      closeAll();
    }
  });
})();
