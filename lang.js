/* ── LANGUAGES ─────────────────────────────────────────────────
   The English in each page's HTML stays the source. For a visitor whose browser asks for one of the languages below, this
   swaps the text from i18n/common.js (header and footer) and i18n/<page>.js. A dictionary matches on an element's whole
   text, so a sentence edited later in the HTML just shows the new English until it is translated: nothing breaks.
   Choosing: the picker in the header (or ?lang=xx) wins and is remembered (?lang=auto forgets it), then the browser's
   language. The English dialects are opt-in: only the picker gives them, so an English browser sees the page as written.
   Only pages in PAGES are translated so far. Loaded in <head>, so the page stays hidden (1.5s at most) until it is ready. */
(function () {
  'use strict';
  var PAGES = ['premium-pickup-transport.html', 'advisory.html', 'private-working-session.html', 'public-speaking.html', 'mastermind-membership.html', 'mastermind-application.html', 'group-activities.html', 'contact.html', 'good-news-coffee.html', 'index.html'], V = 121;
  var LANGS = ['ja', 'ko', 'da', 'ru', 'ar', 'fa', 'de', 'he', 'fr', 'yue', 'zh', 'tl', 'es', 'pt', 'la', 'el', 'af', 'pa', 'hi', 'nl', 'pl', 'no', 'sv', 'gd', 'ga', 'cy', 'sjn', 'tlh', 'en-GB', 'en-US', 'en-CA', 'en-NL', 'en-AU', 'en-IE', 'en-SC', 'pig', 'bin', 'egy', 'run', 'ogm', 'sux', 'rel', 'relr'], RTL = { ar: 1, fa: 1, he: 1 }, KEY = 'ace-lang', ALGO = { pig: 1, bin: 1, egy: 1, run: 1, ogm: 1, sux: 1, rel: 1, relr: 1 };   // ALGO: made by rule, not by dictionary
  function pick() {
    var forced = null, q = null;
    try {
      q = new URLSearchParams(location.search).get('lang');
      if (q === 'elf') q = 'rel';                           // the secret language was called Elven before it was Relian
      if (q === 'auto') localStorage.removeItem(KEY);
      else if (LANGS.indexOf(q) >= 0 || q === 'orig') localStorage.setItem(KEY, q);
      forced = localStorage.getItem(KEY);
      if (forced === 'elf') forced = 'rel';
    } catch (e) {}
    if (!forced && (LANGS.indexOf(q) >= 0 || q === 'orig')) forced = q;     // storage blocked (private browsing): the address still carries the choice
    if (forced === 'orig') return null;                     // chose the original in the picker
    if (LANGS.indexOf(forced) >= 0) return forced;
    var two = (navigator.language || '').toLowerCase().split('-')[0];
    var full = (navigator.language || '').toLowerCase();
    if (two === 'iw') two = 'he';
    if (two === 'fil') two = 'tl';
    if (two === 'nb' || two === 'nn') two = 'no';
    if (two === 'zh' && /-(hk|mo)$/.test(full)) two = 'yue';    // Hong Kong and Macau: Cantonese
    return LANGS.indexOf(two) >= 0 && two.indexOf('en') !== 0 && !ALGO[two] ? two : null;
  }
  var lang = pick();
  window.ACE_LANG = lang;                                     // null: the page as written
  var page = location.pathname.split('/').pop() || 'index.html';
  if (PAGES.indexOf(page) < 0) return;

  /* The picker: a globe and a short code, with a real <select> laid invisibly over them, so phones get their own list. */
  var PICK = [['orig','English','EN'],['en-IE','Irish English','IE'],['en-SC','Scottish English','SC'],['en-CA','Canadian English','CA'],['en-GB','British English','UK'],['en-AU','Australian English','AU'],['en-NL','Newfoundland English','NF'],['en-US','American English','US'],['la','Latin','LA'],['gd','Scottish Gaelic','GD'],['ga','Irish Gaelic','GA'],['cy','Welsh','CY'],['de','German','DE'],['da','Danish','DA'],['pl','Polish','PL'],['ru','Russian','RU'],['nl','Dutch','NL'],['no','Norwegian','NO'],['sv','Swedish','SV'],['he','Hebrew','HE'],['af','Afrikaans','AF'],['fr','French','FR'],['el','Greek','EL'],['es','Spanish','ES'],['pt','Portuguese','PT'],['ja','Japanese','JA'],['ko','Korean','KO'],['yue','Cantonese','YUE'],['zh','Mandarin','ZH'],['tl','Tagalog','TL'],['pig','Pig Latin','PIG'],['bin','Binary','BIN'],['sjn','Sindarin','SJN'],['tlh','Klingon','TLH'],['egy','Hieroglyphs','EGY'],['sux','Sumerian cuneiform','SUX'],['run','Runes','RUN'],['ogm','Ogham','OGM'],['ar','Arabic','AR'],['fa','Farsi','FA'],['pa','Punjabi','PA'],['hi','Hindi','HI']];
  var css = document.createElement('style');
  css.textContent = '.ace-lang{position:relative;display:inline-flex;align-items:center;gap:6px;flex:none;height:38px;padding:0 10px;margin-inline:10px;border:1px solid rgba(217,164,65,.45);color:#F1EDE6;font:600 12px/1 system-ui,sans-serif;letter-spacing:.06em}.ace-lang:hover{border-color:#D9A441}.ace-lang:focus-within{outline:2px solid #D9A441;outline-offset:2px}.ace-lang svg{width:15px;height:15px;fill:none;stroke:#D9A441;stroke-width:1.6}.ace-lang select{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;font-size:16px}.ace-lang option{background:#121110;color:#F1EDE6}html[dir=rtl] .skip{left:auto;right:-9999px}html[dir=rtl] .skip:focus{left:auto;right:1rem}html[dir=rtl] .hero__back svg{transform:none}';
  document.head.appendChild(css);
  function addPicker() {
    var spot = document.querySelector('.burger');
    if (!spot) return;
    if (lang === 'rel' || lang === 'relr') PICK.push(['rel', 'Relian', 'REL'], ['relr', 'Relian romanized', 'REL']);   // the secret one: listed only while it is on, so it can be switched off from here
    var cur = lang || 'orig', box = document.createElement('label');
    box.className = 'ace-lang';
    box.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg><span aria-hidden="true">' + PICK.filter(function (o) { return o[0] === cur; })[0][2] + '</span><select aria-label="Language"></select>';
    var sel = box.querySelector('select');
    PICK.forEach(function (o) { var e = document.createElement('option'); e.value = o[0]; e.textContent = o[1]; sel.appendChild(e); });
    sel.value = cur;
    sel.addEventListener('change', function () {
      try { localStorage.setItem(KEY, sel.value); } catch (e) {}
      /* Go to a DIFFERENT address, with the choice in it. Assigning the very same address (what this used to do) is not a
         load at all on some phones, and when the address had a #section on it the browser only scrolled to it: the page
         kept its old language until it was refreshed by hand. A new address always loads, and it carries the language
         even where the browser will not let the page remember it. */
      location.assign(location.pathname + '?lang=' + encodeURIComponent(sel.value) + location.hash);
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
  var LINKISH = /@|:\/\/|^www\.|\.(com|today|dev|ca)\b/i, KEEP_NODE = /1628 W 1st Ave|V6J 1G1|Vancouver, BC/, CODES = /^(ACE|FLY|THOR|SANTA|SLIP|NAVI|LANGUAGE)$/;
  var EGY = { a: '𓄿', b: '𓃀', c: '𓎡', d: '𓂧', e: '𓇋', f: '𓆑', g: '𓎼', h: '𓉔', i: '𓇋', j: '𓆓', k: '𓎡', l: '𓃭', m: '𓅓', n: '𓈖', o: '𓅱', p: '𓊪', q: '𓈎', r: '𓂋', s: '𓋴', t: '𓏏', u: '𓅱', v: '𓆑', w: '𓅱', x: '𓎡𓋴', y: '𓇌', z: '𓊃' };
  /* Runes (Elder Futhark) and Ogham are also made by rule: English spelled out, sound for sound where the old alphabets had a letter, with the digraphs TH and NG as their own signs. */
  var RUN = { a: 'ᚨ', b: 'ᛒ', c: 'ᚲ', d: 'ᛞ', e: 'ᛖ', f: 'ᚠ', g: 'ᚷ', h: 'ᚺ', i: 'ᛁ', j: 'ᛃ', k: 'ᚲ', l: 'ᛚ', m: 'ᛗ', n: 'ᚾ', o: 'ᛟ', p: 'ᛈ', q: 'ᚲ', r: 'ᚱ', s: 'ᛊ', t: 'ᛏ', u: 'ᚢ', v: 'ᚠ', w: 'ᚹ', x: 'ᚲᛊ', y: 'ᛇ', z: 'ᛉ' };
  var OGM = { a: 'ᚐ', b: 'ᚁ', c: 'ᚉ', d: 'ᚇ', e: 'ᚓ', f: 'ᚃ', g: 'ᚌ', h: 'ᚆ', i: 'ᚔ', j: 'ᚌ', k: 'ᚉ', l: 'ᚂ', m: 'ᚋ', n: 'ᚅ', o: 'ᚑ', p: 'ᚚ', q: 'ᚊ', r: 'ᚏ', s: 'ᚄ', t: 'ᚈ', u: 'ᚒ', v: 'ᚃ', w: 'ᚒ', x: 'ᚉᚄ', y: 'ᚔ', z: 'ᚎ' };
  function spell(tok, map, th, ng) {
    return tok.replace(/[Tt][Hh]|[Nn][Gg]|[A-Za-z]/g, function (c) { var l = c.toLowerCase(); return l === 'th' ? th : l === 'ng' ? ng : map[l]; });
  }
  /* Sumerian cuneiform is made by rule too, as syllables: English spelled the way the signs sound (consonant + vowel, a vowel on its own, or a vowel + consonant sign where one exists), one wedge sign each. */
  var SUXCV = {ba:'𒁀',be:'𒁉',bi:'𒁉',bu:'𒁍',da:'𒁕',de:'𒁲',di:'𒁲',du:'𒁺',ga:'𒂵',ge:'𒄀',gi:'𒄀',gu:'𒄖',ha:'𒄩',he:'𒄭',hi:'𒄭',hu:'𒄷',ka:'𒅗',ke:'𒆠',ki:'𒆠',ku:'𒆪',la:'𒆷',le:'𒇷',li:'𒇷',lu:'𒇻',ma:'𒈠',me:'𒈨',mi:'𒈪',mu:'𒈬',na:'𒈾',ne:'𒉈',ni:'𒉌',nu:'𒉡',pa:'𒉺',pe:'𒉿',pi:'𒉿',pu:'𒉺',ra:'𒊏',re:'𒊑',ri:'𒊑',ru:'𒊒',sa:'𒊓',se:'𒋛',si:'𒋛',su:'𒋢',ta:'𒋫',te:'𒋼',ti:'𒋾',tu:'𒌅',za:'𒍝',ze:'𒍣',zi:'𒍣',zu:'𒍪'}, SUXVC = {ab:'𒀊',ad:'𒀜',ak:'𒀝',al:'𒀠',an:'𒀭',el:'𒂖',en:'𒂗',ib:'𒅁',ig:'𒅅',il:'𒅋',im:'𒅎',in:'𒅔',ir:'𒅕',ub:'𒌒',ud:'𒌓',um:'𒌝',un:'𒌦',ur:'𒌨'}, SUXV = {a:'𒀀',e:'𒂊',i:'𒄿',u:'𒌋'};
  function suxWord(w) {
    var L = [], i, c, out = '', ST = { o: 'u', y: 'i', c: 'k', q: 'k', v: 'b', w: 'u', f: 'p', j: 'g' };
    for (i = 0; i < w.length; i++) { c = w[i].toLowerCase(); if (c === 'x') L.push('k', 's'); else L.push(ST[c] || c); }
    function vow(x) { return 'aeiu'.indexOf(x) >= 0; }
    for (i = 0; i < L.length; i++) {
      c = L[i];
      if (vow(c)) { if (i + 1 < L.length && !vow(L[i + 1]) && (i + 2 >= L.length || !vow(L[i + 2])) && SUXVC[c + L[i + 1]]) { out += SUXVC[c + L[i + 1]]; i++; } else out += SUXV[c]; }
      else if (i + 1 < L.length && vow(L[i + 1])) { out += SUXCV[c + L[i + 1]]; i++; }
      else out += SUXCV[c + 'a'];
    }
    return out;
  }
  /* RELIAN (called Elven until Nov 2026; the spec is tools/relian_spec.html): the easter-egg language (Shift + L, A, N, G, U, A, G, E; it is not in the picker). Made by rule from the Elven Rules Reference: every English word is
     spelled out letter by letter in the Elven spellings (digraphs, long vowels, the letter-name merges ja/ha/va/ra, the extra n), the particles, pronouns and the
     listed vocabulary are swapped in, plurals are s' + the singular, Ace's Group Activities becomes Ace lay Group s'Activities, months are the first three letters + -mon,
     and acronyms are spelled by letters. Verb-first word order, sentence endings, negation and quoting are NOT done: a machine cannot read the grammar of arbitrary text. */
  var ELF_L = { b: 'be', c: 'kh', d: 'deh', e: 'ea', f: 'fh', g: 'gi', h: 'ha', i: 'io', j: 'jay', o: 'kio', r: 'ar', s: 'ess', v: 'va' };
  var ELF_W = { i: 'i', you: 'yio', he: 'heas', she: 'esshea', we: 'wea', they: 'tey', it: 'iot', to: 'tu', 'with': 'wio', 'for': 'fhkioar', from: 'fharkiom', 'in': 'ionen', on: 'kionen', at: 'ayt', about: 'aybekiout',
    and: 'ayendeh', or: 'kioar', but: 'beut', 'if': 'iofh', what: 'wayt', who: 'wkio', where: 'wearar', when: 'weanen', why: 'wy', how: 'waykio', is: 'essea', was: 'essea',
    ace: 'Aykhea', gold: 'Khionen', site: 'Essiotea', home: 'Hakiome', project: 'Parkiojayeakht', group: 'Giarkioup', activity: 'Aykhtiovaioty', good: 'giuodeh', more: 'mkioarea',
    go: 'gikio', read: 'arearaydeh', walk: 'wayluk', eat: 'earayt', need: 'neneadeh', book: 'Beuok', tree: 'Tarue', goose: 'Giuoessea', wood: 'Wuodeh', food: 'Fhuodeh', cup: 'Khup',
    computer: 'Khkiomputeaar', bag: 'Beaygi', rice: 'Ariokhea', gum: 'Gium', forest: 'Fhkioareaesst', board: 'Bekiorayardeh', building: 'Beuioldehionengi', painting: 'Payionentionengi',
    pencil: 'Peanenkhiol', dune: 'Dehunenea', scissors: 'Esskhioessesskioaress', ruler: 'Arulear', calculator: 'Khaylkhulaytkioar', barometer: 'Beayarkiomeateaar', stenograph: 'Essteanenkiogiarpha' };
  var ELF_NOUN = {}, ELF_VERB = { go: 1, read: 1, walk: 1, eat: 1, need: 1 }, ELF_ADJ = { good: 1, more: 1 }, ELF_PART = { i: 1, you: 1, he: 1, she: 1, we: 1, they: 1, it: 1, to: 1, 'with': 1, 'for': 1, from: 1, 'in': 1, on: 1, at: 1, about: 1, and: 1, or: 1, but: 1, 'if': 1, what: 1, who: 1, where: 1, when: 1, why: 1, how: 1 };
  Object.keys(ELF_W).forEach(function (k) { if (!ELF_VERB[k] && !ELF_ADJ[k] && !ELF_PART[k]) ELF_NOUN[k] = 1; });
  delete ELF_NOUN['is']; delete ELF_NOUN['was'];                                    // the copula is not a noun (no plural)
  var ELF_MONTH = { january: 'Jan', february: 'Feb', april: 'Apr', june: 'Jun', july: 'Jul', august: 'Aug', september: 'Sep', october: 'Oct', november: 'Nov', december: 'Dec' };   // May and March are left alone: they are also ordinary words
  var ELF_IS = { it: 1, that: 1, what: 1, who: 1, there: 1, here: 1, 'let': 1, he: 1, she: 1, where: 1, how: 1, everything: 1, nothing: 1, something: 1 };       // it’s, that’s: "is", not a possessive
  var elfEnd = false;                                                              // does the Relian spelling just written end in a vowel? (the extra n carries across words)
  /* A word is a list of units [glyph, letter-name]: the glyph is the letter in the Relian script (assets/fonts/relian.woff, private-use code points), the
     letter-name is how it is spelled in the romanized form (a = ay / ray, n = en / nen depend on what comes before, so their name is null until it is rendered).
     lang 'rel' shows the glyphs, 'relr' the romanized spelling. */
  var REL_NAMES = ['essh', 'ess', 'jay', 'ray', 'kio', 'deh', 'nen', 'ea', 'ay', 'be', 'kh', 'fh', 'gi', 'ha', 'io', 'en', 'ar', 'va', 'th', 'ng'];
  var REL_NAME_G = { essh: 'sh', ess: 's', jay: 'j', ray: 'a', kio: 'o', deh: 'd', nen: 'n', ea: 'e', ay: 'a', be: 'b', kh: 'c', fh: 'f', gi: 'g', ha: 'h', io: 'i', en: 'n', ar: 'r', va: 'v', th: 'th', ng: 'ng' };
  var REL_G = { sh: 0xE01A, th: 0xE01B, ng: 0xE01C, plural: 0xE020, ing: 0xE021, past: 0xE022, neg: 0xE023, question: 0xE024, poss: 0xE025 };
  function relGlyph(g) { return REL_G[g] ? String.fromCharCode(REL_G[g]) : /^[a-z]$/.test(g) ? String.fromCharCode(0xE000 + g.charCodeAt(0) - 97) : g; }
  var REL_P = { dash: 0xE030, plus: 0xE031, excl: 0xE032, colon: 0xE033, openq: 0xE034, closeq: 0xE035 };
  function relCap(g) { var c = g.charCodeAt(0); return c >= 0xE000 && c <= 0xE01C ? String.fromCharCode(c + 0x100) + g.slice(1) : g; }   // the capital mark: a tick on the first letter
  function relPunct(str) {
    return str.replace(/\.(?=\s|$|["”’])/g, String.fromCharCode(REL_P.dash)).replace(/,(?=\s|$)/g, String.fromCharCode(REL_P.plus)).replace(/!/g, String.fromCharCode(REL_P.excl)).replace(/[:;](?=\s|$)/g, String.fromCharCode(REL_P.colon)).replace(/\?/g, relGlyph('question'))
      .replace(/["“]([^"“”]*)["”]/g, String.fromCharCode(REL_P.openq) + '$1' + String.fromCharCode(REL_P.closeq));
  }
  function relParse(rom) {                                                         // a vocabulary spelling (letter names run together) -> the glyph keys, longest name first
    var lo = rom.toLowerCase(), out = [], i = 0, k, hit;
    while (i < lo.length) {
      hit = null;
      for (k = 0; k < REL_NAMES.length; k++) if (lo.substr(i, REL_NAMES[k].length) === REL_NAMES[k]) { hit = REL_NAMES[k]; break; }
      if (hit) { out.push(REL_NAME_G[hit]); i += hit.length; } else { out.push(lo[i]); i++; }
    }
    return out;
  }
  function relUnits(w) {
    var lo = w.toLowerCase(), out = [], i, c, d;
    for (i = 0; i < lo.length; i++) {
      c = lo[i]; d = lo[i + 1];
      if (c === 's' && d === 'h') { out.push(['sh', 'essh']); i++; }
      else if (c === 't' && d === 'h') { out.push(['th', 'th']); i++; }
      else if (c === 'n' && d === 'g') { out.push(['ng', 'ng']); i++; }
      else if (c === 'p' && d === 'h') { out.push(['f', 'fh']); i++; }                  // ph and ch have no symbol of their own yet: they are f and c
      else if (c === 'c' && d === 'h') { out.push(['c', 'kh']); i++; }
      else if (c === 'w' && d === 'h') { out.push(['w', 'w']); i++; }
      else if ('jhvr'.indexOf(c) >= 0 && d === 'a') { out.push([c, ELF_L[c]]); i++; }  // letter-name merge: ja = jay, ha = ha, va = va, ra = ar
      else if ('aeiou'.indexOf(c) >= 0 && d === c) { out.push(['u', 'u'], [c, c]); i++; }   // long vowels: oo = uo, ee = ue, aa = ua, ii = ui
      else if (c === 'a') out.push(['a', null]);
      else if (c === 'n') out.push(['n', null]);
      else out.push([c, ELF_L[c] || c]);
    }
    return out;
  }
  function relRender(units, ctxVowel) {                                            // ctxVowel: the spelling before this word ends in a vowel
    var r = '', g = '', prevG = '', k, u, name;
    for (k = 0; k < units.length; k++) {
      u = units[k]; name = u[1];
      if (name === null) {
        if (u[0] === 'a') name = (k > 0 && 'aeiou'.indexOf(prevG) >= 0) ? 'ray' : 'ay';
        else name = /[aeiou]$/.test(r || (ctxVowel ? 'a' : '')) ? 'nen' : 'en';
      }
      r += name; g += relGlyph(u[0]); prevG = u[0];
    }
    return { r: r, g: g };
  }
  function elfCap(out) { return out ? out[0].toUpperCase() + out.slice(1) : out; }
  function relVocab(key) { return { r: ELF_W[key], g: relParse(ELF_W[key]).map(relGlyph).join('') }; }
  function relWord(w) {
    var lo = w.toLowerCase(), res, m, up = w[0] !== w[0].toLowerCase(), allCaps = w === w.toUpperCase();
    function plural(key) { var v = relVocab(key); return { r: 's’' + v.r, g: relGlyph('plural') + v.g }; }
    if (ELF_MONTH[lo] && up) { res = relRender(relUnits(ELF_MONTH[lo]), elfEnd); res.r = elfCap(res.r) + '-mon'; res.g += '-' + relRender(relUnits('mon'), false).g; }
    else if (ELF_W[lo]) res = relVocab(lo);
    else if (lo === 'geese') res = plural('goose');
    else if ((m = lo.match(/^(.+)ies$/)) && ELF_NOUN[m[1] + 'y']) res = plural(m[1] + 'y');
    else if ((m = lo.match(/^(.+?)(?:es|s)$/)) && ELF_NOUN[m[1]]) res = plural(m[1]);
    else if ((m = lo.match(/^(.+)s$/)) && ELF_NOUN[m[1]]) res = plural(m[1]);
    else if ((m = lo.match(/^(.+)ing$/)) && ELF_VERB[m[1]]) { var v = relVocab(m[1]); res = { r: v.r + 'engi', g: v.g + relGlyph('ing') }; }
    else {
      res = relRender(relUnits(w), elfEnd);
      if (allCaps && w.length > 4) res.r = res.r.toUpperCase();                         // a heading set in capitals
      else if (up || allCaps) res.r = elfCap(res.r);                                    // names and acronyms (CAD = Khaydeh) are capitalized
    }
    if (up) res.g = relCap(res.g);
    elfEnd = /[aeiouAEIOU]$/.test(res.r);
    return res;
  }
  var ELF_CODE = /^(ACE|FLY|THOR|SANTA|SLIP|NAVI|LANGUAGE)$/;
  function relText(str) {
    var rom = lang === 'relr';
    elfEnd = false;
    var afterPlus = false;
    var out = str.split(/(\s+)/).map(function (t, i) {
      if (i % 2 || !t) return t;
      var keep = (afterPlus && ELF_CODE.test(t)) || LINKISH.test(t);                  // "Shift + ACE" stays typable
      afterPlus = t === '+';
      if (keep) return t;
      return t.replace(/([A-Za-z]+)(?:[’']s\b)?/g, function (all, word) {
        var poss = all.length > word.length, out = relWord(word), o = rom ? out.r : out.g;
        if (!poss) return o;
        if (ELF_IS[word.toLowerCase()]) { var be = relWord('is'); return o + ' ' + (rom ? be.r : be.g); }   // it’s, that’s: "is", not a possessive
        return o + (rom ? ' lay' : ' ' + relGlyph('poss'));
      });
    }).join('');
    return rom ? out.replace(/\?/g, '⸮').replace(/["“]([^"“”]*)["”]/g, '‘$1’') : relPunct(out);
  }
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
    if (lang === 'sux') return tok.replace(/[A-Za-z]+/g, suxWord);
    if (lang === 'egy') return tok.replace(/[A-Za-z]/g, function (c) { return EGY[c.toLowerCase()]; });
    if (lang === 'run') return spell(tok, RUN, 'ᚦ', 'ᛜ');
    if (lang === 'ogm') return spell(tok, OGM, 'ᚈᚆ', 'ᚍ');
    return Array.prototype.map.call(new TextEncoder().encode(tok), function (b) { return ('0000000' + b.toString(2)).slice(-8); }).join(' ');
  }
  function algoText(str) {
    var m = str.match(/^(\s*)([\s\S]*?)(\s*)$/);
    if (lang === 'rel' || lang === 'relr') return m[1] + relText(m[2]) + m[3];
    var core = m[2].split(/(\s+)/).map(function (t, i) { return i % 2 ? (lang === 'bin' ? ' 00100000 ' : t) : algoToken(t); }).join('');
    if (lang === 'ogm' && /[ᚁ-ᚚ]/.test(core)) core = '᚛' + core + '᚜';
    return m[1] + core + m[3];
  }
  var produced = Object.create(null);
  function algoApply() {
    root.lang = { pig: 'en-x-piglatin', bin: 'en-x-binary', egy: 'egy', run: 'en-x-runic', ogm: 'en-x-ogham', sux: 'sux', rel: 'en-x-relian', relr: 'en-x-relian' }[lang];
    root.setAttribute('data-algo', lang);
    window.ACE_TR = function (str) { var o = algoText(String(str)); produced[o] = 1; return o; };   // for text built later, like Little Ace's thoughts
    if (!document.getElementById('algo-css')) {
      var st = document.createElement('style'); st.id = 'algo-css';
      st.textContent = 'html[data-algo="bin"] body{overflow-wrap:anywhere;word-break:break-all}html[data-algo="egy"] body,html[data-algo="egy"] body *{font-family:"Noto Sans Egyptian Hieroglyphs","Segoe UI Historic","Segoe UI Symbol",sans-serif !important}html[data-algo="run"] body,html[data-algo="run"] body *{font-family:"Noto Sans Runic","Segoe UI Historic","Segoe UI Symbol",sans-serif !important}html[data-algo="ogm"] body,html[data-algo="ogm"] body *{font-family:"Noto Sans Ogham","Segoe UI Historic","Segoe UI Symbol",sans-serif !important}html[data-algo="sux"] body,html[data-algo="sux"] body *{font-family:"Noto Sans Cuneiform","Segoe UI Historic","Segoe UI Symbol",sans-serif !important}';
      document.head.appendChild(st);
      if (lang === 'run' || lang === 'ogm') { var lk2 = document.createElement('link'); lk2.rel = 'stylesheet'; lk2.href = 'https://fonts.googleapis.com/css2?family=' + (lang === 'run' ? 'Noto+Sans+Runic' : 'Noto+Sans+Ogham') + '&display=swap'; document.head.appendChild(lk2); }
      if (lang === 'sux') { var lk3 = document.createElement('link'); lk3.rel = 'stylesheet'; lk3.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Cuneiform&display=swap'; document.head.appendChild(lk3); }
      if (lang === 'egy') { var lk = document.createElement('link'); lk.rel = 'stylesheet'; lk.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Egyptian+Hieroglyphs&display=swap'; document.head.appendChild(lk); }
    }
    if (lang === 'rel' && !document.getElementById('rel-css')) {                          // the Relian script: its font for everything but the language picker
      var rc = document.createElement('style'); rc.id = 'rel-css';
      rc.textContent = '@font-face{font-family:"Relian";src:url(assets/fonts/relian.woff?v=2) format("woff");font-display:block}' +
        'html[data-algo="rel"] body,html[data-algo="rel"] body *{font-family:"Relian",system-ui,sans-serif !important;letter-spacing:.02em}' +
        'html[data-algo="rel"] .ace-lang,html[data-algo="rel"] .ace-lang *{font-family:system-ui,sans-serif !important;letter-spacing:.06em}';
      document.head.appendChild(rc);
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
  /* The hero's ASSET is forged a letter at a time (heroIntro in main.js): each letter is its own steel span, registered with the heat effect. A
     translation must not flatten that into plain text, so the translated word is written back into the SAME letter spans (more are cloned if the word
     is longer, spare ones dropped), with each word kept whole so a long phrase wraps between words, never inside one. */
  function forgeWord(el, word) {
    var old = [].slice.call(el.querySelectorAll('.hero__forge')), last = old[old.length - 1];
    el.textContent = '';
    var wrap = null;
    word.split('').forEach(function (ch) {
      if (/\s/.test(ch)) { el.appendChild(document.createTextNode(' ')); wrap = null; return; }
      if (!wrap) { wrap = document.createElement('span'); wrap.style.whiteSpace = 'nowrap'; el.appendChild(wrap); }
      var l = old.shift();
      if (!l) { l = last.cloneNode(false); l.style.transition = 'opacity .5s'; }   // an extra letter: hidden like the rest until the intro ends, then it fades in
      l.textContent = ch; wrap.appendChild(l);
    });
    el.setAttribute('aria-label', word);
  }
  function apply() {
    if (ALGO[lang]) { algoApply(); return; }
    var map = Object.create(null);
    sets.forEach(function (d) { for (var k in d.src) if (d.tr[k]) map[clean(d.src[k])] = d.tr[k]; });
    var map2 = Object.create(null);
    for (var mk in map) map2[mk.replace(/\s/g, '')] = map[mk];
    window.ACE_TR = function (s) { return map[clean(s)] || map2[String(s).replace(/\s/g, '')] || s; };   // for text the page builds later, like Little Ace's thoughts
    var link = '<a href="mastermind-membership.html">' + (map[clean('Invested Aces Mastermind')] || 'Invested Aces Mastermind') + '</a>';
    root.lang = { 'en-NL': 'en-CA', yue: 'zh-HK', zh: 'zh-CN', tl: 'fil', es: 'es-419', pt: 'pt-BR', no: 'nb', 'en-SC': 'en-GB' }[lang] || lang;
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
      if (el.classList.contains('hero__asset') && el.querySelector('.hero__forge')) { forgeWord(el, t); return; }   // keep the forged steel letters
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
    ['placeholder', 'aria-label'].forEach(function (at) {
      document.querySelectorAll('[' + at + ']').forEach(function (el) {
        var pt = map[clean(el.getAttribute(at))];
        if (pt) el.setAttribute(at, pt);
      });
    });
    show();
  }
  var left = 2;
  function done() {
    if (--left) return;
    /* The chat widget and the picker are built after this runs, so re-apply when new text appears (apply is quiet on text it has already changed). */
    function watch() {
      var t, ob = new MutationObserver(function () { clearTimeout(t); t = setTimeout(function () { ob.disconnect(); apply(); ob.observe(document.body, { childList: true, subtree: true, characterData: true }); }, 300); });
      ob.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { apply(); watch(); }); else { apply(); watch(); }
  }
  ['common', page.replace('.html', '')].forEach(function (n) {
    var s = document.createElement('script');
    s.src = 'i18n/' + n + '.js?v=' + V; s.async = false; s.onload = done; s.onerror = done;
    document.head.appendChild(s);
  });
})();
