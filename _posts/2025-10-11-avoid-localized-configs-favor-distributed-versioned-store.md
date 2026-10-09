---
layout: post
title: "Why Secrets and Environment Config Don't Belong With Your Code"
date: 2025-10-11
description: "Keeping secrets and environment-specific configuration alongside application code creates security risks and deployment coupling. A versioned, distributed config store solves these problems while introducing trade-offs worth making."
tags: [architecture, configuration-management, security, aws, devops]
author: steven-stuart
sources:
  - title: "GitGuardian: The State of Secrets Sprawl 2025"
    url: "https://blog.gitguardian.com/the-state-of-secrets-sprawl-2025/"
  - title: "GitHub Docs: Removing sensitive data from a repository"
    url: "https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository"
  - title: "AWS Systems Manager Pricing"
    url: "https://aws.amazon.com/systems-manager/pricing/"
  - title: "AWS Secrets Manager Pricing"
    url: "https://aws.amazon.com/secrets-manager/pricing/"
  - title: "Amazon ECS: Pass Systems Manager parameters as environment variables"
    url: "https://docs.aws.amazon.com/AmazonECS/latest/developerguide/secrets-envvar-ssm-paramstore.html"
  - title: "AWS Parameters and Secrets Lambda Extension"
    url: "https://docs.aws.amazon.com/systems-manager/latest/userguide/ps-integration-lambda-extensions.html"
  - title: "External Secrets Operator"
    url: "https://external-secrets.io/"
  - title: "Google SRE Book: Introduction"
    url: "https://sre.google/sre-book/introduction/"
  - title: "AWS AppConfig: About validators"
    url: "https://docs.aws.amazon.com/appconfig/latest/userguide/appconfig-creating-configuration-and-profile-validators.html"
  - title: "AWS AppConfig: Working with deployment strategies"
    url: "https://docs.aws.amazon.com/appconfig/latest/userguide/appconfig-creating-deployment-strategy.html"
  - title: "The Twelve-Factor App: III. Config"
    url: "https://12factor.net/config"
  - title: "GitHub Docs: About push protection"
    url: "https://docs.github.com/en/code-security/secret-scanning/introduction/about-push-protection"
  - title: "Managing Parameter Store throughput"
    url: "https://docs.aws.amazon.com/systems-manager/latest/userguide/parameter-store-throughput.html"
  - title: ".NET Aspire overview"
    url: "https://learn.microsoft.com/en-us/dotnet/aspire/get-started/aspire-overview"
---

When you first create that new shiny code project, your configuration requirements seem so obvious and straightforward. You think: "I have a single behavior or feature that just needs this one setting or I am just calling this one external resource which just needs this one API URL". Often, your needs are indeed simple, but simple does not translate directly to easy. And even before the future flood of settings and complex use cases arrive, that setting beside the code is already a problem. The local approach feels intuitive because config stays close to the code that uses it, but real business use cases, daily team dynamics, production deployment pipelines, and distributed architectures are just not that simple.

This localized intuition leads to predictable problems: secrets leak into Git history and persist indefinitely, environment-specific values multiply into templating systems that nobody fully understands, and configuration changes require full application redeployments. These aren't edge cases or signs of poor discipline. They follow from where the config lives. A secret in a file beside the code is one mistaken commit away from Git history, and a value shipped with the code changes only when the code ships.

## The Hidden Costs of Config-in-Code

**Secrets leak despite good intentions.** Teams start with `.gitignore` files and environment variables, but secrets find their way into version control anyway. A developer copies a working config to test something, a merge conflict gets resolved wrong, or someone commits from a branch that predates the `.gitignore` update. GitGuardian's State of Secrets Sprawl 2025 report counted 23.8 million secrets leaked in public GitHub commits in 2024, a count that covers hardcoded source as well as config files. Once a secret hits Git history, every clone and fork carries it. GitHub's own guidance on removing sensitive data says to revoke or rotate the secret first, because rewriting history can't reach copies already pulled. Rotating means tracking down every service that uses it.

**Environment parity erodes.** Each environment needs different database hosts, API endpoints, feature flags, and connection pool sizes. Teams respond with templating systems that substitute values at build time, or multiple config files with naming conventions like `config.dev.json` and `config.prod.json`, or environment variables that multiply until nobody remembers what `SERVICE_ENDPOINT_OVERRIDE_V2` was supposed to do. When values are substituted at build time, staging and production don't even run the same image. Debugging then requires understanding not just the code but the entire config transformation pipeline.

