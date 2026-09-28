---
title: "Amazon ECR & Container Image Security for System Architects"
layout: guide
category: AWS
subcategory: Containers in Production
description: "How Amazon ECR stores and distributes container images and how to trust what runs: registry and repository permissions, private pulls through VPC endpoints, tag immutability, lifecycle rules and archive, replication and pull through cache, basic and Inspector scanning, image signing and verification, and least-privilege container settings."
tags: [ecr, container-images, image-scanning, amazon-inspector, image-signing, supply-chain-security, practical]
---
{% raw %}

## What ECR Does and Where It Lives

Amazon Elastic Container Registry (ECR) stores container images and serves them to whatever runs them: ECS tasks, EKS pods, Lambda functions packaged as images, CodeBuild jobs, or a developer's laptop. It also stores other artifacts in the same format, such as Helm charts, and the signatures and software bills of materials (SBOMs) that describe an image. The format is the Open Container Initiative (OCI) standard, so any Docker or OCI client can push and pull.

Three levels of containment decide where settings live:

| Level | What it is | Settings that live here |
|---|---|---|
| **Registry** | One per account per Region, addressed as `123456789012.dkr.ecr.us-east-1.amazonaws.com` | Registry permissions policy, scanning configuration, replication rules, pull through cache rules, repository creation templates, signing rules, blob mounting |
| **Repository** | A named collection of images, such as `orders/api` | Repository policy, tag mutability, encryption, lifecycle policy |
| **Image** | A manifest and its layers, identified by a **digest** (a SHA-256 hash of the manifest) and optionally by one or more **tags**. A multi-platform image is a **manifest list** pointing to one image per processor architecture or operating system | Storage class (standard or archive) |

The registry is Regional. An image pushed in `us-east-1` exists only there until something copies it to another Region, and every registry-level setting has to be configured once per Region the account uses. Encryption is fixed when a repository is created. The default is AES-256 with S3-managed keys, and a repository can instead use a KMS key, either the AWS managed key for ECR or a customer managed key.

**Amazon ECR Public** is a separate service for images anyone can pull, at `public.ecr.aws`. It includes 50 GB a month of free storage, and pulls to AWS compute in any Region are free without limit. Private repositories are the subject of the rest of this guide.

---

## Controlling Who Pushes and Pulls

### Authentication

Docker clients don't speak IAM, so ECR issues an **authorization token**, valid for 12 hours, that a client uses as a registry password. `aws ecr get-login-password` fetches one with the caller's credentials. ECS, EKS nodes, and CodeBuild fetch tokens themselves using the role they run with. On ECS, that is the task execution role. On EKS, it is the node's IAM role, or the Fargate pod execution role.

The token carries the caller's permissions, and it grants nothing by itself. `ecr:GetAuthorizationToken` applies to the whole registry, so it takes `"Resource": "*"`, and the actions that read or write images are granted per repository. The AWS managed policy `AmazonEC2ContainerRegistryPullOnly` grants only the pull actions, which suits compute roles. Build pipelines need the push actions as well.

### Repository and registry policies

