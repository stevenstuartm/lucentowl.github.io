---
layout: post
title: "Avoid Forcing REST onto Domain-Driven Architectures"
date: 2025-09-27
tags: [architecture, api-design, ddd, microservices]
description: "Why REST's resource-centric design conflicts with domain-driven architectures and how RPC provides better alignment with business operations."
author: steven-stuart
---

For years I have seen teams wrestle with REST in domain-driven systems. They start with clean REST endpoints then gradually compromise as business operations don't map to resource CRUD. After years or just months, they've abandoned most REST principles anyway. They invent phantom resources, hide operations in request bodies, and add gateway routing layers, all while gaining none of the architectural benefits REST was supposed to provide.

<blockquote class="pull-quote">
<p>REST's resource-centric model assumes a world of global, consistent entities. Domain-driven design deliberately rejects that assumption.</p>
</blockquote>

The mismatch isn't accidental. When you build systems around bounded contexts and business capabilities, RPC-style APIs provide better alignment without the architectural contortions.

## Bounded Contexts Break REST's Core Assumptions

Domain-driven design creates different models of the same entity within different contexts. In the Orders context, a "Customer" might be `{id, shippingAddress, paymentMethod}`. In the Identity context, that same person is a "User" with `{id, email, authProvider, preferences}`. Each context owns its own model because each serves different business capabilities.

REST's resource-centric design assumes you can navigate a graph of globally consistent resources. The `/users/{userId}/orders` pattern looks clean until you ask: which service owns "users"? The Orders service needs customer information, but it doesn't own the canonical user representation. The Identity service owns users but knows nothing about orders. If you call `/users/123` expecting shipping information and the Identity service responds with authentication details, you've coupled services that should remain independent.

Teams resolve this tension by abandoning REST's uniform resource model while keeping REST-like syntax:
- Add context prefixes like `/orders/api/customers/{customerId}/orders`, acknowledging that "customers" in the Orders context aren't the same as "users" in Identity
- Map external-facing `/users/{id}/orders` to internal `/orders-service/customers/{id}/orders` through gateway routing
- Flatten to search-style endpoints like `/orders?customerId={id}`, dropping the navigational hierarchy entirely

Each approach acknowledges the same reality: there is no single "user" resource to navigate from. The bounded contexts have different models, and REST's assumption of traversable, consistent resources doesn't hold.

## Business Operations Don't Map to Resource CRUD

REST works well when business operations map cleanly to create, read, update, and delete. Even simple operations can break down when they carry business meaning beyond field changes.

Consider "cancel an order." In REST terms, this looks like updating the order's status field: `PATCH /orders/{id}` with `{"status": "cancelled"}`. But cancellation isn't just a field update. It triggers refund processing, releases reserved inventory, sends customer notifications, and updates analytics. The operation has validation rules (can't cancel shipped orders) and side effects that don't belong in a generic resource update.

Teams force this into REST through increasingly awkward patterns:

**Hiding operations in PATCH bodies**: A `PATCH /orders/{id}` request with `{"status": "cancelled"}` technically updates the resource, but the server must detect this specific status change and trigger business logic. The handler becomes a switch statement checking what changed. Status changed to "cancelled"? Run the cancellation workflow. Status changed to "shipped"? Run the shipping workflow. Only the address changed? Just update the field. Clients can't tell from the API which field changes are simple updates and which trigger complex workflows. Error handling becomes inconsistent because a failed refund during cancellation behaves nothing like a failed field validation during an address update.

**Breaking into sub-resources**: A `POST /orders/{id}/cancellations` creates a "cancellation" resource, but cancellations aren't independent entities. They're events that happen to orders. Now you have `/orders/{id}/cancellations/{cancellationId}` for something that has no meaningful lifecycle of its own.

**Inventing workflow resources**: A `POST /orders/{id}/cancel-requests` creates a "request" resource that models a workflow state. The order itself is the real entity; the request is a phantom abstraction invented to maintain REST's resource-centric appearance.

Each approach abandons REST's core premise (that operations are standard verbs applied to resources) while preserving REST-like URL structures. If even "cancel an order" doesn't fit cleanly, more complex operations have no chance.

## REST's Technical Benefits Rarely Apply

REST's architectural constraints provide real benefits in certain contexts: HTTP caching through intermediary proxies can reduce server load, hypermedia enables clients to discover capabilities dynamically, and the uniform interface allows generic tooling to work across different APIs. Domain-driven systems rarely benefit from any of these.

**Caching assumes stable representations.** A CDN caching `/orders/12345` doesn't know that an order was just cancelled, shipped, or had items refunded. You can set `Cache-Control: max-age=60`, but that means clients might see stale data for up to a minute after significant business events. For an order status page, showing "Processing" when the order already shipped erodes user trust. You end up setting aggressive cache expiration or bypassing caches entirely, negating the benefit. REST caching works well for static content or slowly-changing reference data, not for entities whose state changes through business operations.

**Hypermedia assumes discoverable, stable relationships.** The idea is that clients navigate links in responses rather than hardcoding URLs. But in domain-driven systems, what operations are available depends on business rules, not just resource state. Can this order be cancelled? That depends on payment status, shipping status, time since placement, and customer tier. Encoding all that context in hypermedia links means the server must evaluate business rules on every response just to populate the `_links` section. Most teams never implement hypermedia controls anyway because the complexity isn't worth it for internal service-to-service communication.

**Uniform interface assumes generic operations.** REST's power comes from treating all resources the same way: GET retrieves, PUT replaces, DELETE removes. Generic tooling can work across APIs because the verbs are standardized. But domain operations aren't generic. "Cancel order" and "cancel subscription" may share a verb in English, but they have completely different validation rules, side effects, and error modes. Forcing them into the same `PATCH` or `DELETE` pattern hides these differences behind a uniform interface that clients must then learn to navigate through documentation and tribal knowledge.

Most teams learn "REST" from tutorials teaching HTTP + JSON + resource URLs, never encountering the actual constraints that make REST architecturally significant. They end up with HTTP-based RPC that pretends to be RESTful without gaining any of the benefits Roy Fielding described.

## Choose Based on Your Domain Model

Neither approach is universally better. The choice depends on how your domain naturally models work.

**REST fits entity-driven systems.** Media libraries, inventory catalogs, and configuration management often align well with REST. Resources have stable identities, relationships are navigable, and standard CRUD operations match what the business actually does. A photo library really is a collection of photo resources that you create, read, update, and delete. REST's constraints provide genuine value here: caching works because photos don't change often, hypermedia can express album-to-photo relationships, and generic tooling can operate across different media types.

**RPC fits operation-driven systems.** Domain-driven architectures with bounded contexts and business workflows align better with explicit operations. Endpoints like `/orders/cancel`, `/orders/refund`, and `/orders/split-shipment` map directly to what the business actually does. There's no translation layer between domain language and API structure. Documentation becomes clearer because each endpoint serves a single purpose. Compare `POST /orders/cancel` with explicit parameters to `PUT /orders/{id}` which might update the order status, add line items, change shipping addresses, or trigger cancellation depending on the request body.

Elegance doesn't matter here; what matters is which style matches how your domain actually works. If your system manages entities with stable identities, use REST. If your system executes business operations across bounded contexts, stop forcing those operations into resource updates.

<blockquote class="pull-quote">
<p>Match your API style to your domain model, not to industry conventions or resume-driven development.</p>
</blockquote>
