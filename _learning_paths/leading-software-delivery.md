---
title: "Leading a Development Team"
order: 4
description: "A route for development team leads: what every project does, Scrum and Kanban, delivering continuously, keeping production healthy, and leading the people who deliver."
goal: "Lead a development team from plan to running software: run its method well, ship often and safely, keep production healthy, and stop work that has stopped making sense."
audience: "Development team leads, new or about to be"
assumes: "You've worked on a development team. No formal project management training needed."
last_reviewed: 2026-09-26
stages:
  - level: Foundations
    name: "What delivery is"
    purpose: "What every project does whatever its method, and the bias that undermines them all."
    steps:
      - url: /study-guides/sdlc/sdlc.html
        why: "The six activities every project performs, whatever the method calls them. Scrum and Kanban in the next stage are two ways of arranging them."
      - url: /blog/2026/02/07/you-cant-realign-if-you-cant-stop.html
        why: "The argument under the rest of the path: every method assumes someone will notice when the plan is wrong and stop. Usually nobody does."
    deeper:
      - /study-guides/sdlc/sdlc-methodologies.html
    checkpoint:
      can: "see what every project has to do whatever its method, and notice when a team keeps following a plan it knows is wrong."
      try: "Map your team's current process onto the six SDLC activities. Then recall the last time a plan was clearly wrong, and how long the team took to stop."
  - level: Basics
    name: "Scrum and Kanban"
    purpose: "The two methods most teams run, as they're defined rather than as they tend to drift."
    steps:
      - url: /study-guides/sdlc/scrum.html
        why: "The most common framework, as its guide defines it rather than as teams usually run it."
      - url: /study-guides/sdlc/kanban.html
        why: "Flow instead of timeboxes, with WIP limits as the whole mechanism, applied to the process you already have."
    deeper:
      - /study-guides/sdlc/shape-up.html
      - /blog/2025/11/17/shaped-kanban.html
      - /study-guides/sdlc/extreme-programming.html
      - /resources/sdlc-methodology-selection-guide.html
      - /resources/sdlc-diagrams.html
    checkpoint:
      can: "run Scrum or Kanban the way it's meant to work, and see where your team's version has drifted."
      try: "Compare how your team runs its method with the guide's definition. List three places they differ, and for each, decide whether the difference helps the team or hides a problem."
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
        why: "Dependency upgrades carry their own delivery risk, and the lead sets how the team treats them: as investments with a reason, not hygiene to automate away."
      - url: /case-studies/silent-sdk-deadlock.html
        why: "The cost of skipping that reasoning once: a trusted SDK upgrade passed a full regression and deadlocked under production load."
    deeper:
      - /resources/deployment-strategy-comparison.html
      - /study-guides/sdlc/devsecops.html
      - /blog/2025/10/11/avoid-localized-configs-favor-distributed-versioned-store.html
    checkpoint:
      can: "get changes to users often and safely, and measure how well your team does it."
      try: "Estimate your team's DORA metrics from what you have, such as deploy frequency from pipeline history and lead time from a few recent changes. Pick the weakest one and the pipeline change most likely to move it."
      exit: true
  - level: Intermediate
    name: "Keeping production healthy"
    purpose: "Knowing when what the team shipped is hurting users, keeping failures contained, and leading the response when they aren't."
    steps:
      - url: /blog/2026/02/11/observability-is-authored-not-installed.html
        why: "The argument for this stage: a team can only see what its code reports, so observability is a standard the lead sets for the code, not a tool the team buys."
      - url: /study-guides/observability/observability-fundamentals.html
        why: "What logs, metrics, and traces each show and miss, so the team instruments once and can follow one request through the whole system."
      - url: /study-guides/observability/slos-and-alerting.html
        why: "Turns 'reliable enough' into a number the team and the business agree on, and pages people only when users are being hurt."
      - url: /study-guides/architecture/reliability_patterns.html
        why: "Timeouts, retries, and circuit breakers are what keep one failing dependency from taking the service down, and what to look for when reviewing any remote call."
      - url: /blog/2025/11/08/troubleshooting-production.html
        why: "Leading an incident: slow down, reproduce, and change one thing at a time, even under war-room pressure."
    deeper:
      - /study-guides/architecture/performance-engineering.html
      - /study-guides/infrastructure/disaster-recovery-patterns.html
      - /study-guides/observability/observability-architecture.html
      - /study-guides/security/incident-response-recovery.html
      - /resources/observability-diagrams.html
    checkpoint:
      can: "know when your service is hurting users before they tell you, and lead the team to the cause when it is."
      try: "Pick your team's most important service. Write down the one number that says it's working for users, the target it should meet, and the alert that should fire when it misses. Then check whether that alert exists."
  - level: Advanced
    name: "Leading the team"
    purpose: "Leading the people who deliver, and speaking for their work to the business."
    steps:
      - url: /blog/2025/06/11/characteristics-of-leaders-mentors-software-development.html
        why: "Five questions that separate leaders from people who hold the title. Read them before the how-to."
      - url: /blog/2025/10/11/leadership-failures-disguised-as-empowerment.html
        why: "Control dressed up as empowerment, in the forms a new lead is most likely to slip into, and how to refuse them."
      - url: /study-guides/leadership/dev-team-leadership-foundations.html
        why: "The day-to-day of leading a team, from 1:1s and iterations to missed deadlines and incidents."
      - url: /blog/2025/11/11/tech-debt-is-a-self-fulfilling-prophecy.html
        why: "Why the fixes your team needs rarely get funded, and the vocabulary that gets them prioritized."
    deeper:
      - /study-guides/sdlc/team-organization.html
      - /study-guides/leadership/architecture-leadership-foundations.html
      - /blog/2025/09/19/rethinking-focus-software-development.html
    checkpoint:
      can: "lead a team day to day, and get the business to fund the work the team needs."
      try: "Write a one-page case for the debt your team raises most often, in the terms this stage's last step gives you, and take it to whoever sets priorities."
---
