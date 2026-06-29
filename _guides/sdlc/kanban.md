---
title: "Kanban Methodology"
layout: guide
category: Software Development Lifecycle
subcategory: SDLC Fundamentals
description: "Comprehensive guide to Kanban - visualizing workflow, limiting WIP, optimizing flow, and continuous delivery through pull-based systems."
tags: [sdlc, methodology, kanban, workflow, continuous-delivery, lean, practical]
---

## What is Kanban

*Originated at Toyota in the 1940s as part of the Toyota Production System (Taiichi Ohno). Adapted to software development by David J. Anderson in the mid-2000s, formalized in "Kanban: Successful Evolutionary Change for Your Technology Business" (2010).*

**Kanban** is a visual workflow management method that emphasizes continuous flow, explicit work-in-progress limits, and incremental evolutionary change. Unlike frameworks that prescribe specific roles and ceremonies, Kanban is a change management approach that you overlay on your existing process.

<blockquote class="pull-quote">
<p>You don't "do Kanban"; you apply Kanban principles to what you already do.</p>
</blockquote>

**Core Philosophy:**
- Start with what you do now
- Agree to pursue incremental, evolutionary change
- Respect current roles, responsibilities, and job titles
- Encourage acts of leadership at all levels
- Focus on optimizing flow of value through the system

**Key Difference from Frameworks:**

Kanban is not a replacement for your current process. It's a lens through which you visualize, measure, and improve your existing workflow. You don't "do Kanban"; you apply Kanban principles to what you already do.

### Why Kanban Emerged

**The problem Kanban solves:**

Traditional batch-oriented processes (including Scrum sprints) create several problems:
- Work sits waiting between stages (handoffs)
- Too much work in progress creates context switching
- Bottlenecks are hidden until they cause delays
- Inflexible batching (sprint boundaries) delays urgent work
- Planning ceremonies create overhead

**Kanban addresses these through:**
- Visual workflow (make bottlenecks obvious)
- WIP limits (prevent overload)
- Continuous flow (no artificial batching)
- Pull-based system (work when capacity exists)
- Explicit policies (make process transparent)

### Historical Context

**Manufacturing origins (1940s-1950s):**

