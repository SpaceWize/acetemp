/* CHRISTMAS SWITCH. true = Santa hat on every animation (assets/images/ace-atlas-xmas.webp, which is the
   normal sheet with the hat frames in the same cells; climb included; the chat pose has its own sheet, ace-chat-pose-xmas.webp).
   Set to false to go back. When true it also loads xmas.js (snowfall and a snowbank). Read by gate-scene (below) and by companion.js through window.ACE_ATLAS. */
window.ACE_XMAS=(function(){try{return localStorage.getItem('ace-xmas')==='on';}catch(e){return false;}})();   // the chat's Christmas switch (off unless a visitor turns it on)
window.ACE_ATLAS='assets/images/'+(window.ACE_XMAS?'ace-atlas-xmas.webp?v=8':'ace-atlas.webp?v=14');
if(window.ACE_XMAS){const s=document.createElement('script');s.src='xmas.js?v=28';s.defer=true;document.head.append(s);}   // snow + snowbank
/* ACE SPADERS — the 2027 waitlist gate.                              (rebuilt 2026-11-07)

   Every page loads this in <head>. Three things it does:
   1. THE GATE. A visitor who has not joined sees the page (on the home page, the intro) through pearly gates
      standing open; the gates swing shut (gate-scene.js, three.js) and the waitlist box appears on them. Joining
      swings them open again. No WebGL, or the scene not ready in 4s: a plain dark gate with the same box.
   2. THE ENTRANCE. Someone already on the list comes in through the gates once per visit: shut, the headline on
      them, then they swing open. The footer's "See the gate again" plays this again on demand.
   3. THE BOX ON EVENT PAGES. A [data-waitlist] button opens the same box over the page.

   WHAT WAS WRONG WITH THE OLD ONE, AND THE RULES THIS ONE KEEPS
   - The box could sit on screen but refuse typing (it stayed "inert" until an animation finished), and a join
     could be saved yet still report "That did not go through" if anything in the opening animation failed.
   - So: the animation is decoration only. The box is usable the moment it is visible, and it is visible within
     a fixed time whatever the 3D scene does. Every animated step has a timeout. Nothing after a confirmed save
     can turn it into an error.
   - Nobody can be trapped: after a failed send the box shows what went wrong (a short code), an email address
     to write to, and "Continue to the site" for this visit.
   - The visitor's clock is never trusted (the sheet's script does not use it either).
   - Support: add ?gate=reset to any address to make this browser forget it has joined, ?gate=show to see the
     entrance again.

   The sheet's side is tools/waitlist-apps-script.gs. It accepts this page's sends and the old page's. */