A **repository policy** is a resource policy on one repository. It is how another account gets access. Pulling across accounts needs an allow in both accounts. The repository policy in the registry account names the other account, and an identity policy in that account grants the role the pull actions. A common pattern keeps images in a shared tooling account and lets every account in the organization pull:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "OrgPull",
      "Effect": "Allow",
      "Principal": "*",
      "Action": [
        "ecr:BatchGetImage",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchCheckLayerAvailability"
      ],
      "Condition": {
        "StringEquals": { "aws:PrincipalOrgID": "o-a1b2c3d4e5" }
      }
    }
  ]
}
```

A **registry permissions policy** covers registry-level operations. The destination account of cross-account replication needs one that lets the source account replicate into it, and it can scope what principals do with pull through cache. Repository creation templates can also stamp a repository policy onto every repository ECR creates on your behalf.

---

## Pulling Images from Private Subnets

A pull makes three kinds of request. The client calls the ECR API for an authorization token, calls the registry endpoint to read the image manifest, then downloads each layer from an S3 bucket that ECR owns. A task or node in a private subnet with no NAT gateway needs a private route for all three:

- An interface endpoint for `com.amazonaws.<region>.ecr.api`, for the token and API calls.
- An interface endpoint for `com.amazonaws.<region>.ecr.dkr`, for Docker and OCI registry calls. Its private DNS name must be enabled, so the registry hostname resolves to the endpoint.
- A gateway endpoint for S3, attached to the subnets' route tables, for the layers.

{% endraw %}
{% include figure.html id="aws-ecr-private-pull" %}
{% raw %}

The S3 gateway endpoint is the one teams forget, because the image name never mentions S3. Without it, the token and manifest calls succeed and the layer downloads fail or leave through a NAT gateway, which bills every gigabyte of image data it processes. The endpoint's security group must allow HTTPS from the subnets. A task that also sends logs with the `awslogs` driver needs a CloudWatch Logs endpoint, and an ECS task on EC2 instances also needs the ECS endpoints for the agent.

Endpoint policies can narrow what the endpoints allow, such as pulls only, or pulls only by named roles. The S3 endpoint's policy can be limited to `s3:GetObject` on ECR's layer bucket for the Region, `prod-<region>-starport-layer-bucket`.

---

## Tags, Digests, and Immutability

A digest names exact content and never changes. A tag is a movable pointer to a digest, so `orders/api:v1.4.2` can point at one image today and another tomorrow if someone pushes over it. Anything that must run a known image, such as a production deployment or a rollback, should resolve the tag to a digest when it deploys, and record the digest.

When a push moves a tag, the image it used to point at stays in the repository with no tag, as an **untagged** image. **Tag immutability** stops a push from moving an existing tag. With it on, pushing `v1.4.2` a second time fails, which protects release tags from an accidental or malicious overwrite. Since July 2025 a repository can set exclusion filters of up to five wildcard patterns, so tags like `latest` or `dev-*` stay movable while every release tag is locked:

```bash
aws ecr put-image-tag-mutability \
  --repository-name orders/api \
  --image-tag-mutability IMMUTABLE_WITH_EXCLUSION \
  --image-tag-mutability-exclusion-filters filter=latest,filterType=WILDCARD
