---
title: "Amazon Quick Sight: Dashboards & Embedded Analytics"
layout: guide
category: AWS
subcategory: Analytics & Data Processing
description: "How Amazon Quick Sight, the BI capability of Amazon Quick (formerly QuickSight), delivers dashboards and embedded analytics: datasets, SPICE versus direct query, connecting to AWS data privately, row- and column-level security, embedding for registered and anonymous users, multi-tenancy, generative BI, and how per-user and capacity pricing work."
tags: [quick-sight, business-intelligence, dashboards, spice, embedded-analytics, row-level-security, practical]
---

## What Quick Sight Is Now

Amazon QuickSight, AWS's business intelligence service, became part of **Amazon Quick Suite** in October 2025, and the suite is now called **Amazon Quick**. The BI capability continues as **Amazon Quick Sight**, alongside AI agents, research, workflow automation, and app building in the same product. Existing dashboards, datasets, and analyses carried over unchanged, and the QuickSight APIs and SDKs still work under their old names, so code and documentation that say "QuickSight" still apply.

This guide covers Quick Sight: building dashboards over AWS data, securing them, embedding them in applications, and paying for them. A Quick subscription belongs to one AWS account, which is also the unit for users, data sources, and billing. Capacity for Quick Sight's in-memory engine is bought and stored per Region. The account's identity method is chosen when it subscribes, and it decides who can sign in. Options include IAM Identity Center, IAM with federation to an identity provider, Active Directory, and Quick Sight's own user accounts, and some newer Regions offer only IAM Identity Center. Quick Sight has a Standard and an Enterprise edition, and row-level security, embedding, incremental refresh, and private connections to a VPC need Enterprise, which this guide assumes.

---

## From Data to Dashboard

Quick Sight content is built in four layers:

| Object | What it is |
|---|---|
| **Data source** | A connection to a database, warehouse, S3, or SaaS application, with its credentials and network path |
| **Dataset** | A shaped view of a data source: chosen tables or a custom SQL query, joins, calculated fields, renamed columns, and security rules. One dataset can feed many dashboards |
| **Analysis** | An author's workspace, where visuals, filters, parameters, and calculations are built against one or more datasets |
| **Dashboard** | A published, read-only snapshot of an analysis that readers view and interact with |

Datasets are where most design decisions land. A dataset shared by many dashboards keeps one definition of "revenue" and one set of security rules, and changes to it reach every dashboard that uses it. Many dashboards each built on their own copy of the same query drift apart and multiply refresh cost.

---

## SPICE or Direct Query

Each dataset either queries its source live or imports data into **SPICE**, Quick Sight's in-memory engine.

| | Direct query | SPICE |
|---|---|---|
| **Where visuals get data** | A query to the source for every visual on every view | Quick Sight's own in-memory copy |
| **Freshness** | Current as of the query | As of the last refresh |
| **Speed** | Whatever the source returns. A visual times out after 2 minutes | Fast and consistent, independent of the source |
| **Load on the source** | Every viewer, every interaction | Only the refreshes |
| **Cost** | The source's query cost, such as Athena's per-TB charge, on every view | 10 GB included with each author, then $0.38 per GB-month, plus the refresh queries |
| **Limit** | The source's own | 2 billion rows or 2 TB per dataset |

SPICE suits most dashboards. A dashboard on Athena in direct-query mode pays for a scan every time anyone opens it or changes a filter, while the same dashboard on SPICE pays for one scan per refresh. A full refresh can run at most hourly. **Incremental refresh**, for SQL sources, reloads only a recent window, such as the last day, and can run as often as every 15 minutes, which keeps frequent refreshes cheap on large tables. Direct query fits data that must be current to the minute, sources with their own fast serving layer, such as a Redshift cluster sized for dashboards, and data too large or too sensitive to copy.

Refreshes run on a schedule or through the API, so a pipeline can refresh a dataset right after its load finishes rather than on a clock that may run before the data lands.

---

## Connecting to AWS Data

