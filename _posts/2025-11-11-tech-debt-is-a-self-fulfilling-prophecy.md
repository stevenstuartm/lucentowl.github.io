---
layout: post
title: "Why 'Tech Debt' Does Not Get Fixed"
date: 2025-11-11
description: "The term 'tech debt' perpetuates the communication failures that created the problem. It's ambiguous, defensive, and guarantees deprioritization. Replace it with Corrections, Optimizations, and Re-Alignments to break the cycle."
tags: [architecture, communication, technical-debt, leadership]
author: steven-stuart
---

Most engineering teams have a backlog of work they call "tech debt." Developers understand how it can slow down feature development, increase support costs, and threaten system stability. Yet when they bring these concerns to stakeholders, the work often stays deprioritized indefinitely. So why is that? Why would something so obviously important be ignored. In most cases, it is because the term 'tech debt' positions engineering work as backward-looking cleanup rather than forward-looking value creation. It's defensive, it's ambiguous, and it guarantees the work never gets prioritized.

<blockquote class="pull-quote">
<p>"Tech debt" is a self-fulfilling prophecy that perpetuates the communication gap that created it in the first place.</p>
</blockquote>

## Why "Tech Debt" Guarantees Deprioritization

The metaphor creates the outcome everyone complains about by shaping how people think about and discuss the work.

**The term is too ambiguous to be actionable.** When someone says "tech debt," what do they actually mean? Intentional tradeoffs made under time constraints? Unanticipated consequences of reasonable decisions? Outright mistakes? Code that worked fine but is now outdated due to evolving requirements? The term conflates deliberate strategy with failure, which makes it impossible to have productive conversations about what to do next.

**The metaphor obscures actual costs and consequences.** Real financial debt has clear terms: borrow $100K at 5% interest, pay it back over 5 years. "Tech debt" has no such clarity. What's the interest rate? When is it due? What happens if we don't pay it? The metaphor lets everyone avoid confronting actual costs and timelines. Without clear costs, there's no urgency, and without clear consequences, there's no accountability. Stakeholders hear "the code is messy" and think "so what?" They don't hear "we're losing $50K per month in support costs because this implementation is brittle, and we can't ship the feature roadmap because every change breaks three other things."

**The debt metaphor implies inevitability.** "We'll always accumulate some debt; that's just how software works." This defeatist framing makes people accept poor decisions as unavoidable rather than asking "why are we making decisions without enough information?" The term normalizes dysfunction instead of demanding clarity.

**The term frames it as engineering's problem.** When you say "we have debt to pay down," stakeholders hear "you made a mess, now clean it up." This doesn't invite collaborative problem-solving. It creates an adversarial dynamic where engineering owns the problem and stakeholders reluctantly allocate time to "let them fix their mistakes."

**Missing architectural context creates an assumption of incompetence.** When architectural decision records don't exist, future teams assume incompetence rather than recognizing intentional tradeoffs. The original context disappears: why this approach was chosen, what constraints existed at the time, what the intended evolution path was. Without that clarity, the current team either blindly perpetuates a bad pattern because they don't understand the original intent, or rewrites everything because they assume the previous team didn't know what they were doing. Both outcomes are expensive.

Consider how different this looks with context. If the architect had documented "We chose NoSQL here because we needed to ship in 3 months with the team we had. The long-term design uses relational storage; we've isolated this behind an interface so we can swap it later without touching business logic," the team has a roadmap instead of a mystery. The architect becomes the translator between constraints, decisions, and evolution paths. Without that translation, the cycle repeats: poor communication creates problems, vague language prevents fixes, and the gap widens.

## An Alternative: Categories That Communicate Impact

Developers can keep using "tech debt" internally as shorthand within engineering teams, but when talking to product owners and stakeholders, retire the term entirely.

One approach is to categorize work by business impact: **Corrections**, **Optimizations**, and **Re-Alignments**.

<div class="callout callout--warning">
<p class="callout__title">Corrections: Problems Causing Harm Now</p>
<p><strong>What it is</strong>: Mistakes, tradeoffs, or outdated decisions actively harming the business right now.</p>
<p><strong>Examples</strong>:</p>
<ul>
<li>Security vulnerabilities exposing customer data</li>
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
<li>Inefficient algorithms causing excessive cloud compute costs</li>
</ul>
<p><strong>Why this works</strong>: Stakeholders understand optimization as improving what exists. It's not "paying debt," it's "increasing margin" or "improving user experience."</p>
<p><strong>Language to use</strong>:</p>
<ul>
<li>"Our cloud costs are $50K per month. A 3-week optimization brings that to $20K per month, saving $360K annually."</li>
<li>"Checkout page loads in 8 seconds. Optimizing to 2 seconds increases conversion by 15% based on industry benchmarks. The work takes 4 weeks and projects to $500K additional annual revenue."</li>
<li>"Automating deployments cuts release time from 4 hours to 15 minutes, letting us ship features faster. The automation work takes 2 weeks and doubles deployment frequency."</li>
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
<li>"The monolith prevents us from scaling the checkout team independently. Splitting it out takes 8 weeks and doubles that team's velocity."</li>
<li>"Moving to OAuth 2.0 unblocks enterprise SSO integrations. The $500K deal waiting on this capability closes once we deliver it. The migration takes 5 weeks."</li>
</ul>
<p>Re-Alignments communicate strategic value. The business unlocks capabilities that enable growth, close deals, or meet customer demands.</p>
</div>

## Breaking the Cycle

The self-fulfilling prophecy persists because both sides perpetuate it. Developers tend to use use vague language, stakeholders have little choice but to ignore those vague requests, and the cycle continues.

Break it by being the solution:
- Replace "tech debt" with Corrections, Optimizations, and Re-Alignments when talking to stakeholders
- Communicate business value from the start in architectural proposals and decisions
- Mentor developers on translating technical concerns into stakeholder priorities
- Enforce quality standards at every increment through code reviews, architecture reviews, and quality gates
- Document decisions with ADRs so context doesn't disappear and future teams have roadmaps

These aren't debts to be paid; they're opportunities for value. If the term itself guarantees the problem, replace it.
