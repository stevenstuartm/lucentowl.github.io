---
title: "Coding with AI Agents"
order: 2
description: "A route for developers who code with AI assistants and agents: how models behave and what they change, delegating and verifying, disciplined delegation on real projects, and running work across sessions and agents."
goal: "Get reliable, reviewable work out of AI coding assistants and agents, and know where they fail."
audience: "Developers using AI coding assistants and agents in daily work"
assumes: "You write code professionally. No machine learning background needed."
last_reviewed: 2026-09-26
stages:
  - level: Foundations
    name: "What the model is, and what it changes"
    purpose: "The mechanics behind everything an assistant does, and the argument for where your value moves."
    steps:
      - url: /study-guides/ai/core-ai-concepts.html
        why: "Tokens, context windows, and sampling explain most of the \"why did it do that\" moments in every later step."
      - url: /blog/2025/12/31/ai-in-practice-the-skill-inversion.html
        why: "The argument for the whole path: when code is cheap, judgment is what's left to be good at. The rest of the path is how to exercise it."
    deeper:
      - /resources/core-ai-concepts-diagrams.html
    checkpoint:
      can: "explain why an assistant gave a strange answer, instead of retrying until it gives a better one."
      try: "Take a recent answer from your assistant that was wrong or strange. Decide whether missing context, an overfull context window, or sampling caused it, and what you'd change next time."
  - level: Basics
    name: "Working with an assistant"
    purpose: "Giving the model what it needs, and delegating on purpose."
    steps:
      - url: /study-guides/ai/prompt-engineering.html
        why: "Most bad agent output traces to context the model didn't have. This is how to give it that context on purpose."
      - url: /study-guides/ai/ai-assisted-development.html
        why: "Where the speedup really comes from, and why it depends on the specifying and verifying you do around the model."
    deeper:
      - /resources/prompt-engineering-technique-selection.html
    checkpoint:
      can: "give an assistant what it needs for a task, and know which parts of its work to check."
      try: "Before your next delegated task, write down the context the model needs and how you'll verify the result. Afterward, compare what you checked with what actually went wrong."
      exit: true
  - level: Intermediate
    name: "Real projects, real boundaries"
    purpose: "Discipline on a production rebuild, and the rules for what your tools may touch."
    steps:
      - url: /case-studies/ai-disciplined-delivery.html
        why: "The basics on a real rebuild with no docs, no tests, and zero tolerance for regressions, including what went wrong before the discipline arrived."
      - url: /resources/plan-task-skill.html
        why: "The case study's assumptions-first discipline as a skill you can install. Copy it, or use it as the model for your own."
      - url: /study-guides/ai/model-context-protocol.html
        why: "Connecting your assistant to tools and data means trusting a server. This is what that trust covers, and where it ends."
    deeper:
      - /study-guides/ai/ai-security-for-organizations.html
      - /resources/refine-prose-skill.html
    checkpoint:
      can: "use an assistant on production code without losing control of what it changes or what it can reach."
      try: "Use the plan-task skill, or your own version of it, on your next task. Then list every tool and MCP server your assistant can reach, and what each one can read or change."
  - level: Advanced
    name: "Beyond one session"
    purpose: "Keeping long work, and many agents, on track."
    steps:
      - url: /study-guides/ai/beads.html
        why: "Agents forget everything between sessions. Beads keeps the work outside the context window, so long work survives."
      - url: /study-guides/ai/scaling-ai-workflows.html
        why: "One good output and fifty consistent ones are different problems. This is how to split work across isolated agents without cost or quality collapsing."
      - url: /resources/ai-batch-generation-pipeline-template.html
        why: "The previous step as files you can copy: a format reference, a plan file, and an orchestrator prompt."
    deeper:
      - /study-guides/ai/gas-city.html
      - /study-guides/ai/ai-agents.html
      - /study-guides/ai/tool-calling.html
    checkpoint:
      can: "keep an agent's work on track across many sessions, and run the same task many times with consistent results."
      try: "Pick a task you'd hand an agent fifty times, such as a migration, a set of tests, or reference docs. Write its format reference and plan file from this stage's template, and run it on five items before scaling up."
---
