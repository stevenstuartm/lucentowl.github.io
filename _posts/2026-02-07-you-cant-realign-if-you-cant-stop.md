---
layout: post
title: "Planning for Plan Continuation Bias: How to Keep Building the Right Thing"
date: 2026-02-07
description: "Most software projects go wrong by drifting out of alignment with the need, the tradeoffs, and the risk. Realigning requires stopping, and since plan continuation bias keeps planning, discovery, coding, and testing from stopping, the fix is to build stops into the work instead of waiting to notice."
tags: [plan-continuation-bias, alignment, decision-making, cognitive-bias, software-development]
author: steven-stuart
sources:
  - title: "Orasanu, Martin and Davison: Errors in Aviation Decision Making (NASA Ames Research Center)"
    url: "https://ntrs.nasa.gov/api/citations/20020063485/downloads/20020063485.pdf"
  - title: "NTSB Safety Study SS-94/01: A Review of Flightcrew-Involved Major Accidents of U.S. Air Carriers, 1978 through 1990"
    url: "https://www.ntsb.gov/safety/safety-studies/Documents/SS9401.pdf"
  - title: "Barry M. Staw: Knee-Deep in the Big Muddy (Organizational Behavior and Human Performance, 1976)"
    url: "https://doi.org/10.1016/0030-5073(76)90005-2"
  - title: "Ken Schwaber and Jeff Sutherland: The Scrum Guide (2020)"
    url: "https://scrumguides.org/scrum-guide.html"
  - title: "Ryan Singer: Shape Up (Basecamp)"
    url: "https://basecamp.com/shapeup"
  - title: "Pomodoro Technique"
    url: "https://en.wikipedia.org/wiki/Pomodoro_Technique"
  - title: "Peter F. Drucker: The Effective Executive (1967)"
    url: "https://en.wikipedia.org/wiki/The_Effective_Executive"
---

Most software projects that go wrong go wrong through misalignment. They solve a need nobody had, accept tradeoffs nobody weighed, or carry risks nobody examined. Alignment isn't a phase that ends when the work starts. Every plan, discovery, commit, and test is a chance for the work to drift away from what it was meant to accomplish, and a chance to pull it back.

Pulling it back requires something most advice skips over. You have to stop. For years, I couldn't. When a better idea surfaced mid-implementation, my first instinct wasn't to evaluate it but to finish what I was doing, and by the time I finished, the switching costs had mounted and the moment for cheap redirection had passed. It was rarely pride, just a pre-rational impulse to proceed, as though stopping mid-stride carried some cost that continuing didn't.

What changed it for me was learning to think about work in terms of business value and to treat my own direction as an assumption to test rather than a plan to complete. I stopped being a code cowboy. The impulse didn't disappear, though, and it isn't mine alone. It has a formal name, and it explains why realignment fails far more often than any process expects it to.

## Continuing Wins Because It Takes Less Thought

Pilots call it get-there-itis. Researchers call it plan continuation bias. Judith Orasanu and colleagues at NASA's Ames Research Center went through the tactical decision errors in the 37 accidents covered by the NTSB's 1994 review of flightcrew-involved major accidents. Of the 51 tactical decision errors in that corpus, 38 were decisions to continue the original plan despite cues suggesting a different course of action. These weren't errors of skill or knowledge; they were errors of continuation.

Orasanu's team locates the cause in effort rather than stubbornness. Revising your understanding of a situation and working out a new course of action costs more cognitive work than continuing with a plan whose details are already settled, and people are more often than not cognitive misers who take the cheap operation when it's available. Workload, time pressure, and ambiguous signals all shrink the budget for the expensive operation at exactly the moment it's needed. It is not that the original plan wins the argument; it wins by default by never having to have an argument.

The stakes don't transfer to software, but the mechanism does. A pilot pressing into weather has minutes and no undo, and the one who continues and survives gets a fright that recalibrates them. A developer pressing on with the wrong approach gets no such warning. The mistake plays out over weeks, git can undo any of it, and the work ends the way good work does, reviewed and merged. The pilot who got away with it at least knows it was close. The developer never learns there was anything to get away with, so the software version of the bias rarely corrects itself.

Our own advice makes it worse. "Finish what you started" is plan continuation bias repackaged as a character virtue. It assumes that what you started should be finished, which is exactly the question the bias keeps you from asking. "Think before you act" assumes the thinking was sound, and once you've thought and decided, the decision has inertia. The problem was never acting without thinking. It's acting without *reconsidering*.

## The Impulse Shows Up at Every Stage

Each stage of software work has its own version of the impulse, and each one lets the work drift a little further from the need before anyone looks up. Planning and discovery are the worst offenders, because the decisions made there shape everything built afterward, and their misalignment stays invisible the longest.

### Planning: The First Workable Design Becomes the Plan

