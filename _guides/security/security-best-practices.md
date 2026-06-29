---
title: "Best Practices and Quick Reference"
category: Security
description: "Practical security best practices covering network segmentation, endpoint protection, IAM, data encryption, application security, and 2025 security trends."
tags: [security, best-practices, practical, implementation, checklist]
---

## Network Security

### Network Segmentation

**Purpose:** Limit lateral movement and contain breaches within isolated network zones.

**Implementation:**

```yaml
# Network Segmentation Design
network_architecture:
  dmz:
    subnet: 10.1.0.0/24
    purpose: Public-facing services
    allowed_inbound: [80, 443]
    allowed_outbound: Database subnet only

  application_tier:
    subnet: 10.2.0.0/24
    purpose: Application servers
    allowed_inbound: DMZ only
    allowed_outbound: Database, external APIs

  database_tier:
    subnet: 10.3.0.0/24
    purpose: Data storage
    allowed_inbound: Application tier only
    allowed_outbound: Deny all (except backups)

  management:
    subnet: 10.4.0.0/24
    purpose: Admin access
    allowed_inbound: VPN only
    allowed_outbound: All internal subnets
```

**Firewall Rules (Deny by Default):**

```bash
# iptables example: Default deny, explicit allow
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT ACCEPT

# Allow established connections
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow specific services
iptables -A INPUT -p tcp --dport 443 -j ACCEPT  # HTTPS
iptables -A INPUT -p tcp --dport 22 -s 10.4.0.0/24 -j ACCEPT  # SSH from mgmt

# Log dropped packets
iptables -A INPUT -j LOG --log-prefix "DROPPED: "
iptables -A INPUT -j DROP
```

### Next-Generation Firewall (NGFW)

**Beyond Traditional Firewalls:**
- Deep packet inspection (DPI)
- Application awareness and control
- Intrusion prevention system (IPS)
- SSL/TLS inspection
- Threat intelligence integration

**Configuration Example:**

```
# Palo Alto NGFW Policy
Application Control:
- Allow: Business apps (Salesforce, O365, Slack)
- Monitor: Shadow IT (personal cloud storage)
- Block: High-risk apps (TOR, BitTorrent, cryptocurrency mining)

Threat Prevention:
- Antivirus: Block on all traffic
- Anti-spyware: Alert and block critical/high
- Vulnerability Protection: Block client/server exploits
- URL Filtering: Block malware, phishing, adult content

SSL Decryption:
- Decrypt inbound: Public-facing services
- Decrypt outbound: All users (with privacy exceptions)
- Exceptions: Healthcare, financial, HR portals
```

### Intrusion Detection/Prevention (IDS/IPS)

**Deployment Modes:**
- **IDS (Passive):** Monitor and alert only
- **IPS (Inline):** Block malicious traffic actively

**Signature vs Behavioral Detection:**

```python
# Signature-based: Known attack patterns
ids_rules = {
    'sql_injection': r"(\bunion\b.*\bselect\b|\bor\b.*=.*)",
    'xss_attempt': r"(<script|javascript:|onerror=)",
    'directory_traversal': r"(\.\./|\.\.\\)",
}

# Behavioral/Anomaly-based: Unusual patterns
def detect_anomaly(network_traffic):
    """ML-based anomaly detection"""
    baseline = get_traffic_baseline()

    if traffic.volume > baseline.volume * 3:
        alert("Traffic volume anomaly detected")

    if traffic.destination_ports > 100:
        alert("Port scanning detected")

    if traffic.failed_logins > 5:
        alert("Brute force attack suspected")
```

### DDoS Protection

**Mitigation Strategies:**

| Layer | Attack Type | Mitigation |
|-------|------------|------------|
| **Layer 3/4** | SYN flood, UDP flood | Rate limiting, SYN cookies, traffic scrubbing |
| **Layer 7** | HTTP flood, Slowloris | WAF, CAPTCHA, behavioral analysis |
| **DNS** | DNS amplification | Response rate limiting, DNSSEC |
| **Application** | API abuse | Rate limiting per IP/user, authentication |

**Implementation:**

```nginx
# Nginx rate limiting
http {
    # Define rate limit zones
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;

    server {
        location /login {
            limit_req zone=login burst=3 nodelay;
            # Allow 5 requests/minute, burst up to 8
        }

        location /api/ {
            limit_req zone=api burst=20;
            # Allow 100 requests/minute
        }
    }
}
```

