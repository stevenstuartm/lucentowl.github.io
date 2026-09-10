---
title: "Azure Container Registry & Container Security"
layout: guide
category: Azure
subcategory: Container Orchestration (Advanced)
description: "ACR service tiers and their Premium-gated features, geo-replication as an active-active eventually consistent system, Defender vulnerability assessment, Notary Project image signing after the retirement of Docker Content Trust, and the Entra roles that govern registry access"
tags: [acr, containers, supply-chain-security, image-signing, vulnerability-scanning, advanced]
---

## What Is Azure Container Registry

An [Azure Container Registry](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-intro){:target="_blank" rel="noopener noreferrer"} (ACR) stores container images and other OCI artifacts that you deploy to Azure Kubernetes Service, Container Apps, Container Instances, App Service, or any OCI-compatible runtime. It is private, integrated with Microsoft Entra identity, and the target of Defender for Cloud's registry vulnerability assessment.

A registry lives in one home region. On the Premium tier you can add geo-replicas in other regions, which stay part of the same registry resource rather than becoming registries of their own.

### What Problems ACR Solves

**Without a private registry:**
- Images flow through public registries, exposing dependency graphs and inviting rate limits
- No vulnerability assessment before images reach production
- No control over where images are stored or replicated
- No audit trail of pulls and pushes
- No way to enforce signing or verify provenance

**With ACR:**
- Private storage with Entra-based access control, scopable to individual repositories
- Registry vulnerability assessment through Microsoft Defender for Cloud
- Geo-replication with one global endpoint and automatic routing to the nearest healthy replica
- Diagnostic logs of image operations
- OCI-standard signatures stored alongside images, verifiable in pipelines and on AKS
- Artifact cache rules that pull public images through your registry instead of pulling from Docker Hub at deploy time

### How ACR Differs from AWS ECR

The differences that change a design are structural rather than featural:

| Concept | AWS ECR | Azure ACR |
|---------|---------|----------|
| **Replication identity** | Cross-region replication produces a separate repository per region, each with its own registry URI | Geo-replicas share one registry resource and one login server, so image references don't change per region |
| **Vulnerability scanning** | Amazon Inspector, enabled per registry | Microsoft Defender for Cloud, enabled per subscription, scanning ACR alongside ECR, GAR, GCR, and configured external registries |
| **Build service** | CodeBuild, a separate service | ACR Tasks, running inside the registry and able to rebuild on base image updates |
| **Feature gating** | Mostly account-level settings | Gated by SKU: geo-replication, private endpoints, retention policy, and customer-managed keys are Premium-only |
| **Network isolation** | VPC endpoints | Private endpoints via Azure Private Link, Premium only |

---

## Service Tiers

ACR has three tiers: Basic, Standard, and Premium. They share the same data-plane APIs and programmatic capabilities. What differs is included storage, request-rate capacity, and which features exist at all.

The tier decision is usually not about storage. It is about the feature cliff at Premium.

### Tier Comparison

| Resource or feature | Basic | Standard | Premium |
|---|---|---|---|
| **Included storage** | 10 GiB | 100 GiB | 500 GiB |
| **Storage limit** | 40 TiB | 40 TiB | 100 TiB |
| **Max image layer size** | 195 GiB | 195 GiB | 195 GiB |
| **Webhooks** | 2 | 10 | 500 |
| **Availability zones** | Yes | Yes | Yes |
| **Repository-scoped Entra permissions (ABAC)** | Yes | Yes | Yes |
| **Non-Entra tokens and scope maps** | 100 | 500 | 50,000 |
| **Anonymous pull** | No | Yes | Yes |
| **Artifact cache rules** | No | Yes | Yes |
| **Geo-replication** | No | No | Yes |
| **Private endpoints** | No | No | Yes (200 max) |
| **Dedicated data endpoints** | No | No | Yes |
| **IP access rules** | No | No | Yes (200 max) |
| **Retention policy for untagged manifests** | No | No | Yes |
| **Customer-managed keys** | No | No | Yes |
| **Artifact streaming** | No | No | Yes |
| **Connected registries** | No | No | Yes |
| **Export policy (data exfiltration control)** | No | No | Yes |
| **Dedicated agent pools for Tasks** | No | No | Yes |
| **Content trust (Docker Content Trust)** | No | No | Yes, deprecated |

