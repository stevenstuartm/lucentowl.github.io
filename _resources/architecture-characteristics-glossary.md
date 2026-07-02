---
title: "Architecture Characteristics Glossary"
layout: resource
type: reference
category: "Architecture"
description: "22 architecture characteristics (operational, structural, cloud-specific, cross-cutting) with definitions, plus how to measure the most commonly prioritized ones."
last_updated: 2026-07-02
tags: [architecture, fundamentals, decision-making, performance, scalability, reliability, maintainability]
related_guides:
  - /study-guides/architecture/architecture-characteristics.html
---

## Glossary

### Operational

| Characteristic | Definition |
| --- | --- |
| Availability | Percentage of time the system is accessible and functional |
| Continuity | Business operations continue during disasters (disaster recovery, backups) |
| Performance | Response times, throughput, and resource efficiency |
| Recoverability | How quickly the system recovers from failures (RTO/RPO) |
| Reliability | Ability to function correctly over time, handle errors gracefully |
| Robustness | Ability to handle unexpected inputs or conditions without crashing |
| Scalability | How well the system handles increased load (vertical or horizontal) |

### Structural

| Characteristic | Definition |
| --- | --- |
| Configurability | Behavior changes through configuration rather than code changes |
| Deployability | How easily and safely the system can be deployed to production |
| Extensibility | How easily new functionality can be added |
| Maintainability | How easily developers can understand, debug, and modify the code |
| Portability | How easily the system moves between environments, platforms, or cloud providers |
| Testability | How easily the system can be tested, including automated verification |
| Upgradeability | How easily the system adopts new versions of dependencies or infrastructure |

### Cloud-Specific

| Characteristic | Definition |
| --- | --- |
| On-Demand Scalability | Scales resources based on actual load rather than predicted peak capacity |
| On-Demand Elasticity | Automatically scales up and down, minimizing cost during low demand |
| Zone-Based Availability | Distributed across availability zones to survive zone-level failures |
| Region-Based Privacy | Data residency restricted to specific geographic regions |

### Cross-Cutting

| Characteristic | Definition |
| --- | --- |
| Accessibility | Usable by people with disabilities |
| Authentication | Verifies user identity |
| Authorization | Controls what authenticated users can do |
| Legal | Meets regulatory compliance requirements |
| Privacy | Protects user data from unauthorized access and use |
| Security | Protects the system from malicious actors and vulnerabilities |
| Supportability | How easily support teams can diagnose and resolve issues |

## How to Measure

| Characteristic | Metrics |
| --- | --- |
| Performance | Response time, throughput, latency (percentiles matter more than averages) |
| Availability | Uptime percentage, mean time between failures (MTBF), mean time to recovery (MTTR) |
| Scalability | Maximum throughput, concurrent users supported, resource utilization under load |
| Reliability | Error rates, successful transaction percentage, data integrity metrics |
| Maintainability | Cyclomatic complexity (target: <5, acceptable: <10), lines per method, dependency depth |
| Extensibility | Number of extension points, plugin API coverage, customization without core changes |
| Testability | Test coverage percentage, test execution time, ease of creating test fixtures |
| Deployability | Deployment frequency, deployment duration, rollback success rate |
| Supportability | Mean time to diagnose issues, resolution time, number of escalations |
