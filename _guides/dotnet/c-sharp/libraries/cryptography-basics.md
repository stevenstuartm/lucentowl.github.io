---
title: "C# Cryptography Basics"
layout: guide
category: ".NET & C#"
subcategory: "Core Libraries"
description: "Using System.Security.Cryptography correctly: hashing and HMAC, password hashing with PBKDF2 and upgradeable parameters, authenticated encryption with AES-GCM and why unauthenticated CBC fails, RSA and ECDSA keys and signatures, secure random values, key derivation, and where keys should live."
tags: [system-security-cryptography, aes-gcm, pbkdf2, hmac, rsa, ecdsa, practical]
---

## What the Library Provides

`System.Security.Cryptography` exposes the standard primitives, but .NET doesn't implement most of them itself. It calls the operating system's cryptographic library: CNG on Windows, OpenSSL on Linux, and Apple's frameworks on macOS. Two consequences follow. Algorithm support can differ by platform and OS version, which is why several types have an `IsSupported` property to check before use. And security fixes to the algorithms arrive through OS updates, not .NET releases.

Choosing algorithms and parameters is its own subject. The [Cryptographic Algorithm Choices](/resources/cryptographic-algorithm-choices.html) reference lists the current recommendation and what to avoid for each job. This guide covers using the .NET APIs for those choices correctly, where most real vulnerabilities come from.

| Job | .NET API |
|---|---|
| Fingerprint data, verify a download | `SHA256.HashData`, `SHA512.HashData` |
| Prove a message came from a key holder | `HMACSHA256.HashData` |
| Store passwords | `Rfc2898DeriveBytes.Pbkdf2`; Argon2id needs a third-party package |
| Encrypt data | `AesGcm`, `ChaCha20Poly1305` |
| Sign and verify | `ECDsa`, `RSA` |
| Encrypt a small value to a public key | `RSA` with OAEP padding |
| Keys, nonces, tokens | `RandomNumberGenerator` |
| Derive keys from a key | `HKDF` |

## Hashing

A hash maps any input to a fixed-size fingerprint. The same input always gives the same output, and no one can feasibly find a different input with the same hash:

```csharp
using System.Security.Cryptography;

byte[] hash = SHA256.HashData(Encoding.UTF8.GetBytes("hello"));
string hex = Convert.ToHexString(hash);   // 2CF24DBA5FB0A30E...

await using FileStream file = File.OpenRead("installer.msi");
byte[] fileHash = await SHA256.HashDataAsync(file);   // .NET 7
```

The static `HashData` methods need no instance or disposal. A hash has no key, so anyone can compute it. It detects accidental corruption and confirms a download matches a published checksum, but an attacker who can change the data can recompute the hash too.

### HMAC

An HMAC mixes a secret key into the hash, so only a holder of the key can produce or check it. That makes it the tool for authenticating a message, such as a webhook payload or a signed cookie:

```csharp
byte[] mac = HMACSHA256.HashData(key, message);

bool IsAuthentic(byte[] key, byte[] message, byte[] receivedMac)
{
    byte[] expected = HMACSHA256.HashData(key, message);
    return CryptographicOperations.FixedTimeEquals(expected, receivedMac);
}
```

**Compare secrets with `FixedTimeEquals`.** `SequenceEqual` and `==` on strings stop at the first differing byte, so the time a comparison takes reveals how many leading bytes were right. An attacker who can time many attempts can recover a valid MAC byte by byte. `FixedTimeEquals` examines every byte whatever the result.

## Password Hashing

A fast hash is the wrong tool for passwords. SHA-256 runs billions of times per second on a GPU, so a leaked table of SHA-256 password hashes, even salted ones, falls to brute force. Password hashing functions are deliberately slow, and each password gets a random **salt** so identical passwords hash differently and precomputed tables are useless.

