---
title: "AWS Step Functions for System Architects"
layout: guide
category: AWS
subcategory: Application Integration & Messaging
description: "How Step Functions runs multi-step workflows as state machines: Standard versus Express workflows, defining states in Amazon States Language with JSONata and variables, calling AWS services and HTTPS APIs, retries, catches, and compensation, Map and Distributed Map, callbacks, security, monitoring, and cost."
tags: [step-functions, state-machines, orchestration, express-workflows, distributed-map, jsonata, fundamentals]
---
{% raw %}

## What Step Functions Does

Many processes take several steps across several services, such as reserving stock, charging a card, saving the order, and emailing the customer. Each step can fail, some need retrying, some take hours, and a failure halfway through may mean undoing the earlier steps. Written as code in one function, that coordination is hard to get right and hard to see. Spread across services that trigger each other, nobody can see where a given order is.

**AWS Step Functions** runs that coordination for you. You describe the process as a **state machine**, a set of named steps called **states** with the transitions between them, and Step Functions runs each **execution** of it. It calls each service, waits for results, retries failures, branches on data, runs steps in parallel, and records every step as it goes, so the progress of any execution is visible in the console. This is **orchestration**, a central workflow directing the steps, as opposed to services reacting to each other's events with no coordinator.

A state machine is a Regional resource, and quotas are per account per Region. Each state machine runs with an IAM **execution role** that grants the calls its states make.

Step Functions isn't the only way to write a long-running process on AWS. Lambda durable functions express the same kind of workflow as ordinary code, with checkpoints and waits handled by Lambda. Step Functions fits better when the workflow mostly calls AWS services, which it can do with no function in between, when a visual definition and execution history help operators and reviewers, or when parallel fan-out over large datasets is needed. Durable functions fit better when the steps are mostly business logic that reads naturally as code.

---

## Standard and Express Workflows

A state machine has one of two types, chosen when it's created and fixed after that:

| | Standard | Express |
|---|---|---|
| **Maximum duration** | 1 year | 5 minutes |
| **Execution semantics** | Exactly once. A step runs once unless you ask for retries. | Asynchronous: at least once. Synchronous: at most once. |
| **Start rate** (us-east-1) | 300 per second sustained, bursts to 1,300 | 6,000 per second |
| **State transitions** | 5,000 per second in the largest Regions, 800 elsewhere (raisable) | No limit |
| **History** | Kept by Step Functions for 90 days after the execution ends | Only what you send to CloudWatch Logs |
| **Waiting for jobs and callbacks** (`.sync`, `.waitForTaskToken`) | Supported | Not supported |
| **Distributed Map and redrive** | Supported | Not supported |
| **Price** | $0.025 per 1,000 state transitions | $1.00 per million executions, plus duration and memory |

**Standard workflows** suit business processes that must not repeat steps, like charging a card, and anything that waits for a person or a long job. Step Functions never runs a Standard step twice on its own, which makes it the place for steps that aren't **idempotent**, meaning safe to repeat. Only the retries you configure, and redrive (see Handling Failures), run a step again.

**Express workflows** suit high-volume, short work such as processing IoT messages, transforming records from a stream, or orchestrating a few calls behind an API. They run at least once when started asynchronously, so every step must be idempotent. Started synchronously, for example from API Gateway, they run at most once and return the result to the caller.

A common design uses both, with a Standard workflow for the overall process calling Express workflows for the high-volume inner steps.

---

## Defining a Workflow

State machines are written in **Amazon States Language** (ASL), a JSON format, or drawn in **Workflow Studio**, the console's visual editor, which produces the same JSON. Data moves between states as JSON, and each state's input, the value it passes to a service, and its output can be shaped with expressions.

Since late 2024, those expressions can use **JSONata**, a query and transformation language, and AWS recommends it for new state machines. A state machine sets `"QueryLanguage": "JSONata"`, and any string wrapped in `{% %}` is evaluated as an expression. `$states.input` is the state's input and `$states.result` is the result of its service call. **Variables**, set with a state's `Assign` field, hold values for any later state to read, so data no longer has to be threaded through every state's output. Older state machines use JSONPath with fields like `InputPath`, `Parameters`, and `ResultPath`, and both styles can coexist state by state.

This state machine reserves stock, charges a card, and saves the order, releasing the reservation if the card is declined:

```json
{
  "Comment": "Place an order",
  "QueryLanguage": "JSONata",
  "StartAt": "ReserveInventory",
  "States": {
    "ReserveInventory": {
      "Type": "Task",
      "Resource": "arn:aws:states:::lambda:invoke",
      "Arguments": {
        "FunctionName": "reserve-inventory",
        "Payload": "{% $states.input %}"
      },
      "Assign": { "reservationId": "{% $states.result.Payload.reservationId %}" },
      "Output": "{% $states.input %}",
      "Retry": [{
        "ErrorEquals": ["Lambda.ClientExecutionTimeoutException", "Lambda.ServiceException",
                        "Lambda.AWSLambdaException", "Lambda.SdkClientException"],
        "IntervalSeconds": 2,
        "MaxAttempts": 6,
        "BackoffRate": 2,
        "JitterStrategy": "FULL"
      }],
      "Next": "ChargeCard"
    },
    "ChargeCard": {
      "Type": "Task",
      "Resource": "arn:aws:states:::lambda:invoke",
      "Arguments": {
        "FunctionName": "charge-card",
        "Payload": "{% $states.input %}"
      },
      "Output": "{% $states.input %}",
      "Catch": [{ "ErrorEquals": ["PaymentDeclined"], "Next": "ReleaseInventory" }],
      "Next": "SaveOrder"
    },
    "SaveOrder": {
      "Type": "Task",
      "Resource": "arn:aws:states:::dynamodb:putItem",
      "Arguments": {
        "TableName": "Orders",
        "Item": {
          "orderId": { "S": "{% $states.input.orderId %}" },
          "status": { "S": "PLACED" }
        }
      },
      "End": true
    },
    "ReleaseInventory": {
      "Type": "Task",
      "Resource": "arn:aws:states:::lambda:invoke",
      "Arguments": {
        "FunctionName": "release-inventory",
        "Payload": { "reservationId": "{% $reservationId %}" }
      },
      "Retry": [{
        "ErrorEquals": ["Lambda.ClientExecutionTimeoutException", "Lambda.ServiceException",
                        "Lambda.AWSLambdaException", "Lambda.SdkClientException"],
        "IntervalSeconds": 2,
        "MaxAttempts": 6,
        "BackoffRate": 2,
        "JitterStrategy": "FULL"
      }],
      "Next": "OrderFailed"
    },
    "OrderFailed": {
      "Type": "Fail",
      "Error": "PaymentDeclined",
      "Cause": "The card was declined, and the reservation was released."
    }
  }
}
```

{% endraw %}
{% include figure.html id="aws-sfn-order-workflow" %}
{% raw %}

The Lambda integration wraps each function's return value in a `Payload` field, which is why the reservation ID is read from `$states.result.Payload`. `ReserveInventory` stores it in a variable, so `ReleaseInventory` can read it later even though the error handler replaced the state data in between. The `Output` fields pass each state's original input forward, so later states still see the order. A Lambda function signals `PaymentDeclined` by failing with an error whose type is `PaymentDeclined`, which Step Functions uses as the error name.

`ChargeCard` has no retrier on purpose. A retry after a timeout could charge a card that was already charged, so a failed charge goes to a person or a reconciliation job instead. The other two Lambda tasks retry the service errors that AWS documents as transient, with growing, randomized waits.

ASL has eight state types:

| State | What it does |
|---|---|
| **Task** | Calls a service, a Lambda function, an HTTPS API, or an activity (a worker process you host that polls Step Functions for work), and waits for the result |
| **Choice** | Branches on a condition over the data, such as an order total above $1,000 |
| **Parallel** | Runs several fixed branches at once and waits for all of them |
| **Map** | Runs the same steps for each item in a collection (see below) |
| **Wait** | Pauses for a duration or until a timestamp |
| **Pass** | Passes or reshapes data without calling anything |
| **Succeed** and **Fail** | End the execution, successfully or with an error name and cause |

Each state's input and output is limited to 256 KiB. Larger data belongs in S3, with the state carrying its location.

---

## Calling Services

A Task state reaches other services in three ways:

- **Optimized integrations** cover the most common services, such as Lambda, DynamoDB, SQS, SNS, ECS, Batch, Glue, EventBridge, and nested Step Functions executions, with conveniences like parsing a Lambda function's JSON response.
- **AWS SDK integrations** call more than 9,000 API actions across more than 200 services directly, such as `s3:copyObject`. A step that only moves data between AWS services needs no Lambda function.
- **HTTP Tasks** call any HTTPS API, public or private. An EventBridge connection, a stored authorization such as an API key or OAuth client credentials, holds the credentials. A call must finish within 60 seconds.

How the Task waits depends on the **integration pattern**, chosen with a suffix on the resource ARN:

| Pattern | Behavior | Use for |
|---|---|---|
| **Request response** (default) | Makes the call and moves on when it returns | Quick calls: invoking a function, writing an item |
| **Run a job** (`.sync`) | Starts a job and waits until it finishes | ECS tasks, Batch jobs, Glue jobs, nested executions |
| **Wait for callback** (`.waitForTaskToken`) | Sends a task token with the call and pauses until something returns the token | Human approvals, external systems, anything that finishes later |

The callback pattern is how a Standard workflow waits days for a person. The Task sends a message containing the token, for example to an SQS queue or in an approval email, and the execution sits paused, costing nothing while it waits, until a system calls `SendTaskSuccess` or `SendTaskFailure` with the token. For long tasks, set `HeartbeatSeconds` and have the worker call `SendTaskHeartbeat` more often than that, so a worker that dies silently is detected when its heartbeats stop. Set a timeout too, so an approval nobody answers eventually fails.

{% endraw %}
{% include figure.html id="aws-sfn-callback" %}
{% raw %}

---

## Handling Failures

When a state fails and nothing handles the error, the whole execution fails. Two fields on Task, Parallel, and Map states handle errors declaratively.

**Retry** lists retriers, each matching error names and setting how to try again:

- `IntervalSeconds` is the wait before the first retry (1 by default), and `BackoffRate` multiplies it after each attempt (2.0 by default).
- `MaxAttempts` caps the retries (3 by default, and 0 turns retrying off for that error).
- `MaxDelaySeconds` caps how long the growing wait can get.
- `JitterStrategy` set to `FULL` randomizes each wait, so many executions failing together don't retry in lockstep.

**Catch** lists catchers that send the execution to another state once retries are exhausted, as `ChargeCard` does above. Order both lists from specific errors to general ones. `States.ALL` matches any error and must come last. `States.TaskFailed` matches anything except a timeout. `States.Timeout` is raised when a task exceeds `TimeoutSeconds` or misses a heartbeat. A few errors can't be caught at all, such as `States.Runtime`, which means the definition itself did something invalid.

Retry transient errors and catch errors that retrying won't fix. AWS documents four Lambda service errors as transient, `Lambda.ClientExecutionTimeoutException`, `Lambda.ServiceException`, `Lambda.AWSLambdaException`, and `Lambda.SdkClientException`, and a Lambda task whose function is safe to repeat should retry them. Retry throttling (`Lambda.TooManyRequestsException`) as well. Give every callback, job (`.sync`), and activity task a `TimeoutSeconds`. Without one, such a task waits as long as the execution is allowed to run, up to a year on a Standard workflow, for a response that may never come. A plain Lambda call is bounded by the function's own timeout.

**Compensation** is the pattern in the example, where a catcher runs steps that undo earlier ones, releasing a reservation or refunding a charge. It's how a workflow keeps several services consistent without a distributed transaction. Each compensating step must be safe to run even if the step it undoes only partly happened.

When a Standard execution fails anyway, perhaps because a downstream service was down for longer than the retries lasted, **redrive** restarts it from the failed state within 14 days of its end, without repeating the steps that succeeded.

Failures before the workflow starts matter too. A caller that times out and retries `StartExecution` could start the same order twice. Give each Standard execution a name derived from the business key, such as the order ID. Names are unique per state machine until 90 days after the execution closes, so a retried start with the same name can't create a second execution. If the first execution is still running and the input matches, the retry returns the original response. If the input differs or the first execution has already finished, the retry fails with `ExecutionAlreadyExists`, which the caller should treat as "already started" rather than as an error.

---

## Processing Collections with Map

A **Map** state runs the same steps for each item in an array. It has two modes.

**Inline** mode runs the iterations inside the parent execution, up to 40 at a time. Every iteration's steps count toward the parent's history and its 256 KiB data limit, which suits dozens or hundreds of small items, like the lines of one order.

