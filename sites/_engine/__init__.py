"""Shared static-site engine.

Every business site in sites/ imports this. The engine owns everything that is
the same for every business — the <head>, the entity graph, the sitemap, the
deploy files, llms.txt and the offline audit. Each site owns its own config,
content and page bodies.

Sites import it with a short sys.path insert so there is nothing to install:

    import os, sys
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    from _engine import SiteConfig, Renderer

Python 3 standard library only, by design. netlify.toml and the GitHub Actions
workflow both just run `python3 build.py`, and that must keep working.
"""

from .site import SiteConfig, Hours, Platform, Profile
from .html import esc, jstr, seo_title, crumbs_html, slugify
from .render import Renderer
from .schema import SchemaGraph
from .sitemap import build_sitemap
from .deploy import build_deploy_files
from .llms import build_llms_files

__all__ = [
    "SiteConfig", "Hours", "Platform", "Profile",
    "esc", "jstr", "seo_title", "crumbs_html", "slugify",
    "Renderer", "SchemaGraph",
    "build_sitemap", "build_deploy_files", "build_llms_files",
]
