---
title: "ShapeUp Methodology"
layout: guide
category: Software Development Lifecycle
subcategory: SDLC & Modeling
description: "Comprehensive guide to Shape Up methodology - Basecamp's approach to product development featuring six-week cycles, shaping, betting, and building phases."
tags: [sdlc, methodology, agile, product-development, basecamp]
---

## What is Shape Up

*Developed by Basecamp (Ryan Singer, 2019) as an alternative to Scrum. Documented in "Shape Up: Stop Running in Circles and Ship Work that Matters"*

**Shape Up** is a product development methodology that emerged from Basecamp's experience building software products over 15+ years. It addresses common frustrations with Scrum and traditional project management.

<blockquote class="pull-quote">
<p>Fixed time, variable scope. Fit the best solution within time constraints.</p>
</blockquote>

Common frustrations Shape Up addresses:
- Endless backlogs that create guilt and false urgency
- Sprint interruptions that prevent meaningful work
- Unrealistic estimates that set teams up for failure
- Too much process and not enough autonomy
- Work that drags on indefinitely without shipping

**Core Philosophy:**
- Work in fixed **six-week cycles** with **two-week cooldowns**
- **Senior people "shape" work** before it's assigned (not designers working alone or product managers writing specs)
- Give teams **entire projects** with clear boundaries, not individual tasks
- Teams **figure out implementation details** autonomously
- **Fixed time, variable scope** - fit the best solution within time constraints

**Key Difference from Scrum:**

Shape Up is not an iterative approach to a final design. Instead, the shaping process defines boundaries and constraints, and teams work within those boundaries to discover the best solution during the cycle. You're not incrementally building toward a known end state; you're exploring within defined constraints.

**The Three Tracks:**

Shape Up runs three parallel tracks:
1. **Shaping**: Senior staff shape future work (1-2 cycles ahead)
2. **Betting**: Leadership decides what to build next (every 6 weeks)
3. **Building**: Teams implement shaped projects (6-week cycles)

---

## The Shape Up Workflow

Shape Up has three main phases that repeat: **Shaping**, **Betting**, and **Building**.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SHAPE UP WORKFLOW CYCLE                            │
└─────────────────────────────────────────────────────────────────────────────┘

TRACK 1: SHAPING (Ongoing, 1-2 Cycles Ahead)
─────────────────────────────────────────────────────────────────────────
│
│  Step 1: Set Boundaries (Define appetite, problem, scope)
│     │
│     ▼
│  Step 2: Rough Out Elements (Breadboards, fat marker sketches)
│     │
│     ▼
│  Step 3: Address Risks & Rabbit Holes (Technical spikes, de-scope)
│     │
│     ▼
│  Step 4: Write the Pitch (Problem, Appetite, Solution, No-Gos)
│     │
│     └──────────────────────────────┐
│                                    │
│                                    ▼
TRACK 2: BETTING (Every 6 Weeks)
─────────────────────────────────────────────────────────────────────────
                                     │
                    Betting Table Meeting (2-4 hours)
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                   Bet             Bet             Defer
                (Team A)        (Team B)        (Try again)
                    │                │                │
                    └────────────────┼────────────────┘
                                     │
                                     ▼
TRACK 3: BUILDING (6 Weeks)
─────────────────────────────────────────────────────────────────────────
                                     │
                        Week 1-2: Get Oriented
                        (Understand pitch, plan approach)
                                     │
                                     ▼
                        Week 3-4: Build Core
                        (Vertical slices, start in the middle)
                                     │
                                     ▼
                        Week 5-6: Finish & Ship
                        (Scope hammering, deploy to production)
                                     │
                   ┌─────────────────┴─────────────────┐
                   │                                   │
               Shipped ✓                         Not Finished
                   │                                   │
                   ▼                                   ▼
                                            Circuit Breaker Trips
                                            (Re-evaluate, reshape,
                                             or abandon)
                                                       │
                                     ┌─────────────────┴─────────────────┐
                                     │                                   │
                                     ▼                                   ▼
