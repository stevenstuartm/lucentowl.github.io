---
title: "Security and Credential Management"
layout: guide
category: "WinUI 3"
subcategory: "Advanced Features"
description: "What a WinUI 3 desktop app can and can't protect on the user's machine, and the Windows APIs for it: the Credential Locker, DPAPI, signing users in with OAuth2Manager or MSAL and WAM, Windows Hello consent and key credentials, and keeping secrets out of the binary and the logs."
tags: [credential-locker, dpapi, windows-hello, oauth2manager, msal, practical]
---

## Table of Contents

- [What a Desktop App Can Protect](#what-a-desktop-app-can-protect)
- [Choosing Where a Secret Lives](#choosing-where-a-secret-lives)
- [The Credential Locker](#the-credential-locker)
- [Encrypting Data with DPAPI](#encrypting-data-with-dpapi)
- [Signing Users In](#signing-users-in)
- [Windows Hello](#windows-hello)
- [Secrets That Don't Belong on the Client](#secrets-that-dont-belong-on-the-client)

---

## What a Desktop App Can Protect

A WinUI 3 app is a full-trust desktop process. Whether it's packaged or unpackaged, it runs with the signed-in user's rights: it can read the user's files, the registry keys the user can read, and the memory of other processes the user owns. MSIX packaging gives the app an identity and a clean install and uninstall, but it isn't a sandbox. (Microsoft's Win32 app isolation can run a packaged app inside an AppContainer, Windows' restricted-rights sandbox, but it has been in preview, so check its release status before depending on it.)

That sets the threat model. Anything the app can read, other code running as the same user can read too, so no client-side API hides a secret from malware running in the user's session. What the Windows APIs protect against is narrower, and each piece still closes a common leak:

- **Other users on the same machine.** Per-user storage and per-user encryption keep one account's secrets away from another.
- **Offline access to the disk.** A stolen laptop or a copied profile folder yields encrypted data, not readable tokens.
- **Casual exposure.** Secrets that aren't in plain-text files, logs, or crash dumps don't leak through backups, support tickets, or a colleague looking over a shoulder.

Everything else in this guide follows from that: store secrets where Windows encrypts them per user, keep the ones that can't be protected off the client entirely, and let the operating system handle sign-in.

---

## Choosing Where a Secret Lives

| What | Where | Why |
| --- | --- | --- |
| A password or other short secret the user chose to save | Credential Locker (`PasswordVault`) | Encrypted per user by Windows, with add, find, and remove built in |
| An OAuth token cache or other larger blob | A file encrypted with DPAPI, or MSAL's own cache helper | Microsoft reserves the locker for passwords, and a cache outgrows it |
| Settings and preferences that aren't secret | App settings or a plain file | No protection needed, and no reason to pay for it |
| A client secret, API key with broad rights, or signing key | A backend service, never the app | A desktop binary can't keep anything from its own users |

App settings deserve one warning. `ApplicationData` settings and local files are stored unencrypted in the user's profile, so a token written there is readable by anyone who can read that profile.

---

## The Credential Locker

The Credential Locker is Windows' per-user store for credentials, reached through `PasswordVault` in `Windows.Security.Credentials`. It works in WinUI 3 apps packaged or unpackaged. Each `PasswordCredential` has a resource name (usually the app or service), a user name, and a password field that holds the secret.

The locker is per user, not per app, for a full-trust app. A UWP app or an app in an AppContainer sees only its own locker, but a regular desktop app can read every locker the user has, including other apps'. Any desktop program running as the user can therefore call `RetrieveAll` and read the app's credentials, which is the threat model above in one API. It also means two desktop apps that pick the same resource name share entries, so the resource name should be specific to the app.

```csharp
using Windows.Security.Credentials;

public sealed class CredentialStore
{
    private const string Resource = "Contoso.Sync";
    private const int ElementNotFound = unchecked((int)0x80070490);
    private readonly PasswordVault _vault = new();

    public void Save(string userName, string secret)
    {
        Remove(userName);   // Keep exactly one entry per user
        _vault.Add(new PasswordCredential(Resource, userName, secret));
    }

    public string? Retrieve(string userName)
    {
        try
        {
            PasswordCredential credential = _vault.Retrieve(Resource, userName);
            credential.RetrievePassword();
            return credential.Password;
        }
        catch (Exception ex) when (ex.HResult == ElementNotFound)
        {
            return null;
        }
    }

    public void Remove(string userName)
    {
        try
        {
            _vault.Remove(_vault.Retrieve(Resource, userName));
        }
        catch (Exception ex) when (ex.HResult == ElementNotFound)
        {
        }
    }
}
```

The locker's API has a few habits that surprise people:

- **Lookups throw when nothing matches.** `Retrieve`, `FindAllByResource`, and `FindAllByUserName` throw instead of returning nothing, which happens on every first launch. The reference pages don't name the error code. In practice it's `ELEMENT_NOT_FOUND` (0x80070490), which the sample filters on so that other failures still surface.
- **The find methods leave out the password.** Credentials from `FindAllByResource` and `FindAllByUserName` come back without it, and `RetrievePassword()` fills in `Password`. `Retrieve` returns the whole credential, and Microsoft's sample calls `RetrievePassword()` anyway, which does no harm.
- **The 20-credential limit doesn't apply here.** `PasswordVault.Add` throws past 20 credentials per app, but only for UWP apps and desktop apps running in an AppContainer. A full-trust WinUI 3 app isn't bound by it, though an app that later moves into Win32 app isolation would be.
- **It's for passwords.** Microsoft's guidance is to store passwords in the locker, not larger blobs, and to save one only after the user has signed in successfully and chosen to be remembered.

Microsoft's documentation also says locker credentials roam to the user's other devices with their Microsoft account, except credentials added while signed in with a domain account. A secret saved on one machine may therefore appear on another.

---

## Encrypting Data with DPAPI

The Data Protection API (DPAPI) encrypts arbitrary bytes with a key Windows derives from the user's credentials, so the app never manages a key itself. .NET exposes it as `ProtectedData` in the `System.Security.Cryptography.ProtectedData` package, which works only on Windows.

```csharp
using System.Security.Cryptography;

public static class LocalProtection
{
    // Entropy makes this app's ciphertext useless to a caller that doesn't know the value.
    // It ships in the binary, so it isn't a secret from anyone who inspects the app.
    private static readonly byte[] Entropy = "Contoso.Sync.v1"u8.ToArray();

    public static byte[] Protect(byte[] plaintext) =>
        ProtectedData.Protect(plaintext, Entropy, DataProtectionScope.CurrentUser);

    public static byte[] Unprotect(byte[] ciphertext) =>
        ProtectedData.Unprotect(ciphertext, Entropy, DataProtectionScope.CurrentUser);
}
```

The scope decides who can decrypt. `CurrentUser` limits it to code running as the same user, and because the key material lives in the user's profile, the data generally can't be decrypted on another machine unless the profile goes with it. `LocalMachine` lets any user on the machine decrypt, which rarely fits a secret. The optional entropy is an extra input the caller must supply, so another program running as the same user can't decrypt the app's data by calling DPAPI blindly. It stops only programs that don't know the value, and anyone who reads the app's binary does.

DPAPI fits the blobs the locker doesn't: a serialized token cache, a local encryption key for a database, or a structured settings file with secrets in it. Decryption can fail when the user's profile is rebuilt, moved to a new machine, or has its keys reset, so code that unprotects on startup treats a `CryptographicException` as "sign in again" rather than letting it crash the app.

---

## Signing Users In

The protocol side of signing in (OAuth 2.0, the authorization code flow, and PKCE, or Proof Key for Code Exchange) is the same for every native app. What's specific to WinUI 3 is which Windows API runs it:

| Provider | API | Where the user signs in | What it adds |
| --- | --- | --- | --- |
| Any OAuth 2.0 provider (GitHub, Google, the app's own server) | `OAuth2Manager` | The default browser | A standards-based flow with nothing Microsoft-specific |
| Microsoft Entra ID or a personal Microsoft account | MSAL with WAM | The Windows sign-in broker | Silent sign-in with the Windows account, device-bound tokens, Windows Hello, Conditional Access |

**`WebAuthenticationBroker` doesn't work in desktop apps.** It's a UWP API that depends on the UWP app model, and Microsoft lists it among the WinRT APIs that desktop apps can't use, with no workaround. Code carried over from UWP that calls it fails at run time.

**`OAuth2Manager`**, in `Microsoft.Security.Authentication.OAuth` (Windows App SDK 1.7 and later), is the replacement for any OAuth 2.0 provider, such as GitHub, Google, or the app's own identity server. Microsoft's pages disagree on its channel. The API reference lists it in the stable 1.7, 1.8, and 2.0 releases with no experimental marking, and the migration guide calls it the replacement for `WebAuthenticationBroker` since 1.7, but the OAuth 2.0 how-to (August 2026) says it's available only in the experimental channel. Check that the package the app targets actually contains `Microsoft.Security.Authentication.OAuth` before building on it. It follows RFC 8252, the IETF's guidance for native apps. It opens the authorization page in the user's default browser rather than an embedded one, and for sign-in it offers only the authorization code grant with PKCE, with no implicit or password grant. Microsoft's sample never computes a PKCE challenge itself: the token request is built from the authorization response, so the API carries the verifier from one step to the next. It takes the window's `WindowId`, which a `Window` exposes as `AppWindow.Id`, so the browser prompt is tied to the app:

```csharp
var request = AuthRequestParams.CreateForAuthorizationCodeRequest(
    "contoso-desktop", new Uri("contoso-app:/oauth-callback/"));
request.Scope = "read:profile";

AuthRequestResult result = await OAuth2Manager.RequestAuthWithParamsAsync(
    this.AppWindow.Id, new Uri("https://id.contoso.example/authorize"), request);

if (result.Response is AuthResponse response)
{
    TokenRequestResult tokens = await OAuth2Manager.RequestTokenAsync(
        new Uri("https://id.contoso.example/token"),
        TokenRequestParams.CreateForAuthorizationCodeRequest(response));

    if (tokens.Response is TokenResponse token)
    {
        // Use token.AccessToken; keep token.RefreshToken for later
    }
    else
    {
        // tokens.Failure.Error and ErrorDescription say why
    }
}
```

The provider redirects to `contoso-app:`, a custom URI scheme the app registers with Windows so that links using it open the app. The app passes the activation URI to `OAuth2Manager.CompleteAuthRequest`. When Windows starts a second instance for the redirect, that instance hands the URI over this way and exits, as Microsoft's sample does, and the original instance's `RequestAuthWithParamsAsync` returns. The token request carries no client secret, because a desktop app is a public client, one that can't keep a secret from its users. When the access token expires, `TokenRequestParams.CreateForRefreshToken` gets a new one, and the refresh token between uses belongs in a DPAPI-protected file, not the locker.

{% include figure.html id="winui-oauth2-redirect" %}

**MSAL with the Web Account Manager (WAM)** is the choice for Microsoft Entra ID and personal Microsoft accounts. WAM is the Windows sign-in broker, so the user can pick the account they're already signed in to Windows with. Refresh tokens are bound to the device, and Windows Hello and Conditional Access (the organization's sign-in policies, such as requiring a managed device) work without extra code. WAM supports only Entra ID, not third-party providers, and for Azure AD B2C or ADFS authorities MSAL falls back to a browser. It needs MSAL.NET 4.52.0 or later, the `Microsoft.Identity.Client.Broker` package, a redirect URI of the form `ms-appx-web://microsoft.aad.brokerplugin/{client_id}` in the app registration, and a window handle, the Win32 HWND behind the XAML window, to parent its dialog. `App.MainWindow` below is a property the app defines to expose its window, since the template keeps the window in a private field:

```csharp
using Microsoft.Identity.Client;
using Microsoft.Identity.Client.Broker;

IntPtr hwnd = WinRT.Interop.WindowNative.GetWindowHandle(App.MainWindow);

IPublicClientApplication msal = PublicClientApplicationBuilder
    .Create(clientId)
    .WithParentActivityOrWindow(() => hwnd)
    .WithBroker(new BrokerOptions(BrokerOptions.OperatingSystems.Windows))
    .Build();

string[] scopes = ["User.Read"];
IAccount? account = (await msal.GetAccountsAsync()).FirstOrDefault();

AuthenticationResult result;
try
{
    // The cached account, or else the account signed in to Windows
    result = await msal
        .AcquireTokenSilent(scopes, account ?? PublicClientApplication.OperatingSystemAccount)
        .ExecuteAsync();
}
catch (MsalUiRequiredException)
{
    result = await msal.AcquireTokenInteractive(scopes).ExecuteAsync();
}
```

MSAL keeps its token cache in memory unless the app persists it. For desktop apps Microsoft recommends the `Microsoft.Identity.Client.Extensions.Msal` package, whose `MsalCacheHelper` stores the cache in a file encrypted with DPAPI on Windows. Without the broker, an unpersisted cache means the user signs in again on every launch. With WAM, silent sign-in through the Windows account still works, but MSAL keeps ID tokens and account details in that cache, so `GetAccountsAsync` forgets the app's accounts at every restart unless it's persisted.

Either way, sign-in happens in the browser or the broker, never in the app's own UI. Collecting the password in a XAML form, or showing the provider's page in a WebView2 and reading tokens out of it, is the embedded-browser pattern that providers block and that exposes the password to the app.

---

## Windows Hello

Windows Hello offers two different things, and they protect different amounts.

**A consent prompt.** `UserConsentVerifier` asks the user to confirm with their face, fingerprint, or PIN, and reports whether they did. In a desktop app the prompt has to be parented to a window, so a WinUI 3 app calls the interop version, `UserConsentVerifierInterop.RequestVerificationForWindowAsync(hwnd, message)`, instead of `RequestVerificationAsync`:

```csharp
using Windows.Security.Credentials.UI;

IntPtr hwnd = WinRT.Interop.WindowNative.GetWindowHandle(App.MainWindow);

if (await UserConsentVerifier.CheckAvailabilityAsync() != UserConsentVerifierAvailability.Available)
{
    // No Windows Hello on this device: fall back to asking for the app's password, don't skip the check
    return await ConfirmWithPasswordAsync();
}

UserConsentVerificationResult result =
    await UserConsentVerifierInterop.RequestVerificationForWindowAsync(
        hwnd, "Confirm it's you to show saved passwords.");

return result == UserConsentVerificationResult.Verified;
```

The sample fails closed. A device without Windows Hello, or with it turned off by policy, gets another check instead of a free pass.

The prompt is a check in the app's own code, not a lock on the data. It stops someone at an unlocked machine from using the app's UI to reveal a saved secret, and nothing more. The secret stays in the locker or the DPAPI file whether or not the prompt succeeds, readable by any code running as that user. Microsoft suggests this prompt for confirming a sensitive action, such as a banking app re-checking before it sends a transfer.

**A key credential.** `KeyCredentialManager` creates a key pair for an account. Windows keeps the private key in the TPM (Trusted Platform Module, the security chip on most PCs) when the device has one, and the app never sees it. The exchange with the app's backend has two parts:

1. **Registration.** The app creates the key, and Windows Hello prompts the user. The app sends the public key to its backend, which stores it against the account and the device.
2. **Sign-in.** The backend sends a random challenge. The app asks Windows to sign it, Windows Hello prompts again, and the backend checks the signature with the stored public key.

Only the user's gesture can release that key, so the backend learns that this user on this device approved the request. It replaces a password rather than guarding one. The calls that prompt follow the same window rule as the consent prompt. From the Windows 11 24H2 SDK (26100), `KeyCredentialManager.RequestCreateForWindowAsync` and `KeyCredential.RequestSignForWindowAsync` take the window's ID, while the older `RequestCreateAsync` and `RequestSignAsync` belong to the family of `Request` methods that Microsoft lists as generally unsupported in desktop apps.

The costs come with the guarantee. The app needs a backend that stores public keys and issues challenges. Each device registers separately, so a second PC means a second key. A PIN reset destroys the key, `OpenAsync` then reports `NotFound`, and the app has to register again. Passkeys, which Microsoft points new apps toward alongside Windows Hello, build on the same idea, a device-held key the user unlocks with a gesture, in a standard form that websites and other platforms share.

---

## Secrets That Don't Belong on the Client

Some secrets can't be protected on a user's machine by any API, because the app itself has to read them.

- **Anything compiled into the binary.** .NET assemblies decompile readily, and configuration files ship as plain text. A key in either is public. A client secret for an OAuth provider falls in this group, which is why desktop apps use public-client flows with PKCE, and why a token exchange that needs a secret runs on a backend.
- **Keys with broad rights.** A key the app must hold should be scoped to the least it needs, rotatable without shipping a new build, and monitored for abuse, on the assumption that someone has already extracted it.
- **Tokens in logs.** A logged `Authorization` header, a URL with credentials in its query string, or an exception message that includes a token turns the log file into a credential store with no encryption. Log the failure's type and a redacted message instead.

Traffic to the app's services goes over HTTPS with the platform's normal certificate validation. Turning off validation for testing belongs only in debug configurations, and certificate pinning, which trusts only a specific certificate or key, trades protection against a compromised certificate authority for an app update every time the pinned certificate changes.
