---
title: "AWS Organizations & Control Tower for System Architects"
layout: guide
category: AWS
subcategory: Foundations
description: "How AWS Organizations structures many accounts into one governed estate: the management account and OUs, SCPs, RCPs and declarative policies, Control Tower landing zones and controls, account vending, and how to lay out OUs."
tags: [aws-organizations, control-tower, service-control-policies, resource-control-policies, declarative-policies, multi-account, fundamentals]
---

## Why Accounts Are the Unit of Isolation

An AWS account is the strongest boundary AWS offers. Each account has its own IAM principals, its own service quotas, and its own bill, and nothing in one account can touch another unless a policy explicitly allows it. That makes accounts the natural way to separate production from development, one team from another, and a regulated workload from everything else. When something goes wrong in one account, the damage tends to stay there.

The cost of that isolation is sprawl. Dozens of accounts each need logging, security tooling, network connectivity, and consistent rules about what people may do. **AWS Organizations** manages the accounts as one estate, and **AWS Control Tower** builds and governs a standard multi-account setup on top of Organizations.

---

## AWS Organizations

### The Hierarchy

Organizations is a global service, so the hierarchy and its policies span every Region. An organization has one **management account** and any number of **member accounts**, arranged in a tree:

| Element | What it is |
|---|---|
| **Management account** | The account that created the organization. It pays the bill for every member, can create and remove accounts, and manages organization policies. The authorization policies covered below (SCPs and RCPs) never restrict it |
| **Root** | The top of the tree. Policies attached here apply to every account below it |
| **Organizational unit (OU)** | A folder of accounts and other OUs, nested up to five levels below the root. Policies attached to an OU apply to everything inside it |
| **Member account** | Any other account in the organization. An account belongs to at most one organization at a time |

### Delegated Administrators

Many AWS services that work across an organization, such as GuardDuty, Security Hub, IAM Identity Center, and AWS Config, let the management account register a member account as that service's **delegated administrator**. The delegated account then manages the service for the whole organization. This keeps day-to-day security and operations work out of the management account, so fewer people need access to it. A delegated administrator is still a member account, so SCPs and RCPs apply to it.

Turn on IAM's **centralized root access** early too, so member accounts carry no root credentials and the rare root-only tasks run centrally from the management account or its delegated administrator.

### Quotas That Shape a Design

| Quota | Default |
|---|---|
| Accounts per organization | 10, adjustable through Service Quotas (increases up to 50,000 are possible) |
| OUs per organization | 2,000 |
| OU nesting | 5 levels below the root |
| SCPs attached per root, OU, or account | 10 |
| RCPs attached per root, OU, or account | 5, including the non-removable `RCPFullAWSAccess` |
| SCP size | 10,240 characters |
| Accounts created concurrently | 5 |

The account quota is the one that surprises new organizations. Request an increase early if the plan calls for more than a handful of accounts.

### All Features and Consolidated Billing

An organization runs in one of two feature sets. **All features** enables every organization policy type, delegated administrators, and integration with services such as Control Tower. **Consolidated billing only** provides the shared bill and nothing else. New organizations should use all features. An existing consolidated-billing organization can be upgraded, but the change can't be reversed.

Consolidated billing itself gives three things. There is one invoice for every account. Usage is pooled when calculating volume pricing tiers. And Savings Plans and Reserved Instance discounts bought in one account can apply to eligible usage in the others, unless discount sharing is turned off.

### Creating, Moving, and Closing Accounts

Creating an account from the organization is faster and cleaner than inviting one that already exists:

```bash
aws organizations create-organization --feature-set ALL

aws organizations create-organizational-unit \
  --parent-id r-examplerootid \
  --name "Workloads"

# Creates the account and an OrganizationAccountAccessRole the management account can assume
aws organizations create-account \
  --email app1-prod@example.com \
  --account-name "App1 Production" \
  --role-name OrganizationAccountAccessRole

aws organizations move-account \
  --account-id 123456789012 \
  --source-parent-id r-examplerootid \
  --destination-parent-id ou-exmp-exampleouid
```

