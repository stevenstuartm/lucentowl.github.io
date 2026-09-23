---
title: "Entity Framework Core"
layout: guide
category: ".NET & C#"
subcategory: "Core Libraries"
description: "How EF Core works and where it bites: the DbContext as a short-lived unit of work, lifetimes, pooling and factories, mapping entities and relationships, how LINQ becomes SQL, loading related data without N+1 queries, change tracking and saving, bulk updates, transactions and retries, concurrency tokens, raw SQL, and migrations."
tags: [entity-framework-core, dbcontext, orm, change-tracking, migrations, data-access, practical]
---

## What EF Core Is

Entity Framework Core is an object-relational mapper. You describe your data as C# classes, write queries as LINQ against those classes, and EF Core translates the queries into SQL, runs them, and turns the rows back into objects. When you change those objects and call `SaveChanges`, it works out which rows to insert, update, or delete and sends the SQL for that too.

```csharp
// Hand-written SQL through a micro-ORM such as Dapper
var customers = await connection.QueryAsync<Customer>(
    "SELECT * FROM Customers WHERE Country = @Country", new { Country = "USA" });

// EF Core: the same query as LINQ, translated to SQL for you
var customers = await context.Customers
    .Where(c => c.Country == "USA")
    .ToListAsync();
```

The trade is control for convenience. EF Core writes the SQL, which removes a lot of repetitive code and keeps queries type-checked, but the SQL it writes is only as good as the LINQ you give it. Most EF Core performance problems are queries that load more rows, more columns, or more round trips than the author realized, which is why this guide keeps returning to what SQL a given piece of code produces.

## The DbContext

### A Context Is a Unit of Work

A `DbContext` instance represents one conversation with the database. It holds a connection, remembers every entity it has loaded (the **change tracker**), and on `SaveChanges` writes all the changes it has seen as a single transaction.

Two things live at different scopes, and mixing them up causes most lifetime mistakes:

| Scope | What lives there | Cost |
|---|---|---|
| Per context **type** (built once, cached for the process) | The model: entity types, properties, relationships, mappings | Expensive to build, paid once |
| Per context **instance** | Tracked entities, the connection, pending changes | Cheap to create, grows with every entity loaded |

Because the tracked state grows and a `DbContext` is not thread-safe, an instance should be short-lived and used by one logical operation at a time. Create one, do a unit of work, dispose it.

```csharp
public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options) { }

    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Order> Orders => Set<Order>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
    }
}
```

### Registration and Lifetime

`AddDbContext` registers the context with a **scoped** lifetime, meaning the DI container creates one instance per scope and disposes it at the end. In ASP.NET Core a scope is one HTTP request, so every service handling the request shares the same context and its changes save together.

```csharp
services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(connectionString, sql => sql.EnableRetryOnFailure()));
```

Never register a context as a singleton. It would track every entity the application ever loads, and concurrent requests would use one non-thread-safe instance at the same time. Transient registration avoids those problems but gives each service in a request its own context, so two services that each change something end up with two separate units of work and two `SaveChanges` calls.

`EnableSensitiveDataLogging()` and `EnableDetailedErrors()` are useful during development. The first writes parameter values, which can include personal data, into logs, so keep it out of production configuration.

### Context Pooling

Creating a context instance is cheap next to a database round trip, but not free. Each one sets up internal services and tracking structures. `AddDbContextPool` keeps a pool of instances, 1024 by default, resets each one when it is returned, and hands it to the next request.

```csharp
services.AddDbContextPool<ApplicationDbContext>(options =>
    options.UseSqlServer(connectionString));
```

The gain shows up in applications creating many contexts per second, such as busy APIs. For low-traffic applications, or ones where each operation spends most of its time waiting on queries, it makes little difference.

Pooling has one constraint that changes how the context is written. A pooled instance is built once from the root service provider and reused across requests, so its constructor can't take a per-request (scoped) service. With scope validation on, which ASP.NET Core enables in Development, resolving it throws `Cannot resolve scoped service ... from root provider`. For per-request state such as a tenant ID, register a pooled factory and set the state on each instance as it's handed out:

```csharp
services.AddPooledDbContextFactory<ApplicationDbContext>(options =>
    options.UseSqlServer(connectionString));

services.AddScoped(sp =>
{
    var context = sp.GetRequiredService<IDbContextFactory<ApplicationDbContext>>()
        .CreateDbContext();
    context.TenantId = sp.GetRequiredService<ITenantProvider>().TenantId;
    return context;
});
```

A context that holds state like this must reset it itself, since the pool resets only EF Core's own state.

### Context Factories

`IDbContextFactory<T>` creates contexts on demand, so the caller decides the lifetime instead of the DI scope:

```csharp
services.AddDbContextFactory<ApplicationDbContext>(options =>
    options.UseSqlServer(connectionString));

public class OrderImporter(IDbContextFactory<ApplicationDbContext> factory)
{
    public async Task ImportAsync(IEnumerable<OrderRequest> requests)
    {
        foreach (var batch in requests.Chunk(100))
        {
            // A fresh context per batch keeps the change tracker small
            await using var context = await factory.CreateDbContextAsync();
            context.Orders.AddRange(batch.Select(MapToOrder));
            await context.SaveChangesAsync();
        }
    }
}
```

A factory is the right tool whenever no request scope matches the work:

- **Blazor Server.** A component lives as long as the user's circuit, far longer than one operation, so a scoped context would be shared across everything the user does. Create a context per operation.
- **Background services.** A `BackgroundService` is a singleton and has no request scope. The alternative is creating an `IServiceScope` by hand for each unit of work.
- **Parallel work.** A context can't be used by two operations at once, so each concurrent task needs its own.

### Separate Read and Write Contexts

An application can register more than one context type, each with its own connection string, model, and options. One use is a context per database or per bounded context. Another is splitting reads from writes, so a service's constructor shows whether it can modify data:

```csharp
public class ReadOnlyDbContext : DbContext
{
    public ReadOnlyDbContext(DbContextOptions<ReadOnlyDbContext> options)
        : base(options)
    {
        ChangeTracker.QueryTrackingBehavior = QueryTrackingBehavior.NoTracking;
    }

    public IQueryable<Customer> Customers => Set<Customer>();
    public IQueryable<Order> Orders => Set<Order>();

    // SaveChanges() and SaveChangesAsync() both call these overloads
    public override int SaveChanges(bool acceptAllChangesOnSuccess)
        => throw new InvalidOperationException("This context is read-only.");

    public override Task<int> SaveChangesAsync(
        bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
        => throw new InvalidOperationException("This context is read-only.");
}

services.AddDbContextPool<ReadOnlyDbContext>(o => o.UseSqlServer(replicaConnectionString));
services.AddDbContext<ReadWriteDbContext>(o => o.UseSqlServer(primaryConnectionString));
```

Exposing `IQueryable<T>` instead of `DbSet<T>` removes `Add` and `Remove` from the surface, and overriding the two `bool` overloads of `SaveChanges` blocks all four public save methods, since the parameterless ones call them. The read context can point at a read replica. Even against one database, the split makes a query-only service impossible to turn into a writing one by accident.

## Mapping the Model

### Conventions, Annotations, and the Fluent API

EF Core builds its model from three sources, and when they disagree the higher one wins:

| Source | Where it lives | Example |
|---|---|---|
| **Fluent API** (highest) | `OnModelCreating` or `IEntityTypeConfiguration<T>` classes | `builder.Property(c => c.Name).HasMaxLength(100)` |
| **Data annotations** | Attributes on the entity class | `[MaxLength(100)]` |
| **Conventions** (lowest) | Rules EF Core applies automatically | A property named `Id` is the key; `CustomerId` next to a `Customer` navigation is its foreign key |

Nullable reference types feed the conventions. In a project with them enabled, a `string` property becomes a required (`NOT NULL`) column and a `string?` property becomes nullable, with no attribute or configuration.

