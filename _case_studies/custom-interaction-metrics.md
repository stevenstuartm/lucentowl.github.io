---
layout: case-study
title: "When Your Product Outgrows Generic Metrics"
subtitle: "A lightweight, purpose-built solution for tracking product engagement when off-the-shelf tools don't fit"
description: "When existing analytics platforms couldn't support rich user context for paid content, a custom dual-storage metrics pipeline was built using DynamoDB for ingestion and MySQL for aggregated summaries, with configurable time-decay scoring."
role: "System Architect"
date: 2025-01-01
headline_metric: "Custom Metrics Pipeline"
headline_detail: "DynamoDB queue → background processor → MySQL summaries"
category: "design"
category_label: "Architecture & Design"
technologies:
  - .NET
  - AWS DynamoDB
  - AWS Aurora (MySQL)
  - AWS ECS
  - HotChocolate (GraphQL)
author: steven-stuart
---

## The Problem

The platform served approximately 120,000 users across multiple applications, offering paid content products that users subscribed to and consumed over time. The business had three concrete needs that no existing component could serve.

First, the organization needed to understand which content, products, and pages were most effective. Without interaction data, content strategy was guesswork.

Second, marketing needed per-user topic interest profiles. Generic aggregate metrics couldn't distinguish between a user interested in Topic A and a user interested in Topic B; both looked the same in a page-view count. Marketing needed that distinction to drive targeted campaigns and personalized outreach.

Third, the product team wanted to present more relevant content to users in real-time based on detected engagement patterns, similar to how Amazon surfaces recommendations. This required not just tracking what users did, but computing weighted engagement scores that the client application could consume on each request.

This was not a web analytics problem. The questions here required per-user, per-product tracking of authenticated sessions against specific content items within a paid ecosystem. No existing API in the system was suitable for these concerns, and splitting them across existing services would have created coupling that made no architectural sense.

## Why Not Off-the-Shelf?

Before building anything custom, the team evaluated several existing solutions. Each was rejected for specific, defensible reasons.

### Google Analytics

Google Analytics is designed to answer "how are people finding us and what content performs," not "how is user X progressing through our product over time." It doesn't support the degree of per-user context required for tracking customer-specific content consumption within a paid product. Metrics like "time on page" are built for measuring public engagement with free content; for paid content where the business context matters more than the traffic source, those metrics don't translate to business value.

### Third-Party Analytics SDKs

The client-side resource consumption on the primary site was already staggering with API calls, scripts, and third-party integrations. Adding another tracking SDK would have made that worse. The platform also relied heavily on client-side caching to reduce network and server costs, and the team had previously made a deliberate decision not to add generic "always on" tracking for exactly this reason.

### Full Analytics Platforms

Platforms like Mixpanel and Amplitude provide rich user-level analytics, but the full scope of what the organization needed was not yet clear. Committing to a vendor contract before understanding the actual requirements would have meant paying for capabilities that might never be used, or discovering that the chosen platform didn't support a critical use case after the contract was signed. Cost was a persistent constraint across all technology decisions at this organization, and these solutions were far too expensive for what was actually needed at that stage.

### The Custom Investment Tradeoff

A small custom solution offered the right balance: low cost, development agility, and the ability to discover requirements organically before committing to a vendor. Everything was consolidated in a single API that all marketing and product consumers accessed, rather than querying databases directly. Building custom first meant the organization could learn what it actually needed with a minimal investment, rather than guessing at requirements and hoping a vendor's feature set happened to align.

## Solution Architecture

The system was designed as a three-layer pipeline: lightweight ingestion into a transient queue, background batch processing into durable summaries, and a query layer that computed weighted engagement scores on read.