Runtime selection, like ASP.NET Core's `appsettings.{Environment}.json` with environment-variable overrides, fixes the image problem but not the tie to releases. It keeps one image, but production values still ship in every build and change only with a release. With several override layers, the running value depends on which layer applied last.

**Deployments couple to configuration.** When config lives with code, changing a timeout value means rebuilding and redeploying the application. When five services share a database connection string, each holds its own copy in its own repository. Changing it means five pull requests and five deployments, ordered so no service still uses the old credential when it's revoked.

**Configuration fragments across components instead of cohering around domains.** In a multi-tenant system, a tenant's feature flags, rate limits, and credentials end up copied into every service that handles its requests, so one change for that tenant means editing each copy.

**Config drift becomes invisible.** A value gets changed manually in production to fix an urgent issue and never makes it back to staging, or a developer updates the dev config but not the template. Over time, debugging requires archaeology rather than analysis.

## Homegrown Config Stores Recreate the Bootstrap Problem

The natural engineering instinct is to solve this problem yourself by storing configs in a database or building a config API.

Config kept in the application's own database creates a circular dependency: your service needs the database connection string to start, but the connection string is in the database. You end up hardcoding bootstrap credentials anyway, which defeats the purpose.

A custom config API sounds cleaner until you realize the config service itself needs configuration, deployment sequencing, and high availability. If the config API validates values against schemas in its own code, a new payment setting means deploying the config API first, then the payment service. You've traded one problem for a more complex one.

The fundamental issue is bootstrapping: how does the application know where to find its configuration before it has any configuration? Cloud-native config stores solve this by using identity that's already present in the runtime environment, such as IAM roles in AWS, managed identities in Azure, or service accounts in GCP. The application authenticates using credentials the platform provides automatically, which means no bootstrap secrets to manage. A homegrown store can authenticate the same way, but at that point you're rebuilding, operating, and keeping highly available what the managed store already provides.

## What External Config Stores Provide

AWS has Parameter Store and Secrets Manager, Azure has Key Vault and App Configuration, GCP has Secret Manager, and HashiCorp Vault works across all of them.

Sensitive data never touches the codebase because it never needs to. Credentials live in the config store, encrypted at rest, with access controlled through the same IAM policies that govern your other cloud resources. When someone leaves the team, you revoke their access in one place rather than hoping they don't have local copies of config files. Audit trails show who accessed what and when, which proves invaluable when security asks "who has seen the production database password in the last 90 days?"

Applications become portable because the same artifact runs everywhere. The application asks "what environment am I in?" at startup and fetches the appropriate config, eliminating templating systems and environment-specific builds.

## Organize Config Around Domains, Not Components

When configuration lives with code, it naturally organizes around components: the payment API has its config, the notification service has its config, and the reporting batch job has its config. This feels logical until you realize that configuration often cuts across components. A domain like "payments" might span three APIs, two background processors, and a gateway configuration.

With 50 APIs and 100 tenants, changing one tenant's settings starts with working out which services handle that tenant. When the payment domain gets restructured into separate authorization and settlement services, all the tenant configs need redistribution.

Domain-oriented config inverts this relationship. The same tenant configuration applies to whichever services handle that tenant's requests. When the payment domain splits, the new authorization and settlement services both read the same `/production/tenants/<tenant>/payments` path, so no tenant config moves and only their read permissions change.

The tradeoff is that shared domain keys become a contract across their consumers, so like a shared schema they evolve additively. Before changing a key, check the IAM read grants on its path, which list those consumers. Sharing a domain doesn't mean sharing every secret, though, because credentials can still sit in per-consumer sub-paths.

Component-specific configuration still exists, but only for component-specific concerns: performance tuning, networking behavior, resource limits, internal timeouts. Domain config answers "what does this tenant need?" while component config answers "how does this service behave?"

## Hierarchical Config in Practice

External config stores enable domain-oriented organization through hierarchy. AWS Parameter Store shows the pattern, and other platforms work similarly.

