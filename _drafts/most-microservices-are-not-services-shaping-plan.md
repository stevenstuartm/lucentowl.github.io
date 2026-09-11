# Shaping Plan: Most Microservices Are Not Services

Draft: `_drafts/most-microservices-are-not-services.md`
Status: Shaping — thesis improved but not settled; 11 `PROPOSED` markers open
Standard: [.claude/commands/shape-post-draft.md](../.claude/commands/shape-post-draft.md)

6,084 words (from 3,572), 31 headers. This plan exists to make the argument
readable at a glance.

## Thesis

**Where it started (extracted from the draft):** A service is justified only by
authority over a decision nothing else can legitimately make; a business has a
bounded number of such decisions and a bounded number of operational envelopes;
therefore most deployables in a large estate are surplus.

**Where the shaping discussion moved it:** the boundedness claim was doing work
it could not support, and two separate dead ends were identified by the author:

1. **Deployable count is a pointless line of thought.** A ratio can be defended
   by anyone willing to defend it, and no number settles what a given deployable
   is for. Dropped, not demoted.
2. **Cost is dismissible by preference.** "I am fine burning millions on a what
   if" is a coherent position and there is no reply to it. So the argument
   cannot rest on expense.

What is left, and what the post now argues:

> Three tests decide whether a boundary is real — behavioral coherence,
> operational coherence, and a bond that holds. The interesting case is the
> component that passes all three and is split anyway, for risk of change,
> availability, or technology choice. Those justifications are not equal: one
> cannot be tested at all, one can be tested and usually answers against the
> person invoking it, and one can be tested and is rarely exercised. The cost
> they are traded against is certain, recurring, and itemized.

**Author status: "better but not complete."** Do not treat the block above as
settled. What it is still missing is recorded in **Open decisions #1**.

### Contour and bond are canonical terms, and this draft narrowed both

Both were defined in [Architecture Is a Belief About Where Authority Belongs](/blog/2026/06/12/architecture-is-a-belief-about-where-authority-belongs.html)
(2026-06-12). This draft reuses them without citing that post and states each
one smaller than the original.

| Term | Canonical definition | What this draft says |
| --- | --- | --- |
| Behavioral coherence | "the authority's **decisions, facts, and behaviors** change together for the same reasons" | "the **decisions** inside change together for the same reasons" — two of three terms dropped |
| Bond | "enforcement strength of the boundary, **measured by the consequence of bypass**"; "**bond strength is proportional to consequence**" | "whether anything respects the line" — made binary |

**Correction to an earlier version of this plan.** It recorded that behavioral
coherence stands opposed to Single Responsibility. That is not the canonical
position. The source post treats SRP, normalization, least privilege, and
bounded contexts as four traditions that each observed the same failure at a
different altitude and converged on one answer, with SRP as the class-level
case. Behavioral coherence generalizes SRP rather than competing with it, and
this post does not need to relitigate that argument. The narrowing in the draft,
not a dispute with SRP, is what made the definition look thin.

## The argument spine

The claims the thesis rests on, in order, after the shaping discussion.

1. **C6/C7** — Authority is sole legitimate decision-making power; two deciders means no authority and eventual divergence.
2. **C8/C9** — Authority is what makes a boundary worth a network hop.
3. **C12** — Three terms, not two: service (authority), worker (envelope), surplus (neither).
4. **C15/C102** — Contour requires behavioral *and* operational coherence, where behavioral coherence covers the authority's decisions, facts, and behaviors together.
5. **C17** — Bond is whether anything respects the line.
6. **C23** — A boundary is an insurance premium, not a purchase.
7. **C84** — And real insurance has a claims process. Redundancy can be drilled; a risk-of-change boundary cannot.
8. **C85** — A component can pass all three tests and still be split, knowingly.
9. **C88** — MIGHT (a counterfactual incident) against WILL (a monthly invoice). Not the same kind of claim.
10. **C89** — **There is no test that proves the assumption.** No experiment returns an absence.
11. **C91/C92** — Splitting to lower the risk of change destroys the instrument that measured it. Avoiding discipline by means of discipline.
12. **C93** — Availability is testable and usually inverts: ten components at three nines in series is roughly two nines.
13. **C90** — Subdivision terminates on the economic test, not the definitional one.
14. **C96** — A platform relocates the cost into a platform org; it does not remove it.
15. **C27/C100** — In-process authority is the cheapest correct answer, and should be prescribed, not just named.
16. **C75** — The case is against splitting on no condition, not against splitting.

