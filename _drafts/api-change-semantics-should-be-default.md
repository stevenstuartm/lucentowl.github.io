---
layout: post
title: "Can We Agree API Change Semantics Should Be a Default?"
date: 2026-07-09
description: "Partial updates can't tell a field the client left alone from one it cleared, and that gap doesn't belong to REST, which never specified partial updates at all. It belongs to the convention built on top, which is why the useful response is sorting what people call REST into the part that carries weight and the part that is only habit."
tags: [architecture, api-design, rest, grpc, design-patterns]
author: steven-stuart
---

Any API endpoint that accepts a partial update holds the responsibility of determining whether an omitted field was left alone on purpose, whether it was meant to be cleared, or whether a missing collection item fell out of scope or was meant to be removed.

I've watched architects senior to me hit this exact question and not answer it, and when it landed on me, I didn't answer it either. Every fix I shipped was a single-property patch explained in a wiki page instead of in the contract itself, rediscovered by whoever hit it next. There was rarely time to go further. The gap got treated as an edge case, not a design question, so a hack closed the one case that was biting and the team moved on. This is an old problem, old enough to predate REST and JSON, and it still gets buried under a fix for one field and quietly assumed to have resolved itself.

The scope here stays inside the most common and most interoperable representation of partial updates, JSON sent over REST. The RPC world answers it differently and gets its own section later. What I want to argue is that this was never a gap in REST, because REST never specified partial updates in the first place. It's a gap in the convention that grew on top, and a convention can't be repaired by adding discipline to it when not requiring discipline is the reason it won. What's left to do instead is sort the thing people call REST into the part that's carrying weight and the part that's only habit. Change semantics is where that line is easiest to see.

## The Four Things Any Change Has to Express

Every partial update is trying to express one of four intents for each part of a resource:

- **Leave alone.** The field isn't part of this change, and the server should treat it as if the client said nothing about it.
- **Set a value.** The field takes a new value, including zero or false, and that has to be distinguishable from leaving it alone.
- **Clear.** The field's current value goes away, and that has to be distinguishable from both of the above.
- **Change one element of a collection.** A single item is added or removed without the client resending the whole collection to say so.

A typical PATCH endpoint blurs all four at once. Say customer 42 has a phone number on file and two tags, `newsletter` and `beta`, and a client sends this request to clear the phone number and add a third tag, `vip`:

```http
PATCH /customers/42
{ "phoneNumber": null, "tags": ["newsletter", "beta", "vip"] }
```

A typical handler deserializes that straight into a DTO with nullable properties:

```csharp
public record UpdateCustomerRequest(string? PhoneNumber, List<string>? Tags);

if (request.PhoneNumber is not null)
    customer.PhoneNumber = request.PhoneNumber;

if (request.Tags is not null)
    customer.Tags = request.Tags;
```

`request.PhoneNumber` is null here for the same reason it would be null if `phoneNumber` had been left out of the body entirely. Nullable is the only state available for "nothing here," so it has to carry both "leave alone" and "clear."

The ambiguity can run the opposite direction too, and less benignly. An omitted `isAdmin` key deserializes to `false`, the same value sent to revoke it on purpose. A handler that writes `customer.IsAdmin = request.IsAdmin` unconditionally, the only option with no null to guard on, revokes admin access on any PATCH that never mentions permissions, because the type's default and the wire format's silence are the same bit. A client updating nothing but a phone number can walk away having quietly demoted an admin.

`request.Tags` fails differently in the same request. It deserializes to all three tags, and the handler overwrites `customer.Tags` wholesale, correct only if nothing else touched the tags between read and write. The request can only say "these three tags are the complete set now," not "add vip" as its own operation. So a second client that added a fourth tag in the meantime loses it silently the moment this write lands.

## Two Different Things Called REST

Before looking for a fix, separate the two things sharing the name, because only one of them has this problem.

REST as Fielding described it is a set of architectural constraints. A uniform interface, statelessness, cacheability, layering, and hypermedia. It defines a resource as "any information that can be named," which covers a document, a composed view, or a concept with no stored row behind it. It says nothing about entities, nothing about one URL per table row, and nothing at all about partial updates. PATCH doesn't appear until RFC 5789 in 2010, a decade after the dissertation, and PUT was never ambiguous, since the representation replaces the resource state and that's the whole of it.

REST as the industry built it is a different thing. HTTP plus JSON, one URL per entity, CRUD verbs mapped onto that entity, and a single representation serving both directions. That isn't an architecture, it's a habit, and it won because it requires no design decisions.

