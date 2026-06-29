---
title: "Testing Strategy & Architecture"
layout: guide
category: Architecture
subcategory: Design
description: "Comprehensive guide to testing distributed systems including test strategy patterns, contract testing, property-based testing, testing architectural characteristics, and testing in production"
tags: [architecture, testing, quality, distributed-systems, reliability, practical, design-patterns]
---

## What is Testing Strategy & Architecture?

<blockquote class="pull-quote">
<p>Testing is architectural: Testing strategy impacts system design, deployment pipelines, team organization, and release velocity.</p>
</blockquote>

Testing strategy defines what to test, how to test it, and where testing fits in the development lifecycle. Testing architecture addresses how to design systems to be testable, how to organize test suites, and how to test architectural characteristics like performance, security, and resilience.

**Testing is architectural**: Testing strategy impacts system design, deployment pipelines, team organization, and release velocity. Poor testing strategy creates bottlenecks, slows delivery, and undermines confidence in releases.

## The Testing Pyramid (and Why It's Insufficient)

The classic testing pyramid suggests a distribution of test types:

```
         /\
        /  \  E2E Tests (Few)
       /----\
      /      \  Integration Tests (Some)
     /--------\
    /          \ Unit Tests (Many)
   /____________\
```

**The pyramid's core insight**: Lower-level tests are faster, cheaper, and more reliable. Prefer many fast unit tests over a few slow end-to-end tests.

<div class="callout callout--note">
<p class="callout__title">Why the Pyramid is Insufficient</p>
<p>The pyramid doesn't address contract testing (critical for microservices), doesn't cover non-functional testing (performance, security, resilience), assumes all integration tests are equally expensive, and ignores testing in production (monitoring, chaos engineering, synthetic transactions).</p>
<p><strong>Modern testing strategy requires multiple models:</strong> Use the pyramid for functional testing, but add contract testing, property-based testing, and architectural characteristic testing.</p>
</div>

## Test Types and Scope

### Unit Tests

Test individual components in isolation. Dependencies are mocked or stubbed.

**What to test**:
- Business logic in entities, value objects, and domain services
- Algorithm correctness
- Edge cases and error handling
- Validation rules

**Characteristics**:
- Fast (milliseconds)
- Isolated (no I/O, no database, no network)
- Deterministic (same inputs always produce same outputs)
- Run on every commit

**Example**:
```csharp
[Fact]
public void Money_Add_SameCurrency_ReturnsCorrectSum()
{
    // Arrange
    var money1 = new Money(10.00m, "USD");
    var money2 = new Money(5.00m, "USD");

    // Act
    var result = money1.Add(money2);

    // Assert
    Assert.Equal(15.00m, result.Amount);
    Assert.Equal("USD", result.Currency);
}

[Fact]
public void Money_Add_DifferentCurrencies_ThrowsException()
{
    // Arrange
    var usd = new Money(10.00m, "USD");
    var eur = new Money(5.00m, "EUR");

    // Act & Assert
    Assert.Throws<InvalidOperationException>(() => usd.Add(eur));
}
```

**Unit test best practices**:
- Test behavior, not implementation
- Use descriptive test names (MethodName_Scenario_ExpectedResult)
- One assertion per test (or related assertions)
- Avoid logic in tests (no conditionals, loops)
- Make tests independent (no shared state)

### Integration Tests

Test interactions between components, including databases, message queues, and external services.

**What to test**:
- Repository implementations against real databases
- Message publishing and consumption
- API endpoint responses
- Transaction boundaries

**Characteristics**:
- Slower than unit tests (seconds)
- Require infrastructure (database, message queue)
- May have side effects
- Run before merge or in CI pipeline

**Example: Repository integration test**:
```csharp
public class OrderRepositoryTests : IClassFixture<DatabaseFixture>
{
    private readonly DbContext _context;

    public OrderRepositoryTests(DatabaseFixture fixture)
    {
        _context = fixture.CreateContext();
    }

    [Fact]
    public async Task SaveAsync_NewOrder_PersistsToDatabase()
    {
        // Arrange
        var repository = new OrderRepository(_context);
        var order = new Order(OrderId.NewId(), new CustomerId(Guid.NewGuid()));
        order.AddLine(new ProductId(Guid.NewGuid()), 2, new Money(10.00m, "USD"));

        // Act
        await repository.SaveAsync(order);

        // Assert
        var retrieved = await repository.GetByIdAsync(order.Id);
        Assert.NotNull(retrieved);
        Assert.Single(retrieved.Lines);
    }
}
```

