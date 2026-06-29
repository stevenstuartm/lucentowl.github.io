# linkedin-post

Convert a blog post into a LinkedIn native post optimized for organic reach. Accepts a file path as argument.

**Usage**: `/linkedin-post _posts/YYYY-MM-DD-title.md`

---

## LinkedIn Distribution Context

LinkedIn significantly reduces reach on posts that contain external links in the body. The workaround: publish the post with no link in the body, then immediately post the article URL as the **first comment**. This preserves reach while giving readers a path to the full post.

This command produces copy-paste ready content for both the post body and the first comment.

---

## Format Rules

LinkedIn does not render markdown. The post must be written in plain text with these conventions:

- **No headers** — use a blank line and bold text if you need to signal a shift
- **Short paragraphs** — 1–3 sentences maximum, each separated by a blank line
- **Bold sparingly** — one key phrase per post at most, used for the single sharpest claim
- **No links in the body** — the link goes in the first comment only
- **No bullet lists** — write in connected prose; lists read as low-effort on LinkedIn
- **No code blocks** — paraphrase technical content in plain language
- **Hook is critical** — LinkedIn shows the first 2–3 lines before the "see more" cut. The hook must work as a standalone statement that earns the click

---

## Post Structure

The post should follow this shape, in order:

**Hook (2–3 lines max)**
A counter-intuitive claim, a sharp reframe, or a question that the target reader feels immediately. This must function before the "see more" truncation. Do not start with "I" — it reads as self-promotional and performs poorly.

**Context (2–4 sentences)**
The problem or situation the post's thesis addresses. Write for a senior engineer or architect who has 90 seconds. Assume intelligence; don't explain basics.

**Core insight (2–4 sentences)**
The sharpest claim the post makes. This is what the reader will remember or share. If the post has a practical artifact (decision framework, before/after, rule), surface it here in prose form — even if the post has a diagram, state the principle in plain language so it lands without the image.

**Implication (2–3 sentences)**
What changes if the reader accepts the thesis? Make it concrete: what would they do differently, what would they stop doing, what would they ask next time they're in a design review?

**Closing question (1 sentence)**
End with a question that invites response from the target audience. Make it specific — not "what do you think?" but something that requires the reader to reflect on their own experience.

**Hashtags (5–7)**
Place on their own lines at the end. Use specific technical tags (#softwarearchitecture, #distributedsystems) rather than broad ones (#tech, #programming). Include at least one role-based tag (#engineeringmanager, #techlead) to reach decision-makers.

---

## Steps

### Step 1 — Read the post

Read the file at `$ARGUMENTS`. Identify:
- The post's thesis (one sentence)
- The single sharpest claim or reframe the post makes
- Any practical artifact already present (diagram, framework, before/after, rule)
- The target reader — who is this written for?

Do not write the LinkedIn post yet.

### Step 2 — Extract the hook

The hook must meet three criteria:
1. Works as a standalone statement before "see more" — the reader doesn't need context to feel the tension
2. Is specific to the post's actual thesis — not a generic observation about the industry
3. Does not start with "I" and does not contain a link

Draft 2–3 hook options. Select the strongest one and explain why briefly.

### Step 3 — Write the post

Write the full LinkedIn post following the Format Rules and Post Structure above. Target 180–280 words. Posts shorter than 150 words rarely earn saves; posts longer than 300 words must earn every line or readers drop off.

After writing, check:
- Does the hook work before "see more"?
- Is there any link in the body?
- Does the core insight stand on its own in plain language?
- Does the closing question require thought, or is it generic?

### Step 4 — Write the first comment

Write the text for the first comment to post immediately after publishing. This should be:

> Full post: [article URL]
>
> [1 sentence about what the reader will get from clicking through — not a restatement of the hook, but a complement to it]

The article URL follows the site's permalink format: `https://lucentowl.com/blog/YYYY/MM/DD/slug.html`

Derive the URL from the filename: `_posts/YYYY-MM-DD-slug.md` → `/blog/YYYY/MM/DD/slug.html`.

---

## Output Format

Deliver output in this exact structure:

---

**LINKEDIN POST**
[Full post body, plain text, ready to paste]

---

**FIRST COMMENT**
[Text for the first comment, including the derived article URL]

---

**HASHTAGS**
[List of 5–7 hashtags, one per line]

---

**HOOK RATIONALE**
[1–2 sentences on why the selected hook was the strongest option]

---
