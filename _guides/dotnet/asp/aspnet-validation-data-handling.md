---
title: "Validation"
layout: guide
category: "ASP.NET Core"
subcategory: "Building APIs"
description: "Validating API input in ASP.NET Core: the separate validation systems for controllers and .NET 10 minimal APIs, data annotations and custom attributes, IValidatableObject, FluentValidation without its no-longer-supported auto-validation, and why uniqueness checks belong to the database."
tags: [practical, validation, data-annotations, ivalidatableobject, fluent-validation, source-generators]
---

## Where Validation Runs

Validation checks that a request's input meets the API's rules before the handler acts on it. It always runs after *model binding*, the step that turns route values, query strings, headers, and the body into typed parameters. A body that fails to deserialize, such as `"abc"` sent for a number, is a binding failure, not a validation failure, and the rules on that body never run. Controllers report the binding error in the same `400` as any validation errors from other parameters. Minimal APIs reject the request with a plain `400` before validation starts, or show the exception page in Development. A route or query value that fails to parse behaves differently in minimal APIs. The request is marked `400`, but the validation filter still runs, against the parameter's default value, so `?page=abc` for a `[Range(1, 100)] int page` reports a range error rather than a parse error.

### Two Validation Systems

ASP.NET Core has two validation systems, one for each way of building an API. Both read the same rules, the attributes from `System.ComponentModel.DataAnnotations` and the `IValidatableObject` interface, so a request model can be shared between them.

| | Controllers | Minimal APIs (.NET 10) |
| --- | --- | --- |
| System | MVC model validation | `Microsoft.Extensions.Validation` |
| Turned on by | `AddControllers()` | `builder.Services.AddValidation()` |
| Runs | After binding, before action filters | In an *endpoint filter*, code that wraps the handler, placed ahead of every other endpoint filter |
| Results go to | `ModelState`, the per-request record of binding and validation errors | Straight to the error response |
| Invalid request gets | An automatic `400` under `[ApiController]`, otherwise the action checks `ModelState.IsValid` | A `400` before the handler runs |
| Non-nullable reference properties, with nullable reference types enabled | Implicitly required | Required only with `[Required]` |

The systems don't mix. `AddValidation` has no effect on controllers, and controller validation doesn't apply to minimal API handlers.

### The Error Response

Controllers return failures as a *validation problem details* body, the standard JSON error format defined by [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457){:target="_blank" rel="noopener noreferrer"}, with an `errors` object that maps each failing field to its messages:

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "One or more validation errors occurred.",
  "status": 400,
  "errors": {
    "Username": ["The field Username must be a string with a minimum length of 3 and a maximum length of 50."],
    "Customer.ShippingAddress.Street": ["Street is required."]
  },
  "traceId": "00-6f1c...-01"
}
```

Minimal APIs write the full body only when the app registers the problem details service, which `builder.Services.AddProblemDetails()` does. Without it, the response carries just `title` and `errors`. An API that has both kinds of endpoint needs `AddProblemDetails()` for their errors to match.

The second key comes from an order model with a nested customer and address. Nested properties and collection items get paths such as `Customer.ShippingAddress.Street` and `OrderItems[0].Description`, so a client can place each error next to the right field.

## Data Annotations

Data annotations are attributes on the properties of a request model. The common built-in ones are `[Required]`, `[StringLength]`, `[Range]`, `[EmailAddress]`, `[RegularExpression]`, and `[Compare]`. Each has a default message, and `ErrorMessage` replaces it:

```csharp
public class CreateUserRequest
{
    [Required, StringLength(50, MinimumLength = 3)]
    public string? Username { get; set; }

    [Required(ErrorMessage = "An email address is required."), EmailAddress]
    public string? Email { get; set; }

    [Range(18, 120)]
    public int Age { get; set; }

    [RegularExpression(@"^\d{3}-\d{2}-\d{4}$")]
    public string? TaxId { get; set; }
}
```

Two rules about what counts as missing catch people.

- **`[Required]` can't fail on a non-nullable value type.** A JSON body with no `age` deserializes to `0`, which is a value, so `[Required] int Age` passes. Declare it `int?` with `[Required]`, or mark the property with the C# `required` keyword so that deserialization itself rejects a body without it.
- **Controllers treat non-nullable reference types as required.** With nullable reference types enabled, MVC treats every non-nullable reference-type parameter and bound property as if it had `[Required(AllowEmptyStrings = true)]`. A `string Notes` property with no initializer, which the client considers optional, then fails with a `400` nobody wrote a rule for. Declaring it `string?` or giving it a non-null initializer avoids that, and setting `MvcOptions.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes` to `true` turns the behavior off. Minimal API validation has no such rule, so the same model can behave differently in the two systems.

## Cross-Property Rules with IValidatableObject

An attribute sees one property, so a rule that compares two, such as a check-out date after the check-in date, goes in the model. `IValidatableObject` adds a `Validate` method that returns every failure. Its `ValidationContext` parameter describes what is being validated and can resolve services, covered under custom attributes below.

```csharp
public class CreateReservationRequest : IValidatableObject
{
    public DateOnly CheckIn { get; set; }
    public DateOnly CheckOut { get; set; }

