---
title: "Running LLMs in Production"
layout: guide
category: AI & Machine Learning
subcategory: Building with LLMs
description: "Making an LLM application fast, affordable, and resilient, covering where tokens and milliseconds actually go, prefix caching, model routing, streaming, rate limits and backpressure, fallbacks, and what to monitor."
tags: [cost-optimization, caching, latency, model-routing, rate-limiting, practical]
---

A prototype that works becomes a production system that costs too much and responds too slowly, and both problems trace back to the same small set of mechanics. Model inference is billed per token and generated one token at a time, so almost every lever in this guide is about sending fewer tokens, reusing the ones you already sent, or overlapping the wait with something useful.

## Where Cost and Latency Actually Go

Four properties of the API explain most production surprises, and each one has a lever attached.

**Output tokens dominate latency; input tokens dominate cost.** Input is processed in parallel, while output is generated sequentially, so a request with a long prompt and a short answer returns quickly. A short prompt asking for a long answer does not. Cost runs the other way for most applications, because a conversation resends its whole history on every turn while producing a few hundred output tokens each time.

**Every request carries the entire conversation.** The API is stateless, so a long session grows quadratically in billed input: turn twenty pays for turns one through nineteen again. Server-side conversation state does not change this, since the accumulated history is still billed as input on each call.

**Everything in the context is billed, including the parts you forget about.** Tool definitions, system prompts, retrieved chunks, and extended reasoning all consume the budget. Reasoning tokens in particular are billed as output and count toward the output limit, so a model configured to think hard is paying output rates for text the user never sees.

**Agent loops multiply all of the above.** One user request becomes many inferences, each carrying a context grown by the previous step's results. Cost per user action, not cost per call, is the number that matters.

---

## Caching the Prefix

Prompt caching is the single largest cost lever available for most applications, and it is the one most often left on the table.

### How It Works

Both major providers cache a *prefix* of the request. If the first N tokens of a request exactly match a previous request's first N tokens, the model reuses the computed state instead of reprocessing them. Matching is exact and positional, so a single changed character early in the prompt invalidates everything after it.

