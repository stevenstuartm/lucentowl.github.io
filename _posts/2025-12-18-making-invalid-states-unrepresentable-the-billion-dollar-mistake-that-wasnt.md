---
layout: post
title: "Making Invalid States Unrepresentable: The Billion-Dollar Mistake That Wasn't"
date: 2025-12-18
description: "Structure your data so invalid states cannot exist. Validate at construction, trust internally, and let null crash loudly rather than masking absence with defaults that propagate corruption silently through your system."
tags: [software-design, patterns, security, defensive-programming]
author: steven-stuart
---

The billion-dollar mistake. That's what Tony Hoare called his invention of the null reference in 1965. The quote gets repeated so often that "null is dangerous" has become conventional wisdom, especially among entry-level and intermediate developers who hear it as dogma without understanding the context or the alternatives that can be far worse.

But I think we're blaming the wrong villain. Null may have saved far more than it ever cost. Every null reference exception that crashed a system may also have prevented that system from proceeding with corrupted data and invalid logical decisions. The billion-dollar mistake framing counts the crashes but ignores the corruption that never happened. You can count the cost of bug fixes, but what about the disasters those "bugs" prevented?

Information security professionals value the CIA triad of Confidentiality, Integrity, and Availability. Software developers tend to obsess over availability, and that's understandable since a crashed service is visible, embarrassing, and can violate business SLAs. But integrity failures are far worse. Data that looks valid but isn't can corrupt your system just as surely as SQL injection or a man-in-the-middle attack. The corruption just compounds slower and is harder to detect. This is the lens through which the null debate should be understood.

The most common way that developers try to avoid the null issue entirely is to implement default values. However, default values may allow invalid data to flow silently through the system until it corrupts something important. Null crashes loudly at the point of misuse, which is an availability problem you can see and fix. A default value that masks missing data? That proceeds quietly until it causes a security vulnerability, a financial miscalculation, or data corruption that might require weeks to detect and more to fix.

## What "Making Invalid States Unrepresentable" Actually Means

The phrase comes from type theory and functional programming, but the concept is practical: structure your data so that invalid combinations cannot exist. Invalid states should fail at construction time, not at runtime deep in business logic.

Consider a user registration:

```csharp
public class UserRegistration
{
    public string Email { get; set; } = "";
    public string Password { get; set; } = "";
}
```

This class allows every invalid state imaginable. Empty email, empty password, any combination. The defaults make it easy to construct an object that looks valid but isn't. Code that receives this object has no way to know whether the empty string represents "not provided" or "explicitly set to empty" or "bug in upstream code."

Compare:

```csharp
public class UserRegistration
{
    public string Email { get; }
    public string Password { get; }

    public UserRegistration(string email, string password)
    {
        if (string.IsNullOrWhiteSpace(email))
            throw new ArgumentException("Email is required", nameof(email));

        if (string.IsNullOrWhiteSpace(password))
            throw new ArgumentException("Password is required", nameof(password));

        Email = email;
        Password = password;
    }
}
```

Now invalid states cannot be constructed. There's no default email that masks a missing value. There's no way to create a registration without providing required data. The validation happens once, at the boundary, and everything downstream can trust the object is valid.

C# 11 introduced the `required` keyword, which moves this enforcement to compile time for simpler cases:

```csharp
public class UserRegistration
{
    public required string Email { get; init; }
    public required string Password { get; init; }
}
```

The compiler refuses to let you construct a `UserRegistration` without setting both properties. This is "making invalid states unrepresentable" at its purest: the invalid state literally cannot be expressed in code that compiles.

The distinction between `required` and constructor validation is straightforward: `required` enforces *presence*, constructors enforce *validity*. Use `required` when presence is all you need. Use constructors when you need validation logic, like checking that the email contains an `@` or that the password meets complexity requirements.

However, `required` works best for internal domain objects and state that you control. At system boundaries where data arrives via deserialization, serializers and ORMs use parameterless constructors and set properties via reflection, bypassing the compile-time enforcement entirely. The same applies to some dependency injection containers and mocking frameworks. For API contracts and external data, you still need runtime validation with `[Required]` attributes or explicit checks. The compiler enforcement is powerful, but it only reaches code paths that go through normal construction.

