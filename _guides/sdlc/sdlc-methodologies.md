---
title: "SDLC Methodologies Comparison"
layout: guide
category: Software Development Lifecycle
subcategory: SDLC & Modeling
description: "Comprehensive comparison of software development methodologies including Waterfall, Agile (Scrum, Kanban, XP, Shape Up), Lean, DevOps, and specialized approaches with guidance on selection."
tags: [sdlc, methodology, agile, waterfall, comparison, decision-making]
---

## Overview

Most legacy SDLC methodologies aren't even taught in University or bootcamp classrooms. Instead, today's classes teach Agile frameworks like Scrum and Kanban. However, understanding different methodologies helps choose the right approach for specific project needs and constraints.

<blockquote class="pull-quote">
<p>There is no "best" methodology, only the right methodology for your context, constraints, and team.</p>
</blockquote>

### What Are SDLC Methodologies?

**SDLC methodologies** are structured approaches that define how teams move through the software development lifecycle phases (planning, design, development, testing, deployment, maintenance). While the phases remain consistent, methodologies differ in:

- **Approach**: Sequential vs. iterative vs. continuous
- **Flexibility**: Fixed scope vs. adaptive scope
- **Documentation**: Heavy documentation vs. minimal documentation
- **Planning**: Upfront planning vs. just-in-time planning
- **Feedback**: End-of-project feedback vs. continuous feedback

### Key Concepts

**Iterative Development**: Building software in repeated cycles, refining with each iteration

**Incremental Development**: Delivering software in small, functional pieces that add up to the complete system

**Adaptive vs. Predictive**: Adaptive methodologies embrace change; predictive methodologies lock down requirements early

**Process-Heavy vs. Lightweight**: How much ceremony, documentation, and structure is required

---

## Traditional Methodologies

### Waterfall Model

*Formalized by Winston W. Royce in 1970 paper "Managing the Development of Large Software Systems." Ironically, Royce actually argued against the pure waterfall approach, but it became the dominant methodology anyway.*

**What it is:** A stricter, more linear methodology that limits a team's ability to diverge from the project plan at different stages in the SDLC. Each phase must be completed before moving to the next.

**Key Characteristics:**
- Sequential, linear progression through phases
- Extensive upfront planning and documentation
- Fixed requirements defined at the beginning
- Limited flexibility for changes once started
- Clear phase gates and sign-offs

**The Waterfall Flow:**
```
Requirements → Design → Implementation → Testing → Deployment → Maintenance
     ↓            ↓            ↓             ↓           ↓
  (Complete)  (Complete)   (Complete)    (Complete)  (Complete)
```

**When to Use:**
- Projects with well-defined, stable requirements
- Regulatory or compliance-heavy environments (FDA, aerospace, defense)
- Projects requiring extensive documentation for audits
- Teams comfortable with structured, predictable processes
- Fixed-bid contracts with clear deliverables
- Hardware-software integration projects where changes are expensive

**Why Choose Waterfall:**
- **Predictability**: Clear timelines and deliverables understood upfront
- **Documentation**: Comprehensive specifications and records for compliance
- **Control**: Strong project governance and oversight
- **Risk Management**: Thorough planning reduces surprises
- **Clear Milestones**: Easy to measure progress against plan

**Limitations:**
- Inflexible to changing requirements
- Late discovery of issues (testing happens at the end)
- Extended time to market
- Limited customer feedback during development
- High risk if requirements were misunderstood

**Historical Context:**
Waterfall dominated software development from the 1970s through the 1990s. While often criticized today, it was appropriate for an era when:
- Requirements were more stable
- Software was often delivered on physical media
- Changes were expensive to deploy
- Hardware constraints limited flexibility

---

### Spiral Model

*Developed by Barry Boehm in 1986 as a response to Waterfall's limitations, particularly around risk management.*

