# review-publishable

Review publishable content against the site's highest quality standards before it goes live. Accepts an optional file path as argument.

**Usage**: `/review-publishable [file] [iterate] [convince-me]`

**File resolution**: Use the file path argument if one is given. Otherwise use the file currently open in the IDE (`ide_opened_file` context) — this is the common case and should not require confirmation. Only ask the user which file to review if neither signal is present (no argument and no `ide_opened_file` context at all).

**Modes**: `iterate` and `convince-me` are keywords, accepted in any order and alongside the file path. Any other argument is the file. With neither keyword, run the single review below. Either keyword runs unattended: every finding is resolved in the file without waiting for the author (see **Autonomous resolution** at the end of this file). Each mode is defined in its own section at the end of this file:

| Mode | What it adds | Stops when |
| --- | --- | --- |
| `iterate` | Repeats the full review, each round in a fresh subagent that has never seen the post | A round needs no updates, or three rounds have run |
| `convince-me` | After the review, fresh skeptic subagents read the post and say whether it convinced them. The orchestrator revises after each one | A skeptic is convinced |
| both | `iterate` runs to completion first, then `convince-me` | Both conditions are met |

---

## Core Publishing Philosophy

Every piece of content published on this site must satisfy two non-negotiable goals simultaneously:

**1. Clarity from complexity.**
Take something genuinely difficult — a concept, a tradeoff, a pattern in how systems or organizations behave — and render it so clearly that the reader cannot misunderstand it. Not simplified into dishonesty, but distilled into precision. Complexity that has not been resolved in the author's mind will not resolve itself on the page. If a reader finishes a section and cannot state what it argued, the section failed.

**2. Scholarly quality.**
Publish work that a careful, skeptical reader would respect. Specific claims grounded in mechanism or evidence. Honest acknowledgment of where the argument has limits. No vague gestures toward complexity the author hasn't actually worked through. Modern online publishing is saturated with content that sounds substantive but says nothing falsifiable. This site aims to be the rare counterexample: the kind of work a thoughtful practitioner returns to because it sharpened something real.

These goals constrain each other productively. Clarity without depth is shallow. Depth without clarity is obscurantism. The target is both at once.

**Length discipline**: A blog post should be exactly as long as its argument requires — not a word less (underdeveloped), not a word more (padded). Length is not a proxy for quality. A short post that lands something precise is more valuable than a long post that circles its thesis without resolution.

---

## Review Steps

Work through each step in order. Do not skip any step. Report findings for each step before moving to the next.

**The completion rule.** Every finding raised in Steps 2-10 must be carried through to a resolution in Step 11 and accounted for in the Step 12 ledger. A finding that is described but never fixed, never drafted into concrete replacement text, and never explicitly deferred with a reason is a review failure, not a style choice.

The most common way this command fails is by producing an impressive list of problems, quietly fixing the easy ones, and letting the rest evaporate between the report and the verdict. The author is then left believing the post was handled. Do not do that.

**Assign every finding an ID at the moment you raise it.** IDs are what make the Step 12 ledger checkable, so never raise a finding without one.

| Prefix | Raised in | Finding type |
| --- | --- | --- |
| `X#` | Step 2 | Linter judgment call (not the auto-fixed mechanical hits) |
| `F#` | Step 3 | Format / content-type compliance |
| `O#` | Step 4 | Outline and header structure |
| `H#` | Step 5 | Thesis clarity or section drift |
| `C#` | Step 6 | Clarity |
| `S#` | Step 7 | Scholarly quality |
| `L#` | Step 8 | Length and scope |
| `A#` | Step 9 | Practical artifact |
| `T#` | Step 10 | Title |

**A finding needs a defect you can state.** Before raising anything, write down the specific way a reader fails on the current text. It has to be one of these:

- A factual error, a misquote, or a wrong attribution
- A mechanical rule hit (linter pattern, link rule, front matter field)
- A claim with no support or source, or a fabricated experience
- An ambiguity, where you can write out two different readings a careful reader could take
- A structural break, such as headers that don't tell the argument or a section that contradicts the thesis
- A length budget overrun

These are **not** defects, and they are never findings:

- Deliberate abstraction, especially in introductions and conclusions, where a sentence frames or summarizes what the body argues in detail
- The author's voice, rhythm, word choice, or closing lines
- A sentence you would have phrased differently, or think could be "tighter" or "more specific", when no reader would misread it
- A summary sentence that previews or recaps the body. Previews and recaps orient the reader, so they aren't restatements to cut

If you can't state the defect in one sentence that names what a reader would get wrong, don't raise the finding. Your rewrite of a sentence that has no defect is almost always worse than the author's original, because it trades the author's intent for yours.

**The edit is no bigger than the defect.** Fix the comma, the misquote, the overstated clause, or the ambiguous word. Don't rewrite the surrounding sentence or paragraph to fix it. If the only fix you can see means rewriting the author's framing, raise it as ASK instead.

**Classify every finding as you raise it.** There are two classes:

- **FIX** — the defect is stated and the fix touches only the defect, so you write it **into the file** in Step 11. Factual corrections, mechanical fixes, sourcing, removing an unsupported claim, and bringing a post under budget are FIX.
- **ASK** — applying it would require inventing something you do not have (a personal experience, a number only the author knows, a claim you cannot verify), or the fix would change the author's framing, emphasis, structure, or voice. Leave that text as it stands and put the question in the ledger, with the defect stated.

**Strategic calls are the author's.** Reordering sections, adding a table or section, cutting a section, and changing emphasis are ASK unless the defect is a rule violation (such as a budget overrun). Describe the proposed change and the defect it fixes in one or two lines, and don't build it.

**Never hand the author text to paste.** A replacement paragraph sitting in the chat report is not a resolution. The author cannot evaluate a paragraph without the paragraphs around it, cannot see how a new section changes the post's balance, and cannot read a header tree in isolation. Work that the author has to reassemble by hand has been moved, not done.

The file is the deliverable. The chat report is the account of what you did to it. When the content lives in a git repository, the author reviews with `git diff` and reverts anything they dislike, so applying a change you can defend is always cheaper for them than describing one they have to build.

### Step 1 — Read and identify

Resolve the target file: use `$ARGUMENTS` if provided; otherwise use the file currently open in the IDE (from `ide_opened_file` context); otherwise ask the user. Read the resolved file. Identify:
- Content type (blog post in `_posts/`, study guide in `_guides/`, other)
- Title, date, and description from front matter
- Approximate word count and structure (number of H2/H3 sections)
- Reading time as the site will show it (see the reading-time budget in Step 8)

State these facts before proceeding.

### Step 2 — Run the mechanical linter

Invoke `/refine-prose` on the resolved file. It runs the linter to a clean state (looping fixes until zero Errors) and reports which Style suggestions it applied or intentionally left. Fold its final report into this review's LINTER RESULTS section — do not re-run the raw script separately or re-describe the loop here.

Mechanical hits fixed inside that loop need no IDs; they are already resolved. But every judgment-call issue the refine-prose self-review surfaces and leaves standing (an absolute, a semicolon tic, a command-style imperative run, a voice mismatch against the platform doc) is a finding. Give it an `X#` ID and classify it. These are the findings most often lost, because a linter reporting "clean" reads like nothing is outstanding.

### Step 3 — Apply content-type guidelines

Read the relevant guide(s) from `.claude/content/`:
- **Blog posts**: `.claude/content/blog-post-guide.md`
- **Study guides**: `.claude/content/study-guide-guide.md`
- **All content**: `.claude/skills/refine-prose/writing-standards.md`

Check compliance and report any format issues, missing front matter fields, or type-specific requirements not met.

**Blog posts — links.** Search the body (below front matter, outside code blocks) for `\]\(`, `href=`, and `https?://`. Every hit is a failure: all URLs, external or internal, belong in the `sources` front matter, per the blog post guide. Fix each one in place: remove the link, reword so the prose names the source specifically enough to find by search, and add its `title`/`url` to `sources` in order of first mention. Then confirm every `sources` entry is named somewhere in the body. Report what moved.