The economics favor caching heavily. On [Anthropic's API](https://platform.claude.com/docs/en/build-with-claude/prompt-caching){:target="_blank" rel="noopener noreferrer"}, writing a cache entry costs 1.25 times the base input rate at the default five-minute lifetime, while reading one costs 0.1 times the base rate. A prefix read twice has already paid for itself. [OpenAI](https://developers.openai.com/api/docs/guides/prompt-caching){:target="_blank" rel="noopener noreferrer"} prices cached reads at the same 0.1 multiple on current models.

The two differ in how caching is invoked, which matters when you build across both. Anthropic uses explicit breakpoints, marking the block whose prefix should be cached, with a small fixed number of breakpoints per request. OpenAI caches implicitly by default, with explicit markers available on current models. Both enforce a minimum cacheable length, on the order of a thousand tokens, below which nothing is cached at all.

### Designing a Prompt That Caches

The design rule follows directly from prefix matching. Order the context from most stable to least stable, and put the cache breakpoint at the boundary.

```
  ┌──────────────────────────────────────────┐
  │ Tool definitions                         │  stable across
  │ System prompt / instructions             │  every request
  │ Few-shot examples                        │
  │ Shared reference material                │
  ├──────────────────────────────────────────┤ ◄── cache breakpoint
  │ Conversation history                     │  stable within
  │                                          │  one session
  ├──────────────────────────────────────────┤ ◄── optional second breakpoint
  │ Retrieved chunks for this request        │  changes every
  │ Current user message                     │  request
  │ Timestamp, request ID, user context      │
  └──────────────────────────────────────────┘

  A change at any level invalidates that level and everything below it.
```

Two mistakes account for most caching that quietly does nothing. The first is putting something volatile near the top, such as a timestamp, a session ID, or the current date injected into the system prompt, which invalidates the cache on every single request. The second is placing the breakpoint after content that changes, which leaves the stable material behind a moving boundary and caches nothing useful.

Verify rather than assume. Both providers report cache read and cache write token counts in the response, and a system you believe is caching while those counters sit at zero is a common and expensive situation. Put those counters on a dashboard rather than checking them once during development.

Caching applies beyond the prompt too. Embedding the same text repeatedly is pure waste, so cache embeddings keyed on a hash of the content, and cache complete responses for requests that genuinely repeat, such as a classification of identical input.

---

## Routing to the Right Model

Model families span roughly an order of magnitude in price and a similar spread in latency, and most applications run every request through the largest model because that is what the prototype used.

Routing sends each request to the cheapest model that handles it acceptably. The classification, extraction, routing, and formatting steps inside a larger workflow are usually served well by a small fast model, while the reasoning-heavy step in the middle needs the large one. Splitting a monolithic prompt into those stages often cuts cost more than any other single change.

Two patterns work in practice. **Static routing** assigns a model per task type, decided once by evaluation and encoded in configuration. **Escalation** tries the small model first and retries with the large one when the result fails a check, which suits tasks where failure is detectable, such as output that will not validate against a schema or a confidence signal the model reports.

Escalation has a trap. If the small model fails often, you pay for both calls plus the latency of the first, and the combination costs more than always using the large model. Measure the escalation rate and treat a high one as evidence that static routing to the large model is correct for that step.

Route on evidence. The only way to know a smaller model handles a step is to run both against the same eval set, which is the same machinery that catches regressions from any other change.

---

## Latency

### Where the Time Goes

Users experience two different numbers. **Time to first token** is how long the screen stays empty, and it is dominated by prompt processing, queueing, and network round trips. **Total completion time** is dominated by how many tokens come out, since generation is sequential.

The two respond to different treatments, and conflating them wastes effort. Trimming the prompt improves time to first token. Only asking for less output, or a faster model, improves total time.

### Streaming

Streaming changes nothing about total time and changes almost everything about how the wait feels, because the user starts reading while generation continues. For anything producing more than a sentence or two, it is the highest-value latency work available, and it is usually a small change.

Streaming does complicate the parts of the system that need a complete response, such as schema validation, content filtering, and anything that post-processes output. The usual arrangement streams to the display while buffering for the checks, and holds back any action until the full response has arrived and passed them.

### Doing Less Sequentially

In multi-step work, the steps that do not depend on each other should not run one after another. Independent retrievals, independent tool calls, and independent subtasks can be issued concurrently, and the wall-clock saving is often larger than anything model choice buys.

Prefetching helps where the next step is predictable. Starting a retrieval while the user is still typing, or warming a cache entry before the session's first real request, removes that latency from the visible path entirely.

---

## Rate Limits and Backpressure

Providers limit requests per minute and tokens per minute, usually with separate input and output token limits, and the token limits bind first for most applications. A system that runs fine in testing will hit them under real concurrency.

Handling a 429 correctly takes three things. Retry with exponential backoff and jitter, so that a fleet of clients does not retry in lockstep and recreate the spike. Respect the retry-after header when one is returned rather than guessing. And cap retries, because past a couple of attempts the queue is the problem and more retries deepen it.

Beyond retries, the system needs somewhere for excess load to go. Queue non-interactive work and drain it at a rate the limits allow. Shed or degrade interactive work explicitly, with a message saying so, rather than leaving a request hanging until it times out. Apply your own per-user limits so that one client cannot consume the whole organizational quota, which is both a cost control and an availability control.

---

## Failing Over

Model APIs are network dependencies with real failure rates, and an application that treats them as always available will inherit every incident.

Set timeouts deliberately. Default HTTP timeouts are far shorter than a long generation and will cut off valid responses, while a missing timeout hangs a request indefinitely. Size the timeout against the expected output length, and keep it separate from the connection timeout.

Design the degraded path before you need it. A fallback to a different model, a different provider, or a cached or templated response is a product decision about what a reduced service looks like, not something to improvise during an outage. Where a fallback crosses providers, the prompt usually needs adjusting, so an untested fallback path is not a fallback.

Make retries safe. A request that times out may have been processed, and retrying a tool-invoking agent step can repeat a side effect. Idempotency keys on anything with an external effect prevent a retry from sending the same email twice.

Distinguish the error classes rather than catching everything the same way. A 429 means back off and retry. A 500 means retry a bounded number of times. A 400 means the request is malformed and will fail identically forever, so retrying it only wastes time and quota.

---

## Work That Does Not Need to Be Interactive

Anything without a user waiting on it should not be paying interactive prices. Both major providers offer a batch mode at roughly half the standard token rate in exchange for asynchronous turnaround measured in hours. Classification backlogs, bulk enrichment, evaluation runs, and content generation pipelines all qualify.

The decision is simply whether a response is needed now. Where it is not, the same work at half price is available for the cost of restructuring the call into a submit-and-collect shape.

---

## What to Monitor

| Signal | Why it matters |
|---|---|
| **Cost per user action** | The only cost number tied to value; cost per call hides agent loop multiplication |
| **Cache hit rate and cached token share** | Detects caching that silently stopped working after a prompt edit |
| **Time to first token, at p50 and p95** | What the user experiences as responsiveness |
| **Total completion time, at p50 and p95** | Where timeouts and abandoned sessions come from |
| **Output tokens per request** | The main driver of both latency and output spend |
| **429 rate and retry rate** | Proximity to rate limits, before they become user-visible |
| **Error rate by class and by model** | Separates provider incidents from your own bugs |
| **Spend rate against budget** | A runaway loop exhausts a monthly budget in hours, so alert on rate |

Attach a request ID and a model identifier to every log line. When a provider ships a new snapshot behind an alias, the ability to say exactly when behavior changed and on which model is what turns a week of confusion into an afternoon.

---

## Common Pitfalls

| Pitfall | What happens | Better approach |
|---|---|---|
| **Volatile content early in the prompt** | The cache misses on every request and nobody notices | Order context stable to volatile, and monitor cache hit rate |
| **One large model for every step** | Paying reasoning prices for classification and formatting | Route per step, chosen by evaluation |
| **Optimizing the prompt to fix slow responses** | Time to first token improves while the user still waits | Separate the two latency numbers and treat them differently |
| **Unbounded conversation history** | Cost per turn climbs through a long session | Compact or window the history, and cache what survives |
| **No timeout, or the library default** | Requests hang, or valid long generations get cut off | Size timeouts against expected output length |
| **Retrying everything** | A malformed request is retried forever; a side effect repeats | Branch on error class, and use idempotency keys |
| **Untested fallback path** | The fallback fails at the moment it is first needed | Exercise it on a schedule, with its own prompt |
| **Interactive pricing for background work** | Roughly double the necessary spend | Move anything without a waiting user to batch |
