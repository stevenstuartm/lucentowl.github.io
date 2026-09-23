---
layout: guide
title: "Analytical Data Architecture"
category: Data & Analytics
subcategory: Analytics
description: "How organizations move operational data into analytical systems: ETL and ELT pipelines, batch and stream processing, warehouses, lakes, and lakehouses with open table formats, dimensional modeling, and data mesh."
tags: [data-architecture, elt, data-warehouse, data-lakehouse, dimensional-modeling, data-mesh, practical]
redirect_from:
  - /study-guides/data-architecture.html
---

## Why Analytical Data Lives Apart

Operational databases run the business one transaction at a time: place this order, update that account. Analytical questions look across everything at once: revenue by region per month, churn by signup cohort, which products sell together. Those queries scan and aggregate millions or billions of rows, and running them against the operational database competes with customers for the same resources.

So analytical data usually lives in a separate system, organized for reading large volumes rather than for small, fast transactions. Analytical data architecture is the set of decisions about how data gets from the operational systems into that separate place, what shape it takes there, and who owns it.

---

## Moving Data: ETL and ELT

### Extract

Extraction pulls data out of source systems such as application databases, SaaS tools through their APIs, files, and event streams. A **full extraction** copies everything each time, which is simple but only practical for small datasets. An **incremental extraction** copies only what changed since the last run, using a last-modified timestamp or, more reliably, change data capture from the source database's transaction log, which also catches deletes.

### Transform

Transformation turns raw, inconsistent data into something analysts can trust:

- **Cleaning**: "N/A", "NULL", an empty string, and "Not Available" all become a real null
- **Standardizing**: "M/F", "Male/Female", and "1/0" become one consistent code
- **Joining**: customer records from the CRM combined with purchases from the e-commerce platform
- **Business logic**: raw transactions turned into measures like customer lifetime value

Transformation is where most of the effort and most of the bugs in a data pipeline tend to live, because it encodes business definitions that different teams may not agree on.

### Load

Loading writes the result into the analytical store. A **full load** replaces the target table each run. An **incremental load** inserts new rows and updates changed ones, usually with a merge on a key. Loads should be idempotent, meaning a run can be repeated after a failure without duplicating data, because pipelines fail and get rerun.

### ETL vs. ELT

**ETL** transforms data before loading it, on separate processing infrastructure, so only cleaned data reaches the warehouse. It suited on-premises warehouses where storage and compute were expensive and fixed.

**ELT** loads raw data first and transforms it inside the warehouse with SQL. Cloud warehouses made this the common default, because storage is cheap, compute scales on demand, and keeping the raw data means a transformation can be fixed and rerun without extracting again. Tools like dbt manage those in-warehouse SQL transformations as version-controlled, tested code. ETL remains the better fit when data must be filtered or masked before it lands, such as removing personal data that the warehouse isn't allowed to hold.

{% include figure.html id="db-elt-flow" %}

### Where Pipelines Break

Pipelines fail in predictable ways. A source system renames a column or changes a type, and every downstream transformation breaks or, worse, silently produces nulls. Data arrives late or out of order. An API rate-limits the extraction. A logic change needs history recomputed, called a backfill. Teams defend against these with schema checks at ingestion, data quality tests on each transformation, alerting on freshness and row counts, and **data contracts**, agreements between the team producing data and the teams consuming it about its schema and meaning.

---

## Batch and Stream Processing

**Batch processing** handles data in scheduled chunks, such as last night's sales processed at 2 a.m. It's simpler, cheaper, and easy to rerun, and the results are hours old.

**Stream processing** handles each event within seconds of its arrival, which suits fraud detection, live dashboards, and alerting. It costs more to build and operate, and handling late or out-of-order events correctly is hard.

Large-scale batch processing grew out of MapReduce, the model Google published in 2004 and Hadoop popularized: split the work into a map step that runs in parallel across many machines and a reduce step that combines the partial results. Current engines like Apache Spark generalize that into multi-step dataflows that keep intermediate data in memory, and most also process streams. Many organizations run both batch and streaming paths over the same data. The Lambda and Kappa architectures are two ways of organizing that combination.

