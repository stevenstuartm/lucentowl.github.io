---
title: "Testing Strategy & Architecture"
layout: guide
category: Architecture
subcategory: Quality & Risk
description: "Deciding what to test at which scope in a system with service boundaries: unit, integration, component, contract, and end-to-end tests, the pyramid versus the trophy and honeycomb shapes, consumer-driven contract testing with Pact, test doubles, property-based and mutation testing, resilience testing with injected faults, and testing in production."
tags: [practical, testing, test-pyramid, contract-testing, property-based-testing, mutation-testing, chaos-engineering]
---

A testing strategy decides what gets tested at which scope, how much of each kind of test to write, and where in the delivery pipeline each one runs. Architecture shapes those decisions more than it might seem. Where the system draws its boundaries decides which tests are cheap and which are expensive, since a call inside one process can be tested in milliseconds, while a call across a network to a service another team deploys needs either that service running or something standing in for it. A strategy that ignores the boundaries tends to end up with slow, brittle end-to-end suites that everyone waits for and nobody trusts.

## Test Scopes

Test names vary between teams, and the same word, especially "integration", covers very different tests. The taxonomy Toby Clemson set out for microservice architectures gives each scope a distinct job.

| Scope | What it exercises | Replaced by test doubles | Typical speed |
|---|---|---|---|
| **Unit** | One unit of behavior, a class or a small cluster of classes | Collaborators that do I/O | Milliseconds |
| **Integration** | Code that talks to one real external dependency, such as a repository against a real database | Nothing on the path under test | Seconds |
| **Component** | One service as a whole, through its public API | Other services and external systems it calls | Seconds |
| **Contract** | Whether a consumer's expectations of a provider's API still hold | The provider on the consumer side, the consumer on the provider side | Seconds |
| **End-to-end** | A user journey across the deployed system | Nothing, or only third-party systems | Minutes |

### Unit Tests

A unit test checks one piece of behavior with no I/O, so it runs in milliseconds and gives the same result every time. Jay Fields distinguishes **solitary** unit tests, which replace every collaborator with a test double, from **sociable** unit tests, which let the unit use its real in-memory collaborators and replace only what does I/O. Sociable tests break less often when internals are refactored, because they don't encode which class calls which.

```csharp
[Fact]
public void Adding_money_in_the_same_currency_sums_the_amounts()
{
    var total = new Money(10.00m, "USD").Add(new Money(5.00m, "USD"));

    Assert.Equal(new Money(15.00m, "USD"), total);
}

[Fact]
public void Adding_money_in_different_currencies_is_rejected()
{
    var usd = new Money(10.00m, "USD");
    var eur = new Money(5.00m, "EUR");

    Assert.Throws<InvalidOperationException>(() => usd.Add(eur));
}
```

Unit tests suit domain logic, calculations, validation rules, and state transitions, anywhere the behavior depends on inputs rather than on infrastructure. Testing observable behavior, such as return values, state, and emitted events, rather than which private methods ran keeps them useful through refactoring.

### Integration Tests

An integration test checks that code works against a real dependency, such as a repository against the actual database engine, a message consumer against a real broker, or serialization against a real schema registry. In-memory substitutes such as an in-memory database provider miss the behavior these tests exist to catch, including SQL translation, constraints, transaction isolation, and type mapping.

