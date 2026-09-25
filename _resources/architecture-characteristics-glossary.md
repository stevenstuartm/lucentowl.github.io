---
title: "Architecture Characteristics Glossary"
layout: resource
type: reference
category: "Architecture"
description: "Common architecture characteristics defined in plain terms, from accessibility to upgradeability, plus how to measure the most commonly prioritized ones."
last_updated: 2026-09-25
tags: [architecture, fundamentals, decision-making, performance, scalability, reliability, maintainability]
related_guides:
  - /study-guides/architecture/architecture-characteristics.html
---

## Glossary

| Characteristic | Definition |
| --- | --- |
| Accessibility | Usable by people with disabilities |
| Authentication | Verifies user identity |
| Authorization | Controls what authenticated users can do |
| Availability | Percentage of time the system is accessible and functional, including surviving the loss of a data center or availability zone |
| Configurability | Behavior changes through configuration rather than code changes |
| Continuity | Business operations continue during disasters (disaster recovery, backups) |
| Data residency | Data is stored and processed only in the geographic regions that law or contract allows |
| Deployability | How easily and safely the system can be deployed to production |
| Elasticity | Capacity grows and shrinks automatically with actual load, so cost follows demand rather than the predicted peak |
| Extensibility | How easily new functionality can be added |
| Legal compliance | Meets the regulatory requirements that apply to the system and its data |
| Maintainability | How easily developers can understand, debug, and modify the code |
| Performance | Response times, throughput, and resource efficiency |
| Portability | How easily the system moves between environments, platforms, or cloud providers |
| Privacy | Protects user data from unauthorized access and use |
| Recoverability | How quickly the system recovers from failures (RTO/RPO) |
| Reliability | Ability to function correctly over time, handle errors gracefully |
| Robustness | Ability to handle unexpected inputs or conditions without crashing |
| Scalability | How well the system handles increased load (vertical or horizontal) |
| Security | Protects the system from malicious actors and vulnerabilities |
| Supportability | How easily support teams can diagnose and resolve issues |
| Testability | How easily the system can be tested, including automated verification |
| Upgradeability | How easily the system adopts new versions of dependencies or infrastructure |

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
