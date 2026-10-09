---
layout: post
title: "Build Slow to Go Fast: Decisions That Are Hard to Reverse"
date: 2025-10-10
description: "Architectural costs arrive late and tend to get blamed on the people working inside a design rather than the design itself. The fix is spending design time in proportion to how expensive a decision is to reverse, and pricing the migration rather than the code change."
tags: [architecture, technical-debt, software-engineering, leadership]
author: steven-stuart
sources:
  - title: "Pioneer Advantage: Marketing Logic or Marketing Legend? (Golder & Tellis, Journal of Marketing Research, 1993)"
    url: "https://journals.sagepub.com/doi/abs/10.1177/002224379303000203"
  - title: "Nobody Ever Gets Credit for Fixing Problems that Never Happened (Repenning & Sterman, California Management Review, 2001)"
    url: "https://journals.sagepub.com/doi/10.2307/41166101"
  - title: "Measure It? Manage It? Ignore It? Software Practitioners and Technical Debt (Ernst et al., FSE 2015)"
    url: "https://www.sei.cmu.edu/library/measure-it-manage-it-ignore-it-software-practitioners-and-technical-debt-2/"
  - title: "Accelerate State of DevOps Report 2024 (DORA, Google Cloud)"
    url: "https://dora.dev/research/2024/dora-report/"
---

Most architects have sat in a meeting where leadership demands faster delivery. "Our competitors ship features weekly!" "We need to be first to market!" "We'll fix the technical issues later!" What gets decided under that pressure tends to outlive everyone who was in the room.

The premise driving that meeting is weaker than it sounds. Golder and Tellis studied roughly 500 brands across 50 product categories. Pioneers failed 47% of the time, against 8% for the early market leaders who followed them, and surviving pioneers held about 10% market share against 28%. That undercuts the "first to market" demand, and the assumption behind it that arriving first is what wins. It says less about engineering discipline. Those leaders entered an average of thirteen years later, so the study is more about patience.

Shipping weekly is a separate demand, and it's compatible with the argument here. It only needs the expensive decisions under each weekly increment to be designed first or to ship in reversible steps.

## Architectural Costs Arrive Late and Get Blamed on Something Else

When an architect spends a day designing a system properly, they're making decisions that echo through years of development. How will this scale? Where does it break? How will we test this? What happens when requirements change? How will new developers understand this?

<blockquote class="pull-quote">
<p>These costs are delayed and distributed. When a system fails six months later, people rarely connect it to architectural shortcuts taken under pressure.</p>
</blockquote>

The misattribution is the expensive part. Customer churn that rises gradually can read as a sales or marketing problem. When engineering productivity drops because every change breaks something else, it tends to be blamed on "poor performers" rather than on the architecture that makes every change risky. The cause sits months back and shows up as many small symptoms. An incident review usually stops at the change that broke production, not the design that made the change risky.

Nelson Repenning and John Sterman found the organizational version in their 2001 study of process improvement, "Nobody Ever Gets Credit for Fixing Problems that Never Happened." Managers tend to read a performance shortfall as a lack of effort by the people involved, not as a flaw in the system they work in. So the response is pressure, which leaves even less time to fix the system. The accounting never reaches the decision that caused it, so the same decision gets made again.

Engineering organizations can become fire departments, racing from incident to incident, unable to ship new features without breaking existing ones. By then the remedy is hiring enough developers to contain the chaos, or rebuilding the foundation while keeping the lights on, and both get paid for out of money that was supposed to fund growth.

## Spend Design Time in Proportion to Reversal Cost

Balance isn't 50/50. It's spending design time in proportion to how expensive a decision is to reverse.

Data models, service boundaries, and security models are expensive, because a mistake in any of them propagates into everything built on top and can only be undone by touching all of it. UI layouts, feature flags, and configuration are cheap, so shipping them is the fastest way to find out whether they're right.
The test is not how important a decision feels. It's what undoing it would cost six months from now. The table assumes the answer is knowable, meaning the team has built this kind of system before, has seen the access patterns, and knows who the consumers are.

