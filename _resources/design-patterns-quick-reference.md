---
title: "Design Patterns Quick Reference (GoF)"
layout: resource
type: reference
category: "Programming Patterns"
description: "All 23 Gang of Four design patterns, with intent, problem solved, when to use, and when to avoid, grouped by Creational, Structural, and Behavioral, plus the .NET types that implement each pattern."
last_updated: 2026-09-23
tags: [design-patterns, gang-of-four, creational-patterns, structural-patterns, behavioral-patterns]
related_guides:
  - /study-guides/oop/creational-patterns.html
  - /study-guides/oop/structural-patterns.html
  - /study-guides/oop/behavioral-patterns.html
---

## Creational Patterns

| Pattern | Intent | Problem Solved | When to Use | When to Avoid |
| --- | --- | --- | --- | --- |
| Factory Method | Let subclasses decide which class to instantiate | A base class algorithm needs an object whose type it shouldn't fix | Subclasses already exist and creation is one of the things they vary | Nothing else varies between subclasses (inject the object or a factory delegate) |
| Abstract Factory | Create families of related objects without naming concrete classes | Objects that must be used together have to come from the same family | Cross-platform UI widgets, database providers | Only one family exists, or new product kinds are added often |
| Builder | Separate construction of a complex object from its representation | Many optional parts, cross-field validation, or a required order of steps | Immutable results, fluent configuration APIs | A few optional properties (use an object initializer) |
| Prototype | Create objects by copying a prototypical instance | Setup is expensive, or only an instance of unknown concrete type is at hand | Configured templates, objects loaded from slow sources | Construction is cheap, or the object is immutable (use `with`) |
| Singleton | Ensure one instance with a global point of access | Exactly one shared instance is needed | Code with no DI container | A DI container is available (register a singleton lifetime instead) |

## Structural Patterns

| Pattern | Intent | Problem Solved | When to Use | When to Avoid |
| --- | --- | --- | --- | --- |
| Adapter | Convert one interface into another that clients expect | An existing class does the right work behind the wrong interface | Legacy or third-party code you can't change | You own both sides (fix one of them) |
| Bridge | Decouple an abstraction from its implementation so both can vary | A hierarchy that varies in two dimensions grows to N × M classes | Two independent dimensions of variation | Only one dimension varies |
| Composite | Treat individual objects and groups of them uniformly | Code must handle a part-whole tree without checking which is which | File systems, UI control trees, nested bundles | Flat collections |
| Decorator | Attach responsibilities to an object dynamically | Subclassing for every combination of optional behaviors | Logging, retries, caching, and stream wrappers that stack | The combination never changes at runtime |
| Facade | Give a subsystem one simpler interface | Callers must learn many services and the order to call them | One entry point for a multi-step operation | The subsystem is already simple |
| Flyweight | Share fine-grained objects to save memory | Very many near-identical objects exhaust memory | Glyphs, map tiles, particles | Few objects, or state that is mostly unique |
| Proxy | Provide a stand-in that controls access to another object | Creation, permission, location, or caching must be managed transparently | Lazy loading, authorization checks, remote calls | The hidden work would surprise callers (make it explicit) |

## Behavioral Patterns

| Pattern | Intent | Problem Solved | When to Use | When to Avoid |
| --- | --- | --- | --- | --- |
| Chain of Responsibility | Pass a request along a chain until a handler takes it | The sender shouldn't choose the handler | Approval chains, request pipelines | The right handler is known up front |
| Command | Encapsulate a request as an object | Requests must be queued, logged, retried, or undone | Undo stacks, job queues, UI actions | The action is only ever called directly |
| Interpreter | Represent a small language's grammar as classes and evaluate it | Users write rules or formulas the program must evaluate | Small rule and filter languages | Large grammars (use a parser generator) |
| Iterator | Access elements in sequence without exposing the structure | Callers need a traversal without knowing the storage | A custom traversal order over your own collection | The data is already in a list or array |
| Mediator | Encapsulate how a set of objects interact | Pairwise links between peers grow with the square of their number | Dialogs, chat rooms, peers with shared coordination rules | Two or three stable collaborators |
| Memento | Capture and restore an object's state without exposing it | Snapshots needed while internal state stays private | Editor undo, checkpoints | Large objects with small, reversible changes (use commands) |
| Observer | Notify dependents automatically when state changes | A subject must inform listeners it doesn't know | UI updates, domain events, price feeds | One listener that must respond (call it directly) |
| State | Let an object change behavior when its state changes | Every method switches on the current state | Lifecycles where states differ in behavior | States that only decide what comes next (use a transition table) |
| Strategy | Make a family of algorithms interchangeable | Conditionals choose between algorithms | Pricing, shipping, sorting, and comparison rules | Only one algorithm exists |
| Template Method | Fix an algorithm's skeleton and defer steps to subclasses | Several variants share an outline and differ in steps | Importers and workflows with fixed step order | Steps vary independently (use strategies) |
| Visitor | Define new operations over elements without changing their classes | Operations over a stable hierarchy keep multiplying | Syntax and expression trees | New element types arrive often, or few operations exist (use pattern matching) |

## Patterns in .NET

Types in the .NET libraries that implement a GoF pattern, useful for recognizing the pattern in code you already use.

| Pattern | .NET type | How it applies |
| --- | --- | --- |
| Abstract Factory | `DbProviderFactory` | Each provider's factory creates a matching connection, command, and parameter |
| Builder | `WebApplication.CreateBuilder()`, `UriBuilder`, `StringBuilder` | Collect parts step by step, then produce the result |
| Singleton | `AddSingleton` in `Microsoft.Extensions.DependencyInjection` | The container keeps one instance without a static access point |
| Adapter | `StreamReader` | Presents a byte `Stream` through the character-based `TextReader` interface |
| Decorator | `BufferedStream`, `GZipStream`, `CryptoStream`, `DelegatingHandler` | Each wraps another stream or HTTP handler of the same type and adds behavior |
| Flyweight | `string.Intern` | Equal strings share one instance |
| Proxy | `Lazy<T>`, EF Core lazy-loading proxies | Defer creation or loading until first access |
| Chain of Responsibility | ASP.NET Core middleware | Each component handles the request and decides whether to call the next |
| Command | WPF `ICommand` | Binds a control to an action it knows nothing about |
| Interpreter | `System.Linq.Expressions` expression trees | Code represented as a tree of objects that can be evaluated or translated |
| Iterator | `IEnumerable<T>`, `IEnumerator<T>`, `yield return` | Built into the language through `foreach` |
| Observer | C# events, `IObservable<T>` and `IObserver<T>` | Subjects notify subscribers without knowing them |
| Strategy | `IComparer<T>`, `IEqualityComparer<T>` | Collections keep their algorithm and take the comparison as an object |
| Template Method | `BackgroundService` | `StartAsync` runs the lifecycle and calls the subclass's `ExecuteAsync` |
| Visitor | `ExpressionVisitor` | Walks and rewrites expression trees without changing the node classes |

EF Core's `DbContext` is often cited here too. Microsoft's documentation describes it as a combination of the Unit of Work and Repository patterns, which come from Martin Fowler's *Patterns of Enterprise Application Architecture* rather than the GoF book.
