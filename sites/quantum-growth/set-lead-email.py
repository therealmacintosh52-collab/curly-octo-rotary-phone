#!/usr/bin/env python3
"""Point the lead form at your inbox.

    python3 set-lead-email.py you@yourdomain.com

The form posts to FormSubmit, which needs no account. The first lead triggers
a one-time confirmation email to this address; click it once and every later
lead arrives by email. Submit a test lead yourself right after running this.

Until an address is set the form tells the visitor it is not connected and
sends nothing, so no lead can be silently lost. The address is written into
the page source, so it is public: use an inbox you do not mind spam reaching,
or ask FormSubmit for a masked alias after activating.

Re-runnable. To go back to the unset state, pass: replace-with-lead-email
"""
import io, os, re, sys

PLACEHOLDER = "replace-with-lead-email"
PAGE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public", "index.html")
ACTION = re.compile(r'(<form class="lead" id="lead" action="https://formsubmit\.co/)([^"]+)(")')


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    addr = sys.argv[1].strip()
    if addr != PLACEHOLDER and not re.fullmatch(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}", addr):
        sys.exit("That does not look like an email address: %s" % addr)

    with io.open(PAGE, encoding="utf-8") as fh:
        s = fh.read()
    m = ACTION.search(s)
    if not m:
        sys.exit("Could not find the lead form in %s" % PAGE)
    if m.group(2) == addr:
        print("Already set to %s, nothing to do." % addr)
        return
    with io.open(PAGE, "w", encoding="utf-8") as fh:
        fh.write(ACTION.sub(lambda k: k.group(1) + addr + k.group(3), s, count=1))

    if addr == PLACEHOLDER:
        print("Lead form reset: it will say it is not connected until you set an address.")
    else:
        print("Lead form now sends to %s." % addr)
        print("Next: submit one test lead and click the confirmation email FormSubmit sends.")


if __name__ == "__main__":
    main()
