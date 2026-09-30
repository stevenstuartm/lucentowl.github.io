---
layout: post
title: "Monorepo vs Polyrepo Is About Who Owns Change"
description: "A repository layout decides who owns the timing of a change to shared code. One version at head makes the library's owner update every consumer, and versioned repositories let each consumer choose when. Google's and Meta's tooling is what owner-driven change costs at their scale, and that cost grows with the number of owners a change has to cross, not with lines of code."
tags: [architecture, monorepo, source-control, code-ownership, dependency-management, governance]
author: steven-stuart
sources:
  - title: "Rachel Potvin and Josh Levenberg: Why Google Stores Billions of Lines of Code in a Single Repository (Communications of the ACM, 2016)"
    url: "https://cacm.acm.org/research/why-google-stores-billions-of-lines-of-code-in-a-single-repository/"
  - title: "Ciera Jaspan et al.: Advantages and Disadvantages of a Monolithic Repository: A Case Study at Google (ICSE-SEIP 2018)"
    url: "https://research.google/pubs/advantages-and-disadvantages-of-a-monolithic-codebase/"
  - title: "Alexandra Noonan: Goodbye Microservices: From 100s of problem children to 1 superstar (Segment, 2018)"
    url: "https://www.twilio.com/en-us/blog/developers/best-practices/goodbye-microservices"
  - title: "Durham Goode and Michael Bolin: Sapling: Source control that's user-friendly and scalable (Meta Engineering, 2022)"
    url: "https://engineering.fb.com/2022/11/15/open-source/sapling-source-control-scalable/"
  - title: "Sundaram Ananthanarayanan et al.: Keeping Master Green at Scale (EuroSys 2019)"
    url: "https://dl.acm.org/doi/10.1145/3302424.3303970"
  - title: "GitHub Docs: About code owners"
    url: "https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners"
  - title: "GitHub Docs: Managing a merge queue"
    url: "https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue"
  - title: "GitHub Collaboration"
    url: "/study-guides/developer-tools/github-collaboration.html"
  - title: "Git Advanced Operations"
    url: "/study-guides/developer-tools/git-advanced-operations.html"
---

I know the monorepo debate feels worn out. I keep coming back to it because the usual case for a monorepo skips the line in Google's own account that explains why it works. Rachel Potvin and Josh Levenberg's 2016 Communications of the ACM article on Google's repository lists the model's costs in three categories, and the first is "tooling investments for both development and execution." Google's monorepo works because Google funds teams to make it work.

The argument usually runs on repository mechanics like clone times, atomic commits, build caching, and whether Git can cope. Those problems get hard at scale, but they hide the decision underneath. Every organization that shares code has to answer one question about each change to it. When a shared component changes, who updates the code that depends on it, and who decides when that happens? A repository layout is an answer to that question, whether the team chose it on purpose or not.

A one-version monorepo gives the answer to the component's owner, who changes every consumer in the same commit. Versioned repositories give it to each consumer, who upgrades when they choose. Google's and Meta's tooling is what the first answer costs at their scale. And the cost grows with the number of owners a change has to cross, not with the size of the code.

## A Repository Boundary Decides Who Moves First

Potvin and Levenberg define the model by two properties together: one central repository, and trunk-based development where nearly everyone works at head. A 2018 study at Google by Ciera Jaspan and colleagues adds a third that carries the ownership consequence. Dependencies are unversioned, so "projects must use whatever version of their dependency is at the repo head."

### One Version Makes the Library's Owner Do the Migration

With one version at head, a library can't release a breaking change and wait for callers to adopt it. Potvin and Levenberg say it directly: "it makes sense, and is easier, for the person updating a library to update all affected dependencies at the same time." That removes the diamond dependency problem, where two of a project's dependencies need incompatible versions of a third, because only one version exists.

Jaspan's team surveyed 869 Google engineers and found the same assignment of work. Among the benefits engineers named most often was "Easy Updates," having their code migrated for them when an API they used changed. The paper notes that migrating an API's clients is "a task which is undertaken only by the owners of an API." The consumer's code changes, but the consumer doesn't write the change.

