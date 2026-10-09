---
layout: post
title: "Why 'Tech Debt' Does Not Get Fixed"
date: 2025-11-11
description: "The term 'tech debt' perpetuates the communication failures that created the problem. It's ambiguous, defensive, and invites deprioritization. Replace it with Corrections, Optimizations, and Re-Alignments to break the cycle."
tags: [architecture, communication, technical-debt, leadership]
author: steven-stuart
sources:
  - title: "Ward Cunningham, The WyCash Portfolio Management System (OOPSLA 1992 experience report)"
    url: "https://c2.com/doc/oopsla92.html"
  - title: "Martin Fowler, Technical Debt Quadrant"
    url: "https://martinfowler.com/bliki/TechnicalDebtQuadrant.html"
---

Most engineering teams have a backlog of work they call "tech debt." Developers understand how it can slow down feature development, increase support costs, and threaten system stability. Yet when they bring these concerns to stakeholders, the work often stays deprioritized indefinitely. So why is that? Why would something so obviously important be ignored? Delivery pressure plays a part, but a large share of the reason is that the term 'tech debt' positions engineering work as backward-looking cleanup rather than forward-looking value creation. It's defensive and ambiguous, and it lets a request arrive without a price or an owner, which sets the work up to be deprioritized again and again.

<blockquote class="pull-quote">
<p>"Tech debt" is a self-fulfilling prophecy that perpetuates the communication gap that created it in the first place.</p>
</blockquote>

## How the Term "Tech Debt" Invites Deprioritization

The metaphor creates the outcome everyone complains about by shaping how people think about and discuss the work.

**The term is too ambiguous to be actionable.** When someone says "tech debt," what do they actually mean? Intentional tradeoffs made under time constraints? Unanticipated consequences of reasonable decisions? Outright mistakes? Code that worked fine but is now outdated due to evolving requirements?

Ward Cunningham coined the metaphor in his 1992 OOPSLA experience report on the WyCash portfolio system, and he meant one specific thing. You ship first-time code before the design is fully understood, then pay it back promptly with a rewrite. The word has since stretched to cover every case in the list above. Martin Fowler's Technical Debt Quadrant defends the metaphor across all of them, but it takes two axes, deliberate versus inadvertent and reckless versus prudent, to sort what the word now covers. A stakeholder hearing the word gets none of that sorting. The term conflates deliberate strategy with failure, which makes it hard to have a productive conversation about what to do next.

**The metaphor obscures actual costs and consequences.** Real financial debt has clear terms: borrow $100K at 5% interest, pay it back over 5 years. Cunningham's original metaphor had terms too, since he counted every minute spent on not-quite-right code as interest, and the interest was the point. Everyday use drops them. Teams cite the debt and leave the interest unstated, so the word arrives without its business case.

What's the interest rate? When is it due? What happens if we don't pay it? The metaphor lets everyone avoid confronting actual costs and timelines. Without clear costs, there's no urgency, and without clear consequences, there's no accountability. Stakeholders hear "the code is messy" and think "so what?" They don't hear "we're losing $50K per month in support costs because this implementation is brittle, and we can't ship the feature roadmap because every change breaks three other things."

**The debt metaphor implies inevitability.** The verb that travels with the term is "accumulate," as in "we'll always accumulate some debt; that's just how software works." That makes debt sound like something that happens to a team rather than something it decided. Some of it is unavoidable, because requirements keep moving after code ships. But the framing stretches that truth over everything, so people accept poor decisions as unavoidable rather than asking "why did we decide without information we could have gathered?" Shipping under genuine uncertainty can be the right call, as Cunningham argued. Skipping the discovery that was available is not. The term normalizes dysfunction instead of demanding clarity.

**The term frames it as engineering's problem.** When you say "we have debt to pay down," stakeholders can easily hear "you made a mess, now clean it up." Put that next to the "accumulate" habit above, and engineering loses both ways. Engineers say "accumulate," which makes the decision look like no one's choice, so nobody outside engineering owns it. Stakeholders hear "debt" as blame, so the cleanup lands on engineering anyway. This doesn't invite collaborative problem-solving. It creates an adversarial dynamic where engineering owns the problem and stakeholders reluctantly allocate time to "let them fix their mistakes."

**The label strips away the decision's context.** "Debt" records that something is owed, not why it was borrowed. Without architectural decision records, the label fills that gap with blame, and future teams assume incompetence rather than recognizing intentional tradeoffs. The original context disappears: why this approach was chosen, what constraints existed at the time, what the intended evolution path was. Without that clarity, the current team either blindly perpetuates a bad pattern because they don't understand the original intent, or rewrites everything because they assume the previous team didn't know what they were doing. Both outcomes are expensive.