**What it is:** A risk-driven methodology that combines iterative development with systematic risk assessment at each phase. The project spirals through repeated cycles, with each cycle adding functionality.

**Key Characteristics:**
- Four main phases repeated in spirals: Planning, Risk Analysis, Engineering, Evaluation
- Iterative cycles with increasing functionality
- Extensive risk assessment and mitigation at each cycle
- Prototyping and validation at each cycle
- Combines Waterfall's planning with iterative refinement

**The Spiral Phases:**

1. **Planning**: Define objectives, constraints, and alternatives
2. **Risk Analysis**: Identify and evaluate risks, develop mitigation strategies
3. **Engineering**: Build and test the increment
4. **Evaluation**: Review with stakeholders, plan next spiral

**When to Use:**
- Complex and high-risk projects
- Large-scale systems development
- Projects with significant technical uncertainty
- When risk mitigation is paramount
- Projects requiring extensive validation
- R&D projects where requirements emerge over time

**Why Choose Spiral:**
- **Risk Management**: Systematic risk identification and mitigation at each phase
- **Flexibility**: Iterative approach allows for changes based on learnings
- **Validation**: Regular prototyping and stakeholder evaluation
- **Scalability**: Suitable for large, complex projects
- **Early Feedback**: Risks and issues surface early in each spiral

**Limitations:**
- Complex to manage (requires risk assessment expertise)
- Can be expensive (multiple iterations increase cost)
- Requires active stakeholder involvement throughout
- Not suitable for small projects (overhead too high)
- Time-consuming risk analysis

---

## Agile Family of Methodologies

*Agile Manifesto created by 17 software developers in 2001 (Kent Beck, Martin Fowler, Robert C. Martin, and others) emphasizing individuals, working software, customer collaboration, and responding to change.*

### Agile Manifesto Values

**Core Agile Principles:**
- **Individuals and interactions** over processes and tools
- **Working software** over comprehensive documentation
- **Customer collaboration** over contract negotiation
- **Responding to change** over following a plan

**12 Principles of Agile:**
1. Satisfy customers through early and continuous delivery
2. Welcome changing requirements, even late in development
3. Deliver working software frequently (weeks rather than months)
4. Business and developers work together daily
5. Build projects around motivated individuals
6. Face-to-face conversation is the most effective communication
7. Working software is the primary measure of progress
8. Sustainable development pace
9. Continuous attention to technical excellence
10. Simplicity (maximize work not done)
11. Self-organizing teams
12. Regular reflection and adjustment

---

### Scrum Framework

*Developed by Jeff Sutherland and Ken Schwaber in early 1990s, formalized in 1995. Based on empirical process control theory and influenced by Takeuchi & Nonaka's "The New New Product Development Game" (1986).*

**What it is:** An Agile methodology that uses an incremental approach to work in order to complete projects more quickly. Scrum uses fixed-length sprints (typically 2 weeks) to deliver working increments.

**Key Characteristics:**
- Fixed-length sprints (typically 1-4 weeks, most commonly 2 weeks)
- Defined roles: Scrum Master, Product Owner, Development Team
- Structured ceremonies: Sprint Planning, Daily Standups, Sprint Review, Retrospective
- Artifacts: Product Backlog, Sprint Backlog, Increment
- Emphasis on velocity and sprint commitments

**Scrum Roles:**

- **Product Owner**: Defines product vision, manages backlog, prioritizes work, accepts completed work
- **Scrum Master**: Facilitates process, removes impediments, coaches team on Scrum practices
- **Development Team**: Cross-functional team (5-9 people) that delivers increments

**Scrum Ceremonies:**

- **Sprint Planning**: Team selects work from backlog and plans sprint (2-4 hours for 2-week sprint)
- **Daily Standup**: 15-minute sync on progress, plans, and blockers
- **Sprint Review**: Demo completed work to stakeholders, gather feedback
- **Sprint Retrospective**: Team reflects on process and identifies improvements

