---
title: "Security Foundations"
layout: guide
category: Security
subcategory: Security Fundamentals
description: "The goals security protects (confidentiality, integrity, availability, and accountability) and the design principles that guide every control decision: least privilege, fail-safe defaults, complete mediation, economy of mechanism, open design, separation of privilege, least common mechanism, psychological acceptability, work factor, and defense in depth."
tags: [fundamentals, cia-triad, least-privilege, defense-in-depth, saltzer-schroeder, fail-safe-defaults]
---

## What Security Protects

Security work starts from a question about loss. What could go wrong with this data or this system, and who would be hurt? The classic answer groups the losses into three properties, known together as the **CIA triad**. Every control a team adds protects one or more of them, and naming which one keeps a team from buying a control that protects the wrong thing.

| Property | The loss it prevents | Typical controls |
|---|---|---|
| **Confidentiality** | Someone reads data they should not | Encryption, access control, data classification |
| **Integrity** | Data or behavior changes without authorization, or without anyone noticing | Hashes and signatures, access control on writes, input validation, audit trails |
| **Availability** | Authorized users cannot use the system when they need it | Redundancy, capacity headroom, DDoS mitigation, tested backups |

The three properties pull against each other. Encrypting everything and requiring re-authentication on every action raises confidentiality and integrity while making the system slower and easier to lock people out of. A hospital record system that is perfectly confidential but unreachable during an emergency has failed its users. Deciding which property dominates for a given asset is the first real design decision, and it is a business decision as much as a technical one.

### Accountability

A fourth goal sits beside the triad: knowing who did what. It rests on three activities that are often grouped as AAA.

- **Authentication** establishes who is acting.
- **Authorization** decides what that identity may do.
- **Accounting** (auditing) records what it actually did.

**Non-repudiation** is the strongest form of accountability, where the evidence is good enough that the actor cannot credibly deny the action. A log entry written by the same server the actor controls does not achieve it. A digital signature made with a key only the actor holds does.

---

## Design Principles

