---
title: "Waterfall Methodology"
layout: guide
category: Software Development Lifecycle
subcategory: SDLC Frameworks
description: "Sequential development with phase gates: what Royce actually proposed, the six phases and their deliverables, where predictive planning genuinely wins, the hybrid forms in common use, and the eight ways deferred feedback turns into project failure."
tags: [fundamentals, waterfall, phase-gates, requirements, regulated-industries, change-control]
---

## What is Waterfall

*The sequential model is usually traced to Winston W. Royce's 1970 paper "Managing the Development of Large Software Systems." Royce presented the single-pass sequential diagram as a flawed process, called testing only at the end "risky and invites failure," and proposed five modifications to remove most of the development risk. The modifications never took hold; the diagram of the flawed process did. Royce never used the word "waterfall," which appears to have entered the literature later.*

**Waterfall** is a sequential software development methodology where each phase must be completed before moving to the next. Progress flows in one direction (like a waterfall), with formal gates between phases.

<blockquote class="pull-quote">
<p>The diagram that became Waterfall was drawn by Royce as an example of what not to do.</p>
</blockquote>

**Core Philosophy:**
- Sequential, linear progression through phases
- Comprehensive upfront planning and requirements
- Extensive documentation at each phase
- Formal approval gates between phases
- Change is costly after requirements phase

**Key Characteristics:**

**Sequential phases:**
```
Requirements → Design → Implementation → Testing → Deployment → Maintenance
```

**Each phase produces deliverables:**
- Requirements phase → Requirements document
- Design phase → Design specifications
- Implementation phase → Source code
- Testing phase → Test reports
- Deployment phase → Deployed system

**Formal gates:**
- Phase cannot begin until previous phase complete
- Formal sign-off required to move forward
- Changes after sign-off require change control process

### Why Waterfall Emerged

**Historical context (1950s-1970s):**

Waterfall emerged from manufacturing and construction industries:
- Building a bridge: Design everything upfront, changes expensive
- Manufacturing: Retooling production line costly
- Physical constraints make iteration impractical

**Applied to software (1970s-2000s):**

Early software development adopted this approach because:
- Software seen as similar to engineering disciplines
- Deployment was expensive (ship physical media)
- Changes required re-releasing products
- Tools primitive (no automated testing, deployment)
- Computing resources scarce (expensive to iterate)

**Why it dominated:**
- Management understood it (familiar from other industries)
- Predictable (plan everything upfront)
- Clear accountability (phase ownership)
- Extensive documentation (audit trail)

### Historical Context

**Royce's original paper (1970):**

Winston Royce described the waterfall model but **warned against using it**:
- "I believe in this concept, but the implementation described above is risky and invites failure."
- Recommended iteration between phases
- Emphasized prototyping and customer involvement
- Suggested risk mitigation through incremental approaches

**Despite warnings, waterfall became standard:**
- Managers liked predictability
- Contractors liked fixed-bid projects
- Government and military standardized on it (DOD-STD-2167)
- Became dogma in many organizations

**Waterfall's decline (2000s-present):**

Waterfall fell out of favor due to:
- High failure rates (projects over budget, late, wrong features)
- Inability to adapt to changing requirements
- Late discovery of problems (testing at end)
- Rise of Agile methodologies
- Internet era requires faster iteration

**Modern context:**

Waterfall still used in:
- Highly regulated industries (FDA, aerospace, defense)
- Hardware-software integration projects
- Projects with truly stable requirements
- Contractual obligations requiring waterfall
- Organizations with waterfall-mandated processes

---

## Philosophy and Core Principles

### Predictive Planning

**What it means:**

Plan the entire project upfront. Know requirements, design, timeline, and budget before starting development.

**Traditional project management:**
- Define scope completely (what will be built)
- Estimate effort and timeline (how long)
- Lock in budget (how much)
- Execute according to plan

**Why this was valued:**
- Management can make informed decisions
- Stakeholders know what they're getting
- Budget and timeline predictable
- Risk theoretically reduced through planning

**Reality:**
- Requirements change during development
- Estimates often wrong (software complexity hard to estimate)
- Late discovery of issues (integration, performance)
- "Iron triangle" tension (scope, time, cost)

---

### Comprehensive Documentation

**What it means:**

Extensive documentation at every phase. Documentation is primary deliverable, not just byproduct.

