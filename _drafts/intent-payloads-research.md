# Research: Intent vs. State in API Change Payloads

Status: RESEARCH ONLY, no thesis and no post draft yet.

Structure (fixed basis for all future work on this topic):
1. Statement of the overall problem
2. Review of use cases
3. Review of each known solution (pros/cons)
4. Comparison matrix (conclusion only, not a substitute for 1-3)

---

## 1. Statement of the Overall Problem (DRAFT)

When a client wants to change server-held state over a network boundary, a single
request must be able to communicate three distinct kinds of intent, not just new
values:

- **Leave alone**: this field/relationship is not part of the change.
- **Set explicitly**: including setting to null, empty, or zero, which must be
  distinguishable from "leave alone."
- **Add/remove within a collection or relationship**: without requiring the
  client to resend the full collection to change one element.

Most mainstream payload conventions cannot express all three unambiguously:

- Whole-resource PUT collapses "leave alone" into "set explicitly." The client
  must resend the full current state, or risk clobbering fields it didn't mean
  to touch.
- Flat POST/PATCH-as-partial-object payloads usually can't distinguish "field
  omitted" from "field explicitly cleared," because most JSON serializers treat
  absent keys and null the same way (or drop nulls entirely by default).
- Collection-valued fields are normally replace-only: adding one item to a list
  of 500 requires resending all 500, or the client's view of the other 499 must
  be trusted to be current and complete.

That last point is sharper than mere inconvenience: it's the classic
**lost-update problem**. Client A fetches, Client B fetches, B
writes, A (holding stale full state) writes back and silently overwrites B's
change. Any solution that requires the client to hold and resend full current
state is exposed to this under concurrent writers.

So the problem is not just how to express partial updates. It's:

> How can a client communicate change-intent to a server with fidelity for
> no-op vs. explicit-clear vs. add/remove-from-collection, without requiring
> the client to hold and resend the full current state, and while remaining
> tractable when multiple writers act concurrently?