---

## Endpoint Security

### Endpoint Detection and Response (EDR)

**Core Capabilities:**
- Real-time monitoring and threat detection
- Behavioral analysis and machine learning
- Automated response and remediation
- Forensic investigation and root cause analysis

**EDR Implementation:**

```python
# Example EDR behavioral rule
class RansomwareDetection:
    def __init__(self):
        self.file_encryption_threshold = 50
        self.suspicious_extensions = ['.encrypted', '.locked', '.crypto']

    def monitor_file_activity(self, process):
        """Detect rapid file encryption behavior"""
        encrypted_files = []

        for file_event in process.file_operations:
            if file_event.action == 'write':
                # Check for encryption indicators
                if self.is_encrypted(file_event.new_content):
                    encrypted_files.append(file_event.path)

                # Ransomware typically encrypts many files quickly
                if len(encrypted_files) > self.file_encryption_threshold:
                    self.respond_to_ransomware(process)

    def respond_to_ransomware(self, process):
        """Automated response to ransomware detection"""
        # 1. Kill the malicious process
        process.terminate()

        # 2. Isolate the endpoint
        self.network.quarantine_host(process.hostname)

        # 3. Alert security team
        self.alert_soc(
            severity='critical',
            threat='Ransomware detected',
            host=process.hostname,
            process=process.name
        )

        # 4. Create forensic snapshot
        self.capture_memory_dump(process.hostname)
```

### Device Encryption

**Full Disk Encryption (FDE):**

```powershell
# Windows BitLocker deployment
# Enable BitLocker on C: drive with TPM
Enable-BitLocker -MountPoint "C:" -EncryptionMethod XtsAes256 -TpmProtector

# Store recovery key in Active Directory
Add-BitLockerKeyProtector -MountPoint "C:" -RecoveryPasswordProtector
Backup-BitLockerKeyProtector -MountPoint "C:" -KeyProtectorId (Get-BitLockerVolume -MountPoint "C:").KeyProtector[0].KeyProtectorId

# Enforce encryption via Group Policy
# Computer Configuration > Policies > Administrative Templates > Windows Components > BitLocker Drive Encryption
# Enable: "Require additional authentication at startup"
```

```bash
# macOS FileVault deployment
# Enable FileVault programmatically
fdesetup enable -user admin_user

# Check encryption status
fdesetup status

# Escrow recovery key to MDM
fdesetup changerecovery -personal -inputplist < recovery.plist
```

### Mobile Device Management (MDM)

**Security Policies:**

```yaml
# MDM security configuration
mdm_policies:
  device_requirements:
    - Encryption: Required
    - Passcode: 8+ characters, alphanumeric
    - Biometric: Enabled (Touch ID/Face ID)
    - Auto-lock: 5 minutes max
    - Failed attempts: Wipe after 10 attempts

  application_management:
    - Whitelist corporate apps
    - Block jailbroken/rooted devices
    - Require app updates within 7 days
    - Disable app installation from unknown sources

  data_protection:
    - Separate work/personal containers
    - Remote wipe capability
    - Disable cloud backups of corporate data
    - Block copy/paste between containers

  network_security:
    - Require VPN for corporate access
    - Certificate-based Wi-Fi authentication
    - Disable personal hotspot
```

### Patch Management

**Patching Strategy:**

```python
# Automated patch management workflow
class PatchManagement:
    def __init__(self):
        self.patch_windows = {
            'critical': timedelta(days=7),
            'high': timedelta(days=14),
            'medium': timedelta(days=30),
            'low': timedelta(days=90)
        }

    def assess_vulnerabilities(self):
        """Scan for missing patches"""
        scan_results = vulnerability_scanner.scan_all_hosts()

        for vuln in scan_results:
            severity = vuln.cvss_severity
            deadline = datetime.now() + self.patch_windows[severity]

            self.create_patch_ticket(
                vulnerability=vuln,
                severity=severity,
                deadline=deadline
            )

    def deploy_patches(self, patch_group):
        """Phased rollout approach"""
        # Phase 1: Test environment (Day 0)
        self.deploy_to_group(patch_group, 'test')
        self.monitor_for_issues(duration=days(2))

        # Phase 2: Pilot group (Day 2)
        if not self.has_critical_issues():
            self.deploy_to_group(patch_group, 'pilot')
            self.monitor_for_issues(duration=days(3))

        # Phase 3: Production rollout (Day 5)
        if not self.has_critical_issues():
            self.deploy_to_group(patch_group, 'production')
```

