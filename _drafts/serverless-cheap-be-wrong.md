---
layout: post
title: "Serverless Is Cheap to Be Wrong With"
description: "Serverless bills for the work that happened, not the capacity you predicted, so a wrong guess about load or usage costs almost nothing. That insurance is worth most while load is unknown and is overpriced once load is known and steady, and leaving stays cheap only if the business logic lives in code rather than in the platform's glue."
tags: [architecture, serverless, aws-lambda, cloud-costs, decision-making]
author: steven-stuart
sources:
  - title: "Jonas et al.: Cloud Programming Simplified: A Berkeley View on Serverless Computing (2019)"
    url: "https://arxiv.org/abs/1902.03383"
  - title: "Adzic and Chatley: Serverless Computing: Economic and Architectural Impact (ESEC/FSE 2017)"
    url: "https://www.doc.ic.ac.uk/~rbc/papers/fse-serverless-17.pdf"
  - title: "Eismann et al.: Serverless Applications: Why, When, and How? (IEEE Software, 2021)"
    url: "https://joelscheuner.com/publication/eismann-21-ieeesw/eismann-21-ieeesw.pdf"
  - title: "AWS Lambda pricing"
    url: "https://aws.amazon.com/lambda/pricing/"
  - title: "AWS Fargate pricing"
    url: "https://aws.amazon.com/fargate/pricing/"
  - title: "AWS Lambda Developer Guide: Understanding Lambda function scaling"
    url: "https://docs.aws.amazon.com/lambda/latest/dg/lambda-concurrency.html"
  - title: "AWS Lambda for System Architects"
    url: "/study-guides/infrastructure/aws/aws-lambda-fundamentals.html"
  - title: "Total Cost of Ownership (TCO)"
    url: "/study-guides/architecture/total-cost-of-ownership.html"
  - title: "When Someone Else's Problem Becomes Your Solution (Kubernetes to ECS Fargate case study)"
    url: "/case-studies/kubernetes-to-ecs-migration.html"
  - title: "Marcin Kolny: Scaling up the Prime Video audio/video monitoring service and reducing costs by 90% (Prime Video Tech, 2023, archived)"
    url: "https://web.archive.org/web/2023/https://www.primevideotech.com/video-streaming/scaling-up-the-prime-video-audio-video-monitoring-service-and-reducing-costs-by-90"
---

Serverless isn't cheap to run. It's cheap to be wrong with.

The usual argument about serverless cost compares unit prices, and each side can win it. The Berkeley paper "Cloud Programming Simplified" (Jonas et al., 2019) lists the objection as a fallacy. A Lambda function with the memory of a t3.nano instance "costs 7.5x as much per minute," so serverless looks expensive. The paper's reply is that the price includes scaling, redundancy, and monitoring, and that nothing is charged when nothing runs. Both statements are true, so the comparison settles nothing.

I think the comparison is the wrong frame. Serverless bills for the work that actually happened instead of the capacity someone predicted, so a wrong prediction about load, or about which features anyone uses, costs almost nothing. That insurance is worth most during discovery, while the load is unknown. Once the load is known and steady, the insurance usually costs more than it saves, and the exit stays cheap only if the business logic lives in code rather than in the platform's glue.

> **AUTHOR** — the author's experience goes here: the first Lambda-based APIs at a banking platform, and what made them cheap to start and easy for other teams to copy.

## You Pay for What Happened, Not What You Predicted

### Idle Time Is Free

Every server-shaped deployment starts with a guess. Someone decides how many instances to run, how large, and how much headroom to keep for a spike, and the bill follows the guess whether or not the traffic arrives. The Berkeley paper names what Lambda changed. It "charged the customer for the time their code was actually executing, not for the resources reserved to execute their program."

Gojko Adzic and Robert Chatley put it more bluntly in "Serverless Computing: Economic and Architectural Impact" (ESEC/FSE 2017). Billing only while events are processed "in effect, means that application idle time is free." Their example is a 200-millisecond task that runs every five minutes. On servers it needs a dedicated instance and a failover instance, both paid for around the clock. On Lambda it's billed for 200 milliseconds out of every 300 seconds, a reduction of more than 99.8% in their 2017 comparison.

### The Savings Studies Measured Idle Capacity

The paper's two case studies show where the savings came from. MindMup, an online mind-mapping app, moved from Heroku to Lambda in 2016. Over the following year its active users grew by about 50% while hosting costs fell by nearly half, which the authors count as savings of about 66%. Yubl, a social network, faced traffic spikes of up to 70 times normal usage. Its autoscaling took about 15 minutes to add capacity, so it set scaling to trigger at around 50% CPU and ran with a lot of idle headroom. After most of its backend moved to Lambda, the team estimated its operating cost had fallen by more than 95% for comparable compute.

Neither company got cheaper compute. Each stopped paying for capacity it had reserved against a guess, whether a failover instance for a rarely used exporter or headroom for a spike that might come.

