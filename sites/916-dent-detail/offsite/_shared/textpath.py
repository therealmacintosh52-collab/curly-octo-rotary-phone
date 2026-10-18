"""Convert text to SVG path data (outlined text: print-safe, no font embedding needed)."""
import os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
FD = os.path.join(os.path.dirname(__file__), 'fonts')
_cache = {}
def font(name):
    if name not in _cache:
        f = TTFont(os.path.join(FD, name)); _cache[name] = (f, f.getBestCmap(), f.getGlyphSet(), f['head'].unitsPerEm, f['hmtx'])
    return _cache[name]
def width(name, text, size, tracking=0.0):
    f, cmap, gs, upm, hmtx = font(name)
    w = 0
    for ch in text:
        g = cmap.get(ord(ch)) or cmap.get(ord('?'))
        w += hmtx[g][0] * size / upm + tracking * size
    return w - (tracking * size if text else 0)
def path(name, text, size, x, y, tracking=0.0, anchor='start'):
    """Return SVG path d for text with baseline at y. tracking in em."""
    f, cmap, gs, upm, hmtx = font(name)
    w = width(name, text, size, tracking)
    if anchor == 'middle': x -= w / 2
    elif anchor == 'end': x -= w
    s = size / upm; out = []; cx = x
    for ch in text:
        g = cmap.get(ord(ch)) or cmap.get(ord('?'))
        pen = SVGPathPen(gs, ntos=lambda v: ('%.2f' % v).rstrip('0').rstrip('.'))
        gs[g].draw(TransformPen(pen, (s, 0, 0, -s, cx, y)))
        d = pen.getCommands()
        if d: out.append(d)
        cx += hmtx[g][0] * s + tracking * size
    return ' '.join(out)