Parameters follow a path structure like `/production/tenants/acme-corp/feature-flags` or `/production/domains/payments/integration-credentials`. The hierarchy carries access and ownership. Developers can read `/dev/*` while `/production/*` stays restricted to deployment pipelines. A change to `/production/shared/*` reaches every service in an environment on its next refresh or restart. Domain teams own their domain's subtree while platform teams manage cross-cutting infrastructure config.

The cost is small in practice. According to AWS Systems Manager's pricing page, standard-tier Parameter Store parameters (up to 10,000 per account and region) carry no storage charge and no API charge at default throughput. Secrets Manager costs more, at $0.40 per secret per month plus API calls, so a few hundred secrets run about $100 a month.

Integration with compute services removes friction. ECS task definitions can reference parameters directly, and the platform injects the values at startup. Lambda functions can read them through AWS's Parameters and Secrets Lambda Extension. Kubernetes pods can receive them as native secrets through the External Secrets Operator.

## Config Changes Get Heavier, and They Should

A distributed config store removes the friction that adds nothing, like rebuilding artifacts and redeploying every consumer of a shared value. It keeps the friction that protects production. Configuration updates feel heavier because they are heavier, more like database migrations than editing a text file. You'll write change requests, get approvals, coordinate timing with deployments, and verify rollback procedures work.

Configuration changes in production systems *should* be intentional and controlled because a misconfigured timeout can cascade into an outage and a wrong feature flag can expose unfinished functionality to customers. Google's SRE book reports that roughly 70% of outages are due to changes in a live system, and a config change is exactly that kind of change. The ceremony forces you to think about backwards compatibility (will existing instances handle this new format?), rollback procedures (how do we revert if this breaks something?), and dependency ordering (which services need to restart first?).

Backwards compatibility matters more than it did, because config and code now roll back independently. A new key has to be additive, and the code has to tolerate its absence. It's the same expand-then-contract discipline a schema migration uses.

Approval alone isn't enough, because a change to `/production/shared/*` reaches every service. Changes with that blast radius should roll out in stages the way code does. AWS AppConfig, for example, first checks a change with validators against a JSON schema or a Lambda function. Its deployment strategies then release the change to a growing percentage of targets over a bake time and roll it back automatically when a CloudWatch alarm fires.

The one exception is the kill switch, because an incident can't wait for a change request. One can live under its own path, writable by on-call through a narrow IAM role.

## What Still Belongs in Local Config

The goal isn't to externalize *everything* since that would create unnecessary dependencies and slow down development.

**Application defaults** like log formats, default retry counts, or internal timeout values that don't change between environments MIGHT belong in code. These define how the application behaves, not how it connects to external systems. I would still hesitate before coupling these to your code, however, because a constant default can become the value someone must change during an incident.

**Framework configuration** for HTTP server settings, thread pool sizes, or middleware ordering rarely varies by environment. When it does, you can override specific values from the external store while keeping sensible defaults local.

**Development shortcuts** that let engineers run the application locally without network dependencies make sense for rapid iteration. The key is ensuring the code path to fetch external config exists and works.

The decision rule is straightforward:

- **Externalize it** if it's sensitive, varies by environment, or is shared across services.
- **Keep it local** if it describes internal application behavior that stays constant everywhere.

This rule sits close to the line The Twelve-Factor App draws, where config is "everything that is likely to vary between deploys" and internal config that doesn't vary "is best done in the code." The difference is where the values come from. Environment variables can stay the interface, as when ECS injects parameters into them. But a flat set of variables managed per deployment has no hierarchy to assign ownership by path and no version history, so a versioned store makes the better source.

For prototypes and throwaway code, do whatever gets you moving fastest, but establish the external config discipline before real users or sensitive data enter the picture.

## Where a Store Beats a Config Repository

An external store versions the values themselves, per environment, and its audit trail records who changed each one.

A separate config repository is the other way to keep config out of the code, and it versions config too. A GitOps pipeline injects it at deploy time as mounted files or a ConfigMap. That also keeps one image, and it adds reviewed diffs and atomic multi-key commits. For non-secret values that one service owns and changes only on release, it is a sound home. The store wins where the repository can't follow:

- **Secrets**, where even encrypted-in-repo tools like SOPS leave old ciphertext in history for anyone who once held the key, while the store audits every read and rotates without a commit
- **Shared values**, where one write replaces a config deploy to every consumer
- **Incident-time changes** like a kill switch, which can't wait for a deploy
- **Per-path permissions**, where a repository exposes everything in it to anyone who can read it

