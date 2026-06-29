---
layout: guide
title: "Dev Team Leadership"
category: Leadership & Team Management
subcategory: Team Leadership
description: "Practical, step-by-step guide for new dev team leads: what to do from day zero through delivery cycles, handling crises, and building momentum without the fluff."
tags: [leadership, team-management, fundamentals, coaching, collaboration]
---

You're now responsible for a development team. Whether you were promoted internally, hired externally, or thrust into the role unexpectedly, you need to know what to actually do starting now.

This guide is not about leadership philosophy. It's about the concrete activities you must perform from day zero forward to establish credibility, build momentum, and keep your team productive through both routine work and crisis situations.

## Day Zero: First 24 Hours

### Understand Your Authority and Constraints

<blockquote class="pull-quote">
<p>Don't assume your authority; get it explicitly defined.</p>
</blockquote>

Before you do anything visible, clarify what you can and cannot do:

<div class="callout callout--warning">
<p class="callout__title">Questions to Answer Immediately</p>
<ul>
<li>Who can I hire and fire? (Do I make the final call or just recommend?)</li>
<li>What's my budget authority? (Can I approve purchases? What's the limit?)</li>
<li>Can I change processes, tooling, or SDLC practices?</li>
<li>Who do I report to, and what do they expect from me?</li>
<li>What meetings am I required to attend?</li>
<li>What are the current team commitments and deadlines?</li>
</ul>
</div>

**How to get answers**: Schedule a 1:1 with your manager within the first 24 hours.

### Inventory Current State

You need to know what you're inheriting:

**Team roster**:
- Who's on the team? (Names, roles, experience levels)
- How long has each person been here?
- Are there open positions? Is anyone leaving soon?
- Are there performance issues I should know about?

**Work in progress**:
- What's currently being built?
- What's the current sprint/iteration status?
- What deadlines or commitments exist?
- Are there any critical issues or production incidents in flight?

**Technical landscape**:
- What systems/services does this team own?
- What's the tech stack?
- Where's the documentation? (Architecture diagrams, runbooks, ADRs)
- What's the deployment process?

**Processes and ceremonies**:
- What meetings happen regularly? (Standups, retros, sprint planning, reviews)
- What tools are in use? (Jira, Azure DevOps, GitHub, Slack, etc.)
- What's the definition of done?
- How are bugs and incidents handled?

**How to gather this**: Read existing documentation, review the backlog/kanban board, check the calendar for recurring meetings, talk to your predecessor if possible.

### Make Your Presence Known Without Disrupting Flow

**First team interaction**: Introduce yourself in the next team meeting (standup, planning, or ad-hoc if urgent). Keep it brief:
- Who you are and your background
- You're here to support them and remove obstacles
- You'll be learning the current state before making changes
- You'll schedule 1:1s with everyone

**What NOT to do**:
- Don't propose changes on day one
- Don't criticize existing practices
- Don't make promises you can't keep
- Don't position yourself as the hero who will fix everything

## Week One: Building Context

### Schedule and Conduct Initial 1:1s

Meet with every team member individually within the first week. These are listening sessions, not performance reviews.

**Agenda for first 1:1s** (30-45 minutes each):
1. **Get to know them** (10 min): Background, how long at company, prior experience, career goals
2. **Current work** (10 min): What are they working on? What's going well? What's frustrating?
3. **Team dynamics** (10 min): Who do they work with most? Any collaboration friction?
4. **Process feedback** (10 min): What's working in current processes? What's broken or wasteful?
5. **Blockers** (5 min): Anything preventing them from being productive right now?

**What to listen for**:
- Consistent complaints across multiple people (signals systemic issues)
- Individuals who seem disengaged or frustrated
- Blockers you can remove immediately
- Hidden expertise or leadership potential

**Follow-up actions**: Take notes and act on quick wins. If multiple people complain about the same thing and you can fix it easily, do it immediately.

### Establish Communication Channels

**Slack/Teams presence**: Be active and responsive. Developers need to know you're available. Set your status, respond to questions, and be present in relevant channels.

