---
title: "Incident Response and Recovery"
layout: guide
category: Security
subcategory: Security Operations
description: "Responding to a security incident: the lifecycle models including what changed in NIST SP 800-61 Rev 3, team roles and the incident commander, severity classification and triage, containment strategies and the decision to watch or cut off, evidence handling and forensics, eradication and recovery, notification and communication, ransomware specifics, and the post-incident review that makes the next response better."
tags: [practical, incident-response, containment, forensics, ransomware, playbooks, tabletop-exercises]
---

## Preparation Decides the Outcome

The quality of an incident response is mostly determined before the incident. Teams that have agreed who decides, who can shut down a production system, which logs exist and for how long, and who calls the lawyer respond in minutes. Teams that have not spend the first hours discovering that the logs they need were never collected, that nobody can authorize disconnecting the payment system, and that the only person who understands the affected service is on a flight.

Preparation is unglamorous and consists mostly of decisions made in advance:

- **An incident response plan** naming roles, decision authority, severity levels, and escalation paths.
- **Contacts**, reachable out of hours, including executives, legal counsel, the cyber insurer, an external forensics or incident response firm, and law enforcement. A retainer with a response firm arranged in advance avoids negotiating a contract during a crisis.
- **Logging that will answer questions**, retained long enough to be useful. Intrusions are often discovered months after they began, so 30-day retention frequently means the beginning of the incident is gone.
- **Tooling and access** that work when the environment is compromised, including EDR with isolation capability and administrative access that does not depend on the systems under attack.
- **Out-of-band communications.** If an attacker is in the email system or the chat platform, planning the response in that system tells them what you are doing. Agree an alternative channel before you need it.

---

## The Lifecycle Models

The four-phase lifecycle from NIST SP 800-61 Rev 2 is still the vocabulary most teams use: **preparation**, **detection and analysis**, **containment, eradication, and recovery**, and **post-incident activity**. It is a useful description of how a single incident proceeds, and the phases loop rather than run once, since analysis during containment routinely reveals more scope.

