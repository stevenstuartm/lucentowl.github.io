---
title: "C# Operators and Expressions"
layout: guide
category: ".NET & C#"
subcategory: "Language Fundamentals"
description: "How C# operators behave: integer division and overflow, equality, short-circuiting, the null operators, index and range, pattern matching and switch expressions, precedence versus evaluation order, and why C# keeps turning statements into expressions."
tags: [operators, pattern-matching, switch-expressions, null-coalescing, operator-precedence, fundamentals]
---

## Statements and Expressions

An **expression** produces a value: `a + b`, `order?.Total`, `score >= 90 ? "A" : "B"`. A **statement** performs an action and produces nothing: `if`, `for`, `return`, a variable declaration. The difference decides where a construct can appear. An expression can sit on the right of an assignment, inside a method argument, or inside another expression, and a statement can only stand on its own line. That is why `var x = condition ? a : b;` compiles and `var x = if (condition) a else b;` does not, even though both describe the same branch.

C# began as a statement-oriented language in the C tradition, where branching means declaring a variable first and assigning it in each path:

```csharp
string label;
if (score >= 90)
    label = "A";
else if (score >= 80)
    label = "B";
else
    label = "C";
```

Release by release, the language has added expression forms of things that used to be statements. The conditional operator `?:` was there from C# 1. LINQ (C# 3) replaced accumulate-in-a-loop code with composed expressions. Expression-bodied members (C# 6) let a method or property be a single expression. Throw expressions (C# 7) let `throw` appear inside `??` and `?:`. Switch expressions (C# 8) turned the most common use of `switch` into something that produces a value, and patterns (C# 7 through 11) gave those expressions a vocabulary for testing shape and content. The same branch now reads:

```csharp
var label = score switch
{
    >= 90 => "A",
    >= 80 => "B",
    _ => "C"
};
```

The expression form has three concrete advantages. It composes, so the switch can be passed straight into a method call or embedded in string interpolation without a named temporary. It produces a single binding, assigned once, which is what makes `var` and immutable locals natural. And for a switch expression the compiler checks exhaustiveness, warning when some input reaches no arm, whereas an `if`/`else` chain only fails to compile if a path leaves the variable unassigned. Statements still read better for sequences of side effects, resource management, and loops with early exits, so the aim is to recognise when a value is being computed and write it as one.

The rest of this guide covers the operators those expressions are built from, and what each one does at the edges.

## Arithmetic Operators

```csharp
int a = 13, b = 5;

int sum = a + b;        // 18
int quotient = a / b;   // 2 (integer division rounds toward zero)
int remainder = a % b;  // 3

double precise = 13.0 / 5;     // 2.6 (one floating-point operand is enough)
double cast = (double)a / b;   // 2.6

int x = 5;
int pre = ++x;   // x becomes 6, pre is 6
int post = x++;  // post is 6, then x becomes 7

int count = 10;
count += 5;      // 15
count *= 2;      // 30
```

### Division and Remainder with Negative Numbers

Integer division **rounds toward zero**, not down, so `-13 / 5` is `-2`, not `-3`. The remainder follows from that rule: `a % b` equals `a - (a / b) * b`, which means a non-zero remainder takes the **sign of the left operand**.

```csharp
Console.WriteLine(-13 / 5);  // -2
Console.WriteLine(-5 % 4);   // -1, not 3
Console.WriteLine(5 % -4);   // 1
```

The sign rule bites in code that uses `%` to wrap an index or test parity. `n % 2 == 1` is false for every negative odd number, because the remainder is `-1`. Test `n % 2 != 0` instead, and wrap a possibly negative index with `((i % n) + n) % n`.

### Operands Smaller Than int Are Promoted

Arithmetic on `byte`, `sbyte`, `short`, `ushort`, and `char` operands converts them to `int` first, so the result is an `int`. Assigning it back to the smaller type needs a cast, but the compound form hides one:

