---
title: "C# and .NET Programming Glossary"
layout: resource
type: reference
category: ".NET & C#"
description: "Definitions for the vocabulary that recurs across C# documentation, code reviews, and technical discussion — type system, execution model, memory, integration, design, and error handling terms, each with what it means in C# specifically."
last_updated: 2026-09-23
tags: [terminology, type-system, concurrency, memory-management, interop, glossary]
related_guides:
  - /study-guides/dotnet/c-sharp/foundations/compilation-and-runtime.html
  - /study-guides/dotnet/c-sharp/fundamentals/types-and-variables.html
  - /study-guides/dotnet/c-sharp/async/async-await-fundamentals.html
---

Terms grouped by the question they answer. The "In C#" column is what the term means for this language specifically, which is often narrower than the general definition.

## Type System

| Term | Definition | In C# |
|---|---|---|
| **Statically typed** | Variable types are fixed at compile time | C# is statically typed. `int count = 5` makes `count = "hello"` a compile error |
| **Dynamically typed** | Types are determined at runtime | Not C#'s default, though the `dynamic` keyword opts individual expressions into runtime binding |
| **Strongly typed** | Type rules are enforced; no implicit coercion between unrelated types | C# is strongly typed. Adding a string to an integer needs an explicit conversion |
| **Weakly typed** | Implicit coercion between unrelated types is allowed | JavaScript's `"5" + 3 === "53"`. C# rejects the equivalent |
| **Type inference** | The compiler deduces a type from context instead of requiring a declaration | `var items = new List<string>()`. Still static typing — the type is fixed at compile time, you just didn't write it |
| **Nominal typing** | Compatibility comes from declared relationships | C# is nominal. A class must *declare* that it implements an interface; matching method signatures is not enough |
| **Structural typing** | Compatibility comes from shape | TypeScript's model. C# uses it only in narrow places, such as what qualifies as a collection initializer target |
| **Covariance** | Preserves the type hierarchy: `IEnumerable<Dog>` is usable as `IEnumerable<Animal>` | Declared with `out` on a generic parameter. Safe because the parameter appears only in output positions |
| **Contravariance** | Reverses it: `Action<Animal>` is usable as `Action<Dog>` | Declared with `in`. Safe because the parameter appears only in input positions |
| **Invariance** | No substitution in either direction | `List<Dog>` is not a `List<Animal>`, because you could add a `Cat` through the `Animal` reference |

## Statements and Expressions

| Term | Definition | In C# |
|---|---|---|
| **Expression** | Evaluates to a value | `2 + 3`, `customer.Name`, any method call with a non-`void` return |
| **Statement** | Performs an action without producing a value | `if`, `for`, a variable declaration. Statements sequence; they do not nest inside expressions |
| **Statement-oriented language** | Control-flow constructs do not produce values | To capture a result from branching, you declare a variable first and assign inside each path |
| **Expression-oriented language** | Most constructs produce values | F#, Rust, and Kotlin. `let x = if condition { a } else { b }` needs no temporary |

C# began statement-oriented and has added expression-oriented constructs in most releases: the ternary operator (C# 1.0), LINQ query expressions (3.0), expression-bodied members (6.0), pattern matching (7.0 onward), and switch expressions (8.0). Assignment is both — `x = 5` assigns *and* evaluates to `5`, which is why `a = b = c = 0` chains.

## Data Characteristics

| Term | Definition | In C# |
|---|---|---|
| **Mutable** | Can be changed after creation | `List<T>`. Adding an item changes the existing instance |
| **Immutable** | Cannot be changed; "modification" produces a new instance | `string`. Also `record` types with `init`-only members, by convention rather than enforcement |
| **Value type** | Stores data directly; assignment copies the data | `int`, `double`, `bool`, `enum`, any `struct` |
| **Reference type** | Stores a reference; assignment copies the reference, not the data | `class`, `interface`, `delegate`, arrays, and `string` (immutable, but still a reference type) |
| **Nullable** | Can hold a value or the absence of one | `int?` for value types. With nullable reference types enabled, `string?` is distinguished from `string` |
| **Boxing** | Wrapping a value type in a heap-allocated object | Happens on assignment to `object`, to a non-generic collection, or to a non-generic interface |
| **Unboxing** | Extracting the value type back out | Requires an explicit cast and throws if the type does not match exactly |

## Function Properties

These four properties are independent. A function can be deterministic but impure, or idempotent but non-deterministic.

| Term | Definition | Example |
|---|---|---|
| **Pure** | Same output for the same input, and no side effects | `Math.Sqrt(4)` |
| **Impure** | Violates either property | Anything that reads a database, writes a log, or mutates a parameter |
| **Side effect** | Any observable change outside the return value | Writing a file, sending a request, mutating global or input state |
| **Idempotent** | Same *end state* whether run once or many times | `x = 5`. HTTP `PUT` and `DELETE`. Incrementing is not |
| **Deterministic** | Same *return value* for the same input | `Math.Max(3, 5)`. `DateTime.Now` and `Random.Next()` are not |

`DateTime.Now` is non-deterministic but idempotent — calling it changes no state. An `INSERT` that generates a new ID is neither.

## Execution Models