### Versions Let Each Consumer Own the Timing

The same survey asked engineers with experience in other companies' multi-repo codebases what those setups did better. The top answer was stable dependencies, which the authors describe as "a set of dependencies that do not change until the project owner chooses." Engineers in the monorepo "felt the effects of the code churning underneath them."

That is the other answer to the ownership question. Under versioning, the consumer decides when to take a change, and the producer can't finish a migration until every consumer has chosen to. The producer also can't see every consumer, because, as the paper puts it, "there is no canonical source of truth that enumerates all of a component's reverse dependencies."

Consumer-owned timing has a way of going wrong, too. When Segment ran more than 140 destination services from separate repositories, its shared libraries drifted. Alexandra Noonan's account describes how "the versions of these shared libraries began to diverge across the different destination codebases," because engineers under time pressure upgraded only the destination they were working on. Every consumer owned its timing, and none of them chose to take the change.

| Decision | One version at head | Versioned repositories |
| --- | --- | --- |
| Who writes the change to consumers | The shared component's owner | Each consumer |
| Who decides when consumers take it | The component's owner | Each consumer |
| Who can see every consumer | Anyone, by searching the one repository | Nobody without a separate inventory |
| What a slow consumer can do | Delay the change only by withholding approval | Stay on an old version the producer must keep supporting |
| What a careless producer costs | Every consumer breaks at once | Only the consumers that upgrade |

## Google's Tooling Pays for the Library Owner's Authority

Giving the library's owner authority over every consumer only works if that owner can do three things for code it doesn't own. It has to find every caller, prove the change safe for each of them, and get each owner's consent. Nearly every system in the CACM article serves one of those needs.

### Finding Every Consumer

Search is cheap in a small repository, but at Google's scale "standard tools like grep bog down," and the article describes code search and browsing as "a significant investment." Google also found that easy access let dependencies spread without anyone deciding they should. In 2011 it made new APIs private by default, so a team has to mark an API as open to other teams before they can depend on it. The article's advice to others is to put such controls "in place as soon as possible."

### Proving the Change Safe for Them

A change at head reaches every consumer immediately, so Google's test infrastructure "initiates a rebuild of all affected dependencies on almost every change," and a change that breaks the build widely is undone automatically. Uber met the same need in its own monorepo. Sundaram Ananthanarayanan and colleagues describe SubmitQueue in "Keeping Master Green at Scale" (EuroSys 2019), a system built to keep the main branch passing while thousands of engineers commit concurrently.

### Getting Each Owner's Consent

The monorepo lets anyone propose a change anywhere, but it doesn't let them commit it. "Each and every directory has a set of owners who control whether a change to files in their directory will be accepted." A change touching a thousand directories needs a thousand owners' approval. Google built Rosie to split such a change "along project directory lines, relying on the code-ownership hierarchy," and route each piece to its owners.

Consent turned out to cost the consumers, too. As Rosie's use grew, Google adopted a formal review process for large-scale changes in 2013, where a committee "balances the benefit of the change against the costs of reviewer time and repository churn." The article counts among the model's costs the load on "teams that need to review an ongoing stream of simple refactorings." In the article's January 2015 figures, engineers committed 16,000 changes on a typical workday, and automated systems committed another 24,000.

### Google and Meta Chose to Keep Paying

The CACM article reports that as the cost of scaling grew, "Google leadership occasionally considered whether it would make sense to move from the monolithic model," and chose to stay each time.

Durham Goode and Michael Bolin's announcement of Sapling, Meta's source control client, marks Goode's tenth year on the project and gives the reason Meta built its own. "Public source control systems were not, and still are not, capable of handling repositories of this size." Meta chose to scale the tools rather than split the repository, and at announcement the server and virtual file system behind that scale were still internal.

## Small Teams Get It Nearly Free

The large-company reports make monorepos look like something only a tooling budget buys, but they describe one company at one scale. Jaspan's authors also name selection bias among their threats to validity, since engineers who prefer multi-repo codebases may choose to work elsewhere. The Google reports establish what the model costs at Google's scale, not what it costs everywhere, and a small team's experience looks different.

