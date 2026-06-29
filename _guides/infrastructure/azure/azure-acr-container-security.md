---
title: "Azure Container Registry & Container Security"
layout: guide
category: Azure
subcategory: Container Orchestration (Advanced)
description: "Azure Container Registry tiers and geo-replication, image scanning with Defender for Containers, content trust and signing, and supply chain security patterns for containerized workloads"
tags: [azure, cloud-computing, security, infrastructure, devops, containers, practical]
---

## What Is Azure Container Registry

An [Azure Container Registry](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-intro){:target="_blank" rel="noopener noreferrer"} (ACR) stores container images that you deploy to Azure Container Instances, Azure Kubernetes Service (AKS), or any Docker-compatible runtime. Unlike Docker Hub or other public registries, ACR is private, integrated with Azure identity services, and provides vulnerability scanning built into the service.

ACR is scoped to a single Azure region by default, but you can enable geo-replication to replicate images to multiple regions for reduced latency, local redundancy, and disaster recovery.

### What Problems ACR Solves

**Without a private registry:**
- Container images flow through untrusted public registries, exposing source code and dependencies
- No scanning for vulnerabilities before images reach production
- No control over where images are stored or replicated
- No audit trail of image pulls and pushes
- No ability to enforce image signing or verify provenance

**With ACR:**
- Images stored in a private, managed registry with access control
- Automatic vulnerability scanning integrated with Microsoft Defender for Containers
- Geo-replication for multi-region deployments with local image caches
- Complete audit logs of image operations
- Content trust and image signing to prevent unauthorized or tampered images
- Integration with Azure Pipelines and GitHub Actions for automated builds and image scanning in CI/CD

### How ACR Differs from AWS ECR

Architects familiar with AWS should note several important differences:

| Concept | AWS ECR | Azure ACR |
|---------|---------|----------|
| **Image scanning** | Provided via Amazon Inspector as a separate service with additional costs | Built into ACR and integrated with Defender for Containers |
| **Geo-replication** | Manual setup with replication rules through AWS and additional data transfer costs | Native geo-replication with automatic regional replicas and no intra-region data transfer charges |
| **Image signing** | Requires AWS Signer service as a separate service with limited integration | Native Notary v2 support (notation) for content trust, integrated into image metadata |
| **Repository quotas** | Soft limits enforced per account; can be increased | Fixed by tier (Basic, Standard, Premium) |
| **Artifact types** | Docker images and OCI artifacts | Docker images, OCI artifacts, Helm charts, SBOM (Software Bill of Materials) |
| **On-premises integration** | ECR Anywhere (limited support) | ACR works with any Docker-compatible runtime, local development to AKS |
| **Network isolation** | VPC endpoints for private access | Private endpoints via Azure Private Link |
| **Build service** | AWS CodeBuild (separate) | ACR Tasks (integrated) |

---

## ACR Tiers and Capabilities

Azure Container Registry offers three tiers, each optimized for different workload sizes and performance requirements.

### Basic Tier

The Basic tier is suitable for learning, small projects, and development environments.

**Characteristics:**
- 10 GiB storage included
- Upload/download throughput: 10 Mbps
- Webhooks: 2
- Geo-replication: Not supported
- Private endpoint: Not supported
- Image scanning: Available but basic
- Retention policies: Not supported
- Cost: Lowest tier, hourly charge

**When to use:**
- Development and testing
- Personal projects
- Proof of concepts

**Limitation:** Basic tier's throughput limit (10 Mbps) becomes a bottleneck for large-scale image pulls during AKS scale-up events or during automated image rebuilds.

---

### Standard Tier

The Standard tier balances features and cost for small-to-medium production workloads.

**Characteristics:**
- 100 GiB storage included
- Upload/download throughput: 60 Mbps
- Webhooks: 10
- Geo-replication: Supported
- Private endpoint: Supported
- Image scanning: Full integration with Defender for Containers
- Retention policies: Supported
- ACR Tasks: Supported

