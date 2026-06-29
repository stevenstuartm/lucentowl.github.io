---
title: "Data Protection"
category: Security
description: "Comprehensive coverage of data classification, encryption for data at rest/in transit/in use, privacy regulations like GDPR and HIPAA, and data loss prevention strategies."
tags: [security, encryption, data-protection, privacy, compliance]
---

---

## Data Classification

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Government Classifications</h4>
<ul>
<li><strong>Unclassified</strong>: General information</li>
<li><strong>Confidential</strong>: Could reasonably damage national security</li>
<li><strong>Secret</strong>: Could seriously damage national security</li>
<li><strong>Top Secret</strong>: Could gravely damage national security</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Private Sector Classifications</h4>
<ul>
<li><strong>Public</strong>: Freely available information</li>
<li><strong>Internal</strong>: Restricted to organization members</li>
<li><strong>Confidential</strong>: Limited access, business sensitive</li>
<li><strong>Restricted</strong>: Highly sensitive, strict access controls</li>
</ul>
</div>
</div>

## Data States and Protection

<div class="callout callout--note">
<p class="callout__title">Protect Data in All Three States</p>
<p>Comprehensive data protection requires encryption and controls across all three states: at rest (stored data), in transit (moving data), and in use (active processing). Each state presents unique challenges and requires specific security measures.</p>
</div>

### Data at Rest
- **Full Disk Encryption**: Transparent disk-level protection
- **Database Encryption**: Column-level or transparent encryption
- **File-Level Encryption**: Selective file protection
- **Key Management**: Secure key storage and rotation

### Data in Transit
- **TLS/SSL**: Web traffic encryption
- **VPN**: Network-level encryption
- **Email Encryption**: PGP, S/MIME
- **API Security**: Authentication and encryption

### Data in Use
- **Application-Level Encryption**: Process memory protection
- **Secure Enclaves**: Hardware-protected execution
- **Homomorphic Encryption**: Computing on encrypted data
- **Access Controls**: Runtime permission enforcement

## Privacy Regulations

### General Data Protection Regulation (GDPR)
- **Scope**: EU citizens' personal data globally
- **Key Requirements**:
  - Lawful basis for processing
  - Data minimization principle
  - Right to be forgotten
  - Breach notification (72 hours)
  - Privacy by design
- **Penalties**: Up to 4% of annual revenue or €20 million

<div class="callout callout--warning">
<p class="callout__title">GDPR Has Global Reach</p>
<p>GDPR applies to any organization processing EU citizens' personal data, regardless of where the organization is located. If you have EU customers, you must comply with GDPR or face significant penalties.</p>
</div>

### Health Insurance Portability and Accountability Act (HIPAA)
- **Scope**: Protected Health Information (PHI) in US
- **Key Requirements**:
  - Administrative, physical, technical safeguards
  - Business associate agreements
  - Patient rights and access
  - Breach notification
- **Enforcement**: HHS Office for Civil Rights

### California Consumer Privacy Act (CCPA/CPRA)
- **Scope**: California residents' personal information
- **Rights**: Know, delete, correct, portability, opt-out
- **Business Requirements**: Privacy policies, data mapping
- **Enforcement**: California Privacy Protection Agency

## Data Loss Prevention (DLP)

### DLP Types
- **Network DLP**: Monitor data in transit
- **Endpoint DLP**: Control data on devices
- **Storage DLP**: Protect data at rest
- **Cloud DLP**: SaaS and cloud storage protection

### Implementation Strategy
- **Data Discovery**: Identify sensitive data locations
- **Classification**: Label data by sensitivity
- **Policy Creation**: Define protection rules
- **Monitoring**: Detect policy violations
- **Response**: Block, alert, or quarantine violations

---