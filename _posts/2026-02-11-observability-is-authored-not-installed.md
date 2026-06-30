---
layout: post
title: "Observability Is Authored, Not Installed"
date: 2026-02-11
description: "Most observability failures trace back to code that doesn't classify its own behavior. When your system can't distinguish 'handled correctly' from 'actually broken,' no platform can compensate."
tags: [observability, devops, architecture, operations]
---

I have been a part of a dev team where poor observability constantly brought us to a standstill. Not because the tooling was missing, but because the data it collected never carried meaningful context. Alerts fired constantly, so operation teams ignored them, and dashboards existed for every service, but none of them answered the questions that mattered during incidents. Investigations that should have taken minutes took hours. It got bad enough that observability failures alone caused significant SLA violations.

We questioned the choice of platforms, dashboards, and alerting rules. Yet none of those could help because the problem was never the tooling. The problem was upstream since our code didn't know the difference between "I handled this correctly" and "something is actually broken."

## The Classification Problem

Consider a payment processing system. A customer's card gets declined for insufficient funds. The payment gateway returns a rejection, and the system logs it as an ERROR.

But this is the system working correctly. Insufficient funds is a handled business case, not an exception. Because it's logged as an error, though, it shows up in error dashboards, triggers error-rate alerts, and adds to the ambient noise that operators learn to tune out.

Over time, "payment errors" become background radiation. The team knows most of them are just declined cards, so they stop investigating. Then the gateway starts timing out, or a partner pushes a breaking change, and the actual problem gets buried. Nobody notices because "payment errors are always high."

The usual response is to blame the team for ignoring alerts. It is a discipline problem, yes, but the discipline that's missing is upstream, in the code that treats expected outcomes as errors.

The fix is upstream of your alerting platform:

- **Expected success**: The happy path. Logged at DEBUG if at all.
- **Expected failure**: Business logic correctly rejecting something, like declined payments, validation failures, or rate limiting. This is INFO, not ERROR.
- **Degraded but functional**: The system recovered, but something is wearing thin. Retries succeeding after multiple attempts, response times approaching SLA thresholds, connection pools running hot. This is WARN: not broken yet, but needing attention before it becomes broken.
- **Unexpected failure**: Something genuinely went wrong that demands investigation. This is the only category that should be ERROR.

When the system correctly declines a card for insufficient funds, it's tempting to log that as WARN because you want the metric reviewed often. But a correctly handled decline is the system working as designed, not degrading. Whether the decline rate is "concerning" is a business question that changes with strategy and context; log levels shouldn't encode that judgment. Leave business interpretation to reports and dashboards where it can evolve, not to code where it gets baked in and forgotten.

Typed results make this distinction structural instead of incidental. When expected failures are returned as typed results rather than thrown as exceptions, the classification is baked into the code's structure. A declined payment returns a result; a gateway timeout throws an exception. The distinction is explicit at the point where it matters most, and logging infrastructure can respect it without guessing.

When classification is right, every downstream tool benefits. Dashboards that track error rates become genuine health indicators because errors represent actual unexpected failures, not business logic working as designed. Log queries become surgical because structured errors with proper context let you filter to a specific tenant or operation in minutes. Alerts become actionable because they fire only for conditions that demand investigation.

When classification is wrong, the opposite happens. Alerts fire for expected outcomes, so operators learn to ignore them. Dashboards become decoration because nobody trusts what the numbers represent. Every investigation becomes archaeology because the data that should answer your questions is buried under noise. No monitoring platform compensates for what the code got wrong at the source.

## Context Is Authored, Not Accumulated

The instinct is to compensate with volume: write verbose logs everywhere so you'll have context when you need it. But a trace log is not a dump file. Every bug I've seen diagnosed from trace logs involved information that should have already been in the error or warning itself. The problem was never insufficient logging volume; it was that nobody authored the context where it mattered.

What actually solves bugs is understanding what the user did and what they sent, not tracing the code's internal flow. If your logs carry a correlation key across services (most structured logging libraries support this out of the box) and your errors capture the operation, the input, and what went wrong, you have what you need to reproduce the problem. The approach is the same one that makes event-sourcing systems reliable: capture the context that led to a state so you can replay it. You don't need to trace every intermediate step if you can reconstruct the scenario from the input and the outcome.

Failures should carry their own context. When an operation fails, the error log should include what was being attempted, what went wrong, and enough identifying information to correlate it. Consider a checkout failure: instead of logging "payment processing failed," a properly authored error captures the operation ("charge_payment"), the correlation ID, the gateway's response code, and the amount, structured enough to query and specific enough to reproduce the failure without re-running production traffic. What gets logged must be intentional. You know the domain, so you know the potential inputs, what's valid, and what's sensitive. That knowledge lets you author a safe context: enough to reproduce the problem without exposing data that shouldn't be in a log. If you don't understand the domain well enough to make that distinction, that's the source of the problem, not the logging infrastructure. Trace-level logging has its place for diagnosing specific flows when you can toggle it on temporarily, but it shouldn't be your primary mechanism for understanding what your system did.

The difference between a useful error and a useless one is whether someone authored the context intentionally or hoped that raw volume would cover it.

## The Black Box Test

Classification and context are design decisions, but most developers never test whether their logging actually answers the questions it needs to. One reason is the debugger habit. When something behaves unexpectedly, the instinct is to attach a debugger, set breakpoints, and step through execution rather than read the outputs.

Some organizations extend this habit into production with remote debugging, but that's a security liability. Direct access to a running container, or any production process, exposes the environment regardless of the layer. You should be observing system outputs, not attaching to live processes.

Production should be a black box. If your default instinct when something breaks is to attach a debugger rather than read the outputs, you'll never feel the pressure to make those outputs useful. The classification stays sloppy, the context stays thin, and the errors stay vague. Not because you don't know better, but because you've never needed better.

Developers who diagnose from observable behavior, whether testing locally against containerized dependencies or against remote systems, build the discipline naturally. They feel the pain of vague errors and missing context firsthand, and they fix it at the source because they have no other option.

The practical test is straightforward: when something breaks, can you diagnose it from the system's outputs alone? Or do you need to add logging, redeploy, and wait for it to happen again? If the answer is the latter, your code doesn't explain itself yet.

That discipline holds best when builders own what they operate. You don't log payment declines as errors when you're the one who gets paged for "high error rate on payment service." You don't dump verbose logs instead of authoring context when you're the one parsing them at 3 AM. When ownership is split across teams, the same test still applies, but it depends on whoever wrote the code actually feeling the pain their classification and context choices cause downstream.

Better tooling alone won't make your code explain itself. Running the black box test against it, and living with what it produces, will.
