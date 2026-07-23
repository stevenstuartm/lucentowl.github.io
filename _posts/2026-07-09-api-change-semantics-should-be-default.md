---
layout: post
title: "Can We Agree API Change Semantics Should Be a Default?"
date: 2026-07-09
description: "Most APIs still can't tell the difference between a field or collection item the client's update left alone and one it explicitly cleared. That is a gap in change semantics whose source is not simply a missing feature but rather a discipline the industry once had and quietly gave up. The server-side fix is close to free. What the client pays depends on how far the discipline has to travel through existing code."
tags: [architecture, api-design, rest, grpc, design-patterns]
author: steven-stuart
---

Any API endpoint that accepts a partial update has to guess whether an omitted field was left alone on purpose, whether it was meant to be cleared, or whether a missing collection item fell out of scope or was meant to be removed.

I've watched architects senior to me hit this exact question and not answer it, and when it landed on me, I didn't answer it either. Every fix I shipped was a single-property patch explained in a wiki page instead of in the contract itself, rediscovered by whoever hit it next. There was rarely time to go further. The gap got treated as an edge case, not a design question, so a hack closed the one case that was biting and the team moved on. This is an old problem, old enough to predate REST and JSON, and it still gets buried under a fix for one field and quietly assumed to have resolved itself.

The scope of this post remains bounded within the most common and most interoperable representation of the: partial updates sent as JSON over REST. Other stacks have their own answers, and protobuf over gRPC even hands you part of one for scalar fields. The goal here is to discuss the fix that travels furthest with the least tooling, not a tour of every technology.

## The Three Things Any Change Has to Express

Every partial update is trying to express one of three intents for each part of a resource:

- **Leave alone.** The field isn't part of this change, and the server should treat it as if the client said nothing about it.
- **Set explicitly.** The field takes a new value, including null or zero, and that has to be distinguishable from leaving it alone.
- **Change one element of a collection.** A single item is added or removed without the client resending the whole collection to say so.

A typical PATCH endpoint blurs all three at once. Say customer 42 has a phone number on file and two tags, `newsletter` and `beta`, and a client sends this request to clear the phone number and add a third tag, `vip`:

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

`request.PhoneNumber` is null here for the same reason it would be null if `phoneNumber` had been left out of the body entirely. Nullable is the only state available for "nothing here," so it has to mean both "leave alone" and "clear."

The ambiguity can run the opposite direction too, and less benignly. An omitted `isAdmin` key deserializes to `false`, the same value sent to revoke it on purpose. A handler that writes `customer.IsAdmin = request.IsAdmin` unconditionally, the only option with no null to guard on, revokes admin access on any PATCH that never mentions permissions, because the type's default and the wire format's silence are the same bit. A client updating nothing but a phone number can walk away having quietly demoted an admin.

`request.Tags` fails differently in the same request. It deserializes to all three tags, and the handler overwrites `customer.Tags` wholesale, correct only if nothing else touched the tags between read and write. The request can only say "these three tags are the complete set now," not "add vip" as its own operation. So a second client that added a fourth tag in the meantime loses it silently the moment this write lands.

## RPC Had This by Accident

Before REST, RPC-style services like CORBA, DCOM, and SOAP/XML-RPC leaned toward naming operations directly, `UpdateCustomerPhone(id, phone)` more often than `UpdateCustomer(id, wholeCustomerObject)`. Nothing forced that choice. A broad `UpdateCustomer` call was just as legal, but naming an operation pulls a designer toward describing what it actually does, and a method that only takes a phone number can't be ambiguous about that field.

However, most of the architects and developers I watched name operations this way weren't defending against a known ambiguity bug; they were following a convention that felt like better design, without being able to fully articulate why.

## REST Threw It Away, Mostly by Accident

REST, as Fielding described it, doesn't require flattening a domain into one CRUD endpoint per entity. Resources can model arbitrary state transitions, not just rows in a table. But REST, as the industry actually built it, collapsed toward exactly that: one URL per entity and one PUT or PATCH that replaces or merges the whole thing. That's not REST's architectural constraint. It's what REST-as-tooling made cheap, and cheap won.

