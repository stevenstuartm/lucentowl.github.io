---
layout: post
title: "Making Invalid States Unrepresentable: Why Null Wasn't the Billion-Dollar Mistake"
date: 2025-12-18
description: "Structure your data so invalid states cannot exist. Validate at construction, trust internally, and let null crash loudly rather than masking absence with defaults that propagate corruption silently through your system."
tags: [software-design, patterns, security, defensive-programming]
author: steven-stuart
sources:
  - title: "Tony Hoare, Null References: The Billion Dollar Mistake (InfoQ, 2009)"
    url: "https://www.infoq.com/presentations/Null-References-The-Billion-Dollar-Mistake-Tony-Hoare/"
  - title: "Yaron Minsky, Effective ML Revisited (Jane Street, 2011)"
    url: "https://blog.janestreet.com/effective-ml-revisited/"
  - title: "Microsoft Learn: Require properties for deserialization (System.Text.Json)"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json/required-properties"
  - title: "Microsoft Learn: Model validation in ASP.NET Core MVC"
    url: "https://learn.microsoft.com/en-us/aspnet/core/mvc/models/validation"
  - title: "nginx documentation: client_max_body_size"
    url: "https://nginx.org/en/docs/http/ngx_http_core_module.html#client_max_body_size"
  - title: "Microsoft Learn: Nullable reference types (C#)"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/nullable-references"
---

The billion-dollar mistake. That's what Tony Hoare, in a 2009 talk, called his invention of the null reference for ALGOL W in 1965. The quote gets repeated so often that "null is dangerous" has become conventional wisdom, especially among entry-level and intermediate developers who hear it as dogma without understanding the context or the alternatives that can be far worse.

But I think we're blaming the wrong villain. Hoare's real alternative, references the compiler checks, beats both null and defaults, but a common way developers avoid null is a default, not an Option type. Compared with those defaults, null may have saved far more than it ever cost. Every null reference exception that crashed a system stopped it at the moment it tried to use a value nobody supplied, where a default would have let it proceed with corrupted data and invalid logical decisions. The billion-dollar mistake framing counts the crashes but ignores the corruption that never happened.

Information security professionals value the CIA triad of Confidentiality, Integrity, and Availability. Software developers tend to obsess over availability, and that's understandable since a crashed service is visible, embarrassing, and can violate business SLAs. But in any system whose data outlives the request, integrity failures are often far worse. Data that looks valid but isn't can corrupt your system just as surely as SQL injection or a man-in-the-middle attack. The corruption just compounds slower and is harder to detect. This is the lens through which the null debate should be understood.

In managed runtimes like the CLR and the JVM, null crashes loudly at the point of misuse, which is an availability problem you can see and fix. A default value that masks missing data? That proceeds quietly until it causes a security vulnerability, a financial miscalculation, or data corruption that might require weeks to detect and more to fix.

## What "Making Invalid States Unrepresentable" Actually Means

Yaron Minsky popularized the idea as "make illegal states unrepresentable" in his Effective ML material at Jane Street, including the 2011 post "Effective ML Revisited." It comes from functional programming, but the concept is practical: structure your data so that invalid combinations cannot exist. Invalid states should fail at construction time, not at runtime deep in business logic.

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

Now invalid states cannot be constructed, and there's no default email to mask a missing value.

C# 11 introduced the `required` keyword, which moves this enforcement to compile time for simpler cases:

```csharp
public class UserRegistration
{
    public required string Email { get; init; }
    public required string Password { get; init; }
}
```

The compiler refuses to let you construct a `UserRegistration` without setting both properties. This is the purest form of enforcing presence: an object missing either property cannot be expressed in code that compiles.

`required` enforces *presence*, and constructors enforce *validity*. `required` guarantees assignment, not a non-null value, so `Email = null!` still compiles. Use `required` when presence is all you need. Use constructors when you need validation logic, like checking that the email contains an `@` or that the password meets complexity requirements.

