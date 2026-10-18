(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.portfolioFlight = api;
})(typeof window === "object" ? window : globalThis, function () {
  "use strict";

  const EPSILON = 1e-7;
  const cache = new WeakMap();
  const finite = value => typeof value === "number" && Number.isFinite(value);
  const point = value => Boolean(value && finite(value.x) && finite(value.y));
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const copy = value => ({ x: value.x, y: value.y });
  const valid = map => Boolean(map && map.bounds && Array.isArray(map.obstacles)
    && [map.bounds.left, map.bounds.top, map.bounds.right, map.bounds.bottom].every(finite)
    && map.bounds.right >= map.bounds.left && map.bounds.bottom >= map.bounds.top
    && map.obstacles.every(rect => rect && [rect.left, rect.top, rect.right, rect.bottom].every(finite)
      && rect.right > rect.left && rect.bottom > rect.top));

  function createMap(width, height, halfWidth, halfHeight, rects, clearance = 14) {
    const empty = { bounds: { left: 0, top: 0, right: -1, bottom: -1 }, obstacles: [] };
    if (![width, height, halfWidth, halfHeight, clearance].every(finite)
      || width <= 0 || height <= 0 || halfWidth < 0 || halfHeight < 0 || clearance < 0) return empty;
    const paddingX = halfWidth + clearance, paddingY = halfHeight + clearance;
    const bounds = { left: paddingX, top: paddingY, right: width - paddingX, bottom: height - paddingY };
    const map = { bounds, obstacles: [] };
    if (!valid(map)) return empty;
    for (const rect of Array.isArray(rects) ? rects : []) {
      if (!rect) continue;
      const left = finite(rect.left) ? rect.left : rect.x;
      const top = finite(rect.top) ? rect.top : rect.y;
      const right = finite(rect.right) ? rect.right : left + rect.width;
      const bottom = finite(rect.bottom) ? rect.bottom : top + rect.height;
      if (![left, top, right, bottom].every(finite) || right <= left || bottom <= top) continue;
      const obstacle = { left: left - paddingX, top: top - paddingY, right: right + paddingX, bottom: bottom + paddingY };
      if (!Object.values(obstacle).every(finite) || obstacle.right <= bounds.left || obstacle.left >= bounds.right
        || obstacle.bottom <= bounds.top || obstacle.top >= bounds.bottom) continue;
      map.obstacles.push(obstacle);
    }
    // Only exact rectangular unions are merged; an L-shaped union keeps its free corner.
    for (let changed = true; changed;) {
      changed = false;
      outer: for (let i = 0; i < map.obstacles.length; i += 1) {
        const a = map.obstacles[i];
        for (let j = i + 1; j < map.obstacles.length; j += 1) {
          const b = map.obstacles[j];
          const contains = (one, other) => one.left <= other.left && one.top <= other.top
            && one.right >= other.right && one.bottom >= other.bottom;
          const horizontal = a.top === b.top && a.bottom === b.bottom && a.right >= b.left && b.right >= a.left;
          const vertical = a.left === b.left && a.right === b.right && a.bottom >= b.top && b.bottom >= a.top;
          if (!contains(a, b) && !contains(b, a) && !horizontal && !vertical) continue;
          map.obstacles[i] = { left: Math.min(a.left, b.left), top: Math.min(a.top, b.top),
            right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) };
          map.obstacles.splice(j, 1);
          changed = true;
          break outer;
        }
      }
    }
    return map;
  }

  function safe(value, map) {
    if (!point(value) || !valid(map)) return false;
    const b = map.bounds;
    if (value.x < b.left - EPSILON || value.x > b.right + EPSILON
      || value.y < b.top - EPSILON || value.y > b.bottom + EPSILON) return false;
    return !map.obstacles.some(rect => value.x > rect.left + EPSILON && value.x < rect.right - EPSILON
      && value.y > rect.top + EPSILON && value.y < rect.bottom - EPSILON);
  }

  function clear(a, b, map) {
    if (!safe(a, map) || !safe(b, map)) return false;
    const dx = b.x - a.x, dy = b.y - a.y;
    for (const rect of map.obstacles) {
      let enter = 0, leave = 1, misses = false;
      for (const [origin, delta, low, high] of [[a.x, dx, rect.left, rect.right], [a.y, dy, rect.top, rect.bottom]]) {
        if (Math.abs(delta) < EPSILON) {
          if (origin <= low + EPSILON || origin >= high - EPSILON) { misses = true; break; }
        } else {
          const first = (low + EPSILON - origin) / delta, second = (high - EPSILON - origin) / delta;
          enter = Math.max(enter, Math.min(first, second));
          leave = Math.min(leave, Math.max(first, second));
          if (leave <= enter) { misses = true; break; }
        }
      }
      if (!misses && leave - enter > EPSILON) return false;
    }
    return true;
  }

  function nearest(value, map) {
    if (!point(value) || !valid(map)) return null;
    const b = map.bounds;
    const origin = { x: clamp(value.x, b.left, b.right), y: clamp(value.y, b.top, b.bottom) };
    if (safe(origin, map)) return origin;
    const xs = new Set([origin.x, b.left, b.right]), ys = new Set([origin.y, b.top, b.bottom]);
    for (const rect of map.obstacles) {
      xs.add(clamp(rect.left, b.left, b.right)); xs.add(clamp(rect.right, b.left, b.right));
      ys.add(clamp(rect.top, b.top, b.bottom)); ys.add(clamp(rect.bottom, b.top, b.bottom));
    }
    let best = null, length = Infinity;
    for (const x of xs) for (const y of ys) {
      const candidate = { x, y }, gap = distance(candidate, value);
      if (gap < length && safe(candidate, map)) { best = candidate; length = gap; }
    }
    return best;
  }

  function geometry(map) {
    if (cache.has(map)) return cache.get(map);
    const nodes = [], keys = new Set();
    function add(x, y, penalty = 0) {
      const value = { x, y }, key = `${x},${y}`;
      if (!keys.has(key) && safe(value, map)) { keys.add(key); nodes.push({ ...value, penalty }); }
    }
    const b = map.bounds;
    for (const x of [b.left, b.right]) for (const y of [b.top, b.bottom]) add(x, y);
    for (const rect of map.obstacles) {
      // Wider bends provide room for fillets; tight corners preserve narrow passages.
      for (const [offset, penalty] of [[16, 0], [4, 10], [.25, 28]]) {
        for (const x of [rect.left - offset, rect.right + offset]) {
          for (const y of [rect.top - offset, rect.bottom + offset]) add(x, y, penalty);
        }
      }
    }
    const edges = nodes.map(() => []);
    for (let i = 0; i < nodes.length; i += 1) for (let j = i + 1; j < nodes.length; j += 1) {
      if (!clear(nodes[i], nodes[j], map)) continue;
      const length = distance(nodes[i], nodes[j]);
      edges[i].push([j, length]); edges[j].push([i, length]);
    }
    const graph = { nodes, edges };
    cache.set(map, graph);
    return graph;
  }

  function plan(start, map, random = Math.random) {
    if (!safe(start, map)) return [];
    const graph = geometry(map), nodes = graph.nodes;
    const lengths = nodes.map(value => clear(start, value, map) ? distance(start, value) + value.penalty : Infinity);
    const previous = nodes.map(() => -1), visited = new Set();
    for (let count = 0; count < nodes.length; count += 1) {
      let current = -1, best = Infinity;
      for (let i = 0; i < nodes.length; i += 1) {
        if (!visited.has(i) && lengths[i] < best) { current = i; best = lengths[i]; }
      }
      if (current < 0) break;
      visited.add(current);
      for (const [neighbor, length] of graph.edges[current]) {
        const proposed = best + length + nodes[neighbor].penalty;
        if (proposed < lengths[neighbor]) { lengths[neighbor] = proposed; previous[neighbor] = current; }
      }
    }
    function connection(target) {
      if (!safe(target, map)) return null;
      let cost = clear(start, target, map) ? distance(start, target) : Infinity, via = -1;
      for (let i = 0; i < nodes.length; i += 1) {
        const next = lengths[i] + distance(nodes[i], target);
        if (next < cost && clear(nodes[i], target, map)) { cost = next; via = i; }
      }
      return finite(cost) ? { target, via } : null;
    }
    function sample() {
      let value = .5;
      try { value = typeof random === "function" ? random() : .5; } catch { /* A faulty random source stays deterministic. */ }
      return finite(value) ? clamp(value, 0, 1 - Number.EPSILON) : .5;
    }
    const b = map.bounds;
    let choice = null, separation = 0;
    for (let count = 0; count < 48; count += 1) {
      const target = { x: b.left + sample() * (b.right - b.left), y: b.top + sample() * (b.bottom - b.top) };
      const gap = distance(start, target);
      if (gap <= Math.max(2, separation)) continue;
      const route = connection(target);
      if (!route) continue;
      choice = route; separation = gap;
      if (gap >= 120) break;
    }
    if (separation < 120) {
      for (let i = 0; i < nodes.length; i += 1) {
        const gap = distance(start, nodes[i]);
        if (finite(lengths[i]) && gap > Math.max(2, separation)) {
          choice = { target: nodes[i], via: i }; separation = gap;
        }
      }
    }
    if (!choice) return [copy(start)];
    const reverse = [copy(choice.target)];
    let current = choice.via;
    for (let count = 0; current >= 0 && count <= nodes.length; count += 1) {
      const value = nodes[current];
      if (distance(value, reverse[reverse.length - 1]) > EPSILON) reverse.push(copy(value));
      current = previous[current];
    }
    reverse.push(copy(start));
    const route = reverse.reverse(), simplified = [route[0]];
    for (let from = 0; from < route.length - 1;) {
      let to = route.length - 1;
      while (to > from + 1 && !clear(route[from], route[to], map)) to -= 1;
      simplified.push(route[to]); from = to;
    }
    return simplified;
  }

  function smooth(points, map) {
    if (!Array.isArray(points) || !points.length || !valid(map)) return [];
    const route = [];
    for (const value of points) {
      if (!safe(value, map)) return [];
      if (!route.length || distance(value, route[route.length - 1]) > EPSILON) route.push(copy(value));
    }
    if (route.some((value, index) => index && !clear(route[index - 1], value, map))) return [];
    if (route.length < 3) return route;
    const result = [route[0]];
    for (let i = 1; i < route.length - 1; i += 1) {
      const a = route[i - 1], b = route[i], c = route[i + 1];
      const incoming = distance(a, b), outgoing = distance(b, c);
      const ua = { x: (a.x - b.x) / incoming, y: (a.y - b.y) / incoming };
      const uc = { x: (c.x - b.x) / outgoing, y: (c.y - b.y) / outgoing };
      let bend = null, radius = Math.min(28, incoming * .28, outgoing * .28);
      for (let attempt = 0; attempt < 7 && radius >= .25; attempt += 1, radius /= 2) {
        const entry = { x: b.x + ua.x * radius, y: b.y + ua.y * radius };
        const exit = { x: b.x + uc.x * radius, y: b.y + uc.y * radius };
        // Subpixel chords prevent visible heading steps on high-refresh displays.
        const candidate = [entry], steps = Math.min(1024, Math.max(24, Math.ceil(radius * 8)));
        for (let step = 1; step <= steps; step += 1) {
          const t = step / steps, u = 1 - t;
          candidate.push({ x: u * u * entry.x + 2 * u * t * b.x + t * t * exit.x,
            y: u * u * entry.y + 2 * u * t * b.y + t * t * exit.y });
        }
        let previous = result[result.length - 1];
        if (candidate.every(value => { const allowed = clear(previous, value, map); previous = value; return allowed; })
          && clear(candidate[candidate.length - 1], c, map)) { bend = candidate; break; }
      }
      if (bend) result.push(...bend); else result.push(b);
    }
    result.push(route[route.length - 1]);
    return result;
  }

  return { createMap, safe, clear, nearest, plan, smooth };
});