COOL-DOWN (2 Weeks)
─────────────────────────────────────────────────────────────────────────

    • Bug fixes, refactoring, exploration
    • No scheduled work or commitments
    • Teams shape ideas for next cycle
    • Prevents burnout
                                     │
                                     ▼
                            Cycle Repeats
                        (Back to Betting Table)

┌─────────────────────────────────────────────────────────────────────────────┐
│  TIMELINE: 8-Week Cycle = 6 Weeks Building + 2 Weeks Cool-Down             │
│  THREE PARALLEL TRACKS: Shaping future work | Betting on next cycle |       │
│                         Building current cycle                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Phase 1: Shaping (Senior Staff)

**What is Shaping:**

Shaping is pre-project work done by senior staff (experienced designers, product managers, or programmers) to define what will be built before it's assigned to teams.

**Shaping is the right level of abstraction:**
- **Too abstract**: "We need better notifications" (leaves too many questions)
- **Too concrete**: Detailed wireframes and specs (removes team autonomy)
- **Just right**: Defined problem + rough solution concept + clear boundaries

**The Four Steps of Shaping:**

#### 1. Set Boundaries

Define the **appetite** (time budget), not an estimate:
- "This is worth two weeks"
- "This is worth six weeks"
- "This is worth one full cycle"

**Appetite vs. Estimate:**
- **Estimate**: "How long will this take?" (opens scope)
- **Appetite**: "How much time is this worth?" (constrains scope)

Appetite is a design constraint that forces trade-offs. If an idea can't be done within the appetite, it must be reshaped or abandoned.

**Also set scope boundaries:**
- Clearly articulate the **problem** being solved, not the solution
- Identify what's **in scope** and what's **explicitly out of scope**
- Define who this is for (what user segments)
- Define the core use case vs. edge cases

#### 2. Rough Out the Elements

Sketch solution concepts at the right level of abstraction using two techniques:

**Breadboarding (for interactions):**

Borrowed from electrical engineering. Show components, connections, and flow without visual design.

```
Example: Notifications
[Notification Center] → Shows list of notifications
[Mark as Read button] → Marks item read, removes from list
[Archive button] → Archives notification, removes from list
```

Elements: Places (things you navigate to), Affordances (things users can do), Connections (how affordances take users between places)

**Fat Marker Sketches (for interfaces):**

Rough sketches where you literally can't add too much detail (use a thick marker or small whiteboard). This prevents getting stuck in details too early.

Example: Draw rough boxes for major UI regions, arrows for navigation, labels for key components. No pixel-perfect layouts or final copy.

**What to include:**
- Key components and their relationships
- Flow between screens or states
- Major technical considerations or architectural changes
- What's visible, what's behind the scenes

**Goal:** Concrete enough to evaluate technical feasibility and value, abstract enough to leave room for team creativity during implementation.

#### 3. Address Risks and Rabbit Holes

Identify parts that could take too long or spiral out of control:
- **Technical unknowns**: "Can we integrate with this API?" → Spike it during shaping
- **Design unknowns**: "How will filtering work?" → Sketch a few options or declare a constraint
- **Performance concerns**: "Will this scale?" → Do quick proof-of-concept
- **Scope creep risks**: "This could expand to include X, Y, Z" → Explicitly de-scope

**Call out rabbit holes explicitly:**
- "We're not doing real-time sync - batch updates are fine"
- "If the search algorithm takes more than 2 days, we'll use a library"
- "Don't worry about mobile version in this cycle"

**Technical exploration happens during shaping, not during building.** If you're not sure whether something is feasible, figure it out before betting on it.

#### 4. Write the Pitch

A formal write-up that makes the case for the project. This goes to the betting table.

**Pitch Structure:**

**Problem:**
- What's the user pain point?
- Why does this matter now?
- What's the cost of not doing this?

**Appetite:**
- How much time is this worth? (2 weeks, 6 weeks, etc.)