Quick Sight connects directly to Athena, Redshift, RDS and Aurora, OpenSearch Service, files in S3 listed in a manifest file, and many databases and SaaS applications outside AWS. Two things decide whether a connection works.

**Permissions.** Quick Sight reads AWS data through a service role that an administrator grants access to specific S3 buckets, Athena workgroups, and other resources. Tables governed by Lake Formation, AWS's permission layer over data lake tables, also need Lake Formation grants for the users or the role.

**Network path.** A source inside a VPC, such as a private Redshift cluster or RDS instance, needs a **VPC connection**, which places network interfaces for Quick Sight in chosen subnets with a security group the source allows. Without it, Quick Sight can only reach sources with public endpoints.

---

## Controlling Who Sees What

**Row-level security (RLS)** restricts which rows each user sees in a dataset. A rules dataset maps users or groups to the values they may see, such as `region = 'EMEA'`, and Quick Sight applies it to every query and every SPICE read. Tag-based RLS applies rules from tags an application passes when it embeds a dashboard for anonymous users, covered below, which is how the application carries its own tenant or user identity through. **Column-level security** hides chosen columns from users and groups who aren't allowed to see them.

Security set on a dataset follows it into every dashboard built on it, which is another reason to share datasets rather than copy them. Dashboards themselves are shared with specific users and groups, and **folders** organize content and permissions for teams.

For software sold to many customers, **namespaces** separate users, groups, and content into isolated tenants within one account, so a dashboard can't be shared across tenants by mistake.

---

## Embedding Analytics in Applications

Embedding puts dashboards, individual visuals, the question bar for natural-language Q&A, or the full authoring console inside another application. The application's backend calls a Quick Sight API to generate an embed URL for the current user, valid for 5 minutes and usable once, which opens a session lasting up to 10 hours, and the frontend loads it in a frame through the embedding SDK. The domains allowed to host embedded content are allowlisted in Quick Sight.

{% include figure.html id="aws-quicksight-embedding" %}

There are two kinds of embedding:

- **Registered users** (`GenerateEmbedUrlForRegisteredUser`). Each viewer is a Quick Sight user, and permissions, RLS, and pricing apply to them as users. It fits internal portals and applications whose users already exist in Quick Sight.
- **Anonymous users** (`GenerateEmbedUrlForAnonymousUser`). Viewers aren't Quick Sight users. The backend authenticates them itself, names the namespace they belong to, and passes session tags, such as a tenant ID, that drive tag-based RLS. It needs session-based capacity pricing, described below, and it fits customer-facing applications with many end users.

Anonymous embedding moves the security boundary into your backend. Quick Sight trusts whatever tags the backend supplies, so the backend must derive them from its own authenticated session, never from parameters the browser sends.

---

## Generative BI

Quick Sight's generative features work in natural language. **Topics** describe a dataset's fields in business terms so that any reader can ask "what were EMEA sales last quarter" and get a visual. How good the answers are depends mostly on the topic: field names, synonyms, and which fields count as dimensions and measures. The Pro roles, described below, add more. Reader Pro users get AI summaries of dashboards, build **data stories** (narrative documents drafted from dashboard data) that any reader can then read, and run **scenarios**, which model what-if changes to the numbers. Author Pro users also build dashboards and calculations by describing them, and create topics.

---

## What Quick Sight Costs

Quick Sight users have one of four roles. Reader and Author are the BI-only subscriptions. Reader Pro and Author Pro are the same people on the Amazon Quick Professional and Enterprise subscriptions, which bring Quick's agents, research, and automation along with generative BI. Those subscription tiers are separate from the Quick Sight Enterprise edition described earlier, which any role can use:

| Role | Price | Can |
|---|---|---|
| **Reader** | $3 per user-month | View and interact with dashboards, ask questions of topics, read shared data stories, receive reports and alerts |
| **Reader Pro** (Quick Professional) | $20 per user-month | Reader, plus dashboard summaries, building and sharing data stories, and scenarios |
| **Author** | $24 per user-month, with 10 GB of SPICE | Connect data, build datasets and analyses, publish dashboards |
| **Author Pro** (Quick Enterprise) | $40 per user-month | Author, plus building dashboards by description, creating topics, summaries, data stories, and scenarios |