Storage beyond the included amount is billed per GiB per day up to the tier's storage limit. Zone redundancy is enabled by default on every tier in supported regions, which is a change from ACR's earlier behavior and means Basic and Standard registries are no longer single-zone.

Note what is **not** tier-gated, because these are the usual misconceptions. Vulnerability assessment is a Defender for Cloud plan, not a registry SKU feature, so a Basic registry gets exactly the same scanning as a Premium one. Repository-scoped permissions work on every tier, both through Entra ABAC conditions and through non-Entra scope-mapped tokens.

### Throughput and Rate Limits

ACR publishes request-rate limits per SKU rather than bandwidth figures. Rates are per minute, and exceeding one returns HTTP 429 with a `Retry-After` header.

| Operation | Scope | Basic and Standard | Premium |
|---|---|---|---|
| DataplaneRead (pulls, listing, HEAD) | Per registry | 10,000 r/m | 20,000 r/m |
| DataplaneRead | Per identity per registry | 5,000 r/m | 10,000 r/m |
| DataplaneWrite (pushes) | Per registry | 2,000 r/m | 4,000 r/m |
| DataplaneWrite | Per identity per registry | 1,000 r/m | 2,000 r/m |
| DataplaneDelete | Per registry | 1,000 r/m | 4,000 r/m |
| ListReferrers (signatures, SBOMs) | Per registry | 500 r/m | 2,000 r/m |
| OAuth (login and token exchange) | Per registry | 10,000 r/m | 20,000 r/m |

Three details in that table decide real designs. The **per-identity** limits mean a single misconfigured scanner or a deployment that reuses one service principal across every node can exhaust its own bucket while the registry as a whole sits idle. **Anonymous pulls all count as one identity**, and so do all requests using the admin account, including both of its passwords. And **requests can count against two limits at once**: listing referrers is also a DataplaneRead, so heavy signature verification eats into the same capacity as image pulls.

Enforcement is a token bucket, so short bursts above the steady rate succeed and a burst that empties the bucket can throttle for up to a full minute afterward. Microsoft states these are best-effort approximations with no SLA behind them.

Bandwidth throughput is determined by SKU but is not published as a number. If you are hitting throttling or slow pulls, the documented remedies are exponential backoff with jitter, spacing out large deployments, raising the SKU, or asking support for a limit increase. Storage limits, private endpoint count, and push/pull bandwidth are all increasable case by case.

---

## Geo-Replication

### One Registry, Many Replicas

[Geo-replication](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-geo-replication){:target="_blank" rel="noopener noreferrer"} adds replica resources in other Azure regions to a **single** registry. It requires the Premium tier. Nothing about your image references changes when you add one: there is still one login server, one set of credentials, and one set of role assignments and network rules.

```
   deployment manifests everywhere reference:  myregistry.azurecr.io/myapp:v1
                                    │
                                    ▼
                      ┌──────────────────────────┐
                      │  Global endpoint routing │  picks the replica with the
                      │   (Azure-managed, DNS)   │  best network profile, and
                      └──┬───────────┬────────┬──┘  routes away from unhealthy ones
                         │           │        │
          ┌──────────────┘           │        └──────────────┐
          ▼                          ▼                       ▼
  ┌───────────────┐          ┌───────────────┐       ┌───────────────┐
  │ replica: East │◀────────▶│ replica: West │◀─────▶│ replica: EU   │
  │ US (home)     │  async   │ US            │ async │ West          │
  │ control plane │  bidir.  │               │       │               │
  └───────┬───────┘          └───────┬───────┘       └───────┬───────┘
          │ 307 redirect             │                       │
          ▼                          ▼                       ▼
   layer blobs from that same region's data endpoint, never cross-region
```

