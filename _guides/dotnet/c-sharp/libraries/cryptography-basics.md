---
title: "C# Cryptography Basics"
layout: guide
category: ".NET & C#"
subcategory: "Core Libraries"
description: "Hashing, encryption, and secure random generation with System.Security.Cryptography."
tags: [c-sharp, dotnet, cryptography, security, hashing, encryption, practical]
---

## Cryptography Overview

System.Security.Cryptography provides cryptographic primitives. Use the right tool for each job.

| Need | Use |
|------|-----|
| Password storage | PBKDF2, Argon2, bcrypt |
| Data integrity | SHA-256, SHA-512 |
| Symmetric encryption | AES |
| Asymmetric encryption | RSA |
| Digital signatures | RSA, ECDSA |
| Secure random | RandomNumberGenerator |

## Hashing

### SHA-256 / SHA-512

Use for checksums and data integrity. Not for passwords.

```csharp
using System.Security.Cryptography;

// Hash a string
byte[] Hash(string input)
{
    byte[] bytes = Encoding.UTF8.GetBytes(input);
    return SHA256.HashData(bytes);
}

// Hash to hex string
string HashToHex(string input)
{
    byte[] hash = SHA256.HashData(Encoding.UTF8.GetBytes(input));
    return Convert.ToHexString(hash);  // .NET 5+
}

// Hash a file
async Task<byte[]> HashFileAsync(string path)
{
    await using var stream = File.OpenRead(path);
    return await SHA256.HashDataAsync(stream);
}

// SHA-512 for stronger hash
byte[] strongHash = SHA512.HashData(data);
```

### HMAC

Hash with a key for message authentication.

```csharp
byte[] ComputeHmac(byte[] key, byte[] message)
{
    return HMACSHA256.HashData(key, message);
}

// Verify HMAC
bool VerifyHmac(byte[] key, byte[] message, byte[] expectedMac)
{
    byte[] computed = HMACSHA256.HashData(key, message);
    return CryptographicOperations.FixedTimeEquals(computed, expectedMac);
}
```

## Password Hashing

<div class="callout callout--warning">
<p class="callout__title">Never Store Passwords in Plain Text</p>
<p>Never store passwords in plain text or with simple hashes like SHA-256. Use a password-specific algorithm like PBKDF2, Argon2, or bcrypt.</p>
</div>

### Rfc2898DeriveBytes (PBKDF2)

```csharp
public class PasswordHasher
{
    private const int SaltSize = 16;
    private const int HashSize = 32;
    private const int Iterations = 100000;

    public string HashPassword(string password)
    {
        byte[] salt = RandomNumberGenerator.GetBytes(SaltSize);
        byte[] hash = Rfc2898DeriveBytes.Pbkdf2(
            password,
            salt,
            Iterations,
            HashAlgorithmName.SHA256,
            HashSize);

        // Combine salt + hash for storage
        byte[] combined = new byte[SaltSize + HashSize];
        salt.CopyTo(combined, 0);
        hash.CopyTo(combined, SaltSize);

        return Convert.ToBase64String(combined);
    }

    public bool VerifyPassword(string password, string storedHash)
    {
        byte[] combined = Convert.FromBase64String(storedHash);
        byte[] salt = combined[..SaltSize];
        byte[] expectedHash = combined[SaltSize..];

        byte[] actualHash = Rfc2898DeriveBytes.Pbkdf2(
            password,
            salt,
            Iterations,
            HashAlgorithmName.SHA256,
            HashSize);

        return CryptographicOperations.FixedTimeEquals(actualHash, expectedHash);
    }
}
```

## Symmetric Encryption (AES)

Use for encrypting data with a shared secret key.

```csharp
public class AesEncryption
{
    public static (byte[] ciphertext, byte[] iv) Encrypt(byte[] plaintext, byte[] key)
    {
        using var aes = Aes.Create();
        aes.Key = key;
        aes.GenerateIV();

        byte[] ciphertext = aes.EncryptCbc(plaintext, aes.IV);
        return (ciphertext, aes.IV);
    }

    public static byte[] Decrypt(byte[] ciphertext, byte[] key, byte[] iv)
    {
        using var aes = Aes.Create();
        aes.Key = key;

        return aes.DecryptCbc(ciphertext, iv);
    }
}

// Usage
byte[] key = RandomNumberGenerator.GetBytes(32);  // 256-bit key
byte[] plaintext = Encoding.UTF8.GetBytes("Secret message");

var (ciphertext, iv) = AesEncryption.Encrypt(plaintext, key);
byte[] decrypted = AesEncryption.Decrypt(ciphertext, key, iv);
```

### AES-GCM (Authenticated Encryption)

Provides both encryption and integrity verification.

```csharp
public class AesGcmEncryption
{
    private const int NonceSize = 12;
    private const int TagSize = 16;

    public static byte[] Encrypt(byte[] plaintext, byte[] key)
    {
        byte[] nonce = RandomNumberGenerator.GetBytes(NonceSize);
        byte[] ciphertext = new byte[plaintext.Length];
        byte[] tag = new byte[TagSize];

        using var aes = new AesGcm(key, TagSize);
        aes.Encrypt(nonce, plaintext, ciphertext, tag);

        // Combine: nonce + ciphertext + tag
        byte[] result = new byte[NonceSize + ciphertext.Length + TagSize];
        nonce.CopyTo(result, 0);
        ciphertext.CopyTo(result, NonceSize);
        tag.CopyTo(result, NonceSize + ciphertext.Length);

        return result;
    }

    public static byte[] Decrypt(byte[] encrypted, byte[] key)
    {
        byte[] nonce = encrypted[..NonceSize];
        byte[] ciphertext = encrypted[NonceSize..^TagSize];
        byte[] tag = encrypted[^TagSize..];

        byte[] plaintext = new byte[ciphertext.Length];

        using var aes = new AesGcm(key, TagSize);
        aes.Decrypt(nonce, ciphertext, tag, plaintext);

        return plaintext;
    }
}
```