In 1975, Jerome Saltzer and Michael Schroeder published [The Protection of Information in Computer Systems](https://www.cs.virginia.edu/~evans/cs551/saltzer/){:target="_blank" rel="noopener noreferrer"}, which set out eight design principles for protection mechanisms and two more they considered only partly applicable to computers. Nearly fifty years later the list still describes most of what goes wrong in real breaches. Each principle below is stated, then shown as the mistake it prevents.

### Least Privilege

Every program and every user should operate with the smallest set of privileges the job requires, for the shortest time it requires them. Least privilege limits the damage from an accident or a compromise to what the compromised identity could already do.

The common violation is convenience. An application connects to its database as an administrator because that was the account that worked during development. When the application is compromised through an injection flaw, the attacker inherits the right to drop tables, read every schema, and create new logins. Had the application connected as an account with `SELECT`, `INSERT`, and `UPDATE` on its own tables, the same flaw would expose far less.

Least privilege applies to time as well as scope. Standing administrator rights are exposed every hour of every day, while rights granted for one approved task and revoked afterward are exposed only during that task. The trade-off is operational friction, since every narrowed permission is a request someone may have to make later.

### Fail-Safe Defaults

Base access decisions on permission rather than exclusion. The default answer is "no", and access is granted only when an explicit rule allows it. A deny-by-default system that forgets a rule blocks a legitimate user, who complains and gets it fixed. An allow-by-default system that forgets a rule admits an attacker, who does not complain.

The principle also governs error paths. When an authorization check throws, times out, or cannot reach its policy store, the code has to decide what happens next, and it should deny.

```csharp
public async Task<bool> CanAccessAsync(User user, Resource resource)
{
    try
    {
        var permissions = await _policyStore.GetPermissionsAsync(user.Id, resource.Id);
        return permissions.Contains(Permission.Read);
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Authorization check failed for {UserId}", user.Id);
        return false; // fail closed: an error is never a grant
    }
}
```

Fail closed is not always right for availability. A physical door lock that fails closed during a fire traps people, which is why building codes often require the opposite. Software faces the same trade-off in places like a rate limiter whose backing store is down. Decide which way each control fails on purpose, and write the decision down.

### Complete Mediation

Check every access to every object for authority, every time. A system that checks once and remembers the result is vulnerable to anything that changes afterward: a revoked role, a disabled account, or a resource that moved to a different owner.

The usual violation is a cached authorization decision with no expiry, or an authorization check made in the user interface and never repeated on the server. Caching is sometimes necessary for performance, and when it is, the cache lifetime becomes the window during which a revocation has no effect. That window should be short and known. Zero trust architectures apply this principle to network access, verifying each request rather than trusting anything inside a network perimeter.

### Economy of Mechanism

Keep the design as small and simple as possible. Security mechanisms have to be inspected to be trusted, and small mechanisms can be inspected thoroughly while large ones cannot. Errors in security code rarely show up in normal use, because normal use does not exercise the path an attacker takes.

This is the principle behind preferring a framework's authentication middleware over a hand-built one, and a single authorization layer over checks scattered through every controller. Each additional place where a security decision is made is another place where it can be made differently.

### Open Design

The security of a mechanism should not depend on the secrecy of its design. Assume attackers know the algorithm, the architecture, and the source code, and keep only keys and credentials secret. The same idea appears in Auguste Kerckhoffs's 1883 principles of military cryptography.

The reason is practical. A design is hard to change and easy to leak, since it lives in binaries, documentation, and former employees' heads. A key is easy to change. A system whose security survives disclosure of everything except the key can recover from a leak by rotating the key. A system that relied on an undisclosed algorithm has to be redesigned. This is why custom cryptography is a mistake even when written by capable engineers. Obscurity can still add cost for an attacker as one layer among several. It cannot be the layer that holds.

### Separation of Privilege

Where feasible, require more than one condition to grant access, so that no single stolen credential or single insider can complete a sensitive action alone. Multi-factor authentication applies it to identity: a password and a device. Two-person approval for production deployments or large payments applies it to actions. Segregation of duties, where the person who writes code is not the only person who can ship it, applies it to roles.

The cost is speed. Every second condition is a second party who has to be available, which is why teams reserve it for actions whose damage would be severe or hard to undo.

### Least Common Mechanism

Minimize the mechanisms shared between users and depended on by all of them. Every shared component is a path by which information can leak from one user to another and a single point whose compromise affects everyone.

In modern systems this principle is about multi-tenancy. A shared cache keyed only by URL can serve one customer's personalized page to another. A shared database connection pool that sets tenant context per session can leak that context when a connection is reused. Shared infrastructure is often the right economic choice. The principle asks that its isolation be designed deliberately rather than assumed.

### Psychological Acceptability

Security mechanisms must be easy enough to use correctly that people use them routinely. When the secure path is harder than the insecure one, people route around it, and the control protects nothing while appearing to work.

Password policy is the standard example. Forced periodic rotation and composition rules produced passwords like `Summer2024!` followed by `Autumn2024!`, which are predictable and often written down. [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html){:target="_blank" rel="noopener noreferrer"} now says verifiers shall not require periodic changes or impose composition rules, and emphasizes length, breached-password screening, and phishing-resistant authenticators such as passkeys instead. Single sign-on applies the same idea by reducing the number of passwords a person must manage.

### Work Factor and Compromise Recording

Saltzer and Schroeder listed two further principles as only partly applicable to computers.

**Work factor** compares the cost of defeating a mechanism with the resources of the likely attacker. It is the reasoning behind slow password hashing algorithms, which make each guess expensive, and behind rate limits on login endpoints. Work factor estimates erode over time as hardware gets cheaper, so they need revisiting.

**Compromise recording** holds that reliably detecting a breach can sometimes substitute for preventing it. Tamper-evident audit logs, file integrity monitoring, and alerts on unusual access all apply it. Detection does not undo a data disclosure, so it complements prevention for confidentiality rather than replacing it. It fits better where the damage can be reversed once discovered.

### Defense in Depth

Defense in depth is not on Saltzer and Schroeder's list, but it follows from accepting that any single control can fail. Layer independent controls so that an attacker who defeats one still faces others, and so that the failure of one is noticed before the next falls.

The word that matters is *independent*. Three controls that all trust the same identity provider are one control with three names, because compromising the identity provider defeats all three. Useful layers differ in what they depend on: a network restriction, an authentication requirement, an authorization check in the application, encryption with separately managed keys, and monitoring that watches all of them. Each layer also adds cost and complexity, which pulls against economy of mechanism. The balance is to add a layer where a single failure would be severe, not everywhere.

---

## Common Pitfalls

- **Securing the wrong property.** Encrypting a public dataset while leaving its integrity unprotected, or spending on availability for data nobody needs quickly. Name the loss before choosing the control.
- **Principles applied only at design time.** Least privilege decays as permissions are added for one-off tasks and never removed. Periodic access review is how the principle survives contact with operations.
- **Failing open by accident.** Exception handlers, timeouts, and feature flags that default to "allow" are the most common way a correct authorization design becomes an incorrect implementation.
- **Obscurity treated as a control.** Hidden admin URLs, undocumented ports, and custom encoding schemes delay an attacker briefly. They are not a substitute for authentication.
- **Layers that share a dependency.** Counting controls instead of asking what each one depends on produces confidence without depth.
