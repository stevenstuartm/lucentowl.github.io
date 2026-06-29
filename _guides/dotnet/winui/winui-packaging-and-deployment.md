---
title: "Packaging and Deployment"
layout: guide
category: "WinUI 3"
subcategory: "Platform Integration"
description: "Deploying WinUI 3 applications using MSIX packaging, unpackaged deployment, self-contained bundles, and distribution through the Microsoft Store or enterprise sideloading."
tags: [winui, winui-3, msix, deployment, packaging, desktop, devops, practical]
---

## What MSIX Provides

WinUI 3 applications are Win32 processes at heart, which means you have real choices about how to package and deliver them. The default packaging model is MSIX, a container format that brings structured installation, clean uninstallation, automatic updates, and package identity to Windows desktop applications.

MSIX solves several problems that traditional Win32 installers do not. Installation writes to a virtualized registry and file system, so uninstallation genuinely removes everything the package placed on the machine. Updates are differential, so only changed blocks are downloaded rather than the full package. Every installed MSIX package has a verified publisher identity, which Windows uses to enforce security policies and enables features like push notifications, background tasks registered through the app manifest, and access to certain WinRT APIs that require identity.

The `Package.appxmanifest` file is the control surface for MSIX. It declares the application's identity, publisher, version, capabilities such as microphone or location access, extensions that integrate with Windows shell features like file type associations and context menus, and the entry point executable. Visual Studio surfaces this file through a visual editor, though the underlying format is XML and can be edited directly.

Single-Project MSIX, available since Windows App SDK 1.0, removes the need for a separate Windows Application Packaging Project. In the older model, the solution contained a main application project and a distinct packaging project that referenced it; building and running required the packaging project as the startup project. With Single-Project MSIX, the packaging manifest lives directly inside the application project alongside the source code. This simplifies the solution structure, reduces the number of projects to manage, and makes the default F5 debug experience produce a properly packaged application automatically.

---

## Building MSIX Packages

Building an MSIX package in Visual Studio requires a code signing certificate. Windows will not install an unsigned MSIX package unless that policy is explicitly overridden, and it will not run one unless the package's publisher certificate is trusted on the target machine.

During development, the standard approach is to generate a self-signed test certificate from within Visual Studio. Right-clicking the packaging manifest and selecting the signing options will walk you through creating a `.pfx` file. Visual Studio can install this certificate into the local machine's trusted root store automatically, so development builds install and run without certificate warnings.

