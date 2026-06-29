---
layout: case-study
title: "When Someone Else's Problem Becomes Your Solution"
subtitle: "Two years of Kubernetes operational pain, self-blame, and a three-day migration to ECS that should have happened sooner"
description: "A small team adopted Kubernetes without evaluating fit, spent two years blaming themselves for the operational overhead, and eventually migrated to ECS Fargate in three days. This case study covers the full journey: the breaking changes, the denial, and the moment the team realized they had adopted someone else's problem."
role: "System Architect"
date: 2024-12-01
headline_metric: "20% More Value Delivered"
headline_detail: "3-day migration, zero outages since"
category: "success"
category_label: "Migration Win"
technologies:
  - Kubernetes
  - AWS EKS
  - AWS ECS Fargate
  - CloudFormation
  - Docker
---

## The Situation

Three years ago, I adopted Kubernetes for a project running about 20 containers on AWS. I didn't evaluate whether it fit the problem. Well, I thought I did, but I never stopped to reconsider once the team was invested.

The hosting fees were the most visible symptom. Six EKS control planes across three clusters came to $438/month just for the management layer, more than the actual compute they managed. But the real cost never appeared on an invoice: four hours per week of architect time on resource tuning, full weeks lost to upgrade cycles, customer-facing services vanishing during scaling events, and the steady drain of features that didn't ship because IT leadership was consumed by infrastructure operations.

## When the Doubt Started

The first real crack appeared during a Kubernetes minor version upgrade. Again, a minor version upgrade. The new version introduced breaking changes with the standard agents that EKS had previously installed on our clusters. Some of those agents were installed automatically by EKS; others we had installed manually. The result was an inconsistent management surface where AWS controlled some components and we controlled others, and the version upgrade put them at odds.

The fix wasn't a patch; it required rebuilding entire clusters from scratch, for every cluster we ran.

I could assign blame three ways: Kubernetes itself, AWS EKS's abstraction layer, and our own gaps in understanding. But that realization was itself the point. If running a container orchestration platform requires deep expertise in both the orchestration layer and the cloud provider's specific abstraction of it, the solution is not sustainable for a team our size.

Compare this to virtually any other cloud service: you set it up once and walk away. Upgrades are usually automatic, and when they're not, they're simple and predictable. A container orchestration solution should not behave like a JavaScript project with a hundred npm packages, where every version bump creates cascading compatibility issues across layers you don't fully control.

## The Operational Tax

### Scaling That Caused Outages

Kubernetes scaling signals never properly integrated with the cloud-native infrastructure underneath EKS. The speed of K8s scaling decisions was lost in translation to the underlying AWS layer, and during node scale-up and scale-down events, K8s would initiate changes without respecting Pod Disruption Budgets. At least N replicas of a service were supposed to stay running; in practice, they didn't.

Critical customer-facing processes would simply vanish. Not degrade. Vanish.

Before anyone asks: yes, we tuned the health checks, scale-down delays, and scale-up delays to match each container's startup and readiness characteristics. That's a common source of scaling issues and we got it right. It didn't matter. The disruption budgets were still not enforced during node-level scaling events. A platform that occasionally kills the services it's supposed to protect has a fundamental reliability problem regardless of how often it happens.

