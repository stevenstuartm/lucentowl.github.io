---
title: "Validation"
layout: guide
category: "ASP.NET Core"
subcategory: "Building APIs"
description: "Comprehensive coverage of validation approaches, content negotiation, formatters, and file handling patterns in ASP.NET Core APIs."
tags: [asp-net-core, validation, data-annotations, fluent-validation, content-negotiation, file-uploads, json-serialization, model-binding]
---

## Validation and Data Handling in ASP.NET Core APIs

APIs exist to accept input, process it, and return output. Validation ensures the input meets expectations before processing begins. Data handling encompasses how that input arrives, how it transforms into application types, and how responses serialize back to clients. ASP.NET Core provides built-in validation through data annotations, integrates with third-party libraries like FluentValidation, and offers flexible content negotiation and serialization options. Understanding these mechanisms helps you build APIs that reject bad data early, handle multiple content types gracefully, and process file uploads without overwhelming server resources.

This guide covers validation patterns across controller-based and minimal APIs, explores System.Text.Json configuration, explains content negotiation and formatters, and examines file upload strategies including streaming for large files.

## Data Annotation Validation

Data annotations provide declarative validation rules using attributes from the `System.ComponentModel.DataAnnotations` namespace. These attributes decorate model properties and execute automatically during model binding.

### Built-In Validation Attributes

Common validation attributes include `[Required]`, `[StringLength]`, `[Range]`, `[EmailAddress]`, `[RegularExpression]`, and `[Compare]`. Each enforces specific constraints on the property value.

```csharp
public class CreateUserRequest
{
    [Required(ErrorMessage = "Username is required")]
    [StringLength(50, MinimumLength = 3)]
    public string Username { get; set; }

    [Required]
    [EmailAddress]
    public string Email { get; set; }

    [Range(18, 120)]
    public int Age { get; set; }

    [RegularExpression(@"^\d{3}-\d{2}-\d{4}$")]
    public string TaxId { get; set; }
}
```

Data annotations run during model binding, before the controller action or minimal API handler executes. If validation fails, the framework populates `ModelState` with error details.

### How ModelState Works

`ModelState` is a dictionary tracking both binding and validation errors. Each property name becomes a key, and validation errors for that property accumulate as values. Controllers and handlers can inspect `ModelState.IsValid` to determine whether validation succeeded.

```csharp
[HttpPost("users")]
public IActionResult CreateUser([FromBody] CreateUserRequest request)
{
    if (!ModelState.IsValid)
    {
        return BadRequest(ModelState);
    }

    // Process valid request
    return Ok();
}
```

When you return `BadRequest(ModelState)`, ASP.NET Core serializes the errors into a structured response showing which properties failed and why.

### ApiController Attribute and Automatic Validation

Controllers decorated with `[ApiController]` benefit from automatic validation. When model state is invalid, the framework returns an HTTP 400 response with a `ProblemDetails` payload before your action executes. You don't need to check `ModelState.IsValid` manually.

```csharp
[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    [HttpPost]
    public IActionResult Create([FromBody] CreateUserRequest request)
    {
        // If we reach this point, validation passed
        return Ok();
    }
}
```

This automatic behavior reduces boilerplate and ensures consistent error responses across your API. The `ProblemDetails` format includes a `type`, `title`, `status`, and `errors` dictionary mapping property names to validation messages.

## Complex Validation with IValidatableObject

Data annotations handle simple constraints well, but complex validation requiring multiple property comparisons or external dependencies needs a different approach. The `IValidatableObject` interface allows your model to contain custom validation logic.

