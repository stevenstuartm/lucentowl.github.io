---
layout: guide
title: "Integration Patterns"
category: Architecture
subcategory: Patterns
description: "Essential integration patterns for connecting systems including pipes and filters, API gateway, service mesh, and data transformation strategies."
tags: [architecture, design-patterns, integration, etl, routing, practical]
---

Integration patterns define how different systems and services work together, enabling data flow and coordination between disparate components.

## Pipes and Filters

*Pattern from Enterprise Integration Patterns by Gregor Hohpe and Bobby Woolf (2003), with roots in Unix philosophy*

Processes data through a series of processing steps (filters) connected by channels (pipes), where each filter transforms the data and passes it to the next stage. Each filter is independent and single-purpose.

**Use When**:
- Data needs to pass through multiple transformation steps
- Want to reuse processing components (compositional design)
- Need to enable parallel processing
- Building ETL (Extract, Transform, Load) pipelines
- Stream processing applications

**Filter Types**:
- **Producer**: Generates data (e.g., file reader, API poller)
- **Transformer**: Modifies data (e.g., format converter, enricher)
- **Tester**: Filters/validates data (e.g., validator, filter)
- **Consumer**: Terminal point (e.g., database writer, file writer)

<div class="callout callout--warning">
<p class="callout__title">Limitations</p>
<ul>
<li>Not suitable for interactive applications requiring low latency</li>
<li>Cannot handle transactions across multiple filters</li>
<li>Debugging can be complex in long pipelines</li>
<li>No built-in error handling across pipeline</li>
</ul>
</div>

**Example**: Image processing pipeline where an uploaded image passes through filters for resizing, watermarking, format conversion, and thumbnail generation.

```
Upload (Producer) → Resize Filter (Transformer) → Watermark Filter (Transformer)
                 → Format Filter (Transformer) → Thumbnail Filter (Transformer)
                 → Store (Consumer)
```

**Common implementations**: Unix pipes, Apache Camel, Spring Integration, AWS Step Functions

---

## Scatter-Gather

Sends a request to multiple services in parallel and aggregates their responses into a single result.

**Use When**:
- Need to query multiple services for complete information
- Can benefit from parallel processing
- Partial results are acceptable if some services are unavailable

<div class="callout callout--tip">
<p class="callout__title">Key Considerations</p>
<ul>
<li>Overall response time limited by the slowest service</li>
<li>Need to handle partial failures gracefully</li>
<li>May require result aggregation and deduplication</li>
</ul>
</div>

**Example**: Travel booking system that simultaneously queries multiple airlines, hotels, and car rental services to provide comprehensive search results.

```
Search Request → [Airline API, Hotel API, Car Rental API] → Aggregate Results → Response
```

---

## Content-Based Router

Routes messages to different destinations based on message content rather than a predetermined path.

**Use When**:
- Routing decisions depend on message content
- Need flexible, rule-based message distribution
- Different message types require different processing

**Example**: Order processing system that routes high-value orders to manual review, standard orders to automatic processing, and international orders to compliance checking.

```
Order → Content Router → {
  if order.value > 10000 → Manual Review Queue
  if order.country != "US" → Compliance Queue
  else → Standard Processing Queue
}
```

---

## Message Translator

Transforms message format or content to enable communication between systems that use different data formats.

**Use When**:
- Integrating legacy systems with modern applications
- Systems use different data formats or protocols
- Need to maintain backward compatibility

**Example**: Integrating a modern REST API with a legacy SOAP service by translating JSON requests to XML and XML responses back to JSON.

```
Client → JSON Request → Translator → XML Request → SOAP Service
SOAP Service → XML Response → Translator → JSON Response → Client
```

---

## Quick Reference

### Pattern Comparison

| Pattern | Purpose | Complexity | Use Case |
|---------|---------|------------|----------|
| **Pipes and Filters** | Sequential transformation | Low | ETL, data processing |
| **Scatter-Gather** | Parallel aggregation | Medium | Multi-source queries |
| **Content-Based Router** | Conditional routing | Low | Message distribution |
| **Message Translator** | Format conversion | Low | System integration |

### Decision Tree

| Question | Pattern |
|----------|---------|
| Sequential transformations? | Pipes and Filters |
| Query multiple sources in parallel? | Scatter-Gather |
| Route based on content? | Content-Based Router |
| Different data formats? | Message Translator |

### Implementation Tools

**Pipes and Filters**: Apache Camel | Spring Integration | Custom pipelines
**Scatter-Gather**: API Gateway | Custom aggregator
**Content-Based Router**: Apache Camel | Spring Integration | Message brokers
**Message Translator**: Apache Camel | Spring Integration | Custom transformers

---