(function () {
  'use strict';

  /* ── settings ───────────────────────────────────────────────── */
  var WAITLIST_URL = 'https://script.google.com/macros/s/AKfycbwRub8l8LauagWedq_6iBhvU0G50PWcpYg02KWfncxomim-FAhTo7C16CDK4s1EbYY6/exec';
  var CONTACT = 'info@acespaders.com';
  var tr = function (s) { return window.ACE_TR ? window.ACE_TR(s) : s; };   // the translated line when the page is not in English
  var KEY = 'ace-waitlist-v1';            // bump (and COOKIE) to ask everyone again: a new list, a new year
  var COOKIE = 'ace_waitlist_v1';
  var ENTERED = 'ace-entered-v1';         // this visit has been through the gates
  var SCENE_URL = './gate-scene.js?v=9';
  var ATLAS = window.ACE_ATLAS || 'assets/images/ace-atlas.webp?v=14';
  var POW_BITS = 16;                      // proof of work; the sheet accepts 14 and up
  var POW_BUDGET_MS = 6000;               // a browser slower than this sends without a proof (the sheet still takes it)
  var MIN_MS = 1500;                      // the send waits until the box has been up this long (people are not instant)
  var SEND_TIMEOUT_MS = 20000;
  var SCENE_WAIT_MS = 4000;               // the 3D gates must be running by then, or the plain gate is used
  var CLOSE_BY_MS = 11000;                 // the gates start to close by then at the latest (the home page waits for its intro)
  var CARD_BY_MS = 4500;                  // ...and the box is on them by this long after they start to close
  var OPEN_MAX_MS = 2600;                 // the opening swing is cut off after this

  var root = document.documentElement;
  var REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var T0 = Date.now();

  /* ── memory: "already on the list" in localStorage, with a cookie as a backup ── */
  function tryGet(s, k) { try { return window[s].getItem(k); } catch (e) { return null; } }
  function trySet(s, k, v) { try { window[s].setItem(k, v); return true; } catch (e) { return false; } }
  function tryDel(s, k) { try { window[s].removeItem(k); } catch (e) {} }
  function joined() { return !!tryGet('localStorage', KEY) || !!tryGet('sessionStorage', KEY + '-session') || document.cookie.indexOf(COOKIE + '=1') !== -1; }
  function remember() {
    trySet('localStorage', KEY, String(Date.now()));
    try { document.cookie = COOKIE + '=1; max-age=' + 60 * 60 * 24 * 365 * 2 + '; path=/; SameSite=Lax'; } catch (e) {}
  }
  function rememberForVisit() { trySet('sessionStorage', KEY + '-session', '1'); }
  function forget() {
    tryDel('localStorage', KEY); tryDel('sessionStorage', KEY + '-session'); tryDel('sessionStorage', ENTERED);
    try { document.cookie = COOKIE + '=; max-age=0; path=/; SameSite=Lax'; } catch (e) {}
  }
  function markEntered() { trySet('sessionStorage', ENTERED, '1'); }
  function enteredThisVisit() {
    if (tryGet('sessionStorage', ENTERED)) return true;
    if (!trySet('sessionStorage', 'ace-probe', '1')) return true;   // storage blocked: count as entered, or it would replay on every page
    tryDel('sessionStorage', 'ace-probe');                          // the probe only tests that storage works; it is not kept
    return false;
  }

  var q = location.search || '';
  if (/[?&]gate=reset\b/.test(q)) forget();
  var forceShow = /[?&]gate=show\b/.test(q);

  var locked = !joined();
  var entry = !locked && !REDUCED && (forceShow || !enteredThisVisit());
  if (locked || entry) root.classList.add('gate-locked');
  if (entry) { root.classList.add('gate-entry'); markEntered(); }     // main.js holds the home intro until the gates open

  /* ── the 3D scene, fetched early (only for those who will see it) ── */
  var sceneMod = null;
  function loadScene() {
    if (sceneMod) return sceneMod;
    try {
      var pc = document.createElement('link'); pc.rel = 'preconnect'; pc.href = 'https://cdn.jsdelivr.net'; pc.crossOrigin = '';
      (document.head || root).appendChild(pc);
      sceneMod = import(SCENE_URL);
    } catch (e) { sceneMod = Promise.reject(e); }
    sceneMod.catch(function () {});
    return sceneMod;
  }
  if (locked || entry) loadScene();
  function withTimeout(p, ms) {
    return new Promise(function (res, rej) {
      var t = setTimeout(function () { rej(new Error('timeout')); }, ms);
      p.then(function (v) { clearTimeout(t); res(v); }, function (e) { clearTimeout(t); rej(e); });
    });
  }

  /* ── styles (in the head, so the lock holds before the body exists) ── */
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
    '@media (prefers-reduced-motion:no-preference){.ace-gate{transition:opacity .35s ease}.ace-gate.gate--out{opacity:0}}' +
    // added in the rebuild: the help line under a failed send
    '.ace-gate .gate__help{margin:0;font-size:.88rem;line-height:1.5;color:var(--on-dark-mute,#A29C93);text-wrap:balance}' +
    '.ace-gate .gate__help[hidden]{display:none}' +
    '.ace-gate .gate__help a{color:var(--gold,#D9A441)}' +
    '.ace-gate .gate__skip{appearance:none;background:none;border:0;padding:0;margin:0 0 0 .3em;font:inherit;color:var(--gold,#D9A441);' +
      'text-decoration:underline;text-underline-offset:.2em;cursor:pointer}' +
    '.ace-gate.gate--modal .gate__skip{display:none}' +
    // "Been here before?": very small, bottom right, only once the box is up
    '.ace-gate .gate__been{position:absolute;z-index:2;right:max(.7rem,env(safe-area-inset-right));bottom:max(.6rem,env(safe-area-inset-bottom));' +
      'appearance:none;background:none;border:0;padding:.35rem .4rem;margin:0;font:400 .68rem/1 "Instrument Sans",system-ui,sans-serif;letter-spacing:.02em;' +
      'color:rgba(162,156,147,.75);cursor:pointer;opacity:0;pointer-events:none;transition:opacity .4s ease,color .2s ease;' +
      '-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}' +
    '.ace-gate.gate--ready .gate__been{opacity:1;pointer-events:auto}' +
    '.ace-gate .gate__been:hover{color:var(--gold,#D9A441);text-decoration:underline;text-underline-offset:.2em}';
  (document.head || root).appendChild(css);

  /* ── the box ── */
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
          '<p class="gate__help" hidden><span>Still not working? Email </span><a href="mailto:' + CONTACT + '?subject=Waitlist%202027">' + CONTACT + '</a><span> and you will be added by hand.</span>' +
            '<button type="button" class="gate__skip">Continue to the site</button></p>' +
        '</form>' +
      '</div>';
    return g;
  }

  /* ── the rest of the page is out of reach while a box is up ── */
  var guard = null;
  function holdPage(keep) {
    var kids = document.body.children;
    for (var i = 0; i < kids.length; i++) if (kids[i] !== keep) kids[i].setAttribute('inert', '');
    if (guard) guard.disconnect();
    if ('MutationObserver' in window) {
      guard = new MutationObserver(function (list) {               // Little Ace and friends add themselves later
        list.forEach(function (m) { [].forEach.call(m.addedNodes, function (n) { if (n.nodeType === 1 && n !== keep) n.setAttribute('inert', ''); }); });
      });
      guard.observe(document.body, { childList: true });
    }
  }
  function releasePage() {
    if (guard) { guard.disconnect(); guard = null; }
    var kids = document.body.children;
    for (var i = 0; i < kids.length; i++) kids[i].removeAttribute('inert');
  }
  function trapTab(box) {
    box.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = [].filter.call(box.querySelectorAll('input:not([tabindex="-1"]),button:not([disabled]):not([tabindex="-1"]),a[href]'), function (el) { return el.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], lastEl = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
    });
  }

  /* ── sending ── */
  function proofOfWork(email, salt) {
    if (!(window.crypto && crypto.subtle && window.TextEncoder)) return Promise.resolve(null);
    var enc = new TextEncoder(), base = email + '|' + salt + '|', n = 0, BATCH = 256, until = Date.now() + POW_BUDGET_MS;
    function ok(b) { return b[0] === 0 && b[1] === 0; }            // 16 zero bits
    function step() {
      if (Date.now() > until) return null;                         // too slow: send without one
      var jobs = [];
      for (var i = 0; i < BATCH; i++) jobs.push(crypto.subtle.digest('SHA-256', enc.encode(base + (n + i))));
      return Promise.all(jobs).then(function (res) {
        for (var i = 0; i < res.length; i++) if (ok(new Uint8Array(res[i]))) return n + i;
        n += BATCH;
        return new Promise(function (r) { setTimeout(r, 0); }).then(step);
      });
    }
    return Promise.resolve().then(step).catch(function () { return null; });
  }
  /* Resolves {ok:true} once the sheet confirms (or, when a reply cannot be read at all, once a blind resend has
     gone out), else {ok:false, code}. Never rejects. */
  function send(payload) {
    var body = JSON.stringify(payload);
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, SEND_TIMEOUT_MS);
    function blind() {                                   // shares the first send's abort, so the whole send is bounded by SEND_TIMEOUT_MS
      return fetch(WAITLIST_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: body, signal: ctl ? ctl.signal : undefined })
        .then(function () { return { ok: true, blind: true }; }, function (err) { return { ok: false, code: err && err.name === 'AbortError' ? 'timeout' : 'network' }; });
    }
    return fetch(WAITLIST_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: body, signal: ctl ? ctl.signal : undefined })
      .then(function (r) {
        if (!r.ok) return { ok: false, code: 'http ' + r.status };
        return r.json().then(function (j) {
          return j && j.ok === true ? { ok: true } : { ok: false, code: String((j && j.error) || 'refused').slice(0, 24) };
        }, function () { return { ok: false, code: 'reply' }; });
      }, function (err) {
        if (err && err.name === 'AbortError') return { ok: false, code: 'timeout' };
        return blind();                                  // blocked or unreadable reply: it may well have arrived; send once more, blind
      })
      .then(function (res) { clearTimeout(timer); return res; });
  }

  /* The form inside a box. opts.onSaved() runs once the address is safe (or a bot has been given its fake
     success); opts.onSkip() for "Continue to the site". Returns { shown() } to restart its stopwatch. */
  function wire(box, opts) {
    var form = box.querySelector('form');
    var input = form.elements.email, hp = form.elements.website;
    var msg = box.querySelector('.gate__msg'), help = box.querySelector('.gate__help');
    var btn = form.querySelector('button[type=submit]');
    var shownAt = Date.now(), human = false, busy = false;
    ['keydown', 'pointerdown', 'touchstart', 'click', 'input'].forEach(function (t) {
      box.addEventListener(t, function (e) { if (e.isTrusted) human = true; }, true);
    });
    function say(t, withHelp) {
      msg.textContent = t || '';
      input.setAttribute('aria-invalid', t ? 'true' : 'false');
      help.hidden = !withHelp;
    }
    function idle() { busy = false; btn.disabled = false; btn.textContent = tr('Join the waitlist'); }
    input.addEventListener('input', function () { if (msg.textContent && !busy) say('', !help.hidden); });
    box.querySelector('.gate__skip').addEventListener('click', function () { if (opts.onSkip) opts.onSkip(); });
    function succeed() {
      busy = false;
      try { opts.onSaved(); } catch (e) { hardOpen(); }        // nothing after a save may turn into an error
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      var email = (input.value || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { say(tr('Use a full email address, like name@company.com.')); input.focus(); return; }
      // a person never fills the hidden field and always touches the page first; a bot gets the same success, nothing is sent
      if (hp.value || !human || navigator.webdriver === true) { succeed(); return; }
      busy = true; btn.disabled = true; btn.textContent = tr('Sending…'); say('');
      var salt = String(shownAt);                       // the moment the box appeared: the same salt the old sheet script expects
      var wait = new Promise(function (r) { setTimeout(r, Math.max(0, MIN_MS - (Date.now() - shownAt))); });
      Promise.all([proofOfWork(email.toLowerCase(), salt), wait]).then(function (all) {
        return send({
          email: email, salt: salt, nonce: all[0], elapsed: Date.now() - shownAt,
          shown: shownAt, sent: Date.now(),             // for the sheet script still deployed until it is updated (it checks these)
          page: location.pathname.split('/').pop() || 'index.html', referrer: document.referrer || '',
          ua: (navigator.userAgent || '').slice(0, 160), hp: ''
        });
      }).then(function (res) {
        if (res.ok) { succeed(); return; }
        idle();
        say(res.code === 'bad email' ? tr('Use a full email address, like name@company.com.')
          : res.code === 'busy' ? tr('Lots of people are joining right now. Please try again in a minute.') + ' (busy)'
          : tr('That did not go through. Please try again in a moment.') + ' (' + res.code + ')', res.code !== 'bad email');
      }, function () { idle(); say(tr('That did not go through. Please try again in a moment.') + ' (error)', true); });
    });
    trapTab(box);
    return {
      shown: function () { shownAt = Date.now(); idle(); say(''); },
      focus: function () { try { input.focus({ preventScroll: true }); } catch (e) {} }
    };
  }

  /* ── opening up: the box fades, the gates swing open, everything is handed back. Cannot hang. ── */
  var gate = null, scene = null, opening = false;
  // initGate's watchers for the moment to close (a 150ms poll and, on the home page, the 16ms hand-off check).
  // Module-level so that opening the gate early (a join or "Been here before?" before they close) stops them too.
  var closePoll = 0, handoffWatch = 0;
  function stopWatching() { clearTimeout(closePoll); clearInterval(handoffWatch); closePoll = 0; handoffWatch = 0; }
  function takeDown(g, sc) {                             // the teardown shared by openUp() and hardOpen()
    root.classList.remove('gate-locked', 'gate-closing', 'gate-entry');
    if (sc) { try { sc.dispose(); } catch (e) {} }
    if (g && g.parentNode) g.parentNode.removeChild(g);
    if (gate === g) { gate = null; scene = null; }
    opening = false;
  }
  function openUp(detail) {
    if (opening || !gate) return;
    opening = true;
    stopWatching();
    releasePage();
    markEntered();
    var g = gate, sc = scene, finished = false;
    function done() {
      if (finished) return; finished = true;
      takeDown(g, sc);
      try { document.dispatchEvent(new CustomEvent('ace:gate-open', { detail: detail || { entry: false } })); } catch (e) {}
    }
    if (REDUCED || !sc) { g.classList.add('gate--out'); setTimeout(done, REDUCED ? 0 : 400); return; }
    g.classList.add('gate--leaving');
    setTimeout(function () {
      try { Promise.resolve(sc.open()).then(done, done); } catch (e) { done(); }
    }, 380);
    setTimeout(done, 380 + OPEN_MAX_MS);
  }
  function hardOpen() {                                  // last resort: take everything down now
    stopWatching();
    releasePage();
    takeDown(gate, scene);
  }

  /* ── 1. the gate, for someone not on the list ── */
  function initGate() {
    gate = build('ace-gate');
    document.body.appendChild(gate);
    holdPage(gate);
    var card = gate.querySelector('.gate__card');
    var form = wire(gate, {
      onSaved: function () { remember(); openUp({ entry: false }); },
      onSkip: function () { rememberForVisit(); openUp({ entry: false }); }
    });
    beenHere();
    var shown = false;
    function showCard() {
      if (shown || !gate) return; shown = true;
      gate.classList.add('gate--ready');
      setTimeout(function () { if (gate) gate.classList.add('gate--settled'); }, 750);
      form.shown();
      setTimeout(form.focus, 120);
    }
    function plain() { if (!gate) return; gate.classList.remove('gate--scene'); showCard(); }
    if (!sceneMod) { plain(); return; }

    gate.classList.add('gate--scene');                  // see-through until the gates close
    var host = document.createElement('div'); host.className = 'gate__scene'; gate.insertBefore(host, card);
    // the backstop: the box is on screen and usable by then, whatever the scene is doing
    setTimeout(function () { if (!shown) { if (!scene) plain(); else showCard(); } }, CLOSE_BY_MS + CARD_BY_MS);

    withTimeout(sceneMod, SCENE_WAIT_MS).then(function (m) {
      if (shown || !gate) return;
      try { scene = m.start(host, { reduced: REDUCED, atlasUrl: ATLAS }); } catch (e) { scene = null; plain(); return; }
      var home = !!document.querySelector('[data-hero]');
      var cued = false;
      function cue(w) {
        if (cued) return;
        if (!gate) { stopWatching(); return; }
        cued = true;
        stopWatching();
        root.classList.add('gate-closing');              // the page's Little Ace fades as the gates swing in
        try {
          scene.close();
          if (w) scene.handoff(w.x, w.h, w.airborne ? w.y : null, w.vy, w.vx);   // the one behind the gates carries on from that spot
        } catch (e) {}
        setTimeout(showCard, CARD_BY_MS);
        try { withTimeout(scene.closed, CARD_BY_MS).then(function () { setTimeout(showCard, REDUCED ? 0 : 260); }, function () {}); } catch (e) {}
      }
      function where() { var A = window.AceCompanion; try { return A && A.where && !REDUCED ? A.where() : null; } catch (e) { return null; } }
      // close when the home intro has finished (Little Ace back on his button), elsewhere after a moment; never later than CLOSE_BY_MS
      var shutAt = 0;
      function check() {
        if (cued) return;
        var now = Date.now();
        if (!shutAt && (!home || root.hasAttribute('data-intro-done'))) shutAt = now + (home ? 0 : 1200);
        if (REDUCED || (shutAt && now >= shutAt) || now - T0 > CLOSE_BY_MS) { cue(home ? where() : null); return; }
        closePoll = setTimeout(check, 150);
      }
      // the hand-off: on his jump back down from ASSET, once he is falling, the gate's Little Ace takes over mid-fall
      if (home && !REDUCED) handoffWatch = setInterval(function () {
        var w = where();
        if (w && w.returning && w.airborne && w.vy > 0) { var f = 0; try { f = scene.floorY(); } catch (e) {} if (w.y >= f - w.h * 0.6 || w.vy > 260) cue(w); }
      }, 16);
      document.addEventListener('ace:intro-done', check);
      check();
    }, function () { plain(); });
  }

  /* "Been here before?": in without an email, for someone who has joined on another device or browser. A real
     mouse click or finger tap only: not reachable with Tab, a key press on it is ignored, and so is any click a
     script makes (untrusted, or with no real press on the button just before it). */
  function beenHere() {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'gate__been';
    b.textContent = 'Been here before?';
    b.tabIndex = -1;
    b.setAttribute('aria-hidden', 'true');
    var pressedAt = 0;
    b.addEventListener('pointerdown', function (e) {
      pressedAt = e.isTrusted && /^(mouse|touch|pen)$/.test(e.pointerType || '') ? Date.now() : 0;
    });
    b.addEventListener('keydown', function (e) { e.preventDefault(); });          // Enter / Space do nothing
    b.addEventListener('click', function (e) {
      e.preventDefault();
      var real = e.isTrusted && e.detail >= 1 && pressedAt && Date.now() - pressedAt < 2000 && navigator.webdriver !== true;
      pressedAt = 0;
      if (!real || !gate) return;
      remember();                                        // they said they are on the list: do not ask again here
      openUp({ entry: false });
    });
    gate.appendChild(b);
  }

  /* ── 2. the entrance (on the list: once per visit, or on request) ── */
  function initEntry(replay) {
    if (gate) return;
    gate = build('ace-gate');
    gate.classList.add('gate--entry');
    document.body.appendChild(gate);
    holdPage(gate);
    if (replay) root.classList.add('gate-locked');
    var detail = { entry: !replay };                     // a replay is not an entrance: the home headline shines after it
    var card = gate.querySelector('.gate__card');
    if (REDUCED) { gate.classList.add('gate--ready'); setTimeout(function () { openUp(detail); }, 1400); return; }
    var host = document.createElement('div'); host.className = 'gate__scene'; gate.insertBefore(host, card);
    var settled = false;
    function giveUp() { if (settled) return; settled = true; scene = null; openUp(detail); }
    withTimeout(loadScene(), replay ? 6000 : SCENE_WAIT_MS).then(function (m) {
      if (settled || !gate) return;
      try { scene = m.start(host, { reduced: false, closed: true, atlasUrl: ATLAS }); } catch (e) { giveUp(); return; }
      settled = true;
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        if (!gate) return;
        gate.classList.add('gate--scene');
        setTimeout(function () { if (gate) gate.classList.add('gate--ready'); }, 250);
        setTimeout(function () { openUp(detail); }, 1900);
      }); });
    }, giveUp);
  }

  /* ── 3. the box over an event page ── */
  var modal = null, modalForm = null, opener = null, closeTimer = 0;
  function setupModal() {
    if (modal || !document.querySelector('[data-waitlist]')) return;
    modal = build('ace-waitlist', true);
    modal.hidden = true;
    document.body.appendChild(modal);
    modalForm = wire(modal, {
      onSaved: function () {
        remember();
        var btn = modal.querySelector('button[type=submit]');
        btn.disabled = true; btn.textContent = 'You’re on the list';
        closeTimer = setTimeout(closeModal, 1600);
      }
    });
    modal.addEventListener('click', function (e) { if (e.target === modal || (e.target.closest && e.target.closest('.gate__close'))) closeModal(); });
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
    modal.querySelector('form').reset();
    modalForm.shown();
    modal.hidden = false;
    root.classList.add('waitlist-open');
    holdPage(modal);
    requestAnimationFrame(function () { requestAnimationFrame(function () { modal.classList.add('gate--ready'); }); });
    setTimeout(function () { modal.classList.add('gate--settled'); }, 750);
    setTimeout(modalForm.focus, 120);
  }
  function closeModal() {
    if (!modal || modal.hidden) return;
    clearTimeout(closeTimer);
    modal.classList.remove('gate--ready', 'gate--settled');
    root.classList.remove('waitlist-open');
    releasePage();
    setTimeout(function () { modal.hidden = true; }, REDUCED ? 0 : 320);
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  }

  /* ── the footer's "See the gate again" ── */
  function setupReplay() {
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-gate-replay]');
      if (!b) return;
      e.preventDefault();
      if (gate || root.classList.contains('gate-locked')) return;
      initEntry(true);
    });
  }

  /* ── start, as soon as the body exists (before main.js, which dresses the box like the rest of the site) ── */
  var started = false;
  function go() {
    if (started || !document.body) return;
    started = true;
    try {
      if (locked) initGate();
      else if (entry) initEntry(false);
    } catch (e) { hardOpen(); }                          // a broken gate must never leave the page locked
    try { setupModal(); setupReplay(); } catch (e) {}
  }
  if (document.readyState !== 'loading') go();
  else document.addEventListener('readystatechange', function rs() {
    if (document.readyState === 'loading') return;
    document.removeEventListener('readystatechange', rs);
    go();
  });
  document.addEventListener('DOMContentLoaded', go);
})();
