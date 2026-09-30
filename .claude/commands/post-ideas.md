# post-ideas

Generate, score, and rank blog post ideas, and move them through the idea lists. Two jobs, **research** and **rank**, a **draft** job that turns an approved idea into a reviewed draft, and two bookkeeping actions for the author's decisions.

**Usage**:

| Invocation | Does |
| --- | --- |
| `/post-ideas research` | Generate 20 new ideas across the site's range |
| `/post-ideas research <focus> [count]` | Generate ideas on a focus (a domain, growth edge, or seed idea) |
| `/post-ideas rank` | Re-score the backlog and review list, then rebalance |
| `/post-ideas rank <backlog\|review> [guidance]` | Re-score one list; any guidance is logged as calibration first |
| `/post-ideas draft <id>` | Research an approved idea, write its draft, move it to Drafted, then run up to three `/review-publishable` rounds, unattended |
| `/post-ideas approve <id>` | Move an idea from review to approved |
| `/post-ideas decline <id> [reason]` | Move an idea to the backlog's Declined table |

With no arguments, ask which job to run.

---

## Files

| File | Role | Who changes it |
| --- | --- | --- |
| [`.claude/content/post-idea-rubric.md`](../content/post-idea-rubric.md) | Idea format, scoring criteria, placement rules, calibration log | The rank job appends calibration; the author edits the rest |
| [`.claude/content/authority-bounds.md`](../content/authority-bounds.md) | What the site can support, committed positions, growth edges, owned frameworks | The author |
| `_drafts/post-ideas/backlog.md` | Every idea considered and not in review or approved, plus Declined | Both jobs |
| `_drafts/post-ideas/in-review.md` | Top ideas awaiting the author's decision, at most 20, in rank order | Both jobs; `approve` and `decline` |
| `_drafts/post-ideas/approved.md` | Approved ideas awaiting a draft, and the Drafted record | `approve` and `draft` only |

**Read the rubric and authority bounds before any job.** Every score comes from the rubric, never from memory of an earlier session.

---

## Job 1: Research

Produces new ideas, scores them, and places each one in the backlog or review.

1. **Load context.** Read the rubric, authority bounds, all three list files (including Declined), and the title and description of every post in `_posts/`.
2. **Generate candidates.** Default to 20, or the requested count, on the focus if one was given. Without a focus, spread across the domains and growth edges in authority bounds, and favor under-covered ones. Frame each candidate as a research question with a hypothesis that the research could overturn. Aim at the rubric's benchmark: mechanisms readers can check in their own systems.
3. **Screen.** Drop any candidate that:
   - restates a published post, a list entry, or a declined idea (compare theses, not titles)
   - contradicts a committed position without a deliberate reversal, which must be noted
   - borrows a framework, score, or coined term without naming the source (see [`derivation-check.md`](../content/derivation-check.md)); name the prior art in the Note instead
4. **Check the evidence leads.** When web search is available, confirm that each named lead exists and that its author, year, and venue are right. Mark any lead you can't confirm as "(unverified)". This checks that the leads are real, not that the hypothesis holds. The investigation belongs to the post.
5. **Score** each survivor against the rubric, and record the reader's check for any U of 4 or 5.
6. **Place.** Apply the rubric's placement rules:
   - A candidate that clears the review bar and outranks the lowest review item enters review with a full entry. The item it displaces moves to the backlog: a row in Ranked, and its full entry under Detail.
   - Every other candidate becomes a backlog row, with its hypothesis in one sentence. Keep Ranked sorted by total, then U.
   - Give each new idea a new, unique ID and today's date in Added.
7. **Report** in chat: a table of the new ideas (ID, title, total, placement), what moved out of review, and any lead marked unverified.

---

## Job 2: Rank

Re-scores existing ideas against the current rubric and rebalances review.

1. **Log calibration first.** If the invocation or recent conversation carries new guidance on what makes an idea good, append a dated row to the rubric's Calibration Log that quotes the guidance and states its effect on scoring. Then re-read the rubric.
2. **Choose the scope.** Default: backlog and review. `backlog` or `review` restricts re-scoring to that list, though rebalancing still compares across both. Never re-rank approved ideas.
3. **Score fresh.** Score each idea in scope against the rubric before looking at its old score, then compare. For a backlog row, score from its title, question, and hypothesis, and read its Detail entry if it has one.
4. **Rebalance.** Review holds the top 20 across both lists, subject to the entry bar and tie rules.
   - **Promote:** write the full entry for each idea entering review, including evidence leads (checked as in research step 4). If the idea has a Detail entry in the backlog, start from it and remove it from Detail.
   - **Demote:** an idea leaving review gets a backlog row with a one-sentence hypothesis, and its full entry moves under Detail.
   - Re-sort both lists and renumber review headings by rank.