**Integration test strategies**:
- **In-memory databases**: Fast, but don't catch database-specific issues
- **Containerized databases**: Realistic, use Docker/Testcontainers
- **Shared test database**: Fast setup, but tests can interfere with each other
- **Database per test**: Isolated, but slow

**Recommendation**: Use Testcontainers for spinning up real databases in Docker. Tests are isolated and realistic without maintaining shared infrastructure.

### End-to-End (E2E) Tests

Test complete user workflows through the entire system, including UI, APIs, databases, and external services.

**What to test**:
- Critical user journeys (checkout, registration, payment)
- Cross-service workflows
- Integration with external systems

**Characteristics**:
- Slow (minutes)
- Fragile (many moving parts)
- Expensive to maintain
- Run before release or nightly

**E2E test anti-patterns**:
- Testing everything end-to-end (slow, brittle test suite)
- Using E2E tests to catch logic bugs (unit tests are faster and more precise)
- Ignoring flakiness (intermittent failures erode trust)

**E2E test best practices**:
- Keep E2E tests focused on critical paths
- Use lower-level tests for edge cases
- Implement retry logic for flaky infrastructure
- Run E2E tests in production-like environments
- Monitor and fix flaky tests immediately

### Component Tests

Test a service in isolation with dependencies stubbed or mocked. Also called "service tests."

**What to test**:
- Service API contracts
- Business logic across multiple classes
- Error handling and edge cases

**How it works**: Run the service in a test harness with fake implementations of dependencies.

```csharp
public class OrderServiceComponentTests
{
    [Fact]
    public async Task PlaceOrder_ValidRequest_ReturnsOrderId()
    {
        // Arrange
        var fakeInventory = new FakeInventoryService();
        var fakePayment = new FakePaymentService();
        var orderService = new OrderService(fakeInventory, fakePayment);

        var request = new PlaceOrderRequest
        {
            CustomerId = Guid.NewGuid(),
            Items = new[] { new OrderItem { ProductId = Guid.NewGuid(), Quantity = 1 } }
        };

        // Act
        var result = await orderService.PlaceOrderAsync(request);

        // Assert
        Assert.NotNull(result.OrderId);
        Assert.True(fakeInventory.ReservationCalled);
        Assert.True(fakePayment.ChargeCalled);
    }
}
```

**Component tests vs integration tests**: Component tests stub external dependencies. Integration tests use real dependencies. Both are valuable.

## Contract Testing

Contract testing verifies that services can communicate correctly without requiring end-to-end tests.

**The problem**: In microservices, each service has many dependencies. Testing all combinations end-to-end is slow and brittle. Contract testing verifies each relationship independently.

### Consumer-Driven Contract Testing

The consumer defines the contract it expects from the provider. The provider validates it can meet that contract.

**How it works**:

1. **Consumer writes contract**: Defines expected request/response for the API calls it makes
2. **Consumer tests against contract**: Mock provider using the contract
3. **Provider validates contract**: Verifies it can satisfy the consumer's expectations
4. **Contract stored centrally**: Published to contract repository (Pact Broker)

**Example with Pact**:

**Consumer side**:
```csharp
[Fact]
public async Task GetOrder_ExistingOrder_ReturnsOrder()
{
    // Define contract
    _mockProviderService
        .Given("Order 123 exists")
        .UponReceiving("A request for order 123")
        .With(new ProviderServiceRequest
        {
            Method = HttpVerb.Get,
            Path = "/orders/123",
            Headers = new Dictionary<string, object>
            {
                { "Accept", "application/json" }
            }
        })
        .WillRespondWith(new ProviderServiceResponse
        {
            Status = 200,
            Headers = new Dictionary<string, object>
            {
                { "Content-Type", "application/json" }
            },
            Body = new
            {
                orderId = "123",
                status = "confirmed",
                total = 99.99
            }
        });

    // Test consumer using contract
    var client = new OrderClient(_mockProviderServiceBaseUri);
    var order = await client.GetOrderAsync("123");

    Assert.Equal("123", order.OrderId);
    Assert.Equal("confirmed", order.Status);

    // Verify contract was used
    _mockProviderService.VerifyInteractions();
}
```

