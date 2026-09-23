---
title: "Behavioral Patterns"
layout: guide
category: Programming Patterns
subcategory: GoF Patterns
description: "The eleven behavioral patterns for dividing responsibility and communication between objects: Strategy and Template Method, Observer, Command and undo, Chain of Responsibility, State and how it differs from Strategy, Mediator, Memento, Iterator and C#'s yield, Interpreter, and Visitor versus pattern matching. Each with a C# example, its .NET counterparts, and when not to use it."
tags: [design-patterns, strategy, observer, command, state, visitor, practical]
---

## What Behavioral Patterns Solve

Behavioral patterns are about who does what and who talks to whom. Several of them take a piece of behavior that would otherwise be hard-coded, such as an algorithm, a request, a state's rules, or an operation over a structure, and turn it into an object that can be passed around, swapped, stored, or queued. Others control how objects find and notify each other, so senders and receivers don't need direct references.

---

## Strategy

**GoF intent:** "Define a family of algorithms, encapsulate each one, and make them interchangeable. Strategy lets the algorithm vary independently from clients that use it."

```csharp
public interface IShippingCostStrategy
{
    decimal Calculate(Parcel parcel);
}

public class StandardShipping : IShippingCostStrategy
{
    public decimal Calculate(Parcel parcel) => 5m + 0.5m * parcel.WeightKg;
}

public class ExpressShipping : IShippingCostStrategy
{
    public decimal Calculate(Parcel parcel) => 15m + 1.2m * parcel.WeightKg;
}

public class CheckoutService
{
    private readonly IShippingCostStrategy shipping;

    public CheckoutService(IShippingCostStrategy shipping) => this.shipping = shipping;

    public decimal Total(Cart cart) => cart.Subtotal + shipping.Calculate(cart.Parcel);
}
```

`CheckoutService` never branches on the shipping method. A new carrier is a new strategy class, and the checkout code stays the same.

When a strategy is a single method with no state, a delegate does the same job with less code: a constructor parameter of type `Func<Parcel, decimal>` accepts any lambda. .NET uses strategies throughout. `List<T>.Sort` takes an `IComparer<T>`, and `Dictionary<TKey, TValue>` takes an `IEqualityComparer<TKey>`, so the collection's algorithm stays fixed while the comparison varies.

### When Not to Use It

With one algorithm and no realistic second one, the interface adds indirection and nothing else. And if callers have to know which strategy to pick, the conditional hasn't disappeared, only moved. That's often fine, but it should be moved somewhere deliberate, like configuration or a factory.

---

## Template Method

**GoF intent:** "Define the skeleton of an algorithm in an operation, deferring some steps to subclasses. Template Method lets subclasses redefine certain steps of an algorithm without changing the algorithm's structure."

Strategy varies a whole algorithm through composition. Template Method fixes the algorithm's outline in a base class and lets subclasses fill in particular steps through inheritance.

```csharp
public abstract class DataImporter
{
    // The template method: the order of steps is fixed
    public void Import(string path)
    {
        var text = File.ReadAllText(path);
        var records = Parse(text);
        Validate(records);
        Save(records);
    }

    // Required step: each format parses differently
    protected abstract IReadOnlyList<Customer> Parse(string text);

    // Hook: a default that subclasses may replace
    protected virtual void Validate(IReadOnlyList<Customer> records)
    {
        if (records.Count == 0)
            throw new InvalidDataException("No records found");
    }

    private void Save(IReadOnlyList<Customer> records) { /* shared persistence */ }
}

public class CsvImporter : DataImporter
{
    protected override IReadOnlyList<Customer> Parse(string text) { /* split lines and fields */ }
}

public class JsonImporter : DataImporter
{
    protected override IReadOnlyList<Customer> Parse(string text) =>
        JsonSerializer.Deserialize<List<Customer>>(text) ?? [];
}
```

The GoF book calls this "the Hollywood principle": don't call us, we'll call you. The base class calls the subclass's steps, not the other way around. .NET's `BackgroundService` works this way. Its `StartAsync` handles the hosting lifecycle and calls the `ExecuteAsync` that each subclass overrides.