Items 7, 9, 10, 11 and 13 are where the post stops describing and starts
contributing. Item 10 is the finding the post exists to deliver.

## Claim inventory

### As the author wrote it

| # | Claim | Tag |
| --- | --- | --- |
| 1 | No satisfying answer exists to why a company needs hundreds or thousands of services | Supporting |
| 2 | The four standard arguments each hold up individually | Supporting |
| 3 | None accounts for the count; deployables exceed those situations by an order of magnitude | **Retired** by author decision — counts leave |
| 4 | Most of what gets called a microservice is not a service | Load-bearing |
| 5 | Three categories: legitimate service, legitimately something else, justified by nothing | Load-bearing |
| 6 | Authority = canonical source of truth, sole legitimate enforcer | Load-bearing |
| 7 | If a second component can also decide, neither is the authority, and they will diverge | Load-bearing |
| 8 | Authority is what makes a boundary worth a network hop | Load-bearing |
| 9 | Distribution's costs are the price of protecting a decision | Load-bearing |
| 10 | Many deployables own no decision — they transform, forward, fan out, or wrap | Load-bearing |
| 11 | An async handler holding no authority can still be justified by a distinct envelope | Load-bearing |
| 12 | Three terms: service, worker, surplus | Load-bearing |
| 13 | Surplus ships on its own schedule because the pipeline permits it | Supporting |
| 14 | A thing that can't be named without a follow-up explanation is suspect | Supporting |
| 15 | Contour requires behavioral and operational coherence | Load-bearing — definition rewritten by P10 |
| 16 | Pricing and refund rules change for different reasons, so they are separate claims | Supporting — **recursion seed, answered by C90 and repaired by P10** |
| 17 | Bond = whether anything respects the line | Load-bearing |
| 18 | A broken bond costs correctness, rarely and hard | Supporting |
| 19 | Poor operational contour costs money continuously | Supporting |
| 20 | Poor behavioral contour costs velocity, appears on no invoice, stays unfunded longest | Supporting |
| 21 | A boundary can be well contoured, strongly bonded, and still cost more than it returns | Load-bearing |
| 22 | Hop cost is measurable; authority value is estimable | Load-bearing |
| 23 | A boundary is an insurance premium, not a purchase | Load-bearing |
| 24 | An envelope returns continuously, so a real worker is easier to defend | Supporting |
| 25 | Five-row table sorting boundary cost against what it buys | Load-bearing |
| 26 | A weak bond pays full price with no coverage | Supporting |
| 27 | In-process authority is the cheapest correct answer | Load-bearing — **prescription proposed at P8** |
| 28 | The calculation won't compute to a decimal; its use is forcing the question | Load-bearing |
| 29 | Distinct reasons a business changes its own rules are countable | Supporting (demoted with the counts) |
| 30 | The only published count of this kind put Uber at ~70 | **Unsupported** — negative claim about a whole literature. Soften or cut |
| 31 | A large retailer or bank would plausibly land in the same range | **Unsupported** — demoted with the counts |
| 32 | Authority count grows slowly | **Unsupported** — demoted |
| 33 | Engineering headcount grows faster and nothing ties the two together | **Unsupported** — demoted |
| 34 | Operational coherence is invoked to justify splits behavioral coherence wouldn't support | Supporting |
| 35 | Genuine operational divergence means orders of magnitude, not a factor of three | Load-bearing |
| 36 | Event-driven autoscaling absorbs spikes that once required a second deployable | Supporting, unsourced |
| 37 | Uber grouped ~2,200 microservices into 70 domains | **Sourced, verbatim-accurate.** Repositioned by P5 |
| 38 | Uber's described symptoms are more damning than the ratio | Load-bearing, sourced |
| 39 | "Independent services deployed together" is a monolith with network latency between its function calls | Load-bearing |
| 40 | Uber built a gateway and layer hierarchy rather than consolidating | Load-bearing, sourced |
| 41 | That was defensible and possibly the only affordable choice at their size | Supporting |
| 42 | DOMA concedes the arithmetic rather than refuting it | Load-bearing |
| 43 | The census is a diagnostic, not a demolition order | Load-bearing |
| 44 | Most deployables in a mature domain are async handlers | **Unsupported** |
| 45 | An envelope = scaling profile + retry semantics + latency tolerance + resource shape | Load-bearing |
| 46 | A domain tends to have a handful of envelopes | **Unsupported** |
| 47 | Envelopes are physics, so they are shareable where authorities are not | Load-bearing |
| 48 | A shared runtime executing ten domains' business rules violates contour | Load-bearing |
| 49 | The share works when the runtime supplies only physics | Load-bearing |
| 50 | Forty separately deployed bulk reprocessors are forty copies of the same physics | Supporting |
| 51 | Ten handlers sharing one envelope split across ten deployables buys nothing | Load-bearing |
| 52 | Forty domains and two hundred workers is five each, "upper end of plausible" | Supporting — conflicted with C77 |
| 53 | 200 workers in 12 envelopes means 12 profiles carried by 200 deployments | Supporting |
| 54 | That gap is not all surplus | Load-bearing — conflicted with C77 |
| 55 | A pipeline moves the invariant from the authority into the ordering | Load-bearing |
| 56 | Choreography is a broken bond that doesn't look like a bypass | Load-bearing |
| 57 | Speculative operational splitting inside a pipeline costs correctness | Load-bearing |
| 58 | Creation was optimized to near-zero; retirement never was | Load-bearing |
| 59 | Deletion produces nothing showable | Supporting |
| 60 | A service count is an accumulation, not a design | Load-bearing |
| 61 | At small scale the alternative is a function; at large scale, a negotiation | Load-bearing |
| 62 | Forking routes around a person and genuinely saves months | Load-bearing |
| 63 | The cost lands elsewhere and can't be attributed back | Load-bearing — **reused by C96** |
| 64 | Conway observed that systems mirror organizational communication structures | **Fixed directly**: 1967 → 1968, source added |
| 65 | Teams split and services follow; orgs consolidate and services stay | Load-bearing |
| 66 | Several reorgs later the topology reflects an org chart that no longer exists | Supporting |
| 67 | Coupling inside one deployable is compiler-checked; split, it persists unchecked | Load-bearing — **now also load-bearing for C91** |
| 68 | Teams that split for independent deployability can end up with less of it | Load-bearing, sourced |
| 69 | A component owning a decision can classify its own behavior | Load-bearing |
| 70 | Enormous telemetry volume carrying little meaning | Supporting, **Unsupported** |
| 71 | Tooling can correlate fragments but can't supply judgment never encoded | Supporting |
| 72 | Compute footprint and service count are independent axes sold as one | Load-bearing |
| 73 | Four services on 3,000 nodes vs 200 on 12: opposite problems, same tool | Supporting |
| 74 | Teams blame the tool for answering a question they didn't ask | Supporting |
| 75 | The case is against splitting on neither condition, not against splitting | Load-bearing |
| 76 | Checklist: name what it decides without "and"; else the envelope; else packaging | Load-bearing |
| 77 | Treat the gap between the censuses' sum and the deployable count as surplus | **Retired** — replaced by P7 |
| 78 | Make the ratio visible on a dashboard | Demoted with the counts |
| 79 | Fund deletion the way creation is funded | Load-bearing |
| 80 | Collapse on the envelope axis before the authority axis | Load-bearing |
| 81 | Uber's ratio was 31:1; most estates have never measured theirs | **Retired** — replaced by P9 |

