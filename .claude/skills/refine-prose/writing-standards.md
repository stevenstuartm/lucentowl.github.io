# Writing Standards

These standards apply to ALL narrative content: blog posts, page content, descriptions, and social media summaries. Content-type-specific rules live in the per-type guides; the rules here are universal.

---

## Mechanical Checks

These are exact-match violations: fixed strings and literal characters, not judgment calls. Run each pattern below against the target file's text (case-insensitive, skip frontmatter and code blocks), using the Grep tool where available (Claude Code), `grep -inE` via a bash/terminal tool, or a direct regex scan of the file's text otherwise. Treat every hit as an Error — fix it against the guidance here, not a mechanical find/replace, then re-run the pattern. Loop until each one returns no matches.

The ripgrep engine that backs Claude Code's Grep tool does not support lookahead/lookbehind — it silently returns zero matches on a pattern that uses `(?!...)` or `(?=...)` instead of erroring, which would produce false negatives. None of the patterns below use them; where the Python version of this linter once used a lookahead to carve out an exception, that exception is now a written note instead (see "the insight" below). If you're running these patterns with a regex engine that does support lookahead (e.g. Python's `re`, or grep -P), that's fine too — the patterns below work either way.

**AI-tell phrases**:
```
\b(the key insight|the insight|the takeaway|it'?s (important to note|worth noting)|it should be noted|in conclusion|in summary|final version|final conclusion|ultimately|essentially|fundamentally|at the end of the day|the bottom line is|something (real|genuine|tangible|meaningful)|the question isn'?t|the question is|worth \w+ing|is reasonable|distinction matters|failure modes?)\b
```
Each of these announces or hedges instead of stating the point directly:
- "the key insight" / "the insight" / "the takeaway" → state the point, drop the label. Exception: skip a hit where "the insight" is immediately followed by "into" (e.g. "the insight into the problem") — that's legitimate usage, not the AI-tell phrase.
- "it's important to note" / "it's worth noting" / "it should be noted" → state the point directly, no meta-commentary
- "in conclusion" / "in summary" / "final version" / "final conclusion" → cut; the section boundary already signals this
- "ultimately" / "essentially" / "fundamentally" (as filler, not as precise qualifiers) → cut
- "at the end of the day" / "the bottom line is" → cut, state the point
- "something real/genuine/tangible/meaningful" (e.g., "owns something real") → state what the thing actually is
- "the question isn't" / "the question is" → rhetorical framing that avoids a direct statement; make the statement
- "worth [gerund]" (e.g., "worth examining", "worth naming") → usually meta-commentary telling the reader what to pay attention to; state the point directly instead
- "is reasonable" → vague; state specifically what makes it acceptable or why it works
- "distinction matters" → announces importance without stating it; state the distinction and its consequence directly
- "failure mode(s)" → describe the specific failure instead

**"Real" as filler** (two separate patterns — the adjective form and the noun-modifier form):
```
\b(is|are|was|were)\s+real([^-\w]|$)
```
```
\b\w+\s+real\s+(work|value|output|results?|impact|progress|problems?|issues?|cost|benefit|change|difference|data|code|tests?|features?|improvements?|gains?|savings?|performance|quality|effort|time|speed|scale)\b
```
"X is/are real" (e.g., "the costs are real") and "[verb] real [noun]" (e.g., "does real work") are both vague qualifiers — describe specifically what you mean instead. The first pattern's trailing `([^-\w]|$)` excludes compounds like "real-time" or "real-world" (no lookahead needed — it just requires the character after "real", if any, to not continue the word or start a hyphenated compound).

**AI-tell colon constructions**:
```
(What's converging|A critical distinction|The difference|The key|The point|Here's why):
```
These announce importance rather than stating it directly.

**Em-dashes in sentences**:
```
—
```
Avoid em-dashes in prose; use semicolons, commas, or periods instead. Parentheses are acceptable for clarifying asides.

**Fixing a hit** — restate the point directly, don't just delete the flagged phrase:
```
❌ The key insight: this pattern applies at any scale
✅ This pattern applies at any scale

❌ It's important to note that alignment comes first
✅ Alignment comes first

❌ This framework is fundamentally about how we value
✅ This framework is about how we value

❌ What's converging -
✅ Several trends are converging...

❌ A critical distinction:
✅ State the distinction directly (e.g., "X behaves differently from Y because...")
```

---

## Writing Principles Requiring Judgment

These cannot be automated. Apply them thoughtfully during drafting and self-review.

### Epistemic Accuracy

Avoid absolute claims when the reality is softer. Absolutes ("always", "never", "no one", "every") are easy to dismiss and often inaccurate.

- ❌ "When this happens, no one traces it back to the root cause." → ✅ "People tend not to trace it back to the root cause."
- ❌ "Which only becomes clear under change pressure." → ✅ "Which might only become clear under change pressure."
- ❌ "I always ask the same question." → ✅ "I endeavour to ask the same question."

Prefer "tend to", "might", "can", "often", "rarely" over absolute constructions. The hedged version is almost always both more accurate and harder to refute.

---

### Clarity and Brevity

- Cut unnecessary words that obscure the point
- Use bullet points strategically for structural advantages, not as a crutch
- Break long sections into digestible subsections with clear headers
- Ensure section titles accurately reflect their content
- If a point can be made in fewer words, do so
- Watch for missing articles ("a", "the"), especially around nominalized verbs: ❌ "masquerading as process" → ✅ "masquerading as a process"; ❌ "made expected failures high-frequency" → ✅ "made expected failures more frequent". Not mechanically checkable — there's no reliable literal pattern for a missing article, so this is a self-review item, not a grep target.

**CRITICAL: Never fabricate personal experiences**:
- Do not write "I've watched...", "I've seen...", "I've observed..." unless the user explicitly provided those experiences
- Use hypothetical framing: "Teams might...", "Developers can...", "Consider a scenario where..."
- Keep examples generic and illustrative unless the user provides specific details
- Ask the user if concrete examples would strengthen the content rather than inventing them
- Fabricated experiences undermine authenticity and credibility — this is a critical error that must never happen

**Data and claims require sources**:
- Any market statistics, survey results, or industry data MUST include the source
- Format: "62% of users (Source: Company Name Report 2024)"
- Data without sources damages credibility
- Link to sources when possible using markdown link syntax with appropriate target attributes

**Historical claims require verification**:
- When making claims about "original visions," "promises," or historical context, verify with research
- Don't assume what systems "were supposed to do" without evidence
- Use web search to verify historical context before making sweeping statements
- Stronger arguments cite specific sources rather than paraphrasing

### Sentence Flow and Punctuation

**Semicolons are for parallel contrast; comma+and is for sequential cause.** Using a semicolon where "and" belongs creates a false equivalence:
- ❌ "The lag is measured in years; by the time the drift is painful, the decision is untraceable." (the second clause is a consequence, not a parallel)
- ✅ "The lag is measured in years, and by the time the drift is painful, the decision is untraceable."
- ✅ "Reads are fast; writes are slow." (genuine parallel contrast — semicolon is correct)

**Use semicolons and commas for natural flow**:
- ❌ "Something is broken in production. You need to fix it." (choppy)
- ✅ "Something is broken in production, and you need to fix it." (natural)
- ❌ "Most troubleshooting failures aren't from lack of effort. Engineers work hard during incidents."
- ✅ "Most troubleshooting failures aren't from lack of effort; engineers work hard during incidents."

**Avoid run-on sentences that force buffering**:
- Don't chain too many thoughts together; the reader shouldn't need to hold an entire sentence in memory to understand the conclusion
- ❌ "With reproduction, you have a test case that consistently triggers the race condition; after your fix, the test passes, and you know it works before it touches production."
- ✅ "With reproduction, you have a test case that consistently triggers the race condition. After your fix, the test passes. You know it works before it touches production."
- ❌ "If the answer is 'exception in cleanup code path,' the fix isn't just patching that one path; it's recognizing that error-handling code paths lack test coverage across the system."
- ✅ "If the answer is 'exception in cleanup code path,' the fix isn't just patching that one path. It's recognizing that error-handling code paths lack test coverage across the system."

**Guidelines**:
- Use commas/semicolons to connect two related thoughts
- Use periods when adding a third thought or when the combined sentence becomes too long
- Write as you think: natural internal narrative, not telegraphic fragments
- Each sentence should carry one clear idea or two closely related ideas, not three or more

### Section Structure and Header Hierarchy

Each H2 section should cover one distinct topic, argument, or concept. When a section contains multiple distinct points, use H3 headers to name each one explicitly.

**The outline test**: The full set of H2 and H3 headers should read as a complete outline of the post's argument. A reader skimming only headers should understand the structure and major claims without reading the body. If the headers don't tell the story, the structure needs work before the prose does.

**When to add H3s**:
- ✅ When an H2 section makes two or more distinct arguments or sub-claims
- ✅ When different parts of a section address different aspects of the same topic
- ✅ When a section runs long because it contains multiple ideas that each deserve treatment
- ❌ Not every paragraph needs an H3 — only when the content beneath is a genuinely distinct, nameable point

**Header quality**:
- H3s should name the specific point, not just the general area
  - ❌ "Ceremony" → ✅ "Ceremony Fuels Continuation Bias"
  - ❌ "Limitations" → ✅ "The Representation Problem"
- If you cannot write a clear, specific H3, that signals the point is not well-defined yet
- Headers should enable informed skipping — readers jump to relevant sections, and good headers make that possible

**Never use clickbait/listicle header or title phrasing**:
- ❌ "...Nobody Talks About", "...Nobody Tells You", "What They Don't Want You to Know", "The Truth About...", "...You Need to Know", "...That Will Change How You..."
- These phrases are tabloid framing, not analysis, and they undermine the credibility of a technical post
- State the actual claim instead: ❌ "The Security Problem Nobody Talks About" → ✅ "The Asymmetric Security Posture of Layered Systems"

**Warning sign**: A long H2 section without H3s is almost always hiding multiple distinct points in undifferentiated prose. When reviewing a draft, long unmarked sections are the first place to look for structural problems.

A well-applied outline looks like this: an H2 called "The Timebox Problem" containing three H3s — "The Calendar Fills Itself," "Different Teams, Forced Cadence," "Ceremony Fuels Continuation Bias" — each naming a distinct failure mode, with the H2 naming the category they share. The complete header tree tells the entire argument at a glance. (A `platforms/` doc may point to a real worked example from your project's own content, if one applies.)

---

### Title-Content Alignment

- Section titles should clearly indicate what the section contains
- Avoid generic titles like "The Problem", "The Insight", "The Solution", "The Key"; be specific
- Readers should understand the section's purpose from the title alone

### Natural List Integration

When listing items within flowing prose, use natural connectors like "like," "such as," or "including" rather than colons or em-dashes that create artificial breaks.

❌ **Colon/em-dash constructions** (robotic, compressed):
- "Google introduced authority signals—domain age, backlink profiles, historical traffic patterns—to filter spam"
- "publish on platforms. Medium, LinkedIn, Substack, and dev.to provide distribution"
- "Alternative models—subscriptions, public infrastructure, non-profit foundations—could realign incentives"

✅ **Natural connector constructions** (conversational, flowing):
- "Google introduced authority signals like domain age, backlink profiles, and historical traffic patterns to filter spam"
- "publish on platforms like Medium, LinkedIn, Substack, and dev.to that provide distribution"
- "Alternative models like subscriptions, public infrastructure, or non-profit foundations could realign incentives"

Watch for three patterns during self-review — these are prose-rhythm judgment calls, not exact-match violations, so they aren't part of the Mechanical Checks above:
1. **Em-dash lists**: `signals—X, Y, Z—to filter`
2. **Colon lists**: `models: X, Y, and Z could`
3. **Bare lists**: `platforms. Medium, LinkedIn, and X provide` (list after period without connector)

**When to use each connector**:
- "like" — representative examples
- "such as" — more formal or comprehensive lists
- "including" — partial or non-exhaustive lists

**When colons ARE appropriate**:
- Introducing bulleted lists that stand alone as their own paragraph
- Setting up a formal enumeration ("Three factors matter: first, second, third")
- After complete independent clauses that introduce what follows

### Prose Economy

Every sentence must earn its place. The most common way sentences fail is by restating what the surrounding prose already established.

**Cut re-explanations of what the prose already showed.** If a worked example or prior paragraph demonstrated a point, don't restate it abstractly afterward. The reader saw it.

**Cut abstract restatements after concrete sentences.** A sentence that summarizes the two sentences before it is redundant. If the concrete sentences made the point, the summary adds nothing.

**Trim trailing clauses that over-explain.** When the main clause already implies the consequence, cut the subordinate clause spelling it out.
- ❌ "at every point the architecture evolves: whether a given change preserves the authority structure or quietly weakens it"
- ✅ "at every point the architecture evolves"

**Cut scaffolding sentences.** Setup sentences that exist only to introduce the real point — "Teams debate X; the underlying question is Y" repeated twice — are scaffolding, not argument. Cut the scaffolding and let the point stand on its own.

**Cut section-opening scaffolding.** When a section heading already signals the topic, don't open the section body with sentences that frame what's coming ("X alone isn't enough. Y also matters. Two things measure Z."). Jump straight to the operative claim ("Two things measure Z."). The heading is already doing the framing work.

**Don't re-explain what a table already shows.** After rendering a table, cut any prose that walks through what each cell means. The table communicates those meanings itself. Add prose only for what the table cannot express — implications, caveats, or connections to surrounding argument.

**Connect contrasting ideas with "but" rather than splitting into two sentences.** Two short sentences in close succession often signal a contrast that should be expressed as one:
- ❌ "It doesn't resolve the argument automatically. It changes what the argument is about."
- ✅ "It doesn't resolve the argument automatically, but it changes what the argument is about."

"But" can also open a sentence when pivoting from a prior claim. Prefer this over awkward mid-clause pivots ("..., though, and they all lead back to"):
- ❌ "These come from different traditions. Trace the failures each one prevents, though, and they converge."
- ✅ "These come from different traditions. But if you trace the failures each one prevents, they converge."

**Never open a contrast with a combined summary sentence.** When elaborating two contrasted things (A vs B), do not open with a sentence that packages both sides before elaborating each. The opener is scaffolding — cut it and go directly to the first thing, then the second.
- ❌ "Reactive separation minimizes upfront cost; intentional separation accepts more of it to gain adaptability. Reactive requires no write-path changes, but... Intentional costs more to build, but..."
- ✅ "Reactive requires no write-path changes, but... Intentional costs more to build, but..."

The combined opener restates what the elaboration is about to show. It adds nothing and creates a pattern of merge-then-separate that reads as stalling.

**The test**: After drafting, read each sentence and ask — does this add something the surrounding prose doesn't already say? If not, cut it.

### Avoid Choppy and Generic Content

- **Choppy openings**: Sentence fragments or noun-heavy constructions that lack natural flow
  - ❌ "Lack of architectural decision records creates assumption of incompetence"
  - ✅ "When architectural decision records don't exist, future teams assume incompetence rather than recognizing intentional tradeoffs"
- **Telegraphic parallel structures**: Short sentences with parallel structure that should flow together
  - ❌ "When do we update dependencies? One side says always stay current. The other says only update when forced."
  - ✅ "When should we update dependencies? One side says to always stay current and the other says to only update when forced."
  - Missing conjunctions (and, but, while, yet) create staccato rhythm instead of conversational flow
- **Choppy prose from disconnected sentences**: Related ideas should flow together as a cohesive narrative
  - ❌ "Many teams struggle with interval-based development. Work fragments across multiple sprint cycles. Features sit incomplete when sprint boundaries arrive."
  - ✅ "After many years of the industry refining interval-based methodologies, many teams still struggle to navigate them. The symptoms often present as work fragmenting across sprint cycles and features sitting incomplete when sprint boundaries arrive."
  - **Key principle**: Write as humans read and think. Use connectors (and, while, as, where, but) to show relationships between related ideas.
- **Generic examples**: Vague statements that readers can easily dismiss
  - ❌ "Leadership proposes moving back to on-premises infrastructure... Months later they celebrate success"
  - ✅ Provide specific numbers, timelines, and concrete consequences ($2M → $800K over 18 months, but 99.9% → 95% availability, ops team triples, DR becomes tape-based)
- **Command-style paragraphs**: Lists of imperative sentences without context feel robotic
  - ❌ "State the real problem. Define measurable success criteria. Evaluate the alternatives."
  - ✅ Use bold headers with explanatory follow-ups: "**State the real problem, not the symptom.** The symptom is 'AWS is expensive.' The real problem is..."

### Avoid Lazy Parentheticals

Parentheses should flow with narrative thought, not serve as shortcuts to avoid proper sentence structure.

❌ **Lazy parentheticals** (definition shortcuts):
- "The cure for spam (algorithmic gatekeeping based on authority signals) became worse than the disease"
- "Platform consolidation (network effects creating winner-take-all dynamics) locks out newcomers"
- "Authority signals (domain age, backlinks, traffic history) compound over time"

✅ **Natural integration** (proper sentence structure):
- "The cure for spam became worse than the disease. Algorithmic gatekeeping based on authority signals locked out new entrants more effectively than spam ever did."
- "Platform consolidation locks out newcomers through network effects that create winner-take-all dynamics."
- "Authority signals like domain age, backlinks, and traffic history compound over time."

✅ **Good parentheticals** (narrative flow):
- "Parentheses work when they coincide with narrative flow (the way people think or speak out loud)"
- "The solution requires breaking dependencies (something Google won't do voluntarily)"

If the parenthetical is defining or explaining the term that precedes it, integrate it naturally into the sentence structure instead.

### Providing Specific Examples

Specific details make abstract concepts concrete and credible:
- Actual numbers (costs, percentages, timelines)
- Specific technologies and trade-offs
- Real consequences, not just "it got worse"
- Natural narrative flow, not telegraphic lists

### Formatting and Markdown

- Use tables for comparisons instead of prose when appropriate
- Keep sections focused; if a section is too long, break it up
- Use proper header hierarchy (H1 → H2 → H3)
- Use triple backticks with language specification for code blocks

Some markdown processors have stricter block-level whitespace requirements (e.g., a blank line required before a header or table for it to parse correctly). Check `platforms/` for a doc matching your project's markdown engine.

---

## Voice and Prose Style

### Natural Prose Over Robotic Lists

Content should read like thoughtful essays, not manuals or checklists. Default to smooth narrative prose. Use bullet points strategically for actual structural advantages (comparisons, options, steps), not as a crutch to avoid writing coherent paragraphs.

**When bullet points make sense**:
- ✅ Listing distinct options or alternatives
- ✅ Presenting step-by-step procedures
- ✅ Comparing features or characteristics side-by-side
- ✅ Enumerating red flags or warning signs
- ✅ Call-to-action checklists (diagnostic questions, troubleshooting steps, action items)
- ✅ Conclusion sections with actionable next steps

**When prose works better**:
- ❌ Explaining concepts or reasoning
- ❌ Providing examples (weave them into narrative)
- ❌ Connecting ideas (use transitions, not bullets)
- ❌ Describing how things work

**Test for when to use bullets**: If a sentence contains multiple items separated by commas or semicolons, and those items are things the reader should remember or act on, convert to a bulleted list.

**Smooth transitions**: Sections should flow naturally. Use connecting phrases like "Think about...", "Consider...", "The problem is...", "Here's what happens..." rather than abrupt topic changes.

**Integrate examples naturally**: Instead of **Example:** labels, use "Consider this pattern:" or weave examples directly into the narrative.

**Example transformation**:
```
❌ Robotic/manual style:
**Without reproduction, you cannot:**
- Confirm you understand the problem
- Test whether your fix works

✅ Natural prose style:
Think about what reproduction actually proves. If you can trigger the issue deliberately, you know the conditions that cause it. You understand not just that something broke, but why it breaks.
```

### Blog Post Voice

Blog voice conventions (introduction style, first-person balance across a post) are project-specific rather than universal. Check `platforms/` for a doc matching your project, or define your own if none exists yet.

---

## Content Quality Workflow

1. **Draft**: Write content applying the principles above
2. **Refine**: Run `/refine-prose` on the file — it runs the mechanical checks to a clean state, then self-reviews for narrative flow, concrete examples, section titles, and bullet-vs-prose balance
3. **Manual review**: User reviews for nuanced issues, content accuracy, and overall quality