The Fluent API can express everything annotations can, plus configuration they can't, such as filtered indexes, delete behavior, table splitting, and inheritance mapping. It also keeps entity classes free of persistence attributes, which matters when a domain layer shouldn't depend on EF Core. Annotations are shorter for simple constraints and visible right on the property. Annotations don't validate in EF Core. `[Required]` and `[MaxLength]` shape the schema, but `SaveChanges` doesn't check them before sending SQL. ASP.NET Core model validation reads the same attributes, which is the usual reason to use them.

Configuration classes keep the Fluent API from turning `OnModelCreating` into one very long method:

```csharp
public class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> builder)
    {
        builder.Property(c => c.Name).HasMaxLength(100);
        builder.Property(c => c.Email).HasMaxLength(255);
        builder.Property(c => c.CreditLimit).HasPrecision(18, 2);

        builder.HasIndex(c => c.Email)
            .IsUnique()
            .HasFilter("[Email] IS NOT NULL");   // SQL Server syntax

        builder.Ignore(c => c.DisplayName);
    }
}

// Picked up by ApplyConfigurationsFromAssembly in OnModelCreating
```

### Relationships

A relationship is a foreign key property plus optional **navigation properties**, the references and collections that let code walk from one entity to another. Conventions discover most relationships from the navigations alone, and the Fluent API states the rest explicitly.

```csharp
// One-to-many: a customer has many orders
public class Customer
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public List<Order> Orders { get; set; } = [];
    public CustomerAddress? Address { get; set; }
}

public class Order
{
    public int Id { get; set; }
    public int CustomerId { get; set; }                 // foreign key
    public Customer Customer { get; set; } = null!;     // navigation back
}

modelBuilder.Entity<Order>()
    .HasOne(o => o.Customer)
    .WithMany(c => c.Orders)
    .HasForeignKey(o => o.CustomerId)
    .OnDelete(DeleteBehavior.Cascade);

// One-to-one: the dependent side holds the foreign key
public class CustomerAddress
{
    public int Id { get; set; }
    public string Street { get; set; } = "";
    public int CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
}

modelBuilder.Entity<Customer>()
    .HasOne(c => c.Address)
    .WithOne(a => a.Customer)
    .HasForeignKey<CustomerAddress>(a => a.CustomerId);
```

For many-to-many, collection navigations on both sides are enough. EF Core (since version 5) creates the join table itself. When the join needs its own data, such as an enrollment date, make it an entity and name it as the join:

```csharp
public class Student
{
    public int Id { get; set; }
    public List<Course> Courses { get; set; } = [];
}

public class Course
{
    public int Id { get; set; }
    public List<Student> Students { get; set; } = [];
}

public class Enrollment
{
    public int StudentId { get; set; }
    public int CourseId { get; set; }
    public DateTime EnrolledAt { get; set; }
}

modelBuilder.Entity<Student>()
    .HasMany(s => s.Courses)
    .WithMany(c => c.Students)
    .UsingEntity<Enrollment>();
```

### Value Conversions and Collections

A value converter maps a property type the database doesn't have onto one it does. Enums stored as strings are the common case, and EF Core has a built-in converter for it:

```csharp
modelBuilder.Entity<Order>()
    .Property(o => o.Status)
    .HasConversion<string>();   // stores "Shipped" instead of 2
```

A list of primitive values, such as `List<string> Tags`, needs no converter from EF Core 8 on. It maps to a JSON column by default and detects changes to the list's contents. Before EF Core 8, the usual workaround was a hand-written converter that serialized the list to JSON, and it carried a trap that still applies to any converter over a mutable type. EF Core detects changes by comparing values, and for a converted reference type the default comparison is by reference, so adding an item to the same list instance isn't seen as a change unless the converter is paired with a `ValueComparer` that compares contents.

## How a LINQ Query Becomes SQL

A query against a `DbSet` is an `IQueryable<T>`. Each operator adds to an expression tree, and nothing runs until the query is enumerated, at which point EF Core translates the whole tree into one SQL statement. `ToQueryString()` shows that statement without running it:

```csharp
var query = context.Customers
    .Where(c => c.Name == name)
    .OrderBy(c => c.Id)
    .Take(5);

Console.WriteLine(query.ToQueryString());
// SELECT ... FROM Customers AS c WHERE c.Name = @name ORDER BY c.Id LIMIT @p
```