Every replica is **active-active and writable**. You can push, pull, and delete against any of them, and content syncs bidirectionally in the background. This is not a primary-with-passive-secondaries model.

### Eventual Consistency Is the Thing to Design Around

Replication is asynchronous, and replication time scales with image size. Four things go wrong as a result, and all of them look like intermittent bugs if you haven't planned for them:

**Push-then-immediate-cross-region-pull** fails with `manifest unknown`. A CI runner pushes an image and pods in another region try to pull it before replication catches up. This is the most common one.

**Tag overwrite races.** Push `myapp:v1`, then re-push `myapp:v1` with different content, and during the replication window different replicas resolve the same tag to different digests.

**Delete propagation.** A deleted tag can still be pulled from replicas the deletion hasn't reached.

**Mid-push scatter.** A `docker push` is many HTTP requests: a blob upload per layer, then a manifest that references them by digest. Some Linux resolvers don't cache consistently, so DNS can bounce between nearby replicas mid-push, landing layers on one replica and the manifest on another. The symptom is a manifest validation error or `blob unknown`.

The mitigations, in the order the docs prefer them: pin the push to one replica with a **regional endpoint**; use a short-lived DNS cache scoped to a single push; retry cross-region pulls with backoff; or use [webhooks](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-webhook){:target="_blank" rel="noopener noreferrer"} to learn when replication has completed in a given replica before triggering the pull. Note that a single push produces a webhook event from the receiving replica plus one from each replica as replication completes, so consumers need to deduplicate.

### Health-Aware Failover

ACR monitors each replica and reroutes global-endpoint traffic away from ones that can't serve requests. This is platform-managed with no customer trigger, evaluated per registry rather than per region, and takes on the order of minutes end to end plus DNS TTL. Failback is automatic once the region recovers.

Two boundaries matter:

- It applies **only to the global endpoint**. Regional endpoints talk to one replica directly and never reroute, so client-side failover is yours to implement.
- It is **not triggered by throttling**. It responds to service and infrastructure health, not to HTTP 429. A replica that is throttling you in a healthy region keeps receiving your traffic.

Because rate limits are per replica, a failover concentrates traffic onto the remaining replicas. Plan for at least two or three replicas so a single region loss doesn't push the survivors into throttling.

### Home Region Outage

The home region is fixed at creation and hosts the control plane. If it goes down, the data plane keeps working through other replicas: push, pull, delete, all authentication methods, and webhooks all continue. What stops is registry configuration changes, the home region's own regional endpoint, and **ACR Tasks**, which are bound to the home region and don't run while it's unavailable. That last one is the surprise: a geo-replicated registry survives a home region outage for deployments but not for builds.

### Cost and Limits Across Replicas

- **Storage is billed per replica.** A 1 GiB image replicated to five regions is billed as 5 GiB.
- **Storage limits are shared**, not multiplied. That same image counts once against the tier's storage limit.
- **Rate limits are per replica**, which is why regional endpoints are the tool for spreading load deliberately.
- **Cross-region data transfer still applies to the replication traffic itself.** What geo-replication saves is the transfer cost of every subsequent in-region pull, which is where the volume is.

### Regional Endpoints

Regional endpoints (in preview, Premium only) give each replica its own login server at `myregistry.<region>.geo.azurecr.io`, alongside the global endpoint rather than replacing it. Use them for push-pull consistency in CI/CD, for pinning a cluster to its colocated replica, for client-side failover logic, and for capacity planning against per-replica limits.

They come with three operational catches. Container tools store credentials per hostname, so switching endpoints needs a fresh `az acr login` for that hostname. AKS managed-identity pulls from regional endpoints require a recent node image, and older nodes need an image pull secret or the global endpoint instead. And each endpoint surface consumes a private endpoint IP: a registry with three replicas and regional endpoints enabled needs 1 global + 3 data + 3 regional = **7 private IPs** per private endpoint resource, against 4 without them.

---

## Vulnerability Assessment

