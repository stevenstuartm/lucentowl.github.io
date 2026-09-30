---
layout: post
title: "Feature Flags Are Configuration With a Deadline"
description: "Most feature flags are created to be temporary, but removing one is a second change with no trigger, no reward, and often no owner left, so it rarely gets scheduled. A flag nobody removes becomes permanent configuration that is still tested like a temporary one, in the one state it happens to be in. The fix is to set the deadline and owner when the flag is created, and to let automation enforce them."
tags: [feature-flags, configuration, testing, technical-debt, continuous-delivery]
author: steven-stuart
sources:
  - title: "Jens Meinicke, Chu-Pan Wong, Bogdan Vasilescu, and Christian Kästner: Exploring Differences and Commonalities between Feature Flags and Configuration Options (ICSE-SEIP 2020)"
    url: "https://www.cs.cmu.edu/~ckaestne/pdf/icseseip20.pdf"
  - title: "Pete Hodgson: Feature Toggles (aka Feature Flags) (martinfowler.com, 2017)"
    url: "https://martinfowler.com/articles/feature-toggles.html"
  - title: "Testing Strategy Architecture"
    url: "/study-guides/architecture/testing-strategy-architecture.html"
  - title: "SEC: In the Matter of Knight Capital Americas LLC (Release No. 70694, 2013)"
    url: "https://www.sec.gov/files/litigation/admin/2013/34-70694.pdf"
  - title: "Md Tajmilur Rahman, Louis-Philippe Querel, Peter C. Rigby, and Bram Adams: Feature Toggles: Practitioner Practices and a Case Study (MSR 2016)"
    url: "https://ieeexplore.ieee.org/abstract/document/7832900/"
  - title: "Murali Krishna Ramanathan, Lazaro Clapp, Rajkishore Barik, and Manu Sridharan: Piranha: Reducing Feature Flag Debt at Uber (ICSE-SEIP 2020)"
    url: "https://manu.sridharan.net/files/ICSE20-SEIP-Piranha.pdf"
  - title: "Xhevahire Tërnava: Feature Toggle Dynamics in Large-Scale Systems: Prevalence, Growth, Lifespan, and Benchmarking (arXiv, 2026)"
    url: "https://arxiv.org/abs/2604.15872"
  - title: "Deployment Strategies"
    url: "/study-guides/infrastructure/deployment-strategies.html"
  - title: "Unleash Documentation: Feature flags"
    url: "https://docs.getunleash.io/reference/feature-toggles"
  - title: "Eduardo Smil Prutchi, Heleno de Souza Campos Junior, and Leonardo Gresta Paulino Murta: How the adoption of feature toggles correlates with branch merges and defects in open-source projects? (Software: Practice and Experience)"
    url: "https://arxiv.org/abs/2007.05760"
  - title: "Google Cloud: Incident Report for the June 12, 2025 service disruption"
    url: "https://status.cloud.google.com/incidents/ow5i3PPK96RduMcb1SsW"
---

A feature flag usually starts life with a plan. The new checkout ships switched off, turns on for internal users, then for 5 percent of customers, then for everyone. At that point the flag has done its job, and the `else` branch holds the old checkout, which nobody intends to run again. Six months later the flag is still there, still set to on, and the old checkout is still in the build. Nobody has run it since the rollout ended, and nothing stops someone from flipping it back.

Every flag you didn't remove is a branch you stopped testing.

I think flags get discussed almost entirely as a release technique, how to ship dark and roll out safely, when most of the trouble starts after the release is over. A feature flag is configuration with an expiry date. Most flags are created to be temporary, but removing one is a second change with no trigger, no reward, and often no owner left by the time it's due, so it rarely gets scheduled. A flag that outlives its purpose becomes permanent configuration without anyone deciding it should, and it's still tested the way a temporary flag is, in whichever state it happens to be in. The fix is to decide a flag's deadline and owner when it's created, the only moment when the person with the context also has a reason to care, and then let automation hold the team to it.

## A Flag at 100% Is an Untested Branch

While a flag is rolling out, both of its paths are live. Some users get the new behavior and some get the old, the team watches both, and the old path is the rollback plan. Once the flag reaches 100 percent, the old path serves nobody, and every reason to keep it working disappears with its users.

### Tests Follow the Configuration You Deploy

Meinicke, Wong, Vasilescu, and Kästner interviewed nine feature-flag experts for their 2020 study comparing feature flags with configuration options. They found that the common practice is to run the specific configurations about to be deployed through continuous integration, "while not performing any tests on any other configurations." None of the practitioners they spoke to tried to cover the whole configuration space. They regarded it as too expensive. Bugs in untested combinations, the authors note, "may remain undetected until an affected configuration is actually needed."

That's a sensible trade while a flag is young, because the deployed configurations change as the rollout moves and both states get exercised. It stops being sensible once the flag has been at 100 percent for months, because the configuration CI tests is now only the one in production. Pete Hodgson's article on feature toggles, published on Martin Fowler's site, recommends testing the production configuration plus the fallback with the new toggles off. That advice covers toggles being released. A toggle released long ago has no fallback anyone plans to use, so its off path drops out of the test plan without anyone deciding to drop it. The site's Testing Strategy Architecture guide makes the same point from the testing side, noting that each rollout flag left behind doubles the code paths that need testing.

