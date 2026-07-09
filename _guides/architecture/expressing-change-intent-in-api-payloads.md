---
title: "Expressing Change Intent in API Payloads"
layout: guide
category: Architecture
subcategory: Design
description: "How business APIs, configuration systems, cross-system sync, and constrained/IoT devices each express partial-update intent differently, and how JSON Patch, FieldMask, LDAP Modify, and Kubernetes server-side apply fit different contexts."
tags: [architecture, api-design, distributed-systems, consistency, coordination, design-patterns, practical]
---

## What Problem Are We Solving?

When a client changes server-held state over a network boundary, a single request has to communicate more than new values. It has to communicate intent: which parts of the resource this change touches, and which parts it leaves untouched. That distinction sounds simple, but most payload conventions in daily use cannot express it without ambiguity, and the gap between "looks like it works" and "works under concurrent writers" is where a surprising number of production data-corruption bugs live. The shape of the problem doesn't change from one system to the next, but which trade-off actually matters does: a typical business API prioritizes tooling and human-readable payloads, while a fleet of IoT devices happily gives those up for a fraction of the payload size.

### The Three Kinds of Change Intent

Every partial update, regardless of protocol, is really trying to express one of three distinct intents for each part of a resource:

- **Leave alone.** This field or relationship is not part of the change. The server should treat it as if the client said nothing about it.
- **Set explicitly.** The field takes a new value, including the case of setting it to null, empty, or zero, which has to be distinguishable from leaving it alone. A payload that cannot tell "the client didn't mention age" from "the client set age to 0" has lost information the server needs.
- **Add or remove within a collection or relationship.** A single element changes without the client needing to resend the entire collection to express that one change.

Most mainstream payload conventions blur at least one of these. Whole-resource PUT collapses "leave alone" into "set explicitly," since the client has to resend the full current state or risk overwriting fields it never meant to touch. Flat partial-object payloads over POST or PATCH usually cannot distinguish "field omitted" from "field explicitly cleared," because most JSON serializers treat absent keys and null values the same way, or drop nulls from the payload entirely by default. Collection-valued fields are normally replace-only, so adding one item to a list of 500 means resending all 500, or trusting that the client's view of the other 499 is still current.

That gap is easy to state in the abstract and easy to miss in a controller action. A request DTO with nullable properties can't tell these cases apart, no matter how the properties are typed:

```csharp
public record UpdateProfileRequest(string? Email, string? PhoneNumber);

[HttpPatch("profile")]
public IActionResult UpdateProfile(UpdateProfileRequest request)
{
    if (request.PhoneNumber is not null)
        _profiles.SetPhoneNumber(request.PhoneNumber);
}
```

`request.PhoneNumber` is `null` whether the client's JSON omitted `phoneNumber` entirely or sent `"phoneNumber": null` on purpose, so this handler can never clear a phone number: it can only leave it alone or set it to something. Making every property nullable doesn't fix this, since nullable is already how the "explicitly cleared" state gets represented; the type needs a third state, not a more permissive version of the same two. Each mechanism below either avoids this problem structurally or needs a specific fix for it, covered as it comes up.

### The Lost-Update Problem

That last gap is sharper than mere inconvenience. Requiring a client to hold and resend full current state exposes the system to the classic lost-update problem: client A fetches the resource, client B fetches the same resource, B writes its change, and A, still holding what is now stale full state, writes back and silently overwrites B's change. Neither client did anything wrong in isolation, but the write that "wins" depends entirely on request timing, and the loser's change disappears without an error.

<div class="callout callout--warning">
<p class="callout__title">Why This Bites in Production</p>
<p>This doesn't show up in single-user testing or low-concurrency staging. It surfaces under real production traffic, and by the time anyone notices, the write that caused it is long gone from the logs.</p>
</div>

The problem, then, isn't just expressing partial updates: it's expressing them without requiring the client to hold and resend full current state, and while staying tractable under concurrent writers.

### Concurrency Control Is a Separate, Orthogonal Concern

Optimistic concurrency control (OCC) is a common answer to concurrent writers, showing up as version numbers, ETags and `If-Match` headers (RFC 7232), Kubernetes `resourceVersion`, and Git's parent-hash chain. It's tempting to treat OCC as one more competing solution alongside JSON Patch or FieldMask, but it solves a narrower and different problem than payload intent does.

OCC is a detection mechanism, not a resolution mechanism. It turns a silent lost update into an observable conflict, typically a 409 or 412 response, but it doesn't merge anything or tell the server what changed; the client or a human still decides what happens next. It's also orthogonal to payload format: a version check can sit under a full-object PUT, a JSON Patch, or a FieldMask update equally well, which is why it gets called out separately here rather than scored as its own row later.

OCC also spans its own granularity spectrum, independent of how a payload expresses intent. Whole-resource versioning is cheap and blunt, and produces false conflicts whenever two writers touch unrelated fields on the same resource. Field or path-level ownership is finer-grained and requires more machinery, which is part of why Kubernetes server-side apply exists rather than relying on `resourceVersion` alone. CRDT-style commutative merge sits at the far end, avoiding rejection entirely, but only for operations designed up front to be mergeable.

Three distinct strategies for handling concurrent writers recur throughout this guide: **detecting** a conflict and rejecting the write (OCC/ETag), **reconciling** conflicting writes through field-level ownership (Kubernetes server-side apply), and **sidestepping** the conflict by choosing operations that are commutative in the first place (counters, CRDTs). These aren't points on one scale; they're structurally different answers, and which one fits depends on the use case.

