---
title: "Modern Best Practices"
layout: guide
category: Programming Patterns
subcategory: OOP Foundations
description: "Modern OOP practices including composition over inheritance, dependency injection, immutability, functional programming concepts, and avoiding common antipatterns."
tags: [oop, best-practices, practical, maintainability, modern]
---

---

## Composition Over Inheritance

**Definition**: Favor object composition over class inheritance to achieve code reuse and flexibility.

<div class="callout callout--note">
<p class="callout__title">Why This Matters</p>
<ul>
<li>Inheritance creates tight coupling between parent and child classes</li>
<li>Deep inheritance hierarchies become fragile and hard to maintain</li>
<li>Composition provides better flexibility and testability</li>
<li>Avoids the "fragile base class" problem</li>
</ul>
</div>

**Inheritance Problems**:
```csharp
// BAD: Rigid inheritance hierarchy
public class Animal
{
    public virtual void Move() => Console.WriteLine("Moving");
    public virtual void MakeSound() => Console.WriteLine("Some sound");
}

public class Dog : Animal
{
    public override void MakeSound() => Console.WriteLine("Bark!");
}

public class RobotDog : Dog  // Robot dog inherits ALL dog behavior
{
    // Problem: Inherits MakeSound, but robots don't breathe
    // Stuck with unwanted Animal behaviors
}
```

**Composition Solution**:
```csharp
// GOOD: Flexible composition
public interface IMovable
{
    void Move();
}

public interface ISoundMaker
{
    void MakeSound();
}

public class WalkingMovement : IMovable
{
    public void Move() => Console.WriteLine("Walking on legs");
}

public class WheelMovement : IMovable
{
    public void Move() => Console.WriteLine("Rolling on wheels");
}

public class BarkSound : ISoundMaker
{
    public void MakeSound() => Console.WriteLine("Bark!");
}

public class RobotSound : ISoundMaker
{
    public void MakeSound() => Console.WriteLine("Beep boop!");
}

// Compose behaviors as needed
public class Dog
{
    private readonly IMovable movement;
    private readonly ISoundMaker soundMaker;

    public Dog(IMovable movement, ISoundMaker soundMaker)
    {
        this.movement = movement;
        this.soundMaker = soundMaker;
    }

    public void Move() => movement.Move();
    public void MakeSound() => soundMaker.MakeSound();
}

// Easy to create different combinations
var regularDog = new Dog(new WalkingMovement(), new BarkSound());
var robotDog = new Dog(new WheelMovement(), new RobotSound());
```

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Use Inheritance When</h4>
<ul>
<li>True "is-a" relationships</li>
<li>Shallow hierarchies (1-2 levels)</li>
<li>Base class provides core functionality</li>
<li>Derived classes are true specializations</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Use Composition When</h4>
<ul>
<li>"Has-a" or "uses-a" relationships</li>
<li>Behavior combinations needed</li>
<li>Runtime flexibility required</li>
<li>Multiple behaviors to mix and match</li>
</ul>
</div>
</div>

## Dependency Injection

**Definition**: Provide dependencies from outside rather than creating them internally, enabling loose coupling and testability.

### Constructor Injection

**Purpose**: Inject required dependencies that the class cannot function without.

```csharp
public class OrderService
{
    private readonly IOrderRepository orderRepository;
    private readonly IPaymentProcessor paymentProcessor;
    private readonly IEmailService emailService;

    // Dependencies required for class to function
    public OrderService(
        IOrderRepository orderRepository,
        IPaymentProcessor paymentProcessor,
        IEmailService emailService)
    {
        this.orderRepository = orderRepository ?? throw new ArgumentNullException(nameof(orderRepository));
        this.paymentProcessor = paymentProcessor ?? throw new ArgumentNullException(nameof(paymentProcessor));
        this.emailService = emailService ?? throw new ArgumentNullException(nameof(emailService));
    }

    public async Task<Result> ProcessOrder(Order order)
    {
        await orderRepository.Save(order);
        var paymentResult = await paymentProcessor.Process(order.Total);

        if (paymentResult.Success)
        {
            await emailService.SendConfirmation(order.CustomerEmail);
        }

        return paymentResult;
    }
}
```

### Property Injection

**Purpose**: Inject optional dependencies or provide defaults.

```csharp
public class ReportGenerator
{
    private ILogger logger;

    // Optional dependency with default
    public ILogger Logger
    {
        get => logger ?? NullLogger.Instance;
        set => logger = value;
    }

    public string GenerateReport(ReportData data)
    {
        Logger.Log("Starting report generation");

        var report = CreateReport(data);

        Logger.Log("Report generation completed");
        return report;
    }
}
```

### Method Injection

**Purpose**: Inject dependencies needed only for specific operations.

```csharp
public class DocumentProcessor
{
    public void Process(Document document, IValidator validator, IFormatter formatter)
    {
        // Dependencies specific to this operation
        if (validator.Validate(document))
        {
            var formatted = formatter.Format(document);
            Save(formatted);
        }
    }
}
```