| Decision | What reversing it costs | Design investment, when the answer is knowable |
| --- | --- | --- |
| Data model / schema | Migrating live data, updating every consumer, a backfill window | Days |
| Service boundaries | Re-splitting deployed services, renegotiating contracts | Days (a module boundary first, if placement is unknown) |
| Auth / security model | Credential migration, audit re-certification | Days |
| Public API contract | Version support burden, clients whose code you can't migrate | Days |
| Internal library choice | Swap behind an interface | Hours |
| UI layout | Redeploy | Ship and measure |
| Feature flags / config | Change a value | Ship and measure |

The days produce something checkable, such as a reviewed data model, a rehearsed migration path, or contract tests for a boundary. When the answer isn't knowable, the same days go into making the decision cheap to move instead.

Two refinements apply. Expand-and-contract migrations, which add the new shape before removing the old one, already make additive schema changes cheap. The days belong to the changes they don't cover, like splitting an entity or changing its keys. Reversal cost also isn't the only axis. A config change is cheap to undo but can do damage before anyone undoes it, which calls for a staged rollout rather than design days.

## Where Building Deliberately Is the Wrong Call, and the Mistake Teams Actually Make

### Short Runways and Genuine Discovery

The argument has a floor. If the company will not exist in nine months, the discounted value of avoided future maintenance is close to zero. Design time spent on a data model for a product that may never have users is time spent on the wrong problem. Runway sets the discount rate, and a high enough discount rate makes almost any deferred cost rational to incur.

It also assumes you know what you are designing for. Design investment pays off when it encodes a correct understanding of the problem, and it does damage when it encodes a wrong one. A well-factored abstraction around the wrong domain model is harder to dislodge than the mess it would have replaced. Teams in genuine discovery should be buying information, not structure.

The reversal-cost test cuts both ways, too. A service boundary is expensive to move, but it is also expensive to place correctly before you have seen the traffic patterns that would tell you where it belongs. That's the case for the module boundary in the table, which keeps the decision cheap to move instead of guessing early.

### The Actual Mistake Is Misclassifying Reversibility

So the honest version of the claim is narrower than "build deliberately." It is that teams under delivery pressure tend to misclassify which decisions are reversible. Research has measured where the resulting debt lands. Neil Ernst and colleagues at Carnegie Mellon's Software Engineering Institute surveyed 1,831 engineers and architects in 2015, and architectural decisions came out as the most important source of technical debt.

Which way teams misclassify is an argument from incentives rather than a measurement. Teams with time can err the other way and over-build. Pressure pushes the error toward underpricing, because pressure rewards what is visible this sprint. The code change is visible, and the migration isn't until it lands. So schema and boundary decisions get treated as cheap because changing the code is cheap, and the migration rarely gets priced.

A hasty split into services under pressure looks like over-building, but it's the same error. The split was priced by the code it took to write, not by what merging the services back would take.

## AI Multiplies Whatever Discipline You Already Have

AI code generation hasn't changed which decisions are expensive to reverse. It has lowered the cost of writing code, which is the cost teams already mistake for reversal cost. A new service or a reshaped schema that takes an afternoon to generate feels cheap to change. But the live data, the consumers, and the contracts built on top of it cost as much to migrate as they did before.

That makes AI a force multiplier for existing culture. This is an inference from the cost argument, not a finding. Disciplined teams use it to implement well-designed foundations faster. Undisciplined teams use it to stack more code on unexamined foundations, and every generated feature is one more thing a later migration has to move. The output counts as progress while the debt it adds stays invisible, which is an illusion of productivity.

Google's DORA 2024 Accelerate State of DevOps report fits that gap without proving it. It found AI adoption associated with higher individual productivity and with lower software delivery stability and throughput. It measured a correlation, though, and pointed to larger batch sizes as the likely cause, not foundations. AI doesn't create the problem, but more code per week on the same foundations means the migration bill grows faster.

