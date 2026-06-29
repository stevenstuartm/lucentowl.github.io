# Blog Post Guide

This guide covers format requirements and writing standards specific to blog posts. Always also read [writing-standards.md](writing-standards.md) — the universal rules apply to every post.

---

## Format Requirements

**File location and naming**:
- Place in `_posts/` with filename format `YYYY-MM-DD-title.md`
- The filename is permanent once created — see the no-rename rule below

**Required front matter**:
```yaml
---
layout: post
title: "Your Post Title"
date: 2025-09-29
description: "Concise summary that captures the core thesis and key points of the post"
tags: [architecture, design-patterns]
---
```

**CRITICAL: Required fields**:
- **description**: A 1-2 sentence summary that captures the core thesis. Used for SEO and post previews. Write it to stand alone — someone should understand what the post argues just from the description.
- **tags**: Array of tags for discoverability and filtering on the blog page. Use meaningful tags, not generic ones.

**Standard procedure for creating a new blog post**:
1. Create the markdown file in `_posts/` with correct date format
2. Include complete YAML front matter (layout, title, date, description, tags)
3. Write the post body following the writing standards

---

## CRITICAL: NEVER Rename Files

- ❌ NEVER rename blog post files (`_posts/*.md`) or any other content files
- ❌ NEVER use `git mv` or any other method to rename files
- The filename format `YYYY-MM-DD-title.md` is permanent once created
- If the title changes, update only the `title:` field in the front matter
- The filename and URL remain stable regardless of title changes
- **Rationale**: File renames break external links, analytics, bookmarks, and SEO
- This rule applies to all content files (posts, guides, pages)

---

## CRITICAL: Never Cross-Reference Other Posts

- ❌ NEVER add links to other posts on the site within post content
- ❌ NEVER write "as explored in [post]", "see also [post]", "covered in [post]"
- Each post must stand alone as a complete, self-contained argument
- Cross-references imply the post is incomplete without reading the linked content — this is a quality failure
- If a concept belongs to another post, the current post must either cover enough to be self-contained, or acknowledge the limit in prose without pointing elsewhere

This rule is non-negotiable and applies to all blog post content.

---

## CRITICAL: Never Fabricate Personal Experiences

- ❌ NEVER write "I've watched...", "I've seen...", "I've observed..." unless the user explicitly provided those experiences
- ❌ NEVER invent specific examples with made-up details, timelines, or scenarios
- ❌ NEVER claim personal anecdotes that weren't shared by the user
- ✅ USE hypothetical framing: "Teams can...", "Developers might...", "Consider a scenario where..."
- ✅ USE generic, illustrative examples that don't claim personal observation
- ✅ ASK the user for specific examples if concrete ones would strengthen the post

This rule is non-negotiable and applies to all narrative blog content.

---

## Writing Standards

All universal rules in [writing-standards.md](writing-standards.md) apply. Blog posts additionally require:

**Introductions** should be personal and relatable — see the "Blog Post Voice" section in writing-standards.md for the voice balance guidance and examples.

**Conclusions with actionable next steps** should use bullets. Long comma-separated lists of actions force the reader to buffer too much context. Clear bullet points make each action scannable and memorable.

```markdown
Example of effective conclusion bullets:

Or you can demand discipline:
- Discover what you're building before estimating
- Test your assumptions
- Agree on specific outcomes with clear success criteria
- Build what was agreed, or realign when discovery demands it
- Measure whether you actually delivered value
```

**Code examples**: Default to C# unless the subject is language-specific. Use the appropriate language when the topic requires it (Terraform uses HCL, CloudFormation uses YAML/JSON, Python for data science).

---

## Social Media Summaries

When creating LinkedIn or social media summaries of blog posts:

**CRITICAL: Use informal and personal tone for LinkedIn**
- Write in first person ("I've been thinking about...", "So I've been exploring...")
- Use conversational language, not formal presentation style
- Read like you're sharing your thinking with colleagues, not presenting a formal solution
- Avoid sounding prescriptive or evangelical; be exploratory and humble
- Example: "The approach I'm calling..." vs "This framework provides..."
- Example: "This won't fit everywhere" vs "This may not fit every context"

**1. Lead with the hook and solution signal**
- Open with a concrete problem people recognize, framed personally
- Signal that you're exploring a solution: "So I've been exploring what happens if..."
- Don't bury the solution promise in later paragraphs

**2. Trust intelligent readers**
- Assume readers can fill in obvious gaps without exhaustive explanation
- Remove unnecessary elaboration that weakens punch
- ❌ "Decisions made without understanding constraints, requirements that shift mid-implementation, or scope creep that forces compromises"
- ✅ "unclear communication with stakeholders and a lack of governance between tech leads and developers"

**3. Use standalone punchy statements**
- Give key points their own paragraph for emphasis
- Standing alone creates impact that inline text doesn't

**4. Be specific about root causes**
- Add dimensions the full post explores in detail
- Don't just say "communication problems" — specify what kind

**5. Simplify solution presentation**
- Use clean bulleted lists instead of bold inline text for scannability
- Format for the platform (LinkedIn favors bullets over dense paragraphs)

**6. Cut redundant phrases**
- ❌ "Stop asking stakeholders to pay for past mistakes. Start presenting forward-looking opportunities."
- ✅ "Start presenting forward-looking opportunities." (the contrast is implied)

**7. Shorter, punchier sentences**
- More direct than elaborate constructions

**Testing the summary**:
- Run `python lint_content.py --text "<summary_text>"` to check for AI-tell phrases
- Read it aloud — does it sound like how you'd explain it in person?
- Could an intelligent reader grasp the thesis and solution in 30 seconds?

Social summaries are not compressed blog posts. They're standalone artifacts that capture the thesis, hint at the reasoning, and present the solution clearly. Assume smart readers who don't need hand-holding.