Open question to resolve before moving to use cases: do we treat "concurrent
writers" as in-scope for the core problem, or as a separate, harder problem
that only some solutions attempt to address? (JSON Patch and LDAP Modify
largely don't address it; Kubernetes server-side apply and CRDTs do.) Keeping
these separate avoids re-collapsing axes we already agreed to keep distinct.

### Note: versioning (OCC) is cross-cutting, not a fifth axis

Optimistic concurrency control is extremely common, including version
numbers, ETags/`If-Match` (RFC 7232), Kubernetes `resourceVersion`, and Git's
parent-hash chain. It directly touches the concurrent-writer axis above, but
it should not be treated as one more competing solution alongside JSON Patch,
FieldMask, etc. It solves a narrower and different problem:

- It is a **detection** mechanism, not a **resolution** mechanism. It turns a
  silent lost-update into an observable conflict (409/412); it does not merge
  anything or tell the server what changed. The client (or a human) still
  decides what happens next.
- It is **orthogonal** to payload format: a version check can sit under a
  full-object PUT, a JSON Patch, or a FieldMask update equally well.
- It has its own **granularity spectrum**, independent of the four axes:
  whole-resource version (cheap, blunt, prone to false conflicts when two
  writers touch unrelated fields) → field/path-level ownership (finer-grained,
  more machinery; this is part of why Kubernetes server-side apply exists,
  not just `resourceVersion` alone) → CRDT-style commutative merge (no
  rejection at all, requires operations designed to be mergeable up front).

Implication: when we review each solution in Section 3, we should note
separately (a) what intent it can express, and (b) whether/how it layers
concurrency detection. These are independent properties of each technology,
not one combined score.

---

## 2. Use Cases (DRAFT)

Each case below is chosen because it stresses the axes differently. The goal
is coverage of distinct pressures, not an exhaustive list. Axis key: (1)
omission ambiguity, (2) nested/collection targeting, (3) concurrent-writer
reconciliation, (4) client staleness/shape.

1. **Flat scalar partial update.** E.g., change a user's email without
   touching other profile fields, including the case of clearing a nullable
   field (middle name) rather than leaving it alone. Stresses (1) almost
   exclusively. The "textbook" case, deceptively the easiest and the one
   most API conventions actually handle adequately.

2. **Nested object partial update.** E.g., update the shipping address
   embedded in an order without resending the whole order. Stresses (1) and
   (2) together, requiring addressing *into* a structure, not just at its
   top level.

3. **Large collection membership change.** E.g., add one member to a
   10,000-member group, remove one item from a long list, without resending
   the collection. Stresses (2) hard, and (4) if the client would otherwise
   need the full collection just to compute a diff. Real examples: LDAP
   group membership, Kubernetes list-field patches, GitHub's issue-labels
   endpoints.

4. **Delta/atomic scalar operations.** E.g., decrement inventory by 1,
   increment a view counter, where the operation itself, not the resulting
   value, is the unit of intent. Distinct from case 3: this isn't about
   collection membership, it's about a scalar field where "add 1" is
   inherently commutative and order-tolerant under concurrent writers.
   Stresses (3) directly, and does so *without* needing OCC/versioning at
   all. That suggests intent-encoding can sometimes sidestep the concurrency
   problem rather than merely detect it. Real
   examples include SQL `UPDATE t SET qty = qty - 1`, Redis `INCR`, and
   DynamoDB update expressions.

5. **Directory/identity attribute management.** E.g., adding/removing a
   phone number from a multi-valued LDAP attribute, at directory scale,
   from many concurrent admin tools. Overlaps with case 3 but carries extra
   constraints that keep it separate: schema-enforced attribute types, a
   non-JSON/non-HTTP wire protocol, and it's the *original*, oldest
   documented use case in this whole space (predates REST).

6. **Wire-level presence loss in strongly-typed RPC.** E.g., protobuf proto3
   historically had no field presence for scalars, so "set age to 0" and
   "don't touch age" were indistinguishable at the wire level regardless of
   payload convention. Distinct from case 1: the ambiguity isn't a payload
   *design* choice, it's forced by the type system/serialization format
   itself. This is the case FieldMask exists to patch over.

7. **Multi-actor declarative reconciliation.** E.g., a Kubernetes Deployment
   where a human sets some fields via kubectl and an autoscaler controller
   sets `replicas` independently, ongoing rather than a single
   request/response. Stresses (2) and (3) simultaneously, and unlike cases
   1-6 there is no single "client": multiple independent writers own
   different fields of the same object indefinitely.

8. **Bulk sync / replication between systems.** E.g., nightly CRM contact
   sync, database replication, change-data-capture streams (Debezium/Kafka
   Connect). Stresses (2) and (4) at volume: the exchange must express many
   discrete adds/removes/updates efficiently, not one field at a time.

### Caveat: some of this is a resource-modeling problem, not a payload problem

Several real APIs sidestep case 3 entirely by giving the collection its own
addressable sub-resource instead of solving generic patch semantics on the
parent, such as GitHub's `/issues/{id}/labels`, Stripe's subscription items,
and `/repos/{id}/collaborators/{user}`. Scalar fields go through PATCH on the
parent; membership changes go through POST/DELETE on a dedicated
sub-resource endpoint. This is a legitimate, widely-used alternative lever,
**REST resource shape** rather than payload grammar, and it fully resolves
case 3 for that subset of use cases without needing JSON Patch, FieldMask, or
anything else. Section 3 keeps it distinct so we don't credit or blame a
payload format for something actually solved by API modeling.

## 3. Per-Solution Review (DRAFT)

Two solutions were added to the original candidate list, surfaced directly by
Section 2: **delta/atomic operations** (from case 4) and **REST resource
hoisting** (from the case-3 caveat). Both are legitimate, widely-documented
answers to parts of the problem and belong here on equal footing with the
payload-format solutions. Leaving them out would bias the eventual matrix
toward "generic patch grammar" as the only valid strategy, which Section 2
already showed isn't true.

Per our Section 1 decision, each entry separates **what intent it expresses**
from **how/whether it layers concurrency detection**. These are independent
properties, not one combined score.

### JSON Patch (RFC 6902)
**What it is:** An array of operations (`add`/`remove`/`replace`/`move`/`copy`/`test`),
each targeting a JSON Pointer (RFC 6901) path into the document.

- **Axes:** (1) solved explicitly: `remove` and `replace`-with-`null` are
  distinct ops. (2) solved well: paths address any node, including array
  indices and `-` for append, so element-level collection edits work without
  full replace. (4) reduced but not eliminated: the client still needs to
  know the *shape* of the document to address into it, even without holding
  full current values.
- **Concurrency:** no built-in reconciliation, but the `test` op provides
  fine-grained, path-level preconditions *inside the same request*, asserting
  "path X currently equals Y" before applying other ops atomically. This is
  a genuinely fine-grained OCC primitive, closer to the field-level end of
  the granularity spectrum than a single whole-resource version number.
- **Pros:** generic and standardized; explicit per-op intent; handles arrays
  properly; `test` gives conditional application without a separate ETag
  mechanism.
- **Cons:** client must compute the op list (diffing cost lands on the
  client); array-index ops are fragile if the array shifts between diff
  computation and application, unless paired with `test`; weak support in
  OpenAPI/codegen tooling relative to plain JSON bodies; low readability in
  logs compared to a flat body.

### JSON Merge Patch (RFC 7396)
**What it is:** Send a partial object; present keys overwrite, `null` deletes
the key, objects merge recursively, everything else (including arrays) is
replaced wholesale.

- **Axes:** (1) partially solved: `null` is the delete sentinel, which means
  the format cannot express "set to null" as distinct from "delete," a real
  expressiveness gap. (2) solved for nested *objects* only; arrays get no
  element targeting at all, which is exactly how it fails on cases 3 and 8.
- **Concurrency:** none built in; layered with ETag like any other body.
- **Pros:** extremely simple to construct and read, "just the fields you
  want to change"; near-universal tooling since it's plain JSON.
- **Cons:** null/delete conflation; arrays are all-or-nothing, so it fails
  large-collection and bulk-sync use cases outright.

### HTTP PATCH (RFC 5789)
**What it is:** The HTTP verb itself, "apply a described set of changes,"
with no mandated payload format. It exists precisely so JSON Patch and Merge
Patch (and others) could be defined as content-types on top of it. Not
scored against the axes; it enables but doesn't solve anything on its own.

### LDAP Modify (RFC 4511, dating to X.500/LDAPv3)
**What it is:** A modify operation is a list of `{add|delete|replace,
attribute, values[]}` tuples applied atomically to a directory entry.
Multi-valued attributes are native to the data model.

- **Axes:** (1) fully solved by design: three explicit verbs per attribute,
  no ambiguity possible. (2) solved for multi-valued attributes (add/delete
  individual values) but the axis barely applies otherwise, since LDAP's data
  model is flat attribute-value entries, not arbitrary nested documents.
- **Concurrency:** no standardized general OCC; some implementations offer
  assertion controls for conditional modify, but it's not universal the way
  ETags are for HTTP.
- **Pros:** oldest and most battle-tested entry here, with decades at
  directory scale; intent is expressed at the protocol level, not bolted
  onto a generic document format.
- **Cons:** flat data model doesn't generalize to arbitrary nested web
  resources; binary ASN.1 (BER) wire protocol, invisible to most web
  developers and requiring an entirely different client stack; narrow domain.

### Protobuf FieldMask
**What it is:** A `google.protobuf.FieldMask` message, a list of field
paths, sent alongside a (partial) message; the server applies only the
paths listed, ignoring unlisted fields regardless of their value.

- **Axes:** (1) solved: the mask is what distinguishes "included at
  zero-value" from "not part of this update," directly patching over case 6
  (proto3's lack of scalar presence). (2) weak: repeated fields (protobuf's
  arrays) are typically masked as a whole list; there's no standard
  per-element path syntax, so it mostly punts on collection-element
  targeting, similar to Merge Patch.
- **Concurrency:** none built in; Google Cloud APIs commonly pair this with
  an `etag` field on the resource, the same layered pattern as ETag/If-Match.
- **Pros:** directly and cleanly solves the presence-loss problem it targets;
  production-proven across Google Cloud APIs and gRPC services generally;
  mask and value travel separately, so paths can be schema-validated.
- **Cons:** two things to keep in sync (the partial message and the mask),
  a recurring source of client bugs; Google's own API design guidance flags
  documented ambiguity in masking repeated/map fields.

### OData PATCH / delta payloads
**What it is:** OASIS standard, heavily used in enterprise/.NET ecosystems.
PATCH semantics resemble Merge Patch. Separately, OData defines a "delta
payload" format (`odata.delta`) for servers to tell clients what changed
since their last sync, with added/updated/deleted entries and explicit
`@removed` annotations.

- **Axes:** PATCH side inherits Merge Patch's weaknesses (1 partial, 2 weak
  for arrays). The delta-payload side is a documented answer to case 8
  (bulk sync), but the direction is reversed: server-to-client change
  feed, not client-to-server mutation request. Same underlying problem
  (representing change generically), opposite direction.
