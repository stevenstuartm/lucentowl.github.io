---
title: "AAA Scenarios: Applying the Discipline"
layout: guide
category: Software Development Lifecycle
subcategory: AAA Cycle
description: "Real-world scenarios demonstrating how AAA discipline applies to common challenges architects face."
tags: [sdlc, aaa-cycle, stakeholder-management, collaboration, practical]
---

## Overview

These scenarios demonstrate how AAA discipline applies to real challenges architects face. Each scenario shows both the undisciplined response (what teams often do) and the AAA response (what the discipline requires).

For the philosophy and core values behind AAA, see [AAA Cycle: Align-Agree-Apply](aaa-cycle.html).

---

## Scenario: The Stakeholder Who Changes Requirements Mid-Sprint

**Situation**: Three weeks into a sprint, the business owner announces a "small change" that actually invalidates a core architectural assumption. The team has already built significant functionality based on the original requirements.

**The undisciplined response**: Accept the change to avoid conflict, scramble to implement it, miss the deadline, and blame "changing requirements."

**The AAA response**:

1. **Recognize this as an alignment break**: The stakeholder's understanding of the problem has evolved (or was never fully aligned). This isn't a failure; it's discovery.

2. **Pause and assess**: Don't immediately scramble. Document what changed and why. Assess impact on timeline, scope, and architecture.

3. **Return to Align**: Have a conversation focused on understanding: "Help me understand what drove this change. What problem are we actually solving?" This may reveal the original alignment was incomplete.

4. **Return to Agree**: Present options with trade-offs: "We can accommodate this change by extending 2 weeks, or by cutting feature X, or by accepting technical debt that we'll need to address in the next quarter."

5. **Get explicit agreement**: Don't just accept the change; get stakeholder commitment to the adjusted plan, including any scope or timeline changes.

**The discipline**: Changes aren't bad. Unacknowledged changes that erode agreements are bad. Use discovery as an opportunity to strengthen alignment, not as an excuse for chaos.

---

## Scenario: The Executive Who Wants It Faster

**Situation**: An executive sponsor demands the project be delivered two months early. The team's estimates show this is impossible without cutting scope or quality.

**The undisciplined response**: Agree to the timeline, hope for a miracle, cut corners, and deliver something that technically meets the deadline but doesn't actually work.

**The AAA response**:

1. **Don't treat this as a technical problem**: This is an alignment problem. The executive has constraints (market timing, budget cycles, competitive pressure) that you may not fully understand.

2. **Seek to understand**: "Help me understand what's driving the earlier date. What happens if we miss it? What would 'good enough by that date' look like?"

3. **Present honest options**: "To meet that date, we could: (A) cut these features to a future phase, (B) add contractors at this cost, (C) accept these specific quality risks. Which trade-off makes sense for the business?"

4. **Make the consequences explicit**: "If we try to deliver everything by that date without trade-offs, here's what will likely happen..." (missed deadline, quality issues, burnout, etc.)

5. **Secure genuine agreement**: If the executive chooses option A, ensure all stakeholders agree to the reduced scope. If they choose option C, ensure they explicitly accept the quality risks.

**The discipline**: "Faster" is rarely the real requirement. Understanding the actual constraint (market window, budget, competitive threat) often reveals options that satisfy the real need without impossible commitments.

---

## Scenario: The Team That Discovers the Architecture Won't Work

**Situation**: Two months into implementation, the team realizes that the agreed architecture has a fundamental flaw. The approach that passed POC doesn't work at production scale.

**The undisciplined response**: Keep trying to make it work, hide the problem from stakeholders, or blame the POC process.

**The AAA response**:

1. **Acknowledge the discovery**: This is exactly what Apply-phase governance is supposed to surface. Finding architectural issues during implementation, while painful, is far better than finding them in production.

2. **Document clearly**: What assumption broke? What did we learn? What are the options now?

3. **Assess the scope of impact**: Is this a local fix or does it affect the core architecture? Does it change timeline, cost, or scope?

