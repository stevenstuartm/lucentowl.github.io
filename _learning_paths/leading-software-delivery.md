---
title: "Leading Software Delivery"
order: 4
description: "A route for developers stepping into tech lead and delivery roles: what every project does, the frameworks teams run, the Align-Agree-Apply discipline, delivering continuously, and leading the people who deliver."
goal: "Run delivery for a team: choose and adapt a method, keep the work aligned with what the business needs, and stop when it isn't."
audience: "Developers stepping into tech lead or delivery lead roles"
assumes: "You've worked on a delivery team. No formal project management training needed."
last_reviewed: 2026-09-25
stages:
  - level: Foundations
    name: "What delivery is"
    purpose: "What every project does whatever its method, and the bias that undermines them all."
    steps:
      - url: /study-guides/sdlc/sdlc.html
        why: "The six activities every project performs, whatever the method calls them. Every later step is a way of arranging these."
      - url: /study-guides/sdlc/sdlc-methodologies.html
        why: "What a methodology actually commits a team to, so the frameworks in the next level read as choices, not doctrine."
      - url: /blog/2026/02/07/you-cant-realign-if-you-cant-stop.html
        why: "The argument under the rest of the path: every method assumes someone will notice when the plan is wrong and stop. Usually nobody does."
  - level: Basics
    name: "The frameworks"
    purpose: "The methods teams actually run, and how to choose or combine them."
    steps:
      - url: /study-guides/sdlc/scrum.html
        why: "The most common framework, as its guide defines it rather than as teams usually run it."
      - url: /study-guides/sdlc/kanban.html
        why: "Flow instead of timeboxes, with WIP limits as the whole mechanism, applied to the process you already have."
      - url: /study-guides/sdlc/shape-up.html
        why: "Shaping work to an appetite before committing to it, which is one answer to the stopping problem from Foundations."
      - url: /blog/2025/11/17/shaped-kanban.html
        why: "A synthesis of the previous two: Kanban's flow with Shape Up's shaping and circuit breakers."
      - url: /resources/sdlc-methodology-selection-guide.html
        why: "The frameworks side by side, with the questions that decide between them for your project."
    deeper:
      - /study-guides/sdlc/lean.html
      - /study-guides/sdlc/extreme-programming.html
      - /study-guides/sdlc/waterfall.html
      - /resources/sdlc-diagrams.html
  - level: Intermediate
    name: "Align, Agree, Apply"
    purpose: "A discipline that works inside any method: understand the need, commit to a plan, and go back when reality breaks it."
    steps:
      - url: /study-guides/sdlc/aaa-cycle.html
        why: "The three phases, and the rule that makes them work: going back is part of the method, not a failure of it."
      - url: /study-guides/sdlc/aaa-phase1-align.html
        why: "Discovery, and the Go, Pivot, or No-Go call made before anyone commits to a plan."
      - url: /resources/project-charter-template.html
        why: "The Align phase's output as a template to fill in for your next project."
      - url: /study-guides/sdlc/aaa-phase2-agree.html
        why: "Design, decisions, and proofs of concept that turn alignment into a plan people commit to."
      - url: /study-guides/sdlc/aaa-phase3-apply.html
        why: "Delivering against the agreement, with circuit breakers that force the continue, adapt, or go back decision."
      - url: /resources/aaa-gate-readiness.html
        why: "The questions that show whether each gate is really ready. Use it at every transition."
      - url: /resources/aaa-worked-example.html
        why: "One project through all three phases, including the assumption that failed and what it cost."
      - url: /case-studies/ai-disciplined-delivery.html
        why: "Assumptions proved before code, and work stopped to realign, on a real rebuild with zero tolerance for regressions."
    deeper:
      - /study-guides/sdlc/aaa-scenarios.html
      - /resources/aaa-cycle-diagrams.html
      - /blog/2025/07/28/missing-greater-value-tdd.html
  - level: Intermediate
    name: "Delivering continuously"
    purpose: "Getting changes to production often and safely, so feedback arrives while it can still change the plan."
    steps:
      - url: /study-guides/sdlc/devops.html
        why: "DevOps as a change in who is accountable for running software, not a toolchain."
      - url: /study-guides/sdlc/cicd.html
        why: "The pipeline that makes frequent delivery safe, and where each kind of test belongs in it."
      - url: /study-guides/infrastructure/deployment-strategies.html
        why: "How a release reaches users with a controlled blast radius, and how it's rolled back."
      - url: /blog/2025/11/07/when-to-update-packages.html
        why: "Dependency upgrades carry their own delivery risk. Treat each one as an investment with a reason, not hygiene to automate away."
      - url: /case-studies/silent-sdk-deadlock.html
        why: "The cost of skipping that reasoning once: a trusted SDK upgrade passed a full regression and deadlocked under production load."
    deeper:
      - /study-guides/sdlc/devsecops.html
  - level: Advanced
    name: "Leading the team"
    purpose: "Leading the people who deliver, and speaking for their work to the business."
    steps:
      - url: /blog/2025/06/11/characteristics-of-leaders-mentors-software-development.html
        why: "Five questions that separate leaders from people who hold the title. Read them before the how-to."
      - url: /blog/2025/10/11/leadership-failures-disguised-as-empowerment.html
        why: "The failure modes to refuse: control dressed up as empowerment."
      - url: /study-guides/leadership/dev-team-leadership-foundations.html
        why: "The day-to-day of leading a team, from 1:1s and iterations to missed deadlines and incidents."
      - url: /blog/2025/11/08/troubleshooting-production.html
        why: "Leading an incident: slow down, reproduce, and change one thing at a time, even under war-room pressure."
      - url: /blog/2025/11/11/tech-debt-is-a-self-fulfilling-prophecy.html
        why: "Why the fixes your team needs rarely get funded, and the vocabulary that gets them prioritized."
    deeper:
      - /study-guides/sdlc/team-organization.html
      - /study-guides/leadership/architecture-leadership-foundations.html
      - /blog/2025/09/19/rethinking-focus-software-development.html
---
