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

### Step 1 — Read and identify

Resolve the target file: use `$ARGUMENTS` if provided; otherwise use the file currently open in the IDE (from `ide_opened_file` context); otherwise ask the user. Read the resolved file. Identify:
- Content type (blog post in `_posts/`, study guide in `_guides/`, other)
- Title, date, and description from front matter
- Approximate word count and structure (number of H2/H3 sections)

State these facts before proceeding.

### Step 2 — Run the mechanical linter

Run:
```bash
python lint_content.py "<resolved file path from Step 1>"
```

Report the full output verbatim. Do not fix anything yet. If there are violations, note them as blockers. Style suggestions are informational.

### Step 3 — Apply content-type guidelines

Read the relevant guide(s) from `.claude/content/`:
- **Blog posts**: `.claude/content/blog-post-guide.md`
- **Study guides**: `.claude/content/study-guide-guide.md`
- **All content**: `.claude/content/writing-standards.md`

Check compliance and report any format issues, missing front matter fields, or type-specific requirements not met.

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

Do not add the artifact to the file during this step. Flag its presence or absence in the report.

### Step 10 — Search-discoverable title

The current title is written for a reader who already trusts the author. A search-optimized title serves a reader encountering the post cold via a query.

Generate 2–3 alternative title options that:
- Use phrasing a developer would actually type into a search engine
- Include the key technical terms central to the post's thesis
- Remain specific and honest — not keyword-stuffed, not clickbait
- Could replace the current `title:` field in front matter without changing the file name

**Important**: Changing the title field in front matter is safe and encouraged. Renaming the file is never done — it breaks existing links. State both the current title and the alternatives clearly in the report.

### Step 11 — Prose reduction pass

After delivering the review report, make a direct editing pass on the file. The goal is to cut prose that exists for its own sake rather than to advance the argument. Apply edits to the file without asking for approval on individual cuts.

Target these patterns:
- **Restatements**: a sentence that repeats what the previous sentence already said in different words
- **Announcement sentences**: sentences whose only function is to introduce what follows ("Here is what X does:", "The following section covers...")
- **Redundant closers**: a sentence at the end of a paragraph that summarizes what was just established in that same paragraph
- **Padded section openers**: opening sentences that only rephrase the section heading without adding content
- **Implied conclusions**: "This is why X matters" when the preceding content already showed it

Do not cut:
- Transitions that carry structural argument (they move the reasoning forward, not just the reader)
- Sentences that introduce a concept before defining it (setup that earns its place)
- Closing sentences that land something the paragraph built toward rather than restate it

After the pass, report how many sentences were removed or merged and the approximate before/after word count.

---

## Review Report Format

Deliver the report in this exact structure:

---

**LINTER RESULTS**
[Full verbatim output from Step 2. If clean, say so explicitly.]

**CONTENT TYPE COMPLIANCE**
[Format issues, missing front matter, type-specific requirement failures. If compliant, say so.]

**THESIS**
[Your one-sentence restatement of what the post argues.]

**OUTLINE TEST**
```
[H2 and H3 header tree, indented]
```
Pass / Fail — [1-2 sentences explaining why]

**CLARITY ISSUES**
[Numbered list. Each item: section name, quoted passage or description of the problem, what's unclear and why. If none, say "None found."]

**SCHOLARLY QUALITY ISSUES**
[Numbered list. Each item: which quality (Precision / Distinct Contribution / Intellectual Honesty / Grounding / Fabricated Experience / Unsourced Claim), the specific instance, and what would fix it. If none, say "None found."]

**LENGTH AND SCOPE**
[Assessment: is the post the right length? Any padding, underdevelopment, or missing material?]

**PRACTICAL ARTIFACT**
Present / Missing — [If present: describe it and whether it's well-positioned. If missing: name the format and describe specifically what it should contain.]

**SEARCH-DISCOVERABLE TITLE**
Current: [existing title]
Alternatives:
1. [option 1]
2. [option 2]
3. [option 3]

**VERDICT**
Ready to publish / Needs revision / Major revision needed

[2-4 sentences: the most important things to address before this publishes. Be direct. If the post has a thesis problem or a scholarly quality problem, say so plainly — these are not cosmetic issues.]

**PROSE REDUCTION**
[After the review report is delivered, perform the Step 11 pass and report here: sentences removed or merged, approximate before/after word count.]

---
