---
title: "MVVM Pattern with CommunityToolkit.Mvvm"
layout: guide
category: "WinUI 3"
subcategory: "Data & MVVM"
description: "Structuring WinUI 3 apps with Model-View-ViewModel using CommunityToolkit.Mvvm: observable partial properties and why WinUI needs them, generated relay and async commands with cancellation and concurrency control, messaging between view models, and XAML Behaviors for invoking commands from any event."
tags: [mvvm, communitytoolkit-mvvm, source-generators, relaycommand, messenger, xaml-behaviors, practical]
---

## Where MVVM Puts Each Kind of Code

A page whose code-behind loads data, formats it, tracks what is selected, and reacts to every click works at first and becomes hard to change and harder to test. Its logic reads `TextBox.Text` and sets `Button.IsEnabled` directly, so a test has to create the controls to exercise it.

Model-View-ViewModel splits that code into three roles:

| Role | Holds | Knows about |
| --- | --- | --- |
| **Model** | Domain data and rules, plus the services that load and save it | Nothing about the UI |
| **ViewModel** | The state a screen shows, as properties, and what the user can do, as commands | The model, but no controls |
| **View** | The XAML page and its minimal code-behind | The view model, through bindings |

The view model is an ordinary C# class. A test constructs it with fake services, sets properties, runs commands, and checks the resulting state without a window or a UI thread. The view connects to it through data binding. Properties raise `PropertyChanged` so bound controls update, and buttons bind to `ICommand` objects that run the view model's logic and enable or disable themselves.