An existing account joins through an invitation that its own administrator accepts, and the invitation expires after 15 days.

Accounts leave the estate the same way they arrive, from the management account. It can close a member account directly, but a closed account keeps counting against the account quota until the post-closure period ends and it is permanently closed.

---

## Organization Policies

Organizations offers two categories of policy. **Authorization policies** (SCPs and RCPs) cap what IAM can allow. **Declarative policies** set how services are configured in every account. Neither category grants anything to anyone.

| Policy type | Category | What it controls | Affects the management account? |
|---|---|---|---|
| **Service control policy (SCP)** | Authorization | The maximum permissions of IAM users and roles in member accounts | No |
| **Resource control policy (RCP)** | Authorization | The maximum permissions on resources in member accounts, whoever calls them | No |
| **EC2 declarative policy** | Declarative | EC2 settings such as instance metadata defaults, public sharing of AMIs and snapshots, VPC Block Public Access, and serial console access | Yes |
| **Tag policy** | Declarative | Standard tag keys and allowed values | Yes |
| **Backup policy** | Declarative | Backup plans applied to resources across accounts | Yes |
| **AI services opt-out policy** | Declarative | Whether AWS AI services may store content to improve their models | Yes |

The list keeps growing. Organizations also offers declarative policies for chat applications, Security Hub, Amazon Inspector, Amazon Bedrock guardrails, S3, and upgrade rollouts. The rest of this section covers the types most designs depend on.

### Service Control Policies

An SCP sets the most that IAM users and roles in an account can do, including the account's root user. It never grants permission. A principal still needs an IAM policy that allows the action, and the SCPs above it must allow the action too. SCPs don't restrict service-linked roles, which AWS services use to act on your behalf.

**Inheritance runs top-down and must hold at every level.** An account's effective SCP permissions are what the root, every OU on the path down, and the account itself all allow.

{% include figure.html id="aws-org-scp-inheritance" %}

When SCPs are enabled, AWS attaches a policy called `FullAWSAccess` to the root, every OU, and every account. That gives two ways to write SCPs:

- **Deny list.** Leave `FullAWSAccess` in place everywhere and attach SCPs with `Deny` statements for what is prohibited. This is the common approach, because a new AWS service is available until someone decides to block it.
- **Allow list.** Replace `FullAWSAccess` at a level with an SCP that allows only named services. Everything unnamed is blocked below that level. It suits tightly regulated OUs, but every new service a team needs means an SCP change, and the list must include the services Control Tower and other organization integrations call in member accounts, or they break.

Since September 2025, SCPs support the full IAM policy language: conditions and specific resource ARNs in `Allow` statements, `NotResource`, and wildcards anywhere in an action name. Older guidance that says SCP allow statements can't carry conditions is out of date.

### Common SCP Patterns

**Stop accounts leaving the organization**, which would take them out from under every policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Deny",
    "Action": "organizations:LeaveOrganization",
    "Resource": "*"
  }]
}
```

**Protect the security baseline** so nobody in a member account can turn off logging or detection:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Deny",
    "Action": [
      "cloudtrail:StopLogging",
      "cloudtrail:DeleteTrail",
      "config:StopConfigurationRecorder",
      "config:DeleteConfigurationRecorder",
      "guardduty:DeleteDetector",
      "securityhub:DisableSecurityHub"
    ],
    "Resource": "*",
    "Condition": {
      "ArnNotLike": { "aws:PrincipalArn": "arn:aws:iam::*:role/SecurityAdmin" }
    }
  }]
}
```