---

## Identity and Access Management

### Multi-Factor Authentication (MFA)

<div class="callout callout--warning">
<p class="callout__title">SMS MFA Vulnerability</p>
<p>SMS/Voice-based MFA is vulnerable to SIM swapping attacks. Use hardware security keys, biometric authentication, or authenticator apps instead.</p>
</div>

**Implementation Hierarchy (Strongest to Weakest):**

1. **Hardware Security Keys** (FIDO2/WebAuthn)
2. **Biometric Authentication** (Fingerprint, Face ID)
3. **Authenticator Apps** (TOTP: Google Authenticator, Authy)
4. **Push Notifications** (Duo, Microsoft Authenticator)
5. **SMS/Voice** (Vulnerable to SIM swapping; avoid when possible)

**MFA Enforcement:**

```python
# Conditional MFA based on risk
class AdaptiveMFA:
    def authenticate(self, user, context):
        """Risk-based authentication"""
        risk_score = self.calculate_risk(user, context)

        # Always require password
        if not self.verify_password(user):
            return False

        # MFA required based on risk
        if risk_score >= 70:
            # High risk: Require hardware key
            return self.require_fido2(user)

        elif risk_score >= 40:
            # Medium risk: Require TOTP or push
            return self.require_totp_or_push(user)

        elif risk_score >= 20:
            # Low risk: Optional MFA
            return self.optional_mfa(user)

        # Very low risk: Password only
        return True

    def calculate_risk(self, user, context):
        """Calculate authentication risk score"""
        score = 0

        # New device
        if not context.device_id in user.known_devices:
            score += 30

        # Unusual location
        if context.location not in user.typical_locations:
            score += 25

        # Unusual time
        if not self.is_typical_login_time(user, context.time):
            score += 15

        # Failed attempts recently
        score += user.recent_failed_logins * 10

        # Privileged account
        if user.is_privileged:
            score += 20

        return min(score, 100)
```

### Privileged Access Management (PAM)

**Just-in-Time (JIT) Access:**

```python
# Temporary privilege elevation
class JITAccessManager:
    def request_elevated_access(self, user, resource, justification):
        """Request temporary admin access"""
        # Require approval for production systems
        if resource.environment == 'production':
            approval = self.request_manager_approval(
                user=user,
                resource=resource,
                justification=justification,
                duration=hours(4)
            )

            if not approval.approved:
                return AccessDenied("Manager approval required")

        # Grant temporary access
        access_grant = self.create_temp_access(
            user=user,
            resource=resource,
            permissions=['admin'],
            expires=datetime.now() + timedelta(hours=4)
        )

        # Session monitoring
        self.monitor_session(access_grant, recording=True)

        # Automatic revocation
        self.schedule_revocation(access_grant)

        return access_grant

    def monitor_session(self, access_grant, recording=True):
        """Monitor privileged session activity"""
        session_monitor = SessionRecorder(
            user=access_grant.user,
            resource=access_grant.resource,
            record_keystrokes=recording,
            record_screen=recording
        )

        # Alert on suspicious activity
        for action in session_monitor.actions:
            if self.is_suspicious(action):
                self.alert_security_team(access_grant, action)
```

### Single Sign-On (SSO)

**SAML 2.0 Implementation:**

```xml
<!-- SAML Authentication Request -->
<samlp:AuthnRequest
    xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
    ID="_unique_request_id"
    Version="2.0"
    IssueInstant="2025-10-05T12:00:00Z"
    Destination="https://idp.example.com/saml/sso"
    AssertionConsumerServiceURL="https://app.example.com/saml/acs">
    <saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">
        https://app.example.com
    </saml:Issuer>
</samlp:AuthnRequest>
```

**SSO Security Best Practices:**

