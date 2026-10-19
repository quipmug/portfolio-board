(() => {
  const root = document.documentElement;
  const names = ["--dialog-viewport-height", "--dialog-viewport-top", "--dialog-viewport-bottom"];
  let frame = 0, suspended = document.hidden, previous = [];
  function clear() {
    try { names.forEach(name => { if (root?.style.getPropertyValue(name)) root.style.removeProperty(name); }); } catch { /* Keep native dialog sizing. */ }
    previous = [];
  }
  try {
    const viewport = window.visualViewport;
    if (!root || !viewport || !window.matchMedia) { clear(); return; }
    const responsive = window.matchMedia("(max-width: 768px), (pointer: coarse), (hover: none), (any-pointer: coarse)");
    function revealFocusedField(dialog) {
      const field = document.activeElement;
      if (!field?.matches("input, textarea, select") || !dialog.contains(field) || !field.getClientRects().length) return;
      const box = dialog.getBoundingClientRect();
      const bounds = field.getBoundingClientRect();
      const padding = Math.min(16, Number.parseFloat(window.getComputedStyle(dialog).scrollPaddingTop) || 12, dialog.clientHeight / 4);
      const top = box.top + dialog.clientTop + padding;
      const bottom = box.top + dialog.clientTop + dialog.clientHeight - padding;
      if (bounds.height <= bottom - top) {
        if (bounds.top < top) dialog.scrollTop += bounds.top - top;
        else if (bounds.bottom > bottom) dialog.scrollTop += bounds.bottom - bottom;
      } else if (bounds.bottom <= top || bounds.top >= bottom) {
        // Preserve native caret scrolling when a large textarea is already partly visible.
        dialog.scrollTop += bounds.top - top;
      }
    }
    function update() {
      frame = 0;
      try {
        const dialog = document.querySelector("dialog[open]");
        if (suspended || document.hidden || !responsive.matches || !dialog || Math.abs(viewport.scale - 1) > .01) { clear(); return; }
        const layout = document.documentElement.clientHeight;
        if (![layout, viewport.height, viewport.offsetTop, viewport.scale].every(Number.isFinite) || layout <= 0 || viewport.height <= 0) { clear(); return; }
        const height = Math.min(layout, viewport.height);
        const top = Math.min(layout - height, Math.max(0, viewport.offsetTop));
        const values = [height, top, Math.max(0, layout - height - top)].map(value => `${Math.round(value * 100) / 100}px`);
        values.forEach((value, index) => {
          if (value !== previous[index]) root.style.setProperty(names[index], value);
        });
        previous = values;
        revealFocusedField(dialog);
      } catch { clear(); }
    }
    function schedule() {
      if (!frame && !suspended && !document.hidden) frame = window.requestAnimationFrame(update);
    }
    function pause() {
      suspended = true;
      window.cancelAnimationFrame(frame);
      frame = 0;
      clear();
    }
    function resume() {
      suspended = document.hidden;
      schedule();
    }
    viewport.addEventListener("resize", schedule);
    viewport.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    document.addEventListener("focusin", schedule);
    responsive.addEventListener?.("change", schedule);
    new MutationObserver(schedule).observe(root, { subtree: true, attributes: true, attributeFilter: ["open"] });
    document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); else resume(); });
    document.addEventListener("freeze", pause);
    document.addEventListener("resume", resume);
    window.addEventListener("pagehide", pause);
    window.addEventListener("pageshow", resume);
    window.addEventListener("focus", resume);
    schedule();
  } catch { clear(); }
})();
