(() => {
  try {
    const shell = document.querySelector(".site-shell");
    const header = document.querySelector(".site-header");
    const flight = window.portfolioFlight;
    if (!shell || !header || !flight || !window.matchMedia || !window.fetch) return;
    const desktop = window.matchMedia("(min-width: 1100px) and (hover: hover) and (pointer: fine)");
    const touch = window.matchMedia("(any-pointer: coarse)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const url = new URL("./art/satellite.json?v=freeflight-9", document.currentScript.src);
    const obstacleSelector = ".site-header, .hero, .archive-navigation, .section-header, .post-item, .empty-state, .board-controls, .detail, .site-footer, dialog[open]";
    let art, node, craft, request, events, resizeObserver, mutations, map, path, pointer, drag;
    let frame = 0, last = 0, signalTimer = 0, generation = 0, index = 1;
    let x = 0, y = 0, halfWidth = 0, halfHeight = 0, speed = 0, roll = 0, tossX = 0, tossY = 0;
    let dirty = true, active = true, hovered = false, focused = false, placed = false, signature = "", scrollY = 0;
    let suppressedUntil = 0, painted = "", paintedRoll = "";
    const eligible = () => desktop.matches && !touch.matches;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const position = () => ({ x, y });
    const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

    function stopSignal() {
      window.clearTimeout(signalTimer);
      signalTimer = 0;
      node?.classList.remove("is-sending");
    }

    function send() {
      if (!node || node.hidden || reduced.matches || document.hidden || !active) return;
      const animations = signalTimer ? node.getAnimations?.({ subtree: true })
        .filter(animation => animation.animationName?.startsWith("satellite-")) || [] : [];
      if (animations.length) animations.forEach(animation => { animation.currentTime = 0; });
      else {
        stopSignal();
        node.getAnimations?.({ subtree: true });
        node.classList.add("is-sending");
      }
      window.clearTimeout(signalTimer);
      signalTimer = window.setTimeout(stopSignal, 1900);
    }

    function cancelDrag() {
      const id = drag?.id;
      drag = null;
      node?.classList.remove("is-dragging");
      if (id !== undefined && node?.hasPointerCapture?.(id)) {
        try { node.releasePointerCapture(id); } catch { /* The browser may already have released capture. */ }
      }
    }

    function pause() {
      window.cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      speed = tossX = tossY = 0;
      stopSignal();
      cancelDrag();
    }

    function paint() {
      if (!node || !craft || !map) return;
      const transform = `translate3d(${x - halfWidth}px,${y - halfHeight}px,0)`;
      const angle = `rotate(${roll}deg)`;
      if (painted !== transform) { node.style.transform = transform; painted = transform; }
      if (paintedRoll !== angle) { craft.style.transform = angle; paintedRoll = angle; }
    }

    function measure() {
      dirty = false;
      if (!node) return;
      node.hidden = false;
      const width = document.documentElement.clientWidth, height = document.documentElement.clientHeight;
      const box = node.getBoundingClientRect();
      halfWidth = box.width / 2;
      halfHeight = box.height / 2;
      const rects = Array.from(document.querySelectorAll(obstacleSelector)).filter(element =>
        element.getClientRects().length && !element.closest("[hidden], .panel-ghost")
      ).map(element => element.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0
        && rect.right > 0 && rect.left < width && rect.bottom > 0 && rect.top < height);
      const stamp = [width, height, halfWidth, halfHeight, ...rects.flatMap(rect =>
        [rect.left, rect.top, rect.right, rect.bottom].map(value => Math.round(value)))].join(",");
      const zoomed = window.visualViewport && Math.abs(window.visualViewport.scale - 1) > .01;
      if (zoomed || !eligible()) { node.hidden = true; map = null; pause(); return; }
      if (map && stamp === signature) { paint(); return; }
      signature = stamp;
      const nextMap = flight.createMap(width, height, halfWidth, halfHeight, rects, 14);
      const delta = window.scrollY - scrollY;
      scrollY = window.scrollY;
      const initial = { x: shell.getBoundingClientRect().right + halfWidth + 24,
        y: header.getBoundingClientRect().top + halfHeight + 8 };
      const previous = placed ? { x, y: y - delta } : initial;
      const safe = flight.nearest(previous, nextMap);
      if (!safe) { node.hidden = true; map = null; pause(); return; }
      map = nextMap;
      const relocated = !placed || distance(safe, previous) > .01;
      x = safe.x;
      y = safe.y;
      placed = true;
      if (relocated) { speed = tossX = tossY = 0; }
      if (drag && pointer) { drag.x = x; drag.y = y; drag.startX = pointer.x; drag.startY = pointer.y; }
      if (path) {
        const rest = [position(), ...path.slice(index)];
        if (!rest.every((point, i) => !i || flight.clear(rest[i - 1], point, map))) path = null;
      }
      node.hidden = false;
      paint();
    }

    function plan() {
      const points = flight.plan(position(), map);
      path = points?.length > 1 ? flight.smooth(points, map) : null;
      index = 1;
      if (!path || path.length < 2) { path = null; speed = 0; return false; }
      for (let i = 1; i < path.length - 1; i++) {
        const a = path[i - 1], b = path[i], c = path[i + 1];
        const angle = Math.abs(Math.atan2((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x),
          (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y)));
        const radius = angle > .00001 ? (distance(a, b) + distance(b, c)) / (4 * Math.sin(angle / 2)) : Infinity;
        b.cap = angle > .3 ? 4 : Math.sqrt(36 * radius);
      }
      path[path.length - 1].cap = 0;
      return true;
    }

    function advance(amount) {
      const start = position();
      while (amount > 0 && path && index < path.length) {
        const target = path[index], length = distance(position(), target);
        const step = Math.min(amount, length);
        const next = length < .0001 ? target : { x: x + (target.x - x) * step / length, y: y + (target.y - y) * step / length };
        if (!flight.clear(start, next, map)) break;
        x = next.x;
        y = next.y;
        amount -= step;
        if (step >= length - .0001) index += 1;
        else break;
      }
      if (path && index >= path.length) { path = null; speed = 0; }
    }

    function slide(wanted) {
      const current = position();
      const target = { x: clamp(wanted.x, map.bounds.left, map.bounds.right), y: clamp(wanted.y, map.bounds.top, map.bounds.bottom) };
      if (flight.clear(current, target, map)) return target;
      let low = 0, high = 1;
      for (let i = 0; i < 18; i++) {
        const t = (low + high) / 2;
        if (flight.clear(current, { x: x + (target.x - x) * t, y: y + (target.y - y) * t }, map)) low = t;
        else high = t;
      }
      const stopped = { x: x + (target.x - x) * Math.max(0, low - .001), y: y + (target.y - y) * Math.max(0, low - .001) };
      const candidates = [stopped, { x: target.x, y: stopped.y }, { x: stopped.x, y: target.y }]
        .filter(point => flight.clear(current, point, map));
      return candidates.sort((a, b) => distance(a, target) - distance(b, target))[0] || current;
    }

    function schedule() {
      if (node && !frame && active && !document.hidden && (dirty || (!node.hidden && !reduced.matches))) frame = window.requestAnimationFrame(move);
    }

    function move(now) {
      frame = 0;
      if (!node || !eligible() || !active || document.hidden) { last = 0; return; }
      if (dirty) measure();
      if (!map || node.hidden) { last = 0; return; }
      if (reduced.matches) { speed = tossX = tossY = roll = 0; paint(); last = 0; return; }
      const dt = last ? clamp((now - last) / 1000, 0, .05) : 0;
      last = now;
      const before = position();
      const proximity = pointer ? Math.hypot(Math.max(Math.abs(pointer.x - x) - halfWidth, 0),
        Math.max(Math.abs(pointer.y - y) - halfHeight, 0)) : Infinity;
      const parked = hovered || focused;
      if (focused) tossX = tossY = 0;
      if (drag && pointer) {
        const next = slide({ x: drag.x + pointer.x - drag.startX, y: drag.y + pointer.y - drag.startY });
        x = next.x;
        y = next.y;
        if (dt > 0 && distance(before, next) > .01) {
          drag.vx = clamp((x - before.x) / dt, -120, 120);
          drag.vy = clamp((y - before.y) / dt, -120, 120);
          drag.changed = now;
        }
      } else if (!focused && Math.hypot(tossX, tossY) > 2) {
        const wanted = { x: x + tossX * dt, y: y + tossY * dt }, next = slide(wanted);
        if (distance(next, wanted) > .1) tossX = tossY = 0;
        else { tossX *= Math.exp(-dt * 5); tossY *= Math.exp(-dt * 5); }
        x = next.x;
        y = next.y;
      } else {
        if (!path && !parked) plan();
        let targetSpeed = parked || !path ? 0 : 34 * (proximity < 100 ? .35 + .65 * proximity / 100 : 1);
        if (path) {
          let ahead = distance(position(), path[index]);
          for (let i = index; i < path.length && ahead < 130; i++) {
            targetSpeed = Math.min(targetSpeed, Math.sqrt((path[i].cap ?? Infinity) ** 2 + 140 * ahead));
            if (i + 1 < path.length) ahead += distance(path[i], path[i + 1]);
          }
        }
        speed += clamp(targetSpeed - speed, -85 * dt, 34 * dt);
        if (path && speed > .001) advance(speed * dt);
      }
      const vx = dt > 0 ? (x - before.x) / dt : 0;
      const targetRoll = pointer && proximity < 150 ? clamp((pointer.x - x) / (halfWidth * 2) * 6, -5, 5) : clamp(vx * .1, -4, 4);
      roll += (targetRoll - roll) * (1 - Math.exp(-dt * 8));
      paint();
      if (drag || (!parked && path) || Math.hypot(tossX, tossY) > 2 || speed > .01 || Math.abs(targetRoll - roll) > .005) schedule();
      else last = 0;
    }

    function relayout() { dirty = true; schedule(); }
    function reframe() { dirty = true; if (node && !document.hidden) measure(); last = 0; schedule(); }

    function remove() {
      generation += 1;
      request?.abort();
      request = null;
      pause();
      events?.abort();
      resizeObserver?.disconnect();
      mutations?.disconnect();
      if (node === document.activeElement && !document.hidden) header.focus({ preventScroll: true });
      node?.remove();
      node = craft = map = pointer = path = null;
      hovered = focused = placed = false;
      dirty = true;
      signature = painted = paintedRoll = "";
    }

    function mount() {
      if (node || !eligible() || !art) return;
      node = document.createElement("button");
      node.type = "button";
      node.className = "ascii-satellite";
      node.hidden = true;
      node.setAttribute("aria-label", "Send a satellite signal");
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
      on(node, "keydown", event => { if (!event.metaKey && !event.ctrlKey && !event.altKey) { focused = true; schedule(); } });
      on(node, "click", event => {
        if (event.detail > 0 && performance.now() < suppressedUntil) { suppressedUntil = 0; event.preventDefault(); return; }
        send();
      });
      on(node, "animationend", event => { if (event.animationName === "satellite-drift") stopSignal(); });
      on(node, "pointerdown", event => {
        if (event.button !== 0 || !event.isPrimary || reduced.matches || !map) return;
        focused = false;
        suppressedUntil = 0;
        speed = tossX = tossY = 0;
        path = null;
        pointer = { x: event.clientX, y: event.clientY };
        drag = { id: event.pointerId, x, y, startX: pointer.x, startY: pointer.y, vx: 0, vy: 0, changed: 0, moved: false };
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
        if (map) {
          const next = slide({ x: drag.x + pointer.x - drag.startX, y: drag.y + pointer.y - drag.startY });
          x = next.x;
          y = next.y;
          paint();
        }
        const moved = drag.moved;
        if (moved) {
          suppressedUntil = performance.now() + 350;
          if (performance.now() - drag.changed < 100) { tossX = drag.vx * .45; tossY = drag.vy * .45; }
        }
        cancelDrag();
        hovered = Math.abs(pointer.x - x) <= halfWidth && Math.abs(pointer.y - y) <= halfHeight;
        if (moved) send();
        schedule();
      });
      on(document, "pointercancel", event => { if (event.pointerId === drag?.id) { cancelDrag(); path = null; schedule(); } });
      on(node, "lostpointercapture", () => { if (drag) { cancelDrag(); path = null; schedule(); } });
      on(node, "dragstart", event => event.preventDefault());
      on(document, "pointerout", event => { if (!event.relatedTarget && !drag) { pointer = null; hovered = false; schedule(); } });
      on(window, "resize", reframe, { passive: true });
      on(document, "scroll", relayout, { passive: true, capture: true });
      on(document, "animationend", event => { if (!node.contains(event.target)) relayout(); });
      if (window.visualViewport) {
        on(window.visualViewport, "resize", reframe, { passive: true });
        on(window.visualViewport, "scroll", relayout, { passive: true });
      }
      if ("ResizeObserver" in window) {
        resizeObserver = new ResizeObserver(reframe);
        [shell, header, ...document.querySelectorAll(".hero, .archive-layout, .site-footer, dialog")]
          .forEach(element => resizeObserver.observe(element));
      }
      if (document.fonts) {
        document.fonts.ready.then(() => { if (node) reframe(); });
        on(document.fonts, "loadingdone", reframe);
      }
      mutations = new MutationObserver(records => { if (records.some(record => !node.contains(record.target))) relayout(); });
      mutations.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden", "open"] });
      measure();
      schedule();
      send();
    }

    async function sync() {
      if (!eligible()) { remove(); return; }
      if (art) { mount(); relayout(); return; }
      if (request) return;
      const run = ++generation, controller = new AbortController();
      request = controller;
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json();
        if (!["body", "near", "far"].every(name => typeof data[name] === "string" && data[name].split("\n").length === 16
          && data[name].split("\n").every(line => line.length === 28) && /^[\x20-\x7e\n]{1,512}$/.test(data[name]))) return;
        if (run !== generation || !eligible()) return;
        art = data;
        mount();
      } catch { /* Decoration never blocks portfolio content or owner operations. */ }
      finally { if (request === controller) request = null; }
    }

    desktop.addEventListener("change", sync);
    touch.addEventListener("change", sync);
    reduced.addEventListener("change", () => { pause(); relayout(); });
    document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); else relayout(); });
    window.addEventListener("blur", () => { active = false; pointer = null; hovered = false; pause(); });
    window.addEventListener("focus", () => { active = true; last = 0; relayout(); });
    window.addEventListener("pagehide", remove);
    window.addEventListener("pageshow", () => { active = true; sync(); });
    sync();
  } catch { /* Keep the page usable if this optional enhancement is unavailable. */ }
})();
