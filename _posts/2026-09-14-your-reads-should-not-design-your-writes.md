---
layout: post
title: "Your Reads Should Not Design Your Writes"
date: 2026-09-14
description: "API writes that go through a wide body, whether PATCH or PUT, can't reliably tell an omitted field from a cleared one, and patch formats push the fix onto every client. Normalizing the write surface avoids both, keeping reads as composed views and writes as small resources any client can replace whole."
tags: [architecture, api-design, rest, design-patterns]
author: steven-stuart
---

Any API endpoint that writes a nullable field or a collection has to work out what the client meant by it. A partial update has to decide whether an omitted field was left alone on purpose or meant to be cleared. A full replacement with PUT only moves the question, because it clears whatever arrives missing or null, which is correct only if the client sent every field on purpose. A collection in either body can only be sent whole, so adding one element means resending the rest. It bites hardest on the records most business APIs are made of, like customers, orders, and accounts that people edit through forms and typed clients. Few problems have left me as dizzy as this one, not only because the problem is challenging, but because of how many competing solutions keep getting promoted for it, from patch formats to field masks to change-tracking client libraries.

Most of those solutions ask every client to get something subtle right, when what most teams need is a write surface simple enough that any client can call it correctly on the first try. The simplest way there, I think, sidesteps all of them by not writing through the read at all. When a group of fields has a single owner, when a change starts a workflow, or when a collection's items come and go individually, each of those can have its own path. A write then sends the whole of something smaller rather than a piece of something large. That can look like a workaround at first, but I'd argue it's closer to healthy normalization in the write surface.

## Write Intentions Exceed Request Semantics

Every fix for this runs into the same limit. Each field in a write body is trying to carry one of four intents:

- **Leave alone.** The field isn't part of this change.
- **Set a value.** The field takes a new value, including zero, empty, or false.
- **Clear.** The field's current value is removed, leaving it with no value.
- **Change one element of a collection.** An item is added or removed without resending the rest.

The examples in this post use one customer, which the API reads whole:

```http
GET /customers/42
{
  "displayName": "Ada",
  "phoneNumber": "555-1234",
  "email": "ada@example.com",
  "verified": true,
  "isActive": true,
  "tags": ["vip", "beta"]
}
```

By convention, PATCH and PUT on `/customers/42` accept the same shape, bound to a request type that mirrors it:

```csharp
public record UpdateCustomerRequest(
    string? DisplayName, string? PhoneNumber, string? Email,
    bool? Verified, bool? IsActive, List<string>? Tags);
```

JSON can express the first three intents for `phoneNumber`, which can hold a value, be `null`, or be left out. The bound property has only two states, so a missing `phoneNumber` and a `null` one both arrive as null before any handler code runs, and the method decides which two intents survive:

| Body | PUT replaces the resource | PATCH skips nulls |
| --- | --- | --- |
| `"phoneNumber": "555-1234"` | Set | Set |
| `"phoneNumber": null` | Clear | Leave alone |
| `phoneNumber` omitted | Clear | Leave alone |

PATCH gives up clear, so a phone number, once set, can never be removed. PUT gives up leave alone, so a field the client didn't send is wiped, which is correct only while every client sends every field. A serializer that skips nulls breaks that silently, and so does a client built before the field existed, which means adding a writable field to a PUT changes its contract. The fourth intent doesn't fit a single field at all, because `tags` can only be sent whole.

The nullable properties are already the fix for a worse bug. Declared as a plain `bool`, an omitted `isActive` binds to `false`, and a PATCH that only changed the phone number deactivates the customer. Skipping nulls cures that for every field that can't be empty and breaks every field that can. The usual response is another special case for the field that broke, which leaves the design that broke it in place for the next one.

## Clients Hold State, Not Changes

A handler can fix the server side by reading the raw document instead of a bound type, or by accepting a patch format that encodes intent explicitly. But a partial update is only as correct as the client that built it, and the client has to know which fields the user actually touched.

