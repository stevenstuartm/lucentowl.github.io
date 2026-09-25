---
title: "Developer to Architect"
order: 1
description: "A route for senior developers taking on design responsibility: the theory and arguments of architecture, finding boundaries, choosing a style, connecting the parts, making and recording decisions, proving the qualities, and leading across teams."
goal: "Make structural decisions for a system and a team, and defend them in terms the business accepts."
audience: "Senior developers taking on design responsibility"
assumes: "Several years of building production software. No prior study of architecture."
last_reviewed: 2026-09-25
stages:
  - level: Foundations
    name: "What architecture is"
    purpose: "The theory, and the arguments, that every later level applies."
    steps:
      - url: /blog/2025/08/05/good-code-is-adaptable-code.html
        why: "The bridge from developer to architect: the measure of a design is how well it survives change, not how clever it is. The whole path builds on that measure."
      - url: /study-guides/architecture/ArchitectureFoundations.html
        why: "Sets up the trade-off habit and the vocabulary that every later step assumes."
      - url: /study-guides/architecture/architecture-characteristics.html
        why: "Styles, risks, and costs later in the path are all measured against these, so you need the short list before you can trade anything."
      - url: /study-guides/architecture/modularity-coupling.html
        why: "Coupling is what nearly every later decision is really arguing about, and this gives you a way to measure it."
      - url: /blog/2026/06/12/architecture-is-a-belief-about-where-authority-belongs.html
        why: "The argument underneath the rest of the path: where authority lives decides what a system can absorb. Every later decision is a version of that question."
    deeper:
      - /resources/architecture-characteristics-glossary.html
  - level: Basics
    name: "Finding the boundaries"
    purpose: "Where the parts of a system are, drawn from the work and the domain rather than the database."
    steps:
      - url: /study-guides/architecture/DesignImplementation.html
        why: "The first concrete act of design: finding components from workflows and actors, and avoiding the entity trap."
      - url: /study-guides/architecture/domain-driven-design.html
        why: "Bounded contexts give component boundaries a business reason to exist, which is what keeps them from eroding."
      - url: /study-guides/sdlc/team-organization.html
        why: "Teams and system boundaries shape each other. Draw one without the other and Conway's Law redraws it for you."
    deeper:
      - /resources/architecture-design-diagrams.html
  - level: Basics
    name: "Choosing a shape"
    purpose: "The first structural decision: which style, and whether to distribute at all."
    steps:
      - url: /study-guides/architecture/ArchitectureStyles.html
        why: "Turns characteristics and boundaries into a decision: which style gives you the ones you need by default."
      - url: /resources/architecture-style-comparison.html
        why: "Keep this open for the rest of the stage. It's the one-table version of the overview."
      - url: /blog/2025/06/21/microservices-or-monoliths.html
        why: "An argument for sequencing: stay monolithic while you learn the domain, and distribute only what you've learned needs it."
      - url: /study-guides/architecture/modular-monolith-architecture.html
        why: "The style that argument points to, and the one whose module boundaries make every later split cheaper."
      - url: /study-guides/architecture/distributed-computing.html
        why: "Before a module becomes a service, know what the network will cost you and how to tell whether the split is real."
      - url: /blog/2026/01/06/the-false-economy-of-shared-libraries.html
        why: "Once there are several deployables, sharing code between them is the tempting shortcut. This is why it couples them back together."
      - url: /case-studies/distributed-event-processing.html
        why: "Three successive designs for one problem, including a pipeline style that never fit it, and the organizational pattern that outlived all three."
    deeper:
      - /study-guides/architecture/layered-architecture.html
      - /study-guides/architecture/service-based-architecture.html
      - /study-guides/architecture/event-driven-architecture.html
      - /study-guides/architecture/microservices-architecture.html
      - /blog/2025/09/29/hexagonal-architecture-modern-development.html
  - level: Intermediate
    name: "Connecting the parts"
    purpose: "How the parts talk and who owns which data, once there is more than one of them."
    steps:
      - url: /study-guides/architecture/communication_patterns.html
        why: "The basic ways parts interact, compared by the coupling each one creates."
      - url: /blog/2025/09/27/rest-vs-rpc-domain-driven-architectures.html
        why: "An argument to settle before designing any interface: a domain-driven system exposes operations, and REST's resource model fights that."
      - url: /study-guides/architecture/api-design-architecture.html
        why: "APIs are the longest-lived contracts you'll design. This is how to make them hold up and evolve."
      - url: /blog/2026/03/11/reporting-and-production-make-terrible-roommates.html
        why: "The argument for separating read workloads from production, which the next step turns into patterns."
      - url: /study-guides/architecture/data_management_patterns.html
        why: "Who owns which data once one database becomes several, and how reads stay fast without shared tables."
      - url: /case-studies/cqrs-event-sourcing-loan-servicing.html
        why: "Sound data patterns undone by an infrastructure constraint nobody weighed, which is what the next level's decision discipline exists to catch."
    deeper:
      - /study-guides/architecture/messaging_patterns.html
      - /study-guides/architecture/orchestration_choreography.html
      - /blog/2026/09/14/your-reads-should-not-design-your-writes.html
      - /resources/database-selection-matrix.html
      - /case-studies/custom-interaction-metrics.html
  - level: Intermediate
    name: "Deciding and recording"
    purpose: "Making decisions stick: whose they are, how they're recorded and shown, what could go wrong, and what they cost."
    steps:
      - url: /blog/2025/10/10/build-slow-to-go-fast.html
        why: "The argument for this level: spend design time in proportion to how expensive a decision is to reverse."
      - url: /study-guides/leadership/architecture-decision-making.html
        why: "Which decisions are yours to make, when to make them, and how to keep them from being relitigated."
      - url: /resources/adr-template.html
        why: "The record the previous step asks for, ready to copy for your first decision."
      - url: /study-guides/architecture/c4-model.html
        why: "A decision nobody can picture doesn't travel. C4 gives each audience a diagram at the right zoom level."
      - url: /study-guides/architecture/architecture-risk-analysis.html
        why: "Ranks where your chosen design is likely to fail its characteristics, so mitigation goes where it matters."
      - url: /study-guides/architecture/total-cost-of-ownership.html
        why: "Prices a decision over its whole life, which is the argument that gets it funded."
      - url: /case-studies/kubernetes-to-ecs-migration.html
        why: "A tool adopted without the requirements analysis this level asks for, and the year self-blame added before anyone questioned the choice."
      - url: /case-studies/third-party-integration-boundaries.html
        why: "One boundary decision followed from options to consequences, including taking on debt on purpose."
    deeper:
      - /study-guides/architecture/return-on-investment.html
      - /blog/2025/11/07/rebuild-or-realign.html
      - /resources/c4-model-diagrams.html
      - /case-studies/cloud-cost-optimization.html
  - level: Advanced
    name: "Proving the qualities"
    purpose: "Security, testability, and operability designed in, not bolted on."
    steps:
      - url: /blog/2026/06/19/topology-is-not-a-trust-model.html
        why: "Applies the authority argument to security: legitimacy should come from verified identity, not network position."
      - url: /study-guides/security/threat-modeling.html
        why: "The design-time practice for finding what that argument predicts: threats across trust boundaries, before they're built."
      - url: /case-studies/zero-trust-auth-sessions.html
        why: "Five separate auth implementations unified behind one abstraction before any could be replaced, with every request validated and customer and service identity kept apart."
      - url: /study-guides/architecture/testing-strategy-architecture.html
        why: "Your boundaries decide which tests are cheap. This is how to choose test scopes that keep a distributed system changeable."
      - url: /blog/2026/02/11/observability-is-authored-not-installed.html
        why: "A system that can't tell handled from broken can't be operated, whatever platform sits behind it. That classification is a design decision."
    deeper:
      - /study-guides/security/security-foundations.html
      - /study-guides/architecture/reliability_patterns.html
      - /study-guides/architecture/performance-engineering.html
      - /case-studies/realtime-push-signalr.html
  - level: Advanced
    name: "Leading across teams and time"
    purpose: "Carrying decisions through teams you don't manage, through an organization, and through years of change."
    steps:
      - url: /study-guides/leadership/architecture-leadership-foundations.html
        why: "Teams you don't manage carry out most of your decisions. This is how to lead them without becoming the bottleneck."
      - url: /study-guides/sdlc/aaa-cycle.html
        why: "The discipline behind that leadership: align on the need, agree on the plan, and go back when reality breaks it."
      - url: /blog/2026/02/07/you-cant-realign-if-you-cant-stop.html
        why: "Why going back is so hard in practice: plan continuation bias keeps teams building what they already know is wrong."
      - url: /blog/2025/11/11/tech-debt-is-a-self-fulfilling-prophecy.html
        why: "Why the fixes you'll need later rarely get funded, and the vocabulary that gets them prioritized."
      - url: /study-guides/architecture/legacy-modernization-strategies.html
        why: "When the fix is a replacement: how to change a system the business keeps running on, without a rewrite."
      - url: /study-guides/architecture/governance.html
        why: "Scales everything above past one team: who decides what, and how the organization notices when a decision stops working."
    deeper:
      - /study-guides/architecture/governance-tools.html
      - /study-guides/architecture/governance-frameworks.html
      - /study-guides/leadership/dev-team-leadership-foundations.html
      - /blog/2025/06/11/characteristics-of-leaders-mentors-software-development.html
---
