---
layout: post
title: "Migration Tools Keep the Code and Lose the Intent"
description: "Automated migration tools are judged by whether the ported code compiles and behaves the same, so they carry every workaround forward and can't tell one written for a constraint the new platform removed from a business rule. The reasons were never in the code, and a port that looks complete hides that they're gone."
tags: [architecture, legacy-modernization, technical-debt, dotnet, software-design]
author: steven-stuart
sources:
  - title: "Legacy .NET Upgrade Assistant guidance for UWP (Microsoft Learn)"
    url: "https://learn.microsoft.com/en-us/windows/apps/windows-app-sdk/migrate-to-windows-app-sdk/upgrade-assistant"
  - title: "Python documentation: 2to3, automated Python 2 to 3 code translation"
    url: "https://docs.python.org/3.12/library/2to3.html"
  - title: ".NET Upgrade Assistant overview (Microsoft Learn)"
    url: "https://learn.microsoft.com/en-us/dotnet/core/porting/upgrade-assistant-overview"
  - title: "Peter Naur: Programming as Theory Building (Microprocessing and Microprogramming, 1985)"
    url: "https://cdn.chriskrycho.com/file/chriskrycho-com/resources/naur1985programming.pdf"
  - title: "Joel Spolsky: Things You Should Never Do, Part I (2000)"
    url: "https://www.joelonsoftware.com/2000/04/06/things-you-should-never-do-part-i/"
  - title: "Microsoft Learn: Threading functionality migration (Windows App SDK)"
    url: "https://learn.microsoft.com/en-us/windows/apps/windows-app-sdk/migrate-to-windows-app-sdk/guides/threading"
  - title: "G. K. Chesterton: The Thing (1929), \"The Drift from Domesticity\""
    url: "https://www.gkc.org.uk/gkc/books/The_Thing.txt"
  - title: "A. A. Terekhov and C. Verhoef: The Realities of Language Conversions (IEEE Software, 2000)"
    url: "https://www.cs.vu.nl/~x/cnv/"
  - title: "De Marco, Iancu, and Asinofsky: COBOL to Java and Newspapers Still Get Delivered (ICSME 2018)"
    url: "https://arxiv.org/abs/1808.03724"
  - title: "Wikipedia: Characterization test (Michael Feathers, Working Effectively with Legacy Code)"
    url: "https://en.wikipedia.org/wiki/Characterization_test"
---

The port kept every line. It lost every reason.

That's the normal outcome of an automated migration, and it's easy to miss because everything else about the port looks like success. The project builds on the new framework. The screens open, the tests that existed still pass, and the task list of tool-generated TODOs gets worked down to zero. Then someone asks why the app copies every file the user opens into its own storage folder before reading it, and no one can answer. The old platform's sandbox was the reason. The new platform drops that sandbox by default, but the code is still there, and nobody knows whether removing it is safe.

> **AUTHOR** — the author's experience goes here: Windows desktop code carried through several framework generations, and a workaround that outlived the platform limit it was written for.

A migration tool is judged by whether its output compiles and behaves like its input. That standard carries every line forward, including every workaround for a constraint the new platform no longer has, and it treats those workarounds exactly as it treats business rules. The difference between the two was never written in the code. It lived in the heads of the people who wrote it, and a port that compiles cleanly hides the fact that those reasons didn't come along.

## Migration Tools Promise Equivalence

Vendors are candid about the goal. Microsoft's documentation for the .NET Upgrade Assistant's UWP-to-WinUI 3 path says the tool "aims to migrate your project and code so that it compiles," and that where it can't, it leaves Task List TODOs for the developer. Python's 2to3 documentation describes the same contract. Its fixers transform Python 2 source "into valid Python 3.x code," and it prints a warning wherever a change is needed that it can't make.

Neither tool claims more than that, and both are useful at it. Namespace changes, project formats, and renamed APIs are tedious to move by hand and easy to move by rule. Microsoft has since deprecated the Upgrade Assistant and points .NET upgrades at a Copilot-based modernization agent instead, but the contract hasn't changed with the implementation. A migration of any kind is checked by whether the result builds and does what the old system did.

That contract is equivalence, and equivalence is the right test for most of a codebase. It's the wrong test for the lines that exist only because of the platform being left behind.

## The Code Carries the Fix, Not the Reason

### The Theory Was Never in the Text

Peter Naur made the underlying argument in "Programming as Theory Building" in 1985. A program, he argued, is more than its text. The programmers who built it hold a theory of it, and that theory lets them "explain why each part of the program is what it is" and "respond constructively to any demand for a modification." Naur held that this theory can't be fully written down. It's the kind of knowledge a person has, not a set of facts a document records.

