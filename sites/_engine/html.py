"""Small HTML/string helpers. No site-specific knowledge lives here."""

import json
import re
import unicodedata


def esc(text):
    """Escape a string for use in HTML text or an attribute value."""
    return (str(text).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;").replace("'", "&#x27;"))


def jstr(text):
    """JSON-encode a string for embedding inside a <script> block.

    json.dumps handles the quoting; the </ escape stops a literal '</script>'
    inside the data from closing the tag early.
    """
    return json.dumps(str(text), ensure_ascii=False).replace("</", "<\\/")


def seo_title(base, suffix, limit=60):
    """Append the brand suffix to a title, but only while it still fits.

    Titles over ~60 characters get truncated in the SERP, and a truncated
    brand name reads worse than no brand name.
    """
    full = "%s | %s" % (base, suffix)
    return full if len(full) <= limit else base


def slugify(text):
    """'Sloppy Cheeto Fries' -> 'sloppy-cheeto-fries'."""
    text = unicodedata.normalize("NFKD", str(text))
    text = text.encode("ascii", "ignore").decode("ascii").lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def crumbs_html(trail):
    """Visible breadcrumb nav. `trail` is [(label, url_or_None), ...]."""
    parts = []
    for label, url in trail:
        if url:
            parts.append('<a href="%s">%s</a>' % (url, esc(label)))
        else:
            parts.append('<span aria-current="page">%s</span>' % esc(label))
    return ('<nav class="crumbs" aria-label="Breadcrumb">%s</nav>'
            % '<span class="crumb-sep" aria-hidden="true">/</span>'.join(parts))


def minutes(hhmm):
    """'13:45' -> 825. Used to detect overnight windows."""
    h, m = str(hhmm).split(":")
    return int(h) * 60 + int(m)


def human_time(hhmm):
    """'00:45' -> '12:45 AM'."""
    h, m = (int(x) for x in str(hhmm).split(":"))
    suffix = "AM" if h < 12 else "PM"
    h12 = h % 12 or 12
    return "%d:%02d %s" % (h12, m, suffix)
