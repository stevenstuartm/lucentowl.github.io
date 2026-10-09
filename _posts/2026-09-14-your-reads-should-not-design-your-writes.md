---
layout: post
title: "Your Reads Should Not Design Your Writes"
date: 2026-09-14
description: "API updates that send a wide body can't rely on clients to keep an omitted field distinct from a cleared one, whatever the HTTP method, and patch formats push that tracking onto every client. Normalizing the write surface avoids both, keeping reads as composed views and writes as small resources any client can replace whole."
tags: [architecture, api-design, rest, design-patterns]
author: steven-stuart
sources:
  - title: "Microsoft Kiota: Backing Store"
    url: "https://learn.microsoft.com/en-us/openapi/kiota/backing-store"
  - title: "RFC 5789: PATCH Method for HTTP"
    url: "https://datatracker.ietf.org/doc/html/rfc5789"
  - title: "RFC 6902: JavaScript Object Notation (JSON) Patch"
    url: "https://datatracker.ietf.org/doc/html/rfc6902"
  - title: "RFC 7396: JSON Merge Patch"
    url: "https://datatracker.ietf.org/doc/html/rfc7396"
  - title: "Google API Improvement Proposals"
    url: "https://google.aip.dev/1"
  - title: "Microsoft REST API Guidelines"
    url: "https://github.com/microsoft/api-guidelines"
  - title: "RFC 9110: HTTP Semantics, PUT"
    url: "https://www.rfc-editor.org/rfc/rfc9110.html#name-put"
  - title: "GitHub REST API: Labels"
    url: "https://docs.github.com/en/rest/issues/labels"
  - title: "Stripe API: Subscription Items"
    url: "https://docs.stripe.com/api/subscription_items"
  - title: "Nielsen Norman Group: Toggle-Switch Guidelines"
    url: "https://www.nngroup.com/articles/toggle-switch-guidelines/"
  - title: "Microsoft Graph: JSON Batching"
    url: "https://learn.microsoft.com/en-us/graph/json-batching"
  - title: "Stripe API: Finalize an Invoice"
    url: "https://docs.stripe.com/api/invoices/finalize"
  - title: "GitHub REST API: Merge a Pull Request"
    url: "https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request"
  - title: "RFC 6585: Additional HTTP Status Codes, 428 Precondition Required"
    url: "https://datatracker.ietf.org/doc/html/rfc6585#section-3"
---

Any API endpoint that updates part of a record has to decide what a missing field means, whether the client left it alone or wants it cleared. Most business APIs face that decision constantly, because records like customers, orders, and accounts are edited through forms and clients that rarely send everything. Few problems have left me as dizzy as this one, partly because it's hard, but mostly because of how many competing solutions keep getting promoted for it, from patch formats to field masks to change-tracking client libraries.

Most of those solutions ask every client to get something subtle right, when most teams need a write surface any client can call correctly on the first try. I think the simplest way there is PUT, where every body must include every field and the server has nothing left to guess.

That only works once a resource is small enough for any client to send whole, so the change that matters is to stop letting the shape of your reads design your writes. When a group of fields has a single owner, when a change starts a workflow, or when a collection's items come and go individually, that group, change, or collection gets its own path. That can look like a workaround, but I'd argue it's healthy normalization of the write surface.

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

By convention, updates to `/customers/42` accept that same shape, whether they arrive as PATCH, PUT, or POST. JSON can express the first three intents for `phoneNumber` by sending a value, sending `null`, or leaving it out. But most servers read the body into a fixed model where missing and `null` become the same empty value, so the endpoint has to pick a rule, and the rule decides which two intents survive:

| Body | Replace the resource | Skip nulls |
| --- | --- | --- |
| `"phoneNumber": "555-1234"` | Set | Set |
| `"phoneNumber": null` | Clear | Leave alone |
| `phoneNumber` omitted | Clear | Leave alone |