His evidence was a compiler handed from one group to another along with full documentation, annotated source, and design notes. The receiving group still proposed extensions as "patches that effectively destroyed its power and simplicity," which the original authors could spot at once. About ten years later, after other programmers had taken it over without the original group's guidance, the compiler's "original powerful structure was still visible, but made entirely ineffective by amorphous additions." The text survived intact. What it was for didn't.

Naur called a program whose theory-holding team has dissolved dead, even if it still runs and still produces useful results. A dead program shows its state "when demands for modifications of the program cannot be intelligently answered." A migration is exactly such a demand, applied to every line at once.

### Spolsky's Fixes Were for Machines That Are Gone

Joel Spolsky's "Things You Should Never Do, Part I" (2000) is the standard case against rewriting, and it's usually read as the opposite of Naur's view. Spolsky warned that an ugly two-page function is full of bug fixes, and that "when you throw away code and start from scratch, you are throwing away all that knowledge."

Look at the fixes he names. One handles a computer without Internet Explorer installed. Another handles low-memory conditions. A third handles a user yanking a floppy disk out mid-save. Each one is a response to an environment. Floppy drives have all but disappeared, and Internet Explorer has been retired, while low memory is still with us. Spolsky is right that the code holds knowledge, but it holds the fix without the environment that made the fix necessary. Carried onto a machine with no floppy drive, the third fix is still correct code that guards against nothing, and nothing in the function says which of the three that is.

Spolsky and Naur agree more than they seem to. The code holds what the program does, and the people held why. A rewrite risks losing the what, which was Spolsky's warning. Like a rewrite, a port loses the why. Unlike a rewrite, it keeps the what, so it looks as if it lost nothing.

## Four Kinds of Line, and the Two a Port Can't Tell Apart

Sort a codebase by what happens to each line when a tool ports it, and four kinds emerge. The UWP-to-WinUI 3 move gives a concrete case of each, because Microsoft's migration documentation records where the two platforms differ.

| Kind of line | UWP-to-WinUI 3 example | What the tool does | Who finds it, and when |
| --- | --- | --- | --- |
| **Breaks on the new platform** | A handler on the `Suspending` event, which WinUI 3 desktop apps don't have | Flags it as a TODO, or the build fails | The developer, during the port |
| **Relied on a guarantee the old platform gave** | Code that counted on UWP's single-instance default, or on its UI thread blocking reentrant calls | Carries it forward unchanged. It compiles | Testers or users, as a behavior change or a crash |
| **Works around a constraint the new platform lifted** | Copying user files into the app's own storage folder, because the UWP sandbox made reopening them by path unreliable | Carries it forward unchanged. It compiles and still works | Often no one, because nothing breaks |
| **Encodes a business rule** | A rounding rule, an approval threshold, a special case for one customer | Carries it forward unchanged. It compiles and still works | No one needs to, because it's supposed to be there |

### Lines That Break Get Found, Sooner or Later

The first kind gets all the attention, because the tool reports it. Every TODO is a known unknown with a documentation link attached, and working the list down feels like progress. It is progress, but it's the cheapest part of the migration to find.

The second kind is more expensive, because nothing flags it. Microsoft's threading migration guide notes that UWP's UI thread used a threading model that blocks reentrancy and the Windows App SDK's doesn't, so a UWP app that assumed the non-reentrant behavior "might not behave as expected," with reentrancy into XAML controls the case to watch for. The dependence was never written down because the platform enforced it. The resulting crashes arrive late, and often as stowed exceptions whose stack has already unwound. But at least they arrive. Something breaks, and someone has to explain why.

### Workarounds and Rules Look the Same in the Output

The third and fourth kinds are the subject of this post, because in the ported code they're indistinguishable. A UWP app ran in an AppContainer sandbox, where a file outside the app's own storage was reachable only through a picker, a declared capability, or a saved permission token. An app that needed to reopen a user's files later often copied them into its local folder instead. A WinUI 3 app runs with full trust unless it opts back into isolation. The copying code still compiles, since `Windows.Storage` keeps its names, and a packaged app can still call it, so it still works. It's also now unnecessary, and every feature that touches files gets built around it.

Nothing in the text separates that workaround from a business rule. Both are conditionals and extra steps that some past developer added deliberately. The difference is in the reason. One exists because of the platform, the other because of the business, and reasons are exactly what Naur said the text can't carry. A tool that reads only text can't sort them, and neither can a new team reading the ported output, since they're reading the same text.

## A Port Turns Chesterton's Fence Into a Fixture

G. K. Chesterton's parable from *The Thing* (1929) is the usual counsel against removing code no one understands. A reformer finds a fence across a road, sees no use for it, and wants it cleared away. The wiser reformer answers, "If you don't see the use of it, I certainly won't let you clear it away. Go away and think. Then, when you can come back and tell me that you do see the use of it, I may allow you to destroy it."

