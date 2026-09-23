---
layout: guide
title: "Relational Databases"
category: Databases
subcategory: Database Types
description: "How relational databases (RDBMS) model data as tables joined by keys, what the declarative query planner and declared constraints buy you, where they struggle with scale and schema change, and when to look elsewhere."
tags: [relational, sql, joins, constraints, query-planning, schema-migrations, fundamentals]
---

## What They Are

Relational databases store data in tables of rows and columns, and express relationships between tables through shared values called keys. A primary key identifies each row, and a foreign key in another table refers to it. Data is read and changed with SQL (Structured Query Language), and changes run inside transactions that commit as a unit.

Edgar Codd proposed the relational model at IBM in 1970 to solve a specific problem: data independence. Applications of the time were tightly coupled to how data was physically stored, so changing the storage layout broke every application that used it. Codd separated the logical organization of data, tables and relationships, from its physical storage, which left the database engine free to change how data is stored and accessed without breaking the queries that use it.

---

## Data Structure

```
┌─────────────────────────────────────────────────────────────┐
│  CUSTOMERS TABLE                                            │
├──────────┬────────────────┬─────────────────────────────────┤
│ id (PK)  │ name           │ email                           │
├──────────┼────────────────┼─────────────────────────────────┤
│ 1        │ Alice Smith    │ alice@example.com               │
│ 2        │ Bob Jones      │ bob@example.com                 │
└──────────┴────────────────┴─────────────────────────────────┘
                │
                │ Foreign Key Relationship
                ▼
┌─────────────────────────────────────────────────────────────┐
│  ORDERS TABLE                                               │
├──────────┬──────────────┬────────────┬──────────────────────┤
│ id (PK)  │ customer_id  │ total      │ created_at           │
│          │ (FK)         │            │                      │
├──────────┼──────────────┼────────────┼──────────────────────┤
│ 101      │ 1            │ 99.99      │ 2026-01-15           │
│ 102      │ 1            │ 45.50      │ 2026-01-16           │
│ 103      │ 2            │ 200.00     │ 2026-01-16           │
└──────────┴──────────────┴────────────┴──────────────────────┘

Query: SELECT c.name, o.total FROM customers c
       JOIN orders o ON c.id = o.customer_id
       WHERE o.total > 50
```

The customer's name is stored once, and each order refers to it by ID. A join combines the two tables at query time.

---

## How They Work

### Tables, Schemas, and Types

Data lives in tables with predefined columns, and each column has a type such as integer, text, or timestamp. The database enforces the schema, so a string can't be inserted into an integer column. Data is usually normalized, meaning each fact is stored in one place and referenced elsewhere by key, which is why reassembling a complete picture of an order takes joins.

### Declarative Queries and the Query Planner

SQL describes what data you want, not how to get it. The database's **query planner** examines the query, considers the available indexes and join strategies, estimates the cost of each approach from statistics about the data, and picks an execution plan. The same query can run differently as data grows, because the planner's estimates, and therefore its choices, change. This separation is Codd's data independence in practice: add an index, and existing queries can start using it without being rewritten.

### Constraints the Database Enforces

Integrity rules are declared in the schema and enforced by the database for every client that writes to it:

- **Foreign keys** prevent an order from referencing a customer that doesn't exist.
- **Unique constraints** prevent duplicate emails or order numbers.
- **Check constraints** enforce rules such as `total >= 0`.
- **Not-null constraints** require a value.

Rules declared this way hold no matter which application, script, or administrator writes the data, which is hard to guarantee when the same rules live in application code.

### Transactions

Relational databases run changes inside ACID transactions, so a multi-row change either commits completely or not at all, and committed changes survive crashes. How much concurrent transactions see of each other depends on the isolation level, and the default in most engines doesn't protect read-then-write logic. Two customers buying the last item in stock can both succeed at the default Read Committed level unless the update is written to prevent it.

---

## Why They Excel

### Flexible Queries Over Data You Didn't Plan For

SQL can express joins across many tables, filters on any column, grouping, aggregation, and window functions in one query, and the planner works out how to run it. Questions nobody anticipated when the schema was designed can still be answered, which is the relational model's biggest advantage over stores designed around known access patterns.

### Data Integrity

Declared constraints and transactions keep the data valid without every application reimplementing the rules. For financial, inventory, and healthcare records, this is usually the deciding factor.

### Maturity and Tooling

Decades of development have produced mature backup and point-in-time recovery, replication, monitoring, and administration tools, and SQL skills are widespread among engineers and analysts.

---

## Why They Struggle

### Horizontal Scaling

The major relational engines were designed around a single primary server. Read replicas scale reads, but writes still go through one node. Splitting data across servers while keeping transactions and arbitrary joins across the splits is hard, so sharding a relational database, whether by hand or with a layer like Citus for PostgreSQL or Vitess for MySQL, limits which queries and transactions stay efficient. Distributed SQL databases were built to remove this limit.

### Schema Changes on Large Tables

Changing a table's structure requires a migration. Many changes are now quick metadata updates: PostgreSQL since version 11 adds a column with a constant default without rewriting the table, and MySQL since 8.0.12 can add columns instantly. Others, such as changing a column's type, still rewrite the whole table, which can take hours on a large one and, depending on the engine, block other queries while it runs. Teams handle these with online schema change tools or multi-step migrations that add a new column, backfill it, and switch over.

### Object-Relational Impedance Mismatch

Application objects with nested structures and inheritance hierarchies don't map naturally to flat tables. Object-relational mappers (ORMs) hide the translation, but they can generate inefficient queries, such as one query per item in a list instead of one join.

---

## When to Use Them

Relational databases remain the right default for most applications. Use them when you need:

- Transactions spanning several entities, such as an order and its line items and the inventory they reserve
- Integrity rules enforced for every writer, as in financial systems and healthcare records
- Ad hoc queries and reporting over the same data
- A team whose existing SQL expertise outweighs the benefits of something more specialized

---

## When to Look Elsewhere

Consider alternatives when:

- Write volume exceeds what a single primary can absorb, and sharding would sacrifice the joins and transactions you chose relational for
- The data is naturally hierarchical and always read whole, or naturally a graph traversed many hops deep
- The data is a high-volume stream of time-stamped measurements or logs, read mostly by time range
- The main query is full-text relevance or similarity search

---

## Examples

**PostgreSQL** is the most extensible open-source option, with JSON document support, full-text search, and extensions such as PostGIS for geospatial data and pgvector for vector search. It's often the best starting point. **MySQL**, with its InnoDB engine, is the other widely used open-source choice and runs a large share of web applications. **SQL Server** and **Oracle** are the main commercial engines, strong in enterprise features and in their vendors' ecosystems. **SQLite** is an embedded relational database that runs inside the application process, common in mobile and desktop apps.

---