| Term | Definition | In C# |
|---|---|---|
| **Blocking** | Halts the thread until the operation completes | `stream.Read(...)`, or `.Result`/`.Wait()` on a `Task` |
| **Non-blocking** | Returns immediately; completion is signaled separately | `stream.ReadAsync(...)` returns a `Task` |
| **Synchronous** | Each operation finishes before the next begins | The caller's thread waits |
| **Asynchronous** | An operation starts without blocking the calling thread | `await` pauses the *logical* flow but releases the **thread** back to the pool while I/O completes. That thread release is the whole point, and it is why an async server with 100 threads can serve thousands of concurrent requests |
| **Concurrent** | Multiple tasks in progress, interleaved | A single core can run concurrent work by switching between tasks. Concurrency is about structure |
| **Parallel** | Multiple tasks executing simultaneously | Requires multiple cores. Parallelism is about execution |
| **Thread-safe** | Correct when accessed from multiple threads at once | Immutable data is inherently thread-safe; mutable shared state needs synchronization |
| **Race condition** | Behavior depends on the relative timing of events | Two threads read a counter as 5, both increment to 6, one increment is lost |
| **Deadlock** | Two or more operations wait on each other indefinitely | A holds lock 1 and wants lock 2; B holds lock 2 and wants lock 1 |

## System Integration

| Term | Definition | In C# |
|---|---|---|
| **Interoperability** | Different systems, languages, or components working together | P/Invoke for native code, interop assemblies for COM, the CLR for other .NET languages |
| **Impedance mismatch** | Friction when translating between paradigms or representations | The object-relational case is canonical: inheritance and behavior on one side, tables and joins on the other |
| **Marshalling** | Translating data between representations so systems with different memory layouts or calling conventions can exchange it | A C# `string` and a C `char*` both hold text but are laid out differently. `MarshalAs` annotates the conversion when the default is wrong. Every boundary crossing copies and converts, so it has a real cost |
| **Serialization** | Flattening an in-memory object graph into a linear sequence of bytes or characters | Data must become linear to cross any boundary — you cannot send a pointer over HTTP |
| **Deserialization** | Rebuilding the graph from that linear form | Format choice trades readability (JSON, XML) against size and speed (Protocol Buffers, MessagePack) |

## Memory and Resource Management

| Term | Definition | In C# |
|---|---|---|
| **Garbage collection** | The runtime reclaims memory that is no longer reachable | Eliminates manual free and dangling pointers, at the cost of pauses and less predictable timing |
| **Managed code** | Code whose execution a runtime controls | The CLR allocates and frees memory, verifies type safety, handles exceptions, and JIT-compiles IL. "Managed" names who the manager is |
| **Unmanaged code** | Code opaque to the runtime | C and C++ compiled to native instructions. The CLR can call into it but cannot manage its memory, catch its errors, or reason about its types |
| **Disposable resource** | Holds something the GC cannot see or reason about | A `SqlConnection` holds a pooled connection; a `FileStream` holds an OS file handle. `IDisposable` and `using` give deterministic release, since finalizers are a safety net rather than prompt cleanup |
| **Memory leak** | Memory allocated and never freed | In a GC language this means unintended *references*: event handlers never unsubscribed, static collections that only grow, caches with no eviction |

## Abstraction and Design

| Term | Definition |
|---|---|
| **Encapsulation** | Bundling data with the operations on it and restricting direct access to internals, so implementation can change without breaking callers |
| **Abstraction** | Exposing essential features while hiding implementation. Good ones let you think at a higher level; poor ones leak details or hide what you needed |
| **Polymorphism** | Treating different types uniformly through a common interface, with each supplying its own implementation |
| **Coupling** | How dependent modules are on each other. Tight coupling makes changes ripple |
| **Cohesion** | How related the elements inside a module are. Low cohesion makes a module hard to name and harder to maintain |
| **Dependency injection** | Supplying a component's dependencies rather than letting it construct them, so it depends on abstractions instead of concrete implementations |

## Error Handling

| Term | Definition |
|---|---|
| **Exception** | An event that disrupts normal flow, propagating up the call stack until handled, so errors cannot be silently ignored |
| **Throwing** | Signalling that something went wrong, for conditions the immediate code cannot handle |
| **Catching** | Handling the condition, at a level where recovery is actually meaningful rather than merely to suppress it |
| **Fail-fast** | Stopping at the first sign of an error rather than continuing in a possibly corrupted state. A null check that throws at method entry is fail-fast; substituting a default is not |
| **Defensive programming** | Explicitly validating inputs, checking preconditions, and handling edge cases — balanced against checks so numerous they obscure the logic |

## Composition and Reuse

| Term | Definition | In C# |
|---|---|---|
| **Inheritance** | Creating a type by extending another and acquiring its behavior | Single inheritance for classes; couples child to parent and exposes the fragile base class problem |
| **Composition** | Creating functionality by combining objects | More flexible: composed objects can be swapped at runtime. Hence "favor composition over inheritance," with inheritance reserved for genuine is-a relationships |
| **Delegation** | Forwarding work to another object rather than implementing it | How a decorator implements an interface by passing calls through to an inner instance |
| **Higher-order function** | Takes functions as arguments or returns them | `Where` and `Select` take a lambda describing the filter or projection |
| **Closure** | A function that captures variables from its enclosing scope | A lambda referencing a local can read and modify it after the enclosing method returns, which both enables the pattern and extends object lifetimes unintentionally |
