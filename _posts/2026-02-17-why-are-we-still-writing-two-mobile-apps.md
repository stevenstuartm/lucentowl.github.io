---
layout: post
title: "How One Screen Holds the Entire Industry Hostage"
date: 2026-02-17
tags: [architecture, web-development, mobile, pwa, cross-platform]
description: "The web platform already does what most apps do, but Apple's control of the phone screen is the hardest constraint keeping the industry building native. The 'users prefer native' narrative is circular logic created by the constraint itself."
author: steven-stuart
sources:
  - title: "WebKit Blog: Full Third-Party Cookie Blocking and More"
    url: "https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/"
  - title: "Stack Overflow 2025 Developer Survey: Technology"
    url: "https://survey.stackoverflow.co/2025/technology"
  - title: "ZDNet: Apple Declined to Implement 16 Web APIs in Safari Due to Privacy Concerns"
    url: "https://www.zdnet.com/article/apple-declined-to-implement-16-web-apis-in-safari-due-to-privacy-concerns/"
  - title: "Open Web Advocacy: Open Letter on Apple's PWA Removal"
    url: "https://letter.open-web-advocacy.org/"
  - title: "The Register: Apple Reverses PWA Decision (March 2024)"
    url: "https://www.theregister.com/2024/03/02/apple_reverses_pwa_decision/"
  - title: "Apple Developer: Changes to iOS in Japan"
    url: "https://developer.apple.com/support/app-distribution-in-japan/"
  - title: "Open Web Advocacy: OWA 2025 Review (January 2026)"
    url: "https://open-web-advocacy.org/blog/owa-2025-review/"
  - title: "TechCrunch: Appfigures Data on Apple App Store Commissions (May 2025)"
    url: "https://techcrunch.com/2025/05/08/appfigures-apple-made-over-10b-from-us-app-store-comissions-last-year/"
  - title: "U.S. Department of Justice: Justice Department Sues Apple for Monopolizing Smartphone Markets"
    url: "https://www.justice.gov/archives/opa/pr/justice-department-sues-apple-monopolizing-smartphone-markets"
  - title: "Open Web Advocacy: US DOJ Files Apple Antitrust Case"
    url: "https://open-web-advocacy.org/blog/us-doj-files-apple-antitrust-case/"
  - title: "eMarketer: The Majority of Americans' Mobile Time Spent Takes Place in Apps"
    url: "https://www.emarketer.com/content/the-majority-of-americans-mobile-time-spent-takes-place-in-apps"
  - title: "Talking Biz News: FT Returns to Apple's App Store After Six Years"
    url: "https://talkingbiznews.com/they-talk-biz-news/ft-returns-to-apples-app-store-after-six-years/"
  - title: "web.dev: Flipkart Triples Time-on-Site with Progressive Web App"
    url: "https://web.dev/case-studies/flipkart"
  - title: "NearForm: Starbucks Ordering and Store Locator Progressive Web App"
    url: "https://nearform.com/work/starbucks-progressive-web-app/"
  - title: "MSPoweruser: Starbucks Claims Their PWA Is a Massive Success"
    url: "https://mspoweruser.com/starbucks-claims-their-pwa-is-a-massive-success/"
---

Frameworks like React Native, Flutter, and MAUI keep promising to end the "write it twice" problem across mobile platforms. One codebase, every platform, native-quality results. Yet every time, the abstraction leaks. Then it floods so fast that bailing water is all you have time to do. I've been working with MAUI recently, and the experience crystallized a question I should have asked sooner: why am I not just building a website?

Once you pull that thread, it unravels fast. The web platform can do far more than the industry acknowledges. Most of what prevents universal web adoption is inertia, business incentives, or mental models rather than limits in the technology. On phones, the hardest of those limits trace back to one company's control of one screen.

<blockquote class="pull-quote">
<p>The web can do the job. One company made sure you'd never trust it to.</p>
</blockquote>

This isn't an argument that native apps are obsolete or that local executables should disappear. There are good reasons to run code on your own hardware, and the pure thin-client terminal hasn't arrived yet. Maybe it shouldn't. But when teams default to native without questioning it, they accept costs and constraints on the client side that the backend abandoned years ago when it moved to the cloud.

## What the Web Platform Can Actually Do

For the typical business application, on a phone, tablet, or desktop, the web platform already covers the core requirements:

| Capability                             | Web Technology                                     |
|----------------------------------------|----------------------------------------------------|
| Offline support                        | Service Workers, Cache API                         |
| Push notifications                     | Push API (iOS 16.4+, March 2023)                   |
| Camera, microphone, biometrics         | getUserMedia, WebAuthn/Passkeys                    |
| Payment processing                     | Payment Request API (includes Apple Pay)           |
| Home screen installation               | Web App Manifest, standalone window                |
| GPU-accelerated graphics and compute   | WebGPU (all major browsers, Nov 2025)              |
| Peripheral device access               | WebUSB, WebSerial, WebBluetooth, WebHID (Chromium) |
| Local file access                      | File System Access API, Origin Private File System |
| Near-native performance                | WebAssembly, Web Workers                           |
| Real-time communication                | WebRTC                                             |

Most rows work in Safari on iOS today. The peripheral APIs and full local file access are Chromium-only. iOS delivers push only to a web app the user has added to the home screen, with no install prompt to help them do it. Safari also clears a site's stored data after seven days of Safari use without a visit unless it's installed, as WebKit's own blog documents. Feel is the other gap, since Safari's keyboard, viewport, and standalone-mode quirks take deliberate work, and they're Apple's to fix.

That list covers what most apps do. Most are thin clients over an API: authenticate a user, fetch data, display it, let the user interact with it. The web handles all of that with a single codebase on every platform with a browser, and the deployment model alone should give teams pause. No App Store review cycles, no waiting days for a critical bug fix to clear approval, no separate release pipelines for each platform.

## What Genuinely Requires Native

These capabilities have no web equivalent.

- **Wearable integration and health data** like Apple Watch complications, Wear OS tiles, HealthKit, and Google Health Connect require platform SDKs with no web alternative
- **Advanced augmented reality** using LiDAR scanning, scene understanding, and body tracking exceeds what WebXR currently offers
- **Deep OS integration** like Siri Shortcuts, Google Assistant routines, home screen widgets, and inter-app communication remains outside the web's reach
- **True background processing** for geofencing, long-running background jobs, and persistent location tracking requires native APIs
- **Specific hardware access** like NFC writing on iOS, advanced camera controls, and screenshot blocking are native-only capabilities

This list is relevant, but it's also narrow. Look at the apps on your phone and the software on your desktop, and count how many actually need any of these features.

## Cross-Platform Frameworks Are the Wrong Answer

Cross-platform frameworks don't eliminate the two-codebase problem; they disguise it. React Native's JavaScript-to-native layer, Flutter's rendering engine, and MAUI's handler pattern each introduce their own category of bugs that don't exist in either native platform. You haven't removed the platform differences; you've added a third abstraction layer and still debug the two platforms underneath it.

The tech debt is unprojectable because you don't control the framework's roadmap. When Apple changes iOS, you wait for the framework to catch up. When the framework ships breaking changes, you're locked into an unplanned upgrade. When a critical bug sits in the issue tracker for months, your only options are workarounds or forks.

The original justification was that specialized native developers are expensive, so share code to reduce cost. AI code generation has lowered much of that barrier. A competent developer with AI assistance can get much further in Swift or Kotlin without years of platform experience, though lifecycle and accessibility details still take expertise. All the original disadvantages of cross-platform remain, and cheaper native still means two QA passes and two release pipelines. That duplication is an argument for the web, not for a framework.

## Microsoft Opened Its Stack While Apple Closed Its Screen

In the early 2000s, Microsoft was the villain. They owned the desktop, the browser, the runtime, and the development tools, and the DOJ antitrust case settled in 2001 was about exactly this: using a Windows monopoly to crush Netscape. Apple was the scrappy alternative making beautiful things for creative people, and when the iPhone launched in 2007 it felt like liberation from the carrier-controlled mobile landscape.

Microsoft lost mobile and Windows 8 alienated more and more desktop users. Their response was to stop trying to own the screen and instead to compete on the stack. .NET went open source, Visual Studio Code became the most-used editor in Stack Overflow's developer survey, and they acquired GitHub and kept it open. The company that once tried to kill Linux now ships a Linux kernel inside Windows.

Apple went the other direction. When the iPhone became the dominant computing device, Apple discovered what Microsoft had known in the 1990s: if you control the platform people depend on, you don't have to compete on openness. You compete on control.

I write .NET code for a living and I choose to do it on a Mac because the experience is genuinely better. Notice what that reveals about both companies though. Microsoft made it possible by building .NET and VS Code to run everywhere. Try the reverse: building an iOS app without a Mac, submitting to the App Store without Xcode, running Swift on Windows with the same support .NET has on macOS. You can't. Microsoft earns developers by being useful everywhere. Apple captures them by being mandatory for anyone who ships to an iPhone.

Apple's products deserve their loyalty. The Mac is excellent, the ecosystem integration is seamless, and users trust the brand for good reasons. That trust is exactly what makes the constraint on the iPhone so effective. When a company makes products this good, people don't scrutinize the walls. They assume the walls exist for good reasons.