**Restrict Regions** for data residency. Global services such as IAM, Organizations, CloudFront, Route 53, and Support have a single endpoint in `us-east-1`, so a plain deny would block them too. AWS's pattern exempts them with `NotAction` rather than allowing `us-east-1` outright, which would leave every regional service open there:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Deny",
    "NotAction": [
      "cloudfront:*",
      "iam:*",
      "organizations:*",
      "route53:*",
      "support:*"
    ],
    "Resource": "*",
    "Condition": {
      "StringNotEquals": { "aws:RequestedRegion": ["eu-west-1", "eu-central-1"] },
      "ArnNotLike": { "aws:PrincipalArn": "arn:aws:iam::*:role/OrgAdmin" }
    }
  }]
}
```

Add any other global services the organization uses to the `NotAction` list. Control Tower, covered below, offers the same restriction as a built-in Region deny control.

**Limit instance types** in non-production OUs:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Deny",
    "Action": "ec2:RunInstances",
    "Resource": "arn:aws:ec2:*:*:instance/*",
    "Condition": {
      "StringNotLike": { "ec2:InstanceType": ["t3.*", "t4g.*"] }
    }
  }]
}
```

### Resource Control Policies

An RCP caps what can be done to resources in member accounts, no matter who makes the request. That is the gap SCPs leave. An SCP only restricts principals inside your organization, so it can't stop a bucket policy from granting access to an outside account. An RCP attached to the account that owns the bucket applies to every request against it, including requests from outside the organization.

{% include figure.html id="aws-org-scp-vs-rcp" %}