```
┌──────────────────────────────────────────────────────────────────┐
│                        Client Applications                        │
│              (Authenticated users + anonymous visitors)            │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                      REST API calls
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                         UX API Service                            │
│                        (.NET on ECS)                              │
│                                                                   │
│   POST /ux/user/appaction      POST /ux/appaction                 │
│   (authenticated users)        (anonymous, rate-limited)          │
│                                                                   │
│   POST /ux/user/actions/gettopicvaluefrequency                    │
│   (weighted frequency query)                                      │
│                                                                   │
│   GraphQL /graphql                                                │
│   (application alerts, cached)                                    │
└───────┬───────────────────────────────────────┬──────────────────┘
        │                                       │
        │  write (fire-and-forget)              │  read/write
        ▼                                       ▼
┌──────────────────┐                ┌─────────────────────────┐
│  AWS DynamoDB    │                │    AWS Aurora (MySQL)    │
│                  │   background   │                         │
│  Ingestion Queue │──processing──▶ │  Actors                 │
│  (transient)     │   (interval)   │  Actor Claims           │
│                  │                │  Action History Periods  │
│  PAY_PER_REQUEST │                │  Action History Summary  │
└──────────────────┘                └─────────────────────────┘
```

The ingestion layer writes raw events to DynamoDB as fast as they arrive. A background processor running on a configurable interval (default: 10 minutes) scans the queue, aggregates events by actor, topic, scope, and application, then upserts summary records into MySQL. The query layer reads those summaries and computes time-decay weighted frequency scores to rank content by engagement.

## Data Model

### DynamoDB: Ingestion Queue

The `ux_queuedactionhistory` table in DynamoDB served as a transient write-ahead queue. Events landed here immediately on ingestion and were deleted after processing.

```
Table: ux_queuedactionhistory
Billing: PAY_PER_REQUEST

┌────────────────┬──────────────┬─────────────────────────────────────┐
│ Actor (HASH)   │ OccurredAt   │ Attributes                          │
│                │ (RANGE)      │                                     │
├────────────────┼──────────────┼─────────────────────────────────────┤
│ "1|user-uuid"  │ 2024-03-15.. │ ActorValue, ActorTypeId, ActionId,  │
│ "2|192.168.1.1"│ 2024-03-15.. │ ApplicationId, Topic, ActorClaims,  │
│                │              │ ScopeTopic, ScopeValue              │
└────────────────┴──────────────┴─────────────────────────────────────┘

Hash Key:  Actor     — composite "{TypeId}|{Value}" (e.g., "1|user-uuid")
Range Key: OccurredAt — UTC timestamp for ordering within an actor
```

The composite hash key pattern (`{TypeId}|{Value}`) allowed efficient queries for all events belonging to a specific actor, and the range key on `OccurredAt` provided chronological ordering within each partition. PAY_PER_REQUEST billing meant the queue cost nearly nothing during low-activity periods and scaled automatically during spikes.

### MySQL: Durable Summary Storage

Four tables in Aurora MySQL stored the processed and aggregated data.

**Actors**

```sql
CREATE TABLE ux_actors (
   Id       bigint       NOT NULL AUTO_INCREMENT,
   Value    varchar(100) NOT NULL,
   TypeId   smallint     NOT NULL,
   PRIMARY KEY (Id),
   INDEX Idx_ux_actors_Key (Value),
   CONSTRAINT UC_Value_Type UNIQUE (Value, TypeId)
);
```

The actor table abstracted identity. A `TypeId` of 1 represented an authenticated user (by user ID), while a `TypeId` of 2 represented an anonymous visitor (by IP address). This allowed the entire pipeline to handle both actor types uniformly without branching logic.

**Actor Claims**

```sql
CREATE TABLE ux_actorclaims (
   Id          bigint       NOT NULL AUTO_INCREMENT,
   ActorId     bigint       NOT NULL,
   Value       varchar(100) NOT NULL,
   TypeId      smallint     NOT NULL,
   FirstUsedOn DateTime     NOT NULL,
   LastUsedOn  DateTime     NOT NULL,
   PRIMARY KEY (Id),
   INDEX Idx_ux_actorclaims_ActorId (ActorId),
   CONSTRAINT FK_ActorClaim_Actor FOREIGN KEY (ActorId) REFERENCES ux_actors(Id),
   CONSTRAINT UC_Actor_Value_Type UNIQUE (ActorId, Value, TypeId)
);
```

Claims enriched actor records with additional identity signals like IP addresses and email addresses. The `FirstUsedOn` and `LastUsedOn` timestamps provided a lightweight identity timeline without storing every individual event.

**Action History Periods**

