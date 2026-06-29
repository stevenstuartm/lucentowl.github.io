---
title: "Threats and Vulnerabilities"
category: Security
description: "Explore threat actor classifications from script kiddies to nation-states, vulnerability management with CVE and CVSS, and risk assessment methodologies."
tags: [security, threats, vulnerabilities, owasp, practical, defense]
---

---

## Threat Actor Classifications

### Script Kiddies/Unskilled Attackers
- **Characteristics**: Limited technical knowledge, uses existing tools
- **Motivation**: Recognition, curiosity
- **Threat Level**: Low to moderate
- **Countermeasures**: Basic security controls often sufficient

### Hacktivists
- **Characteristics**: Moderate to high technical skill
- **Motivation**: Political/social activism
- **Methods**: Website defacement, DDoS attacks, data leaks
- **Notable Groups**: Anonymous, various national groups

### Organized Crime/Cybercriminals
- **Characteristics**: High technical skill, well-resourced
- **Motivation**: Financial gain
- **Methods**: Ransomware, financial fraud, identity theft
- **Evolution**: Ransomware-as-a-Service (RaaS) models

### Nation-State/Advanced Persistent Threats (APT)
- **Characteristics**: Highest skill level, state-sponsored
- **Motivation**: Espionage, strategic advantage, disruption
- **Methods**: Zero-day exploits, supply chain attacks
- **Timeline**: Long-term, persistent campaigns

### Insider Threats

- **Types**:
  - **Malicious**: Intentional harm by authorized users
  - **Negligent**: Accidental security breaches
  - **Compromised**: External actors using insider credentials
- **Detection**: User behavior analytics (UBA)

## Vulnerability Management

### Common Vulnerabilities and Exposures (CVE)
- **Purpose**: Standardized vulnerability identification
- **Format**: CVE-YYYY-NNNN (e.g., CVE-2024-1234)
- **Source**: [MITRE Corporation](https://cve.mitre.org/){:target="_blank" rel="noopener noreferrer"}
- **Usage**: Vulnerability scanners, patch management

### Common Vulnerability Scoring System (CVSS)

<div class="callout callout--warning">
<p class="callout__title">CVSS Scores Don't Tell the Whole Story</p>
<p>A CVSS 9.8 vulnerability in an internet-facing authentication service is more urgent than a CVSS 9.8 in an isolated internal system. Always consider environmental context when prioritizing remediation efforts.</p>
</div>

- **Score Range**: 0.0 (no risk) to 10.0 (critical)
- **Severity Ratings**:
  - **None**: 0.0
  - **Low**: 0.1-3.9
  - **Medium**: 4.0-6.9
  - **High**: 7.0-8.9
  - **Critical**: 9.0-10.0
- **Components**: Base, Temporal, Environmental metrics

### Common Weakness Enumeration (CWE)
- **Purpose**: Categorizes software vulnerabilities
- **Structure**: Hierarchical weakness taxonomy
- **Top 25**: Annual list of most dangerous software weaknesses
- **Integration**: Maps to CVE entries for root cause analysis

### Zero-Day Vulnerabilities

<div class="callout callout--note">
<p class="callout__title">The Zero-Day Window</p>
<p>Zero-day vulnerabilities are unknown to defenders, meaning there's no patch available. Once discovered and patched, they become "N-day" vulnerabilities. The most dangerous period is the "1-day" window immediately after patch release, when attackers race to exploit unpatched systems before defenders can apply updates.</p>
</div>

- **Definition**: Unknown vulnerabilities with no available patches
- **Timeline**:
  - **Zero-day**: Vulnerability unknown to defenders
  - **N-day**: Known vulnerability, patch available
  - **1-day**: Recently patched vulnerability
- **Detection**: Behavioral analysis, AI/ML systems

---