## Translate Architecture Into Revenue, Retention, and Cost

Pricing decisions correctly only helps if the people holding the budget accept the price. Being technically brilliant doesn't matter if you can't explain why your decisions benefit the business. Don't talk about microservices versus monoliths or SQL versus NoSQL. Talk in the terms the budget is already denominated in, with your organization's real numbers in place of the illustrative ones below.

| Instead of | Say |
| --- | --- |
| "We need to refactor the data model" | "One week now, and roughly 30% off feature delivery time over the next year" |
| "These shortcuts are risky" | "Reliability is our #2 reason for churn, and this adds to it" |
| "The architecture is a mess" | "Our seniors spend most of their time on debt. Three months of remediation avoids the backfill hiring" |
| "We have technical debt" | "Reliability concerns are blocking $2M in enterprise deals" |
| "Our stack is outdated" | "Competitors ship faster because they built these foundations two years ago" |

The numbers can come from data the team already has, such as cycle time on changes that touch the troubled module against changes that don't, or the incidents traced to it. Changes to core modules also tend to be harder work, so a forecast should claim only part of that measured gap. Multiply that part by the share of the roadmap that touches the module. Stated as a range, it gives leadership a number they can check later.

Most technical decisions can be framed as a business outcome like revenue, retention, cost savings, market position, or risk reduction. Doing it well requires understanding the business as deeply as the technology, and that is a separate skill from technical depth.

## Changing What the Organization Rewards

### Architects: Answer the Business Question First

An architectural proposal that asks for budget or schedule should be able to answer these questions: What business problem does this solve? What's the risk if we don't do this? What's the ROI and time horizon? How does this affect competitive position? "It keeps an expensive decision reversible until we know more" is a complete answer to the ROI and competitive-position questions.

If you can't state the risk of not doing it, even as "unknown, and this caps it," you don't understand the problem yet.

### Leaders: Reward Prevented Incidents, Not Heroic Saves

What you measure and reward is what you get. Prevention is invisible by design, so an organization that only sees saves ends up promoting the people who fight the fires its shortcuts started. Prevention can be made visible by comparing a module's incidents per change before and after it got design investment. Celebrate teams that prevent incidents through design, not just heroic firefighting. Promote engineers who ensure long-term maintainability. Measure velocity over quarters, not just sprints. Make technical debt visible alongside revenue metrics.

### Teams: Validate Assumptions Before Production Does

Don't build for six months and hope it works. Build in short intervals that validate assumptions. Is this the right approach? Do customers want this? Can this scale as expected? Are we solving the right problem?

Fail fast on assumptions, not on production systems. Track time to ship features, production incident frequency, engineering time on new features versus maintenance, customer complaints, and engineer engagement, because all of them move before revenue does.

## Pay in Design Time Now or Compound Interest Later

Building deliberately to enable speed isn't philosophy; it's a pricing decision. A funded company can choose to defer a hard decision and pay for the migration out of later revenue, and that's a legitimate trade when the migration was priced at the time. Companies that defer without pricing it pay later, in migrations, in firefighting, and in the hiring it takes to contain both.

The balance isn't achieved by splitting the difference between speed and quality. It's achieved by being strategic about where you invest time, testing assumptions ruthlessly, and building feedback loops that validate decisions early. Discipline is what holds it in place:

- Spend design time in proportion to how expensive a decision is to reverse
- Price the migration, not the code change, when you call a decision cheap
- Frame every architectural argument as a business outcome
- Reward sustainable velocity over heroic firefighting
- Watch the leading indicators, because revenue moves last

<blockquote class="pull-quote">
<p>For decisions that are hard to reverse, you pay either up front in design time, for a decision that's right or one that's cheap to move, or, when the guess was wrong, later in migration, when everything built on top has to move with it.</p>
</blockquote>
