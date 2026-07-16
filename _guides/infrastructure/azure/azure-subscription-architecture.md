---
title: "Azure Subscription & Tenant Architecture"
layout: guide
category: Azure
subcategory: Subscription & Resource Organization
description: "How Azure's organizational hierarchy works from Entra ID tenants through management groups, subscriptions, and resource groups, including design patterns for multi-subscription and multi-resource-group environments, workload isolation, environment separation, and how Azure Landing Zones implement this hierarchy end-to-end."
tags: [landing-zones, management-groups, subscriptions, resource-groups, governance, fundamentals]
---

## What Is Azure's Organizational Hierarchy

Every Azure resource lives within a layered hierarchy that controls billing, access, policy enforcement, and resource organization. Understanding this hierarchy is a prerequisite for any Azure architecture because every design decision about networking, security, cost allocation, and governance maps back to it.

### The Hierarchy at a Glance

```
Entra ID Tenant
└── Root Management Group
    ├── Management Group (e.g., Production)
    │   ├── Subscription (e.g., Prod-Web)
    │   │   ├── Resource Group (e.g., rg-webapp-prod)
    │   │   │   ├── App Service
    │   │   │   ├── SQL Database
    │   │   │   └── Key Vault
    │   │   └── Resource Group (e.g., rg-data-prod)
    │   │       ├── Storage Account
    │   │       └── Cosmos DB
    │   └── Subscription (e.g., Prod-Platform)
    │       └── Resource Group (e.g., rg-networking-prod)
    │           ├── Virtual Network
    │           └── Application Gateway
    ├── Management Group (e.g., Non-Production)
    │   └── Subscription (e.g., Dev-Team1)
    │       └── Resource Group (e.g., rg-webapp-dev)
    └── Management Group (e.g., Sandbox)
        └── Subscription (e.g., Sandbox-Exploration)
```

### Why This Hierarchy Matters

AWS uses a flat account model with Organizations layered on top. Azure's hierarchy is different in kind because it is structural from the beginning. Every layer serves a specific purpose:

| Layer | Primary Purpose | Scope |
|-------|----------------|-------|
| **Entra ID Tenant** | Identity and authentication boundary | Entire organization |
| **Management Group** | Policy and access inheritance | Groups of subscriptions |
| **Subscription** | Billing boundary, resource limits, access boundary | Collection of resources |
| **Resource Group** | Lifecycle and deployment scope | Related resources |

Policies, role assignments, and cost tracking all follow this hierarchy. A policy applied to a management group cascades to every subscription, resource group, and resource beneath it. This inheritance model is one of Azure's most powerful governance features, but it requires careful design to avoid unintended consequences.

---

## Entra ID Tenants

### What Is a Tenant