```sql
CREATE TABLE ux_actionhistoryperiods (
   Id             bigint      NOT NULL AUTO_INCREMENT,
   ActorId        bigint      NOT NULL,
   Topic          varchar(50) NOT NULL,
   PeriodStartsOn DateTime    NOT NULL,
   PeriodEndsOn   DateTime    NOT NULL,
   IsClosed       Boolean     NOT NULL,
   PRIMARY KEY (Id),
   INDEX Idx_ux_actionhistoryperiods_ActorId (ActorId),
   CONSTRAINT UC_Actor_Topic_Period UNIQUE (ActorId, Topic, PeriodStartsOn)
);
```

Periods defined configurable rolling time windows per actor per topic. The default was 30 days, but each topic could have its own period length via AWS Parameter Store. When a period expired, the processor closed it and created a new one. The scoring algorithm used the two most recent periods to compute time-decay weighted frequencies.

**Action History Summaries**

```sql
CREATE TABLE ux_actionhistorysummaries (
   Id                     bigint      NOT NULL AUTO_INCREMENT,
   ActionHistoryPeriodId  bigint      NOT NULL,
   ApplicationId          varchar(50) NULL,
   ScopeTopic             varchar(50) NULL,
   ScopeValue             varchar(50) NULL,
   ActionTotal            int         NOT NULL,
   LatestOccurrenceAt     DateTime    NOT NULL,
   FirstOccurrenceAt      DateTime    NOT NULL,
   PRIMARY KEY (Id),
   CONSTRAINT FK_ActionHistorySummary_ActionHistoryPeriod
       FOREIGN KEY (ActionHistoryPeriodId) REFERENCES ux_actionhistoryperiods(Id),
   CONSTRAINT UC_Period_App_Topic_Value
       UNIQUE (ActionHistoryPeriodId, ApplicationId, ScopeTopic, ScopeValue)
);
```

Summaries aggregated event counts per period, per application, per scope. The unique constraint ensured upsert behavior: new events incremented existing totals rather than creating duplicate rows.

### Entity Relationships

```
┌──────────────┐       ┌──────────────────┐
│  ux_actors   │       │ ux_actorclaims   │
│              │1    * │                  │
│  Id (PK)     ├───────│  ActorId (FK)    │
│  Value       │       │  Value           │
│  TypeId      │       │  TypeId          │
│              │       │  FirstUsedOn     │
│              │       │  LastUsedOn      │
└──────┬───────┘       └──────────────────┘
       │
       │ 1
       │
       │ *
┌──────┴───────────────────┐       ┌──────────────────────────────┐
│ ux_actionhistoryperiods  │       │ ux_actionhistorysummaries    │
│                          │1    * │                              │
│  Id (PK)                 ├───────│  ActionHistoryPeriodId (FK)  │
│  ActorId (FK)            │       │  ApplicationId               │
│  Topic                   │       │  ScopeTopic                  │
│  PeriodStartsOn          │       │  ScopeValue                  │
│  PeriodEndsOn            │       │  ActionTotal                 │
│  IsClosed                │       │  LatestOccurrenceAt          │
│                          │       │  FirstOccurrenceAt           │
└──────────────────────────┘       └──────────────────────────────┘
```

## The Ingestion Layer

The API exposed two endpoints for recording actions. Authenticated users submitted through `POST /ux/user/appaction`, which extracted identity from the JWT token and associated the action with a known user. Anonymous visitors submitted through `POST /ux/appaction`, which required an explicit application ID and used the caller's IP address as the actor identity.

Both endpoints followed the same pattern: sanitize input, extract the IP address, enforce rate limits, then write one or more `QueuedActionHistory` records to DynamoDB. Each action carried a `Topic` (the category of interaction) and optional `Scopes` (specific content items within that topic). If an action included multiple scopes, the API wrote one DynamoDB record per scope, all sharing the same `ActionId` to maintain the association.

```csharp
// Each scope generates its own queued record, linked by ActionId
foreach (var scope in request.Scopes)
{
    var queuedAction = QueuedActionHistory.CreateUserAction(
        principal, actionId, request.Topic, now, actorClaims, scope);
    await _queuedActionRepository.Save(queuedAction);
}
```