But look at what Apple controls versus what they build. Siri has been outperformed by competitors for over a decade, and it doesn't matter because Siri doesn't need to be good; it needs to be on the iPhone. Owning the screen means you don't have to be the best at anything that runs on it. You just need to be good enough at the thing people hold, and everything else flows through you.

<blockquote class="pull-quote">
<p>Apple doesn't compete on technology. They compete on constraint ownership. The phone is the aperture, and Apple controls the aperture.</p>
</blockquote>

## The Walls Apple Built

Apple's walls around iOS are higher than anything Microsoft built around Windows in the 1990s, and they're more sophisticated because they're framed as user protection rather than vendor control. Windows in the 1990s never stopped anyone from installing Netscape's engine.

Outside the EU and Japan, every browser on iOS must use Apple's WebKit rendering engine. Chrome on your iPhone isn't really Chrome. It's a WebKit skin with Chrome's UI on top. Firefox, Edge, Brave: all WebKit underneath. So Apple alone controls what web capabilities exist on every iOS device, regardless of which browser icon a user taps.

On Chrome and Android, web apps can access APIs unavailable on any iOS browser, including Bluetooth, NFC, Background Sync, USB, and serial devices. Web push reached Chrome on Android in 2015 and iOS in March 2023. On Android, any website can request push permission.

In June 2020, as ZDNet reported, Apple declined to implement 16 Web APIs, citing "privacy and fingerprinting concerns." The concern isn't baseless, since a web page runs from any link while a native app gets Bluetooth and NFC only after store review and a deliberate install. Mozilla shares some of it. What sets Apple apart is reach. Firefox declining an API doesn't keep it off anyone's phone, because Chrome on Android ships these APIs behind permission prompts. Apple's refusal is the only one that binds every browser on the device.

The EU's Digital Markets Act forced Apple to permit other browser engines in 2024, and the response was revealing. Alongside that change, Apple attempted to remove PWA support entirely in the EU, converting installed web apps into simple bookmarks. Their justification was "complex security and privacy concerns." After an open letter from Open Web Advocacy gathered thousands of signatures and the European Commission sent formal inquiries, Apple reversed the decision within two weeks, as The Register reported. Home-screen apps came back still running only on WebKit.

Japan's smartphone law added the same requirement in December 2025, per Apple's developer page on changes to iOS in Japan. Even with engine choice required, as of early 2026 zero browsers have shipped a non-WebKit engine on iOS in the EU, according to Open Web Advocacy. The regulation exists on paper. The monopoly persists in practice.

The App Store generated approximately $27 billion in global commissions in 2024 on cuts of 15 to 30%, per Appfigures data reported by TechCrunch. A web capable enough to replace paying apps would let them leave the store, so the web stays capped. Free business tools pay Apple nothing, but they live under the same cap. The U.S. Department of Justice drew this connection in its March 2024 antitrust lawsuit, whose complaint cites the WebKit requirement as part of Apple's monopoly maintenance, as Open Web Advocacy's summary quotes.

Android doesn't have these restrictions. But it doesn't matter. Few product leaders will ship something that doesn't work on iPhones, because iPhone owners are too large and too valuable a share of most Western markets to give up. The most constrained major platform sets the ceiling for what anyone builds. Once a team must build an iOS app anyway, a matching Android app is the path of least resistance. The web rarely gets a fair trial on Android either, because the decision was made on iOS's terms.

## The Circular Logic of "Users Prefer Native"

The most common justification for building native apps is market data, like eMarketer's, showing that users spend 88-92% of their mobile time in apps and only 8-12% in browsers.

Much of that time goes to social, messaging, video, and games, so it says little about a typical business app. As evidence of preference, it's circular reasoning dressed up as market research. Of course the native experience retains users better. The web version usually received a fraction of the investment, because teams don't fund a channel the platform caps. You cannot measure user preference when one option was deliberately hobbled by the platform owner and underfunded by the developer.

Framework adoption has the same circularity. Flutter and React Native adoption is growing, but teams reach for them to avoid writing two native apps. That problem exists largely because Apple won't let the web do on the iPhone what it already does on every other platform. A developer checks iOS web capabilities, finds background sync missing and Bluetooth unavailable, builds native instead, and that decision gets counted as evidence that the web isn't ready. The constraint creates the behavior that justifies the constraint.

Not all of the pull is Apple's doing. Habit, a persistent icon, and lock-in favor native even where Apple has no say. But on phones, in the markets that set the industry's defaults, the counterfactual has never been tested at scale because Apple has prevented it. The assumption that native is inherently superior has become so embedded that most teams skip straight to "which framework?" without ever stopping at "does this need to be an app?"

