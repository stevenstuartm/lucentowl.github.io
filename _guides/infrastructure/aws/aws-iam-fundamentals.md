---
title: "AWS IAM: Identity and Access Management for Architects"
layout: guide
category: AWS
subcategory: Identity & Access Management
description: "Modern AWS identity management including IAM Identity Center for workforce access, AWS Organizations with Service Control Policies, and IAM roles for workloads following 2024/2025 best practices."
tags: [infrastructure, aws, iam, security, access-control, fundamentals]
---

## What is AWS Identity and Access Management

**AWS Identity and Access Management (IAM)** controls who can access your AWS resources and what actions they can perform. Every API call to AWS goes through IAM for authentication (who are you?) and authorization (what can you do?).

### What Problems IAM Solves

**Without IAM:**
- Everyone shares root account credentials (massive security risk)
- No way to grant limited access to resources
- Cannot audit who did what
- Cannot enforce compliance policies across accounts
- No secure way for AWS services to access other services

**With IAM:**
- Centralized workforce identity management across multiple accounts with IAM Identity Center
- Temporary credentials that expire automatically, eliminating long-term credential exposure
- Principle of least privilege, granting only necessary permissions
- Services access other services securely without hardcoded credentials using roles
- Complete audit trail of all actions through CloudTrail integration
- Organization-wide guardrails prevent policy violations using Service Control Policies

### How IAM Works

```
1. Principal (who) makes a request
   ↓
2. AWS authenticates the principal (is this identity valid?)
   ↓
3. AWS evaluates policies (is this action allowed?)
   ↓
4. AWS allows or denies the request
```

<div class="callout callout--warning">
<p class="callout__title">Key Principle</p>
<p>IAM follows <strong>deny by default</strong>. Unless a policy explicitly allows an action, it's denied.</p>
</div>

### AWS's 2024 Recommendation

**For human workforce access:** Use IAM Identity Center with temporary credentials, not individual IAM users.

**For workload access:** Use IAM roles attached to compute resources (EC2, Lambda, ECS), not long-term access keys.

**Why the shift:** Over 40% of cloud breaches originate from unnecessarily broad privileges. Over 80% of cloud breaches link to misconfigurations, often from overly permissive access. Long-term credentials like access keys represent persistent attack vectors. Temporary credentials that expire automatically reduce this risk.

---

## Modern Approach: IAM Identity Center

### What is IAM Identity Center?

**IAM Identity Center** (formerly AWS SSO) is AWS's recommended solution for managing workforce access across multiple AWS accounts. It provides single sign-on through a unified portal with temporary credentials that refresh automatically.

**Why IAM Identity Center is Now the Default:**

AWS explicitly recommends: "For centralized access management, we recommend that you use AWS IAM Identity Center to manage access to your accounts and permissions within those accounts."

### How IAM Identity Center Works

**Architecture:**

```
Users (Okta, Azure AD, Google Workspace, or Identity Center Directory)
   ↓
IAM Identity Center (organization level)
   ↓
Permission Sets (centralized role templates)
   ↓
Automatically created roles in member accounts
   ↓
Temporary credentials (configurable duration, up to 12 hours)
```

**Key Components:**

1. **Identity Source:** Where user identities originate
   - IAM Identity Center identity store (native AWS directory)
   - AWS Managed Microsoft AD
   - AD Connector (proxy to on-premises AD)
   - External SAML 2.0 providers (Okta, Azure AD, Google Workspace)

2. **Permission Sets:** Templates defining collections of IAM policies
   - Created once centrally
   - Automatically deployed to member accounts as IAM roles
   - Updated centrally; changes propagate automatically

3. **Account Assignments:** Which users/groups get which permission sets in which accounts

### Permission Sets vs. Traditional IAM Roles

**What Happens Behind the Scenes:**

When you assign a permission set to users for specific accounts, IAM Identity Center:
1. Creates corresponding IAM roles in each target account (named `AWSReservedSSO_[PermissionSetName]_[UniqueID]`)
2. Attaches the policies defined in the permission set to those roles
3. Updates roles automatically when you modify the permission set centrally
4. Manages trust policies allowing Identity Center to assume those roles

**Key Differences:**