**1:1 cadence**: Schedule recurring 1:1s with each team member (weekly or biweekly depending on team size). Put them on the calendar now.

**Office hours**: If managing a large team (>8 people), consider open office hours where anyone can drop in with questions.

### Attend All Team Ceremonies

You need to understand how the team works. Attend every standup, planning session, retro, and review during your first week. Observe more than you speak.

**What to watch for**:
- Who speaks up? Who stays silent?
- Are meetings productive or wasteful?
- Does the team own their work or are they being told what to do?
- Is there energy and engagement or apathy?

### Review Technical Ownership

Understand what your team is responsible for:

**Service/system inventory**:
- What services, APIs, or components does your team own?
- What are the SLAs or uptime requirements?
- What's the on-call rotation? (If one exists)
- Where are runbooks and troubleshooting guides?

**Recent incidents**: Review the last 3-6 months of production incidents. What failed? Why? Were they preventable? This tells you where technical debt and risk live.

**Deployment frequency**: How often does the team deploy? Daily, weekly, monthly? This indicates process maturity and risk tolerance.

## Week Two: Early Wins and Establishing Rhythm

### Deliver Early Wins

<blockquote class="pull-quote">
<p>Credibility comes from removing friction and demonstrating you're useful.</p>
</blockquote>

Identify and deliver 2-3 quick wins within the first two weeks.

<div class="callout callout--tip">
<p class="callout__title">How to Identify Quick Wins</p>
<p>Your initial 1:1s will reveal them. Look for things that are:</p>
<ul>
<li>Complained about by multiple people</li>
<li>Easy to fix or change</li>
<li>High impact on daily workflow</li>
<li>Within your authority to change</li>
</ul>
</div>

**Examples of quick wins**:
- Remove a wasteful meeting everyone hates
- Fix a broken CI/CD step that slows deployments
- Get approval for a tool or license that's been requested
- Resolve a longstanding team conflict over process
- Improve documentation for a common task

### Establish Regular Communication Patterns

**Team-wide updates**: Decide how you'll communicate status, decisions, and updates. Options:
- Weekly email/Slack summary
- Brief update at standup or planning
- Dedicated Slack channel for announcements

**Transparency on decisions**: When you make a decision that affects the team, explain why. Don't just announce the conclusion; share the reasoning.

**Escalation path**: Make it clear how team members should escalate blockers, conflicts, or urgent issues to you.

### Understand Stakeholder Expectations

You have stakeholders outside the team (product managers, other engineering teams, executives). You need to know what they expect.

**Key stakeholders to meet**:
- Product manager or product owner (if separate from you)
- Peer engineering leads or architects
- Your manager
- Any business stakeholders who depend on your team's output

**Questions to ask stakeholders**:
- What do you expect from this team?
- How do you measure success?
- What's working well in our current collaboration?
- What's frustrating or broken?
- How do you prefer to communicate? (Slack, email, meetings)

## Ongoing: Iteration Cadence

The specifics of your iteration cycle depend on your team's methodology (Scrum, Kanban, Scrumban, Shape Up, etc.). The principles below apply regardless of the specific framework.

### Planning (Beginning of Iteration)

Your role depends on whether you're also the product owner. If not, you're facilitating and ensuring technical feasibility.

**Before planning**:
- Review upcoming work with product owner or stakeholders
- Identify technical risks or unknowns
- Ensure work items have clear acceptance criteria
- Validate that priorities are clear