The ambiguity in the previous section belongs entirely to the second one. That changes what kind of fix is available, because a convention whose selling point is that you don't have to think can't be repaired by requiring thought. Adding discipline to it produces something that's no longer the convention, which is what every remaining section here ends up doing.

So none of what follows is a defense of REST. The convention is what's under examination, and what survives that examination turns out not to be REST at all.

## One URL Doing Two Jobs

Before reaching for a fix, look at where the ambiguity comes from. `GET /customers/42` returns a shape. `PATCH /customers/42` accepts a shape. Convention treats those as the same shape, so every field the read returns is a field the write has to have an opinion about, including the ones this particular caller has no business touching.

Nothing in HTTP requires that. A resource isn't obligated to support every method, and content negotiation exists precisely because one resource can have more than one representation. Fielding's definition doesn't require it either. In his dissertation, "any information that can be named can be a resource," which includes a composed view of several things that are separately writable. What actually enforces the symmetry is the tooling pipeline. One model class gets serialized on the way out and deserialized on the way in, and one schema in OpenAPI describes both directions.

Consider a customer's email address. Read, it's `{ address, verified }`. Written, it's an address that starts a verification workflow, and `verified` is server-authored and not a client's to send. It's queried alongside the display name and the phone number and it's rarely updated alongside them. The read groups it with the rest of the customer. The write never does.

That case isn't exotic. It's the ordinary situation, and one representation for both directions can't express it. The rest of this post is about what follows from admitting that.

## Why Not Just Require the Whole Object?

The quickest way out is to refuse partial updates entirely and always demand a full representation as a PUT. With a PUT, every field is always present, `null` can only mean clear, and the omitted-versus-cleared question never comes up.

That answer is closer to right than it usually gets credit for. Read the standard objections closely and each one turns out to diagnose something other than PUT:

- **The client often can't produce a full representation.** A caller editing a display name may never have fetched, or been authorized to read, the `isAdmin` flag or the PII on the same entity. This is usually read as an argument against PUT. It's better read as a report about the resource. If a caller can't legitimately produce the whole thing, the whole thing isn't one resource.
- **Server-authored fields have no honest place in the body.** The client echoes `updatedAt` or a version counter and races the server, or the server quietly ignores part of the request and has reinvented presence semantics without admitting it. Those fields belong to the read representation and don't belong in a request body at all.
- **Every write carries the whole object,** so a change another actor made in between gets silently reverted. That's a concurrency problem rather than a representation problem, and it has its own answer, which the next section covers.
- **It never touches the collection half.** A full-customer PUT still carries `tags` as a whole array, so the resend-the-whole-set race survives intact. That's an identity problem, and it also has its own answer.

Full-representation PUT is a common default in some large systems, and most of its costs only bite when a resource has more than one writer. A great deal of data doesn't. A customer's contact details, a feature configuration, and a user's own settings are often owned and modified by the single actor they belong to. With one writer there's nothing to clobber and no stale copy to lose.

What makes that fragile is that the safety rests entirely on a scope assumption the endpoint almost never states. It holds only as long as "one owner, one writer" holds, and it starts quietly losing writes the day a support tool, an integration, or a background job becomes the second writer. The behavior is fine until an unstated assumption stops being true, and nothing in the contract marks where.

## Where the Discipline Went

Before REST, RPC-style services like CORBA, DCOM, and SOAP/XML-RPC tended toward naming operations directly, `UpdateCustomerPhone(id, phone)` more often than `UpdateCustomer(id, wholeCustomerObject)`. Nothing forced that choice. A broad `UpdateCustomer` call was just as legal, but naming an operation pulls a designer toward describing what it actually does, and a method that only takes a phone number can't be ambiguous about that field.

However, most of the architects and developers I watched name operations this way weren't defending against a known ambiguity bug; they were following a convention that felt like better design, without being able to fully articulate why.

The convention that replaced it gave that up without noticing. A resource endpoint carries no naming norm at all. `PATCH /customers/42` isn't obligated to say what it's touching, and that's where "omitted" and "cleared" collapse into each other. Nothing in the constraints asked for one URL per entity with a single merge-everything verb attached, so this wasn't REST discarding a discipline. It was tooling making one arrangement cheap, and cheap won.