Writing those notifications and commands by hand is repetitive. The [MVVM Toolkit](https://learn.microsoft.com/en-us/dotnet/communitytoolkit/mvvm/){:target="_blank" rel="noopener noreferrer"} (`CommunityToolkit.Mvvm`), part of the .NET Community Toolkit and maintained and published by Microsoft, generates them. It targets .NET Standard and works with any UI framework, and it requires no particular app structure or DI container.

---

## Observable Properties

### ObservableObject

View models derive from `ObservableObject`, which implements `INotifyPropertyChanged` and `INotifyPropertyChanging`. Its `SetProperty` method does the whole setter in one call. It compares the old and new values, and when they differ it raises `PropertyChanging`, assigns the field, and raises `PropertyChanged`.

```csharp
private string _username = string.Empty;

public string Username
{
    get => _username;
    set => SetProperty(ref _username, value);
}
```

Most properties never need even that much, because a source generator writes it.

### Generating Properties with [ObservableProperty]

A source generator runs during the build and adds C# code to your project, which you can read under the project's **Dependencies > Analyzers** node in Visual Studio. Mark a `partial` property with `[ObservableProperty]`, and the toolkit's generator writes its implementation in the other half of a `partial` class:

```csharp
using CommunityToolkit.Mvvm.ComponentModel;

public partial class SearchViewModel : ObservableObject
{
    [ObservableProperty]
    public partial string SearchQuery { get; set; }

    [ObservableProperty]
    public partial bool ShowArchived { get; set; }

    public SearchViewModel()
    {
        SearchQuery = string.Empty;
    }
}
```

The class has to be `partial` too, as does every class it's nested in, or the generator has nowhere to put its code and the build fails.

Older code and most tutorials put the attribute on a private field, such as `[ObservableProperty] private string _searchQuery;`, and the generator creates a `SearchQuery` property from it. The toolkit still supports that form, but WinUI has a reason to avoid it. `{x:Bind}` compiles to C# that reads your properties directly, but `{Binding}` and `DisplayMemberPath` are resolved at runtime by WinUI's native XAML engine, which reads your view model's properties through WinRT, Windows' cross-language object model. CsWinRT generates the C# glue that makes that possible. When an app is compiled ahead of time with Native AOT, that glue has to be generated at build time, and CsWinRT's generator can see a declared partial property but not one that another generator creates from a field. Since version 8.4, the toolkit reports warning MVVMTK0045 for field-based properties in WinUI projects that use CsWinRT's AOT support. Partial properties needed `LangVersion` set to `preview` in 8.4.0. From 8.4.1 on, they need C# 14, which is the default for a project targeting .NET 10, as current WinUI templates do. A project on an older target framework needs the .NET 10 SDK and `<LangVersion>14</LangVersion>` in its project file.

The samples here assign starting values in the constructor. That assignment goes through the generated setter, so it runs the change hooks described next, which a field-based property with an initialized field didn't do.

### Running Code When a Property Changes

The generated setter calls partial methods you can choose to implement. `OnSearchQueryChanging` runs before the new value is stored and `OnSearchQueryChanged` after, and each comes in two overloads, one taking the new value and one taking the old and new values:

```csharp
partial void OnSearchQueryChanged(string value)
{
    // Runs after every change to SearchQuery
    ApplyFilter(value);
}

partial void OnSelectedItemChanged(ItemViewModel? oldValue, ItemViewModel? newValue)
{
    if (oldValue is not null) oldValue.IsSelected = false;
    if (newValue is not null) newValue.IsSelected = true;
}
```

Methods you don't implement are removed by the compiler, so they cost nothing. The implementations are declared with plain `partial` and no access modifier, because C# doesn't allow one on these methods.

### Keeping Dependent Properties and Commands in Step

A computed property such as `HasQuery` has no setter, so nothing announces its changes. `[NotifyPropertyChangedFor]` makes the generated setter of the property it depends on raise `PropertyChanged` for it too:

```csharp
[ObservableProperty]
[NotifyPropertyChangedFor(nameof(HasQuery))]
public partial string SearchQuery { get; set; }

public bool HasQuery => !string.IsNullOrWhiteSpace(SearchQuery);
```

The same pattern extends to commands with `[NotifyCanExecuteChangedFor]`, covered with commands below. The toolkit can also generate a validation call in the setter with `[NotifyDataErrorInfo]`, on a view model derived from `ObservableValidator`, and a change message with `[NotifyPropertyChangedRecipients]`, on a view model that uses messaging.

---

## Commands

### Generating Commands with [RelayCommand]

`[RelayCommand]` on a method generates a command property that runs it. The name is the method name with any `On` prefix and `Async` suffix removed, followed by `Command`:

```csharp
using CommunityToolkit.Mvvm.Input;

[RelayCommand]
private void ClearSearch()         // generates ClearSearchCommand (IRelayCommand)
{
    SearchQuery = string.Empty;
}

[RelayCommand]
private void OpenItem(Item item)   // generates OpenItemCommand (IRelayCommand<Item>)
{
    // ...
}
```

```xml
<Button Content="Clear" Command="{x:Bind ViewModel.ClearSearchCommand}" />
```

`ViewModel` in these bindings is a property on the page's code-behind that holds its view model, the root that `{x:Bind}` paths start from.

A method with one parameter produces a generic command, and the button supplies the argument through `CommandParameter`.

### Enabling and Disabling Commands

`CanExecute` names a property or method that returns `bool`. A button bound to the command disables itself whenever that check returns `false`:

```csharp
[RelayCommand(CanExecute = nameof(HasQuery))]
private async Task SearchAsync(CancellationToken token) { /* ... */ }
```

The command runs the check when the button first binds and again only when something calls `NotifyCanExecuteChanged` on it, which raises `CanExecuteChanged` and makes the button ask again. It doesn't watch the properties the check reads. Put `[NotifyCanExecuteChangedFor]` on each of those properties, and the generated setter makes the call:

```csharp
[ObservableProperty]
[NotifyCanExecuteChangedFor(nameof(SearchCommand))]
public partial string SearchQuery { get; set; }
```

Without it the button keeps whatever state it had first.

### Async Commands

A method returning `Task` generates an `IAsyncRelayCommand`. It does not move the work to a background thread. Clicking the button calls the method on the UI thread, which runs until its first `await` like any `async` method, so slow synchronous work before that point still freezes the window. What the command adds is tracking of the running task:

| Member or option | What it does |
| --- | --- |
| `IsRunning` | `true` while an execution is in progress, and raises `PropertyChanged`, so a `ProgressRing` can bind to it directly |
| `ExecutionTask` | The task of the current or last execution |
| `AllowConcurrentExecutions` | `false` by default, which reports the command as disabled while it runs, so a second click can't start a second search |
| A `CancellationToken` parameter | The command passes a token to the method, which makes `Cancel()` signal it and `CanBeCanceled` report `true` while it runs |
| `IncludeCancelCommand = true` | Also generates a cancel command, `SearchCancelCommand` for `SearchAsync`, which is enabled only while the search runs |
| `FlowExceptionsToTaskScheduler` | `false` by default, so an exception is rethrown on the UI thread and reaches `Application.UnhandledException`, like one from a synchronous command, and can terminate the app. When `true`, it is stored on `ExecutionTask` and raised to `TaskScheduler.UnobservedTaskException` instead |

Because the default rethrows, an async command that can fail, which is nearly any command that calls a network or file service, catches its own exceptions and turns them into state the view can show.

---

## Messaging Between View Models

Two view models that need to react to each other, such as a settings page changing the theme that a shell view model displays, could hold references to each other. That couples them, and it gets worse as more screens join in. `IMessenger` replaces the references with messages. A sender sends an object of some message type, and every recipient registered for that type receives it, without either side knowing about the other.

The toolkit ships two messengers with the same API:

| | `WeakReferenceMessenger` | `StrongReferenceMessenger` |
| --- | --- | --- |
| Holds recipients by | Weak reference | Strong reference |
| A recipient that is never unregistered | Can still be garbage collected | Stays in memory: a leak |
| Performance and memory use | Slower | Better, with far less memory |
| Used by default | Yes, by `ObservableRecipient` | Only when passed in explicitly |

`WeakReferenceMessenger` is the forgiving choice. Unregistering is still good practice with it, for performance, and it is required with `StrongReferenceMessenger`.

A view model that receives messages usually derives from `ObservableRecipient`, which adds a messenger to `ObservableObject`, and implements `IRecipient<TMessage>` for each message type:

```csharp
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Messaging;
using CommunityToolkit.Mvvm.Messaging.Messages;
using Microsoft.UI.Xaml;

public sealed class ThemeChangedMessage(ElementTheme theme)
    : ValueChangedMessage<ElementTheme>(theme);

public sealed partial class ShellViewModel : ObservableRecipient, IRecipient<ThemeChangedMessage>
{
    public ShellViewModel(IMessenger messenger) : base(messenger)
    {
        IsActive = true;   // registers every IRecipient<T> this class implements
    }

    [ObservableProperty]
    public partial ElementTheme CurrentTheme { get; set; }

    public void Receive(ThemeChangedMessage message) => CurrentTheme = message.Value;
}
```

`ValueChangedMessage<T>` is a base class for messages that carry one value, exposed as `Value`. Setting `IsActive` to `true` registers the view model for every message type it implements, and setting it to `false` unregisters all of them, which matters most with `StrongReferenceMessenger`. Taking `IMessenger` as a constructor parameter, rather than using `WeakReferenceMessenger.Default`, lets a test pass in its own messenger. The sender, here another `ObservableRecipient` using its `Messenger` property, needs no knowledge of recipients:

```csharp
Messenger.Send(new ThemeChangedMessage(ElementTheme.Dark));
```

`Send` calls each recipient's `Receive` before it returns, on the sender's thread. A message sent from background work therefore sets `CurrentTheme` off the UI thread, and the bound control throws, so send from the UI thread or dispatch back to it first.

Messages can also ask for a value. A `RequestMessage<T>` is sent, a recipient calls `Reply` on it, and the sender reads the reply. `AsyncRequestMessage<T>` does the same with a `Task<T>`. `WeakReferenceMessenger.Default` is one messenger shared by the whole process. A channel token passed to `Register` and `Send` separates traffic on it, so two parts of an app, such as two windows, can use the same message type without hearing each other.

Reserve messaging for notifications that cross screens, like sign-in state, theme, or locale. A parent view model that owns its children can call them directly, and routing that through a messenger hides a dependency that plain code would make obvious.

---

## Invoking Commands from Any Event with XAML Behaviors

A `Button` has a `Command` property, but most events have nothing like it. A `ListView` double-tap, a `TextBox` losing focus, or a page finishing loading can only run a view model command through an event handler in code-behind. The [XAML Behaviors](https://github.com/microsoft/XamlBehaviors){:target="_blank" rel="noopener noreferrer"} package, `Microsoft.Xaml.Behaviors.WinUI.Managed`, closes that gap declaratively. Since version 3.0, all of its types live in one namespace, `Microsoft.Xaml.Interactivity`.

```xml
<Page xmlns:i="using:Microsoft.Xaml.Interactivity" ...>

    <TextBox Text="{x:Bind ViewModel.Email, Mode=TwoWay}">
        <i:Interaction.Behaviors>
            <i:EventTriggerBehavior EventName="LostFocus">
                <i:InvokeCommandAction Command="{x:Bind ViewModel.ValidateEmailCommand}" />
            </i:EventTriggerBehavior>
        </i:Interaction.Behaviors>
    </TextBox>
```

`EventTriggerBehavior` listens for the named event, and `InvokeCommandAction` runs the command when it fires. `DataTriggerBehavior` runs its actions when a bound value meets a condition, instead of on an event. A custom behavior derives from `Behavior<T>` and attaches its logic in `OnAttached` and removes it in `OnDetaching`, which packages view-only logic like scrolling a list to its newest item so no code-behind has to hold it. The Community Toolkit's `CommunityToolkit.WinUI.Behaviors` package adds more ready-made behaviors on top of this one.

Reach for a behavior when no command property exists. Where one does, bind it directly, since a behavior adds a package and a layer of markup for no gain.

---

## A Complete View Model

A product search screen brings the pieces together. The search command can't run on an empty query, reports its own progress, can be cancelled, and turns failures into a message:

```csharp
public partial class ProductSearchViewModel : ObservableObject
{
    private readonly IProductService _productService;

    public ProductSearchViewModel(IProductService productService)
    {
        _productService = productService;
        SearchQuery = string.Empty;
        Results = [];
    }

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(SearchCommand))]
    public partial string SearchQuery { get; set; }

    [ObservableProperty]
    public partial IReadOnlyList<Product> Results { get; set; }

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(HasError))]
    public partial string? ErrorMessage { get; set; }

    public bool HasError => ErrorMessage is not null;

    private bool CanSearch() => !string.IsNullOrWhiteSpace(SearchQuery);

    [RelayCommand(CanExecute = nameof(CanSearch), IncludeCancelCommand = true)]
    private async Task SearchAsync(CancellationToken token)
    {
        ErrorMessage = null;
        try
        {
            Results = await _productService.SearchAsync(SearchQuery, token);
        }
        catch (OperationCanceledException)
        {
            // The user cancelled; keep the previous results.
        }
        catch (Exception ex)
        {
            ErrorMessage = ex.Message;
        }
    }

    [RelayCommand]
    private void ClearSearch()
    {
        SearchCommand.Cancel();
        SearchQuery = string.Empty;
        Results = [];
        ErrorMessage = null;
    }
}
```

```xml
<TextBox Text="{x:Bind ViewModel.SearchQuery, Mode=TwoWay, UpdateSourceTrigger=PropertyChanged}" />
<Button Content="Search" Command="{x:Bind ViewModel.SearchCommand}" />
<Button Content="Cancel" Command="{x:Bind ViewModel.SearchCancelCommand}" />
<ProgressRing IsActive="{x:Bind ViewModel.SearchCommand.IsRunning, Mode=OneWay}" />
<ListView ItemsSource="{x:Bind ViewModel.Results, Mode=OneWay}" />
<InfoBar Severity="Error" IsClosable="False"
         IsOpen="{x:Bind ViewModel.HasError, Mode=OneWay}"
         Message="{x:Bind ViewModel.ErrorMessage, Mode=OneWay}" />
```

{% include figure.html id="winui-mvvm-command-loop" %}

No `IsLoading` property is needed, because the command's `IsRunning` already tracks the search. The `await` in `SearchAsync` resumes on the UI thread, so setting `Results` and `ErrorMessage` afterward is safe.

A `Frame` creates pages through their parameterless constructor, so a view model that takes services is usually resolved from a DI container rather than passed into the page's constructor.
