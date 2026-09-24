---
title: "Deployment Strategies"
layout: guide
category: Infrastructure & Cloud
subcategory: Cloud Operations
description: "How to release a new version with little or no downtime and a controlled blast radius: recreate, rolling, blue-green, and canary deployments, feature flags that separate deploying from releasing, A/B tests as experiments rather than rollouts, and what every strategy needs from the application and its data."
tags: [practical, rolling-deployment, blue-green, canary, feature-flags, progressive-delivery]
---

## What a Deployment Strategy Decides

Every release moves users from an old version to a new one. A deployment strategy decides how that move happens, and each one answers four questions differently:

- **How many users meet the new version at once?** That is the *blast radius* if the release is bad.
- **Do the old and new versions run side by side?** If they do, they have to work together.
- **How fast can the release be undone?**
- **How much extra capacity does the release need while it runs?**

The simplest strategy, **recreate**, stops every instance of the old version and then starts the new one. It needs no extra capacity and never runs two versions at once, but users get errors in the gap between. It suits internal tools that can accept a maintenance window, and applications that cannot run two versions at the same time, such as a service that holds an exclusive lock on a resource. Kubernetes offers it as the `Recreate` strategy. Every other strategy exists to close that gap and to limit how many users a bad release reaches.

The strategies differ most visibly in how traffic reaches the new version over time:

{% include figure.html id="infra-deploy-traffic-shift" %}

---

## Rolling Deployments

A **rolling deployment** replaces instances in batches. New instances start, pass their health checks, and join the load balancer, old ones are drained and stopped, and the cycle repeats until every instance runs the new version. It is the default for Kubernetes Deployments, where `maxSurge` sets how many extra pods may run above the desired count and `maxUnavailable` sets how many may be missing, both 25% by default. With those defaults, up to a quarter of the capacity can be missing at any moment. Setting `maxUnavailable` to zero keeps full capacity throughout, at the cost of running the surge instances while the release runs.

A rolling deployment needs no second environment, which makes it the cheapest way to avoid downtime. It has three costs:

- **Two versions serve at once.** For the length of the rollout, some requests reach the old version and some the new, so the two must agree on API contracts, message formats, and database schema. A user can also see new behavior on one request and old behavior on the next.
- **The blast radius grows automatically with each batch.** Each batch exposes more users, and a bug that health checks don't catch spreads to every instance. Kubernetes reports a rollout that stops making progress, but it does not roll back on its own.
- **Rollback is another rollout.** Going back means rolling the old version out again, batch by batch.

---

## Blue-Green Deployments

A **blue-green deployment** runs two complete production environments. *Blue* serves live traffic while the new version is deployed to *green*, which receives no users. Once green passes its checks, often including test requests routed to it through a separate listener or header, the router switches all traffic to it. Blue stays running, untouched, so a rollback is the same switch in reverse.

The switch is what gives blue-green its speed, and how it happens matters. A load balancer that moves traffic between two groups of instances switches in seconds and can let requests already in flight finish on blue. A switch made by changing DNS is slower and less predictable, because clients and resolvers keep using the old address until their cached record expires. Zero downtime is achievable, but it depends on draining in-flight requests and on how the traffic moves.

After the switch, blue is usually kept for a *bake time*, a period during which green is watched under full load and switching back stays instant. Platforms can also switch back on their own: Amazon ECS rolls back when a chosen CloudWatch alarm fires during the release, and the same alarm-driven rollback applies to its rolling and canary deployments.

Blue-green has three costs:

- **Capacity.** Two full environments run during the release. In the cloud, green can be created for the release and removed afterwards, but it still has to match blue's size at the moment of the switch.
- **Everyone switches at once.** A problem that green's checks missed reaches every user together.
- **Shared data limits the rollback.** Both environments usually share one database. If green changed the schema or wrote data blue cannot read, switching back does not restore the old state.

