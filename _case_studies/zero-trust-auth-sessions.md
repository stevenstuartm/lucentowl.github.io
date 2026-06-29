---
layout: case-study
title: "When You Can't Replace What You Haven't Abstracted"
subtitle: "A custom authentication and authorization architecture designed to abstract legacy systems, enforce strict session boundaries, and enable incremental migration to a third-party identity provider"
description: "Five isolated auth implementations were unified behind a single abstracted service using JWT-validated DynamoDB sessions, separated customer and service identity providers, and feature-grant authorization. The architecture was designed with a known migration target in mind, so that switching to a third-party identity provider would require zero changes to internal services."
role: "System Architect"
date: 2023-01-01
headline_metric: "Unified Auth Layer"
headline_detail: "5 legacy systems → 1 abstracted service → seamless third-party migration path"
category: "design"
featured: true
category_label: "Architecture & Design"
technologies:
  - .NET
  - AWS DynamoDB
  - AWS Aurora (MySQL)
  - AWS ECS
  - AWS Parameter Store
  - JWT
  - HotChocolate (GraphQL)
---

## The Problem

The platform served approximately 120,000 users across multiple applications, each handling authentication differently. Five separate implementations existed across the legacy Laravel codebase:

- **Primary product API** — its own database, custom Laravel auth patterns
- **Admin portal** — separate database, separate auth implementation
- **Marketing application** — yet another database, yet another implementation
- **Billing integration** — third-party API for user access to their billing account
- **External scanning tool** — different third-party API for access to a partner web application

None shared sessions, identity stores, or auth contracts. The organization was also rebuilding from Laravel to .NET with a small team shipping one component at a time, which meant legacy and new systems had to coexist throughout.

## Why Not Move to Third-Party Immediately?

The team knew a third-party auth solution was the long-term answer and selected Kinde as the target: its tenant-based isolation, cross-application SSO, and environment-level user management aligned with how the platform's multi-app ecosystem needed to work.

Migrating 120,000 users to Kinde while simultaneously rebuilding the entire platform from PHP to .NET concentrated too much risk in one transition. A simultaneous cutover required all applications to switch at once, which was not realistic given the rebuild timeline.

The decision was to build a custom abstraction layer first, unify auth contracts across all products, then migrate to Kinde without requiring changes to any internal service.

## The Abstraction Strategy

The approach was to abstract the auth pattern from the primary product API, standardize it behind a unified interface, and adopt it endpoint by endpoint on everything new. Legacy apps were never migrated; they kept running exactly as before. A single application could have some endpoints using legacy auth and others using the new abstraction, since all identity providers were supported behind the same interface:

- **The new product web app** — the primary consumer, built from scratch on .NET
- **Background workers** — cross-domain and cross-application .NET processors that needed to authenticate across service boundaries
- **Ad-hoc admin CLI tools** — operational commands that required service-level authentication
- **Eventual rebuilds** — the admin portal and marketing application would adopt the abstraction when they were themselves rebuilt, not before

## Solution Architecture

The system was designed as two complementary services behind a shared client abstraction that all downstream services consumed.

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Client Applications                            │
│           (Web app, Mobile app, Admin portal, Marketing app)        │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                         JWT Bearer Token
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        API Services (.NET on ECS)                    │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │  JwtAuthenticationSchemeHandler (ASP.NET middleware)         │   │
│   │  Validates token → Looks up session → Builds ClaimsPrincipal│   │
│   └──────────────────────────┬──────────────────────────────────┘   │
│                              │                                      │
│   Uses IAuthenticationService (shared client library)               │
│   Uses AuthenticatedHttpClient for service-to-service calls         │
└──────────┬──────────────────────────────────┬───────────────────────┘
           │                                  │
           ▼                                  ▼
┌─────────────────────────┐     ┌─────────────────────────────────────┐
│  Authentication Service │     │      Authorization Service          │
│                         │     │                                     │
│  Identity Providers:    │     │  Feature Grants:                    │
│  ├─ AppUsers            │     │  ├─ Subscription tiers              │
│  ├─ AdminUsers          │     │  ├─ Feature flags                   │
│  ├─ InternalServices    │     │  ├─ Product access                  │
│  ├─ ExternalServices    │     │  └─ Grant caching                   │
│  └─ (future: Kinde)     │     │                                     │
│                         │     │  GraphQL API (HotChocolate)         │
│  Challenge Flows:       │     │                                     │
│  ├─ Login               │     │  Sync from billing webhooks         │
│  ├─ MobileLogin         │     │                                     │
│  ├─ ServiceLogin        │     │                                     │
│  ├─ ThirdPartyLogin     │     │                                     │
│  └─ ProductLogin        │     │                                     │
└──────────┬──────────────┘     └──────────┬──────────────────────────┘
           │                               │
     read/write                      read/write
           │                               │
           ▼                               ▼
