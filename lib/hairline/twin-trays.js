// App adapter for the approved figure. The shared Hairline kernel stays unchanged.
export function mountTwinTrays(HL, stage, svg) {
  const {
    Cam, facing, fillet, fit, hull, open, poly, proj, rad, ringAt, rrect, run, seg,
    tdone, tset, tval, tween, disposer, mk, place, pointer, register, setReducedMotion,
  } = HL
  const W = 58, H = 42, N = 3, GAP = 16, WH = 14, TK = 1.2
  const REST = [-16, -9, 6], HEIGHT = [3, 8, 2]
  const origins = [[-40, 30], [40, -30]]
  const LR = (p) => p[0][0] <= p[p.length - 1][0] ? p : p.slice().reverse()
  const bag = disposer(), C = Cam(45, 0.5, 1.85)
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
  setReducedMotion(motion.matches)
  fit(C, origins.flatMap(([x, y]) => [
    [x - 5, y - 24, 0], [x + W + 5, y + 42, 0],
    [x - 5, y + 42, 0], [x + W + 5, y - 24, 83],
  ]), 200, 166)
  const P = proj(C), front = facing(C), cards = [], hits = []
  let active = -1, hovered = false, elapsed = 0, autoIndex = 0

  function tray(Q, parent, near) {
    const outer = rrect(-5, -9, W + 5, 42, 6, 6)
    const inner = rrect(-2.5, -6.5, W + 2.5, 39.5, 3.5, 6)
    if (!near) {
      mk("path", { d: poly(hull(ringAt(Q, outer, 0).concat(ringAt(Q, outer, WH)))), class: "sil" }, parent)
      mk("path", { d: poly(ringAt(Q, inner, WH)), class: "nf" }, parent)
      mk("path", { d: open(ringAt(Q, run(inner, (q) => !front(q)), 2)), class: "nf lo" }, parent)
      return
    }
    const inside = LR(ringAt(Q, run(inner, front), WH))
    const top = LR(ringAt(Q, run(outer, front), WH)), base = LR(ringAt(Q, run(outer, front), 0))
    mk("path", { d: poly([...inside, top[top.length - 1], ...base.slice().reverse(), top[0]]), class: "fo" }, parent)
    mk("path", { d: open(top), class: "nf lo" }, parent)
    mk("path", { d: open(inside), class: "nf" }, parent)
    mk("path", { d: open([top[0], ...base, top[top.length - 1]]), class: "nf sil" }, parent)
    const pull = rrect(W / 2 - 9, 4, W / 2 + 9, 9, 2.5, 6)
    mk("path", { d: poly(pull.map((q) => Q(q.u, 42, q.v))), class: "nf lo" }, parent)
  }

  origins.forEach(([ox, oy], side) => {
    const Q = (x, y, z) => P(x + ox, y + oy, z), g = mk("g", {}, svg)
    tray(Q, g, false)
    for (let i = 0; i < N; i++) {
      const x = 5 + i * 16, group = mk("g", {}, g)
      const shape = fillet([[0, 0], [W, 0], [W, H], [x + 14, H], [x + 14, H + 6],
        [x, H + 6], [x, H], [0, H]], [1.5, 1.5, 3, 1.5, 2, 2, 1.5, 3])
      const back = mk("path", { class: "lo" }, group), face = mk("path", { class: "sil" }, group)
      const ruling = mk("path", { class: "nf lo" }, group)
      const dots = Array.from({ length: i + 1 }, () => mk("circle", { r: 0.9, class: "dot" }, group))
      cards.push({ i, side, Q, shape, back, face, ruling, dots,
        a: tween(REST[i]), z: tween(HEIGHT[i]), last: "" })
      hits.push({ i, center: Q(W / 2, i * GAP + H * Math.sin(rad(REST[i])), H * Math.cos(rad(REST[i])) + HEIGHT[i]) })
    }
    tray(Q, g, true)
  })

  function draw(cd, angle, lift) {
    const key = `${angle},${lift}`
    if (key === cd.last) return
    cd.last = key
    const s = Math.sin(rad(angle)), c = Math.cos(rad(angle))
    const point = (u, v) => cd.Q(u, cd.i * GAP + v * s, v * c + lift)
    const back = (u, v) => cd.Q(u, cd.i * GAP + v * s - TK * c, v * c + TK * s + lift)
    cd.back.setAttribute("d", poly(cd.shape.map(([u, v]) => back(u, v))))
    cd.face.setAttribute("d", poly(cd.shape.map(([u, v]) => point(u, v))))
    cd.ruling.setAttribute("d", [H - 9, H - 17, H - 25].map((v, k) => seg(point(7, v), point(W - 7 - k * 5, v))).join(""))
    cd.dots.forEach((dot, k) => place(dot, point(12 + cd.i * 16 + (k - cd.i / 2) * 3, H + 3)))
  }

  function choose(next, now) {
    if (next === active) return
    const from = next < 0 ? active : next
    active = next
    cards.forEach((cd) => {
      const delay = Math.abs(cd.i - from) * 40
      const angle = active < 0 ? REST[cd.i] : cd.i === active ? 0 : cd.i < active ? -24 : 19
      const lift = active < 0 ? HEIGHT[cd.i] : HEIGHT[cd.i] + (cd.i === active ? 19 : 2)
      tset(cd.a, angle, now, delay)
      tset(cd.z, lift, now, delay)
      // One outlined accent; the matching tray gets just the tiny tab punches.
      cd.face.classList.toggle("hi", cd.side === 0 && cd.i === (active < 0 ? 1 : active))
      cd.ruling.classList.toggle("hi", cd.i === (active < 0 ? 1 : active))
      cd.dots.forEach((dot) => dot.classList.toggle("accent", cd.i === (active < 0 ? 1 : active)))
    })
  }

  const loop = register(stage, (dt, now) => {
    if (document.hidden) return false
    if (!motion.matches && !hovered) {
      elapsed += dt
      if (elapsed >= 2.8) {
        elapsed = 0
        autoIndex = (autoIndex + 1) % N
        choose(autoIndex, now)
      } else if (elapsed >= 1.65) choose(-1, now)
    }
    let moving = false
    cards.forEach((cd) => {
      draw(cd, tval(cd.a, now), tval(cd.z, now))
      if (!tdone(cd.a, now) || !tdone(cd.z, now)) moving = true
    })
    return moving || (!motion.matches && !hovered)
  })
  bag.add(loop.unregister)

  function hit([x, y]) {
    let best = -1, score = Infinity
    hits.forEach((h) => {
      const dx = x - h.center[0], dy = y - h.center[1]
      const along = (dx + 2 * dy) / (1.85 * Math.SQRT2), across = Math.abs(dy - dx * 0.5)
      if (Math.abs(along) <= W / 2 + 5 && across < 24 && across < score) {
        best = h.i; score = across
      }
    })
    return best
  }

  function interact(point) {
    const next = hit(point)
    hovered = next >= 0
    if (!hovered) elapsed = 1.65
    choose(next, performance.now())
    loop.wake()
  }
  bag.add(pointer(stage, { move: interact, down: interact, leave: () => {
    hovered = false; elapsed = 1.65
    choose(-1, performance.now())
    loop.wake()
  } }))
  const onMotion = () => {
    setReducedMotion(motion.matches)
    hovered = false; elapsed = 1.65
    choose(-1, performance.now())
    loop.wake()
  }
  const onVisible = () => { if (!document.hidden) loop.wake() }
  motion.addEventListener("change", onMotion)
  document.addEventListener("visibilitychange", onVisible)
  bag.add(() => motion.removeEventListener("change", onMotion))
  bag.add(() => document.removeEventListener("visibilitychange", onVisible))
  bag.add(() => svg.replaceChildren())
  cards.forEach((cd) => draw(cd, REST[cd.i], HEIGHT[cd.i]))
  active = -2
  choose(-1, performance.now())
  elapsed = 2
  loop.wake()
  return bag.dispose
}
