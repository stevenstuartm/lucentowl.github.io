# untangle

Make a dense draft readable again without changing what it argues. Use it when the content is right but the prose has become hard to walk through: long paragraphs, stacked clauses, and the argument lost under defenses. The usual cause is review rounds (especially `/review-publishable convince-me`) that answered each objection with a sentence or clause in the paragraph where it came up, while the reading-time budget took the cost out of transitions and breathing room.

`/review-publishable` looks for defects in the argument. `/untangle` doesn't. The content is fixed, and the job is to take out what the argument doesn't need and spend the freed words on readability.

**Usage**: `/untangle [file]`

**File resolution**: Use the file path argument if one is given. Otherwise use the file currently open in the IDE (`ide_opened_file` context). Ask only if neither signal is present.

**Signs a draft needs it**: paragraphs over about 120 words, several sentences over 35 words, paragraphs that end with a sentence answering an objection, or a reader who can't state a section's point after one read.

---

## Rules

- **The content is fixed.** The thesis, the author's held positions, the examples, the sources, and the author's first-person text stay. Add no new claims and no new sources, and don't research.
- **Every rewrite targets a stated density defect**: a paragraph doing more than one job, a sentence that needs a reread, an unclear referent, or a jump between paragraphs. Don't reword prose that already reads well.
- **Keep the author's voice.** Metaphors, idioms, and first-person asides stay, even when you'd phrase them differently. Flag any you doubt in the report, and don't change them.
- **The budget holds.** A blog post stays under 3,000 rendered words (see `/review-publishable` Step 8). Splitting sentences adds words, so plan on cutting about as much as the rewrite adds.
- **Runs unattended.** Make every call yourself, record it in the report, and don't stop to ask. Don't commit.

## Steps

### 1. Baseline

Copy the file to the scratchpad as the before version. Measure the word count with the `/review-publishable` Step 8 command, and measure density with:

```bash
python - <file> <<'EOF'
import re,sys
s=open(sys.argv[1],encoding='utf-8').read(); b=s[s.index('\n---\n',4)+5:]
paras=[x for x in b.split('\n\n') if x.strip() and not re.match(r'\s*(#|\||```|\d+\.|- )',x)]
L=[len(t.split()) for x in paras for t in re.split(r'(?<=[.?!"])\s+(?=[A-Z])',x)]
P=[len(x.split()) for x in paras]
print('paragraphs',len(P),'avg',sum(P)//len(P),'max',max(P),'| sentences avg',round(sum(L)/len(L),1),'over 35:',sum(l>35 for l in L))
EOF
```

### 2. Inventory (no edits)

In a scratch file, write the skeleton: the thesis in one sentence, then the one claim each H2 and H3 section makes. Then tag each sentence in the body:

- **Claim**: carries the argument
- **Support**: evidence or an example for a claim
- **Defense**: heads off an objection
- **Connective**: moves the reader from one step to the next

Mark every paragraph that carries more than one claim or more than one defense. Those are where the tangle is.

### 3. Triage

Each **defense** gets one outcome:

- **Keep inline** when a typical reader would raise that objection at that exact spot. Keep at most one or two per section.
- **Consolidate** into the one paragraph that faces that objection, or into a section on where the argument stops applying. One full answer reads stronger than several partial ones.
- **Cut as out of scope** when the objection is one few readers would raise.
- **Leave to the source** when a cited source already answers it.

Also cut:

- support that backs no claim in the skeleton
- recaps that re-argue another section's point. Shrink them to a clause that points back ("the authorization problem above")

### 4. Re-expand

Rewrite with the words the triage freed:

- One point per paragraph, with the topic sentence first. Split a paragraph where its job changes.
- Split sentences held together by semicolons, appositives, or a chain of "which" clauses.
- Turn parallel criteria into a numbered list when they work as a test the reader applies.
- Add or repair transitions where the argument moves, so each paragraph follows from the one before.
- Give examples room. Never cut the sentence that sets up an example.

### 5. Re-budget

Measure again. If the post is over budget, cut in this order: recaps, restating openers, defense clauses the triage kept, then loose modifiers. Never cut examples, sources for claims the post still makes, or the setup of an example. Remove a source from `sources` only if no sentence still uses it.

### 6. Lint

Run the `refine-prose` mechanical checks (`.claude/skills/refine-prose/writing-standards.md`, plus `platforms/jekyll-kramdown.md`) on the body and loop until every pattern returns zero matches.

### 7. Fresh reader

Launch a fresh `general-purpose` agent with `run_in_background: false`. It never sees the before version or your reasoning. Give it this brief, with the file path filled in:

> You are a plain technical reader (a working developer), not an editor or skeptic. Read `<file>` once, top to bottom, skipping the YAML front matter. Don't research anything and don't judge whether the argument is correct. Judge only readability. Then report:
> 1. The post's thesis in one sentence, in your own words.
> 2. For each H2 and H3 section, the one point it makes, in one sentence. If you can't tell what a section's point is, say so.
> 3. Any paragraph or sentence where you had to reread to follow it, quoting its opening words and saying what tripped you (stacked clauses, unclear referent, a point that arrives from nowhere, a jump between paragraphs).
> 4. Any place where the argument's thread felt lost, or where a paragraph seemed to defend against an objection instead of moving the argument forward.
> Keep the report under 500 words. Don't edit the file.

Fix every reread and every lost thread the reader reports, then repeat Steps 5 and 6. If the reader couldn't state a section's point or got the thesis wrong, fix that section and run one more fresh reader. Stop after two readers. Readers' notes on voice, such as a metaphor they disliked, go to the report as author decisions. Don't apply them.

### 8. Report

- A before/after table: words, reading time, paragraph count, average and longest paragraph, average sentence length, and sentences over 35 words
- What changed, by section
- The **cut list**: every claim, defense, or detail removed, so the author can confirm nothing load-bearing went missing
- The reader's thesis sentence, and whether it matches the post's
- What was left as is for the author to judge, with the reason
