---
layout: post
title: "Postmortems Should Find Decisions, Not Root Causes"
description: "A root cause names the component that broke, and that component rarely breaks the same way twice. The decisions that put it in the path of load, trust, and release keep producing incidents until someone changes them, so a postmortem should record those decisions as they looked when they were made and aim its action items at the rules behind them."
tags: [incident-response, postmortems, reliability, decision-making, production]
author: steven-stuart
sources:
  - title: "Site Reliability Engineering: Postmortem Culture: Learning from Failure"
    url: "https://sre.google/sre-book/postmortem-culture/"
  - title: "Site Reliability Engineering: Example Postmortem"
    url: "https://sre.google/sre-book/example-postmortem/"
  - title: "Richard I. Cook: How Complex Systems Fail"
    url: "https://how.complexsystems.fail/"
  - title: "Microsoft: Helping our customers through the CrowdStrike outage"
    url: "https://blogs.microsoft.com/blog/2024/07/20/helping-our-customers-through-the-crowdstrike-outage/"
  - title: "CrowdStrike: External Technical Root Cause Analysis, Channel File 291"
    url: "https://www.crowdstrike.com/wp-content/uploads/2024/08/Channel-File-291-Incident-Root-Cause-Analysis-08.06.2024.pdf"
  - title: "CrowdStrike: Falcon Content Update Preliminary Post Incident Report"
    url: "https://www.crowdstrike.com/en-us/blog/falcon-content-update-preliminary-post-incident-report/"
  - title: "John Allspaw: The Infinite Hows (or, the Dangers of the Five Whys)"
    url: "https://www.kitchensoap.com/2014/11/14/the-infinite-hows-or-the-dangers-of-the-five-whys/"
  - title: "Sidney Dekker: The Field Guide to Understanding 'Human Error'"
    url: "https://www.routledge.com/The-Field-Guide-to-Understanding-Human-Error/Dekker/p/book/9781472439055"
  - title: "John Allspaw: Blameless PostMortems and a Just Culture"
    url: "https://www.etsy.com/codeascraft/blameless-postmortems"
---

The root cause was a silent thread deadlock in the AWS SDK for .NET. That's what I recorded as the cause of the outage it led to, and it's accurate. A background credential refresh in version 4 of the SDK's core library deadlocked under concurrent load, starved the thread pool, and took our authentication service down without an exception or a log line. But the lessons I drew afterward aren't about the deadlock. They're about a decision to skip load testing for the one vendor we trusted, and about how I ran the investigation. The deadlock was AWS's to fix, and they fixed it. The decisions were ours, and they were the only part of the incident we could change.

Complex-systems researchers have argued since at least the late 1990s that incidents don't have a single root cause, and widely used postmortem templates, Google's among them, still ask for one. My argument is that a postmortem should look for decisions instead: what someone chose, under what pressure, with what information, and what the choice bought. A root cause tends to name a component, and that component rarely fails the same way twice. The decisions that put it in the path of load, trust, and release keep producing incidents until someone changes them.

## A Root Cause Names the Part That Broke

### The Template Asks for One Cause

The postmortem chapter of Google's SRE book, by John Lunney and Sue Lueder, describes a postmortem as a written record of an incident, its impact, the actions taken to resolve it, "the root cause(s)," and the follow-up actions. The book's example postmortem fills that field with "Cascading failure due to combination of exceptionally high load and a resource leak when searches failed due to terms not being in the Shakespeare corpus." Even Google's example root cause is a combination of two conditions, neither of which took the service down alone.

Richard Cook's "How Complex Systems Fail," written between 1998 and 2000 at the University of Chicago's Cognitive Technologies Laboratory, made the general case. Its seventh point is that "there is no isolated 'cause' of an accident," because an accident needs multiple contributors, each "necessarily insufficient in itself." Cook argues that root-cause evaluations reflect "the social, cultural need to blame specific, localized forces or events for outcomes" rather than a technical understanding of failure. In software, the most localized force available is a component. A resource leak, a deadlock, or an unvalidated field fits in one box on the form, which makes it the easiest thing to put there.