PATCH's own specification gets blamed for the rest, and the blame lands slightly off target. RFC 5789 (2010) defined the verb and deliberately left the body format to separate specifications, on the reasoning that "no single format will be appropriate for all types of resources." What's less often remembered is that the same RFC did address discovery, recommending that `Accept-Patch` appear in the OPTIONS response for any resource supporting the method. JSON Patch landed in 2013, three years later, and JSON Merge Patch followed in 2014.

So the vacuum was narrower than the folklore suggests. The specification left the format open and shipped a way for a server to advertise which formats it took, and mainstream tooling adopted neither the formats nor the discovery mechanism. A decade of that is where the tribal knowledge comes from, in PATCH endpoints whose behavior lives in disjointed documents instead of in the schema.

## Lost Updates Are a Concurrency Problem

The strongest-sounding argument for partial updates is that a PUT carrying the whole object will clobber a change someone else made in between. It's a real hazard and it's the wrong reason to reach for PATCH, because PATCH doesn't fix it.

Two clients patching the same field clobber each other exactly as two clients PUTting the same object do. A narrower request narrows the window, and a narrowed race is still a race. What actually closes it is optimistic concurrency, which HTTP has carried since long before PATCH existed. The server returns an `ETag` on read, the client sends it back as `If-Match` on write, and a stale write gets a 412 instead of silently winning.

```http
GET /customers/42
ETag: "a3f19c"

PUT /customers/42/profile
If-Match: "a3f19c"
{ "displayName": "Ada", "phoneNumber": "555-1234" }
```

RFC 5789 says as much about its own verb, noting that PATCH is neither safe nor idempotent and pointing at conditional headers to make individual requests safe. Once concurrency has its own mechanism, the lost-update objection stops being an argument about request shape, and the remaining questions are about what a request means rather than who wins a race.

## The Read Model Is a Projection

Here's the move that dissolves the rest of it. Stop treating the entity URL as both a query result and a write target.

```http
GET /customers/42     200
PUT /customers/42     405
```

```json
{
  "id": 42,
  "displayName": "Ada",
  "phoneNumber": "555-1234",
  "email": { "address": "ada@example.com", "verified": true },
  "tags": ["newsletter", "beta"]
}
```

The GET returns a projection, a composed view over several things that are separately writable. The 405 on the same URL isn't a compromise or a REST violation. It's the contract stating out loud that this URL is a view rather than an editable entity, which is exactly the kind of thing a contract should be able to say and currently can't.

Read shape and write shape stop needing to match, because they're no longer the same resource. Applied to the email case, `verified` lives in the projection and simply doesn't exist anywhere in the write surface. There's no field to omit, no null to interpret, and no partial update to disambiguate. The ambiguity doesn't get handled. It stops being expressible.

The cost lands in a useful place. Composition happens on the read, which is one request and cacheable. Decomposition happens on the write, which is rarer and usually touches one thing. The conventional arrangement has that backwards, shaping the write body for the reader's convenience and paying for it with ambiguity on every write.

## The Write Surface Is Whatever Shares an Owner

That leaves the question of how to carve the write surface, and one rule covers it:

> Two fields belong in the same writable resource only if they share an owner, an authorization scope, and a workflow. Otherwise they're read-composed and write-separate.

Applied to the customer, `displayName` and `phoneNumber` share all three, so they travel together and a PUT of that pair is honest. A client editing contact details can produce the whole of it.

```http
PUT /customers/42/profile
{ "displayName": "Ada", "phoneNumber": "555-1234" }
```

`isAdmin` has a different authorization scope, so it gets its own resource or its own operation. Note what that does to the bug from the opening section. The accidental demotion isn't defended against, it becomes unrepresentable, because there's no longer a body that `isAdmin` could ride along in.

`email` has its own workflow, so changing it is its own operation, and the verification semantics live where a reader can see them.

Collections whose elements carry their own identity get addressed individually:

```http
POST /customers/42/tags
{ "name": "vip" }

DELETE /customers/42/tags/beta
```

Adding `vip` no longer means resending `newsletter` and `beta`. GitHub works this way for issue labels, with `POST /repos/{owner}/{repo}/issues/{number}/labels` to add and `DELETE .../labels/{name}` to remove one, alongside a `PUT .../labels` that still replaces the set for callers that genuinely want that. Stripe goes further and gives subscription items top-level endpoints of their own at `/v1/subscription_items/{id}` rather than nesting them under the subscription at all. Neither needed a new wire format to get there.