| Aspect | Permission Sets (Identity Center) | Traditional IAM Roles |
|--------|-----------------------------------|----------------------|
| Management | Centralized: update once, applies everywhere | Per-account manual management |
| Deployment | Automatic across assigned accounts | Manual creation in each account |
| Updates | Propagate automatically to all accounts | Must update each account individually |
| Access Method | Through IAM Identity Center portal or CLI | Direct AWS console or API access |
| Credentials | Always temporary with configurable session duration | Can be assumed with various credential types |
| Use Case | Workforce users accessing multiple accounts | Service-to-service, cross-account, workloads |

**Policy Types Supported in Permission Sets:**
- AWS managed policies (`PowerUserAccess`, `ReadOnlyAccess`, etc.)
- Customer-managed policies (must exist in target accounts)
- Inline policies
- Permissions boundaries (set maximum permission ceiling)

### Setting Up IAM Identity Center

**Prerequisites:**
- AWS Organizations must be enabled
- Organization instance (recommended) manages access across all accounts

**Basic Setup:**

1. **Enable IAM Identity Center** in the management account
2. **Choose identity source:**
   - Start with Identity Center directory for testing
   - Connect external IdP for production (Okta, Azure AD, etc.)
3. **Create permission sets** for job functions:
   - Developers: `PowerUserAccess` (most services, no IAM)
   - Admins: `AdministratorAccess` (full access)
   - ReadOnly: `ViewOnlyAccess` (audit and monitoring)
4. **Create users and groups** (or sync from IdP via SCIM)
5. **Assign users/groups to accounts** with appropriate permission sets

### SCIM Provisioning for Automated User Management

**SCIM (System for Cross-domain Identity Management)** enables automatic user and group synchronization from external identity providers.

**What SCIM Automates:**
- User creation when they join the organization
- User updates when attributes change (name, email, group membership)
- User deactivation when they leave the organization
- Group synchronization from IdP to IAM Identity Center

**Setup Process (Example with Okta):**
1. Enable automatic provisioning in IAM Identity Center settings
2. Copy SCIM endpoint URL (e.g., `https://scim.us-east-2.amazonaws.com/[ID]/scim/v2`)
3. Copy access token
4. Configure identity provider with endpoint and token
5. Enable provisioning features (create users, update attributes, deactivate users, push groups)

**Important:** SCIM requires SAML 2.0 authentication to work together. Both SAML (authentication) and SCIM (synchronization) must be configured for complete integration.

### Accessing AWS with IAM Identity Center

**Console Access:**
1. User navigates to Identity Center portal (e.g., `https://myorg.awsapps.com/start`)
2. Authenticates with IdP credentials
3. Sees list of accounts they have access to
4. Selects account and role
5. Gets redirected to AWS Management Console with temporary credentials

**CLI/SDK Access:**

```bash
# Configure IAM Identity Center profile
aws configure sso

# CLI prompts for:
# - SSO start URL (e.g., https://myorg.awsapps.com/start)
# - Region
# - Account and role selection

# After configuration, authenticate
aws sso login --profile my-profile

# Use AWS CLI normally
aws s3 ls --profile my-profile

# Credentials refresh automatically through the CLI
```

<div class="callout callout--tip">
<p class="callout__title">Why This is Better Than Access Keys</p>
<ul>
<li>No long-term credentials stored on developer workstations</li>
<li>Credentials refresh automatically before expiration</li>
<li>Easy to revoke access centrally (update permission set or account assignment)</li>
<li>Complete audit trail (CloudTrail shows which user performed actions)</li>
</ul>
</div>

### When to Use IAM Identity Center

**Use IAM Identity Center When:**
- ✅ Managing human workforce access
- ✅ Operating in multi-account AWS Organizations environment
- ✅ Users need AWS Management Console access
- ✅ Developers need CLI/SDK access
- ✅ You have (or plan to implement) external identity provider
- ✅ Compliance requires temporary credentials and audit trails
- ✅ Centralized permission management is a priority

**Do NOT Use IAM Identity Center For:**
- ❌ Workloads running on AWS (use IAM roles attached to compute resources)
- ❌ Service-to-service authentication (use IAM roles)
- ❌ Third-party tools without Identity Center support (use traditional IAM with roles if possible)

---

## AWS Organizations and Multi-Account IAM

### What is AWS Organizations?

**AWS Organizations** enables centralized management of multiple AWS accounts. It provides consolidated billing, organizational hierarchy, and permission guardrails.

**Why Multi-Account Architecture Matters:**

