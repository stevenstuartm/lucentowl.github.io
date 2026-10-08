---
layout: post
title: "What Engineering Leaders Ask That Others Don't"
date: 2025-06-11
tags: [leadership, mentorship, career, software-engineering]
description: "Leadership in software development comes from habits, not titles: accumulating experience instead of repeating it, holding your work to your own standard after it ships and when it passes review, looking for the questions you haven't asked, and growing others as you grow."
author: steven-stuart
sources:
  - title: "Gary Klein, Performing a Project Premortem (Harvard Business Review, 2007)"
    url: "https://hbr.org/2007/09/performing-a-project-premortem"
  - title: "Fiorella & Mayer (2013), The relative benefits of learning by teaching and teaching expectancy"
    url: "https://doi.org/10.1016/j.cedpsych.2013.06.001"
  - title: "Koh, Lee & Lim (2018), The learning benefits of teaching: A retrieval practice hypothesis"
    url: "https://doi.org/10.1002/acp.3410"
---

I've worked with engineers who had senior titles but didn't lead anyone. I've also worked with junior engineers who mentored half the team. The difference wasn't in their resume or their technical depth; it was in how they approached their work, their growth, and their responsibility to others.

<blockquote class="pull-quote">
<p>Leadership and mentorship in software development aren't granted by org charts. They emerge from patterns of behavior that compound over time.</p>
</blockquote>

By leadership I mean other people choosing to follow your judgment. Here are the questions that reveal the characteristics that earn it.

## 1. Do You Accumulate Experience or Repeat It?

There's a difference between ten years of experience and one year of experience repeated ten times. Repeating experience means doing the same work year after year, measuring tenure rather than growth. You solve the same class of problem at the same difficulty, year after year. The work feels comfortable because you've solved these problems before.

Accumulating experience means building new capabilities, taking on broader responsibilities, and establishing feedback loops for yourself and your team. You master a domain, then take on harder problems in it or stretch into adjacent ones. Going deeper counts as much as going wider, as long as the problems keep getting harder. The discomfort signals learning when you can say how the problem is harder than last year's.

Leaders accumulate in two directions. They create opportunities for others while advancing their own skills. Even when deeply focused on technical work, they enable team growth by making their knowledge accessible, their decisions transparent, and their expertise transferable, for example by writing down why a decision went the way it did where the team can find it.

## 2. "It Works" vs. "Is This Good?"

Everyone starts with "it works because it's not broken." It's easy to stay there indefinitely, measuring success by the absence of production incidents. But leaders evolve past this baseline.

The shift happens when you start taking accountability for code quality *after* deployment. The code shipped, the tests passed, and no one is complaining. It's easy to stop there. Leaders keep asking "Is this good?" even when everything seems fine.

This isn't perfectionism or over-engineering. It's recognizing that quality isn't the absence of complaints; it's the presence of standards. Production stability is necessary but insufficient. Leaders evaluate maintainability, clarity, and performance characteristics. They ask whether the code reflects the understanding the team has today rather than the understanding they had when they started.

A standard differs from perfectionism in that you can state it and tie it to a cost. "This module will be hard to change when the pricing rules move" is a standard the team can weigh against the deadline. "I'd have written it differently" is a preference, and asking "Is this good?" doesn't license acting on it.

## 3. Do You Seek Questions You Don't Yet Know to Ask?

There's a maturity shift that happens when developers stop relying solely on what they already know to evaluate their work. Early in your career, you ask questions to fill knowledge gaps: "How do I implement this feature?" or "What's the right pattern here?" These are important, but they're bounded by what you already understand.

Leaders develop a different instinct. They assume there are critical questions they haven't thought to ask yet. They seek out perspectives that challenge their assumptions. They recognize that the gaps you can't plan for at all are often the most dangerous, because a known gap can at least be weighed and scheduled, and an unknown one can't.

This shows up in reviews, design discussions, and retrospectives. Instead of defending your choices, you probe for what you might have missed.

Do you ask "What am I not seeing?" or "Do you see any issues?" One question invites discovery; the other invites validation.