    [Range(1, 10)]
    public int Guests { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (CheckOut <= CheckIn)
        {
            yield return new ValidationResult(
                "Check-out must be after check-in.", [nameof(CheckOut)]);
        }
        else if (CheckOut.DayNumber - CheckIn.DayNumber > 30)
        {
            yield return new ValidationResult(
                "Reservations can't exceed 30 nights.", [nameof(CheckIn), nameof(CheckOut)]);
        }
    }
}
```

The member names passed to `ValidationResult` decide which keys in `errors` the message appears under.

Both systems validate every property's attributes first. They run the type's own rules, meaning `Validate` and any *type-level attribute* (a `ValidationAttribute` placed on the class, which sees the whole object), only when every property passed. A request with `Guests = 0` and reversed dates reports only the guest count, and the date error appears after the client fixes it. That is the cost of `IValidatableObject`: a client can't see all of its errors in one round trip. MVC can run the type's rules anyway when `MvcOptions.ValidateComplexTypesIfChildValidationFails` is `true`. The minimal API system has no equivalent.

## Custom Validation Attributes

A rule that several models share, and that looks at one value, becomes an attribute. It derives from `ValidationAttribute` and overrides `IsValid`:

```csharp
public class FutureDateAttribute : ValidationAttribute
{
    protected override ValidationResult? IsValid(object? value, ValidationContext validationContext)
    {
        if (value is DateOnly date && date <= DateOnly.FromDateTime(DateTime.UtcNow))
        {
            return new ValidationResult("The date must be in the future.", [validationContext.MemberName!]);
        }

        return ValidationResult.Success;
    }
}

public class ScheduleEventRequest
{
    [Required, FutureDate]
    public DateOnly? EventDate { get; set; }
}
```

Returning `Success` for a `null` value, as this attribute does, leaves the missing-value check to `[Required]`, and most built-in attributes behave the same way, so rules combine without reporting a missing value twice. The property is `DateOnly?` for the reason given under data annotations. A non-nullable `DateOnly` would bind a missing value as `0001-01-01`, and the client would be told the date must be in the future rather than that it's missing.

An attribute can read services too, through `validationContext.GetService<T>()`, which makes configuration-driven rules possible. `IsValid` is synchronous in .NET 10, though, so a database or HTTP call inside it blocks a thread on every request. (.NET 11 adds asynchronous validation attributes to the minimal API system.)

## Uniqueness Belongs to the Database

A service-backed validator makes it tempting to check that an email address isn't already registered. The check is a race. Two requests can both see the address as free and both insert it, whichever library runs the check. The database's unique constraint is what guarantees uniqueness, so the handler attempts the insert and turns the constraint violation into a `409 Conflict`. The same holds for anything another request can change between the check and the write, such as stock levels or room availability. A validator can still check first to give a friendlier message, but it can't replace the constraint.

## Minimal API Validation in .NET 10

`builder.Services.AddValidation()` turns on validation for every minimal API endpoint. It validates every handler parameter that isn't a service, whether it comes from the route, the query string, a header, or the body. A class or record used as a parameter has its attributes and `IValidatableObject` rules applied, including those of nested objects and collection items:

```csharp
builder.Services.AddProblemDetails();
builder.Services.AddValidation();

app.MapPost("/products", (Product product) => TypedResults.Created($"/products/{product.Name}", product));

public record Product([Required] string Name, [Range(1, 1000)] int Quantity);
```

A parameter whose value is `null` is skipped in .NET 10, so `[Required]` on an omitted `int? page` query parameter never fires. Declaring the parameter non-nullable makes binding reject a missing value instead. A failing request gets a `400` before the handler runs. The body goes through `IProblemDetailsService`, the service `AddProblemDetails()` registers, so a custom implementation of it can reshape the response. `.DisableValidation()` on an endpoint turns validation off for it, and `[SkipValidation]` does the same for one property, parameter, or type.

Validation depends on a source generator that, at build time, finds the types used in endpoint handler signatures and writes validation code for them. Three limits follow from that.

- **It covers only the assembly that calls `AddValidation`.** Endpoints or models in a class library need their own `AddValidation` call from inside that library, typically wrapped in an extension method the host calls. A library built with the base `Microsoft.NET.Sdk` also needs a package reference to `Microsoft.Extensions.Validation`.
- **A root type the generator can't discover from a handler signature needs `[ValidatableType]`.** Types reachable from a marked type are included automatically. In .NET 10, `[ValidatableType]` and `[SkipValidation]` are *experimental*, meaning their design may still change. Using them from such a plain class library, rather than a Web SDK project, raises warning ASP0029 until it is suppressed.
- **Missing metadata fails silently.** A type the generator didn't cover isn't validated, and nothing is logged. Invalid input reaches the handler. The generator skips non-public types and properties, so an `internal record` used as a request body is never validated.

## FluentValidation

[FluentValidation](https://docs.fluentvalidation.net/){:target="_blank" rel="noopener noreferrer"} is a widely used library that moves rules out of attributes and into a validator class per model. Rules read as code, can be conditional, and can be asynchronous:

```csharp
public class CreateReservationValidator : AbstractValidator<CreateReservationRequest>
{
    public CreateReservationValidator(IRoomInventory inventory)
    {
        RuleFor(x => x.CheckOut).GreaterThan(x => x.CheckIn);

        RuleFor(x => x.Guests).InclusiveBetween(1, 10);

        RuleFor(x => x.Guests)
            .MustAsync((request, guests, token) =>
                inventory.HasCapacityAsync(request.CheckIn, request.CheckOut, guests, token))
            .WithMessage("No rooms are available for that many guests on those dates.")
            .When(x => x.CheckOut > x.CheckIn);
    }
}

