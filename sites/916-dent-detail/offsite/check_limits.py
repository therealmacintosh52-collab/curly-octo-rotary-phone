#!/usr/bin/env python3
"""Checks character limits of fenced blocks tagged  ```text limit=N [id=x]  in GBP-KIT.md and PROFILE-COPY.md,
and verifies the three master descriptions equal the ones in ../strategy/ENTITY-PLAN.md.
Exit code 1 on any failure."""
import re, os, sys
H = os.path.dirname(os.path.abspath(__file__)); bad = 0
for f in ('GBP-KIT.md', 'PROFILE-COPY.md'):
    s = open(os.path.join(H, f)).read()
    for m in re.finditer(r'```text limit=(\d+)(?: id=([\w-]+))?\n(.*?)\n```', s, re.S):
        lim, ident, txt = int(m.group(1)), m.group(2) or '-', m.group(3)
        ok = len(txt) <= lim and '{{' not in txt and not re.search(r'https?://|\d{3}[-) ]\s?\d{3}-\d{4}', txt)
        bad += not ok
        print(f'{"OK  " if ok else "FAIL"} {f:16} {ident:10} {len(txt):4}/{lim}')
ep = open(os.path.join(H, '..', 'strategy', 'ENTITY-PLAN.md')).read()
pc = open(os.path.join(H, 'PROFILE-COPY.md')).read()
for key, label in (('short', 'Short'), ('medium', 'Medium'), ('long', 'Long')):
    e = re.search(r'\*\*' + label + r', \d+ chars[^\n]*\n(.*?)\n', ep, re.S).group(1).strip()
    p = re.search(r'id=' + key + r'\n(.*?)\n```', pc, re.S).group(1).strip()
    ok = e == p; bad += not ok
    print(('OK  ' if ok else 'FAIL'), 'matches ENTITY-PLAN', key)
g = open(os.path.join(H, 'GBP-KIT.md')).read()
gd = re.search(r'limit=750\n(.*?)\n```', g, re.S).group(1).strip()
ok = gd == re.search(r'id=long\n(.*?)\n```', pc, re.S).group(1).strip(); bad += not ok
print(('OK  ' if ok else 'FAIL'), 'GBP description == master long copy')
sys.exit(1 if bad else 0)
