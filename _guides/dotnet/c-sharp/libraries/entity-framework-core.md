---
title: "Entity Framework Core"
layout: guide
category: ".NET & C#"
subcategory: "Core Libraries"
description: "Entity Framework Core fundamentals including DbContext, queries, relationships, migrations, and performance best practices."
tags: [c-sharp, dotnet, entity-framework, orm, database, data-access, practical]
---

## What is Entity Framework Core

Entity Framework Core (EF Core) is an object-relational mapper (ORM) that enables .NET developers to work with databases using .NET objects. It eliminates most data-access code that developers typically need to write.

```csharp
// Traditional SQL
var sql = "SELECT * FROM Customers WHERE Country = @Country";
var customers = connection.Query<Customer>(sql, new { Country = "USA" });

// EF Core - type-safe, refactor-friendly
var customers = await context.Customers
    .Where(c => c.Country == "USA")
    .ToListAsync();
```

## DbContext

The `DbContext` is the primary class for interacting with the database.

### Basic DbContext

```csharp
public class ApplicationDbContext : DbContext
{
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<Product> Products => Set<Product>();

    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Configure entities
        modelBuilder.Entity<Customer>(entity =>
        {
            entity.HasKey(c => c.Id);
            entity.Property(c => c.Name).IsRequired().HasMaxLength(100);
            entity.HasIndex(c => c.Email).IsUnique();
        });
    }
}
```

### Registration (Dependency Injection)

```csharp
// Program.cs or Startup.cs
services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(connectionString));

// With additional configuration
services.AddDbContext<ApplicationDbContext>(options =>
{
    options.UseSqlServer(connectionString, sqlOptions =>
    {
        sqlOptions.EnableRetryOnFailure(3);
        sqlOptions.CommandTimeout(30);
    });

    if (environment.IsDevelopment())
    {
        options.EnableSensitiveDataLogging();
        options.EnableDetailedErrors();
    }
});
```

### DbContext Lifetime

A `DbContext` is designed to be short-lived. Each instance tracks every entity it retrieves, accumulating memory and making `SaveChanges` slower over time. The default DI registration with `AddDbContext` creates a scoped instance, meaning one context per HTTP request in ASP.NET Core. This is the right default for most applications because a single request typically represents a single unit of work.

```csharp
// Scoped lifetime (default) - one context per request
services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(connectionString));
```

Never register a `DbContext` as singleton. A singleton context would accumulate tracked entities for the lifetime of the application, leak memory, and cause concurrency issues since `DbContext` is not thread-safe. Transient registration works but creates more instances than necessary and prevents EF from reusing internal service providers.

### DbContext Pooling

Creating a `DbContext` involves setting up internal services, compiling the model, and allocating tracking structures. For high-throughput applications, this initialization cost adds up. Context pooling addresses this by maintaining a pool of pre-initialized context instances that are reset and reused rather than created from scratch.

```csharp
// Enable context pooling
services.AddDbContextPool<ApplicationDbContext>(options =>
    options.UseSqlServer(connectionString),
    poolSize: 1024); // Default is 1024
```

When a pooled context is returned to the pool, EF Core resets its change tracker and state so the next consumer receives a clean instance. The internal service provider and compiled model are preserved, which is where the performance gain comes from.

**When pooling helps**: Applications that create and dispose many context instances per second, such as high-traffic APIs handling thousands of requests concurrently. Benchmarks from the EF Core team show pooling can improve throughput in these scenarios.

**When pooling doesn't help**: Applications with low request volume or long-lived operations where context creation cost is negligible compared to actual query time. Pooling also adds constraints because the context constructor cannot accept per-request state through dependency injection, since pooled instances are shared across requests.

```csharp
// This works with AddDbContext but NOT with AddDbContextPool
public class ApplicationDbContext : DbContext
{
    private readonly ITenantProvider _tenantProvider; // Per-request service

    public ApplicationDbContext(
        DbContextOptions<ApplicationDbContext> options,
        ITenantProvider tenantProvider) // Injected per request
        : base(options)
    {
        _tenantProvider = tenantProvider; // Won't work with pooling
    }
}
```

