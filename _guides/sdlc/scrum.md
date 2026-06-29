---
title: "Scrum Methodology"
layout: guide
category: Software Development Lifecycle
subcategory: SDLC Fundamentals
description: "Comprehensive guide to Scrum - roles, ceremonies, artifacts, and practices for iterative software development with structure and empirical process control."
tags: [sdlc, methodology, agile, scrum, sprints, ceremonies]
---

## What is Scrum

*Developed by Jeff Sutherland and Ken Schwaber in early 1990s, formalized in 1995. Based on empirical process control theory and influenced by Takeuchi & Nonaka's "The New New Product Development Game" (1986). Codified in the [Scrum Guide](https://scrumguides.org/){:target="_blank" rel="noopener noreferrer"} by Sutherland and Schwaber.*

**Scrum** is a lightweight framework for developing, delivering, and sustaining complex products. It provides a structured approach to Agile software development through defined roles, time-boxed events (ceremonies), and specific artifacts.

<blockquote class="pull-quote">
<p>Knowledge comes from experience and decisions based on what is known, not from predictions and planning.</p>
</blockquote>

**Core Philosophy:**
- Empirical process control (transparency, inspection, adaptation)
- Iterative and incremental delivery
- Self-organizing, cross-functional teams
- Time-boxed sprints (typically 2 weeks)
- Regular inspection and adaptation through ceremonies

**Key Characteristics:**

Unlike principle-based approaches (Lean, Kanban), Scrum prescribes specific:
- **Roles**: Product Owner, Scrum Master, Development Team
- **Ceremonies**: Sprint Planning, Daily Standup, Sprint Review, Sprint Retrospective
- **Artifacts**: Product Backlog, Sprint Backlog, Increment
- **Time-boxes**: Fixed-length sprints (1-4 weeks, typically 2)

### Why Scrum Emerged

**The problem Scrum solves:**

Traditional Waterfall development created several problems:
- Late discovery of misunderstandings (requirements defined months before development)
- No mechanism for incorporating feedback until the end
- Teams working in silos without coordination
- Stakeholders surprised by results after months of work
- High risk from long cycles without validation

**Scrum addresses these through:**
- Short iterations with working software (fast feedback)
- Regular ceremonies creating transparency and coordination
- Cross-functional teams reducing handoffs
- Frequent stakeholder involvement (sprint reviews)
- Empirical process control (inspect and adapt)

### Historical Context

**Roots in manufacturing and product development:**

The term "Scrum" comes from rugby (the whole team moves together), borrowed by Takeuchi and Nonaka in their 1986 Harvard Business Review article "The New New Product Development Game." They observed that successful product development happened through:
- Small, cross-functional teams
- Overlapping development phases (not sequential)
- Multi-learning (continuous knowledge sharing)
- Subtle control (leadership provides direction, not commands)
- Self-organizing teams

**Adaptation to software (1990s):**

Jeff Sutherland and Ken Schwaber independently applied these concepts to software development, recognizing that software development is empirical (learn by doing) rather than predictive (plan everything upfront).

**Rise to dominance (2000s-2010s):**

Scrum became the most widely adopted Agile framework because:
- Prescriptive structure (easier to teach and adopt than Kanban or XP)
- Clear roles (organizations understand role-based structures)
- Regular cadence (management likes predictability)
- Certifications (CSM, PSM) created consultant ecosystem

---

## Philosophy and Core Values

### Empirical Process Control

Scrum is built on empirical process control theory, which asserts that knowledge comes from experience and making decisions based on what is known.

<div class="card-group">
<div class="content-card content-card--accent">
<h4>1. Transparency</h4>
<p>Make the process and work visible: work items on backlog, progress in burndown charts, impediments visible to all, clear Definition of Done.</p>
</div>
<div class="content-card content-card--accent-secondary">
<h4>2. Inspection</h4>
<p>Regularly inspect artifacts and progress: Daily Standup, Sprint Review, Sprint Retrospective, and continuous inspection during development.</p>
</div>
<div class="content-card content-card--accent-warning">
<h4>3. Adaptation</h4>
<p>Adjust based on inspection: adapt approach if off track, adapt backlog if priorities change, adapt process in retrospectives.</p>
</div>
</div>

### Scrum Values

**Five core values guide behavior:**

**1. Commitment**

Team members commit to:
- Achieving the sprint goal
- Supporting each other
- Doing the best work possible
- Continuous improvement

**Not**: Commitment to complete all planned work regardless of discovery.

**2. Courage**

Team members have courage to:
- Say no when necessary
- Surface problems early
- Challenge assumptions
- Admit when they don't know something

**3. Focus**

Team focuses on:
- Sprint goal (not unrelated work)
- Delivering valuable increments
- One sprint at a time (not future sprints)

**4. Openness**

Team is open about:
- Progress (honest status)
- Challenges and impediments
- What they don't know
- Feedback and learning

**5. Respect**

Team members respect each other as:
- Capable and independent professionals
- People with different perspectives and expertise
- Collaborative partners, not subordinates

### Agile Manifesto Alignment

Scrum embodies Agile Manifesto values:
- **Individuals and interactions** over processes and tools → Self-organizing teams, daily standups
- **Working software** over comprehensive documentation → Increment delivered every sprint
- **Customer collaboration** over contract negotiation → Product Owner represents customer, sprint reviews
- **Responding to change** over following a plan → Adapt backlog, empirical process control

---

## The Scrum Framework

### Framework Overview

Scrum is intentionally incomplete, defining only the framework while teams determine practices within it.

**What Scrum prescribes:**
- Three roles (Product Owner, Scrum Master, Development Team)
- Five ceremonies (Sprint Planning, Daily Standup, Sprint Review, Sprint Retrospective, Sprint itself)
- Three artifacts (Product Backlog, Sprint Backlog, Increment)
- Definition of Done

**What Scrum doesn't prescribe:**
- Engineering practices (use XP practices: TDD, pair programming, CI)
- Estimation methods (story points, ideal days, t-shirt sizes)
- Tools (Jira, Azure DevOps, physical boards)
- Team size specifics (guideline: 3-9 people)
- Backlog format (user stories, job stories, use cases)

### The Sprint

**A sprint is a time-boxed iteration (1-4 weeks, typically 2 weeks) during which a "Done" increment is created.**

