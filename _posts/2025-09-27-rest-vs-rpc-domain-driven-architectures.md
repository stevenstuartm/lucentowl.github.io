---
layout: post
title: "Avoid Forcing REST onto Domain-Driven Architectures"
date: 2025-09-27
tags: [architecture, api-design, ddd, microservices]
description: "Why REST's resource-centric design conflicts with domain-driven architectures and how RPC provides better alignment with business operations."
author: steven-stuart
sources:
  - title: "Roy Fielding, \"REST APIs must be hypertext-driven\" (2008)"
    url: "https://roy.gbiv.com/untangled/2008/rest-apis-must-be-hypertext-driven"
  - title: "Roy Fielding, \"It is okay to use POST\" (2009)"
    url: "https://roy.gbiv.com/untangled/2009/it-is-okay-to-use-post"
  - title: "Google API Improvement Proposals, AIP-136: Custom methods"
    url: "https://google.aip.dev/136"
  - title: "Roy Fielding, Architectural Styles and the Design of Network-based Software Architectures, Chapter 5: Representational State Transfer (REST)"
    url: "https://ics.uci.edu/~fielding/pubs/dissertation/rest_arch_style.htm"
  - title: "Stripe API Reference: Idempotent requests"
    url: "https://docs.stripe.com/api/idempotent_requests"
---

For years I have seen teams wrestle with REST in domain-driven systems. They start with clean REST endpoints then gradually compromise as business operations don't map to resource CRUD. After years or just months, they've abandoned most of what made REST attractive anyway. They invent phantom resources, hide operations in request bodies, and add gateway routing layers, all while gaining few of the architectural benefits REST was supposed to provide.

<blockquote class="pull-quote">
<p>Nested, navigable resource URLs assume one shared model of each entity. Domain-driven design deliberately rejects that assumption.</p>
</blockquote>

The mismatch isn't accidental. When you build systems around bounded contexts and business capabilities, RPC-style APIs provide better alignment without the architectural contortions. By REST I mean REST as most teams practice it, where resources with standard methods are the write path.

## Bounded Contexts Break the Shared Resource Graph

Domain-driven design creates different models of the same entity within different contexts. In the Orders context, a "Customer" might be `{id, shippingAddress, paymentMethod}`. In the Identity context, that same person is a "User" with `{id, email, authProvider, preferences}`. Each context owns its own model because each serves different business capabilities.

Resource-centric API design, as most teams practice it, assumes you can navigate a graph of shared resources. The `/users/{userId}/orders` pattern looks clean until you ask: which service owns "users"? The Orders service needs customer information, but it doesn't own the canonical user representation. The Identity service owns users but knows nothing about orders. Serving `/users/123/orders` means either the Identity service learns about orders or a gateway stitches two contexts' models behind one URL, and either way you've coupled services that should remain independent.

Teams resolve this tension by giving up the shared graph while keeping REST-like syntax:
- Add context prefixes like `/orders/api/customers/{customerId}/orders`, acknowledging that "customers" in the Orders context aren't the same as "users" in Identity
- Map external-facing `/users/{id}/orders` to internal `/orders-service/customers/{id}/orders` through gateway routing
- Flatten to search-style endpoints like `/orders?customerId={id}`, dropping the navigational hierarchy entirely

Each approach acknowledges the same reality: there is no single "user" resource to navigate from. None of them breaks REST's actual constraints. Roy Fielding wrote in "REST APIs must be hypertext-driven" that a REST API must not define fixed resource hierarchies at all, and a filtered collection is a perfectly good resource. What they give up is the navigable graph of shared entities, which is the part of resource design that made `/users/{userId}/orders` look clean in the first place. Each context ends up publishing its own resources in its own vocabulary.

The ownership problem doesn't depend on API style, since an RPC call that lists a customer's orders has to live in one context too. What the split removes is the graph that made a resource model look like the whole design. Each context is left with its own small set of resources, and whether those resources can carry its writes is a separate question, which turns on what those writes are.

## Business Operations Don't Map to Resource CRUD

REST works well when business operations map cleanly to create, read, update, and delete. Even simple operations can break down when they carry business meaning beyond field changes. Domain-driven design makes those operations the norm, because an aggregate changes only through its root, which enforces the aggregate's invariants, so its write path is already a set of commands like cancel or ship.

