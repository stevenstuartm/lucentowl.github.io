---
layout: guide
title: "Document Databases"
category: Databases
subcategory: Database Types
description: "How document databases store self-contained JSON-like documents, the embed-or-reference decision that shapes every model, what flexible schemas cost, and when relational is the better fit."
tags: [document, json, mongodb, embedding, schema-flexibility, practical]
---

## What They Are

Document databases store data as self-contained documents, typically JSON or a binary form of it such as MongoDB's BSON. Unlike key-value stores, they understand a document's structure, so they can index and query fields inside it. Unlike relational databases, they don't require a predefined schema by default, so documents in the same collection can have different fields.

One motivation for them is the mismatch between application objects and relational tables. Applications work with objects that have nested structures, optional fields, and lists. Storing those in normalized tables means splitting each object across several tables and joining it back together on every read. A document database stores the object in roughly the shape the application uses.

---

## Data Structure

```
┌─────────────────────────────────────────────────────────────┐
│  USERS COLLECTION                                           │
├─────────────────────────────────────────────────────────────┤
│ {                                                           │
│   "_id": "user_1",                                          │
│   "name": "Alice Smith",                                    │
│   "email": "alice@example.com",                             │
│   "addresses": [                      ← Nested array        │
│     {"type": "home", "city": "Seattle"},                    │
│     {"type": "work", "city": "Portland"}                    │
│   ],                                                        │
│   "preferences": {                    ← Nested object       │
│     "theme": "dark",                                        │
│     "notifications": true                                   │
│   }                                                         │
│ }                                                           │
├─────────────────────────────────────────────────────────────┤
│ {                                                           │
│   "_id": "user_2",                                          │
│   "name": "Bob Jones",                                      │
│   "email": "bob@example.com",                               │
│   "phone": "+1-555-0123"              ← Field not in user_1 │
│   // No addresses field               ← Schema flexibility  │
│ }                                                           │
└─────────────────────────────────────────────────────────────┘

Query: db.users.find({ "addresses.city": "Seattle" })
       → Returns user_1 (queries nested fields)
```

Each document is self-contained. Related data can be embedded, like the addresses inside a user, or referenced by storing another document's ID.

---

## How They Work

### Collections and Documents

Documents are grouped into collections, roughly the equivalent of tables. Each document has a unique ID and holds fields whose values can be strings, numbers, booleans, arrays, or nested documents.

### Flexible Schemas, Optional Validation

By default the database doesn't enforce a document's structure. One user document can have a phone number and another not, and a field can be a string in one document and an array in another. That makes it easy to add fields as requirements change.

Most document databases now let you opt back into enforcement. MongoDB, for example, accepts a JSON Schema per collection and rejects documents that don't match it. Many teams use validation for the fields every document must have and leave the rest flexible.

### Indexing and Queries

Document databases index fields inside documents, including nested fields and array elements, so an index on `addresses.city` finds users in a given city without scanning the collection. Their query languages filter on field values, match elements in arrays, and combine conditions. Aggregation pipelines group, reshape, and summarize documents, and MongoDB's `$lookup` can join to another collection, though joins are a secondary feature rather than the core of the model.

### Transactions

A write to a single document is atomic, including every nested field inside it. That's why embedding related data works: an order and its line items in one document are updated together without a transaction. MongoDB added multi-document transactions in version 4.0, and they now work across a sharded cluster, but they cost more than single-document writes and are meant for the cases embedding can't cover.

---

## Embedding vs. Referencing

The central modeling decision in a document database is whether related data lives inside a document or in its own.

**Embedding** stores related data inside the parent document, such as a blog post with its comments array. One read returns everything, and one atomic write updates it.

**Referencing** stores an ID pointing to another document, such as comments kept as separate documents with a `post_id` field. It resembles relational design and needs a second query or a `$lookup` to assemble.

| Embed when | Reference when |
| --- | --- |
| The data is read together with its parent most of the time | The data is often read on its own |
| The child belongs to one parent | The child is shared by many parents, such as a product referenced by many orders |
| The number of children stays small and bounded | The list grows without limit, such as every comment a popular post will ever get |
| Children change together with the parent | Children change independently and often |

Unbounded embedding is the most common mistake. Documents have a size limit, 16 MB in MongoDB, and long before that a large document makes every read and update of it slow.

---

## Why They Excel

### Data in the Shape the Application Uses

Storing an object roughly as the application sees it removes most of the mapping code between objects and tables. What you save is what you get back.

### Schema Evolution

Adding a field doesn't require a migration. Old documents without the field sit alongside new ones that have it, and the application handles both.

### One Read for a Whole Aggregate

When related data is embedded, fetching it is one lookup by ID with no joins, which keeps reads fast and predictable for known access patterns.

### Horizontal Scaling

Because each document is self-contained, documents can be spread across servers by a shard key, and most reads and writes touch a single shard. Choosing that key well matters as much here as in any sharded system.

---

## Why They Struggle

### Many-to-Many Relationships

Relational databases handle many-to-many relationships with join tables. Document databases either duplicate data into each document, which must then be kept in sync, or store references and assemble them with extra queries.

### Queries You Didn't Design For

The document shape is chosen for the expected reads. A new question that cuts across that shape, such as "total sales by product category" when products are embedded in orders, is slower and more awkward than the same query in SQL.

### Data Consistency Without Enforcement

When validation isn't configured, nothing but application code stops invalid or inconsistent documents from being written. Over years, several versions of the same document shape tend to accumulate, and every reader has to cope with all of them.

---

## When to Use Them

Document databases work well for:

- **Catalogs and content**: products, articles, and profiles whose attributes vary from item to item
- **Aggregates read as a whole**: an order with its line items, a user with their settings
- **Rapidly changing data models**, where migrations would slow the team down
- **Read-heavy workloads** where embedding replaces joins

---

## When to Look Elsewhere

If your data is highly relational with many-to-many relationships, if you need ad hoc queries across entities, if most operations need transactions across many documents, or if you need the database to enforce integrity for every writer, a relational database is likely a better fit. PostgreSQL's `jsonb` columns can also cover the flexible parts of a mostly relational model without a second database.

---

## Examples

**MongoDB** is the most widely used document database, available self-hosted or as the managed Atlas service, with multi-document transactions and schema validation. **Couchbase** combines document storage with a memory-first cache and a SQL-based query language, SQL++. **Firebase Cloud Firestore** focuses on mobile and web apps, with real-time sync and offline support. **Amazon DocumentDB** and **Azure Cosmos DB** offer MongoDB-compatible managed services.

---
