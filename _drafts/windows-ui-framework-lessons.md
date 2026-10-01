---
layout: post
title: "Why WPF Outlived Every Windows UI Framework Offered in Its Place"
description: "Silverlight, Windows 8's XAML, and UWP each paid for a platform bet by taking deployment and trust decisions away from the app's developer, and WPF outlived all three because it never did. WinUI 3 finally gave those decisions back, but it started from UWP's codebase, so WPF teams still lack the designer and controls their apps are built on."
tags: [architecture, dotnet, wpf, winui, desktop, legacy-modernization]
author: steven-stuart
sources:
  - title: "Windows developer FAQ (Microsoft Learn)"
    url: "https://learn.microsoft.com/en-us/windows/apps/get-started/windows-developer-faq"
  - title: "Windows Presentation Foundation (Wikipedia)"
    url: "https://en.wikipedia.org/wiki/Windows_Presentation_Foundation"
  - title: "InfoQ: Silverlight Is for the Client, HTML5 for the Web (2010)"
    url: "https://www.infoq.com/news/2010/11/Silverlight-HTML5"
  - title: "Silverlight 5 lifecycle (Microsoft Learn)"
    url: "https://learn.microsoft.com/en-us/lifecycle/products/silverlight-5"
  - title: "Windows 8 sideloading requirements (Microsoft TechNet archive)"
    url: "https://learn.microsoft.com/en-us/archive/blogs/scd-odtsp/windows-8-sideloading-requirements-from-technet"
  - title: "Raymond Chen: sideloading enabled by default from Windows 10 build 18956 (The Old New Thing, 2020)"
    url: "https://devblogs.microsoft.com/oldnewthing/20200428-00/?p=103709"
  - title: "Windows UI Library Preview released (Windows Developer Blog, 2018)"
    url: "https://blogs.windows.com/windowsdeveloper/2018/07/23/windows-ui-library-preview-released/"
  - title: "Windows Central: Joe Belfiore says Windows 10 Mobile features and hardware are no longer a focus (2017)"
    url: "https://www.windowscentral.com/microsoft-windows-10-mobile-features-and-hardware-are-not-focus-anymore"
  - title: "Support ending for Windows 10 Mobile in 2019 (Microsoft Learn)"
    url: "https://learn.microsoft.com/en-us/lifecycle/announcements/windows-10-mobile-end-of-support"
  - title: "InfoQ: With Project Reunion Microsoft is attempting to unify Win32 and UWP APIs (2020)"
    url: "https://www.infoq.com/news/2020/05/microsoft-project-reunion/"
  - title: "Windows App SDK 1.1 release notes (Microsoft Learn)"
    url: "https://learn.microsoft.com/en-us/windows/apps/windows-app-sdk/release-notes/windows-app-sdk-1-1"
  - title: "Migrate WPF app patterns to WinUI 3 (Microsoft Learn)"
    url: "https://learn.microsoft.com/en-us/windows/apps/windows-app-sdk/migrate-to-windows-app-sdk/wpf-patterns-winui3"
  - title: "What's supported when migrating from UWP to WinUI 3 (Microsoft Learn)"
    url: "https://learn.microsoft.com/en-us/windows/apps/windows-app-sdk/migrate-to-windows-app-sdk/what-is-supported"
  - title: "\"Ohh...WinUI3 is really dead!\" (microsoft-ui-xaml GitHub discussion #9417, 2024)"
    url: "https://github.com/microsoft/microsoft-ui-xaml/discussions/9417"
  - title: "The Register: Microsoft promises to make WinUI 'truly open source' (2025)"
    url: "https://www.theregister.com/2025/08/05/microsoft_winui_open_source/"
---

Since WPF shipped in 2006, Microsoft has pointed Windows developers at a new XAML framework four times. WPF is still here. Most of Visual Studio's interface is built with it, .NET 9 gave it a Windows 11 Fluent theme, and Microsoft's current Windows developer FAQ answers "Is WPF deprecated?" with a flat no.

> **AUTHOR** — the author's experience goes here: building on each of these frameworks in turn, and the WPF point-of-sale system in hundreds of stores. Did control over how and when stores received updates shape the framework choice?

The usual explanation for WPF's staying power is a run of bad luck for its successors. HTML5 ended Silverlight, Windows 8 flopped, and Windows Phone died. Those events happened, but they share a cause. Each of the three successors between WPF and WinUI 3 was built to carry a platform bet, and each paid for the bet by taking decisions away from the app's developer: which Windows versions could run the app, how it reached users, what it was allowed to touch, and when its UI layer got fixes. WPF left all of those decisions with the team that owned the app, so the teams that stayed on it weren't clinging to old technology. They were keeping control.

