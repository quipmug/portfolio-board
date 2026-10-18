(() => {
  try {
    const shell = document.querySelector(".site-shell");
    const header = document.querySelector(".site-header");
    const flight = window.portfolioFlight;
    if (!shell || !header || !flight || !window.matchMedia || !window.fetch) return;
    const desktop = window.matchMedia("(hover: hover) and (pointer: fine)");
    const touch = window.matchMedia("(any-pointer: coarse)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const url = new URL("./art/satellite.json?v=compact-flight-11", document.currentScript.src);
    const obstacleSelector = ".site-header, .hero, .archive-navigation, .section-header, .post-item, .empty-state, .board-controls, .detail, .site-footer, dialog[open]";
    let art, node, craft, exhaust, request, events, resizeObserver, mutations, map, path, pointer, drag;
    let frame = 0, last = 0, signalTimer = 0, generation = 0, index = 1;
    let x = 0, y = 0, halfWidth = 0, halfHeight = 0, speed = 0, roll = 0, tossX = 0, tossY = 0;
    let dirty = true, active = true, focused = false, placed = false, signature = "", scrollY = 0;
    let suppressedUntil = 0, painted = "", paintedRoll = "";
    let jets = [], reaction = null, nextBurst = 0, strength = 0, normalX = 0, normalY = 0;
    let bank = 0, thrustX = 0, thrustY = 0;
    let nextEncounter = 0, yieldAfter = 0;
    const variants = { content: "", edge: "" };
    const eligible = () => desktop.matches && !touch.matches;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const position = () => ({ x, y });
    const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

    function resetContact() {
      reaction = null;
      nextBurst = strength = normalX = normalY = bank = thrustX = thrustY = 0;
      jets.forEach(jet => { jet.live = false; jet.element.style.opacity = "0"; });
    }

    function burst(hit, now) {
      if (!jets.length) return;
      const edge = hit.kind === "edge";
      const scale = halfWidth / 76.5;
      const glyphs = edge ? ["-", "=", "~", "--", "-~", "~-"] : [".", ":", "+", "*", ".:", ":.", ".."];
      const count = (edge ? 2 : 3) + Math.floor(Math.random() * 3);
      const letters = Array.from({ length: count }, () => glyphs[Math.floor(Math.random() * glyphs.length)]);
      if (letters.join("|") === variants[hit.kind]) letters[0] = glyphs[(glyphs.indexOf(letters[0]) + 1) % glyphs.length];
      variants[hit.kind] = letters.join("|");
      const dx = -hit.normal.x, dy = -hit.normal.y, tx = -dy, ty = dx;
      letters.forEach(glyph => {
        const jet = jets.find(value => !value.live) || jets.reduce((a, b) => a.start < b.start ? a : b);
        const spread = (Math.random() - .5) * (edge ? 18 : 10);
        jet.live = true;
        jet.start = now + Math.random() * (edge ? 65 : 40);
        jet.life = edge ? 330 + Math.random() * 140 : 180 + Math.random() * 110;
        jet.x = halfWidth + (dx * 17 + tx * spread) * scale;
        jet.y = halfHeight + (16 + dy * 17 + ty * spread) * scale;
        jet.vx = (dx * (edge ? 17 : 26) + tx * (Math.random() - .5) * 12) * scale;
        jet.vy = (dy * (edge ? 17 : 26) + ty * (Math.random() - .5) * 12) * scale;
        jet.angle = edge ? Math.atan2(dy, dx) * 180 / Math.PI : (Math.random() - .5) * 18;
        jet.opacity = (edge ? .6 : .75) + hit.strength * .2;
        jet.element.className = `ascii-exhaust-glyph ascii-exhaust-${hit.kind}`;
        jet.element.textContent = glyph;
        jet.element.style.opacity = "0";
      });
      nextBurst = now + (edge ? 410 + Math.random() * 180 : 210 + Math.random() * 140);
    }

    function react(hit, now) {
      if (!hit || reduced.matches || !exhaust) return;
      reaction = { ...hit, until: now + 140 };
      if (hit.strength > .04 && now >= nextBurst) burst(hit, now);
    }

    function updateContact(now, dt) {
      const live = reaction && now <= reaction.until;
      const target = live ? reaction.strength : 0;
      strength += (target - strength) * (1 - Math.exp(-dt * (live ? 15 : 11)));
      if (!live && strength < .003) strength = 0;
      if (live) {
        const blend = 1 - Math.exp(-dt * 14);
        normalX += (reaction.normal.x - normalX) * blend;
        normalY += (reaction.normal.y - normalY) * blend;
      }
      const edge = reaction?.kind === "edge";
      const tilt = normalX * (edge ? 6 : 4) + normalY * (edge ? 2 : 1);
      bank = tilt * strength;
      thrustX = normalX * strength * 1.8;
      thrustY = normalY * strength * 1.8;
      let alive = strength > .003;
      jets.forEach(jet => {
        if (!jet.live) return;
        const age = now - jet.start, progress = age / jet.life;
        if (progress >= 1) { jet.live = false; jet.element.style.opacity = "0"; return; }
        alive = true;
        if (age < 0) return;
        const seconds = age / 1000;
        jet.element.style.transform = `translate3d(${jet.x + jet.vx * seconds}px,${jet.y + jet.vy * seconds}px,0) rotate(${jet.angle}deg)`;
        jet.element.style.opacity = String(Math.sin(Math.PI * progress) ** .65 * jet.opacity);
      });
      return alive;
    }

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
      nextEncounter = yieldAfter = 0;
      stopSignal();
      resetContact();
      cancelDrag();
      paint();
    }

    function paint() {
      if (!node || !craft || !map) return;
      const transform = `translate3d(${x - halfWidth}px,${y - halfHeight}px,0)`;
      const angle = `translate3d(${thrustX}px,${thrustY}px,0) rotate(${clamp(roll + bank, -9, 9)}deg)`;
      if (painted !== transform) { node.style.transform = transform; painted = transform; }
      if (paintedRoll !== angle) { craft.style.transform = angle; paintedRoll = angle; }
    }

    function measure() {
      dirty = false;
      if (!node) return;
      node.hidden = false;
      const width = document.documentElement.clientWidth, height = document.documentElement.clientHeight;
      const box = node.getBoundingClientRect();
      const resized = halfWidth !== box.width / 2 || halfHeight !== box.height / 2;
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
      if (relocated || resized) { speed = tossX = tossY = 0; resetContact(); }
      if (drag && pointer) { drag.x = x; drag.y = y; drag.startX = pointer.x; drag.startY = pointer.y; }
      if (path) {
        const rest = [position(), ...path.slice(index)];
        if (!rest.every((point, i) => !i || flight.clear(rest[i - 1], point, map))) path = null;
      }
      node.hidden = false;
      paint();
    }

    function follow(points) {
      const next = points?.length > 1 ? flight.smooth(points, map) : null;
      if (!next || next.length < 2) return false;
      path = next;
      index = 1;
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

    function plan() {
      if (follow(flight.plan(position(), map))) return true;
      path = null;
      speed = 0;
      return false;
    }

    function skirtPointer(now) {
      if (!pointer || !path || now < nextEncounter || now < yieldAfter) return;
      const gap = distance(position(), pointer);
      if (gap > halfWidth + 68) return;
      let join = index, ahead = distance(position(), path[join]);
      while (join + 1 < path.length && ahead < 110) {
        ahead += distance(path[join], path[join + 1]);
        join += 1;
      }
      const goal = path[join], length = distance(position(), goal);
      const heading = path[index], headingLength = distance(position(), heading);
      if (length < 55 || headingLength < .001) return;
      const ux = (heading.x - x) / headingLength, uy = (heading.y - y) / headingLength;
      if ((pointer.x - x) * ux + (pointer.y - y) * uy < -halfWidth * .35) return;
      const cross = ux * (pointer.y - y) - uy * (pointer.x - x);
      const side = Math.abs(cross) > 2 ? -Math.sign(cross) : (Math.random() < .5 ? -1 : 1);
      nextEncounter = now + 1600;
      const lead = { x: x + ux * 18, y: y + uy * 18 };
      if (!flight.clear(position(), lead, map)) return;
      for (const turn of [side, -side]) for (const offset of [48, 30, 18]) {
        const lateral = offset * Math.min(1, halfWidth / 60);
        const along = Math.min(65, length * .55);
        const bend = { x: x + ux * along - uy * lateral * turn,
          y: y + uy * along + ux * lateral * turn };
        if (!flight.clear(lead, bend, map) || !flight.clear(bend, goal, map)) continue;
        if (follow([position(), lead, bend, goal, ...path.slice(join + 1)])) { send(); return; }
      }
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

    function dragStep(now, dt) {
      if (!drag || !pointer || !map) return;
      const before = position();
      const wanted = { x: drag.x + pointer.x - drag.startX, y: drag.y + pointer.y - drag.startY };
      const target = slide(wanted);
      const blocked = distance(target, wanted) > .5;
      const hit = flight.contact(before, { x: wanted.x - x, y: wanted.y - y }, map, 34)
        || (blocked ? flight.contact(target, { x: wanted.x - target.x, y: wanted.y - target.y }, map, 34) : null);
      react(hit, now);
      const dx = target.x - x, dy = target.y - y;
      const along = 1 - Math.exp(-dt * 40), across = 1 - Math.exp(-dt * (blocked || hit ? 14 : 40));
      const normal = hit?.normal || { x: 0, y: 0 };
      const push = dx * normal.x + dy * normal.y;
      const next = slide({ x: x + dx * along + normal.x * push * (across - along),
        y: y + dy * along + normal.y * push * (across - along) });
      x = next.x;
      y = next.y;
      if (dt > 0 && distance(before, next) > .01) {
        drag.vx = clamp((x - before.x) / dt, -120, 120);
        drag.vy = clamp((y - before.y) / dt, -120, 120);
        drag.changed = now;
      }
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
      const parked = focused;
      if (focused) tossX = tossY = 0;
      if (drag && pointer) {
        dragStep(now, dt);
      } else if (!focused && Math.hypot(tossX, tossY) > 2) {
        let hit = flight.contact(position(), { x: tossX, y: tossY }, map, 34);
        react(hit, now);
        if (hit) {
          const incoming = Math.min(0, tossX * hit.normal.x + tossY * hit.normal.y);
          const brake = 1 - Math.exp(-dt * (hit.kind === "edge" ? 12 : 20) * hit.strength);
          tossX -= hit.normal.x * incoming * brake;
          tossY -= hit.normal.y * incoming * brake;
        }
        const wanted = { x: x + tossX * dt, y: y + tossY * dt }, next = slide(wanted);
        if (distance(next, wanted) > .1) {
          hit ||= flight.contact(next, { x: wanted.x - next.x, y: wanted.y - next.y }, map, 34);
          if (hit) {
            react(hit, now);
            const incoming = Math.min(0, tossX * hit.normal.x + tossY * hit.normal.y);
            tossX -= hit.normal.x * incoming;
            tossY -= hit.normal.y * incoming;
          } else tossX = tossY = 0;
        }
        tossX *= Math.exp(-dt * 5);
        tossY *= Math.exp(-dt * 5);
        x = next.x;
        y = next.y;
      } else {
        if (!path && !parked) plan();
        if (!parked) skirtPointer(now);
        let targetSpeed = parked || !path ? 0 : 34 * (proximity < 100 ? .65 + .35 * proximity / 100 : 1);
        if (path) {
          let ahead = distance(position(), path[index]);
          for (let i = index; i < path.length && ahead < 130; i++) {
            targetSpeed = Math.min(targetSpeed, Math.sqrt((path[i].cap ?? Infinity) ** 2 + 140 * ahead));
            if (i + 1 < path.length) ahead += distance(path[i], path[i + 1]);
          }
        }
        speed += clamp(targetSpeed - speed, -85 * dt, 34 * dt);
        if (path && speed > .001) {
          if (speed > 3) react(flight.contact(position(), { x: path[index].x - x, y: path[index].y - y }, map, 28), now);
          advance(speed * dt);
        }
      }
      const vx = dt > 0 ? (x - before.x) / dt : 0;
      const targetRoll = pointer && proximity < 150 ? clamp((pointer.x - x) / (halfWidth * 2) * 6, -5, 5) : clamp(vx * .1, -4, 4);
      roll += (targetRoll - roll) * (1 - Math.exp(-dt * 8));
      const contactAlive = updateContact(now, dt);
      paint();
      if (contactAlive || drag || (!parked && path) || Math.hypot(tossX, tossY) > 2 || speed > .01 || Math.abs(targetRoll - roll) > .005) schedule();
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
      node = craft = exhaust = map = pointer = path = null;
      jets = [];
      focused = placed = false;
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
      exhaust = document.createElement("span");
      exhaust.className = "ascii-exhaust";
      exhaust.setAttribute("aria-hidden", "true");
      jets = Array.from({ length: 12 }, () => {
        const element = document.createElement("span");
        element.className = "ascii-exhaust-glyph";
        exhaust.append(element);
        return { element, live: false, start: 0 };
      });
      node.append(exhaust);
      document.body.append(node);
      events = new AbortController();
      const on = (target, type, handler, options = {}) => target.addEventListener(type, handler, { ...options, signal: events.signal });
      on(node, "pointerenter", () => { yieldAfter = performance.now() + 180; send(); schedule(); });
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
        const now = performance.now();
        dragStep(now, clamp((now - last) / 1000 || 1 / 60, 1 / 240, .025));
        paint();
        const moved = drag.moved;
        if (moved) {
          suppressedUntil = performance.now() + 350;
          if (now - drag.changed < 100) { tossX = drag.vx * .45; tossY = drag.vy * .45; }
          if (reaction && now < reaction.until && reaction.strength > .1) {
            const incoming = Math.min(0, tossX * reaction.normal.x + tossY * reaction.normal.y);
            const retreat = reaction.kind === "edge" ? 8 : 14;
            tossX += reaction.normal.x * (retreat * reaction.strength - incoming);
            tossY += reaction.normal.y * (retreat * reaction.strength - incoming);
          }
        }
        cancelDrag();
        if (moved) send();
        schedule();
      });
      on(document, "pointercancel", event => { if (event.pointerId === drag?.id) { cancelDrag(); path = null; schedule(); } });
      on(node, "lostpointercapture", () => { if (drag) { cancelDrag(); path = null; schedule(); } });
      on(node, "dragstart", event => event.preventDefault());
      on(document, "pointerout", event => { if (!event.relatedTarget && !drag) { pointer = null; schedule(); } });
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
    window.addEventListener("blur", () => { active = false; pointer = null; pause(); });
    window.addEventListener("focus", () => { active = true; last = 0; relayout(); });
    window.addEventListener("pagehide", remove);
    window.addEventListener("pageshow", () => { active = true; sync(); });
    sync();
  } catch { /* Keep the page usable if this optional enhancement is unavailable. */ }
})();
