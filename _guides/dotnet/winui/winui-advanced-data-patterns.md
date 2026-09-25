---
title: "Advanced Data Patterns"
layout: guide
category: "WinUI 3"
subcategory: "Data & MVVM"
description: "Data patterns for WinUI 3 apps that outgrow a simple bound list: loading items as the user scrolls with ISupportIncrementalLoading and the toolkit's IncrementalLoadingCollection, explicit paging, validating input with ObservableValidator when controls show no errors themselves, batching collection updates, and working offline with a local store, sync status, and connectivity detection."
tags: [incremental-loading, observablevalidator, data-validation, paging, offline-first, observablecollection, advanced]
---

## Loading Items as the User Scrolls

A list of ten thousand products doesn't need ten thousand products in memory when the user will look at fifty. `ListView` and `GridView` can ask for data on demand. When their `ItemsSource` implements `ISupportIncrementalLoading` (`Microsoft.UI.Xaml.Data`), the control reads its `HasMoreItems` property and calls `LoadMoreItemsAsync` whenever the user scrolls close enough to the end of what has loaded. `ItemsView` and `ItemsRepeater` don't do this, so an incrementally loading collection bound to either one just shows what it holds and never asks for more.

Two properties on the list tune how early and how often it asks. Both measure distance in viewport-sized pages of the list, which is a different "page" from the batch of items a data source returns. `IncrementalLoadingThreshold` sets how close to the end the viewport has to come before the list asks for more. A larger value starts loading further ahead, which suits users who fling through the list, at the cost of loading items they may never see. `DataFetchSize` sets how much the list asks for at a time.

Incremental loading depends on the list knowing where its viewport ends. A `ListView` placed where it gets unlimited height, such as inside a vertical `StackPanel`, has no viewport edge to approach, so it can keep requesting pages until the source runs out.

### The Toolkit's IncrementalLoadingCollection

Implementing `ISupportIncrementalLoading` by hand means building a collection, tracking pages, guarding against overlapping loads, and reporting progress. The Windows Community Toolkit's [`IncrementalLoadingCollection<TSource, T>`](https://learn.microsoft.com/en-us/dotnet/communitytoolkit/windows/collections/incrementalloadingcollection){:target="_blank" rel="noopener noreferrer"}, in the `CommunityToolkit.WinUI.Collections` package, does that work. The app supplies only the page fetch, as an `IIncrementalSource<T>`:

```csharp
using CommunityToolkit.WinUI.Collections;

public sealed class ProductSource(IProductService products) : IIncrementalSource<Product>
{
    public Task<IEnumerable<Product>> GetPagedItemsAsync(
        int pageIndex, int pageSize, CancellationToken cancellationToken = default) =>
        products.GetPageAsync(pageIndex, pageSize, cancellationToken);
}
```

```csharp
public partial class CatalogViewModel : ObservableObject
{
    public CatalogViewModel(IProductService products)
    {
        Products = new IncrementalLoadingCollection<ProductSource, Product>(
            new ProductSource(products),
            itemsPerPage: 25,
            onError: ex => LoadError = ex.GetBaseException().Message);
    }

    public IncrementalLoadingCollection<ProductSource, Product> Products { get; }

    [ObservableProperty]
    public partial string? LoadError { get; set; }

    [RelayCommand]
    private Task RetryAsync()
    {
        LoadError = null;
        return Products.RefreshAsync();
    }
}
```

```xml
<ListView ItemsSource="{x:Bind ViewModel.Products}" />
<ProgressRing IsActive="{x:Bind ViewModel.Products.IsLoading, Mode=OneWay}" />
```

The collection derives from `ObservableCollection<T>` and exposes `IsLoading` and `HasMoreItems` as bindable properties. `pageIndex` starts at zero, and every call asks for `itemsPerPage` items whatever count the list requested, so the list's settings change how many fetches happen rather than their size. The collection stops asking for more once a page comes back empty.

Errors need a plan. When a page fetch throws, the collection calls the `onError` callback and sets `HasMoreItems` to `false`, so the list stops at whatever it has and won't try that page again by itself. The exception arrives wrapped in an `AggregateException`, which is why the sample reads `GetBaseException()`. Without a callback, the exception propagates into the list's own load request, where nothing is waiting to handle it, so always pass one. Surfacing the error, as `LoadError` does here, and offering a retry keeps a network blip from ending the list for the rest of the session. `RefreshAsync` clears the collection and resets it to the first page with `HasMoreItems` set to `true`. If the collection was already empty, it loads that page itself. Otherwise the bound list sees the emptied collection and asks for it.

