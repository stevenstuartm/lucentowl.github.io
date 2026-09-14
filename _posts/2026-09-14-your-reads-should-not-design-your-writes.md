---
layout: post
title: "Your Reads Should Not Design Your Writes"
date: 2026-09-14
description: "API writes that go through a wide body, whether PATCH or PUT, can't reliably tell an omitted field from a cleared one, and patch formats push the fix onto every client. Normalizing the write surface avoids both, keeping reads as composed views and writes as small resources any client can replace whole."
tags: [architecture, api-design, rest, design-patterns]
author: steven-stuart
---

Any API endpoint that writes a nullable field or a collection has to work out what the client meant by it. A partial update has to decide whether an omitted field was left alone on purpose or meant to be cleared. A full replacement with PUT only moves the question, because it clears whatever arrives missing or null, which is correct only if the client sent every field on purpose. A collection in either body can only be sent whole, so adding one element means resending the rest. Few problems have left me as dizzy as this one, not only because the problem is challenging, but because of how many competing solutions keep getting promoted for it, from patch formats to field masks to change-tracking client libraries.

Most of those solutions ask every client to get something subtle right, when what most teams need is a write surface simple enough that any client can call it correctly on the first try. The simplest way there, I think, sidesteps all of them by not writing through the read at all. When a group of fields has a single owner, when a change starts a workflow, or when a collection's items come and go individually, each of those can have its own path. A write then sends the whole of something smaller rather than a piece of something large. That can look like a workaround at first, but I'd argue it's closer to healthy normalization in the write surface.

## Write Intentions Exceed Request Semantics

Every fix for this runs into the same limit. Each field in a write body is trying to carry one of four intents:

- **Leave alone.** The field isn't part of this change.
- **Set a value.** The field takes a new value, including zero, empty, or false.
- **Clear.** The field's current value is removed, leaving it with no value.
- **Change one element of a collection.** An item is added or removed without resending the rest.

The JSON body can express the first three. A property can hold a value, be set to `null`, or be left out of the body entirely, which lines up with set, clear, and leave alone. But when the server deserializes that body into a typed request object, a nullable property offers only two states, a value or null, so a property that was left out and one that was sent as `null` both arrive as null. The difference is gone before any handler code runs, and every nullable field ends up supporting only two of the three intents, usually without anyone writing down which two. PUT picks set and clear and drops leave alone, which holds only while every client really sends every field. A serializer that skips nulls, or a client built before a field existed, breaks that without any error. The fourth doesn't fit a single field at all, because a collection property can only be sent whole. The lost intent stays invisible until a request needs it.

## An Omitted Field and a Deactivated Customer

Customer 42 has a phone number and an active flag. A client updates the phone number and mentions nothing else:

```http
PATCH /customers/42
{ "phoneNumber": "555-1234" }
```

The handler binds that body to a request type and applies it:

```csharp
public record UpdateCustomerRequest(string? PhoneNumber, bool IsActive);

customer.PhoneNumber = request.PhoneNumber;
customer.IsActive = request.IsActive;
```

`isActive` never appeared in the body. JSON can tell a missing property from one set to `false`, but a non-nullable `bool` can't, so binding fills the gap with `false`, and a request that set a phone number has quietly deactivated the customer.

The standard remedy is to make every property nullable and skip the ones that arrive null:

```csharp
public record UpdateCustomerRequest(string? PhoneNumber, bool? IsActive);

if (request.PhoneNumber is not null) customer.PhoneNumber = request.PhoneNumber;
if (request.IsActive is not null) customer.IsActive = request.IsActive.Value;
```

For `IsActive`, that works. A customer is always either active or inactive, so the column never holds null and `null` is free to mean "the client said nothing."

The cost lands on `PhoneNumber`. A customer can have no phone number, so `null` already meant "remove it." The guard gives the same `null` a second meaning, "leave it alone," and honors that one, so the phone number can no longer be removed through this endpoint.

The remedy fixes every field that can't be empty, and breaks every field that can. The usual response is another special case for the field that broke, which leaves the design that broke it in place for the next one.

## Clients Hold State, Not Changes

A handler can fix the server side by reading the raw document instead of a bound type, or by accepting a patch format that encodes intent explicitly. But a partial update is only as correct as the client that built it, and the client has to know which fields the user actually touched.

The form often does know. Form libraries like Angular's reactive forms and React Hook Form track which fields are dirty. But the form isn't what sends the request. A view model maps the form's values onto a DTO, a service layer passes that DTO along, and a generated SDK type turns an unset property into a default or a null. By the time a request leaves the client, "the user didn't touch this" has usually been flattened into a value. Carrying that intent means threading change tracking through every one of those layers, in every client, including partners' clients.

