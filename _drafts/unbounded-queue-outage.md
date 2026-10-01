---
layout: post
title: "An Unbounded Queue Is an Outage on a Delay"
description: "Under sustained overload, a queue with no time limit fills with work whose callers have already given up, and the system spends its recovery processing it. The bound that matters is age, not length: each message's maximum age should come from the deadline of whoever is waiting for the result, and anything older should be dropped or set aside behind fresh work."
tags: [architecture, distributed-systems, reliability, messaging, queues]
author: steven-stuart
sources:
  - title: "Fred Hébert: Queues Don't Fix Overload (2014)"
    url: "https://ferd.ca/queues-don-t-fix-overload.html"
  - title: "David Yanacek: Avoiding insurmountable queue backlogs (Amazon Builders' Library)"
    url: "https://aws.amazon.com/builders-library/avoiding-insurmountable-queue-backlogs/"
  - title: "Site Reliability Engineering: Addressing Cascading Failures"
    url: "https://sre.google/sre-book/addressing-cascading-failures/"
  - title: "Ben Maurer: Fail at Scale (ACM Queue, 2015)"
    url: "https://queue.acm.org/detail.cfm?id=2839461"
  - title: "Microsoft Learn: Azure Service Bus message expiration and time to live"
    url: "https://learn.microsoft.com/en-us/azure/service-bus-messaging/message-expiration"
  - title: "RabbitMQ: Time-to-Live and Expiration"
    url: "https://www.rabbitmq.com/docs/ttl"
  - title: "Amazon SQS message quotas"
    url: "https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/quotas-messages.html"
  - title: "AWS Lambda: Configuring error handling for asynchronous invocations"
    url: "https://docs.aws.amazon.com/lambda/latest/dg/invocation-async-configuring.html"
  - title: "Microsoft Learn: BoundedChannelFullMode Enum"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.threading.channels.boundedchannelfullmode"
---

Your queue didn't absorb the overload. It scheduled it for later. When work arrives faster than consumers can finish it, and keeps arriving that way, a queue with no limit doesn't protect anything. It stores the excess, and when the consumers finally reach it, the people who asked for that work have usually stopped waiting.

The overload half of this argument isn't mine. Fred Hébert made it in "Queues Don't Fix Overload" (2014), and David Yanacek made it with Amazon's numbers in the Amazon Builders' Library article "Avoiding insurmountable queue backlogs." What I want to add is where the limit should come from. The bound that matters for a queue is age, not length, and the right age isn't a tuning parameter. It comes from the deadline of whoever is waiting for the result. Past that age a message is waste, so the consumer should drop it, or set it aside behind fresh work if someone still needs it eventually, rather than process it in turn.

## A Queue Only Absorbs Bursts

### Sustained Overload Leaves Two Honest Options

A queue smooths the difference between arrival rate and processing rate over time. If a burst arrives and then subsides, the queue holds the extra work until consumers catch up, and nothing is lost.

Sustained overload is different, because there's nothing to catch up to. Hébert's point is that every system has a bottleneck somewhere, such as a database, a downstream API, or disk I/O, and once arrivals exceed it, a queue in front of it only changes when the failure shows up. "When people blindly apply a queue as a buffer, all they're doing is creating a bigger buffer to accumulate data that is in-flight, only to lose it sooner or later." He leaves two honest options. "You'll have to pick between blocking on input (back-pressure), or dropping data on the floor (load-shedding)." An unbounded queue picks neither. It accepts everything and promises nothing about when.

### Recovery Takes as Long Again as the Overload

Yanacek describes the result as bimodal. With no backlog, a queue-based system is in a fast mode with low latency. Once "the arrival rate exceeds the processing rate, it quickly flips into a more sinister operating mode," where "end-to-end latency grows higher and higher," and returning to the fast mode means working through everything that piled up.

After an hour-long outage in processing, "recovering from the outage requires double the system's capacity for another hour after the recovery," regardless of the rates involved. In his multitenant example, one customer's unthrottled spike goes unnoticed for about 30 minutes while producers queue 10 times what consumers were scaled for. Working through that takes 300 minutes. "Even short load spikes can result in multi-hour recovery times, and therefore cause multi-hour outages." Autoscaling helps, but Yanacek notes that the systems a consumer calls "might not be prepared to handle a huge increase in processing" while it drains, and then catching up takes longer still.

## The Backlog Is Full of Work Nobody Is Waiting For

### Callers Give Up on Their Own Clock

A backlog would only be slow if every message still mattered when its turn came. Most don't, because the caller that caused each message has its own timeout, and that timeout doesn't pause while the message waits.

Google's SRE book describes this for RPC servers in its chapter on addressing cascading failures. A client sets a 10-second deadline, and the overloaded server takes 11 seconds to move the request "from a queue to a thread pool." By then "the client has already given up on the request," and any work the server does "would be doing work for which no credit will be granted." The chapter puts it plainly. "You don't get credit for late assignments with RPCs."