## Where This Problem Shows Up

The three intents and the lost-update problem don't change shape from one system to the next, but which trade-off actually matters does. The four contexts below cover most of where partial updates matter in practice, and each one weighs the same trade-offs differently: what reads as an obvious inefficiency in one is a deliberate, correct choice in another. A cross-cutting case and a resource-modeling escape hatch follow, since neither belongs to just one context.

### Everyday Business APIs

This is where most engineers picture "an API" living: a REST or GraphQL service backed by a database, serving a web or mobile app, where a support engineer, a customer, or another internal service edits a user profile, an order, or a subscription. Two pressures show up constantly here. The first is flat scalar clearing, like clearing a customer's phone number or an opt-in marketing flag without touching the rest of their profile. This looks like the easy case, since it stresses omission clarity almost exclusively, but a plain hand-rolled REST endpoint built on default JSON deserialization usually can't tell "the client didn't send a phone number" from "the client sent phone number set to null." Both collapse to the same deserialized value unless the server is deliberately built to check for key presence. The second is nested object updates, like changing the shipping address embedded in an order without resending the whole order, which combines omission clarity with the need to address *into* a structure rather than just at its top level. A moderate collection, like the items in a shopping cart or the labels on a support ticket, shows up here too, though at a scale small enough that several of the mechanisms below handle it without much strain.

The dominant constraint here is developer ergonomics and tooling, not payload size. The payload needs to be readable in logs, easy to construct from a typical web or mobile client, debuggable with curl or an API client, and well supported by OpenAPI codegen. A few hundred extra bytes on a broadband or cellular connection carrying a JSON body is not a cost anyone in this context is optimizing for.

### Configuration and Infrastructure Management

Anyone who has run a Kubernetes cluster, applied a Terraform plan, or fought with a feature-flag service three teams touch at once lives here. Multiple independent actors, some human, some automated (autoscalers, CI/CD pipelines, GitOps controllers), modify different parts of the same object indefinitely. This isn't a single request/response exchange; it's an ongoing reconciliation process, and a Kubernetes Deployment is the clearest example, with a human setting some fields through kubectl while an autoscaler controller sets `replicas` independently, neither one aware of the other's timing.

The dominant constraint here is field-level ownership and conflict visibility over time, not payload compactness or even strict per-request atomicity. A config system that silently lets one controller overwrite another's field is far more dangerous than one that's occasionally slow to reconcile. The same multi-writer pressure shows up in real-time collaborative editing, a shared document or a design file two people edit at once, though the tempo there is sub-second rather than the seconds-to-minutes loop typical of infrastructure controllers, which is usually why it needs CRDT-style merging instead of field-level ownership.

### Synchronizing Systems of Record

Anyone who has connected a CRM to a finance system, kept a warehouse management system aligned with an e-commerce storefront, or maintained a corporate directory across HR, IT, and email systems lives here. No single system holds the authoritative copy of everything, records move in bulk through nightly batches or change-data-capture streams (Debezium, Kafka Connect), and the receiving system has to reconcile large volumes of adds, updates, and removes without redoing work that already landed. Directory and identity management is a specialized, older flavor of this same problem: keeping a phone number or a group membership consistent across HR systems, a directory service, and downstream applications, at directory scale, from many concurrent admin tools, predating REST as the original documented use case in this space.

The dominant constraint here is resumability and volume, not per-request atomicity. A sync process that has to restart from scratch after a network blip halfway through fifty thousand records is a bigger operational problem than one that occasionally applies entries slightly out of order. This is also where the large-collection pressure gets most severe: adding one member to a ten-thousand-member group, or removing one item from a long list, without resending the whole collection.

### Constrained-Bandwidth and Embedded Systems

A fleet of battery-powered sensors reporting temperature readings over a low-power wide-area network lives here, and so does the more common case most backend engineers actually touch: internal service-to-service RPC over gRPC, where dozens of microservices call each other thousands of times a second inside the same data center. Both share the wire-level presence problem that protobuf's proto3 historically had for scalars, where "set age to 0" and "don't touch age" were indistinguishable at the wire level regardless of what payload convention a team chose. That ambiguity isn't a payload design choice; it's forced by the type system and serialization format itself, and it's the specific problem FieldMask exists to patch over.

The dominant constraint here is payload size and parsing cost, not human readability. A device on a constrained cellular connection pays real battery for every byte transmitted, and a service mesh handling thousands of requests per second pays real CPU for every byte it parses. Both are willing to accept schema coupling between client and server that a public-facing business API would rarely tolerate, because the client and server here are typically versioned and deployed close together.

### A Cross-Cutting Case: Delta and Atomic Operations

Decrementing inventory by one or incrementing a view counter, where the operation itself, not the resulting value, is the unit of intent, doesn't belong to just one of the four contexts above. It's a scalar field where "add 1" is inherently commutative and order-tolerant under concurrent writers, which means intent-encoding can sometimes sidestep the concurrency problem instead of merely detecting it, and the same trick shows up everywhere: an inventory counter in a business API, a replica count adjustment in a configuration system, a sync cursor in a replication pipeline, and a sensor-reading aggregate on a constrained device. SQL's `UPDATE t SET qty = qty - 1`, Redis's `INCR`, and DynamoDB update expressions all express this pattern.

