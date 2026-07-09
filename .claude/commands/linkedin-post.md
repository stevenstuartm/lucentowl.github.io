# linkedin-post

Convert a blog post into a LinkedIn native post optimized for organic reach. Accepts a file path as argument.

**Usage**: `/linkedin-post _posts/YYYY-MM-DD-title.md`

---

## Philosophy: Value Is the Brand

This is not a marketing post. We are not chasing likes, clicks, or reach for their own sake. We publish because we have something useful to say, and we say the useful part **for free, in the post itself** — no click required to get value from reading it.

The link exists for readers who want the full depth, not as the thing withheld to force a click. If a reader gets real value from the LinkedIn post alone and never visits the site, that is a success, not a missed conversion. Clicks that follow are a byproduct of demonstrated value, not the goal we're optimizing the copy toward.

Practically, this means: **lead with the deliverable, not the setup.** Don't tease an insight and make the reader wait for it — state it. Then argue for it and name its cost. Do not narrate. A story with a beginning, middle, and "years later" reveal is a device borrowed from the source article's long-form format — it doesn't survive the compression to a LinkedIn post, and dragging it over produces a worse, slower version of the article instead of a distinct, sharp artifact. State the claim, state why it's true, state what it costs when ignored. Stop.

---

## Voice

The post should read as a confident, declarative statement that showed up in the reader's feed on its own merits, not as a personal anecdote and not as motivational or upbeat framing. Two reasons, both downstream of "value is the brand":

1. **Credibility with this audience.** Senior engineers and architects trust a claim they can test more than they trust enthusiasm or relatability. Optimistic or hype framing ("excited to share," "game-changer") reads as generic LinkedIn thought-leadership and undercuts the same credibility the payload-first structure is built to earn.
2. **Consistency with the site's own voice rule.** [`writing-standards.md`](.claude/skills/refine-prose/writing-standards.md) prohibits fabricating personal experience — no "I've seen," "I've watched," "I've observed" unless the user explicitly provided that experience. A personal, anecdotal tone on LinkedIn would contradict a rule the long-form content already follows, and the two should not diverge just because the medium changed.

In practice: state claims in third person or as flat assertions about the domain, not through a first-person narrator. Avoid enthusiasm markers, exclamation points, and "I'm thrilled/excited to..." openers. The confidence should come from the claim being correct and testable, not from the tone asserting that it's exciting.

---

## LinkedIn Distribution Context

LinkedIn significantly reduces reach on posts that contain external links in the body. The workaround: publish the post with no link in the body, then immediately post the article URL as the **first comment**. This preserves reach while giving readers a path to the full post.

This command produces copy-paste ready content for both the post body and the first comment.

---

## Format Rules

LinkedIn does not render markdown. The post must be written in plain text with these conventions:

- **No headers** — use a blank line if you need to signal a shift
- **Short paragraphs** — 1–3 sentences maximum, each separated by a blank line
- **No bold, no emphasis formatting of any kind** — LinkedIn's standard post composer has no native rich-text formatting to apply after paste, and the two workarounds people reach for are both off-limits: markdown (`**word**`) just pastes as literal asterisks since LinkedIn doesn't render it, and Unicode "fake bold" character substitution is a platform-gaming trick that's inconsistent with "value is the brand" on principle, carries real risk of the platform down-ranking posts that route around its native formatting, and is unreliable for screen readers. Emphasis comes from structure instead: front-load the key term in the first line, keep sentences short, and let position and repetition of a term (not decoration of it) carry the weight. No ad hoc capitalization either ("Authority", "Bond") — it reads as a typo, not intent.
- **No links in the body** — the link goes in the first comment only
- **Structure serves the payload, not the reverse** — numbered points, short line-broken statements, and connected prose are all legitimate; pick whichever gets the deliverable across fastest. There's no default form to reach for or avoid on principle. The one real constraint: the "see more" fold. A list that pushes the second half of a two-part payload past the visible preview has failed the format, even if each line reads cleanly on its own — check the fold, not the presence of a list, before deciding a structure works.
- **No code blocks** — paraphrase technical content in plain language
- **Payload is critical** — LinkedIn shows the first 2–3 lines before the "see more" cut. Those lines must be the usable thing itself, not a tease that promises one later

---

## Post Structure

The post should follow this shape, in order:

**Payload (2–4 lines max)**
The theme and the deliverable, fused: state the belief the post is arguing for, then the concrete test or rule that makes it usable — or state the tool in terms that carry the belief inside it, so the two read as one claim rather than two paragraphs. Given away up front, complete enough to apply without clicking through. This is not a hook that creates curiosity — it's the deliverable itself. A reader who stops here should already have something they can use today, and should know why it matters. Do not start with "I" — it reads as self-promotional and performs poorly.

**Argument (2–4 sentences)**
Why the payload is correct — the reasoning that makes it hold, stated as a direct claim, not illustrated through a story. If the post's ideas apply broadly (a pattern that shows up across several named practices, a principle other rules reduce to), say that plainly and specifically. This is an argument, not a demonstration — no "a team did X, and later Y happened." State the logic; don't dramatize it.

**Cost (1–2 sentences)**
What ignoring the payload actually costs, stated flat: "X seems fine until it costs Y once Z happens" or "X costs nothing on approval; it costs Y once Z happens." Pull the number, the failure mode, or the compressed fact from the post's real example — but state it as a fact, not as a scene with a beginning and an ending.

Stop there. Don't follow the cost with a spelled-out directive ("so ask this before you approve the exception") unless it adds information the reader doesn't already have — the cost plus the closing question usually already implies the behavior change, and restating it explicitly reads as talking down to the reader rather than trusting them to draw the conclusion.

