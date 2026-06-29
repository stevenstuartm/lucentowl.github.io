---
title: "Security Foundations"
category: Security
description: "Master fundamental security concepts including the CIA triad, defense-in-depth principles, trust models, and security-by-design practices for building secure systems."
tags: [security, fundamentals, cia-triad, defense-in-depth, zero-trust, practical]
---

## CIA Triad

The foundational framework for information security:

### Confidentiality
Data accessible only to authorized parties.

**Implementation:**
- Encryption (at rest and in transit)
- Access controls and authentication
- Data classification policies

**Example:** Patient medical records encrypted and accessible only to authorized healthcare providers.

### Integrity
Data remains accurate, complete, and unaltered.

**Implementation:**
- Cryptographic hashing
- Digital signatures
- Version control and audit logs
- Input validation

**Example:** Financial transaction records with checksums preventing unauthorized modifications.

### Availability
Systems and data accessible when needed by authorized users.

**Implementation:**
- Redundancy and failover systems
- DDoS protection
- Disaster recovery plans
- Load balancing

**Example:** Banking systems with 99.99% uptime through multi-region deployment.

### Extended Framework (NAAA)

**Non-repudiation:** Proof of action that cannot be denied (digital signatures, audit logs)

**Authentication:** Identity verification (passwords, biometrics, certificates)

**Authorization:** Permission determination (RBAC, ABAC, ACLs)

**Accounting/Audit:** Activity tracking and compliance monitoring

---

## Security Principles

### Least Privilege

<div class="callout callout--warning">
<p class="callout__title">Over-Privileged Accounts Are Security Time Bombs</p>
<p>When every service runs as admin and every user has more permissions than needed, a single compromise can cascade into complete system takeover. Grant minimum necessary access for each job function.</p>
</div>

Grant minimum necessary access for job function.

**Application:**
```csharp
// Bad: Over-privileged service account
connectionString = "Server=db;User=sa;Password=pass;";

// Good: Scoped permissions
connectionString = "Server=db;User=app_reader;Password=pass;";
// app_reader has SELECT only on specific tables
```

**Modern Implementation:**
- Just-in-time (JIT) access elevation
- Role-based access control (RBAC)
- Attribute-based access control (ABAC)
- Periodic access reviews

### Separation of Privilege
Require multiple conditions for critical actions.

**Examples:**
- Multi-factor authentication (knowledge + possession + biometric)
- Dual approval for financial transactions
- Segregation of duties (developer ≠ deployer)

### Defense in Depth
Layer multiple security controls so failure of one doesn't compromise the system.

**Layers:**
1. **Perimeter:** Firewalls, VPN
2. **Network:** IDS/IPS, network segmentation
3. **Endpoint:** Antivirus, EDR
4. **Application:** Input validation, WAF
5. **Data:** Encryption, DLP
6. **User:** Training, access controls

### Fail-Safe Defaults
Default to secure state when errors occur.

**Implementation:**
```python
def authorize_user(user, resource):
    try:
        permissions = get_permissions(user, resource)
        return "admin" in permissions
    except Exception:
        return False  # Deny access on error, don't fail open
```

**Examples:**
- Firewall default-deny rules
- Session timeouts requiring re-authentication
- Database connections with least privilege

### Complete Mediation
Validate every access request, every time.

**Anti-pattern:**
```javascript
// Bad: Check once, cache forever
if (isAuthorized(user, resource)) {
    cache.set(user, "authorized");
}
// Later: assume still authorized
if (cache.get(user) === "authorized") { /* allow access */ }
```

**Correct:**
```javascript
// Good: Check every request
async function accessResource(user, resource) {
    if (await isAuthorized(user, resource)) {
        return resource;
    }
    throw new UnauthorizedException();
}
```

**Modern Application:** Zero Trust Architecture

### Open Design (Kerckhoffs's Principle)
Security depends on secret keys, not secret algorithms.