At system boundaries, objects are often built by reflection rather than by code the compiler checks. System.Text.Json has honored `required` since .NET 7 and throws when a required property is missing, though it accepts an explicit null unless you enable `RespectNullableAnnotations`, added in .NET 9. Other serializers, ORMs, some dependency injection containers, and mocking frameworks can create the object without ever setting it. For API contracts and external data, you still need runtime validation with `[Required]` attributes or explicit checks.

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

The `[Required]` attribute signals intent, but the developer adds `= ""` out of habit, a misguided sense of defensive coding, or to silence the compiler's CS8618 warning about an uninitialized non-nullable property. Now there's a contradiction: the attribute says "required" while the code says "default to empty string."

The two halves of that contradiction reach different callers. The serializer creates the object before reading the payload, so a missing `Email` becomes `""`, and `[Required]` still rejects it because it treats empty strings as missing by default. But a test or internal caller that constructs the object directly never runs that validation, so its empty string passes silently. The `bool` is worse. Microsoft's ASP.NET Core model validation documentation notes that a non-nullable field is always valid, so `[Required]` on a `bool` can never fail, and a client that omits `RegisterForAlerts` gets `false` with no error.

The fix is simple. Don't add the default, and declare every field nullable so its absence is visible.

```csharp
public class CreateUserRequest
{
    [Required]
    public string? Email { get; set; }

    [Required]
    public string? Password { get; set; }

    //The business could decide that this should default to false but test that assumption first!
    [Required]
    public bool? RegisterForAlerts { get; set; }
}
```

The `[Required]` attribute ensures the framework validates these fields before your code ever touches them, and `bool?` finally gives it a null to reject. If validation is bypassed, calling a method on the null `Email` throws a `NullReferenceException` and reading `RegisterForAlerts.Value` throws an `InvalidOperationException`, rather than handing back values that look valid. But null is loud only where code dereferences it. Coalescing with `?? false`, string interpolation, and a nullable database column all let it pass quietly. A non-nullable domain type or database column turns it back into a loud failure, which is why the boundary validation matters more than null alone.

## Why Defaults Are More Dangerous Than Null

Default values create four categories of problems that a null checked at construction avoids.

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

A bug upstream fails to set the amount. The payment proceeds with `Amount = 0`, and an internal ledger that allows zero-value entries for credits and free tiers records it without complaint. No crash, no exception, no alert. The transaction logs show a valid-looking payment. Days later, someone notices revenue is wrong. The investigation takes hours because nothing obviously failed. Deleting `= 0m` wouldn't help, because a `decimal` is zero anyway. The fix is `decimal?` or `required`, which gives absence somewhere to show.

**Ambiguous semantics.** Does `Amount = 0` mean "free transaction," "not set," or "bug"? Does `Email = ""` mean "user declined to provide" or "form field wasn't rendered"? Null keeps absence separate from every legitimate value.

<blockquote class="pull-quote">
<p>A default value claims knowledge it doesn't have. Null admits ignorance.</p>
</blockquote>

This ambiguity becomes critical in update operations. When a client submits an update request, the API needs to distinguish between "set this field to empty" and "don't touch this field." In a typed object, null is the simplest way to express that distinction. The alternatives, such as JSON Merge Patch documents, protobuf field masks, or an `Optional<T>` wrapper, add machinery to every update contract. They earn it when a client must also be able to set a field to null, which plain null can't tell apart from "leave it alone."

**Validation bypass.** Code that checks `if (amount != null)` correctly identifies missing data. Code that checks `if (amount != 0)` conflates "missing" with "zero." Legitimate zero values become impossible to represent.

