---
layout: post
title: "Why I Changed My Mind About Exceptions"
date: 2025-10-29
description: "Weighing the arguments for Result types and for exceptions when handling expected failures in distributed C# systems, and why the structural ones make Results the better default for domain operations."
tags: [error-handling, patterns, security, performance]
author: steven-stuart
sources:
  - title: "Refit documentation: Errors"
    url: "https://www.reactiveui.net/documentation/refit/results/errors/"
  - title: "Rust standard library: std::result and #[must_use]"
    url: "https://doc.rust-lang.org/std/result/"
  - title: "Explore new features available in C# 15 preview (.NET Blog)"
    url: "https://devblogs.microsoft.com/dotnet/explore-csharp-15/"
  - title: "Framework Design Guidelines: Exceptions and Performance (Microsoft Learn)"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/design-guidelines/exceptions-and-performance"
  - title: "FluentResults on GitHub"
    url: "https://github.com/altmann/FluentResults"
  - title: "ErrorOr on GitHub"
    url: "https://github.com/amantinband/error-or"
  - title: "Newtonsoft.Json on NuGet"
    url: "https://www.nuget.org/packages/Newtonsoft.Json"
  - title: "LanguageExt on GitHub"
    url: "https://github.com/louthy/language-ext"
  - title: "Handle errors in ASP.NET Core (Microsoft Learn)"
    url: "https://learn.microsoft.com/en-us/aspnet/core/fundamentals/error-handling"
  - title: "Best practices for exceptions (Microsoft Learn)"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/exceptions/best-practices-for-exceptions"
  - title: "Task.WhenAll Method (Microsoft Learn)"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.threading.tasks.task.whenall"
  - title: "CA1806: Do not ignore method results (Microsoft Learn)"
    url: "https://learn.microsoft.com/en-us/dotnet/fundamentals/code-analysis/quality-rules/ca1806"
---

I prefer the clean code that is more often produced by throwing exceptions. With the happy path uncluttered by error handling, the implicit propagation of errors to appropriate orchestration layers, and the clean separation of concerns. It's aesthetically cleaner and moves the complexity of error handling to one or just a few decision points.

But when Rust's approach to error handling gained cultural influence and C# developers (among many others of course) began exploring Result types through community libraries, I re-examined my perspective more honestly. Do the arguments for Results hold up under scrutiny for expected failures in modern systems?

This isn't just blind advocacy. It's an honest conceptual analysis of the arguments from both camps, examining which ones hold up and which are subjective preference.

Before I dive into this, let's be clear about what we are not talking about. We are not talking about programming errors like null references, array index violations, or machine resource errors. Those are bugs and special occurrences which should cause a fatal response since there is no safe way to default the outcome.

## Choosing Between Results and Exceptions

When validating a payment request that might fail for multiple reasons (insufficient funds, expired card, fraud detection, network timeout), should your code:

```csharp
// Option 1: Throw exceptions
public PaymentConfirmation ProcessPayment(PaymentRequest request)
{
    ValidateRequest(request); // Throws ValidationException
    var charge = _paymentService.Charge(request); // Throws PaymentDeclinedException
    var confirmation = _repository.SaveTransaction(charge); // Throws DatabaseException
    return confirmation;
}

// Option 2: Return Results
public Result<PaymentConfirmation> ProcessPayment(PaymentRequest request)
{
    var validationResult = ValidateRequest(request);
    if (validationResult.IsFailure)
        return Result.Failure<PaymentConfirmation>(validationResult.Error);

    var chargeResult = _paymentService.Charge(request);
    if (chargeResult.IsFailure)
        return Result.Failure<PaymentConfirmation>(chargeResult.Error);

    var saveResult = _repository.SaveTransaction(chargeResult.Value);
    return saveResult; // Already Result<PaymentConfirmation>
}
```

In the first option, a higher layer makes the decision. Or we simply let the failure propagate and use middleware to convert it to what we assume is a safe response, often an HTTP status code.

In the second option, which can vary greatly depending on the language or library being used, we can choose or are forced to handle each possible outcome. Often we need to handle a success, a failure, or a partial failure. This makes the expected outcomes visible at every layer. It also removes most of the cases where an exception is thrown deep in a workflow only to be caught and translated at the top. Those throws pay the cost of an exception for an outcome everyone expected.

## Why Expected Failures Matter More Now

<blockquote class="pull-quote">
<p>In modern distributed systems, expected failures happen constantly at scale: circuit breaker fallbacks, timeout retries, validation of user input, partial batch results.</p>
</blockquote>