**Types of documentation:**

**Requirements phase:**
- Business requirements document (BRD)
- Functional requirements specification (FRS)
- Use cases and user stories
- Acceptance criteria

**Design phase:**
- System architecture document (SAD)
- Database design specifications
- Interface specifications (APIs, UI)
- Security design

**Implementation phase:**
- Code documentation (inline comments, API docs)
- Developer guides
- Technical specifications

**Testing phase:**
- Test plans and test cases
- Test reports and defect logs
- Traceability matrices

**Deployment phase:**
- Deployment guides
- Operations manuals
- Training materials
- Maintenance documentation

**Why documentation emphasized:**
- Knowledge transfer (people leave)
- Audit trail (compliance requirements)
- Contract fulfillment (deliverable proof)
- Future maintenance (understand system)

**Downsides:**
- Documentation becomes stale (not updated)
- Effort spent documenting instead of building
- Documents don't capture tacit knowledge
- Over-documentation (nobody reads it)

---

### Phase Gates and Sign-Offs

**What it means:**

Formal approval required to move to next phase. Each phase produces deliverables that stakeholders review and approve.

**Phase gate process:**
```
Phase Work → Deliverable Produced → Stakeholder Review → Sign-Off → Next Phase
```

**Example: Requirements → Design gate:**
- Requirements document produced
- Stakeholders review requirements
- Formal sign-off meeting
- Approval granted (or revisions requested)
- Design phase begins

