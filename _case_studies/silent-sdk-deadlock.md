---
layout: case-study
title: "When a Trusted Dependency Becomes a Silent Killer"
subtitle: "A silent deadlock in a trusted SDK bypassed every test we had, and plan continuation bias cost me two days I didn't need to lose"
description: "A production outage traced to a silent thread deadlock in AWS SDK v4 that bypassed all functional and regression testing. This case study covers the detection, the false leads, the investigation mistakes, and the process failures that let a third-party bug reach production undetected."
role: "System Architect"
date: 2025-11-05
headline_metric: "Silent SDK Deadlock"
headline_detail: "bypassed all existing tests, 3-day investigation"
category: "failure"
category_label: "Investigation Lessons"
featured: true
technologies:
  - AWS SDK .NET
  - AWS ECS Fargate
  - DynamoDB
  - Entity Framework
  - Dapper
  - .NET
---

## Executive Summary

On a Friday afternoon, our primary website started failing. Most requests to the CMS proxy API were returning errors, and health checks fired the first alert. The API showed no signs of container stress; ECS metrics were clean. The service appeared healthy by every measure except the one that mattered: it wasn't serving requests.

Within an hour I traced the failure to the authentication service, rolled back all APIs to a known-good version, and restored production. The rollback blocked a feature we had just released and were actively selling, so I needed to find and fix the root cause before redeploying.

