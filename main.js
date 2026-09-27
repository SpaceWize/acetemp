/* ═══════════════════════════════════════════════════════════════
   ACE SPADERS — behaviour
   Four motion systems, then chrome. Nothing decorative.
     1. heroChoreography()  pinned, scroll-position-driven hero
        heroSpotlight()     the hero's cursor-trailing light, part of the same idea
     2. flagshipReveal()    ordered stagger on the core four
     3. proofCounters()     one count-up, once
     4. (CSS) hover lift on secondary services
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var seg = function (p, a, b) { return clamp((p - a) / (b - a), 0, 1); };
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
  var easeInOut = function (t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  /* ── 1. HERO CHOREOGRAPHY ──────────────────────────────────────
     Not input hijacking — the page scrolls normally. The stage pins
     and the panels are driven off scroll position, so the reader
     keeps full control of pace and direction.                     */
  function heroChoreography() {
    var hero = document.querySelector('[data-hero]');
    var stage = hero && hero.querySelector('[data-stage]');
    if (!hero || !stage) return;

    // Cinematic only where it can be done well.
    var cine = window.matchMedia(
      '(min-width: 901px) and (pointer: fine) and (prefers-reduced-motion: no-preference)'
    );
    var ticking = false;
    var bound = false;
    var rafId = 0;

    function setBeat(n, t) {
      var e = easeOut(t);
      stage.style.setProperty('--o' + n, e.toFixed(3));
      stage.style.setProperty('--y' + n, ((1 - e) * 46).toFixed(2) + 'px');
    }

    function frame() {
      ticking = false;
      rafId = 0;
      /* A queued frame outlives the listener that scheduled it. Without this
         guard, a resize across the 901px line lands reset() first and then
         this callback rewrites every property from the narrow layout — where
         travel is a couple of dozen pixels, so p slams straight to 1 and the
         static hero inherits an end-state it should never have animated to. */
      if (!cine.matches) return;
      var top = hero.getBoundingClientRect().top;
      var travel = hero.offsetHeight - window.innerHeight;
      var p = travel > 0 ? clamp(-top / travel, 0, 1) : 0;
      var s = stage.style;

      s.setProperty('--scrim', (0.40 + 0.32 * seg(p, 0.14, 0.80)).toFixed(3));

      // Beat 1 is the landing frame — it is never animated in, so the page
      // never opens on an empty screen. Scroll composes beats 2–4 beneath it.
      // Each beat needs roughly a couple of wheel notches to read as an event;
      // at ~60px it fires faster than the input that drives it and the whole
      // reveal collapses into a single flick. Sized against the 200vh hero.
      setBeat(2, seg(p, 0.08, 0.28));   // headline, line two
      setBeat(3, seg(p, 0.30, 0.50));   // identity paragraph
      setBeat(4, seg(p, 0.48, 0.68));   // calls to action

      // the block rides low while it is still half-empty, then rises
      // 265, not 320: the eyebrow and lede added to the landing frame pushed
      // the gold half of the headline past the fold before any scrolling.
      // Both headline lines have to be readable on arrival.
      s.setProperty('--cy', ((1 - easeOut(seg(p, 0.05, 0.66))) * 265).toFixed(1) + 'px');
      s.setProperty('--cue', (1 - seg(p, 0, 0.05)).toFixed(3));

      // Composed from 0.68 to the release, and it stays that way. There is
      // deliberately no fade-out: the copy holds at full strength until the
      // pin lets go and the section scrolls off under the next one.
    }

    function onScroll() {
      if (!ticking) { ticking = true; rafId = requestAnimationFrame(frame); }
    }

    function reset() {
      // drop any frame already in flight, or it will repopulate what we clear
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      ticking = false;
      // hand every custom property back to its settled CSS default
      ['--o2', '--o3', '--o4', '--y2', '--y3', '--y4',
        '--scrim', '--cue', '--cy'].forEach(function (k) { stage.style.removeProperty(k); });
    }

    function sync() {
      if (cine.matches && !bound) {
        bound = true;
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll, { passive: true });
        frame();
      } else if (!cine.matches && bound) {
        bound = false;
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
        reset();
      }
    }

    sync();
    if (cine.addEventListener) cine.addEventListener('change', sync);
    else if (cine.addListener) cine.addListener(sync);
  }

  /* ── 1b. HERO SPOTLIGHT ─────────────────────────────────────────
     A cursor-trailing mask opens onto the hero clip, with a soft warm
     bloom bleeding past it. --mx/--my/--r are set on .hero__stage and
     inherit down to the two CSS layers that draw it — see styles.css.

     This also owns the video's playback, because the two share a trigger:
     the plate is invisible until the pointer is over the stage, so there
     is no reason to decode a frame before then. */
  var VIDEO_SPEED = 1;      // real time; the clip is a ~12s there-and-back

  function heroSpotlight() {
    if (reduce.matches || !window.matchMedia('(hover: hover)').matches) return;
    var stages = [].slice.call(document.querySelectorAll('.hero__stage'));
    if (!stages.length) return;

    stages.forEach(function (stage) {
      var raw = { x: -999, y: -999 };
      var smooth = { x: -999, y: -999 };
      var running = false;

      var video = stage.querySelector('[data-hero-video]');
      var vOn = false;

      /* Native `loop`. timeline-1.mp4 is already a palindrome — it plays
         forward and then back within the file, so its last frame matches its
         first and the wrap is seamless. The old clip needed a scripted reverse
         leg (seeking currentTime every frame); on this one, with a keyframe
         only every ~2s, each backward seek decoded up to two seconds of video
         and the picture stuttered at the turn. */
      if (video) video.loop = true;
      function forward() {
        video.playbackRate = VIDEO_SPEED;
        var p = video.play();
        if (p && p.catch) p.catch(function () {});   // autoplay refusal is fine
      }
      /* halt() stops the picture without forgetting that the pointer is still
         over the stage; videoStop() is the real exit. Keeping those separate
         matters for the tab-switch case below: pausing on hide and clearing
         vOn at the same time left the clip dead on return, because nothing
         restarts it until the pointer moves again — and a pointer already
         parked on the hero never fires another move. */
      function halt() {
        if (!video) return;
        video.pause();
      }
      function resume() {
        if (!video) return;
        forward();
      }
      function videoStart() {
        if (!video || vOn) return;
        vOn = true;
        resume();
      }
      function videoStop() {
        if (!video) return;
        vOn = false;
        halt();
      }

      function loop() {
        smooth.x += (raw.x - smooth.x) * 0.16;
        smooth.y += (raw.y - smooth.y) * 0.16;
        stage.style.setProperty('--mx', smooth.x.toFixed(1) + 'px');
        stage.style.setProperty('--my', smooth.y.toFixed(1) + 'px');
        if (Math.abs(raw.x - smooth.x) > 0.4 || Math.abs(raw.y - smooth.y) > 0.4) {
          requestAnimationFrame(loop);
        } else {
          running = false;
        }
      }
      function kick() {
        if (!running) { running = true; requestAnimationFrame(loop); }
      }

      stage.addEventListener('pointerenter', videoStart);
      stage.addEventListener('pointermove', function (e) {
        var r = stage.getBoundingClientRect();
        raw.x = e.clientX - r.left;
        raw.y = e.clientY - r.top;
        videoStart();          // pointerenter can be missed after a scroll
        kick();
      }, { passive: true });
      stage.addEventListener('pointerleave', function () {
        raw.x = -999; raw.y = -999;
        videoStop();
        kick();
      });
      // Never decode while the tab is hidden, but come back if the pointer
      // is still on the stage when it returns.
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) halt();
        else if (vOn) resume();
      });
    });
  }

  /* ── 2. FLAGSHIP ORDERED REVEAL ────────────────────────────────
     One trigger, then CSS walks the four in order via --i.
     Stagger (620ms) is close to the item duration (720ms) so they
     resolve one at a time rather than blooming together.          */
  function flagshipReveal() {
    var list = document.querySelector('[data-four]');
    if (!list) return;
    if (reduce.matches || !('IntersectionObserver' in window)) {
      list.classList.add('is-in');
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -10% 0px' });
    io.observe(list);
  }

  /* ── 3. PROOF COUNTERS ─────────────────────────────────────────
     Fires once. Reduced motion gets the number, not the animation. */
  function proofCounters() {
    var strip = document.querySelector('[data-proof]');
    if (!strip) return;
    var nodes = [].slice.call(strip.querySelectorAll('[data-count]'));
    if (!nodes.length) return;

    var settle = function () {
      nodes.forEach(function (n) {
        n.textContent = Number(n.getAttribute('data-count')).toLocaleString();
      });
    };

    if (reduce.matches || !('IntersectionObserver' in window)) { settle(); return; }

    var run = function () {
      var dur = 1600, t0 = null;
      var targets = nodes.map(function (n) { return Number(n.getAttribute('data-count')) || 0; });
      (function step(ts) {
        if (t0 === null) t0 = ts;
        var t = clamp((ts - t0) / dur, 0, 1);
        var e = easeOut(t);
        nodes.forEach(function (n, i) {
          n.textContent = Math.round(targets[i] * e).toLocaleString();
        });
        if (t < 1) requestAnimationFrame(step); else settle();
      })(performance.now());
    };

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.disconnect();
        run();
      });
    }, { threshold: 0.4 });
    io.observe(strip);
  }

  /* ── HEADER: solid once you leave the hero ─────────────────── */
  function header() {
    var head = document.querySelector('[data-head]');
    if (!head) return;
    var ticking = false;
    function check() {
      ticking = false;
      head.classList.toggle('is-stuck', window.scrollY > 24);
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(check); }
    }, { passive: true });
    check();
  }

  /* ── NAV: mark the section you're reading ──────────────────── */
  function navState() {
    var links = [].slice.call(document.querySelectorAll('[data-nav] a'));
    if (!links.length || !('IntersectionObserver' in window)) return;
    var map = {};
    var sections = links.map(function (a) {
      var href = a.getAttribute('href');
      /* Only same-page section links; "#" alone (Little Ace triggers) isn't a selector. */
      var el = /^#[\w-]+$/.test(href) ? document.querySelector(href) : null;
      if (el) map[el.id] = a;
      return el;
    }).filter(Boolean);

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var a = map[e.target.id];
        if (!a) return;
        if (e.isIntersecting) {
          links.forEach(function (l) { l.classList.remove('is-current'); });
          a.classList.add('is-current');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (s) { io.observe(s); });
  }

  /* ── MOBILE MENU ───────────────────────────────────────────── */
  function mobileMenu() {
    var btn = document.querySelector('[data-burger]');
    var panel = document.querySelector('[data-mnav]');
    if (!btn || !panel) return;

    function open(state) {
      btn.setAttribute('aria-expanded', String(state));
      panel.hidden = !state;
      document.body.style.overflow = state ? 'hidden' : '';
      btn.querySelector('.sr-only').textContent = state ? 'Close menu' : 'Open menu';
      if (state) { var f = panel.querySelector('a'); if (f) f.focus(); }
    }

    /* The groups inside the panel. Tapping a label opens its list rather
       than navigating — the parent page has its own row inside instead.
       Only one open at a time: the panel is a single scroll of large
       display type, and two expanded groups push the rest off-screen. */
    var toggles = [].slice.call(panel.querySelectorAll('[data-mtoggle]'));
    function openGroup(t, state) {
      t.setAttribute('aria-expanded', String(state));
      var sub = document.getElementById(t.getAttribute('aria-controls'));
      if (sub) sub.hidden = !state;
    }
    toggles.forEach(function (t) {
      t.addEventListener('click', function () {
        var next = t.getAttribute('aria-expanded') !== 'true';
        toggles.forEach(function (o) { openGroup(o, o === t && next); });
      });
    });
    function collapseGroups() {
      toggles.forEach(function (t) { openGroup(t, false); });
    }

    btn.addEventListener('click', function () {
      /* Reset on every open so the panel always starts from the same
         state rather than however it was left last time. */
      collapseGroups();
      open(btn.getAttribute('aria-expanded') !== 'true');
    });
    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) { open(false); btn.focus(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) { open(false); btn.focus(); }
    });
    window.matchMedia('(min-width: 901px)').addEventListener('change', function (m) {
      if (m.matches && !panel.hidden) open(false);
    });
  }

  /* ── APPLICATION FORM ──────────────────────────────────────────
     Validates in place, then composes a pre-filled email so the form
     works with no backend. To post to a real endpoint instead, set
     the <form action> and delete the mailto branch below.          */
  function applicationForm() {
    var form = document.querySelector('[data-form]');
    if (!form) return;
    var status = form.querySelector('[data-status]');
    var TO = 'info@acespaders.com';   // matches the address shown on the page

    function fieldOf(input) { return input.closest('.field'); }
    function errOf(input) {
      var f = fieldOf(input);
      return f && f.querySelector('[data-err]');
    }
    function setError(input, msg) {
      var f = fieldOf(input), e = errOf(input);
      if (f) f.classList.toggle('is-bad', !!msg);
      if (e) e.textContent = msg || '';
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    }
    function validate(input) {
      var v = (input.value || '').trim();
      var label = (fieldOf(input).querySelector('label').textContent || 'This field').trim();
      if (input.required && !v) {
        setError(input, input.getAttribute('data-msg') || label + ' is required.');
        return false;
      }
      if (input.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
        setError(input, 'Use a full email address, like name@company.com.');
        return false;
      }
      setError(input, '');
      return true;
    }

    /* "Regarding" is a checkbox group: valid when at least one box is ticked.
       No individual input can express that, and validate() above would mark
       every unticked box as a failed required field, so the group is checked
       as a unit and its inputs are skipped by the per-field wiring. */
    var group = form.querySelector('[data-checkgroup]');
    var boxes = group ? [].slice.call(group.querySelectorAll('input[type="checkbox"], input[type="radio"]')) : [];

    function validateGroup() {
      if (!group) return true;
      var any = boxes.some(function (b) { return b.checked; });
      var e = group.querySelector('[data-err]');
      group.classList.toggle('is-bad', !any);
      if (e) e.textContent = any ? '' : (group.getAttribute('data-msg') || 'Pick at least one.');
      boxes.forEach(function (b) { b.setAttribute('aria-invalid', any ? 'false' : 'true'); });
      return any;
    }

    var fields = [].slice.call(form.querySelectorAll('input, select, textarea'));
    fields.forEach(function (f) {
      if (f.type === 'checkbox' || f.type === 'radio') {
        // only ever clears an error already showing — never scolds mid-choice
        f.addEventListener('change', function () {
          if (group && group.classList.contains('is-bad')) validateGroup();
        });
        return;
      }
      f.addEventListener('blur', function () { validate(f); });
      f.addEventListener('input', function () {
        if (fieldOf(f).classList.contains('is-bad')) validate(f);
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true, first = null, groupChecked = false;
      // walked in DOM order, so focus lands on the first problem down the page
      fields.forEach(function (f) {
        var good;
        if (f.type === 'checkbox' || f.type === 'radio') {
          if (groupChecked) return;              // the whole group counts once
          groupChecked = true;
          good = validateGroup();
        } else {
          good = validate(f);
        }
        if (!good) { ok = false; if (!first) first = f; }
      });
      if (!ok) {
        status.textContent = 'Fix the highlighted fields and send again.';
        if (first) first.focus();
        return;
      }

      var d = new FormData(form);
      /* Any other form (the Mastermind application) sends every answer
         under its own question, in page order. */
      var generic = form.getAttribute('data-subject');
      if (generic) {
        var seen = {}, lines = [];
        fields.forEach(function (f) {
          if (!f.name || seen[f.name]) return;
          seen[f.name] = 1;
          lines.push(f.name, d.getAll(f.name).join(', ') || '—', '');
        });
        offerMail(generic + ' — ' + d.get('Full name'), lines.join('\n'));
        return;
      }
      // getAll, not get — "door" is now multi-valued, and a single-value read
      // would silently drop every selection after the first.
      var doors = d.getAll('door').join(', ');
      var subject = 'Application — ' + (doors || 'Ace Spaders');
      var body = [
        'Name: ' + d.get('name'),
        'Email: ' + d.get('email'),
        'Organization: ' + (d.get('org') || '—'),
        'Door: ' + doors,
        'Timeline: ' + d.get('when'),
        '',
        "What's stuck:",
        d.get('what')
      ].join('\n');
      offerMail(subject, body);
    });

    function offerMail(subject, body) {
      /* Offer the compose window rather than firing mailto: blind. A bare
         mailto only works for whoever has a desktop client registered — for
         a webmail user it opens nothing at all, or an app they never use,
         and the application is silently lost. These are real links the
         visitor clicks, which also keeps them clear of popup blocking:
         window.open() from inside a submit handler is frequently refused,
         a user-initiated click on an anchor is not. */
      var su = encodeURIComponent(subject), bd = encodeURIComponent(body);
      var targets = [
        { name: 'Gmail',   url: 'https://mail.google.com/mail/?view=cm&fs=1&to=' + TO + '&su=' + su + '&body=' + bd },
        { name: 'Outlook', url: 'https://outlook.live.com/mail/0/deeplink/compose?to=' + TO + '&subject=' + su + '&body=' + bd },
        { name: 'Yahoo',   url: 'https://compose.mail.yahoo.com/?to=' + TO + '&subject=' + su + '&body=' + bd },
        { name: 'Email app', url: 'mailto:' + TO + '?subject=' + su + '&body=' + bd }
      ];

      var old = form.querySelector('[data-mailpick]');
      if (old) old.remove();

      var pick = document.createElement('div');
      pick.className = 'mailpick';
      pick.setAttribute('data-mailpick', '');
      var lead = document.createElement('p');
      lead.className = 'mailpick__lead';
      lead.textContent = 'Open it in';
      pick.appendChild(lead);

      var row = document.createElement('div');
      row.className = 'mailpick__row';
      targets.forEach(function (t) {
        var a = document.createElement('a');
        a.className = 'btn btn--outline btn--sm';
        a.href = t.url;
        a.textContent = t.name;
        if (t.url.indexOf('mailto:') !== 0) {
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
        }
        row.appendChild(a);
      });
      pick.appendChild(row);

      var note = document.createElement('p');
      note.className = 'mailpick__note';
      note.textContent = 'Nothing sends until you press send in your mail. '
        + 'If none of these open, email ' + TO + ' directly.';
      pick.appendChild(note);

      form.querySelector('.form__foot').appendChild(pick);
      status.textContent = 'Your application is ready.';
      // move focus so a keyboard or screen-reader user lands on the choices
      row.firstChild.focus();
    }
  }

  /* ── PAGE SPADE REVEAL ──────────────────────────────────────────
     The hero's spotlight, taken page-wide. One fixed layer of gold is
     appended to the body (rather than authored into each page's markup,
     so all five stay in step), and the spade-shaped mask tracks the
     cursor across the whole document.

     Same guards as the hero: no pointer to follow on touch, and reduced
     motion drops it entirely, so the layer is never even created. */
  function pageSpade() {
    if (reduce.matches || !window.matchMedia('(hover: hover)').matches) return;

    var layer = document.createElement('div');
    layer.className = 'aop';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);

    var raw = { x: -999, y: -999 };
    var smooth = { x: -999, y: -999 };
    var running = false, on = false;

    function frame() {
      smooth.x += (raw.x - smooth.x) * 0.18;
      smooth.y += (raw.y - smooth.y) * 0.18;
      layer.style.setProperty('--gx', smooth.x.toFixed(1) + 'px');
      layer.style.setProperty('--gy', smooth.y.toFixed(1) + 'px');
      reveal();
      if (Math.abs(raw.x - smooth.x) < 0.5 && Math.abs(raw.y - smooth.y) < 0.5) {
        running = false;
        return;
      }
      requestAnimationFrame(frame);
    }

    /* Backdrops for bare text. Cards, trays and buttons have a 70% fill,
       so the spades only show faintly through them; copy sitting straight
       on the page ground had none, and full-strength gold behind it made
       it hard to read. Each such text block now carries a borderless,
       feathered backdrop of that same 70% fill (.lit-text in styles.css),
       hidden until the spade reaches the outermost faded pixels of it.

       The backdrops are not painted on the text elements themselves. Two
       neighbouring paragraphs' feathered edges overlap, and two 70% layers
       stacked read as a dark band between them. Instead each is a solid
       shape on one shared layer (.aop-veil) that is itself 70% opaque —
       overlapping solids merge, and the transparency is applied once. The
       layer is positioned in page coordinates, so it scrolls with the text
       rather than chasing it a frame behind.

       The spade is tested as its own bounding box, derived from the mask:
       the glyph spans 16.9 x 19.6 of its 24-unit viewBox, drawn inside a
       32-unit mask tile sized to 2 x --gr, so it reaches 0.53 --gr either
       side of the cursor and 0.61 --gr above and below. FEATHER is how far
       past the text box the backdrop's fade runs (its shadow spread plus
       blur), so the reveal starts right at its faintest edge. */
    var TEXT = 'p,h1,h2,h3,h4,h5,h6,li,dt,dd,blockquote,figcaption,label,legend,.eyebrow';
    var FEATHER = 36;
    function hasFill(el) {
      var bg = getComputedStyle(el).backgroundColor;
      return !(bg === 'transparent' || /rgba\(.*,\s*0\)$/.test(bg));
    }
    function bare(el) {
      // innermost blocks only: a blockquote's <p> gets the backdrop, not both
      if (el.querySelector(TEXT)) return false;
      if (!el.textContent.trim()) return false;
      // inside a filled surface already, or the opaque hero/footer where the
      // spade never shows — that fill does the job
      for (var p = el; p && p !== document.body; p = p.parentElement) {
        if (hasFill(p)) return false;
      }
      return true;
    }
    var texts = [].slice.call(document.querySelectorAll(TEXT)).filter(bare);
    var veil = document.createElement('div');
    veil.className = 'aop-veil';
    veil.setAttribute('aria-hidden', 'true');
    layer.after(veil);                 // above the gold, below the content
    var shapes = new Map();
    function shapeFor(el) {
      var s = shapes.get(el);
      if (!s) { s = document.createElement('i'); veil.appendChild(s); shapes.set(el, s); }
      return s;
    }

    var shown = texts;
    if ('IntersectionObserver' in window) {
      shown = [];
      var tio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          var i = shown.indexOf(e.target);
          if (e.isIntersecting && i < 0) shown.push(e.target);
          else if (!e.isIntersecting && i >= 0) {
            shown.splice(i, 1);
            var s = shapes.get(e.target);
            if (s) s.classList.remove('is-lit');
          }
        });
      }, { rootMargin: '60px 0px' });
      texts.forEach(function (t) { tio.observe(t); });
    }

    function spadeR() { return Math.min(Math.max(130, window.innerWidth * 0.15), 235); }
    var gr = spadeR();
    var range = document.createRange();
    function textBox(el) {
      var box = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
      var walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (var n = walk.nextNode(); n; n = walk.nextNode()) {
        if (!n.nodeValue.trim()) continue;
        range.selectNodeContents(n);
        var r = range.getBoundingClientRect();
        if (!r.width) continue;
        if (r.left < box.left) box.left = r.left;
        if (r.top < box.top) box.top = r.top;
        if (r.right > box.right) box.right = r.right;
        if (r.bottom > box.bottom) box.bottom = r.bottom;
      }
      if (box.left === Infinity) return { left: 0, top: -1e5, right: 0, bottom: -1e5, width: 0, height: 0 };
      box.width = box.right - box.left;
      box.height = box.bottom - box.top;
      return box;
    }
    window.addEventListener('resize', function () { gr = spadeR(); });

    function reveal() {
      var hx = 0.53 * gr, hy = 0.61 * gr;
      var l = smooth.x - hx, r = smooth.x + hx, t = smooth.y - hy, b = smooth.y + hy;
      /* The text's own extent, not the block's box — a heading's box runs
         the full column width even when its words stop halfway, and the
         backdrop would too. Measured per text node and unioned: a Range
         over the whole block would count any block-level child's box (the
         page titles' .hero__line spans), which is full width again. Every
         rect is read first, then written, so layout is computed once. */
      var rects = shown.map(textBox);
      var sx = window.scrollX, sy = window.scrollY;
      shown.forEach(function (el, n) {
        var q = rects[n];
        var hit = on && q.right + FEATHER > l && q.left - FEATHER < r &&
                  q.bottom + FEATHER > t && q.top - FEATHER < b;
        var s = hit ? shapeFor(el) : shapes.get(el);
        if (!s) return;
        // keep a fading-out shape where its text is, too
        if (hit || s.classList.contains('is-lit')) {
          s.style.left = (q.left + sx).toFixed(1) + 'px';
          s.style.top = (q.top + sy).toFixed(1) + 'px';
          s.style.width = q.width.toFixed(1) + 'px';
          s.style.height = q.height.toFixed(1) + 'px';
        }
        s.classList.toggle('is-lit', hit);
      });
    }
    var revealQueued = false;
    function queueReveal() {
      if (revealQueued) return;
      revealQueued = true;
      requestAnimationFrame(function () { revealQueued = false; reveal(); });
    }
    // scrolling moves the page under a still spade
    window.addEventListener('scroll', queueReveal, { passive: true });

    window.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      raw.x = e.clientX;
      raw.y = e.clientY;
      /* Snap on the first move. Lerping from the off-canvas rest position
         would fly the spade in across the whole viewport. */
      if (!on) {
        on = true;
        smooth.x = raw.x;
        smooth.y = raw.y;
        layer.classList.add('is-on');
      }
      if (!running) { running = true; requestAnimationFrame(frame); }
    }, { passive: true });

    // fade out when the cursor leaves the window entirely
    document.addEventListener('mouseleave', function () {
      on = false;
      layer.classList.remove('is-on');
      queueReveal();
    });
  }

  /* ── PRESELECT A DOOR FROM THE URL ─────────────────────────────
     Little Ace links to contact.html?interest=Ongoing%20advisory and
     the like. Without this the parameter is decoration: the visitor
     arrives having said what they want and is asked again. Matching is
     loose because his labels are phrases ("On-site assignment") and the
     checkbox values are the site's own nouns ("On-Site Assignments").  */
  function preselectDoor() {
    var wanted = new URLSearchParams(location.search).get('interest');
    if (!wanted) return;
    var boxes = [].slice.call(document.querySelectorAll('input[name="door"]'));
    if (!boxes.length) return;

    /* Significant words only, singular, so casing and plurals stop
       mattering. "aces" is dropped because it prefixes half the options
       and would match everything equally. */
    function words(s) {
      return s.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/)
        .filter(function (w) { return w.length > 3 && w !== 'aces'; })
        .map(function (w) { return w.replace(/s$/, ''); });
    }
    /* Where his vocabulary and the form's share no word at all. A working
       session is what the form calls a Meeting. */
    var aliases = { session: 'meeting', working: 'meeting' };

    var want = words(wanted).map(function (w) { return aliases[w] || w; });
    if (!want.length) return;

    var best = null, bestScore = 0;
    for (var i = 0; i < boxes.length; i++) {
      var have = words(boxes[i].value), score = 0;
      for (var j = 0; j < want.length; j++) {
        if (have.indexOf(want[j]) > -1) score++;
      }
      if (score > bestScore) { bestScore = score; best = boxes[i]; }
    }
    if (best) best.checked = true;
  }

  /* ── COPY TO CLIPBOARD ─────────────────────────────────────────
     The direct address in the appointment tray. A button rather than
     a mailto: the point is to put the address on the clipboard, which
     handing off to a mail client does not do. The footer's mailto is
     still there on every page for people who want that instead.

     Bound off [data-copy] rather than a class so the address lives in
     the markup on both pages and this stays generic.                */
  function copyEmail() {
    var buttons = [].slice.call(document.querySelectorAll('[data-copy]'));
    if (!buttons.length) return;

    var toast = document.createElement('div');
    toast.className = 'toast';
    /* status/polite, not alert/assertive: this confirms something the
       reader just did on purpose, so it should wait its turn rather
       than interrupt whatever a screen reader is mid-sentence on. */
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);

    var timer = 0;
    function say(msg, ok) {
      toast.textContent = msg;
      toast.classList.toggle('is-bad', !ok);
      toast.classList.add('is-on');
      clearTimeout(timer);
      timer = setTimeout(function () { toast.classList.remove('is-on'); }, 2000);
    }

    /* writeText() needs a secure context, which rules it out on file://
       and plain http — and the README tells people to open the folder
       both ways for local work. This is the pre-Clipboard-API path. */
    function legacyCopy(text) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      /* Parked off-screen, not hidden: display:none and visibility:hidden
         are both unselectable, so the copy would quietly do nothing. */
      ta.style.cssText = 'position:fixed;top:0;left:-9999px';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      return ok;
    }

    function fallback(text) {
      var ok = legacyCopy(text);
      say(ok ? 'Copied' : 'Copy failed', ok);
    }

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var text = btn.getAttribute('data-copy');
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(text).then(
            function () { say('Copied', true); },
            /* Permission can still be refused on a secure origin, so the
               rejection path retries the old way before giving up. */
            function () { fallback(text); }
          );
        } else {
          fallback(text);
        }
      });
    });
  }

  /* ── boot ──────────────────────────────────────────────────── */
  function init() {
    var y = document.querySelector('[data-year]');
    if (y) y.textContent = new Date().getFullYear();
    heroChoreography();
    heroSpotlight();
    pageSpade();
    flagshipReveal();
    proofCounters();
    header();
    navState();
    mobileMenu();
    applicationForm();
    preselectDoor();
    copyEmail();
    edgeLight();
  }

  /* ── CURSOR-LIT EDGES ──────────────────────────────────────────
     Points each box's edge arc at the cursor (see "CURSOR-LIT EDGE GLOW"
     in styles.css). --light-a is the angle from the box's centre to the
     light, clockwise from straight up, which is how conic-gradient counts;
     --light-i brightens the edge as the light gets closer.

     Only boxes on screen are touched (an IntersectionObserver keeps that
     set), and the loop runs only while the light is still travelling, so
     a parked cursor costs nothing. The light itself is eased toward the
     pointer, which also keeps the arcs from snapping when it jumps.

     No cursor (touch, or before the first move): the source sits above
     the middle of the viewport, so scrolling alone sweeps the light
     around each box as it passes. Reduced motion gets that same fixed
     source and nothing more. */
  var LIT = '.btn,.tier,.quote,.tiers,.quotes,.form,.cta__copy,.cta__shot,' +
            '.tiernotes,.alsotile,.plaque,.portrait,.circle__band,' +
            '.brand__mark,.four__node,.burger,.nav__sub,.toast';
  var LIGHT_REACH = 700;     // px from a box at which its edge is dimmest

  function edgeLight() {
    var boxes = [].slice.call(document.querySelectorAll(LIT));
    if (!boxes.length) return;

    var visible = boxes;
    if ('IntersectionObserver' in window) {
      var seen = [];
      visible = seen;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          var i = seen.indexOf(e.target);
          if (e.isIntersecting && i < 0) seen.push(e.target);
          else if (!e.isIntersecting && i >= 0) seen.splice(i, 1);
        });
        queue();
      }, { rootMargin: '80px 0px' });
      boxes.forEach(function (b) { io.observe(b); });
    }

    function fixedSource() { return { x: window.innerWidth / 2, y: -window.innerHeight * 0.25 }; }
    var target = fixedSource();
    var light = { x: target.x, y: target.y };
    var hasPointer = false, running = false;

    function paint() {
      // read every rect first, then write, so layout is computed once
      var rects = visible.map(function (b) { return b.getBoundingClientRect(); });
      visible.forEach(function (b, n) {
        var r = rects[n];
        if (!r.width && !r.height) return;            // display:none (closed dropdown)
        var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        var ang = Math.atan2(light.x - cx, cy - light.y) * 180 / Math.PI;
        // distance to the box's nearest edge, 0 when the light is inside it
        var dx = Math.max(r.left - light.x, 0, light.x - r.right);
        var dy = Math.max(r.top - light.y, 0, light.y - r.bottom);
        var near = 1 - Math.min(Math.sqrt(dx * dx + dy * dy) / LIGHT_REACH, 1);
        b.style.setProperty('--light-a', ang.toFixed(1) + 'deg');
        b.style.setProperty('--light-i', (hasPointer ? 0.3 + 0.7 * near : 0.7).toFixed(2));
      });
    }
    function frame() {
      if (!hasPointer) target = fixedSource();
      var ease = reduce.matches ? 1 : 0.2;
      light.x += (target.x - light.x) * ease;
      light.y += (target.y - light.y) * ease;
      paint();
      if (Math.abs(target.x - light.x) > 0.5 || Math.abs(target.y - light.y) > 0.5) {
        requestAnimationFrame(frame);
      } else {
        running = false;
      }
    }
    function queue() {
      if (!running) { running = true; requestAnimationFrame(frame); }
    }

    if (!reduce.matches) {
      window.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return;
        if (!hasPointer) { hasPointer = true; light.x = e.clientX; light.y = e.clientY; }
        target = { x: e.clientX, y: e.clientY };
        queue();
      }, { passive: true });
    }
    // boxes move under a still light when the page scrolls or reflows
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    // dropdowns open on hover/focus and need their angle before they show
    document.addEventListener('focusin', queue);
    queue();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