The typical use is a **data perimeter**. The RCP denies access to your resources from any principal outside the organization while still allowing AWS services acting on your behalf:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Deny",
    "Principal": "*",
    "Action": ["s3:*", "sqs:*", "kms:*", "secretsmanager:*", "sts:AssumeRole"],
    "Resource": "*",
    "Condition": {
      "StringNotEqualsIfExists": { "aws:PrincipalOrgID": "o-exampleorgid" },
      "BoolIfExists": { "aws:PrincipalIsAWSService": "false" }
    }
  }]
}
```

The same perimeter also blocks outside access the organization wants, such as a SaaS vendor, an auditor, or a partner account reading a bucket or using a key. Each of those needs an exception carved into the RCP, usually a condition on the caller's account ID, so inventory existing cross-organization access before attaching one.

RCPs work like SCPs in most respects. They never grant, they're inherited top-down, a non-removable `RCPFullAWSAccess` policy sits at every level, and they don't restrict service-linked roles. They only apply to services that support them, a list that includes S3, KMS, SQS, Secrets Manager, STS, DynamoDB, ECR, and CloudWatch Logs. A resource in an unsupported service still relies on its own resource policy for a perimeter.

### Declarative Policies

A declarative policy states the configuration a service should have, and the service keeps it that way. An SCP only blocks API calls, so a service that later adds a new API for the same setting can slip past it. An EC2 declarative policy that turns on VPC Block Public Access or blocks public AMI sharing holds even as EC2 adds features, and it applies in the management account too.

**Tag policies** standardize tag keys and allowed values:

```json
{
  "tags": {
    "Environment": {
      "tag_key": { "@@assign": "Environment" },
      "tag_value": { "@@assign": ["Production", "Staging", "Development", "Sandbox"] },
      "enforced_for": { "@@assign": ["ec2:instance", "s3:bucket"] }
    }
  }
}
```

A tag policy reports non-compliant tags on supported resource types, and it blocks non-compliant tagging operations only on the types listed under `enforced_for`. It doesn't stop a resource being created with no tag at all. Requiring a tag at creation takes one of two further steps. A tag policy's **required tag keys** setting checks deployments from IaC tools such as CloudFormation, Terraform, and Pulumi. For any other caller, an SCP denies the create action unless `aws:RequestTag/Environment` is present, and the tag policy then validates the value.

### Rolling Out a Policy Safely

A bad SCP or RCP at the root can break every workload at once. AWS's guidance is to attach a new policy to a test account first, then to OUs low in the hierarchy, and only then work upward. Its recommended OU layout includes a **Policy Staging** OU for exactly this. Watch CloudTrail for access denied errors that name the policy type after each step.

---

## AWS Control Tower

Control Tower sets up and governs a multi-account environment, called a **landing zone**, on top of Organizations. It orchestrates Organizations, IAM Identity Center (AWS's workforce sign-in service), AWS Config (which records resource configuration and evaluates it against rules), CloudTrail (the API audit log), and Service Catalog (a self-service catalog of approved products) so a team doesn't have to wire them together by hand. Control Tower itself has no charge. You pay for the underlying services it turns on, mostly Config recording and rule evaluations, CloudTrail, and the S3 storage for logs.

### What a Landing Zone Contains

A landing zone is the organization plus the shared accounts and services Control Tower manages. Since **landing zone version 4.0**, each service integration is optional, and a landing zone contains whichever of these the organization turns on:

- **CloudTrail centralized logging**, where an organization trail delivers every account's API activity to an S3 bucket in the **CloudTrail administrator account** (formerly the log archive account), which workload teams can't change.
- **AWS Config**, which sets up the **Config aggregator account** (formerly the audit account) and a bucket there for Config data. The integration records only in the integration accounts. Recording in workload accounts comes from enabling the Config baseline on each governed OU, and detective controls need that recording.
- **Security roles**, which give the security team cross-account access to the governed accounts. This integration requires the Config integration.
- **IAM Identity Center**, configured for access across the accounts. This requires the security roles integration.
- **AWS Backup**, with a central backup vault. This also requires the security roles integration.

Alongside the integrations, Control Tower provides **Account Factory**, which creates new accounts with the baseline already applied, and **a dashboard** showing accounts, enabled controls, and non-compliant resources.

Control Tower no longer creates or requires a particular OU structure. The only requirement is that the integration accounts share one parent OU. That OU becomes the Security OU, and the organization defines the rest. Older guides describe a mandatory Security OU created at setup, which was true of earlier landing zone versions.

A landing zone is set up from a **home Region** and governs a list of Regions the organization chooses. Controls, Config recording, and the baseline apply only in governed Regions, so resources in an ungoverned Region escape them unless the Region deny control or an SCP blocks that Region.

### Controls

A **control** is one governance rule, written in plain language and applied to an OU. Every account in the OU is subject to it. Control Tower used to call these guardrails, and both terms still appear. Controls differ in how they act:

| Behavior | Acts | Implemented with | Example |
|---|---|---|---|
| **Preventive** | Before an API call succeeds, or by holding a configuration | SCPs, RCPs, and declarative policies | Disallow changes to the log bucket's policy, or disallow public AMI sharing |
| **Detective** | After a resource exists | AWS Config rules | Detect EBS volumes attached without encryption |
| **Proactive** | Before CloudFormation provisions a resource | CloudFormation hooks, which inspect a template's resources before they are created | Reject a template that creates an unencrypted bucket |

Each control also has a guidance category. **Mandatory** controls are always on and protect the landing zone itself. **Strongly recommended** controls are AWS best practice. **Elective** controls cover narrower requirements. Controls don't restrict the management account, which stays usable by design. Every action taken there is still logged centrally.

Each detective control is a Config rule, billed per evaluation in every governed account and Region, so they are the part of Control Tower whose cost scales with the estate. Enable detective controls for what the organization actually has to prove, and govern only the Regions it uses.

### Drift

Control Tower expects the resources it deployed to stay as it left them. Changing them outside Control Tower, such as moving an account between OUs in the Organizations console or editing an SCP that Control Tower manages, puts the landing zone in **drift**. Drift is resolved by repairing the landing zone or re-registering the affected OU. From landing zone 4.0, drift notifications go to EventBridge in the management account.

### Account Factory

Account Factory creates new accounts with the landing zone's baseline and the target OU's controls already applied. It is built on an AWS Service Catalog product, so an administrator or an authorized user provisions an account by choosing the OU and supplying the account name and email, plus an Identity Center user when that integration is on.

**Account Factory for Terraform (AFT)** runs the same vending through a GitOps pipeline, where a Git commit is the request and a pipeline applies it. Each account is a Terraform module in an account-request repository, and a push to that repository creates the account and then applies global and account-specific customizations. Customizations for AWS Control Tower (CfCT) offers similar customization with CloudFormation templates instead of Terraform:

```hcl
module "app1_production" {
  source = "./modules/aft-account-request"