```

Two interactions catch people. A pull through cache repository must stay mutable, because ECR refreshes cached images under the same tag. And when replication brings in an image whose tag already exists in an immutable destination repository, the image arrives without that tag, so it may land untagged.

A tagging scheme matters mostly because lifecycle rules select images by tag. Release versions, commit SHAs, and environment-specific tags each need a distinct pattern, so a rule can keep releases and expire builds.

---

## Keeping the Registry Small

### Lifecycle policies

Every push adds an image, and CI pipelines push on every commit. A **lifecycle policy** on a repository expires or archives images automatically, within 24 hours of an image meeting a rule's criteria. Each rule selects images by tag status (`tagged`, `untagged`, or `any`) and by tag pattern, then applies a count or age:

| `countType` | Selects | Allowed action |
|---|---|---|
| `imageCountMoreThan` | Everything beyond the newest N matching images | Expire or archive |
| `sinceImagePushed` | Images pushed more than N days ago | Expire or archive |
| `sinceImagePulled` | Images not pulled in N days (or pushed N days ago, if never pulled) | Archive only |
| `sinceImageTransitioned` | Images archived more than N days ago, with `"storageClass": "archive"` in the selection | Expire only, and N must be at least 90 |

The evaluation rules explain most surprises. All rules are evaluated together, then applied in priority order, lowest number first. An image is acted on by at most one rule, and an image that matches a higher-priority rule's tag selection can't be expired by a lower-priority rule even when the higher rule leaves it alone. A rule with `tagStatus: any` must have the highest priority number. An image referenced by a manifest list can't be expired until the list is. Signatures and SBOMs are stored as separate artifacts that refer to an image, and when that image is deleted or archived, they follow within 24 hours.

Because a higher-priority match shields an image, a release rule at priority 1 protects every release tag from the rules after it. This policy expires release images beyond the newest 20, so older releases are deleted and the 20 newest are safe from every later rule. It also expires untagged images after a week and main-branch builds after 14 days:

```json
{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Expire releases beyond the newest 20",
      "selection": {
        "tagStatus": "tagged",
        "tagPatternList": ["v*"],
        "countType": "imageCountMoreThan",
        "countNumber": 20
      },
      "action": { "type": "expire" }
    },
    {
      "rulePriority": 2,
      "description": "Expire untagged images after 7 days",
      "selection": {
        "tagStatus": "untagged",
        "countType": "sinceImagePushed",
        "countUnit": "days",
        "countNumber": 7
      },
      "action": { "type": "expire" }
    },
    {
      "rulePriority": 3,
      "description": "Expire main-branch builds after 14 days",
      "selection": {
        "tagStatus": "tagged",
        "tagPatternList": ["main-*"],
        "countType": "sinceImagePushed",
        "countUnit": "days",
        "countNumber": 14
      },
      "action": { "type": "expire" }
    }
  ]
}
```

A `tagPatternList` with more than one pattern selects only images carrying tags that match every pattern. Alternatives such as `main-*` and `pr-*` therefore go in separate rules. `aws ecr start-lifecycle-policy-preview` shows what a policy would act on before it is applied, and every action it takes is recorded in CloudTrail.

### The archive storage class

Since November 2025 ECR has two storage classes. **Standard** is the default. **Archive** is for images that must be kept, for compliance or for a rare rollback, but aren't pulled. An archived image can't be pulled or scanned. Restoring it back to standard takes up to 20 minutes and costs $0.03 per GB retrieved, and archive storage has a 90-day minimum charge.

In US East (N. Virginia) archive costs the same $0.10 per GB-month as standard for an account's first 150 TB, and $0.07 above that, so below that volume it saves nothing on storage and adds retrieval charges. What it does at any size is take images out of the active set. Archived images don't count against the per-repository image quota, and they drop out of vulnerability scanning and its findings. At very large volumes it is also cheaper storage.

A lifecycle rule moves images to archive with `"action": { "type": "transition", "targetStorageClass": "archive" }`. Pull history can only drive archiving, never deletion, so deleting what nobody uses takes two rules: archive what nothing has pulled in 90 days with `sinceImagePulled`, then expire archived images after a retention period of at least 90 days with `sinceImageTransitioned`.

---

## Getting Images to Where They Run

### Replication

**Replication** copies images to other Regions, other accounts, or both, as a registry-level configuration of up to 25 rules, each filtering repositories by name prefix. It copies only content pushed or restored after replication is configured, and most images arrive within 30 minutes. Each push replicates once, so replication doesn't chain. An image replicated from Region A to B doesn't continue on to C through a B-to-C rule. Replication never deletes or archives anything in the destination, so each destination repository needs its own lifecycle policy.

Replicating to the Regions where workloads run keeps pulls local, which is faster and avoids cross-Region transfer charges on every pull. It also keeps a Region's deployments independent of ECR in another Region. For cross-account replication, only the destination account needs a policy, a registry permissions policy granting the source account `ecr:ReplicateImage` and `ecr:CreateRepository`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowReplicationFromBuildAccount",
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::111122223333:root" },
      "Action": ["ecr:ReplicateImage", "ecr:CreateRepository"],
      "Resource": "*"
    }
  ]
}
```

Without `ecr:CreateRepository`, replication succeeds only into repositories that already exist in the destination.

### Repository creation templates

ECR creates repositories on your behalf in three cases: the first pull through a pull through cache rule, replication into a repository that doesn't exist yet, and, since December 2025, **create on push**, a push to a repository that doesn't exist. A **repository creation template** sets what those repositories get. It matches by name prefix (`ROOT` matches everything else) and sets tag mutability, encryption, repository policy, lifecycle policy, and resource tags. When no template matches, pull through cache and replication fall back to defaults, which are mutable tags, AES-256 encryption, and no repository or lifecycle policy, and create on push doesn't create the repository at all. A template that sets a KMS key or resource tags needs a role for ECR to assume.

Templates apply only at creation. They don't update existing repositories, so a changed template affects only repositories created after the change.

