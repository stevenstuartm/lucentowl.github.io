---
title: "AWS IAM: Identity and Access Management for Architects"
layout: guide
category: AWS
subcategory: Foundations
description: "How AWS decides whether a request is allowed: principals and temporary credentials, IAM Identity Center for people, roles for workloads, the policy types and how AWS evaluates them, cross-account access, Access Analyzer, and securing the root user."
tags: [iam, iam-identity-center, iam-roles, policy-evaluation, access-analyzer, least-privilege, fundamentals]
---

## What IAM Decides

**AWS Identity and Access Management (IAM)** decides who can call AWS and what each caller may do. Every request to an AWS API goes through two steps. **Authentication** establishes who is calling, and **authorization** evaluates the applicable policies to decide whether that caller may perform the action on the resource. A few services, such as S3, accept some anonymous requests, which skip authentication and are judged on the resource's own policy alone.

Authorization starts from **deny by default**. A request succeeds only when a policy explicitly allows it and no policy explicitly denies it. The one exception is the account's root user, which has full access. In an organization member account, organization-level policies can still restrict the root user, though never in the management account.

### Where IAM Lives

IAM is a global service within an account. Users, groups, roles, and policies belong to one AWS account and apply in every Region, so a role created once works in `us-east-1` and `eu-west-1` alike. Every IAM resource has an **Amazon Resource Name (ARN)**, a unique identifier such as `arn:aws:iam::123456789012:role/Deployer`, and policies use ARNs to name principals and resources. Two related services are scoped differently. An IAM Identity Center organization instance has a primary Region, manages access across the whole organization, and can be replicated to additional Regions unless its identity source is Active Directory. IAM Access Analyzer's external access analyzers are regional.

### Who Can Make a Request

A **principal** is the identity behind a request. IAM recognizes these kinds:

| Principal | Credentials | Typical use |
|---|---|---|
| **Root user** | The account's sign-up email and password | The few tasks only root can do (see Securing the Root User) |
| **IAM user** | Long-term: a console password and/or access keys | Narrow cases where temporary credentials aren't possible |
| **IAM role session** | Temporary credentials from assuming a role | Workloads, cross-account access, and people who sign in through an identity provider, including IAM Identity Center |
| **AWS STS federated user** | Temporary credentials an IAM user requests with `GetFederationToken` | Older custom identity brokers. Rare in new designs |
| **AWS service** | Assumes a role you define on your behalf | Lambda running a function, CloudFormation creating resources |

### AWS's Current Guidance

AWS's IAM best practices reduce to two rules. People should use federation with an identity provider so they get temporary credentials, and IAM Identity Center is AWS's recommended way to do that. Workloads should use IAM roles so they also get temporary credentials. Long-term access keys remain for the cases where neither is possible. The reason is exposure. A leaked access key keeps working until someone finds and deletes it, while temporary credentials expire on their own.

---

## Users, Groups, and Roles

### IAM Users and Groups

An **IAM user** is a named identity in one account with long-term credentials. AWS recommends against IAM users for people. They remain for:

- Service-specific credentials, such as Git credentials for CodeCommit or credentials for Amazon Keyspaces
- Third-party tools that can only use an access key
- Emergency break-glass access, kept locked away and monitored

An **IAM group** attaches policies to many IAM users at once. A user can belong to up to 10 groups, and groups can't be nested or used as principals in a policy.

When an access key is unavoidable, rotate it on a schedule, store it in a secrets manager rather than in code or configuration files, and delete it when it goes unused.

### IAM Roles

An **IAM role** has no credentials of its own. A principal **assumes** the role through AWS Security Token Service (STS) and receives temporary credentials for a **role session**. Two policies define a role:

- The **trust policy** says who may assume the role. It is a resource-based policy attached to the role.
- The **permissions policies** say what a session of the role may do.

Session length is set per request, up to the role's maximum session duration, which can be 1 to 12 hours. **Role chaining**, where a role session assumes another role, limits the new session to one hour.