### When Not to Use It

Template Method carries every cost of inheritance, including the fragile base class problem. If the steps vary independently, such as the parser and the validator changing in different combinations, pass them in as strategies instead of multiplying subclasses.

---

## Observer

**GoF intent:** "Define a one-to-many dependency between objects so that when one object changes state, all its dependents are notified and updated automatically."

The subject keeps a list of observers and notifies each one when something changes. The subject doesn't know what the observers are or what they do with the news. C# builds this into the language as events.

```csharp
public class PriceChangedEventArgs(string symbol, decimal price) : EventArgs
{
    public string Symbol { get; } = symbol;
    public decimal Price { get; } = price;
}

public class StockTicker
{
    public event EventHandler<PriceChangedEventArgs>? PriceChanged;

    public void Update(string symbol, decimal price) =>
        PriceChanged?.Invoke(this, new PriceChangedEventArgs(symbol, price));
}

var ticker = new StockTicker();
ticker.PriceChanged += (_, e) => Console.WriteLine($"Display: {e.Symbol} {e.Price}");
ticker.PriceChanged += (_, e) => { if (e.Price > 500) Console.WriteLine($"Alert: {e.Symbol}"); };

ticker.Update("MSFT", 512.30m); // both observers run
```

The pattern predates the GoF book. Smalltalk-80's model-view-controller framework used the same dependency mechanism to keep views in sync with their models. .NET also defines `IObservable<T>` and `IObserver<T>`, the interfaces Reactive Extensions (Rx) builds on for streams of events that can be filtered and combined.

### When Not to Use It

Observers run in the order they subscribed, which nothing at the call site shows, and the subject can't see what they do, so a chain of observers that trigger further updates is hard to trace. An event also keeps every subscriber reachable for as long as the subject lives, so a short-lived object that subscribes to a long-lived one and never unsubscribes can't be garbage collected. For a single listener that must respond, a direct call or a callback parameter is clearer.

---

## Command

**GoF intent:** "Encapsulate a request as an object, thereby letting you parameterize clients with different requests, queue or log requests, and support undoable operations."

Once a request is an object, it can be stored, sent somewhere else, run later, retried, logged, or reversed.

```csharp
public interface ICommand
{
    void Execute();
    void Undo();
}

public class TransferCommand : ICommand
{
    private readonly BankAccount from;
    private readonly BankAccount to;
    private readonly decimal amount;

    public TransferCommand(BankAccount from, BankAccount to, decimal amount) =>
        (this.from, this.to, this.amount) = (from, to, amount);

    public void Execute()
    {
        if (!from.Withdraw(amount))
            throw new InvalidOperationException("Insufficient funds");
        to.Deposit(amount);
    }

    public void Undo()
    {
        if (!to.Withdraw(amount))
            throw new InvalidOperationException("Transfer can no longer be reversed");
        from.Deposit(amount);
    }
}

public class CommandHistory
{
    private readonly Stack<ICommand> undo = new();
    private readonly Stack<ICommand> redo = new();

    public void Run(ICommand command)
    {
        command.Execute();
        undo.Push(command);
        redo.Clear(); // a new action invalidates anything that was undone
    }

    public void Undo()
    {
        if (undo.TryPop(out var command))
        {
            command.Undo();
            redo.Push(command);
        }
    }

    public void Redo()
    {
        if (redo.TryPop(out var command))
        {
            command.Execute();
            undo.Push(command);
        }
    }
}
```

`Undo` can fail. If the receiving account has spent the money, the transfer can't be reversed as written. Undo for real-world side effects is usually a new compensating action, such as a refund, rather than a clean rewind.

The same idea runs well beyond undo stacks. A message placed on a queue for a background worker is a command, and so are WPF's `ICommand` bindings, which connect a button to an action without the button knowing what the action does.

### When Not to Use It

A command object for an action that is only ever called directly, never stored, queued, or undone, is just a method call with extra ceremony.