.NET includes PBKDF2. Argon2id, the stronger current recommendation because it also costs memory, requires a third-party package. PBKDF2 remains acceptable, and is the option where FIPS 140 compliance is required, provided the iteration count is high. The current recommendation is 600,000 iterations with HMAC-SHA256.

Store the algorithm and iteration count with each hash. Recommended counts rise over time, and a stored count lets you verify old hashes and upgrade them the next time the user signs in:

```csharp
public static class PasswordHasher
{
    private const int SaltSize = 16;
    private const int HashSize = 32;
    private const int Iterations = 600_000;

    public static string Hash(string password)
    {
        byte[] salt = RandomNumberGenerator.GetBytes(SaltSize);
        byte[] hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, HashSize);

        return $"pbkdf2-sha256${Iterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }

    public static bool Verify(string password, string stored, out bool needsRehash)
    {
        string[] parts = stored.Split('$');
        int iterations = int.Parse(parts[1], CultureInfo.InvariantCulture);
        byte[] salt = Convert.FromBase64String(parts[2]);
        byte[] expected = Convert.FromBase64String(parts[3]);

        byte[] actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, expected.Length);

        needsRehash = iterations < Iterations;
        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }
}
```

When `Verify` succeeds with `needsRehash` set, hash the password again with `Hash` and save the result. The static `Rfc2898DeriveBytes.Pbkdf2` (.NET 6) is the API to use. The class's constructors are obsolete as of .NET 10 (`SYSLIB0060`). Measured on a desktop CPU, 600,000 iterations took about 70 ms, which is noticeable per sign-in and prohibitive per guess for an attacker.

In an ASP.NET Core application, the Identity `PasswordHasher<TUser>` already stores its parameters in the hash and reports when a rehash is needed, so prefer it over writing your own.

## Encrypting Data

### Use Authenticated Encryption

Encryption keeps data confidential. On its own it doesn't stop an attacker from *changing* the ciphertext, and with AES in CBC mode, a change produces a predictable change in the plaintext. Flipping one bit of the IV flipped one bit of the decrypted text, turning `attack at dawn` into `` `ttack at dawn`` with no error:

```csharp
byte[] ciphertext = aes.EncryptCbc(plaintext, iv);
iv[0] ^= 1;
aes.DecryptCbc(ciphertext, iv);   // Decrypts without complaint, first byte altered
```

Worse, a server that reveals whether decryption hit a padding error, through an error message or a timing difference, lets an attacker decrypt the whole message one byte at a time. This is a padding oracle attack.

**Authenticated encryption** (AEAD) fixes both. It computes a tag over the ciphertext, and decryption refuses anything that has been modified. `AesGcm` and `ChaCha20Poly1305` provide it. Use one of them rather than CBC or CTR, unless you add an HMAC over the ciphertext yourself and check it before decrypting.

### AES-GCM

```csharp
public static class Encryption
{
    private const int NonceSize = 12;   // The only size AesGcm accepts
    private const int TagSize = 16;

    public static byte[] Encrypt(ReadOnlySpan<byte> plaintext, byte[] key, ReadOnlySpan<byte> associatedData = default)
    {
        byte[] result = new byte[NonceSize + plaintext.Length + TagSize];
        Span<byte> nonce = result.AsSpan(0, NonceSize);
        Span<byte> ciphertext = result.AsSpan(NonceSize, plaintext.Length);
        Span<byte> tag = result.AsSpan(NonceSize + plaintext.Length, TagSize);

        RandomNumberGenerator.Fill(nonce);

        using var aes = new AesGcm(key, TagSize);
        aes.Encrypt(nonce, plaintext, ciphertext, tag, associatedData);
        return result;
    }

    public static byte[] Decrypt(ReadOnlySpan<byte> message, byte[] key, ReadOnlySpan<byte> associatedData = default)
    {
        ReadOnlySpan<byte> nonce = message[..NonceSize];
        ReadOnlySpan<byte> ciphertext = message[NonceSize..^TagSize];
        ReadOnlySpan<byte> tag = message[^TagSize..];

        byte[] plaintext = new byte[ciphertext.Length];
        using var aes = new AesGcm(key, TagSize);
        aes.Decrypt(nonce, ciphertext, tag, plaintext, associatedData);   // Throws if anything was altered
        return plaintext;
    }
}

byte[] key = RandomNumberGenerator.GetBytes(32);   // AES-256
byte[] sealedMessage = Encryption.Encrypt("Secret message"u8, key);
```

