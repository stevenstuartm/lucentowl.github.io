---
title: "SOLID Principles"
layout: guide
category: Programming Patterns
subcategory: OOP Foundations
description: "Deep dive into SOLID principles: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion with practical examples."
tags: [oop, design-patterns, solid, fundamentals, maintainability, practical]
---

---

*SOLID principles introduced and popularized by Robert C. Martin ("Uncle Bob") in the early 2000s, with the acronym coined by Michael Feathers*

**Historical context**: While Martin popularized these under the SOLID acronym, the individual principles have earlier origins:
- Single Responsibility: Tom DeMarco & Meilir Page-Jones (cohesion concepts, 1970s-80s)
- Open-Closed: Bertrand Meyer (1988, "Object-Oriented Software Construction")
- Liskov Substitution: Barbara Liskov (1987, data abstraction keynote)
- Interface Segregation: Robert C. Martin (1990s)
- Dependency Inversion: Robert C. Martin (1990s)

## S - Single Responsibility Principle (SRP)

**Definition**: A class should have only one reason to change, meaning it should have only one job or responsibility.

**Intent**: Each class should focus on a single concern, making it easier to understand, test, and maintain.

<div class="callout callout--tip">
<p class="callout__title">Benefits of Single Responsibility</p>
<ul>
<li>Easier to test and maintain</li>
<li>Reduces coupling between components</li>
<li>Simplifies debugging and troubleshooting</li>
<li>Clearer code organization</li>
</ul>
</div>

**Example Violation**:
```csharp
// BAD: Multiple responsibilities
public class Employee
{
    public string Name { get; set; }
    public decimal Salary { get; set; }

    // Responsibility 1: Salary calculation
    public decimal CalculateSalary()
    {
        return Salary * 1.1m; // 10% bonus
    }

    // Responsibility 2: Report generation
    public string GeneratePayrollReport()
    {
        return $"Employee: {Name}, Salary: ${CalculateSalary():F2}";
    }

    // Responsibility 3: Data persistence
    public void SaveToDatabase()
    {
        // Database logic
        var connection = new SqlConnection("...");
        // Save employee data
    }

    // Responsibility 4: Email notifications
    public void SendPayStub()
    {
        // Email sending logic
        var emailService = new SmtpClient();
        // Send email
    }
}
```

**Better Approach**:
```csharp
// GOOD: Single responsibilities
public class Employee
{
    public string Name { get; set; }
    public decimal BaseSalary { get; set; }
    public string Email { get; set; }
}

public class SalaryCalculator
{
    public decimal Calculate(Employee employee)
    {
        return employee.BaseSalary * 1.1m;
    }
}

public class PayrollReporter
{
    private readonly SalaryCalculator calculator;

    public PayrollReporter(SalaryCalculator calculator)
    {
        this.calculator = calculator;
    }

    public string GenerateReport(Employee employee)
    {
        var salary = calculator.Calculate(employee);
        return $"Employee: {employee.Name}, Salary: ${salary:F2}";
    }
}

public class EmployeeRepository
{
    private readonly string connectionString;

    public EmployeeRepository(string connectionString)
    {
        this.connectionString = connectionString;
    }

    public void Save(Employee employee)
    {
        using var connection = new SqlConnection(connectionString);
        // Save employee data
    }
}

public class PayStubNotifier
{
    private readonly IEmailService emailService;

    public PayStubNotifier(IEmailService emailService)
    {
        this.emailService = emailService;
    }

    public async Task SendPayStub(Employee employee, string payStubContent)
    {
        await emailService.SendAsync(employee.Email, "Pay Stub", payStubContent);
    }
}
```

**When to Apply**: Ask "What is the single reason this class would change?" If there are multiple answers, refactor.

## O - Open-Closed Principle (OCP)

**Definition**: Software entities should be open for extension but closed for modification.

**Intent**: Design classes so new functionality can be added without changing existing code, reducing risk of bugs.

