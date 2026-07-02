---
title: "Design Patterns Quick Reference (GoF)"
layout: resource
type: reference
description: "All 23 Gang of Four design patterns — intent, problem solved, when to use, and when to avoid — grouped by Creational, Structural, and Behavioral."
last_updated: 2026-07-02
tags: [oop, design-patterns, software-design]
related_guides:
  - /study-guides/oop/creational-patterns.html
  - /study-guides/oop/structural-patterns.html
  - /study-guides/oop/behavioral-patterns.html
---

## Creational Patterns

| Pattern | Intent | Problem Solved | When to Use | When to Avoid |
| --- | --- | --- | --- | --- |
| Factory Method | Define object creation interface | Multiple ways to create objects | Subclasses determine which class to instantiate | Simple constructor is sufficient |
| Abstract Factory | Create families of related objects | Need consistent object families | Cross-platform UIs, themed components | Only one product family |
| Builder | Construct complex objects step-by-step | Objects with many optional parameters | Immutable objects, fluent APIs, complex construction | Simple objects with few properties |
| Prototype | Clone existing objects | Expensive object creation | Object templates, reducing initialization cost | Objects are cheap to create |
| Singleton | Single instance globally | Shared resource access | Config, logging (prefer DI instead) | Almost always (use DI) |

## Structural Patterns

| Pattern | Intent | Problem Solved | When to Use | When to Avoid |
| --- | --- | --- | --- | --- |
| Adapter | Make incompatible interfaces compatible | Legacy code integration, third-party library mismatch | Wrapping existing classes with incompatible interfaces | You control both interfaces (fix design) |
| Bridge | Separate abstraction from implementation | Cartesian product explosion (N × M classes) | Multiple dimensions of variation | Single dimension of variation |
| Composite | Treat individual and composite objects uniformly | Tree structures, hierarchies | File systems, UI components, organizational charts | Flat structures |
| Decorator | Add behavior dynamically without subclassing | Static inheritance limitations | Runtime behavior modification, multiple combinations | Behavior known at compile time |
| Facade | Simplify complex subsystem interfaces | Too many dependencies, complex APIs | Hide complexity, reduce coupling | Subsystem is already simple |
| Flyweight | Share common state to reduce memory | Memory constraints with many similar objects | Large number of fine-grained objects | Few objects or mostly unique state |
| Proxy | Control access to objects | Expensive object creation, access control | Lazy loading, caching, access control, logging | Direct access is simpler |

## Behavioral Patterns

| Pattern | Intent | Problem Solved | When to Use | When to Avoid |
| --- | --- | --- | --- | --- |
| Observer | Notify dependents of state changes | Maintaining consistency between objects | Event systems, data binding, pub/sub | Simple callbacks work |
| Strategy | Interchangeable algorithms | Eliminating algorithm conditionals | Runtime algorithm selection | Single algorithm |
| Command | Encapsulate requests as objects | Undo/redo, operation queuing | Macro recording, transaction systems | Simple method calls |
| State | Behavior changes with state | Complex state conditionals | State machines, workflow | Simple if/switch suffices |
| Chain of Responsibility | Pass request along handler chain | Decoupling sender from receiver | Middleware pipelines, request processing | Single handler |
| Template Method | Algorithm skeleton in base class | Code reuse with variation | Common workflow with varying steps | No variation needed |
| Mediator | Centralize object communications | Many-to-many complexity | Chat systems, CQRS (MediatR) | Simple relationships |
| Memento | Capture/restore state | Undo/redo while maintaining encapsulation | Snapshots, transaction rollback | Simple state storage |
| Visitor | Add operations to hierarchies | Adding operations without modification | Expression trees, AST processing | Pattern matching is simpler |
| Iterator | Sequential access to elements | Collection traversal | Custom iteration logic | `foreach` works |
| Interpreter | Define language grammar | Domain-specific languages | Simple DSLs | Complex grammars (use parser) |
