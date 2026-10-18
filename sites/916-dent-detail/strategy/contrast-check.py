"""WCAG 2.1 contrast table for the 916 Dent & Detail palette. Run: python3 strategy/contrast-check.py
Prints a markdown table; DESIGN-BRIEF.md section 4 is this output. Exit code 1 if any required pair fails."""
import sys
bad=0
def lin(c):
    c/=255
    return c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4
def L(h):
    h=h.lstrip('#');r,g,b=[int(h[i:i+2],16) for i in (0,2,4)]
    return 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b)
def cr(a,b):
    x,y=L(a),L(b)
    if x<y:x,y=y,x
    return (x+0.05)/(y+0.05)
P={'onyx':'#0B0B0C','graphite':'#16171A','raised':'#202126','gold':'#C9A24A','lgold':'#E8CB7A','ivory':'#F3EEE3','steel':'#8C8F96','steel-lt':'#A6A9B0','gold-dk':'#8E6E2E','gold-mid':'#B8913E'}

P.update({'ivory':'#F3EEE3'})
rows=[
('Body text','ivory','onyx','AA 4.5'),('Body text on cards/forms','ivory','graphite','AA 4.5'),
('Secondary text, captions, kickers (steel)','steel','onyx','AA 4.5'),('Secondary text on graphite','steel','graphite','AA 4.5'),
('Link and kicker text (gold)','gold','onyx','AA 4.5'),('Link text on graphite','gold','graphite','AA 4.5'),
('Link hover, focus ring, active nav (light gold)','lgold','onyx','AA 4.5 / UI 3'),('Light gold on graphite','lgold','graphite','AA 4.5 / UI 3'),
('Primary button label (onyx on gold)','onyx','gold','AA 4.5'),('Primary button hover label','onyx','lgold','AA 4.5'),('Button label on graphite-over-gold alt','graphite','gold','AA 4.5'),
('Outline button text and 1px border (gold on onyx)','gold','onyx','AA 4.5 / UI 3'),
('Input border (steel on graphite)','steel','graphite','UI 3'),
('Gradient numeral/line, darkest stop #8E6E2E on onyx (large text only, min 24px)','gold-dk','onyx','Large 3'),('Gradient middle stop #B8913E on onyx','gold-mid','onyx','Large 3'),('Gradient lightest stop #E8CB7A on onyx','lgold','onyx','Large 3'),
('NOT USED: ivory on gold','ivory','gold','n/a'),('NOT USED: steel on ivory','steel','ivory','n/a'),('NOT USED: light gold on gold','lgold','gold','n/a'),('NOT USED: gold-dark stop for small text','gold-dk','graphite','n/a')]
for d,f,b,req in rows:
    r=cr(P[f],P[b]);need=float(req.split()[1]) if req[0] in 'AUL' else 0
    st='pass' if r>=need else ('FAIL' if need else 'fails AA small, forbidden')
    bad+= (st=='FAIL')
    print(f"| {d} | {f} {P[f]} | {b} {P[b]} | {r:.2f}:1 | {req} | {st} |")

sys.exit(1 if bad else 0)