┌─────────────────────┐        ┌───────────────────────────┐
│   AWS DynamoDB      │        │   AWS Aurora (MySQL)       │
│                     │        │                            │
│   sessions          │        │   Users & Identity         │
│   sessiontokens     │        │   Feature Tiers            │
│                     │        │   Subscription Plans       │
│   (TTL auto-expire) │        │                            │
└─────────────────────┘        │   + DynamoDB grant cache   │
                               │   + Memcached grant cache  │
                               └───────────────────────────┘
```

The Authentication Service abstracted multiple identity sources behind an `IIdentityProviderRepository` interface. Each source (app users, admin users, internal services, external services) had its own credential verification logic but produced the same session contract.

The Authorization Service managed feature grants, subscription tiers, and product-level permissions. It integrated with external subscription providers to sync what users had paid for, then computed and cached grant sets that any API could query. Authentication and authorization were deliberately separated so that changing the identity provider would not affect how permissions worked.

A pluggable Challenge pattern allowed different authentication flows without modifying the core session logic. Each challenge type implemented the same interface: validate credentials through the appropriate identity provider, create a session, enforce constraints, and return a token. Adding a new authentication method meant implementing a new challenge, not rewriting session management.

## Session Model and DynamoDB Design

Sessions and session tokens lived in DynamoDB, chosen specifically for ephemeral data that loses its usefulness after a bounded period.

```
Table: sessions
┌──────────────────┬─────────────────────────────────────────────────┐
│ Id (HASH)        │ Attributes                                      │
├──────────────────┼─────────────────────────────────────────────────┤
│ "session-uuid"   │ IdentityId, IdentityProviderId, FQRNS[],       │
│                  │ Application, Tenant, OriginIp,                  │
│                  │ ValidTo, CreatedAt, DynamoTTL                   │
└──────────────────┴─────────────────────────────────────────────────┘

Table: sessiontokens
┌──────────────────┬─────────────────────────────────────────────────┐
│ Token (HASH)     │ Attributes                                      │
├──────────────────┼─────────────────────────────────────────────────┤
│ "jwt-string"     │ SessionId, IdentityProviderId, Type,            │
│                  │ ValidTo, DynamoTTL                              │
└──────────────────┴─────────────────────────────────────────────────┘
```

The `sessiontokens` table used the JWT string itself as the hash key, enabling direct lookup from an incoming token to its parent session without parsing JWT claims first. The `sessions` table stored the actual session state: the identity, roles (as Fully Qualified Role Names), application, tenant, and origin IP. The origin IP was captured once at the boundary and stored on the session record, enabling security auditing without propagating user sessions through internal services.

Both tables used DynamoDB's native TTL feature for automatic cleanup; the `DynamoTTL` field was set to the Unix epoch equivalent of the session's `ValidTo` timestamp. Storing sessions in RDS alongside domain entities, as the legacy system did, increased read/write latency for every API call and accumulated storage costs for data useful only days or weeks. DynamoDB gave single-digit millisecond hash key lookups, PAY_PER_REQUEST billing, and TTL-based expiration without operational overhead.

## Zero-Trust: Validate Every Request

The system validated every incoming request against the session store rather than trusting JWT claims. Tokens carry references, not authority; the session in the database is the source of truth, and every request confirms it.

The legacy system already worked this way out of necessity. User data changed through multiple disconnected paths: manual database fixes, third-party billing webhooks, admin tools that bypassed the API entirely. There was no unified write path and no way for a cache or JWT claim to know when something changed, so every request validated against the session store. The zero-trust model formalized what the legacy system had stumbled into by accident.

```
Request arrives with JWT Bearer token
        │
        ▼
Extract sessionId from JWT claims
        │
        ▼
Query DynamoDB sessiontokens table (Token = JWT string)
        │
        ▼
Get SessionId from token record
        │
        ▼
Query DynamoDB sessions table (Id = SessionId)
        │
        ▼
Validate: session exists AND (ValidTo is null OR ValidTo > now)
        │
   ┌────┴────┐
   │ VALID   │ INVALID → Return unauthenticated
   └────┬────┘
        │
Build ClaimsPrincipal from session data (FQRNS, IdentityId, Tenant)
        │
        ▼
