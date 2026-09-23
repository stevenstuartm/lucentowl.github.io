---
layout: post
title: "Plan Continuation Bias: Why We Keep Building the Wrong Thing"
date: 2026-02-07
description: "Every software development methodology assumes that when discovery arrives, someone will notice it and act. Plan continuation bias is the pre-rational impulse that prevents exactly that."
tags: [plan-continuation-bias, decision-making, leadership, cognitive-bias, software-development]
author: steven-stuart
sources:
  - title: "FAA Safety Briefing: CFIT and Plan Continuation Bias"
    url: "https://www.faa.gov/newsroom/safety-briefing/cfit-and-plan-continuation-bias"
  - title: "Orasanu, Martin and Davison: Errors in Aviation Decision Making (NASA Ames Research Center)"
    url: "https://ntrs.nasa.gov/api/citations/20020063485/downloads/20020063485.pdf"
  - title: "NTSB Safety Study SS-94/01: A Review of Flightcrew-Involved Major Accidents of U.S. Air Carriers, 1978 through 1990"
    url: "https://www.ntsb.gov/safety/safety-studies/Documents/SS9401.pdf"
  - title: "AOPA Air Safety Institute: VFR into IMC Avoidance and Escape"
    url: "https://www.aopa.org/training-and-safety/air-safety-institute/vfr-into-imc-avoidance-and-escape"
  - title: "Barry M. Staw: Knee-Deep in the Big Muddy (Organizational Behavior and Human Performance, 1976)"
    url: "https://doi.org/10.1016/0030-5073(76)90005-2"
  - title: "Ryan Singer: Shape Up (Basecamp)"
    url: "https://basecamp.com/shapeup"
  - title: "Pomodoro Technique"
    url: "https://en.wikipedia.org/wiki/Pomodoro_Technique"
---

Something is broken in my approach to problem-solving, and I suspect it's broken in yours too.

When I'm mid-implementation and a better idea surfaces, my first instinct isn't to evaluate it; it's to finish what I'm doing. Not because I've weighed the alternatives and made a conscious choice to stay the course. I just can't seem to stop. The impulse to complete what's in front of me overrides the signal to reconsider, and by the time I've finished, the switching costs have mounted and the moment for cheap redirection has passed.

It's rarely pride, just a pre-rational impulse to proceed before changing direction, as though stopping mid-stride carries some invisible cost that continuing doesn't.

## A Bias Faster Than Reflection

This pattern has a name. In aviation, the FAA calls it get-there-itis. In cognitive science, the broader phenomenon is plan continuation bias. Judith Orasanu and colleagues at NASA's Ames Research Center went through the tactical decision errors in the 37 accidents covered by the NTSB's 1994 review of flightcrew-involved major accidents. Of the 51 tactical decision errors in that corpus, 38 were decisions to continue the original plan despite cues suggesting a different course of action. These weren't errors of skill or knowledge; they were errors of continuation.

The general-aviation version is starker. When a pilot flying under visual rules presses on into weather that requires instruments, the AOPA Air Safety Institute puts the fatality rate for non-commercial fixed-wing aircraft at 86%. Most pilots who continue don't crash. The ones who do rarely walk away. And these aren't untrained pilots. About a third of those accidents involve instrument-rated pilots, who had both the skill to fly those conditions and the training to recognize them.

The mechanism explains why awareness alone isn't enough. Orasanu's team locates it in effort rather than stubbornness. Revising your understanding of a situation and working out a new course of action costs more cognitive work than continuing with a plan whose details are already settled, and people are cognitive misers who take the cheap operation when it's available. Workload, time pressure, and ambiguous signals all shrink the budget for the expensive operation at exactly the moment it's needed. The original plan doesn't win the argument. It wins by never having to have one.

The aviation numbers are evidence about the bias, not about software. A pilot pressing into weather has minutes, one attempt, and no undo. A developer pressing on with the wrong abstraction has a git history and, usually, weeks. What transfers is the mechanism, because continuing is cheaper to think about than reconsidering in both cases. What doesn't transfer is the stake, and that asymmetry is why the software version teaches you less. The pilot who continues and survives gets a fright that recalibrates them. The developer who continues and ships gets a merged pull request.