### Segment Paid With One Test Tool

Segment fixed its drifting libraries by merging the destinations into one repository and committing to "one version for all our destinations" across 120 dependencies. Noonan reports 32 improvements to the shared libraries under the old architecture and 46 a year later. Segment didn't fund a source control team. It built one testing tool, Traffic Recorder, which records and replays HTTP traffic so the suite runs in milliseconds instead of up to an hour. That is the "prove it safe" capability at the size Segment needed, and the trade-off Noonan lists is the library-owner model's cost: "updating the version of a dependency may break multiple destinations."

Segment also merged the destinations into a single service at the same time, so its gains can't be credited to the repository alone. But its case shows why a small team succeeds. Noonan describes the destinations as the work of "the small team," so the person changing a library already owned every consumer. Finding them took a directory listing, and consent took no meetings.

### The Bill Follows Owners, Not Lines of Code

The tooling bill follows the owners a change has to cross, not the lines of code it touches. With one owner, the library-owner model costs almost nothing. With thousands of owners, it costs Piper, Rosie, a review committee, and a test fleet. The expensive range is the middle, where a change crosses enough owners that finding, testing, and approval stop being trivial, and nobody has yet been made responsible for them.

## Much of the Tooling Is Now for Sale, but the Owner Isn't

A lot of what Google had to build for itself can now be bought or configured. A GitHub `CODEOWNERS` file maps paths to owners and, with branch protection, blocks a merge until an owner approves. GitHub's merge queue tests each pull request against the latest base branch and every change queued ahead of it, the guarantee SubmitQueue was built for, at smaller scale. Git's partial clone and sparse checkout keep a large repository workable on a laptop, and build tools like Nx, Turborepo, and Bazel compute what a change affects. The site's GitHub Collaboration and Git Advanced Operations guides cover how each is set up.

What no tool supplies is the team that does cross-cutting changes for the whole organization. Google's article describes modernization efforts "managed centrally by dedicated codebase maintainers," including a Compiler team that ships more than 20 C++ compiler releases a year because it can see and fix every caller first. `CODEOWNERS` routes a change to a thousand reviewers, but it doesn't say who is allowed to send one or who decides it was worth their time. Google answers those questions with a committee.

An organization in the middle range that adopts a monorepo without deciding those things leaves each library owner two options for a change that crosses many teams. The owner can make it anyway, editing code they don't know and relying on reviewers who didn't ask for the work, so the approval becomes a formality. Or the owner can avoid breaking anyone by copying or pinning the old version inside the repository, which recreates versioning and gives back the monorepo's main benefit while keeping its costs. Either way the repository changed and the ownership didn't.

## A Monorepo Moves the Cost of Shared Code

A one-version monorepo doesn't make a shared library cheaper. It changes who pays for it. The library owner pays by updating every consumer, and the consumers pay by giving up control over when their code changes. Segment's 46 library improvements and the churn Google's engineers complained about are two halves of one bill.

That makes the repository decision a smaller one than the debate suggests. Services that share nothing live comfortably in either layout, because no change crosses an owner. Potvin and Levenberg are careful to note that "a monolithic codebase in no way implies monolithic software design." The layout matters in proportion to how much implementation teams share, and each shared component is a place where someone has to hold authority over other teams' code.

## Check Who Owned Your Last Shared Change

Pick the last change to a component that more than one team depends on, and trace it:

- **Who wrote the change to the consumers?** If the component's owner did, you are running the library-owner model, whatever your repository count.
- **Who decided when the consumers took it?** If each consumer did, count how many are still on an older version, and how long the producer has to support them.
- **Could the owner list every consumer before merging?** If the answer came from memory or a chat message, finding consumers is the first gap to close.
- **Did each consumer's owner approve?** A change that reached other teams' code without their review had authority nobody granted.
- **Who would send a change across every team's code, and who would decide it was worth everyone's review time?** If nobody holds that job, a monorepo will give you the churn Google describes without the team that makes it pay.

If the answers name one owner, the repository layout barely matters. If they name many owners and nobody accountable across them, decide that ownership first, and let the repository follow it.
