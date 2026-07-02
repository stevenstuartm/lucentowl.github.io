---
title: "Git Branching and Merge Strategy Guide"
layout: resource
type: reference
category: "Developer Tools"
description: "Decision table for choosing a Git branching model, plus a comparison of merge commit, squash-and-merge, and rebase-and-merge strategies."
last_updated: 2026-07-02
tags: [git, version-control, workflow, collaboration, decision-making]
related_guides:
  - /study-guides/developer-tools/git-branching-strategies.html
---

## Choosing a Branching Strategy

| Factor | Points toward simpler models (Trunk-Based / GitHub Flow) | Points toward structured models (GitFlow / Release Branching) |
| --- | --- | --- |
| Release cadence | Continuous deployment, several times per day or week | Formal release cycles: monthly, quarterly, or on customer demand |
| Team size | Small team, high trust, frequent communication | Large team, distributed time zones, formal review requirements |
| Risk tolerance | Can roll back or fix forward quickly | Any regression in production is a significant event |
| Customer model | SaaS, single codebase, all users on same version | On-premises, packaged, or mobile with multiple versions in the wild |
| Regulatory environment | No formal approval chain required | Audit trails, sign-offs, or change management required before production |
| Test automation maturity | Strong CI/CD, high test coverage | Relying on manual QA cycles before release |

## Merge Strategies Compared

```
  Feature branch: A ── B ── C ── D  (4 commits)

  ┌─ Merge Commit ─────────────────────────────────────────────┐
  │  main: ... ── X ──────────────────── M (merge commit)      │
  │                 \                   /                       │
  │  feature:        A ── B ── C ── D ─┘                       │
  │  Result: Full history preserved, M has two parents          │
  └─────────────────────────────────────────────────────────────┘

  ┌─ Squash and Merge ─────────────────────────────────────────┐
  │  main: ... ── X ── S  (single commit with all changes)     │
  │  Result: Clean linear history, individual commits lost      │
  └─────────────────────────────────────────────────────────────┘

  ┌─ Rebase and Merge ─────────────────────────────────────────┐
  │  main: ... ── X ── A' ── B' ── C' ── D' (replayed commits)│
  │  Result: Linear history, all commits preserved, new SHAs   │
  └─────────────────────────────────────────────────────────────┘
```

| Strategy | History | Use When | Trade-off |
| --- | --- | --- | --- |
| Merge commit (`--no-ff`) | Full branch history preserved, non-linear | The commit-by-commit narrative of a feature has value, or the team follows GitFlow | More commits in the log, non-linear graph |
| Squash-and-merge | One commit per feature, linear | GitHub Flow or trunk-based teams that want clean main history | Detailed development history discarded |
| Rebase-and-merge | Linear history, original commits replayed with new SHAs | Want a linear log without collapsing intermediate commits | Rewrites history, requires a force push on shared branches |
