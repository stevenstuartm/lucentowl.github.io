---
title: "Azure App Service for System Architects"
layout: guide
category: Azure
subcategory: Compute Services
description: "App Service fundamentals for architects including App Service Plans, deployment slots, scaling strategies, WebJobs, and PaaS hosting patterns for web applications and APIs on Azure."
tags: [infrastructure, azure, cloud-computing, scalability, reliability, practical]
---

## What Is Azure App Service

[Azure App Service](https://learn.microsoft.com/en-us/azure/app-service/overview){:target="_blank" rel="noopener noreferrer"} supports multiple language runtimes including .NET, Java, Node.js, Python, PHP, and Ruby, and also supports custom container deployments for workloads that need full control over the runtime environment. It runs on Windows or Linux, provides built-in CI/CD integration, authentication, SSL/TLS termination, custom domains, and automatic patching of the underlying OS and runtime.

App Service is one of Azure's oldest and most mature services. It represents the PaaS sweet spot between infrastructure-level control (Virtual Machines) and event-driven serverless (Azure Functions), offering a persistent hosting environment with minimal operational overhead.

### What Problems App Service Solves

**Without App Service (managing your own infrastructure):**
- Teams provision and patch VMs, configure web servers, manage OS updates and security patches
- Load balancing, SSL certificate management, and custom domain configuration require manual setup
- Scaling requires configuring VM Scale Sets, health probes, and auto-scale rules at the infrastructure level
- Blue-green deployments require building custom traffic routing and instance management
- CI/CD pipelines must handle infrastructure concerns alongside application deployment

**With App Service:**
- Infrastructure is fully managed; OS patching, runtime updates, and load balancing happen automatically
- Built-in SSL/TLS with free managed certificates and custom domain mapping
- Scaling (both vertical and horizontal) through the App Service Plan without touching infrastructure
- Deployment slots provide built-in staging environments with traffic routing and warm swap
- Native integration with GitHub Actions, Azure DevOps, and local Git for streamlined CI/CD
- Built-in authentication (Easy Auth) that adds identity providers without code changes

### How App Service Differs from AWS

There is no single AWS service that directly maps to Azure App Service. App Service combines aspects of several AWS services, and the PaaS integration depth differs significantly.

| Concept | AWS Equivalent(s) | Azure App Service |
|---------|-------------------|-------------------|
| **PaaS web hosting** | Elastic Beanstalk (closest match) | App Service with managed plans |
| **Container-based PaaS** | App Runner | App Service with custom containers |
| **Static site hosting** | Amplify Hosting | Azure Static Web Apps (related service) |
| **Deployment model** | EB uses environment-level deploys | Deployment slots with warm swap |
| **Canary deployments** | EB environment traffic splitting | Slot traffic routing (percentage-based) |
| **Background tasks** | No built-in equivalent (use SQS + Lambda) | WebJobs (integrated into the same plan) |
| **Built-in auth** | Cognito + ALB integration | Easy Auth (zero-code identity provider integration) |
| **Scaling unit** | EB environment instances | App Service Plan instances (shared across apps) |
| **Network isolation** | EB in VPC | VNet integration (Standard+) or ASE for full isolation |
| **Managed SSL** | ACM (free, must be in us-east-1 for CloudFront) | Free managed certificates, auto-rotating, no region restriction |

Elastic Beanstalk is the closest AWS equivalent, but it operates at a lower abstraction level. EB provisions actual EC2 instances, load balancers, and auto-scaling groups that you can see and modify. App Service abstracts all of this away; there are no visible VMs, no load balancer resources to manage, and no EC2 instance types to select. The trade-off is that EB offers more customization of the underlying infrastructure while App Service prioritizes operational simplicity.

---

## App Service Plans

### How Plans Work

An [App Service Plan](https://learn.microsoft.com/en-us/azure/app-service/overview-hosting-plans){:target="_blank" rel="noopener noreferrer"} defines the compute resources that host your applications. Every App Service app runs inside a plan, and the plan determines the VM size, available features, scaling capabilities, and cost.

The plan is the scaling unit, not the individual app. When you scale out an App Service Plan to three instances, every app in that plan runs on all three instances. When you scale up to a larger SKU, every app in the plan gets the larger VM.

Multiple apps can share a single plan. This is cost-efficient for lightweight apps that do not individually need dedicated resources. However, apps in the same plan compete for the same CPU, memory, and network bandwidth, so a resource-hungry app can starve its neighbors.

### Plan Tiers

App Service Plans are organized into tiers that determine the available features and performance characteristics. Each tier targets a different workload profile.

| Tier | Target Workload | Auto-Scale | Deployment Slots | VNet Integration | Custom Domains / SSL | SLA |
|------|----------------|------------|-----------------|-----------------|---------------------|-----|
| **Free (F1)** | Learning, prototyping | No | No | No | No custom domains | None |
| **Shared (D1)** | Low-traffic dev/test | No | No | No | Custom domains, no SSL | None |
| **Basic (B1-B3)** | Dev/test, low-traffic production | No (manual scale only) | No | No | Yes | 99.95% |
| **Standard (S1-S3)** | Production workloads | Yes (up to 10 instances) | Up to 5 | Regional VNet integration | Yes | 99.95% |
| **Premium v3 (P0v3-P3mv3)** | High-performance production | Yes (up to 30 instances) | Up to 20 | Regional VNet integration | Yes | 99.95% |
| **Isolated v2 (I1v2-I6v2)** | Compliance, full network isolation | Yes (up to 100 instances) | Up to 20 | ASE (dedicated VNet deployment) | Yes | 99.95% |

<div class="callout callout--note">
<p class="callout__title">Scaling Limits Are Per Plan</p>
<p>The maximum instance count applies to the plan, not to individual apps. A Standard plan can scale to 10 instances, and all apps in the plan run on all 10 instances. If you need different scaling profiles for different apps, place them in separate plans.</p>
</div>

### Choosing a Tier

**Free and Shared** exist for experimentation and very lightweight internal tools. They run on shared infrastructure with other tenants' apps and have CPU quotas that throttle your app when exceeded. Neither provides an SLA.

**Basic** is the entry point for apps that need dedicated compute and custom SSL, but do not need auto-scaling or deployment slots. It suits internal tools and dev/test environments where manual scaling is acceptable.

**Standard** is the starting point for most production workloads. It adds auto-scaling, deployment slots, and VNet integration, which are the features that separate "running an app" from "running a production service." Standard should be the default choice unless you have specific reasons to go higher or lower.

**Premium v3** provides faster processors, more memory per instance, and higher instance limits than Standard. It also supports predictive autoscaling (which uses machine learning to pre-scale based on historical traffic patterns), larger deployment slot counts, and enhanced networking performance. Premium v3 costs roughly 2-3x more than Standard for equivalent instance sizes, but the performance improvement is often more than proportional because the underlying hardware is newer.

**Isolated v2** deploys your apps into a dedicated [App Service Environment](#app-service-environment-v3) inside your own VNet. It provides full network isolation, the highest scale limits (up to 100 instances), and is required for workloads with strict compliance requirements that mandate single-tenant infrastructure. Isolated v2 carries a significant minimum monthly cost because you are paying for dedicated infrastructure even at low utilization.

### Cost Optimization Strategies

**Consolidate lightweight apps on shared plans.** If you have multiple low-traffic APIs or internal tools, running them on a single Standard plan is far cheaper than giving each its own plan. Monitor CPU and memory utilization to ensure the shared plan has sufficient headroom.

**Use Free or Basic plans for dev/test environments.** There is no reason to run a development environment on Premium v3. Match the tier to the environment's purpose and traffic profile.

**Consider Reserved Instances for production.** App Service Plans support 1-year and 3-year reservations that provide significant discounts (roughly 30-55% depending on tier and commitment length) compared to pay-as-you-go pricing.

**Use Azure Hybrid Benefit for Windows workloads.** Organizations with existing Windows Server or SQL Server licenses through Software Assurance can apply those licenses to App Service Plans running Windows, reducing the effective cost.

---

## Deployment Slots

### How Slots Work

[Deployment slots](https://learn.microsoft.com/en-us/azure/app-service/deploy-staging-slots){:target="_blank" rel="noopener noreferrer"} are live instances of your app with their own hostnames. Every App Service app has a production slot by default. Standard tier and above allow you to create additional slots (staging, testing, canary) that run within the same App Service Plan.

Slots share the plan's compute resources. A staging slot runs on the same instances as the production slot, which means the staging slot is already "warm" (loaded into memory, JIT-compiled, caches populated) when you swap it into production.

### Slot Swapping

Slot swapping is the primary deployment mechanism for zero-downtime releases. When you swap the staging slot with the production slot, Azure performs a warm swap:

1. Azure applies the production slot's settings (connection strings, app settings marked as "slot settings") to the staging slot
2. Azure waits for every instance in the staging slot to restart with the new settings and respond successfully to a health check
3. Azure swaps the routing rules so that production traffic goes to the formerly-staging instances and vice versa
4. If anything goes wrong, you swap back (the old production code is still running in what is now the staging slot)

The swap is instantaneous from the user's perspective because all instances are warmed up before traffic shifts. There is no cold start, no load balancer drain wait, and no window where some instances serve old code while others serve new code.

### Slot-Specific vs Swap-Traveling Settings

App Service distinguishes between settings that stay with a slot and settings that travel with the code during a swap.

| Setting Behavior | Examples | When to Use |
|-----------------|---------|-------------|
| **Slot-specific (sticky)** | Database connection strings for staging vs production databases, feature flags, Application Insights instrumentation keys | Settings that differ between environments |
| **Swap-traveling** | Application code, general app settings, framework version | Settings that should always match the code they were deployed with |

Mark connection strings and environment-specific configuration as "slot settings" to prevent staging database connections from accidentally reaching production during a swap.

### Traffic Routing

Deployment slots support percentage-based traffic routing for canary deployments. You can route a percentage of production traffic (for example, 5%) to a staging slot while the remaining 95% continues to hit the production slot. This allows you to validate a new release with real traffic before committing to a full swap.

Traffic routing uses a cookie to ensure session consistency. Once a user is routed to a specific slot, subsequent requests from that user continue to go to the same slot for the duration of their session.

### Auto Swap

Auto swap automatically swaps a slot into production whenever code is deployed to that slot. You configure a staging slot with auto swap enabled, and every successful deployment to staging triggers an automatic swap to production after warm-up completes. This is useful for continuous deployment pipelines where every successful build should go to production.

<div class="callout callout--tip">
<p class="callout__title">Deployment Slot Strategy</p>
<p>A common production pattern uses three slots: production (live traffic), staging (next release validation), and a "last-known-good" slot that holds the previous production release. After swapping staging to production, the old production code sits in the staging slot and can be swapped back instantly if issues arise.</p>
</div>

---

## Scaling Strategies

### Scale Up vs Scale Out

App Service supports two scaling dimensions:

**Scale up (vertical scaling)** changes the App Service Plan's tier or instance size. Moving from S1 to S3, or from Standard to Premium v3, gives each instance more CPU, memory, and disk. Scale-up requires a brief restart of the plan's instances and is a manual operation (or can be scripted, but there is no auto-scale-up).

**Scale out (horizontal scaling)** adds or removes instances of the same size. A Standard S2 plan scaled to five instances runs five identical copies of your app behind the platform's built-in load balancer. Scale-out can be manual, rule-based, or predictive.

### Autoscale Rules

[Autoscale](https://learn.microsoft.com/en-us/azure/azure-monitor/autoscale/autoscale-overview){:target="_blank" rel="noopener noreferrer"} is available on Standard tier and above. It adds or removes instances based on metrics that you define, with configurable thresholds, cooldown periods, and instance limits.

**Common autoscale metrics:**

| Metric | When to Use | Typical Threshold |
|--------|------------|-------------------|
| **CPU Percentage** | CPU-bound workloads (computation, image processing) | Scale out at 70%, scale in at 30% |
| **Memory Percentage** | Memory-intensive apps (large caches, in-memory processing) | Scale out at 75%, scale in at 40% |
| **HTTP Queue Length** | Request-bound workloads (APIs under load) | Scale out when queue > 100 |
| **Data In / Data Out** | Network-bound workloads | Scale based on throughput thresholds |
| **Custom Metrics** | Application-specific signals from Application Insights | Depends on the metric |

Each autoscale rule has a scale-out action and a scale-in action with separate thresholds. The scale-in threshold should be meaningfully lower than the scale-out threshold to prevent "flapping" (rapid scaling out and back in). Cooldown periods (default 5 minutes) prevent rules from firing repeatedly before previous scaling actions take effect.

### Predictive Autoscaling

Premium v3 plans support [predictive autoscaling](https://learn.microsoft.com/en-us/azure/azure-monitor/autoscale/autoscale-predictive){:target="_blank" rel="noopener noreferrer"}, which uses machine learning to analyze historical traffic patterns and pre-scale instances before demand arrives. This is valuable for workloads with predictable traffic spikes like morning login surges, lunch-time e-commerce peaks, or batch processing windows. Predictive autoscale works alongside rule-based autoscale; the platform uses whichever produces a higher instance count.

### Per-App Scaling

By default, all apps in a plan scale together. [Per-app scaling](https://learn.microsoft.com/en-us/azure/app-service/manage-scale-per-app){:target="_blank" rel="noopener noreferrer"} allows you to limit how many instances a specific app uses within the plan. If a plan has 10 instances, you can configure a low-priority background app to use at most 2 of those 10 instances while the primary API uses all 10. Per-app scaling does not create separate instances; it controls which of the existing plan instances run a given app.

---

## Networking

### Default Networking Behavior

By default, App Service apps are publicly accessible via their `*.azurewebsites.net` hostname. Outbound traffic from the app uses a set of shared outbound IP addresses that are visible in the app's properties. There is no VNet integration at the Free, Shared, or Basic tiers.

### VNet Integration

[Regional VNet integration](https://learn.microsoft.com/en-us/azure/app-service/overview-vnet-integration){:target="_blank" rel="noopener noreferrer"} (available on Standard tier and above) connects the app's outbound traffic to a subnet in your VNet. Once configured, outbound traffic from the app uses a private IP within the delegated subnet, allowing the app to reach private resources like databases behind Private Endpoints, VMs on private subnets, or on-premises resources through VPN/ExpressRoute gateways.

VNet integration controls outbound traffic only. Inbound traffic still arrives through the public `*.azurewebsites.net` endpoint unless you configure additional controls.

**VNet integration requirements:**
- The subnet must be delegated to `Microsoft.Web/serverFarms`
- The subnet must have enough available IPs (one per plan instance, plus one for scaling headroom)
- The VNet must be in the same region as the App Service Plan

For a detailed explanation of subnet delegation and VNet design patterns, see the [Azure VNet Architecture](/study-guides/infrastructure/azure/azure-vnet-architecture.html) guide.

### Private Endpoints for Inbound Traffic

To restrict inbound access to your app from within a VNet (eliminating the public endpoint), configure a [Private Endpoint](https://learn.microsoft.com/en-us/azure/app-service/networking/private-endpoint){:target="_blank" rel="noopener noreferrer"} for the app. This places a network interface with a private IP in your VNet that routes to the App Service app. Once a Private Endpoint is enabled, the public endpoint can be disabled entirely.

This creates a fully private networking posture: outbound traffic goes through VNet integration and inbound traffic arrives through the Private Endpoint. The app is invisible to the public internet. For more on Private Endpoint architecture, see the [Private Link & Virtual WAN](/study-guides/infrastructure/azure/azure-private-link-virtual-wan.html) guide.

### Hybrid Connections

[Hybrid Connections](https://learn.microsoft.com/en-us/azure/app-service/app-service-hybrid-connections){:target="_blank" rel="noopener noreferrer"} provide connectivity from App Service to on-premises endpoints without requiring VPN or ExpressRoute. They use Azure Relay to establish outbound connections from an agent running on-premises to Azure, creating a tunnel that App Service apps can use to reach specific on-premises hostnames and ports.

Hybrid Connections are useful for legacy scenarios where VPN connectivity is not available, but they are limited to TCP traffic on specific hostname:port pairs and do not provide full network-level access.

### Access Restrictions

[Access restrictions](https://learn.microsoft.com/en-us/azure/app-service/overview-access-restrictions){:target="_blank" rel="noopener noreferrer"} allow you to filter inbound traffic to the app's public endpoint by IP address, CIDR range, service tag, or VNet subnet (using service endpoints). This is useful when you need to restrict access to specific networks without configuring Private Endpoints, such as allowing access only from your corporate IP range or from an [Azure Front Door](/study-guides/infrastructure/azure/azure-front-door-cdn.html) instance.

---

## App Service Environment v3

### What ASE Provides

An [App Service Environment](https://learn.microsoft.com/en-us/azure/app-service/environment/overview){:target="_blank" rel="noopener noreferrer"} (ASE) v3 is a single-tenant deployment of App Service that runs directly inside your VNet. Unlike regular App Service (which is multi-tenant and runs on shared infrastructure), an ASE provides dedicated compute that no other Azure customer shares.

ASE v3 is the compute platform behind the Isolated v2 tier. When you create an Isolated v2 App Service Plan, it runs on an ASE.

### Internal vs External ASE

**External ASE** has a public VIP (virtual IP address) for inbound traffic. Apps are accessible from the internet through the ASE's public IP while still being deployed inside your VNet.

**Internal Load Balancer (ILB) ASE** has a private VIP inside the VNet. Apps are accessible only from within the VNet or through connected networks (peered VNets, VPN, ExpressRoute). This is the common pattern for internal-facing applications and for compliance scenarios that prohibit public internet endpoints.

### When to Use ASE

ASE is the right choice in specific scenarios:

- **Regulatory compliance** that requires single-tenant infrastructure and full network isolation
- **High scale** requirements exceeding the 30-instance limit of Premium v3 (ASE supports up to 100 instances per plan)
- **Complete VNet control** over both inbound and outbound traffic without relying on access restrictions or Private Endpoints
- **Zone redundancy** for the App Service infrastructure itself (ASE v3 supports Availability Zone deployment)

ASE carries a significant minimum cost because you pay for the dedicated infrastructure regardless of utilization. For workloads that can use VNet integration and Private Endpoints for their networking needs, regular App Service on Standard or Premium v3 is more cost-effective.

<div class="callout callout--tip">
<p class="callout__title">ASE vs VNet Integration + Private Endpoints</p>
<p>Before choosing ASE, evaluate whether regular App Service with VNet integration (outbound) and Private Endpoints (inbound) meets your networking requirements. This combination provides private networking at a fraction of ASE's cost. Reserve ASE for workloads that genuinely require single-tenant compute isolation or need to exceed Premium v3 scaling limits.</p>
</div>

---

## WebJobs

### What WebJobs Are

[WebJobs](https://learn.microsoft.com/en-us/azure/app-service/webjobs-create){:target="_blank" rel="noopener noreferrer"} are background tasks that run within the same App Service Plan as your web app. They execute scripts or programs (.exe, .cmd, .bat, .sh, .php, .py, .js, or Java) alongside your application, sharing the same compute resources and file system.

### Triggered vs Continuous

**Triggered WebJobs** run on demand or on a schedule (using CRON expressions). They start, execute, and terminate. Each invocation is independent.

**Continuous WebJobs** run persistently, typically in a loop that processes work items from a queue or performs ongoing background processing. They restart automatically if they crash or if the hosting instance restarts.

### WebJobs vs Azure Functions

WebJobs and Azure Functions share the same underlying SDK (the WebJobs SDK powers the triggers and bindings system in Azure Functions). The question of when to use which depends on how the background processing relates to the web application.

| Consideration | WebJobs | Azure Functions |
|--------------|---------|-----------------|
| **Deployment** | Deployed with the App Service app | Deployed independently |
| **Scaling** | Scales with the App Service Plan | Independent scaling (Consumption plan: scale to zero) |
| **Cost** | No additional cost (uses existing plan resources) | Separate cost (Consumption plan: pay per execution) |
| **File system access** | Shares the app's file system | Isolated file system |
| **Configuration** | Shares the app's settings | Independent configuration |
| **Best for** | Background work tightly coupled to the web app | Independent event processing, microservice functions |

Use WebJobs when the background task is part of the same application lifecycle and does not need independent scaling. Use Azure Functions when the processing is independent, needs to scale separately, or should be decoupled from the web application entirely.

---

## Authentication and Authorization (Easy Auth)

### How Easy Auth Works

[App Service Authentication](https://learn.microsoft.com/en-us/azure/app-service/overview-authentication-authorization){:target="_blank" rel="noopener noreferrer"} (commonly called "Easy Auth") is a built-in authentication and authorization module that runs as middleware in the App Service platform. It intercepts incoming requests before they reach your application code and handles the OAuth 2.0 / OpenID Connect flow with configured identity providers.

Easy Auth supports multiple identity providers:
- Microsoft Entra ID (for organizational and B2B scenarios)
- Google, Facebook, Twitter/X (for consumer-facing apps)
- Apple Sign-In
- Any OpenID Connect-compatible provider

### What Easy Auth Does

When enabled, Easy Auth handles the entire authentication flow without code changes:
- Redirects unauthenticated users to the identity provider's login page
- Validates tokens and manages the token lifecycle (refresh, expiration)
- Injects authenticated user claims into HTTP headers that your application code can read
- Provides a built-in token store that your code can query for access tokens (useful for calling downstream APIs on behalf of the user)

### When to Use Easy Auth

Easy Auth is valuable when you need authentication quickly and the identity provider integration is straightforward. It is not a replacement for full authentication libraries when you need fine-grained control over the authentication flow, custom token validation logic, or complex multi-tenant identity scenarios. Think of it as a quick-start authentication layer that handles the common case well.

---

## Custom Domains and SSL

### Custom Domain Configuration

Every App Service app gets a default hostname at `<app-name>.azurewebsites.net`. For production, you map [custom domains](https://learn.microsoft.com/en-us/azure/app-service/app-service-web-tutorial-custom-domain){:target="_blank" rel="noopener noreferrer"} to the app by creating DNS records (CNAME for subdomains, A record + TXT verification for apex domains) and configuring the domain binding in App Service.

Custom domains require Basic tier or above. Free and Shared tiers do not support custom domain bindings.

### SSL/TLS Certificates

App Service provides several certificate options:

**App Service Managed Certificates (free):** Automatically provisioned and renewed for custom domains. They support standard SSL (SNI-based) but do not support wildcard domains or naked/apex domain certificates. For most applications, managed certificates are sufficient and eliminate certificate management overhead entirely.

**App Service Certificates:** Purchased through Azure and stored in Key Vault. They support wildcard domains and provide a managed lifecycle within the Azure ecosystem.

**Imported certificates:** You can upload your own certificates (PFX format) or reference certificates stored in Azure Key Vault. This is required for certificates from specific CAs, extended validation certificates, or certificates with custom requirements.

**SNI SSL vs IP-based SSL:** Modern apps should use SNI (Server Name Indication) SSL, which is the default and supports multiple domains on a single IP. IP-based SSL assigns a dedicated IP address to the domain binding and is only needed for legacy clients that do not support SNI (uncommon in modern environments).

---

## Deployment Options

App Service supports multiple deployment methods, each suited to different workflows.

### Source-Based Deployment

**GitHub Actions:** The recommended approach for GitHub-hosted repositories. Azure provides pre-built workflow templates that build your application and deploy to a specific slot using a publish profile or service principal.

**Azure DevOps Pipelines:** For organizations using Azure DevOps, the Azure Web App deployment task handles build artifact deployment with slot support and swap actions built into the pipeline.

**Local Git:** App Service provides a Git remote URL. Pushing to this remote triggers a build (using Oryx or Kudu build engines) and deploys the result. Useful for simple workflows and local development.

### Artifact-Based Deployment

**ZIP Deploy:** Upload a ZIP file containing the pre-built application. This is the most common method for CI/CD pipelines that build externally and deploy the artifact. ZIP deploy supports "Run from package" mode, which mounts the ZIP as a read-only file system for the app, providing faster startup and deterministic deployments.

**FTP/FTPS:** Available but not recommended for production. FTP deploys files individually rather than atomically, which can leave the application in an inconsistent state during deployment.

### Container Deployment

App Service supports deploying [custom containers](https://learn.microsoft.com/en-us/azure/app-service/configure-custom-container){:target="_blank" rel="noopener noreferrer"} from Azure Container Registry (ACR), Docker Hub, or any private registry. This is useful when your application requires a specific runtime, OS-level dependencies, or a configuration that the built-in runtimes do not support.

Container-based deployment on App Service is not the same as running containers on AKS or Container Apps. App Service manages the container lifecycle, scaling, and networking. You provide the image; the platform does the rest.

<div class="callout callout--note">
<p class="callout__title">Run from Package</p>
<p>ZIP Deploy with "Run from Package" is the recommended deployment method for most production workloads. It provides atomic deployment (no partial file states), faster cold starts (no file copy step), and a deterministic file system (the package is immutable). Enable it by setting the <code>WEBSITE_RUN_FROM_PACKAGE=1</code> application setting.</p>
</div>

---

## Azure Static Web Apps

### What Static Web Apps Are

[Azure Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/overview){:target="_blank" rel="noopener noreferrer"} is a separate service purpose-built for hosting static frontends like single-page applications (React, Angular, Vue), static site generators (Hugo, Gatsby, Jekyll), and Blazor WebAssembly apps. It is not a feature of App Service, but it is a related compute service that architects should understand when evaluating hosting options.

### When to Use Static Web Apps vs App Service

| Consideration | Static Web Apps | App Service |
|--------------|----------------|-------------|
| **Content type** | Static HTML/JS/CSS, SPA frameworks | Server-rendered pages, APIs, dynamic content |
| **API backend** | Integrated Azure Functions (managed) | Full application runtime (.NET, Java, Node, etc.) |
| **Global distribution** | Globally distributed by default (CDN-backed) | Regional (single App Service Plan region) |
| **Custom domains + SSL** | Free, automatic | Free managed certs (Basic tier+) |
| **Authentication** | Built-in (similar to Easy Auth) | Easy Auth |
| **Cost** | Free tier available; Standard tier very low cost | Plan-based pricing (minimum Basic for custom domains) |
| **Server-side rendering** | Not supported | Fully supported |

Use Static Web Apps for static frontends with optional serverless API backends. Use App Service when you need server-side rendering, a persistent application runtime, or the full feature set of a traditional web server.

---

## Architecture Patterns

### Pattern 1: Simple Web Application

**Use case:** Web application with a server-rendered frontend and managed database.

```
Internet
   ↓
App Service (Standard S2)
   ↓ (VNet integration)
Private Endpoint → Azure SQL Database
```

**Components:**
- Single App Service app on a Standard plan with VNet integration
- Private Endpoint for Azure SQL Database (no public database endpoint)
- Deployment slots for staging and production
- Autoscale rules based on CPU and HTTP queue length

This pattern suits small-to-medium web applications with predictable traffic. The Standard plan provides deployment slots for zero-downtime releases and VNet integration for secure database connectivity.

---

### Pattern 2: API Backend with Front Door

**Use case:** Globally distributed API serving mobile and web clients.

```
Clients (global)
   ↓
Azure Front Door (CDN + WAF + global load balancing)
   ↓
App Service (Premium v3) — Region 1 (primary)
App Service (Premium v3) — Region 2 (secondary)
   ↓ (VNet integration)
Private Endpoints → Azure SQL / Cosmos DB
```

**Components:**
- [Azure Front Door](/study-guides/infrastructure/azure/azure-front-door-cdn.html) for global load balancing, WAF, and edge caching
- App Service instances in two regions with VNet integration
- Front Door routes to both regions with priority-based routing (active-passive) or latency-based routing (active-active)
- Private Endpoints for database connectivity from each region
- Access restrictions on the App Service apps to allow traffic only from Front Door

This pattern provides global reach, edge security, and regional failover. Front Door handles the global traffic management while App Service handles the regional compute.

---

### Pattern 3: Microservices on App Service

**Use case:** Multiple services deployed independently but sharing infrastructure.

```
Azure Front Door / Application Gateway
   ↓
App Service Plan (Premium v3)
├── API Gateway App (path-based routing)
├── User Service App
├── Order Service App
└── Notification Service App
   ↓ (VNet integration)
Private Endpoints → Azure SQL, Service Bus, Redis
```

**Components:**
- Multiple App Service apps on a shared Premium v3 plan (cost efficiency)
- Each service deploys independently with its own deployment slots
- An API gateway app or [Application Gateway](/study-guides/infrastructure/azure/azure-load-balancer-app-gateway.html) handles routing to individual services
- VNet integration for secure access to backend services

This pattern works for small-to-medium microservice architectures where the operational overhead of Kubernetes is not justified. For larger microservice estates, AKS or Container Apps provides better service discovery, independent scaling, and resource isolation.

---

### Pattern 4: Internal Application with ASE

**Use case:** Compliance-sensitive internal application with no public internet exposure.

```
Corporate Network
   ↓ (ExpressRoute / VPN)
Hub VNet
   ↓ (VNet peering)
ASE VNet (ILB ASE v3)
├── App Service Plan (Isolated v2)
│   ├── Internal Portal App
│   └── Internal API App
   ↓
Private Endpoints → Azure SQL, Key Vault, Storage
```

**Components:**
- ILB ASE deployed in a dedicated VNet peered with the hub
- No public internet exposure (ILB provides only private VIP)
- Access from corporate network through [ExpressRoute or VPN](/study-guides/infrastructure/azure/azure-expressroute-vpn.html)
- All dependent services accessed through Private Endpoints

Reserve this pattern for workloads that genuinely require single-tenant compute isolation. For most internal applications, regular App Service with Private Endpoints and VNet integration provides sufficient network isolation at a fraction of the cost.

---

## Common Pitfalls

### Pitfall 1: Running One App Per Plan

**Problem:** Creating a separate App Service Plan for every application, even lightweight internal tools and microservices.

**Result:** Cost multiplies rapidly. Ten apps on ten separate Standard S1 plans cost 10x what a single shared plan would cost, and most of those plans sit at 5-10% CPU utilization.

**Solution:** Consolidate lightweight apps onto shared plans. Monitor resource utilization and separate apps into their own plans only when resource contention becomes measurable. Use per-app scaling to limit resource consumption of individual apps within a shared plan.

---

### Pitfall 2: Deploying Directly to Production Without Slots

**Problem:** Deploying new code directly to the production slot instead of using deployment slots and swapping.

**Result:** Users experience cold starts, slow first requests, and potentially errors if the deployment encounters issues. There is no instant rollback path.

**Solution:** Always deploy to a staging slot first. Validate the deployment in the staging slot (automated tests, manual smoke tests, health checks). Then swap to production. If issues arise, swap back. This takes minutes to set up and prevents every deployment from being a potential outage.

---

### Pitfall 3: Ignoring Outbound IP Address Changes

**Problem:** Hardcoding App Service outbound IP addresses in downstream firewall allowlists. When the App Service Plan scales or is moved, the outbound IPs can change.

**Result:** Connections to downstream services break because the new outbound IPs are not allowlisted.

**Solution:** Use VNet integration with a NAT Gateway that has a static public IP. All outbound traffic from the app uses the NAT Gateway's predictable IP address, which does not change with scaling events. For details on NAT Gateway configuration, see the [Azure VNet Architecture](/study-guides/infrastructure/azure/azure-vnet-architecture.html) guide.

---

### Pitfall 4: Not Configuring Health Checks

**Problem:** Relying on the default behavior where App Service considers an instance healthy as long as the process is running, regardless of whether the application can actually serve requests.

**Result:** Unhealthy instances continue to receive traffic. A database connection failure, for example, causes the app to return 500 errors, but App Service keeps routing requests to it.

**Solution:** Configure the [health check](https://learn.microsoft.com/en-us/azure/app-service/monitor-instances-health-check){:target="_blank" rel="noopener noreferrer"} feature with an endpoint that validates critical dependencies (database, cache, external services). App Service probes this endpoint and removes unhealthy instances from the load balancer rotation. Set the health check path in the Azure portal or via configuration.

---

### Pitfall 5: Choosing ASE When VNet Integration Suffices

**Problem:** Deploying to an App Service Environment because the application "needs to be in a VNet," when VNet integration and Private Endpoints would satisfy the networking requirements.

**Result:** The organization pays the significant ASE minimum cost (which is substantially higher than a Standard or Premium plan) for infrastructure isolation that the workload does not require.

**Solution:** Evaluate the actual requirements. If the need is "outbound traffic must go through the VNet" and "inbound traffic must come from the VNet only," then VNet integration (outbound) plus Private Endpoints (inbound) achieves this on Standard or Premium v3 plans. ASE is justified only for single-tenant compute isolation requirements or scaling beyond 30 instances.

---

### Pitfall 6: Misconfiguring Slot-Specific Settings

**Problem:** Forgetting to mark connection strings and environment-specific settings as "slot settings," causing production database credentials to be swapped into the staging slot (or vice versa).

**Result:** The staging environment connects to the production database during testing. In the reverse case, production connects to the staging database after a swap, causing outages or data corruption.

**Solution:** Mark every environment-specific setting as a "slot setting" (also called "deployment slot setting"). Review slot settings before the first swap. Test the swap in a lower environment first to verify that settings behave as expected.

---

## Key Takeaways

1. **App Service Plans are the scaling and billing unit, not individual apps.** Place multiple lightweight apps on shared plans for cost efficiency, but separate resource-intensive apps into their own plans to prevent contention.

2. **Standard tier is the baseline for production workloads.** It provides auto-scaling, deployment slots, and VNet integration. Start here unless you have specific requirements that push you to Premium v3 (performance, predictive autoscaling) or Isolated v2 (compliance, extreme scale).

3. **Deployment slots eliminate deployment risk.** Deploy to staging, validate, and swap to production with zero downtime and instant rollback. There is no good reason to skip this for production applications on Standard tier or above.

4. **VNet integration + Private Endpoints provides private networking without ASE.** Before choosing the Isolated tier and ASE, evaluate whether Standard or Premium v3 with VNet integration (outbound) and Private Endpoints (inbound) meets your networking requirements at a fraction of the cost.

5. **Autoscale rules need tuning, not just configuration.** Set scale-in thresholds meaningfully lower than scale-out thresholds to prevent flapping. Use cooldown periods appropriately. Consider predictive autoscaling on Premium v3 for workloads with predictable traffic patterns.

6. **WebJobs are for app-coupled background work.** If the background task shares the app's lifecycle, settings, and file system, use WebJobs. If it needs independent scaling and deployment, use Azure Functions instead.

7. **App Service is not a direct analog to any single AWS service.** It combines the managed hosting of Elastic Beanstalk, the PaaS simplicity of App Runner, and built-in features like deployment slots and Easy Auth that have no AWS equivalent. Architects migrating from AWS should resist mapping App Service 1:1 to Elastic Beanstalk.

8. **Mark environment-specific settings as slot settings before your first swap.** Connection strings, instrumentation keys, and feature flags that differ between environments must be marked as "slot settings" to prevent them from traveling with the code during a slot swap.

9. **Use ZIP Deploy with "Run from Package" for production deployments.** It provides atomic deployments, faster cold starts, and an immutable file system. Avoid FTP and manual file uploads for anything beyond development experimentation.

10. **Static frontends belong on Azure Static Web Apps, not App Service.** Static Web Apps provides global CDN distribution, free SSL, and integrated serverless APIs at a fraction of the cost and complexity of running a static site on App Service.
