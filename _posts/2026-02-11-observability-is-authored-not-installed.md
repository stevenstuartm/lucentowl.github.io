---
layout: post
title: "Observability Is Authored, Not Installed"
date: 2026-02-11
description: "Many observability failures trace back to code that doesn't classify its own behavior. When your system can't distinguish 'handled correctly' from 'actually broken,' no platform can compensate."
tags: [observability, devops, architecture, operations]
sources:
  - title: "W3C Trace Context"
    url: "https://www.w3.org/TR/trace-context/"
  - title: "Observability (control theory), Wikipedia"
    url: "https://en.wikipedia.org/wiki/Observability"
author: steven-stuart
---

I have been a part of a dev team where poor observability constantly brought us to a standstill. Not because the tooling was missing, but because the data it collected never carried meaningful context. Alerts fired constantly, so operations teams ignored them. Dashboards existed for every service, but none of them answered the questions that mattered during incidents. Investigations that should have taken minutes took hours. It got bad enough that slow diagnosis alone stretched incidents into significant SLA violations.

We questioned the choice of platforms, dashboards, and alerting rules. Yet none of those could help, because no tool could report a distinction our code never recorded. The problem was upstream, since our code didn't know the difference between "I handled this correctly" and "something is actually broken."

## The Classification Problem: Handled Outcomes Logged as Errors

Consider a payment processing system. A customer's card gets declined for insufficient funds. The payment gateway returns a rejection, and the system logs it as an ERROR.

But this is the system working correctly. Insufficient funds is a handled business case, not an exception. Because it's logged as an error, though, it shows up in error dashboards, triggers error-rate alerts, and adds to the ambient noise that operators learn to tune out.

Over time, "payment errors" become background radiation. The team knows most of them are just declined cards, so they stop investigating. Then the gateway starts timing out, or a partner pushes a breaking change, and the actual problem gets buried. Nobody notices because "payment errors are always high."

The usual response is to blame the team for ignoring alerts. It is a discipline problem, yes, but the discipline that's missing is upstream, in the code that treats expected outcomes as errors.

The fix is upstream of your alerting platform, in code that sorts each outcome by what it means:

- **Expected success**: The happy path. Logged at DEBUG if at all.
- **Expected failure**: Business logic correctly rejecting something, like declined payments, validation failures, or rejecting a caller over its quota. This is INFO, not ERROR.
- **Degraded but functional**: The system recovered, but something is wearing thin. Retries succeeding after multiple attempts, or a dependency throttling your calls. This is WARN. It isn't broken yet, but it needs attention before it becomes broken. Conditions that only show in aggregate, like response times approaching SLA thresholds or connection pools running hot, belong in metrics rather than in a WARN line per request.
- **Unexpected failure**: Something genuinely went wrong that demands investigation. This is the only category that should be ERROR.

When the system correctly declines a card for insufficient funds, it's tempting to log that as WARN because you want the metric reviewed often. But a correctly handled decline is the system working as designed, not degrading. Whether the decline rate is "concerning" is a business question that changes with strategy and context, so log levels shouldn't encode that judgment. Leave business interpretation to reports and dashboards where it can evolve, not to code where it gets baked in and forgotten. Feed those reports from a decline counter rather than from INFO lines, so they survive the log sampling many teams apply to INFO. That counter can still carry an anomaly alert routed to engineering, because a sudden spike in correctly handled declines can mean a bug sending wrong amounts or a card-testing attack, and that alert stays separate from the error rate.

Typed results make this distinction structural instead of incidental. When expected failures are returned as typed results rather than thrown as exceptions, the classification is baked into the code's structure. A declined payment returns a result; a gateway timeout that exhausts its retries throws an exception. The distinction is explicit at the point where it matters most. Typed results don't pick a log level by themselves, since a logging boundary still has to map each result type to one, but they put that decision in one visible, testable place instead of leaving it to guesswork at every call site.

When classification is right, every downstream tool benefits. Dashboards that track error rates become genuine health indicators because errors represent actual unexpected failures, not business logic working as designed. Log queries become surgical because structured errors with proper context let you filter to a specific tenant or operation in minutes. Alerts can become actionable, because every error they count demands investigation, though thresholds and routing still have to be set well. Alerting on SLOs instead of log lines doesn't escape this. An SLI's definition of a good request has to exclude declines and count gateway timeouts, so the same classification moves into the SLI.

When classification is wrong, the opposite happens. Alerts fire for expected outcomes, so operators learn to ignore them. Dashboards become decoration because nobody trusts what the numbers represent. Every investigation becomes archaeology because the data that should answer your questions is buried under noise. A pipeline rule that relevels decline lines downstream can patch one dashboard, but every consumer has to re-derive the rule, the rule breaks silently when the message changes, and sampling may drop the line before the rule runs.

A platform can catch some transport failures on its own, like a timeout on an outbound call, but no monitoring platform compensates for what the code got wrong at the source. Auto-instrumentation can tell a 402 decline from a 504 timeout by status code, but only when the status code carries the meaning. A decline wrapped in a 200 response body, or a 400 caused by a partner's breaking schema change that looks just like a validation failure, reaches the platform with the wrong label, and only the code knows the difference. The code knows it because someone designed it to. If it validates each request against its own rules before sending, any schema or contract 400 the partner returns afterward is unexpected by definition. Rejections based on the partner's own state, like a closed account, need its error codes mapped explicitly.

