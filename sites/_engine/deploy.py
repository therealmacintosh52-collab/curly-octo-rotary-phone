"""robots.txt, site.webmanifest, _headers, _redirects, .htaccess, CNAME."""

import json
import os


def build_deploy_files(cfg, out_dir, redirects=None, extra_robots=""):
    written = []

    # --- robots.txt -------------------------------------------------------
    # Explicitly welcoming the AI crawlers. They obey robots.txt, and a
    # default-deny CDN rule or a stray Disallow is a common silent reason a
    # site never gets cited.
    robots = ["User-agent: *", "Allow: /", ""]
    for bot in ("GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot",
                "Claude-User", "Claude-SearchBot", "PerplexityBot",
                "Perplexity-User", "Google-Extended", "Applebot-Extended",
                "CCBot", "Bingbot", "Amazonbot", "meta-externalagent"):
        robots += ["User-agent: %s" % bot, "Allow: /", ""]
    if extra_robots:
        robots += [extra_robots, ""]
    robots += ["Sitemap: %s/sitemap.xml" % cfg.base_url, ""]
    written.append(_write(out_dir, "robots.txt", "\n".join(robots)))

    # --- site.webmanifest -------------------------------------------------
    icon = cfg.logo or cfg.favicon or "/assets/img/favicon.svg"
    mime = ("image/svg+xml" if icon.endswith(".svg")
            else "image/png" if icon.endswith(".png") else "image/jpeg")
    manifest = {
        "name": cfg.name,
        "short_name": cfg.short,
        "description": cfg.description,
        "start_url": "/",
        "display": "standalone",
        "background_color": cfg.theme.get("background", "#ffffff"),
        "theme_color": cfg.theme.get("theme_color", "#111111"),
        "icons": [
            {"src": icon, "sizes": "192x192", "type": mime, "purpose": "any"},
            {"src": icon, "sizes": "512x512", "type": mime, "purpose": "any"},
        ],
    }
    written.append(_write(out_dir, "site.webmanifest",
                          json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"))

    # --- _headers (Netlify / Cloudflare Pages) ----------------------------
    headers = """/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/*.html
  Cache-Control: public, max-age=0, must-revalidate

/sitemap.xml
  Cache-Control: public, max-age=3600

/llms.txt
  Content-Type: text/plain; charset=utf-8

/llms-full.txt
  Content-Type: text/plain; charset=utf-8
"""
    written.append(_write(out_dir, "_headers", headers))

    # --- _redirects -------------------------------------------------------
    lines = []
    for src, dst in (redirects or []):
        lines.append("%s  %s  301!" % (src, dst))
        if not src.endswith("/"):
            lines.append("%s/  %s  301!" % (src, dst))
    if lines:
        written.append(_write(out_dir, "_redirects", "\n".join(lines) + "\n"))

    # --- .htaccess (Apache / cPanel) --------------------------------------
    host = cfg.base_url.split("://", 1)[-1]
    ht = ["RewriteEngine On",
          "RewriteCond %{HTTPS} off",
          "RewriteRule ^(.*)$ https://" + host + "/$1 [R=301,L]",
          ""]
    for src, dst in (redirects or []):
        ht.append("Redirect 301 %s %s" % (src, dst))
    ht += ["", "ErrorDocument 404 /404.html", ""]
    written.append(_write(out_dir, ".htaccess", "\n".join(ht)))

    if cfg.custom_domain:
        written.append(_write(out_dir, "CNAME", cfg.custom_domain + "\n"))

    return written


def _write(out_dir, name, text):
    dest = os.path.join(out_dir, name)
    os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
    with open(dest, "w", encoding="utf-8") as fh:
        fh.write(text)
    return dest