**Provider side**:
```csharp
[Fact]
public void EnsureOrderServiceHonorsConsumerContract()
{
    // Configure provider
    var config = new PactVerifierConfig
    {
        ProviderVersion = "1.0.0",
        PactUri = "http://pact-broker/pacts/provider/OrderService/consumer/OrderClient"
    };

    // Verify provider meets contract
    IPactVerifier verifier = new PactVerifier(config);
    verifier
        .ServiceProvider("OrderService", _serviceUri)
        .HonoursPactWith("OrderClient")
        .PactUri("http://pact-broker/pacts/provider/OrderService/consumer/OrderClient")
        .Verify();
}
```

**Benefits**:
- Fast (no need for end-to-end environment)
- Detects breaking changes before deployment
- Documents service dependencies
- Enables independent deployment

**Contract testing vs API schema validation**:
- **Schema validation**: Ensures response matches OpenAPI spec
- **Contract testing**: Ensures consumer and provider agree on behavior

Both are valuable. Schema validation catches schema drift. Contract testing catches behavioral incompatibilities.

## Property-Based Testing

Property-based testing generates random inputs and verifies that certain properties always hold true.

**Traditional example-based test**:
```csharp
[Fact]
public void Reverse_TwoElementList_ReversesOrder()
{
    var input = new List<int> { 1, 2 };
    var result = input.Reverse();
    Assert.Equal(new List<int> { 2, 1 }, result);
}
```

**Property-based test**:
```csharp
[Property]
public Property Reverse_TwiceReturnsOriginal(List<int> input)
{
    var reversed = input.Reverse().ToList();
    var reversedTwice = reversed.Reverse().ToList();

    return (input.SequenceEqual(reversedTwice))
        .ToProperty();
}
```

The framework (FsCheck, Hedgehog) generates hundreds of random lists and verifies the property holds for all of them.

**Good properties to test**:
- **Inverse operations**: `Reverse(Reverse(x)) == x`
- **Idempotence**: `Sort(Sort(x)) == Sort(x)`
- **Invariants**: `Sum(Split(x)) == x`
- **Commutativity**: `Add(a, b) == Add(b, a)`
- **Error conditions**: Invalid inputs always throw exceptions

**Example: Money addition properties**:
```csharp
[Property]
public Property Money_Add_IsCommutative(decimal a, decimal b)
{
    var money1 = new Money(a, "USD");
    var money2 = new Money(b, "USD");

    return (money1.Add(money2).Equals(money2.Add(money1)))
        .ToProperty();
}

[Property]
public Property Money_Add_IsAssociative(decimal a, decimal b, decimal c)
{
    var m1 = new Money(a, "USD");
    var m2 = new Money(b, "USD");
    var m3 = new Money(c, "USD");

    var result1 = m1.Add(m2).Add(m3);
    var result2 = m1.Add(m2.Add(m3));

    return result1.Equals(result2).ToProperty();
}
```

**When to use property-based testing**:
- Algorithms with well-defined properties
- Serialization/deserialization round-trips
- Parsers and formatters
- Stateful systems (generate sequences of operations, verify invariants)

**Property-based testing finds edge cases** you wouldn't think to test manually (empty lists, negative numbers, maximum values, special characters).

## Testing Architectural Characteristics

Architectural characteristics (performance, scalability, security, resilience) require specialized testing strategies.

### Performance Testing

Validate that the system meets performance requirements under expected load.

**Performance test types**:

| Type | Purpose | Duration | Load Pattern |
|------|---------|----------|--------------|
| **Load test** | Verify performance under expected load | Hours | Steady traffic at expected levels |
| **Stress test** | Find breaking point | Until failure | Gradually increase load until failure |
| **Spike test** | Handle sudden traffic surges | Minutes | Sudden spike in traffic |
| **Soak test** | Detect memory leaks, resource exhaustion | Days | Sustained load over extended period |

