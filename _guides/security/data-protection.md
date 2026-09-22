---
title: "Data Protection"
layout: guide
category: Security
subcategory: Application Security
description: "Protecting data wherever it sits: classifying it so controls can differ by sensitivity, protecting it at rest, in transit, and in use, reducing what you hold through minimization, pseudonymization, tokenization, and masking, preventing loss with DLP, and retiring data through retention and deletion."
tags: [practical, data-classification, tokenization, dlp, data-minimization, pseudonymization, retention]
---

## Start by Knowing What You Hold

Protecting everything equally is the same as protecting nothing in particular. It costs too much, slows down work that does not need slowing, and still leaves the sensitive data mixed in with the rest where nobody can see it. Data protection starts with two questions that have nothing to do with technology: what data do we hold, and how much would it hurt if it leaked, changed, or disappeared?

**Data classification** turns the answer into a small number of levels that controls can attach to. Most private-sector schemes use four:

| Level | Meaning | Typical handling |
|---|---|---|
| **Public** | Intended for release | No confidentiality controls; integrity still matters |
| **Internal** | Ordinary business information | Access limited to employees, encrypted in transit |
| **Confidential** | Would harm the business or a person if disclosed | Need-to-know access, encrypted at rest and in transit, access logged |
| **Restricted** | Severe harm: regulated data, secrets, credentials | Strict need-to-know, strong encryption, key separation, monitoring, tight retention |

Government classification (Unclassified, Confidential, Secret, Top Secret) follows the same idea with legally defined levels and clearances behind them.

Three things make classification work rather than decorate a policy document. The levels must be few enough that people can choose correctly. Each level must specify actual handling rules, so a label changes what happens. And the labels must be applied where the data is, through automated discovery and classification tools for existing stores and through defaults for new ones, because a scheme that depends on every developer labelling every field correctly will not hold.

The output that matters is a **data inventory**: what data exists, where it lives, which classification it carries, who owns it, and what it is used for. Almost every later decision, from encryption to retention to breach notification, needs it. It is also the thing most organizations discover they lack at the worst possible moment.

---

## The Three States

Data needs different protection depending on whether it is sitting still, moving, or being processed.

### At Rest

Storage-level encryption, such as full-disk encryption or a cloud provider's default encryption, protects against physical theft of the medium and against a disk being decommissioned carelessly. It does not protect against anything that goes through the running system, because to the database and the application the data is simply readable. It is a baseline, not a boundary.

Protection that survives a compromised query path has to be narrower. **Database-level encryption** (transparent data encryption) still decrypts for any authorized connection. **Column-level or application-level encryption** protects specific fields with keys the database itself does not hold, so a stolen database dump or an over-privileged query returns ciphertext. The cost is functionality: encrypted columns cannot be searched, sorted, or joined normally, which is why this is reserved for the few fields that justify it, such as national identifiers, payment details, and health data.

The security of any of this rests on key management, which is where encryption at rest usually fails. Keys held in a key management service, with envelope encryption and separate keys per classification or tenant, are what make encryption at rest more than a compliance checkbox.

### In Transit

Everything moving over a network is encrypted with TLS, including traffic between internal services and between an application and its database. Internal traffic used to be treated as safe, which assumed a trusted network that no longer exists. Mutual TLS adds authentication of both ends, so a service cannot be impersonated by anything that reaches the network.

The frequent gaps are not the main web endpoint. They are internal service calls, database connections configured without TLS because it was easier, batch file transfers, third-party integrations, and backup replication.

### In Use

Data being processed is decrypted in memory, which is where it is most exposed. Most systems accept this and defend the process boundary instead. Where the threat model includes the platform operator or a compromised host, **confidential computing** uses hardware trusted execution environments (Intel SGX, AMD SEV, AWS Nitro Enclaves) to keep memory encrypted and inaccessible even to the hypervisor.

Two cryptographic techniques address the same problem mathematically. **Homomorphic encryption** allows computation directly on ciphertext, and **secure multi-party computation** lets several parties compute a joint result without revealing their inputs. Both work today, and both remain expensive enough that they fit specific high-value cases rather than general use.

---

## Holding Less

The most reliable protection for data is not holding it. Every field kept is a field that can leak, must be encrypted, must be deleted on request, and appears in a breach notification. Reducing what is held is cheaper than protecting it.

