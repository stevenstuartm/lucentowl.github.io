---
title: "IaC Governance and Compliance"
layout: guide
category: Infrastructure & Cloud
subcategory: Infrastructure as Code
description: "Keeping infrastructure compliant when many teams deploy it: where preventive, detective, and corrective controls sit and which changes each can see, organization-level guardrails in AWS and Azure, a tagging strategy that holds, responding to drift, and handling exceptions."
tags: [practical, governance, guardrails, tagging, drift-detection, service-control-policies, azure-policy]
---

## Where a Control Can Sit

A **control** is a rule the organization wants every piece of infrastructure to follow, such as "no storage open to the internet" or "every resource has an owner tag", together with the mechanism that enforces it. Controls come in three kinds:

- **Preventive** controls stop a non-compliant change before it takes effect.
- **Detective** controls find non-compliant resources that already exist and report them.
- **Corrective** controls fix what a detective control found, or revert it.

Which kind to use depends less on the rule than on the paths a change can take. A resource can arrive through the IaC pipeline, but it can also arrive through the console, a CLI command, a script, or another tool. Each place a control can sit sees only some of those paths:

{% include figure.html id="infra-control-placement" %}

| Control point | Examples | Sees | Misses |
|---|---|---|---|
| **Pipeline checks** | Scanners and policy checks on the plan | Changes made through that pipeline, before they deploy | Every change made any other way |
| **Deployment-service hooks** | CloudFormation Hooks, which also back the controls AWS Control Tower calls *proactive* (its name for pre-deployment checks) | Deployments through that service from any source, and with CloudFormation, requests through the Cloud Control API, the uniform create, read, update, and delete API that some IaC tools call | Most direct API calls, and IaC tools that deploy through neither. AWS notes proactive controls may not affect requests made through the console, APIs, SDKs, or other IaC tools |
| **Organization policy at the cloud API** | AWS service control policies, Azure Policy with the `deny` effect, Google Cloud organization policies | Every request from the accounts it covers, whatever tool sent it | Anything the request doesn't carry, resources created before the policy, and exempt principals. AWS SCPs, for example, don't apply to the management account or to service-linked roles, which AWS services assume to act on your behalf |
| **Detective rules** | AWS Config rules, Azure Policy with the `audit` effect | Every resource of the types and Regions they cover, including ones created before the rule | Resource types the service doesn't record, Regions where it isn't enabled, and anything in the window before evaluation |

A rule that must hold absolutely, such as allowed regions or no public storage, belongs at the cloud API, the only preventive point every path crosses. The same rule often belongs at more than one point on purpose, though. The pipeline check gives the author a clear message in the pull request, the API policy catches whatever bypasses the pipeline, and the detective rule covers resources that predate both.

