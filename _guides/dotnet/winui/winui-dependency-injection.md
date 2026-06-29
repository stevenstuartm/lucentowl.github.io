---
title: "Dependency Injection in WinUI 3"
layout: guide
category: "WinUI 3"
subcategory: "Data & MVVM"
description: "Configuring dependency injection in WinUI 3 applications using Microsoft.Extensions.DependencyInjection and the generic host for service registration, resolution, and lifetime management."
tags: [winui, winui-3, dependency-injection, mvvm, architecture, dotnet, practical]
---

## Why Dependency Injection in a Desktop App

Desktop applications have historically treated dependency injection as an optional luxury, something that ASP.NET developers did because the framework demanded it, while WinForms or WPF developers wired things up manually in code-behind. That attitude has shifted considerably. Modern WinUI 3 applications benefit from the same patterns that make web services testable and maintainable, and the tooling to support those patterns now comes from the same `Microsoft.Extensions` packages that power ASP.NET Core.

The core argument for DI in a desktop application is not complexity for its own sake. It is about the same things it has always been: loose coupling between components, straightforward unit testing without spinning up real UI or real databases, and controlled management of service lifetimes. A `MainViewModel` that receives an `IDataService` through its constructor is trivially testable; a `MainViewModel` that creates its own `SqlDataService` through `new` is not. The MVVM pattern, which WinUI 3 applications commonly follow, only delivers on its testability promise when the ViewModels can have their dependencies substituted.

There is also a practical argument around configuration and logging. The `Microsoft.Extensions.Hosting` ecosystem gives WinUI 3 applications structured logging through `ILogger<T>`, configuration through `IConfiguration`, and hosted background services, none of which require writing custom infrastructure. These capabilities exist as composable packages and integrating them through DI is straightforward.

---

## Setting Up Microsoft.Extensions.DependencyInjection