To use per-request services with pooling, configure them in `OnConfiguring` by resolving from the service provider, or use `AddPooledDbContextFactory` and inject the factory instead.

### DbContext Factory

`IDbContextFactory<T>` creates context instances on demand rather than relying on DI scope lifetime. This is necessary in scenarios where no DI scope exists or where you need explicit control over context lifetime.

```csharp
// Register the factory
services.AddDbContextFactory<ApplicationDbContext>(options =>
    options.UseSqlServer(connectionString));

// Or pooled factory (combines pooling with factory pattern)
services.AddPooledDbContextFactory<ApplicationDbContext>(options =>
    options.UseSqlServer(connectionString));
```

```csharp
// Usage - caller controls the lifetime
public class OrderProcessor
{
    private readonly IDbContextFactory<ApplicationDbContext> _factory;

    public OrderProcessor(IDbContextFactory<ApplicationDbContext> factory)
    {
        _factory = factory;
    }

    public async Task ProcessBatchAsync(IEnumerable<OrderRequest> requests)
    {
        foreach (var batch in requests.Chunk(100))
        {
            // Fresh context per batch keeps change tracker lean
            await using var context = await _factory.CreateDbContextAsync();

            foreach (var request in batch)
            {
                context.Orders.Add(MapToOrder(request));
            }

            await context.SaveChangesAsync();
        }
    }
}
```

Common scenarios that require a factory:

- **Blazor Server**: Components outlive any single DI scope, so injecting a scoped `DbContext` causes lifetime mismatch. Inject `IDbContextFactory` and create short-lived contexts per operation.
- **Background services**: `IHostedService` and `BackgroundService` run as singletons. Without a factory, you would need to manually create and manage `IServiceScope` instances.
- **Parallel operations**: Since `DbContext` is not thread-safe, concurrent work requires separate context instances. A factory lets each task create its own.

### Multiple Context Types

When an application needs multiple databases or distinct bounded contexts, register each with its own options.

```csharp
public class OrderDbContext : DbContext
{
    public DbSet<Order> Orders => Set<Order>();
    public OrderDbContext(DbContextOptions<OrderDbContext> options) : base(options) { }
}

public class ReportingDbContext : DbContext
{
    public DbSet<SalesReport> Reports => Set<SalesReport>();
    public ReportingDbContext(DbContextOptions<ReportingDbContext> options) : base(options) { }
}

// Registration
services.AddDbContext<OrderDbContext>(options =>
    options.UseSqlServer(orderConnectionString));

services.AddDbContextPool<ReportingDbContext>(options =>
    options.UseSqlServer(reportingConnectionString,
        sqlOptions => sqlOptions.UseQuerySplittingBehavior(
            QuerySplittingBehavior.SplitQuery)));
```

Each context type has its own pool (if pooling is enabled), its own connection string, and its own model. This separation keeps bounded contexts independent and allows different configuration per context, such as pooling for high-throughput reads on the reporting context while using standard scoped lifetime for the transactional order context.

### Read-Only vs. Read-Write Contexts

A more disciplined variation of multiple context types is splitting read and write responsibilities at the context level. The read-only context disables both change tracking and lazy loading since it never persists changes. The read-write context keeps change tracking enabled (it needs it for `SaveChanges`) but still disables lazy loading so that related data is always loaded explicitly through `.Include()`.

```csharp
public class ReadOnlyDbContext : DbContext
{
    public ReadOnlyDbContext(DbContextOptions<ReadOnlyDbContext> options)
        : base(options)
    {
        ChangeTracker.QueryTrackingBehavior = QueryTrackingBehavior.NoTracking;
        ChangeTracker.LazyLoadingEnabled = false;
    }

    public IQueryable<Customer> Customers => Set<Customer>().AsNoTracking();
    public IQueryable<Order> Orders => Set<Order>().AsNoTracking();

    // Prevent accidental writes
    public override int SaveChanges()
        => throw new InvalidOperationException("This context is read-only.");

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        => throw new InvalidOperationException("This context is read-only.");

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ReadOnlyDbContext).Assembly);
    }
}

public class ReadWriteDbContext : DbContext
{
    public ReadWriteDbContext(DbContextOptions<ReadWriteDbContext> options)
        : base(options)
    {
        ChangeTracker.LazyLoadingEnabled = false;
    }

    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Order> Orders => Set<Order>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ReadWriteDbContext).Assembly);
    }
}
```

