---
layout: post
title: "Why JWTs Make Terrible Authorization Tokens"
date: 2025-10-10
tags: [security, architecture, jwt, authentication, authorization]
description: "Embedding authorization in JWTs creates security risks and UX problems because immutable tokens don't match dynamic permissions. Learn why looking up session-based grants at the edge is worth its small latency cost and stricter availability demands."
author: steven-stuart
sources:
  - title: "RFC 9068: JSON Web Token (JWT) Profile for OAuth 2.0 Access Tokens"
    url: "https://datatracker.ietf.org/doc/html/rfc9068"
  - title: "Microsoft identity platform: Access tokens (token lifetime)"
    url: "https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens"
  - title: "Continuous access evaluation in Microsoft Entra"
    url: "https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-continuous-access-evaluation"
  - title: "Amazon DynamoDB"
    url: "https://aws.amazon.com/dynamodb/"
  - title: "Amazon DynamoDB Service Level Agreement"
    url: "https://aws.amazon.com/dynamodb/sla/"
  - title: "RFC 9700: Best Current Practice for OAuth 2.0 Security"
    url: "https://datatracker.ietf.org/doc/html/rfc9700"
  - title: "45 CFR 164.308: HIPAA Security Rule, Administrative Safeguards"
    url: "https://www.law.cornell.edu/cfr/text/45/164.308"
---

JSON Web Tokens (JWTs) have become ubiquitous in modern web applications, but they're often misused. The most common mistake? Treating them as an authorization solution when they're an authentication mechanism. This misunderstanding leads to security vulnerabilities, poor user experience, and operational headaches.

It's also a standardized mistake. RFC 9068, the JWT profile for OAuth access tokens, defines `roles`, `groups`, and `entitlements` claims, and major identity providers offer them as standard configuration. But a client-held JWT lives for an hour or more, and a user's permissions can change at any moment within it.

## Immutability Meets Reality

JWTs are immutable by design. Once signed and issued, the claims inside can't change. Reflecting any change means issuing a new token, while the old one stays valid until it expires. That fits authentication, because the token only has to prove who you were when it was issued. Whether that identity still counts, and what it allows, is a separate question. Authorization is inherently dynamic.

A user's subscription expires mid-day but they retain full access for another hour. An employee gets terminated but their JWT still grants system access until token expiration. A security breach requires immediate permission revocation, but you're stuck waiting for tokens to age out. A customer upgrades their plan, and even if the app forces a refresh on the device where they paid, their other open sessions don't see the new features until their tokens refresh.

<blockquote class="pull-quote">
<p>The immutability creates a window where reality and permissions diverge. With typical one-hour tokens, that's up to 60 minutes of exposure for security incidents.</p>
</blockquote>

That hour isn't a worst case. It's a common default. Microsoft's identity platform, for example, issues access tokens with a default lifetime between 60 and 90 minutes.

## Shortening Lifetimes Doesn't Solve It

The typical response is to shorten JWT lifetimes to 5-15 minutes and refresh aggressively. That doesn't solve the core issue. There's still a delay window, just shorter, and its length is still set by the token's lifetime. Microsoft reached the same conclusion for its own platform. Its documentation on continuous access evaluation says it tried reduced token lifetimes and found they "degrade user experiences and reliability without eliminating risks." A lookup on each request removes the token's lifetime from the equation. The window shrinks to the time a write takes to reach the store.

Microsoft's answer was to push revocation events to the services that accept its tokens. It had little choice. Those services sit outside Entra and can't query its grant store on every call. An organization that runs its own edge in front of its own services can do the lookup Microsoft couldn't.

Microsoft's choice confirms the problem, but its scope shows the limit of push. Continuous access evaluation covers five critical events, such as a disabled account or a password reset. Its documentation allows up to 15 minutes for those events to propagate and up to a day for group membership changes. Push revocation handles the emergencies. A lookup handles every grant change, including the ordinary ones.

## The Lookup Trades Availability, Not Latency

The argument for embedding authorization in JWTs centers on performance: "We can't afford to hit the database on every request." This is a false tradeoff. Verifying a JWT's signature is local CPU work that involves no network call. The added cost is the session lookup and grant read, and AWS documents DynamoDB as delivering single-digit millisecond reads. Both reads are keyed by values the token already carries (the session ID and the user ID), so they can run in parallel. For an API request that already does its own database work, a few extra milliseconds is a small share of the response time. For a request that does none, the lookup can dominate, and that's the case to measure first.

The lookup covers user-level entitlements like roles, tiers, and flags. Per-resource permissions, such as who can edit a given document, are checked where the resource lives, and they never belonged in a token either.