**Blog posts — no self-citation.** Search `sources` for site-relative URLs (`url: "/`) and `lucentowl.com`, and the body for "Lucent Owl", "the site's", and "this site". Every hit is a failure, because a post that cites its own site vouches for itself. Fix each one: replace the citation with the external source the claim rests on (often the source the cited guide relies on), or keep the point as the post's own reasoning with no citation. Remove the site URL from `sources`.

### Step 4 — The outline test

Extract the complete header tree (all H2 and H3 headings, in order). Write them out as an indented outline.

Then answer: reading only these headers, does a skimming reader understand the post's structure and major claims? Do the headers tell the complete argument, or do they leave the shape of the thinking invisible?

If the header tree does not tell the story, the structure needs work before the prose does. This is often the highest-leverage fix available.

### Step 5 — Thesis clarity

State the post's thesis in exactly one sentence — what it argues, not what it covers. Use your own words.

If you cannot write that sentence clearly, the post has a thesis problem. A post that is "about" a topic is not the same as a post that *argues* something about that topic.

Then assess: does every major section advance or support that thesis, or do any sections drift, digress, or exist only as context-padding?

### Step 6 — Clarity from complexity review

For each major section, assess whether it actually delivers clarity:
- Is the argument in this section stated directly and specifically, or gestured at?
- Could a reader reconstruct the section's point from the prose alone, or does it require the reader to already know the answer?
- Are examples specific — real numbers, real consequences, real tradeoffs — or illustrative-but-hollow?
- Is any complexity in this section resolved, or just acknowledged and left standing?

Flag specific paragraphs or sentences that have clarity problems. Quote the passage and explain the issue.

### Step 7 — Scholarly quality review

This is the highest bar. Assess the following qualities that separate substantive from performative writing:

**Precision**: Are claims specific and falsifiable, or hedged into meaninglessness? ("Systems often struggle with X" tells the reader nothing. "Stateless systems under write-heavy load will see cache invalidation become the primary latency driver" tells them something they can test.)

**Distinct contribution**: What does this post say that has not been said a thousand times? What is the specific angle, observation, or reframing that only this author could offer, or that this author has articulated more clearly than it has been before? If the answer is "nothing," the post is not ready to publish.

**Intellectual honesty**: Does the post acknowledge where its argument has limits — where the principle breaks down, where context changes the answer, where the author is uncertain? Posts that present partial truths as complete ones erode trust.

**Grounding**: Are claims about how systems or organizations behave explained by *mechanism* — not just asserted? "Distributed systems increase coordination cost" is assertion. "Every cross-service call adds a network hop, and every network hop is a potential timeout or retry cascade" is grounded.

**No fabricated experiences**: Confirm that no "I've seen...", "I've watched...", "I've observed..." claims appear unless they were explicitly provided by the author. Flag any that exist.

**Sources for statistics**: Any market data, survey results, or industry statistics must cite a source. Flag any unsourced data claims.

**Derivation**: Run `.claude/content/derivation-check.md` over the draft. Borrowed content (a coined term, technique, or rule) must be credited in prose at the specific point and listed in `sources`. Borrowed form (a counted taxonomy, scoring scheme, structure, or signature example set) must be restructured in the author's own reasoning, because a credit doesn't fix form. A hit is a FIX, and a source you can't confirm by search is an ASK.

### Step 8 — Length and scope discipline

Assess:
- Does the introduction take too long to reach the argument? (More than 2-3 paragraphs before the thesis is visible is usually too long.)
- Does the conclusion restate what the body already established, or does it land something the body built toward?
- Are there any sections that repeat what an earlier section already resolved?
- Is there filler — transitions, connective tissue, or section openings that exist to bridge structure rather than to say something?
- Is there anything missing that the thesis implies but the body does not deliver?

**Reading-time budget (blog posts).** A blog post should read in about 14 minutes or less. The author should never have to ask for this. `_layouts/post.html` shows `floor(rendered words / 200)` minutes, so 14 minutes means fewer than 3,000 words once markup is stripped. Measure it with:

```bash
python -c "import re,sys; s=open(sys.argv[1],encoding='utf-8').read(); b=s[s.index('\n---\n',4)+5:]; n=len([t for t in b.split() if not re.fullmatch(r'#+|-+|\|[-| ]*|\||\`\`\`\w*|\*\*',t)]); print(n,'words,',n//200,'min')" <file>
```