  control_tower_parameters = {
    AccountEmail              = "app1-prod@example.com"
    AccountName               = "App1 Production"
    ManagedOrganizationalUnit = "Workloads"
    SSOUserEmail              = "platform-team@example.com"
    SSOUserFirstName          = "Platform"
    SSOUserLastName           = "Team"
  }

  account_tags = {
    "CostCenter" = "1234"
  }

  change_management_parameters = {
    change_requested_by = "Platform Team"
    change_reason       = "New production account for App1"
  }

  custom_fields = {
    compliance = "pci"
  }

  account_customizations_name = "production-baseline"
}
```

The `control_tower_parameters` can't be changed while provisioning is in progress. For a nested OU, `ManagedOrganizationalUnit` must use the `OUName (ou-id)` form, so an account under `Workloads/Production` is requested as `"Production (ou-exmp-exampleouid)"`. `custom_fields` land in the new account as Systems Manager Parameter Store parameters, where customizations can read them to decide, for example, which extra Config rules a regulated account needs.

### Landing Zone, Controls Only, or Organizations Alone

Since November 2025, Control Tower also has a **Controls Dedicated** experience, which applies its managed controls to an existing organization without setting up a landing zone. That makes three options:

| Option | Fits when |
|---|---|
| **Control Tower landing zone** | Building a multi-account environment and wanting AWS's baseline without assembling it, with self-service account vending and a dashboard of controls for auditors |
| **Control Tower Controls Dedicated** | The organization already has its own logging, security tooling, and account vending, but wants AWS's managed preventive and detective controls instead of writing them |
| **Organizations alone** | The team has a mature baseline built on Organizations and IaC, and wants to own every SCP and Config rule directly |

With optional integrations, the gaps between these are narrower than they were. Many organizations use Control Tower for vending and a small set of controls, and manage the rest through their own IaC.

---

## Designing the Account Structure

### Recommended OUs

AWS's multi-account whitepaper groups OUs by purpose. Few organizations need all of them on day one:

| Group | OU | Holds |
|---|---|---|
| Foundational | **Security** | Log archive, security tooling, and audit accounts |
| Foundational | **Infrastructure** | Shared networking and shared services |
| Application | **Workloads** | Business workloads, usually split into production and non-production OUs beneath it |
| Experimental | **Sandbox** | Accounts for experiments, with little or no access to production |
| Procedural | **Policy Staging** | Accounts used to test new or changed organization policies |
| Procedural | **Suspended** | Accounts being closed or quarantined |
| Procedural | **Exceptions** | Workloads that need deliberate exceptions to standard policies |
| Procedural | **Transitional** | Accounts part-way through a migration into the standard structure |
| Advanced | **Deployments**, **Business Continuity**, **Individual Business Users** | CI/CD tooling accounts, backup and recovery accounts, and accounts for individuals |

Structure OUs by the policies they need, not by the org chart. An OU earns its place when its accounts share controls that differ from their neighbors'. An OU tree copied from reporting lines tends to need rework, because a reorganization doesn't change what policies a workload needs. Splitting production from non-production under Workloads is the most common first division, because the two need different SCPs.

### When to Create a Separate Account

Separate accounts are worth their overhead when workloads differ in:

- **Compliance scope.** A PCI or HIPAA workload in its own account keeps the audit boundary small.
- **Ownership.** One team per account makes permissions and cost attribution simple.
- **Blast radius.** Production and development in separate accounts stop a development mistake from reaching production.
- **Lifecycle.** A workload that will be retired or sold is easier to remove if it lives alone.

Components that share a team, a data store, and a compliance scope usually belong in the same account. Splitting them adds cross-account permissions without adding isolation that matters.

### Sharing Across Accounts

Accounts in an organization share resources three ways:

- **Cross-account IAM roles**, where a principal in one account assumes a role in another.
- **Resource-based policies** that name the organization rather than individual accounts. The `aws:PrincipalOrgID` condition key lets a bucket or key policy say "any principal in my organization" without listing account IDs.
- **AWS Resource Access Manager (RAM)**, which shares resources such as VPC subnets, Transit Gateways, Route 53 Resolver rules, and capacity reservations with the organization or an OU. The resource stays owned by one account, and the others use it directly.

```bash
aws ram create-resource-share \
  --name "Shared-TGW" \
  --resource-arns "arn:aws:ec2:us-east-1:222222222222:transit-gateway/tgw-0example" \
  --principals "arn:aws:organizations::111111111111:organization/o-exampleorgid"
