---
layout: post
title: "Why the Fastest Incident Responders Slow Down First"
date: 2025-11-08
description: "Reproduction is the fulcrum of effective troubleshooting, because without it you're guessing about the problem and guessing about the fix. The fastest path to a proven fix restores service first, then gathers facts, tests assumptions, and proves causation, and teams practice that discipline before the incident so it's there when they need it."
tags: [incident-response, production, debugging, troubleshooting]
author: steven-stuart
sources:
  - title: "Google, Site Reliability Engineering, Chapter 1: Introduction"
    url: "https://sre.google/sre-book/introduction/"
---

I've watched engineers spin for hours during production incidents, not because they lack technical skill, but because they skip fundamentals under pressure. Something is broken, the pressure is on, and the instinct is to act immediately. But fixing on incomplete information wastes more time than gathering facts would have taken.

Most troubleshooting failures aren't from lack of effort. Engineers work hard during incidents. The failures come from investigating without reproduction, treating assumptions as facts, fixing symptoms instead of causes, and changing multiple things simultaneously. These mistakes extend outages, create incomplete fixes, and leave you likely to fight the same incident again.

Time to restore service isn't the clock that matters here, since a rollback or restart shouldn't wait for understanding. The clock that matters runs from "the alerts stopped" to "we know why it failed and the fix is proven." A guessed fix that turns out wrong doesn't save time on that clock. It adds a full round trip of shipping, waiting, and recurring, only to learn that one hypothesis was wrong.

<blockquote class="pull-quote">
<p>The teams that reach a proven fix fastest tend to be the ones disciplined enough to slow down and understand what they're fixing.</p>
</blockquote>

Whether you're investigating alone at 2 AM or coordinating a war room with twenty people, the principles are the same.

## Gather Facts, Not Interpretations

Facts are observable and measurable:
- Exact wording of error messages
- Precise timestamps with time zones
- Specific metric values showing deviation
- What changed recently (deployments, configuration, infrastructure, dependencies)

When someone says "the database is slow" or "the network is flaky" or "the deployment broke something," they're offering conclusions, not observations. These interpretations might be correct, but they skip the actual observation that leads to understanding.

"The database is slow" tells you nothing actionable. You need to know what "slow" actually means. Is query execution time up? Is CPU saturated? Are there lock waits? Each observation leads to different investigations.

Start with these questions:
- **When did it start?** Exact time, gradual or sudden onset
- **What is the scope?** All users, specific regions, particular features, certain request types
- **What are the symptoms?** Error rates, latency percentiles, specific failures, resource consumption
- **What changed?** Deployments, configuration updates, traffic pattern shifts, dependency changes

Consider an API latency spike from 100ms to 2000ms. The facts reveal a pattern:
- Spike started at 14:47 UTC (sudden onset)
- Only read-heavy endpoints affected
- Database CPU at 95%, query execution times 20x normal
- Database maintenance window started at 14:45 UTC

Now you have an interpretation you can test: database maintenance degraded read performance. Check what the maintenance window did and verify query performance. If a second story also fits, such as a traffic shift in the same minute, rerun the maintenance job against a replica under read load to separate them.

During active incidents, capture artifacts immediately, because much of the evidence disappears the moment a restart or rollback restores service:
- Thread dumps or process snapshots showing current state
- Detailed logs with correlation IDs linking related events
- Metrics from before, during, and after the issue
- Network traces showing request and response timing
- Resource utilization across the relevant systems

These become invaluable when you're trying to understand timing-dependent issues or correlate events across distributed systems.

## Test Assumptions, Don't Trust Them

Every incident reveals assumptions you didn't know you were making. Under pressure, untested assumptions become expensive mistakes.