### Pull through cache

A **pull through cache rule** maps a prefix in your registry to an upstream registry, such as Docker Hub, the Kubernetes registry, Quay, GitHub Container Registry, ECR Public, or another ECR registry. Pulling `<registry>/docker-hub/library/nginx:1.27` fetches the image from Docker Hub the first time, stores it in a private repository, and serves it from ECR afterward. ECR checks upstream for a newer image under that tag at most once every 24 hours.

This removes a runtime dependency on the upstream registry and its rate limits (Docker Hub limits anonymous pulls to 100 per 6 hours per IP address), keeps pulls inside AWS, and puts third-party images under the same scanning as your own. Upstreams that require authentication, such as Docker Hub, need their credentials in a Secrets Manager secret named with the `ecr-pullthroughcache/` prefix. The first pull of an image needs a route to the internet even when ECR is reached through VPC endpoints. The pulling principal needs `ecr:BatchImportUpstreamImage`, which `AmazonEC2ContainerRegistryPullOnly` includes, and `ecr:CreateRepository` if the cached repository doesn't exist yet, which that policy doesn't include. Either create the repositories ahead of time or grant creation for the cache prefix in the registry policy. Since April 2026 the cache also brings along an upstream image's signatures and SBOMs. Lambda can't pull through a cache rule.

### Sharing layers across repositories

Services built from the same base image push the same base layers into different repositories. **Blob mounting** (January 2026), a registry setting, stores such a layer once and references it from every repository that uses it, which saves storage and makes pushes faster. Replication can mount layers that already exist in the destination, which needs blob mounting on in both registries when they differ.

---

## Scanning Images for Vulnerabilities

### Basic and enhanced scanning

A registry uses one of two scanning types, set per Region:

| | Basic scanning | Enhanced scanning |
|---|---|---|
| **Engine** | ECR, with AWS native technology since the Clair-based scanner was retired on February 2, 2026 | Amazon Inspector |
| **Finds** | Operating system package vulnerabilities | Operating system and programming language package vulnerabilities |
| **When** | On push for repositories matching a filter, or manually, at most once per image per 24 hours | On push, or continuously, rescanning when Inspector adds a relevant CVE (a published vulnerability) |
| **Findings go to** | ECR, and an EventBridge event per completed scan | ECR, Inspector, EventBridge, and Security Hub |
| **Cost** | No charge | Inspector pricing: $0.09 per image on first scan, $0.01 per continuous rescan |

With enhanced scanning on, repositories that match no scan filter aren't scanned at all, and manual scans aren't available. When it is first turned on, Inspector picks up only images pushed in the last 14 days, and older images show `SCAN_ELIGIBILITY_EXPIRED` until they are pushed again. Continuous scanning keeps monitoring an image while it was pushed or last in use within a configurable window, 14 days by default for accounts created since May 16, 2025, so long-deployed images stay covered while images nobody runs drop out. Inspector also maps each image to the ECS tasks and EKS pods running it, which turns a finding list into a priority list. A critical CVE in an image on 40 running tasks outranks one in an image nothing runs. Archived images aren't scanned, and their findings close.

When Security Hub is enabled, Inspector's container image scanning is billed inside Security Hub Essentials, per resource unit, rather than per scan.

### Gating deployments on findings

Scanning finds problems. It stops nothing unless something reads the results. Two places to act:

- **Before the image is pushed.** The Inspector `ScanSbom` API, driven by the `inspector-sbomgen` tool or the Inspector plugins for CI systems such as Jenkins and TeamCity, scans an image inside the pipeline at $0.03 per image. The build fails on the findings the team won't ship, before the image reaches the registry.
- **After it is pushed.** `aws ecr describe-image-scan-findings` returns counts by severity once the scan completes, which a pipeline stage can check before deploying. For continuous scanning, EventBridge rules on Inspector finding events route new critical findings on already-deployed images to a ticket or an alert.

A gate that blocks on every critical finding stalls delivery on CVEs with no fix available. Gate on findings that have a fixed version, and track the rest with an owner and a date.

