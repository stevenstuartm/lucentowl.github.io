---
layout: guide
title: "Relational Databases"
category: Databases
subcategory: Database Types
description: "Deep dive into relational databases (RDBMS)—how they work, when they excel, and when to consider alternatives."
tags: [databases, relational, sql, acid, transactions, data-modeling, fundamentals]
---

## What They Are

Relational databases store data in tables composed of rows and columns, where relationships between tables are expressed through shared values (foreign keys). They use SQL (Structured Query Language) for data manipulation and enforce ACID properties for transactions.

The relational model was invented by Edgar Codd at IBM in 1970 to solve a specific problem: data independence. Before relational databases, applications were tightly coupled to how data was physically stored on disk. Change the storage layout, and you'd break every application that used it. Codd's insight was to separate logical data organization (tables and relationships) from physical storage, allowing the database engine to optimize storage independently.

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
│ 101      │ 1            │ 99.99      │ 2024-01-15           │
│ 102      │ 1            │ 45.50      │ 2024-01-16           │
│ 103      │ 2            │ 200.00     │ 2024-01-16           │
└──────────┴──────────────┴────────────┴──────────────────────┘

Query: SELECT c.name, o.total FROM customers c
       JOIN orders o ON c.id = o.customer_id
       WHERE o.total > 50
```

Data is normalized across tables. The customer's name appears once; orders reference it by ID. A join combines the data at query time.

---

## How They Work

### Tables and Schemas

Data lives in tables with predefined columns. Each column has a type (integer, string, date). The database enforces this schema, so you cannot insert a string into an integer column. This rigidity prevents bad data from entering the system.

### Normalization

Relational design emphasizes eliminating data duplication. Instead of storing a customer's address with every order, you store the address once in a customers table and reference it by ID from the orders table. Updates to the address automatically apply everywhere. This is called normalization.

### Indexes

To find data quickly, relational databases build indexes. These separate data structures map column values to row locations. Without an index, finding all orders from customer 12345 requires scanning every row in the orders table. With an index on customer_id, the database jumps directly to the relevant rows.

### Query Planning

When you write a SQL query, you describe what data you want, not how to get it. The database's query planner examines your query, considers available indexes, estimates costs of different approaches, and generates an execution plan. This is why the same query can perform differently as data grows; the planner makes different choices.

### Transactions and ACID

Relational databases guarantee ACID properties for transactions:

**Atomicity**: A transaction with multiple operations either completes entirely or has no effect. Transfer $100 from account A to account B? Either both the debit and credit happen, or neither does.

**Consistency**: The database moves from one valid state to another. Constraints like "balance cannot be negative" are enforced.

**Isolation**: Concurrent transactions don't interfere with each other. Two people buying the last item in stock don't both succeed.

**Durability**: Once a transaction commits, it survives power failures, crashes, and other disasters.

These guarantees require coordination. The database uses locking mechanisms to prevent concurrent modifications to the same data, write-ahead logging to ensure durability, and multi-version concurrency control (MVCC) to allow readers and writers to work simultaneously.

---

## Why They Excel

### Complex Queries

SQL can express sophisticated operations in a single query, including joining five tables, filtering by multiple conditions, grouping and aggregating results, and sorting by computed values. The database optimizes execution.

### Data Integrity

Foreign key constraints ensure you can't create an order referencing a non-existent customer. Check constraints enforce business rules. Unique constraints prevent duplicates. The database guarantees consistency that would require extensive application code otherwise.

### Mature Tooling

Decades of development have produced sophisticated backup systems, replication mechanisms, monitoring tools, and administrative interfaces.

---

## Why They Struggle

### Horizontal Scaling

Relational databases were designed for single-server deployment. Distributing data across multiple servers while maintaining ACID transactions and supporting arbitrary joins is technically possible but operationally complex. Solutions like sharding require careful planning and limit query flexibility.

### Schema Rigidity

Changing a table's structure requires migrations. Adding a column is usually fast, but some changes require rewriting entire tables, which can take hours for large datasets and may require downtime.

### Object-Relational Impedance Mismatch

Application objects with nested structures and inheritance hierarchies don't map naturally to flat tables. ORMs hide this complexity but introduce their own problems.

---

## When to Use Them

Relational databases remain the right choice for most applications. Use them when you need:

- Complex transactions spanning multiple entities
- Non-negotiable data integrity (financial systems, healthcare records)
- Ad-hoc analytical queries
- Teams with relational expertise where the operational complexity of alternatives isn't justified

---

## When to Look Elsewhere

Consider alternatives when:

- Write throughput exceeds what a single server can handle
- Your data is naturally hierarchical or graph-structured
- Schema changes happen frequently and migrations are painful
- You're storing large volumes of time-series or log data

---

## Examples

**PostgreSQL** is the most feature-rich open-source option, supporting JSON documents, full-text search, geospatial data, and extensions like pgvector for vector similarity search. It's often the best starting point.

**MySQL** powers much of the web, with a focus on read performance and ease of use. Multiple storage engines offer different trade-offs.

**SQL Server** provides tight integration with Microsoft's ecosystem and strong enterprise features.

**Oracle** remains dominant in large enterprises, offering advanced features at significant licensing cost.

---