**Application:**
- Use proven cryptographic standards (AES, RSA)
- Assume attackers know your architecture
- Security through design, not obscurity

**Bad:** Custom encryption algorithm
**Good:** AES-256 with secure key management

### Economy of Mechanism
Keep security controls simple and understandable.

**Why:**
- Complex systems have more vulnerabilities
- Simpler code is easier to audit
- Reduces maintenance overhead

**Example:** Prefer built-in framework authentication over custom implementation.

### Psychological Acceptability
Security must be usable or users will bypass it.

**Balance:**
- Passwordless authentication (WebAuthn, passkeys)
- Single sign-on (SSO)
- Clear security policies
- User education

**Anti-pattern:** 90-day password rotation leading to "Password1", "Password2", "Password3"

### Work Factor
Make attacks economically infeasible.

**Implementation:**
- Password hashing with high iteration counts (bcrypt, Argon2)
- Rate limiting and account lockouts
- Computational puzzles (CAPTCHA, proof-of-work)

**Example:** Argon2 configured so password hash takes 500ms, making brute force impractical.

---

## Defense in Depth

Layered security strategy where multiple controls protect assets.

### Network Layer
```
Internet → Firewall → DMZ → Internal Firewall → Application Servers → Database
```

**Controls:**
- Perimeter firewalls
- Network segmentation (VLANs)
- Intrusion detection/prevention (IDS/IPS)
- Web application firewall (WAF)

### Application Layer
- Input validation and sanitization
- Output encoding
- Secure session management
- Error handling without information disclosure

### Data Layer
- Encryption at rest (AES-256)
- Encryption in transit (TLS 1.3)
- Database access controls
- Data masking and tokenization

### Why Layered Security Matters
If an attacker bypasses the firewall, they still face:
- Network segmentation
- Application authentication
- Database permissions
- Audit logging

---

## Trust Models

### Traditional Perimeter Security

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Traditional Perimeter Model</h4>
<ul>
<li><strong>Assumption</strong>: Internal network is trusted</li>
<li><strong>Security</strong>: Hard exterior, soft interior</li>
<li><strong>Problem</strong>: Insider threats, lateral movement after breach</li>
<li><strong>Status</strong>: Outdated for modern environments</li>
</ul>
<p><strong>Analogy</strong>: Castle with walls (breach the wall, access everything)</p>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Zero Trust Architecture</h4>
<ul>
<li><strong>Principle</strong>: "Never trust, always verify"</li>
<li><strong>Security</strong>: Verify every request, every time</li>
<li><strong>Benefit</strong>: Limits lateral movement, contains breaches</li>
<li><strong>Status</strong>: Modern standard for secure architectures</li>
</ul>
<p><strong>Analogy</strong>: Airport checkpoints (verify at every gate)</p>
</div>
</div>

### Zero Trust Architecture
**Core Principle:** "Never trust, always verify"

**Implementation:**
1. **Verify explicitly:** Authenticate and authorize every request
2. **Least privilege access:** Minimize permissions and scope
3. **Assume breach:** Segment access, monitor all activity

**Example:**
```yaml
# Traditional: Trust internal network
if source_ip in internal_network:
    allow_access()

# Zero Trust: Verify every request
if authenticate(user) AND authorize(user, resource) AND validate_device():
    allow_access()
```

**Technologies:**
- Identity and access management (IAM)
- Micro-segmentation
- Software-defined perimeter (SDP)
- Continuous verification

---

## Security by Design

Build security into the development lifecycle, not bolt it on later.

### Threat Modeling
Identify threats early in design phase.

**Framework: STRIDE**
- **S**poofing identity
- **T**ampering with data
- **R**epudiation
- **I**nformation disclosure
- **D**enial of service
- **E**levation of privilege