One boundary matters when applying this, because hoisting can be taken too far. Give a separate address to things that have their own identity and lifecycle, like a tag, a collaborator, or a subscription item. Don't invent one for an event. A cancellation isn't a resource that lives alongside an order, it's a transition the order goes through, and modeling it as `POST /orders/{id}/cancellations` creates a phantom entity with no lifecycle of its own. Transitions want named operations. Sub-resources want independent identity. A collection with no natural per-element key, an ordered list of steps for instance, has nothing to hang a sub-resource URL on and stays where it is.

## The Transitions Are RPC, and That's the Finding

A REST developer reading the last section has an objection ready, and it's the right one. If `PUT /customers/42/profile` replaces a slice of the customer, and changing an email address becomes its own operation, then the API has quietly turned into RPC with slashes instead of parentheses. `UpdateEmail(42, address)` became `PUT /customers/42/email`. Same call, longer spelling.

For the transitions, that reading is accurate, and agreeing with it beats dressing it up. An email change that triggers verification, an order cancellation that releases inventory, and a subscription upgrade that reprices a contract are operations. Modeling one as `POST /customers/42/email-changes` to keep a noun in the URL invents a stored collection the domain doesn't have, and the invention buys nothing. Name the operation.

The rest of it doesn't collapse the same way. `PUT /customers/42/profile`, `POST /customers/42/tags`, and `DELETE /customers/42/tags/beta` apply a closed set of verbs to addressable nouns, and that closure is what generic tooling runs on. A cache knows GET is safe and PUT isn't. A retry layer knows PUT and DELETE are idempotent and POST isn't. `If-Match` works because the resource has an identity to version against. None of that comes free in RPC, where each method's safety, idempotency, and concurrency behavior is documentation rather than protocol.

So the split doesn't rescue REST, and it isn't meant to. It sorts an API into the part that was always resource-shaped and the part that was always operation-shaped and had been hiding inside a PATCH body. The ambiguity in the opening example is what that hiding costs. REST doesn't have a good answer for the transition case, and a design that admits which half is which stops asking it for one.

## What the RPC World Does Instead

Granting the transitions to RPC doesn't grant it the rest. That lineage lost the presence discipline on its own, and it carries a standing answer to partial updates that makes it the strongest available objection to everything above.

RPC's early immunity was never structural, just a side effect of leaning granular, and it stopped staying granular for the same reason REST flattened. Nobody wants to hand-write forty single-field methods per entity. gRPC services drifted toward batched `Update` calls carrying several optional fields at once, and the identical ambiguity reappeared. It was made worse by proto3, which removed field presence for scalars, so an empty string on the wire and an unset field became the same thing until `optional` was restored in 3.15.

The answer that ecosystem converged on is the field mask. Google's AIP-134 recommends that an update method "should support partial resource update, and the HTTP verb should be `PATCH`," carrying a `FieldMask` that names the fields the request is about, and it's explicit that the update operates on the same resource a read returns, since "the response message must be the resource itself." That's a direct contradiction of the projection argument, from the most widely adopted partial-update standard in the industry, so it needs a direct answer rather than silence.

Two things are true about it. The field mask genuinely solves presence, and it solves it better than any inference from key presence, because a client that serializes its whole model with defaults everywhere is still safe when nothing outside the mask gets read. But the same standard also needs `OUTPUT_ONLY` field annotations, defined separately in AIP-203, to mark the fields that appear in a read and can't be written.

That's the same asymmetry showing up in a different place. Google's design admits that the read shape and the write shape differ and expresses the difference with field-level annotations. The argument here is that the difference is better expressed with separate addresses. Both approaches concede the premise. What makes the annotation route hard to import is that it's a protobuf feature with no plain JSON or OpenAPI equivalent, so a REST team reaching for it ends up rebuilding a second, private annotation system that its tooling doesn't understand, which is where the schema stopped being the contract in the first place.

## If You Already Shipped the Wide PATCH

Redrawing resources is a design-time answer, and plenty of readers have a live endpoint with forty fields and third-party clients that can't be coordinated. That situation has a remediation, and the honest framing is that it's a remediation rather than a default.

The mechanism is JSON Merge Patch (RFC 7396), where present keys overwrite and absent keys are left alone. The RFC reserves null for removal rather than assignment. Null values "are given special meaning to indicate the removal of existing values in the target," so under Merge Patch, "set this to null" and "clear this" aren't distinguishable and only the second one is expressible. The RFC also concedes the collection case directly, stating that "it is not possible to patch part of a target that is not an object, such as to replace just some of the values in an array."

