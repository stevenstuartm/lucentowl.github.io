---
title: "Identity and Access Management"
layout: guide
category: Security
subcategory: Security Fundamentals
description: "How systems establish who someone is and what they may do: authentication factors and assurance levels, phishing-resistant MFA and passkeys, federation and single sign-on with SAML, OAuth 2.0, and OpenID Connect, authorization models (RBAC, ABAC, ReBAC), the joiner-mover-leaver lifecycle and access reviews, privileged access, and workload identities and secrets."
tags: [fundamentals, iam, mfa, passkeys, oauth, openid-connect, rbac]
---

## Identity Is the Perimeter

Most modern systems have no single network edge to defend. Users work from home networks, applications call SaaS APIs, and workloads run in cloud accounts reachable from anywhere. What remains constant is that every request is made by some identity, human or machine, and every decision about whether to allow it is an identity decision. That is why stolen credentials are the most common way attackers get in, and why identity and access management (IAM) carries more of an organization's security than any other single control.

IAM answers three questions, in order:

1. **Authentication**: is this really the identity it claims to be?
2. **Authorization**: is this identity allowed to do this action on this resource?
3. **Lifecycle**: does this identity still exist, and does it still need what it has?

Each question fails differently. Weak authentication lets an attacker become someone else. Weak authorization lets a legitimate user do too much. Weak lifecycle management leaves former employees, old service accounts, and forgotten permissions available for an attacker to find.

---

## Authentication

### Factors and What They Resist

Authentication factors are traditionally grouped as something you know (a password), something you have (a phone, a security key), and something you are (a fingerprint). Combining factors from different groups is multi-factor authentication (MFA). The categories matter less than a more practical question: which attacks does each method resist?

| Method | Resists password reuse and stuffing | Resists real-time phishing | Main weakness |
|---|---|---|---|
| Password alone | No | No | Reuse, guessing, phishing |
| SMS or voice code | Yes | No | SIM swapping, interception, relayed by phishing pages |
| Authenticator app code (TOTP) | Yes | No | Relayed by phishing pages |
| Push approval | Yes | No | MFA fatigue, relayed by phishing pages |
| Push with number matching | Yes | No | Stops MFA fatigue, but still relayed by phishing pages |
| Passkey or FIDO2 security key | Yes | Yes | Account recovery becomes the weak point |

The dividing line is **phishing resistance**. Codes and push approvals prove possession of a device, but a user can be tricked into entering or approving them on an attacker's proxy page, which relays them to the real site while the user waits. **FIDO2/WebAuthn** authenticators, including **passkeys**, perform a signature that is bound to the website's origin. The authenticator will not produce a valid response for a lookalike domain, so there is nothing for the user to be tricked into handing over.

Passkeys come in two forms. **Synced passkeys** are backed up and shared across a user's devices through a platform account (such as an Apple, Google, or Microsoft account), which makes them convenient and removes most lockout problems. **Device-bound passkeys**, such as those on a hardware security key, cannot be copied. Both are phishing-resistant. They differ in who else could obtain the key. A synced passkey is only as secure as the platform account that syncs it.

### Assurance Levels

[NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html){:target="_blank" rel="noopener noreferrer"} defines three **authenticator assurance levels (AALs)**, which are a useful vocabulary for matching strength to risk even outside US government systems:

- **AAL1** allows single-factor authentication, such as a password.
- **AAL2** requires two distinct factors, and verifiers must offer at least one phishing-resistant option.
- **AAL3** requires a phishing-resistant cryptographic authenticator with a non-exportable private key. Synced passkeys do not qualify, because their keys can be copied.

The same document restricts SMS and voice codes, since the phone network is vulnerable to SIM swapping and number porting, and prohibits email as an out-of-band authenticator. It also sets reauthentication limits: at AAL2 the overall session should last no more than 24 hours with an inactivity timeout of no more than one hour, and at AAL3 no more than 12 hours overall with 15 minutes of inactivity.

### Passwords, Where They Remain

Passwords persist as a fallback and in systems that cannot yet use anything better. Current NIST guidance reverses much of the older conventional wisdom. It calls for length over complexity (at least 15 characters when the password is the only factor), screening new passwords against lists of breached and common passwords, no composition rules, and no forced periodic changes. Rotation is forced only when there is evidence of compromise. Stored passwords are protected with a slow, salted password hashing algorithm, never a fast hash.

### Account Recovery

Every authentication system is only as strong as its recovery path. An account protected by a hardware security key but recoverable by answering security questions, or by calling a help desk that resets MFA for anyone who knows an employee's manager's name, has the strength of the recovery path. Attackers know this and target help desks directly. Recovery should require evidence comparable to the original authentication: a second registered authenticator, identity proofing, or in-person verification for high-value accounts.

