---
title: "C# Exceptions and Error Handling"
layout: guide
category: ".NET & C#"
subcategory: "Language Fundamentals"
description: "How .NET exceptions propagate and what they cost, which exception to throw and the throw helpers, catching only what you can handle, exception filters and why they run before unwinding, rethrowing without losing the stack trace, AggregateException, custom exceptions, and when a Try method or result type beats throwing."
tags: [exceptions, error-handling, exception-filters, aggregateexception, result-pattern, reliability, practical]
---

## How Exceptions Propagate

When code throws, the runtime stops executing the current method and searches up the call stack for a `catch` block that accepts the exception's type. Every method between the throw and that `catch` is abandoned, and each `finally` block along the way runs as its method is exited. If no `catch` is found, the exception is **unhandled**, and the process terminates.

```csharp
try
{
    int result = Divide(10, divisor);
    Save(result);
}
catch (DivideByZeroException ex)
{
    Console.WriteLine($"Cannot divide by zero: {ex.Message}");
}
finally
{
    CloseResources();   // runs whether or not anything threw
}
```

That model makes exceptions a good fit for failures the immediate caller can't do anything about. A method deep in a call chain reports the problem once, and it travels to whatever level knows how to respond, such as a request handler that returns an error page, without every method in between checking a return code.

It also makes them expensive. Throwing captures a stack trace and walks the stack, which costs far more than returning a value. .NET 9 replaced the runtime's exception handling implementation and Microsoft measured it at two to four times faster on micro-benchmarks, but it is still the slow path. An exception thrown once per failed request is fine. One thrown per item while parsing a million lines is not, and those cases call for the `Try` methods and result types covered at the end of this guide.

## Choosing What to Throw

Throw the most specific existing exception type that describes the problem. Callers catch by type, so a precise type lets them handle one failure without accidentally catching another.

| Situation | Throw |
|-----------|-------|
| An argument is `null` where that isn't allowed | `ArgumentNullException` |
| An argument is outside its valid range | `ArgumentOutOfRangeException` |
| An argument is invalid in some other way | `ArgumentException` |
| The object's current state doesn't allow this call | `InvalidOperationException` |
| The call is made on an object that has been disposed | `ObjectDisposedException` |
| The operation isn't supported by this implementation at all | `NotSupportedException` |
| A string isn't in the expected format | `FormatException` |
| A key or item that must exist doesn't | `KeyNotFoundException` |
| An operation ran out of time | `TimeoutException` |
| An operation was cancelled through a `CancellationToken` | `OperationCanceledException` |

`NotImplementedException` means "this code isn't written yet" and should never ship. Never throw `Exception`, `SystemException`, `NullReferenceException`, or `IndexOutOfRangeException` yourself. The first two are too general to catch selectively, and the last two signal bugs detected by the runtime. `ApplicationException` was once recommended as the base for application exceptions and no longer is.

The relevant part of the hierarchy is shallow, and some of its nesting matters when catching:

```
System.Exception
├── SystemException
│   ├── ArgumentException
│   │   ├── ArgumentNullException
│   │   └── ArgumentOutOfRangeException
│   ├── InvalidOperationException
│   │   └── ObjectDisposedException
│   ├── OperationCanceledException
│   │   └── TaskCanceledException
│   ├── IOException
│   │   ├── FileNotFoundException
│   │   └── DirectoryNotFoundException
│   ├── FormatException, KeyNotFoundException, NotSupportedException, TimeoutException, ...
└── HttpRequestException, and most exceptions defined by libraries
```

`catch (InvalidOperationException)` also catches every `ObjectDisposedException`, and `catch (OperationCanceledException)` also catches `TaskCanceledException`.

### Throw Helpers

The argument exceptions have static helpers that check and throw in one call, and fill in the parameter name automatically from the argument expression:

```csharp
public void Register(string name, int age, Stream output)
{
    ArgumentNullException.ThrowIfNull(output);             // .NET 6
    ArgumentException.ThrowIfNullOrWhiteSpace(name);        // .NET 8
    ArgumentOutOfRangeException.ThrowIfNegative(age);       // .NET 8
    ArgumentOutOfRangeException.ThrowIfGreaterThan(age, 150);
    ObjectDisposedException.ThrowIf(_disposed, this);       // .NET 7
    // ...
}
```

They exist for two reasons beyond brevity. The name comes from the caller's expression via `[CallerArgumentExpression]`, so it can't drift from the parameter during a rename. And keeping the `throw` inside a separate helper keeps the calling method smaller, which helps the JIT inline it. Note that `ThrowIfNullOrWhiteSpace` throws `ArgumentNullException` for `null` and `ArgumentException` for empty or blank strings.

Because `throw` is an expression, it also works inside `??` and `?:`:

```csharp
_name = name ?? throw new ArgumentNullException(nameof(name));
```

## Catching

### Catch What You Can Handle

A `catch` block should exist because that code can do something about the failure, such as retrying, falling back, translating it into a response, or adding context and rethrowing. Catching an exception only to log it and carry on hides the failure from everything above. Catching it and returning `null` or a default loses the reason entirely.

```csharp
catch (Exception) { }                     // swallows every failure, including bugs

catch (Exception ex)
{
    return null;                          // the caller learns something failed, but never what
}
```

A broad `catch (Exception)` belongs at a **boundary**, the top of a request, a message handler, a background loop, or `Main`, where the job is to log, report, and keep the rest of the process healthy.

### Order Matters

`catch` blocks are tried top to bottom, and the first compatible one wins. A block for a base type placed above one for a derived type would make the derived block unreachable, so the compiler rejects that order:

```csharp
try
{
    ProcessFile(path);
}
catch (FileNotFoundException ex)        // most specific first
{
    Console.WriteLine($"Missing: {ex.FileName}");
}
catch (IOException ex)                  // then its base type
{
    Console.WriteLine($"I/O error: {ex.Message}");
}
```

### Exception Filters Run Before Unwinding