### Dependency Injection Benefits

```csharp
// Testability Example
public class OrderServiceTests
{
    [Fact]
    public async Task ProcessOrder_ShouldSendEmail_WhenPaymentSucceeds()
    {
        // Arrange - Easy to inject test doubles
        var mockRepository = new Mock<IOrderRepository>();
        var mockPaymentProcessor = new Mock<IPaymentProcessor>();
        mockPaymentProcessor.Setup(p => p.Process(It.IsAny<decimal>()))
            .ReturnsAsync(new Result { Success = true });

        var mockEmailService = new Mock<IEmailService>();

        var service = new OrderService(
            mockRepository.Object,
            mockPaymentProcessor.Object,
            mockEmailService.Object);

        var order = new Order { Total = 100m, CustomerEmail = "test@example.com" };

        // Act
        await service.ProcessOrder(order);

        // Assert - Verify email was sent
        mockEmailService.Verify(e =>
            e.SendConfirmation("test@example.com"), Times.Once);
    }
}
```

## Clean Code Principles

### KISS (Keep It Simple, Stupid)

**Definition**: Choose simple solutions over complex ones. Avoid over-engineering.

```csharp
// BAD: Over-engineered
public class ComplexCalculator
{
    private readonly ICalculationStrategy strategy;
    private readonly ICalculationFactory factory;
    private readonly ICalculationValidator validator;

    public int Add(int a, int b)
    {
        var operation = factory.CreateOperation(OperationType.Addition);
        var context = new CalculationContext(a, b);
        var validation = validator.Validate(context);

        if (!validation.IsValid)
            throw new InvalidOperationException();

        return strategy.Execute(operation, context);
    }
}

// GOOD: Simple and clear
public class SimpleCalculator
{
    public int Add(int a, int b) => a + b;
}
```

<div class="comparison">
<div class="content-card content-card--accent">
<h4>When Simple is Better</h4>
<ul>
<li>Straightforward business logic</li>
<li>One-time use code</li>
<li>Internal utilities</li>
<li>Prototypes and MVPs</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>When Complexity is Justified</h4>
<ul>
<li>Anticipating multiple variations</li>
<li>Complex business rules</li>
<li>Framework/library code</li>
<li>High reuse scenarios</li>
</ul>
</div>
</div>

### YAGNI (You Aren't Gonna Need It)

**Definition**: Don't implement features before they're needed. Focus on current requirements.

```csharp
// BAD: Speculative generality
public class UserService
{
    // Implementing features "just in case"
    public Task<User> GetUser(int id) { /* ... */ }
    public Task<User> GetUserByEmail(string email) { /* Not needed yet */ }
    public Task<User> GetUserByPhone(string phone) { /* Not needed yet */ }
    public Task<User> GetUserByExternalId(string id) { /* Not needed yet */ }
    public Task<List<User>> SearchUsers(UserSearchCriteria criteria) { /* Not needed yet */ }
}

// GOOD: Implement only what's needed now
public class UserService
{
    // Only implement what current requirements demand
    public Task<User> GetUser(int id) { /* ... */ }

    // Add other methods when actually needed
}
```

<div class="callout callout--tip">
<p class="callout__title">Benefits of YAGNI</p>
<ul>
<li>Less code to maintain</li>
<li>Faster initial development</li>
<li>Easier to understand</li>
<li>Avoid wrong assumptions about future needs</li>
</ul>
</div>

### DRY (Don't Repeat Yourself)

**Definition**: Eliminate code duplication through abstraction. Each piece of knowledge should have a single, authoritative representation.

```csharp
// BAD: Repetitive code
public class OrderController
{
    public IActionResult CreateOrder(CreateOrderRequest request)
    {
        if (string.IsNullOrEmpty(request.CustomerName))
            return BadRequest("Customer name is required");
        if (request.Total <= 0)
            return BadRequest("Total must be positive");
        if (string.IsNullOrEmpty(request.Email))
            return BadRequest("Email is required");

        // Process order
    }

    public IActionResult UpdateOrder(UpdateOrderRequest request)
    {
        if (string.IsNullOrEmpty(request.CustomerName))
            return BadRequest("Customer name is required");
        if (request.Total <= 0)
            return BadRequest("Total must be positive");
        if (string.IsNullOrEmpty(request.Email))
            return BadRequest("Email is required");

        // Update order
    }
}

// GOOD: Extract common logic
public class OrderController
{
    private IActionResult ValidateOrder(string customerName, decimal total, string email)
    {
        if (string.IsNullOrEmpty(customerName))
            return BadRequest("Customer name is required");
        if (total <= 0)
            return BadRequest("Total must be positive");
        if (string.IsNullOrEmpty(email))
            return BadRequest("Email is required");

        return null; // Valid
    }

    public IActionResult CreateOrder(CreateOrderRequest request)
    {
        var validationError = ValidateOrder(request.CustomerName, request.Total, request.Email);
        if (validationError != null)
            return validationError;

        // Process order
    }

    public IActionResult UpdateOrder(UpdateOrderRequest request)
    {
        var validationError = ValidateOrder(request.CustomerName, request.Total, request.Email);
        if (validationError != null)
            return validationError;

        // Update order
    }
}
```