Captured variables such as `name` become SQL parameters, so interpolating user input into a LINQ query is safe. To see every statement a running application sends, turn on logging with `options.LogTo(Console.WriteLine)` or through the application's `ILogger` configuration under the `Microsoft.EntityFrameworkCore.Database.Command` category.

Not every C# expression has an SQL equivalent. A call to your own method inside a `Where` compiles, because the compiler accepts anything that type-checks, but EF Core can't translate it and throws `InvalidOperationException` when the query runs. The one exception is the final `Select`. There EF Core fetches the columns it needs and runs the untranslatable part in memory on each row. Any other in-memory step has to be requested explicitly with `AsEnumerable()`, placed after every filter the database can apply.

## Loading Related Data

Querying `Customers` returns customers. Their `Orders` navigations stay empty unless the query asks for them.

### Eager Loading with Include

`Include` loads a navigation in the same query, and `ThenInclude` continues down the graph:

```csharp
var customers = await context.Customers
    .Include(c => c.Orders)
        .ThenInclude(o => o.Items)
    .ToListAsync();

// Filtered include (EF Core 5+): load only some of the related rows
var customers = await context.Customers
    .Include(c => c.Orders.Where(o => o.Status == OrderStatus.Open))
    .ToListAsync();
```

By default this is one SQL query with joins. Joining a customer to 50 orders, each with 10 items, returns 500 rows, and each row repeats the customer's and the order's columns. Adding a second collection `Include` at the same level multiplies the row count again. This is the **cartesian explosion**, and EF Core logs a warning when a query includes multiple collections without saying how to split them.

`AsSplitQuery()` loads each collection with its own SQL statement instead, which trades one large result for several smaller ones and extra round trips:

```csharp
var customers = await context.Customers
    .Include(c => c.Orders)
    .Include(c => c.Invoices)
    .AsSplitQuery()
    .ToListAsync();

// Or make split queries the default for a context
options.UseSqlServer(connectionString,
    sql => sql.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery));
```

Split queries aren't a snapshot. If data changes between the statements, the results can be inconsistent with each other unless the queries run inside a serializable or snapshot transaction.

### Projection Instead of Entities

When the goal is to display or return data rather than change it, project into exactly the shape needed. EF Core selects only those columns, the related data comes along in the same query, and nothing is tracked:

```csharp
var summaries = await context.Customers
    .Select(c => new CustomerSummary
    {
        Id = c.Id,
        Name = c.Name,
        OrderCount = c.Orders.Count,
        LastOrderAt = c.Orders.Max(o => (DateTime?)o.PlacedAt)
    })
    .ToListAsync();
```

### Explicit and Lazy Loading

Explicit loading fetches a navigation later, for an entity already loaded, as a visible separate call:

```csharp
var customer = await context.Customers.FindAsync(id);
if (needOrders)
    await context.Entry(customer!).Collection(c => c.Orders).LoadAsync();
```

**Lazy loading** does the same thing invisibly. With the `Microsoft.EntityFrameworkCore.Proxies` package and `UseLazyLoadingProxies()`, reading a navigation that hasn't been loaded sends a query right then. That turns an innocent loop into the **N+1 problem**:

```csharp
var customers = await context.Customers.ToListAsync();   // 1 query
foreach (var customer in customers)
{
    // With lazy loading: one more query per customer
    Console.WriteLine($"{customer.Name}: {customer.Orders.Count}");
}
```

Ten customers means 11 queries, which goes unnoticed in development. Ten thousand customers means 10,001 round trips in production. The code looks like property access, so the cost doesn't show up in review, and every piece of code that touches a navigation has to know whether it's been loaded. Without lazy loading, the same loop sends one query and prints zero for every customer, which is wrong but obviously so. Prefer `Include` or a projection, which make the loading visible where the query is written. In a codebase that already uses lazy loading, replace it query by query as N+1 patterns show up in the logs.

## Change Tracking

Every entity a tracking query returns, or that you pass to `Add`, `Attach`, `Update`, or `Remove`, is recorded in the context's change tracker with a state:

| State | Meaning | On `SaveChanges` |
|---|---|---|
| `Added` | New, not yet in the database | `INSERT` |
| `Unchanged` | Loaded, and no property differs from what was loaded | Nothing |
| `Modified` | At least one property differs from what was loaded | `UPDATE` of the changed columns |
| `Deleted` | Marked for removal | `DELETE` |
| `Detached` | Not tracked by this context | Nothing |

```
                 query, Attach                    property changed
   Detached ──────────────────────▶ Unchanged ─────────────────────▶ Modified
      │                              ▲    │                             │
      │ Add                          │    │ Remove                      │ Remove
      ▼                              │    ▼                             ▼
    Added ─────── SaveChanges ───────┘  Deleted ◀───────────────────────┘
                  (Modified also                │
                   returns here)                └── SaveChanges ──▶ Detached
```

When a tracking query loads an entity, EF Core stores a snapshot of its original values. Changing a property doesn't notify anything. Instead, `SaveChanges` (and a call to `Entry`) runs change detection, which compares every tracked entity with its snapshot and marks the ones that differ. After a successful save, added and modified entities become `Unchanged` with a new snapshot, and deleted ones become `Detached`.

A context also resolves identity. Within one context, a given primary key maps to exactly one object, so querying the same customer twice returns the same instance, with any in-memory changes intact.

### No-Tracking Queries

Tracking costs memory for the snapshots and time for change detection. For data that won't be modified, turn it off:

```csharp
var customers = await context.Customers
    .AsNoTracking()
    .Where(c => c.IsActive)
    .ToListAsync();

// Or make it the default for a context
options.UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking);
```

A no-tracking query also skips identity resolution, so the same customer appearing twice in a result becomes two separate objects. `AsNoTrackingWithIdentityResolution()` keeps one instance per key without tracking changes.

### Saving Changes

```csharp
// Add: the entity and any new entities it references become Added
context.Orders.Add(new Order
{
    Customer = new Customer { Name = "Alice" },
    Items = [new OrderItem { ProductId = 1, Quantity = 2 }]
});
await context.SaveChangesAsync();   // inserts all three, in dependency order

// Update a tracked entity: just change it
var customer = await context.Customers.FindAsync(id);
customer!.Name = "Updated";
await context.SaveChangesAsync();   // UPDATE of Name only
```

`FindAsync` checks the change tracker before querying, so finding an entity the context already holds costs no round trip.

An entity that arrives from outside the context, such as a deserialized request body, is **disconnected**. The context has no snapshot to compare against, so it can't know what changed. `Update(entity)` handles that by marking *every* property modified, which writes every column and overwrites anything another user changed in the meantime. When only some columns should change, attach the entity as unchanged and mark those columns explicitly:

```csharp
var customer = new Customer { Id = request.Id, Name = request.Name };
context.Attach(customer);                                   // Unchanged
context.Entry(customer).Property(c => c.Name).IsModified = true;
await context.SaveChangesAsync();                           // UPDATE ... SET Name only
```

Deletion works the same way. `Remove` on a loaded entity marks it `Deleted`, and removing a stub that carries only the key (`context.Remove(new Order { Id = id })`) deletes the row without loading it first.

### Bulk Updates Bypass the Tracker

Loading ten thousand rows to change one column on each is slow. `ExecuteUpdateAsync` and `ExecuteDeleteAsync` (EF Core 7+) translate straight to a single `UPDATE` or `DELETE`:

```csharp
await context.Customers
    .Where(c => !c.IsActive && c.LastOrderAt < cutoff)
    .ExecuteUpdateAsync(s => s
        .SetProperty(c => c.Status, CustomerStatus.Archived)
        .SetProperty(c => c.ArchivedAt, DateTime.UtcNow));

await context.Orders
    .Where(o => o.PlacedAt < purgeBefore)
    .ExecuteDeleteAsync();
```

These run immediately, not at the next `SaveChanges`, and they don't touch the change tracker. An entity the context already tracks keeps its old values in memory after an `ExecuteUpdate` changes its row. Since EF Core 10 the setter can be a block lambda, so a `SetProperty` can sit inside an `if`.

