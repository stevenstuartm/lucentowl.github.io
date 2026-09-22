---
title: "Compliance and Governance"
layout: guide
category: Security
subcategory: Governance & Risk
description: "Governing security and proving it: risk assessment and treatment, qualitative and quantitative methods including annualized loss expectancy and FAIR, the risk register and risk appetite, the regulations that commonly apply (GDPR, HIPAA, PCI DSS, SOX, CCPA/CPRA) and their breach notification duties, attestations such as SOC 2 and ISO 27001 certification, audits and evidence, third-party risk, and continuous compliance."
tags: [practical, governance, risk-management, gdpr, pci-dss, soc-2, audit]
---

## Governance, Risk, and Compliance Are Different Jobs

The three words travel together and mean distinct things. **Governance** sets direction: who decides, what the organization's policies are, and how security investment is allocated against business priorities. **Risk management** identifies what could go wrong, how much it matters, and what to do about each one. **Compliance** demonstrates to an outside party, whether a regulator, a customer, or an auditor, that required controls exist and work.

Confusing compliance with security is the classic error and runs in both directions. An organization can pass an audit while being straightforward to breach, because audits sample controls against a standard rather than testing whether a determined attacker gets in. An organization can also be genuinely well defended and fail an audit because it cannot produce evidence. The two are related but neither one delivers the other.

Compliance is nonetheless useful beyond avoiding penalties. It creates deadlines and budget for work that otherwise loses to feature delivery, and it forces documentation of things that were only ever in someone's head.

---

## Risk Management

### Assessment

Risk assessment asks what could go wrong, how likely it is, and what it would cost. The process is consistent across frameworks:

1. **Identify assets** that matter, including data, systems, and business processes, with an owner for each.
2. **Identify threats** to them, informed by what actually happens to organizations like yours.
3. **Identify vulnerabilities**, meaning weaknesses those threats could exploit, technical and procedural.
4. **Analyze risk** by combining likelihood with impact.
5. **Treat the risk**, and record the decision.

Risk is expressed as the product of likelihood and impact, but the useful output is not a number. It is an ordering that decision-makers agree with, and an explicit statement of which risks the organization is choosing to live with.

### Qualitative and Quantitative

**Qualitative** assessment rates likelihood and impact on ordinal scales, usually plotted on a matrix. It is fast, works without historical data, and communicates well. Its weakness is that "high" means different things to different people, and the ratings cannot be added, averaged, or compared to cost.

**Quantitative** assessment puts money on it. The classic model computes **annualized loss expectancy**: single loss expectancy (the cost of one occurrence) multiplied by the annualized rate of occurrence. A control that costs less per year than the reduction in ALE pays for itself. The arithmetic is simple, and the difficulty is the inputs, since neither frequency nor loss is well known for rare events.

