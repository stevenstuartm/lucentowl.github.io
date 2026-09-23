---
title: "Unit Testing in .NET"
layout: guide
category: ".NET & C#"
subcategory: "Tooling & Quality"
description: "Writing and structuring unit tests for .NET code: how xUnit, NUnit, and MSTest differ in instance lifetime, setup, and parallelism, running them under VSTest or Microsoft.Testing.Platform, filtering and coverage, parameterized tests, test doubles and mocking with NSubstitute and Moq, testing async code, and controlling time with FakeTimeProvider."
tags: [practical, testing, xunit, nunit, mstest, test-doubles, timeprovider]
---

## What a Unit Test Is Here

A unit test runs a small piece of your code in-process, with its collaborators replaced or kept trivially cheap, and checks one behaviour. It touches no network, no real database, and no real clock, so it runs in milliseconds and gives the same result on every run. Those properties are what let a suite of thousands run on every build.

How many unit tests to write relative to integration and end-to-end tests is a question of test strategy, and belongs to architecture rather than to the mechanics here. This guide covers writing unit tests well in .NET: picking and running a framework, shaping individual tests, replacing dependencies, and handling the two things that make .NET tests flaky most often, asynchrony and time.

---

## The Shape of a Test

Most good tests follow **arrange, act, assert**: build the object under test and its inputs, call the one thing being tested, then check the outcome.

```csharp
using Xunit;

public class DiscountCalculatorTests
{
    [Fact]
    public void Orders_over_100_get_ten_percent_off()
    {
        // Arrange
        var calculator = new DiscountCalculator();

        // Act
        decimal total = calculator.Apply(orderTotal: 150m);

        // Assert
        Assert.Equal(135m, total);
    }
}
```

A few habits keep a suite readable as it grows:

- **Name the behaviour, not the method.** `Orders_over_100_get_ten_percent_off` says what broke when it fails; `ApplyTest3` doesn't.
- **One behaviour per test.** Several asserts are fine when they check one outcome from several angles. A test that acts twice and asserts twice is two tests.
- **Assert on outcomes, not on steps.** A test that checks the return value or the resulting state survives a refactor. A test that checks which private helpers were called breaks whenever the implementation is restructured, and says little about whether the result is correct.

---

## Choosing a Framework

