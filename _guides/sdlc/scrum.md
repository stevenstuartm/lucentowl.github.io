---
title: "Scrum Methodology"
layout: guide
category: Software Development Lifecycle
subcategory: SDLC Frameworks
description: "Scrum as the 2020 Scrum Guide defines it: three accountabilities, five events inside a fixed-length Sprint, three artifacts and the commitments that make them inspectable, velocity and the metrics around it, and the eight ways teams keep the structure while losing the feedback."
tags: [practical, scrum, agile, sprints, velocity, product-owner, scrum-master]
---

## What is Scrum

*Developed by Jeff Sutherland and Ken Schwaber in early 1990s, formalized in 1995. Based on empirical process control theory and influenced by Takeuchi & Nonaka's "The New New Product Development Game" (1986). Codified in the [Scrum Guide](https://scrumguides.org/){:target="_blank" rel="noopener noreferrer"} by Sutherland and Schwaber.*

**Scrum** is a lightweight framework for developing, delivering, and sustaining complex products. It works through three accountabilities, five events inside a fixed-length Sprint, and three artifacts, each of which carries a commitment that makes it inspectable.

<blockquote class="pull-quote">
<p>Knowledge comes from experience and decisions based on what is known, not from predictions and planning.</p>
</blockquote>

**Core Philosophy:**
- Empirical process control (transparency, inspection, adaptation)
- Iterative and incremental delivery
- Self-organizing, cross-functional teams
- Time-boxed sprints (typically 2 weeks)
- Regular inspection and adaptation through events

**Key Characteristics:**

Unlike principle-based approaches (Lean, Kanban), Scrum prescribes specific:
- **Roles**: Product Owner, Scrum Master, Developers
- **Events**: Sprint Planning, Daily Scrum, Sprint Review, Sprint Retrospective
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
- Regular events creating transparency and coordination
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
<p>Regularly inspect artifacts and progress: Daily Scrum, Sprint Review, Sprint Retrospective, and continuous inspection during development.</p>
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

### Where the Values Come From

Scrum's five values are not arbitrary. Each one names a behavior the empirical loop stops working without. Inspection requires openness, because an inspection of a flattering report inspects nothing. Adaptation requires courage, because changing a plan in front of the people who approved it is uncomfortable. Focus and commitment are what make a Sprint Goal mean anything, and respect is what lets a team disagree productively about how to reach it.

This also explains why Scrum is usually described as easy to understand and difficult to master. The mechanics take an afternoon. The values are a description of a team that is already functioning well, and no framework installs those.

---

## The Scrum Framework

### Framework Overview

Scrum is intentionally incomplete, defining only the framework while teams determine practices within it.

**What Scrum prescribes:**
- Three accountabilities: Product Owner, Scrum Master, Developers
- Five events: the Sprint, which is a container for the other four, plus Sprint Planning, the Daily Scrum, the Sprint Review and the Sprint Retrospective
- Three artifacts, each with a commitment that makes it inspectable: Product Backlog with a **Product Goal**, Sprint Backlog with a **Sprint Goal**, Increment with a **Definition of Done**
- A Scrum Team of typically ten or fewer people

The commitments were added in the 2020 Scrum Guide, and they are the part most often missing from teams that learned Scrum earlier. Each exists so that inspecting the artifact has a reference point. A Product Backlog with no Product Goal can be ordered but cannot be judged, because nothing states what it is ordered toward.

**What Scrum doesn't prescribe:**
- Engineering practices (XP supplies these: TDD, pair programming, continuous integration)
- Estimation methods (story points, ideal days, t-shirt sizes)
- Tools (Jira, Azure DevOps, physical boards)
- Backlog format (user stories, job stories, use cases)
- Any format for the Daily Scrum

### The Sprint

**A Sprint is a fixed-length event of one month or less, during which a "Done" Increment is created.** Two weeks is the most common choice.

**Sprint characteristics:**

- **Fixed duration**: 2 weeks is most common (balance between feedback and overhead)
- **Consistent duration**: Don't change length sprint-to-sprint
- **Sprint Goal**: Coherent objective providing focus
- **No changes that endanger sprint goal**: Scope may be renegotiated with Product Owner
- **Quality doesn't decrease**: Definition of Done remains constant