**[FAIR](https://www.fairinstitute.org/){:target="_blank" rel="noopener noreferrer"}** (Factor Analysis of Information Risk) is the most widely used quantitative framework. It decomposes risk into loss event frequency and loss magnitude, each further decomposed, and uses calibrated estimates expressed as ranges with confidence rather than single numbers, run through simulation to produce a loss distribution. Its value is that it forces assumptions into the open and produces output executives can compare against other business risks and against insurance.

Most organizations use qualitative assessment broadly and quantitative analysis for the few decisions where the investment is large enough to justify the effort.

### The Register and the Appetite

A **risk register** records each identified risk with its owner, its assessment, the treatment decision, the controls in place, and a review date. It is the artifact that makes risk management a process rather than an annual exercise, and it only works when risks are owned by the business leaders who can accept or fund them, not by the security team.

Every risk gets one of four treatments:

| Treatment | Meaning | Example |
|---|---|---|
| **Mitigate** | Reduce likelihood or impact with controls | Add MFA to reduce account takeover |
| **Transfer** | Shift financial consequence to another party | Cyber insurance, or contractual liability |
| **Avoid** | Stop doing the thing that creates the risk | Discontinue a product feature that stores card data |
| **Accept** | Consciously bear it | Accept the residual risk of a legacy system scheduled for replacement |

Transfer moves cost, not responsibility: an insurer pays out, but the organization still suffers the breach, and outsourcing to a provider does not outsource accountability.

**Risk appetite** is the statement of how much risk leadership will accept, and it is what turns acceptance from an individual decision into a governed one. Without it, "accepted" often means "nobody wanted to pay for the fix", recorded nowhere. Acceptances need an owner senior enough to carry the consequence, a stated reason, and an expiry date.

---

## Regulations and Standards That Commonly Apply

Which obligations apply depends on where you operate, whose data you hold, and what industry you are in. The common ones:

| Regime | Applies to | Core obligations | Breach notification |
|---|---|---|---|
| **GDPR** | Organizations established in the EU, and those elsewhere that offer goods or services to, or monitor, people in the EU | Lawful basis, data minimization, data subject rights, privacy by design, DPO in some cases | 72 hours to the supervisory authority from becoming aware, where a risk to individuals exists; to affected individuals without undue delay where the risk is high |
| **HIPAA** | US healthcare providers, plans, clearinghouses, and their business associates | Administrative, physical, and technical safeguards for protected health information; business associate agreements | Individuals and HHS within 60 days of discovery; large breaches also require media notice |
| **PCI DSS** | Anyone storing, processing, or transmitting payment card data | 12 requirement areas covering network security, protection of cardholder data, vulnerability management, access control, monitoring, and policy | Contractual: notify the acquirer and card brands promptly, per brand rules rather than statute |
| **SOX** | US public companies | Internal control over financial reporting, which pulls in access control, change management, and audit trails for financial systems | Not a breach regime |
| **CCPA/CPRA** | Businesses meeting thresholds that handle California residents' personal information | Disclosure, deletion, correction, opt-out of sale or sharing | No fixed statutory deadline; notice without unreasonable delay |

Two points are commonly got wrong. GDPR is about where people are, not their citizenship, so a US company serving people in the EU is in scope. And its 72-hour clock starts when the organization becomes aware of the breach, not when the investigation concludes, which is why legal counsel is engaged during the incident rather than after it.

PCI DSS deserves a note on currency: the active version is **v4.0.1**, a limited revision published in 2024, and the 51 requirements that were "future-dated" as best practices became mandatory on 31 March 2025. The most effective PCI strategy is usually scope reduction, since tokenization and provider-hosted payment pages remove card data from the environment and take systems out of assessment scope entirely.

Sector and regional regimes layer on top: DORA and NIS2 in the EU, GLBA for US financial institutions, FISMA and FedRAMP for US federal systems and their cloud providers, CMMC for defense contractors, and a growing number of state and national privacy laws.

---

## Attestations and Certifications

Customers increasingly ask for proof before signing, and two artifacts dominate.

**SOC 2** is an attestation report produced by a CPA firm against the AICPA Trust Services Criteria. Its categories are Security, Availability, Processing Integrity, Confidentiality, and Privacy, and only **Security**, the common criteria, is required. The others are included when the business model or customer commitments justify them. A **Type I** report assesses whether controls are suitably designed at a point in time; a **Type II** report assesses whether they operated effectively over a period, usually 3 to 12 months, and it is the one customers generally want. SOC 2 is not a certification and not a pass or fail: the report contains the auditor's opinion plus any exceptions found, and reading the exceptions is the point.

**ISO/IEC 27001** is a certifiable standard for an information security management system, audited by an accredited certification body. Certification covers a defined scope and runs on a three-year cycle with surveillance audits in between. Because it certifies the management system rather than a fixed control set, the scope statement matters enormously: a certificate covering one product line says nothing about the rest of the company.

The two overlap heavily in practice, and organizations serving both US and international customers often pursue both, mapping controls once and producing evidence for each.

---

## Audits and Evidence

An audit tests whether controls exist and operate, following a predictable sequence: planning and scoping, evidence collection and testing, reporting of findings, and remediation tracking.

What separates a smooth audit from a painful one is evidence that is produced as a byproduct of working, rather than assembled for the auditor. An access review that happens quarterly in a tool that records approvals is evidence. The same review done in a spreadsheet the week before the audit is a reconstruction, and auditors recognize the difference.

Practical evidence hygiene:

- **Automate collection.** Compliance automation platforms pull configuration and control state continuously from cloud accounts, identity providers, and endpoints, replacing screenshots.
- **Keep policies current and approved.** Policies dated several years ago, or policies describing practices the organization abandoned, are common findings.
- **Track findings to closure** with owners and dates, in the same place other security work lives.
- **Watch scope.** What is in scope determines what is tested, and a narrow scope produces a clean report that means less than it appears to.

---

## Third-Party Risk

Most organizations' data sits in other organizations' systems, and a supplier's breach is the customer's incident. Third-party risk management assesses suppliers before onboarding, proportionate to what they will access, and continues after signing.

Useful practice: tier suppliers by the data and access they have, ask for existing attestations rather than sending an identical questionnaire to everyone, and put the substantive requirements in the contract, including security obligations, breach notification timelines to you, audit rights, subcontractor disclosure, and what happens to data at termination. Concentration risk deserves separate attention, since many suppliers depend on the same few cloud and identity providers.

---

## Continuous Compliance

Point-in-time assessment says a system was compliant on one day. Configuration drifts immediately afterward. Continuous compliance monitors control state and alerts on deviation, using the same tooling that provides cloud posture management, and it also produces the audit evidence as a side effect.

The stronger version prevents drift rather than reporting it, expressing requirements as policy enforced in the platform and in deployment pipelines, so that a non-compliant configuration cannot be deployed at all. That turns a control from something checked quarterly into something that cannot be violated without a deliberate exception.

---

## Common Pitfalls

- **Treating the audit as the goal.** Controls designed to pass sampling rather than to stop attacks.
- **The security team owning the risk register.** Risks belong to the business owners who can accept or fund them.
- **Acceptances with no expiry or owner.** A risk accepted once quietly becomes permanent.
- **Precision without accuracy in quantitative risk.** A loss figure to two decimal places built on invented inputs. Use ranges and state assumptions.
- **Evidence assembled retroactively.** Expensive, stressful, and a signal to auditors to look harder.
- **Questionnaires as third-party risk management.** A completed spreadsheet is a claim, not a control.
- **Compliance scope mistaken for security scope.** Systems outside the audit boundary are still attacked.
