---
layout: post
title: "Build Slow to Go Fast: Decisions That Are Hard to Reverse"
date: 2025-10-10
description: "Architectural costs arrive late and get blamed on sales, marketing, or 'poor performers.' The fix is spending design time in proportion to how expensive a decision is to reverse."
tags: [architecture, technical-debt, software-engineering, leadership]
author: steven-stuart
sources:
  - title: "Pioneer Advantage: Marketing Logic or Marketing Legend? (Golder & Tellis, Journal of Marketing Research, 1993)"
    url: "https://journals.sagepub.com/doi/abs/10.1177/002224379303000203"
---

Most architects have sat in a meeting where leadership demands faster delivery. "Our competitors ship features weekly!" "We need to be first to market!" "We'll fix the technical issues later!" What gets decided under that pressure tends to outlive everyone who was in the room.

The premise driving that meeting is weaker than it sounds. Golder and Tellis studied roughly 500 brands across 50 product categories and found that pioneers failed 47% of the time against 8% for the early market leaders who followed them, with surviving pioneers holding about 10% market share against 28%. Those leaders entered an average of thirteen years later, so the study says more about patience than about engineering discipline. But it does undercut the assumption the meeting keeps making, which is that arriving first is what wins.

## Architectural Costs Arrive Late and Get Blamed on Something Else

When an architect spends a day designing a system properly, they're making decisions that echo through years of development. How will this scale? Where does it break? How will we test this? What happens when requirements change? How will new developers understand this?

<blockquote class="pull-quote">
<p>These costs are delayed and distributed. When a system fails six months later, nobody connects it to architectural shortcuts taken under pressure.</p>
</blockquote>

The misattribution is the expensive part. When customer churn increases gradually, it's blamed on sales or marketing. When engineering productivity drops because every change breaks something else, it's blamed on "poor performers" rather than on the architecture that makes every change risky. The accounting never reaches the decision that caused it, so the same decision gets made again.

Engineering organizations can become fire departments, racing from incident to incident, unable to ship new features without breaking existing ones. By then the remedy is hiring enough developers to contain the chaos, or rebuilding the foundation while keeping the lights on, and both get paid for out of money that was supposed to fund growth.

## Spend Design Time in Proportion to Reversal Cost

Balance isn't 50/50. It's spending design time in proportion to how expensive a decision is to reverse.

Data models, service boundaries, and security models are expensive, because a mistake in any of them propagates into everything built on top and can only be undone by touching all of it. UI layouts, feature flags, and configuration are cheap, so shipping them is the fastest way to find out whether they're right. Where requirements are genuinely uncertain, the investment goes into designing for change rather than into designing the answer.

The test is not how important a decision feels. It's what undoing it would cost six months from now.

| Decision | What reversing it costs | Design investment |
| --- | --- | --- |
| Data model / schema | Migrating live data, updating every consumer, a backfill window | Days |
| Service boundaries | Re-splitting deployed services, renegotiating contracts | Days |
| Auth / security model | Credential migration, audit re-certification | Days |
| Public API contract | Version support burden, client coordination | Hours to days |
| Internal library choice | Swap behind an interface | Hours |
| UI layout | Redeploy | Ship and measure |
| Feature flags / config | Change a value | Ship and measure |

## AI Multiplies Whatever Discipline You Already Have

AI-powered code generation hasn't changed software engineering fundamentals; it's made it easier for undisciplined teams to generate technical debt at scale.

Poor-quality, hard-to-maintain code isn't new. AI has simply democratized the ability to generate large volumes of code quickly without requiring understanding of what that code does, how it fits into the system, or what the maintenance costs will be.

This creates an illusion of productivity. Teams using AI to generate poorly architected features are digging their technical debt hole faster.

AI is a force multiplier for existing culture. Disciplined teams with strong architecture use AI to accelerate implementation of well-designed solutions. Undisciplined teams use AI to generate unmaintainable code faster than before.

