/* ── LANGUAGES ─────────────────────────────────────────────────
   The English in each page's HTML stays the source. For a visitor whose browser asks for one of the languages below, this
   swaps the text from i18n/common.js (header and footer) and i18n/<page>.js. A dictionary matches on an element's whole
   text, so a sentence edited later in the HTML just shows the new English until it is translated: nothing breaks.
   Choosing: the picker in the header (or ?lang=xx) wins and is remembered (?lang=auto forgets it), then the browser's
   language. The English dialects are opt-in: only the picker gives them, so an English browser sees the page as written.
   Only pages in PAGES are translated so far. Loaded in <head>, so the page stays hidden (1.5s at most) until it is ready. */
(function () {
  'use strict';
  var PAGES = ['premium-pickup-transport.html', 'advisory.html'], V = 23;
  var LANGS = ['ja', 'da', 'ru', 'ar', 'de', 'he', 'fr', 'yue', 'zh', 'tl', 'en-GB', 'en-US', 'en-CA', 'en-NL', 'en-AU'], RTL = { ar: 1, he: 1 }, KEY = 'ace-lang';
  function pick() {
    var forced = null;
    try {
      var q = new URLSearchParams(location.search).get('lang');
      if (q === 'auto') localStorage.removeItem(KEY);
      else if (LANGS.indexOf(q) >= 0) localStorage.setItem(KEY, q);
      forced = localStorage.getItem(KEY);
    } catch (e) {}
    if (forced === 'orig') return null;                     // chose the original in the picker
    if (LANGS.indexOf(forced) >= 0) return forced;
    var two = (navigator.language || '').toLowerCase().split('-')[0];
    var full = (navigator.language || '').toLowerCase();
    if (two === 'iw') two = 'he';
    if (two === 'fil') two = 'tl';
    if (two === 'zh' && /-(hk|mo)$/.test(full)) two = 'yue';    // Hong Kong and Macau: Cantonese
    return LANGS.indexOf(two) >= 0 && two.indexOf('en') !== 0 ? two : null;
  }
  var lang = pick();
  window.ACE_LANG = lang;                                     // null: the page as written
  var page = location.pathname.split('/').pop() || 'index.html';
  if (PAGES.indexOf(page) < 0) return;

  /* The picker: a globe and a short code, with a real <select> laid invisibly over them, so phones get their own list. */
  var PICK = [['orig', 'English (original)', 'EN'], ['ja', 'Japanese', 'JA'], ['da', 'Danish', 'DA'], ['ru', 'Russian', 'RU'], ['ar', 'Arabic', 'AR'], ['de', 'German', 'DE'], ['he', 'Hebrew', 'HE'], ['fr', 'French', 'FR'], ['yue', 'Cantonese', 'YUE'], ['zh', 'Mandarin', 'ZH'], ['tl', 'Tagalog', 'TL'], ['en-GB', 'British English', 'UK'], ['en-US', 'American English', 'US'], ['en-CA', 'Canadian English', 'CA'], ['en-NL', 'Newfoundland English', 'NF'], ['en-AU', 'Australian English', 'AU']];
  var css = document.createElement('style');
  css.textContent = '.ace-lang{position:relative;display:inline-flex;align-items:center;gap:6px;flex:none;height:38px;padding:0 10px;margin-inline:10px;border:1px solid rgba(217,164,65,.45);color:#F1EDE6;font:600 12px/1 system-ui,sans-serif;letter-spacing:.06em}.ace-lang:hover{border-color:#D9A441}.ace-lang:focus-within{outline:2px solid #D9A441;outline-offset:2px}.ace-lang svg{width:15px;height:15px;fill:none;stroke:#D9A441;stroke-width:1.6}.ace-lang select{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;font-size:16px}.ace-lang option{background:#121110;color:#F1EDE6}html[dir=rtl] .skip{left:auto;right:-9999px}html[dir=rtl] .skip:focus{left:auto;right:1rem}html[dir=rtl] .hero__back svg{transform:none}';
  document.head.appendChild(css);
  function addPicker() {
    var spot = document.querySelector('.burger');
    if (!spot) return;
    var cur = lang || 'orig', box = document.createElement('label');
    box.className = 'ace-lang';
    box.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg><span aria-hidden="true">' + PICK.filter(function (o) { return o[0] === cur; })[0][2] + '</span><select aria-label="Language"></select>';
    var sel = box.querySelector('select');
    PICK.forEach(function (o) { var e = document.createElement('option'); e.value = o[0]; e.textContent = o[1]; sel.appendChild(e); });
    sel.value = cur;
    sel.addEventListener('change', function () {
      try { localStorage.setItem(KEY, sel.value); } catch (e) {}
      location.href = location.pathname + location.hash;
    });
    spot.parentNode.insertBefore(box, spot);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addPicker); else addPicker();
  if (!lang) return;

  var root = document.documentElement, M = '<a href="mastermind-membership.html">Invested Aces Mastermind</a>', sets = [];
  root.classList.add('i18n-wait');
  var hide = document.createElement('style');
  hide.textContent = 'html.i18n-wait body{visibility:hidden}';
  document.head.appendChild(hide);
  function show() { root.classList.remove('i18n-wait'); }
  setTimeout(show, 1500);
  window.ACE_I18N = function (src, tr) { sets.push({ src: src, tr: tr[lang] || {} }); };

  var clean = function (s) { return s.replace(/\s+/g, ' ').trim(); };
  function apply() {
    var map = Object.create(null);
    sets.forEach(function (d) { for (var k in d.src) if (d.tr[k]) map[clean(d.src[k])] = d.tr[k]; });
    root.lang = { 'en-NL': 'en-CA', yue: 'zh-HK', zh: 'zh-CN', tl: 'fil' }[lang] || lang;
    if (RTL[lang]) root.dir = 'rtl';
    document.querySelectorAll('h1,h2,h3,p,li,dt,dd,a,button,blockquote,span').forEach(function (el) {
      var t = map[clean(el.textContent)];
      if (!t) return;
      var inner = Array.prototype.some.call(el.children, function (k) { return !/^svg$/i.test(k.tagName) && clean(k.textContent) === clean(el.textContent); });
      if (inner) return;                                       // the link or span inside it gets translated instead
      if (el.querySelector('svg')) {                          // keep the icon, change the words
        for (var i = el.childNodes.length - 1; i >= 0; i--) if (el.childNodes[i].nodeType === 3 && clean(el.childNodes[i].nodeValue)) { el.childNodes[i].nodeValue = ' ' + t; break; }
        return;
      }
      el.innerHTML = t.replace(/\{M\}/g, M);
    });
    show();
  }
  var left = 2;
  function done() {
    if (--left) return;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
  }
  ['common', page.replace('.html', '')].forEach(function (n) {
    var s = document.createElement('script');
    s.src = 'i18n/' + n + '.js?v=' + V; s.async = false; s.onload = done; s.onerror = done;
    document.head.appendChild(s);
  });
})();
