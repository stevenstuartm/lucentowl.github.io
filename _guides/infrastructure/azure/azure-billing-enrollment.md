---
title: "Azure Billing & Enterprise Enrollment"
layout: guide
category: Azure
subcategory: Subscription & Resource Organization
description: "How Azure billing works across agreement types including Enterprise Agreement, Microsoft Customer Agreement, CSP, and Pay-As-You-Go, covering billing hierarchies, cost allocation, spending controls, and commitment-based discounts."
tags: [infrastructure, azure, cost-analysis, governance, fundamentals]
---

## Why Billing Architecture Matters

Azure billing is not just a finance concern. The billing model you choose determines your subscription structure, discount eligibility, spending controls, and cost allocation capabilities. Architects need to understand billing because subscription design decisions (covered in the [Subscription & Tenant Architecture](/study-guides/infrastructure/azure/azure-subscription-architecture.html) guide) are constrained by the billing agreement in place.

---

## Azure Agreement Types

Azure offers several purchasing models, each with a different billing hierarchy, discount structure, and management experience. The right choice depends on organization size, spending volume, and procurement requirements.

### Pay-As-You-Go (PAYG)

The simplest model. You create an Azure account with a credit card, and Microsoft bills monthly based on actual resource consumption.

**Billing hierarchy:**
```
Azure Account (credit card)
└── Subscription
    └── Resources
```

**When it fits:**
- Individual developers and small teams
- Experimentation and proof-of-concept work
- Organizations with low or unpredictable Azure spending
- No volume commitment required

**Limitations:**
- No volume discounts beyond standard pricing
- Limited cost management capabilities compared to enterprise agreements
- Credit card billing can create procurement friction in larger organizations
- Spending limits exist by default on some PAYG subscriptions (originally free trial subscriptions), which can stop resources when reached

---

### Microsoft Customer Agreement (MCA)

