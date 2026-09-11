# Shaping Plan: A Proxy Is Infrastructure Until It Makes a Decision

Draft: `_drafts/a-proxy-is-infrastructure-until-it-makes-a-decision.md`
Status: Shaping
Standard: [.claude/commands/shape-post-draft.md](../.claude/commands/shape-post-draft.md)

5,500 words, 22 headers. This plan exists to make the argument readable at a glance.

## Thesis

A gateway and a mesh sidecar are one pattern at two addresses, so a single test governs both: a proxy earns its place doing mechanical work with operational needs the surrounding services don't share, and forfeits it the moment a service starts trusting it to decide something only the service could know.

Author confirmed: Not yet

## The argument spine

The claims the thesis actually rests on, in order. Everything else supports these.

1. **C2** — Gateway and mesh are the same pattern at two addresses, not two technologies.
2. **C5** — Therefore adopting either *as a category* is the wrong question; the product name bundles a dozen unrelated capabilities.
3. **C7** — Half one of the test: a capability is mechanical when it has no opinion about the business.
4. **C10** — Half two: mechanical alone doesn't earn a tier. An operational need the surrounding services don't share does.
5. **C13** — Why the tier takes *proxy* form specifically: a library needs one language, one version, one redeploy. A proxy needs none of them.
6. **C15** — The removal test: losing convenience is a trade, losing judgment isn't, because the service was never making that judgment.
7. **C19** — The redundancy test: the moment a service stops checking because the proxy already did, the copy became the original.
8. **C30** — Centralizing a check doubles the audit surface rather than shrinking it.
9. **C44** — Transport-layer retry-safety and operation-layer retry-safety are different guarantees.
10. **C55** — Clearance is not need-to-know. A token and an mTLS cert are both clearances.
11. **C54** — Every failure in the post is one failure: proof of passing a checkpoint treated as proof of permission.
12. **C62** — A capability passes the test at adoption and drifts afterward, one attribute at a time.
13. **C64** — So the test has to be something a capability keeps passing, not passes once.
14. **C65** — Separate axis: whether the capability should exist at all, independent of where it sits.

Claims 10, 11, 12 are where the post stops describing and starts contributing. Claim 8 is the least obvious and the most defensible.

## Claim inventory

