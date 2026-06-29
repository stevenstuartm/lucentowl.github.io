---
title: "Behavioral Patterns"
layout: guide
category: Programming Patterns
subcategory: GoF Patterns
description: "Behavioral design patterns for object communication including Observer, Strategy, Command, Template Method, Chain of Responsibility, and State patterns."
tags: [oop, design-patterns, behavioral-patterns, strategy, observer, practical]
---

---

*Behavioral patterns from the Gang of Four's "Design Patterns" (1994). Observer pattern predates GoF, originating in Smalltalk's Model-View-Controller (MVC) architecture (1979).*

## Observer Pattern

**Intent**: Define one-to-many dependency so state changes are automatically communicated to dependents.

**Problem Solved**: Maintaining consistency between related objects without tight coupling.

**Modern C# Implementation**:
```csharp
// Using built-in events
public class NewsAgency
{
    public event Action<string> NewsPublished;

    private string news;
    public string News
    {
        get => news;
        set
        {
            news = value;
            NewsPublished?.Invoke(news);
        }
    }
}

// Subscribers
public class NewsChannel
{
    private readonly string name;

    public NewsChannel(string name, NewsAgency agency)
    {
        this.name = name;
        agency.NewsPublished += HandleNews;
    }

    private void HandleNews(string news)
    {
        Console.WriteLine($"{name} received: {news}");
    }
}

// Usage
var agency = new NewsAgency();
var cnn = new NewsChannel("CNN", agency);
var bbc = new NewsChannel("BBC", agency);

agency.News = "Breaking news!";
```

<div class="callout callout--tip">
<p class="callout__title">When to Use</p>
<p>Event-driven systems, pub/sub architectures, MVC/MVVM data binding.</p>
</div>

<div class="callout callout--warning">
<p class="callout__title">When to Avoid</p>
<p>Simple callbacks suffice, one-to-one relationships.</p>
</div>

## Strategy Pattern

**Intent**: Define family of algorithms, make them interchangeable at runtime.

**Problem Solved**: Eliminating conditional logic for selecting algorithms.

**Example**:
```csharp
public interface ICompressionStrategy
{
    byte[] Compress(byte[] data);
}

public class GzipCompression : ICompressionStrategy
{
    public byte[] Compress(byte[] data)
    {
        using var output = new MemoryStream();
        using (var gzip = new GZipStream(output, CompressionMode.Compress))
        {
            gzip.Write(data, 0, data.Length);
        }
        return output.ToArray();
    }
}

public class ZipCompression : ICompressionStrategy
{
    public byte[] Compress(byte[] data)
    {
        // ZIP implementation
        return data; // Simplified
    }
}

public class FileCompressor
{
    private ICompressionStrategy strategy;

    public void SetStrategy(ICompressionStrategy strategy)
    {
        this.strategy = strategy;
    }

    public byte[] CompressFile(byte[] data)
    {
        return strategy.Compress(data);
    }
}

// Usage
var compressor = new FileCompressor();
compressor.SetStrategy(new GzipCompression());
var compressed = compressor.CompressFile(data);
```

<div class="callout callout--tip">
<p class="callout__title">When to Use</p>
<p>Multiple algorithms for same task, runtime selection needed.</p>
</div>

<div class="callout callout--warning">
<p class="callout__title">When to Avoid</p>
<p>Single algorithm, no variation needed.</p>
</div>

## Command Pattern

**Intent**: Encapsulate requests as objects to support undo/redo, queuing, and logging.

**Problem Solved**: Decoupling request sender from receiver, enabling operation history.

**Example**:
```csharp
public interface ICommand
{
    void Execute();
    void Undo();
}

public class TransferMoneyCommand : ICommand
{
    private readonly BankAccount from;
    private readonly BankAccount to;
    private readonly decimal amount;
    private bool executed = false;

    public TransferMoneyCommand(BankAccount from, BankAccount to, decimal amount)
    {
        this.from = from;
        this.to = to;
        this.amount = amount;
    }

    public void Execute()
    {
        from.Withdraw(amount);
        to.Deposit(amount);
        executed = true;
    }

    public void Undo()
    {
        if (executed)
        {
            to.Withdraw(amount);
            from.Deposit(amount);
            executed = false;
        }
    }
}

// Command invoker with undo/redo
public class CommandManager
{
    private readonly Stack<ICommand> undoStack = new();
    private readonly Stack<ICommand> redoStack = new();

    public void Execute(ICommand command)
    {
        command.Execute();
        undoStack.Push(command);
        redoStack.Clear();
    }

    public void Undo()
    {
        if (undoStack.Count > 0)
        {
            var command = undoStack.Pop();
            command.Undo();
            redoStack.Push(command);
        }
    }

    public void Redo()
    {
        if (redoStack.Count > 0)
        {
            var command = redoStack.Pop();
            command.Execute();
            undoStack.Push(command);
        }
    }
}
```

