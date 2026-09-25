---
title: "AWS CloudFormation: Advanced"
layout: guide
category: AWS
subcategory: Infrastructure as Code
description: "CloudFormation beyond a single stack: nested stacks, StackSets across accounts and Regions, custom resources, registry extensions, and Hooks, detecting and fixing drift, importing existing resources, and moving resources between stacks with stack refactoring."
tags: [cloudformation, nested-stacks, stacksets, custom-resources, drift-detection, stack-refactoring, advanced]
---

## Beyond One Stack

A single stack works until a system outgrows it. Templates approach the 500-resource limit, several teams need to change different parts at different speeds, the same baseline has to exist in dozens of accounts, or resources that were created by hand need to come under management. CloudFormation has a tool for each:

| Need | Tool |
|---|---|
| Reuse a component, or split a large template, within one deployment | Nested stacks |
| Deploy one template to many accounts and Regions | StackSets |
| Manage something CloudFormation has no resource type for, or enforce rules on every deployment | Custom resources, registry extensions, and Hooks |
| Find and fix changes made outside CloudFormation | Drift detection |
| Bring existing resources under management, or reorganize stacks without recreating resources | Import and stack refactoring |

Separate stacks that share values through exports, `Fn::GetStackOutput`, or Parameter Store remain the simplest split of all.

---

## Nested Stacks

A **nested stack** is a stack that another stack creates as one of its resources, of type `AWS::CloudFormation::Stack`. The parent passes parameters in, and reads the child's outputs with `!GetAtt`:

```yaml
Resources:
  Network:
    Type: AWS::CloudFormation::Stack
    Properties:
      TemplateURL: https://example-templates.s3.amazonaws.com/network.yaml
      Parameters:
        VpcCidr: 10.0.0.0/16

  Service:
    Type: AWS::CloudFormation::Stack
    Properties:
      TemplateURL: https://example-templates.s3.amazonaws.com/service.yaml
      Parameters:
        VpcId: !GetAtt Network.Outputs.VpcId
        SubnetIds: !GetAtt Network.Outputs.PrivateSubnetIds
```

Child templates live in S3. The CLI's `aws cloudformation package` command uploads local child templates and rewrites the parent's paths to point at them.

The whole tree deploys and rolls back as one unit from the **root stack**. AWS recommends starting every update from the root rather than updating a child directly, since the next root update applies the parent's version of each child again. A change set on the root can include the changes in every nested stack, and one operation can change at most 2,500 resources across the tree.

Nested stacks suit reusable components, such as a standard network or a standard queue with its alarms, and templates too large for one file, as long as everything deploys together. They suit separate teams poorly. A failure anywhere rolls back the whole tree, and one team can't deploy its part alone. When parts have different owners or release cycles, separate stacks with references fit better. Drift detection on a root stack also doesn't look into its nested stacks, so each has to be checked on its own.

---

## StackSets

A **StackSet** deploys one template as a stack in each of many accounts and Regions, such as a security baseline, logging configuration, or IAM roles every account needs. Each deployed stack is a **stack instance**. A StackSet lives in the **administrator account** and Region where it's created, and it deploys to **target accounts**.

StackSets use one of two permission models:

- **Self-managed.** You create an administration role in the administrator account, and in each target account an execution role whose trust policy lets the administration role assume it. Any account where those roles can be created can be a target.
- **Service-managed.** StackSets uses AWS Organizations, AWS's service for grouping accounts, to create the roles itself, once trusted access between the two is turned on. You target organizational units (OUs), optionally filtered to particular accounts, and with **automatic deployment** on, an account that joins a targeted OU gets its stack instances without anyone updating the StackSet, and an account that leaves has them removed or retained. The administrator is the organization's **management account** or a **delegated administrator**, a member account given that role. Stacks aren't deployed to the management account even when it sits in a targeted OU.

A template change deploys to every stack instance. **Operation preferences** control how fast that happens and when it stops:

| Preference | Controls |
|---|---|
| **Maximum concurrent accounts** | How many accounts, by number or percentage, deploy at once within a Region |
| **Failure tolerance** | How many failures, per Region, stop the operation |
| **Region concurrency and order** | Whether Regions deploy one at a time in a given order, or in parallel |
| **Concurrency mode** | **Strict**, the default, starts at the lower of the maximum and the failure tolerance plus one, and slows as failures accumulate. **Soft** runs at the maximum regardless of failures. |

{% include figure.html id="aws-cfn-stackset-rollout" %}