### Fixing the Part Doesn't Prevent the Next Incident

Fixing the component is necessary, since it ends this incident. What it doesn't do is make the next one less likely. Cook's fifteenth point is that remedies aimed at the end of the chain "do little to reduce the likelihood of further accidents," because "the likelihood of an identical accident is already extraordinarily low." The latent defects in a system change constantly. Pinning the SDK version protected us from a deadlock AWS had already fixed. It did nothing about the next package upgrade that would behave differently under production concurrency than in a regression suite.

### Finding the Mechanism Is Still the Responder's Job

This doesn't mean responders should stop tracing from symptom to mechanism. During an incident, following the chain from failing requests to an exhausted thread pool to the code that blocked it is how you find what to roll back or patch. Stopping short restores service without knowing why it broke.

A postmortem asks a different question. It asks why the system was arranged so that this defect could reach production and hurt this much, and a mechanism rarely answers it. The review looks for the conditions that allowed the incident, not the person who clicked. A defective component is one of those conditions. The choices about testing, rollout, and dependency that let the defect matter are the rest of them.

## Decisions Are What Recur

### CrowdStrike Fixed a Field Count and a Rollout Rule

On July 19, 2024, at 04:09 UTC, CrowdStrike delivered a content update to its Falcon sensor that crashed Windows hosts. CrowdStrike reverted it 78 minutes later. Microsoft estimated the next day that it had affected 8.5 million Windows devices.

CrowdStrike's root cause analysis, published on August 6, traces the crash to a count mismatch. A new interprocess-communication Template Type defined 21 input fields, while the sensor code that fed it supplied 20. Earlier content had used a wildcard for the 21st field, so nothing read it. The July 19 content used a specific match on that field, and the sensor read past the end of its input array. The Content Validator missed it because of a logic error of its own. Most of the report's findings and mitigations address those parts: validate the field count at compile time, add a bounds check in the interpreter, add checks to the validator.

The same documents also record decisions, though. The root cause analysis describes Rapid Response Content as "configuration data; it is not code or a kernel driver." The preliminary report explains why the July 19 content went to production: "Based on the testing performed before the initial deployment of the Template Type (on March 05, 2024), trust in the checks performed in the Content Validator, and previous successful IPC Template Instance deployments, these instances were deployed into production." The analysis's sixth finding reads as a policy rather than a mechanism: "Each Template Instance should be deployed in a staged rollout." Its mitigation added canary testing, deployment rings with bake time between them, and customer control over when content updates arrive.

The field count can't recur now that the sensor validates it. The decision about which kinds of change need a staged rollout applied to every content update CrowdStrike shipped, and it's the finding whose fix protects against defects nobody has found yet.

### A Track Record Became a Skipped Check

The reasoning in CrowdStrike's preliminary report has the same shape as the decision behind my own outage. We had upgraded AWS SDK packages about 30 times without incident, and that record made them the only packages exempt from the changelog review and load testing we applied to every other dependency. In both cases a history of successful changes turned into a rule that skipped a check.

Cook's tenth point is that "all practitioner actions are gambles," and that "successful outcomes are also the result of gambles," a fact he says isn't widely appreciated. A run of successful gambles is how a rule like "trusted packages skip load tests" forms. It rarely gets written down as a risk, because every result so far has confirmed it. It stays in force after the incident's defect is patched, so the next upgrade takes the same gamble.

### The SDK Outage Held More Decisions Than Its Lessons Named

A decision was made at a point in time, by someone in a role, with the information and pressure they had then, and it can be made again differently. My own outage contains more of them than my lessons named. The authentication service validated every request with a fresh DynamoDB read, which made it the hottest path in the system and the one the deadlock hit first. The release upgraded packages across roughly 20 APIs at once, so the rollback had to take all of them back, and that blocked a feature we had just started selling. Each was a defensible call when it was made, and each shaped how much a vendor's bug could hurt. A postmortem that records "SDK deadlock" as the root cause captures none of them.

## Three Guards Keep a Decision Review From Becoming Blame