Corrective controls hang off the detective ones. AWS Config can run a Systems Manager Automation document to remediate a non-compliant resource, Azure Policy runs remediation tasks, and cross-cloud tools such as [Cloud Custodian](https://cloudcustodian.io/){:target="_blank" rel="noopener noreferrer"} express both the rule and the fix in one policy file.

---

## Organization-Level Guardrails

A **guardrail** is a preventive or detective control applied across many accounts or subscriptions at once, set centrally so individual teams cannot switch it off.

### Where Guardrails Attach

Each cloud has a containment hierarchy, and a guardrail applies to everything below the level it is attached to:

| Cloud | Hierarchy | Guardrail mechanisms |
|---|---|---|
| **AWS** | Organization root, then organizational units (OUs), then accounts | Service control policies (SCPs) cap what principals in member accounts can do. Resource control policies (RCPs) cap what can be done to resources. Both are inherited down the tree, never grant permissions on their own, and do not apply to the organization's management account. *Declarative policies* set a baseline configuration for a service across accounts, such as blocking public access to EC2 snapshots |
| **Azure** | Management groups, then subscriptions, then resource groups, then resources | Azure Policy assignments, inherited downward. Where several assignments apply, the result is the most restrictive combination |
| **Google Cloud** | Organization, then folders, then projects | Organization policy constraints, including custom constraints |

Attaching at a high level covers new accounts automatically, which is the point. It also means a mistake reaches every account, so a new guardrail is best introduced in a mode that reports without blocking. An Azure Policy assignment can start with the `audit` effect or with enforcement turned off, and Google Cloud supports dry-run organization policies for custom and managed constraints. The findings show what the guardrail would have blocked, and it is switched to enforcing once that list is understood. An SCP has no report-only mode, so it is tried on a test OU first, with accounts moved into it a few at a time.

### What Azure Policy Can Do

Azure Policy's `effect` decides what happens when a resource matches a rule, and the common effects span all three kinds of control:

| Effect | What it does | Kind |
|---|---|---|
| `deny` | Rejects the request before the resource is created or changed | Preventive |
| `modify`, `append` | Change the request as it passes, such as adding a missing tag | Preventive, and corrective through remediation tasks for `modify` |
| `audit` | Records non-compliance without blocking | Detective |
| `auditIfNotExists` | Reports a missing companion resource, such as a diagnostic setting | Detective |
| `deployIfNotExists` | Deploys the missing companion resource after the main one is created | Corrective, including for existing resources through remediation tasks |

### Common Guardrails

Most organizations start with a short list: restrict which regions can be used, prevent disabling audit logging, prevent accounts from leaving the organization, block public access to storage, and require encryption. Broad denials have a cost. A team blocked by a guardrail it didn't know about loses time working out why, so the list of guardrails should be published, along with where to ask for an exception. AWS has been rolling out a fix since early 2026: an access-denied error caused by an explicit deny in an SCP or RCP names that policy's Amazon Resource Name (ARN) when the caller is in the same organization. Azure Policy can attach a custom non-compliance message to a `deny`. The guardrails themselves are best kept as code and reviewed like any other change.

### Guardrails for Teams Deploying Their Own Infrastructure

When application teams deploy their own infrastructure code, their pipeline's role is itself a control point. An IAM *permission boundary* sets the maximum permissions a role can ever have, and requiring the same boundary on any role the pipeline creates stops a team from escaping it by creating a more powerful role. Deny statements can protect shared resources, such as the network, from changes by application roles, and Azure resource locks or the `denyAction` policy effect can block deletion of them outright. Production deployments usually also sit behind an approval gate in the pipeline.

---

## A Tagging Strategy That Holds

Tags carry the information that governance, cost reporting, and automation depend on: who owns a resource, which environment and application it belongs to, which cost center pays for it, and whether a scheduler or backup job should act on it.

### Keep the Required Set Small

A handful of required tags that every resource carries is worth more than a long list that most resources half-follow. A common set is an owner or team, an environment, and an application or cost center, with allowed values defined centrally. In AWS, tag keys and values are case-sensitive, so `Environment=Prod` and `environment=prod` are different tags to every report and policy. AWS cost reports also show a user-defined tag only after it has been activated as a cost allocation tag in the billing console.

### Enforce in the Code First

The cheapest enforcement is making the code tag everything by default. The Terraform AWS provider's `default_tags` setting applies a set of tags to every resource the provider creates, and a shared module can require the same tags as inputs. Enforcement then catches the gaps rather than every resource.

### Enforce at the Platform

- **AWS tag policies** standardize tag keys, their case, and their allowed values across the organization. When enforced for a resource type, they reject a tagging request that breaks the policy. They do not add missing tags, and they do not evaluate untagged resources, so on their own they cannot require a tag. Since November 2025, a tag policy can also list *required* tag keys per resource type, and IaC tools check deployments against it before resources are created: a CloudFormation hook (`AWS::TagPolicies::TaggingComplianceValidator`, in warn or fail mode), the Terraform AWS provider from version 6.22, and a Pulumi policy pack.
- **An SCP** can deny a create request that lacks a tag, using a condition on `aws:RequestTag`. That only works for actions that accept tags at creation, so it cannot cover every resource type.
- **Azure Policy** can `deny` resources missing a tag, or `modify` them to add it, including copying a tag from the resource group onto each resource in it.
- **Detective rules**, such as AWS Config's `required-tags` managed rule, catch what the preventive controls missed and report resources that predate the rules.

Automatically stamping default values onto untagged resources, such as `environment=dev`, looks tidy but hides the gap. A resource tagged by a default is indistinguishable from one tagged on purpose, so blocking, or notifying an owner, usually serves better.

---

## Responding to Drift

Drift is a change made outside the IaC code. Governance decides how it is found and what happens next.

### Finding It

- **A scheduled plan.** `terraform plan -detailed-exitcode` exits with code 2 when the plan has changes, so a nightly job can plan every configuration and alert on a non-empty result. A plain plan also reports merged code that hasn't been applied yet, so adding `-refresh-only` narrows the alert to drift alone. HCP Terraform's Standard and Premium editions run a scheduled drift check as a built-in *health assessment*.
- **CloudFormation drift detection** compares each stack's resources with its template when asked. It marks unsupported resource types as not checked, and it compares only properties set explicitly in the template, so a changed default goes unnoticed. An AWS Config managed rule runs it on a schedule across stacks and reports drifted ones.
- **Change history.** AWS Config records each configuration change, and CloudTrail or the Azure Activity Log records who made it. A drift finding that names who changed what, and when, is far quicker to resolve.

### Deciding What to Do

Each drift finding has three possible answers:

| Response | When | How |
|---|---|---|
| **Revert** | The change was a mistake or unauthorized | Re-apply the code. In CloudFormation a normal update compares template to template and ignores drift, so reverting needs a drift-aware change set, one that compares against the resources' actual state |
| **Adopt** | The change was right, such as a fix made during an incident | Change the code to match, so the next apply keeps it |
| **Accept** | The attribute is meant to change at runtime | Exclude it from what the tool manages, for example with Terraform's `ignore_changes` |

Reverting automatically is safe for narrow rules with one correct answer, such as re-enabling a storage bucket's public access block. As a blanket policy, it can undo the incident fix that an on-call engineer just made. The durable fix for drift is to make it rare. Production write access in the console can be limited to a *break-glass* role, one that is used only in an emergency and audited whenever it is, with everyday changes going through code.

---

## Handling Exceptions

Every guardrail eventually meets a legitimate case it wasn't written for. Without a way to grant an exception, teams route around the control, or someone weakens it for everyone. A well-run exception is:

- **Scoped** to specific resources or a specific rule, not a whole account.
- **Recorded** with an owner, a reason, and an approver, where the control itself can see it.
- **Temporary**, with an expiry date that forces a review.

Azure Policy builds this in. An *exemption* applies to one assignment, or to specific policies within an *initiative* (a group of policy definitions assigned together), at a chosen scope. It has a category: *waiver* for accepted non-compliance, or *mitigated* when the policy's intent is met another way. It can also carry an `expiresOn` date, after which it stops being honored, though the record stays. Creating one requires a separate permission on the assignment.

AWS has no single exemption object. The equivalents are conditions in an SCP that exclude a named role or a tagged resource, and scoping a Config rule to leave resources out. Scanner suppressions in code serve the same purpose earlier in the pipeline.

The number of open exceptions against a rule is itself a signal. A rule that needs constant exceptions is usually wrong, too broad, or missing a supported alternative.