**Distributed** mode runs each iteration, or each batch of items, as a separate **child execution** with its own history, up to 10,000 at a time. It reads its items directly from S3, such as a large CSV or JSON Lines file or all the objects under a prefix, and can write its results back to S3. **ItemBatcher** groups items so that each child execution handles a batch. A tolerated failure count or percentage lets a large job finish when a few items fail, instead of failing the whole run. Distributed mode needs a Standard parent workflow, and its children can be Standard or Express.

Use Distributed Map when the dataset is larger than 256 KiB, when the iterations would exceed the parent's history limit of 25,000 events, or when more than 40 iterations should run at once. The S3 bucket it reads must be in the same account and Region as the state machine. The Map state's `MaxConcurrency` field caps how many iterations run at once, so set it to what the downstream services can absorb. Ten thousand concurrent Lambda invocations will exceed most accounts' concurrency quota.

---

## Security

- **Execution role.** Grant it exactly the actions its states call, on specific resources. A state machine that starts child executions, as Distributed Map does, also needs `states:StartExecution` on itself.
- **Who can start executions.** IAM policies grant `states:StartExecution`. EventBridge, API Gateway, and EventBridge Scheduler start executions through their own roles.
- **Data in history and logs.** A Standard workflow's history records the input, result, and output of every state, and logging with execution data does the same. Keep secrets out of state data entirely. A state that fetches a secret records it in its own result, even if it never passes it on, so let the service that needs a secret fetch it itself, and let HTTP Tasks use a connection.
- **Encryption.** History and definitions are encrypted with AWS owned keys by default. Since July 2024, a state machine or activity can use a customer managed KMS key instead.

---

## Monitoring

| Metric | What it shows |
|---|---|
| `ExecutionsFailed` and `ExecutionsTimedOut` | Executions that ended badly. Alarm on both. |
| `ExecutionThrottled` | State transitions throttled by the state-transition quota |
| `ExecutionTime` | How long executions take end to end |

For a single failed Standard execution, the console's graph and history show which state failed, with what input and error. Express workflows have no stored history, so turn on logging to CloudWatch Logs, at the `ERROR` level at least, before you need it. Logging costs CloudWatch Logs ingestion and storage, and at the `ALL` level with execution data included, the logs of a busy Express workflow can rival or exceed the cost of the workflow itself. The **TestState** API runs one state in isolation with a given input, which makes testing JSONata expressions and permissions quick.

---

## Where the Money Goes

| Charge (us-east-1) | Price |
|---|---|
| Standard state transitions | $0.025 per 1,000, with 4,000 free each month |
| Express executions | $1.00 per million |
| Express duration | $0.06 per GB-hour for the first 1,000 GB-hours a month, less beyond, billed in 64 MB memory steps and 100 ms increments |

A Standard workflow's cost is its number of steps. Starting and ending the execution each count as a transition, and so does every retry. The order workflow above takes five transitions on the happy path (start, three tasks, end), so a million orders a month cost about $125. Services the workflow calls, such as Lambda and DynamoDB, bill separately.

An Express workflow's cost is its volume and duration. Its memory is 50 MB plus the definition's size plus the payload size times the number of Parallel or Map steps, so small workflows bill at the smallest 64 MB step, and large fan-outs cost more. The same million three-step orders, each finishing within a second, would cost about $1 in executions plus about $1 in duration on Express.

That gap is why high-volume, short, repeatable work belongs on Express, while Standard's per-step price buys exactly-once steps, long waits, and history. A Standard execution waiting a week for an approval costs no more than one that finishes in a second, since waiting isn't a transition.

---

## Key Takeaways

- Step Functions runs multi-step processes as state machines, calling services, retrying, branching, and recording each step, so failures are handled declaratively and every execution is visible.
- Choose Standard for business processes, long waits, and steps that must run exactly once. Choose Express for high-volume work under 5 minutes whose steps are safe to repeat.
- Write new state machines with JSONata and variables, and call AWS services through SDK integrations rather than Lambda functions that only pass data along.
- Retry transient errors with backoff and jitter, catch the rest, give every task a timeout, and use compensating steps to undo work when a later step fails.
- Use the callback pattern to wait for people and external systems, and Distributed Map to process large datasets in S3 with up to 10,000 parallel child executions.
- Standard workflows bill per state transition and Express per execution and duration, so the same workload can differ in cost by more than an order of magnitude.
{% endraw %}