AWS recommends multi-account architecture even for small organizations because:
- **Strong isolation:** Each account has separate IAM, resource limits, and API limits
- **Blast radius limitation:** Security incidents contained to individual accounts
- **Simplified compliance:** Apply compliance frameworks at account level
- **Clear ownership:** Accounts map to teams, projects, or environments
- **Better cost tracking:** Bills separated by account

**Organizational Structure:**

```
Organization (root)
├── Management Account (root account, consolidated billing)
├── OU: Security
│   ├── Logging Account
│   └── Audit Account
├── OU: Workloads
│   ├── OU: Production
│   │   ├── Prod App Account
│   │   └── Prod Data Account
│   └── OU: Non-Production
│       ├── Dev Account
│       └── Test Account
└── OU: Sandbox
    └── Developer Sandbox Accounts
```

### Service Control Policies (SCPs)

**What Are SCPs?**

Service Control Policies define maximum available permissions for accounts in an organization. They do NOT grant permissions; they set permission ceilings.

**Critical Understanding:**

| Service Control Policies (SCPs) | IAM Policies |
|-------------------------------|-------------|
| Define maximum available permissions | Grant actual permissions |
| Organization, OU, or account level | User, group, role, or resource level |
| Do NOT grant permissions | Can grant or deny permissions |
| Cumulative restrictions from all parents | Applied directly to identity or resource |
| Affect all IAM users and roles in member accounts | Affect specific IAM identity or resource |

**The Intersection Principle:**

Effective permissions = IAM policies (grants) ∩ SCPs (restrictions)

Both must allow an action for it to succeed. If an SCP denies S3 access, no IAM policy can grant it.

**What SCPs Do NOT Affect:**
- Management account users (SCPs don't restrict the management account itself)
- Service-linked roles (enable AWS service integration)
- Specific root user functions (Enterprise support registration, etc.)

**Common SCP Patterns:**

1. **Region Restriction:** Prevent resource creation outside approved regions

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Deny",
    "Action": "*",
    "Resource": "*",
    "Condition": {
      "StringNotEquals": {
        "aws:RequestedRegion": ["us-east-1", "us-west-2"]
      }
    }
  }]
}
```

2. **Prevent Account Removal:** Protect accounts from leaving organization

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

3. **Require MFA for Sensitive Operations:**

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Deny",
    "Action": [
      "ec2:StopInstances",
      "ec2:TerminateInstances",
      "rds:DeleteDBInstance"
    ],
    "Resource": "*",
    "Condition": {
      "BoolIfExists": {
        "aws:MultiFactorAuthPresent": "false"
      }
    }
  }]
}
```

**SCP Best Practices:**

1. **Test in isolated OU first:** Create a test OU, apply SCP, move one account into it to verify behavior before broader application
2. **Never remove FullAWSAccess without replacement:** Default allow-all policy must stay unless replaced with explicit allows
3. **Use hierarchical controls:** Organization-level for universal restrictions, OU-level for specific requirements
4. **Document SCP purpose:** Future teams need to understand why SCPs exist and what they prevent

### AWS Control Tower

**What is AWS Control Tower?**

AWS Control Tower provides the easiest way to set up and govern a secure, multi-account AWS environment called a landing zone.

**What Control Tower Includes:**
- Automated AWS Organizations setup
- Pre-configured IAM Identity Center with user groups and permission sets
- Account Factory for self-service account provisioning
- Guardrails (SCPs and AWS Config rules) enforcing best practices
- Centralized logging and monitoring

**Identity Center Integration:**

Control Tower automatically:
1. Creates preconfigured directory with user groups
2. Sets up permission sets for common roles
3. Configures Account Factory integration (users in AWSAccountFactory group can provision accounts)
4. Enables federated access to all accounts in the landing zone

**When to Use Control Tower:**

Use Control Tower when:
- ✅ Starting a new multi-account environment
- ✅ Want automated landing zone setup
- ✅ Need guardrails enforcing compliance
- ✅ Self-service account provisioning is required
- ✅ Centralized governance is a priority

Skip Control Tower when:
- ❌ Already have established AWS Organizations structure with custom configuration
- ❌ Guardrails conflict with existing requirements
- ❌ Need full customization without opinionated defaults

---

## Traditional IAM: Users, Groups, and Roles

### When Traditional IAM is Still Necessary

**IAM Identity Center and AWS Organizations are the modern approach for workforce access.** Traditional IAM users are now limited to specific edge cases.