AI doesn't create the problem, but it makes the consequences arrive faster.

## Where Building Deliberately Is the Wrong Call

The argument has a floor. If the company will not exist in nine months, the discounted value of avoided future maintenance is close to zero, and design time spent on a data model for a product that may never have users is time spent on the wrong problem. Runway sets the discount rate, and a high enough discount rate makes almost any deferred cost rational to incur.

It also assumes you know what you are designing for. Design investment pays off when it encodes a correct understanding of the problem, and it does damage when it encodes a wrong one, because a well-factored abstraction around the wrong domain model is harder to dislodge than the mess it would have replaced. Teams in genuine discovery should be buying information, not structure.

The reversal-cost test cuts both ways, too. A service boundary is expensive to move, but it is also expensive to place correctly before you have seen the traffic patterns that would tell you where it belongs. Where the cost of deciding early exceeds the cost of deciding wrong, ship and find out.

So the honest version of the claim is narrower than "build deliberately." It is that teams under delivery pressure systematically misclassify which decisions are reversible, and the error runs in one direction. Schema and boundary decisions get treated as cheap because changing the code is cheap, and nobody prices the migration.

## Translate Architecture Into Revenue, Retention, and Cost

Being technically brilliant doesn't matter if you can't explain why your decisions benefit the business. Don't talk about microservices versus monoliths or SQL versus NoSQL. Talk in the terms the budget is already denominated in, with your organization's real numbers in place of the illustrative ones below.

| Instead of | Say |
| --- | --- |
| "We need to refactor the data model" | "One week now, and roughly 30% off feature delivery time over the next year" |
| "These shortcuts are risky" | "Reliability is our #2 reason for churn, and this adds to it" |
| "The architecture is a mess" | "Our seniors spend most of their time on debt. Three months of remediation avoids the backfill hiring" |
| "We have technical debt" | "Reliability concerns are blocking $2M in enterprise deals" |
| "Our stack is outdated" | "Competitors ship faster because they built these foundations two years ago" |

Every technical decision can be framed as a business outcome like revenue, retention, cost savings, market position, or risk reduction. Doing it well requires understanding the business as deeply as the technology, which is why so few technically strong architects do it.

## Changing What the Organization Rewards

### Architects: Answer the Business Question First

An architectural review should be able to answer these questions: What business problem does this solve? What's the risk if we don't do this? What's the ROI and time horizon? How does this affect competitive position?

If you can't answer these, you don't understand the problem yet.

### Leaders: Reward Prevented Incidents, Not Heroic Saves

What you measure and reward is what you get. Celebrate teams that prevent incidents through design, not just heroic firefighting. Promote engineers who ensure long-term maintainability. Measure velocity over quarters, not just sprints. Make technical debt visible alongside revenue metrics.

### Teams: Validate Assumptions Before Production Does

Don't build for six months and hope it works. Build in short intervals that validate assumptions. Is this the right approach? Do customers want this? Can this scale as expected? Are we solving the right problem?

Fail fast on assumptions, not on production systems. Track time to ship features, production incident frequency, engineering time on new features versus maintenance, customer complaints, and engineer engagement, because all of them move before revenue does.

## Pay in Design Time Now or Compound Interest Later

Building deliberately to enable speed isn't philosophy; it's economics. Companies that ignore this principle pay in technical debt, lost customers, and burned-out teams.

The balance isn't achieved by splitting the difference between speed and quality. It's achieved by being strategic about where you invest time, testing assumptions ruthlessly, and building feedback loops that validate decisions early. Discipline is what holds it in place:

- Spend design time in proportion to how expensive a decision is to reverse
- Price the migration, not the code change, when you call a decision cheap
- Frame every architectural argument as a business outcome
- Reward sustainable velocity over heroic firefighting
- Watch the leading indicators, because revenue moves last

<blockquote class="pull-quote">
<p>You'll pay the cost of technical debt either up front when it's cheap, or later when it's exponentially more expensive.</p>
</blockquote>