The closest tests come from companies that chose the web for business reasons. None is a controlled trial of web against native. The Financial Times left the App Store in 2011 and ran on the web alone for six years. It returned in 2017 with an app that sent new readers to the website to subscribe, as Talking Biz News reported, so the web stayed the product and the app became a convenience.

Android-dominant markets like India and Southeast Asia show what happens where Apple's cap matters least. Apps still lead there, partly on habit and on product playbooks written iOS-first. But companies like Flipkart and JioSaavn treat the web as a first-class product rather than a fallback. Flipkart rebuilt its mobile site as a PWA after a failed app-only experiment, while keeping its native app. Users spent three times as long on the PWA as on the old mobile site, per Google's web.dev case study.

Starbucks built a PWA 99.84% smaller than their iOS app, according to its developer NearForm. It told Google I/O it had doubled the number of people ordering through the web each day, as MSPoweruser reported. But Starbucks kept the native app too. That raises an important question I can't answer: did they keep it because native was genuinely better, or because no one was willing to ask "why do we still have this?"

## The Anxiety That Predates Mobile

When the iPhone launched in 2007, Steve Jobs told developers to build web apps. The web genuinely wasn't ready, and the App Store arrived a year later. But the response to that gap matters more than the gap itself. Rather than rallying behind closing it, the industry built an entirely parallel native ecosystem.

That response follows a pattern that has repeated since the 1960s: every generation of computing produces a viable thin-client model, and the market keeps finding reasons to resist it. Mainframe terminals gave way to PCs. Sun's network computer was technically sound and commercially dead. Chromebooks were dismissed as laptops that couldn't work offline, even as every application was migrating to the browser. Each shift had cost and latency reasons, but a recurring anxiety rode along with them: if computation lives somewhere else, you lose control. Companies that profit from local-first computing have always been happy to amplify that fear.

The backend already completed the thin-client transition. Cloud won decisively, and few teams argue for on-premises-first anymore. Much desktop software has moved into the browser, but the phone is frozen at the same conceptual barrier that existed when the first PC replaced the first terminal. A native app over an API already keeps its data elsewhere, but it still ships its interface as installed code through a store. We accepted that our servers are someone else's computers. We haven't accepted that our applications could be someone else's rendering.

Cloud broke through partly because no single company controlled the server. The web can't break through until it works on Apple's phone, and Apple decides what works on Apple's phone.

## Default to the Web and Go Native Only for a Documented Gap

Before committing to a native app, ask one question: "Do we have a specific, documented constraint that the web platform cannot satisfy?"

For most mobile software needs, the answer is no. Safari, like a framework, is a roadmap you don't control, and its quirks take work. But those quirks sit in an engine you can test directly, not in a translation layer over two platforms. Where Safari lacks a feature, a native supplement covers exactly that gap. It brings back store review and a second release pipeline, but only for the features that need them.

The immediate objection is discoverability, since an app outside the store seems invisible. But store search is often where users go to fetch an app they already heard about through web search, social media, ads, or word of mouth. The store is more of a checkout counter than a shopping mall. Google Play already supports Trusted Web Activities, which let PWAs appear as store listings. The Microsoft Store accepts PWAs directly. Deep links, QR codes, and social sharing put users straight into web experiences.

Retention is the harder objection. A home-screen icon and push drive return visits, and on iOS both need a manual install that Safari never prompts for. Where retention depends on them, that is the documented gap a native supplement covers.

The web app is your product. The native app, if you need one at all, exists only for the features that Apple won't let the browser handle.

| Context | Recommendation |
|---|---|
| Business or enterprise tools | Web, with instant deploys, no store friction, and broad coverage |
| E-commerce, content, media | Web, unless wearable integration or advanced AR is core to the product |
| Field ops, inspections, data collection | Web installed to the home screen, with Service Workers for offline and sync on open; native if data must sync in the background or geofencing is required |
| Consumer app in Android-dominant markets | Web PWA, with first-class app experience and no store tax |
| Consumer app with iOS as the primary platform | Web first; go native for install and push only when retention depends on them |
| Wearable companion (Apple Watch, Wear OS) | Native required |
| Persistent background location tracking | Native required |
| Home screen widgets, Siri / Assistant routines | Native required |
| Advanced AR with LiDAR or body tracking | Native required |

Cost, velocity, and agility shouldn't be values we only demand from our backend infrastructure. Native apps aren't going away, and they shouldn't. But we should stop accepting a status quo where one company's business model sets the ceiling for how the entire industry ships code.
