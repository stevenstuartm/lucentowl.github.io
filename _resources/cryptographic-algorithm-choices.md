---
title: "Cryptographic Algorithm Choices"
layout: resource
type: cheatsheet
category: "Security"
description: "The recommended algorithm and parameters for each cryptographic job (encryption, hashing, MACs, password hashing, key exchange, signatures, TLS, and randomness), what to avoid, and the post-quantum replacements."
last_updated: 2026-09-22
tags: [cryptography, aes-gcm, argon2id, tls, post-quantum, key-sizes]
related_guides:
  - /study-guides/security/cryptography.html
---

Use these through a well-reviewed library's high-level API. Parameters are minimums unless stated otherwise.

## By Job

| Job | Use | Parameters | Avoid |
|---|---|---|---|
| **Encrypt data** | AES-GCM or ChaCha20-Poly1305 (AEAD) | 256-bit key (AES-128 also acceptable); 96-bit nonce, never reused under one key | ECB mode, CBC or CTR without a MAC, DES, 3DES, RC4 |
| **Encrypt at very high volume per key** | AES-GCM-SIV, or rotate keys | Rotate before random nonces risk colliding | Counters that reset on restart |
| **Hash** | SHA-256, SHA-512, or SHA-3 | | MD5, SHA-1 |
| **Authenticate with a shared key** | HMAC-SHA256 | 256-bit key; compare in constant time | A plain hash of secret plus message |
| **Store passwords** | Argon2id | 19 MiB memory, 2 iterations, parallelism 1 | Any fast hash, even salted |
| | scrypt | N=2^17, r=8, p=1 | |
| | bcrypt | Cost 10 or higher; input truncated at 72 bytes | |
| | PBKDF2 (when FIPS-140 is required) | 600,000 iterations with HMAC-SHA256, or 220,000 with HMAC-SHA512 | |
| **Agree on a key** | ECDH over X25519 or P-256, ephemeral | Hybrid X25519 + ML-KEM-768 where supported | Static RSA key transport, finite-field DH below 2048 bits |
| **Sign** | Ed25519, ECDSA P-256, or RSA-PSS | RSA 2048 through 2030; 3072 for protection beyond 2030 | RSA below 2048, SHA-1 in signatures |
| **Encrypt to a public key** | HPKE (RFC 9180), or RSA-OAEP to wrap a symmetric key | RSA 2048 or larger | RSA PKCS#1 v1.5 encryption padding |
| **Protect a connection** | TLS 1.3 | TLS 1.2 only with ECDHE and AEAD suites | SSL, TLS 1.0, TLS 1.1 |
| **Generate keys, nonces, tokens** | The platform CSPRNG (`RandomNumberGenerator` in .NET) | | General-purpose PRNGs (`System.Random`) |

Password parameters are from the [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html){:target="_blank" rel="noopener noreferrer"}. Key sizes follow [NIST SP 800-57 Part 1](https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final){:target="_blank" rel="noopener noreferrer"}, where 112-bit security (RSA 2048, P-224) is acceptable through 2030 and 128-bit security (RSA 3072, P-256, AES-128) beyond it.

## Post-Quantum Replacements

| Quantum-vulnerable | Replacement | Standard |
|---|---|---|
| ECDH, RSA key transport | ML-KEM (ML-KEM-768 is the common default) | [FIPS 203](https://csrc.nist.gov/pubs/fips/203/final){:target="_blank" rel="noopener noreferrer"} |
| ECDSA, EdDSA, RSA signatures | ML-DSA | [FIPS 204](https://csrc.nist.gov/pubs/fips/204/final){:target="_blank" rel="noopener noreferrer"} |
| Signatures where lattice assumptions are a concern | SLH-DSA (hash-based, larger and slower) | [FIPS 205](https://csrc.nist.gov/pubs/fips/205/final){:target="_blank" rel="noopener noreferrer"} |

AES-256, SHA-256, and HMAC need no replacement. NIST's draft transition plan ([IR 8547](https://nvlpubs.nist.gov/nistpubs/ir/2024/NIST.IR.8547.ipd.pdf){:target="_blank" rel="noopener noreferrer"}) proposes deprecating 112-bit quantum-vulnerable algorithms after 2030 and disallowing all quantum-vulnerable ones after 2035.