Rolling out a few accounts at a time, one Region at a time, with a low failure tolerance, limits the damage a bad template can do across an organization. Under the default strict mode, a failure tolerance of zero means one account at a time, however high the maximum is set. StackSets doesn't really run fixed batches either. It starts the next account as soon as one finishes, up to the concurrency limit.

Parameter values can be overridden for particular accounts or Regions, but with automatic deployment, overrides apply only to accounts in the OU when they're set, and accounts that join later get the StackSet's defaults. Removing instances can **retain** the stacks, leaving them running as ordinary stacks in their accounts. A StackSet can hold 100,000 stack instances, and an administrator account 1,000 StackSets.

An operation across hundreds of accounts takes a long time. To try a change on a few accounts first, update the StackSet targeting just those accounts or Regions. The rest are marked `OUTDATED` and keep running the previous template until a follow-up operation brings them up to date. The StackSet itself holds only one template version, so the outdated instances are a rollout in progress, not a second supported version.

---

## Extending CloudFormation

### Custom Resources

A **custom resource** runs your code as part of a stack operation, for something CloudFormation can't do itself, such as calling an external API, seeding a database, or looking up a value at deployment. The template declares it with a type of `AWS::CloudFormation::CustomResource`, or a name of your choosing like `Custom::DnsRecord`, and a `ServiceToken`, the ARN of a Lambda function or SNS topic in the same Region:

```yaml
Resources:
  PartnerWebhook:
    Type: Custom::PartnerWebhook
    Properties:
      ServiceToken: !GetAtt WebhookProvider.Arn
      ServiceTimeout: 300
      CallbackUrl: !Sub https://${ApiDomain}/webhooks/partner
```

On create, update, and delete, CloudFormation sends the function a request with the request type, the properties, and a pre-signed S3 URL. The function does its work and uploads a response to that URL with `SUCCESS` or `FAILED`, a **physical ID** for the resource, and any attributes other resources can read with `!GetAtt`. A few rules follow from that protocol:

- **Always respond.** A function that crashes or times out without responding leaves the stack waiting until `ServiceTimeout` runs out, one hour by default. Catch every error and report `FAILED`.
- **Handle delete properly.** A delete request arrives during stack deletion and rollback, often for resources the function never finished creating. Deleting something that doesn't exist should still report success, or the stack can't be deleted.
- **Understand replacement.** When an update returns a different physical ID, CloudFormation treats it as a replacement and sends a delete request for the old ID later.
- **Keep it idempotent.** The same request can arrive more than once.

{% include figure.html id="aws-cfn-custom-resource" %}

Custom resources are the quick option for one stack. For something many stacks use, a registry resource type is sturdier.

### Registry Extensions

The **CloudFormation registry** holds extensions that behave like built-in types. Extensions are activated per account and Region.

| Extension | What it is | Use for |
|---|---|---|
| **Resource types** | New resource types with **handlers**, the code CloudFormation calls to create, read, update, delete, and list the resource. Published by third parties, such as monitoring vendors, or privately by your organization, written with the CloudFormation CLI (a separate tool from the AWS CLI). | Anything many stacks manage. Private resource types that CloudFormation can provision also support drift detection and import, which custom resources don't. |
| **Modules** | A packaged group of resources and settings that templates use as a single resource | Standard building blocks, such as a bucket with its required encryption and logging |
| **Hooks** | Checks that run before CloudFormation provisions resources (see below) | Rules every deployment must pass |

Third-party and private resource types and custom Hooks are billed per handler operation. **Macros** are a separate mechanism. A macro is a Lambda function, declared as an `AWS::CloudFormation::Macro` resource and invoked from a template's `Transform` section, that rewrites the template before CloudFormation processes it, as AWS SAM's transform does. Its runs are billed as ordinary Lambda invocations.

### Hooks

**Hooks** check resources, stacks, or change sets before CloudFormation provisions them, and resource operations made through the Cloud Control API, and either fail the operation or let it continue with a warning. A Hook can require encryption on every bucket, restrict instance sizes in development accounts, or require backups on databases. Hooks can be written as **CloudFormation Guard** rules, a declarative policy language, as Lambda functions, or with the CloudFormation CLI, and AWS Control Tower's **proactive controls** are Hooks managed for you.

A Hook is activated in one account and Region, with filters for which stacks, resource types, and operations it checks. Enforcing it across an organization means deploying it to every account and Region, typically with a StackSet or through Control Tower. Start new Hooks in warning mode, and switch to failing mode once they stop flagging legitimate deployments.

---

## Drift

