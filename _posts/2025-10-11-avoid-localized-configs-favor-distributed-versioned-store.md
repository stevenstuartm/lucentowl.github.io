---
layout: post
title: "Why Configuration Files Don't Belong With Your Code"
date: 2025-10-11
description: "Storing configuration files alongside application code creates security risks and deployment complexity. Distributed config stores solve these problems while introducing new trade-offs worth making."
tags: [architecture, configuration-management, security, aws, devops]
---

When you first create that new shiny code project, your configuration requirements seem so obvious and straightforward. You think: "I have a single behavior or feature that just needs this one setting or I am just calling this one external resource which just needs this one api url". Often, your needs are indeed simple, but simple does not translate directly to easy. Yet, even before the future flood of settings and complex use cases arrive, you have already created a problem. The local approach feels intuitive because config stays close to the code that uses it, but real business use cases, daily team dynamics, production deployment pipelines, and distributed architectures are just not that simple.

This localized intuition leads to predictable problems: secrets leak into Git history and persist indefinitely, environment-specific values multiply into templating systems that nobody fully understands, and configuration changes require full application redeployments. These aren't edge cases or signs of poor discipline; they're structural consequences of coupling configuration to code.

## The Hidden Costs of Config-in-Code

When configuration lives alongside application code, the problems compound in ways that aren't obvious until you're deep into them.

**Secrets inevitably leak.** Teams start with good intentions like `.gitignore` files, environment variables, and careful code reviews, but secrets find their way into version control anyway. A developer copies a working config to test something, a merge conflict gets resolved wrong, or someone commits from a branch that predates the `.gitignore` update. Once a secret hits Git history, it's there forever unless you rewrite history (which breaks everyone's local repos) or rotate the credential (which means tracking down every service that uses it).

**Environment parity becomes impossible.** Each environment needs different database hosts, API endpoints, feature flags, and connection pool sizes. Teams respond with templating systems that substitute values at build time, or multiple config files with naming conventions like `config.dev.json` and `config.prod.json`, or environment variables that multiply until nobody remembers what `SERVICE_ENDPOINT_OVERRIDE_V2` was supposed to do. The same Docker image behaves differently in staging and production, and debugging requires understanding not just the code but the entire config transformation pipeline.

**Deployments couple to configuration.** When config lives with code, changing a timeout value means rebuilding and redeploying the application. When five services share a database connection string and it needs to change, coordinating five deployments in sequence becomes necessary. Incident response now requires understanding deployment ordering, not just the config change itself.

**Configuration fragments across components instead of cohering around domains.** When each service owns its config files, configuration naturally organizes around components rather than business concepts. A tenant's feature flags, rate limits, and integration credentials get scattered across every service that handles that tenant's requests. With 50 APIs and 100 tenants, ops teams face an impossible task: understanding which services handle which tenants, how configuration flows through the architecture, and where to make changes when requirements shift. When the payment domain gets restructured into separate services, tenant configs need redistribution across the new architecture. Internal implementation details leak into operational concerns, and ops personnel are forced to understand component boundaries they shouldn't need to know about.

**Config drift becomes invisible.** Without a central view of configuration, environments gradually diverge in ways nobody fully understands. A value gets changed manually in production to fix an urgent issue and never makes it back to staging. A developer updates the dev config but forgets to propagate it to the template. Over time, the gap between what's documented and what's deployed grows until debugging requires archaeology rather than analysis.

## I need a Custom Solution then, Right?

The natural engineering instinct is to solve this problem yourself by storing configs in a database, building a config API, or using Redis as a config cache. These approaches fail for reasons that become obvious only after you've tried them.

A database-backed config store creates a circular dependency: your service needs the database connection string to start, but the connection string is in the database. You end up hardcoding bootstrap credentials anyway, which defeats the purpose. Every service that needs config now depends on the database being available, and rotating database credentials becomes a chicken-and-egg problem.

A custom config API sounds cleaner until you realize the config service itself needs configuration, deployment sequencing, and high availability. When the payment service needs a new config value, you deploy the config API first, then the payment service. If the config API is down during a scaling event, new instances can't start. You've traded one problem for a more complex one.

The fundamental issue is bootstrapping: how does the application know where to find its configuration before it has any configuration? Cloud-native config stores solve this by using identity that's already present in the runtime environment, such as IAM roles in AWS, managed identities in Azure, or service accounts in GCP. The application authenticates using credentials the platform provides automatically, which means no bootstrap secrets to manage.

## What External Config Stores Provide

Every major cloud platform offers configuration stores. AWS has Parameter Store and Secrets Manager, Azure has Key Vault and App Configuration, GCP has Secret Manager, and HashiCorp Vault works across all of them. The specific product matters less than the pattern they all share.