---

## Chain of Responsibility

**GoF intent:** "Avoid coupling the sender of a request to its receiver by giving more than one object a chance to handle the request. Chain the receiving objects and pass the request along the chain until an object handles it."

```csharp
public record Expense(string Description, decimal Amount);

public abstract class Approver
{
    private Approver? next;

    public Approver Then(Approver approver)
    {
        next = approver;
        return approver;
    }

    public string Approve(Expense expense) =>
        CanApprove(expense)
            ? $"{Title} approved {expense.Description}"
            : next?.Approve(expense) ?? $"Rejected {expense.Description}: over every limit";

    protected abstract string Title { get; }
    protected abstract bool CanApprove(Expense expense);
}

public class TeamLead : Approver
{
    protected override string Title => "Team lead";
    protected override bool CanApprove(Expense e) => e.Amount <= 1_000m;
}

public class Manager : Approver
{
    protected override string Title => "Manager";
    protected override bool CanApprove(Expense e) => e.Amount <= 10_000m;
}

public class Director : Approver
{
    protected override string Title => "Director";
    protected override bool CanApprove(Expense e) => e.Amount <= 100_000m;
}

var chain = new TeamLead();
chain.Then(new Manager()).Then(new Director());

chain.Approve(new Expense("Laptop", 2_400m)); // "Manager approved Laptop"
```

The code that submits the expense talks only to the head of the chain. Adding a VP level, or changing the limits, changes how the chain is built and nothing else.

### Pipelines Are a Variant

In the GoF form, the request stops at the first handler that takes it. ASP.NET Core middleware uses a looser version: every component gets the request, does its part, and decides whether to call the next one. Authentication middleware can end the chain early with a 401, and logging middleware always passes the request on. Both shapes are commonly called Chain of Responsibility.

### When Not to Use It

A request can fall off the end of the chain with no one handling it, so there must be a default at the end, like the rejection above. When the right handler is known up front, a dictionary lookup or a direct call is simpler and easier to debug than walking a chain.

---

## State

**GoF intent:** "Allow an object to alter its behavior when its internal state changes. The object will appear to change its class."

When an object's methods each start with a `switch` on its current state, State moves each case into its own class. The object holds a reference to its current state object and delegates to it, and a transition swaps in a different state object.

```csharp
public interface IOrderState
{
    string Name { get; }
    IOrderState Ship();
    IOrderState Cancel();
}

public class Pending : IOrderState
{
    public string Name => "Pending";
    public IOrderState Ship() => new Shipped();
    public IOrderState Cancel() => new Cancelled();
}

public class Shipped : IOrderState
{
    public string Name => "Shipped";
    public IOrderState Ship() => throw new InvalidOperationException("Already shipped");
    public IOrderState Cancel() => throw new InvalidOperationException("Shipped orders need a return, not a cancellation");
}

public class Cancelled : IOrderState
{
    public string Name => "Cancelled";
    public IOrderState Ship() => throw new InvalidOperationException("Order was cancelled");
    public IOrderState Cancel() => this;
}

public class Order
{
    private IOrderState state = new Pending();

    public string Status => state.Name;

    public void Ship() => state = state.Ship();
    public void Cancel() => state = state.Cancel();
}
```

Each state's rules are in one place. Adding a `Delivered` state means one new class and a `Deliver` method that each state answers in its own class, instead of new cases scattered through every method of `Order`.

### State and Strategy Look the Same

Both hold a reference to an interface and delegate to it. The difference is who changes it. A strategy is chosen by the client, usually once, and the strategies don't know about each other. A state object is swapped by the states themselves as the object moves through its lifecycle, and each state knows which states can follow it.

### When the States Carry No Behavior

If each state only decides which state comes next, and the object behaves the same otherwise, a transition table in a switch expression is shorter and shows every transition at a glance:

```csharp
public enum OrderStatus { Pending, Shipped, Delivered, Cancelled }
public enum OrderAction { Ship, Deliver, Cancel }

public static OrderStatus Next(OrderStatus status, OrderAction action) => (status, action) switch
{
    (OrderStatus.Pending, OrderAction.Ship) => OrderStatus.Shipped,
    (OrderStatus.Pending, OrderAction.Cancel) => OrderStatus.Cancelled,
    (OrderStatus.Shipped, OrderAction.Deliver) => OrderStatus.Delivered,
    _ => throw new InvalidOperationException($"Can't {action} an order that is {status}")
};
```

This is a state machine, but not the State pattern. The pattern earns its extra classes when states differ in what they do, not just in what follows them.

### When Not to Use It

For two or three states with simple rules, a field and an `if` are clearer than a class per state.

---

## Mediator

**GoF intent:** "Define an object that encapsulates how a set of objects interact. Mediator promotes loose coupling by keeping objects from referring to each other explicitly, and it lets you vary their interaction independently."

When every object in a group talks to every other directly, the number of connections grows with the square of the group's size, and any object's behavior depends on all the others. A mediator puts one object in the middle. Each participant talks only to the mediator, and the rules for who hears what live in one place.

{% include figure.html id="oop-mediator" %}

```csharp
public class ChatRoom
{
    private readonly List<Participant> participants = new();

    public void Join(Participant participant)
    {
        participants.Add(participant);
        participant.Room = this;
    }

    public void Broadcast(Participant sender, string message)
    {
        foreach (var p in participants.Where(p => p != sender && !p.IsMuted(sender.Name)))
            p.Receive(sender.Name, message);
    }
}

public class Participant
{
    private readonly HashSet<string> muted = new();

    public Participant(string name) => Name = name;

    public string Name { get; }
    public ChatRoom? Room { get; set; }

    public void Send(string message) => Room?.Broadcast(this, message);
    public void Receive(string from, string message) => Console.WriteLine($"{Name} got '{message}' from {from}");
    public void Mute(string name) => muted.Add(name);
    public bool IsMuted(string name) => muted.Contains(name);
}
```

No participant holds a reference to another. The muting rule lives in `ChatRoom`, and a new rule, such as private messages, changes the room without changing participants. The GoF book's own example is a dialog box, where the dialog coordinates its controls, so that typing in a text box enables a button without the two controls knowing each other.

Mediator and Observer both decouple senders from receivers. Observer broadcasts one-way from a subject to whoever subscribed. A mediator coordinates two-way interaction among peers and decides what each message causes. The MediatR library is named after the pattern, though routing each request object to its handler resembles Command dispatch as much as the GoF mediator.

### When Not to Use It

The mediator gathers everyone's interaction logic, so it tends to grow into the most complex class in the system. With two or three collaborators that rarely change, direct references are easier to follow.

---

## Memento

**GoF intent:** "Without violating encapsulation, capture and externalize an object's internal state so that the object can be restored to this state later."

Command-based undo reverses each action. Memento takes a different approach: save a snapshot before a change and restore it later. The difficulty is that saving state from outside an object usually means exposing that state. Memento solves it by making the snapshot opaque to everyone except the object that created it.

```csharp
// What the outside world sees: a token with no members
public interface IEditorSnapshot { }

public class TextEditor
{
    private string content = "";
    private int cursor;

    public string Text => content;

    public void Type(string text)
    {
        content = content.Insert(cursor, text);
        cursor += text.Length;
    }

    public IEditorSnapshot Save() => new Snapshot(content, cursor);

    public void Restore(IEditorSnapshot snapshot)
    {
        var s = (Snapshot)snapshot;
        (content, cursor) = (s.Content, s.Cursor);
    }

    // Only TextEditor can see inside
    private sealed record Snapshot(string Content, int Cursor) : IEditorSnapshot;
}

public class EditorHistory
{
    private readonly Stack<IEditorSnapshot> snapshots = new();

    public void Checkpoint(TextEditor editor) => snapshots.Push(editor.Save());

    public bool Undo(TextEditor editor)
    {
        if (!snapshots.TryPop(out var snapshot))
            return false;

        editor.Restore(snapshot);
        return true;
    }
}
```