Fixing a finding usually means rebuilding on a patched base image and redeploying, not patching a running container. A rebuild cadence for base images, even with no application change, is what keeps continuously scanned images from accumulating findings.

---

## Signing and Verifying Images

A scan says what's inside an image. A **signature** says who produced it and that it hasn't changed since. Without verification at deploy time, anyone with push access, or a compromised pipeline, can put an image in a repository and have it run.

ECR signs with **AWS Signer**, which holds the signing keys and certificates, and stores each signature in the same repository as the image, as an OCI artifact that refers to it. Signing happens under a **signing profile**, the Signer resource that sets how long signatures stay valid and that can later be revoked. The signatures follow the Notary Project's format, and **Notation**, that project's open-source CLI, signs and verifies them. There are two ways to sign:

- **Managed signing** (November 2025) is a registry setting of up to 10 signing rules, each naming a Signer signing profile and repository filters. ECR signs every matching image as it is pushed, using the pushing principal's identity, which needs `signer:SignPayload` on the profile. It costs $0.02 per signature. The signing profile must be in the same Region as the registry, and it can be in another account, so a security account can own the profiles.
- **Manual signing** uses the Notation CLI with the AWS Signer plugin in the pipeline, for signing outside the push or with more control over when.

Signatures count against the per-repository image quota, and lifecycle policies clean them up after their image goes.

Verification is where signing pays off, and it happens in the cluster or deployment path, not in ECR:

- **On EKS**, an admission controller, a webhook Kubernetes calls before accepting each pod, rejects pods whose images lack a valid signature from a trusted profile. The documented options are Kyverno with the Notation AWS Signer extension, and Gatekeeper with Ratify.
- **On ECS**, a service deployment lifecycle hook can call a Lambda function before new tasks scale up. The function verifies each image in the task definition with Notation and returns success or failure, which blocks or allows the deployment.

Revoking a signing profile takes an effective time in the past, and verification then rejects every signature the profile made after that time. The effective time can be moved earlier but never later, so it can be set to when a pipeline credential was stolen. Revoke the profile, then re-sign known-good images with a new one. Revocation can't be undone.

---

## Running Containers with Least Privilege

Scanning and signing decide which images run. The container's configuration decides how much a compromised process inside it can do. These settings live in the ECS task definition's container definitions, or in a pod's `securityContext` on EKS:

| Setting | ECS parameter | Effect |
|---|---|---|
| **Run as a non-root user** | `user`, such as `"1000"`, or `USER` in the Dockerfile | A process that escapes the application doesn't start as root |
| **Read-only root file system** | `readonlyRootFilesystem: true` | Nothing can write binaries or modify files in the image. Mount a volume for paths the app must write, such as `/tmp`. Not supported for Windows containers |
| **Drop Linux capabilities** | `linuxParameters.capabilities.drop: ["ALL"]` | Removes the privileges Docker grants by default, such as changing file ownership or opening raw sockets |
| **No privileged mode** | leave `privileged` unset | A privileged container has near-host-level access. Fargate doesn't support it |

```json
{
  "name": "api",
  "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/orders/api@sha256:9f86d0...",
  "user": "1000",
  "readonlyRootFilesystem": true,
  "linuxParameters": {
    "capabilities": { "drop": ["ALL"] }
  },
  "mountPoints": [{ "sourceVolume": "tmp", "containerPath": "/tmp" }]
}
```

On Fargate, `capabilities.add` accepts only `SYS_PTRACE`, so a non-root container can't be given `NET_BIND_SERVICE` to listen on a port below 1024. The simplest route is a high port such as 8080, with the load balancer's listener on 443. On EKS, the Kubernetes **restricted** Pod Security Standard, enforced per namespace, requires most of the same settings.

Smaller images help too. A slim or distroless base image carries fewer packages, so it has fewer findings and gives an attacker fewer tools. A distroless image has no shell or package manager, which also means no `curl` for a container health check and no shell to open with ECS Exec. A multi-stage build keeps compilers and build tools out of the final image.