**When to Use:**
- Software development projects
- Teams that benefit from structure within agility
- Projects requiring regular stakeholder feedback
- Complex projects that can be broken into increments
- Teams new to Agile methodology (Scrum provides clear structure)
- Organizations wanting predictable delivery cadence

**Why Choose Scrum:**
- **Structure**: Clear roles, ceremonies, and artifacts provide guardrails
- **Predictability**: Regular sprint cadence provides rhythm and planning
- **Transparency**: Sprint reviews and visible backlogs show progress
- **Continuous Improvement**: Built-in retrospectives drive process improvements
- **Focus**: Sprint commitments create focus and limit work-in-progress

**Considerations:**
- Requires dedicated Scrum Master (at least part-time)
- Can become rigid if implemented dogmatically ("cargo cult Scrum")
- May struggle with changing priorities mid-sprint
- Sprint ceremonies can feel like overhead for experienced teams
- Works best with co-located or well-coordinated distributed teams

---

### Kanban Method

*Originated at Toyota in the 1940s as part of the Toyota Production System (Taiichi Ohno). Adapted to software development by David J. Anderson in the mid-2000s.*

**What it is:** A scheduling system framework for the Lean methodology. It uses visual boards to track work and limit work-in-progress, emphasizing continuous flow over fixed iterations.

**Key Characteristics:**
- Continuous flow rather than fixed iterations
- Visual workflow management with Kanban boards
- Work-in-progress (WIP) limits to prevent overload
- Pull-based system driven by capacity
- Explicit process policies
- Focus on cycle time and throughput

**Core Practices:**

1. **Visualize Workflow**: Make work visible on a board with columns for each state
2. **Limit WIP**: Set explicit limits on work in progress per column
3. **Manage Flow**: Monitor and optimize work movement through the system
4. **Make Process Policies Explicit**: Document "definition of done" and transition criteria
5. **Implement Feedback Loops**: Regular reviews and retrospectives
6. **Improve Collaboratively**: Evolve the process based on data and feedback

**Typical Kanban Board:**
```
| To Do | In Progress (WIP: 3) | Code Review (WIP: 2) | Testing (WIP: 2) | Done |
|-------|---------------------|---------------------|-----------------|------|
```

**When to Use:**
- Maintenance and support projects
- Teams handling varied request types
- Operations with unpredictable workloads
- Teams wanting to improve existing processes gradually
- Projects requiring continuous delivery
- Support teams balancing planned work and interruptions

**Why Choose Kanban:**
- **Flexibility**: No fixed iterations or sprint commitments
- **Visual Management**: Clear workflow visualization shows bottlenecks
- **Efficiency**: Focus on optimizing flow and reducing cycle time
- **Low Overhead**: Minimal process requirements and ceremonies
- **Easy to Start**: Can overlay Kanban on existing processes

**Considerations:**
- Can become inefficient without proper backlog management
- Less structured than Scrum (requires team discipline)
- Requires vigilance to maintain WIP limits
- No built-in prioritization mechanism (requires additional discipline)
- Can drift without regular reviews

---

### Extreme Programming (XP)

*Created by Kent Beck in the mid-1990s while working on the Chrysler Comprehensive Compensation System. Formalized in "Extreme Programming Explained" (1999).*

**What it is:** An Agile methodology that emphasizes technical practices and engineering excellence. XP "turns the dials to 11" on good practices: if code reviews are good, do them constantly (pair programming); if testing is good, test everything all the time (TDD).

**Key Characteristics:**
- Engineering practices including pair programming, test-driven development (TDD), and continuous feedback
- Frequent releases (multiple times per day to production)
- High customer involvement and collaboration
- Emphasis on code quality and technical excellence
- Simple design and continuous refactoring

**Five Values:**
1. Communication
2. Simplicity
3. Feedback
4. Courage
5. Respect

**12 Core Practices:**

