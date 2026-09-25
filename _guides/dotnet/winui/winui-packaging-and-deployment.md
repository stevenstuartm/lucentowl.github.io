---
title: "Packaging and Deployment"
layout: guide
category: "WinUI 3"
subcategory: "Platform Integration"
description: "Shipping a WinUI 3 app: packaged, unpackaged, or packaged with external location; framework-dependent or self-contained runtime; code signing and SmartScreen; and distribution through the Microsoft Store, App Installer, or enterprise tools."
tags: [practical, msix, package-identity, self-contained-deployment, code-signing, app-installer, microsoft-store]
---
{% raw %}

## Table of Contents

- [Three Ways to Ship](#three-ways-to-ship)
- [What MSIX Gives an App](#what-msix-gives-an-app)
- [The Windows App SDK Runtime: Framework-Dependent or Self-Contained](#the-windows-app-sdk-runtime-framework-dependent-or-self-contained)
- [Unpackaged Apps](#unpackaged-apps)
- [Code Signing](#code-signing)
- [Distribution](#distribution)
- [Building Packages in CI](#building-packages-in-ci)


## Three Ways to Ship

A WinUI 3 app is a Win32 program, so unlike a UWP app it doesn't have to ship as a package. The first decision is how much of MSIX, Windows' app package format, to use. That decides whether the app has package identity: a name, publisher, and version that Windows knows the app by, verified by the package's signature.

| | Packaged (MSIX) | Packaged with external location | Unpackaged |
|---|---|---|---|
| **What ships** | An `.msix` package containing the app | The app's own files and installer, plus a small identity-only MSIX package that points at them | The app's files, installed however you like |
| **Package identity** | Yes | Yes | No |
| **Install, update, uninstall** | Handled by Windows, including clean removal | Your installer, with identity registered alongside | Your installer, or simply copying the folder (xcopy deployment) |
| **Typical use** | New apps, Store apps | Existing installers that need identity-only features | Enterprise tools, suites with a shared installer, portable apps |

Identity is what many platform features key on. A packaged app declares file associations, protocols, startup tasks, background tasks, and COM servers in its manifest. It gets per-app storage through `ApplicationData`, can update through the Store or App Installer, and can call APIs that ask "which app is this?" An unpackaged app does many of the same things through Win32 means, such as registry entries its installer writes, but APIs that need identity, such as `Package.Current` or `Windows.Storage.ApplicationData.Current`, throw. Several guides in this series note which mode a feature needs, and those notes all trace back to this choice.

Visual Studio's WinUI template is packaged, and MSIX is Microsoft's recommended default for most apps. The constraints that push some teams away from it come with that model. A packaged app's install folder is read-only, its writes to `AppData` and the registry are redirected into per-package storage, a single-project package holds only one executable, and integrations that reach deep into the system work only where the manifest has an extension for them. Apps that fight those constraints ship unpackaged or packaged with external location.


## What MSIX Gives an App

An MSIX package is a signed container of the app's files and a manifest. Windows stages a package's files once per machine in a protected location, then registers it for each user who installs it, and removes it cleanly on uninstall. For a packaged desktop app, new files it writes under `AppData` are redirected to a private per-package location, so uninstalling leaves nothing behind. Updates download only the changed blocks of the package.

`Package.appxmanifest` declares what Windows needs to know:

- **Identity**: the package name, the publisher (which must match the signing certificate's subject), and a four-part version.
- **Dependencies**: framework packages the app needs, such as the Windows App SDK runtime, which Windows installs from the Store alongside a Store app.
- **Capabilities**: protected resources the app uses, such as the microphone or location.
- **Extensions**: how the app plugs into Windows, including file type associations, protocols, startup tasks, notification activation, and background tasks.

Current WinUI projects use single-project MSIX. The manifest lives in the app project, and building the project with packaging enabled produces the `.msix`. A single-project package can hold only one executable, so an app that ships several executables in one package still needs a separate Windows Application Packaging Project that references them, as older solutions used. Settings such as self-contained deployment then have to be set in that packaging project too.

### Packaged with External Location

An app with its own installer can gain identity without moving into an MSIX. Since Windows 10 version 2004, its installer registers a small identity package, a signed MSIX whose manifest declares the app's identity and points at the folder where the installer put the app, and the app's executable carries a matching identity entry in its own manifest. The files stay where the installer put them, and the app gets the identity-keyed features. Visual Studio builds the identity package through a Windows Application Packaging Project with the Package with External Location extension. Tooling that isn't Visual Studio, or several executables sharing one identity, means building it by hand.


## The Windows App SDK Runtime: Framework-Dependent or Self-Contained

Every WinUI 3 app needs the Windows App SDK runtime, and it can get it one of two ways.

### Framework-Dependent: Share the Installed Runtime

By default an app is framework-dependent. The runtime is a set of MSIX packages installed once per machine and shared by every app that uses it:

| Package | Role |
|---|---|
| **Framework** | The runtime binaries, WinUI included, loaded into each app's process |
| **Main** | Keeps the framework updated from the Store and tracks which apps use it |
| **Singleton** | A long-running shared process for features that can't live in the framework, chiefly push notifications for unpackaged apps |
| **DDLM** (Dynamic Dependency Lifetime Manager) | Stops Windows updating the framework while an unpackaged app, or one packaged with external location, is using it |

How the runtime reaches the machine depends on how the app ships:

- **A packaged app** declares the framework as a dependency in its manifest, and a Store install brings it automatically. Microsoft requires Store apps, and recommends other packaged apps, to call the Windows App SDK's deployment API at startup to make sure the rest of the runtime is present.
- **An unpackaged app** (or one packaged with external location) has to install the runtime itself, usually by running the redistributable installer, `WindowsAppRuntimeInstall.exe --quiet`, from its own setup. At startup the app then locates the installed runtime through the bootstrapper, which setting `WindowsPackageType` to `None` wires up automatically.

The payoff is serviceability. When Microsoft ships a servicing update to the framework, a patch release with security and reliability fixes, every framework-dependent app picks it up on its next launch without a new release of its own, because the runtime keeps compatibility within a major version. The cost is a dependency the app doesn't control: another installer or a user can remove the shared runtime, and a servicing update can, rarely, change behavior.

### Self-Contained: Carry the Runtime

Setting `WindowsAppSDKSelfContained` copies the runtime into the app's own output. A .NET app also has to publish as self-contained .NET for the app as a whole to have no install prerequisites:

```xml
<PropertyGroup>
  <WindowsAppSDKSelfContained>true</WindowsAppSDKSelfContained>
  <SelfContained>true</SelfContained>
</PropertyGroup>
```

A self-contained packaged app carries the runtime inside its MSIX. A self-contained unpackaged app puts it beside the `.exe`, so the output folder can be copied to a machine and run.

{% endraw %}
{% include figure.html id="winui-runtime-deployment" %}
{% raw %}

The trade-offs mirror the framework-dependent ones:

| | Framework-dependent | Self-contained |
|---|---|---|
| **Runtime version** | Whatever is installed, updated by Microsoft | Exactly the one you shipped |
| **Security and bug fixes** | Arrive automatically | Arrive when you rebuild and release |
| **Install prerequisites** | The runtime must be installed | None |
| **Size and memory (unpackaged apps)** | Small, and apps using the same runtime share its loaded code in memory | Larger download, slower loading, and no memory shared with other apps |

Self-contained doesn't install the Singleton package. Push notifications depend on it, so a self-contained app should check `PushNotificationManager.IsSupported()` and treat push as optional, or install the Singleton package in its own setup. Self-contained deployment also belongs only in the app project, not in class libraries.

For a Store app, framework-dependent is the usual choice, because the Store installs and services the runtime. Self-contained suits apps that must run from a copied folder, and environments that validate an exact runtime and don't want it changing underneath them.


## Unpackaged Apps

Setting `WindowsPackageType` to `None` builds a plain folder of files instead of an MSIX:

```xml
<PropertyGroup>
  <WindowsPackageType>None</WindowsPackageType>
</PropertyGroup>
```

In Visual Studio, run it with the *Unpackaged* launch profile, since the *Package* profile tries to deploy an MSIX. Unpackaged apps are distributed by an MSI or EXE installer, a deployment tool such as Intune or Configuration Manager, or simple xcopy. They also need the Visual C++ Redistributable on the machine, which a packaged app gets through its framework dependency instead.

What an unpackaged app gives up is everything tied to identity: manifest-declared extensions (file associations, protocols, and startup tasks have to be registered by other means), background tasks through `BackgroundTaskBuilder`, automatic updates through the Store or App Installer, and the identity-keyed APIs mentioned above. An app that needs just one of those can be packaged with external location instead, keeping its installer and adding identity.

An unpackaged, self-contained app can also publish as a single `.exe` (Windows App SDK 1.5 and later). It needs a specific set of properties. The Windows App SDK build reports an error if `WindowsPackageType`, `EnableMsixTooling`, or `IncludeAllContentForSelfExtract` is missing, and a warning for either self-contained property:

```xml
<PropertyGroup>
  <WindowsPackageType>None</WindowsPackageType>
  <WindowsAppSDKSelfContained>true</WindowsAppSDKSelfContained>
  <SelfContained>true</SelfContained>
  <EnableMsixTooling>true</EnableMsixTooling>
  <IncludeAllContentForSelfExtract>true</IncludeAllContentForSelfExtract>
  <PublishSingleFile>true</PublishSingleFile>
</PropertyGroup>
```

The single file is a convenience for distribution rather than a true single binary. On first launch it extracts its contents to a temporary folder and runs from there. Packaged and framework-dependent apps can't use `PublishSingleFile`.


## Code Signing

A signature does two jobs. It proves who published the code, and it makes any change after signing detectable. Windows won't install an MSIX package from an untrusted publisher. The one exception is an unsigned package installed with `Add-AppxPackage -AllowUnsigned`, which for a package containing executable code needs an administrator. The certificate's subject must match the `Publisher` in the package manifest exactly, and a mismatch between the two is a common reason signing fails in a pipeline.

### Which Certificate

Outside the Store, a signature also feeds SmartScreen, the Windows check that warns users about downloaded files it has little history for. It scores a file by the reputation of its hash and of its signing publisher. Where the app is distributed decides the signing option:

| Option | Cost | SmartScreen | Use for |
|---|---|---|---|
| **Microsoft Store (MSIX)** | Free. The Store re-signs the package after certification | No warnings | Store apps |
| **Azure Artifact Signing** (formerly Trusted Signing) | About $9.99 a month | Reputation builds over time | Outside the Store, for organizations in the US, Canada, EU, or UK and individuals in the US or Canada |
| **OV (Organization Validation) certificate** from a certificate authority | About $150 to $300 a year, with the key on a hardware token or cloud hardware security module (HSM) | Reputation builds over time | Outside the Store, anywhere |
| **EV (Extended Validation) certificate** | $400 or more a year | Same as OV since 2024 | Only where a customer requires EV |
| **Self-signed** | Free | Treated like an unsigned file, and an MSIX won't install until the certificate is trusted on the machine | Development, and enterprise devices whose trust is managed |

The EV row reverses long-standing advice. Until 2024, an EV certificate gave a new app instant SmartScreen reputation. Microsoft removed that, and now every signed app outside the Store builds reputation the same way: through downloads under a consistent signing identity, which then carries across releases. Paying for EV to avoid SmartScreen warnings no longer works. Apps submitted to the Store as MSI or EXE installers, rather than MSIX, aren't re-signed and must be signed by a certificate from a trusted certificate authority.

For development, Visual Studio's **Package and Publish > Create App Packages** wizard creates a self-signed test certificate. Installing a package signed with it on another machine means installing that certificate as trusted there first. Enterprises do the same at scale, deploying an internal certificate through Group Policy or Intune so managed devices trust their line-of-business packages.

### Timestamping

Sign with a timestamp. Without one, the signature is valid only while the certificate is, and every package already distributed stops installing when the certificate expires. With a timestamp from a trusted server, the signature stays valid because it was made while the certificate was valid.

```powershell
signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 `
    /f MyApp.pfx /p $env:CERT_PASSWORD MyApp.msix
```

Azure Artifact Signing and HSM-held keys plug into the same `signtool` step through their own signing clients, so the private key never sits in the pipeline as a file.


## Distribution

### Microsoft Store

The Store is the recommended channel for most apps. It signs the package, installs and services the Windows App SDK runtime, delivers updates, and handles purchases. Submit through [Partner Center](https://partner.microsoft.com/dashboard){:target="_blank" rel="noopener noreferrer"}. The package identity in the manifest must match the identity Partner Center reserves for the app, and the fourth part of the version is reserved for the Store and must be 0. For more than one architecture, upload a bundle, one file holding a package per architecture, and the Store delivers the matching one to each device.

An app can check for and install its Store updates from inside itself with `StoreContext`, such as `GetAppAndOptionalStorePackageUpdatesAsync`. `StoreContext` is one of the classes that must be given an owner window before it shows UI in a desktop app. The Store also accepts unpackaged apps as MSI or EXE installers, through a separate submission path, but it doesn't push updates to those.

### Sideloading with App Installer

Outside the Store, a packaged app can be installed directly by opening its `.msix` or `.msixbundle`. Sideloading is enabled by default on Windows 10 version 2004 and later. For updates, publish an `.appinstaller` file next to the package on a web server or file share. The user installs by opening that file, and App Installer then checks it for newer versions:

```xml
<?xml version="1.0" encoding="utf-8"?>
<AppInstaller xmlns="http://schemas.microsoft.com/appx/appinstaller/2021"
    Version="1.4.0.0"
    Uri="https://apps.contoso.com/editor/Editor.appinstaller">
  <MainBundle Name="Contoso.Editor" Version="1.4.0.0"
      Publisher="CN=Contoso Ltd, O=Contoso Ltd, C=US"
      Uri="https://apps.contoso.com/editor/Editor_1.4.0.0.msixbundle" />
  <UpdateSettings>
    <OnLaunch HoursBetweenUpdateChecks="12" ShowPrompt="true" UpdateBlocksActivation="false" />
    <AutomaticBackgroundTask />
  </UpdateSettings>
</AppInstaller>
```

To release, publish the new package and update the versions and URIs in the `.appinstaller` file. Two current behaviors catch people out:

- **Visual Studio writes the old schema.** It generates `.appinstaller` files with the `2017/2` namespace, which silently ignores `HoursBetweenUpdateChecks`, `ShowPrompt`, and `UpdateBlocksActivation`. Change the namespace to `2021`, as above.
- **One-click web installs are off.** The `ms-appinstaller:` link that let a web page start an install directly has been disabled by default since December 2023, after malware campaigns abused it. Link to the `.appinstaller` file itself instead, so users download and open it. Enterprises can turn the protocol back on by policy.

ClickOnce, the auto-updating deployment that WPF and WinForms apps use, doesn't support WinUI 3 apps, so App Installer fills that role. An unpackaged app outside the Store updates itself however its installer or a third-party updater arranges.

### WinGet

Submitting a manifest to the Windows Package Manager community repository, a free pull request to `microsoft/winget-pkgs`, makes the app installable with `winget install`. Developers and administrators who script their machines look there first.

### Enterprise Deployment

Managed environments push packages through Intune, Configuration Manager, or PowerShell, and can provision a package for every user of a machine rather than one at a time. The signing certificate has to be trusted on each device, which device management handles for an internal certificate. An unpackaged app goes out through the same tools as any other MSI or EXE, with the Windows App SDK runtime installer chained into its setup when it's framework-dependent.


## Building Packages in CI

Microsoft's CI guidance builds a single-project WinUI app's MSIX with MSBuild, where `GenerateAppxPackageOnBuild` is the switch that makes a build output a package. The GitHub Actions steps below follow it, with MSBuild on the path from `microsoft/setup-msbuild`, and add `PackageCertificatePassword` because a production certificate usually has a password, unlike the passwordless test certificate in Microsoft's example:

```yaml
- name: Decode the signing certificate
  run: |
    $bytes = [Convert]::FromBase64String("${{ secrets.BASE64_ENCODED_PFX }}")
    [IO.File]::WriteAllBytes("signing.pfx", $bytes)

- name: Build the MSIX
  run: >
    msbuild MyApp.sln /restore /p:Configuration=Release /p:Platform=x64
    /p:UapAppxPackageBuildMode=SideloadOnly /p:AppxBundle=Never
    /p:PackageCertificateKeyFile=signing.pfx
    /p:PackageCertificatePassword="${{ secrets.PFX_PASSWORD }}"
    /p:AppxPackageDir=Packages\ /p:GenerateAppxPackageOnBuild=true

- name: Remove the certificate
  run: Remove-Item signing.pfx
```

For a Store submission, Microsoft's CI page builds every architecture in one invocation, with `Platform=x86` to select the configuration that runs packaging, `AppxBundle=Always`, `AppxBundlePlatforms="x86|x64"`, and `UapAppxPackageBuildMode=StoreUpload`. That produces an `.msixupload` file, and package signing can be turned off (`AppxPackageSigningEnabled=false`) because the Store signs it. The single-project MSIX page says the opposite, that single-project MSIX can't produce bundles and that separate packages can be combined with the MSIX Bundler action, so check the output of a bundle build. An unpackaged app builds with `msbuild /t:Publish` instead.

A few practices keep the pipeline trustworthy:

- **Keep keys out of the repository.** Store a `.pfx` as a pipeline secret and delete it after the build, or better, sign through Azure Artifact Signing or a cloud HSM so there is no key file at all.
- **Set the version from the build.** Derive the first three parts of the four-part version from a tag or build number, leaving the fourth at 0 for Store packages.
- **Prefer plain MSBuild in Azure Pipelines.** Microsoft notes that the `MsixPackaging@1` task uses outdated dependencies that can break modern builds.
- **Install the result on a clean machine.** A smoke test that installs the package on a fresh virtual machine and launches the app catches a missing runtime, a missing Visual C++ Redistributable for an unpackaged app, or a manifest error before users do.
{% endraw %}