A trust policy for EC2 lets the EC2 service assume the role on behalf of an instance:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "ec2.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
```

### Passing a Role to a Service

When you create a Lambda function, launch an EC2 instance with a profile, or start a CloudFormation stack with a service role, you are telling an AWS service to act as a role. That requires `iam:PassRole` permission on the role. Without the restriction, anyone who can create a Lambda function could attach an administrator role to it and borrow its permissions, so scope `iam:PassRole` to the specific roles each team should be able to hand to services.

**Service-linked roles** are a special case. AWS creates them for a service's own use, their trust and permissions are predefined, and you can't edit what they allow.

---

## IAM Policies

### Policy Structure

A policy is a JSON document of one or more statements:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::my-bucket/*",
    "Condition": {
      "IpAddress": { "aws:SourceIp": "203.0.113.0/24" }
    }
  }]
}
```

| Element | Meaning |
|---|---|
| `Version` | The policy language version. Use `2012-10-17`, the current one |
| `Effect` | `Allow` or `Deny` |
| `Action` | Service actions, such as `s3:GetObject` or `ec2:Describe*` |
| `Resource` | The ARNs the statement applies to |
| `Condition` | Optional tests on the request context, such as source IP, MFA, tags, or time |
| `Principal` | Who the statement applies to. Only in resource-based policies, since an identity policy already applies to the identity it is attached to |

### Policy Types

Only two types of policy can grant access. The rest can only narrow it.

| Type | Attached to | Grants access? | Use it for |
|---|---|---|---|
| **Identity-based: AWS managed** | Users, groups, roles | Yes | Quick starts and job functions such as `ReadOnlyAccess` |
| **Identity-based: customer managed** | Users, groups, roles | Yes | Your own reusable permissions |
| **Identity-based: inline** | One user, group, or role | Yes | A policy that must live and die with one identity |
| **Resource-based** | Resources such as S3 buckets, SQS queues, KMS keys, and role trust policies | Yes | Cross-account access and service-to-service grants |
| **Permissions boundary** | A user or role | No, sets a maximum | Letting teams create roles without escalating their own privileges |
| **SCP / RCP** | Organization root, OU, or account | No, sets a maximum | Organization-wide guardrails |
| **Session policy** | Passed when assuming a role or requesting a federation token | No, narrows one session | Handing out a narrower slice of a role temporarily |
| **VPC endpoint policy** | A VPC endpoint | No, limits requests through that endpoint | Restricting which principals and resources can be reached from inside a VPC |

Prefer customer managed policies over inline ones, because they can be reused, versioned, and reviewed in one place.

### Organization Guardrails

Accounts in AWS Organizations can have two more policy types applied from the organization root, an organizational unit (OU, a folder of accounts), or the account itself. **Service control policies (SCPs)** cap what principals in an account can do, and **resource control policies (RCPs)** cap what can be done to resources in an account. Neither grants anything. They only set the ceiling that the account's own policies work beneath, and they never apply to the management account. How to design them and where to attach them is part of AWS Organizations.

### How AWS Evaluates a Request

For a request within one account, AWS gathers every applicable policy and checks them in a fixed order. An explicit `Deny` anywhere ends the evaluation with Deny. RCPs and SCPs must then allow the action. After that, the request needs an allow from either a resource-based policy or an identity-based policy. In most cases any permissions boundary or session policy must also allow it, with one exception covered below.

{% include figure.html id="aws-iam-policy-evaluation" %}

Within one account, identity-based and resource-based policies combine as a **union**. An allow in either is enough, so a bucket policy that names a user grants access even if the user's own policies say nothing about the bucket. The other layers combine as an **intersection**, because each must allow the action for it to go through. One nuance sits in the resource-based step. A resource policy that names an IAM user or a specific role session grants access on its own. (One edge case: a session created with `GetFederationToken` is still limited by its session policy when the resource policy names the IAM user rather than the session.) A resource policy that names a role's ARN is still limited by that role's permissions boundary and session policy, because the caller is actually a session of the role.

Two exceptions to the union rule are role trust policies and KMS key policies. Both must explicitly allow the principal, even within the same account.

### Cross-Account Evaluation

When a principal in one account (the **trusted** account) calls a resource in another (the **trusting** account), AWS evaluates the request in both accounts, and both must allow it. The caller's identity policy must allow the action in the trusted account, and a resource-based policy in the trusting account must allow the caller. A role's trust policy is that resource-based policy when the access goes through a role.