### Introduced by the proposals (author's to accept or delete)

| # | Claim | From |
| --- | --- | --- |
| 82 | The count provoked the question and is not evidence | P1 |
| 83 | Newman's "size is uninteresting" is conceded, and conceding it costs nothing | P1 |
| 84 | Real insurance has a claims process; redundancy can be drilled, a risk-of-change boundary cannot | P2 |
| 85 | A component can pass all three tests and still be split, knowingly paying | P3 |
| 86 | Monzo is right at the level of their own example; contactless and chip-and-PIN are plausibly two authorities | P3 |
| 87 | Three justifications survive the tests: risk of change, availability, technology choice | P3 |
| 88 | MIGHT and WILL are not the same kind of claim | P3 |
| 89 | **There is no test that proves the risk-of-change assumption** | P3 |
| 90 | Subdivision terminates on the economic test, not the definitional one | P3 |
| 91 | Splitting to lower the risk of change destroys the instrument that measured it | P3 |
| 92 | Avoiding discipline by means of discipline; deliberateness is not a defense | P3 |
| 93 | Ten components at three nines in series is roughly two nines | P3 |
| 94 | Availability rises only with a real bulkhead: bond holds plus a degraded path | P3 |
| 95 | Technology choice is testable and most estates converge on one or two runtimes | P3 |
| 96 | A platform relocates the cost rather than removing it | P3 |
| 97 | The domain supplies no target; it supplies the reason a target is wrong | P4 |
| 98 | Uber is evidence of symptoms, not of a ratio | P5 |
| 99 | Name what the boundary buys, then describe the exercise that would show it working | P7 |
| 100 | Move an authority in-process before moving it anywhere else | P8 |
| 101 | The question was never how many, but what each one buys and whether anyone can name the day it pays out | P9 |
| 102 | Behavioral coherence covers the authority's decisions, facts, **and** behaviors changing together — restored from the canonical post, not invented | P10 |
| 103 | Bond strength is proportional to the consequence of bypass, so a low-consequence boundary can correctly carry a weak bond | P11 |

