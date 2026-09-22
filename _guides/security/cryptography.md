---
title: "Cryptography"
layout: guide
category: Security
subcategory: Security Fundamentals
description: "Which cryptographic tool fits which job and how to use it without breaking it: symmetric and authenticated encryption, hashing, MACs, and password hashing, public-key encryption, key exchange, and signatures, certificates and PKI, TLS, key management with envelope encryption, and planning the migration to post-quantum algorithms."
tags: [fundamentals, cryptography, encryption, aes-gcm, pki, key-management, post-quantum]
---

## What Cryptography Can and Cannot Do

Cryptography turns a large secret problem into a small one. Instead of protecting a whole database, you protect a 32-byte key. Instead of trusting a network, you trust that a private key has not leaked. That trade is enormously useful, but the problem does not disappear. It moves to the keys, and most real-world cryptographic failures are failures of key handling or of using the wrong tool, not failures of the algorithms.

Four jobs cover almost everything applications need:

| Job | The question it answers | Tool |
|---|---|---|
| **Confidentiality** | Can anyone without the key read this? | Encryption |
| **Integrity** | Has this changed since it was protected? | Hashes, MACs, authenticated encryption |
| **Authenticity** | Did this come from who it claims? | MACs (shared key) or digital signatures (key pair) |
| **Key establishment** | How do two parties who share nothing agree on a key? | Key exchange |

Cryptography does not decide who should have access. Encrypted data that every application server can decrypt with a key sitting in its configuration file is protected against a stolen disk and nothing else. The access question stays with identity and authorization. Cryptography enforces the answer.

The single most important rule follows from open design: use well-reviewed algorithms through well-reviewed libraries, and never design or implement your own primitives. The platform's cryptography library (such as .NET's `System.Security.Cryptography`, libsodium, or a cloud key management service) has absorbed years of attacks that a new implementation has not.

---

## Symmetric Cryptography

Symmetric algorithms use the same key to protect and to verify or decrypt. They are fast, which makes them the workhorse for protecting actual data, and their weakness is that every party who can decrypt can also encrypt, and every party must somehow receive the key.

### Authenticated Encryption

Encryption alone provides confidentiality but not integrity. An attacker who cannot read a ciphertext can often still flip bits in it and cause predictable changes in the decrypted result. **Authenticated encryption with associated data (AEAD)** solves this by producing an authentication tag alongside the ciphertext. Decryption checks the tag first and fails if anything was altered.

Use an AEAD mode by default. The two in wide use are **AES-GCM**, which is hardware-accelerated on most server and desktop processors, and **ChaCha20-Poly1305**, which is fast in software and common on mobile devices. Older modes such as AES-CBC without a separate MAC, and anything using ECB mode, should not appear in new code.

AES-GCM has one rule that must never be broken: **never reuse a nonce with the same key.** A repeated nonce lets an attacker recover the XOR of the two plaintexts and forge authentication tags. Random 96-bit nonces are safe for a bounded number of messages per key, and systems that encrypt at very high volume rotate keys or use a nonce-misuse-resistant mode such as AES-GCM-SIV.

```csharp
using System.Security.Cryptography;

public static (byte[] Nonce, byte[] Ciphertext, byte[] Tag) Encrypt(
    byte[] key, byte[] plaintext, byte[] associatedData)
{
    byte[] nonce = RandomNumberGenerator.GetBytes(AesGcm.NonceByteSizes.MaxSize); // 12 bytes, fresh every call
    byte[] ciphertext = new byte[plaintext.Length];
    byte[] tag = new byte[AesGcm.TagByteSizes.MaxSize];                            // 16 bytes

    using var aes = new AesGcm(key, tag.Length);
    aes.Encrypt(nonce, plaintext, ciphertext, tag, associatedData);
    return (nonce, ciphertext, tag);
}
```

The nonce and tag are not secret and are stored alongside the ciphertext. **Associated data** is information that is authenticated but not encrypted, such as a record ID or tenant ID. Binding it into the tag means a ciphertext copied from one record to another fails to decrypt, which defeats a class of swap attacks.

### Hashing

A cryptographic hash function maps any input to a fixed-size digest such that finding two inputs with the same digest, or an input that produces a given digest, is infeasible. Hashes detect change. If the digest of a downloaded file matches the published one, the file has not changed, provided the published digest itself came from a trustworthy source.

**SHA-256** and the rest of the SHA-2 family are the default. **SHA-3** is a standardized alternative with a different internal design, useful as a hedge but not required. **MD5 and SHA-1 are broken** for collision resistance and must not be used where an attacker could choose inputs, such as in signatures or certificate fingerprints.

A plain hash provides no authenticity, because anyone can compute one. An attacker who can modify a file can also recompute its hash.

### Message Authentication Codes

A **MAC** is a keyed hash. Only holders of the key can compute a valid MAC, so a correct MAC proves the message came from a key holder and was not modified. **HMAC-SHA256** is the common choice, used for webhook signatures, signed cookies, and symmetric JWT signing. Compare MACs with a constant-time comparison (such as `CryptographicOperations.FixedTimeEquals` in .NET) so response timing does not leak how many bytes matched.