## Asymmetric Encryption (RSA)

Use for encrypting small data or exchanging symmetric keys.

```csharp
public class RsaEncryption
{
    public static (string publicKey, string privateKey) GenerateKeyPair()
    {
        using var rsa = RSA.Create(2048);
        return (
            rsa.ExportRSAPublicKeyPem(),
            rsa.ExportRSAPrivateKeyPem()
        );
    }

    public static byte[] Encrypt(byte[] plaintext, string publicKeyPem)
    {
        using var rsa = RSA.Create();
        rsa.ImportFromPem(publicKeyPem);
        return rsa.Encrypt(plaintext, RSAEncryptionPadding.OaepSHA256);
    }

    public static byte[] Decrypt(byte[] ciphertext, string privateKeyPem)
    {
        using var rsa = RSA.Create();
        rsa.ImportFromPem(privateKeyPem);
        return rsa.Decrypt(ciphertext, RSAEncryptionPadding.OaepSHA256);
    }
}
```

## Digital Signatures

Verify data integrity and authenticity.

```csharp
public class RsaSignature
{
    public static byte[] Sign(byte[] data, string privateKeyPem)
    {
        using var rsa = RSA.Create();
        rsa.ImportFromPem(privateKeyPem);
        return rsa.SignData(data, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
    }

    public static bool Verify(byte[] data, byte[] signature, string publicKeyPem)
    {
        using var rsa = RSA.Create();
        rsa.ImportFromPem(publicKeyPem);
        return rsa.VerifyData(data, signature, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
    }
}
```

## Secure Random Generation

```csharp
// Generate random bytes
byte[] randomBytes = RandomNumberGenerator.GetBytes(32);

// Generate random int
int randomInt = RandomNumberGenerator.GetInt32(100);        // 0-99
int randomRange = RandomNumberGenerator.GetInt32(10, 100);  // 10-99

// Fill existing array
byte[] buffer = new byte[64];
RandomNumberGenerator.Fill(buffer);
```

## Key Derivation

Derive cryptographic keys from passwords or other keys.

```csharp
// From password
byte[] DeriveKeyFromPassword(string password, byte[] salt)
{
    return Rfc2898DeriveBytes.Pbkdf2(
        password,
        salt,
        iterations: 100000,
        HashAlgorithmName.SHA256,
        outputLength: 32);
}

// HKDF - derive multiple keys from one master key
byte[] masterKey = RandomNumberGenerator.GetBytes(32);
byte[] encryptionKey = HKDF.DeriveKey(
    HashAlgorithmName.SHA256,
    masterKey,
    outputLength: 32,
    info: Encoding.UTF8.GetBytes("encryption"));
byte[] macKey = HKDF.DeriveKey(
    HashAlgorithmName.SHA256,
    masterKey,
    outputLength: 32,
    info: Encoding.UTF8.GetBytes("mac"));
```

## Common Patterns

### Encrypt String

```csharp
public static string EncryptString(string plaintext, byte[] key)
{
    byte[] plaintextBytes = Encoding.UTF8.GetBytes(plaintext);
    byte[] encrypted = AesGcmEncryption.Encrypt(plaintextBytes, key);
    return Convert.ToBase64String(encrypted);
}

public static string DecryptString(string ciphertext, byte[] key)
{
    byte[] encryptedBytes = Convert.FromBase64String(ciphertext);
    byte[] decrypted = AesGcmEncryption.Decrypt(encryptedBytes, key);
    return Encoding.UTF8.GetString(decrypted);
}
```

### Constant-Time Comparison

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Vulnerable Code</h4>
<pre><code>// BAD: Timing attack vulnerable
bool bad = hash1.SequenceEqual(hash2);</code></pre>
<p>Short-circuits on first mismatch, leaking information about how much of the secret matches.</p>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Secure Code</h4>
<pre><code>// GOOD: Constant-time comparison
bool good = CryptographicOperations
    .FixedTimeEquals(hash1, hash2);</code></pre>
<p>Always compares all bytes regardless of mismatches, preventing timing analysis.</p>
</div>
</div>

```csharp
// BAD: Timing attack vulnerable
bool bad = hash1.SequenceEqual(hash2);

// GOOD: Constant-time comparison
bool good = CryptographicOperations.FixedTimeEquals(hash1, hash2);
```

## Security Guidelines

| Do | Don't |
|----|-------|
| Use AES-256 for symmetric encryption | Use DES, 3DES, or Blowfish |
| Use RSA-2048+ or ECDSA | Use RSA-1024 or smaller |
| Use SHA-256+ for hashing | Use MD5 or SHA-1 for security |
| Use PBKDF2/Argon2/bcrypt for passwords | Use simple hash for passwords |
| Use RandomNumberGenerator | Use Random for crypto |
| Use constant-time comparison | Use == or SequenceEqual for secrets |

## Key Takeaways

**Never roll your own crypto**: Use the built-in primitives. Custom implementations are almost always insecure.

**Use the right algorithm for the job**: Hashing for integrity, encryption for confidentiality, signatures for authenticity.

**Use secure random for keys**: Never use `Random` for cryptographic purposes.

**Store passwords with PBKDF2/Argon2**: Simple hashes like SHA-256 are not suitable for password storage.

**Use authenticated encryption**: AES-GCM provides both confidentiality and integrity.

**Compare secrets in constant time**: Use `CryptographicOperations.FixedTimeEquals` to prevent timing attacks.
