---
layout: post
title: "Can We Agree API Change Semantics Should Be a Default?"
date: 2026-07-09
description: "Most APIs still can't tell a field the client left alone from one it explicitly cleared, a gap in change semantics that isn't a missing feature but a discipline the industry once had and quietly gave up. Treating it as a day-one default costs almost nothing."
tags: [architecture, api-design, rest, grpc, design-patterns]
author: steven-stuart
---

Any API endpoint that accepts an update to data almost never can fully trust the intent of the client's request. The API does not know if something was left out intentionally or meant to be set to a default value or even if a collection item was out of scope or was meant to be removed.

The gap of expressing change intent is a problem I've been struggling with for most of my career without knowing what I was even struggling with. Early on, I watched architects senior to me hit this exact question and not answer it. Later, when it landed on me, I didn't answer it either, not really. Every fix I shipped was a single-property patch, its behavior explained in a comment or a wiki page instead of in the contract itself, understood by whoever wrote it and rediscovered by whoever hit it next.

There was rarely time to go further than that. The gap tended to show up as an edge case, not a design question, and once a hack closed the specific case that was biting us, the team moved on to the next thing on the plan. It took me a long time to face this directly, and I don't think that's unique to me. This is an old problem, old enough to predate REST entirely, and the wider community doesn't tend to face it directly either. It gets buried under a fix for one field, forgotten once the immediate pain stops, and quietly assumed to have resolved itself.

## RPC Had This by Accident

Before REST, RPC-style services like CORBA, DCOM, and SOAP/XML-RPC leaned toward naming operations directly: `UpdateCustomerPhone(id, phone)` more often than `UpdateCustomer(id, wholeCustomerObject)`. Nothing in RPC forced that choice, a broad `UpdateCustomer` call was just as legal, but naming an operation pulls a designer toward describing what it actually does, and a method that only takes a phone number can't be ambiguous about that field. None of this is evidence that CORBA, DCOM, or XML-RPC's designers were reasoning about this specific problem, though: a typed parameter list has no room for the ambiguity to begin with, a fact about interface shape, and the ambiguity itself is a JSON-era condition their world hadn't encountered yet.

Most of the architects I watched name operations this way weren't defending against a known ambiguity bug. They were following a convention that felt like better design, often without being able to fully articulate why it beat the alternative, and intent clarity came along with it as a side benefit of a habit whose actual reasoning mostly went unstated.

## REST Threw It Away, Mostly by Accident

REST as Fielding described it doesn't require flattening a domain into one CRUD endpoint per entity. Resources can model arbitrary state transitions, not just rows in a table. But REST as the industry actually built it, especially once frameworks started scaffolding CRUD directly from ORM models like Rails resources, ASP.NET Web API controllers, and Django REST Framework viewsets, collapsed toward exactly that: one URL per entity, one PUT or PATCH that replaces or merges the whole thing. That's not REST's architectural constraint. It's what REST-as-tooling made cheap, and cheap won, in my own early services as much as anyone else's.

The result inherited RPC's discarded ambiguity and generalized it. An RPC method had to be named, so it had to be about one thing. A REST resource endpoint carries no such requirement. `PATCH /customers/42` isn't obligated to say what it's touching; it's whatever shape the body happens to have, and that shape is exactly where "omitted" and "cleared" collapse into each other.

PATCH's own specification widened the gap instead of closing it. RFC 5789 (2010) defined the verb but deliberately left its body format unspecified, so that JSON Patch and Merge Patch could be defined later as separate content types layered on top. Both of those RFCs landed in 2013, three years after PATCH itself, and during that gap every team using PATCH invented its own body semantics from nothing. Even after 2013, neither RFC became a default in mainstream web tooling. That three-year vacuum, followed by a decade of nobody filling it, is where the tribal knowledge comes from: PATCH endpoints whose actual behavior lives in one engineer's memory instead of in the schema.

## RPC Doesn't Get to Claim the High Ground Either

None of this makes RPC the disciplined one. Its immunity was never structural. It was a side effect of staying maximally granular, and RPC stopped staying granular for the same reason REST flattened: nobody wants to hand-write and maintain forty single-field methods per entity. gRPC and protobuf-based services drifted toward batched `Update` RPCs carrying several optional fields at once, and the moment they did, the identical ambiguity reappeared. `UpdateCustomerProfile(id, phone?, email?, name?)` has the same "is null cleared or untouched" problem a REST PATCH body does.

Protobuf's own history proves it. `FieldMask` exists because proto3 lost scalar field presence, and RPC services needed a way to say which fields a request actually meant to touch. That's not RPC solving a problem REST has. That's RPC reinventing the same hole once the same consolidation pressure reached it, and needing its own bolted-on patch to climb back out, the same "just add another optional field" request I'd already watched reopen this exact bug on the REST side.

The real axis was never REST versus RPC. It's granularity versus consolidation. Both lineages get pulled toward consolidation because nobody wants an unbounded number of endpoints or methods to maintain, and both lose the same clarity once they get there. REST lost it earlier and harder because CRUD scaffolding made consolidation the default from day one. RPC lost it later, but it still lost it, and FieldMask is the receipt.

## Neither Extreme Is the Fix

What needs rebuilding isn't a protocol choice. It's two narrow habits, expressible in plain JSON over REST or in an ordinary RPC call, that restore the clarity granularity used to give away for free.

## The Three Things Any Change Has to Express

Every partial update is trying to express one of three intents for each part of a resource: leave this field alone, set it to a specific value (including null or zero), or change one element of a collection without resending the whole thing.

A typical PATCH endpoint blurs at least one of these without anyone noticing:

```csharp
public record UpdateProfileRequest(string? PhoneNumber);

if (request.PhoneNumber is not null)
    profile.PhoneNumber = request.PhoneNumber;
```

`request.PhoneNumber` is null whether the client's JSON omitted `phoneNumber` entirely or sent `"phoneNumber": null` on purpose. This handler can set a phone number or leave it alone, but it can never clear one on purpose. Making every property nullable doesn't fix that, since nullable is already how "explicitly cleared" gets represented. The type needs a third state, not a more permissive version of the same two.

None of this stays hidden because the fix is hard. It stays hidden because nothing in a `string?` property signals that a decision got skipped, and by the time a support tool sends an explicit clear and a customer's phone number quietly stays put, the request that caused it is long gone from the logs.

## Two Defaults That Reclaim the Discipline

Reaching for JSON Patch or FieldMask here overcorrects. Both were built to patch consolidation after the fact, at the cost of a new wire format or a second structure the client has to keep in sync. Two changes close almost all of the actual problem instead, and they belong in the design on day one, not on a list of things to revisit once a collection gets large or a support ticket shows the ambiguity already bit someone. Waiting isn't the cautious option. The moment an ambiguous PATCH endpoint ships, some integration starts depending on whatever its ambiguity happens to resolve to, silently ignoring a null or silently dropping a field, and fixing the semantics later doesn't just cost engineering time, it changes real behavior underneath a client that built against the bug. Neither change below has that problem, because neither touches the wire format at all; there's no version to bump and no contract to renegotiate, which removes the only excuse for treating them as optional.

### Give Identity-Bearing Collections Their Own Endpoint

Any collection whose elements have their own identity, a label name, a collaborator's user ID, a subscription item, gets its own addressable endpoint from the day it's designed, not after it's grown large enough to hurt:

```http
POST /issues/123/labels
{ "name": "bug" }

DELETE /issues/123/labels/bug
```

Adding one label no longer means resending the other four hundred. The lost-update risk on that slice of the resource disappears entirely, because each element has its own request and its own response. GitHub's labels endpoint, Stripe's subscription items, and `/repos/{id}/collaborators/{user}` all work this way, and none of them needed a new wire format to get there.

The same lever applies outside REST. A gRPC service with a dedicated `AddLabel`/`RemoveLabel` RPC gets the same benefit that a generic `UpdateIssue` carrying a repeated field doesn't, and it's rarely named as the same pattern only because REST discourse claimed it first. It is, at bottom, the same granularity RPC had by accident before consolidation pressure erased it, applied deliberately this time instead of as an artifact of naming every method.

This isn't a fix to reach for once a collection grows large enough to hurt. A dedicated endpoint costs close to nothing up front, and it removes an entire category of bug before anyone has to think about it again. The one place it doesn't fit cleanly is a collection with no natural per-element key, an ordered list of steps, for instance, where there's nothing to hang a sub-resource URL on.

### Pair Plain JSON With a Presence Wrapper

For flat scalar fields, the same day-one commitment applies. Every optional field gets wrapped in a type that tracks whether it was present in the payload at all, instead of deserializing into a plain nullable property, whether or not this particular field looks like it will ever need to distinguish cleared from untouched:

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

A property typed `Specified<string?>` stays at its default, unset, whenever the client leaves the key out, and flips to set the moment the client sends it, whether the value is a real string or an explicit null:

```csharp
if (request.PhoneNumber.IsSpecified)
    profile.PhoneNumber = request.PhoneNumber.Value;
```

Nothing about the wire format changes. The JSON payload the client sends, the OpenAPI schema, and the generated client code stay identical to the naive version. This is a deserialization-time fix, not a contract change, so it ships as an ordinary backend deploy with no client coordination and no version bump.

Once collections are hoisted to their own endpoints, the one thing JSON Patch still offers over this, targeting individual elements inside a nested structure, mostly disappears, and what's left, telling omitted from cleared on a handful of scalar fields, is exactly what a presence wrapper solves using nothing but standard JSON.

## When the Defaults Aren't Enough

Neither default covers every context. A configuration system with multiple independent controllers writing to the same object, an autoscaler and a human both touching a Kubernetes Deployment, needs field-level ownership that neither hoisting nor a presence wrapper provides. That's what server-side apply exists for. A fleet of constrained devices or a service mesh handling thousands of RPCs per second pays for every byte it sends, in battery or in CPU, and that's the context FieldMask was built to serve. Those tools solve problems the defaults above don't touch, and adopting them is the right call once the problem they solve is actually present.

What doesn't hold up is reaching for that machinery by default in an ordinary business API, when the two changes above would have closed the actual gap for a fraction of the cost.

None of this would have saved me the years I spent explaining a workaround in a wiki page instead of in the code itself, but it might save someone else that time.

## Where to Start

- Stop treating this as a REST problem or an RPC problem; the same consolidation pressure erodes it in both, so the fix has to be a habit independent of protocol
- Audit PATCH endpoints and batched RPC methods for nullable or optional fields standing in for a three-state signal; anywhere omitted and cleared need to mean different things, that's the gap both lineages reintroduced the moment they consolidated
- Give any collection with identity-bearing elements its own POST/DELETE endpoint or dedicated RPC method before it grows large enough to hurt, not after
- Wrap every optional scalar field in a presence type from the first endpoint you write, not just the ones you've already been burned by; it changes nothing about the wire format, so there's no cost to applying it everywhere
- Reach for JSON Patch, FieldMask, or server-side apply only once you can name the specific pressure, multi-actor ownership or wire compactness, that the two defaults above don't cover