**Sprint characteristics:**

- **Fixed duration**: 2 weeks is most common (balance between feedback and overhead)
- **Consistent duration**: Don't change length sprint-to-sprint
- **Sprint Goal**: Coherent objective providing focus
- **No changes that endanger sprint goal**: Scope may be renegotiated with Product Owner
- **Quality doesn't decrease**: Definition of Done remains constant

**Sprint flow:**
```
Sprint Planning → Daily Standups (every day) → Development → Sprint Review → Retrospective → Next Sprint
```

**Why time-boxes matter:**

- Create rhythm and predictability
- Force prioritization (can't do everything)
- Limit risk (maximum 2 weeks of work in wrong direction)
- Enable regular inspection and adaptation
- Provide forcing function for completion

**Sprint boundaries:**

- **Start**: Sprint Planning defines scope
- **During**: Team works toward sprint goal, adapts as needed
- **End**: Sprint Review and Retrospective, then next sprint begins immediately

**No gap between sprints.** If the team needs time for planning or cleanup, it happens within the sprint.

---

## Scrum Roles

Scrum defines three roles, each with distinct responsibilities.

### Product Owner

**Responsibilities:**

**1. Maximize value of product and Development Team's work**
- Understands customer needs and business context
- Makes trade-offs between features, cost, time
- Ensures work delivers business value

**2. Manage Product Backlog**
- Creates and communicates Product Backlog items
- Orders items by value (not necessarily priority)
- Ensures backlog is visible, transparent, and clear
- Ensures Development Team understands items sufficiently

**3. Accept or reject work**
- Validates work meets acceptance criteria
- Determines what constitutes "Done" (beyond Definition of Done)
- Decides when to release increments

**Key characteristics:**

- **One person, not committee**: Accountability requires single decision-maker
- **Authority to prioritize**: Can say "no" to stakeholders
- **Available**: Must be accessible to team for questions
- **Domain knowledge**: Understands business and customer needs

**Common responsibilities (not prescribed but typical):**

- Writing user stories or requirements
- Stakeholder management
- Release planning
- Product roadmap (longer-term vision)
- Market research and customer feedback

**How to do this well:**

- Spend significant time with users/customers (not just internal stakeholders)
- Refine backlog continuously (not just before sprint planning)
- Be available for questions during sprint (don't disappear)
- Focus on outcomes (what value to deliver) not outputs (what features to build)
- Trust team's technical decisions (don't prescribe solutions)

**Red flags:**
- Product Owner is unavailable during sprint
- Product Owner micromanages technical implementation
- Backlog items lack clear acceptance criteria
- Product Owner accepts work without validating it
- Multiple people playing Product Owner (committee dysfunction)

---

### Scrum Master

**Responsibilities:**

**1. Serve the Development Team**

Help team self-organize and be more effective:
- **Coaching**: Teach Scrum practices and values
- **Facilitation**: Run ceremonies effectively
- **Removing impediments**: Clear blockers team can't resolve themselves
- **Protection**: Shield team from interruptions and distractions

**2. Serve the Product Owner**

Help Product Owner be effective:
- **Backlog management techniques**: Effective ways to organize and prioritize
- **Understanding empiricism**: How to adapt based on learning
- **Facilitation**: Run backlog refinement sessions
- **Communication**: Help PO communicate with team and stakeholders

**3. Serve the organization**

Help organization adopt Scrum:
- **Leading Agile transformation**: Coach organization on Scrum adoption
- **Planning**: Help with Scrum implementations
- **Collaboration**: Work with other Scrum Masters
- **Removing organizational impediments**: Address systemic issues

**Key characteristics:**

- **Servant leader**: Serves team rather than managing team
- **Facilitator**: Enables team effectiveness without controlling work
- **Coach**: Teaches and mentors rather than directs
- **Change agent**: Helps organization transform culture

**NOT a project manager:**

Traditional Project Manager:
- Assigns tasks to individuals
- Tracks individual progress
- Controls how work is done
- Makes decisions for team
- Manages scope, cost, schedule

Scrum Master:
- Team self-organizes around work
- Tracks team progress (not individuals)
- Team decides how to work
- Team makes technical decisions
- Team commits to sprint goal (not individuals to tasks)

**How to do this well:**

- Ask questions rather than provide answers (enable team problem-solving)
- Focus on process improvement (not controlling people)
- Make impediments visible (escalate when needed)
- Foster psychological safety (team can surface problems without fear)
- Continuously learn and improve facilitation skills

**Red flags:**
- Scrum Master assigns tasks to team members
- Scrum Master makes technical decisions for team
- Scrum Master doesn't attend ceremonies or shows up late
- Impediments remain unresolved sprint after sprint
- Team afraid to surface problems (no psychological safety)

---

### Development Team

**Responsibilities:**

**1. Deliver increment each sprint**

Create "Done" increment that potentially shippable:
- Develop features
- Test thoroughly
- Integrate continuously
- Meet Definition of Done

**2. Self-organize**

Team decides how to accomplish work:
- Who works on what
- How to break down work
- Technical approaches and architecture
- When to collaborate vs. work individually

**3. Cross-functional**

Team has all skills needed:
- Development, testing, design, architecture
- No titles or sub-teams (everyone is "Developer")
- Collective responsibility for sprint success

**Key characteristics:**

- **Team size**: 3-9 people (smaller enables collaboration, larger creates coordination overhead)
- **Full-time**: Dedicated to team (not split across multiple teams)
- **Cross-functional**: All skills present (no dependencies on external teams)
- **Self-organizing**: Team manages its own work

**NOT individuals working independently:**

Teams in Scrum:
- Collectively own sprint goal
- Help each other (swarming when needed)
- Share knowledge through collaboration
- No "my work" vs. "your work" (just team's work)

**How to do this well:**

- Focus on finishing work before starting new work (stop starting, start finishing)
- Collaborate actively (pair programming, mob programming, code reviews)
- Hold each other accountable to quality standards
- Continuously improve skills and practices
- Communicate proactively about impediments and risks

**Red flags:**
- Team members working in silos (no collaboration)
- Waiting for Scrum Master or Product Owner to assign work
- "My tasks" mentality instead of "our sprint goal"
- Technical debt accumulating without addressing it
- No one wants to work on certain types of work (testing, operations, documentation)

---

## Scrum Ceremonies

Scrum defines five time-boxed events that provide structure and opportunities for inspection and adaptation.

### Sprint Planning

**Purpose:** Define what can be delivered in the sprint and how the team will achieve it.

**Duration:** 2-4 hours for 2-week sprint (max 8 hours for 4-week sprint)

**Participants:** Entire Scrum Team (Product Owner, Scrum Master, Development Team)

**Two parts:**

**Part 1: What will be delivered? (The Sprint Goal)**

Product Owner presents highest priority Product Backlog items:
- What business value do these items deliver?
- What are acceptance criteria?
- Why is this valuable to build now?

Development Team asks clarifying questions:
- What edge cases exist?
- What does "done" mean for this item?
- What dependencies or risks exist?

Team collaboratively selects items:
- Based on team capacity and velocity
- Team commits to sprint goal (not necessarily all items)
- Sprint Goal provides coherence (theme or objective)

**Part 2: How will the work be done?**

Development Team plans the work:
- Break down Product Backlog items into tasks
- Estimate effort (hours, points, or relative sizing)
- Identify dependencies and risks
- Create Sprint Backlog

**Output: Sprint Backlog + Sprint Goal**

**Sprint Goal example:**
- ❌ Poor: "Complete user stories #1-5"
- ✅ Good: "Enable users to search products by price and category"

Good sprint goals provide focus and allow flexibility (team can adjust implementation while still achieving goal).

**How to do this well:**

- Product Owner prepares by refining backlog beforehand (don't refine during planning)
- Discuss "why" before "what" (context helps team make trade-offs)
- Timebox ruthlessly (if you go over, reduce scope rather than extend meeting)
- Focus on commitment to sprint goal, not just list of items
- Leave room for discovery during sprint (don't plan every detail)

**Red flags:**
- Planning takes 4+ hours for 2-week sprint (backlog not refined)
- Team commits to work without understanding acceptance criteria
- Sprint goal is vague or doesn't exist
- Team overcommits (velocity ignored)
- Product Owner dictates how work will be done (team doesn't self-organize)

---

### Daily Standup (Daily Scrum)

**Purpose:** Inspect progress toward sprint goal and adapt plan for next 24 hours.

**Duration:** 15 minutes maximum

**Participants:** Development Team (required), Scrum Master facilitates, Product Owner may attend

**Format:**

**Traditional format (per person):**
Each team member answers three questions:
1. What did I do yesterday toward the sprint goal?
2. What will I do today toward the sprint goal?
3. Do I see any impediments that prevent me or the team from meeting the sprint goal?

**Alternative format (walk the board):**
Walk through items on Sprint Backlog from right to left (focus on finishing):
- "This item is in testing. Who's working on it? Any blockers?"
- "This item is in code review. Who can review today?"
- "This item just started. What's the plan to finish it?"

**Key principles:**

- **Not a status report to Scrum Master**: Team synchronizing with each other
- **Focus on sprint goal**: Not unrelated activities
- **Identify impediments**: Not solve them (parking lot for longer discussions)
- **Same time, same place**: Consistency enables rhythm

**How to do this well:**

- Stand up (keeps meeting short and focused)
- Start on time (don't wait for latecomers)
- Focus on work items, not people (emphasize team ownership)
- Keep to 15 minutes (defer detailed discussions)
- Make impediments visible (write them down, track resolution)

**Red flags:**
- Standup takes 30+ minutes (too much detail or problem-solving)
- Team members reporting to Scrum Master (not synchronizing with each other)
- People say "no blockers" when work hasn't moved in days
- Same impediments mentioned day after day without resolution
- Team members late or missing regularly

---

### Sprint Review

**Purpose:** Inspect the increment and adapt the Product Backlog based on feedback.

**Duration:** 1-2 hours for 2-week sprint (max 4 hours for 4-week sprint)

**Participants:** Scrum Team + Stakeholders (customers, users, management)

**Format:**

**1. Present what was accomplished**

Development Team demonstrates:
- "Done" work (meets Definition of Done)
- Working software (not slide decks or demos of incomplete work)
- How it delivers on sprint goal

**2. Gather feedback**

Stakeholders provide feedback:
- Does this meet their needs?
- What should change?
- What's missing?
- New ideas or opportunities discovered?

**3. Review backlog**

Product Owner discusses Product Backlog:
- What's next? (upcoming priorities)
- Updates based on feedback
- Timeline and release projections

**4. Collaborative discussion**

Entire group discusses:
- What to build next
- Adjust backlog based on market, competition, budget, capabilities

**Output: Revised Product Backlog**

**Key principles:**

- **Working software**: Not promises or plans (show actual working features)
- **Collaboration**: Not presentation (engage stakeholders in discussion)
- **Adaptation**: Backlog changes based on learning
- **Informal**: Encourage honest feedback (not polished sales demo)

**How to do this well:**

- Invite actual users when possible (not just proxy stakeholders)
- Demonstrate in realistic environment (not idealized happy-path)
- Encourage critical feedback (ask "what's not working?")
- Take notes on feedback (don't just nod and forget)
- Update backlog immediately based on feedback

**Red flags:**
- No stakeholders attend (team demos to themselves)
- Demonstrating incomplete work or slide decks
- Product Owner already decided next sprint (stakeholder feedback ignored)
- Team defensive about feedback (not psychologically safe)
- Same stakeholders asking "when is feature X?" sprint after sprint

---

### Sprint Retrospective

**Purpose:** Inspect how the last sprint went (people, relationships, process, tools) and identify improvements.

**Duration:** 45-90 minutes for 2-week sprint (max 3 hours for 4-week sprint)

**Participants:** Scrum Team (Product Owner, Scrum Master, Development Team)

**Format:**

**1. Set the stage**

Create safe environment:
- Reminder of retrospective prime directive: "Regardless of what we discover, we understand and truly believe that everyone did the best job they could, given what they knew at the time, their skills and abilities, the resources available, and the situation at hand."
- Check-in activity (quick round-robin)

**2. Gather data**

Review the sprint:
- What went well? (keep doing)
- What didn't go well? (opportunities for improvement)
- What puzzles us? (things to investigate)
- Review metrics (velocity, cycle time, bugs found)

**3. Generate insights**

Discuss patterns:
- Why did things go well?
- What caused problems?
- Root cause analysis (five whys)

**4. Decide what to do**

Identify improvements:
- 1-3 concrete actions for next sprint
- Assign ownership
- Define success criteria (how will we know if it worked?)

**5. Close**

Wrap up:
- Appreciation round (recognize contributions)
- Quick feedback on retrospective itself

**Output: Improvement actions for next sprint**

**Common retrospective formats:**

**Start/Stop/Continue:**
- Start: What should we begin doing?
- Stop: What should we stop doing?
- Continue: What should we keep doing?

**Glad/Sad/Mad:**
- Glad: What made us happy?
- Sad: What disappointed us?
- Mad: What frustrated us?

**Sailboat:**
- Wind (what's helping us move forward?)
- Anchor (what's holding us back?)
- Rocks (what risks do we see ahead?)
- Island (our goal)

**How to do this well:**

- Focus on 1-3 actionable improvements (not 10+ vague wishes)
- Make someone accountable for each action (not "the team")
- Review previous retrospective actions (did we actually improve?)
- Vary format to keep fresh (don't use same format every time)
- Create psychological safety (focus on systems, not individuals)

**Red flags:**
- Same issues raised every retrospective without improvement
- No action items or vague actions ("communicate better")
- Blame culture (pointing fingers at individuals)
- Retrospectives skipped or canceled
- Team afraid to raise real issues (lack of safety)

---

### Backlog Refinement (Grooming)

**Purpose:** Add detail, estimates, and order to Product Backlog items.

**Duration:** Not officially time-boxed, but typically consume no more than 10% of Development Team's capacity

**Participants:** Product Owner + Development Team (Scrum Master facilitates)

**Not an official Scrum ceremony**, but widely practiced because Sprint Planning is too late to refine items.

**Activities:**

**1. Breaking down large items**
- Epic → User Stories
- User Story → Tasks
- Define acceptance criteria

**2. Adding detail**
- Clarify requirements
- Identify edge cases
- Document assumptions
- Add mockups or examples

**3. Estimating**
- Story points or relative sizing
- Identify complexity and unknowns
- Flag items needing spikes

**4. Ordering**
- Product Owner explains value and priority
- Team provides input on dependencies and risk
- Reorder based on discussion

**Output: Refined backlog ready for Sprint Planning**

**How to do this well:**

- Refine items 1-2 sprints ahead (not just next sprint)
- Focus on top of backlog (don't refine low-priority items)
- Keep refinement sessions short and frequent (weekly 1-hour sessions better than quarterly 4-hour marathons)
- Make acceptance criteria explicit (reduce ambiguity)
- Identify and test assumptions (spike risky unknowns)

**Red flags:**
- Sprint Planning takes 4+ hours (backlog not refined)
- Team discovers major unknowns mid-sprint (assumptions not tested)
- Stories lack clear acceptance criteria
- Estimates wildly inaccurate (poor understanding during refinement)
- Product Owner refines backlog alone (no team input)

---

## Scrum Artifacts

### Product Backlog

**What it is:**

Ordered list of everything that might be needed in the product. Single source of requirements.

**Characteristics:**

- **Ordered**: Product Owner orders by value (highest value at top)
- **Emergent**: Grows and changes as we learn more about product and customers
- **Never complete**: Evolves as long as product exists
- **Living document**: Continuously refined and re-prioritized

**Typical items:**

- Features and functionality
- Bug fixes
- Technical debt reduction
- Architecture improvements
- Research or spikes

**Estimation:**

Common approaches:
- **Story points**: Relative sizing (Fibonacci: 1, 2, 3, 5, 8, 13)
- **T-shirt sizes**: XS, S, M, L, XL
- **Ideal days**: How many days of focused work

**User story format (common but not required):**
```
As a [user type],
I want to [action],
So that [benefit].

Acceptance Criteria:
- [Specific testable criterion]
- [Specific testable criterion]
- [Specific testable criterion]
```

**Example:**
```
As a customer,
I want to filter products by price range,
So that I can find products within my budget.

Acceptance Criteria:
- User can set minimum and maximum price
- Filter updates product list immediately
- URL updates to reflect filter (bookmarkable)
- Filter persists across sessions
```

**How to do this well:**

- Keep top 2-3 sprints refined (detailed) while lower items remain high-level
- Order by value, not just priority (what delivers most business value?)
- Include technical debt and infrastructure work (not just features)
- Make acceptance criteria specific and testable
- Test assumptions before committing (spikes for risky items)

**Red flags:**
- Backlog has 500+ items (impossible to maintain)
- Items at top lack detail or acceptance criteria
- Everything is high priority (no real prioritization)
- Backlog unchanged for weeks (not responsive to learning)
- Technical debt and bugs not tracked (only features visible)

---

### Sprint Backlog

**What it is:**

Set of Product Backlog items selected for the sprint, plus a plan for delivering them and achieving the sprint goal.

**Characteristics:**

- **Team commits**: Development Team selects items (not assigned by Product Owner)
- **Detailed plan**: Broken down into tasks with estimates
- **Living document**: Team updates daily as work progresses
- **Transparent**: Visible to everyone (physical board or tool)

**Typical task board:**
```
| To Do | In Progress | Code Review | Testing | Done |
|-------|-------------|-------------|---------|------|
```

**Sprint Backlog evolves:**
- Team adds tasks as understanding grows
- Team removes tasks no longer needed
- Team adjusts estimates as work progresses
- Team re-plans as needed to achieve sprint goal

**Sprint Backlog != Task Assignment:**

Traditional:
- Manager assigns tasks to individuals
- "Alice: implement login API"
- Individual accountability

Scrum:
- Team collectively owns sprint backlog
- Team members pull tasks when ready
- Team accountability (entire team succeeds or fails together)

**How to do this well:**

- Make board visible (physical board or dashboard everyone checks)
- Update in real-time (as work happens, not end of day)
- Focus on sprint goal (not just completing tasks)
- Swarm when items blocked (team helps unblock)
- Re-plan when needed (don't stick to original plan if circumstances change)

**Red flags:**
- Sprint Backlog not updated daily
- Tasks assigned to individuals (not pulled by team)
- Work happens that's not on Sprint Backlog
- Sprint Backlog unchanged from Sprint Planning to end (no adaptation)
- Team working on items not in Sprint Backlog (scope creep)

---

### Increment

**What it is:**

Sum of all Product Backlog items completed during a sprint and all previous sprints. The increment must be "Done" according to the Definition of Done.

**Characteristics:**

- **Potentially shippable**: Could be released to production (even if not actually released)
- **Integrated**: All work combined and tested together
- **Meets Definition of Done**: Quality standards met
- **Usable**: Provides value to users (not partial implementation)

**Definition of Done:**

Shared understanding of what "complete" means. Typical Definition of Done:

- Code written and committed
- Unit tests written and passing
- Integration tests passing
- Code reviewed and approved
- Deployed to staging environment
- Product Owner has accepted
- Documentation updated
- No known critical or high-priority bugs

**Organizational Definition of Done vs. Team Definition of Done:**
- Organization may have baseline standards (e.g., "passes security scan")
- Team may have additional standards (e.g., "100% unit test coverage")
- Team's Definition of Done must meet or exceed organizational standards

**How to do this well:**

- Make Definition of Done explicit and visible
- Don't compromise on Definition of Done (avoid "done-ish")
- Continuously improve Definition of Done (raise quality bar)
- Deliver to production-like environment (not just local dev)
- Get Product Owner acceptance during sprint (not waiting until Sprint Review)

**Red flags:**
- Work marked "done" but doesn't meet Definition of Done
- Definition of Done is vague or doesn't exist
- "Done" work still has open bugs or incomplete functionality
- Team can't deploy increment to production (even if not released)
- Definition of Done weakens over time (technical debt accumulating)

---

## Metrics and Measurement

Scrum uses metrics to provide transparency and enable empirical process control.

### Velocity

**What it is:**

Amount of work (story points or ideal days) completed per sprint.

**How to calculate:**
```
Sprint 1: 23 points completed
Sprint 2: 21 points completed
Sprint 3: 25 points completed
Average velocity: 23 points per sprint
```

**How to use velocity:**

**Planning:**
- Team's average velocity helps forecast capacity
- "We typically complete 23 points, so let's commit to ~20-25 points"

**Forecasting:**
- Backlog has 200 points remaining
- Velocity is 25 points/sprint
- Forecast: ~8 sprints (200/25)

**NOT for:**
- Comparing teams (velocity is team-specific)
- Measuring individual productivity
- Setting quotas ("must achieve 30 points")

**Velocity stabilizes over time (typically 3-5 sprints).**

**How to do this well:**

- Track velocity for planning, not performance evaluation
- Recognize velocity varies (new team members, holidays, complexity)
- Focus on sustainable pace (not maximizing velocity)
- Never compare velocity across teams (different estimation scales)
- Watch trends (is velocity decreasing? investigate why)

**Red flags:**
- Velocity used to pressure team ("why only 20 points this sprint?")
- Teams inflate estimates to boost velocity numbers
- Comparing teams by velocity ("Team A is more productive")
- Velocity decreasing over time (technical debt, quality issues)
- Velocity wildly inconsistent (estimation inconsistent or overcommitting)

---

### Burndown Chart

**What it is:**

Graph showing work remaining (y-axis) over time (x-axis) within a sprint.

**Types:**

**Sprint Burndown:**
- Shows remaining work in current sprint
- Updated daily
- Ideally trends downward toward zero

**Release Burndown:**
- Shows remaining work toward release goal
- Updated per sprint
- Shows progress across multiple sprints

**Ideal vs. actual:**
- Ideal line: Straight line from total work to zero
- Actual line: Actual remaining work
- Gap shows whether ahead or behind

**How to interpret:**

**Trending toward zero:** Sprint on track

**Flat line:** Work not being completed (impediments, distractions)

**Going up:** Scope added mid-sprint or estimates increased

**Steep drop at end:** Work completed at last minute (risky pattern)

**How to do this well:**

- Update daily (not end of sprint)
- Use as conversation starter, not judgment
- Investigate flat lines or sudden changes
- Don't manipulate chart to look good
- Focus on sprint goal, not perfect burndown

**Red flags:**
- Chart shows consistent pattern of work finishing last day (planning inaccurate)
- Chart updated infrequently (not useful for daily inspection)
- Scope added mid-sprint without discussion (line goes up)
- Team ignores chart (not using for inspection and adaptation)

---

### Cumulative Flow Diagram (CFD)

**What it is:**

Stacked area chart showing distribution of work across workflow stages over time (similar to Kanban CFD, can be applied to Scrum).

**What it reveals:**

- **Bottlenecks**: One area expanding (work piling up)
- **Flow**: Parallel bands indicate smooth flow
- **WIP**: Width of bands shows work in progress

**Not standard in Scrum**, but useful when combined with Kanban-style workflow visualization.

---

### Lead Time and Cycle Time

**Lead Time:** Time from backlog entry to "Done"
**Cycle Time:** Time from "In Progress" to "Done"

**In sprint context:**
- Lead time: When item enters Product Backlog → Deployed
- Cycle time: When team starts work → Completed

**Shorter cycle time = faster feedback and value delivery**

**How to use:**

Track average cycle time:
- If increasing: Investigate (complexity, quality issues, dependencies)
- If stable: Predictable delivery
- Use for forecasting: "Items typically take 3 days from start to done"

---

## Implementing Scrum

### Getting Started (Sprint 0 / Week 1-2)

**Don't do "Sprint 0"** as long setup phase. Start sprinting immediately, but first sprint may focus on readiness.

**Week 1: Formation**

**Day 1-2: Team formation and training**
- Scrum training for entire team (roles, ceremonies, artifacts)
- Establish team working agreements
- Select Scrum Master and Product Owner
- Set sprint cadence (typically 2 weeks)

**Day 3-4: Initial Product Backlog**
- Product Owner creates initial backlog (high-level epics and stories)
- Team refines top items for first sprint
- Identify obvious technical setup needs

**Day 5: First Sprint Planning**
- Select realistic amount of work (err on low side)
- Define sprint goal
- Create Sprint Backlog

**Week 2: First Sprint**

- Daily Standups start immediately
- Team delivers first increment
- Keep first sprint focused and achievable (build confidence)

**End of Week 2: First ceremonies**
- Sprint Review (show increment to stakeholders)
- Sprint Retrospective (how did it go?)
- Sprint Planning for Sprint 2

---

### Sprints 1-3: Establishing Rhythm

**Sprint 1: Focus on establishing cadence**
- All ceremonies happen at scheduled times
- Team learns to work together
- Initial velocity baseline (likely low)
- Lots of learning and adjustment

**Sprint 2: Refining practices**
- Velocity may improve as team learns
- Refine Definition of Done
- Improve backlog refinement
- Address impediments from Sprint 1 retrospective

**Sprint 3: Finding groove**
- Ceremonies feel more natural
- Velocity stabilizing
- Team self-organizing effectively
- Quality practices solidifying

**By end of Sprint 3:**
- Velocity becomes somewhat predictable
- Team comfortable with ceremonies
- Backlog refinement rhythm established
- Continuous improvement mindset forming

---

### Sprints 4-6: Optimization

**Focus areas:**

**Engineering practices:**
- Continuous integration established
- Automated testing expanding
- Code review practices solid
- Technical debt being managed

**Process optimization:**
- Ceremonies time-boxed effectively
- Retrospective actions actually implemented
- Backlog refinement efficient
- Sprint Planning under 2 hours

**Team dynamics:**
- Team truly self-organizing
- Collaboration natural
- Swarming when needed
- Psychological safety present

---

### Common Implementation Challenges

**Challenge 1: "We don't have time for ceremonies"**

**Problem:** Team sees ceremonies as overhead

**Solution:**
- Make ceremonies effective (time-boxed, facilitated well)
- Track value from ceremonies (decisions made, impediments removed)
- Treat ceremonies as work, not extra
- Cancel ineffective ceremonies and retrospect on why

---

**Challenge 2: "Product Owner not available"**

**Problem:** Product Owner has multiple teams or other responsibilities

**Solution:**
- Negotiate dedicated Product Owner time (at least 50%)
- Empower team to make decisions within boundaries
- Clear escalation path when PO needed but unavailable
- Consider splitting Product Owner role or combining teams

---

**Challenge 3: "Team dependencies block progress"**

**Problem:** Team depends on other teams, creating delays

**Solution:**
- Make dependencies visible (track in Sprint Backlog)
- Pre-coordinate before Sprint Planning
- Consider reorganizing into cross-functional teams
- Create service-level agreements with dependency teams

---

**Challenge 4: "Management wants detailed long-term plans"**

**Problem:** Scrum's empirical approach conflicts with predictive planning culture

**Solution:**
- Use velocity for probabilistic forecasting
- Provide confidence ranges, not commitments
- Educate management on empiricism
- Show that frequent delivery reduces risk

---

**Challenge 5: "Quality suffering from time pressure"**

**Problem:** Team cutting corners to hit sprint commitment

**Solution:**
- Don't compromise Definition of Done
- Reduce sprint commitment if needed
- Address technical debt explicitly
- Retrospect on causes (unrealistic planning? insufficient skills?)

---

## Alignment with AAA Cycle

Scrum's sprint structure can support AAA when practiced with discipline, but has structural tensions.

### How Scrum Can Support AAA

**Align Phase: Sprint Planning + Backlog Refinement**

Sprint Planning provides opportunity for alignment:

**What works:**
- Team and Product Owner discuss requirements
- Clarifying questions surface misunderstandings
- Acceptance criteria make expectations explicit

**What's needed:**
- Test assumptions **before** Sprint Planning (not during)
- Backlog refinement includes discovery work
- Spikes for risky unknowns happen in prior sprint

**Example:**
Product Owner wants search feature. Before Sprint Planning:
1. User research validates need (Align: is this valuable?)
2. Technical spike explores approach (Align: is this feasible?)
3. Sprint Planning: Team commits based on validated understanding

---

**Agree Phase: Sprint Commitment + Definition of Done**

Sprint commitment is an agreement:

**What works:**
- Team commits to sprint goal (shared objective)
- Definition of Done makes quality explicit
- Team has voice in what's achievable

**What's needed:**
- Commitment to sprint goal, not just list of stories
- Flexibility to adapt scope while maintaining goal
- Don't commit to work without clear acceptance criteria

**Example:**
Sprint goal: "Enable users to search products." Team commits to goal. During sprint, discovers complexity. Team renegotiates scope with PO but maintains goal (perhaps basic search vs. advanced filters).

---

**Apply Phase: Sprint Execution + Increment**

Sprint execution applies the agreement:

**What works:**
- Time-box forces finishing work
- Daily inspection enables course correction
- Potentially shippable increment demonstrates completion

**What's needed:**
- Don't compromise quality to hit sprint commitment
- Pause and realign when discovery changes everything
- "Done" means honoring agreement (quality + functionality)

**Example:**
Team discovers technical constraint mid-sprint. Instead of shipping poor solution, team discusses with PO. Either adjust scope or extend to next sprint. Honor quality agreement.

---

### Where Scrum Can Conflict with AAA

**Conflict 1: Sprint commitment before sufficient discovery**

**Problem:**
- Sprint Planning happens in 2-4 hours
- No time to test assumptions or run spikes
- Team commits based on guesses

**AAA requires:**
- Test critical assumptions before committing
- Discovery may take days, not hours
- Defer commitment until sufficient understanding

**How to reconcile:**
- Use prior sprint for discovery (spikes)
- Backlog refinement includes assumption testing
- Accept that some sprints focus on discovery, not delivery

---

**Conflict 2: Sprint boundary discourages realignment**

**Problem:**
- Team discovers misunderstanding mid-sprint
- Time-box pressure encourages shipping anyway
- "We committed" becomes reason to ignore learning

**AAA requires:**
- Pause and realign when discovery changes understanding
- Agreement is about outcomes, not completing list of tasks
- Realignment is discipline, not failure

**How to reconcile:**
- Sprint goal (not task list) is the commitment
- Team renegotiates scope with PO when needed
- Retrospective addresses why discovery was late

---

**Conflict 3: Velocity pressure discourages quality**

**Problem:**
- Velocity tracked sprint-over-sprint
- Pressure to maintain or increase velocity
- Teams cut corners (skip tests, accumulate tech debt)

**AAA requires:**
- Honoring quality agreements
- Sustainable pace
- Technical excellence

**How to reconcile:**
- Velocity is planning tool, not performance metric
- Definition of Done is non-negotiable
- Track quality metrics (bugs, tech debt) alongside velocity

---

**Conflict 4: Prescriptive structure can become rigid**

**Problem:**
- Ceremonies become rituals (not useful)
- "Scrum says we must..." overrides common sense
- Process compliance replaces empiricism

**AAA requires:**
- Adapt process based on learning
- Focus on outcomes (alignment, agreement, application)
- Process serves team, not vice versa

**How to reconcile:**
- Retrospectives question whether ceremonies useful
- Scrum is framework, not rigid rules
- Adapt Scrum based on team's context

---

### Using Scrum to Strengthen AAA

**Make alignment explicit in Sprint Planning:**
- Don't plan work with unclear requirements
- Use "Definition of Ready" to ensure alignment
- Test assumptions before Sprint Planning

**Make agreement visible in Sprint Backlog:**
- Sprint goal is the agreement
- Acceptance criteria are explicit
- Definition of Done is the quality agreement

**Honor agreements through increment:**
- Potentially shippable increment
- Don't compromise Definition of Done
- Deliver what was agreed, or renegotiate transparently

**AAA + Scrum in practice:**

**Align:** Backlog refinement, spikes, Sprint Planning clarification
**Agree:** Sprint goal, Definition of Done, acceptance criteria
**Apply:** Sprint execution, daily adaptation, potentially shippable increment

---

## When to Use Scrum

### Scrum Works Well For:

**Software product development:**
- Building features iteratively
- Regular stakeholder feedback valuable
- Requirements evolve as you learn
- Incremental delivery possible

**Teams new to Agile:**
- Prescriptive structure provides guidance
- Clear roles reduce ambiguity
- Regular ceremonies create rhythm
- Easier to learn than principle-based approaches

**Organizations wanting predictability:**
- Regular sprint cadence
- Velocity enables forecasting
- Stakeholders comfortable with structured approach

**Cross-functional product teams:**
- Team has all skills needed
- Focused on single product
- Stable team composition

**Projects with engaged Product Owner:**
- PO available and dedicated
- Clear product vision
- Authority to prioritize

**Medium-sized teams (5-9 people):**
- Large enough for cross-functional skills
- Small enough to coordinate without excessive overhead

---

### Scrum May Not Fit:

**Maintenance and support work:**
- Unpredictable interruptions
- Varied request types
- Kanban's continuous flow better fit

**Exploratory or research projects:**
- Unknown scope
- Difficult to define sprint goals
- Need flexibility beyond 2-week time-boxes

**Very small teams (1-3 people):**
- Ceremony overhead too high
- Roles don't make sense (who's Scrum Master?)
- Kanban or XP more appropriate

**Projects with unavailable stakeholders:**
- Product Owner can't be dedicated
- Stakeholders don't attend Sprint Reviews
- Feedback loops break down

**Teams with extensive external dependencies:**
- Can't deliver increment within sprint
- Blocked by other teams frequently
- Cross-functional structure not possible

**Highly regulated environments requiring extensive documentation:**
- Scrum's lightweight approach may conflict
- May need hybrid with Waterfall documentation

**Teams valuing autonomy over structure:**
- Prescriptive framework feels constraining
- Ceremonies feel like overhead
- Lean or Kanban provide more flexibility

---

### Hybrid Approaches

**Scrum + XP engineering practices:**
- Use Scrum for project structure
- Add TDD, pair programming, CI from XP
- Very common and effective combination

**Scrum + Kanban (Scrumban):**
- Use sprint structure from Scrum
- Add WIP limits and flow metrics from Kanban
- Continuous flow within sprint boundaries

**Scrum for features, Kanban for support:**
- Development team uses Scrum
- Operations team uses Kanban
- Separate workflows for different work types

**Multiple teams: Scrum of Scrums or scaling frameworks:**
- LeSS (Large-Scale Scrum)
- SAFe (Scaled Agile Framework)
- Nexus
- Coordinate multiple Scrum teams

---

## Common Pitfalls and Red Flags

### Pitfall 1: Scrum Theater (Going Through Motions)

**Problem:**

Team performs ceremonies without getting value. Scrum becomes ritual rather than empirical process control.

**What it looks like:**
- Daily Standup: Status report to Scrum Master, no coordination
- Sprint Review: Polished demo, no real feedback sought
- Retrospective: Same issues raised, no improvements made
- Sprint Planning: Rubber-stamp pre-determined work

**Why it's wrong:**

Ceremonies exist for inspection and adaptation. Without genuine engagement, you lose the feedback loops that make Scrum effective.

**How to avoid:**

- Ask "what value did we get from that ceremony?"
- Retrospect on ceremonies themselves
- Cancel ceremonies that aren't useful (and figure out why)
- Focus on outcomes (decisions, learning) not activity

**Red flags:**
- Ceremonies feel like obligation, not opportunity
- Same format every time (no experimentation)
- Low engagement (people distracted or disengaged)
- No action items or decisions from ceremonies

---

### Pitfall 2: Velocity as Performance Metric

**Problem:**

Using velocity to measure team performance creates perverse incentives.

**What happens:**
- Teams inflate estimates to boost velocity
- Quality suffers (cut corners to complete more points)
- Teams game the system (declare incomplete work "done")
- Comparison between teams ("Team A is faster")

**Why it's wrong:**

Velocity is a planning tool, not a performance metric. Using it for evaluation destroys its usefulness and creates toxic dynamics.

**How to avoid:**

- Use velocity for capacity planning only
- Never compare velocity across teams
- Track quality metrics alongside velocity
- Focus on value delivered, not points completed

**Red flags:**
- Management sets velocity targets
- Teams punished for lower velocity
- Estimates wildly inconsistent
- Velocity increasing while quality declining

---

### Pitfall 3: Committing Without Understanding

**Problem:**

Team commits to work in Sprint Planning without clear acceptance criteria or tested assumptions.

**What happens:**
- Team discovers requirements mid-sprint
- Rework and thrashing
- Quality compromised to meet commitment
- Sprint goal missed because requirements were wrong

**Why it's wrong:**

Agreement requires understanding. Committing based on assumptions is building on sand.

**How to avoid:**

- Test critical assumptions before Sprint Planning (spikes)
- Don't commit to work without clear acceptance criteria
- Product Owner available during sprint for questions
- Renegotiate scope when discovery changes understanding

**Red flags:**
- Frequent mid-sprint surprises
- "I thought it meant X" conversations mid-sprint
- Acceptance criteria added during sprint
- Team commits without asking clarifying questions

---

### Pitfall 4: Sacrificing Quality for Velocity

**Problem:**

Time pressure from sprint commitment leads to cutting corners.

**What happens:**
- Skip writing tests
- Incomplete code reviews
- Accumulating technical debt
- Bugs escaping to production

**Why it's wrong:**

Short-term velocity gains create long-term slowdown. Technical debt compounds.

**How to avoid:**

- Definition of Done is non-negotiable
- Reduce commitment rather than compromise quality
- Track technical debt explicitly
- Address quality in retrospectives

**Red flags:**
- "We'll fix it later" becomes standard phrase
- Definition of Done weakens over time
- Bug backlog growing
- Velocity decreasing over time (technical debt slowing team)

---

### Pitfall 5: Product Owner as Order-Taker

**Problem:**

Product Owner doesn't actually own product direction, just routes requests from stakeholders.

**What happens:**
- Backlog is wish-list from multiple stakeholders
- No coherent product vision
- Team builds features nobody uses
- No prioritization (everything is P0)

**Why it's wrong:**

Product Owner must make hard choices about value. Order-taking abdicates this responsibility.

**How to avoid:**

- Empower Product Owner to say "no"
- Product Owner accountable for outcomes
- Stakeholder requests evaluated against product vision
- Backlog ordered by value, not who shouted loudest

**Red flags:**
- Product Owner says "yes" to all requests
- Backlog has items from 10+ different stakeholders
- No clear product vision or strategy
- Features shipped but not used (no outcome measurement)

---

### Pitfall 6: Scrum Master as Task Master

**Problem:**

Scrum Master acts like traditional project manager (assigning tasks, tracking individuals, controlling process).

**What happens:**
- Team doesn't self-organize
- Dependency on Scrum Master
- No team ownership
- Scrum Master becomes bottleneck

**Why it's wrong:**

Scrum Master is servant leader, not manager. Team must self-organize to be effective.

**How to avoid:**

- Scrum Master asks questions, doesn't provide answers
- Team decides how to organize work
- Scrum Master removes impediments, doesn't solve technical problems
- Focus on process improvement, not controlling people

**Red flags:**
- Scrum Master assigns tasks to individuals
- Team waits for Scrum Master to tell them what to do
- Scrum Master makes technical decisions
- Team can't function without Scrum Master present

---

### Pitfall 7: Sprint Commitment Becomes Inflexible Contract

**Problem:**

Team treats sprint commitment as immutable, even when discovery changes understanding.

**What happens:**
- Discover requirements wrong mid-sprint, ship anyway
- Technical constraint emerges, work around rather than address
- External circumstances change, continue with original plan

**Why it's wrong:**

Empiricism requires adaptation. Commitment to learning and sprint goal, not task list.

**How to avoid:**

- Sprint goal is commitment (not specific tasks)
- Renegotiate scope with Product Owner when needed
- Focus on delivering value, not completing list
- Retrospect on why discovery was late

**Red flags:**
- "We committed" used to justify shipping wrong thing
- No mid-sprint adjustments even when circumstances change
- Team afraid to raise concerns (might jeopardize commitment)
- Sprint goal abandoned to complete task list

---

### Pitfall 8: No Real Retrospective Improvement

**Problem:**

Retrospectives happen but nothing actually improves.

**What happens:**
- Same issues raised sprint after sprint
- Action items forgotten or ignored
- Vague improvements ("communicate better")
- Blame culture prevents honest discussion

**Why it's wrong:**

Retrospectives exist for continuous improvement. Without action, team stagnates.

**How to avoid:**

- 1-3 concrete action items (not 10+ wishes)
- Assign ownership for each action
- Review previous actions at start of next retrospective
- Make improvements visible (track them)

**Red flags:**
- Same issues discussed every retrospective
- No action items or vague actions
- Actions not reviewed or followed up
- Team afraid to raise real issues
- Retrospective skipped or rushed

---

### Red Flags Summary

**Process red flags:**
- Ceremonies feel like obligation, not opportunity
- Velocity used as performance metric
- Quality compromised for velocity
- Sprint commitment inflexible even when learning changes understanding

**Role dysfunction red flags:**
- Product Owner unavailable or order-taking
- Scrum Master acting as project manager
- Development Team not self-organizing
- Roles unclear or contested

**Cultural red flags:**
- Blame culture (not psychological safety)
- Committing without understanding
- No retrospective improvements
- Scrum theater (motions without value)

---

## Key Takeaways

**Scrum provides structure for empirical process control:**
- Transparency through artifacts (backlog, sprint backlog, increment)
- Inspection through ceremonies (daily standup, review, retrospective)
- Adaptation through sprint boundaries and feedback loops

**Three roles with distinct responsibilities:**
- Product Owner maximizes value
- Scrum Master serves team and organization
- Development Team delivers increment

**Five ceremonies create rhythm:**
- Sprint Planning: Define sprint goal and plan
- Daily Standup: Coordinate and adapt daily
- Sprint Review: Inspect increment and adapt backlog
- Sprint Retrospective: Improve process
- Sprint: Time-boxed iteration (1-4 weeks)

**Scrum works best when:**
- Team new to Agile (structure helps)
- Product Owner engaged and empowered
- Cross-functional team with minimal dependencies
- Stakeholders provide regular feedback

**Scrum challenges:**
- Can encourage committing before sufficient discovery
- Sprint boundaries may discourage realignment
- Velocity pressure can compromise quality
- Ceremonies can become theater without genuine engagement

**Success requires discipline:**
- Test assumptions before committing
- Adapt when discovery changes understanding
- Don't compromise Definition of Done
- Focus on sprint goal, not task completion
- Continuous improvement through retrospectives

**The goal is delivering value through empiricism, not perfect ceremony execution.**
