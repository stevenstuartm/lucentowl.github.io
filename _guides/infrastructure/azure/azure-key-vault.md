---
title: "Azure Key Vault for System Architects"
layout: guide
category: Azure
subcategory: Security and Compliance
description: "A system architect's guide to Azure Key Vault covering secrets management, encryption key management, certificate lifecycle, HSM-backed keys, and access control patterns for securing application secrets and cryptographic operations."
tags: [azure, security, cloud-computing, infrastructure, governance, automation, reliability, practical]
---

## What Is Azure Key Vault

[Azure Key Vault](https://learn.microsoft.com/en-us/azure/key-vault/general/overview){:target="_blank" rel="noopener noreferrer"} is a secrets management service that stores cryptographic keys, passwords, API tokens, and certificates outside of application code and configuration. Applications request values from Key Vault at runtime using their identity, creating an audit trail and enabling centralized rotation without redeploying applications.

Key Vault separates three distinct object types: keys (for cryptographic operations), secrets (for passwords and tokens), and certificates (for TLS/SSL and authentication). Each serves different purposes and has separate APIs, permissions, and lifecycle management patterns.

### What Problems Key Vault Solves

**Without Key Vault:**
- Secrets embedded in application code or configuration files
- No centralized audit of who accessed sensitive data
- Credential rotation requires code changes and redeployment
- No hardware-backed encryption for regulatory compliance
- Loss of private keys if a developer machine is compromised
- Secrets accidentally committed to version control

**With Key Vault:**
- Secrets stored outside application code and configuration
- Complete audit trail showing who accessed what and when
- Certificate and key rotation without application changes
- Optional Hardware Security Module (HSM) backing for compliance
- Centralized lifecycle management across applications and environments
- Fine-grained access control through policies and Azure RBAC
- Application identity-based access, not shared credentials

### How Key Vault Differs from AWS Equivalents

AWS provides separate services for different secret types. Azure consolidates them into Key Vault with distinct object types.

| Concept | AWS | Azure Key Vault |
|---------|-----|-----------------|
| **Cryptographic keys** | AWS KMS (Key Management Service) | Key Vault keys (software or HSM) |
| **Passwords/tokens** | AWS Secrets Manager | Key Vault secrets |
| **TLS/SSL certificates** | AWS Certificate Manager (ACM) | Key Vault certificates |
| **HSM-backed keys** | CloudHSM (separate appliance) | Key Vault Managed HSM (single integrated service) |
| **Access control** | IAM policies | Vault access policies + Azure RBAC |
| **Key operations** | KMS only allows encrypt/decrypt | Key Vault supports sign, verify, wrap, unwrap |
| **Audit trail** | CloudTrail | Key Vault diagnostic logs + Azure Activity Log |

---

## Key Vault Objects: Keys, Secrets, and Certificates

### Secrets

[Key Vault secrets](https://learn.microsoft.com/en-us/azure/key-vault/secrets/){:target="_blank" rel="noopener noreferrer"} store small values like passwords, API keys, and connection strings (up to 25 KB each). A secret is a key-value pair where applications retrieve the value by name at runtime.

**Characteristics:**
- Maximum size: 25 KB per secret
- String-based values only (though you can store JSON and parse it in application code)
- Versioning enabled automatically; you can retrieve any previous version
- Soft delete by default; deleted secrets remain accessible for 90 days by default
- Auto-renewal not available for secrets (unlike certificates)

**When to use secrets:**
- API keys, tokens, and connection strings
- Database passwords
- Service account credentials
- OAuth client secrets

**Lifecycle:**
1. Create the secret in Key Vault
2. Applications reference it by name
3. To rotate, create a new version
4. Old versions remain accessible if rollback is needed
5. Applications typically pick up the new version on next startup or re-read

**Access pattern:** Applications request the secret value by name. Key Vault enforces permissions on the application identity.

---

### Keys

[Key Vault keys](https://learn.microsoft.com/en-us/azure/key-vault/keys/){:target="_blank" rel="noopener noreferrer"} are cryptographic keys used for encryption, decryption, signing, and verification. Unlike secrets (which are retrieved wholesale), keys stay in Key Vault and applications perform cryptographic operations against them.

**Key types:**
- **RSA:** RSA 2048, 3072, 4096 bits (most common for asymmetric cryptography)
- **EC (Elliptic Curve):** P-256, P-384, P-521 (smaller keys, faster operations, for modern deployments)
- **Symmetric keys:** AES keys (128, 192, 256 bits) for symmetric encryption

**Key protection levels:**
- **Software-protected:** Keys stored in Azure's managed service, encrypted at rest
- **HSM-backed:** Keys stored in a Hardware Security Module, meeting compliance requirements like FIPS 140-2 or FIPS 140-3

**Characteristics:**
- Operations happen within Key Vault; the application never sees the raw key material
- Supports encrypt, decrypt, sign, verify, wrap key, and unwrap key operations
- Versioning enabled automatically; rotating a key creates a new version
- Soft delete by default; deleted keys remain accessible for 90 days by default
- Purge protection optional; prevents accidental permanent deletion

**When to use keys:**
- Encrypting application data before storing in databases
- Signing JWTs or other security tokens
- Wrapping/unwrapping other encryption keys (envelope encryption pattern)
- TLS/mTLS scenarios where asymmetric keys are needed
- Cryptographic operations that require audit compliance

**Key rotation strategy:**
- Create a new key version in Key Vault
- Update application configuration to point to the new version
- Re-encrypt data encrypted with the old version (or use a rotation service)
- Retire the old version after all encrypted data is migrated

---

### Certificates

[Key Vault certificates](https://learn.microsoft.com/en-us/azure/key-vault/certificates/){:target="_blank" rel="noopener noreferrer"} are X.509 certificates managed with automatic lifecycle and renewal. A certificate bundles a public certificate, private key, and certificate chain.

**Certificate lifecycle:**
1. **Create:** Define the certificate policy (issuer, subject, validity period)
2. **Issue:** Request a certificate from a certificate authority (CA)
3. **Import:** Get back the signed certificate and private key
4. **Auto-renewal:** Key Vault automatically renews the certificate before expiry
5. **Retire:** Expired certificates remain in Key Vault for audit

**Supported certificate authorities:**
- [DigiCert](https://www.digicert.com/){:target="_blank" rel="noopener noreferrer"} (OV/EV certificates, Code Signing)
- [GlobalSign](https://www.globalsign.com/){:target="_blank" rel="noopener noreferrer"} (DV/OV/EV certificates)
- Self-signed (for testing and internal use)
- Imported certificates from any CA

**Characteristics:**
- Automatic renewal 30 days before expiry (can be customized)
- Email notifications on renewal failure
- Versioning—each certificate version represents a different cert from the CA
- Includes the private key (unlike AWS ACM which is public certificates only)
- Can be used by multiple applications or services (like Application Gateway, App Service, VMs)

**When to use certificates:**
- TLS/SSL for web applications (served by Application Gateway, App Service)
- mTLS between microservices
- Client certificates for VPN Gateway
- Signing code or packages
- Authentication in Azure services that accept certificates

**Comparison to AWS ACM:**
- Key Vault includes the private key; AWS ACM is public certificates only
- Key Vault auto-renews; AWS ACM requires external renewal management
- Key Vault works with any CA integration; AWS ACM has limited CA support

---

## Vault vs Managed HSM: When to Use Each

Azure provides two Key Vault SKUs with different security and compliance levels.

### Standard Vault (Software-Protected)

Standard Key Vault stores secrets and software-protected keys in encrypted storage managed by Azure. The encryption keys are managed by Microsoft and live in Azure data centers.

**Characteristics:**
- Lower cost
- All secret and key operations supported
- Audit trail through diagnostic logs
- No FIPS 140-2 Level 3 certification
- Single-tenant isolation but shared infrastructure

**When to use Standard Vault:**
- Development and non-compliance workloads
- Most production applications (compliance concerns are overblown for many organizations)
- Cost is a constraint
- You don't need cryptographic operations to be attested by external auditors

---

### Managed HSM (Hardware Security Module-Backed)

[Managed HSM](https://learn.microsoft.com/en-us/azure/key-vault/managed-hsm/){:target="_blank" rel="noopener noreferrer"} is a dedicated Hardware Security Module where keys are stored, and all cryptographic operations occur in hardened physical devices. The HSM itself never releases key material in plaintext.

**Characteristics:**
- FIPS 140-2 Level 3 certified (cryptographic hardware)
- All key and signing operations occur on the HSM
- Multi-part key ceremony for HSM initialization (physical security of key material)
- High availability and disaster recovery built-in
- Significantly higher cost
- Automatic rotation of HSM firmware and security patches
- Audit trail with cryptographic attestation

**When to use Managed HSM:**
- Regulatory compliance requires FIPS 140-3 or Common Criteria certification
- Cryptographic key operations must be attested and audited at the hardware level
- High-value keys (code signing, payment processing) require highest assurance
- Industry-specific compliance (financial services, healthcare, defense)
- Legal holds or e-discovery require immutable audit trails

**Key consideration:** Managed HSM is operationally simpler than managing CloudHSM but more expensive and restrictive in feature support. Certificate management from certificate authorities is not available on Managed HSM, along with some other advanced Key Vault features.

---

## Access Control: Vault Access Policies vs Azure RBAC

Key Vault supports two access control models, and Microsoft recommends gradually migrating from vault access policies to Azure RBAC.

### Vault Access Policies (Legacy Model)

Vault access policies are attachment-based. You grant permissions directly on the vault resource, scoped to specific operations like get, list, delete, sign, verify, and others.

**How it works:**
1. You have a vault `my-vault`
2. You grant user/app identity X permission to "get" and "list" secrets
3. User/app identity X can call `get-secret` and `list-secrets` operations
4. Permissions are managed on the vault level, not at the object level

**Characteristics:**
- Granular operations (get, list, delete, sign, verify, wrap, unwrap)
- Does not integrate with Azure RBAC
- Access is binary—either the identity has permission or it doesn't
- Difficult to audit across multiple vaults
- Management plane and data plane permissions mixed together

**Migration to RBAC:** Microsoft is phasing out vault access policies in favor of Azure RBAC. New vaults default to RBAC-only mode.

### Azure RBAC (Recommended Model)

Azure RBAC is the unified access control mechanism across all Azure services. Key Vault integrates with Azure RBAC for both management plane and data plane access.

**How it works:**
1. You have a vault `my-vault`
2. You assign the role `Key Vault Secrets User` to user/app identity X
3. User/app identity X can read secrets from this vault
4. The role is assigned at the vault scope or a broader resource group scope

**Key Vault roles:**

| Role | Permissions | Use Case |
|------|-------------|----------|
| **Key Vault Administrator** | Full management plane access (create, delete vaults) | Vault operators |
| **Key Vault Secrets Officer** | Management plane access to secrets (create, delete, update) | Secret lifecycle management |
| **Key Vault Secrets User** | Data plane access to read secrets | Application runtime |
| **Key Vault Crypto Officer** | Management plane access to keys | Key lifecycle management |
| **Key Vault Crypto User** | Data plane access to use keys (encrypt, decrypt, sign, verify) | Application runtime using keys |
| **Key Vault Certificate Officer** | Management plane access to certificates | Certificate lifecycle management |

**Characteristics:**
- Centralized with all other Azure RBAC roles
- Separates data plane (runtime access to secrets/keys) from management plane (creating/deleting vault resources)
- Integrated with Azure RBAC audit logs
- Supports custom roles for fine-grained permissions
- Easier to audit across multiple vaults and subscriptions

**Migration best practice:** Enable RBAC-only mode on new vaults. For existing vaults, gradually migrate service principals and users from vault access policies to RBAC, then disable vault access policies.

### Management Plane vs Data Plane

This distinction is important for access control design.

**Management plane:**
- Creating, deleting, and configuring Key Vault resources
- Requires `Microsoft.KeyVault/*` actions
- Typically limited to vault administrators

**Data plane:**
- Reading and using secrets, keys, and certificates
- Requires specific operations like `secrets/get`, `keys/sign`, `certificates/get`
- Typically granted to applications and users who need to access data

An application running in production needs data plane access to read a secret. The operations team needs management plane access to create and delete vaults.

---

## Key Vault Networking: Private Endpoints and Firewall Rules

### Network Isolation

By default, Key Vault accepts traffic from the public internet. For security and compliance, you can restrict access through networking controls.

**Networking options:**
- **Firewall rules:** Allow traffic from specific IP addresses or VNet subnets
- **Private Endpoints:** Assign a private IP within your VNet, disable public endpoint
- **Service endpoints:** Optimize traffic from specific VNet subnets (no private IP)
- **Trusted services bypass:** Allow specific Azure services through even when firewall is enabled

### Private Endpoints for Key Vault

[Private Endpoints](https://learn.microsoft.com/en-us/azure/key-vault/general/private-link-service){:target="_blank" rel="noopener noreferrer"} create a private IP address inside your VNet for Key Vault. Applications inside the VNet connect to this private IP, eliminating public internet exposure.

**How it works:**
1. Create a Private Endpoint for your Key Vault in a subnet
2. Configure a private DNS zone so `my-vault.vault.azure.net` resolves to the private IP
3. Applications in the VNet connect to the private IP without any code changes
4. Optionally disable the public endpoint entirely

**When to use Private Endpoints:**
- Compliance requires no public internet exposure for secrets
- Multi-tenancy requires isolation between customers
- Applications are in AKS or Virtual Networks
- Hybrid connectivity (on-premises) needs to access the vault

### Firewall Rules and Network Rules

Instead of Private Endpoints, you can use firewall rules to allow traffic from specific sources.

**Rules apply to:**
- Public IP addresses (your office, VPN)
- VNet subnets (via service endpoints)
- Azure services with trusted service bypass

**When to use firewall rules:**
- Simpler than Private Endpoints for small deployments
- Applications outside VNets need access
- Public IP addresses are stable (office, VPN gateway)

**Example networking pattern:**
```
Azure VM in VNet subnet 10.0.2.0/24 → Private Endpoint (private IP 10.0.3.4) → Key Vault
On-premises office (public IP 203.0.113.5) → Firewall rule allows IP → Key Vault public endpoint
Azure Backup → Trusted service bypass → Key Vault public endpoint (no firewall rule needed)
```

---

## Integration Patterns

### Pattern 1: App Service with Key Vault References

App Service can reference Key Vault secrets directly in configuration without storing values in app settings. At runtime, App Service resolves the reference to the actual secret.

**How it works:**
1. Assign a managed identity to your App Service
2. Grant the identity `Key Vault Secrets User` RBAC role on the vault
3. In application settings, use reference syntax: `@Microsoft.KeyVault(SecretUri=https://my-vault.vault.azure.net/secrets/my-secret/)`
4. The application reads the setting as a normal configuration value
5. App Service resolves it to the secret at runtime

**Benefits:**
- No code changes needed
- Secret rotation does not require redeployment
- Audit trail shows App Service accessed the secret
- Works with any application framework

---

### Pattern 2: AKS with Key Vault CSI Driver

The [Key Vault CSI (Container Storage Interface) driver](https://learn.microsoft.com/en-us/azure/aks/csi-secrets-store-driver){:target="_blank" rel="noopener noreferrer"} for AKS allows Kubernetes pods to mount secrets as files from Key Vault.

**How it works:**
1. Enable the CSI driver on your AKS cluster
2. Create a SecretProviderClass that defines which secrets to mount
3. Assign a workload identity (Azure OIDC identity) to the pod service account
4. Grant the identity permissions on Key Vault
5. At pod startup, the driver mounts secrets as files at a specified path
6. The application reads secrets from the filesystem

**Benefits:**
- Native Kubernetes pattern (file-based secrets)
- No application code changes
- Automatic secret rotation (driver re-mounts)
- Supports selective secret mounting

---

### Pattern 3: VM Disk Encryption with Key Vault Keys

[Azure Disk Encryption](https://learn.microsoft.com/en-us/azure/virtual-machines/disk-encryption-overview){:target="_blank" rel="noopener noreferrer"} encrypts OS and data disks on VMs using encryption keys stored in Key Vault.

**How it works:**
1. Create an encryption key in Key Vault (RSA 4096-bit recommended)
2. Configure the VM with a Key Encryption Key (KEK) pointing to the vault
3. Enable encryption on the VM's OS and data disks
4. The VM boots and the encryption service retrieves the key from Key Vault to decrypt the disk

**Benefits:**
- Encryption keys stored outside the VM
- Regulatory compliance for at-rest encryption
- Keys can be rotated without disk re-encryption
- Multiple VMs can share the same key in vault

**Common pitfall:** If you lose the Key Vault key, encrypted disks become inaccessible. Always maintain backups and never delete keys without ensuring all disks have been re-encrypted with a new key.

---

### Pattern 4: Configuration Management with Key Vault

Many applications use a configuration service to manage settings across environments. Azure App Configuration integrates with Key Vault to reference sensitive values.

**How it works:**
1. Store non-sensitive configuration in App Configuration
2. Store sensitive values in Key Vault
3. In App Configuration, create a reference to the Key Vault secret
4. Applications connect to App Configuration, which resolves references to Key Vault
5. Both services are accessed with managed identities

**Benefits:**
- Centralized configuration management
- Clear separation of sensitive and non-sensitive values
- Easy to promote configuration across environments (dev, staging, prod)

---

## Soft Delete and Purge Protection

Key Vault protects against accidental deletion with soft delete and purge protection.

### Soft Delete (Enabled by Default)

When you delete a secret, key, or certificate, it moves to a soft-deleted state rather than being permanently removed. The object remains accessible for 90 days (configurable up to 365 days) and can be recovered.

**Characteristics:**
- Automatic; all deletions are soft by default
- Deleted objects are not visible in list operations but can be explicitly listed
- Occupies quota space; deleting many objects can fill the vault if not purged
- Soft-deleted objects cannot be undeleted once the retention period expires

**When soft delete matters:** A developer accidentally deletes the database password secret. Within the retention period, you can recover it without restoring from backup.

### Purge Protection

Purge protection prevents even administrators from permanently deleting objects. Once enabled, you cannot purge an object; you can only delete and recover, but never permanently remove it.

**When to use purge protection:**
- Regulatory compliance requires immutable audit trails
- Legal holds require preserved deleted secrets
- You never want accidental permanent deletion

**Trade-off:** You cannot completely remove deleted objects, so vault space occupied by soft-deleted objects cannot be reclaimed.

---

## Key Rotation Strategies

### Key Rotation for Encryption Keys

When you rotate an encryption key, all data encrypted with the old key must be re-encrypted with the new key.

**Approach 1: Application-driven re-encryption**
1. Create a new key version in Key Vault
2. Update application configuration to use the new key
3. During normal operations, the application re-encrypts data encrypted with the old key
4. After all data is re-encrypted, retire the old key

**Approach 2: Offline bulk re-encryption**
1. Create a new key version
2. Run a batch job that reads data encrypted with the old key, decrypts it, re-encrypts with the new key, and writes it back
3. Monitor until all data is converted
4. Retire the old key

**Approach 3: Key wrapping pattern (recommended for envelope encryption)**
1. Instead of re-encrypting all data, rotate only the key-encryption-key (KEK)
2. Data remains encrypted with data-encryption-keys (DEKs) stored in Key Vault
3. Rotate the KEK and re-wrap the DEKs
4. The underlying encrypted data does not change

**Practical reality:** Most organizations implement a hybrid approach. Data that is rarely accessed uses Approach 1 (automatic re-encryption on read). High-volume data uses Approach 3 (key wrapping).

### Automatic Secrets Rotation

Unlike keys, secrets cannot be automatically rotated by Key Vault alone. You need an external service to detect the rotation requirement and update the secret.

**Pattern with managed identities:**
1. Create a rotation function (Azure Function or Logic App) triggered on a schedule
2. Grant the function identity permission to update secrets in Key Vault
3. The function connects to the service (database, API) and rotates the credential
4. The function updates the secret in Key Vault with the new value
5. Applications pick up the new value on their next read

**Example:** A database password rotation function:
1. Connects to the database using the current password
2. Changes the password in the database
3. Updates the secret in Key Vault with the new password
4. Applications get the new password from Key Vault

---

## Soft Delete Interaction with Key Rotation

When you create a new key version, the old version is not deleted; it becomes inaccessible (cannot be used for new operations) but remains in soft-deleted state.

**Implication for rotation:** If you rotate a key 50 times, all 50 old versions are soft-deleted but still occupy space in the vault. You can purge old versions manually, but purge protection prevents this if enabled.

**Best practice:** Regularly purge old key versions that you no longer need for decryption of legacy data. Document your key rotation schedule so you know when an old key can safely be purged.

---

## Common Pitfalls

### Pitfall 1: Storing Connection Strings with Credentials as Secrets

**Problem:** A database connection string containing username and password is stored as a single secret. When the password rotates, you need to update the entire connection string.

**Result:** Applications cache the secret. Password rotation fails because apps still use the old connection string.

**Solution:** Store username and password separately as individual secrets. Applications construct the connection string at runtime, ensuring they always get the latest password. Or use managed identities for databases (Azure SQL) so you don't need passwords at all.

---

### Pitfall 2: Not Restricting Data Plane Access to Secrets

**Problem:** You grant `Key Vault Secrets Officer` role to applications, giving them permission to create, update, and delete secrets.

**Result:** An application compromise allows attackers to modify or create new secrets. If an attacker adds a new secret with a password you control, they maintain access even after you change the real password.

**Solution:** Use `Key Vault Secrets User` for applications; it only allows reading (get, list). Reserve `Key Vault Secrets Officer` for human operators who legitimately manage secrets.

---

### Pitfall 3: Enabling Both Vault Access Policies and Azure RBAC Without Clear Ownership

**Problem:** You have some permissions defined in vault access policies and other permissions in Azure RBAC. It is unclear which model controls what.

**Result:** Access control is unpredictable; sometimes policies work, sometimes RBAC takes priority.

**Solution:** Pick one model and standardize. Migrate from vault access policies to Azure RBAC on new vaults. For existing vaults, establish a migration timeline and move all principals off vault access policies.

---

### Pitfall 4: Deleting Key Vault When Encrypted Resources Depend On It

**Problem:** A VM has an encrypted disk encrypted with a key in Key Vault. You delete the vault (even soft-deleted) and then purge it.

**Result:** The disk remains encrypted with a key that no longer exists. The VM cannot decrypt the disk and becomes unusable. Backups are also encrypted with the same key.

**Solution:** Before deleting a Key Vault, audit all resources that depend on it. If encrypted resources exist, either re-encrypt them with a different key or maintain the vault indefinitely. Use purge protection to prevent accidental permanent deletion.

---

### Pitfall 5: Not Setting Up Monitoring and Alerts

**Problem:** A secret is accessed thousands of times by a compromised application, and you have no visibility.

**Result:** The breach goes undetected for days or weeks.

**Solution:** Enable diagnostic logging on Key Vault. Stream logs to a Log Analytics workspace. Create alerts for unusual access patterns (many failures, unexpected operations, access outside business hours).

---

### Pitfall 6: Vault Access Policies Preventing RBAC Migration

**Problem:** A vault has vault access policies enabled. You try to assign Azure RBAC roles and they have no effect.

**Result:** Access control is unpredictable; sometimes policies work, sometimes RBAC takes priority.

**Solution:** Disable vault access policies on the vault (setting the permission model to RBAC-only). Migrate all principals from vault access policies to Azure RBAC roles. Test thoroughly before disabling policies.

---

## Key Takeaways

1. **Key Vault is your single source of truth for secrets, keys, and certificates.** Never store cryptographic material or credentials in application code, configuration files, or environment variables. Always use Key Vault.

2. **Secrets, keys, and certificates serve different purposes and have different operations.** Secrets are retrieved as values. Keys are used for cryptographic operations that happen inside the vault. Certificates bundle a key and a certificate for TLS and authentication.

3. **Standard Vault is sufficient for most applications.** Managed HSM is only needed when compliance requires FIPS 140-2 Level 3 hardware certification or cryptographic attestation.

4. **Use Azure RBAC for access control, not vault access policies.** RBAC integrates with all Azure services, has a clearer permission model, and is easier to audit. Vault access policies are being deprecated.

5. **Separate data plane access (what applications need) from management plane access (what operators need).** Applications should have `Key Vault Secrets User` or `Key Vault Crypto User` roles. Only operators get Officer roles for managing vault contents.

6. **Use Private Endpoints for high-security workloads.** If your application is in a VNet and compliance requires no public internet exposure, deploy a Private Endpoint and disable the public endpoint.

7. **Soft delete is enabled by default but does not prevent permanent loss.** Deleted objects remain recoverable for 90 days. After that, they are purged. Enable purge protection for objects that must never be deleted, and disable it before you can completely remove them.

8. **Key rotation requires application code changes or automated services.** For encryption keys, you must re-encrypt data or use key wrapping. For secrets, you need a rotation service that updates the secret and coordinates with dependent applications.

9. **Audit what accesses your vault.** Enable diagnostic logging and monitor for unusual access patterns. A compromised application accessing secrets thousands of times will be visible in logs.

10. **Don't delete Key Vaults that have encrypted resources depending on them.** A deleted vault's keys cannot decrypt data. Maintain the vault indefinitely or re-encrypt before deletion. Use purge protection to prevent accidental permanent deletion.