4. **Return to Agree**: Present the situation and options to stakeholders. "We discovered X won't work because Y. Our options are: (A) switch to approach Z, which adds 6 weeks, (B) reduce scope to features that don't require this capability, (C) accept degraded performance of this much."

5. **Don't sugarcoat**: Stakeholders need honest information to make good decisions. "We thought this would work but it doesn't" is uncomfortable but necessary.

**The discipline**: POCs reduce risk but don't eliminate it. Discovery during Apply is expected, not shameful. The discipline is responding to discovery with transparency and structured decision-making, not pretending it didn't happen.

---

## Scenario: The Dependency That Falls Through

**Situation**: A critical external team that committed to delivering an API by week 6 announces in week 5 that they'll be three months late. Your project depends on this API.

**The undisciplined response**: Panic, escalate angrily, wait and hope, or start building a workaround without stakeholder agreement.

**The AAA response**:

1. **Verify and document**: Confirm the delay, understand the reason, and assess whether the new timeline is realistic.

2. **Assess your options**:
   - Wait and slip your timeline by 3 months
   - Build a temporary workaround (mock the API, build a bridge solution)
   - Descope features that depend on this API
   - Escalate to leadership to reprioritize the other team

3. **Present options to stakeholders**: Don't just report the problem; present choices with trade-offs. "Here are four ways we can respond, with these costs and risks for each."

4. **Get explicit agreement on the response**: If you build a workaround, ensure stakeholders understand it's temporary and budget for removing it later.

5. **Update the agreement**: If timeline, scope, or cost changes, document the new agreement. Don't just absorb the impact and hope.

**The discipline**: Dependency failures are predictable at the portfolio level, even if you don't know which specific dependency will fail. The discipline is monitoring proactively, responding systematically, and maintaining stakeholder alignment through the response.

---

## Recovering from Anti-Patterns

When you recognize failure patterns mid-project, recovery is possible, but it requires honesty and deliberate action.

### Recovering from "Solutions Before Connection"

*Signs you're here*: The team is building something, but stakeholders seem disengaged or keep asking "why are we doing it this way?" Requirements feel unclear despite having documentation.

*Recovery path*:
1. Pause implementation; don't dig the hole deeper
2. Schedule stakeholder conversations focused on understanding, not presenting
3. Ask: "Help me understand the problem from your perspective" (not "here's what we're building")
4. Be willing to discover that you're solving the wrong problem
5. If significant misalignment exists, cycle back to Align formally: update the charter and re-establish agreement

### Recovering from "Documentation Without Agreement"

*Signs you're here*: You have signed documents, but stakeholders interpret scope differently. The team and stakeholders have different expectations about what "done" means. Conflicts emerge that "should have been settled already."

*Recovery path*:
1. Acknowledge that signatures don't equal understanding
2. Facilitate a working session (not a presentation) to surface different interpretations
3. Document the conflicts explicitly: what do people actually disagree about?
4. Resolve conflicts through the process described in Phase 2 (escalate, vote, or reduce scope to agreed portions)
5. Create new agreement artifacts that reflect genuine shared understanding, not just compliance

### Recovering from "Delivery as the Goal"

*Signs you're here*: Features ship but stakeholders aren't satisfied. The team celebrates velocity while business outcomes don't improve. "We delivered what was asked for" becomes a defense against disappointed stakeholders.

*Recovery path*:
1. Stop measuring success by output (features shipped) and start measuring outcomes (value delivered)
2. Reconnect with stakeholders: "We've delivered X, but are you seeing the results you expected?"
3. If the answer is no, investigate whether you delivered the wrong thing, delivered it poorly, or misunderstood what success meant
4. Be willing to revisit scope, even late in the project; delivering the right thing late is better than delivering the wrong thing on time
5. Establish regular check-ins focused on outcomes, not just progress

**The Common Thread**: Recovery requires acknowledging that the process failed, even if artifacts were produced. Documents, sign-offs, and shipped code are not proof of success; they're just evidence of activity. Genuine alignment, agreement, and honored commitments are the actual measures.
