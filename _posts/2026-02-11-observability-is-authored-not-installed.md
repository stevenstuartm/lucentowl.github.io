---
layout: post
title: "Observability Is Authored, Not Installed"
date: 2026-02-11
description: "Many observability failures trace back to code that doesn't classify its own behavior. When your system can't distinguish 'handled correctly' from 'actually broken,' no platform can compensate."
tags: [observability, devops, architecture, operations]
sources:
  - title: "Liz Fong-Jones, Authors' Cut: Structured Events Are the Basis of Observability (from Observability Engineering)"
    url: "https://honeycomb.io/blog/structured-events-basis-observability"
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

The fix belongs in that code, which should sort each outcome by what it means:

- **Expected success**: The happy path. Logged at DEBUG if at all.
- **Expected failure**: Business logic correctly rejecting something, like declined payments, validation failures on input from outside callers, or rejecting a caller over its quota. This is INFO, not ERROR.
- **Degraded but functional**: The system recovered, but something is wearing thin. Retries running past their usual count, or a dependency throttling your calls. This is WARN. It isn't broken yet, but it needs attention before it becomes broken.
- **Unexpected failure**: Something genuinely went wrong that demands investigation. This is the only category that should be ERROR. A call that fails past its retries belongs here even against a dependency known to be flaky, because no code path handled it. If that becomes routine, the fix is a handled path like a circuit breaker or fallback, which moves it to degraded.

Typed results make this distinction structural instead of incidental. When expected failures are returned as typed results rather than thrown as exceptions, the classification is baked into the code's structure. A declined payment returns a result; a gateway timeout that exhausts its retries throws an exception. A logging boundary still has to map each result type to a log level, but typed results put that decision in one visible, testable place instead of leaving it to guesswork at every call site.

The log level is only one way to carry that decision. A structured outcome field or a counter works as well, as long as the code sets it. For conditions that only show in aggregate, like routine retry counts, response times approaching SLA thresholds, or connection pools running hot, a metric carries the decision better than a WARN line per request.

When classification is right, every downstream tool benefits. Dashboards that track error rates become genuine health indicators because errors represent actual unexpected failures, not business logic working as designed. Log queries become surgical because structured errors with proper context let you filter to a specific tenant or operation in minutes. Once thresholds and routing are set well, alerts become actionable, because every error they count demands investigation.

When classification is wrong, the opposite happens. Alerts fire for expected outcomes, so operators learn to ignore them. Dashboards become decoration because nobody trusts what the numbers represent. Every investigation becomes archaeology because the data that should answer your questions is buried under noise.

### Only the Code Can Make the Call

The usual alternative is to classify downstream, but no downstream tool can classify outcomes the code didn't make distinguishable. Each option runs into that limit in its own way.

- **A collector rule** can change the level of decline lines in one central place. But it matches message text, so it breaks silently when the message changes, and it never sees lines that sampling already dropped.
- **Filters by logger category or exception type** quiet framework and library noise without matching text. But they can't split a decline from a breakage inside the same operation.
- **An SLO** holds the classification rule in one shared place. But it can only count a field the code emits.

Status codes look like a field the code emits, and auto-instrumentation can tell a 402 decline from a 504 timeout. But a status code carries the meaning only when the code puts it there. A decline wrapped in a 200 response body reaches the platform with the wrong label. A partner's breaking schema change gets the wrong label too, because it arrives as a 400 that looks just like a validation failure.

Only the code knows the difference, and it knows because someone designed it to. A partner integration shows what that design looks like. If the code validates each request against its own rules before sending, any schema or contract 400 the partner returns afterward is unexpected by definition. Sometimes the 400 reveals a rule your validator missed rather than a partner change. ERROR is still right, because the gap is a bug in your code, and fixing it removes that noise. Rejections based on the partner's own state, like a closed account, are different. They're expected outcomes, so map the partner's error codes for them explicitly.

### Business Judgment Belongs in Counters, Not Log Levels

When the system correctly declines a card for insufficient funds, it's tempting to log that as WARN because you want the metric reviewed often. But a correctly handled decline is the system working as designed, not degrading. Whether the decline rate is "concerning" is a business question that changes with strategy and context, so log levels shouldn't encode that judgment. Leave business interpretation to reports and dashboards where it can evolve, not to code where it gets baked in and forgotten.

Declines still deserve watching, just not through the log level. Feed those reports from a decline counter rather than from INFO lines, because many teams sample INFO logs and a counter keeps every decline. The counter also catches breakage that looks like declines. A sudden spike in correctly handled declines can mean a bug sending wrong amounts or a card-testing attack, so the same counter can carry an anomaly alert routed to engineering, separate from the error rate.

## Context Is Authored, Not Accumulated

The instinct is to compensate with volume: write verbose logs everywhere so you'll have context when you need it. But a trace-level log is not a dump file. Nearly every bug I've seen diagnosed from trace logs involved information the code already had at the point of failure and could have put in the error or warning itself. In those cases the problem wasn't insufficient logging volume; it was that nobody authored the context where it mattered.

A stronger version of the volume argument comes from *Observability Engineering*, by Charity Majors, Liz Fong-Jones, and George Miranda. It records one wide structured event per request with dozens of attributes, so you can ask questions afterward that nobody predicted. That approach handles unknowns far better than trace dumps, but it doesn't escape authoring. The event still needs an outcome field that says whether a decline was expected or broken, and domain fields like the tenant and the gateway's response code only exist if the code puts them there. Without them, a high-cardinality store is a faster way to search through the same unclassified noise.