WinUI 3 is the first successor that hands that control back. It arrived from the wrong starting point, though, built from UWP's codebase rather than WPF's, and without the designer and controls that WPF applications are built on.

## What WPF Left in the Developer's Hands

WPF was a large technical break from Windows Forms. It replaced GDI drawing with a DirectX-based, vector, retained-mode renderer, and it introduced XAML, data binding, and templated controls. Its deployment, on the other hand, changed nothing. WPF shipped in November 2006 as part of .NET Framework 3.0, which, as Wikipedia's history of WPF records, was built into Windows Vista and offered as a download for Windows XP SP2 and Server 2003. A WPF app ran with full trust, installed through whatever the team already used (an MSI, ClickOnce, or a copied folder), and got fixes when the team shipped them.

That arrangement is easy to overlook because it's the default for desktop software. Which operating systems to support, how to install, what the app can reach on the machine, and when to update were all the app owner's calls. A line-of-business team could adopt WPF without asking its IT department to change anything about the fleet.

WPF's own history also sets a baseline that any honest version of this argument has to account for. WPF didn't displace Windows Forms either. WinForms still ships with .NET, and Microsoft's FAQ lists ongoing work on it, including async dialogs, dark mode, and designer improvements. Working desktop apps rarely rewrite their UI for any reason, so some of WPF's longevity is plain inertia. What inertia doesn't explain is why new projects kept starting on WPF for more than a decade after Microsoft started pointing elsewhere, or why Microsoft's FAQ still calls it a good choice for new apps whose requirements fit it.

## Three Successors That Took the Decisions Away

### Silverlight Bet on the Browser Plugin

Silverlight, first released in 2007, brought a subset of WPF's XAML model to a browser plugin on Windows and Mac. The bet was that rich applications would live in the browser, and the price was the plugin's sandbox and the plugin's reach. A Silverlight app ran where the plugin was installed and could do what the plugin allowed, with elevated trust added later as an opt-in for out-of-browser apps.

At the Professional Developers Conference in 2010, Microsoft's Bob Muglia told ZDNet's Mary Jo Foley that for cross-platform work "our strategy has shifted" to HTML5, as InfoQ reported at the time. He later apologized for the confusion, but the direction held. Microsoft's lifecycle page shows Silverlight 5 support ending in October 2021, and the apps built on it had to move.

### Windows 8 Bet on the Store and the Tablet

Windows 8 introduced a new XAML stack built into the operating system, aimed at touch-first apps sold through the Windows Store. Those apps ran only on Windows 8 and later, inside an AppContainer sandbox that limited what they could reach on the machine. Installing one outside the Store, which Microsoft called sideloading, required, per Microsoft's TechNet guidance, an Enterprise edition joined to a domain with the right group policy, or a sideloading product key.

For a line-of-business team, every one of those terms was a decision taken away. The app couldn't run on the Windows 7 machines many fleets still ran, couldn't install the way the team's other software installed, and couldn't touch the file shares and devices that business software touches.

### UWP Bet on One App for Every Device

The Universal Windows Platform arrived with Windows 10 in 2015 and kept the sandbox and the Store-first model. Its bet was convergence, one app across PCs, phones, Xbox, and HoloLens. Sideloading loosened over the following years, but Raymond Chen of Microsoft notes that it wasn't enabled by default until build 18956, which shipped as Windows 10 version 2004 in 2020, five years in.

UWP also kept the UI framework inside the operating system, and that decided when an app's controls got fixes. Microsoft's 2018 announcement of the Windows UI Library, which moved UWP's controls into NuGet packages, described the old model plainly: "In order to get new features or fixes, you had to wait for a new version of Windows," and then wait again for users to install it. The app's developer didn't control the release cadence of its own UI.

The convergence bet ended with the phone. In October 2017, Microsoft's Joe Belfiore said, as Windows Central reported, that new Windows 10 Mobile features and hardware were no longer a focus, adding that Microsoft had tried hard to attract app developers, even paying some, but the user base was too small. Microsoft's lifecycle announcement ended Windows 10 Mobile support in December 2019. UWP isn't formally deprecated, but Microsoft's FAQ now recommends WinUI 3 for new desktop apps.

| Framework | Year | The bet | What the developer gave up | How the bet ended |
| --- | --- | --- | --- | --- |
| Silverlight | 2007 | Rich apps live in the browser | Full trust; reach beyond the plugin | Strategy shifted to HTML5 in 2010; support ended 2021 |
| Windows 8 XAML | 2012 | Touch apps sold through the Store | Older Windows versions; own installer; full trust; UI fix cadence | Superseded by UWP three years later |
| UWP | 2015 | One app for every Windows device | Windows 7 and 8; own installer until 2020; full trust; UI fix cadence | Phone abandoned 2017; WinUI 3 recommended instead |