A wider study finds the same pattern. Simon Eismann and colleagues, in "Serverless Applications: Why, When, and How?" (IEEE Software, 2021), analyzed 89 serverless applications, which they called the most extensive study to date. Of the 62 whose motivation they could determine, 47% chose serverless to save costs, and the authors tie that to load shape. The pay-per-use model saves money "for irregular or bursty workloads, which would have low resource utilization and thus higher cost with traditional hosting options," and 84% of the applications they studied had bursty workloads.

So teams do choose serverless for cost, and it does pay off, but it pays off on idle time. The cost savings and the insurance come from the same mechanism. Serverless is cheap to run when you would have guessed the capacity wrong.

## A Wrong Guess Costs Almost Nothing

### Wrong About Load

Early in a product's life, nobody knows the load. A new API might see a thousand requests a day or a million. A reserved deployment has to be sized for one of those guesses, and each wrong guess costs something. Guess low and the system falls over during the launch. Guess high and the team pays for idle machines until someone notices.

On per-invocation billing, both errors shrink. A feature nobody uses costs a few cents a month, and one that takes off scales without a capacity plan, up to the account's concurrency quota. The team learns the real load by watching it, not by paying for a forecast.

### Wrong About Which Features Matter

The same billing changes how cheap it is to try things. Adzic and Chatley describe two effects. Reserved capacity rewards bundling, so rarely used tasks get packed into one deployment to share a server, and then a bug in one exporter can crash all of them. Per-invocation billing "removes the economic benefit of creating a single service package," so each piece can be deployed, scaled, and removed on its own.

Experiments get cheaper too. On servers, running two versions of a payment service costs twice the hosting. On Lambda, 10,000 requests to one version cost the same as 5,000 requests to each of two versions, which "removes the financial downside of deploying and operating experimental versions."

Discovery is the phase when the plan should be allowed to change, and these are the costs that normally stop it from changing. Serverless makes a wrong guess about load, features, or versions cheap to find out about and cheap to drop.

## Once the Load Is Known, the Insurance Is Overpriced

### The Crossover Is a Request Rate You Can Compute

Insurance pays off while the risk exists. Once a service's traffic graph has been flat for months, the risk it covered is gone, and per-invocation pricing becomes a premium on a known load.

Consider a hypothetical API handler that runs at 512 MB and takes 100 ms per request. At the US East prices on AWS's Lambda and Fargate pricing pages, Lambda charges $0.0000166667 per GB-second of duration and $0.20 per million requests, which comes to about $1.03 per million requests. The same work on AWS Fargate can run as two always-on tasks for redundancy, each with 1 vCPU and 2 GB, at Fargate's per-second rates. That's about $0.049 per task-hour, or about $72 a month for the pair, whatever the traffic. If each request uses about 10 ms of CPU, those two tasks can handle 100 requests per second at about 50% utilization.

| Steady load | Lambda per month | Two Fargate tasks per month |
| --- | --- | --- |
| 1 request per second | About $3 | About $72 |
| 10 requests per second | About $27 | About $72 |
| 27 requests per second | About $72 | About $72 |
| 60 requests per second | About $163 | About $72 |
| 100 requests per second | About $272 | About $72 |

The comparison leaves out the front door, logs, and the free tier. An API Gateway front end adds a per-request charge that grows with traffic, while a load balancer in front of the containers adds an hourly charge plus usage, so at steady load the front door tends to widen the gap rather than close it.

The numbers are illustrative, but the shape isn't. Below a request rate you can compute for your own functions, per-invocation billing wins by a wide margin. Above it, the premium grows with every request.

### Waiting Is Billed Too

The crossover arrives sooner than a CPU comparison suggests, because Lambda bills for waiting. Its pricing page says duration "is calculated from the time your code begins executing until it returns or otherwise terminates." A handler that spends 90 ms of its 100 waiting on a database is billed for all 100.

A container can use that waiting time. While one request waits on the database, the same process serves others. A standard Lambda execution environment can't, because Lambda "provisions a separate instance of your execution environment" for each concurrent request, and while an environment handles one request it "is busy and cannot process other requests." In the example above, each request holds 512 MB of Lambda for its full 100 ms, but uses only 10 ms of a container's CPU. The more of a handler's time goes to waiting on I/O, the lower the crossover.

For CPU-bound work the gap is smaller but still there. At 1,769 MB, where the site's Lambda guide notes a function gets the equivalent of one full vCPU, an hour of busy Lambda time costs about $0.104. An hour of a 1 vCPU, 2 GB Fargate task costs about $0.049, so the container wins whenever it's busy more than about half the time.

### AWS Sells Its Own Exit

The Berkeley paper predicted that billing models would evolve so that "almost any application, running at almost any scale, will cost no more and perhaps much less with serverless computing." Billing did evolve, but toward servers. AWS now offers Lambda Managed Instances, where functions run on EC2 instances it manages and the price is the instances plus a management fee rather than per-request duration. AWS's pricing page says the option is "ideal for steady-state, high-volume workloads where you want to optimize costs."