Sensitive data never touches the codebase because it never needs to. Credentials live in the config store, encrypted at rest, with access controlled through the same IAM policies that govern your other cloud resources. When someone leaves the team, you revoke their access in one place rather than hoping they don't have local copies of config files. Audit trails show exactly who accessed what and when, which proves invaluable when security asks "who has seen the production database password in the last 90 days?"

Applications become genuinely portable because the same artifact runs everywhere. A Docker image built once deploys to dev, staging, and production without modification. The application asks "what environment am I in?" at startup and fetches the appropriate config, eliminating templating systems, environment-specific builds, and "works on my machine" debugging sessions caused by config drift.

## Domain-Oriented Configuration

One of the strongest arguments for external config stores is organizational: configuration should reflect business domains, not component architecture.

When configuration lives with code, it naturally organizes around components: the payment API has its config, the notification service has its config, and the reporting batch job has its config. This feels logical until you realize that configuration often cuts across components. A tenant's feature flags, rate limits, and integration credentials apply to multiple services. A domain like "payments" might span three APIs, two background processors, and a gateway configuration.

Component-oriented config creates problems at scale. With 50 APIs and 100 tenants, ops teams need to understand which services handle which tenants, how configuration flows through the architecture, and where to make changes when business requirements shift. When the payment domain gets restructured into separate authorization and settlement services, all the tenant configs need redistribution. The internal architecture leaks into operational concerns.

Domain-oriented config inverts this relationship. Configuration organizes around business concepts like tenants, products, or integration partners rather than implementation details. The same tenant configuration applies to whichever services handle that tenant's requests. When architecture changes, the domain config stays stable while service-level mappings adjust. Ops personnel work with business concepts they understand rather than implementation details they shouldn't need to know.

Component-specific configuration still exists, but only for genuinely component-specific concerns: performance tuning, networking behavior, resource limits, internal timeouts. These are implementation details that don't belong in domain configuration. Domain config answers "what does this tenant need?" while component config answers "how does this service behave?"

## Hierarchical Config in Practice

External config stores enable domain-oriented organization through hierarchy. Consider how AWS Parameter Store structures configuration (the pattern applies to other platforms).

Parameters follow a path structure like `/production/tenants/acme-corp/feature-flags` or `/production/domains/payments/integration-credentials`. This hierarchy enables powerful access patterns: granting developers read access to `/dev/*` while restricting `/production/*` to deployment pipelines, updating all services in an environment by changing `/production/shared/*`, and giving domain teams ownership of their domain's config subtree while platform teams manage cross-cutting infrastructure config.

The cost concern that often comes up is a non-issue in practice. AWS Parameter Store's standard tier provides 10,000 free parameters with no throughput charges. Azure Key Vault and GCP Secret Manager have similar pricing models. A single security incident from leaked credentials costs more than decades of config storage fees.

Native integration with compute services removes friction. ECS tasks, Lambda functions, and Kubernetes pods can reference parameters directly in their definitions. The platform handles fetching and injecting values at startup. For services that need to refresh config without restarting, SDKs provide straightforward polling or event-driven updates.

## The Trade-offs

Moving to a distributed config store trades one form of complexity for another. Configuration updates feel heavier because they are heavier, more like database migrations than editing a text file. You'll write change requests, get approvals, coordinate timing with deployments, and verify rollback procedures work.

This friction is the point, not a bug. Configuration changes in production systems *should* be intentional and controlled because a misconfigured timeout can cascade into an outage and a wrong feature flag can expose unfinished functionality to customers. The ceremony forces you to think about backwards compatibility (will existing instances handle this new format?), rollback procedures (how do we revert if this breaks something?), and dependency ordering (which services need to restart first?).

What feels like bureaucracy is actually the appropriate amount of care for changes that can bring down production systems. Config changes deserve deliberate thought rather than a quick file edit.

## Do We Always Avoid Local Configs?

The goal isn't to externalize *everything* since that would create unnecessary dependencies and slow down development. Some configuration genuinely belongs with the code.

**Application defaults** like log formats, default retry counts, or internal timeout values that don't change between environments MIGHT belong in code. These define how the application behaves, not how it connects to external systems. I would still hesitate before coupling these to your code however.

**Framework configuration** for HTTP server settings, thread pool sizes, or middleware ordering rarely varies by environment. When it does, you can override specific values from the external store while keeping sensible defaults local.

**Development shortcuts** that let engineers run the application locally without network dependencies make sense for rapid iteration. The key is ensuring the code path to fetch external config exists and works; you're just bypassing it locally for convenience.

The decision rule is straightforward: if configuration is sensitive, environment-specific, or shared across services, externalize it. If it's about internal application behavior that stays constant everywhere, keep it local. For prototypes and throwaway code, do whatever gets you moving fastest, but establish the external config discipline before real users or sensitive data enter the picture.

## Preventing Configs from Creeping Back into Code