**Sprint flow:**
```
Sprint Planning → Daily Scrums (every day) → Development → Sprint Review → Retrospective → Next Sprint
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

## Scrum Accountabilities

Scrum defines three roles, each with distinct responsibilities.

### Product Owner

**Responsibilities:**

**1. Maximize value of product and Developers' work**
- Understands customer needs and business context
- Makes trade-offs between features, cost, time
- Ensures work delivers business value

**2. Manage Product Backlog**
- Creates and communicates Product Backlog items
- Orders items by value (not necessarily priority)
- Ensures backlog is visible, transparent, and clear
- Ensures Developers understands items sufficiently

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

**1. Serve the Developers**

Help team self-organize and be more effective:
- **Coaching**: Teach Scrum practices and values
- **Facilitation**: Make the events produce decisions rather than reports
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

- **A leader who serves**: the 2020 Scrum Guide describes Scrum Masters as true leaders who serve the Scrum Team and the wider organization
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
- Scrum Master doesn't attend events or shows up late
- Impediments remain unresolved sprint after sprint
- Team afraid to surface problems (no psychological safety)

---

### Developers

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

## Scrum Events

Scrum defines five time-boxed events that provide structure and opportunities for inspection and adaptation.

### Sprint Planning

**Purpose:** Define what can be delivered in the sprint and how the team will achieve it.

**Duration:** 2-4 hours for 2-week sprint (max 8 hours for 4-week sprint)

**Participants:** Entire Scrum Team (Product Owner, Scrum Master, Developers)

**Two parts:**

**Part 1: What will be delivered? (The Sprint Goal)**

Product Owner presents highest priority Product Backlog items:
- What business value do these items deliver?
- What are acceptance criteria?
- Why is this valuable to build now?

Developers asks clarifying questions:
- What edge cases exist?
- What does "done" mean for this item?
- What dependencies or risks exist?

Team collaboratively selects items:
- Based on team capacity and velocity
- Team commits to sprint goal (not necessarily all items)
- Sprint Goal provides coherence (theme or objective)

**Part 2: How will the work be done?**

Developers plans the work:
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

### Daily Scrum

**Purpose:** Inspect progress toward sprint goal and adapt plan for next 24 hours.

**Duration:** 15 minutes maximum

**Participants:** Developers (required), Scrum Master facilitates, Product Owner may attend

**Format:**

The 2020 Scrum Guide prescribes no format at all. Developers choose whatever structure they want, provided it focuses on progress toward the Sprint Goal. Two formats are common.

**Per person, three questions.** What did I do yesterday toward the Sprint Goal, what will I do today, and what is in my way. This is the format most people were taught, and it is also the one that most reliably degrades into a status round where each person reports and nobody adapts anything.

**Walk the board, right to left.**
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

Developers demonstrates:
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

**Participants:** Scrum Team (Product Owner, Scrum Master, Developers)

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
- Team afraid to raise the issues that matter (lack of safety)

---

### Product Backlog Refinement

**Purpose:** Add detail, estimates, and order to Product Backlog items.

**Duration:** Not officially time-boxed, but typically consume no more than 10% of Developers' capacity

**Participants:** Product Owner + Developers (Scrum Master facilitates)

Refinement is an ongoing activity rather than a timeboxed event, so the Scrum Guide prescribes no meeting for it. Most teams schedule one anyway, because Sprint Planning is too late to be discovering what an item means.

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

**Its commitment is the Product Goal.** The Product Goal is the longer-term objective the Product Backlog is ordered toward, and the Scrum Team works on one at a time until it is met or abandoned. Without it, "ordered by value" has no reference point, and backlog ordering becomes an argument between stakeholders rather than a judgement against a stated objective.

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

- **Team commits**: Developers selects items (not assigned by Product Owner)
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
- Scrum training for entire team (roles, events, artifacts)
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

- Daily Scrums start immediately
- Team delivers first increment
- Keep first sprint focused and achievable (build confidence)

**End of Week 2: First events**
- Sprint Review (show increment to stakeholders)
- Sprint Retrospective (how did it go?)
- Sprint Planning for Sprint 2

---

### Sprints 1-3: Establishing Rhythm

**Sprint 1: Focus on establishing cadence**
- All events happen at scheduled times
- Team learns to work together
- Initial velocity baseline (likely low)
- Lots of learning and adjustment

**Sprint 2: Refining practices**
- Velocity may improve as team learns
- Refine Definition of Done
- Improve backlog refinement
- Address impediments from Sprint 1 retrospective

**Sprint 3: Finding groove**
- Events feel more natural
- Velocity stabilizing
- Team self-organizing effectively
- Quality practices solidifying

**By end of Sprint 3:**
- Velocity becomes somewhat predictable
- Team comfortable with events
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
- Events time-boxed effectively
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

**Challenge 1: "We don't have time for events"**

**Problem:** Team sees events as overhead

**Solution:**
- Make events effective (time-boxed, facilitated well)
- Track value from events (decisions made, impediments removed)
- Treat events as work, not extra
- Cancel ineffective events and retrospect on why

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

## When to Use Scrum

Scrum suits work that is genuinely uncertain, where a cross-functional team can produce something demonstrable inside a few weeks, and where stakeholders are available to look at it and react. Those three conditions carry most of the decision, and all three have to hold.

It is also a good scaffold for a team new to iterative work. Its prescriptiveness is usually described as a limitation, and for an experienced team it is, but for a team that has never run a feedback loop it supplies a rhythm that has to be deliberately abandoned rather than one that has to be deliberately built. Clear accountabilities remove a lot of early ambiguity about who decides what.

Organizations that need forecasting get it from the cadence, since a team with a stable Sprint length and a few Sprints of history can forecast from its own record rather than from estimates.

### Where Scrum Fits Badly

**Work that arrives unpredictably.** Support, maintenance and incident work cannot wait for a Sprint boundary, and forcing it into one either breaks the Sprint or delays the work. Continuous flow handles it better, and running it as a separate system alongside planned work is a common and sound arrangement.

**Exploratory work with no definable goal.** A Sprint Goal requires knowing what would constitute progress. Research where that is genuinely unknown does not fit the container, though it often fits inside a Sprint as a timeboxed spike.

**Teams that cannot produce an increment.** When a team is blocked by other teams often enough that nothing reaches Done, the Sprint exposes the problem without solving it. This is nearly always a team-boundary or dependency problem rather than a framework problem, and adopting something with less structure hides it rather than fixing it.

**Teams of one to three people.** The events cost roughly the same regardless of team size, and the coordination they produce is worth less when everyone already knows what everyone is doing. Distinct accountabilities also stop meaning much when one person holds several.

**Unavailable stakeholders.** A Product Owner who cannot commit the time, or stakeholders who do not attend the Sprint Review, break the feedback loop the whole framework is built around. What is left is a two-week planning cycle.

### Common Adaptations

**Scrum with XP engineering practices** is the most valuable of these by a distance. Scrum is deliberately silent on how code gets written, and a large share of reported Scrum failures are the absence of the technical discipline it never claimed to supply.

**Scrumban** keeps the Sprint cadence and adds WIP limits and flow metrics inside it, which suits a team that wants Scrum's rhythm but finds its work arriving in a less predictable shape than Sprint Planning assumes.

**Separate systems for separate work types** runs planned product work on Sprints and operational work as flow, rather than forcing both through one process that fits neither.

When several teams work on one product, coordination needs a deliberate mechanism rather than an ad hoc one, and the scaling frameworks exist for that.

---

## Where Scrum Goes Wrong

Scrum is a small framework with a large surface for misuse, and most of the misuse shares one root. The framework's parts exist to create feedback and to make what is actually happening visible. Each failure below keeps a part while removing the visibility it was there to produce.

### Scrum Theater

The events happen on schedule and none of them changes anything. The Daily Scrum becomes a status round delivered to the Scrum Master, the Sprint Review becomes a polished demo where no feedback is genuinely sought, the Retrospective raises the same issues every time, and Sprint Planning ratifies work that was already assigned.

Nothing in this is detectable from a calendar, which is why it persists. The test is not whether an event happened but whether anything was decided in it. An event that produces no decision, no change of plan and no removed impediment is a meeting with a Scrum name on it.

**Warning signs:** the same format every time with no experimentation, attendance without engagement, and no action coming out of any event.

### Velocity as a Performance Measure

Velocity exists so a team can forecast its own capacity. The moment it is used to evaluate the team, it stops being able to do that, because the team now has a reason to make the number go up that has nothing to do with delivery.

What follows is predictable. Estimates inflate, work gets declared done while incomplete, and teams get compared to each other despite estimating in units that were never comparable. The number rises, the delivery does not, and the team has lost its only forecasting tool.

**Warning signs:** velocity targets set by management, velocity compared between teams, and velocity rising while quality metrics fall.

### Committing Without Understanding

Sprint Planning is a few hours long, which is enough time to plan work the team understands and nowhere near enough to understand work it does not. A team that commits to items whose acceptance criteria are vague or whose technical approach is unknown has committed to a guess.

The failure surfaces mid-Sprint as discovery, and discovery mid-Sprint is expensive because the commitment is already made. Refinement exists to prevent this, which is why it is continuous rather than a meeting, and why spikes for genuinely unknown work belong in the Sprint before the one that builds the thing.

**Warning signs:** acceptance criteria written during Planning, items entering a Sprint with no agreed approach, and the same items rolling over repeatedly.

### Sacrificing Quality to Hit the Commitment

When the Sprint is ending and the work is not done, the flexible variable looks like quality, because cutting it is invisible this Sprint. Tests get skipped, review gets cursory, and the increment ships with a shape nobody would have chosen.

The debt comes due whether or not anyone planned for it, so the next Sprint starts with less capacity than the last. Teams in this pattern get slower every Sprint while appearing to hold velocity, because the velocity is measured in points and the loss is in the codebase.

**Warning signs:** the Definition of Done negotiated near the end of a Sprint, "we'll add tests next Sprint" recurring, and defect counts climbing while velocity holds.

### The Product Owner Who Only Routes Requests

A Product Owner who passes stakeholder requests through to the backlog in the order they arrive is not ordering the backlog, they are queuing it. The accountability is to maximize value, which requires saying no, and saying no requires authority the organization has to actually grant.

This is usually an organizational failure rather than a personal one. A Product Owner without the standing to refuse a senior stakeholder will not develop it by being coached, and the fix is at the level of what the role is empowered to decide.

**Warning signs:** a backlog ordered by who asked, no Product Goal anyone can state, and priorities that change whenever a stakeholder escalates.

### The Scrum Master as Task Master

Assigning work to individuals, tracking who is doing what, and reporting on people rather than on flow is project management with a Scrum title. It removes the self-management the Developers are accountable for, and with it the reason the team would take responsibility for the Sprint Goal.

The accountability is to make the team effective, which mostly means removing what is in its way and protecting the conditions that let it decide for itself.

**Warning signs:** tasks assigned in Planning rather than pulled, individual progress tracked and reported, and the team asking permission for decisions that are theirs.

### The Sprint Goal Treated as a Contract

The opposite failure to abandoning the commitment is treating it as immutable. A team that discovers mid-Sprint that its approach is wrong and builds it anyway because the Sprint was committed has chosen a schedule over the product.

The Sprint Goal is meant to be the stable part while the scope that achieves it flexes. That distinction is what makes the commitment safe to make, and a team that cannot renegotiate scope against a fixed goal has kept the commitment and lost the mechanism.

**Warning signs:** scope never changing mid-Sprint, known-wrong work completed because it was committed, and Sprint cancellation treated as unthinkable rather than as an available move.

### Retrospectives That Change Nothing

Retrospectives run, issues get raised, notes get taken, and the next retrospective raises the same issues. The team learns that the event does not lead anywhere, engagement drops, and the meeting continues.

Two things break the loop. The first is limiting improvements to one or two per Sprint so they can actually be finished. The second is putting them in the Sprint Backlog, where they compete for capacity honestly, rather than in a separate list that gets done when there is time.

**Warning signs:** the same issues appearing across several retrospectives, improvement actions with no owner, and organizational impediments raised repeatedly and never escalated.

---