Latency isn't the only objection. A per-request lookup makes the session store a dependency of every request, and when it's unavailable, requests should fail closed rather than fall back to whatever the token claims. That's a serious availability commitment. A service's own database fails only that service, while a shared session store that fails closed takes the whole system down with it.

The store also needs a stricter availability target than the identity provider. Tokens already issued keep working through an identity provider outage, but nothing works through a session store outage. A single-table key read is the simplest kind of read to replicate toward that target, and AWS's service level agreement for DynamoDB global tables commits to 99.999% monthly uptime.

This is the trade the design makes openly. It accepts a stricter dependency on one store in exchange for revocation that takes effect on the next request, so security and UX problems get solved instantly. Behavior is predictable, without "it works sometimes" bugs. And the mental model is simpler, because authorization lives in one place instead of being distributed across every token in flight.

Not every grant has to fail the same way, though. Security-relevant grants like admin rights fail closed. Product grants like a plan tier can fall back to the last value the edge read, because a few minutes of stale tier during an outage costs far less than refusing every request.

Multi-region replicas do bring back a short window, because a revocation written in one region reaches the others after replication lag. That window is bounded by replication, not by token lifetime.

### A Key-Value Store Is Often Fast Enough Without a Cache

Many engineers assume they need Redis or Memcached for fast session lookups. A well-designed DynamoDB table keyed by session ID can often deliver single-digit millisecond reads on its own, so measure its tail latency and read cost at your traffic before adding a cache. Skipping one means:

- No cache warming or invalidation logic
- No cache infrastructure to manage
- No cache-database synchronization issues

The edge still keeps its record of each user's last-read grants for the failover described above, but never as the normal read path.

## Where JWTs Still Shine: Verifiable Identity With Limited Exposure

If JWTs shouldn't carry authorization, and every request hits the session store anyway, why not use an opaque session ID? Because the lookup only has to happen once per user request, at the edge. Behind it, internal services verify the signed identity locally, without a network call, for the work that needs only identity: audit trails, per-user rate limits, and attributing actions to a caller. An opaque ID would send each of those services back to the store.

If you'd rather the client never hold a readable token, the edge can exchange an opaque client token for an internal JWT. The split is the same. Signed identity travels, and grants are looked up fresh. Either way, a stolen token is useful only briefly.

Both versions assume one gateway every user request passes through. Without one, each service a client calls directly does its own lookup, and the cost scales with the number of entry points.

The pattern works like this:

- **The JWT carries** identity, a session ID, source/device info, and an expiration (typically 1 hour)
- **Each user request**, at the edge, validates the JWT signature, looks up the session by its ID, and fetches current grants
- **The client** requests a new JWT as the current one nears expiration
- **The refresh token** is single-use and longer-lived (days or weeks)

The signature check rejects forged or tampered tokens before anything touches the session store, and the session ID is the key for the one lookup each request makes. If a JWT leaks, invalidating its session cuts it off on the very next request, and even an undetected leak expires within the hour.

Single-use refresh tokens close the longer-lived gap. RFC 9700, the IETF's OAuth security best practice, describes how rotation exposes a stolen refresh token. When the attacker and the legitimate client both present the same token, the second use reveals the theft and the server can revoke the session. The refresh mechanism isn't about keeping authorization current. It's about minimizing the window where a compromised token remains useful.

## Microservices Can Share Grant Data Without Sharing Sessions

A common concern is that session-based authorization introduces shared state into a distributed system, creating dependencies and potential bottlenecks. This is legitimate, but the authentication vs. authorization distinction still applies. JWT validation remains stateless with no external dependencies. Authorization requires current state from a shared data store. Not in-memory session state, but externalized grant data.

Patterns that preserve service autonomy include using a shared session store like DynamoDB or Postgres with fast reads and externalized state. You can also build an authorization service with centralized grant logic, or implement API gateway enrichment where the gateway fetches current grants once per user request and passes them to downstream services. That keeps a fan-out of internal calls from multiplying the lookups, and the grants each service sees are no older than the request itself. You're not adding stateful sessions to individual services; you're externalizing authorization to a shared, scalable data layer that services query independently.

Whether those grants travel as a header or a signed internal token, they live for one request. A client-held token carries them for an hour. Services that cache grants follow the same rule. A TTL of seconds, chosen as the staleness you're willing to accept, is a bounded window like replication lag. A cache measured in minutes or hours brings back the stale window this post argues against.