The code on that path still changes, though. Refactors, library upgrades, and schema changes touch it along with everything else, and unless some test pins the flag off, nothing checks them against the configuration nobody runs.

### Knight's Off Path Broke Years Before It Ran

Knight Capital's 2012 trading loss usually gets told as the story of a repurposed flag. The SEC's order against the firm contains an earlier detail that matters more here. Knight stopped using a feature called Power Peg in 2003 and left the code on its production servers. In 2005, it moved a function that counted how many shares of an order had been filled, the check that told Power Peg to stop sending orders, to an earlier point in the code. "Knight did not retest the Power Peg code after moving the cumulative quantity function," the order says, "to determine whether Power Peg would still function correctly if called."

Power Peg's path was now broken, and nobody knew, because nothing ran it. Seven years later, new code for Knight's Retail Liquidity Program reused the flag that had once switched Power Peg on. A technician missed one of eight servers during deployment, and orders carrying the flag reached that server and ran the old code. Because the counter had moved, it sent child orders for each parent order without regard to how many shares had already been filled. In about 45 minutes it produced 4 million executions, and Knight lost $460 million.

The missed server and the repurposed flag set it off, but the code that ran had been broken for seven years, one flag value away from production traffic. The SEC's order names that too. In 2005, it says, Knight reused part of the Power Peg code in another application "without taking measures to safeguard against malfunctions or inadvertent activation."

## Why Removal Never Gets Scheduled

The people who use flags heavily agree that stale ones should go. Meinicke's interviewees agreed that release and experiment flags should be removed once the feature ships or the experiment ends, and the same study reports that removal of obsolete flags "was consistently identified as the key challenge for feature flags." Meinicke's team saw the same pattern in an earlier study by Rahman, Querel, Rigby, and Adams, whose 2016 case study of Google Chrome's toggles found that they let rapid releases coexist with long-running feature work but add technical debt and maintenance. In both, developers intended to remove flags and rarely did so consistently. The intent is there. The removal isn't, and the reasons are structural, not carelessness.

### The Trigger Arrives After the Author Has Moved On

A flag becomes removable at the end of a rollout, which is usually weeks after the work that created it. By then its author is on something else. One of Meinicke's interviewees described it directly: "you develop the feature or maybe just a bug fix, you wrap it into a flag, you deploy it, and then you start working on something else." When it could be removed months later, "it's very hard to think about, go back, and remove this one feature flag that wrapped five lines of code."

Sometimes the author has left entirely. Uber's engineers, writing about the Piranha tool they built to delete stale flags, found that because flags "were not cleaned up for a long period of time, determining ownership information for stale flags became problematic." Some of the engineers who created them had changed teams or left the company. Their paper names a category for these, orphaned flags, "whose owners have left the organization and the final status of the flag roll out is unclear." A new owner inherits a flag without knowing whether it's safe to remove, and leaving it alone looks like the careful choice.

### Removal's Cost Is Concrete and Its Benefit Is Diffuse

Removing a flag takes work someone can see and schedule. Two of Meinicke's interviewees described infrastructure where removing a flag took three steps, deleting the `if` statement, then the configuration settings, then the declaration, each through its own review and CI run. That turned "a seemingly simple removal process into a week-long tedium." Leaving the flag in costs nothing this sprint.

The benefit, a smaller codebase with fewer paths, is hard to point at. The interviewees said developers are "not required by policies or tools," and that "the short-term cost of removal is not offset by a clear long-term benefit of a simpler code base." One described identifying tens of thousands of flags that appeared unnecessary and removing "like 1% of the things that we identified," partly because they "couldn't really identify, in provable terms, how much does that matter." Uber's paper lists the same pressure among its reasons flags survive: "building newer features is usually better recognized and rewarded than reducing technical debt."

### One-Time Cleanups Don't Hold

Uber ran its cleanup tool against its Objective-C codebase in April 2018 and removed a large batch of flags. The debt "built up again in a few months," the authors write, and they had to run the tool again that October. That result is why they turned Piranha into a pipeline that runs weekly instead of a tool someone remembers to use.

Open-source projects show the same drift. A 2026 study by Xhevahire Tërnava of more than 4,000 toggle events in Kubernetes and GitLab found that removals trailed additions by roughly 35 percent in Kubernetes and 13 percent in GitLab, so the inventory grows over time. Kubernetes toggles lived a median of 734 days, against 185 in GitLab. A cleanup sprint lowers the count for a while. If nothing changes how flags are created, the count climbs back.

## Decide the Deadline When You Create the Flag

The moment a flag is created is the one moment when the person adding it knows why it exists, what "done" looks like, and who will own it. Every later moment has less of that context. So the decision about when the flag dies belongs in the change that creates it, not in a backlog item nobody will prioritize.

### Temporary or Permanent Is a Decision, Not an Outcome