A post over budget is an `L#` finding, and it's a FIX. Bring it under budget in Step 11 with the focusing methods below. Adding material in the resolution pass doesn't exempt the post. Pay for every addition with a cut somewhere else. Other content types have no fixed budget, because case studies and guides can run longer, but the focusing methods apply to them all the same.

**Focusing methods.** Use these in order. The first ones remove repetition, and the last ones reduce substance:

1. **Say each point once, in its home section.** When a later section restates an earlier section's case (a conclusion re-arguing a gap, an intro previewing every loss the body lists), keep the full version where it's argued and shrink the other to a clause that points back to it.
2. **Merge paragraphs that make the same move.** Two paragraphs that each end at the same conclusion become one.
3. **Drop restating closers and lead-ins**, such as a sentence that repeats what the example just showed or a paragraph opener that rephrases the heading.
4. **Compress the conclusion to what the body hasn't already said.** The answers or recommendations carry new material, and the diagnosis is already on the page.
5. **Trim secondary evidence last.** Keep at least one source per claim, and cut a second quote or a supporting detail only after steps 1-4 have run out.

Never cut the post's examples, its sources for claims it still makes, or any section the header tree depends on just to hit a number. If the post can't fit the budget without losing its argument, the scope is too broad. Raise that as an ASK that proposes how to split or narrow the post, and don't thin every section evenly.

### Step 9 — Practical artifact check

A publishable post should leave the reader with something concrete they can apply — not just an argument they found interesting. This could be a decision framework ("use X when A, B, C; use Y when D, E, F"), a before/after diagram, a named principle stated as a testable rule, a checklist, or an annotated example with real consequences.

Assess:
- Does the post contain a practical artifact — something a reader could screenshot, quote, or directly apply?
- If yes, is it clearly presented, or buried in the body prose where it's easy to miss?
- If no, identify what artifact would best fit the post's thesis and suggest it. Be specific: name the format and describe the content it should contain.

Do not edit the file during this step; resolution happens in Step 11. A missing or buried artifact is an ASK, because adding one changes the post's structure and length. Propose it specifically in the ledger: the format, what it would contain from this post, and where it would go. Don't build it.

### Step 10 — Search-discoverable title

The current title is written for a reader who already trusts the author. A search-optimized title serves a reader encountering the post cold via a query.

Generate 2–3 alternative title options that:
- Use phrasing a developer would actually type into a search engine
- Include the key technical terms central to the post's thesis
- Remain specific and honest — not keyword-stuffed, not clickbait
- Could replace the current `title:` field in front matter without changing the file name

**Important**: Changing the title field in front matter is safe and encouraged. Renaming the file is never done — it breaks existing links. State both the current title and the alternatives clearly in the report.

Raise the title as `T1`. If the current title is inaccurate, clickbait, over-indexed on a minor section, or contradicts the thesis, that is a correctness problem rather than taste: change the `title:` field in Step 11 and record the call. If the current title is accurate and the alternatives only differ in reach, leave it and list the options in the report, since there is nothing to correct.

### Step 11 — Resolution pass

Work the ledger, not your memory. Take every finding from Steps 2-10 in ID order and discharge it according to its class. Do not ask for approval on individual edits.

**FIX findings** — edit the file directly, touching only the defect.

When the post is over budget, or a finding is a stated restatement, these are the cuts to reach for:
- **Restatements**: a sentence that repeats what the previous sentence already said in different words
- **Announcement sentences**: sentences whose only function is to introduce what follows ("Here is what X does:", "The following section covers...")
- **Redundant closers**: a sentence at the end of a paragraph that summarizes what was just established in that same paragraph
- **Padded section openers**: opening sentences that only rephrase the section heading without adding content
- **Implied conclusions**: "This is why X matters" when the preceding content already showed it

Do not cut:
- Transitions that carry structural argument (they move the reasoning forward, not just the reader)
- Sentences that introduce a concept before defining it (setup that earns its place)
- Closing sentences that land something the paragraph built toward rather than restate it

Cutting an unsupported assertion and leaving a hole makes the post worse, not better, so when a cut removes load-bearing content, write the replacement into the same edit.