5. **Report** in chat: every idea whose score changed (ID, old total to new, and the reason for any change of 2 or more points), every promotion and demotion, and any calibration row added.

---

## Job 3: Draft

Turns one approved idea into a draft in `_drafts/`, then reviews it with `/review-publishable` for up to three rounds. The approved entry is the brief: its question, hypothesis, lens, and hook define the post. The draft tests that hypothesis rather than decorating it.

**This job runs unattended.** The author reviews the result later, so the job never stops to ask. Where it would want the author's call, it makes the call, applies it, and records it for the report. The goal is a draft as close to publishable as possible. The only gaps it leaves are facts only the author has.

1. **Load the entry.** Find `<id>` under approved's Awaiting Draft. If the ID isn't there, stop and report where it is instead: drafting starts only from an approved idea. Read [`blog-post-guide.md`](../content/blog-post-guide.md), [`writing-standards.md`](../skills/refine-prose/writing-standards.md), and the guides named in the entry's **Lens and backing**.
2. **Investigate.** Fetch and read each evidence lead for what it actually concludes, not just the quotable part, and find primary sources for any claim the post will rest on. This is the investigation research step 4 deferred to the post.
3. **Settle the thesis.** Start from the hypothesis and keep what the evidence supports.
   - If the evidence meets the entry's **Could change if**, or otherwise undercuts the hypothesis, argue what the evidence does support within the entry's question, and record the change. Never write a draft that argues a hypothesis the research overturned.
   - If the evidence leaves no defensible thesis within the question, don't draft. Leave the idea in Awaiting Draft, add a **Draft attempt:** line with the date and what the evidence showed, and report it.
4. **Write the draft** at `_drafts/<id>.md`. The ID, not the title, names the file, because files are never renamed and titles still move.
   - Front matter per the blog post guide: `title` (the entry's title), `description`, `tags`, and `sources` listing every source the body names. No `date`, since the date belongs to publication. No links in the body.
   - Open from the hook, state the thesis early, and build the argument from mechanisms the reader can check. End on the reader's check from the entry.
   - **Never write the author's experience.** Where the entry's **Experience** field suggests a first-person example belongs, leave a marker for the author instead:

     ```markdown
     > **AUTHOR** — the author's experience goes here: HotChocolate in production, a query that should have been rejected.
     ```

     Write the surrounding prose so the post still stands if the author cuts the marker.
5. **Self-check before review.** Confirm the thesis fits in one sentence and every load-bearing claim has a source in `sources`. Also confirm the argument still works with every `AUTHOR` marker cut. Fix any failure in the draft now, researching further if a claim lacks a source. Don't hand review a draft with known holes.
6. **Record it.** Move the idea from Awaiting Draft to the Drafted table with its approval date and draft path.
7. **Review cycle.** Run `/review-publishable _drafts/<id>.md` in full, including its resolution pass, so every finding is applied to the file. Then run it again on the revised file, for at most three rounds.
   - Resolve everything the job can. A finding the review would leave as a question for the author becomes a Decided fix with the reasoning recorded, unless applying it means inventing a fact only the author has. Only those end as Asked: each `AUTHOR` marker, and any number or experience claim the site's rules forbid fabricating. Carry Asked findings forward instead of raising them again each round.
   - Thesis and structure problems are findings like any other, so fix them. Stay within the entry's question, and record any change to the thesis as a Decided finding.
   - Stop early when a round ends with no Fixed or Decided findings. The review has converged.
8. **Report** in chat:
   - the draft path and the thesis as written, with any change from the approved hypothesis and why
   - any lead that didn't hold up or changed the argument
   - per review round, the count of Fixed, Decided, and Asked findings
   - every Decided finding, so the author can reverse any call
   - every open Asked finding, including each `AUTHOR` marker
   - whether the review converged or used all three rounds, and what the last round still found

---

## Author Decisions

These record the author's choices. Run them only on the author's word.

- **`approve <id>`:** move the full entry from review to approved's Awaiting Draft, appending an **Approved:** date. Review now has room, so offer to run `rank` to refill it.
- **`decline <id> [reason]`:** remove the idea from review or the backlog, and add it to the backlog's Declined table with the date and reason. Ask for a reason if none is given. It helps research avoid close variants.
---

## Invariants

- **IDs are permanent.** An idea keeps its ID through every move, re-title, and re-score.
- **Nothing is deleted.** Ideas move between lists or into Declined, so the backlog stays the full record of what was considered.
- **Evidence is leads.** No list entry claims a finding as fact, since the facts are established when the post is written.
- **Scores come from the rubric.** When the author's taste changes, the rubric's calibration log changes first, and then the scores.