The wording only helps if something backs it. Handing the reviewer the assumptions you're least sure of tests the design where you already suspect it's weak. Reaching the gaps you don't suspect takes other people's doubts, and Gary Klein's premortem is built for that. Everyone on the team assumes the project has already failed and writes down why, so the list includes causes you never thought of.

## 4. Does Quality Approve Your Work, or Does Approval Define Quality?

Just because no one flagged your code in review doesn't mean it's quality work. The previous question was about code aging after it ships. This one is about who holds the standard at the moment of approval.

**Leaders maintain standards independent of external validation.** They critique their own work and seek improvement opportunities. The approval process exists to catch mistakes, not to define quality. A reviewer sees a diff for a few minutes, with whatever context the description gives them. The author knows what was skipped, what was assumed, and which edge cases went untested. If the only reason your code is good is that reviewers didn't reject it, you're outsourcing accountability to the person who knows least about what this change left out.

## 5. Do You Build Others While You Build Systems?

The most effective technical leaders understand something fundamental: we learn by teaching. When you mentor less experienced developers, you're not just being generous with your time. Explaining a design from memory forces you to recall and organize what you know, and it exposes the parts you only thought you understood. Logan Fiorella and Richard Mayer tested this in 2013. Students who taught a lesson by recording a video lecture outperformed students who had only prepared to teach it, on a comprehension test a week later. In 2018, Koh, Lee, and Lim traced the gain to retrieval. Students who lectured without notes gained as much as students who simply took a recall test, while students who read a prepared script aloud didn't gain. So explain the design from memory rather than walking someone through the diff. Both studies tested students on a single lesson, so they support the mechanism, not any particular size of payoff for an engineer.

This can compound. As junior developers learn to handle the work you do today, you create space to tackle the challenges your leaders face. As they grow, you grow. You're not delegating to save time; you're building organizational capability while advancing your own. The return isn't immediate. Teaching slows you down for weeks before it frees anything up, and the space only opens if the people you taught take on the work you used to do. Even then, the freed space doesn't claim itself. Ask for the harder work explicitly, or it fills with more of the same.

Great engineers solve hard problems. Great leaders create engineers who solve hard problems. One scales with your own hours. The other scales with the hours of everyone you've taught, because what they learned keeps working after your mentoring time ends, as long as they stay on the team and on work that uses it. Mentorship isn't a nice-to-have activity you do when you have spare cycles; it's a core responsibility that determines whether you're writing code or building systems, working alone or multiplying impact.

## Five Questions to Ask About Your Own Work

Each habit gives people a reason to follow your judgment. The engineer who keeps taking on harder problems becomes the one others bring the hard version of a problem to. A standard you can state and tie to a cost is one the team can adopt. Questions that surface problems early get you invited into design discussions sooner. The people you taught come back with their next hard problem.

Those reasons aren't enough on their own. A standard imposed in review reads as gatekeeping, and a hard problem solved alone teaches no one. They turn into leadership when you share them, offering the standard along with its cost and solving the hard problem where others can follow the reasoning. The skilled engineer people route around usually has the habits and skips this step, delivering standards as verdicts on other people's work.

Each pattern reduces to a question you can put to your own work:

- Am I solving harder problems this year than last year, or repeating last year's work?
- Have I gone back to shipped code since the team learned something that changes it?
- Before a review, did I hand the reviewer the assumptions I'm least sure of?
- When I hold a standard the reviewer didn't, have I stated its cost so the team can adopt it?
- Who on the team can now do something they couldn't before I worked with them?

A title doesn't grant these habits, but the hours some of them need come from whoever owns the schedule. Mentoring and revisiting shipped code take time a deadline wants. A standard stated with its cost, like the pricing-rules example, is how you earn those hours, and framing your own review request needs none. A title also brings a seat in the rooms where designs get set. The habits don't replace that seat, but they're how people without one get invited, because the engineer whose questions surface problems early is the one someone asks to the next design review.

<blockquote class="pull-quote">
<p>None of this requires a title. You don't need a promotion to mentor someone, to ask better questions, or to hold yourself to higher standards.</p>
</blockquote>