---

## Paging with Explicit Controls

Incremental loading suits a feed the user scrolls through. Some data reads better as discrete pages with **Previous** and **Next**, such as search results the user compares or records they jump between by number. The view model tracks the page, the total, and which way the user can move:

```csharp
public partial class OrdersViewModel(IOrderService orders) : ObservableObject
{
    private const int PageSize = 50;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(PageInfo))]
    [NotifyCanExecuteChangedFor(nameof(PreviousPageCommand), nameof(NextPageCommand))]
    public partial int CurrentPage { get; set; }

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(PageInfo))]
    [NotifyCanExecuteChangedFor(nameof(NextPageCommand))]
    public partial int TotalPages { get; set; }

    [ObservableProperty]
    public partial IReadOnlyList<Order>? Orders { get; set; }

    public string PageInfo => $"Page {CurrentPage} of {TotalPages}";

    private bool CanGoBack() => CurrentPage > 1;
    private bool CanGoForward() => CurrentPage < TotalPages;

    [RelayCommand(CanExecute = nameof(CanGoBack))]
    private Task PreviousPageAsync() => LoadPageAsync(CurrentPage - 1);

    [RelayCommand(CanExecute = nameof(CanGoForward))]
    private Task NextPageAsync() => LoadPageAsync(CurrentPage + 1);

    public async Task LoadPageAsync(int page)
    {
        PagedResult<Order> result = await orders.GetPageAsync(page, PageSize);
        Orders = result.Items;
        TotalPages = (int)Math.Ceiling(result.TotalCount / (double)PageSize);
        CurrentPage = page;
    }
}
```

The page calls `LoadPageAsync(1)` when it is first shown, and each command then moves from there. Each async command disables itself while it runs, so a double-click can't load the same page twice. The other direction's command stays enabled, and a click on it starts a second load that can finish first. A view model that needs strict ordering cancels the previous load when a new one starts.

Two refinements make paging feel faster. Keeping recently viewed pages in an in-memory cache makes Previous instant, and fetching the next page in the background after each load does the same for Next, as long as that background fetch catches its own exceptions, since nothing awaits it. A page-number box or slider bound to `CurrentPage` should wait until the input pauses before loading, with a debounce, or every keystroke loads a page.

---

## Validating Input with ObservableValidator

### Controls Don't Show Validation Errors

WinUI's input controls have no built-in way to display validation errors. A `TextBox` bound to a view model that implements `INotifyDataErrorInfo` doesn't show a red border or an error message by itself. Validation in a WinUI app is therefore view model state like any other, and the view decides how to show it.

The MVVM Toolkit's [`ObservableValidator`](https://learn.microsoft.com/en-us/dotnet/communitytoolkit/mvvm/observablevalidator){:target="_blank" rel="noopener noreferrer"} provides that state. It derives from `ObservableObject`, implements `INotifyDataErrorInfo`, and validates properties against the attributes in `System.ComponentModel.DataAnnotations`, such as `[Required]` and `[EmailAddress]`. Adding `[NotifyDataErrorInfo]` to a generated property makes its setter validate every new value.

### A Form View Model

```csharp
using System.ComponentModel.DataAnnotations;

public partial class RegistrationViewModel : ObservableValidator
{
    public RegistrationViewModel()
    {
        ErrorsChanged += (_, e) => OnPropertyChanged(e.PropertyName + "Error");
        Email = string.Empty;
        Password = string.Empty;
    }

    [ObservableProperty]
    [NotifyDataErrorInfo]
    [Required(ErrorMessage = "Email is required.")]
    [EmailAddress(ErrorMessage = "Enter a valid email address.")]
    public partial string Email { get; set; }

    [ObservableProperty]
    [NotifyDataErrorInfo]
    [Required(ErrorMessage = "Password is required.")]
    [MinLength(8, ErrorMessage = "Password must be at least 8 characters.")]
    public partial string Password { get; set; }

    public string? EmailError => FirstError(nameof(Email));
    public string? PasswordError => FirstError(nameof(Password));

    private string? FirstError(string property) =>
        GetErrors(property).FirstOrDefault()?.ErrorMessage;

    [RelayCommand]
    private void Submit()
    {
        ValidateAllProperties();
        if (HasErrors) return;

        // Register the account
    }
}
```