**Key metrics**:
- **Latency**: Response time (p50, p95, p99, p99.9)
- **Throughput**: Requests per second
- **Error rate**: Percentage of failed requests
- **Resource utilization**: CPU, memory, disk I/O, network I/O

**Example performance test with k6**:
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 200 },  // Ramp up to 200 users
    { duration: '5m', target: 200 },  // Stay at 200 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests < 500ms
    http_req_failed: ['rate<0.01'],    // Error rate < 1%
  },
};

export default function () {
  let response = http.get('https://api.example.com/orders');

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

**Performance testing best practices**:
- Test in production-like environments (same infrastructure, same data volumes)
- Use realistic user behavior (think time, navigation patterns)
- Monitor system metrics during tests (CPU, memory, database connections)
- Establish performance baselines and track regression
- Test performance continuously (not just before release)

### Security Testing

Validate that security controls are effective.

**Security test types**:
- **Static analysis (SAST)**: Scan code for vulnerabilities (SQL injection, XSS, hardcoded secrets)
- **Dynamic analysis (DAST)**: Test running application for vulnerabilities
- **Dependency scanning**: Check for vulnerable dependencies
- **Penetration testing**: Simulated attacks by security professionals
- **Compliance testing**: Verify adherence to security standards (OWASP, PCI-DSS)

**Automated security testing in CI/CD**:
```yaml
security-tests:
  stage: test
  script:
    # SAST - static code analysis
    - sonarqube-scan

    # Dependency scanning
    - npm audit
    - dotnet list package --vulnerable

    # DAST - running application
    - zap-baseline.py -t https://staging.example.com

    # Container scanning
    - trivy image myapp:latest
```

**Security testing best practices**:
- Automate security scans in CI/CD pipeline
- Fail builds on high-severity vulnerabilities
- Test authentication and authorization boundaries
- Validate input handling (injection attacks, buffer overflows)
- Test encryption and data protection
- Verify secrets are not exposed in logs or error messages

### Resilience Testing

Validate that the system handles failures gracefully.

**Resilience test types**:
- **Chaos engineering**: Inject failures to test recovery (kill services, introduce latency)
- **Failure mode testing**: Test specific failure scenarios (database down, dependency timeout)
- **Capacity testing**: Verify graceful degradation under overload
- **Disaster recovery testing**: Verify backup and restore procedures

**Example chaos test with Simmy (Polly chaos library)**:
```csharp
// Inject random faults into HTTP calls
var chaosPolicy = MonkeyPolicy.InjectFault(
    fault: new Exception("Simulated fault"),
    injectionRate: 0.1,  // 10% of requests fail
    enabled: () => _chaosEnabled
);

// Combine with resilience policy
var resiliencePolicy = Policy
    .Handle<Exception>()
    .WaitAndRetryAsync(3, retryAttempt =>
        TimeSpan.FromSeconds(Math.Pow(2, retryAttempt)));

var combinedPolicy = Policy.WrapAsync(resiliencePolicy, chaosPolicy);

// Execute with chaos and resilience
await combinedPolicy.ExecuteAsync(async () =>
{
    return await _httpClient.GetAsync("https://api.example.com/data");
});
```

**Chaos engineering in production**:
- Start with gameday exercises (controlled experiments)
- Gradually increase blast radius (single service → cluster → region)
- Monitor blast radius and halt experiments if impact exceeds thresholds
- Use feature flags to enable chaos in production safely

**Resilience testing validates**:
- Circuit breakers open when dependencies fail
- Retries don't overwhelm failing services
- Timeouts prevent cascading failures
- Graceful degradation maintains core functionality
- System recovers automatically when failures resolve

## Test Doubles: Mocks, Stubs, Fakes, Spies

Test doubles replace real dependencies in tests. Each type serves a different purpose.

| Type | Purpose | Verification | Example |
|------|---------|--------------|---------|
| **Stub** | Provides predetermined responses | None | Returns fixed product catalog |
| **Mock** | Verifies interactions | Asserts methods were called | Verifies email was sent |
| **Fake** | Working implementation (simplified) | Optional | In-memory database |
| **Spy** | Records interactions for later verification | Asserts on recorded calls | Logs all service calls |

**Stub example**:
```csharp
public class StubInventoryService : IInventoryService
{
    public Task<bool> IsInStockAsync(ProductId productId)
    {
        return Task.FromResult(true); // Always in stock
    }
}
```

**Mock example**:
```csharp
[Fact]
public async Task PlaceOrder_CallsInventoryService()
{
    // Arrange
    var mockInventory = new Mock<IInventoryService>();
    var orderService = new OrderService(mockInventory.Object);

    // Act
    await orderService.PlaceOrderAsync(orderId);

    // Assert
    mockInventory.Verify(i => i.ReserveAsync(It.IsAny<ProductId>(), It.IsAny<int>()),
        Times.Once);
}
```

**Fake example**:
```csharp
public class FakeOrderRepository : IOrderRepository
{
    private readonly Dictionary<OrderId, Order> _orders = new();

    public Task<Order> GetByIdAsync(OrderId orderId)
    {
        _orders.TryGetValue(orderId, out var order);
        return Task.FromResult(order);
    }

    public Task SaveAsync(Order order)
    {
        _orders[order.Id] = order;
        return Task.CompletedTask;
    }
}
```

**When to use each**:
- **Stubs**: Provide data for tests (repositories, external services)
- **Mocks**: Verify interactions (email service, event publisher)
- **Fakes**: Replace infrastructure in integration tests (in-memory database)
- **Spies**: Debug tests or verify optional behavior

**Mock overuse anti-pattern**: Tests that mock everything become brittle and test implementation instead of behavior. Prefer fakes and real collaborators when practical.

## Testing in Production

Testing doesn't stop at deployment. Production is where real usage patterns, traffic volumes, and failure modes emerge.

### Synthetic Monitoring

Continuously run automated tests against production to detect issues before users do.

**What to test**:
- Critical user journeys (login, checkout, search)
- API endpoints
- Third-party integrations

**Example synthetic monitor**:
```csharp
public class CheckoutSyntheticMonitor
{
    public async Task<HealthCheckResult> CheckAsync()
    {
        try
        {
            // Simulate checkout flow
            var client = new ApiClient(_productionUrl);

            var cart = await client.CreateCartAsync();
            await client.AddItemAsync(cart.Id, _testProductId, quantity: 1);
            var order = await client.CheckoutAsync(cart.Id, _testPaymentMethod);

            // Verify order created
            if (order.Status != "confirmed")
                return HealthCheckResult.Degraded("Checkout returned unexpected status");

            // Clean up test data
            await client.CancelOrderAsync(order.Id);

            return HealthCheckResult.Healthy("Checkout flow successful");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Checkout flow failed", ex);
        }
    }
}
```

**Synthetic monitoring best practices**:
- Use dedicated test accounts and data
- Run frequently (every 1-5 minutes)
- Alert immediately on failures
- Clean up test data to avoid pollution
- Monitor from multiple regions

### Canary Deployments

Deploy changes to a small subset of users before rolling out to everyone.

**How it works**:
1. Deploy new version to canary servers (5-10% of traffic)
2. Monitor error rates, latency, business metrics
3. If metrics are healthy, gradually increase canary percentage
4. If metrics degrade, roll back immediately

**Canary success criteria**:
- Error rate within 5% of baseline
- p95 latency within 10% of baseline
- Business metrics (conversions, revenue) stable
- No increase in support tickets

### Feature Flags for Testing in Production

Feature flags enable deploying code without enabling features, allowing gradual rollout and easy rollback.

**Testing use cases**:
- **Dark launches**: Deploy feature disabled, enable for internal users first
- **A/B testing**: Compare new feature vs old behavior
- **Ring deployments**: Enable for progressively larger user groups
- **Kill switches**: Disable feature instantly if issues arise

**Example**:
```csharp
public class OrderService
{
    private readonly IFeatureFlagService _flags;

    public async Task<Order> PlaceOrderAsync(PlaceOrderRequest request)
    {
        if (await _flags.IsEnabledAsync("new-inventory-system", request.UserId))
        {
            return await PlaceOrderWithNewInventoryAsync(request);
        }
        else
        {
            return await PlaceOrderWithLegacyInventoryAsync(request);
        }
    }
}
```

**Feature flag best practices**:
- Remove flags once feature is fully rolled out
- Monitor flag evaluation performance (caching, fallbacks)
- Use flags for risky changes, not every feature
- Distinguish long-lived flags (permissions) from short-lived flags (rollout)

## Test Data Management

Test data quality impacts test reliability and coverage.

**Test data strategies**:

**Generated test data**: Create data programmatically
- **Pros**: Controlled, isolated, fast
- **Cons**: May not represent production complexity

**Anonymized production data**: Copy and anonymize production database
- **Pros**: Realistic, exposes edge cases
- **Cons**: Privacy concerns, data size, maintenance

**Synthetic data**: Algorithmically generated realistic data
- **Pros**: Realistic patterns, no privacy issues, unlimited volume
- **Cons**: May miss real edge cases

**Test data best practices**:
- **Isolate test data**: Each test creates its own data or uses unique identifiers
- **Clean up after tests**: Delete test data to avoid pollution
- **Use data builders**: Encapsulate test data creation
- **Avoid hardcoded data**: Use factory methods or fixture files

**Test data builder example**:
```csharp
public class OrderBuilder
{
    private OrderId _id = OrderId.NewId();
    private CustomerId _customerId = new CustomerId(Guid.NewGuid());
    private List<OrderLine> _lines = new();

    public OrderBuilder WithId(OrderId id)
    {
        _id = id;
        return this;
    }

    public OrderBuilder WithCustomer(CustomerId customerId)
    {
        _customerId = customerId;
        return this;
    }

    public OrderBuilder WithLine(ProductId productId, int quantity, Money price)
    {
        _lines.Add(new OrderLine(productId, quantity, price));
        return this;
    }

    public Order Build()
    {
        var order = new Order(_id, _customerId);
        foreach (var line in _lines)
        {
            order.AddLine(line.ProductId, line.Quantity, line.UnitPrice);
        }
        return order;
    }
}

// Usage
var order = new OrderBuilder()
    .WithCustomer(customerId)
    .WithLine(productId, quantity: 2, new Money(10.00m, "USD"))
    .Build();
```

## Test Organization and Naming

Well-organized tests are easier to maintain and debug.

### Test Naming Conventions

**Pattern**: `MethodName_Scenario_ExpectedResult`

Examples:
- `Money_Add_SameCurrency_ReturnsCorrectSum`
- `Order_Confirm_EmptyOrder_ThrowsException`
- `OrderRepository_GetById_OrderNotFound_ReturnsNull`

**Alternative**: `GivenWhenThen` format
- `GivenEmptyOrder_WhenConfirm_ThenThrowsException`

### Test Organization

**Option 1: Co-locate with source**:
```
src/
  Domain/
    Order.cs
    Order.Tests.cs
```

**Option 2: Separate test project**:
```
src/
  Domain/
    Order.cs
tests/
  Domain.Tests/
    OrderTests.cs
```

**Recommendation**: Use separate test projects. Keeps production binaries free of test dependencies.

### Test Categories and Traits

Tag tests to run subsets selectively:

```csharp
[Trait("Category", "Unit")]
public class OrderTests { }

[Trait("Category", "Integration")]
[Trait("Category", "Database")]
public class OrderRepositoryTests { }
```

Run specific categories:
```bash
dotnet test --filter "Category=Unit"
dotnet test --filter "Category=Integration"
```

## Mutation Testing

Mutation testing validates test quality by introducing small changes (mutations) to code and verifying tests catch them.

**How it works**:
1. Tool mutates code (change `>` to `>=`, `&&` to `||`, remove condition)
2. Run tests against mutated code
3. If tests still pass, mutation "survived" (tests didn't catch the bug)
4. High mutation kill rate = high test quality

**Example mutation**:
```csharp
// Original
if (quantity > 0)
    return true;

// Mutated
if (quantity >= 0)  // Boundary condition changed
    return true;
```

If tests pass with this mutation, you're missing a test for `quantity == 0`.

**Mutation testing tools**:
- **Stryker.NET**: For .NET applications
- **PIT**: For Java
- **Mutmut**: For Python

**When to use mutation testing**:
- Critical business logic
- Security-sensitive code
- Complex algorithms

Mutation testing is computationally expensive. Use selectively on high-value code.

## Testing Anti-Patterns

### Ice Cream Cone (Inverted Pyramid)

More E2E tests than unit tests. Results in slow, brittle test suite.

**Solution**: Shift testing left. Push tests down to unit and integration levels.

### Test Duplication

Testing the same logic at multiple levels (unit, integration, E2E).

**Solution**: Test each behavior once at the appropriate level. Unit test logic, integration test persistence, E2E test critical workflows.

### Flaky Tests

Tests that pass or fail non-deterministically.

**Common causes**:
- Race conditions and timing issues
- Shared state between tests
- Dependency on external services
- Environment-specific assumptions

**Solution**: Fix flaky tests immediately. Flaky tests erode confidence and waste developer time.

### Testing Implementation Details

Tests that break when refactoring internals without changing behavior.

**Problem**:
```csharp
// Test knows about internal cache
[Fact]
public void GetProduct_CachesResult()
{
    var service = new ProductService();
    service.GetProduct(productId);

    Assert.True(service.Cache.Contains(productId)); // Brittle!
}
```

**Solution**: Test observable behavior, not implementation.
```csharp
[Fact]
public void GetProduct_CalledTwice_QueriesDatabaseOnce()
{
    var mockRepo = new Mock<IProductRepository>();
    var service = new ProductService(mockRepo.Object);

    service.GetProduct(productId);
    service.GetProduct(productId);

    mockRepo.Verify(r => r.GetById(productId), Times.Once);
}
```

### 100% Code Coverage Fallacy

Code coverage measures lines executed, not quality of tests.

**Reality**: 100% coverage doesn't guarantee correct behavior. You can have high coverage with meaningless assertions.

**Better metric**: Mutation test score (percentage of mutations killed).

## Test Automation Strategy

### Continuous Integration (CI)

Run tests on every commit to detect issues early.

**CI test stages**:
```yaml
stages:
  - build
  - test
  - integration-test
  - deploy

unit-tests:
  stage: test
  script:
    - dotnet test --filter "Category=Unit"
  artifacts:
    reports:
      junit: test-results.xml

integration-tests:
  stage: integration-test
  services:
    - postgres:14
  script:
    - dotnet test --filter "Category=Integration"

performance-tests:
  stage: integration-test
  script:
    - k6 run load-test.js
  only:
    - main
```

**CI best practices**:
- Fast feedback (fail fast on unit tests before running slow integration tests)
- Parallel execution where possible
- Cache dependencies to speed up builds
- Report test results and coverage
- Block merges on test failures

### Test Environments

**Development**: Local machine, fast feedback, isolated
**CI**: Automated pipeline, every commit, containerized dependencies
**Staging**: Production-like, integration testing, manual QA
**Production**: Real users, synthetic monitoring, canary deployments

**Environment parity**: Staging should match production (same infrastructure, configurations, data volumes) to catch environment-specific issues.

## Key Takeaways

**Testing is architectural**: Test strategy impacts system design. Design for testability from the start (dependency injection, interfaces, small aggregates).

**Use the right test for the job**: Unit tests for logic, integration tests for persistence, contract tests for service boundaries, E2E tests for critical workflows.

**Contract testing prevents integration failures**: In microservices, contract testing catches breaking changes faster and cheaper than E2E tests.

**Test architectural characteristics**: Performance, security, and resilience testing are as important as functional testing.

**Testing doesn't stop at deployment**: Use synthetic monitoring, canary deployments, and feature flags to test in production safely.

**Avoid flaky tests**: Flaky tests waste time and erode trust. Fix them immediately or delete them.

**Test behavior, not implementation**: Tests should validate what the system does, not how it does it.

**Property-based testing finds edge cases**: Generating random inputs exposes bugs you wouldn't think to test manually.

**Mutation testing validates test quality**: High code coverage doesn't mean good tests. Mutation testing measures whether tests actually catch bugs.

**Automate everything**: Manual testing doesn't scale. Invest in automated testing at all levels and run tests continuously in CI/CD pipelines.
