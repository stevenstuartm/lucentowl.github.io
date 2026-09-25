---
title: "Cloud Architect on AWS"
order: 3
description: "A route for developers and architects designing systems on AWS: the Well-Architected pillars, identity, networking, compute, and storage, data and integration services, infrastructure as code, security across accounts, and operating, recovering, and paying for it all."
goal: "Design, secure, and run production systems on AWS, choosing each service for its trade-offs rather than its marketing."
audience: "Developers and architects designing systems on AWS"
assumes: "You've built and deployed web applications, and know the architecture basics that Developer to Architect covers in its first three stages. No AWS experience needed."
last_reviewed: 2026-09-25
stages:
  - level: Foundations
    name: "Thinking in cloud trade-offs"
    purpose: "The trade-offs every AWS design is judged by, and the networking every AWS service assumes."
    steps:
      - url: /study-guides/infrastructure/aws/aws-well-architected-framework.html
        why: "The six pillars are the cloud's architecture characteristics. Every service choice later in the path trades among them."
      - url: /study-guides/networking/networking.html
        why: "Subnets, routing, and load balancers all assume this. Cloud networking is ordinary networking with an API in front of it."
  - level: Basics
    name: "Identity, network, compute, storage"
    purpose: "The four things every AWS workload is built on."
    steps:
      - url: /study-guides/infrastructure/aws/aws-iam-fundamentals.html
        why: "Every request to AWS is an IAM decision, so identity comes before anything you build."
      - url: /study-guides/infrastructure/aws/aws-vpc-architecture.html
        why: "Where your workloads live and what can reach them. Most later services sit in, or next to, a VPC."
      - url: /study-guides/infrastructure/aws/aws-elastic-load-balancing.html
        why: "The front door for most workloads, and the first place health checks, scaling, and TLS meet."
      - url: /study-guides/infrastructure/aws/aws-container-services.html
        why: "Chooses between EC2, Lambda, and containers, and between ECS, EKS, and Fargate once containers win."
      - url: /study-guides/infrastructure/aws/aws-lambda-fundamentals.html
        why: "The compute model that changes design the most: invocation models, retries, and cold starts shape everything around a function."
      - url: /study-guides/infrastructure/aws/aws-s3-fundamentals.html
        why: "The storage nearly every AWS system touches, and the cheapest home for data that doesn't need a database."
    deeper:
      - /study-guides/infrastructure/aws/aws-ec2-fundamentals.html
      - /study-guides/infrastructure/aws/aws-route53.html
      - /study-guides/infrastructure/aws/aws-cloudfront.html
      - /study-guides/infrastructure/aws/aws-ebs-efs.html
      - /resources/aws-diagrams.html
  - level: Intermediate
    name: "Data"
    purpose: "Where each workload's data lives, and designing for the store you chose."
    steps:
      - url: /study-guides/infrastructure/aws/aws-database-selection.html
        why: "Relational first, and when DynamoDB or a cache earns its place. The next two steps go deep on the likely answers."
      - url: /study-guides/infrastructure/aws/aws-rds-aurora.html
        why: "What AWS manages for a relational database, what you still own, and when Aurora is worth it."
      - url: /study-guides/infrastructure/aws/aws-dynamodb.html
        why: "Designing around keys and access patterns instead of queries, which runs against relational habit."
    deeper:
      - /study-guides/infrastructure/aws/aws-elasticache.html
      - /resources/database-selection-matrix.html
  - level: Intermediate
    name: "Integration"
    purpose: "Connecting services without coupling them: APIs, queues, and events."
    steps:
      - url: /study-guides/infrastructure/aws/aws-api-gateway.html
        why: "The managed front for APIs: authorizers, throttling, and choosing the API type that fits."
      - url: /study-guides/infrastructure/aws/aws-sqs-sns.html
        why: "Queues and fan-out, the backbone of decoupled AWS systems, with the delivery and retry semantics you have to design for."
      - url: /study-guides/infrastructure/aws/aws-eventbridge.html
        why: "Events routed by their content rather than by queue, for when producers shouldn't know their consumers."
      - url: /study-guides/infrastructure/aws/aws-step-functions.html
        why: "Multi-step workflows with retries and error handling owned by the service, not written into your code."
    deeper:
      - /study-guides/infrastructure/aws/aws-kinesis.html
  - level: Intermediate
    name: "Infrastructure as code and delivery"
    purpose: "Building every environment from code, and shipping changes safely."
    steps:
      - url: /study-guides/infrastructure/iac-fundamentals.html
        why: "Desired state, plan and apply, and idempotence: the ideas every IaC tool shares."
      - url: /blog/2025/10/11/avoid-localized-configs-favor-distributed-versioned-store.html
        why: "An argument to settle before writing templates: configuration belongs in a versioned store, not beside the code."
      - url: /study-guides/infrastructure/iac-tools-comparison.html
        why: "CloudFormation, CDK, Terraform, and the rest, separated by the questions that actually distinguish them."
      - url: /study-guides/infrastructure/aws/aws-cdk.html
        why: "Infrastructure in a real programming language, and where that power helps or hurts."
      - url: /study-guides/infrastructure/deployment-strategies.html
        why: "Rolling, blue-green, and canary releases, which decide how much a bad deploy can break."
    deeper:
      - /study-guides/infrastructure/aws/cloudformation-fundamentals.html
      - /study-guides/infrastructure/iac-environment-lifecycle.html
      - /study-guides/infrastructure/aws/aws-codepipeline-codebuild.html
      - /study-guides/infrastructure/aws/aws-systems-manager.html
      - /resources/cloudformation-template-reference.html
  - level: Advanced
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
  - level: Advanced
    name: "Running it"
    purpose: "Operating, recovering, and paying for what you built."
    steps:
      - url: /study-guides/infrastructure/aws/aws-cloudwatch.html
        why: "Metrics, logs, and alarms for everything above, and what collecting them costs."
      - url: /study-guides/infrastructure/disaster-recovery-patterns.html
        why: "RTO, RPO, and the four recovery strategies, decided from what the business can afford to lose."
      - url: /study-guides/infrastructure/aws/disaster-recovery.html
        why: "The same strategies built from AWS services, with what each costs to keep ready."
      - url: /study-guides/infrastructure/aws/aws-cost-management.html
        why: "Cost is a design characteristic on AWS. This is how to see it, budget it, and commit to it."
      - url: /case-studies/cloud-cost-optimization.html
        why: "An 80% cut found by one audit, which shows what happens when nobody owns the bill."
    deeper:
      - /study-guides/infrastructure/aws/aws-xray.html
      - /study-guides/infrastructure/aws/multi-region-architecture.html
      - /blog/2026/02/11/observability-is-authored-not-installed.html
---
