# Shaping Plan: Can We Agree API Change Semantics Should Be a Default?

Draft: `_drafts/api-change-semantics-should-be-default.md`
Status: Shaping — stance settled and structure rebuilt, prose pass not run
Standard: [.claude/commands/shape-post-draft.md](../.claude/commands/shape-post-draft.md)

4,545 words, 13 H2 sections. Was published at
`_posts/2026-07-09-api-change-semantics-should-be-default.md` and unpublished
on 2026-09-10 because the conclusion was not defensible. This plan holds the
source verification and the closed decisions so neither gets redone.

## Thesis

Partial-update ambiguity is not a gap in REST, because REST never specified
partial updates. It is a gap in the convention built on top, a convention that
cannot be repaired by adding discipline to it since not requiring discipline is
why it won. What is useful instead is sorting the thing people call REST into
the part carrying weight and the part that is only habit. Everything that
survives that sorting is HTTP rather than REST.

Author confirmed: Yes. Stated as "the only stance I think we can defend and not
be trying to convince ourselves of a solution to our own invented problem."

**Standing author position:** prefers RPC from the start. The post is
deliberately written as harm reduction for an audience that will not leave
REST, not as advocacy for it. Do not let a future pass soften this back into a
defense of REST.

## The argument spine

1. Four intents exist per field: leave alone, set, clear, change one collection element.
2. A CRUD PATCH body can express at most two of them unambiguously.
3. The cause is one URL serving as both query result and write target.
4. Nothing in HTTP or in Fielding requires read shape to equal write shape. The tooling pipeline requires it.
5. Therefore: GET returns a projection, writes go to separately addressed resources, and the aggregate URL returns 405.
6. The write surface carves on shared owner, authorization scope, and workflow.
7. Collections with per-element identity get their own endpoints. Transitions get named operations, and those are RPC.
8. What survives is the closed verb set, `ETag`/`If-Match`, and addressability, all of which are HTTP and none of which are REST.

## Source audit

Every row below was fetched and read during the 2026-09-10 pass. Quotes are
verbatim. A future session should not need to re-fetch these.

| Source | Finding | Verbatim |
| --- | --- | --- |
| RFC 7396 (Oct 2014) | Null means **removal**, not assignment. The draft's original "set explicitly, including null" intent was not expressible in the format it claimed compliance with | "Null values in the merge patch are given special meaning to indicate the removal of existing values in the target" |
| RFC 7396 | Concedes the collection case outright | "it is not possible to patch part of a target that is not an object, such as to replace just some of the values in an array" |
| RFC 5789 (Mar 2010) | Did **not** only leave a vacuum. It shipped format discovery, which the industry ignored alongside the formats | "Accept-Patch SHOULD appear in the OPTIONS response for any resource that supports the use of the PATCH method" |
| RFC 5789 | Points at conditional requests itself, which anchors the concurrency section | "PATCH is neither safe nor idempotent," with `If-Match` named as the remedy |
| Fielding, dissertation ch. 5 | Supports the projection premise, but only as *absence of a requirement*. He does not affirmatively endorse read/write asymmetry. Do not overstate | "Any information that can be named can be a resource" |
| GitHub labels API | Supports hoisting, but retains `PUT .../labels` for replace-all. An earlier draft claim that "no request means replace the whole set" was inaccurate and is removed | `POST .../labels`, `DELETE .../labels/{name}`, `PUT .../labels` |
| Stripe subscription items | Stronger than the draft originally claimed. Items are top-level, not nested | `/v1/subscription_items/{id}` |

### Counterpositions found (published, not manufactured)

**Google AIP-134** is the direct published contradiction of the projection
argument and the post engages it in "What the RPC World Does Instead."

- "The method **should** support partial resource update, and the HTTP verb **should** be `PATCH`"
- "The response message **must** be the resource itself"
- Treats an omitted mask as "an implied field mask equivalent to all fields that are populated," which is presence inference by another name

The engagement the post uses: AIP-134 needs `OUTPUT_ONLY` annotations from
AIP-203 to mark read-but-not-writable fields. That concedes the same read/write
asymmetry and expresses it in field annotations rather than URLs. Annotations
are protobuf-native with no plain JSON or OpenAPI equivalent, so a REST team
importing the approach rebuilds a private annotation system its tooling cannot
read.

