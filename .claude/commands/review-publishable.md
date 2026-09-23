# review-publishable

Review publishable content against the site's highest quality standards before it goes live. Accepts an optional file path as argument.

**Usage**: `/review-publishable _posts/YYYY-MM-DD-title.md`

**File resolution**: Use the file path argument if one is given. Otherwise use the file currently open in the IDE (`ide_opened_file` context) — this is the common case and should not require confirmation. Only ask the user which file to review if neither signal is present (no argument and no `ide_opened_file` context at all).

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

**Classify every finding as you raise it.** There are two classes, and the first one is the default:

- **FIX** — you can write a version you would defend, so you write it **into the file** in Step 11. This covers everything: cuts, rewrites, new sections, new tables, restructured headers, a changed title, a rebuilt front matter field. Scope of the change is not a reason to downgrade. Deleting a whole section is a FIX if the evidence does not support it.
- **ASK** — applying it would require inventing something you do not have: a personal experience, a number only the author knows, a claim you cannot verify from a source. Leave that text as it stands and put the question in the ledger.

**ASK is the rare case, not the safe one.** Strategic calls about scope, structure, and emphasis are FIX. Make the call you would defend, apply it, and say plainly in the ledger what you decided and why, so the author can overrule you by looking at the result rather than by imagining it.

**Never hand the author text to paste.** A replacement paragraph sitting in the chat report is not a resolution. The author cannot evaluate a paragraph without the paragraphs around it, cannot see how a new section changes the post's balance, and cannot read a header tree in isolation. Work that the author has to reassemble by hand has been moved, not done.

The file is the deliverable. The chat report is the account of what you did to it. When the content lives in a git repository, the author reviews with `git diff` and reverts anything they dislike, so applying a change you can defend is always cheaper for them than describing one they have to build.

### Step 1 — Read and identify

Resolve the target file: use `$ARGUMENTS` if provided; otherwise use the file currently open in the IDE (from `ide_opened_file` context); otherwise ask the user. Read the resolved file. Identify:
- Content type (blog post in `_posts/`, study guide in `_guides/`, other)
- Title, date, and description from front matter
- Approximate word count and structure (number of H2/H3 sections)

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

### Step 8 — Length and scope discipline

Assess:
- Does the introduction take too long to reach the argument? (More than 2-3 paragraphs before the thesis is visible is usually too long.)
- Does the conclusion restate what the body already established, or does it land something the body built toward?
- Are there any sections that repeat what an earlier section already resolved?
- Is there filler — transitions, connective tissue, or section openings that exist to bridge structure rather than to say something?
- Is there anything missing that the thesis implies but the body does not deliver?

### Step 9 — Practical artifact check

A publishable post should leave the reader with something concrete they can apply — not just an argument they found interesting. This could be a decision framework ("use X when A, B, C; use Y when D, E, F"), a before/after diagram, a named principle stated as a testable rule, a checklist, or an annotated example with real consequences.

Assess:
- Does the post contain a practical artifact — something a reader could screenshot, quote, or directly apply?
- If yes, is it clearly presented, or buried in the body prose where it's easy to miss?
- If no, identify what artifact would best fit the post's thesis and suggest it. Be specific: name the format and describe the content it should contain.

Do not edit the file during this step; resolution happens in Step 11. But a missing artifact is a FIX, never a bare flag. In Step 11 you build the actual table, checklist, or framework, populated with this post's real content, and you place it in the file. An artifact that is present but buried is also a FIX, whether it needs reformatting into a table or rebuilding from scratch.

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

**FIX findings** — edit the file directly. This is nearly all of them. The prose reduction sweep below is one category of this work, not the whole of it.

Cut on sight:
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

Where a finding turns on a decision you would rather the author made, make it anyway, apply it, and record the decision and your reasoning in the ledger. Give the alternative you rejected in one line so they can reverse you deliberately. What you must not do is stop and wait: a review that ends with open questions and an unchanged file has produced nothing the author can read.

**ASK findings** — leave the text as it stands and state the question in the ledger. Do not invent the answer, and do not apply a placeholder. If the post needs a number only the author has, or a first-person experience claim the site's rules forbid you from fabricating, that gap is theirs to fill and the surrounding prose stays untouched until they do.

**Merging is encouraged.** When several findings share one fix, discharge them together and say so in the ledger (`C3, S2 resolved by O1's header rewrite`). What is never allowed is silence.

**Withdrawing is allowed.** If a finding does not survive closer reading, mark it Withdrawn with the reason. An honest withdrawal is a resolution. Letting it disappear is not.

After the pass, report how many sentences were removed or merged and the approximate before/after word count. Word count is not the measure of success: replacing a hollow sentence with a grounded one is a win even when the count rises, so say which movements were cuts and which were substitutions.

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
| **Decided** | Fixed, where the fix rested on a judgment call; the ledger names the call and the rejected alternative |
| **Asked** | Text left untouched because applying it would mean inventing a fact; the question is stated |
| **Withdrawn** | Reconsidered and dropped, with the reason given |

"Noted", "flagged", "mentioned", "worth considering", "left as-is", and "drafted for your review" are not states. Three of the four states above mean the file changed. If most of a review's findings end in Asked, the review was too timid, not the post too ambiguous.

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
Pass / Fail — [1-2 sentences explaining why. On a fail, raise it as `O1`: a header tree you can rewrite is one you must rewrite into the file in Step 11. Show the old and new trees in the report so the change is legible at a glance.]

**CLARITY ISSUES**
[Numbered list. Each item: ID, class, section name, quoted passage or description of the problem, and what is unclear and why. If none, say "None found."]

**SCHOLARLY QUALITY ISSUES**
[Numbered list. Each item: ID, class, which quality (Precision / Distinct Contribution / Intellectual Honesty / Grounding / Fabricated Experience / Unsourced Claim), the specific instance, and what would fix it. If none, say "None found."]

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
| `C2` | Cherry-picked examples don't support the claim | FIX | Decided | Section cut; kept alternative was sourcing it |
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
