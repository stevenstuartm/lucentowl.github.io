---
layout: post
title: "Your Reads Should Not Design Your Writes"
date: 2026-09-14
description: "API writes that go through a wide body, whether PATCH or PUT, can't reliably tell an omitted field from a cleared one, and patch formats push the fix onto every client. Normalizing the write surface avoids both, keeping reads as composed views and writes as small resources any client can replace whole."
tags: [architecture, api-design, rest, design-patterns]
author: steven-stuart
---

Any API endpoint that writes a nullable field or a collection has to decide whether an omitted field was left alone or meant to be cleared. PUT only moves the question, because it clears whatever arrives missing or null, which is correct only if the client sent every field on purpose. The problem bites hardest on the records most business APIs are made of, like customers, orders, and accounts edited through forms and typed clients. Few problems have left me as dizzy as this one, partly because it's hard, but mostly because of how many competing solutions keep getting promoted for it, from patch formats to field masks to change-tracking client libraries.

Most of those solutions ask every client to get something subtle right, when most teams need a write surface any client can call correctly on the first try. The simplest way there, I think, is to stop writing through the read. When a group of fields has a single owner, when a change starts a workflow, or when a collection's items come and go individually, each gets its own path, and a write sends the whole of something smaller rather than a piece of something large. That can look like a workaround, but I'd argue it's healthy normalization of the write surface.

## Write Intentions Exceed Request Semantics

Each field in a write body carries one of four intents:

- **Leave alone.** The field isn't part of this change.
- **Set a value.** Including zero, empty, or false.
- **Clear.** Remove the current value.
- **Change one element of a collection.** Add or remove an item without resending the rest.

The examples use one customer, which the API reads whole:

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

By convention, PATCH and PUT on `/customers/42` accept the same shape:

```csharp
public record UpdateCustomerRequest(
    string? DisplayName, string? PhoneNumber, string? Email,
    bool? Verified, bool? IsActive, List<string>? Tags);
```

JSON can express the first three intents for `phoneNumber` by sending a value, sending `null`, or leaving it out. The bound property has only two states, so missing and `null` both arrive as null, and the method decides which two intents survive:

| Body | PUT replaces the resource | PATCH skips nulls |
| --- | --- | --- |
| `"phoneNumber": "555-1234"` | Set | Set |
| `"phoneNumber": null` | Clear | Leave alone |
| `phoneNumber` omitted | Clear | Leave alone |

PATCH gives up clear, so a phone number, once set, can never be removed. PUT gives up leave alone, which is safe only while every client sends every field. A view model that loads only the fields its screen shows breaks that silently, clearing everything else on save. A client built before a field existed does the same, which makes every new writable field a contract change. The fourth intent doesn't fit a single field at all, because `tags` can only be sent whole.

The nullable properties already fix a worse bug. With a plain `bool`, an omitted `isActive` binds to `false`, and a PATCH that only changed the phone number deactivates the customer. Skipping nulls cures that for fields that can never be empty, like `isActive`, and breaks every field that can, like `phoneNumber`. Teams often patch the phone number on its own, with an empty string that means clear or a separate `clearPhoneNumber` flag, and the next nullable field breaks the same way.

## Clients Hold State, Not Changes

A handler can fix the server side by reading the raw document or accepting a patch format that encodes intent. But a partial update is only as correct as the client that built it, and the client has to know which fields the user touched.

The form often knows, since libraries like Angular's reactive forms and React Hook Form track dirty fields. But the form doesn't send the request. A view model maps its values onto a DTO, a service layer passes that along, and a generated SDK type turns an unset property into a default or a null. By the time the request leaves, "the user didn't touch this" has been flattened into a value, and preserving it means threading change tracking through every layer of every client, including partners'. Diffing the loaded document against the outgoing one doesn't help, because a field a mapper defaulted shows up as a change the user never made.

