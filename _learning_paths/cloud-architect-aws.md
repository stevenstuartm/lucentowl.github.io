---
title: "Designing on AWS"
order: 3
description: "A route for developers and architects designing their first production systems on AWS: the Well-Architected pillars, identity, networking, compute, and storage, then choosing data stores and connecting services with APIs, queues, and events."
goal: "Design a production workload on AWS, choosing its compute, data, and integration services for their trade-offs rather than their marketing."
audience: "Developers and architects designing systems on AWS"
assumes: "You've built and deployed web applications, and know the architecture basics that Developer to Architect covers in its first three stages. No AWS experience needed."
last_reviewed: 2026-09-26
stages:
  - level: Foundations
    name: "Thinking in cloud trade-offs"
    purpose: "The trade-offs every AWS design is judged by, and the networking every AWS service assumes."
    steps:
      - url: /study-guides/infrastructure/aws/aws-well-architected-framework.html
        why: "The six pillars are the cloud's architecture characteristics. Every service choice later in the path trades among them."
      - url: /study-guides/networking/networking.html
        why: "Subnets, routing, and load balancers all assume this. Cloud networking is ordinary networking with an API in front of it."
    checkpoint:
      can: "judge whether an AWS design is sound, and understand the networking every service is built on."
      try: "Take an application you've deployed anywhere. For each of the six pillars, write one sentence on where the application is weakest."
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
    checkpoint:
      can: "put an application on AWS, and decide what runs it and who can reach it."
      try: "Sketch the AWS version of an application you know, with its VPC and subnets, its load balancer, container or Lambda compute and why, and the IAM role each piece uses. If you have an account, deploy the smallest piece with a role that grants only what it needs."
      exit: true
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
      - url: /resources/database-selection-matrix.html
        why: "Access patterns mapped to store types, for the workloads that need more than one database. Keep it open for your next data decision."
    deeper:
      - /study-guides/infrastructure/aws/aws-elasticache.html
    checkpoint:
      can: "choose a database for a workload on AWS, and shape your data to fit the one you chose."
      try: "List the access patterns for one feature in your sketch. Decide whether they fit RDS or DynamoDB, and if DynamoDB, design the partition and sort keys that serve them."
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
    checkpoint:
      can: "connect services so that one can fail or slow down without breaking the others."
      try: "Pick one synchronous call in your sketch that doesn't need an immediate answer. Redesign it with SQS, EventBridge, or Step Functions, and write down what happens when its consumer fails twice."
---