```csharp
// Registration - can point to the same database or use read replicas
services.AddDbContextPool<ReadOnlyDbContext>(options =>
    options.UseSqlServer(readConnectionString));

services.AddDbContext<ReadWriteDbContext>(options =>
    options.UseSqlServer(writeConnectionString));
```

Both contexts disable lazy loading. The difference is that the read-only context also disables change tracking and exposes `IQueryable<T>` instead of `DbSet<T>` to reinforce the read-only intent. Overriding `SaveChanges` to throw prevents accidental writes from slipping through during development.

This pattern pairs well with CQRS-style architectures where queries and commands follow different paths. The read-only context can point to a read replica for horizontal scaling while the read-write context targets the primary database. Even when both point to the same database, the separation makes intent explicit at the injection site: a service that receives `ReadOnlyDbContext` cannot accidentally modify data.

## Entity Configuration

EF Core provides three ways to configure your model, listed here in order of precedence (highest to lowest):

1. **Fluent API**: Configuration in `OnModelCreating` or `IEntityTypeConfiguration<T>` classes
2. **Data Annotations**: Attributes applied directly to entity classes
3. **Conventions**: Automatic rules EF Core applies by default

When configurations conflict, higher precedence wins. For example, a Fluent API configuration overrides any Data Annotation on the same property.

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Fluent API (Recommended)</h4>
<ul>
<li>Keeps domain models clean (POCOs)</li>
<li>More powerful (filtered indexes, cascade behavior)</li>
<li>Centralized configuration</li>
<li>Configuration classes can be unit tested</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Data Annotations</h4>
<ul>
<li>Dual-purpose validation (EF + ASP.NET)</li>
<li>Self-documenting entities</li>
<li>Less boilerplate for simple scenarios</li>
<li>Suitable for prototypes and simple CRUD apps</li>
</ul>
</div>
</div>

### Why Fluent API is Recommended

Microsoft recommends Fluent API as the primary configuration approach for several reasons:

**Keeps domain models clean**: Entity classes remain plain C# objects (POCOs) without infrastructure attributes. This matters when your domain layer shouldn't depend on EF Core or when the same classes are used across multiple contexts.

**More powerful**: Fluent API supports configurations that Data Annotations cannot express, including filtered indexes, cascade delete behavior, inheritance mapping strategies, and complex relationship configurations.

**Centralized configuration**: All database mapping lives in one place rather than scattered across entity classes. This makes it easier to review, modify, and understand the complete data model.

**Testability**: Configuration classes can be unit tested independently of the entities they configure.

### When Data Annotations Make Sense

Data Annotations still have valid uses:

**Dual-purpose validation**: Attributes like `[Required]` and `[MaxLength]` work with both EF Core and ASP.NET model validation. If you need the same constraint enforced at both layers, annotations avoid duplication.

**Self-documenting entities**: Seeing `[MaxLength(100)]` directly on a property communicates the constraint without looking elsewhere. This can help when entities are shared across teams.

**Simple scenarios**: For quick prototypes or straightforward CRUD applications where architectural purity isn't a priority, annotations reduce boilerplate.

### Data Annotations

```csharp
public class Customer
{
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = "";

    [EmailAddress]
    public string? Email { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal CreditLimit { get; set; }

    [NotMapped]
    public string DisplayName => $"{Name} ({Email})";
}
```

### Fluent API

```csharp
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    modelBuilder.Entity<Customer>(entity =>
    {
        entity.ToTable("Customers");
        entity.HasKey(c => c.Id);

        entity.Property(c => c.Name)
            .IsRequired()
            .HasMaxLength(100);

        entity.Property(c => c.Email)
            .HasMaxLength(255);

        entity.Property(c => c.CreditLimit)
            .HasPrecision(18, 2);

        entity.HasIndex(c => c.Email)
            .IsUnique()
            .HasFilter("[Email] IS NOT NULL");

        entity.Ignore(c => c.DisplayName);
    });
}
```