Cache ClaimsPrincipal in-memory (keyed by token, TTL varies by provider)
        │
        ▼
Set HttpContext.User = ClaimsPrincipal
        │
        ▼
Authorization handlers run ([Authorize] policies check FQRNs)
```

User sessions were never cached; every request hit DynamoDB to confirm the session was still valid, so revocation took effect on the very next call. Service sessions were different: an in-memory `ConcurrentMemoryCache<ClaimsPrincipal>` cached resolved service identities because service identity changed far less frequently and the request volume would otherwise create unnecessary DynamoDB load.

The total latency cost for user requests was 5-10ms per uncached lookup against a properly partitioned DynamoDB table. For API requests that typically took 50-200ms, this was imperceptible. The tradeoff bought immediate revocation, predictable behavior across all the disconnected write paths, and a simpler mental model where authorization lived in one place. For a deeper analysis of why JWTs make poor authorization tokens, see [Why JWTs Make Terrible Authorization Tokens](/blog/2025/10/10/jwts-are-for-authentication-not-authorization.html).

## Customer Sessions vs. Service Sessions

The system supported two distinct session types through the same framework, distinguished by their identity provider rather than by separate code paths.

### User Sessions

User sessions authenticated customers and employees through username/password credentials verified with BCrypt against MySQL user records. Each session carried the user's Fully Qualified Role Names (FQRNs), application context, tenant, and origin IP. Sessions expired after 30 days, and a maximum of 4 concurrent sessions per user per application prevented unlimited parallel session accumulation.

When a user logged in, the system checked their FQRNs against the application's eligibility requirements. A user with `platform.apps:user` could authenticate to the flagship app, but not to the admin portal which required `platform.apps:admin`. This prevented users from accessing applications they were not authorized for, even with valid credentials.

### Service Sessions

Service-to-service sessions authenticated internal APIs through secret keys stored in AWS Parameter Store. Unlike user sessions, service sessions had no expiration and were limited to one per service. Services reused existing sessions across calls and only created new ones when no valid session existed or when the current session was approaching a configurable refresh threshold, which minimized DynamoDB writes for services that called each other frequently.

### Why Sessions Never Cross Boundaries

User sessions were validated at the API boundary and consumed there. Once validated, the session was replaced with explicit context (user_id, tenant_id, correlation_id) and service credentials. Internal services authenticated as themselves with their own service sessions and never received, forwarded, or validated user session tokens.

This separation meant that compromising a user token did not automatically compromise service-to-service communication. Each service controlled its own authorization model without needing to understand user permission structures, and could be tested, deployed, and scaled independently. For a deeper analysis of why authentication sessions should not propagate through internal systems, see [Auth Sessions Should Never Be Transient Across Boundaries](/blog/2025/10/10/auth-sessions-should-never-cross-boundaries.html).

## The Client Abstraction

Every downstream service consumed authentication through a single interface: `IAuthenticationService`.

```
┌──────────────────────────────────────────────────────┐
│             IAuthenticationService                    │
│            (shared client library)                    │
├──────────────────────────────────────────────────────┤
│  Validate token → resolve session → ClaimsPrincipal  │
│  Get or refresh service session token                │
│  Retrieve authorization grants                       │
│  Inject Bearer header on outgoing HTTP requests      │
│  Check local session state                           │
└──────────────────────────────────────────────────────┘
```

For service-to-service calls, an `AuthenticatedHttpClient` wrapped a standard HTTP client and automatically injected the service's Bearer token on every outgoing request. A service that needed to call another service did not manage tokens, refresh logic, or authentication headers; it constructed an `AuthenticatedHttpClient` at startup and made HTTP calls.

On the receiving side, `JwtAuthenticationSchemeHandler` integrated with ASP.NET's authentication pipeline. It extracted the Bearer token from the request, called `GetClaimsPrincipal` to validate the session, and set `HttpContext.User` to the resulting `ClaimsPrincipal`. Standard `[Authorize]` attributes and custom policy handlers then checked FQRNs for endpoint-level access control.

Onboarding a new service required three steps: register `IAuthenticationService` as a singleton, use `AuthenticatedHttpClient` for outgoing calls, and add `[Authorize]` attributes to endpoints. The service did not need to know how tokens were validated, where sessions were stored, or which identity provider issued the token. That isolation was the entire point.

## Feature Grants and Authorization

Authentication determined who you were. Authorization determined what you could do. These two concerns were deliberately separated so that changing the identity provider would not affect how product access worked.

Roles were immutable on the session. A user's FQRN like `platform.apps:user` or `platform.servicing:admin` was set when the session was created and did not change until the session expired or was replaced. For most API endpoints, the role was the only authorization check needed; serious access changes like termination or role elevation resulted in session invalidation rather than mid-session role modification.

Product access was different. Feature grants were derived from subscription tiers and computed dynamically, never embedded in the JWT or stored on the session. When an API endpoint needed to check whether a user had access to a specific feature, it queried the authorization service:

```
┌───────────────────────────────────────────────────────┐
│                      UserGrants                       │
├───────────────────┬───────────────────────────────────┤
│ Feature IDs       │ Individual feature access          │
│                   │ (e.g., analytics, reports)         │
├───────────────────┼───────────────────────────────────┤
│ Grant Group IDs   │ Subscription tier membership       │
│                   │ (e.g., freemium, pro)              │
├───────────────────┼───────────────────────────────────┤
│ Products          │ Product-level feature groups       │
│                   │ (e.g., content → blog, video)      │
└───────────────────┴───────────────────────────────────┘
```

### Grant Caching and Synchronization

Computing grants required joining subscription data with feature tier definitions, so the result was cached in two tiers. DynamoDB stored computed grants with a 15-minute TTL for cross-instance persistence; Memcached provided faster lookups within a single instance's lifetime.

When a user's subscription changed (a Recurly webhook fired, an admin manually adjusted a plan, or a trial expired), the sync process updated the database, cleared both caches, and the next request recalculated grants from the updated data. Users saw subscription changes reflected immediately on their next API call without logging out and back in. This was one of the concrete benefits of not embedding grants in JWTs: a subscription upgrade took effect within one request cycle, not after token expiration.

## Designing for the Kinde Migration

Every architectural decision was made knowing that Kinde was the eventual identity provider, and the goal was to make the migration as small and safe as possible.

### The Lazy Internal Session Pattern

When the migration began, the API would receive tokens from Kinde instead of (or alongside) the custom auth system. The API would detect that the incoming token was not an internal session, call the authentication service to get-or-create an internal session mapped to the Kinde token, and proceed exactly as before. Internal services would never know the difference.

```
Client authenticates with Kinde → Receives Kinde JWT
        │
        ▼