[Testcontainers](https://dotnet.testcontainers.org/){:target="_blank" rel="noopener noreferrer"} starts a disposable container for the dependency per test class or run, so each run gets a clean, real instance without shared test infrastructure. With xUnit v3:

```csharp
public sealed class PostgresFixture : IAsyncLifetime
{
    public PostgreSqlContainer Container { get; } = new PostgreSqlBuilder("postgres:17").Build();

    public ValueTask InitializeAsync() => new(Container.StartAsync());

    public ValueTask DisposeAsync() => Container.DisposeAsync();
}

public class OrderRepositoryTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>
{
    [Fact]
    public async Task Saved_order_loads_with_its_lines()
    {
        var options = new DbContextOptionsBuilder<OrdersDbContext>()
            .UseNpgsql(postgres.Container.GetConnectionString())
            .Options;

        var order = new OrderBuilder().WithLine("sku-1", quantity: 2, unitPrice: 10.00m).Build();

        await using (var db = new OrdersDbContext(options))
        {
            await db.Database.EnsureCreatedAsync();
            db.Orders.Add(order);
            await db.SaveChangesAsync();
        }

        // A second context forces a real read from the database, not the change tracker.
        await using (var db = new OrdersDbContext(options))
        {
            var loaded = await db.Orders.Include(o => o.Lines).SingleAsync(o => o.Id == order.Id);
            Assert.Single(loaded.Lines);
        }
    }
}
```

Integration tests stay focused when each one covers one dependency. A test that needs the database, the broker, and two other services running is an end-to-end test with a misleading name.

### Component Tests

A component test exercises one service through its public API, with the service's own code and infrastructure real and every other service replaced by a test double. It answers whether the service behaves correctly as a unit of deployment, without needing the rest of the system. In ASP.NET Core, `WebApplicationFactory` hosts the service in memory and lets the test swap the clients it uses to call other services:

```csharp
public class PlaceOrderTests(WebApplicationFactory<Program> factory)
    : IClassFixture<WebApplicationFactory<Program>>
{
    [Fact]
    public async Task Order_for_out_of_stock_item_is_rejected()
    {
        var client = factory
            .WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
                services.AddSingleton<IInventoryClient>(new FakeInventoryClient { InStock = false })))
            .CreateClient();

        var response = await client.PostAsJsonAsync("/orders", new { productId = "sku-1", quantity = 1 });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }
}
```

The service's database can be real, started with Testcontainers as above, or replaced when the component tests focus on API behavior. Component tests cover what unit tests can't see, such as routing, serialization, validation, middleware, and error mapping, and they run without deploying anything.

### End-to-End Tests

An end-to-end test drives a user journey through the deployed system, such as signing up, placing an order, and seeing it in order history. It is the only scope that proves the pieces work together as deployed, with real configuration, networking, and identity. It is also the slowest scope, the hardest to diagnose when it fails, and the most prone to intermittent failures, because every component and every network hop is a chance for something unrelated to the change to go wrong.

End-to-end tests earn their cost for a handful of journeys the business can't afford to break. Edge cases and error handling belong at lower scopes, where a failure points directly at the cause. When an end-to-end test fails intermittently, retrying it until it passes hides whatever is intermittent, which might be a real race in the system.

## Choosing a Test Shape

The shapes below describe how many tests to write at each scope. Each one reflects an assumption about where a system's defects tend to be.

| Shape | Origin | Emphasis | Fits |
|---|---|---|---|
| **Pyramid** | Mike Cohn, *Succeeding with Agile* (2009) | Many unit tests, fewer service-level tests, few UI or end-to-end tests | Systems with substantial domain logic inside each deployable |
| **Ice cream cone** | A widely used name for the inverted pyramid | Mostly manual and end-to-end tests, few unit tests | Nothing, it's the antipattern the others avoid |
| **Trophy** | Kent C. Dodds (2018) | Static analysis at the base, then mostly integration tests, fewer unit and end-to-end tests | JavaScript front ends, where components are thin and integration is where bugs appear |
| **Honeycomb** | Spotify Engineering (2018) | Mostly integration tests of each service, few tests of implementation detail, fewest integrated tests across services | Microservices whose complexity is in how they interact rather than inside them |

The pyramid's lasting advice, as Ham Vocke's "The Practical Test Pyramid" summarizes it, is to write tests at different granularities and fewer of them the higher the level. The trophy and honeycomb don't contradict that. They move the bulk of the tests to wherever the risk actually is. A service that mostly validates a request, calls two others, and stores the result has little logic for unit tests to find, and its defects sit in serialization, queries, and calls to other services. A pricing engine is the opposite case.

Two warning signs apply to any shape. If a change to internal structure breaks many tests while behavior stays the same, tests are too tied to implementation. If defects keep reaching production through paths that each test scope assumed another scope covered, the gaps between scopes are the problem, not the ratio.

## Contract Testing

In a system of independently deployed services, the riskiest change is one a provider makes to an API that a consumer depends on. End-to-end tests catch it only if both services are deployed together into a shared environment with the right versions, and only after the change is already built. Contract tests catch it earlier and without a shared environment, by checking each side of the relationship separately against a written record of what the consumer expects.

### Consumer-Driven Contracts

In consumer-driven contract testing, each consumer records the requests it makes and the parts of the response it relies on. The provider then verifies that it satisfies every consumer's recorded expectations. [Pact](https://docs.pact.io/){:target="_blank" rel="noopener noreferrer"} is a widely used tool for it, and a contract it produces is called a pact.

```
  Consumer build                                         Provider build
 ┌───────────────────────┐                          ┌──────────────────────────┐
 │ Consumer tests run    │                          │ Provider starts on a     │
 │ against a Pact mock   │                          │ real port                │
 │ provider              │                          │                          │
 │         │             │                          │ Pact replays each        │
 │         ▼             │   publish   ┌─────────┐  │ recorded request, checks │
 │ Pact file: requests   │────────────▶│  Pact   │─▶│ responses match          │
 │ made, response fields │             │ Broker  │  └────────────┬─────────────┘
 │ relied on             │             │         │◀──────────────┘
 └───────────────────────┘             └────┬────┘   publish verification result
                                            │
                                            ▼
                                   can-i-deploy check before either
                                   side releases a version
```

The consumer test defines the interaction and exercises the real client code against Pact's mock server. Matching on types rather than exact values keeps the contract from over-specifying data the consumer doesn't care about:

```csharp
public class OrderClientContractTests
{
    private readonly IPactBuilderV4 pact =
        Pact.V4("CheckoutWeb", "OrderService", new PactConfig()).WithHttpInteractions();

    [Fact]
    public async Task Gets_an_existing_order()
    {
        pact.UponReceiving("a request for an existing order")
                .Given("order 123 exists")
                .WithRequest(HttpMethod.Get, "/orders/123")
                .WithHeader("Accept", "application/json")
            .WillRespond()
                .WithStatus(HttpStatusCode.OK)
                .WithJsonBody(new
                {
                    orderId = Match.Type("123"),
                    status = Match.Type("confirmed")
                });

        await pact.VerifyAsync(async ctx =>
        {
            var client = new OrderClient(new HttpClient { BaseAddress = ctx.MockServerUri });

            var order = await client.GetOrderAsync("123");

            Assert.Equal("123", order.OrderId);
        });
    }
}
```

The provider test replays every recorded interaction against the running provider. Pact requires the provider to listen on a real TCP port rather than an in-memory test server, and a provider-state endpoint lets the test set up data such as "order 123 exists" before each interaction:

```csharp
[Fact]
public void Honours_its_consumers_contracts()
{
    using var verifier = new PactVerifier("OrderService", new PactVerifierConfig());

    verifier
        .WithHttpEndpoint(_fixture.ServerUri)
        .WithFileSource(new FileInfo(_pactPath))
        .WithProviderStateUrl(new Uri(_fixture.ServerUri, "/provider-states"))
        .Verify();
}
```

In a pipeline, the pact file comes from a Pact Broker rather than a local path, the provider publishes its verification results back, and each side runs the broker's `can-i-deploy` check before releasing a version. That check is what turns contract tests into deployment safety, since it answers whether this exact version of one service is compatible with the versions of its counterparts already in production.

### Trade-offs and Alternatives

Consumer-driven contracts work best when consumers and providers are in the same organization and the provider can see and act on consumer expectations. They add a broker to run, provider-state setup to maintain for every interaction, and a verification step in the provider's pipeline. They check the shape of interactions, not whether the provider's business logic is right, which still needs the provider's own tests.

For a public API with unknown consumers, consumer-driven contracts don't apply, and schema-based checks take their place. Comparing each OpenAPI or protobuf schema change against the previous version for breaking changes catches removed fields and changed types, though not behavioral changes that keep the schema intact. Pact also supports message contracts, which apply the same approach to events published to a broker, where the publisher is the provider and each subscriber is a consumer.

## Test Doubles

A test double stands in for a real dependency in a test. Gerard Meszaros's *xUnit Test Patterns* names five kinds, and the differences decide what a test actually proves.

| Double | What it does | Test verifies |
|---|---|---|
| **Dummy** | Fills a parameter that the code path never uses | Nothing about it |
| **Stub** | Returns canned answers to calls | The outcome, given those answers |
| **Spy** | A stub that also records how it was called | Calls, inspected after the fact |
| **Mock** | Pre-programmed with expected calls, fails if they don't happen | That specific interactions took place |
| **Fake** | A working, simplified implementation, such as an in-memory repository | The outcome, against realistic behavior |

A fake is often the most durable choice for a dependency the team owns, because tests written against it check outcomes and keep working when the code under test changes how it calls the dependency:

```csharp
public class InMemoryOrderRepository : IOrderRepository
{
    private readonly Dictionary<OrderId, Order> orders = new();

    public Task<Order?> FindAsync(OrderId id) =>
        Task.FromResult(orders.GetValueOrDefault(id));

    public Task SaveAsync(Order order)
    {
        orders[order.Id] = order;
        return Task.CompletedTask;
    }
}
```

A fake that drifts from the real implementation gives false confidence, so fakes are best paired with a shared set of tests that runs against both the fake and the real implementation. Mocks fit when the interaction is itself the behavior being specified, such as a payment being charged exactly once or an event being published. Used for everything, mocks produce tests that restate the implementation line by line and fail on every refactoring. Mocking types the team doesn't own, such as an HTTP client or a cloud SDK, tends to encode assumptions about how those types behave that are never checked. Wrapping them in a small interface the team owns, and covering the wrapper with integration tests, keeps those assumptions honest.

## Property-Based Testing

An example-based test checks one input the author thought of. A property-based test states something that should hold for all inputs, and the framework generates many inputs to try to break it. When it finds a failing input, it shrinks the input to the smallest case that still fails, so the report shows a minimal counterexample rather than a random one. In C#, [FsCheck](https://fscheck.github.io/FsCheck/){:target="_blank" rel="noopener noreferrer"} integrates with xUnit through a `[Property]` attribute, and [CsCheck](https://github.com/AnthonyLloyd/CsCheck){:target="_blank" rel="noopener noreferrer"} is a C#-first alternative.

```csharp
[Property]
public bool Adding_money_is_commutative(decimal a, decimal b)
{
    var x = new Money(a, "USD");
    var y = new Money(b, "USD");

    return x.Add(y) == y.Add(x);
}

[Property]
public bool Money_survives_a_json_round_trip(decimal amount, bool inDollars)
{
    var original = new Money(amount, inDollars ? "USD" : "EUR");

    var json = JsonSerializer.Serialize(original);

    return JsonSerializer.Deserialize<Money>(json) == original;
}
```

Generated inputs include zero, negative numbers, values with many decimal places, empty collections, and extreme values, which are the cases example-based tests tend to skip. If `Money` should reject negative amounts but the constructor accepts them, a property like these surfaces the gap quickly.

Properties that recur across domains make good starting points:

- **Round trips**: serialize then deserialize, encode then decode, and get the original back
- **Invariants**: an operation preserves something, such as a sort keeping the same elements or a transfer keeping the total balance
- **Idempotence**: applying an operation twice gives the same result as once, as for message handlers that may see redelivered messages
- **Equivalence**: a new implementation gives the same results as an old or simpler one, which suits rewrites and optimizations
- **Model-based sequences**: random sequences of operations against a stateful component match a simple model, such as a cache behaving like a dictionary

Property-based tests cost more thought to write than examples, and a property that is weaker than the real requirement passes while the code is wrong. They pay off most in parsers, serializers, financial calculations, and any code with a clear rule and a large input space.

## Mutation Testing

Code coverage shows which lines ran during tests, not whether any test would notice those lines being wrong. A test that calls a method and asserts nothing reaches full coverage of it. Mutation testing measures the second thing. A tool such as [Stryker.NET](https://stryker-mutator.io/docs/stryker-net/introduction/){:target="_blank" rel="noopener noreferrer"} makes small changes to the code, called mutants, such as turning `>` into `>=` or removing a condition, and reruns the tests against each one. A mutant that makes a test fail is killed. A mutant that survives marks behavior no test checks.

```csharp
// Original
if (quantity > 0)
    return true;

// Mutant: boundary changed
if (quantity >= 0)
    return true;
```

If every test still passes against this mutant, nothing tests a quantity of zero. The mutation score, the share of mutants killed, is a better signal of test effectiveness than coverage. Running every mutant repeats the test suite many times, so mutation testing is usually run on critical modules, on changed code in pull requests, or on a schedule rather than on every build. Some surviving mutants are equivalent, meaning they don't change behavior, and those need to be ignored rather than chased.

## Testing Architectural Characteristics

Functional tests check what the system does. Architectural characteristics such as performance, scalability, security, and resilience need their own checks, and those checks work best as automated fitness functions that run in the pipeline instead of one-off reviews. Performance and load testing verify latency and throughput against targets under realistic load. Security testing combines static analysis of code, dynamic scanning of running applications, dependency scanning, and penetration testing. Structural rules, such as which layers may reference which, can be enforced as tests over compiled code.

Resilience needs a different approach from the others, because the conditions it guards against are rare and hard to trigger on demand. Fault injection makes them happen deliberately. In .NET, Polly v8 includes chaos strategies that inject exceptions, latency, or failed results into a resilience pipeline, which lets a test confirm that the retry, timeout, and fallback configured around a call actually handle those faults:

```csharp
var pipeline = new ResiliencePipelineBuilder<HttpResponseMessage>()
    .AddRetry(new RetryStrategyOptions<HttpResponseMessage>
    {
        ShouldHandle = new PredicateBuilder<HttpResponseMessage>()
            .Handle<TimeoutRejectedException>()
            .HandleResult(r => r.StatusCode == HttpStatusCode.ServiceUnavailable),
        MaxRetryAttempts = 3,
        BackoffType = DelayBackoffType.Exponential,
        UseJitter = true
    })
    .AddTimeout(TimeSpan.FromSeconds(2))
    // Chaos strategies go last, so injected faults pass through the real resilience strategies.
    .AddChaosLatency(0.10, TimeSpan.FromSeconds(5))
    .AddChaosOutcome(0.05, () => new HttpResponseMessage(HttpStatusCode.ServiceUnavailable))
    .Build();

var response = await pipeline.ExecuteAsync(
    async ct => await httpClient.GetAsync("/inventory/sku-1", ct),
    cancellationToken);
```

Chaos strategies can be switched on per environment through their enabled settings, so the same pipeline can run with injected faults in a test environment and without them elsewhere. Resilience tests say more when they also assert on the caller's experience, such as the checkout still completing with a cached price when the pricing service is slow, not only about the strategy firing.

## Testing in Production

Pre-production environments differ from production in traffic, data, configuration, and scale, so some defects only appear there. Testing in production doesn't replace earlier testing. It adds checks that run where those differences disappear.

### Synthetic Monitoring

A synthetic monitor runs a scripted journey against production on a schedule, such as signing in, searching, and adding an item to a cart, and alerts when it fails or slows down. It detects outages on paths real users might not exercise for hours, such as a nightly signup flow in a low-traffic region. Synthetic journeys need dedicated test accounts, data that is marked and excluded from business reporting, and cleanup of anything they create. Running them from several regions separates a regional network problem from an application failure.

### Progressive Delivery and Feature Flags

A canary release sends a small share of traffic to a new version and compares its error rates, latency, and business metrics with the current version before widening the rollout. The comparison is the test, and it runs against real traffic that no staging environment reproduces.

Feature flags separate deploying code from releasing behavior. A dark launch deploys a feature switched off, then enables it for internal users first. A kill switch turns off a misbehaving feature without a redeployment. Both let a change be tested against production data with a small, controllable audience. Flags used for rollout need removing once the rollout finishes, since each one left behind doubles the code paths that need testing.

### Chaos Engineering

Chaos engineering runs controlled experiments that inject real failures into production, such as terminating instances, adding network latency, or failing a dependency, to find weaknesses before an incident does. Netflix popularized it with Chaos Monkey, and the [Principles of Chaos Engineering](https://principlesofchaos.org/){:target="_blank" rel="noopener noreferrer"} describe the discipline. An experiment starts from a hypothesis about steady-state behavior, such as orders per minute staying within normal range, introduces a real-world event, and looks for a difference between a control group and the experimental group. Keeping the blast radius small, starting with one instance or a small share of traffic, and being able to stop an experiment immediately keep the experiment from becoming the incident.

## Test Data

Tests that share data interfere with each other, and tests that depend on data someone set up by hand break when that data changes. Each test creating the data it needs, with unique identifiers, keeps tests independent and runnable in parallel. Test data builders make that cheap by supplying valid defaults, so each test states only the values it cares about:

```csharp
public class OrderBuilder
{
    private readonly CustomerId customerId = CustomerId.New();
    private readonly List<(string Sku, int Quantity, decimal UnitPrice)> lines = [];

    public OrderBuilder WithLine(string sku, int quantity, decimal unitPrice)
    {
        lines.Add((sku, quantity, unitPrice));
        return this;
    }

    public Order Build()
    {
        var order = new Order(OrderId.New(), customerId);
        foreach (var (sku, quantity, unitPrice) in lines)
            order.AddLine(sku, quantity, new Money(unitPrice, "USD"));
        return order;
    }
}
```

Production data copied into test environments is realistic but carries personal data that privacy regulations restrict, so it needs masking or anonymization before use, and the masking itself needs to preserve the distributions and edge cases that made the data useful in the first place. Generated synthetic data avoids the privacy problem and can be produced in any volume, at the cost of missing the oddities found in production data.

## Running Tests in the Pipeline

The order tests run in decides how quickly a broken change is reported. Unit tests run first because they fail fastest, followed by integration and component tests, then contract verification, with end-to-end tests and longer performance or mutation runs gated to the main branch or a schedule. Tagging tests by scope, for example with xUnit traits such as `[Trait("Category", "Integration")]`, lets each pipeline stage select only the tests it runs.

Flaky tests deserve the same urgency as failing ones. A test that fails intermittently teaches the team to rerun and ignore failures, and once that habit forms, real failures get ignored too. Quarantining a flaky test, so it runs and reports without blocking merges while someone fixes it, keeps the suite trusted without deleting the coverage.

## Common Pitfalls

- **The ice cream cone.** Most confidence comes from slow end-to-end or manual tests, so feedback takes hours and failures are hard to locate. Move checks for logic and edge cases down to scopes where they run fast and fail precisely.
- **"Integration test" meaning everything between unit and end-to-end.** Without agreed scope definitions, suites grow tests that need half the system running. Name scopes by what they replace.
- **In-memory database providers standing in for integration tests.** They pass tests that the real database would fail. Use a real engine in a container.
- **Mocking everything.** Tests restate the implementation and break on every refactoring while catching few defects. Prefer sociable tests and fakes, and reserve mocks for interactions that are the behavior.
- **End-to-end tests as the only check between services.** Contract tests catch breaking API changes before deployment, without a shared environment.
- **Retrying flaky tests until they pass.** The retry hides whatever is intermittent, which may be a real concurrency defect.
- **Coverage targets as a quality goal.** Coverage measures what ran, not what was checked. Mutation score measures what the tests would catch.
- **Testing the same behavior at every scope.** Each duplicate slows the suite and multiplies the tests to update when behavior changes. Test each behavior at the lowest scope that can observe it.

## Quick Reference

| Technique | Answers | Cost | Use for |
|---|---|---|---|
| **Unit test** | Is this logic right? | Lowest | Domain rules, calculations, state transitions |
| **Integration test** | Does this code work against the real dependency? | Moderate, needs a container | Repositories, message consumers, serialization |
| **Component test** | Does this service behave correctly through its API? | Moderate | Routing, validation, error mapping, service behavior |
| **Contract test** | Do consumer and provider still agree? | Moderate, plus a broker | APIs and events between independently deployed services |
| **End-to-end test** | Does this journey work in the deployed system? | Highest, slow and flaky | A few business-critical journeys |
| **Property-based test** | Does this rule hold for all inputs? | Thought to find good properties | Parsers, serializers, calculations, stateful components |
| **Mutation testing** | Would the tests catch a defect here? | Many test-suite runs | Critical modules, changed code |
| **Fault injection** | Do the resilience strategies handle failures? | Low in tests, higher in production | Retries, timeouts, fallbacks, degradation |
| **Synthetic monitoring** | Is this journey working in production right now? | Test accounts and data hygiene | Critical and low-traffic journeys |
| **Chaos engineering** | Does the system hold steady state under real failures? | Operational maturity and safeguards | Systems with established observability and recovery |