### Resource Shape Can Sidestep the Problem Entirely

Some of the pressure above is a resource-modeling problem rather than a payload-format problem, and it's most visible in everyday business APIs. Several real APIs avoid the large-collection case entirely by giving the collection its own addressable sub-resource instead of solving generic patch semantics on the parent: GitHub's `/issues/{id}/labels`, Stripe's subscription items, and `/repos/{id}/collaborators/{user}` all work this way. Scalar fields go through PATCH on the parent, and membership changes go through POST or DELETE on a dedicated sub-resource endpoint. This is a legitimate, widely used lever, REST resource shape rather than payload grammar, and it fully resolves the large-collection case for that subset of use cases without needing JSON Patch, FieldMask, or any other generic mechanism. It stays distinct from the payload formats reviewed next, so credit for solving a use case lands on the right layer of the design.

## How Each Solution Expresses Change Intent

Two solutions below extend past the obvious "generic patch grammar" candidates: delta and atomic operations, and REST resource hoisting. Both are legitimate, widely documented answers to parts of the problem, and they belong on equal footing with the payload-format solutions rather than being treated as afterthoughts, because leaving them out would bias the comparison toward generic patch grammars as the only valid strategy, which the contexts above already show isn't true.

Each entry below separates what intent the mechanism can express from how, or whether, it layers concurrency handling, and shows what actually preserving that intent looks like in server code. These are independent properties of each technology, not one combined score.

### JSON Patch (RFC 6902)

JSON Patch is an array of operations, `add`, `remove`, `replace`, `move`, `copy`, and `test`, each targeting a JSON Pointer (RFC 6901) path into the document. It's typically sent as the body of an HTTP PATCH request (RFC 5789), the verb that exists specifically so formats like JSON Patch and Merge Patch could be defined as content types on top of it.

```json
[
  { "op": "replace", "path": "/email", "value": "new@example.com" },
  { "op": "remove", "path": "/middleName" },
  { "op": "add", "path": "/tags/-", "value": "vip" },
  { "op": "test", "path": "/status", "value": "active" }
]
```

**How it's applied**: the whole operation array goes to the resource's own endpoint in a single request, for example `PATCH /orders/123`, and the server evaluates every operation against one target document. RFC 6902 requires the entire patch to apply atomically: if any operation fails, including a failed `test` precondition, the server rejects the whole patch and none of the operations take effect, so the client can safely retry the whole array once the precondition is met.

```http
HTTP/1.1 409 Conflict
Content-Type: application/json

{ "error": "test operation failed", "opIndex": 3, "path": "/status" }
```

Omission clarity is solved explicitly: `remove` and `replace`-with-`null` are distinct operations, so there's no ambiguity between clearing a field and leaving it alone. Collection targeting is solved well too, since paths address any node, including array indices and the `-` marker for append, so element-level edits work without a full replace. The client still needs to know the shape of the document to address into it, even though it no longer needs to hold full current values.

In C#, this sidesteps the DTO trap from the opening section entirely, because the request never deserializes into a partial-shape model in the first place:

```csharp
[HttpPatch("orders/{id}")]
public IActionResult UpdateOrder(int id, [FromBody] JsonPatchDocument<Order> patchDoc)
{
    var order = _orders.Get(id);
    patchDoc.ApplyTo(order); // each operation targets its own path; nothing to infer
    _orders.Save(order);
    return NoContent();
}
```

`ApplyTo` walks the operation list and executes `remove` or `replace`-with-`null` exactly as instructed. There's no `Order` DTO with nullable properties standing between the wire payload and the domain object for the omission question to get lost in.

JSON Patch has no built-in reconciliation for concurrent writers, but the `test` operation provides a fine-grained, path-level precondition inside the same request, asserting that a given path currently equals a given value before the other operations apply atomically. That's a genuinely fine-grained OCC primitive, closer to the field-level end of the granularity spectrum than a single whole-resource version number.

**Trade-offs**: the client has to compute the operation list, so diffing cost lands on the client rather than the server, and array-index operations are fragile if the array shifts between when the diff was computed and when it's applied, unless paired with a `test` op. A Patch array also reads less clearly in logs than a flat body would.

### JSON Merge Patch (RFC 7396)

JSON Merge Patch sends a partial object where present keys overwrite, `null` deletes the key, objects merge recursively, and everything else, including arrays, is replaced wholesale.

```json
{
  "email": "new@example.com",
  "middleName": null
}
```

**How it's applied**: like JSON Patch, the partial object goes to one endpoint in a single request and merges into one target document. There's no equivalent to `test`, and no notion of several operations that could each succeed or fail independently. Merge Patch can only fail one way: the merged result fails validation and the server rejects the whole request, so there's nothing analogous to JSON Patch's "operation three of four failed" scenario to reason about.

Omission clarity is only partially solved: `null` is the delete sentinel, which means the format cannot express "set this field to null" as distinct from "delete this field," a real expressiveness gap for any schema where null is a meaningful value rather than an absence marker. Collection targeting is solved for nested objects, which merge recursively, but arrays get no element targeting at all, which is exactly how Merge Patch fails on the large-collection and bulk-sync pressures described above. It has no concurrency handling built in, and is typically layered with an ETag like any other request body.

