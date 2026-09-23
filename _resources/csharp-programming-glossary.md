---
title: "C# and .NET Programming Glossary"
layout: resource
type: reference
category: ".NET & C#"
description: "Definitions for the vocabulary that recurs across C# documentation, code reviews, and technical discussion: type system, expressions, data and function properties, execution model, memory, integration, design, error handling, and reuse terms, with what each means in C# where the language narrows it."
last_updated: 2026-09-23
tags: [type-system, boxing, async, concurrency, memory-management, interop, fundamentals]
related_guides:
  - /study-guides/dotnet/c-sharp/foundations/compilation-and-runtime.html
  - /study-guides/dotnet/c-sharp/fundamentals/types-and-variables.html
  - /study-guides/dotnet/c-sharp/fundamentals/operators-and-expressions.html
  - /study-guides/dotnet/c-sharp/fundamentals/memory-management.html
  - /study-guides/dotnet/c-sharp/collections/generics.html
  - /study-guides/dotnet/c-sharp/async/async-await-fundamentals.html
  - /study-guides/dotnet/c-sharp/advanced/native-interop.html
---

Terms are grouped by topic. The "In C#" column says what the term means for this language specifically, which is often narrower than the general definition.

## Type System

| Term | Definition | In C# |
|---|---|---|
| **Statically typed** | Variable types are fixed at compile time | C# is statically typed. `int count = 5` makes `count = "hello"` a compile error |
| **Dynamically typed** | Types are determined at runtime | Not C#'s default, though the `dynamic` keyword opts individual expressions into runtime binding |
| **Strongly typed** | Type rules are enforced, with no implicit coercion between unrelated types | C# is strongly typed. `int n = "5"` and `if (count)` on an `int` are compile errors. Two notable exceptions: `+` with a string operand converts the other side, so `"5" + 3` is `"53"`, and `char` converts to `int` implicitly, so `'a' + 1` is `98` |
| **Weakly typed** | Implicit coercion between unrelated types is allowed | JavaScript's `"5" * 2 === 10`, and `if (0)` coercing a number to a boolean. C# rejects both |
| **Type inference** | The compiler deduces a type from context instead of requiring a declaration | `var items = new List<string>()`. This is still static typing, because the type is fixed at compile time even though you didn't write it |
| **Nominal typing** | Compatibility comes from declared relationships | C# is nominal. A class must *declare* that it implements an interface; matching method signatures is not enough |
| **Structural typing** | Compatibility comes from shape | TypeScript's model. C# uses it only for language patterns, such as `foreach` accepting any type with a suitable `GetEnumerator` method, `await` any type with `GetAwaiter`, and deconstruction any type with `Deconstruct` |
| **Covariance** | Preserves the type hierarchy, so `IEnumerable<Dog>` is usable as `IEnumerable<Animal>` | Declared with `out` on a type parameter of a generic interface or delegate, and only for reference-type arguments. Safe because the parameter appears only in output positions |
| **Contravariance** | Reverses the hierarchy, so `Action<Animal>` is usable as `Action<Dog>` | Declared with `in`, with the same interface, delegate, and reference-type limits. Safe because the parameter appears only in input positions |
| **Invariance** | No substitution in either direction | `List<Dog>` is not a `List<Animal>`, because you could add a `Cat` through the `Animal` reference. Arrays are the exception: `Dog[]` converts to `Animal[]`, and storing a `Cat` throws `ArrayTypeMismatchException` at run time |

## Statements and Expressions

| Term | Definition | In C# |
|---|---|---|
| **Expression** | Is evaluated, usually to a value | `2 + 3`, `customer.Name`, a method call (a `void` call is an expression with no value) |
| **Statement** | Performs an action without producing a value | `if`, `for`, a variable declaration. Statements run in sequence. An expression contains one only through the block body of a lambda or anonymous method |
| **Statement-oriented language** | Control-flow constructs do not produce values | To capture a result from branching, you declare a variable first and assign inside each path |
| **Expression-oriented language** | Most constructs produce values | F#, Rust, and Kotlin. In Rust, `let x = if condition { a } else { b };` needs no temporary |