Rate limiting for anonymous actions used a sliding window of 5 requests per minute per IP address, enforced through a shared rate limiting service backed by a distributed cache.

The `Topic` and `Scope` model was deliberately generic. A topic might represent a category of content, while scope values within that topic might represent individual content items. This meant the system could track new interaction types by sending new topic/scope combinations from the client, without any backend changes.

## The Processing Pipeline

The `QueuedActionsProcessor` ran as a .NET `BackgroundService` within the same ECS container as the API. On a configurable interval (default: 10 minutes), it scanned the DynamoDB queue and aggregated events into MySQL summaries.

```
Processing Flow:

1. Scan DynamoDB for distinct actor hashes
                    │
2. For each actor:  │
   ┌────────────────▼────────────────────────────┐
   │  Check rate limit (actor lock)               │
   │  If locked → skip (another instance owns it) │
   └────────────────┬────────────────────────────┘
                    │
   ┌────────────────▼────────────────┐
   │  Fetch all queued actions       │
   │  for this actor from DynamoDB   │
   └────────────────┬────────────────┘
                    │
   ┌────────────────▼────────────────┐
   │  Upsert Actor record in MySQL   │
   │  Update claims if changed       │
   └────────────────┬────────────────┘
                    │
   ┌────────────────▼─────────────────────────────┐
   │  Group actions by Topic                       │
   │    └─ Group by (ScopeTopic, ScopeValue)       │
   │         └─ Group by ApplicationId             │
   │              └─ Count total, track timestamps  │
   │              └─ Upsert ActionHistorySummary   │
   │              └─ Delete processed from DynamoDB │
   └───────────────────────────────────────────────┘
```

### Actor Locking

The processor reused the distributed rate limiting service to implement actor-level locks. Before processing an actor's events, it checked whether that actor was already locked by another instance, allowing horizontal scaling without duplicate processing and without a dedicated distributed lock service.

```csharp
// A simple way to allow for scaling the consumer and
// to not have duplicate processing or to give preference
// to "noisy" users.
var hasExceededRateLimit = await _rateLimitService
    .HasExceededStaticRateLimit(
        RateLimitActor, ActorLockTopic,
        ActorLockWindow, ActorLockLimit, actorHash);

if (hasExceededRateLimit)
    continue;
```

The lock window was configurable independently from the processing interval, allowing the team to tune each for different environments.

### Period Management

Each actor's actions within a topic were organized into time-bounded periods. When the processor encountered actions for an actor/topic combination, it checked for an active (non-closed) period. If none existed or the current one had expired, it closed the old period and created a new one. Period length was configurable per topic through AWS Parameter Store, with a default of 30 days.

```csharp
var topicMetricSettings = _appMetricsConfiguration
    .Settings.FindTopicMetricSettings(topic);

var activeActionPeriod = new ActionHistoryPeriod()
{
    ActorId = actorId,
    Topic = topic,
    PeriodStartsOn = DateTime.UtcNow.Date,
    PeriodEndsOn = DateTime.UtcNow.Date
        .AddDays(topicMetricSettings.PeriodRangeDays),
    IsClosed = false
};
```

### Summary Aggregation

Within each period, the processor maintained one summary record per unique combination of `(ApplicationId, ScopeTopic, ScopeValue)`. New events incremented the existing `ActionTotal` and updated the `LatestOccurrenceAt` timestamp.

Batch processing also provided natural deduplication. If a user clicked the same content item 100 times in a minute, those events arrived in DynamoDB as 100 records, but the processor aggregated them into a single count increment per scope value per batch, collapsing noisy bursts into actual engagement signal without explicit deduplication logic.

After successfully upserting a summary, the processor deleted the corresponding source records from DynamoDB, keeping the queue lean and ensuring events were processed exactly once under normal operation.

## The Scoring Algorithm

The scoring algorithm connected raw interaction data to business decisions. Without it, the pipeline would have been a data warehouse. With it, the pipeline became a decision engine that client applications could query on every request.

The query endpoint `POST /ux/user/actions/gettopicvaluefrequency` returned a ranked list of scope values for a given user, topic, and scope topic, based on a time-decay weighted frequency that combined the current period's totals with a decaying weight from the previous period.

### How the Weighting Works