- **Concurrency:** ETags and `If-Match` are first-class, spec-defined parts
  of OData PATCH, not bolted on afterward the way most REST APIs do it.
- **Pros:** OCC is native to the spec; delta payloads are a standardized
  solution to bulk sync; strong tooling in Microsoft-adjacent
  ecosystems.
- **Cons:** PATCH itself doesn't improve on Merge Patch's array problem;
  adoption is narrow outside enterprise/.NET; delta payload and mutation
  PATCH are two separate mechanisms, not one unified answer.

### Kubernetes strategic merge patch + server-side apply
**What it is:** Two generations. Strategic merge patch recognizes
schema-annotated "merge keys" for certain list fields (e.g., containers
merge by `name`, not array index), enabling per-element list patches
without full replace. Server-side apply (GA since 1.22) tracks field
*ownership* per manager, so multiple controllers can co-own different
fields of the same object, with conflicts surfaced when two managers set
the same field differently.

- **Axes:** (1) solved. (2) the most complete answer in this whole survey,
  purpose-built for exactly case 3/case 7. (3) solved directly by
  server-side apply's field-manager model: sub-resource-path
  ownership and conflict detection, not whole-resource versioning.
- **Concurrency:** this is the fine-grained end of the granularity spectrum
  from Section 1: the only entry here with true field-level ownership
  rather than a version number or an ETag.