---

## Federation and Single Sign-On

Without federation, every application keeps its own user database, its own password policy, and its own list of who should be removed when someone leaves. **Federation** separates the **identity provider (IdP)**, which authenticates users, from the applications, called **relying parties** or **service providers**, which trust the IdP's assertion about who the user is. **Single sign-on (SSO)** is the user-visible result: one authentication at the IdP grants access to many applications.

Federation concentrates authentication in one place, where MFA, conditional access, and logging can be enforced once, and where disabling an account removes access everywhere. The cost is concentration of risk. A compromised IdP, or an IdP administrator account, compromises every application that trusts it, so IdP administration deserves the strongest protections the organization has.

### The Protocols

Three protocols dominate, and they are often confused because they appear together.

| Protocol | What it does | Token | Typical use |
|---|---|---|---|
| **SAML 2.0** | Authentication and SSO | Signed XML assertion | Enterprise web SSO into SaaS applications |
| **OAuth 2.0** | Delegated authorization: lets a client call an API on a user's behalf | Access token (often a JWT) | API access, third-party integrations |
| **OpenID Connect (OIDC)** | Authentication built on top of OAuth 2.0 | ID token (a JWT) plus OAuth tokens | Modern web and mobile sign-in, SSO |

The most common misunderstanding is using OAuth 2.0 alone for sign-in. An OAuth access token tells an API that the bearer may perform certain actions. It is not designed to tell the client who the user is, and treating it that way has produced real account takeover vulnerabilities. OIDC adds the **ID token**, which is issued to the client, names the user, and is signed by the IdP.

### The Authorization Code Flow

For web, mobile, and single-page applications, the recommended flow is the **authorization code flow with PKCE** (Proof Key for Code Exchange). The browser is redirected to the IdP to authenticate, returns with a short-lived one-time code, and the application exchanges that code directly with the IdP for tokens. PKCE binds the code to the client that started the flow, so an intercepted code is useless to anyone else.

{% include figure.html id="sec-oidc-auth-code-pkce" %}

