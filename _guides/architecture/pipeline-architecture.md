---
layout: guide
title: "Pipeline Architecture"
category: Architecture
subcategory: Styles
description: "Sequential data processing architecture using pipes and filters for ETL, data transformation, and stream processing workflows."
tags: [architecture, monolithic, design-patterns, practical, data-processing]
---

<blockquote class="pull-quote">
<p>Pipeline architecture structures a system as a series of processing steps connected by data flow. Think of Unix command-line pipes at the application level.</p>
</blockquote>

Pipeline architecture structures a system as a series of processing steps connected by data flow. Think Unix command-line pipes: each filter reads input, transforms it, and writes output to the next stage. Data flows unidirectionally from source to destination through a sequence of transformations.

## How It Works

The topology consists of **pipes** (connectors that pass data) and **filters** (components that process data). Pipes are typically simple channels: in-memory queues, files, network streams, or message buses. Filters are processing components that transform data.

Four filter types appear in most pipelines:

**Producers** generate or acquire data. They read from files, query databases, call APIs, or listen to event streams. Producers convert raw data into a format the pipeline can process and inject it into the first pipe.

**Transformers** modify data format or structure. They parse text into structured data, aggregate multiple records, enrich data by adding computed fields or looking up additional information, or convert between formats.

**Testers** validate data and route it based on criteria. They check data completeness, validate against business rules, filter out invalid records, or route data to different downstream pipes based on content or criteria.

**Consumers** write final output. They persist to databases, send to external systems, generate reports, or publish events. Consumers convert processed data into the format needed by downstream systems.

### Key Principles

**Stateless filters**: Each filter processes data without maintaining state between invocations. A filter receives input, performs its transformation, and produces output. It doesn't remember previous inputs or depend on processing order. This makes filters independently testable and allows parallel execution of independent filter instances.

**Single-purpose filters**: Each filter does one thing. Parsing is separate from validation. Validation is separate from enrichment. Enrichment is separate from persistence. Single-purpose filters are easier to understand, test, and reuse in different pipelines.

**Unidirectional flow**: Data moves forward from producer to consumer. No backward communication. Filters don't send responses or acknowledgments upstream. This simplicity makes the system easy to reason about but limits applicability to workflows that naturally fit sequential processing.

**Compositional reuse**: Filters can be combined in different sequences to create different pipelines. A "parse CSV" filter might be used in multiple pipelines. A "validate customer record" filter might appear in both import and update workflows. This reuse reduces duplication and creates a library of composable data processing components.

## Topology Patterns

### Linear Pipeline
The simplest pattern: source → filter1 → filter2 → filter3 → destination. Each filter has one input and one output. Data flows sequentially through all filters. Suitable for straightforward transformations where every record follows the same path.

### Branching Pipeline
A filter (usually a tester) routes data to different downstream paths based on criteria. Valid records go to the success pipe. Invalid records go to an error pipe. Priority records route to expedited processing. Branching allows different handling for different data types or conditions.

### Convergent Pipeline
Multiple input sources feed into a single pipeline. Customer data from multiple systems converges into a unified pipeline for deduplication and normalization. Convergent pipelines consolidate data from diverse sources.

### Parallel Pipeline
Multiple filter instances process data concurrently for throughput. A load balancer distributes incoming data across parallel transformer instances. Results feed into a single consumer. Useful when transformation is CPU-intensive and volume is high.

## Data Flow Models

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Batch Processing</h4>
<p>The pipeline processes data in discrete batches. A file arrives, the pipeline processes all records, and produces an output file.</p>
<p><strong>Best for:</strong> Periodic data loads, scheduled transformations, simple restart after failures</p>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Stream Processing</h4>
<p>The pipeline processes data continuously as it arrives. Records flow through individually or in micro-batches.</p>
<p><strong>Best for:</strong> Low latency requirements, real-time processing, continuous data flows</p>
</div>
</div>

<div class="callout callout--note">
<p class="callout__title">Hybrid Processing</p>
<p>Some stages use batching while others stream. Data arrives in a stream but accumulates in a staging area. A scheduler triggers batch processing on accumulated data. Results publish to a stream for real-time consumption. Hybrid approaches balance latency and complexity.</p>
</div>

## Characteristics

