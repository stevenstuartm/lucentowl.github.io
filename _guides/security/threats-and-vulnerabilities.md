---
title: "Vulnerability Management"
layout: guide
category: Security
subcategory: Security Operations
description: "Tracking and fixing known weaknesses at scale: how CVE, CWE, CVSS v4.0, EPSS, and CISA's KEV catalog fit together, why severity alone is the wrong prioritization signal, discovering vulnerabilities across code, dependencies, infrastructure, and cloud, SBOMs and supply chain risk, patch windows and remediation SLAs, exceptions and compensating controls, and zero-day response."
tags: [practical, cvss, epss, kev, patch-management, sbom, vulnerability-scanning]
---

## The Problem Is Prioritization

A mature organization's scanners will report more vulnerabilities than it can ever fix. Tens of thousands of findings across servers, containers, dependencies, and cloud configuration is normal, and the backlog grows faster than any team patches. The work is therefore not "fix all vulnerabilities". It is deciding, continuously, which few actually matter, fixing those quickly, and having a defensible answer for the rest.

That makes vulnerability management a process rather than a tool: discover what you have, find what is wrong with it, decide what to do first, fix it, and confirm the fix. Each step has a way of failing quietly, and the most common is a scanner that reports faithfully into a backlog nobody triages.

---

## The Vocabulary

These systems appear on every finding, and they answer different questions.

| System | Run by | Answers |
|---|---|---|
| **CVE** | CVE Program, coordinated by MITRE and sponsored by CISA | Which specific vulnerability is this? |
| **CWE** | MITRE | What kind of weakness caused it? |
| **CVSS** | FIRST | How severe is it, intrinsically? |
| **EPSS** | FIRST | How likely is it to be exploited soon? |
| **KEV** | CISA | Is it being exploited right now? |

### CVE and CWE

A **CVE identifier** (`CVE-2026-1234`, where the sequence number can be four digits or more) names one vulnerability in one product, so that scanners, vendors, and advisories can refer to the same thing. Records are published by CVE Numbering Authorities, and the program's own site is [cve.org](https://www.cve.org/){:target="_blank" rel="noopener noreferrer"}.