<div class="callout callout--tip">
<p class="callout__title">When to Use</p>
<p>Undo/redo functionality, operation queuing, macro recording.</p>
</div>

<div class="callout callout--warning">
<p class="callout__title">When to Avoid</p>
<p>Simple method calls suffice.</p>
</div>

## State Pattern

**Intent**: Allow object to alter behavior when internal state changes.

**Problem Solved**: Eliminating complex state-based conditionals.

**Modern Switch Expression**:
```csharp
public enum OrderState { Pending, Confirmed, Shipped, Delivered, Cancelled }
public enum OrderAction { Confirm, Ship, Deliver, Cancel }

public class Order
{
    public OrderState State { get; private set; } = OrderState.Pending;

    public void ProcessAction(OrderAction action)
    {
        var previousState = State;

        State = (State, action) switch
        {
            (OrderState.Pending, OrderAction.Confirm) => OrderState.Confirmed,
            (OrderState.Pending, OrderAction.Cancel) => OrderState.Cancelled,
            (OrderState.Confirmed, OrderAction.Ship) => OrderState.Shipped,
            (OrderState.Confirmed, OrderAction.Cancel) => OrderState.Cancelled,
            (OrderState.Shipped, OrderAction.Deliver) => OrderState.Delivered,
            _ => State // Invalid transition - maintain state
        };

        if (previousState != State)
        {
            Console.WriteLine($"Order state: {previousState} -> {State}");
        }
    }
}
```

<div class="callout callout--tip">
<p class="callout__title">When to Use</p>
<p>Complex state-dependent behavior, state machines.</p>
</div>

<div class="callout callout--warning">
<p class="callout__title">When to Avoid</p>
<p>Simple if/switch statements suffice.</p>
</div>

## Chain of Responsibility Pattern

**Intent**: Pass request along chain of handlers until one processes it.

**Problem Solved**: Decoupling sender from receiver, dynamic handler composition.

**Example**:
```csharp
public abstract class Handler<T>
{
    protected Handler<T> next;

    public Handler<T> SetNext(Handler<T> handler)
    {
        next = handler;
        return handler;
    }

    public virtual T Handle(T request)
    {
        return next?.Handle(request) ?? request;
    }
}

public class ValidationHandler : Handler<HttpRequest>
{
    public override HttpRequest Handle(HttpRequest request)
    {
        if (string.IsNullOrEmpty(request.Body))
        {
            request.AddError("Body is required");
            return request;
        }

        return base.Handle(request);
    }
}

public class AuthenticationHandler : Handler<HttpRequest>
{
    public override HttpRequest Handle(HttpRequest request)
    {
        if (!request.Headers.ContainsKey("Authorization"))
        {
            request.AddError("Unauthorized");
            return request;
        }

        return base.Handle(request);
    }
}

public class LoggingHandler : Handler<HttpRequest>
{
    public override HttpRequest Handle(HttpRequest request)
    {
        Console.WriteLine($"Processing request: {request.Path}");
        return base.Handle(request);
    }
}

// Usage - ASP.NET Core middleware is a real-world example
var chain = new LoggingHandler();
chain.SetNext(new AuthenticationHandler())
     .SetNext(new ValidationHandler());

var result = chain.Handle(request);
```

<div class="callout callout--tip">
<p class="callout__title">When to Use</p>
<p>Multiple handlers, handler order matters, middleware pipelines.</p>
</div>

<div class="callout callout--warning">
<p class="callout__title">When to Avoid</p>
<p>Single handler, static handler selection.</p>
</div>

## Template Method Pattern

**Intent**: Define algorithm skeleton, let subclasses override specific steps.

**Problem Solved**: Code reuse while allowing variation in algorithm steps.