**Why gates exist:**
- Ensure quality (catch issues before moving forward)
- Stakeholder alignment (everyone agrees on requirements)
- Accountability (sign-off creates commitment)
- Risk mitigation (don't proceed with flawed requirements)

**Downsides:**
- Delays (waiting for approvals)
- False sense of security (sign-off doesn't mean requirements correct)
- Change resistance ("we already signed off")
- Blame shifting ("you approved it")

---

### Change Control

**What it means:**

Changes after requirements sign-off go through formal change control process. Changes are expensive and discouraged.

**Change control process:**
1. Change request submitted (what needs to change, why)
2. Impact analysis (effort, cost, schedule impact)
3. Change advisory board (CAB) reviews
4. Approval or rejection decision
5. If approved: Update documents, schedule, budget
6. Implementation

**Why change control exists:**
- Prevent scope creep (uncontrolled expansion)
- Manage expectations (stakeholders understand cost)
- Maintain traceability (document all changes)
- Protect budget and timeline

**Downsides:**
- Slow (weeks or months for approval)
- Discourages necessary changes
- Encourages "requirements padding" (ask for everything upfront)
- Adversarial (change seen as problem, not learning)

---

## The Waterfall Phases

### Phase 1: Requirements Gathering and Analysis

**What happens:**

Gather all requirements from stakeholders. Document everything the system must do.

**Activities:**

**1. Stakeholder interviews**
- Who will use the system?
- What problems does it solve?
- What features are needed?
- What are constraints?

**2. Requirements documentation**
- Business requirements (high-level objectives)
- Functional requirements (what system must do)
- Non-functional requirements (performance, security, usability)
- Constraints (budget, timeline, technology)

**3. Requirements validation**
- Review with stakeholders
- Ensure completeness (nothing missing)
- Resolve conflicts (contradictory requirements)
- Prioritize (must-have vs. nice-to-have)

**Deliverables:**
- Requirements specification document
- Use cases or user stories
- Acceptance criteria
- Traceability matrix

**Duration:** Typically 1-3 months depending on project size

**Sign-off:** Stakeholders formally approve requirements

**Key challenge:**

Stakeholders often don't know what they want until they see it. Requirements gathered at this phase may be incomplete or wrong, but waterfall assumes they're correct.

---

### Phase 2: System Design

**What happens:**

Translate requirements into technical design. Define architecture, database schema, interfaces, and components.

**Activities:**

**1. High-level design (architecture)**
- System architecture (components, layers)
- Technology stack selection
- Integration points (APIs, databases)
- Security architecture
- Deployment architecture

**2. Detailed design**
- Database schema (tables, relationships, indexes)
- API specifications (endpoints, payloads)
- User interface mockups (screens, workflows)
- Component specifications (classes, modules)
- Algorithms and data structures

**3. Design reviews**
- Peer review by senior engineers
- Architecture review board
- Security review
- Performance analysis

**Deliverables:**
- System architecture document (SAD)
- Database design document
- Interface specifications
- UI/UX designs
- Technical specifications

**Duration:** Typically 1-3 months

**Sign-off:** Technical leadership and stakeholders approve design

**Key challenge:**

Design based on requirements that may be incomplete or misunderstood. Design decisions made without implementation feedback (may not work as planned).

---

### Phase 3: Implementation (Development)

**What happens:**

Write code according to design specifications. Build the system.

**Activities:**

**1. Coding**
- Implement components per design
- Follow coding standards
- Write inline documentation
- Unit test individual components

**2. Code reviews**
- Peer review code
- Ensure adherence to design
- Check code quality
- Verify standards compliance

**3. Integration**
- Integrate components
- Build complete system
- Resolve integration issues
- Prepare for testing phase

**Deliverables:**
- Source code
- Code documentation
- Build scripts
- Developer guides

**Duration:** Typically 3-12 months depending on project size

**Sign-off:** Code complete, ready for testing

**Key challenge:**

Developers often discover design flaws during implementation. In waterfall, going back to design phase is expensive and discouraged. Result: Workarounds and technical debt.

---

### Phase 4: Testing and Quality Assurance

**What happens:**

Verify the system works according to requirements. Find and fix defects.

**Activities:**

**1. Test planning**
- Define test strategy
- Create test plans
- Write test cases (based on requirements)
- Prepare test environments

**2. Testing execution**
- **Unit testing:** Individual components
- **Integration testing:** Components working together
- **System testing:** Entire system
- **User acceptance testing (UAT):** Stakeholders validate

**3. Defect management**
- Log defects found
- Prioritize defects (severity, impact)
- Fix defects
- Retest after fixes

**Deliverables:**
- Test plans and test cases
- Test execution reports
- Defect logs and resolution
- UAT sign-off

**Duration:** Typically 1-3 months

**Sign-off:** Stakeholders accept system (UAT passed)

**Key challenge:**

Testing at the end means late discovery of issues. Integration problems, performance issues, and fundamental design flaws discovered here are expensive to fix. Pressure to accept defects due to timeline.

---

### Phase 5: Deployment

**What happens:**

Deploy system to production and make it available to users.

**Activities:**

**1. Deployment planning**
- Deployment strategy (big bang, phased, parallel)
- Rollback plan
- Training plan
- Communication plan

**2. Deployment execution**
- Data migration (if applicable)
- System installation and configuration
- User training
- Go-live

**3. Cutover**
- Switch from old system to new
- Monitor closely
- Support users
- Address issues

**Deliverables:**
- Deployed system
- Deployment report
- Training materials
- Operations documentation

**Duration:** Days to weeks

**Sign-off:** System in production, users trained

**Key challenge:**

"Big bang" deployment is high risk. Issues discovered after deployment affect all users. Rollback may not be feasible if data has been migrated.

---

### Phase 6: Maintenance and Support

**What happens:**

Fix bugs, make minor changes, support users.

**Activities:**

**1. Bug fixes**
- Users report issues
- Developers fix bugs
- Deploy patches

**2. Minor enhancements**
- Small changes and improvements
- Governed by change control

**3. Support**
- Help desk support
- User questions
- System monitoring

**Duration:** Ongoing (years)

**Key challenge:**

Most of software's total cost is maintenance (60-90%). Waterfall projects often under-budget maintenance. Changes expensive due to lack of automated tests and rigid architecture.

---

## Roles and Responsibilities

### Project Manager

**Responsibilities:**
- Create project plan (timeline, milestones, budget)
- Track progress against plan
- Manage resources (people, budget)
- Report status to stakeholders
- Manage risks and issues
- Enforce phase gates

**Key artifacts:**
- Project plan (Gantt chart, timeline)
- Status reports
- Risk register
- Issue log

---

### Business Analyst

**Responsibilities:**
- Gather requirements from stakeholders
- Document requirements
- Validate requirements
- Manage requirements changes
- Bridge business and technical teams

**Key artifacts:**
- Business requirements document (BRD)
- Functional requirements specification (FRS)
- Use cases
- Requirements traceability matrix

---

### System Architect / Technical Lead

**Responsibilities:**
- Design system architecture
- Make technology decisions
- Review technical designs
- Ensure design meets requirements
- Guide development team

**Key artifacts:**
- System architecture document (SAD)
- Technical specifications
- Design diagrams
- Technology selection rationale

---

### Developers

**Responsibilities:**
- Implement design
- Write code per specifications
- Unit test code
- Document code
- Participate in code reviews

**Key artifacts:**
- Source code
- Unit tests
- Code documentation
- Developer notes

---

### QA / Testers

**Responsibilities:**
- Create test plans and test cases
- Execute tests
- Log defects
- Verify fixes
- Conduct user acceptance testing

**Key artifacts:**
- Test plans
- Test cases
- Test execution reports
- Defect logs
- UAT sign-off

---

### Stakeholders / Product Owner

**Responsibilities:**
- Define requirements
- Provide business context
- Review and approve deliverables
- Participate in UAT
- Accept final system

**Key artifacts:**
- Requirements sign-off
- Design approval
- UAT acceptance
- Final sign-off

---

## Documentation and Deliverables

### Required Documentation

**1. Project Charter**
- Project objectives and scope
- Stakeholders and roles
- High-level timeline and budget
- Success criteria

**2. Requirements Specification**
- Business requirements
- Functional requirements
- Non-functional requirements (architectural characteristics)
- Constraints and assumptions
- Acceptance criteria

**3. System Architecture Document**
- Architecture overview
- Component descriptions
- Technology stack
- Integration points
- Security architecture
- Deployment architecture

**4. Detailed Design Specifications**
- Database schema
- API specifications
- UI mockups and workflows
- Component designs
- Algorithms and data structures

**5. Test Documentation**
- Test strategy and approach
- Test plans (unit, integration, system, UAT)
- Test cases (linked to requirements)
- Test reports and metrics
- Defect logs

**6. Deployment Documentation**
- Deployment plan
- Installation guides
- Configuration guides
- Training materials
- Operations manuals

**7. Maintenance Documentation**
- System maintenance guide
- Troubleshooting guide
- Known issues and workarounds
- Change log

---

## When to Use Waterfall

### Waterfall Works Well For:

**1. Highly regulated industries**

**FDA (medical devices):**
- Extensive documentation required for approval
- Design history file (DHF) mandatory
- Validation and verification required
- Changes require regulatory approval

**Aerospace and defense:**
- Safety-critical systems
- Government contracts require waterfall
- Extensive testing and documentation
- Formal verification required

**Financial services (some contexts):**
- Regulatory compliance requirements
- Audit trails essential
- Formal change control processes

**Why:** Regulatory bodies require comprehensive documentation and formal processes that waterfall provides.

---

**2. Fixed-scope, fixed-bid contracts**

**What it looks like:**
- Client specifies exact requirements upfront
- Contract defines deliverables, timeline, cost
- Contractor builds to specification
- Changes require contract amendments

**Why waterfall fits:**
- Clear scope definition (what will be delivered)
- Predictable timeline and cost (bid accurately)
- Formal change control (protect margins)
- Documentation proves contract fulfillment

**Examples:**
- Government RFPs (request for proposals)
- Enterprise software implementations
- System integrations with defined interfaces

---

**3. Hardware-software integration projects**

**Why waterfall fits:**
- Hardware changes expensive (can't iterate easily)
- Must define interfaces upfront
- Parallel development (hardware and software)
- Integration happens late (physical constraints)

**Examples:**
- Embedded systems (automotive, industrial)
- Medical devices
- Aerospace systems
- IoT devices

---

**4. Projects with truly stable requirements**

**Rare but exists:**
- Replacing existing system with known requirements
- Implementing established standards (compliance)
- Migrating data with defined schemas
- Building to existing specifications

**Why waterfall works:**
- Requirements won't change
- No learning through iteration needed
- Extensive planning makes sense
- Predictability valued over flexibility

---

**5. Organizations with waterfall mandates**

**Reality:**
- Some organizations require waterfall
- Government agencies
- Large enterprises with established processes
- Contractual obligations

**Strategy:**
- Hybrid approaches (waterfall wrapper, agile inside)
- Agile-within-waterfall increments
- Documented agile (satisfy documentation needs)

---

### Waterfall Does NOT Work Well For:

**1. Projects with evolving requirements**

**Why waterfall fails:**
- Requirements locked in early
- Change control discourages adaptation
- Late discovery that requirements wrong
- Expensive to change direction

**Better approach:** Agile methodologies (Scrum, Kanban, XP)

---

**2. Innovative or exploratory projects**

**Why waterfall fails:**
- Don't know what to build upfront
- Learning happens through building
- Requirements emerge from experimentation
- Need flexibility to pivot

**Better approach:** Lean Startup, XP

---

**3. Software-only projects (no hardware constraints)**

**Why waterfall unnecessary:**
- Software is malleable (easy to change)
- Deployment easy and cheap (cloud, CI/CD)
- Feedback fast (users can test immediately)
- Iteration beneficial (learn and improve)

**Better approach:** Agile methodologies

---

**4. Fast-moving markets**

**Why waterfall fails:**
- Long planning cycles (months)
- Competitor moves faster
- Market changes before delivery
- Customer needs evolve

**Better approach:** Lean, Kanban, continuous delivery

---

**5. Startups and product development**

**Why waterfall fails:**
- Unknown product-market fit
- Need to experiment and learn
- Resources constrained (can't afford waterfall overhead)
- Speed to market critical

**Better approach:** Lean Startup

---

## Hybrid Approaches

Many organizations use hybrid approaches combining waterfall structure with agile practices.

### Waterfall with Agile Phases

**Structure:**
- Requirements phase: Waterfall (comprehensive upfront)
- Design phase: Waterfall (architecture defined)
- Implementation phase: **Agile sprints**
- Testing phase: Continuous (integrated with sprints)
- Deployment phase: Waterfall (formal release)

**Why this works:**
- Architecture stable (defined upfront)
- Implementation flexible (sprints allow iteration)
- Satisfies stakeholders expecting waterfall
- Teams get benefits of agile

**Challenges:**
- Requirements still locked early
- Architecture may not support emerging needs
- Testing still somewhat late

---

### Incremental Waterfall

**Structure:**

Break project into increments, each following waterfall:

```
Increment 1: Requirements → Design → Implement → Test → Deploy
Increment 2: Requirements → Design → Implement → Test → Deploy
Increment 3: Requirements → Design → Implement → Test → Deploy
```

**Why this works:**
- Reduces risk (smaller increments)
- Delivers value earlier (not waiting for entire project)
- Allows some learning between increments
- Still satisfies waterfall documentation needs

**Challenges:**
- Each increment still sequential
- Changes between increments difficult
- Integration challenges

---

### Documented Agile

**Structure:**
- Work using Agile methodology (Scrum, XP)
- Produce waterfall documentation artifacts
- Map agile ceremonies to waterfall gates

**Why this works:**
- Team gets agile benefits (iteration, feedback)
- Organization gets documentation (compliance, audit)
- Satisfies stakeholders expecting waterfall artifacts

**Challenges:**
- Documentation overhead
- Tension between agile values and waterfall requirements
- Risk of "agile theater" (documentation without agility)

---

### Water-Scrum-Fall

**Structure:**
- **Water-fall:** Requirements phase (traditional waterfall)
- **Scrum:** Development phase (agile sprints)
- **Water-fall:** Deployment and operations (traditional waterfall)

**Why organizations do this:**
- Business comfortable with waterfall planning
- Development team wants to work agile
- Operations wants formal deployments

**Why it's problematic:**
- Not truly agile (requirements still locked early)
- Handoffs between phases (silos)
- Testing and deployment still late
- Known anti-pattern (coined pejoratively)

**Better approach:**
- Full agile adoption (DevOps for deployment)
- Or acknowledge it's waterfall with sprints

---

## Where Waterfall Goes Wrong

Every failure below comes from the same root. Waterfall defers feedback to the end, so anything the team was wrong about stays wrong for as long as the project runs, and surfaces at the point where correcting it costs the most.

### Late Discovery of Fundamental Issues

Nothing executable exists until implementation is nearly finished, so requirements misunderstandings, design flaws, integration mismatches and performance problems all arrive together during the testing phase. A defect found in requirements is a conversation. The same defect found after integration is a redesign of everything built on it.

The countermeasure inside a sequential project is to create earlier evidence: prototypes during requirements and design, integration that happens continuously rather than as an event, and something demonstrable in front of stakeholders long before user acceptance testing.

**Warning signs:** the first integration happens in the testing phase, no proof of concept exists for anything novel, and stakeholders see nothing until UAT.

### Requirements Churn Meets Change Resistance

Requirements change during any project long enough to matter, and Waterfall's change control exists to make that expensive. The result is one of two failures. Either change requests get denied and the project delivers faithfully against an understanding that is now obsolete, or changes happen informally, the plan silently stops matching reality, and the eventual overrun gets argued about rather than explained.

Neither is a discipline problem. Long timelines guarantee the business context will move, and stakeholders discover what they actually want by seeing something work.

**Warning signs:** requirements locked for a year or more, no functioning mechanism for change, and stakeholders who have learned not to ask.

### Documentation That Nobody Reads

When documents are the deliverable a phase gate checks, producing them becomes the work. Requirements specifications reach hundreds of pages, design documents describe systems in detail that implementation immediately invalidates, and nothing gets updated because updating is not what the gate measures.

The defensible version keeps documentation that captures decisions and their reasoning, which is the part that cannot be recovered from the code later. The wasteful version documents what the code already says.

**Warning signs:** weeks spent formatting rather than deciding, documents that nobody has opened since sign-off, and specifications that contradict the running system.

### Phase Boundaries That Prevent Learning

Strict gates assume information flows one way. In practice design reveals that requirements are ambiguous, implementation reveals that the design does not work, and testing reveals requirements nobody thought to state. A gate that forbids going back does not prevent the discovery, it only prevents acting on it.

Sequential projects that work tend to allow overlap between adjacent phases and a path for later phases to correct earlier ones, which is most of what Royce's original modifications were about.

**Warning signs:** teams idle waiting for a gate, handoffs with no shared context, and known requirement errors that stay in because the gate closed.

### Estimates Made When Least Is Known

Waterfall needs a whole-project estimate at the point of minimum information, which is precisely where estimates are least reliable. Steve McConnell's cone of uncertainty describes this: early in a project, estimates range from roughly a quarter of the eventual figure to around four times it, and the range narrows only as the work reveals itself.

Pressure makes this worse, because the request is usually for a single number rather than a range, and a range that honestly reflects the uncertainty tends to be read as evasion.

**Warning signs:** point estimates demanded before design, no contingency, and estimates that are never revised as the project learns.

### Testing as a Phase Rather Than a Practice

Making testing a phase puts it at the end of the schedule, which is where the schedule pressure is. Defects surface with the launch date approaching, and the negotiation becomes which known defects ship rather than whether to ship.

The structural fix is to stop treating quality as a stage. Automated tests that run on every change, and developers who own the quality of what they write, move detection to the point where fixing is cheap.

**Warning signs:** no automated tests, QA discovering defects developers never saw, and a defect triage meeting whose purpose is deciding what to accept.

### The Approved-Requirements Defence

When a project delivers exactly what was specified and stakeholders say it is not what they wanted, both sides are telling the truth, and the sign-off gets used as an argument. It works as an argument and solves nothing, because the product is still wrong.

A signature means the requirements were the best shared understanding available at that moment. Treating it as a transfer of responsibility is what turns a discovery into a dispute.

**Warning signs:** "you signed off" appearing in a conversation about a defect, stakeholders surprised at a demo, and no stakeholder contact between requirements and UAT.

### The Death March

Late project, fixed date, and the only remaining variable is hours. Teams work nights and weekends, quality falls, people leave, and the extra hours produce less per hour than the normal ones did.

This is the terminal form of the other failures rather than a separate problem. Optimistic estimates, unmanaged scope change and late discovery all arrive at the same place, and the response of adding hours rather than renegotiating scope is what converts a late project into a damaged team.

**Warning signs:** sustained overtime described as a temporary push, quality metrics declining while the date holds, and turnover starting before the deadline.

---

## If You Have to Use It

Waterfall is sometimes the right choice and more often an inherited constraint. Both cases benefit from the same adjustments, all of which keep the contractual shape while shortening the distance to feedback.

Shorten the cycle by delivering in increments, so each pass through the phases covers a slice rather than the whole system. Allow adjacent phases to overlap, since design work genuinely does inform requirements. Prototype anything novel during requirements rather than discovering it during implementation. Integrate continuously instead of at a milestone. Document decisions and reasoning rather than everything. Estimate in ranges with stated contingency. And keep stakeholders involved past the requirements phase, because the signature was never the point.

The regulated industries where Waterfall persists need evidence of a controlled process, not a single pass through it. That distinction is what most of the hybrid approaches above are built on.
