---
title: "Azure Key Vault for System Architects"
layout: guide
category: Azure
subcategory: Security and Compliance
description: "Choosing between Standard vaults, Premium vaults, and Managed HSM; the control-plane and data-plane split that governs Key Vault access; what rotation actually automates; and the throttling, caching, and soft-delete behavior that breaks designs in production."
tags: [security, key-vault, secrets-management, encryption, managed-identity, rbac, practical]
---

## What Is Azure Key Vault

[Azure Key Vault](https://learn.microsoft.com/en-us/azure/key-vault/general/overview){:target="_blank" rel="noopener noreferrer"} stores cryptographic keys, passwords, API tokens, and certificates outside application code and configuration. Applications fetch values at runtime using a Microsoft Entra identity, which produces an audit trail and lets credentials rotate without a redeploy.

Key Vault holds three object types with separate APIs, separate permissions, and separate lifecycles: keys (used inside the vault for cryptographic operations), secrets (retrieved as values), and certificates (X.509 material with managed renewal). A fourth type, managed storage account keys, is deprecated in favor of Microsoft Entra authorization for Azure Storage.

### What Problems Key Vault Solves

**Without Key Vault:**
- Secrets embedded in code, configuration files, or environment variables
- No central audit of who read what and when
- Credential rotation requires a code change and a redeploy
- No hardware-backed key protection for regulated workloads
- Secrets committed to version control

**With Key Vault:**
- Secrets held outside the application, fetched by managed identity
- Data-plane audit logs for every read
- Certificate and key renewal without touching the application
- HSM-backed keys on the Premium tier or in Managed HSM
- Access controlled through Azure RBAC at vault or object scope

### Scope and Naming

A vault is a **regional** resource inside a resource group, but its name is part of a **global** DNS name (`<vault-name>.vault.azure.net`), so vault names are globally unique across all of Azure. Vault and Managed HSM names are 3 to 24 characters of `0-9`, `a-z`, `A-Z`, and hyphens, with no consecutive hyphens. Object names are 1 to 127 characters of the same alphabet, and each version identifier is a system-generated 32-character string.

That global name has a consequence at deletion time. A soft-deleted vault's name cannot be reused until its retention period expires, so a "delete and recreate with the same name" recovery plan does not work.

### How Key Vault Differs from AWS Equivalents

AWS splits these responsibilities across separate services. Azure consolidates them into one resource with distinct object types.

| Concept | AWS | Azure Key Vault |
|---------|-----|-----------------|
| **Cryptographic keys** | AWS KMS | Key Vault keys (software, or HSM on Premium) |
| **Passwords and tokens** | AWS Secrets Manager | Key Vault secrets |
| **TLS certificates** | AWS Certificate Manager (ACM) | Key Vault certificates |
| **Dedicated HSM** | CloudHSM (you manage the cluster) | Managed HSM (single-tenant, Microsoft-operated) |
| **Access control** | IAM policies | Azure RBAC (recommended) or vault access policies |
| **Key operations** | Encrypt, decrypt, sign, verify, HMAC | Encrypt, decrypt, sign, verify, wrap, unwrap |
| **Certificate private keys** | ACM holds them but restricts export | Exportable if the certificate policy allows it |
| **Automatic renewal** | ACM renews certificates it issued | Auto-renewal with integrated issuers only |
| **Audit trail** | CloudTrail | Key Vault diagnostic logs plus Azure Activity Log |

---

## Choosing a Container: Standard, Premium, or Managed HSM

Key Vault's resource provider exposes two resource types, **vaults** and **managed HSMs**, and vaults come in two tiers. Treating this as one ladder is the most common modelling error, because Managed HSM is not a higher vault tier. It stores keys and nothing else.

| | Standard vault | Premium vault | Managed HSM |
|---|---|---|---|
| **Secrets** | Yes | Yes | No |
| **Certificates** | Yes | Yes | No |
| **Software-protected keys** | Yes | Yes | No |
| **HSM-protected keys** | No | Yes | Yes |
| **Symmetric (AES) keys** | No | Preview, HSM-backed only | Yes |
| **Tenancy** | Multi-tenant | Multi-tenant | Single-tenant, dedicated |
| **Key compliance** | FIPS 140-2 Level 1 | FIPS 140-3 Level 3 (HSM Platform 2) | FIPS 140-2 Level 3 |
| **Access control** | Azure RBAC or access policies | Azure RBAC or access policies | Managed HSM local RBAC |

Two entries in that table decide designs. Symmetric AES keys are **not** available in Standard vaults at all, and in Premium they are HSM-backed and still in public preview, so a design that stores an AES key for envelope encryption belongs in Managed HSM. And Premium vault keys now reach FIPS 140-3 Level 3 on HSM Platform 2, which protects all new keys and key versions, so the older assumption that Level 3 requires a dedicated HSM no longer holds.

**Supported key material:** RSA at 2048, 3072, and 4096 bits; EC on P-256, P-384, P-521, and secp256k1 (P-256K). Operations are encrypt, decrypt, sign, verify, wrapKey, and unwrapKey, and the private material never leaves the vault.

```
Which container do you need?

Do you need secrets or certificates?
├─ Yes ──> A vault. Managed HSM stores keys only.
│          │
│          ├─ Keys must be HSM-protected, or you need
│          │  FIPS 140-3 Level 3 ──> Premium vault
│          └─ Otherwise ──────────> Standard vault
│
└─ No, keys only
   ├─ Single-tenant hardware, a customer-controlled security
   │  domain, or symmetric AES keys in production ──> Managed HSM
   └─ Otherwise, HSM keys in a shared service ────> Premium vault
```

**What Managed HSM adds beyond the key type:** dedicated single-tenant HSM instances, a security domain established through a multi-party key ceremony so Microsoft cannot recover your keys, and its own local RBAC model that is separate from Azure RBAC. It also carries its own limits: 5 HSM instances per subscription per region, 5,000 keys per instance, and 100 versions per key.

**What it costs you:** the price is substantially higher, the key ceremony is an operational commitment, and none of the vault conveniences (certificate issuance, secrets, App Service references) are available.

---

## Key Vault Objects

### Secrets

[Secrets](https://learn.microsoft.com/en-us/azure/key-vault/secrets/about-secrets){:target="_blank" rel="noopener noreferrer"} store arbitrary octet sequences up to **25 KB**, returned to callers as strings. Key Vault attaches no meaning to the contents. A `contentType` field of up to 255 characters exists purely as a hint for your own code.

**Characteristics:**
- Every write creates a new version, and any previous version stays retrievable by its identifier
- Up to 15 tags per secret, with 512-character names and values
- Anyone with `list` or `get` permission can read tags, so tags are not a place for sensitive metadata
- Key Vault never rotates a secret on its own

**Expiry is informational, not enforced.** The `exp` and `nbf` attributes on a secret document intent. A `get` on an expired secret still succeeds, which is deliberate so that recovery operations remain possible. Do not treat an expiry date as a control that stops a stale credential from being used. Its practical value is that it drives the near-expiry and expired events described under rotation below.

### Keys

[Keys](https://learn.microsoft.com/en-us/azure/key-vault/keys/about-keys){:target="_blank" rel="noopener noreferrer"} stay inside the vault. The application sends data in and gets a result back, so the raw key material is never exposed to the caller or to Microsoft.

**When to use keys rather than secrets:**
- Encrypting application data before it lands in a database
- Signing tokens
- Wrapping and unwrapping data encryption keys (envelope encryption)
- Customer-managed keys for Azure service encryption at rest
- Anything where the audit requirement is that the key never left the boundary

Key Vault publishes an `hsmPlatform` attribute on each key version, which is how you tell whether a given version is protected by the FIPS 140-2 Level 2 platform or the current FIPS 140-3 Level 3 one.

### Certificates

A [Key Vault certificate](https://learn.microsoft.com/en-us/azure/key-vault/certificates/about-certificates){:target="_blank" rel="noopener noreferrer"} is not a fourth object type sitting alongside the others. Creating one creates three addressable objects that share a name.

```
Create certificate "web-tls"
          │
          ├──> /certificates/web-tls   X.509 metadata, policy, lifetime actions
          ├──> /keys/web-tls           the private key, operations mapped from
          │                            the policy's X.509 keyusage flags
          └──> /secrets/web-tls        the full bundle (PFX or PEM), and this
                                       is where the private key comes out

  Access control on each of the three is independent. Granting
  "Key Vault Secrets User" on the vault therefore hands out the
  private key of every certificate in it.
```

That last point is the practical consequence. The `Key Vault Secrets User` role is documented as reading "secret contents including secret portion of a certificate with private key." If a certificate's policy marks its key exportable, a secrets reader can retrieve the private key. Mark keys non-exportable when the application only needs to use the certificate, not possess it, and note that HSM-protected keys are always non-exportable.

**Renewal:** the certificate policy holds lifetime actions, each with a trigger (a number of days before expiry, or a percentage of the certificate's lifetime) and an action (`autoRenew` or `emailContacts`). There is no single fixed default. The trigger is whatever the policy sets.

**Issuers:** Key Vault integrates with **DigiCert** and **GlobalSign** for OV and EV TLS certificates, and only those integrations support automatic renewal. Certificates from any other CA can be imported and managed, but Key Vault will not renew them. Self-signed certificates are supported for internal and test use.

Certificate contacts are configured per vault, not per certificate, so every lifecycle notification from that vault goes to the same address list.

---

## Access Control: Two Planes, Two Models

Key Vault access splits along two axes that are frequently confused: which *plane* you are operating on, and which *model* authorizes the data plane.

```
                      Caller (user or managed identity)
                                    │
              ┌─────────────────────┴──────────────────────┐
              v                                            v
     CONTROL PLANE                                   DATA PLANE
  management.azure.com                        <vault>.vault.azure.net
              │                                            │
  Create/delete vaults                        Read and write keys,
  Set network rules                           secrets, certificates
  Set access policies                                      │
              │                                            │
  Authorized by:                              Authorized by EITHER:
  Azure RBAC only                               Azure RBAC  (recommended)
  (Key Vault Contributor)                       OR vault access policies
              │                                            │
  NOT subject to the                          Subject to the vault
  vault firewall                              firewall and private endpoint
```

The bottom row matters more than it looks. Vault firewall rules apply only to the data plane. Deploying a secret through an ARM or Bicep template goes through `management.azure.com` and is unaffected by network rules, so a vault that looks network-isolated is still writable from anywhere by a control-plane caller with the right role.

### The Privilege Escalation Path

`Key Vault Contributor` is a control-plane role and grants no data access on its own. But on a vault using the access policy model, a control-plane contributor can set an access policy granting *themselves* data access. Microsoft calls this out explicitly. Control-plane contributor rights on an access-policy vault are effectively data access, which is one of the stronger arguments for the RBAC model, where data permissions require separate role assignments.

### Azure RBAC (Recommended)

Every built-in Key Vault role listed below is a **data plane** role. None of them create, delete, or configure vaults. That is `Key Vault Contributor` on the control plane.

| Role | Grants | Typical assignee |
|------|-------------|----------|
| **Key Vault Administrator** | All data plane operations on all object types. Cannot manage the vault resource or role assignments | Break-glass operators |
| **Key Vault Reader** | Metadata of the vault and its objects. Cannot read secret values or key material | Auditors, inventory tooling |
| **Key Vault Secrets Officer** | Any action on secrets except managing permissions | Human secret lifecycle owners |
| **Key Vault Secrets User** | Read secret contents, including the private key portion of an exportable certificate | Application runtime |
| **Key Vault Crypto Officer** | Any action on keys except managing permissions, including rotation policy | Key lifecycle owners |
| **Key Vault Crypto User** | Cryptographic operations using keys | Application runtime |
| **Key Vault Crypto Service Encryption User** | Key metadata plus wrap and unwrap | Azure services using customer-managed keys |
| **Key Vault Certificates Officer** | Any action on certificates except managing permissions | Certificate lifecycle owners |
| **Key Vault Certificate User** | Read the whole certificate, including its secret and key portions | Application runtime |
| **Key Vault Purge Operator** | Permanently delete soft-deleted objects and vaults | Deliberately rare |
| **Key Vault Data Access Administrator** | Assign and remove the Key Vault data plane roles above, constrained by an ABAC condition | Delegated access administration |

Roles can be assigned at management group, subscription, resource group, vault, or individual object scope. **Object-scope assignments are not an isolation mechanism.** Microsoft's guidance is a vault per application per environment, because any administrative operation (network rules, monitoring, object management) needs vault-level permission and therefore exposes every object in it. Attribute-based conditions on secret data actions are available in preview for narrower constraints.

### Vault Access Policies Are Legacy, Not Deprecated

Access policies grant data plane operations directly on the vault resource. They are the older model, Azure RBAC is what Microsoft recommends, and **both remain fully supported**. There is no announced retirement for access policies.

What *is* changing has a date. From API version `2026-02-01`, new vaults default to Azure RBAC (`enableRbacAuthorization = true`), and creating a vault on access policies now requires setting that property to `false` explicitly. Existing vaults keep whatever model they have. Separately, **all Key Vault control plane API versions before 2026-02-01 retire on February 27, 2027.** Vaults keep working, but they become manageable only through the newer API, which means ARM and Bicep templates, Terraform providers, SDKs, and scripts all need their API version raised, along with Azure CLI 2.90.0 or later and Azure PowerShell 16.3.0 or later.

**The two models are exclusive, not layered.** A vault is either on RBAC or on access policies. Switching a vault to the RBAC model invalidates all of its access policy permissions at once, which causes an outage if the equivalent role assignments are not already in place. Plan the migration as assign-then-switch, never switch-then-assign.

---

## Networking

A new vault has its firewall **disabled**, meaning any network can reach the data plane. That is not the same as open access, since Entra authentication and authorization still apply, but it does mean network isolation is something you turn on.

### The Options

| Control | What it does | Where it fits |
|---|---|---|
| **IP rules** | Allow specific public IPv4 addresses and CIDR ranges | Offices and VPN egress with stable addresses |
| **Virtual network rules** | Allow specific subnets via service endpoints | Azure workloads that keep a public path |
| **Private endpoint** | A private IP for the vault inside your VNet | Compliance requiring no public data path |
| **Trusted services bypass** | Exempt a fixed list of first-party Azure services | Backup, disk encryption, and similar integrations |
| **Network Security Perimeter** | A logical isolation boundary across PaaS resources | Estate-wide egress and ingress governance |

**Limits to design around:** 200 virtual network rules and 1,000 IPv4 rules per vault. RFC 1918 private ranges are rejected in IP rules, and only IPv4 is supported.

### Two Bypass Behaviors That Surprise People

**Trusted services survive `publicNetworkAccess = Disabled`.** Turning off public access does not stop trusted first-party services from reaching the vault, and they do not need a private endpoint. The trusted list covers services where Microsoft controls all executing code, which is why Azure DevOps is *not* on it: user-authored pipeline code runs there. Services absent from that list are blocked whether or not the bypass is enabled.

**A Network Security Perimeter overrides the bypass.** Setting public network access to "Secure by perimeter" blocks even trusted services unless an explicit perimeter access rule admits them. Private endpoint traffic is exempt from perimeter rules entirely.

### Private Endpoints

A private endpoint gives the vault a private IP inside your VNet. Configure a private DNS zone so `<vault>.vault.azure.net` resolves to it, and applications connect without a code change.

The vault's public DNS name keeps resolving from the internet even after public access is disabled. That is by design for the Private Link DNS overlay, and it discloses nothing: the public ingress refuses every request, and resolution reveals no private IP, network rule, or data.

Expect one confusing log artifact. An App Service or Function reaching a network-restricted vault often logs a failed 403 `SecretGet` from its public outbound IP, followed immediately by a successful one from its private IP. Both entries are by design.

---

## Rotation: What Is Automated and What Is Not

Keys and certificates have first-party rotation. Secrets do not. Confusing the three is how rotation programs stall.

### Keys: Rotation Policies Are Built In

Each key can carry a [rotation policy](https://learn.microsoft.com/en-us/azure/key-vault/keys/how-to-configure-key-rotation){:target="_blank" rel="noopener noreferrer"} that creates a new key version automatically.

**Policy settings:**
- **Expiry time**, applied to newly rotated versions rather than the current one
- **Rotation type**, either a fixed interval after creation (the default) or a period before expiry
- **Rotation time**, with a minimum of seven days from creation and seven days from expiry
- **Notification time**, which drives the near-expiry Event Grid event

```json
{
  "lifetimeActions": [
    { "trigger": { "timeAfterCreate": "P18M" }, "action": { "type": "Rotate" } },
    { "trigger": { "timeBeforeExpiry": "P30D" }, "action": { "type": "Notify" } }
  ],
  "attributes": { "expiryTime": "P2Y" }
}
```

Managing the policy requires `Key Vault Crypto Officer`, and each scheduled rotation carries a charge.

**Rotation re-wraps, it does not re-encrypt.** This is the part most rotation designs get backwards. A new key version wraps the data encryption keys again; the underlying ciphertext is untouched. Both the old and new key versions must stay enabled until re-wrapping finishes, because existing data is still protected by DEKs wrapped under the old version. For Azure services using customer-managed keys, point them at the **versionless** key URI so they pick up new versions, and expect detection to take anywhere from one hour to more than 24 depending on the service. Your own encryption code should store the **versioned** URI alongside the ciphertext so it can always find the version that can unwrap it.

You can enforce rotation across an estate with the built-in Azure Policy definition requiring keys to have a rotation policy within a specified number of days.

### Secrets: You Build the Rotation

Key Vault will not change a password in a database for you. The supported pattern is event-driven rather than polled.

1. Set an expiry date on the secret and configure the notification window
2. Create an Event Grid system topic on the vault and subscribe to `Microsoft.KeyVault.SecretNearExpiry`
3. Route it to a Function or Logic App holding a managed identity with `Key Vault Secrets Officer`
4. The handler authenticates to the backing service, rotates the credential there, and writes the new value as a new secret version
5. Applications pick up the new version on their next read

Two constraints shape this. Events fire only on **new versions** of an object, and only if you subscribed on the vault beforehand. There is no backfill. And near-expiry for secrets and certificates fires at a fixed 30 days before expiration, while key near-expiry is the one that is configurable through the rotation policy.

**Key Vault Event Grid event types:**

| Object | Near expiry | Expired | New version |
|---|---|---|---|
| Secrets | `Microsoft.KeyVault.SecretNearExpiry` | `Microsoft.KeyVault.SecretExpired` | `Microsoft.KeyVault.SecretNewVersionCreated` |
| Keys | `Microsoft.KeyVault.KeyNearExpiry` | `Microsoft.KeyVault.KeyExpired` | `Microsoft.KeyVault.KeyNewVersionCreated` |
| Certificates | `Microsoft.KeyVault.CertificateNearExpiry` | `Microsoft.KeyVault.CertificateExpired` | `Microsoft.KeyVault.CertificateNewVersionCreated` |

A tenth event, `Microsoft.KeyVault.VaultAccessPolicyChanged`, fires when an access policy changes, including when the permission model is switched to or from Azure RBAC. Subscribing to it is a cheap detection control for exactly the escalation path described earlier.

---

## Integration Patterns

### Pattern 1: App Service and Functions with Key Vault References

Set an app setting to `@Microsoft.KeyVault(SecretUri=https://my-vault.vault.azure.net/secrets/my-secret)` and the platform resolves it before the application reads it. No SDK, no code change.

**Setup:**
1. Give the app a managed identity, which references use in its **system-assigned** form by default
2. Grant that identity `Key Vault Secrets User` (or the `Get` secrets permission on an access-policy vault)
3. Write the reference as the setting value, versioned or versionless

To use a user-assigned identity instead, set the app's `keyVaultReferenceIdentity` property to that identity's resource ID. This applies to every Key Vault reference in the app, not per setting, and it is the answer when the app must reference secrets at creation time, before a system-assigned identity exists.

**Rotation is not instant, and this is the detail that bites.** App Service caches resolved reference values and refetches them **every 24 hours**. A versionless reference does pick up a rotated secret, but up to a day later. Three things shorten that window: any configuration change to the app, which restarts it and refetches immediately; a POST to the `config/configreferences/appsettings/refresh` management endpoint; or a restart. Design rotation so the old credential stays valid across that window.

For network-restricted vaults, do not allow the app's public outbound IPs, which are not stable. Route the app through a VNet and allow that subnet. On Linux apps connecting to private endpoints, set `vnetRouteAllEnabled` to `true` (Flex Consumption function apps do this automatically).

### Pattern 2: AKS with the Secrets Store CSI Driver

The [Key Vault provider for the Secrets Store CSI driver](https://learn.microsoft.com/en-us/azure/aks/csi-secrets-store-driver){:target="_blank" rel="noopener noreferrer"} mounts vault objects into pods as files.

1. Enable the add-on on the cluster
2. Define a `SecretProviderClass` naming the vault and the objects to mount
3. Federate a workload identity to the pod's service account
4. Grant that identity the appropriate data plane role on the vault
5. The driver mounts the objects at a path at pod start

Rotation is a polling feature that has to be switched on, with a configurable interval, rather than something the driver does by default. A pod that reads its secret once at startup will hold the old value regardless of what the driver writes to the file, so the application has to re-read the file or the deployment has to restart.

### Pattern 3: Customer-Managed Keys for VM Disks

Azure managed disks are always encrypted at rest with platform-managed keys. Bringing your own key means one of these options, and the choice has changed.

| Option | Covers | Key Vault role | Uses VM CPU |
|---|---|---|---|
| **Server-side encryption with a disk encryption set** | OS and data disks | Premium vault or Managed HSM key | No |
| **Encryption at host** | OS, data, temp disks, caches, and traffic to storage | Premium vault or Managed HSM key | No |
| **Azure Disk Encryption (ADE)** | OS, data, temp disks, caches | Premium vault key, optionally a KEK | Yes |
| **Confidential disk encryption** | OS disk, bound to the VM's vTPM | Premium vault or Managed HSM key | Yes |

**Azure Disk Encryption retires on September 15, 2028.** ADE-enabled VMs keep running until then, but after that date encrypted disks fail to unlock on reboot, taking the workload down. Encryption at host is the replacement for new VMs, and every existing ADE VM, including its backups, needs migrating before the deadline. Encryption at host is also the only option Microsoft Defender for Cloud reports as healthy against its disk encryption recommendation.

Whichever option you pick, deleting the key kills the data. Enable purge protection on any vault holding a customer-managed key. Most Azure services that integrate with Key Vault for encryption require it for exactly this reason.

### Pattern 4: App Configuration with Key Vault References

Azure App Configuration stores non-sensitive settings and holds references to Key Vault secrets for the sensitive ones. The application talks to App Configuration, which resolves the reference. Both hops authenticate with managed identities, which keeps one configuration surface without putting secrets in it.

---

## Throttling and Scale

Key Vault is a shared, rate-limited service, and treating it as a configuration store that applications read on every request is the most common way to take an application down with it. Exceeding a limit returns HTTP 429.

**Per vault, per region, per 10 seconds:**

| Operation | Limit |
|---|---|
| Create secret, import certificate, import key (shared across all three) | 300 |
| All other secret, certificate, and vault transactions | 4,000 |
| RSA 2048 software key operations | 4,000 |
| RSA 2048 HSM key operations | 2,000 |
| RSA 4096 HSM key operations | 250 |
| Create or release key (HSM / software) | 10 / 20 |

The subscription-wide ceiling for all transaction types is five times the per-vault limit, so sharding across vaults inside one subscription buys less headroom than it appears to.

Two properties of this table drive design. The thresholds are **weighted and summed**, not independent, so an RSA 4096 HSM operation costs eight times an RSA 2048 one and mixed workloads consume a single shared budget. And the ceiling drops by an order of magnitude as key size rises, which makes RSA 4096 HSM keys a poor fit for anything on a per-request path.

**Design consequences:** cache secrets in the application rather than fetching per request, use a client library with built-in retry and exponential backoff on 429, and keep high-volume cryptographic operations off large HSM keys by using envelope encryption, wrapping a local data key once rather than calling the vault per operation.

Key Vault sets no limit on the number of objects in a vault or versions on an object, but backup of a single object fails above **500 versions**, and there is no way to delete old versions to get back under it. A key rotating monthly stays well clear; one rotating hourly does not.

---

## Soft Delete and Purge Protection

### Soft Delete

Soft delete is **on by default for new vaults and cannot be turned off** once enabled. A deleted vault or object enters a recoverable state instead of disappearing.

- Retention is configurable from **7 to 90 days**, defaulting to 90
- The retention interval is set **at vault creation and cannot be changed afterwards**
- The same interval governs both soft delete and purge protection
- Permanent deletion takes two operations, delete then purge, and purge needs a privileged role such as `Key Vault Purge Operator`
- At the end of retention, unrecovered objects are purged automatically and the deletion cannot be rescheduled

**Recovering a vault does not restore everything.** When a vault is soft-deleted, integrated services attached to it are deleted too, specifically **Azure RBAC role assignments and Event Grid subscriptions**. Recovery brings back the vault and its objects but not those. An accidental vault deletion is therefore also a silent loss of access configuration and of every rotation trigger built on Event Grid, both of which have to be recreated.

### Purge Protection

Purge protection is **not** enabled by default and requires soft delete. With it on, nothing can be purged before the retention period elapses, even by an owner.

It defers permanent deletion rather than preventing it. At the end of retention the object is purged. What purge protection buys is a guaranteed recovery window that no credential can shorten, which is why most Azure services that use Key Vault keys for encryption at rest require it.

**Trade-off:** the vault name and object names stay reserved for the full retention period, and you cannot shorten that window after the fact, so test-environment vaults that get created and destroyed frequently are a poor fit.

---

## Common Pitfalls

### Pitfall 1: Storing a Whole Connection String as One Secret

**Problem:** username and password live in a single connection string secret.

**Result:** rotating the password means rewriting the whole string, and every consumer that parsed or cached it holds a value that no longer authenticates.

**Solution:** store the credential separately from the rest of the connection information and assemble it at runtime. Better still, remove the secret entirely by using a managed identity against services that support it, such as Azure SQL and Storage. A secret you do not have cannot leak or expire.

---

### Pitfall 2: Giving Applications Officer Roles

**Problem:** an application identity is granted `Key Vault Secrets Officer` because it is the role that showed up first in the list.

**Result:** a compromised application can write secrets, not just read them. An attacker who plants a secret they control keeps access after you rotate the real credential, and the write looks like normal application activity in the logs.

**Solution:** `Key Vault Secrets User` for runtime, `Key Vault Crypto User` for key operations, `Key Vault Certificate User` for certificates. Officer roles belong to humans and rotation functions. Remember that a secrets reader can also retrieve the private key of any exportable certificate in the vault, so separate certificate vaults from secret vaults when that matters.

---

### Pitfall 3: Switching the Permission Model Before Assigning Roles

**Problem:** a vault on access policies is flipped to the Azure RBAC model as the first step of a migration.

**Result:** every access policy permission is invalidated at that instant. Applications lose data plane access immediately and fail with 403s, and the outage lasts until equivalent role assignments are in place and have propagated.

**Solution:** assign the equivalent RBAC roles first, verify them while the vault is still on access policies, then switch the model. Note also that changing the model requires unrestricted `Microsoft.Authorization/roleAssignments/write`, which the restricted `Key Vault Data Access Administrator` role does not carry.

---

### Pitfall 4: Assuming the Firewall Protects the Whole Vault

**Problem:** network rules are configured and the vault is treated as unreachable from outside the allowed networks.

**Result:** control plane operations ignore firewall rules entirely. A pipeline can still write secrets through an ARM or Bicep deployment from anywhere, and anyone with `Key Vault Contributor` on an access-policy vault can grant themselves data access without touching the network path.

**Solution:** treat network rules as a data plane control and pair them with control plane RBAC discipline. Alert on `Microsoft.KeyVault.VaultAccessPolicyChanged` events, and prefer the RBAC model so that control plane rights do not convert into data access.

---

### Pitfall 5: Deleting a Vault That Encrypted Resources Depend On

**Problem:** a vault holding a disk encryption key or a storage customer-managed key is deleted, then purged.

**Result:** the encrypted resources cannot be decrypted. Backups taken while the key was in use are encrypted with the same key and are equally unusable.

**Solution:** enable purge protection on any vault holding a customer-managed key, and audit dependent resources before deleting a vault. Recovering a soft-deleted vault restores its objects, but not its RBAC assignments or Event Grid subscriptions, so recovery is not a clean undo.

---

### Pitfall 6: Reading Secrets on Every Request

**Problem:** application code calls Key Vault inside a request handler instead of caching the value.

**Result:** the vault throttles at a few thousand transactions per 10 seconds, and because the thresholds are weighted and shared, one noisy service degrades every application using that vault. HSM keys throttle an order of magnitude sooner than software keys.

**Solution:** cache secrets in memory with a refresh interval, use client libraries that retry with backoff on 429, and move high-volume cryptography to envelope encryption so the vault wraps a data key occasionally rather than encrypting per operation.

---

### Pitfall 7: Treating Expiry Dates as Enforcement

**Problem:** an expiry date is set on a secret and the credential is considered decommissioned after it.

**Result:** the `exp` attribute is informational. A `get` on an expired secret still returns the value, so the old credential keeps working anywhere it was already deployed.

**Solution:** expiry dates are for triggering `SecretNearExpiry` and `SecretExpired` events. Decommission a credential where it is actually valid, in the backing service, and use the vault's expiry only to drive the automation that does it.

---

### Pitfall 8: Expecting Rotated Secrets to Take Effect Immediately

**Problem:** a rotation function writes a new secret version and the old credential is revoked straight away.

**Result:** App Service and Functions cache Key Vault references and refetch on a 24-hour cycle. Pods that read a mounted secret at startup hold the old value until they restart. The application keeps presenting a credential that no longer works.

**Solution:** overlap the credentials. Write the new version, let consumers pick it up (or force a refresh through the configreferences endpoint or a restart), confirm the new value is in use, and only then revoke the old one.

---

## Key Takeaways

1. **Managed HSM is not a higher vault tier.** It stores HSM-protected keys and nothing else. Secrets and certificates require a vault, and Premium vault keys already reach FIPS 140-3 Level 3.

2. **A certificate is three objects sharing a name.** Creating one creates an addressable key and secret alongside it, so `Key Vault Secrets User` on the vault can retrieve the private key of every exportable certificate in it.

3. **The control plane and the data plane are authorized separately, and only the data plane is firewalled.** Template deployments write secrets through Azure Resource Manager, unaffected by network rules.

4. **Access policies are legacy but not deprecated.** What has a date is the control plane API: versions before 2026-02-01 retire on February 27, 2027, so templates, SDKs, and tooling need updating regardless of which access model you use.

5. **Switching a vault to Azure RBAC invalidates every access policy at once.** Assign roles first, verify, then switch.

6. **Keys rotate themselves; secrets do not.** A key rotation policy creates new versions on a schedule. Secret rotation is a function or Logic App you build, triggered by the near-expiry Event Grid event.

7. **Key rotation re-wraps data encryption keys rather than re-encrypting data.** Keep the old version enabled until re-wrapping completes, and point Azure services at the versionless key URI while storing versioned URIs with your own ciphertext.

8. **Expiry dates do not block reads.** They exist to drive notifications. Revoke a credential in the service that honours it.

9. **Rotation lands on a lag, not a switch.** App Service refetches references every 24 hours, and mounted CSI secrets need the pod to re-read them. Overlap old and new credentials.

10. **Key Vault throttles, and the limits are weighted and shared.** Cache values, retry on 429, and use envelope encryption instead of putting large HSM keys on a per-request path.

11. **Soft delete is permanent and its retention is fixed at creation.** Recovering a deleted vault does not restore its RBAC assignments or Event Grid subscriptions, so plan around losing access configuration and rotation triggers.

12. **Azure Disk Encryption retires on September 15, 2028.** Migrate ADE-encrypted VMs, and their backups, to encryption at host before then, or the disks stop unlocking on reboot.