The algorithm pulled the two most recent periods for the actor/topic combination: the current (open) period and the previous (closed) period. For each distinct scope value present in either period, it computed a weighted total:

```
previousPeriodWeight = max(0.1, daysRemainingInCurrentPeriod / periodRangeDays)
weightedTotal = (previousPeriodTotal * previousPeriodWeight) + currentPeriodTotal
```

Early in a new period, the previous period's data carries significant weight because `daysRemainingInCurrentPeriod` is close to `periodRangeDays`. As the current period progresses and accumulates its own data, the previous period's influence naturally decays toward its floor of 10%. The floor prevents historical engagement from being completely discarded, which would cause abrupt ranking changes at period boundaries.

### Practical Example

Consider a user on a 30-day period. In the previous period, they engaged heavily with Category A (45 actions) and lightly with Category B (10 actions). In the current period, their interest is shifting: they're slowing down on Category A and picking up Category B. The table below shows how the weighted totals evolve across the full period as the decay takes effect and new actions accumulate.

| Day | Previous Weight | Cat A (prev: 45, current) | Cat A Weighted | Cat B (prev: 10, current) | Cat B Weighted | Leader |
|:---:|:---------------:|:-------------------------:|:--------------:|:-------------------------:|:--------------:|:------:|
| 1   | 0.97            | 0                         | 43.65          | 0                         | 9.70           | A      |
| 5   | 0.83            | 3                         | 40.35          | 12                        | 20.30          | A      |
| 10  | 0.67            | 5                         | 35.15          | 18                        | 24.70          | A      |
| 15  | 0.50            | 7                         | 29.50          | 22                        | 27.00          | A      |
| 20  | 0.33            | 8                         | 22.85          | 26                        | 29.30          | **B**  |
| 25  | 0.17            | 9                         | 16.65          | 30                        | 31.70          | **B**  |
| 30  | 0.10            | 10                        | 14.50          | 33                        | 34.00          | **B**  |

On day 1, Category A leads by a wide margin because the user's 45 historical actions carry nearly full weight. By day 15, the previous period's influence has halved and Category B's growing activity is closing the distance. By day 20, Category B overtakes. The rankings now reflect the user's shifting behavior.

At the end of the period (day 30), the previous weight hits its floor of 10%. Category A's 45 historical actions contribute only 4.50 to the weighted total. The historical signal is still present (it hasn't dropped to zero), but it no longer dominates. If the user's interest continues to shift in the next period, the transition will be even more pronounced as this period's Category B totals become the new "previous" data.

## Design Decisions Worth Noting

### DynamoDB as the Queue, Not SQS or Kinesis

SQS would have been the conventional choice for a message queue, but the processing pattern needed actor-partitioned access. The processor needed to fetch all events for a specific actor in a single query, group them, and process them as a batch. DynamoDB's hash key partitioning made this natural: scan for distinct actors, then query each actor's partition for all events. With SQS, the processor would have needed to consume messages in batches of up to 10, accumulate them in memory grouped by actor, and handle visibility timeouts across a potentially large number of in-flight messages.

Kinesis was also considered for its built-in partitioning and ordering, but several factors made it a poor fit. The processor ran on a 10-minute interval and needed random access by actor, not sequential consumption of a stream. Even with the actor ID as the partition key, the consumer would still need to read shards sequentially and filter by actor. DynamoDB lets the processor query a single actor's events directly by hash key without consuming unrelated records.

Kinesis also charges per shard-hour regardless of throughput, making it wasteful at this system's ingestion rates compared to DynamoDB's PAY_PER_REQUEST billing that scaled to near-zero during idle periods. And Kinesis's default 24-hour retention window meant events could be lost permanently if the processor fell behind, while DynamoDB items persist until explicitly deleted.

### MySQL for Summaries, Not DynamoDB

While DynamoDB handled ingestion well, the summary queries needed relational capabilities. The scoring algorithm required joining periods with their summaries, filtering by open/closed status, and ordering by multiple attributes. Entity Framework Core provided familiar patterns for these operations, and Aurora MySQL was already in the organization's infrastructure stack.