**Solution:**
- The shaped concept with breadboards or fat marker sketches
- Key components and how they fit together
- Flow through the solution

**Rabbit Holes:**
- Known risks and how to avoid them
- What could go wrong
- De-scoping decisions already made

**No-Gos:**
- What we're explicitly not doing
- Scope boundaries
- Features left for future cycles

**Optional: Alternatives considered**: briefly explain why other approaches weren't chosen.

**Who Does Shaping:**
- Senior designers, programmers, or product managers
- Small groups (1-2 people) working collaboratively
- People with both technical knowledge and product sense
- **Not** the teams who will build it (they receive shaped pitches)

**Shaping is Iterative:**

You might:
- Shape something, discover it's too big, and re-shape with reduced scope
- Shape it, and decide it's not valuable enough to pursue
- Shape multiple approaches to the same problem and pick the best
- Shape something, let it sit for a cycle, then reshape it with fresh perspective

**Good shaping takes time:** 1-2 weeks of thinking, sketching, exploring for a 6-week project. But this time investment prevents wasting 6 weeks of team time on poorly-defined work.

---

### Phase 2: Betting (Leadership/Stakeholders)

**What is Betting:**

At the start of each six-week cycle, stakeholders hold a **betting table** meeting (2-4 hours) to decide which shaped pitches to commit to for the next cycle.

**The Betting Table Meeting:**

**Who attends:** CEO/leadership, product leads, and technical leads (whoever has authority to allocate team time)

**What happens:**
1. Review shaped pitches from the shaping track
2. Discuss each pitch: Is this the right time? Is the appetite appropriate? Do we have capacity?
3. Decide which pitches to bet on for the next cycle
4. Assign projects to available teams
5. Teams are notified what they'll be working on

**Rules:**
- **Only bet on work that's been properly shaped** - no betting on vague ideas
- **Betting is a commitment** - once assigned, teams get the full cycle
- **Unbet pitches don't accumulate** - they don't go into a backlog

---

**No Backlogs:**

Shape Up rejects maintaining backlogs of shaped pitches. Ideas that don't get bet on disappear rather than accumulate. If an idea is truly valuable, it will resurface naturally. Old ideas become stale and no longer represent current priorities. Backlogs create false urgency and guilt about being "behind."

Teams maintain their own notes on improvements and bugs, which inform cool-down work and future shaping, but there's no central official backlog.

---

**Cool-Down Period (2 weeks after each 6-week cycle):**

After every six-week cycle, teams get a two-week cool-down:

**What happens during cool-down:**
- Teams work on whatever they want: bug fixes, refactoring, exploration, side projects
- Programmers and designers shape new ideas for upcoming cycles
- Clear out technical debt
- Experiment with new technologies
- Work on small improvements that don't require shaping
- **No scheduled work, no commitments, no tracking**

**Why cool-down matters:**
- Gives teams breathing room and prevents burnout
- Allows time for reactive work (bugs, urgent fixes) without interrupting cycles
- Provides space for learning and exploration
- Gives shapers time to prepare pitches for next betting cycle
- Breaks up the intensity of focused cycle work

**Cool-down is not "cleanup":** It's legitimate productive time, not a second-class sprint.

---

**Commitment and Flexibility:**

**During the cycle:**
- Teams own their project for the full six weeks
- **No interruptions** (no pulling people off projects mid-cycle)
- **No new requirements** added during the cycle
- **No mid-cycle pivots** unless project is completely blocked

**After the cycle:**
- If work doesn't finish in six weeks, it's **not automatically rolled over**
- The circuit breaker trips - project dies
- If it's still valuable, it requires re-shaping and re-betting
- Forces honest evaluation: Was the shaping good? Is this still a priority?

**What about emergencies?**
- True emergencies are rare
- Most "urgent" things can wait until cool-down
- If truly critical, leadership makes explicit decision to interrupt (rarely happens in practice)

---

### Phase 3: Building (Development Teams)

**What is Building:**

Development teams take shaped, scoped projects and implement them within a six-week cycle.