[RFC 9700](https://www.rfc-editor.org/info/rfc9700/){:target="_blank" rel="noopener noreferrer"}, the OAuth 2.0 Security Best Current Practice published in January 2025, recommends PKCE for authorization code flows, exact matching of redirect URIs, and sender-constrained tokens where possible. It deprecates the **implicit grant**, which returned tokens directly in the browser's URL, and the **resource owner password credentials grant**, which had the application collect the user's password itself.

### Token Handling

- **Access tokens should be short-lived** (minutes to about an hour), because a bearer token works for whoever holds it. **Refresh tokens** obtain new access tokens without the user signing in again. They are long-lived, so they are stored carefully and rotated on each use so a stolen one is detected when both the attacker and the user try to use it.
- **Validate every token fully**: signature, issuer, audience, expiry, and the algorithm, which should come from configuration rather than from the token's own header.
- **Sender-constrained tokens** (DPoP or mTLS-bound tokens) tie a token to a key the client holds, so a stolen token cannot be replayed from elsewhere.

---

## Authorization

Authentication establishes who. Authorization decides what they may do, and it is where most access control vulnerabilities in applications live. Several models exist, and real systems usually combine them.

### Role-Based Access Control

**RBAC** assigns permissions to roles and roles to users. A user in the `invoice-approver` role can approve invoices. RBAC is easy to reason about and audit, since reviewing who holds a role reviews everything that role grants.

Its weakness is expressing conditions. "Approvers can approve invoices under $10,000 for their own department" does not fit a role cleanly, and the usual workaround, creating a role per department per limit, leads to **role explosion**, where the number of roles approaches the number of users and nobody can say what any of them means.

### Attribute-Based Access Control

**ABAC** evaluates policies over attributes of the subject (department, clearance, employment type), the resource (owner, classification, region), the action, and the environment (time, device health, network location). The invoice rule above becomes a single policy. ABAC is expressive and adapts automatically as attributes change, at the cost of being harder to audit. Answering "who can access this record?" requires evaluating the policy against every user, rather than reading a list.

### Relationship-Based Access Control

**ReBAC** grants access based on relationships between objects: a user can edit a document because they are a member of a team that owns the folder that contains it. This is the natural model for collaboration products with sharing, nested folders, and organizations. Google's Zanzibar paper popularized it, and several open source and commercial authorization services implement the model.

### Mandatory Access Control

In **MAC**, a central authority assigns security labels, and the system enforces rules that users cannot override, even for data they own. Military classification systems and SELinux are the familiar examples. MAC is rare in business applications but common at the operating system level.

### Where Authorization Is Enforced

The model matters less than enforcement. Authorization has to be checked on the server, for every request, against the specific resource being accessed, not just the type of action. Checking that a user may view invoices, without checking that this invoice belongs to their organization, is the single most common access control flaw in web applications. Centralizing decisions in a policy engine or a shared authorization layer, rather than scattering `if` statements through controllers, keeps enforcement consistent and auditable.

---

## Identity Lifecycle

Access that was correct when granted drifts. People change teams and keep their old permissions. Contractors finish and their accounts remain. Permissions granted for one urgent task are never removed. The lifecycle process keeps access matched to current need.

### Joiner, Mover, Leaver

- **Joiners** receive access based on their role, ideally provisioned automatically from the HR system of record rather than requested piece by piece.
- **Movers** receive their new role's access and, critically, lose their old role's access. Organizations that only add access on moves accumulate privilege over time.
- **Leavers** lose all access promptly, across every system. Federation makes this tractable, since disabling the IdP account ends SSO access. Applications with local accounts, API keys the person created, and shared credentials they knew still need handling.

Standards such as **SCIM** automate provisioning and deprovisioning between an IdP and applications, so an account disabled in the IdP is disabled in each connected application too, rather than just losing the ability to sign in.

### Access Reviews

Periodic reviews ask the people who understand the work, usually managers or resource owners, to confirm that each person's access is still needed. Reviews are often run as a compliance exercise, and a reviewer faced with hundreds of entitlements tends to approve them all. Reviews work better when they focus on high-risk access, show what each entitlement actually allows, and flag access that has not been used in months, which is the strongest signal that it is not needed.

---

## Privileged Access

Administrator accounts, production database access, and cloud root credentials are what attackers seek once they are inside. Privileged access management (PAM) applies least privilege and separation of privilege to them.

- **Separate privileged accounts** from everyday accounts, so reading email and browsing the web never happen with administrator rights.
- **Just-in-time (JIT) elevation** grants privileged roles on request, for a bounded time, often with approval, and removes them automatically. Standing privilege exposed around the clock becomes privilege exposed for an hour during a change.
- **Session recording and logging** for privileged sessions provide the audit trail and the deterrent.
- **Break-glass accounts** give emergency access when the normal path (the IdP, the PAM system, MFA infrastructure) is itself down. They are few, protected with strong offline credentials, monitored for any use, and tested periodically so they work when needed.

---

## Workload Identities and Secrets

Machines authenticate too, and non-human identities usually outnumber human ones. Services call databases, CI pipelines deploy to cloud accounts, and scheduled jobs call APIs. Each needs an identity and a way to prove it.

The traditional answer, a long-lived secret such as an API key, password, or cloud access key, is the source of a steady stream of breaches. Secrets get committed to source control, copied into CI variables, pasted into chat, and left valid for years because nobody knows what would break if they were rotated.

The better pattern is to avoid long-lived secrets entirely:

- **Platform-managed identities.** Cloud platforms assign an identity to a virtual machine, container, or function, and issue it short-lived credentials automatically. Examples are managed identities in Azure, IAM roles for AWS workloads, and service accounts in Google Cloud. There is no secret for anyone to copy.
- **Workload identity federation.** An external workload, such as a CI pipeline, presents a signed OIDC token from its own platform, and the cloud provider exchanges it for short-lived credentials if the token matches a configured trust policy (this repository, this branch, this environment). The pipeline stores no cloud credential at all.
- **Service mesh and mTLS identities.** Frameworks such as SPIFFE issue each workload a short-lived certificate identifying it, which services use to authenticate each other.

Where secrets are unavoidable, they live in a secrets manager rather than in code or configuration files, are retrieved at runtime by an authorized identity, are scoped to the minimum permissions, and are rotated on a schedule that has been exercised. Secret scanning in source control and CI catches the ones that leak anyway.

---

## Common Pitfalls

- **MFA that can be phished, treated as finished.** SMS, codes, and push approvals stop credential stuffing but not adversary-in-the-middle phishing. Move high-risk users and administrators to phishing-resistant methods first.
- **Weak recovery undoing strong authentication.** Recovery and help desk resets need to be as strong as the authenticator they replace.
- **OAuth used as authentication.** Use OIDC and validate the ID token.
- **Authorization by action, not by object.** Checking the role without checking ownership of the specific record.
- **Access that only grows.** Movers keep old permissions and reviews rubber-stamp. Remove access on role change and review unused entitlements.
- **Long-lived machine secrets.** Prefer platform identities and federation, and treat every remaining static secret as a liability with an owner and a rotation date.
- **An unprotected identity provider.** Every application's security depends on the IdP and its administrators.