That's sound advice for a system whose builders are around to ask, because the thinking has somewhere to go. After a port, the fence's builders are usually gone, the platform it guarded against is gone, and the migration log records only that the fence moved. The reformer can think as long as they like and still never learn what the fence was for. Chesterton's rule, applied honestly, then says the fence stays forever.

That's how ported systems accumulate the "amorphous additions" Naur described. Every unexplained workaround becomes permanent by default, and new features get built around it, which gives the next team one more reason not to touch it. The port didn't create the ignorance, but it tends to make it permanent, because it produces code that works well enough that no one is forced to investigate.

## Converted Systems Run, but Resist Change

The research on automated language conversion reached the same place from the other direction. A. A. Terekhov and C. Verhoef's "The Realities of Language Conversions" (IEEE Software, 2000) found that converted programs tend to "retain the idiom of the source language." Mapping COBOL's data types onto a target language either loses exact semantics or emulates them, and emulation produces what they called "Java-compliant COBOL programs, but maybe not Java programs." They concluded that it is "really hard to believe that converted programs are more maintainable," which was usually the reason for converting in the first place.

A later report shows what that looks like when the conversion succeeds. Alessandro De Marco, Valentin Iancu, and Ira Asinofsky described moving a newspaper's delivery system, running since 1979, from mainframe COBOL to Java on Linux through automated translation (ICSME 2018). The team achieved "a functionally equivalent system" and ran it in production. They also reported that problems remained "related to new feature development, business domain knowledge transfer, and recruiting new software engineers to work on the modernized application." Equivalence was delivered. Everything Naur would have called theory was still owed.

I met the same trade on the desktop when I led the rebuild of an undocumented UWP application on WinUI 3. Microsoft's tooling migrated project structure and some API calls, but its output broke wherever the two platforms behaved differently, and the cost of repairing it was trending toward the cost of rebuilding. A clean port would also have carried the old app's threading problems and memory leaks forward unchanged. The team kept the business and data layers, rebuilt the presentation layer, and treated the running legacy app as the behavioral specification for everything it rebuilt.

## What a Port Still Owes You

None of this makes a migration tool the wrong choice. It makes a finished port the start of the migration rather than the end of it. The tool's output is an inventory of behavior. What the team does next decides whether the ported system can change.

**Pin the behavior before you question it.** Characterization tests, Michael Feathers' name for tests written against legacy code, record what the system does now, right or wrong. They can't recover why a workaround exists, but they turn "is it safe to remove this?" into "what breaks when I remove it?", which a team can answer without the original authors. Once the builders are gone, that's the most practical way out of Chesterton's trap.

**List what the old platform did that the new one doesn't.** The platform's migration notes are a map of lifted constraints and withdrawn guarantees. For UWP to WinUI 3, that list includes the sandbox, suspension, single instancing, and the reentrancy guard. Every item on it points at code that is now either unnecessary or silently wrong. Search for the code each one implies before the port ships, not after a crash report arrives.

**Classify workarounds as you find them.** Each one is a platform workaround, a business rule, or an accident nobody meant. Record the classification and the evidence where the next developer will find it, next to the code or in a decision record. A reason rediscovered and written down is the only part of Naur's theory a team can rebuild on purpose.

**Measure the migration by what's been explained, not what's been converted.** A port that compiles is done by the tool's standard. By the team's standard it's done when a developer can change any part of it and say what the change will affect.

## Where the Argument Stops

A port that never needs to change owes nothing further. A system on its way to retirement, moved only to get off an unsupported runtime, can carry its fences to the grave, and equivalence is all it needs. The argument also weakens when the old and new platforms are nearly identical. A move between .NET versions lifts far fewer constraints than a move from UWP to a desktop app model, or from COBOL to Java, so it leaves fewer orphaned workarounds behind.

Nor is this an argument for rewriting. Naur himself preferred discarding the text and letting a new team solve the problem afresh, and Spolsky's warning shows what that costs. A rewrite loses the fixes along with the reasons. Neither path carries the theory, because only people can carry it. The difference is that a rewrite tends to force the team to confront what it doesn't know, while a port lets them skip it.

The evidence here is also limited in kind. It's an argument from Naur, one analysis of converters, and experience reports from individual migrations. The research for this post found no study comparing how easily ported and rewritten systems change over the years that follow. If one showed ported systems changing as easily, the case for treating a port as unfinished would weaken to a matter of taste.

## Check One Workaround This Week

Pick a system that reached its current platform by migration, and open the module that changes most often. Find the strangest conditional in it, the one that handles a case you can't picture happening. Then ask three questions:

- Which platform, library, or limit was this written for, and does it still apply?
- Is there a test that fails if you delete it?
- Could anyone on the team say whether it's a business rule, without guessing?

If the answers are "unknown," "no," and "no," the migration moved that line without moving its reason. Write a characterization test around it, delete it on a branch, and see what breaks. Whatever you learn, write it down beside the code, because that note is the part of the system no tool will ever carry forward.