```yaml
# SSO configuration security
sso_security:
  authentication:
    - MFA required for SSO portal
    - Session timeout: 8 hours
    - Idle timeout: 30 minutes
    - Re-authentication for sensitive apps

  authorization:
    - SAML attribute-based access control
    - Group-based application assignments
    - Just-in-time provisioning
    - Automatic deprovisioning on termination

  monitoring:
    - Log all SSO authentications
    - Alert on impossible travel
    - Alert on multiple failed attempts
    - Track application access patterns
```

### Access Reviews

**Automated Access Certification:**

```python
# Quarterly access review automation
class AccessReviewManager:
    def conduct_quarterly_review(self):
        """Automated access certification process"""
        # Identify accounts requiring review
        accounts_to_review = self.get_active_accounts()

        for account in accounts_to_review:
            # Determine reviewer (manager or resource owner)
            reviewer = self.get_reviewer(account)

            # Generate review package
            review_package = {
                'user': account.user,
                'access_summary': self.summarize_access(account),
                'last_login': account.last_login,
                'high_risk_access': self.identify_risky_access(account),
                'recommended_action': self.recommend_action(account)
            }

            # Send for review
            self.send_review_request(reviewer, review_package)

    def recommend_action(self, account):
        """AI-based access recommendation"""
        recommendations = []

        # Inactive account
        if account.last_login < datetime.now() - timedelta(days=90):
            recommendations.append("DISABLE: No activity in 90 days")

        # Over-privileged
        granted_permissions = set(account.permissions)
        used_permissions = set(account.permissions_used)
        unused = granted_permissions - used_permissions

        if len(unused) > 0:
            recommendations.append(f"REVOKE: Unused permissions: {unused}")

        # Orphaned account (manager left)
        if not account.manager.is_active:
            recommendations.append("REVIEW: Manager no longer active")

        return recommendations
```

---

## Data Protection

### Data Loss Prevention (DLP)

**DLP Policy Implementation:**

```python
# DLP rule engine
class DLPEngine:
    def __init__(self):
        self.patterns = {
            'ssn': r'\b\d{3}-\d{2}-\d{4}\b',
            'credit_card': r'\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b',
            'api_key': r'api[_-]?key["\']?\s*[:=]\s*["\']?[a-zA-Z0-9]{32,}',
            'aws_key': r'AKIA[0-9A-Z]{16}',
        }

    def scan_content(self, content, action_context):
        """Scan content for sensitive data"""
        findings = []

        for data_type, pattern in self.patterns.items():
            matches = re.findall(pattern, content)
            if matches:
                findings.append({
                    'type': data_type,
                    'count': len(matches),
                    'severity': self.get_severity(data_type)
                })

        if findings:
            return self.enforce_policy(findings, action_context)

        return PolicyAction.ALLOW

    def enforce_policy(self, findings, context):
        """Enforce DLP policy based on context"""
        severity = max(f['severity'] for f in findings)

        # Email: Block high severity
        if context.channel == 'email' and severity == 'high':
            return PolicyAction.BLOCK

        # Cloud upload: Quarantine and alert
        if context.channel == 'cloud_storage':
            self.quarantine_file(context.file)
            self.alert_security(findings, context)
            return PolicyAction.BLOCK

        # Internal transfer: Audit only
        if context.destination.is_internal:
            self.audit_log(findings, context)
            return PolicyAction.ALLOW

        # Default: Block external transfer
        return PolicyAction.BLOCK
```

### Encryption Best Practices

**Encryption at Rest:**

```python
# Application-level encryption
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.backends import default_backend
import os

class DataEncryption:
    def __init__(self, key_management_service):
        self.kms = key_management_service

    def encrypt_sensitive_data(self, plaintext, data_classification):
        """Encrypt data using AES-256-GCM"""
        # Retrieve encryption key from KMS
        data_key = self.kms.get_data_key(classification=data_classification)

        # Generate nonce (never reuse with same key!)
        nonce = os.urandom(12)

        # Encrypt with authenticated encryption
        aesgcm = AESGCM(data_key)
        ciphertext = aesgcm.encrypt(nonce, plaintext.encode(), None)

        # Return nonce + ciphertext (nonce is not secret)
        return {
            'nonce': nonce.hex(),
            'ciphertext': ciphertext.hex(),
            'key_id': data_key.id,
            'algorithm': 'AES-256-GCM'
        }

    def decrypt_sensitive_data(self, encrypted_data):
        """Decrypt data and verify authenticity"""
        # Retrieve decryption key
        data_key = self.kms.get_key_by_id(encrypted_data['key_id'])

        # Decrypt and verify
        aesgcm = AESGCM(data_key)
        nonce = bytes.fromhex(encrypted_data['nonce'])
        ciphertext = bytes.fromhex(encrypted_data['ciphertext'])

        try:
            plaintext = aesgcm.decrypt(nonce, ciphertext, None)
            return plaintext.decode()
        except Exception:
            # Authentication failed - data tampered
            raise IntegrityError("Data authentication failed")
```