**Example**:
```csharp
public abstract class DataProcessor
{
    // Template method
    public void Process()
    {
        var data = ReadData();
        var processed = TransformData(data);
        ValidateData(processed);
        SaveData(processed);
    }

    protected abstract string ReadData();
    protected abstract string TransformData(string data);
    protected abstract void SaveData(string data);

    // Hook method with default implementation
    protected virtual void ValidateData(string data)
    {
        if (string.IsNullOrEmpty(data))
            throw new InvalidDataException("Data cannot be empty");
    }
}

public class CsvDataProcessor : DataProcessor
{
    protected override string ReadData() => File.ReadAllText("data.csv");

    protected override string TransformData(string data)
    {
        // CSV-specific transformation
        return data.ToUpper();
    }

    protected override void SaveData(string data)
    {
        File.WriteAllText("output.csv", data);
    }
}

public class JsonDataProcessor : DataProcessor
{
    protected override string ReadData() => File.ReadAllText("data.json");

    protected override string TransformData(string data)
    {
        // JSON-specific transformation
        return JsonSerializer.Serialize(JsonSerializer.Deserialize<object>(data));
    }

    protected override void SaveData(string data)
    {
        File.WriteAllText("output.json", data);
    }
}
```

**When to Use**: Common algorithm structure with varying steps.
**When to Avoid**: No variation in steps, composition is more flexible.

## Mediator Pattern

**Intent**: Centralize complex communications between objects.

**Problem Solved**: Reducing many-to-many relationships to many-to-one.

**Example**:
```csharp
public interface IChatMediator
{
    void SendMessage(string message, User sender);
    void AddUser(User user);
}

public class ChatRoom : IChatMediator
{
    private readonly List<User> users = new();

    public void AddUser(User user)
    {
        users.Add(user);
        user.SetMediator(this);
    }

    public void SendMessage(string message, User sender)
    {
        foreach (var user in users.Where(u => u != sender))
        {
            user.ReceiveMessage(message, sender.Name);
        }
    }
}

public class User
{
    public string Name { get; }
    private IChatMediator mediator;

    public User(string name)
    {
        Name = name;
    }

    public void SetMediator(IChatMediator mediator)
    {
        this.mediator = mediator;
    }

    public void Send(string message)
    {
        Console.WriteLine($"{Name} sends: {message}");
        mediator.SendMessage(message, this);
    }

    public void ReceiveMessage(string message, string senderName)
    {
        Console.WriteLine($"{Name} receives from {senderName}: {message}");
    }
}

// Usage
var chatRoom = new ChatRoom();
var john = new User("John");
var jane = new User("Jane");

chatRoom.AddUser(john);
chatRoom.AddUser(jane);

john.Send("Hello!");
```

**When to Use**: Many-to-many object relationships, MediatR library for CQRS.
**When to Avoid**: Simple one-to-one or one-to-many relationships.

## Memento Pattern

**Intent**: Capture and restore object state without violating encapsulation.

**Problem Solved**: Implementing undo/redo while keeping internal state private.

**Example**:
```csharp
// Memento
public class EditorMemento
{
    public string Content { get; }
    public int CursorPosition { get; }

    internal EditorMemento(string content, int cursorPosition)
    {
        Content = content;
        CursorPosition = cursorPosition;
    }
}

// Originator
public class TextEditor
{
    public string Content { get; private set; } = "";
    public int CursorPosition { get; private set; } = 0;

    public void Write(string text)
    {
        Content = Content.Insert(CursorPosition, text);
        CursorPosition += text.Length;
    }

    public EditorMemento Save() => new(Content, CursorPosition);

    public void Restore(EditorMemento memento)
    {
        Content = memento.Content;
        CursorPosition = memento.CursorPosition;
    }
}

// Caretaker
public class EditorHistory
{
    private readonly Stack<EditorMemento> history = new();

    public void Save(EditorMemento memento) => history.Push(memento);

    public EditorMemento Undo()
    {
        return history.Count > 1 ? history.Pop() : null;
    }
}
```

**When to Use**: Undo/redo functionality, snapshots, transaction rollback.
**When to Avoid**: State is simple enough to store directly.

## Visitor Pattern

**Intent**: Add operations to object hierarchies without modifying them.

**Problem Solved**: Adding new operations without changing existing classes.