Versioning in the store also changes rollback. Parameter Store versions each parameter separately, so you roll back one value at a time. When several values must revert together, AWS AppConfig versions them as one configuration profile. Bad deploy? Roll back the config without touching application code. Services that poll for changes pick up the old value within their refresh interval, and services that read config at startup need a restart, not a rebuild and redeploy.

A writable store moves drift risk rather than removing it. The drift described earlier becomes detectable, because parallel paths like `/staging/...` and `/production/...` can be compared for missing or extra keys. It becomes preventable once write access to `/production/*` is limited to the deployment pipeline. Where a path must stay writable, like the kill switch, drift becomes attributable, because every write lands in the audit trail with the caller's identity.

## Preventing Configs from Creeping Back into Code

Moving to external config stores doesn't automatically stop developers from committing secrets. Without active governance, you'll find credentials in code reviews months after "completing" the migration.

**Code review culture** matters more than tooling once the store exists. With no config file left for a secret to slip into, what remains takes judgment. Team values over process! Scanners catch values that look like secrets, while a reviewer catches the hardcoded endpoint or tenant flag no pattern recognizes. After the migration the rule is simple: any credential or environment-specific value in the repository is wrong. Make it part of your definition of done: "configuration fetched from external store, no hardcoded environment-specific values."

**Pre-commit hooks** can run secret scanners that check each commit for patterns that look like secrets, including API keys, connection strings, and private keys. Teams should be able to govern themselves, but for high risk products this might be needed.

**Repository templates** ensure new projects start with proper `.gitignore` files excluding `.env`, `config.local.*`, and `secrets.*`.

**CI/CD validation** catches anything that slips past local checks. Pipelines can scan for hardcoded values, verify that config references resolve to external stores, and fail builds that contain suspicious patterns. GitHub's push protection goes further, rejecting a recognized secret before it reaches the remote.

## Practical Concerns and How to Handle Them

**"What happens when the config store is unavailable?"** A managed config store is still a dependency, and the more likely problem is throttling, not an outage. AWS documents Parameter Store's default throughput as 40 reads per second shared across an account and region, so a fleet scaling out or an ECS deployment replacing many tasks at once can hit `ThrottlingException` at startup. Cache config after the first fetch, spread reads across startup, enable the paid higher-throughput setting when the fleet needs it, and serve stale cached values during brief outages.

A new instance has no cache, though, so a throttle or outage during scale-out blocks exactly the instances you need. A local fallback copy could cover that gap, but a copy holding secrets must be encrypted, and getting its key to the instance is the bootstrap problem again. So most services should accept the startup dependency and size throughput for scale-out.

**"Startup is slower now."** True. Each fetch is a network round trip, usually small next to connection pool and dependency injection setup. Fetch at startup and cache with a refresh interval rather than forever, so a rotated credential still reaches running services.

**"Local development gets harder."** It gets *different*, not harder. SDKs and credential chains make fetching config from external stores transparent once each developer (and CI) has a scoped cloud role. The default is reading from a dev path, with each developer's writes confined to a personal sub-path. Local overrides are the shortcut for offline or isolated work. The one-time setup pays for itself in fewer "works locally, fails in production" bugs.

**"We can't work offline."** How often do you actually develop offline? Pulling dependencies, accessing Jira, talking to teammates, running CI/CD, and pushing code all require connectivity. When it does matter, keep a local-only setup that needs no store, such as a .NET Aspire app host that defines local resources and configuration in source control.

## The Daily Experience Changes

Testing becomes more realistic because engineers can run local code against the non-secret values in remote staging or dev configs, with read access scoped to those paths, rather than maintaining local approximations that drift from reality.

Committed config files stop being a path for leaked credentials, and when developers never get read access to `/production`, production secrets stop passing through people at all. When you need to rotate a credential, you update one place. With a dual-credential scheme like Secrets Manager's alternating-users rotation, the old credential stays valid while every service picks up the new one on its next fetch or restart. The question "did we rotate that key in all environments?" finally has a definitive answer.

## Making the Shift

Local config files feel simple and convenient right up until they aren't. External config stores trade familiar convenience for operational discipline, and that trade-off is sound.

Start with secrets by moving credentials out of the codebase and into a config store. Once that discipline is established, expand to environment-specific values, and eventually the pattern becomes natural: config comes from the environment, not from files.
