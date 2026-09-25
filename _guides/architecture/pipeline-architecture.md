---
layout: guide
title: "Pipeline Architecture"
category: Architecture
subcategory: Styles
description: "The pipes-and-filters style that moves data from a source through single-purpose filters to a sink: topology variations, batch versus stream flow, when the style fits, and how it evolves toward event-driven or orchestrated designs."
tags: [practical, pipeline-architecture, pipes-and-filters, etl, stream-processing, batch-processing]
---

<blockquote class="pull-quote">
<p>A pipeline trades flexibility for clarity. Data moves one way, and every step does one thing.</p>
</blockquote>

Pipeline architecture, also called pipes and filters, structures a system as a series of processing steps connected by data flow. It works like Unix command-line pipes at the application level: each filter reads input, transforms it, and passes the output to the next stage. Data flows in one direction, from source to destination, through a sequence of transformations.

## How It Works

The topology has two parts. **Pipes** are the channels that carry data between steps, such as in-memory queues, files, network streams, or message queues. **Filters** are the components that process the data.

A pipeline is usually deployed as a single application, which makes it a monolithic style. Its pipes can still cross process or network boundaries when stages run separately, and that variation comes up again under evolution below.

### What the Filters Do

Data enters a pipeline at a **source**, such as a file drop, a database query, an API, or an event stream, and leaves at a **sink**, such as a database, an external system, a report, or a set of published events. Each filter between them does one of two jobs.

**Reshaping a record.** The filter parses text into structured fields, converts between formats, aggregates records, or enriches a record with computed or looked-up values.

**Deciding about a record.** The filter checks a record against completeness and business rules, then passes it on, drops it, or sends it down a different branch based on its content.

### Design Principles

**Prefer stateless filters.** A filter that keeps no state between records can be tested in isolation and run as multiple instances in parallel. Some operations, like windowed aggregation, need state by nature. Isolate that state in a few filters rather than spreading it through the pipeline.

**Keep filters single-purpose.** Parsing, validation, enrichment, and persistence each belong in their own filter. Single-purpose filters are easier to understand, test, and reuse.

**Keep flow unidirectional.** Data moves forward from source to sink, and filters don't send responses or acknowledgments upstream. That constraint makes the system easy to reason about, and it limits the style to workflows that are naturally sequential.

**Compose filters into different pipelines.** A "parse CSV" filter can serve several pipelines, and a "validate customer record" filter can appear in both an import and an update workflow. Over time, a team builds a library of reusable steps.

## Topology Variations

The simplest pipeline is **linear**: each filter has one input and one output, and every record follows the same path. Real pipelines often add three variations.

{% include figure.html id="arch-pipeline-topologies" %}

**Branching** handles different kinds of records differently, such as sending invalid records to an error pipe or priority records to expedited processing.

**Convergent** pipelines consolidate data from diverse sources, such as unifying customer records from several systems before deduplication.

**Parallel** pipelines raise throughput when one transformation is CPU-intensive and volume is high. Stateless filters are what make this safe.

## Batch and Stream Flow

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Batch Processing</h4>
<p>The pipeline processes data in discrete batches. A file arrives, the pipeline processes every record, and it produces an output.</p>
<p><strong>Best for:</strong> Periodic loads, scheduled transformations, and simple restart after failure</p>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Stream Processing</h4>
<p>The pipeline processes data continuously as it arrives, record by record or in micro-batches.</p>
<p><strong>Best for:</strong> Low latency requirements and continuous data flows</p>
</div>
</div>

<div class="callout callout--note">
<p class="callout__title">Hybrid Processing</p>
<p>Some pipelines mix the two. Data arrives as a stream and accumulates in a staging area, a scheduler triggers batch processing on what has accumulated, and the results publish to a stream for real-time consumers. Hybrids balance latency against complexity.</p>
</div>

## When Pipeline Architecture Fits

**ETL systems.** Extracting data from sources, transforming it through several steps, and loading it into a destination is the classic pipeline workflow.

**Data transformation workflows.** Log aggregation, data enrichment, format conversion, and data cleansing all express naturally as a sequence of transformations.

**Build and delivery systems.** Source files flow through compile, test, package, and deploy stages, and tools like Jenkins and GitHub Actions model their workflows this way.

**Stream processing applications.** Frameworks like Kafka Streams and Apache Flink model processing as a graph of operators that events flow through. Those frameworks also manage state for windowed and aggregating operators, which is what lets stream pipelines go beyond purely stateless steps.

**Tight budgets.** The style is conceptually simple and doesn't require sophisticated distributed infrastructure. Batch pipelines can run on modest compute.

**Predictable, ordered steps.** The workflow can be drawn as a directed acyclic graph with clear inputs and outputs at each stage, so each filter can be tested on its own with nothing but sample input.

**Workflows that keep gaining steps.** A new filter slots into the flow and an existing one can be replaced without touching the rest, and a filter written for one pipeline can be reused in another.

## When to Avoid Pipeline Architecture

**Complex control flow.** Simple content-based branching works, but loops, recursion, and workflows that change shape at runtime fight the one-way model.

**Stages with very different scaling needs.** When one stage needs far more capacity than the rest, a single deployed pipeline wastes resources on the stages that don't.

**Bidirectional communication.** If downstream filters need to request more data from the source, send results back upstream, or coordinate with each other, the style works against you.

**Interactive applications.** Users waiting on a response need request-response semantics, which pipelines don't provide. Pipelines suit background processing.

**Heavily state-dependent processing.** If most filters depend on earlier records or running state, stateless filters stop being practical. External state stores work around that, but they erode the style's simplicity.

## Common Patterns and Extensions

### Poison Message Handling

A record that makes a filter fail can block the whole pipeline. Detect records that fail repeatedly, route them to a dead letter destination for inspection, and let the pipeline continue with the records behind them.

### Checkpoint and Restart

Long-running batch pipelines record their progress at checkpoints. After a failure, the pipeline restarts from the last checkpoint rather than reprocessing everything, which matters once runs cover millions of records.

### Observability

Useful pipeline metrics include throughput in records per second, end-to-end latency from ingestion to completion, the error rate, and backlog depth. Instrument each filter so a slowdown can be traced to the stage that caused it.

### Schema Evolution

Data formats change, so pipelines must handle records in more than one schema version. Versioned filters can detect a record's version and apply the matching transformation, or a schema registry can enforce compatibility at the boundary.

## Evolution and Alternatives

When pipeline architecture stops fitting:

**Move to event-driven architecture.** If the workflow becomes dynamic, with different reactions to different event types, event-driven architecture gives more flexibility. Filters become event processors and pipes become an event broker.

**Add an orchestration layer.** For multi-stage workflows with conditional branching, loops, and error handling, a workflow orchestrator such as AWS Step Functions or Apache Airflow can coordinate the stages while each step keeps the pipeline model.

**Distribute the stages.** If stages need different scaling, deploy filters as independent services connected by message queues. The pipeline concept stays while each stage scales and deploys on its own.
