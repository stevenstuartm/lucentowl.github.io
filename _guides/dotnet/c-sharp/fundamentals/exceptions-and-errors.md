---
title: "C# Exceptions and Error Handling"
layout: guide
category: ".NET & C#"
subcategory: "Language Fundamentals"
description: "Exception handling, custom exceptions, error patterns, and best practices for robust error management."
tags: [c-sharp, dotnet, fundamentals, exceptions, error-handling, reliability, practical]
---

## Exception Basics

Exceptions represent errors or unexpected conditions that disrupt normal program flow. They propagate up the call stack until caught or they terminate the application.

```csharp
try
{
    int result = 10 / divisor;
    ProcessResult(result);
}
catch (DivideByZeroException ex)
{
    Console.WriteLine($"Cannot divide by zero: {ex.Message}");
}
catch (Exception ex)
{
    Console.WriteLine($"Unexpected error: {ex.Message}");
    throw;  // Re-throw preserving stack trace
}
finally
{
    // Always runs - cleanup code
    CloseResources();
}
```

### Exception Hierarchy

```
System.Exception
├── System.SystemException (runtime exceptions)
│   ├── ArgumentException
│   │   ├── ArgumentNullException
│   │   └── ArgumentOutOfRangeException
│   ├── InvalidOperationException
│   ├── NullReferenceException
│   ├── IndexOutOfRangeException
│   ├── InvalidCastException
│   ├── NotSupportedException
│   ├── NotImplementedException
│   ├── ObjectDisposedException
│   ├── FormatException
│   └── IO.IOException
│       ├── FileNotFoundException
│       └── DirectoryNotFoundException
└── System.ApplicationException (legacy, avoid)
```

## Throwing Exceptions

### Basic Throwing

```csharp
public void SetAge(int age)
{
    if (age < 0)
        throw new ArgumentOutOfRangeException(nameof(age), age, "Age cannot be negative");

    if (age > 150)
        throw new ArgumentOutOfRangeException(nameof(age), age, "Age seems unrealistic");

    _age = age;
}

public void ProcessOrder(Order? order)
{
    // ArgumentNullException with nameof for refactoring safety
    ArgumentNullException.ThrowIfNull(order);

    // Continue processing...
}
```

### Throw Expressions (C# 7.0)

```csharp
// In null-coalescing
string name = input ?? throw new ArgumentNullException(nameof(input));

// In conditional expressions
int value = isValid ? ComputeValue() : throw new InvalidOperationException("Invalid state");

// In expression-bodied members
public string Name => _name ?? throw new InvalidOperationException("Name not set");
```

<div class="callout callout--warning">
<p class="callout__title">Re-throwing: Use throw, not throw ex</p>
<p>When re-throwing an exception, use <code>throw;</code> without the exception variable. Using <code>throw ex;</code> loses the original stack trace, making debugging harder.</p>
</div>

### Re-throwing

```csharp
try
{
    DoWork();
}
catch (Exception ex)
{
    // GOOD: Re-throw preserving original stack trace
    throw;
}

try
{
    DoWork();
}
catch (Exception ex)
{
    // BAD: Loses original stack trace
    throw ex;  // Don't do this!
}

try
{
    DoWork();
}
catch (Exception ex)
{
    // Wrap with additional context
    throw new ServiceException("Failed to process request", ex);
}
```

## Catching Exceptions

### Catch Ordering

Catch blocks are evaluated in order. More specific exceptions must come before general ones.

```csharp
try
{
    ProcessFile(path);
}
catch (FileNotFoundException ex)
{
    // Most specific first
    Console.WriteLine($"File not found: {ex.FileName}");
}
catch (IOException ex)
{
    // More general I/O error
    Console.WriteLine($"I/O error: {ex.Message}");
}
catch (Exception ex)
{
    // Catch-all last
    Console.WriteLine($"Unexpected error: {ex.Message}");
    throw;  // Re-throw unexpected errors
}
```

### Exception Filters (C# 6.0)

Filter exceptions without catching and re-throwing.