The GoF book names the three roles. `TextEditor` is the *originator*, `Snapshot` is the *memento*, and `EditorHistory` is the *caretaker*, which stores mementos without being able to read them. The private nested record is what enforces that in C#.

### When Not to Use It

Snapshots of large objects are expensive to keep, and a hundred-step undo history holds a hundred copies. When the changes are small and reversible, commands that record only the change use far less memory. For an immutable object, the old instance already is its own snapshot.

---

## Iterator

**GoF intent:** "Provide a way to access the elements of an aggregate object sequentially without exposing its underlying representation."

C# builds this pattern into the language. `IEnumerable<T>` is the aggregate, `IEnumerator<T>` is the iterator, and `foreach` drives it. `yield return` writes the iterator for you, so a collection can offer any traversal order without exposing how it stores its elements:

```csharp
public class BinarySearchTree<T> : IEnumerable<T> where T : IComparable<T>
{
    private sealed class Node(T value)
    {
        public T Value { get; } = value;
        public Node? Left { get; set; }
        public Node? Right { get; set; }
    }

    private Node? root;

    public void Add(T value) => root = Insert(root, value);

    private static Node Insert(Node? node, T value)
    {
        if (node is null) return new Node(value);
        if (value.CompareTo(node.Value) < 0) node.Left = Insert(node.Left, value);
        else node.Right = Insert(node.Right, value);
        return node;
    }

    // In-order traversal: callers see a sorted sequence, never a node
    public IEnumerator<T> GetEnumerator()
    {
        var stack = new Stack<Node>();
        var current = root;
        while (current is not null || stack.Count > 0)
        {
            while (current is not null)
            {
                stack.Push(current);
                current = current.Left;
            }
            current = stack.Pop();
            yield return current.Value;
            current = current.Right;
        }
    }

    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}

var tree = new BinarySearchTree<int>();
foreach (var n in new[] { 50, 30, 70, 20, 40 }) tree.Add(n);

foreach (var n in tree)
    Console.Write($"{n} "); // 20 30 40 50 70
```

The compiler turns the method into a state machine that runs only as far as the caller asks. `tree.First()` visits the leftmost path and stops. That laziness is what lets LINQ chain operators over large or infinite sequences without building intermediate lists.

### When Not to Use It

Writing a custom iterator is rarely needed when the data already sits in a `List<T>` or an array, which have their own. And a lazy sequence is re-evaluated each time it's enumerated, so enumerating a query twice runs it twice. Call `ToList()` when a result will be used more than once.

---

## Interpreter

**GoF intent:** "Given a language, define a representation for its grammar along with an interpreter that uses the representation to interpret sentences in the language."

Interpreter fits small languages: pricing rules, search filters, or formulas that users write. Each grammar rule becomes a class, a sentence becomes a tree of those objects, and interpreting it means asking the root to evaluate itself.

```csharp
public interface IExpression
{
    decimal Evaluate(IReadOnlyDictionary<string, decimal> variables);
}

public record Number(decimal Value) : IExpression
{
    public decimal Evaluate(IReadOnlyDictionary<string, decimal> variables) => Value;
}

public record Variable(string Name) : IExpression
{
    public decimal Evaluate(IReadOnlyDictionary<string, decimal> variables) => variables[Name];
}

public record Add(IExpression Left, IExpression Right) : IExpression
{
    public decimal Evaluate(IReadOnlyDictionary<string, decimal> variables) =>
        Left.Evaluate(variables) + Right.Evaluate(variables);
}

public record Multiply(IExpression Left, IExpression Right) : IExpression
{
    public decimal Evaluate(IReadOnlyDictionary<string, decimal> variables) =>
        Left.Evaluate(variables) * Right.Evaluate(variables);
}

// price * quantity + shipping
var total = new Add(
    new Multiply(new Variable("price"), new Variable("quantity")),
    new Variable("shipping"));

total.Evaluate(new Dictionary<string, decimal>
{
    ["price"] = 10m, ["quantity"] = 3m, ["shipping"] = 5m
}); // 35
```