Failures should carry their own context. When an operation fails, the error log should include what was being attempted, what went wrong, and enough identifying information to correlate it. Consider a checkout failure. Instead of logging "payment processing failed," a properly authored error captures the operation ("charge_payment"), the correlation ID, the gateway's response code, and the amount. That's structured enough to query and specific enough to reproduce the failure without re-running production traffic.

What solves most domain-logic bugs is understanding what the user did and what they sent, not tracing the code's internal flow. Connecting what they did across services takes a correlation key, and carrying that key is a solved problem. The W3C Trace Context standard defines how it travels between services, and most structured logging libraries can stamp it on every entry. With that key and errors authored like the checkout one, you have what you need to reproduce the problem.

Reproducing a failure from its input, rather than tracing it, borrows the idea behind event sourcing, where a state can be rebuilt by replaying the events that produced it. For deterministic domain logic, you don't need to trace every intermediate step if you can reconstruct the scenario from the input, the outcome, and the state the operation read.

The state the operation read is the part the request can't supply. A race, or a record that changed after the failure, can't be replayed from the input alone. So the error should carry the versions of the records it loaded. A version only helps while the old record still exists. If the store overwrites records in place, carry the field values the decision used instead.

Most of the context a failure needs can be chosen in advance, because the facts that decide an outcome are ones the code already handles. They are the operation, its input, the response from whatever it called, and the versions of the records it read. Environment facts like the build version, config, feature flags, and host belong there too, and the logging setup can attach those to every entry without per-call code. Some deciding facts won't be predictable. Those show up as incidents where someone had to add logging to find the cause.

What gets logged must be intentional. You know the domain, so you know the potential inputs, what's valid, and what's sensitive. That knowledge lets you author a safe context, enough to reproduce the problem without exposing data that shouldn't be in a log. An allowlist of input fields, hashed identifiers, or a reference to a stored payload can carry the input safely. If you don't understand the domain well enough to make that distinction, that's the source of the problem, not the logging infrastructure.

The difference between a useful error and a useless one is whether someone authored the context intentionally or hoped that raw volume would cover it.

## Installed Tooling Reports Mechanics, Not Meaning

Classification and context both come from the code, but some observability really is installed. A platform catches transport failures on its own, like a timeout on an outbound call, and span timings and profilers expose creeping latency without any per-call code. Trace logging, toggled on temporarily for one flow, still diagnoses ordering bugs where the sequence itself is the evidence.

What they can't supply is meaning. They see that a call failed or slowed down, but not whether a rejection was the system working as designed, which fields an error needs, or whether an answer was wrong. Wrong output that never raises an error only surfaces in business-outcome metrics, and those are authored too, because someone has to decide which outcome to count. That's the sense in which observability is authored. The installed part tells you something failed, and only the authored part tells you whether it matters and why.

## The Black Box Test: Diagnose From Outputs Alone

The word observability comes from control theory, where Rudolf Kálmán defined it in 1960. A system is observable when its internal state can be inferred from its external outputs. The practical test applies that definition. When something breaks, can you diagnose it from the system's outputs alone? Or do you need to add logging, redeploy, and wait for it to happen again? If the answer is the latter, your code doesn't explain itself yet.

Software never passes completely, so run the test as a rate. For each recent incident, ask whether the first responder could identify the failing operation, its input, and the cause from existing telemetry. Score it from the timeline rather than memory. An incident fails if anyone added logging before the cause was found, whether by redeploy, a live logpoint, or a trace toggle. That holds even when toggling trace logging was the right move for an ordering bug. The failing share should fall over several quarters. With only a few incidents a quarter, read the trend over a year.

### Attaching a Debugger Hides the Gaps

Classification and context are design decisions, but many developers never test whether their logging actually answers the questions it needs to. One habit that contributes is the debugger. Stepping through code is the right tool for a logic bug in development, but the habit hurts when it becomes the only way surprises get explained. A developer who resolves every local surprise by stepping through code can get little practice diagnosing from outputs, so gaps in those outputs are easy to miss until production.

Some organizations extend this habit into production with remote debugging, but that's a security liability. A debugger attached to a running container, or to any production process, can read its memory, including secrets and customer data. It can also change what it executes, so every open debug port is another way into production.

Snapshot debuggers capture variables without pausing, so they're gentler, and redaction and audit can contain their exposure. But they still keep the habit of reaching into the process instead of fixing what it outputs. You should be observing system outputs, not reading a live process's memory.

Production should be a black box. If your default instinct when something breaks in production is to attach to it rather than read the outputs, you'll rarely feel the pressure to make those outputs useful. The classification stays sloppy, the context stays thin, and the errors stay vague. Not because you don't know better, but because you've never needed better.

Developers who diagnose from observable behavior, whether testing locally against containerized dependencies or against remote systems, tend to build the discipline. They feel the pain of vague errors and missing context firsthand, and they fix it at the source because they have no easier option.

### Owners Who Get Paged Close the Gaps

That discipline holds best when builders own what they operate. You don't log payment declines as errors when you're the one who gets paged for "high error rate on payment service." You don't dump verbose logs instead of authoring context when you're the one parsing them at 3 AM.

Paging pressure only fixes code when it reaches the code. A paged team can just as easily raise thresholds or mute alerts. What can turn the pain into a source fix is bringing the authors into incident diagnosis and filing every misclassified outcome or context-free error found there as a bug against the owning team.

Tracking open telemetry bugs per owning team, beside the black box test's failing share, gives each team a number that backlog triage can see. Filing against the owning team matters most when the author sits on another team, because that author would otherwise never feel what their classification and context choices cause downstream.

Better tooling alone won't make your code explain itself. Running the black box test against it, and filing what it finds against the code that caused it, is how it starts to.