C# began statement-oriented and has added expression-oriented constructs in most releases: the ternary operator (C# 1.0), LINQ query expressions (3.0), expression-bodied members (6.0), pattern matching (7.0 onward), and switch expressions (8.0). Assignment is both. `x = 5` assigns *and* evaluates to `5`, which is why `a = b = c = 0` chains.

## Data Characteristics

| Term | Definition | In C# |
|---|---|---|
| **Mutable** | Can be changed after creation | `List<T>`. Adding an item changes the existing instance |
| **Immutable** | Cannot be changed; "modification" produces a new instance | `string`. A `readonly struct` allows no field changes after construction, and the positional properties of a `record class` or `readonly record struct` are `init`-only, though a plain `record struct` gets read-write ones. All of these are shallow, so a `List<T>` member can still have items added |
| **Value type** | Stores data directly; assignment copies the data | `int`, `double`, `bool`, `enum`, any `struct`. It lives wherever its container lives, which is not necessarily the stack |
| **Reference type** | Stores a reference; assignment copies the reference, not the data | `class`, `record` (but not `record struct`, which is a value type), `interface`, `delegate`, arrays, and `string` (immutable, but still a reference type) |
| **Nullable** | Can hold a value or the absence of one | `int?` is a distinct runtime type, `Nullable<int>`. With nullable reference types enabled, `string?` differs from `string` only in compiler analysis, and at run time both are `string` |
| **Boxing** | Wrapping a value type in a heap-allocated object | Happens on conversion to `object`, `ValueType`, `Enum` (from an enum), or any interface the type implements. Passing a value to a non-generic collection is the common case, and calling an inherited `object` method such as `GetType()` boxes too |
| **Unboxing** | Extracting the value type back out | Requires a cast to the boxed type or its nullable form. The runtime also lets an enum and its underlying type unbox as each other. Anything else throws `InvalidCastException` (a boxed `int` does not unbox to `long`), and unboxing a null reference to a non-nullable type throws `NullReferenceException` |

## Function Properties

Determinism, side effects, and idempotence are independent of each other. A function can be deterministic but impure, or idempotent but non-deterministic.

| Term | Definition | Example |
|---|---|---|
| **Pure** | Same output for the same input, and no side effects | `Math.Sqrt(4)` |
| **Impure** | Violates either property | Anything that reads a database, writes a log, or mutates a parameter |
| **Side effect** | Any observable change outside the return value | Writing a file, sending a request, mutating global or input state |
| **Idempotent** | Same *end state* whether run once or many times | `x = 5`. HTTP `PUT` and `DELETE`. Incrementing is not |
| **Deterministic** | Same *return value* for the same input | `Math.Max(3, 5)`. `DateTime.Now` and `Random.Next()` are not |

`DateTime.Now` is non-deterministic but idempotent, since calling it changes no state. An `INSERT` that generates a new ID is neither.

## Execution Models

| Term | Definition | In C# |
|---|---|---|
| **Blocking** | Halts the thread until the operation completes | `stream.Read(...)`, or `.Result`/`.Wait()` on a `Task` |
| **Non-blocking** | Returns immediately and signals completion separately | `stream.ReadAsync(...)` typically returns a task without waiting for the I/O, and the task completes when the read does |
| **Synchronous** | Each operation finishes before the next begins | The caller's thread waits |
| **Asynchronous** | An operation starts without blocking the calling thread | `await` on an incomplete task pauses the *logical* flow but releases the **thread** while the operation is in flight. That release is the whole point, and it is why a server with a small thread pool can serve thousands of concurrent requests |
| **Concurrent** | Multiple tasks in progress, interleaved | A single core can run concurrent work by switching between tasks. Concurrency is about structure |
| **Parallel** | Multiple tasks executing simultaneously | Requires multiple cores. Parallelism is about execution |
| **Thread-safe** | Correct when accessed from multiple threads at once | Immutable data is inherently thread-safe; mutable shared state needs synchronization |
| **Race condition** | Behavior depends on the relative timing of events | Two threads read a counter as 5, both increment to 6, one increment is lost |
| **Deadlock** | Two or more operations wait on each other indefinitely | A holds lock 1 and wants lock 2; B holds lock 2 and wants lock 1. The common .NET form is `.Result` on a task under a single-threaded `SynchronizationContext`, where the blocked thread is the one the continuation needs |

