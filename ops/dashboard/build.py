#!/usr/bin/env python3
"""Build the live ops board HTML. Orchestrator-owned. Usage: build.py OUT.html
Embeds a snapshot of ops/*.md; the page overlays live GitHub reads when opened in claude.ai."""
import json, subprocess, sys, datetime, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[2]
FILES = ["STATE.md","TODAY.md","TASKS.md","EXPERIMENTS.md","IDEAS.md","LOG.md","INCIDENTS.md","LEDGER.md","METRICS.md"]
snap = {f: (ROOT/"ops"/f).read_text() if (ROOT/"ops"/f).exists() else "" for f in FILES}
sha = subprocess.run(["git","rev-parse","--short","HEAD"],cwd=ROOT,capture_output=True,text=True).stdout.strip()
msg = subprocess.run(["git","log","-1","--format=%s"],cwd=ROOT,capture_output=True,text=True).stdout.strip()
when = subprocess.run(["git","log","-1","--format=%cI"],cwd=ROOT,capture_output=True,text=True).stdout.strip()
built = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
data = json.dumps({"files":snap,"commit":{"sha":sha,"msg":msg,"when":when},"builtAt":built}).replace("</","<\\/")
TEMPLATE = (ROOT/"ops"/"dashboard"/"template.html").read_text()
pathlib.Path(sys.argv[1]).write_text(TEMPLATE.replace("/*__SNAPSHOT__*/", "window.SNAPSHOT="+data+";"))
print("built", sys.argv[1], sha)