API receives Kinde JWT in Authorization header
        │
        ▼
JwtAuthenticationSchemeHandler detects non-internal token
        │
        ▼
Calls Authentication Service: GetOrCreateSessionForExternalToken()
        │
        ▼
Authentication Service:
  1. Validates Kinde token
  2. Maps Kinde identity to platform user
  3. Creates internal session with mapped FQRNs
  4. Returns internal session token
        │
        ▼
API proceeds with internal session (identical to current flow)
        │
        ▼
Internal services receive platform sessions, platform roles, platform grants
(zero changes required)
```

This let individual applications migrate to Kinde independently while others continued using custom auth. Service-to-service authentication was unaffected entirely.

### User Migration Strategy

User migration would use Kinde's import capability with bcrypt password hashes, meaning existing users could log in with their current passwords without a forced reset. For the transition period, existing sessions would expire naturally (30 days maximum), and the Lazy Internal Session pattern would handle the first post-migration login seamlessly.

## What I'd Reconsider

Looking back, the team should have at least considered mTLS for service-to-service authentication instead of service role tokens.

Service actor identity proved quite useful in practice. Knowing that "Service A called this endpoint" (not just "a valid service token was used") enabled meaningful audit trails, per-service rate limiting, and fine-grained access control over which services could call which endpoints. That granularity would have been harder to achieve with mTLS alone, where identity is typically at the certificate level rather than the request level.

That said, mTLS would have provided stronger transport-level authentication guarantees. With service role tokens, the security model depends on secret management: if a service's auth secret is compromised, an attacker can impersonate that service until the secret is rotated. The strongest option would have been mTLS for transport-level authentication alongside service tokens for application-level authorization, but at the time, secret management in Parameter Store was sufficient for the organization's risk tolerance.

## Tradeoffs and Limitations

**No complex session analytics.** DynamoDB's hash-key access pattern meant the system could efficiently look up a specific session or all sessions for a specific identity, but it could not answer questions like "show me all sessions created in the last hour by admin users" without a full table scan. An async write to MySQL could have provided queryable session analytics, but there was no business need for it at the time.

**Medium-term architecture by design.** The custom authentication system was not intended to be the permanent solution. It was the cost of flexibility: if Kinde didn't work out, the team could swap to a different provider without touching internal services.
