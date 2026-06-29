---
title: "MVVM Pattern with CommunityToolkit.Mvvm"
layout: guide
category: "WinUI 3"
subcategory: "Data & MVVM"
description: "Implementing the Model-View-ViewModel pattern in WinUI 3 using the CommunityToolkit.Mvvm library with source generators for ObservableProperty, RelayCommand, and messaging."
tags: [winui, winui-3, mvvm, data-binding, design-patterns, dotnet, practical]
---

## Table of Contents

- [Why MVVM Matters for WinUI 3](#why-mvvm-matters-for-winui-3)
- [CommunityToolkit.Mvvm Overview](#communitytoolkitmvvm-overview)
- [ObservableObject Base Class](#observableobject-base-class)
- [ObservableProperty Attribute](#observableproperty-attribute)
- [RelayCommand Attribute](#relaycommand-attribute)
- [Messaging with IMessenger](#messaging-with-imessenger)
- [Source Generators and AOT Compatibility](#source-generators-and-aot-compatibility)
- [Practical ViewModel Structure](#practical-viewmodel-structure)

---

## Why MVVM Matters for WinUI 3

WinUI 3 applications built without a clear separation between UI logic and application logic tend to accumulate complexity in their code-behind files. When event handlers in a `MainWindow.xaml.cs` grow to manage state, trigger network calls, format display values, and respond to user input all at once, testing any of that logic becomes difficult. You cannot easily write a unit test against code that directly references `TextBox.Text` or manipulates visual elements.

Model-View-ViewModel addresses this by establishing three layers with distinct responsibilities. The Model holds domain data and business rules without any knowledge of the UI. The View is purely declarative XAML that binds to properties and commands exposed by the ViewModel. The ViewModel contains the logic that connects the two, holding observable state and commands that the View reacts to through data binding.

This structure makes WinUI 3 applications much more testable. A ViewModel is a plain C# class. You can construct it in a test, call methods, set properties, and assert on the resulting state without ever instantiating a window or touching the UI thread. Separation of concerns also means that designers can work on the XAML without touching logic files, and the same ViewModel can theoretically back multiple views.

The binding infrastructure in WinUI 3, particularly compiled bindings using `x:Bind`, is built around `INotifyPropertyChanged` and `ICommand`. ViewModels that implement these interfaces correctly get UI updates for free. When a property changes, any bound control updates automatically; when a command's executability changes, bound buttons enable or disable without manual intervention.

---

## CommunityToolkit.Mvvm Overview

Before the [CommunityToolkit.Mvvm](https://learn.microsoft.com/en-us/dotnet/communitytoolkit/mvvm/){:target="_blank" rel="noopener noreferrer"} library existed, implementing MVVM by hand meant writing boilerplate `INotifyPropertyChanged` implementations repeatedly. Every observable property required a backing field, a getter that returned the field, a setter that compared the old and new values, raised `PropertyChanged` with the property name, and sometimes triggered side effects. Multiplied across dozens of properties in a real application, this became noise that obscured the actual logic.

CommunityToolkit.Mvvm is the officially recommended approach for MVVM in .NET applications including WinUI 3. It is maintained by Microsoft's .NET team and ships as a NuGet package. The library provides base classes and, more significantly, C# source generators that eliminate the boilerplate entirely at compile time.

To add it to a WinUI 3 project, install the NuGet package:

```xml
<PackageReference Include="CommunityToolkit.Mvvm" Version="8.*" />
```

Or via the Package Manager console:

```
dotnet add package CommunityToolkit.Mvvm
```

The library does not require any runtime service registration or dependency injection container, though it integrates cleanly with `Microsoft.Extensions.DependencyInjection` if you use one.

---

## ObservableObject Base Class

The foundation of the toolkit is the `ObservableObject` base class. Inheriting from it gives a class a complete `INotifyPropertyChanged` and `INotifyPropertyChanging` implementation along with several utility methods.

The most useful of those methods is `SetProperty`. Without source generators, you would call it manually in property setters to handle the comparison and change notification in a single line:

```csharp
private string _username = string.Empty;

public string Username
{
    get => _username;
    set => SetProperty(ref _username, value);
}
```

`SetProperty` compares the current backing field value to the incoming value, skips the assignment and notification if they are equal, and raises both `PropertyChanging` before and `PropertyChanged` after the assignment if they differ. This is more reliable than writing the comparison by hand and less error-prone than forgetting to raise both events.

For ViewModels that need to perform async initialization, `ObservableObject` also exposes `SetPropertyAndNotifyOnCompletion` for wrapping `Task` results as observable properties, though source generators provide a cleaner path for most async patterns.

---

## ObservableProperty Attribute

The `[ObservableProperty]` attribute is the highest-impact feature the toolkit provides through source generators. Instead of writing the full property pattern above, you declare a private field and annotate it:

```csharp
public partial class SearchViewModel : ObservableObject
{
    [ObservableProperty]
    private string _searchQuery = string.Empty;

    [ObservableProperty]
    private bool _isLoading;
}
```

The source generator sees these fields at compile time and generates the corresponding public properties, including `INotifyPropertyChanged` notifications, in a separate partial class file. The generated `SearchQuery` property (derived from the `_searchQuery` field by removing the leading underscore and capitalizing) behaves identically to the manually written version.

The attribute also generates partial methods you can implement to hook into the change cycle. `OnSearchQueryChanging` is called before the assignment and `OnSearchQueryChanged` is called after. These are optional; if you do not implement them, the compiler discards the empty partial method signatures at no cost:

```csharp
partial void OnSearchQueryChanged(string value)
{
    // Runs every time SearchQuery changes
    FilterResults(value);
}
```

Two additional attributes on the field declaration connect related properties. `[NotifyPropertyChangedFor(nameof(CanSearch))]` causes the generator to raise `PropertyChanged` for `CanSearch` whenever `_searchQuery` changes. This is how you keep computed properties synchronized without writing manual cross-notification logic:

```csharp
[ObservableProperty]
[NotifyPropertyChangedFor(nameof(CanSearch))]
private string _searchQuery = string.Empty;

public bool CanSearch => !string.IsNullOrWhiteSpace(SearchQuery);
```

`[NotifyCanExecuteChangedFor(nameof(SearchCommand))]` serves a similar purpose for commands: when the annotated field changes, the generator calls `SearchCommand.NotifyCanExecuteChanged()`, prompting the UI to re-evaluate whether the command is executable.

---

## RelayCommand Attribute

Commands in WinUI 3 are bound through `ICommand`, and the toolkit's `[RelayCommand]` attribute generates command properties from ordinary methods. You write the logic as a method, annotate it, and the source generator creates an `IRelayCommand` property with the conventional name derived from the method name:

```csharp
[RelayCommand]
private void ClearSearch()
{
    SearchQuery = string.Empty;
}
```

This generates a `ClearSearchCommand` property of type `RelayCommand`, ready to bind in XAML:

```xml
<Button Command="{x:Bind ViewModel.ClearSearchCommand}" Content="Clear" />
```

For async operations, the method signature determines the generated command type. A method returning `Task` generates an `AsyncRelayCommand`, which handles the async execution on a background thread and exposes an `IsRunning` property for tracking in-flight operations:

```csharp
[RelayCommand]
private async Task SearchAsync(CancellationToken cancellationToken)
{
    IsLoading = true;
    Results = await _searchService.SearchAsync(SearchQuery, cancellationToken);
    IsLoading = false;
}
```

`CanExecute` conditions connect through the `CanExecute` parameter on the attribute, which takes the name of a property or method that returns `bool`:

```csharp
[RelayCommand(CanExecute = nameof(CanSearch))]
private async Task SearchAsync(CancellationToken cancellationToken)
{
    // ...
}

public bool CanSearch => !string.IsNullOrWhiteSpace(SearchQuery) && !IsLoading;
```

When combined with `[NotifyCanExecuteChangedFor(nameof(SearchCommand))]` on the relevant fields, the command button in the UI automatically enables and disables as `SearchQuery` and `IsLoading` change, with no manual wiring required.

---

## Messaging with IMessenger

ViewModels sometimes need to communicate without holding direct references to each other. A `SettingsViewModel` may need to notify a `ShellViewModel` that the theme changed, but creating a direct dependency between them introduces coupling that defeats the purpose of MVVM. The toolkit's `IMessenger` interface solves this through a pub/sub channel.

The toolkit ships two implementations. `WeakReferenceMessenger` holds weak references to registered recipients, which means objects can be garbage collected even if they have not explicitly unregistered. This is the safer default for most cases because it avoids memory leaks when ViewModels are discarded. `StrongReferenceMessenger` holds strong references for scenarios where the recipient must stay alive as long as messages could arrive, such as a long-lived service.

Both implementations follow the same API. A recipient registers for a message type by implementing `IRecipient<TMessage>` and calling `Register`:

```csharp
public sealed class ShellViewModel : ObservableRecipient, IRecipient<ThemeChangedMessage>
{
    public ShellViewModel(IMessenger messenger) : base(messenger)
    {
        IsActive = true;
    }

    public void Receive(ThemeChangedMessage message)
    {
        CurrentTheme = message.Value;
    }
}
```

`ObservableRecipient` is a subclass of `ObservableObject` that integrates with the messenger. Its constructor accepts an `IMessenger` parameter so you can inject the messenger through DI rather than relying on `WeakReferenceMessenger.Default`. Setting `IsActive = true` automatically registers the ViewModel for all message types it implements, and setting it to `false` unregisters it.

Sending a message from any other ViewModel or service requires no knowledge of who is listening. Any class that holds an injected `IMessenger` reference can publish:

```csharp
_messenger.Send(new ThemeChangedMessage(Theme.Dark));
```

The toolkit includes `ValueChangedMessage<T>` as a convenient generic message type for notifying about a single changed value. You can also define custom message classes for domain-specific notifications:

```csharp
public sealed class UserLoggedInMessage : ValueChangedMessage<User>
{
    public UserLoggedInMessage(User user) : base(user) { }
}
```

Messaging is well-suited for navigation events, login state changes, and cross-cutting notifications like theme or locale changes. It is not intended as a general-purpose event bus for every interaction; tightly related ViewModels that have a clear parent/child relationship can still use direct property binding or callbacks without the overhead of a messaging channel.

---

## Source Generators and AOT Compatibility

The `[ObservableProperty]` and `[RelayCommand]` attributes work through C# source generators, which run as part of the build process and emit additional C# code before compilation. The generated code is ordinary C# that you can inspect in Visual Studio by expanding the "Analyzers" node in the project's dependencies. There is no runtime reflection involved.

This matters for WinUI 3 applications targeting .NET Native or ahead-of-time compilation. Frameworks that rely on reflection to discover and invoke members at runtime face trimming and AOT compatibility challenges because the trimmer cannot always determine which methods will be called. Source generators sidestep this entirely because the generated code is statically linked at compile time. The trimmer can see every reference.

The generated partial class pattern requires your ViewModel to be declared as `partial`:

```csharp
public partial class SearchViewModel : ObservableObject
{
    // Fields with [ObservableProperty] and methods with [RelayCommand] here
}
```

Without the `partial` modifier, the source generator has nowhere to write its half of the class, and you will get compile errors. This is the most common mistake when adopting the toolkit for the first time.

Source generation also improves build feedback. Errors in attribute usage, such as using `[NotifyCanExecuteChangedFor]` with a name that does not correspond to a generated command, produce actionable compile-time errors rather than silent runtime failures or NullReferenceExceptions.

---

## Practical ViewModel Structure

A well-organized ViewModel brings all these pieces together in a way that is readable and easy to navigate. The following example shows a realistic ViewModel for a product search screen:

```csharp
public partial class ProductSearchViewModel : ObservableRecipient
{
    private readonly IProductService _productService;

    public ProductSearchViewModel(IProductService productService)
    {
        _productService = productService;
        IsActive = true;
    }

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(CanSearch))]
    [NotifyCanExecuteChangedFor(nameof(SearchCommand))]
    private string _searchQuery = string.Empty;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(CanSearch))]
    [NotifyCanExecuteChangedFor(nameof(SearchCommand))]
    private bool _isLoading;

    [ObservableProperty]
    private IReadOnlyList<Product> _results = [];

    [ObservableProperty]
    private string? _errorMessage;

    public bool CanSearch => !string.IsNullOrWhiteSpace(SearchQuery) && !IsLoading;

    [RelayCommand(CanExecute = nameof(CanSearch))]
    private async Task SearchAsync(CancellationToken cancellationToken)
    {
        ErrorMessage = null;
        IsLoading = true;

        try
        {
            Results = await _productService.SearchAsync(SearchQuery, cancellationToken);
        }
        catch (OperationCanceledException)
        {
            // Cancelled by user, no error to show
        }
        catch (Exception ex)
        {
            ErrorMessage = ex.Message;
        }
        finally
        {
            IsLoading = false;
        }
    }

    [RelayCommand]
    private void ClearSearch()
    {
        SearchQuery = string.Empty;
        Results = [];
        ErrorMessage = null;
    }
}
```

Connecting the ViewModel to its View involves injecting it through the page's constructor. Rather than resolving dependencies from a static service locator like `App.Services`, constructor injection keeps the page testable and makes its dependencies explicit:

```csharp
public sealed partial class ProductSearchPage : Page
{
    public ProductSearchViewModel ViewModel { get; }

    public ProductSearchPage(ProductSearchViewModel viewModel)
    {
        InitializeComponent();
        ViewModel = viewModel;
    }
}
```

This requires that both the page and the ViewModel are registered in the DI container. WinUI 3's `Frame.Navigate` creates pages by type using a parameterless constructor by default, so constructor injection requires a custom navigation service or a page resolver that uses the container to instantiate pages. Most production WinUI 3 apps adopt this pattern because it keeps pages and ViewModels consistently testable.

With the ViewModel exposed as a typed property on the page, `x:Bind` can reference it directly without casting:

```xml
<TextBox Text="{x:Bind ViewModel.SearchQuery, Mode=TwoWay, UpdateSourceTrigger=PropertyChanged}" />
<Button Command="{x:Bind ViewModel.SearchCommand}" Content="Search"
        IsEnabled="{x:Bind ViewModel.CanSearch, Mode=OneWay}" />
<ProgressRing IsActive="{x:Bind ViewModel.IsLoading, Mode=OneWay}" />
<TextBlock Text="{x:Bind ViewModel.ErrorMessage, Mode=OneWay}"
           Visibility="{x:Bind ViewModel.ErrorMessage, Mode=OneWay, Converter={StaticResource NullToVisibilityConverter}}" />
```

The `Mode=TwoWay` on the `TextBox` pushes user input back to the ViewModel, `UpdateSourceTrigger=PropertyChanged` ensures updates happen on each keystroke rather than on focus loss, and the `ProgressRing` and error message react automatically to state changes in the ViewModel without any event handlers.

Organizing ViewModel fields by their role, observable properties first, then computed properties, then commands, keeps the class scannable. Injecting all dependencies through constructors, from services in ViewModels to ViewModels in pages to messengers in recipients, keeps every layer testable and makes the dependency graph explicit. Together, these conventions produce ViewModels that are easy to read, straightforward to test, and simple to bind in XAML.