## Decisions closed this pass

Recorded so they are not reopened. Each was argued through and settled.

| # | Decision | Resolution |
| --- | --- | --- |
| 1 | Three candidate directions: reject REST outright, double down on the original two defaults, or hoist-and-PUT | All three rejected in favor of the sorting stance, which subsumes the third |
| 2 | Reject-REST-outright was ruled out | It duplicates and contradicts `_posts/2025-09-27-rest-vs-rpc-domain-driven-architectures.md`, which reserves REST for entity-driven systems |
| 3 | Three intents or four | Four. Separating "set" from "clear" is what RFC 7396 forces |
| 4 | Fate of the `Specified<T>` presence wrapper | Demoted from co-equal default to one sentence of legacy remediation. It is a transport for intent the client must already hold, not a fix |
| 5 | The "ships as an ordinary backend deploy with no client coordination" claim | Removed. It is false and destructive: the change flips existing `{"phoneNumber": null}` traffic from no-op to silent clear, and serializing nulls is the default in several mainstream stacks |
| 6 | Lost updates as an argument for PATCH | Rejected and given its own section. It is a concurrency problem answered by `ETag`/`If-Match`. A narrowed race is still a race |
| 7 | Whether the design is "just RPC" | Conceded for transitions, held for the rest. The closed verb set, conditional requests, and addressability are real and are HTTP |
| 8 | Cross-post contradiction on sub-resources | Resolved in the DDD post by correcting the bullet label to "Breaking **transitions** into sub-resources" and adding the identity-versus-transition boundary. Both posts now state the rule self-containedly, since the blog guide forbids inter-post links |
| 9 | Publication state | Unpublished to `_drafts/`. Restoring the original URL requires the exact filename `_posts/2026-07-09-api-change-semantics-should-be-default.md`. The `date:` front matter is retained as the only record of that |

## Unreconciled tensions

| Conflict | What resolving it requires |
| --- | --- |
| The post narrows the entity-driven carve-out that the DDD post grants to REST. If the narrowing is stated too broadly, this post becomes a rerun of that one | The separation that holds: the DDD post argues REST does not fit *domain operations*; this post shows the *entity-driven* case leaking from the inside. Keep "What Survives Is HTTP" sharp on that or the distinction collapses |
| The title asks a question the post now answers with a heavy qualifier | See Open decisions #1 |
| "The Transitions Are RPC" and "What Survives Is HTTP" both argue the RPC-in-spirit point | Currently scoped apart (one about transitions, one about the whole). Watch for redundancy on the next read-through |

## Gaps

| # | What is missing | Notes |
| --- | --- | --- |
| G1 | No worked example of the projection and write surface as a complete API, only fragments | May not be needed. Would add length to a post already at 4,545 words |
| G2 | Nothing on how a client discovers which URL owns which field | Static `Link` relations from the projection would cover it. This is the one job hypermedia does well, and the DDD post is skeptical of hypermedia generally, so any addition must refine rather than contradict that |
| G3 | No migration story for moving a live wide-PATCH API to the projection model incrementally | The remediation section covers surviving in place, not moving |

## Open proposals

No `PROPOSED` markers in the draft. Everything proposed during the pass was
either accepted into the prose or recorded as closed above.

## Open decisions

| # | Decision | Status |
| --- | --- | --- |
| 1 | Title. The current one asks a yes/no question the post answers as "yes, and it costs most of what you mean by REST." May want to name the sorting instead | Open |
| 2 | Whether the AIP-134 section is the right length, given it is the strongest objection and currently gets four paragraphs | Open |
| 3 | Whether "If You Already Shipped the Wide PATCH" stays at its current length or compresses, since it is remediation inside an argument post | Open |
| 4 | Whether to fill G2, and if so whether it reopens the hypermedia position in the DDD post | Open |
| 5 | Republish target date and whether the original 2026-07-09 URL is restored or a new date is used | Open |

## Before publishing

`/refine-prose` has not been run on this draft. Mechanical checks pass as of
2026-09-10 (no AI-tell phrases, no em-dashes, no filler "real", no bare
external links), but roughly half the prose is new since the last narrative
review and the whole frame changed.