**Security vulnerabilities.** Consider a `RateLimitPerMinute` field that defaults to `0`. In some systems, zero means "no limit" (nginx reads `client_max_body_size 0` that way), so a malformed request that should be rejected instead gets unlimited access. Or a `Permissions` string that defaults to empty, which a downstream parser interprets as "inherit all permissions from parent." With null, the missing field stays distinguishable from a deliberate zero, so a validator can reject the request, require the field, or make a conscious decision about what absence means. A parser that reads null as "unlimited" repeats the same mistake.

## The Actual Billion-Dollar Mistake

Hoare called null his billion-dollar mistake, and the criticism was valid for its time. His own account says his goal was references checked automatically by the compiler, and the mistake he confessed was adding a null the compiler didn't check. The slogan dropped that half. His confession holds up, and what doesn't is the slogan's reading of it, that null itself is the danger. ALGOL W and its descendants treated every reference as implicitly nullable. The compiler couldn't help you, and nothing forced developers to consider absence. In C and C++, where dereferencing null is undefined behavior rather than a guaranteed crash, unchecked null also produced the silent failures and vulnerabilities Hoare's talk describes.

But modern type systems address this problem without eliminating null. C# 8.0 introduced nullable reference types, compiler analysis that distinguishes `string` (expected never to be null) from `string?` (might be null) and warns when code dereferences a value that might be null. Kotlin distinguishes `String` from `String?` and refuses to compile the unchecked dereference. TypeScript has strict null checks. The billion-dollar mistake wasn't null itself; it was nullable references in type systems that never flagged missing handling.

<blockquote class="pull-quote">
<p>Hoare's mistake wasn't inventing null. It was inventing null without inventing <code>string?</code>.</p>
</blockquote>

The mistake we keep making today is different. It's the pattern of masking errors with defaults instead of failing fast. Every system that returned `-1` instead of throwing an exception. Every API that substituted empty arrays, or null, for error responses. Every constructor that initialized required fields to placeholder values. Null masks an error when it's returned in place of one, and it raises the alarm when it shows up where presence was required. What matters is whether something forces the absence to be handled.

## Counterarguments and When Defaults Make Sense

This isn't a blanket condemnation of all default values.

**"Null reference exceptions are the most common runtime error."** They're among the most common, and that's actually the point. The frequency of null reference exceptions reflects how often code fails to handle absent values, not a flaw in null itself. Non-nullable types do cut that frequency, by moving the failure to compile time rather than hiding it. Replacing null with defaults doesn't. It turns the same bugs into data corruption instead of crashes.

Many of those exceptions are ordinary oversights. But when they keep recurring where a field everyone assumed was required turns up missing, they can also signal something deeper: continuous misalignment between the development team and stakeholders about what the system should accept and produce. Unit tests exist to test assumptions and prove agreement in both application logic and API contracts. If null reference exceptions keep appearing, the team hasn't captured those agreements in tests, or the agreements themselves are unclear. In those cases, the exceptions are symptoms of a collaboration problem, not just a coding problem.

**"Option/Maybe types are strictly better than null."** For representing intentional absence, they genuinely are better. `Option<User>` makes it explicit that a user might not exist, and pattern matching forces you to handle both cases. That's also why `Option.getOrElse(default)`, used to silence a `None` the code should have handled, defeats the purpose. The whole point is to force handling, not to provide an escape hatch.

But this proves my argument rather than refuting it. In a language with exhaustive matching, like Rust, a match that ignores the `None` case won't compile. That's the same principle I'm advocating: force handling, don't mask absence. Most runtimes depend on null, and used correctly with modern type systems, it comes close to the guarantee Option types give in functional languages. C#'s analysis is advisory, and `!`, `default`, and deserializers can all defeat it, so its guarantee is weaker than Rust's. Treating nullable warnings as errors and validating at the boundaries where deserializers bypass it closes the gaps the compiler can see. Arrays, struct defaults, and reflection-based construction stay outside its analysis, which is why boundary validation still matters.

**"Defensive programming means providing safe defaults."** This conflates two different concerns. Resilience at system boundaries means handling malformed external input gracefully, but that's different from masking bugs internally. Providing "safe" defaults inside the system just moves the failure somewhere harder to diagnose.