<div class="callout callout--tip">
<p class="callout__title">Benefits of Open-Closed Principle</p>
<ul>
<li>Add new features without changing existing code</li>
<li>Reduces risk of introducing bugs in working code</li>
<li>Promotes code reusability</li>
<li>Supports plugin architectures</li>
</ul>
</div>

**Example Violation**:
```csharp
// BAD: Must modify class to add new shapes
public class AreaCalculator
{
    public double CalculateArea(object shape)
    {
        if (shape is Circle circle)
        {
            return Math.PI * circle.Radius * circle.Radius;
        }
        else if (shape is Rectangle rectangle)
        {
            return rectangle.Width * rectangle.Height;
        }
        // Adding Triangle requires modifying this method
        else if (shape is Triangle triangle)
        {
            return 0.5 * triangle.Base * triangle.Height;
        }

        throw new ArgumentException("Unknown shape");
    }
}
```

**Better Approach**:
```csharp
// GOOD: Open for extension, closed for modification
public interface IShape
{
    double CalculateArea();
}

public class Circle : IShape
{
    public double Radius { get; set; }
    public double CalculateArea() => Math.PI * Radius * Radius;
}

public class Rectangle : IShape
{
    public double Width { get; set; }
    public double Height { get; set; }
    public double CalculateArea() => Width * Height;
}

public class Triangle : IShape
{
    public double Base { get; set; }
    public double Height { get; set; }
    public double CalculateArea() => 0.5 * Base * Height;
}

// No modification needed when adding new shapes
public class AreaCalculator
{
    public double CalculateTotalArea(IEnumerable<IShape> shapes)
    {
        return shapes.Sum(s => s.CalculateArea());
    }
}

// New shape can be added without modifying existing code
public class Hexagon : IShape
{
    public double SideLength { get; set; }
    public double CalculateArea() => (3 * Math.Sqrt(3) / 2) * Math.Pow(SideLength, 2);
}
```

**When to Apply**: Use abstractions (interfaces/base classes) when you anticipate multiple implementations or variations.

## L - Liskov Substitution Principle (LSP)

*Introduced by Barbara Liskov in her 1987 keynote "Data Abstraction and Hierarchy" at OOPSLA. Formalized with Jeannette Wing in 1994.*

**Definition**: Objects of a superclass should be replaceable with objects of a subclass without altering the correctness of the program.

**Formal definition** (Liskov & Wing): If S is a subtype of T, then objects of type T may be replaced with objects of type S without breaking the program.

**Intent**: Subtypes must be substitutable for their base types without breaking functionality.

<div class="callout callout--tip">
<p class="callout__title">Benefits of Liskov Substitution</p>
<ul>
<li>Ensures polymorphism works correctly</li>
<li>Maintains contract integrity</li>
<li>Enables reliable inheritance hierarchies</li>
<li>Prevents unexpected behavior</li>
</ul>
</div>

<div class="callout callout--warning">
<p class="callout__title">Key Rule: Subclasses Must</p>
<ul>
<li>Strengthen postconditions (can return more specific types)</li>
<li>Weaken preconditions (can accept more general parameters)</li>
<li>Preserve invariants (maintain class constraints)</li>
<li>Not throw new exceptions on base methods</li>
</ul>
</div>

**Example Violation**:
```csharp
// BAD: Violates LSP
public class Bird
{
    public virtual void Fly()
    {
        Console.WriteLine("Flying high!");
    }
}

public class Sparrow : Bird
{
    public override void Fly()
    {
        Console.WriteLine("Sparrow flies!");
    }
}

public class Penguin : Bird
{
    public override void Fly()
    {
        // Penguins can't fly - violates LSP!
        throw new NotSupportedException("Penguins can't fly!");
    }
}

// This breaks when using Penguin
public void MakeBirdFly(Bird bird)
{
    bird.Fly(); // Will throw exception for Penguin!
}
```