**Team Composition:**
- Typically 1 designer + 1-2 programmers
- Sometimes just programmers (depending on project needs)
- Small enough to avoid coordination overhead
- Senior enough to make decisions autonomously

---

**Assign Projects, Not Tasks:**

**Traditional approach:**
- PM or Scrum Master breaks down project into tasks
- Tasks assigned to individuals
- Team assembles the pieces

**Shape Up approach:**
- Team gets entire project with clear boundaries
- Team decides how to break down the work
- Team self-organizes around implementation
- **No daily standups, story points, or task assignments required**

**Why this works:**
- People closest to the work make the best decisions
- Avoids "imagined tasks" that turn out wrong
- Teams take ownership and accountability
- Faster decision-making

---

**Getting Oriented (First Few Days):**

When a cycle starts, teams don't immediately start coding:

**Days 1-3:**
- Study the pitch and shaped concept carefully
- Discuss the problem and proposed solution as a team
- Identify obvious tasks and components
- Begin exploratory work to understand the terrain
- Sketch out technical approach
- Identify unknowns and risks

**It's okay to move slowly at first.** This is figuring-out time, not wasted time.

---

**Imagined vs. Discovered Tasks:**

**Imagined tasks** (before work starts):
- Often wrong or missing details
- Based on assumptions that turn out false
- Create false sense of precision
- Get stale as work progresses

**Discovered tasks** (during work):
- Emerge from actual implementation
- Based on reality, not assumptions
- More accurate and relevant
- Stay fresh and actionable

**Shape Up approach:**
- Don't create exhaustive task lists upfront
- Discover tasks as you build and learn
- Continuously adjust scope based on what you learn
- Make scope trade-offs to stay within six weeks

---

**Work in Vertical Slices:**