### Secure Coding Practices
```csharp
// Vulnerable to SQL injection
string query = $"SELECT * FROM users WHERE id = {userId}";

// Parameterized query prevents injection
string query = "SELECT * FROM users WHERE id = @userId";
command.Parameters.AddWithValue("@userId", userId);
```

**Key Practices:**
- Input validation (whitelist, not blacklist)
- Output encoding (prevent XSS)
- Parameterized queries (prevent SQL injection)
- Secure defaults
- Error handling without information leakage

### Security Testing
- **Static Analysis (SAST):** Analyze source code for vulnerabilities
- **Dynamic Analysis (DAST):** Test running application
- **Dependency Scanning:** Identify vulnerable libraries
- **Penetration Testing:** Simulate real-world attacks

---

## Quick Reference

### Security Checklist

**Authentication & Authorization**
- [ ] Multi-factor authentication enabled
- [ ] Least privilege access enforced
- [ ] Session management secure (timeouts, secure cookies)
- [ ] Password policy enforces strong passwords
- [ ] Service accounts have minimal permissions

**Data Protection**
- [ ] Encryption at rest (AES-256)
- [ ] Encryption in transit (TLS 1.3)
- [ ] Sensitive data not logged
- [ ] PII properly handled (GDPR, CCPA)
- [ ] Secure key management

**Application Security**
- [ ] Input validation on all user input
- [ ] Output encoding prevents XSS
- [ ] Parameterized queries prevent SQL injection
- [ ] CSRF protection enabled
- [ ] Security headers configured (CSP, HSTS, X-Frame-Options)

**Infrastructure**
- [ ] Firewall rules follow default-deny
- [ ] Network segmentation implemented
- [ ] Systems patched and updated
- [ ] Least privilege for system accounts
- [ ] Monitoring and alerting configured

**Incident Response**
- [ ] Logging captures security events
- [ ] Audit trails immutable
- [ ] Incident response plan documented
- [ ] Regular security drills conducted
- [ ] Backup and recovery tested

### Common Vulnerabilities (OWASP Top 10 2025)

| Vulnerability | Description | Mitigation |
|---------------|-------------|------------|
| **Broken Access Control** | Users access unauthorized resources | Enforce least privilege, validate on server |
| **Cryptographic Failures** | Sensitive data exposed | Encrypt data, use proven algorithms |
| **Injection** | Malicious data in commands/queries | Parameterized queries, input validation |
| **Insecure Design** | Security not considered in design | Threat modeling, security requirements |
| **Security Misconfiguration** | Improper security settings | Secure defaults, configuration management |
| **Vulnerable Components** | Using libraries with known vulnerabilities | Dependency scanning, regular updates |
| **Authentication Failures** | Weak authentication mechanisms | MFA, secure session management |
| **Data Integrity Failures** | Unverified software updates | Code signing, integrity checks |
| **Logging Failures** | Insufficient logging/monitoring | Comprehensive logging, SIEM integration |
| **SSRF** | Server-side request forgery | Whitelist external connections, validate URLs |

### Encryption Standards (2025)

| Use Case | Algorithm | Key Size |
|----------|-----------|----------|
| **Symmetric Encryption** | AES-GCM | 256-bit |
| **Asymmetric Encryption** | RSA | 4096-bit |
| **Key Exchange** | ECDH | P-384 |
| **Digital Signatures** | EdDSA | Curve25519 |
| **Hashing** | SHA-3 | 256-bit |
| **Password Hashing** | Argon2id | Memory: 64MB, Iterations: 3 |
| **TLS** | TLS 1.3 | - |

### Decision Framework

**When to use symmetric vs asymmetric encryption:**
- **Symmetric (AES):** Large data volumes, known parties sharing key
- **Asymmetric (RSA):** Key exchange, digital signatures, unknown parties

**When to implement rate limiting:**
- Authentication endpoints (prevent brute force)
- API endpoints (prevent abuse)
- Resource-intensive operations

**When to apply defense in depth:**
- Always. Security in layers is fundamental.

---