**Encryption in Transit:**

```nginx
# TLS 1.3 configuration for Nginx
server {
    listen 443 ssl http2;
    server_name secure.example.com;

    # TLS 1.3 only
    ssl_protocols TLSv1.3;

    # Certificate configuration
    ssl_certificate /etc/ssl/certs/example.com.crt;
    ssl_certificate_key /etc/ssl/private/example.com.key;

    # Strong cipher suites (TLS 1.3)
    ssl_ciphers 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256';
    ssl_prefer_server_ciphers on;

    # HSTS (force HTTPS for 1 year)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # OCSP stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/ssl/certs/ca-bundle.crt;

    # Session tickets (disable for perfect forward secrecy)
    ssl_session_tickets off;
}
```

---

## Application Security

### Secure Development Lifecycle (DevSecOps)

**CI/CD Security Integration:**

```yaml
# GitLab CI/CD pipeline with security scanning
stages:
  - build
  - test
  - security
  - deploy

# Static Application Security Testing (SAST)
sast:
  stage: security
  script:
    - semgrep --config auto --json -o sast-report.json
  artifacts:
    reports:
      sast: sast-report.json
  allow_failure: false  # Block pipeline on findings

# Dependency scanning
dependency_scanning:
  stage: security
  script:
    - npm audit --audit-level=high
    - safety check --json  # Python dependencies
  allow_failure: false

# Container scanning
container_scanning:
  stage: security
  script:
    - trivy image --severity HIGH,CRITICAL myapp:$CI_COMMIT_SHA
  allow_failure: false

# Dynamic Application Security Testing (DAST)
dast:
  stage: security
  script:
    - docker run -v $(pwd):/zap/wrk:rw owasp/zap2docker-stable zap-baseline.py -t https://staging.example.com -r dast-report.html
  artifacts:
    paths:
      - dast-report.html

# Security policy enforcement
security_gate:
  stage: security
  script:
    - |
      # Fail if critical vulnerabilities found
      CRITICAL=$(jq '.vulnerabilities[] | select(.severity=="CRITICAL")' sast-report.json | wc -l)
      if [ $CRITICAL -gt 0 ]; then
        echo "CRITICAL vulnerabilities found. Blocking deployment."
        exit 1
      fi
```

### Web Application Firewall (WAF)

**ModSecurity Core Rule Set (CRS):**

```apache
# ModSecurity configuration
SecRuleEngine On
SecRequestBodyAccess On
SecResponseBodyAccess Off

# Include OWASP Core Rule Set
Include /etc/modsecurity/crs/crs-setup.conf
Include /etc/modsecurity/crs/rules/*.conf

# Custom rules for application
SecRule REQUEST_URI "@contains /admin" \
    "id:1001,\
     phase:1,\
     deny,\
     status:403,\
     msg:'Admin access attempt',\
     logdata:'IP: %{REMOTE_ADDR}'"

# SQL injection protection
SecRule ARGS "@detectSQLi" \
    "id:1002,\
     phase:2,\
     block,\
     msg:'SQL Injection detected'"

# XSS protection
SecRule ARGS "@detectXSS" \
    "id:1003,\
     phase:2,\
     block,\
     msg:'XSS attack detected'"

# Rate limiting
SecAction "id:1004,\
    phase:1,\
    initcol:ip=%{REMOTE_ADDR},\
    setvar:ip.requests=+1,\
    expirevar:ip.requests=60"

SecRule IP:REQUESTS "@gt 100" \
    "id:1005,\
     phase:1,\
     deny,\
     status:429,\
     msg:'Rate limit exceeded'"
```

### API Security

**API Authentication and Rate Limiting:**

