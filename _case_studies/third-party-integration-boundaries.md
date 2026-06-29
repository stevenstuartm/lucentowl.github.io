---
layout: case-study
title: "When Third-Party Integration Meets Domain Boundaries"
subtitle: "Embedding Discord concerns within domains instead of extracting them to a dedicated service"
description: "Should third-party integration concerns live inside existing domains or become their own bounded context? This case study examines the tradeoffs through a Discord integration, choosing a domain-embedded approach as intentional short-term debt."
role: "System Architect"
date: 2026-01-27
headline_metric: "Intentional Debt"
headline_detail: "Documented tradeoffs & evolution triggers"
category: "design"
category_label: "Architecture & Design"
technologies:
  - Discord API
  - OAuth 2.0
  - DDD
  - Microservices
---

## Executive Summary

The company sells access to content published on a Discord server. The initial implementation relied on manual verification: employees confirm purchases and assign Discord roles by hand. Automating access requires integrating Discord into multiple existing domains; authorization needs role mappings, subscription management needs plan-to-role assignments, user management needs Discord identity storage, and registration needs OAuth orchestration.

I chose to embed Discord concerns within each domain rather than extracting a dedicated Discord API. This is intentional short-term debt: with a single small team and one integration not yet proven, designing a provider interface before knowing what each domain needs from it is premature. The architecture will evolve to a thin provider when specific triggers occur: multiple similar third-party integrations, team growth, or significantly increased API call volume.

## The Business Context

One product grants access to a Discord server where the company publishes content and customers engage in community discussions. This is the first time the company sells access to content published on a platform it doesn't directly own; Discord introduces a third-party API, external identity systems, and platform-specific access controls, which is part of why discovery and agility were weighted so heavily in the architectural decision.

The current workflow is entirely manual:

1. Customer purchases a Discord access plan through the normal purchase flow
2. Customer receives an email directing them to create a Discord account and join the company server
3. Customer provides their registered email through a Discord workflow
4. An employee manually verifies the customer's plan in a spreadsheet
5. The employee assigns the appropriate Discord role, granting channel access
6. When a customer's plan changes (upgrade, downgrade, cancellation), an employee must notice the change and manually update their Discord role

Discord roles control channel visibility. A "Premium" role might grant access to exclusive channels while a "Free" role provides limited access. The mapping between subscription plans and Discord roles is the core business logic that needs automation.

## The Existing Domain Architecture

Before discussing where Discord fits, here's the relevant portion of the existing architecture:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Prime (Frontend)                                │
│                     User-facing web application                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐
│    Registrar API      │ │  Subscription Mgmt    │ │   Authorization API   │
│                       │ │        API            │ │                       │
│ • User registration   │ │ • Plan management     │ │ • Access rules        │
│ • Email verification  │ │ • Billing integration │ │ • Product permissions │
│ • Onboarding flows    │ │ • Billing events      │ │ • Feature flags       │
└───────────────────────┘ └───────────────────────┘ └───────────────────────┘
                                      │
                                      ▼
                          ┌───────────────────────┐
                          │      Users API        │
                          │                       │
                          │ • User profiles       │
                          │ • Identity data       │
                          │ • GraphQL interface   │
                          └───────────────────────┘
```

## The Options Considered

### Option 1: Domain-Embedded Integration

Each domain owns the Discord concepts relevant to its responsibilities:

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                                   Prime                                        │
│                        Discord OAuth UI components                             │
└───────────────────────────────────────────────────────────────────────────────┘
                                       │
          ┌────────────────────────────┼────────────────────────────┐
          │                            │                            │
          ▼                            ▼                            ▼
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│    Registrar API     │  │  Subscription Mgmt   │  │  Authorization API   │
│                      │  │                      │  │                      │
│ Discord OAuth flow   │  │ plan_discord_roles   │  │ discord_roles table  │
│ Discord registration │  │ (which plans grant   │  │ (role metadata,      │
│                      │  │  which roles)        │  │  assignability rules)│
│   ┌──────────────┐   │  │   ┌──────────────┐   │  │   ┌──────────────┐   │
│   │Discord Client│   │  │   │Discord Client│   │  │   │Discord Client│   │
│   └──────────────┘   │  │   └──────────────┘   │  │   └──────────────┘   │
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘
                                                               │
                                                    User authorization
                                                         sync
                                                               │
                                       ┌───────────────────────┘
                                       ▼
                          ┌──────────────────────┐
                          │      Users API       │
                          │                      │
                          │ user_discord_accounts│
                          │ (Discord ↔ user      │
                          │  identity mapping)   │
                          └──────────────────────┘
```

**Data ownership:**
- **Authorization API** owns role metadata: which Discord roles exist, which can be assigned programmatically, and which serve as defaults
- **Subscription Management API** owns plan-to-role mappings: which roles a given subscription plan grants
- **Users API** owns the identity mapping between platform users and Discord accounts
- **Registrar API** has no persistent Discord data; it orchestrates the OAuth flow and delegates storage to the Users API