The workaround was to increase the minimum number of replicas per service, which defeats the entire purpose of auto-scaling. I never found a real fix. [EKS requires significantly more operational overhead](https://www.fairwinds.com/blog/strengths-and-weaknesses-of-aks-eks-and-gke){:target="_blank" rel="noopener noreferrer"} than GKE or AKS, with less pre-configured automation and more manual configuration for exactly these integration points.

### The Time Tax

About four hours per week went to resource allocation tuning: constant small adjustments to CPU and memory allocations per service and per node group. Load testing beforehand was never enough to define optimal defaults; it took weeks of production issues and incremental tweaking to dial in each container.

Each K8s upgrade consumed a full week of sustained research and testing. There was no budget to spin up a parallel environment, so the dev environment served double duty, blocking the rest of the team during upgrade cycles. And again, this was a "managed" EKS solution.

The third cost was version monitoring. Staying current on upcoming K8s changes was mandatory because falling behind meant the cloud provider would charge additional fees for running unsupported releases. Of course, I track upcoming changes for all AWS tools we use, but the difference is that other tools do not pull the rug from under me and run me over with a bus loaded with documents telling me the pain is all in my head.

## Why It Took So Long

Two things delayed the migration even after the doubt set in.

First, feature priorities. Certain capabilities had to ship before we could absorb the risk of a migration; the business couldn't wait while we rearchitected infrastructure.

Second, and more honestly, denial. Kubernetes was everywhere: conference talks, blog posts, hiring trends, job descriptions. It felt safer to go with the crowd than to question whether the tool fit our context. Admitting that K8s was wrong felt like admitting incompetence rather than recognizing a mismatch. To a degree, I suppose you might call this resume-driven development. We wanted to learn what others knew, nevermind that most of us share the same ignorance.

## The Migration

After wasting yet another full week trying to push through a K8s upgrade, the team just wanted to be done. The conversation with leadership was straightforward: operational cost and opportunity cost, more money saved and more features delivered. Every layer of the company had felt the pain by proxy, watching IT leadership consumed by infrastructure operations instead of strategic work.

The migration to AWS ECS Fargate took three days. We moved one service at a time, standing it up on ECS and verifying stability before touching the next. Each K8s service stayed running until its ECS counterpart was confirmed healthy. The cutover was simple AWS plumbing: DNS A records pointing to new ALBs, each ALB routing to ECS target groups. We stood up separate ALBs for each cluster boundary (public services, private services, and workers) so each group could be migrated and validated independently.

Task definitions replaced Kubernetes manifests, AWS networking replaced custom overlays, and the application code didn't change at all.

The one friction point was ECS task definitions. There's no separation between pod configuration and container image configuration the way K8s has it; everything is collapsed into the task definition. Getting this to work well in CI/CD took some rework, but it was manageable.

CloudFormation stacks made the infrastructure side straightforward: destroy and create, deterministic every time. This was the sharpest contrast with EKS, where third-party component versions and schema conflicts had made every infrastructure change unpredictable.

No rollback moments, no close calls, zero issues. Two years of complexity replaced in three days by something that just worked.

## Results

We were running six EKS control planes at [$0.10/hour each](https://aws.amazon.com/eks/pricing/){:target="_blank" rel="noopener noreferrer"}, roughly $438/month for the management layer. That jumps to $0.60/hour per cluster ($2,592/month total) if you fall behind onto an extended-support K8s version. ECS has no equivalent fee, and at our scale the management layer was the dominant infrastructure expense.

| Metric | Before (K8s/EKS) | After (ECS Fargate) |
|:---|:---|:---|
| Monthly control plane cost | ~$438 (6 clusters × $73) | $0 |
| Monthly compute cost | Nearly identical | Nearly identical |
| Architect time on infrastructure ops | ~4 hrs/week + upgrade weeks | Near zero |
| Disruption budget violations | Recurring, never resolved | Zero, ever |
| Customer-facing outages from scaling | Regular | None |
| Spot instance utilization | Difficult, limited | Easy, effective |
| Delivered project value | Baseline | ~20% increase in expected value score |

ECS Fargate has never once violated a disruption budget or caused an outage, and zero configuration was required to achieve this. Spot instances also became much easier and more effective to use, pushing costs down further. The human cost made the case even more overwhelming: four hours per week of architect time reclaimed, full upgrade weeks eliminated, and leadership available for strategic work instead of cluster operations.

Early criticism of Fargate centered on cost, and when it launched that was accurate. AWS [cut Fargate prices by up to 50% in 2019](https://aws.amazon.com/blogs/compute/aws-fargate-price-reduction-up-to-50/){:target="_blank" rel="noopener noreferrer"} and has since added Fargate Spot (up to 70% savings), Compute Savings Plans (up to 50%), and Graviton support at 20% lower cost. For teams without dedicated platform engineers, the total cost of ownership comparison no longer favors self-managed Kubernetes.

With that said, I do miss `kubectl apply`. YAML-based declarative changes made versioned service updates genuinely ergonomic, even compared to CloudFormation. But the golden violin wasn't worth the deal with the devil.

## Key Lessons

### 1. Tool selection requires honest requirements analysis

Before adopting Kubernetes, I should have asked five questions honestly: Do we need multi-cloud? Are we running hundreds of microservices? Do we have dedicated platform engineers? Is the operational overhead justified? Do we need fine-grained orchestration control? The answer to every one was no. That analysis should have happened before we committed, not two years in.

### 2. Self-blame delays obvious decisions

The denial period cost us at least a year. We assumed the problem was our technical competence rather than our tool selection, an assumption the internet reinforces enthusiastically. Talking to other teams who had lived through the same experience was what finally broke through it.

### 3. Managed cloud services exist to eliminate operational overhead

Kubernetes is not built for that goal; it's built for scale so large that even tiny resource optimizations are material, with dedicated platform teams to absorb the operational complexity. A tool built for someone else's problem at someone else's scale becomes your problem at your scale.

### 4. The largest cost of the wrong tool rarely appears on an invoice

Four hours per week of architect time, full upgrade weeks, and leadership capacity diverted from strategy to operations don't show up as line items until you add them up yourself. We didn't just ship slower; we shipped fewer projects and lower-value projects for two years.