**Closing line (1 sentence)**
A sharp question or flat statement that sends the reader to check the payload against their own work. Specific enough that it requires reflection to answer — not "what do you think?"

**Hashtags (5–7)**
Place on their own lines at the end. Use specific technical tags (#softwarearchitecture, #distributedsystems) rather than broad ones (#tech, #programming). Include at least one role-based tag (#engineeringmanager, #techlead) to reach decision-makers.

---

## Steps

### Step 1 — Read the post

Read the file at `$ARGUMENTS`. Identify two things separately — don't let them blur together:
- **The theme**: the post's core thesis or belief, in one sentence — the idea the whole post is arguing for
- **The deliverable**: the single most directly usable artifact that operationalizes the theme — a test, rule, definition, checklist item, or question — stated in a form that works with zero context

Also identify:
- The single fact that best proves the deliverable's cost — a number, a failure mode, a concrete before/after — compressed to one sentence, stripped of its narrative setup
- The target reader — who is this written for?

**Ground the theme in the conclusion, not the most vivid middle section.** Read the post's actual conclusion (or nut graf, if the synthesis lives up front) and state the theme in that section's own terms. Long-form posts often spend their middle sections drawing a sharp, dramatic contrast (approach A vs. approach B, pattern X vs. anti-pattern Y) that reads more quotably than the piece's actual resolution — but the conclusion frequently complicates that contrast into something subtler (e.g., "either approach is fine when it's a deliberate, earned trade-off; the failure is defaulting into either one unexamined"). A theme pulled from the dramatic middle section instead of the conclusion produces a payload that's punchier to write but misrepresents what the post argues. If the conclusion's framing differs from the middle sections' sharpest material, the conclusion wins.

Do not write the LinkedIn post yet.

### Step 2 — Extract the payload

The payload is the theme and the deliverable fused together, not the deliverable alone: the theme is why it matters, the deliverable is how it becomes usable. A payload with only the deliverable reads as a disconnected tactic ("here's a two-question test"); a payload with only the theme reads as an unearned abstraction ("architecture is about authority"). Together they read as a claim with a tool attached.

The payload must meet four criteria:
1. Is genuinely usable on its own — a reader could apply it in their next design review without reading anything else
2. Carries the theme, not just the mechanics — a reader should know what belief the deliverable is in service of
3. Matches the post's actual stance — if the post's real argument is a nuanced trade-off ("X is fine when earned deliberately, wrong when defaulted into"), the payload must carry that nuance rather than flattening it into a cleaner-sounding "X is bad, Y is good." A payload that picks a side the post itself doesn't take is easier to write but misrepresents the piece.
4. Does not start with "I" and does not contain a link

Draft 2–3 payload options. Select the strongest one and explain why briefly.

### Step 3 — Write the post

Write the full LinkedIn post following the Format Rules and Post Structure above. Target 120–190 words — this is an argument, not a story, and should read as compact. Posts that pad the argument out to hit a length target read as slower and weaker, not more thorough.

After writing, check:
- Does the payload stand alone before "see more" — usable with zero additional context? If the payload uses a list or line breaks, would the visible preview (roughly the first 3–4 lines) still contain the whole thing, not just its first half?
- Is there any link in the body?
- Does any sentence narrate a sequence of events ("first X happened, then Y, then years later Z") instead of stating a claim or a fact? If so, cut it down to the flat fact.
- Does the cost land as one compressed, concrete fact rather than an abstract claim?
- Is there a sentence after the cost that just spells out what the reader should now do? If it adds nothing the cost and closing line don't already imply, cut it.
- Does the closing line require reflection, or is it generic?
- Would this post give a reader real value even if they never click through?
- Does the argument's polarity match the post's actual conclusion, or has it been sharpened into a simpler dichotomy (a clear villain, a clear hero) that the post itself doesn't endorse?

### Step 4 — Write the first comment

Write the text for the first comment to post immediately after publishing. This should offer depth, not withheld value — the post already gave the payload away for free. This should be:

> Full post: [article URL]
>
> [1 sentence naming what the full article adds beyond the payload already given — the fuller framework, the other examples, the edge cases — not a restatement of the hook, and not a tease]

The article URL follows the site's permalink format: `https://lucentowl.com/blog/YYYY/MM/DD/slug.html`

Derive the URL from the filename: `_posts/YYYY-MM-DD-slug.md` → `/blog/YYYY/MM/DD/slug.html`.

### Step 5 — Lint the draft

The [writing standards](.claude/skills/refine-prose/writing-standards.md) apply to this content too — LinkedIn copy is still Lucent Owl prose, just in a different container. Enforce it the same way the site enforces it on posts:

1. Write the LinkedIn post body and the first-comment sentence (skip the URL and hashtags — they aren't prose) to a temporary file in your scratchpad directory.
2. Run `/refine-prose` on that temporary file. Treat its "STYLE SUGGESTIONS" judgment calls with the compressed LinkedIn format in mind — skip ones that don't fit the format's brevity.
3. Pay particular attention to em-dashes and AI-tell phrases/colon constructions ("the key insight", "worth noting", "Here's why:") — these are easy to reintroduce while punching up a line for the "hit hard" tone, and `/refine-prose` catches them mechanically rather than relying on self-review alone.

Discard the temporary file once `/refine-prose` reports clean; it isn't part of the deliverable.

---

## Output Format

Deliver output in this exact structure:

---

**LINKEDIN POST**
[Full post body, plain text, ready to paste — no markdown syntax or other formatting characters anywhere in this block]

---

**FIRST COMMENT**
[Text for the first comment, including the derived article URL]

---

**HASHTAGS**
[List of 5–7 hashtags, one per line]

---

**PAYLOAD RATIONALE**
[1–2 sentences on why the selected payload was the strongest option]

---