```csharp
byte a = 200, b = 100;

var sum = a + b;   // int 300
// byte c = a + b; // compile error: int doesn't convert implicitly to byte

a += b;            // compiles, because a += b means a = (byte)(a + b)
Console.WriteLine(a);  // 44 (300 truncated to 8 bits)
```

### Overflow Depends on the Type

What happens when a result doesn't fit is decided by the operand type, and the three numeric families behave differently:

| Type | On overflow | On division by zero |
|------|-------------|---------------------|
| Integer (`int`, `long`, ...) | Wraps silently by default; throws `OverflowException` in a checked context | Throws `DivideByZeroException` |
| `float`, `double` | Never throws; produces `Infinity` or `-Infinity` | `x / 0.0` is `Infinity`, and `0.0 / 0.0` is `NaN` |
| `decimal` | Always throws `OverflowException` | Throws `DivideByZeroException` |

`NaN` compares unequal to everything, itself included, so `x == double.NaN` is always false. Test it with `double.IsNaN(x)`.

### Checked and Unchecked Contexts

Integer arithmetic runs in an **unchecked** context by default, where overflow discards the high-order bits. A **checked** context turns the same overflow into an `OverflowException`.

```csharp
int max = int.MaxValue;

int wrapped = max + 1;           // -2147483648, no error

try
{
    int overflow = checked(max + 1);  // throws OverflowException
}
catch (OverflowException)
{
    Console.WriteLine("Overflow detected");
}

checked
{
    int result = max + 1;  // throws
}

// Explicitly allow wrapping where it is intended, as in hash mixing
int hash = unchecked(seed * 397 ^ value);
```

The context has a scope that is easy to misread. A `checked` block or expression applies **only to the code written inside it**, not to methods it calls. Calling `Compute()` from inside `checked { }` leaves `Compute`'s own arithmetic in whatever context it was compiled with. The project-wide default comes from the `CheckForOverflowUnderflow` compiler option, which is off unless set, and `checked` and `unchecked` override it for their lexical region.

Two cases ignore the default. Overflow in a **constant expression** such as `int.MaxValue + 1` written with literals is a compile-time error, not a silent wrap. And `int.MinValue / -1` throws `OverflowException` even in an unchecked context, because the true result has no `int` representation to wrap to.

## Equality and Comparison

The relational operators `<`, `>`, `<=`, and `>=` compare numbers and anything that overloads them. Equality is where the type's semantics show through, because what `==` compares depends on the type.

```csharp
int x = 5, y = 5;
bool numbers = x == y;   // true: value types compare values

string a = "hello";
string b = "hel" + "lo";
bool strings = a == b;   // true: string overloads == to compare content

var list1 = new List<int> { 1, 2, 3 };
var list2 = new List<int> { 1, 2, 3 };
bool lists = list1 == list2;                  // false: same content, different objects
bool sameContent = list1.SequenceEqual(list2); // true
```

For a class, `==` means **reference equality** (the same object) unless the class overloads the operator, as `string` does. Records generate value-based `==` for you. A struct gets no `==` at all unless it declares one, so `p1 == p2` on a plain struct is a compile error rather than a silent reference check. When `==` has been overloaded and you need the reference check, `object.ReferenceEquals(a, b)` bypasses the overload.

## Logical Operators and Short-Circuiting

```csharp
bool a = true, b = false;

bool both = a && b;    // false
bool either = a || b;  // true
bool negated = !a;     // false
bool exactlyOne = a ^ b;  // true
```

`&&` and `||` **short-circuit**. The right operand is evaluated only when the left one hasn't already decided the result, which is what makes guard conditions safe:

```csharp
// Length is never read when text is null
if (text != null && text.Length > 0) { }

// IsExpensiveCheck() runs only when the cache misses
if (cache.Contains(key) || IsExpensiveCheck(key)) { }
```

`&` and `|` applied to `bool` operands compute the same logical result but **always evaluate both sides**. They are only correct when the right side must run for its side effect, which is rare enough that a `&` in a condition is more often a typo than a choice.

