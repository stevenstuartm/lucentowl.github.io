---
title: "SLOs and Alerting"
layout: guide
category: Observability
subcategory: Monitoring & Observability
description: "Turning 'reliable enough' into a number: SLIs as ratios of good to valid events, choosing SLO targets and windows, error budgets and the policy that spends them, and alerting on burn rate with multiwindow alerts that page only when users are being hurt."
tags: [practical, slos, slis, error-budgets, burn-rate, alerting, reliability]
---

## Why Reliability Needs a Number

Without a target, reliability arguments have no end. Operations wants fewer changes because changes cause outages. Product wants more changes because that is what customers pay for. Each side is right about something, and nothing in the conversation says when the service is reliable enough to ship the next feature.

A hundred percent is the wrong answer. Google's book on site reliability engineering (SRE), the [SRE book](https://sre.google/sre-book/embracing-risk/){:target="_blank" rel="noopener noreferrer"} observes that "a user on a 99% reliable smartphone cannot tell the difference between 99.99% and 99.999% service reliability," while each additional increment of reliability can cost far more than the one before it. Past some point, extra reliability costs money and release speed and gives users nothing they can notice.

A **service level objective** (SLO) settles the argument in advance by stating how reliable the service has to be, measured the way users experience it. This guide builds one for a checkout API, the service that takes a shopping cart and places the order, and then uses it to decide when to page someone.

## SLIs: Measuring What Users Experience

### An SLI Is a Ratio of Good Events to Valid Events