```

Sharing with an organization or OU, rather than with listed account IDs, first requires enabling sharing with AWS Organizations in RAM from the management account. RAM is what makes a central network account practical. The network team owns the Transit Gateway or the shared VPC, and workload accounts attach to it without any cross-account roles.

---

## Bringing Existing Accounts In

Most organizations adopt Organizations or Control Tower with accounts already running. A few mechanics decide how smoothly it goes:

- **Invite, then move.** Invited accounts land at the root. Move each one into an OU whose policies it has been tested against, starting with non-production.
- **Test policies before production accounts arrive.** An SCP that the development accounts tolerate can still deny an API a production workload depends on.
- **Enrollment in Control Tower needs a role first.** The `AWSControlTowerExecution` role must exist in an account before it can be enrolled by hand, trusting the management account with administrator access. Enrollment then applies the OU's controls and baseline. Registering a whole OU, or auto-enrolling, creates the role for you. Existing AWS Config recorders or delivery channels conflict with Control Tower's, so either remove them first or follow AWS's documented process for enrolling accounts with existing Config resources, which requires an allow-list request through AWS Support.
- **Update trust relationships.** Cross-account roles that trust specific account IDs keep working, and policies that should now trust the whole organization can switch to `aws:PrincipalOrgID`.

---

## Common Pitfalls

### Workloads in the Management Account

A workload in the management account runs outside every SCP and RCP, and a breach there reaches billing and every organization policy. Move workloads out and keep access to the management account small and heavily monitored.

### Untested Policies at the Root

A deny attached to the root applies everywhere at once, including to production, so staging matters even when a change looks harmless. Keep an exception process ready for the day an SCP blocks something a production incident needs. Identity needs the same fallback. If IAM Identity Center or the external identity provider is the only way into any account, keep a tested emergency path that doesn't depend on it.

---

## Key Takeaways

1. **Accounts are the isolation boundary.** Separate accounts by compliance scope, ownership, blast radius, and lifecycle, and let Organizations govern them as one estate.
2. **Keep the management account empty.** Organization authorization policies never restrict it. Use delegated administrators so day-to-day service administration happens elsewhere.
3. **SCPs cap principals, RCPs cap resources, and neither grants.** An action must be allowed at every level from the root down, and an RCP is what stops a resource policy from opening data to outside principals.
4. **Declarative policies hold a configuration, not just block an API.** Use them for settings such as VPC Block Public Access that should stay on as services evolve.
5. **Control Tower builds and watches a landing zone.** Its controls are SCPs, RCPs, and declarative policies (preventive), Config rules (detective), and CloudFormation hooks (proactive), applied per OU. Landing zone 4.0 made its integrations and OU structure optional.
6. **Detective controls are the cost.** Each is a Config rule in every governed account and Region, so enable what the organization needs to prove.
7. **Design OUs around policy, and stage policy changes.** Test new SCPs and RCPs in a Policy Staging OU before they reach the root.
