---
title: "Azure Data Factory: ETL & Data Integration"
layout: guide
category: Azure
subcategory: Analytics & Data Processing
description: "Orchestrating data movement with Azure Data Factory: pipelines and activities, the three integration runtimes and how one gets selected, trigger semantics, change data capture options, and the consumption meters that drive cost."
tags: [data-factory, etl, integration-runtime, data-pipelines, change-data-capture, data-lake, practical]
---

## What Azure Data Factory Is

[Azure Data Factory](https://learn.microsoft.com/en-us/azure/data-factory/introduction){:target="_blank" rel="noopener noreferrer"} is a managed service for orchestrating data movement and transformation. It connects to data stores across on-premises, cloud, and SaaS environments, moves data between them, and dispatches transformation work to compute services, with scheduling, retries, and monitoring handled by the platform.

Treat it as an orchestrator rather than a transformation engine. Its Copy activity is purpose-built for moving data efficiently, and its control flow coordinates the steps around that movement. The heavy transformation work is better placed in Synapse, Databricks, or a SQL engine, with Data Factory triggering and sequencing it.

### Data Factory in Microsoft Fabric Is the Successor

Every current Data Factory documentation page carries the same notice: Data Factory in Microsoft Fabric is described by Microsoft as "the next generation of Azure Data Factory, with a simpler architecture, built-in AI, and new features," with the guidance that new data integration work should start in Fabric and that existing Azure Data Factory workloads can [upgrade to Fabric](https://learn.microsoft.com/en-us/fabric/data-factory/migrate-planning-azure-data-factory){:target="_blank" rel="noopener noreferrer"}.

Azure Data Factory is not retired and has no announced end date, so existing estates keep working and remain supported. But the positioning affects design decisions with a multi-year horizon. A greenfield platform being designed now should evaluate Fabric first, and a large existing Data Factory estate should treat migration as a question of when rather than whether. The concepts below transfer, because Fabric's pipelines use the same activity model.

### Data Factory Components

| Component | What it is |
|---|---|
| **Pipeline** | A logical grouping of activities managed and run as a unit |
| **Activity** | One processing step, of three kinds: data movement, data transformation, or control flow |
| **Dataset** | The structure and location of data inside a store, referenced as an activity input or output |
| **Linked service** | Connection information for a data store or a compute resource |
| **Data flow** | A visually designed transformation graph that Data Factory executes on a managed Spark cluster |
| **Integration runtime** | The compute that executes an activity or dispatches it |
| **Trigger** | The condition that starts a pipeline run |

Linked services do double duty, which is a common point of confusion. One kind points at a **data store** to read or write. The other points at a **compute resource** that hosts execution, such as the Databricks workspace a notebook activity runs on.

### How Data Factory Compares to AWS Glue

| Dimension | AWS Glue | Azure Data Factory |
|-----------|----------|---|
| **Orchestration** | Job-centric, with workflows for multi-job sequencing | Pipeline-centric, with control flow, branching, loops, and parameters |
| **Transformation** | Spark jobs in PySpark or Scala | Mapping data flows on managed Spark, or dispatch to Synapse, Databricks, HDInsight, and stored procedures |
| **Data movement** | Spark-based, shared with transformation | A dedicated Copy activity, billed and tuned separately from transformation |
| **Compute model** | DPUs provisioned per job | Three integration runtime types, one of which you host yourself |
| **Hybrid connectivity** | Network-level, through VPC connectivity to on-premises | Self-hosted integration runtime, making outbound-only connections from inside your network |
| **Scheduling** | Time-based schedules and EventBridge integration | Schedule, tumbling window, and event-based triggers |
| **Change data capture** | Job bookmarks | A dedicated CDC resource, native CDC in data flows, and auto incremental extraction |
| **Lift and shift** | Requires rewriting existing ETL | Azure-SSIS integration runtime runs existing SSIS packages unchanged |
| **Billing** | Per DPU-hour | Per activity run, plus DIU-hours for copy, plus vCore-hours for data flows |
| **Infrastructure as code** | CloudFormation, Terraform | ARM, Bicep, Terraform |

---

## Pipelines and Activities

A pipeline groups activities so they can be managed and run as a set. Activities chain sequentially or run in parallel, with dependency conditions determining what happens on success, failure, completion, or skip.

Microsoft classifies activities three ways. **Data movement** is the Copy activity. **Data transformation** covers data flows and the external activities that dispatch work to another compute service. **Control flow** covers the constructs that shape execution.

| Activity | Purpose |
|----------|---------|
| **Copy** | Move data between a source and a sink |
| **Data Flow** | Run a mapping data flow on a managed Spark cluster |
| **Lookup** | Read a value or row set to parameterize later activities |
| **Get Metadata** | Retrieve properties of a file or folder, such as existence, size, or child items |
| **ForEach** | Iterate a collection, sequentially or in parallel |
| **If Condition** / **Switch** | Branch on an expression |
| **Until** | Loop until a condition is met |
| **Execute Pipeline** | Invoke a child pipeline |
| **Web** / **Webhook** | Call an HTTP endpoint, with Webhook waiting for a callback |
| **Databricks Notebook / Jar / Python** | Run work on a Databricks cluster |
| **HDInsight Hive / Pig / MapReduce / Spark / Streaming** | Run work on an HDInsight cluster |
| **Stored Procedure** | Execute a stored procedure |
| **Azure Function** | Invoke a function |
| **Custom** | Run your own code, which executes on an Azure Batch pool you provide |
| **Validation** | Block until a dataset meets a condition |

Two of these carry a dependency people miss. The **Custom activity** runs on Azure Batch, so using it means provisioning and paying for a Batch pool. And there is no generic "Spark job" activity for Databricks. Databricks work goes through the Notebook, Jar, or Python activities, while the HDInsight Spark activity is a separate thing targeting HDInsight.

---

## Integration Runtimes

The integration runtime is the compute that bridges an activity and a linked service. It determines where execution physically happens, which in turn drives performance, cost, network reachability, and data residency.

Data Factory has exactly three types. Synapse pipelines support only the first two.

### Azure Integration Runtime

Azure IR is serverless compute managed by Microsoft. It runs data flows, runs copy activities between cloud stores, and dispatches transformation activities to external compute. You choose how many Data Integration Units a copy activity uses and the underlying compute scales to match, with no infrastructure to size or patch.

By default the Azure IR is set to **autoresolve**, which picks a region at runtime. For a copy activity it makes a best effort to detect the sink's region and use an IR there, falling back to the closest region in the same geography, and finally to the factory's own region when the sink region cannot be detected. Lookup, Get Metadata, Delete, activity dispatch, and authoring operations always use the factory's region, and so do data flows.

That autoresolve behavior is a data residency problem waiting to happen. If data must not leave a geography, create an Azure IR explicitly in the required region and bind the linked services to it with `connectVia`, rather than trusting detection.

**Managed Virtual Network** changes the network story. With it enabled, the Azure IR connects to data stores over Private Link through managed private endpoints, so traffic to those stores does not traverse public endpoints. Data Factory and Synapse differ on the outbound side, though. Outbound communication from a Data Factory managed virtual network leaves all ports open, whereas Synapse workspaces offer options to restrict it.

### Self-Hosted Integration Runtime

A self-hosted IR is software you install on a machine you own, giving Data Factory a foothold inside a private network. It runs copy activities between a cloud store and a private-network store, and dispatches transformation activities to compute in your network or virtual network.

Its defining property is direction. The self-hosted IR makes **outbound HTTP-based connections only**, so nothing needs to be opened inbound from the internet to your network.

The deployment requirements are specific:

- **Windows only.** There is no Linux self-hosted IR. Supported versions are Windows 10, Windows 11, and Windows Server 2016, 2019, 2022, and 2025.
- **64-bit with .NET Framework 4.7.2 or later.**
- **A Java Runtime Environment on the same host**, which is a dependency people discover when Parquet, ORC, or Avro handling fails.
- **Recommended minimum hardware** of a 2 GHz processor with 4 cores, 8 GB of RAM, and 80 GB of free disk.
- **Not supported on a domain controller.** And if the host hibernates, the runtime stops responding, so the power plan matters.

For availability and throughput, associate the logical runtime with **up to four nodes** in active-active mode. Below that, a single node is a single point of failure for every hybrid pipeline in the factory.

The self-hosted IR is also required for data stores needing a bring-your-own driver, including SAP HANA and MySQL, regardless of whether those stores are on-premises.

### Azure-SSIS Integration Runtime

The Azure-SSIS IR is a **fully managed cluster of Azure VMs** dedicated to running SQL Server Integration Services packages. It is not a Spark cluster and has nothing to do with Spark; it runs the SSIS engine so existing packages execute with little or no change, managed through familiar tools like SSDT and SSMS.

You bring your own Azure SQL Database or SQL Managed Instance to host the SSIS catalog (SSISDB), scale up by node size and out by node count, and start or stop the cluster to control cost. It can be joined to a virtual network to reach on-premises sources and to control outbound communication.

Two placement rules matter. The Azure-SSIS IR should sit in the same region as the SSISDB database to avoid cross-region traffic, and it is not supported in Synapse pipelines.

### Which Integration Runtime Runs a Given Activity

When more than one IR could apply, resolution follows a fixed precedence rather than a choice you make per activity.

```
                    Does the activity touch a
                    private-network data store?
                              |
              +---------------+---------------+
              | yes                           | no
              v                               v
   Self-hosted IR wins.               Is Managed Virtual Network
   If EITHER the source or            enabled on the factory?
   sink linked service uses                    |
   a self-hosted IR, BOTH                +-----+------+
   sides use it.                         | yes        | no
   (Two private stores must              v            v
   use the SAME self-hosted        Azure IR in   Global (autoresolve)
   IR instance.)                   the managed   Azure IR, region
                                   VNet, over    detected at runtime
                                   Private Link
              |                          |            |
              +------------+-------------+------------+
                           v
              Precedence when several apply:
              self-hosted  >  managed-VNet Azure IR  >  global Azure IR

              Separate track: SSIS packages run only on
              an Azure-SSIS IR, which does nothing else.
```

The rule that surprises people is the copy activity's. Because a copy needs both a source and a sink, naming a self-hosted IR on **either** linked service pulls the whole activity onto that runtime. A cloud-to-cloud copy can end up executing on an on-premises machine because one linked service was configured that way, with the throughput consequences that implies.

For CI/CD, integration runtimes have to carry the **same name and type across every environment**. A common approach is a dedicated factory holding shared runtimes, referenced from the others as linked integration runtimes.

---

## Triggers and Pipeline Execution

A pipeline runs either manually or from a trigger. Manual execution, also called on-demand, is available through the portal, REST, PowerShell, and the .NET and Python SDKs, and is not a trigger type despite often being listed as one.

Data Factory supports **three trigger types**: schedule, tumbling window, and event-based, with the event-based type having two flavors.

**Schedule triggers** fire on a wall-clock schedule with recurrence plus optional advanced calendar rules covering minutes, hours, weekdays, month days, and monthly occurrences. Time zones observing daylight saving auto-adjust when the recurrence is daily or coarser, but not at hourly or minute frequency.

**Tumbling window triggers** fire on fixed-size, non-overlapping, contiguous intervals while retaining state, which makes them the choice for time-partitioned batch processing.

**Event-based triggers** come as a **storage event trigger**, responding to blob creation or deletion in a storage account, and a **custom event trigger**, responding to events on an Event Grid custom topic. Stopping and restarting an event-based trigger resumes its old pattern and can fire unwanted runs, so recreate rather than restart it when you want a clean slate.

### Schedule Versus Tumbling Window

These two look interchangeable and are not.

| Behavior | Tumbling window | Schedule |
|---|---|---|
| **Backfill** | Supported; windows in the past can be scheduled | Not supported; current and future only |
| **Reliability** | Every window from the start date runs, with no gaps | Less reliable |
| **Retry** | Supported, including automatic retry on 400, 429, and 500 responses | Not supported |
| **Concurrency control** | Explicit limit between 1 and 50 concurrent runs | Not supported |
| **Window variables** | `windowStartTime` and `windowEndTime` available | Only `scheduledTime` and `startTime` |
| **Pipeline relationship** | One-to-one; one trigger drives one pipeline | Many-to-many |
| **Completion semantics** | Waits for the pipeline run and reflects its state | Fire and forget; marked successful once the run starts |

The completion semantics are the deciding factor for dependent processing. A schedule trigger reports success as soon as it starts a run, so a downstream step keyed to it can begin while the upstream pipeline is still executing or after it has failed. A tumbling window trigger's run state mirrors the pipeline run, which is what makes dependency chains between windows trustworthy.

The one-to-one restriction is the trade-off. Driving five pipelines from one schedule is fine; doing the same with tumbling windows needs five triggers.

---

## Mapping Data Flows

[Mapping data flows](https://learn.microsoft.com/en-us/azure/data-factory/data-flow-create){:target="_blank" rel="noopener noreferrer"} are visually designed transformation graphs that Data Factory executes on a Spark cluster it manages for you. You get source and sink transformations plus filter, select, join, aggregate, pivot, derived column, and alter row operations, without writing Spark or managing clusters.

### Cluster Sizing and Startup Cost

Data flow performance and cost come from three settings on the Azure IR: cluster type, cluster size, and time to live.

The default size is **four driver cores and four worker cores**, and sizes scale up through 16, 32, 48, 80, 144, and 272 total cores. Because billing is per vCore-hour, a larger cluster costs more per minute but usually finishes sooner, and the two effects partly cancel. Scaling also has a ceiling. Once you have more cores than data partitions, more cores stop helping, so start small and scale to a measured need.

Shuffle partitions default to 200, which Microsoft describes as suiting roughly 300 GB of data, targeting about 1.5 GB per partition. Raising the value between 50 and 2000 addresses out-of-memory failures on join- and aggregation-heavy flows, though it does not help when the data is skewed rather than merely large.

**Time to live** is the setting with the biggest practical effect. Every data flow activity spins up a new Spark cluster by default, and a cold start takes several minutes during which nothing is processed. Setting a TTL keeps the cluster alive after execution so a subsequent activity reuses it.

Two conditions limit it. TTL helps **sequential** data flows and works against parallel ones, because only one job runs on a cluster at a time, so a second concurrent flow spins up its own cluster anyway. And TTL is **not available on the autoresolve integration runtime**, so benefiting from it means creating a regional Azure IR explicitly.

### When to Use a Data Flow

Reach for mapping data flows when transformation logic is moderate and visual authoring has value: schema mapping, validation, cleansing, joins against reference data, and straightforward aggregation.

Go elsewhere for heavy processing. Databricks or Synapse Spark suits machine learning, complex custom logic, and large-scale work where you want direct control over the cluster. Synapse SQL or the target database suits set-based transformation that a warehouse engine already does well, especially in an ELT design where the data has landed.

---

## ETL and ELT

Data Factory supports both patterns, and the difference is where transformation happens rather than which service you use.

**ETL** transforms data in flight and lands only cleaned output. It keeps the destination free of raw data and reduces storage, but couples transformation logic to the load process, and reprocessing means re-reading the source because the raw data was never kept.

**ELT** lands raw data first and transforms it in the destination engine. It costs more storage and adds a step, but preserves the raw data for reprocessing and audit, separates movement from transformation, and lets the warehouse or lake engine do transformation work it is better suited to than a general-purpose data flow.

ELT is the better default at scale, mostly because of reprocessing. When a transformation bug is found three months later, an ELT design can rebuild from retained raw data, while an ETL design has to hope the sources still hold the history.

Many architectures combine them, doing lightweight validation and schema normalization in a data flow on the way into the lake, then the substantive transformation in Synapse or Databricks against the landed data.

### Data Lake Zones

A zoned lake gives each stage of that pipeline a defined contract.

```
  Source A ─┐
  Source B ─┼─► Copy activity ─► LANDING     raw, as-is, immutable
  Source C ─┘                       │        write-once, short retention
                                    ▼
                    Data flow ─► RAW / BRONZE  schema standardized,
                    (validate,       │         duplicates and nulls
                     normalize)      │         handled, lineage columns
                                     ▼         added, append-only
              Synapse or ─────► CURATED / SILVER  business rules,
              Databricks           │              enrichment, joins to
              (business logic)     │              reference data
                                   ▼
              SQL or data ────► ANALYTICS / GOLD  aggregates and
              flow aggregation                    pre-computed metrics
```

Retention differs by zone and is the part most often left undefined. Landing holds raw data for a short window, raw retains longer for reprocessing, and curated and analytics persist as long as the business needs them. Without explicit retention, the landing zone becomes an unbounded and expensive archive of data that already exists downstream.

---

## Incremental Loading and Change Data Capture

Reading only what changed since the last run is what keeps a pipeline's cost and duration flat as the source grows. Data Factory offers four approaches, and Microsoft's recommended order runs from most to least automated.

### The Change Data Capture Factory Resource

The [CDC resource](https://learn.microsoft.com/en-us/azure/data-factory/concepts-change-data-capture){:target="_blank" rel="noopener noreferrer"} is a top-level factory artifact created alongside pipelines rather than inside one. A configuration walkthrough takes sources, destinations, and optional transformations, and no pipeline or data flow has to be designed.

It has a property nothing else in Data Factory has. **Pipelines are batch-only; the CDC resource runs continuously.** You set a preferred latency and it wakes to look for changed data, billed for four cores of General Purpose data flow while processing. For near-continuous replication, this is the mechanism rather than a schedule trigger firing every few minutes.

### Native CDC in Mapping Data Flows

A mapping data flow can read a database's own change tracking, detecting inserted, updated, and deleted rows with **no timestamp or ID column required**. The sink applies insert, update, upsert, and delete operations directly, without an Alter Row transformation, because row markers are detected automatically.

Supported sources are SAP CDC, Azure SQL Database, SQL Server, Azure SQL Managed Instance, Azure Cosmos DB for NoSQL, the Cosmos DB analytical store, and Snowflake.

This is the approach that handles **deletes** correctly, which timestamp watermarking cannot. A row removed at the source has no modified date to compare against, so a watermark pipeline silently leaves it in the destination forever.

### Auto Incremental Extraction

Where native CDC is unavailable, a data flow can extract incrementally with less work than a hand-built watermark. Database sources need an incremental column named, and file sources use last-modified time. Data Factory builds the delta query and manages the checkpoint.

Supported sources are Blob Storage, ADLS Gen2 and Gen1, Azure SQL Database, SQL Server, Azure SQL Managed Instance, Database for MySQL, Database for PostgreSQL, and the Common Data Model format.

### Customer-Managed Watermarks

The manual pattern works against every supported store. A Lookup activity reads the last watermark from a control table, the Copy activity filters the source on it, and a stored procedure activity writes the new value back after a successful load.

Choose it when the source is outside the lists above or when you need control the built-in options do not give. Accept that it does not detect deletes and that the control table becomes state you own.

### The Checkpoint Gotcha

Native CDC and auto incremental extraction both rely on a checkpoint that Data Factory manages, and by default that checkpoint is keyed to the **pipeline name and activity name**.

Renaming either resets the checkpoint. The next run starts from the beginning or from now, depending on configuration, which means either reprocessing everything or silently skipping the changes in between. A refactor that renames an activity for clarity can therefore cause a data correctness incident with no error raised. Set an explicit **checkpoint key** on the data flow activity to decouple the checkpoint from the names.

---

## Loading Into Analytics Destinations

### Synapse Dedicated SQL Pool

Data Factory offers three mechanisms for loading a dedicated SQL pool, and Microsoft recommends the **COPY statement** or **PolyBase** over bulk insert for performance. The COPY statement is the simpler of the two, needing fewer permissions and less setup than PolyBase, which is why it is the sensible default for new work. Both use staged data in blob or ADLS Gen2, and the connector can create the destination table with `DISTRIBUTION = ROUND_ROBIN` when it does not exist.

Choosing bulk insert unknowingly is a common performance problem, because it is what you fall back to when staging is not configured.

### Key Vault for Credentials

Linked services should reference secrets in [Azure Key Vault](https://learn.microsoft.com/en-us/azure/key-vault/general/overview){:target="_blank" rel="noopener noreferrer"} rather than holding credentials. Create a Key Vault linked service, then reference secrets from other linked services so no credential appears in a pipeline definition, an ARM template, or source control.

Managed identity is better still where the target supports it, because it removes the secret entirely. Data Factory's system-assigned identity authenticates to Storage, Synapse, SQL Database, and Key Vault itself, with access granted by role assignment.

---

## Metadata-Driven Pipelines

A metadata-driven design uses one parameterized pipeline to serve many sources, reading source definitions from a configuration table.

| SourceName | SourcePath | TargetPath | Delimiter | KeyColumn | LoadType |
|------------|-----------|-----------|-----------|-----------|----------|
| CustomerData | /raw/customers/ | /curated/customers/ | comma | CustomerId | incremental |
| OrderData | /raw/orders/ | /curated/orders/ | comma | OrderId | incremental |
| ProductCatalog | /raw/products/ | /curated/products/ | pipe | ProductId | full |

A Lookup activity reads the table, a ForEach loop iterates the rows, and activities inside the loop reference `@item().SourcePath` and the other columns. Adding a source becomes a row insert rather than a pipeline change, and error handling and retry logic stay consistent because there is only one implementation.

The cost is debugging. A failure surfaces as one iteration of a loop rather than a named pipeline, monitoring shows generic activity names, and a bug in the shared pipeline breaks every source at once. Set the ForEach batch count deliberately too, since unbounded parallelism against a shared source can overwhelm it.

Start with explicit pipelines and move to metadata-driven design when the source count makes the duplication genuinely costly, somewhere past ten to fifteen sources for most teams.

---

## Cost

Data Factory bills consumption across three meters, plus SSIS cluster time.

**Orchestration activity runs** are charged per **activity run**, not per pipeline run. A pipeline with forty activities in a ForEach loop over fifty items produces two thousand activity runs, which is where orchestration cost accumulates in metadata-driven designs.

**Data Integration Unit hours** cover copy activities on an Azure IR, based on the DIU count and execution duration.

**vCore hours** cover data flow execution **and debugging**, based on compute type, vCore count, and duration. Debug sessions are billed, so a session left open costs money while nobody is using it.

**Azure-SSIS IR** is charged for cluster duration by node type and count, which is why stopping it between scheduled runs matters. A self-hosted IR has no Data Factory charge, but you pay for the VM hosting it.

Beyond these, Data Factory Operations charges cover artifact read, write, and monitoring.

### Attributing Cost to Pipelines

By default all pipelines in a factory report as one line item. Detailed per-pipeline billing is **opt-in per factory**, enabled under Manage, Factory settings, and it gives each pipeline its own billing entry within about a day.

Two details change how you use it. The setting is **not included in exported ARM templates**, so CI/CD will not propagate or overwrite it and each environment is configured independently. And three categories fall back to a factory-level line item rather than a pipeline: Data Factory Operations charges, SSIS node charges, and data flow activities running on an IR with TTL configured. On a factory with many pipelines, the report also becomes long enough to be unwieldy.

### Reducing Cost

- **Move transformation out of data flows** when volume is large. Synapse or Databricks generally does the same work more cheaply at scale, and Data Factory keeps the orchestration.
- **Use TTL on a regional Azure IR** for sequential data flows so repeated cold starts stop being billed as vCore time.
- **Load incrementally.** Native CDC or auto incremental extraction cuts DIU-hours proportionally to how much of the source is unchanged.
- **Stage into Synapse with the COPY statement** rather than falling back to bulk insert.
- **Prefer event triggers over frequent polling schedules**, so pipelines run when data arrives instead of running to discover nothing arrived.
- **Watch activity counts in loops**, since orchestration charges scale with iterations.
- **Stop the Azure-SSIS IR** when no packages are scheduled.

---

## Common Pitfalls

### Pitfall 1: A Cloud-to-Cloud Copy Executing on an On-Premises Machine

**Problem:** A self-hosted IR is set on one linked service, and a pipeline copies between two cloud stores using it on one side.

**Result:** Because either side naming a self-hosted IR pulls the whole copy activity onto that runtime, the data round-trips through your on-premises machine. Throughput collapses to that machine's bandwidth and the transfer competes with everything else it does.

**Solution:** Reserve self-hosted IRs for linked services that genuinely point at private-network stores. Audit linked services for a self-hosted IR set by copy-paste or by default, and check which IR actually ran an activity in the monitoring payload rather than assuming.

---

### Pitfall 2: Autoresolve Sending Data Through the Wrong Region

**Problem:** Linked services use the default autoresolve Azure IR in an architecture with data residency requirements.

**Result:** Autoresolve picks a region at runtime from the detected sink location, falling back to the closest region in the same geography or the factory's region. Data can be processed outside the geography a compliance obligation requires, with nothing in the pipeline definition showing it.

**Solution:** Create an Azure IR explicitly in the required region and bind linked services to it with `connectVia`. This also enables TTL for data flows, which autoresolve does not support.

---

### Pitfall 3: Renaming a Pipeline and Silently Resetting the Checkpoint

**Problem:** A pipeline or data flow activity using native CDC or auto incremental extraction is renamed during refactoring.

**Result:** The checkpoint is keyed to the pipeline and activity name, so renaming resets it. The next run either reprocesses from the beginning or captures only changes from that point forward, silently skipping everything in between. No error is raised.

**Solution:** Set an explicit checkpoint key on the data flow activity so the checkpoint survives renames. Treat any rename on a CDC-enabled pipeline as a change requiring verification of the first run afterward.

---

### Pitfall 4: Watermarks That Never Detect Deletes

**Problem:** Incremental loading is built on a `ModifiedDate` watermark against a source where rows can be deleted.

**Result:** Deleted rows have no modified date to compare, so they are never picked up. The destination accumulates records that no longer exist at the source, and reconciliation counts drift further apart every run.

**Solution:** Use native CDC where the source supports it, since it captures deletes along with inserts and updates. Where it does not, have the source soft-delete with a flag and timestamp, or periodically reconcile keys between source and destination to find orphans.

---

### Pitfall 5: Treating Data Flows as a General-Purpose Spark Engine

**Problem:** Complex, large-scale transformation is built entirely in mapping data flows.

**Result:** vCore-hour charges climb, cold cluster starts add minutes to every activity, and the visual designer becomes harder to reason about than code would have been.

**Solution:** Keep data flows for schema mapping, validation, and moderate transformation. Dispatch heavy or complex work to Databricks or Synapse, where the compute is cheaper at scale and the logic lives in reviewable code. Where data flows are the right tool and run sequentially, enable TTL on a regional IR.

---

### Pitfall 6: A Single-Node Self-Hosted IR as a Silent Single Point of Failure

**Problem:** One machine runs the self-hosted IR for every hybrid pipeline in the factory.

**Result:** Patching, a reboot, hibernation, or a hardware failure stops all hybrid data movement at once. Hibernation is the quiet one, because the runtime stops responding without the machine appearing down.

**Solution:** Associate up to four nodes with the logical runtime in active-active mode, which adds throughput as well as availability. Set the power plan so the host never hibernates, keep the machine off a domain controller, and confirm the JRE is present so Parquet, ORC, and Avro work.

---

### Pitfall 7: Expecting a Schedule Trigger to Give Backfill or Retry

**Problem:** Time-partitioned batch processing is built on a schedule trigger.

**Result:** A missed window cannot be backfilled, failed runs are not retried, there is no concurrency limit, and the trigger reports success as soon as it starts a run regardless of what happens next. Gaps appear in the processed data with no failure recorded.

**Solution:** Use a tumbling window trigger for time-partitioned work. It supports backfill from a past start date, retries on throttling and server errors, explicit concurrency limits, and window variables, and its run state reflects the pipeline run. Accept its one-to-one relationship with pipelines and use a parent pipeline where one window drives several downstream units of work.

---

### Pitfall 8: Leaving Data Flow Debug Sessions Running

**Problem:** A debug session is started during development and left open.

**Result:** Data flow debugging is billed at vCore-hours exactly like execution, so an idle session accrues charges. On a team where several people develop simultaneously, this can rival production pipeline cost.

**Solution:** Turn debug off when not actively iterating and set a short session TTL. Enable per-pipeline billing to see where consumption is going, remembering that debug and TTL-based data flow charges land in the factory-level fallback line rather than against a pipeline.

---

## Key Takeaways

1. **Data Factory in Microsoft Fabric is the documented successor.** Azure Data Factory is not retired and remains supported, but Microsoft directs new data integration work to Fabric and offers an upgrade path. Factor that into any platform decision with a multi-year horizon.

2. **Data Factory orchestrates; other services transform.** The Copy activity moves data efficiently and control flow sequences the work. Substantial transformation belongs in Synapse or Databricks, dispatched from a pipeline.

3. **There are three integration runtimes, and the Azure-SSIS one is a cluster of Azure VMs.** It runs the SSIS engine so existing packages execute unchanged. It is not Spark, and it is unsupported in Synapse pipelines.

4. **The integration runtime is chosen by precedence, not by preference.** Self-hosted beats managed-VNet Azure IR, which beats the global Azure IR, and either side of a copy naming a self-hosted IR pulls the whole activity onto it.

5. **The self-hosted IR is Windows-only, needs a JRE, and scales to four nodes.** It requires .NET Framework 4.7.2 or later on a 64-bit host, makes outbound-only connections, and is a single point of failure until you add nodes.

6. **There are three trigger types, and manual execution is not one of them.** Schedule, tumbling window, and event-based, with event covering storage events and Event Grid custom topics.

7. **Only tumbling window triggers give backfill, retry, and real completion semantics.** A schedule trigger is fire-and-forget and reports success once a run starts, which makes it unsuitable for dependent time-partitioned processing.

8. **Native change data capture is the incremental option that handles deletes.** Timestamp watermarks cannot see a removed row. Where native CDC is unavailable, auto incremental extraction still beats a hand-built watermark, and the CDC factory resource is the only continuous rather than batch mechanism.

9. **Checkpoints are keyed to pipeline and activity names.** Renaming either resets change tracking silently, so set an explicit checkpoint key on anything using CDC or auto incremental extraction.

10. **Billing is per activity run, per DIU-hour, and per vCore-hour, and debug sessions count.** Loop iterations multiply activity runs, data flow debugging bills like execution, and per-pipeline cost attribution is opt-in per factory and excluded from ARM templates.