Most platforms support it directly. [Amazon ECS](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-type-blue-green.html){:target="_blank" rel="noopener noreferrer"} gained built-in blue-green deployments in 2025, alongside the older route through AWS CodeDeploy. [Azure App Service deployment slots](https://learn.microsoft.com/en-us/azure/app-service/deploy-staging-slots){:target="_blank" rel="noopener noreferrer"} do the same with a slot swap, and on Kubernetes, [Argo Rollouts](https://argoproj.github.io/argo-rollouts/){:target="_blank" rel="noopener noreferrer"} manages both environments.

---

## Canary Releases

A **canary release** sends a small share of traffic to the new version, watches it, and widens the share in steps: 5%, then 25%, then 50%, then everyone, with a pause at each step. If the new version's error rate or latency gets worse than the old version's, the release stops and traffic goes back. Danilo Sato's description of the technique on Martin Fowler's site frames its purpose as detecting problems, with a rollout that completes in minutes to hours. A **linear** release is the same idea with equal steps on a timer, such as 10% every five minutes.

A canary release needs two things the other strategies don't:

- **Weighted traffic splitting.** A load balancer with weighted target groups, a service mesh, or the platform's own support routes a percentage of requests to the new version. Amazon ECS added built-in canary and linear strategies in 2025, its canary moving in a single step from the canary share to everyone, and Argo Rollouts and [Flagger](https://flagger.app/){:target="_blank" rel="noopener noreferrer"} do the same on Kubernetes.
- **A comparison to decide each step.** Someone, or something, has to judge whether the canary is healthy. Automated canary analysis compares the canary's metrics with the stable version's and promotes it, moving to the next step or to full release, or rolls it back, without waiting for a person. Argo Rollouts and Flagger both query metrics providers to do this.

Canary releases have limits. A service with little traffic may not send enough requests to a 5% canary to show a problem quickly, so its steps need to be larger or longer. Work that doesn't arrive as requests, such as queue consumers, batch jobs, and long-lived connections like WebSockets, doesn't split cleanly by percentage either. And the extra capacity depends on the platform. Argo Rollouts scales the canary to its share of traffic, while Amazon ECS's built-in canary starts a full copy of the new version beside the old one.

Canary traffic is usually a random share of requests. Some teams send internal users first, or roll out one region at a time, or one *cell*, an independent copy of the stack serving part of the users. Choosing exactly which users see a change is what feature flags do.

A variation sends no users at all. **Traffic mirroring** copies live requests to the new version and discards its responses, so it faces production load before anyone depends on it. Argo Rollouts and Flagger both support it. It suits read-only requests. A mirrored request that writes data or calls another service repeats that side effect.

---

## Feature Flags: Deploying Without Releasing

Every strategy above ties two events together: the moment code is deployed and the moment users see it. A **feature flag** separates them. New code ships switched off, and the flag turns it on later, for everyone or for a chosen group, without another deployment. Turning the flag off again is usually the fastest rollback, because nothing has to be redeployed, though the change still takes as long to reach every instance as the flag service's caching allows.

Pete Hodgson's catalog of feature toggles, published on Martin Fowler's site, separates them by how long they live and how often the on or off decision changes:

| Kind | Purpose | Lifetime |
|---|---|---|
| **Release toggle** | Ship unfinished or risky work switched off, then turn it on | A week or two, then removed |
| **Experiment toggle** | Split users between variants for an A/B test | The length of the experiment |
| **Ops toggle** | Let operators turn off an expensive or failing feature under load | Usually short, though some stay as long-lived kill switches |
| **Permissioning toggle** | Enable features for particular users, such as a premium tier | Often years |

Flags have a cost. Every flag doubles the paths through the code it guards, and release toggles that are never removed pile up as dead branches nobody dares delete. Teams that use flags heavily track each release toggle and remove it once its feature is fully on. Flag services such as [AWS AppConfig](https://docs.aws.amazon.com/appconfig/latest/userguide/what-is-appconfig.html){:target="_blank" rel="noopener noreferrer"}, [Azure App Configuration](https://learn.microsoft.com/en-us/azure/azure-app-configuration/concept-feature-management){:target="_blank" rel="noopener noreferrer"}, and [LaunchDarkly](https://launchdarkly.com/){:target="_blank" rel="noopener noreferrer"} hold the flag state outside the code. [OpenFeature](https://openfeature.dev/){:target="_blank" rel="noopener noreferrer"} is a vendor-neutral API for reading flags, with a provider for each service that plugs into it.

---

## A/B Tests Are Experiments, Not Rollouts

An **A/B test** splits users between two variants to measure which performs better on a business metric, such as conversion rate or time on page. It looks like a canary release, since both send part of the traffic to something new, but the purpose is different. A canary asks whether the new version is broken. An A/B test asks whether variant B is better than A, and answering that needs a planned sample size, a stable split, and usually days or weeks to reach statistical significance.

A/B tests are usually built with experiment flags inside one deployed version, not with two deployments, so each user sees one variant consistently. Sato's article warns against running both through the same mechanism: a canary monitored on business metrics to catch regressions would muddy an experiment measured on those same metrics.

---

## What Every Strategy Needs

Only recreate avoids running two versions at once, since even blue-green overlaps them briefly at the switch. Everything else depends on the application being ready for it:

- **Backward-compatible changes.** For the length of a rolling or canary release, and after a blue-green rollback, old and new versions share the same database and message queues. A schema change that breaks the old version turns a safe rollout into an outage. The usual answer is to split a breaking change into steps: add the new structure, move to it, and remove the old one only in a later release.
- **Health checks that mean something.** A strategy moves on when an instance reports healthy. A check that only confirms the process is running lets a broken version through, while one that tests real dependencies too aggressively can fail every instance at once when a shared dependency blips.
- **Observability to decide.** Error rates and latency, split by version, are what show a canary is failing or confirm a blue-green switch went well.
- **An honest view of rollback.** Code rolls back, but data does not. Anything the new version wrote, deleted, or migrated stays that way after traffic returns to the old one.

---

## Choosing a Strategy

| Strategy | Downtime | Extra capacity | Two versions at once | Blast radius | Rollback |
|---|---|---|---|---|---|
| **Recreate** | Yes, during the switch | None | No | Everyone | Redeploy the old version, with more downtime |
| **Rolling** | None, with surge capacity | A small surge | Yes, during the rollout | Grows batch by batch | Roll the old version out again |
| **Blue-green** | None when requests drain and the switch is at the load balancer | A full second environment during the release | Briefly at the switch, and both share the database throughout | Everyone, at the switch | Switch back, fast, if the data allows it |
| **Canary** | None | From the canary instances up to a full second copy, depending on the platform | Yes, during the release | A chosen share, widened in steps | Send traffic back to the stable version |

Feature flags combine with any row. Many teams use a rolling or canary deployment to ship code safely, and feature flags to decide when users see what it does.