Build complete features end-to-end (one slice at a time) rather than horizontal layers (all backend, then all frontend). This ensures integration happens continuously, visible progress from day one, and the ability to cut scope cleanly if needed. See [Build One Piece at a Time](#build-one-piece-at-a-time) for detailed examples.

---

**The Hill Chart:**

Shape Up tracks progress with a "Hill Chart" metaphor. **Uphill** (left): figuring out unknowns, high uncertainty. **Top**: clarity achieved, approach figured out. **Downhill** (right): clear execution of known solution, predictable progress.

Teams place work items on the hill and move them right as understanding increases. Unlike "50% complete" (which doesn't indicate if the hard part is done), "uphill" clearly signals ongoing discovery while "downhill" signals predictable execution. Leaders can identify work stuck uphill and offer help.

---

**Scope Hammering:**

As teams build, they continuously refine scope to stay within six weeks:

**Finding the core:**
- What **must** be included for this to solve the problem?
- What are **nice-to-haves** that can be cut if time runs short?
- What trade-offs preserve the core user value?

**Making cuts:**
- Simplify complex features
- Cut edge cases (handle the 90% case, not every edge)
- Reduce polish (good enough > perfect)
- Defer nice-to-haves to future cycles

**It's okay to cut scope to ship within the cycle.** The circuit breaker (see below) creates pressure to make these trade-offs actively rather than letting work drag on.

**Examples of scope hammering:**
- "Let's show notifications in a simple list, not group by type"
- "We'll handle just the main notification types, not every possible type"
- "Basic settings page is fine, fancy organization can wait"

---

**The Circuit Breaker:**

If work doesn't ship in six weeks, the project **automatically dies**. There's **no automatic rollover**.

**Why the circuit breaker exists:**
- Forces aggressive scope management throughout the cycle
- Prevents endless projects that never ship
- Forces honest evaluation: Was the shaping good? Is this still a priority?
- Creates urgency to make scope trade-offs

**What happens if work doesn't finish:**

Project is not automatically scheduled for next cycle. Team and leadership re-evaluate whether to reshape with reduced scope, split into multiple projects, or abandon. This prevents sunk cost fallacy and forces honest assessment of whether shaping was poor, scope was underestimated, or priorities have changed.

---

**Done Means Deployed:**

A cycle is complete when work is deployed to production and available to users, not when code is "done" in a branch. Teams think about deployment from day one, with testing and QA happening throughout the cycle. No separate QA phase or hardening sprints; teams own quality.

---

## Key Principles and Practices

### Fixed Time, Variable Scope

Six weeks is non-negotiable, and scope adjusts to fit time. Appetite drives design constraints, forcing prioritization upfront and throughout. This prevents scope creep, delivers value predictably every six weeks, and builds a culture of shipping over perfection.

Traditional approach asks "How long will this take?" Shape Up asks "What's the best version we can ship in six weeks?"

---

### No Estimates

Shape Up uses **appetite** ("How much time is this worth?") instead of story points, hour estimates, or velocity. Appetite is decided by business value and becomes a design constraint. Shapers work within appetite when designing; teams make scope trade-offs to fit. If something can't be done within appetite, reshape or abandon it.

Traditional: "Feature X is 40 story points, velocity is 30, so 1.3 sprints." Shape Up: "Feature X is worth 2 weeks. If we can't do it in 2 weeks, reshape it."

---

### Autonomy and Trust

Teams figure out implementation details, make technical decisions, organize their own work, and adjust scope within boundaries. No required ceremonies, meaning no mandatory standups, sprint planning, retrospectives, or story point poker. Teams choose their own coordination practices, meeting schedules, and tools. This autonomy attracts talented people, enables faster decisions, produces better solutions from those close to the work, and increases engagement.

---

### Start in the Middle

Start with the core, novel part that solves the main problem and carries the risk, not peripheral features like authentication, settings, or permissions. Core problems are where uncertainty lies, so starting early reveals if the shaped solution works. Peripheral features are well-understood and can be cut if time runs short.

Example: When building a calendar feature, start with calendar views and event creation (weeks 1-4), then add settings and polish (weeks 5-6). Don't spend weeks 1-4 on auth/permissions and run out of time for the actual calendar.

---

### Build One Piece at a Time

**Don't:** Separate frontend and backend work
```
Sprint 1-2: Backend team builds entire API
Sprint 3-4: Frontend team builds entire UI
Sprint 5: Integration (surprises!)
```

**Do:** Build complete slices (one feature end-to-end)
```
Week 1-2: "View notifications" - backend + frontend + tests
Week 3-4: "Mark as read" - backend + frontend + tests
Week 5-6: "Settings" - backend + frontend + tests
```

**Example - Building a Calendar Feature:**
- ❌ Bad: Build entire backend API for calendar, then build entire frontend UI
  - No integration until week 5
  - Surprises late in the cycle
  - Hard to see progress
  - Can't cut scope cleanly

- ✅ Good: Build "view single day" end-to-end, then "navigate between days", then "create event"
  - Integration happens immediately
  - Working software from week 1
  - Can stop at any slice and ship something
  - Easy to cut scope (just drop last slice)

**Why:**
- Integration problems surface immediately (not week 5)
- Visible progress from day one (builds team confidence)
- Can stop at any point and have something working (flexibility)
- Reduces risk by validating the approach early
- Makes scope trade-offs obvious (cut last slice if needed)

---

## When to Use Shape Up

### Shape Up Works Well For:

Product development teams building or enhancing features, organizations that value shipping over process, teams of 2-3+ experienced developers who can handle ambiguity, projects with uncertainty requiring exploration, and organizations comfortable making explicit priority decisions and saying no to low-value work.

---

### Shape Up May Not Fit:

Brand new teams still learning to work together, strict fixed-scope contracts or highly regulated environments requiring detailed upfront documentation, command-and-control cultures uncomfortable with team autonomy, junior or distributed teams needing detailed task breakdowns, or very short projects (< 2 weeks) better handled during cool-down.

---

### Adaptations for Your Context:

Shape Up is adaptable. Adjust cycle length (4-8 weeks, 6 is standard), cool-down duration (1-2 weeks or flexible), betting table formality (formal meetings, informal discussions, or async), shaping approach (formal pitches or lightweight sketches), team size (1-2 for small projects, 3-4 for larger), and hill charts usage (optional). Mix with other methods; use Shape Up for features, Kanban for maintenance, or hybrid approaches as needed.

---

## Alignment with AAA Cycle

Shape Up's three-phase structure can align with [AAA Cycle](aaa-cycle.html) principles: **Shaping = Align**, **Betting Table = Agree**, **Building = Apply**.

### Natural Compatibility

Shape Up was designed around similar values as AAA:
- **Alignment before commitment**: Don't bet on unshaped work; defer commitment until sufficient understanding
- **Explicit agreements**: Betting table makes yes/no decisions with clear boundaries (appetite, must-haves, out of scope)
- **Disciplined application**: Circuit breaker enforces time agreement; scope hammering respects appetite without cutting corners
- **Outcomes over specifications**: Pitch defines problem and solution direction; teams have autonomy on implementation details

### Friction Points and Resolution

**Potential friction: Betting table can feel top-down**

Teams may receive assignments without participating in shaping, which can feel like "told what to build" rather than collaborative alignment.

**Resolution:**
- Include team leads in betting table (at least as observers)
- Shapers consult with teams during shaping for technical feasibility
- Teams can push back if pitch doesn't make sense
- Cool-down period allows team input on shaping for next cycle

---

**Potential friction: Fixed 6-week cycle may not match discovery rhythm**

Some problems need exploration during building, and the circuit breaker can feel arbitrary when shaping assumptions prove wrong.

**Resolution:**
- Use first week of cycle for team-level validation of the pitch
- Hill charts surface when teams are stuck "uphill" (signal to pause and realign)
- Unfinished work doesn't auto-rollover; re-evaluate if still worth doing
- Explicit permission to stop and realign if fundamental assumptions wrong

---

**Potential friction: Hand-off between shaping and building can lose context**

Shapers understand the problem deeply, but teams receive a pitch document. Context and reasoning might not transfer completely.

**Resolution:**
- Shapers present pitches to teams directly (not just written pitch)
- Include "why this matters" and research findings in every pitch
- Shapers available during building to clarify intent
- Teams have autonomy to adjust approach if better solution found

### How Shape Up Structures AAA Phases

Shape Up makes AAA's three phases explicit and structured. Teams know exactly when they're aligning vs. agreeing vs. applying. The methodology provides clear boundaries between these phases by design.

---

## Common Pitfalls and How to Avoid Them

### Pitfall 1: Shaping Too Detailed or Too Vague

**Too detailed:**
- Creates wireframes and detailed specs
- Removes team autonomy during building
- Wastes shaping time on specifics that will change
- Team feels like they're just implementing someone else's design

**Too vague:**
- "Make notifications better" (what does "better" mean?)
- Team thrashes trying to figure out what to build
- Lots of back-and-forth, scope uncertainty
- Risk of building wrong thing

**Sweet spot:**
- Defined problem with clear value
- Rough solution concept (breadboards, fat marker sketches)
- Clear boundaries (appetite, in/out of scope)
- Identified risks and rabbit holes
- Room for team creativity in implementation

**How to find the sweet spot:**
- Use breadboards and fat marker sketches (forces right abstraction)
- Ask: "Can a team build this in 6 weeks with this information?"
- Ask: "Does this leave room for team decisions?"
- Review with someone who wasn't part of shaping for clarity check

---

### Pitfall 2: Not Addressing Rabbit Holes During Shaping

**Problem:**
Teams get stuck on problems that should've been de-scoped or explored during shaping:
- "We didn't realize we'd need real-time updates"
- "Turns out the API we wanted to use doesn't support this"
- "The performance requirements are way higher than we thought"

**Solution:**
- **Technical spikes during shaping** - figure out unknowns before betting
- **Explicit de-scoping** - call out what you're not doing
- **Risk identification** - what could go wrong? How to mitigate?
- **Proof of concepts** - validate technical feasibility during shaping

**Example:**
Bad shaping: "We'll integrate with the payment API"
Good shaping: "We'll integrate with Stripe (validated we can do this during spike). We're only doing credit card payments, not ACH or crypto. If webhooks are flaky, we'll poll instead."

---

### Pitfall 3: Interrupting Teams Mid-Cycle

**Problem:**
- Leadership pulls people off projects for "urgent" work
- Teams can't focus and make progress
- Six-week cycles become meaningless
- Destroys morale and trust

**Solution:**
- **Protect cycle time fiercely** - six weeks means six weeks
- **Use cool-down for urgent work** - most "urgent" things can wait 1-2 weeks
- **Plan capacity realistically** - don't bet on more work than you have team capacity
- **Make interruptions explicit exceptions** - if you interrupt, acknowledge it's breaking the process

**True emergencies are rare:** Most "urgent" things are just unplanned work that can wait.

---

### Pitfall 4: Rolling Over Unfinished Work Automatically

**Problem:**
- Work doesn't finish in six weeks
- Leadership automatically schedules it for next cycle
- Circuit breaker never trips
- Defeats the purpose of fixed time

**Solution:**
- **Let the circuit breaker trip** - if it didn't ship, it dies
- **Re-evaluate priority** - is this still the most valuable thing?
- **Reshape with reduced scope** - if still valuable, make it smaller
- **Learn from the failure** - was the shaping poor? Unexpected complexity?

**Questions to ask when work doesn't finish:**
- Was the shaping poor? (didn't understand the problem)
- Was the scope too ambitious? (should've been two projects)
- Did unexpected issues arise? (new information)
- Is this still a priority? (context may have changed)

---

### Pitfall 5: Using Shape Up But Keeping Scrum Ceremonies

**Problem:**
- Try to use Shape Up for project structure
- Keep Scrum daily standups, sprint planning, retrospectives
- Mixing methodologies creates overhead without benefits
- Team spends more time in meetings, not building

**Solution:**
- **Choose one approach** - Shape Up or Scrum, not both
- **Or clearly separate contexts** - Shape Up for new features, Scrum for maintenance
- **Trust the methodology** - Shape Up's autonomy requires fewer ceremonies
- **Let teams decide** - if they want standups, fine, but don't mandate

**It's okay to:**
- Use Shape Up for project structure and XP for engineering practices (TDD, pair programming)
- Use Shape Up for product development and Kanban for operations
- Use Shape Up for one team and Scrum for another

**It's problematic to:**
- Use Shape Up but mandate daily standups
- Use Shape Up but require story point estimates
- Use Shape Up but have sprint reviews every two weeks
- (These contradict Shape Up's autonomy and fixed 6-week rhythm)

---

### Pitfall 6: Not Shaping Far Enough Ahead

**Problem:**
- Betting table arrives, no shaped pitches ready
- Leadership bets on unshapped work (vague ideas)
- Teams get work without clear boundaries
- Defeats the whole purpose of shaping

**Solution:**
- **Shape 1-2 cycles ahead** - always have shaped options ready
- **Use cool-down for shaping** - designers and programmers shape during their cool-down
- **Maintain a shaping schedule** - shaping is ongoing, not last-minute
- **Have more shaped pitches than team capacity** - gives betting table options

**Shaping pipeline:**
- Cycle N: Team A building, Team B building
- Cycle N shaping: Preparing pitches for Cycle N+1
- Always stay ahead

---

### Pitfall 7: Treating Cool-Down as Second-Class Time

**Problem:** Cool-down is viewed as "cleanup" or gets skipped when "behind."

**Solution:** Protect cool-down time. It's legitimate work (bug fixes, refactoring, exploration) that prevents burnout, creates space for reactive work, allows experimentation, and gives shaping time for the next cycle. See [Cool-Down Period](#cool-down-period-2-weeks-after-each-6-week-cycle) for full details.