Skipping nulls gives up clear, so a phone number, once set, can never be removed. Teams often work around that one field at a time, with an empty string that means clear or a separate `clearPhoneNumber` flag, and the next nullable field breaks the same way. Replacing gives up leave alone, which is safe only while every client sends every field. A view model that loads only the fields its screen shows breaks that silently, clearing everything else on save. The fourth intent doesn't fit a single field at all, because `tags` can only be sent whole.

## Clients Hold State, Not Changes

A handler can fix the server side by reading the raw document or accepting a patch format that encodes intent. But a partial update is only as correct as the client that built it, and the client has to know which fields the user touched.

The form often knows, since libraries like Angular's reactive forms and React Hook Form track dirty fields. But the form doesn't send the request. A view model maps its values onto a DTO, a service layer passes that along, and a generated SDK type turns an unset property into a default or a null. By the time the request leaves, "the user didn't touch this" has been flattened into a value, and preserving it means threading change tracking through every layer of every client, including partners'.

Tools that try to recover it each leave a gap. Microsoft's Kiota generator tracks set properties in a backing store, but only for code that writes to the SDK object directly, which a hand-written mapper doesn't. Diffing the loaded document against the outgoing one shows a mapper's defaults as changes the user never made. Only a client that snapshots its own mapped copy at load avoids that.

A client can skip change tracking by sending only the fields its form owns, so the contact form sends `{ displayName, phoneNumber }` and the handler checks which keys are present in the raw JSON. That works while every client scopes its bodies the same way.

But nothing on the server enforces the grouping. The endpoint accepts `isActive` from any caller that includes it. The handler decides field by field who may set what and what each change triggers. And a typed SDK that models the whole customer can lose presence again on the way out. The form scope is the right boundary, held in the wrong place, by convention in each client instead of by the server.

## Patch Formats and Design Guides Leave the Client Problem in Place

The standards never settled partial updates. RFC 5789, which defined PATCH in 2010, left the body format open on the expectation that "no single format will be appropriate for all types of resources." Two kinds of answer grew into that gap, standardized patch formats and the API design guides large companies publish for their own APIs, and teams tend to adopt either one as the professional answer.

JSON Patch, defined in RFC 6902, encodes all four intents explicitly, as add, remove, and replace operations addressed by path. A path into an array is an index, though, so removing `beta` means removing `/tags/1`, which deletes the wrong tag if someone reordered the array first, unless a `test` operation guards it. JSON Merge Patch, from RFC 7396, is simpler and covers three, but replaces arrays whole. Neither can tell a client which fields changed, so adopting one hands every caller the change-tracking problem.

Design guides carry a different risk, because they aren't neutral standards but one company's internal practice, published. The field masks in Google's API Improvement Proposals are built around protobuf messages and generated clients Google produces for its own APIs. The client still has to fill each mask with the fields that changed. A server can pin each mask to one form's fields, but that groups fields by form without giving the group a URL for gateways, logs, and ETags to key on. Even Microsoft doesn't offer its REST API Guidelines as universal. It publishes them hoping other organizations will "create guidelines that are appropriate for them."

Those choices fit organizations that own their clients, generate their SDKs, and employ governance teams to enforce conformance. Copied into a team without that, they can become ritual, kept because a large company published them rather than because they solve anything the team has.

Partial updates still have a home in documents, data with no fixed model, rather than records. A preferences bag that gains keys every release suits JSON Merge Patch, and because nothing maps it onto a fixed model, a present, null, or absent key still carries all three intents. A large configuration document suits JSON Patch. The rest of this post is about records.

## The Wide Write Is a Normalization Failure

The shared update body mirrors the read, so the write has to have an opinion about every field, including `verified`, which no client should set, and `isActive`, which most callers shouldn't touch.

A read is allowed to be a composition, and serving the whole customer in one GET is good design, but it's a view over things with different rules. The wide write happens when that view becomes the write target, usually because one model serves both directions. It fails the way an unnormalized table does, by giving unrelated facts a single place to be written. That's a governance gap more than a technical one. Nobody decided what the write surface should be, so the read model decided for them.