**Data minimization** means collecting only what a purpose requires and keeping it only as long as that purpose lasts. This is also a legal requirement under GDPR and similar laws, but it stands on its own as security: a signup form that does not ask for a date of birth has no date of birth to lose.

**Pseudonymization** replaces identifying fields with a reference, keeping the mapping separately. The data is still personal data, because it can be re-identified by whoever holds the mapping, but a compromise of the pseudonymized store alone is far less damaging. **Anonymization** aims to remove identifiability entirely, which is harder than it looks. Removing names and identifiers is often insufficient, since combinations of attributes such as postcode, birth date, and sex can single a person out. Techniques such as k-anonymity and differential privacy exist to reason about that risk rather than assume it away.

**Tokenization** replaces a sensitive value with a surrogate that has no mathematical relationship to the original, with the mapping held in a separate, tightly controlled vault. It is the standard approach for payment cards: the application stores a token, and the token is useless to an attacker who reaches the application database. Because the surrogate can preserve the original's format, tokenization often fits systems that cannot accommodate ciphertext. Using a payment provider's tokens removes the card data from the environment altogether, which also shrinks PCI DSS scope.

**Masking** shows a partial or fake value to people who do not need the real one, such as displaying only the last four digits of an account number, or generating realistic but non-real data for test environments. Copying production data into test systems is a common and avoidable way for regulated data to spread into environments with weaker controls.

---

## Data Loss Prevention

DLP tools detect and block sensitive data leaving where it should stay. They identify data by pattern matching, by classification labels, by fingerprinting known documents, and increasingly by trained classifiers, then apply policies at the points where data moves.

| Where it runs | What it sees |
|---|---|
| **Network** | Data in transit at the egress point, such as uploads and outbound mail |
| **Endpoint** | Copying to USB devices, printing, clipboard use, uploads from the device |
| **Storage** | Sensitive data discovered at rest, including in places it should not be |
| **Cloud and SaaS** | Sharing in collaboration tools, public links, third-party app access |

DLP is genuinely useful against accidental and careless loss, which is the most common kind, and against a departing employee copying a customer list. It is far weaker against a determined insider, who can photograph a screen or retype data.

The usual failure is deploying in blocking mode with broad rules. False positives interrupt legitimate work, people find workarounds, and the exception list grows until the policy means nothing. Starting in monitoring mode, tuning against what the organization actually does, and blocking only the highest-confidence, highest-impact cases is what makes it survivable.

---

## Retention and Deletion

Data that is kept forever will eventually be breached. Retention schedules put an end date on it, balancing legal obligations to keep records (tax, employment, regulated communications) against obligations and incentives to delete (privacy law, breach exposure, storage cost).

Deletion is harder than it sounds, and the difficulty is where most retention policies quietly fail:

- **Copies multiply.** The same record exists in backups, replicas, search indexes, caches, analytics warehouses, logs, and exported spreadsheets. Deleting from the primary store deletes one copy.
- **Backups resist selective deletion.** A common approach is to let backups age out under their own retention period and to document that a deletion request applies to live systems immediately and to backups within that window.
- **Legal holds override retention.** When litigation or an investigation is foreseeable, deletion of relevant data has to stop, which means the schedule needs an override mechanism.
- **Crypto-shredding** offers a practical alternative where physical deletion is impractical. Encrypt each tenant's or subject's data under its own key, and destroy the key to render the data unreadable everywhere it exists, including in backups.

---

## Common Pitfalls

- **Classification with no handling rules.** Labels that do not change how data is stored, shared, or retained are documentation, not control.
- **Treating storage encryption as sufficient.** It defends against a stolen disk. It does nothing against a compromised application, which is the likelier attack.
- **Keys beside the data.** Encryption whose key is in the same database, the same backup, or the same configuration file protects nothing.
- **Unencrypted internal traffic.** Service-to-service and database connections are inside the network, and the network is not trustworthy.
- **Production data in test environments.** The data spreads to systems with weaker access control and no monitoring. Mask or synthesize instead.
- **No inventory.** Without knowing where regulated data lives, every control is applied hopefully, and a breach cannot be scoped.
- **Retention policy without deletion capability.** A schedule nobody can execute across copies is a statement of intent.