The rest of a container's defenses sit outside this guide's scope. Detecting malicious behavior in running containers is GuardDuty Runtime Monitoring, which runs an agent in each task or on each node. Secrets reach an ECS container through the task definition's `secrets` field, fetched with the execution role at startup, or reach a pod through an EKS secrets integration. They never belong in an image, where anyone who can pull it can read every layer.

---

## What ECR Costs

In US East (N. Virginia):

| Item | Price |
|---|---|
| Standard storage | $0.10 per GB-month |
| Archive storage | $0.10 per GB-month for the first 150 TB, $0.07 above, with a 90-day minimum and $0.03 per GB retrieved |
| Data transfer to AWS compute in the same Region | Free |
| Data transfer to another Region or the internet | Internet data transfer out rates. Replication is charged at the source Region's rate |
| Basic scanning | Free |
| Enhanced scanning | Inspector pricing (see above), or Security Hub Essentials when Security Hub is enabled |
| Managed signing | $0.02 per signature |
| Pull through cache, replication, repository creation | Billed only as the storage and data transfer they cause |

Storage is usually the line that grows, because it accumulates quietly. A repository holding 500 images of 1.5 GB each costs about $75 a month, and a lifecycle policy keeping the newest 30 cuts that to about $4.50. Layers shared between images in one repository are stored once, so real sizes are often smaller than image sizes suggest, and blob mounting extends that sharing across repositories. Replication multiplies storage by the number of destinations, so replicate the repositories that run in each Region, not the whole registry.

Transfer is the line that surprises. Pulls from another Region pay cross-Region transfer on every pull, and pulls from private subnets without the S3 gateway endpoint pay NAT gateway processing on every layer.

---

## Common Pitfalls

- **Private subnets without the S3 gateway endpoint.** Token and manifest calls succeed through the interface endpoints, then layers fail to download, or flow through a NAT gateway at per-GB cost.
- **Deploying mutable tags.** A task definition that references `:latest` runs whatever that tag points at when each task starts, so tasks in one service can run different images. Deploy by digest, or by immutable tags.
- **Lifecycle rules that expire what matters.** A branch rule written before the release rule, a pattern list that needs every pattern to match, or an untagged rule that removes images still referenced by a deployment all delete more or less than intended. Preview before applying, and give release images a high-priority rule of their own.
- **Assuming replication covers everything.** Only images pushed after it is configured replicate, repository policies and lifecycle policies don't replicate at all, and destination repositories get default settings unless a creation template matches.
- **Scanning with nobody reading.** Findings pile up in ECR while the same images keep running. Route critical findings on in-use images to an owner, and gate the pipeline on fixable ones.
- **Signing without verifying.** A signature nothing checks protects nothing. Add the admission controller or deployment hook in the same change that turns on signing.
- **Credentials in image layers.** A secret added in one layer and deleted in the next is still in the first layer, readable by anyone who can pull the image.

---

## Key Takeaways

- An ECR registry is per account and per Region. Scanning, replication, pull through cache, templates, and signing are registry settings configured in each Region. Tag mutability, encryption, and lifecycle policies are set per repository.
- Cross-account pulls need an allow in the repository policy and in the pulling account. `aws:PrincipalOrgID` shares a repository with a whole organization.
- A private pull needs `ecr.api` and `ecr.dkr` interface endpoints and an S3 gateway endpoint for layers.
- Deploy by digest or immutable tag. Immutability exclusions keep convenience tags movable.
- Lifecycle policies expire images by count or age, and archive them by count, age, or last pull. One rule acts on each image, in priority order. Archive takes images out of the image quota and scanning, costs the same as standard below 150 TB, and makes them unpullable until restored.
- Replication copies new pushes to other Regions and accounts, and creation templates give the repositories ECR creates the right settings. Pull through cache takes the runtime dependency off public registries.
- Basic scanning is free and covers OS packages. Enhanced scanning uses Inspector for OS and language packages, rescans continuously, and shows which images are running.
- Managed signing signs on push through AWS Signer, and verification happens at admission on EKS or in a deployment hook on ECS.
- Run containers as non-root with a read-only root file system and all capabilities dropped. Detection at runtime and secret delivery belong to GuardDuty and the task definition.
{% endraw %}
