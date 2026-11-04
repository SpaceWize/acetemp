/* ACE SPADERS — the 2027 waitlist gate.

   Every page loads this in <head>. A visitor who has not yet joined sees
   nothing of the site until they give an email address; once they have, the
   gate never shows again (on that browser).

   It also serves the event pages: a button with data-waitlist opens the same
   box over the page, for anyone, joined or not.

   HOW IT WORKS
   - The look: the page (and the home page's intro) shows first, untouchable, with the gates standing open out of
     sight at the screen edges. Then pearly golden gates swing shut over it, Little Ace runs behind them, and the
     card appears (gate-scene.js, three.js). Joining swings them open and the headline shines for a moment
     (main.js heroShine). No WebGL or a blocked CDN within 4s: the plain gate, which covers the page at once.
   - It runs in the head, so scrolling and clicking are locked before the page can be used.
   - The email is POSTed to a Google Apps Script web app that appends a row to
     the waitlist sheet, and the gate only opens once that app confirms the save (see tools/waitlist-apps-script.gs for the script and
     the three-minute setup). Paste that web app's URL into WAITLIST_URL below.
   - "Already joined" is remembered in localStorage, with a cookie as a backup
     for browsers that block storage, so it holds across every page.

   NOT SET UP YET (WAITLIST_URL is empty)
   - Nothing is saved anywhere, so nobody is let through for good: the gate
     opens for the rest of the browser session only, and a note goes to the
     console. That keeps the page testable without ever losing a real signup
     into the void.

   A NOTE ON WHAT THIS IS: it is a front-door prompt, not a lock. The site's
   files are still public to anyone who views source, and a wall over every
   page can make search engines treat the site as an ad-style interstitial. */
