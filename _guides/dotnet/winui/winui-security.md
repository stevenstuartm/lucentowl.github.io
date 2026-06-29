---
title: "Security and Credential Management"
layout: guide
category: "WinUI 3"
subcategory: "Advanced Features"
description: "Securing WinUI 3 applications with the Windows Credential Locker, OAuth authentication flows, MSIX code signing, and data protection best practices."
tags: [winui, winui-3, security, authentication, credentials, oauth, desktop, practical]
---

## Security in WinUI 3 Desktop Applications

WinUI 3 applications run as trusted desktop processes with access to the full Windows API surface and the user's file system. This is an advantage for capability but shifts responsibility toward the developer for protecting sensitive data. Unlike a web application where secrets live on a server the user never touches, a desktop application runs on the user's machine, where a determined attacker with local access can inspect memory, read configuration files, and examine the executable itself.

The Windows platform provides several purpose-built mechanisms to address this: the Credential Locker for secure secret storage, the Data Protection API for encrypting data at rest, Windows Hello for passwordless authentication, and the Windows authentication broker for handling OAuth flows without exposing tokens to application code. These APIs exist because storing secrets in `ApplicationData.Current.LocalSettings`, configuration files, or hardcoded in the binary is insufficient and commonly exploited.

This guide covers the practical application of each mechanism and the patterns that keep tokens and credentials out of plain text storage.

---

## Credential Management with PasswordVault