### Entity Type Configuration Classes

```csharp
public class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> builder)
    {
        builder.ToTable("Customers");
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Name).IsRequired().HasMaxLength(100);
        builder.HasIndex(c => c.Email).IsUnique();
    }
}

// In OnModelCreating
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    modelBuilder.ApplyConfiguration(new CustomerConfiguration());

    // Or apply all configurations from assembly
    modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
}
```

## Relationships

### One-to-Many

```csharp
public class Customer
{
    public int Id { get; set; }
    public string Name { get; set; }

    // Navigation property
    public ICollection<Order> Orders { get; set; } = new List<Order>();
}

public class Order
{
    public int Id { get; set; }
    public DateTime OrderDate { get; set; }

    // Foreign key
    public int CustomerId { get; set; }

    // Navigation property
    public Customer Customer { get; set; } = null!;
}

// Configuration
modelBuilder.Entity<Order>()
    .HasOne(o => o.Customer)
    .WithMany(c => c.Orders)
    .HasForeignKey(o => o.CustomerId)
    .OnDelete(DeleteBehavior.Cascade);
```

### One-to-One

```csharp
public class Customer
{
    public int Id { get; set; }
    public CustomerAddress? Address { get; set; }
}

public class CustomerAddress
{
    public int Id { get; set; }
    public string Street { get; set; }
    public int CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
}

// Configuration
modelBuilder.Entity<Customer>()
    .HasOne(c => c.Address)
    .WithOne(a => a.Customer)
    .HasForeignKey<CustomerAddress>(a => a.CustomerId);
```

### Many-to-Many

```csharp
public class Student
{
    public int Id { get; set; }
    public string Name { get; set; }
    public ICollection<Course> Courses { get; set; } = new List<Course>();
}

public class Course
{
    public int Id { get; set; }
    public string Title { get; set; }
    public ICollection<Student> Students { get; set; } = new List<Student>();
}

// EF Core 5+ automatically creates join table
// Or explicit join entity:
public class StudentCourse
{
    public int StudentId { get; set; }
    public Student Student { get; set; } = null!;
    public int CourseId { get; set; }
    public Course Course { get; set; } = null!;
    public DateTime EnrollmentDate { get; set; }
}
```

## Querying Data

### Basic Queries

```csharp
// Get all
var customers = await context.Customers.ToListAsync();

// Filter
var activeCustomers = await context.Customers
    .Where(c => c.IsActive)
    .ToListAsync();

// Find by primary key (cached if already tracked)
var customer = await context.Customers.FindAsync(id);

// Single result
var customer = await context.Customers
    .FirstOrDefaultAsync(c => c.Email == email);

// Projection
var names = await context.Customers
    .Select(c => c.Name)
    .ToListAsync();

// Anonymous type projection
var summaries = await context.Customers
    .Select(c => new { c.Id, c.Name, OrderCount = c.Orders.Count })
    .ToListAsync();
```

### Loading Related Data

```csharp
// Eager loading - single query with JOIN
var customers = await context.Customers
    .Include(c => c.Orders)
    .ThenInclude(o => o.OrderItems)
    .ToListAsync();

// Filtered include (EF Core 5+)
var customers = await context.Customers
    .Include(c => c.Orders.Where(o => o.Status == OrderStatus.Active))
    .ToListAsync();

// Explicit loading
var customer = await context.Customers.FindAsync(id);
await context.Entry(customer)
    .Collection(c => c.Orders)
    .LoadAsync();

// Lazy loading - AVOID
// Requires Microsoft.EntityFrameworkCore.Proxies and UseLazyLoadingProxies()
// Navigation properties silently issue queries when accessed, causing N+1 problems
// that are difficult to detect in code review and only surface under load
```

### Why Lazy Loading Should Be Avoided

Lazy loading makes every navigation property access a potential database round-trip. The danger is that the code reads like simple property access while silently generating queries behind the scenes.

