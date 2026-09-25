---
title: "AWS CloudFormation: Fundamentals"
layout: guide
category: AWS
subcategory: Infrastructure as Code
description: "How CloudFormation turns templates into stacks: template sections and intrinsic functions, how creates and updates are ordered, change sets, validation, and update behaviors, rollback and express mode, deletion policies, cross-stack and cross-account references, permissions, deployment tooling, quotas, and cost."
tags: [cloudformation, stacks, change-sets, deletion-policy, cross-stack-references, fundamentals]
---
{% raw %}

## What CloudFormation Does

**AWS CloudFormation** creates and manages AWS resources from a **template**, a YAML or JSON file that declares the resources you want and how they're configured. You don't write the steps to build them. CloudFormation works out the order, calls the AWS APIs, waits for each resource, and records what it built.

The resources created from one template form a **stack**. A stack is managed as a unit. Changing the template and updating the stack changes the resources to match, and deleting the stack deletes them (unless told otherwise). Because the template describes the whole environment, it can go through code review, live in version control, and build identical copies for development, testing, and production.

A stack lives in one Region of one account, and its name is unique there. CloudFormation is also the engine underneath the AWS CDK and AWS SAM, which generate templates and deploy them as stacks, so what follows applies to them too.

Using CloudFormation costs nothing for AWS's own resource types. Extensions, meaning resource types published by third parties or your own organization and custom deployment checks called Hooks, are billed per operation.

---

## Templates

A template has up to ten top-level sections. Only `Resources` is required.

| Section | Holds |
|---|---|
| `AWSTemplateFormatVersion`, `Description` | The format version (always `2010-09-09`) and a description |
| `Parameters` | Values supplied when the stack is created or updated, such as an environment name |
| `Mappings` | Fixed lookup tables, such as settings per environment |
| `Conditions` | True-or-false expressions that decide whether resources or properties are included |
| `Rules` | Checks on parameter values before any resource is touched |
| `Transform` | Macros, programs that rewrite the template before processing, such as the one AWS SAM uses to expand its shorthand |
| `Resources` | The resources to create. Required. |
| `Outputs` | Values to show after deployment or share with other stacks |
| `Metadata` | Extra information, such as how the console groups parameters |

Each resource has a **logical ID**, its name inside the template, and a **type** such as `AWS::SQS::Queue`. When CloudFormation creates it, the resource also gets a **physical ID**, its real name or Amazon Resource Name (ARN) in AWS. Templates refer to resources by logical ID, and CloudFormation substitutes the physical values.

**Intrinsic functions** compute values while the stack deploys. The ones nearly every template uses are:

- `!Ref` returns a parameter's value, or a resource's main identifier (for a queue, its URL).
- `!GetAtt` returns another attribute of a resource, such as a queue's ARN.
- `!Sub` builds a string with values substituted, such as `${AWS::StackName}-orders`. `AWS::StackName`, `AWS::Region`, and `AWS::AccountId` are **pseudo parameters** that CloudFormation always provides.

YAML is the usual choice over JSON, because it allows comments and the short `!Ref` forms. This template creates a queue with a dead-letter queue and a bucket, and publishes the queue's URL. It also uses a **condition**, a named true-or-false expression that `!If` reads, and three settings covered later in this guide, `DeletionPolicy`, `UpdateReplacePolicy`, and `Export`:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: Order intake queue and archive bucket

Parameters:
  Environment:
    Type: String
    AllowedValues: [dev, prod]

Conditions:
  IsProd: !Equals [!Ref Environment, prod]

Resources:
  OrdersDeadLetterQueue:
    Type: AWS::SQS::Queue
    Properties:
      MessageRetentionPeriod: 1209600

  OrdersQueue:
    Type: AWS::SQS::Queue
    Properties:
      VisibilityTimeout: 120
      RedrivePolicy:
        deadLetterTargetArn: !GetAtt OrdersDeadLetterQueue.Arn
        maxReceiveCount: 5

  ArchiveBucket:
    Type: AWS::S3::Bucket
    DeletionPolicy: Retain
    UpdateReplacePolicy: Retain
    Properties:
      VersioningConfiguration:
        Status: !If [IsProd, Enabled, Suspended]

Outputs:
  OrdersQueueUrl:
    Value: !Ref OrdersQueue
    Export:
      Name: !Sub ${AWS::StackName}-OrdersQueueUrl