That took three days. The root cause was a silent thread deadlock introduced in [AWS SDK .NET v4's core authentication library](https://github.com/aws/aws-sdk-net/issues/4020){:target="_blank" rel="noopener noreferrer"} that starved the thread pool under production load. I spent two of those three days chasing the wrong hypothesis. The package I trusted most was the problem.

## The System

The production environment ran roughly 20 APIs on AWS ECS Fargate behind application load balancers, handling between 100 and 1,000 requests per second. The authentication service validated every request with a fresh DynamoDB call; there was no auth caching. Every CMS API request triggered an auth call, and every auth call triggered a DynamoDB read. This made auth the highest-throughput internal dependency and DynamoDB the hottest path in the architecture.

## Detection and Initial Response

Health checks caught the issue first. From the website's perspective, most CMS API requests were failing in a pattern that looked like throttling: some succeeded while most did not.

ECS metrics for the CMS API showed nothing abnormal. CPU, memory, and network were all within normal ranges, but the service couldn't serve traffic. The logs told the real story: the CMS API was waiting on the authentication service, which was not returning successful responses when validating user tokens.

The auth service's own metrics were equally clean. Other APIs in the system could be reached; the CMS and auth services could not. Given the architecture, any other API called as frequently would have failed the same way.

## The Rollback Decision

The latest release had been a broad upgrade across all APIs, so I couldn't roll back just auth; every API went back to the previous known-good version. Production was stable within an hour, but the rollback blocked a feature that required changes from the new deployment. The business was alerted and understood the situation.

## The Investigation

### The Shared Package

The deployment included a change to an internal shared package controlling common distributed security logic. I examined the logs and confirmed the failures didn't originate there. Unit tests confirmed the code was sound. This lead was eliminated quickly.

### The Entity Framework Rabbit Hole

The auth API's health endpoint used Entity Framework to verify database connectivity, and I had noticed an AWS health check error when calling it. I had made minor changes to EF behavior, query structure, and library versions in the latest deployment, and I knew from experience how unpredictable EF context management could be under load. The circumstantial evidence lined up.

So I dug in, analyzing the EF context lifecycle, query execution patterns, and thread pool interactions. When nothing conclusive surfaced, I kept going. Eventually I rewrote the entire data access layer in Dapper to eliminate EF as a variable. The Dapper rewrite was a legitimate improvement; the auth service's queries were simple enough that a full ORM was unnecessary. But I did it for the wrong reason, at the wrong time, in violation of a principle I knew well: change one thing at a time. The rewrite did not fix the problem.

After it failed, I had to accept that EF was not the cause. The health check errors I had been chasing were a symptom of the broader failure, not the source. The auth service's target group was scaling because the API couldn't return successful responses, and the health check failures were a downstream effect of that scaling behavior. I had spent two days on this lead, and "getting closer" was the only thing keeping me on it. That is how plan continuation bias works: the sunk effort makes the current path feel more valuable than starting over, even when starting over is exactly what you should do.

### The Breakthrough

With my own code changes ruled out, I turned to the remaining variable: third-party NuGet package upgrades included in the deployment. I started testing downgrades one at a time, but none of the individual rollbacks resolved the issue.

Then I read the patch notes.

The AWS SDK for .NET had released version 4 of its core library with a new background credential refresh mechanism that created a deadlock under concurrent load. Threads hung silently waiting for credential refresh to complete, while the refresh itself waited on an already-blocked thread. No exceptions were thrown and no errors were logged; the thread pool simply starved until the service could not process requests.

The auth service's DynamoDB path triggered this deadlock aggressively. Every token validation required a DynamoDB call, every DynamoDB call went through the SDK's credential resolution, and every credential resolution now had a chance of deadlocking under load. At 100-1,000 requests per second, the deadlock manifested quickly and consistently in production while remaining invisible in lower-traffic environments. Every AWS package in the system depended on this core library version.

### The Fix

I rolled back nearly all AWS SDK NuGet packages across the affected APIs to a known safe version. After the rollbacks and redeployment, the system was fully restored, including the blocked feature. AWS later acknowledged the bug and [released a fix in version 4.0.103.0](https://github.com/aws/aws-sdk-net/issues/4020){:target="_blank" rel="noopener noreferrer"}.

We never upgraded those AWS packages again. Not because we couldn't, but because we had no pressing reason to, and when we eventually do, it won't happen without a load test.

## Key Lessons

### Load test when dependencies change, not just when your code changes

We ran a complete regression before the release and decided a load test was unnecessary. That decision was defensible for our own code changes, which were isolated and well-understood. It failed to account for the different risk profile of package upgrades, which can introduce behavioral changes invisible to functional tests that only surface under production concurrency. The AWS SDK deadlock was exactly this kind: functionally correct, catastrophically broken under load.

### Trusted vendors still need verification

We had upgraded AWS SDK packages roughly 30 times without incident, and they were the only packages we trusted enough to skip the deep changelog review and load testing we applied to every other dependency. The cost of one undetected bug exceeded the cumulative time we would have spent reviewing changelogs and running load tests for every prior upgrade. "Trusted" should never mean "untested."

### Test your assumption, not your hypothesis

I had a hypothesis (EF context management was causing the failure) but I investigated EF generally rather than testing that specific claim directly. Those feel like the same thing and aren't. Investigating EF meant analyzing context lifecycles, query patterns, and thread interactions with no clear endpoint. Testing the assumption would have meant asking what would specifically disprove it, then running that test first. A focused load test against just the EF path would have confirmed or eliminated the hypothesis in an hour. Instead I spent two days on open-ended exploration, sustained by plan continuation bias: the sunk effort made the current path feel more valuable than starting over. Name the assumption your hypothesis rests on, then design the cheapest test that could falsify it before investigating anything else.

### Read the patch notes before reading the code

When a deployment introduces a failure and your own code is ruled out, the next step should be reviewing every third-party change in detail, starting with patch notes. I went to code analysis and package downgrade testing first. Patch notes are the cheapest investigation step and should come first.

### Change one thing at a time during incident response

The Dapper rewrite happened to improve the codebase, but deploying it alongside the actual fix meant two changed variables at once. If the rewrite had introduced its own subtle bug, I would have been chasing a second ghost on top of the first. During incident response, every change should be the minimum needed to test the current hypothesis. Improvements belong in a separate deployment after the incident is resolved.
