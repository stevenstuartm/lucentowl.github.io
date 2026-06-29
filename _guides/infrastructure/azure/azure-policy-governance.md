---
title: "Azure Policy and Governance"
layout: guide
category: Azure
subcategory: Security and Compliance
description: "A system architect's guide to Azure Policy and governance covering policy definitions, initiatives, compliance evaluation, Azure Blueprints, Landing Zones, and enterprise-scale governance patterns."
tags: [azure, governance, security, cloud-computing, infrastructure, automation, compliance, practical]
---

## What Is Azure Policy and Governance

[Azure Policy](https://learn.microsoft.com/en-us/azure/governance/policy/overview){:target="_blank" rel="noopener noreferrer"} is a service that allows you to create and enforce rules across your Azure estate. These rules (called policies) evaluate Azure resources against your organization's standards and can automatically remediate violations.

Azure governance goes beyond policy to include [Management Groups](https://learn.microsoft.com/en-us/azure/governance/management-groups/overview){:target="_blank" rel="noopener noreferrer"} for hierarchy, [Azure Blueprints](https://learn.microsoft.com/en-us/azure/governance/blueprints/overview){:target="_blank" rel="noopener noreferrer"} for packaging policy + RBAC + templates, and [Azure Landing Zones](https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ready/landing-zone/){:target="_blank" rel="noopener noreferrer"} as a complete governance and architecture reference implementation.

### What Problems Governance Solves

**Without Azure Policy:**
- Developers create resources with weak security settings (public storage, open network ports)
- Compliance violations go undetected until audits reveal violations months later
- Each team configures resources differently, creating operational inconsistency
- Security team cannot enforce tagging standards or encryption requirements
- Cost optimization opportunities are invisible; unused resources accumulate
- Organizational standards are documented but not enforced

**With Azure Policy:**
- Non-compliant resources are blocked from creation before they reach production
- Compliance state is continuously evaluated and visible in dashboards
- Organizations enforce consistent configuration standards across thousands of resources
- Security policies scale without manual review
- Remediation happens automatically when policies support it
- Standards are mechanically enforced, not just documented

### How Azure Policy Differs from AWS Equivalents

Architects familiar with AWS should note these important differences:

| Concept | AWS | Azure |
|---------|-----|-------|
| **Primary enforcement tool** | AWS Config (evaluation) plus Service Control Policies (blocking) | Azure Policy (evaluation, blocking, remediation in one service) |
| **Policy application** | Config and SCPs are separate tools | Unified policy tool for evaluation, auditing, denial, remediation |
| **Hierarchical inheritance** | SCPs attached to Organization; nested inheritance supported | Management Groups provide nested policy inheritance |
| **Policy parameters** | Config rules are difficult to parameterize; hard-coded values are common | Built-in parameters enable flexibility and reuse |
| **Remediation** | AWS Config doesn't remediate; requires separate SSM automation | Built-in DeployIfNotExists and Modify effects auto-remediate |
| **Cost governance** | AWS Budgets monitors spend; no enforcement mechanism | Budget alerts combined with policy-based enforcement (deny expensive SKUs) |
| **Multi-cloud/tenant governance** | Requires separate tooling or custom solutions | Single pane via Management Groups and policies |
| **Initialization framework** | Control Tower (AWS-provided enterprise setup) | Landing Zones (CAF reference; mostly manual setup) |

---

## Core Policy Concepts

### Policy Definitions

A [policy definition](https://learn.microsoft.com/en-us/azure/governance/policy/concepts/definition-structure){:target="_blank" rel="noopener noreferrer"} is a set of conditions and effects that define what is allowed or required in Azure.

**Structure of a policy definition:**

A policy definition contains:
- **Name and description:** Identifies the policy
- **Parameters:** Variables that make the policy reusable (e.g., allowed VM SKUs, required tags)
- **Metadata:** Tags and display names for categorization
- **Policy rule:** JSON logic that evaluates resources
- **Effect:** What happens to non-compliant resources (Deny, Audit, Append, DeployIfNotExists, Modify)

**Built-in vs. Custom Policies**

Microsoft provides 200+ built-in policies covering common scenarios:
- Denying public access to storage accounts
- Enforcing encrypted disks
- Requiring diagnostic logging
- Mandating specific SKUs or regions

For organization-specific standards, you create custom policies using JSON policy rules. Custom policies follow the same structure as built-ins.

**Parameters and Reusability**

Instead of creating separate policies for each VM SKU, storage account, or tag requirement, policies use parameters:

| Parameter Type | Example | Benefit |
|---|---|---|
| **List** | Allowed VM SKUs: `["Standard_B2s", "Standard_D2s_v3"]` | One policy, many allowed values |
| **String** | Required environment tag: `"prod"` | Flexible enforcement across policies |
| **Boolean** | Enable encryption: `true` | Simple yes/no conditions |
| **Array** | Allowed regions: `["eastus", "westus2"]` | Enforce geographic constraints |

When you assign a policy, you specify parameter values. This allows the same policy definition to enforce different rules in different management groups or subscriptions.

### Policy Effects

The **effect** determines what happens when a resource violates the policy rule:

| Effect | Behavior | Use Case |
|--------|----------|----------|
| **Audit** | Evaluates resources and marks non-compliant ones in the dashboard (no blocking) | Testing policies before enforcement; discovering current state |
| **Deny** | Blocks creation or update of non-compliant resources; request fails at validation time | Enforcing security standards that must not be violated |
| **Append** | Automatically adds properties to compliant resources during creation | Appending required tags or storage account encryption settings |
| **DeployIfNotExists** | Automatically deploys a resource if missing, like a diagnostic setting | Enforcing logging or monitoring without manual configuration |
| **Modify** | Updates properties on existing resources; similar to Append but modifies existing properties too | Fixing non-compliant resources automatically without redeployment |
| **AuditIfNotExists** | Audits if a related resource is missing, for example VMs without antivirus | Detecting gaps without blocking |

**Effect selection strategy:**

- Start with **Audit** to understand current compliance
- Shift to **Deny** once you understand the impact
- Use **DeployIfNotExists** and **Modify** for auto-remediation to reduce manual work
- Combine multiple policies; one prevents bad, another fixes existing

### Initiatives (Policy Sets)

An [initiative](https://learn.microsoft.com/en-us/azure/governance/policy/concepts/initiative-definition-structure){:target="_blank" rel="noopener noreferrer"} (also called policy set) is a collection of related policies assigned together. Initiatives group policies by domain (security, compliance, cost) or regulatory requirement (PCI-DSS, HIPAA).

**Benefits of initiatives:**

- **Single assignment:** Assign one initiative instead of 20 individual policies
- **Grouped definitions:** Security team reviews and updates all policies related to encryption together
- **Consistent parameters:** Set security tags once for all policies in the initiative
- **Regulatory alignment:** Built-in initiatives map to compliance frameworks (PCI-DSS, SOC 2, HIPAA, ISO 27001)

Microsoft provides initiatives like:
- "Audit machines with insecure password security settings"
- "Ensure HTTPS is the only access protocol to your Event Hub"
- "PCI DSS v3.2.1 Compliance" (15 individual policies)

---

## Policy Evaluation and Compliance

### Compliance States

Every resource evaluated by a policy is marked with a compliance state:

| State | Meaning | Action |
|-------|---------|--------|
| **Compliant** | Resource matches all assigned policy rules | No action needed |
| **Non-compliant** | Resource violates one or more policy rules | Remediate or exempt |
| **Exempt** | Resource is intentionally excluded from policy evaluation | Documented exception (e.g., experimental VNet) |
| **Conflicting** | Multiple policies define conflicting requirements | Resolve policy conflict |

You view compliance state in [Azure Policy Compliance Dashboard](https://learn.microsoft.com/en-us/azure/governance/policy/how-to/view-compliance-data){:target="_blank" rel="noopener noreferrer"}, which shows:
- Overall compliance percentage by management group, subscription, and resource group
- Which policies have non-compliant resources
- Which resources are non-compliant
- Details about individual policy violations

### Policy Exemptions

Exemptions allow specific resources to bypass policy evaluation when business needs warrant it. Exemptions are explicit exceptions documented for audit purposes.

**Types of exemptions:**

| Exemption Type | Scope | Duration | Use Case |
|---|---|---|---|
| **Waiver** | Specific resource | Permanent | Legacy system that cannot comply |
| **Mitigated** | Specific resource | Temporary | Planned remediation within 30 days |

Each exemption includes:
- **Resource being exempted**
- **Policy being exempted**
- **Exemption reason** (compliance justification)
- **Expiration date** (for temporary exemptions)
- **Created by and date** (audit trail)

**Best practice:** Exemptions should be rare. If you find yourself exempting resources frequently, the policy may be too strict or you may have a training/architecture problem.

### Remediation Tasks

For policies with auto-remediation effects (DeployIfNotExists, Modify), Azure can fix non-compliant resources automatically. For policies without auto-remediation, remediation is manual.

**Auto-remediation workflow:**

1. Policy evaluation identifies non-compliant resources
2. Azure automatically applies the remediation (creates missing resource, modifies property)
3. Resource becomes compliant (usually within minutes)
4. Remediation is logged and auditable

**Manual remediation:**

For Audit and Deny policies, you:
1. Review the compliance dashboard to identify non-compliant resources
2. Manually update the resource to comply with policy
3. Policy re-evaluates; resource becomes compliant

**Remediation scope:**

You can target remediation at specific resources, resource groups, or subscriptions. This allows gradual rollout of fixes to avoid unexpected changes.

---

## Azure Blueprints

### What Blueprints Are

[Azure Blueprints](https://learn.microsoft.com/en-us/azure/governance/blueprints/overview){:target="_blank" rel="noopener noreferrer"} package governance and infrastructure together into versioned, repeatable artifacts. A blueprint combines:

- **Policy definitions and initiatives** (what's required)
- **RBAC role assignments** (who can do what)
- **ARM template deployments** (what infrastructure exists)
- **Resource groups** (organized structure)

Instead of manually creating subscriptions, assigning policies, setting RBAC, and deploying templates separately, you create one blueprint and deploy it. Each deployment is versioned, making governance repeatable and auditable.

### Blueprint Structure

A blueprint contains:

| Component | Purpose |
|-----------|---------|
| **Policy assignments** | Which policies apply to this blueprint's resources |
| **Role assignments** | Who can manage resources (Owner, Contributor, Reader) |
| **Template artifacts** | Infrastructure (VNets, storage, compute) |
| **Resource group artifacts** | Placeholder resource groups (actual storage happens in templates) |

**Blueprint versioning:**

When you update a blueprint, you create a new version (e.g., 1.0 → 1.1 → 2.0). Each version is immutable. You can deploy v1.0 and v2.0 side-by-side. This prevents changes to blueprints from affecting existing deployments.

### Blueprint Assignments

An assignment applies a blueprint to a subscription (or management group in newer versions). When you assign a blueprint:

1. Azure creates the resource groups specified in the blueprint
2. Azure applies the RBAC role assignments
3. Azure assigns the policies
4. Azure deploys the ARM templates into the resource groups

**Assignment states:**

| State | Meaning |
|-------|---------|
| **Creating** | Blueprint deployment is in progress |
| **Succeeded** | All blueprint artifacts deployed and policies assigned |
| **Failed** | One or more blueprint artifacts failed to deploy |
| **Updating** | Moving to a new blueprint version |

### When to Use Blueprints

Blueprints are most useful for:
- **Multi-subscription governance:** Ensuring consistent policy, RBAC, and infrastructure across subscriptions
- **Regulated industries:** Packaging compliance requirements as code
- **Enterprise onboarding:** New business units get a blueprint-deployed subscription with correct policies and baseline infrastructure
- **Versioned governance:** Archiving "what was required in Q3 2024" for audit purposes

**Blueprints vs. Policy + ARM Templates:**

- **Policy + ARM + Manual RBAC:** Simpler for single subscriptions; harder to track what was deployed and when
- **Blueprints:** More complex to set up; valuable for large enterprises with many subscriptions

---

## Azure Landing Zones

### What Landing Zones Are

[Azure Landing Zones](https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ready/landing-zone/){:target="_blank" rel="noopener noreferrer"} (from the Cloud Adoption Framework) define a complete, opinionated approach to setting up your Azure environment for governance, security, and scalability. A landing zone is not a single resource; it's an architectural pattern that includes:

- **Management Group hierarchy** (organization structure)
- **Subscription strategy** (platform vs. application subscriptions)
- **Policy and governance** (standards enforcement)
- **Network architecture** (hub-and-spoke connectivity)
- **Identity and access** (Entra ID, RBAC)
- **Logging and monitoring** (central audit trail)
- **Cost management** (budgets and quotas)

### Management Group Hierarchy

Landing Zones use Management Groups to organize subscriptions hierarchically. A typical structure:

```
Root Management Group
├── Platform
│   ├── Identity (subscriptions for identity services)
│   ├── Management (subscriptions for logging, monitoring, governance)
│   └── Connectivity (subscriptions for networking: hub VNet, ExpressRoute, etc.)
└── Landing Zones
    ├── Corp (internal business applications)
    │   ├── Production
    │   ├── Staging
    │   └── Dev
    └── Online (customer-facing applications)
        ├── Production
        ├── Staging
        └── Dev
```

**Hierarchy benefits:**

- **Policies cascade down:** Policies assigned to "Landing Zones" automatically apply to all child management groups
- **Delegation:** Business unit leads manage their own subscriptions while inheriting governance from parent groups
- **Segmentation:** Platform and application concerns are separated

### Platform vs. Application Landing Zones

**Platform landing zones:**
- Contain shared services: hub VNet, ExpressRoute/VPN gateway, logging storage, identity providers
- Managed by central IT/platform team
- Long lifecycle (foundation services)
- Cost is amortized across all workloads

**Application landing zones:**
- Contain workload resources: application VMs, databases, load balancers
- Managed by application teams
- Lifecycle tied to application (created with app, destroyed when app retires)
- Team-specific billing

This separation ensures platform reliability (platform changes don't affect applications) and allows teams to own their infrastructure while inheriting platform standards.

### Landing Zone Templates

Microsoft provides reference implementations:
- **Enterprise-scale architecture:** Complete governance, networking, and policy setup (most comprehensive)
- **Terraform modules:** Infrastructure-as-code for Landing Zone deployment
- **ARM templates:** Alternative to Terraform

These templates automate much of the setup, but many organizations customize them significantly based on specific security, compliance, or cost requirements.

---

## Governance Patterns and Architecture

### Pattern 1: Startup or Small Organization

**Characteristics:**
- Single subscription (or a few for test/prod)
- Limited compliance requirements
- Growth-focused rather than governance-focused

**Policy approach:**
- Assign 5-10 built-in policies focusing on security basics:
  - Deny public access to storage
  - Enforce encryption on VMs
  - Require diagnostic logging
  - Deny old TLS versions
- Use Audit effect initially, shift to Deny after verification
- Few exemptions; most resources should comply
- No custom policies (built-ins handle 80% of needs)

**Governance tools:**
- No Management Groups (single subscription doesn't need them)
- No Blueprints (simple manual setup)
- Resource groups by application or environment

---

### Pattern 2: Mid-Size Organization with Multiple Teams

**Characteristics:**
- 5-20 subscriptions organized by team or environment
- Compliance requirements for specific workloads (PCI-DSS for payments, HIPAA for healthcare)
- Growth; need standardization without over-control

**Policy approach:**
- Create Management Groups: one for test, one for production
- Assign baseline security policies to the root (apply to everything):
  - Encryption, logging, NSG requirements
- Assign workload-specific initiatives:
  - PCI-DSS initiative to payment team subscriptions
  - Audit-related policies to finance systems
- Use Deny for security, Audit for compliance, Modify for auto-remediation of tagging
- Create a few custom policies specific to your organization (e.g., "VMs must be on company domain")

**Governance tools:**
- Use Management Groups for organizing subscriptions
- No Blueprints yet (most subscriptions are older and don't need template-based setup)
- Audit and monitor with Policy Compliance Dashboard

---

### Pattern 3: Enterprise with Enterprise-Scale Architecture

**Characteristics:**
- 50+ subscriptions across business units
- Strict compliance (SOC 2, ISO 27001, industry-specific)
- Platform team managing shared services
- Application teams managing workloads

**Policy approach:**
- Implement Landing Zones with Management Group hierarchy (Platform, Landing Zones, workload-specific)
- Baseline policies on root (security non-negotiables):
  - Deny non-compliant encryption
  - Enforce NSG on all VNets
  - Require diagnostic logging on all resources
  - Block non-approved regions
- Team-specific policies on team management groups (e.g., Finance team requires budget alerts)
- Regulatory compliance initiatives on regulated subscriptions (PCI-DSS, HIPAA, SOC 2)
- Use DeployIfNotExists and Modify extensively for auto-remediation
- Centralized audit log repository (all subscriptions → central Log Analytics)

**Governance tools:**
- Azure Blueprints for new subscriptions (standardized setup)
- Management Groups for hierarchical policy inheritance
- Azure Policy Compliance Dashboard connected to Azure Advisor for cost optimization recommendations
- Regular governance reviews (monthly) to update policies and manage exemptions

**Architecture:**
- Hub-and-spoke networking (central platform manages hub)
- Central logging subscription (all audit logs and activity logs flow here)
- Identity subscription (manages Entra ID, MFA enforcement)
- Management subscription (baseline policies, monitoring)
- Workload subscriptions (application teams manage within governance guardrails)

---

## Policy Remediation in Practice

### How to Do This Well

**1. Test before enforcement:**
- Always deploy policies in Audit mode first
- Monitor compliance dashboard for 1-2 weeks
- Review what would have been blocked
- Adjust policy parameters if needed
- Shift to Deny only after stakeholders understand impact

**2. Provide exemption process:**
- Document exemption criteria (security risk level, business justification, expiration)
- Require approval from security/governance team
- Track all exemptions in a log (spreadsheet or dedicated system)
- Review exemptions quarterly to determine if they should become permanent exceptions (update the policy) or if they're truly temporary

**3. Use auto-remediation for consistency:**
- DeployIfNotExists for missing resources (e.g., diagnostic settings)
- Modify for fixing properties (e.g., adding required tags to untagged resources)
- Test auto-remediation on non-critical resources first

**4. Monitor exemptions closely:**
- If many resources are exempted from one policy, the policy may be too strict
- If exemptions never expire, make them permanent and move on
- Track who created exemptions and when; this provides audit trail

---

### Red Flags

**Too many non-compliant resources:**
- Policy may be misaligned with actual business needs
- Teams may lack awareness of the requirement
- Policy rule may be catching false positives
- **Action:** Review policy rule, communicate the requirement, provide remediation guidance

**Exemptions never expire:**
- The policy requirement is not actually being enforced; it's advisory
- Either commit to the policy and enforce it, or remove it
- **Action:** Make exemptions permanent (update policy to allow the exception) or archive the policy

**Policies conflicting with each other:**
- One policy requires encryption, another allows unencrypted (impossible to satisfy both)
- **Action:** Review policies, combine conflicting ones, or explicitly mark one as higher priority

**Auto-remediation failing silently:**
- DeployIfNotExists failed to deploy missing resource (permissions, API issue)
- Modify failed to update property (property is read-only, value invalid)
- **Action:** Review remediation task output, check RBAC permissions for the managed identity, verify policy rule logic

---

## Compliance Dashboards and Regulatory Assessment

### Azure Policy Compliance Dashboard

The [Policy Compliance Dashboard](https://learn.microsoft.com/en-us/azure/governance/policy/how-to/view-compliance-data){:target="_blank" rel="noopener noreferrer"} shows:

- Overall compliance percentage (across all subscriptions, management groups, and resources)
- Breakdown by policy (which policies have the most non-compliance)
- Breakdown by resource type (which types of resources are non-compliant)
- Trend over time (improving or degrading compliance)
- Exemptions and their expiration dates

**Using the dashboard:**
- **Executive reporting:** "We are 94% compliant with security policies"
- **Team accountability:** "Payment team has 3 non-compliant resources in PCI-DSS initiative"
- **Prioritization:** "These 20 VMs lack encryption; remediate them first"

### Regulatory Compliance Assessment

Azure Policy integrates with [Regulatory Compliance](https://learn.microsoft.com/en-us/azure/governance/policy/how-to/regulatory-compliance){:target="_blank" rel="noopener noreferrer"} to map policies to regulatory requirements:

| Regulatory Framework | Mapped Policies | Use Case |
|---|---|---|
| **PCI DSS v3.2.1** | 32 Azure policies | Payment card processing systems |
| **HIPAA** | 41 Azure policies | Healthcare systems handling PHI |
| **ISO 27001** | 65 Azure policies | Information security management |
| **SOC 2 Type 2** | Policies for availability, integrity, confidentiality | Service organizations |
| **NIST SP 800-53** | 180+ policies | US government agencies |

When you assign the compliance initiative for a framework (e.g., PCI DSS), Azure maps your compliance state to the framework's requirements. During audits, you demonstrate compliance by showing the Regulatory Compliance dashboard.

---

## Common Pitfalls

### Pitfall 1: Policy Too Strict, Blocking Legitimate Work

**Problem:** A policy denies all storage accounts that are not encrypted. A team needs temporary storage for testing with small non-sensitive data.

**Result:** Team spends week getting exemptions and filing tickets instead of completing work. Teams view governance as obstacles.

**Solution:** Provide legitimate paths. Allow unencrypted storage in Dev/Test subscriptions only (different policy for Dev). Require encryption only in Prod. Or allow encryption optional in Dev to reduce operational overhead.

---

### Pitfall 2: Exemptions Become Permanent

**Problem:** Three VMs are exempted from the "require encryption" policy in early 2024 as "temporary." In 2025, those VMs are still exempted and no one remembers why.

**Result:** Security gap persists. Exemptions lose credibility as enforcement mechanism.

**Solution:** Set expiration dates on ALL exemptions. Review expired exemptions quarterly. Make decisions: renew with new justification or remediate the resource. Track exemptions in a system (not spreadsheet) with change history.

---

### Pitfall 3: Policy Evaluation Lag

**Problem:** You deploy a new resource on Monday. Policy evaluation runs nightly. Compliance dashboard shows non-compliant on Tuesday. Team assumes there's a bug.

**Result:** Confusion about when policies actually take effect. Teams don't understand policy latency.

**Solution:** Communicate that policy evaluation is eventual (not immediate). For resources that MUST be compliant immediately, use Deny effect instead of Audit (Deny blocks creation; Audit evaluates later).

---

### Pitfall 4: Auto-Remediation Surprises

**Problem:** A Modify policy automatically adds a "cost-center" tag to all untagged resources. It sets the value to "unassigned." In production, this causes billing system to route costs to wrong departments.

**Result:** Cost confusion and angry department leads. Auto-remediation loses trust.

**Solution:** Test auto-remediation on non-critical resources first. For tagging, require explicit tagging during creation rather than auto-setting. Use Audit initially; shift to Modify only after understanding impact.

---

### Pitfall 5: Misaligning Policy with Actual Enforcement

**Problem:** A policy says "all VMs must be encrypted." It has Audit effect. 20 unencrypted VMs exist. No one encrypts them because there's no enforcement.

**Result:** Policy becomes "advisory documentation" instead of actual control. Teams lose confidence in governance.

**Solution:** Start with Audit to understand impact. Give teams 30 days to remediate. Shift to Deny. Make the deadline real.

---

## Key Takeaways

1. **Azure Policy is enforcement, not documentation.** Unlike written standards, policies mechanically prevent non-compliance. Start with Audit to understand impact, then shift to Deny for real enforcement.

2. **Effects determine impact.** Audit discovers non-compliance. Deny prevents it. DeployIfNotExists and Modify auto-remediate. Choose effects based on your tolerance for risk and operational overhead.

3. **Parameters make policies reusable.** Instead of separate policies for each allowed SKU or region, create one parameterized policy. This reduces maintenance burden and allows consistent enforcement across the organization.

4. **Initiatives group related policies.** Assigning one PCI-DSS initiative is simpler than assigning 32 individual policies. Use initiatives for regulatory frameworks and governance domains.

5. **Management Group hierarchy enables governance at scale.** Policies assigned to parent groups cascade to all children. This allows platform teams to enforce standards without managing each subscription individually.

6. **Azure Blueprints package governance and infrastructure.** For organizations deploying many subscriptions, Blueprints ensure each subscription gets the same policies, RBAC, and baseline infrastructure.

7. **Landing Zones provide complete architecture guidance.** Beyond policy, Landing Zones define subscription strategy, networking, identity, logging, and cost management as an integrated whole.

8. **Exemptions should be rare and temporary.** If you find yourself exempting many resources, the policy is too strict. If exemptions never expire, make them permanent or remove the policy.

9. **Test policies in Audit mode before enforcement.** Understand impact on existing resources. Adjust policy logic. Only shift to Deny after stakeholders acknowledge what will be blocked.

10. **Auto-remediation requires careful validation.** Policies with DeployIfNotExists or Modify effects can fix non-compliance automatically, but test them first to ensure they don't create unexpected side effects.