**Balance DRY with SRP**:
```csharp
// BETTER: Separate validation responsibility
public class OrderValidator
{
    public ValidationResult Validate(OrderData data)
    {
        var errors = new List<string>();

        if (string.IsNullOrEmpty(data.CustomerName))
            errors.Add("Customer name is required");
        if (data.Total <= 0)
            errors.Add("Total must be positive");
        if (string.IsNullOrEmpty(data.Email))
            errors.Add("Email is required");

        return new ValidationResult(errors);
    }
}

public class OrderController
{
    private readonly OrderValidator validator;

    public OrderController(OrderValidator validator)
    {
        this.validator = validator;
    }

    public IActionResult CreateOrder(CreateOrderRequest request)
    {
        var validation = validator.Validate(request);
        if (!validation.IsValid)
            return BadRequest(validation.Errors);

        // Process order
    }
}
```

## Testing Considerations

### Design for Testability

**SOLID Principles Improve Testing**:
```csharp
// Hard to test - tight coupling
public class OrderProcessor
{
    public void Process(Order order)
    {
        var repository = new OrderRepository(); // Cannot mock
        var emailService = new SmtpEmailService(); // Cannot test without SMTP

        repository.Save(order);
        emailService.Send(order.CustomerEmail, "Order received");
    }
}

// Easy to test - dependency injection
public class OrderProcessor
{
    private readonly IOrderRepository repository;
    private readonly IEmailService emailService;

    public OrderProcessor(IOrderRepository repository, IEmailService emailService)
    {
        this.repository = repository;
        this.emailService = emailService;
    }

    public void Process(Order order)
    {
        repository.Save(order);
        emailService.Send(order.CustomerEmail, "Order received");
    }
}
```

### Testable Code Characteristics

**1. Single Responsibility**: Easy to test one thing at a time
```csharp
// One test per class responsibility
[Fact]
public void CalculateTotalPrice_ShouldSumItemPrices()
{
    var calculator = new PriceCalculator();
    var items = new[] { new Item { Price = 10 }, new Item { Price = 20 } };

    var total = calculator.CalculateTotalPrice(items);

    Assert.Equal(30, total);
}
```

**2. Dependency Injection**: Mock external dependencies
```csharp
[Fact]
public void ProcessOrder_ShouldCallRepository()
{
    var mockRepo = new Mock<IOrderRepository>();
    var service = new OrderService(mockRepo.Object);

    service.ProcessOrder(new Order());

    mockRepo.Verify(r => r.Save(It.IsAny<Order>()), Times.Once);
}
```

**3. No Hidden Dependencies**: All dependencies explicit
```csharp
// BAD: Hidden dependency on DateTime.Now
public class OrderService
{
    public void CreateOrder(Order order)
    {
        order.CreatedAt = DateTime.Now; // Hard to test specific times
    }
}

// GOOD: Inject time provider
public class OrderService
{
    private readonly ITimeProvider timeProvider;

    public OrderService(ITimeProvider timeProvider)
    {
        this.timeProvider = timeProvider;
    }

    public void CreateOrder(Order order)
    {
        order.CreatedAt = timeProvider.Now; // Easy to test with mock
    }
}
```

## Quick Reference

### Best Practice Decision Matrix

| Scenario | Best Practice | Why |
|----------|---------------|-----|
| Need behavior reuse | Composition | More flexible than inheritance |
| Need different implementations | Dependency Injection | Enables loose coupling |
| Simple calculation | KISS | Avoid unnecessary complexity |
| Feature not yet needed | YAGNI | Don't build what you don't need |
| Repeated validation logic | DRY | Single source of truth |
| Testing complex logic | SOLID + DI | Enables mocking and isolation |

### Common Pitfalls

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| **God Object** | Class does too much | Apply SRP, split responsibilities |
| **Premature Optimization** | Complex code "for performance" | KISS: optimize when needed |
| **Shotgun Surgery** | Changes require editing many files | DRY: centralize logic |
| **Tight Coupling** | Hard to test and change | DI: depend on abstractions |
| **Gold Plating** | Over-engineering features | YAGNI: build what's needed |

### Modern Framework Integration

**ASP.NET Core**:
- Built-in dependency injection container
- Middleware pattern (composition)
- Options pattern (configuration)
- Minimal APIs (KISS)

**Entity Framework**:
- Repository pattern (abstraction)
- Unit of Work pattern (transaction management)
- Lazy loading (proxy pattern)
- DbContext lifetime management (DI)

**Testing Tools**:
- xUnit / NUnit / MSTest (test frameworks)
- Moq / NSubstitute (mocking)
- FluentAssertions (readable assertions)
- AutoFixture (test data generation)

---