The failures look circumstantial one at a time, since nobody at Microsoft planned for HTML5 or the iPhone. But each framework was tied to its bet so tightly that the bet's failure became the framework's. WPF made no bet beyond the Windows desktop, and the Windows desktop outlived every bet made beyond it.

## WinUI 3 Fixed the Right Problem From the Wrong Starting Point

### It Gave the Decisions Back

Microsoft announced Project Reunion at Build 2020, and its goal, as InfoQ summarized it, reads as a direct answer to the table above. It would decouple the Windows UI stack from the operating system and ship it through NuGet to ordinary Win32 desktop apps. WinUI 3 reached version 1.0 in November 2021 as part of the Windows App SDK.

A WinUI 3 app runs as a full-trust desktop process unless it opts into isolation. It can install unpackaged, through the team's own MSI or setup program, and since Windows App SDK 1.1 in 2022 it can deploy self-contained, carrying its UI framework in its own folder. It runs on Windows 10 version 1809 and later, and the UI layer updates when the app does. Every decision the previous three frameworks took away is the developer's again.

### It Started From UWP, Not WPF

Microsoft's FAQ is explicit that WinUI 3 "started from the WinUI for UWP codebase," and it shows. For a UWP team, WinUI 3 is a close relative, with the same XAML dialect and controls, new namespaces, and a replaced app model. For a WPF team, it's a different framework that happens to use XAML.

Microsoft's guide to migrating WPF app patterns lists what WPF applications lean on that WinUI 3 handles differently. Style triggers and data triggers become attached behaviors, `MultiBinding` becomes converters or `x:Bind`, and `{DynamicResource}` becomes `{ThemeResource}`. There is no first-party `DataGrid`, the control many line-of-business screens are built around, and the guide points teams to community projects instead. The same guide says the Design tab of Visual Studio's XAML Designer doesn't support WinUI 3 projects, and Microsoft's own migration notes say WinUI 3 apps launch more slowly, use more memory, and install larger than equivalent UWP apps.

WinUI 3 solved the problem that made UWP unattractive, which was lost control. It didn't solve the problem that kept WPF teams where they were, which was that their applications were built on WPF's controls, triggers, and designer.

> **AUTHOR** — the author's experience goes here: the WinUI 3 rebuild of a UWP app, and which gaps it hit. Tell it in the first person. Don't cite or name the rebuild case study.

### Trust Was Already Spent

After three reversals, developers had learned to wait and see, and WinUI 3's early releases, with no designer and visible control gaps, confirmed the habit. In March 2024, a thread on the WinUI GitHub repository titled "Ohh...WinUI3 is really dead!" collected complaints about the missing designer, unanswered issues, and component vendors that participants said had stopped updating their WinUI 3 suites. In August 2025, Microsoft committed to making WinUI "truly open source" in phases, and one long-time adopter replied, as The Register reported, "I don't think Microsoft understands the damage they have caused to the evangelists and wider developer community."

That damage compounds the starting-point problem. A WPF team weighing a move has to believe both that the missing pieces will arrive and that the framework will outlast the next strategy shift, and it has three counterexamples on record.

## Frameworks Last When They Decide Less for You

The lesson generalizes beyond Microsoft. A UI framework can make decisions for the teams that adopt it, and every decision it makes is one a team can no longer make when its own situation changes. The frameworks that lasted on Windows made the fewest of them. The ones that didn't last made many, and they made them in service of a bet the adopting team had no stake in.

The pattern has limits. It explains why new WPF projects kept starting, not why every old one survived, since inertia covers much of that. It also doesn't say WinUI 3 will fail. With deployment and trust handed back and development moving into the open, WinUI 3's remaining gaps are about controls and tooling, which are problems a framework can fix in place without asking anyone to change how they ship. Whether it does is a question of investment, and the history above is why WPF teams want to see the investment before they move.

## A Check Before Your Next Desktop Framework Decision

For each framework you're weighing, including the one you're on, ask who decides each of these today, you or the framework's owner:

- **Which OS versions can run your app.** A framework tied to a new OS release makes your fleet's upgrade schedule its prerequisite.
- **How the app installs and updates.** Store-only or package-only distribution replaces your installer and your rollout control.
- **What the app can reach.** A sandbox decides whether your app can touch file shares, devices, and other processes.
- **When UI fixes reach users.** A UI layer that ships with the OS fixes bugs on the OS's schedule, not yours.
- **Whether your core controls and tools exist.** A missing grid or designer turns every screen of a port into a redesign.
- **What the framework is betting on besides your app.** If that bet fails, the framework's future goes with it.

Every answer that comes back "the framework's owner" is part of that owner's bet you're agreeing to share. WPF lasted because, for twenty years, the answer to all six was the team that owned the app.