**Distributed systems made expected failures more frequent**. A monolith already calls databases and third-party APIs that time out, but most of its calls stay in-process and can't. Decomposing it turns more of those in-process calls into network hops, and each hop adds timeouts and transient faults. Business answers that used to be method calls, such as an out-of-stock or credit check, now arrive as a peer's 404, 409, or decline, and treating those frequent outcomes as exceptions creates friction.

That friction shows up in the client making the call. At a service boundary, Results and exceptions both serialize a failure into a status and body, but common clients default to throwing. Refit throws an `ApiException` for every non-success status on a method returning `Task<T>`, so an expected 404 or 409 becomes an exception the caller must catch and inspect. Its `ApiResponse<T>` wrapper records the error instead, a Result in all but name.

**Offline-first architecture became common**. For progressive web apps and mobile and desktop clients, "no network" and sync conflicts are normal operating conditions.

**Functional architecture became common**. Even OOP codebases now use stateless services, immutable data pipelines, and event-driven patterns. These designs reward treating a failure as data, and a message handler shows the mechanism. When it throws on a business rejection, the broker treats the message as failed, redelivers it, and after enough retries dead-letters a message that was never broken. A catch at the top of the handler can fix that, but only if it can tell a rejection from a transient fault, which is what a Result's type already says. A handler that returns a Result can acknowledge the message and publish the rejection as an event.

## Rust Enforces the Split, C# Leaves It to Discipline

**Rust** emerged with strong functional influences. It enforces a clear split: expected failures return `Result<T, E>` types, while unexpected failures trigger panics that unwind the stack like exceptions. The standard library marks `Result` as `#[must_use]`, so ignoring one draws a compiler warning by default (a team can deny that lint to make it an error).

**C#** started heavily OOP-dominant and progressively adopted functional features (LINQ, pattern matching, immutability). It historically used exceptions for all failures, both expected and unexpected.

In C#, the same split is now possible through pattern matching (C# 7+) and community Result libraries, but it relies on discipline rather than compiler enforcement. C# 15, shipping with .NET 11 in November 2026, adds union types whose `switch` expressions the compiler checks for exhaustiveness. A union of specific error cases gets checked handling once the caller matches on it.

Microsoft's own guidance stays exception-first. It hasn't shipped a general Result type, and its Framework Design Guidelines say not to use error codes over performance concerns. The guidelines also call slow exceptions in code that routinely fails "a valid concern" and note that a throwing member "can be orders of magnitude slower." For members that fail in common scenarios, they recommend the Try-Parse pattern (`int.TryParse` returning `false`), paired with a throwing version. Microsoft presents that as a pattern within the exception model, applied member by member, not a different default.

The general Result pattern is **community-driven**. FluentResults and ErrorOr have about 37 and 12 million NuGet downloads (October 2026), small next to Newtonsoft.Json's 9 billion, and LanguageExt's 49 million cover a whole functional library, not just Results. Still, several independent libraries building the same pattern shows a need, in some codebases, that the base library leaves unmet.

## Arguments for Result Types

### Performance for frequent expected failures

When validation failures happen thousands of times per second on a CPU-bound hot path, throwing costs more than branching, because an exception captures a stack trace and unwinds the stack. Calling these failures "exceptional" doesn't change that. Inside a request that waits on a database or a timeout, the cost is noise, so this is the narrowest of the four arguments.

**Strength**: A gain on CPU-bound hot paths, not a reason on its own.

### Information disclosure prevention by default

An exception carries its stack trace and message everywhere it goes, and following Microsoft's guidance puts a provider's details inside it. Microsoft's best practices for exceptions tell you to rethrow the original or wrap it as the inner exception. So a domain exception built by the book carries the provider exception from a database driver or library you don't control, and that message can include constraint names, SQL fragments, or file paths. ASP.NET Core's production default returns a bare 500, so those details leak through handlers teams write themselves, such as an error response that includes `ex.Message` or `ex.ToString()`. An adapter could throw a fresh exception with no inner one, but that goes against the guidance.

Results change this when the error type can't hold an exception, such as ErrorOr's code and description or a C# 15 union of domain cases. An adapter that translates the provider exception into one of those leaves the error carrying only the fields your domain code put in it. FluentResults' `CausedBy` can attach the exception, which reopens the same path. Unanticipated provider exceptions still depend on the boundary handler in either design.

**Strength**: With an error type that can't carry exceptions, modeled failures are safe by construction.

### Type signatures as reliable documentation

`Result<Order>` tells you immediately that getting an order can fail. `Order` tells you nothing without reading implementation or relying on potentially outdated XML comments. Refactoring tools update type signatures automatically; they don't update documentation.

**Strength**: Fallibility in the signature can't silently go stale the way a comment can.

### Natural composition for partial success and iteration

Batch operations, parallel workflows, and offline sync scenarios often have partial success. Results compose naturally through filtering and mapping.