**Better Approach**:
```csharp
// GOOD: Follows LSP
public abstract class Bird
{
    public abstract void Move();
}

public interface IFlyable
{
    void Fly();
}

public class Sparrow : Bird, IFlyable
{
    public override void Move()
    {
        Fly();
    }

    public void Fly()
    {
        Console.WriteLine("Sparrow flies!");
    }
}

public class Penguin : Bird
{
    public override void Move()
    {
        Swim();
    }

    public void Swim()
    {
        Console.WriteLine("Penguin swims!");
    }
}

// Works correctly with all birds
public void MakeBirdMove(Bird bird)
{
    bird.Move(); // Works for all bird types
}

// Only works with flyable birds
public void MakeFlyableFly(IFlyable flyable)
{
    flyable.Fly(); // Only accepts birds that can fly
}
```

**When to Apply**: Ensure derived classes can truly replace base classes without breaking client code.

## I - Interface Segregation Principle (ISP)

**Definition**: Clients should not be forced to depend on interfaces they don't use.

**Intent**: Create small, focused interfaces rather than large, monolithic ones.

<div class="callout callout--tip">
<p class="callout__title">Benefits of Interface Segregation</p>
<ul>
<li>Reduces coupling between components</li>
<li>Avoids unnecessary dependencies</li>
<li>Enables more targeted implementations</li>
<li>Improves code clarity</li>
</ul>
</div>

**Example Violation**:
```csharp
// BAD: Fat interface forces implementations to support all methods
public interface IWorker
{
    void Work();
    void Eat();
    void Sleep();
    void GetPaid();
}

public class HumanWorker : IWorker
{
    public void Work() { Console.WriteLine("Working..."); }
    public void Eat() { Console.WriteLine("Eating lunch..."); }
    public void Sleep() { Console.WriteLine("Sleeping..."); }
    public void GetPaid() { Console.WriteLine("Getting paid!"); }
}

public class RobotWorker : IWorker
{
    public void Work() { Console.WriteLine("Working..."); }

    // Forced to implement methods that don't make sense for robots
    public void Eat() { throw new NotSupportedException(); }
    public void Sleep() { throw new NotSupportedException(); }
    public void GetPaid() { throw new NotSupportedException(); }
}
```

**Better Approach**:
```csharp
// GOOD: Segregated interfaces
public interface IWorkable
{
    void Work();
}

public interface IEatable
{
    void Eat();
}

public interface ISleepable
{
    void Sleep();
}

public interface IPayable
{
    void GetPaid();
}

public class HumanWorker : IWorkable, IEatable, ISleepable, IPayable
{
    public void Work() { Console.WriteLine("Working..."); }
    public void Eat() { Console.WriteLine("Eating lunch..."); }
    public void Sleep() { Console.WriteLine("Sleeping..."); }
    public void GetPaid() { Console.WriteLine("Getting paid!"); }
}

public class RobotWorker : IWorkable
{
    public void Work() { Console.WriteLine("Working tirelessly..."); }
    // Only implements what makes sense
}

// Clients depend only on what they need
public class WorkManager
{
    public void ManageWork(IWorkable worker)
    {
        worker.Work(); // Only requires IWorkable
    }
}

public class PayrollManager
{
    public void ProcessPayroll(IPayable employee)
    {
        employee.GetPaid(); // Only requires IPayable
    }
}
```

**When to Apply**: When interfaces become large, split them into smaller, focused interfaces based on client needs.

## D - Dependency Inversion Principle (DIP)

**Definition**: High-level modules should not depend on low-level modules. Both should depend on abstractions. Abstractions should not depend on details. Details should depend on abstractions.

**Intent**: Decouple high-level business logic from low-level implementation details.

<div class="callout callout--tip">
<p class="callout__title">Benefits of Dependency Inversion</p>
<ul>
<li>Improves testability through dependency injection</li>
<li>Reduces coupling between layers</li>
<li>Enables flexible architecture</li>
<li>Supports multiple implementations</li>
</ul>
</div>

