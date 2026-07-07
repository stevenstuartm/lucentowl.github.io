---
layout: post
title: "Why JWTs Make Terrible Authorization Tokens"
date: 2025-10-10
tags: [security, architecture, jwt, authentication, authorization]
description: "Embedding authorization in JWTs creates security risks and UX problems because immutable tokens don't match dynamic permissions. Learn why session-based grants are worth the minimal latency cost."
author: steven-stuart
---

JSON Web Tokens (JWTs) have become ubiquitous in modern web applications, but they're often misused. The most common mistake? Treating them as an authorization solution when they're an authentication mechanism. This misunderstanding leads to security vulnerabilities, poor user experience, and operational headaches.

## Immutability Meets Reality

JWTs are immutable by design. Once signed and issued, the claims inside cannot be changed until expiration. This works for authentication because your identity doesn't change mid-session, but authorization is inherently dynamic. A user's subscription expires mid-day but they retain full access for another hour. An employee gets terminated but their JWT still grants system access until token expiration. A security breach requires immediate permission revocation, but you're stuck waiting for tokens to age out. A customer upgrades their plan but doesn't see new features until the next token refresh.

<blockquote class="pull-quote">
<p>The immutability creates a window where reality and permissions diverge. With typical one-hour tokens, that's up to 60 minutes of exposure for security incidents.</p>
</blockquote>

## Shortening Lifetimes Doesn't Solve It

The typical response is to shorten JWT lifetimes to 5-15 minutes and refresh aggressively. This creates chatty network traffic with constant token refresh requests, adds complexity with more moving parts and new failure paths, and doesn't even solve the core issue; there's still a delay window, just shorter. You're still working around the fundamental mismatch between immutable tokens and dynamic authorization.

## Performance Is Not the Tradeoff

The argument for embedding authorization in JWTs centers on performance: "We can't afford to hit the database on every request." This is a false tradeoff. JWT validation takes roughly 1-2ms. Session lookup plus grant retrieval from a properly indexed DynamoDB table adds 5-10ms. Total latency added: 3-8ms. For a typical API request that takes 50-200ms, this is imperceptible.

In return, you gain immediate revocation where security and UX problems get solved instantly, predictable behavior without "it works sometimes" bugs, and a simpler mental model where authorization lives in one place instead of being distributed across every token in flight.

### No Cache Required

Many engineers assume they need Redis or Memcached for fast session lookups. In practice, a well-designed DynamoDB table delivers single-digit millisecond reads without cache cluster complexity:

- No cache warming or invalidation logic
- No cache infrastructure to manage
- No cache-database synchronization issues
- Often lower cost at scale than running a cache cluster

## Where JWTs Still Shine: Limiting Token Exposure

If JWTs shouldn't carry authorization, what's their value? Limiting the blast radius of token exposure.

The pattern works like this: the JWT contains identity, session ID, source/device info, and expiration (typically 1 hour). On each request, you validate the JWT, look up the session, and fetch current grants. The client auto-requests a new JWT when approaching expiration. The refresh token is single-use and longer-lived (days or weeks).

If a JWT gets leaked, the token is only valid for 1 hour maximum. The next refresh can be denied if the session is invalidated, and the session ID enables tracking suspicious token usage patterns. The refresh mechanism isn't about keeping authorization current; it's about minimizing the window where a compromised token remains useful.

## Microservices and Shared State

A common concern is that session-based authorization introduces shared state into a distributed system, creating dependencies and potential bottlenecks. This is legitimate, but the authentication vs. authorization distinction still applies. JWT validation remains stateless with no external dependencies. Authorization requires current state from a shared data store. Not in-memory session state, but externalized grant data.

Patterns that preserve service autonomy include using a shared session store like DynamoDB or Postgres with fast reads and externalized state. You can also build an authorization service with centralized grant logic that can be cached at the edge, or implement API gateway enrichment where the gateway fetches grants once and enriches downstream requests. You're not adding stateful sessions to individual services; you're externalizing authorization to a shared, scalable data layer that services query independently.

## Hybrid Approaches and Their Complexity

Some teams use hybrid models: coarse-grained roles in the JWT with fine-grained permissions fetched server-side, JWT blocklists that track revoked tokens in a shared store, short-lived JWTs with embedded permissions that refresh every 5 minutes, or version numbers in JWTs where the server checks if the permission version is current.

These attempt to balance statelessness with dynamic authorization, but they introduce significant complexity. Tuning becomes difficult: how short should JWT TTL be, how do you cache the blocklist, when do you check versions? Debugging becomes a nightmare because authorization bugs span token structure, refresh timing, cache invalidation, and server logic. You still end up with partial solutions that have stale permission windows or require coordination between components.

The complexity cost rarely justifies the benefits. You're building infrastructure to work around the mismatch between immutable tokens and dynamic authorization, when session lookup solves it directly.

## Products and Subscriptions Demand Dynamic Authorization

Product-driven systems tie authorization to constantly changing factors: subscription tiers (Free, Pro, Enterprise), feature flags for gradual rollouts and A/B tests, usage limits on API calls or storage or seats, and time-based access like trials or seasonal features. Embedding these in JWTs means your product is always out of sync with reality.

## Internal Systems Need This More

It's tempting to think internal systems can embed roles in JWTs because employees don't change roles often. But internal systems have higher security requirements with sensitive data and capabilities, greater blast radius where compromised admin access affects everyone, compliance needs where SOC2 or GDPR or HIPAA require immediate revocation, and audit requirements where "when did this person lose access" must be answerable with precision. The places where JWT authorization seems acceptable are often where it's most dangerous.

## Operational Flexibility Matters

JWT-based authorization can work for systems with simple, stable permission models. For MVPs or rarely-changing authorization, embedding claims in tokens works well enough. But the moment your system needs to change quickly, the constraints become obvious.

With session-based authorization, you can change system behavior for all in-flight tokens without deploying code or coordinating services. New permission model? Update the authorization service. Emergency capability revoke? Single database update. A/B test a feature gate? Flip a flag in the session store. Temporary elevated access? Grant expires automatically server-side. Fix a permission logic bug? Every request immediately uses new logic.

With JWT-based authorization, you need client updates for new token structures, coordinated service deployments if multiple services parse claims, migration logic for old vs. new token formats, careful timing to avoid breaking in-flight tokens, and waiting for token expiration before changes take effect. Session-based authorization centralizes logic in one place while JWT authorization distributes it across every token in existence, requiring coordination and time for changes.

As systems grow, simple role checks evolve into feature flags, subscription tiers, usage quotas, and time-based access. The coupling between token format and authorization logic constrains how quickly you can adapt.

<blockquote class="pull-quote">
<p>Use JWTs for what they're good at: cryptographically signed, time-limited proof of identity. For authorization, the 5ms latency cost of real-time grant checking is negligible compared to the security risks.</p>
</blockquote>