A resource has **drifted** when its actual configuration no longer matches the template, usually because someone changed it in the console. Drift makes the next stack update unpredictable, since CloudFormation's record no longer describes reality.

**Drift detection** compares each resource's current configuration with the template, for a whole stack, for chosen resources, or for every stack instance of a StackSet. Each resource comes back as `IN_SYNC`, `MODIFIED` (with the differing properties listed), `DELETED`, or `NOT_CHECKED` for types that don't support detection. Only properties set in the template are compared, so a setting added by hand that the template never mentions isn't reported. The AWS Config managed rule `cloudformation-stack-drift-detection-check` runs detection on a schedule and flags drifted stacks.

A drifted resource can be fixed three ways:

- Put it back with a **drift-aware change set**, which compares the template with each resource's actual state and changes resources to match the template, recreating deleted ones.
- Accept the change by updating the template to match the resource.
- For a resource deleted outside CloudFormation that you don't want back, remove it from the template.

A drift-aware change set reverts drift across the whole stack, not just in the resources the template change touches, so review its full list of changes. It leaves properties that AWS itself manages, such as an Auto Scaling group's desired capacity, as they are, can't fix drift in properties that would require replacement, and for a few resource types falls back to an ordinary comparison with the previous template.

---

## Bringing Existing Resources Under CloudFormation

Resources created by hand, by scripts, or by another tool can be brought into a stack without recreating them. There are three ways to start:

- The **IaC generator** scans the account's resources and generates a template for the ones you select, which can then create a stack that imports them. It's the quickest path for an account built by hand.
- **Manual import** takes a template you write, describing the resources as they exist, plus each resource's identifier, such as a bucket name or a VPC ID.
- **Auto-import** imports resources during an ordinary create or update when the template gives them fixed custom names that match existing resources.

Import runs as a change set of type `IMPORT`, and a few rules apply. Every imported resource needs a `DeletionPolicy` in the template (auto-import requires `Retain` or `RetainExceptOnCreate`). The operation can't create, change, or delete any other resource at the same time. A resource can belong to only one stack. CloudFormation checks that the resource exists and that the template is valid, but not that the template matches the resource's actual settings. Run drift detection right after an import, and fix any difference before the next update, which would otherwise apply the template's version.

Resources managed by another tool, such as Terraform, must be removed from that tool's state first, or two tools will fight over them.

---

## Moving and Renaming Resources

Stacks outgrow their first design. A stack holding a whole application may need splitting by team, or a resource may need a clearer logical ID. Changing either in a template would normally delete and recreate the resource.

**Stack refactoring** (since February 2025) moves resources between stacks, splits a stack into several, merges stacks, and renames logical IDs, without touching the resources themselves. You provide the revised template for each stack involved, up to five, and a mapping for any resource whose logical ID changes. CloudFormation validates the plan, shows the actions it will take, and applies them together when you execute it. It has limits:

- It only reorganizes. Resources can't be created, deleted, or changed in the same operation, and parameters, conditions, and mappings can't change either, so make other changes in separate updates first.
- Resource types must be ones CloudFormation can fully update (provisioning type `FULLY_MUTABLE`). Some types are excluded, including Auto Scaling groups, launch templates, Route 53 record sets, ElastiCache clusters, and custom resources.
- Stacks with stack policies, the rules that protect a stack's resources from updates, can't be refactored, and a stack can't be left empty.
- Resources that refer to values that differ between stacks, such as `AWS::StackName`, can't move.

For resources refactoring doesn't support, the older way still works. Set `DeletionPolicy: Retain` on the resource and update the source stack, remove it from the source template and update again, which leaves the resource running but unmanaged, then import it into the destination stack.

---

## Key Takeaways

- Use nested stacks for reusable components deployed as one unit, separate stacks with references for parts with different owners, and StackSets for the same template across many accounts and Regions.
- With service-managed StackSets, target OUs and turn on automatic deployment, and roll out a few accounts and one Region at a time with a low failure tolerance.
- Custom resources must always respond, handle deletes of things that may not exist, and be idempotent. Prefer registry resource types for anything shared widely.
- Hooks enforce rules on every deployment. Introduce them in warning mode.
- Detect drift regularly, on each nested stack too, and fix it with drift-aware change sets or template updates, remembering that detection only compares properties the template sets and that drift-aware change sets revert drift across the whole stack.
- Import existing resources with the IaC generator or manual import, give each a `DeletionPolicy`, and run drift detection straight after. Reorganize stacks with stack refactoring rather than recreating resources.