Long-lived connections and deferred work need the same discipline. A WebSocket or stream rechecks grants per message or on a short interval, and a queued job checks the user's grants when it runs, not when it was enqueued.

## Hybrid Approaches Add Complexity Without Closing the Gap

Some teams use hybrid models:

- Coarse-grained roles in the JWT, with fine-grained permissions fetched server-side
- JWT blocklists that track revoked tokens in a shared store
- Short-lived JWTs with embedded permissions that refresh every 5 minutes
- Version numbers in JWTs, where the server checks if the permission version is current

These attempt to balance statelessness with dynamic authorization, but they introduce significant complexity. Tuning becomes difficult: how short should JWT TTL be, how do you cache the blocklist, when do you check versions? In the variants that skip a check on some requests, an authorization bug can sit in token structure, refresh timing, cache invalidation, or server logic. Whether a request gets a wrong answer depends on which token it happened to carry. You still end up with partial solutions that have stale permission windows or require coordination between components.

The coarse-roles variant shows the gap concretely. Demote an admin, and every endpoint that gates on the token's `admin` role keeps letting them in for up to an hour, while endpoints that check fine-grained permissions server-side deny them at once. The same user gets different answers from different endpoints, which is the "it works sometimes" bug a single lookup avoids.

A blocklist or version check done on every request does close the window. But it's the same per-request lookup this post recommends, now with the token's embedded claims as a second source of truth that any service reading them without the check will see stale.

Many teams already sit in the middle, with a per-request session check for revocation and roles embedded for everything else. Terminations and breaches close at once, but role changes still lag. If you're already checking the session on every request, reading grants in the same lookup costs almost nothing extra and removes the remaining lag.

Both designs have settings to tune. The difference is how many places a grant can be stale: one store in the lookup design, and every token in flight in a hybrid. You're building infrastructure to work around the mismatch between immutable tokens and dynamic authorization, when session lookup solves it directly.

## Products and Subscriptions Demand Dynamic Authorization

Product-driven systems tie authorization to constantly changing factors:

- Subscription tiers (Free, Pro, Enterprise)
- Feature flags for gradual rollouts and A/B tests
- Usage limits on API calls, storage, or seats
- Time-based access like trials or seasonal features

Embedding these in JWTs means your product lags reality every time one of them changes while a token is live. For an upgrade, a lapsed payment, or a flag rollout, that's exactly when users notice.

Delegated OAuth scopes are a different case. A scope like `read:calendar` records what a user consented to let a third-party client do, it changes rarely, and putting it in the access token fits its purpose. The problem is the user's own entitlements, which change on the business's schedule rather than the user's.

## Internal Systems Need This More

It's tempting to think internal systems can embed roles in JWTs because employees don't change roles often. But internal systems have higher security requirements with sensitive data and capabilities, and a greater blast radius where compromised admin access affects everyone.

Internal systems also carry compliance duties. HIPAA's Security Rule calls for procedures to terminate access when a workforce member leaves, and an investigation will ask when that person's access actually ended. Embedded roles can satisfy the rule, but a session lookup gives the more precise answer. It's the timestamp of the revocation, where embedded roles give a range that ends at the last token's issue time plus its lifetime. The places where JWT authorization seems acceptable are often where it's most dangerous.

## Central Grants Let Authorization Change Without Redeploying

JWT-based authorization can work for systems with simple, stable permission models. For MVPs or rarely-changing authorization, embedding claims in tokens works well enough. But the moment your system needs to change quickly, the constraints become obvious.

With session-based authorization, grant changes reach all in-flight tokens without deploying code or coordinating services, and logic changes deploy in one place. New permission model? Update the authorization service. Emergency capability revoke? Single database update. Gate a feature for a test group? Add the grant to their records. Temporary elevated access? Grant expires automatically server-side. Fix a permission logic bug? Deploy the authorization service once, and every request immediately uses the new logic.

Changing the shape of grants ripples through the services that consume them in either design. The difference is in data changes. With JWT-based authorization, revoking or adding a grant waits for every affected token to expire, and a new claim layout adds migration logic for old and new tokens in flight. Session-based authorization keeps grant data in one place, while JWT authorization copies it into every token in existence.

As systems grow, simple role checks evolve into feature flags, subscription tiers, usage quotas, and time-based access. The coupling between token format and authorization logic constrains how quickly you can adapt.

<blockquote class="pull-quote">
<p>Use JWTs for what they're good at: cryptographically signed, time-limited proof of identity. For authorization, real-time grant checking costs a few milliseconds and a store you must keep available, and that is a smaller price than the security risks.</p>
</blockquote>
