"""Render the Father's Day gift note as PNG (chat preview) and PDF (print).

Layout mirrors fathers-day-gift-note.html: US Letter landscape, fold-in-half
card. Left half = back cover, right half = front cover.
"""
from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import letter, landscape
from reportlab.pdfgen import canvas as pdfcanvas

BG = (20, 24, 29)        # #14181d
CREAM = (244, 239, 232)  # #f4efe8
GOLD = (201, 169, 106)   # #c9a96a
SUB = (244, 239, 232, 165)

FD = "/usr/share/fonts/truetype/liberation/"
SERIF = FD + "LiberationSerif-Regular.ttf"
SERIF_IT = FD + "LiberationSerif-Italic.ttf"
SANS_B = FD + "LiberationSans-Bold.ttf"

W, H = 2200, 1700  # 11x8.5in @ 200dpi
CX = W // 2        # fold line
FRONT_CX = CX + W // 4
BACK_CX = W // 4


def centered(draw, cx, y, text, font, fill, tracking=0):
    if tracking:
        text = (" " * tracking).join(list(text))
    bb = draw.textbbox((0, 0), text, font=font)
    draw.text((cx - (bb[2] - bb[0]) / 2, y), text, font=font, fill=fill)
    return bb[3] - bb[1]


def render_png(path):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img, "RGBA")

    # fold line
    for y in range(0, H, 28):
        d.line([(CX, y), (CX, y + 12)], fill=CREAM + (60,), width=2)

    # back cover (left half): brand mark centered
    brand = ImageFont.truetype(SANS_B, 40)
    tag = ImageFont.truetype(SERIF_IT, 34)
    centered(d, BACK_CX, H // 2 - 60, "T R E N D L I F T", brand, GOLD)
    centered(d, BACK_CX, H // 2 + 20, "Gifts worth the wait.", tag, SUB)

    # front cover (right half)
    h1 = ImageFont.truetype(SERIF, 120)
    h1i = ImageFont.truetype(SERIF_IT, 120)
    lead = ImageFont.truetype(SERIF, 48)
    sub = ImageFont.truetype(SERIF, 34)

    y = 280
    centered(d, FRONT_CX, y, "Happy", h1, CREAM); y += 150
    centered(d, FRONT_CX, y, "Father's Day", h1i, GOLD); y += 210
    d.line([(FRONT_CX - 70, y), (FRONT_CX + 70, y)], fill=GOLD, width=6)
    y += 70
    for line in ["The best gifts can't be rushed.",
                 "Yours is already on its way —",
                 "picked just for you."]:
        centered(d, FRONT_CX, y, line, lead, CREAM); y += 78
    y += 50
    for line in ["Consider this the unwrapping preview.",
                 "The real thing shows up at the door",
                 "in a few days. Worth it."]:
        centered(d, FRONT_CX, y, line, sub, SUB); y += 52

    img.save(path)


def render_pdf(path):
    pw, ph = landscape(letter)  # 792 x 612 pt
    c = pdfcanvas.Canvas(path, pagesize=(pw, ph))
    c.setFillColorRGB(*[v / 255 for v in BG])
    c.rect(0, 0, pw, ph, stroke=0, fill=1)

    cx_back, cx_front = pw / 4, 3 * pw / 4

    c.setDash(3, 5)
    c.setStrokeColorRGB(*[v / 255 for v in CREAM], alpha=0.25)
    c.line(pw / 2, 0, pw / 2, ph)
    c.setDash()

    def ctext(cx, y, text, font, size, color, alpha=1.0):
        c.setFont(font, size)
        c.setFillColorRGB(*[v / 255 for v in color], alpha=alpha)
        c.drawCentredString(cx, y, text)

    # back cover
    ctext(cx_back, ph / 2 + 6, "T R E N D L I F T", "Helvetica-Bold", 14, GOLD)
    ctext(cx_back, ph / 2 - 18, "Gifts worth the wait.", "Times-Italic", 12,
          CREAM, 0.55)

    # front cover (PDF y-axis is bottom-up)
    y = ph - 150
    ctext(cx_front, y, "Happy", "Times-Roman", 44, CREAM); y -= 52
    ctext(cx_front, y, "Father's Day", "Times-Italic", 44, GOLD); y -= 40
    c.setStrokeColorRGB(*[v / 255 for v in GOLD])
    c.setLineWidth(2)
    c.line(cx_front - 28, y, cx_front + 28, y)
    y -= 40
    for line in ["The best gifts can't be rushed.",
                 "Yours is already on its way —",
                 "picked just for you."]:
        ctext(cx_front, y, line, "Times-Roman", 17, CREAM); y -= 26
    y -= 16
    for line in ["Consider this the unwrapping preview.",
                 "The real thing shows up at the door",
                 "in a few days. Worth it."]:
        ctext(cx_front, y, line, "Times-Roman", 12, CREAM, 0.65); y -= 18

    c.showPage()
    c.save()


if __name__ == "__main__":
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    render_png(os.path.join(here, "fathers-day-gift-note.png"))
    render_pdf(os.path.join(here, "fathers-day-gift-note.pdf"))
    print("rendered PNG + PDF")