The rules that keep it secure:

- **Never reuse a nonce with the same key.** A repeated nonce under one key exposes the relationship between the two plaintexts and lets an attacker forge messages. A random 12-byte nonce per message is safe for a very large number of messages per key, but not an unlimited number. Systems encrypting at very high volume rotate keys.
- **Tampering throws.** A modified nonce, ciphertext, tag, or associated data makes `Decrypt` throw `AuthenticationTagMismatchException` (.NET 8), a `CryptographicException`. Treat it as a rejected message. Don't retry or log the plaintext buffer.
- **Associated data binds context.** Data passed as `associatedData` isn't encrypted or stored in the output, but decryption fails unless the same bytes are supplied. Passing a record ID there stops an attacker from moving an encrypted value from one record to another.
- **Pass the tag size to the constructor.** The `AesGcm(byte[] key)` constructor is obsolete (`SYSLIB0053`, .NET 8), because it accepted any tag size at decryption time.

`AesGcm` and `ChaCha20Poly1305` are unavailable on some platforms, so check `IsSupported` in code that must run everywhere.

## Asymmetric Keys: Signatures and Encryption

Asymmetric algorithms use a key pair. The private key signs or decrypts, and the public key, which can be shared freely, verifies or encrypts.

### Signatures

A signature proves that the holder of a private key approved exactly these bytes, and anyone with the public key can check it. ECDSA with the P-256 curve gives small keys and 64-byte signatures:

```csharp
using ECDsa signer = ECDsa.Create(ECCurve.NamedCurves.nistP256);

byte[] signature = signer.SignData(document, HashAlgorithmName.SHA256);
string publicKeyPem = signer.ExportSubjectPublicKeyInfoPem();   // .NET 7

using ECDsa verifier = ECDsa.Create();
verifier.ImportFromPem(publicKeyPem);
bool valid = verifier.VerifyData(document, signature, HashAlgorithmName.SHA256);
```

RSA signs the same way with `SignData(data, HashAlgorithmName.SHA256, RSASignaturePadding.Pss)`. PSS is the stronger padding for new designs. `Pkcs1` remains for interoperating with systems that require it.

### RSA Encryption

RSA encrypts only short values. With a 2048-bit key and OAEP-SHA256 padding, the limit is 190 bytes, and a 191-byte input throws `CryptographicException`. Its use is to encrypt a randomly generated AES key, which then encrypts the actual data:

```csharp
using RSA rsa = RSA.Create(2048);

byte[] dataKey = RandomNumberGenerator.GetBytes(32);
byte[] wrappedKey = rsa.Encrypt(dataKey, RSAEncryptionPadding.OaepSHA256);
byte[] sealedData = Encryption.Encrypt(payload, dataKey);
// Send wrappedKey and sealedData; only the private key holder can unwrap dataKey
```

Use OAEP padding. `RSAEncryptionPadding.Pkcs1` is vulnerable to padding oracle attacks when decrypting data an attacker controls.

### Key Formats

Keys move between systems as PEM text. The export method decides the header, and a consumer expecting one format often rejects another:

| Method | PEM header | Contains |
|---|---|---|
| `ExportSubjectPublicKeyInfoPem()` | `BEGIN PUBLIC KEY` | Public key, any algorithm. The common interchange format |
| `ExportRSAPublicKeyPem()` | `BEGIN RSA PUBLIC KEY` | RSA public key only (PKCS#1) |
| `ExportPkcs8PrivateKeyPem()` | `BEGIN PRIVATE KEY` | Private key, any algorithm |
| `ExportEncryptedPkcs8PrivateKeyPem(password, ...)` | `BEGIN ENCRYPTED PRIVATE KEY` | Private key protected by a password |

`ImportFromPem` reads the unencrypted formats and throws `ArgumentException` on an encrypted key, which needs `ImportFromEncryptedPem(pem, password)`. In production, private keys usually live in a certificate store or key vault and are loaded as an `X509Certificate2`, whose `GetRSAPrivateKey()` or `GetECDsaPrivateKey()` returns the key object.

### Post-Quantum Algorithms

.NET 10 adds `MLKem` for key encapsulation and `MLDsa` for signatures, two of the NIST post-quantum standards. They depend on OS support, so each has `IsSupported`. A third, `SlhDsa`, ships as experimental and fails the build with `SYSLIB5006` unless that diagnostic is suppressed. Adopting them matters most for data that must stay confidential for decades, since ciphertext recorded today could be decrypted once large quantum computers exist.

## Random Values

`RandomNumberGenerator` draws from the operating system's cryptographically secure generator. `System.Random` is predictable from a few outputs and must never produce keys, tokens, salts, or anything an attacker benefits from guessing:

```csharp
byte[] key = RandomNumberGenerator.GetBytes(32);
int die = RandomNumberGenerator.GetInt32(1, 7);                       // 1-6; upper bound exclusive
string token = RandomNumberGenerator.GetHexString(32);                // .NET 8; 32 characters
string code = RandomNumberGenerator.GetString("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);   // .NET 8
```

`GetInt32` and `GetString` avoid the modulo bias of `GetBytes(...)[0] % n`, which makes some values more likely than others when the range doesn't divide 256 evenly.

## Key Derivation

**HKDF** derives several independent keys from one strong key, so encryption and MAC keys never share a value:

```csharp
byte[] masterKey = RandomNumberGenerator.GetBytes(32);
byte[] encryptionKey = HKDF.DeriveKey(HashAlgorithmName.SHA256, masterKey, outputLength: 32, info: "encryption"u8.ToArray());
byte[] macKey = HKDF.DeriveKey(HashAlgorithmName.SHA256, masterKey, outputLength: 32, info: "mac"u8.ToArray());
```

HKDF assumes its input is already a random key. To derive an encryption key from a password, use PBKDF2 with a salt and the same iteration count as password storage, since a password has too little randomness for HKDF.

## Where Keys Live

The code above is the easy part, and key handling is where encryption usually fails:

- **Never put keys in source, configuration files, or container images.** Anyone with repository or image access has the key, and rotating it means redeploying.
- **Load keys from a key vault or KMS at startup**, or let the vault do the cryptography so the key never enters the process.
- **Plan for rotation from the start.** Store a key identifier with each ciphertext so old data stays readable after a new key is introduced.
- **For encrypting application data such as tokens and cookies, use ASP.NET Core Data Protection** rather than raw `AesGcm`. It manages, rotates, and protects its own keys, and works outside ASP.NET Core as a standalone package.

`CryptographicOperations.ZeroMemory` clears a key buffer when you're done with it, which shortens how long the key sits in memory, though the garbage collector may already have copied a managed array.

## Key Takeaways

**Use authenticated encryption.** `AesGcm` or `ChaCha20Poly1305`, with a fresh nonce per message and never CBC without a MAC.

**Hash passwords slowly and upgradeably.** PBKDF2 at 600,000 iterations or Argon2id, with the parameters stored beside each hash.

**Compare MACs and hashes with `FixedTimeEquals`.**

**Use `RandomNumberGenerator` for anything secret,** and its `GetInt32` and `GetString` to avoid bias.

**Encrypt bulk data with a symmetric key and wrap that key with RSA,** since RSA handles only a couple of hundred bytes.

**Keep keys out of code and configuration,** and design for rotation before the first ciphertext is stored.