Still load-bearing and unsupported after this pass: **30, 44, 46**, plus 36 and
70 as supporting-and-unsupported. C31–C33 no longer carry weight now that the
counts are out, but they are still asserted in the text and should be cut or
softened along with C30.

## Source audit

| Source | Quoted accurately | Representative | Source's own conclusion |
| --- | --- | --- | --- |
| [Uber, *Introducing Domain-Oriented Microservice Architecture*](https://www.uber.com/us/en/blog/microservice-architecture/) | **Yes — all five quotes verbatim** | Yes. The "networked monoliths can form" line does sit in a problem-statement section, as the draft says | Classify into domains, add gateways and a layer hierarchy. Explicitly not consolidation: "reduce overall system complexity while maintaining the flexibility associated with microservice architectures" |
| [The Register, *How does Monzo keep 1,600 microservices spinning?*](https://www.theregister.com/2020/03/09/monzo_microservices/) | Added by P3, verbatim | Yes | Monzo's granularity works, but on "a lot of custom, in-house tools and libraries that are not easy to replicate" — which P3 uses as the concession |
| [Conway, *How Do Committees Invent?*](https://www.melconway.com/research/committees.html) | Added directly | Yes | Datamation, April 1968. Submitted to HBR in 1967 and rejected — hence the common misdating the draft had |
| **Own prior work:** [Architecture Is a Belief About Where Authority Belongs](/blog/2026/06/12/architecture-is-a-belief-about-where-authority-belongs.html) | **No — this draft restates both definitions smaller than the original** | n/a | Contour and bond as the two measures of an authority claim. Source of behavioral coherence, operational coherence, and the naming test this draft reuses. Not currently linked from the draft |

Verified verbatim from Uber: "around 2,200 critical microservices"; "classify
2200 microservices into 70 domains"; "engineers had to work through around 50
services across 12 different teams in order to investigate the root cause";
"requires extensive collaboration with time spent on meetings, design, and code
review"; "Networked monoliths can form, where services that appear to be
independent all have to be deployed together to safely perform any change."

Conclusions running against the thesis: **one, and the draft already engages it
head-on** in "Uber's Own Remedy Is the Strongest Objection to This Argument."
That section remains the draft's strongest passage and needs no repair.

### Counterpositions found (published, not manufactured)

| Source | Position | Disposition |
| --- | --- | --- |
| [Monzo / The Register](https://www.theregister.com/2020/03/09/monzo_microservices/) | ~1,600 services, deliberately, to minimise the risk of change | **Engaged in P3.** Conceded at the level of their example, then answered: the justification has no test, and their own tooling caveat concedes the cost |
| [Sam Newman](https://www.infoq.com/news/2020/05/monolith-decomposition-newman/) | Size is among the least interesting properties; independent deployability is the outcome | **Conceded in P1**, at no cost, because the post no longer argues from size |
| [Empirical study of microservice co-evolution, 11 systems](https://www.sciencedirect.com/science/article/pii/S0164121223001838) | "A lack of evidence whether the intended independence of microservices can actually be achieved in practice" | **Not yet used.** Available to replace the unsupported C30–C33 if the post ever needs external support. See Open decisions #5 |

Considered and rejected as a spine: **logical coupling / co-change mined from
release history** ([Gall et al., ICSM 1998](https://plg.uwaterloo.ca/~migod/846/papers/gall-coupling.pdf)).
It is measurable and non-definitional, but it makes *independence achieved* the
criterion, which gives a clean-history defender a pass. The certainty asymmetry
bites whether or not the split worked, so it is the stronger thread. Recorded so
the option is not rediscovered and re-argued later.

## Unreconciled tensions

| Claims | Conflict | Status |
| --- | --- | --- |
| 77 vs 52, 54 | Checklist bounds the estate at the **sum** of two censuses; the worker section reasons **multiplicatively** and then concedes the gap "is not all surplus" | **Dissolved** by retiring the arithmetic. P7 replaces the bullet. C52/C54 text still stands and should be reread once P7 lands |
| 27 vs 78, 79, 80 | In-process authority named "the cheapest correct answer," then absent from all three prescriptions | **Addressed** by P8 |
| 43, 41 vs 80 | Uber's consolidation called unaffordable, but envelope-axis collapse called "mostly configuration" | **Open.** Not yet addressed by any proposal |
| 3 vs 47, 12 | Intro frames the post as accounting for a number; the contribution is a test | **Addressed** by P1, but the intro prose itself still says "None of them accounts for the arithmetic" and has to be rewritten, not just annotated |
| 67 vs P3 | The compiler observation now appears in two places doing the same work | **Open** — P6 asks which one moves |
| 25 vs canonical bond | The cost table's row "Nothing, since the bond is weak / Full price, no coverage" treats any weak bond as waste. The canonical definition makes bond strength proportional to the consequence of bypass, so a weak bond on a low-consequence boundary is correct | **Open** — P11 asks whether to restore the proportionality or declare a stricter reading |

## Gaps

| # | What is missing | Status |
| --- | --- | --- |
| G1 | An estate that defends a high count | **Closed** by P3 (Monzo, engaged rather than dismissed) |
| G2 | Engagement with "count is the wrong metric" | **Closed** by P1 (Newman conceded) |
| G3 | Answers to technology choice and contained blast radius, both promised in the intro | **Closed** by P3, which handles all three surviving justifications |
| G4 | A worked census | **Moot** — the post no longer prescribes a census |
| G5 | A prescription for in-process authority | **Closed** by P8 |
| G6 | A floor on the recursion | **Closed** by C90 — subdivision stops where nobody can say what the next boundary buys |
| G7 | *New.* The post now has two endings and two openings competing | **Open.** See Open decisions #2 |

## Structure options

Deferred by author: the objections were to shape the draft through discussion
rather than be slotted into a pre-chosen shape. That has now happened, and the
shape question has changed as a result — the new section is large enough that
the real question is where it sits, not whether to add an objections block.

### Option A — New section stays where it is

After the cost machinery, before the authority-count material. Reader gets the
three tests, then the case that passes all three. Costs: the post's strongest
material sits at roughly the 40% mark, and the counts sections that follow are
now the weakest thing in the draft.

### Option B — New section opens the post

Lead with MIGHT vs WILL and "what is the test that proves the assumption?", then
build the three tests as the answer to what *does* justify a boundary.
Foregrounds the finding. Costs: the taxonomy has to be introduced after the
argument that depends on it.

### Option C — New section closes the post

Everything else becomes setup; the untestable justifications become the payoff,
replacing "Decomposing on Evidence" as the destination. Costs: the practical
checklist either moves or goes.

### Recommended

Not yet. This depends on Open decision #1, which is not mine to make.

## Open proposals

| # | Section | What it proposes | Resolves |
| --- | --- | --- | --- |
| P1 | Intro | Reframe away from arithmetic; concede Newman | C3, G2 |
| P2 | The Boundary Should Cost What It Protects | Insurance needs a claims process — distinguishes this from backups and DR | Overreach objection |
| P3 | **New section** — The Justifications That Survive Have No Test | The whole argument: steelman, MIGHT vs WILL, no test exists, the discipline point, availability inverted, technology choice, platform relocation | G1, G3, G6 |
| P4 | Reasons to Change Come From the Domain | The domain supplies no target; also flags C30 as an unsourced claim about a literature | C30–C33 |
| P5 | Uber Ran the Census | Uber is evidence of symptoms, not of a ratio | C37, C81 |
| P6 | Coupling Moves From the Compiler | Structural note: this paragraph and P3 now say the same thing twice; decide which moves | Tension 67 vs P3 |
| P7 | Before Creating the Next One | Replaces the census bullet with "name what it buys, then describe the exercise that shows it working" | C77, tension 77 vs 52/54 |
| P8 | For the Estate You Already Have | Adds "move an authority in-process before moving it anywhere else" | G5, C27 |
| P9 | Closing line | Replaces the ratio ending | C81 |
| P10 | Contour Draws the Line, Bond Enforces It | Restores the canonical definition of behavioral coherence (decisions, facts, **and** behaviors) and adds the missing cross-link to the post that defined the terms | C15, C16 |
| P11 | Contour Draws the Line, Bond Enforces It | Restores bond as proportional to the consequence of bypass, and flags the cost-table row that depends on the binary reading | C17, C25 |

Markers remaining: **11**. `/refine-prose` runs when this reaches zero.

## Open decisions

| # | Decision | Status |
| --- | --- | --- |
| 1 | **What completes the thesis.** Author's words: "better but not complete." The current statement covers what does *not* justify a boundary past the three tests. What it does not yet say is what the post wants the reader to *do* differently, in one sentence | Open |
| 2 | Structure: does the new section open, sit mid-post, or close it (Options A/B/C) | Open |
| 3 | Whether the counts sections survive at all. With the arithmetic retired, "The Number of Authorities a Business Has Is Bounded" and "Why the Count Grows Past the Census" are the weakest remaining material, and the second is ~700 words of mechanism for a phenomenon the post no longer measures | Open |
| 4 | Whether the compiler passage moves up into P3 or P3 cites it in place (P6) | Open |
| 5 | Whether to cut or source C30, C44, C46. The 11-system co-evolution study is available if external support is wanted | Open |
| 7 | Whether this post restates the contour/bond definitions at all, or cites the earlier post and moves straight to what is new here. Restating them invites exactly the drift P10 and P11 found | Open |
| 6 | The title. "Most Microservices Are Not Services" was written against the taxonomy. The post now argues something closer to "most boundaries cannot say what they buy." Out of scope for this pass — flagged for `/review-publishable` | Deferred |
