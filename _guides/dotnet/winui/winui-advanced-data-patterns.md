---
title: "Advanced Data Patterns"
layout: guide
category: "WinUI 3"
subcategory: "Data & MVVM"
description: "Implementing advanced data patterns in WinUI 3 including incremental loading, input validation with INotifyDataErrorInfo, caching strategies, and offline-capable data architectures."
tags: [winui, winui-3, data-binding, validation, caching, mvvm, desktop, advanced]
---

## Table of Contents

- [Incremental Loading with ISupportIncrementalLoading](#incremental-loading-with-isupportincrementalloading)
- [Data Validation with INotifyDataErrorInfo and ObservableValidator](#data-validation-with-inotifydataerrorinfo-and-observablevalidator)
- [Caching Strategies](#caching-strategies)
- [Offline Data Patterns](#offline-data-patterns)
- [Batch Operations on ObservableCollection](#batch-operations-on-observablecollection)
- [Data Paging for Large Datasets](#data-paging-for-large-datasets)

---

## Incremental Loading with ISupportIncrementalLoading

Most real-world datasets are too large to load all at once. Fetching ten thousand product records on startup is wasteful when the user may only scroll through fifty of them. WinUI 3 collection controls like `ListView` and `GridView` support demand-driven loading natively through the `ISupportIncrementalLoading` interface, which tells the control that more data is available and provides a mechanism to request it as the user scrolls toward the bottom.

The interface requires two members: a `HasMoreItems` property that signals whether additional data exists, and a `LoadMoreItemsAsync` method that the control calls when it determines it needs more content. Rather than implementing the full interface from scratch, the most practical approach is to subclass `IncrementalLoadingBase` from the [CommunityToolkit.WinUI](https://learn.microsoft.com/en-us/windows/communitytoolkit/){:target="_blank" rel="noopener noreferrer"} library, which handles the `IObservableVector` plumbing and leaves only the loading logic to implement.

A minimal implementation for a paginated product API looks like this:

```csharp
public class IncrementalProductCollection : IncrementalLoadingBase
{
    private readonly IProductService _productService;
    private int _currentPage = 0;
    private const int PageSize = 25;

    public IncrementalProductCollection(IProductService productService)
    {
        _productService = productService;
    }

    protected override bool HasMoreItemsOverride() => _currentPage >= 0;

    protected override async Task<IList<object>> LoadMoreItemsOverrideAsync(
        CancellationToken cancellationToken, uint count)
    {
        var page = await _productService.GetPageAsync(_currentPage, PageSize, cancellationToken);

        if (page.Items.Count < PageSize)
            _currentPage = -1; // Signal end of data
        else
            _currentPage++;

        return page.Items.Cast<object>().ToList();
    }
}
```

In the ViewModel, you expose this collection as a property and bind it to a `ListView`. The control handles calling `LoadMoreItemsAsync` automatically when the user scrolls near the end. If you need finer control over the trigger threshold, the `ListView` exposes an `IncrementalLoadingThreshold` property that specifies how many items before the end the load should begin.

One subtle issue is error handling inside `LoadMoreItemsOverrideAsync`. If the method throws, the control may stop requesting more items entirely depending on the implementation. Wrapping the async body in a try/catch and returning an empty list on failure, while also setting a flag the ViewModel can observe, gives the UI an opportunity to show a retry option without the list silently stopping.

---

## Data Validation with INotifyDataErrorInfo and ObservableValidator

Forms in desktop applications need more than just data binding. When a user enters an invalid email address or leaves a required field blank, the UI should reflect that state immediately and clearly. WinUI 3 data binding supports `INotifyDataErrorInfo`, an interface that lets a ViewModel carry validation state alongside its property values so controls can react automatically.

Implementing `INotifyDataErrorInfo` manually involves maintaining a dictionary of property names to error lists, raising `ErrorsChanged` events when validation state changes, and running validation logic on every property setter. The [CommunityToolkit.Mvvm](https://learn.microsoft.com/en-us/dotnet/communitytoolkit/mvvm/){:target="_blank" rel="noopener noreferrer"} library eliminates this through `ObservableValidator`, a base class that handles the infrastructure and exposes validation through data annotations and the `ValidateProperty` method.

A registration form ViewModel using `ObservableValidator` demonstrates the pattern:

```csharp
public partial class RegistrationViewModel : ObservableValidator
{
    [ObservableProperty]
    [NotifyDataErrorInfo]
    [Required(ErrorMessage = "Email is required.")]
    [EmailAddress(ErrorMessage = "Enter a valid email address.")]
    private string _email = string.Empty;

    [ObservableProperty]
    [NotifyDataErrorInfo]
    [Required(ErrorMessage = "Password is required.")]
    [MinLength(8, ErrorMessage = "Password must be at least 8 characters.")]
    private string _password = string.Empty;

    [RelayCommand]
    private void Submit()
    {
        ValidateAllProperties();

        if (HasErrors)
            return;

        // Proceed with registration
    }
}
```

The `[NotifyDataErrorInfo]` attribute on each field tells the source generator to call `ValidateProperty` whenever the property changes. Data annotations like `[Required]` and `[EmailAddress]` provide the validation rules, but you can also write custom validators by subclassing `ValidationAttribute`:

```csharp
public class NoReservedWordsAttribute : ValidationAttribute
{
    private static readonly string[] Reserved = ["admin", "root", "system"];

    protected override ValidationResult? IsValid(object? value, ValidationContext context)
    {
        if (value is string s && Reserved.Contains(s.ToLowerInvariant()))
            return new ValidationResult("This username is reserved.");

        return ValidationResult.Success;
    }
}
```

Displaying validation errors in XAML requires binding to the errors collection on the control. WinUI 3 controls that inherit from `Control` expose an `InputValidationCommand` mechanism, but the more common approach is using the `InfoBar` or a `TextBlock` bound to a formatted error message computed from `GetErrors`:

```csharp
public string EmailError =>
    GetErrors(nameof(Email)).FirstOrDefault()?.ErrorMessage ?? string.Empty;
```

With `[NotifyPropertyChangedFor(nameof(EmailError))]` added to the `_email` field, the XAML-bound error text updates alongside the property. This keeps the error display declarative and free of code-behind event handlers.

---

## Caching Strategies

Network calls are expensive. Round-tripping to an API for data that changes infrequently wastes time on every navigation and makes the application feel sluggish on poor connections. WinUI 3 applications typically layer two kinds of caching: an in-memory cache for hot data within a session and a persistent cache for data that should survive restarts.

For in-memory caching, `Microsoft.Extensions.Caching.Memory` provides `IMemoryCache`, which is available through the standard .NET dependency injection container. Entries can carry absolute or sliding expiration policies and size limits to prevent unbounded growth:

```csharp
public class CachedProductService : IProductService
{
    private readonly IProductService _inner;
    private readonly IMemoryCache _cache;
    private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(5);

    public CachedProductService(IProductService inner, IMemoryCache cache)
    {
        _inner = inner;
        _cache = cache;
    }

    public async Task<Product?> GetByIdAsync(int id, CancellationToken cancellationToken)
    {
        return await _cache.GetOrCreateAsync($"product:{id}", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = Ttl;
            return await _inner.GetByIdAsync(id, cancellationToken);
        });
    }
}
```

This decorator pattern wraps an existing service without modifying it, which keeps the caching concern separate from the retrieval logic and makes the behavior easy to test in isolation.

For persistent caching that survives application restarts, SQLite is a natural fit for desktop applications. The [SQLite-net](https://github.com/praeclarum/sqlite-net){:target="_blank" rel="noopener noreferrer"} library offers a lightweight ORM that maps C# classes to SQLite tables and works well in the local application data folder:

```csharp
public class SqliteCache<T> where T : ICacheEntry, new()
{
    private readonly SQLiteAsyncConnection _db;

    public SqliteCache(string dbPath)
    {
        _db = new SQLiteAsyncConnection(dbPath);
        _db.CreateTableAsync<T>().Wait();
    }

    public async Task SetAsync(string key, T value, TimeSpan ttl)
    {
        value.Key = key;
        value.ExpiresAt = DateTime.UtcNow.Add(ttl);
        await _db.InsertOrReplaceAsync(value);
    }

    public async Task<T?> GetAsync(string key)
    {
        var entry = await _db.FindAsync<T>(key);
        if (entry is null || entry.ExpiresAt < DateTime.UtcNow)
            return null;
        return entry;
    }
}
```

HTTP response caching deserves its own mention. When using `HttpClient`, configuring a `DelegatingHandler` that caches responses for specific endpoints avoids both the network round trip and the deserialization cost. The `CacheControlHeaderValue` from the HTTP response can guide whether a response should be cached at all, respecting server-side cache directives.

Cache invalidation is where most caching strategies become complicated. The simplest approach is time-to-live expiry: cached entries are considered fresh for a fixed window. For write operations such as updating a product, invalidate the specific cache key immediately after a successful write so the next read reflects the change. Avoid bulk invalidation ("clear everything") unless the domain genuinely requires it, since it defeats the purpose of caching and causes thundering-herd problems where many requests race to repopulate the cache simultaneously.

---

## Offline Data Patterns

Desktop applications have an advantage over web applications in that they can continue functioning without a network connection. A local-first architecture treats the local database as the source of truth and treats network synchronization as a background concern rather than a prerequisite for every operation.

The pattern works in three layers. The application reads from and writes to a local SQLite database unconditionally. A background sync service monitors connectivity and pushes pending writes to the server when a connection is available. Incoming changes from the server are merged into the local database and surfaced to the UI through `INotifyPropertyChanged` notifications.

Detecting connectivity in WinUI 3 uses the `NetworkInformation` class from `Windows.Networking.Connectivity`:

```csharp
public class ConnectivityMonitor
{
    public bool IsConnected =>
        NetworkInformation.GetInternetConnectionProfile()?.GetNetworkConnectivityLevel()
            == NetworkConnectivityLevel.InternetAccess;

    public ConnectivityMonitor()
    {
        NetworkInformation.NetworkStatusChanged += OnNetworkStatusChanged;
    }

    private void OnNetworkStatusChanged(object sender)
    {
        ConnectivityChanged?.Invoke(this, IsConnected);
    }

    public event EventHandler<bool>? ConnectivityChanged;
}
```

Conflict resolution is where local-first architectures require the most thought. When the same record has been modified both locally and on the server since the last sync, a strategy is needed. Three common approaches are last-write-wins (the record with the later timestamp overwrites the other), server-wins (local changes are discarded when the server has a newer version), and merge (specific fields are combined, which requires field-level tracking). For most desktop applications, last-write-wins with a user-visible conflict notification is sufficient. Domain-specific merge logic is worth investing in only when the cost of data loss is high.

Tracking pending writes requires augmenting local records with a sync status field. Values like `Synced`, `PendingCreate`, `PendingUpdate`, and `PendingDelete` allow the sync service to identify exactly which records need to be pushed without scanning the entire database:

```csharp
public enum SyncStatus { Synced, PendingCreate, PendingUpdate, PendingDelete }

public class LocalProduct
{
    [PrimaryKey, AutoIncrement]
    public int LocalId { get; set; }
    public int? ServerId { get; set; }
    public string Name { get; set; } = string.Empty;
    public SyncStatus SyncStatus { get; set; } = SyncStatus.PendingCreate;
    public DateTime UpdatedAt { get; set; }
}
```

The sync service queries for records where `SyncStatus != Synced`, applies them to the server API, and updates the local records to `Synced` on success. If the server returns a new `ServerId` for a newly created record, the local record is updated with that identifier so future updates can reference the correct server resource.

---

## Batch Operations on ObservableCollection

`ObservableCollection<T>` raises a `CollectionChanged` event for every modification. Adding a hundred items one at a time triggers a hundred UI redraws, which can make list controls visibly stutter when populating from a large dataset. The standard .NET library does not provide a built-in way to suppress notifications during batch operations, but the pattern is straightforward to implement.

One approach is to build a `BulkObservableCollection<T>` that defers notifications until a batch scope closes:

```csharp
public class BulkObservableCollection<T> : ObservableCollection<T>
{
    private bool _suppressNotifications;

    public void AddRange(IEnumerable<T> items)
    {
        _suppressNotifications = true;

        try
        {
            foreach (var item in items)
                Items.Add(item);
        }
        finally
        {
            _suppressNotifications = false;
            OnCollectionChanged(new NotifyCollectionChangedEventArgs(
                NotifyCollectionChangedAction.Reset));
        }
    }

    protected override void OnCollectionChanged(NotifyCollectionChangedEventArgs e)
    {
        if (!_suppressNotifications)
            base.OnCollectionChanged(e);
    }
}
```

The `Reset` action tells the bound control that the entire collection has changed, prompting a single full re-render rather than incremental updates. This is slightly more expensive per item than an `Add` action when the collection is small, but substantially cheaper when adding hundreds of items at once.

For scenarios where items need to be replaced entirely, such as refreshing a search result set, replacing the collection reference itself rather than clearing and re-adding is another option. Binding to a property of type `IReadOnlyList<T>` instead of `ObservableCollection<T>` means the UI re-renders only when the property itself changes, with no per-item notifications at all. Combined with `[ObservableProperty]` from CommunityToolkit.Mvvm, this is often the simplest approach for read-heavy lists that are refreshed wholesale.

---

## Data Paging for Large Datasets

Incremental loading handles the case where users scroll through a continuously growing list. Server-side paging handles the complementary case where users navigate between discrete pages of results, as in a data grid showing records fifty at a time with explicit "Previous" and "Next" controls.

A paging ViewModel needs to track the current page, the total record count, and whether navigation in either direction is possible:

```csharp
public partial class PagedOrdersViewModel : ObservableObject
{
    private readonly IOrderService _orderService;
    private const int PageSize = 50;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(CanGoBack))]
    [NotifyPropertyChangedFor(nameof(CanGoForward))]
    [NotifyCanExecuteChangedFor(nameof(PreviousPageCommand))]
    [NotifyCanExecuteChangedFor(nameof(NextPageCommand))]
    private int _currentPage = 1;

    [ObservableProperty]
    private int _totalPages;

    [ObservableProperty]
    private IReadOnlyList<Order> _orders = [];

    [ObservableProperty]
    private bool _isLoading;

    public bool CanGoBack => CurrentPage > 1 && !IsLoading;
    public bool CanGoForward => CurrentPage < TotalPages && !IsLoading;

    public string PageInfo => $"Page {CurrentPage} of {TotalPages}";

    [RelayCommand(CanExecute = nameof(CanGoBack))]
    private async Task PreviousPageAsync() => await LoadPageAsync(CurrentPage - 1);

    [RelayCommand(CanExecute = nameof(CanGoForward))]
    private async Task NextPageAsync() => await LoadPageAsync(CurrentPage + 1);

    private async Task LoadPageAsync(int page)
    {
        IsLoading = true;

        try
        {
            var result = await _orderService.GetPageAsync(page, PageSize);
            Orders = result.Items;
            TotalPages = (int)Math.Ceiling((double)result.TotalCount / PageSize);
            CurrentPage = page;
        }
        finally
        {
            IsLoading = false;
        }
    }
}
```

Caching individual pages in `IMemoryCache` with a short TTL significantly reduces latency when users navigate back and forth between adjacent pages. Prefetching the next page in the background after a successful load, while the user is reading the current one, can make forward navigation feel near-instant. The prefetch is a fire-and-forget operation that populates the cache; if it completes before the user clicks "Next," the next page loads from memory rather than the network.

For very large datasets where users need to jump to arbitrary pages rather than navigate sequentially, a page number input or a slider control bound to `CurrentPage` works well, but requires debouncing. Without debouncing, every keystroke in the page number input triggers a full reload. A simple approach is to delay the load call by 300 to 500 milliseconds after the last user input using a `CancellationTokenSource` that cancels any pending load when a new input arrives before the delay expires.