A **service level indicator** (SLI) is the measurement an SLO is set on. The [SRE workbook](https://sre.google/workbook/implementing-slos/){:target="_blank" rel="noopener noreferrer"} generally recommends expressing an SLI as a ratio of good events to total events, and Google's [Art of SLOs handbook](https://sre.google/static/pdf/art-of-slos-handbook-a4.pdf){:target="_blank" rel="noopener noreferrer"} narrows the denominator to valid events:

```text
SLI = good events / valid events
```

Expressed this way, every SLI runs from 0% to 100%, reads the same way, and turns directly into the error budget described below. For checkout, two SLIs cover most of what users care about:

- **Availability:** the proportion of valid checkout requests that don't fail with a server error.
- **Latency:** the proportion of valid checkout requests that complete in under 800 ms.

Events that shouldn't count against the service can be kept out of the budget in two ways, by counting them as good or by excluding them from the valid set. The workbook's own example counts only 5xx server errors as bad, so a request rejected with a 4xx because the client sent a malformed cart counts as good. The handbook notes that validity is usually decided by request attributes such as hostname or path, and the same mechanism can exclude health-check probes and internal test traffic, which say nothing about users.

A latency SLI defined this way is still a ratio. The count of requests under 800 ms comes straight from a latency histogram, as long as one of the histogram's bucket boundaries sits at 800 ms. If the nearest boundaries are 500 ms and 1 s, the metric can't say how many requests fell under 800 ms, so the SLO threshold should be chosen together with the histogram's buckets.

One threshold can hide a slow tail, since 99% of requests could finish in 100 ms while the last 1% take ten seconds and the SLI can't tell. The workbook suggests grading latency with more than one threshold, such as 90% of requests under 100 ms and 99% under 400 ms, each tracked as its own SLO.

### The SLI Menu

Different kinds of systems fail users in different ways, so the workbook suggests starting from the type of system:

| System type | SLI | Good event |
|---|---|---|
| **Request-driven** (APIs, web apps) | Availability | The request succeeded |
| | Latency | The request completed faster than a threshold |
| | Quality | The response was complete, not degraded to a fallback |
| **Pipeline** (batch or streaming processing) | Freshness | The data was updated within a threshold of time |
| | Correctness | A record produced the expected output |
| | Coverage | A record was processed at all |
| **Storage** | Durability | Data that was written can be read back |

The SRE book advises choosing just enough SLOs to cover what users care about, and the workbook suggests keeping to a small number of SLI types, five or fewer. Every extra one is another number to set, alert on, and defend.

### Where to Measure

The workbook separates an SLI's **specification**, which is the user outcome in words ("checkout requests succeed"), from its **implementation**, which is how you count it. The same specification can be implemented at several points, and the Art of SLOs handbook compares five of them. Several of its trade-offs involve **user journeys**, the sequence of requests a user makes to accomplish one thing, such as adding items to a cart and then paying.

| Measured at | Strengths | Weaknesses |
|---|---|---|
| **Processed logs** | Can be backfilled from history, and can reconstruct complex user journeys | Too slow to trigger an operational response |
| **Application server** | Cheap to add, and complex logic can be reduced to "good" and "total" counters in code | Can't see requests that never reach it, and multi-request user journeys are hard to measure from stateless servers |
| **Load balancer** | The metrics usually exist already, and they sit as close to the user as your own infrastructure gets | Not viable for data-processing SLIs or anything needing complex logic |
| **Synthetic clients** | Can measure every step of a multi-request journey, and requests sent from outside your infrastructure cover more of the request path | Only approximate real users, and covering every edge case turns into a large testing project |
| **Client instrumentation** | The most accurate measure of what users experience, and can quantify third parties such as a CDN or payment provider | Too slow to trigger an operational response, includes factors outside your control, and users must consent to the data collection |

The workbook's worked example for an API chooses load balancer metrics, because they already exist and sit closer to the user's experience than application server logs.

## SLOs: Setting the Target

An SLO combines an SLI, a target, and a time window:

```text
99.9% of valid checkout requests succeed, measured over a rolling 30-day window
```

### Rolling and Calendar Windows

| Window | How it behaves | Suited to |
|---|---|---|
| **Rolling** (such as the last 28 days) | Bad events age out one day at a time. A bad day keeps counting against the service until it leaves the window | Operating the service, because it matches how users remember recent reliability |
| **Calendar** (such as each month) | Resets to a full budget on the first of the month | Business planning and project work, which run on calendar periods |

The workbook suggests a four-week rolling window for operating a service, because four weeks always contains the same number of weekends and weekdays, which a calendar month doesn't. This guide uses 30 days in its examples to match the workbook's alerting tables. Over four weeks the numbers shift slightly but the reasoning doesn't.

### What Each Target Allows

Every nine added to a target cuts the room for failure by a factor of ten. The table shows how long a service could be completely down within 30 days at each target:

| Target | Failure allowed in 30 days |
|---|---|
| 99% | 7.2 hours |
| 99.5% | 3.6 hours |
| 99.9% | 43.2 minutes |
| 99.95% | 21.6 minutes |
| 99.99% | 4.3 minutes |

For a request-based SLI, the target limits the share of requests that can fail rather than minutes of downtime, but the scale is the same. At 99.99%, a five-minute total outage uses more than the whole month's budget. At 99.999%, a total outage spends the budget in about 26 seconds. That is faster than any alert and human response, so a target that high can only be defended by design and by rolling changes out gradually to a small share of traffic first, not by alerting.

### Choosing a Target

- **Don't just adopt today's performance.** The SRE book warns against picking a target because it's what the service currently achieves, which can lock the team into a system that needs heroic effort to meet its target and can't improve without significant redesign. The workbook allows starting from current performance when there's no other information to go on, as long as the target is reviewed and adjusted afterward. A target far above what the service can deliver only produces a permanently exhausted budget that everyone learns to ignore.
- **Ask what users and the business need.** A checkout that fails 1 in 1,000 times may be acceptable, while 1 in 100 loses real orders. Nobody can derive this from the metrics alone. It is a product decision.
- **Account for dependencies.** A service can't be more reliable than the things it calls synchronously without retries or fallbacks. If checkout needs both orders and payments to succeed, and each succeeds 99.9% of the time, checkout's ceiling is about 99.8% (0.999 × 0.999).
- **Advertise less than you run to.** The SRE book advises keeping a tighter internal SLO than the one advertised to users, and being conservative in what you advertise. A **service level agreement** (SLA) is a contract with customers that carries consequences, such as service credits, when it's missed, so its target usually sits below the internal SLO and the team reacts before customers are owed anything.
- **Don't beat it by too much for too long.** Users build on the reliability they observe, not the one you document. The SRE book describes how, in any quarter where actual failures hadn't dropped the global instance of Google's Chubby lock service below its target, the team took it down deliberately, so that services depending on it would discover they couldn't tolerate its outages.

### Review and Iterate

A first SLO is a hypothesis about what users will tolerate. The workbook treats targets as something to revisit against other signs of user happiness, such as support tickets and complaints. If users complain while the service is comfortably inside its SLO, the SLI is measuring the wrong thing or the target is too loose. If the SLO is missed and nobody notices, it may be tighter than users need, and the budget it protects is being spent on reliability nobody values.

## Error Budgets

### The Budget Is the Failure the SLO Allows

The **error budget** is one minus the SLO. At 99.9%, checkout may fail 0.1% of valid requests over the window. If checkout serves ten million valid requests in 30 days, the budget is 10,000 failed requests. Each failed request spends some of it. A bad deploy that fails 4,000 requests before rollback spends 40% of the window's budget in minutes.

The budget changes what the reliability argument is about. Instead of debating whether a risky migration is safe, the teams can ask whether there is budget left to absorb it if it goes wrong. The SRE book describes this as giving product development and SRE (the team responsible for running the service reliably) a common incentive to find the right balance between innovation and reliability.

### An Error Budget Policy Decides in Advance

A budget only works if everyone agrees beforehand what happens when it runs out. An **error budget policy** is a short written agreement between product, development, and SRE that states:

- **What happens when the budget is exhausted.** In the workbook's example policy, when the service's own bugs or processes caused the miss, releases other than urgent bug fixes and security fixes stop until the service is back within its SLO over the window.
- **What the team works on meanwhile.** The causes of the recent failures, found through [blameless postmortems](/study-guides/sdlc/devops.html), become the priority.
- **When a postmortem is required.** The workbook's example policy requires one whenever a single incident consumes more than 20% of the budget over four weeks.
- **Who decides disputes and exceptions.** For example, whether an outage caused by a third-party provider counts against the budget.

The policy is agreed while nothing is on fire, which is the point. Negotiating a feature freeze in the middle of an outage, with a launch date looming, rarely goes well. And a policy that nobody enforces turns the SLO back into a dashboard, so the people who can stop a release have to be party to it.

## Alerting on SLOs

An alert can go to one of two places. A **page** interrupts whoever is on call, immediately and at any hour. A **ticket** records a problem for someone to handle within days. Anything that needs no action at all belongs on a dashboard, not in either place.

### Alert on Symptoms, Not Causes

A **symptom** is what users experience, such as checkout requests failing or slowing. A **cause** is why it happens, such as a full disk, CPU at 95%, or a replica down. The SRE book recommends paging on symptoms. A cause-based alert fires whenever the cause appears, including the many times it harms nobody, such as high CPU during a batch job that users never notice. It also misses every cause nobody wrote an alert for. A symptom-based alert fires when users are hurt, whatever the cause.

Causes still belong on dashboards, and in tickets when they predict trouble, such as a disk that will fill in three days. They usually shouldn't wake anyone up, though the SRE book allows paging on causes that are very definite and very imminent, such as a disk that will be full within minutes.

The book also sets a bar for every page. It has to be actionable, it has to need a human's judgment rather than a scripted response, the person receiving it has to be able to react with urgency, and it should be about a problem that hasn't been seen before. People can only react with urgency a few times a day, so every page that fails the bar wears down the response to the pages that pass it.

### How to Judge an Alert

The [SRE workbook](https://sre.google/workbook/alerting-on-slos/){:target="_blank" rel="noopener noreferrer"} measures an alerting rule on four properties:

| Property | Question it answers |
|---|---|
| **Precision** | Of the alerts that fired, how many were about a significant problem? |
| **Recall** | Of the significant problems, how many fired an alert? |
| **Detection time** | How long after the problem starts does the alert fire? |
| **Reset time** | How long after the problem ends does the alert keep firing? |

Improving one tends to cost another, and the alerting rules below are ways to get good scores on all four at once.

### Burn Rate

**Burn rate** is how fast the service is consuming its error budget, relative to the SLO. At a burn rate of 1, the budget runs out exactly at the end of the window. For checkout's 99.9% SLO, an error rate of 0.1% is a burn rate of 1, an error rate of 0.6% is a burn rate of 6, and an error rate of 1.44% is a burn rate of 14.4.

The budget lasts the window divided by the burn rate. At 14.4, a 30-day budget is gone in 30 ÷ 14.4, about 2.1 days, and at 6 it's gone in 5 days. A sustained burn rate below 1 means the service will finish the window inside its SLO. That makes burn rate a better thing to alert on than raw error rate, because it translates directly into how long until the SLO is missed. The same arithmetic works for a latency SLI, where a bad event is a request slower than the threshold.

### Why a Single Threshold Falls Short

The simplest SLO alert fires when the error rate over some window exceeds the SLO's allowance. Its behavior depends almost entirely on the window.

- **A short window, such as 10 minutes**, detects problems fast. But it fires on brief blips that consume a tiny fraction of the budget, so its precision is poor, and a service that blips a few times a day pages a few times a day.
- **A long window, such as 36 hours**, has good precision, because it fires only after a meaningful share of the budget is gone, and a total outage still pushes its average past the threshold within minutes. Its weakness is reset time. After a total outage it can keep firing for up to a day and a half while the bad period ages out of the window, and computing rates over such a long window is expensive.

### Multiwindow, Multi-Burn-Rate Alerts

The workbook's recommended rule combines two ideas. **Multi-burn-rate** means several alerts, each for a different speed of burn, where a fast burn pages and a slow burn opens a ticket. **Multiwindow** means each alert checks the burn rate over a long window and a short window, and fires only when both are over the threshold. The long window ensures enough budget has actually been spent to matter. The short window ensures the problem is still happening, so the alert stops soon after the fix.

For a 99.9% SLO over 30 days, the workbook recommends:

| Budget consumed | Long window | Short window | Burn rate | Action |
|---|---|---|---|---|
| 2% | 1 hour | 5 minutes | 14.4 | Page |
| 5% | 6 hours | 30 minutes | 6 | Page |
| 10% | 3 days | 6 hours | 1 | Ticket |

The burn rates come from the budget consumed. Spending 2% of a 30-day (720-hour) budget in one hour is a burn rate of 0.02 × 720 = 14.4. The short window is a twelfth of the long one. The table also shows why very loose targets need different rules. At a 90% SLO, a burn rate of 14.4 would mean 144% of requests failing, so the first page could never fire.

Picture checkout during a bad deploy. From minute 10 to minute 40, 5% of requests fail, and at minute 40 the fix is deployed. The 1-hour window's error rate crosses the 14.4 threshold (1.44% errors) at about minute 27. On its own, it would keep firing until about minute 83, because the bad half hour takes a full hour to age out of the window. The 5-minute window drops below the threshold by about minute 44, and because the alert needs both windows over the threshold, it stops there too.

{% include figure.html id="obs-multiwindow-alert" %}

### Low-Traffic Services

Burn rate alerts assume enough requests for a percentage to mean something. A service that handles ten requests an hour turns one failure into a 10% error rate and a page. The workbook suggests several remedies, used together where needed:

- **Generate artificial traffic**, so there are enough events to measure.
- **Combine small services** into a larger service for monitoring purposes, so their requests add up to a meaningful rate.
- **Change the service or its clients** so one failure harms fewer users, such as retrying with backoff or adding a fallback path.
- **Lower the SLO**, which enlarges the budget so one failure burns a smaller share of it, **or lengthen the alerting window**, so each failure is averaged over more requests.

### Every Page Needs a Runbook

Each page should link to a runbook, a short document saying what the alert means, what to check first, and how to mitigate it, so whoever is on call starts from the same knowledge as the person who wrote the alert.

## Key Takeaways

- **Pick a number short of 100%.** Users can't perceive reliability beyond what their own devices and networks deliver, and each extra nine costs more than the last.
- **Define SLIs as good events over valid events.** Measure them where they capture what users experience, grade latency with more than one threshold, and put a histogram bucket boundary at each one.
- **Set targets by what users need, then iterate.** Stay below what your synchronous dependencies can deliver together, advertise less than you run to, and revisit targets against user complaints.
- **Agree on an error budget policy before you need it.** The budget turns "is it reliable enough?" into "how much can we still afford to fail?"
- **Page on symptoms, and on burn rate.** Multiwindow, multi-burn-rate alerts page quickly for fast burns, open tickets for slow ones, and stop firing soon after the fix.
- **Every page needs a human and a runbook.** Anything that only needs a scripted response or no response at all doesn't belong in a page.