## "Let Me Just Get This Working First" Manufactures the Sunk Cost

Finishing first and then reevaluating sounds like sequencing rather than avoidance. You would still weigh the other approach, just with one finished thing behind you instead of two unfinished ones. Then you spend another hour building out the current approach. You write tests around it. Other code starts depending on it. A colleague reviews it and builds understanding of how it works. All the while, you're sinking deeper into an approach that hasn't yet proven it's the right one. At that point, "considering the other approach" means throwing away not just your work but the organizational investment in reviewing, understanding, and integrating what you've built.

The impulse to finish manufactures the very sunk costs that now appear to justify not switching. That is what makes the bias self-sealing. Ordinary sunk-cost reasoning is a mistake about money you already spent. This one spends it on purpose, then cites the receipt.

This is the difference between proving and testing. Proving asks "can I make this work?" and the answer is almost always yes given enough effort. Testing asks "should I be making this work?" and that's the question that actually matters. When someone says "let me just get this working first," they're proving, not testing. They want to see their assumption become real before they'll allow a competing idea to be evaluated. The current assumption gets the full weight of implementation effort while the alternative gets a hypothetical conversation, maybe, later, if there's time.

Barry Staw's 1976 study Knee-Deep in the Big Muddy found that people who feel personally responsible for an initial decision commit more resources to it when it starts failing, not fewer. Personal responsibility was the variable he manipulated, which means the escalation tracked authorship of the decision rather than evidence about the decision. The instinct isn't to cut losses. It's to double down, as though additional effort can retroactively make the original decision correct. In software, this looks like the developer who spends two more days making a questionable approach work rather than spending thirty minutes evaluating whether a different approach would have been simpler from the start.

## When the Herd Feels Like Validation

The group version is worse, and it doesn't work the way most people assume.

In classic groupthink, dissent is actively suppressed. People silence themselves, or are silenced, because the group demands conformity. That happens, but the more common version is subtler and more passive. Nobody explicitly validated the direction. Nobody consciously suppressed alternatives. Everyone just assumed that someone else must have validated it, and the group's momentum itself became evidence that the direction is correct.

This shares something with the bystander effect, where responsibility diffuses until nobody acts, but it runs a step further. In the bystander case, the crowd's inaction is the reason nobody moves. Here, the crowd's motion is treated as evidence that moving is correct. Diffused responsibility explains why nobody checked. Momentum read as confirmation explains why nobody felt the need to. And even when nobody confirmed anything, the sheer mass of collective effort makes the direction feel too established to question.

This compounds with individual plan continuation bias. Each person on the team is locked into "finish what I'm doing" mode while simultaneously treating the group's momentum as confirmation that the direction is right. The herd moving fast feels like progress. Questioning the direction doesn't just feel unproductive. It feels like you're slowing the team down, which in most team cultures marks you as the obstacle rather than the one asking the right question.

The result is collective plan continuation bias. Individuals who can't self-interrupt, operating inside a group that punishes interruption. From the inside, speed is indistinguishable from conviction.

Orasanu's team found the same thing outside the cockpit. Alongside ambiguous conditions, they named organizational and socially-induced goal conflicts as the second context that produces plan-continuation errors, and they aimed their recommendation at companies rather than pilots: stand behind the crew that takes the slower, safer course, even when it costs something. The group isn't a second instance of the bias. It's one of the two conditions that reliably produce it.

## When Good Advice Reinforces the Bias

The bias runs deep enough that even our corrective wisdom reinforces it.

"Think before you act." Sound advice, except it assumes the thinking was sound. The bias doesn't care whether you thought first; it cares that you committed to a direction. Once you've thought and decided, the decision has inertia. You thought, you chose, you proceeded, even if the thought was wrong. The problem was never acting without thinking. It's acting without *reconsidering*.

"Finish what you started." This is plan continuation bias repackaged as a character virtue. Discipline means following through, and quitting means weakness. The advice assumes that what you started should be finished, which is exactly the question the bias prevents you from asking. Persistence is genuinely valuable when the direction is right. When the direction is wrong, persistence is just the bias wearing a respectable disguise.