**When to use:**
- Small production deployments
- Multi-region deployments with moderate image pull volume
- Teams deploying to AKS with fewer than 100 nodes

**Trade-offs:** Standard tier's 60 Mbps throughput is often sufficient for moderate workloads, but large AKS clusters pulling many images simultaneously can experience contention.

---

### Premium Tier

The Premium tier is designed for large-scale production deployments and enterprises requiring maximum performance and security.

**Characteristics:**
- Unlimited storage (4,000 repositories per registry)
- Upload/download throughput: 500 Mbps (10x Standard)
- Webhooks: 500
- Geo-replication: Full multi-region support with automatic replication
- Private endpoint: Supported with no throughput impact
- Image scanning: Full integration with Defender for Containers
- Retention policies: Supported with fine-grained control
- ACR Tasks: Supported with advanced parallelization
- Artifact streaming: Enabled for faster container startup
- VNet integration: Service endpoint and private endpoint support

**When to use:**
- Large production clusters (500+ nodes)
- High-frequency image deployments (continuous delivery)
- Compliance-sensitive workloads requiring maximum control
- Organizations with multi-region Kubernetes deployments
- Workloads requiring artifact streaming to reduce container startup time

**Premium tier cost:** Hourly subscription cost is higher but justified by the eliminated throughput bottleneck and geo-replication features that would otherwise require manual replication infrastructure.

### Comparing Tiers

| Capability | Basic | Standard | Premium |
|-----------|-------|----------|---------|
| **Storage** | 10 GiB | 100 GiB | Unlimited |
| **Throughput** | 10 Mbps | 60 Mbps | 500 Mbps |
| **Geo-replication** | No | Yes | Yes (optimized) |
| **Private endpoints** | No | Yes | Yes |
| **Retention policies** | No | Yes | Yes |
| **Image scanning** | Yes (basic) | Yes (full) | Yes (full) |
| **Artifact streaming** | No | No | Yes |

---

## Geo-Replication for Multi-Region Deployments

### What Geo-Replication Does

[Geo-replication](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-geo-replication){:target="_blank" rel="noopener noreferrer"} automatically replicates images from your primary ACR to secondary registries in other Azure regions. This reduces image pull latency for AKS clusters and container instances deployed across regions.

### How Geo-Replication Works

1. You configure secondary regions in your primary ACR
2. When you push an image to the primary registry, Azure automatically pushes it to all secondary registries
3. Each region maintains a local replica of all images
4. AKS clusters and other services in each region pull images from the local regional replica instead of the primary registry
5. The image becomes available in the secondary registry immediately after the push completes

### Benefits of Geo-Replication

**Reduced latency:** Clusters pull images from a local regional replica instead of the primary registry across the internet.

**Disaster recovery:** If the primary region becomes unavailable, secondary registries continue to serve images to workloads in other regions. This does not provide failover, so the image must already exist in the secondary registry before the primary region fails.

**Compliance and data residency:** You can replicate images only to specific regions to meet data residency requirements.

**No inter-region data transfer charges:** Replication traffic between ACR replicas does not incur data transfer costs (unlike egress charges in AWS).

### Geo-Replication Configuration

When you enable geo-replication on a Standard or Premium ACR:

```
Primary ACR (East US) → Push image → Webhook triggers replication
  ↓
Secondary ACR (West US) - Image replicated automatically
  ↓
Secondary ACR (Europe West) - Image replicated automatically
```

Each region maintains:
- Complete image replicas
- Webhook endpoints for triggering additional actions (e.g., notifying AKS to pull new version)
- Independent authentication and authorization (though usually configured identically)

### Geo-Replication Considerations

**Replication latency:** Large images take time to replicate across regions. During the replication window, the image is available in the primary region but not yet in secondaries. Plan image pushes before peak deployment windows.

**Consistency:** All regions eventually have the same image content, but there is a brief window where images in secondary regions lag behind the primary. For critical deployments, verify the image exists in the target region before deploying.

**Selective replication:** You can configure ACR to replicate only specific images to specific regions using content filters, useful for compliance requirements.

