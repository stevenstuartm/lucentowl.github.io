---
title: "Security Testing"
layout: guide
category: Security
subcategory: Application Security
description: "Finding weaknesses in your own software before attackers do: what SAST, DAST, IAST, SCA, secret scanning, and fuzzing each catch and miss, manual code and configuration review, penetration testing engagements and their types, red and purple team exercises, bug bounty and disclosure programs, and how to handle findings without drowning in false positives."
tags: [practical, sast, dast, penetration-testing, red-team, bug-bounty, sca]
---

## No Single Test Finds Everything

Each testing technique sees the system from one angle and is blind from the others. A static analyzer reads code but does not know which parts are reachable in production. A dynamic scanner exercises the running application but cannot see the code path that only a specific configuration reaches. Neither understands that a discount can be applied twice, or that a support tool exposes every customer's address, because nothing in the code looks wrong. Those need a person who understands the business.

A useful way to sort the techniques is by what they need in order to run, and therefore when they can run.

| Technique | Needs | Finds | Misses |
|---|---|---|---|
| **SAST** | Source code | Injection, unsafe APIs, hardcoded secrets, bad crypto usage | Runtime and configuration issues, business logic; produces false positives |
| **SCA** | Dependency manifests | Known vulnerabilities and licensing issues in libraries | Flaws in your own code; may flag vulnerabilities in unreachable code |
| **Secret scanning** | Source and history | Committed credentials, keys, tokens | Secrets that never touched the repository |
| **DAST** | A running application | Reflected inputs, missing headers, misconfiguration, some injection | Code paths it cannot reach; needs authentication set up to see much |
| **IAST** | Instrumented running application plus tests | Injection and data flow issues with runtime context, few false positives | Only what the tests exercise; adds runtime overhead |
| **Fuzzing** | A target interface or parser | Crashes, memory safety bugs, unhandled input | Logic flaws; needs time and a good corpus |
| **Manual review and testing** | People and time | Business logic, authorization design, chained weaknesses | Scales poorly; depends on the tester |

### Static Analysis

SAST analyzes source or compiled code without running it, tracing how untrusted input flows into dangerous operations. It runs earliest, in the editor or on every commit, which makes it the cheapest place to catch a whole class of coding flaws.

Its weakness is context. A finding that user input reaches a query builder may be true and harmless because a framework escapes it, and the analyzer cannot tell. High false-positive rates are the main reason SAST deployments fail: developers stop reading the output. Tuning the ruleset to the stack, suppressing categories that do not apply with a recorded reason, and failing builds only on high-confidence rules keeps it credible.

### Software Composition Analysis

Most of the code in an application was written by someone else. SCA inventories direct and transitive dependencies, matches them against vulnerability databases, and reports what is affected. It is the practical answer to a supply chain failure being one of the most common breach paths.

Two qualities separate a useful SCA deployment from noise. **Reachability analysis** distinguishes a vulnerable function the application actually calls from a vulnerable package it merely includes, which removes a large share of the work. And output has to feed a prioritization process rather than a list, since a scan of a mature application returns more findings than anyone can patch at once.

### Dynamic Analysis

DAST attacks a running application from the outside, with no knowledge of the code. It sees what an attacker sees, including deployment and configuration problems that never appear in source: missing security headers, verbose errors, exposed admin interfaces, outdated servers.

Scanners are only as good as their coverage. A scanner that cannot log in tests the login page and little else, so authenticated scanning with test credentials, and a crawl seeded from an API specification or recorded traffic, are what make results meaningful. DAST also runs against a deployed environment, so it finds problems later than SAST and against environments that must tolerate being attacked.

### Interactive Analysis

IAST instruments the running application with an agent that watches data flow during functional or automated tests. Because it observes actual execution, it confirms exploitability and produces far fewer false positives than SAST, with a precise location in the code. Its coverage equals the coverage of the tests that drive it, and the agent's overhead means it usually runs in test environments rather than production.

### Testing in the Pipeline

Automated tests belong in continuous integration, with fast, high-confidence checks (secret scanning, SCA, targeted SAST rules) blocking merges, and slower ones (full SAST, DAST against a deployed environment) running on a schedule or before release. The pipeline design, gating policy, and the culture that makes it work are the subject of DevSecOps practice.

---

## Manual Testing

Tools find known patterns. People find the rest.

**Secure code review** by a person, focused on security-relevant areas rather than every line, catches what analyzers cannot express: authorization decisions, trust assumptions between components, cryptographic design, and the handling of error paths. It is most valuable on new authentication, authorization, payment, and data export code.

**Configuration and architecture review** examines deployed settings and design rather than code: cloud permissions, network exposure, storage access policies, secrets handling, and whether the design matches what was threat modeled.