The form often does know. Form libraries like Angular's reactive forms and React Hook Form track which fields are dirty. But the form isn't what sends the request. A view model maps the form's values onto a DTO, a service layer passes that DTO along, and a generated SDK type turns an unset property into a default or a null. By the time a request leaves the client, "the user didn't touch this" has usually been flattened into a value. Carrying that intent means threading change tracking through every one of those layers, in every client, including partners' clients.

Diffing the loaded document against the one about to be sent doesn't escape this. The diff runs on whatever reached the end of the pipeline, so a field a mapping layer turned into a default or a null shows up as a change the user never made.

## Patch Formats and Design Guides Leave the Client Problem in Place

The standards never settled partial updates. [RFC 5789](https://datatracker.ietf.org/doc/html/rfc5789){:target="_blank" rel="noopener noreferrer"}, which defined PATCH in 2010, left the body format open on the expectation that "no single format will be appropriate for all types of resources." Two kinds of answer grew into that gap. Patch formats are standardized request bodies that describe each change explicitly. API design guides are the rulebooks large companies publish for how their own APIs should behave, including how they accept updates. Teams tend to adopt either one as the professional answer.

[JSON Patch](https://datatracker.ietf.org/doc/html/rfc6902){:target="_blank" rel="noopener noreferrer"} encodes all four intents explicitly, as a list of add, remove, and replace operations addressed by path. [JSON Merge Patch](https://datatracker.ietf.org/doc/html/rfc7396){:target="_blank" rel="noopener noreferrer"} is simpler and covers three of them, but replaces arrays whole. Neither can tell a client which fields changed, so adopting one hands every caller the change-tracking problem from the previous section.

Design guides carry a different risk, because unlike patch formats they aren't neutral standards. Many of them are one company's internal practice, published for others to read. The field masks in Google's [AIPs](https://google.aip.dev/1){:target="_blank" rel="noopener noreferrer"} are designed around protobuf messages and generated clients that Google produces for its own APIs, and the client still has to fill each mask with the fields that changed. Microsoft publishes [its own guidelines](https://github.com/microsoft/api-guidelines){:target="_blank" rel="noopener noreferrer"} in the hope that other organizations will "create guidelines that are appropriate for them."

Those choices fit organizations that own their clients, generate their SDKs, and employ governance teams to enforce conformance. Copied into a team that has none of that, they become cargo culture, trading the simple write surface the team needs for machinery built around someone else's clients.

None of that makes PATCH a mistake, only a tool for resources shaped like documents rather than records. A preferences bag that gains keys every release suits JSON Merge Patch, and because it binds to a dictionary rather than a typed record, a key that's present, null, or absent still carries all three intents. A large configuration document suits JSON Patch, which changes one value without resending the rest. Kubernetes lets many controllers write the same object through [server-side apply](https://kubernetes.io/docs/reference/using-api/server-side-apply/){:target="_blank" rel="noopener noreferrer"}, which tracks which manager owns each field, machinery that pays for itself on a platform built around it. The rest of this post is about records.

## The Wide Write Is a Normalization Failure

`UpdateCustomerRequest` mirrors the read, so every field the read returns becomes a field the write has to have an opinion about, including `verified`, which no client should set, and `isActive`, which most callers have no business touching.

A read is allowed to be a composition, and serving the whole customer in one GET is good design. But what the screen receives is a view over several things with different rules. The email starts a verification workflow when it changes, and `verified` is set by the server. Deactivation carries its own permission and consequences. Tags are a collection whose elements come and go individually.

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

The request type marks both properties `required`, which System.Text.Json enforces by rejecting any body that leaves one out:

```csharp
public record UpdateProfileRequest
{
    public required string DisplayName { get; init; }
    public required string? PhoneNumber { get; init; }
}
```

An omitted property now fails binding with a 400 instead of arriving as null, so `"phoneNumber": null` can only mean remove it, and the phone number can be cleared again.

`email` fails only the workflow test, and that's enough to separate it, because the verification rules then live on the one endpoint that triggers them. `isActive` fails on owner and scope, so it becomes a named operation. The deactivation that rode along with a phone-number change isn't defended against but made unrepresentable, because there's no longer a body it could ride along in.

Normalization can be taken too far. A deactivation doesn't have its own identity and lifecycle the way a tag does, so unless the domain keeps deactivations as records a client can list, `POST /customers/42/deactivations` invents a collection no GET can back. The named operation `POST /customers/42/deactivate` describes the transition more honestly.

### Collections With Identity Get Their Own Addresses

Collections whose elements carry identity get addressed individually, which is how GitHub handles [issue labels](https://docs.github.com/en/rest/issues/labels){:target="_blank" rel="noopener noreferrer"} and how Stripe exposes [subscription items](https://docs.stripe.com/api/subscription_items){:target="_blank" rel="noopener noreferrer"}:

```http
POST /customers/42/tags
{ "name": "vip" }

DELETE /customers/42/tags/beta
```

A collection with no natural per-element key, like an ordered list of steps, has nothing to hang a sub-resource URL on. It stays in its parent's body and is replaced whole along with it.

## What Normalizing Costs

### More Calls, Usually Along Lines the Work Already Follows

The obvious objection is call count, usually raised on behalf of admin and operations apps on the assumption that they edit everything at once. They rarely do. Their work moves from correcting contact details to reviewing product access to deactivating an account, and each step is a write this design already names. The endpoint count goes up, but reads can still be aggregates shaped for whichever app uses them.

The customer screen from earlier is the harder case, because it shows every concern on one page. A single Save button across all of them now makes one call per concern it touches plus one per tag, and the screen has to report which ones failed. A screen shaped like the write surface tends to serve users better, with contact details saved together and email change and deactivation as their own actions. Modern interfaces already lean this way. Nielsen Norman Group's [toggle-switch guidelines](https://www.nngroup.com/articles/toggle-switch-guidelines/){:target="_blank" rel="noopener noreferrer"} say a switch "should take immediate effect and should not require the user to click Save or Submit," and tags shown as chips often save one at a time. A deactivation that rides along with a phone-number edit is the same bug with a nicer interface.

The call count does hurt clients that write in volume, like an offline app syncing a day of edits or an importer loading thousands of customers. Those clients need a batch endpoint, not a return to the wide body. Modeled on [Microsoft Graph's JSON batching](https://learn.microsoft.com/en-us/graph/json-batching){:target="_blank" rel="noopener noreferrer"}, each entry carries its own method, URL, and body and gets its own status back, so it passes through the same rules as the narrow endpoint it names, and the batch only saves round trips. Graph applies entries independently, which keeps a batch from quietly becoming a transaction.

### Atomicity Across Concerns Has to Be Named

A wide PATCH is usually applied all or nothing, and separate calls are not, so a screen that saves contact details and tags together can fail halfway. As long as the server validates each write against the customer's current state, every call that succeeds still leaves a valid customer behind. A new phone number with one tag missing is an incomplete edit, not a corrupt customer.

Separate calls stop being enough when the writes are only valid together. Closing an account deactivates the customer and cancels their subscriptions, and a customer who is deactivated but still billed is the half-changed state that has to be impossible. That change is a use case, and it gets a named operation such as `POST /customers/42/close`.

That can sound like a return to RPC, the endpoint-per-action style that resource-oriented APIs replaced. But the wide PATCH never removed those actions. It hid them in field values, so `"isActive": false` is a deactivation command the handler has to detect by comparing against the stored value. A normalized surface is still mostly resources read and replaced with GET and PUT, with named operations kept for transitions, the way Stripe [finalizes invoices](https://docs.stripe.com/api/invoices/finalize){:target="_blank" rel="noopener noreferrer"} and GitHub [merges pull requests](https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request){:target="_blank" rel="noopener noreferrer"}. An operation earns a name when the business needs its writes to succeed together, not when one screen happens to save several things at once.

### Concurrent Edits Surface as Conflicts Instead of Merging

If one support agent changes `displayName` while another changes `phoneNumber`, two PUTs to `/customers/42/profile` each send both fields, and the later one overwrites the earlier change. A partial update would keep both, but only if its client sent just the touched field, which is the change tracking clients rarely manage. Even then, merging by field can save a combination neither agent saw.

The usual guard is a version check. The GET returns a version tag in its `ETag` header, the client sends that tag back in an `If-Match` header on the PUT, and if the resource changed in between, the server answers `412 Precondition Failed` instead of overwriting. Small resources are what make that check practical. On the wide customer resource, a tag another agent adds fails every save that loaded the customer before it. On the profile, a 412 means someone changed the same details at the same time, which is rare and should reach the user. A server that requires the header answers [428 Precondition Required](https://datatracker.ietf.org/doc/html/rfc6585#section-3){:target="_blank" rel="noopener noreferrer"} when it's missing, so a client that forgets it finds out on its first request.

### Adding a Writable Field Changes the Contract

If `preferredName` joins the profile, an older client's PUT leaves it out, and the server either clears it or, with required properties, rejects the request. Under replacement, a new writable field is a breaking change for every client that writes the resource, and the way through is a new version of it. The old request type stays bound to the old version, so requests in that shape never touch `preferredName`.

A partial update avoids that version by treating a missing field as leave alone, the same rule that stopped the phone number from being cleared. Normalizing keeps versions rare instead. Reads gain fields freely, and most new data a screen wants belongs to the read. A new field with its own owner, scope, or workflow fails the tests and gets its own resource, adding an endpoint without changing an existing one. Versions fall only on fields that join an existing concern, and small, cohesive resources rarely gain those. A resource that gains them every release is a document, and belongs with PATCH.

### Migration Runs Alongside the Wide Write

An API that partners already call through a wide PATCH can't simply start answering 405. The narrow endpoints go in alongside the wide one, clients move over screen by screen, and once traffic to the wide write stops, `/customers/42` keeps serving the composed view while writes to it answer 405 with an `Allow: GET` header. While both exist, the wide PATCH has to route each field through the rules its narrow endpoint enforces, or it becomes a back door around the design.

## Letting Reads and Writes Take Different Shapes

I've come to think most software problems trace back to a failure to align with the need, a failure of architecture governance, or a failure to change direction. The wide PATCH shows all three, in adopting a spec written for someone else's clients, in letting the read model decide a write surface nobody owned, and in special-casing each ambiguous field instead of changing the design that keeps producing them.

Applied to the customer, the six-property `UpdateCustomerRequest` becomes this write surface:

```csharp
// GET /customers/42 keeps serving the composed view. PUT and PATCH answer 405.

// PUT /customers/42/profile, If-Match required
public record UpdateProfileRequest
{
    public required string DisplayName { get; init; }
    public required string? PhoneNumber { get; init; }
}

// PUT /customers/42/email, If-Match required, starts verification
public record UpdateEmailRequest
{
    public required string Email { get; init; }
}

// POST /customers/42/tags, and DELETE /customers/42/tags/{name}
public record AddTagRequest
{
    public required string Name { get; init; }
}

// POST /customers/42/deactivate, no body
// POST /customers/42/close, no body, deactivates and cancels subscriptions together
// verified has no write. The verification workflow sets it.
```

Every body carries all of its fields, every field has one place to be written, and no handler has to guess what a missing property meant. 

None of the corrections takes new technology:

- Group fields into a writable resource only when they share an owner, an authorization scope, and a workflow
- Replace those resources whole with PUT, binding every field as required
- Give collections with identity-bearing elements their own POST and DELETE endpoints
- Name the operation when a change is a state transition or has to be atomic across concerns
- Require `If-Match` on PUTs to resources more than one person edits
- Version a writable resource when it gains a field, and let reads grow freely
- Move existing clients onto the narrow endpoints, then let aggregate URLs answer GET and refuse writes
- Save PATCH and patch formats for documents, like preference bags and large configurations