**Modern Pattern Matching (Preferred)**:
```csharp
public abstract record Expression;
public record Number(double Value) : Expression;
public record Addition(Expression Left, Expression Right) : Expression;
public record Multiplication(Expression Left, Expression Right) : Expression;

public static class ExpressionExtensions
{
    public static string Print(this Expression expr) => expr switch
    {
        Number n => n.Value.ToString(),
        Addition a => $"({a.Left.Print()} + {a.Right.Print()})",
        Multiplication m => $"({m.Left.Print()} * {m.Right.Print()})",
        _ => throw new ArgumentException("Unknown expression")
    };

    public static double Evaluate(this Expression expr) => expr switch
    {
        Number n => n.Value,
        Addition a => a.Left.Evaluate() + a.Right.Evaluate(),
        Multiplication m => m.Left.Evaluate() * m.Right.Evaluate(),
        _ => throw new ArgumentException("Unknown expression")
    };
}

// Usage
var expr = new Addition(new Number(2), new Multiplication(new Number(3), new Number(4)));
Console.WriteLine(expr.Print());     // (2 + (3 * 4))
Console.WriteLine(expr.Evaluate());  // 14
```

**When to Use**: Operations on complex object structures, expression trees.
**When to Avoid**: Simple structures; use pattern matching instead.

## Quick Reference

### Behavioral Pattern Comparison

| Pattern | Intent | Problem Solved | When to Use | When to Avoid |
|---------|--------|----------------|-------------|---------------|
| **Observer** | Notify dependents of state changes | Maintaining consistency between objects | Event systems, data binding, pub/sub | Simple callbacks work |
| **Strategy** | Interchangeable algorithms | Eliminating algorithm conditionals | Runtime algorithm selection | Single algorithm |
| **Command** | Encapsulate requests as objects | Undo/redo, operation queuing | Macro recording, transaction systems | Simple method calls |
| **State** | Behavior changes with state | Complex state conditionals | State machines, workflow | Simple if/switch suffices |
| **Chain of Responsibility** | Pass request along handler chain | Decoupling sender from receiver | Middleware pipelines, request processing | Single handler |
| **Template Method** | Algorithm skeleton in base class | Code reuse with variation | Common workflow with varying steps | No variation needed |
| **Mediator** | Centralize object communications | Many-to-many complexity | Chat systems, CQRS (MediatR) | Simple relationships |
| **Memento** | Capture/restore state | Undo/redo while maintaining encapsulation | Snapshots, transaction rollback | Simple state storage |
| **Visitor** | Add operations to hierarchies | Adding operations without modification | Expression trees, AST processing | Pattern matching is simpler |
| **Iterator** | Sequential access to elements | Collection traversal | Custom iteration logic | `foreach` works |
| **Interpreter** | Define language grammar | Domain-specific languages | Simple DSLs | Complex grammars (use parser) |

### Pattern Selection Guide

**Choose Observer when:**
- One-to-many dependencies
- Automatic notification of changes
- Example: Event-driven architectures, MVVM data binding

**Choose Strategy when:**
- Multiple algorithms for same operation
- Algorithm varies at runtime
- Example: Payment processing (credit card, PayPal, crypto)

**Choose Command when:**
- Need to parameterize operations
- Queue, log, or undo operations
- Example: Text editor operations, transaction systems

**Choose State when:**
- Behavior depends on complex state
- Many state transitions
- Example: Order lifecycle, TCP connection states

**Choose Chain of Responsibility when:**
- Multiple objects can handle request
- Handler not known in advance
- Example: ASP.NET Core middleware, exception handling

**Choose Template Method when:**
- Algorithm structure is fixed
- Steps vary by subclass
- Example: Data import workflows (CSV, JSON, XML)

**Choose Mediator when:**
- Complex object interactions
- Decoupling communicating objects
- Example: MediatR for CQRS, chat applications

**Choose Memento when:**
- Need to save/restore state
- Encapsulation must be maintained
- Example: Game save states, document revision history

**Avoid Visitor; use pattern matching instead** in modern C#

### Modern C# Alternatives

```csharp
// Instead of Observer - use events
public event EventHandler<DataChangedEventArgs> DataChanged;

// Instead of Strategy - use delegates/Func
public void Process(Func<Data, Result> strategy) => strategy(data);

// Instead of State - use switch expressions
var nextState = (currentState, action) switch
{
    (State.A, Action.X) => State.B,
    (State.B, Action.Y) => State.C,
    _ => currentState
};

// Instead of Template Method - use composition
public class DataProcessor
{
    private readonly IReader reader;
    private readonly ITransformer transformer;
    private readonly IWriter writer;

    public void Process()
    {
        var data = reader.Read();
        var transformed = transformer.Transform(data);
        writer.Write(transformed);
    }
}

// Instead of Visitor - use pattern matching
public string Process(Expression expr) => expr switch
{
    Number n => ProcessNumber(n),
    Addition a => ProcessAddition(a),
    _ => throw new NotSupportedException()
};
```

---