**Workflow:**
1. User initiates Discord linking through Prime
2. Registrar API handles OAuth, obtains Discord identity
3. Registrar API stores identity mapping via Users API
4. Registrar API triggers authorization sync
5. Authorization API reads user's plans (from Subscription Management), determines correct roles, updates Discord

When a plan changes (billing webhook), Subscription Management triggers the same authorization sync and roles update automatically.

Embedding client code in each domain doesn't mean abandoning governance. Credentials and configuration are managed through AWS Parameter Store, ensuring consistent client behavior and centralized credential management. Ownership across domains is documented in an ADR so developers know where Discord concepts live: role metadata in Authorization, plan-to-role mappings in Subscription Management, user identity in Users, OAuth orchestration in Registrar.

### Option 2: Thin Provider API

Centralize Discord API access while keeping business logic in domains:

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                              Discord Provider API                              │
│                                                                                │
│  • Discord API client (credentials, rate limiting, retries)                   │
│  • OAuth token management                                                      │
│  • Role assignment operations                                                  │
│  • Server membership operations                                                │
│  • No business logic about WHEN to assign roles                               │
└───────────────────────────────────────────────────────────────────────────────┘
                    ▲                    ▲                    ▲
                    │                    │                    │
       ┌────────────┘                    │                    └────────────┐
       │                                 │                                 │
┌──────┴───────────────┐  ┌──────────────┴─────────────┐  ┌───────────────┴────┐
│    Registrar API     │  │  Subscription Mgmt API     │  │  Authorization API │
│                      │  │                            │  │                    │
│ Calls provider for   │  │ plan_discord_roles table   │  │ discord_roles      │
│ OAuth operations     │  │ (still owns plan→role      │  │ (still owns role   │
│                      │  │  mappings)                 │  │  metadata)         │
└──────────────────────┘  └────────────────────────────┘  └────────────────────┘
```

The provider becomes an Anti-Corruption Layer: it translates between Discord's API and domain-friendly operations. Domains still own their Discord-related data and logic, but they call the provider instead of embedding Discord client code.

### Option 3: Thick Provider API

Centralize both Discord access AND Discord-related data:

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                              Discord Provider API                              │
│                                                                                │
│  • Discord API client                                                          │
│  • OAuth token management                                                      │
│  • discord_roles table                                                         │
│  • plan_discord_roles table                                                    │
│  • user_discord_accounts table                                                 │
│  • Role sync logic                                                             │
└───────────────────────────────────────────────────────────────────────────────┘
                    ▲                    ▲
                    │                    │
       ┌────────────┘                    └────────────┐
       │                                              │
┌──────┴───────────────┐               ┌──────────────┴─────────────┐
│    Registrar API     │               │  Subscription Mgmt API     │
│                      │               │                            │
│ Delegates OAuth to   │               │ Notifies provider of       │
│ provider             │               │ plan changes               │
└──────────────────────┘               └────────────────────────────┘
```

The provider owns everything Discord-related. Domains notify it of relevant events (plan changes, user registration), and the provider handles the rest.

## The Decision: Domain-Embedded Integration

I chose Option 1 (domain-embedded) for now, with a planned evolution to Option 2 (extracted provider) once the solution matures.

### Why Not a Thick Provider?

Option 3 inverts the natural dependency direction. Domains at the center should call out to the fringe; the fringe should not reach into the center. A provider exists to be used by domains, not to use them.

Role synchronization requires reading a user's current plans and applying authorization rules. If the Discord provider owns this logic, it must either call into Subscription Management and Authorization to get the data it needs (a fringe concern reaching into the domain center), duplicate plan and authorization data into its own storage creating consistency problems, or receive all relevant data in the sync request and force callers to assemble context it then processes. None of these is clean.

The Authorization API already exists to answer "what can this user access?" Adding Discord as another access type fits naturally. Extracting that logic into a Discord provider would fragment authorization decisions across services.

### Why Not a Thin Provider (Yet)?

Option 2 is the likely evolution, but creating it now would cost more than it saves. A new service needs deployment and maintenance infrastructure, and more critically, an interface designed before knowing what each domain actually needs from it. With one integration not yet proven, that investment isn't justified.

The feature has a limited time window to prove value. If it succeeds, we can invest in maturing the architecture. If it fails, we've avoided building infrastructure for something that didn't work out.

This decision trades off two priorities against two others:

| Priority | Embedding | Thin Provider |
|---|---|---|
| **Cost** | Lower: no new service to build or operate | Higher: deploy, maintain, version an API contract |
| **Agility** | Higher: each domain evolves independently | Lower: interface changes require updating the provider first |
| **Consistency** | Lower: duplicate client behavior across domains | Higher: single implementation |
| **Maintainability** | Lower: Discord code is scattered | Higher: one place to find it |

For a small team prioritizing speed and flexibility, the top two rows dominate. For a mature system with stabilized patterns and multiple teams, the bottom two would.

## When to Centralize

This decision isn't permanent. Several triggers would shift the calculus toward centralization:

| Trigger | Current State | Evolution Signal |
|---------|---------------|------------------|
| Multiple providers | 1 (Discord only) | 2+ providers with similar patterns |
| Team structure | Single small team | Multiple teams needing Discord integration |
| API call volume | Infrequent (OAuth, role changes) | Real-time sync, frequent operations |
| API complexity | Small, stable subset | Frequent Discord API changes requiring coordinated updates |

### Trigger 1: Multiple Third-Party Providers With Similar Patterns

If the company integrates Slack, Telegram, or other community platforms alongside Discord, the domain-embedded approach multiplies: three domains times three providers becomes nine integration points instead of three. More providers don't automatically justify extraction; the trigger is providers with similar enough patterns that a shared abstraction adds value rather than forcing awkward compromises.

### Trigger 2: Team Growth

With a single team, maintaining consistent behavior across embeddings is a documentation and code review problem. With multiple teams, it becomes a coordination problem: teams need to align on conventions they didn't write and can't easily enforce. A shared provider makes those conventions structural. The trigger isn't team count alone; it's when coordinating consistent behavior across embeddings costs more than maintaining a shared interface.

### Trigger 3: Processing Load

Currently, Discord API calls are infrequent: OAuth during registration, role updates on plan changes. If usage patterns shift toward real-time presence sync, message integration, or frequent role checks, centralized rate limiting and connection pooling become valuable.

### Trigger 4: Discord API Complexity

If Discord API changes require coordinated updates across domains, a centralized provider absorbs that complexity in one place. Currently each domain uses a small, stable subset of the API, so this isn't pressing.

## This Is Intentional Technical Debt

Technical debt is often unintentional: shortcuts taken under pressure that accumulate interest over time. This is different. The principal is known: duplicate Discord client code across domains with no single place to understand "how we talk to Discord." The interest is also known: when Discord changes their API or we need consistent retry logic, we update multiple places; when debugging Discord issues, we check multiple services.

The payback plan is specific. Once the Discord integration proves itself and matures, consolidate API access into a thin provider. Domains keep their data and business logic but call the provider for Discord API access instead of embedding client code directly.

```
Evolution path:

Phase 1 (Current): Domain-Embedded
  - Each domain has Discord client code
  - Fast to build, easy to change independently
  - Interest: duplication across domains

Phase 2 (Future): Thin Provider + Domain Adapters
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                        Discord Provider API                              │
  │  • API client, credentials, rate limiting                               │
  │  • Domain-agnostic operations (assign role, get user, etc.)             │
  └─────────────────────────────────────────────────────────────────────────┘
                    ▲                    ▲                    ▲
                    │                    │                    │
  ┌─────────────────┴──┐  ┌──────────────┴──────────┐  ┌─────┴─────────────┐
  │ Registrar Adapter  │  │ Subscription Adapter    │  │ Auth Adapter      │
  │                    │  │                         │  │                   │
  │ Domain-specific    │  │ Domain-specific         │  │ Domain-specific   │
  │ Discord logic      │  │ Discord logic           │  │ Discord logic     │
  └────────────────────┘  └─────────────────────────┘  └───────────────────┘

  - Provider handles Discord API concerns
  - Adapters translate domain needs to provider operations
  - Data stays in domains
  - Business logic stays in domains
```

The adapter pattern preserves domain independence while centralizing infrastructure concerns. Each domain's adapter can evolve its usage of the provider without affecting others.

## Key Lessons

### Extract infrastructure; keep business logic in the domain that owns it

The choice isn't "extract everything" or "embed everything." Discord API access (infrastructure) can be extracted while Discord business logic (domain) stays embedded. The thin provider plus adapter pattern achieves this separation.

### Name your architectural priorities before the debate starts

Without explicit priorities, architectural debates become opinion battles. When cost and agility are the dominant characteristics, the domain-embedded approach follows logically; a system prioritizing consistency and maintainability would choose differently. Naming the characteristics forces the tradeoff into the open rather than leaving it implicit.

### Intentional debt needs a named payback trigger, not a vague intention

Most "technical debt" is actually just poor code quality. True technical debt is intentional, with understood interest and a clear payback plan. "We'll clean it up later" isn't a plan; intentional debt specifies what triggers evolution, what the evolved state looks like, and what interest we're paying until then.

### Share values, not code, until the team outgrows it

Coordination overhead that's negligible for a single team becomes significant with multiple teams. The right architecture depends on who's building it, not just what's being built. A single team can achieve consistent behavior by sharing values rather than code: conventions, ADRs, and code review enforce the same standards that a shared service would otherwise impose. As teams grow, shared code can evolve from those shared values rather than replacing them.

### Don't extract until patterns have stabilized across domains

The discovery here isn't where domain boundaries belong; those are established. It's how Discord fits into each domain's existing responsibilities. Each domain needs room to evolve its integration without being blocked by a shared abstraction that's also changing. Once integration patterns stabilize, centralization captures what was learned rather than defining it prematurely.