**During planning**:
- Facilitate discussion (don't dominate it)
- Ensure team understands what's being asked
- Call out technical dependencies or blockers
- Confirm the team's capacity (consider PTO, on-call, meetings)
- Push back if commitments are unrealistic

**After planning**:
- Ensure iteration goal is clear and documented
- Verify work is assigned (or team agrees on who picks up what)
- Communicate plan to stakeholders if required

**Red flags**:
- Team is silent during planning (they don't understand or don't care)
- Work is dictated rather than discussed
- No one asks clarifying questions
- Same person always dominates estimation or planning

### Daily Standups

**Your role**: Listen more than you speak. Facilitate if the team needs it, but the team should drive standup, not you.

**What to listen for**:
- Blockers you can remove
- Work that's stalled or at risk
- Coordination needs between team members
- Signs of confusion about priorities or acceptance criteria

**What NOT to do**:
- Turn standup into a status report to you
- Solve problems during standup (take them offline)
- Lecture or criticize in front of the team

**Format variations**: Daily standups aren't mandatory. If your team works asynchronously or is highly experienced, consider async updates instead.

### Mid-Iteration Check-Ins

Halfway through the iteration, assess whether you're on track:

**Questions to answer**:
- Are we on track to deliver committed work?
- Are there blockers we haven't resolved?
- Do we need to adjust scope or priorities?
- Is anyone stuck or struggling silently?

**How to check**: Review the board, check in 1:1s, or hold a brief mid-iteration sync.

### Review/Demo (End of Iteration)

Demonstrate completed work to stakeholders.

**Your role**:
- Facilitate the demo (team members should present their work)
- Ensure stakeholders understand what was delivered
- Gather feedback and clarify next steps

**Red flags**:
- No one wants to demo their work (lack of ownership or pride)
- Stakeholders are confused about what was delivered
- Work is "done" but not actually shippable
- Same person always demos while others stay silent

### Retrospective

This is where the team reflects on process and identifies improvements. Some methodologies call this a retro, others a post-mortem or reflection session. The name doesn't matter; the discipline does.

**Your role**: Facilitate, listen, and commit to changes.

**Retro format** (many variations exist, choose what fits):
1. What went well?
2. What didn't go well?
3. What should we change?
4. Action items and owners

**Critical rules**:
- Psychological safety: No blame, no defensiveness
- Action items must have owners and be tracked
- If the same issue appears in multiple retros without action, you're failing as a leader

**Red flags**:
- Team stays silent or only says positive things (lack of trust)
- Same complaints every retro with no action
- Retro becomes a venting session without solutions
- You dominate the conversation or get defensive

### Post-Iteration: Metrics and Reporting

Track and communicate what the team delivered:

**Metrics that matter**:
- **Velocity** (if using story points or similar estimation): Trend over time, not absolute value
- **Throughput**: Number of items completed (works for any methodology)
- **Cycle time**: How long from starting work to done
- **Escaped defects**: Bugs found in production after deployment

**Reporting to stakeholders**: Summarize what was delivered, what's next, and any risks or blockers. Keep it concise.

**Red flags in metrics**:
- Velocity trending down over time (process issues, morale problems, or increasing technical debt)
- High work-in-progress with low throughput (lack of focus, too much context switching)
- Increasing cycle time (blockers, dependencies, or inefficient process)

## Ongoing: People Management

### Regular 1:1s

1:1s are your most important tool for people management. Consistency matters more than duration.

**Frequency**: Weekly for new reports or struggling team members, biweekly for experienced and thriving members.

**Agenda** (adjust based on needs):
1. **How are you?** (5 min): Personal check-in, gauge energy and morale
2. **Current work** (10 min): What are you working on? Blockers? Frustrations?
3. **Team dynamics** (5 min): Any collaboration issues? Conflicts?
4. **Career growth** (5 min): What do you want to learn? What opportunities can I create?
5. **Feedback** (5 min): Give or receive feedback
6. **Action items** (5 min): What will we each do before next 1:1?

**What to listen for**:
- Declining morale or engagement
- Conflicts with other team members
- Burnout signals (working late, weekends, stressed)
- Confusion about priorities or expectations

**What NOT to do**:
- Use 1:1s only for status updates (that's what standups are for)
- Cancel or reschedule frequently (signals you don't value them)
- Dominate the conversation talking about yourself
- Avoid difficult conversations

### Delegation and Ownership

You cannot and should not do all the work yourself. Delegate meaningful work to build capability and ownership.

**What to delegate**:
- Leading meetings or ceremonies (retros, planning, demos)
- Technical spikes or proof of concepts
- Mentoring junior team members
- Documenting processes or technical decisions
- Representing the team in cross-team discussions

**How to delegate effectively**:
1. **Be clear about the outcome**: What does success look like?
2. **Provide context**: Why does this matter? What's the business impact?
3. **Define authority**: Can they make decisions, or do they need your approval?
4. **Set check-in points**: When will you review progress?
5. **Trust and verify**: Let them do the work, then review the outcome

**Red flags**:
- You're the bottleneck for all decisions
- Team members wait for you to tell them what to do
- You're working nights and weekends while the team has capacity
- No one else can run team ceremonies or make technical decisions

### Performance Management

You're responsible for ensuring your team performs. This means both developing high performers and addressing underperformance.

**High performers**:
- Recognize their contributions publicly and privately
- Give them challenging work that stretches their skills
- Create growth opportunities (leading projects, mentoring others, tech talks)
- Advocate for promotions and raises when deserved
- Don't overload them and burn them out

**Underperformers**:
- Address issues early and directly (don't wait for annual reviews)
- Be specific about what's not meeting expectations
- Create a plan with clear goals and timelines
- Provide support (mentoring, training, pairing)
- Document conversations and follow up regularly
- If no improvement, escalate to HR and follow company process for PIP or termination

**Red flags**:
- High performers are leaving or disengaged
- Underperformers coast indefinitely without consequence
- You avoid difficult performance conversations
- Team members are surprised by feedback in performance reviews

## Crisis Management: When Things Blow Up

### Production Incidents

**Your role during an incident**:
1. **Stay calm**: Your team will mirror your energy. If you panic, they panic.
2. **Ensure someone is leading the incident**: Usually an on-call engineer or senior developer. Don't micromanage.
3. **Remove obstacles**: Get approvals, escalate blockers, coordinate with other teams.
4. **Communicate status**: Update stakeholders regularly (every 30-60 minutes for major incidents).
5. **Protect the team from interruptions**: Shield them from non-essential questions and meetings.

**Disciplined troubleshooting**: The teams that resolve incidents fastest follow a disciplined process. They gather facts before interpretations, reproduce issues before fixing them, and change one thing at a time. For a detailed breakdown of effective troubleshooting under pressure, see [Troubleshooting Production: Discipline Under Pressure](/blog/2025/11/08/troubleshooting-production.html){:target="_blank" rel="noopener noreferrer"}.

**After the incident**:
- Conduct a blameless postmortem within 48 hours
- Identify root cause and corrective actions
- Assign owners and timelines for corrective actions
- Follow up to ensure actions are completed

**Red flags**:
- Incidents take too long to resolve (lack of runbooks, poor monitoring, unclear ownership)
- Same issues repeat (corrective actions aren't happening)
- Blame culture emerges (people hide mistakes rather than learning from them)

### Missed Deadlines or Failed Iterations

**When you realize you'll miss a commitment**:
1. **Inform stakeholders immediately**: Don't wait until the deadline. Communicate as soon as you know.
2. **Explain why**: What went wrong? Was the estimate bad? Did requirements change? Did blockers appear?
3. **Provide options**: Can you deliver partial functionality? Can the deadline shift? Can scope be reduced?
4. **Commit to a new plan**: What will you deliver, and when?

**After the miss**:
- Conduct a retro to understand what happened
- Identify process improvements to prevent recurrence
- Rebuild trust through transparency and delivering on revised commitments

**Red flags**:
- Missed deadlines surprise stakeholders (poor communication)
- Team blames each other or external factors without owning mistakes
- Same patterns repeat (overcommitting, poor estimation, lack of buffers)

### Team Conflicts

Conflicts between team members will happen. Address them quickly before they poison team dynamics.

**How to handle interpersonal conflicts**:
1. **Talk to each person individually first**: Get both perspectives without the other present.
2. **Identify the real issue**: Often the stated conflict isn't the actual problem.
3. **Facilitate a conversation if needed**: Bring them together to resolve it if they can't do it themselves.
4. **Set expectations**: Professional behavior is non-negotiable. Disagreement is fine; disrespect is not.
5. **Follow up**: Check in with both parties after a week to ensure it's resolved.

**Red flags**:
- Conflicts simmer without resolution
- You avoid addressing conflicts hoping they'll resolve themselves
- One person consistently causes conflict and faces no consequences
- Team members stop collaborating to avoid conflict

### Attrition and Sudden Departures

Someone quits or is fired, and you need to manage the impact.

**Immediate actions**:
1. **Understand knowledge gaps**: What did they own? What knowledge is at risk?
2. **Document and transfer knowledge**: If they're leaving on good terms, capture runbooks, architecture decisions, and tribal knowledge.
3. **Redistribute work**: Assign their responsibilities temporarily or permanently.
4. **Inform the team**: Be transparent (within HR constraints) about what's happening and what it means for them.
5. **Communicate with stakeholders**: Explain impact on commitments and timelines.

**Recruiting and onboarding replacement**:
- Start recruiting immediately if backfilling
- Involve team in interviews if possible (builds buy-in)
- Have an onboarding plan ready (documentation, buddy system, first-week tasks)

**Red flags**:
- Knowledge loss cripples the team (lack of documentation, single points of failure)
- Remaining team members are overloaded and burn out
- Attrition triggers more attrition (morale death spiral)

## Common Failure Modes

<div class="comparison">
<div class="content-card content-card--accent">
<h4>You're Doing Too Much</h4>
<p><strong>Symptoms</strong>:</p>
<ul>
<li>Working late and weekends regularly</li>
<li>You're the bottleneck for decisions</li>
<li>Team waits for you to tell them what to do</li>
<li>Writing production code while managing</li>
</ul>
<p><strong>Fix</strong>: Delegate more aggressively, empower team decisions, stop IC work, focus on unblocking</p>
</div>
<div class="content-card content-card--accent-secondary">
<h4>You're Not Doing Enough</h4>
<p><strong>Symptoms</strong>:</p>
<ul>
<li>Team is directionless or confused</li>
<li>Blockers sit unresolved for days</li>
<li>Stakeholders bypass you</li>
<li>Conflicts simmer without resolution</li>
</ul>
<p><strong>Fix</strong>: Increase engagement, proactively remove blockers, assert authority, address conflicts</p>
</div>
</div>

<div class="comparison">
<div class="content-card content-card--accent">
<h4>You've Lost Technical Credibility</h4>
<p><strong>Symptoms</strong>:</p>
<ul>
<li>Team dismisses your technical input</li>
<li>Can't participate in design discussions</li>
<li>Don't understand the codebase anymore</li>
</ul>
<p><strong>Fix</strong>: Stay hands-on with code reviews, build POCs, pair on complex work, attend technical discussions</p>
</div>
<div class="content-card content-card--accent-secondary">
<h4>You're Protecting the Team from Reality</h4>
<p><strong>Symptoms</strong>:</p>
<ul>
<li>Shield team from stakeholder pressure</li>
<li>Team doesn't understand business constraints</li>
<li>Developers surprised by priority shifts</li>
<li>You absorb all conflict and stress</li>
</ul>
<p><strong>Fix</strong>: Share context liberally, involve team in priorities, let them hear feedback directly, build resilience</p>
</div>
</div>

## Key Takeaways

**From day zero**:
- Clarify your authority and constraints immediately
- Inventory current state before making changes
- Listen more than you speak in the first week

**Establishing rhythm**:
- Deliver quick wins to build credibility
- Establish regular 1:1s and communication patterns
- Understand stakeholder expectations and align with them

**During iterations**:
- Facilitate planning without dominating it
- Use standups to identify blockers, not as status reports
- Run retros that drive actual change, not just venting
- Track metrics that reveal process health

**People management**:
- 1:1s are your most important tool; never skip them
- Delegate meaningful work to build capability and ownership
- Address performance issues early and directly

**When things blow up**:
- Stay calm and remove obstacles during incidents
- Communicate early and often when missing deadlines
- Address conflicts immediately before they poison the team
- Manage attrition impact through knowledge transfer and workload redistribution

**Success is measured by team outcomes**, not your personal heroics. Lead in service of their productivity, growth, and ability to deliver.