**Use IAM Users Only When:**
- Workloads absolutely cannot use IAM roles (verified limitation)
- Third-party tools lack IAM Identity Center or federation support
- Service-specific credentials required (CodeCommit SSH, Amazon Keyspaces)
- Emergency break-glass access as fallback

**Do NOT Use IAM Users For:**
- ❌ Human workforce console access (use IAM Identity Center)
- ❌ Developer CLI access (use IAM Identity Center SSO)
- ❌ CI/CD pipelines that support federation (GitHub Actions, GitLab)
- ❌ Applications running on AWS (use IAM roles)

### IAM Users

**IAM User:** A permanent named identity with long-term credentials (password and/or access keys).

**Characteristics:**
- Has long-term credentials (password for console, access keys for API)
- Represents a specific person or application
- Can belong to multiple groups (up to 10)
- Can have policies attached directly (though not recommended)

**When IAM Users Are Appropriate:**
- Applications unable to assume roles (certain WordPress plugins, legacy systems)
- Third-party tools without Identity Center support
- CodeCommit SSH access (service-specific credentials with SSH keys)
- Amazon Keyspaces access (service-specific credentials for Cassandra compatibility)

**Access Key Management (When Required):**
- Rotate access keys every 90 days
- Monitor "access key last used" information in IAM console
- Remove unused access keys immediately
- Never embed credentials in code or version control
- Use AWS Secrets Manager or Parameter Store for credential storage
- Enable IAM Access Analyzer to detect unused access keys

### IAM Groups

**IAM Group:** A collection of IAM users that share the same permissions.

**Characteristics:**
- Simplifies permission management
- Users can belong to multiple groups (up to 10)
- Groups cannot be nested (no groups within groups)
- Groups cannot have roles
- Policies attached to groups apply to all members

**When to Use Groups:**
- Organizing IAM users by job function (when IAM users are necessary)
- Applying common permissions to multiple users
- Simplifying permission management for legacy IAM user setups

**Example Group Structure:**

```
Developers Group → PowerUserAccess (all services except IAM)
DBAs Group → RDS full access, EC2 read-only
Admins Group → AdministratorAccess (use sparingly)
```

### IAM Roles

**IAM Role:** A set of permissions that can be assumed temporarily by trusted entities.

**Characteristics:**
- No long-term credentials (temporary security credentials generated on demand)
- Can be assumed by users, services, or external identities
- Credentials expire automatically (typically 1 hour, configurable up to 12 hours)
- Trust policy defines who can assume the role
- Permissions policy defines what the role can do

**When to Use Roles:**
- ✅ EC2 instances accessing other AWS services (instance profiles)
- ✅ Lambda functions accessing other AWS services (execution roles)
- ✅ ECS tasks accessing other AWS services (task roles)
- ✅ Cross-account access
- ✅ Federation (external identity providers)
- ✅ AWS services acting on your behalf (e.g., CloudFormation creating resources)

**Critical Distinction:** IAM users have permanent credentials; IAM roles provide temporary credentials that must be assumed.

### Role Trust Policies

**Trust Policy:** Defines which principals can assume the role.

**Example: EC2 Instance Role Trust Policy:**

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "ec2.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
```

This allows EC2 instances to assume the role.

**Example: Cross-Account Role Trust Policy:**

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"AWS": "arn:aws:iam::111111111111:root"},
    "Action": "sts:AssumeRole",
    "Condition": {
      "StringEquals": {
        "sts:ExternalId": "unique-external-id"
      }
    }
  }]
}
```

This allows account 111111111111 to assume the role, with external ID protection against the confused deputy problem.

---

## IAM Policies

### Policy Structure