Consider how different this looks with context. If the architect had documented "We chose NoSQL here because we needed to ship in 3 months with the team we had. The long-term design uses relational storage. We've isolated this behind an interface so we can swap it later without touching business logic," the team has a roadmap instead of a mystery. That record is also what tells stakeholders what they traded for the 3-month ship date. When nobody writes it down, the business accepts a shortcut without knowing its price, and that gap is where the debt starts.

Whoever writes that record, usually the architect, becomes the translator between constraints, decisions, and evolution paths. Without that translation, each failure above feeds the next. Poor communication creates problems, vague language prevents fixes, and the gap widens.

## An Alternative: Categories That Communicate Impact

Developers can keep using "tech debt" internally as shorthand within engineering teams, but when talking to product owners and stakeholders, retire the term entirely.

One approach is to categorize work by business impact: **Corrections**, **Optimizations**, and **Re-Alignments**.

<div class="callout callout--warning">
<p class="callout__title">Corrections: Problems Causing Harm or Exposure Now</p>
<p><strong>What it is</strong>: Mistakes, tradeoffs, or outdated decisions actively harming the business right now, or exposing it to harm you can price.</p>
<p><strong>Examples</strong>:</p>
<ul>
<li>Security vulnerabilities exposing customer data</li>
<li>Unpatched or end-of-life dependencies whose next vulnerability will stay open</li>
<li>Bugs causing support escalations or customer churn</li>
<li>Reliability issues causing downtime or SLA violations</li>
</ul>
<p><strong>Why this works</strong>: Stakeholders already understand bugs and security problems as priorities because they're causing measurable harm today.</p>
<p><strong>Language to use</strong>:</p>
<ul>
<li>"We have a security vulnerability that exposes customer payment data. The fix takes 2 weeks."</li>
<li>"This bug is costing us $30K per month in support escalations. Fixing it unblocks the support team."</li>
<li>"The authentication service has 99.5% uptime. Our SLA guarantees 99.9%. The gap creates $100K annual credit exposure. Fixing the root cause takes 3 weeks and eliminates the SLA risk."</li>
</ul>
<p>Corrections communicate urgency. The business is being hurt now, and addressing it stops the bleeding immediately.</p>
</div>

<div class="callout callout--tip">
<p class="callout__title">Optimizations: Improving Efficiency and Cost</p>
<p><strong>What it is</strong>: Mistakes, tradeoffs, or outdated decisions affecting cost, performance, or efficiency.</p>
<p><strong>Examples</strong>:</p>
<ul>
<li>Database queries causing slow page loads (affecting conversion rates)</li>
<li>Infrastructure configuration costing more than necessary (budget impact)</li>
<li>Manual deployment process taking hours per release (velocity impact)</li>
<li>Tightly coupled code where every change breaks something else (slower delivery across the roadmap)</li>
<li>Inefficient algorithms causing excessive cloud compute costs</li>
</ul>
<p><strong>Why this works</strong>: Stakeholders understand optimization as improving what exists. It's not "paying debt," it's "increasing margin" or "improving user experience."</p>
<p><strong>Language to use</strong>:</p>
<ul>
<li>"Our cloud costs are $50K per month. A 3-week optimization brings that to $20K per month, saving $360K annually."</li>
<li>"Checkout page loads in 8 seconds. Our funnel data projects that cutting it to 2 seconds lifts conversion by 15%. The work takes 4 weeks and projects to $500K additional annual revenue."</li>
<li>"Automating deployments cuts release time from 4 hours to 15 minutes, letting us ship features faster. The automation work takes 2 weeks and doubles deployment frequency."</li>
<li>"Changes to the billing module take three times longer than changes elsewhere and cause most of our rollbacks. Two weeks of decoupling brings it in line with the rest of the codebase."</li>
</ul>
<p>Optimizations communicate efficiency gains with measurable ROI. The business improves margins, performance, or velocity.</p>
</div>