Moving to external config stores doesn't automatically stop developers from committing secrets. Without active governance, you'll find credentials in code reviews months after "completing" the migration.

**Code review culture** matters more than tooling. Values over process! When reviewers consistently flag hardcoded configs, the team internalizes the discipline. Make it part of your definition of done: "configuration fetched from external store, no hardcoded environment-specific values."

**Pre-commit hooks** using tools to scan commits for patterns that look like secrets, including API keys, connection strings, and private keys. A developer who accidentally pastes a credential gets immediate feedback rather than finding out during a security audit. Teams should be able to govern themselves, but for high risk products this might be needed.

**Repository templates** ensure new projects start with proper `.gitignore` files excluding `.env`, `config.local.*`, and `secrets.*`. When developers create repos from templates, protection comes built-in rather than requiring someone to remember to add it.

**CI/CD validation** catches anything that slips past local checks. Pipelines can scan for hardcoded values, verify that config references resolve to external stores, and fail builds that contain suspicious patterns. This is your safety net when pre-commit hooks get bypassed.

## Practical Concerns and How to Handle Them

The concerns that come up when teams consider this migration are legitimate, even if the solutions are straightforward.

**"What happens when the config store is unavailable?"** In practice, cloud config stores have better uptime than the applications that depend on them. If AWS Parameter Store or Azure Key Vault is down, you likely have bigger problems since the entire region is probably degraded. For transient issues, cache config after the first fetch and use circuit breakers to serve stale values during brief outages. The dependency you're adding is on infrastructure that's more reliable than almost anything you'd build yourself.

**"Startup is slower now."** True. Fetching config over the network adds latency compared to reading a local file. For most applications, we're talking about tens to hundreds of milliseconds during startup, which is imperceptible to users and irrelevant compared to database connection pool initialization, dependency injection setup, and cache warming. Cache aggressively and fetch once; the performance concern disappears.

**"Local development gets harder."** It gets *different*, not harder. Modern SDKs and credential chains make fetching config from external stores transparent once you've set up local credentials. Many teams use local overrides for convenience while ensuring the external fetch code path stays exercised. The initial setup takes an afternoon; the debugging time saved from "works locally, fails in production" issues pays that back quickly.

**"We can't work offline."** How often do you actually develop offline? Installing packages requires connectivity. So does pulling dependencies, accessing Jira, communicating with teammates, running CI/CD, and pushing code. The offline development scenario is increasingly rare. Yet, using local development solutions like .NET Aspire can provide local git controlled registries and configuration meant only for pure local connectivity.

## Version Control for Configuration

Config changes need the same versioning discipline as code changes, and external config stores make this possible in ways that local files don't.

When config lives in files, version history shows what changed but not why. When config lives in an external store with change management, each update can include context: who approved it, what ticket it relates to, what the rollback plan is. Some teams adopt GitOps patterns where config *references* live in Git (pointing to external store paths) while actual values stay external. This approach gives you code review for config changes without putting secrets in repositories.

Rollback becomes straightforward when the config store maintains version history. Bad deploy? Roll back the config to the previous version without touching application code. This separation lets you fix config problems in seconds rather than the minutes-to-hours a full redeploy requires.

Config drift becomes detectable. Environments gradually diverge in ways nobody fully understands, and external config stores let you see exactly what's different between staging and production. No more "that value got changed manually and nobody remembers why."

## The Daily Experience Changes

The shift to external config stores changes how teams work in ways that compound over time.

Testing becomes more realistic because senior engineers can run local code against remote staging or remote dev configs (with appropriate permissions) rather than maintaining local approximations that drift from reality. When something works locally and fails in staging, config drift is rarely the culprit.

Security incidents from leaked credentials drop dramatically because secrets stop appearing in Git history and credential sharing over Slack stops since there's no file to share; permissions grant access directly. When you need to rotate a credential, you update one place and know it propagates everywhere, so the question "did we rotate that key in all environments?" finally has a definitive answer.

Deployments simplify because the same artifact works everywhere. Build pipelines no longer template config files or maintain environment-specific variations, so you build once, deploy many times, and config comes from the environment at runtime with faster deployments and fewer things that can go wrong.

## Making the Shift

Local config files feel simple and convenient right up until they aren't. The pattern creates security risks that compound over time, deployment complexity that frustrates teams, and environment drift that causes mysterious production-only failures. External config stores trade familiar convenience for operational discipline, and that trade-off is sound.

The friction of external config management isn't overhead; it's the appropriate level of care for changes that can bring down production systems. Configuration errors cause outages as often as code bugs, and they deserve the same rigor: version control, change management, audit trails, and rollback procedures.

Start with secrets by moving credentials out of the codebase and into a config store. Once that discipline is established, expand to environment-specific values, and eventually the pattern becomes natural: config comes from the environment, not from files.