A `when` clause (C# 6) adds a condition to a `catch`. If the condition is false, the block is skipped as if it didn't exist and the search continues upward.

```csharp
try
{
    return await client.GetStringAsync(url);
}
catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
{
    return null;                        // only 404 is handled here
}
catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
{
    HandleFileError(ex);                // several types, one handler
}
```

Filters differ from catching and rethrowing in one important way. The runtime handles an exception in two passes. The first pass walks up the stack **evaluating filters** to find a handler, while every frame is still intact. Only then does the second pass unwind, running `finally` blocks on the way down to the chosen `catch`. So a filter runs before any inner `finally` block and while the stack still shows where the exception was thrown. A filter that returns `false` leaves the exception exactly as it was, which is why a debugger or crash dump taken later still shows the original throw site.

That makes a filter the right place for logging that shouldn't handle anything:

```csharp
catch (Exception ex) when (LogAndContinueSearch(ex))
{
    // never reached
}

static bool LogAndContinueSearch(Exception ex)
{
    logger.LogError(ex, "Unhandled failure");
    return false;
}
```

An exception thrown inside a filter is swallowed and treated as `false`, so filters should be simple.

### Cancellation Is Not a Failure

`OperationCanceledException` usually means something asked the operation to stop, not that it broke. Handling it separately, and only when the cancellation came from the token the code was given, avoids logging every cancelled request as an error:

```csharp
catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
{
    // the caller cancelled: stop quietly
}
```

## Rethrowing and Wrapping

Inside a `catch`, there are three ways to send an exception onward, and they differ in what the stack trace shows:

```csharp
catch (Exception ex)
{
    throw;              // rethrows the same exception, stack trace intact
}

catch (Exception ex)
{
    throw ex;           // rethrows the same object, but resets the stack trace to this line
}

catch (SqlException ex)
{
    throw new OrderStoreException($"Failed to save order {orderId}", ex);   // wraps it
}
```

`throw ex;` is almost always a mistake, because the trace now starts at the `catch` and the line that actually failed is lost. Wrapping is the right move when crossing a layer boundary, where the caller should see a failure in its own terms ("the order couldn't be saved") rather than an implementation detail ("a SQL timeout"). Passing the original as the inner exception keeps the full cause available to logs and debuggers.

To capture an exception now and rethrow it later, possibly on another thread, with its original trace, use `ExceptionDispatchInfo`. This is what `await` does internally when it rethrows a faulted task's exception:

```csharp
ExceptionDispatchInfo? captured = null;
try { DoWork(); }
catch (Exception ex) { captured = ExceptionDispatchInfo.Capture(ex); }

captured?.Throw();   // rethrows with the original stack trace, plus this rethrow point
```

## finally and Cleanup

A `finally` block runs when control leaves its `try` by any route, whether that is normal completion, `return`, `break`, or an exception. That's what makes it the place for cleanup. The exceptions are process-level failures that give the runtime no chance to run anything, such as `Environment.FailFast`, a stack overflow, or the process being killed.

Throwing from a `finally` block while an exception is already propagating **replaces** the original exception, and the original is lost with no trace. Cleanup code that can fail should catch its own exceptions.

Most cleanup is disposing a resource, and a `using` statement is the standard way to write it. It compiles to a `try`/`finally` that calls `Dispose`.

## Reading an Exception

```csharp
catch (Exception ex)
{
    string message = ex.Message;              // human-readable description
    string? trace = ex.StackTrace;            // where it was thrown, frame by frame
    Exception? cause = ex.InnerException;     // the wrapped original, if any
    ex.Data["OrderId"] = orderId;             // attach context before rethrowing
    throw;
}
```

`ex.ToString()` includes the type, message, stack trace, and every inner exception, which is why logging APIs take the exception object itself rather than its message. Passing only `ex.Message` to a log throws away the stack trace and the inner exceptions. When the root cause is several wrappers deep, `GetBaseException()` returns the innermost exception.

## AggregateException

Some operations can fail in several places at once, and `AggregateException` carries all of those failures in its `InnerExceptions` collection. `Parallel.ForEach` throws one when any iteration fails, and so do the blocking `Task.Wait()` and `Task.Result`.

```csharp
try
{
    Parallel.ForEach(items, ProcessItem);
}
catch (AggregateException ae)
{
    foreach (var ex in ae.Flatten().InnerExceptions)    // Flatten unwraps nested aggregates
        logger.LogError(ex, "Item failed");
}
```

`await` behaves differently. It unwraps the aggregate and throws **only the first** inner exception, so `catch` blocks can name specific types as they would for synchronous code. When awaiting `Task.WhenAll`, that means the other failures are silently dropped from the `catch`. Keep a reference to the combined task to see them all:

```csharp
Task all = Task.WhenAll(tasks);
try
{
    await all;
}
catch (Exception first)
{
    foreach (var ex in all.Exception!.InnerExceptions)  // every failure, not just the first
        logger.LogError(ex, "Task failed");
}
```

## Custom Exceptions

Define a new exception type only when a caller needs to catch that failure **separately** from the standard types, or needs data about it beyond a message. If no caller would write a `catch` for it, a standard exception with a clear message is better.

```csharp
public class InsufficientStockException : Exception
{
    public string ProductId { get; }
    public int Requested { get; }
    public int Available { get; }

    public InsufficientStockException(string productId, int requested, int available, Exception? inner = null)
        : base($"Product {productId}: requested {requested}, only {available} available", inner)
    {
        ProductId = productId;
        Requested = requested;
        Available = available;
    }
}
```

Name it with the `Exception` suffix, derive from `Exception` (or from a more specific standard type the failure genuinely is a kind of), and accept an inner exception so callers can wrap. Older guidance also required a `[Serializable]` attribute and a protected `(SerializationInfo, StreamingContext)` constructor. That supported .NET Framework remoting and `BinaryFormatter`, both gone from modern .NET, and the base constructor it calls has been obsolete since .NET 8 (warning `SYSLIB0051`). New exception types shouldn't include it.

## Exceptions Versus Returned Failures

An exception is the right signal when the caller **didn't expect** the failure and probably can't handle it locally, such as a missing configuration file, a lost database connection, or a bug. When failure is an ordinary, expected outcome, like a user typing an invalid number, a lookup finding nothing, or a validation rule rejecting input, returning the failure is clearer and far cheaper. The caller sees it in the method's signature and has to deal with it.

### The Try Pattern

The BCL's convention for "this may not work, and that's normal" is a `Try` method that returns `bool` and hands back the result through an `out` parameter. `[NotNullWhen(true)]` tells the nullable analysis that the value is non-null whenever the method returns `true`:

```csharp
public bool TryGetUser(int id, [NotNullWhen(true)] out User? user)
{
    user = _repository.Find(id);
    return user is not null;
}

if (TryGetUser(123, out var user))
    Console.WriteLine(user.Name);   // no nullable warning
```

### Result Types

A `Try` method can report that something failed but not why. A **result type** returns either a value or an error description, and the caller branches on which:

```csharp
public readonly record struct Result<T>
{
    private readonly bool _succeeded;
    public T? Value { get; }
    public string? Error { get; }

    private Result(T value) { _succeeded = true; Value = value; Error = null; }
    private Result(string error) { _succeeded = false; Value = default; Error = error; }

    public bool IsSuccess => _succeeded;

    public static Result<T> Success(T value) => new(value);
    public static Result<T> Failure(string error) => new(error);

    public TOut Match<TOut>(Func<T, TOut> onSuccess, Func<string, TOut> onFailure) =>
        _succeeded ? onSuccess(Value!) : onFailure(Error ?? "Uninitialized result");
}

public Result<User> FindUser(int id) =>
    _repository.Find(id) is { } user
        ? Result<User>.Success(user)
        : Result<User>.Failure($"User {id} not found");
```

The explicit `_succeeded` flag matters because this is a struct. `default(Result<T>)` exists whether or not anyone intended it, and a version that derived success from `Error is null` would report an uninitialized result as a success.

Libraries such as [ErrorOr](https://github.com/amantinband/error-or){:target="_blank" rel="noopener noreferrer"}, [FluentResults](https://github.com/altmann/FluentResults){:target="_blank" rel="noopener noreferrer"}, and [OneOf](https://github.com/mcintyre321/OneOf){:target="_blank" rel="noopener noreferrer"} provide richer versions, with typed error categories, multiple accumulated errors, or one case per distinct outcome. C# itself has no built-in union or result type in C# 14. Union types appear in the C# 15 preview, and until a released version ships them, a result type is a library or hand-written struct.

The result approach has a cost of its own. Every caller must check it and pass failures along explicitly, which is the propagation work exceptions do automatically. Most codebases mix the two, using result types or `Try` methods for expected outcomes inside the domain and exceptions for everything unexpected.

## Key Takeaways

**Throw the most specific standard exception,** and use the throw helpers for argument checks. Define a custom type only when a caller needs to catch it separately.

**Catch only where you can act.** Broad `catch (Exception)` belongs at process and request boundaries, and a `catch` that swallows or returns `null` hides the failure.

**Filters run before the stack unwinds.** A `when` clause that returns `false` leaves the exception untouched, which makes filters ideal for logging and for selecting by status code or cancellation.

**Rethrow with `throw;`, never `throw ex;`,** and wrap with an inner exception when crossing a layer boundary.

**`await Task.WhenAll` surfaces only the first failure.** Keep the combined task to read all of them.

**Exceptions are for the unexpected.** Expected failures are cheaper and clearer as `Try` methods or result types.