---

## Where Analytical Data Lives

### Data Warehouse

A data warehouse stores structured, modeled data in columnar tables and answers SQL queries over it quickly. Data is cleaned and shaped before analysts query it, so it's the trusted source for dashboards, financial reporting, and regulatory numbers. Snowflake, Google BigQuery, Amazon Redshift, and Azure Synapse are common cloud warehouses. The limitation is that data has to fit the warehouse's tables, and raw or unstructured data such as logs, images, and free text doesn't.

### Data Lake

A data lake stores raw data of any kind as files in cheap object storage such as Amazon S3 or Azure Data Lake Storage, often in columnar file formats like Parquet, and applies structure only when it's read. It suits data science, machine learning, and exploration, where the raw data's full detail matters. Without cataloging and governance, a lake tends to become a "data swamp" that nobody can find anything in or trust. Plain files also offer no transactions, so a reader can see a half-written update.

### Data Lakehouse

A lakehouse adds warehouse features to the files in a lake. The key piece is an **open table format**, such as Delta Lake, Apache Iceberg, or Apache Hudi, which keeps a transaction log and metadata alongside the Parquet files. That log gives the tables ACID commits, schema enforcement and evolution, and time travel to earlier versions, while the data stays in open files in the organization's own storage. Engines like Spark, Trino, Databricks, and Snowflake can all query the same tables. Lakehouses commonly organize data in layers that each add refinement, often called bronze for raw data, silver for cleaned data, and gold for business-ready tables.

| Architecture | Stores | Best for | Main trade-off |
| --- | --- | --- | --- |
| Warehouse | Modeled, structured tables | Trusted reporting and BI | Only structured data, traditionally held in the vendor's own storage format |
| Lake | Raw files of any kind | Data science, ML, exploration | Becomes a swamp without governance, and has no transactions |
| Lakehouse | Files plus an open table format | Reporting and data science on one copy of the data | More moving parts to operate than a managed warehouse |

A small organization with clear reporting needs is usually best served by a managed warehouse. A lakehouse earns its complexity when large volumes of raw or semi-structured data and data science workloads sit alongside reporting.

---

## Dimensional Modeling

Analytical tables are usually shaped differently from operational ones. The dominant approach, dimensional modeling, splits data into two kinds of table.

**Fact tables** record events and their measures: each row is a sale, with a quantity, a price, and keys pointing to the context of the sale. They're long and narrow, and they grow continuously.

**Dimension tables** describe that context: the customer, the product, the store, the date. They're wide, holding many descriptive attributes to filter and group by, and they change slowly.

A fact table surrounded by the dimensions it references forms a **star schema**. A query joins the fact table to a few dimensions and aggregates, such as total sales by product category and month, a shape that warehouses are optimized to run. Unlike an operational schema, dimensions are deliberately denormalized so that queries need few joins.

Dimensions change over time, and the model has to decide what history to keep. When a customer moves from Seattle to Denver, a **type 1** change overwrites the city, so all past sales now appear under Denver. A **type 2** change adds a new row for the customer with effective dates, so past sales stay attributed to Seattle and new ones to Denver. These are called **slowly changing dimensions**, and choosing the type per attribute is one of the core modeling decisions.

---

## Data Mesh

Data mesh, a set of principles Zhamak Dehghani proposed in 2019, is about organization rather than technology. Instead of one central data team building every pipeline, each business domain owns its analytical data and publishes it for others to use. It rests on four principles:

- **Domain ownership**: the team that runs a business area owns that area's analytical data, because it understands the data best
- **Data as a product**: each domain publishes datasets with documented schemas, quality guarantees, and named owners, treating other teams as customers
- **Self-serve platform**: a central platform team provides the storage, pipeline, and access tooling so domains don't each build their own
- **Federated governance**: standards for security, interoperability, and quality are set jointly and applied by each domain

Data mesh fits large organizations where a central data team has become a bottleneck and domains have the engineering capacity to own their data. It fits poorly in small organizations or where domain teams lack data engineering skills, since it spreads responsibility across teams that have to be able to carry it.

---