### Where the Problem Usually Starts: API Contracts

The domain model above is clean, but most developers encounter this tension at the API boundary first. Consider a typical request DTO:

```csharp
public class CreateUserRequest
{
    [Required]
    public string Email { get; set; } = "";

    [Required]
    public string Password { get; set; } = "";

    [Required]
    public bool RegisterForAlerts { get; set; } = false;
}
```

The `[Required]` attribute signals intent, but the developer adds `= ""` out of habit or a misguided sense of defensive coding. Now there's a contradiction: the attribute says "required" while the code says "default to empty string."

When JSON is deserialized, a missing field becomes null because the serializer doesn't know about your default. The `= ""` only takes effect when code constructs the object directly, bypassing deserialization entirely. So the default creates a split: API calls get null (correctly rejected by `[Required]`), but test code or internal construction gets empty string (silently accepted). The `[Required]` attribute is runtime validation, not compile-time enforcement.

The fix is simple: don't add the default.

```csharp
public class CreateUserRequest
{
    [Required]
    public string Email { get; set; }

    [Required]
    public string Password { get; set; }

    //The business could decide that this should default to false but test that assumption first!
    [Required]
    public bool RegisterForAlerts { get; set; }
}
```

The `[Required]` attribute ensures the framework validates these fields before your code ever touches them. If validation is bypassed and the property is accessed while null, you get a null reference exception rather than an empty string that looks valid. Null forces handling; the empty string would have propagated silently.

## Why Defaults Are More Dangerous Than Null

Default values create four categories of problems that null avoids.

**Silent propagation of invalid state.** When a required field defaults to an empty string or zero, the invalid state propagates through the system. Each layer assumes the previous layer validated the data. Nobody validated it because it never looked invalid. The corruption accumulates until something finally breaks far from the source.

Consider a payment processing system:

```csharp
public class PaymentRequest
{
    public decimal Amount { get; set; } = 0m;
    public string Currency { get; set; } = "USD";
    public string MerchantId { get; set; } = "";
}
```

A bug upstream fails to set the amount. The payment proceeds with `Amount = 0`. No crash, no exception, no alert. The transaction logs show a valid-looking payment. Days later, someone notices revenue is wrong. The investigation takes hours because nothing obviously failed.

**Ambiguous semantics.** Does `Amount = 0` mean "free transaction," "not set," or "bug"? Does `Email = ""` mean "user declined to provide" or "form field wasn't rendered"? Default values overload meaning. Null is unambiguous: this value is absent.

<blockquote class="pull-quote">
<p>A default value claims knowledge it doesn't have. Null admits ignorance.</p>
</blockquote>

This ambiguity becomes critical in update operations. When a client submits an update request, the API needs to distinguish between "set this field to empty" and "don't touch this field." Without null, there's no way to express that distinction. Entity Framework relies on this exact semantic: when you load an entity without its relationships, those navigation properties are null. EF interprets null as "not loaded, don't modify" rather than "delete all relationships." If null didn't exist, EF would need the client to re-submit every relationship on every update, or every API would need to accept key-value collections instead of typed objects. Null isn't just tolerable here; it's the simplest solution to a problem that has no good alternatives.

**Validation bypass.** Code that checks `if (amount != null)` correctly identifies missing data. Code that checks `if (amount != 0)` conflates "missing" with "zero." Legitimate zero values become impossible to represent. Business logic contorts to handle the ambiguity that defaults introduced.

**Security vulnerabilities.** Default values can silently create security holes. Consider a `RateLimitPerMinute` field that defaults to `0`. In some systems, zero means "no limit," so a malformed request that should be rejected instead gets unlimited access. Or a `Permissions` string that defaults to empty, which a downstream parser interprets as "inherit all permissions from parent." The request looked valid, passed through every layer, and granted access it shouldn't have. With null, the missing field would have forced explicit handling: reject the request, require the field, or make a conscious decision about what absence means.

## The Actual Billion-Dollar Mistake

