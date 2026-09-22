---
title: "Frameworks and Standards"
layout: guide
category: Security
subcategory: Governance & Risk
description: "What each major security framework is actually for and which combination fits an organization: NIST CSF 2.0 as a risk management structure, ISO/IEC 27001 as a certifiable management system, CIS Controls as a prioritized safeguard list, NIST SP 800-53 and 800-171 as control catalogs for government work, MITRE ATT&CK as a threat knowledge base, and how to map between them without running several programs at once."
tags: [practical, nist-csf, iso-27001, cis-controls, mitre-attack, nist-800-53, framework-selection]
---

## Frameworks Are Not Interchangeable

Security frameworks get compared as if choosing between them were like choosing a database. They are not alternatives, because they answer different questions. A useful first cut is to sort them by kind:

| Kind | What it gives you | Examples |
|---|---|---|
| **Risk management structure** | A way to organize the whole program and talk about it with executives | NIST CSF 2.0 |
| **Certifiable management system** | A process standard an accredited body can certify against | ISO/IEC 27001 |
| **Prioritized safeguard list** | An ordered set of specific things to implement | CIS Controls |
| **Control catalog** | A comprehensive library of controls to select from, usually mandated | NIST SP 800-53, SP 800-171 |
| **Threat knowledge base** | What adversaries actually do, for detection and coverage assessment | MITRE ATT&CK |
| **Application security standard** | Requirements and verification for software | OWASP ASVS, OWASP Top 10 |

Organizations typically end up with several: one structure to organize and report, one control set to implement, and ATT&CK to measure detection. The mistake is running several as separate programs with separate evidence.

---

## NIST Cybersecurity Framework 2.0