<div class="callout callout--note">
<p class="callout__title">Re-Alignments: Unlocking Future Capabilities</p>
<p><strong>What it is</strong>: Mistakes, tradeoffs, or outdated decisions that, when fixed, unblock new features, integrations, or business capabilities.</p>
<p><strong>Examples</strong>:</p>
<ul>
<li>Monolithic architecture preventing independent team scaling</li>
<li>API design preventing mobile app development</li>
<li>Data model preventing real-time analytics feature</li>
<li>Vendor lock-in preventing multi-cloud strategy</li>
<li>Legacy authentication system preventing enterprise SSO integrations</li>
</ul>
<p><strong>Why this works</strong>: Stakeholders understand opportunity cost. If the current architecture blocks a $2M revenue opportunity, fixing it isn't "paying debt"; it's "unlocking growth."</p>
<p><strong>Language to use</strong>:</p>
<ul>
<li>"We can't build the mobile app until we redesign the API. The redesign takes 6 weeks and unblocks a $2M annual opportunity."</li>
<li>"Our current data model prevents real-time dashboards (top customer request). Re-aligning the schema takes 4 weeks and delivers the feature."</li>
<li>"The monolith prevents us from scaling the checkout team independently. Splitting it out takes 8 weeks and lets that team release on its own schedule."</li>
<li>"Adding OpenID Connect unblocks enterprise SSO integrations. The $500K deal waiting on this capability closes once we deliver it. The migration takes 5 weeks."</li>
</ul>
<p>Re-Alignments communicate strategic value. The business unlocks capabilities that enable growth, close deals, or meet customer demands.</p>
</div>

### Each Category Demands a Price and Routes to an Owner

The new labels aren't magic, and stakeholders can tell a rebrand from a change in substance. They work because each one demands a specific follow-up. A Correction has to state the harm happening now. An Optimization has to state the cost or time it saves, and a Re-Alignment the capability it unblocks. "Tech debt" sounds like a complete request, so it gets made without the cost attached. It gets deferred, and the next request arrives in the same form.

Each new category points to an outcome that already has an owner and a queue. A Correction goes where incidents and escalations go. An Optimization goes to whoever owns the budget or the conversion target. A Re-Alignment rides with the roadmap item it unblocks. A categorized request states its value in the same terms as a feature and competes in the same queue, where the stakeholder makes a business trade they own instead of granting engineering time for repairs.

That routing, more than the numbers alone, is why the word matters. "Debt" points to no outcome, so when it gets a budget at all, the budget tends to be a separate cleanup allowance, such as a fixed slice of each sprint or a hardening quarter. Attaching a cost to the old label doesn't change that. A costed "debt" request still competes for leftover capacity instead of against the features it affects.

The categories also finish part of the translation the architect's record started. With a record like the NoSQL one above, calling the storage swap a Re-Alignment says the original choice fit its constraints and the constraints moved, which is the opposite of the incompetence story.

The routing has limits. It assumes those outcomes have owners outside engineering. Where engineering owns them too, attach the request to the product goal it protects. Small upkeep that no outcome owns still earns a protected allowance, but anything larger than that sprint slice needs a category to find a home. And framing won't move a stakeholder who understands the cost and still chooses features under delivery pressure. That can be a legitimate business call, and a costed request at least makes it a visible decision with an owner instead of a silent deferral.

The categories sort by the ask rather than by origin, because what a stakeholder needs to know is what happens if they say yes. When an item fits more than one category, file it under the impact you're asking the stakeholder to act on. Sorting by the ask also keeps a refusal on the record. Suppose a stakeholder funds a feature but cuts the Re-Alignment that would have unblocked it. Record the cost of the workaround as their decision, so the trade stays visible the next time the item comes up.

### Putting a Number on Work That Has None Yet

The figures in the callout examples above are illustrations, and they have to come from your own data when you use them. Stakeholders discount projections they can't check, so lead with costs already measured and present any gain as an estimate with its basis stated.

Not every item arrives with a price. Risk that hasn't materialized yet still belongs with Corrections, stated as exposure: what an incident would cost and why it is likely. Where you can't price the impact, state what you can measure, such as hours lost per release, incidents per quarter, or the features waiting on the change. Diffuse drag, like weak test coverage or inconsistent patterns spread across a codebase, still shows up in those measures as longer cycle times and more rollbacks. Compare the affected area against the rest of the codebase, or the codebase against its own trend, and the drag becomes an Optimization with a number attached.

If an item shows no harm, cost, or blocked capability, not even in those trends, that tells you something too. It may still deserve a fix inside feature work, which is the cheapest place to stop early decay before it reaches the trends, but it hasn't yet earned a separate claim on the roadmap.

## Breaking the Cycle Starts on the Engineering Side

The self-fulfilling prophecy persists because both sides perpetuate it. Developers tend to use vague language, stakeholders tend to defer those vague requests, and the cycle continues.

Break the cycle by being the solution:
- Replace "tech debt" with Corrections, Optimizations, and Re-Alignments when talking to stakeholders
- Communicate business value from the start in architectural proposals and decisions
- Mentor developers on translating technical concerns into stakeholder priorities
- Enforce quality standards at every increment through code reviews, architecture reviews, and quality gates, so fewer items need a request at all
- Document decisions with ADRs so context doesn't disappear and future teams have roadmaps

These aren't debts to be paid; they're opportunities for value. If the term itself invites the problem, replace it.