**Planning:**
1. **Planning Game**: Short planning cycles with customer involvement
2. **Small Releases**: Frequent releases to production
3. **Customer Acceptance Tests**: Customers define acceptance criteria upfront

**Design:**
4. **Simple Design**: Simplest design that works, no over-engineering
5. **Refactoring**: Continuous improvement of code structure

**Coding:**
6. **Pair Programming**: Two developers at one workstation
7. **Test-Driven Development**: Write tests before code
8. **Collective Code Ownership**: Anyone can change any code
9. **Coding Standards**: Consistent style across codebase
10. **Continuous Integration**: Integrate and test frequently

**Team:**
11. **40-Hour Work Week**: Sustainable pace (no overtime as a standard)
12. **On-Site Customer**: Customer representative available to team

**When to Use:**
- Projects needing high-quality code and rapid releases
- Small, co-located teams (2-12 people)
- Projects with high technical risk or complexity
- When customer availability is high
- Teams committed to engineering excellence
- Startups or projects requiring fast iteration

**Why Choose XP:**
- **Code Quality**: Strong emphasis on technical practices produces maintainable code
- **Flexibility**: Quick adaptation to changing requirements
- **Customer Satisfaction**: Continuous collaboration ensures right product
- **Risk Reduction**: Early and frequent testing catches issues immediately
- **Knowledge Sharing**: Pair programming spreads knowledge across team

**Considerations:**
- Requires strict discipline and buy-in from entire team
- May be overkill for simple projects
- Intensive customer involvement required (not always feasible)
- Pair programming controversial (some find it exhausting)
- May be challenging for distributed teams
- Higher upfront cost (two developers per task)

---

### Shape Up

*Developed by Ryan Singer and the team at Basecamp (formerly 37signals) in the 2010s, documented in "Shape Up: Stop Running in Circles and Ship Work that Matters" (2019).*

**What it is:** An agile methodology that replaces fixed sprints with fixed-time, variable-scope cycles (6 weeks) focused on meaningful project completion. It emphasizes upfront shaping work, betting on projects, and giving teams uninterrupted time to solve problems.

**Key Characteristics:**
- Fixed 6-week cycles with 2-week cooldown periods
- Upfront shaping work that defines problem boundaries, not detailed specs
- Betting table where leadership commits to projects
- Small teams (1 designer + 1-2 programmers) with full autonomy
- Circuit breakers: no extensions - projects either ship or get re-shaped
- No backlogs or endless to-do lists
- Appetite-based planning (time available) rather than estimation-based

**Core Concepts:**

**Shaping**: Senior team members spend the cooldown period shaping potential projects:
- Define the problem, not the solution
- Set boundaries with appetite (how much time is this worth?)
- Rough out the solution to prove feasibility
- Identify risks and rabbit holes
- Produce shaped work ready for betting

**Betting**: Leadership reviews shaped projects and decides what to commit to:
- Betting happens every 6 weeks
- Choose projects that fit the appetite
- Commit fully - no interruptions during the cycle
- If a project doesn't ship in 6 weeks, it doesn't get an automatic extension
- Unfinished work goes back to shaping (circuit breaker)

**Building**: Teams get full cycle (6 weeks) to work autonomously:
- No daily standups or status meetings required
- Teams scope down work to fit the circuit breaker
- Use hill charts to show progress (uphill = figuring things out, downhill = executing)
- Focus on delivering integrated slices, not separate layers
- Solve problems creatively within the appetite

**Cooldown (2 weeks)**: Between cycles:
- No scheduled work
- Teams can fix bugs, explore ideas, or pay down tech debt
- Shapers prepare projects for next betting table
- Breathing room prevents burnout

**When to Use:**
- Product development teams (especially SaaS products)
- Teams that struggle with endless sprint churn
- Organizations wanting to break feature factory patterns
- Teams where senior members can shape work effectively
- Projects requiring meaningful completion, not partial increments
- Teams that can work autonomously without frequent check-ins