**Business logic testing** is the category tools miss entirely, because nothing is malformed. Examples are applying a coupon twice by racing two requests, skipping a payment step by navigating directly to the confirmation endpoint, changing a quantity to a negative number to produce a refund, and using a legitimate export feature to extract more data than intended.

---

## Penetration Testing

A penetration test is an authorized simulated attack against a defined scope, run to find and demonstrate exploitable weaknesses. What separates it from scanning is a person chaining findings together: a low-severity information leak plus a weak password policy plus an over-privileged service account becomes domain compromise, which no individual finding would have shown.

Tests vary by how much the tester is told:

| Type | Tester knowledge | Trade-off |
|---|---|---|
| **Black box** | Nothing beyond what is public | Realistic starting point, but time goes into reconnaissance rather than depth |
| **Grey box** | Credentials and limited documentation | The common choice: realistic, with time spent on the application rather than on finding it |
| **White box** | Full documentation, source, and architecture | Deepest coverage per hour; less like an external attacker's view |

A test is defined by its rules of engagement: scope (which systems, which environments), timing, permitted techniques (is social engineering in scope? denial of service?), data handling, escalation contacts, and written authorization. Testing production requires explicit acceptance of the risk of disruption, and testing systems hosted by a cloud provider follows that provider's policy.

Methodologies exist so that coverage is systematic rather than a matter of the tester's habits. The [OWASP Web Security Testing Guide](https://owasp.org/www-project-web-security-testing-guide/){:target="_blank" rel="noopener noreferrer"} covers web applications, the [Penetration Testing Execution Standard](http://www.pentest-standard.org/index.php/Main_Page){:target="_blank" rel="noopener noreferrer"} covers engagement structure, and [NIST SP 800-115](https://csrc.nist.gov/pubs/sp/800/115/final){:target="_blank" rel="noopener noreferrer"} covers technical assessment more broadly.

The deliverable that matters is the report: each finding with its severity, its business impact, evidence reproducing it, and a specific remediation. A retest after fixes confirms the fix and catches the common case where a patch addresses the proof of concept rather than the underlying flaw.

### Red, Blue, and Purple

A **red team** exercise differs from a penetration test in goal and constraint. Rather than finding as many vulnerabilities as possible in a scope, it pursues a specific objective, such as reaching customer data, while avoiding detection. The subject under test is as much the **blue team**, the defenders, as the technology: did anyone notice, how quickly, and what did they do?

A **purple team** exercise drops the secrecy. Attackers and defenders work together, running known techniques (often chosen from ATT&CK) while the defenders watch whether their tooling detects each one, tuning as they go. It produces improvement faster than an adversarial exercise because feedback is immediate, and it is usually the better choice until detection coverage is mature enough for a red team to be informative.

---

## Bug Bounty and Disclosure

Whatever an organization tests, outsiders will also find things. Two programs handle that.

A **vulnerability disclosure policy (VDP)** publishes how to report a security issue, what is in scope, and a commitment not to pursue legal action against good-faith researchers. It costs little and prevents the worst outcome: someone finds a serious flaw, cannot find anyone to tell, and discloses it publicly or sells it.

A **bug bounty program** adds payment for valid findings, scaled to severity. It provides continuous testing by many people with varied skills, and costs are tied to results. It is not a substitute for internal testing, because researchers concentrate on what is externally reachable and rewarded, and a program launched before the obvious issues are fixed generates expensive duplicate reports and a triage burden the team cannot absorb.

---

## Handling Findings

Testing produces findings, and findings are only valuable once they are fixed.

- **Deduplicate and correlate.** The same flaw arrives from SAST, DAST, and a pentest with different names and severities. A single tracking place prevents three separate half-fixes.
- **Prioritize by exploitability and impact**, not by the scanner's severity label. An internal-only medium finding on a system holding regulated data may outrank an internet-facing one on a static marketing site.
- **Fix the class, not the instance.** One SQL injection found by a test usually means the pattern exists elsewhere. Search for it, and add a rule or a shared helper that prevents its return.
- **Track exceptions explicitly.** A finding that will not be fixed needs a stated reason, an owner, and a review date.
- **Measure time to remediate**, by severity. It is the number that shows whether testing is producing change or paperwork.

---

## Common Pitfalls

- **Scanning as the whole program.** Automated tools find known patterns. Authorization and business logic flaws, which cause the most damaging breaches, need people.
- **Ignoring tool output.** An unfiltered SAST feed trains developers to dismiss findings. Tune aggressively so that what remains gets read.
- **Unauthenticated scanning only.** Most of an application sits behind login.
- **Testing once a year for compliance.** An annual test describes a system that has changed hundreds of times since.
- **A pentest report as the deliverable.** Value comes from fixes and retests, not from the document.
- **Bug bounty before basics.** Paying outsiders to find what a scanner would have found is expensive.