```csharp
public class CreateReservationRequest : IValidatableObject
{
    [Required]
    public DateTime CheckInDate { get; set; }

    [Required]
    public DateTime CheckOutDate { get; set; }

    [Range(1, 10)]
    public int Guests { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (CheckOutDate <= CheckInDate)
        {
            yield return new ValidationResult(
                "Check-out date must be after check-in date",
                new[] { nameof(CheckOutDate) });
        }

        if ((CheckOutDate - CheckInDate).TotalDays > 30)
        {
            yield return new ValidationResult(
                "Reservations cannot exceed 30 days",
                new[] { nameof(CheckInDate), nameof(CheckOutDate) });
        }
    }
}
```

The `Validate` method executes after data annotation validation succeeds. If it yields any `ValidationResult` instances, those errors merge into `ModelState` and trigger the same 400 response behavior.

`IValidatableObject` works best for validation logic that belongs conceptually to the model itself. For rules requiring external services, databases, or complex business logic, consider custom validation attributes or FluentValidation.

## Custom Validation Attributes

When validation logic applies across multiple models but exceeds what built-in attributes provide, custom validation attributes offer reusability without duplicating code.

```csharp
public class FutureDateAttribute : ValidationAttribute
{
    protected override ValidationResult IsValid(object value, ValidationContext validationContext)
    {
        if (value is DateTime date)
        {
            if (date <= DateTime.UtcNow)
            {
                return new ValidationResult("Date must be in the future");
            }
        }

        return ValidationResult.Success;
    }
}

public class ScheduleEventRequest
{
    [Required]
    [FutureDate]
    public DateTime EventDate { get; set; }
}
```

Custom attributes inherit from `ValidationAttribute` and override `IsValid`. The `ValidationContext` parameter provides access to the entire object being validated, the service provider for dependency injection, and other contextual information.

### Validation Attributes with Dependencies

If your validation logic requires external services like a database or HTTP client, request those dependencies through the `ValidationContext.GetService` method. This approach allows unit testing by mocking services while keeping the attribute declarative.

```csharp
public class UniqueEmailAttribute : ValidationAttribute
{
    protected override ValidationResult IsValid(object value, ValidationContext validationContext)
    {
        if (value is string email)
        {
            var userRepository = validationContext.GetService(typeof(IUserRepository)) as IUserRepository;
            if (userRepository != null && userRepository.EmailExists(email))
            {
                return new ValidationResult("Email address already in use");
            }
        }

        return ValidationResult.Success;
    }
}
```

This pattern works, but accessing the database during model validation has performance implications. Consider whether validation belongs in the model layer or should move to a service layer instead.

## FluentValidation Integration

FluentValidation provides a fluent interface for building validation rules in dedicated validator classes instead of decorating models with attributes. This separation keeps validation logic distinct from data transfer objects and enables more sophisticated rule composition.

### Basic FluentValidation Setup

Install the `FluentValidation.AspNetCore` package and register validators in the dependency injection container. Validators implement `AbstractValidator<T>` and define rules in their constructors.

```csharp
public class CreateUserRequestValidator : AbstractValidator<CreateUserRequest>
{
    public CreateUserRequestValidator()
    {
        RuleFor(x => x.Username)
            .NotEmpty().WithMessage("Username is required")
            .Length(3, 50);

        RuleFor(x => x.Email)
            .NotEmpty()
            .EmailAddress();

        RuleFor(x => x.Age)
            .InclusiveBetween(18, 120);
    }
}
```

Register FluentValidation in your service configuration:

```csharp
builder.Services.AddValidatorsFromAssemblyContaining<CreateUserRequestValidator>();
builder.Services.AddFluentValidationAutoValidation();
```

The `AddFluentValidationAutoValidation` method integrates validators into the ASP.NET Core pipeline. When model binding completes, FluentValidation runs registered validators and populates `ModelState` with errors, triggering the same automatic 400 responses in controllers with `[ApiController]`.

### Complex Rules and Conditional Validation

FluentValidation excels at complex scenarios. You can compose rules conditionally, validate collections, implement custom validators, and perform asynchronous validation.