Where a finding turns on a decision the author should make, it is an ASK. State it in the ledger and keep working through the rest. Don't stop and wait.

**ASK findings** — leave the text as it stands and state the question in the ledger. Do not invent the answer, and do not apply a placeholder. If the post needs a number only the author has, or a first-person experience claim the site's rules forbid you from fabricating, that gap is theirs to fill and the surrounding prose stays untouched until they do.

**Merging is encouraged.** When several findings share one fix, discharge them together and say so in the ledger (`C3, S2 resolved by O1's header rewrite`). What is never allowed is silence.

**Withdrawing is allowed.** If a finding does not survive closer reading, mark it Withdrawn with the reason. An honest withdrawal is a resolution. Letting it disappear is not.

After the pass, re-measure reading time for a blog post. If it's still over the 14-minute budget, keep working through the Step 8 focusing methods before writing the ledger. Report how many sentences were removed or merged, the before/after word count, and for a blog post the before/after reading time. Word count is not the measure of success: replacing a hollow sentence with a grounded one is a win even when the count rises, so say which movements were cuts and which were substitutions.

### Step 12 — Disposition ledger

Close the review by accounting for every finding. Build the ledger table for the report, then run this check before writing the verdict:

1. Count every ID raised across Steps 2-10.
2. Count every ID appearing in the ledger.
3. If the numbers differ, you dropped a finding. Go back and find it.

State both counts in the report. A review that cannot state them is not finished.

Every row ends in one of four states, and no others:

| State | Meaning |
| --- | --- |
| **Fixed** | Edited into the file during Step 11 |
| **Decided** | Fixed, where the fix to a stated defect rested on a judgment call; the ledger names the call and the rejected alternative |
| **Asked** | Text left untouched because applying it would mean inventing a fact; the question is stated |
| **Withdrawn** | Reconsidered and dropped, with the reason given |

"Noted", "flagged", "mentioned", "worth considering", "left as-is", and "drafted for your review" are not states. Three of the four states above mean the file changed. A review with few findings is a good outcome when the post has few defects. Don't pad the ledger with taste.

---

## Review Report Format

Deliver the report in this exact structure:

---