Hoare called null his billion-dollar mistake, and the criticism was valid for its time. ALGOL W and its descendants treated every reference as implicitly nullable. There was no type-level distinction between "this can be null" and "this is never null." The compiler couldn't help you, and nothing forced developers to consider absence. In that context, null was dangerous because the type system provided no guardrails.

But modern type systems solved this problem without eliminating null. C# 8.0 introduced nullable reference types that distinguish `string` (never null) from `string?` (might be null). Kotlin distinguishes `String` from `String?`. TypeScript has strict null checks. These languages preserve null's benefits while adding type safety. The billion-dollar mistake wasn't null itself; it was nullable references in type systems that didn't require handling.

<blockquote class="pull-quote">
<p>Hoare's mistake wasn't inventing null. It was inventing null without inventing <code>string?</code>.</p>
</blockquote>

The mistake we keep making today is different. It's the pattern of masking errors with defaults instead of failing fast. Every system that returned `-1` instead of throwing an exception. Every API that substituted empty arrays for error responses. Every constructor that initialized required fields to placeholder values. These patterns hide bugs rather than reveal them.

## Counterarguments and When Defaults Make Sense

This isn't a blanket condemnation of all default values. Some counterarguments deserve serious consideration.

**"Null reference exceptions are the most common runtime error."** They are, and that's actually the point. Null crashes at the point of use when absence wasn't handled upstream, revealing the bug rather than hiding it. The frequency of null reference exceptions reflects how often code fails to handle absent values, not a flaw in null itself. The alternative isn't fewer bugs; it's bugs that manifest as data corruption instead of crashes.

But a high frequency of null reference exceptions also signals something deeper: continuous misalignment between the development team and stakeholders about what the system should accept and produce. Unit tests exist to test assumptions and prove agreement in both application logic and API contracts. If null reference exceptions keep appearing, the team hasn't captured those agreements in tests, or the agreements themselves are unclear. The exceptions are symptoms of a collaboration problem, not just a coding problem.

**"Option/Maybe types are strictly better than null."** For representing intentional absence, they genuinely are better. `Option<User>` makes it explicit that a user might not exist, and pattern matching forces you to handle both cases. Functional programmers rightly point out that `Option.getOrElse(default)` is a code smell because the whole point is to force handling, not to provide an escape hatch.

But this proves my argument rather than refuting it. Option types work precisely because they make you handle absence explicitly. They fail at compile time if you ignore the `None` case. That's the same principle I'm advocating: force handling, don't mask absence. The problem isn't null versus Option. It's whether your system forces you to confront missing data or lets you paper over it. An Option that returns a default value on `None` has the same problem as a nullable field with a default. Most runtimes depend on null, and used correctly with modern type systems, it fulfills the same purpose that Option types serve in functional languages.

**"Defensive programming means providing safe defaults."** This conflates two different concerns. Resilience at system boundaries means handling malformed external input gracefully, but that's different from masking bugs internally. External APIs should validate input and return clear errors. Internal code should fail fast on invalid state. Providing "safe" defaults inside the system just moves the failure somewhere harder to diagnose.

**"Users shouldn't see crashes."** Correct, which is why you handle errors at system boundaries. But the crash should still happen internally. Catch exceptions at the API layer, log the details, return a user-friendly error. The internal crash gave you the information to fix the bug. A silent default would have hidden it. And consider: even in runtimes that avoid null entirely, you still need this exception handling infrastructure. Network failures, file system errors, out-of-memory conditions, and database constraint violations all throw exceptions regardless of your null strategy. The boundary handling you need for those exceptional failures handles null reference exceptions too.

**"Some fields genuinely have sensible defaults."** True. A `CreatedAt` timestamp defaulting to `DateTime.UtcNow` makes sense. A `RetryCount` defaulting to `0` represents legitimate initial state. The distinction is between defaults that represent valid initial state versus defaults that mask missing required data. Configuration values, counters, and timestamps often have legitimate defaults. User-provided data, external inputs, and required business fields typically don't.

## Exceptions vs. Result Types

If failing loudly is the goal, why not use exceptions everywhere? The distinction is semantic: exceptions for bugs, Result types for expected outcomes.