```python
# FastAPI with security best practices
from fastapi import FastAPI, Depends, HTTPException, Security
from fastapi.security import OAuth2PasswordBearer, APIKeyHeader
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

app = FastAPI()
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
api_key_header = APIKeyHeader(name="X-API-Key")

# Rate limiting by endpoint sensitivity
@app.get("/api/public")
@limiter.limit("100/minute")
async def public_endpoint(request: Request):
    """Public endpoint with generous rate limit"""
    return {"message": "Public data"}

@app.get("/api/search")
@limiter.limit("20/minute")
async def search_endpoint(request: Request, token: str = Depends(oauth2_scheme)):
    """Authenticated endpoint with moderate rate limit"""
    user = verify_token(token)
    return {"results": search_data(user)}

@app.post("/api/sensitive")
@limiter.limit("5/minute")
async def sensitive_endpoint(request: Request, token: str = Depends(oauth2_scheme)):
    """Sensitive operation with strict rate limit"""
    user = verify_token(token)

    # Additional security checks
    if not user.is_authorized_for_sensitive_ops():
        raise HTTPException(status_code=403, detail="Insufficient privileges")

    # Require MFA for sensitive operations
    if not verify_mfa_token(request.headers.get("X-MFA-Token")):
        raise HTTPException(status_code=403, detail="MFA required")

    return perform_sensitive_operation(user)

# Input validation
from pydantic import BaseModel, validator, Field

class UserInput(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, regex=r'^[a-zA-Z0-9_]+$')
    email: str = Field(..., regex=r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')

    @validator('username')
    def username_must_not_be_reserved(cls, v):
        reserved = ['admin', 'root', 'system']
        if v.lower() in reserved:
            raise ValueError('Reserved username')
        return v
```

---

## Incident Response Procedures

### Immediate Actions (First 30 Minutes)

**Incident Classification:**

| Severity | Criteria | Response Time | Escalation |
|----------|----------|---------------|------------|
| **P1 - Critical** | Active breach, ransomware, data exfiltration | < 15 minutes | CISO, Executive team |
| **P2 - High** | Confirmed malware, unauthorized access | < 1 hour | Security Manager |
| **P3 - Medium** | Suspicious activity, policy violation | < 4 hours | Security Analyst |
| **P4 - Low** | Security event, false positive likely | < 24 hours | Queue review |

**Incident Response Playbook:**

```python
# Automated incident response orchestration
class IncidentResponseOrchestrator:
    def handle_security_alert(self, alert):
        """Automated incident response workflow"""
        # 1. Classify incident
        severity = self.classify_severity(alert)
        incident = self.create_incident_ticket(alert, severity)

        # 2. Initial containment (automated for known threats)
        if alert.threat_type in self.known_threats:
            self.auto_contain(alert)

        # 3. Evidence collection
        self.collect_evidence(alert)

        # 4. Notifications
        self.notify_stakeholders(incident)

        # 5. Execute playbook
        playbook = self.get_playbook(alert.threat_type)
        self.execute_playbook(playbook, incident)

    def auto_contain(self, alert):
        """Automatic containment actions"""
        if alert.threat_type == 'ransomware':
            # Isolate infected host
            self.network.quarantine_host(alert.source_host)

            # Disable user account
            self.iam.disable_user(alert.affected_user)

            # Kill malicious process
            self.edr.kill_process(alert.source_host, alert.process_id)

        elif alert.threat_type == 'data_exfiltration':
            # Block outbound connection
            self.firewall.block_ip(alert.destination_ip)

            # Revoke user session
            self.iam.revoke_sessions(alert.affected_user)

        elif alert.threat_type == 'credential_compromise':
            # Force password reset
            self.iam.force_password_reset(alert.affected_user)

            # Invalidate all sessions
            self.iam.revoke_all_sessions(alert.affected_user)

            # Require MFA re-enrollment
            self.mfa.reset_factors(alert.affected_user)

    def collect_evidence(self, alert):
        """Automated evidence collection"""
        evidence = {
            'timestamp': datetime.now(),
            'alert_details': alert.to_dict(),
            'network_logs': self.siem.get_logs(alert.source_host, hours=24),
            'endpoint_logs': self.edr.get_logs(alert.source_host),
            'memory_dump': self.edr.capture_memory(alert.source_host),
            'network_capture': self.network.capture_traffic(alert.source_host),
        }

        self.evidence_locker.store(evidence, chain_of_custody=True)
```

---

## Security Metrics and KPIs