| # | Claim | Tag |
| --- | --- | --- |
| 1 | Gateways and meshes are marketed as separate technologies for separate problems | Supporting |
| 2 | Both are one pattern (proxy absorbing a cross-cutting concern) at two addresses | Load-bearing |
| 3 | One test decides both: mechanical + independent need, vs deciding what only the service knows | Load-bearing |
| 4 | North-south arrives from outside; east-west moves between internal services | Supporting |
| 5 | Adopting either as a category is the wrong question; the bundle has no clean yes/no | Load-bearing |
| 6 | The decision happens one capability at a time, asked identically per product | Load-bearing |
| 7 | Mechanical = no opinion about the business; operates on bytes, connections, status codes | Load-bearing |
| 8 | A proxy can do mechanical work without deserializing the body | Supporting |
| 9 | Mechanical alone doesn't justify a tier; plenty runs fine in app code | Load-bearing |
| 10 | A tier is earned by needing to scale, fail, or change on its own schedule | Load-bearing |
| 11 | A dedicated tier need not be a proxy; a library can be equally mechanical | Supporting |
| 12 | Netflix's Hystrix and Ribbon worked this way as JVM libraries | Supporting, **unsourced** |
| 13 | A library needs one language, one version, one redeploy; a proxy needs none | Load-bearing |
| 14 | A polyglot fleet is what buys a proxy over a library | Load-bearing |
| 15 | Removal test: losing convenience is a trade, losing judgment is not | Load-bearing |
| 16 | Redundancy test: is the check a copy of a verdict, or the only place it's reached? | Load-bearing |
| 17 | Rejecting an expired token is redundant in the useful sense | Supporting |
| 18 | Blocking on plan tier fails once the domain stops checking | Supporting |
| 19 | When a service stops checking because the proxy did, the copy became the original | Load-bearing |
| 20 | Edge table: ten features sorted against the test | Supporting |
| 21 | Aggregation is presentation logic, not routing | Load-bearing |
| 22 | One gateway serving three consumers holds three opinions about response shape | Supporting |
| 23 | Netflix's unified graph became the bottleneck; federation fixed it; gateway retained | Supporting, **unsourced** |
| 24 | A single frontend with its own cadence is a legitimate BFF, owned as a service | Supporting |
| 25 | Verifying a token is fine; deciding who may cancel *that* order needs domain data | Load-bearing |
| 26 | A gateway doing so becomes the authority the order service should have been | Load-bearing |
| 27 | Tenant/feature gating is the common B2B form of the authorization mistake | Load-bearing |
| 28 | The defense is governance: centralize so no team forgets | Supporting (steelman) |
| 29 | It fails because entitlement needs plan, usage, ownership, sub-permissions | Load-bearing |
| 30 | It also doubles the audit surface; proving unreachability is the harder audit | Load-bearing |
| 31 | Forward-or-block is a routing fact, not a security fact, unless the domain enforces it | Load-bearing |
| 32 | A coarse check (no subscription, sandbox key) survives as fail-fast | Supporting |
| 33 | Early entitlement is genuinely simple, which is why the pattern looks successful | Supporting |
| 34 | Entitlement drifts toward attributes a route table cannot answer | Load-bearing |
| 35 | The gateway must then read domain data or keep a wrong approximation | Load-bearing |
| 36 | The choice was never governance vs none, but governance where the data is | Load-bearing |
| 37 | The same test produces a strikingly similar split in the interior | Load-bearing |
| 38 | "Two features worth more care than a table can show" | **Inaccurate — four follow** |
| 39 | Interior table: eight features sorted against the test | Supporting |
| 40 | Resending is mechanical; whether it's safe to resend is not | Load-bearing |
| 41 | A mesh cannot know whether the original request already processed | Load-bearing |
| 42 | Layered retries multiply traffic and turn a blip into an outage | Load-bearing |
| 43 | Tuning backoff and breaker thresholds needs dependency knowledge a default lacks | Load-bearing |
| 44 | Transport retry-safety and operation retry-safety are different guarantees | Load-bearing |
| 45 | Not an argument against mesh retries; the idempotency guarantee stays at the service | Supporting |
| 46 | A breaker counts failures, so something must classify what counts | Load-bearing |
| 47 | Classification belongs at the source, in status codes and error shapes | Load-bearing |
| 48 | Wrong classification cannot be fixed by threshold tuning downstream | Supporting |
| 49 | "A may reach B" is coarse network hygiene and a defensible layer | Supporting |
| 50 | A certificate proves identity, not permission for this operation on this data | Load-bearing |
| 51 | Percentage-based shifting has no opinion about who is calling | Supporting |
| 52 | Routing by customer tier is a business judgment about who absorbs risk | Load-bearing |
| 53 | The config looks identical; what changed is which attribute the rule reads | Load-bearing |
| 54 | Every failed feature failed the same way: checkpoint mistaken for permission | Load-bearing |
| 55 | Clearance is not need-to-know; token and mTLS cert are both clearances | Load-bearing |
| 56 | The edge and interior versions are the same mistake | Load-bearing |
| 57 | A compromised workload or stolen token clears either proxy | Supporting |
| 58 | Policy engines (ext_authz, OPA/Rego, Cedar, AuthorizationPolicy) are the sophisticated version | Load-bearing, **unsourced** |
| 59 | The rule still does not live where the data does | Load-bearing |
| 60 | The policy deploys on its own schedule, reviewed by proxy owners not domain owners | Load-bearing |
| 61 | Sophistication makes the same mistake harder to notice | Load-bearing |
| 62 | Capabilities pass at adoption and drift afterward, one attribute at a time | Load-bearing |
| 63 | Drift never triggers a new adoption conversation, because nobody re-adds a feature | Load-bearing |
| 64 | The test must be recurring, not one-time; a periodic pass over live config | Load-bearing |
| 65 | Whether a capability should exist at all is a separate axis from where it sits | Load-bearing |
| 66 | It earns a place by serving a named characteristic the system optimizes for today | Load-bearing |
| 67 | Istio built ambient mode to remove sidecar overhead after teams held off adopting | Supporting, **unsourced + partly inaccurate** |
| 68 | Unjustified adoption still costs the vigilance without the payoff | Supporting |
| 69 | Closing checklist: eight diagnostic questions | Practical artifact |

Load-bearing and unsupported: **58, 67**. Claim 67 is the weakest thing in the post.

