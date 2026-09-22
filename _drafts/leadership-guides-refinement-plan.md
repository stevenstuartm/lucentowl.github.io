# Leadership Study Guides Refinement Plan

Tracks the consolidation and review-and-refine pass over the three guides in the "Leadership & Team Management" category of `assets/data/study_guides_config.json`, all in `_guides/leadership/` after Phase 0. Guides are consumed sequentially, in config order, so no guide should add its own prerequisite framing or cross-links to siblings in scope.

**The process rules live in [`.claude/content/guide-refinement-standard.md`](../.claude/content/guide-refinement-standard.md); the checklist and cross-domain gotchas live in [`.claude/content/study-guide-guide.md`](../.claude/content/study-guide-guide.md).** Read both first. This document carries only what is specific to this pass.

## Phase 0: Consolidation (complete)

Collapsed "Team Leadership" and "Architecture Leadership" into one subcategory, **Engineering Leadership**, ordered dev team leadership, architecture leadership, decision-making. Team leadership is the general case and owns team-health diagnosis; architecture leadership builds on it with the architect's position of leading teams without managing them; decision-making closes as the architect's primary deliverable. `architecture-decision-making.md` moved to `_guides/leadership/`. A hiring guide was considered and declined.

## Sources

- Primary: Richards & Ford, *Fundamentals of Software Architecture* (O'Reilly; the architecture leadership and decision-making guides are largely derived from its chapters on decisions, leadership, and negotiation). Michael Nygard, "Documenting Architecture Decisions" (2011) and adr.github.io for ADR structure. Brooks, *The Mythical Man-Month*. Gawande, *The Checklist Manifesto*. Google SRE book (postmortem culture). DORA research (delivery metrics). Camille Fournier, *The Manager's Path* (team lead practice).
- Off-limits or unreliable: uncited productivity statistics (interruption recovery times, meeting costs) unless traced to the study they come from.

## Domain notes

**Item 7 (hierarchy and scope clarity)** in this domain means the scope of a decision or of authority: individual developer, team, cross-team/solution, domain, enterprise. A claim like "architect approves" only makes sense once the reader knows which scope the decision sits at.

**Item 9 (tag audit)** — measured across the 3 guides before the pass: `leadership` (2), `architecture` (2), `collaboration` (2), `fundamentals` (2), `decision-making` (2), and one each of `team-management`, `coaching`, `communication`, `adrs`, `trade-offs`, `documentation`, `practical`. So for this category: drop `leadership` (restates the category), treat `collaboration` and `communication` as filler, and replace with the specific practices each guide teaches.

## Topic ownership map

| Concept | Owner | Non-owners treat it as |
|---|---|---|
| New-lead onboarding, 1:1s, delegation, performance management | `leadership/dev-team-leadership-foundations.md` | architecture leadership: clause |
| Team dysfunction signals (process loss / Brooks's law, pluralistic ignorance, diffusion of responsibility) | `leadership/dev-team-leadership-foundations.md` | architecture leadership: clause where elastic leadership uses team size |
| Iteration ceremonies from the lead's seat, delivery metrics | `leadership/dev-team-leadership-foundations.md` | methodology mechanics stay in `sdlc/` guides (out of scope) |
| Incident leadership and blameless postmortems | `leadership/dev-team-leadership-foundations.md` | — |
| Architect's role expectations, breadth vs depth, hands-on coding and the bottleneck trap | `leadership/architecture-leadership-foundations.md` | dev team guide: clause (technical credibility) |
| Elastic leadership, architect personalities, the "room" of constraints, library decision tiers | `leadership/architecture-leadership-foundations.md` | decision-making: clause under delegation |
| Negotiation with stakeholders, architects, developers | `leadership/architecture-leadership-foundations.md` | scope negotiation during delivery: `sdlc/aaa-phase3-apply.md` (out of scope) |
| Meeting discipline and developer flow | `leadership/architecture-leadership-foundations.md` | dev team guide: clause |
| Checklists as a practice | `leadership/architecture-leadership-foundations.md` | — |
| Decision antipatterns, architectural significance, when to decide, reversibility | `leadership/architecture-decision-making.md` | architecture leadership: clause |
| ADR structure and purpose | `leadership/architecture-decision-making.md` | template itself: `_resources/adr-template.md` |
| Decision rights by scope, review boards, compliance verification | `architecture/governance.md` (out of scope) | decision-making, architecture leadership: clause |
| Architecture vs design spectrum, trade-off analysis, business goals → characteristics | `architecture/ArchitectureFoundations.md` (out of scope) | decision-making: clause |
| Team structures, team sizing, Ivory Tower antipattern | `sdlc/team-organization.md` (out of scope) | architecture leadership: clause |

## Domain gotchas

*(Empty at the start.)*

## Cross-guide facts in force

Verified during earlier rows; applies to every remaining guide that touches the topic.

- **DORA metrics** are five, not four: change lead time, deployment frequency, failed deployment recovery time (formerly MTTR), change fail rate, deployment rework rate (dora.dev/guides/dora-metrics).
- **Interruption cost**: the citable figure is Parnin & Rugaber (Software Quality Journal, 2011), 10-15 minutes before a developer is editing code again. The "15-20 minutes" and "23 minutes" figures should not be used without their own source.
- **Blameless postmortems**: the Google SRE book sets no deadline (no "within 48 hours"); it recommends agreeing on trigger criteria before incidents.

## Open pre-flags

Leads for rows not yet done. **A pre-flag is a lead, not a finding** — re-verify before acting. Delete the entry once its row is complete.

| Target row | Lead |
|---|---|

## Unverified, left standing

Claims on finished guides that could not be confirmed against a source. Each was softened rather than asserted; revisit if a source turns up.

- **Row 2, elastic leadership team size.** Guide gave "small (≤5)" and "large (>12)" thresholds; no accessible source confirmed the numbers attributed to *Fundamentals of Software Architecture*. Guide now describes small and large teams by behavior, without thresholds.

## Progress

| # | Subcategory | Guide | Status |
|---|---|---|---|
| 1 | Engineering Leadership | dev-team-leadership-foundations.md | Complete |
| 2 | Engineering Leadership | architecture-leadership-foundations.md | Complete |
| 3 | Engineering Leadership | architecture-decision-making.md | Complete |