The [Windows Credential Locker](https://learn.microsoft.com/en-us/windows/uwp/security/credential-locker){:target="_blank" rel="noopener noreferrer"} is an encrypted credential store managed by Windows and scoped to the current user's account. Credentials stored here are inaccessible to other users on the machine and are protected by the operating system's key management infrastructure. For a WinUI 3 application that needs to persist authentication tokens, API keys, or passwords between sessions, `PasswordVault` is the correct storage mechanism.

The API is straightforward. A credential has three components: a resource name (typically your application or service name), a username, and a password field that holds the secret value. The "password" field is not limited to passwords; tokens, API keys, and other secrets fit equally well.

```csharp
using Windows.Security.Credentials;

public class CredentialStore
{
    private const string ResourceName = "MyApp.AuthToken";
    private readonly PasswordVault _vault = new();

    public void SaveToken(string username, string token)
    {
        // Remove any existing credential for this resource/user before saving
        // to prevent duplicate entries accumulating over time
        RemoveToken(username);

        var credential = new PasswordCredential(ResourceName, username, token);
        _vault.Add(credential);
    }

    public string? RetrieveToken(string username)
    {
        try
        {
            var credential = _vault.Retrieve(ResourceName, username);
            credential.RetrievePassword();
            return credential.Password;
        }
        catch (Exception ex) when (ex.HResult == -2147023728) // ELEMENT_NOT_FOUND
        {
            return null;
        }
    }

    public void RemoveToken(string username)
    {
        try
        {
            var credential = _vault.Retrieve(ResourceName, username);
            _vault.Remove(credential);
        }
        catch (Exception ex) when (ex.HResult == -2147023728)
        {
            // Credential did not exist; nothing to remove
        }
    }

    public IReadOnlyList<PasswordCredential> GetAllCredentials()
    {
        try
        {
            return _vault.FindAllByResource(ResourceName);
        }
        catch (Exception ex) when (ex.HResult == -2147023728)
        {
            return Array.Empty<PasswordCredential>();
        }
    }
}
```

One subtlety worth noting: `Retrieve` returns a `PasswordCredential` object with the password field blank until you call `RetrievePassword()`. This lazy loading is intentional, allowing you to enumerate credentials by resource or username without fetching the secret until you actually need it.

A common gotcha is that `FindAllByResource` and `FindAllByUserName` throw rather than returning an empty collection when no matching credentials exist. Catching the `ELEMENT_NOT_FOUND` HRESULT keeps this from becoming an unhandled exception during first launch.

---

## OAuth and Authentication Flows

Authenticating against external identity providers like Microsoft, Google, or a custom OAuth 2.0 server involves a browser-based flow where the user signs in and the provider redirects back to the application with an authorization code. Handling this correctly in a desktop application requires keeping the browser interaction separate from your application code and exchanging the authorization code for tokens without ever exposing those tokens in a URL or log.

### WebAuthenticationBroker

The [WebAuthenticationBroker](https://learn.microsoft.com/en-us/uwp/api/windows.security.authentication.web.webauthenticationbroker){:target="_blank" rel="noopener noreferrer"} is a Windows API that opens a controlled browser experience for OAuth flows. It handles the redirect capture automatically, returning control to your application once the authorization code arrives at the callback URI.

```csharp
using Windows.Security.Authentication.Web;

public async Task<string?> AuthenticateWithOAuthAsync(
    string authorizationEndpoint,
    string clientId,
    string redirectUri,
    string scope)
{
    var requestUri = new Uri(
        $"{authorizationEndpoint}" +
        $"?client_id={Uri.EscapeDataString(clientId)}" +
        $"&response_type=code" +
        $"&redirect_uri={Uri.EscapeDataString(redirectUri)}" +
        $"&scope={Uri.EscapeDataString(scope)}" +
        $"&code_challenge={GeneratePkceChallenge()}" +
        $"&code_challenge_method=S256");

    var callbackUri = new Uri(redirectUri);

    var result = await WebAuthenticationBroker.AuthenticateAsync(
        WebAuthenticationOptions.None,
        requestUri,
        callbackUri);

    if (result.ResponseStatus != WebAuthenticationStatus.Success)
        return null;

    // The response data contains the full redirect URI with the code as a query parameter
    var responseUri = new Uri(result.ResponseData);
    var query = System.Web.HttpUtility.ParseQueryString(responseUri.Query);
    return query["code"];
}
```

Always use [PKCE (Proof Key for Code Exchange)](https://oauth.net/2/pkce/){:target="_blank" rel="noopener noreferrer"} for public clients. A desktop application cannot keep a client secret truly secret since the binary ships to the user's machine, so PKCE provides the equivalent protection without requiring a secret by binding the authorization code to a verifier known only to the initiating client.

### Microsoft Identity with MSAL

For applications that authenticate against Microsoft Entra ID (Azure AD) or Microsoft personal accounts, [MSAL.NET](https://learn.microsoft.com/en-us/entra/identity-platform/msal-overview){:target="_blank" rel="noopener noreferrer"} is the recommended library. It handles the OAuth flow, token caching, silent refresh, and the interaction with the WAM (Windows Authentication Manager) broker, which provides single sign-on across applications using the user's Windows account.

```csharp
using Microsoft.Identity.Client;

public class MsalAuthService
{
    private readonly IPublicClientApplication _app;
    private readonly string[] _scopes = ["User.Read"];

    public MsalAuthService(string clientId, string tenantId)
    {
        _app = PublicClientApplicationBuilder
            .Create(clientId)
            .WithAuthority($"https://login.microsoftonline.com/{tenantId}")
            .WithDefaultRedirectUri()
            .Build();
    }

    public async Task<AuthenticationResult?> AcquireTokenAsync(IntPtr windowHandle)
    {
        // Try silent acquisition first using a cached token
        try
        {
            var accounts = await _app.GetAccountsAsync();
            return await _app
                .AcquireTokenSilent(_scopes, accounts.FirstOrDefault())
                .ExecuteAsync();
        }
        catch (MsalUiRequiredException)
        {
            // No cached token; prompt the user interactively
        }

        // Fall through to interactive acquisition
        return await _app
            .AcquireTokenInteractive(_scopes)
            .WithParentActivityOrWindow(windowHandle)
            .ExecuteAsync();
    }
}
```

MSAL caches tokens in memory by default. For persistent caching between sessions, attach a [token cache serializer](https://learn.microsoft.com/en-us/entra/msal/dotnet/how-to/token-cache-serialization){:target="_blank" rel="noopener noreferrer"} that stores the encrypted cache to a file or to `PasswordVault`. MSAL encrypts the cache using DPAPI before writing, so the cached tokens on disk are not readable without the user's credentials.

---

## Code Signing and MSIX Requirements

Code signing serves two purposes. First, it establishes the identity of the publisher so Windows and users can verify who produced the executable. Second, it provides tamper detection: if the binary changes after signing, the signature becomes invalid and Windows will warn or block execution depending on the security policy.

MSIX packages require signing before they can be installed. An unsigned MSIX is rejected by the Windows installer. During development, Visual Studio supports signing with a self-signed certificate for local testing, but production packages distributed outside the Microsoft Store must be signed with a certificate from a trusted Certificate Authority such as [DigiCert](https://www.digicert.com/signing/code-signing-certificates){:target="_blank" rel="noopener noreferrer"} or [Sectigo](https://sectigo.com/ssl-certificates-tls/code-signing){:target="_blank" rel="noopener noreferrer"}.

For Store submissions, Microsoft signs the package on your behalf during the submission process, so you do not need a separate code-signing certificate for Store distribution.

To sign a package with `signtool.exe` during a CI/CD pipeline:

```bash
signtool sign \
  /fd SHA256 \
  /tr http://timestamp.digicert.com \
  /td SHA256 \
  /f MyApp.pfx \
  /p $CERT_PASSWORD \
  MyApp.msix
```

The `/tr` and `/td` flags specify a timestamp server and timestamp digest algorithm. Timestamping is not optional for production packages: without it, the package signature expires when the signing certificate expires, which would invalidate all previously distributed installers. With a timestamp, the signature remains valid as long as it was created while the certificate was valid, even after the certificate itself has expired.

Extended Validation (EV) certificates provide a higher level of trust and bypass the SmartScreen reputation warning period that new publishers typically encounter. Standard OV (Organization Validation) certificates also work but may trigger SmartScreen warnings until the publisher accumulates reputation. For enterprise applications distributed internally, certificates from an internal CA trusted by the organization's machines work without these restrictions.

---

## Data Protection with DPAPI

The [Data Protection API](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.protecteddata){:target="_blank" rel="noopener noreferrer"} provides symmetric encryption tied to either the current user's credentials or the current machine. Data encrypted with `DataProtectionScope.CurrentUser` can only be decrypted by the same user on any machine where they are authenticated. Data encrypted with `DataProtectionScope.LocalMachine` can be decrypted by any user on the same machine.

The `ProtectedData` class in `System.Security.Cryptography` wraps DPAPI with a simple byte-array interface.

```csharp
using System.Security.Cryptography;

public class LocalDataProtection
{
    // Optional entropy adds an application-specific secret to the key derivation,
    // preventing other applications from decrypting your data even on the same machine
    private static readonly byte[] Entropy = [0x4A, 0x8F, 0x2C, 0x91, 0xE3, 0x57, 0xB4, 0x0D];

    public static byte[] Protect(byte[] plaintext)
    {
        return ProtectedData.Protect(
            plaintext,
            Entropy,
            DataProtectionScope.CurrentUser);
    }

    public static byte[] Unprotect(byte[] ciphertext)
    {
        return ProtectedData.Unprotect(
            ciphertext,
            Entropy,
            DataProtectionScope.CurrentUser);
    }

    public static string ProtectString(string value)
    {
        var plainBytes = Encoding.UTF8.GetBytes(value);
        var cipherBytes = Protect(plainBytes);
        return Convert.ToBase64String(cipherBytes);
    }

    public static string UnprotectString(string base64Ciphertext)
    {
        var cipherBytes = Convert.FromBase64String(base64Ciphertext);
        var plainBytes = Unprotect(cipherBytes);
        return Encoding.UTF8.GetString(plainBytes);
    }
}
```

DPAPI is appropriate for data that needs to persist to disk in encrypted form, such as cached OAuth tokens written to a file, application-level secrets like encryption keys, or any configuration value that would expose sensitive information if read as plain text. The Windows Credential Locker is better for individual credentials because it manages the lifecycle (add, retrieve, remove) more cleanly, but DPAPI handles arbitrary binary or structured data that does not fit the username/password model.

One limitation is that DPAPI ties decryption to the user's credentials. If a user's profile is migrated to a new machine or the profile is corrupted, previously encrypted data becomes permanently inaccessible. Applications should handle decryption failures gracefully by prompting reauthentication rather than surfacing an unhandled exception.

---

## Windows Hello and Biometric Authentication

[Windows Hello](https://learn.microsoft.com/en-us/windows/apps/develop/security/windows-hello){:target="_blank" rel="noopener noreferrer"} provides passwordless authentication through biometrics like fingerprint or facial recognition, or a PIN, backed by a Trusted Platform Module (TPM). For a WinUI 3 application, Windows Hello can serve as a second factor to unlock locally stored credentials without requiring the user to re-enter a password.

The `UserConsentVerifier` API checks whether the device supports biometric verification and prompts the user when verification is needed.

```csharp
using Windows.Security.Credentials.UI;

public class WindowsHelloService
{
    public static async Task<bool> IsAvailableAsync()
    {
        var availability = await UserConsentVerifier.CheckAvailabilityAsync();
        return availability == UserConsentVerifierAvailability.Available;
    }

    public static async Task<bool> RequestVerificationAsync(string message)
    {
        var result = await UserConsentVerifier.RequestVerificationAsync(message);
        return result == UserConsentVerificationResult.Verified;
    }
}
```

A practical pattern is to protect access to credentials stored in `PasswordVault` with Windows Hello verification. When the application starts, check whether Windows Hello is available and whether the user has opted into biometric protection. If so, call `RequestVerificationAsync` before retrieving credentials from the vault. This prevents credentials from being accessible if someone else sits down at an unlocked machine, without requiring the user to type a password.

```csharp
public async Task<string?> GetTokenWithBiometricGuardAsync(string username)
{
    if (await WindowsHelloService.IsAvailableAsync())
    {
        var verified = await WindowsHelloService.RequestVerificationAsync(
            "Verify your identity to access saved credentials.");

        if (!verified)
            return null;
    }

    return _credentialStore.RetrieveToken(username);
}
```

---

## Secure Storage Best Practices

Several common mistakes repeatedly appear in desktop application security, and they are worth addressing directly.

`ApplicationData.Current.LocalSettings` stores values as plain text in a registry hive under the user's profile. Anyone with access to the machine and the user's registry hive can read these values. Tokens, API keys, and passwords must never go into `LocalSettings`. Use `PasswordVault` for individual credentials and DPAPI-encrypted files for structured data.

Hardcoded secrets in source code or configuration files shipped with the application are not secrets. The binary can be decompiled with tools like dnSpy, and configuration files are readable as plain text. If a secret is burned into the application, assume it is compromised. Secrets that cannot be avoided on the client side should be scoped to minimum permissions, rotatable without shipping a new binary, and monitored for abuse.

Logging frameworks should never receive raw token values. It is easy to accidentally include an authorization header or a credential in an exception message that gets written to a log file. When catching authentication exceptions, log only the exception type and a sanitized message; never log the token, the full URL if it contains query-parameter credentials, or the request headers.

For network calls, use HTTPS exclusively. WinUI 3 does not impose the network capability model that UWP did, so there is no automatic enforcement. Configure `HttpClient` with a base address that uses `https://`, and reject self-signed certificates in production by not overriding the certificate validation callback. If integration testing requires bypassing certificate validation, scope that override to a named client registered in development only, not to the production configuration.

---

## HTTPS and Certificate Pinning

For applications that communicate with a known server whose certificate is under your control, certificate pinning provides an additional layer of protection against man-in-the-middle attacks. Instead of trusting any certificate signed by a CA in the Windows trust store, pinning validates that the server's certificate (or its public key) matches a specific expected value.

```csharp
public static HttpClientHandler CreatePinnedHandler(string expectedThumbprint)
{
    return new HttpClientHandler
    {
        ServerCertificateCustomValidationCallback = (message, cert, chain, errors) =>
        {
            if (errors != System.Net.Security.SslPolicyErrors.None)
                return false;

            // Compare the server's certificate thumbprint to the expected value
            return string.Equals(
                cert?.GetCertHashString(System.Security.Cryptography.HashAlgorithmName.SHA256),
                expectedThumbprint,
                StringComparison.OrdinalIgnoreCase);
        }
    };
}
```

Pinning introduces an operational cost: when the server's certificate is renewed, the application must ship a new expected thumbprint before the old certificate expires. Public key pinning mitigates this by pinning the public key rather than the full certificate, which can remain stable across certificate renewals if the same key pair is reused. For most WinUI 3 applications communicating with first-party APIs, standard CA validation combined with HTTPS is sufficient. Pinning is most justified for applications handling financial data, medical records, or credentials where MITM attacks carry significant consequences.