[SP 800-61 Rev 3](https://csrc.nist.gov/pubs/sp/800/61/r3/final){:target="_blank" rel="noopener noreferrer"}, published in April 2025, replaced that structure. It is written as a CSF 2.0 Community Profile, organizing incident response around the six CSF 2.0 Functions instead of phases: **Govern, Identify, and Protect** cover preventing incidents, preparing to handle them, and improving from what is learned, while **Detect, Respond, and Recover** cover discovering, containing, eradicating, and recovering from them, along with reporting and communication. NIST also deliberately removed the detailed procedural guidance that Rev 2 carried, on the grounds that specifics change too fast and vary too much to fix in a static document, and it states that organizations should use whichever lifecycle model suits them.

The practical reading is that the phases still describe the work, and Rev 3's contribution is insisting that incident response is part of ongoing risk management rather than a separate process that activates during a crisis.

---

## Roles

Incidents need clear authority, because a crisis without it produces several competent people making conflicting decisions.

| Role | Responsibility |
|---|---|
| **Incident commander** | Owns the response, makes or escalates decisions, keeps the timeline. Coordinates rather than investigates |
| **Technical lead and analysts** | Investigation, forensics, containment and eradication actions |
| **Communications** | Internal updates, customer and public messaging |
| **Legal counsel** | Regulatory obligations, disclosure decisions, law enforcement contact, privilege over investigation materials |
| **Executive sponsor** | Business decisions with major consequences, such as taking a revenue system offline |
| **IT operations** | Restoration, rebuilds, and infrastructure changes |
| **Scribe** | Records actions, times, and decisions as they happen |

SP 800-61 Rev 3 emphasizes that these roles reach well beyond the security team, including leadership, legal, human resources, communications, and third parties, and the time to establish who fills each one is before an incident.

Two practices consistently separate calm responses from chaotic ones. The incident commander does not also do the technical work, because the person deep in a log analysis cannot track the whole picture. And someone records a timeline continuously, because reconstructing what was done and when, afterward and from memory, is nearly impossible and is exactly what regulators, insurers, and the post-incident review need.

---

## Detection, Triage, and Classification

Incidents arrive from monitoring alerts, from users, from third parties, and uncomfortably often from an outside party such as a customer, a researcher, or law enforcement. Every route needs somewhere to report to that is staffed.

Triage answers three questions quickly: is this actually an incident, what is its scope, and how severe is it? Scope is usually underestimated at first. One compromised account often means several, and one compromised host usually means the attacker moved.

Severity classification exists so that the response matches the problem and so that escalation is not a judgment call in the moment. Most schemes grade on data sensitivity, business impact, and the extent of compromise:

| Severity | Typical criteria | Response |
|---|---|---|
| **Critical** | Active attacker with broad access, ransomware spreading, confirmed breach of regulated data | Immediate full response, executive and legal involvement, out-of-hours |
| **High** | Confirmed compromise of a system or account with sensitive access | Rapid response during and outside business hours |
| **Medium** | Contained compromise with limited impact, such as one endpoint with commodity malware | Normal working hours, standard process |
| **Low** | Policy violations, unsuccessful attacks, isolated events needing follow-up | Tracked and handled routinely |

Classification is revisited as scope becomes clearer, in both directions.

---

## Containment

Containment limits the damage while the investigation continues, and it involves the response's hardest judgment call: **cut the attacker off now, or watch to learn the full scope first?**

Acting immediately risks alerting the attacker, who may destroy evidence, trigger destructive payloads, or fall back to a foothold you have not found. Watching risks further damage and data theft while you observe. The balance usually tips toward immediate containment when data is actively being stolen, when ransomware is spreading, or when safety is at stake, and toward brief observation when the attacker appears stable, the affected systems are not critical, and the scope is genuinely unclear. This is a business decision informed by technical advice, which is why the executive sponsor exists.

Short-term containment stops the bleeding: isolate hosts at the network level (EDR isolation keeps the responder's access while cutting everything else), disable compromised accounts, revoke sessions and tokens rather than only resetting passwords, block attacker infrastructure, and take vulnerable services offline.

Longer-term containment lets the business keep running while eradication is prepared, with temporary firewall rules, tightened access, extra monitoring, and rebuilt systems standing in for compromised ones.

Two mistakes recur. Resetting a password without revoking active sessions and refresh tokens leaves the attacker signed in. And containing one host at a time, as each is discovered, gives the attacker time to move: where an attacker has spread, simultaneous containment across all known footholds works far better than sequential cleanup.

---

## Evidence and Forensics

Evidence supports the investigation, and it may also be needed for insurance claims, regulatory filings, and legal action, so it is collected in a way that survives scrutiny.

**Order of volatility** governs collection sequence. Memory, running processes, and network connections disappear on reboot or shutdown, so they are captured before disk images and logs. Powering off a compromised machine to "stop the attack" destroys exactly the evidence that would show what the attacker did, and full-disk encryption can make the disk unreadable afterward.

**Chain of custody** records what was collected, when, by whom, and every transfer, with cryptographic hashes proving the copy has not changed. Analysis runs on copies, never on the original.

Useful sources include EDR telemetry, authentication and directory logs, cloud audit logs, network flow records, email logs, and the affected systems' own logs. Their usefulness depends entirely on decisions made during preparation about what is collected and how long it is kept.

Where the incident may lead to litigation or regulatory action, involving legal counsel early can bring the investigation under legal privilege in some jurisdictions, and a legal hold stops routine deletion of relevant data.

---

## Eradication and Recovery

Eradication removes the attacker's access and the cause: malware and persistence mechanisms, attacker-created accounts and credentials, web shells and scheduled tasks, and the vulnerability or misconfiguration that permitted entry. Where an attacker had administrative control of a system, rebuilding from a known-good image is more reliable than cleaning, because persistence is easy to hide and hard to fully enumerate. Credentials that may have been exposed, including service accounts and certificates, are rotated, and for a domain compromise that extends to the credentials that underpin the whole directory.

Recovery restores service with confidence that it is clean. It is staged and verified rather than declared: restore from backups checked for integrity and confirmed to predate the compromise, return systems to production in a prioritized order, monitor the restored environment more closely than usual for signs of the attacker's return, and keep the heightened monitoring in place for weeks. Attackers who have lost access frequently try to regain it using what they learned.

Recovery from a destructive incident also depends on the organization's wider continuity and disaster recovery arrangements: recovery objectives, backup strategy, and standby infrastructure. Those patterns are covered in [Disaster Recovery Patterns](/study-guides/infrastructure/disaster-recovery-patterns.html). The security-specific requirement is that backups must survive an attacker with administrative rights, which means offline or immutable copies, and that restore procedures have actually been tested.

---

## Notification and Communication

Incidents create obligations and audiences, and both need handling deliberately.

- **Internally**, updates go to executives and affected teams on a predictable cadence, stating what is known, what is not, and what is being done. Speculation in a company-wide channel becomes fact within the hour.
- **Customers and partners** may need notification both contractually and ethically. Saying little slowly damages trust more than the incident usually does.
- **Regulators** impose deadlines that vary by jurisdiction and data type, and some are measured in days or hours. Legal counsel determines which apply, and the clock often starts at awareness rather than at confirmation, which is why counsel is engaged early rather than after the facts are settled.
- **Law enforcement** can assist and may be required in some sectors. The decision is made with counsel.
- **Ransom demands** are a legal and business decision, never a technical one, and they carry sanctions considerations in some jurisdictions.

Prepared statement templates help, because writing public communications from scratch during a crisis produces either silence or something the legal team must later retract.

---

## Ransomware

Ransomware compresses every part of the response, and a few specifics differ from a general intrusion.

The encryption is the end of the attack, not the beginning, so the investigation has to establish how long the attacker was present and what they took, since most groups steal data before encrypting. Restoring systems without answering that leaves both the intrusion path and the disclosure obligation unaddressed.

Containment is urgent and broad, because encryption spreads fast, and it usually means isolating network segments rather than individual hosts. Backups are a target and are checked for compromise before being trusted. Whether to pay is a business and legal decision, and the practical arguments against are that decryption tools are often slow and incomplete, and that payment does not undo the theft of data.

---

## Learning From Incidents

A post-incident review, held soon enough that memories are fresh, asks what happened, how it was detected, what worked, what slowed the response, and what will change. Its outputs are tracked items with owners: detection rules that would have caught it earlier, controls that would have limited it, and process gaps that cost time.

The review is blameless, because the purpose is to find the conditions that allowed the incident rather than the person who clicked. Teams that blame individuals stop reporting incidents early, which is the single most expensive thing that can happen to a response capability.

**Playbooks** capture what was learned as repeatable procedure for the incident types an organization actually sees: phishing with credential compromise, ransomware, a compromised cloud key, an insider data theft, a vulnerable internet-facing service under exploitation. A playbook is a checklist of decisions and steps, not a script, and it exists so the response does not depend on who is awake.

**Exercises** keep all of this real. A tabletop walks a scenario through with the decision-makers in the room and reliably surfaces gaps in authority, contacts, and assumptions. Technical simulations test whether the tooling and telemetry actually support the steps the playbook assumes. Exercises that include executives and legal counsel are more valuable than technical drills alone, because that is where the slow decisions live.

Track time to detect, time to contain, and time to recover, plus how many incidents were found internally rather than reported from outside.

---

## Common Pitfalls

- **No plan, or a plan nobody has read.** A document written for an auditor does not help at 3 a.m.
- **Powering off compromised systems.** Volatile evidence is destroyed and the attacker's actions become unreconstructable.
- **Sequential containment.** Cleaning hosts one at a time as they are found lets the attacker move ahead of you.
- **Password resets without session revocation.** Active sessions and refresh tokens keep working.
- **Coordinating the response in a compromised channel.** Assume the attacker reads the email and chat they have access to.
- **Declaring the incident over at restoration.** Attackers return, and heightened monitoring belongs in the plan.
- **Reviews that produce a document.** Without owned, tracked actions, the next incident goes the same way.