More critically: **exceptions pull iteration toward wherever they are caught**. When some items in a collection might fail, iteration tends to land in the orchestration layer where the catch is, even if it logically belongs in the service layer.

```csharp
// Exception approach - iteration pushed into the controller
public async Task ProcessOrders(List<string> orderIds)
{
    foreach (var id in orderIds) // Iterate where you can catch
    {
        try { await _orderService.Process(id); }
        catch (Exception ex) { /* handle */ }
    }
}

// Result approach - iteration lives in service layer
public async Task<Result<Order>[]> ProcessAll(List<string> orderIds)
{
    var tasks = orderIds.Select(id => Process(id));
    return await Task.WhenAll(tasks); // Parallel, every outcome kept
}
```

The service layer could iterate with exceptions too, but only by catching each item's exception and converting it into a per-item success or failure, which is a Result by another name.

Parallelism adds a second cost. `Task.WhenAll` waits for every task, but if any of them faults, the combined task faults with all the exceptions aggregated. `await` rethrows only the first, and no array of results comes back. `Task.WhenAll` over Results returns every outcome as an ordinary array.

**Strength**: Results allow iteration and parallelism at appropriate abstraction levels.

## Arguments for Exceptions

### Implicit propagation to appropriate handlers

Exceptions bubble to orchestration layers without code at each level. The happy path stays clean; error handling lives at boundaries.

Results require explicit propagation. Return `Result<T>`, check it, propagate it. This threads error handling through intermediate functions that don't care about the specific error.

**Strength**: Separation of concerns. Domain logic stays focused on domain, not error threading.

### Framework integration without friction

The .NET ecosystem uses exceptions. Entity Framework throws `DbUpdateException`. HttpClient throws `HttpRequestException`. Wrapping every framework call in try-catch to convert to Results creates boilerplate at every boundary.

**Strength**: Working with the ecosystem, not against it.

### C# doesn't enforce Result handling

Unlike Rust, where ignoring a `Result` draws a compiler warning, C# lets you completely ignore returned Results. You can access `.Value` without checking `.IsSuccess` and get runtime exceptions anyway.

```csharp
public Result<Order> GetOrder(string id) { /* ... */ }

GetOrder("123"); // Completely ignored, no compiler error
```

The "compiler safety" argument assumes static analyzers and discipline, the same discipline proper exception handling requires. The way each one fails differs too. A forgotten exception propagates and fails the request loudly, while a forgotten Result with no value, such as a failed save, lets execution continue as if it succeeded.

**Strength**: Results in C# provide discoverability, not enforcement.

### Orchestration layers solve the same problems

Proper architecture already requires orchestration layers that catch domain exceptions, translate them to appropriate responses, and control what information crosses boundaries. Results don't eliminate the need for this architecture; they just change what propagates upward.

**Strength**: Architecture matters more than mechanism.

### Exception documentation is sufficient with discipline

XML comments document exceptions, appear in IntelliSense, and provide discoverability at call sites:

```csharp
/// <exception cref="OrderNotFoundException">When the order doesn't exist</exception>
public Order GetOrder(string id)
```

Well-maintained codebases keep documentation current through code reviews. If you have discipline to maintain exception documentation, you have discipline to handle Results properly.

**Strength**: Documentation works if teams maintain it.

### Results encourage scattered error handling

Making it syntactically easy to handle errors inline encourages developers to scatter error-handling logic across call sites instead of centralizing it in orchestration layers.

**Strength**: Results can create worse maintainability if misused.

## Which Arguments Hold Up?

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Result Arguments That Stand</h4>
<ul>
<li>Throwing costs more than branching, which matters on CPU-bound hot paths</li>
<li>A modeled failure's error carries no stack trace or provider message</li>
<li>Type signatures show that an operation can fail more reliably than documentation</li>
<li>Iteration and parallelism can live at appropriate abstraction levels</li>
</ul>
</div>
<div class="content-card content-card--accent-warning">
<h4>Exception Arguments That Stand</h4>
<ul>
<li>Implicit propagation reduces boilerplate in intermediate layers</li>
<li>Framework integration is smoother without constant translation</li>
<li>Orchestration layers remain valuable for consolidating error handling decisions</li>
<li>C# doesn't enforce Result handling, so Results give discoverability, not enforcement</li>
</ul>
<p><strong>Exception arguments that weaken:</strong></p>
<ul>
<li>Documentation is sufficient with discipline (documentation rots in practice)</li>
<li>A clean happy path is clearer (it also hides what can fail)</li>
<li>Exceptions are for rare cases, so their cost doesn't matter (expected failures aren't rare)</li>
</ul>
</div>
</div>

## Where the Structural Arguments Point