## Transactions

`SaveChanges` wraps everything it writes in one transaction, so a single call either applies all its changes or none. An explicit transaction is needed only when several `SaveChanges` calls, or a `SaveChanges` and raw SQL, must succeed or fail together:

```csharp
await using var transaction = await context.Database.BeginTransactionAsync();

context.Customers.Add(customer);
await context.SaveChangesAsync();

await context.Database.ExecuteSqlAsync($"EXEC dbo.AllocateCredit {customer.Id}");

await transaction.CommitAsync();   // disposing without committing rolls back
```

A retrying execution strategy, enabled by `EnableRetryOnFailure`, complicates this. It retries a failed operation by re-running it, but it can't re-run a transaction you opened yourself, so starting one under a retrying strategy throws. Wrap the whole transaction in the strategy, so a retry repeats all of it:

```csharp
var strategy = context.Database.CreateExecutionStrategy();
await strategy.ExecuteAsync(async () =>
{
    await using var transaction = await context.Database.BeginTransactionAsync();
    // ... the same work as above
    await transaction.CommitAsync();
});
```

The block must be safe to run more than once, because a retry runs it from the top.

## Concurrency Tokens

Two users load the same product, both change it, and both save. Without a check, the second save silently overwrites the first. A **concurrency token** is a column EF Core includes in the `WHERE` clause of every `UPDATE` and `DELETE`. If the row has changed since it was loaded, the statement affects zero rows and `SaveChanges` throws `DbUpdateConcurrencyException`.

On SQL Server, a `rowversion` column is the usual token, since the database changes it on every write:

```csharp
public class Product
{
    public int Id { get; set; }
    public int Stock { get; set; }

    [Timestamp]
    public byte[] RowVersion { get; set; } = null!;
}
```

Handling the exception means deciding who wins:

```csharp
try
{
    await context.SaveChangesAsync();
}
catch (DbUpdateConcurrencyException ex)
{
    foreach (var entry in ex.Entries)
    {
        var databaseValues = await entry.GetDatabaseValuesAsync();
        if (databaseValues is null)
        {
            // The row was deleted by someone else
            continue;
        }

        // Keep this user's values: take the database's token so the retry succeeds
        entry.OriginalValues.SetValues(databaseValues);

        // Or discard this user's changes instead:
        // await entry.ReloadAsync();
    }
    await context.SaveChangesAsync();
}
```

For many applications neither automatic choice is right, and the useful response is to show the user the current values and let them decide.

## Raw SQL

When LINQ can't express a query, EF Core can still run SQL and map the results:

```csharp
// Interpolated values become parameters (EF Core 7+)
var customers = await context.Customers
    .FromSql($"SELECT * FROM Customers WHERE Country = {country}")
    .Where(c => c.IsActive)          // composes on top of the SQL
    .ToListAsync();

// Results that aren't entities (scalars from EF Core 7, unmapped types from EF Core 8)
var ids = await context.Database
    .SqlQuery<int>($"SELECT Id AS Value FROM Customers WHERE Country = {country}")
    .ToListAsync();

// Commands
await context.Database.ExecuteSqlAsync(
    $"UPDATE Customers SET IsActive = 0 WHERE LastOrderAt < {cutoff}");
```

The interpolated methods (`FromSql`, `SqlQuery`, `ExecuteSql`) turn every interpolated value into a parameter. Their `Raw` counterparts (`FromSqlRaw`, `ExecuteSqlRaw`) take a plain string, so building that string by concatenation or interpolation *before* passing it in is SQL injection. Use the `Raw` forms only when the SQL itself is dynamic, such as a column name, and validate that part against a fixed list.

## Migrations

A migration is a generated C# class that moves the database schema from one version of the model to the next. EF Core compares the current model with a snapshot of the previous one and writes the difference as `Up` and `Down` methods.