---

## Image Scanning and Vulnerability Assessment

### Microsoft Defender for Containers

[Microsoft Defender for Containers](https://learn.microsoft.com/en-us/azure/defender-for-cloud/defender-for-containers-introduction){:target="_blank" rel="noopener noreferrer"} provides vulnerability scanning for images stored in ACR. Every image is scanned for known vulnerabilities (CVEs) from Microsoft and other threat intelligence sources.

### How Scanning Works

**On image push:**
1. When you push an image to ACR, a webhook triggers vulnerability scanning
2. The image layers are analyzed against vulnerability databases
3. Scan results appear in the Azure portal within minutes
4. If vulnerabilities are found, they are displayed with severity ratings and remediation guidance

**Continuous scanning:**
- Previously scanned images are re-scanned periodically (monthly by default) as new vulnerability data becomes available
- If a new vulnerability is discovered in an image layer, you are notified even if the image was clean when originally pushed

**Scope of scanning:**
- Scans detect vulnerabilities in base OS packages (Alpine, Ubuntu, Debian, CentOS, etc.)
- Scans detect vulnerabilities in common application frameworks and libraries
- Results include the layer in which the vulnerability appears and the package affected

### Vulnerability Severity Levels

Vulnerabilities are classified by CVSS (Common Vulnerability Scoring System) score:

| Severity | CVSS Score | Typical Impact |
|----------|-----------|----------------|
| **Critical** | 9.0-10.0 | Immediate patch required; exploitable without authentication |
| **High** | 7.0-8.9 | Patch required before production; likely exploitable |
| **Medium** | 4.0-6.9 | Plan to patch; less likely to be exploited |
| **Low** | 0.0-3.9 | Monitor and patch during regular maintenance |

### Vulnerability Assessment Workflow

**1. Image push and scan:**
```
Developer pushes image → ACR scans → Results in portal
```

**2. Review findings:**
- Critical and high-severity vulnerabilities should be addressed before deployment
- Medium and low vulnerabilities can be accepted as risk or mitigated through admission controllers

**3. Remediation options:**
- Update the base image to a patched version
- Update the application framework or dependency to a patched version
- Rebuild the image with the updated layers and re-push

**4. Admission control (optional):**
- Use Kubernetes admission controllers (Pod Security Admission, Kyverno) to prevent deployment of images with critical vulnerabilities
- ACR does not block vulnerable image deployments automatically; policy enforcement is the administrator's responsibility

### Scanning Integration with ACR Tasks

When using ACR Tasks for automated builds, you can configure tasks to fail if scan results contain vulnerabilities above a threshold. This prevents vulnerable images from being stored in the registry.

---

## Content Trust and Image Signing

### What Image Signing Does

Image signing ensures that an image has not been tampered with and provides a chain of trust from the build system to deployment. When you sign an image, you add cryptographic proof that the image came from an authorized builder and has not been modified.

### Notary v2 and Notation

Azure supports [Notary v2 and notation](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-tutorial-sign-build-push){:target="_blank" rel="noopener noreferrer"} for content trust. Notation is a toolset that allows you to sign images and store signatures alongside the image in ACR.

**Key concepts:**

**Image signature:** A cryptographic proof attached to an image that verifies:
- The identity of the signer (which build system or developer signed it)
- That the image has not been modified since signing
- When the image was signed

**Trust on first use (TOFU):** Before accepting a signed image, you must configure a signing key as trusted. After that, any image signed with that key is accepted.

**Signature verification:** When pulling an image, the container runtime or Kubernetes admission controller can verify that the image signature is valid and signed by a trusted key.

### Setting Up Image Signing

**1. Create signing keys:**
```
Generate a cryptographic key pair (private key kept secure, public key distributed)
```

**2. Sign images after build:**
```
Build image → Push to ACR → Sign with notation → Store signature in ACR
```

**3. Configure verification:**
```
Kubernetes admission controller or container runtime checks signature before deploying
```

### Image Signing Workflow

For a typical CI/CD pipeline:

1. **Build stage:** Build system creates image and pushes to ACR
2. **Sign stage:** Signing tool (notation) signs the image using the private key stored in a secure key vault
3. **Signature stored:** Signature is stored in ACR alongside the image (not embedded in the image itself)
4. **Deploy stage:** Admission controller verifies the signature before allowing deployment
5. **Runtime verification:** Container runtime confirms the image signature matches

### Signing Keys and Key Management

The private signing key must be:
- Generated and stored securely (e.g., in Azure Key Vault)
- Used only by authorized systems (CI/CD pipeline, not human developers)
- Rotated periodically (annually or when access is compromised)
- Never stored in the source repository

The public key must be:
- Distributed to all clusters that need to verify images
- Configured as trusted in admission controllers
- Rotated when the private key is rotated

### When to Require Signed Images

**Enterprise and compliance-sensitive workloads:**
- Regulated industries (finance, healthcare, government)
- Multi-tenant systems where image provenance is audited
- Organizations with strict change control processes

**Not required for:**
- Development and testing environments
- Internal teams with high trust and low risk tolerance
- Workloads where image content is less critical

---

## ACR Tasks for Automated Image Building

### What ACR Tasks Does

[ACR Tasks](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-tasks-overview){:target="_blank" rel="noopener noreferrer"} is a suite of features that automate image building, scanning, and pushing without managing build infrastructure.

### Quick Tasks

Quick tasks build and push an image from source code in a single command, without persisting the build configuration.

**Characteristics:**
- Run on-demand from the Azure CLI or portal
- Do not require a Git repository webhook
- Build output is a Docker image stored in ACR
- Results include scan data if vulnerabilities are found

**Use cases:**
- One-off builds for testing
- Building images from local source code
- Quick verification that a Dockerfile works

### Multi-Step Tasks

Multi-step tasks define a sequence of build, test, and push operations in a YAML configuration stored in your Git repository.

**Characteristics:**
- Triggered automatically by Git commits, pull requests, or schedule
- Can build multiple images from a single task
- Can run commands between build steps (e.g., running tests)
- Can conditionally execute steps based on build parameters
- Task YAML is versioned alongside your source code

**Example multi-step task workflow:**

```
On Git push:
  1. Build base image from Dockerfile.base
  2. Build app image from Dockerfile.app
  3. Run security scan and check for critical vulnerabilities
  4. If scan passes, push both images to ACR
  5. Trigger webhook to notify Kubernetes of new images
```

### Triggered Builds

Automatic builds trigger when:
- **Git commit:** Push to a specific branch automatically builds
- **Pull request:** Opening a pull request builds a preview image
- **Schedule:** Builds run on a cron schedule (e.g., nightly rebuild to pick up OS patches)
- **Base image update:** When the base image (e.g., `mcr.microsoft.com/windows/servercore`) is updated, dependent images rebuild automatically

### ACR Tasks Performance

Tasks run on Azure-managed infrastructure (build agents in various SKUs). For Premium ACR, you can enable parallel builds to speed up multi-image tasks.

---

## Repository and Image Lifecycle Management

### Retention Policies

[Retention policies](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-retention-policy){:target="_blank" rel="noopener noreferrer"} automatically delete images based on age or tag patterns, preventing registry bloat and reducing storage costs.

**Retention policy rules:**
- Delete images older than X days
- Delete images with specific tag patterns (e.g., delete all `pr-*` tags)
- Keep the last N images of a repository
- Exclude specific images from deletion (e.g., always keep `latest`)

**Retention policy workflow:**

```
ACR scans all images → Matches rule criteria → Deletes matching images
```

### Image Quarantine

Image quarantine flags new or suspicious images for review before they are considered production-ready. This is a manual process where administrators review scans and approve or reject images.

**Quarantine workflow:**

1. Image is pushed and scanned
2. If vulnerabilities are found, the image is tagged with a quarantine label (e.g., `quarantine`)
3. Administrators review the vulnerabilities and remediation plan
4. Administrators either retag as approved or delete the quarantine image
5. Only approved images are available for deployment

### Repository Lifecycle Example

A typical image lifecycle in production:

```
Build → ACR push → Scan → Tag as 'candidate' → Quarantine review → Approved → Tag as 'stable'
                                                                          ↓
                                                         Deploy to prod → Geo-replicate → Available in regions
                                                                          ↓
                                         Days later → Tag as 'archive' → Eventually deleted by retention policy
```

---

## Authentication and Authorization

### Registry-Level Authentication

When pulling images from ACR, you must authenticate with credentials scoped to the registry.

**Authentication methods:**

| Method | Use Case |
|--------|----------|
| **Managed identity (recommended)** | AKS pods, App Service, Automation Account; no secrets to manage |
| **Service principal** | CI/CD pipelines, external systems; uses client ID and secret |
| **Admin account** | Development and debugging only; not for production |
| **Personal access token** | Legacy integrations and scripting (deprecated, use managed identity instead) |

### Managed Identity Integration

When AKS runs on Azure, use [managed identity](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-authentication-managed-identity){:target="_blank" rel="noopener noreferrer"} to authenticate to ACR without storing credentials in pod specifications.

**How it works:**

1. Create a managed identity (system-assigned or user-assigned)
2. Grant the identity pull permissions on the ACR using RBAC
3. Configure AKS to use the managed identity (kubelet identity)
4. Pods automatically authenticate to ACR without explicit credentials

**Benefits:**
- No secrets stored in pod specs, Helm values, or configuration files
- Identity is rotated automatically by Azure
- Audit logs show which pod pulled which image
- Seamless integration with AKS

### Repository-Scoped Access Tokens

[Repository-scoped tokens](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-repository-scoped-permissions){:target="_blank" rel="noopener noreferrer"} limit access to specific repositories within a registry, reducing the blast radius if a token is compromised.

**Use cases:**
- CI/CD pipeline that builds and pushes to only one repository
- Third-party services that need pull-only access to specific images
- Granting different permissions to different teams

**Token permissions:**
- `pull` - Only read/pull images (typical for production deployments)
- `push` - Create and push images (typical for CI/CD build systems)
- `delete` - Remove images and repositories

### RBAC (Role-Based Access Control)

ACR integrates with Azure RBAC to assign roles at the registry level:

| Role | Permissions | Use Case |
|------|-----------|----------|
| **AcrPull** | Pull images | Production deployments, read-only access |
| **AcrPush** | Push and pull | CI/CD build systems |
| **AcrDelete** | Delete images and repositories | Administrators managing retention |
| **AcrImport** | Import images from external registries | Admins migrating from Docker Hub |

---

## Private Endpoints and Network-Restricted Registries

### What Private Endpoints Do

[Private endpoints](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-private-link){:target="_blank" rel="noopener noreferrer"} provide a private IP address for ACR within your VNet, so image pulls do not traverse the public internet.

### When to Use Private Endpoints

**Compliance and security-sensitive workloads:**
- Images must not traverse the public internet
- Regulatory requirements mandate network isolation
- Internal images contain proprietary or sensitive intellectual property

**Network isolation patterns:**
- AKS cluster with all nodes in a private subnet (no public IP)
- All image pulls routed through the private endpoint (no egress to the internet)
- ACR's public endpoint can be disabled entirely

### Disabling the Public Endpoint

For maximum security, you can disable ACR's public endpoint entirely, allowing access only through private endpoints.

**Trade-offs of disabling the public endpoint:**
- Image builds via ACR Tasks must run in a delegated subnet or private environment
- External integrations (CI/CD platforms hosted outside Azure) cannot push images unless they have VNet connectivity
- Developers building images locally must use VPN or ExpressRoute to access the registry

---

## Supply Chain Security Patterns

### Pattern 1: Signed Images with Automated Admission Control

**Goal:** Ensure only images signed by the official build pipeline can be deployed.

**Components:**
1. **Build system** signs images with a key stored in Azure Key Vault
2. **ACR** stores signed images with signature metadata
3. **Kubernetes admission controller** (e.g., Kyverno or Kyverno + notation) enforces signature verification
4. **Deployment fails** if the image signature is missing or invalid

**Implementation:**
- Store signing key in Azure Key Vault
- Configure CI/CD pipeline to sign images using notation after build
- Deploy Kyverno in AKS with a policy requiring valid image signatures
- Only images signed by the trusted key can be deployed

**Trade-off:** Developers building images locally cannot deploy without signing, slowing down rapid development cycles. This pattern is best reserved for production clusters.

---

### Pattern 2: Image Scanning with Automatic Rejection

**Goal:** Prevent deployment of images with critical vulnerabilities.

**Components:**
1. **ACR** scans images automatically on push
2. **Build system** checks scan results before marking image as deployable
3. **Admission controller** blocks images with unresolved critical vulnerabilities
4. **Pipeline fails** if scan results exceed threshold

**Implementation:**
- Configure ACR Tasks to fail if Defender for Containers finds critical vulnerabilities
- Use an admission controller to prevent deployment of images tagged with `vulnerability=critical`
- Images tagged `approved` can bypass the policy if remediation is documented

**Trade-off:** Balance between security and delivery speed. Critical vulnerabilities should always block deployment, but medium and low vulnerabilities can be accepted with risk documentation.

---

### Pattern 3: Multi-Registry Segmentation by Environment

**Goal:** Separate development, staging, and production images to limit blast radius of compromised images.

**Components:**
1. **Development ACR**: Stores all build artifacts with less restricted scanning
2. **Staging ACR**: Contains only promoted images with stricter scanning and signing
3. **Production ACR**: Contains only signed, fully scanned, approved images with geo-replication

**Promotion workflow:**
```
Develop → Dev ACR → Scan → Pass? → Staging ACR → Sign → Prod ACR → Deploy
```

**Benefits:**
- Isolates the blast radius of a compromised development image
- Forces deliberate promotion steps
- Each registry has different access controls and policies

---

## Artifact Streaming

### What Artifact Streaming Does

[Artifact streaming](https://learn.microsoft.com/en-us/azure/container-registry/artifact-streaming){:target="_blank" rel="noopener noreferrer"} allows containers to start before all image layers are downloaded. This is particularly useful for large images (2+ GB) where full download delays container startup.

**How it works:**
1. Image layers are stored in ACR with special streaming metadata
2. Container runtime downloads layers on-demand as the container accesses files
3. Container starts while missing layers are still downloading
4. Layers are cached locally after first access

### Benefits

**Reduced startup time:** Containers start within seconds instead of minutes, even for large images.

**Improved scalability:** AKS clusters scale up faster because new pods start immediately without waiting for full image download.

**Reduced bandwidth:** Only layers that are actually accessed are downloaded (unused code paths are never transferred).

### Trade-offs

**Network latency:** If a container accesses data from a layer that has not been downloaded yet, there is a latency penalty. This is acceptable for startup-critical code but problematic for frequently accessed deep layers.

**Limited support:** Artifact streaming requires Premium ACR and container runtimes that support streaming (containerd 1.7+, which is standard in modern Kubernetes versions).

---

## Common Pitfalls

### Pitfall 1: Not Enabling Geo-Replication Before Multi-Region Deployment

**Problem:** Pushing images to a primary ACR without enabling geo-replication, then deploying AKS clusters in secondary regions. Each region pulls images from the primary region across the internet.

**Result:** High latency for image pulls, higher bandwidth costs, and poor deployment performance during scale-up events when many nodes pull images simultaneously.

**Solution:** Enable geo-replication on Standard or Premium ACR when you plan multi-region deployments. This ensures local image replicas are available in each region before deploying clusters.

---

### Pitfall 2: Pushing Vulnerable Images to Production

**Problem:** Ignoring scan results that show critical vulnerabilities in images. The image is pushed to ACR despite known CVEs.

**Result:** Production containers run known vulnerable code. Exploits become available before you patch. Compliance audits fail.

**Solution:** Fail the build pipeline if scan results exceed a critical vulnerability threshold. For images already in production, set up alerts for new vulnerabilities discovered during continuous scanning and patch immediately.

---

### Pitfall 3: Using Admin Account Instead of Managed Identity

**Problem:** Configuring AKS imagePullSecrets with the ACR admin account credentials instead of using managed identity. Credentials are stored in pod specs, Helm values, or etcd.

**Result:** Credentials can be discovered through configuration inspection. Rotating the admin password requires updating secrets in all deployments. No audit trail of which pod pulled which image.

**Solution:** Use managed identity for AKS-to-ACR authentication. This eliminates secrets entirely and provides automatic credential rotation.

---

### Pitfall 4: Storage Bloat from Unmanaged Image Lifecycle

**Problem:** Pushing images without retention policies or quarantine. Build pipelines push dozens of images per day, and no cleanup ever occurs.

**Result:** ACR storage grows unbounded. Costs increase. Image discovery becomes difficult. Old images with security issues remain accessible.

**Solution:** Implement retention policies to delete images older than 90 days (or your organization's retention requirement). Exclude only critical production images from deletion. Clean up build artifacts (`pr-*`, `tmp-*`, `test-*` tags) aggressively.

---

### Pitfall 5: Scanning Only at Push Time

**Problem:** Configuring image scanning to run only when the image is pushed. No continuous re-scanning of existing images.

**Result:** New vulnerabilities discovered weeks after push are never detected. Production images running known vulnerabilities go unpatched.

**Solution:** Enable continuous scanning (re-scan existing images monthly or more frequently). Set up alerts for new critical vulnerabilities in images deployed to production. Establish a patching SLA (e.g., critical vulnerabilities patched within 48 hours).

---

### Pitfall 6: Trusting Signed Images Without Validation

**Problem:** Implementing image signing but not configuring admission controllers to actually verify signatures. Any image with a signature is allowed, regardless of which key signed it.

**Result:** Signing provides a false sense of security. Compromised images can be signed with the attacker's key.

**Solution:** Configure strict admission controller policies that require signatures from only specific trusted keys. Regularly audit signing keys and rotate them when access is compromised.

---

## Key Takeaways

1. **Choose the right ACR tier based on scale.** Basic is sufficient for development. Standard works for small-medium production workloads. Premium is necessary for large-scale deployments, high-frequency image pulls, and multi-region deployments.

2. **Enable geo-replication for multi-region deployments.** Images replicate automatically to secondary regions, eliminating cross-region pull latency and reducing bandwidth costs. Plan multi-region deployments before they are needed.

3. **Scan images automatically and act on critical vulnerabilities.** Enable Defender for Containers, configure scan failures to block vulnerable images from production, and set up continuous scanning for new vulnerabilities in existing images.

4. **Use managed identity for AKS-to-ACR authentication.** This eliminates secrets entirely, provides automatic credential rotation, and enables audit trails. Avoid storing credentials in pod specs or configuration files.

5. **Implement content trust with image signing for sensitive workloads.** Use Notary v2 and notation to sign images with a key stored in Key Vault. Configure admission controllers to verify signatures before allowing deployment.

6. **Manage image lifecycle with retention policies.** Delete old images automatically to prevent storage bloat. Exclude only critical production images from deletion.

7. **Use Private Endpoints for compliance-sensitive workloads.** Private endpoints ensure image pulls do not traverse the public internet. Disable the public endpoint entirely if compliance requirements demand network isolation.

8. **Segment registries by environment for defense in depth.** Separate development, staging, and production registries with different access controls and scanning policies.

9. **Use artifact streaming in Premium ACR for large images.** Containers start faster when layers are downloaded on-demand instead of waiting for full image transfer.

10. **Registry security is part of the supply chain.** A secure registry is worthless without secure build processes, admission control, and runtime protection. Integrate ACR with Defender for Containers and admission controllers to enforce policy end-to-end.