The provider's own answer to steady load is to bring back reserved capacity. That's a fair price for a known load, and it confirms that per-invocation billing is the premium for not knowing it.

### Operations Time Can Still Justify the Premium

The table also leaves out people's time, and that's the strongest case for staying. In the Eismann study, 34% of the applications chose serverless so developers no longer had to handle deployment, scaling, or monitoring, and that benefit doesn't expire when the load becomes known. The site's Total Cost of Ownership guide treats staffing as the input most likely to change a ranking. A team with no container platform, no one who wants to own scaling policies, and a gap of about $90 a month, as at 60 requests per second in the table, may be right to keep paying.

That operations cost depends on what replaces serverless, though. In the site's Kubernetes-to-ECS case study, architect time on infrastructure operations fell to near zero after the move to Fargate, so a managed container service doesn't have to bring the operations burden back. Compare serverless with the cheapest platform your team could run without new operations work, not with a cluster.

## Prime Video Left at the Right Time

### Read for Timing, It Shows Discovery Working

In March 2023, Marcin Kolny of Prime Video's Video Quality Analysis team published "Scaling up the Prime Video audio/video monitoring service and reducing costs by 90%." The team had built a stream-monitoring tool from AWS Step Functions and Lambda, moved it into a single process on Amazon ECS, and cut infrastructure cost by over 90%. The post was widely read as a verdict on serverless, and it has since been taken down from Prime Video's site, though archived copies remain.

Read for when it happened rather than why, the post describes a guess that paid off and then expired. The team says the serverless design "was a good choice for building the service quickly," and that the tool was never "intended nor designed" to run at high scale. Then the load became known. The target was thousands of concurrent streams, and the design hit "a hard scaling limit at around 5% of the expected load." Step Functions performed "multiple state transitions for every second of the stream" and charged per transition, and passing video frames between components through S3 made the request charges expensive. That's continuous, high-volume work with a known target, the load shape where per-invocation pricing is overpriced.

### The Reversal Was Cheap Because the Components Survived

The post also shows why leaving didn't cost a rewrite. "Conceptually, the high-level architecture remained the same," with the same media conversion, detectors, and orchestration as before, which "allowed us to reuse a lot of code and quickly migrate to a new architecture." The expensive parts were the glue between components, and the team replaced it with in-memory calls. Its own conclusion is that serverless and microservices "are tools that do work at high scale," and that choosing them "has to be made on a case-by-case basis."

The service didn't fail on serverless. It used serverless while it was small and its scale was a plan, and left once the load was a number.

The move tested the easier exit, though. The team left the serverless model but stayed on AWS, trading Step Functions and Lambda for ECS and EC2. It shows that leaving serverless can be cheap, not that leaving a provider is.

## The Exit Is Only Cheap If Your Logic Stays Out of the Glue

### Lock-In Lives in the Platform Services

Serverless being cheap to leave isn't automatic. The Berkeley paper lists stronger vendor lock-in as a pitfall of serverless, because applications "rely upon an ecosystem of proprietary BaaS offerings that lacks standardization." Adzic and Chatley make the same point from the inside. Very little code depends on Lambda itself, but the platform supplies everything from authentication to scaling, and serverless designs encourage clients to talk directly to storage and queues. Moving such an application to another provider "would require a significant rewrite."

The discovery phase that makes serverless valuable is also when logic drifts into the glue. A rule lands in a Step Functions choice state because that's quicker than a deploy, or in an event filter pattern, or in the IAM policy that decides which client may write where. Each of those works, and each one is business logic that only runs on that platform.

### Keep the Decisions in Code

Prime Video could reuse its detectors because the detectors were code, and only the orchestration and the handoffs between components were platform-specific. The same split keeps any serverless design cheap to leave. The handler receives the event, calls ordinary code that makes the business decisions, and returns. Workflow definitions sequence steps and carry no business rules, and event rules route messages without deciding what they mean.

Kept that way, leaving serverless means replacing the glue while the code carries over. Let the rules spread into the glue, and the exit becomes the rewrite the lock-in warnings describe.

## Checking Your Own Functions

For each function or serverless workflow you run:

- Compute its crossover rate. Its cost per request is its memory in GB, times its average duration in seconds, times $0.0000166667, plus $0.0000002. Divide the monthly cost of the smallest redundant container deployment that could handle its peak by that per-request cost, then by about 2.6 million seconds in a month. If its steady request rate has sat above the result for months, you're paying for insurance against a risk that's gone.
- Compare its billed duration with the time it spends waiting on downstream calls, using your traces. The larger the waiting share, the lower the request rate at which a container wins.
- Check whether the load is still unknown. A new product, a feature still being tested, or a spiky or rarely run job is where per-invocation billing earns its price.
- List what would have to be rewritten to run the function's work in a container. Business rules in workflow definitions, event filters, or access policies are the cost of the exit, and each one can move back into code before you need to leave.

Serverless earns its price while you're still guessing. Once the guessing is over, check whether you're still paying for it.