Diffing the loaded document against the one about to be sent doesn't escape this. The diff runs on whatever reached the end of the pipeline, so a field a mapping layer turned into a default or a null shows up as a change the user never made.

## Patch Formats and Design Guides Leave the Client Problem in Place

The standards never settled partial updates. [RFC 5789](https://datatracker.ietf.org/doc/html/rfc5789){:target="_blank" rel="noopener noreferrer"}, which defined PATCH in 2010, left the body format open on the expectation that "no single format will be appropriate for all types of resources." Two kinds of answer grew into that gap. Patch formats are standardized request bodies that describe each change explicitly. API design guides are the rulebooks large companies publish for how their own APIs should behave, including how they accept updates. Teams tend to adopt either one as the professional answer.

[JSON Patch](https://datatracker.ietf.org/doc/html/rfc6902){:target="_blank" rel="noopener noreferrer"} encodes all four intents explicitly, as a list of add, remove, and replace operations addressed by path. [JSON Merge Patch](https://datatracker.ietf.org/doc/html/rfc7396){:target="_blank" rel="noopener noreferrer"} is simpler and covers three of them, but replaces arrays whole. Neither can tell a client which fields changed, so adopting one hands every caller the change-tracking problem from the previous section.

Design guides carry a different risk, because unlike patch formats they aren't neutral standards. Many of them are one company's internal practice, published for others to read. The field masks in Google's [AIPs](https://google.aip.dev/1){:target="_blank" rel="noopener noreferrer"} are designed around protobuf messages and generated clients that Google produces for its own APIs, and the client still has to fill each mask with the fields that changed. Microsoft publishes [its own guidelines](https://github.com/microsoft/api-guidelines){:target="_blank" rel="noopener noreferrer"} in the hope that other organizations will "create guidelines that are appropriate for them."

Those choices fit organizations that own their clients, generate their SDKs, and employ governance teams to enforce conformance. Copied into a team that has none of that, they become cargo culture, trading the simple write surface the team needs for machinery built around someone else's clients.

## The Wide Write Is a Normalization Failure

`GET /customers/42` returns a shape, and by convention `PATCH /customers/42` accepts the same shape. Every field the read returns becomes a field the write has to have an opinion about, including the ones a given caller has no business touching.

A read is allowed to be a composition. A customer screen wants the display name, the phone number, the email and whether it's verified, the active flag, and the tags, all in one request, and serving that in one GET is good design. What the screen receives is a view over several things with different rules. The email starts a verification workflow when it changes, and `verified` is set by the server. Deactivation carries its own permission and consequences. Tags are a collection whose elements come and go individually.

The wide write happens when the view becomes the write target, usually because one model serves both directions. That's a governance gap more than a technical one. Nobody decided what the write surface should be, so the read model decided for them, and every rule inside the view now has to be enforced field by field inside a single body.

Replacing the view whole with PUT doesn't rescue it. [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#name-put){:target="_blank" rel="noopener noreferrer"} defines PUT as replacing "the state of the target resource" with "the state defined by the representation enclosed," so in principle every field is present and nothing has to be interpreted. In practice that only works when every client can produce every field and is entitled to replace every one of them. The customer view mixes fields no single caller is entitled to replace.

## Normalize the Write Surface

The word comes from databases on purpose. A normalized schema stores each fact in one place, so an update changes that place and can't contradict another, and queries join those facts back into whatever views the application needs. A normalized write surface works the same way, except that fields are grouped by the rules around them rather than by how the data depends on other data. Each field is written where its owner, permission, and workflow live, so a write can't carry a change its caller had no right to make, while reads compose those resources into views shaped for each screen. Teams familiar with CQRS will recognize the split between read and write models, but here both sides stay ordinary HTTP resources, with no separate command pipeline to build.

### Three Tests Decide What Shares a Resource

Two fields belong in the same writable resource only when they pass all three tests:

- **Same owner.** The same party is entitled to decide both values.
- **Same authorization scope.** A caller needs the same permission to change either one.
- **Same workflow.** Changing either one triggers the same consequences, or none.

Fields that fail any test are composed on read and separated on write.

| Field | Owner | Authorization scope | Workflow | Write |
| --- | --- | --- | --- | --- |
| `displayName` | Customer | Edit own profile | None | `PUT /customers/42/profile` |
| `phoneNumber` | Customer | Edit own profile | None | `PUT /customers/42/profile` |
| `email` | Customer | Edit own profile | Verification email | `PUT /customers/42/email` |
| `verified` | Server | Not client-writable | Set by verification | None |
| `isActive` | Operations | Manage account status | Deactivation checks | `POST /customers/42/deactivate` |
| `tags` | Support | Manage tags | None | `POST` and `DELETE /customers/42/tags` |

`displayName` and `phoneNumber` pass all three tests, so a client editing contact details can produce the whole resource:

```http
PUT /customers/42/profile
{ "displayName": "Ada", "phoneNumber": null }
```

Both fields are always present in this body, so `"phoneNumber": null` can only mean remove it, and the phone number from the opening can be cleared again.

`email` fails only the workflow test, and that's enough to separate it, because the verification rules then live on the one endpoint that triggers them. `isActive` fails on owner and scope, so it becomes a named operation. The opening bug isn't defended against but made unrepresentable, because there's no longer a body it could ride along in.

### Collections With Identity Get Their Own Addresses

Collections whose elements carry identity get addressed individually, which is how GitHub handles [issue labels](https://docs.github.com/en/rest/issues/labels){:target="_blank" rel="noopener noreferrer"} and how Stripe exposes [subscription items](https://docs.stripe.com/api/subscription_items){:target="_blank" rel="noopener noreferrer"}:

```http
POST /customers/42/tags
{ "name": "vip" }

DELETE /customers/42/tags/beta
```

Normalization can be taken too far. A deactivation doesn't have its own identity and lifecycle the way a tag does, so unless the domain keeps deactivations as records a client can list, `POST /customers/42/deactivations` invents a collection no GET can back. The named operation `POST /customers/42/deactivate` describes the transition more honestly.

A collection with no natural per-element key, like an ordered list of steps, has nothing to hang a sub-resource URL on. It stays in its parent's body and is replaced whole along with it.

## What Normalizing Costs

### More Calls, Usually Along Lines the Work Already Follows

The obvious objection is call count, usually raised on behalf of admin and operations apps on the assumption that they edit everything at once. They rarely do. Their work moves from correcting contact details to reviewing product access to deactivating an account, and each step is a write this design already names. The endpoint count goes up, but reads can still be aggregates shaped for whichever app uses them.

The customer screen from earlier is the harder case, because it shows every concern on one page. If it offers a single Save button across all of them, that button now makes one call per concern it touches plus one per tag added or removed, and the screen has to report which ones failed. A screen shaped like the write surface tends to serve users better, with contact details saved together and email change and deactivation as their own actions, each with its own confirmation. Much of modern interface design already leans this way. Toggles tend to save the moment they're flipped, and tags shown as chips often save as each one is added or removed, so the screen's own controls line up with the narrow writes. Not every screen works like that, but where UX conventions lean, they lean toward small, scoped changes rather than one Save for the whole page. A deactivation that rides along with a phone-number edit is the opening bug with a nicer interface.

### Cross-Concern Actions Lose Implicit Atomicity

A wide PATCH is usually applied all or nothing, and separate calls are not, so a failure between them leaves the customer half-changed. If an action needs that atomicity, it's a use case, and it belongs in a named operation that performs the writes together rather than in a general-purpose merge.

### Concurrent Edits Collide on Whole Resources

A correct partial update has one advantage this design gives up. If one support agent changes `displayName` while another changes `phoneNumber`, two partial updates touch different fields and both survive. Two PUTs to `/customers/42/profile` each send both fields, so the later one silently restores the value the earlier one replaced. Smaller resources narrow that window, because an email change or a deactivation can no longer collide with a profile edit, but they don't close it. An `If-Match` header carrying the resource's ETag turns the silent overwrite into a 412 the client can resolve.

### Migration Runs Alongside the Wide Write

An API that partners already call through a wide PATCH can't simply start answering 405. The narrow endpoints go in alongside the wide one, clients move over screen by screen, and once traffic to the wide write stops, `/customers/42` keeps serving the composed view while writes to it answer 405 with an `Allow: GET` header. While both exist, the wide PATCH has to route each field through the rules its narrow endpoint enforces, or it becomes a back door around the design.

## Letting Reads and Writes Take Different Shapes

I've come to think most software problems trace back to a failure to align with the need, a failure of architecture governance, or a failure to change direction. The wide PATCH shows all three, in adopting a spec written for someone else's clients, in letting the read model decide a write surface nobody owned, and in special-casing each ambiguous field instead of changing the design that keeps producing them. None of the corrections takes new technology:

- Group fields into a writable resource only when they share an owner, an authorization scope, and a workflow
- Give collections with identity-bearing elements their own POST and DELETE endpoints
- Name the operation when a change carries a workflow or has to be atomic across concerns
- Require `If-Match` on PUTs to resources more than one person edits
- Move existing clients onto the narrow endpoints, then let aggregate URLs answer GET and refuse writes
- Adopt a spec only when you have the problem it was written for

What they do take is letting the read shape and the write shape be different things.
