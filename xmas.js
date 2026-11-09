/* CHRISTMAS SNOW. Loaded by gate.js only when window.ACE_XMAS is true.

   Two things, both drawn on fixed canvases that ignore the pointer:
   1. Snowfall over the page: soft flakes in a few sizes, drifting on a slow wind.
   2. A snowbank along the bottom edge, where Little Ace walks (his floor is the bottom
      of the viewport): a back bank behind him and a thin front lip that hides the soles
      of his shoes, so he looks like he is wading. White, smooth, slightly lumpy, with a
      fuzzy top edge, soft blue-grey shading under the lumps and a few sparkles.

   Stacking (companion.css): his shadow 79, him 80, the launcher 85, chat 105+. So the
   back bank is 78, the front lip 82 and the falling snow 83. Reduced motion: the bank is
   drawn but nothing falls. */
(() => {
  'use strict';
  if (!window.ACE_XMAS) return;
  const calm = matchMedia('(prefers-reduced-motion: reduce)');

  const rng = (seed) => () => {            // small seeded generator: the bank looks the same on every load and resize
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const mk = (z, css) => {
    const c = document.createElement('canvas');
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText = 'position:fixed;left:0;pointer-events:none;z-index:' + z + ';' + css;
    return c;
  };

  /* ── how much snow there is ─────────────────────────────────────
     Very little snow at load, piling up: amt() runs from 0.07 to 1 over PILE_S seconds (two and a half minutes). The bank, the caps
     on ledges and how many flakes fall read it.
     The icicles grow on their own, faster curve: iceAmt() starts at half length (about what they reached after two
     minutes before) and is full length after ICE_S seconds (half of PILE_S, so 75 seconds).
     window.AceSnow.skip(seconds) jumps ahead (for testing). */
  const PILE_S = window.ACE_PILE_SECONDS || 150;
  const ICE_S = PILE_S / 2, ICE_START = 0.5;
  /* The pile belongs to the visit, not to one page: when it started is kept in sessionStorage, so clicking through to
     another page carries on from where the snow had got to instead of starting again from nothing. The chat's
     Christmas switch clears it, so turning Christmas on starts a fresh pile. */
  const SKEY = 'ace-xmas-t0';
  let t0 = Date.now();
  try { const s = Number(sessionStorage.getItem(SKEY)); if (s > 0 && s <= t0) t0 = s; else sessionStorage.setItem(SKEY, String(t0)); } catch (e) {}
  const secsRaw = () => (Date.now() - t0) / 1000;
  /* THE BLIZZARD (the chat's blizzard button, Christmas mode only): for about 12 seconds the snow falls several times
     faster and thicker and swirls, a pale haze rolls over the page, and the pile is driven up to full (the bank, the
     caps and the icicles all reach maximum over BZ_RAMP_MS). When it reaches full, 'ace:snowfull' is fired: companion.js
     leaves Little Ace stuck in the snow. The new start time is kept, so the full pile carries across pages. */
  const BZ_RAMP_MS = 8000, BZ_UP_MS = 1500, BZ_DOWN_MS = 3000, BZ_TOTAL_MS = 12000;
  let bz = null;
  const secs = () => {
    if (bz && !bz.rampDone) {
      const u = Math.min(1, (performance.now() - bz.start) / BZ_RAMP_MS), e = u * u * (3 - 2 * u);
      return bz.from + (PILE_S - bz.from) * e;
    }
    return secsRaw();
  };
  const amt = () => 0.07 + 0.93 * Math.min(1, secs() / PILE_S);
  const iceAmt = () => ICE_START + (1 - ICE_START) * Math.min(1, secs() / ICE_S);
  window.AceSnow = { blizzard: () => startBlizzard(), amount: amt, ice: iceAmt, skip: (s) => { t0 -= s * 1000; try { sessionStorage.setItem(SKEY, String(t0)); } catch (e) {} } };

  /* ── the snowbank ──────────────────────────────────────────── */
  const back = mk(78, 'bottom:0;width:100vw;height:64px');
  const front = mk(82, 'bottom:0;width:100vw;height:32px');

  function profile(w, base, amp, seed) {
    const r = rng(seed), lumps = [];
    for (let x = -40; x < w + 80; x += 28 + r() * 70) lumps.push({ x, a: 3 + r() * amp, s: 22 + r() * 40 });
    const top = new Float32Array(Math.ceil(w) + 1);
    for (let x = 0; x <= w; x++) {
      let h = base + 3.2 * Math.sin(x / 83 + 1.3) + 2.2 * Math.sin(x / 29 + 0.4);
      for (const l of lumps) { const d = (x - l.x) / l.s; if (d > -3 && d < 3) h += l.a * Math.exp(-d * d); }
      top[x] = h;
    }
    return top;
  }

  function drawBank(cv, hCss, top, opts) {
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = innerWidth;
    cv.width = Math.round(w * dpr); cv.height = Math.round(hCss * dpr);
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, hCss);
    const yAt = (x) => hCss - top[Math.max(0, Math.min(top.length - 1, Math.round(x)))];
    // body of the snow
    const g = c.createLinearGradient(0, hCss - opts.max, 0, hCss);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, opts.mid); g.addColorStop(1, opts.low);
    c.fillStyle = g;
    c.beginPath(); c.moveTo(0, hCss);
    for (let x = 0; x <= w; x += 2) c.lineTo(x, yAt(x));
    c.lineTo(w, hCss); c.closePath(); c.fill();
    // volume: a soft blue-grey shadow under each lump, clipped to the snow
    c.save(); c.clip();
    const r = rng(opts.seed + 7);
    for (let x = 10; x < w; x += 22 + r() * 46) {
      const y = yAt(x) + 9 + r() * 6, rx = 22 + r() * 26, ry = 7 + r() * 5;
      const sg = c.createRadialGradient(x + 8, y, 0, x + 8, y, rx);
      sg.addColorStop(0, 'rgba(150,176,208,' + opts.shade + ')'); sg.addColorStop(1, 'rgba(150,176,208,0)');
      c.fillStyle = sg; c.save(); c.translate(0, y); c.scale(1, ry / rx); c.translate(0, -y);
      c.beginPath(); c.arc(x + 8, y, rx, 0, Math.PI * 2); c.fill(); c.restore();
    }
    c.restore();
    // fluffy top: overlapping soft puffs along the edge so it is fuzzy, not a hard line
    for (let x = -6; x < w + 6; x += 6 + r() * 7) {
      const y = yAt(x) + 1.5, pr = 7 + r() * 8;
      const pg = c.createRadialGradient(x, y, 0, x, y, pr);
      pg.addColorStop(0, 'rgba(255,255,255,0.95)'); pg.addColorStop(0.55, 'rgba(255,255,255,0.7)'); pg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = pg; c.beginPath(); c.arc(x, y, pr, 0, Math.PI * 2); c.fill();
    }
    // a few sparkles
    if (opts.sparkles) {
      for (let i = 0; i < w / 70; i++) {
        const x = r() * w, y = yAt(x) + 3 + r() * 14, sr = 1.1 + r() * 1.4;
        const sg = c.createRadialGradient(x, y, 0, x, y, sr * 3);
        sg.addColorStop(0, 'rgba(255,255,255,1)'); sg.addColorStop(0.3, 'rgba(255,255,255,0.8)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = sg; c.beginPath(); c.arc(x, y, sr * 3, 0, Math.PI * 2); c.fill();
      }
    }
  }

  /* The bank is drawn ONCE, at full height, and then slid up out of the bottom edge of the window by however much it has
     grown (a transform, set every frame). Growth is then perfectly smooth at any speed. (It used to be redrawn
     whole, a pixel taller at a time, twice a second, which looked jittery, and far worse during a blizzard.)
     Fully piled the back bank tops out at about 100px and the front drift at about 60px (the lumps add ~10px to
     these bases). His feet are 16px above the bottom of the window and he is about 105px tall with his shoulders about
     64px up, so the drift comes to his shoulders and everything from there up shows. (Too-high tries: 110px hid him to
     the face; about 70px started to cover his shoulders.) */
  const bankDims = (a) => {
    const k = (innerWidth < 600 ? 0.8 : 1) * Math.min(1, innerHeight / 800);   // a short window gets a smaller drift so it never buries the page's buttons
    return { bb: (2 + 94 * a) * k, ba: (1 + 10 * a) * k, fb: (1 + 58 * a) * k, fa: (0.8 + 4 * a) * k };
  };
  /* Where the top of the front drift is now, in px above the bottom of the window (its base plus the lumps, about 10px
     when full). companion.js uses it so Little Ace can be set on top of the snow and his stuck floor rises with it. */
  window.AceSnow.top = () => bankDims(amt()).fb + 10 * ((innerWidth < 600 ? 0.8 : 1) * Math.min(1, innerHeight / 800));
  let bankMax = null;
  function placeBanks(a) {
    if (!bankMax) return;
    const m = bankDims(a);
    back.style.transform = 'translate3d(0,' + (bankMax.bb - m.bb).toFixed(2) + 'px,0)';
    front.style.transform = 'translate3d(0,' + (bankMax.fb - m.fb).toFixed(2) + 'px,0)';
  }
  function drawBanks() {
    const m = bankDims(1), bb = m.bb, ba = m.ba, fb = m.fb, fa = m.fa;
    const bh = Math.ceil(bb + ba * 2.2 + 14), fh = Math.ceil(fb + fa * 2.2 + 10);
    bankMax = { bb, fb };
    back.style.height = bh + 'px'; front.style.height = fh + 'px';
    back.style.willChange = front.style.willChange = 'transform';
    back.style.width = front.style.width = innerWidth + 'px';
    const bt = profile(innerWidth, bb, ba, 11);
    const ft = profile(innerWidth, fb, fa, 23);
    drawBank(back, bh, bt, { max: bh, mid: '#f3f7fc', low: '#dbe6f3', shade: 0.30, seed: 5, sparkles: true });
    drawBank(front, fh, ft, { max: fh, mid: '#fbfdff', low: '#e6eef8', shade: 0.22, seed: 9, sparkles: false });
    placeBanks(amt());
  }

  /* ── the snowfall ──────────────────────────────────────────── */
  const fall = mk(83, 'top:0;width:100vw;height:100vh');
  const fc = fall.getContext('2d');
  const SIZES = [1.1, 1.7, 2.5, 3.5];
  const sprites = SIZES.map((r) => {
    const s = Math.ceil(r * 6), cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const c = cv.getContext('2d'), m = s / 2;
    let g = c.createRadialGradient(m, m, 0, m, m, m);       // faint blue-grey halo so flakes still show on pale cards
    g.addColorStop(0, 'rgba(170,190,215,0.32)'); g.addColorStop(1, 'rgba(170,190,215,0)');
    c.fillStyle = g; c.beginPath(); c.arc(m, m, m, 0, Math.PI * 2); c.fill();
    g = c.createRadialGradient(m, m, 0, m, m, r * 1.6);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(m, m, r * 1.6, 0, Math.PI * 2); c.fill();
    return { cv, s };
  });
  let flakes = [], W = 0, H = 0, dprF = 1;
  function sizeFall() {
    dprF = Math.min(2, window.devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    fall.style.width = W + 'px'; fall.style.height = H + 'px';
    fall.width = Math.round(W * dprF); fall.height = Math.round(H * dprF);
    fc.setTransform(dprF, 0, 0, dprF, 0, 0);
    const want = Math.round(Math.max(36, Math.min(150, (W * H) / 11000)) * (W < 600 ? 0.6 : 1));
    const r = rng(99);
    while (flakes.length < want) {
      const l = Math.floor(Math.pow(r(), 1.7) * SIZES.length);   // mostly small, a few big
      flakes.push({ x: r() * W, y: r() * H, l, vy: 18 + l * 16 + r() * 14, ph: r() * 6.28, sw: 0.6 + r() * 1.1, am: 8 + l * 5, a: 0.55 + r() * 0.4 });
    }
    flakes.length = want;
  }
  function boost(ms) {                                                  // how hard it is blowing: 0 to 1 and back
    if (!bz) return 0;
    const e = ms - bz.start;
    if (e < 0 || e >= BZ_TOTAL_MS) return 0;
    if (e < BZ_UP_MS) return e / BZ_UP_MS;
    if (e < BZ_TOTAL_MS - BZ_DOWN_MS) return 1;
    return 1 - (e - (BZ_TOTAL_MS - BZ_DOWN_MS)) / BZ_DOWN_MS;
  }
  function finishRamp() {
    if (!bz || bz.rampDone) return;
    bz.rampDone = true;
    t0 = Date.now() - PILE_S * 1000;                                   // full from now on, on every page of the visit
    try { sessionStorage.setItem(SKEY, String(t0)); } catch (e) {}
    try { document.dispatchEvent(new CustomEvent('ace:snowfull')); } catch (e) {}
  }
  function startBlizzard() {
    if (bz && !bz.rampDone) return;                                    // already blowing
    bz = { start: performance.now(), from: secsRaw(), rampDone: false, extra: [] };
    if (calm.matches) { finishRamp(); bz = null; return; }             // reduced motion: no storm, the pile just fills
    const n = Math.round(Math.max(36, Math.min(150, (W * H) / 11000)) * 3.2);
    for (let i = 0; i < n; i++) {
      const l = Math.floor(Math.pow(Math.random(), 1.7) * SIZES.length);
      bz.extra.push({ x: Math.random() * W, y: Math.random() * H, l, vy: 18 + l * 16 + Math.random() * 14, ph: Math.random() * 6.28, sw: 0.6 + Math.random() * 1.1, am: 8 + l * 5, a: 0.55 + Math.random() * 0.4 });
    }
  }
  function drift(f, dt, sk, bzk, wind) {                               // one flake's step, calm or in the storm
    f.y += f.vy * dt * sk;
    f.x += (Math.sin(f.ph + tt * f.sw) * f.am + wind * (0.5 + f.l * 0.25) * (1 + 3 * bzk) + bzk * 240 * Math.sin(tt * 1.6 + f.y * 0.011 + f.ph)) * dt;
    if (f.y > H + 8) { f.y = -8; f.x = Math.random() * W; }
    if (f.x > W + 8) f.x = -8; else if (f.x < -8) f.x = W + 8;
  }
  /* When he is thrown and hits the snow, the drift kicks up a puff of fine snow dust (companion.js calls
     AceSnow.splash with where he landed and how fast). It is many small soft specks and a few hazy clouds with no
     hard edge: they fly a short way, slow down quickly, swell, hang a moment and fade, so it reads as dust, not snowballs. */
  const dustCv = document.createElement('canvas');
  dustCv.width = dustCv.height = 64;
  { const c = dustCv.getContext('2d'), g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(246,249,253,0.75)'); g.addColorStop(0.4, 'rgba(236,242,250,0.4)'); g.addColorStop(1, 'rgba(230,238,248,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64); }
  const puffs = [];
  window.AceSnow.splash = (x, y, speed) => {
    if (calm.matches || amt() < 0.12) return;
    const k = Math.min(1, Math.max(0.3, (speed - 250) / 900)), n = Math.round(34 + 36 * k);
    const sy = H - window.AceSnow.top() + 6;                           // up on the surface of the drift
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, v = (60 + Math.random() * 240) * (0.5 + k);
      puffs.push({ x: x + (Math.random() - 0.5) * 46, y: sy + (Math.random() - 0.5) * 8, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: 0, max: 0.6 + Math.random() * 0.7, sz: 7 + Math.random() * 14, g: 0.8 + Math.random() * 1.4, al: 0.5 + Math.random() * 0.4 });
    }
    for (let i = 0; i < 5; i++) {                                      // a few big hazy clouds that billow where it landed
      puffs.push({ x: x + (Math.random() - 0.5) * 60, y: sy - Math.random() * 10, vx: (Math.random() - 0.5) * 90, vy: -20 - Math.random() * 40,
        life: 0, max: 0.9 + Math.random() * 0.5, sz: 34 + Math.random() * 26, g: 1.5 + Math.random() * 0.8, al: 0.45 });
    }
    if (puffs.length > 220) puffs.splice(0, puffs.length - 220);
  };
  function drawPuffs(dt) {
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i];
      p.life += dt;
      if (p.life >= p.max) { puffs.splice(i, 1); continue; }
      p.vx *= 1 - 2.6 * dt; p.vy = p.vy * (1 - 2.2 * dt) + 55 * dt;   // slows quickly and hangs, then settles slowly
      p.x += p.vx * dt; p.y += p.vy * dt;
      const t = p.life / p.max, z = p.sz * (1 + p.g * t);
      fc.globalAlpha = p.al * (1 - t) * Math.min(1, p.life / 0.05);
      fc.drawImage(dustCv, p.x - z / 2, p.y - z / 2, z, z);
    }
  }
  let hazeEl = null, hazeOn = false;
  let last = 0, tt = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; }
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
    if (calm.matches) { fc.clearRect(0, 0, W, H); return; }
    tt += dt;
    const wind = Math.sin(tt * 0.23) * 14 + 6;
    const nowMs = performance.now(), bzk = boost(nowMs), sk = 1 + 3.6 * bzk;
    if (bz && !bz.rampDone && nowMs - bz.start >= BZ_RAMP_MS) finishRamp();
    fc.clearRect(0, 0, W, H);
    if (hazeEl && (bzk > 0.01 || hazeOn)) {                            // a pale haze that drifts across the page (its own layer: only opacity and position change)
      hazeOn = bzk > 0.01;
      hazeEl.style.opacity = bzk.toFixed(3);
      hazeEl.style.transform = 'translate3d(' + (Math.sin(tt * 0.7) * 6).toFixed(2) + 'vw,' + (Math.cos(tt * 0.5) * 5).toFixed(2) + 'vh,0)';
    }
    const live = Math.max(6, Math.round(flakes.length * (0.12 + 0.88 * amt())));
    for (let fi = 0; fi < live; fi++) {
      const f = flakes[fi];
      drift(f, dt, sk, bzk, wind);
      const sp = sprites[f.l];
      fc.globalAlpha = f.a;
      fc.drawImage(sp.cv, f.x - sp.s / 2, f.y - sp.s / 2);
    }
    if (bz && bz.extra.length) {                                       // the extra storm flakes, thinning out as it eases
      const show = Math.round(bz.extra.length * Math.min(1, bzk * 1.4));
      for (let fi = 0; fi < show; fi++) {
        const f = bz.extra[fi];
        drift(f, dt, sk, bzk, wind);
        const sp = sprites[f.l];
        fc.globalAlpha = f.a;
        fc.drawImage(sp.cv, f.x - sp.s / 2, f.y - sp.s / 2);
      }
      if (bzk === 0 && nowMs - bz.start > BZ_TOTAL_MS) { bz.extra.length = 0; if (bz.rampDone) bz = null; }
    }
    if (puffs.length) drawPuffs(dt);
    fc.globalAlpha = 1;
  }

  /* ── snow on the ledges, icicles under the boxes ───────────────
     companion.js publishes the ledges he can stand on (window.AcePerches). Every top edge in that
     list gets a soft cap of snow; every box and button bottom gets a row of icicles. Both are drawn
     on one fixed canvas (z 78: behind him, behind the header) from small pre-drawn sprites, and the
     element's rectangle is read every frame, so when a card slides in, a button lifts on hover or the
     page scrolls, the snow and the icicles go with it. Elements that are faded out hide theirs too. */
  const ledgeCv = mk(78, 'top:0;width:100vw;height:100vh');
  const lc = ledgeCv.getContext('2d');
  let items = [], LW = 0, LH = 0, dprL = 1, tick = 0;
  const CAP_H = 22;

  function capSprite(w, rad, seed) {
    const r = rng(seed), dpr = dprL, cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.round(CAP_H * dpr);
    const c = cv.getContext('2d'); c.scale(dpr, dpr);
    const x0 = Math.min(rad * 0.3, w / 3), x1 = w - x0, span = x1 - x0;
    const lumps = [];
    for (let x = x0 - 10; x < x1 + 20; x += 16 + r() * 34) lumps.push({ x, a: 1.5 + r() * 3.5, s: 10 + r() * 20 });
    const sym = w < 420;                                                          // buttons: mirrored, so the snow sits dead centre
    const top = (x) => topRaw(sym ? Math.min(x, w - x) : x, x);
    const topRaw = (x, xr) => {
      let h = 4.2 + (sym ? 0 : 1.1 * Math.sin(x / 17 + seed));
      for (const l of lumps) { const d = (x - l.x) / l.s; if (d > -3 && d < 3) h += l.a * Math.exp(-d * d); }
      const e = Math.min(1, (xr - x0) / 16, (x1 - xr) / 16);                      // taper to nothing at the ends
      return 1.3 * h * Math.pow(Math.max(0, e), 0.6);
    };
    const base = CAP_H - 1;
    const g = c.createLinearGradient(0, base - 15, 0, base);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#f6f9fd'); g.addColorStop(1, '#d6e3f2');
    c.fillStyle = g; c.beginPath(); c.moveTo(x0, base);
    for (let x = x0; x <= x1; x += 2) c.lineTo(x, base - top(x));
    c.lineTo(x1, base); c.closePath(); c.fill();
    for (let x = x0; x < x1; x += 4 + r() * 5) {                                // fuzzy edge
      const y = base - top(x) + 1.2, pr = 3 + r() * 3.2, pg = c.createRadialGradient(x, y, 0, x, y, pr);
      pg.addColorStop(0, 'rgba(255,255,255,0.95)'); pg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = pg; c.beginPath(); c.arc(x, y, pr, 0, Math.PI * 2); c.fill();
    }
    if (span > 60) for (let i = 0; i < span / 45; i++) {                         // a few sparkles
      const x = x0 + r() * span, y = base - top(x) * (0.2 + r() * 0.6), sg = c.createRadialGradient(x, y, 0, x, y, 2.6);
      sg.addColorStop(0, 'rgba(255,255,255,1)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = sg; c.beginPath(); c.arc(x, y, 2.6, 0, Math.PI * 2); c.fill();
    }
    return cv;
  }

  function iceSprite(w, h, rad, seed, maxLen) {
    const r = rng(seed), dpr = dprL, Lmax = Math.max(8, Math.min(maxLen, h * 0.5));
    const hh = Math.ceil(Lmax + 4), cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.round(hh * dpr);
    const c = cv.getContext('2d'); c.scale(dpr, dpr);
    const x0 = Math.min(rad * 0.7 + 3, w / 3), x1 = w - x0;
    const meta = [];
    const draw = (x, bw, len) => {
      const tip = x + (r() - 0.5) * 2;
      meta.push({ x, bw, len, tip });
      const g = c.createLinearGradient(x - bw, 0, x + bw, 0);
      g.addColorStop(0, 'rgba(255,255,255,0.92)'); g.addColorStop(0.45, 'rgba(196,228,251,0.82)'); g.addColorStop(1, 'rgba(132,186,234,0.78)');
      c.fillStyle = g; c.beginPath(); c.moveTo(x - bw, 0);
      c.quadraticCurveTo(x - bw * 0.55, len * 0.55, tip, len);
      c.quadraticCurveTo(x + bw * 0.55, len * 0.55, x + bw, 0); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(110,165,218,0.55)'; c.lineWidth = 0.6; c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 0.8;               // glint down the left side
      c.beginPath(); c.moveTo(x - bw * 0.45, 1); c.lineTo(tip - bw * 0.15, len * 0.7); c.stroke();
    };
    for (let x = x0; x < x1; x += 7 + r() * 13) {
      const big = r() < 0.55;
      draw(x, big ? 2.6 + r() * 2.4 : 1.6 + r(), Lmax * (big ? 0.5 + 0.5 * Math.pow(r(), 0.8) : 0.2 + r() * 0.25));
    }
    const s = c.createLinearGradient(0, 0, 0, 3);                               // a lip of frost where they hang
    s.addColorStop(0, 'rgba(255,255,255,0.95)'); s.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = s; c.fillRect(x0 - 2, 0, x1 - x0 + 4, 3);
    cv.meta = meta;
    return cv;
  }

  function effOpacity(el) {
    let o = 1;
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.visibility === 'hidden' || cs.display === 'none') return 0;
      o *= parseFloat(cs.opacity);
      if (o < 0.05) return 0;
    }
    return o;
  }

  function buildItems() {
    const perches = window.AcePerches || [], tops = new Set(), seen = new Map(), list = [];
    for (const p of perches) if (p.edge === 'top') tops.add(p.el);
    /* A grid marked data-xmas-rows (the "Reservoir of Talents" tiles) is dressed by row, found from where the tiles
       really are, so it still works when the grid reflows to fewer columns: the top row is snowed on and has no
       icicles, the bottom row grows long icicles, and any rows between get tiny icicles that never grow. */
    const rowKind = new Map();
    for (const grid of document.querySelectorAll('[data-xmas-rows]')) {
      const tiles = [...grid.children], tops2 = tiles.map(el => Math.round((el.getBoundingClientRect().top + scrollY) / 8));
      const rows = [...new Set(tops2)].sort((a, b) => a - b);
      tiles.forEach((el, i) => { const k = rows.indexOf(tops2[i]); rowKind.set(el, k === 0 ? 'snow' : k === rows.length - 1 ? 'ice-long' : 'ice-small'); });
    }
    for (const p of perches) {
      if (seen.has(p.el)) continue;
      const r = p.el.getBoundingClientRect();
      if (r.width < 90) continue;
      if (p.el.tagName === 'IMG' && p.el.closest('.logos')) continue;               // no snow piles up on the logos themselves
      const cs = getComputedStyle(p.el), rad = parseFloat(cs.borderBottomLeftRadius) || 0;
      /* Only real boxes: text painted with a gradient (the headings) and inline spans are not, and an edge
         counts only if something is drawn along it (a border, or a filled background / picture / control). */
      const text = /text/.test(cs.backgroundClip) || cs.display === 'inline';
      const fill = cs.backgroundImage !== 'none' || !/^rgba\(.*,\s*0\)$|^transparent$/.test(cs.backgroundColor) ||
        /^(IMG|CANVAS|INPUT|TEXTAREA|SELECT)$/.test(p.el.tagName);
      /* Only boxes carry snow and icicles: something filled in, or a button or field. A line (a divider, a row with only
         a border on one side, the rule above a quote's name) is not a box, so it gets neither. */
      const thin = r.height < 6 && !p.el.classList.contains('portrait__walk');         // a hairline drawn with a background is still a line
      const box = !thin && (fill || p.el.matches('.btn,button,input,select,textarea,.copy'));
      const it = { el: p.el, cap: !text && box && tops.has(p.el), ice: !text && box && r.height >= 24,
        rad, w: 0, capS: null, iceS: null, op: 1, n: seen.size + 1 };
      const kind = rowKind.get(p.el);
      if (kind === 'snow') it.ice = false;
      else if (kind) { it.cap = false; it.small = kind === 'ice-small'; }
      if (it.ice) {
        /* Room to hang: the gap to whatever sits underneath (the next ledge, the next sibling, or the end
           of the parent). Icicles are cut to fit, and left off where there is no room, so they never
           land on someone's text. */
        const bot = r.bottom + scrollY, l = r.left, rr = r.right;
        let gap = 30;
        for (const q of perches) if (q.edge === 'top' && q.el !== p.el && q.y - bot > -2 && q.y - bot < gap &&
          Math.min(q.right, rr) - Math.max(q.left, l) > (rr - l) * 0.3) gap = q.y - bot;
        const nx = p.el.nextElementSibling;
        if (nx) { const nr = nx.getBoundingClientRect(); if (nr.height > 0 && nr.top + scrollY - bot > -2) gap = Math.min(gap, nr.top + scrollY - bot); }
        // (the Reservoir grid ends at its last tile, so there the room below is the section's padding, not a limit)
        else if (p.el.parentElement && !p.el.parentElement.hasAttribute('data-xmas-rows')) { const pr = p.el.parentElement.getBoundingClientRect(); if (pr.bottom + scrollY - bot > -2) gap = Math.min(gap, pr.bottom + scrollY - bot); }
        it.maxLen = Math.min(30, gap - 4);
        if (it.maxLen < 9) it.ice = false; else { it.bot = bot; it.l = l; it.rr = rr; if (it.small) it.maxLen = 8; }      // a tiny one stays tiny
      }
      seen.set(p.el, 1);
      if (it.cap || it.ice) list.push(it);
    }
    /* Boxes inside boxes: keep only the outermost, lowest bottom in a stack of nearly-equal bottoms. */
    const iced = list.filter(k => k.ice).sort((a, b) => b.bot - a.bot), kept = [];
    for (const k of iced) {
      if (kept.some(o => Math.abs(o.bot - k.bot) < 45 && Math.min(o.rr, k.rr) - Math.max(o.l, k.l) > Math.min(o.rr - o.l, k.rr - k.l) * 0.5)) k.ice = false;
      else kept.push(k);
    }
    const lau = document.querySelector('.ace-launcher');
    if (lau) list.push({ el: lau, cap: true, ice: false, rad: 6, w: 0, capS: null, iceS: null, op: 1, n: 999 });
    items = list.filter(k => k.cap || k.ice);
  }

  function sizeLedge() {
    dprL = Math.min(2, window.devicePixelRatio || 1); LW = innerWidth; LH = innerHeight;
    ledgeCv.style.width = LW + 'px'; ledgeCv.style.height = LH + 'px';       // px, not vw: 100vw can be narrower than innerWidth and would shrink the drawing
    ledgeCv.width = Math.round(LW * dprL); ledgeCv.height = Math.round(LH * dprL);
    lc.setTransform(dprL, 0, 0, dprL, 0, 0);
    for (const it of items) { it.w = 0; }                                         // sprites are redrawn at the new pixel ratio
  }

  /* ── glint: icicles near the pointer flash, in about the spade flashlight's reach ── */
  const ptr = { x: -999, y: -999, sx: -999, sy: -999, on: false };
  const canGlint = !calm.matches && matchMedia('(hover: hover)').matches;
  if (canGlint) {
    addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      ptr.x = e.clientX; ptr.y = e.clientY;
      if (!ptr.on) { ptr.on = true; ptr.sx = ptr.x; ptr.sy = ptr.y; }
    }, { passive: true });
    document.addEventListener('pointerleave', () => { ptr.on = false; });
  }
  const flashOn = () => !window.AceFlashlight || window.AceFlashlight.isOn();

  const GLINT_MIN = 9;                                       // px: icicles shorter than this (as drawn now) stay dull
  function glint(it, r, vs, now) {
    const R = Math.max(130, Math.min(235, innerWidth * 0.15)) * 0.75 * 0.62;   // the spade's reach is ~0.55 x its radius
    if (r.bottom + 40 < ptr.sy - R || r.bottom - 4 > ptr.sy + R + 40) return;
    const kx = r.width / it.w;
    for (const m of it.iceS.meta) {
      const x = r.left + m.x * kx, tipx = r.left + m.tip * kx, len = m.len * vs, y0 = r.bottom - 1;
      if (len < GLINT_MIN) continue;                                               // the teeny tiny ones do not glint
      const d = Math.hypot(x - ptr.sx, y0 + len * 0.55 - ptr.sy);
      if (d >= R) continue;
      let k = Math.pow(1 - d / R, 1.3);
      k *= 0.72 + 0.28 * Math.sin(now * 0.006 + m.x * 0.9);                      // each one shimmers on its own
      const bw = m.bw * (r.width / it.w);
      lc.fillStyle = 'rgba(255,255,255,' + (0.62 * k).toFixed(3) + ')';          // the whole icicle lights up
      lc.beginPath(); lc.moveTo(x - bw, y0);
      lc.quadraticCurveTo(x - bw * 0.55, y0 + len * 0.55, tipx, y0 + len);
      lc.quadraticCurveTo(x + bw * 0.55, y0 + len * 0.55, x + bw, y0); lc.closePath(); lc.fill();
      const g = lc.createRadialGradient(tipx, y0 + len, 0, tipx, y0 + len, 5 + 9 * k);   // a bloom at the tip
      g.addColorStop(0, 'rgba(235,248,255,' + (0.95 * k).toFixed(3) + ')'); g.addColorStop(1, 'rgba(200,232,255,0)');
      lc.fillStyle = g; lc.beginPath(); lc.arc(tipx, y0 + len, 5 + 9 * k, 0, Math.PI * 2); lc.fill();
      if (k > 0.25) {                                                              // and a four-point flare
        const fl = 3 + 11 * k;
        lc.strokeStyle = 'rgba(255,255,255,' + Math.min(1, k * 1.3).toFixed(3) + ')'; lc.lineWidth = 1;
        lc.beginPath(); lc.moveTo(tipx - fl, y0 + len); lc.lineTo(tipx + fl, y0 + len);
        lc.moveTo(tipx, y0 + len - fl); lc.lineTo(tipx, y0 + len + fl); lc.stroke();
      }
    }
  }

  function ledgeFrame(now) {
    requestAnimationFrame(ledgeFrame);
    if (document.hidden) return;
    lc.clearRect(0, 0, LW, LH); tick++;
    const a = amt(), capH = Math.max(1.5, CAP_H * a), vs = iceAmt();
    const gl = canGlint && ptr.on && flashOn();
    if (gl) { ptr.sx += (ptr.x - ptr.sx) * 0.18; ptr.sy += (ptr.y - ptr.sy) * 0.18; }
    placeBanks(a);
    for (let i = 0; i < items.length; i++) {
      const it = items[i], r = it.el.getBoundingClientRect();
      if (!r || r.width < 1 || r.height < 1 || r.bottom < -40 || r.top > LH + 10) continue;
      if ((i + tick) % 6 === 0) it.op = effOpacity(it.el);
      if (it.op < 0.05) continue;
      if (Math.abs(r.width - it.w) > 6 || !it.w) {
        it.w = r.width;
        it.capS = it.cap ? capSprite(r.width, it.rad, it.n * 7 + 3) : null;
        it.iceS = it.ice ? iceSprite(r.width, r.height, it.rad, it.n * 13 + 5, it.maxLen) : null;
      }
      lc.globalAlpha = it.op;
      if (it.capS) lc.drawImage(it.capS, r.left, r.top - (capH - 1), r.width, capH);
      if (it.iceS) {
        const v = it.small ? 1 : vs;                                               // tiny ones never grow
        lc.drawImage(it.iceS, r.left, r.bottom - 1, r.width, it.iceS.height / dprL * v);
        if (gl) glint(it, r, v, now || 0);
      }
    }
    lc.globalAlpha = 1;
  }

  function startLedges(tries) {
    if (!window.AcePerches) { if (tries < 300) setTimeout(() => startLedges(tries + 1), 100); return; }
    document.body.append(ledgeCv);
    buildItems(); sizeLedge();
    requestAnimationFrame(ledgeFrame);
  }

  function start() {
    hazeEl = document.createElement('div');
    hazeEl.setAttribute('aria-hidden', 'true');
    hazeEl.style.cssText = 'position:fixed;left:-20vw;top:-20vh;width:140vw;height:140vh;pointer-events:none;z-index:83;opacity:0;will-change:opacity,transform;' +
      'background:radial-gradient(closest-side at 50% 50%,rgba(240,246,255,.22),rgba(220,232,250,.07) 70%,rgba(220,232,250,0))';
    document.body.append(back, front, fall, hazeEl);
    drawBanks(); sizeFall();
    startLedges(0);
    let rt = 0;
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { drawBanks(); sizeFall(); if (items.length) { buildItems(); sizeLedge(); } }, 120); });
    requestAnimationFrame(frame);
  }
  if (document.body) start(); else addEventListener('DOMContentLoaded', start);
})();