A plan is supposed to come from weighing options against the need, the tradeoffs, and the risk. Under the impulse, the plan is the first design that seemed workable, and the weighing never happens. Once that design is written into tickets, estimates, and a roadmap, it has momentum before a line of code exists. A team that sketches a synchronous integration in a kickoff meeting, estimates it, and schedules it rarely circles back to ask whether its behavior under failure fits the business's tolerance for delay. Questioning it now means reopening commitments other people rely on, so the plan proceeds unchallenged and its misalignment ships inside every task built from it.

### Discovery: New Information Gets Filed as "Later"

Discovery is when the work learns something the plan didn't know: a requirement nobody mentioned, a constraint in a system you integrate with, users who behave differently than assumed. That is the moment realignment exists for, and it's the moment the impulse is strongest, because acting on the discovery means stopping work already in motion. So the discovery becomes a follow-up ticket, a tech-debt item, or a note for the retrospective. It's acknowledged without being acted on, and the work continues against a picture of the need that is now known to be wrong.

### Coding: "Let Me Just Get This Working First"

This is the version I see most in newer developers, and they make it constantly. Finishing first and then reevaluating sounds like sequencing rather than avoidance. You would still weigh the other approach, just with one finished thing behind you instead of two unfinished ones. Then you spend another hour building out the current approach. You write tests around it. Other code starts depending on it. A colleague reviews it and builds understanding of how it works. At that point, "considering the other approach" means throwing away not just your work but the organizational investment in reviewing, understanding, and integrating what you've built.

The impulse to finish manufactures the very sunk costs that now appear to justify not switching. That is what makes the bias self-sealing. Ordinary sunk-cost reasoning is a mistake about money you already spent. This one spends it on purpose, then cites the receipt.

Barry Staw's 1976 study Knee-Deep in the Big Muddy found that people who feel personally responsible for an initial decision commit more resources to it when it starts failing, not fewer. Among participants who received the same news of failure, the ones who had made the original decision themselves invested more, which means the escalation tracked authorship of the decision rather than evidence about the decision. In software, this looks like the developer who spends two more days making a questionable approach work rather than thirty minutes evaluating whether a different approach would have been simpler from the start.

### Testing: Proving Instead of Testing

Proving asks "can I make this work?" and the answer is almost always yes given enough effort. Testing asks "should I be making this work?" and that's the question alignment depends on. The impulse turns testing into proving. Tests written after the approach is settled check that the code does what its author intended, and rarely whether what the author intended is what the need required. A green suite then reads as confirmation of the direction, when all it confirmed was the implementation. The current assumption gets the full weight of implementation and verification, while the alternative gets a hypothetical conversation, maybe, later, if there's time.

## Momentum Feels Like Validation

The group version is worse, and it doesn't work the way most people assume.

The familiar picture of groupthink is dissent being actively suppressed. That happens, but a subtler and more passive version does the same damage. Nobody explicitly validated the direction. Nobody consciously suppressed alternatives. Everyone just assumed that someone else must have validated it, and the group's momentum itself became evidence that the direction is correct.

This shares something with the bystander effect, where responsibility diffuses until nobody acts, but it runs a step further. In the bystander case, the crowd's inaction is the reason nobody moves. Here, the crowd's motion is treated as evidence that moving is correct. Diffused responsibility explains why nobody checked. Momentum read as confirmation explains why nobody felt the need to.

Each person on the team is locked into "finish what I'm doing" while treating the group's momentum as confirmation that the direction is right. Questioning the direction doesn't just feel unproductive. It feels like you're slowing the team down, which in most team cultures marks you as the obstacle rather than the one asking the right question. From the inside, speed is indistinguishable from conviction.

Orasanu's team found the same thing outside the cockpit. Alongside ambiguous conditions, they named organizational and socially-induced goal conflicts as the second context that contributes to plan-continuation errors, and they aimed their recommendation at companies rather than pilots: stand behind the crew that takes the slower, safer course, even when it costs something. So the group is more than a second instance of the bias. It's one of the two conditions that feed it.

## Process Decides Which Direction Is Free

Every method for keeping work aligned assumes that when discovery arrives, someone will notice and act. Aligning before committing and realigning after discovery produce better outcomes, but a process can only act on a discovery that someone registered as a discovery. The best of them lower the cost of changing course once the signal lands. None of them do the registering for you.

### Interval-Based Process Puts Correction at the Far End

Any cadence that commits a group to a scope for a fixed window places the sanctioned moment for changing direction at the end of that window. In a two-week sprint, the review is the official place to say the plan was wrong, and by the time it arrives two weeks of sunk cost have accumulated. The correction point sits exactly where the bias is strongest.