```csharp
try
{
    await httpClient.GetAsync(url);
}
catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
{
    return null;  // Handle 404 specifically
}
catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.TooManyRequests)
{
    await Task.Delay(retryDelay);
    throw;  // Re-throw for retry logic
}
catch (HttpRequestException ex) when (IsTransient(ex))
{
    // Handle transient errors
    logger.LogWarning(ex, "Transient error, will retry");
    throw;
}

// Filter can call methods
private bool IsTransient(HttpRequestException ex)
{
    return ex.StatusCode is >= HttpStatusCode.InternalServerError
           or HttpStatusCode.RequestTimeout;
}

// Logging without catching
catch (Exception ex) when (LogException(ex))
{
    // Never executes - LogException returns false
}

private bool LogException(Exception ex)
{
    logger.LogError(ex, "Error occurred");
    return false;  // Don't actually catch
}
```

### Catching Multiple Exception Types

```csharp
// C# 6.0+ - filter with pattern
try
{
    Process();
}
catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
{
    HandleFileError(ex);
}

// Alternative: multiple catch blocks with same handling
catch (IOException ex)
{
    HandleFileError(ex);
}
catch (UnauthorizedAccessException ex)
{
    HandleFileError(ex);
}
```

## Custom Exceptions

### Creating Custom Exceptions

```csharp
public class OrderProcessingException : Exception
{
    public string OrderId { get; }
    public OrderErrorCode ErrorCode { get; }

    public OrderProcessingException(string orderId, OrderErrorCode errorCode)
        : base($"Failed to process order {orderId}: {errorCode}")
    {
        OrderId = orderId;
        ErrorCode = errorCode;
    }

    public OrderProcessingException(string orderId, OrderErrorCode errorCode, Exception inner)
        : base($"Failed to process order {orderId}: {errorCode}", inner)
    {
        OrderId = orderId;
        ErrorCode = errorCode;
    }
}

public enum OrderErrorCode
{
    InvalidProduct,
    InsufficientStock,
    PaymentFailed,
    ShippingUnavailable
}

// Usage
throw new OrderProcessingException(order.Id, OrderErrorCode.InsufficientStock);
```

### Serializable Exceptions (Legacy/Remoting)

```csharp
[Serializable]
public class BusinessException : Exception
{
    public BusinessException() { }
    public BusinessException(string message) : base(message) { }
    public BusinessException(string message, Exception inner) : base(message, inner) { }

    // Required for serialization (legacy)
    protected BusinessException(SerializationInfo info, StreamingContext context)
        : base(info, context) { }
}
```

## The finally Block

The `finally` block always executes, whether an exception occurs or not.

```csharp
FileStream? file = null;
try
{
    file = File.OpenRead(path);
    ProcessFile(file);
}
catch (IOException ex)
{
    logger.LogError(ex, "Failed to process file");
    throw;
}
finally
{
    // Always runs - even if exception thrown
    file?.Dispose();
}
```

### Using Statements (Preferred)

The `using` statement is syntactic sugar for try/finally with Dispose.

```csharp
// Using declaration (C# 8.0) - disposed at end of scope
using var file = File.OpenRead(path);
using var reader = new StreamReader(file);
string content = reader.ReadToEnd();
// Disposed here when scope ends

// Using statement (traditional) - explicit scope
using (var connection = new SqlConnection(connectionString))
{
    connection.Open();
    // Use connection
}  // Disposed here

// Multiple resources
using var file = File.OpenRead(path);
using var reader = new StreamReader(file);
// Both disposed at end of scope (in reverse order)

// Async disposal (C# 8.0)
await using var connection = new SqlConnection(connectionString);
await connection.OpenAsync();
```

## Exception Properties

```csharp
try
{
    DoWork();
}
catch (Exception ex)
{
    // Core properties
    string message = ex.Message;           // Error description
    string? stackTrace = ex.StackTrace;    // Call stack
    Exception? inner = ex.InnerException;  // Wrapped exception
    string? source = ex.Source;            // Assembly/app name
    MethodBase? target = ex.TargetSite;    // Method that threw

    // Data dictionary for additional info
    foreach (DictionaryEntry entry in ex.Data)
    {
        Console.WriteLine($"{entry.Key}: {entry.Value}");
    }

    // Add data before re-throwing
    ex.Data["CorrelationId"] = correlationId;
    throw;
}
```

### Walking the Exception Chain

```csharp
public static IEnumerable<Exception> GetAllExceptions(Exception ex)
{
    var current = ex;
    while (current != null)
    {
        yield return current;
        current = current.InnerException;
    }
}

// Usage
foreach (var exception in GetAllExceptions(ex))
{
    logger.LogError(exception.Message);
}

// Get root cause
Exception rootCause = ex;
while (rootCause.InnerException != null)
    rootCause = rootCause.InnerException;
```