This is also the format most exposed to the DTO trap from the opening section, since .NET has no built-in type to prevent it. The fix is a small wrapper whose default state means "not specified," paired with a `JsonConverter` that only runs for properties actually present in the payload:

```csharp
public readonly struct Specified<T>
{
    public bool IsSpecified { get; }
    public T? Value { get; }

    public Specified(T? value)
    {
        IsSpecified = true;
        Value = value;
    }
}

public class SpecifiedConverter<T> : JsonConverter<Specified<T>>
{
    public override Specified<T> Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        => new(JsonSerializer.Deserialize<T>(ref reader, options));

    public override void Write(Utf8JsonWriter writer, Specified<T> value, JsonSerializerOptions options)
        => JsonSerializer.Serialize(writer, value.Value, options);
}
```

System.Text.Json only invokes a property's converter when that property exists in the source JSON, so a property typed `Specified<string?>` stays at its struct default, `IsSpecified: false`, whenever the client leaves it out. When the client does send it, the converter runs and sets `IsSpecified: true` regardless of whether the value itself is null:

```csharp
if (request.PhoneNumber.IsSpecified)
    customer.PhoneNumber = request.PhoneNumber.Value;
```

This still can't recover the null-versus-delete distinction the format gives up by spec: `IsSpecified: true, Value: null` is exactly what a genuine "set to null" and a "delete" both look like under RFC 7396, since the wire format never gave the client a way to say which one it meant. `Specified<T>` fixes the implementation gap; it can't fix a gap in the spec. It isn't free, either: the custom converter runs once per property instead of System.Text.Json's highly optimized default path, so the format most teams pick for its simplicity is also the one where getting omission clarity right quietly gives some of that simplicity back.

**Trade-offs**: it's extremely simple to construct and read, effectively "just the fields you want to change," and tooling support is close to universal since it's plain JSON. Against that, the null/delete conflation and the all-or-nothing treatment of arrays mean it fails large-collection and bulk-sync scenarios outright.

### LDAP Modify (RFC 4511)

LDAP Modify predates REST and dates to X.500 and LDAPv3. A modify operation is a list of `{add | delete | replace, attribute, values[]}` tuples applied atomically to a directory entry, with multi-valued attributes native to the data model rather than bolted on.

```
dn: uid=jdoe,ou=people,dc=example,dc=com
changetype: modify
replace: mail
mail: new@example.com
-
delete: telephoneNumber
telephoneNumber: 555-0100
-
add: telephoneNumber
telephoneNumber: 555-0199
```

**How it's applied**: the whole change list travels in a single Modify Request against one entry, and RFC 4511 treats that list as one atomic operation. If any change in the list is invalid, for example a `delete` naming a value the attribute doesn't currently hold, the server rejects the entire request and returns a single result code; none of the other changes in the list take effect either, including the `replace` and `add` operations that would otherwise have succeeded on their own.

Omission clarity is fully solved by design: three explicit verbs per attribute leave no ambiguity possible. Collection targeting is solved for multi-valued attributes, where individual values can be added or deleted, though the concept barely applies beyond that since LDAP's data model is flat attribute-value entries rather than arbitrary nested documents. There's no standardized general-purpose OCC across implementations, though some directory servers offer assertion controls for conditional modify.

A .NET application is almost always the client sending this request to a directory server such as Active Directory, not the code that applies it, since that logic lives inside the directory server itself. Even from that side of the wire, there's nothing to lose, because `System.DirectoryServices.Protocols` builds the same kind of explicit operation list as JSON Patch, with each modification carrying its own `DirectoryAttributeOperation` rather than a nullable property standing in for one of three states:

```csharp
var mods = new[]
{
    new DirectoryAttributeModification
    {
        Name = "mail",
        Operation = DirectoryAttributeOperation.Replace,
        "new@example.com"
    },
    new DirectoryAttributeModification
    {
        Name = "telephoneNumber",
        Operation = DirectoryAttributeOperation.Delete
    }
};

connection.SendRequest(new ModifyRequest(distinguishedName, mods)); // connection is an already-bound LdapConnection
```

Setting `mail` and clearing `telephoneNumber` are two different `Operation` values on two different modifications, not two branches of an `if (value is not null)` check on a shared DTO.

**Trade-offs**: LDAP Modify expresses intent at the protocol level rather than bolting it onto a generic document format. Its flat data model doesn't generalize to arbitrary nested web resources, though, and its binary ASN.1 (BER) wire protocol requires an entirely different client stack than most web developers already have.

### Protobuf FieldMask

A `google.protobuf.FieldMask` message carries a list of field paths, sent alongside a partial message; the server applies only the paths listed and ignores unlisted fields regardless of their value.

```json
{
  "user": { "email": "new@example.com" },
  "updateMask": "email"
}
```

**How it's applied**: the partial message and its mask travel together in a single RPC call against one resource. The wire format itself doesn't mandate atomicity the way JSON Patch's RFC does; it's an implementation convention rather than a spec requirement. Idiomatic implementations, including Google's own guidance, still apply every masked field as one resource-level transaction and return either the fully updated resource or an error, never a resource with three of five masked fields applied and a fourth silently skipped.

Omission clarity is solved: the mask is what distinguishes "included at its zero value" from "not part of this update," directly patching over proto3's historical lack of scalar field presence. Collection targeting is weak, since repeated fields (protobuf's arrays) are typically masked as a whole list, with no standard per-element path syntax, which leaves FieldMask punting on collection-element targeting much the way Merge Patch does. It has no concurrency handling built in, though Google Cloud APIs commonly pair it with an `etag` field on the resource, the same layered pattern as ETag/If-Match elsewhere.

