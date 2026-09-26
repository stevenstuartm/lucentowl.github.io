---
title: "Developer to Architect"
order: 1
description: "A route for senior developers taking on design responsibility: the theory and arguments of architecture, finding boundaries, choosing a style, connecting the parts, making and recording decisions, proving the qualities, leading across teams, and carrying a project from need to delivery."
goal: "Make structural decisions for a system and a team, and defend them in terms the business accepts."
audience: "Senior developers taking on design responsibility"
assumes: "Several years of building production software. No prior study of architecture."
last_reviewed: 2026-09-26
stages:
  - level: Foundations
    name: "What architecture is"
    purpose: "The theory, and the arguments, that every later level applies."
    steps:
      - url: /blog/2025/08/05/good-code-is-adaptable-code.html
        why: "The bridge from developer to architect: the measure of a design is how well it survives change, not how clever it is."
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
    checkpoint:
      can: "tell which decisions in a system will be hard to undo, and say what each one is meant to achieve."
      try: "Pick a system you work on. List its top three architecture characteristics, then name one decision in it that would be expensive to reverse and the characteristic that decision protects."
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
    checkpoint:
      can: "divide a system into parts based on what it does, not on how its data is stored."
      try: "Sketch your system's components from its main user journeys. Mark any component named after a table, and any that two teams both have to change."
  - level: Basics
    name: "Choosing a shape"
    purpose: "The first structural decision: which style, and whether to distribute at all."
    steps:
      - url: /study-guides/architecture/ArchitectureStyles.html
        why: "Turns characteristics and boundaries into a decision: which style gives you the ones you need by default."
      - url: /blog/2025/06/21/microservices-or-monoliths.html
        why: "An argument for sequencing: stay monolithic while you learn the domain, and distribute only what you've learned needs it."
      - url: /study-guides/architecture/modular-monolith-architecture.html
        why: "The style that argument points to, and the one whose module boundaries make every later split cheaper."
      - url: /study-guides/architecture/distributed-computing.html
        why: "Before a module becomes a service, know what the network will cost you and how to tell whether the split is real."
      - url: /case-studies/distributed-event-processing.html
        why: "Three successive designs for one problem, including a pipeline style that never fit it, and the organizational pattern that outlived all three."
    deeper:
      - /resources/architecture-style-comparison.html
      - /study-guides/architecture/layered-architecture.html
      - /study-guides/architecture/service-based-architecture.html
      - /study-guides/architecture/event-driven-architecture.html
      - /study-guides/architecture/microservices-architecture.html
      - /blog/2025/09/29/hexagonal-architecture-modern-development.html
    checkpoint:
      can: "pick an overall structure for a system, and explain why it should or shouldn't be split into separate services."
      try: "Write one paragraph for or against your system's current style, argued from the characteristics you listed in stage 1. If it's distributed, name one split you couldn't justify today."
      exit: true
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
      - /blog/2026/01/06/the-false-economy-of-shared-libraries.html
    checkpoint:
      can: "decide how the parts of a system talk to each other, and which part owns which data."
      try: "Pick one integration in your system. Name its communication style, the coupling it creates, and the owner of each piece of data it touches. Then find one read workload that runs against production data, and say where it could move."
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
      - url: /case-studies/third-party-integration-boundaries.html
        why: "One boundary decision followed from options to consequences, including taking on debt on purpose."
    deeper:
      - /study-guides/architecture/return-on-investment.html
      - /blog/2025/11/07/rebuild-or-realign.html
      - /resources/c4-model-diagrams.html
      - /case-studies/cloud-cost-optimization.html
      - /case-studies/kubernetes-to-ecs-migration.html
    checkpoint:
      can: "make a design decision, write it down, and argue for it in terms of risk and cost."
      try: "Write an ADR, using this stage's template, for a decision your team made in the last few months. Include the alternatives it rejected and one risk it accepted."
      exit: true
  - level: Advanced
    name: "Proving the qualities"
    purpose: "Security, reliability, and operability designed in, not bolted on."
    steps:
      - url: /blog/2026/06/19/topology-is-not-a-trust-model.html
        why: "Applies the authority argument to security: legitimacy should come from verified identity, not network position."
      - url: /study-guides/security/threat-modeling.html
        why: "The design-time practice for finding what that argument predicts: threats across trust boundaries, before they're built."
      - url: /case-studies/zero-trust-auth-sessions.html
        why: "Five separate auth implementations unified behind one abstraction before any could be replaced, with every request validated and customer and service identity kept apart."
      - url: /study-guides/architecture/reliability_patterns.html
        why: "Once parts talk over a network, one slow dependency can take down the rest. These patterns are how a design keeps a failure local."
      - url: /blog/2026/02/11/observability-is-authored-not-installed.html
        why: "A system that can't tell handled from broken can't be operated, whatever platform sits behind it. That classification is a design decision."
    deeper:
      - /study-guides/security/security-foundations.html
      - /study-guides/architecture/testing-strategy-architecture.html
      - /study-guides/architecture/performance-engineering.html
      - /case-studies/realtime-push-signalr.html
    checkpoint:
      can: "build security, failure handling, and monitoring into a design from the start."
      try: "Trace one request through your system and mark each trust boundary it crosses. For each remote call on the way, note its timeout and retry policy, and whether a failure there shows up anywhere."
  - level: Advanced
    name: "Leading across teams and time"
    purpose: "Carrying decisions through teams you don't manage, through an organization, and through years of change."
    steps:
      - url: /study-guides/leadership/architecture-leadership-foundations.html
        why: "Teams you don't manage carry out most of your decisions. This is how to lead them without becoming the bottleneck."
      - url: /blog/2025/11/11/tech-debt-is-a-self-fulfilling-prophecy.html
        why: "Debt everyone can see but nobody funds is the usual reason a system has to be modernized at all. This is the vocabulary that makes the case before it gets there."
      - url: /study-guides/architecture/legacy-modernization-strategies.html
        why: "When the fix is a replacement: how to change a system the business keeps running on, without a rewrite."
      - url: /study-guides/architecture/governance.html
        why: "Scales everything above past one team: who decides what, and how the organization notices when a decision stops working."
    deeper:
      - /study-guides/architecture/governance-tools.html
      - /study-guides/architecture/governance-frameworks.html
      - /study-guides/leadership/dev-team-leadership-foundations.html
      - /blog/2025/06/11/characteristics-of-leaders-mentors-software-development.html
    checkpoint:
      can: "get teams you don't manage to carry out your decisions, and change a system the business can't switch off."
      try: "Pick an architecture decision that has stopped working. Write down who would have to agree to change it, what evidence would convince them, and which modernization strategy from this stage fits."
  - level: Advanced
    name: "From need to delivery"
    purpose: "The whole path applied to one project: understand the need, commit to a plan, deliver it, and go back when reality breaks it."
    steps:
      - url: /blog/2026/02/07/you-cant-realign-if-you-cant-stop.html
        why: "The argument for this last stage: every plan assumes someone will notice when it's wrong and stop, and plan continuation bias keeps teams building what they already know is wrong."
      - url: /study-guides/sdlc/aaa-cycle.html
        why: "The three phases, and the rule that makes them work: going back is part of the method, not a failure of it."
      - url: /study-guides/sdlc/aaa-phase1-align.html
        why: "Discovery with the people who have the need, and the Go, Pivot, or No-Go call made before anyone commits to a plan."
      - url: /study-guides/sdlc/aaa-phase2-agree.html
        why: "Turning alignment into a plan people commit to. The boundaries, style, decisions, and risks from earlier in the path all come together here."
      - url: /study-guides/sdlc/aaa-phase3-apply.html
        why: "Delivering against the agreement, with circuit breakers that force the continue, adapt, or go back decision."
    deeper:
      - /resources/aaa-worked-example.html
      - /resources/project-charter-template.html
      - /resources/aaa-gate-readiness.html
      - /study-guides/sdlc/aaa-scenarios.html
      - /resources/aaa-cycle-diagrams.html
    checkpoint:
      can: "take a project from its first conversations to delivery, with clear points where you decide whether to continue."
      try: "Fill in the project charter template, linked under Go deeper, for your current or next project. Then take its first gate through the gate readiness questions and note each one you can't answer yet."
---
