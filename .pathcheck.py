"""Consistency check for the _learning_paths collection.

Resolves every step and "go deeper" URL to a content file, and checks each path against the
authoring rules in .claude/content/learning-path-guide.md. Run it after adding or editing a
path, and after moving or deleting any guide, resource, case study, or post:

    python .pathcheck.py

Needs PyYAML, which ships with most Python installs (pip install pyyaml otherwise).
"""
import glob, os, re, sys
import yaml

# A focused path runs 10-20 steps in 3-5 stages. A path that spans a role change may run
# longer by repeating levels; past these limits, split it.
MIN_STEPS, MAX_STEPS = 10, 40
MIN_STAGES, MAX_STAGES = 3, 8
MAX_OVERLAP = 0.25
# Stages climb through these levels in order; a level may repeat, never go back.
LEVELS = ["Foundations", "Basics", "Intermediate", "Advanced"]
REQUIRED = ("title", "order", "description", "goal", "audience", "assumes", "last_reviewed", "stages")

def front_matter(path):
    text = open(path, encoding="utf-8").read()
    m = re.match(r"---\n(.*?)\n---", text, re.S)
    return yaml.safe_load(m.group(1)) if m else {}

def content_urls():
    """Map each content page's URL to its source file, following _config.yml's permalinks."""
    urls = {}
    for path in glob.glob("_guides/**/*.md", recursive=True):
        rel = os.path.relpath(path, "_guides").replace(os.sep, "/")
        urls["/study-guides/" + rel[:-3] + ".html"] = path
    for path in glob.glob("_resources/*.md"):
        urls["/resources/" + os.path.basename(path)[:-3] + ".html"] = path
    for path in glob.glob("_case_studies/*.md"):
        urls["/case-studies/" + os.path.basename(path)[:-3] + ".html"] = path
    for path in glob.glob("_posts/*.md"):
        m = re.match(r"(\d{4})-(\d{2})-(\d{2})-(.+)\.md$", os.path.basename(path))
        if m:
            y, mo, d, slug = m.groups()
            # A front matter date overrides the filename date in the permalink.
            date = front_matter(path).get("date")
            if date:
                y, mo, d = f"{date.year:04d}", f"{date.month:02d}", f"{date.day:02d}"
            urls[f"/blog/{y}/{mo}/{d}/{slug}.html"] = path
    return urls

urls = content_urls()
problems, steps_by_path, ids = [], {}, set()

for path in sorted(glob.glob("_learning_paths/*.md")):
    pid = os.path.basename(path)[:-3]
    ids.add(pid)
    fm = front_matter(path)
    for key in REQUIRED:
        if key not in fm:
            problems.append(f"{path}: missing front matter '{key}'")
    stages = fm.get("stages") or []
    if not MIN_STAGES <= len(stages) <= MAX_STAGES:
        problems.append(f"{path}: {len(stages)} stages (want {MIN_STAGES}-{MAX_STAGES})")

    main, seen, non_guide, last_level = [], set(), False, -1
    for i, stage in enumerate(stages, 1):
        where = f"{path}: stage {i} ({stage.get('name', '?')})"
        if not stage.get("name") or not stage.get("purpose"):
            problems.append(f"{where}: needs a name and a purpose")
        level = stage.get("level")
        if level not in LEVELS:
            problems.append(f"{where}: level '{level}' is not one of {', '.join(LEVELS)}")
        else:
            rank = LEVELS.index(level)
            if i == 1 and rank != 0:
                problems.append(f"{where}: the first stage must be Foundations")
            if rank < last_level:
                problems.append(f"{where}: {level} comes after {LEVELS[last_level]}; levels only climb")
            last_level = max(last_level, rank)
        for step in stage.get("steps") or []:
            url = step.get("url", "")
            main.append(url)
            if url not in urls:
                problems.append(f"{where}: step URL resolves to nothing: {url}")
            elif not url.startswith("/study-guides/"):
                non_guide = True
            if not (step.get("why") or "").strip():
                problems.append(f"{where}: step {url} has no 'why'")
            if url in seen:
                problems.append(f"{where}: {url} appears twice")
            seen.add(url)
        checkpoint = stage.get("checkpoint") or {}
        if not (checkpoint.get("can") or "").strip() or not (checkpoint.get("try") or "").strip():
            problems.append(f"{where}: needs a checkpoint with 'can' and 'try'")
        unknown = set(checkpoint) - {"can", "try", "exit"}
        if unknown:
            problems.append(f"{where}: checkpoint has unknown keys {sorted(unknown)}")
        if "exit" in checkpoint and checkpoint["exit"] is not True:
            problems.append(f"{where}: checkpoint 'exit' is either true or left out")
        if checkpoint.get("exit") and i == len(stages):
            problems.append(f"{where}: the last stage is the end of the path, not an exit point")
        for url in stage.get("deeper") or []:
            if url not in urls:
                problems.append(f"{where}: go-deeper URL resolves to nothing: {url}")
            if url in seen:
                problems.append(f"{where}: {url} appears twice")
            seen.add(url)

    if not MIN_STEPS <= len(main) <= MAX_STEPS:
        problems.append(f"{path}: {len(main)} main steps (want {MIN_STEPS}-{MAX_STEPS}); split the path")
    if main and not non_guide:
        problems.append(f"{path}: every step is a guide; add a resource, case study, or essay")
    steps_by_path[pid] = set(main)

for path in sorted(glob.glob("_learning_paths/*.md")):
    prereq = front_matter(path).get("prerequisite")
    if prereq and prereq not in ids:
        problems.append(f"{path}: prerequisite '{prereq}' is not a path")

pids = sorted(steps_by_path)
for i, a in enumerate(pids):
    for b in pids[i + 1:]:
        shared = steps_by_path[a] & steps_by_path[b]
        worst = max(len(shared) / max(len(steps_by_path[a]), 1), len(shared) / max(len(steps_by_path[b]), 1))
        if worst > MAX_OVERLAP:
            problems.append(f"{a} and {b} share {len(shared)} steps ({worst:.0%} of the shorter path; max {MAX_OVERLAP:.0%})")

for pid in pids:
    print(f"{pid}: {len(steps_by_path[pid])} steps")
for p in problems:
    print("PROBLEM:", p)
print(f"{len(pids)} paths, {len(problems)} problems")
sys.exit(1 if problems else 0)