"The first step to recovery is admitting you have a problem." In principle, yes. But notice what the phrasing assumes. "Admitting" implies you already know and just need to say it out loud. The actual first step is *recognizing* you have a problem, and recognition is exactly what the bias blocks. The crews in those NTSB accidents didn't refuse to admit they were flying into dangerous conditions. They didn't register it as dangerous in the first place. Recognition is the prerequisite that admitting takes for granted.

Each of these lessons skips past the moment where you stop, reassess, and recognize that the current direction might be wrong. They treat that moment as though it happens automatically, as though thinking, persisting, and acknowledging are the hard parts. They aren't. Stopping is the hard part, and our collective wisdom doesn't just fail to address it. It actively discourages it.

## Every Methodology Assumes Someone Will Notice

I've written extensively about values-driven development, about aligning before committing, about realigning after discovery. I believe that better disciplines produce better outcomes, and they do. But a process can only act on a discovery that someone registered as a discovery. The best of them lower the cost of changing course once the signal lands. None of them do the registering for you.

Think about what "realign after discovery" actually requires. When new information surfaces mid-implementation, someone needs to notice it, recognize its significance, stop the current execution, communicate the discovery, and reconsolidate the agreement. Every step in that sequence is an interruption of momentum. At every step, plan continuation bias pulls in the opposite direction: keep going, finish what you started, evaluate later.

### Interval-Based Process Puts Correction at the Far End

Any cadence that commits a group to a scope for a fixed window places the sanctioned moment for changing direction at the end of that window. In a two-week sprint, the review is the official place to say the plan was wrong, and by the time it arrives two weeks of sunk cost have accumulated. The correction point sits exactly where the bias is strongest.

Scrum is not blind to this. A Product Owner can cancel a sprint, and the sprint boundary is itself a replanning point. But cancellation is the emergency lever rather than the routine one, and the daily standup asks each person to report progress against work already committed, which quietly rewards continuation every morning. The structure makes continuing unremarkable and stopping conspicuous. That is a property of interval-based commitment generally rather than a defect specific to Scrum, and it is part of what the framework trades away for the predictability that makes it useful.

### Methodologies Can Lower the Cost of Being Wrong, Not the Impulse

What a process can do is make the discovery cheaper to act on when it lands. Basecamp's Shape Up is organized around three moves that do this. A circuit breaker means unfinished work expires by default instead of receiving an extension, so stopping requires no argument from anyone. An appetite fixes the time and varies the scope, which makes dropping part of a plan an ordinary decision rather than an admission of failure. Shaping before committing means less has been invested at the moment the "this isn't right" signal arrives, giving the signal a chance to compete with momentum.

None of this makes anyone better at noticing. It makes noticing cheaper to act on, which is a different and more achievable thing.

Structural design also can't fully overcome a pre-rational impulse. Circuit breakers trip at defined boundaries. They don't catch the continuous stream of smaller discoveries that arrive between them, the "this approach isn't quite right" signal on a Tuesday afternoon that gets overridden by the impulse to finish before reconsidering.

### The Axis Is Default-Continue, Not Team Versus Individual

The usual organizational response to this is more structure: another ceremony, another synchronization point, another interval. That instinct is right about needing structure and wrong about which structure helps. A sprint and a circuit breaker are both team-level mechanisms, and they pull in opposite directions. The sprint commits a group to a scope and makes finishing the default, so stopping has to be argued for. The circuit breaker makes expiry the default, so continuing has to be argued for. What matters about a process is not whether it operates on the individual or the group, but which of the two directions it makes free.

Adding ceremonies on top of a default-continue structure just creates more places to report progress against work already committed. That is synchronized momentum, not a correction to it.

## What Helps When Awareness Isn't Enough

If the problem were purely intellectual, knowing about plan continuation bias would prevent it. It doesn't, because the impulse operates faster than reflection. But awareness is still the starting point, because you can't build countermeasures for a pattern you haven't recognized.

### Stopping Is the Cheapest Available Action