A **CWE identifier** names the underlying weakness class, such as CWE-89 for SQL injection. CVEs map to CWEs, which is what makes it possible to ask a useful question: are our vulnerabilities recurring because of one weakness we keep reintroducing? The [CWE Top 25](https://cwe.mitre.org/top25/){:target="_blank" rel="noopener noreferrer"} lists the most dangerous classes each year and is a better input to developer training than any list of individual CVEs.

### CVSS

[CVSS v4.0](https://www.first.org/cvss/v4.0/specification-document){:target="_blank" rel="noopener noreferrer"} scores severity from 0.0 to 10.0, banded as None (0.0), Low (0.1-3.9), Medium (4.0-6.9), High (7.0-8.9), and Critical (9.0-10.0). It has four metric groups:

- **Base**: intrinsic characteristics that do not change, such as attack vector and the impact of exploitation.
- **Threat**: characteristics that change over time, principally exploit maturity. This group replaced v3's Temporal metrics.
- **Environmental**: the specific deployment, letting a consumer adjust for their own context.
- **Supplemental**: extra context, such as automatable exploitation or safety impact, which does not change the score.

v4.0 also introduced explicit nomenclature, because the number alone hides which groups were used: **CVSS-B** is base only, **CVSS-BT** adds threat, and **CVSS-BTE** adds environmental. Almost every score published in an advisory or scanner is CVSS-B, which is precisely the version that says nothing about your environment or about whether anyone is exploiting it.

### EPSS and KEV

**EPSS** estimates the probability that a CVE will be exploited in the wild in the next 30 days, as a value between 0 and 1, updated daily from real-world exploitation data. It answers the question CVSS cannot: of the thousands of high-severity vulnerabilities, which ones are attackers likely to actually use? Most CVEs score very low, and that is the point, since it lets a team defer the large majority with evidence.

**CISA's [Known Exploited Vulnerabilities catalog](https://www.cisa.gov/known-exploited-vulnerabilities-catalog){:target="_blank" rel="noopener noreferrer"}** is not a prediction. It lists vulnerabilities with confirmed active exploitation. Anything in KEV that exists in your environment is an emergency regardless of its CVSS score.

Used together the three answer different halves of the question: CVSS says how bad it would be, EPSS says how likely it is, and KEV says it is already happening.

---

## Prioritizing

Severity-only prioritization ("fix all criticals in 30 days") is the standard policy and the standard failure. It produces a queue ordered by a number that knows nothing about whether the affected system is reachable, whether the vulnerable function is used, or whether anyone has ever exploited it. Teams work hard and remain exposed on the few things that mattered.

Better prioritization combines four inputs:

1. **Is it being exploited?** KEV membership or a high EPSS score moves it to the front.
2. **Is it reachable?** An internet-facing system, or a vulnerable library function the application actually calls, outranks something behind three layers of network control or never loaded at run time.
3. **What would it reach?** A vulnerability on a system holding regulated data or holding credentials for other systems outranks one on an isolated test box.
4. **How bad is exploitation?** CVSS base impact, adjusted for the environment.

US federal practice moved in exactly this direction. [BOD 26-04](https://www.cisa.gov/news-events/directives/bod-26-04-prioritizing-security-updates-based-risk){:target="_blank" rel="noopener noreferrer"}, issued in June 2026, superseded the older directives that had set uniform clocks by severity (BOD 19-02) and by KEV listing (BOD 22-01). It drops CVSS as the required input and instead derives the remediation window from four factors: whether the asset is publicly exposed, whether the vulnerability is in KEV, whether exploitation can be automated, and how much control exploitation grants. The highest-risk combinations carry a window of three days. The reasoning transfers to private organizations even though the directive does not apply to them.

---

## Discovery

You cannot patch what you do not know you run, so asset inventory is the foundation, and gaps in it are where unpatched systems hide. Different scanners cover different parts of the estate:

| Scope | What it examines |
|---|---|
| **Network and host** | Operating systems, services, and installed software, authenticated where possible for accuracy |
| **Dependencies (SCA)** | Libraries and transitive dependencies against vulnerability databases |
| **Containers** | Image layers, base images, and packages, in the registry and at run time |
| **Infrastructure as code and cloud** | Misconfiguration before deployment and drift afterward |
| **Web application (DAST)** | The running application from the outside |
| **External attack surface** | Internet-facing assets discovered from outside, including ones nobody registered |

External attack surface discovery deserves particular attention, because the systems most likely to be exploited are the ones nobody remembers owning: a forgotten staging environment, a marketing subdomain, an appliance installed for a project that ended.

Authenticated scanning matters too. An unauthenticated scan infers software versions from banners and misses most of what is installed, which produces both false negatives and false positives.

### SBOM and Supply Chain

A **software bill of materials** lists the components in a piece of software, in a standard format such as SPDX or CycloneDX. Its value shows up the day a widely used library turns out to be critically vulnerable: organizations with SBOMs answer "where do we run this?" in minutes, and organizations without them spend days grepping repositories and asking vendors.

SBOMs cover what you build and, increasingly through procurement requirements, what you buy. They are an input to vulnerability management rather than an answer on their own, since a component list only becomes actionable when it is continuously matched against new advisories.

---

## Remediation

**Patching** is the primary fix, and the practical constraints are testing and downtime. Patches occasionally break things, so a change process with staged rollout (test, then a canary group, then the fleet) and a rollback plan is what keeps patching fast rather than cautious. Automating the routine cases, such as operating system updates on standard builds and dependency bumps through pull requests, is what frees attention for the ones that need judgment.

**Remediation targets** turn prioritization into commitments. The specific numbers matter less than being risk-based, achievable, and measured:

| Tier | Example target |
|---|---|
| Actively exploited (KEV) or exploited internet-facing | Emergency: hours to a few days |
| High risk by combined signals | Days to two weeks |
| Moderate | Within the normal patch cycle |
| Low or unreachable | Next scheduled upgrade, or accept |

**Compensating controls** are what you use when patching is impossible or slow: a virtual patch in a WAF or IPS, disabling the vulnerable feature, removing network exposure, or increasing monitoring around the asset. They reduce exposure without fixing the flaw, so they come with a date to revisit.

**Exceptions** are legitimate and need to be explicit. A recorded exception names the vulnerability, the reason, the compensating controls, the risk owner who accepted it, and an expiry date. Exceptions without expiry dates are how a temporary decision becomes permanent exposure.

---

## Zero-Day and Emerging Vulnerability Response

Some vulnerabilities arrive faster than any monthly cycle can absorb: a critical flaw in widely deployed software, exploited within hours of disclosure, with no patch yet available. The response is a rehearsed process rather than an improvisation:

1. **Determine exposure.** Asset inventory and SBOM answer where the affected software runs, including in products and appliances you did not build.
2. **Reduce exposure now.** Take the system off the internet, disable the feature, apply vendor workarounds, or add detection if nothing else is possible.
3. **Hunt for prior compromise.** For anything exploited before the patch, assume it may already have happened and look for the indicators the vendor and researchers publish.
4. **Patch when available**, then verify by rescanning rather than by trusting the deployment.
5. **Communicate** to stakeholders with an assessment of exposure, not just a copy of the advisory.

The period right after a patch is published is also dangerous for everyone who has not applied it, because the patch itself reveals where the flaw is and mass scanning begins quickly.

---

## Measuring the Program

A few measures show whether the process works, and they are more useful than counting open findings:

- **Time to remediate**, by risk tier, which shows whether the targets hold in practice.
- **Coverage**: what fraction of assets is scanned, and how recently. Unscanned assets are unmeasured risk.
- **Backlog trend and age distribution**, which show whether the program is keeping pace or accumulating.
- **Exception count and age**, which show whether exceptions are a tool or an escape.
- **Recurrence by CWE**, which turns individual findings into a case for fixing a class of weakness in development.

---

## Common Pitfalls

- **Prioritizing by CVSS alone.** The published score is base-only and ignores exploitation and your environment.
- **Scanning without triage.** A scanner nobody acts on produces compliance evidence and no security.
- **Unauthenticated scans presented as coverage.** They see a fraction of what is installed.
- **Inventory gaps.** Forgotten internet-facing systems are a leading source of breaches, and no scan schedule reaches assets nobody listed.
- **Exceptions without expiry.** Deferral becomes permanent silently.
- **Patching servers only.** Network appliances, hypervisors, container base images, developer laptops, and third-party software all run vulnerable code.
- **Assuming a patch fixed it.** Rescan and verify, since incomplete rollouts and services that were never restarted are common.