A client can skip change tracking by sending only the fields its form owns, so the contact form PATCHes `{ displayName, phoneNumber }` and the handler checks which keys are present in the raw JSON. That works while every client scopes its bodies the same way, but nothing on the server enforces the grouping. The endpoint still accepts `isActive` from any caller that includes it, the handler still decides field by field who may set what and what each change triggers, and a typed SDK that models the whole customer loses presence again on the way out. The form scope is the right boundary, held in the wrong place, by convention in each client instead of by the server.

## Patch Formats and Design Guides Leave the Client Problem in Place

The standards never settled partial updates. [RFC 5789](https://datatracker.ietf.org/doc/html/rfc5789){:target="_blank" rel="noopener noreferrer"}, which defined PATCH in 2010, left the body format open on the expectation that "no single format will be appropriate for all types of resources." Two kinds of answer grew into that gap. Patch formats are standardized request bodies that describe each change explicitly. API design guides are the rulebooks large companies publish for how their own APIs should behave, including how they accept updates. Teams tend to adopt either one as the professional answer.

[JSON Patch](https://datatracker.ietf.org/doc/html/rfc6902){:target="_blank" rel="noopener noreferrer"} encodes all four intents explicitly, as add, remove, and replace operations addressed by path. A path into an array is an index, though, so removing `beta` means removing `/tags/1`, which deletes the wrong tag if someone reordered the array first, unless a `test` operation guards it. [JSON Merge Patch](https://datatracker.ietf.org/doc/html/rfc7396){:target="_blank" rel="noopener noreferrer"} is simpler and covers three, but replaces arrays whole. Neither can tell a client which fields changed, so adopting one hands every caller the change-tracking problem.

Design guides carry a different risk, because they aren't neutral standards but one company's internal practice, published. The field masks in Google's [AIPs](https://google.aip.dev/1){:target="_blank" rel="noopener noreferrer"} are built around protobuf messages and generated clients Google produces for its own APIs, and the client still has to fill each mask with the fields that changed. Microsoft publishes [its own guidelines](https://github.com/microsoft/api-guidelines){:target="_blank" rel="noopener noreferrer"} hoping other organizations will "create guidelines that are appropriate for them."

Those choices fit organizations that own their clients, generate their SDKs, and employ governance teams to enforce conformance. Copied into a team without that, they become ritual, kept because a large company published them rather than because they solve anything the team has.

None of that makes PATCH a mistake, only a tool for documents rather than records. A preferences bag that gains keys every release suits JSON Merge Patch, and because it binds to a dictionary rather than a typed record, a present, null, or absent key still carries all three intents. A large configuration document suits JSON Patch. The rest of this post is about records.

## The Wide Write Is a Normalization Failure

`UpdateCustomerRequest` mirrors the read, so the write has to have an opinion about every field, including `verified`, which no client should set, and `isActive`, which most callers shouldn't touch.

A read is allowed to be a composition, and serving the whole customer in one GET is good design, but it's a view over things with different rules. The wide write happens when that view becomes the write target, usually because one model serves both directions, and it fails the way an unnormalized table does, by giving unrelated facts a single place to be written. That's a governance gap more than a technical one. Nobody decided what the write surface should be, so the read model decided for them.

PUT doesn't rescue it. [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#name-put){:target="_blank" rel="noopener noreferrer"} defines PUT as replacing "the state of the target resource" with "the state defined by the representation enclosed," which only works when every client can produce every field and is entitled to replace each one.

## Normalize the Write Surface

A normalized write surface writes each field where its owner, permission, and workflow live, while reads compose those resources into views for each screen. It's the read and write split of CQRS, with both sides left as ordinary HTTP resources.

### Three Tests Decide What Shares a Resource

Two fields belong in the same writable resource only when they pass all three tests:

- **Same owner.** The same party is entitled to decide both values.
- **Same authorization scope.** A caller needs the same permission to change either one.
- **Same workflow.** Changing either one triggers the same consequences, or none.

| Field | Owner | Authorization scope | Workflow | Write |
| --- | --- | --- | --- | --- |
| `displayName` | Customer | Edit own profile | None | `PUT /customers/42/profile` |
| `phoneNumber` | Customer | Edit own profile | None | `PUT /customers/42/profile` |
| `email` | Customer | Edit own profile | Verification email | `PUT /customers/42/email` |
| `verified` | Server | Not client-writable | Set by verification | None |
| `isActive` | Operations | Manage account status | Deactivation checks | `POST /customers/42/deactivate` |
| `tags` | Support | Manage tags | None | `POST` and `DELETE /customers/42/tags` |

`displayName` and `phoneNumber` pass all three, so a client editing contact details can send the whole resource:

```http
PUT /customers/42/profile
{ "displayName": "Ada", "phoneNumber": null }
```

Marking both properties `required` makes System.Text.Json reject any body that leaves one out:

```csharp
public record UpdateProfileRequest
{
    public required string DisplayName { get; init; }
    public required string? PhoneNumber { get; init; }
}
```

An omitted property fails with a 400 instead of arriving as null, so `"phoneNumber": null` can only mean remove it. `required` checks presence, not nullability, so `"displayName": null` still binds unless the serializer's [`RespectNullableAnnotations`](https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json/nullable-annotations){:target="_blank" rel="noopener noreferrer"} option (.NET 9 and later) is on or model validation rejects it.

`email` fails only the workflow test, which is enough, because the verification rules then live on the one endpoint that triggers them. `isActive` fails on owner and scope, so it becomes a named operation, and a deactivation can no longer ride along with a phone-number change because there's no body to carry it.

### Collections With Identity Get Their Own Addresses

Collections whose elements carry identity get addressed individually, the way GitHub handles [issue labels](https://docs.github.com/en/rest/issues/labels){:target="_blank" rel="noopener noreferrer"} and Stripe exposes [subscription items](https://docs.stripe.com/api/subscription_items){:target="_blank" rel="noopener noreferrer"}:

```http
POST /customers/42/tags
{ "name": "vip" }

DELETE /customers/42/tags/beta
```

A collection with no natural key, like an ordered list of steps, stays in its parent's body and is replaced whole with it.

## What Normalizing Costs

### More Calls, Usually Along Lines the Work Already Follows

The objection is usually raised for admin and operations apps, on the assumption that they edit everything at once. They tend not to. Their work moves from correcting contact details to reviewing access to deactivating an account, and each step is a write this design already names.

The customer screen is the harder case, because it shows every concern on one page. A single Save button now makes one call per concern it touches plus one per tag, and has to report which ones failed. A screen shaped like the write surface tends to serve users better, with contact details saved together and email change and deactivation as their own actions. Nielsen Norman Group's [toggle-switch guidelines](https://www.nngroup.com/articles/toggle-switch-guidelines/){:target="_blank" rel="noopener noreferrer"} already say a switch "should take immediate effect and should not require the user to click Save or Submit," and tag chips often save one at a time. A single Save that carries a deactivation along with a phone-number edit is the wide write again, moved into the interface.

Call count does hurt clients that write in volume, like an offline app syncing a day of edits or an importer loading thousands of customers. They need a batch endpoint, not the wide body back. In the style of [Microsoft Graph's JSON batching](https://learn.microsoft.com/en-us/graph/json-batching){:target="_blank" rel="noopener noreferrer"}, each entry carries its own method, URL, and body and gets its own status, so it passes through the rules of the endpoint it names without quietly turning the batch into a transaction.

### Atomicity Across Concerns Has to Be Named

A wide PATCH usually applies all or nothing, and separate calls don't, so a save across contact details and tags can fail halfway. As long as the server validates each write against current state, every successful call leaves a valid customer, so a failure leaves an incomplete edit rather than a corrupt record.

Separate calls stop being enough when writes are only valid together. Closing an account deactivates the customer and cancels their subscriptions, and a deactivated customer who's still billed has to be impossible. That's a use case, and it gets a named operation, `POST /customers/42/close`.

That can sound like a return to RPC, the endpoint-per-action style that resource-oriented APIs replaced. But the wide PATCH never removed those actions. It hid them in field values, so `"isActive": false` is a deactivation command the handler detects by comparing against the stored value. A normalized surface is still mostly GET and PUT on resources, with named operations kept for transitions, the way Stripe [finalizes invoices](https://docs.stripe.com/api/invoices/finalize){:target="_blank" rel="noopener noreferrer"} and GitHub [merges pull requests](https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request){:target="_blank" rel="noopener noreferrer"}. An operation earns a name when the business needs its writes to succeed together, not when a screen happens to save several things at once.

### Concurrent Edits Surface as Conflicts Instead of Merging

If one agent changes `displayName` while another changes `phoneNumber`, two PUTs to the profile each send both fields, and the later one overwrites the earlier change. A partial update would keep both, but only with the change tracking clients rarely manage, and even then merging by field can save a combination neither agent saw.

The usual guard is a version check. A GET on the profile returns a version tag in its `ETag` header, the client sends that tag back in an `If-Match` header on the PUT, and if the resource changed in between, the server answers `412 Precondition Failed` instead of overwriting. A server that requires the header answers [428 Precondition Required](https://datatracker.ietf.org/doc/html/rfc6585#section-3){:target="_blank" rel="noopener noreferrer"} when it's missing, so a client that forgets it finds out on its first request.

Small resources make that check practical. On the wide customer, a tag another agent adds fails every save that loaded the customer before it. On the profile, a 412 means someone changed the same details at the same time, which is rare and should reach the user.

### Adding a Writable Field Changes the Contract

If `preferredName` joins the profile, an older client's PUT leaves it out, and the server either clears it or rejects the request. Under replacement, a new writable field breaks every client that writes the resource, so it takes a new version, with the old request type bound to the old version so its requests never touch `preferredName`.

A partial update skips the version by treating missing as leave alone, the rule that stopped the phone number from being cleared. Normalizing keeps versions rare instead, because reads gain fields freely and a field with its own owner, scope, or workflow gets its own resource. Versions fall only on fields that join an existing concern, and a resource that gains those every release is a document that belongs with PATCH.

### Migration Runs Alongside the Wide Write

Partners already calling a wide PATCH can't simply start getting 405. The narrow endpoints go in alongside it, and clients move over screen by screen. Meanwhile the wide PATCH has to route each field through its narrow endpoint's rules, or it becomes a back door. Once its traffic stops, `/customers/42` keeps serving the composed view and answers writes with 405 and `Allow: GET`.

## Three Failures Behind One Wide PATCH

I've come to think most software problems trace back to a failure to align with the need, a failure of architecture governance, or a failure to change direction. The wide PATCH shows all three, in adopting a spec written for someone else's clients, in letting the read model decide a write surface nobody owned, and in special-casing each ambiguous field instead of changing the design.

Applied to the customer, `UpdateCustomerRequest` becomes this write surface:

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

Every body carries all of its fields, every field has one place to be written, and no handler has to guess what a missing property meant. None of the corrections takes new technology:

- Group fields into a writable resource only when they share an owner, an authorization scope, and a workflow
- Replace those resources whole with PUT, binding every field as required
- Give collections with identity-bearing elements their own POST and DELETE endpoints
- Name the operation when a change is a state transition or has to be atomic across concerns
- Require `If-Match` on PUTs to resources more than one person edits
- Version a writable resource when it gains a field, and let reads grow freely
- Move existing clients onto the narrow endpoints, then let aggregate URLs answer GET and refuse writes
- Save PATCH and patch formats for documents, like preference bags and large configurations
