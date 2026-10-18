(() => {
  const root = document.documentElement;
  const names = ["--dialog-viewport-height", "--dialog-viewport-top", "--dialog-viewport-bottom"];
  let frame = 0, suspended = false, previous = [];
  function clear() {
    try { names.forEach(name => { if (root?.style.getPropertyValue(name)) root.style.removeProperty(name); }); } catch { /* Keep native dialog sizing. */ }
    previous = [];
  }
  try {
    const viewport = window.visualViewport;
    if (!root || !viewport || !window.matchMedia) { clear(); return; }
    const responsive = window.matchMedia("(max-width: 768px), (pointer: coarse), (hover: none), (any-pointer: coarse)");
    function update() {
      frame = 0;
      try {
        if (suspended || !responsive.matches || !document.querySelector("dialog[open]") || Math.abs(viewport.scale - 1) > .01) { clear(); return; }
        const layout = document.documentElement.clientHeight;
        if (![layout, viewport.height, viewport.offsetTop, viewport.scale].every(Number.isFinite) || layout <= 0 || viewport.height <= 0) { clear(); return; }
        const height = Math.min(layout, viewport.height);
        const top = Math.min(layout - height, Math.max(0, viewport.offsetTop));
        const values = [height, top, Math.max(0, layout - height - top)].map(value => `${Math.round(value * 100) / 100}px`);
        values.forEach((value, index) => {
          if (value !== previous[index]) root.style.setProperty(names[index], value);
        });
        previous = values;
      } catch { clear(); }
    }
    function schedule() {
      if (!frame && !suspended) frame = window.requestAnimationFrame(update);
    }
    viewport.addEventListener("resize", schedule);
    viewport.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    document.addEventListener("focusin", schedule);
    responsive.addEventListener?.("change", schedule);
    new MutationObserver(schedule).observe(root, { subtree: true, attributes: true, attributeFilter: ["open"] });
    window.addEventListener("pagehide", () => {
      suspended = true;
      window.cancelAnimationFrame(frame);
      frame = 0;
      clear();
    });
    window.addEventListener("pageshow", () => { suspended = false; schedule(); });
    schedule();
  } catch { clear(); }
})();