```xml
<TextBox Header="Email" Text="{x:Bind ViewModel.Email, Mode=TwoWay, UpdateSourceTrigger=PropertyChanged}" />
<TextBlock Text="{x:Bind ViewModel.EmailError, Mode=OneWay}"
           Foreground="{ThemeResource SystemFillColorCriticalBrush}" />
```

`ErrorsChanged` fires whenever a property's errors change, and the handler turns it into a change notification for the matching `...Error` property, so the message appears and clears as the user types. `[NotifyPropertyChangedFor(nameof(EmailError))]` would cover changes made through the setter, but errors also change without the setter running, when `Submit` calls `ValidateAllProperties`, when errors are cleared, and when another property's rule re-validates this one. Handling `ErrorsChanged` catches all of them.

The constructor assigns `Email` and `Password`, which runs validation on the empty values and so reports "is required" before the user has typed. Forms that shouldn't show errors until the user interacts call `ClearErrors()` at the end of the constructor, which clears every property's errors, and `Submit` validates everything with `ValidateAllProperties` anyway.

The attributes are read by reflection, and the toolkit marks its validation methods as requiring code the trimmer can't see. A release publish with trimming, which current WinUI templates turn on, reports trimming warnings for them, and so does an opt-in Native AOT publish. Properties the trimmer removes metadata for can go unvalidated.

### Rules the Attributes Don't Cover

A rule that needs a service goes in a static method named by `[CustomValidation(typeof(RegistrationViewModel), nameof(ValidateUserName))]`. The method receives the value and a `ValidationContext` whose `ObjectInstance` is the view model, which gives it access to injected services. Validation is synchronous, though, so a rule that needs a network call, such as checking that a username isn't taken, runs as an async check on submit or after the input pauses. The check records its result in a field, and the custom rule reads that field:

```csharp
// Added to RegistrationViewModel, with an IAccountService injected as accounts
private string? takenUserName;

[ObservableProperty]
[NotifyDataErrorInfo]
[Required(ErrorMessage = "Username is required.")]
[CustomValidation(typeof(RegistrationViewModel), nameof(ValidateUserName))]
public partial string UserName { get; set; }

public static ValidationResult? ValidateUserName(string userName, ValidationContext context)
{
    var form = (RegistrationViewModel)context.ObjectInstance;
    return userName == form.takenUserName
        ? new ValidationResult("That username is taken.")
        : ValidationResult.Success;
}

// Called on submit, or after the username input pauses
private async Task CheckUserNameAsync(CancellationToken cancellationToken)
{
    string candidate = UserName;
    if (await accounts.IsUserNameTakenAsync(candidate, cancellationToken))
    {
        takenUserName = candidate;
        ValidateProperty(UserName, nameof(UserName));
    }
}
```

`ValidateProperty` re-runs a property's rules without changing its value, so the "taken" error appears as soon as the check finishes. A reusable rule becomes a class derived from `ValidationAttribute`. A rule that compares two properties has to be re-run when either changes, so the generated `OnPasswordChanged` partial method of one property calls `ValidateProperty` for the other.

---

## Updating Collections in Batches

`ObservableCollection<T>` raises `CollectionChanged` for every change, and a bound list processes each notification. Adding a thousand search results one at a time sends a thousand notifications, which can make the list stutter while it fills. `ObservableCollection<T>` has no `AddRange`, and the MVVM Toolkit doesn't add one.

The simplest fix for a list that is refreshed wholesale is not to modify it at all. Bind to a property of type `IReadOnlyList<T>` and assign a new list, and the view gets one `PropertyChanged` for the whole result. The paging view model above does this with `Orders`.

A collection that also receives individual edits can add a batch method that raises one `Reset` notification at the end:

```csharp
public class BatchObservableCollection<T> : ObservableCollection<T>
{
    public void AddRange(IEnumerable<T> items)
    {
        CheckReentrancy();
        foreach (T item in items)
        {
            Items.Add(item);   // the inner list, which raises nothing
        }

        OnPropertyChanged(new PropertyChangedEventArgs(nameof(Count)));
        OnPropertyChanged(new PropertyChangedEventArgs("Item[]"));
        OnCollectionChanged(new NotifyCollectionChangedEventArgs(NotifyCollectionChangedAction.Reset));
    }
}
```