**Example Violation**:
```csharp
// BAD: High-level class depends on low-level implementation
public class EmailNotification
{
    public void Send(string to, string message)
    {
        // Concrete SMTP implementation
        var smtpClient = new SmtpClient("smtp.gmail.com");
        smtpClient.Send(to, message);
    }
}

public class OrderService
{
    // Tightly coupled to EmailNotification
    private readonly EmailNotification emailNotification = new EmailNotification();

    public void PlaceOrder(Order order)
    {
        // Process order...
        emailNotification.Send(order.CustomerEmail, "Order placed!");
    }
}
```

**Better Approach**:
```csharp
// GOOD: Both depend on abstraction
public interface INotificationService
{
    Task SendAsync(string recipient, string message);
}

// Low-level implementation
public class EmailNotificationService : INotificationService
{
    private readonly string smtpServer;

    public EmailNotificationService(string smtpServer)
    {
        this.smtpServer = smtpServer;
    }

    public async Task SendAsync(string recipient, string message)
    {
        var smtpClient = new SmtpClient(smtpServer);
        await smtpClient.SendMailAsync(recipient, message);
    }
}

// Alternative implementation
public class SmsNotificationService : INotificationService
{
    private readonly string apiKey;

    public SmsNotificationService(string apiKey)
    {
        this.apiKey = apiKey;
    }

    public async Task SendAsync(string recipient, string message)
    {
        var smsClient = new TwilioClient(apiKey);
        await smsClient.SendSmsAsync(recipient, message);
    }
}

// High-level module depends on abstraction
public class OrderService
{
    private readonly INotificationService notificationService;

    // Dependency injected through constructor
    public OrderService(INotificationService notificationService)
    {
        this.notificationService = notificationService;
    }

    public async Task PlaceOrder(Order order)
    {
        // Process order...
        await notificationService.SendAsync(order.CustomerEmail, "Order placed!");
    }
}

// Configuration
var emailService = new EmailNotificationService("smtp.gmail.com");
var orderService = new OrderService(emailService);

// Easy to swap implementations
var smsService = new SmsNotificationService("twilio-api-key");
var orderServiceWithSms = new OrderService(smsService);
```

**When to Apply**: Always depend on abstractions when working across architectural boundaries (layers, services, components).

## Quick Reference

### SOLID Principles Comparison

| Principle | Focus | Key Question |
|-----------|-------|--------------|
| **SRP** | Class cohesion | "Does this class have one reason to change?" |
| **OCP** | Extension mechanism | "Can I add features without modifying existing code?" |
| **LSP** | Inheritance contracts | "Can I substitute derived classes for base classes?" |
| **ISP** | Interface granularity | "Does this interface force unnecessary dependencies?" |
| **DIP** | Dependency direction | "Am I depending on abstractions or implementations?" |

### Common Violations and Fixes

| Violation | Sign | Fix |
|-----------|------|-----|
| **SRP** | "And" in class names, many imports | Extract classes for each responsibility |
| **OCP** | Long if/switch statements on type | Use polymorphism via interfaces |
| **LSP** | Throwing exceptions in overrides | Redesign hierarchy or use composition |
| **ISP** | NotImplementedException in interface methods | Split into smaller interfaces |
| **DIP** | New keyword everywhere, hard to test | Use dependency injection |

### SOLID in Modern Development

**ASP.NET Core**:
- **SRP**: Controllers handle HTTP, services handle business logic
- **OCP**: Middleware pipeline extends via new middleware
- **LSP**: Custom implementations replace defaults seamlessly
- **ISP**: Small interfaces like IHostedService, IHealthCheck
- **DIP**: Built-in dependency injection container

**Testing Benefits**:
- **SRP**: Test one thing at a time
- **OCP**: Test new features independently
- **LSP**: Test base types, trust derived types
- **ISP**: Mock only what's needed
- **DIP**: Inject test doubles easily

---