Every IAM policy has the same basic structure:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::my-bucket/*",
      "Condition": {
        "IpAddress": {
          "aws:SourceIp": "203.0.113.0/24"
        }
      }
    }
  ]
}
```

**Components:**

| Component | Description | Example |
|-----------|-------------|---------|
| **Version** | Policy language version (always `2012-10-17`) | `"2012-10-17"` |
| **Statement** | Array of permission statements | See example above |
| **Effect** | `Allow` or `Deny` | `"Allow"` |
| **Action** | AWS service actions | `"s3:GetObject"`, `"ec2:*"` |
| **Resource** | ARN of resources the statement applies to | `"arn:aws:s3:::my-bucket/*"` |
| **Condition** | Optional conditions that must be true | IP address, MFA, time of day, tags |

### Policy Evaluation Logic

When evaluating whether to allow or deny a request, IAM follows this logic:

1. **Default deny:** Start with implicit deny
2. **Evaluate all applicable policies:** Check identity-based, resource-based, SCPs, permission boundaries
3. **Explicit deny wins:** If any policy denies, the request is denied
4. **Explicit allow needed:** If no explicit allow exists, the request is denied
5. **Allow if no deny and at least one allow**

**Key Rule:** An explicit deny always overrides any allows.

**Multi-Account Evaluation:**

In AWS Organizations, effective permissions are the intersection of:
1. Identity-based policies (what the identity is allowed to do)
2. SCPs (maximum permissions from organization/OU/account)
3. Permission boundaries (if attached, sets maximum for that identity)
4. Session policies (if provided during role assumption, further restricts)
5. Resource-based policies (for cross-account access)

### Common Policy Patterns

#### Read-Only Access to Specific S3 Bucket

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::my-bucket",
        "arn:aws:s3:::my-bucket/*"
      ]
    }
  ]
}
```

**Note:** `ListBucket` acts on the bucket itself (ARN without `/*`), while `GetObject` acts on objects within the bucket (ARN with `/*`).

#### Deny All Except Specific Regions

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Deny",
    "Action": "*",
    "Resource": "*",
    "Condition": {
      "StringNotEquals": {
        "aws:RequestedRegion": ["us-east-1", "us-west-2"]
      }
    }
  }]
}
```

**Use Case:** Compliance requires resources only in specific geographic regions. This SCP or IAM policy prevents resource creation outside approved regions.

#### Require MFA for Sensitive Operations

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Deny",
    "Action": [
      "ec2:StopInstances",
      "ec2:TerminateInstances",
      "rds:DeleteDBInstance"
    ],
    "Resource": "*",
    "Condition": {
      "BoolIfExists": {
        "aws:MultiFactorAuthPresent": "false"
      }
    }
  }]
}
```

**Use Case:** Prevent accidental deletion of production resources without MFA.

#### Time-Based Access (Temporary Contractor)

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Deny",
    "Action": "*",
    "Resource": "*",
    "Condition": {
      "DateGreaterThan": {"aws:CurrentTime": "2024-12-31T23:59:59Z"}
    }
  }]
}
```

**Use Case:** Contractor access expires automatically after specified date.

### Policy Types

| Type | Description | When to Use |
|------|-------------|-------------|
| **AWS Managed Policies** | Pre-built policies maintained by AWS | Quick setup, common use cases like `ReadOnlyAccess`, `PowerUserAccess` |
| **Customer Managed Policies** | Custom policies you create and manage | Reusable permissions across multiple identities |
| **Inline Policies** | Embedded directly in a single user, group, or role | Strict one-to-one relationship; policy should not outlive the identity |
| **Resource-Based Policies** | Attached to resources like S3 buckets, SQS queues, Lambda functions | Cross-account access, service-specific permissions |
| **Permission Boundaries** | Maximum permissions an identity can have | Delegating role/user creation while preventing privilege escalation |
| **Service Control Policies** | Organization-wide guardrails | Enforce compliance across all accounts |

**Best Practice:** Use customer managed policies for reusability. Use inline policies only when the policy must be tightly coupled to a single identity.

### IAM Access Analyzer

**What is IAM Access Analyzer?**

IAM Access Analyzer uses automated reasoning with mathematical logic to analyze permissions and determine all possible access paths. It evaluates hundreds or thousands of policies in seconds.

**Key Capabilities:**

1. **Unused Access Detection:** Identifies unused roles, access keys, passwords, services, and actions
2. **Policy Generation from Activity:** Generates fine-grained policies based on actual usage from CloudTrail logs
3. **Policy Validation:** Provides 100+ policy checks with actionable recommendations (security warnings, errors, suggestions)
4. **External Access Analysis:** Identifies resources shared with external entities (public or cross-account)

**How to Use IAM Access Analyzer:**

1. **Enable Access Analyzer** in each region (cross-region resources require per-region analyzers)
2. **Define zone of trust:** Organization, account, or custom
3. **Review findings:** External access, unused permissions, policy validation errors
4. **Generate least-privilege policies:** Use CloudTrail activity to create fine-grained policies
5. **Refine permissions:** Remove unused services and actions systematically

**Best Practices:**
- Create organization-level analyzer for cross-account visibility
- Schedule regular reviews of findings
- Integrate with EventBridge for automated alerts
- Validate policies in CI/CD before deployment
- Use policy generation feature to replace overly broad policies

---

## Workload Identity Patterns

### EC2 Instance Accessing S3

**Scenario:** Web application running on EC2 needs to read/write files to S3.

**Architecture:**

1. Create IAM role with permission policy granting S3 access:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "s3:GetObject",
      "s3:PutObject"
    ],
    "Resource": "arn:aws:s3:::my-app-bucket/*"
  }]
}
```

2. Create trust policy allowing EC2 to assume the role:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "ec2.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
```

3. Attach role to EC2 instance (instance profile)
4. Application code uses AWS SDK (automatically retrieves credentials from instance metadata)

**Why This Works:**
- No hardcoded credentials in application
- Automatic credential rotation (new credentials every hour)
- Easy to update permissions (change role policy, not application code)
- Complete audit trail (CloudTrail shows which instance performed actions)

### Lambda Function Accessing DynamoDB and SNS

**Scenario:** Lambda function needs to write to DynamoDB and send notifications via SNS.

**Architecture:**

1. Create Lambda execution role with trust policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "lambda.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
```

2. Attach permission policy granting necessary access:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:UpdateItem"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:123456789012:table/Orders"
    },
    {
      "Effect": "Allow",
      "Action": "sns:Publish",
      "Resource": "arn:aws:sns:us-east-1:123456789012:order-notifications"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

3. Assign role to Lambda function

**Why This Works:**
- Follows least privilege (only specific table and topic, not all DynamoDB/SNS)
- No credentials in function code
- Easy to update permissions without redeploying function

### Cross-Account Access

**Scenario:** Developers in development account need read-only access to production resources.

**Architecture:**

1. **Production account:** Create role with trust policy allowing development account:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"AWS": "arn:aws:iam::111111111111:root"},
    "Action": "sts:AssumeRole",
    "Condition": {
      "StringEquals": {
        "sts:ExternalId": "unique-external-id"
      }
    }
  }]
}
```

2. Attach permission policy to role (what the role can do in production):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "ec2:Describe*",
      "rds:Describe*",
      "s3:ListBucket",
      "s3:GetObject"
    ],
    "Resource": "*"
  }]
}
```

3. **Development account:** Grant developers permission to assume the production role:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "sts:AssumeRole",
    "Resource": "arn:aws:iam::222222222222:role/ProdReadOnlyRole"
  }]
}
```

**How Developers Use It:**
- Switch role in AWS Console, or
- Use AWS CLI: `aws sts assume-role` to get temporary credentials

**Why This Works:**
- No duplicate user accounts across environments
- Easy to audit (CloudTrail logs role assumptions with user identity)
- Easy to revoke access (modify trust policy or remove assume-role permission)

### On-Premises Workload Accessing AWS

**Scenario:** On-premises server needs to access AWS services without long-term access keys.

**Modern Approach: IAM Roles Anywhere**

IAM Roles Anywhere enables on-premises workloads to use temporary credentials authenticated with X.509 certificates from your existing PKI.

**Architecture:**

1. Create trust anchor in IAM Roles Anywhere (references your certificate authority)
2. Create profile defining which roles can be assumed
3. Install AWS signing helper on on-premises server
4. Server uses its X.509 certificate to request temporary credentials
5. Temporary credentials refresh automatically

**Why This is Better Than Access Keys:**
- Temporary credentials (expire automatically)
- Uses existing PKI infrastructure
- Certificate lifecycle management (revocation, expiration)
- No long-term secrets stored on servers

**Legacy Approach (When Roles Anywhere Not Feasible):**

Create IAM user with access keys, rotate keys every 90 days, store in secrets management system.

---

## Security Best Practices

### 1. Require Human Users to Use Temporary Credentials

**AWS Recommendation:** "Require your human users to use temporary credentials when accessing AWS by using an identity provider for federated access to AWS accounts by assuming roles, which provide temporary credentials."

**Implementation:**
- Use IAM Identity Center for workforce access (not IAM users)
- Connect to external identity provider (Okta, Azure AD, Google Workspace)
- Configure permission sets for job functions
- Users access AWS through portal or CLI with temporary credentials

**Why:** Over 40% of cloud breaches originate from unnecessarily broad privileges. Long-term credentials (access keys) are persistent attack vectors.

### 2. Enable MFA for Root User (Mandatory as of 2024)

**Requirement:** Beginning mid-2024, root users of Organizations management accounts must enable MFA to proceed. All AWS accounts require root user MFA within 35 days of first sign-in attempt.

**Best Practices:**
- Enable multiple MFA devices (up to 8 devices) for redundancy
- Use hardware MFA for critical production accounts
- Store MFA device and root credentials separately
- Replace battery-powered hardware MFA devices regularly
- Make secure backup of QR code or secret configuration key
- Verify root access functionality periodically (test before emergencies)

### 3. Use Roles Instead of Long-Term Credentials

**For Workloads:**

| Workload Type | Recommended Approach |
|--------------|---------------------|
| EC2 instances | IAM instance profile |
| Lambda functions | IAM execution role |
| ECS tasks | IAM task role |
| EKS pods | IRSA (IAM Roles for Service Accounts) |
| On-premises servers | IAM Roles Anywhere |
| CI/CD pipelines (GitHub Actions, GitLab) | OIDC federation |
| Cross-account applications | IAM role assumption with trust policies |

**Only use long-term credentials (access keys) when:**
- Workload absolutely cannot use roles (verified limitation)
- Legacy applications unable to use STS
- Service-specific credentials required (CodeCommit SSH, Keyspaces)

### 4. Implement Least Privilege with IAM Access Analyzer

**Process:**

1. **Start with AWS managed policies** for job functions (`PowerUserAccess`, `DatabaseAdministrator`)
2. **Monitor actual usage** through CloudTrail logs
3. **Generate least-privilege policies** using IAM Access Analyzer based on real activity
4. **Refine iteratively** by removing unused permissions
5. **Set permissions boundaries** when delegating role creation to prevent privilege escalation

**IAM Access Analyzer Features:**
- Identifies unused roles, access keys, services, and actions
- Generates fine-grained policies from CloudTrail activity
- Validates policies against 100+ best practice checks
- Detects external access to resources

### 5. Use Service Control Policies for Organizational Guardrails

**When to Use SCPs:**
- Enforce region restrictions across organization
- Prevent accounts from leaving organization
- Require MFA for sensitive operations
- Block specific services (if compliance requires)
- Protect critical resources from deletion

**SCP Best Practices:**
- Test in isolated OU before broad application
- Document SCP purpose and rationale
- Never remove FullAWSAccess without replacement
- Use hierarchical controls (organization-level for universal rules, OU-level for specific requirements)

### 6. Enable CloudTrail for Complete Audit Trail

**What to Enable:**
- Organization trail (logs all member account activity)
- Multi-region trails (required for global services like IAM)
- Log file validation (cryptographic signatures)
- CloudTrail Lake for immutable long-term retention (compliance)

**Integration:**
- CloudWatch Logs for real-time monitoring
- Amazon Athena for SQL-based queries
- EventBridge for automated response to specific events
- Security Hub for security best practice evaluation

### 7. Secure the Root User

**Root User Best Practices:**
- Enable MFA with multiple devices
- Delete root user access keys (if any exist)
- Use corporate distribution list for root email (not individual's email)
- Document root user access procedures
- Store credentials in secure location (not on individual's devices)
- Use root user only for tasks requiring root credentials

**When Root User is Required:**
- Changing AWS Support plan
- Closing AWS account
- Restoring IAM user permissions (if locked out)
- Changing payment methods (in some cases)
- Registering as seller in Amazon Marketplace

---

## Common Pitfalls

### Pitfall 1: Using IAM Users for Workforce Access

**Problem:** Creating individual IAM users for each person in the organization instead of using IAM Identity Center.

**Why It's Bad:**
- Long-term credentials (access keys) represent persistent attack vectors
- Manual credential rotation required
- Per-account user management (difficult to scale)
- No centralized access revocation
- Difficult to audit (which actual person performed actions?)

**Solution:** Use IAM Identity Center with external identity provider integration. Users receive temporary credentials that expire automatically.

---

### Pitfall 2: Hardcoding Access Keys in Code

**Problem:** Developers hardcode access keys in application code or configuration files, then commit to version control.

**Why It's Bad:**
- Keys can be leaked to public repositories (happens constantly)
- Difficult to rotate credentials
- Violates least privilege (often uses overly permissive keys)
- No audit trail of which application performed actions

**Solution:** Use IAM roles for applications running on AWS. For local development, use AWS profiles and IAM Identity Center SSO (`aws configure sso`).

---

### Pitfall 3: Wildcard Permissions in Production

**Problem:** Policies with `Action: "*"` or `Resource: "*"` grant excessive permissions.

```json
{
  "Effect": "Allow",
  "Action": "*",
  "Resource": "*"
}
```

**Why It's Bad:**
- Violates least privilege
- Increases blast radius if credentials compromised
- Makes auditing difficult (what can this identity actually do?)

**Solution:** Use IAM Access Analyzer to generate least-privilege policies from actual usage. Start with AWS managed policies for job functions, then refine based on CloudTrail activity.

---

### Pitfall 4: Not Testing SCPs Before Applying

**Problem:** Applying SCPs to the organization root or production OUs without testing, causing widespread lockouts.

**Why It's Bad:**
- Can lock out all users (including admins) if SCP denies required permissions
- Difficult to recover (may require AWS Support intervention)
- Production impact (applications may stop working)

**Solution:** "Create an OU that you can move your accounts into one at a time" for SCP testing. Apply SCPs to test OU, verify behavior, then expand to production.

---

### Pitfall 5: Forgetting External ID for Third-Party Access

**Problem:** Creating cross-account roles for third-party services without requiring external ID.

**Why It's Bad:**
- Confused deputy problem: Third-party could access your resources using another customer's role ARN
- Security vulnerability allowing unauthorized access

**Solution:** Always require external ID for third-party access. The third party must generate the external ID (not customer-provided). Validate that the role cannot be assumed without the correct external ID before storing the customer's role ARN.

---

### Pitfall 6: Not Removing Unused Credentials

**Problem:** Leaving unused IAM users, access keys, roles, and permissions in place after they're no longer needed.

**Why It's Bad:**
- Dormant credentials represent attack surface
- Difficult to audit (what is actively used vs. abandoned?)
- Violates least privilege (more permissions than needed)

**Solution:** Use IAM Access Analyzer to identify unused roles, access keys, passwords, services, and actions. Schedule regular audits (quarterly) to remove unused credentials and permissions.

---

## Key Takeaways

1. **Use IAM Identity Center for all workforce access.** AWS explicitly recommends Identity Center instead of IAM users for human access. Connect to external identity provider, create permission sets for job functions, and users get temporary credentials through portal or CLI.

2. **Temporary credentials should be the default, not the exception.** Whether workforce users (Identity Center), AWS workloads (EC2/Lambda/ECS roles), or on-premises systems (Roles Anywhere), temporary credentials that expire automatically reduce the risk of credential compromise.

3. **Multi-account architecture with AWS Organizations is now standard.** Even small organizations benefit from account isolation, centralized governance through SCPs, and simplified identity management through Identity Center.

4. **Service Control Policies set permission ceilings, not grants.** SCPs restrict what IAM policies can allow. Effective permissions = IAM policies ∩ SCPs. Use SCPs for organizational guardrails (region restrictions, MFA requirements, service denials).

5. **IAM Access Analyzer automates least-privilege refinement.** Use it to generate policies from actual usage, identify unused permissions, validate policies against 100+ checks, and detect unintended external access.

6. **IAM users are now edge cases, not the default.** Use IAM users only for workloads unable to use roles, legacy tool compatibility, or service-specific credentials. Never use IAM users for workforce access.

7. **Root user MFA is now mandatory** (as of mid-2024). Enable multiple MFA devices for redundancy. Store root credentials separately from MFA device. Use root user only for tasks requiring root credentials.

8. **External ID is required for third-party access.** Always use external ID in cross-account trust policies for third-party services. The third party generates the external ID (not customer-provided) to prevent confused deputy attacks.

9. **IAM roles enable secure service-to-service access.** EC2, Lambda, ECS, and other compute services use roles to access other AWS services without hardcoded credentials. Credentials refresh automatically, and permissions can be updated without touching application code.

10. **Document IAM architecture decisions.** Future teams need to understand why roles exist, what permission sets do, why SCPs restrict specific actions, and what external IDs protect. Without documentation, they'll assume incompetence rather than recognizing intentional design.

**IAM is the foundation of AWS security. Get identity and access management right, and many other security concerns become manageable. Get it wrong, and no amount of encryption or network controls will protect you.**