- **Pros:** purpose-built for multi-actor declarative reconciliation
  (case 7); clean list-element targeting via merge keys; field ownership
  avoids the false-conflicts problem whole-resource versioning has.
- **Cons:** merge-key annotations are schema-specific, so the API type must
  declare them and this doesn't transfer to arbitrary REST APIs without
  equivalent schema work; server-side apply's manager/ownership/conflict
  model adds substantial conceptual overhead for a typical CRUD API; proven
  mostly within Kubernetes's own API machinery, not broadly adopted as a
  general web API convention (though the underlying idea is portable).

### GraphQL mutations
**What it is:** Not a generic patch grammar. Each mutation is a
hand-authored named operation with its own input type. Whether "field
absent from input" and "field explicitly null" are distinguishable depends
entirely on schema/resolver design (e.g., tri-state wrapper types, or a
resolver checking argument presence). It's possible, not automatic.

- **Axes:** (1) possible with deliberate resolver discipline, not free from
  the type system the way FieldMask forces it. (2) solved the same way REST
  resource hoisting solves it: by hand-authoring a dedicated mutation per
  collection operation (`addLabelToIssue`, `removeCartItem`). (4) is
  GraphQL's genuine strength: query-side shape control means the client
  never needs full-resource state to safely mutate a slice of it.
- **Concurrency:** nothing in the spec itself; entirely bespoke per API if
  wanted.
- **Pros:** explicit, self-documenting, strongly typed per operation;
  naturally avoids case 3 the same way resource hoisting does; the read-side
  shape-control win holds, even though (per our earlier correction) it
  doesn't automatically solve the write-intent problem.
- **Cons:** a mutation (often plus an input type) per use case is the same
  combinatorial cost as REST endpoint proliferation, just moved into the
  schema; omission-vs-null handling isn't uniform across GraphQL server
  implementations; no standardized concurrency story.

### Delta/atomic operations (surfaced by case 4)
**What it is:** Express "apply this commutative operation to whatever the
current value is" instead of "set the field to X." Examples include SQL
`UPDATE t SET qty = qty - 1`, Redis `INCR`/`DECR`, DynamoDB `ADD` update
expressions, and CRDT counters (G-Counter/PN-Counter).

- **Axes:** (1) and (2) largely don't apply; this targets always-present
  numeric/counter fields, not optional or collection-valued ones. (3) is the
  standout: commutative ops **sidestep** concurrency conflict rather than
  detect it (OCC) or reconcile it with machinery (field ownership). Two
  concurrent decrements both simply apply correctly, no version check
  needed.
- **Concurrency:** solved by construction, for the narrow set of operations
  that are actually commutative. This is the "sidestep" strategy flagged at
  the end of Section 2, distinct from both detection and merge.
- **Pros:** no read-before-write round trip; no OCC bookkeeping; correct
  under arbitrary concurrency for the operations it supports; extremely
  mature (SQL and Redis both decades old).
- **Cons:** only works where the operation is genuinely commutative; "set
  to this exact string" isn't; doesn't generalize to arbitrary field
  updates; orthogonal to the other axes rather than a general answer to
  intent expression.

### REST resource hoisting (surfaced by the case-3 caveat)
**What it is:** Instead of solving generic patch semantics on a parent
resource, model the collection as its own addressable sub-resource with its
own endpoints: POST to add a member, DELETE a specific member. GitHub
issue labels, repo collaborators; Stripe subscription items.

- **Axes:** (2) fully solved for the specific collection, by construction,
  with zero payload-format cleverness. (1)/(3) untouched: says nothing
  about scalar-field clearing or concurrency. (4) improved for that slice,
  since no full-collection resend is needed, though the client still must
  know the identity of the item being added/removed.
- **Concurrency:** ordinary per-item OCC (an ETag on the individual member)
  applies more naturally here than on a whole parent collection, since the
  unit of concurrency control matches the unit of change.