An RPC method had to be named, so it had to be about one thing. A REST resource endpoint carries no such norm. `PATCH /customers/42` isn't obligated to say what it's touching, and that's exactly where "omitted" and "cleared" collapse into each other.

PATCH's own specification widened the gap instead of closing it. RFC 5789 (2010) defined the verb but left its body format unspecified for JSON Patch and JSON Merge Patch to fill in later. JSON Patch landed in 2013, three years after PATCH; JSON Merge Patch followed in 2014. Every team using PATCH in that gap invented its own body semantics, and even once both RFCs existed, neither became a default in mainstream tooling. That vacuum, followed by a decade of nobody filling it, is where the tribal knowledge comes from: PATCH endpoints whose behavior lives in disjointed documents instead of the schema.

## Neither Extreme Is the Fix

RPC doesn't get to be the disciplined one here. Its immunity was never structural, just a side effect of leaning towards the granular, and RPC stopped staying granular for the same reason REST flattened. Nobody wants to hand-write and maintain forty single-field methods per entity. gRPC and protobuf-based services drifted toward batched `Update` RPCs carrying several optional fields at once, and the identical ambiguity reappeared the moment they did. `UpdateCustomer(id, phone?, tags?)` has the same "is null cleared or untouched" problem a REST PATCH body does.

For most APIs, what needs rebuilding isn't the protocol. It's two narrow but universally applicable habits, expressible in plain JSON over REST or an ordinary RPC call.

## Two Defaults That Reclaim the Discipline

### 1. JSON Merge Patch, Paired With a Presence Wrapper

The `{ "phoneNumber": null, "tags": [...] }` body from the opening section is already JSON Merge Patch (RFC 7396) compliant: present keys overwrite, and everything else is left alone. The RFC alone doesn't fix the DTO trap, since a naive deserializer still can't tell "present with null" from "absent." The fix is pairing it with a presence wrapper. Every optional field gets wrapped in a type that tracks whether it was present, instead of deserializing into a plain nullable property.

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
```

The struct alone does nothing until a converter runs during deserialization, and that converter only fires when the property's key actually shows up in the source JSON.

```csharp
public class SpecifiedConverter<T> : JsonConverter<Specified<T>>
{
    public override Specified<T> Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        => new(JsonSerializer.Deserialize<T>(ref reader, options));

    public override void Write(Utf8JsonWriter writer, Specified<T> value, JsonSerializerOptions options)
        => JsonSerializer.Serialize(writer, value.Value, options);
}
```

System.Text.Json only invokes a property's converter when that property exists in the source JSON. A `Specified<string?>` property stays at its default, `IsSpecified: false`, whenever the client leaves the key out, because the converter never runs. The moment the client sends the key, `Read` runs and sets `IsSpecified: true`, whether the deserialized value is a real string or an explicit null:

```csharp
if (request.PhoneNumber.IsSpecified)
    customer.PhoneNumber = request.PhoneNumber.Value;
```

Nothing about the wire format changes. The JSON payload and the OpenAPI schema stay identical to the naive version. This is a deserialization-time fix, not a contract change, so it ships as an ordinary backend deploy with no client coordination and no version bump.

### 2. Resource Hoisting: Give Identity-Bearing Collections Their Own Endpoint

The `/customers/42` example resolves once tags stop living inside a `PATCH` to the customer entirely. Any collection whose elements have their own identity, like a tag name, a collaborator's user ID, or a subscription item, should get its own addressable endpoint from the day it's designed. In other words, the resource has been hoisted: promoted as a first-class, independently addressable resource instead of leaving it as a field on its parent's PATCH body.

```http
POST /customers/42/tags
{ "name": "vip" }