For most people, stopping feels like failure or waste. You were making progress and now you're not. The reframe is that evaluation is itself the cheapest available action, almost always cheaper than building more on a flawed foundation. This changes the emotional calculus even when the impulse is still there.

### Low Switching Costs Keep the Signal Audible

The impulse to continue draws power from switching costs that accumulate with every hour of continued execution. The less you've invested, the easier it is to hear the signal telling you to change direction. Practices like cheap experiments before commitment, small commits, well-defined interfaces, and feature flags all serve the same purpose by keeping the cost of being wrong low for as long as possible.

### External Pause Points Don't Depend on Self-Awareness

Because the impulse operates faster than individual reflection, environmental design matters as much as personal discipline. Circuit breakers, time boundaries, and explicit checkpoints make "keep going" an active choice rather than the default.

### A Fixed Rhythm Beats Waiting for Permission

The natural objection is that questioning costs working hours that would otherwise ship something. Context switching is expensive, and developers invoke this constantly. But how much of that argument is genuine, and how much is the bias protecting itself? Four hours of uninterrupted coding on a misunderstood problem doesn't produce the right solution, and the context-switching argument can't tell that case apart from the one where the four hours were well spent. That is what makes it such a comfortable defense. It costs the same to say either way. Breaking focus on work you understood and had good reason to continue throws away context you had built. Breaking focus on work you hadn't examined throws away nothing you would want to keep, and the impulse has no interest in telling the two apart.

The Pomodoro technique was designed for productivity, but it accidentally created exactly the kind of permission structure this bias requires. Every 25 minutes, you stop. Not because something went wrong, but because the rhythm demands it. That forced pause is a moment where "am I still working on the right thing?" can surface without carrying the social or psychological cost that usually prevents reassessment. The number doesn't matter. What matters is that stopping becomes part of the rhythm rather than an interruption of it.

Random interruption does carry a cost, and that's exactly the argument that makes "wait until the sprint review" feel reasonable. But two weeks from now is almost always too late. If an individual can create a reassessment moment every half hour, the gap between that and a two-week sprint review reveals how rarely most teams actually pause to reconsider.

### The Stop Test

Four countermeasures work against the impulse:

- Reframe stopping as the cheapest available action, not a failure or a waste
- Keep switching costs low through small commits, feature flags, and shaping work before committing to it
- Build external pause points like circuit breakers and checkpoints that don't depend on self-awareness
- Stop on a fixed rhythm instead of waiting for permission to reconsider

The pause only helps if something happens inside it. The stop test is three questions that fit in the gap:

- **Am I proving or testing?** Proving asks whether this can be made to work. Testing asks whether it should be.
- **What would I throw away if I switched right now, and was that number smaller an hour ago?** If it's growing, the window is closing, and the growth is something the impulse produced rather than something the problem required.
- **If I hadn't already started, would I choose this approach today?** A no here is the entire signal. Everything after it is negotiation with sunk cost.

There is an opposite pathology, and these countermeasures feed it. A developer who asks "would I choose this today?" every twenty-five minutes and answers honestly will restart more often than they finish, because most mid-implementation second thoughts are not better ideas. They're the appeal of an approach you haven't yet discovered the problems with, competing against an approach whose problems you can already see. The stop test is a check on a bias that runs one direction by default, not a standing invitation to relitigate. If your history shows more abandoned branches than shipped ones, plan continuation bias is not your problem and this is the wrong medicine.

## Stopping Is the Capability Everything Else Assumes

You can't realign after discovery if you can't stop long enough to receive the discovery. You can't measure outcomes instead of activity if the impulse to continue makes activity feel like outcomes. You can't build for change if you can't change direction yourself.

Every methodology, every discipline, every process improvement I've advocated for assumes that when the signal arrives, someone will hear it and act on it. Plan continuation bias is the mechanism that prevents exactly that.

So the work isn't to try harder at noticing. Noticing is the part that fails, and it fails faster than any effort to notice can be applied. The work is to arrange things so that stopping doesn't wait on noticing: rhythms that pause whether or not anything looks wrong, boundaries that expire on their own, commitments small enough that changing your mind costs less than defending it. Build those, and the moment you would otherwise have missed arrives on a schedule that isn't yours to override.