Both sides have structural arguments, meaning ones that follow from what the mechanism is rather than how carefully a team uses it. What separates them is whether each side's structural weakness has a workaround. Results' weakness is the exception camp's strongest argument, implicit propagation, since C# has no `?` operator to hide the explicit threading Results need. But for a linear flow, library combinators recover most of the clean happy path, as in the earlier payment flow written with ErrorOr's `Then`:

```csharp
public ErrorOr<PaymentConfirmation> ProcessPayment(PaymentRequest request) =>
    ValidateRequest(request)
        .Then(_ => _paymentService.Charge(request))
        .Then(charge => _repository.SaveTransaction(charge));
```

Async steps and steps that need several earlier values push combinators toward nested lambdas, so the recovery is partial. Exceptions have no workaround for per-item outcomes, typed fallibility, or cheap hot-path failures except catching and converting, which produces a Result by another name. Resilience pipelines such as Polly keep retries and simple substitute-value fallbacks out of the intermediate layers, but per-item outcomes and fallbacks that need domain context still land there as try-catch blocks.

If Results win where the workarounds run out, the obvious compromise is to use them only there, a hybrid of exceptions by default and Results at the seams. In a distributed system the seams aren't few. Every downstream call, message handler, and batch is one. And a hybrid decides each method's failure contract case by case, so a caller can't tell from a signature which convention it follows. A default makes the signature answer that question the same way for every domain outcome. Infrastructure faults throw under either design, so the consistency covers the outcomes callers decide about, and those are the ones a signature needs to show.

That does leave callers two channels, a Result to check and exceptions that can still propagate. The exception channel is the boundary catch an exception-only design already has, so the added work is the Result branch, where the caller's decisions were going to live anyway.

The signature is what an exception default gives up. Implicit propagation is genuine convenience, but it comes at a cost of invisible failures. When a method returns `Order`, the signature doesn't reveal whether it throws, what it throws, or why. A `Result<Order>` with an open error list, rather than a closed set like a C# 15 union, doesn't say every way it can fail either. But a partial, typed channel for the expected outcomes still beats no channel.

Both sides depend on discipline, but the SDK can check one kind and not the other. A forgotten Result that carries a value still fails loudly, since FluentResults throws when you read `.Value` from a failure. The silent case is a discarded Result with no value, and that is a local fact about one call. The SDK's own CA1806 rule can flag it once you raise its severity from suggestion. You also list your Result-returning methods in its `additional_use_results_methods` option, an upkeep cost but a checkable one. Keeping `<exception>` comments current means tracing every throw through the call graph, which third-party checked-exception analyzers attempt and the SDK doesn't ship.

That reasoning comes down to a short set of rules:
- Return Results for expected domain outcomes, such as validation, business rules, and declined or unavailable downstream services
- Throw exceptions for programming errors, such as null references and contract violations
- Translate a framework exception into a Result at the adapter only when the caller has a decision to make about it, such as a timeout that triggers a fallback or a unique-key violation that means "already exists," and let the rest propagate
- Run parallel work as `Task.WhenAll` over Results, converting any exception an item throws into a failed Result at the item boundary, so one fault can't discard the other outcomes
- Centralize error handling decisions in orchestration layers that handle both Results and the framework exceptions that propagate

## Why the Resistance?

**Paradigm friction** explains part of the resistance. C# grew up with exceptions as its only failure channel, while the functional tradition that shaped Rust treats expected failures as data. Preferring exceptions in C# follows the language's history as much as any weighing of the arguments.

**Hard-won expertise** also contributes: "Exceptions work if done correctly, and I've learned how to do them correctly." This solves yesterday's problem (poor exception handling) rather than today's problem. When a large portion of operations return expected failures, exceptions require working around their design, not just using them correctly.

## What I Learned

<blockquote class="pull-quote">
<p>Result types should be the default for domain operations, not because they're perfect, but because the structural advantages outweigh the execution risks.</p>
</blockquote>

Despite my preferences, the evidence (at least conceptually) has led me to that conclusion. Where expected failures are frequent and callers act on them, visible failures, safe errors for the failures you model, and natural iteration patterns matter more than implicit propagation convenience. On hot paths, the lower cost is a further gain. In a codebase of linear operations with few caller decisions, the balance is closer. The default is the pattern, not a library, so a team can move from today's libraries to C# 15 unions when it wants closed error sets.

Paradigm friction makes this a hard sell, and "do exceptions correctly this time" reflects genuine discipline. But when an increasing number of use cases can and will return expected failures, you need mechanisms designed for common outcomes, not rare anomalies.

Moving forward I will endeavor to use Results for expected failures, reserve exceptions for bugs, and build the discipline and tooling to use them both well.