An [Entra ID](https://learn.microsoft.com/en-us/entra/fundamentals/whatis){:target="_blank" rel="noopener noreferrer"} tenant (formerly Azure Active Directory tenant) is the top-level identity boundary in Azure. It represents a dedicated instance of the Entra ID identity service and is the foundation for all authentication and authorization in Azure.

Every Azure subscription must be associated with exactly one Entra ID tenant. The tenant provides:

- **User and group management** for workforce identities
- **Application registrations** for service-to-service authentication
- **Conditional Access policies** that control how and when users authenticate
- **B2B collaboration** for inviting external users as guests
- **The trust relationship** that makes Azure RBAC work (all RBAC role assignments are anchored to the tenant's identity store)

### Single-Tenant vs. Multi-Tenant

Most organizations use a single Entra ID tenant. Multi-tenant configurations are rare and introduce significant complexity.

**Use a single tenant when:**
- You are one organization, even if you span multiple business units or geographies
- You want unified identity management, a single Global Address List, and seamless cross-subscription access
- You need Conditional Access policies that apply consistently across all environments

**Consider multiple tenants when:**
- Regulatory requirements mandate complete identity isolation (some government or highly regulated industries)
- You have acquired a company and cannot immediately merge identity stores
- You operate distinct business entities that must never share identity data

**Multi-tenant trade-offs:**
- Cross-tenant collaboration requires B2B guest access or [Azure Lighthouse](https://learn.microsoft.com/en-us/azure/lighthouse/overview){:target="_blank" rel="noopener noreferrer"}, both of which add management overhead
- No shared Conditional Access policies across tenants
- Separate administration, separate MFA configurations, separate app registrations
- VNet peering works cross-tenant but requires additional trust configuration
- Users managing resources in multiple tenants must switch context, which complicates workflows

### Tenant Design Red Flags

- **Creating tenants per environment** (dev/test/prod): This is almost always the wrong approach. Use subscriptions and management groups for environment separation, not tenants. Separate tenants mean separate identity stores, which means separate user management, separate Conditional Access, and no seamless cross-environment access for developers.
- **Creating tenants per business unit**: Unless there is a legal requirement for identity isolation, this fragments governance and creates administrative burden.
- **Not designating an emergency access account**: Every tenant should have at least two [emergency access accounts](https://learn.microsoft.com/en-us/entra/identity/role-based-access-control/security-emergency-access){:target="_blank" rel="noopener noreferrer"} (break-glass accounts) that bypass Conditional Access and MFA, stored securely for disaster recovery scenarios.

---

## Management Groups

### What Are Management Groups

[Management groups](https://learn.microsoft.com/en-us/azure/governance/management-groups/overview){:target="_blank" rel="noopener noreferrer"} sit between the tenant and subscriptions in the hierarchy. They allow you to apply Azure Policy and RBAC role assignments at a scope above individual subscriptions, so governance decisions cascade down to every subscription underneath.

Every Entra ID tenant has a single **root management group** created automatically. All other management groups and subscriptions nest beneath it, up to six levels deep. That six-level limit counts neither the root level nor the subscription level, so the usable depth is root plus six. A single directory supports up to 10,000 management groups.

### Why Management Groups Exist

Without management groups, you would need to apply policies and role assignments to each subscription individually. In an enterprise with dozens or hundreds of subscriptions, this does not scale. Management groups solve this by providing inheritance points.

Assigning a policy like "all storage accounts must use HTTPS" at a management group means every subscription beneath it inherits that requirement. Assigning a Reader role at a management group grants read access to all subscriptions, resource groups, and resources beneath it.

### Common Management Group Structures

**Structure by environment and workload type:**

```
Root Management Group
├── Platform
│   ├── Identity (Entra ID Connect, domain controllers)
│   ├── Management (monitoring, logging, automation)
│   └── Connectivity (hub VNets, ExpressRoute, DNS)
├── Landing Zones
│   ├── Production
│   │   ├── Corp (internal workloads)
│   │   └── Online (internet-facing workloads)
│   └── Non-Production
│       ├── Development
│       └── Testing
├── Sandbox (experimentation, no connectivity to corp network)
└── Decommissioned (subscriptions being retired)
```

This structure mirrors the [Azure Landing Zone architecture](https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ready/landing-zone/){:target="_blank" rel="noopener noreferrer"} recommended by Microsoft's Cloud Adoption Framework. It separates platform concerns (identity, networking, management) from application workloads and isolates non-production environments from production.

### Management Group Design Principles

**Keep the hierarchy shallow.** Deep nesting makes it harder to reason about which policies apply where. Two to three levels below root is typical for most organizations.

**Align with governance boundaries, not org charts.** Management groups should reflect how you want to govern resources, not how the company's org chart looks. Org charts change frequently while governance boundaries are more stable.

**Use the root management group carefully.** Policies assigned at root apply to everything in the tenant. Only assign policies at root that genuinely need universal enforcement, such as requiring allowed Azure regions or mandating diagnostic settings.

**Plan for growth.** Adding new management groups later is straightforward, but moving subscriptions between management groups changes which policies apply to them. Design with enough structure to accommodate new workloads without reorganization.

### Management Group Design Red Flags

- **Mirroring the org chart exactly**: Governance boundaries rarely map 1:1 to organizational structure. When a reorg happens, you would need to restructure your management groups.
- **More than four levels of nesting**: Deep hierarchies make policy inheritance hard to trace and debug.
- **Assigning restrictive policies at root without testing**: A misconfigured deny policy at the root management group can lock out all subscriptions. Test policies at a lower scope first.
- **No "sandbox" management group**: Without an isolated sandbox, teams experiment inside governed subscriptions, creating security and compliance risk.

---

## Subscriptions

### What Is a Subscription

A [subscription](https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ready/azure-setup-guide/organize-resources){:target="_blank" rel="noopener noreferrer"} is the primary billing and access boundary in Azure. Every Azure resource belongs to exactly one subscription, and Azure bills charges at the subscription level.

Subscriptions serve three roles simultaneously:

1. **Billing boundary**: All resource charges within a subscription appear on a single invoice (or billing section)
2. **Access boundary**: RBAC role assignments can be scoped to a subscription, granting access to all resource groups and resources within it
3. **Resource limit boundary**: Azure enforces per-subscription quotas on many resource types (VMs per region, VNets per subscription, etc.)

### Single vs. Multi-Subscription Strategies

**Single subscription** works for small teams and simple workloads, but it limits your ability to isolate environments, enforce different policies, and track costs granularly.

**Multi-subscription strategies** are common in production environments and necessary at enterprise scale. The decision of how to split subscriptions is one of the most impactful early architecture choices.

### Subscription Design Patterns

#### Pattern 1: Environment-Based Subscriptions

Separate subscriptions for each environment: `sub-prod`, `sub-staging`, `sub-dev`, and `sub-sandbox`.

**When to use:** Teams that need clear cost separation by environment, different RBAC assignments per environment (developers get Contributor on dev but Reader on prod), and different policies per environment (prod requires encryption, dev allows more flexibility).

**Trade-offs:** Networking between environments requires VNet peering across subscriptions. Shared resources (container registries, Key Vaults) need cross-subscription access configuration.

#### Pattern 2: Workload-Based Subscriptions

Separate subscriptions per application or workload, regardless of environment: `sub-webapp` (prod and dev resources for the web app), `sub-dataplatform` (prod and dev resources for data services), and `sub-shared-services` (DNS, monitoring, networking hub).

**When to use:** When different workloads have different compliance requirements, cost ownership, or team boundaries. Useful when workloads need strong blast-radius isolation.

**Trade-offs:** Environments within each subscription need resource-group-level or resource-level RBAC to separate dev from prod, which is more granular management.

#### Pattern 3: Combined (Environment + Workload)

Separate subscriptions by both environment and workload: `sub-webapp-prod`, `sub-webapp-dev`, `sub-dataplatform-prod`, `sub-dataplatform-dev`, and `sub-shared-services`.

**When to use:** Enterprise environments that need both workload isolation and environment isolation. This is the most common pattern at scale and aligns with the Azure Landing Zone reference architecture.

**Trade-offs:** Subscription count grows quickly (workloads x environments). Requires good automation for provisioning and governance.

### Subscription Limits and Quotas

Azure enforces [per-subscription quotas](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits){:target="_blank" rel="noopener noreferrer"} on many resource types. These are soft limits that can be increased through support requests, but they affect subscription design.

Examples of common default quotas:

| Resource | Default Limit |
|----------|---------------|
| Virtual Machines (per VM series) | 10-350 vCPUs per subscription per region, depending on series |
| Virtual Networks | 1,000 per subscription per region |
| Storage Accounts | 250 per subscription per region (500 by request) |
| Public IP Addresses | Varies by offer type: 1,000 on Enterprise Agreement, 20 on pay-as-you-go |
| Network Security Groups | 5,000 per subscription per region |
| Azure SQL logical servers | 250 per subscription per region |
| Azure SQL Databases | 5,000 per logical server |

When a workload's resource needs approach subscription limits, splitting into additional subscriptions is the standard mitigation. This is another driver of multi-subscription architectures.

### Cross-Subscription Considerations

Multiple subscriptions introduce cross-subscription concerns that must be addressed:

- **Networking**: VNets in different subscriptions communicate through [VNet peering](https://learn.microsoft.com/en-us/azure/virtual-network/virtual-network-peering-overview){:target="_blank" rel="noopener noreferrer"} or through a hub-and-spoke topology using a shared connectivity subscription. Peering works across subscriptions, and across tenants as well once the trust configuration is in place.
- **Shared services**: Resources like DNS zones, container registries, monitoring workspaces, and Key Vaults often live in a shared-services subscription accessible by other subscriptions.
- **RBAC**: Role assignments at the management group level cascade to all subscriptions beneath, which simplifies access management across multiple subscriptions.
- **Resource moves**: Some resources can be [moved between subscriptions](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/move-support-resources){:target="_blank" rel="noopener noreferrer"}, but not all. Check move support before assuming a resource can be relocated.

### Subscription Design Red Flags

- **Everything in one subscription**: A single subscription limits environment isolation, blast radius containment, and cost tracking granularity. Even small organizations benefit from separating production from non-production.
- **Subscriptions per team without governance**: If teams create subscriptions independently without management group governance, you end up with policy inconsistency and security gaps.
- **Not planning for quota limits**: Hitting subscription quotas in production disrupts deployments. Monitor quota utilization and request increases proactively.
- **Treating subscriptions as disposable**: Unlike AWS accounts, Azure subscriptions carry state like resource locks, policy assignments, and RBAC configurations. Deleting and recreating subscriptions loses this state.

---

## Resource Groups

### What Is a Resource Group

A [resource group](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/manage-resource-groups-portal){:target="_blank" rel="noopener noreferrer"} is a container that groups related Azure resources for management purposes. Every Azure resource must belong to exactly one resource group.

Resource groups are more than organizational folders. They serve as:

- **Deployment scope**: ARM and Bicep deployments target a resource group, deploying or updating all resources defined within it
- **RBAC scope**: Role assignments can target a resource group, granting access to all resources within it
- **Lifecycle boundary**: Deleting a resource group deletes all resources inside it
- **Cost tracking unit**: Azure Cost Management can report costs at the resource group level

### Resource Group Design Patterns

#### Pattern 1: Lifecycle-Based Grouping

Group resources that share the same lifecycle (created, updated, and deleted together), such as `rg-webapp-prod` holding the App Service Plan, App Service, Application Insights, and a Key Vault for app-specific secrets.

**When to use:** This is the default recommendation. Resources that deploy together and are managed as a unit belong in the same resource group.

#### Pattern 2: Resource-Type-Based Grouping

Group resources by type (all databases together, all networking together).

| Resource Group | Contents |
|---|---|
| `rg-databases-prod` | SQL Server, SQL Database, Cosmos DB Account |
| `rg-networking-prod` | Virtual Network, NSGs, Application Gateway |

**When to use:** When infrastructure teams manage specific resource types (networking team manages all VNets, database team manages all databases). Aligns RBAC with team responsibilities.

**Trade-offs:** Deploying an application requires touching multiple resource groups, complicating deployment automation.

#### Pattern 3: Application-Component-Based Grouping

Group resources by application component (frontend, backend, data tier).

| Resource Group | Contents |
|---|---|
| `rg-webapp-frontend-prod` | CDN Profile, Static Web App, Front Door |
| `rg-webapp-backend-prod` | App Service, API Management, Service Bus |
| `rg-webapp-data-prod` | SQL Database, Redis Cache, Storage Account |

**When to use:** When different teams own different tiers of the same application and need separate RBAC boundaries and deployment scopes.

### Resource Group Location

Every resource group has a location property, but this location only determines where the resource group's metadata is stored. Resources inside a resource group can be deployed to any Azure region. A resource group in East US can contain resources in West Europe.

Choose the resource group location based on compliance requirements for metadata storage, not based on where the resources themselves will be deployed.

### Resource Group Design Red Flags

- **One giant resource group for everything**: Loses the benefits of lifecycle management, granular RBAC, and cost tracking. Deleting the resource group would delete everything.
- **Empty resource groups**: Accumulate over time and create confusion. Clean up resource groups when all their resources are removed.
- **Resource groups per individual resource**: Too granular. Adds management overhead without meaningful organizational benefit.
- **Not considering resource group locks**: Production resource groups should use [resource locks](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/lock-resources){:target="_blank" rel="noopener noreferrer"} (CanNotDelete or ReadOnly) to prevent accidental deletion.

---

## Putting It All Together: Design Decisions

### Decision Framework

When designing your Azure organizational hierarchy, work through these decisions in order:

**1. How many tenants?**
Start with one. Add a second only if regulatory or legal requirements demand complete identity isolation.

**2. What management group structure?**
Start with the Azure Landing Zone recommended structure, which includes management groups like Platform, Landing Zones (with Production and Non-Production), Sandbox, and Decommissioned.

**3. How to split subscriptions?**
At minimum, separate production from non-production. At enterprise scale, use the combined environment-plus-workload pattern. For each subscription, determine which management group it belongs to.

**4. How to organize resource groups?**
Default to lifecycle-based grouping. Adjust to resource-type or component-based grouping only when team boundaries or RBAC requirements demand it.

### Small Organization Example

A startup with one application and a small team:

```
Entra ID Tenant
└── Root Management Group
    ├── sub-production
    │   ├── rg-webapp-prod
    │   └── rg-data-prod
    └── sub-development
        └── rg-webapp-dev
```

Two subscriptions separate production from development. Resource groups follow lifecycle grouping. Management groups are implicit (subscriptions sit directly under root). This is simple enough to manage manually and provides environment isolation from day one.

### Enterprise Example

A larger organization with multiple teams and compliance requirements:

```
Entra ID Tenant
└── Root Management Group
    ├── Platform
    │   ├── sub-identity (Entra ID Connect, domain controllers)
    │   ├── sub-management (Log Analytics, Automation, monitoring)
    │   └── sub-connectivity (hub VNet, ExpressRoute, Firewall, DNS)
    ├── Landing Zones
    │   ├── Production
    │   │   ├── Corp
    │   │   │   ├── sub-erp-prod
    │   │   │   └── sub-intranet-prod
    │   │   └── Online
    │   │       └── sub-ecommerce-prod
    │   └── Non-Production
    │       ├── sub-erp-dev
    │       ├── sub-intranet-dev
    │       └── sub-ecommerce-dev
    ├── Sandbox
    │   └── sub-sandbox-teamexploration
    └── Decommissioned
```

Policies at the "Production" management group enforce encryption, diagnostic settings, and allowed VM SKUs. The "Non-Production" management group has relaxed policies for developer agility. The "Sandbox" management group has no connectivity to the corporate network and allows experimentation without risk. Platform subscriptions are managed by centralized teams, while landing zone subscriptions are delegated to application teams within guardrails.

### Migration Path: Growing from Simple to Enterprise

Organizations rarely start with the enterprise structure. A common migration path:

1. **Start**: Single subscription, multiple resource groups
2. **First split**: Separate production and non-production subscriptions
3. **Add governance**: Create management groups, apply policies at the management group level
4. **Scale out**: Add workload-specific subscriptions as teams and applications grow
5. **Platform separation**: Extract shared services (networking, identity, monitoring) into dedicated platform subscriptions
6. **Adopt Landing Zones**: Align with the Azure Landing Zone reference architecture for full enterprise governance

Each step is incremental. You can move subscriptions between management groups and move some resources between subscriptions, so the hierarchy evolves as the organization grows.

---

## Azure Landing Zones

### What Are Landing Zones

[Azure Landing Zones](https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ready/landing-zone/){:target="_blank" rel="noopener noreferrer"} are Microsoft's prescriptive reference architecture for setting up an Azure environment with governance, security, and networking baked in from the start. They implement the management group hierarchy, subscription topology, policy assignments, and networking patterns described throughout this guide.

Landing Zones are not a separate Azure service. They are a documented architectural pattern supported by deployment accelerators (Bicep modules, Terraform modules, and portal-based tools) that provision the entire hierarchy in a consistent, repeatable way.

### Landing Zone Components

A landing zone deployment typically provisions:

- **Management group hierarchy** following the Platform/Landing Zones/Sandbox structure
- **Azure Policies** assigned at each management group level for governance
- **Hub-and-spoke or Virtual WAN networking** in a connectivity subscription
- **Centralized logging** with Log Analytics workspaces in a management subscription
- **Identity integration** with Entra ID and optionally on-premises Active Directory
- **Subscription vending** automation for provisioning new landing zone subscriptions with governance pre-applied

### When to Use Landing Zones

Landing Zones are the recommended starting point for any organization planning to run production workloads on Azure. They encode best practices that are difficult and time-consuming to design from scratch. Starting with a Landing Zone and customizing it is faster and more reliable than building a governance structure ad hoc.

Even for smaller organizations, reviewing the Landing Zone architecture provides a roadmap for where the environment should evolve as it scales.

---

## Key Takeaways

- Azure's hierarchy (Tenant, Management Group, Subscription, Resource Group, Resource) is structural, not optional. Every resource lives within it, and governance flows through it.
- Start with one Entra ID tenant. Use management groups and subscriptions for isolation, not separate tenants.
- Management groups exist for policy and RBAC inheritance. Keep them shallow (two to three levels) and aligned with governance boundaries.
- Subscriptions are billing, access, and quota boundaries. Separate production from non-production at minimum, and split further by workload at enterprise scale.
- Resource groups are lifecycle and deployment boundaries. Group resources that are created, updated, and deleted together.
- Azure Landing Zones provide a prescriptive reference architecture that implements all of these patterns. Start there rather than designing from scratch.