Consider "cancel an order." In REST terms, this looks like updating the order's status field: `PATCH /orders/{id}` with `{"status": "cancelled"}`. But cancellation isn't just a field update. It triggers refund processing, releases reserved inventory, sends customer notifications, and updates analytics. The operation has validation rules (can't cancel shipped orders) and side effects that don't belong in a generic resource update.

Teams force this into REST through increasingly awkward patterns:

**Hiding operations in PATCH bodies**: A `PATCH /orders/{id}` request with `{"status": "cancelled"}` technically updates the resource, but the server must detect this specific status change and trigger business logic. The handler becomes a switch statement checking what changed. Status changed to "cancelled"? Run the cancellation workflow. Status changed to "shipped"? Run the shipping workflow. Only the address changed? Just update the field. Clients can't tell from the API which field changes are simple updates and which trigger complex workflows. Error handling becomes inconsistent because a failed refund during cancellation behaves nothing like a failed field validation during an address update.

**Breaking transitions into sub-resources**: A `POST /orders/{id}/cancellations` creates a "cancellation" resource, but cancellations aren't independent entities. They're events that happen to orders. Now you have `/orders/{id}/cancellations/{cancellationId}` for something that has no meaningful lifecycle of its own.

**Inventing workflow resources**: A `POST /orders/{id}/cancel-requests` creates a "request" resource that models a workflow state. The order itself is the real entity; the request is a phantom abstraction invented to maintain REST's resource-centric appearance.

The sub-resource itself isn't what fails in either case. A sub-resource earns its URL when the element has its own identity and its own lifecycle, like a label on an issue, a collaborator on a repository, or an item on a subscription. Each of those can be created, addressed, and removed on its own, and giving it an address takes an entire category of ambiguity out of the parent's update body. A transition earns no such URL. A cancellation or an email verification is something the order or the customer goes through rather than something that lives beside it, and turning it into a stored collection to satisfy a URL convention invents an entity the domain doesn't have. Independent identity gets a sub-resource. A transition gets a named operation. A singular `PUT /orders/{id}/cancellation` avoids the stored collection and gets PUT's retry safety, but PUT claims to replace a representation the client supplied, so it has no natural way to report "cancelled, refund failed," and DELETE on the same URL reads as un-cancel, which the domain may not allow. Recording a transition doesn't change how it's requested. The order's history or an audit log can expose cancellations for support and finance to query while the write stays a named cancel operation. A cancellation earns its own sub-resource only when clients create and manage it as a thing in its own right, like an approval request that someone else accepts or rejects. A transition that runs long enough to have a status of its own, like a cancellation awaiting approval or a refund that can fail partway, does need something clients can check, but that is a handle to the running operation, which the named operation can return, not a new entity stored beside the order.

Each approach either hides the operation behind a standard verb or invents a resource to hang it on, while preserving REST-like URL structures. If even "cancel an order" doesn't fit the standard verbs cleanly, more complex operations like splitting a shipment fit them worse.

REST itself doesn't forbid the honest answer. Roy Fielding's "It is okay to use POST" says REST never required PUT for every state change, and Google's AIP-136 defines custom methods such as `POST /v1/{book}:archive` for operations the standard verbs don't cover. But when every meaningful business operation becomes a POST to a named verb, the API is RPC with resource-shaped URLs. Google's guidance makes resources the default and custom methods the exception, and that default pays off when most of an API is standard methods, because uniform create, update, and delete conventions cover most of what clients change.

To check a context, list its state changes and mark each one that has preconditions or side effects beyond saving the field. Editing a shipping address before fulfillment passes as an update, while cancel, ship, and refund don't. Every marked change leaves the generic update and becomes a named operation. When the marked changes are most of the list, the exceptions become the context's write API, with resource reads beside it. That ratio doesn't change any single endpoint. It decides whose conventions the context lives by, since a few custom methods can borrow a resource API's conventions, but an API made mostly of them can't. Designing for that on purpose means each operation gets its own request type, its own preconditions, and its own error contract, so a client calling cancel sees "already shipped" and "refund failed" as distinct, documented outcomes rather than generic update errors. It also means the team owns conventions that a resource model would have supplied, because an operations-first API without them sprawls into bespoke verbs that each behave differently. The minimum is a verb naming rule, one error envelope with per-operation codes, idempotency keys on every write, and one shape for the handle a long-running operation returns.

## REST's Technical Benefits Rarely Apply

REST's architectural constraints provide real benefits in certain contexts: HTTP caching through intermediary proxies can reduce server load, hypermedia enables clients to discover capabilities dynamically, and the uniform interface allows generic tooling to work across different APIs. Operation-heavy contexts rarely benefit from any of these.

**Caching assumes stable representations.** A CDN caching `/orders/12345` doesn't know that an order was just cancelled, shipped, or had items refunded. You can set `Cache-Control: max-age=60`, but that means clients might see stale data for up to a minute after significant business events. For an order status page, showing "Processing" when the order already shipped erodes user trust. You end up setting aggressive cache expiration or bypassing caches entirely, negating the benefit. Conditional requests with ETags avoid serving stale data, but every read still reaches the origin to revalidate, so they save bandwidth, and server work only where the server can check a version without loading the whole order. A per-customer order page is usually marked private and kept out of shared caches anyway. REST caching works well for static content or slowly-changing reference data, not for entities whose state changes through business operations. That makes caching neutral between the styles for these reads, since an RPC read can't be shared-cached either. It's no reason to move reads off GET, only one less reason to model transitions as resources.

**Hypermedia assumes discoverable, stable relationships.** The idea is that clients navigate links in responses rather than hardcoding URLs. But in domain-driven systems, what operations are available depends on business rules, not just resource state. Can this order be cancelled? That depends on payment status, shipping status, time since placement, and customer tier. Encoding all that context in hypermedia links means the server must evaluate business rules on every response just to populate the `_links` section. That is also hypermedia's strongest case in a domain system, because the server is the one place that knows the rules, and a client that follows a `cancel` link never duplicates them. It pays off only when clients follow links instead of hardcoding URLs. Internal service-to-service clients rarely do, and most teams never implement hypermedia controls for them because the complexity isn't worth it. That makes hypermedia a weak reason to choose REST wherever clients hardcode URLs, in any kind of context. A UI that shows a Cancel button on every order view pays for the same rule evaluation in either style, so the cost alone doesn't decide it.

**Uniform interface assumes generic operations.** REST's power comes from treating all resources the same way: GET retrieves, PUT replaces, DELETE removes. Generic tooling can work across APIs because the verbs are standardized. But domain operations aren't generic. "Cancel order" and "cancel subscription" may share a verb in English, but they have completely different validation rules, side effects, and error modes. Forcing them into the same `PATCH` or `DELETE` pattern hides these differences behind a uniform interface that clients must then learn to navigate through documentation and tribal knowledge. Uniformity's practical value sits mostly in the plumbing, such as client retry rules keyed to methods, gateways treating GET as safe, and rate limits and dashboards keyed to method and path. An operations-first context keeps nearly all of it, because its reads stay GET and its transitions were POSTs or status PATCHes in the resource design too, neither of which is safe to retry blindly. What it does give up is tooling that assumes resource semantics, like generated admin screens and generic CRUD clients, and those matter least for writes that a generic client shouldn't be making.

Most teams learn "REST" from tutorials teaching HTTP + JSON + resource URLs, never encountering the actual constraints that make REST architecturally significant. They end up with HTTP-based RPC that pretends to be RESTful without gaining any of the benefits Fielding described in the REST chapter of his dissertation.

## Choose Based on Your Domain Model

Neither approach is universally better. The choice depends on how your domain naturally models work. Most domain-driven systems contain both kinds of context, since supporting subdomains are often plain CRUD, so the choice is made per bounded context and, inside a context, per operation.

**REST fits entity-driven systems.** Media libraries, inventory catalogs, and configuration management often align well with REST. Resources have stable identities, relationships are navigable, and standard CRUD operations match what the business actually does. A photo library really is a collection of photo resources that you create, read, update, and delete. REST's constraints provide genuine value here: caching works because photos don't change often, hypermedia can express album-to-photo relationships for clients that follow links, and generic tooling can operate across different media types.

**RPC fits operation-driven systems.** Operation-heavy contexts, where most state changes carry rules and side effects, align better with explicit operations, meaning endpoints named after what the business does, whether they run over plain HTTP and JSON or a framework like gRPC. Endpoints like `/orders/cancel`, `/orders/refund`, and `/orders/split-shipment` map directly to what the business actually does. The API's vocabulary is the domain's vocabulary. Each endpoint serves a single purpose, so the API's structure keeps transitions apart instead of a handler's switch statement, and each one's request type and errors can be generated and documented on their own. Whether the URL reads `POST /orders/cancel` or the AIP-style `POST /orders/{id}:cancel` matters far less than the contrast with `PATCH /orders/{id}` (though the second keeps the order ID visible to gateway rules and logs keyed on path), which might update the order status, add line items, change shipping addresses, or trigger cancellation depending on the request body. An AIP-style API built mostly from custom methods is the same design under another name. What makes it operations-first is where the design starts, from the operations and their contracts with resources added for reads, and that fields with workflows behind them, like status, can't be changed through a generic update at all.

RPC gives something up in exchange. Operations sent as POST lose HTTP caching and the retry safety that idempotent methods signal to clients and proxies, so an operation like cancel needs its own idempotency key, the way Stripe's API accepts an `Idempotency-Key` header on every POST. Reads that really are entity lookups can stay plain GETs.

| What the domain does | What fits |
| --- | --- |
| Creates, reads, updates, and deletes entities with stable identities | REST resources |
| Manages an element with its own identity and lifecycle, like a label on an issue | A sub-resource |
| Moves an entity through a transition with rules and side effects, like cancelling an order | A named operation |
| Serves data that changes slowly and is read widely | REST with HTTP caching |

Elegance doesn't matter here. What matters is which style matches how your domain actually works. Where a context manages entities with stable identities, use REST for them and for reads. Where it executes business operations with rules and side effects, stop forcing those operations into resource updates, even on an entity like an order.

<blockquote class="pull-quote">
<p>Match your API style to your domain model, not to industry conventions or resume-driven development.</p>
</blockquote>