DELETE /customers/42/tags/beta
```

Adding `vip` no longer means resending `newsletter` and `beta`, and there's no request left that means "replace the whole set." A client can only add one tag or remove one, and each request says what it means without depending on what the rest of the collection looked like a moment before.

The dedicated endpoint also closes a race condition the original resend-the-whole-collection shape invites. Client A and client B both fetch the current tags, B adds one and writes back, and A's stale copy overwrites it moments later with no error to either side. GitHub's labels endpoint, Stripe's subscription items, and `/repos/{id}/collaborators/{user}` all work this way, and none needed a new wire format to get there.

A dedicated endpoint costs close to nothing up front and removes an entire category of bug before anyone has to think about it again, except for a collection with no natural per-element key, an ordered list of steps, for instance, where there's nothing to hang a sub-resource URL on.

The same lever works on scalars too, and not only for the ambiguity problem. A field like email, which usually gates authentication, tends to need its own verification workflow regardless of presence semantics, and the only time it travels in the same body as everything else is at creation, where there's no partial update to disambiguate in the first place.

## Interoperability Is the Default

Both defaults chosen here solve their piece of the problem using nothing but ordinary JSON over ordinary REST: a plain object body, a plain POST/DELETE pair. Of course, that's not the only way to solve either problem.

For example, JSON Patch (RFC 6902) could replace both defaults at once. Its operation array (add, remove, replace, move, copy, test), solves omission clarity the way the presence wrapper does and collection targeting the way resource hoisting does, in one mechanism instead of two. What that costs is interoperability:

- A client has to compute an array of operations instead of building the object it would build anyway
- The body itself, a list of instructions rather than a resource, is a shape most HTTP clients, OpenAPI generators, and API explorers don't render or produce as cleanly as a plain object

Splitting the two problems costs a little more in mechanism count but buys back nearly all of that interoperability. A PATCH body stays a plain object whether it's clearing a scalar or not, and a POST or DELETE to a sub-resource is a shape every HTTP client, OpenAPI spec, and API explorer already knows how to build without custom tooling. Neither mechanism asks a caller to learn a new grammar, content type, or client library. That's why these two are the defaults instead of JSON Patch. It isn't that JSON Patch is technically weaker, since it solves more in a single mechanism. It's that interoperability is the property a typical business API can't trade away, and JSON Patch spends it first.

## The Presence Wrapper Only Helps a Client That Uses One

The API already trusts and/or verifies the calling identity to be who it claims and to own the data it's changing. That's what authorization exists to police, and nothing about Merge Patch moves that boundary. What Merge Patch sharpens is the trust that the request's content correctly reflects what the caller means. The same trust already extended to every field's value is now extended to whether it was included at all. A client that gets this wrong doesn't break the contract or bypass authorization. It just hasn't adopted the discipline yet, and guaranteeing every caller's request-building was never the API's job to begin with.

```csharp
var options = new JsonSerializerOptions
{
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
};

var request = new UpdateCustomerRequest(PhoneNumber: null, Tags: null);
JsonSerializer.Serialize(request, options); // "{}"
```

`WhenWritingNull` looks like good hygiene until a caller needs to clear the phone number. The serializer can't tell "didn't set this" from "set this to null" any more than the naive server handler could, so it drops the field either way with nothing in the response to say so.

For a client starting today, two moves cover most of it:

- A field with its own identity or workflow belongs on its own endpoint, not folded into a PATCH.
- Everything else that stays in the PATCH needs its presence computed correctly. Diff against the fetched object, or use presence types for a blind write.

## Where to Start

The fix doesn't need a new protocol, a new wire format, or a bigger PATCH grammar. It needs treating presence and identity as first-class questions.

- This isn't only a REST problem. Batched RPC calls hit the same ambiguity when they consolidate, so a protocol change isn't a fix on its own
- Audit PATCH endpoints and batched RPC methods for fields where leaving a value alone and clearing it collapse into the same signal, the exact gap both lineages reintroduced on consolidation
- Give any collection with identity-bearing elements its own POST/DELETE endpoint or RPC method before it grows large enough to hurt, and make sure the storage layer mutates one element atomically instead of rewriting the whole document
- Hoist a scalar the same way when it has its own workflow, like email re-verification, or when most callers only ever touch that one field
- Wrap every optional scalar field in a presence type from the first endpoint you write, not just the ones you've been burned by. On the server this changes nothing about the wire format and costs close to nothing to add
- Check the client's own serialization defaults for the same gap. A diff against already-fetched state is usually cheaper than threading a wrapper type through the UI. The wrapper is the fallback for a blind write with no fetch to diff against