```

The queues and bucket have no names in the template, so CloudFormation generates unique ones from the stack name and logical ID. That's usually the better choice, for reasons covered under Update Behaviors.

---

## How CloudFormation Makes Changes

### Ordering Through Dependencies

CloudFormation builds a **dependency graph** from the template. Whenever one resource refers to another with `!Ref` or `!GetAtt`, the referenced resource must exist first. In the template above, `OrdersQueue` refers to the dead-letter queue's ARN, so the dead-letter queue is created first, while the bucket, which depends on nothing, is created at the same time. Resources with no path between them are created in parallel, and deletion runs the graph in reverse.

When a dependency isn't visible in the properties, declare it with `DependsOn`. The classic case is a resource with a public IP address, such as an instance in a public subnet, which needs the internet gateway attached to the VPC first, even though nothing in its properties refers to the attachment.

A resource marked complete isn't always ready to use. An EC2 instance is complete when it's running, not when its startup script has installed the application. A **`CreationPolicy`** makes CloudFormation wait for a success signal, sent from the instance with the `cfn-signal` helper, before it counts the resource as created.

### Change Sets

Updating a stack directly applies the changes at once. A **change set** shows what an update will do before anything changes, listing each resource that will be added, modified, or removed, and whether a modification **replaces** the resource. Review it, then execute it or throw it away. The `aws cloudformation deploy` command in the CLI creates and executes a change set in one step.

CloudFormation also validates before it deploys, on change sets since November 2025 and on direct creates and updates since June 2026. It catches common failures, such as invalid property values, names that clash with existing resources, and buckets that must be emptied before deletion, before any resource is touched instead of partway through, and warns about service quotas that the deployment would exceed. A **drift-aware change set** goes further and compares the template with the resources as they actually are, so it can put back settings someone changed by hand.

### Update Behaviors

Changing a property updates a resource in one of three ways, and the resource type's reference documentation states which, property by property:

| Behavior | What happens | Example |
|---|---|---|
| **No interruption** | Updated in place, still available | A queue's visibility timeout |
| **Some interruption** | Updated in place, briefly unavailable, such as a restart | An EC2 instance's instance type, for an instance whose root disk is an EBS volume |
| **Replacement** | A new resource is created with a new physical ID, references are switched to it, and the old one is deleted | A DynamoDB table's key schema, or turning a standard SQS queue into a FIFO queue |

Replacement is the one to watch in every change set. The old resource is deleted with its data unless an `UpdateReplacePolicy` keeps it. A resource given a fixed name in the template can't be replaced unless the name changes in the same update, because the new resource would need the name while the old one still exists. Letting CloudFormation generate names avoids that.

### Rollback

When a create or update fails partway, CloudFormation **rolls back** by default, returning the stack to its last working state. Three outcomes are common:

- A stack whose first creation failed ends in `ROLLBACK_COMPLETE`. It can't be updated, only deleted and created again.
- A failed update rolls back to `UPDATE_ROLLBACK_COMPLETE`, and the stack works as before.
- If the rollback itself fails, often because a resource was changed or deleted outside CloudFormation, the stack stops in `UPDATE_ROLLBACK_FAILED`. Fix the cause, then **continue update rollback**, optionally skipping the resources that can't be restored.

A deletion can fail too, leaving the stack in `DELETE_FAILED`, most often because a bucket still holds objects. Empty or retain the resource and delete again.

During development, turning off rollback keeps the resources that did succeed, so a fix can be retried without recreating everything. **Express mode** (since June 2026) goes further. It marks each resource complete as soon as its configuration is applied, without waiting for stabilization checks like traffic readiness or cleanup of replaced resources, and turns off rollback by default. It suits fast development loops, and it's a poor fit for production deployments that depend on each resource being ready before the next step.

---

## Protecting Data

A stack's resources share its lifecycle, which is dangerous for anything holding data. Several controls exist:

- **`DeletionPolicy`** decides what happens to a resource when the stack is deleted or the resource is removed from the template. `Delete` is the default for most types. `Retain` keeps the resource. `Snapshot` takes a final snapshot first, for types that support it, such as RDS, EBS volumes, ElastiCache, Neptune, DocumentDB, and Redshift. `RetainExceptOnCreate` keeps the resource except when the stack operation that created it rolls back, so empty resources from a failed first deployment don't linger. RDS clusters, and RDS instances that aren't part of a cluster, default to `Snapshot`.
- **`UpdateReplacePolicy`** does the same for the old resource when an update replaces it. Set both on every data store.
- **Termination protection** on a stack blocks deletion until someone turns it off.
- A **stack policy** protects resources from updates. Once a stack has one, every resource is protected unless the policy explicitly allows updates to it, so a policy usually allows everything and then denies updates to a few resources, such as the production database. A policy can be overridden for a single update, and it can be changed but never removed.

An S3 bucket can't be deleted while it holds objects, so a stack deleting a non-empty bucket fails unless the bucket is retained.

---

## Connecting Stacks

Large systems are split across stacks, often by lifecycle and owner, such as a network stack changed rarely by a platform team and application stacks deployed daily. Stacks share values in three ways:

| | Export and `!ImportValue` | `Fn::GetStackOutput` | Parameter Store |
|---|---|---|---|
| **How** | The producer marks an output with an `Export` name, and consumers import it by that name | Consumers read any output of the producer stack directly, with no export needed | The producer writes a parameter, and consumers read it at deployment |
| **Reach** | Same account and Region | Any account and Region in the partition | Same account and Region |
| **Reference** | Strong. The producer can't be deleted, and an imported output can't be changed or removed, while any stack imports it | Weak. Read when the consumer deploys, with nothing stopping the producer from changing | Weak, the same way |
| **Since** | Always | May 2026 | Always |

Export names must be unique in their account and Region. The strong link protects consumers, but it also means changing a shared output can require updating every consuming stack first. `Fn::GetStackOutput` reaches across accounts and Regions through a `Region` and an IAM `RoleArn`, and a consumer picks up a changed value only on its next update, so protect the producer stack from accidental deletion. Parameters in AWS Systems Manager Parameter Store, AWS's store for configuration values, are read through a parameter of type `AWS::SSM::Parameter::Value<String>` or through a **dynamic reference** that CloudFormation resolves at deployment:

```yaml
QueueUrl: '{{resolve:ssm:/orders/prod/queue-url}}'
```

Dynamic references to Secrets Manager (`resolve:secretsmanager`) and to encrypted SecureString parameters (`resolve:ssm-secure`) work the same way, and they're how a password reaches a resource without appearing in the template or in parameter values.

Use exports when a consumer must never have a value change underneath it, and `Fn::GetStackOutput` or parameters when producers and consumers deploy independently or live in different accounts and Regions.

---

## Permissions

By default, CloudFormation acts with the permissions of whoever starts the operation, so deploying a stack requires permission to create everything in it. A **service role** changes that. CloudFormation assumes the role for every operation on the stack, and the people or pipelines deploying need only CloudFormation permissions plus `iam:PassRole` for that role, the permission to hand a role to an AWS service to use. Service roles let a team deploy stacks without holding broad permissions themselves.

Some deployments need an explicit acknowledgment, called a **capability**, so nobody makes a sensitive change by accident. `CAPABILITY_IAM` acknowledges that the template creates or changes IAM resources, and `CAPABILITY_NAMED_IAM` is needed when those resources have fixed names. `CAPABILITY_AUTO_EXPAND` acknowledges that macros, such as SAM's transform, will rewrite the template before it's deployed.

---

## Tooling Around Templates

- **cfn-lint** checks templates against the resource specifications, catching invalid properties and values before deployment. **CloudFormation Guard** checks them against your own policy rules, such as requiring encryption on every bucket.
- **Git sync** deploys a stack from a template in a GitHub, GitLab, or Bitbucket repository whenever the branch changes.
- The **IaC generator** scans resources that already exist in an account, including ones created by hand, and produces a template for them, which can then be imported into a stack.
- **Infrastructure Composer** is a visual editor that draws a template as a diagram.
- **Hooks** run checks during deployments and can stop a non-compliant resource from being created.

---

## Quotas

| Quota | Value |
|---|---|
| Stacks per account per Region | 2,000 (raisable) |
| Resources per template | 500 |
| Parameters, outputs, and mappings per template | 200 each |
| Template size | 51,200 bytes passed directly, 1 MB from S3 |
| Dynamic references per template | 60 |

The 500-resource limit is the one real systems meet. Splitting a system into several stacks keeps each template manageable well before that.

---

## Key Takeaways

- A template declares resources, and a stack is the set CloudFormation created from it, in one account and Region. CloudFormation orders the work from the references between resources.
- Review every update as a change set, and look for replacements. A replaced resource loses its data unless an `UpdateReplacePolicy` keeps it, and a resource with a fixed name can't be replaced without renaming it.
- Set `DeletionPolicy` and `UpdateReplacePolicy` on every data store, and turn on termination protection for stacks that matter.
- Failed operations roll back. A failed first creation leaves a stack that can only be deleted, and a failed rollback needs fixing and continuing.
- Share values between stacks with exports when consumers must be protected from change, and with `Fn::GetStackOutput` or Parameter Store when stacks deploy independently or span accounts and Regions. Pull secrets in with dynamic references.
- Deploy through a service role, and acknowledge IAM changes with capabilities.
{% endraw %}