```csharp
// This looks harmless but generates N+1 queries with lazy loading enabled
var customers = await context.Customers.ToListAsync();
foreach (var customer in customers)
{
    // With lazy loading: each access to Orders triggers a SELECT
    Console.WriteLine($"{customer.Name}: {customer.Orders.Count} orders");
}
```

The performance impact is invisible at small scale. A loop over 10 customers produces 11 queries, which runs fine in development. The same code with 10,000 customers produces 10,001 queries and brings the application to its knees in production.

Lazy loading also creates coupling between your data access layer and the code that consumes entities. Any code path that touches a navigation property needs to know whether the data was loaded, making it harder to reason about performance and harder to test.

**Prefer explicit loading strategies instead**:

- **Eager loading with `.Include()`**: Declare upfront which relationships you need. The query is predictable and the SQL is visible in logs.
- **Projection with `.Select()`**: Load only the data you need into DTOs. This avoids loading full entity graphs entirely.
- **Explicit loading with `.LoadAsync()`**: For cases where you conditionally need related data after the initial query, explicit loading makes the database call visible in code.

```csharp
// Eager loading - predictable, single query
var customers = await context.Customers
    .Include(c => c.Orders)
    .ToListAsync();

// Projection - only loads what's needed, no tracking overhead
var summaries = await context.Customers
    .Select(c => new { c.Name, OrderCount = c.Orders.Count })
    .ToListAsync();

// Explicit loading - visible database call when conditionally needed
var customer = await context.Customers.FindAsync(id);
if (needOrders)
{
    await context.Entry(customer)
        .Collection(c => c.Orders)
        .LoadAsync();
}
```

If you inherit a codebase that uses lazy loading, avoid enabling `UseLazyLoadingProxies()` when registering new contexts. Instead, audit query patterns and migrate to explicit `.Include()` calls or projections as you encounter N+1 issues.

### Pagination

```csharp
public async Task<PagedResult<Customer>> GetPagedAsync(int page, int pageSize)
{
    var query = context.Customers.AsQueryable();

    var totalCount = await query.CountAsync();
    var items = await query
        .OrderBy(c => c.Name)
        .Skip((page - 1) * pageSize)
        .Take(pageSize)
        .ToListAsync();

    return new PagedResult<Customer>
    {
        Items = items,
        TotalCount = totalCount,
        Page = page,
        PageSize = pageSize
    };
}
```

### Raw SQL

```csharp
// Query with FromSqlRaw
var customers = await context.Customers
    .FromSqlRaw("SELECT * FROM Customers WHERE Country = {0}", country)
    .ToListAsync();

// Interpolated (parameterized)
var customers = await context.Customers
    .FromSqlInterpolated($"SELECT * FROM Customers WHERE Country = {country}")
    .ToListAsync();

// Non-query execution
await context.Database.ExecuteSqlRawAsync(
    "UPDATE Customers SET IsActive = 0 WHERE LastOrderDate < {0}",
    cutoffDate);
```

## Saving Data

### Adding Entities

```csharp
// Single entity
var customer = new Customer { Name = "Alice", Email = "alice@example.com" };
context.Customers.Add(customer);
await context.SaveChangesAsync();

// Multiple entities
var customers = new List<Customer>
{
    new() { Name = "Bob" },
    new() { Name = "Charlie" }
};
context.Customers.AddRange(customers);
await context.SaveChangesAsync();

// With related entities
var order = new Order
{
    Customer = new Customer { Name = "Alice" },
    Items = new List<OrderItem>
    {
        new() { ProductId = 1, Quantity = 2 }
    }
};
context.Orders.Add(order);
await context.SaveChangesAsync();
```

### Updating Entities

```csharp
// Tracked entity
var customer = await context.Customers.FindAsync(id);
customer.Name = "Updated Name";
await context.SaveChangesAsync();

// Disconnected entity
public async Task UpdateCustomerAsync(Customer customer)
{
    context.Customers.Update(customer);
    await context.SaveChangesAsync();
}

// Partial update
var customer = await context.Customers.FindAsync(id);
context.Entry(customer).Property(c => c.Name).IsModified = true;
await context.SaveChangesAsync();

// ExecuteUpdate (EF Core 7+) - bulk update without loading
await context.Customers
    .Where(c => c.IsActive == false)
    .ExecuteUpdateAsync(s => s
        .SetProperty(c => c.Status, "Archived")
        .SetProperty(c => c.ArchivedAt, DateTime.UtcNow));
```