`CheckReentrancy` throws if a `CollectionChanged` handler is trying to modify the collection in the middle of a notification, the same guard the built-in methods use. `Items` is the protected inner list, so adding to it bypasses the per-item events, and the method raises the `Count` and indexer notifications that `ObservableCollection<T>` would otherwise have sent. `Reset` tells the list that everything changed, so it rebuilds its view of the collection. That is cheaper than a thousand individual adds, but for a handful of items it does more work than the adds would, and it may cost the user their scroll position or selection. Keep batches for large additions. Like any collection a list is bound to, this one is changed only on the UI thread.

---

## Working Offline

### The Local Store Is the Source of Truth

A desktop app on a laptop loses its network as a matter of course, when the user closes the lid, moves between rooms, or sits on a plane. A local-first design treats that as normal. It costs a local schema, a sync service, and conflict handling, so an app that is useless offline anyway, such as a live dashboard, is better served by an online design with a cache. The app reads from and writes to a local database unconditionally, so every screen works offline. A background sync service pushes local changes to the server when it can and merges the server's changes into the local store, and the view models see those changes when they next read.

Caching sits on the same foundation. An in-memory cache makes repeated reads within a session instant, and data that should survive a restart belongs in the local database, not in a second, separate cache.

### Tracking What Needs to Sync

Each local record carries its sync state, so the sync service can find pending work without comparing everything:

```csharp
public enum SyncStatus { Synced, PendingCreate, PendingUpdate, PendingDelete }

public class LocalProduct
{
    public int LocalId { get; set; }
    public int? ServerId { get; set; }          // assigned by the server after the first sync
    public string Name { get; set; } = string.Empty;
    public SyncStatus SyncStatus { get; set; } = SyncStatus.PendingCreate;
    public DateTime UpdatedAt { get; set; }
}
```

The sync service queries for records whose status isn't `Synced`, sends each to the server, and on success stores the `ServerId` the server returns for a new record. It marks the record `Synced` only if `UpdatedAt` hasn't changed since it was sent, because the user may have edited it again while the upload was in flight. A deleted record stays in the local store as `PendingDelete` until the server confirms, so it isn't resurrected by the next download.

A conflict means the same record changed both locally and on the server since the last sync. A version number that the server increments on every change detects one. The client sends the version its edit was based on, and a mismatch means someone else changed the record in between. Timestamps are weaker, because clocks on different machines disagree, and a timestamp the server assigns records when an edit was uploaded rather than when it was made, which turns last-write-wins into last-upload-wins.

Once the app detects a conflict, it needs a rule to resolve it:

| Strategy | What happens | Suits |
| --- | --- | --- |
| Last write wins | The version with the later timestamp replaces the other | Most single-user data, especially with a visible notice when a local change was overwritten |
| Server wins | Local changes to a record the server has changed are discarded | Reference data the user rarely edits |
| Field-level merge | Changed fields from both sides are combined | Records where losing either side's edit is costly, at the price of tracking changes per field |
| Ask the user | Both versions are shown and the user picks or combines them | Documents and other records where only the user can judge which edit is right |

### Detecting Connectivity

`NetworkInformation` in `Windows.Networking.Connectivity` reports the current connection and raises `NetworkStatusChanged` when it changes. One service wraps it so view models can bind to connection state and tests can fake it:

```csharp
using Windows.Networking.Connectivity;

public sealed class ConnectivityService : IConnectivityService
{
    public ConnectivityService()
    {
        NetworkInformation.NetworkStatusChanged += _ => ConnectivityChanged?.Invoke(this, IsNetworkAvailable);
    }

    public bool IsNetworkAvailable =>
        (NetworkInformation.GetInternetConnectionProfile()?.GetNetworkConnectivityLevel()
            ?? NetworkConnectivityLevel.None) >= NetworkConnectivityLevel.LocalAccess;

    public event EventHandler<bool>? ConnectivityChanged;
}
```

`NetworkStatusChanged` can arrive on a background thread, so a subscriber that updates bound state dispatches to the UI thread first.

Microsoft describes the reported level as only a hint and advises apps to try their services whenever it is `LocalAccess` or better, which is why the service tests for that rather than for `InternetAccess`. A server on the company network is reachable with local access alone, and a public network behind a sign-in page can report `ConstrainedInternetAccess` or `LocalAccess` while the internet is still unreachable. Treat the signal as a cue for when to try syncing, and treat a failed request as the real answer. When a request fails for lack of a network, the view keeps showing local data with an offline indicator, and the change stays pending, rather than showing an error the user can't act on.

Pass a `CancellationToken` to every network call and cancel it when the user leaves the page or the connection drops, so a response that arrives after its screen is gone doesn't try to update it.