There's no library-provided apply step here the way `Delta<T>` provides one for OData; server code applies fields by walking the mask directly, never inspecting whether the unmasked fields on the partial message happen to be null or zero:

```csharp
public override async Task<User> UpdateUser(UpdateUserRequest request, ServerCallContext context)
{
    var user = await _users.GetAsync(request.User.Id);
    foreach (var path in request.UpdateMask.Paths)
    {
        switch (path)
        {
            case "email": user.Email = request.User.Email; break;
            case "phone_number": user.PhoneNumber = request.User.PhoneNumber; break;
        }
    }
    return user;
}
```

The mask is the presence signal; whether `request.User.Email` happens to be empty or default never enters the decision, only whether `"email"` appears in `request.UpdateMask.Paths`.

**Trade-offs**: FieldMask directly and cleanly solves the presence-loss problem it was built for, with the mask and value traveling separately so paths can be schema-validated. Against that, it introduces two things the client has to keep in sync, the partial message and the mask, which is a recurring source of client bugs, and [Google's own API design guidance](https://google.aip.dev/134){:target="_blank" rel="noopener noreferrer"} flags documented ambiguity in masking repeated and map fields.

### OData PATCH and Delta Payloads

OData is an OASIS standard heavily used in enterprise and .NET ecosystems. Its PATCH semantics resemble Merge Patch, applied over HTTP.

```http
PATCH /Orders(1) HTTP/1.1
If-Match: "etag-value"
Content-Type: application/json

{ "ShippingAddress": { "City": "Seattle" } }
```

**How it's applied**: this PATCH request targets one entity at a time and merges in a single atomic operation, the same all-or-nothing behavior as JSON Merge Patch. Separately, OData defines a delta payload format for servers to tell clients what changed since their last sync, with added, updated, and deleted entries and explicit `@removed` annotations.

```json
{
  "@odata.context": "$metadata#Orders/$delta",
  "value": [
    { "id": 1, "status": "Shipped" },
    { "id": 2, "@removed": { "reason": "deleted" } }
  ]
}
```

The PATCH side inherits Merge Patch's weaknesses on omission clarity and collection targeting. The delta-payload side is a documented answer to the bulk-sync use case, but the direction is reversed: it's a server-to-client change feed rather than a client-to-server mutation request, representing change generically in the opposite direction from everything else in this guide. The two sides also differ in failure granularity: a PATCH request is all-or-nothing against its one entity, while delta entries are independent of each other, so a client can apply entry 1, fail on entry 2, and resume later from a delta token without redoing or losing entry 1's effect. Concurrency handling is a genuine strength on the PATCH side: ETags and `If-Match` are first-class, spec-defined parts of OData PATCH, not bolted on after the fact the way most REST APIs handle it.

Avoiding the DTO trap from the opening section on the PATCH side needs `Microsoft.AspNetCore.OData`'s `Delta<T>`, a change-tracking wrapper that deserializes in place of a plain entity and applies only the properties the request actually included:

```csharp
[HttpPatch]
public IActionResult Patch(int key, [FromBody] Delta<Order> delta)
{
    var order = _orders.Get(key);
    delta.Patch(order); // only properties present in the request body are touched
    return Updated(order);
}
```

A plain `Order` DTO here would fall into the same trap as Merge Patch's naive form; `Delta<T>` is what makes the PATCH side's presence tracking actually work.

**Trade-offs**: OCC is native to the spec, and delta payloads are a standardized solution to bulk sync. PATCH itself doesn't improve on Merge Patch's array problem, and the delta payload and mutation PATCH remain two separate mechanisms rather than one unified answer.

### Kubernetes Strategic Merge Patch and Server-Side Apply

Kubernetes has shipped two generations of this problem. Strategic merge patch recognizes schema-annotated "merge keys" for certain list fields, so containers merge by `name` rather than by array index, enabling per-element list patches without a full replace. Server-side apply, GA since Kubernetes 1.22, tracks field *ownership* per manager, so multiple controllers can co-own different fields of the same object, with conflicts surfaced when two managers try to set the same field to different values.

```yaml
# Strategic merge patch: merges into containers by "name", not array index
spec:
  containers:
    - name: web
      image: myapp:2.0
```

```bash
kubectl apply --server-side --field-manager=autoscaler -f replicas-patch.yaml
```

**How it's applied**: `kubectl apply` sends one request to the API server for one object, and the update commits to etcd as a single atomic write; Kubernetes has no notion of partially updating an object. Server-side apply adds a coarser way for the whole request to fail on top of that: if the field manager detects that another manager already owns a field being changed, the API server rejects the whole apply with a 409 Conflict, and the caller has to either drop the conflicting field or resubmit with `--force-conflicts` to take ownership, rather than the non-conflicting fields landing while the conflicting one is skipped.

Omission clarity is solved, and collection targeting is the most complete answer in this comparison, purpose-built for exactly the large-collection and multi-actor reconciliation pressures described above. Concurrency is solved directly by [server-side apply's field-manager model](https://kubernetes.io/docs/reference/using-api/server-side-apply/){:target="_blank" rel="noopener noreferrer"}, which tracks sub-resource-path ownership and detects conflicts rather than relying on whole-resource versioning. This is the fine-grained end of the OCC spectrum described earlier: the only mechanism here with true field-level ownership rather than a version number or an ETag. There's no DTO trap on the client side either, since a patch document is constructed as exactly the fields the caller means to own, not deserialized from a model with nullable properties standing in for "maybe."

**Trade-offs**: this is purpose-built for multi-actor declarative reconciliation, gives clean list-element targeting through merge keys, and its field ownership model avoids the false-conflicts problem whole-resource versioning has. Merge-key annotations are schema-specific, though, so an API type has to declare them, and this doesn't transfer to arbitrary REST APIs without equivalent schema work. The manager/ownership/conflict model also adds substantial conceptual overhead for a typical CRUD API.

### GraphQL Mutations

GraphQL mutations aren't a generic patch grammar. Each mutation is a hand-authored named operation with its own input type, and whether "field absent from input" and "field explicitly null" are distinguishable depends entirely on schema and resolver design, through techniques like tri-state wrapper types or a resolver that checks argument presence. It's possible, not automatic.

```graphql
mutation {
  addLabelToIssue(issueId: "I_123", labelId: "L_456") {
    issue { id labels { name } }
  }
  removeLabelFromIssue(issueId: "I_123", labelId: "L_999") {
    issue { id labels { name } }
  }
}
```

**How it's applied**: a single POST to `/graphql` can carry a document with several top-level mutation fields, and the spec requires them to execute serially, in the order written, but not inside a shared transaction. Each field resolver succeeds or fails on its own, and the response reflects that per field rather than for the request as a whole.

```json
{
  "data": {
    "addLabelToIssue": { "issue": { "id": "I_123", "labels": [{ "name": "bug" }] } },
    "removeLabelFromIssue": null
  },
  "errors": [
    { "message": "Label not found", "path": ["removeLabelFromIssue"] }
  ]
}
```

The first mutation's effect is already committed by the time the second one fails, and nothing rolls it back automatically. A client that needs both to succeed together has to read the response and compensate for the partial failure itself, the opposite of JSON Patch's or LDAP Modify's all-or-nothing behavior.

Omission clarity is possible with deliberate resolver discipline, but GraphQL doesn't force it the way FieldMask's separate mask does. Collection targeting is solved the same way REST resource hoisting solves it, by hand-authoring a dedicated mutation per collection operation such as `addLabelToIssue` or `removeCartItem`. Client shape is GraphQL's genuine strength here: query-side shape control means the client can mutate a slice of the resource without holding its full state. There's no concurrency handling in the spec itself; anything here is bespoke per API.

Hot Chocolate, the dominant .NET GraphQL server, ships the discipline as a type. Its `Optional<T>` isn't a C# language or BCL feature (the language itself has no equivalent; `string?` is a compile-time nullability annotation with no runtime representation at all), and it sets a `HasValue` flag only when the client's variables actually included that field:

```csharp
public record UpdateProfileInput(Optional<string?> Email, Optional<string?> PhoneNumber);

public Profile UpdateProfile(UpdateProfileInput input, [Service] IProfileRepository repo)
{
    var profile = repo.Get();
    if (input.PhoneNumber.HasValue)
        profile.PhoneNumber = input.PhoneNumber.Value; // a real value or an intentional null
    return profile;
}
```

A resolver that used a plain `string?` parameter instead would land back in the same trap the opening section describes.

**Trade-offs**: mutations are explicit, self-documenting, and strongly typed per operation, and they naturally avoid the large-collection problem the same way resource hoisting does. A mutation, often paired with an input type, costs about the same as REST endpoint proliferation, just moved into the schema, and omission-versus-null handling isn't uniform across GraphQL server implementations, with no standardized concurrency story.

### Delta and Atomic Operations

This lever expresses "apply this commutative operation to whatever the current value is" instead of "set the field to X." SQL's `UPDATE t SET qty = qty - 1`, Redis's `INCR`/`DECR`, DynamoDB `ADD` update expressions, and CRDT counters like G-Counter and PN-Counter all follow this pattern.

```sql
UPDATE inventory SET quantity = quantity - 1 WHERE product_id = 42;
```

**How it's applied**: this is a single statement or command against a single row or key, whether it's the `UPDATE` above or one Redis `INCR` call, so the storage engine's own atomicity guarantee covers it directly. There's no multi-step request here that could partially fail in the first place, and no document to deserialize at all, which makes this the performance floor for the whole guide: everything else costs at least as much as this, and usually more.

Omission clarity and collection targeting largely don't apply here, since this targets always-present numeric or counter fields rather than optional or collection-valued ones. Concurrency is the standout property: commutative operations sidestep conflict rather than detecting it through OCC or reconciling it through field-ownership machinery. Two concurrent decrements both simply apply correctly, with no version check needed, because the operation itself is designed to be order-tolerant. There's no DTO trap to avoid here either, since the operation names one field directly and there's no partial-object shape for a presence signal to get lost in.

**Trade-offs**: there's no read-before-write round trip and no OCC bookkeeping, and the approach is correct under arbitrary concurrency for the operations it supports, with decades of production maturity behind SQL and Redis alike. It only works where the operation is genuinely commutative, "set to this exact string" isn't, and it doesn't generalize to arbitrary field updates; it's orthogonal to the other approaches here rather than a general answer to intent expression.

### REST Resource Hoisting

Instead of solving generic patch semantics on a parent resource, this lever models the collection as its own addressable sub-resource with its own endpoints.

```http
POST /issues/123/labels
{ "name": "bug" }

DELETE /issues/123/labels/bug
```

**How it's applied**: adding three labels and removing two means five separate HTTP requests to five sub-resource endpoints, each returning its own response. There's no cross-request atomicity by design: if the third request fails with a 500 or a 409, the first two have already committed and the fourth and fifth proceed independently regardless. The client is responsible for tracking which individual calls succeeded and retrying or compensating for the ones that didn't, the same obligation resource hoisting hands the client for collection targeting in general.

Collection targeting is fully solved for the specific collection, by construction, with zero payload-format cleverness required. Omission clarity and concurrency for other fields are untouched; this lever says nothing about scalar-field clearing or general concurrent-write handling. Client shape is improved for that slice of the resource, since no full-collection resend is needed, though the client still has to know the identity of the item being added or removed. Ordinary per-item OCC, an ETag on the individual member, fits naturally here, since the unit of concurrency control matches the unit of change. There's no DTO trap here at all, since a sub-resource body like the one above has no optional fields to omit; the whole payload is required.

**Trade-offs**: no new wire format is required at all, making this a pure API-design decision that works with any framework and is already instinctive to most experienced API designers. It only solves collection membership, though, and only when the collection is resource-like enough to deserve its own endpoint; it can produce endpoint proliferation, and it gets awkward when the collection is nested several levels deep.

## Comparing the Solutions

The table below compares the ten mechanisms on the properties that actually vary continuously from one to the next and need to be seen row by row: whether a mechanism can distinguish "leave alone" from "set explicitly" (omission clarity), whether it can address into nested structures or individual collection elements without a full replace (collection targeting), how common the mechanism actually is in production use (real-world adoption), and what it costs at runtime beyond plain deserialization (performance cost). A **Lever** column sits alongside them because the mechanisms aren't all the same kind of thing: some are wire-format grammars, some are resource-shape decisions, and some are operation-semantics choices, so scoring the other four columns without it would imply they compete on identical terms, which they don't. Concurrency strategy and atomicity are covered separately below the table: both are categorical rather than continuous, so a handful of solutions sharing a bucket says more than a column ever would.

| Solution | Lever | Omission Clarity | Collection Targeting | Real-World Adoption | Performance Cost |
|---|---|---|---|---|---|
| JSON Patch | Payload grammar | Solved | Solved (index-fragile) | Rare relative to its strength; client-side diffing and weak OpenAPI tooling are the barriers | Reflection-based path resolution per operation on apply; extra cost if the client computes the diff rather than hand-authoring it |
| JSON Merge Patch | Payload grammar | Partial (null = delete) | Weak (arrays replaced) | The de facto default; matches how most ad hoc partial updates already look | Fast in its naive form (plain POCO deserialization); the `Specified<T>` fix trades that speed for a custom-converter call per field |
| LDAP Modify | Protocol-native operation | Solved | Solved (flat attributes only) | Universal inside directory services, unseen outside them | Binary ASN.1 encoding, generally faster to parse and more compact than any JSON-based mechanism here |
| Protobuf FieldMask | RPC-schema mechanism | Solved | Weak (repeated fields as whole) | Standard in Google Cloud APIs and gRPC-native shops; requires committing to that tooling first | Protobuf's binary format is faster to serialize and parse than JSON; mask-walking adds only a small per-field cost on top |
| OData PATCH | Payload grammar | Partial | Weak | Common in Microsoft-adjacent enterprise stacks; adopting it means adopting OData, not just a PATCH format | `Delta<T>`'s change-tracking wrapper relies on reflection-based property access, heavier than a direct POCO assignment |
| OData delta payload | Protocol-native, server to client | Solved per entry | Solved per entry, reversed direction | Same enterprise footprint as OData PATCH | Same reflection cost as PATCH on the write side; the read-side feed costs the same as any JSON payload of its size |
| Kubernetes strategic merge + server-side apply | Protocol-native, resource-modeling hybrid | Solved | Solved (most complete, merge keys) | Ubiquitous inside Kubernetes, unseen outside it; the machinery only pays for itself with many independent automated writers | The `managedFields` ownership metadata grows with every distinct field manager, a known source of object bloat in etcd at scale |
| GraphQL mutations | Schema-design lever | Possible, not automatic | Solved (hand-authored per case) | Widely known, still a minority choice next to REST; usually a new-service decision, not a drop-in addition | Resolver execution and query validation add overhead beyond plain deserialization; `Optional<T>` is a small marginal cost on top of that |
| Delta and atomic operations | Operation-semantics lever | Not applicable | Not applicable | Ubiquitous and zero-friction; most teams already do this without naming it as a pattern | The floor for this table: no document deserialization at all, typically one indexed write or a lock-free counter operation |
| REST resource hoisting | Resource-modeling lever | Not applicable | Solved for that collection | The most common answer here; no new wire format or tooling, just another endpoint | Cheap per request, but N separate round-trips for N changes multiplies network latency a single batched request wouldn't pay |

No single mechanism scores well on both intent-expression columns at once. The closest is Kubernetes server-side apply, which gets there by combining a resource-modeling convention (merge keys) with protocol machinery (field ownership) rather than functioning as a payload format the way JSON Patch does. Collection targeting also gets solved at different layers for the same underlying problem: JSON Patch and Kubernetes solve it at the payload or protocol layer, while GraphQL mutations and REST resource hoisting solve it at the schema or resource-design layer, and the two aren't interchangeable since one is a wire format and the other is an API-shape decision made once per collection. Two of the ten rows, the OData delta payload and resource hoisting, aren't generic solutions at all: one is direction-reversed and the other is scoped to a single collection by design, so both answer specific situations rather than standing in as general alternatives to the rest of the table.

### Grouping by Concurrency Strategy and Atomicity

Concurrency strategy sorts the ten mechanisms into the three buckets named earlier, plus a fourth for the ones that leave it to something else entirely:

- **Detect**: JSON Patch (in-band, via the `test` op), OData PATCH (native ETag/`If-Match`)
- **Reconcile**: Kubernetes server-side apply (field ownership)
- **Sidestep**: Delta and atomic operations (commutative by construction)
- **None built in**, typically layered externally with OCC: JSON Merge Patch, LDAP Modify, Protobuf FieldMask, GraphQL mutations, REST resource hoisting (per-item ETags fit naturally here)
- **Not applicable**: OData delta payload, a read-side feed rather than a write

Atomicity, what happens when part of a multi-part request fails, splits the same ten a different way:

- **All-or-nothing**, one request against one target returns either a full success or a full rejection: JSON Patch, JSON Merge Patch, LDAP Modify, Protobuf FieldMask, OData PATCH, Kubernetes strategic merge and server-side apply
- **Independent per item**, a batch of changes can partly succeed: GraphQL mutations (per field), OData delta payloads (per entry), REST resource hoisting (per request)
- **Not applicable**: Delta and atomic operations, a single statement with nothing to partially fail

Neither grouping is safer in general. An all-or-nothing mechanism trades partial-progress tracking for the risk that one bad operation in a large batch discards everything else in the same request, and the two groupings don't line up with each other or with the table above: a mechanism's concurrency strategy and its atomicity are independent choices, not two views of the same fact.

### Why Adoption Doesn't Track Technical Completeness

Real-world adoption doesn't follow the same ranking as the other columns. JSON Patch solves omission clarity and collection targeting more cleanly than almost anything else in this table, and it's still rare, because the cost lands immediately: the client has to build or consume a diff, and OpenAPI and codegen tooling handle it poorly. JSON Merge Patch's flaws, the null/delete conflation, the all-or-nothing arrays, stay invisible until they cause a production bug, so a team adopting it pays no upfront cost and discovers the downside later, if ever. FieldMask and Kubernetes server-side apply follow the same pattern from the other direction: both are the strongest answers to the problems they specifically target, and both stay confined to the ecosystems that forced their creation, because adopting either means adopting a wire format, a tooling chain, and often a whole client library ecosystem, not just a PATCH convention. REST resource hoisting and ad hoc partial-object PATCH win by default for the opposite reason: neither needs new tooling, a new client library, or buy-in from anyone who isn't already writing REST endpoints, so they're where most APIs land regardless of whether they're the best fit for the problem at hand.

## Matching Solutions to the Systems You're Building

The pairings below map the four contexts from earlier to the mechanisms best suited to them. Delta and atomic operations aren't listed under any single context, since reaching for a commutative operation is the right call inside any of the four, whenever the specific field being changed is genuinely commutative.

### Everyday Business APIs

| Pressure | Well-Suited Solutions | Why |
|---|---|---|
| Flat scalar clearing (a phone number, a marketing flag) | JSON Merge Patch | Solves the one pressure that matters here, without a full patch grammar or FieldMask's mask-and-message coupling. |
| Nested object updates (an embedded address, a shipping profile) | JSON Patch, JSON Merge Patch | Merge Patch handles nested objects natively; JSON Patch adds precision when the nesting includes arrays. |
| Moderate collection membership (cart items, ticket labels) | REST resource hoisting, JSON Patch | Hoisting sidesteps the problem when the collection deserves its own endpoint; JSON Patch handles it in the payload otherwise. |

### Configuration and Infrastructure Management

Kubernetes server-side apply is close to the only mechanism built for this context: true field-level ownership across independent, ongoing writers, which nothing else here attempts.

### Synchronizing Systems of Record

| Pressure | Well-Suited Solutions | Why |
|---|---|---|
| Bulk sync or replication between systems | OData delta payloads | The only mechanism here designed as a server-to-client change feed rather than a client-to-server mutation. |
| Directory or identity attribute management | LDAP Modify | Purpose-built for exactly this, with decades of production hardening at directory scale. |
| Large collection membership at replication scale (group sync, tens of thousands of records) | REST resource hoisting, JSON Patch | Hoisting when the collection has its own endpoint; JSON Patch when the exchange still travels as one generic payload. |

### Constrained-Bandwidth and Embedded Systems

Protobuf FieldMask is the only mechanism here built to patch over proto3's lack of scalar presence. The coupling cost that's a real drawback in a business API is a reasonable price for the compact wire format constrained devices and high-volume internal RPC both need.

The strongest fit rarely comes from picking one general-purpose payload grammar and using it everywhere. It comes from recognizing which context you're actually building for, which of the three intents it stresses, and which concurrency strategy it needs, then reaching for the mechanism, wire format, resource shape, or operation semantics built for that specific combination.