### Deleting Entities

```csharp
// Tracked entity
var customer = await context.Customers.FindAsync(id);
context.Customers.Remove(customer);
await context.SaveChangesAsync();

// Without loading
var customer = new Customer { Id = id };
context.Customers.Remove(customer);
await context.SaveChangesAsync();

// ExecuteDelete (EF Core 7+) - bulk delete without loading
await context.Customers
    .Where(c => c.LastOrderDate < cutoffDate)
    .ExecuteDeleteAsync();
```

## Transactions

```csharp
// Implicit transaction (SaveChanges is transactional)
context.Customers.Add(new Customer { Name = "Alice" });
context.Orders.Add(new Order { CustomerId = 1 });
await context.SaveChangesAsync(); // Both or neither

// Explicit transaction
using var transaction = await context.Database.BeginTransactionAsync();
try
{
    var customer = new Customer { Name = "Alice" };
    context.Customers.Add(customer);
    await context.SaveChangesAsync();

    var order = new Order { CustomerId = customer.Id };
    context.Orders.Add(order);
    await context.SaveChangesAsync();

    await transaction.CommitAsync();
}
catch
{
    await transaction.RollbackAsync();
    throw;
}

// Transaction with execution strategy (for retries)
var strategy = context.Database.CreateExecutionStrategy();
await strategy.ExecuteAsync(async () =>
{
    using var transaction = await context.Database.BeginTransactionAsync();
    // ... operations
    await transaction.CommitAsync();
});
```

## Migrations

### Creating Migrations

```bash
# Create migration
dotnet ef migrations add InitialCreate

# With specific context
dotnet ef migrations add AddCustomerEmail -c ApplicationDbContext

# Generate SQL script
dotnet ef migrations script

# Apply migrations
dotnet ef database update
```

### Migration in Code

```csharp
// Apply pending migrations at startup
using var scope = app.Services.CreateScope();
var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
await context.Database.MigrateAsync();

// Or ensure database exists
await context.Database.EnsureCreatedAsync();
```

### Custom Migration Operations

```csharp
public partial class AddFullTextIndex : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"
            CREATE FULLTEXT INDEX ON Products(Name, Description)
            KEY INDEX PK_Products");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("DROP FULLTEXT INDEX ON Products");
    }
}
```

## Performance Best Practices

### No-Tracking Queries

```csharp
// When you don't need to modify entities
var customers = await context.Customers
    .AsNoTracking()
    .Where(c => c.IsActive)
    .ToListAsync();

// Global no-tracking
services.AddDbContext<ApplicationDbContext>(options =>
    options.UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking)
           .UseSqlServer(connectionString));
```

### Split Queries

```csharp
// Single query with Include can have Cartesian explosion
// Split into multiple queries
var customers = await context.Customers
    .Include(c => c.Orders)
    .ThenInclude(o => o.Items)
    .AsSplitQuery() // Generates multiple SQL queries
    .ToListAsync();

// Global split query behavior
modelBuilder.Entity<Customer>()
    .Navigation(c => c.Orders)
    .AutoInclude()
    .UsePropertyAccessMode(PropertyAccessMode.Property);
```

### Select Only What You Need

```csharp
// BAD - loads entire entity
var emails = await context.Customers
    .ToListAsync()
    .Select(c => c.Email);

// GOOD - SQL only selects Email
var emails = await context.Customers
    .Select(c => c.Email)
    .ToListAsync();

// DTO projection
var dtos = await context.Customers
    .Select(c => new CustomerDto
    {
        Id = c.Id,
        Name = c.Name,
        OrderCount = c.Orders.Count
    })
    .ToListAsync();
```

### Compiled Queries