```csharp
public class CreateReservationRequestValidator : AbstractValidator<CreateReservationRequest>
{
    public CreateReservationRequestValidator()
    {
        RuleFor(x => x.CheckInDate)
            .NotEmpty()
            .GreaterThan(DateTime.UtcNow);

        RuleFor(x => x.CheckOutDate)
            .NotEmpty()
            .GreaterThan(x => x.CheckInDate);

        RuleFor(x => x)
            .Must(x => (x.CheckOutDate - x.CheckInDate).TotalDays <= 30)
            .WithMessage("Reservations cannot exceed 30 days")
            .When(x => x.CheckInDate != default && x.CheckOutDate != default);

        RuleFor(x => x.Guests)
            .InclusiveBetween(1, 10);
    }
}
```

The `Must` method accepts a predicate for custom logic. The `When` method applies rules conditionally. You can chain multiple conditions and rules to express intricate validation requirements that would be cumbersome with data annotations.

### Asynchronous Validation

FluentValidation supports asynchronous validation when rules require I/O operations like database queries or HTTP calls.

```csharp
public class CreateUserRequestValidator : AbstractValidator<CreateUserRequest>
{
    private readonly IUserRepository _repository;

    public CreateUserRequestValidator(IUserRepository repository)
    {
        _repository = repository;

        RuleFor(x => x.Email)
            .NotEmpty()
            .EmailAddress()
            .MustAsync(BeUniqueEmail)
            .WithMessage("Email address already in use");
    }

    private async Task<bool> BeUniqueEmail(string email, CancellationToken token)
    {
        return !await _repository.EmailExistsAsync(email, token);
    }
}
```

The `MustAsync` method accepts an async predicate. FluentValidation invokes it during validation and awaits the result. This pattern enables validation against external systems while keeping the validator testable through dependency injection.

## Validation in Minimal APIs

Before .NET 10, minimal APIs lacked built-in validation support. Developers manually invoked validators or used third-party libraries. .NET 10 introduced native validation for minimal APIs, aligning them with controller behavior.

### Built-In Validation in .NET 10

To enable validation in minimal APIs, call `AddValidation` when configuring services. This activates data annotation validation automatically.

```csharp
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddValidation();

var app = builder.Build();

app.MapPost("/users", (CreateUserRequest request) =>
{
    // If we reach here, validation passed
    return Results.Ok();
});

app.Run();
```

When validation fails, the framework returns a 400 Bad Request response with a `ProblemDetails` payload, matching controller behavior. You don't need to check validation state manually.

### Using FluentValidation with Minimal APIs

FluentValidation works with minimal APIs when registered through `AddValidatorsFromAssembly` and `AddFluentValidationAutoValidation`. The integration populates validation errors and triggers automatic 400 responses.

```csharp
builder.Services.AddValidatorsFromAssemblyContaining<Program>();
builder.Services.AddFluentValidationAutoValidation();

app.MapPost("/users", (CreateUserRequest request) =>
{
    return Results.Created($"/users/{request.Username}", request);
});
```

If you prefer manual validation control, inject `IValidator<T>` into the handler and invoke validation explicitly.

```csharp
app.MapPost("/users", async (CreateUserRequest request, IValidator<CreateUserRequest> validator) =>
{
    var result = await validator.ValidateAsync(request);
    if (!result.IsValid)
    {
        return Results.ValidationProblem(result.ToDictionary());
    }

    return Results.Created($"/users/{request.Username}", request);
});
```

Manual validation provides flexibility when you need custom error responses or want validation to occur at specific points in the handler logic.

## System.Text.Json Configuration

ASP.NET Core uses `System.Text.Json` as the default JSON serializer for both request deserialization and response serialization. Configuring serialization behavior affects how property names map between JSON and C# objects, how enums serialize, and whether null values appear in responses.

### Common Configuration Options

Configure JSON options when adding controllers or minimal API services:

```csharp
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });
```