### Password Hashing

Passwords need a different tool from everything above. Fast hashes are designed to be fast, and a single GPU can compute billions of SHA-256 hashes per second, so a stolen table of SHA-256 password hashes falls quickly to guessing. Password hashing functions are deliberately slow and memory-hungry, and they use a unique random **salt** per password so identical passwords produce different hashes and precomputed tables are useless.

The [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html){:target="_blank" rel="noopener noreferrer"} ranks the choices:

1. **Argon2id**, with a minimum configuration of 19 MiB of memory, 2 iterations, and 1 degree of parallelism.
2. **scrypt**, where Argon2id is unavailable.
3. **bcrypt**, for legacy systems, with a work factor of at least 10. bcrypt ignores input beyond 72 bytes, so long passphrases are silently truncated.
4. **PBKDF2**, where FIPS-140 compliance is required, with 600,000 iterations for HMAC-SHA256.

Tune the cost upward until verification takes as long as the login path can tolerate, and store the parameters with each hash so they can be raised later, rehashing each password at its next successful login.

---

## Public-Key Cryptography

Asymmetric algorithms use a key pair. The public key can be published, and the private key never leaves its owner. That removes the key distribution problem for some tasks, at the cost of being far slower than symmetric algorithms and producing larger outputs.

### Key Exchange

Two parties who have never met agree on a shared secret over a public channel, and an eavesdropper who sees every message cannot compute it. **Elliptic-curve Diffie-Hellman (ECDH)**, usually over X25519 or P-256, is the current standard. In practice, key exchange produces a symmetric key and all the actual data is then protected with AEAD. Using **ephemeral** keys for each session provides **forward secrecy**, meaning that stealing a server's long-term private key later does not decrypt previously recorded sessions.

Public-key encryption of data directly, such as RSA-OAEP, exists but is rarely the right design. It is limited to small messages and is almost always used to wrap a symmetric key rather than to encrypt data itself.

### Digital Signatures

A signature is made with a private key and verified with the public key. It proves the holder of the private key signed exactly this content. Unlike a MAC, the verifier cannot forge a signature, which is what makes signatures the basis of non-repudiation, code signing, certificate chains, and asymmetric JWTs. Common choices are **Ed25519**, **ECDSA** over P-256, and **RSA** with PSS padding at 2048 bits or more.

A signature proves a key signed something. It says nothing about whose key it is. Connecting a public key to an identity is the job of certificates.

### Certificates and PKI

An **X.509 certificate** binds a public key to a name, such as a domain, and is signed by a **certificate authority (CA)**. A verifier trusts a certificate if it can build a chain of signatures from it to a root CA already in its trust store, and if the name, validity dates, and intended usage all match. Public CAs are trusted by browsers and operating systems. Organizations run private CAs for internal services and device identity.