```csharp
private static readonly Func<ApplicationDbContext, int, Task<Customer?>> GetCustomerById =
    EF.CompileAsyncQuery((ApplicationDbContext context, int id) =>
        context.Customers.FirstOrDefault(c => c.Id == id));

// Usage
var customer = await GetCustomerById(context, customerId);
```

### Avoid N+1 Problems

<div class="comparison">
<div class="content-card content-card--accent">
<h4>N+1 Problem (Bad)</h4>
<pre><code>// Triggers N+1 queries
var customers = await context.Customers
    .ToListAsync();
foreach (var customer in customers)
{
    // Each iteration = 1 query
    var orders = customer.Orders.ToList();
}</code></pre>
<p>Results in 1 query for customers + N queries for orders (one per customer).</p>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Eager Loading (Good)</h4>
<pre><code>// Single query with JOIN
var customers = await context.Customers
    .Include(c => c.Orders)
    .ToListAsync();</code></pre>
<p>Results in 1 query that joins customers with orders.</p>
</div>
</div>

```csharp
// BAD - N+1 queries
var customers = await context.Customers.ToListAsync();
foreach (var customer in customers)
{
    // Each iteration triggers a query
    var orders = customer.Orders.ToList();
}

// GOOD - Single query with Include
var customers = await context.Customers
    .Include(c => c.Orders)
    .ToListAsync();

// Or explicit projection
var customerOrders = await context.Customers
    .Select(c => new
    {
        Customer = c,
        Orders = c.Orders.ToList()
    })
    .ToListAsync();
```

## Concurrency

```csharp
public class Product
{
    public int Id { get; set; }
    public string Name { get; set; }
    public int Stock { get; set; }

    [Timestamp]
    public byte[] RowVersion { get; set; } = null!;
}

// Handling concurrency conflicts
try
{
    await context.SaveChangesAsync();
}
catch (DbUpdateConcurrencyException ex)
{
    foreach (var entry in ex.Entries)
    {
        var proposedValues = entry.CurrentValues;
        var databaseValues = await entry.GetDatabaseValuesAsync();

        // Client wins
        entry.OriginalValues.SetValues(databaseValues);

        // Or database wins
        entry.Reload();
    }
}
```

## Value Conversions

```csharp
modelBuilder.Entity<Order>()
    .Property(o => o.Status)
    .HasConversion(
        v => v.ToString(),           // To database
        v => Enum.Parse<OrderStatus>(v)); // From database

// Built-in converters
modelBuilder.Entity<Customer>()
    .Property(c => c.Tags)
    .HasConversion(
        v => JsonSerializer.Serialize(v, default(JsonSerializerOptions)),
        v => JsonSerializer.Deserialize<List<string>>(v, default(JsonSerializerOptions))!);

// Reusable converter
public class JsonValueConverter<T> : ValueConverter<T, string>
{
    public JsonValueConverter()
        : base(
            v => JsonSerializer.Serialize(v, default(JsonSerializerOptions)),
            v => JsonSerializer.Deserialize<T>(v, default(JsonSerializerOptions))!)
    {
    }
}
```

## Key Takeaways

**Keep DbContext instances short-lived**: A context accumulates tracked entities over time. One context per request (scoped lifetime) is the right default for web applications.

**Use pooling for high-throughput scenarios**: `AddDbContextPool` reuses context instances to avoid repeated initialization cost, but be aware that pooled contexts cannot accept per-request constructor dependencies.

**Use IDbContextFactory when DI scope doesn't fit**: Blazor Server components, background services, and parallel operations all need factory-created contexts with explicit lifetime control.

**Use AsNoTracking for read-only queries**: Significant performance improvement when you don't need to modify entities.

**Select projections over full entities**: Only load the columns you need.

**Use Include for related data**: Avoid N+1 queries by eagerly loading relationships.

**Understand change tracking**: EF tracks entities retrieved from the database and detects changes automatically.

**Use migrations for schema changes**: Migrations provide version control for your database schema.

**Handle concurrency**: Use row versions for optimistic concurrency in multi-user scenarios.

**Consider bulk operations**: ExecuteUpdate/Delete for large-scale changes without loading entities.