**LINTER RESULTS**
[Summary from Step 2's `/refine-prose` run: final lint status and what the loop fixed. Then list every judgment-call issue left standing as a numbered `X#` finding with its class. If the loop found nothing and the self-review found nothing, say so explicitly.]

**CONTENT TYPE COMPLIANCE**
[Numbered `F#` findings: format issues, missing front matter, type-specific requirement failures. Each item carries its ID and class. If fully compliant, say so.]

**THESIS**
[Your one-sentence restatement of what the post argues. Then any `H#` findings: thesis problems, or sections that drift from it.]

**OUTLINE TEST**
```
[H2 and H3 header tree, indented]
```
Pass / Fail — [1-2 sentences explaining why. On a fail, raise it as `O1` with the defect stated. Rewording a header so it states its section's claim is a FIX. Reordering or restructuring sections is an ASK, so show the proposed tree beside the current one in the report and leave the file's structure alone.]

**CLARITY ISSUES**
[Numbered list. Each item: ID, class, section name, quoted passage or description of the problem, and what is unclear and why. If none, say "None found."]

**SCHOLARLY QUALITY ISSUES**
[Numbered list. Each item: ID, class, which quality (Precision / Distinct Contribution / Intellectual Honesty / Grounding / Fabricated Experience / Unsourced Claim / Derivation), the specific instance, and what would fix it. If none, say "None found."]

**LENGTH AND SCOPE**
[Assessment, plus numbered `L#` findings for any padding, underdevelopment, repetition, or missing material.]

**PRACTICAL ARTIFACT**
Present / Buried / Missing — [`A#` finding with its class. If present and well-positioned, say so and raise nothing. Otherwise the artifact itself gets built in Step 11, not described here.]

**SEARCH-DISCOVERABLE TITLE**
Current: [existing title]
`T1` [class]
Alternatives:
1. [option 1]
2. [option 2]
3. [option 3]
Recommendation: [which one, and why, or why the current title stands]

**RESOLUTION PASS**
[What changed in the file, by ID, in enough detail that the author knows where to look in the diff. Sentences removed or merged, sections added or cut, cuts versus substitutions, approximate before/after word count.

For each Decided finding, one line on the call you made and the alternative you rejected, so the author can reverse it on purpose.

Do not reproduce the new text here. It is in the file, which is where they can actually read it.]

**FINDINGS LEDGER**
Raised: N · Dispositioned: N

| ID | Finding | Class | State | Resolution |
| --- | --- | --- | --- | --- |
| `O1` | Headers name topics, not claims | FIX | Fixed | Tree rewritten |
| `C2` | Cherry-picked examples don't support the claim | ASK | Asked | Proposed cutting the section or sourcing the claim |
| `S1` | No acknowledgment of limits | FIX | Fixed | Limits section added |
| `X1` | Intro needs first-person the author must own | ASK | Asked | Left as-is; experience claim is theirs to make |

Every ID raised anywhere above appears here exactly once. The two counts must match.

**VERDICT**
Ready to publish / Needs revision / Major revision needed

[Reconcile against the ledger. Name, by ID, every Decided finding the author should review because you made the call for them, and every Asked finding still open. State plainly what blocks publication and what does not. A thesis problem or a scholarly quality problem is not cosmetic, so say so in those words.

Do not compress this into a tidy summary of "the most important things" — the ledger decides what appears here, not your sense of what is worth repeating. If eleven findings are outstanding, the verdict accounts for eleven.]

Review these decisions: [IDs of Decided findings, or "none"]
Still open: [IDs of Asked findings, or "none"]

---

## Autonomous resolution (both modes)

`iterate` and `convince-me` exist to refine the post faster and more objectively than the author can, so they never wait for the author. The author supplies the ideas, the agents refine them, and the author reviews the result later with `git diff`. Under either keyword, these rules replace the ASK rules above, for the orchestrator and for every subagent it dispatches:

- **There is no ASK class.** A finding the single review would classify ASK is resolved as **Decided**: make the call, apply it to the file, and record the call and the rejected alternative in the ledger so the author can reverse it on purpose.
- **Strategic calls are applied.** Reordering sections, adding a table or artifact, cutting or merging a section, reconciling a contradiction, and changing emphasis are all built, not proposed.
- **Never invent.** No fabricated first-person experience, no number only the author could know, no unverifiable claim. When a fix would need one, resolve it without it: narrow the claim, ground it in a source you verified, argue it from the post's own reasoning, or cut it. The author's existing first-person text stays.
- **Refine the author's idea, never replace it.** The thesis and the author's held positions stay. Strengthen them, narrow them where they overreach, and reconcile them with the post's own evidence, but don't swap in a reviewer's or skeptic's view.
- **The budget still holds.** Pay for every addition with a cut, per Step 8.

The ledger's **Asked** state is unused in these modes. The verdict's "Review these decisions" line carries every Decided finding, and "Still open" is "none" unless a stop condition below left something unresolved.

## Mode: `iterate`

Each round of `iterate` is a complete review (Steps 1-12, resolution pass included) run by a **fresh subagent** that has never seen the post. A reviewer who just edited a file reads its own fixes as correct, and a new reader doesn't. You are the orchestrator. You don't review the post yourself in this mode. You dispatch the rounds, read each ledger, and decide whether to run another.

**Each round:**

1. Launch a `general-purpose` agent with `run_in_background: false`. Its prompt gives it the file path and tells it to read `.claude/commands/review-publishable.md` and run Steps 1-12 on that file in full under the **Autonomous resolution** rules, editing the file in Step 11, and to return its complete report, including the findings ledger. Do not pass it any earlier round's report. Do pass the **settled list** (below), with the instruction that a settled item is re-raised only if the reviewer can state a new defect the earlier decision didn't consider.
2. Read the returned ledger, then `git diff` the file to confirm the edits it claims are actually there. If a reviewer left a finding Asked anyway, resolve it yourself under the autonomous rules before the next round.
3. Add every Decided finding to the settled list as one line each: the round, the ID, the passage, and the call made.
4. Decide whether to run another round.

**A round needs updates** when it raises at least one new finding that ends **Fixed** or **Decided**. Mechanical fixes count. Withdrawn findings don't, and neither do settled items a reviewer re-raises without a new defect.

**Reversals**: when a round undoes or reverses an edit an earlier round made, you decide which version stands, keep it in the file, and record the call as Decided with both reviewers' reasons. Don't run another round just to break the tie.

**Stop** when:

- A round needs no updates. That's the normal exit: a fresh reader found nothing left to change.
- Three rounds have run. Say so in the verdict, because a post still needing updates after three fresh reviews is a sign the scope or thesis is unsettled.

**Report**: a round table (round number, updates needed yes/no, IDs fixed, IDs decided), the final round's full report, and a combined ledger of every finding from every round, each with its round prefixed (`R2-S1`). The raised and dispositioned counts cover all rounds. The verdict lists every Decided finding across all rounds.

## Mode: `convince-me`

`convince-me` tests whether the argument persuades a skeptical reader who has only the page. The review steps make a post correct and clear. They don't establish that it convinces anyone. Run it after the review (or after `iterate` when both are given). You are the orchestrator. Skeptics read and judge, and only you edit.

**Each round:**

1. Launch a fresh `general-purpose` agent with `run_in_background: false`. It never sees earlier skeptics' verdicts, earlier drafts, or your reasoning. A skeptic told what the last one objected to reads for that instead of reading the post. Give it this brief, with the file path filled in:

   > You are a senior practitioner who knows this subject well and has no stake in the author's conclusion. Read `<file>`. Read only that file, and treat it as the whole case: you may web-search to check whether a cited claim is true, but not to strengthen the author's argument for them. Then decide whether the post convinced you of its thesis.
   >
   > Return:
   > - **Thesis**: the post's argument in one sentence, in your own words
   > - **Convinced**: yes, partly, or no
   > - **What convinced you**: each part that worked, and why
   > - **What didn't**: each objection, numbered. For each, quote the passage, give the type (missing evidence, unanswered counterargument, logical gap, overreach, unclear claim, or a factual error you verified), say why it fails to persuade you, and say what would change your mind
   >
   > Be specific. "Needs more evidence" is not an objection. Name the claim and the evidence that would carry it. Don't object to the author's voice or style, and don't tell the author to argue a different thesis.

2. If the skeptic's thesis sentence differs from the post's thesis, record that as an objection on its own. The post didn't communicate its argument, whatever else the skeptic thought.
3. Give each objection an ID (`V1`, `V2`, continuing across rounds) and triage it under the same rules as Steps 2-10 and the **Autonomous resolution** rules: a statable defect, the smallest edit that fixes it, and Fixed, Decided, or Withdrawn.
   - **Fixed**: an overreach to narrow, a gap between steps that the post's own material can close, an unclear claim, a verifiable source the claim needs, or a counterargument the post can answer from its own reasoning.
   - **Decided**: the fix needs a judgment call, such as restructuring, reconciling a contradiction, or conceding a limit. When it would need the author's experience or a number only they have, resolve it without inventing one: narrow the claim, source it, or cut it. The author's held position is never conceded to a skeptic. Strengthen the case for it or narrow it where it overreaches, but don't swap in the skeptic's view.
   - **Withdrawn**: the objection is to voice or style, rests on a misreading the text doesn't invite, or asks for a different post.
4. Apply every Fixed and Decided objection to the file, keeping the reading-time budget (pay for additions with cuts, per Step 8). Re-run the Step 2 mechanical checks on the changed passages.
5. Start the next round with a new skeptic.

**A returning objection**: when an objection a fix was supposed to resolve comes back in substance from a new skeptic, the fix didn't work. Try a different fix (a stronger source, a narrower claim, or a cut) and record both skeptics' reasons in the ledger.

**Stop** when:

- A skeptic answers **yes**. That's the only success exit.
- Every objection in a round is Withdrawn.
- Five rounds have run without a yes.

**Report**: after the review report, a **CONVINCE-ME** section with one row per round (round number, verdict, the skeptic's thesis sentence, objection IDs, and what you changed), then every `V#` finding in the findings ledger alongside the review's own. The verdict states whether a skeptic was convinced. A post that never convinced one isn't ready to publish, so name the objections the last skeptic still held and what was tried against each.