Certificate lifetimes are getting shorter, which pushes renewal into automation. Under CA/Browser Forum [Ballot SC-081v3](https://cabforum.org/2025/04/11/ballot-sc081v3-introduce-schedule-of-reducing-validity-and-data-reuse-periods/){:target="_blank" rel="noopener noreferrer"}, the maximum validity of publicly trusted TLS certificates fell to 200 days in March 2026 and falls to 100 days in March 2027 and 47 days in March 2029. Any certificate renewed by a person with a calendar reminder will eventually expire in production. Automated issuance through ACME, or through a cloud provider's managed certificates, is the practical answer.

---

## TLS

TLS combines all of the above to protect a connection. The handshake authenticates the server by its certificate, and optionally the client with a certificate in **mutual TLS (mTLS)**. It runs an ephemeral key exchange, then encrypts all traffic with an AEAD cipher.

**TLS 1.3** is the default choice. It removed the legacy cipher suites and key exchange methods that caused most TLS vulnerabilities, requires forward secrecy, and completes the handshake in one round trip. **TLS 1.2** remains acceptable with forward-secret, AEAD cipher suites for clients that cannot yet use 1.3. TLS 1.0, TLS 1.1, and all SSL versions are deprecated and should be disabled.

The most common TLS failure in application code is not a weak cipher but disabled validation: an HTTP client configured to accept any certificate because a test environment used a self-signed one, left that way into production. That turns TLS into encryption with an unauthenticated party, which an adversary in the middle can exploit. Test environments should use a private CA whose root is trusted by the test clients.

---

## Key Management

Keys are where cryptographic systems actually fail: hardcoded in source, shared between environments, never rotated, or stored next to the data they protect. Key management answers where keys live, who can use them, and how they change over time.

### Where Keys Live

A **hardware security module (HSM)** generates and stores keys inside tamper-resistant hardware and performs operations internally, so the key cannot be extracted. Cloud **key management services** (AWS KMS, Azure Key Vault, Google Cloud KMS) provide HSM-backed keys behind an API, where the application asks the service to encrypt or decrypt and the key never leaves it. Every use is authorized by the platform's identity system and logged, which turns key access into something that can be audited and revoked.

### Envelope Encryption

Sending every record to a KMS for encryption would be slow and expensive, and KMS APIs limit the size of data they accept. **Envelope encryption** solves both problems. The application asks the KMS for a new **data encryption key (DEK)**, receives it both in plaintext and wrapped (encrypted) under a **key encryption key (KEK)** that never leaves the KMS, encrypts the data locally with the plaintext DEK, discards the plaintext DEK, and stores the wrapped DEK next to the ciphertext. To decrypt, the application sends only the small wrapped DEK to the KMS for unwrapping.

{% include figure.html id="sec-envelope-encryption" %}

The structure makes several things cheap. Rotating the KEK re-wraps small DEKs rather than re-encrypting all the data. Revoking an identity's permission to use the KEK makes every DEK it protects unusable to that identity. Separate KEKs per tenant or per data classification let one tenant's data be made unreadable (**crypto-shredding**) by destroying its key.

### Rotation and Separation

- **One key, one purpose.** A key used for encryption is not also used for signing, and a key for one environment or tenant is not reused for another. Separation limits what a single leak exposes.
- **Rotate on a schedule and on suspicion.** Rotation limits how much data any single key protects and how long a leaked key stays useful. Design for rotation from the start by storing a key identifier with every ciphertext, so old data remains readable while new data uses the new key.
- **Keep keys out of code and configuration files.** Keys belong in a KMS or secrets store, retrieved at runtime by an identity that is authorized to use them.

---

## Post-Quantum Migration

A sufficiently large quantum computer running Shor's algorithm would break RSA, Diffie-Hellman, and elliptic-curve cryptography, meaning all of today's widely deployed key exchange and signature algorithms. Symmetric algorithms and hashes are much less affected. AES-256 and SHA-256 are expected to remain secure.

No such computer exists yet, but the threat is already relevant for data with a long confidentiality lifetime. An adversary can record encrypted traffic today and decrypt it once the capability arrives, a strategy called **harvest now, decrypt later**. Key exchange is therefore the first thing to migrate, and signatures can follow on a slower timeline, since a forged signature only matters once forging is possible.

NIST published the first post-quantum standards in August 2024:

| Standard | Algorithm | Replaces | Derived from |
|---|---|---|---|
| [FIPS 203](https://csrc.nist.gov/pubs/fips/203/final){:target="_blank" rel="noopener noreferrer"} | **ML-KEM** (key encapsulation) | ECDH, RSA key transport | CRYSTALS-Kyber |
| [FIPS 204](https://csrc.nist.gov/pubs/fips/204/final){:target="_blank" rel="noopener noreferrer"} | **ML-DSA** (signatures) | ECDSA, EdDSA, RSA signatures | CRYSTALS-Dilithium |
| [FIPS 205](https://csrc.nist.gov/pubs/fips/205/final){:target="_blank" rel="noopener noreferrer"} | **SLH-DSA** (hash-based signatures) | A conservative backup to ML-DSA | SPHINCS+ |

Further algorithms are in progress, including FN-DSA (from Falcon) and HQC, a key encapsulation mechanism selected in 2025 as a non-lattice alternative to ML-KEM. NIST's draft transition plan, [NIST IR 8547](https://nvlpubs.nist.gov/nistpubs/ir/2024/NIST.IR.8547.ipd.pdf){:target="_blank" rel="noopener noreferrer"}, proposes deprecating quantum-vulnerable algorithms at the 112-bit security level (such as RSA-2048 and P-256) after 2030 and disallowing them after 2035.

Migration is mostly an inventory and agility problem rather than an algorithm problem:

- **Hybrid key exchange first.** Combining a classical exchange with ML-KEM (for example X25519 with ML-KEM-768 in TLS) protects against harvest-now attacks while keeping classical security if the new algorithm turns out to be flawed. Major browsers and CDNs have already enabled it for TLS, so much web traffic is migrating without application changes.
- **Inventory where public-key cryptography is used.** TLS endpoints, VPNs, code signing, certificate authorities, SSH, and any application that signs or encrypts with RSA or ECC. Hardcoded algorithm choices are what make migration slow.
- **Build for crypto agility.** Store algorithm identifiers with keys and ciphertexts, and keep algorithm choices in configuration or libraries rather than scattered through code, so the next change is a configuration change.

---

## Common Pitfalls

- **Rolling your own.** Custom algorithms, custom modes, or hand-written protocol code on top of primitives. Use a library's high-level API.
- **Encryption without authentication.** CBC or CTR mode without a MAC lets attackers alter ciphertexts. Use AEAD.
- **Nonce reuse in GCM.** Counters that reset on restart, or nonces derived from timestamps, eventually repeat.
- **Fast hashes for passwords.** SHA-256, even salted, is too fast. Use Argon2id or one of its listed alternatives.
- **Disabled certificate validation.** A single "accept all certificates" flag removes the authentication half of TLS.
- **Keys stored beside the data.** A database backup that contains both the ciphertext and the key protects nothing.
- **No rotation path.** Ciphertexts without a key identifier make rotation a data migration rather than a configuration change.