Storing summaries in DynamoDB would have required denormalization that made the period management logic significantly more complex without any corresponding benefit. The summary read patterns were predictable and low-volume (one query per user per content retrieval), so Aurora's query capabilities were worth the tradeoff against DynamoDB's scalability.

### Background Processing, Not Real-Time

The summaries powered content recommendations and engagement reports, neither of which required sub-second freshness. A 10-minute processing interval meant the data was fresh enough for its consumers while batching writes to MySQL and reducing overall write amplification. Batching also simplified error handling: if the processor failed mid-batch, the undeleted DynamoDB records would be picked up on the next interval. The processing was naturally idempotent since totals were additive and timestamps tracked maximums.

The processor ran co-located with the API as a `BackgroundService` rather than in a dedicated worker cluster. The organization routinely extracted background processing into separate worker nodes when overhead competed with endpoint performance, but the API here was efficient enough that co-location posed no measurable contention.

### The Actor Abstraction

Using a generic Actor model instead of tying directly to user IDs solved two problems: it allowed tracking anonymous visitors and authenticated users through the same pipeline without conditional logic, and it provided a stable identity layer decoupled from the authentication system's user model. The claims system attached identity signals like email addresses and IP addresses to actors with timestamps, creating a lightweight identity graph that could connect anonymous pre-login behavior to authenticated post-login behavior.

### The Generic Topic/Scope Model

The most deliberate design choice was keeping the content categorization schema-free. This came directly from the reasoning behind building custom in the first place: the team did not yet fully understand the scope of what they needed. A generic model meant client applications could start tracking new interaction types by sending new topic/scope combinations, without any backend schema changes, migrations, or deployments. The same pipeline that tracked content views could track feature usage, campaign attribution, or any other interaction category the business discovered it needed.

## What This Enabled

The pipeline addressed each of the three business needs through two consumption paths: batch reporting via QuickSight and real-time API queries from the client applications.

### Content Effectiveness

Summary data flowed into AWS QuickSight through the existing Snowflake ETL process, giving the content team visibility into which content was actually driving engagement. Content strategy shifted from intuition to data: the team could see which topics users returned to, which content items were consumed once and abandoned, and where engagement dropped off across the product catalog.

### Marketing Intelligence

By querying a user's weighted frequency scores, marketing could segment users by demonstrated interests rather than demographics or purchase history alone. The anonymous action tracking with UTM parameters also connected campaign spend to content engagement without adding client-side tracking scripts, closing the attribution loop between marketing spend and product usage.

### Real-Time Product Personalization

Client applications called `gettopicvaluefrequency` on each authenticated request to retrieve a user's ranked content preferences. The response was a simple ordered list of scope values ranked by engagement bias, which the client used to reorder content presentation.

The time-decay weighting was critical to making this work. Without decay, a user who binge-consumed one category months ago would see stale recommendations forever. With decay, the rankings naturally reflected current interests while retaining enough historical signal to avoid jarring shifts at period boundaries.

All of this was achieved without adding any third-party scripts to the client, without increasing the client-side resource footprint, and at a DynamoDB + Aurora cost that was negligible compared to what a third-party analytics platform would have charged.

## Tradeoffs and Limitations

The solution was explicitly designed as a discovery-phase investment, and it carried tradeoffs that would need to be addressed if the requirements grew substantially.

**Batch latency, not real-time.** The 10-minute processing interval meant engagement data was always slightly stale. For content recommendations and dashboards, this was acceptable. For use cases requiring real-time triggers like milestone notifications, the architecture would need a streaming layer.

**Summary aggregation loses event-level granularity.** Once events were processed into summaries, the individual records were deleted from DynamoDB. The system could answer "user X viewed Category A content 45 times in this period" but not "user X viewed item Y at 2:47 PM on March 15th." Event-level analysis would require archiving raw events to S3 before deletion.

**Simple scoring, not behavioral analytics.** The time-decay weighted frequency algorithm was effective for ranking relative engagement but didn't support session reconstruction, funnel analysis, cohort comparison, or predictive modeling.

These were known limitations at the time of design. The API was the single integration point for all consumers, which contained the blast radius of any future change. The custom solution was a deliberate investment in discovery, not a permanent architecture, but also not something that could be lifted and replaced without effort.