An account with any Pro user, or with Q&A turned on, pays a $250 monthly infrastructure fee. **SPICE** beyond the 10 GB each author brings costs $0.38 per GB-month. **Reader capacity pricing** replaces per-reader fees with prepaid sessions of 30 minutes, from 500 sessions for $250 a month ($0.50 each) to annual commitments that start at 50,000 sessions for $20,000 ($0.40 each) and fall to $0.16 each at the largest, and anonymous embedding requires it.

Consider an internal deployment with 10 authors, 500 readers, and 150 GB of SPICE. The authors bring 100 GB, so the bill is $240 for authors, $1,500 for readers, and $19 for the extra 50 GB, about $1,760 a month. The same 500 viewers embedded anonymously in a customer application, averaging 4 sessions each a month, need 2,000 sessions, about $1,000 a month at $0.50 each. An annual commitment only pays off above about 50,000 sessions a year, twice this volume. Per-user pricing fits a known population of regular viewers. Capacity pricing fits large or occasional audiences, and it's the only option for viewers who aren't Quick Sight users.

---

## Managing Quick Sight as Code

Dashboards and datasets are account resources, so promoting them from a development account to production is a deployment problem, not a copy-and-paste one. The **asset bundle** APIs export a dashboard with its analyses, datasets, and data sources as a bundle, and import it into another account, with overrides for account-specific values such as data source endpoints. The API also creates and updates dashboards from JSON definitions, which lets them live in source control and move through a pipeline.

---

## When Quick Sight Is the Wrong Tool

- **An organization standardized on another BI tool.** Tableau, Power BI, and Looker connect to Athena and Redshift as well, and a second BI tool splits definitions and skills. Quick Sight's advantages are pay-per-reader pricing with no servers, IAM and VPC integration, and anonymous embedding priced by session.
- **Operational metrics and alerting.** Service latency, error rates, and infrastructure dashboards belong in CloudWatch dashboards or Grafana, which read metrics and logs directly and alert on them.
- **Exploratory analysis in code.** Data scientists exploring in Python or SQL notebooks work faster in notebooks than in a dashboard tool.
- **Highly formatted, paged reports.** Invoice-style and regulatory reports need pixel-perfect layout, which Quick Sight offers as a separately priced add-on, and which dedicated reporting tools may do better.

---

## Common Pitfalls

- **Direct query on Athena for busy dashboards.** Every viewer and every filter change runs a scan. Import into SPICE and refresh after the pipeline loads.
- **RLS applied in the dashboard instead of the dataset.** Dashboard filters are a convenience that users can change. Security belongs in the dataset's row-level rules.
- **Trusting browser input for embedding tags.** Tags for anonymous embedding must come from your backend's authenticated session.
- **Refresh schedules that race the pipeline.** A clock-based refresh that runs before the day's load finishes shows yesterday's data all day. Trigger refreshes from the pipeline through the API.
- **Choosing the identity method in a hurry.** The sign-in method set at subscription decides who can be a registered user and how embedding works, so settle it before rollout.

---

## Key Takeaways

- Quick Sight is the BI capability of Amazon Quick, formerly QuickSight. Its APIs, dashboards, and datasets carried over unchanged.
- Content flows from data sources to shared datasets, analyses, and published dashboards. Datasets hold calculations and security, so share them.
- SPICE imports data for fast, predictable dashboards, with 10 GB per author and $0.38 per GB-month beyond, up to 2 billion rows or 2 TB per dataset. Direct query keeps data live and runs every visual against the source.
- Private sources need a VPC connection, and AWS sources need permissions granted to Quick Sight's service role or through Lake Formation.
- Row- and column-level security live in the dataset. Namespaces separate tenants, and tag-based RLS carries an application's identity into embedded dashboards.
- Readers cost $3 a month and authors $24. The Pro roles are the Quick Professional and Enterprise subscriptions, adding generative BI and a $250 account fee, and capacity pricing sells 30-minute reader sessions for large or anonymous audiences.