The [Microsoft Customer Agreement](https://learn.microsoft.com/en-us/azure/cost-management-billing/understand/mca-overview){:target="_blank" rel="noopener noreferrer"} is Microsoft's modern billing model that replaces the older Enterprise Agreement structure for many organizations. It is available for direct purchases through Microsoft and through Cloud Solution Provider (CSP) partners.

**Billing hierarchy:**
```
Billing Account
├── Billing Profile (invoice boundary)
│   ├── Invoice Section (cost grouping)
│   │   ├── Subscription A
│   │   └── Subscription B
│   └── Invoice Section
│       └── Subscription C
└── Billing Profile
    └── Invoice Section
        └── Subscription D
```

**Key concepts:**

**Billing Account** is the top-level container representing the agreement itself. It holds payment methods, billing profiles, and access control for billing administrators.

**Billing Profile** represents a separate invoice. Each billing profile generates its own monthly invoice with its own payment method. Organizations that need separate invoices for different departments, business units, or legal entities create separate billing profiles.

**Invoice Section** groups subscriptions within a billing profile for cost organization. Invoice sections appear as line items on the billing profile's invoice, making it easy to see costs by department, project, or team without needing separate invoices.

**When it fits:**
- Small to mid-size organizations purchasing directly from Microsoft
- Organizations wanting flexible cost organization without enterprise agreement complexity
- Teams that need multiple invoices for different departments or cost centers

**Advantages over PAYG:**
- Structured billing hierarchy for cost allocation
- Multiple billing profiles for separate invoices
- Role-based access control for billing management
- Azure Reservations and Savings Plans available at the billing profile level

---

### Enterprise Agreement (EA)

The [Enterprise Agreement](https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/ea-portal-get-started){:target="_blank" rel="noopener noreferrer"} is a multi-year contract (typically three years) between an organization and Microsoft for Azure services at negotiated rates. EAs are designed for large organizations with significant Azure spending.

**Billing hierarchy:**
```
Enrollment (EA contract)
├── Department (organizational grouping)
│   ├── Account (subscription owner scope)
│   │   ├── Subscription A
│   │   └── Subscription B
│   └── Account
│       └── Subscription C
└── Department
    └── Account
        └── Subscription D
```

**Key concepts:**

**Enrollment** is the top-level billing entity representing the EA contract. It has an enrollment number, start/end dates, and a monetary commitment (now called Azure Prepayment).

**Department** groups accounts for organizational cost reporting. Departments typically map to business units, divisions, or cost centers. They do not affect access control or policy; they are purely for billing organization.

**Account** is the subscription owner scope. Each account is owned by an account owner (a person with an Entra ID identity) who can create and manage subscriptions under that account. Accounts sit within departments and provide the link between the billing hierarchy and the Azure resource hierarchy.

**Azure Prepayment** (formerly Monetary Commitment) is an upfront payment toward Azure services at discounted rates. The organization commits to spending a certain amount over the EA term, and Azure consumption draws down from this prepayment. Overage beyond the prepayment is billed at the EA's negotiated rates.

**When it fits:**
- Large organizations with $100K+ annual Azure spending
- Organizations that want negotiated pricing and volume discounts
- Enterprises needing structured billing hierarchies for chargeback
- Organizations that can commit to multi-year spending

**EA-specific capabilities:**
- Negotiated pricing below standard list prices
- Azure Prepayment for budget predictability
- Department and account hierarchy for cost allocation
- EA Portal (being migrated to Azure portal) for enrollment management
- Dev/Test subscription offer with discounted rates for non-production workloads

---

### Cloud Solution Provider (CSP)

In the [CSP model](https://learn.microsoft.com/en-us/partner-center/csp-overview){:target="_blank" rel="noopener noreferrer"}, organizations purchase Azure through a Microsoft partner rather than directly from Microsoft. The partner manages billing, provides first-line support, and may offer managed services on top of Azure.

**Billing hierarchy:**
```
CSP Partner
└── Customer Tenant
    └── Subscription (partner-managed)
        └── Resources
```

**When it fits:**
- Organizations that want a single vendor for Azure and managed services
- Small to mid-size organizations without dedicated Azure expertise
- Organizations that prefer their partner to handle billing, support, and optimization

**Trade-offs:**
- Pricing is set by the partner, not directly by Microsoft
- The partner has administrative access to subscriptions (unless restricted)
- Switching partners requires subscription migration
- Some Azure features and offers are not available through CSP

---

## Choosing an Agreement Type

| Factor | PAYG | MCA | EA | CSP |
|--------|------|-----|-----|-----|
| **Organization size** | Individual/small | Small to mid | Large enterprise | Small to mid |
| **Annual Azure spend** | Low/variable | Variable | $100K+ | Variable |
| **Commitment** | None | None | Multi-year | Varies by partner |
| **Volume discounts** | None | Standard | Negotiated | Partner-dependent |
| **Billing hierarchy** | Flat | Profiles + Sections | Departments + Accounts | Partner-managed |
| **Reservation/Savings Plan access** | Yes | Yes | Yes (at enrollment scope) | Through partner |
| **Support** | Microsoft direct | Microsoft direct | Microsoft direct | Partner first-line |

Most organizations start with PAYG or MCA and move to an EA as Azure spending grows. The transition does not require recreating resources; subscriptions can be transferred between billing agreements.

---

## Cost Allocation and Chargeback

### The Problem

When multiple teams share an Azure environment, the question "who is paying for what?" needs a clear answer. Without cost allocation, Azure bills arrive as a single number with no attribution, making it impossible to hold teams accountable for their spending or to make informed decisions about resource investments.

### Cost Allocation Mechanisms

**Subscription-level allocation** is the simplest approach. If each team or workload has its own subscription, costs are naturally separated. This works well when the subscription design pattern already isolates teams, but it breaks down for shared services consumed by multiple teams.

**Tag-based allocation** uses tags like `cost-center`, `team`, or `application` to attribute costs to organizational units. Azure Cost Management can filter and group costs by tag, enabling chargeback reports without subscription-per-team overhead. Tag-based allocation requires consistent tagging enforcement (covered in the [Resource Organization & Tagging](/study-guides/infrastructure/azure/azure-resource-organization.html) guide).

**Invoice section allocation** (MCA) groups subscriptions into invoice sections that map to departments or projects. Costs appear as separate line items on the invoice, providing built-in cost separation without relying on tags.

**Department and account allocation** (EA) uses the EA billing hierarchy. Department administrators can view costs for all accounts and subscriptions within their department, enabling cost reporting by business unit.

**Azure Cost Management cost allocation rules** allow redistributing shared costs (like a shared networking subscription or centralized monitoring) across consuming teams. You define rules that allocate a percentage of shared resource costs to specific subscriptions, resource groups, or tags.

### Chargeback vs. Showback

**Chargeback** bills internal teams for their actual Azure consumption. It creates direct financial accountability but requires accurate cost attribution and organizational buy-in for internal billing.

**Showback** reports costs to teams without actual billing. Teams see what they are consuming and its cost, creating awareness and encouraging optimization without the overhead of internal invoicing. Most organizations start with showback and move to chargeback as cost allocation matures.

---

## Spending Controls

### Budgets

[Azure Budgets](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/tutorial-acm-create-budgets){:target="_blank" rel="noopener noreferrer"} set spending thresholds at the subscription, resource group, or management group level. When spending reaches a configured percentage of the budget (50%, 75%, 90%, 100% are common thresholds), Azure sends email notifications and can trigger automation through Action Groups.

Budgets are informational by default. They alert but do not stop spending. To enforce hard spending limits, you can connect budget alerts to Azure Automation runbooks or Azure Functions that shut down or deallocate resources when thresholds are exceeded.

### Spending Limits

PAYG subscriptions created from free trials have a default spending limit that stops resource consumption when the included credit is exhausted. This prevents unexpected charges but also stops workloads. Production workloads should run in subscriptions without spending limits.

Enterprise Agreement and MCA subscriptions do not have spending limits. Cost control is managed through budgets, alerts, and Azure Policy.

### Azure Policy for Cost Control

Azure Policy can enforce cost-related guardrails:

- **Allowed VM SKUs**: Restrict which VM sizes can be deployed, preventing teams from spinning up expensive GPU or high-memory instances without justification
- **Allowed regions**: Limit deployments to specific regions, preventing accidental deployments in premium-priced regions
- **Require tags**: Ensure cost-allocation tags are present on all resources (covered in the Resource Organization guide)

---

## Commitment-Based Discounts

### Azure Reservations

[Azure Reservations](https://learn.microsoft.com/en-us/azure/cost-management-billing/reservations/save-compute-costs-reservations){:target="_blank" rel="noopener noreferrer"} provide discounted pricing in exchange for committing to one-year or three-year terms for specific resources. Reservations apply to compute (VMs, App Service, Azure Functions Premium), databases (SQL Database, Cosmos DB, PostgreSQL), storage, and other services.

**How reservations work:**
- You purchase a reservation for a specific VM size, database tier, or other resource configuration
- The reservation discount automatically applies to matching running resources
- Unused reservation capacity is wasted (you pay whether you use it or not)
- Reservations can be scoped to a single subscription, a resource group, or shared across all subscriptions in a billing account

**Reservation scope matters:**
- **Single subscription**: Discount applies only to matching resources in that subscription
- **Shared**: Discount applies to matching resources across all subscriptions in the billing account, maximizing utilization

### Azure Savings Plans

[Azure Savings Plans](https://learn.microsoft.com/en-us/azure/cost-management-billing/savings-plan/savings-plan-compute-overview){:target="_blank" rel="noopener noreferrer"} offer a more flexible alternative to reservations. Instead of committing to a specific resource configuration, you commit to a fixed hourly spend amount for one or three years. The discount applies across VM sizes, regions, and compute services.

**Savings Plans vs. Reservations:**

| Factor | Reservations | Savings Plans |
|--------|-------------|---------------|
| **Commitment** | Specific resource type and size | Dollar amount per hour |
| **Flexibility** | Locked to configuration | Applies across sizes and regions |
| **Discount depth** | Higher (more specific commitment) | Slightly lower (more flexibility) |
| **Best for** | Stable, predictable workloads | Workloads that change size or region |

**Recommended approach:** Use reservations for resources with stable, predictable configurations (a production database that rarely changes tier). Use savings plans for compute that may shift across VM sizes or regions over time. The two can be combined.

### Azure Hybrid Benefit

[Azure Hybrid Benefit](https://learn.microsoft.com/en-us/azure/virtual-machines/windows/hybrid-use-benefit-licensing){:target="_blank" rel="noopener noreferrer"} allows organizations with existing Windows Server or SQL Server licenses (with Software Assurance) to use those licenses on Azure, reducing the cost of Azure VMs and Azure SQL Database. This benefit can be combined with reservations for compounded savings.

### Dev/Test Pricing

Enterprise Agreement customers have access to [Azure Dev/Test pricing](https://azure.microsoft.com/en-us/pricing/dev-test/){:target="_blank" rel="noopener noreferrer"}, which offers discounted rates on select Azure services for non-production workloads. Dev/Test subscriptions have lower rates for VMs (no Windows license charge), discounted PaaS services, and no SLA commitment from Microsoft.

Dev/Test subscriptions must be designated at creation time and should only contain non-production workloads. Running production workloads in a Dev/Test subscription violates the terms of use.

---

## Billing Roles and Access Control

### Billing vs. Resource Management Roles

Azure separates billing roles from resource management roles. Having Owner access on a subscription does not grant access to billing information, and having billing access does not grant the ability to create or modify resources.

**MCA billing roles:**

| Role | Scope | Capabilities |
|------|-------|-------------|
| **Billing account owner** | Billing account | Full billing management, create billing profiles |
| **Billing account contributor** | Billing account | Manage billing except access control |
| **Billing profile owner** | Billing profile | Manage invoice, payment methods, and invoice sections |
| **Invoice section owner** | Invoice section | Create subscriptions, manage costs for the section |

**EA billing roles:**

| Role | Scope | Capabilities |
|------|-------|-------------|
| **Enterprise Administrator** | Enrollment | Full enrollment management, department/account creation |
| **Department Administrator** | Department | View costs, manage accounts within department |
| **Account Owner** | Account | Create and manage subscriptions, view account costs |

### Who Should Have Billing Access

Billing access should be limited to finance teams and designated administrators. Most developers and architects need cost visibility (which Azure Cost Management provides through resource management roles) but not billing management capabilities. Use Azure Cost Management's built-in Reader role to give teams visibility into their spending without granting the ability to modify billing configuration.

---

## Key Takeaways

- Azure offers four main billing models: PAYG for simplicity, MCA for structured billing without long-term commitment, EA for enterprise-scale negotiated pricing, and CSP for partner-managed Azure.
- Your billing agreement determines your billing hierarchy, discount eligibility, and cost allocation options. Choose the agreement type before designing your subscription topology.
- Cost allocation works through subscription separation, tag-based attribution, invoice sections (MCA), or department/account hierarchies (EA). Start with showback reporting and graduate to chargeback as cost attribution matures.
- Budgets alert on spending thresholds but do not stop consumption by default. Combine budgets with automation for hard spending limits, and use Azure Policy to prevent expensive resource deployments.
- Reservations and Savings Plans provide significant discounts for committed usage. Use reservations for stable configurations and savings plans for flexible compute. Azure Hybrid Benefit and Dev/Test pricing provide additional savings for eligible workloads.
- Billing roles are separate from resource management roles. Limit billing access to finance teams and use Azure Cost Management Reader for team-level cost visibility.