### Detection and Response Metrics

**Key Performance Indicators:**

```python
# Security metrics dashboard
class SecurityMetrics:
    def calculate_monthly_metrics(self):
        """Generate executive security dashboard"""
        return {
            # Detection metrics
            'mean_time_to_detect': self.calculate_mttd(),  # Target: < 24 hours
            'detection_coverage': self.calculate_coverage(),  # Target: > 90%
            'false_positive_rate': self.calculate_fpr(),  # Target: < 10%

            # Response metrics
            'mean_time_to_respond': self.calculate_mttr(),  # Target: < 1 hour
            'mean_time_to_recover': self.calculate_mttr_recovery(),  # Target: < 4 hours
            'incident_resolution_rate': self.calculate_resolution_rate(),  # Target: > 95%

            # Vulnerability metrics
            'time_to_patch_critical': self.avg_patch_time('critical'),  # Target: < 7 days
            'vulnerability_remediation_rate': self.remediation_rate(),  # Target: > 90%

            # Compliance metrics
            'mfa_enrollment_rate': self.mfa_adoption(),  # Target: 100%
            'security_training_completion': self.training_completion(),  # Target: 100%
            'policy_compliance_score': self.compliance_score(),  # Target: > 95%

            # User behavior
            'phishing_click_rate': self.phishing_test_results(),  # Target: < 5%
            'policy_violations': self.count_policy_violations(),  # Target: Decreasing trend
        }

    def calculate_mttd(self):
        """Mean Time to Detect: Time from compromise to detection"""
        incidents = self.get_incidents(last_30_days=True)
        detection_times = []

        for incident in incidents:
            if incident.compromise_time and incident.detection_time:
                delta = incident.detection_time - incident.compromise_time
                detection_times.append(delta.total_seconds() / 3600)  # hours

        return sum(detection_times) / len(detection_times) if detection_times else 0
```

---

## 2025 Security Trends

### AI-Powered Security

**Defensive AI Applications:**
- Behavioral anomaly detection using machine learning
- Automated threat hunting and pattern recognition
- AI-assisted SOC analysts (security copilots)
- Predictive vulnerability assessments

**Offensive AI Threats:**
- AI-generated phishing campaigns (highly personalized)
- Deepfake social engineering attacks
- Automated vulnerability discovery and exploitation
- Adversarial attacks against AI/ML systems

### Zero Trust Architecture Adoption

**Implementation Components:**

```yaml
# Zero Trust Architecture blueprint
zero_trust_architecture:
  identity_verification:
    - Continuous authentication (not just at login)
    - Device posture assessment
    - Behavioral biometrics
    - Risk-based adaptive MFA

  micro-segmentation:
    - Application-level network isolation
    - Software-defined perimeter (SDP)
    - Service mesh security (Istio, Linkerd)
    - API gateway with authentication

  least_privilege:
    - Just-in-time access provisioning
    - Time-bound permissions
    - Fine-grained authorization (ABAC)
    - Continuous access validation

  visibility_analytics:
    - Real-time traffic monitoring
    - User behavior analytics
    - Threat intelligence integration
    - Automated response orchestration
```

### Cloud-Native Security

**Container and Kubernetes Security:**

```yaml
# Kubernetes security hardening
apiVersion: v1
kind: Pod
metadata:
  name: secure-app
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 2000
    seccompProfile:
      type: RuntimeDefault

  containers:
  - name: app
    image: myapp:1.0.0
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
          - ALL
        add:
          - NET_BIND_SERVICE

    resources:
      limits:
        cpu: "500m"
        memory: "512Mi"
      requests:
        cpu: "250m"
        memory: "256Mi"

  # Network policy: Deny all by default
  networkPolicy:
    policyTypes:
    - Ingress
    - Egress
    ingress:
    - from:
      - podSelector:
          matchLabels:
            app: frontend
      ports:
      - protocol: TCP
        port: 8080
```

### Supply Chain Security

**Software Bill of Materials (SBOM):**

```bash
# Generate SBOM for application
syft myapp:latest -o spdx-json > sbom.json

# Scan SBOM for vulnerabilities
grype sbom:sbom.json --fail-on high

# Sign and verify artifacts
cosign sign myapp:latest
cosign verify --key cosign.pub myapp:latest
```

---

## Quick Reference