## AggregateException

Used with parallel operations and tasks to collect multiple exceptions.

```csharp
try
{
    Parallel.ForEach(items, item => ProcessItem(item));
}
catch (AggregateException ae)
{
    // Flatten nested AggregateExceptions
    foreach (var ex in ae.Flatten().InnerExceptions)
    {
        Console.WriteLine($"Error: {ex.Message}");
    }

    // Handle specific types
    ae.Handle(ex =>
    {
        if (ex is InvalidOperationException)
        {
            Console.WriteLine($"Invalid operation: {ex.Message}");
            return true;  // Handled
        }
        return false;  // Not handled, will re-throw
    });
}

// With tasks
try
{
    await Task.WhenAll(tasks);
}
catch (Exception ex)
{
    // Only first exception thrown, but all are available
    var allExceptions = Task.WhenAll(tasks).Exception?.InnerExceptions;
}
```

## Error Handling Patterns

### Result Pattern (Avoid Exceptions for Expected Cases)

The Result pattern returns an object indicating success or failure instead of throwing exceptions for expected failures like validation errors, "not found" scenarios, or business rule violations. Exceptions remain appropriate for truly exceptional conditions.

#### Minimal Implementation with Modern C#

Using `readonly record struct` (C# 10+) provides value semantics, immutability, and structural equality with minimal boilerplate:

```csharp
public readonly record struct Result<T>
{
    public T? Value { get; }
    public string? Error { get; }
    public bool IsSuccess => Error is null;
    public bool IsFailure => !IsSuccess;

    private Result(T value) => Value = value;
    private Result(string error) => Error = error;

    public static Result<T> Success(T value) => new(value);
    public static Result<T> Fail(string error) => new(error);

    // Implicit conversions reduce ceremony
    public static implicit operator Result<T>(T value) => Success(value);

    public TResult Match<TResult>(Func<T, TResult> onSuccess, Func<string, TResult> onFailure)
        => IsSuccess ? onSuccess(Value!) : onFailure(Error!);
}

// Usage with implicit conversion
public Result<User> GetUser(int id)
{
    var user = _repository.Find(id);
    return user is not null
        ? user  // Implicit conversion to Result<User>
        : Result<User>.Fail($"User {id} not found");
}

var result = GetUser(123);
var message = result.Match(
    user => $"Found: {user.Name}",
    error => $"Error: {error}"
);
```

For operations that don't return a value, add a non-generic Result:

```csharp
public readonly record struct Result
{
    public string? Error { get; }
    public bool IsSuccess => Error is null;

    private Result(string? error) => Error = error;

    public static Result Success() => new(null);
    public static Result Fail(string error) => new(error);
}
```

#### Popular Libraries

For production code, established libraries offer richer functionality, tested implementations, and ecosystem support.

**[ErrorOr](https://github.com/amantinband/error-or){:target="_blank" rel="noopener noreferrer"}** provides a discriminated union with typed errors and fluent chaining. It's lightweight, struct-based, and popular in API development:

```csharp
// Define domain-specific errors
public static class UserErrors
{
    public static Error NotFound(int id) => Error.NotFound("User.NotFound", $"User {id} not found");
    public static Error InvalidEmail => Error.Validation("User.InvalidEmail", "Email format is invalid");
}

// Return ErrorOr<T> from methods
public ErrorOr<User> GetUser(int id)
{
    var user = _repository.Find(id);
    return user is not null ? user : UserErrors.NotFound(id);
}

// Chain operations fluently
var result = await GetUser(id)
    .Then(user => ValidateEmail(user.Email))
    .ThenAsync(user => _repository.UpdateAsync(user));

// Handle with Match or Switch
return result.Match(
    user => Ok(user),
    errors => errors.First().Type switch
    {
        ErrorType.NotFound => NotFound(),
        ErrorType.Validation => BadRequest(errors),
        _ => Problem()
    }
);
```

**[FluentResults](https://github.com/altmann/FluentResults){:target="_blank" rel="noopener noreferrer"}** supports multiple errors, hierarchical error chains with root cause tracking, and custom error types:

```csharp
// Custom domain error
public class InsufficientStockError : Error
{
    public string ProductId { get; }
    public InsufficientStockError(string productId, int requested, int available)
        : base($"Requested {requested} but only {available} available")
    {
        ProductId = productId;
        Metadata.Add("Requested", requested);
        Metadata.Add("Available", available);
    }
}

// Accumulate multiple errors
public Result<Order> ValidateOrder(Order order)
{
    var result = Result.Ok(order);

    if (order.Items.Count == 0)
        result = result.WithError("Order must have at least one item");

    foreach (var item in order.Items)
    {
        var stock = _inventory.GetStock(item.ProductId);
        if (stock < item.Quantity)
            result = result.WithError(new InsufficientStockError(item.ProductId, item.Quantity, stock));
    }

    return result;
}

// Chain with root cause tracking
public Result<Receipt> ProcessPayment(Order order)
{
    try
    {
        return _paymentGateway.Charge(order.Total);
    }
    catch (PaymentException ex)
    {
        return Result.Fail(new Error("Payment processing failed").CausedBy(ex));
    }
}
```

**[OneOf](https://github.com/mcintyre321/OneOf){:target="_blank" rel="noopener noreferrer"}** models outcomes as distinct types rather than success/failure, which works well when a method can return several different valid results:

```csharp
// Model distinct outcomes as types
public OneOf<User, NotFound, Suspended> GetUser(int id)
{
    var user = _repository.Find(id);
    if (user is null) return new NotFound();
    if (user.IsSuspended) return new Suspended(user.SuspendedUntil);
    return user;
}

// Exhaustive handling - compiler ensures all cases covered
var response = GetUser(id).Match(
    user => Ok(user),
    notFound => NotFound(),
    suspended => StatusCode(403, $"Account suspended until {suspended.Until}")
);
```

#### Choosing an Approach

| Approach | Best For |
|----------|----------|
| Minimal `record struct` | Simple projects, learning, or when you want no dependencies |
| ErrorOr | API development with typed errors and fluent chaining |
| FluentResults | Complex validation with multiple errors and root cause tracking |
| OneOf | Methods with multiple distinct outcomes beyond success/failure |

#### Native Discriminated Unions (Future)

C# 14 is expected to introduce native discriminated unions, which will provide language-level support for this pattern with exhaustiveness checking. Until then, these libraries fill the gap effectively.

### Try Pattern

Return boolean indicating success, with out parameter for result.

```csharp
public bool TryGetUser(int id, out User? user)
{
    user = _repository.Find(id);
    return user != null;
}

// Usage
if (TryGetUser(123, out var user))
{
    Console.WriteLine(user.Name);
}
else
{
    Console.WriteLine("User not found");
}
```

### Parse vs TryParse

```csharp
// Parse throws on failure - use when input should be valid
int value = int.Parse(validInput);

// TryParse returns bool - use for user input or uncertain data
if (int.TryParse(userInput, out int result))
{
    UseValue(result);
}
else
{
    ShowValidationError("Please enter a valid number");
}
```

### Guard Clauses

Validate early, fail fast.

```csharp
public void ProcessOrder(Order order, Customer customer)
{
    // Validate inputs immediately
    ArgumentNullException.ThrowIfNull(order);
    ArgumentNullException.ThrowIfNull(customer);

    if (order.Items.Count == 0)
        throw new ArgumentException("Order must have at least one item", nameof(order));

    if (!customer.IsActive)
        throw new InvalidOperationException("Cannot process order for inactive customer");

    // Main logic only runs if all guards pass
    ProcessValidOrder(order, customer);
}
```

### Validation with Aggregate Errors

```csharp
public class ValidationResult
{
    private readonly List<string> _errors = new();

    public bool IsValid => _errors.Count == 0;
    public IReadOnlyList<string> Errors => _errors;

    public void AddError(string error) => _errors.Add(error);

    public void ThrowIfInvalid()
    {
        if (!IsValid)
            throw new ValidationException(string.Join("; ", _errors));
    }
}

public ValidationResult Validate(Order order)
{
    var result = new ValidationResult();

    if (string.IsNullOrWhiteSpace(order.CustomerId))
        result.AddError("Customer ID is required");

    if (order.Items.Count == 0)
        result.AddError("Order must have at least one item");

    foreach (var item in order.Items)
    {
        if (item.Quantity <= 0)
            result.AddError($"Invalid quantity for item {item.ProductId}");
    }

    return result;
}
```

## Async Exception Handling

```csharp
// Exceptions in async methods
public async Task ProcessAsync()
{
    try
    {
        await DoWorkAsync();
    }
    catch (HttpRequestException ex)
    {
        // Exception is properly caught here
        logger.LogError(ex, "HTTP request failed");
        throw;
    }
}

// Task.WhenAll - first exception thrown, all available
try
{
    await Task.WhenAll(task1, task2, task3);
}
catch (Exception ex)
{
    // ex is the first exception
    // Access all via the task
}

// Handle all exceptions from WhenAll
var allTasks = Task.WhenAll(task1, task2, task3);
try
{
    await allTasks;
}
catch
{
    // Aggregate contains all exceptions
    AggregateException? aggregate = allTasks.Exception;
    foreach (var ex in aggregate?.InnerExceptions ?? Enumerable.Empty<Exception>())
    {
        logger.LogError(ex, "Task failed");
    }
}

// Fire and forget with exception handling
public static async void SafeFireAndForget(
    this Task task,
    Action<Exception>? onException = null)
{
    try
    {
        await task;
    }
    catch (Exception ex)
    {
        onException?.Invoke(ex);
    }
}

// Avoid: unobserved exceptions
_ = DoWorkAsync();  // Exception may be lost!

// Better: fire and forget safely
DoWorkAsync().SafeFireAndForget(ex => logger.LogError(ex, "Background task failed"));
```

## Logging Exceptions

```csharp
// With ILogger (Microsoft.Extensions.Logging)
catch (Exception ex)
{
    // Log with exception parameter - preserves stack trace
    logger.LogError(ex, "Failed to process order {OrderId}", orderId);

    // Don't do this - loses exception details
    logger.LogError("Failed to process order: " + ex.Message);

    throw;
}

// Structured logging
catch (Exception ex)
{
    logger.LogError(ex,
        "Order processing failed. OrderId={OrderId}, CustomerId={CustomerId}",
        orderId,
        customerId);
    throw;
}
```

## ExceptionDispatchInfo

Preserve and re-throw exceptions with original stack trace.

```csharp
ExceptionDispatchInfo? capturedException = null;

try
{
    DoWork();
}
catch (Exception ex)
{
    capturedException = ExceptionDispatchInfo.Capture(ex);
}

// Later, re-throw with original stack trace
if (capturedException != null)
{
    capturedException.Throw();  // Original stack trace preserved
}
```

## Best Practices

### Do

```csharp
// Use specific exception types
throw new ArgumentNullException(nameof(input));

// Include context in messages
throw new InvalidOperationException(
    $"Cannot transition from {currentState} to {newState}");

// Preserve stack trace when re-throwing
catch (Exception ex)
{
    logger.LogError(ex, "Operation failed");
    throw;  // Not throw ex;
}

// Use exception filters for logging
catch (Exception ex) when (LogAndContinue(ex))
{
}

// Clean up resources with using
using var stream = File.OpenRead(path);

// Validate arguments early
ArgumentNullException.ThrowIfNull(order);
```

### Don't

```csharp
// Don't catch and swallow
catch (Exception) { }  // BAD: Hides problems

// Don't catch Exception without re-throwing or logging
catch (Exception ex)
{
    return null;  // BAD: Lost information
}

// Don't use exceptions for flow control
try
{
    var user = GetUser(id);
}
catch (UserNotFoundException)
{
    return CreateNewUser(id);  // BAD: Use TryGet pattern instead
}

// Don't throw Exception or ApplicationException
throw new Exception("Something went wrong");  // Too generic

// Don't throw in finally
finally
{
    throw new Exception();  // BAD: Overwrites original exception
}
```

## Key Takeaways

**Use specific exceptions**: Throw and catch specific exception types rather than generic Exception.

**Preserve stack traces**: Use `throw;` not `throw ex;` when re-throwing.

**Exception filters for conditions**: Use `when` clauses to filter without catching and re-throwing.

**Using for cleanup**: Prefer `using` statements over try/finally for IDisposable resources.

**Don't use exceptions for flow control**: Use TryParse patterns, null checks, or Result types for expected cases.

**Validate early**: Use guard clauses at method entry to fail fast with clear messages.

**Log then throw**: When catching to log, always re-throw or handle completely.
