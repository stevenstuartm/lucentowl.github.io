"""Consistency check for the _figures collection.

Reports figure ids that guides or resources reference but that do not exist, figures with
missing front matter, figures no page uses, and where each figure is used. Run it after
adding, renaming, or embedding a figure:

    python .figcheck.py

Pair it with `python .svgcheck.py _figures/*.html` for the geometry of each figure.
"""
import glob, os, re, sys

KINDS = {"context", "container", "component", "dynamic", "deployment", "state",
         "graph", "flow", "structure", "layering", "boundary", "rules", "chart"}
REQUIRED = ("title", "kind", "system", "summary")

def front_matter(path):
    text = open(path, encoding="utf-8").read()
    m = re.match(r"---\n(.*?)\n---\n", text, re.S)
    return (m.group(1) if m else ""), text

figures, problems = {}, []
for path in sorted(glob.glob("_figures/*.html")):
    fid = os.path.splitext(os.path.basename(path))[0]
    fm, text = front_matter(path)
    fields = dict(re.findall(r"^(\w+):\s*(.+)$", fm, re.M))
    figures[fid] = fields
    for key in REQUIRED:
        if key not in fields:
            problems.append(f"{path}: missing front matter '{key}'")
    if fields.get("kind") and fields["kind"] not in KINDS:
        problems.append(f"{path}: unknown kind '{fields['kind']}'")
    if text.count("<svg") != 1:
        problems.append(f"{path}: expected exactly one <svg>, found {text.count('<svg')}")

uses = {fid: [] for fid in figures}
def record(fid, where):
    if fid in uses:
        uses[fid].append(where)
    else:
        problems.append(f"{where}: references unknown figure '{fid}'")

for path in sorted(glob.glob("_guides/**/*.md", recursive=True) + glob.glob("_resources/*.md")):
    text = open(path, encoding="utf-8").read()
    for fid in re.findall(r'\{%-?\s*include\s+figure\.html\s+id="([^"]+)"', text):
        record(fid, path)
    fm, _ = front_matter(path)
    block = re.search(r"^figures:\n((?:\s+-\s+.+\n)+)", fm + "\n", re.M)
    if block:
        for fid in re.findall(r"-\s+(\S+)", block.group(1)):
            record(fid, path + " (composite)")

for fid, where in uses.items():
    composites = [w for w in where if w.endswith("(composite)")]
    if not where:
        problems.append(f"_figures/{fid}.html: not used by any guide or resource")
    elif not composites:
        problems.append(f"_figures/{fid}.html: embedded but not in any composite resource")
    print(f"{fid}: " + (", ".join(where) if where else "(unused)"))

print()
for p in problems:
    print("PROBLEM", p)
print(f"{len(figures)} figures, {len(problems)} problems")
sys.exit(1 if problems else 0)
