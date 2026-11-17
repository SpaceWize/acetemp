"""Builds the Relian script as a web font (assets/fonts/relian.woff) from the stroke glyphs in tools/relian_spec.html.

Every glyph in the spec is a few strokes (lines, curves, circles) drawn in a 84 x 172 box: the spine runs from y = 26 down to y = 174.
This reads those strokes, thickens them to a round-ended pen, and writes them as outlines. The letters sit on private-use code points:
  a..z   U+E000 .. U+E019        sh U+E01A   th U+E01B   ng U+E01C
  caps   the letter's code + 0x100 (U+E100 ..)
  punctuation  dash U+E030  plus U+E031  exclamation U+E032  colon/semicolon U+E033  open quote U+E034  close quote U+E035
  marks  plural U+E020  -ing U+E021  past U+E022  negation U+E023  question U+E024  possessive U+E025
Needs fonttools and shapely (pip install fonttools shapely).   Run from the repo root:  python tools/build_relian_font.py
"""
import re
import os
import sys
from shapely.geometry import LineString, Point
from shapely.ops import unary_union
from shapely.geometry.polygon import orient
from shapely import affinity
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

HERE = os.path.dirname(os.path.abspath(__file__))
SPEC = os.path.join(HERE, 'relian_spec.html')
OUT = os.path.join(HERE, '..', 'assets', 'fonts', 'relian.woff')
UPM, ASC, DESC = 1000, 900, -200
S = 5.6                    # font units per spec unit
TOP = 800                  # the spine top (y = 26) sits here
ADV = 380                  # advance of one letter
BOLD = 2.3                 # the spec's stroke widths are for a 56 px wide picture; text needs a heavier pen
BASE_W = 2.5


def spec_glyphs():
    html = open(SPEC, encoding='utf-8').read()
    return dict(re.findall(r'<g id="g-([a-z])">(.*?)</g>', html, re.S))


