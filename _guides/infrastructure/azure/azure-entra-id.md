---
title: "Azure Entra ID (Azure AD) for System Architects"
layout: guide
category: Azure
subcategory: Identity & Access Management
description: "How Microsoft Entra ID works as the identity platform for Azure, covering tenant architecture, authentication protocols, Conditional Access, B2B/B2C identity, app registrations, and integration with on-premises Active Directory."
tags: [infrastructure, azure, security, access-control, architecture, fundamentals]
---

## What Is Microsoft Entra ID

[Microsoft Entra ID](https://learn.microsoft.com/en-us/entra/fundamentals/whatis){:target="_blank" rel="noopener noreferrer"} (formerly Azure Active Directory) is Microsoft's cloud-based identity and access management platform. It is the identity backbone for Azure, Microsoft 365, and thousands of third-party SaaS applications. Every authentication to an Azure resource, every RBAC role assignment, and every Conditional Access decision flows through Entra ID.

### Entra ID vs. On-Premises Active Directory

The name causes confusion. Entra ID (Azure AD) and Windows Server Active Directory (AD DS) share a lineage but are different platforms solving different problems.

| Aspect | On-Premises AD DS | Entra ID |
|--------|-------------------|----------|
| **Primary purpose** | Domain-joined device and server authentication | Cloud application and service authentication |
| **Protocols** | Kerberos, NTLM, LDAP | OAuth 2.0, OpenID Connect, SAML |
| **Structure** | Forests, domains, OUs, GPOs | Flat tenant with users, groups, app registrations |
| **Device management** | Group Policy | Intune, Conditional Access |
| **Network model** | On-premises network boundary | Internet-accessible, Zero Trust |
| **Query language** | LDAP | Microsoft Graph API |

Most enterprises use both. Entra ID Connect synchronizes identities from on-premises AD to Entra ID, giving users a single identity that works across domain-joined servers and cloud applications. But Entra ID is not a replacement for AD DS if you still have domain-joined infrastructure; it is a companion.

### What Problems Entra ID Solves

**Without a centralized identity platform:**
- Every application manages its own user store, passwords, and access control
- Users juggle multiple credentials across applications
- No consistent MFA, no conditional access, no centralized audit trail
- Workloads use shared secrets or connection strings to authenticate to each other
- Offboarding a user requires disabling access in every application individually

**With Entra ID:**
- Single identity for Azure resources, Microsoft 365, and integrated SaaS applications
- Centralized MFA and Conditional Access policies that apply across all applications
- Managed Identities eliminate credentials for workload-to-workload authentication
- Disabling a user in Entra ID revokes access everywhere simultaneously
- Complete audit trail of sign-ins, token issuance, and administrative actions

---

## Core Concepts

### Tenants

An Entra ID tenant is a dedicated instance of the identity service, created automatically when an organization signs up for Azure or Microsoft 365. The tenant is the security and identity boundary. Users, groups, app registrations, and policies all exist within a tenant.

Most organizations have one tenant. Multi-tenant scenarios (covered in the [Subscription & Tenant Architecture](/study-guides/infrastructure/azure/azure-subscription-architecture.html) guide) are rare and reserved for regulatory isolation or acquisition scenarios.

### Users

Entra ID supports several user types:

**Cloud-only users** exist only in Entra ID. They are created directly in the tenant and have no on-premises counterpart. Suitable for organizations that are fully cloud-native or for user populations that do not need on-premises access.

**Synced users** originate in on-premises Active Directory and are synchronized to Entra ID through [Entra ID Connect](https://learn.microsoft.com/en-us/entra/identity/hybrid/connect/whatis-azure-ad-connect){:target="_blank" rel="noopener noreferrer"} (or the newer Entra Cloud Sync). Changes to these users are made on-premises and replicate to the cloud. This is the most common model for enterprises with existing AD infrastructure.

**Guest users** are external identities invited into the tenant through B2B collaboration. They authenticate with their home organization's identity provider and are granted limited access to resources in the inviting tenant.

### Groups

Groups in Entra ID control access and simplify management:

**Security groups** are used for RBAC role assignments, application access, and Conditional Access policy targeting. A security group can contain users, other groups, service principals, and Managed Identities.

**Microsoft 365 groups** provide collaboration features (shared mailbox, SharePoint site, Teams channel) in addition to access control. They are not typically used for Azure resource RBAC.

**Dynamic groups** automatically maintain membership based on user or device attributes. A dynamic group rule like `user.department -eq "Engineering"` automatically adds and removes users as their department attribute changes. Dynamic groups eliminate manual group maintenance but require Entra ID P1 or P2 licensing.

### App Registrations and Service Principals

When an application needs to authenticate with Entra ID (whether to sign in users or to access Azure resources), it needs an [app registration](https://learn.microsoft.com/en-us/entra/identity-platform/app-objects-and-service-principals){:target="_blank" rel="noopener noreferrer"}.

**App registration** is the application's identity definition in the tenant. It specifies the application's name, redirect URIs, API permissions, and credential configuration. Think of it as the application's identity card.

**Service principal** is the local instance of that app registration within a specific tenant. When a multi-tenant application is registered in Tenant A and consented to in Tenant B, Tenant B gets its own service principal representing that application. The service principal is what RBAC role assignments target.

**The distinction matters because:**
- App registrations are global definitions; service principals are tenant-local instances
- RBAC roles are assigned to service principals, not app registrations
- Deleting a service principal revokes access in that tenant without affecting the app registration or other tenants
- Managed Identities (covered in the [RBAC & Managed Identities](/study-guides/infrastructure/azure/azure-rbac-managed-identities.html) guide) are a special type of service principal that Azure manages automatically

---

## Authentication Protocols

Entra ID supports modern authentication protocols for different scenarios. Understanding which protocol to use is an architectural decision that affects security, user experience, and integration complexity.

### OAuth 2.0 and OpenID Connect

[OAuth 2.0](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols){:target="_blank" rel="noopener noreferrer"} is the authorization protocol. It issues access tokens that grant applications permission to call APIs on behalf of a user or as their own identity. OpenID Connect (OIDC) extends OAuth 2.0 with an identity layer, issuing ID tokens that prove who the user is.

**Use OAuth 2.0 / OIDC for:**
- Web applications signing in users
- Single-page applications (SPAs)
- Mobile applications
- API-to-API calls
- Any new application being built today

**Common flows:**

| Flow | Scenario |
|------|----------|
| **Authorization Code + PKCE** | Web apps, SPAs, mobile apps. The recommended flow for interactive sign-in. |
| **Client Credentials** | Service-to-service calls where no user is involved. The application authenticates as itself using a secret or certificate. |
| **On-Behalf-Of** | A middle-tier API needs to call a downstream API on behalf of the signed-in user. Preserves user context through the call chain. |
| **Device Code** | CLI tools and devices without a browser. The user authenticates on a separate device. |

### SAML 2.0

SAML is an older protocol still widely used for enterprise SSO with legacy and SaaS applications. Entra ID can act as a SAML Identity Provider, issuing SAML assertions to applications that do not support OIDC.

**Use SAML for:**
- Legacy enterprise applications that only support SAML
- SaaS applications that offer SAML SSO but not OIDC
- Migrating from on-premises ADFS to Entra ID (ADFS uses SAML heavily)

**Prefer OIDC over SAML for new applications.** OIDC is simpler, produces smaller tokens, and has better support in modern frameworks and libraries.

### WS-Federation

WS-Federation is a legacy protocol supported by Entra ID for backward compatibility with older .NET applications and ADFS integrations. New applications should not use WS-Federation.

---

## Conditional Access

### What Conditional Access Does

[Conditional Access](https://learn.microsoft.com/en-us/entra/identity/conditional-access/overview){:target="_blank" rel="noopener noreferrer"} is Entra ID's policy engine for making real-time access decisions. Instead of a binary "authenticated or not," Conditional Access evaluates signals like user identity, device state, location, application, and risk level to determine whether to allow access, require additional verification, or block access entirely.

Conditional Access is the primary mechanism for implementing Zero Trust in Azure environments.

### How Policies Work

Each Conditional Access policy has three components:

**Assignments** define who and what the policy applies to:
- Users and groups (or all users, or excluding specific groups)
- Target applications (specific apps, all cloud apps, or management actions)
- Conditions like sign-in risk level, device platform, location, or client application type

**Access controls** define what happens when the conditions match:
- **Grant**: Allow access with requirements like MFA, compliant device, hybrid-joined device, or approved client app
- **Block**: Deny access entirely
- **Session controls**: Limit what users can do within the session (app-enforced restrictions, sign-in frequency, persistent browser sessions)

### Common Conditional Access Patterns

**Require MFA for all users:**
Assignments: All users, all cloud apps. Grant: Require multifactor authentication. This is the baseline policy every organization should implement.

**Block access from untrusted locations:**
Assignments: All users, all cloud apps, condition: any location except named trusted locations. Grant: Block. Prevents sign-ins from unexpected geographies.

**Require compliant device for sensitive apps:**
Assignments: All users, sensitive applications (HR systems, finance apps). Grant: Require device to be marked as compliant in Intune. Ensures only managed, policy-compliant devices access sensitive data.

**Require MFA for Azure management:**
Assignments: All users, target app: Microsoft Azure Management. Grant: Require MFA. Protects the Azure portal, CLI, and API from compromised credentials.

**Risk-based policies:**
Assignments: All users, condition: sign-in risk level is medium or high. Grant: Require MFA or block. Uses [Entra ID Protection](https://learn.microsoft.com/en-us/entra/id-protection/overview-identity-protection){:target="_blank" rel="noopener noreferrer"} machine learning to detect suspicious sign-in patterns like impossible travel, anonymous IP addresses, or password spray attacks.

### Conditional Access Design Principles

**Start with a baseline and layer policies.** Begin with a few foundational policies (require MFA for all, block legacy authentication, protect Azure management) and add more specific policies as needs emerge.

**Use report-only mode first.** Every new policy should run in report-only mode before enforcement. Report-only mode logs what the policy would do without actually blocking or requiring anything, letting you validate the policy's impact.

**Exclude emergency access accounts.** Break-glass accounts must be excluded from all Conditional Access policies to ensure access is never completely locked out. These accounts should have strong, unique passwords stored securely offline.

**Plan for the user experience.** Overly aggressive policies create friction that drives shadow IT. Balance security with usability, and communicate changes to users before enforcement.

---

## B2B and B2C Identity

### B2B Collaboration

[Entra ID B2B](https://learn.microsoft.com/en-us/entra/external-id/what-is-b2b){:target="_blank" rel="noopener noreferrer"} allows you to invite external users (partners, contractors, vendors) into your tenant as guest users. Guest users authenticate with their home organization's identity provider and access resources in your tenant based on RBAC assignments.

**How B2B works:**
1. You invite an external user by email
2. The user accepts the invitation and authenticates with their own identity provider (their company's Entra ID, Google, Microsoft account, or email one-time passcode)
3. A guest user object is created in your tenant
4. You assign RBAC roles or group memberships to the guest user
5. The guest accesses resources using their home credentials, subject to your Conditional Access policies

**B2B design considerations:**
- Guest users are subject to your Conditional Access policies, so you can require MFA even if their home organization does not
- Guest user access is limited to what you explicitly grant through RBAC. By default, guest users have restricted directory permissions
- Cross-tenant access settings let you control which organizations can collaborate with your tenant and what level of trust you extend to their MFA and device compliance claims

### B2C (Customer Identity)

[Entra External ID](https://learn.microsoft.com/en-us/entra/external-id/customers/overview-customers-ciam){:target="_blank" rel="noopener noreferrer"} (formerly Azure AD B2C) provides customer-facing identity management. While B2B is for inviting known external partners, B2C is for consumer-scale self-service sign-up, sign-in, and profile management.

**B2C is a separate tenant** from your organization's Entra ID tenant. It has its own user store, authentication flows, and branding customization. B2C users (your customers) never appear in your organizational directory.

**Use B2C when:**
- You are building a customer-facing application that needs sign-up/sign-in
- You want to support social identity providers like Google, Facebook, Apple, or any OIDC provider
- You need custom branding on the sign-in experience
- You need consumer-scale identity (millions of users)

**B2C vs. B2B:**

| Aspect | B2B | B2C |
|--------|-----|-----|
| **Target users** | Partners, contractors, vendors | Consumers, customers |
| **User store** | Guest objects in your tenant | Separate B2C tenant |
| **Scale** | Thousands | Millions |
| **Identity providers** | Work accounts, Microsoft accounts | Social, local accounts, OIDC/SAML |
| **Branding** | Your tenant's sign-in page | Fully customizable |
| **Self-service signup** | By invitation | Yes |

---

## Hybrid Identity: Connecting On-Premises AD

### Why Hybrid Identity Exists

Most enterprises did not start in the cloud. They have years of user accounts, group memberships, and access policies in on-premises Active Directory. Hybrid identity synchronizes these identities to Entra ID so users have a single set of credentials that works both on-premises and in the cloud.

### Entra ID Connect

[Entra ID Connect](https://learn.microsoft.com/en-us/entra/identity/hybrid/connect/whatis-azure-ad-connect){:target="_blank" rel="noopener noreferrer"} (formerly Azure AD Connect) is a synchronization tool installed on-premises that replicates users, groups, and contacts from AD DS to Entra ID. It runs on a schedule (default: every 30 minutes) and supports filtering so you can synchronize only specific OUs or groups.

**Authentication methods with Entra ID Connect:**

| Method | How It Works | Best For |
|--------|-------------|----------|
| **Password Hash Sync (PHS)** | Hashes of on-premises passwords sync to Entra ID. Authentication happens entirely in the cloud. | Simplest option. Recommended as the baseline. Works even if on-premises AD is unavailable. |
| **Pass-through Authentication (PTA)** | Cloud authentication requests are forwarded to on-premises agents that validate against AD. No password hashes in the cloud. | Organizations with security policies that prohibit password hashes in the cloud. |
| **Federation (ADFS)** | Entra ID delegates authentication to an on-premises ADFS server. Full control over the authentication experience. | Complex requirements like smartcard authentication, third-party MFA, or specific compliance mandates. |

**Recommended approach:** Start with Password Hash Sync. It is the simplest, most resilient option (cloud auth works even if on-premises AD goes down), and it enables Entra ID Protection's leaked credential detection. Add PTA or federation only if specific security or compliance requirements demand it.

### Entra Cloud Sync

[Entra Cloud Sync](https://learn.microsoft.com/en-us/entra/identity/hybrid/cloud-sync/what-is-cloud-sync){:target="_blank" rel="noopener noreferrer"} is the newer, lighter alternative to Entra ID Connect. It uses cloud-provisioning agents instead of a heavyweight on-premises sync server. Cloud Sync supports multi-forest environments and is easier to deploy, but it does not yet support all scenarios that Entra ID Connect handles (like device writeback or group writeback).

For new deployments, evaluate Cloud Sync first and fall back to Entra ID Connect if you need features Cloud Sync does not yet support.

---

## Entra ID Licensing

Entra ID features are gated by license tier. Understanding the licensing boundaries is important for architecture decisions because some features require premium licenses.

| Feature | Free | P1 | P2 |
|---------|------|-----|-----|
| User and group management | Yes | Yes | Yes |
| SSO for SaaS apps | Yes (limited) | Yes | Yes |
| MFA | Yes (security defaults) | Yes (Conditional Access) | Yes |
| Conditional Access | No | Yes | Yes |
| Dynamic groups | No | Yes | Yes |
| Self-service password reset | No | Yes | Yes |
| Entra ID Protection (risk-based policies) | No | No | Yes |
| Privileged Identity Management (PIM) | No | No | Yes |
| Access reviews | No | No | Yes |

**P1** is required for Conditional Access, which is the foundation of Zero Trust. Most production Azure environments need at least P1 for users who interact with Azure resources or protected applications.

**P2** adds risk-based access policies (automatic detection and response to suspicious sign-ins) and Privileged Identity Management (just-in-time elevation of privileged roles). P2 is typically assigned to administrators and users with access to sensitive resources rather than all users.

---

## Architectural Decisions

### Identity as the Control Plane

In a Zero Trust architecture, identity is the primary security boundary, replacing the traditional network perimeter. Entra ID is the control plane that makes every access decision. This has architectural implications:

- **Every Azure resource interaction authenticates through Entra ID.** RBAC role assignments, Managed Identity tokens, and Conditional Access policies all depend on Entra ID being available and correctly configured.
- **Application architecture includes authentication flows.** Architects must decide which OAuth 2.0 flow each component uses, whether applications use delegated permissions (on behalf of a user) or application permissions (as themselves), and how tokens are validated.
- **Tenant design is an early, high-impact decision.** Changing tenants later is disruptive. The tenant choice affects every subsequent identity decision.

### Questions to Ask During Architecture Design

- How will workforce users authenticate? (Cloud-only, synced with PHS, PTA, or federation?)
- What Conditional Access baseline policies should apply? (MFA everywhere, block legacy auth, protect Azure management?)
- Will external users need access? (B2B for partners, B2C for customers?)
- How will workloads authenticate to other services? (Managed Identities, service principals with certificates, or federated workload identity?)
- What Entra ID license tier is required for the security posture you need?
- Are there compliance requirements around where authentication data is processed or stored?

---

## Key Takeaways

- Entra ID is a cloud-native identity platform, not a cloud version of Active Directory. It uses OAuth 2.0, OIDC, and SAML instead of Kerberos and LDAP, and serves as the identity backbone for Azure, Microsoft 365, and integrated applications.
- App registrations define an application's identity, while service principals are tenant-local instances of that identity. RBAC targets service principals, and Managed Identities are a special type of service principal managed by Azure.
- Conditional Access is the Zero Trust policy engine. Start with baseline policies (require MFA, block legacy auth, protect Azure management), use report-only mode to validate, and always exclude emergency access accounts.
- B2B invites external partners as guest users who authenticate with their home identity. B2C provides consumer-scale identity in a separate tenant for customer-facing applications.
- Hybrid identity connects on-premises AD to Entra ID through Entra ID Connect or Cloud Sync. Password Hash Sync is the simplest and most resilient authentication method; use PTA or federation only when specific requirements demand it.
- Entra ID P1 licensing is the practical minimum for production environments because Conditional Access requires it. P2 adds risk-based policies and Privileged Identity Management for administrative roles.