{% include figure.html id="aws-iam-cross-account-role" %}

A role is the usual route when the caller needs many resources in the other account, because one trust relationship covers everything the role's permissions policy allows. A direct resource-based policy, such as a bucket policy naming the other account, suits sharing a single resource, and the caller keeps its own identity rather than switching to a role.

### Attribute-Based Access Control

Policies can compare tags instead of listing resources. A condition such as `"aws:ResourceTag/project": "${aws:PrincipalTag/project}"` lets a principal act only on resources tagged with the same project as the principal. This **attribute-based access control (ABAC)** keeps policies stable as resources are added, because a new resource only needs the right tag. It depends on tags being governed, since anyone who can change a tag can change who has access.

### Common Policy Patterns

**Read access to one bucket.** `s3:ListBucket` acts on the bucket ARN, while `s3:GetObject` acts on objects, whose ARNs end in `/*`. A policy needs both resources:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:GetObject", "s3:ListBucket"],
    "Resource": [
      "arn:aws:s3:::my-bucket",
      "arn:aws:s3:::my-bucket/*"
    ]
  }]
}
```

**Require MFA for destructive actions.** A `Deny` with `BoolIfExists` also catches requests where the MFA key is absent, such as calls made with long-term access keys:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Deny",
    "Action": ["ec2:TerminateInstances", "rds:DeleteDBInstance"],
    "Resource": "*",
    "Condition": {
      "BoolIfExists": { "aws:MultiFactorAuthPresent": "false" }
    }
  }]
}
```

**Access that ends on a date.** A `Deny` conditioned on `aws:CurrentTime` removes a contractor's access automatically:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Deny",
    "Action": "*",
    "Resource": "*",
    "Condition": {
      "DateGreaterThan": { "aws:CurrentTime": "2027-03-31T23:59:59Z" }
    }
  }]
}
```

### Finding Out Why a Request Was Denied

Most AWS services return an access denied message that names the policy type responsible. An explicit deny reads `with an explicit deny in a service control policy`, sometimes followed by the policy's ARN. An implicit deny reads `because no identity-based policy allows the s3:GetObject action`. That phrase tells you which step of the evaluation flow stopped the request. When several policy types deny it, the message names only one, so fix that one and try again. The **IAM policy simulator** tests a principal's policies against an action without making the real call, and the **last accessed** information on each user and role shows which services it has actually used.

### IAM Access Analyzer

**IAM Access Analyzer** uses automated reasoning over your policies to show who can reach what. Its capabilities are:

| Capability | What it finds | Scope and cost |
|---|---|---|
| **External access** | Resources shared outside your zone of trust (account or organization), such as a public bucket or a role another account can assume | Regional, so create an analyzer in each Region you use |
| **Internal access** | Which principals inside your organization or account can reach selected critical resources | Paid per monitored resource |
| **Unused access** | Unused roles, access keys, and passwords, plus unused services and actions on active principals | Not Region-specific. Paid per role and user analyzed |
| **Policy validation** | Grammar errors and deviations from best practice as you write a policy | Free |
| **Custom policy checks** | Whether a policy grants new access compared to its previous version, or allows actions you've marked critical | Paid per check |
| **Policy generation** | A least-privilege policy built from a principal's CloudTrail activity | Uses your CloudTrail logs |

A practical least-privilege loop starts with a broad AWS managed job-function policy, lets the workload run, generates a policy from its actual activity, and replaces the broad one. Custom policy checks in a CI pipeline then stop a policy change that grants new access from merging unreviewed.

---

## Workforce Access with IAM Identity Center

**IAM Identity Center** (formerly AWS Single Sign-On) gives people one sign-in for every AWS account they are allowed into. It hands out temporary credentials, so no human needs an IAM user or an access key.

### Instances and Where to Enable Them

An **organization instance** is enabled in the AWS Organizations management account, the account that owns the organization, and is the only kind that can grant access to multiple AWS accounts. Its administration can be delegated to a member account, which keeps day-to-day work out of the management account. An **account instance** is bound to one account and Region and serves only application sign-in within that account, not access to AWS accounts. For workforce access to AWS, use an organization instance.

### How Access Is Granted

Three pieces work together:

1. **Identity source.** Where users and groups come from: the Identity Center directory itself, Active Directory (through AWS Managed Microsoft AD or AD Connector to a self-managed directory), or an external identity provider such as Okta, Microsoft Entra ID, or Google Workspace over SAML 2.0.
2. **Permission sets.** A permission set is a template of policies defined once in Identity Center: AWS managed policies, customer managed policies, an inline policy, and optionally a permissions boundary. A customer managed policy is referenced by name and path, so a policy with that name and path must already exist in every account the permission set is assigned to.
3. **Account assignments.** An assignment says which users or groups get which permission set in which account.

When you assign a permission set to an account, Identity Center creates an IAM role in that account named `AWSReservedSSO_<PermissionSetName>_<suffix>`, attaches the permission set's policies, and keeps the role in sync when the permission set changes. Signing in means assuming that role. The session length comes from the permission set, which defaults to one hour and can be set as high as 12 hours.

{% include figure.html id="aws-iam-identity-center-flow" %}

### Automatic Provisioning with SCIM

With an external identity provider, SAML 2.0 handles sign-in, and **SCIM** (System for Cross-domain Identity Management) keeps users and groups in sync. With SCIM enabled, the provider creates users in Identity Center when they join, updates their attributes and group memberships, and deactivates them when they leave. Without it, users and groups must be created in Identity Center by hand to match the provider.

### Attributes for Access Control

Identity Center can pass user attributes from the identity provider, such as department or cost center, into each role session as **session tags**. Policies in a permission set can then compare those tags with resource tags, bringing the attribute-based access control described earlier to workforce access without a permission set per team.

### Signing In

People reach AWS through the **AWS access portal**, a URL such as `https://my-org.awsapps.com/start`. After signing in with their identity provider, they see the accounts and permission sets assigned to them and open the console with temporary credentials. The CLI uses the same path:

```bash
# One-time setup: prompts for the portal URL, Region, account, and permission set
aws configure sso

# Each working session: opens a browser to sign in, then caches temporary credentials
aws sso login --profile my-profile

aws s3 ls --profile my-profile
```

No access key is ever written to the developer's machine, and revoking access means removing an assignment in one place.

---

## Workload Identity Patterns

Every workload running on AWS should get its credentials from a role. The mechanism differs by compute type:

| Workload | Mechanism |
|---|---|
| EC2 instance | An **instance profile** wraps a role. The SDK fetches and refreshes credentials from the instance metadata service |
| Lambda function | An **execution role** |
| ECS task | A **task role** for the application, separate from the task execution role ECS uses to pull images and write logs |
| EKS pod | **EKS Pod Identity**, or the older IAM Roles for Service Accounts (IRSA) |
| CI/CD outside AWS (GitHub Actions, GitLab) | **OIDC federation**: the pipeline exchanges an OpenID Connect identity token, issued by the CI platform, for a role session |
| On-premises server | **IAM Roles Anywhere**: an X.509 certificate from your PKI is exchanged for a role session |
| Another AWS account | **Role assumption** through a trust policy, as in the cross-account figure above |

### A Lambda Function's Execution Role

A function that writes to one DynamoDB table and publishes to one SNS topic gets a role that trusts `lambda.amazonaws.com` and a permissions policy naming exactly those resources:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:UpdateItem"],
      "Resource": "arn:aws:dynamodb:us-east-1:123456789012:table/Orders"
    },
    {
      "Effect": "Allow",
      "Action": "sns:Publish",
      "Resource": "arn:aws:sns:us-east-1:123456789012:order-notifications"
    },
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "arn:aws:logs:us-east-1:123456789012:*"
    }
  ]
}
```

The function code contains no credentials, and changing its permissions doesn't require a redeploy.

### A Deployment Role in Another Account

A pipeline in a tools account deploying to production assumes a role in the production account. The production role's trust policy names the tools account:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "AWS": "arn:aws:iam::111111111111:root" },
    "Action": "sts:AssumeRole"
  }]
}
```