| Characteristic | Rating | Notes |
|----------------|--------|-------|
| **Simplicity** | ⭐⭐⭐⭐ | Clear unidirectional flow, easy to visualize |
| **Scalability** | ⭐⭐⭐ | Parallel filter instances scale throughput |
| **Evolvability** | ⭐⭐⭐⭐ | Add or replace filters without affecting others |
| **Deployability** | ⭐⭐⭐ | Can deploy as monolith or distributed components |
| **Testability** | ⭐⭐⭐⭐⭐ | Stateless filters are highly testable |
| **Modularity** | ⭐⭐⭐⭐ | Composable filters promote reuse |
| **Cost** | ⭐⭐⭐⭐ | Simple infrastructure; batch processing is cheap |

## When Pipeline Architecture Fits

**ETL systems**: Extract data from sources, transform it through multiple steps, load into destination. Classic pipeline workflow with clear input, processing stages, and output.

**Data transformation workflows**: Log aggregation, data enrichment, format conversion, data cleansing. Any workflow that can be expressed as a sequence of transformations benefits from pipeline architecture.

**Build systems**: Source files → compile → test → package → deploy. Each stage is a filter. Artifacts flow through the pipeline. Tools like Jenkins or GitHub Actions implement pipeline patterns.

**Stream processors**: Kafka Streams, Apache Flink, AWS Kinesis applications. Process events through a series of transformations. Stateless processing with clear data flow.

**Tight budgets**: Pipeline architecture is conceptually simple and doesn't require sophisticated distributed system infrastructure. Batch pipelines can run on simple compute resources.

**Predictable ordered steps**: When the workflow can be expressed as a directed acyclic graph of processing stages with clear inputs and outputs at each stage.

## When to Avoid Pipeline Architecture

**Complex workflows with conditional branching**: While pipelines support simple branching (routing based on data content), complex control flow with loops, recursive processing, or dynamic workflow construction is awkward in pipeline architecture.

**High scalability requirements across diverse stages**: If different pipeline stages have radically different scaling needs, a monolithic pipeline becomes inefficient. Some stages might need 100x more capacity than others.

**Bidirectional communication**: Pipelines assume unidirectional flow. If downstream filters need to send data upstream, request additional information from producers, or coordinate with other filters, pipeline architecture fights against you.

**Interactive applications**: Request/response semantics don't fit pipeline models. Interactive systems where users wait for responses need different patterns. Pipelines work best for asynchronous background processing.

**State-dependent processing**: If filter logic depends on data from previous records or needs to maintain running state, stateless filters become problematic. While workarounds exist (external state stores), they undermine the architecture's simplicity.

## Common Patterns and Extensions

### Poison Message Handling
When a record causes a filter to fail, it can block the entire pipeline. Implement poison message detection: after N failures, route the problematic record to a dead letter queue for manual inspection. Allow the pipeline to continue processing subsequent records.

### Checkpoint and Restart
For long-running batch pipelines, implement checkpoints. After processing a batch, record progress. If the pipeline fails, restart from the last checkpoint instead of reprocessing everything. Essential for pipelines processing millions of records.

### Observability and Monitoring
Pipeline metrics include: throughput (records/second), latency (time from ingestion to completion), error rate (% of failed records), backlog depth (unprocessed records waiting). Instrument each filter with metrics and distributed tracing.

### Schema Evolution
Data formats change over time. Pipelines must handle mixed schema versions. Implement versioned transformers that detect record version and apply appropriate transformation. Or use schema registries to enforce compatibility.

## Evolution and Alternatives

When pipeline architecture stops fitting:

**Evolve to event-driven architecture**: If workflow becomes more dynamic with conditional reactions to different event types, event-driven architecture provides more flexibility. Filters become event processors. Pipes become event brokers.

**Add orchestration layer**: For complex multi-stage workflows with conditional branching, loops, and error handling, introduce a workflow orchestrator (AWS Step Functions, Apache Airflow) while keeping the pipeline concept for individual processing steps.

**Distribute stages**: If different stages have different scaling needs, deploy filters as independent services. Use message queues for pipes. This maintains pipeline concepts while enabling independent scaling and deployment.

For more architectural style options, see the [Architecture Styles](/study-guides/architecture/ArchitectureStyles.html) overview.