"The deployment succeeded" (but did health checks pass?), "The service is healthy" (but is it actually responding correctly?), "The cache is working" (but what's the hit rate?). Every incident surfaces assumptions about what "succeeded" or "healthy" or "working" actually means.

The most dangerous assumption is "the recent change was unrelated." Google's Site Reliability Engineering book reports that roughly 70% of Google's outages are due to changes in a live system, so dismissing the most recent change means dismissing a likely suspect. Correlation matters even when causation isn't obvious. Seemingly unrelated changes can have unexpected interactions. A configuration change in one system can affect dependencies in non-obvious ways. A deployment that touched "just the frontend" can expose race conditions in backend services.

Build verification into your communication. Transform assumptive questions into verifiable ones:
- Instead of "Is the service up?" → "Show me a successful request through the service right now"
- Instead of "Did the deployment finish?" → "What version is running in production, and how did you verify it?"
- Instead of "Are we getting traffic?" → "What's the current request rate compared to baseline?"

I've seen this pattern repeatedly: service returns 200 status codes, but users report errors. Everyone assumes "200 means success," then someone tests the assumption and discovers the application catches exceptions, logs them, and returns 200 with an error payload. The response body contains error messages, not successful data. The team was looking at the wrong signal the entire time.

## Reproduction: The Fulcrum of Investigation

When the evidence alone can't settle the cause, almost no investigation finishes without reproduction. Miss this point and you could spend days searching for what you could have targeted in the first hour.

Some causes prove themselves. An expired certificate, a full disk, or a config value that's plainly wrong in the diff needs no reproduction, because the evidence already rules out every other explanation. So does a subtler cause when a trace or core dump shows the mechanism step by step. Reproduction is for the cases where the evidence fits more than one story and the telemetry can't tell them apart. The richer your per-request tracing, the fewer of those cases there are, because slicing the traces can separate many stories more cheaply.

For the cases that remain, reproducing is usually cheaper than a string of fixes that each wait for the next occurrence to be judged. Time-box the reproduction against that guess-and-wait alternative. If it hasn't produced even a partial symptom in about the time another cycle would take, stop. Instrument the system so the next occurrence settles the question.

If you can trigger the issue deliberately, you know the conditions that cause it. You understand not just that something broke, but why it breaks. Without that understanding, you're guessing about the problem and about whether your fix actually works.

<blockquote class="pull-quote">
<p>Without reproduction, you're guessing about the problem and guessing about the fix.</p>
</blockquote>

Consider the typical pattern: users report intermittent login failures, you check logs, see authentication errors, and update the session configuration. The errors stop. Did you fix it? Maybe the config helped, maybe the issue stopped on its own, maybe it's happening less frequently but you're not seeing it. You have no way to know, which means the next time it happens you start from zero again.

Compare that to actually reproducing the issue. Timestamps show every failure lining up with gaps in the session store's health metrics, and stopping the session store in a test environment produces the same errors with the same signature. Now you know what's happening. After your fix, stopping the session store no longer causes failures because you added failover logic. You proved the fix works. That proof covers the resilience fix. Why the store had gaps is a separate investigation, with its own reproduction.

None of this means users wait while you build a reproduction. If a rollback, failover, or restart will stop the damage, capture the artifacts and then take it. But mitigation doesn't explain anything. A rollback that stops the errors tells you which change to look at, not what in it broke.

### How to Reproduce

Start with the simplest reproduction path:
1. Can you trigger it in your local environment?
2. Can you recreate it in a test environment with production-like configuration?
3. Can you safely reproduce it in production under controlled conditions?

The key is isolating variables systematically:
- Test one factor at a time
- Control for data volume, timing, concurrent operations
- Document the exact sequence that triggers the issue

When you can't reproduce locally:
- Identify what's different (data scale, network topology, configuration, timing)
- Increase observability to capture detailed state when the issue occurs
- Use feature flags or canary deployments to test hypotheses in production safely

Consider an application that crashes under high load, where you suspect a race condition in request handling. Without reproduction, you modify the locking logic, deploy, and hope load testing catches any issues. With reproduction, you have a test case that consistently triggers the race condition. After your fix, the test passes. You know it works before it touches production.

The reproduction test case you built during the incident doesn't end when the incident ends. Turn it into an automated test. Not every issue can be captured this way, since some depend on production scale or specific environmental conditions. But when you can automate the reproduction, you've built permanent protection. The problem that took hours to diagnose now fails a test in seconds if someone reintroduces it.

### Common Reproduction Mistakes

The most common mistake is assuming intermittent means irreproducible. Intermittent issues have conditions that trigger them. You just haven't identified the conditions yet. The issue might occur when specific events happen in a certain sequence, or when timing aligns in particular ways, or when resource thresholds are crossed. Calling it "intermittent" and moving on skips the investigation. Sometimes the conditions cost too much to recreate, such as a hardware fault or a timing window that only opens at production scale. Then the fallback is instrumenting so the next occurrence records the conditions, which is still investigating rather than moving on.

Another pattern: stopping investigation once you find correlation. Correlation shows you where to look; reproduction proves causation. Just because deployments happen before errors doesn't mean deployments cause errors. Reproduce the issue by deploying the suspect change to a test environment, or to a small canary you can pull back instantly, to prove the connection. If the test deployment doesn't produce the errors, that doesn't clear the change until the environment matches the trigger conditions.

Then there's declaring victory too early. The issue hasn't recurred in an hour, so you close the incident, and it happens again the next day. Absence of the problem isn't proof you fixed it. Reproduction before and after the fix is the strongest evidence you can get. But it proves the fix only if production evidence shows the reproduced condition was actually present.

<blockquote class="pull-quote">
<p>Correlation shows you where to look; reproduction proves causation.</p>
</blockquote>

## Change One Thing at a Time

Changing multiple variables simultaneously destroys your ability to understand what worked.

The discipline:
1. Change one variable
2. Observe the result
3. Document the outcome
4. Repeat

This feels slow, but it's faster than changing everything and having no idea what mattered.

When each test cycle takes half an hour and there are eight suspects, one at a time means up to eight cycles. Bisecting in a test environment, or behind reversible flags, keeps the discipline at lower cost. Apply half the candidates, see whether the symptom moves, and halve again. Each cycle still isolates one variable (which half holds the cause), so three cycles find the culprit among eight. If neither half moves the symptom, suspect an interaction between candidates, and remove factors one at a time from the full set instead.

If simultaneous changes work, you don't know which change mattered. Did all three contribute, or was it just one? You'll never know, which means you've now committed to maintaining all three changes even though some might be irrelevant or even slightly harmful.

If it fails, you don't know which change made it worse. You can't roll back precisely. You have to revert everything and start over, losing whatever progress you might have made.

Legitimate exceptions exist:
- **Rolling back a deployment**: Reverting multiple coupled changes as a unit makes sense because they were deployed together
- **Emergency mitigation**: Immediate actions to restore service (like increasing resources) can happen together if they're all clearly mitigation, not fixes
- **Coupled changes**: Configuration that requires corresponding code changes should be deployed together

## Fix the Cause, Not the Symptom

Stopping at the first visible problem leaves the root cause unaddressed, which means you'll fight the same incident again.

Understand the layers:
- **Symptom**: What you observe is broken
- **Surface cause**: The immediate technical reason for the symptom
- **Root cause**: Why the surface cause happened

Service returns 500 errors (symptom). Database connection pool exhausted (surface cause). Connection leak in error-handling code path (root cause).

Fixing the symptom means restarting the service. It restores service temporarily. Fixing the surface cause means increasing pool size. It delays the inevitable. Fixing the root cause means patching the connection leak. It prevents recurrence. Where to stop asking why is a choice, so stop at the deepest cause the team can actually change.

Not every failure has one root cause. A load spike, a retry storm, and an undersized pool might each be harmless alone and fail only together. The same discipline still applies. Reproducing the failure means reproducing the combination, and removing one factor at a time shows which ones the fix has to address.

The real fix emerges when the answers to "why" start showing a pattern. If the answer is "exception in cleanup code path," and the last few incidents traced back to the same mechanism in other error paths, the fix isn't just patching that one path. It's recognizing that error-handling code paths lack test coverage across the system. The fix becomes adding tests for error scenarios and reviewing exception handling patterns throughout the codebase. That's how you prevent the next instance of this class of problem.

Distinguish mitigation from fix:

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Mitigation (restores service quickly)</h4>
<ul>
<li>Restart the service</li>
<li>Route traffic around failing component</li>
<li>Increase resource limits</li>
<li>Roll back the deployment</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Fix (prevents recurrence)</h4>
<ul>
<li>Address root cause</li>
<li>Turn the reproduction into a regression test</li>
<li>Improve test coverage for the whole class of failure</li>
</ul>
</div>
</div>

Both have value, but don't confuse them. Document the chain clearly:
- What we did to restore service (mitigation)
- What we're doing to prevent recurrence (fix)
- What we're adding to detect it earlier next time (observability)

## War Rooms: Applying Principles Under Coordination Pressure

The principles don't change in a war room, but more people means more changes in flight at once, and parallel, unannounced changes are how a war room loses the ability to prove which one worked.

### Assign Roles Before the First Hypothesis

Establish clear roles upfront:
- **Incident Commander**: Coordinates response, makes final decisions, owns communication to leadership
- **Subject Matter Experts**: Investigate specific systems (database, network, application, infrastructure)
- **Scribe**: Documents timeline, actions taken, hypotheses tested, decisions made
- **Communications Lead**: Updates stakeholders, manages customer communication

Without role clarity, you get duplicate work, missed actions, and no record of what's been tried. The scribe role seems like a luxury, but it becomes critical when you need to reconstruct what happened.

<div class="callout callout--warning">
<p class="callout__title">Red Flags</p>
<ul>
<li>Multiple people issuing commands simultaneously</li>
<li>No one writing down what's being tried</li>
<li>Same hypothesis tested multiple times by different people</li>
<li>Unclear who has authority to make rollback decisions</li>
</ul>
</div>

Apply the troubleshooting principles collectively through clear communication standards:
- For reproduction: "Can anyone reproduce this issue? If yes, document exactly how. If no, and the evidence doesn't already settle it, that's our first priority once service is restored."
- For facts versus interpretations: "The database is slow" is an interpretation; "Database query time is 2000ms, baseline is 100ms" is a fact.
- For testing assumptions: when someone says "the service is healthy," the incident commander asks "Show me a successful request."

The incident commander explicitly approves changes. Mitigation that stops user harm proceeds and is logged with a timestamp, so investigators can account for it. Investigative changes go one at a time per symptom. Before implementing a fix, confirm the root cause has been reproduced, or that the evidence for it is stated, not just that the team agrees on it.

### Hero Mentality Keeps Understanding in One Head

Hero mentality in war rooms creates single points of failure and prevents knowledge sharing.

<div class="comparison">
<div class="content-card content-card--accent-warning">
<h4>Hero Mentality</h4>
<ul>
<li>"I'll handle this alone; everyone else stay out"</li>
<li>Making changes without communicating what or why</li>
<li>Refusing to hand off when fatigued because "only I understand this"</li>
</ul>
<p><strong>Why this fails:</strong> One person can't sustain extended incident response. When heroes fix things alone, understanding doesn't spread. Fatigue increases error rates. If the hero is unavailable next time, the team starts from zero.</p>
</div>
<div class="content-card content-card--accent">
<h4>Collaborative Alternative</h4>
<ul>
<li>Explain your reasoning as you investigate</li>
<li>Ask for input before making significant changes</li>
<li>Hand off to fresh teammates when fatigued</li>
<li>Document decisions so others can understand and continue</li>
</ul>
</div>
</div>

Celebrate collaborative wins, not individual heroics. Value knowledge transfer as highly as problem resolution.

## Practice the Discipline Before You Need It

Reproduction, fact-gathering, testing assumptions, changing one variable at a time, and fixing causes instead of symptoms are all disciplines that feel slow when you're fighting a production fire. Practicing them when nothing is on fire makes them more likely to hold when something is.

Build reproduction into your development workflow. When you encounter bugs during development, practice reproducing them systematically before fixing them. When reviewing incidents, ask whether reproduction was achieved and what it revealed. When onboarding new team members, demonstrate these principles explicitly rather than assuming they'll absorb them through osmosis.

In war rooms, establish roles and communication standards before the incident starts. Run practice scenarios where teams respond to simulated incidents. Identify hero mentality early and redirect it toward collaborative investigation.

The discipline feels unnatural at first because pressure creates the urge to act immediately. But once you've experienced the difference between guessing at fixes and proving them through reproduction, between correlation and causation, between symptoms and root causes, the fundamentals become non-negotiable.