A null on a required field represents a violated constraint, something the system was promised it wouldn't receive. That's a bug. The correct response is to crash, log, and fix the code. A Result type represents an expected domain outcome: "user not found" or "validation failed" aren't bugs, they're legitimate results that correct code produced from valid input.

Ask whether the failure represents a bug or a legitimate outcome. If correct code with valid input could produce this result, use a Result type. If not, fail fast with an exception. Both approaches force handling; neither lets you ignore failure and proceed with corrupted state. The danger is when either mechanism gets misused to mask absence: catching exceptions and substituting defaults, or calling `Result.GetValueOrDefault()` without handling the failure case.

## Construction vs. Consumption

The confusion around null often stems from conflating two different phases.

**At construction time**, invalid states should fail immediately. Required fields should not have defaults that mask their absence. Validation should happen once, at the boundary, with clear errors for invalid input. Objects that exist should be valid by construction.

**At consumption time**, code shouldn't need to check validity. If an object exists, it's valid. The null checks happen at construction and boundaries. Internal code that receives a `UserRegistration` shouldn't need to re-validate the email because the constructor already guarantees it's present and valid.

This unsettles developers who've been taught to validate defensively at every layer. But spreading validation across layers is itself a source of bugs. When validation logic lives in the controller, the service, the repository, and the domain model, you've scattered what should be encapsulated business rules across your entire codebase. When validation rules change, you update three places and miss the fourth. When different layers implement slightly different rules, you get inconsistent behavior that's nearly impossible to debug. The same principle applies whether you prefer exceptions or Result types: you don't handle every possible failure at every layer. You propagate failures up to the correct boundary where they can be handled appropriately. Validation belongs at trust boundaries, not scattered throughout internal code that should be able to assume valid input.

Null is dangerous when it appears unexpectedly in consumption code because construction failed to validate. Null is valuable when it represents intentional absence or when it forces construction to fail on invalid input.

This doesn't mean a single validation layer. Systems have multiple trust boundaries: the API gateway, service boundaries, aggregate roots, database constraints. Each boundary validates what it needs to trust. The principle is that once data crosses a boundary and is accepted, code on the inside shouldn't re-validate it. Validate at each door, trust everyone inside that room.

## Practical Guidelines

**Enforce requirements at the correct layer.** At ingress boundaries (API DTOs, deserialization), fields may be nullable because input might be missing. After validation, domain objects should have non-nullable required fields because their existence proves validity. A nullable `int?` signals "this is optional." If a value is required, it should be non-nullable in the domain model because validation already guaranteed its presence.

**Reserve defaults for genuinely optional fields with valid initial states.** Retry counts, timestamps, configuration values, and accumulator fields often have legitimate defaults that represent real initial state, not masked absence.

**Validate at boundaries, trust internally.** System boundaries (API endpoints, message handlers, deserialization) should validate everything and reject invalid input. Internal code should trust that objects exist because they're valid.

**Prefer crashes to silent corruption.** A null reference exception in development or staging catches bugs immediately. A default value that hides the bug lets it reach production and corrupt data.

**Know when to use Result types versus exceptions.** When an operation might legitimately fail, use Result types. When something unexpected happens, fail fast with an exception.

## Failing Loudly Is a Feature

The fear of null comes from the pain of decades of null reference exceptions in production, frustrated debugging sessions, and systems that crashed when they should have kept running in theory. But crashes are symptoms, not the disease. The disease is code that doesn't handle absence properly. The cure isn't eliminating null; it's using null correctly as part of a system that makes invalid states unrepresentable.

Default values do the opposite. They hide bugs, propagate invalid state, and create corruption that surfaces far from its source. When you substitute a default for missing data, you're creating records that claim to represent reality but don't. Every downstream system that trusts that data inherits the lie.

The real billion-dollar mistake isn't null. It's the widespread practice of substituting defaults for validation, prioritizing code that runs over code that runs correctly. Given the choice between an availability problem you can see and fix, and an integrity problem that compounds invisibly until something important breaks, I'll take the availability problem every time.