For release builds targeting end users, you need a certificate from a trusted certificate authority. Code signing certificates are available from providers like [DigiCert](https://www.digicert.com/code-signing/){:target="_blank" rel="noopener noreferrer"} and [Sectigo](https://sectigo.com/ssl-certificates-tls/code-signing){:target="_blank" rel="noopener noreferrer"}. The certificate's Subject must match the `Publisher` attribute declared in your `Package.appxmanifest` exactly. A mismatch between these two values is one of the most common causes of signing failures in build pipelines.

Signing an MSIX package is done through `signtool.exe`, which ships with the Windows SDK. In a typical project, MSBuild invokes signtool automatically during the packaging step when the signing properties are configured in the `.csproj` or through the Visual Studio signing UI.

```xml
<!-- In .csproj, configure signing for release builds -->
<PropertyGroup Condition="'$(Configuration)' == 'Release'">
  <PackageCertificateThumbprint>YOUR_CERTIFICATE_THUMBPRINT</PackageCertificateThumbprint>
  <PackageCertificateKeyFile>signing.pfx</PackageCertificateKeyFile>
</PropertyGroup>
```

The output of a successful MSIX build is a `.msix` or `.msixbundle` file. A bundle contains packages for multiple processor architectures (x64, x86, Arm64) in a single distributable artifact. Users receive only the package matching their device architecture, so the bundle size visible to end users is smaller than the combined total.

---

## Unpackaged Deployment

MSIX is the recommended path for most applications, but WinUI 3 also supports running without a package. This mode is called unpackaged deployment, and it is enabled by setting `WindowsPackageType` to `None` in the project file.

```xml
<PropertyGroup>
  <WindowsPackageType>None</WindowsPackageType>
</PropertyGroup>
```

With this setting, building the project produces a standard directory of executable and dependency files. You can run the application directly from that output directory without installing anything. This integrates naturally with existing enterprise deployment tools like SCCM or Intune that push executables and support custom installer scripts.

Unpackaged applications lose access to APIs that depend on package identity. Push notifications, background task registrations through the manifest, certain privacy-sensitive capability declarations, and the MSIX auto-update mechanism are all unavailable. Windows Runtime APIs that query package information, such as `Package.Current`, will throw if called from an unpackaged process.

The Windows App SDK handles many of these limitations gracefully. The SDK's bootstrapper library, which you reference through the `<WindowsAppSDKSelfContained>` and `<WindowsPackageType>` properties, initializes the SDK's runtime context even for unpackaged applications. The majority of WinUI 3 controls, layouts, and XAML features work identically in both modes.

Unpackaged deployment makes sense for enterprise scenarios where IT departments require traditional MSI-based deployment, for applications that ship as part of a larger suite with a shared installer, or for developer tools and utilities that users run directly from a folder without formal installation.

---

## Self-Contained Deployment

By default, a WinUI 3 application depends on the Windows App SDK runtime being installed separately on the target machine. This is the framework-dependent deployment model. The application's binaries are small because the shared runtime handles a large portion of the code, and runtime updates apply to all applications using that version simultaneously.

Self-contained deployment bundles the Windows App SDK runtime directly into the application's output. You opt into this by setting `WindowsAppSDKSelfContained` to `true`.

```xml
<PropertyGroup>
  <WindowsAppSDKSelfContained>true</WindowsAppSDKSelfContained>
</PropertyGroup>
```

With this property set, the build output includes all necessary Windows App SDK assemblies. The application carries its runtime with it and can run on a machine that has never had the Windows App SDK installed separately. This eliminates a deployment prerequisite but increases the installation size, typically by 30 to 50 MB.

`PublishSingleFile` can reduce the visible file count by packing most assemblies into a single executable, but it does not remove the need for native Windows App SDK binaries that cannot be merged. The effective output for a truly single-file WinUI 3 application remains a small set of files rather than a true single executable; the option is most useful when you want to simplify the file listing in the output directory for packaging scripts.

---

## Framework-Dependent vs. Self-Contained Trade-offs

The choice between framework-dependent and self-contained deployment comes down to three considerations: deployment size, update behavior, and installation prerequisites.

Framework-dependent applications are smaller to distribute. Shared runtimes are downloaded once per machine and reused by every application that targets the same version. When Microsoft ships a security patch to the Windows App SDK, all framework-dependent applications pick it up without a new release from you. The downside is that you cannot control exactly which runtime version end users have, and in rare cases a runtime update can introduce behavioral changes.

Self-contained applications are larger but predictable. You ship a known runtime version, and that version does not change unless you explicitly update and reship the application. This is appealing in regulated or enterprise environments where you need complete control over what runs on a machine and where unexpected runtime updates could disrupt a validated software stack.

For consumer applications distributed through the Microsoft Store, framework-dependent deployment is the conventional choice. The Store manages runtime distribution, and users benefit from shared runtimes across all their installed applications. For enterprise line-of-business applications distributed through an MDM platform, self-contained deployment often simplifies the IT checklist by removing the Windows App SDK prerequisite from the deployment script.

---

## Microsoft Store Distribution

Distributing through the Microsoft Store requires packaging your application as MSIX and submitting it through [Partner Center](https://partner.microsoft.com/en-us/dashboard){:target="_blank" rel="noopener noreferrer"}. The Store handles signing with Microsoft's certificate, automatic updates, and billing if your application is paid. You do not need your own code signing certificate for Store distribution because Microsoft re-signs packages during ingestion.

The submission process involves uploading the `.msixbundle`, providing Store listing content such as descriptions, screenshots, and age ratings, configuring pricing and availability by market, and passing the Store certification process. Certification performs automated and manual checks against Store policies, including privacy requirements, content standards, and technical functionality. Applications that crash during the Store's test run, fail to launch without unexpected permissions, or contain prohibited content will be rejected.

Store-distributed applications receive automatic updates through the Store client. Users can configure when updates install, but the mechanism is managed by Windows rather than by your application code. If you need in-app update notifications or the ability to prompt users about a new release, you can use the Store's `StoreContext` API to check for updates and display messaging, though the actual installation still goes through the Store mechanism.

One practical consideration for Store packaging is that the `Publisher` value in your manifest must match your Partner Center account's publisher identity exactly. Setting this up correctly the first time avoids rework during the certification process.

---

## Enterprise Sideloading

For organizations that want to distribute WinUI 3 applications outside the Store, MSIX supports sideloading through direct installation of the package file. The target machine must either have developer mode enabled or have the sideloading policy configured through Group Policy or MDM. Modern versions of Windows 10 and Windows 11 permit sideloading by default without requiring developer mode, but older configurations may need the policy explicitly set.

The AppInstaller format extends sideloading with automatic update checking. An `.appinstaller` file is an XML document that points to the current MSIX package at a network or web location and defines an update check schedule. When the user opens the AppInstaller file, Windows installs the package and registers a background check that polls the specified location for newer versions.

```xml
<?xml version="1.0" encoding="utf-8"?>
<AppInstaller
  xmlns="http://schemas.microsoft.com/appx/appinstaller/2017/2"
  Version="1.0.0.0"
  Uri="https://your-server.com/app/MyApp.appinstaller">
  <MainBundle
    Name="MyApp"
    Version="1.0.0.0"
    Publisher="CN=Your Publisher"
    Uri="https://your-server.com/app/MyApp_1.0.0.0.msixbundle"/>
  <UpdateSettings>
    <OnLaunch HoursBetweenUpdateChecks="24"/>
  </UpdateSettings>
</AppInstaller>
```

Hosting the `.appinstaller` and `.msixbundle` files on an HTTPS server or a network share gives you a distribution mechanism with automatic updates that does not require the Store. When you publish a new version, you update the files at those URIs and bump the version number. Users running the previous version receive the update silently on the next scheduled check or on the next application launch, depending on the `OnLaunch` setting.

The signing certificate used for enterprise sideloading must be trusted on the target machines. In an Active Directory environment, you can deploy the certificate to the trusted root store via Group Policy, which means users never see a certificate warning and installation proceeds without manual trust prompts.

---

## CI/CD Considerations

Automating MSIX builds in a pipeline requires careful handling of signing certificates and version management. Storing a `.pfx` file directly in source control is a security risk; the standard practice is to store it as a base64-encoded secret in your pipeline environment and decode it to disk at build time.

A GitHub Actions workflow that builds and signs an MSIX package follows this general shape:

```yaml
- name: Decode signing certificate
  run: |
    echo "${{ secrets.SIGNING_CERTIFICATE_BASE64 }}" | base64 --decode > signing.pfx

- name: Build MSIX
  run: |
    dotnet publish -c Release -p:RuntimeIdentifierOverride=win-x64 \
      -p:PackageCertificateKeyFile=signing.pfx \
      -p:PackageCertificatePassword="${{ secrets.CERT_PASSWORD }}"
```

Version numbers in MSIX packages must follow a four-part format such as `1.2.3.0`. A common approach is to derive the version from the build number or a tag, then pass it to MSBuild through the `Version` property. Keeping the version in the manifest synchronized with the assembly version prevents confusion when debugging installed applications.

For Azure DevOps, the [Windows Application Packaging task](https://learn.microsoft.com/en-us/azure/devops/pipelines/tasks/reference/store-publish-v0){:target="_blank" rel="noopener noreferrer"} provides structured support for building, signing, and publishing MSIX packages. The task handles the MSBuild arguments and signtool invocation, and it integrates with Azure Key Vault for certificate retrieval. Storing the signing certificate in Key Vault rather than as a pipeline secret provides better access control, rotation support, and an audit trail.

A robust pipeline should include a smoke-test step that installs the produced MSIX on a clean virtual machine and verifies that the application launches without errors. WinUI 3 applications can fail to start for reasons like missing visual C++ redistributables, incorrect manifest declarations, or side-by-side assembly conflicts that only appear in a properly isolated environment. Running installation validation in the pipeline catches these problems before they reach users.