```bash
dotnet ef migrations add AddCustomerEmail           # generate from model changes
dotnet ef migrations add AddCustomerEmail -c ApplicationDbContext   # when there are several contexts
dotnet ef migrations script --idempotent -o migrate.sql              # SQL for a DBA or pipeline
dotnet ef migrations bundle                                          # self-contained executable
dotnet ef database update                                            # apply to the configured database
```

How migrations reach production matters more than how they're generated. Calling `context.Database.MigrateAsync()` at startup is convenient in development. Since EF Core 9 it takes a database lock, so several instances starting together no longer apply the same migration twice. It still means the running application needs permission to change the schema, a failed migration takes startup down with it, and nobody reviews the SQL before it runs. The EF Core documentation recommends applying migrations as a deployment step instead, with an idempotent SQL script or a migration bundle.

`EnsureCreatedAsync()` is not a lighter version of migrations. It creates the schema straight from the model and records no migration history, so a database created this way can't be moved forward with migrations later. It suits tests and prototypes that throw the database away.

When a change can't be expressed through the model, such as a full-text index or a data backfill, add SQL to a migration by hand:

```csharp
public partial class AddFullTextIndex : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            "CREATE FULLTEXT INDEX ON Products(Name, Description) KEY INDEX PK_Products");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("DROP FULLTEXT INDEX ON Products");
    }
}
```

## Query Performance

Most of the levers have already come up, including no-tracking for read-only data, projection instead of whole entities, `Include` or projection instead of lazy loading, split queries for multiple collections, and bulk operations instead of load-and-save loops. Three more round out the set.

### Filter and Project Before Materializing

Anything after `ToListAsync()` runs in memory on rows that have already crossed the network:

```csharp
// Loads every column of every customer, then picks emails in memory
var emails = (await context.Customers.ToListAsync()).Select(c => c.Email);

// SQL selects only the Email column
var emails = await context.Customers.Select(c => c.Email).ToListAsync();
```

### Pagination

`Skip` and `Take` translate to `OFFSET` and a row limit. They need an `OrderBy`, since without one the database may return rows in any order and pages can overlap or skip rows:

```csharp
var page = await context.Customers
    .OrderBy(c => c.Name).ThenBy(c => c.Id)
    .Skip((pageNumber - 1) * pageSize)
    .Take(pageSize)
    .ToListAsync();
```

The database still reads and discards every skipped row, so deep pages get slower. For large tables, **keyset pagination** filters past the last row of the previous page instead, which an index can seek to directly, as in `.Where(c => c.Id > lastSeenId).OrderBy(c => c.Id).Take(pageSize)`.

### Compiled Queries

EF Core caches the translation of each query shape, but it still has to compute a cache key from the expression tree on every execution. For a very hot query, `EF.CompileAsyncQuery` does that work once:

```csharp
private static readonly Func<ApplicationDbContext, int, Task<Customer?>> GetCustomerById =
    EF.CompileAsyncQuery((ApplicationDbContext context, int id) =>
        context.Customers.FirstOrDefault(c => c.Id == id));

var customer = await GetCustomerById(context, customerId);
```

The gain is small per call and only matters at high volume. Measure before reaching for it.

## Key Takeaways

**A context is a short-lived unit of work.** Scoped per request by default, never a singleton, and never shared between concurrent operations. Use a factory where no request scope fits.

**Pooling reuses instances, not state.** A pooled context can't take scoped constructor dependencies, so set per-request state through a pooled factory.

**Know the SQL your LINQ produces.** `ToQueryString()` and command logging show it. An untranslatable expression throws at run time, except in the final `Select`.

**Load related data on purpose.** `Include` or a projection, split queries when several collections multiply rows, and no lazy loading.

**The change tracker is how saving works.** Tracked entities are compared with snapshots on `SaveChanges`. A disconnected `Update` writes every column, so attach and mark only what changed.

**Bulk operations and raw SQL skip the tracker.** `ExecuteUpdate` and `ExecuteDelete` run immediately and leave tracked entities stale.

**Retries and transactions have to be combined deliberately.** Wrap a user transaction in the execution strategy, and make the block safe to repeat.

**Apply migrations as a deployment step.** Use scripts or bundles in production, and never mix `EnsureCreated` with migrations.