The `PropertyNamingPolicy` controls whether property names serialize as PascalCase, camelCase, or snake_case. The default is camelCase, matching JavaScript conventions. The `DefaultIgnoreCondition` determines whether properties with null values appear in serialized output. `WhenWritingNull` omits them, reducing payload size. The `JsonStringEnumConverter` serializes enums as strings instead of integers, improving readability.

### Custom Converters

When default serialization behavior doesn't meet your needs, custom converters provide fine-grained control. Implement `JsonConverter<T>` to define how a specific type serializes and deserializes.

```csharp
public class DateOnlyConverter : JsonConverter<DateOnly>
{
    public override DateOnly Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        return DateOnly.ParseExact(reader.GetString(), "yyyy-MM-dd");
    }

    public override void Write(Utf8JsonWriter writer, DateOnly value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(value.ToString("yyyy-MM-dd"));
    }
}
```

Register the converter when configuring JSON options:

```csharp
options.JsonSerializerOptions.Converters.Add(new DateOnlyConverter());
```

Custom converters handle scenarios like formatting dates in specific patterns, encrypting sensitive properties during serialization, or mapping between legacy JSON structures and modern C# types.

## Common Pitfalls

### Validation Runs After Model Binding

Validation executes after model binding completes. If binding fails because the request body doesn't match the expected structure, validation never runs. This distinction matters when debugging why certain validation errors don't appear.

### Custom Validators Accessing Services

Custom validation attributes can access services through `ValidationContext.GetService`, but this couples validation to the dependency injection container. If a validator queries a database, consider whether that logic belongs in the model layer or should move to a service layer instead.

### Content Negotiation and Default Behavior

ASP.NET Core defaults to JSON and ignores browser `Accept` headers unless configured otherwise. If your API supports multiple formats, test with explicit `Accept` headers to ensure formatters activate correctly.

### FluentValidation and Async Validators

Asynchronous validators in FluentValidation require careful handling. If a validator depends on a database or HTTP client, ensure the dependency is registered in the service container and the validator constructor requests it. Manual validation in minimal APIs requires calling `ValidateAsync`, not `Validate`.

## Decision Framework: Choosing Validation Approaches

| Scenario | Approach | Why |
|----------|----------|-----|
| Simple property constraints | Data annotations | Built-in, declarative, minimal code |
| Cross-property validation | IValidatableObject | Keeps validation logic in the model |
| Reusable custom rules | Custom attributes | Shareable across models |
| Complex rule composition | FluentValidation | Fluent syntax, testable, separated from DTOs |
| Async validation with I/O | FluentValidation async | Supports database queries and HTTP calls |
| Minimal APIs in .NET 10 | Built-in validation | Native support, consistent with controllers |

Choose data annotations for straightforward constraints. Move to `IValidatableObject` for multi-property validation. Use custom attributes when the same rule applies across models. Adopt FluentValidation when validation logic grows complex or requires dependency injection. In minimal APIs, leverage built-in validation in .NET 10 or integrate FluentValidation for consistency with controller-based APIs.

## Key Takeaways

Validation in ASP.NET Core operates through data annotations, custom attributes, `IValidatableObject`, and FluentValidation. Controllers with `[ApiController]` return automatic 400 responses when validation fails. Minimal APIs in .NET 10 support built-in validation when configured. FluentValidation separates validation logic into dedicated classes and supports asynchronous rules.

System.Text.Json serves as the default serializer with configurable naming policies, ignore conditions, and custom converters. Content negotiation uses `Accept` and `Content-Type` headers to select formatters. Custom input and output formatters handle non-standard content types like CSV.

File uploads use `IFormFile` for buffered scenarios and `MultipartReader` for streaming large files. Configure request size limits at the server, framework, and action levels. Streaming reduces memory consumption but requires more complex code.

Understanding these mechanisms ensures your API validates input correctly, handles multiple content types gracefully, and processes file uploads efficiently without overwhelming server resources.
