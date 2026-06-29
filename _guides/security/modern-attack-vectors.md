---
title: "Modern Attack Vectors"
category: Security
description: "Understand contemporary cyber threats including social engineering, phishing variants, injection attacks, advanced persistent threats, and ransomware with prevention strategies."
tags: [security, threats, modern, attack-vectors, defense]
---

---

## Social Engineering

### Psychological Triggers
- **Authority**: Impersonating figures of authority
- **Urgency**: Creating false time pressure
- **Social Proof**: "Everyone else is doing it"
- **Scarcity**: Limited-time offers or exclusive access
- **Likability**: Building rapport and trust
- **Fear**: Threatening negative consequences

### Attack Techniques

#### Phishing Variants
- **Traditional Phishing**: Mass email campaigns
- **Spear Phishing**: Targeted attacks on specific individuals
- **Whaling**: Targeting high-value executives
- **Business Email Compromise (BEC)**: Internal email account compromise
- **Vishing**: Voice-based phishing (phone calls)
- **Smishing**: SMS-based phishing

#### Advanced Impersonation
- **Brand Impersonation**: Mimicking trusted organizations
- **Typosquatting**: Registering similar domain names
- **Deepfakes**: AI-generated audio/video content
- **AI-Enhanced Attacks**: Personalized, contextually-aware attacks

#### Watering Hole Attacks
- **Method**: Compromise websites frequented by targets
- **Target**: Specific organizations or user groups
- **Payload**: Drive-by downloads, credential harvesting

## Technical Attacks

### Injection Attacks

#### SQL Injection

<div class="callout callout--warning">
<p class="callout__title">SQL Injection Remains a Top Threat</p>
<p>Despite being well-understood for decades, SQL injection continues to be a leading attack vector. Always use parameterized queries or prepared statements. Never concatenate user input directly into SQL commands.</p>
</div>

- **Mechanism**: Malicious SQL code in user inputs
- **Impact**: Database compromise, data exfiltration
- **Prevention**:
  - Parameterized queries/prepared statements
  - Input validation and sanitization
  - Least privilege database accounts
  - Web Application Firewalls (WAF)

#### Cross-Site Scripting (XSS)
- **Types**:
  - **Reflected XSS**: Malicious script in URL parameters
  - **Stored XSS**: Persistent malicious scripts in database
  - **DOM-based XSS**: Client-side script manipulation
- **Prevention**:
  - Input validation and output encoding
  - Content Security Policy (CSP)
  - Secure coding practices

#### Command Injection
- **Mechanism**: Executing system commands through application inputs
- **Prevention**: Input validation, secure API usage, sandboxing

### Network Attacks

#### Man-in-the-Middle (MitM)
- **Variants**:
  - **Wi-Fi Eavesdropping**: Fake access points
  - **SSL/TLS Hijacking**: Certificate manipulation
  - **ARP Poisoning**: Local network manipulation
  - **DNS Spoofing**: Redirecting domain resolution
- **Prevention**: Strong encryption, certificate pinning, VPNs

#### Denial of Service (DoS/DDoS)
- **Types**:
  - **Volumetric**: Overwhelming bandwidth
  - **Protocol**: Exploiting network protocol weaknesses
  - **Application Layer**: Targeting specific services
- **Mitigation**:
  - Rate limiting
  - Content Delivery Networks (CDN)
  - DDoS protection services
  - Network segmentation

### Advanced Persistent Threats (APT)

#### Characteristics
- **Stealth**: Avoiding detection for extended periods
- **Persistence**: Maintaining access through system changes
- **Reconnaissance**: Extensive target information gathering
- **Lateral Movement**: Spreading through internal networks

#### Tactics, Techniques, and Procedures (TTPs)
- **Initial Access**: Phishing, supply chain, zero-day exploits
- **Execution**: PowerShell, scripting, living-off-the-land
- **Persistence**: Registry modification, scheduled tasks
- **Privilege Escalation**: Vulnerability exploitation, credential theft
- **Defense Evasion**: Anti-forensics, encryption, legitimate tools
- **Credential Access**: Password attacks, keylogging
- **Discovery**: Network scanning, system enumeration
- **Lateral Movement**: Remote services, internal spear phishing
- **Collection**: Screen capture, data staging
- **Exfiltration**: Encrypted channels, legitimate services

---