PUT on the wide customer doesn't rescue it. RFC 9110 defines PUT as replacing "the state of the target resource" with "the state defined by the representation enclosed." That only works when every client can produce every field and is entitled to replace each one, which only a small resource can promise.

## Normalize the Write Surface

A normalized write surface writes each field where its owner, permission, and workflow live, while reads compose those resources into views for each screen. It's the read and write split of CQRS, with both sides left as ordinary HTTP resources.

### Three Tests Decide What Shares a Resource

Two fields belong in the same writable resource only when they pass all three tests:

- **Same owner.** The same party is entitled to decide both values, whoever submits the change for them.
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

`displayName` and `phoneNumber` pass all three and share a resource. Every other field fails at least one test, so the one wide body becomes these requests:

```http
PUT /customers/42/profile
{ "displayName": "Ada", "phoneNumber": null }

PUT /customers/42/email
{ "email": "ada@example.com" }

POST /customers/42/tags
{ "name": "vip" }

DELETE /customers/42/tags/beta

POST /customers/42/deactivate
```

The server requires every field in each body, so a body that leaves one out fails with a 400, and no intent depends on the server guessing:

| Intent | Request |
| --- | --- |
| Set `phoneNumber` | `PUT /customers/42/profile` with `"phoneNumber": "555-1234"` |
| Clear `phoneNumber` | `PUT /customers/42/profile` with `"phoneNumber": null` |
| Leave `phoneNumber` alone | Skip the profile PUT, or resend its current value |
| Remove one tag | `DELETE /customers/42/tags/beta` |

A mapper can still turn a value into a null the user never chose. That error doesn't vanish, but it's limited to fields the form loaded. Skipping a PUT means tracking which sections were touched, one flag per section rather than per field. Merge Patch on the same small resource would keep leave alone, but only by handing back the field-level tracking the mapper layers lose.

`email` fails only the workflow test, and that's enough. The verification rules then live on the one endpoint that triggers them, and a PUT that resends the current address triggers nothing.

`isActive` fails all three. Changing it is a state transition with its own checks, so it becomes a named operation. A deactivation can no longer ride along with a phone-number change, because there's no body to carry it.

### Collections With Identity Get Their Own Addresses

Collections whose elements carry identity get addressed individually, the way GitHub's REST API handles issue labels and Stripe's API exposes subscription items.

A collection with no natural key, like an ordered list of steps, stays in its parent's body and is replaced whole with it.

## What Normalizing Costs

### More Calls, Usually Along Lines the Work Already Follows

The objection is usually raised for admin and operations apps, on the assumption that they edit everything at once. Many don't. Their work moves from correcting contact details to reviewing access to deactivating an account, and each step is a write this design already names.

The customer screen is the harder case, because it shows every concern on one page. A single Save button now makes one call per concern it touches plus one per tag, and has to report which ones failed.

Shaping the screen like the write surface is a design choice, but common controls already lean that way. Nielsen Norman Group's toggle-switch guidelines say a switch "should take immediate effect and should not require the user to click Save or Submit," and tag chips can save on each click the same way. A single Save that carries a deactivation along with a phone-number edit is the wide write again, moved into the interface.

Call count does hurt clients that write in volume, like an offline app syncing a day of edits, a bulk-edit grid, or an importer loading thousands of customers. They need a batch endpoint, not the wide body back. In the style of Microsoft Graph's JSON batching, each entry carries its own method, URL, and body and gets its own status. Each one passes through the rules of the endpoint it names, without quietly turning the batch into a transaction.

### Atomicity Across Concerns Has to Be Named

A single wide update usually applies all or nothing, and separate calls don't, so a save across contact details and tags can fail halfway. As long as the server validates each write against current state, every successful call leaves a valid customer, so a failure leaves an incomplete edit rather than a corrupt record.