builder.Services.AddValidatorsFromAssemblyContaining<CreateReservationValidator>();
```

`AddValidatorsFromAssemblyContaining`, from the `FluentValidation.DependencyInjectionExtensions` package, registers every validator as `IValidator<T>`. A validator's constructor can take services, which is what lets the capacity rule query inventory. That rule is a pre-check for a clearer message, since availability can change before the booking commits, and the booking itself still enforces capacity. Hanging the rule off `RuleFor(x => x.Guests)` files its error under `Guests`. A rule written as `RuleFor(x => x)` would land under an empty key that no form field matches.

### Auto-Validation Is No Longer Recommended

The older `FluentValidation.AspNetCore` package plugs validators into MVC model validation with `AddFluentValidationAutoValidation()`. FluentValidation's own documentation no longer recommends it for new projects, for three reasons. It works only with MVC, not minimal APIs. The MVC validation pipeline is synchronous, so a validator with a `MustAsync` rule, like the one above, can't run under it. And because so much happens behind the scenes, a validator that doesn't run is hard to debug.

### Calling Validators Explicitly

The recommended approach is to call the validator explicitly. In a minimal API, an endpoint filter does that once for every endpoint that needs it:

```csharp
public class ValidationFilter<T>(IValidator<T> validator) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        if (context.Arguments.OfType<T>().FirstOrDefault() is { } argument)
        {
            var result = await validator.ValidateAsync(argument, context.HttpContext.RequestAborted);
            if (!result.IsValid)
            {
                return TypedResults.ValidationProblem(result.ToDictionary());
            }
        }

        return await next(context);
    }
}

app.MapPost("/reservations", (CreateReservationRequest request) => ...)
    .AddEndpointFilter<ValidationFilter<CreateReservationRequest>>();
```

`ToDictionary()` produces the property-to-messages shape that validation problem details expects, so clients see the same error format as built-in validation produces. In a controller, inject `IValidator<T>`, copy each failure into `ModelState` with `ModelState.AddModelError(error.PropertyName, error.ErrorMessage)`, and return `ValidationProblem()`. That goes through `ProblemDetailsFactory`, the same code the automatic `400` uses, so the body gets the same `type` and `traceId`.

Pick one system per model. With `AddValidation` on, built-in validation runs first and returns its own `400` before a FluentValidation filter is reached. The `CreateReservationRequest` above implements `IValidatableObject` and also has a validator, so it would be checked twice, with the first failure answered by built-in validation. Either keep the rules in one place or call `.DisableValidation()` on endpoints that FluentValidation covers.

## Choosing an Approach

| Rule | Approach | Why | Why not |
| --- | --- | --- | --- |
| One property's format or range | Data annotations | Declarative, run by both systems, and reflected in the generated OpenAPI schema | Can't compare properties or express conditions |
| Several properties of one model | `IValidatableObject` | Keeps the rule with the data it checks | Runs only after every property passes, so clients see errors in rounds |
| One value, reused across models | Custom `ValidationAttribute` | Written once, applied like a built-in attribute | Synchronous in .NET 10 |
| Conditional rules, rules that need services or I/O | FluentValidation, called explicitly | Async support and constructor injection | Rules don't appear in the OpenAPI schema without an extra library, and the call has to be wired per endpoint |
| Uniqueness, or anything another request can change | The handler, backed by a database constraint | A validator's answer can be stale by the time the write runs | No reason to skip it. A validator can add a friendlier message on top |

## Key Takeaways

- Validation runs after model binding. A body that doesn't deserialize fails as a binding error, and its rules never run.
- Controllers use MVC model validation and `ModelState`. Minimal APIs use `AddValidation` in .NET 10. Both read data annotations and `IValidatableObject`, and neither applies to the other.
- Minimal APIs return the full problem details body only when `AddProblemDetails()` is registered.
- `[Required]` on a non-nullable value type never fails. Controllers treat non-nullable reference types as required, and minimal APIs don't.
- Property attributes run first. Type-level rules, including `IValidatableObject`, run only when every property passed.
- Minimal API validation relies on a source generator. It covers only the calling assembly and skips undiscovered types without any warning.
- FluentValidation's auto-validation package is MVC-only and can't run async rules. Call validators explicitly, and don't also run built-in validation on the same model.
- Uniqueness is enforced by a database constraint, not a validator.