Meinicke's team draws the line between flags and configuration options by lifetime. Configuration options "are usually intended to be permanent whereas feature flags are intended to be temporary," and they cite evidence that options are "often added but almost never removed." Technically, the two are the same thing, a value outside the code that picks a branch inside it. A flag nobody removes has crossed that line and become a configuration option, without anyone deciding it should be one or testing it as one.

Some flags belong on the permanent side from the start. A kill switch that lets operators turn off an expensive feature under load, or a permission flag that enables a feature for a premium tier, is configuration in the ordinary sense. Hodgson's catalog of toggle types, which the site's Deployment Strategies guide summarizes, separates these long-lived kinds from release and experiment toggles expected to last days or weeks. Unleash, an open-source flag service, builds the split into the product: release and experiment flags get an expected lifetime of 40 days, kill switch and permission flags are marked permanent, and Unleash marks a flag "potentially stale" once it passes its expected lifetime.

A permanent flag isn't the problem. A flag that drifted into permanence is. Every flag should land in one of two states, chosen when it's created and revisited when it's done.

| | Temporary flag | Permanent flag |
| --- | --- | --- |
| **Examples** | Release, rollout, experiment | Kill switch, permission, tier or region entitlement |
| **Deadline** | A removal date, set at creation | None, but a named reason it must stay |
| **Owner** | The author, and reassigned when the author moves | A team, not a person |
| **What gets tested** | Both states during rollout, then only the winner once the flag is removed | Both states, on every build, for as long as it exists |
| **Done when** | The branch and the flag are deleted from code and from the flag service | Never, so it's documented like any other setting |

A temporary flag past its date has two honest exits. Remove it, or reclassify it as permanent and start testing both of its states. Leaving it where it is, untested and unowned, is the one option the table doesn't offer.

### Enforcement Beats Intent

Uber's own recommendation, after eighteen months of running Piranha, was that "when a feature flag is created initially, the owner of the flag should also define an expiry date," and that reassigning ownership when a developer leaves "should become a standard task." Their pipeline treated a flag as stale when it hadn't been modified in the flag service for a period each team set, eight weeks for example. It generated the deletion as a code change, assigned it to the flag's owner as a review, and sent reminders. Most of those changes needed more than one reminder, but after a reminder, 86 percent landed within five days. Developers removed flags once the removal arrived as a review waiting for them rather than a task they had to remember.

Other organizations reach the same place with blunter tools. Meinicke's interviewees described teams that open an issue for a flag's creator when its lifetime expires, teams that cap the number of flags each team may have, and one organization that fails the build when it detects stale flags. The study reports that the stricter the removal process, the fewer problems interviewees had with flags, and that organizations without enforcement "reported that feature flags accumulate." Hodgson suggests a lighter version, a "time bomb" test that fails once a flag outlives its planned lifetime.

Each mechanism changes the default. Without one, a flag stays unless someone acts. With one, the flag gets removed, or someone decides in writing that it stays.

## The Evidence Is Incidents, Not Defect Rates

No study I found measures how many defects stale flags cause. A study of 949 open-source projects by Prutchi, Campos Junior, and Murta found that defects took longer to fix after projects adopted feature toggle frameworks, but the authors couldn't confirm the toggles caused the increase. Uber's paper lists reliability risks from unnecessary flag paths, and Knight shows how large the worst case can be. But the evidence for the cost of a single stale flag is mechanism and incident, not a measured rate. If long-lived flags turn out to cause very few defects compared with the flexibility they buy, the argument for strict deadlines weakens, and treating most long-lived flags as permanent configuration and testing both states would become the cheaper policy.

The flexibility they buy is substantial, too, so none of this argues for fewer flags. Google's incident report for its June 12, 2025 outage traced the failure to new code in Service Control that lacked error handling and hadn't been placed behind a flag: "If this had been flag protected, the issue would have been caught in staging." Google committed to requiring that all changes to critical binaries be "feature flag protected and disabled by default." A flag is how a team turns a risky deployment into a reversible one. The deadline is what keeps that safety from turning into years of untested code.

## Check Your Flags This Week

Pull the list from your flag service or search your code for flag checks, and answer these for each flag:

- **Is it older than 90 days?** That is more than twice the lifetime Unleash assumes for a release flag, and far past Hodgson's week or two, so a release flag at 90 days is either late or permanent without a decision.
- **Who owns it?** Not who created it, but who would answer if it misbehaved today. A flag whose owner has left needs a new owner before anything else.
- **Is it temporary or permanent?** Write the answer down. A temporary flag needs a removal date, and a permanent one needs a reason.
- **For a permanent flag, does CI test both states?** If the off path hasn't run since the rollout, it's the untested branch this post is about.
- **For a temporary flag at 100 percent, is its removal open?** If not, open it now, as a change assigned to the owner, not a ticket in the backlog.

Then change how the next flag gets made. Require an owner and a removal date when a flag is created, and pick one enforcement mechanism, whether a stale-flag report, a time-bomb test, or a cap per team, so that removal doesn't depend on anyone remembering.