[CSF 2.0](https://www.nist.gov/cyberframework){:target="_blank" rel="noopener noreferrer"}, released in February 2024, is a voluntary framework for organizing and communicating cybersecurity risk management. Version 1.0 was written in 2014 for US critical infrastructure; 2.0 explicitly broadened the audience to organizations of every size and sector, and it is widely used outside the United States.

Its structure has three parts. The **Core** organizes outcomes into six Functions, each divided into Categories and Subcategories:

| Function | Concerned with |
|---|---|
| **Govern** | Risk management strategy, roles and responsibilities, policy, oversight, supply chain risk. Added in 2.0 |
| **Identify** | Asset and risk understanding, including improvement |
| **Protect** | Safeguards: identity and access, awareness, data security, platform security, resilience |
| **Detect** | Finding and analyzing adverse events |
| **Respond** | Incident management, analysis, mitigation, and reporting |
| **Recover** | Restoring assets and operations, and recovery communication |

Adding **Govern** was the substantive change in 2.0, and it reflects what practice had learned: programs fail on ownership, policy, and supply chain oversight more often than on missing technical controls.

**Profiles** describe the organization's current state and its target state, and the gap between them is the improvement plan. **Tiers**, from Partial (1) to Adaptive (4), characterize how rigorous and integrated risk management practices are. Tiers describe a posture rather than prescribing a goal, and not every organization needs to reach Tier 4.

CSF's strength is that it structures a program and communicates it to a board without requiring a specific control set. Its corresponding weakness is that it tells you what outcomes to achieve, not what to implement, which is why it is usually paired with CIS Controls or SP 800-53.

---

## ISO/IEC 27001 and 27002

**ISO/IEC 27001:2022** specifies an **information security management system (ISMS)**: the governance process for managing security, covering context and scope, leadership, risk assessment and treatment, resourcing and competence, operation, performance evaluation, and continual improvement. Its distinguishing feature is that an accredited certification body can audit it and issue a certificate, which is why it is the common answer to international customers asking for proof.

Its Annex A lists 93 controls in four themes: organizational (37), people (8), physical (14), and technological (34). Organizations select applicable controls through risk assessment and document the reasoning in a **Statement of Applicability**, which is the artifact that says what is in scope and why anything was excluded.

**ISO/IEC 27002:2022** is the implementation guidance for those controls, and it is not certifiable on its own. Other members of the family extend it, including **27701** for privacy information management and **27017** and **27018** for cloud.

Two practical points. Certification covers a **defined scope**, so a certificate is only as meaningful as the scope statement behind it. And certification runs on a three-year cycle with annual surveillance audits, which makes it an ongoing commitment rather than a one-time project.

---

## CIS Critical Security Controls

The [CIS Controls](https://www.cisecurity.org/controls){:target="_blank" rel="noopener noreferrer"}, currently at **v8.1** (June 2024), are the most directly actionable of the frameworks: 18 controls broken into 153 **safeguards**, each written as something specific to do, ordered so that the earliest ones prevent the most common attacks. Control 1 is enterprise asset inventory and Control 2 is software inventory, because everything else depends on knowing what you have.

The distinctive idea is **Implementation Groups**, which are cumulative subsets of the safeguards rather than subsets of the controls:

| Group | Intended for | Safeguards |
|---|---|---|
| **IG1** | Every organization, described as essential cyber hygiene | 56 |
| **IG2** | Organizations with more complex IT and multiple risk profiles | IG1 plus 74 more |
| **IG3** | Organizations with dedicated security teams facing targeted attackers | All 153 |

Every implementation group spans all 18 controls. IG1 is not "controls 1 through 6". It is the subset of safeguards within each control that every organization should do. Reading the groups as blocks of controls instead produces a plan that skips asset management's harder safeguards while attempting advanced work elsewhere.

CIS Controls suit organizations that want to improve rather than to report, and they pair naturally with CSF, which supplies the governance and communication layer they lack.

---

## NIST Control Catalogs

**[SP 800-53](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final){:target="_blank" rel="noopener noreferrer"} Rev 5** is a comprehensive catalog of security and privacy controls, organized into 20 families identified by two-letter abbreviations (AC for access control, AU for audit and accountability, SC for system and communications protection, SI for system and information integrity, and so on). It is mandatory for US federal information systems and flows into FedRAMP for cloud services sold to them. NIST issues patch releases between revisions, and the catalog is at **release 5.2.0** (August 2025). Its depth is the point and also the cost: nobody implements all of it, and selection is driven by a system's categorization.

**[SP 800-171](https://csrc.nist.gov/pubs/sp/800/171/r3/final){:target="_blank" rel="noopener noreferrer"} Rev 3** (May 2024) covers protecting **controlled unclassified information (CUI)** on non-federal systems, which is what brings it to government contractors. Rev 3 restructured the requirements, which are now organized into 17 families, and realigned them with SP 800-53 Rev 5. Anyone who learned the Rev 2 structure should check current requirements against Rev 3 rather than working from memory.

**CMMC** is the US Department of Defense's verification program layered on top of 800-171. Its significance is that it replaces self-attestation with assessment for many contractors, with the level required set by the sensitivity of the information handled.

---

## MITRE ATT&CK

[ATT&CK](https://attack.mitre.org/){:target="_blank" rel="noopener noreferrer"} is not a control framework at all. It is a knowledge base of adversary tactics and techniques observed in real intrusions, maintained by MITRE and updated continuously. Its role in a program is measurement rather than prescription.

Three uses do most of the work:

- **Detection coverage.** Map existing detections to techniques to find which parts of an intrusion would currently go unnoticed. The gaps are usually in the middle of an attack, around credential access and lateral movement, rather than at initial access.
- **A common language.** Threat intelligence, detection engineering, and red teams all referring to the same technique identifiers removes a lot of ambiguity.
- **Exercise planning.** Purple team exercises pick techniques from the matrix, which makes "we tested our defenses" specific.

The trap is treating coverage percentage as a score. The matrix is large, techniques vary enormously in relevance, and full coverage is neither achievable nor useful. Coverage of the techniques used against your sector is the meaningful measure.

---

## Choosing and Combining

Start from obligations, then capability:

1. **Mandates decide first.** Federal systems mean 800-53. Defense contracts mean 800-171 and CMMC. Card data means PCI DSS. Those are not choices.
2. **Customer demand decides next.** International enterprise customers usually ask for ISO 27001; US technology buyers usually ask for SOC 2.
3. **With no external driver, choose by what you need.** An organization with little in place benefits most from CIS IG1, because it is a list of things to do. An organization needing to organize and report on an existing program benefits from CSF 2.0.
4. **Add ATT&CK once detection exists** to measure whether it works.

A reasonable common combination is CSF 2.0 for structure, CIS Controls for implementation, and ATT&CK for detection measurement, with ISO 27001 or SOC 2 added when a customer requires proof.

**Map controls once.** Every framework overlaps heavily with the others, and the way to avoid several parallel programs is a single internal control set mapped to each framework's requirements, so that one piece of evidence satisfies many. NIST publishes crosswalks between CSF and other frameworks through its [Cybersecurity and Privacy Reference Tool](https://csrc.nist.gov/projects/cprt){:target="_blank" rel="noopener noreferrer"}, and CIS publishes mappings from its safeguards to CSF, ISO 27001, and 800-53. Compliance automation platforms do the same mapping commercially.

Adopting a framework is also not a one-year project. Assess against it, prioritize the gaps by risk rather than by working through it in order, implement, measure, and reassess.

---

## Common Pitfalls

- **Treating frameworks as competitors.** They answer different questions, and most programs need two or three.
- **Reading CIS Implementation Groups as blocks of controls.** They are cumulative subsets of safeguards spanning all 18 controls.
- **Working from a superseded revision.** 800-171 Rev 3 restructured the requirements, CSF 2.0 added a Function, and 800-53 changes between revisions through patch releases.
- **Adopting a catalog wholesale.** Selection is driven by risk and categorization, and attempting everything produces shallow coverage everywhere.
- **Separate evidence per framework.** Map once to an internal control set, then report many ways.
- **Certificates without scope.** Both yours and your suppliers' certificates mean only what their scope statements say.
- **ATT&CK coverage as a percentage goal.** Cover what is used against you.