### Security Implementation Checklist

**Network Security**
- [ ] Network segmentation implemented (DMZ, app, data tiers)
- [ ] Next-generation firewall deployed
- [ ] Intrusion detection/prevention systems active
- [ ] DDoS protection configured
- [ ] Wireless security (WPA3, network isolation)
- [ ] VPN for remote access

**Endpoint Security**
- [ ] EDR deployed on all endpoints
- [ ] Anti-malware with real-time protection
- [ ] Full disk encryption enabled
- [ ] Secure boot configured
- [ ] Mobile device management for BYOD
- [ ] Automated patch management

**Identity and Access Management**
- [ ] Multi-factor authentication enforced (100%)
- [ ] Privileged access management deployed
- [ ] Quarterly access reviews conducted
- [ ] Single sign-on implemented
- [ ] Password policy enforces complexity
- [ ] Service accounts inventoried and managed

**Data Protection**
- [ ] Data classified and labeled
- [ ] Data loss prevention deployed
- [ ] Encryption at rest (AES-256)
- [ ] Encryption in transit (TLS 1.3)
- [ ] Backup tested quarterly
- [ ] Data retention policies enforced

**Application Security**
- [ ] DevSecOps integrated into CI/CD
- [ ] SAST/DAST in pipeline
- [ ] Web application firewall deployed
- [ ] API security (authentication, rate limiting)
- [ ] Dependency scanning automated
- [ ] Security headers configured

**Incident Response**
- [ ] Incident response plan documented
- [ ] IR team identified and trained
- [ ] Playbooks for common scenarios
- [ ] Tabletop exercises conducted quarterly
- [ ] Evidence collection procedures
- [ ] Communication templates prepared

### Critical Security Controls Priority

| Priority | Control | Impact | Effort |
|----------|---------|--------|--------|
| **P0** | Multi-factor authentication | Very High | Low |
| **P0** | Endpoint protection (EDR) | Very High | Medium |
| **P0** | Backup and recovery | Very High | Low |
| **P1** | Patch management | High | Medium |
| **P1** | Network segmentation | High | High |
| **P1** | Logging and monitoring | High | Medium |
| **P2** | Data loss prevention | Medium | High |
| **P2** | Privileged access management | High | High |
| **P2** | Security awareness training | Medium | Low |
| **P3** | Zero trust architecture | High | Very High |

### Incident Response Contacts

```yaml
# Incident response contact matrix
incident_contacts:
  P1_Critical:
    immediate_notification:
      - CISO
      - CTO
      - Security Operations Manager
    response_time: 15 minutes
    communication_channel: "Emergency phone bridge"

  P2_High:
    notification:
      - Security Manager
      - IT Operations Lead
    response_time: 1 hour
    communication_channel: "Slack #security-incidents"

  external_contacts:
    - Legal Counsel: legal@example.com
    - PR/Communications: pr@example.com
    - Cyber Insurance: claims@cyberinsurance.com
    - FBI IC3: www.ic3.gov (for cybercrime)
    - CISA: central@cisa.dhs.gov (for critical infrastructure)
```

### Regulatory Compliance Quick Reference

| Regulation | Scope | Key Requirements | Breach Notification |
|------------|-------|------------------|-------------------|
| **GDPR** | EU citizens' data | Consent, data minimization, right to erasure | 72 hours |
| **HIPAA** | US healthcare PHI | Administrative, physical, technical safeguards | 60 days |
| **PCI DSS** | Payment card data | Network security, access control, monitoring | Immediately |
| **CCPA/CPRA** | California residents | Disclosure, deletion, opt-out rights | Varies |
| **SOX** | US public companies | Financial controls, audit trails | N/A |
| **FISMA** | US federal systems | NIST 800-53 controls | Varies by severity |

### Security Training Requirements

**Annual Mandatory Training:**
- [ ] Security awareness basics (all employees)
- [ ] Phishing recognition and reporting
- [ ] Data handling and classification
- [ ] Incident reporting procedures
- [ ] Password and authentication best practices

**Role-Specific Training:**
- [ ] Developers: Secure coding (OWASP Top 10)
- [ ] IT Operations: Hardening and patch management
- [ ] Executives: Board-level cyber risk
- [ ] HR: Social engineering and insider threats
- [ ] Legal: Data privacy regulations

---