Separate calls stop being enough when writes are only valid together. Closing an account deactivates the customer and cancels their subscriptions, and a deactivated customer who's still billed has to be impossible. That's a use case, and it gets a named operation, `POST /customers/42/close`. Rules linking two fields follow the owners. A shipping address needs a postal code, and one owner holds both, so they share a resource. An enterprise tier requires a phone number, but the owners differ. A downgrade that also drops the phone number moves both together, so it gets a named operation. Listing every rule that reads more than one section finds them.

The wide update never removed those actions. It hid them in field values, so `"isActive": false` is a deactivation command the handler detects by comparing against the stored value. Naming them isn't a return to RPC, the endpoint-per-action style that resource-oriented APIs replaced. A normalized surface is still mostly GET and PUT on resources, with named operations kept for transitions, the way Stripe's API finalizes invoices and GitHub's API merges pull requests. An operation earns a name when the business needs its writes to succeed together, not when a screen happens to save several things at once.

### Concurrent Edits Surface as Conflicts Instead of Merging

If one agent changes `displayName` while another changes `phoneNumber`, two PUTs to the profile each send both fields, and the later one overwrites the earlier change. A partial update would keep both, but only with the change tracking clients rarely manage, and even then a merge can pair a new contact's name with the old contact's phone.

The usual guard is a version check. A GET on the profile returns a version tag in its `ETag` header, and the client sends that tag back in an `If-Match` header on the PUT. If the resource changed in between, the server answers `412 Precondition Failed` instead of overwriting. An edit screen loads each section from its own GET, so it resends that resource's own representation and version. A server that requires the header answers a missing one with `428 Precondition Required`, defined in RFC 6585.

Small resources make that check practical. On the wide customer, a tag another agent adds fails every save that loaded the customer before it. A batch replaying a day of offline edits gets 412s on its stale entries to refetch and reapply, which is where offline-first apps may need field merging. Otherwise, a 412 on the profile means someone changed the same details at the same time, which is rare and should reach the user.

### Adding a Writable Field Changes the Contract

If `preferredName` joins the profile, an older client's PUT leaves it out, and the server either clears it or rejects the request. So the field comes with a new version of the resource. Older clients keep sending the old version's request, and the server leaves `preferredName` alone for those.

A partial update skips the version by treating missing as leave alone, the rule that stopped the phone number from being cleared. Normalizing limits versions instead, because reads gain fields freely and a field with its own owner, scope, or workflow gets its own resource. A resource that still gains writable fields every release may be better served by partial updates. For the rest, the versions that remain are the price of a body the server never guesses about.

### Migration Runs Alongside the Wide Write

Partners already calling the wide update can't simply start getting 405. The narrow endpoints go in alongside it, and clients move over screen by screen. Meanwhile the wide update has to route each field through its narrow endpoint's rules, or it becomes a back door, and it keeps its old missing-versus-null ambiguity until its last client moves. Once its traffic stops, `/customers/42` keeps serving the composed view and answers writes with 405 and `Allow: GET`.

## Three Failures Behind One Wide Write

I've come to think most software problems trace back to a failure to align with the need, a failure of architecture governance, or a failure to change direction. The wide write and the usual fixes for it show all three. Teams adopt a design guide written for someone else's clients. They let the read model decide a write surface nobody owned. And they special-case each ambiguous field instead of changing the design.

None of the corrections takes new technology:

- Group fields into a writable resource only when they share an owner, an authorization scope, and a workflow
- Replace those resources whole with PUT, requiring every field in the body
- Give collections with identity-bearing elements their own POST and DELETE endpoints
- Give the operation its own endpoint when a change is a state transition or has to be atomic across concerns
- Require `If-Match` on PUTs, because resending a value read earlier is how a client leaves a field alone
- Version a writable resource when it gains a field, and let reads grow freely
- Move existing clients onto the narrow endpoints, then let aggregate URLs answer GET and refuse writes
- Save partial updates and patch formats for documents, like preference bags and large configurations
