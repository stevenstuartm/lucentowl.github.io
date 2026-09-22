---
title: "Threat Modeling"
layout: guide
category: Security
subcategory: Application Security
description: "Finding threats in a design before it is built: the four questions, modeling a system as a data flow diagram with trust boundaries, finding threats with STRIDE per element and attack trees, privacy threats with LINDDUN, risk-centric methods such as PASTA, deciding what to do about each threat, and fitting threat modeling into ordinary development."
tags: [practical, threat-modeling, stride, data-flow-diagrams, trust-boundaries, linddun, attack-trees]
---

## Why Model Threats

Most security testing finds flaws in code that already exists. Threat modeling finds flaws in a design before the code exists, when fixing them means changing a diagram rather than rewriting a service. A missing authorization check between two internal services, an audit log that the audited service can edit, or a queue that any tenant can read are design decisions. Scanners rarely find them, and they are expensive to change once built on.

Threat modeling is structured thinking about what could go wrong. The [Threat Modeling Manifesto](https://www.threatmodelingmanifesto.org/){:target="_blank" rel="noopener noreferrer"}, written in 2020 by a group of practitioners and researchers, reduces it to four questions:

1. **What are we working on?** Build a model of the system.
2. **What can go wrong?** Find threats against that model.
3. **What are we going to do about it?** Decide how to handle each threat.
4. **Did we do a good enough job?** Check the model, the threats, and the responses.

Every method below is a way of answering one or more of these questions. The methods differ in how much structure they impose, not in what they are for.

---

## What Are We Working On: Modeling the System

The model is usually a **data flow diagram (DFD)**, because threats follow data. A DFD has four element types and one annotation:

| Element | Represents | Drawn as |
|---|---|---|
| **External entity** | Something outside your control that interacts with the system: a user, a third-party API | Rectangle |
| **Process** | Code that transforms or routes data: a web app, a worker, a function | Circle or rounded box |
| **Data store** | Data at rest: a database, a bucket, a queue, a cache | Parallel lines |
| **Data flow** | Data moving between elements | Arrow |
| **Trust boundary** | A line where the level of trust changes | Dashed line or box |

**Trust boundaries** are where the analysis concentrates. A trust boundary exists wherever data passes between parties that trust each other differently: from the internet into the application, from the application into the database, from one tenant's context into shared infrastructure, from your code into a third-party service. Threats cluster at these crossings, because each crossing is where one side has to verify what the other side claims.

{% include figure.html id="sec-threat-model-dfd" %}

The diagram only needs as much detail as the question at hand. A model of a whole platform might show services as single processes. A model of an authentication change might show the login endpoint, the session store, and the identity provider in detail and nothing else. A diagram that is too detailed to discuss in a meeting is too detailed for threat modeling.

---

## What Can Go Wrong: Finding Threats

### STRIDE

[STRIDE](https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats){:target="_blank" rel="noopener noreferrer"}, developed at Microsoft, is a mnemonic for six categories of threat. Each is the violation of a security property.

| Threat | Violates | Example |
|---|---|---|
| **Spoofing** | Authentication | Calling an internal API while claiming to be another service |
| **Tampering** | Integrity | Modifying an order total in transit or in a message queue |
| **Repudiation** | Non-repudiation | A user denies placing an order, and the logs cannot show otherwise |
| **Information disclosure** | Confidentiality | An error page returns a stack trace containing a connection string |
| **Denial of service** | Availability | An unauthenticated endpoint triggers an expensive report |
| **Elevation of privilege** | Authorization | A regular user reaches an admin function by changing a URL |

STRIDE becomes systematic when applied **per element**. Each element type is susceptible to a known subset of the categories, so a team walks the diagram element by element and asks only the relevant questions.

| Element | S | T | R | I | D | E |
|---|---|---|---|---|---|---|
| External entity | ✓ | | ✓ | | | |
| Process | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Data store | | ✓ | ✓* | ✓ | ✓ | |
| Data flow | | ✓ | | ✓ | ✓ | |

\* Repudiation applies to a data store when it holds audit or log data.

Pay most attention to flows that cross a trust boundary, and to processes that sit on one. The example DFD shows the pattern: every numbered threat sits on a boundary crossing, not inside a zone.

### Attack Trees

An **attack tree**, popularized by Bruce Schneier in 1999, starts from an attacker's goal at the root, such as "read another customer's orders", and breaks it into the ways that goal could be achieved. Children of a node are alternatives (OR) or steps that must all succeed (AND). Leaves are concrete actions such as "guess a sequential order ID" or "steal a support agent's session".

Attack trees complement STRIDE. STRIDE walks the system and asks what could go wrong at each part. An attack tree walks backward from an outcome the business cares about and shows every path to it, which makes it easier to see that closing one path leaves three others open. Trees work well for the handful of outcomes that would be most damaging.

### LINDDUN for Privacy

STRIDE asks whether an attacker can break the system. It does not ask whether the system, working exactly as designed, harms the privacy of the people whose data it processes. [LINDDUN](https://linddun.org/threat-types/){:target="_blank" rel="noopener noreferrer"} fills that gap with seven privacy threat types applied to the same DFD:

- **Linking**: associating data items or actions to learn more about a person or group
- **Identifying**: learning who a person is through leaks, deduction, or inference
- **Non-repudiation**: being able to attribute a claim or action to a person who may need deniability
- **Detecting**: deducing a person's involvement by observing the system
- **Data disclosure**: collecting, storing, processing, or sharing more personal data than needed
- **Unawareness and unintervenability**: insufficiently informing or empowering people about processing of their data
- **Non-compliance**: deviating from data protection legislation, standards, and practice

Non-repudiation shows the difference in viewpoint. STRIDE treats the ability to deny an action as a threat to the system. LINDDUN treats the inability to deny it as a threat to the person, as in an anonymous whistleblowing feature. Teams building systems that process personal data at scale benefit from running both.

### Risk-Centric Methods

**PASTA** (Process for Attack Simulation and Threat Analysis) is a seven-stage method that starts from business objectives and ends with risk and impact analysis: define objectives, define technical scope, decompose the application, analyze threats, analyze vulnerabilities, model attacks, and analyze risk and impact. It ties threats to business impact more explicitly than STRIDE and suits large systems where the output must feed an organizational risk process. It also takes considerably more effort, which is why most development teams use a lighter method for routine work.

---

## What Are We Going to Do About It

Every identified threat gets one of four responses:

| Response | Meaning | Example |
|---|---|---|
| **Mitigate** | Add or change a control to reduce the threat | Add authorization checks on order lookups keyed by the caller's customer ID |
| **Eliminate** | Remove the feature or data that creates the threat | Stop storing full card numbers by using a payment provider's tokens |
| **Transfer** | Make another party responsible | Use the identity provider's MFA rather than building it |
| **Accept** | Consciously take the risk, with an owner and a reason | Accept that a public status page can be scraped |

Elimination is underused. The strongest control for data you do not need is not collecting it.

Every response is written down, and every mitigation becomes a tracked work item with an owner. A threat model whose findings live only in meeting notes changes nothing. Accepted risks are recorded with who accepted them and why, so they can be revisited when the system or the threat changes.

Not every threat deserves equal effort. Rank them by likelihood and impact, using whatever risk scale the organization already uses, and fix the high-impact threats at trust boundaries first.

---

## Did We Do a Good Enough Job

The fourth question is a review of the model itself. Does the diagram match the system as built, or the system as intended? Were threats found at every trust boundary crossing? Does every mitigation have a test, a code review check, or a monitoring alert that would show whether it works?

Threat models also go stale. A model is revisited when the design changes in a way that adds a trust boundary, a new external dependency, a new kind of data, or a new class of user. Keeping the diagram in the repository next to the code, and updating it as part of design review, keeps it current far better than an annual exercise.

---

## Fitting It into Development

Threat modeling earns its cost when it is small, frequent, and done by the people building the system.

- **Model at design time, per change.** A thirty-minute session on a new feature's diagram finds more than a week-long review of the whole platform once a year. Trigger a session when a change crosses or adds a trust boundary, handles a new kind of sensitive data, or changes authentication or authorization.
- **Involve the builders.** Developers know how the system actually behaves. A security specialist facilitates and brings knowledge of attacks, but a threat model written by security alone for developers to read rarely changes a design.
- **Use a tool only if it helps.** Whiteboards work. Tools such as the [Microsoft Threat Modeling Tool](https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool){:target="_blank" rel="noopener noreferrer"} and [OWASP Threat Dragon](https://owasp.org/www-project-threat-dragon/){:target="_blank" rel="noopener noreferrer"} generate STRIDE-per-element threat lists from a DFD, which helps teams new to the practice, at the cost of long generic lists that need pruning.

---

## Common Pitfalls

- **Modeling the whole system at once.** The diagram grows too large to discuss and the session ends before reaching threats. Scope to the change or the component.
- **Missing trust boundaries.** Treating all internal services as one trusted zone hides exactly the service-to-service spoofing and privilege threats that matter after an initial compromise.
- **Findings without owners.** Threats listed in a document but never turned into tracked work.
- **Treating the model as a compliance artifact.** A model produced to satisfy an audit and never updated describes a system that no longer exists.
- **Stopping at STRIDE.** Systems handling personal data also need privacy threats considered, and the most damaging business outcomes benefit from an attack tree.