The pattern covers representing and evaluating the tree, not parsing text into it. A real rule language needs a parser in front. .NET's expression trees in `System.Linq.Expressions` are the same idea at scale, and they're how LINQ providers such as EF Core read a C# lambda as a data structure and translate it to SQL.

### When Not to Use It

A class per grammar rule becomes unmanageable for a large grammar, and evaluating a tree of objects is slow compared with compiled code. For anything bigger than a small rule language, use a parser generator or an existing expression library.

---

## Visitor

**GoF intent:** "Represent an operation to be performed on the elements of an object structure. Visitor lets you define a new operation without changing the classes of the elements on which it operates."

The Interpreter example put `Evaluate` on every expression class. Adding a second operation, such as printing, would mean editing every class again, and a third would mean editing them all once more. Visitor moves each operation into its own class. Each element class gets one `Accept` method, written once, that calls back to the visitor method for its own type:

```csharp
public interface IExpressionVisitor<T>
{
    T VisitNumber(Number n);
    T VisitVariable(Variable v);
    T VisitAdd(Add a);
    T VisitMultiply(Multiply m);
}

// Each element class gains one method, once. For example:
public record Add(IExpression Left, IExpression Right) : IExpression
{
    public T Accept<T>(IExpressionVisitor<T> visitor) => visitor.VisitAdd(this);
}

// A new operation is a new class; the elements don't change
public class PrintVisitor : IExpressionVisitor<string>
{
    public string VisitNumber(Number n) => n.Value.ToString();
    public string VisitVariable(Variable v) => v.Name;
    public string VisitAdd(Add a) => $"({a.Left.Accept(this)} + {a.Right.Accept(this)})";
    public string VisitMultiply(Multiply m) => $"{m.Left.Accept(this)} * {m.Right.Accept(this)}";
}
```

The two calls, `Accept` on the element and then `VisitAdd` on the visitor, are called double dispatch. They select the method by both the element's type and the visitor's type, which C#'s ordinary virtual calls can't do in one step. .NET's `ExpressionVisitor` is this pattern, used to walk and rewrite LINQ expression trees.

### Pattern Matching Is the Lighter Alternative

C# can switch on type directly, which gives the same "operation outside the classes" without `Accept` methods or a visitor interface:

```csharp
public static string Print(IExpression expression) => expression switch
{
    Number n => n.Value.ToString(),
    Variable v => v.Name,
    Add a => $"({Print(a.Left)} + {Print(a.Right)})",
    Multiply m => $"{Print(m.Left)} * {Print(m.Right)}",
    _ => throw new NotSupportedException(expression.GetType().Name)
};
```

The difference shows up when someone adds a new element type, such as `Divide`. With a visitor, every visitor class fails to compile until it handles `Divide`. With pattern matching, the compiler can't know the list of subtypes is complete, so the discard arm catches `Divide` at runtime instead. Choose the visitor when many operations must stay in step with the element types, and pattern matching when there are few operations or the element types rarely change.

### When Not to Use It

Visitor makes adding operations cheap and adding element types expensive, since each new type touches every visitor. If new element types arrive more often than new operations, put the operations on the elements instead.

---

## Choosing a Behavioral Pattern

```
Varying an algorithm or a step?
├─ The whole algorithm, chosen by the client → Strategy
├─ Some steps of a fixed outline, chosen by subclass → Template Method
└─ Behavior that changes as the object's own state changes → State

Coordinating objects?
├─ One object announces changes to any number of listeners → Observer
├─ Many peers interact, and the rules should live in one place → Mediator
└─ A request should find its handler without the sender choosing one → Chain of Responsibility

Treating actions or state as data?
├─ Queue, log, retry, or undo requests → Command
└─ Snapshot and restore an object without exposing its fields → Memento

Working with a structure?
├─ Traverse it without exposing how it's stored → Iterator
├─ Evaluate sentences in a small language → Interpreter
└─ Add operations over a stable set of element types → Visitor
```
