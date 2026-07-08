---
name: jekyll-kramdown
description: Formatting and voice rules specific to Jekyll sites using Kramdown as the markdown processor.
detect: Repo root (or an ancestor of the target file) contains a Jekyll `_config.yml` — especially one setting `markdown: kramdown` — or the user explicitly says the content is for a Jekyll/Kramdown site.
---

# Jekyll / Kramdown Platform Rules

Layer these on top of `../writing-standards.md` when the detect condition above matches. Skip this file entirely on other platforms — nothing here is universal.

## Formatting and Markdown

- Headers must have a blank line before them — Kramdown will not parse a header that immediately follows a text line
- Tables must have a blank line before them — same reasoning; Kramdown needs the block boundary to recognize the table

## External Link Attributes

Kramdown's inline attribute list (IAL) syntax is how this platform opens a link in a new tab:

```markdown
[Link Text](https://example.com){:target="_blank" rel="noopener noreferrer"}
```

Always include `rel="noopener noreferrer"` alongside `target="_blank"`. This is an exact-match mechanical check, same as the ones in `writing-standards.md` — run it with Grep whenever this platform doc is in scope:

```
\]\(https?://[^)]+\)($|[^{])
```

(No lookahead — ripgrep's engine doesn't support it. This works the same way: if the closing `)` is immediately followed by `{`, that's the start of `{:target=...}` and the link is compliant; anything else immediately after, or end of line, means the attribute is missing.)

Any hit is a markdown link to an external URL missing the `{:target=...}` attribute — add it. This pattern is meaningless outside a Kramdown project (other platforms don't use IAL syntax at all), which is exactly why it lives here instead of in the universal `writing-standards.md` list.

## Blog Post Voice

**Introduction voice**:
- Start with relatable, personal framing that acknowledges common knowledge or shared experiences
- Be conversational and authentic; avoid rigid formulas or templates
- Use varied, creative openings that fit the specific post's tone and subject
- Make it clear you're sharing experience and observations, not prescribing universal truths
- The intro should feel like you're having a conversation with a colleague

**Voice balance throughout the post**:
- **Introduction (1-3 paragraphs)**: Personal voice with "I" statements to establish credibility and relatability
- **Main content (principles, analysis, examples)**: More objective observations without excessive "I've seen...", "I like...", "I follow..."
- **Approach/recommendations sections**: Can use "I" sparingly, but prefer direct imperative ("Start with...") or inclusive ("We can...")

**Example**:
```
✅ Good opening — personal, relatable, fits the topic:
"I know, I know—another post about microservices versus monoliths. The debate feels exhausted
at this point. Yet every time I start a new project, I find myself weighing the same questions."

❌ Too distant and declarative:
"Microservices versus monoliths is an important architectural decision. Organizations must
choose the architecture that fits their context."

❌ Overused "I" throughout the body:
"I've come to see microservices as... I've seen plenty of terrible monoliths... I like
introducing API gateways... I tend to start with..."
```