## Bitwise and Shift Operators

These operate on the individual bits of integer types.

```csharp
int a = 0b_1010;  // 10
int b = 0b_1100;  // 12

int and = a & b;   // 0b_1000 = 8  (bits set in both)
int or = a | b;    // 0b_1110 = 14 (bits set in either)
int xor = a ^ b;   // 0b_0110 = 6  (bits set in exactly one)
int not = ~a;      // every bit inverted: -11

int left = a << 2;  // 40, each shift left multiplies by 2
int right = a >> 1; // 5

int negative = -16;
int arithmetic = negative >> 2;   // -4: >> copies the sign bit into the top
int logical = negative >>> 2;     // 1073741820: >>> fills with zeros (C# 11)
```

For signed types, `>>` is an **arithmetic** shift that preserves the sign, so a negative number stays negative. The unsigned right shift `>>>`, added in C# 11, fills the vacated high bits with zeros whatever the sign. Before C# 11 the same effect needed a cast to `uint` and back.

The everyday use of bitwise operators is a `[Flags]` enum, where each member occupies one bit and a value can hold several at once:

```csharp
[Flags]
enum Permissions { None = 0, Read = 1, Write = 2, Execute = 4 }

var perms = Permissions.Read | Permissions.Write;
bool canWrite = (perms & Permissions.Write) != 0;  // true

perms |= Permissions.Execute;   // set a flag
perms &= ~Permissions.Write;    // clear a flag
perms ^= Permissions.Read;      // toggle a flag
```

## Null Operators

Each of these operators evaluates its right side, or the rest of the chain, only when the left side requires it.

### Null-Coalescing (??) and Null-Coalescing Assignment (??=)

`a ?? b` returns `a` when it isn't null and otherwise evaluates and returns `b`. The operator is right-associative, so a chain tries each operand in order.

```csharp
string name = userInput ?? "Anonymous";
string display = firstName ?? lastName ?? "Unknown";

// The right side runs only on a miss
var result = GetCachedValue() ?? ComputeExpensiveValue();

// throw is an expression, so it can be the fallback (C# 7)
string value = input ?? throw new ArgumentNullException(nameof(input));
```

