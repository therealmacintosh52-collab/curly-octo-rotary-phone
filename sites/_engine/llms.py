"""llms.txt and llms-full.txt.

Honest framing, recorded here so nobody over-invests: Google stated in 2026
that llms.txt is not used for AI Overviews or AI Mode, and no major model
provider has committed to reading it in production. Its real, current value is
developer tooling -- IDE agents, MCP servers and some in-product assistants do
fetch it. It costs one build step and a few KB, so we ship it as a cheap hedge,
not as a ranking factor.

Both files are generated from the same page registry that feeds sitemap.xml,
so they cannot drift out of sync with the site.
"""

import os


def build_llms_files(cfg, pages, out_dir, summary="", key_facts=None,
                     full_sections=None):
    lines = ["# %s" % cfg.name, ""]
    if cfg.tagline:
        lines += ["> %s" % cfg.tagline, ""]
    if summary:
        lines += [summary, ""]

    if key_facts:
        lines += ["## Key facts", ""]
        for label, value in key_facts:
            lines.append("- **%s:** %s" % (label, value))
        lines.append("")

    lines += ["## Pages", ""]
    for p in sorted(pages, key=lambda x: x["path"]):
        desc = p.get("description", "")
        lines.append("- [%s](%s%s)%s"
                     % (p["title"], cfg.base_url, p["path"],
                        ": %s" % desc if desc else ""))
    lines.append("")

    dest = os.path.join(out_dir, "llms.txt")
    with open(dest, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))

    # llms-full.txt carries the actual answers, not just links -- that is the
    # version worth fetching.
    full = ["# %s -- full reference" % cfg.name, ""]
    if summary:
        full += [summary, ""]
    for heading, body in (full_sections or []):
        full += ["## %s" % heading, "", body.strip(), ""]
    dest_full = os.path.join(out_dir, "llms-full.txt")
    with open(dest_full, "w", encoding="utf-8") as fh:
        fh.write("\n".join(full))
    return dest, dest_full
