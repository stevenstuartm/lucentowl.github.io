---
layout: guide
title: "Reliability Patterns"
category: Architecture
subcategory: Patterns
description: "Build resilient systems with circuit breakers, retries, bulkheads, health checks, and graceful degradation patterns for handling failures."
tags: [architecture, design-patterns, reliability, resilience, distributed-systems, practical]
---

Reliability patterns help systems handle failures gracefully, maintain availability, and provide consistent service even when individual components fail.

## Circuit Breaker

*Pattern described by Michael Nygard in "Release It!" (2007)*

<blockquote class="pull-quote">
<p>Circuit breakers prevent cascading failures by failing fast when a service is down, rather than waiting for timeouts to accumulate.</p>
</blockquote>

Prevents cascading failures by monitoring failures and "opening the circuit" to stop requests to a failing service, similar to an electrical circuit breaker. Provides fast failure and fallback responses instead of waiting for timeouts.

**States**:

- **Closed**: Normal operation, requests pass through (circuit is complete)
- **Open**: Service is failing, requests immediately fail without calling service
- **Half-Open**: After timeout, allows test requests to check if service recovered

**Use When**:
- Calling external services that may be unreliable
- Want to prevent cascading failures
- Need to provide fallback behavior during outages
- Timeouts alone aren't sufficient (service takes long to respond even when healthy)

**Example**: Payment service that stops calling external payment gateway when it's down and returns cached "payment pending" responses instead of timing out.

```
Closed: Request → Payment Gateway (success rate > 90%)
↓ (failures exceed threshold, e.g., 50% failures in 10 requests)
Open: Request → Immediate failure with fallback (60 seconds)
↓ (timeout expires)
Half-Open: Test request → Payment Gateway
  If success → Closed
  If failure → Open (reset timer)
```

**Common implementations**: Resilience4j, Hystrix (deprecated), Polly (.NET)

---

## Retry Pattern

Automatically retries failed operations with appropriate delays and limits. Essential for handling transient failures in distributed systems.

**Use When**:
- Operations may fail due to temporary issues (network blips, momentary overload)
- Network calls that might timeout
- Operations are idempotent (safe to retry without side effects)

**Retry Strategies**:

- **Fixed Delay**: Wait same amount between retries (simple, but can cause thundering herd)
- **Exponential Backoff**: Increase delay exponentially (1s, 2s, 4s, 8s, ...)
  - *Recommended for most scenarios*
- **Exponential Backoff with Jitter**: Add randomness to prevent synchronized retries
  - *Best practice - prevents thundering herd problem*
  - Formula: `delay = base_delay * (2^attempt) + random(0, jitter)`

<div class="callout callout--warning">
<p class="callout__title">Retry Considerations</p>
<p><strong>Only retry transient failures</strong> (don't retry 400/401/403 HTTP errors). Implement maximum retry limits (typically 3-5 attempts). Ensure operations are idempotent. Consider using circuit breaker alongside retries.</p>
<p><strong>Thundering herd problem:</strong> Many clients retrying simultaneously can overwhelm a recovering service. Use jitter to desynchronize retries.</p>
</div>

**Example**: API client retrying failed HTTP requests with exponential backoff.

```
Attempt 1: Immediate → Fail (503 Service Unavailable)
Attempt 2: Wait 1s → Fail
Attempt 3: Wait 2s → Fail
Attempt 4: Wait 4s → Success (200 OK)
```

**Common implementations**: Resilience4j, Polly, AWS SDK built-in retries

---

## Bulkhead Pattern

Isolates system resources to prevent failures in one area from affecting others, similar to ship compartments.

**Use When**:
- Different operations have varying criticality
- Want to isolate resource usage
- Need to maintain core functionality during partial failures

**Implementation Approaches**:

- Separate connection pools
- Different thread pools
- Resource quotas and limits

**Example**: Web application with separate thread pools for user requests, admin operations, and background tasks to prevent admin operations from blocking user traffic.

```
User Thread Pool (50 threads) → User Requests
Admin Thread Pool (10 threads) → Admin Operations
Background Thread Pool (20 threads) → Background Tasks

If admin operations saturate their pool, user requests unaffected
```

---

## Timeout Pattern

Sets maximum wait time for operations to complete, preventing indefinite blocking.

**Use When**:
- Making network calls
- Operations that might hang indefinitely
- Need predictable response times

**Example**: API gateway with 30-second timeout for backend services, returning error response if backend doesn't respond in time.

```
Request → Backend Service
  If response within 30s → Return response
  If no response after 30s → Return 504 Gateway Timeout
```

---

## Quick Reference

### Pattern Comparison

| Pattern | Purpose | Complexity | When to Use |
|---------|---------|------------|-------------|
| **Circuit Breaker** | Prevent cascading failures | Medium | External service calls |
| **Retry** | Handle transient failures | Low | Network operations |
| **Bulkhead** | Isolate failures | Medium | Different criticality levels |
| **Timeout** | Prevent indefinite waits | Low | Any network operation |

### Combining Patterns

Circuit Breaker + Retry:
```
Retry (3 attempts with backoff)
  ↓
Circuit Breaker (stops retries if service consistently fails)
  ↓
Timeout (ensures each attempt has max wait time)
```

### Decision Tree

| Question | Pattern |
|----------|---------|
| Preventing cascading failures? | Circuit Breaker |
| Temporary network glitches? | Retry with backoff |
| Isolating critical vs non-critical? | Bulkhead |
| Operations might hang? | Timeout |

### Best Practices

**Circuit Breaker**: Monitor failure rate, adjust thresholds based on SLA
**Retry**: Use exponential backoff with jitter, limit max retries
**Bulkhead**: Size pools based on resource capacity and criticality
**Timeout**: Set based on P99 latency, not average

---
