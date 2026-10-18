(() => {
  try {
    const host = document.querySelector(".site-header");
    if (!host || !window.matchMedia || !window.fetch) return;
    const desktop = window.matchMedia("(min-width: 1100px) and (hover: hover) and (pointer: fine)");
    const touch = window.matchMedia("(any-pointer: coarse)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const url = new URL("./art/satellite.json?v=orbit-7", document.currentScript.src);
    let art, node, observer, controller, timer = 0, generation = 0, introduced = false;
    const eligible = () => desktop.matches && !touch.matches;

    function stop() {
      window.clearTimeout(timer);
      timer = 0;
      node?.classList.remove("is-sending");
    }

    function play() {
      if (!node || !eligible() || reduced.matches || document.hidden || timer || document.querySelector("dialog[open]")) return;
      node.classList.add("is-sending");
      timer = window.setTimeout(stop, 1900);
    }

    function remove() {
      generation += 1;
      controller?.abort();
      controller = null;
      stop();
      observer?.disconnect();
      observer = null;
      node?.remove();
      node = null;
    }

    function mount() {
      if (node || !eligible() || !art) return;
      node = document.createElement("button");
      node.type = "button";
      node.className = "ascii-satellite";
      node.setAttribute("aria-label", "Send a satellite signal");
      node.title = "Send a signal";
      for (const name of ["body", "near", "far"]) {
        const layer = document.createElement("pre");
        layer.className = name === "body" ? "ascii-body" : `ascii-signal ascii-signal-${name}`;
        layer.setAttribute("aria-hidden", "true");
        layer.textContent = art[name];
        node.append(layer);
      }
      node.addEventListener("pointerenter", play);
      node.addEventListener("focus", play);
      node.addEventListener("click", play);
      node.addEventListener("animationend", event => { if (event.animationName === "satellite-drift") stop(); });
      host.append(node);
      if ("IntersectionObserver" in window) {
        observer = new IntersectionObserver(entries => {
          if (!entries[0]?.isIntersecting) stop();
          else if (!introduced) { introduced = true; play(); }
        }, { threshold: .25 });
        observer.observe(node);
      } else if (!introduced) { introduced = true; play(); }
    }

    async function sync() {
      if (!eligible()) { remove(); return; }
      if (art) { mount(); return; }
      if (controller) return;
      const run = ++generation;
      const request = new AbortController();
      controller = request;
      try {
        const response = await fetch(url, { signal: request.signal });
        if (!response.ok) return;
        const data = await response.json();
        if (!["body", "near", "far"].every(name => typeof data[name] === "string"
          && data[name].split("\n").length === 16 && /^[\x20-\x7e\n]{1,512}$/.test(data[name]))) return;
        if (run !== generation || !eligible()) return;
        art = data;
        mount();
      } catch { /* A decorative asset never blocks the portfolio. */ }
      finally { if (controller === request) controller = null; }
    }

    desktop.addEventListener("change", sync);
    touch.addEventListener("change", sync);
    reduced.addEventListener("change", stop);
    document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
    window.addEventListener("blur", stop);
    window.addEventListener("pagehide", remove);
    window.addEventListener("pageshow", sync);
    sync();
  } catch { /* Leave the reading column unchanged if decoration is unavailable. */ }
})();