def flatten(cmd, pts, cur):
    """pts: numbers of one command; returns list of (x, y) along it."""
    if cmd == 'Q':
        (x0, y0), (x1, y1), (x2, y2) = cur, (pts[0], pts[1]), (pts[2], pts[3])
        return [((1 - t) ** 2 * x0 + 2 * (1 - t) * t * x1 + t * t * x2, (1 - t) ** 2 * y0 + 2 * (1 - t) * t * y1 + t * t * y2) for t in [i / 16.0 for i in range(1, 17)]]
    if cmd == 'C':
        (x0, y0), (x1, y1), (x2, y2), (x3, y3) = cur, (pts[0], pts[1]), (pts[2], pts[3]), (pts[4], pts[5])
        out = []
        for i in range(1, 25):
            t = i / 24.0
            a, b, c, d = (1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t * t, t ** 3
            out.append((a * x0 + b * x1 + c * x2 + d * x3, a * y0 + b * y1 + c * y2 + d * y3))
        return out
    return [(pts[0], pts[1])]


def path_lines(d):
    """One SVG path (absolute M L Q C) -> list of polylines."""
    toks = re.findall(r'[MLQCZ]|-?\d*\.?\d+', d)
    lines, line, cur, i = [], [], (0, 0), 0
    n = {'M': 2, 'L': 2, 'Q': 4, 'C': 6}
    cmd = None
    while i < len(toks):
        if re.match(r'[MLQCZ]', toks[i]):
            cmd = toks[i]
            i += 1
            if cmd == 'Z':
                continue
        vals = [float(v) for v in toks[i:i + n[cmd]]]
        i += n[cmd]
        if cmd == 'M':
            if len(line) > 1:
                lines.append(line)
            cur = (vals[0], vals[1])
            line = [cur]
            cmd = 'L'                        # extra pairs after M are lines
        else:
            seg = flatten(cmd, vals, cur)
            line.extend(seg)
            cur = seg[-1]
    if len(line) > 1:
        lines.append(line)
    return lines


def shapes_from_markup(markup):
    """-> list of ('line', pts, width) / ('ring', cx, cy, r, width) / ('dot', cx, cy, r)."""
    shapes = []
    for m in re.finditer(r'<(path|circle)\b([^>]*)/>', markup):
        kind, attrs = m.group(1), m.group(2)
        sw = re.search(r'stroke-width:\s*([\d.]+)', attrs)
        w = float(sw.group(1)) if sw else BASE_W
        if kind == 'path':
            d = re.search(r'\bd="([^"]+)"', attrs).group(1)
            for ln in path_lines(d):
                shapes.append(('line', ln, w))
        else:
            cx, cy, r = [float(re.search(r'\b%s="([^"]+)"' % k, attrs).group(1)) for k in ('cx', 'cy', 'r')]
            if 'class="fill"' in attrs:
                shapes.append(('dot', cx, cy, r))
            else:
                shapes.append(('ring', cx, cy, r, w))
    return shapes


def to_geom(shapes, dx=0.0, dy=0.0, sc=1.0):
    parts = []
    for sh in shapes:
        if sh[0] == 'line':
            pts = [((x * sc + dx), (y * sc + dy)) for x, y in sh[1]]
            parts.append(LineString(pts).buffer(sh[2] * BOLD / 2.0, cap_style=1, join_style=1, resolution=8))
        elif sh[0] == 'ring':
            cx, cy, r, w = sh[1] * sc + dx, sh[2] * sc + dy, sh[3] * sc, sh[4] * BOLD
            parts.append(Point(cx, cy).buffer(r + w / 2.0, resolution=16).difference(Point(cx, cy).buffer(max(r - w / 2.0, 0.5), resolution=16)))
        else:
            parts.append(Point(sh[1] * sc + dx, sh[2] * sc + dy).buffer(sh[3] * sc * 1.1, resolution=16))
    return unary_union(parts)


def mark_shapes():
    """The grammar marks are drawn in a 60 x 80 box centred on 0; the digraph pieces are added to the letters."""
    M = {}
    M['plural'] = '<path d="M-6 -22 C6 -30 12 -14 4 -6 C-2 0 -2 10 -10 18"/><circle cx="14" cy="28" r="3" class="fill"/>'
    M['ing'] = '<path d="M-16 -12 C-16 16 16 16 16 -12"/><path d="M16 -12 C16 -22 6 -24 0 -18"/>'
    M['past'] = '<path d="M14 -18 C-14 -18 -14 18 10 18"/><path d="M10 18 L2 10 M10 18 L4 24"/>'
    M['neg'] = '<path d="M-16 0 L16 0"/><path d="M-10 -14 C0 -4 0 4 10 14"/>'
    M['question'] = '<path d="M-10 -10 C-10 -26 14 -26 14 -10 C14 2 0 4 0 14"/><circle cx="0" cy="26" r="3" class="fill"/>'
    M['poss'] = '<path d="M-14 -14 C-30 -14 -30 14 -14 14 C-2 14 2 0 14 0"/><path d="M14 0 L24 -8 M14 0 L24 8"/>'
    return M


def outline(geom, advance_cx):
    """shapely geometry in spec units -> TrueType glyph (flip y, scale, centre on the advance)."""
    g = affinity.scale(geom, xfact=S, yfact=-S, origin=(0, 0))
    g = affinity.translate(g, advance_cx, TOP + 26 * S)
    pen = TTGlyphPen(None)
    polys = list(g.geoms) if g.geom_type == 'MultiPolygon' else [g]
    for p in polys:
        if p.is_empty:
            continue
        p = orient(p, sign=-1.0)             # TrueType: outer contours clockwise, holes counter-clockwise
        for ring in [p.exterior] + list(p.interiors):
            pts = [(round(x), round(y)) for x, y in list(ring.coords)[:-1]]
            dedup = [pt for k, pt in enumerate(pts) if k == 0 or pt != pts[k - 1]]
            if len(dedup) < 3:
                continue
            pen.moveTo(dedup[0])
            for pt in dedup[1:]:
                pen.lineTo(pt)
            pen.closePath()
    return pen.glyph()


def main():
    G = spec_glyphs()
    assert len(G) == 26, len(G)
    base = {k: shapes_from_markup(v) for k, v in G.items()}
    glyphs, names, cmap = {}, ['.notdef'], {}
    glyphs['.notdef'] = TTGlyphPen(None).glyph()
    order = []
    for i, k in enumerate('abcdefghijklmnopqrstuvwxyz'):
        order.append((k, 0xE000 + i, to_geom(base[k])))
    # digraph glyphs, as drawn in the spec's digraph row
    sh = unary_union([to_geom(base['s'], dx=-6), to_geom([('line', [(-28, 101), (16, 101)], 3)])])
    th = unary_union([to_geom(base['t']), to_geom([('line', [(-20, 100), (20, 100)], 3)])])
    ng = unary_union([to_geom(base['n']), to_geom([('line', [(0, 150), (-4, 150)], 3)]), to_geom(shapes_from_markup('<path d="M0 150 C-14 150 -18 166 -4 172" style="stroke-width:3"/>'))])
    order += [('sh', 0xE01A, sh), ('th', 0xE01B, th), ('ng', 0xE01C, ng)]
    marks = mark_shapes()
    for j, k in enumerate(['plural', 'ing', 'past', 'neg', 'question', 'poss']):
        order.append(('m_' + k, 0xE020 + j, to_geom(shapes_from_markup(marks[k]), dx=0, dy=100, sc=1.5)))
    # capitals: the same letter with a short tick at the top-left of its spine (U+E100 + the letter's code)
    tick = to_geom([('line', [(-16, 22), (-4, 32)], 3)])
    for name, cp, geom in list(order[:29]):
        order.append((name.upper(), cp + 0x100, unary_union([geom, tick])))
    # punctuation (from the spec's Punctuation list), drawn in the 60 x 80 mark box
    P = {
        'dash': '<path d="M-18 0 L18 0"/>',
        'plus': '<path d="M-14 0 L14 0"/><path d="M0 -14 L0 14"/>',
        'excl': '<path d="M-12 -2 L12 -2 L0 22 L-12 -2"/><circle cx="0" cy="-18" r="3" class="fill"/>',
        'colon': '<circle cx="0" cy="-18" r="7"/><circle cx="0" cy="18" r="7"/><path d="M0 -11 L0 11"/>',
        'openq': '<path d="M10 -16 L-8 -16 L-8 16 L10 16"/>',
        'closeq': '<path d="M-10 -16 L8 -16 L8 16 L-10 16"/>',
    }
    for j, k in enumerate(['dash', 'plus', 'excl', 'colon', 'openq', 'closeq']):
        order.append(('p_' + k, 0xE030 + j, to_geom(shapes_from_markup(P[k]), dx=0, dy=100, sc=1.5)))
    for name, cp, geom in order:
        gname = 'u%04X' % cp
        glyphs[gname] = outline(geom, ADV / 2.0)
        names.append(gname)
        cmap[cp] = gname
    # a plain space
    glyphs['space'] = TTGlyphPen(None).glyph()
    names.append('space')
    cmap[0x20] = 'space'
    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(names)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyphs)
    metrics = {n: (ADV, 0) for n in names}
    metrics['.notdef'] = (ADV, 0)
    metrics['space'] = (300, 0)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=ASC, descent=DESC)
    fb.setupNameTable({'familyName': 'Relian', 'styleName': 'Regular'})
    fb.setupOS2(sTypoAscender=ASC, sTypoDescender=DESC, usWinAscent=ASC + 100, usWinDescent=-DESC + 100)
    fb.setupPost()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    fb.font.flavor = 'woff'
    fb.save(OUT)
    print('saved', os.path.normpath(OUT), os.path.getsize(OUT), 'bytes,', len(order), 'glyphs')


if __name__ == '__main__':
    sys.exit(main())