A message queue hides the same loss behind an extra hop. Consider a hypothetical order API that enqueues a pricing request and waits up to 30 seconds for a reply. Its consumers can handle 100 messages per second, normal traffic is 80 per second, and a promotion pushes arrivals to 150 per second for 20 minutes.

- The backlog grows by 50 messages per second, so after one minute it holds 3,000 messages, which is 30 seconds of work. From then on, a new message can't reach a consumer before its caller's 30-second timeout.
- After 20 minutes the backlog holds 60,000 messages. A message arriving then waits 10 minutes.
- When arrivals return to 80 per second, consumers drain only 20 messages per second of backlog. Getting back under 3,000 messages takes another 47 minutes or so.

The surge lasted 20 minutes. From its first minute until about 67 minutes after it began, the pricing consumers ran at full capacity and returned nothing any caller received, and every caller saw a timeout. That's the outage on a delay. The queue turned a 20-minute overload into more than an hour of failure, and the system spent its whole recovery doing work for callers who were gone.

### First In, First Out Serves the Least Useful Work First

Ben Maurer's "Fail at Scale" (ACM Queue, 2015), on how Facebook runs reliable services, found this in its own incident history. "In analyzing past incidents involving latency, we found many of our worst incidents involved large numbers of requests sitting in queues awaiting processing." Ordering makes it worse. "During periods of high queuing, however, the first-in request has often been sitting around for so long the user may have aborted the action that generated the request." Processing it first "expends resources on a request that is less likely to benefit a user than a request that has just arrived."

A first-in, first-out queue under sustained overload does this to every message, not just the old ones. Each new arrival waits behind the whole backlog, so by the time a consumer reaches it, it's old too. The queue keeps every message and makes each one late.

### When Nobody Is Waiting, the Deadline Moves

Some work has no caller watching a timer, and Yanacek names the obvious case. For order processing on amazon.com, "we tend to prefer to accept orders even if a backlog builds up, rather than preventing new orders from being accepted," with "plenty of prioritization behind the scenes so that the most urgent orders are handled first." An accepted order still matters an hour later, so dropping it would be wrong.

That case doesn't make the backlog harmless. It moves the deadline from a caller's timeout to a business promise, such as a shipping date, and it changes what happens past the deadline from dropping to prioritizing. Every message still has a point after which processing it in turn stops being the right use of capacity, and each queue needs someone who sets that point.

## Bound the Queue in Time, Not Length

### A Length Limit Doesn't Know What a Message Is Worth

The usual fix for an unbounded queue is a maximum length, and it helps. The SRE book suggests keeping a server's request queue small, "50% or less" of its thread pool for steady traffic, so it rejects work early "when it can't sustain the rate of incoming requests."

A length limit converts to a wait time only through the consumer's throughput, and throughput is exactly what changes during an incident. A queue capped at 3,000 messages holds 30 seconds of work when consumers run at 100 per second. When a slow dependency drops them to 25 per second, the same 3,000 messages are two minutes of work, and the cap no longer protects a caller with a 30-second timeout. Maurer found the same weakness in practice at Facebook. Limits on queue length or fixed queue timeouts "have required tuning on a per-service basis."

Facebook's answer for its in-process request queues was a variant of CoDel, the controlled-delay algorithm from network bufferbloat research, which bounds time in the queue directly. If the queue has emptied within the last N milliseconds, a request may wait up to N milliseconds, which absorbs a short burst. If it hasn't, the queue is standing, and a request may wait only M milliseconds before it's discarded. Maurer found that 5 ms for M and 100 ms for N "tends to work well across a wide set of use cases," and paired it with adaptive LIFO, which switches to newest-first once a queue forms. CoDel keeps the queue short, and newest-first gives fresh requests the best chance of meeting CoDel's limit. Those values suit requests that live for milliseconds. A message queue between services needs its limit in the same unit, time, but a fixed value can't fit every message, because the messages serve callers who wait for very different lengths of time.

### The Right Age Comes From the Caller's Deadline

The SRE book's answer for RPCs is deadline propagation. The frontend sets one absolute deadline, every call in the tree inherits what's left of it, and a server that pulls a request whose deadline has passed "could immediately give up on the request." Each stage should also "check the deadline left at each stage before attempting to perform any more work."

A message deserves the same treatment, and most producers already know the number. The pricing API above waits 30 seconds for a reply, so its work is worthless after 30 seconds. That deadline belongs in the message at the moment it's enqueued, not in a queue setting someone picked by feel.

The age limit also isn't the deadline itself. A consumer that starts a message one second before its caller's deadline and takes two seconds to finish has still wasted the work. The latest useful start is the deadline minus the expected processing time and the time the reply needs to travel back. With first-in, first-out ordering and a limit set at the raw deadline, a consumer under overload serves only messages that are about to expire. Newest-first ordering answers the same problem from the other end, by serving the messages with the most time left.

On a broker with no per-message expiry, like SQS, the producer can carry the deadline as a message attribute and the consumer can check it before doing anything expensive:

```csharp
// Producer: the caller waits 30 seconds for a reply, so the work is worthless after that.
var deadline = DateTimeOffset.UtcNow.AddSeconds(30);

await sqs.SendMessageAsync(new SendMessageRequest
{
    QueueUrl = pricingQueueUrl,
    MessageBody = JsonSerializer.Serialize(request),
    MessageAttributes = new()
    {
        ["Deadline"] = new MessageAttributeValue
        {
            DataType = "Number",
            StringValue = deadline.ToUnixTimeMilliseconds().ToString()
        }
    }
});

// Consumer: decide whether the message is still worth anything before spending on it.
foreach (var message in response.Messages)
{
    if (!message.MessageAttributes.TryGetValue("Deadline", out var attribute))
    {
        await ProcessAsync(message, deadline: null, ct);  // from a producer that predates deadlines
        continue;
    }

    var deadline = DateTimeOffset.FromUnixTimeMilliseconds(long.Parse(attribute.StringValue));
    var latestUsefulStart = deadline - expectedProcessingTime - replyTransit;

    if (DateTimeOffset.UtcNow > latestUsefulStart)
    {
        expiredCounter.Add(1);  // shedding should be visible, not silent
        await sqs.DeleteMessageAsync(pricingQueueUrl, message.ReceiptHandle);
        continue;
    }

    await ProcessAsync(message, deadline, ct);  // later stages check the same deadline
}
```

The receive request has to ask for the `Deadline` attribute by name, or it won't come back. An absolute deadline also depends on the producer's and consumer's clocks agreeing, so leave some margin, as the SRE book suggests for network transit.

### Past the Deadline, Drop It or Set It Aside

What the consumer does with an expired message depends on whether anyone still needs the work. When nobody does, the caller has timed out and will retry or report failure on its own, so dropping the message is correct. Processing it late isn't only waste. If the caller already told a user the operation failed, a late success makes that answer wrong, and a retry from the same caller may now be waiting in the same backlog to do the work a second time. Yanacek describes a cheaper case too. Systems that run a periodic full synchronization can drop any queued change older than the most recent sweep, because the sweep already covered it.

When someone does still need the work, the consumer can move it instead. Yanacek's "sidelining old traffic" checks each message's age as it's dequeued and moves old ones to a separate backlog queue that's worked "only after we're caught up on the live queue," which approximates newest-first on a broker that only offers first-in, first-out. Microsoft's Service Bus documentation describes the interactive version. When a backend can't keep up during a spike, expired jobs land on the dead-letter queue, the user is told the operation will take longer than usual, and the job is resubmitted to a slower path that emails the result.

Either way, the consumer has to do the check itself, even on a broker that expires messages. RabbitMQ discards an expired message "only when expired messages reach the head of a queue," and Service Bus "might choose to lazily expire these messages." Service Bus also doesn't expire a message that a consumer has already locked, so a consumer holding a message past its deadline decides for itself whether to process it.

### Most Queues Default to No Time Limit

Some queues can't hold a per-message limit in time at all, and the ones that can mostly start without one. SQS keeps a message for four days by default, whether or not anyone is waiting for the result.

| Queue | Where a time limit lives | Default | Past the limit |
| --- | --- | --- | --- |
| Azure Service Bus | Per-message `TimeToLive`, capped by the queue's default | Effectively none on Standard and Premium (the largest 64-bit value); 14 days on Basic | Dropped, or dead-lettered if enabled |
| RabbitMQ | Per-message `expiration`, or a `message-ttl` policy on the queue | None | Discarded or dead-lettered when it reaches the head of the queue |
| Amazon SQS | Queue retention only, 60 seconds to 14 days | 4 days | Deleted, processed or not |
| AWS Lambda async invocation | `MaximumEventAgeInSeconds` | 6 hours | Discarded, or sent to a failed-event destination |
| .NET `Channel<T>` | None; a bounded channel limits count only | `CreateUnbounded` has no limit at all | When full, `Wait`, `DropOldest`, `DropNewest`, or `DropWrite` |

Microsoft's documentation opens its page on expiration with the assumption the defaults ignore. The content of a message "is almost always subject to some form of application-level expiration deadline." The broker can't know that deadline. The producer does, and a retention period set in days is a storage setting, not a deadline.

## Checking Your Own Queues

For each queue between your services this week:

- Check for an alarm on the age of the oldest message, not just on depth. On SQS that's `ApproximateAgeOfOldestMessage`.
- Find who is waiting for the result of each message, and how long they wait before giving up.
- Compare that wait with the worst age the queue has reached in an incident. Every message older than it was processed for nobody.
- Check what a consumer does with a message older than its caller's timeout: process it, drop it, or set it aside.
- Look for an expiry on each message or queue, and check whether it's a deadline someone chose or a default nobody changed.

If a queue has no answer for who is waiting, its limit is whatever the default retention happens to be. Under sustained overload, that's how long your outage can last after the trigger is gone.
