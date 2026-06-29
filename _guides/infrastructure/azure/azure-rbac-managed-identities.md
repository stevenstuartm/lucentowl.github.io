---
title: "Azure RBAC & Managed Identities"
layout: guide
category: Azure
subcategory: Identity & Access Management
description: "How Azure Role-Based Access Control works across the resource hierarchy, including built-in and custom roles, role assignment scope, Managed Identities for workload authentication, and Privileged Identity Management for just-in-time access."
tags: [infrastructure, azure, security, access-control, architecture, practical]
---

## What Is Azure RBAC

[Azure Role-Based Access Control](https://learn.microsoft.com/en-us/azure/role-based-access-control/overview){:target="_blank" rel="noopener noreferrer"} (RBAC) is the authorization system for Azure resources. While Entra ID handles authentication (proving who you are), RBAC handles authorization (determining what you can do). Every action on an Azure resource, whether through the portal, CLI, API, or IaC, is evaluated against RBAC role assignments.

### How RBAC Works

Every RBAC role assignment is a combination of three elements:

```
Role Assignment = Security Principal + Role Definition + Scope
```

**Security principal** is the identity requesting access. This can be a user, a group, a service principal, or a Managed Identity.

**Role definition** is a collection of permissions. Each permission specifies allowed or denied actions on Azure resource types. Azure provides over 300 built-in roles, and you can create custom roles.

**Scope** is the level in the resource hierarchy where the role assignment applies. Scopes follow the Azure hierarchy: management group, subscription, resource group, or individual resource.

### Scope and Inheritance

Role assignments inherit downward through the hierarchy. A role assigned at a management group applies to every subscription, resource group, and resource beneath it. A role assigned at a subscription applies to all resource groups and resources within it.

```
Management Group (Reader assigned here)
└── Subscription (Reader inherited)
    └── Resource Group (Reader inherited)
        └── Resource (Reader inherited)
```

This inheritance is additive. If a user has Reader at the subscription level and Contributor on a specific resource group, they can read everything in the subscription and modify resources in that one resource group. Permissions accumulate; they are never subtracted by a lower-scope assignment.

**Deny assignments** are the exception. Deny assignments explicitly block specific actions and override allow assignments. However, deny assignments cannot be created directly by users. They are created by Azure Blueprints and certain Azure managed applications to protect resources from modification.

---

## Built-In Roles

Azure provides a large number of [built-in roles](https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles){:target="_blank" rel="noopener noreferrer"}. Most access control needs can be met with built-in roles, and using them is preferred over creating custom roles because they are maintained by Microsoft and updated as new resource types and actions are added.

### Fundamental Roles

These four roles apply to all Azure resource types:

| Role | Permissions | Typical Use |
|------|------------|-------------|
| **Owner** | Full access to all resources, including the ability to assign roles to others | Subscription administrators, resource group owners who need to delegate access |
| **Contributor** | Full access to all resources but cannot assign roles | Developers and operators who need to create and manage resources but should not control access |
| **Reader** | Read-only access to all resources | Auditors, stakeholders who need visibility without modification ability |
| **User Access Administrator** | No resource access, but can manage role assignments | Security teams who manage access without needing to modify resources |

### Common Service-Specific Roles

Beyond the fundamental roles, Azure provides granular roles for specific services:

| Role | Scope | Grants |
|------|-------|--------|
| **Virtual Machine Contributor** | Compute | Manage VMs but not the VNet or storage they connect to |
| **Storage Blob Data Reader** | Storage | Read blob data (the data plane, not management plane) |
| **Storage Blob Data Contributor** | Storage | Read, write, and delete blob data |
| **SQL DB Contributor** | Databases | Manage SQL databases but not their security policies |
| **Key Vault Secrets User** | Security | Read secret values from Key Vault |
| **Key Vault Administrator** | Security | Full management of Key Vault including keys, secrets, and certificates |
| **Network Contributor** | Networking | Manage networking resources like VNets, NSGs, and load balancers |
| **Monitoring Reader** | Operations | Read monitoring data (metrics, logs, alerts) |
| **Log Analytics Contributor** | Operations | Manage Log Analytics workspaces and their data |
| **AcrPush** | Containers | Push images to Azure Container Registry |
| **AcrPull** | Containers | Pull images from Azure Container Registry |

### Management Plane vs. Data Plane

Azure distinguishes between management plane operations (creating, configuring, and deleting resources) and data plane operations (reading and writing the data within resources).

**Management plane** operations go through Azure Resource Manager. The Contributor role grants management plane access.

**Data plane** operations go directly to the resource. For example, reading a blob in a storage account or querying a SQL database are data plane operations.

This distinction matters because Contributor on a storage account does not grant the ability to read blob data. You need a data plane role like Storage Blob Data Reader for that. Conversely, Storage Blob Data Contributor does not grant the ability to delete the storage account itself.

**Common confusion:** A developer with Contributor on a resource group can create a storage account but cannot read the blobs inside it without an additional data plane role assignment. This is intentional separation of duties.

---

## Custom Roles

When built-in roles do not match your access requirements, you can create [custom roles](https://learn.microsoft.com/en-us/azure/role-based-access-control/custom-roles){:target="_blank" rel="noopener noreferrer"} with specific permissions.

### When to Create Custom Roles

- A built-in role grants more permissions than needed, and no narrower built-in role exists
- You need a combination of permissions that spans multiple built-in roles but does not match any single one
- You need to explicitly exclude specific actions that a built-in role includes

### Custom Role Structure

A custom role definition specifies:

- **Actions**: Management plane operations that are allowed (e.g., `Microsoft.Compute/virtualMachines/start/action`)
- **NotActions**: Management plane operations that are excluded from the allowed actions
- **DataActions**: Data plane operations that are allowed (e.g., `Microsoft.Storage/storageAccounts/blobServices/containers/blobs/read`)
- **NotDataActions**: Data plane operations that are excluded
- **AssignableScopes**: Where the custom role can be assigned (management groups, subscriptions, or resource groups)

### Custom Role Design Principles

**Start from a built-in role and narrow it.** Identify the closest built-in role and remove permissions using NotActions rather than building from scratch with Actions. This produces a smaller, more maintainable definition.

**Scope custom roles narrowly.** Assign the custom role only at the scopes where it is needed. A custom role scoped to a specific subscription cannot be used in other subscriptions unless the assignable scopes include them.

**Document custom roles.** Every custom role should have a clear description explaining why it exists and what built-in role it replaces or narrows. Without documentation, custom roles become opaque and difficult to audit.

### Custom Role Red Flags

- **Creating custom roles before checking built-in roles**: Azure has over 300 built-in roles. Most access requirements can be met without custom roles.
- **Overly broad custom roles**: A custom role with `*/read` and `*/write` is just Contributor with extra steps. Custom roles should be narrower than the built-in alternatives.
- **Custom roles with wildcard actions**: Using `Microsoft.Compute/*` grants all compute actions including ones you may not intend. Be explicit about which actions are needed.
- **Orphaned custom roles**: Custom roles that are no longer assigned to anyone but still exist create confusion during audits.

---

## Managed Identities

### What Problem Managed Identities Solve

Applications running on Azure resources frequently need to access other Azure services. A web app needs to read secrets from Key Vault, query a database, or write to a storage account. The traditional approach is to store credentials (connection strings, API keys, certificates) in configuration and use them to authenticate.

This approach has well-known problems: credentials can leak, they need to be rotated, they must be stored securely, and they create operational burden. Every credential is a potential attack vector.

[Managed Identities](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/overview){:target="_blank" rel="noopener noreferrer"} eliminate this problem entirely. Azure creates and manages an Entra ID identity for the resource, issues tokens automatically, and handles credential rotation behind the scenes. The application code requests a token from the local metadata endpoint, and Azure provides it without any credentials being stored or managed by the developer.

### How Managed Identities Work

```
1. Azure resource (VM, App Service, Function) has a Managed Identity enabled
2. Azure creates a service principal in Entra ID for that identity
3. Application code requests a token from the Azure Instance Metadata Service (IMDS)
4. Azure issues a token scoped to the target resource
5. Application uses the token to authenticate to the target service
6. No credentials are stored, managed, or rotated by the developer
```

The token request happens locally on the resource (via the metadata endpoint at `169.254.169.254` for VMs or an environment variable for App Service/Functions). No network call to Entra ID is needed from the application's perspective; Azure handles it transparently.

### System-Assigned vs. User-Assigned

Azure offers two types of Managed Identities:

| Aspect | System-Assigned | User-Assigned |
|--------|----------------|---------------|
| **Lifecycle** | Tied to the Azure resource. Created when enabled, deleted when the resource is deleted. | Independent. Created as a standalone Azure resource, can outlive individual resources. |
| **Sharing** | One identity per resource. Cannot be shared. | One identity can be assigned to multiple resources. |
| **Use case** | Single-resource scenarios where the identity lifecycle should match the resource. | Shared identity across multiple resources, or when you need the identity to persist through resource recreation. |
| **Management** | Simpler. Enable/disable on the resource. | More setup. Create the identity resource, then assign it to resources. |

### Which Type to Use

**System-assigned** is the default choice for most scenarios. It is simpler and its lifecycle is automatically managed. When you delete the resource, the identity is automatically cleaned up.

**User-assigned** is better when:
- Multiple resources need the same permissions (a fleet of VMs or a set of Function Apps that all access the same Key Vault)
- You need the identity to survive resource recreation (IaC pipelines that destroy and recreate resources would lose system-assigned identity RBAC assignments)
- You want to pre-configure RBAC before the consuming resource exists

### Services That Support Managed Identities

Most Azure compute and application services support Managed Identities:

- Virtual Machines and VM Scale Sets
- App Service and Azure Functions
- Azure Container Instances and Azure Container Apps
- Azure Kubernetes Service (via workload identity)
- Azure Logic Apps
- Azure Data Factory
- Azure API Management
- Azure Event Grid
- Azure Automation

### Managed Identity RBAC Patterns

After enabling a Managed Identity, you grant it access to target resources through standard RBAC role assignments:

**App Service accessing Key Vault:**
Assign the Key Vault Secrets User role to the App Service's Managed Identity at the Key Vault scope. The app reads secrets without any connection string or access key.

**Function App accessing Storage:**
Assign Storage Blob Data Contributor to the Function App's Managed Identity at the storage account scope. The function reads and writes blobs using token-based authentication.

**VM accessing SQL Database:**
Assign the SQL DB Contributor role or configure Entra ID authentication on the SQL Server with the VM's Managed Identity as an authorized user. The VM authenticates to SQL using a token instead of SQL credentials.

**Container App accessing Container Registry:**
Assign AcrPull to the Container App's Managed Identity at the ACR scope. The app pulls images without registry credentials.

### Managed Identity Red Flags

- **Using service principals with secrets when Managed Identities are available**: If the application runs on an Azure compute resource that supports Managed Identities, there is no reason to use a service principal with a client secret or certificate.
- **Granting Contributor or Owner to a Managed Identity**: Follow least privilege. A Managed Identity that reads Key Vault secrets needs Key Vault Secrets User, not Contributor on the Key Vault.
- **Not planning for identity in IaC**: If your Bicep or Terraform templates destroy and recreate resources, system-assigned identities are recreated with new object IDs. RBAC assignments targeting the old identity break silently. Use user-assigned identities for resources managed by IaC pipelines that perform full replacements.
- **Ignoring Managed Identity for cross-subscription access**: Managed Identities work across subscriptions within the same tenant. A Managed Identity in subscription A can be granted a role on a resource in subscription B.

---

## Service Principals and Federated Credentials

### When Managed Identities Are Not Enough

Managed Identities only work for code running on Azure compute resources. For scenarios where the calling code runs outside Azure, you need a service principal with credentials.

**Scenarios requiring service principals:**
- CI/CD pipelines running on GitHub Actions, Azure DevOps hosted agents, or Jenkins
- On-premises applications accessing Azure resources
- Third-party SaaS applications integrating with Azure
- Multi-cloud workloads running on AWS or GCP that need Azure access

### Workload Identity Federation

[Workload identity federation](https://learn.microsoft.com/en-us/entra/workload-id/workload-identity-federation){:target="_blank" rel="noopener noreferrer"} allows external workloads to authenticate to Entra ID without storing secrets. Instead of a client secret or certificate, the external workload presents a token from its own identity provider (GitHub, AWS, GCP, Kubernetes), and Entra ID trusts that token through a configured federation relationship.

**How it works:**
1. Create an app registration in Entra ID
2. Configure a federated credential that trusts tokens from the external identity provider (e.g., GitHub Actions OIDC)
3. The external workload requests a token from its identity provider
4. The workload exchanges that token for an Entra ID access token
5. The workload uses the Entra ID token to access Azure resources

**Common federation scenarios:**
- **GitHub Actions**: OIDC tokens from GitHub workflows authenticate to Azure without storing Azure credentials as GitHub secrets
- **AWS workloads**: AWS STS tokens can be exchanged for Entra ID tokens
- **Kubernetes clusters** (non-AKS): Kubernetes service account tokens can federate with Entra ID

Workload identity federation is the recommended approach for CI/CD pipelines because it eliminates long-lived secrets. A GitHub Actions workflow authenticates to Azure using a token that is valid only for the duration of the workflow run.

### Service Principal Credential Types

When federation is not possible, service principals authenticate with:

**Client secrets** are the simplest option but the least secure. Secrets are strings that must be stored securely, rotated regularly (Azure allows maximum 2-year expiry), and monitored for leaks.

**Certificates** are more secure than secrets. The private key stays with the calling application, and only the public key is registered in Entra ID. Certificate-based authentication is resistant to interception because the secret (private key) is never transmitted.

**Prefer certificates over secrets**, and prefer workload identity federation over both.

---

## Privileged Identity Management (PIM)

### What PIM Does

[Privileged Identity Management](https://learn.microsoft.com/en-us/entra/id-governance/privileged-identity-management/pim-configure){:target="_blank" rel="noopener noreferrer"} provides just-in-time (JIT) and time-limited access to privileged roles. Instead of permanently assigning powerful roles like Owner or Contributor, PIM makes users eligible for the role. When they need it, they activate the role for a limited duration (typically 1-8 hours), optionally with approval and justification requirements.

PIM requires Entra ID P2 licensing.

### Why PIM Matters

Standing privileged access, where Owner or Contributor roles are permanently assigned, is a security risk. If an account with permanent Owner access is compromised, the attacker has immediate, unrestricted access. With PIM, the same compromise yields no privileged access until the attacker can also pass the activation requirements (MFA, approval, justification).

### PIM for Azure Resources

PIM can manage eligibility for Azure RBAC roles at any scope (management group, subscription, resource group, or resource). Common patterns:

- **Subscription Owner**: Eligible, requires MFA + justification, 4-hour maximum activation, approval from security team
- **Resource Group Contributor**: Eligible, requires MFA, 8-hour maximum activation, no approval required
- **Key Vault Administrator**: Eligible, requires MFA + justification + approval, 2-hour maximum activation

### PIM for Entra ID Roles

PIM also manages Entra ID directory roles like Global Administrator, User Administrator, and Application Administrator. The same JIT and approval patterns apply:

- **Global Administrator**: Eligible, requires MFA + justification + approval, 1-hour maximum activation
- **User Administrator**: Eligible, requires MFA, 4-hour maximum activation

### PIM Design Principles

**No permanent Owner or Global Administrator assignments.** These should always be eligible-only through PIM, with activation requiring MFA and justification at minimum.

**Match activation duration to the task.** An infrastructure change might need 4 hours; a quick investigation might need 1 hour. Shorter activations reduce the window of elevated access.

**Require justification for sensitive roles.** Justification creates an audit trail of why privileges were elevated, which is valuable for compliance and incident investigation.

**Review eligible assignments regularly.** Use PIM access reviews to periodically verify that users still need eligibility for privileged roles.

---

## RBAC Design Patterns

### Pattern 1: Group-Based Role Assignments

Assign RBAC roles to Entra ID groups rather than individual users. When a user joins or leaves a team, you add or remove them from the group instead of modifying role assignments on Azure resources.

```
Entra ID Group: "sg-webapp-developers"
  └── Role Assignment: Contributor on rg-webapp-dev
  └── Role Assignment: Reader on rg-webapp-prod
  └── Role Assignment: Key Vault Secrets User on kv-webapp-prod
```

Group-based assignments scale better, are easier to audit, and align with how organizations manage team membership.

### Pattern 2: Scope-Based Least Privilege

Assign roles at the narrowest scope that meets the need. A developer who manages an App Service does not need Contributor on the entire subscription. Assign Contributor on the resource group containing the App Service.

| Need | Scope | Role |
|------|-------|------|
| Deploy web app | Resource group containing the app | Contributor |
| Read production logs | Log Analytics workspace | Monitoring Reader |
| Access Key Vault secrets | Specific Key Vault | Key Vault Secrets User |
| View all subscription resources | Subscription | Reader |

### Pattern 3: Break-Glass Access

Maintain emergency access accounts with permanent Owner on the subscription and Global Administrator in Entra ID, excluded from all Conditional Access policies. These accounts are used only when normal access paths fail due to issues like PIM outages, Conditional Access misconfigurations, or MFA provider failures.

Break-glass accounts should have strong, unique passwords stored in a physical safe or secure offline location. Their sign-in activity should be monitored with alerts that trigger on any use.

---

## Key Takeaways

- Azure RBAC combines three elements: a security principal (who), a role definition (what), and a scope (where). Role assignments inherit downward through the management group, subscription, resource group, and resource hierarchy.
- Use built-in roles whenever possible (Azure has over 300). Create custom roles only when no built-in role matches and you need a narrower permission set.
- Management plane and data plane are separate. Contributor on a storage account does not grant the ability to read blobs; you need a data plane role like Storage Blob Data Reader.
- Managed Identities eliminate credentials for Azure-hosted workloads. System-assigned identities are simpler; user-assigned identities are better for shared access and IaC scenarios where resources are recreated.
- For workloads outside Azure (CI/CD pipelines, on-premises, multi-cloud), use workload identity federation to avoid storing secrets. Use certificates over client secrets when federation is not available.
- Privileged Identity Management provides just-in-time access for sensitive roles. No identity should have permanent Owner or Global Administrator; use eligible assignments with activation requirements instead.
- Assign roles to groups, not individuals. Scope assignments as narrowly as possible. Maintain break-glass accounts excluded from Conditional Access.