The cheapest way to honor that in a handler is to stop binding to a typed DTO with nullable properties and bind to a map instead, where presence is just a key lookup:

```csharp
var patch = await JsonSerializer.DeserializeAsync<Dictionary<string, JsonElement>>(body);

if (patch.TryGetValue("phoneNumber", out var phone))
    customer.PhoneNumber = phone.ValueKind == JsonValueKind.Null ? null : phone.GetString();
```

What that costs is typed binding and the schema-driven validation that rides along with it, so the request gets validated against the schema explicitly instead of by the binder. A wrapper type that tracks whether a property was present in the source JSON gets to the same place while keeping typed binding, at the cost of a custom converter on every optional field.

Whichever route, one warning belongs on the deployment and is easy to miss. This change isn't free just because the wire format doesn't move. Under the naive handler, a client sending `{"phoneNumber": null}` because it serializes its whole model was harmlessly ignored. After the change, that same request clears the stored value. Serializing nulls is the default behavior in several mainstream stacks, so the clients most likely to be sending them are exactly the ones that never adopted any of this. Ship it behind a version, or a documented cutover, and not as a silent backend deploy.

JSON Patch (RFC 6902) is the other option here and it solves more in one mechanism, since its operation array covers presence and collection targeting together. What it spends is interoperability. The body becomes a list of instructions rather than a resource, which most HTTP clients, OpenAPI generators, and API explorers handle less cleanly than a plain object, and the client has to compute operations instead of building the object it would have built anyway. For an internal API with controlled clients that trade can be fine. For a business API with callers you don't own, interoperability tends to be the property you can't spend.

## What Survives Is HTTP

Look at what's left standing after all of that.

A closed set of verbs with defined safety and idempotency, which caches, proxies, and retry layers act on without being told anything domain-specific. `ETag` and `If-Match`, which give optimistic concurrency at the protocol level. Addressability, which hands you an authorization boundary, a log line, a rate-limit key, and a cache key for every thing you name.

None of that is REST. All of it is HTTP, and all of it is equally available to something you'd otherwise call RPC. The parts that are distinctively REST, like resource modeling as the organizing principle, hypermedia, and the uniform interface treated as a design constraint rather than a transport one, are the parts that didn't survive contact with a domain that has workflows and authorization scopes in it.

That's why this keeps reading as RPC with URLs. It's RPC in spirit over HTTP in mechanism, and that isn't a compromise anyone backed into. It's what remains after subtracting the parts that don't hold up.

It also narrows a carve-out that tends to get granted too easily. The common settlement is that REST fits entity-driven systems while RPC fits operation-driven ones, and a customer with a display name, a phone number, and some tags is about as entity-driven as an example gets. Its write path still dissolved into operations. Email had a workflow. The admin flag had an authorization scope. The tags had identity. What's left once those come out is small, cohesive, and genuinely resource-shaped, and that remainder is the only part where the entity framing was paying for itself.

Which answers the title. Change semantics should be a default, and making it one costs most of what people mean by REST while keeping everything they actually get from HTTP.

## Where to Start

The fix doesn't need a new protocol, a new wire format, or a bigger PATCH grammar. It needs the read and the write to stop pretending they're the same thing, and it needs an honest account of which parts of the convention were carrying weight.

- Stop defending the convention as a package. Keep the verb semantics, the conditional requests, and the addressability. Let go of one URL per entity, matching read and write shapes, and CRUD as the vocabulary
- Look at any resource where a caller can't legitimately produce the full representation. That's not a reason to reach for PATCH, it's a report that the resource is drawn wrong
- Separate the projection from the write surface. Let the aggregate URL answer GET and return 405 for writes, so the contract says which URLs are views
- Group fields into a writable resource only when they share an owner, an authorization scope, and a workflow. Fields that fail any of the three get their own address
- Give collections with identity-bearing elements their own POST and DELETE endpoints, and make sure the storage layer mutates one element atomically instead of rewriting the whole document
- Model transitions as named operations rather than as sub-resources. A cancellation or a verification isn't an entity that lives alongside the parent
- Put concurrency on `ETag` and `If-Match` rather than hoping a narrower request wins the race. A narrowed race is still a race
- Write down who owns the write path before defaulting to a full-object PUT. That shortcut is safe only while a single actor owns the resource
- For an endpoint already in production, treat Merge Patch on a map-bound handler as remediation, document the null convention in the schema, and ship the behavior change behind a version rather than silently