Toyota faced resource constraints and needed to compete with American mass production. Taiichi Ohno developed the Kanban system:
- Cards (kanban = "signboard" in Japanese) signal when to produce more parts
- Just-in-time production (build only what's needed)
- Pull-based system (downstream pulls from upstream)
- Visual management (see the state of the system at a glance)

**Adaptation to software (2000s):**

David J. Anderson applied these principles to software development at Microsoft and Corbis:
- Visualization of workflow on boards
- WIP limits prevent overload
- Measurement of flow (cycle time, throughput)
- Evolutionary change (improve existing process incrementally)

**Key insight:** Software development is more like maintenance and support (unpredictable arrival of varied work) than manufacturing (predictable production). Kanban's pull-based system handles this variability better than batch-oriented approaches.

### Kanban vs. Scrum

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Scrum</h4>
<ul>
<li>Replaces current process</li>
<li>Prescribed roles (PO, SM, Dev Team)</li>
<li>Fixed sprints (1-4 weeks)</li>
<li>Sprint commitment required</li>
<li>Metrics: Velocity (story points)</li>
<li>Low change tolerance mid-sprint</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Kanban</h4>
<ul>
<li>Overlays on current process</li>
<li>Keep existing roles</li>
<li>Continuous flow</li>
<li>No batched commitments</li>
<li>Metrics: Cycle time, throughput</li>
<li>High change tolerance</li>
</ul>
</div>
</div>

---

## Philosophy and Core Principles

### The Kanban Mindset

**Kanban is about making work visible, limiting WIP, and optimizing flow.**

**Start with what you do now:**
- Don't disrupt current process with wholesale change
- Apply Kanban to existing workflow
- Visualize what actually happens (not idealized process)
- Improve incrementally from current state

**Evolutionary change:**
- Small continuous improvements compound
- Low-risk changes build confidence
- Learn through experimentation
- Adapt based on data and feedback

**Respect existing structure:**
- Keep current roles and job titles
- Don't impose new organizational structures
- Work within existing constraints initially
- Reduce resistance through respect

**Encourage leadership at all levels:**
- Anyone can suggest improvements
- Empower team members to solve problems
- Data-driven decisions (not hierarchy-driven)
- Collaborative experimentation

### Core Principles

**1. Visualize the workflow:**

Making work visible reveals problems:
- Where is work stuck?
- What's in progress vs. waiting?
- Where are bottlenecks forming?
- How much WIP do we actually have?

**2. Limit Work in Progress (WIP):**

Explicit limits prevent overload:
- Focus on finishing, not starting
- Make capacity constraints visible
- Force prioritization decisions
- Reduce context switching

**3. Manage flow:**

Optimize the movement of work through the system:
- Measure cycle time and lead time
- Identify and remove bottlenecks
- Reduce variation in flow
- Create predictable delivery

**4. Make policies explicit:**

Document how work flows:
- Definition of ready (when work can start)
- Definition of done (when work is complete)
- Transition criteria between stages
- How to handle blocked work, expedited items

**5. Implement feedback loops:**

Regular reviews drive improvement:
- Daily standup (coordinate and unblock)
- Replenishment meeting (prioritize and pull new work)
- Service delivery review (analyze metrics)
- Operations review (identify improvements)

**6. Improve collaboratively, evolve experimentally:**

Continuous improvement through:
- Data-driven decisions (measure impact)
- Small experiments (reduce risk)
- Collaborative problem-solving (team ownership)
- Evolutionary change (incremental improvements)

### What Kanban Is NOT

**Kanban is not**:
- A project management framework (like Scrum)
- A replacement for your entire process
- Prescriptive about roles and ceremonies
- A way to eliminate planning or coordination
- About moving sticky notes on a board (that's just a tool)

**Kanban is**:
- A change management approach
- A way to visualize and improve existing process
- Principle-based (adapt to your context)
- A way to make planning and coordination more effective
- About optimizing flow through explicit policies and limits

---

## The Six Practices

### Practice 1: Visualize the Workflow

**What it means:**

Create a visual representation of how work actually flows through your system, from request to delivery.

**Why visualization matters:**

**Before visualization:**
- Work is invisible (scattered across tools, emails, conversations)
- Bottlenecks are hidden until they cause delays
- WIP is unknown (how many things are we working on?)
- Progress is unclear (is work moving or stuck?)

**After visualization:**
- Work is visible at a glance
- Bottlenecks are immediately obvious (work piles up)
- WIP is explicit (count items on board)
- Progress is transparent (watch work flow right)

**How to visualize workflow:**

**Step 1: Map your actual workflow**

Don't idealize; map what really happens:
- Where does work come from?
- What stages does it go through?
- Where does work wait?
- What's the definition of "done"?

**Example workflow:**
```
[Backlog] → [Ready] → [In Progress] → [Code Review] → [Testing] → [Deployed]
```

**Step 2: Create columns for each stage**

Each column represents a state work can be in:
- Waiting states (backlog, ready, queues)
- Active work states (in progress, code review, testing)
- Done state (deployed, in production)

**Step 3: Add swimlanes (optional)**

Horizontal rows categorize work:
- By work type (features, bugs, tech debt)
- By priority (expedite, standard, fixed delivery date)
- By team or skill set (backend, frontend, full-stack)

**Example board with swimlanes:**
```
                | Backlog | Ready | In Progress | Review | Testing | Done |
----------------|---------|-------|-------------|--------|---------|------|
Expedite        |         |       |     [1]     |        |         |      |
Standard        |   [5]   |  [3]  |   [2][3]    |  [4]   |   [5]   | [10] |
Fixed Date      |   [2]   |  [1]  |             |        |   [6]   |      |
```

**Step 4: Use cards for work items**

Each card represents one item:
- Brief title or ID
- Who's working on it (optional)
- How long it's been in current state
- Blocked status (if applicable)

**Types of Kanban boards:**

**Physical board:**
- Whiteboard with tape or magnetic columns
- Sticky notes for work items
- Visible to co-located teams
- Tactile and engaging

**Digital board:**
- Jira, Trello, Azure DevOps, etc.
- Accessible to distributed teams
- Automated metrics and reporting
- Integration with other tools

**How to do this well:**
- Keep it simple initially (3-5 columns)
- Add complexity only when needed
- Update in real-time (not end of day)
- Make it visible to stakeholders
- Use consistent card format

**Red flags:**
- Board doesn't reflect reality (stale or aspirational)
- Too many columns (overly complex)
- Cards sitting in one column for weeks
- Board updated infrequently
- Team ignores the board

---

### Practice 2: Limit Work in Progress (WIP)

**What it means:**

Set explicit limits on the number of items that can be in each stage of the workflow simultaneously.

**Why WIP limits matter:**

**High WIP (no limits):**
- Context switching reduces productivity
- Nothing finishes (everything is "almost done")
- Long cycle times (work takes forever)
- Late discovery of problems
- Hidden bottlenecks

**Low WIP (explicit limits):**
- Focus on finishing over starting
- Fast completion (work flows through)
- Short cycle times (work moves quickly)
- Early discovery of problems
- Visible bottlenecks (immediately obvious)

**The science behind WIP limits:**

**Little's Law (queuing theory):**
```
Lead Time = Work in Progress / Throughput

To reduce lead time:
- Reduce WIP (fewer items in progress), OR
- Increase throughput (finish faster)

Usually easier to reduce WIP than increase throughput.
```

**Cost of context switching:**

Research shows:
- Switching tasks costs 20-40% of productive time
- Deep work requires 15-30 minutes to achieve flow
- Interruptions destroy flow state
- Multitasking is sequential task switching, not parallel processing

**How to set WIP limits:**

**Step 1: Measure current WIP**

Count items currently in each column:
- Backlog: (often unlimited)
- Ready: 8 items
- In Progress: 10 items
- Code Review: 6 items
- Testing: 4 items
- Done: (unlimited)

**Step 2: Set initial limits conservatively**

Start with 1.5-2x current WIP:
- Ready: Limit 12
- In Progress: Limit 15
- Code Review: Limit 9
- Testing: Limit 6

**Why conservative:** Build confidence before tightening.

**Step 3: Reduce limits incrementally**

After 1-2 weeks, reduce by 1-2 items:
- Ready: Limit 10 (-2)
- In Progress: Limit 12 (-3)
- Code Review: Limit 7 (-2)
- Testing: Limit 5 (-1)

**Step 4: Find optimal limits**

Continue reducing until:
- Flow becomes constrained (too tight)
- Increase slightly to previous level
- This is your optimal WIP limit

**Typical WIP limits:**

**Per person:** 1-2 items
**Per team:** 1.5-2x team size
**Per column:** 2-4 items

**What happens when WIP limit is reached:**

**Option 1: Stop starting, start finishing**
- Help colleagues complete in-progress work
- Don't pull new work until capacity exists
- Focus on unblocking bottlenecks

**Option 2: Swarm the work**
- Team collaborates on oldest item
- Pair programming or mob programming
- Get it done and move to next item

**Option 3: Identify bottleneck**
- Why is work stuck?
- Skill shortage? Technical blocker? External dependency?
- Address root cause, not symptom

**WIP limit policies:**

**Strict limits (recommended):**
- No exceptions to WIP limits
- Forces prioritization and focus
- Creates urgency to finish

**Soft limits:**
- Limits can be exceeded temporarily
- Requires team discussion
- Risk: Limits become meaningless

**Split limits:**
- Active work limit + waiting work limit
- Example: "In Progress (3 active / 2 waiting)"
- Distinguishes working vs. blocked

**How to do this well:**
- Set explicit limits (visible on board)
- Enforce limits (no exceptions without discussion)
- When limit reached, help finish existing work
- Reduce limits incrementally (find optimal point)
- Track cycle time (measure improvement)

**Red flags:**
- WIP limits exist but are routinely ignored
- Limits too high (no constraint on behavior)
- Team starts new work instead of finishing existing
- Work sits "in progress" for weeks
- No improvement in cycle time

---

### Practice 3: Manage Flow

**What it means:**

Optimize the movement of work through the system by measuring flow, identifying bottlenecks, and making improvements.

**Why managing flow matters:**

**Batch-oriented thinking:**
- Measure velocity (story points per sprint)
- Focus on starting new work
- Batched releases (quarterly)
- Optimize local efficiency

**Flow-oriented thinking:**
- Measure cycle time and lead time
- Focus on finishing work
- Continuous delivery (daily)
- Optimize end-to-end flow

**Key flow metrics:**

**1. Lead Time**

Time from work request to delivery:
- Customer-facing metric (how long do they wait?)
- Includes time in backlog
- Example: 21 days from idea to production

**2. Cycle Time**

Time from starting work to completion:
- Internal metric (how long does work take?)
- Excludes time in backlog
- Example: 5 days from "In Progress" to "Done"

**3. Throughput**

Number of items completed per time period:
- Measures delivery rate
- Example: 12 items per week
- Higher throughput = more value delivered

**4. Work Item Age**

How long an item has been in the system:
- Aging items indicate problems
- Example: Item in "Code Review" for 8 days
- Triggers intervention

**How to manage flow:**

**Step 1: Measure baseline**

Track metrics for 2-4 weeks:
- Average cycle time: 8 days
- Average lead time: 15 days
- Throughput: 8 items per week
- Identify slowest stages

**Step 2: Identify bottlenecks**

Where does work pile up?
- Code Review column always at WIP limit
- Testing takes longest (5 days average)
- Work waiting for external dependencies

**Step 3: Optimize bottleneck**

Focus improvement on constraint:
- Bottleneck is Code Review → Add reviewers or pair program
- Bottleneck is Testing → Automate tests or add QA capacity
- Bottleneck is Dependencies → Reduce coupling or pre-coordinate

**Step 4: Measure improvement**

Track metrics after changes:
- Cycle time reduced from 8 days to 5 days
- Lead time reduced from 15 days to 10 days
- Throughput increased from 8 to 12 items per week

**Step 5: Identify next bottleneck**

Continuous improvement:
- Optimizing one bottleneck reveals next constraint
- Theory of Constraints applied to workflow
- Repeat cycle indefinitely

**Techniques for improving flow:**

**1. Reduce batch size**

Smaller items flow faster:
- Break large features into smaller stories
- Deploy more frequently (daily vs. weekly)
- Merge code multiple times per day

**2. Smooth flow**

Reduce variation:
- Standardize work item sizes (use estimation)
- Break down outliers (items >2x average)
- Limit different work types in same column

**3. Eliminate wait states**

Reduce delays between stages:
- Code review delays → Pair programming
- Approval delays → Empower teams to decide
- Deployment delays → Automate deployment

**4. Reduce dependencies**

Minimize external blockers:
- API changes → Versioning and backward compatibility
- Other teams → Cross-functional teams
- External approvals → Delegate authority

**5. Pull-based system**

Don't push work to next stage:
- Downstream pulls when capacity exists
- Prevents pile-ups at bottlenecks
- Respects WIP limits

**How to do this well:**
- Track cycle time and lead time continuously
- Identify and focus on bottlenecks
- Make one improvement at a time (isolate impact)
- Measure results (did cycle time improve?)
- Celebrate improvements (build momentum)

**Red flags:**
- No metrics tracked (can't manage what you don't measure)
- Metrics tracked but not acted upon
- Focusing on non-bottleneck improvements
- Cycle time increasing or stagnant
- Work piling up in same stage repeatedly

---

### Practice 4: Make Policies Explicit

**What it means:**

Document and communicate the rules, guidelines, and agreements that govern how work flows through the system.

**Why explicit policies matter:**

**Implicit policies (hidden rules):**
- Assumptions differ across team members
- Inconsistent behavior (everyone does it differently)
- Difficult to improve (can't change what's not defined)
- New team members confused
- Finger-pointing when things go wrong

**Explicit policies (documented rules):**
- Shared understanding of how work flows
- Consistent behavior (everyone follows same rules)
- Easy to improve (change policy, measure impact)
- New team members onboard quickly
- Objective basis for discussion

**Types of policies to make explicit:**

**1. Definition of Ready**

When is work ready to be pulled into "In Progress"?

**Example policy:**
- User story is written with acceptance criteria
- Design mockups attached (if UI work)
- Technical approach agreed upon
- No external blockers or dependencies
- Estimated to fit within WIP limits

**2. Definition of Done**

When is work complete and ready to move to "Done"?

**Example policy:**
- Code merged to main branch
- Unit tests written and passing
- Integration tests passing
- Code reviewed and approved
- Deployed to production (or behind feature flag)
- Documentation updated

**3. Transition Criteria**

What must be true to move from one column to the next?

**Example: "In Progress" → "Code Review"**
- Code committed to branch
- Self-review completed
- All tests passing locally
- Pull request created with description

**Example: "Code Review" → "Testing"**
- At least 1 approval from team member
- No outstanding change requests
- CI build passing
- Code merged to main

**4. WIP Limit Policies**

What happens when WIP limit is reached?

**Example policy:**
- If column at WIP limit, cannot pull new work
- Team members help finish existing work
- If work blocked, escalate to team lead
- Expedited items can exceed WIP limit with team agreement

**5. Prioritization Policies**

How is work prioritized?

**Example policy:**
- Expedite lane (P0 incidents) pulled immediately
- Fixed date items pulled at least 2 weeks before deadline
- Standard work pulled based on WSJF (Weighted Shortest Job First)
- Tech debt items: 1 per 5 feature items

**6. Class of Service**

How are different work types handled?

**Example policies:**

**Expedite (P0 incidents):**
- Can exceed WIP limits
- Immediately pulled when arrives
- Entire team swarms if needed
- Maximum 1 expedite item at a time

**Fixed Delivery Date:**
- Pulled at least 2 weeks before deadline
- Explicit deadline on card
- Escalate if at risk of missing deadline

**Standard:**
- Most work items
- Pulled when capacity exists
- Subject to WIP limits

**Intangible (Tech Debt, Learning):**
- Minimum 20% of capacity
- Pulled after higher priority work
- Not allowed to drop to zero

**7. Blocked Work Policies**

How do we handle blocked items?

**Example policy:**
- Mark card as blocked (red flag or label)
- Document blocker and expected resolution
- Daily standup: Discuss all blocked items
- If blocked >3 days, escalate to management
- Blocked work doesn't count toward WIP limit

**How to make policies explicit:**

**Step 1: Document current reality**

Write down how work actually flows:
- When do we consider work "ready"?
- What does "done" mean?
- How do we prioritize?
- What happens when blocked?

**Step 2: Get team agreement**

Discuss and agree on policies:
- Does this match our understanding?
- Should we change any policies?
- What's missing?
- Can everyone commit to following this?

**Step 3: Make policies visible**

Post policies where team can see them:
- On the Kanban board (write on board or post nearby)
- In team documentation (wiki, Confluence)
- In onboarding materials
- Refer to policies during standups and retrospectives

**Step 4: Enforce policies**

Policies mean nothing if not followed:
- Remind team when policies are violated
- Discuss in retrospectives if policies aren't working
- Update policies based on learnings

**Step 5: Evolve policies**

Policies should improve over time:
- Retrospectives identify policy improvements
- Experiment with changes (time-box)
- Measure impact (did flow improve?)
- Adopt successful changes permanently

**How to do this well:**
- Start with 2-3 core policies (don't boil the ocean)
- Make policies visible (on board, in docs)
- Get team agreement (not manager dictates)
- Evolve policies based on retrospectives
- Enforce policies consistently

**Red flags:**
- Policies exist but nobody follows them
- Policies are implicit (not documented)
- Policies haven't changed in months/years
- New team members don't know policies
- "Definition of done" differs by person

---

### Practice 5: Implement Feedback Loops

**What it means:**

Establish regular meetings and reviews that provide feedback on the process, enabling continuous improvement.

**Why feedback loops matter:**

**Without feedback loops:**
- Problems go unnoticed until crisis
- No mechanism for improvement
- Individual work in silos
- Misalignment on priorities
- Process stagnates

**With feedback loops:**
- Problems surface early
- Regular improvement cycles
- Team coordination
- Alignment on priorities
- Process evolves continuously

**Kanban Cadences (Meetings):**

Kanban defines four core cadences, each with different purpose and frequency:

**1. Daily Standup (Daily)**

**Purpose:** Coordinate work and unblock impediments

**Duration:** 15 minutes maximum

**Participants:** Team members working on items

**Format:**
- Walk the board from right to left (focus on finishing)
- For each item: Who's working on it? Any blockers? When will it be done?
- Discuss blocked items (how to unblock?)
- Identify who will help finish work if WIP limit reached

**Not a status report to management; it's team coordination.**

**Key differences from Scrum standup:**
- Walk the board (not round-robin per person)
- Focus on work items (not "what I did yesterday")
- Emphasis on finishing (not starting)
- Discuss WIP limits and flow

**Example standup:**
```
Team: "Let's start with Testing column, which is at WIP limit."
Dev A: "I'm finishing the login bug fix today."
Dev B: "I can help test the payment feature to free up space."
Team: "Code Review has 3 items waiting. Who can review?"
Dev C: "I'll knock out two reviews this morning."
```

**2. Replenishment Meeting (Weekly or as needed)**

**Purpose:** Prioritize and pull new work into the system

**Duration:** 30-60 minutes

**Participants:** Team + Product Owner/Stakeholders

**Format:**
- Review current WIP and capacity
- Prioritize backlog based on value and urgency
- Pull highest priority items into "Ready" column
- Ensure work meets "Definition of Ready"
- Discuss upcoming work and dependencies

**Key difference from sprint planning:**
- Happens regularly based on need (not fixed cadence)
- Pull only enough work to fill capacity (not batched commitment)
- Can happen multiple times per week if work flows quickly

**Example replenishment:**
```
PO: "We have capacity for 5 new items this week."
Team: "Top priority is the checkout bug fix."
PO: "Agreed. Next is the mobile app feature?"
Team: "Do we have designs? We need them before starting."
PO: "Designs ready tomorrow. Let's pull that Wednesday."
```

**3. Service Delivery Review (Bi-weekly or Monthly)**

**Purpose:** Analyze metrics and identify improvement opportunities

**Duration:** 30-60 minutes

**Participants:** Team + Stakeholders

**Format:**
- Review flow metrics (cycle time, lead time, throughput)
- Identify trends (improving or degrading?)
- Discuss outliers (items that took unusually long)
- Analyze blockers and wait times
- Identify improvement opportunities

**Key metrics to review:**

**Cycle time trend:**
- Average: 5 days (down from 7 days last month) ✅
- 85th percentile: 9 days (indicates variability)

**Lead time trend:**
- Average: 12 days (down from 15 days) ✅

**Throughput:**
- 15 items completed (up from 12) ✅

**Aging items:**
- 3 items >10 days old (investigate)

**Blockers:**
- 8 items blocked this period (reduced from 12) ✅

**Example review:**
```
Manager: "Cycle time is down 2 days. What changed?"
Team: "We reduced WIP limit in Code Review from 5 to 3."
Manager: "Great. But 3 items are aging. What's blocking them?"
Team: "Waiting on API changes from Platform team. We'll escalate."
```

**4. Operations Review (Monthly or Quarterly)**

**Purpose:** Review process and identify systemic improvements

**Duration:** 60-90 minutes

**Participants:** Team + Management + Stakeholders

**Format:**
- Review service delivery metrics over longer period
- Identify patterns and systemic issues
- Discuss process changes and experiments
- Evaluate impact of previous improvements
- Plan next improvements (retrospective-style)

**Topics to cover:**

**Process effectiveness:**
- Are WIP limits working?
- Are policies being followed?
- Where are persistent bottlenecks?

**Team health:**
- Is workload sustainable?
- Is team growing in capability?
- Are there skill gaps?

**Business alignment:**
- Are we delivering the right things?
- Is quality meeting expectations?
- Are stakeholders satisfied?

**Experiments and improvements:**
- What have we tried since last review?
- What worked? What didn't?
- What should we try next?

**Example operations review:**
```
Manager: "Over the quarter, cycle time reduced from 10 days to 5 days."
Team: "Automated testing and pair programming made the biggest impact."
Manager: "What should we focus on next quarter?"
Team: "Reducing dependencies on Platform team. Can we get dedicated support?"
```

**How to do this well:**
- Schedule cadences regularly (don't skip)
- Keep meetings time-boxed (respect durations)
- Focus on data (metrics, not opinions)
- Make decisions and track action items
- Celebrate improvements (build momentum)

**Red flags:**
- Meetings canceled or skipped regularly
- No metrics reviewed (opinions instead of data)
- Same issues discussed repeatedly without resolution
- No action items or follow-through
- Meetings feel like status reports (not improvement)

---

### Practice 6: Improve Collaboratively, Evolve Experimentally

**What it means:**

Make improvements through team collaboration and data-driven experiments, not top-down mandates.

**Why collaborative improvement matters:**

**Top-down change:**
- Resistance from team (not their idea)
- Misses on-the-ground realities
- Low engagement and ownership
- Often fails to stick

**Collaborative change:**
- Team ownership (their idea, they implement)
- Grounded in actual problems
- High engagement and commitment
- Sustainable improvements

**How to improve collaboratively:**

**1. Make problems visible**

Use data to identify opportunities:
- Metrics show cycle time increasing
- Board shows work piling up in Code Review
- Team members report frustration with blockers

**2. Collaborative problem-solving**

Team discusses solutions together:
- What's causing the problem?
- What have we tried before?
- What could we experiment with?
- How will we know if it works?

**3. Small experiments**

Try changes incrementally:
- Time-box experiment (2 weeks)
- Change one variable at a time
- Measure impact (did metrics improve?)
- Adopt, adapt, or abandon based on results

**4. Shared ownership**

Everyone participates:
- Anyone can suggest improvements
- Team agrees on experiments
- Everyone commits to trying it
- Retrospectives evaluate results

**Experimental approach:**

**Traditional change:**
- Manager decides solution
- Team implements mandate
- No measurement of impact
- Change becomes permanent (even if ineffective)

**Experimental change:**
- Team identifies problem
- Team proposes experiment
- Try for defined period (2 weeks)
- Measure impact (did it help?)
- Adopt if successful, abandon if not

**Example experiment:**

**Problem:** Code reviews take too long (average 3 days)

**Hypothesis:** Pair programming will reduce code review time

**Experiment:**
- For 2 weeks, all features done via pair programming
- Measure code review time during experiment
- Measure cycle time overall

**Results:**
- Code review time reduced to <1 day (87% improvement)
- Cycle time reduced from 8 days to 5 days
- Team reports higher confidence in code quality

**Decision:** Adopt pair programming for complex features

**Types of experiments to try:**

**Process experiments:**
- Reduce WIP limits (does cycle time improve?)
- Add "Waiting" columns (make wait states visible)
- Change standup format (walk board vs. round-robin)
- Implement pair programming (reduce code review delays)

**Policy experiments:**
- Tighten "Definition of Ready" (reduce rework)
- Change prioritization rules (focus on value)
- Implement class of service (expedite lane)
- Reserve capacity for tech debt (20% rule)

**Board design experiments:**
- Split columns (doing vs. waiting)
- Add swimlanes (by work type or priority)
- Simplify board (fewer columns)
- Change card information (add aging indicators)

**How to do this well:**
- Time-box experiments (2-4 weeks)
- Change one thing at a time (isolate impact)
- Measure before and after (data-driven decisions)
- Team agrees on experiment (collaborative)
- Review results and decide (adopt, adapt, abandon)

**Red flags:**
- Changes mandated from above (no team input)
- No measurement of impact (opinions replace data)
- Changes made permanent without evaluation
- Failed experiments blamed on team
- No retrospectives or improvement discussions

---

## Designing Your Kanban Board

Your Kanban board should reflect your actual workflow, not an idealized process. Start simple and evolve based on learnings.

### Basic Board Structure

**Minimum viable board:**
```
[Backlog] → [In Progress (WIP: 3)] → [Done]
```

**Start here and add complexity only when needed.**

### Common Board Patterns

**Pattern 1: Simple workflow**
```
[Backlog] → [Ready] → [Doing (WIP: 3)] → [Done]
```

**When to use:** Small teams, straightforward process, just getting started with Kanban

---

**Pattern 2: Split columns (Doing/Waiting)**
```
[Backlog] → [Ready] → [Doing | Waiting] → [Review: Doing | Waiting] → [Done]
                      (WIP: 2  |  1)       (WIP: 1  |  2)
```

**When to use:** Want to make wait states visible, distinguish active work from blocked work

**Benefits:**
- Visualizes where work is stuck vs. actively progressing
- WIP limits apply to active work (doing) and waiting separately
- Highlights bottlenecks (waiting columns fill up)

---

**Pattern 3: Detailed workflow**
```
[Backlog] → [Ready] → [Dev] → [Code Review] → [Testing] → [Deploy] → [Done]
              (3)      (4)         (3)            (2)         (2)
```

**When to use:** More complex workflow with distinct stages, want granular visibility

**Benefits:**
- Identifies specific bottlenecks (which stage is slowest?)
- Different WIP limits per stage reflect capacity
- Clear handoffs and responsibilities

---

**Pattern 4: Swimlanes by priority**
```
                | Backlog | Ready | In Progress | Review | Done |
----------------|---------|-------|-------------|--------|------|
Expedite        |         |       |     [1]     |        |      |
Fixed Date      |   [3]   |  [1]  |     [2]     |  [1]   | [5]  |
Standard        |  [15]   |  [5]  |   [4][5]    |  [2]   | [20] |
```

**When to use:** Need to manage different priorities, want explicit expedite lane

**Benefits:**
- Visualizes work by priority class
- Expedite lane makes urgent work obvious
- Fixed date items tracked separately

---

**Pattern 5: Swimlanes by work type**
```
                | Backlog | Ready | In Progress | Review | Done |
----------------|---------|-------|-------------|--------|------|
Features        |  [10]   |  [3]  |   [2][3]    |  [1]   | [15] |
Bugs            |   [5]   |  [2]  |     [4]     |  [2]   | [8]  |
Tech Debt       |   [8]   |  [1]  |     [5]     |        | [3]  |
```

**When to use:** Track different work types separately, ensure balanced attention

**Benefits:**
- Visualizes mix of work
- Ensures tech debt doesn't get neglected
- Tracks bugs separately from features

---

### Card Design

**Minimum information on each card:**
- Title or ID
- Brief description
- Current owner (optional)

**Additional useful information:**
- Age (how many days in current column)
- Blocked indicator (red flag or icon)
- Work item type (feature, bug, tech debt)
- Size estimate (S/M/L or story points)
- Deadline (if fixed delivery date)

**Example card:**
```
┌─────────────────────────┐
│ #1234 - Login Bug Fix  │
│ Age: 3 days            │
│ Owner: Alice           │
│ [BLOCKED: API change]  │
└─────────────────────────┘
```

### Board Evolution

**Month 1: Start simple**
- 3 columns (Backlog, Doing, Done)
- WIP limit on Doing column
- Basic cards (just title)

**Month 2: Add granularity**
- Split Doing into Dev and Review
- WIP limits on each column
- Add card information (age, owner)

**Month 3: Add visibility**
- Split columns (Doing/Waiting)
- Add blocked indicators
- Track aging work

**Month 4: Refine and optimize**
- Adjust WIP limits based on data
- Simplify if too complex
- Streamline based on team feedback

**Don't over-engineer the board upfront. Let it evolve based on what you learn.**

---

## Metrics and Measurement

Kanban relies on data-driven improvement. Track these key metrics to understand and optimize flow.

### Core Flow Metrics

**1. Cycle Time**

**Definition:** Time from starting work to completion

**How to measure:**
- Start: When card moves to "In Progress"
- End: When card reaches "Done"
- Calculate: Average, median, 85th percentile

**Example:**
- Item A: 3 days
- Item B: 5 days
- Item C: 12 days (outlier)
- Average: 6.7 days
- Median: 5 days
- 85th percentile: 10 days

**Why median and percentile matter:**
Outliers skew averages, while median represents a typical item. The 85th percentile gives a reasonable upper bound for forecasting.

**Target:** Decreasing over time

---

**2. Lead Time**

**Definition:** Time from work request to delivery (includes backlog time)

**How to measure:**
- Start: When item enters "Backlog"
- End: When card reaches "Done"
- Customer-facing metric (how long do they wait?)

**Example:**
- Request arrives Monday
- Starts work Thursday (3 days in backlog)
- Completed following Tuesday (5 days cycle time)
- Lead time: 8 days total

**Target:** Decreasing over time

---

**3. Throughput**

**Definition:** Number of items completed per time period

**How to measure:**
- Count items in "Done" column
- Per week, per sprint, per month
- Higher throughput = more value delivered

**Example:**
- Week 1: 8 items completed
- Week 2: 12 items completed
- Week 3: 10 items completed
- Average throughput: 10 items/week

**Target:** Stable or increasing over time

---

**4. Work Item Age**

**Definition:** How long an item has been in current stage

**How to measure:**
- Track days since entering current column
- Flag items exceeding threshold (e.g., >5 days)
- Investigate and unblock aging items

**Example:**
- Item in Code Review for 1 day: Normal
- Item in Code Review for 7 days: Flag and investigate

**Target:** Few or no aging items

---

**5. Flow Efficiency**

**Definition:** Percentage of time actively adding value vs. waiting

**How to measure:**
```
Flow Efficiency = Active Time / Total Time

Example:
- Total lead time: 20 days
- Active work time: 5 days (dev + review + test)
- Waiting time: 15 days (queues, blocked, handoffs)
- Flow Efficiency: 5/20 = 25%
```

**Typical flow efficiency in software:**
- Poor: <10% (mostly waiting)
- Average: 15-25%
- Good: 40-60%
- Excellent: >80% (rare)

**Target:** Increasing over time (reduce wait states)

---

### Cumulative Flow Diagram (CFD)

**What it is:**

A stacked area chart showing the distribution of work items across workflow stages over time.

**What it reveals:**

**Stable flow:**
- Parallel bands (work moving consistently)
- Consistent distance between bands (predictable cycle time)
- Steady upward slope (consistent throughput)

**Bottleneck:**
- One band expanding (work piling up)
- Bands converging below (upstream starved)
- Growing distance between bands (increasing cycle time)

**Variable flow:**
- Jagged bands (inconsistent work arrival or completion)
- Unpredictable cycle times
- Difficult to forecast

**Example interpretation:**
```
If "Code Review" band is expanding while "In Progress" band is shrinking:
→ Code Review is the bottleneck
→ Focus improvement there (add reviewers, pair programming)
```

---

### Using Metrics for Forecasting

**Question:** "When will this feature be done?"

**Probabilistic forecast using data:**

**Step 1: Calculate cycle time distribution**
- 50th percentile (median): 5 days
- 85th percentile: 8 days
- 95th percentile: 12 days

**Step 2: Provide probabilistic estimate**
- 50% confident: 5 days
- 85% confident: 8 days
- 95% confident: 12 days

**Better than:**
- "It'll be done in 5 days" (false precision)
- "Not sure, maybe a week or two?" (no data)

---

### How to Track Metrics

**Manual tracking (spreadsheet):**
- Record start date and end date for each item
- Calculate cycle time (end - start)
- Chart trends over time

**Tool-based tracking (Jira, Azure DevOps):**
- Automatic cycle time calculation
- Built-in cumulative flow diagrams
- Dashboards with key metrics

**Simple is better than perfect:**
- Start with basic spreadsheet
- Track cycle time for 2-4 weeks
- Upgrade to tool if manual tracking burdensome

---

## Roles and Responsibilities

Kanban respects existing roles and doesn't prescribe new ones. However, certain responsibilities must be filled.

### Core Responsibilities

**1. Team Members**

**Responsibilities:**
- Pull work when capacity exists
- Update board in real-time
- Respect WIP limits
- Help unblock work
- Participate in improvement

**Skills:**
- Technical expertise
- Collaboration
- Problem-solving
- Continuous learning

---

**2. Service Delivery Manager / Team Lead**

**Responsibilities:**
- Facilitate Kanban meetings
- Track and report metrics
- Remove impediments
- Coach team on Kanban practices
- Protect team from interruptions

**Not a traditional project manager:**
- Doesn't assign tasks (team pulls work)
- Doesn't track individual productivity (tracks flow)
- Doesn't control process (team owns improvement)

**Skills:**
- Facilitation
- Data analysis
- Coaching and mentoring
- Systems thinking

---

**3. Product Owner / Service Request Manager**

**Responsibilities:**
- Prioritize backlog
- Define acceptance criteria
- Participate in replenishment meetings
- Validate completed work
- Represent stakeholder needs

**Skills:**
- Product knowledge
- Prioritization and trade-offs
- Stakeholder management
- Understanding of customer value

---

**4. Everyone**

**Shared responsibilities:**
- Suggest improvements
- Follow explicit policies
- Focus on flow (not local optimization)
- Collaborate to unblock work
- Participate in retrospectives

---

## Implementing Kanban

Kanban is designed for evolutionary change. Start where you are and improve incrementally.

### Getting Started (Week 1-2)

**Day 1: Visualize current workflow**

1. Gather team and whiteboard
2. Map actual workflow (how work really flows)
3. Create columns for each stage
4. Write cards for all current work
5. Place cards in appropriate columns

**Don't change anything yet; just visualize.**

**Day 2-7: Measure baseline**

1. Track how long work sits in each column
2. Count current WIP per column
3. Identify where work piles up
4. Measure cycle time for completed items
5. Share observations with team

**Week 2: Set initial WIP limits**

1. Count current WIP per column
2. Set limits at 1.5-2x current WIP
3. Write limits on board (visible)
4. Agree on what happens when limit reached
5. Start enforcing limits

---

### Weeks 3-4: Establish Cadences

**Week 3: Start daily standups**

1. Schedule 15-minute daily standup
2. Walk the board right to left
3. Focus on finishing work
4. Discuss blockers and aging items
5. Identify who will help if WIP limit reached

**Week 4: Start replenishment meetings**

1. Schedule weekly replenishment meeting
2. Review capacity and WIP
3. Prioritize backlog items
4. Pull highest priority work into "Ready"
5. Ensure work meets "Definition of Ready"

---

### Months 2-3: Refine and Optimize

**Month 2: Make policies explicit**

1. Document "Definition of Ready"
2. Document "Definition of Done"
3. Document transition criteria
4. Post policies on/near board
5. Discuss in standups when violated

**Month 2: Reduce WIP limits**

1. Reduce limits by 1-2 items per column
2. Observe impact on flow
3. Continue reducing until constrained
4. Find optimal limits (maximum flow, minimum WIP)

**Month 3: Start service delivery reviews**

1. Schedule bi-weekly metric review
2. Analyze cycle time, lead time, throughput
3. Identify trends and outliers
4. Discuss improvement opportunities
5. Plan experiments

---

### Months 4-6: Continuous Improvement

**Month 4: Optimize bottlenecks**

1. Identify persistent bottlenecks (from metrics)
2. Collaborative problem-solving
3. Implement small experiments
4. Measure impact
5. Adopt successful changes

**Month 5: Refine board design**

1. Add split columns (Doing/Waiting) if needed
2. Add swimlanes if managing multiple priorities
3. Simplify if board too complex
4. Update based on team feedback

**Month 6: Establish operations reviews**

1. Schedule quarterly operations review
2. Review metrics over longer period
3. Evaluate process changes
4. Discuss team health and capability
5. Plan next quarter improvements

---

### Transition from Scrum to Kanban

**If your team currently uses Scrum:**

**Week 1-2: Add Kanban board**

1. Visualize sprint work on Kanban board
2. Track cycle time during sprint
3. Continue with sprint ceremonies
4. Compare velocity to throughput

**Week 3-4: Set WIP limits**

1. Limit work in progress during sprint
2. Measure impact on cycle time
3. Continue sprint boundaries for now

**Week 5-8: Extend sprint length or reduce it to 1 week**

1. Experiment with flow within sprint
2. Deploy when ready (not waiting for sprint end)
3. Measure cycle time and compare to velocity
4. Discuss learnings in retrospective

**Week 9-12: Transition to continuous flow**

1. Stop batching work into sprints
2. Pull work continuously when capacity exists
3. Deploy daily (or multiple times per day)
4. Keep retrospectives every 2 weeks

**Month 4+: Refine Kanban practices**

1. Optimize WIP limits
2. Implement all Kanban cadences
3. Focus on flow metrics
4. Continuous improvement

---

### Common Obstacles and Solutions

**Obstacle 1: "We need sprint commitments for planning"**

**Solution:**
- Forecast using throughput and cycle time
- Probabilistic estimates more accurate than commitments
- Demonstrate predictability with historical data

**Obstacle 2: "Our stakeholders expect fixed-scope sprints"**

**Solution:**
- Start with Kanban within sprints
- Show faster delivery and higher quality
- Gradually transition to continuous flow

**Obstacle 3: "WIP limits are too restrictive"**

**Solution:**
- Start with conservative limits
- Demonstrate faster cycle time and throughput
- Show data that WIP limits improve flow
- Reduce incrementally

**Obstacle 4: "Too many urgent interruptions"**

**Solution:**
- Implement expedite lane (1 item max)
- Make cost of interruptions visible
- Set explicit policy (what qualifies as expedite?)
- Reserve capacity for expected interruptions

**Obstacle 5: "Our work is too varied to visualize"**

**Solution:**
- Start with broad categories (Doing, Done)
- Add granularity only when needed
- Use swimlanes to separate work types
- Track multiple work item types

---

## Alignment with AAA Cycle

Kanban's emphasis on flow, transparency, and continuous improvement naturally supports the AAA Cycle.

### How Kanban Supports AAA

**Align Phase: Visualization + Explicit Policies**

Kanban's visualization and policies support alignment:

**Visualization:**
- Make work visible to all stakeholders
- Transparency prevents misunderstandings
- Board shows what's actually happening (not idealized)
- Alignment emerges from shared visibility

**Explicit Policies:**
- "Definition of Ready" ensures alignment before starting
- Clear acceptance criteria prevent misunderstandings
- Transition criteria make expectations explicit

**Example:**
Product Owner and team review "Ready" column in replenishment meeting. Work not meeting "Definition of Ready" stays in backlog until aligned.

---

**Agree Phase: WIP Limits + Pull-Based System**

Kanban's constraints support genuine agreement:

**WIP Limits:**
- Force honest conversation about capacity
- Prevent over-commitment
- Team agrees on sustainable pace
- Limits make agreement explicit

**Pull-Based System:**
- Team pulls work when capacity exists
- No pushing more work than team can handle
- Agreement on priorities (replenishment meeting)
- Sustainable commitments, not coerced

**Example:**
Replenishment meeting: "We have capacity for 3 items this week. Which are highest priority?" Team and PO agree on what to pull.

---

**Apply Phase: Flow Management + Continuous Delivery**

Kanban's focus on flow supports honoring agreements:

**Flow Management:**
- Track cycle time (measure delivery speed)
- Identify bottlenecks (remove impediments)
- Optimize throughput (deliver more value)
- Predictable delivery through stable flow

**Continuous Delivery:**
- Deploy when ready (not batched)
- Fast feedback validates agreements
- Course correction when needed

**Example:**
Team commits to 5-day cycle time average. Metrics show cycle time increasing to 7 days. Team investigates bottleneck, improves, honors commitment.

---

### Where Kanban Can Conflict with AAA

**Potential conflict: Continuous flow without continuous alignment**

**Problem:**
Team delivers continuously but stakeholders aren't involved in steering. Work flows but may not be aligned with current needs.

**Solution:**
Regular replenishment meetings ensure continuous alignment. Pull work based on current priorities, not stale backlog.

**Potential conflict: Focusing on flow efficiency at expense of outcome validation**

**Problem:**
Optimizing cycle time and throughput without validating customer value.

**Solution:**
Service delivery reviews include outcome metrics (usage, satisfaction), not just flow metrics.

**Potential conflict: No explicit agreements (just continuous flow)**

**Problem:**
Work pulled continuously without clear success criteria or outcomes.

**Solution:**
Explicit policies include acceptance criteria. Definition of Done ensures agreements are clear before work starts.

---

### Using Kanban to Strengthen AAA

**Make alignment visible:**
- Board shows what's in progress (transparency)
- Replenishment meetings align on priorities
- Definition of Ready ensures alignment before starting

**Make agreements explicit:**
- WIP limits = capacity agreement
- Definition of Done = outcome agreement
- Policies document expectations

**Honor commitments through flow:**
- Track cycle time (measure delivery speed)
- Predictable delivery through stable flow
- Continuous improvement honors commitment to quality

**AAA + Kanban in practice:**

**Align:** Replenishment meetings, explicit policies, visual transparency
**Agree:** WIP limits (capacity), Definition of Done (outcomes), prioritization
**Apply:** Flow optimization, continuous delivery, predictable cycle times

---

## When to Use Kanban

### Kanban Works Well For:

**Maintenance and support work:**
- Unpredictable arrival of work
- Varied request types
- Need to respond quickly
- Continuous flow better than batching

**Operations teams:**
- DevOps, SRE, platform teams
- Mix of planned work and interruptions
- Need to balance reactive and proactive work
- Expedite lane for incidents

**Teams handling varied request types:**
- Features, bugs, tech debt, support requests
- Different priorities and urgencies
- Need visual prioritization
- Swimlanes categorize work

**Teams wanting continuous delivery:**
- Deploy multiple times per day
- No sprint boundaries needed
- Fast feedback and iteration
- Cloud-native architectures

**Teams wanting to improve existing process:**
- Start with current state (no disruption)
- Overlay Kanban on existing workflow
- Evolve incrementally
- Low-risk change management approach

**Mature, self-organizing teams:**
- Don't need prescriptive structure
- Value autonomy and flexibility
- Focus on flow and outcomes
- Continuous improvement mindset

**Projects with changing priorities:**
- Priorities shift frequently
- Need flexibility to reprioritize
- Sprint commitments too rigid
- Pull-based system adapts quickly

---

### Kanban May Not Fit:

**Teams new to Agile:**
- May benefit from Scrum's explicit structure initially
- Kanban assumes self-organization capability
- Lack of prescribed roles and ceremonies can feel unstructured

**Projects requiring fixed-scope commitments:**
- Client contracts with defined deliverables
- Fixed-bid projects
- Regulatory requirements for specific scope
- Kanban's flexibility may conflict with contracts

**Teams needing explicit time-boxing:**
- Benefit from sprint boundaries (forcing function)
- Need regular demo cadence
- Stakeholders expect sprint reviews
- Time-boxed iterations provide structure

**Large programs requiring coordination:**
- Multiple teams with dependencies
- Need structured planning events (PI planning)
- May need SAFe or LeSS for scaling
- Kanban better for single-team workflows

**Teams requiring extensive planning:**
- Complex, long-running projects
- Need upfront architectural design
- Hardware-software integration
- May need hybrid (plan upfront, then Kanban)

---

### Hybrid Approaches

**Kanban + Scrum (Scrumban):**
- Use Scrum roles (PO, SM) with Kanban board
- Keep retrospectives, remove sprint planning
- Continuous flow instead of sprints
- Pull work when capacity exists

**Kanban + DevOps:**
- Visualize deployment pipeline
- WIP limits for each stage (build, test, deploy)
- Continuous delivery through Kanban flow
- Track deployment metrics

**Kanban + Lean:**
- Natural combination
- Kanban operationalizes Lean principles
- Visual management = Lean transparency
- WIP limits = Lean waste elimination

**Kanban for features, Scrum for sprints:**
- Some teams use Scrum for planning cadence
- Kanban for workflow visualization within sprint
- Get benefits of both approaches

---

## Common Pitfalls and Red Flags

### Pitfall 1: No WIP Limits or Ignored Limits

**Problem:**

Team creates Kanban board but doesn't set or enforce WIP limits.

**Why it's wrong:**

Without WIP limits, Kanban is just a visual board. You lose the constraint that forces prioritization and finishing work.

**What actually happens:**
- Work piles up in progress
- Context switching continues
- Cycle time doesn't improve
- Team doesn't experience benefits

**How to avoid:**
- Set explicit WIP limits from day one
- Enforce limits (no exceptions)
- When limit reached, help finish existing work
- Review and adjust limits based on data

**Red flags:**
- "In Progress" column has 20 items for 5-person team
- WIP limits exist but are routinely ignored
- Starting new work instead of finishing existing
- No improvement in cycle time

---

### Pitfall 2: Board Doesn't Reflect Reality

**Problem:**

Board is idealized or not updated in real-time.

**Why it's wrong:**

Kanban's power comes from visualization. If board doesn't reflect reality, you lose visibility and transparency.

**What actually happens:**
- Team stops trusting the board
- Metrics are inaccurate
- Can't identify real bottlenecks
- Board becomes theater (not useful)

**How to avoid:**
- Update board in real-time (as work happens)
- Walk the board daily (validate accuracy)
- Make updating board part of workflow
- Keep board simple (easier to maintain)

**Red flags:**
- Cards sitting in "Done" for days before being cleared
- Work happening that's not on board
- Board updated once per week (batch update)
- Team refers to external tools (not board)

---

### Pitfall 3: No Metrics Tracked

**Problem:**

Team uses Kanban board but doesn't track cycle time, lead time, or throughput.

**Why it's wrong:**

Can't improve what you don't measure. Without metrics, improvements are guesses.

**What actually happens:**
- No data to identify bottlenecks
- Can't demonstrate improvement
- Can't forecast delivery
- Process stagnates

**How to avoid:**
- Track cycle time from day one
- Review metrics in service delivery reviews
- Use data to identify improvements
- Celebrate improvements with data

**Red flags:**
- "We're doing Kanban" but no metrics tracked
- Can't answer "what's our average cycle time?"
- Decisions based on opinions, not data
- No service delivery reviews

---

### Pitfall 4: Treating Kanban as Just a Visual Board

**Problem:**

Team thinks Kanban is just moving sticky notes, misses deeper practices.

**Why it's wrong:**

Visualization is just the first practice. WIP limits, flow management, explicit policies, feedback loops, and improvement are essential.

**What actually happens:**
- Board exists but flow doesn't improve
- No WIP limits or policies
- No regular meetings or metrics
- Kanban perceived as ineffective

**How to avoid:**
- Learn all six Kanban practices
- Implement WIP limits and explicit policies
- Establish feedback loops (meetings)
- Focus on continuous improvement

**Red flags:**
- "We do Kanban—we have a board"
- No WIP limits, policies, or metrics
- No regular cadences (standups, reviews)
- Board is static (not evolving)

---

### Pitfall 5: No Explicit Policies

**Problem:**

Team uses Kanban board but doesn't document policies (Definition of Ready, Definition of Done, transition criteria).

**Why it's wrong:**

Without explicit policies, everyone interprets rules differently. Inconsistent behavior and confusion result.

**What actually happens:**
- Work pulled that's not ready (rework)
- "Done" means different things to different people
- Inconsistent quality
- Finger-pointing when expectations differ

**How to avoid:**
- Document "Definition of Ready" and "Definition of Done"
- Write transition criteria for each column
- Post policies visibly on/near board
- Review and enforce policies

**Red flags:**
- "When is work ready to start?" gets different answers
- "Done" work requires rework
- Frequent misunderstandings about status
- Policies not documented or visible

---

### Pitfall 6: Not Reducing WIP Limits Over Time

**Problem:**

Team sets initial WIP limits but never reduces them.

**Why it's wrong:**

Initial WIP limits are conservative. Reducing limits incrementally forces better flow and uncovers bottlenecks.

**What actually happens:**
- Limits too high to constrain behavior
- No improvement in cycle time
- Benefits of WIP limits not realized

**How to avoid:**
- Review WIP limits monthly
- Reduce by 1-2 items incrementally
- Measure impact on cycle time
- Find optimal limits through experimentation

**Red flags:**
- WIP limits haven't changed in months
- Limits rarely reached (too high)
- Cycle time not improving
- No experimentation with limits

---

### Pitfall 7: No Feedback Loops (Meetings)

**Problem:**

Team uses Kanban board but doesn't hold regular standup, replenishment, or review meetings.

**Why it's wrong:**

Feedback loops are where coordination, prioritization, and improvement happen. Without them, team works in silos and process stagnates.

**What actually happens:**
- No coordination (work gets blocked)
- No reprioritization (stale priorities)
- No improvement (process stagnates)
- Kanban feels ineffective

**How to avoid:**
- Schedule daily standup (15 minutes)
- Schedule weekly replenishment meeting
- Schedule bi-weekly service delivery review
- Track action items and follow through

**Red flags:**
- "We don't need meetings, we have a board"
- Standups canceled or skipped
- No metrics reviewed
- No improvement discussions

---

### Pitfall 8: Focusing Only on Speed

**Problem:**

Team optimizes cycle time without validating outcomes or quality.

**Why it's wrong:**

Fast delivery of the wrong thing or poor quality is waste. Balance speed with value and quality.

**What actually happens:**
- Cycle time improves but customer satisfaction drops
- Quality issues emerge (defects in production)
- Technical debt accumulates
- Short-term speed, long-term slowdown

**How to avoid:**
- Track outcome metrics (usage, satisfaction, quality)
- Include "Definition of Done" quality criteria
- Reserve capacity for tech debt
- Balance speed with sustainability

**Red flags:**
- Cycle time improving but quality declining
- Customers complaining about bugs
- Technical debt growing
- Team burning out from unsustainable pace

---

### Red Flags Summary

**Process red flags:**
- Board doesn't reflect reality
- No WIP limits or limits ignored
- No metrics tracked
- No regular meetings

**Policy red flags:**
- Policies not documented or explicit
- "Definition of Done" differs by person
- Inconsistent behavior across team

**Improvement red flags:**
- WIP limits never change
- No experiments or process changes
- Metrics don't improve over time
- No retrospectives or reviews

**Focus red flags:**
- Optimizing speed without validating outcomes
- Quality declining
- Team burnout from unsustainable pace

---

## Key Takeaways

**Kanban is an evolutionary change management approach:**
- Start with current process (don't disrupt)
- Visualize to identify problems
- Improve incrementally through experiments

**The six practices work together:**
- Visualize workflow (make problems visible)
- Limit WIP (force focus on finishing)
- Manage flow (optimize cycle time and throughput)
- Make policies explicit (shared understanding)
- Implement feedback loops (coordination and improvement)
- Improve collaboratively (team ownership, data-driven)

**WIP limits are the key constraint:**
- Force prioritization
- Prevent context switching
- Make bottlenecks visible
- Enable faster flow

**Metrics drive improvement:**
- Cycle time and lead time measure flow
- Throughput measures delivery rate
- Data identifies bottlenecks and improvements
- Probabilistic forecasting replaces estimates

**Kanban aligns with AAA:**
- Visualization supports alignment
- WIP limits enable genuine agreement
- Flow optimization honors commitments

**Start simple and evolve:**
- Begin with basic board (3 columns)
- Add complexity only when needed
- Experiment and measure impact
- Let process evolve based on learnings

**The goal is flow, not moving sticky notes.**