## System Integration

| Term | Definition | In C# |
|---|---|---|
| **Interoperability** | Different systems, languages, or components working together | P/Invoke (`LibraryImport`, `DllImport`) for native code, COM interop, and the shared runtime for other .NET languages |
| **Impedance mismatch** | Friction when translating between paradigms or representations | The object-relational case is canonical: inheritance and behavior on one side, tables and joins on the other |
| **Marshalling** | Translating data between representations so systems with different memory layouts or calling conventions can exchange it | A C# `string` is UTF-16 and a C `char*` is usually 8-bit and null-terminated. Blittable data (`int`, `double`, structs of them) crosses as-is, often pinned rather than copied. A `string` passed by value as UTF-16 is pinned too, but one marshalled as UTF-8 or ANSI is copied and converted, as are `bool` and non-blittable structs. `MarshalAs` overrides the conversion when the default is wrong |
| **Serialization** | Flattening an in-memory object graph into a linear sequence of bytes or characters | Data must become linear to cross a process or network boundary, since you cannot send a pointer over HTTP |
| **Deserialization** | Rebuilding the graph from that linear form | Format choice trades readability (JSON, XML) against size and speed (Protocol Buffers, MessagePack) |

## Memory and Resource Management

| Term | Definition | In C# |
|---|---|---|
| **Garbage collection** | The runtime reclaims memory that is no longer reachable | Eliminates manual free and dangling pointers, at the cost of pauses and less predictable timing |
| **Managed code** | Code whose execution a runtime controls | The runtime allocates and frees memory, enforces type safety with cast and bounds checks, handles exceptions, and compiles IL to native code, at run time unless the app was compiled ahead of time |
| **Unmanaged code** | Code opaque to the runtime | C and C++ compiled to native instructions. The runtime can call into it but cannot manage its memory or reason about its types, and a crash inside it takes down the process |
| **Disposable resource** | Holds something the GC cannot see or reason about | A `SqlConnection` holds a pooled connection; a `FileStream` holds an OS file handle. `IDisposable` and `using` give deterministic release, since finalizers are a safety net rather than prompt cleanup |
| **Memory leak** | Memory allocated and never freed | In a GC language it usually means unintended *references*: event handlers never unsubscribed, static collections that only grow, caches with no eviction. Native memory from `Marshal.AllocHGlobal` or an undisposed handle can still leak the classic way |

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
| **Exception** | An object describing a failure that propagates up the call stack until something handles it. One unhandled on a thread terminates the process. Some paths drop it instead: a faulted `Task` that nothing observes, and an exception thrown in a `System.Timers.Timer` handler |
| **Throwing** | Signalling that something went wrong, for conditions the immediate code cannot handle |
| **Catching** | Handling the condition, at a level where recovery is actually meaningful rather than merely to suppress it |
| **Fail-fast** | Stopping at the first sign of an error rather than continuing in a possibly corrupted state. A null check that throws at method entry is fail-fast; substituting a default is not. In .NET the name also refers to `Environment.FailFast`, which terminates the process immediately without running `finally` blocks |
| **Defensive programming** | Explicitly validating inputs, checking preconditions, and handling edge cases, balanced against checks so numerous they obscure the logic |

## Composition and Reuse

| Term | Definition | In C# |
|---|---|---|
| **Inheritance** | Creating a type by extending another and acquiring its behavior | Single inheritance for classes. It couples child to parent and exposes the child to the fragile base class problem |
| **Composition** | Creating functionality by combining objects | More flexible, since composed objects can be swapped at runtime. Hence "favor composition over inheritance," with inheritance reserved for genuine is-a relationships |
| **Delegation** | Forwarding work to another object rather than implementing it | How a decorator implements an interface by passing calls through to an inner instance. Unrelated to C#'s `delegate` keyword, which declares a type for method references |
| **Higher-order function** | Takes functions as arguments or returns them | `Where` and `Select` take a lambda describing the filter or projection |
| **Closure** | A function that captures variables from its enclosing scope | A lambda referencing a local can read and modify it after the enclosing method returns. That enables the pattern and can also extend object lifetimes unintentionally |