## Source audit

| Source | Quoted accurately | Representative | Source's own conclusion |
| --- | --- | --- | --- |
| Netflix Hystrix / Ribbon (C12) | Yes, as characterized | Yes | Libraries, JVM-only, superseded. Consistent with the draft's use. |
| Netflix GraphQL federation (C23) | Yes | Yes | One Graph became a deployment bottleneck; federation distributed schema ownership; **the gateway was kept as a composer**. The draft says this correctly. |
| Istio ambient mode (C67) | **Partly** | **No** | Istio names *three* motivations (invasiveness, resource underutilization, traffic breaking). It never claims teams declined adoption over overhead. |
| Policy engines (C58) | Unverified | n/a | Product capabilities asserted with no citation. |

Conclusions running against the thesis: **none**. Netflix's end state keeps an aggregating gateway, which the draft handles correctly by distinguishing composition from owning the logic.

Claims needing a source and lacking one: **12, 23, 58, 67**. The draft carries zero links.

## Unreconciled tensions

| Claims | Conflict | What resolving it requires |
| --- | --- | --- |
| 39 vs 52, 53 | Interior table marks traffic shifting an unqualified "Yes. A deployment mechanic, not a business one," but an entire H3 shows it drifting into business judgment. Every other feature with a failure mode is marked "Conditional." | Change the cell to Conditional, or state why this one is different. |
| 37, 38 vs body | "Two features worth more care" precedes four H3s. The edge section makes the same claim and survives it; the interior does not. | Correct the count, or fold the circuit-breaker and traffic-shifting H3s under the two named features. |
| 20 vs 23, 24 | The edge table calls aggregation "Conditional, and usually no," but Netflix's successful end state is a gateway that aggregates. The real distinction is owning-the-logic vs mechanically-composing-it, and the table cell doesn't carry it. | Reword the cell to name composition-without-ownership as the passing case. |

## Gaps

| # | What is missing | Why the thesis implies it |
| --- | --- | --- |
| G1 | A capability that resolves *differently* at the two addresses | The thesis is that one test applies at both. Every example resolves the same direction at both, so a reader cannot tell whether the test discriminates or just says "no business logic anywhere" — a weaker and more familiar claim. |
| G2 | What to do about a proxy that has already drifted | C64 prescribes a recurring pass that *detects* drift. Nothing says how to move an entitlement system out of a route table people now depend on. |
| G3 | Citations | Four claims name external companies or products with no link, against a site standard that requires sources for industry and historical claims. |

## Structure options

The header tree already passes the outline test. These are adjustments, not restructures.

### Option A — Leave the structure, fix the defects

Correct the count in C38, change the traffic-shifting cell, weaken C67 to what Istio actually says, add citations. Foregrounds accuracy; costs nothing structurally; resolves all three tensions and G3. Leaves G1 and G2 open.

### Option B — Option A, plus close G1

Add a short section where one capability gets different verdicts at the two addresses. Response caching is the natural candidate: at the edge it is defensible when driven by origin cache-control headers; in the interior between two services it is nearly always wrong, because a sidecar caching a domain response is guessing at invalidation for data it does not own. Foregrounds the discriminating power of the test; costs ~300 words; resolves G1.

### Option C — Option B, plus close G2

Add remediation for already-drifted capabilities alongside the recurring check. Costs ~400 more words in a post already at 5,500.

### Recommended

**Option B.** The defects in Option A are non-negotiable, and G1 is the one gap that strengthens the central claim rather than extending it. G2 is real but this post is already long, and "how to unwind an entitlement system" is arguably its own post.

## Open proposals

| # | Section | What it proposes | Resolves |
| --- | --- | --- | --- |
| 1 | | | |

Markers remaining: 0. `/refine-prose` runs when this reaches zero.

## Open decisions

| # | Decision | Status |
| --- | --- | --- |
| 1 | Confirm the thesis statement above is what you meant | Open |
| 2 | Pick a structure option (A, B, or C) | Open |
| 3 | Traffic shifting: change the table cell, or justify the exception | Open |
| 4 | C67: weaken to Istio's actual three motivations, or drop the adoption-holdout clause | Open |
| 5 | Citations: add links for 12, 23, 58, 67, or cut the named references | Open |
| 6 | G2 (remediation for drifted capabilities): in this post or its own | Open |