### What Scans Your Images

[Microsoft Defender for Cloud](https://learn.microsoft.com/en-us/azure/defender-for-cloud/agentless-vulnerability-assessment-azure){:target="_blank" rel="noopener noreferrer"} uses **Microsoft Defender Vulnerability Management (MDVM)** to assess images in registries and images used by running containers. It reaches ACR, Amazon ECR, Google Artifact Registry, Google Container Registry, and configured external registries such as Docker Hub and JFrog Artifactory, which makes it the single pane for a multi-registry estate.

Registry vulnerability assessment comes with Defender for Containers, and with Defender CSPM for supported scenarios, where findings additionally carry contextual risk signals and risk-based prioritization. It requires **Registry access** to be enabled.

Coverage is asymmetric. **OS package assessment covers Linux and Windows, but language package assessment is Linux only.**

### Scanning Cadence

The timing is the detail most often assumed wrong.

- Newly pushed or imported images are **typically scanned within a few hours**, not within minutes.
- A **daily rescan** updates findings for images pushed in the last 30 days, images pulled in the last 30 days, and images currently running in monitored Kubernetes clusters.
- Images that fall outside all three windows **stop being rescanned** and stop receiving updated findings. If an image is missing from results, pulling it reactivates scanning.
- Deleted images usually have their findings removed within an hour, but it can take up to three days if ACR's deletion notification is delayed.

That 30-day window is the trap in a long-lived registry: an image sitting untouched for a quarter is not being reassessed against new CVEs, and its clean bill of health is stale rather than current.

### Runtime Assessment

Beyond the registry, Defender can assess images used by running containers, in two shapes. **Runtime findings with registry context** maps registry-scanned images onto running workloads and needs Registry access plus either K8s API access or the Defender sensor. **Registry-agnostic runtime scanning** collects images from the cluster regardless of origin and needs agentless machine scanning plus K8s API access or the sensor.

Runtime assessment doesn't scan the container runtime layer, doesn't support Windows nodes or nodes on AKS ephemeral OS disks, and can return partial results on autoscaled clusters where nodes are down at scan time. Agentless inventory runs roughly every 24 hours; the Defender sensor updates inventory near real time.

### Acting on Findings

ACR does not block deployment of vulnerable images. Enforcement is yours to build, and there are three places to put it:

1. **In the pipeline**, failing the build when findings exceed a threshold. This is the only place that stops a bad image from ever reaching the registry.
2. **At admission**, with an admission controller that rejects images by policy. This catches images that were clean at push and are not any more.
3. **In the registry**, using quarantine so pushed images can't be pulled until they're released.

Registry-wide quarantine is a preview feature, documented outside Microsoft Learn, and governed by the `AcrQuarantineReader` and `AcrQuarantineWriter` roles. It is stronger than the tag-convention approach it is often confused with: a quarantined image genuinely cannot be pulled, rather than merely being labeled as unfit.

---

## Image Signing

### Docker Content Trust Is Retiring

This is the fact to act on before anything else in this section. ACR's [Docker Content Trust (DCT)](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-content-trust-deprecation){:target="_blank" rel="noopener noreferrer"} entered deprecation on **31 March 2025** and is removed from ACR entirely on **31 March 2028**. It was Premium-only, and it is **not supported at all on registries configured for ABAC repository permissions**, so adopting the current RBAC model already forecloses it.

The replacement is the [Notary Project](https://notaryproject.dev/){:target="_blank" rel="noopener noreferrer"} and its `notation` tooling. Signatures are OCI artifacts attached to the image as referrers, which makes them portable across any OCI-compliant registry rather than tied to ACR.

Disabling DCT is a prerequisite for the transition: unset `DOCKER_CONTENT_TRUST` in your shells, and run `az acr config content-trust update -r myregistry --status disabled`.

### The Signing and Verification Path

```
  ┌──────────────────┐        sign        ┌──────────────────────┐
  │  CI/CD pipeline  │───────────────────▶│   Azure Key Vault    │
  │  builds image    │◀───────────────────│  signing key + cert  │
  └────────┬─────────┘   signature bytes  └──────────────────────┘
           │
           │ push image, then push signature as an OCI referrer
           ▼
  ┌──────────────────────────────────────────────────────────────┐
  │                   Azure Container Registry                   │
  │   myapp:v1  ◀── referrer ──  sha256:… (Notary signature)     │
  └────────┬─────────────────────────────────────────────────────┘
           │ kubelet requests image
           ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  AKS admission: Azure Policy + Ratify                        │
  │    1. resolve the image's signature referrers                │
  │    2. verify the signature chains to a trusted identity      │
  │    3. admit, or reject the pod                               │
  └──────────────────────────────────────────────────────────────┘
```

Four properties of this flow decide whether it works:

**The key never leaves Key Vault.** Notation signs against a key in Key Vault, using either a self-signed certificate or one issued by a CA. The pipeline holds an identity that may use the key, not the key itself.

**The signature is a separate artifact.** It is pushed as an OCI referrer attached to the image digest, not embedded in the image. That is why pushing a signature needs a *write* role and why listing referrers has its own rate limit.

**Verification happens twice, in different places.** In pipelines, `notation verify` runs in the Azure DevOps task or GitHub Action. On AKS, verification is enforced at admission by **Ratify with Azure Policy**, which is the piece people leave out and then wonder why signing changed nothing.

**Trust policy is what makes signing meaningful.** Verifying that an image carries *a* valid signature proves nothing: an attacker's key produces a valid signature too. The verifier must be configured with the specific identities it trusts, and that trust policy is the security control. Signing without it is theater.

### When to Require Signatures

Signing pays for itself where provenance is audited or where images cross a trust boundary: regulated industries, multi-tenant platforms, images consumed by teams that didn't build them, and anywhere a base image comes from outside your organization. It is friction without much benefit in development clusters where the same people build and deploy and a compromised image has nowhere to go.

Whatever you decide, apply it per cluster rather than per registry. A single registry can serve both a strictly verifying production cluster and a permissive development one, because the enforcement lives at admission.

---

## ACR Tasks

[ACR Tasks](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-tasks-overview){:target="_blank" rel="noopener noreferrer"} builds, tests, and pushes images on Azure-managed infrastructure, inside the registry, with no build agents of your own.

**Quick tasks** (`az acr build`, `az acr run`) build on demand from local or remote source without persisting a task definition. They are the fastest way to check that a Dockerfile builds for the target architecture without a local Docker daemon.

**Multi-step tasks** define a sequence of build, run, and push steps in YAML, versioned alongside your source.

**Triggers** are where Tasks earn their place over a generic CI system. Alongside commit, pull request, and cron triggers, a task can trigger on **base image update**: when the image in your `FROM` line gets patched, dependent images rebuild automatically. That is the mechanism that keeps OS-level CVEs from accumulating in images nobody has touched in months, and it is the single most valuable thing Tasks do.

Two operational constraints. Tasks run in the registry's **home region** and stop during a home region outage. And on a registry with the public endpoint disabled, tasks need a dedicated agent pool in a delegated subnet, which is Premium-only.

---

## Image Lifecycle Management

ACR's cleanup story is three separate mechanisms that get conflated. Knowing which one does what avoids designing a retention scheme that the service doesn't implement.

**Retention policy** applies to **untagged manifests only**, and is Premium-only. It deletes manifests that lost their last tag after a set number of days. It does not delete by tag pattern and it does not keep the last N images.

**`acr purge`** is what does tag-based cleanup. It runs [as an ACR Task](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-auto-purge){:target="_blank" rel="noopener noreferrer"}, matches repositories and tags by filter, and deletes by age. Scheduling it on a cron trigger is how you implement "delete `pr-*` tags older than 14 days", a rule that reads like a retention policy but isn't one.

**Soft delete** is a separate policy that retains deleted artifacts for a recovery window instead of removing them immediately. Turn it on before you automate deletion, not after your first accidental purge.

A workable default is `acr purge` on a nightly task for build-artifact tag patterns, retention policy on untagged manifests to sweep up what purge untags, and soft delete enabled underneath both so a bad filter is recoverable.

---

## Authentication and Authorization

### How Identities Authenticate

| Method | Use case |
|--------|----------|
| **Managed identity** | AKS kubelet, Container Apps, Container Instances, App Service, Functions, Machine Learning. No secrets, automatic rotation. The default answer. |
| **Service principal** | CI/CD systems outside Azure, and cross-tenant AKS-to-ACR pulls |
| **Non-Entra scope-mapped tokens** | Repository-scoped credentials for systems that can't hold an Entra identity |
| **Admin account** | Debugging only. Both of its passwords share one identity for rate limiting, and it has no audit attribution. |

### Two Permission Modes

A registry runs in one of two **role assignment permissions modes**, and which one it is determines which role names apply. Check it under Properties before you write any role assignment.

**RBAC Registry + ABAC Repository Permissions** is the current model. Roles can carry Entra ABAC conditions that scope them to specific repositories:

| Role | Grants |
|---|---|
| `Container Registry Repository Reader` | Pull images and artifacts, view tags and OCI referrers. Supports ABAC conditions. |
| `Container Registry Repository Writer` | Push, pull, update (not delete), manage tags and referrers. **This is the role that pushes Notary signatures.** Supports ABAC conditions. |
| `Container Registry Repository Contributor` | Adds delete. Supports ABAC conditions. |
| `Container Registry Repository Catalog Lister` | List all repositories. **Does not support ABAC conditions**, so it is always registry-wide. |
| `Container Registry Contributor and Data Access Configuration Administrator` | Control plane: `az acr login`, SKU, networking, policies, and deleting the registry. No data plane access. |
| `Container Registry Tasks Contributor` | Manage tasks, agent pools, quick builds, and auto-purge |
| `Container Registry Data Importer and Data Reader` | Trigger `az acr import` and read the result |

**RBAC Registry Permissions** is the legacy mode, where the familiar `AcrPull`, `AcrPush`, `AcrDelete`, and `AcrImageSigner` roles apply registry-wide with no repository scoping.

Three things trip people up in the ABAC model:

- **The repository roles don't grant catalog list.** A reader can pull `myapp:v1` if it knows the name but can't enumerate what's in the registry. That is deliberate least privilege, and it breaks tools that list first.
- **`az acr login` is a control-plane permission.** An identity with `Container Registry Contributor and Data Access Configuration Administrator` can log in and still be unable to pull anything without a data-plane role.
- **Vulnerability scanners need registry-wide access.** Assign `Container Registry Repository Reader`, `Container Registry Repository Catalog Lister`, and `Container Registry Configuration Reader and Data Access Configuration Reader` **without** ABAC conditions, because a scanner scoped to some repositories silently leaves the rest unassessed.

### Repository-Scoped Access

Two mechanisms scope access below the registry, and they are available on **every tier**:

**Entra ABAC conditions** on the repository roles above. This is the path for anything that has an Entra identity.

**Non-Entra tokens with scope maps** cover everything else: a partner system, an on-premises builder, a tool that only knows how to hold a username and password. A scope map lists actions (`content/read`, `content/write`, `content/delete`, `metadata/read`, `metadata/write`) against repositories, and a token is bound to it. Limits are 100 tokens on Basic, 500 on Standard, and 50,000 on Premium, with 500 actions and 500 repositories per scope map on every tier.

---

## Network Isolation

[Private endpoints](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-private-link){:target="_blank" rel="noopener noreferrer"} give the registry private IPs inside your VNet so pulls never traverse the public internet. They are **Premium only**, capped at 200 per registry, and configuring one **automatically enables dedicated data endpoints**, because layer downloads would otherwise redirect to `*.blob.core.windows.net` and defeat the isolation.

Size the subnet before you create the endpoint. Each endpoint surface takes one IP: one for the global endpoint, one per replica for data endpoints, and one per replica again if regional endpoints are on. Getting this wrong breaks in two ways, and both produce unhelpful errors:

- Adding a geo-replica to a registry whose private endpoint uses **static** IP allocation fails, because the new region's data endpoint member can't be auto-added. Use dynamic allocation if you might add replicas later, or create the private endpoint only after every replica exists.
- If **any** connected subnet across any VNet runs out of IPs, replica creation rolls back without naming which subnet is exhausted.

Disabling the public endpoint entirely is the stronger posture, with three consequences to plan for: ACR Tasks need a dedicated agent pool in a delegated subnet, external CI/CD platforms need VNet connectivity to push, and developers need VPN or ExpressRoute to reach the registry at all.

---

## Supply Chain Patterns

### Signed Images with Enforced Admission

Sign in the pipeline against a Key Vault key, push the signature as a referrer, and enforce with Ratify and Azure Policy on the AKS clusters that matter. The pipeline identity needs `Container Registry Repository Writer`, scoped by ABAC to the repositories it builds.

The control that makes this work is the **trust policy on the verifier**, not the signing step. Enforce on production clusters and audit-only on the rest, so a broken signing step fails a deployment rather than blocking every developer.

### Blocking Vulnerable Images

Gate in the pipeline on Defender findings, because that is the only point where a bad image never reaches the registry at all. Back it with admission policy for images that were clean at push and have since aged into a CVE, and remember the 30-day rescan window: an image nobody has pulled recently is not being reassessed, so continuous coverage depends on the image staying in use or in a monitored cluster.

### Registry Segmentation by Environment

Separate development, staging, and production registries limit the blast radius of a compromised build and force deliberate promotion. `az acr import` moves images between registries server-side without pulling and re-pushing, and needs only `Container Registry Data Importer and Data Reader` on the target.

Weigh it against the alternative that ABAC now makes viable: one registry with repository-scoped role assignments, which keeps a single geo-replicated Premium registry rather than paying for three. Segment by registry when the environments have genuinely different network boundaries or different tiers; segment by repository and ABAC condition when the difference is only who may push.

### Artifact Cache Instead of Public Pulls

Artifact cache rules (Standard and Premium) pull public images through your registry on first request and serve them from it afterward. This removes Docker Hub rate limits from your deployment path, gives you one place to scan base images, and keeps a copy if upstream deletes a tag. It is the lowest-effort supply chain improvement available in ACR.

---

## Artifact Streaming

[Artifact streaming](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-artifact-streaming){:target="_blank" rel="noopener noreferrer"} (Premium only) lets a container start before all of its layers have been downloaded, with layers fetched on demand as files are accessed. It is aimed at large images, where full-image download dominates pod startup and slows every scale-out event.

The trade-off is a latency penalty the first time a container touches data in a layer that hasn't arrived. That is fine for cold paths and painful for anything on a hot path, so the images that benefit are large ones where most of the size is rarely touched, not large ones that read everything at startup.

Streaming configuration is itself governed by RBAC in a slightly surprising way: `Container Registry Repository Writer` can **enable** streaming but not disable it, while `Container Registry Repository Contributor` can do both.

---

## Common Pitfalls

### Pitfall 1: Assuming Standard Supports Geo-Replication or Private Endpoints

**Problem:** Designing a multi-region or network-isolated architecture on a Standard registry.

**Result:** Both features are Premium-only. So are retention policies, customer-managed keys, dedicated data endpoints, IP access rules, export policy, and artifact streaming. The design fails at implementation, usually after the tier decision is already embedded in Bicep and cost models.

**Solution:** Treat Premium as a feature decision, not a scale decision. If the architecture needs any of the above, the tier is settled regardless of how small the registry is.

---

### Pitfall 2: Push-Then-Pull Across Regions

**Problem:** A pipeline pushes an image and immediately rolls out to clusters in several regions through the global endpoint.

**Result:** Intermittent `manifest unknown` failures in whichever regions replication hasn't reached, which look like flaky infrastructure and get retried away rather than fixed.

**Solution:** Push through a regional endpoint to pin the whole push to one replica, then either wait on replication webhooks or retry pulls with backoff. Design publish steps to be idempotent so retries are safe.

---

### Pitfall 3: Still Building on Docker Content Trust

**Problem:** New signing work implemented with DCT and `AcrImageSigner`.

**Result:** DCT is deprecated as of 31 March 2025 and removed on 31 March 2028, and it doesn't work at all on ABAC-enabled registries, so the work blocks the RBAC modernization too.

**Solution:** Sign with Notation against a Key Vault key, store signatures as OCI referrers, and verify with Ratify and Azure Policy on AKS.

---

### Pitfall 4: Using the Admin Account for Pulls

**Problem:** AKS `imagePullSecrets` populated with admin credentials, stored in pod specs, Helm values, and etcd.

**Result:** Credentials are readable by anyone who can inspect the cluster, rotation means updating every deployment, all traffic shares one rate-limit bucket, and audit logs attribute everything to the same identity.

**Solution:** Attach the kubelet managed identity to the registry with `Container Registry Repository Reader`, scoped by ABAC condition to the repositories that cluster actually needs.

---

### Pitfall 5: Expecting Retention Policy to Clean Up Tagged Images

**Problem:** Enabling the retention policy and assuming it will delete old `pr-*` and `build-*` tags.

**Result:** It only touches **untagged** manifests. Tagged build artifacts accumulate indefinitely, and storage keeps growing, billed once per geo-replica.

**Solution:** Schedule `acr purge` as an ACR Task for tag-pattern cleanup, keep the retention policy for the untagged manifests purge leaves behind, and turn on soft delete before automating any of it.

---

### Pitfall 6: Trusting a Signature Without a Trust Policy

**Problem:** Verification configured to check that an image has a valid signature, without constraining which identity signed it.

**Result:** Any signature passes, including one an attacker made with their own key. The pipeline reports "signature verified" and the control provides nothing.

**Solution:** Configure the verifier's trust policy with the specific trusted identities and certificate chains, and audit that policy the way you'd audit a firewall rule.

---

## Key Takeaways

1. **Premium is a feature cliff, not a size upgrade.** Geo-replication, private endpoints, retention policy, customer-managed keys, dedicated data endpoints, connected registries, export policy, and artifact streaming exist only there. Storage rarely drives the decision.

2. **Geo-replication is one registry with one login server, active-active and eventually consistent.** Every replica is writable, image references never change per region, and the design work is handling replication lag rather than orchestrating failover.

3. **Health-aware failover is automatic but bounded.** It works on the global endpoint, takes minutes, and doesn't apply to regional endpoints or respond to throttling. Keep two or three replicas so a failover doesn't throttle the survivors.

4. **ACR Tasks are bound to the home region.** A geo-replicated registry keeps serving pulls through a home region outage but stops building.

5. **Vulnerability assessment is a Defender plan, not a registry tier feature**, and it rescans daily only for images pushed or pulled in the last 30 days or currently running. An untouched image's clean result is stale, not current.

6. **Docker Content Trust is deprecated and gone on 31 March 2028.** Sign with Notation against Key Vault, store signatures as OCI referrers, and verify with Ratify and Azure Policy.

7. **Signing without a trust policy proves nothing.** The control is the list of identities the verifier accepts, not the presence of a signature.

8. **Know which permissions mode the registry is in.** ABAC-enabled registries use `Container Registry Repository Reader`/`Writer`/`Contributor` with repository conditions; legacy registries use `AcrPull` and `AcrPush` registry-wide. The repository roles deliberately don't grant catalog list.

9. **Rate limits are per identity and per replica.** One shared service principal, anonymous pulls, or admin credentials all collapse into a single bucket, and a failover concentrates load onto fewer replicas.

10. **Retention policy covers untagged manifests only.** Tag-pattern cleanup is `acr purge` on an ACR Task, and soft delete is the safety net you enable first.
