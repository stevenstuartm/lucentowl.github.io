---
layout: post
title: "The Most Dangerous Sentence in Software Development"
date: 2026-02-07
description: "Every methodology assumes that when discovery arrives, someone will stop and act on it. Plan continuation bias is the pre-rational impulse that prevents exactly that."
tags: [plan-continuation-bias, decision-making, leadership, cognitive-bias, software-development]
---

Something is broken in my approach to problem-solving, and I suspect it's broken in yours too.

When I'm mid-implementation and a better idea surfaces, my first instinct isn't to evaluate it; it's to finish what I'm doing. Not because I've weighed the alternatives and made a conscious choice to stay the course. I just can't seem to stop. The impulse to complete what's in front of me overrides the signal to reconsider, and by the time I've finished, the switching costs have mounted and the moment for cheap redirection has passed.

In software, the most dangerous sentence is "let me just get this working first."

It's rarely pride, just a pre-rational impulse to proceed before changing direction, as though stopping mid-stride carries some invisible cost that continuing doesn't.

## A Bias Faster Than Reflection

This pattern has a name. In aviation, it's called [get-there-itis](https://www.faa.gov/newsroom/safety-briefing/cfit-and-plan-continuation-bias){:target="_blank" rel="noopener noreferrer"}. In cognitive science, the broader phenomenon is plan continuation bias. [Research at NASA's Ames Research Center](https://skybrary.aero/articles/continuation-bias){:target="_blank" rel="noopener noreferrer"} found that roughly 75% of tactical decision errors in airline accidents were decisions to continue the original plan despite cues suggesting a different course of action (Orasanu et al., 2001). These weren't errors of skill or knowledge; they were errors of continuation.

When pilots flying under visual rules encounter weather that requires instruments and press on anyway, the [fatality rate is 86%](https://www.aopa.org/training-and-safety/air-safety-institute/accident-analysis/vfr-into-imc/overview){:target="_blank" rel="noopener noreferrer"} (AOPA Air Safety Institute). These aren't reckless or untrained pilots; many are experienced and fully aware of the danger.

The mechanism explains why awareness alone isn't enough. When the original plan was well-justified, subsequent contradictory signals receive less cognitive weight. The better your reason for starting, the harder it becomes to hear the signal telling you to stop. As workload increases and you get deeper into execution, less mental capacity is available to reconsider. The original plan has inertia, and new information has to fight through it.

## "Let Me Just Get This Working First"

The idea of finishing first and then reevaluating sounds reasonable. But watch carefully what actually happens. You spend another hour building out the current approach. You write tests around it. Other code starts depending on it. A colleague reviews it and builds understanding of how it works. All the while, you're sinking deeper into an approach that hasn't yet proven it's the right one. At that point, "considering the other approach" means throwing away not just your work but the organizational investment in reviewing, understanding, and integrating what you've built.

The impulse to finish manufactures the very sunk costs that now appear to justify not switching.

This is the difference between proving and testing. Proving asks "can I make this work?" and the answer is almost always yes given enough effort. Testing asks "should I be making this work?" and that's the question that actually matters. When someone says "let me just get this working first," they're proving, not testing. They want to see their assumption become real before they'll allow a competing idea to be evaluated. The current assumption gets the full weight of implementation effort while the alternative gets a hypothetical conversation, maybe, later, if there's time.

[Barry Staw's research on escalation of commitment](https://en.wikipedia.org/wiki/Escalation_of_commitment){:target="_blank" rel="noopener noreferrer"} found something uncomfortable: people who feel personally responsible for the initial decision commit more resources to it when it starts failing, not fewer (Staw, 1976). The instinct isn't to cut losses. It's to double down, as though additional effort can retroactively make the original decision correct. In software, this looks like the developer who spends two more days making a questionable approach work rather than spending thirty minutes evaluating whether a different approach would have been simpler from the start.

## When the Herd Feels Like Validation

The individual version of this bias is problematic enough on its own. The group version is worse, and it doesn't work the way most people assume.

Classic groupthink involves the active suppression of dissent: people silencing themselves or being silenced because the group demands conformity. That happens, but it's not the most common pattern. The more common version is subtler and more passive. Nobody explicitly validated the direction. Nobody consciously suppressed alternatives. Everyone just assumed that someone else must have validated it, and the group's momentum itself became evidence that the direction is correct.

This isn't the bystander effect, where people assume someone else will act. It's that adding your force to the herd's direction feels rational because the herd is already moving. If everyone is going this way, someone must have confirmed it's right. And even if nobody confirmed anything, the sheer mass of collective effort makes the direction feel too established to question.

This compounds with individual plan continuation bias. Each person on the team is locked into "finish what I'm doing" mode while simultaneously treating the group's momentum as confirmation that the direction is right. The herd moving fast feels like progress. Questioning the direction doesn't just feel unproductive; it feels like you're slowing the team down, which in most team cultures marks you as the obstacle rather than the one asking the right question.

The result is collective plan continuation bias. Individuals who can't self-interrupt, operating inside a group that punishes interruption. Each person's contribution feels small and the aggregate momentum feels like validation. Sometimes the herd is just running.

## When Good Advice Reinforces the Bias

The bias runs deep enough that even our corrective wisdom reinforces it. Consider the life lessons most people absorb without questioning.

"Think before you act." Sound advice, except it assumes the thinking was sound. The bias doesn't care whether you thought first; it cares that you committed to a direction. Once you've thought and decided, the decision has inertia. You thought, you chose, you proceeded, even if the thought was wrong. The problem was never acting without thinking. It's acting without *reconsidering*.

"Finish what you started." This is plan continuation bias repackaged as a character virtue. Discipline means following through, and quitting means weakness. The advice assumes that what you started should be finished, which is exactly the question the bias prevents you from asking. Persistence is genuinely valuable when the direction is right. When the direction is wrong, persistence is just the bias wearing a respectable disguise.

"The first step to recovery is admitting you have a problem." In principle, yes. But notice what the phrasing assumes. "Admitting" implies you already know and just need to say it out loud. The actual first step is *recognizing* you have a problem, and recognition is exactly what the bias blocks. Those NASA pilots didn't refuse to admit they were flying into dangerous conditions. They didn't register it as dangerous in the first place. Recognition is the prerequisite that admitting takes for granted.

Each of these lessons skips past the moment that actually matters, the moment where you stop, reassess, and recognize that the current direction might be wrong. They treat that moment as though it happens automatically, as though thinking, persisting, and acknowledging are the hard parts. They aren't. Stopping is the hard part, and our collective wisdom doesn't just fail to address it; it actively discourages it.

## The Prerequisite Beneath Process

This is the hardest part to accept. I've written extensively about values-driven development, about aligning before committing, about realigning after discovery. I believe that better disciplines produce better outcomes, and they do. But none of it matters if the people inside the process can't stop long enough to let the process work.

Think about what "realign after discovery" actually requires. When new information surfaces mid-implementation, someone needs to notice it, recognize its significance, stop the current execution, communicate the discovery, and reconsolidate the agreement. Every step in that sequence is an interruption of momentum. At every step, plan continuation bias pulls in the opposite direction: keep going, finish what you started, evaluate later.

Some methodologies make this worse. Scrum's sprint commitment locks the herd in for two weeks. Daily standups reinforce the current plan by asking everyone to report progress against committed work. Mid-sprint, questioning the direction isn't just socially expensive; it's structurally framed as disruption. Sprint reviews happen after two weeks of sunk cost have already accumulated, which means the only official moment for course correction comes when the bias is at its strongest. Scrum doesn't fail to address plan continuation bias; it amplifies it.

Shaped Kanban comes closest to accounting for this flaw. Circuit breakers assume that initial plans will prove wrong and someone will need permission to stop. Appetite-based time bounds treat abandoning work as a valid outcome rather than a failure. Shaping before commitment means less is invested when the "this isn't right" signal arrives, giving the signal a chance to compete with momentum. Of the methodologies I've examined, it's the only one that treats the inability to stop as a design constraint rather than a character flaw to overcome.

But even the best structural design can't fully overcome a pre-rational impulse. Circuit breakers trip at defined boundaries; they don't catch the continuous stream of smaller discoveries that arrive between them, the "this approach isn't quite right" signal on a Tuesday afternoon that gets overridden by the impulse to finish before reconsidering.

Most management responses get the direction of the fix wrong by trying to correct the herd first through new intervals, ceremonies, and synchronization points. But herd-level intervals reinforce herd-level momentum. The fix proceeds from the individual outward: when individuals develop the capacity to stop and reconsider, the group benefits naturally. When organizations try to impose that capacity through process without addressing the individual first, they end up with synchronized momentum in the wrong direction.

## What Helps When Awareness Isn't Enough

If the problem were purely intellectual, knowing about plan continuation bias would prevent it. It doesn't, because the impulse operates faster than reflection. But awareness is still the starting point, because you can't build countermeasures for a pattern you haven't recognized.

### Reframing what "stop" means

For most people, stopping feels like failure or waste. You were making progress and now you're not. The reframe is that evaluation is itself the cheapest possible action, almost always cheaper than building more on a flawed foundation. This changes the emotional calculus even when the impulse is still there.

### Keeping switching costs low

The impulse to continue draws power from real switching costs that accumulate with every hour of continued execution. The less you've invested, the easier it is to hear the signal telling you to change direction. Practices like cheap experiments before commitment, small commits, well-defined interfaces, and feature flags all serve the same purpose by keeping the cost of being wrong low for as long as possible.

When you've defined clear boundaries and identified risks upfront, the moment of "this isn't right" arrives before you've built the organizational investment that makes switching feel impossible.

### Building external pause points

Because the impulse operates faster than individual reflection, environmental design matters as much as personal discipline. Structural interrupts that externally force evaluation create pause points that don't depend on someone having the self-awareness to stop on their own.

Circuit breakers, time boundaries, and explicit checkpoints make "keep going" an active choice rather than the default. When continuation requires justification instead of being automatic, the bias loses some of its power because you're reasoning about whether to continue rather than just doing it.

### Stopping more often

The natural objection is that questioning costs working hours that would otherwise ship something. Context switching is expensive, and developers invoke this constantly. But how much of that argument is genuine, and how much is the bias protecting itself? Four hours of uninterrupted coding on a misunderstood problem doesn't produce the right solution. If you couldn't stop to reconsider in the first place, then your "focused work" wasn't productive flow; it was the bias running unchecked. Context switching away from something you didn't understand and weren't willing to re-examine isn't losing momentum. It's gaining perspective.

The [Pomodoro technique](https://en.wikipedia.org/wiki/Pomodoro_Technique){:target="_blank" rel="noopener noreferrer"} was designed for productivity, but it accidentally created exactly the kind of permission structure this bias requires. Every 25 minutes, you stop. Not because something went wrong, but because the rhythm demands it. That forced pause is a moment where "am I still working on the right thing?" can surface without carrying the social or psychological cost that usually prevents reassessment. The number doesn't matter. What matters is that stopping becomes part of the rhythm rather than an interruption of it.

Four countermeasures work against the impulse:
- Reframe stopping as the cheapest possible action, not a failure or a waste
- Keep switching costs low through small commits, feature flags, and shaping work before committing to it
- Build external pause points like circuit breakers and checkpoints that don't depend on self-awareness
- Stop on a fixed rhythm instead of waiting for permission to reconsider

Random interruption does carry a cost, and that's exactly the argument that makes "wait until the sprint review" feel reasonable. But two weeks from now is almost always too late. If an individual can create a reassessment moment every half hour, the gap between that and a two-week sprint review reveals how rarely most teams actually pause to reconsider. Structural interrupts at the team level like circuit breakers, checkpoints, and hill chart reviews serve the same purpose at a larger scale by creating moments where questioning is expected rather than disruptive. There's a difference between being present in the moment and being focused to the exclusion of all else. Presence means being receptive to signals while they're still cheap to act on. Tunnel vision means the signal arrives and can't get through.

## The Foundation

This is the prerequisite for everything else I believe about building software. You can't realign after discovery if you can't stop long enough to receive the discovery. You can't measure outcomes instead of activity if the impulse to continue makes activity feel like outcomes. You can't build for change if you can't change direction yourself.

Every methodology, every discipline, every process improvement I've advocated for assumes that when the signal arrives, someone will hear it and act on it. Plan continuation bias is the mechanism that prevents exactly that. Recognizing it, not just intellectually but in the moment, mid-implementation, while writing code that should have been reconsidered an hour ago, is the foundation that makes everything else possible.
