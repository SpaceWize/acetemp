// Ember swipe — standalone claw-tear effect (variant B from mockups/claws.html).
// A hot streak cuts first, then impact: flash, shake and an optional glitch hook.
// Four slashes open with charred, glowing edges and code showing through; sparks fly,
// embers drip, and after the slashes heal a glowing seam cools and fades.
//
// Use:   <script src="ember-tear.js"></script>
//        emberTear();                                  // play once
//        emberTear({ shake: document.querySelector('.wrap'), onImpact: myGlitch, onDone: fn, doneAt: 4800 });
// No dependencies. Respects prefers-reduced-motion unless { force: true } is passed.
//
// On this site it is wired to the "Ace endorses, supports and advises" strip on the home page (the bar and the Clawed Club logo in it):
// picking either plays the effect and then opens the Clawed Club site in a new tab (see the end of this file).
// onDone / doneAt (not in the original): onDone runs doneAt ms into the effect (default: when it ends). The site passes 4800, so the tab is
// opened while only the last cooling glow is left, inside the 5 seconds Chrome allows a click to open a tab from a script (the effect
// itself runs 5.2 s). If a browser blocks the tab anyway, a small "Open Clawed Club" button appears instead.
(function () {
  'use strict';

  var CLAW_URL = 'https://space-wize-enterprise.github.io/Clawed-Club/';
  var OPEN_AT = 4800;

  var CODE = [
    '// a gremlin was here..',
    'const club = { name: "Clawd Club", versions: ["minors", "main", "seniors"] };',
    'function apply(member) { return review(member).then(accept); }',
    'if (member.ai.codeCapable) enroll(member);',
    'queue.push({ event: "hackathon", using: "AI", open: true });',
    'while (club.running) { build(); ship(); learn(); }',
    'log("claw marks detected … healing");'
  ];
  function codeLine(n) { return CODE[n % CODE.length] + '   ' + CODE[(n + 3) % CODE.length]; }

  var C = {
    codeBg: '#060504', code: '#E0B878', dim: '#7A6D5E',
    char: '#24180F', charFibre: '#5A3A22',
    ember: '#FF7A2E', emberHot: '#FFD9A0', emberMid: '#FFB054',
    flash: '237,230,223'
  };
  var DURATION = 5200, TEX_EXTRA = 280;

  // ---------- helpers ----------
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function easeOut(x) { return 1 - Math.pow(1 - x, 3); }
  function easeInOut(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }
  function wave(freqs) {
    var parts = freqs.map(function (f) { return { f: f, p: rand(0, Math.PI * 2), a: 1 / f }; });
    var norm = parts.reduce(function (s, p) { return s + p.a; }, 0);
    return function (t) {
      var v = 0;
      for (var i = 0; i < parts.length; i++) v += Math.sin(t * parts[i].f * Math.PI * 2 + parts[i].p) * parts[i].a;
      return v / norm;
    };
  }

  // ---------- canvas ----------
  // Over the whole page, above everything (Little Ace included, which is at z-index 60 and above), and every click goes through it.
  var canvas, ctx, texture, W, H, dpr;
  function setup() {
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:2147483000;pointer-events:none';
      canvas.hidden = true;
      document.body.appendChild(canvas);
      ctx = canvas.getContext('2d');
    }
    var nw = window.innerWidth, nh = window.innerHeight;
    if (nw !== W || nh !== H) texture = null;
    W = nw; H = nh;
    dpr = Math.min(window.devicePixelRatio || 1, W < 700 ? 1.5 : 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    if (!texture && W && H) buildTexture();
  }
  function buildTexture() {
    texture = document.createElement('canvas');
    texture.width = Math.round(W * dpr);
    texture.height = Math.round((H + TEX_EXTRA) * dpr);
    var t = texture.getContext('2d');
    t.scale(dpr, dpr);
    t.fillStyle = C.codeBg; t.fillRect(0, 0, W, H + TEX_EXTRA);
    t.font = '13px "JetBrains Mono", ui-monospace, Consolas, monospace';
    t.textBaseline = 'top';
    for (var n = 0, y = 8; y < H + TEX_EXTRA; n++, y += 22) {
      var line = codeLine(n);
      t.fillStyle = line.indexOf('//') === 0 ? C.dim : C.code;
      t.fillText(line + '   ' + codeLine(n + 3) + '   ' + codeLine(n + 5), 14 - (n * 53) % 120, y);
    }
  }

  // ---------- slash geometry ----------
  function makeSlash(a, width) {
    var N = 120, pts = [];
    var wob = wave([1.3, 2.9]), eR = wave([3, 7, 13]), eL = wave([3, 7, 13]), rR = wave([5, 11, 23]), rL = wave([5, 11, 23]);
    for (var j = 0; j <= N; j++) {
      var t = j / N, u = 1 - t;
      var x = u * u * a[0] + 2 * u * t * a[2] + t * t * a[4];
      var y = u * u * a[1] + 2 * u * t * a[3] + t * t * a[5];
      var dx = 2 * u * (a[2] - a[0]) + 2 * t * (a[4] - a[2]);
      var dy = 2 * u * (a[3] - a[1]) + 2 * t * (a[5] - a[3]);
      var len = Math.hypot(dx, dy) || 1, nx = dy / len, ny = -dx / len;
      var w = wob(t) * 4;
      x += nx * w; y += ny * w;
      var env = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.75)), 0.6);
      pts.push({
        t: t, x: x, y: y, nx: nx, ny: ny, ang: Math.atan2(dy, dx),
        r: env * width * (1 + 0.4 * eR(t)), l: env * width * (1 + 0.4 * eL(t)),
        jr: rand(-1.6, 1.6), jl: rand(-1.6, 1.6),
        rimR: env * 0.6 * (3.5 + 3 * rR(t) + rand(0, 3.2) + (Math.random() < 0.07 ? rand(3, 8) : 0)),
        rimL: env * 0.6 * (3.5 + 3 * rL(t) + rand(0, 3.2) + (Math.random() < 0.07 ? rand(3, 8) : 0))
      });
    }
    var s = { pts: pts, op: new Float32Array(N + 1), hairs: [], front: -1, max: 0 };
    for (var h = 0; h < 30; h++) s.hairs.push({ j: Math.floor(rand(0.06, 0.94) * N), side: Math.random() < 0.5 ? 1 : -1, len: rand(2, 8), a: rand(-0.7, 0.7) });
    return s;
  }
  function at(s, t) { return s.pts[Math.round(clamp(t) * (s.pts.length - 1))]; }
  function edge(p, o, side, rim) {
    var d = side > 0
      ? p.r * o + (o > 0.02 ? p.jr + rim * p.rimR * Math.min(1, o * 2.5) : 0)
      : p.l * o + (o > 0.02 ? p.jl + rim * p.rimL * Math.min(1, o * 2.5) : 0);
    return Math.max(0, d) * side;
  }
  function outline(s, rim) {
    var P = s.pts, j, p, d;
    ctx.beginPath();
    for (j = 0; j < P.length; j++) {
      p = P[j]; d = edge(p, s.op[j], 1, rim);
      if (j) ctx.lineTo(p.x + p.nx * d, p.y + p.ny * d); else ctx.moveTo(p.x + p.nx * d, p.y + p.ny * d);
    }
    for (j = P.length - 1; j >= 0; j--) {
      p = P[j]; d = edge(p, s.op[j], -1, rim);
      ctx.lineTo(p.x + p.nx * d, p.y + p.ny * d);
    }
    ctx.closePath();
  }
  // The rip travels down the slash; healing closes from both ends toward the middle
  function opening(s, ms, c) {
    var front = (ms - c.delay) / c.rip, hp = (ms - c.healAt) / c.heal, max = 0, P = s.pts;
    for (var j = 0; j < P.length; j++) {
      var t = P[j].t;
      var o = easeOut(clamp((front * 1.25 - t) / 0.25));
      var h = easeInOut(clamp(hp * 1.5 - (1 - Math.abs(t - 0.5) * 2) * 0.5));
      s.op[j] = o * (1 - h);
      if (s.op[j] > max) max = s.op[j];
    }
    s.front = front; s.max = max;
  }

  // ---------- sparks ----------
  var sparks = [];
  function stepSparks(dt) {
    for (var i = sparks.length - 1; i >= 0; i--) {
      var q = sparks[i];
      q.life -= dt;
      if (q.life <= 0) { sparks.splice(i, 1); continue; }
      q.vy += q.g * dt;
      q.vx *= 1 - q.drag * dt; q.vy *= 1 - q.drag * dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
    }
  }
  function drawSparks() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (var i = 0; i < sparks.length; i++) {
      var q = sparks[i];
      ctx.globalAlpha = Math.min(1, q.life / q.fade);
      ctx.strokeStyle = q.color; ctx.lineWidth = q.w;
      ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * 0.035, q.y - q.vy * 0.035); ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- the effect ----------
  function build() {
    var b = Math.max(13, Math.min(W, H) * 0.022) * 0.85, sl = [];
    for (var k = 0; k < 4; k++) {
      var x0 = W * (0.6 + k * 0.08), y0 = H * (0.02 + k * 0.03);
      var x1 = W * (0.16 + k * 0.09), y1 = H * (0.88 + k * 0.025);
      var s = makeSlash([x0, y0, (x0 + x1) / 2 + W * 0.09, (y0 + y1) / 2 - H * 0.07, x1, y1], b);
      s.k = k;
      s.c = { delay: 140 + k * 45, rip: 170, healAt: 3100 + k * 120, heal: 1300 };
      sl.push(s);
    }
    return { slashes: sl, hitAt: 140 + 170, hit: false };
  }

  function frame(st, ms, fx) {
    if (!st.hit && ms >= st.hitAt) {
      st.hit = true; fx.flash = 0.32; fx.kick(10, 480);
      if (fx.onImpact) fx.onImpact();
    }
    var heat = st.hit ? 1 - 0.75 * clamp((ms - st.hitAt) / 2600) : 1;   // the glow cools over time

    st.slashes.forEach(function (s) {
      opening(s, ms, s.c);
      var P = s.pts, N = P.length - 1;

      // 1. the streak: a tapered bright trail running ahead of the opening, plus sparks at its tip
      if (s.front > 0 && s.front < 1.5) {
        var tA = Math.max(0, s.front - 0.45), tB = Math.min(1, s.front), fadeOut = clamp(1 - (s.front - 1) / 0.5);
        var jA = Math.floor(tA * N), jB = Math.floor(tB * N);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
        for (var j = jA; j < jB; j++) {
          var f = (P[j].t - tA) / Math.max(0.001, tB - tA);
          ctx.strokeStyle = 'rgba(255,217,160,' + (f * 0.9 * fadeOut).toFixed(3) + ')';
          ctx.lineWidth = 1 + f * 6;
          ctx.beginPath(); ctx.moveTo(P[j].x, P[j].y); ctx.lineTo(P[j + 1].x, P[j + 1].y); ctx.stroke();
        }
        ctx.restore();
        if (s.front < 1.02) {
          var p = at(s, s.front), c = Math.cos(p.ang), sn = Math.sin(p.ang);
          for (var n = 0; n < 4; n++) {
            var side = Math.random() < 0.5 ? 1 : -1, sp = rand(80, 320);
            sparks.push({ x: p.x, y: p.y, vx: -c * rand(40, 160) + p.nx * side * sp, vy: -sn * rand(40, 160) + p.ny * side * sp - 60,
              g: 900, drag: 1.2, life: rand(0.3, 0.8), fade: 0.3, w: rand(0.8, 1.8), color: pick([C.emberHot, C.ember, C.emberMid]) });
          }
        }
      }

      // 2. once closed: a cooling seam that fades
      if (s.max <= 0.004) {
        if (ms > s.c.healAt) {
          var sa = 0.55 * heat * clamp(1 - (ms - s.c.healAt - 900) / 900);
          if (sa > 0.01) {
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = 'rgba(255,122,46,' + sa.toFixed(3) + ')'; ctx.lineWidth = 1.3;
            ctx.shadowColor = C.ember; ctx.shadowBlur = 8;
            ctx.beginPath(); ctx.moveTo(P[4].x, P[4].y);
            for (var q = 5; q < N - 4; q++) ctx.lineTo(P[q].x, P[q].y);
            ctx.stroke(); ctx.restore();
          }
        }
        return;
      }

      // 3. charred rim
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 2;
      outline(s, 1); ctx.fillStyle = C.char; ctx.fill();
      ctx.restore();
      ctx.save();
      outline(s, 1); ctx.clip();
      outline(s, 0); ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = C.charFibre; ctx.stroke();
      ctx.restore();

      // 4. the opening: drifting code, warmed by the heat, with an inner shadow
      ctx.save();
      outline(s, 0); ctx.clip();
      ctx.drawImage(texture, 0, -(ms / 1000) * 14, W, H + TEX_EXTRA);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,110,40,' + (0.12 * heat).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowColor = 'rgba(0,0,0,.9)'; ctx.shadowBlur = 9;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.8)';
      outline(s, 0); ctx.stroke();
      ctx.restore();

      // 5. flickering glow along the cut edge
      var flick = 0.82 + 0.18 * Math.sin(ms * 0.045 + s.k * 2.1) * Math.sin(ms * 0.017 + s.k);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = C.ember; ctx.shadowBlur = 16;
      ctx.strokeStyle = 'rgba(255,122,46,' + (heat * flick).toFixed(3) + ')'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
      outline(s, 0); ctx.stroke();
      ctx.restore();

      // 6. glowing fibres across the gap
      ctx.save();
      ctx.strokeStyle = 'rgba(255,176,84,.7)'; ctx.lineWidth = 0.9; ctx.lineCap = 'round';
      ctx.beginPath();
      for (var h = 0; h < s.hairs.length; h++) {
        var hr = s.hairs[h], hp = P[hr.j], o = s.op[hr.j];
        if (o < 0.12) continue;
        var d = edge(hp, o, hr.side, 0), sx = hp.x + hp.nx * d, sy = hp.y + hp.ny * d;
        var ddx = -hr.side * hp.nx, ddy = -hr.side * hp.ny, cc = Math.cos(hr.a), ss = Math.sin(hr.a), L = hr.len * Math.min(1, o * 1.5);
        ctx.moveTo(sx, sy); ctx.lineTo(sx + (ddx * cc - ddy * ss) * L, sy + (ddx * ss + ddy * cc) * L);
      }
      ctx.stroke();
      ctx.restore();

      // 7. embers dripping from the edges while it is hot
      if (Math.random() < 0.25 * heat) {
        var e = at(s, rand(0.1, 0.9)), sd = Math.random() < 0.5 ? 1 : -1, ed = edge(e, s.op[Math.round(e.t * N)], sd, 0);
        sparks.push({ x: e.x + e.nx * ed, y: e.y + e.ny * ed, vx: rand(-20, 20), vy: rand(10, 40), g: 60, drag: 0,
          life: rand(0.8, 1.6), fade: 0.6, w: 1.4, color: C.emberMid });
      }
    });
  }

  var running = false;
  function emberTear(opts) {
    opts = opts || {};
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (running || (!opts.force && (reduce || document.hidden))) return false;
    setup();
    if (!W || !H || !texture) return false;
    running = true;
    sparks.length = 0;
    var shakeEl = opts.shake || null, shakeAmp = 0, shakeDecay = 0, doneFired = false;
    var doneAt = opts.doneAt == null ? DURATION : opts.doneAt;
    function done() { if (doneFired) return; doneFired = true; if (opts.onDone) opts.onDone(); }
    var fx = {
      flash: 0, onImpact: opts.onImpact,
      kick: function (a, ms) { if (a >= shakeAmp) { shakeAmp = a; shakeDecay = a / (ms / 1000); } }
    };
    var st = build();
    canvas.hidden = false;
    var start = performance.now(), last = start;
    function finish() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.hidden = true;
      if (shakeEl) shakeEl.style.transform = '';
      sparks.length = 0; running = false;
      done();                                                      // (a no-op when it has already run at doneAt)
    }
    (function step(now) {
      var ms = now - start, dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (ms >= DURATION) { finish(); return; }
      if (ms >= doneAt) done();
      var sx = 0, sy = 0;
      if (shakeAmp > 0) {
        sx = rand(-1, 1) * shakeAmp; sy = rand(-1, 1) * shakeAmp;
        shakeAmp = Math.max(0, shakeAmp - shakeDecay * dt);
      }
      if (shakeEl) shakeEl.style.transform = (sx || sy) ? 'translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px)' : '';
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, sx * dpr, sy * dpr);
      try {
        frame(st, ms, fx);
        stepSparks(dt); drawSparks();
        if (fx.flash > 0) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.fillStyle = 'rgba(' + C.flash + ',' + fx.flash.toFixed(3) + ')';
          ctx.fillRect(0, 0, W, H);
          fx.flash = Math.max(0, fx.flash - dt * 2.2);
        }
      } catch (err) { finish(); throw err; }
      requestAnimationFrame(step);
    })(start);
    return true;
  }

  window.emberTear = emberTear;
  window.emberTear.isRunning = function () { return running; };

  // ---------- the home page: the Clawed Club bar and logo ----------
  // Picking the logo or anywhere on the "Ace endorses, supports and advises" strip plays the effect, and the club's site opens in a new tab
  // as it finishes. With reduced motion (or a hidden tab) there is no effect: the logo's own link opens the site at once.
  var style = document.createElement('style');
  style.textContent = '.logos--ally{cursor:pointer}' +
    '.claw-open{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483001;padding:.8rem 1.2rem;background:#121110;border:1px solid #D9A441;color:#F1EDE6;font:600 14px/1 system-ui,sans-serif;letter-spacing:.04em;text-decoration:none;box-shadow:0 6px 30px rgba(0,0,0,.6)}.claw-open:hover,.claw-open:focus-visible{background:#D9A441;color:#121110;outline:none}';
  document.head.appendChild(style);

  function showBlocked() {
    var old = document.querySelector('.claw-open');
    if (old) old.remove();
    var a = document.createElement('a');
    a.className = 'claw-open'; a.href = CLAW_URL; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.textContent = 'Open Clawed Club ↗';
    a.addEventListener('click', function () { setTimeout(function () { a.remove(); }, 0); });
    document.body.appendChild(a);
    setTimeout(function () { if (a.parentNode) a.remove(); }, 15000);
  }
  function openClub() {
    var w = null;
    try { w = window.open(CLAW_URL, '_blank'); } catch (e) {}
    if (w) { try { w.opener = null; } catch (e) {} }
    else showBlocked();                                          // the browser stopped it: offer the same thing as a button
  }
  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    var bar = e.target.closest('.logos--ally');
    if (!bar) return;
    if (e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;   // a deliberate "open in a new tab" click on the logo: leave it alone
    if (running) { e.preventDefault(); return; }
    if (emberTear({ onDone: openClub, doneAt: OPEN_AT })) e.preventDefault();
    else if (!e.target.closest('a')) openClub();
  });
})();