The obvious objection is that a decision has a decider. John Allspaw's critique of the five whys warns that "asking 'why?' too easily gets you to an answer to the question 'who?'" A review that asks who decided to skip the load test risks the same slide. If decision-focused reviews turn into a search for the person who chose wrong, they're worse than root-cause reviews, because they swap a faulty component for a faulty person. Three guards keep the review on the decision.

### Judge the Decision by What Was Known Then

Cook's eighth point is that hindsight makes the events leading to an outcome seem "more salient to practitioners at the time than was actually the case." Sidney Dekker's *The Field Guide to Understanding 'Human Error'* builds its method on the principle of local rationality. People do what makes sense to them given their goals, their knowledge, and where their attention is. Allspaw's 2012 post on blameless postmortems at Etsy turned this into practice. Engineers give detailed accounts of what actions they took, what effects they observed, what they expected, what assumptions they made, and their understanding of the timeline, "without fear of punishment or retribution."

That list is already a decision record, and Cook, Dekker, and Allspaw built it. What changes here is where the record goes: into the field that asks for a cause, and into action items aimed at the decision. The one step to add to the list is what the decision bought. Exempting AWS packages from load tests saved the changelog reviews and load tests we'd otherwise have run on 30 upgrades, and a review that can't say what a decision bought hasn't understood why anyone made it. Writing down the benefit alongside the cost keeps the review honest about the trade, and it makes the eventual change a choice to pay for something rather than a correction of someone's mistake.

### Look for Decisions Made Away From the Incident

Cook's eleventh point is that organizations are "ambiguous, often intentionally," about how production targets, costs, and acceptable risks relate, and that practitioners resolve that ambiguity in the moment. Afterward their actions look like errors, in evaluations that "ignore the other driving forces, especially production pressure." The July 19 deployment happened inside a classification of content as configuration, and inside a release process that got deployment rings only after the incident. The team that skipped our load test was following a rule about trusted vendors. Looking for decisions, rather than a cause, pulls the review upstream toward the policies and priorities that framed the people in the incident.

### Aim the Action Items at the Rule

An action item that names a person ("be more careful with SDK upgrades") is a sign the review has turned into blame. An action item that names a rule changes the decision for everyone who'll face it next. Dependency upgrades that touch the hottest path get a load test, and every content type goes through the same rollout rings as code. The first kind depends on one person remembering. The second holds after that person moves to another team.

## Not Every Contributor Is a Decision

A vendor's bug, a latent defect that has sat in the code for years, and an interaction between two components that nobody designed aren't decisions, and a review shouldn't force them into that shape. Cook's fourth point is that complex systems always contain "changing mixtures of failures latent within them." Those contributors belong in the postmortem as context. They explain what happened without giving the team anything to change. The decisions around them do: what got tested before release, how the change rolled out, and what depended on what. Those decide how far a latent defect can reach.

## Replacing the Root Cause Field

The two incidents in this post read differently depending on which field the template asks for.

| Incident | Root cause field | Decisions that shaped it |
| --- | --- | --- |
| AWS SDK outage | Deadlock in the SDK v4 credential refresh under concurrent load | AWS packages exempt from load tests after about 30 clean upgrades; auth reading DynamoDB on every request; one release upgrading roughly 20 APIs together |
| CrowdStrike, July 19, 2024 | Template Type defined 21 input fields while the sensor supplied 20 | Rapid Response Content classified as configuration data; deployment justified by March testing, trust in the validator, and earlier successful instances; staged rollout for each instance added only afterward |

Both defects in the middle column have since been fixed.

This week, open your postmortem template and replace the "root cause" field with "decisions that shaped this." For each decision, record:

- What was decided, and roughly when
- What it bought at the time, such as release speed, lower cost, or a simpler design
- What the people deciding knew, and what pressure they were under
- Whether it's a standing rule or a one-time call
- What would change it, and who owns that change

Then go back to your most recent postmortem. If its root cause names a component, ask which decisions put that component in the path of the failure. The defect in that component is probably fixed already. The decisions around it are likely still in force, and the next incident will probably pass through at least one of them.
