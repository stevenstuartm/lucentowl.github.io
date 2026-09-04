---
title: "Azure Policy and Governance"
layout: guide
category: Azure
subcategory: Security and Compliance
description: "How Azure Policy evaluates and enforces standards across a management group hierarchy: the eleven effects and the order they run in, the assignment controls that make rollout safe, what compliance percentages actually count, and how to migrate off Azure Blueprints before it retires."
tags: [governance, azure-policy, management-groups, compliance, landing-zones, security, practical]
---

## What Is Azure Policy and Governance

[Azure Policy](https://learn.microsoft.com/en-us/azure/governance/policy/overview){:target="_blank" rel="noopener noreferrer"} evaluates Azure resources against rules you define, reports which ones comply, blocks non-compliant deployments, and in some cases fixes what it finds. It is the mechanism that turns a written standard into something the platform enforces.

Governance is broader than policy. It also covers [management groups](https://learn.microsoft.com/en-us/azure/governance/management-groups/overview){:target="_blank" rel="noopener noreferrer"} for hierarchy and inheritance, RBAC for who can do what, and [Azure Landing Zones](https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ready/landing-zone/){:target="_blank" rel="noopener noreferrer"} as a reference architecture that assembles all of it. Azure Blueprints used to package these together and is being retired, which is covered below.

### What Problems Governance Solves

**Without Azure Policy:**
- Resources are created with weak settings, and nobody finds out until an audit
- Each team configures things differently, so operations cannot rely on any invariant
- Tagging and encryption standards exist as documents, not as controls
- Compliance posture is a spreadsheet assembled by hand before each review

**With Azure Policy:**
- Non-compliant deployments fail at request time instead of becoming remediation backlog
- Compliance state is continuously evaluated and queryable through Azure Resource Graph
- Standards inherit down a management group hierarchy rather than being reapplied per subscription
- Some classes of drift are corrected automatically

### How Azure Policy Differs from AWS Equivalents

| Concept | AWS | Azure |
|---------|-----|-------|
| **Evaluation** | AWS Config rules | Azure Policy (audit effects) |
| **Preventive control** | Service Control Policies | Azure Policy (deny and denyAction effects) |
| **Tooling split** | Config and SCPs are separate services with separate models | One service covers evaluation, prevention, and remediation |
| **Hierarchy** | SCPs attached to Organizations OUs | Management groups, six levels deep |
| **Remediation** | Config remediation via SSM automation documents | deployIfNotExists and modify effects with a managed identity |
| **Staged rollout** | Largely manual | Built into assignments (enforcement mode, resource selectors, overrides) |
| **Reference implementation** | Control Tower | Azure Landing Zones (CAF reference plus deployable accelerators) |

---

## Scope, Hierarchy, and Where Definitions Live

Policy behavior follows Azure's scope hierarchy, and two separate scopes matter for every assignment: where the *definition* lives, and where the *assignment* applies.

```
Tenant root management group   <- assignments here hit every resource in the tenant
        │
        ├── Platform (management group)
        │      ├── Identity          (subscription)
        │      ├── Management        (subscription)
        │      └── Connectivity      (subscription)
        │
        └── Landing Zones (management group)
               ├── Corp              ── Prod / Staging / Dev subscriptions
               └── Online            ── Prod / Staging / Dev subscriptions

A custom definition must be stored at or above the scope you assign it to.
A definition saved on "Corp" cannot be assigned to anything under "Platform".
```

**Hierarchy limits that shape designs:** a directory supports 10,000 management groups and a tree up to **six levels deep**, not counting the root level or subscriptions. Every management group and subscription has exactly one parent, and new subscriptions land in the root group by default.

**The root management group is special.** It cannot be moved or deleted, nobody has access to it by default, and a Microsoft Entra Global Administrator has to [elevate access](https://learn.microsoft.com/en-us/azure/role-based-access-control/elevate-access-global-admin){:target="_blank" rel="noopener noreferrer"} to manage it. Anything assigned there applies to every resource in the tenant, so treat root assignments as "must have" only.

Two operational details catch people out. Azure Resource Manager caches the management group hierarchy for **up to 30 minutes**, so a move does not show up immediately. And a custom role definition can name only one management group in its assignable scopes, so moving a subscription to a different branch can break the path between a role assignment and its definition, and the move is blocked.

---

## Policy Definitions, Effects, and Initiatives

### Definitions and Parameters

A [policy definition](https://learn.microsoft.com/en-us/azure/governance/policy/concepts/definition-structure){:target="_blank" rel="noopener noreferrer"} pairs a rule (JSON conditions over resource properties) with a single effect. Parameters make one definition serve many cases, so you write "allowed VM SKUs" once and supply different lists per assignment.

Microsoft ships a large catalog of [built-in definitions](https://learn.microsoft.com/en-us/azure/governance/policy/samples/built-in-policies){:target="_blank" rel="noopener noreferrer"} covering most common controls. Built-ins are **versioned**, and an assignment can pin a version: `1.*.*` takes minor and patch updates automatically, `1.1.*` pins to a minor version, and patch updates are always taken because they are limited to text changes and break-glass fixes. Pinning matters when a built-in's logic changes underneath a production assignment.

### The Eleven Effects

Azure Policy supports [eleven effects](https://learn.microsoft.com/en-us/azure/governance/policy/concepts/effect-basics){:target="_blank" rel="noopener noreferrer"}, and each definition carries exactly one.

| Effect | Behavior |
|--------|----------|
| **audit** | Marks non-compliant resources without blocking anything |
| **deny** | Fails the create or update request at validation time |
| **denyAction** | Blocks a specified *action*, most usefully `delete`, protecting resources from removal |
| **append** | Adds fields to the request during create or update |
| **modify** | Adds, updates, or removes properties or tags, including on existing resources |
| **mutate** | Alters resources in Resource Provider modes, such as Kubernetes admission |
| **auditIfNotExists** | Audits when a related child or extension resource is missing |
| **deployIfNotExists** | Deploys the missing related resource, such as a diagnostic setting |
| **manual** | Sets compliance by human attestation rather than evaluation |
| **disabled** | Turns off the rule without removing the assignment |
| **addToNetworkGroup** | Populates an Azure Virtual Network Manager network group |

`denyAction` is the one most estates are missing. Every other preventive effect stops a bad resource being *created*; `denyAction` stops an existing one being *deleted*, which is what protects diagnostic settings, resource locks, and audit configuration from being removed by someone cleaning up.

### Order of Evaluation

Effects do not run in the order you assign them. They run in a fixed sequence, and knowing it explains most surprising outcomes.

```
Create or update request arrives at Azure Resource Manager
          │
          v
  disabled      does this rule run at all?
          │
          v
  append / modify   may alter the request, which can prevent a later
          │         audit or deny from ever triggering
          v
  deny          request fails here (evaluated before audit so a rejected
          │     resource is not also logged as non-compliant)
          v
  audit
          │
          v
  manual
          │
          v
  auditIfNotExists
          │
          v
  denyAction    evaluated last
          │
          v
  Resource Provider does the work
          │
          v
  auditIfNotExists and deployIfNotExists re-evaluate on success,
  triggering compliance logging and remediation
```

Two consequences follow. A `modify` effect can silently satisfy a `deny` policy, because the request is changed before deny sees it. And `deployIfNotExists` only acts *after* the resource provider succeeds, so remediation is always after the fact, never inline.

**Layering is cumulative most restrictive.** Several assignments can hit the same resource from different scopes, and each is evaluated independently. There is no priority system and no way to declare one policy the winner. Two conflicting deny policies simply block everything that fails either one, and the fix is to correct the scopes or the definitions, not to rank them.

### Initiatives

An [initiative](https://learn.microsoft.com/en-us/azure/governance/policy/concepts/initiative-definition-structure){:target="_blank" rel="noopener noreferrer"} bundles definitions so you assign and parameterize once instead of many times. Regulatory frameworks ship as built-in initiatives, and grouping by domain (encryption, tagging, networking) is equally valid. Assignment-level `overrides` can change the effect of individual definitions inside an initiative without forking it, which is what makes large built-in initiatives practical to adopt gradually.

---

## Assignment Controls That Make Rollout Safe

The [assignment](https://learn.microsoft.com/en-us/azure/governance/policy/concepts/assignment-structure){:target="_blank" rel="noopener noreferrer"} is where most of the operational leverage sits, and it is the part guides usually skip in favor of "start with Audit, then switch to Deny." That advice is not wrong, but it is the crudest of the available tools.

| Control | What it does | When to reach for it |
|---|---|---|
| **enforcementMode** | `Default` enforces the effect. `DoNotEnforce` evaluates compliance without enforcing and without writing deny entries to the Activity Log. `Enroll` enforces only for scopes that opt in via an enrollment resource | Testing a real deny policy against production traffic before it bites |
| **resourceSelectors** | Restricts evaluation by resource location, type, or absence of a location. Up to 10 selectors per assignment, 50 values each | Rolling an assignment out region by region |
| **overrides** | Replaces the effect (or pinned version) of specific definitions inside an initiative. Up to 10 overrides, each covering up to 50 definition references | Adopting a large built-in initiative with some definitions disabled |
| **notScopes** | Excludes child scopes from the assignment entirely | A subscription that genuinely should not be governed by this assignment |
| **nonComplianceMessages** | Custom text shown when a deny blocks a request | Turning a cryptic rejection into an actionable one |
| **definitionVersion** | Pins which version of a built-in is evaluated | Preventing an upstream definition change from breaking a production assignment |

`DoNotEnforce` is the honest answer to "test before you enforce." A `deny` assignment in `DoNotEnforce` mode reports exactly what it would block without blocking it, which an `audit` version of the same policy does not, because audit and deny can evaluate differently. Remediation tasks for `deployIfNotExists` policies can still be run manually while an assignment is in `DoNotEnforce`.

`nonComplianceMessages` is the cheapest thing on this list and the most underused. A developer whose deployment fails with a generic policy rejection files a ticket. One who sees "Storage accounts must disable public network access. See wiki/storage-standards" fixes it themselves.

---

## Evaluation Timing and Compliance State

### When Evaluation Happens

Policy has two distinct behaviors that get conflated: **enforcement**, which is synchronous at request time, and **compliance reporting**, which is not.

| Trigger | Timing |
|---|---|
| A resource is created or updated | The effect (deny, append, modify) applies immediately at request time. Compliance state for that resource appears about **15 minutes** later |
| A policy or initiative is newly assigned or updated | About **5 minutes** for the assignment to apply, then an evaluation cycle begins with no predictable completion time |
| A subscription is created or moved in the hierarchy | Around **30 minutes** |
| An exemption is created, updated, or deleted | The corresponding assignment re-evaluates |
| Standard compliance cycle | **Every 24 hours** |
| On-demand scan | Triggered through REST, CLI, PowerShell, the VS Code extension, or a GitHub Action |

A `deny` policy is never late. The resource is rejected by Resource Manager before it is created. What lags is the dashboard, which is why a newly deployed resource can look non-compliant for a quarter of an hour and why "policy did not work" reports are usually reporting lag.

Not every resource provider supports on-demand scans or the daily cycle, so verify before you build a process around scan-then-check.

### Compliance States

There are more states than the dashboard's headline suggests.

| State | Meaning |
|-------|---------|
| **Non-compliant** | The rule evaluated true for an audit-class effect, or an existing resource fails a deny-class effect |
| **Compliant** | The rule evaluated false |
| **Exempt** | An exemption covers this resource for this assignment |
| **Conflicting** | Two or more assignments in the same scope have contradicting rules, such as two definitions appending the same tag with different values |
| **Protected** | The resource is covered by a `denyAction` assignment |
| **Unknown** | Default for `manual` effect definitions awaiting attestation |
| **Error** | The assignment produced a template or evaluation error |
| **Not started** | The evaluation cycle has not run yet |
| **Not registered** | The `Microsoft.PolicyInsights` provider is unregistered, or the caller lacks read permission |

### The Compliance Percentage Counts Exemptions as Compliant

This is the number executives see, and here is exactly what it measures:

```
compliance % = (compliant + exempt + unknown + protected)
               ─────────────────────────────────────────────────────────
               (compliant + exempt + unknown + protected
                + non-compliant + conflicting + error)
```

Exempt resources sit in the numerator. So does `unknown`, which is the default for manual-effect policies nobody has attested. An estate can move from 80% to 98% compliant without a single resource changing, purely by granting exemptions. Any compliance report that does not also show the exemption count is easy to game, accidentally or otherwise.

When rolling up across an initiative, states rank in this order: non-compliant, compliant, error, conflicting, protected, exempted, unknown. Non-compliant wins, so a resource failing one policy in a fifty-policy initiative reads as non-compliant for the whole initiative.

---

## Exemptions, Exclusions, Overrides, and Enforcement Mode

Four mechanisms let a resource escape a policy, and they are not interchangeable. Picking the wrong one is how governance quietly stops meaning anything.

```
A resource should not be blocked by this assignment. Which control?

Should it still appear in compliance reporting?
├─ No, it is genuinely out of scope for this policy
│   └─ notScopes (exclusion). Not evaluated, invisible, no audit trail
│
└─ Yes, keep it visible and tracked
    │
    ├─ Just this resource, for a documented reason
    │   ├─ The policy's intent is met another way ──> Exemption, Mitigated
    │   └─ Non-compliance is accepted for now ──────> Exemption, Waiver
    │      (both carry expiresOn, metadata, and an approval trail)
    │
    ├─ The whole assignment, while you assess impact
    │   └─ enforcementMode: DoNotEnforce
    │
    └─ One definition inside an initiative, everywhere
        └─ overrides, setting that definition's effect to disabled or audit
```

### Exemption Categories Are Not Duration Labels

Both categories can be permanent or temporary. They describe *why*, not *how long*:

- **Mitigated:** the policy's intent is satisfied through some other mechanism, so the finding is not a real gap
- **Waiver:** the non-compliant state is accepted, or the resource is being excluded from some definitions in an initiative without leaving the whole initiative

**An exemption is not deleted when it expires.** The `expiresOn` date stops the exemption being honored, but the object is preserved for record-keeping. Expired exemptions accumulate as clutter that still looks like an active exception in a listing, so cleaning them up is a separate task.

Exemptions carry a free-form `metadata` object, and using it (requester, approver, approval date, ticket reference) is what turns an exemption from a hole into an auditable decision. Creating one needs more than write permission. The principal must also hold the `exempt/Action` verb on the target assignment.

Exemptions also support resource selectors, including **identity-based** ones. Selecting on `userPrincipalId` or `groupPrincipalId` exempts a specific service principal, managed identity, or security group from an assignment's enforcement, which is a cleaner answer than exempting the resources a privileged pipeline happens to touch.

Finally, an exempt resource has a **compliance substate** showing what its state would be without the exemption. Query `properties.stateDetails.complianceSubState` in Azure Resource Graph to see what you are actually carrying behind the exemptions.

---

## Remediation

`deployIfNotExists` and `modify` are the only effects that fix things, and both need an identity to do it.

**Every such assignment carries exactly one managed identity**, system-assigned or user-assigned, and that identity needs the Azure roles required by whatever it deploys or modifies. A system-assigned identity also requires a top-level `location` on the assignment, which cannot be `global` and cannot be changed afterward.

**Two identities are involved, and this is where silent failures come from.** For a `deployIfNotExists` policy, the *caller's* identity evaluates the existence condition, while the *assignment's* identity performs the deployment. A policy that deploys diagnostic settings onto key vaults therefore needs the deploying user to hold `Microsoft.Insights/diagnosticSettings/read` and the assignment identity to hold `Microsoft.Insights/diagnosticSettings/write`. Grant only the second and evaluation misfires; grant only the first and the deployment fails.

**Remediation is not retroactive by default.** Assigning a `deployIfNotExists` policy makes new resources compliant going forward and marks existing ones non-compliant. Fixing the existing ones requires an explicit remediation task, which you can scope to specific resources, resource groups, or subscriptions to roll the fix out gradually.

**When remediation fails silently, check in this order:** the assignment identity's role assignments, whether the target property is actually writable, whether the existence condition matches what the deployment creates (a mismatch produces an infinite redeploy), and the remediation task's own error output.

---

## Azure Blueprints Is Retiring

[Azure Blueprints](https://learn.microsoft.com/en-us/azure/governance/blueprints/blueprint-retirement){:target="_blank" rel="noopener noreferrer"} packaged policy assignments, role assignments, ARM templates, and resource groups into versioned, assignable bundles. It never left preview, and it is being retired on a phased schedule.

| Date | What stops working |
|---|---|
| **July 31, 2026** | New blueprint definitions and versions can no longer be created |
| **October 31, 2026** | Existing definitions can no longer be modified. New assignments can no longer be created |
| **December 31, 2026** | Existing assignments can no longer be modified |
| **January 31, 2027** | The service is retired. The API stops responding, CLI and PowerShell commands stop working, and Blueprints is removed from the portal |

Two things about that final date deserve emphasis. **Definitions, versions, and assignments that have not been exported are permanently deleted and cannot be recovered**, so exporting is a hard deadline, not a nice-to-have. And **blueprint locks stop functioning**, which means "Do Not Delete" and "Read Only" protections applied through blueprints silently disappear. Resources deployed by blueprints are not deleted. They simply become unmanaged.

### The Replacement Is Two Features, Not One

Blueprints did two jobs, and they are now separate:

| Blueprint capability | Replacement |
|---|---|
| Storing and versioning the artifact | **Template specs**, or a Git repository with pull-request review |
| Assigning, deploying, managing lifecycle, and locking | **[Deployment stacks](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/deployment-stacks){:target="_blank" rel="noopener noreferrer"}** |

Deployment stacks are the recommended replacement for the assignment half, because they group resources as a unit, manage their lifecycle including deletion, and provide deny-assignment enforcement equivalent to blueprint locks. They work at resource group, subscription, and management group scope, and both they and template specs are generally available rather than preview.

Policy assignments and role assignments, which were blueprint artifact types, become ordinary resources declared in ARM or Bicep. The typical migration stores the template as a template spec (or in Git) and deploys it with a deployment stack.

**To find where Blueprints is still in use:** Azure Advisor surfaces a recommendation naming the affected subscriptions and management groups, and the Blueprints blade lists existing definitions and assignments directly.

---

## Azure Landing Zones

An [Azure Landing Zone](https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ready/landing-zone/){:target="_blank" rel="noopener noreferrer"} is an architectural pattern from the Cloud Adoption Framework, not a resource you create. It specifies the management group hierarchy, subscription strategy, policy baseline, network topology, identity model, logging destination, and cost controls as one design.

### Platform vs Application Landing Zones

**Platform landing zones** hold shared services: the hub network, gateways, the central Log Analytics workspace, identity infrastructure. A platform team owns them, they have a long lifecycle, and their cost is amortized.

**Application landing zones** hold workload resources. Application teams own them, their lifecycle matches the application, and they inherit governance from the management groups above rather than defining their own.

The separation exists so that platform changes do not ship on application timelines, and so application teams get autonomy inside guardrails they cannot remove.

Microsoft publishes deployable reference implementations, including a portal-based accelerator and Bicep and Terraform modules. Most organizations customize them, and the customization is usually in the policy baseline and the network topology rather than the hierarchy.

---

## Governance Patterns

### Pattern 1: Single Team, Few Subscriptions

- Assign a handful of built-in security policies: deny public storage access, require encryption, require diagnostic logging, deny legacy TLS
- Run new assignments in `DoNotEnforce` briefly, then switch to `Default`
- Skip custom definitions, because built-ins cover most of what a small estate needs
- Management groups are optional at this size, but creating even a two-level hierarchy early avoids a painful migration later

### Pattern 2: Multiple Teams, Shared Standards

- Build a management group hierarchy that separates environments and business units
- Put the non-negotiable baseline at the top: encryption, logging, allowed regions
- Attach regulatory initiatives only to the subscriptions that need them, not to the root
- Use `modify` for tagging and `deployIfNotExists` for diagnostic settings, with remediation tasks to catch the existing estate
- Store custom definitions at a management group high enough to be assignable everywhere they are needed

### Pattern 3: Enterprise Scale

- Implement Landing Zones with a full platform and application management group split
- Baseline policies at the root, team policies on team management groups
- `denyAction` on the resources that carry your audit trail, so cleanup scripts cannot remove them
- Pin `definitionVersion` on production assignments of built-in initiatives
- Roll new assignments out with `resourceSelectors` by region rather than estate-wide
- Route all compliance data to Azure Resource Graph for reporting rather than reading the portal
- Review exemptions on a schedule, and report the exemption count alongside the compliance percentage

---

## Regulatory Compliance Reporting

Azure Policy ships built-in initiatives that map definitions to regulatory frameworks. The current catalog includes **PCI DSS v4.0.1**, **ISO/IEC 27001:2022**, **NIST SP 800-53 R5.1.1**, **CIS Microsoft Azure Foundations Benchmark**, HIPAA, SOC 2, FedRAMP, CMMC Level 2, DORA, and many others, across Azure, AWS, and GCP. Framework versions move, so check which version an initiative targets rather than assuming the one your auditor named is the one assigned.

**The dashboard has a licensing requirement the initiatives do not.** [Microsoft Cloud Security Benchmark](https://learn.microsoft.com/en-us/azure/defender-for-cloud/concept-regulatory-compliance-standards){:target="_blank" rel="noopener noreferrer"} (MCSB) is enabled by default when you turn on Defender for Cloud. Every other standard has to be assigned explicitly, and reaching compliance standards in Defender for Cloud requires onboarding a Defender for Cloud plan (any plan except Defender for Servers Plan 1 or Defender for API Plan 1), plus Owner or Policy Contributor permission on the scope. Budgeting a regulatory reporting programme as free because Azure Policy is free misses this.

Two reporting caveats. Controls that cannot be assessed automatically show as greyed out rather than failing, so a green dashboard covers only the machine-checkable subset of a framework. And a standard with no relevant resources in scope does not appear at all, even when assigned, which can read as coverage when it is absence.

---

## Common Pitfalls

### Pitfall 1: Using Audit as the Test for a Deny Policy

**Problem:** a `deny` policy is tested by assigning its `audit` equivalent first, on the assumption they evaluate identically.

**Result:** audit and deny evaluate at different points and can produce different outcomes, particularly when an `append` or `modify` policy alters the request first. The audit run looks clean and the deny run blocks deployments.

**Solution:** assign the actual `deny` policy with `enforcementMode` set to `DoNotEnforce`. It reports precisely what it would block, using the same evaluation path, without blocking anything or writing deny entries to the Activity Log.

---

### Pitfall 2: Reading the Compliance Percentage Without the Exemption Count

**Problem:** compliance is reported to leadership as a single percentage.

**Result:** exempt, unknown, and protected resources all count as compliant in that calculation. An estate can improve its score substantially by granting exemptions, and manual-effect policies that nobody has attested sit in `unknown`, which also counts as compliant.

**Solution:** report the exemption count and the `unknown` count next to the percentage. Query `complianceSubState` in Resource Graph to see what the exempt resources would be if the exemptions lapsed.

---

### Pitfall 3: Excluding When You Meant to Exempt

**Problem:** a subscription that needs an exception is added to `notScopes`.

**Result:** it is not evaluated at all. It does not appear as non-compliant, exempt, or anything else, there is no expiry, no justification, and no approval record. The exception is invisible to the next audit.

**Solution:** exclusions are for scopes genuinely outside the policy's remit. Exceptions for resources that should comply but currently do not are exemptions, with a category, an expiry, and metadata recording who approved them and why.

---

### Pitfall 4: Auto-Remediation Applied Estate-Wide on Day One

**Problem:** a `modify` policy adds a `cost-center` tag with a default value of `unassigned` to every untagged resource, everywhere, immediately.

**Result:** chargeback routes to the wrong departments, and the tag now looks deliberate rather than missing, so the real gap is harder to find.

**Solution:** roll the assignment out with `resourceSelectors` scoped to one region or resource type, verify, then widen. For attribution data specifically, prefer denying untagged resources at creation over inventing a value, because a wrong tag is worse than an absent one.

---

### Pitfall 5: Remediation That Never Runs

**Problem:** a `deployIfNotExists` assignment is created and existing resources stay non-compliant.

**Result:** two common causes. The assignment identity lacks the roles needed to deploy what the policy deploys, or no remediation task was ever created, since assignment alone only governs new and updated resources.

**Solution:** grant the assignment's managed identity the required roles at the right scope, remembering that the caller's identity evaluates the existence condition while the assignment identity performs the deployment. Then create an explicit remediation task for the existing estate, scoped narrowly at first.

---

### Pitfall 6: Trying to Rank Conflicting Policies

**Problem:** two assignments disagree, and the response is to look for a priority setting to declare a winner.

**Result:** there is no such setting. Assignments are evaluated independently and the outcome is cumulative most restrictive, so two conflicting denies block everything that fails either. A `Conflicting` compliance state means two assignments in the same scope have contradicting rules, such as appending the same tag with different values.

**Solution:** fix the definitions or the scopes. Where an initiative contains a definition you do not want at a particular scope, use an assignment `override` to disable that one definition rather than adding a competing assignment.

---

### Pitfall 7: Blueprints Left in Place Past Its Dates

**Problem:** blueprint definitions and assignments are still in use, with migration deferred because "resources deployed by blueprints keep working."

**Result:** they do keep working, but the schedule bites earlier than the retirement date. Modification of definitions stops in October 2026 and modification of assignments in December 2026, so the window to change anything closes months before the service does. Unexported definitions and assignments are permanently deleted in January 2027, and blueprint locks stop protecting anything.

**Solution:** inventory usage now through the Azure Advisor recommendation, export everything you need to keep, and migrate the definition half to template specs or Git and the assignment half to deployment stacks. Replace blueprint locks with deployment stack deny settings explicitly, because nothing carries them over.

---

## Key Takeaways

1. **Azure Policy enforces synchronously and reports asynchronously.** Deny blocks the request at Resource Manager. Compliance state for a new resource appears about 15 minutes later, and the full estate re-evaluates every 24 hours.

2. **There are eleven effects, and they run in a fixed order.** Disabled, then append and modify, then deny, audit, manual, auditIfNotExists, and denyAction last. A modify can satisfy a deny before deny ever sees the request.

3. **`denyAction` protects what already exists.** Every other preventive effect stops bad resources being created. This one stops good ones being deleted, which is how you protect diagnostic settings and audit configuration.

4. **`enforcementMode: DoNotEnforce` is the real dry run.** Testing a deny policy by assigning its audit equivalent tests a different evaluation path.

5. **Compliance percentage counts exempt, unknown, and protected resources as compliant.** Never report the number without the exemption count beside it.

6. **Exemption categories describe reason, not duration.** Mitigated means the intent is met another way; Waiver means non-compliance is accepted. Both can carry an expiry, and neither is deleted when it expires.

7. **Exclusion is not exemption.** `notScopes` removes a scope from evaluation entirely, leaving no record. Exemptions keep the resource visible, tracked, and attributable.

8. **Remediation needs an identity and a task.** deployIfNotExists and modify each require one managed identity with the right roles, and existing resources are only fixed by an explicit remediation task.

9. **Conflicts are cumulative most restrictive, with no priority order.** Two conflicting denies block everything. Fix the scopes or use assignment overrides.

10. **Custom definitions must live at or above the scope they are assigned to**, and management group hierarchies are capped at six levels with a 30-minute Resource Manager cache on moves.

11. **Azure Blueprints retires January 31, 2027**, with creation frozen from July 2026 and modification frozen from October and December 2026. Unexported content is permanently deleted and blueprint locks stop functioning. Migrate to template specs plus deployment stacks.

12. **Regulatory dashboards are not free.** MCSB is on by default with Defender for Cloud, but every other standard requires a paid Defender for Cloud plan, and controls that cannot be assessed automatically are excluded from the score rather than failed.