The starting point is the [Microsoft.Extensions.DependencyInjection](https://www.nuget.org/packages/Microsoft.Extensions.DependencyInjection){:target="_blank" rel="noopener noreferrer"} NuGet package, though if you adopt the generic host you will pull in this and several related packages together. For a minimal setup without the full host, add the package directly and configure the container inside `App.xaml.cs`.

The `ServiceCollection` class serves as the registration surface. You add services to it and then call `BuildServiceProvider()` to produce an `IServiceProvider` that resolves instances. The `App` class is the natural place to own this, since it exists for the lifetime of the application and is created before any windows or pages.

```csharp
// App.xaml.cs
public partial class App : Application
{
    public static IServiceProvider Services { get; private set; } = null!;

    public App()
    {
        this.InitializeComponent();

        var services = new ServiceCollection();
        ConfigureServices(services);
        Services = services.BuildServiceProvider();
    }

    private static void ConfigureServices(IServiceCollection services)
    {
        // Services
        services.AddSingleton<IDataService, SqlDataService>();
        services.AddSingleton<INavigationService, NavigationService>();

        // ViewModels
        services.AddTransient<MainViewModel>();
        services.AddTransient<SettingsViewModel>();
    }

    protected override void OnLaunched(Microsoft.UI.Xaml.LaunchActivatedEventArgs args)
    {
        m_window = new MainWindow();
        m_window.Activate();
    }

    private Window? m_window;
}
```

The static `Services` property gives the application a single access point to the container. This is a pragmatic concession to the reality of XAML-based development, where constructor injection is not always available directly, and it is the pattern Microsoft's own samples use for WinUI 3. The tradeoffs of this approach are worth understanding, which is covered later under service locator patterns.

---

## Service Lifetimes in a Desktop Context

The three lifetime options in `Microsoft.Extensions.DependencyInjection` behave the same way they do in ASP.NET Core, but their practical use differs when there is no HTTP request to act as a natural scope boundary.

`AddSingleton` registers a service such that the container creates exactly one instance for the lifetime of the application. This is appropriate for services that hold shared state or that are expensive to create, such as database connection factories, HTTP clients, navigation state, and application settings. A singleton registered with the container is not the same as a static class; it still receives its own dependencies through injection and can be replaced with a mock in tests.

`AddTransient` registers a service such that the container creates a new instance every time the service is resolved. ViewModels are typically registered as transient because each time a user navigates to a page, you want a fresh ViewModel with a clean initialization state rather than one that retains state from a previous navigation.

`AddScoped` creates one instance per scope, where a scope is a logical unit of work that the application explicitly creates and disposes. In ASP.NET Core, the HTTP request is the scope. In a desktop application, there is no built-in scope boundary, so scoped services behave as singletons unless you manually create `IServiceScope` instances. This is occasionally useful for dialog windows or wizard flows where you want shared service state for the duration of the interaction but not beyond it.

```csharp
// Creating a manual scope for a wizard flow
using var scope = App.Services.CreateScope();
var wizardViewModel = scope.ServiceProvider.GetRequiredService<WizardViewModel>();
var wizardWindow = new WizardWindow { DataContext = wizardViewModel };
wizardWindow.Activate();
// When scope is disposed, scoped services are disposed with it
```

For most WinUI 3 applications, the pattern is: singletons for infrastructure services, transients for ViewModels.

---

## Registering ViewModels and Services

A clean registration pattern separates infrastructure services from UI-layer ViewModels. Services like `IDataService`, `INavigationService`, or `ISettingsService` deal with cross-cutting concerns and are registered as singletons because they do not carry page-specific state. ViewModels are registered as transient because navigation should produce fresh instances.

Navigation services deserve particular attention because they typically need to hold a reference to the application's navigation frame, and that frame is only available after the main window is created. One approach is to register the navigation service as a singleton that accepts an `INavigationFrame` wrapper, then resolve and configure it after window creation.

```csharp
private static void ConfigureServices(IServiceCollection services)
{
    // Infrastructure
    services.AddSingleton<IDataService, LocalDataService>();
    services.AddSingleton<ISettingsService, AppSettingsService>();
    services.AddSingleton<INavigationService, NavigationService>();

    // ViewModels
    services.AddTransient<MainViewModel>();
    services.AddTransient<DetailViewModel>();
    services.AddTransient<SettingsViewModel>();
}
```

ViewModels receive their service dependencies through constructor injection, which is the standard pattern. The container resolves the entire dependency graph automatically, so a `MainViewModel` that depends on `IDataService` and `INavigationService` does not need any manual wiring beyond the registration entries.

```csharp
public class MainViewModel : ObservableObject
{
    private readonly IDataService _dataService;
    private readonly INavigationService _navigationService;

    public MainViewModel(IDataService dataService, INavigationService navigationService)
    {
        _dataService = dataService;
        _navigationService = navigationService;
    }
}
```

---

## Resolving Services and the Service Locator Pattern

Constructor injection is the preferred resolution strategy because it makes dependencies explicit. You can see at a glance what a class depends on, and the compiler enforces that those dependencies are provided. ViewModels follow this pattern naturally because the application code creates them by asking the container rather than using `new`.

Views are different. XAML creates View instances through the XAML runtime, which does not participate in the DI container. A `Page` constructed by XAML navigation cannot receive constructor arguments, so Views must set their `DataContext` through other means. The most direct approach is to resolve the ViewModel inside the View's constructor after the XAML-generated initialization completes.

```csharp
public sealed partial class MainPage : Page
{
    public MainPage()
    {
        this.InitializeComponent();
        DataContext = App.Services.GetRequiredService<MainViewModel>();
    }
}
```

This is technically a service locator call, where code explicitly asks the container for a service rather than receiving it through injection. Service locator is generally considered an anti-pattern because it hides dependencies inside the class body rather than declaring them at the boundary. However, in the XAML context, it is an accepted and practical approach because there is no alternative; the XAML runtime controls View construction.

The important boundary is that ViewModels should never use service locator. If a ViewModel needs a service, it should receive it through its constructor. Only Views, which are created by the XAML runtime, have a legitimate reason to reach into `App.Services` directly.

---

## Microsoft.Extensions.Hosting and the Generic Host

The [Microsoft.Extensions.Hosting](https://www.nuget.org/packages/Microsoft.Extensions.Hosting){:target="_blank" rel="noopener noreferrer"} package provides a generic application host that coordinates service registration, configuration, and logging into a single composition root. For applications that need structured logging, environment-specific configuration files, or background workers, adopting the generic host is worth the additional setup.

The host is configured in `App.xaml.cs` using `Host.CreateDefaultBuilder()`, which wires up default logging providers, loads `appsettings.json` and `appsettings.{Environment}.json` configuration files, and configures the container. You add your own service registrations in a `ConfigureServices` callback.

Using the generic host requires disabling the auto-generated `Main` entry point that WinUI 3 normally produces. Add `DISABLE_XAML_GENERATED_MAIN` to the project's conditional compilation symbols and provide your own `Program.cs`.

```xml
<!-- In the .csproj file -->
<PropertyGroup>
  <DefineConstants>DISABLE_XAML_GENERATED_MAIN</DefineConstants>
</PropertyGroup>
```

```csharp
// Program.cs
public static class Program
{
    [STAThread]
    static void Main(string[] args)
    {
        WinRT.ComWrappersSupport.InitializeComWrappers();
        Application.Start(_ =>
        {
            var context = new DispatcherQueueSynchronizationContext(
                DispatcherQueue.GetForCurrentThread());
            SynchronizationContext.SetSynchronizationContext(context);
            new App();
        });
    }
}
```

```csharp
// App.xaml.cs with the generic host
public partial class App : Application
{
    private readonly IHost _host;

    public static IServiceProvider Services => ((App)Current)._host.Services;

    public App()
    {
        this.InitializeComponent();

        _host = Host.CreateDefaultBuilder()
            .ConfigureServices((context, services) =>
            {
                services.AddSingleton<IDataService, LocalDataService>();
                services.AddSingleton<INavigationService, NavigationService>();
                services.AddTransient<MainViewModel>();
                services.AddTransient<SettingsViewModel>();
            })
            .Build();
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        _host.Start();
        m_window = new MainWindow();
        m_window.Activate();
    }

    private Window? m_window;
}
```

With this setup, `ILogger<T>` becomes available for injection throughout the application without any additional configuration. The host also supports `IHostedService` implementations for background processing, which is valuable for applications that need to run tasks like cache warming or periodic sync outside the UI thread.

---

## Connecting DI to Views

Getting ViewModels into Views requires choosing between two broad strategies: View-first and ViewModel-first navigation.

In View-first navigation, the navigation system creates the View by type and the View is responsible for acquiring its ViewModel. This is the pattern that WinUI 3's `Frame.Navigate()` API naturally supports, since it takes a `Type` parameter and creates the Page instance internally. The View resolves its ViewModel from the container in its constructor, as shown earlier. This approach is simple and aligns with how the default navigation templates work.

In ViewModel-first navigation, the application creates the ViewModel first and then creates or locates a View that matches it. This approach gives more control to the application layer and keeps Views more passive, but it requires a more sophisticated navigation service that maps ViewModel types to View types.

For applications where View-first navigation is sufficient, a ViewModelLocator can reduce the boilerplate of resolving ViewModels in each page's constructor. The locator is a class registered as a singleton that exposes properties returning resolved ViewModel instances. Views bind their `DataContext` to a locator property through XAML.

```csharp
public class ViewModelLocator
{
    public MainViewModel Main => App.Services.GetRequiredService<MainViewModel>();
    public SettingsViewModel Settings => App.Services.GetRequiredService<SettingsViewModel>();
}
```

```xml
<!-- App.xaml resources -->
<Application.Resources>
    <ResourceDictionary>
        <local:ViewModelLocator x:Key="Locator" />
    </ResourceDictionary>
</Application.Resources>
```

```xml
<!-- MainPage.xaml -->
<Page DataContext="{Binding Main, Source={StaticResource Locator}}">
```

The locator pattern has a notable caveat: because `AddTransient` creates a new instance on every `GetRequiredService` call, each time a page resolves its ViewModel property from the locator, it receives a fresh instance. This is usually the desired behavior for navigation. If you need a ViewModel that persists across navigations, register it as a singleton or manage the lifetime explicitly.

---

## Practical Example: Wiring Up Navigation, Data, and ViewModel

Bringing these pieces together, consider an application with a `MainPage` that displays a list of items fetched through a `IDataService`, and a `INavigationService` that handles navigation to a detail page.

```csharp
// Interfaces
public interface IDataService
{
    Task<IEnumerable<Item>> GetItemsAsync();
}

public interface INavigationService
{
    void NavigateTo<TViewModel>(object? parameter = null);
}

// Implementations (registered as singletons)
public class LocalDataService : IDataService
{
    public async Task<IEnumerable<Item>> GetItemsAsync()
    {
        // fetch from local storage
        await Task.Delay(50);
        return new[] { new Item("Alpha"), new Item("Beta") };
    }
}

public class NavigationService : INavigationService
{
    private Frame? _frame;

    public void Initialize(Frame frame) => _frame = frame;

    public void NavigateTo<TViewModel>(object? parameter = null)
    {
        var pageType = ResolvePageType(typeof(TViewModel));
        _frame?.Navigate(pageType, parameter);
    }

    private static Type ResolvePageType(Type viewModelType)
    {
        // Convention: MainViewModel -> MainPage
        var name = viewModelType.Name.Replace("ViewModel", "Page");
        return Type.GetType($"MyApp.Views.{name}")
            ?? throw new InvalidOperationException($"No page found for {viewModelType.Name}");
    }
}
```

```csharp
// MainViewModel (registered as transient)
public partial class MainViewModel : ObservableObject
{
    private readonly IDataService _dataService;
    private readonly INavigationService _navigationService;

    [ObservableProperty]
    private ObservableCollection<Item> _items = new();

    public MainViewModel(IDataService dataService, INavigationService navigationService)
    {
        _dataService = dataService;
        _navigationService = navigationService;
    }

    public async Task LoadAsync()
    {
        var data = await _dataService.GetItemsAsync();
        Items = new ObservableCollection<Item>(data);
    }

    [RelayCommand]
    private void NavigateToDetail(Item item)
        => _navigationService.NavigateTo<DetailViewModel>(item.Id);
}
```

```csharp
// MainPage.xaml.cs
public sealed partial class MainPage : Page
{
    public MainViewModel ViewModel { get; }

    public MainPage()
    {
        this.InitializeComponent();
        ViewModel = App.Services.GetRequiredService<MainViewModel>();
        DataContext = ViewModel;
    }

    protected override async void OnNavigatedTo(NavigationEventArgs e)
    {
        base.OnNavigatedTo(e);
        await ViewModel.LoadAsync();
    }
}
```

The registration in `App.xaml.cs` completes the picture:

```csharp
private static void ConfigureServices(IServiceCollection services)
{
    services.AddSingleton<IDataService, LocalDataService>();
    services.AddSingleton<INavigationService, NavigationService>();
    services.AddTransient<MainViewModel>();
    services.AddTransient<DetailViewModel>();
}
```

When `MainPage` is created, it resolves a fresh `MainViewModel` from the container. The container sees that `MainViewModel` depends on `IDataService` and `INavigationService`, resolves those singletons from its registrations, and injects them into the constructor. The `NavigationService` singleton is the same instance that every ViewModel receives, so navigation state is consistent across the application.

This pattern scales cleanly. Adding a new feature means creating a new ViewModel with its dependencies declared in the constructor, registering it as transient, and creating its corresponding View. The container handles the wiring; the application code handles the behavior.
