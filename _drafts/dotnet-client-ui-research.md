# Research: .NET's Client UI Story (2026-10-05)

Research notes, not a draft. Tests the author's held view: the .NET runtime keeps getting better (Native AOT, performance) while Microsoft's client UI strategy churns and pushes app developers off .NET. Four research passes; their full notes, with a URL, date, and confidence tag (verified / reported / inference) on every claim, are appended below the synthesis.

## Verdict on the Incentive Hypothesis

**Partly supported, and the evidence points to a sharper version.**

The original hypothesis: server .NET is well funded because it sells Azure, while client UI frameworks churn because they serve shifting internal bets (Windows division vs Developer Division).

What holds:

- **The runtime and the client stack are disconnected.** WPF and WinForms, the most-used .NET UI stacks, still can't trim or use Native AOT; their tracking issues (dotnet/wpf#3811 from 2020, dotnet/winforms#4649 from 2021) sit at milestone "Future". The runtime's best work doesn't reach them.
- **Microsoft uses .NET for the backends of its apps and something else for the screens.** Microsoft's own .NET showcase lists Teams and Copilot for their .NET backends. Their clients are WebView2 and React (Teams, new Outlook), Electron (VS Code), or React Native (parts of Office, the Xbox PC app, a Windows Settings page). MAUI never reached a flagship Microsoft app.
- **The Windows/.NET split is real and on record.** Sinofsky (Windows president) writes that Windows "effectively banned .NET from Longhorn" and that "no applications written with .NET would ship with Windows Vista." He says DevDiv built .NET "primarily to compete with Java on the server," with client .NET sitting on top of Win32 "with little coordination or integration."

What doesn't hold:

- **"Sells Azure" has no source.** .NET's server focus predates Azure (Sinofsky's "compete with Java"). Drop the Azure claim or present it as inference.
- **Ownership moved with the bet.** A June 2011 reorg (Somasegar memo, reported via Mary Jo Foley) moved the XAML team from DevDiv into Windows and Silverlight into Windows Phone. Miguel de Icaza said the May 2025 layoffs cut senior .NET Android and MAUI engineers (no comparable WinUI cuts found).
- **The split isn't only Windows vs DevDiv.** Silverlight was ended by Bob Muglia of Server and Tools, not the Windows team. WinRT was built jointly, and since 2018 the two orgs have cooperated (open-sourced WPF/WinForms, C#/WinRT, the WPF Fluent theme in .NET 9, a joint roadmap in 2024).
- **Some Microsoft clients are .NET.** Visual Studio (WPF), PowerToys (.NET on WinUI 3), and the Microsoft Store (C#/.NET, reportedly moving to .NET 9 with AOT). Much of Windows' own XAML (Terminal, Settings, Notepad) is C++, though.
- **2026 cuts against "churn."** WinUI's open-sourcing finished in August 2026, Build 2026 reportedly dropped the "3" with "no plans to replace" it, and Windows is rebuilding shell pieces on WinUI.

**The sharper version:** nobody at Microsoft is paid to make .NET client apps succeed. Each org that touches client UI has a different mission:

| Org | Mission | What it does for .NET client apps |
| --- | --- | --- |
| Windows + Devices (Davuluri) | A native, faster Windows | Recommits to WinUI, much of the shell work in C++ |
| Developer Division, now in CoreAI (Parikh, Jan 2025) | "Copilot & AI stack" | Owns MAUI, WPF, WinForms; the memo never mentions .NET |
| Product teams (Office, Teams, Outlook, Xbox) | Ship everywhere, hire easily | Choose web and React Native for the JavaScript hiring pool and web code sharing |

The work of making .NET desktop apps succeed has moved outside Microsoft: Avalonia (a $3M Devolutions sponsorship, a MAUI backend of its own), Uno (a formal collaboration with the .NET team, co-maintaining SkiaSharp), and control vendors. Developers didn't leave .NET for app work. They stopped relying on Microsoft for the UI layer of it.

This frame keeps the author's frustration while making it defensible: "orphaned," not "hated."

## Most Post-Worthy Findings

1. **The runtime's best feature can't reach the most-used UI frameworks.** Native AOT works for WinUI (since Windows App SDK 1.6, 2024), MAUI on Apple platforms, and Avalonia, but not WPF or WinForms, whose AOT issues have sat at "Future" for five-plus years.
2. **Microsoft's own showcase puts .NET behind its apps, not in them.** Teams and Copilot appear for .NET backends; MAUI's Microsoft examples are the Azure mobile app, the Store Commerce point-of-sale app, and Seeing AI.
3. **The Copilot app went web → native WinUI → web in about a year**, and Dev Home (.NET, WinUI 3) lived from May 2023 to May 2025. Churn in Microsoft's own apps, not only its frameworks. (The return to web is press-reported.)
4. **A Microsoft engineer explained choosing React Native by hiring:** the JavaScript pool is the "biggest pool to fish from" (DevClass, 2024, reported).
5. **Even the WinUI recommitment came with a new experimental framework,** "Microsoft UI Reactor," a C#-first declarative UI over WinUI with no XAML (reported, June 2026). "No intention of building new frameworks" and a new framework in the same season.
6. **Developers are paying to stay on .NET.** Avalonia ran on €395k revenue and 13 staff in 2023, then received a $3M sponsorship from Devolutions and grew to about 20. Uno raised a seed round with Scott Hanselman investing personally.
7. **Microsoft's own docs send designer users to WPF.** WinUI has no visual designer, Learn's framework guidance points anyone who needs one to WPF, and Microsoft reportedly said a MAUI designer "is not part of our direction" (DevClass, Sept 2025, original quote not found). Windows Latest (2026-09-16) reports Microsoft admitting "a large backlog of feature gaps" pushed its apps toward web technology.
8. **Repo activity diverges.** Over the last 12 months (GitHub API, 2026-10-05), MAUI opened 3,108 issues and closed 2,999 (backlog flat) and merged about 2,750 PRs. WinUI opened 645 and closed 425 (backlog growing) and merged 232, about a twelfth of MAUI's.
9. **A third party ships AOT-compiled WPF; Microsoft can't.** Avalonia XPF runs existing WPF apps on macOS and Linux and supports Native AOT, "unlike WPF," because it avoids built-in COM (XPF docs, verified).
10. **.NET developers haven't left the desktop.** JetBrains' State of .NET 2025 (3,800+ respondents): 41% work on desktop projects, WinForms 23%, WPF 18%. The two most-used client frameworks are the two the runtime's AOT can't reach.
11. **An insider calls it a civil war.** Jeffrey Snover (2026-03-13 blog) describes a "thirteen-year institutional civil war between the Windows team and the .NET team" and calls Project Reunion "an organizational workaround." Retrospective, not first-hand from the room, and he names politics as one cause of three.
12. **The most-used .NET UI stacks are invisible in the best-known survey.** Stack Overflow never lists WPF, WinForms, or Avalonia, and dropped the "other frameworks" question entirely in 2025. MAUI was 3.1% in 2024, against Flutter's 9.4%.

## Myths and Overclaims to Avoid

- **"Blazor failed."** About 7% of all developers (Stack Overflow 2025) and 25% of .NET developers (JetBrains); Microsoft builds the Aspire dashboard on it. The fair criticism is the complexity of .NET 8's render modes.
- **"The Start menu is React."** React Native for Windows renders only the Recommended section and part of All apps, as native controls, not a web view.
- **"Rider is built on Avalonia."** dotMemory and dotTrace on macOS and Linux are; Rider ships Avalonia tooling only.
- **"Longhorn failed because of .NET."** The WSJ's on-record account blames scope and process and doesn't mention .NET; Dave Plummer lists managed code as one cause of several.
- **"MAUI is 3.1% in 2025."** That's the 2024 figure; the 2025 survey dropped the question.

## Prior Art by the Author

Search surfaced the author's own dev.to post, "Blazor and Microsoft's UI framework track record" (dev.to/stevenstuartm). A new post should build on it, not repeat it, and search echoes of its claims aren't independent evidence.

## Open Questions

- **Build 2026 quotes are press-only.** "No plans to replace," "no intention of building new frameworks," and the Start menu rewrite need the session video or a Microsoft post before a post quotes them.
- **Microsoft UI Reactor** needs a primary source (repo or Microsoft blog).
- **Where the .NET team sits today.** It moved into CoreAI with DevDiv by inheritance; no source names its placement.
- **JetBrains survey figures** for UI frameworks need the raw data download.
- **MAUI issue backlog trend.** About 3,900 open issues today is a snapshot, not a trend.
- **Sinofsky quotes** came through a summarizing fetch tool; recheck exact wording on the pages before quoting.
- **Microsoft Store and Phone Link UI stacks** are unverified.

---

# Appendix: Research Notes

## Q1: What UI technology does Microsoft use for its own first-party apps?

Research date: 2026-10-05. Confidence tags: **verified** = Microsoft primary source (blog, docs, GitHub, named engineer); **reported** = press or secondhand; **inference** = mine; **memory** = from prior knowledge, not re-checked this session.

### Bottom line

- Microsoft's flagship productivity clients run on web technology. New Teams and new Outlook are web apps inside WebView2. Office modernizes through React Native for Windows (40+ experiences). VS Code is Electron.
- No flagship Microsoft desktop app uses .NET MAUI. The only first-party MAUI apps found are mobile admin and line-of-business apps: the Azure mobile app, the Microsoft 365 Admin mobile app, and the Dynamics 365 Store Commerce mobile POS (a MAUI shell that renders a web app).
- Windows' own surfaces mix C++ XAML (Settings, Terminal, File Explorer pieces), React Native (parts of the Start menu, the Xbox PC app), and web (Copilot, Clipchamp, the Notification Center agenda).
- Counterevidence: Microsoft does dogfood its .NET/XAML stacks. Visual Studio is WPF, PowerToys is C#/WinUI 3 (migrating its WPF modules to WinUI 3), the Photos app moved to Windows App SDK, and the Microsoft Store is C#/.NET moving to .NET 9 Native AOT. At Build 2026 Microsoft committed to WinUI and announced a WinUI rewrite of the React Native parts of the Start menu.
- Churn is visible in Microsoft's own apps. The Copilot app went PWA → WebView wrapper → native XAML/WinUI → a hybrid bundling a full Edge, all between 2024 and 2026. Dev Home (WinUI 3, C#) launched in 2023 and was retired in 2025.

### App-by-app

| App | UI technology | Confidence | Source |
| --- | --- | --- | --- |
| New Teams (Teams 2.0) | WebView2 (Edge), 100% React; replaced Electron + Angular | verified (docs) / reported (tweet) | See Teams |
| New Outlook for Windows | Outlook on the web inside WebView2 with a thin "Native Windows Integration Component" | verified | See Outlook |
| Office / Microsoft 365 desktop (Word, Excel, PowerPoint) | Legacy C++ Win32 core; 40+ new experiences in React Native for Windows, embedded as content islands | verified | See Office |
| VS Code | Electron | memory (widely known) | — |
| Visual Studio | WPF since VS 2010 (shell chrome, text editor) | verified | See Visual Studio |
| SSMS 21 | Visual Studio shell (WPF) | reported | devclass 2025-02-11 |
| Azure Data Studio | Electron (VS Code fork); retired 2026-02-28 in favor of VS Code extension | reported | devclass 2025-02-11 |
| Windows 11 Start menu | Parts (All apps list, Recommended) in React Native for Windows; WinUI rewrite announced 2026 | reported | See Start menu |
| Notification Center agenda view | WebView2 | reported | Windows Latest 2026-07-27 |
| File Explorer | Win32 core; Home, Gallery, and header rebuilt in WinUI 3 / Windows App SDK (2023) | reported | See File Explorer |
| Settings | C++ UWP XAML / WinUI 2 | memory | — |
| Windows Terminal | C++/WinRT, UWP XAML + WinUI 2 hosted in a Win32 window via XAML Islands | verified | See Terminal |
| PowerToys | C# / .NET 8 + WinUI 3 (plus C++); WPF modules being migrated to WinUI 3 | verified (repo) / reported | See PowerToys |
| Dev Home | WinUI 3, C# (open source); deprecated, gone May 2025 | reported | See Dev Home |
| Microsoft Store (Windows) | C#/.NET UWP; moving to .NET 9 + Native AOT, incremental WinUI 3 | reported (engineer quoted) | See Store |
| Microsoft Store (Xbox) | React Native for Windows | verified | RNW showcase |
| Xbox app on Windows | React Native for Windows | verified | RNW showcase |
| Copilot app | PWA → WebView "native" wrapper (Dec 2024) → XAML/WinUI (Mar 2025) → hybrid bundling full Edge + WebView2 (Apr 2026) | reported | See Copilot |
| Phone Link | UWP | reported (Wikipedia) | Wikipedia "Phone Link" |
| Clipchamp | Web app (PWA / WebView2) | reported | See Clipchamp |
| Photos | Moved from UWP to Windows App SDK (WinUI 3) in 2024; uses WebView2 for some parts | verified | See Photos |
| Notepad, Paint | Win32 apps with WinUI/Fluent controls layered on (2021 redesign) | reported | See Notepad/Paint |
| Power Apps | React Native for Windows | verified | RNW showcase |
| Azure mobile app | .NET MAUI (migrated from Xamarin) | verified (listed on .NET showcase) | See MAUI |
| Microsoft 365 Admin mobile app | .NET MAUI (migrated from Xamarin.Forms) | verified (official MS podcast) | See MAUI |
| Dynamics 365 Store Commerce mobile | .NET MAUI shell (with Blazor WebView package) that renders Store Commerce for web | verified | See MAUI |
| Outlook / Teams mobile | React Native (in part) | reported | devclass 2026-01-20 |

### Evidence by product

#### Teams
- "One of the most significant architectural changes in the new Teams is the move from Electron to Edge WebView2." New Teams uses the Evergreen WebView2 runtime, which it shares with other apps such as Outlook. **verified** (Microsoft Learn, Teams client system requirements, https://learn.microsoft.com/en-us/microsoftteams/teams-client-system-requirements, accessed 2026-10). Also the Microsoft Tech Community post "Microsoft Teams: Advantages of the new architecture", https://techcommunity.microsoft.com/t5/microsoft-teams-blog/microsoft-teams-advantages-of-the-new-architecture/ba-p/3775704 (March 2023). The body did not load, so the claim rests on search snippets.
- Rish Tandon (CVP, Teams) in a June 2021 Twitter thread: Teams moved from Electron to WebView2, "Angular is gone," and it is "100% on ReactJS." **reported** (first-hand tweet, relayed by Tony Redmond, "Teams 2.0 Moves Away from Electron to Embrace Edge WebView2", office365itpros.com, 2021-06-25, https://office365itpros.com/2021/06/25/teams-2-webview2-replaces-electron/).
- On Microsoft's own .NET customer showcase, the Teams entry covers *backend middle-tier services* moving to .NET Core, not the client. **verified** (https://dotnet.microsoft.com/en-us/platform/customers/maui). **inference:** .NET powers Teams' servers and web tech powers its client, which fits the hypothesis (runtime funded for the cloud, client UI elsewhere).

#### Outlook
- "The new Outlook for Windows, built upon modern service architecture, is inspired by the Outlook web experience. It operates within a streamlined Native Windows Integration Component and utilizes WebView2." The doc also says: "almost none of the feature implementations are in this Windows integration component. It serves as a thin application only providing access to local machine resources." **verified** (Microsoft Learn, "Overview of the new Outlook for Windows", ms.date 2026-09-11, https://learn.microsoft.com/en-us/microsoft-365-apps/outlook/overview-new-outlook-windows).
- Classic Outlook stays C++ Win32. **memory**

#### Office / Microsoft 365
- "Over 40 Office experiences" use React Native for Windows, among them Privacy Dialog, Accessibility Assistant, and a new Copilot experience between the Ribbon and the canvas. Reasons given: reuse of web React skills, cross-platform sharing, and Content Islands for incremental modernization of a legacy app. **verified** (Chiara Mooney, Senior SWE, "Office's modernization...", Microsoft React Native devblog, 2025-05-09, https://devblogs.microsoft.com/react-native/2025-05-09-office-modernize).
- The RNW showcase lists 1st-party users: Xbox app on Windows, Microsoft Store on Xbox, Microsoft Office (commenting, privacy dialog, unity canvas), Power Apps, and the RN Gallery. **verified** (https://microsoft.github.io/react-native-windows/resources-showcase, accessed 2026-10).
- RNW 0.81 coverage: a developer asked "Why didn't the Office team use Maui for cross platform?" and got no official answer. The article suggests "long-standing internal differences between the developer division, and the Windows and Office teams." It also notes the new RNW architecture dropped C# native modules (C++ only). **reported** (DevClass, 2026-01-20, https://www.devclass.com/development/2026/01/20/microsoft-updates-react-native-for-windows-developers-ask-why-not-use-maui/4079595). Strong support for the "internal bets" framing, though the DevDiv-vs-Windows/Office explanation is the journalist's speculation.

#### Visual Studio (counterevidence)
- VS 2010 moved the shell to WPF "to prove that an application the size and scope of Visual Studio could successfully be built using WPF". The text editor and all IDE chrome (frames, menus, toolbars, status bar) are WPF. **verified** ("WPF in Visual Studio 2010 – Part 1", Visual Studio Blog, 2010-02-16, https://devblogs.microsoft.com/visualstudio/wpf-in-visual-studio-2010-part-1-introduction/).
- VS 2026 ships a Fluent UI visual refresh (themes, icons, a new settings UI). That it still runs on WPF is **inference/memory**; no source found stating a framework change. (The Register, 2025-09-10, https://theregister.com/2025/09/10/visual_studio_2026_previewed_deeper)
- SSMS 21 runs on the Visual Studio shell. Azure Data Studio (Electron) was retired 2026-02-28 in favor of the MSSQL extension for VS Code. **reported** (DevClass, 2025-02-11, https://devclass.com/2025/02/11/microsoft-drops-azure-data-studio-in-favour-of-visual-studio-code-extension-despite-missing-features/). **inference:** Microsoft's data tools converge on VS Code (Electron) for cross-platform work and keep a WPF/VS-shell tool for Windows-only admin.

#### Windows 11 Start menu and shell
- The All apps list and Recommended feed in the Start menu are React Native. Microsoft confirmed this at Chain React 2023. **reported** (Windows Latest, 2026-07-27, https://windowslatest.com/2026/07/27/microsoft-admits-windows-11-native-apps-hog-ram-promises-a-winui-performance-boost-before-start-menu-rewrite; Winaero, https://winaero.com/windows-11-start-menu-revealed-as-resource-heavy-react-native-app-sparks-performance-concerns). The Chain React talk itself was not retrieved.
- Build 2026 (June 2026): Microsoft is rewriting the Start menu in WinUI. It dropped the "3" from WinUI to signal no successor framework. Chris Anderson (VP, Windows UI and AI) said Microsoft "has no plans to replace it with another framework." Memory-use fixes come first, and WinUI moves to the system compositor. Per the July report, the WinUI Start menu is delayed until WinUI's RAM use improves. **reported** (Pureinfotech, 2026-06-04, https://pureinfotech.com/microsoft-native-windows-apps-strategy/; OpenSourceForU, 2026-06-05, https://www.opensourceforu.com/2026/06/winui-goes-more-open-source-as-microsoft-rebuilds-windows-11/; Windows Latest 2026-07-27). I found no blogs.windows.com post; all coverage relays Build sessions.
- Build 2026 also: WinForms and WPF "remain fully supported with planned enhancements through .NET 11," with better interop to WinUI. **reported** (MESCIUS blog, https://developer.mescius.com/blogs/microsoft-recommitted-winui-what-build-2026-means-for-windows-developers, June 2026).
- Microsoft.UI.Reactor: an experimental, MIT-licensed, C#-first declarative UI framework ("No XAML. No data binding. No view models.") with React-style hooks. It renders real WinUI 3 controls. **verified** (https://github.com/microsoft/microsoft-ui-reactor, docs https://microsoft.github.io/microsoft-ui-reactor/latest/). **inference:** this is another new UI programming model, even as Microsoft says "no new frameworks." It counts for the churn thesis, though it sits on WinUI rather than replacing it.
- Notification Center agenda view: a WebView2 component. **reported** (Windows Latest 2026-07-27).

#### File Explorer
- Since 2023, File Explorer's Home page, Gallery, and header have been rebuilt with WinUI 3 / Windows App SDK on top of the Win32 core. **reported** (Pureinfotech, https://pureinfotech.com/enable-new-file-explorer-wasdk-xaml-windows-11/; Windows Latest, 2023-04-09, https://windowslatest.com/2023/04/09/hands-on-windows-11s-new-file-explorer-biggest-update-since-windows-8). Microsoft's Insider blog posts of the time say "WinUI" / "Windows App SDK". **memory**

#### Settings
- C++ UWP XAML with WinUI 2 controls. **memory**, not verified this session.

#### Windows Terminal (counterevidence: XAML, but C++, not .NET)
- A thin Win32 window hosts XAML Islands. "The bulk of the application ... is built as a UWP XAML Application that uses WinUI 2," written in C++/WinRT. **verified** ("Building Windows Terminal with WinUI", Windows Command Line blog, 2020-09-08, https://devblogs.microsoft.com/commandline/building-windows-terminal-with-winui/).

#### PowerToys (counterevidence: .NET + WinUI 3)
- The dev docs require the WinUI application development, .NET desktop development, and C++ workloads, plus the .NET 8 SDK. **verified** (https://github.com/microsoft/PowerToys/blob/main/doc/devdocs/readme.md).
- The repo ships a "wpf-to-winui3-migration" guide, and Color Picker moved from WPF to WinUI 3. **reported** (release notes via newreleases.io, https://newreleases.io/project/github/microsoft/PowerToys/release/v0.101.2522.0; tessl registry mirror, https://tessl.io/registry/skills/github/microsoft/PowerToys/wpf-to-winui3-migration). Command Palette, the successor to PowerToys Run, is WinUI 3. **reported/memory**

#### Dev Home (counterevidence, then churn)
- Open-source WinUI 3 / C# app, launched May 2023. The GitHub repo announced: "Dev Home will be going away in May 2025." **reported** (Thurrott, Jan 2025, https://thurrott.com/windows/316403/microsoft-is-discontinuing-its-dev-home-app-for-windows-11-and-windows-10; Wikipedia, https://en.wikipedia.org/wiki/Microsoft_Dev_Home). That it was WinUI 3/C# is **memory** (repo microsoft/devhome).

#### Microsoft Store (counterevidence: .NET)
- Sergio Pedri (Microsoft SWE) says the Store is migrating to .NET 9 and Native AOT, with incremental WinUI 3 adoption to follow. Microsoft at the same time announced UWP support for .NET 9. **reported** for the Store detail (Windows Latest, 2024-09-17, https://windowslatest.com/2024/09/17/microsoft-store-could-soon-run-faster-on-windows-11-gets-library-and-downloads-section; PCWorld, https://www.pcworld.com/article/2462118/microsoft-store-getting-a-much-needed-speed-boost-in-the-near-future.html). **verified** for UWP on .NET 9 (#ifdef Windows blog, 2024-09-11, https://devblogs.microsoft.com/ifdef-windows/?p=769). The Store on Xbox is React Native (**verified**, RNW showcase).

#### Copilot app (strongest churn example)
- In 2024 the app was a PWA. December 2024 brought a "native" app that still loaded copilot.microsoft.com in a WebView. **reported** (Windows Latest, 2024-12-11, https://windowslatest.com/2024/12/11/microsoft-says-new-copilot-windows-11-app-is-native-but-no-its-a-webview-uses-1gb-ram).
- In March 2025 a XAML/WinUI native version (v1.25023.106.0) reached Insiders. It used about 50–100 MB of RAM. **reported** (Winaero, https://winaero.com/windows-copilot-is-now-a-native-winui3-app, citing the Windows Insider blog of 2025-03-03; Windows Latest, 2025-03-04).
- April 2026: "This latest version replaces the native app, which itself replaced the WebView version, which replaced the PWA." The new app bundles a full Edge (~850 MB) plus WebView2 and uses 500 MB–1 GB of RAM. **reported** (Windows Latest, 2026-04-05, https://windowslatest.com/2026/04/05/new-copilot-for-windows-11-includes-a-full-microsoft-edge-package-uses-more-ram). Microsoft made no official statement.

#### Photos (counterevidence)
- "This change moves Photos to the latest Windows app development platform": UWP to Windows App SDK. **verified** (Windows Insider blog, 2024-04-02, updated 2024-05-06, https://blogs.windows.com/windows-insider/?p=176979). Windows Latest reported that the new Photos leans more on web tech (WebView2) and opens slowly. **reported** (2024-06-05, https://windowslatest.com/2024/06/05/windows-11s-photos-app-now-uses-more-web-tech-but-opens-slowly). That Photos is C#/.NET is **memory**, not verified.

#### Notepad / Paint
- The 2021 redesigns layered WinUI/Fluent controls onto the existing Win32 apps. **reported** (XDA, https://www.xda-developers.com/windows-11-notepad-paint-apps-new-ui/; Windows Latest, 2021-12-01 and 2021-12-08). Language is C++, not .NET. **memory**

#### Phone Link
- A UWP app. **reported** (Wikipedia, https://en.wikipedia.org/wiki/Phone_Link). Framework details beyond that were not found.

#### Clipchamp
- A web-first app, shipped in the Store as a PWA and dependent on WebView2/Edge. **reported** (Clipchamp blog, https://clipchamp.com/de/blog/clipchamp-web-app/; wps.com troubleshooting page). Low-quality sourcing; the claim is consistent with **memory**.

### Does any notable Microsoft product use .NET MAUI?

Yes, but only on mobile, mostly admin and line-of-business apps, and none of them a flagship desktop app.

1. **Azure mobile app.** Listed as a Microsoft first-party app on the .NET customer showcase's MAUI page. Press (AVASOFT) says it moved from Xamarin to MAUI. **verified** that Microsoft lists it there (https://dotnet.microsoft.com/en-us/platform/customers/maui). Migration details are **reported** (https://www.avasoft.com/why-microsoft-chose-net-maui-for-the-azure-mobile-app-and-why-it-makes-sense-for-you-too/; the page would not load, so the claim rests on a search snippet).
2. **Microsoft 365 Admin mobile app.** Migrated from Xamarin.Forms to .NET MAUI. **verified** (official .NET MAUI Podcast ep. 121, "M365 Admin App: A Customer .NET MAUI Migration Story", 2023-12-15, hosts Microsoft employees; listed at https://xamarinpodcast.fireside.fm).
3. **Dynamics 365 Store Commerce for Android/iOS (mobile POS).** Listed on the MAUI showcase. The sample csproj has `<UseMaui>true</UseMaui>`, targets `net8.0-android;net8.0-ios`, and references `Microsoft.Maui.Controls` and `Microsoft.AspNetCore.Components.WebView.Maui`. Microsoft's own docs call these "shell applications that render Store Commerce for web directly from the Commerce Scale Unit." **verified** (https://github.com/microsoft/Dynamics365Commerce.InStore/blob/8cc06eb869a8bcca238fa0e2a92d5f64ecda8e41/src/PackagingSamples/StoreCommerceMobile/StoreCommerce.MobileApp/Contoso.StoreCommerce.MobileApp.csproj; https://learn.microsoft.com/dynamics365/commerce/dev-itpro/store-commerce-mobile, ms.date 2026-02-20). **inference:** even this MAUI app is a native shell around a web UI.
4. I found no evidence of MAUI in Teams, Outlook, Office, Windows inbox apps, Copilot, Xbox, or any Microsoft desktop app. **inference** from absence: the showcase's first-party list would likely include such an app if it existed, and it doesn't.

### Assessment for the hypothesis

**For:**
- The flagship clients (Teams, Outlook, Copilot, Clipchamp, VS Code) are web-based.
- Office's modernization bet is React Native, not a .NET UI stack, and the new RNW architecture dropped C#.
- The Start menu and the Xbox app use React Native.
- The .NET showcase's first-party list is mostly backend (Teams middle tier, Graph, Cosmos DB, Exchange/Substrate, AAD gateway, Xbox services). That pattern supports "the runtime is funded because it runs Azure and M365 services" (**inference**).
- MAUI's first-party footprint is small mobile admin/LOB apps.
- Microsoft's own apps churn visibly: Copilot had four architectures in about two years, and Dev Home lived two years.

**Against:**
- Microsoft does ship big .NET/XAML apps: Visual Studio and SSMS (WPF), PowerToys (WinUI 3), the Store (.NET UWP → .NET 9 AOT), Photos (Windows App SDK), and Dev Home while it lived.
- Build 2026 made a public, explicit commitment to WinUI (the dropped "3", "no plans to replace it") and announced moving the Start menu *off* React Native onto WinUI. That cuts against "UI frameworks churn forever."
- WPF and WinForms remain supported with enhancements through .NET 11.
- Caveat: much of Windows' own XAML use is C++ (Terminal, Settings, Explorer, Notepad), so "Microsoft uses XAML" does not equal "Microsoft uses .NET for apps." This nuance helps the hypothesis (**inference**).

**Gaps:**
- No primary Microsoft blog post was found for the Build 2026 WinUI announcements; all coverage is press relaying sessions.
- The Chain React 2023 Start menu talk was not retrieved.
- The Settings, VS Code, Notepad, and Photos language details come from memory.

## Q2: Microsoft org politics and .NET client UI churn (WinDiv vs DevDiv)

Research date: 2026-10-05. Tags: **verified** = primary or first-hand source read directly; **reported** = press or secondhand; **inference** = my reading; **[memory]** = from my training, not re-checked this session.

Caveat on quotes: pages were read through a summarizing fetch tool. Quotes marked verified were requested word for word, but recheck any quote against the live page before publishing. This matters most for Sinofsky's Substack and Snover's blog.

---

### 1. Joel Spolsky, "How Microsoft Lost the API War" (2004)

Source: https://www.joelonsoftware.com/2004/06/13/how-microsoft-lost-the-api-war/ (June 13, 2004). **verified**

- Two camps: "The Raymond Chen Camp believes in making things easy for developers by making it easy to write once and run anywhere (well, on any Windows box)." / "The MSDN Magazine Camp believes in making things easy for developers by giving them really powerful chunks of code which they can leverage, if they are willing to pay the price of incredibly complicated deployment and installation headaches."
- "Inside Microsoft, the MSDN Magazine Camp has won the battle."
- On Avalon: "...codenamed Longhorn, which will contain, among other things, a completely new user interface API, codenamed Avalon, rebuilt from the ground up to take advantage of modern computers' fast display adapters and realtime 3D rendering."
- The churn line: "So you've got the Windows API, you've got VB, and now you've got .NET, in several language flavors, and don't get too attached to any of that, because we're making Avalon, you see, which will only run on the newest Microsoft operating system."
- "WinForms is completely stillborn. Hope you haven't invested too much in it."
- Cost to developers: "...we haven't ported Fog Creek's two applications from classic ASP and Visual Basic 6.0 to .NET because there's no return on investment for us. None. It's just Fire and Motion as far as I'm concerned: Microsoft would love for me to stop adding new features to our bug tracking software and content management software and instead waste a few months porting it to another programming environment."
- Hint at the org cause: "No developer with a day job has time to keep up with all the new development tools coming out of Redmond, if only because there are too many dang employees at Microsoft making development tools!"
- "Web applications don't require Windows." / "The new API is HTML..."

Use for the post: Spolsky frames the split as two philosophies (compatibility vs new APIs), not two divisions. His point is that churn costs developers. He does not claim a WinDiv/DevDiv feud. **inference**

### 2. The Longhorn reset (2004) and managed code pulled from Windows

- Microsoft press release, "Microsoft Announces 2006 Target Date for Broad Availability of Windows 'Longhorn' Client Operating System," https://news.microsoft.com/2004/08/27/microsoft-announces-2006-target-date-for-broad-availability-of-windows-longhorn-client-operating-system/ (Aug 27, 2004). **verified**
  - "The Windows WinFX developer technologies, including the new presentation subsystem code-named 'Avalon' and the new communication subsystem code-named Indigo, will be made available for Microsoft Windows XP and Windows Server 2003 in 2006."
  - WinFS was deferred to after Longhorn. Avalon was decoupled from the OS and shipped downlevel, so it was no longer *the* Windows API. **inference**
- Thurrott, "Programming Windows: A Lap Around Longhorn" (Premium), https://www.thurrott.com/dev/262688/programming-windows-a-lap-around-longhorn. At PDC 2003, Windows chief Jim Allchin called WinFX "the next step beyond Win32." **reported** (premium page, seen through a search snippet only)
- Sinofsky, "091. Cleaning Up Longhorn and Vista," Hardcore Software, https://hardcoresoftware.learningbyshipping.com/p/091-cleaning-up-longhorn-vista (July 24, 2022). **verified** (Sinofsky was in Office at the time and took over Windows after Vista, so this is an insider's retrospective, not an eyewitness account of the reset)
  - "The .NET client (desktop programs one would use on a laptop) programming model was built 'on top' of the Windows programming model, Win32, with little coordination or integration with the operating system."
  - "Should developers build Win32 apps or should they build .NET apps? While this should not have been an either/or, it ended up as such because of the differing results."
  - "The three pillars of Longhorn, WinFS, Avalon, and Indigo, failed to make enough progress to be included in Vista (together these three technologies were referred to as WinFX.)"
  - "The team spoke of Avalon as being a replacement for HTML in the browser and also .NET on the client."
  - "Win32, .NET, WPF, and even Jolt were designed separately and for different uses with little true architectural synergy."
- Sinofsky, "103. The End of Windows Software," https://hardcoresoftware.learningbyshipping.com/p/103-end-of-windows-software (Oct 23, 2022). **verified**
  - "Windows leadership effectively banned .NET from Longhorn because of performance and memory management issues."
  - "The Windows team made a rule that no applications written with .NET would ship with Windows Vista."
  - "The rift between Windows and Developer grew significantly from 2004-2006 as the Longhorn/Vista project progressed."
  - "A deep schism was created between the Win32 and .NET APIs on the desktop."
  - "The languishing Win32 API was no longer receiving much support or innovation from the Developer division."
  - On DevDiv's own choice: "The strategy was specifically to evolve these technologies separate from Windows so they could be provided across Windows versions."
  - On C#: "This was a dream for BillG who always wanted Microsoft to develop and own a proprietary programming language implementation." / "a proprietary language was neither necessary nor sufficient strategically. The only thing that mattered in a platform battle was owning the APIs and runtime." / "The Developer division strategy fed that need to the exclusion of building quality Windows applications."
  - **This is the strongest first-hand source for the hypothesis.** The former Windows president names a Windows-to-Developer "rift" in so many words. He also gives a technical reason (performance, memory) and a structural one (DevDiv chose to ship .NET across Windows versions), not only rivalry. **inference**

### 3. Windows 8, WinRT, "Jupiter," and the 2011 backlash

- **XAML moves into the Windows division (June 2011).** WinFuture, "Microsoft baut Entwickler-Teams für Windows 8 um," https://winfuture.de/news,63904.html (June 24, 2011), relaying Mary Jo Foley (ZDNet) on an internal memo from DevDiv head S. Somasegar. **reported** (I could not find Foley's original ZDNet URL)
  - The team building XAML for Windows moved to the Windows division. The team building XAML for Windows Phone, Xbox, and the browser plug-in (Silverlight) moved to the Windows Phone division. Developer tools stayed in DevDiv. Julie Larson-Green (Windows Experience) said the XAML team would keep working on Windows 8 with the Developer Experience team on "Jupiter."
  - Use for the post: the client UI framework literally changed owner. It left DevDiv for WinDiv, and its Silverlight branch went to a third division. **inference**
- **The June 2011 demo and the backlash.** The Register (Tim Anderson), "Windows 8: Microsoft's high-stakes .NET tablet gamble," https://www.theregister.com/2011/06/06/windows_tablets_without_silverlight_dot_net/ (June 6, 2011). **reported**
  - "it still looks as if Microsoft's Server and Tools division is pulling one way, and the Windows team the other."
  - Pete Brown, Microsoft's .NET community lead: "We're all being quiet right now because we can't comment on this...please wait until September."
- Other coverage of the forum backlash (Silverlight forums, Channel 9, Nicholas Petersen's open letter): Visual Studio Magazine, "Developers React to Windows 8 Reveal," https://visualstudiomagazine.com/blogs/desmond-file/2011/06/wbdes_windows-8-dev-response.aspx (June 2011); TechPartner, "Silverlight developers reject Windows 8 roadmap," https://www.techpartner.news/news/silverlight-developers-reject-windows-8-roadmap-260027. **reported**. One outlet says a forum thread was viewed "seven million times". That figure is unverified, so don't use it.
- **Sinofsky on BUILD 2011.** "104. //build It and They Will Come (Hopefully)," https://hardcoresoftware.learningbyshipping.com/p/104-built-it-and-they-will-come. **verified** (summarized more than quoted, so recheck the wording)
  - "The .NET bubble extended to the 50,000 person Microsoft enterprise organization that were the tip of the .NET spear and also the massive Developer division itself."
  - "To many, not being able to simply port their code to new Windows 8 apps was a non-starter."
  - C#, VB, and XAML were first-class on WinRT, but the existing .NET frameworks (WinForms, WPF) were not.
- **Sinofsky on why Windows 8 didn't build on .NET.** Chapter 103 (above): "Like Apple we had early in the Windows 8 design phase concluded that Windows needed a new platform, not yet another set of libraries on top of Windows like Flash." / "Silverlight was repurposed to be the API for Windows Phone 7 and subsequently Windows Phone 8. Silverlight had little to do with our Windows platform." **verified**

### 4. Silverlight's demotion came from DevDiv's own parent

- TechCrunch, "RIP Silverlight on the web," https://techcrunch.com/2010/10/30/rip-silverlight-on-the-web/ (Oct 30, 2010), and eWeek, "Microsoft's Muglia Clarifies Silverlight Comments," https://www.eweek.com/development/microsoft-s-muglia-clarifies-silverlight-comments/. **reported**
  - At PDC 2010, Mary Jo Foley asked Bob Muglia, president of Server and Tools (the parent org of DevDiv), about Silverlight. He said "Our strategy has shifted" and "Silverlight is our development platform for Windows Phone." He walked it back in a blog post.
  - **Counter-evidence:** the executive who signaled Silverlight's retreat ran the tools side, not Windows. Silverlight's death fits "shifting bets" (HTML5, phone) better than a WinDiv-vs-DevDiv fight. **inference**

### 5. Retrospective first-hand-ish voice: Jeffrey Snover (2026)

- Jeffrey Snover, "Microsoft hasn't had a coherent GUI strategy since Petzold," https://www.jsnover.com/blog/2026/03/13/microsoft-hasnt-had-a-coherent-gui-strategy-since-petzold/ (Mar 13, 2026). HN discussion: https://news.ycombinator.com/item?id=47651703.
  - Snover is the creator of PowerShell and was a Microsoft Technical Fellow on the Windows Server side **[memory]**. The post doesn't say he was in the room for these decisions. Treat it as an informed insider's opinion, not testimony. **reported**
  - "The Windows team's bitterness toward .NET never healed. From their perspective, gambling on a new managed-code framework had produced the most embarrassing failure in the company's history. That bitterness created a thirteen-year institutional civil war between the Windows team and the .NET team that would ultimately orphan WPF, kill Silverlight, doom UWP, and give us the GUI ecosystem boof-a-rama we have today."
  - "after the reset, leadership issued a quiet directive: no f*** managed code in Windows. All new code in C++." (Two fetches rendered the expletive differently, so check the exact text.)
  - "UWP's controls were tied to the OS because the Windows team owned them. The .NET team didn't. The developer tools team didn't. Project Reunion was an organizational workaround dressed up as a technical solution."
  - "Every failed GUI initiative traces back to one of three causes: internal team politics (Windows vs. .NET), a developer conference announcement driving a premature platform bet (Metro, UWP), or a business strategy pivot that orphaned developers without warning (Silverlight)."
  - Note: Snover names politics as only *one* of three causes. That is useful nuance against a single-cause story. **inference**
- "Windows just hated .NET that much" comes from an anonymous HN commenter described as ex-DevDiv, relayed by byteiota (https://byteiota.com/microsofts-windows-gui-chaos-14-pivots-killed-development/). **reported, unverifiable.** Don't use it; it reads as gossip.

### 6. Reorgs 2018–2026

- **March 29, 2018: Myerson leaves and Windows is split.** TechCrunch, https://techcrunch.com/2018/03/29/terry-myerson-evp-of-windows-and-devices-is-leaving-microsoft-prompting-a-big-ai-azure-and-devices-reorganization; GeekWire, https://www.geekwire.com/2018/windows-chief-leaving-microsoft-ceo-satya-nadella-rolls-massive-engineering-reorganization/. **reported** (Nadella's memo is quoted in both)
  - Experiences & Devices (Rajesh Jha) took Windows experiences. Cloud + AI Platform (Scott Guthrie) took Windows core platform. DevDiv sat under Guthrie's Cloud + AI. **[memory]** for DevDiv's exact placement; it fits Guthrie's ownership of developer tools since the 2014 C+E era.
  - Use for the post: from 2018, the .NET runtime team and the Windows platform team both reported to the Azure leader. That supports "runtime funded because it sells Azure". The Windows client team went elsewhere. **inference**
- **March 2024: Windows reunified under Pavan Davuluri.** The Register, https://www.theregister.com/2024/03/26/microsoft_reorg/ (Mar 26, 2024); Winaero, https://winaero.com/microsoft-consolidates-windows-engineering-teams-under-unified-leadership. **reported**
  - Davuluri memo: "This change unifies Windows engineering work under a single organization." Core OS had been in Azure since 2018. The kernel, virtualization, and WSL reportedly stayed in Azure.
- **January 13, 2025: DevDiv folded into "CoreAI – Platform and Tools" under Jay Parikh.** GeekWire, https://www.geekwire.com/2025/microsoft-creates-new-ai-platform-and-tools-division-led-by-former-facebook-engineering-chief-jay-parikh/; Redmond Mag, https://redmondmag.com/articles/2025/01/13/microsoft-announces-core-ai.aspx. **reported** (quotes Nadella's memo)
  - The new division "will combine Microsoft's Dev Div and AI Platform teams," plus some of the Office of the CTO. Nadella: "thirty years of change is being compressed into three years."
- **May 2025 layoffs hit MAUI and .NET for Android.** Miguel de Icaza on X, https://x.com/migueldeicaza/status/1922409129567563855 (May 2025): "Microsoft laid off the senior engineers of .NET on Android and key figures of Maui." **reported** (a former Xamarin founder speaking publicly, not an official source). Part of a roughly 3% company-wide cut.
  - Microsoft's response: David Ortinau (MAUI PM) in GitHub discussion dotnet/maui #29483, https://github.com/dotnet/maui/discussions/29483 (May 25, 2025): "Our commitment to the longevity of .NET MAUI continues unchanged." **verified**
  - I found no comparable report of cuts to WinUI / Windows App SDK in 2025. **reported (absence)**

### 7. Ownership today: WinUI 3 / Windows App SDK vs .NET MAUI

- **WinUI 3 / Windows App SDK belong to Windows + Devices (Davuluri).** **inference**, strongly supported:
  - Davuluri (EVP, Windows + Devices), "Our commitment to Windows quality," https://blogs.windows.com/windows-insider/2026/03/20/our-commitment-to-windows-quality/ (Mar 20, 2026): "Reducing interaction latency by moving core Windows experiences to the WinUI3 framework." The Windows org is moving its own shell (Start, Run, Widgets) onto WinUI 3. **verified**
  - Notebookcheck, April 2, 2026, https://www.notebookcheck.com/Microsofts-WinUI-3-Vorstoss-untermauert-Bericht-ueber-natives-Windows-Team.1264558.0.html, relaying Windows Central: Microsoft is assembling a Windows team for "100 percent native" apps (Rudy Huyn). **reported**
  - Thurrott, "Microsoft Moves WinUI/WASDK Development to GitHub," https://www.thurrott.com/dev/340841/microsoft-moves-winui-wasdk-development-to-github (Aug 2026): "Mainline WinUI development is now taking place on GitHub." It doesn't name the owning org. **reported**
  - Snover (above): UWP controls were "tied to the OS because the Windows team owned them."
  - I found no official org chart that places WinUI. State it as "the Windows organization's framework," not as a precise reporting line.
- **.NET MAUI belongs to the .NET team in DevDiv, now inside CoreAI – Platform and Tools.** It ships in the dotnet GitHub org (dotnet/maui), and its PM (Ortinau) answers there. **inference** from repo ownership plus the Jan 2025 reorg. MAUI's Windows backend renders through WinUI 3 **[memory]**, so the DevDiv framework depends on the WinDiv framework.

### 8. Evidence AGAINST (or complicating) the hypothesis

1. **The technical reason is given first-hand.** Sinofsky attributes the Longhorn .NET ban to "performance and memory management issues." That is a defensible engineering call, not just tribalism. **verified**
2. **DevDiv chose to decouple.** Per Sinofsky, DevDiv deliberately evolved .NET "separate from Windows so they could be provided across Windows versions." The divergence was structural (different shipping vehicles), not only rivalry. **verified**
3. **Silverlight was demoted by DevDiv's own boss.** Muglia, president of Server & Tools, said "Our strategy has shifted." The cause was the HTML5 and phone bet, not WinDiv. **reported**
4. **Convergence moments exist.** XAML moved *into* Windows in 2011, and C#/XAML were first-class on WinRT. Today the Windows org is betting its own shell on WinUI 3, and MAUI-on-Windows sits on WinUI 3. **reported/verified**
5. **Spolsky's framing is about philosophy, not divisions.** The "Raymond Chen camp vs MSDN Magazine camp" split cuts across orgs. **verified**
6. **Snover counts politics as one of three causes.** The other two are conference-driven bets and business pivots. **verified**
7. **Generic layoffs.** The 2025 MAUI cuts came in a company-wide ~3% reduction. They are not proof of a targeted bet change. **reported**

### 9. Suggested non-gossip framing (inference)

The defensible claim is about structure, not personalities. For most of 2004–2024, the client UI framework was owned by whichever division's bet it served: DevDiv (WinForms/WPF), the Windows Phone division (Silverlight), Windows (WinRT XAML/UWP/WinUI), and DevDiv again (MAUI). Meanwhile the runtime sat in the org aligned with Azure, under Guthrie from 2018 and in CoreAI from 2025. Sinofsky's "rift between Windows and Developer" quote is the one first-hand line that names the friction, and he pairs it with technical and structural reasons. The post can lean on that pairing.

## Q3/Q4/Q5 research: .NET MAUI, Blazor, WinUI (as of 2026-10-05)

Hypothesis under test: the .NET runtime is excellent, but Microsoft's client UI strategy churns and undermines developers.

Confidence tags: **verified** = primary source (Microsoft Learn, devblogs, GitHub, dotnet.microsoft.com, vendor's own announcement about itself). **reported** = secondhand (press, blogs, vendor commentary about others). **inference** = my reasoning from the evidence. Nothing here is filled from memory unless flagged `[from memory, unverified]`.

Caution on circularity: search results surfaced `dev.to/stevenstuartm/blazor-and-microsofts-ui-framework-track-record-2fpc`, which is the author's own post. Do not cite it as independent evidence. The search engine's claim "even Microsoft's own flagship properties don't use Blazor" came from that post.

---

### A. .NET MAUI

#### A1. Xamarin end of support
- **Xamarin support ended May 1, 2024**, for all Xamarin SDKs including Xamarin.Forms. Microsoft points to .NET MAUI, and Xamarin.Android/iOS/Mac became .NET for Android/iOS/Mac.
  - Xamarin Support Policy, https://dotnet.microsoft.com/en-us/platform/support/policy/xamarin. **verified**

#### A2. Investment signals (official)
- **.NET 10 (GA Nov 2025):** "The focus of .NET MAUI in .NET 10 is to improve product quality." It shipped as a workload plus NuGet packages so projects can pin versions. Deprecations: ListView, TableView, and the Cell types (use CollectionView). MessagingCenter became internal. Compatibility.Layout and ClickGestureRecognizer were removed, and the non-async animation and DisplayAlert APIs were deprecated. Additions: XAML source generator, global/implicit xmlns, Aspire service-defaults template, layout diagnostics/metrics, experimental CoreCLR on Android.
  - "What's new in .NET MAUI for .NET 10", Microsoft Learn (author davidortinau), https://learn.microsoft.com/en-us/dotnet/maui/whats-new/dotnet-10, page date 2026-08-14. **verified**
  - Churn angle (inference): a "quality" release that still deprecates the long-standing ListView/TableView and removes MessagingCenter means real migration work for Xamarin.Forms-era code. Counter: the replacements (CollectionView, CommunityToolkit.Mvvm messenger) have existed for years.
- **.NET 11 (GA expected Nov 2026, now at RC):** the same line again: "The focus of .NET MAUI in .NET 11 is to improve product quality." CoreCLR became the default runtime on all MAUI platforms (Preview 4), replacing Mono, with NativeAOT opt-in. Handler-based Shell is the default on Android. Navigation/Tabbed/Flyout handlers replace compatibility renderers on iOS/Mac Catalyst, and the compatibility package was removed. Also new: CollectionView2 on Windows, Material 3 on Android, map pin clustering, passkeys, XAML incremental hot reload, implicit xmlns on by default, and dotnet watch for Android/iOS.
  - "What's new in .NET MAUI for .NET 11", Microsoft Learn, https://learn.microsoft.com/en-us/dotnet/maui/whats-new/dotnet-11, page date 2026-09-10. **verified**
  - Inference: this is substantial engineering, with a runtime swap and renderer-to-handler completion. It argues against "abandoned". The same changes are another round of breaking behavior for apps with custom renderers.
- **David Ortinau, May 25, 2025** (replying to "What is the future of MAUI?", which cited layoffs of "important software engineers from the MAUI team"): "Our commitment to the longevity of .NET MAUI continues unchanged." He cited "more contributors to .NET MAUI than ever before", the Syncfusion partnership, and an up-to-date roadmap, and said .NET Conf, not Build, is their main venue.
  - GitHub discussion dotnet/maui #29647, https://github.com/dotnet/maui/discussions/29647. **verified** (the Microsoft PM's own words)
- **.NET MAUI Day London, Feb 6, 2026:** Ortinau's roadmap session covered performance, tooling, cross-platform consistency, and "long-term stability investments". The recap gives no specifics.
  - Syncfusion blog recap, https://www.syncfusion.com/blogs/post/dotnet-maui-day-london-2026-event-recap. **reported**
- **No drag-and-drop designer.** DevClass reports Microsoft said in Sept 2025 that "a drag-and-drop UI designer is not part of our direction for .NET MAUI." Learn docs say "WinUI 3 / .NET MAUI XAML designer is not supported in Visual Studio … use XAML Hot Reload."
  - DevClass, "Microsoft open sources XAML Studio amid developer discontent with Visual Studio designers", 2026-01-07, https://www.devclass.com/development/2026/01/07/microsoft-open-sources-xaml-studio-amid-developer-discontent-with-visual-studio-designers/4079573. **reported** (I could not locate the original Microsoft quote)

#### A3. Layoffs and reorgs
- **May 13, 2025:** about 6,000 cut (~3%). Developers were hit hard: over 40% of ~2,000 Redmond cuts were software engineering. Named casualties include TypeScript's Ron Buckton and the Faster CPython team (Eric Snow, Irit Katriel, Mark Shannon).
  - mjtsai.com roundup, 2025-05-15, https://mjtsai.com/blog/2025/05/15/microsoft-layoffs/; Born City, 2025-05-22, https://borncity.com/win/2025/05/22/layoffs-at-microsoft-also-affect-veteran-developers/. **reported**
- **July 2025:** a second round of about 9,000 cuts.
  - Gulf News / Entrepreneur, https://www.entrepreneur.com/business-news/microsoft-layoffs-another-9000-employees-cut/494159. **reported**
- **MAUI-specific cuts:** community threads (r/dotnetMAUI "Microsoft layoffs", May 13, 2025) and GitHub #29647 claim "important software engineers from the MAUI team" were laid off. I could not identify named MAUI engineers or get confirmation from Microsoft. Ortinau's reply does not deny it.
  - r/dotnetMAUI thread https://www.reddit.com/r/dotnetMAUI/comments/1km06m0/microsoft_layoffs/ (not fetched directly; seen via mirror snippets); GitHub #29647 above. **reported / unconfirmed**

#### A4. GitHub health (dotnet/maui), pulled from the GitHub API on 2026-10-05
- 3,866 open issues; 23.3k stars; last push the same day.
- Last 12 months (since 2025-10-05): 3,108 issues opened and 2,999 closed, roughly break-even. 2,865 PRs merged, 2,748 of them excluding the dotnet-maestro dependency bot.
  - https://api.github.com/search/issues (queries `repo:dotnet/maui is:issue is:open`, etc.). **verified** (raw counts). Caveat (inference): the opened count may include automated or test-failure issues. The Buttondown weekly digests show many auto-reported UI-test regression issues.
- **Sentiment about regressions:** a developer quoted by DevClass said "things got much worse compared to 2025 and the Q1 of 2026 was a time of constant regressions and other bugs that make it difficult to use in production." The same article reports a bumpy .NET 9 to .NET 10 transition on Android and iOS.
  - DevClass, "Avalonia bolts Linux and WebAssembly onto .NET MAUI", 2026-03-24, https://www.devclass.com/development/2026/03/24/avaloniaui-enhances-net-maui-with-linux-and-webassembly-support/5209515. **reported** (editorial line: "MAUI has limited take-up … Microsoft itself appears hardly to use it")
- Example regression: 10.0.60 on iOS, where SKCanvasView stops responding after toggling parent IsEnabled (not seen in 10.0.51).
  - Weekly GitHub Report for MAUI (Buttondown), July 2026, https://buttondown.com/weekly-project-news/archive/weekly-github-report-for-maui-july-20-2026-july/. **reported**

#### A5. Adoption
- **Stack Overflow 2024 survey:** .NET MAUI used by 3.1% of respondents (22nd among other frameworks).
  - Visual Studio Magazine, 2024-07-26, https://visualstudiomagazine.com/articles/2024/07/26/so-dev-survey.aspx. **reported** (the 2025 survey page I fetched did not expose MAUI numbers)
- **JetBrains State of .NET 2025** (3,800+ developers, published Dec 2025): WinForms 23%, WPF 18%, Unity 18% for desktop. The published summary gives no MAUI, WinUI, Avalonia, or Uno figure.
  - https://lp.jetbrains.com/the-state-of-dotnet-2025/. **verified** (the summary page). Inference: their absence suggests they fell below a reporting threshold, but that is not stated.
- **Microsoft customer showcase lists MAUI users:** Fidelity (Active Trader Pro), NBC Sports Next (SportsEngine), Alpha Outdoors, Tyler Technologies (My Ride K-12), Demant, Civica, Irth, FinLocker, Escola Agil, and others. Microsoft's own: Azure mobile app, Seeing AI, Dynamics 365 Store Commerce app.
  - .NET MAUI customers showcase, https://dotnet.microsoft.com/en-us/platform/customers/maui. **verified** (that Microsoft claims these; a vendor showcase, so selection bias)
- **Microsoft's own cross-platform apps use React Native** (Outlook, Teams, parts of Office, Power Apps). Developers ask "why didn't the Office team use MAUI?" and get no answer. DevClass attributes this to "long-standing internal differences" between DevDiv and the Windows and Office teams. React Native for Windows's new architecture supports only C++ native modules, not C#.
  - DevClass, "Microsoft updates React Native for Windows; developers ask why not use MAUI", 2026-01-20, https://devclass.com/2026/01/20/microsoft-updates-react-native-for-windows-developers-ask-why-not-use-maui/; also DevClass 2024-04-11, https://www.devclass.com/development/2024/04/11/react-native-and-why-microsoft-uses-it-for-its-own-cross-platform-development/1631749. **reported**
- **Abandonments:** only anecdotal Reddit reports (an enterprise app moving MAUI to Avalonia, a team that "failed with MAUI" on performance). I found no public company post-mortem.
  - r/dotnetMAUI "Migrate to MAUI" (Feb 2025) and "MAUI vs Uno vs Avalonia" (Jun 2025) threads, seen through mirrors. **reported, weak**

#### A6. Ecosystem: Avalonia, Syncfusion, Uno
- **Avalonia's MAUI backend:** announced 2025-11-11 by Avalonia CEO Mike James. MAUI apps get Linux desktop, embedded Linux, and WebAssembly support, rendered by Avalonia instead of native controls. Avalonia claims more than 2x performance on macOS versus Mac Catalyst. It is not a Microsoft partnership and has no Microsoft quotes; the post says only that it had "guidance and feedback from engineers in the MAUI ecosystem."
  - Avalonia blog, https://avaloniaui.net/blog/net-maui-is-coming-to-linux-and-the-browser-powered-by-avalonia. **verified** (Avalonia's own claims)
  - The Register, 2025-11-13, https://www.theregister.com/2025/11/13/dotnet_maui_linux_avalonia/. **reported**
- **Preview 1** shipped with Avalonia 12 on .NET 11 previews (Mar 2026), targeting a stable release alongside .NET 11 (Nov 2026). Gaps: no Wayland (X11/XWayland only), and Avalonia controls can't be hosted in WinUI.
  - Avalonia "MAUI Avalonia Preview 1", https://avaloniaui.net/blog/maui-avalonia-preview-1. **verified**; DevClass 2026-03-24 (above). **reported**
  - Two-sided inference: this is evidence for the hypothesis, since a third party is filling platform gaps (Linux, web) that Microsoft never filled and swapping out MAUI's native-control philosophy. It is also evidence against: the MAUI API surface is valuable enough that others invest in keeping it alive and portable, which reduces lock-in risk.
- **Syncfusion:** on 2024-10-22 Ortinau announced on devblogs the Syncfusion Toolkit for .NET MAUI, 14 free open-source controls (MIT, syncfusion/maui-toolkit). He wrote that Syncfusion engineers had "resolved over 75 product issues" in dotnet/maui itself, and a Syncfusion-integrated template would ship with .NET 9. The toolkit has grown to 19+ controls, with a third set in Mar 2025.
  - ".NET MAUI Welcomes Syncfusion Open-source Contributions", devblogs, 2024-10-22, https://devblogs.microsoft.com/dotnet/dotnet-maui-welcomes-syncfusion-open-source-contributions/. **verified**
  - Syncfusion press release, 2025-03-12, https://syncfusion.com/company/about-us/news/press-releases/2025/leparknnouncedth2025-03-12/syncfusion-announces-third. **verified** (vendor's own)
  - Two-sided inference: the hypothesis reading is that Microsoft is outsourcing engineering on its own framework to a component vendor. The counter reading is a healthy open-source contributor model, which is what Ortinau's "more contributors than ever" refers to.
- **Uno Platform:** Microsoft credited Uno for about 1.5 months of joint work on .NET for Android / MAUI core for .NET 10 RC2 (Android API 36.1), and Uno is co-maintaining SkiaSharp with Microsoft.
  - Visual Studio Magazine, "NET 10 RC2 Is Final Step Before GA with Help from Uno Platform", 2025-10-15, https://visualstudiomagazine.com/articles/2025/10/15/net-10-rc2-is-final-step-before-ga-with-help-from-uno-platform.aspx. **reported**; Uno's announcement, https://platform.uno/?p=46879. **verified** (vendor's own)
  - Inference: SkiaSharp co-maintenance by a third party fits the same pattern as Syncfusion.

---

### B. Blazor

#### B1. Model evolution (churn evidence)
- **.NET 8 (Nov 2023)** replaced separate Server and WebAssembly templates with the "Blazor Web App": static SSR plus per-component interactive render modes (Server, WebAssembly, Auto).
  - DevClass, 2023-10-12, https://devclass.com/2023/10/12/focus-on-full-stack-blazor-web-framework-as-net-8-rc2-and-new-visual-studio-preview-arrives. **reported**. Learn docs on render modes [not fetched this session].
- **.NET 10 (Nov 2025)** Blazor changes: declarative `[PersistentState]`, circuit state persistence and pause/resume for Server, new ReconnectModal, inlined boot config and preloaded WASM assets, response streaming on by default (breaking), JS interop constructors and properties, source-generated nested validation, `NavigationManager.NotFound()` / `Router.NotFoundPage`, QuickGrid tweaks, passkey support in Identity.
  - "What's new in ASP.NET Core 10.0", https://learn.microsoft.com/en-us/aspnet/core/release-notes/aspnetcore-10.0. **verified**
  - Inference: much of .NET 9/10 work fixes rough edges introduced by the .NET 8 render-mode model (state across prerender, reconnection). That reads both ways: churn, or a model being finished.
- **.NET 11 plan (Daniel Roth):** static SSR parity with MVC, async EditContext validation, a Web Worker template, smaller WASM apps, a move of the WebAssembly runtime from Mono to CoreCLR, and Blazor plus Aspire integration.
  - Iron Software news summary, 2026-06-21, https://ironsoftware.com/news/industry-news/dotnet-11-aspnet-core-blazor-agentic-web/ (based on a Roth video presentation). **reported**

#### B2. Blazor Hybrid
- Razor components run natively, not in WebAssembly, and render into an embedded WebView. `BlazorWebView` exists for .NET MAUI, WPF, and Windows Forms, so existing WinForms and WPF apps can add Blazor UI that is reusable on MAUI and the web.
  - "ASP.NET Core Blazor Hybrid", Microsoft Learn, https://learn.microsoft.com/en-us/aspnet/core/blazor/hybrid/ (ms.date 2025-11-11). **verified**
  - Inference (against the hypothesis): this is Microsoft's own bridge out of the WinForms/WPF/MAUI split. It lets teams invest in one UI layer (Razor) across desktop, mobile, and web, which is the opposite of churn for those who pick it.

#### B3. Adoption evidence
- **Stack Overflow 2025:** Blazor used by 7.0% of all respondents and 7.6% of professionals (web frameworks).
  - https://survey.stackoverflow.co/2025/technology/. **verified**
- **Stack Overflow 2024:** Blazor "admired" at 51.9%.
  - Visual Studio Magazine 2024-07-26 (above). **reported**
- **JetBrains State of .NET 2025:** Blazor 25% among .NET developers' web frameworks. Elsewhere, ASP.NET Core is about 70%, Web API 47%, React 28%.
  - https://lp.jetbrains.com/the-state-of-dotnet-2025/. **verified** (Blazor figure); other figures **reported** via search snippet
- **BuiltWith:** about 38,394 live sites. Live sites grew from 12.5K (Nov 2023) to 35.5K (Dec 2024). Top-10k share is 0.9% (90 sites), and top-1M share 0.26%.
  - https://trends.builtwith.com/framework/Blazor. **reported** (the page blocked the fetch behind verification; figures come from the search snippet, date unclear)
  - Inference: tripling in a year is real growth, but small next to React or Angular. Most Blazor use is likely internal line-of-business apps that BuiltWith can't see, so the numbers undercount and say little about public-site popularity.
- **Microsoft's own usage:** the Aspire dashboard is built on Blazor with Fluent UI Blazor (`Microsoft.FluentUI.AspNetCore.Components`), and Microsoft ships and maintains the Fluent UI Blazor library. I found no evidence of major consumer-facing Microsoft products on Blazor.
  - NuGet dependents of Microsoft.FluentUI.AspNetCore.Components.Icons list Aspire.Dashboard, https://www.nuget.org/packages/Microsoft.FluentUI.AspNetCore.Components.Icons. **reported**
- **Customer showcase Blazor entries:** GE Digital, Toscano Digital, BurnRate, ShoWorks, Zero Friction.
  - https://dotnet.microsoft.com/en-us/platform/customers/maui. **verified** (Microsoft's claim)

#### B4. Critical takes
- **Dustin Moris Gorski, ".NET Blazor", Dusted Codes, 2023-11-19.** WASM: slow first load, SEO, cumbersome JS interop. Server: latency on every interaction, scaling stateful circuits, no offline mode. Mixed render modes inherit both sets of problems. "Blazor is evolving into an unwieldy beast". Compares it to Silverlight and questions "the longevity of Microsoft's commitment".
  - https://dusted.codes/dotnet-blazor. **reported** (opinion)
- **dotnet/aspnetcore issue #60236:** community complaint that render modes made auth and templates harder for the majority in order to serve a minority.
  - https://github.com/dotnet/aspnetcore/issues/60236. **verified** (that the issue exists; content summarized by search, not fetched)
- **AI-tooling gap:** "Razor Pages beat Blazor for AI". Copilot handles Razor Pages well and Blazor poorly because there is less training data.
  - HackerNoon, https://hackernoon.com/razor-pages-beat-blazor-for-ai. **reported** (opinion, undated in results)
- **Open Blazor-labelled issues in dotnet/aspnetcore:** 708 (GitHub API, 2026-10-05). **verified** (raw count)

#### B5. Positive takes
- Microsoft keeps shipping substantial Blazor work every release (.NET 8, 9, 10, 11 above). It is part of ASP.NET Core, so it shares that LTS/STS support. **verified** (release notes) / **inference** (the stability point)
- Third-party vendors' 2026 roadmaps (e.g., DevExpress "Blazor — Year-End 2026 Roadmap (v26.2)", 2026-09-03, https://community.devexpress.com/Blogs/aspnet/archive/2026/09/03/blazor-year-end-2026-roadmap-v26-2.aspx) show commercial ecosystem commitment. **reported**
- Visual Studio Magazine, "How Blazor's Unified Rendering Model Shapes Modern .NET Web Apps", 2025-11-19, https://visualstudiomagazine.com/articles/2025/11/19/how-blazors-unified-rendering-model-shapes-modern-net-web-apps.aspx. The take is mostly positive, while noting InteractiveAuto double-initialization pitfalls. **reported**

#### B6. Can Blazor fairly be called a failure? (inference)
- **Not on the evidence.** It is growing (BuiltWith tripled in 2024), used by 7% of SO respondents and 25% of .NET web developers, actively developed every release, and has a commercial component ecosystem. It does not fit the Silverlight pattern of a plugin runtime killed by platform shifts: it runs on web standards (WASM, SignalR, HTML).
- **What the evidence supports:** it is niche outside .NET shops, and its programming model has changed shape significantly (two hosting models, then the .NET 8 unified model with render modes, then .NET 9/10 fixes). Microsoft's flagship products don't visibly depend on it. "Churned and complicated, but not abandoned" is defensible. "Failure" is not.

---

### C. WinUI

#### C1. Microsoft's official position
- "WinUI 3 is the recommended native UI framework for building new Windows desktop applications." The page says parts of the Windows shell and built-in apps, plus PowerToys, are built with WinUI.
  - "WinUI 3", Microsoft Learn, https://learn.microsoft.com/en-us/windows/apps/winui/winui3/ (ms.date 2026-10-02). **verified**
- Framework guidance on Learn recommends WPF "for teams with existing WPF investment or when a XAML designer is required." Windows Forms remains supported for rapid line-of-business work.
  - Learn "Overview of framework options", https://learn.microsoft.com/windows/apps/get-started. **reported** (from search snippet; the page has since been restructured into "Getting started with WinUI", ms.date 2026-10-02, which no longer shows the comparison)
  - Inference: Microsoft's own guidance sends anyone who needs a designer to the older framework. That is a direct admission of WinUI's tooling gap.

#### C2. Open-sourcing progress
- **2025-07-31:** Beth Pan posted "WinUI OSS Update: Phased Rollout Toward Open Collaboration" with four phases: (1) more frequent mirroring, (2) third parties build locally, (3) third parties contribute and run tests, (4) GitHub as center of gravity. Quote: "this isn't a flip-the-switch moment, it's a deliberate process." On 2025-08-25 she targeted early October 2025 for Phase 1, after WinAppSDK 1.8. The status table now marks **all four phases Done** (status update dated 2026-08-28).
  - GitHub discussion microsoft/microsoft-ui-xaml #10700, https://github.com/microsoft/microsoft-ui-xaml/discussions/10700. **verified**
- Phases 1–3 were marked complete 2026-05-11. Phase 4 was reached 2026-08-27, ahead of a September target. Mainline development is now public on GitHub, but "the PRs currently in the pipeline are from Microsoft developers", with no date for accepting external PRs. The XAML compiler stays closed; Microsoft wants to modernize it first, with no date given (Build 2026).
  - XenoSpectrum, https://xenospectrum.com/en/winui-mainline-development-github/. **reported**; OpenSourceForU, 2026-06, https://www.opensourceforu.com/2026/06/winui-goes-more-open-source-as-microsoft-rebuilds-windows-11/. **reported**
- Repo activity (GitHub API, 2026-10-05): 2,232 open issues. Last 12 months: 645 opened, 425 closed, so the backlog is growing. 232 PRs merged. 8.5k stars. **verified** (raw counts)
  - Contrast (inference): dotnet/maui merged about 12x as many PRs in the same window.

#### C3. Sentiment
- A GitHub discussion titled "WinUI 3 is dead. When can we expect an official announcement?" (started about March 2024) passed 580 comments before the OSS announcement. Developers asked "How many people in total are assigned to the WinUI/WinAppSDK teams?" and described "long silent stagnation".
  - The Register, "Microsoft promises WinUI will be truly open source", 2025-08-05, https://theregister.com/2025/08/05/microsoft_winui_open_source. **reported**; 36Kr, 2025-08-06, https://eu.36kr.com/en/p/3411202919747200. **reported** (I could not get the thread's own URL)
- One source reports Microsoft told MVPs WinUI would no longer be an "external facing SDK" and later walked it back.
  - Search snippet in the Avalonia blog "WinUI vs WPF vs UWP", 2025-05-28, https://avaloniaui.net/blog/winui-vs-wpf-vs-uwp. **reported, from a competitor, unconfirmed**
- Visual Studio Magazine, "Microsoft Closes Request for Universal UI Builder: 'It's Baffling'", 2025-03-24, https://visualstudiomagazine.com/articles/2025/03/24/icrosoft-closes-request-for-universal-ui-builder-its-baffling.aspx. **reported** (403 on fetch; title and snippet only)
- Windows Latest, 2026-09-16, "Windows 11 got more web apps because WinUI couldn't get the basics right, now Microsoft is fixing the mess". Microsoft acknowledged "a large backlog of feature gaps", which pushed teams to Electron and WebView2.
  - https://www.windowslatest.com/2026/09/16/windows-11-got-more-web-apps-because-winui-couldnt-get-the-basics-right-now-microsoft-is-fixing-the-mess/. **reported**

#### C4. Visual designer
- None. Learn: "WinUI 3 / .NET MAUI XAML designer is not supported in Visual Studio … use XAML Hot Reload." The top feedback request remains "under review." Microsoft open-sourced XAML Studio 2.0 through the .NET Foundation in Jan 2026 as a stopgap (a lightweight live-preview tool, essentially one engineer, Michael Hawker).
  - DevClass, 2026-01-07 (above). **reported**

#### C5. DataGrid
- No first-party WinUI 3 DataGrid has shipped. The Windows Community Toolkit DataGrid is UWP-era (WCT 7.x), was not ported to WCT 8.x, and is archived.
  - "DataGrid" (archived), Microsoft Learn, https://learn.microsoft.com/en-us/dotnet/communitytoolkit/archive/windows/datagrid. **verified** (title and archive path; body summarized by search)
  - Long-standing request: microsoft/microsoft-ui-xaml issue #1500, https://github.com/microsoft/microsoft-ui-xaml/issues/1500. **verified** (exists)
- **Changing now:** at Build 2026 (May) Microsoft announced DataGrid and Charting controls for WinUI aimed at enterprise developers. By Sept 2026 a TableView (DataGrid-style) control was merged into the development branch (PRs #11641 and #11805) with sorting, filtering, and editing samples. It is not yet in a stable release; there is no grouping and no multi-select.
  - Windows Latest, 2026-07-27, https://windowslatest.com/2026/07/27/microsoft-admits-windows-11-native-apps-hog-ram-promises-a-winui-performance-boost-before-start-menu-rewrite. **reported**; Windows Latest 2026-09-16 (above). **reported**. PR numbers are cited there and not checked directly.

#### C6. Windows App SDK cadence
| Version | Release | End of servicing |
| --- | --- | --- |
| 1.5 | 2024-02-29 | 2025-02-28 |
| 1.6 | 2024-09-04 | 2025-09-04 |
| 1.7 | 2025-03-18 | 2026-03-18 |
| 1.8 | 2025-09-09 | 2026-09-24 (maintenance) |
| 2.0 | 2026-04-29 | 2027-04-29 (current; latest patch 2.5.1, 2026-09-16) |
- The stated policy is major releases "no more than every six months" plus minor and patch servicing. 2.0 moved to SemVer, aligned the NuGet and SDK versions, and future major versions will install side by side, with breaking changes only across majors. Each version is supported for about one year, so apps must upgrade yearly.
  - "Windows App SDK release channels", Microsoft Learn, https://learn.microsoft.com/en-us/windows/apps/windows-app-sdk/release-channels (ms.date 2026-09-29). **verified**
  - "Windows App SDK 2.0 release notes", https://learn.microsoft.com/en-us/windows/apps/windows-app-sdk/release-notes/windows-app-sdk-2-0. **verified**
  - Inference: the cadence is steady and predictable, which counts against "stagnation". The roughly 12-month support window per version is short for line-of-business desktop apps compared with WPF/WinForms riding .NET LTS.

#### C7. Build 2026 recommitment (strongest counterevidence)
- Chris Anderson (VP Software Engineering): "We've started to integrate it into the shell at a much faster rate. And so you're going to see a lot of the first-party features coming from Microsoft being built on top of WinUI." Parts of the Start menu now on React Native (All apps list) are being rewritten in WinUI. Work is underway on lower RAM use and on moving WinUI to the system compositor.
  - OpenSourceForU 2026-06 (above); Windows Latest 2026-07-27 (above); Pureinfotech, https://pureinfotech.com/microsoft-native-windows-apps-strategy/. **reported** (the quote recurs across outlets; no Microsoft transcript found)
- Reported: Microsoft is dropping the "3" from WinUI branding to signal there is no successor. It also announced "UI Reactor", an experimental open-source C# UI framework with no XAML or data binding (hooks, flex layout).
  - OpenSourceForU 2026-06; Windows Latest 2026-07-27. **reported**
  - Two-sided inference: dropping the version number is a direct response to fear of abandonment. A new experimental XAML-less C# framework announced at the same event is exactly the pattern the hypothesis describes, even if it is labelled experimental.
- Mescius (ComponentOne vendor), "Microsoft recommitted to WinUI: what Build 2026 means for Windows developers", https://developer.mescius.com/blogs/microsoft-recommitted-winui-what-build-2026-means-for-windows-developers. **reported** (vendor)

---

### Net reading for the post (inference)
- **Supports the hypothesis:** Xamarin's forced migration (EOL May 2024). Repeated API deprecations in MAUI 10 and 11. Microsoft's own cross-platform apps run on React Native, not MAUI. Third parties (Avalonia, Syncfusion, Uno) fill gaps and engineering. No designer for WinUI or MAUI. No WinUI DataGrid for about five years. A 580-comment "WinUI 3 is dead" thread. The WinUI issue backlog is growing. Microsoft admits WinUI gaps pushed Windows itself toward web tech. Blazor's hosting model has been reworked. A new experimental UI framework (UI Reactor) appeared at Build 2026.
- **Against the hypothesis:** MAUI ships a real release every year with quality as the stated focus, CoreCLR unification, and about 2.7k merged PRs a year. Ortinau publicly recommits. A named enterprise showcase exists (Fidelity, NBC Sports Next). Blazor is growing and not a failure. Blazor Hybrid bridges WinForms, WPF, and MAUI. WinUI is now fully developed in the open (Phase 4), the Windows shell is moving onto it (Start menu), a DataGrid is finally landing, and WinAppSDK has a predictable SemVer cadence.
- A sharper, defensible framing: the investment exists, but it is **visibly lower-priority than Microsoft's own product teams' choices** (React Native, Electron/WebView2). Developers read Microsoft's revealed preference, not its marketing. The 2026 WinUI turnaround is recent and unproven, and it follows years of stall.

## Q6–8: Third-party .NET UI, Native AOT vs UI frameworks, survey data

Research date: 2026-10-05. Hypothesis under test: the .NET runtime is excellent and improving while Microsoft's client UI frameworks churn, pushing developers to non-.NET stacks (Electron, Flutter, React Native, Tauri).

Confidence tags: **verified** = read on the primary source (or parsed from its HTML); **reported** = press/secondhand; **inference** = mine; **memory** = from training data, not re-checked.

---

### Bottom line

- **Against the "leaving .NET" reading:** a funded third-party .NET UI tier has grown up beside Microsoft. Avalonia has a $3M three-year sponsorship, ships Avalonia 12, and counts JetBrains, Unity, and others as users. Uno has seed funding, 160M+ NuGet downloads, and a formal collaboration with the .NET team. Avalonia XPF can Native-AOT-compile WPF apps that Microsoft's own WPF can't. Microsoft is now **opening MAUI to third-party backends**. All of this keeps developers on C#/.NET while they route around Microsoft's UI stacks. (inference)
- **For the hypothesis, on the runtime-vs-UI split:** Native AOT has advanced every release since .NET 7 (console → ASP.NET Core → iOS/Mac Catalyst non-experimental → the dotnet CLI itself compiled AOT in .NET 11 previews). **WPF and WinForms still can't even be trimmed**, and the SDK disables trimming for both. WinUI 3 gained AOT in 2024, and MAUI has it only on iOS/Mac Catalyst. The runtime's best feature doesn't reach the two most-used .NET desktop frameworks. (verified facts, inference framing)
- **Survey data is thin and partly unhelpful.** Stack Overflow **dropped the "Other frameworks and libraries" section in 2025**, so the last SO numbers for MAUI/Flutter/Electron/Tauri are from **2024**. In 2024, .NET MAUI had 3.1% usage and **53.1% admired**, against Tauri 73.8%, Flutter 60.6%, React Native 56.5%, and Electron 41.4%. MAUI's admired score beats Electron's and .NET Framework's (33.7%), but trails Tauri and Flutter. JetBrains' 2025 .NET report gives WinForms 23% and WPF 18% among .NET developers and publishes no MAUI or Avalonia figure.

---

### 1. Third-party .NET UI as counterevidence

#### Avalonia

| Claim | Source | Date | Tag |
| --- | --- | --- | --- |
| Devolutions sponsors Avalonia with **US $3M over three years**, for open-source work only (core framework, docs, tooling, community), with the MIT licence kept. The post cites **87M+ NuGet downloads**. Devolutions' own cross-platform RDP/SSH/PAM products are built on Avalonia | "Three-year sponsorship accelerates Avalonia's open-source roadmap", https://avaloniaui.net/blog/three-year-sponsorship-accelerates-avalonia-s-open-source-roadmap | 2025-06-24 | verified |
| Devolutions press release on the same deal | https://devolutions.net/company/press-release/avalonia-accelerate-backed-by-3-million-deal-from-devolutions/ | 2025 | reported (not opened) |
| JetBrains built the **macOS and Linux editions of dotMemory and dotTrace, and their Rider integrations, on Avalonia**. Quote: "Avalonia was an easy choice for us… it feels mature enough for production code." | Avalonia success story "JetBrains", https://avaloniaui.net/success/jetbrains | undated | verified (vendor page) |
| Rider ships built-in Avalonia XAML (.axaml) support: completion, inspections, quick-fixes, previews | JetBrains Rider Help, "Avalonia", https://www.jetbrains.com/help/rider/Avalonia.html | 2026.x docs | verified (search snippet) |
| Avalonia's homepage logos include **Unity, JetBrains, NASA, Autodesk, Devolutions, OutSystems, UXDivers**. It claims "2.1M projects" and "up to 1,867% increase in FPS on complex layouts" for Avalonia 12 | https://avaloniaui.net/ | fetched 2026-10-05 | verified (vendor marketing claims) |
| Older Avalonia materials also list GitHub, Datadog, AMD, Schneider Electric, Canon, Air France KLM, and Moody's Analytics | Avalonia handbook pages, e.g. https://avaloniaui.net/handbook/why-does-avalonia-ui-exist | undated | reported (search snippet only) |
| Avalonia 12.0.0 released **2026-04-07**, with 12.1.1 by 2026-07-30 | NuGet mirror / https://avaloniaui.net/whats-new/12-0 | 2026 | reported (search snippets) |
| 2023 growth: **387,000 downloads of v11** (released July 2023), 363 contributors, 9 full-time staff. CEO Mike James calls it "the most popular client UI technology in the .NET ecosystem" by GitHub stars, which the article says are "a poor indicator of actual usage". The article frames the growth as reflecting Microsoft's stumbles: WinForms and WPF are still Windows-only, MAUI has "buggy releases" and no Linux support, and its Mac target is Catalyst | Tim Anderson, "Avalonia project grows in 2023, highlighting Microsoft's cross-platform UI stumbles", DevClass, https://devclass.com/2024/01/03/avalonia-project-grows-in-2023-highlighting-microsofts-cross-platform-ui-stumbles | 2024-01-03 | reported |

**Avalonia XPF (WPF cross-platform):**

| Claim | Source | Date | Tag |
| --- | --- | --- | --- |
| XPF runs existing WPF apps on Windows, macOS, Linux (and per the homepage iOS, Android, WebAssembly) "before a full port". It is a commercial product licensed per-app, per-platform, and XPF licences fund the open-source framework | https://avaloniaui.net/ ; https://avaloniaui.net/sponsorship/ | 2026 | verified (homepage); licensing model reported (search snippet) |
| **XPF supports Native AOT:** "Native AOT (Ahead-of-Time) compilation is supported in XPF. Unlike WPF, XPF does not use COM marshalling, which allows it to be compatible with AOT compilation." Large apps with third-party control libraries can compile, but those libraries need trimming configs | Avalonia docs, "Native AOT" (XPF), https://docs.avaloniaui.net/xpf/deployment/native-aot | current | verified |

Inference: a third party has delivered the AOT-compiled WPF that Microsoft's own WPF can't (see §2). It is the sharpest single datum for the "runtime is great, Microsoft's UI lags it" thesis, and it also shows developers staying on .NET.

**Avalonia backend for .NET MAUI:**

| Claim | Source | Date | Tag |
| --- | --- | --- | --- |
| Avalonia announces a MAUI backend that brings MAUI apps to **Linux (desktop and embedded) and WebAssembly**, planned as MIT open source. The CEO says it aims to give MAUI devs more platforms without rewrites | ".NET MAUI is Coming to Linux and the Browser, Powered by Avalonia", https://avaloniaui.net/blog/net-maui-is-coming-to-linux-and-the-browser-powered-by-avalonia | 2025-11-11 | verified |
| The Register: the work was done "with guidance and feedback from engineers in the MAUI ecosystem". Avalonia hopes MAUI developers "may switch to AvaloniaUI for future projects". Developers who prefer native controls "will be disappointed" by custom rendering | The Register, https://www.theregister.com/2025/11/13/dotnet_maui_linux_avalonia/ | 2025-11-13 | reported |
| **MAUI Avalonia Preview 1** ships, targeting net11.0 previews. It credits Jakub Florkowski of the .NET MAUI team | "MAUI Avalonia Preview 1", https://avaloniaui.net/blog/maui-avalonia-preview-1 | 2026-03-16 | verified |
| DevClass coverage: "Avalonia bolts Linux and WebAssembly onto .NET MAUI" | https://www.devclass.com/development/2026/03/24/avaloniaui-enhances-net-maui-with-linux-and-webassembly-support/5209515 | 2026-03-24 | reported (not opened) |
| **Microsoft responds structurally:** .NET 11 Preview 7 adds "extension points intended for third-party platform backends". `OnPlatform` now recognizes GTK, macOS, and WPF, and alert, gesture, Resizetizer, SingleProject, and BlazorWebView expose contracts that external backends implement via NuGet "instead of maintaining patches against MAUI itself" | Edin Kapić, InfoQ, https://infoq.com/news/2026/08/dotnet-11-preview7-maui ; ".NET 11 Preview 7" release post lists "Third-party platform backends", https://devblogs.microsoft.com/dotnet/dotnet-11-preview-7/ | 2026-08-18 / 2026-08-11 | reported (InfoQ) / verified (devblog item title) |

Inference: Microsoft is turning MAUI into an API surface others can render. That cuts both ways. It cuts against "Microsoft abandons developers" (MAUI code gains platforms), and for "Microsoft's own UI implementations aren't where the energy is".

#### Uno Platform

| Claim | Source | Date | Tag |
| --- | --- | --- | --- |
| **Official technology collaboration with the Microsoft .NET team**, announced alongside .NET 10 RC2. Uno contributed .NET MAUI/.NET for Android binding and tooling updates for **Android 16 / API-36.1**, will **co-maintain SkiaSharp** with Microsoft, review PRs, and explore **WASM multithreading** contributions to the runtime. Quote (CEO François Tanguay): ".NET has been the backbone of Uno Platform from the start, and this partnership is about giving back in a meaningful way." The post carries no Microsoft quote | "Announcing Uno Platform and Microsoft .NET team Collaboration", https://platform.uno/?p=46879 | 2025-10-14 | verified |
| 2025 recap: **CAD $3.5M seed (≈US $2.54M)** on 2025-08-12, co-led by AQC Capital and Desjardins Capital, with **Scott Hanselman (Microsoft VP Developer Community) participating**. Total raised is CAD $6.5M. **160M+ NuGet downloads**, 300+ contributors, releases 6.0–6.4 in 2025. **Hot Design GA in Uno 6.0 (May 2025)**, which grew into "Hot Design Agent" by December | "The year we shipped AI, secured funding and partnered with Microsoft", https://platform.uno/blog/the-year-we-shipped-ai-secured-funding-and-partnered-with-microsoft/ | 2025-12-23 | verified (vendor) |
| Uno 6.4 / Studio 2.0 support .NET 10 and VS 2026 | heise, https://heise.de/-11076163 ; InfoQ, https://infoq.com/news/2025/10/uno-platform-63 | 2025 | reported |
| Uno Platform Studio 3.1 adds UI previews, XAML snippets, AI context | Visual Studio Magazine, https://visualstudiomagazine.com/articles/2026/09/03/uno-platform-studio-3-1-adds-ui-previews-xaml-snippets-and-more-ai-context.aspx | 2026-09-03 | reported (headline only) |
| Uno implements the WinUI API surface cross-platform, and the Windows Community Toolkit targets Uno as well as WinUI | — | — | **memory**, not re-checked |

Inference on Q1: yes. Both vendors are businesses whose customers chose to stay on C#/XAML. Their funding (Devolutions, AQC/Desjardins), marquee users (JetBrains), and Microsoft's own cooperation (Uno partnership, MAUI backend hooks, a Microsoft VP investing) are evidence of retention, not flight. The counter-reading is that these companies exist **because** Microsoft's own cross-platform story (MAUI: no Linux, Catalyst on Mac) left a gap. That supports the "Microsoft UI churn" half of the thesis while refuting the "pushes developers off .NET" half.

---

### 2. Runtime: Native AOT by release and UI-framework compatibility

#### Native AOT progression

| Release | What changed | Source | Tag |
| --- | --- | --- | --- |
| .NET 7 (Nov 2022) | Native AOT leaves experimental status. It targets **console apps and native libraries** | .NET 7 Preview 2/3 posts, e.g. https://devblogs.microsoft.com/dotnet/announcing-dotnet-7-preview-3/ ; Learn page says Native AOT is for ".NET 7 and later" | reported (search snippets) / verified (Learn) |
| .NET 8 (Nov 2023) | **ASP.NET Core Native AOT** (Minimal APIs, gRPC), plus the Request Delegate Generator. macOS supported from .NET 8. iOS, tvOS, Mac Catalyst experimental. Android experimental with no Java interop. Microsoft benchmark reported as startup −70%, size −89%, memory −57% | "Native AOT deployment overview", https://learn.microsoft.com/en-us/dotnet/core/deploying/native-aot/ (ms.date 2025-10-22, updated 2026-07-27); "Announcing ASP.NET Core in .NET 8", https://devblogs.microsoft.com/dotnet/announcing-asp-net-core-in-dotnet-8 (2023-11-14) | verified (Learn table) / reported (benchmark %s via search) |
| .NET 9 (Nov 2024) | Platform table: Windows adds x86, Linux adds Arm. **iOS, tvOS, Mac Catalyst lose the "experimental" note.** Android is still experimental | same Learn page, ".NET 9+" tab | verified |
| .NET 10 (Nov 2025) | `IsAotCompatible` assembly metadata introduced, with an opt-in `VerifyReferenceAotCompatibility` (IL3058). The perf post is a huge JIT/escape-analysis/devirtualization deep dive | Learn page (above); Stephen Toub, "Performance Improvements in .NET 10", https://devblogs.microsoft.com/dotnet/performance-improvements-in-net-10/ | 2025-09-10 | verified |
| .NET 11 previews (GA 2026-11-10) | **"NativeAOT `dotnet` CLI is now enabled by default"**: Microsoft compiles its own CLI with Native AOT | ".NET 11 Preview 7", https://devblogs.microsoft.com/dotnet/dotnet-11-preview-7/ | 2026-08-11 | verified |
| .NET 11 | **CoreCLR replaces Mono as MAUI's default runtime on Android, iOS, Mac Catalyst** (Preview 4). Mono opt-out via `<UseMonoRuntime>true</UseMonoRuntime>`. NativeAOT on Android is "actively under development". Ortinau warns "Don't assume universal improvement", since larger Android apps can regress on startup or size | David Ortinau, ".NET MAUI moves to CoreCLR in .NET 11", https://devblogs.microsoft.com/dotnet/dotnet-maui-moves-to-coreclr-in-dotnet-11/ | 2026-05-13 | verified |
| .NET 11 GA date and STS support to 2028-11-09 | ".NET Conf 2026 – Save the Date", https://devblogs.microsoft.com/dotnet/?p=60656 | 2026-08-25 | verified (GA date); STS end date reported |

Limits that matter for UI (verified, Learn "Native AOT deployment overview"): no dynamic loading, no Reflection.Emit, no C++/CLI, **"Windows: No built-in COM"**, requires trimming.

#### UI framework compatibility

| Framework | Trimming / Native AOT status | Source | Tag |
| --- | --- | --- | --- |
| **WPF** | "almost no WPF apps are runnable after trimming, so **trimming support for WPF is currently disabled in the .NET SDK**." Tracked in dotnet/wpf#3811. No trimming means no Native AOT | "Known trimming incompatibilities", https://learn.microsoft.com/en-us/dotnet/core/deploying/trimming/incompatibilities (ms.date 2023-11-08, **updated 2025-12-03**, wording unchanged) | verified |
| **WinForms** | "makes minimal use of reflection, but is heavily reliant on built-in COM marshalling… **trimming support for Windows Forms apps is disabled in the .NET SDK currently**." Tracked in dotnet/winforms#4649. Community workaround: WinFormsComInterop (ComWrappers) by kant2002 | same Learn page; https://github.com/kant2002/WinFormsComInterop | verified / reported |
| WinForms/WPF investment otherwise | .NET 10: a shared WinForms/WPF clipboard rewrite. .NET 11 Preview 7: WinForms "Opt in to .NET 11 visual styles" and toggle-switch CheckBox/RadioButton. WPF gets Fluent backdrop fixes | .NET 11 Preview 7 post (above); Learn "What's new in Windows Forms .NET 10", https://learn.microsoft.com/dotnet/desktop/winforms/whats-new/net100 | verified (P7) / reported (.NET 10 clipboard) |
| **WinUI 3 / Windows App SDK** | **Native AOT supported from Windows App SDK 1.6**. Contoso Camera sample: **50% faster start, ~8x smaller package (framework-dependent), ~2x smaller (self-contained)**, "your results might vary" | "What's new in Windows App SDK 1.6", https://blogs.windows.com/windowsdeveloper/2024/09/04/whats-new-in-windows-app-sdk-1-6/ | 2024-09-04 | verified |
| **.NET MAUI** | Native AOT on **iOS and Mac Catalyst** (doc monikers net-maui-9.0 → 11.0). "typically up to 2.5x smaller… up to 2x faster" startup on iOS, 1.2x on Mac Catalyst, up to 2.8x faster iOS builds. Requires compiled XAML and bindings, no `LoadFromXaml`, no `QueryProperty`, no `OnPlatform`/`OnIdiom` markup extensions, and **heap analysis not supported**. Android is not AOT (experimental at runtime level) | "Native AOT deployment on iOS and Mac Catalyst", https://learn.microsoft.com/en-us/dotnet/maui/deployment/nativeaot (ms.date 2024-12-03, updated 2026-10-01) | verified |
| **Avalonia** | Native AOT documented: `PublishAot` plus `IsAotCompatible`, compiled bindings (`x:CompileBindings`, `AvaloniaUseCompiledBindingsByDefault`), no runtime XAML loading | Avalonia docs, https://docs.avaloniaui.net/docs/deployment/native-aot | verified (search snippet of official docs) |
| **Avalonia XPF** | Native AOT for WPF code, see §1 | https://docs.avaloniaui.net/xpf/deployment/native-aot | verified |

Inference: the AOT gradient runs **newest-to-oldest**. Avalonia, WinUI 3, and MAUI-on-Apple get AOT. WPF and WinForms, the two frameworks .NET devs actually use most (JetBrains 2025: 23% and 18%, see §3), get none, and the docs page saying so has been unchanged since 2023. Microsoft's runtime investment is real, but much of it lands on server and cloud (the Learn page itself says AOT's benefit "is most significant for workloads with a high number of deployed instances, such as cloud infrastructure and hyper-scale services").

---

### 3. Survey data

#### Stack Overflow Developer Survey

**2025:** the technology page has **no "Other frameworks and libraries" section**. Flutter, Electron, React Native, Tauri, and MAUI don't appear anywhere on it (verified by downloading https://survey.stackoverflow.co/2025/technology and searching the HTML: zero "Tauri" hits). Only web frameworks remain. **Blazor 7.0%** of all respondents (7.6% professionals), ASP.NET Core 19.7%, ASP.NET 14.2% (verified). Secondary sites quoting ".NET MAUI 3.1%, 22nd place" as a 2025 figure are **misattributing the 2024 number** (inference, high confidence). No 2026 survey results page exists (https://survey.stackoverflow.co/2026/technology returns 404 on 2026-10-05).

**2024** (https://survey.stackoverflow.co/2024/technology, "Other frameworks and libraries"; verified by parsing page HTML):

| Tech | Usage, all respondents | Usage, professionals | Desired (want to use) | Admired (users who want to keep using) |
| --- | --- | --- | --- | --- |
| .NET (5+) | 25.2% | 27.1% | 21.9% | **71.1%** |
| .NET Framework | 16.4% | 18.1% | 6.4% | 33.7% |
| .NET MAUI | 3.1% | 3.4% | 5.5% | **53.1%** |
| Xamarin | 2.9% | 3.2% | 1.8% | 20.1% |
| Flutter | 9.4% | 9.4% | 12.4% | 60.6% |
| React Native | 8.4% | 9.0% | 11.7% | 56.5% |
| Electron | 6.5% | 6.3% | 7.0% | 41.4% |
| Tauri | 2.4% | 2.1% | 5.7% | **73.8%** |
| Qt | 7.3% | 6.5% | 6.3% | 46.5% |
| Ionic | 2.5% | 2.8% | 2.0% | 39.6% |
| Blazor (web frameworks) | 4.9% | — | — | — |

Parsing note: desired/admired pairs came from the SVG text order "desired% admired% Name". I cross-checked them against the chart label "53.1% .NET MAUI" and their plausibility (Ruff 84.1%, Xamarin 20.1%). WPF, WinForms, and Avalonia are **not options** in SO's list. Tag: verified (primary HTML), with small parsing risk.

**2023** (https://survey.stackoverflow.co/2023/, "Other frameworks and libraries", all respondents; verified from HTML): .NET MAUI **2.34%**, Xamarin 3.32%, Flutter 9.12%, React Native 8.43%, Electron 6.97%, Tauri 2.25%, Qt 6.55%. SO's commentary: "The top three selections .NET(5+) users want to use next year are .NET(5+), .NET MAUI, and .NET Framework (1.0 - 4.8). .NET favoritism is strong within their community." Admired values for 2023 weren't extractable (client-rendered).

Read-across (inference): 2023→2024 shows MAUI usage up (2.34% → 3.1%) while Xamarin fell (3.32% → 2.9%). That's consistent with migration **within .NET**, not out of it. Combined MAUI+Xamarin is roughly flat (5.66% → 6.0%). Flutter and React Native are ~3x MAUI's usage. MAUI's 53.1% admired is middling: above Electron (41.4%), below Flutter (60.6%) and Tauri (73.8%). The SO 2023 quote on .NET devs wanting MAUI next is direct counterevidence to "pushing developers out".

#### JetBrains

| Claim | Source | Date | Tag |
| --- | --- | --- | --- |
| "The State of .NET 2025", from the Developer Ecosystem Survey 2025 (**3,800+ professionals, 34 countries**). "Which technologies or frameworks do you use?" ASP.NET Core 62%, EF Core 42%, ASP.NET 32%, Azure 23%, **Windows Forms 23%**, **WPF 18%**, Unity 18% (top 7; rest behind "Show more") | https://lp.jetbrains.com/the-state-of-dotnet-2025/ | 2025 | verified (HTML) |
| Same report, web: ASP.NET Core 70%, Web API 47%, ASP.NET 38%, React 28%, MVC 27%, **Blazor 25%**, Angular 21% | same | 2025 | verified |
| Same report, project types: Web 68%, Backend 50%, **Desktop 41%**, Console 30%, Libraries 29%, Unity games 19%, Cloud/Serverless 18% | same | 2025 | verified |
| MAUI, Avalonia, Uno, WinUI not in the visible top lists. The figures, if any, sit behind the client-side "Show more" and weren't retrievable | same | — | verified absence in static HTML |
| JetBrains 2018 C# report: WinForms 37%, WPF 27% | https://www.jetbrains.com/lp/devecosystem-2018/csharp | 2018 | reported (search snippet) |
| Cross-platform mobile frameworks, 2023: Flutter 46%, React Native 35% (JetBrains DevEco via Statista; another write-up gives 47% / 36%) | Pragmatic Engineer, https://newsletter.pragmaticengineer.com/p/cross-platform-mobile-development ; TechRepublic, https://techrepublic.com/article/jetbrains-state-of-developer-ecosystem-2023-android-ios-mobile | 2023 | reported. MAUI/Xamarin share in this question not found |
| JetBrains DevEco 2025 language usage: C# 21% (#9), Dart 8% | Kotlin docs, https://kotlinlang.org/docs/multiplatform/_llms/programming-languages-cross-platform.txt | 2025 | reported |

Inference: WinForms (23%) plus WPF (18%) among .NET devs in 2025 is the largest client-UI usage in the ecosystem. These are precisely the frameworks with no trimming or AOT (§2). Desktop at 41% of .NET devs' projects undercuts any claim that .NET developers have left desktop.

---

### Gaps and flags

- No primary per-framework admired figures for SO 2023 (client-rendered). No SO data at all for 2025 or 2026 for MAUI/Flutter/Electron/Tauri.
- No JetBrains figure for MAUI, Avalonia, or Uno usage found. JetBrains cross-platform mobile shares for 2024/2025 not retrieved (pages are client-rendered).
- Avalonia's customer logos and "2.1M projects" are vendor marketing, and the 87M/160M NuGet download counts are vendor-reported. Download counts include CI restores.
- From memory, not checked here: Uno ↔ WinUI API parity and Windows Community Toolkit support for Uno; .NET 7 GA date of 2022-11-08.
- Not researched but relevant to the "against Microsoft UI" side: Microsoft's own first-party apps built on web/WebView2 stacks (e.g. new Teams, new Outlook). Worth a separate check if the post leans on it.
