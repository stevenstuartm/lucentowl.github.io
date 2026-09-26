---
title: "Running AWS at Scale"
order: 5
description: "A route for engineers who run production workloads on AWS: infrastructure as code, deployment and recovery strategies, security and governance across many accounts, and operating, recovering, and paying for it all."
goal: "Run AWS workloads across many accounts: build every environment from code, detect what goes wrong, recover when it does, and keep the bill owned."
audience: "Engineers and architects running production workloads on AWS"
assumes: "You can design a production workload on AWS, from its compute and data to how its services connect."
prerequisite: cloud-architect-aws
last_reviewed: 2026-09-26
stages:
  - level: Foundations
    name: "The ideas every environment runs on"
    purpose: "Desired state, blast radius, and recovery objectives, which every AWS-specific stage after this implements."
    steps:
      - url: /study-guides/infrastructure/iac-fundamentals.html
        why: "Desired state, plan and apply, and idempotence: the ideas every IaC tool shares."
      - url: /study-guides/infrastructure/deployment-strategies.html
        why: "Rolling, blue-green, and canary releases, which decide how much a bad deploy can break."
      - url: /study-guides/infrastructure/disaster-recovery-patterns.html
        why: "RTO, RPO, and the four recovery strategies, decided from what the business can afford to lose. The last stage builds them on AWS."
    checkpoint:
      can: "decide how safely changes should reach production, and how quickly a system has to recover when it fails."
      try: "For a system you run, write down its RTO and RPO as the business would state them, and the release strategy it uses today. Note where they disagree, such as a canary release with no fast rollback."
  - level: Basics
    name: "Infrastructure as code on AWS"
    purpose: "Choosing a tool, and building every environment with it."
    steps:
      - url: /study-guides/infrastructure/iac-tools-comparison.html
        why: "CloudFormation, CDK, Terraform, and the rest, separated by the questions that actually distinguish them."
      - url: /study-guides/infrastructure/aws/aws-cdk.html
        why: "Infrastructure in a real programming language, and where that power helps or hurts."
    deeper:
      - /study-guides/infrastructure/aws/cloudformation-fundamentals.html
      - /study-guides/infrastructure/iac-environment-lifecycle.html
      - /study-guides/infrastructure/aws/aws-codepipeline-codebuild.html
      - /study-guides/infrastructure/aws/aws-systems-manager.html
      - /resources/cloudformation-template-reference.html
      - /blog/2025/10/11/avoid-localized-configs-favor-distributed-versioned-store.html
    checkpoint:
      can: "build and rebuild an environment from code instead of by hand."
      try: "Rebuild one environment, or one piece of it, as a CDK app. Deploy it twice and confirm the second deploy changes nothing."
      exit: true
  - level: Intermediate
    name: "Security at scale"
    purpose: "Identity, encryption, and audit across many accounts."
    steps:
      - url: /study-guides/infrastructure/aws/aws-organizations-control-tower.html
        why: "Accounts are AWS's strongest boundary. This is how to structure many of them into one governed estate."
      - url: /study-guides/infrastructure/aws/aws-kms-secrets-manager.html
        why: "Keys and secrets managed and rotated centrally, instead of scattered through code and config."
      - url: /study-guides/infrastructure/aws/aws-cloudtrail-config.html
        why: "The record of every API call and configuration change, which detection and compliance both depend on."
      - url: /study-guides/infrastructure/aws/aws-security-hub-guardduty.html
        why: "Detection across every account: threats flagged from the logs you already collect, and findings gathered in one place."
    deeper:
      - /study-guides/infrastructure/aws/aws-cognito.html
      - /study-guides/infrastructure/aws/aws-waf-shield.html
      - /study-guides/infrastructure/iac-governance.html
    checkpoint:
      can: "keep many AWS accounts secure, and find out when something in them goes wrong."
      try: "Draw your account structure as it is, or as it should be, showing which workloads share an account and which guardrails apply to each. Then find one secret still stored in code or config."
  - level: Advanced
    name: "Running it"
    purpose: "Operating, recovering, and paying for what you built."
    steps:
      - url: /study-guides/infrastructure/aws/aws-cloudwatch.html
        why: "Metrics, logs, and alarms for everything above, and what collecting them costs."
      - url: /study-guides/infrastructure/aws/disaster-recovery.html
        why: "The recovery strategies from Foundations built from AWS services, with what each costs to keep ready."
      - url: /study-guides/infrastructure/aws/aws-cost-management.html
        why: "Cost is a design characteristic on AWS. This is how to see it, budget it, and commit to it."
      - url: /case-studies/cloud-cost-optimization.html
        why: "An 80% cut found by one audit, which shows what happens when nobody owns the bill."
    deeper:
      - /study-guides/infrastructure/aws/aws-xray.html
      - /study-guides/infrastructure/aws/multi-region-architecture.html
      - /blog/2026/02/11/observability-is-authored-not-installed.html
    checkpoint:
      can: "see how a workload is behaving, recover it after a failure, and keep its costs under control."
      try: "Pick one workload. Name the alarm that would wake someone for it, the DR strategy that meets the RTO you set in Foundations, and its three largest cost lines last month."
---