## Context Is Authored, Not Accumulated

The instinct is to compensate with volume: write verbose logs everywhere so you'll have context when you need it. But a trace-level log is not a dump file. Nearly every bug I've seen diagnosed from trace logs involved information that should have already been in the error or warning itself. The problem was never insufficient logging volume; it was that nobody authored the context where it mattered. Most of that context can be chosen in advance. The domain facts that decide an outcome are ones the code already handles, like the operation, its input, and the response from whatever it called. Environment facts like the build version, config, feature flags, and host belong there too, and the logging setup can attach those to every entry without per-call code. Some deciding facts won't be predictable, and the black box test below measures how often that happens.

What actually solves bugs is understanding what the user did and what they sent, not tracing the code's internal flow. If your logs carry a correlation key across services and your errors capture the operation, the input, and what went wrong, you have what you need to reproduce the problem. Carrying that key is a solved problem. The W3C Trace Context standard defines how it travels between services, and most structured logging libraries can stamp it on every entry. The idea is the one behind event sourcing, where a state can be rebuilt by replaying the events that produced it. For deterministic domain logic, you don't need to trace every intermediate step if you can reconstruct the scenario from the input, the outcome, and the state the operation read. That last part matters for races and for records that have changed since, which can't be rebuilt from the request alone, so the error should carry the versions of the records it loaded.

Failures should carry their own context. When an operation fails, the error log should include what was being attempted, what went wrong, and enough identifying information to correlate it. Consider a checkout failure: instead of logging "payment processing failed," a properly authored error captures the operation ("charge_payment"), the correlation ID, the gateway's response code, and the amount, structured enough to query and specific enough to reproduce the failure without re-running production traffic. What gets logged must be intentional. You know the domain, so you know the potential inputs, what's valid, and what's sensitive. That knowledge lets you author a safe context: enough to reproduce the problem without exposing data that shouldn't be in a log. If you don't understand the domain well enough to make that distinction, that's the source of the problem, not the logging infrastructure.

Trace-level logging has its place for diagnosing specific flows, such as ordering bugs where the sequence itself is the evidence, when you can toggle it on temporarily, but it shouldn't be your primary mechanism for understanding what your system did. Bugs that never raise an error, like wrong output or creeping latency, are a different case. Latency shows up in span timings and profilers, and that part of observability really is installed. Wrong output only surfaces in business-outcome metrics, and those are authored, because someone has to decide which outcome to count.

A stronger version of the volume argument is to record one structured event per request with dozens of attributes, so you can ask questions afterward that nobody predicted. That approach handles unknowns far better than trace dumps, but it doesn't escape authoring. The event still needs an outcome field that says whether a decline was expected or broken, and domain fields like the tenant and the gateway's response code only exist if the code puts them there. Without them, a high-cardinality store is a faster way to search through the same unclassified noise.

The difference between a useful error and a useless one is whether someone authored the context intentionally or hoped that raw volume would cover it.

## The Black Box Test: Diagnose From Outputs Alone

Classification and context are design decisions, but most developers never test whether their logging actually answers the questions it needs to. One reason is the debugger habit. When something behaves unexpectedly, the instinct is to attach a debugger, set breakpoints, and step through execution rather than read the outputs. A developer who resolves every local surprise by stepping through code gets little practice diagnosing from outputs, so gaps in those outputs are easy to miss until production.

Some organizations extend this habit into production with remote debugging, but that's a security liability. A debugger attached to a running container, or to any production process, can read its memory, including secrets and customer data, and can change what it executes, so every open debug port is another way into production. Snapshot debuggers that capture variables without pausing are gentler, but they still read memory that holds secrets and customer data. You should be observing system outputs, not attaching to live processes.

Production should be a black box. If your default instinct when something breaks in production is to attach to it rather than read the outputs, you'll rarely feel the pressure to make those outputs useful. The classification stays sloppy, the context stays thin, and the errors stay vague. Not because you don't know better, but because you've never needed better.

Developers who diagnose from observable behavior, whether testing locally against containerized dependencies or against remote systems, tend to build the discipline. They feel the pain of vague errors and missing context firsthand, and they fix it at the source because they have no easier option.

The word observability comes from control theory, where Rudolf Kálmán defined it in 1960. A system is observable when its internal state can be inferred from its external outputs. The practical test applies that definition. When something breaks, can you diagnose it from the system's outputs alone? Or do you need to add logging, redeploy, and wait for it to happen again? If the answer is the latter, your code doesn't explain itself yet. Software never passes completely, so run the test as a rate. For each recent incident, ask whether the first responder could identify the failing operation, its input, and the cause from existing telemetry, and count how many needed new logging and a redeploy. That count should fall quarter over quarter.

That discipline holds best when builders own what they operate. You don't log payment declines as errors when you're the one who gets paged for "high error rate on payment service." You don't dump verbose logs instead of authoring context when you're the one parsing them at 3 AM. Paging alone can also push a team to raise thresholds or mute alerts instead of fixing the source. Bringing the authors into incident diagnosis, and filing every misclassified outcome or context-free error found during an incident as a bug against the owning team, turns that pain into a source fix. It also works when ownership is split across teams, where whoever wrote the code would otherwise never feel what their classification and context choices cause downstream.

Better tooling alone won't make your code explain itself. Running the black box test against it, and living with what it produces, will.