**"Users shouldn't see crashes."** Correct, which is why you handle errors at system boundaries. But the crash should still happen internally. Catch exceptions at the API layer, log the details, return a user-friendly error. The internal crash gave you the information to fix the bug. A silent default would have hidden it. In a queue or batch job, the crash should send the one record to a dead-letter queue, not stall the records behind it. Every runtime already needs that boundary handling for network failures, file system errors, and constraint violations, and it catches null reference exceptions too.

**"Some fields genuinely have sensible defaults."** True. A `CreatedAt` timestamp defaulting to `DateTime.UtcNow` makes sense. A `RetryCount` defaulting to `0` represents legitimate initial state. The distinction is between defaults that represent valid initial state versus defaults that mask missing required data. User-provided data, external inputs, and required business fields typically don't have one.

## Exceptions for Bugs, Result Types for Expected Outcomes

If failing loudly is the goal, why not use exceptions everywhere?

A null on a required field represents a violated constraint, something the system was promised it wouldn't receive. That's a bug. The correct response is to crash, log, and fix the code. A Result type represents an expected domain outcome: "user not found" or "validation failed" aren't bugs, they're legitimate results that correct code produced from valid input.

If correct code with valid input could produce this result, use a Result type. If not, fail fast with an exception. Both approaches force handling; neither lets you ignore failure and proceed with corrupted state. The danger is when either mechanism gets misused to mask absence: catching exceptions and substituting defaults, or calling `Result.GetValueOrDefault()` without handling the failure case.

## Validate at Construction, Trust at Consumption

The confusion around null often stems from conflating two different phases.

**At construction time**, invalid states should fail immediately. Validation should happen once, at the boundary, with clear errors for invalid input. Objects that exist should be valid by construction.

**At consumption time**, code shouldn't need to check validity. Internal code that receives a `UserRegistration` shouldn't need to re-validate the email because the constructor already guarantees it's present and valid.

This unsettles developers who've been taught to validate defensively at every layer. But spreading validation across layers is itself a source of bugs. When validation logic lives in the controller, the service, the repository, and the domain model, you've scattered what should be encapsulated business rules across your entire codebase. When validation rules change, you update three places and miss the fourth. When different layers implement slightly different rules, you get inconsistent behavior that's nearly impossible to debug.

This doesn't mean a single validation layer. Systems have multiple trust boundaries: the API gateway, service boundaries, aggregate roots, database constraints. Each boundary validates what it needs to trust. Validate at each door, trust everyone inside that room.

## Practical Guidelines

**Enforce requirements at the correct layer.** At ingress boundaries (API DTOs, deserialization), fields may be nullable because input might be missing. After validation, domain objects should have non-nullable required fields because their existence proves validity. A nullable `int?` signals "this is optional."

**Reserve defaults for genuinely optional fields with valid initial states.** Retry counts, timestamps, configuration values, and accumulators qualify.

**Prefer crashes to silent corruption.** A null reference exception fails at the first use of the missing value instead of at an unknown later point. A default value that hides the bug lets it reach production and corrupt data.

## Failing Loudly Is a Feature

The fear of null comes from the pain of decades of null reference exceptions in production, and systems that crashed when they should have kept running in theory. But crashes are symptoms, not the disease. The disease is code that doesn't handle absence properly. The cure isn't eliminating null; it's using null correctly as part of a system that makes invalid states unrepresentable.

Default values do the opposite. When you substitute a default for missing data, you're creating records that claim to represent reality but don't. Every downstream system that trusts that data inherits the lie.

The real billion-dollar mistake isn't null. It's the widespread practice of substituting defaults for validation, prioritizing code that runs over code that runs correctly. In a system whose data outlives the request, given the choice between an availability problem you can see and fix, and an integrity problem that compounds invisibly until something important breaks, I'll take the availability problem every time.