**Why Choose Shape Up:**
- **Meaningful Work**: 6 weeks allows time to complete something significant
- **No Estimation Theater**: Appetite replaces estimates ("how much time is this worth?" vs. "how long will this take?")
- **Circuit Breaker**: Forces hard decisions rather than endless extensions
- **Autonomy**: Teams solve problems without micromanagement
- **No Backlogs**: Only shaped, bet-on work gets done; everything else is intentionally discarded
- **Strategic Shaping**: Senior members solve hard problems before teams build

**Considerations:**
- Requires experienced shapers (senior designers/developers who can define boundaries)
- Circuit breaker can feel harsh (projects that don't ship get killed)
- Not suitable for teams needing daily oversight
- Requires leadership buy-in to betting process
- 6-week cycles may be too long for very early-stage startups
- Less structure than Scrum (requires team maturity)
- Shaping work requires dedicated time from senior staff

**Shape Up vs. Scrum:**
- **Time box**: 6 weeks vs. 2 weeks
- **Scope**: Variable (teams scope down to fit) vs. Fixed (committed sprint backlog)
- **Planning**: Shaping by seniors before betting vs. Sprint planning by whole team
- **Autonomy**: High (no daily standups) vs. Lower (daily standups, mid-sprint adjustments)
- **Backlogs**: None (shaped work only) vs. Product backlog with prioritized stories
- **Interruptions**: None during cycle vs. Sprint goals can shift
- **Output**: Completed, integrated work vs. Incremental stories

---

### Lean Software Development

*Adapted from Lean Manufacturing (Toyota Production System) to software development by Mary and Tom Poppendieck in the early 2000s, documented in "Lean Software Development: An Agile Toolkit" (2003).*

**What it is:** Focuses on reducing waste, improving efficiency, and delivering value to the customer. It emphasizes only building features that are necessary and eliminating activities that don't add value.

**Seven Principles:**

1. **Eliminate Waste**: Remove anything that doesn't add customer value
   - Partially done work
   - Extra features
   - Relearning
   - Task switching
   - Waiting
   - Handoffs
   - Defects

2. **Build Quality In**: Prevent defects rather than finding and fixing them
   - Test-driven development
   - Pair programming
   - Continuous integration
   - Automated testing

3. **Create Knowledge**: Treat development as a learning process
   - Short iterations for rapid feedback
   - Documentation when it adds value
   - Code reviews and retrospectives
   - Experimentation and spikes

4. **Defer Commitment**: Delay irreversible decisions as long as possible
   - Options-based thinking
   - Just-in-time decision-making
   - Flexible architecture
   - Avoid premature optimization

5. **Deliver Fast**: Speed up value delivery
   - Small batches
   - Limit work in progress
   - Fast feedback loops
   - Continuous deployment

6. **Respect People**: Empower teams and individuals
   - Trust team decisions
   - Provide purpose and autonomy
   - Invest in learning
   - Sustainable pace

7. **Optimize the Whole**: Think systemically, not locally
   - End-to-end workflow optimization
   - Break down silos
   - Measure what matters
   - Value stream mapping

**When to Use:**
- Resource-constrained environments
- Projects requiring maximum efficiency
- Startups focusing on MVP development
- Teams wanting to minimize overhead and waste
- Value-driven development environments
- Organizations wanting to transition gradually from Waterfall

**Why Choose Lean:**
- **Efficiency**: Ruthless focus on value-adding activities
- **Waste Reduction**: Eliminate non-essential work and delays
- **Fast Delivery**: Quick time to market through small batches
- **Continuous Improvement**: Built-in kaizen mindset
- **Flexibility**: Defer decisions until you have information

**Considerations:**
- Requires cultural shift (thinking in terms of value and waste)
- Can be abstract (harder to implement than prescriptive methodologies)
- Identifying waste requires experience and judgment
- May conflict with organizational processes (procurement, budgeting)

---

## Hybrid and Specialized Methodologies

### DevOps Methodology

*Emerged in late 2000s as development and operations communities collaborated to address deployment friction. Term coined around 2009, popularized by "The Phoenix Project" (2013) and "The DevOps Handbook" (2016).*

**What it is:** Integrates development (Dev) and operations (Ops) teams to ensure continuous delivery, faster releases, and high-quality products. DevOps is both a culture and a set of practices.

**Key Characteristics:**
- Culture of collaboration between Dev and Ops (breaking down silos)
- Automation of build, test, and deployment processes
- Continuous Integration/Continuous Deployment (CI/CD)
- Infrastructure as Code (IaC)
- Monitoring and feedback loops
- Shared responsibility for production systems

**Core Practices:**

- **Continuous Integration**: Merge code frequently, automate builds
- **Continuous Delivery/Deployment**: Automate deployment to production
- **Infrastructure as Code**: Manage infrastructure through code (Terraform, Ansible)
- **Monitoring & Logging**: Observability into production systems
- **Collaboration**: Shared tools, knowledge, and on-call responsibilities
- **Experimentation**: Safe-to-fail culture, learning from failures

**When to Use:**
- Organizations adopting cloud-native architectures
- Teams requiring frequent deployments (multiple per day)
- Projects with complex deployment requirements
- Organizations wanting to improve deployment reliability
- Teams focusing on operational excellence
- Microservices architectures

**Why Choose DevOps:**
- **Speed**: Faster delivery and deployment cycles
- **Reliability**: Automated testing and deployment reduce errors
- **Collaboration**: Breaking down silos improves communication
- **Scalability**: Infrastructure as Code supports growth
- **Recovery**: Faster incident response and recovery

**Considerations:**
- Cultural change is harder than tool adoption
- Requires investment in automation and tooling
- Security must be integrated (DevSecOps)
- May require organizational restructuring
- Learning curve for traditional ops teams

---

### Feature-Driven Development (FDD)

*Developed by Jeff De Luca and Peter Coad in the late 1990s for a large banking project in Singapore.*

**What it is:** An iterative and incremental methodology focused on delivering tangible, working features in short iterations (typically 1-2 weeks per feature).

**Key Characteristics:**
- Feature-centric approach to development
- Five main processes: Develop Overall Model, Build Feature List, Plan by Feature, Design by Feature, Build by Feature
- Regular builds and progress tracking
- Chief programmer work model (lead developer per feature)
- Domain object modeling

**Five Processes:**

1. **Develop Overall Model**: Create high-level domain model with domain experts
2. **Build Feature List**: Identify features from model (client-valued functions)
3. **Plan by Feature**: Assign features to programmers and plan iterations
4. **Design by Feature**: Produce detailed design for feature set
5. **Build by Feature**: Implement, test, and integrate features

**When to Use:**
- Large development teams (10+ developers)
- Projects with well-understood domain knowledge
- Teams requiring detailed progress tracking
- Projects needing predictable delivery schedules
- Organizations valuing documentation and process
- Complex business domains

**Why Choose FDD:**
- **Scalability**: Works well with large teams
- **Progress Tracking**: Feature completion provides clear metrics
- **Domain Focus**: Strong domain modeling supports complexity
- **Regular Builds**: Frequent integration reduces risk

**Considerations:**
- Requires experienced chief programmers
- More documentation than other Agile methods
- Less flexible than Scrum or XP
- May be overkill for small projects

---

### Crystal Methodology

*Created by Alistair Cockburn in the 1990s as part of research into successful project teams.*

**What it is:** A family of lightweight Agile frameworks that adapt based on team size, project priority, and system criticality. The "color" of Crystal (Clear, Yellow, Orange, Red) indicates the methodology weight.

**Key Characteristics:**
- Tailored approach based on project size and criticality
- Focus on people over processes
- Emphasis on direct communication
- Lightweight, adaptable framework
- Different "colors" for different team sizes (Clear: 1-6, Yellow: 7-20, Orange: 21-40, Red: 41-80)

**Core Properties:**

- Frequent Delivery
- Reflective Improvement
- Close Communication
- Personal Safety (can speak up without fear)
- Focus (limit work in progress)
- Easy Access to Expert Users
- Technical Environment (tools and automation)

**When to Use:**
- Small teams or low-criticality projects
- Teams preferring minimal process overhead
- Projects requiring high adaptability
- Organizations with experienced, self-organizing teams
- Projects where people and communication are strengths

**Why Choose Crystal:**
- **Adaptability**: Scales methodology to project needs
- **Lightweight**: Minimal prescribed practices
- **People-Focused**: Recognizes that people make projects successful
- **Pragmatic**: Use what works for your context

---

## Methodology Selection Guide

### Project Characteristics Matrix

| **Project Type** | **Best Methodology** | **Alternative** | **Why** |
|------------------|---------------------|-----------------|---------|
| Well-defined requirements, regulatory | Waterfall | Spiral | Stability suits sequential approach |
| Software products, frequent feedback | Scrum | XP | Structure with agility |
| SaaS products, meaningful completion | Shape Up | Scrum | 6-week cycles enable complete features |
| Maintenance, varied requests | Kanban | Lean | Continuous flow handles variability |
| High-quality code focus | XP | Scrum + engineering practices | Engineering practices are core |
| Resource-constrained, MVP focus | Lean | Kanban | Waste elimination maximizes value |
| Complex, high-risk systems | Spiral | Waterfall | Risk management is paramount |
| Continuous deployment focus | DevOps | Scrum + DevOps | Deployment automation is key |
| Large teams, feature tracking | FDD | Scrum | Scales to large teams |
| Small teams, low criticality | Crystal | Scrum | Lightweight suits context |
| Breaking feature factory pattern | Shape Up | Lean | Appetite-based planning eliminates backlog churn |

---

### Decision Factors

#### Choose Traditional (Waterfall/Spiral) when:
- Requirements are well-defined and unlikely to change
- Extensive documentation is required (compliance, audits)
- Regulatory compliance is critical (FDA, aerospace, defense)
- Teams prefer structured, predictable processes
- Fixed-bid contracts with clear deliverables
- Hardware-software integration (changes are expensive)
- Large, distributed teams needing coordination

#### Choose Agile (Scrum/Kanban/XP/Lean/Shape Up) when:
- Requirements are expected to evolve
- Customer feedback is crucial throughout development
- Time to market is important
- Teams value flexibility and adaptability
- Innovation and experimentation are needed
- Small to medium co-located or well-coordinated teams
- Software-only projects with fast deployment

#### Choose Hybrid Approaches when:
- Different project components have different needs (e.g., Scrum for new features, Kanban for maintenance)
- Transitioning between methodologies gradually
- Combining strengths of multiple approaches (e.g., Scrum + XP engineering practices)
- Large organizations with varied project types
- Regulatory requirements + need for agility (Agile with Waterfall documentation)

---

### Questions to Guide Selection

**1. How stable are requirements?**
- Very stable → Waterfall
- Somewhat stable → Scrum, Spiral
- Evolving → Kanban, Lean, XP, Shape Up
- Unknown → XP, Lean, Crystal, Shape Up

**2. How important is time to market?**
- Critical (weeks) → Lean, XP, Kanban
- Important (6-week cycles) → Shape Up
- Important (2-week cycles) → Scrum, DevOps
- Flexible (6+ months) → Waterfall, FDD, Spiral

**3. What's the team size?**
- 1-3 people → Shape Up, Crystal, XP, Kanban
- 4-6 people → Scrum, XP, Kanban, Shape Up
- 7-12 people → Scrum, XP, Lean
- 13-40 people → Scrum, FDD, Crystal
- 40+ people → FDD, Scaled Agile (SAFe)

**4. What's the team's Agile experience?**
- New to Agile → Scrum (structure helps)
- Some experience → Kanban, Lean, Shape Up
- Experienced → XP, Crystal, Kanban, Shape Up

**5. How critical is the system?**
- Life-critical → Spiral, Waterfall
- Business-critical → Scrum, FDD, Shape Up
- Important → Most Agile methods
- Low criticality → Crystal, Kanban, Shape Up

**6. How much customer involvement is feasible?**
- Daily → XP
- Weekly/bi-weekly → Scrum
- Every 6 weeks → Shape Up
- Monthly → Lean, FDD
- Minimal → Waterfall, Spiral

**7. What's the regulatory environment?**
- Heavy regulation → Waterfall, Spiral (with documentation)
- Some regulation → Scrum/Kanban with documentation
- Minimal regulation → Any Agile method

---

### Common Methodology Combinations

**Scrum + XP Engineering Practices:**
Use Scrum for project management (sprints, roles, ceremonies) and XP for technical practices (TDD, pair programming, CI). This is very common and effective.

**Shape Up + XP Engineering Practices:**
Use Shape Up for project planning and autonomy (6-week cycles, shaping, betting) and XP for technical practices (TDD, refactoring, CI). Combines meaningful completion with engineering excellence.

**Kanban + DevOps:**
Use Kanban for workflow visualization and WIP limits, DevOps for deployment automation and collaboration. Great for operations and SRE teams.

**Waterfall for Architecture, Agile for Implementation:**
Define architecture and high-level design in a Waterfall phase, then implement using Agile sprints. Useful when architecture must be stable.

**Dual-Track Agile (Discovery + Delivery):**
Run parallel tracks: discovery (research, design) and delivery (implementation). Discovery feeds validated ideas to delivery track. Shape Up's shaping process fits naturally as the discovery track.

---

### Key Takeaway

**There is no "best" methodology.** The best is only the methodology that best fits your context:
- Project characteristics
- Team capabilities
- Organizational culture
- Regulatory requirements
- Customer needs

Most successful teams adapt methodologies to their needs rather than following them dogmatically. Start with a methodology that fits your context, then adjust based on retrospectives and learnings.

---

### Resources

**Agile:**
- [Agile Manifesto](https://agilemanifesto.org/){:target="_blank" rel="noopener noreferrer"} - Original manifesto and principles
- [Scrum Guide](https://scrumguides.org/){:target="_blank" rel="noopener noreferrer"} - Official Scrum definition by Schwaber & Sutherland

**Shape Up:**
- [Shape Up: Stop Running in Circles and Ship Work that Matters](https://basecamp.com/shapeup){:target="_blank" rel="noopener noreferrer"} - Ryan Singer (free online book)

**Lean:**
- [Lean Software Development: An Agile Toolkit](https://www.amazon.com/Lean-Software-Development-Agile-Toolkit/dp/0321150783){:target="_blank" rel="noopener noreferrer"} - Mary & Tom Poppendieck

**DevOps:**
- [The DevOps Handbook](https://itrevolution.com/product/the-devops-handbook/){:target="_blank" rel="noopener noreferrer"} - Gene Kim, et al.
- [DevOps Research and Assessment (DORA)](https://dora.dev/){:target="_blank" rel="noopener noreferrer"} - Research on DevOps performance

**XP:**
- [Extreme Programming Explained](https://www.amazon.com/Extreme-Programming-Explained-Embrace-Change/dp/0321278658){:target="_blank" rel="noopener noreferrer"} - Kent Beck

**Kanban:**
- [Kanban: Successful Evolutionary Change for Your Technology Business](https://www.amazon.com/Kanban-Successful-Evolutionary-Technology-Business/dp/0984521402){:target="_blank" rel="noopener noreferrer"} - David J. Anderson
