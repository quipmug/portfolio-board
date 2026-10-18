(() => {
  try {
    const shell = document.querySelector(".site-shell");
    const header = document.querySelector(".site-header");
    if (!shell || !header || !window.matchMedia || !window.fetch) return;
    const desktop = window.matchMedia("(min-width: 1100px) and (hover: hover) and (pointer: fine)");
    const touch = window.matchMedia("(any-pointer: coarse)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const url = new URL("./art/satellite.json?v=orbit-8", document.currentScript.src);
    const route = [[.25,.2], [.8,.45], [.4,.9], [.9,.7], [.15,.5]];
    let art, node, craft, controller, events, resizeObserver, modalObserver;
    let bounds, pointer, drag, frame = 0, last = 0, timer = 0, generation = 0;
    let dirty = true, active = true, hovered = false, focused = false, suppressClick = false;
    let x = 0, y = 0, vx = 0, vy = 0, roll = 0, targetX = 0, targetY = 0, next = 0, waypoint = 0;
    let painted = "", paintedRoll = "";
    const eligible = () => desktop.matches && !touch.matches;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const half = value => Math.round(value * 2) / 2;

    function stopSignal() {
      window.clearTimeout(timer);
      timer = 0;
      node?.classList.remove("is-sending");
    }

    function send() {
      if (!node || node.hidden || reduced.matches || document.hidden || !active) return;
      if (timer) {
        const animations = node.getAnimations?.({ subtree: true }).filter(animation => animation.animationName?.startsWith("satellite-")) || [];
        if (animations.length) animations.forEach(animation => { animation.currentTime = 0; });
        else {
          stopSignal();
          node.getAnimations?.({ subtree: true });
          node.classList.add("is-sending");
        }
      } else node.classList.add("is-sending");
      window.clearTimeout(timer);
      timer = window.setTimeout(stopSignal, 1900);
    }

    function cancelDrag() {
      const id = drag?.id;
      drag = null;
      node?.classList.remove("is-dragging");
      if (id !== undefined && node?.hasPointerCapture?.(id)) {
        try { node.releasePointerCapture(id); } catch { /* Capture may already be released. */ }
      }
    }

    function pause() {
      window.cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      vx = vy = 0;
      stopSignal();
      cancelDrag();
    }

    function paint() {
      if (!node || !craft || !bounds) return;
      const transform = `translate3d(${half(x)}px,${half(y)}px,0)`;
      const angle = `rotate(${Math.round(roll * 10) / 10}deg)`;
      if (transform !== painted) { node.style.transform = transform; painted = transform; }
      if (angle !== paintedRoll) { craft.style.transform = angle; paintedRoll = angle; }
    }

    function chooseTarget(now) {
      const point = route[waypoint++ % route.length];
      targetX = bounds.left + (bounds.right - bounds.left) * point[0];
      targetY = bounds.top + (bounds.bottom - bounds.top) * point[1];
      next = now + 15000;
    }

    function measure() {
      dirty = false;
      if (!node) return;
      node.hidden = false;
      const width = document.documentElement.clientWidth;
      const height = document.documentElement.clientHeight;
      const footprint = node.getBoundingClientRect();
      const size = Math.ceil(Math.max(footprint.width, footprint.height));
      const column = shell.getBoundingClientRect();
      const top = Math.ceil(clamp(header.getBoundingClientRect().top, 24, 72));
      const left = Math.ceil(column.right + 24);
      const right = Math.min(Math.floor(width - size - 24), left + 160);
      const bottom = Math.min(Math.floor(height - size - 24), top + 240);
      const zoomed = window.visualViewport && Math.abs(window.visualViewport.scale - 1) > .01;
      const blocked = Boolean(document.querySelector("dialog[open]"));
      if (right < left || bottom < top || zoomed || blocked || !eligible()) {
        node.hidden = true;
        bounds = null;
        pause();
        return;
      }
      const first = !bounds;
      bounds = { left, right, top, bottom, size };
      x = clamp(first ? left + 16 : x, left, right);
      y = clamp(first ? top + 8 : y, top, bottom);
      targetX = clamp(targetX, left, right);
      targetY = clamp(targetY, top, bottom);
      next = 0;
      node.hidden = false;
      paint();
    }

    function schedule() {
      if (node && !frame && !document.hidden && active && (dirty || (!node.hidden && !reduced.matches))) frame = window.requestAnimationFrame(move);
    }

    function move(now) {
      frame = 0;
      if (!node || !eligible() || document.hidden || !active) { last = 0; return; }
      if (dirty) measure();
      if (!bounds || node.hidden) { last = 0; return; }
      if (reduced.matches) { roll = 0; vx = vy = 0; paint(); last = 0; return; }
      if (last && now - last < 32) { schedule(); return; }
      const dt = last ? Math.min((now - last) / 1000, .05) : 0;
      last = now;
      const distance = pointer ? Math.hypot(Math.max(x - pointer.x, 0, pointer.x - x - bounds.size),
        Math.max(y - pointer.y, 0, pointer.y - y - bounds.size)) : Infinity;
      const held = hovered || focused || drag || distance < 38 || bounds.right - bounds.left + bounds.bottom - bounds.top < 2;
      if (drag) {
        x = clamp(drag.x + pointer.x - drag.startX, bounds.left, bounds.right);
        y = clamp(drag.y + pointer.y - drag.startY, bounds.top, bounds.bottom);
      } else if (!held) {
        if (now >= next || Math.hypot(targetX - x, targetY - y) < 3) chooseTarget(now);
        const dx = targetX - x, dy = targetY - y, length = Math.hypot(dx, dy);
        const speed = Math.min(14, length * .6);
        const blend = 1 - Math.exp(-dt * 3);
        vx += (length ? dx / length * speed - vx : -vx) * blend;
        vy += (length ? dy / length * speed - vy : -vy) * blend;
        x = clamp(x + vx * dt, bounds.left, bounds.right);
        y = clamp(y + vy * dt, bounds.top, bounds.bottom);
      } else vx = vy = 0;
      const targetRoll = pointer && distance < 150
        ? clamp((pointer.x - x - bounds.size / 2) / bounds.size * 7, -4, 4)
        : clamp(vx * .2, -3, 3);
      roll += (targetRoll - roll) * (1 - Math.exp(-dt * 7));
      paint();
      if (!held || Math.abs(targetRoll - roll) > .03) schedule();
      else last = 0;
    }

    function relayout() { dirty = true; last = 0; schedule(); }

    function reframe() {
      dirty = true;
      last = 0;
      if (node && active && !document.hidden) measure();
      schedule();
    }

    function remove() {
      generation += 1;
      controller?.abort();
      controller = null;
      pause();
      events?.abort();
      resizeObserver?.disconnect();
      modalObserver?.disconnect();
      if (node === document.activeElement && !document.hidden) header.focus({ preventScroll: true });
      node?.remove();
      node = craft = bounds = pointer = null;
      hovered = focused = suppressClick = false;
      dirty = true;
      painted = paintedRoll = "";
    }

    function mount() {
      if (node || !eligible() || !art) return;
      node = document.createElement("button");
      node.type = "button";
      node.className = "ascii-satellite";
      node.hidden = true;
      node.setAttribute("aria-label", "Send a satellite signal");
      node.title = "Send a signal, or drag to explore";
      craft = document.createElement("span");
      craft.className = "ascii-craft";
      craft.setAttribute("aria-hidden", "true");
      for (const name of ["body", "near", "far"]) {
        const layer = document.createElement("pre");
        layer.className = name === "body" ? "ascii-body" : `ascii-signal ascii-signal-${name}`;
        layer.textContent = art[name];
        craft.append(layer);
      }
      node.append(craft);
      document.body.append(node);
      events = new AbortController();
      const on = (target, type, handler, options = {}) => target.addEventListener(type, handler, { ...options, signal: events.signal });
      on(node, "pointerenter", () => { hovered = true; send(); schedule(); });
      on(node, "pointerleave", () => { hovered = false; schedule(); });
      on(node, "focus", () => { focused = node.matches(":focus-visible"); send(); schedule(); });
      on(node, "blur", () => { focused = false; schedule(); });
      on(node, "keydown", () => { focused = true; schedule(); });
      on(node, "click", event => {
        if (suppressClick) { suppressClick = false; event.preventDefault(); return; }
        send();
      });
      on(node, "animationend", event => { if (event.animationName === "satellite-drift") stopSignal(); });
      on(node, "pointerdown", event => {
        if (event.button !== 0 || !event.isPrimary || reduced.matches || !bounds) return;
        focused = false;
        suppressClick = false;
        pointer = { x: event.clientX, y: event.clientY };
        drag = { id: event.pointerId, x, y, startX: pointer.x, startY: pointer.y, moved: false };
        node.classList.add("is-dragging");
        try { node.setPointerCapture(event.pointerId); } catch { /* Document listeners still track release. */ }
        schedule();
      });
      on(document, "pointermove", event => {
        if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
        pointer = { x: event.clientX, y: event.clientY };
        if (drag && event.pointerId === drag.id && Math.hypot(pointer.x - drag.startX, pointer.y - drag.startY) > 4) drag.moved = true;
        schedule();
      }, { passive: true });
      on(document, "pointerup", event => {
        if (event.pointerId !== drag?.id) return;
        pointer = { x: event.clientX, y: event.clientY };
        if (bounds) {
          x = clamp(drag.x + pointer.x - drag.startX, bounds.left, bounds.right);
          y = clamp(drag.y + pointer.y - drag.startY, bounds.top, bounds.bottom);
          paint();
        }
        suppressClick = drag.moved;
        cancelDrag();
        hovered = pointer.x >= x && pointer.x <= x + (bounds?.size || 0) && pointer.y >= y && pointer.y <= y + (bounds?.size || 0);
        send();
        next = 0;
        schedule();
      });
      on(document, "pointercancel", event => { if (event.pointerId === drag?.id) { cancelDrag(); schedule(); } });
      on(node, "lostpointercapture", () => { if (drag) { cancelDrag(); schedule(); } });
      on(node, "dragstart", event => event.preventDefault());
      on(document, "pointerout", event => { if (!event.relatedTarget && !drag) { pointer = null; hovered = false; schedule(); } });
      on(window, "resize", reframe, { passive: true });
      on(document, "scroll", relayout, { passive: true, capture: true });
      if (window.visualViewport) {
        on(window.visualViewport, "resize", reframe, { passive: true });
        on(window.visualViewport, "scroll", relayout, { passive: true });
      }
      if ("ResizeObserver" in window) { resizeObserver = new ResizeObserver(reframe); resizeObserver.observe(shell); }
      modalObserver = new MutationObserver(reframe);
      modalObserver.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] });
      measure();
      schedule();
      send();
    }

    async function sync() {
      if (!eligible()) { remove(); return; }
      if (art) { mount(); relayout(); return; }
      if (controller) return;
      const run = ++generation;
      const request = new AbortController();
      controller = request;
      try {
        const response = await fetch(url, { signal: request.signal });
        if (!response.ok) return;
        const data = await response.json();
        if (!["body", "near", "far"].every(name => typeof data[name] === "string"
          && data[name].split("\n").length === 16 && data[name].split("\n").every(line => line.length === 28)
          && /^[\x20-\x7e\n]{1,512}$/.test(data[name]))) return;
        if (run !== generation || !eligible()) return;
        art = data;
        mount();
      } catch { /* A decorative asset never blocks the portfolio. */ }
      finally { if (controller === request) controller = null; }
    }

    desktop.addEventListener("change", sync);
    touch.addEventListener("change", sync);
    reduced.addEventListener("change", () => { pause(); relayout(); });
    document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); else relayout(); });
    window.addEventListener("blur", () => { active = false; pointer = null; hovered = false; pause(); });
    window.addEventListener("focus", () => { active = true; relayout(); });
    window.addEventListener("pagehide", remove);
    window.addEventListener("pageshow", () => { active = true; sync(); });
    sync();
  } catch { /* Leave the reading column unchanged if decoration is unavailable. */ }
})();