Scrum is not blind to this. The Scrum Guide lets a Product Owner cancel a sprint, and the sprint boundary is itself a replanning point. But cancellation is the emergency lever rather than the routine one, and the daily standup, as many teams run it, has each person report progress against work already committed, which quietly rewards continuation every morning. That is a property of interval-based commitment generally rather than a defect specific to Scrum, and it is part of what the framework trades away for the predictability that makes it useful.

### Some Processes Make Stopping the Default

Basecamp's Shape Up is organized around three moves that make a discovery cheaper to act on. A circuit breaker means unfinished work expires by default instead of receiving an extension, so stopping requires no argument from anyone. An appetite fixes the time and varies the scope, which makes dropping part of a plan an ordinary decision rather than an admission of failure. Shaping before committing means less has been invested at the moment the "this isn't right" signal arrives, giving the signal a chance to compete with momentum.

A sprint and a circuit breaker are both team-level mechanisms, and they pull in opposite directions. The sprint makes finishing the default, so stopping has to be argued for. The circuit breaker makes expiry the default, so continuing has to be argued for. What matters about a process is which of the two directions it makes free. Adding ceremonies on top of a default-continue structure just creates more places to report progress against work already committed.

Structure also can't catch everything. Circuit breakers trip at defined boundaries. They don't catch the smaller discoveries that arrive between them, the "this approach isn't quite right" signal on a Tuesday afternoon that gets overridden by the impulse to finish first.

## What Helps When Awareness Isn't Enough

Knowing about the bias doesn't prevent it, because the impulse operates faster than reflection. What worked for me wasn't trying harder to notice. It was changing what I thought the work was. Once each task was a bet on delivering some business value, my approach to it became an assumption about how to deliver that value, and assumptions get tested. A plan you treat as a commitment pulls you toward finishing it. A plan you treat as an assumption pulls you toward checking it.

### Stopping Is the Cheapest Available Action

For most people, stopping feels like failure or waste. You were making progress and now you're not. But evaluation is almost always cheaper than building more on a flawed foundation, and seeing it that way changes the emotional calculus even when the impulse is still there.

### Low Switching Costs Keep the Signal Audible

The impulse draws power from switching costs that accumulate with every hour of continued execution. The less you've invested, the easier it is to hear the signal telling you to change direction. Cheap experiments before commitment, small commits, well-defined interfaces, and feature flags all keep the cost of being wrong low for as long as possible.

### A Fixed Rhythm Beats Waiting for Permission

The natural objection is that questioning costs working hours that would otherwise ship something. Context switching is expensive, and developers invoke this constantly. But four hours of uninterrupted coding on a misunderstood problem doesn't produce the right solution, and the context-switching argument can't tell that case apart from the one where the four hours were well spent. Breaking focus on work you understood throws away context you had built. Breaking focus on work you hadn't examined throws away nothing you would want to keep.

The Pomodoro technique was designed for productivity, but it accidentally created the kind of permission structure this bias requires. Every 25 minutes, you stop. Not because something went wrong, but because the rhythm demands it. That forced pause is a moment where "am I still working on the right thing?" can surface without the social or psychological cost that usually prevents reassessment. The number doesn't matter. What matters is that stopping becomes part of the rhythm rather than an interruption of it.

### The Stop Test

Four countermeasures work against the impulse:

- Treat your direction as an assumption about value, not a commitment to finish
- Keep switching costs low through small commits, feature flags, and shaping work before committing to it
- Build external pause points like circuit breakers and checkpoints that don't depend on self-awareness
- Stop on a fixed rhythm instead of waiting for permission to reconsider

The pause only helps if something happens inside it. The stop test is three questions that fit in the gap:

- **Am I proving or testing?** Proving asks whether this can be made to work. Testing asks whether it should be.
- **Is switching getting more expensive while I keep going?** Compare what you would throw away by switching now with what you would have thrown away an hour ago. If that pile keeps growing while the doubt sits unresolved, you are building the sunk cost that will later argue against switching, and the cheap moment to change course is slipping away.
- **If I hadn't already started, would I choose this approach today?** This is Peter Drucker's question from The Effective Executive, "If we did not already do this, would we go into it now?", scaled down from a program to a single task. A no here is the entire signal. Everything after it is negotiation with sunk cost.

## Alignment Depends on the Ability to Stop

You can't realign after discovery if you can't stop long enough to receive the discovery. You can't weigh a tradeoff you never paused to see, or catch a risk while you're busy proving the approach works. Alignment isn't something you achieve at kickoff. You recover it at every plan, discovery, commit, and test, and each recovery starts with a stop.

So the work isn't only to try harder at noticing. Noticing is the unreliable part, because the impulse moves faster than any effort to notice. The work is to arrange things so that stopping doesn't wait on noticing: rhythms that pause whether or not anything looks wrong, boundaries that expire on their own, commitments small enough that changing your mind costs less than defending it. Build those, and the moment you would otherwise have missed arrives on a schedule that isn't yours to override.
