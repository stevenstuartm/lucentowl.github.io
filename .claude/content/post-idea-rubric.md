# Post Idea Rubric

How `/post-ideas` scores blog post ideas. The command holds the procedure. This file holds the standard, plus a calibration log that records the author's guidance as it accumulates, so a re-rank months from now scores the same way the author would today.

Read [`authority-bounds.md`](authority-bounds.md) alongside this file. It defines what the site can support, its committed positions, and its growth edges.

---

## What an Idea Is

An idea is a **research question** with a working hypothesis, not a finished take. Most of the site's posts started as investigations that settled into positions, and the list preserves that. Every idea records:

| Field | Required | Content |
| --- | --- | --- |
| ID | Always | A short kebab-case slug, stable for the idea's whole life. Never reuse or rename one |
| Working title | Always | Draft title; it will change |
| Research question | Always | The question the investigation answers |
| Origin | Always | **R** research, **X** experience, **RX** both |
| Scores | Always | U, D, S, E, and the total |
| Hypothesis | Always | The claim the post would argue, stated so the research could disprove it. One sentence in a backlog row; the full entry can expand it |
| Evidence | Full entry | Named research leads: papers, RFCs, incident reports, books, docs. Leads, not verified citations |
| Lens and backing | Full entry | Which of the three moves it uses, and site pages whose external sources the research can start from (never cited in the post) |
| Experience | Full entry, optional | The author's own example, when one exists |
| Reader's check this week | Full entry, when U is 4 or 5 | The concrete thing a reader can inspect in their own system |
| Hook | Full entry | A one-line social opener |
| Note | Full entry, optional | Tension with a committed position, pairing, prior art to name |
| Could change if | Full entry | What finding would overturn the hypothesis |

Backlog rows carry only the always-required fields. Ideas in review or approved carry the full entry. The hypothesis is always required because a title and a question don't say what the post would claim, and the author can't approve or decline an idea without knowing its argument.

---

## Scoring

Four criteria, each scored 1 to 5, for a total out of 20.

| Criterion | 1 | 3 | 5 |
| --- | --- | --- | --- |
| **U: Usefulness** | Targets a belief, a culture, or an industry debate | Informs a decision the reader makes occasionally | Changes something the reader owns (config, code, schema, template, policy) and can check this week |
| **D: Depth** and growth | A tip whose answer is already known | A clear position with a mechanism | An open question whose investigation could reframe several problems, and teaches the author something too |
| **S: Supportability** | Opinion with nothing to check | Some evidence, or site backing, or experience | Primary sources, studies, or public incidents to investigate, plus the site's lens or backing |
| **E: Engagement** and change | Readers nod and move on | Readers share it with their team | Counterintuitive enough that readers check their own system and change it |

**The benchmark is "Your Retry Policy Is a Load Amplifier" (20).** When unsure of a score, compare against it. It names a mechanism readers can check in their own system this week. It's counterintuitive, because a safety feature causes the harm. It changes something the reader owns, it applies almost everywhere, and technical research backs it.

**Score fresh.** When re-ranking, score each idea against this file before looking at its old score, then compare. Anchoring on the old number defeats the point of re-ranking.

---

## Placement Rules

- **In review holds at most 20 ideas,** the highest totals across the backlog and review.
- **The entry bar is a total of 17 or more.** Below that, an idea stays in the backlog even if review has room.
- **Ties** at the review cutoff go to the idea that adds a domain the review list doesn't already cover, then to the higher U score.
- **Approved ideas are never re-ranked.** Approval is the author's decision, and the order is oldest approval first.
- **Declined ideas are never re-proposed,** nor close variants, unless the author asks.
- **Duplicates:** an idea that restates a published post's thesis, or another list entry's, is merged or dropped. Compare theses, not titles.

---

## Calibration Log

Dated guidance from the author, newest last. Each entry states what changed in scoring. The rank job appends to this log whenever the author gives new guidance.

| Date | Guidance | Effect on scoring |
| --- | --- | --- |
| 2026-09-29 | "We are attributing far too much weight to lived experience… Most of the posts we had written started as research projects." | Supportability replaced an experience-weighted authority score. Research is the main source of authority, and experience is an example, never a gate |
| 2026-09-29 | "'Your Retry Policy Is a Load Amplifier' is an example of something that is truly useful." | Usefulness 5 now means changing something the reader owns that they can check this week. Culture, belief, and commentary ideas score U 1 to 3 |
| 2026-09-29 | "They are all either derivative of something else or something we have already done before. Some just do not have enough value beyond a single paragraph. Some are just so self-serving that no one is going to argue against it, so why bother stating what we all agree on?" | Depth caps at 2 when the thesis restates one known source's argument (a paper, a vendor article, a well-known essay), or when the answer fits in a paragraph. Adding incidents or a new application of that argument lifts D to 3, not higher. An idea the site's posts or case studies already argue is a duplicate. A claim no practitioner disputes scores E 3 at most, whatever its U |
| 2026-09-30 | "This is a very tired subject with little to no room to add anything more to the conversation. Most of our posts provide something truly new to the overall conversation." | Novelty test: what would a reader who already knows the standard material on the subject learn? When the subject is well-worn (its usual advice is in widely read books, vendor guidance, docs, or a long-running public debate) and the thesis is that usual advice, D caps at 2 and E at 2, however useful or well sourced. This is stricter than the single-source cap above: no one source needs to be restated, only a conversation that has already settled. An idea that adds a new mechanism, new evidence, or a reframing the standard material lacks scores normally. The rank job flags tired-subject ideas in Notes so the author can decline them |
| 2026-09-30 | "Overall, I have little interest in writing about AI. We have study guides for that and making a stance on AI right now is immature at best. We show how to use it given the latest standards but we are not trying to present ourselves as an authority on the subject. It changes every day." | AI is out of scope for posts (see authority bounds, "Not a Post Subject: AI"). Research never generates AI-centered ideas, and no AI idea is scored for review. AI may appear only as an example inside a post whose subject is something else |
