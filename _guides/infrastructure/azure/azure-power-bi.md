---
title: "Power BI for System Architects"
layout: guide
category: Azure
subcategory: Analytics & Data Processing
description: "Power BI architecture for system architects covering storage modes including Direct Lake, the Fabric capacity model that replaced Premium P SKUs, gateways, semantic model design, embedded analytics, and governance."
tags: [power-bi, microsoft-fabric, semantic-models, direct-lake, embedded-analytics, data-governance, practical]
---

## What Is Power BI

[Power BI](https://learn.microsoft.com/en-us/power-bi/fundamentals/power-bi-overview){:target="_blank" rel="noopener noreferrer"} is Microsoft's analytics platform for building semantic models and delivering interactive reports. It consists of three tools. Power BI Desktop is the Windows authoring client, Power BI Service is the cloud platform where content is published and consumed, and Power BI Mobile provides consumption on iOS and Android.

Unlike traditional BI platforms where a data warehouse team constructs every report, Power BI supports self-service analytics in which analysts and domain experts build reports directly from curated models. The platform combines data connectivity through hundreds of connectors, data transformation through Power Query, data modeling with star schemas and DAX calculations, and interactive visualization.

### Power BI Is a Microsoft Fabric Workload

Power BI is no longer a standalone product line. It is one workload inside [Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/fundamentals/microsoft-fabric-overview){:target="_blank" rel="noopener noreferrer"}, sharing a capacity model, a storage layer called OneLake, and an admin portal with Data Factory, Data Engineering, Data Science, and Real-Time Intelligence. Much of the Power BI enterprise documentation now lives under the Fabric documentation set, and the capacity SKUs you buy are Fabric SKUs.

This matters architecturally for three reasons. Capacity is shared across all Fabric workloads, so a Spark job and a semantic model refresh compete for the same compute units. Storage modes now include Direct Lake, which reads Fabric's Delta tables directly. And several Power BI-only constructs, including Premium P SKUs and real-time streaming semantic models, are being retired in favor of their Fabric equivalents.

### What Problems Power BI Solves

Without a platform like Power BI, business questions route through IT and an analytics backlog builds, data stays siloed across operational systems and warehouses, reports are static, and metric definitions multiply until nobody agrees what "revenue" means.

With Power BI, analysts author their own reports against shared semantic models that define metrics once. Row-level security and endorsement build trust in what gets published. Scheduled and near real-time refresh options keep data current, and embedded analytics push reports into customer-facing applications without giving external users Power BI accounts.

---

## Core Power BI Components

### Power BI Desktop, Service, and Mobile

**Power BI Desktop** is the authoring tool used to build semantic models, define relationships, write DAX calculations, and design report layouts. Desktop files (`.pbix`) contain the model, the queries, and the report definitions. Analysts use Desktop to shape data and validate metrics before publishing.

**Power BI Service** is the cloud platform where content is published, refreshed, secured, and consumed. It handles scheduled refresh, interactive querying, access control, and collaboration.

**Power BI Mobile** provides consumption on tablets and phones with layouts optimized for small screens. Mobile experiences are simplified views suited to monitoring rather than deep analysis.

### Workspaces Are the Capacity Boundary

A workspace is a container for reports, semantic models, dashboards, and Fabric items, organized by domain, business unit, or project. Workspaces are also the unit at which capacity is assigned. You do not put a semantic model on a capacity, you put its *workspace* on a capacity, and every item in that workspace inherits the compute, the memory ceiling, and the licensing rules of whatever capacity it sits on.

That single fact drives most Power BI capacity design. Moving one oversized model onto a larger SKU means moving its whole workspace. Mixing a heavy nightly refresh and a latency-sensitive executive report in one workspace means they share a throttling budget. The scope chain is tenant → capacity → workspace → item, and only the middle two links are things you buy.

Workspaces not assigned to a capacity run on **shared capacity**, a multi-tenant pool where performance varies with other tenants' load and per-model limits are tight. Workspaces on a **Fabric capacity** get reserved compute measured in capacity units.

### Workspace Roles

Access is granted by assigning individuals or security groups to one of four roles. The boundaries between them are narrower than the names suggest.

| Capability | Admin | Member | Contributor | Viewer |
|---|---|---|---|---|
| Update and delete the workspace | Yes | No | No | No |
| Add or remove any user in any role | Yes | No | No | No |
| Add members or others with lower permissions | Yes | Yes | No | No |
| Publish, unpublish, or change permissions for an app | Yes | Yes | No | No |
| Update an existing app | Yes | Yes | If delegated | No |
| Create, edit, and delete content in the workspace | Yes | Yes | Yes | No |
| Schedule refresh and modify gateway connections | Yes | Yes | Yes | No |
| View and interact with items | Yes | Yes | Yes | Yes |

Three details commonly trip up permission designs. Contributor and Member differ mainly over app publishing and adding people, not over content editing, so Contributor is the right default for report authors. Members can add users at lower roles but cannot change an existing user's role, which requires an admin to remove the user first. And Viewer is the role that enforces row-level security for people browsing a workspace directly, so anyone who should see filtered data must not also hold a higher role through some other group membership.

### Semantic Models, Reports, and Dashboards

Power BI content follows a dependency chain. Semantic models define structure and metrics, reports visualize them, and dashboards pin selected visuals for monitoring.

**Semantic models** (renamed from "datasets") contain the connections, transformations, relationships, and measures. A semantic model is the authoritative definition of metrics like total revenue or churn rate, and multiple reports can connect to one model so those definitions stay consistent.

**Reports** are interactive explorations built from pages of visuals. Users filter, cross-highlight, and drill down. A report connects to one semantic model, though a composite model can compose several.

**Dashboards** are curated collections of tiles pinned from reports. They give an at-a-glance view rather than an investigation surface. Dashboards are also the one content type that cannot be endorsed, and they are being displaced by organizational apps for most distribution scenarios.

### Dataflows: Self-Service Data Preparation

[Dataflows](https://learn.microsoft.com/en-us/power-bi/transform-model/dataflows/dataflows-introduction-self-service){:target="_blank" rel="noopener noreferrer"} are cloud-hosted Power Query pipelines that extract, transform, and stage data so multiple semantic models can consume the same prepared tables. Running a transformation once on a schedule beats repeating it in every model that needs it.

There are two generations, and the distinction is now a planning decision rather than a detail. **Dataflow Gen1** is the original Power BI dataflow. Microsoft describes it as being in a legacy state that will not receive new feature investment. Its output lands in Power BI-managed storage in Common Data Model format, or in your own Azure Data Lake Storage Gen2 account if you configure bring-your-own-storage. **Dataflow Gen2** is the Fabric Data Factory version and is the recommended path for customers with Fabric capacity, writing to Fabric destinations including lakehouses and warehouses as Delta tables. Pro and PPU customers without Fabric capacity can continue on Gen1.

A dataflow earns its place when transformation logic is shared across several models, when you want to keep analysts away from source credentials, or when the transformed output needs to be readable by tools outside Power BI.

### Gateways: Reaching Data Behind a Firewall

A [gateway](https://learn.microsoft.com/en-us/data-integration/gateway/service-gateway-onprem){:target="_blank" rel="noopener noreferrer"} is what lets the Power BI Service query data it cannot reach directly. It opens outbound connections to Azure and receives work as responses to its own polling, so no inbound firewall ports are required.

There are three variants, and their names have changed from the older "personal" and "enterprise" labels.

```
                    Power BI / Fabric cloud service
                                 │
                                 │  outbound-initiated only;
                                 │  the gateway polls for work
             ┌───────────────────┴────────────────────┐
             ▼                                        ▼
  On-premises data gateway                Virtual network data gateway
  (Windows host you install               (Microsoft-managed, nothing
   and patch; clustered for HA)            to install)
             │                                        │
             ▼                                        ▼
  SQL Server, Analysis Services,          Azure SQL, Storage, Synapse
  SAP, file shares inside the             and other services reachable
  corporate network                       only from inside the VNet
```

**On-premises data gateway** in standard mode serves multiple users and multiple data sources, and works with Power BI, Fabric, Azure Analysis Services, Azure Data Factory, Logic Apps, Power Apps, and Power Automate. This is the enterprise option, and clusters of gateway members provide load balancing and failover.

**On-premises data gateway (personal mode)** serves one user, cannot be shared, and works only with Power BI. It suits an individual analyst who publishes reports nobody else refreshes.

**Virtual network data gateway** is a Microsoft-managed service that requires no installation and connects to data sources secured by an Azure virtual network. It is not an on-premises connector. Reaching resources inside a private VNet is what it exists for.

Four operational constraints shape gateway design. A gateway cluster supports at most 1,000 data sources. DirectQuery responses through a gateway cap at 16 MB uncompressed. Gateway-side credential caching can take roughly five hours to reflect a credential change, so a rotated password produces refresh failures that look inexplicable. And Microsoft supports only the last six monthly releases, which makes gateway patching a standing operational task rather than a one-time install.

---

## Storage Modes: How a Query Actually Gets Answered

Power BI supports three semantic model modes in the service, [Import, DirectQuery, and Composite](https://learn.microsoft.com/en-us/power-bi/connect-data/service-dataset-modes-understand){:target="_blank" rel="noopener noreferrer"}, plus Direct Lake for models on Fabric capacity. Storage mode is a property of each *table*, which is what makes composite models possible.

```
                    DAX query from a report visual
                                 │
                                 ▼
                      table's storage mode
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
     Import                 Direct Lake              DirectQuery
        │                        │                        │
        ▼                        ▼                        ▼
 VertiPaq scans a        VertiPaq scans Delta      DAX is translated to
 cached copy loaded      columns paged in from     native SQL and run on
 fully into memory       OneLake on demand         the source database
        │                        │                        │
        ▼                        ▼                        ▼
 Refresh reloads the     Framing updates file      No refresh; the source
 data on a schedule      pointers in seconds,      carries the query load
 (8/day shared,          no data is copied         on every interaction
  48/day capacity)
        └────────────────────────┴────────────────────────┘
                                 │
                    A model mixing modes across tables is
                    a composite model. Dual-mode tables
                    answer from either side per query.
```

**Import mode** copies data into the model, where the VertiPaq engine compresses it and answers queries from memory. Compression of roughly ten to one is typical, so about 10 GB of source data lands near 1 GB in the model. The entire model must be loaded into memory to be queried. There is no partial load. That makes Import fast and flexible, since the full Power Query and DAX surface is available, but it caps model size at whatever memory the capacity allows and makes data only as fresh as the last refresh.

**DirectQuery mode** stores only metadata and issues native queries to the source on every interaction. Model size limits stop applying and no refresh is needed, but the source database absorbs the query load, and both M and DAX are restricted to expressions that can be translated into a native query. Calculated tables are unavailable. Dashboard tiles over DirectQuery can update as often as every 15 minutes, and automatic page refresh is available only on DirectQuery sources.

**Composite mode** mixes storage modes per table. Dimension tables typically sit in Import or Dual mode while a large fact table stays in DirectQuery. A Dual table behaves as either, and Power BI picks per query, which is what lets a slicer render from memory while the fact join still folds into a single native SQL statement.

**Direct Lake** is a Fabric-only mode that reads [Delta tables in OneLake](https://learn.microsoft.com/en-us/fabric/fundamentals/direct-lake-overview){:target="_blank" rel="noopener noreferrer"} directly, paging columns into memory as queries need them. Queries run on VertiPaq, so performance resembles Import, but "refresh" is a metadata operation called framing that repoints the model at the newest Delta files and completes in seconds. Direct Lake comes in two variants. Direct Lake on OneLake can span multiple Fabric sources and never falls back. Direct Lake on SQL uses a single source's SQL analytics endpoint for discovery and permission checks, and falls back to DirectQuery when it cannot read a Delta table directly, such as for a non-materialized SQL view. Direct Lake requires a Fabric capacity and cannot use any gateway, so it only reaches cloud data already landed in OneLake.

### Model Size Is a Licensing Boundary, Not a Technical One

The most common architectural mistake here is treating Import mode as having some universal size ceiling. It does not. The ceiling is whatever license the workspace sits under.

| Where the workspace runs | Max semantic model size |
|---|---|
| Shared capacity (Pro) | 1 GB, with a 10 GB cap on uncompressed data processed during refresh |
| Premium Per User | 100 GB |
| Fabric F2 to F8 | 3 GB |
| Fabric F16 / F32 | 5 GB / 10 GB |
| Fabric F64 / F128 / F256 | 25 GB / 50 GB / 100 GB |
| Fabric F512 / F1024 and above | 200 GB / 400 GB |

Memory must also be reserved for refresh and query execution, so the practical maximum sits below these numbers. A refresh roughly doubles a model's footprint, because the previous copy stays queryable while the new one is built.

### Matching a Mode to the Workload

Use Import when the model fits the capacity's memory budget and stakeholders accept data as fresh as the last scheduled refresh. Use DirectQuery when the data is too large to load or genuinely needs to be current on every interaction, and only when the source has been tested under report query load. Use Composite when a small set of tables needs freshness and the rest does not. Use Direct Lake when data already lands in OneLake as Delta tables and you have Fabric capacity, since it removes the refresh cycle entirely.

Hybrid tables are the fourth option that gets overlooked. A hybrid table holds historical data in Import partitions and the most recent window in a DirectQuery partition, which you get by enabling the real-time option on an incremental refresh policy. Hybrid tables require a capacity workspace.

---

## Capacity and Licensing

### Power BI Pro and Premium Per User

**Power BI Pro** is a per-user license covering authoring, publishing, and sharing. Pro content runs on shared capacity, which means the 1 GB model ceiling, eight scheduled refreshes per day, and no reserved compute. Every person who views Pro content also needs a Pro license.

**Premium Per User (PPU)** is a per-user license that includes everything Pro has plus most capacity-only features, including 100 GB models, 48 refreshes per day, XMLA endpoint connectivity, incremental refresh, deployment pipelines, enhanced automatic page refresh, and the AI capabilities. What PPU does not include is multi-geo support, unlimited distribution, and Power BI Report Server.

PPU is often misread as buying dedicated compute for one user. It does not. It licenses Premium *features* per person, and every viewer of PPU content needs their own PPU license. If your goal is to let a large audience read reports without paying per seat, PPU is the wrong instrument.

### Fabric Capacity and the P SKU Retirement

Microsoft is [retiring Power BI Premium per-capacity P SKUs](https://learn.microsoft.com/en-us/power-bi/support/premium-migration-overview){:target="_blank" rel="noopener noreferrer"}. New P SKUs are no longer sold, and each existing subscription ends at the end of its current agreement term. Enterprise Agreement customers with an active agreement can keep renewing existing P capacity annually until the EA term ends, but customers with expiring agreements cannot add or purchase new P capacity. Sovereign clouds are excluded for now, since Fabric is not available there. Per-user Pro and PPU licenses are unaffected, and so are the EM and A embedding SKUs.

If a P SKU lapses without an F SKU in place, the capacity enters a 30-day grace period. From day 31 interactive operations are throttled, and from day 91 all operations are rejected. Data is retained but unreachable until the workspaces are reassigned or the capacity is deleted.

Migration is manual. You buy the Fabric F SKU first, reassign workspaces, validate, and only then cancel the P subscription. The mapping is by capacity units: P1 to F64, P2 to F128, P3 to F256, P4 to F512, and P5 to F1024. Two operational differences survive the move. Autoscale does not exist on F SKUs, replaced by on-demand resizing through the Azure portal, and billing moves from Microsoft 365 commitment billing to Azure, which brings pay-as-you-go rates, pause and resume, reservations, Azure tags for chargeback, and Microsoft Azure Consumption Commitment eligibility.

### The F64 Threshold Governs Viewer Licensing

On F64 and larger, users with a free license and the Viewer role can consume content, exactly as they could on P SKUs. On F2 through F32, every viewer still needs a Pro or PPU license. That single boundary, not a headcount rule of thumb, is what determines whether capacity or per-user licensing is cheaper for a given audience.

```
Do viewers need to read content without a paid per-user license?
│
├─ No ──▶ Do authors need Premium features (XMLA, incremental refresh,
│         100 GB models, deployment pipelines)?
│         ├─ No  ──▶ Power BI Pro for every author and viewer
│         └─ Yes ──▶ Premium Per User for every author and viewer
│
└─ Yes ─▶ Are the viewers inside your tenant?
          ├─ Yes ──▶ Fabric capacity, F64 or larger
          │          (below F64 every viewer still needs Pro or PPU)
          └─ No  ──▶ App-owns-data embedding on a Fabric F SKU,
                     or a Power BI Embedded A SKU
```

### Capacity Limits by SKU

Beyond model size, each SKU caps concurrent DirectQuery connections, live connection rate, memory per query, and model refresh parallelism. F64 allows 50 concurrent DirectQuery connections per model and 40 parallel model refreshes, while F2 allows 5 and 1. Under sustained overload a capacity throttles interactive operations, delaying report rendering before it rejects anything, so the first symptom of an undersized capacity is usually slow reports rather than errors.

One limit applies regardless of SKU. Visuals that take longer than 225 seconds to render time out and do not display.

### Embedded Analytics for ISVs

Power BI [embedded analytics](https://learn.microsoft.com/en-us/power-bi/developer/embedded/embedded-analytics-power-bi){:target="_blank" rel="noopener noreferrer"} comes in two shapes, and the naming matters because the authentication model differs completely.

**Embed for your customers**, also called app-owns-data, is the ISV scenario. Your application authenticates to Power BI non-interactively using a service principal or master user, and end users never sign in to Power BI or hold a license. This is how a SaaS product ships analytics to its own customers.

**Embed for your organization**, also called user-owns-data, is the internal scenario. Users authenticate against Microsoft Entra ID and each needs a Power BI license, seeing only content they already have access to.

There is also **secure embed**, a no-code URL or iframe embed inside a portal, where the viewer still needs their own license.

For capacity, embedding is covered by every Fabric F SKU, which removes the need for a separate SKU family. Power BI Embedded A SKUs remain available as an Azure offer and are not part of the P SKU retirement, and they retain the operational advantage of hourly billing with pause and resume. For a new build, an F SKU is the simpler choice because it covers embedding and every other Fabric workload on one capacity.

---

## Architecture Patterns

### Enterprise BI: A Central Certified Semantic Model

The enterprise pattern establishes one semantic model per subject area, owned by a central analytics team and marked Certified. Business teams author reports against it rather than building their own models. Data flows from source systems through an orchestration layer like Azure Data Factory, Fabric pipelines, or Synapse pipelines into a dimensional store, and the semantic model sits on top.

The pattern buys metric consistency and a single maintenance point, and it is the only structure in which impact analysis is meaningful, because dependencies actually run through the shared model. The cost is that the central team becomes the queue for every new metric, which is a poor fit for organizations whose business units genuinely need different definitions.

### Self-Service BI on Managed Semantic Models

The middle path has IT publish curated core models that business teams can read but not modify, using Build permission to allow report authoring against them. Teams get autonomy over reports while metric definitions stay governed, and endorsement identifies which of the resulting reports deserve wider circulation.

It works when the core models are designed well enough to cover most questions. When they are not, teams quietly build their own models anyway and the governance benefit evaporates.

### Embedded Analytics Inside a Product UI

Embedding puts reports inside your application's interface so users never see Power BI as a separate product. The architectural work is in three places. The application handles its own authentication and calls Power BI with a service principal to generate embed tokens. Row-level security must be enforced through the embed token's effective identity, since every customer's data typically lives in one model. And report performance becomes your product's performance, which puts real pressure on model design.

### Real-Time Reporting After the Streaming Retirement

Power BI's original real-time streaming feature is being retired. Creation of new push semantic models, streaming semantic models, PubNub streaming semantic models, and streaming data tiles [remains enabled until 31 October 2027](https://learn.microsoft.com/en-us/power-bi/connect-data/service-real-time-streaming){:target="_blank" rel="noopener noreferrer"}, after which new ones cannot be created. Existing models are unaffected. Microsoft directs new real-time work to Real-Time Intelligence in Microsoft Fabric.

The three legacy types behave differently, which matters if you are maintaining one. A **push semantic model** writes to a real database in the service, so you can build full reports on it, subject to a limit of one request per second at 16 MB per request and one million rows per hour. A **streaming semantic model** holds data in a temporary cache for about an hour with no underlying database, so it supports only custom streaming dashboard tiles and no report visuals, filtering, or modeling. A **PubNub streaming semantic model** stores nothing in Power BI and reads a PubNub stream from the browser client. When Azure Stream Analytics creates the output model it uses both push and streaming behavior with a 200,000-row first-in-first-out retention policy.

For anything new, the current options are Direct Lake over data landed by a Fabric eventstream, DirectQuery with automatic page refresh, or Real-Time Intelligence dashboards.

### Paginated Reports for Operational and Regulatory Output

Paginated reports produce fixed-layout, print-oriented output where every row appears across as many pages as needed. That covers financial statements, regulatory submissions, invoice runs, and any document where layout is the requirement rather than interactivity.

They are authored in [Power BI Report Builder](https://learn.microsoft.com/en-us/power-bi/paginated-reports/paginated-reports-report-builder-power-bi){:target="_blank" rel="noopener noreferrer"}, a separate free download, and they have no underlying data model. Data sources and datasets are embedded in the report definition itself, though a Power BI semantic model can serve as a source. Licensing now matches regular Power BI reports rather than requiring Premium. A free license publishes to My Workspace, and Pro or PPU publishes elsewhere with at least the Contributor role. Export formats include Excel, Word, PowerPoint, PDF, accessible PDF, CSV, XML, and MHTML. Paginated report visuals cannot be pinned to dashboards.

---

## Integration with Azure Data Services

### Synapse Analytics as a Source

[Synapse Analytics](https://learn.microsoft.com/en-us/azure/synapse-analytics/overview-what-is){:target="_blank" rel="noopener noreferrer"} remains a supported Power BI source, with dedicated SQL pools serving dimensional models over Import or DirectQuery and Spark output typically materialized to a SQL table before Power BI reads it. Every current Synapse SQL documentation page now carries a successor notice naming Microsoft Fabric Data Warehouse as the destination for new warehousing work, with an upgrade path and a migration assistant for dedicated pools. Synapse is not retired and has no announced end date, but a greenfield warehouse feeding Power BI should evaluate Fabric first, particularly because Fabric unlocks Direct Lake.

### Fabric Lakehouse and OneLake

Where the data already lands in Fabric, Power BI reads it without a copy. A lakehouse or warehouse writes Delta tables to OneLake, and a Direct Lake semantic model points at them. This removes the refresh window from the architecture entirely, which is the main reason to prefer it over an Import model on the same data.

Import models get a partial version of this through OneLake integration, which writes an Import model's tables out to Delta in OneLake automatically. Other Fabric workloads can then read them through shortcuts, SQL, and notebooks without a migration.

### Azure Data Lake Storage via Dataflows

Dataflow Gen1 can persist its output to your own Azure Data Lake Storage Gen2 account in Common Data Model format, making transformed data readable by tools outside Power BI. Dataflow Gen2 writes to Fabric destinations as Delta instead, which is the better target when Fabric is in the picture, since Delta output is directly consumable by Direct Lake, Spark, and the SQL analytics endpoint.

### Azure SQL Database and Cosmos DB

Azure SQL Database works well as a Power BI source in either Import or DirectQuery mode, and Import is the usual choice unless freshness requirements force otherwise.

Cosmos DB does not require an intermediate export. The Azure Cosmos DB v2 connector supports Import and DirectQuery, with DirectQuery pushing query execution down to the container. For analytical workloads that would otherwise consume request units, the better pattern is Fabric mirroring, which continuously replicates Cosmos DB data into OneLake in near real-time without consuming RUs or affecting the transactional workload, and Power BI then reads it in Direct Lake mode.

### Azure Analysis Services vs Power BI Semantic Models

[Azure Analysis Services](https://learn.microsoft.com/en-us/azure/analysis-services/analysis-services-overview){:target="_blank" rel="noopener noreferrer"} is a separate PaaS tabular modeling service with Developer, Basic, and Standard tiers, sized by query processing units and memory. It has no announced retirement, and Microsoft supplies an automated migration path from AAS to Power BI semantic models on Fabric capacity, PPU, or Power BI Embedded.

The historical argument for AAS, that non-Power BI clients need to connect, has weakened considerably because Power BI semantic models on capacity or PPU expose an XMLA endpoint that Excel, SSMS, and third-party tools connect to the same way. What AAS still offers is query replica scale-out, up to seven additional replicas in a query pool for read concurrency, and independent pause and resize of a server that serves clients other than Power BI. For new work on a Microsoft-centric analytics stack, Power BI semantic models are generally the better default because governance, endorsement, lineage, and capacity management are unified.

### Deployment Pipelines for Content Promotion

[Deployment pipelines](https://learn.microsoft.com/en-us/fabric/cicd/deployment-pipelines/intro-to-deployment-pipelines){:target="_blank" rel="noopener noreferrer"} promote content between workspaces. A pipeline can have between two and ten stages, defaulting to three named Development, Test, and Production, and each stage is backed by a workspace.

Promotion works through item pairing. An item deployed from one stage is paired with its counterpart in the next, and only paired items overwrite each other. Two items that look identical but were never paired produce a duplicate rather than an update, which is the most common surprise when a pipeline is retrofitted onto existing workspaces. Deployment rules let you swap data source connections and parameter values per stage so a Test model points at Test data.

Deployment pipelines are not version control and offer no rollback to a prior version. Git integration is the versioning mechanism, and the two are designed to be used together. Note also that from 12 February 2026, pipelines stopped supporting semantic models not upgraded to Enhanced Metadata.

---

## Governance and Security

### Row-Level and Object-Level Security

Row-level security restricts which rows a user sees. You define roles in the semantic model, write a DAX filter expression for each, and assign users or groups to roles. Because the filter lives in the model, it applies to every report built on that model, which is exactly why a shared semantic model is the right place to enforce it.

A typical dynamic filter looks up the signed-in user in a mapping table:

```dax
[Region] = LOOKUPVALUE(
    UserRegion[Region],
    UserRegion[Email], USERPRINCIPALNAME()
)
```

Prefer `USERPRINCIPALNAME()` over `USERNAME()`, since the former reliably returns the UPN in both Desktop and the service. RLS applies to users in the Viewer role; anyone with Contributor or higher bypasses it, which is why role assignment and RLS design have to be reviewed together.

[Object-level security](https://learn.microsoft.com/en-us/power-bi/enterprise/object-level-security-overview){:target="_blank" rel="noopener noreferrer"} restricts columns and measures rather than rows, hiding salary or margin columns from roles that should not see them. One report can then serve several audiences without duplicating the logic.

### Sensitivity Labels and What They Actually Enforce

Power BI integrates with Microsoft Purview Information Protection, and the mechanics are easy to overstate. A [sensitivity label](https://learn.microsoft.com/en-us/fabric/governance/information-protection){:target="_blank" rel="noopener noreferrer"} by itself is a classification. It does not block anything. Access control comes from the Purview protection or publishing policy attached to the label, and blocking export to Excel is a Power BI tenant setting, not a property of a label named "Confidential".

What labels genuinely provide is persistence and propagation. Labels flow downstream to dependent items automatically, semantic models can inherit a label from a labeled data source, and the label plus its encryption travels with data through supported export paths including Excel, PDF, PowerPoint, Analyze in Excel, and `.pbix` download. Export to CSV or text files is not a supported path, and neither are cross-tenant scenarios, so those exits remain unprotected. Applying labels to Power BI items requires a Pro or PPU license on top of the Purview licensing.

### Endorsement: Promoted, Certified, and Master Data

Endorsement marks trustworthy content and gives it precedence in search and discovery. There are three badges, not two.

**Promoted** means the creators consider the item ready for reuse. Any user with write permission on the item can promote it.

**Certified** means an organization-authorized reviewer has confirmed the item meets quality standards. Any user can *request* certification, but only users a Fabric administrator has specified can grant it, and that authority can be delegated per domain so different domains have different reviewers.

**Master data** marks an item as the authoritative source for a category of organizational data such as product codes or customer lists. It applies only to items that hold data, like semantic models and lakehouses, and only administrator-specified users can apply it.

Certification and master data endorsement must be enabled by a Fabric administrator before either appears. Every Fabric and Power BI item except Power BI dashboards can be promoted or certified.

### Lineage and Impact Analysis

Lineage view shows the dependency chain from data sources through dataflows and semantic models to reports and dashboards. Impact analysis reverses the question and reports how many downstream items a change would touch, and which workspaces they live in.

The practical use is a pre-change gate. Before altering or removing a column in a shared semantic model, impact analysis identifies the reports that would break, and it can notify their owners. Its accuracy depends on dependencies actually flowing through Power BI items, so a report that reaches around the model to query the source directly will not appear.

### Tenant Settings as Guard Rails

Fabric administrators configure tenant-wide policies that set the outer boundary of what workspace admins can permit. Common levers include who can create workspaces and semantic models, whether export to Excel, PDF, or `.pbix` is allowed, whether external guest users can be invited, whether publish to web is permitted, and which connectors are available. Most settings can be scoped to security groups, which is what makes them usable in a large tenant rather than a blunt on-off switch.

---

## Performance and Optimization

### Star Schema Design Is a Compression Decision

VertiPaq is a columnar engine, and it compresses a column better the fewer distinct values that column holds. That single property is why star schemas outperform wide tables in Power BI.

A star schema keeps measurements in a narrow fact table and descriptive attributes in dimension tables:

- **FactSales** with order id, product key, customer key, date key, and amount
- **DimProduct** with product key, name, category, subcategory
- **DimCustomer** with customer key, name, segment, region
- **DimDate** with date key, year, month, day, quarter

Reports filter on dimension attributes and aggregate fact measures, and relationships propagate the filter. The alternative, a denormalized table with hundreds of columns, repeats every product name and category on every fact row. Those high-cardinality repeated strings compress poorly, the model balloons in memory, and refresh reloads the whole structure because there is nothing smaller to reload.

Design measures in DAX rather than materializing them as columns. A calculated column is stored and consumes memory in every row; a measure is computed at query time and costs nothing at rest.

### Aggregations for Large DirectQuery Models

[User-defined aggregations](https://learn.microsoft.com/en-us/power-bi/transform-model/aggregations-advanced){:target="_blank" rel="noopener noreferrer"} cache a summarized version of a large table in memory so summary queries never reach the source. The critical constraint is one many designs miss: **the detail table must use DirectQuery storage mode, not Import.** Aggregations exist to make DirectQuery models interactive, so a fully imported model gains nothing from them.

The aggregation table is normally set to Import mode, related dimension tables move to Dual, and the aggregation table is hidden. Consumers query the detail table and never reference the aggregation, and the engine redirects the query when the requested grain is covered. Queries at a finer grain fall through to DirectQuery automatically. A precedence value lets several aggregation tables at different grains be considered in order.

Row-level security has a specific requirement here. An RLS expression must filter both the aggregation table and the detail table, since answering from an aggregation the filter cannot reach would leak data. Filtering only the aggregation table is rejected outright.

Automatic aggregations are a separate capacity feature that creates and maintains these tables from observed query patterns rather than by hand.

### Query Folding

Query folding is Power Query pushing transformation steps down into the source as native query syntax. Filter rows where amount exceeds 100 against a SQL source and the filter becomes a `WHERE` clause executed by the database, so only matching rows cross the wire. Break folding and Power Query loads the full table and filters in memory afterwards.

Steps fold when they have a native equivalent. Custom M functions, some merges, and anything referencing a non-foldable prior step will break the chain, and every step after the break also runs locally. Check folding with the View Native Query option in Power Query and with Power Query diagnostics, and treat the first non-folding step as the point to fix, since nothing after it can recover.

### Incremental Refresh and Hybrid Tables

Incremental refresh partitions a table by date so each refresh reloads only a recent window instead of the whole history. A policy that keeps five years of history and refreshes ten days turns a multi-hour reload into minutes, and it is the difference between a large Import model being viable and not.

Enabling the real-time option on that policy adds a DirectQuery partition on top of the imported ones, producing a hybrid table where historical data is served from memory and the newest rows come straight from the source. A hybrid table can hold many Import partitions but only one DirectQuery partition, and hybrid tables require a capacity workspace.

### Monitoring with the Fabric Capacity Metrics App

The [Microsoft Fabric Capacity Metrics app](https://learn.microsoft.com/en-us/fabric/enterprise/metrics-app){:target="_blank" rel="noopener noreferrer"} is the tool for capacity health, and it supersedes the older Premium metrics app. A capacity admin installs it and can share the report with others.

Its pages answer distinct questions. The Health page ranks capacities by consumption and flags throttling or rejected queries. The Compute page gives a 14-day view of capacity unit consumption broken down by item and operation. The Storage page covers 30 days including soft-deleted data. The Timepoint pages drill into a specific 30-second interval to identify which interactive or background operations caused an overload.

Two limitations shape how you use it. Data lands 10 to 15 minutes behind the activity, and the app has no alerting, so alerts on capacity health need Fabric capacity events in Real-Time hub instead. The app does not support PPU, which has no capacity to monitor.

---

## Comparison with Amazon Quick Suite

AWS's BI service has been rebranded, and QuickSight now sits inside [Amazon Quick Suite](https://aws.amazon.com/quick/quicksight/faqs/){:target="_blank" rel="noopener noreferrer"} alongside AWS's broader AI workplace tooling. The comparison below reflects that product.

| Concept | Amazon Quick Sight | Power BI |
|---|---|---|
| **Authoring** | Browser-based only; no desktop client | Power BI Desktop (Windows) plus web authoring |
| **Modeling depth** | Datasets with calculated fields and joins | Full tabular semantic model with DAX, relationships, RLS/OLS, calculation groups |
| **Data preparation** | Native joins, filters, type changes, calculated fields | Power Query with the M language and a graphical editor |
| **In-memory engine** | SPICE, with 10 GB included per provisioned Author | VertiPaq, sized by the workspace's license or capacity SKU |
| **Licensing** | Per-user roles (Reader, Author, Reader Pro, Author Pro), plus capacity-based reader sessions | Per-user (Pro, PPU) or capacity (Fabric F SKUs) |
| **Free viewers** | Readers are per-user or session-billed | Free licenses can view on F64 and larger |
| **Real-time** | Streaming ingestion into SPICE | Legacy streaming models retiring 31 Oct 2027; Fabric Real-Time Intelligence going forward |
| **Row-level security** | RLS on datasets, including tag-based RLS for embedded users | RLS and OLS in the semantic model, enforced across every report on it |
| **Embedding** | Embedded dashboards and consoles | App-owns-data or user-owns-data on any Fabric F SKU |
| **Warehouse affinity** | Redshift and Athena | Synapse, Fabric Warehouse, SQL Server, Azure SQL |
| **Governance** | Folders, sharing controls, dataset permissions | Workspaces, three endorsement badges, lineage, impact analysis, Purview labels |

The structural difference is where the model lives. Power BI centralizes metric definitions in a semantic model that many reports consume, which is what makes certification, impact analysis, and one-place RLS possible. Quick Sight's dataset layer is lighter, which lowers the barrier to a first dashboard and raises the cost of keeping fifty of them consistent.

---

## Common Pitfalls

### Pitfall 1: Uncontrolled Semantic Model Proliferation

**Problem:** Each team builds its own semantic model without coordination, and the tenant accumulates dozens with overlapping data and conflicting definitions of revenue.

**Result:** Users cannot tell which model to trust. Metric disagreements surface in meetings rather than in review. Refresh load multiplies across models reading the same source.

**Solution:** Publish curated core models and grant Build permission rather than letting teams import the same sources repeatedly. Use Certified endorsement so the authoritative model is visibly different from the rest, and audit for duplicates using lineage.

---

### Pitfall 2: DirectQuery Without Source Load Testing

**Problem:** A DirectQuery report ships against a production SQL database without anyone measuring what report interaction does to that database.

**Result:** Reports load slowly, the source database carries a query pattern it was never tuned for, and users abandon the dashboards.

**Solution:** Test with realistic concurrency before release. Watch query duration and source-side resource use, not just report render time. Where queries are slow, move to Composite with a Dual-mode dimension layer, or add user-defined aggregations over the DirectQuery fact table.

---

### Pitfall 3: Wide Denormalized Tables Instead of a Star Schema

**Problem:** CSV extracts or a single denormalized view are loaded directly into a model with no dimensional design.

**Result:** High-cardinality strings repeat across every row, compression collapses, the model consumes far more memory than the source size suggests, and refresh reloads everything.

**Solution:** Split facts from dimensions before loading. Push the transformation upstream into a dataflow, warehouse, or lakehouse so it is done once. Define metrics as measures rather than calculated columns.

---

### Pitfall 4: No Refresh Monitoring

**Problem:** Models are scheduled for daily refresh and nobody watches whether the refreshes succeed.

**Result:** Reports show stale data for days before someone notices, and the dashboards lose credibility permanently.

**Solution:** Configure refresh failure notifications to a distribution group rather than one person. Track refresh duration as a leading indicator, since a refresh creeping toward its window is the warning before it fails. Publish an explicit freshness expectation on the report itself.

---

### Pitfall 5: Embedding Without Row-Level Security

**Problem:** A dashboard is embedded in a customer-facing application with no RLS, so the model contains every customer's data with nothing filtering it per tenant.

**Result:** One customer sees another's data. This is a data breach, not a bug.

**Solution:** Implement RLS in the semantic model and pass the effective identity in the embed token. Test with sample identities for several tenants before release, and treat that test as a release gate rather than a one-time check.

---

### Pitfall 6: Designing Against the Wrong Capacity Limits

**Problem:** A model is designed assuming a size or refresh budget the workspace's license does not provide, such as planning a 20 GB Import model for a Pro workspace capped at 1 GB, or scheduling hourly refreshes on shared capacity limited to eight per day.

**Result:** Refreshes fail outright or the workspace has to be moved onto capacity as an emergency purchase rather than a planned one.

**Solution:** Establish the target license and SKU before model design, not after. Size against the SKU's maximum memory with headroom for the refresh, which roughly doubles the footprint. Where a model genuinely exceeds what the budget allows, redesign toward DirectQuery, aggregations, or Direct Lake rather than buying the next SKU up.

---

## Key Takeaways

1. **Capacity is assigned to workspaces, not to individual models or reports.** Every item in a workspace inherits that capacity's memory ceiling, throttling budget, and viewer licensing rules, so workspace layout is a capacity design decision.

2. **Power BI Premium P SKUs are retiring and Fabric F SKUs are the replacement.** New P SKUs are no longer sold and each subscription ends with its agreement term, with a 30-day grace period followed by throttling and then rejection. Migration is manual, so plan it before the term ends.

3. **F64 is the threshold where free licenses can view content.** Below it, every viewer needs Pro or PPU regardless of capacity size. That boundary, not a user-count heuristic, decides between capacity and per-user licensing.

4. **Semantic model size limits come from the license, not from the engine.** Shared capacity caps a model at 1 GB, PPU at 100 GB, and Fabric SKUs range from 3 GB to 400 GB. Reserve headroom, since a refresh roughly doubles the footprint.

5. **Storage mode is a per-table property, which is what makes composite models work.** Import for speed, DirectQuery for size and freshness, Direct Lake for Delta data already in OneLake, and Dual for tables that should answer from whichever side is cheaper per query.

6. **Direct Lake replaces the refresh cycle with framing.** Where data lands in OneLake as Delta tables and a Fabric capacity is available, it delivers Import-like query performance without copying data or scheduling reloads.

7. **Real-time streaming in Power BI is being retired.** New push, streaming, and PubNub semantic models cannot be created after 31 October 2027. Design new real-time work on Fabric Real-Time Intelligence.

8. **A sensitivity label classifies; a Purview policy enforces.** Labels propagate downstream and survive supported export paths like Excel and PDF, but export to CSV is not one of them, and blocking Excel export is a tenant setting rather than a label property.

9. **Aggregations only help DirectQuery models.** The detail table must be in DirectQuery storage mode, and RLS expressions must filter both the aggregation and the detail table or the aggregation will be refused.

10. **Endorsement has three badges and administrator-gated authority.** Anyone with write access can promote, but only users a Fabric administrator designates can certify or mark master data, and both must be enabled at the tenant before they appear.