(function () {
  'use strict';

  var WAITLIST_URL = 'https://script.google.com/macros/s/AKfycbwRub8l8LauagWedq_6iBhvU0G50PWcpYg02KWfncxomim-FAhTo7C16CDK4s1EbYY6/exec';                 // <-- the Apps Script web app URL (ends in /exec)
  var KEY = 'ace-waitlist-v1';           // bump to ask everyone again (a new list, a new year)
  var COOKIE = 'ace_waitlist_v1';

  /* BOT DEFENCES (the sheet's script, tools/waitlist-apps-script.gs, enforces the same rules, because a bot
     can post straight at the URL and never touch this page):
       1. a hidden field a person never sees and a bot fills in
       2. at least one real (trusted) keystroke/tap/click before it can be sent
       3. not instant: the send waits until a person-sized moment has passed since the prompt appeared
       4. an automation flag (navigator.webdriver) means bot
       5. proof of work: the browser finds a number that makes SHA-256("email|shownAt|n") start with POW_BITS zero
          bits, about a second of work for a person and a real cost for something firing thousands of times. The
          sheet checks it again, and refuses a proof it has already seen.
     A bot caught by 1-4 is shown the same "success" a person would be: it learns nothing and nothing is sent. */
  var POW_BITS = 16;                     // must match the sheet's script
  var MIN_MS = 1500;                     // fastest plausible human fill-in

  function joined() {
    try { if (localStorage.getItem(KEY)) return true; } catch (e) {}
    try { if (sessionStorage.getItem(KEY + '-session')) return true; } catch (e) {}
    return document.cookie.indexOf(COOKIE + '=1') !== -1;
  }
  function remember(permanent) {
    if (!permanent) { try { sessionStorage.setItem(KEY + '-session', '1'); } catch (e) {} return; }
    try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {}
    try { document.cookie = COOKIE + '=1; max-age=' + 60 * 60 * 24 * 365 * 2 + '; path=/; SameSite=Lax'; } catch (e) {}
  }

  /* The entrance: someone already on the list still comes in through the gates, once per visit (the first page
     they land on in a browser session): the gates stand shut with the box, the box fades, and they swing open
     out of sight. Not for reduced motion, and not where session storage is blocked (it would replay on every page). */
  var ENTERED = 'ace-entered-v1';
  function enteredThisVisit() { try { return !!sessionStorage.getItem(ENTERED); } catch (e) { return true; } }
  function markEntered() { try { sessionStorage.setItem(ENTERED, '1'); } catch (e) {} }

  var root = document.documentElement;
  var REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var locked = !joined();                // not on the list yet (on this browser): the gate
  var entry = !locked && !REDUCED && !enteredThisVisit();
  if (locked) root.classList.add('gate-locked');
  if (entry) { root.classList.add('gate-locked', 'gate-entry'); markEntered(); }   // main.js holds the home intro for it

  /* The pearly gates (gate-scene.js, three.js from a CDN). Fetched now, while the page is still parsing, so
     the gates are usually ready by the time the body is. Anything that goes wrong just means the plain gate. */
  var sceneMod = null;
  if (locked || entry) try {
    var pc = document.createElement('link'); pc.rel = 'preconnect'; pc.href = 'https://cdn.jsdelivr.net'; pc.crossOrigin = '';
    (document.head || root).appendChild(pc);
    sceneMod = import('./gate-scene.js?v=6');
    sceneMod.catch(function () {});
  } catch (e) { sceneMod = null; }

  /* Styles go in first, from the head, so the lock is in force before the
     body exists. Everything in the page is hidden except the gate itself. */
  var css = document.createElement('style');
  css.textContent =
    'html.gate-locked,html.gate-locked body{overflow:hidden!important}' +
    'html.gate-locked{scrollbar-gutter:stable}' +              // locking must not widen the page (styles.css reserves it too)
    '.ace-gate{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;' +
      'padding:max(1.25rem,env(safe-area-inset-top)) max(1.25rem,env(safe-area-inset-right)) max(1.25rem,env(safe-area-inset-bottom)) max(1.25rem,env(safe-area-inset-left));' +
      'overflow:auto;visibility:visible;color:#F1EDE6;font-family:"Instrument Sans",system-ui,-apple-system,"Segoe UI",sans-serif;' +
      'background:radial-gradient(78% 86% at 74% 4%,#2A2219,#0C0B0A 58%,#060505 100%);}' +
    '.ace-gate .gate__card{width:min(34rem,100%);text-align:center;display:flex;flex-direction:column;align-items:center;gap:1.4rem;}' +
    '.ace-gate .gate__mark{width:46px;height:46px;border:1px solid rgba(217,164,65,.5);display:grid;place-items:center;}' +
    '.ace-gate .gate__mark svg{width:22px;height:22px;fill:#D9A441}' +
    '.ace-gate .gate__h{margin:0;font-family:"Archivo Black","Archivo",system-ui,sans-serif;font-weight:400;' +
      'font-size:clamp(1.7rem,5.6vw,2.7rem);line-height:1.12;letter-spacing:-.01em;}' +
    '.ace-gate .gate__h>span{display:block}' +
    '.ace-gate .gate__ask{margin:-.35rem 0 0;font-family:"Archivo Black","Archivo",system-ui,sans-serif;font-weight:400;' +
      'font-size:clamp(1.7rem,5.6vw,2.7rem);line-height:1.12;letter-spacing:-.01em;color:#D9A441}' +
    '.ace-gate form{width:100%;display:grid;gap:.8rem;margin:0}' +
    '.ace-gate .gate__row{display:flex;gap:1.25rem .6rem;flex-wrap:wrap;justify-content:center}' +   // more room above the button once it wraps under the field
    // the field and button are the site's own: the contact form's field (.field input) and the gold .btn, ring and all
    '.ace-gate .gate__row .field{flex:1 1 15rem;min-width:0}' +
    '.ace-gate .field input{outline:none;text-align:left}' +
    '.ace-gate .field input::placeholder{color:#A29C93}' +
    '.ace-gate .field input[aria-invalid=true]{border-color:#E8836B}' +
    '.ace-gate .gate__row .btn{flex:0 0 auto}' +
    '.ace-gate .btn[disabled]{opacity:.6;cursor:progress}' +
    '.ace-gate .gate__msg{min-height:1.3em;margin:0;font-size:.9rem;color:#E8836B}' +
    '.ace-gate .gate__msg:empty{display:none}' +                 // no blank line under the button until there is something to say
    '.ace-gate .gate__hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}' +
    '@media (max-width:520px){.ace-gate .gate__row .btn{flex:1 1 100%}}' +
    '.ace-gate .gate__scene{position:absolute;inset:0;z-index:0;overflow:hidden}' +
    'html.gate-closing .ace-companion,html.gate-closing .ace-shadow{opacity:0!important;transition:opacity .25s ease!important}' +
    '.ace-gate .gate__card{position:relative;z-index:1}' +
    '.ace-gate.gate--scene{background:transparent;place-items:end center;padding-bottom:max(7vh,1.25rem)}' +
    'html.waitlist-open{scrollbar-gutter:stable}' +
    // phones: the card sits at the top instead, the same distance from the top as it is from the bottom elsewhere
    '@media (max-width:620px){.ace-gate.gate--scene{place-items:start center;padding-top:max(7vh,1.25rem,env(safe-area-inset-top));padding-bottom:max(1.25rem,env(safe-area-inset-bottom))}}' +
    // The box. The same on the gates and when an event page's waitlist button opens it (.gate--modal).
    // Sized so the copy sits in even, centred lines: each line balanced (text-wrap), and the measure wide enough
    // for "Get on the waitlist for 2027" to stay on one line.
    '.ace-gate:is(.gate--scene,.gate--modal) .gate__card{width:auto;max-width:100%;gap:.85rem}' +
    // wide enough for each line whole ("Time to get ready for the new year" on one line); below 640px they wrap, balanced
    '@media (min-width:640px){.ace-gate:is(.gate--scene,.gate--modal) .gate__h>span,.ace-gate:is(.gate--scene,.gate--modal) .gate__ask{white-space:nowrap}}' +
    '.ace-gate:is(.gate--scene,.gate--modal) .gate__h,.ace-gate:is(.gate--scene,.gate--modal) .gate__ask{font-size:clamp(1.2rem,3.3vw,1.7rem);text-wrap:balance}' +
    '.ace-gate:is(.gate--scene,.gate--modal) .gate__mark{display:none}' +
    // the site's form panel (.form): dark hairline, the cursor-lit gold ring from .lit; the fill is
    // mostly solid, so the type reads, with the spade and Little Ace still showing faintly through
    '.ace-gate:is(.gate--scene,.gate--modal) .gate__card{background:rgba(10,9,8,.8);border:1px solid var(--line-dark,#2E2A26);padding:clamp(1.2rem,2.4vw,1.8rem) clamp(1.4rem,3vw,2.4rem);' +
      '-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);box-shadow:0 24px 70px rgba(0,0,0,.45);' +
      'opacity:0;transform:translateY(18px) scale(.94);pointer-events:none}' +
    '.ace-gate.gate--ready .gate__card{opacity:1;transform:none;pointer-events:auto;' +
      'transition:opacity .5s ease,transform .7s cubic-bezier(.2,1.35,.4,1)}' +
    // once it has landed, it lifts on hover like the site's trays (.form:hover): up 6px, a gold border and a wide soft halo
    '.ace-gate.gate--settled .gate__card{transition:transform var(--t-mid,.3s) var(--ease,ease),' +
      'box-shadow var(--t-mid,.3s) var(--ease,ease),border-color var(--t-mid,.3s) var(--ease,ease)}' +
    '@media (hover:hover){.ace-gate.gate--settled .gate__card:hover{transform:translateY(-6px);border-color:rgba(217,164,65,.45);' +
      'box-shadow:0 0 0 1px rgba(217,164,65,.30),0 0 40px -6px rgba(217,164,65,.30),0 0 90px 8px rgba(217,164,65,.14),0 24px 70px rgba(0,0,0,.45)}}' +
    '@media (prefers-reduced-motion:reduce){.ace-gate.gate--settled .gate__card:hover{transform:none}}' +
    // the event pages' box: over a dimmed page, with a close button; Esc or a click outside also closes it
    '.ace-gate[hidden]{display:none!important}' +
    '.ace-gate.gate--modal{background:rgba(6,5,5,.72);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);opacity:0;transition:opacity .3s ease}' +
    '.ace-gate.gate--modal.gate--ready{opacity:1}' +
    '.ace-gate.gate--modal .gate__card{background:rgba(10,9,8,.86)}' +
    '.ace-gate .gate__close{position:absolute;top:.5rem;right:.5rem;width:40px;height:40px;display:grid;place-items:center;' +
      'background:none;border:0;color:var(--on-dark-mute,#A29C93);font-size:1.6rem;line-height:1;cursor:pointer}' +
    '.ace-gate .gate__close:hover,.ace-gate .gate__close:focus-visible{color:var(--gold,#D9A441)}' +
    'html.waitlist-open,html.waitlist-open body{overflow:hidden}' +
    // the entrance: the box shows only the headline (they are already on the list), and only once the gates are drawn
    '.ace-gate.gate--entry form,.ace-gate.gate--entry .gate__ask{display:none}' +
    '.ace-gate.gate--entry:not(.gate--scene) .gate__card{visibility:hidden}' +
    '.ace-gate.gate--leaving .gate__card{opacity:0!important;transform:scale(.97)!important;transition:opacity .25s ease,transform .25s ease!important}' +
    '@media (prefers-reduced-motion:no-preference){.ace-gate{transition:opacity .35s ease}.ace-gate.gate--out{opacity:0}}';
  (document.head || root).appendChild(css);

  /* The box: the gate's (id ace-gate) and, on pages with a [data-waitlist] button, the same box opened over the
     page (id ace-waitlist, with a close button). */
  function build(id, modal) {
    var g = document.createElement('div');
    g.id = id;
    g.className = 'ace-gate' + (modal ? ' gate--modal' : '');
    g.setAttribute('role', 'dialog');
    g.setAttribute('aria-modal', 'true');
    g.setAttribute('aria-labelledby', id + '-h ' + id + '-ask');
    g.innerHTML =
      '<div class="gate__card lit">' +
        (modal ? '<button type="button" class="gate__close" aria-label="Close">&times;</button>' : '') +
        '<span class="gate__mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 2.2c-.45 1.7-3.05 4.1-5.25 6C4.85 9.85 3.55 11.5 3.55 13.5c0 2.6 1.9 4.35 4.3 4.35 1.3 0 2.4-.5 3.1-1.5-.12 2.35-.9 4.05-2 5.05h6.1c-1.1-1-1.88-2.7-2-5.05.7 1 1.8 1.5 3.1 1.5 2.4 0 4.3-1.75 4.3-4.35 0-2-1.3-3.65-3.2-5.3-2.2-1.9-4.8-4.3-5.25-6Z"/></svg></span>' +
        '<h2 class="gate__h" id="' + id + '-h">' +
          '<span>2026 is wrapping up</span>' +
          '<span>Time to get ready for the new year</span>' +
        '</h2>' +
        '<p class="gate__ask ll" id="' + id + '-ask">Get on the waitlist for 2027</p>' +
        '<form novalidate>' +
          '<div class="gate__row">' +
            '<div class="field"><input type="email" name="email" placeholder="Your email address" autocomplete="email" inputmode="email" aria-label="Email address" aria-describedby="' + id + '-msg" required></div>' +
            '<button type="submit" class="btn btn--gold">Join the waitlist</button>' +
          '</div>' +
          '<div class="gate__hp" aria-hidden="true"><label>Leave this empty<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>' +
          '<p class="gate__msg" id="' + id + '-msg" role="status" aria-live="polite"></p>' +
        '</form>' +
      '</div>';
    return g;
  }

  var gate, inertObserver, scene = null;

  function lockOthers(keep) {
    var kids = document.body.children;
    for (var i = 0; i < kids.length; i++) if (kids[i] !== keep) kids[i].setAttribute('inert', '');
  }
  /* Open up: the box fades, then the gates swing all the way open, out past the screen edges, and are gone.
     ('ace:gate-open' tells main.js: on the home page the headline shines after a join, or, on an entrance, the
     intro it was holding back plays.) */
  function unlock() {
    if (inertObserver) inertObserver.disconnect();
    var kids = document.body.children;
    for (var i = 0; i < kids.length; i++) kids[i].removeAttribute('inert');
    var isEntry = gate.classList.contains('gate--entry');
    markEntered();                                   // just joined: the rest of this visit needs no entrance
    var done = function () {
      root.classList.remove('gate-locked', 'gate-closing', 'gate-entry');
      if (scene) { try { scene.dispose(); } catch (e) {} scene = null; }
      if (gate && gate.parentNode) gate.parentNode.removeChild(gate);
      try { document.dispatchEvent(new CustomEvent('ace:gate-open', { detail: { entry: isEntry } })); } catch (e) {}
    };
    if (REDUCED) { done(); return; }
    if (scene) {
      gate.classList.add('gate--leaving');
      setTimeout(function () { scene.open().then(done); }, 380);
    } else { gate.classList.add('gate--out'); setTimeout(done, 400); }
  }

  // Little Ace and friends add themselves to <body> after load: keep them out of reach while the gate is up.
  function guardAdded() {
    if (!('MutationObserver' in window)) return;
    inertObserver = new MutationObserver(function (list) {
      list.forEach(function (m) {
        [].forEach.call(m.addedNodes, function (n) { if (n.nodeType === 1 && n !== gate) n.setAttribute('inert', ''); });
      });
    });
    inertObserver.observe(document.body, { childList: true });
  }

  /* The entrance (see ENTERED above): the gates drawn shut with the headline on them, a beat, then unlock(). Until
     the gates are drawn the gate's own dark ground covers the page; no gates within 4s and it simply fades away. */
  function initEntry() {
    gate = build('ace-gate');
    gate.classList.add('gate--entry');
    document.body.appendChild(gate);
    lockOthers(gate);
    guardAdded();
    var card = gate.querySelector('.gate__card');
    var host = document.createElement('div'); host.className = 'gate__scene'; gate.insertBefore(host, card);
    var settled = false;
    var fallback = setTimeout(function () { if (!scene) { settled = true; unlock(); } }, 4000);
    sceneMod.then(function (m) {
      if (settled) return;
      scene = m.start(host, { reduced: false, closed: true, atlasUrl: 'assets/images/ace-atlas.webp?v=6' });
      clearTimeout(fallback);
      // two frames: the gates are on screen before the dark ground gives way to them
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        gate.classList.add('gate--scene');
        setTimeout(function () { gate.classList.add('gate--ready'); }, 250);
        setTimeout(unlock, 1900);
      }); });
    }).catch(function () { clearTimeout(fallback); if (!settled) { settled = true; scene = null; unlock(); } });
  }

  function proofOfWork(email, shownAt) {
    if (!(window.crypto && crypto.subtle && window.TextEncoder)) return Promise.resolve(null);
    var enc = new TextEncoder(), base = email + '|' + shownAt + '|', n = 0, BATCH = 512;
    function ok(b) { return b[0] === 0 && b[1] === 0; }            // POW_BITS = 16
    function step() {
      var jobs = [];
      for (var i = 0; i < BATCH; i++) jobs.push(crypto.subtle.digest('SHA-256', enc.encode(base + (n + i))));
      return Promise.all(jobs).then(function (res) {
        for (var i = 0; i < res.length; i++) if (ok(new Uint8Array(res[i]))) return n + i;
        n += BATCH;
        return new Promise(function (r) { setTimeout(r, 0); }).then(step);   // let the page breathe between batches
      });
    }
    return step();
  }

  function init() {
    gate = build('ace-gate');
    document.body.appendChild(gate);
    lockOthers(gate);
    var card = gate.querySelector('.gate__card');
    var shown = false;
    function reveal() {
      if (shown) return; shown = true;
      gate.classList.add('gate--ready');
      setTimeout(function () { gate.classList.add('gate--settled'); }, 750);   // after the pop-in, hover takes the site's easing
      card.removeAttribute('inert');
      setTimeout(function () { try { gate.querySelector('input[type=email]').focus({ preventScroll: true }); } catch (e) {} }, 120);
    }
    function plain() { gate.classList.remove('gate--scene'); reveal(); }
    if (sceneMod) {
      gate.classList.add('gate--scene');
      card.setAttribute('inert', '');
      var host = document.createElement('div'); host.className = 'gate__scene'; gate.insertBefore(host, card);
      // No scene within 4s (blocked or slow CDN, no WebGL): the plain gate, which covers the page at once.
      var fallback = setTimeout(function () { if (!scene) plain(); }, 4000);
      sceneMod.then(function (m) {
        if (shown) return;
        scene = m.start(host, { reduced: REDUCED, atlasUrl: 'assets/images/ace-atlas.webp?v=6' });
        clearTimeout(fallback);
        // The page shows through until the gates close. On the home page that is the moment Little Ace lands back
        // on his button after the intro (main.js sets data-intro-done); anywhere else, after a moment. 25s at most.
        var asked = Date.now(), HOLD = 0;                 // close the instant the signal comes
        var home = !!document.querySelector('[data-hero]');
        var doneAt = 0, cued = false, poll = 0;
        function cue(w) {
          if (cued) return;
          cued = true; clearTimeout(poll);
          root.classList.add('gate-closing');              // the page's Little Ace fades as the gates swing in
          scene.close();
          // ...and the one behind the gates carries on from that spot: if still in the air he finishes the fall, lands, then runs
          if (w) scene.handoff(w.x, w.h, w.airborne ? w.y : null, w.vy, w.vx);
          setTimeout(reveal, 7000);                        // the card arrives even if the swing stalls
        }
        function whenReady() {
          if (cued) return;
          var now = Date.now();
          if (!doneAt && (!home || root.hasAttribute('data-intro-done'))) doneAt = now;
          if (REDUCED || (doneAt && now - doneAt >= (home ? HOLD : 1200)) || now - asked > 25000) {
            // on the home page the hand-off still starts from wherever he is (normally just landed on his button)
            var A = home && window.AceCompanion;
            cue(A && A.where && !REDUCED ? A.where() : null);
            return;
          }
          poll = setTimeout(whenReady, 200);
        }
        // The hand-off: on his jump back down from ASSET, once he is falling, the page one fades and the gate one
        // takes over mid-fall, lands on the line it runs on, then runs. His landing on the button (above) is the
        // backstop if the drop is missed.
        // checked on a steady 16ms timer rather than on redraws, which a busy or throttled tab can space out
        var jumpWatch = 0;
        function watchJump() {
          if (cued) { clearInterval(jumpWatch); return; }
          var A = window.AceCompanion;
          if (A && A.where) {
            var w = A.where();
            // falling and either near that line or well into the drop (his button can sit above the line, so he
            // may never reach it on the page; the gate one then finishes the fall down to it)
            if (w.returning && w.airborne && w.vy > 0 && (w.y >= scene.floorY() - w.h * 0.6 || w.vy > 260)) { clearInterval(jumpWatch); cue(w); }
          }
        }
        if (home && !REDUCED) jumpWatch = setInterval(watchJump, 16);
        document.addEventListener('ace:intro-done', whenReady);   // react on the very frame he lands
        whenReady();
        return scene.closed.then(function () { setTimeout(reveal, REDUCED ? 0 : 260); });
      }).catch(function () { clearTimeout(fallback); if (host.parentNode) host.parentNode.removeChild(host); scene = null; if (!shown) plain(); });
    } else {
      reveal();
    }
    guardAdded();

    wire(gate, unlock);
  }

  /* The form inside a box: checks, bot defences, proof of work, the send, and the keyboard kept inside the
     dialog. saved() runs once the sheet confirms the address (or a bot has been shown its fake success).
     Returns shown(), which restarts the clock for a box that has just been opened. */
  function wire(box, saved) {
    var shownAt = Date.now(), human = false;
    ['keydown', 'pointerdown', 'touchstart', 'click'].forEach(function (t) {
      box.addEventListener(t, function (e) { if (e.isTrusted) human = true; }, true);
    });
    var form = box.querySelector('form');
    var input = form.elements.email;
    var hp = form.elements.website;
    var msg = box.querySelector('.gate__msg');
    var btn = form.querySelector('button[type=submit]');
    var busy = false;

    function say(t) {
      msg.textContent = t || '';
      input.setAttribute('aria-invalid', t ? 'true' : 'false');
    }
    input.addEventListener('input', function () { if (msg.textContent) say(''); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      var email = (input.value || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        say('Use a full email address, like name@company.com.');
        input.focus();
        return;
      }
      // a person never fills the hidden field; a bot usually does. Look like success, send nothing.
      var bot = !!hp.value || !human || navigator.webdriver === true;
      if (bot) { remember(true); saved(); return; }

      if (!WAITLIST_URL) {
        if (window.console) console.warn('[gate] WAITLIST_URL is empty: the email was NOT saved anywhere. Opening for this browser session only.');
        remember(false);
        saved();
        return;
      }

      busy = true; btn.disabled = true; btn.textContent = 'Sending…'; say('');
      function fail() {
        busy = false; btn.disabled = false; btn.textContent = 'Join the waitlist';
        say('That did not go through. Please try again in a moment.');
      }
      // a person who fills the field and taps in under a second (autofill) simply waits out the rest of MIN_MS
      var pause = new Promise(function (r) { setTimeout(r, Math.max(0, MIN_MS - (Date.now() - shownAt))); });
      Promise.all([proofOfWork(email.toLowerCase(), shownAt), pause]).then(function (all) {
        var nonce = all[0];
        var body = JSON.stringify({
          email: email,
          page: location.pathname.split('/').pop() || 'index.html',
          referrer: document.referrer || '',
          shown: shownAt,
          sent: Date.now(),
          nonce: nonce,
          hp: hp.value || ''
        });
        // text/plain keeps this a "simple" request (no preflight), and Apps Script answers it with CORS headers, so
        // the reply can be READ. The visitor is let in only when the sheet itself says it saved the address; a 403,
        // an outage or a bad deployment shows the error instead of quietly losing the email.
        return fetch(WAITLIST_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: body })
          .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
          .then(function (j) {
            if (!j || j.ok !== true) throw new Error('not saved');
            busy = false;
            remember(true); saved();
          });
      }).catch(fail);
    });

    // keep the keyboard inside the dialog
    box.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = box.querySelectorAll('input:not([tabindex="-1"]),button:not([disabled])');
      if (!f.length) return;
      var first = f[0], lastEl = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
    });

    return {
      shown: function () {
        shownAt = Date.now(); busy = false;
        btn.disabled = false; btn.textContent = 'Join the waitlist'; say('');
      }
    };
  }

  /* The event pages: a [data-waitlist] button opens the same box over the page. Built now, with the gate, so that
     main.js (deferred) dresses it like the gate's: steel heading, molten line, the gold edge light. */
  var modal = null, modalApi = null, opener = null, closeTimer = 0;
  function setupModal() {
    if (modal || !document.querySelector('[data-waitlist]')) return;
    modal = build('ace-waitlist', true);
    modal.hidden = true;
    document.body.appendChild(modal);
    modalApi = wire(modal, function () {
      var btn = modal.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'You’re on the list';
      closeTimer = setTimeout(closeModal, 1600);
    });
    modal.addEventListener('click', function (e) {
      if (e.target === modal || (e.target.closest && e.target.closest('.gate__close'))) closeModal();
    });
    modal.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-waitlist]');
      if (!t || root.classList.contains('gate-locked')) return;
      e.preventDefault();
      openModal(t);
    });
  }
  function openModal(from) {
    clearTimeout(closeTimer);
    opener = from || null;
    modalApi.shown();
    modal.querySelector('form').reset();
    modal.hidden = false;
    root.classList.add('waitlist-open');
    lockOthers(modal);
    modal.removeAttribute('inert');
    requestAnimationFrame(function () { requestAnimationFrame(function () { modal.classList.add('gate--ready'); }); });
    setTimeout(function () { modal.classList.add('gate--settled'); }, 750);
    setTimeout(function () { try { modal.querySelector('input[type=email]').focus({ preventScroll: true }); } catch (e) {} }, 120);
  }
  function closeModal() {
    if (!modal || modal.hidden) return;
    clearTimeout(closeTimer);
    modal.classList.remove('gate--ready', 'gate--settled');
    root.classList.remove('waitlist-open');
    var kids = document.body.children;
    for (var i = 0; i < kids.length; i++) kids[i].removeAttribute('inert');
    setTimeout(function () { modal.hidden = true; }, REDUCED ? 0 : 320);
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  }

  /* Built as soon as the body has been parsed, before main.js runs (it is deferred), so that main.js dresses the
     card like the rest of the site: steel headings, the molten gold line and the gold edge light on the box. */
  var started = false;
  function go() { if (started || !document.body) return; started = true; if (locked) init(); else if (entry) initEntry(); setupModal(); }
  if (document.readyState !== 'loading') go();
  else document.addEventListener('readystatechange', function rs() {
    if (document.readyState === 'loading') return;
    document.removeEventListener('readystatechange', rs);
    go();
  });
  document.addEventListener('DOMContentLoaded', go);
})();