Three frameworks dominate: [xUnit.net](https://xunit.net){:target="_blank" rel="noopener noreferrer"}, [NUnit](https://nunit.org){:target="_blank" rel="noopener noreferrer"}, and [MSTest](https://learn.microsoft.com/dotnet/core/testing/unit-testing-mstest-intro){:target="_blank" rel="noopener noreferrer"}. All three are mature, free, and supported by Visual Studio, Rider, VS Code, and `dotnet test`. They share the same core ideas under different attribute names, but they differ in three places that change how you write tests.

| | xUnit v3 | NUnit 4 | MSTest 4 |
|---|---|---|---|
| **Test** | `[Fact]` | `[Test]` | `[TestMethod]` in a `[TestClass]` |
| **Parameterized** | `[Theory]` + `[InlineData]`, `[MemberData]` | `[TestCase]`, `[TestCaseSource]` | `[DataRow]`, `[DynamicData]` |
| **Test class instance** | New instance per test | **One instance per test class, shared by all its tests** | New instance per test |
| **Per-test setup** | Constructor, `Dispose`/`DisposeAsync` | `[SetUp]`, `[TearDown]` | `[TestInitialize]`, `[TestCleanup]` |
| **Once-per-class setup** | A class fixture (`IClassFixture<T>`, below) | `[OneTimeSetUp]` | `[ClassInitialize]` (static) |
| **Parallel by default** | Test collections (by default, one per class) run in parallel; tests within one run in sequence | No; opt in with `[Parallelizable]` | No; opt in with `[assembly: Parallelize]` |
| **Assertion style** | `Assert.Equal(expected, actual)` | `Assert.That(actual, Is.EqualTo(expected))` | `Assert.AreEqual(expected, actual)` |

**Instance lifetime is the difference that bites.** xUnit and MSTest construct a fresh test class for every test, so a field set in one test is gone in the next. NUnit calls a test class a *fixture*, constructs it once, and runs all its tests on that instance, so a field one test modifies is still modified when the next test runs. A suite migrated from xUnit to NUnit can pass or fail depending on test order for that reason alone. Reset state in `[SetUp]`, or mark the fixture `[FixtureLifeCycle(LifeCycle.InstancePerTestCase)]` to get a new instance per test. Under that setting, `[OneTimeSetUp]` and `[OneTimeTearDown]` must be static, since there is no single instance to run them on.

**Parallelism exposes shared state.** xUnit's unit of parallelism is the *test collection*. Each test class is its own collection unless you group classes into a named one. Collections run in parallel with each other, and the tests inside a collection run one at a time.

{% include figure.html id="dn-xunit-parallel-lanes" %}

So out of the box, two classes that write the same static field, file, or environment variable interfere, and the failure appears only on some runs. xUnit v3 4.0 added `[assembly: Parallelization(Mode = ParallelMode.All)]`, which runs individual test cases in parallel as well, including the rows of one parameterized test. That is faster, and it also means every test, not just every class, must be independent of every other. NUnit and MSTest run sequentially until you opt in.

**Assertion styles differ, and older samples break.** NUnit 4 moved the classic `Assert.AreEqual` family to `ClassicAssert` in `NUnit.Framework.Legacy` and made the constraint model, `Assert.That(actual, Is.EqualTo(expected))`, the primary API. NUnit 4.6 exposes the classic methods on `Assert` again through C# 14 extension members, so whether an old `Assert.AreEqual` compiles depends on the package and language versions. MSTest 4 removed `[ExpectedException]`. Use `Assert.ThrowsExactly<T>` or `Assert.Throws<T>` instead.

Pick whichever your team already uses. The differences above matter more than the choice itself. For a new codebase, xUnit is a common default. The .NET runtime and ASP.NET Core repositories use xUnit, and its per-test instances and parallel-by-default classes push tests toward isolation from the start.

---

## Running Tests: VSTest and Microsoft.Testing.Platform

Two test platforms sit between `dotnet test` and your framework, and a project picks one:

- **VSTest** is the original platform. The test project builds a library, and a separate runner, `vstest.console`, loads it, discovers the tests, and runs them.
- **Microsoft.Testing.Platform (MTP)** is the newer one. The test project builds an **executable** that contains its own runner, so `dotnet run` or launching the output file runs the tests directly, with no `vstest.console` involved. xUnit v3 and MSTest can also run tests under Native AOT this way.

{% include figure.html id="dn-vstest-vs-mtp" %}

xUnit v3 projects build as executables with MTP support built in, and projects on `MSTest.Sdk` use MTP by default. NUnit uses VSTest unless you set `<EnableNUnitRunner>true</EnableNUnitRunner>` and `<OutputType>Exe</OutputType>`.

The .NET 10 SDK added a `dotnet test` mode built for MTP, and it refuses to run MTP projects through the old VSTest path. The build fails with "Testing with VSTest target is no longer supported by Microsoft.Testing.Platform on .NET 10 SDK and later." Opt in to the new mode in `global.json` at the repository root:

```json
{
  "test": {
    "runner": "Microsoft.Testing.Platform"
  }
}
```

In this mode every test project in the solution must support MTP, since a VSTest-only project is an error. So a solution either moves to MTP together or stays on VSTest together. Some command-line options also changed: `dotnet test --project MyTests.csproj` and `--solution` replace passing the path directly. The [`dotnet test` documentation](https://learn.microsoft.com/dotnet/core/testing/unit-testing-with-dotnet-test){:target="_blank" rel="noopener noreferrer"} lists the migration steps.

### Running a Subset and Measuring Coverage

Tag tests with a category, then filter on it, for example to keep slow tests out of the inner loop:

| | Tag a test | Filter under MTP |
|---|---|---|
| xUnit v3 | `[Trait("Category", "Slow")]` | `dotnet test --filter-trait "Category=Slow"` |
| NUnit | `[Category("Slow")]` | `dotnet test --filter "TestCategory=Slow"` |
| MSTest | `[TestCategory("Slow")]` | `dotnet test --filter "TestCategory=Slow"` |

The option names differ by framework, so a solution that mixes frameworks can't pass one filter to every project. xUnit also has `--filter-class` and `--filter-method` for running a single test while debugging.

Code coverage under MTP comes from an extension package. MSTest.Sdk includes Microsoft's `Microsoft.Testing.Extensions.CodeCoverage` by default, and xUnit and NUnit projects add it as a package reference. With it installed, `dotnet test --coverage` writes a coverage file per test project. [coverlet](https://github.com/coverlet-coverage/coverlet){:target="_blank" rel="noopener noreferrer"} is the long-standing open-source alternative, with packages for both VSTest and MTP. Coverage shows which lines no test executed. It doesn't show whether the tests that did run them check anything.

---

## Parameterized Tests

When the same behaviour must hold for several inputs, one parameterized test beats several copies. Each data row runs and reports as its own test case:

```csharp
[Theory]
[InlineData(50, 50)]      // under the threshold: no discount
[InlineData(100, 100)]    // at the threshold: no discount
[InlineData(150, 135)]    // over: ten percent off
public void Applies_discount_only_above_100(decimal orderTotal, decimal expected)
{
    var calculator = new DiscountCalculator();

    Assert.Equal(expected, calculator.Apply(orderTotal));
}
```

Attribute arguments must be compile-time constants, so `decimal`, `DateTime`, and objects can't appear in `[InlineData]` directly. The values above are `int` constants, and xUnit converts them to the `decimal` parameters when it runs the test. For anything that isn't a constant, supply the rows from a member:

```csharp
public static TheoryData<string, bool> ProductCodes => new()
{
    { "ABC-123", true },
    { "abc", false },
    { "", false },
};

[Theory]
[MemberData(nameof(ProductCodes))]
public void Validates_product_codes(string code, bool expected)
{
    Assert.Equal(expected, ProductCode.IsValid(code));
}
```

`TheoryData<T1, T2>` is type-checked, so a row with the wrong types fails to compile rather than failing at run time. NUnit's `[TestCaseSource]` and MSTest's `[DynamicData]` play the same role.

Boundaries are where parameterized tests pay off: just below, at, and just above each threshold, plus empty, null, and maximum inputs.

---

## Shared Setup and Fixtures

Expensive setup that tests can safely share, such as starting a container or seeding a database, goes in what xUnit calls a **class fixture**: a separate object, created once and shared by all the tests in a class. In NUnit, "fixture" means the test class itself. In xUnit it means this shared object.

```csharp
public sealed class DatabaseFixture : IAsyncLifetime
{
    public string ConnectionString { get; private set; } = "";

    public async ValueTask InitializeAsync()
    {
        ConnectionString = await StartTestDatabaseAsync();
    }

    public async ValueTask DisposeAsync()
    {
        await StopTestDatabaseAsync();
    }
}

public class OrderRepositoryTests(DatabaseFixture db, ITestOutputHelper output)
    : IClassFixture<DatabaseFixture>
{
    [Fact]
    public async Task Saves_and_reloads_an_order()
    {
        output.WriteLine($"Using {db.ConnectionString}");
        // ...
    }
}
```

xUnit creates the fixture before the first test in the class, injects it into each test's constructor, and disposes it after the last. In xUnit v3, `IAsyncLifetime` methods return `ValueTask`. `ITestOutputHelper`, also injected, is where a test writes diagnostic output, which xUnit attaches to that test's result rather than mixing into the console.

To share one fixture across several classes, define a named collection and put the classes in it:

```csharp
[CollectionDefinition("Database")]
public class DatabaseCollection : ICollectionFixture<DatabaseFixture> { }

[Collection("Database")]
public class InvoiceRepositoryTests(DatabaseFixture db) { /* ... */ }

[Collection("Database")]
public class CustomerRepositoryTests(DatabaseFixture db) { /* ... */ }
```

Classes in the same collection share the fixture, and under the default parallel mode they also stop running in parallel with each other, because a collection is one lane. Under `ParallelMode.All` they share the fixture *and* run concurrently, so a shared fixture there must be safe to use from several tests at once.

Shared fixtures trade isolation for speed. Each test must leave the fixture as it found it, or tests start depending on each other's order. A test that writes to a shared database uses its own unique keys, or runs inside a transaction it rolls back.

---

## Test Doubles

Code under test usually depends on something a unit test can't use for real: a database, an HTTP API, an email sender, the clock. A **test double** stands in for it. The names describe what the double is for:

| Double | What it does | Use it to |
|---|---|---|
| **Dummy** | Nothing; it is passed only to fill a parameter | Satisfy a constructor the test doesn't exercise |
| **Stub** | Returns canned answers | Drive the code under test down a particular path |
| **Spy** | A stub that also records the calls it received | Check afterwards that the code *told* a dependency to do something |
| **Mock** | Set up in advance with the calls it expects, and fails if they don't happen | The same check, stated before the act rather than after |
| **Fake** | A working, simplified implementation (an in-memory repository) | Exercise realistic behaviour without the real infrastructure |

The five names come from Gerard Meszaros's *xUnit Test Patterns*. .NET mocking libraries blur them. What they call a mock is usually used as a spy, configured with canned answers and checked after the act.

Doubles need a seam: the code must receive its dependency, usually through the constructor as an interface, rather than creating it. Code that calls `new SmtpClient()` or `DateTime.UtcNow` inside a method can't be replaced with an ordinary test double.

### Hand-Written Doubles First

A small interface is often easiest to double by hand, and a hand-written fake reads more clearly than mocking-library setup:

```csharp
public sealed class InMemoryOrderRepository : IOrderRepository
{
    private readonly Dictionary<int, Order> _orders = [];

    public Task SaveAsync(Order order, CancellationToken ct = default)
    {
        _orders[order.Id] = order;
        return Task.CompletedTask;
    }

    public Task<Order?> FindAsync(int id, CancellationToken ct = default) =>
        Task.FromResult(_orders.GetValueOrDefault(id));
}
```

One fake serves every test that needs a repository, and it behaves like a repository rather than like a script of expected calls. The cost is upkeep. A fake is code, and when the real implementation changes behaviour, such as starting to reject duplicate IDs, the fake keeps the old behaviour until someone updates it. Keep fakes small, and cover the real implementation with its own integration tests.

### Mocking Libraries

For interfaces with many members, or when the test needs to verify an interaction, a mocking library generates the double at run time. The three common ones are [NSubstitute](https://nsubstitute.github.io){:target="_blank" rel="noopener noreferrer"}, [Moq](https://github.com/devlooped/moq){:target="_blank" rel="noopener noreferrer"}, and [FakeItEasy](https://fakeiteasy.github.io){:target="_blank" rel="noopener noreferrer"}. They do the same job with different syntax. The examples below double these two interfaces:

```csharp
public interface ITemperatureSensor
{
    Task<double?> ReadCelsiusAsync(CancellationToken ct = default);
}

public interface IAlertSender
{
    Task SendAsync(string message, CancellationToken ct = default);
}
```

In NSubstitute:

```csharp
var sensor = Substitute.For<ITemperatureSensor>();
sensor.ReadCelsiusAsync(Arg.Any<CancellationToken>()).Returns(85.0);   // stub

var alerts = Substitute.For<IAlertSender>();

// ... act ...

await alerts.Received(1).SendAsync(                                     // verify
    Arg.Is<string>(m => m.Contains("Overheating")),
    Arg.Any<CancellationToken>());
```

The same stub and verification in Moq:

```csharp
var sensor = new Mock<ITemperatureSensor>();
sensor.Setup(s => s.ReadCelsiusAsync(It.IsAny<CancellationToken>())).ReturnsAsync(85.0);

var alerts = new Mock<IAlertSender>();
// ... act, passing sensor.Object and alerts.Object ...
alerts.Verify(a => a.SendAsync(
    It.Is<string>(m => m.Contains("Overheating")),
    It.IsAny<CancellationToken>()), Times.Once);
```

All three generate a class at run time that implements the interface or derives from the class, which sets hard limits on what they can double:

- **Interfaces work fully.** Every member can be intercepted.
- **Classes work only through virtual members.** That includes the abstract members of an abstract class, but not its concrete non-virtual ones.
- **Sealed classes can't be doubled at all.** Moq throws `NotSupportedException` ("must be an interface, a delegate, or a non-sealed, non-static class"), and NSubstitute throws a `TypeLoadException` when it tries to build the proxy.
- **Non-virtual members run the original code.** Configuring one fails loudly: Moq throws `NotSupportedException`, and NSubstitute throws `CouldNotSetReturnDueToNoLastCallException`. A non-virtual member you *didn't* configure fails silently instead. The original implementation runs, and the test exercises code you thought you had replaced.

Mocks also pull tests toward verifying interactions. A test full of `Received` and `Verify` calls re-describes the implementation and fails when it changes, even if the behaviour didn't. Verify the interactions that *are* the behaviour, such as an alert being sent or a payment being charged, and stub everything else.

### Dependencies You Don't Own

Avoid mocking types from libraries you don't control. Their behaviour is exactly what your double would have to reproduce faithfully, and a mock only reproduces your assumptions about it. Two common .NET dependencies have better seams built in:

- **`HttpClient`** takes an `HttpMessageHandler`. Pass a handler that returns a canned response and records the request, and the real `HttpClient`, its JSON extension methods, and your code all run unchanged:

```csharp
sealed class StubHandler(HttpStatusCode status, string body) : HttpMessageHandler
{
    public List<HttpRequestMessage> Requests { get; } = [];

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Requests.Add(request);
        return Task.FromResult(new HttpResponseMessage(status)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        });
    }
}

var handler = new StubHandler(HttpStatusCode.OK, """{"temperatureC":21.5}""");
var client = new HttpClient(handler) { BaseAddress = new Uri("https://api.example.com/") };
```

- **`ILogger<T>`** has a purpose-built fake. `FakeLogger<T>` from the `Microsoft.Extensions.Diagnostics.Testing` package records every entry, so a test can assert that a warning was logged without mocking the logging extension methods.

---

## Testing Asynchronous Code

Test methods that call async code are themselves async and return `Task`, and the framework awaits them. The sample passes xUnit's per-test cancellation token, described below:

```csharp
[Fact]
public async Task Throws_when_order_is_missing()
{
    var service = new OrderService(new InMemoryOrderRepository());

    await Assert.ThrowsAsync<OrderNotFoundException>(
        () => service.ShipAsync(orderId: 42, TestContext.Current.CancellationToken));
}
```

Three mistakes account for most async test bugs, and xUnit's analyzers catch all three at build time:

- **`async void` tests.** The framework can't await them, so an exception thrown after the first `await` isn't attributed to the test. xUnit v3 rejects them outright with error xUnit1049. Return `Task` or `ValueTask`.
- **An un-awaited `Assert.ThrowsAsync`.** Without `await`, the assertion's task is discarded and the test passes whether or not anything was thrown. xUnit reports it as error xUnit2021.
- **Blocking on async code with `.Result` or `.Wait()`.** It wraps failures in `AggregateException`, and under a single-threaded synchronization context, like those in UI apps and older ASP.NET, it can deadlock the test. Await instead.

xUnit v3's `TestContext.Current.CancellationToken` is cancelled when a test run is aborted or a test times out. Passing it to the code under test lets a stuck test stop promptly, and analyzer warning xUnit1051 flags calls that could take it and don't. MSTest exposes the same token as `TestContext.CancellationToken`. NUnit gives a test a token when it has a `[CancelAfter(milliseconds)]` attribute, either as a `CancellationToken` parameter on the test method or through `TestContext.CurrentContext.CancellationToken`.

---

## Controlling Time

Code that reads the clock or waits is the other main source of flaky tests. A test that sleeps for real is slow, and a test that compares against `DateTime.UtcNow` passes or fails depending on when it runs. The fix is to inject time, the same way as any other dependency.

`TimeProvider` (.NET 8) is the abstraction. Production code takes a `TimeProvider`, calls `GetUtcNow()` instead of `DateTimeOffset.UtcNow`, and passes it to the APIs that accept one: `Task.Delay(delay, timeProvider)`, `new PeriodicTimer(period, timeProvider)`, `timeProvider.CreateTimer(...)`, and `CancellationTokenSource(delay, timeProvider)`. In production it gets `TimeProvider.System`.

In tests it gets a `FakeTimeProvider` from the `Microsoft.Extensions.TimeProvider.Testing` package. Its clock stands still until the test moves it, and moving it fires any delays and timers that come due:

```csharp
using Microsoft.Extensions.Time.Testing;

public sealed class OverheatMonitor(ITemperatureSensor sensor, IAlertSender alerts, TimeProvider time)
{
    private DateTimeOffset? _hotSince;

    public async Task CheckAsync(CancellationToken ct = default)
    {
        double? celsius = await sensor.ReadCelsiusAsync(ct);
        if (celsius is null or < 80)
        {
            _hotSince = null;
            return;
        }

        _hotSince ??= time.GetUtcNow();
        if (time.GetUtcNow() - _hotSince >= TimeSpan.FromMinutes(5))
            await alerts.SendAsync($"Overheating since {_hotSince:O}", ct);
    }
}

[Fact]
public async Task Alerts_only_after_five_minutes_of_overheating()
{
    var sensor = Substitute.For<ITemperatureSensor>();
    sensor.ReadCelsiusAsync(Arg.Any<CancellationToken>()).Returns(85.0);
    var alerts = Substitute.For<IAlertSender>();
    var time = new FakeTimeProvider(new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero));
    var monitor = new OverheatMonitor(sensor, alerts, time);
    var ct = TestContext.Current.CancellationToken;

    await monitor.CheckAsync(ct);
    time.Advance(TimeSpan.FromMinutes(4));
    await monitor.CheckAsync(ct);
    await alerts.DidNotReceive().SendAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());

    time.Advance(TimeSpan.FromMinutes(1));
    await monitor.CheckAsync(ct);
    await alerts.Received(1).SendAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
}
```

The test covers five minutes of behaviour in a few milliseconds, and it gives the same answer on every run. Delays work the same way: `Task.Delay(TimeSpan.FromSeconds(30), time)` stays incomplete through `time.Advance(TimeSpan.FromSeconds(29))` and completes on the next second.

Set the start time explicitly, as above. A parameterless `FakeTimeProvider` starts at midnight UTC on 1 January 2000, which is fine for durations but misleading for anything that depends on the date, such as month-end logic or certificate expiry.

---

## Assertion Libraries

The built-in assertions are enough, and add no dependency. Fluent assertion libraries trade that for more readable failure messages and chained checks such as `total.Should().Be(135m)`.

[FluentAssertions](https://fluentassertions.com){:target="_blank" rel="noopener noreferrer"} was the long-standing choice. From version 8, released in January 2025, it is licensed commercially and requires a paid license for commercial use. Versions up to 7 remain Apache 2.0. [AwesomeAssertions](https://github.com/AwesomeAssertions/AwesomeAssertions){:target="_blank" rel="noopener noreferrer"} is a community fork that keeps the Apache 2.0 license and a nearly identical API, and [Shouldly](https://docs.shouldly.org){:target="_blank" rel="noopener noreferrer"} is a smaller alternative. Check the license of any assertion library before adding it, since a test dependency ships in every developer's build.

---

## Where Unit Tests Stop

Some behaviour can't be meaningfully unit tested, because the behaviour *is* the integration: that a SQL query returns the right rows, that middleware runs in the right order, that a serializer produces the JSON another service expects. Doubling those dependencies tests your doubles.

That is the job of integration tests, which run against real infrastructure:

- **ASP.NET Core** has `WebApplicationFactory<TEntryPoint>` in `Microsoft.AspNetCore.Mvc.Testing`, which hosts the whole application in memory and hands the test an `HttpClient` pointed at it. It is the boundary where a unit test of a handler becomes an integration test of the application.
- **Databases** belong in a real engine, usually in a container started by a class fixture. EF Core's in-memory provider is not a substitute: it doesn't enforce relational constraints or translate queries to SQL, so a query can pass against it and fail against the real database. Microsoft's EF Core guidance recommends against using it for testing.

The same framework, runner, and fixture mechanics from this guide run those tests too. What changes is what the fixture starts and how long the test takes.