- **Pros:** no new wire format at all, a pure API-design decision that
  works with any framework and is already instinctive to most experienced
  API designers.
- **Cons:** only solves collection membership, and only when the collection
  is "resource-like" enough to deserve its own endpoint; doesn't touch
  cases 1, 4, 5, 6, 7, 8 at all; can produce endpoint proliferation; gets
  awkward when the collection is nested several levels deep.

## 4. Comparison Matrix (DRAFT)

This is a conclusion to Sections 1-3, not a replacement for them. Cell
labels are shorthand for the fuller pros/cons already written above.

A fifth column (**Lever**) is included because Section 3 kept surfacing
solutions that aren't the same *kind* of thing: some are wire-format
grammars, some are resource-shape decisions, some are operation-semantics
choices. Scoring them on the four axes alone would silently imply they
compete on the same terms, which they don't.

| Solution | Lever | Axis 1: Omission | Axis 2: Collection targeting | Axis 3: Concurrency | Axis 4: Client shape/staleness | Best-fit cases |
|---|---|---|---|---|---|---|
| JSON Patch | Payload grammar | Solved | Solved (index-fragile) | Detect: in-band (`test` op) | Partial | 1, 2, 3 |
| JSON Merge Patch | Payload grammar | Partial (null=delete) | Weak (arrays replaced) | None (external only) | Partial | 1, 2 (shallow) |
| HTTP PATCH | Enabling verb | N/A | N/A | N/A | N/A | enabler only |
| LDAP Modify | Protocol-native op | Solved | Solved (flat attrs only) | None standardized | Solved | 5 |
| Protobuf FieldMask | RPC-schema mechanism | Solved | Weak (repeated fields as whole) | None (commonly layered w/ etag) | Partial | 6 |
| OData PATCH | Payload grammar | Partial | Weak | Detect: native (spec ETag/If-Match) | Partial | 1, 2 (shallow) |
| OData delta payload | Protocol-native (server→client) | Solved (per entry) | Solved (per entry, reversed direction) | N/A (read-side feed) | Solved | 8 |
| K8s strategic merge + server-side apply | Protocol-native + resource-modeling hybrid | Solved | Solved (most complete, merge keys) | Reconcile: field ownership | Solved (for managed fields) | 3, 7 |
| GraphQL mutations | Schema-design lever | Possible (not automatic) | Solved (hand-authored per case) | None in spec (bespoke) | Solved (read-side) | 3 (via dedicated mutations) |
| Delta/atomic operations | Operation-semantics lever | N/A | N/A | Sidestep: commutative | N/A | 4 |
| REST resource hoisting | Resource-modeling lever | N/A | Solved (for that collection) | N/A (per-item OCC fits naturally) | Improved (for that slice) | 3 |

**Legend:** *Solved* = fully addresses the axis as scoped in Section 1-2.
*Partial* = addresses some but not all of the axis's cases. *Weak* =
technically possible but breaks on the common case (e.g., large arrays).
*N/A* = axis doesn't meaningfully apply to this lever. Axis 3 uses three
different verbs deliberately, **Detect**, **Reconcile**, and **Sidestep**,
because these are structurally different strategies, not points on one scale
(see Section 3 notes on Kubernetes vs. delta operations).

### What the table shows (observations only, no thesis)

- **No single entry solves all four axes.** The closest is Kubernetes
  server-side apply, and it does so by combining a resource-modeling
  convention (merge keys) with protocol machinery (field ownership). It
  isn't a payload format at all in the sense JSON Patch is.
- **Axis 3 is not one spectrum.** Detect (OCC/ETag), Reconcile (field
  ownership), and Sidestep (commutative ops) solve different problems and
  aren't ranked better/worse than each other in general. Which one fits
  depends on whether false conflicts, merge complexity, or applicability to
  arbitrary field types matters more for a given use case.
- **Axis 2 gets solved at different layers for the same use case.** JSON
  Patch and Kubernetes solve it at the *payload/protocol* layer; GraphQL
  mutations and REST resource hoisting solve the identical case-3 problem
  at the *schema/resource-design* layer instead. Both "work," but they're
  not interchangeable: one is a wire format, the other is an API-shape
  decision made once per collection.
- **Two of the ten rows (OData delta, resource hoisting) aren't generic
  solutions at all.** One is direction-reversed (server telling client
  what changed, not the reverse); the other is scoped to a single
  collection by design. Both are legitimate answers to specific cells, not
  general-purpose alternatives to the others.
- **The "achieves everything" cell is empty.** Nothing here is simultaneously
  a generic payload grammar, solves omission and nested-collection targeting,
  and provides field-level concurrency reconciliation, without added
  schema-specific machinery.