The principal `arn:aws:iam::111111111111:root` means the tools account as a whole, which delegates the decision to that account's own policies. Only principals there whose identity policy allows `sts:AssumeRole` on this role can use it, so the tools account must grant that permission to the pipeline's role alone. Naming the pipeline's role ARN in the trust policy tightens it further.

People don't need this pattern when the organization uses IAM Identity Center. Assign them a permission set in the production account directly.

### Third-Party Access and the External ID

When a vendor's service assumes a role in your account, add an **external ID** condition to the trust policy:

```json
"Condition": { "StringEquals": { "sts:ExternalId": "vendor-issued-unique-id" } }
```

Without it, the vendor's account is trusted by many customers' roles, and another of its customers could supply your role's ARN and trick the vendor into acting on your account. This is the **confused deputy** problem. The vendor generates a unique external ID per customer and passes it on every assumption, so a request carrying another customer's ID fails. External IDs are for third parties. Roles shared between your own accounts don't need them.

---

## Securing the Root User

Every account has a root user with complete access. AWS now enforces MFA for root users across all account types. A root user without a registered MFA device is prompted to add one at sign-in. Up to eight MFA devices can be registered per root user, which lets an organization keep a backup device separate from the primary.

### Centralized Root Access

In AWS Organizations, **centralized root access** lets the management account, or a delegated administrator for IAM, remove the root password, access keys, and MFA from member accounts entirely. New accounts created in the organization then start with no root credentials. A few of the tasks that need root, such as deleting an S3 bucket policy or SQS queue policy that denies everyone, can be performed centrally as privileged tasks without ever signing in as that account's root user. A **delegated administrator** is a member account that the management account has authorized to administer a service on the organization's behalf.

### Tasks That Still Require Root

The root user remains necessary for a short list of tasks, including:

- Closing a standalone account, or changing its root email address and password (for member accounts, closing the account and changing the root email can be done centrally)
- Restoring permissions when the only IAM administrator has locked themselves out
- Activating IAM access to the Billing and Cost Management console
- Enabling MFA delete on an S3 bucket
- Editing or deleting an S3 bucket policy or SQS queue policy that denies all principals
- Registering as a seller in the Reserved Instance Marketplace
- Signing up for AWS GovCloud (US)

Outside these tasks, keep the root user unused. Delete any root access keys, send the root email to a monitored group address rather than one person's inbox, and alert on any root sign-in.

---

## Common Pitfalls

### Access Keys in Code

Keys committed to a repository leak, and a leaked key works until someone deletes it. Workloads on AWS should use roles. Developers should use `aws configure sso` for temporary credentials, and pipelines outside AWS should use OIDC federation.

### Wildcard Permissions

`"Action": "*"` with `"Resource": "*"` makes every compromise a full compromise and hides what the identity actually needs. Start from a job-function policy, then use Access Analyzer's policy generation to narrow it to observed activity.

### Fixing a Denial in the Wrong Policy

A denied request tends to get fixed by adding permissions to the caller's identity policy, even when the real block is an SCP, a permissions boundary, or a resource policy in another account. Read the policy type in the access denied message before changing anything.

---

## Key Takeaways

1. **People federate, workloads assume roles.** IAM Identity Center gives people temporary credentials through their identity provider, and every workload on AWS gets a role. IAM users and access keys are the exception.
2. **Deny by default, explicit deny always wins.** A request needs an allow from an identity-based or resource-based policy. In member accounts, SCPs and RCPs must allow it, and boundaries and session policies must too, unless a resource policy grants to the user or session directly.
3. **Identity and resource policies combine as a union in one account.** Across accounts, both sides must allow the request.
4. **Only identity-based and resource-based policies grant.** Permissions boundaries, SCPs, RCPs, and session policies only set ceilings.
5. **Scope `iam:PassRole`.** It controls which roles can be handed to services, which makes it an escalation path when left open.
6. **Use Access Analyzer as a loop, not an audit.** Generate policies from activity, check new policies in CI, and remove what the unused access analyzer reports.
7. **External IDs are for third parties.** They stop a vendor from being tricked into using your role on another customer's behalf.
8. **Lock the root user away.** MFA is enforced for every account type. In an organization, remove member-account root credentials entirely and use centralized privileged tasks for the rare jobs that need root.