`a ??= b` (C# 8) assigns `b` to `a` only when `a` is null, and is the idiomatic lazy initializer:

```csharp
private List<string>? _cache;
public List<string> Cache => _cache ??= new List<string>();
```

### Null-Conditional Access (?. and ?[])

`x?.Member` evaluates to null when `x` is null instead of throwing `NullReferenceException`. When the member returns a value type, the result becomes its nullable form, so `text?.Length` is an `int?`.

```csharp
string? city = order?.Customer?.Address?.City;
int? length = text?.Length;
var first = list?[0];

customer?.SendNotification();   // the call is skipped when customer is null

int nameLength = text?.Length ?? 0;  // back to int with a fallback
```

The null check **short-circuits the rest of the chain**. In `order?.Customer.Address`, if `order` is null then neither `.Customer` nor `.Address` is evaluated, so the unguarded `.Address` cannot throw on that path. It still throws if `order` is non-null and `Customer` is null, since only `order` was guarded.

### Null-Conditional Assignment (C# 14)

From C# 14, `?.` and `?[]` can also appear on the **left** of an assignment. The right side is evaluated only when the target isn't null.

```csharp
// Before C# 14
if (customer is not null)
{
    customer.Order = GetCurrentOrder();
}

// C# 14: GetCurrentOrder() is not called when customer is null
customer?.Order = GetCurrentOrder();
customer?.Total += lineAmount;   // compound assignment works too
```

Increment and decrement (`customer?.Count++`) are not allowed in this position.

The postfix `!` that also appears around null handling is not a runtime operator at all. It is the **null-forgiving** operator, which silences a nullable-reference-type warning and has no effect on the running program.

## The Conditional Operator

`condition ? whenTrue : whenFalse` evaluates the condition and then **only the chosen branch**.

```csharp
int max = a > b ? a : b;
string status = isActive ? "Active" : "Inactive";

// Target-typed (C# 9): the declared type resolves int vs null
int? maybe = condition ? 42 : null;

// Either branch can throw (C# 7)
int port = raw > 0 ? raw : throw new ArgumentOutOfRangeException(nameof(raw));
```

The operator is right-associative, so a nested chain reads top to bottom. Past two or three levels a switch expression expresses the same mapping more clearly:

```csharp
string grade = score >= 90 ? "A"
             : score >= 80 ? "B"
             : "C";
```

## Type Testing and Casting

`is`, `as`, and the cast `(T)x` all ask whether a value's run-time type is compatible with `T`. They differ in what happens when it isn't.

```csharp
object obj = GetSomething();

// Cast: throws InvalidCastException on mismatch
string s1 = (string)obj;

// as: null on mismatch (reference and nullable types only)
string? s2 = obj as string;

// is with a declaration pattern: tests and binds in one step
if (obj is string s3)
{
    Console.WriteLine(s3.Length);
}
```

Use the cast when a mismatch is a bug that should fail loudly. Use `is` with a pattern when the mismatch is a normal case to branch on. `as` predates patterns and survives mostly in older code, since `as` followed by a null check is what `is string s` does in one expression. `is` and `as` test the run-time type only and never apply a user-defined conversion operator.

Two related operators work on names rather than values. `typeof(T)` returns the `System.Type` for a type named in source, such as `typeof(List<>)` for the open generic, while `obj.GetType()` returns the run-time type of an instance. `nameof(x)` (C# 6) produces the identifier as a string at compile time, so a rename refactoring updates it:

```csharp
throw new ArgumentNullException(nameof(customer));
string prop = nameof(Customer.Name);   // "Name"
```

## Index and Range

`^n` and `a..b` (C# 8) address a sequence from either end. `^n` means "n from the end", which makes `^1` the last element. A range's start is inclusive and its end is exclusive.

```
element:      0    1    2    3    4    5
            [ 10 | 11 | 12 | 13 | 14 | 15 ]
from start: 0    1    2    3    4    5    6
from end:  ^6   ^5   ^4   ^3   ^2   ^1   ^0
```

The index labels sit on the boundaries between elements. That picture explains both rules at once. `^0` is the boundary after the last element, so `array[^0]` is out of range, just as `array[array.Length]` is. And `[1..4]` takes everything between boundary 1 and boundary 4, which is three elements.

```csharp
int[] numbers = { 10, 11, 12, 13, 14, 15 };

int last = numbers[^1];          // 15
int[] middle = numbers[1..4];    // { 11, 12, 13 }
int[] fromStart = numbers[..3];  // { 10, 11, 12 }
int[] lastThree = numbers[^3..]; // { 13, 14, 15 }

string text = "Hello, World!";
string world = text[7..^1];      // "World"
```

`^1` and `1..4` are ordinary values of the `System.Index` and `System.Range` types, so they can be stored in variables and passed around. What a range costs depends on the target. On an array or a string it **copies** the selected elements into a new array or string. On a `Span<T>` or `ReadOnlySpan<T>` it returns a view over the same memory with no copy:

```csharp
int[] copy = numbers[1..4];              // allocates a new 3-element array
Span<int> view = numbers.AsSpan()[1..4]; // no allocation; writes go to numbers
```

## Pattern Matching

A **pattern** describes a shape a value might have, such as a type, a constant, a range, a set of property values, or a sequence. Patterns appear after `is`, in the arms of a switch expression, and in `case` labels of a switch statement. Each one tests the value and can bind parts of it to new variables.

### The Kinds of Pattern

```csharp
object value = GetValue();

if (value is int n) { }                      // declaration: type test + bind
if (value is null) { }                       // constant (never calls an overloaded ==)
if (value is not null) { }                   // negated constant
if (value is int and >= 18 and < 65) { }     // type, relational, logical and
if (value is string { Length: > 0 } s) { }   // property pattern with a binding
var point = (X: 3, Y: -1);
if (point is (> 0, < 0)) { }                 // positional: deconstructs a tuple or record

int[] arr = { 1, 2, 3, 4 };
if (arr is [1, ..]) { }                      // list: starts with 1
if (arr is [var first, .., var last]) { }    // list with slice: binds the ends
if (arr is [_, _, _]) { }                    // exactly three elements, any values
```

| Pattern | Matches when | Introduced |
|---------|--------------|------------|
| Declaration `T x` | Value is non-null and its run-time type is compatible with `T`; binds `x` | C# 7 |
| Constant `0`, `"x"`, `null` | Value equals the constant | C# 7 |
| `var x` | Always, including null; binds `x` | C# 7 |
| Property `{ P: pattern }` | Value is non-null and each named member matches | C# 8 |
| Positional `(p1, p2)` | The deconstructed parts each match | C# 8 |
| Discard `_` | Always, including null (top-level only in a switch expression; nested anywhere) | C# 8 |
| Type `T` | Same test as declaration, without a binding | C# 9 |
| Relational `< c`, `>= c` | Comparison against a constant holds | C# 9 |
| Logical `and`, `or`, `not` | The combination holds | C# 9 |
| Extended property `{ A.B: pattern }` | Nested member matches | C# 10 |
| List `[p1, p2, ..]` | Elements match position by position; `..` matches any run | C# 11 |

Two details catch people. The combinators bind in the order `not`, then `and`, then `or`, so `c is not >= 'a' and <= 'z'` parses as `(not >= 'a') and <= 'z'`. Write `c is not (>= 'a' and <= 'z')` when the negation should cover the whole range. And type, declaration, property, positional, and list patterns all fail on null, which is why the empty property pattern `is { } x` is a common way to say "non-null, and bind it".

### Switch Expressions

A switch expression (C# 8) tests one input against a list of arms and evaluates to the result of the first arm that matches. Arms are tried **top to bottom**, so a specific arm has to come before a general one that would also match.

```csharp
string Classify(int number) => number switch
{
    < 0 => "Negative",
    0 => "Zero",
    < 10 => "Single digit",
    < 100 => "Double digit",
    _ => "Large"
};

// Property patterns select on an object's state
decimal Discount(Customer c) => c switch
{
    { IsPremium: true, YearsActive: > 5 } => 0.25m,
    { IsPremium: true } => 0.15m,
    { YearsActive: > 10 } => 0.10m,
    _ => 0m
};

// A tuple switches on several inputs at once
string Quadrant(int x, int y) => (x, y) switch
{
    (0, 0) => "Origin",
    (> 0, > 0) => "Q1",
    (< 0, > 0) => "Q2",
    (< 0, < 0) => "Q3",
    (> 0, < 0) => "Q4",
    _ => "On an axis"
};

// A when clause adds a condition no pattern can express
string Describe(Order o) => o switch
{
    { Total: > 1000 } when o.Customer.IsNew => "Review",
    { Total: > 1000 } => "Large",
    _ => "Standard"
};
```

The compiler checks the arms two ways. An arm that an earlier arm fully covers is a compile error, because it can never run. And if some input can reach no arm, the compiler warns (CS8509), and at run time that input throws `SwitchExpressionException`. A final `_` arm makes the expression exhaustive, and should either produce a genuine default or throw a clearer exception than the runtime would.

## Expression-Bodied Members

A member whose body is a single expression can be written with `=>` in place of a block and a `return`. Methods, operators, and read-only properties and indexers gained this in C# 6. Constructors, finalizers, and individual `get`/`set`/`init` accessors followed in C# 7.

```csharp
public class Circle
{
    private double radius;

    public Circle(double radius) => this.radius = radius;

    public double Area => Math.PI * radius * radius;          // read-only property

    public double Radius
    {
        get => radius;
        set => radius = value > 0 ? value : throw new ArgumentOutOfRangeException(nameof(value));
    }

    public double Circumference() => 2 * Math.PI * radius;    // method

    public static Circle operator +(Circle a, Circle b) => new(a.radius + b.radius);
}
```

The form suits members that compute a value. When a body needs several statements, forcing it into one expression through nested conditionals or chained `??` makes it harder to read than the block it replaced.

## Precedence, Associativity, and Evaluation Order

**Precedence** decides how an expression is grouped when it mixes operators. From highest to lowest:

| Category | Operators |
|----------|-----------|
| Primary | `x.y` `f(x)` `a[i]` `x?.y` `x?[i]` `x++` `x--` `x!` `new` `typeof` `checked` `unchecked` `default` `nameof` `sizeof` `stackalloc` |
| Unary | `+x` `-x` `!x` `~x` `++x` `--x` `^x` `(T)x` `await` |
| Range | `x..y` |
| switch and with | `switch` `with` |
| Multiplicative | `*` `/` `%` |
| Additive | `+` `-` |
| Shift | `<<` `>>` `>>>` |
| Relational and type-testing | `<` `>` `<=` `>=` `is` `as` |
| Equality | `==` `!=` |
| Logical AND | `&` |
| Logical XOR | `^` |
| Logical OR | `\|` |
| Conditional AND | `&&` |
| Conditional OR | `\|\|` |
| Null-coalescing | `??` |
| Conditional | `?:` |
| Assignment and lambda | `=` `+=` `-=` `*=` `/=` `%=` `&=` `\|=` `^=` `<<=` `>>=` `>>>=` `??=` `=>` |

Three rows produce most precedence bugs. Equality binds tighter than `&`, so `flags & Mask == 0` parses as `flags & (Mask == 0)` and fails to compile for integer flags. `??` binds looser than arithmetic, so `a ?? 0 + 1` means `a ?? (0 + 1)`. And `&&` binds tighter than `||`, so `a || b && c` means `a || (b && c)`.

**Associativity** decides grouping among operators of equal precedence. Binary operators are left-associative, so `13 / 5 / 2` is `(13 / 5) / 2`, which is `1`. Assignment, `??`, `??=`, `?:`, and lambdas are right-associative, so `x = y = 0` assigns `y` first.

**Evaluation order** is a separate rule. Whatever the grouping, operands are evaluated **left to right**. In `a() + b() * c()`, the three calls run in the order `a`, `b`, `c`, and only then does the multiplication and the addition happen. Precedence changes which results are combined, not which operand runs first, so side effects in operands happen in reading order. The exceptions are the operators that skip an operand entirely: `&&`, `||`, `??`, `??=`, `?.`, `?[]`, and `?:`.

When a grouping isn't obvious at a glance, parentheses cost nothing and remove the question.

## Key Takeaways

**Integer arithmetic has edges that don't announce themselves.** Division rounds toward zero, `%` takes the sign of the left operand, small integer types promote to `int`, and overflow wraps silently unless a checked context covers the exact code doing the arithmetic.

**`==` means what the type says it means.** Values for value types, content for `string` and records, and object identity for every other class.

**The null operators are short-circuiting operators, not shorthand.** `??`, `?.`, and null-conditional assignment each skip evaluation of their right side, which is how they avoid both the exception and the unnecessary work.

**A range copies on arrays and strings and doesn't on spans.** The syntax is identical, and the allocation difference is the whole reason to reach for a span.

**Switch expressions give the compiler something to check.** Arm order is match order, unreachable arms are errors, and unhandled inputs are warnings. That checking is the practical payoff of writing a branch as an expression.

**Precedence controls grouping, not evaluation order.** Operands still run left to right. Most grouping bugs come from three rows of the table: `==` above `&`, arithmetic above `??`, and `&&` above `||`.
