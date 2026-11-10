/* ── LANGUAGES ─────────────────────────────────────────────────
   The English in each page's HTML stays the source. For a visitor whose browser asks for one of the languages below, this
   swaps the text from i18n/common.js (header and footer) and i18n/<page>.js. A dictionary matches on an element's whole
   text, so a sentence edited later in the HTML just shows the new English until it is translated: nothing breaks.
   Choosing: the picker in the header (or ?lang=xx) wins and is remembered (?lang=auto forgets it), then the browser's
   language. The English dialects are opt-in: only the picker gives them, so an English browser sees the page as written.
   Only pages in PAGES are translated so far. Loaded in <head>, so the page stays hidden (1.5s at most) until it is ready. */
(function () {
  'use strict';
  var PAGES = ['premium-pickup-transport.html', 'advisory.html', 'private-working-session.html', 'public-speaking.html', 'mastermind-membership.html', 'mastermind-application.html', 'group-activities.html', 'contact.html', 'good-news-coffee.html', 'index.html'], V = 87;
  var LANGS = ['ja', 'da', 'ru', 'ar', 'de', 'he', 'fr', 'yue', 'zh', 'tl', 'en-GB', 'en-US', 'en-CA', 'en-NL', 'en-AU', 'pig', 'bin', 'egy'], RTL = { ar: 1, he: 1 }, KEY = 'ace-lang', ALGO = { pig: 1, bin: 1, egy: 1 };   // ALGO: made by rule, not by dictionary
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
    return LANGS.indexOf(two) >= 0 && two.indexOf('en') !== 0 && !ALGO[two] ? two : null;
  }
  var lang = pick();
  window.ACE_LANG = lang;                                     // null: the page as written
  var page = location.pathname.split('/').pop() || 'index.html';
  if (PAGES.indexOf(page) < 0) return;

  /* The picker: a globe and a short code, with a real <select> laid invisibly over them, so phones get their own list. */
  var PICK = [['orig', 'English (original)', 'EN'], ['ja', 'Japanese', 'JA'], ['da', 'Danish', 'DA'], ['ru', 'Russian', 'RU'], ['ar', 'Arabic', 'AR'], ['de', 'German', 'DE'], ['he', 'Hebrew', 'HE'], ['fr', 'French', 'FR'], ['yue', 'Cantonese', 'YUE'], ['zh', 'Mandarin', 'ZH'], ['tl', 'Tagalog', 'TL'], ['en-GB', 'British English', 'UK'], ['en-US', 'American English', 'US'], ['en-CA', 'Canadian English', 'CA'], ['en-NL', 'Newfoundland English', 'NF'], ['en-AU', 'Australian English', 'AU'], ['pig', 'Pig Latin', 'PIG'], ['bin', 'Binary', 'BIN'], ['egy', 'Hieroglyphs', 'EGY']];
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
  /* Pig Latin, Binary and Hieroglyphs are made by rule, not by dictionary: every piece of text on the page, and everything
     Little Ace says, goes through the rule. Emails, links and the street address are left alone. */
  var LINKISH = /@|:\/\/|^www\.|\.(com|today|dev|ca)\b/i, KEEP_NODE = /1628 W 1st Ave|V6J 1G1|Vancouver, BC/, CODES = /^(ACE|FLY|THOR|SANTA|SLIP)$/;
  var EGY = { a: '𓄿', b: '𓃀', c: '𓎡', d: '𓂧', e: '𓇋', f: '𓆑', g: '𓎼', h: '𓉔', i: '𓇋', j: '𓆓', k: '𓎡', l: '𓃭', m: '𓅓', n: '𓈖', o: '𓅱', p: '𓊪', q: '𓈎', r: '𓂋', s: '𓋴', t: '𓏏', u: '𓅱', v: '𓆑', w: '𓅱', x: '𓎡𓋴', y: '𓇌', z: '𓊃' };
  function pigWord(w) {
    if (CODES.test(w) || (w.length > 1 && w.length <= 4 && w === w.toUpperCase())) return w;     // codes and short acronyms (CAD, BC, VIP)
    var lo = w.toLowerCase(), i = 0;
    if (lo.indexOf('qu') === 0) i = 2;
    else while (i < lo.length && !('aeiou'.indexOf(lo[i]) >= 0 || (lo[i] === 'y' && i > 0))) i++;
    var out = i === 0 ? lo + 'way' : i >= lo.length ? lo + 'ay' : lo.slice(i) + lo.slice(0, i) + 'ay';
    if (w.length > 1 && w === w.toUpperCase()) return out.toUpperCase();
    if (w[0] !== w[0].toLowerCase()) out = out[0].toUpperCase() + out.slice(1);
    return out;
  }
  function algoToken(tok) {
    if (LINKISH.test(tok)) return tok;
    if (lang === 'pig') return tok.replace(/[A-Za-z]+(?:['’][A-Za-z]+)*/g, pigWord);
    if (lang === 'egy') return tok.replace(/[A-Za-z]/g, function (c) { return EGY[c.toLowerCase()]; });
    return Array.prototype.map.call(new TextEncoder().encode(tok), function (b) { return ('0000000' + b.toString(2)).slice(-8); }).join(' ');
  }
  function algoText(str) {
    var m = str.match(/^(\s*)([\s\S]*?)(\s*)$/);
    var core = m[2].split(/(\s+)/).map(function (t, i) { return i % 2 ? (lang === 'bin' ? ' 00100000 ' : t) : algoToken(t); }).join('');
    return m[1] + core + m[3];
  }
  var produced = Object.create(null);
  function algoApply() {
    root.lang = { pig: 'en-x-piglatin', bin: 'en-x-binary', egy: 'egy' }[lang];
    root.setAttribute('data-algo', lang);
    window.ACE_TR = function (str) { var o = algoText(String(str)); produced[o] = 1; return o; };   // for text built later, like Little Ace's thoughts
    if (!document.getElementById('algo-css')) {
      var st = document.createElement('style'); st.id = 'algo-css';
      st.textContent = 'html[data-algo="bin"] body{overflow-wrap:anywhere;word-break:break-all}html[data-algo="egy"] body,html[data-algo="egy"] body *{font-family:"Noto Sans Egyptian Hieroglyphs","Segoe UI Historic","Segoe UI Symbol",sans-serif !important}';
      document.head.appendChild(st);
      if (lang === 'egy') { var lk = document.createElement('link'); lk.rel = 'stylesheet'; lk.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Egyptian+Hieroglyphs&display=swap'; document.head.appendChild(lk); }
    }
    if (lang === 'pig') document.querySelectorAll('body *').forEach(function (el) {       // a word split into one-letter spans: change the whole word, then deal it back out
      var k = el.children; if (el.__algo || k.length < 2 || k.length > 24) return;
      for (var j = 0; j < k.length; j++) if (k[j].children.length || !/^[A-Za-z]$/.test(k[j].textContent)) return;
      var out = pigWord(Array.prototype.map.call(k, function (c) { return c.textContent; }).join(''));
      el.__algo = true;
      for (j = 0; j < k.length; j++) { k[j].__algo = true; k[j].textContent = j < k.length - 1 ? (out[j] || '') : out.slice(j); }
    });
    var tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: function (n) { var p = n.parentNode; return !p || p.__algo || /^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT|OPTION|SELECT)$/.test(p.tagName) || (p.closest && p.closest('.ace-lang,select')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } });
    var nodes = []; while (tw.nextNode()) nodes.push(tw.currentNode);
    nodes.forEach(function (n) {
      var v = n.nodeValue; if (!/\S/.test(v) || produced[v] || KEEP_NODE.test(v)) return;
      var o = algoText(v); if (o !== v) { produced[o] = 1; n.nodeValue = o; }
    });
    document.querySelectorAll('[placeholder]').forEach(function (el) { var v = el.getAttribute('placeholder'); if (!produced[v]) { var o = algoText(v); produced[o] = 1; el.setAttribute('placeholder', o); } });
    show();
  }
  function apply() {
    if (ALGO[lang]) { algoApply(); return; }
    var map = Object.create(null);
    sets.forEach(function (d) { for (var k in d.src) if (d.tr[k]) map[clean(d.src[k])] = d.tr[k]; });
    var map2 = Object.create(null);
    for (var mk in map) map2[mk.replace(/\s/g, '')] = map[mk];
    window.ACE_TR = function (s) { return map[clean(s)] || map2[String(s).replace(/\s/g, '')] || s; };   // for text the page builds later, like Little Ace's thoughts
    var link = '<a href="mastermind-membership.html">' + (map[clean('Invested Aces Mastermind')] || 'Invested Aces Mastermind') + '</a>';
    root.lang = { 'en-NL': 'en-CA', yue: 'zh-HK', zh: 'zh-CN', tl: 'fil' }[lang] || lang;
    if (RTL[lang]) root.dir = 'rtl';
    document.querySelectorAll('h1,h2,h3,p,li,dt,dd,a,button,blockquote,span,label,legend,option,em,figcaption,th,td').forEach(function (el) {
      var t = map[clean(el.textContent)] || map2[el.textContent.replace(/\s/g, '')];
      if (!t) return;
      if (el.tagName === 'OPTION' && !el.hasAttribute('value')) el.value = el.textContent;   // the form still sends the English choice
      var inner = Array.prototype.some.call(el.children, function (k) { return !/^svg$/i.test(k.tagName) && clean(k.textContent) === clean(el.textContent); });
      if (inner) return;                                       // the link or span inside it gets translated instead
      if (el.querySelector('svg')) {                          // keep the icon, change the words
        for (var i = el.childNodes.length - 1; i >= 0; i--) if (el.childNodes[i].nodeType === 3 && clean(el.childNodes[i].nodeValue)) { el.childNodes[i].nodeValue = ' ' + t; break; }
        return;
      }
      el.innerHTML = t.replace(/\{M\}/g, link);
    });
    /* Names inside sentences, and headings that have no key of their own: swap in the translated name, longest first. */
    if (lang) {
      var names = ['The Invested Aces Mastermind', 'I-AM: Invested Aces Mastermind', 'Invested Aces Mastermind', 'Premium Pickup & Transport', 'Ongoing Private Advisory', 'Private Working Session', 'Ongoing Advisory', 'Public Speaking', 'On-Site Assignments', 'Advisory', 'Mastermind'];
      var pairs = [];
      names.forEach(function (en) { var tr = map[en]; if (tr) pairs.push([en, tr]); });
      if (pairs.length) {
        var tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: function (n) { return n.parentNode && /^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentNode.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } });
        var texts = []; while (tw.nextNode()) texts.push(tw.currentNode);
        texts.forEach(function (n) { var v = n.nodeValue; pairs.forEach(function (p) { v = v.split(p[0]).join(p[1]); }); if (v !== n.nodeValue) n.nodeValue = v; });
      }
    }
    document.querySelectorAll('[placeholder]').forEach(function (el) {
      var pt = map[clean(el.getAttribute('placeholder'))];
      if (pt) el.setAttribute('placeholder', pt);
    });
    show();
  }
  var left = 2;
  function done() {
    if (--left) return;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
    /* The chat widget and the picker are built after this runs, so re-apply when new text appears (apply is quiet on text it has already changed). */
    var t, ob = new MutationObserver(function () { clearTimeout(t); t = setTimeout(function () { ob.disconnect(); apply(); ob.observe(document.body, { childList: true, subtree: true, characterData: true }); }, 300); });
    ob.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  ['common', page.replace('.html', '')].forEach(function (n) {
    var s = document.createElement('script');
    s.src = 'i18n/' + n + '.js?v=' + V; s.async = false; s.onload = done; s.onerror = done;
    document.head.appendChild(s);
  });
})();
